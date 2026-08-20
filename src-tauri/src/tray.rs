use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Listener, Manager,
};
use crate::AppState;

/// 初始化与注册系统通知区域常驻托盘图标及交互菜单
pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    let state = handle.state::<AppState>();
    let enable_floating_ball = {
        let config = state.config.lock().unwrap();
        config.general.enable_floating_ball
    };

    let ball_text = if enable_floating_ball {
        "⚪ 隐藏常驻悬浮球"
    } else {
        "🟢 显示常驻悬浮球"
    };

    // 1. 创建右键托盘菜单项
    let toggle_ball_i = MenuItem::with_id(handle, "toggle_ball", ball_text, true, None::<&str>)?;
    let open_settings_i = MenuItem::with_id(handle, "open_settings", "打开设置", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(handle)?;
    let quit_i = MenuItem::with_id(handle, "quit", "退出 IOX", true, None::<&str>)?;

    let menu = Menu::with_items(handle, &[&toggle_ball_i, &open_settings_i, &separator, &quit_i])?;

    // 监听设置更新事件，同步更新托盘菜单文字
    let toggle_item_for_event = toggle_ball_i.clone();
    handle.listen("config_updated", move |event| {
        if let Ok(config) = serde_json::from_str::<crate::config::AppConfig>(event.payload()) {
            let new_text = if config.general.enable_floating_ball {
                "⚪ 隐藏常驻悬浮球"
            } else {
                "🟢 显示常驻悬浮球"
            };
            let _ = toggle_item_for_event.set_text(new_text);
        }
    });

    // 2. 载入托盘图标（优先读取主窗口图标，若缺失则使用编译期内置图标）
    let icon = app
        .default_window_icon()
        .cloned()
        .unwrap_or_else(|| tauri::include_image!("icons/icon.png").to_owned());

    let toggle_item_handle = toggle_ball_i.clone();

    // 3. 构建并注册托盘图标
    let _tray = TrayIconBuilder::with_id("iox-tray")
        .icon(icon)
        .tooltip("IOX 划词助手")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "toggle_ball" => {
                let state = app.state::<AppState>();
                let (new_visible, _) = {
                    let mut config = state.config.lock().unwrap();
                    let current = config.general.enable_floating_ball;
                    config.general.enable_floating_ball = !current;
                    let _ = config.save();
                    (!current, config.clone())
                };
                let _ = crate::toggle_floating_ball(app.clone(), state, new_visible);
                let new_text = if new_visible {
                    "⚪ 隐藏常驻悬浮球"
                } else {
                    "🟢 显示常驻悬浮球"
                };
                let _ = toggle_item_handle.set_text(new_text);
            }
            "open_settings" => {
                let _ = crate::show_main_window(app.clone(), None);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = crate::show_main_window(app.clone(), None);
            }
        })
        .build(app)?;

    Ok(())
}
