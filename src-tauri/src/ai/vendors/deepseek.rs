//! DeepSeek 专有受控组件注入适配器

use super::base::{build_standard_injection_script, REACT_TEXTAREA_INJECTION};
use super::VendorAdapter;

pub struct DeepSeekAdapter;

impl DeepSeekAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl VendorAdapter for DeepSeekAdapter {
    fn id(&self) -> &'static str {
        "deepseek"
    }

    fn name(&self) -> &'static str {
        "DeepSeek"
    }

    fn matches(&self, action_id: &str, url: &str) -> bool {
        action_id == "act_web_deepseek" || url.contains("deepseek.com")
    }

    fn default_input_selector(&self) -> &'static str {
        "textarea#chat-input, textarea"
    }

    fn default_submit_selector(&self) -> Option<&'static str> {
        Some("div[role='button'][aria-label*='发送'], div[role='button'][aria-label*='Send'], button[type='submit']")
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
            REACT_TEXTAREA_INJECTION,
            None,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deepseek_matching() {
        let adapter = DeepSeekAdapter::new();
        assert!(adapter.matches("act_web_deepseek", "https://chat.deepseek.com/"));
        assert!(adapter.matches("custom_id", "https://chat.deepseek.com/"));
        assert!(!adapter.matches("act_web_qwen", "https://www.qianwen.com/"));
    }

    #[test]
    fn test_deepseek_script_generation() {
        let adapter = DeepSeekAdapter::new();
        let script = adapter.build_injection_script("Hello DeepSeek", None, None, true);
        assert!(script.contains("Hello DeepSeek"));
        assert!(script.contains("textarea#chat-input, textarea"));
        assert!(script.contains("_valueTracker"));
    }
}
