use super::template::render_url_template;
use crate::config::{ActionConfig, AppConfig};
use arboard::Clipboard;
use tauri::webview::WebviewBuilder;
use tauri::window::WindowBuilder;
use tauri::{AppHandle, Manager, WebviewUrl};

/// 构造针对现代 SPA AI 官网（如 DeepSeek、Kimi 等）的通用 DOM 注入与受控组件同步脚本
pub fn build_injection_script(
    text: &str,
    input_selector: &str,
    submit_selector: Option<&str>,
    auto_submit: bool,
) -> String {
    let text_json = serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_string());
    let input_sel_json =
        serde_json::to_string(input_selector).unwrap_or_else(|_| "\"\"".to_string());
    let submit_sel_json = match submit_selector {
        Some(sel) if !sel.trim().is_empty() => {
            serde_json::to_string(sel).unwrap_or_else(|_| "null".to_string())
        }
        _ => "null".to_string(),
    };
    let auto_submit_js = if auto_submit { "true" } else { "false" };

    format!(
        r#"(function() {{
    const targetText = {text_json};
    const inputSel = {input_sel_json};
    const submitSel = {submit_sel_json};
    const autoSubmit = {auto_submit_js};

    if (!targetText) return;

    // 防止在同一次文本划选中重复执行
    if (window.__iox_last_text === targetText && window.__iox_injected_done) {{
        return;
    }}

    let attempts = 0;
    const maxAttempts = 60; // 60 * 250ms = 15s

    function findInput() {{
        // 1. 优先使用用户或预设指定的选择器
        if (inputSel) {{
            try {{
                const el = document.querySelector(inputSel);
                if (el && el.offsetParent !== null) return el;
                if (el) return el;
            }} catch (_) {{}}
        }}

        // 2. 启发式回退：查找可见的 textarea
        const textareas = Array.from(document.querySelectorAll('textarea'));
        for (const ta of textareas) {{
            if (ta.offsetParent !== null && !ta.disabled && !ta.readOnly) {{
                return ta;
            }}
        }}

        // 3. 启发式回退：查找可见的 contenteditable
        const editables = Array.from(document.querySelectorAll('div[contenteditable="true"], [contenteditable="true"]'));
        for (const ed of editables) {{
            if (ed.offsetParent !== null) {{
                return ed;
            }}
        }}

        // 4. 最宽容回退
        return document.querySelector('textarea, div[contenteditable="true"]');
    }}

    function triggerSubmit(inputEl) {{
        let clicked = false;

        // 1. 优先使用指定的 submitSel
        if (submitSel) {{
            try {{
                const btn = document.querySelector(submitSel);
                if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {{
                    btn.click();
                    clicked = true;
                }}
            }} catch (_) {{}}
        }}

        // 2. 启发式查找发送按钮
        if (!clicked) {{
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
            for (const b of buttons) {{
                const aria = b.getAttribute('aria-label') || '';
                const title = b.getAttribute('title') || '';
                const text = b.textContent?.trim() || '';
                const isSend = /发送|Send|Submit/i.test(aria) || /发送|Send|Submit/i.test(title) || /发送|Send/i.test(text);
                const notDisabled = !b.disabled && b.getAttribute('aria-disabled') !== 'true';
                if (isSend && notDisabled) {{
                    b.click();
                    clicked = true;
                    break;
                }}
            }}
        }}

        // 3. 回车键盘事件双保险 (keydown -> keypress -> keyup)
        const enterOpts = {{
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            charCode: 13,
            bubbles: true,
            cancelable: true
        }};
        inputEl.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
        inputEl.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
    }}

    function doInject() {{
        const el = findInput();
        if (!el) {{
            if (++attempts < maxAttempts) {{
                setTimeout(doInject, 250);
            }}
            return;
        }}

        try {{
            el.focus();

            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {{
                const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (setter) {{
                    setter.call(el, targetText);
                }} else {{
                    el.value = targetText;
                }}

                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                try {{
                    el.dispatchEvent(new InputEvent('input', {{ bubbles: true, inputType: 'insertText', data: targetText }}));
                }} catch (_) {{}}
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }} else if (el.isContentEditable) {{
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, targetText);
                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}

            window.__iox_last_text = targetText;
            window.__iox_injected_done = true;

            if (autoSubmit) {{
                setTimeout(() => {{
                    triggerSubmit(el);
                }}, 200);
            }}
        }} catch (err) {{
            console.error('[iox] DOM injection error:', err);
        }}
    }}

    if (document.readyState === 'loading') {{
        document.addEventListener('DOMContentLoaded', doInject, {{ once: true }});
    }} else {{
        doInject();
    }}
}})();"#,
        text_json = text_json,
        input_sel_json = input_sel_json,
        submit_sel_json = submit_sel_json,
        auto_submit_js = auto_submit_js
    )
}

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

    // 2. 提取并决定目标 URL 及注入脚本
    let template = action
        .url_template
        .as_deref()
        .unwrap_or("")
        .trim();
    if template.is_empty() {
        return Err(format!("Web action '{}' has no configured URL template", action.name));
    }

    let is_url_template = template.contains("{text}");
    let (target_url_str, injection_script) = if is_url_template {
        (render_url_template(template, text), None)
    } else {
        let input_sel = action.input_selector.as_deref().unwrap_or_else(|| {
            if template.contains("deepseek.com") || action.id == "act_web_deepseek" {
                "textarea#chat-input, textarea"
            } else if template.contains("kimi.moonshot.cn") {
                "div[contenteditable='true'], textarea"
            } else if template.contains("claude.ai") {
                "div[contenteditable='true'], fieldset textarea"
            } else if template.contains("doubao.com") {
                "textarea[data-testid*='input'], textarea"
            } else {
                "textarea, div[contenteditable='true']"
            }
        });

        let submit_sel = action.submit_selector.as_deref().or_else(|| {
            if template.contains("deepseek.com") || action.id == "act_web_deepseek" {
                Some("div[role='button']:not([aria-disabled='true']), button[type='submit']")
            } else if template.contains("kimi.moonshot.cn") {
                Some("button[data-testid*='send'], button.send-button")
            } else if template.contains("claude.ai") {
                Some("button[aria-label='Send Message']")
            } else if template.contains("doubao.com") {
                Some("button[data-testid*='send']")
            } else {
                None
            }
        });

        let auto_sub = action.auto_submit.unwrap_or(true);
        let script = build_injection_script(text, input_sel, submit_sel, auto_sub);
        (template.to_string(), Some(script))
    };

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
            if let Some(ref script) = injection_script {
                // DOM 注入模式：直接执行注入脚本填入新内容，无需全页刷新重载
                let _ = content_wv.eval(script);
            } else {
                // URL 模板模式：重新 navigate 到新 URL
                let _ = content_wv.navigate(target_url);
            }
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
    let icon = tauri::include_image!("icons/icon.png");
    let _ = window.set_icon(icon);

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
    let mut content_builder = WebviewBuilder::new(&content_label, WebviewUrl::External(target_url))
        .transparent(true);

    if let Some(ref script) = injection_script {
        content_builder = content_builder.initialization_script(script);
    }

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

    // 针对新打开的 Webview 进行定时轮询 eval 兜底（以防 initialization_script 阶段被 SPA 路由重置）
    if let Some(script) = injection_script {
        let wv_clone = content_wv.clone();
        tauri::async_runtime::spawn(async move {
            let delays = [800, 1800, 3500, 6000];
            for delay in delays {
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                let _ = wv_clone.eval(&script);
            }
        });
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_injection_script_basic() {
        let script = build_injection_script(
            "Hello \"world\"\nNext line",
            "textarea#chat-input",
            Some("button.send"),
            true,
        );
        assert!(script.contains("Hello \\\"world\\\"\\nNext line"));
        assert!(script.contains("textarea#chat-input"));
        assert!(script.contains("button.send"));
        assert!(script.contains("const autoSubmit = true;"));
    }

    #[test]
    fn test_build_injection_script_without_submit() {
        let script = build_injection_script("Test", "textarea", None, false);
        assert!(script.contains("const submitSel = null;"));
        assert!(script.contains("const autoSubmit = false;"));
    }
}
