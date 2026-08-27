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

fn default_api_card_size() -> (f64, f64) {
    (600.0, 900.0)
}

fn default_true() -> bool {
    true
}

fn default_floating_ball_pos() -> (i32, i32) {
    (0, 0)
}

fn default_language() -> String {
    "auto".to_string()
}

/// 获取系统当前 UI 语言代码，若是中文（包含繁体、简体）返回 "zh"，其余一切语言一律返回 "en"
pub fn get_system_language() -> &'static str {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Globalization::GetUserDefaultUILanguage;
        let lang_id = unsafe { GetUserDefaultUILanguage() };
        let primary_lang = lang_id & 0x03FF;
        if primary_lang == 0x04 {
            "zh"
        } else {
            "en"
        }
    }
    #[cfg(not(windows))]
    {
        let lang = std::env::var("LANG").unwrap_or_default().to_lowercase();
        if lang.starts_with("zh") {
            "zh"
        } else {
            "en"
        }
    }
}

/// 解析生效语言（如果是 "auto" 则解析系统语言，否则返回用户指定的 "zh" 或 "en"）
pub fn resolve_language(configured: &str) -> &'static str {
    match configured {
        "zh" => "zh",
        "en" => "en",
        _ => get_system_language(),
    }
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
    #[serde(default = "default_api_card_size")]
    pub api_card_size: (f64, f64),
    #[serde(default)]
    pub icon_only_bubble: bool,
    #[serde(default = "default_true")]
    pub enable_floating_ball: bool,
    #[serde(default = "default_true")]
    pub floating_ball_auto_hide: bool,
    #[serde(default = "default_floating_ball_pos")]
    pub floating_ball_pos: (i32, i32),
    #[serde(default = "default_language")]
    pub language: String,         // "auto" | "zh" | "en"
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
            api_card_size: (600.0, 900.0),
            icon_only_bubble: false,
            enable_floating_ball: true,
            floating_ball_auto_hide: true,
            floating_ball_pos: (0, 0),
            language: "auto".to_string(),
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub use_url_template: Option<bool>,
}

fn default_font_size() -> u32 {
    13
}

fn default_context_turns() -> u32 {
    5
}

fn default_send_shortcut() -> String {
    "Enter".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ApiCardConfig {
    #[serde(default = "default_api_card_size")]
    pub card_size: (f64, f64),
    #[serde(default)]
    pub auto_pin_on_open: bool,
    #[serde(default)]
    pub auto_focus_input: bool,
    #[serde(default = "default_true")]
    pub thinking_default_open: bool,
    #[serde(default = "default_true")]
    pub auto_collapse_thinking_on_done: bool,
    #[serde(default = "default_true")]
    pub show_duration: bool,
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(default)]
    pub code_block_wrap: bool,
    #[serde(default)]
    pub code_block_line_numbers: bool,
    #[serde(default = "default_context_turns")]
    pub context_turns: u32,
    #[serde(default = "default_send_shortcut")]
    pub send_key_shortcut: String,
}

impl Default for ApiCardConfig {
    fn default() -> Self {
        Self {
            card_size: (600.0, 900.0),
            auto_pin_on_open: false,
            auto_focus_input: false,
            thinking_default_open: true,
            auto_collapse_thinking_on_done: true,
            show_duration: true,
            font_size: 13,
            code_block_wrap: false,
            code_block_line_numbers: false,
            context_turns: 5,
            send_key_shortcut: "Enter".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub general: GeneralConfig,
    pub blacklist: Vec<String>,
    pub providers: Vec<ProviderConfig>,
    pub actions: Vec<ActionConfig>,
    #[serde(default)]
    pub api_card: ApiCardConfig,
}

impl AppConfig {
    /// 根据语言环境生成默认配置（中文 "zh" 或 英文 "en"）
    pub fn default_for_language(lang: &str) -> Self {
        let is_zh = lang == "zh";
        let providers = if is_zh {
            vec![
                ProviderConfig {
                    id: "deepseek".to_string(),
                    name: "DeepSeek 官方".to_string(),
                    base_url: "https://api.deepseek.com/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec![],
                    default_model: "".to_string(),
                },
                ProviderConfig {
                    id: "qwen".to_string(),
                    name: "通义千问 (DashScope)".to_string(),
                    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec![],
                    default_model: "".to_string(),
                },
                ProviderConfig {
                    id: "ollama".to_string(),
                    name: "Ollama (本地)".to_string(),
                    base_url: "http://127.0.0.1:11434/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec![],
                    default_model: "".to_string(),
                },
            ]
        } else {
            vec![
                ProviderConfig {
                    id: "deepseek".to_string(),
                    name: "DeepSeek".to_string(),
                    base_url: "https://api.deepseek.com/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec![],
                    default_model: "".to_string(),
                },
                ProviderConfig {
                    id: "qwen".to_string(),
                    name: "Qwen (DashScope)".to_string(),
                    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec![],
                    default_model: "".to_string(),
                },
                ProviderConfig {
                    id: "ollama".to_string(),
                    name: "Ollama (Local)".to_string(),
                    base_url: "http://127.0.0.1:11434/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec![],
                    default_model: "".to_string(),
                },
            ]
        };

        let actions = if is_zh {
            vec![
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
                    use_url_template: None,
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
                    use_url_template: None,
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
                    submit_selector: Some("div[role='button'][aria-label*='发送'], div[role='button'][aria-label*='Send'], button[type='submit']".to_string()),
                    auto_submit: Some(true),
                    use_url_template: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_kimi".to_string(),
                    name: "Kimi".to_string(),
                    icon: "Kimi".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://www.kimi.com/".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: Some("div[contenteditable='true'], textarea, [contenteditable='true']".to_string()),
                    submit_selector: Some("button[data-testid*='send'], button.send-button, div[role='button'][aria-label*='发送'], button[type='submit']".to_string()),
                    auto_submit: Some(true),
                    use_url_template: None,
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
                    use_url_template: Some(true),
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
                    use_url_template: Some(true),
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_chatgpt".to_string(),
                    name: "ChatGPT".to_string(),
                    icon: "OpenAI".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://chatgpt.com/".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    use_url_template: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_qwen".to_string(),
                    name: "问千问".to_string(),
                    icon: "Qwen".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://www.qianwen.com/".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: Some("textarea, div[contenteditable='true'], [contenteditable='true']".to_string()),
                    submit_selector: Some("button[class*='send'], div[class*='send'], button[class*='operate'], button[type='submit'], div[role='button'][aria-label*='发送'], div[role='button'][aria-label*='Send']".to_string()),
                    auto_submit: Some(true),
                    use_url_template: None,
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
                    use_url_template: Some(true),
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
                    use_url_template: Some(true),
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
                    use_url_template: Some(true),
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
                    use_url_template: None,
                    enabled: true,
                },
            ]
        } else {
            vec![
                ActionConfig {
                    id: "act_translate".to_string(),
                    name: "Translate".to_string(),
                    icon: "Languages".to_string(),
                    action_type: "api".to_string(),
                    provider_id: Some("deepseek".to_string()),
                    prompt_template: Some(
                        "You are a professional translator. Please translate the following content into fluent, idiomatic English (or translate English into idiomatic simplified Chinese if input is English). Directly output the translated text:\n\n{text}".to_string(),
                    ),
                    url_template: None,
                    copy_to_clipboard: None,
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    use_url_template: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_summarize".to_string(),
                    name: "Summarize".to_string(),
                    icon: "FileText".to_string(),
                    action_type: "api".to_string(),
                    provider_id: Some("deepseek".to_string()),
                    prompt_template: Some(
                        "Please summarize the key takeaways and core ideas of the following content clearly and concisely:\n\n{text}".to_string(),
                    ),
                    url_template: None,
                    copy_to_clipboard: None,
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    use_url_template: None,
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
                    submit_selector: Some("div[role='button'][aria-label*='发送'], div[role='button'][aria-label*='Send'], button[type='submit']".to_string()),
                    auto_submit: Some(true),
                    use_url_template: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_chatgpt".to_string(),
                    name: "ChatGPT".to_string(),
                    icon: "OpenAI".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://chatgpt.com/".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    use_url_template: None,
                    enabled: true,
                },
                ActionConfig {
                    id: "act_web_search".to_string(),
                    name: "Perplexity".to_string(),
                    icon: "Perplexity".to_string(),
                    action_type: "web".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: Some("https://www.perplexity.ai/search?q={text}".to_string()),
                    copy_to_clipboard: Some(false),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    use_url_template: Some(true),
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
                    use_url_template: Some(true),
                    enabled: false,
                },
                ActionConfig {
                    id: "act_copy".to_string(),
                    name: "Copy".to_string(),
                    icon: "Copy".to_string(),
                    action_type: "copy".to_string(),
                    provider_id: None,
                    prompt_template: None,
                    url_template: None,
                    copy_to_clipboard: Some(true),
                    input_selector: None,
                    submit_selector: None,
                    auto_submit: None,
                    use_url_template: None,
                    enabled: true,
                },
            ]
        };

        Self {
            general: GeneralConfig::default(),
            blacklist: vec![
                "League of Legends.exe".to_string(),
                "Valorant.exe".to_string(),
                "GenshinImpact.exe".to_string(),
            ],
            providers,
            actions,
            api_card: ApiCardConfig::default(),
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self::default_for_language("zh")
    }
}

impl AppConfig {
    /// 获取用户主目录基础路径
    pub fn home_dir() -> PathBuf {
        std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
    }

    /// 获取当前环境对应的配置文件夹名称
    /// 调试模式（Debug）或显式设置 IOX_ENV=dev 时使用 ".iox-dev"
    /// 生产模式（Release）使用 ".iox"
    pub fn config_dir_name() -> &'static str {
        if std::env::var("IOX_ENV").map(|v| v == "dev").unwrap_or(false) || cfg!(debug_assertions) {
            ".iox-dev"
        } else {
            ".iox"
        }
    }

    /// 获取配置文件夹完整路径
    pub fn config_dir() -> PathBuf {
        Self::home_dir().join(Self::config_dir_name())
    }

    /// 获取 config.json 完整路径
    pub fn config_path() -> PathBuf {
        Self::config_dir().join("config.json")
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

                        // 2. 自动向前兼容：迁移已过期的通义千问与 Kimi URL 至官方新域名
                        if action.action_type == "web" {
                            if let Some(ref mut tmpl) = action.url_template {
                                if tmpl.contains("tongyi.aliyun.com/qianwen") {
                                    *tmpl = "https://www.qianwen.com/".to_string();
                                    modified = true;
                                } else if tmpl.contains("kimi.moonshot.cn") {
                                    *tmpl = "https://www.kimi.com/".to_string();
                                    modified = true;
                                }
                            }
                        }

                        // 3. 自动向前兼容：补齐与纠正已知 SPA 官网的 DOM 注入与自动提交配置
                        if action.action_type == "web" {
                            let url = action.url_template.as_deref().unwrap_or("");
                            if url.contains("deepseek.com") || action.id == "act_web_deepseek" {
                                if action.input_selector.is_none() {
                                    action.input_selector = Some("textarea#chat-input, textarea".to_string());
                                    modified = true;
                                }
                                // 修正旧版本宽泛的 div[role='button'] 导致误点 DeepSeek 搜索功能按钮
                                if action.submit_selector.as_deref() == Some("div[role='button']:not([aria-disabled='true']), button[type='submit']") || action.submit_selector.is_none() {
                                    action.submit_selector = Some("div[role='button'][aria-label*='发送'], div[role='button'][aria-label*='Send'], button[type='submit']".to_string());
                                    modified = true;
                                }
                                if action.auto_submit.is_none() {
                                    action.auto_submit = Some(true);
                                    modified = true;
                                }
                            } else if url.contains("qianwen.com") || url.contains("tongyi.aliyun.com") || action.id == "act_web_qwen" || action.id == "act_web_tongyi" {
                                if action.input_selector.is_none() {
                                    action.input_selector = Some("textarea, div[contenteditable='true'], [contenteditable='true']".to_string());
                                    modified = true;
                                }
                                if action.submit_selector.is_none() {
                                    action.submit_selector = Some("button[class*='send'], div[class*='send'], button[class*='operate'], button[type='submit'], div[role='button'][aria-label*='发送'], div[role='button'][aria-label*='Send']".to_string());
                                    modified = true;
                                }
                                if action.auto_submit.is_none() {
                                    action.auto_submit = Some(true);
                                    modified = true;
                                }
                            } else if url.contains("kimi.moonshot.cn") || url.contains("kimi.com") || action.id == "act_web_kimi" {
                                if action.input_selector.is_none() {
                                    action.input_selector = Some("div[contenteditable='true'], textarea, [contenteditable='true']".to_string());
                                    modified = true;
                                }
                                if action.submit_selector.is_none() {
                                    action.submit_selector = Some("button[data-testid*='send'], button.send-button, div[role='button'][aria-label*='发送'], button[type='submit']".to_string());
                                    modified = true;
                                }
                                if action.auto_submit.is_none() {
                                    action.auto_submit = Some(true);
                                    modified = true;
                                }
                            } else if url.contains("claude.ai") || action.id == "act_web_claude" {
                                if action.input_selector.is_none() {
                                    action.input_selector = Some("div[contenteditable='true'], fieldset textarea".to_string());
                                    modified = true;
                                }
                                if action.submit_selector.is_none() {
                                    action.submit_selector = Some("button[aria-label='Send Message']".to_string());
                                    modified = true;
                                }
                                if action.auto_submit.is_none() {
                                    action.auto_submit = Some(true);
                                    modified = true;
                                }
                            } else if url.contains("doubao.com") || action.id == "act_web_doubao" {
                                if action.input_selector.is_none() {
                                    action.input_selector = Some("textarea[data-testid*='input'], textarea".to_string());
                                    modified = true;
                                }
                                if action.submit_selector.is_none() {
                                    action.submit_selector = Some("button[data-testid*='send']".to_string());
                                    modified = true;
                                }
                                if action.auto_submit.is_none() {
                                    action.auto_submit = Some(true);
                                    modified = true;
                                }
                            }
                        }
                    }

                    // 3. 自动向前兼容：将历史 general.api_card_size 同步至 api_card.card_size
                    if config.general.api_card_size != (600.0, 900.0) && config.api_card.card_size == (600.0, 900.0) {
                        config.api_card.card_size = config.general.api_card_size;
                        modified = true;
                    }

                    if modified {
                        let _ = config.save();
                    }

                    return config;
                }
            }
        }
        let system_lang = resolve_language("auto");
        let default_config = Self::default_for_language(system_lang);
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
    fn test_api_card_config_defaults() {
        let default_config = AppConfig::default();
        assert_eq!(default_config.api_card.card_size, (600.0, 900.0));
        assert!(!default_config.api_card.auto_pin_on_open);
        assert!(!default_config.api_card.auto_focus_input);
        assert!(default_config.api_card.thinking_default_open);
        assert!(default_config.api_card.auto_collapse_thinking_on_done);
        assert!(default_config.api_card.show_duration);
        assert_eq!(default_config.api_card.font_size, 13);
        assert!(!default_config.api_card.code_block_wrap);
        assert!(!default_config.api_card.code_block_line_numbers);
        assert_eq!(default_config.api_card.context_turns, 5);
        assert_eq!(default_config.api_card.send_key_shortcut, "Enter");
    }

    #[test]
    fn test_api_card_legacy_migration() {
        let legacy_json = r#"{
            "general": {
                "autoPopupOnSelection": true,
                "minSelectionLength": 1,
                "triggerModifier": "None",
                "globalHotkey": "Alt+Space",
                "theme": "system",
                "autoStart": false,
                "apiCardSize": [720.0, 850.0]
            },
            "blacklist": [],
            "providers": [],
            "actions": []
        }"#;
        let mut config: AppConfig = serde_json::from_str(legacy_json).expect("Deserialize legacy config");
        if config.general.api_card_size != (600.0, 900.0) && config.api_card.card_size == (600.0, 900.0) {
            config.api_card.card_size = config.general.api_card_size;
        }
        assert_eq!(config.api_card.card_size, (720.0, 850.0));
    }

    #[test]
    fn test_default_config_serialization() {
        let config = AppConfig::default();
        let json = serde_json::to_string_pretty(&config).expect("Serialize default config");
        let deserialized: AppConfig = serde_json::from_str(&json).expect("Deserialize default config");
        assert_eq!(config.general.global_hotkey, deserialized.general.global_hotkey);
        assert_eq!(deserialized.general.web_window_mode, "multi_window");
        assert_eq!(deserialized.general.overlay_opacity, 90);
        assert_eq!(deserialized.general.web_window_size, (860.0, 640.0));
        assert_eq!(deserialized.general.api_card_size, (600.0, 900.0));
        assert_eq!(deserialized.api_card.card_size, (600.0, 900.0));
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
        assert_eq!(config.general.api_card_size, (600.0, 900.0));

        let default_config = AppConfig::default();
        assert_eq!(default_config.general.overlay_opacity, 90);
        assert_eq!(default_config.general.web_window_size, (860.0, 640.0));
        assert_eq!(default_config.general.api_card_size, (600.0, 900.0));
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

    #[test]
    fn test_floating_ball_config_defaults() {
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
        let config: AppConfig = serde_json::from_str(raw_json).expect("Deserialize config without floating ball");
        assert!(config.general.enable_floating_ball);
        assert!(config.general.floating_ball_auto_hide);
        assert_eq!(config.general.floating_ball_pos, (0, 0));
    }

    #[test]
    fn test_default_provider_api_keys_are_empty() {
        let config = AppConfig::default();
        for provider in &config.providers {
            assert!(
                provider.api_key.is_empty(),
                "Provider [{}] default api_key should be empty, found: '{}'",
                provider.id,
                provider.api_key
            );
        }
    }

    #[test]
    fn test_default_provider_models_are_empty() {
        let config = AppConfig::default();
        for provider in &config.providers {
            assert!(
                provider.models.is_empty(),
                "Provider [{}] default models should be empty, found: {:?}",
                provider.id,
                provider.models
            );
            assert!(
                provider.default_model.is_empty(),
                "Provider [{}] default_model should be empty, found: '{}'",
                provider.id,
                provider.default_model
            );
        }
    }

    #[test]
    fn test_config_dir_and_path_resolution() {
        let home = AppConfig::home_dir();
        assert!(!home.as_os_str().is_empty());

        let dir_name = AppConfig::config_dir_name();
        assert_eq!(dir_name, ".iox-dev");

        let config_dir = AppConfig::config_dir();
        assert_eq!(config_dir, home.join(".iox-dev"));

        let config_path = AppConfig::config_path();
        assert_eq!(config_path, home.join(".iox-dev").join("config.json"));
    }

    #[test]
    fn test_language_config_defaults_and_backward_compatibility() {
        let default_config = AppConfig::default();
        assert_eq!(default_config.general.language, "auto");

        let legacy_json = r#"{
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
        let config: AppConfig = serde_json::from_str(legacy_json).expect("Deserialize legacy config without language");
        assert_eq!(config.general.language, "auto");
    }

    #[test]
    fn test_system_language_resolution() {
        assert_eq!(resolve_language("zh"), "zh");
        assert_eq!(resolve_language("en"), "en");
        let auto_res = resolve_language("auto");
        assert!(auto_res == "zh" || auto_res == "en");
    }

    #[test]
    fn test_default_config_for_language() {
        let zh_config = AppConfig::default_for_language("zh");
        let en_config = AppConfig::default_for_language("en");

        let zh_translate = zh_config.actions.iter().find(|a| a.id == "act_translate").expect("zh translate action");
        let en_translate = en_config.actions.iter().find(|a| a.id == "act_translate").expect("en translate action");

        assert_eq!(zh_translate.name, "翻译");
        assert_eq!(en_translate.name, "Translate");
        assert!(en_translate.prompt_template.as_ref().unwrap().contains("professional translator"));
    }

    #[test]
    fn test_kimi_legacy_url_migration() {
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
                    "id": "act_web_kimi",
                    "name": "Kimi",
                    "icon": "Kimi",
                    "actionType": "web",
                    "urlTemplate": "https://kimi.moonshot.cn/",
                    "copyToClipboard": false,
                    "enabled": true
                }
            ]
        }"#;
        let mut config: AppConfig = serde_json::from_str(raw_json).expect("Deserialize legacy kimi config");
        for action in &mut config.actions {
            if action.action_type == "web" {
                if let Some(ref mut tmpl) = action.url_template {
                    if tmpl.contains("kimi.moonshot.cn") {
                        *tmpl = "https://www.kimi.com/".to_string();
                    }
                }
            }
        }
        assert_eq!(config.actions[0].url_template.as_deref(), Some("https://www.kimi.com/"));
    }
}


