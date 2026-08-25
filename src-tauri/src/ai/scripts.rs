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

/// 构造针对现代 SPA AI 官网（如 DeepSeek、通义千问、Kimi 等）的通用 DOM 注入与受控组件同步脚本
pub fn build_dom_injection_script(
    text: &str,
    input_selector: &str,
    submit_selector: Option<&str>,
    auto_submit: bool,
) -> String {
    let task_id = format!(
        "task_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let task_id_json = serde_json::to_string(&task_id).unwrap_or_else(|_| "\"\"".to_string());
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
    const taskId = {task_id_json};
    const targetText = {text_json};
    const inputSel = {input_sel_json};
    const submitSel = {submit_sel_json};
    const autoSubmit = {auto_submit_js};

    if (!targetText) return;

    // 1. 同一任务防重：如果当前 taskId 已经完整执行并提交完毕，直接退出避免重复处理
    if (window.__iox_completed_task === taskId) {{
        return;
    }}

    let attempts = 0;
    const maxAttempts = 60; // 60 * 200ms = 12s

    function findInput() {{
        // 优先使用指定的选择器
        if (inputSel) {{
            try {{
                const el = document.querySelector(inputSel);
                if (el && el.offsetParent !== null) return el;
                if (el) return el;
            }} catch (_) {{}}
        }}

        // 查找可见的 textarea
        const textareas = Array.from(document.querySelectorAll('textarea'));
        for (const ta of textareas) {{
            if (ta.offsetParent !== null && !ta.disabled && !ta.readOnly) {{
                return ta;
            }}
        }}

        // 查找可见的富文本 (包含千问专用的 Slate.js 与 contenteditable)
        const editables = Array.from(document.querySelectorAll('div[data-slate-editor="true"], div[contenteditable="true"], [contenteditable="true"]'));
        for (const ed of editables) {{
            if (ed.offsetParent !== null && ed.getAttribute('contenteditable') !== 'false') {{
                return ed;
            }}
        }}

        return document.querySelector('div[data-slate-editor="true"], textarea, div[contenteditable="true"], [contenteditable="true"]');
    }}

    function setCursorToEnd(el) {{
        try {{
            el.focus();
            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {{
                const len = (el.value || '').length;
                el.setSelectionRange(len, len);
            }} else if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {{
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(el);
                range.collapse(false);
                if (sel) {{
                    sel.removeAllRanges();
                    sel.addRange(range);
                }}
            }}
        }} catch (_) {{}}
    }}

    function doInject() {{
        if (window.__iox_completed_task === taskId) {{
            return;
        }}

        const el = findInput();
        if (!el) {{
            if (++attempts < maxAttempts) {{
                setTimeout(doInject, 200);
            }}
            return;
        }}

        try {{
            el.focus();

            const isRichEditor = el.hasAttribute('data-slate-editor') ||
                Boolean(el.closest('[data-slate-editor="true"]')) ||
                el.isContentEditable ||
                el.getAttribute('contenteditable') === 'true';

            // 2. 注入文本 (立即抢占 taskId 锁，彻底杜绝任何并发或延迟协程导致的二次输入)
            if (window.__iox_injected_task !== taskId) {{
                window.__iox_injected_task = taskId;

                if (isRichEditor) {{
                    const targetEditor = el.hasAttribute('data-slate-editor') ? el : (el.closest('[data-slate-editor="true"]') || el);
                    targetEditor.focus();

                    // 主动建立选区
                    try {{
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(targetEditor);
                        if (sel) {{
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }}
                    }} catch (_) {{}}

                    try {{
                        document.execCommand('selectAll', false, null);
                    }} catch (_) {{}}

                    try {{
                        const dt = new DataTransfer();
                        dt.setData('text/plain', targetText);
                        const pasteEvt = new ClipboardEvent('paste', {{
                            bubbles: true,
                            cancelable: true,
                            composed: true,
                            clipboardData: dt,
                        }});
                        targetEditor.dispatchEvent(pasteEvt);
                    }} catch (_) {{}}

                }} else if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {{
                    if (el._valueTracker) {{
                        el._valueTracker.setValue('');
                    }}
                    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                    if (setter) {{
                        setter.call(el, targetText);
                    }} else {{
                        el.value = targetText;
                    }}

                    el.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
                    try {{
                        el.dispatchEvent(new InputEvent('input', {{ bubbles: true, composed: true, inputType: 'insertText', data: targetText }}));
                    }} catch (_) {{}}
                    el.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
                }}

                // 光标置尾
                setCursorToEnd(el);
            }}

            // 3. 自动提交处理 (autoSubmit: true 时智能等待 React 状态更新并激活发送按钮)
            if (autoSubmit) {{
                let submitAttempts = 0;
                const maxSubmitAttempts = 35; // 35 * 100ms = 3.5s

                function trySubmit() {{
                    if (window.__iox_completed_task === taskId) return;

                    let clicked = false;

                    // A. 优先查找指定的 submitSel (需处于未禁用可用状态)
                    if (submitSel) {{
                        try {{
                            const elements = Array.from(document.querySelectorAll(submitSel));
                            for (const btn of elements) {{
                                if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;
                                const text = (btn.textContent || '').trim();
                                const aria = (btn.getAttribute('aria-label') || '').trim();
                                const title = (btn.getAttribute('title') || '').trim();
                                const combined = `${{text}} ${{aria}} ${{title}}`;

                                if (/搜索|Search|思考|Think|联网|附件|Upload|设置|Setting|语音/i.test(combined) && !/发送|Send|Submit/i.test(combined)) {{
                                    continue;
                                }}

                                btn.click();
                                clicked = true;
                                break;
                            }}
                        }} catch (_) {{}}
                    }}

                    // B. 千问官方专属精准选择器 (button[aria-label="发送消息"], button[data-session-switch-target="send-query"])
                    if (!clicked) {{
                        const qwenBtn = document.querySelector('button[aria-label="发送消息"]:not([disabled]), button[data-session-switch-target="send-query"]:not([disabled])');
                        if (qwenBtn) {{
                            qwenBtn.click();
                            clicked = true;
                        }}
                    }}

                    // C. 在输入框同级或祖先操作区查找发送按钮
                    if (!clicked && el) {{
                        try {{
                            const container = el.closest('form, div[class*="chat"], div[class*="input"], div[class*="search"], div[class*="box"]') || el.parentElement;
                            if (container) {{
                                const btns = Array.from(container.querySelectorAll('button, div[role="button"]'));
                                for (const b of btns) {{
                                    if (b.disabled || b.getAttribute('aria-disabled') === 'true') continue;
                                    const aria = b.getAttribute('aria-label') || '';
                                    const title = b.getAttribute('title') || '';
                                    const text = b.textContent?.trim() || '';
                                    const cls = b.className?.toString() || '';
                                    const combined = `${{text}} ${{aria}} ${{title}} ${{cls}}`;

                                    if (/搜索|Search|思考|Think|联网|附件|Upload|设置|Setting|语音/i.test(combined) && !/发送|Send|Submit/i.test(combined)) {{
                                        continue;
                                    }}

                                    if (/send|submit|发送|operate/i.test(combined) || b.querySelector('svg')) {{
                                        b.click();
                                        clicked = true;
                                        break;
                                    }}
                                }}
                            }}
                        }} catch (_) {{}}
                    }}

                    // D. 全局启发式查找已激活的发送按钮
                    if (!clicked) {{
                        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                        for (const b of buttons) {{
                            const aria = b.getAttribute('aria-label') || '';
                            const title = b.getAttribute('title') || '';
                            const text = b.textContent?.trim() || '';
                            const combined = `${{text}} ${{aria}} ${{title}}`;

                            if (/搜索|Search|思考|Think|联网|附件|Upload|设置|Setting|语音/i.test(combined) && !/发送|Send|Submit/i.test(combined)) {{
                                continue;
                            }}

                            const isSend = /发送|Send|Submit/i.test(aria) || /发送|Send|Submit/i.test(title) || /发送|Send/i.test(text);
                            const notDisabled = !b.disabled && b.getAttribute('aria-disabled') !== 'true';
                            if (isSend && notDisabled) {{
                                b.click();
                                clicked = true;
                                break;
                            }}
                        }}
                    }}

                    if (clicked) {{
                        window.__iox_completed_task = taskId;
                        return;
                    }}

                    // 若 React 尚未完成 state 同步点亮按钮，持续轮询等待
                    if (++submitAttempts < maxSubmitAttempts) {{
                        setTimeout(trySubmit, 100);
                    }} else {{
                        // 超时回退回车键盘事件
                        const enterOpts = {{
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            charCode: 13,
                            bubbles: true,
                            cancelable: true,
                            composed: true
                        }};
                        el.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
                        el.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
                        el.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
                        window.__iox_completed_task = taskId;
                    }}
                }}

                setTimeout(trySubmit, 150);
            }} else {{
                // 双击引用模式 (autoSubmit: false)：光标移至末尾，标记任务处理完成
                window.__iox_completed_task = taskId;
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
        task_id_json = task_id_json,
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

/// 外部超链接拦截与默认浏览器调起脚本：在 AI 官网对话中点击任何外部链接时，自动使用系统默认浏览器打开，防止破坏当前 AI 对话会话
pub const EXTERNAL_LINK_INTERCEPTOR_SCRIPT: &str = r#"(function() {
    function openExternal(url) {
        try {
            if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
                window.__TAURI__.core.invoke('open_in_browser', { url: url });
                return true;
            }
        } catch(_) {}
        return false;
    }

    // 1. 全局捕获 a 标签点击
    document.addEventListener('click', function(e) {
        const a = e.target.closest ? e.target.closest('a') : null;
        if (!a || !a.href) return;

        const href = a.href;
        if (!href.startsWith('http://') && !href.startsWith('https://')) return;

        try {
            const targetUrl = new URL(href, window.location.href);
            const currentOrigin = window.location.origin;

            // 属于外部链接 (跨域域名，或 target="_blank")
            if (targetUrl.origin !== currentOrigin || a.target === '_blank') {
                e.preventDefault();
                e.stopPropagation();
                openExternal(href);
            }
        } catch(_) {}
    }, true);

    // 2. 拦截 window.open 弹窗
    try {
        const origOpen = window.open;
        window.open = function(url, target, features) {
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                try {
                    const targetUrl = new URL(url, window.location.href);
                    if (targetUrl.origin !== window.location.origin || target === '_blank') {
                        if (openExternal(targetUrl.href)) {
                            return null;
                        }
                    }
                } catch(_) {}
            }
            return origOpen ? origOpen.apply(this, arguments) : null;
        };
    } catch(_) {}
})();"#;

/// 构建合并后的 Webview 初始化脚本（包含通用缩放持久化、即时占位骨架、外部链接拦截与可选的 DOM 自动填充脚本）
pub fn build_initialization_script(theme: &str, dom_injection: Option<&str>) -> String {
    let mut script = ZOOM_PERSISTENCE_SCRIPT.to_string();
    script.push('\n');
    script.push_str(EXTERNAL_LINK_INTERCEPTOR_SCRIPT);
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
