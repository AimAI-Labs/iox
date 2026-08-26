//! AI 厂商受控组件适配器模块与注册表分发系统

pub mod base;
pub mod chatgpt;
pub mod claude;
pub mod deepseek;
pub mod doubao;
pub mod generic;
pub mod kimi;
pub mod qwen;

use std::sync::OnceLock;

/// AI 厂商受控组件适配器 Trait (策略模式)
pub trait VendorAdapter: Send + Sync {
    /// 厂商唯一标识 (如 "deepseek", "qwen", "kimi" 等)
    fn id(&self) -> &'static str;

    /// 厂商显示名称
    fn name(&self) -> &'static str;

    /// 判断当前 Web Action 是否匹配该厂商
    fn matches(&self, action_id: &str, url: &str) -> bool;

    /// 默认输入框 CSS 选择器
    fn default_input_selector(&self) -> &'static str;

    /// 默认提交按钮 CSS 选择器
    fn default_submit_selector(&self) -> Option<&'static str>;

    /// 生成针对该厂商的受控组件注入 JavaScript 脚本
    fn build_injection_script(
        &self,
        text: &str,
        custom_input_selector: Option<&str>,
        custom_submit_selector: Option<&str>,
        auto_submit: bool,
    ) -> String;
}

/// 厂商适配器注册表 (注册表 / 工厂模式)
pub struct VendorRegistry {
    adapters: Vec<Box<dyn VendorAdapter>>,
    generic: Box<dyn VendorAdapter>,
}

impl VendorRegistry {
    pub fn new() -> Self {
        Self {
            adapters: vec![
                Box::new(deepseek::DeepSeekAdapter::new()),
                Box::new(qwen::QwenAdapter::new()),
                Box::new(kimi::KimiAdapter::new()),
                Box::new(claude::ClaudeAdapter::new()),
                Box::new(doubao::DoubaoAdapter::new()),
                Box::new(chatgpt::ChatGPTAdapter::new()),
            ],
            generic: Box::new(generic::GenericAdapter::new()),
        }
    }

    /// 根据 action_id 与目标 URL 匹配最适合的厂商适配器
    pub fn get_adapter(&self, action_id: &str, url: &str) -> &dyn VendorAdapter {
        for adapter in &self.adapters {
            if adapter.matches(action_id, url) {
                return adapter.as_ref();
            }
        }
        self.generic.as_ref()
    }
}

impl Default for VendorRegistry {
    fn default() -> Self {
        Self::new()
    }
}

static REGISTRY: OnceLock<VendorRegistry> = OnceLock::new();

/// 全局便捷获取匹配的厂商适配器
pub fn get_vendor_adapter(action_id: &str, url: &str) -> &'static dyn VendorAdapter {
    let registry = REGISTRY.get_or_init(VendorRegistry::new);
    registry.get_adapter(action_id, url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_routing() {
        let registry = VendorRegistry::new();

        // 1. DeepSeek
        let ds = registry.get_adapter("act_web_deepseek", "https://chat.deepseek.com/");
        assert_eq!(ds.id(), "deepseek");

        // 2. Qwen
        let qwen = registry.get_adapter("act_web_qwen", "https://www.qianwen.com/");
        assert_eq!(qwen.id(), "qwen");

        let tongyi = registry.get_adapter("tongyi_custom", "https://tongyi.aliyun.com/");
        assert_eq!(tongyi.id(), "qwen");

        // 3. Kimi
        let kimi = registry.get_adapter("act_web_kimi", "https://kimi.moonshot.cn/");
        assert_eq!(kimi.id(), "kimi");

        // 4. Claude
        let claude = registry.get_adapter("act_web_claude", "https://claude.ai/new");
        assert_eq!(claude.id(), "claude");

        // 5. Doubao
        let doubao = registry.get_adapter("act_web_doubao", "https://www.doubao.com/chat/");
        assert_eq!(doubao.id(), "doubao");

        // 6. ChatGPT
        let chatgpt = registry.get_adapter("act_web_chatgpt", "https://chatgpt.com/");
        assert_eq!(chatgpt.id(), "chatgpt");

        // 7. Generic Fallback
        let unknown = registry.get_adapter("act_web_custom", "https://example.com/ai");
        assert_eq!(unknown.id(), "generic");
    }
}
