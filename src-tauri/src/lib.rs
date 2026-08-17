pub mod config;

use config::AppConfig;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub config: Mutex<AppConfig>,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = AppConfig::load();
    let app_state = AppState {
        config: Mutex::new(initial_config),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![get_config, save_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

