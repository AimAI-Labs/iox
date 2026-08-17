pub mod ai_service;
pub mod config;
pub mod selection;
pub mod window_manager;

use ai_service::AiManager;
use config::AppConfig;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub ai_manager: AiManager,
}

#[tauri::command]
fn get_config(state: State<AppState>) -> AppConfig {
    let config = state.config.lock().unwrap();
    config.clone()
}

#[tauri::command]
fn save_config(new_config: AppConfig, state: State<AppState>) -> Result<(), String> {
    new_config.save()?;
    let mut config = state.config.lock().unwrap();
    *config = new_config;
    Ok(())
}

#[tauri::command]
fn trigger_web_action(
    url_template: String,
    text: String,
    copy_to_clipboard: Option<bool>,
) -> Result<(), String> {
    ai_service::execute_web_action(&url_template, &text, copy_to_clipboard.unwrap_or(false))
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

    let user_prompt = ai_service::render_prompt_template(&prompt_template, &text);
    let ai_manager = state.ai_manager.clone();

    tokio::spawn(async move {
        ai_service::execute_stream_request(
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
    tokio::spawn(async move {
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
fn hide_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window_manager::hide_overlay_window(&window);
        Ok(())
    } else {
        Err("Overlay window not found".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = AppConfig::load();
    let app_state = AppState {
        config: Mutex::new(initial_config),
        ai_manager: AiManager::new(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .setup(|app| {
            let handle = app.handle().clone();
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
            hide_overlay
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
