use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Listener, Manager,
};
use crate::AppState;

struct TrayTexts {
    toggle_ball_hide: &'static str,
    toggle_ball_show: &'static str,
    open_settings: &'static str,
    quit: &'static str,
    tooltip: &'static str,
}

fn get_tray_texts(lang: &str) -> TrayTexts {
    if lang == "zh" {
        TrayTexts {
            toggle_ball_hide: "⚪ 隐藏常驻悬浮球",
            toggle_ball_show: "🟢 显示常驻悬浮球",
            open_settings: "打开设置",
            quit: "退出 IOX",
            tooltip: "IOX 划词助手",
        }
    } else {
        TrayTexts {
            toggle_ball_hide: "⚪ Hide Floating Ball",
            toggle_ball_show: "🟢 Show Floating Ball",
            open_settings: "Settings",
            quit: "Quit IOX",
            tooltip: "IOX AI Assistant",
        }
    }
}

/// 初始化与注册系统通知区域常驻托盘图标及交互菜单
pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    let state = handle.state::<AppState>();
    let (enable_floating_ball, current_lang) = {
        let config = state.config.lock().unwrap();
        let lang = crate::config::resolve_language(&config.general.language);
        (config.general.enable_floating_ball, lang)
    };

    let texts = get_tray_texts(current_lang);
    let ball_text = if enable_floating_ball {
        texts.toggle_ball_hide
    } else {
        texts.toggle_ball_show
    };

    // 1. 创建右键托盘菜单项
    let toggle_ball_i = MenuItem::with_id(handle, "toggle_ball", ball_text, true, None::<&str>)?;
    let open_settings_i = MenuItem::with_id(handle, "open_settings", texts.open_settings, true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(handle)?;
    let quit_i = MenuItem::with_id(handle, "quit", texts.quit, true, None::<&str>)?;

    let menu = Menu::with_items(handle, &[&toggle_ball_i, &open_settings_i, &separator, &quit_i])?;

    // 2. 载入托盘图标（优先读取主窗口图标，若缺失则使用编译期内置图标）
    let icon = app
        .default_window_icon()
        .cloned()
        .unwrap_or_else(|| tauri::include_image!("icons/icon.png").to_owned());

    let toggle_item_handle = toggle_ball_i.clone();

    // 3. 构建并注册托盘图标
    let tray = TrayIconBuilder::with_id("iox-tray")
        .icon(icon)
        .tooltip(texts.tooltip)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "toggle_ball" => {
                let state = app.state::<AppState>();
                let (new_visible, lang) = {
                    let mut config = state.config.lock().unwrap();
                    let current = config.general.enable_floating_ball;
                    config.general.enable_floating_ball = !current;
                    let _ = config.save();
                    let lang = crate::config::resolve_language(&config.general.language);
                    (!current, lang)
                };
                let _ = crate::toggle_floating_ball(app.clone(), state, new_visible);
                let texts = get_tray_texts(lang);
                let new_text = if new_visible {
                    texts.toggle_ball_hide
                } else {
                    texts.toggle_ball_show
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

    // 监听设置更新事件，同步更新托盘菜单文字与语言
    let toggle_item_for_event = toggle_ball_i.clone();
    let settings_item_for_event = open_settings_i.clone();
    let quit_item_for_event = quit_i.clone();
    let tray_handle_for_event = tray.clone();
    handle.listen("config_updated", move |event| {
        if let Ok(config) = serde_json::from_str::<crate::config::AppConfig>(event.payload()) {
            let lang = crate::config::resolve_language(&config.general.language);
            let texts = get_tray_texts(lang);
            let new_text = if config.general.enable_floating_ball {
                texts.toggle_ball_hide
            } else {
                texts.toggle_ball_show
            };
            let _ = toggle_item_for_event.set_text(new_text);
            let _ = settings_item_for_event.set_text(texts.open_settings);
            let _ = quit_item_for_event.set_text(texts.quit);
            let _ = tray_handle_for_event.set_tooltip(Some(texts.tooltip));
        }
    });

    Ok(())
}
