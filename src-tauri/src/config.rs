use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

fn default_web_window_mode() -> String {
    "multi_window".to_string()
}

/// 仅修复最初发布的 MiMo 预设；设置选择器后不会再次覆盖用户的自动发送选择。
fn migrate_legacy_mimo_action(action: &mut ActionConfig) -> bool {
    let is_preset = action.id == "act_web_mimo" || action.id.starts_with("act_web_mimo_");
    if !is_preset
        || action.action_type != "web"
        || action.url_template.as_deref() != Some("https://aistudio.xiaomimimo.com/#/c")
        || action.input_selector.is_some()
        || action.submit_selector.is_some()
        || action.auto_submit != Some(false)
        || action.copy_to_clipboard != Some(true)
        || action.use_url_template == Some(true)
    {
        return false;
    }
    action.input_selector = Some("textarea".to_string());
    action.submit_selector = Some("button[data-track-id='home_send_btn']".to_string());
    action.auto_submit = Some(true);
    action.copy_to_clipboard = Some(false);
    true
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

fn default_ui_style() -> String {
    "classic".to_string()
}

/// 归一化界面样式标识：仅接受已注册的样式，未知值一律回退经典样式
pub fn normalize_ui_style(style: &str) -> String {
    match style {
        "windows" => "windows".to_string(),
        _ => "classic".to_string(),
    }
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
    #[serde(default)]
    pub auto_popup_on_file_selection: bool,
    #[serde(default = "default_file_drag_hover_delay_ms")]
    pub file_drag_hover_delay_ms: u64,
    pub min_selection_length: usize,
    pub trigger_modifier: String, // "None" | "Ctrl" | "Alt" | "Shift"
    pub global_hotkey: String,    // e.g. "Alt+Space"
    pub theme: String,            // "system" | "dark" | "light"
    /// 界面样式：`classic` (自绘圆角) | `windows` (系统标题栏 + 直角)
    #[serde(default = "default_ui_style")]
    pub ui_style: String,
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
    #[serde(default = "default_floating_ball_hide_delay_ms")]
    pub floating_ball_hide_delay_ms: u64,
    #[serde(default = "default_floating_ball_hover_delay_ms")]
    pub floating_ball_hover_delay_ms: u64,
    #[serde(default = "default_floating_ball_pos")]
    pub floating_ball_pos: (i32, i32),
    #[serde(default = "default_language")]
    pub language: String,         // "auto" | "zh" | "en"
}

fn default_file_drag_hover_delay_ms() -> u64 {
    1000
}

fn default_floating_ball_hide_delay_ms() -> u64 { 2500 }
fn default_floating_ball_hover_delay_ms() -> u64 { 220 }

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            auto_popup_on_selection: true,
            auto_popup_on_file_selection: false,
            file_drag_hover_delay_ms: default_file_drag_hover_delay_ms(),
            min_selection_length: 1,
            trigger_modifier: "None".to_string(),
            global_hotkey: "Alt+Space".to_string(),
            theme: "system".to_string(),
            ui_style: default_ui_style(),
            auto_start: false,
            web_window_mode: "multi_window".to_string(),
            auto_copy_on_web_action: false,
            overlay_opacity: 90,
            web_window_size: (860.0, 640.0),
            api_card_size: (600.0, 900.0),
            icon_only_bubble: false,
            enable_floating_ball: true,
            floating_ball_auto_hide: true,
            floating_ball_hide_delay_ms: default_floating_ball_hide_delay_ms(),
            floating_ball_hover_delay_ms: default_floating_ball_hover_delay_ms(),
            floating_ball_pos: (0, 0),
            language: "auto".to_string(),
        }
    }
}

fn default_provider_enabled() -> bool {
    true
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
    /// 旧配置没有该字段时默认启用。停用只收窄前端选择器的可选来源，
    /// 不是执行许可，已绑定该服务商的动作仍照常请求。
    #[serde(default = "default_provider_enabled")]
    pub enabled: bool,
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
                    enabled: true,
                },
                ProviderConfig {
                    id: "qwen".to_string(),
                    name: "通义千问 (DashScope)".to_string(),
                    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec![],
                    default_model: "".to_string(),
                    enabled: true,
                },
                ProviderConfig {
                    id: "ollama".to_string(),
                    name: "Ollama (本地)".to_string(),
                    base_url: "http://127.0.0.1:11434/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec![],
                    default_model: "".to_string(),
                    enabled: true,
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
                    enabled: true,
                },
                ProviderConfig {
                    id: "qwen".to_string(),
                    name: "Qwen (DashScope)".to_string(),
                    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec![],
                    default_model: "".to_string(),
                    enabled: true,
                },
                ProviderConfig {
                    id: "ollama".to_string(),
                    name: "Ollama (Local)".to_string(),
                    base_url: "http://127.0.0.1:11434/v1".to_string(),
                    api_key: "".to_string(),
                    models: vec![],
                    default_model: "".to_string(),
                    enabled: true,
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

    /// 获取 sessions.jsonl 完整路径，与 config.json 位于同一目录下
    pub fn sessions_path() -> PathBuf {
        Self::config_dir().join("sessions.jsonl")
    }
}

/// 加载时的向前兼容迁移；返回是否发生修改，由调用方决定是否写回。
fn migrate(config: &mut AppConfig) -> bool {
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
        modified |= migrate_legacy_mimo_action(action);
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

    // 4. 旧字段只作为一次性迁移输入：以新字段为准，迁移后归零。
    let default_size = default_api_card_size();
    if config.general.api_card_size != default_size {
        if config.api_card.card_size == default_size {
            config.api_card.card_size = config.general.api_card_size;
        }
        config.general.api_card_size = default_size;
        modified = true;
    }

    modified
}

/// 提交前规范化遗留字段，避免旧字段再次与 `api_card.card_size` 分叉。
fn normalize_for_commit(config: &mut AppConfig) -> bool {
    let previous = config.general.api_card_size;
    config.general.api_card_size = default_api_card_size();
    previous != config.general.api_card_size
}

/// 配置文件的完整读写规则：原子替换、迁移写回与损坏文件保全。
struct ConfigFile {
    path: PathBuf,
}

impl ConfigFile {
    fn new(path: PathBuf) -> Self {
        Self { path }
    }

    fn load(&self) -> AppConfig {
        match fs::read_to_string(&self.path) {
            Ok(content) => match serde_json::from_str::<AppConfig>(&content) {
                Ok(mut config) => {
                    if migrate(&mut config) {
                        // 迁移写回失败不阻止启动；迁移是幂等的，下次加载会重试。
                        let _ = self.save(&config);
                    }
                    config
                }
                Err(_) => self.quarantine(),
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let config = Self::defaults();
                let _ = self.save(&config);
                config
            }
            // 无法读取时保留原文件，不使用默认值覆盖未知内容。
            Err(_) => Self::defaults(),
        }
    }

    fn defaults() -> AppConfig {
        AppConfig::default_for_language(resolve_language("auto"))
    }

    /// 解析失败时先移走损坏文件；移走失败则保持原文件不变。
    fn quarantine(&self) -> AppConfig {
        let config = Self::defaults();
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_millis())
            .unwrap_or_default();
        let backup = self
            .path
            .with_file_name(format!("config.invalid-{stamp}.json"));
        if fs::rename(&self.path, &backup).is_ok() {
            let _ = self.save(&config);
        }
        config
    }

    fn save(&self, config: &AppConfig) -> Result<(), String> {
        let json = serde_json::to_string_pretty(config)
            .map_err(|error| format!("配置序列化失败: {error}"))?;
        let dir = self
            .path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        fs::create_dir_all(dir).map_err(|error| format!("配置目录创建失败: {error}"))?;

        let (temp, mut file) = create_temp_config_file(dir)?;
        let written = write_and_sync(&mut file, json.as_bytes());
        drop(file);
        let result = written
            .map_err(|error| format!("配置写入失败: {error}"))
            .and_then(|()| {
                fs::rename(&temp, &self.path)
                    .map_err(|error| format!("配置替换失败: {error}"))
            });
        if result.is_err() {
            let _ = fs::remove_file(&temp);
        }
        result
    }
}

static CONFIG_TEMP_ID: AtomicU64 = AtomicU64::new(0);

fn create_temp_config_file(dir: &Path) -> Result<(PathBuf, fs::File), String> {
    loop {
        let path = dir.join(format!(
            ".config-{}-{}.tmp",
            std::process::id(),
            CONFIG_TEMP_ID.fetch_add(1, Ordering::Relaxed)
        ));
        match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("配置临时文件创建失败: {error}")),
        }
    }
}

fn write_and_sync(file: &mut fs::File, bytes: &[u8]) -> std::io::Result<()> {
    file.write_all(bytes)?;
    file.flush()?;
    file.sync_all()
}

/// 配置提交成功后的发布出口。实现方负责广播与原生窗口效果；
/// 发布发生在提交锁内，广播顺序与提交顺序一致。
pub trait ConfigPublisher: Send + Sync {
    fn publish(&self, previous: &AppConfig, current: &AppConfig);
}

/// 进程内唯一的配置提交入口：变更意图 → 持久化 → 替换内存 → 发布。
///
/// 提交失败时内存、磁盘与广播都保持旧状态。调用方只表达变更意图，
/// 不再自行决定锁、保存、广播与窗口效果的顺序。
pub struct ConfigStore {
    file: ConfigFile,
    state: Mutex<AppConfig>,
    publisher: Box<dyn ConfigPublisher>,
}

impl ConfigStore {
    pub fn load(publisher: Box<dyn ConfigPublisher>) -> Self {
        Self::at(AppConfig::config_path(), publisher)
    }

    fn at(path: PathBuf, publisher: Box<dyn ConfigPublisher>) -> Self {
        let file = ConfigFile::new(path);
        let config = file.load();
        Self {
            file,
            state: Mutex::new(config),
            publisher,
        }
    }

    pub fn snapshot(&self) -> AppConfig {
        self.lock().clone()
    }

    pub fn try_snapshot(&self) -> Option<AppConfig> {
        self.state.try_lock().ok().map(|config| config.clone())
    }

    /// 提交一个变更意图。闭包返回 `false` 表示无需写盘。
    pub fn commit<F>(&self, intent: F) -> Result<AppConfig, String>
    where
        F: FnOnce(&mut AppConfig) -> bool,
    {
        let mut state = self.state.lock().map_err(|_| "配置不可用".to_string())?;
        let previous = state.clone();
        let mut next = previous.clone();
        let changed = intent(&mut next);
        let normalized = normalize_for_commit(&mut next);
        if !changed && !normalized {
            return Ok(next);
        }

        self.file.save(&next)?;
        *state = next.clone();
        self.publisher.publish(&previous, &next);
        Ok(next)
    }

    /// 整份提交设置页配置，与即时更新共用同一把锁与提交顺序。
    pub fn replace(&self, config: AppConfig) -> Result<AppConfig, String> {
        self.commit(move |current| {
            if *current == config {
                false
            } else {
                *current = config;
                true
            }
        })
    }

    fn lock(&self) -> MutexGuard<'_, AppConfig> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn mimo_legacy_preset_migrates_once_and_preserves_later_opt_out() {
        let mut action: super::ActionConfig = serde_json::from_value(serde_json::json!({
            "id": "act_web_mimo_123", "name": "MiMo", "icon": "Xiaomi",
            "actionType": "web", "urlTemplate": "https://aistudio.xiaomimimo.com/#/c",
            "autoSubmit": false, "copyToClipboard": true, "useUrlTemplate": false,
            "enabled": true
        })).unwrap();
        assert!(super::migrate_legacy_mimo_action(&mut action));
        assert_eq!(action.auto_submit, Some(true));
        assert_eq!(action.input_selector.as_deref(), Some("textarea"));
        assert_eq!(action.submit_selector.as_deref(), Some("button[data-track-id='home_send_btn']"));
        assert!(!super::migrate_legacy_mimo_action(&mut action));
        action.auto_submit = Some(false);
        assert!(!super::migrate_legacy_mimo_action(&mut action));
        assert_eq!(action.auto_submit, Some(false));
    }

    #[test]
    fn mimo_migration_preserves_custom_actions() {
        let action: super::ActionConfig = serde_json::from_value(serde_json::json!({
            "id": "act_web_mimo", "name": "MiMo", "icon": "Xiaomi",
            "actionType": "web", "urlTemplate": "https://aistudio.xiaomimimo.com/#/c",
            "autoSubmit": false, "copyToClipboard": true, "enabled": true
        })).unwrap();
        for variant in 0..3 {
            let mut custom = action.clone();
            match variant {
                0 => custom.id = "act_custom".into(),
                1 => custom.url_template = Some("https://example.com".into()),
                _ => custom.submit_selector = Some("button.custom-send".into()),
            }
            let original = custom.clone();
            assert!(!super::migrate_legacy_mimo_action(&mut custom));
            assert_eq!(custom, original);
        }
    }

    use super::*;

    static TEST_ID: AtomicU64 = AtomicU64::new(0);

    struct Fixture {
        root: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let root = loop {
                let candidate = std::env::temp_dir().join(format!(
                    "iox-config-test-{}-{}",
                    std::process::id(),
                    TEST_ID.fetch_add(1, Ordering::Relaxed)
                ));
                match fs::create_dir(&candidate) {
                    Ok(()) => break candidate,
                    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                    Err(error) => panic!("cannot create isolated test directory: {error}"),
                }
            };
            Self { root }
        }

        fn path(&self) -> PathBuf {
            self.root.join("config.json")
        }

        fn store(&self) -> ConfigStore {
            ConfigStore::at(self.path(), Box::new(RecordingPublisher::default()))
        }

        fn seed(&self, content: &str) {
            fs::write(self.path(), content).unwrap();
        }

        fn saved(&self) -> AppConfig {
            serde_json::from_str(&fs::read_to_string(self.path()).unwrap()).unwrap()
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[derive(Clone, Default)]
    struct RecordingPublisher {
        published: std::sync::Arc<Mutex<Vec<AppConfig>>>,
    }

    impl ConfigPublisher for RecordingPublisher {
        fn publish(&self, _previous: &AppConfig, current: &AppConfig) {
            self.published.lock().unwrap().push(current.clone());
        }
    }

    #[test]
    fn load_migrates_legacy_fields_through_the_production_entry() {
        let fixture = Fixture::new();
        fixture.seed(
            r#"{
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
                "actions": [
                    {
                        "id": "act_web_kimi",
                        "name": "Kimi",
                        "icon": "Kimi",
                        "actionType": "web_card",
                        "urlTemplate": "https://kimi.moonshot.cn/",
                        "copyToClipboard": false,
                        "enabled": true
                    }
                ]
            }"#,
        );

        let loaded = fixture.store().snapshot();

        assert_eq!(loaded.api_card.card_size, (720.0, 850.0));
        assert_eq!(loaded.general.api_card_size, default_api_card_size());
        assert_eq!(loaded.actions[0].action_type, "web");
        assert_eq!(
            loaded.actions[0].url_template.as_deref(),
            Some("https://www.kimi.com/")
        );
        // 迁移结果已通过同一次加载写回磁盘。
        assert_eq!(fixture.saved(), loaded);
    }

    #[test]
    fn corrupt_config_is_quarantined_before_defaults_are_written() {
        let fixture = Fixture::new();
        let corrupt = "{\"general\":{\"minSelectionLength\":";
        fixture.seed(corrupt);

        let loaded = fixture.store().snapshot();

        assert_eq!(loaded.general.min_selection_length, 1);
        let backup = fs::read_dir(&fixture.root)
            .unwrap()
            .filter_map(|entry| entry.ok().map(|entry| entry.path()))
            .find(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with("config.invalid-"))
            })
            .expect("corrupt config must be preserved");
        assert_eq!(fs::read_to_string(backup).unwrap(), corrupt);
        assert_eq!(fixture.saved(), loaded);
    }

    #[test]
    fn failed_persistence_keeps_memory_unchanged_and_publishes_nothing() {
        let fixture = Fixture::new();
        // 父路径是普通文件，创建目录/写入必然失败。
        let blocked_parent = fixture.root.join("blocked");
        fs::write(&blocked_parent, b"not a directory").unwrap();
        let publisher = RecordingPublisher::default();
        let published = publisher.published.clone();
        let store = ConfigStore::at(blocked_parent.join("config.json"), Box::new(publisher));
        let before = store.snapshot();

        let result = store.commit(|config| {
            config.general.min_selection_length = 5;
            true
        });

        assert!(result.is_err());
        assert_eq!(store.snapshot(), before);
        assert!(published.lock().unwrap().is_empty());
    }

    #[test]
    fn concurrent_commits_persist_and_publish_in_commit_order() {
        let fixture = Fixture::new();
        let publisher = RecordingPublisher::default();
        let published = publisher.published.clone();
        let store = std::sync::Arc::new(ConfigStore::at(fixture.path(), Box::new(publisher)));
        let start = std::sync::Arc::new(std::sync::Barrier::new(8));

        let threads: Vec<_> = (0..8)
            .map(|_| {
                let store = store.clone();
                let start = start.clone();
                std::thread::spawn(move || {
                    start.wait();
                    for _ in 0..20 {
                        store
                            .commit(|config| {
                                config.general.min_selection_length += 1;
                                true
                            })
                            .unwrap();
                    }
                })
            })
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }

        let snapshot = store.snapshot();
        assert_eq!(snapshot.general.min_selection_length, 1 + 8 * 20);
        assert_eq!(fixture.saved(), snapshot);

        let events = published.lock().unwrap();
        assert_eq!(events.len(), 8 * 20);
        let lengths: Vec<_> = events
            .iter()
            .map(|config| config.general.min_selection_length)
            .collect();
        assert!(lengths.windows(2).all(|pair| pair[1] == pair[0] + 1));
    }

    #[test]
    fn successful_commit_publishes_only_after_disk_commit() {
        struct DiskCheckingPublisher {
            path: PathBuf,
        }

        impl ConfigPublisher for DiskCheckingPublisher {
            fn publish(&self, _previous: &AppConfig, current: &AppConfig) {
                let disk: AppConfig =
                    serde_json::from_str(&fs::read_to_string(&self.path).unwrap()).unwrap();
                assert_eq!(&disk, current);
            }
        }

        let fixture = Fixture::new();
        let store = ConfigStore::at(
            fixture.path(),
            Box::new(DiskCheckingPublisher {
                path: fixture.path(),
            }),
        );

        store
            .commit(|config| {
                config.general.ui_style = "windows".to_string();
                true
            })
            .unwrap();
        assert_eq!(store.snapshot().general.ui_style, "windows");
    }

    #[test]
    fn no_op_commit_neither_writes_nor_publishes() {
        let fixture = Fixture::new();
        let publisher = RecordingPublisher::default();
        let published = publisher.published.clone();
        let store = ConfigStore::at(fixture.path(), Box::new(publisher));
        let before = fs::read_to_string(fixture.path()).unwrap();

        store.commit(|_| false).unwrap();

        assert_eq!(fs::read_to_string(fixture.path()).unwrap(), before);
        assert!(published.lock().unwrap().is_empty());
    }

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
    fn provider_enabled_defaults_to_true_for_legacy_config() {
        let provider: ProviderConfig = serde_json::from_value(serde_json::json!({
            "id": "legacy",
            "name": "Legacy",
            "baseUrl": "https://example.com/v1",
            "apiKey": "key",
            "models": ["model"],
            "defaultModel": "model"
        }))
        .unwrap();

        assert!(provider.enabled);
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
        let fixture = Fixture::new();
        fixture.seed(legacy_json);
        let config = fixture.store().snapshot();
        assert_eq!(config.api_card.card_size, (720.0, 850.0));
        // 旧字段迁移后归零，不再与新字段双写。
        assert_eq!(config.general.api_card_size, default_api_card_size());
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
        let fixture = Fixture::new();
        fixture.seed(raw_json);
        let config = fixture.store().snapshot();
        assert_eq!(config.general.web_window_mode, "multi_window");
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
    fn test_sessions_path_matches_config_dir() {
        let config_path = AppConfig::config_path();
        let sessions_path = AppConfig::sessions_path();

        assert_eq!(
            config_path.parent(),
            sessions_path.parent(),
            "sessions.jsonl 必须与 config.json 处于同一目录下"
        );
        assert_eq!(
            sessions_path.file_name().and_then(|n| n.to_str()),
            Some("sessions.jsonl"),
            "文件名必须为 sessions.jsonl"
        );
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
        let fixture = Fixture::new();
        fixture.seed(raw_json);
        let config = fixture.store().snapshot();
        assert_eq!(config.actions[0].url_template.as_deref(), Some("https://www.kimi.com/"));
    }
}



#[cfg(test)]
mod file_selection_config_tests {
    #[test]
    fn floating_ball_delays_support_legacy_configs_and_round_trip() {
        let mut json = serde_json::to_value(super::AppConfig::default()).unwrap();
        json["general"].as_object_mut().unwrap().remove("floatingBallHideDelayMs");
        json["general"].as_object_mut().unwrap().remove("floatingBallHoverDelayMs");
        let legacy: super::AppConfig = serde_json::from_value(json).unwrap();
        assert_eq!(legacy.general.floating_ball_hide_delay_ms, 2500);
        assert_eq!(legacy.general.floating_ball_hover_delay_ms, 220);
        let mut json = serde_json::to_value(legacy).unwrap();
        json["general"]["floatingBallHideDelayMs"] = serde_json::json!(4200);
        json["general"]["floatingBallHoverDelayMs"] = serde_json::json!(800);
        let custom: super::AppConfig = serde_json::from_value(json).unwrap();
        let saved = serde_json::to_value(custom).unwrap();
        assert_eq!(saved["general"]["floatingBallHideDelayMs"], 4200);
        assert_eq!(saved["general"]["floatingBallHoverDelayMs"], 800);
    }

    #[test]
    fn file_drag_hover_delay_defaults_for_legacy_configs_and_round_trips() {
        let mut json = serde_json::to_value(super::AppConfig::default()).unwrap();
        assert_eq!(json["general"]["fileDragHoverDelayMs"], 1000);
        json["general"].as_object_mut().unwrap().remove("fileDragHoverDelayMs");
        let legacy: super::AppConfig = serde_json::from_value(json).unwrap();
        let mut json = serde_json::to_value(legacy).unwrap();
        assert_eq!(json["general"]["fileDragHoverDelayMs"], 1000);
        json["general"]["fileDragHoverDelayMs"] = serde_json::json!(650);
        let custom: super::AppConfig = serde_json::from_value(json).unwrap();
        assert_eq!(serde_json::to_value(custom).unwrap()["general"]["fileDragHoverDelayMs"], 650);
    }

    #[test]
    fn ui_style_defaults_for_legacy_configs_and_normalizes_unknown_values() {
        let mut json = serde_json::to_value(super::AppConfig::default()).unwrap();
        assert_eq!(json["general"]["uiStyle"], "classic");
        json["general"].as_object_mut().unwrap().remove("uiStyle");
        let legacy: super::AppConfig = serde_json::from_value(json).unwrap();
        assert_eq!(legacy.general.ui_style, "classic");
        assert_eq!(super::normalize_ui_style("windows"), "windows");
        assert_eq!(super::normalize_ui_style("unknown-style"), "classic");
    }

    #[test]
    fn file_selection_is_opt_in_for_new_and_legacy_configs() {
        let mut json = serde_json::to_value(super::AppConfig::default()).unwrap();
        assert_eq!(json["general"]["autoPopupOnFileSelection"], false);
        json["general"].as_object_mut().unwrap().remove("autoPopupOnFileSelection");
        let legacy: super::AppConfig = serde_json::from_value(json).unwrap();
        assert_eq!(serde_json::to_value(legacy).unwrap()["general"]["autoPopupOnFileSelection"], false);
    }
}
