//! 站点预设常量表（单一数据源）
//!
//! 本文件是 Web Action 站点预设 URL 模板的**唯一权威定义**。
//! 前端 `src/lib/sitePresets.ts` 通过 `get_site_presets` IPC 命令读取此表，
//! 禁止在前端硬编码站点列表，以避免前后端漂移。
//!
//! 每个预设包含：
//! - `id`：稳定标识符（前端通过 id 引用，不依赖显示名匹配）
//! - `name`：显示名
//! - `url_template`：含 `{text}` 占位符的 URL 模板
//! - `category`：分类（search / ai / translate / knowledge）

use serde::{Deserialize, Serialize};

/// 单个站点预设
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SitePreset {
    /// 稳定标识符
    pub id: &'static str,
    /// 显示名
    pub name: &'static str,
    /// URL 模板，`{text}` 为占位符
    pub url_template: &'static str,
    /// 分类
    pub category: &'static str,
}

/// 站点预设表（单一数据源）
///
/// 顺序即前端展示顺序。新增站点只需在此追加一条即可，前端自动同步。
pub static SITE_PRESETS: &[SitePreset] = &[
    // ---------- AI 对话 ----------
    SitePreset {
        id: "tongyi",
        name: "通义千问",
        url_template: "https://www.qianwen.com/",
        category: "ai",
    },
    SitePreset {
        id: "doubao",
        name: "豆包",
        url_template: "https://www.doubao.com/chat/",
        category: "ai",
    },
    SitePreset {
        id: "kimi",
        name: "Kimi",
        url_template: "https://kimi.moonshot.cn/chat/",
        category: "ai",
    },
    SitePreset {
        id: "deepseek",
        name: "DeepSeek",
        url_template: "https://chat.deepseek.com/",
        category: "ai",
    },
    SitePreset {
        id: "yuanqi",
        name: "腾讯元宝",
        url_template: "https://yuanbao.tencent.com/chat",
        category: "ai",
    },
    SitePreset {
        id: "baichuan",
        name: "百小应",
        url_template: "https://www.baichuan-ai.com/chat",
        category: "ai",
    },
    // ---------- 搜索 ----------
    SitePreset {
        id: "baidu",
        name: "百度",
        url_template: "https://www.baidu.com/s?wd={text}",
        category: "search",
    },
    SitePreset {
        id: "bing",
        name: "Bing",
        url_template: "https://www.bing.com/search?q={text}",
        category: "search",
    },
    SitePreset {
        id: "google",
        name: "Google",
        url_template: "https://www.google.com/search?q={text}",
        category: "search",
    },
    SitePreset {
        id: "zhihu",
        name: "知乎",
        url_template: "https://www.zhihu.com/search?q={text}&type=content",
        category: "search",
    },
    // ---------- 翻译 ----------
    SitePreset {
        id: "deepl",
        name: "DeepL",
        url_template: "https://www.deepl.com/translator#zh/en/{text}",
        category: "translate",
    },
    SitePreset {
        id: "google_translate",
        name: "Google 翻译",
        url_template: "https://translate.google.com/?sl=zh&tl=en&text={text}&op=translate",
        category: "translate",
    },
    // ---------- 知识 ----------
    SitePreset {
        id: "wikipedia",
        name: "维基百科",
        url_template: "https://zh.wikipedia.org/w/index.php?search={text}",
        category: "knowledge",
    },
];

/// 获取全部站点预设（IPC 命令调用）
pub fn all() -> Vec<SitePreset> {
    SITE_PRESETS.iter().map(|p| SitePreset {
        id: p.id,
        name: p.name,
        url_template: p.url_template,
        category: p.category,
    }).collect()
}

/// 按 id 查找预设
pub fn find(id: &str) -> Option<&'static SitePreset> {
    SITE_PRESETS.iter().find(|p| p.id == id)
}

/// 按 id 查找 URL 模板
pub fn url_template_for(id: &str) -> Option<&'static str> {
    find(id).map(|p| p.url_template)
}
