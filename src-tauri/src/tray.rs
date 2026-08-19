use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App,
};

/// 初始化与注册系统通知区域常驻托盘图标及交互菜单
pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    // 1. 创建右键托盘菜单项
    let open_settings_i = MenuItem::with_id(handle, "open_settings", "打开设置", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(handle)?;
    let quit_i = MenuItem::with_id(handle, "quit", "退出 IOX", true, None::<&str>)?;

    let menu = Menu::with_items(handle, &[&open_settings_i, &separator, &quit_i])?;

    // 2. 载入托盘图标（优先读取主窗口图标，若缺失则使用编译期内置图标）
    let icon = app
        .default_window_icon()
        .cloned()
        .unwrap_or_else(|| tauri::include_image!("icons/icon.png").to_owned());

    // 3. 构建并注册托盘图标
    let _tray = TrayIconBuilder::with_id("iox-tray")
        .icon(icon)
        .tooltip("IOX 划词助手")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
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
