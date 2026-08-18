use super::template::render_url_template;
use crate::config::{ActionConfig, AppConfig};
use arboard::Clipboard;
use tauri::webview::WebviewBuilder;
use tauri::window::WindowBuilder;
use tauri::{AppHandle, Manager, WebviewUrl};

/// 执行 Web 动作：以支持 macOS 红黄绿圆点标题栏与透明圆角的高级原生 Multi-Webview 浮窗打开目标 AI 官网
pub fn execute_web_action(
    app: &AppHandle,
    config: &AppConfig,
    action: &ActionConfig,
    text: &str,
    copy_override: Option<bool>,
) -> Result<(), String> {
    // 1. 安全复制划选文本到剪贴板
    let should_copy = copy_override.unwrap_or(false) || config.general.auto_copy_on_web_action;
    if should_copy && !text.trim().is_empty() {
        if let Ok(mut clipboard) = Clipboard::new() {
            let _ = clipboard.set_text(text);
        }
    }

    // 2. 提取并渲染 URL 模板
    let template = action
        .url_template
        .as_deref()
        .unwrap_or("")
        .trim();
    if template.is_empty() {
        return Err(format!("Web action '{}' has no configured URL template", action.name));
    }
    let target_url_str = render_url_template(template, text);
    let target_url: tauri::Url = target_url_str
        .parse()
        .map_err(|e| format!("Invalid target URL '{}': {}", target_url_str, e))?;

    // 3. 确定窗口与 Webview Label
    let mode = config.general.web_window_mode.as_str();
    let label = if mode == "tabbed" {
        "web_hub".to_string()
    } else {
        let sanitized_id: String = action
            .id
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
            .collect();
        format!("web_win_{}", sanitized_id)
    };

    let content_label = format!("{}_web", label);
    let bar_label = format!("{}_bar", label);

    // 4. 复用已存在的窗口
    if let Some(window) = app.get_window(&label) {
        if let Some(content_wv) = app.get_webview(&content_label) {
            let _ = content_wv.navigate(target_url);
        }
        let _ = window.set_title(&action.name);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    // 5. 创建无边框、支持通透圆角与 macOS 沉浸式标题栏的 Native 窗口
    let initial_width = 860.0;
    let initial_height = 640.0;
    let titlebar_height = 38.0;

    let window = WindowBuilder::new(app, &label)
        .title(&action.name)
        .inner_size(initial_width, initial_height)
        .resizable(true)
        .decorations(false) // 无系统粗糙边框
        .transparent(true) // 通透圆角
        .shadow(false) // 无脏阴影
        .build()
        .map_err(|e| format!("Failed to create web window: {}", e))?;

    // 注入与设置窗口完全一致的 Windows DWM 硬件级抗锯齿圆角与亚克力材质
    if let Ok(hwnd) = window.hwnd() {
        crate::window_manager::apply_main_window_native_style(hwnd.0 as _);
    }

    // 构建顶部 MacTitleBar Webview
    let title_param = urlencoding::encode(&action.name);
    let url_param = urlencoding::encode(&target_url_str);
    let bar_path = format!(
        "index.html?view=web_titlebar&label={}&title={}&url={}",
        label, title_param, url_param
    );

    let bar_builder = WebviewBuilder::new(&bar_label, WebviewUrl::App(bar_path.into()))
        .transparent(true);

    let titlebar_wv = window
        .add_child(
            bar_builder,
            tauri::LogicalPosition::new(0.0, 0.0),
            tauri::LogicalSize::new(initial_width, titlebar_height),
        )
        .map_err(|e| format!("Failed to create titlebar webview: {}", e))?;

    // 构建外部 AI 官网内容 Webview
    let content_builder = WebviewBuilder::new(&content_label, WebviewUrl::External(target_url))
        .transparent(true);

    let content_wv = window
        .add_child(
            content_builder,
            tauri::LogicalPosition::new(0.0, titlebar_height),
            tauri::LogicalSize::new(initial_width, initial_height - titlebar_height),
        )
        .map_err(|e| format!("Failed to create content webview: {}", e))?;

    // 在窗口创建完成后对 content webview 应用底部圆角裁切
    let scale = window.scale_factor().unwrap_or(1.0);
    if let Ok(hwnd) = window.hwnd() {
        let radius = (12.0 * scale).round() as i32;
        crate::window_manager::apply_content_webview_bottom_round(hwnd.0 as _, radius);
    }

    // 监听窗口尺寸变化，动态平滑适配 Webview 尺寸与圆角 Region
    let titlebar_clone = titlebar_wv.clone();
    let content_clone = content_wv.clone();
    let window_clone = window.clone();

    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Resized(physical_size) = event {
            let scale = window_clone.scale_factor().unwrap_or(1.0);
            let bar_physical_h = (38.0 * scale).round() as u32;
            let content_physical_h = physical_size.height.saturating_sub(bar_physical_h);

            let is_maximized = window_clone.is_maximized().unwrap_or(false);
            if let Ok(hwnd) = window_clone.hwnd() {
                let hwnd_raw = hwnd.0 as _;
                if is_maximized {
                    crate::window_manager::remove_content_webview_round(hwnd_raw);
                } else {
                    let r = (12.0 * scale).round() as i32;
                    crate::window_manager::apply_content_webview_bottom_round(hwnd_raw, r);
                }
            }

            let _ = titlebar_clone.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                physical_size.width,
                bar_physical_h,
            )));
            let _ = content_clone.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                physical_size.width,
                content_physical_h,
            )));
            let _ = content_clone.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                0,
                bar_physical_h as i32,
            )));
        }
    });

    let _ = window.show();
    let _ = window.set_focus();

    Ok(())
}
