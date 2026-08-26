//! 字节跳动豆包 专有受控组件注入适配器

use super::base::{build_standard_injection_script, REACT_TEXTAREA_INJECTION};
use super::VendorAdapter;

pub struct DoubaoAdapter;

impl DoubaoAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl VendorAdapter for DoubaoAdapter {
    fn id(&self) -> &'static str {
        "doubao"
    }

    fn name(&self) -> &'static str {
        "豆包"
    }

    fn matches(&self, action_id: &str, url: &str) -> bool {
        action_id == "act_web_doubao" || url.contains("doubao.com")
    }

    fn default_input_selector(&self) -> &'static str {
        "textarea[data-testid*='input'], textarea"
    }

    fn default_submit_selector(&self) -> Option<&'static str> {
        Some("button[data-testid*='send']")
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
    fn test_doubao_matching() {
        let adapter = DoubaoAdapter::new();
        assert!(adapter.matches("act_web_doubao", "https://www.doubao.com/chat/"));
        assert!(adapter.matches("doubao_test", "https://www.doubao.com/"));
        assert!(!adapter.matches("act_web_deepseek", "https://chat.deepseek.com/"));
    }

    #[test]
    fn test_doubao_script_generation() {
        let adapter = DoubaoAdapter::new();
        let script = adapter.build_injection_script("Doubao test query", None, None, true);
        assert!(script.contains("Doubao test query"));
        assert!(script.contains("textarea[data-testid*='input']"));
        assert!(script.contains("button[data-testid*='send']"));
    }
}
