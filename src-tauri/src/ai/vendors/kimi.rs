//! Moonshot Kimi 专有受控组件注入适配器

use super::base::{build_standard_injection_script, CONTENT_EDITABLE_INJECTION};
use super::VendorAdapter;

pub struct KimiAdapter;

impl KimiAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl VendorAdapter for KimiAdapter {
    fn id(&self) -> &'static str {
        "kimi"
    }

    fn name(&self) -> &'static str {
        "Kimi"
    }

    fn matches(&self, action_id: &str, url: &str) -> bool {
        action_id == "act_web_kimi" || url.contains("kimi.moonshot.cn")
    }

    fn default_input_selector(&self) -> &'static str {
        "div[contenteditable='true'], textarea"
    }

    fn default_submit_selector(&self) -> Option<&'static str> {
        Some("button[data-testid*='send'], button.send-button")
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
    fn test_kimi_matching() {
        let adapter = KimiAdapter::new();
        assert!(adapter.matches("act_web_kimi", "https://kimi.moonshot.cn/"));
        assert!(adapter.matches("custom_kimi", "https://kimi.moonshot.cn/chat"));
        assert!(!adapter.matches("act_web_deepseek", "https://chat.deepseek.com/"));
    }

    #[test]
    fn test_kimi_script_generation() {
        let adapter = KimiAdapter::new();
        let script = adapter.build_injection_script("Kimi query text", None, None, true);
        assert!(script.contains("Kimi query text"));
        assert!(script.contains("button[data-testid*='send'], button.send-button"));
    }
}
