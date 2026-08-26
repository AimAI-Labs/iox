//! 通义千问 (Qwen) 专有受控组件注入适配器 (Slate.js 富文本与专用发送按钮)

use super::base::{build_standard_injection_script, SLATE_JS_INJECTION};
use super::VendorAdapter;

pub struct QwenAdapter;

impl QwenAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl VendorAdapter for QwenAdapter {
    fn id(&self) -> &'static str {
        "qwen"
    }

    fn name(&self) -> &'static str {
        "通义千问"
    }

    fn matches(&self, action_id: &str, url: &str) -> bool {
        action_id == "act_web_qwen"
            || action_id == "act_web_tongyi"
            || action_id == "tongyi"
            || url.contains("qianwen.com")
            || url.contains("tongyi.aliyun.com")
            || url.contains("tongyi.cn")
    }

    fn default_input_selector(&self) -> &'static str {
        "textarea, div[contenteditable='true'], [contenteditable='true']"
    }

    fn default_submit_selector(&self) -> Option<&'static str> {
        Some("button[aria-label='发送消息'], button[data-session-switch-target='send-query'], button[class*='send'], div[class*='send'], button[class*='operate'], button[type='submit'], div[role='button'][aria-label*='发送'], div[role='button'][aria-label*='Send']")
    }

    fn build_injection_script(
        &self,
        text: &str,
        custom_input_selector: Option<&str>,
        custom_submit_selector: Option<&str>,
        auto_submit: bool,
    ) -> String {
        let input_sel = custom_input_selector
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| self.default_input_selector());
        let submit_sel = custom_submit_selector
            .filter(|s| !s.trim().is_empty())
            .or_else(|| self.default_submit_selector());

        // 通义千问使用 Slate.js 富文本框架，需要通过 Range 选区与 ClipboardEvent 触发受控状态同步
        build_standard_injection_script(
            text,
            input_sel,
            submit_sel,
            auto_submit,
            SLATE_JS_INJECTION,
            None,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qwen_matching() {
        let adapter = QwenAdapter::new();
        assert!(adapter.matches("act_web_qwen", "https://www.qianwen.com/"));
        assert!(adapter.matches("act_web_tongyi", "https://tongyi.aliyun.com/"));
        assert!(adapter.matches("other_id", "https://www.qianwen.com/"));
        assert!(!adapter.matches("act_web_deepseek", "https://chat.deepseek.com/"));
    }

    #[test]
    fn test_qwen_script_generation() {
        let adapter = QwenAdapter::new();
        let script = adapter.build_injection_script("Test Qwen Query", None, None, true);
        assert!(script.contains("Test Qwen Query"));
        assert!(script.contains("data-slate-editor"));
        assert!(script.contains("ClipboardEvent"));
    }
}
