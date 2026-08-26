//! Anthropic Claude 专有受控组件注入适配器 (ProseMirror / ContentEditable 富文本)

use super::base::{build_standard_injection_script, CONTENT_EDITABLE_INJECTION};
use super::VendorAdapter;

pub struct ClaudeAdapter;

impl ClaudeAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl VendorAdapter for ClaudeAdapter {
    fn id(&self) -> &'static str {
        "claude"
    }

    fn name(&self) -> &'static str {
        "Claude"
    }

    fn matches(&self, action_id: &str, url: &str) -> bool {
        action_id == "act_web_claude" || url.contains("claude.ai")
    }

    fn default_input_selector(&self) -> &'static str {
        "div[contenteditable='true'], fieldset textarea"
    }

    fn default_submit_selector(&self) -> Option<&'static str> {
        Some("button[aria-label='Send Message'], button[aria-label*='发送']")
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

        build_standard_injection_script(
            text,
            input_sel,
            submit_sel,
            auto_submit,
            CONTENT_EDITABLE_INJECTION,
            None,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_matching() {
        let adapter = ClaudeAdapter::new();
        assert!(adapter.matches("act_web_claude", "https://claude.ai/new"));
        assert!(adapter.matches("claude_act", "https://claude.ai/chats"));
        assert!(!adapter.matches("act_web_deepseek", "https://chat.deepseek.com/"));
    }

    #[test]
    fn test_claude_script_generation() {
        let adapter = ClaudeAdapter::new();
        let script = adapter.build_injection_script("Claude prompt text", None, None, true);
        assert!(script.contains("Claude prompt text"));
        assert!(script.contains("button[aria-label='Send Message']"));
    }
}
