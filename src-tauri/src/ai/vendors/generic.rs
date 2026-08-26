//! 通用/兜底受控组件注入适配器 (支持标准 Textarea 与各类 ContentEditable 富文本)

use super::base::{build_standard_injection_script, HYBRID_INJECTION};
use super::VendorAdapter;

pub struct GenericAdapter;

impl GenericAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl VendorAdapter for GenericAdapter {
    fn id(&self) -> &'static str {
        "generic"
    }

    fn name(&self) -> &'static str {
        "通用适配器"
    }

    fn matches(&self, _action_id: &str, _url: &str) -> bool {
        true
    }

    fn default_input_selector(&self) -> &'static str {
        "textarea, div[contenteditable='true'], [contenteditable='true']"
    }

    fn default_submit_selector(&self) -> Option<&'static str> {
        None
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
    fn test_generic_matching() {
        let adapter = GenericAdapter::new();
        assert!(adapter.matches("any_action_id", "https://example.com/"));
    }

    #[test]
    fn test_generic_script_generation() {
        let adapter = GenericAdapter::new();
        let script = adapter.build_injection_script("Generic test", None, None, true);
        assert!(script.contains("Generic test"));
        assert!(script.contains("textarea, div[contenteditable='true'], [contenteditable='true']"));
    }
}
