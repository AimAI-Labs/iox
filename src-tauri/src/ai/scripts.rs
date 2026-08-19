//! 集中管理针对外部 Webview 与 AI 官网的 JavaScript 注入与增强脚本

/// 页面缩放持久化脚本：在页面加载时自动应用 localStorage 中保存的缩放比例，并监听 Ctrl+滚轮与快捷键缩放
pub const ZOOM_PERSISTENCE_SCRIPT: &str = r#"(function() {
    try {
        const applyZoom = function() {
            const saved = localStorage.getItem('__iox_page_zoom');
            if (saved && parseFloat(saved) > 0) {
                document.body.style.zoom = saved;
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyZoom, { once: true });
        } else {
            applyZoom();
        }

        window.addEventListener('wheel', function(e) {
            if (e.ctrlKey) {
                setTimeout(function() {
                    const current = getComputedStyle(document.body).zoom || '1';
                    localStorage.setItem('__iox_page_zoom', current);
                }, 150);
            }
        }, { passive: true });

        window.addEventListener('keydown', function(e) {
            if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_' || e.key === '0')) {
                setTimeout(function() {
                    const current = getComputedStyle(document.body).zoom || '1';
                    localStorage.setItem('__iox_page_zoom', current);
                }, 150);
            }
        });
    } catch(_) {}
})();"#;

/// 构造针对现代 SPA AI 官网（如 DeepSeek、Kimi 等）的通用 DOM 注入与受控组件同步脚本
pub fn build_dom_injection_script(
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

/// 构建页面初始化背景与加载状态占位脚本，防止外部网页加载期间透明穿透或白屏割裂
pub fn build_initial_placeholder_script(theme: &str) -> String {
    let theme_json = serde_json::to_string(theme).unwrap_or_else(|_| "\"system\"".to_string());
    format!(
        r#"(function() {{
    try {{
        const theme = {theme_json};
        const isDark = theme === 'dark' || (theme !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const bg = isDark ? '#12141a' : '#ffffff';
        const fg = isDark ? '#a1a1aa' : '#71717a';
        const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

        const style = document.createElement('style');
        style.id = '__iox_loading_style';
        style.textContent = `
            html, body {{
                background-color: ${{bg}} !important;
                margin: 0 !important;
                padding: 0 !important;
                height: 100% !important;
                overflow: hidden !important;
            }}
            #__iox_loading_layer {{
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background-color: ${{bg}};
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                color: ${{fg}};
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 13px;
                z-index: 2147483647;
                transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
                user-select: none;
            }}
            #__iox_loading_spinner {{
                width: 22px;
                height: 22px;
                border: 2px solid ${{borderCol}};
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: __iox_spin 0.75s linear infinite;
            }}
            @keyframes __iox_spin {{
                0% {{ transform: rotate(0deg); }}
                100% {{ transform: rotate(360deg); }}
            }}
        `;
        (document.head || document.documentElement).appendChild(style);

        const layer = document.createElement('div');
        layer.id = '__iox_loading_layer';
        layer.innerHTML = `
            <div id="__iox_loading_spinner"></div>
            <div style="font-weight: 500; opacity: 0.85;">正在连接 AI 官网...</div>
        `;
        (document.body || document.documentElement).appendChild(layer);

        function cleanup() {{
            const el = document.getElementById('__iox_loading_layer');
            const st = document.getElementById('__iox_loading_style');
            if (el) {{
                el.style.opacity = '0';
                setTimeout(function() {{
                    try {{ el.remove(); }} catch(_) {{}}
                }}, 260);
            }}
            if (st) {{
                setTimeout(function() {{
                    try {{ st.remove(); }} catch(_) {{}}
                }}, 300);
            }}
        }}

        if (document.readyState === 'complete') {{
            setTimeout(cleanup, 200);
        }} else {{
            window.addEventListener('load', cleanup, {{ once: true }});
            setTimeout(cleanup, 4000);
        }}
    }} catch(_) {{}}
}})();"#,
        theme_json = theme_json
    )
}

/// 构建合并后的 Webview 初始化脚本（包含通用缩放持久化、即时占位骨架与可选的 DOM 自动填充脚本）
pub fn build_initialization_script(theme: &str, dom_injection: Option<&str>) -> String {
    let mut script = ZOOM_PERSISTENCE_SCRIPT.to_string();
    script.push('\n');
    script.push_str(&build_initial_placeholder_script(theme));
    if let Some(injection) = dom_injection {
        script.push('\n');
        script.push_str(injection);
    }
    script
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_injection_script_basic() {
        let script = build_dom_injection_script(
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
        let script = build_dom_injection_script("Test", "textarea", None, false);
        assert!(script.contains("const submitSel = null;"));
        assert!(script.contains("const autoSubmit = false;"));
    }

    #[test]
    fn test_build_initialization_script_combining() {
        let script_none = build_initialization_script("dark", None);
        assert!(script_none.starts_with(ZOOM_PERSISTENCE_SCRIPT));
        assert!(script_none.contains("__iox_loading_layer"));

        let custom_code = "console.log('hello');";
        let script_with_injection = build_initialization_script("light", Some(custom_code));
        assert!(script_with_injection.starts_with(ZOOM_PERSISTENCE_SCRIPT));
        assert!(script_with_injection.contains("__iox_loading_layer"));
        assert!(script_with_injection.ends_with(custom_code));
    }
}
