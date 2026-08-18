use super::template::render_url_template;
use arboard::Clipboard;

/// 执行 Web 网页直达或系统浏览器调起动作
pub fn execute_web_action(
    url_template: &str,
    text: &str,
    copy_to_clipboard: bool,
) -> Result<(), String> {
    if copy_to_clipboard {
        if let Ok(mut clipboard) = Clipboard::new() {
            let _ = clipboard.set_text(text);
        }
    }

    if !url_template.trim().is_empty() {
        let url = render_url_template(url_template, text);
        open::that(&url).map_err(|e| format!("Failed to open browser URL: {}", e))?;
    }
    Ok(())
}
