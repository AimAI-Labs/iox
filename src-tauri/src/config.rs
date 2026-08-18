use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

fn default_web_window_mode() -> String {
    "multi_window".to_string()
}

fn default_overlay_opacity() -> u32 {
    90
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
                    id: "act_web_search".to_string(),
                    name: "AI搜索".to_string(),
                    icon: "Search".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://www.perplexity.ai/search?q={text}".to_string()),
                    copy_to_clipboard: Some(false),
                    enabled: true,
                },
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
                    enabled: true,
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
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_qwen".to_string(),
                    name: "问千问".to_string(),
                    icon: "MessageSquare".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://tongyi.aliyun.com/qianwen/?q={text}".to_string()),
                    copy_to_clipboard: Some(false),
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
                    // 自动向前兼容：将旧版本遗留的 web_card 动作无缝迁移为 web 动作
                    for action in &mut config.actions {
                        if action.action_type == "web_card" {
                            action.action_type = "web".to_string();
                        }
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

        let default_config = AppConfig::default();
        assert_eq!(default_config.general.overlay_opacity, 90);
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
}
