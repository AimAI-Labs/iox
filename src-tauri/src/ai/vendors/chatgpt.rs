//! OpenAI ChatGPT 专有受控组件注入适配器 (ProseMirror / ContentEditable 富文本)

use super::base::{build_standard_injection_script, HYBRID_INJECTION};
use super::VendorAdapter;

pub struct ChatGPTAdapter;

impl ChatGPTAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl VendorAdapter for ChatGPTAdapter {
    fn id(&self) -> &'static str {
        "chatgpt"
    }

    fn name(&self) -> &'static str {
        "ChatGPT"
    }

    fn matches(&self, action_id: &str, url: &str) -> bool {
        action_id == "act_web_chatgpt" || url.contains("chatgpt.com") || url.contains("openai.com")
    }

    fn default_input_selector(&self) -> &'static str {
        "div#prompt-textarea, textarea[data-id*='root'], div[contenteditable='true']"
    }

    fn default_submit_selector(&self) -> Option<&'static str> {
        Some("button[data-testid='send-button'], button[aria-label*='Send prompt'], button[aria-label*='发送']")
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
            HYBRID_INJECTION,
            None,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chatgpt_matching() {
        let adapter = ChatGPTAdapter::new();
        assert!(adapter.matches("act_web_chatgpt", "https://chatgpt.com/"));
        assert!(adapter.matches("chatgpt_test", "https://chat.openai.com/"));
        assert!(!adapter.matches("act_web_deepseek", "https://chat.deepseek.com/"));
    }

    #[test]
    fn test_chatgpt_script_generation() {
        let adapter = ChatGPTAdapter::new();
        let script = adapter.build_injection_script("ChatGPT prompt", None, None, true);
        assert!(script.contains("ChatGPT prompt"));
        assert!(script.contains("button[data-testid='send-button']"));
    }
}
