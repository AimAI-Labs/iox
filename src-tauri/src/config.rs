use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

fn default_web_window_mode() -> String {
    "multi_window".to_string()
}

fn default_overlay_opacity() -> u32 {
    90
}

fn default_web_window_size() -> (f64, f64) {
    (860.0, 640.0)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GeneralConfig {
    pub auto_popup_on_selection: bool,
    pub min_selection_length: usize,
    pub trigger_modifier: String, // "None" | "Ctrl" | "Alt" | "Shift"
    pub global_hotkey: String,    // e.g. "Alt+Space"
    pub theme: String,            // "system" | "dark" | "light"
    pub auto_start: bool,
    #[serde(default = "default_web_window_mode")]
    pub web_window_mode: String,  // "multi_window" | "tabbed"
    #[serde(default)]
    pub auto_copy_on_web_action: bool,
    #[serde(default = "default_overlay_opacity")]
    pub overlay_opacity: u32,
    #[serde(default = "default_web_window_size")]
    pub web_window_size: (f64, f64),
    #[serde(default)]
    pub icon_only_bubble: bool,
}

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            auto_popup_on_selection: true,
            min_selection_length: 1,
            trigger_modifier: "None".to_string(),
            global_hotkey: "Alt+Space".to_string(),
            theme: "system".to_string(),
            auto_start: false,
            web_window_mode: "multi_window".to_string(),
            auto_copy_on_web_action: false,
            overlay_opacity: 90,
            web_window_size: (860.0, 640.0),
            icon_only_bubble: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub models: Vec<String>,
    pub default_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActionConfig {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub action_type: String, // "api" | "web" | "copy" (web_card auto-migrated)
    pub provider_id: Option<String>,
    pub prompt_template: Option<String>,
    pub url_template: Option<String>,
    pub copy_to_clipboard: Option<bool>,
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_selector: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub submit_selector: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_submit: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub general: GeneralConfig,
    pub blacklist: Vec<String>,
    pub providers: Vec<ProviderConfig>,
    pub actions: Vec<ActionConfig>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            general: GeneralConfig::default(),
            blacklist: vec![
                "League of Legends.exe".to_string(),
                "Valorant.exe".to_string(),
                "GenshinImpact.exe".to_string(),
            ],
            providers: vec![
                ProviderConfig {
                    id: "deepseek".to_string(),
                    name: "DeepSeek 官方".to_string(),
                    base_url: "https://api.deepseek.com/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec!["deepseek-chat".to_string(), "deepseek-reasoner".to_string()],
                    default_model: "deepseek-chat".to_string(),
                },
                ProviderConfig {
                    id: "qwen".to_string(),
                    name: "通义千问 (DashScope)".to_string(),
                    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec!["qwen-plus".to_string(), "qwen-max".to_string(), "qwen-turbo".to_string()],
                    default_model: "qwen-plus".to_string(),
                },
                ProviderConfig {
                    id: "ollama".to_string(),
                    name: "Ollama (本地)".to_string(),
                    base_url: "http://127.0.0.1:11434/v1".to_string(),
                    api_key: "ollama".to_string(),
                    models: vec!["deepseek-r1:latest".to_string(), "llama3:latest".to_string()],
                    default_model: "deepseek-r1:latest".to_string(),
                },
            ],
            actions: vec![
                ActionConfig {
                    id: "act_translate".to_string(),
                    name: "翻译".to_string(),
                    icon: "Languages".to_string(),
                    action_type: "api".to_string(),
                    provider_id: Some("deepseek".to_string()),
                    prompt_template: Some(
                        "你是一位专业翻译官。请将以下内容翻译为地道流畅的语言（中文转英文，外语转中文），直接输出译文：\n\n{text}".to_string(),
                    ),
                    url_template: None,
                    copy_to_clipboard: None,
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_summarize".to_string(),
                    name: "总结".to_string(),
                    icon: "FileText".to_string(),
                    action_type: "api".to_string(),
                    provider_id: Some("deepseek".to_string()),
                    prompt_template: Some(
                        "请简明扼要地总结以下内容的核心要点与关键结论：\n\n{text}".to_string(),
                    ),
                    url_template: None,
                    copy_to_clipboard: None,
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_deepseek".to_string(),
                    name: "DeepSeek".to_string(),
                    icon: "DeepSeek".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://chat.deepseek.com/".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: Some("textarea#chat-input, textarea".to_string()),
                    submit_selector: Some("div[role='button']:not([aria-disabled='true']), button[type='submit']".to_string()),
                    auto_submit: Some(true),
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_kimi".to_string(),
                    name: "Kimi".to_string(),
                    icon: "Kimi".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://kimi.moonshot.cn/".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: Some("div[contenteditable='true'], textarea".to_string()),
                    submit_selector: Some("button[data-testid*='send'], button.send-button".to_string()),
                    auto_submit: Some(true),
                    enabled: false,
                },
                ActionConfig {
                    id: "act_web_search".to_string(),
                    name: "AI搜索".to_string(),
                    icon: "Perplexity".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://www.perplexity.ai/search?q={text}".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_metaso".to_string(),
                    name: "秘塔AI".to_string(),
                    icon: "Metaso".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://metaso.cn/?q={text}".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_chatgpt".to_string(),
                    name: "ChatGPT".to_string(),
                    icon: "OpenAI".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://chatgpt.com/?q={text}".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_qwen".to_string(),
                    name: "问千问".to_string(),
                    icon: "Qwen".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://tongyi.aliyun.com/qianwen/?q={text}".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_phind".to_string(),
                    name: "Phind".to_string(),
                    icon: "Phind".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://www.phind.com/search?q={text}".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    enabled: false,
                },
                ActionConfig {
                    id: "act_web_felo".to_string(),
                    name: "Felo AI".to_string(),
                    icon: "Felo".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://felo.ai/search?q={text}".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    enabled: false,
                },
                ActionConfig {
                    id: "act_web_360".to_string(),
                    name: "360 AI".to_string(),
                    icon: "Ai360".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://ai.360.com/search?q={text}".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    enabled: false,
                },
                ActionConfig {
                    id: "act_copy".to_string(),
                    name: "复制".to_string(),
                    icon: "Copy".to_string(),
                    action_type: "copy".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: None,
                    copy_to_clipboard: Some(true),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    enabled: true,
                },
            ],
        }
    }
}

impl AppConfig {
    pub fn config_path() -> PathBuf {
        let app_data = std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."));
        app_data.join("iox").join("config.json")
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(mut config) = serde_json::from_str::<AppConfig>(&content) {
                    let mut modified = false;

                    // 1. 自动向前兼容：将旧版本遗留的 web_card 动作无缝迁移为 web 动作
                    for action in &mut config.actions {
                        if action.action_type == "web_card" {
                            action.action_type = "web".to_string();
                            modified = true;
                        }

                        // 2. 自动向前兼容：补齐已知 SPA 官网的 DOM 注入与自动提交配置
                        if action.action_type == "web" && action.input_selector.is_none() {
                            let url = action.url_template.as_deref().unwrap_or("");
                            if url.contains("deepseek.com") || action.id == "act_web_deepseek" {
                                action.input_selector = Some("textarea#chat-input, textarea".to_string());
                                action.submit_selector = Some("div[role='button']:not([aria-disabled='true']), button[type='submit']".to_string());
                                action.auto_submit = Some(true);
                                modified = true;
                            } else if url.contains("kimi.moonshot.cn") || action.id == "act_web_kimi" {
                                action.input_selector = Some("div[contenteditable='true'], textarea".to_string());
                                action.submit_selector = Some("button[data-testid*='send'], button.send-button".to_string());
                                action.auto_submit = Some(true);
                                modified = true;
                            } else if url.contains("claude.ai") || action.id == "act_web_claude" {
                                action.input_selector = Some("div[contenteditable='true'], fieldset textarea".to_string());
                                action.submit_selector = Some("button[aria-label='Send Message']".to_string());
                                action.auto_submit = Some(true);
                                modified = true;
                            } else if url.contains("doubao.com") || action.id == "act_web_doubao" {
                                action.input_selector = Some("textarea[data-testid*='input'], textarea".to_string());
                                action.submit_selector = Some("button[data-testid*='send']".to_string());
                                action.auto_submit = Some(true);
                                modified = true;
                            }
                        }
                    }

                    if modified {
                        let _ = config.save();
                    }

                    return config;
                }
            }
        }
        let default_config = Self::default();
        let _ = default_config.save();
        default_config
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&path, json).map_err(|e| format!("Failed to write config file: {}", e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_serialization() {
        let config = AppConfig::default();
        let json = serde_json::to_string_pretty(&config).expect("Serialize default config");
        let deserialized: AppConfig = serde_json::from_str(&json).expect("Deserialize default config");
        assert_eq!(config.general.global_hotkey, deserialized.general.global_hotkey);
        assert_eq!(deserialized.general.web_window_mode, "multi_window");
        assert_eq!(deserialized.general.overlay_opacity, 90);
        assert_eq!(deserialized.general.web_window_size, (860.0, 640.0));
        assert_eq!(config.providers.len(), deserialized.providers.len());
        assert_eq!(config.actions.len(), deserialized.actions.len());
    }

    #[test]
    fn test_overlay_opacity_default_and_backward_compatibility() {
        let raw_json = r#"{
            "general": {
                "autoPopupOnSelection": true,
                "minSelectionLength": 1,
                "triggerModifier": "None",
                "globalHotkey": "Alt+Space",
                "theme": "system",
                "autoStart": false
            },
            "blacklist": [],
            "providers": [],
            "actions": []
        }"#;
        let config: AppConfig = serde_json::from_str(raw_json).expect("Deserialize legacy config");
        assert_eq!(config.general.overlay_opacity, 90);
        assert_eq!(config.general.web_window_size, (860.0, 640.0));

        let default_config = AppConfig::default();
        assert_eq!(default_config.general.overlay_opacity, 90);
        assert_eq!(default_config.general.web_window_size, (860.0, 640.0));
    }

    #[test]
    fn test_action_types() {
        let config = AppConfig::default();
        let api_action = config.actions.iter().find(|a| a.action_type == "api");
        let web_action = config.actions.iter().find(|a| a.action_type == "web");
        let copy_action = config.actions.iter().find(|a| a.action_type == "copy");
        assert!(api_action.is_some());
        assert!(web_action.is_some());
        assert!(copy_action.is_some());
    }

    #[test]
    fn test_legacy_web_card_migration() {
        let raw_json = r#"{
            "general": {
                "autoPopupOnSelection": true,
                "minSelectionLength": 1,
                "triggerModifier": "None",
                "globalHotkey": "Alt+Space",
                "theme": "system",
                "autoStart": false
            },
            "blacklist": [],
            "providers": [],
            "actions": [
                {
                    "id": "act_metaso",
                    "name": "秘塔搜索",
                    "icon": "Globe",
                    "actionType": "web_card",
                    "urlTemplate": "https://metaso.cn/?q={text}",
                    "copyToClipboard": true,
                    "enabled": true
                }
            ]
        }"#;
        let mut config: AppConfig = serde_json::from_str(raw_json).expect("Deserialize legacy config");
        assert_eq!(config.general.web_window_mode, "multi_window");
        for action in &mut config.actions {
            if action.action_type == "web_card" {
                action.action_type = "web".to_string();
            }
        }
        assert_eq!(config.actions[0].action_type, "web");
    }

    #[test]
    fn test_action_config_dom_injection() {
        let config = AppConfig::default();
        let deepseek_action = config.actions.iter().find(|a| a.id == "act_web_deepseek").expect("DeepSeek action exists");
        assert_eq!(deepseek_action.action_type, "web");
        assert_eq!(deepseek_action.url_template.as_deref(), Some("https://chat.deepseek.com/"));
        assert_eq!(deepseek_action.input_selector.as_deref(), Some("textarea#chat-input, textarea"));
        assert_eq!(deepseek_action.auto_submit, Some(true));

        // 测试旧版本 JSON 反序列化时新增字段默认解析为 None
        let legacy_json = r#"{
            "id": "act_custom_web",
            "name": "Custom AI",
            "icon": "Bot",
            "actionType": "web",
            "urlTemplate": "https://example.com/chat",
            "enabled": true
        }"#;
        let action: ActionConfig = serde_json::from_str(legacy_json).expect("Deserialize legacy action config");
        assert_eq!(action.input_selector, None);
        assert_eq!(action.submit_selector, None);
        assert_eq!(action.auto_submit, None);
    }
}
