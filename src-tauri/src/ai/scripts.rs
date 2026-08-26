//! 集中管理针对外部 Webview 与 AI 官网的通用 JavaScript 注入与增强脚本

use super::vendors::get_vendor_adapter;

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

/// 兼容旧版调用的通用 DOM 注入脚本构造入口（内部自动通过厂商注册表分发）
pub fn build_dom_injection_script(
    text: &str,
    input_selector: &str,
    submit_selector: Option<&str>,
    auto_submit: bool,
) -> String {
    let adapter = get_vendor_adapter("", "");
    adapter.build_injection_script(text, Some(input_selector), submit_selector, auto_submit)
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
