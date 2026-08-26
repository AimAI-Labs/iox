//! 通用受控组件注入生命周期模板方法与辅助代码片段生成

/// 生成标准受控组件注入生命周期骨架脚本（模板方法）
///
/// 包含：
/// 1. 唯一 `taskId` 生成与全局抢占防重（杜绝重复注入）；
/// 2. DOM 轮询重试（最多 60 次，共 12 秒）；
/// 3. 输入框查找（优先使用指定选择器，其次回退）；
/// 4. 自定义输入注入策略执行（`input_injection_js`）；
/// 5. 光标移动至末尾；
/// 6. 自动提交调度与超时回退（`custom_submit_js` 或标准点击策略）；
pub fn build_standard_injection_script(
    text: &str,
    input_selector: &str,
    submit_selector: Option<&str>,
    auto_submit: bool,
    input_injection_js: &str,
    custom_submit_js: Option<&str>,
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

    let submit_body = if let Some(custom_submit) = custom_submit_js {
        custom_submit.to_string()
    } else {
        STANDARD_SUBMIT_LOGIC.to_string()
    };

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

        // 查找可见的富文本 (包含 Slate.js, ProseMirror, contenteditable)
        const editables = Array.from(document.querySelectorAll('div[data-slate-editor="true"], div[contenteditable="true"], [contenteditable="true"], div#prompt-textarea'));
        for (const ed of editables) {{
            if (ed.offsetParent !== null && ed.getAttribute('contenteditable') !== 'false') {{
                return ed;
            }}
        }}

        return document.querySelector('div[data-slate-editor="true"], textarea, div[contenteditable="true"], [contenteditable="true"], div#prompt-textarea');
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

            // 2. 注入文本 (抢占 taskId 锁，杜绝重复输入)
            if (window.__iox_injected_task !== taskId) {{
                window.__iox_injected_task = taskId;

                {input_injection_js}

                // 光标置尾
                setCursorToEnd(el);
            }}

            // 3. 自动提交处理
            if (autoSubmit) {{
                {submit_body}
            }} else {{
                // 非自动提交模式：光标置尾，标记任务处理完成
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
        auto_submit_js = auto_submit_js,
        input_injection_js = input_injection_js,
        submit_body = submit_body
    )
}

/// 标准受控 React Textarea 注入代码片段
pub const REACT_TEXTAREA_INJECTION: &str = r#"
    if (el._valueTracker) {
        el._valueTracker.setValue('');
    }
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
        setter.call(el, targetText);
    } else {
        el.value = targetText;
    }

    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    try {
        el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: targetText }));
    } catch (_) {}
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
"#;

/// 标准 Slate.js 富文本编辑器选区与剪贴板模拟注入代码片段
pub const SLATE_JS_INJECTION: &str = r#"
    const targetEditor = el.hasAttribute('data-slate-editor') ? el : (el.closest('[data-slate-editor="true"]') || el);
    targetEditor.focus();

    // 主动建立选区
    try {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(targetEditor);
        if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
    } catch (_) {}

    try {
        document.execCommand('selectAll', false, null);
    } catch (_) {}

    try {
        const dt = new DataTransfer();
        dt.setData('text/plain', targetText);
        const pasteEvt = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            composed: true,
            clipboardData: dt,
        });
        targetEditor.dispatchEvent(pasteEvt);
    } catch (_) {}
"#;

/// 标准 ContentEditable / ProseMirror 选区与事件注入代码片段
pub const CONTENT_EDITABLE_INJECTION: &str = r#"
    el.focus();
    try {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
    } catch (_) {}

    try {
        document.execCommand('selectAll', false, null);
    } catch (_) {}

    let inserted = false;
    try {
        inserted = document.execCommand('insertText', false, targetText);
    } catch (_) {}

    if (!inserted) {
        try {
            const dt = new DataTransfer();
            dt.setData('text/plain', targetText);
            const pasteEvt = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                composed: true,
                clipboardData: dt,
            });
            el.dispatchEvent(pasteEvt);
        } catch (_) {}
    }
"#;

/// 混合自适应注入代码片段（支持原生 Textarea 与各种富文本）
pub const HYBRID_INJECTION: &str = r#"
    const isRichEditor = el.hasAttribute('data-slate-editor') ||
        Boolean(el.closest('[data-slate-editor="true"]')) ||
        el.isContentEditable ||
        el.getAttribute('contenteditable') === 'true' ||
        el.id === 'prompt-textarea';

    if (isRichEditor) {
        const targetEditor = el.hasAttribute('data-slate-editor') ? el : (el.closest('[data-slate-editor="true"]') || el);
        targetEditor.focus();

        try {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(targetEditor);
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
        } catch (_) {}

        try {
            document.execCommand('selectAll', false, null);
        } catch (_) {}

        let inserted = false;
        try {
            inserted = document.execCommand('insertText', false, targetText);
        } catch (_) {}

        if (!inserted) {
            try {
                const dt = new DataTransfer();
                dt.setData('text/plain', targetText);
                const pasteEvt = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clipboardData: dt,
                });
                targetEditor.dispatchEvent(pasteEvt);
            } catch (_) {}
        }
    } else if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        if (el._valueTracker) {
            el._valueTracker.setValue('');
        }
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) {
            setter.call(el, targetText);
        } else {
            el.value = targetText;
        }

        el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        try {
            el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: targetText }));
        } catch (_) {}
        el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
"#;

/// 标准提交逻辑：包含指定的 submitSel 查找、同级操作区查找、启发式按钮查找与超时 Enter 回退
pub const STANDARD_SUBMIT_LOGIC: &str = r#"
    let submitAttempts = 0;
    const maxSubmitAttempts = 35; // 35 * 100ms = 3.5s

    function trySubmit() {
        if (window.__iox_completed_task === taskId) return;

        let clicked = false;

        // A. 优先查找指定的 submitSel (需处于未禁用可用状态)
        if (submitSel) {
            try {
                const elements = Array.from(document.querySelectorAll(submitSel));
                for (const btn of elements) {
                    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;
                    const text = (btn.textContent || '').trim();
                    const aria = (btn.getAttribute('aria-label') || '').trim();
                    const title = (btn.getAttribute('title') || '').trim();
                    const combined = `${text} ${aria} ${title}`;

                    if (/搜索|Search|思考|Think|联网|附件|Upload|设置|Setting|语音/i.test(combined) && !/发送|Send|Submit/i.test(combined)) {
                        continue;
                    }

                    btn.click();
                    clicked = true;
                    break;
                }
            } catch (_) {}
        }

        // B. 在输入框同级或祖先操作区查找发送按钮
        if (!clicked && el) {
            try {
                const container = el.closest('form, div[class*="chat"], div[class*="input"], div[class*="search"], div[class*="box"]') || el.parentElement;
                if (container) {
                    const btns = Array.from(container.querySelectorAll('button, div[role="button"]'));
                    for (const b of btns) {
                        if (b.disabled || b.getAttribute('aria-disabled') === 'true') continue;
                        const aria = b.getAttribute('aria-label') || '';
                        const title = b.getAttribute('title') || '';
                        const text = b.textContent?.trim() || '';
                        const cls = b.className?.toString() || '';
                        const combined = `${text} ${aria} ${title} ${cls}`;

                        if (/搜索|Search|思考|Think|联网|附件|Upload|设置|Setting|语音/i.test(combined) && !/发送|Send|Submit/i.test(combined)) {
                            continue;
                        }

                        if (/send|submit|发送|operate/i.test(combined) || b.querySelector('svg')) {
                            b.click();
                            clicked = true;
                            break;
                        }
                    }
                }
            } catch (_) {}
        }

        // C. 全局启发式查找已激活的发送按钮
        if (!clicked) {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
            for (const b of buttons) {
                const aria = b.getAttribute('aria-label') || '';
                const title = b.getAttribute('title') || '';
                const text = b.textContent?.trim() || '';
                const combined = `${text} ${aria} ${title}`;

                if (/搜索|Search|思考|Think|联网|附件|Upload|设置|Setting|语音/i.test(combined) && !/发送|Send|Submit/i.test(combined)) {
                    continue;
                }

                const isSend = /发送|Send|Submit/i.test(aria) || /发送|Send|Submit/i.test(title) || /发送|Send/i.test(text);
                const notDisabled = !b.disabled && b.getAttribute('aria-disabled') !== 'true';
                if (isSend && notDisabled) {
                    b.click();
                    clicked = true;
                    break;
                }
            }
        }

        if (clicked) {
            window.__iox_completed_task = taskId;
            return;
        }

        // 若 React 尚未完成 state 同步点亮按钮，持续轮询等待
        if (++submitAttempts < maxSubmitAttempts) {
            setTimeout(trySubmit, 100);
        } else {
            // 超时回退回车键盘事件
            const enterOpts = {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                charCode: 13,
                bubbles: true,
                cancelable: true,
                composed: true
            };
            el.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
            el.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
            el.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
            window.__iox_completed_task = taskId;
        }
    }

    setTimeout(trySubmit, 150);
"#;
