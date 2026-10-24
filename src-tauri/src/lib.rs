pub mod ai;
pub mod chat_store;
pub mod web_sessions;
pub mod web_history_sync;
pub mod config;
pub mod file_selection;
mod file_drag;
pub mod link_metadata;
pub mod overlay;
pub mod picker;
pub mod selection;
pub mod site_presets;
pub mod trigger;
pub mod tray;
pub mod window_manager;
mod web_chrome;

use ai::AiManager;
use config::AppConfig;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

pub struct AppState {
    pub config: config::ConfigStore,
    pub ai_manager: AiManager,
    pub web_hub_state: Mutex<ai::WebHubState>,
    pub web_injections: Mutex<std::collections::HashMap<String, tokio_util::sync::CancellationToken>>,
    pub web_chrome: web_chrome::WebChromeState,
}

/// 配置提交成功后的发布 adapter：先广播已提交快照，再应用原生窗口效果。
struct TauriConfigPublisher {
    app: AppHandle,
}

impl config::ConfigPublisher for TauriConfigPublisher {
    fn publish(&self, previous: &AppConfig, current: &AppConfig) {
        let _ = self.app.emit("config_updated", current);
        window_manager::apply_config_effects(&self.app, previous, current);
    }
}

#[tauri::command]
fn open_settings_devtools(webview: tauri::Webview) -> Result<(), String> {
    if webview.label() != "main" {
        return Err("Developer tools can only be opened from settings".into());
    }
    webview.open_devtools();
    Ok(())
}

#[tauri::command]
fn get_config(state: State<AppState>) -> AppConfig {
    state.config.snapshot()
}

#[tauri::command]
fn save_config(new_config: AppConfig, state: State<AppState>) -> Result<(), String> {
    state.config.replace(new_config)?;
    Ok(())
}

/// 即时切换界面样式并单独持久化，不提交设置页其他未保存的修改
#[tauri::command]
fn set_ui_style(state: State<AppState>, style: String) -> Result<(), String> {
    let style = config::normalize_ui_style(&style);
    state.config.commit(|config| {
        if config.general.ui_style == style {
            false
        } else {
            config.general.ui_style = style;
            true
        }
    })?;
    Ok(())
}

#[tauri::command]
async fn trigger_web_action(
    app: AppHandle,
    state: State<'_, AppState>,
    action_id: String,
    text: String,
    copy_to_clipboard: Option<bool>,
    auto_submit_override: Option<bool>,
) -> Result<(), String> {
    let config = state.config.snapshot();
    let action = config
        .actions
        .iter()
        .find(|a| a.id == action_id)
        .cloned()
        .ok_or_else(|| format!("Action '{}' not found", action_id))?;

    ai::execute_web_action(
        &app,
        &config,
        &action,
        &text,
        copy_to_clipboard,
        auto_submit_override,
    )
}

/// Ok means the attachment attempt was scheduled; acceptance is shown by the website.
#[tauri::command]
async fn trigger_web_file_action(
    app: AppHandle,
    webview: tauri::Webview,
    state: State<'_, AppState>,
    action_id: String,
    files: Vec<String>,
    drag_id: u64,
) -> Result<(), String> {
    if webview.label() != "overlay" {
        return Err("文件动作仅允许从文件选择菜单触发".into());
    }
    file_selection::claim_dropped_files(drag_id, &files)?;
    let result = (|| {
        let config = state.config.snapshot();
        if !config.general.auto_popup_on_file_selection {
            return Err("文件拖放功能已关闭".into());
        }
        ai::web_action::execute_web_file_action(&app, &config, &action_id, &files)
    })();
    if result.is_err() { file_selection::allow_retry(drag_id); }
    result
}

fn resolve_api_request_config(
    config: &AppConfig,
    action_id: &str,
    provider_override: Option<&str>,
    model_override: Option<String>,
    prompt_override: Option<String>,
) -> Result<(config::ProviderConfig, String, String), String> {
    let action = config
        .actions
        .iter()
        .find(|a| a.id == action_id)
        .ok_or_else(|| format!("Action '{}' not found", action_id))?;

    let provider_id = provider_override
        .or(action.provider_id.as_deref())
        .ok_or_else(|| "Action has no assigned provider".to_string())?;

    let provider = config
        .providers
        .iter()
        .find(|p| p.id == provider_id)
        .cloned()
        .ok_or_else(|| format!("Provider '{}' not found", provider_id))?;

    // 显式选择绝不会静默回退到动作的服务商；缺省覆盖沿用动作绑定。
    // `enabled` 只是前端选择器的可选来源，不是执行许可：已绑定的服务商即使停用也照常请求。
    //
    // 模型回退顺序：显式覆盖 → 服务商默认模型 → 模型列表首项。
    // 空值不算一次明确选择，继续沿回退链查找；全空则拒绝，绝不向服务商发送空模型。
    let model = model_override
        .as_deref()
        .into_iter()
        .chain([provider.default_model.as_str()])
        .chain(provider.models.first().map(String::as_str))
        .find(|model| !model.trim().is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("服务商 '{}' 未配置可用模型", provider_id))?;

    let template = prompt_override
        .or_else(|| action.prompt_template.clone())
        .unwrap_or_else(|| "{text}".to_string());

    Ok((provider, model, template))
}

#[tauri::command]
fn trigger_api_action(
    app: AppHandle,
    state: State<AppState>,
    action_id: String,
    request_id: String,
    text: String,
    provider_override: Option<String>,
    model_override: Option<String>,
    prompt_override: Option<String>,
    thinking_enabled: Option<bool>,
    reasoning_effort: Option<ai::stream::ReasoningEffort>,
) -> Result<(), String> {
    let (provider, model, prompt_template) = {
        let config = state.config.snapshot();
        resolve_api_request_config(
            &config,
            &action_id,
            provider_override.as_deref(),
            model_override,
            prompt_override,
        )?
    };

    let user_prompt = ai::render_prompt_template(&prompt_template, &text);
    // Register before spawning so an accepted request can always be canceled immediately.
    let request = state.ai_manager.begin(
        action_id,
        request_id,
        Arc::new(move |event| {
            if let Err(error) = app.emit(event.name(), &event) {
                eprintln!("AI stream event submission failed: {error}");
            }
        }),
    )?;

    tauri::async_runtime::spawn(async move {
        ai::execute_stream_request(
            request,
            provider,
            model,
            None,
            user_prompt,
            thinking_enabled.unwrap_or(false),
            reasoning_effort,
        )
        .await;
    });

    Ok(())
}

#[tauri::command]
fn cancel_action(
    state: State<AppState>,
    action_id: String,
    request_id: String,
) -> Result<bool, String> {
    state.ai_manager.cancel(&action_id, &request_id)
}

/// 前端唯一的形态与几何入口：形态政策与原生尺寸在一次调用中提交，避免两者交错
#[tauri::command]
fn layout_overlay(
    app: AppHandle,
    mode: String,
    width: i32,
    height: i32,
    allow_focus: Option<bool>,
) -> Result<(), String> {
    overlay::apply_layout(
        &app,
        overlay::Mode::from_label(&mode),
        width,
        height,
        allow_focus.unwrap_or(false),
    )
}

#[tauri::command]
fn toggle_maximize_overlay(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        let is_max = window.is_maximized().map_err(|e| e.to_string())?;
        if is_max {
            window.unmaximize().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            window.maximize().map_err(|e| e.to_string())?;
            Ok(true)
        }
    } else {
        Err("Overlay window not found".to_string())
    }
}

#[tauri::command]
fn show_main_window(app: AppHandle, target_tab: Option<String>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(hwnd) = window.hwnd() {
            let hwnd_raw = hwnd.0 as _;
            window_manager::apply_main_window_native_style(hwnd_raw);
            window_manager::bring_window_to_foreground(hwnd_raw);
        }
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        if let Some(tab) = target_tab {
            let _ = app.emit("open_settings_tab", tab);
        }
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
fn hide_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
fn minimize_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
fn toggle_maximize_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
fn hide_overlay(app: AppHandle) {
    // 主动关闭先作废文件拖放会话，再结束本次悬浮窗会话。
    // 刻意不复位 Pin 状态：钉住是跨会话的用户偏好（由前端 localStorage 记忆），
    // 隐藏后的残留 pin 不会拦截后续划词（协调 module 只保护「钉住且可见的卡片」）。
    file_selection::cancel_pending();
    overlay::close(&app);
}

#[tauri::command]
fn set_pin_state(pinned: bool) {
    overlay::set_pinned(pinned);
}

#[tauri::command]
fn save_api_card_size(
    state: State<AppState>,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if width < 320.0 || height < 200.0 {
        return Ok(());
    }
    let size = (width.round(), height.round());
    state.config.commit(|config| {
        if config.api_card.card_size == size {
            return false;
        }
        config.api_card.card_size = size;
        true
    })?;
    Ok(())
}

#[tauri::command]
fn start_overlay_dragging(app: AppHandle) {
    tauri::async_runtime::spawn_blocking(move || overlay::drag(&app));
}

#[tauri::command]
fn close_web_window(app: AppHandle, state: State<AppState>, label: String) -> Result<(), String> {
    if let Some(window) = app.get_window(&label) {
        if !window.is_maximized().unwrap_or(false) {
            if let Ok(size) = window.inner_size() {
                let scale = window.scale_factor().unwrap_or(1.0);
                let w = (size.width as f64 / scale).round();
                let h = (size.height as f64 / scale).round();
                if w >= 520.0 && h >= 400.0 {
                    // 窗口尺寸是关闭流程的附带记忆，保存失败不影响关闭结果。
                    let _ = state.config.commit(|config| {
                        if config.general.web_window_size == (w, h) {
                            false
                        } else {
                            config.general.web_window_size = (w, h);
                            true
                        }
                    });
                }
            }
        }
        let _ = window.hide();
        Ok(())
    } else {
        Err("Window not found".to_string())
    }
}

#[tauri::command]
fn minimize_web_window(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_window(&label) {
        let _ = window.minimize();
        Ok(())
    } else {
        Err("Window not found".to_string())
    }
}

#[tauri::command]
fn toggle_maximize_web_window(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_window(&label) {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
        Ok(())
    } else {
        Err("Window not found".to_string())
    }
}

#[tauri::command]
fn reload_web_webview(app: AppHandle, content_label: String) -> Result<(), String> {
    if let Some(wv) = app.get_webview(&content_label) {
        let _ = wv.eval("window.location.reload()");
        Ok(())
    } else {
        Err("Webview not found".to_string())
    }
}

#[tauri::command]
fn open_in_browser(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_web_hub_state(state: State<AppState>) -> ai::WebHubState {
    state.web_hub_state.lock().unwrap().clone()
}

/// 返回全部站点预设（单一数据源，前端通过此命令获取站点列表，禁止前端硬编码）
#[tauri::command]
fn get_site_presets() -> Vec<site_presets::SitePreset> {
    site_presets::all()
}

#[tauri::command]
fn switch_web_hub_tab(app: AppHandle, state: State<AppState>, action_id: String) -> Result<(), String> {
    ai::switch_web_hub_tab(&app, &state, &action_id)
}

#[tauri::command]
fn close_web_hub_tab(app: AppHandle, state: State<AppState>, action_id: String) -> Result<(), String> {
    ai::close_web_hub_tab(&app, &state, &action_id)
}

#[tauri::command]
fn reload_web_hub_active_tab(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    ai::reload_web_hub_active_tab(&app, &state)
}

#[tauri::command]
async fn start_window_picker(app: AppHandle) -> Result<Option<picker::PickedProcessInfo>, String> {
    let res = tauri::async_runtime::spawn_blocking(move || {
        picker::pick_window_blocking()
    })
    .await
    .map_err(|e| e.to_string())??;

    if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(hwnd) = main_win.hwnd() {
            window_manager::apply_main_window_native_style(hwnd.0 as _);
        }
        let _ = main_win.show();
        let _ = main_win.unminimize();
        let _ = main_win.set_focus();
    }

    Ok(res)
}

#[tauri::command]
fn cancel_window_picker() {
    picker::cancel_picking();
}

#[tauri::command]
async fn fetch_provider_models(
    base_url: String,
    api_key: String,
) -> Result<Vec<String>, String> {
    ai::fetch_provider_models(base_url, api_key).await
}

#[tauri::command]
async fn fetch_provider_balance(
    state: State<'_, AppState>,
    provider_id: String,
    expected_base_url: String,
    expected_api_key: String,
) -> Result<ai::balance::ProviderBalance, ai::balance::BalanceError> {
    let provider = state
        .config
        .snapshot()
        .providers
        .into_iter()
        .find(|provider| provider.id == provider_id)
        .ok_or(ai::balance::BalanceError::ProviderMissing)?;
    // 广播抵达前的旧前端快照不能把新账号的余额缓存到旧账号下。
    ai::balance::verify_account(
        &provider.base_url,
        &provider.api_key,
        &expected_base_url,
        &expected_api_key,
    )?;
    ai::balance::fetch_provider_balance(&provider.base_url, &provider.api_key).await
}

/// 悬浮球开关的唯一提交入口：设置页、托盘与命令共用。
pub(crate) fn set_floating_ball_visible(
    store: &config::ConfigStore,
    visible: bool,
) -> Result<(), String> {
    store.commit(|config| {
        if config.general.enable_floating_ball == visible {
            false
        } else {
            config.general.enable_floating_ball = visible;
            true
        }
    })?;
    Ok(())
}

#[tauri::command]
fn init_floating_ball(app: AppHandle, state: State<AppState>) -> Result<window_manager::FloatingBallPosition, String> {
    if let Some(window) = app.get_webview_window("floating_ball") {
        let config = state.config.snapshot();
        let pos = config.general.floating_ball_pos;
        if !config.general.enable_floating_ball {
            let _ = window.hide();
            return Ok((pos.0, pos.1, "top-right".to_string(), "none".to_string()));
        }
        let res = window_manager::init_floating_ball(&window, pos);
        Ok(res)
    } else {
        Err("Floating ball window not found".to_string())
    }
}

#[tauri::command]
fn snap_floating_ball(
    app: AppHandle,
    state: State<AppState>,
    x: i32,
    y: i32,
) -> Result<window_manager::FloatingBallPosition, String> {
    if let Some(window) = app.get_webview_window("floating_ball") {
        if !state.config.snapshot().general.enable_floating_ball {
            let _ = window.hide();
            return Ok((x, y, "top-right".to_string(), "none".to_string()));
        }
        let (logical_x, logical_y, corner, edge) = window_manager::snap_floating_ball(&window, x, y);
        // 位置记忆失败不影响本次吸附交互。
        let _ = state.config.commit(|config| {
            if config.general.floating_ball_pos == (logical_x, logical_y) {
                false
            } else {
                config.general.floating_ball_pos = (logical_x, logical_y);
                true
            }
        });
        Ok((logical_x, logical_y, corner, edge))
    } else {
        Err("Floating ball window not found".to_string())
    }
}

#[tauri::command]
async fn start_floating_ball_dragging(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<window_manager::FloatingBallPosition, String> {
    let window = app
        .get_webview_window("floating_ball")
        .ok_or_else(|| "Floating ball window not found".to_string())?;

    if !state.config.snapshot().general.enable_floating_ball {
        let _ = window.hide();
        return Ok((0, 0, "top-right".to_string(), "none".to_string()));
    }

    let (drag_x, drag_y) = tauri::async_runtime::spawn_blocking(move || {
        window_manager::run_floating_ball_drag_loop(&window)
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Some(win) = app.get_webview_window("floating_ball") {
        let (logical_x, logical_y, corner, edge) = window_manager::snap_floating_ball(&win, drag_x, drag_y);
        // 位置记忆失败不影响本次拖动结果。
        let _ = state.config.commit(|config| {
            if config.general.floating_ball_pos == (logical_x, logical_y) {
                false
            } else {
                config.general.floating_ball_pos = (logical_x, logical_y);
                true
            }
        });
        Ok((logical_x, logical_y, corner, edge))
    } else {
        Err("Floating ball window not found".to_string())
    }
}

#[tauri::command]
fn toggle_floating_ball(state: State<AppState>, visible: bool) -> Result<(), String> {
    set_floating_ball_visible(&state.config, visible)
}

#[tauri::command]
async fn get_current_selection() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(selection::extract_selected_text_safely)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_floating_ball_expanded(
    app: AppHandle,
    state: State<AppState>,
    expanded: bool,
) -> Result<(i32, i32, String), String> {
    if let Some(window) = app.get_webview_window("floating_ball") {
        if !state.config.snapshot().general.enable_floating_ball {
            let _ = window.hide();
            return Ok((0, 0, "right".to_string()));
        }
        window_manager::set_floating_ball_expanded(&window, expanded)
    } else {
        Err("Floating ball window not found".to_string())
    }
}

#[tauri::command]
fn focus_floating_ball_input(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("floating_ball")
        .ok_or_else(|| "Floating ball window not found".to_string())?;
    if !window_manager::floating_menu_is_expanded() {
        return Err("Floating menu is closed".to_string());
    }
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    window_manager::remove_no_activate_style(hwnd.0 as _);
    window.set_focus().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let handle = app.handle().clone();
            let config = config::ConfigStore::load(Box::new(TauriConfigPublisher {
                app: handle.clone(),
            }));
            let initial_config = config.snapshot();
            app.manage(AppState {
                config,
                ai_manager: AiManager::new(),
                web_hub_state: Mutex::new(ai::WebHubState::default()),
                web_injections: Mutex::new(std::collections::HashMap::new()),
                web_chrome: web_chrome::WebChromeState::new(initial_config.general.web_headless_mode),
            });

            // 首帧前应用持久化的界面样式，避免窗口显示后再切换装饰
            window_manager::apply_ui_style(
                &handle,
                &initial_config.general.ui_style,
                &initial_config.general.theme,
            );
            if let Some(main_win) = app.get_webview_window("main") {
                let icon = tauri::include_image!("icons/icon.png");
                let _ = main_win.set_icon(icon);
            }

            // 初始化桌面常驻悬浮球
            if initial_config.general.enable_floating_ball {
                if let Some(fb_win) = app.get_webview_window("floating_ball") {
                    let pos = initial_config.general.floating_ball_pos;
                    window_manager::init_floating_ball(&fb_win, pos);
                }
            }

            // 启动全局鼠标划词钩子
            selection::start_mouse_hook(handle);
            // 初始化常驻系统托盘
            tray::setup_tray(app)?;
            Ok(())
        })
        // With `unstable`, the overlay is a child webview: native drops are
        // WebviewEvents rather than synthesized WindowEvents.
        .on_webview_event(|webview, event| {
            if webview.label() == "overlay" {
                if let tauri::WebviewEvent::DragDrop(event) = event {
                    file_selection::handle_drag_drop(&webview.window(), event);
                }
            }
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_settings_devtools,
            get_config,
            save_config,
            set_ui_style,
            save_api_card_size,
            trigger_api_action,
            trigger_web_action,
            trigger_web_file_action,
            cancel_action,
            layout_overlay,
            toggle_maximize_overlay,
            hide_overlay,
            show_main_window,
            hide_main_window,
            minimize_main_window,
            toggle_maximize_main_window,
            close_web_window,
            minimize_web_window,
            toggle_maximize_web_window,
            reload_web_webview,
            web_chrome::get_web_chrome,
            web_chrome::layout_web_menu,
            web_chrome::open_web_page_in_browser,
            open_in_browser,
            set_pin_state,
            start_overlay_dragging,
            get_web_hub_state,
            switch_web_hub_tab,
            close_web_hub_tab,
            reload_web_hub_active_tab,
            get_site_presets,
            link_metadata::fetch_link_metadata,
            start_window_picker,
            cancel_window_picker,
            fetch_provider_models,
            fetch_provider_balance,
            init_floating_ball,
            snap_floating_ball,
            start_floating_ball_dragging,
            toggle_floating_ball,
            get_current_selection,
            set_floating_ball_expanded,
            focus_floating_ball_input,
            chat_store::list_chat_sessions,
            web_sessions::list_web_sessions,
            web_history_sync::sync_web_sessions,
            web_sessions::open_web_session,
            chat_store::get_all_full_chat_sessions,
            chat_store::get_chat_session,
            chat_store::save_chat_session,
            chat_store::delete_chat_session,
            chat_store::clear_all_chat_sessions,
            chat_store::open_sessions_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


#[cfg(test)]
mod api_request_config_tests {
    use super::resolve_api_request_config;
    use crate::config::{AppConfig, ProviderConfig};

    fn fixture() -> AppConfig {
        let mut config = AppConfig::default_for_language("en");
        config.providers = vec![
            provider("original", true),
            provider("selected", true),
            provider("disabled", false),
        ];
        config.actions[0].provider_id = Some("original".into());
        config.actions[0].prompt_template = Some("Explain {text}".into());
        config
    }

    fn provider(id: &str, enabled: bool) -> ProviderConfig {
        ProviderConfig {
            id: id.into(),
            name: id.into(),
            base_url: format!("https://{id}.example/v1"),
            api_key: format!("test-only-{id}-key"),
            models: vec![format!("{id}-model")],
            default_model: format!("{id}-model"),
            enabled,
        }
    }

    fn resolve(
        config: &AppConfig,
        provider: Option<&str>,
        model: Option<&str>,
    ) -> Result<(ProviderConfig, String, String), String> {
        resolve_api_request_config(
            config, &config.actions[0].id, provider, model.map(str::to_string), None,
        )
    }

    #[test]
    fn provider_override_selects_actual_transport_without_changing_global_config() {
        let config = fixture();
        let before = serde_json::to_value(&config).unwrap();
        let (provider, model, prompt) = resolve(&config, Some("selected"), None).unwrap();
        assert_eq!(provider.id, "selected");
        assert_eq!(provider.base_url, "https://selected.example/v1");
        assert!(provider.api_key == "test-only-selected-key");
        assert_eq!(model, "selected-model");
        assert_eq!(prompt, "Explain {text}");
        assert!(serde_json::to_value(&config).unwrap() == before);
    }

    #[test]
    fn unknown_provider_override_does_not_fall_back_to_the_action_provider() {
        let config = fixture();
        let result = resolve(&config, Some("missing"), None);
        assert!(matches!(result, Err(error) if error.contains("not found")));
    }

    #[test]
    fn disabled_provider_still_executes_because_it_only_filters_selectors() {
        let config = fixture();

        let (provider, model, _) = resolve(&config, Some("disabled"), None).unwrap();
        assert_eq!(provider.id, "disabled");
        assert_eq!(model, "disabled-model");

        let mut bound = config.clone();
        bound.actions[0].provider_id = Some("disabled".into());
        let (provider, model, _) = resolve(&bound, None, None).unwrap();
        assert_eq!(provider.id, "disabled");
        assert_eq!(model, "disabled-model");
    }

    #[test]
    fn action_without_provider_is_rejected() {
        let mut config = fixture();
        config.actions[0].provider_id = None;
        assert!(resolve(&config, None, None).is_err());
    }

    #[test]
    fn model_falls_back_to_the_first_listed_model_and_never_stays_empty() {
        let mut config = fixture();
        config.providers[0].default_model.clear();

        assert_eq!(resolve(&config, None, None).unwrap().1, "original-model");
        assert_eq!(resolve(&config, None, Some("")).unwrap().1, "original-model");
        assert_eq!(resolve(&config, None, Some("picked-model")).unwrap().1, "picked-model");

        config.providers[0].models.clear();
        let error = resolve(&config, None, None).unwrap_err();
        assert!(error.contains("未配置可用模型"), "{error}");
    }

    #[test]
    fn explicit_prompt_override_is_preserved_including_empty_value() {
        let config = fixture();
        for prompt in ["Custom {text}", ""] {
            let (provider, model, actual) = resolve_api_request_config(
                &config, &config.actions[0].id, Some("selected"),
                Some("custom-model".into()), Some(prompt.into()),
            ).unwrap();
            assert_eq!(provider.id, "selected");
            assert_eq!(model, "custom-model");
            assert_eq!(actual, prompt);
        }
    }
}
