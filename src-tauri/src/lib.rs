pub mod ai;
pub mod chat_store;
pub mod config;
pub mod overlay_state;
pub mod picker;
pub mod selection;
pub mod site_presets;
pub mod tray;
pub mod window_manager;

use ai::AiManager;
use config::AppConfig;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub ai_manager: AiManager,
    pub web_hub_state: Mutex<ai::WebHubState>,
}

#[tauri::command]
fn get_config(state: State<AppState>) -> AppConfig {
    let config = state.config.lock().unwrap();
    config.clone()
}

#[tauri::command]
fn save_config(app: AppHandle, new_config: AppConfig, state: State<AppState>) -> Result<(), String> {
    new_config.save()?;
    {
        let mut config = state.config.lock().unwrap();
        *config = new_config.clone();
    }
    let _ = app.emit("config_updated", &new_config);

    // 即时同步常驻悬浮球窗口的显示/隐藏
    if let Some(window) = app.get_webview_window("floating_ball") {
        if new_config.general.enable_floating_ball {
            let pos = new_config.general.floating_ball_pos;
            window_manager::init_floating_ball(&window, pos);
        } else {
            let _ = window.hide();
        }
    }
    Ok(())
}

#[tauri::command]
async fn trigger_web_action(
    app: AppHandle,
    state: State<'_, AppState>,
    action_id: String,
    text: String,
    copy_to_clipboard: Option<bool>,
) -> Result<(), String> {
    let config = state.config.lock().unwrap().clone();
    let action = config
        .actions
        .iter()
        .find(|a| a.id == action_id)
        .cloned()
        .ok_or_else(|| format!("Action '{}' not found", action_id))?;

    ai::execute_web_action(&app, &config, &action, &text, copy_to_clipboard)
}

#[tauri::command]
fn trigger_api_action(
    app: AppHandle,
    state: State<AppState>,
    action_id: String,
    text: String,
    model_override: Option<String>,
    prompt_override: Option<String>,
    thinking_enabled: Option<bool>,
) -> Result<(), String> {
    let (provider, model, prompt_template) = {
        let config = state.config.lock().unwrap();
        let action = config
            .actions
            .iter()
            .find(|a| a.id == action_id)
            .ok_or_else(|| format!("Action '{}' not found", action_id))?;

        let provider_id = action
            .provider_id
            .as_ref()
            .ok_or_else(|| "Action has no assigned provider".to_string())?;

        let provider = config
            .providers
            .iter()
            .find(|p| p.id == *provider_id)
            .cloned()
            .ok_or_else(|| format!("Provider '{}' not found", provider_id))?;

        let model = model_override
            .or_else(|| Some(provider.default_model.clone()))
            .unwrap_or_else(|| "default".to_string());

        let template = prompt_override
            .or_else(|| action.prompt_template.clone())
            .unwrap_or_else(|| "{text}".to_string());

        (provider, model, template)
    };

    let user_prompt = ai::render_prompt_template(&prompt_template, &text);
    let ai_manager = state.ai_manager.clone();

    tauri::async_runtime::spawn(async move {
        ai::execute_stream_request(
            app,
            ai_manager,
            action_id,
            provider,
            model,
            None,
            user_prompt,
            thinking_enabled.unwrap_or(false),
        )
        .await;
    });

    Ok(())
}

#[tauri::command]
fn cancel_action(state: State<AppState>, action_id: String) {
    let ai_manager = state.ai_manager.clone();
    tauri::async_runtime::spawn(async move {
        ai_manager.cancel(&action_id).await;
    });
}

#[tauri::command]
fn resize_overlay(
    app: AppHandle,
    width: i32,
    height: i32,
    allow_focus: Option<bool>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window_manager::resize_overlay_window(&window, width, height, allow_focus.unwrap_or(false));
        Ok(())
    } else {
        Err("Overlay window not found".to_string())
    }
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
fn hide_overlay(app: AppHandle) -> Result<(), String> {
    overlay_state::set_overlay_bubble_mode(true);
    // 刻意不复位 Pin 状态：钉住是跨会话的用户偏好（由前端 localStorage 记忆），
    // 主动关闭仅结束当前窗口会话；隐藏后的残留 pin 不会拦截后续划词
    // （selection.rs 已用「钉住 && 可见 && 卡片态」组合条件防死锁）
    if let Some(window) = app.get_webview_window("overlay") {
        window_manager::hide_overlay_window(&window);
        Ok(())
    } else {
        Err("Overlay window not found".to_string())
    }
}

#[tauri::command]
fn set_pin_state(pinned: bool) {
    overlay_state::set_overlay_pinned(pinned);
}

#[tauri::command]
fn set_drag_state(dragging: bool) {
    overlay_state::set_dragging_overlay(dragging);
}

#[tauri::command]
fn set_overlay_mode(mode: String) {
    overlay_state::set_overlay_bubble_mode(mode == "bubble");
}

#[tauri::command]
fn save_api_card_size(
    app: AppHandle,
    state: State<AppState>,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if width >= 320.0 && height >= 200.0 {
        let mut config = state.config.lock().unwrap();
        config.general.api_card_size = (width.round(), height.round());
        config.api_card.card_size = (width.round(), height.round());
        let _ = config.save();
        let _ = app.emit("config_updated", &*config);
    }
    Ok(())
}

#[tauri::command]
fn start_overlay_dragging(app: AppHandle) {
    tauri::async_runtime::spawn_blocking(move || {
        window_manager::run_overlay_drag_loop(&app);
    });
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
                    if let Ok(mut config) = state.config.lock() {
                        config.general.web_window_size = (w, h);
                        let _ = config.save();
                    }
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
            let _ = window.unminimize();
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
fn init_floating_ball(app: AppHandle, state: State<AppState>) -> Result<(i32, i32, String), String> {
    if let Some(window) = app.get_webview_window("floating_ball") {
        let (pos, enabled) = {
            let config = state.config.lock().unwrap();
            (config.general.floating_ball_pos, config.general.enable_floating_ball)
        };
        if !enabled {
            let _ = window.hide();
            return Ok((pos.0, pos.1, "right".to_string()));
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
) -> Result<(i32, i32, String), String> {
    if let Some(window) = app.get_webview_window("floating_ball") {
        let enabled = {
            let config = state.config.lock().unwrap();
            config.general.enable_floating_ball
        };
        if !enabled {
            let _ = window.hide();
            return Ok((x, y, "right".to_string()));
        }
        let (logical_x, logical_y, edge) = window_manager::snap_floating_ball(&window, x, y, 60);
        if let Ok(mut config) = state.config.lock() {
            config.general.floating_ball_pos = (logical_x, logical_y);
            let _ = config.save();
        }
        Ok((logical_x, logical_y, edge))
    } else {
        Err("Floating ball window not found".to_string())
    }
}

#[tauri::command]
async fn start_floating_ball_dragging(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(i32, i32, String), String> {
    let window = app
        .get_webview_window("floating_ball")
        .ok_or_else(|| "Floating ball window not found".to_string())?;

    let enabled = {
        let config = state.config.lock().unwrap();
        config.general.enable_floating_ball
    };
    if !enabled {
        let _ = window.hide();
        return Ok((0, 0, "right".to_string()));
    }

    let (drag_x, drag_y) = tauri::async_runtime::spawn_blocking(move || {
        window_manager::run_floating_ball_drag_loop(&window)
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Some(win) = app.get_webview_window("floating_ball") {
        let (logical_x, logical_y, edge) = window_manager::snap_floating_ball(&win, drag_x, drag_y, 60);
        if let Ok(mut config) = state.config.lock() {
            config.general.floating_ball_pos = (logical_x, logical_y);
            let _ = config.save();
        }
        Ok((logical_x, logical_y, edge))
    } else {
        Err("Floating ball window not found".to_string())
    }
}

#[tauri::command]
fn toggle_floating_ball(app: AppHandle, state: State<AppState>, visible: bool) -> Result<(), String> {
    let updated_config = {
        let mut config = state.config.lock().unwrap();
        config.general.enable_floating_ball = visible;
        let _ = config.save();
        config.clone()
    };
    let _ = app.emit("config_updated", &updated_config);

    if let Some(window) = app.get_webview_window("floating_ball") {
        if visible {
            let pos = updated_config.general.floating_ball_pos;
            window_manager::init_floating_ball(&window, pos);
        } else {
            let _ = window.hide();
        }
    }
    Ok(())
}

#[tauri::command]
fn get_current_selection() -> Result<Option<String>, String> {
    let text = selection::extract_selected_text_safely();
    Ok(text)
}

#[tauri::command]
fn set_floating_ball_expanded(
    app: AppHandle,
    state: State<AppState>,
    expanded: bool,
    width: i32,
    height: i32,
) -> Result<(i32, i32, String), String> {
    if let Some(window) = app.get_webview_window("floating_ball") {
        let enabled = {
            let config = state.config.lock().unwrap();
            config.general.enable_floating_ball
        };
        if !enabled {
            let _ = window.hide();
            return Ok((0, 0, "right".to_string()));
        }
        let res = window_manager::set_floating_ball_expanded(&window, expanded, width, height);
        Ok(res)
    } else {
        Err("Floating ball window not found".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = AppConfig::load();
    let app_state = AppState {
        config: Mutex::new(initial_config.clone()),
        ai_manager: AiManager::new(),
        web_hub_state: Mutex::new(ai::WebHubState::default()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .setup(move |app| {
            let handle = app.handle().clone();
            if let Some(main_win) = app.get_webview_window("main") {
                if let Ok(hwnd) = main_win.hwnd() {
                    window_manager::apply_main_window_native_style(hwnd.0 as _);
                }
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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            save_api_card_size,
            trigger_api_action,
            trigger_web_action,
            cancel_action,
            resize_overlay,
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
            open_in_browser,
            set_pin_state,
            set_drag_state,
            set_overlay_mode,
            start_overlay_dragging,
            get_web_hub_state,
            switch_web_hub_tab,
            close_web_hub_tab,
            reload_web_hub_active_tab,
            get_site_presets,
            start_window_picker,
            cancel_window_picker,
            fetch_provider_models,
            init_floating_ball,
            snap_floating_ball,
            start_floating_ball_dragging,
            toggle_floating_ball,
            get_current_selection,
            set_floating_ball_expanded,
            chat_store::list_chat_sessions,
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

