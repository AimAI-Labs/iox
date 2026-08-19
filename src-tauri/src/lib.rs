pub mod ai;
pub mod config;
pub mod overlay_state;
pub mod selection;
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
    let mut config = state.config.lock().unwrap();
    *config = new_config.clone();
    let _ = app.emit("config_updated", &new_config);
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
fn show_main_window(app: AppHandle, target_tab: Option<String>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(hwnd) = window.hwnd() {
            window_manager::apply_main_window_native_style(hwnd.0 as _);
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = AppConfig::load();
    let app_state = AppState {
        config: Mutex::new(initial_config),
        ai_manager: AiManager::new(),
        web_hub_state: Mutex::new(ai::WebHubState::default()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(main_win) = app.get_webview_window("main") {
                if let Ok(hwnd) = main_win.hwnd() {
                    window_manager::apply_main_window_native_style(hwnd.0 as _);
                }
                let icon = tauri::include_image!("icons/icon.png");
                let _ = main_win.set_icon(icon);
            }
            // 启动全局鼠标划词钩子
            selection::start_mouse_hook(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            trigger_api_action,
            trigger_web_action,
            cancel_action,
            resize_overlay,
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
            reload_web_hub_active_tab
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

