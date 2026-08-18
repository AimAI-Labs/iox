use super::template::render_url_template;
use crate::config::{ActionConfig, AppConfig};
use arboard::Clipboard;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// 执行 Web 动作：根据配置以独立原生 Webview 浮窗打开目标网址（彻底摆脱 iframe）
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
    let target_url = target_url_str
        .parse()
        .map_err(|e| format!("Invalid target URL '{}': {}", target_url_str, e))?;

    // 3. 根据浮窗模式调度原生窗口
    let mode = config.general.web_window_mode.as_str();

    if mode == "tabbed" {
        // 统一多标签 Hub 模式 (单实例 web_hub)
        let label = "web_hub";
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.navigate(target_url);
            let _ = window.set_title(&action.name);
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        } else {
            let win = WebviewWindowBuilder::new(app, label, WebviewUrl::External(target_url))
                .title(&action.name)
                .inner_size(840.0, 620.0)
                .resizable(true)
                .decorations(true)
                .always_on_top(false)
                .build()
                .map_err(|e| format!("Failed to create web hub window: {}", e))?;
            let _ = win.show();
            let _ = win.set_focus();
        }
    } else {
        // 独立多窗口模式 (multi_window - 默认)
        // 过滤 label 保证符合 Tauri window label 规范 (仅保留字母数字_-)
        let sanitized_id: String = action
            .id
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
            .collect();
        let label = format!("web_win_{}", sanitized_id);

        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.navigate(target_url);
            let _ = window.set_title(&action.name);
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        } else {
            let win = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(target_url))
                .title(&action.name)
                .inner_size(780.0, 600.0)
                .resizable(true)
                .decorations(true)
                .always_on_top(false)
                .build()
                .map_err(|e| format!("Failed to create web window for '{}': {}", action.name, e))?;
            let _ = win.show();
            let _ = win.set_focus();
        }
    }

    Ok(())
}

