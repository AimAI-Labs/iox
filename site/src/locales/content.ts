export type Locale = "zh" | "en";

export interface PlaceholderSpec {
  id: string;
  src: string;
  aspectRatio: string;
  dimensions: string;
  label: string;
  hint: string;
}

export interface FeatureItem {
  id: string;
  badge: string;
  title: string;
  description: string;
  bullets: string[];
  placeholder: PlaceholderSpec;
  spanWide?: boolean;
}

export interface WorkflowStep {
  step: string;
  title: string;
  subtitle: string;
  detail: string;
  tag: string;
}

export interface EcosystemItem {
  name: string;
  category: string;
  protocol: string;
  models: string;
}

export interface SiteContent {
  nav: {
    brandSubtitle: string;
    links: { label: string; href: string }[];
    langSwitch: string;
    github: string;
    download: string;
  };
  hero: {
    eyebrow: string;
    titleMuted: string;
    titleInk: string;
    subline: string;
    primaryCta: string;
    secondaryCta: string;
    placeholderNote: string;
    ecosystemLabel: string;
  };
  showcase: {
    sectionTag: string;
    title: string;
    subtitle: string;
    placeholder: PlaceholderSpec;
    metrics: { value: string; label: string; note: string }[];
  };
  features: {
    sectionTag: string;
    title: string;
    subtitle: string;
    items: FeatureItem[];
  };
  workflow: {
    sectionTag: string;
    title: string;
    subtitle: string;
    steps: WorkflowStep[];
  };
  ecosystem: {
    sectionTag: string;
    title: string;
    subtitle: string;
    apiTab: string;
    webTab: string;
    items: EcosystemItem[];
    highlights: { title: string; body: string }[];
  };
  cta: {
    tag: string;
    titleMuted: string;
    titleInk: string;
    subtitle: string;
    downloadNsis: string;
    downloadPortable: string;
    systemReq: string;
  };
  footer: {
    tagline: string;
    placeholderGuideTitle: string;
    placeholderGuideText: string;
    copyright: string;
  };
}

export const SITE_CONTENT: Record<Locale, SiteContent> = {
  zh: {
    nav: {
      brandSubtitle: "Input / Output Extension",
      links: [
        { label: "产品预览", href: "#showcase" },
        { label: "核心特性", href: "#features" },
        { label: "工作流", href: "#workflow" },
        { label: "模型生态", href: "#ecosystem" },
      ],
      langSwitch: "EN",
      github: "GitHub",
      download: "下载 Windows 版",
    },
    hero: {
      eyebrow: "Tauri v2 · Rust 2021 · React 19",
      titleMuted: "划词即达，无感唤醒。",
      titleInk: "重塑桌面 AI 交互延伸。",
      subline:
        "不是另一个臃肿的聊天窗口，而是潜入每一次阅读、编码与创作的零失焦原生层。",
      primaryCta: "获取 IOX 桌面端",
      secondaryCta: "探索核心架构",
      placeholderNote: "site/assets/HAND_SHEET.png",
      ecosystemLabel: "原生支持 OpenAI 兼容协议与主流 AI 官网直达",
    },
    showcase: {
      sectionTag: "01 / 桌面原生形态",
      title: "隐于光标之下，显于思绪之间",
      subtitle:
        "气泡与流式卡片共用单实例原生悬浮层，严格保护宿主窗口焦点与系统剪贴板序列。",
      placeholder: {
        id: "overview",
        src: "/placeholders/preview-overview-placeholder.svg",
        aspectRatio: "16 / 10",
        dimensions: "1600 × 960",
        label: "全局划词气泡 → 原地流式卡片全景预览图（占位）",
        hint: "替换路径：site/public/placeholders/preview-overview-placeholder.svg",
      },
      metrics: [
        {
          value: "WS_EX_NOACTIVATE",
          label: "零失焦弹出",
          note: "宿主编辑器与 PDF 选区高亮绝不丢失",
        },
        {
          value: "< 15 ms",
          label: "原生钩子响应",
          note: "低级鼠标/键盘钩子 + UI Automation 选区检测",
        },
        {
          value: "SQLite WAL",
          label: "本地事务存储",
          note: "blake3 内容哈希去重 + 可选 PostgreSQL 双向同步",
        },
        {
          value: "Dual Engine",
          label: "API + Web 双擎",
          note: "SSE 原地思考链流式卡片与无头 WebView2 官网容器",
        },
      ],
    },
    features: {
      sectionTag: "02 / 核心能力矩阵",
      title: "克制而精密的四大输入输出扩展",
      subtitle:
        "所有功能模块均围绕最小化上下文切换构建，配图区域已预置标准化占位容器，后续可直接替换静态图或演示动图。",
      items: [
        {
          id: "zero-focus-bubble",
          badge: "INPUT · 全局划词与防误触",
          title: "四重过滤与零污染剪贴板取词",
          description:
            "结合位移阈值、有效字符、修饰键与进程黑名单精准识别划词意图；取词前备份并在毫秒级还原剪贴板序列，保护终端与富文本工作流。",
          bullets: [
            "UI Automation 选区探测 + 受保护 Ctrl+C 兜底",
            "进程拾取器一键框选排除指定桌面应用",
            "支持纯图标紧凑模式与自适应气泡宽度",
          ],
          placeholder: {
            id: "feature-bubble",
            src: "/placeholders/feature-bubble-placeholder.svg",
            aspectRatio: "16 / 10",
            dimensions: "960 × 600",
            label: "零失焦划词胶囊与防误触过滤示意图（占位）",
            hint: "site/public/placeholders/feature-bubble-placeholder.svg",
          },
        },
        {
          id: "streaming-card",
          badge: "API ENGINE · 原地流式问答",
          title: "多标签会话、深度思考链与公式高亮",
          description:
            "基于 OpenAI 兼容 SSE 流式传输，原生解析 DeepSeek R1 等推理模型的思考过程，支持 KaTeX 数学公式、代码高亮与卡片内选区引用追问。",
          bullets: [
            "多标签工作区独立维护生成状态与保存修订",
            "支持 Classic 自绘外框与 Windows 原生外框切换",
            "内置上下文用量仪表盘与服务商余额查询",
          ],
          placeholder: {
            id: "feature-card",
            src: "/placeholders/feature-card-placeholder.svg",
            aspectRatio: "16 / 10",
            dimensions: "960 × 600",
            label: "API 流式卡片、思考链折叠与多轮追问截图（占位）",
            hint: "site/public/placeholders/feature-card-placeholder.svg",
          },
        },
        {
          id: "headless-web",
          badge: "WEB ENGINE · 官网直达与无头模式",
          title: "内置 WebView2 官网容器与环绕快捷圆盘",
          description:
            "复用已登录的 ChatGPT、Claude、DeepSeek、通义千问、Kimi 等官网会话；开启无头模式后网页占满圆角客户区，通过悬浮按钮与扇形环绕菜单轻盈操控。",
          bullets: [
            "支持独立窗口（Multi-window）与统一标签中心（Tabbed Hub）",
            "DOM 注入适配器自动填入划选文本或执行 URL 模板",
            "支持采集并检索各 AI 官网历史会话缓存",
          ],
          placeholder: {
            id: "feature-web",
            src: "/placeholders/feature-web-placeholder.svg",
            aspectRatio: "16 / 10",
            dimensions: "960 × 600",
            label: "Web 无头模式圆角窗口与悬浮扇形快捷操作图（占位）",
            hint: "site/public/placeholders/feature-web-placeholder.svg",
          },
        },
        {
          id: "file-drag",
          badge: "ATTACHMENT · 全局文件拖拽",
          title: "悬停唤醒 OLE 投放菜单，附件直传官网",
          description:
            "按住资源管理器中的文件拖拽悬停即可呼出 AI 投放菜单，松手后自动拉起目标 AI 官网并经专用上传适配器注入附件，告别繁琐的手动上传。",
          bullets: [
            "支持 Ctrl / Shift 多文件拖拽（单次最多 10 个文件 / 20 MiB）",
            "单击选中文件绝不误触，ESC 或移出区域即刻取消",
            "严格校验站点来源，不向无关页面注入脚本",
          ],
          placeholder: {
            id: "feature-file-drag",
            src: "/placeholders/feature-file-drag-placeholder.svg",
            aspectRatio: "16 / 10",
            dimensions: "960 × 600",
            label: "全局文件拖拽悬停菜单与官网附件注入示意图（占位）",
            hint: "site/public/placeholders/feature-file-drag-placeholder.svg",
          },
        },
      ],
    },
    workflow: {
      sectionTag: "03 / 交互闭环",
      title: "三步完成从输入感知到智能输出",
      subtitle:
        "从底层 Win32 消息循环到前端结构化会话状态机，每一处边界都经过竞态与焦点验证。",
      steps: [
        {
          step: "STEP 01",
          title: "全局感知 · 划词或拖入文件",
          subtitle: "Selection / File Drag Hook",
          detail:
            "在任意编辑器、浏览器或阅读器中划选文本，或拖拽本地文档悬停 1 秒，通过 trigger.rs 修饰键与黑名单过滤后精准触发。",
          tag: "selection.rs · file_drag.rs",
        },
        {
          step: "STEP 02",
          title: "瞬时呼出 · 零失焦胶囊分流",
          subtitle: "No-Activate Bubble Surface",
          detail:
            "光标旁平滑浮现操作胶囊，可直接输入补充指令、一键复制，或选择触发 API 流式动作与内置 Web 官网动作。",
          tag: "overlay.rs · overlayReducer.ts",
        },
        {
          step: "STEP 03",
          title: "深度沉淀 · 流式追问与本地归档",
          subtitle: "Structured Workspace & Sync",
          detail:
            "原地展开卡片进行多轮追问与固定（Pin）对照，会话自动通过 SQLite 事务去重保存，并可按需同步至私有 PostgreSQL。",
          tag: "workspace.ts · chat_store",
        },
      ],
    },
    ecosystem: {
      sectionTag: "04 / 开放模型生态",
      title: "自有 API 密钥与主流 AI 官网无缝兼得",
      subtitle:
        "遵循显式默认模型 → 首个非空模型的确定性解析策略，支持一键拉取服务商模型列表与连通性测试。",
      apiTab: "OpenAI 兼容 API 服务商",
      webTab: "内置 WebView2 官网适配器",
      items: [
        {
          name: "DeepSeek",
          category: "API & 官网直达",
          protocol: "OpenAI SSE / DOM Adapter",
          models: "deepseek-chat · deepseek-reasoner (R1)",
        },
        {
          name: "OpenAI / ChatGPT",
          category: "API & 官网直达",
          protocol: "OpenAI SSE / DOM Adapter",
          models: "gpt-4o · o3-mini · gpt-4.1",
        },
        {
          name: "Anthropic Claude",
          category: "兼容网关 & 官网直达",
          protocol: "OpenAI Gateway / DOM Adapter",
          models: "claude-3-7-sonnet · claude-3-5-haiku",
        },
        {
          name: "通义千问 Qwen",
          category: "阿里云百炼 & 官网直达",
          protocol: "DashScope Compatible / Web",
          models: "qwen-max · qwen-plus · qwq-32b",
        },
        {
          name: "Google Gemini",
          category: "兼容端点 & 官网直达",
          protocol: "OpenAI Endpoint / Web Adapter",
          models: "gemini-2.5-pro · gemini-2.5-flash",
        },
        {
          name: "Ollama / vLLM",
          category: "本地离线私有部署",
          protocol: "Localhost OpenAI API",
          models: "llama3.3 · qwen2.5-coder · deepseek-r1",
        },
      ],
      highlights: [
        {
          title: "桌面常驻悬浮球与全局热键",
          body: "除划词唤醒外，可通过可吸附悬浮球或自定义快捷键直接呼出空白问答卡片与历史会话窗口。",
        },
        {
          title: "本地优先与可选远程镜像",
          body: "默认全部会话保存在本地 %USERPROFILE%/.iox/sessions.db，支持配置私有 PostgreSQL 跨设备后写胜出（LWW）同步。",
        },
      ],
    },
    cta: {
      tag: "READY FOR WINDOWS 10 / 11",
      titleMuted: "告别频繁切窗复制，",
      titleInk: "让 AI 回归指尖直觉。",
      subtitle:
        "开源免费，MIT 协议发布。内置 WebView2 运行时复用，安装包轻量纯净。",
      downloadNsis: "下载安装版 (.exe)",
      downloadPortable: "下载便携版 (.zip)",
      systemReq: "系统要求：Windows 10 / 11 (x64) · 内置 WebView2 环境",
    },
    footer: {
      tagline: "IOX — 基于 Tauri v2 + Rust + React 19 的 Windows 全局划词 AI 助手。",
      placeholderGuideTitle: "占位图片替换说明",
      placeholderGuideText:
        "当前页面所有视觉配图均位于 site/public/placeholders/ 目录下，保持相同文件名或更新 src/locales/content.ts 即可完成替换。",
      copyright: "© 2026 AimAI-Labs. Released under the MIT License.",
    },
  },
  en: {
    nav: {
      brandSubtitle: "Input / Output Extension",
      links: [
        { label: "Showcase", href: "#showcase" },
        { label: "Features", href: "#features" },
        { label: "Workflow", href: "#workflow" },
        { label: "Ecosystem", href: "#ecosystem" },
      ],
      langSwitch: "中文",
      github: "GitHub",
      download: "Download for Windows",
    },
    hero: {
      eyebrow: "Tauri v2 · Rust 2021 · React 19",
      titleMuted: "Select to Invoke.",
      titleInk: "Zero-Focus Desktop AI.",
      subline:
        "Not another bloated chat window. A native extension woven silently into your reading, coding, and writing flow.",
      primaryCta: "Get IOX for Windows",
      secondaryCta: "Explore Architecture",
      placeholderNote: "Hero dot-matrix sprite placeholder: /public/placeholders/hand-sheet-placeholder.svg",
      ecosystemLabel: "Natively supports OpenAI-compatible APIs and official Web AI portals",
    },
    showcase: {
      sectionTag: "01 / NATIVE OVERLAY SURFACE",
      title: "Hidden Beneath the Cursor, Ready at a Thought",
      subtitle:
        "Bubble bar and streaming card share a single native overlay surface, preserving host window focus and clipboard sequence integrity.",
      placeholder: {
        id: "overview",
        src: "/placeholders/preview-overview-placeholder.svg",
        aspectRatio: "16 / 10",
        dimensions: "1600 × 960",
        label: "Global Selection Bubble → Streaming Card Overview (Placeholder)",
        hint: "Replace at: site/public/placeholders/preview-overview-placeholder.svg",
      },
      metrics: [
        {
          value: "WS_EX_NOACTIVATE",
          label: "Zero Focus Stealing",
          note: "Never disrupts active editor caret or PDF text highlights",
        },
        {
          value: "< 15 ms",
          label: "Native Hook Latency",
          note: "Low-level Win32 hooks paired with UI Automation detection",
        },
        {
          value: "SQLite WAL",
          label: "Transactional Store",
          note: "blake3 deduplication + optional PostgreSQL bi-directional sync",
        },
        {
          value: "Dual Engine",
          label: "API + Web Actions",
          note: "In-place SSE reasoning cards & headless WebView2 portals",
        },
      ],
    },
    features: {
      sectionTag: "02 / CAPABILITY MATRIX",
      title: "Four Precision Extensions Built for Flow",
      subtitle:
        "Every module minimizes context switching. Visual frames below use standardized placeholder assets ready for drop-in replacement.",
      items: [
        {
          id: "zero-focus-bubble",
          badge: "INPUT · SMART SELECTION HOOK",
          title: "Quad-Layer Filtering & Clipboard Guard",
          description:
            "Combines drag distance, character validation, modifier keys, and process blacklists. Backs up and restores clipboard sequence numbers in milliseconds.",
          bullets: [
            "UI Automation text range detection with protected Ctrl+C fallback",
            "Visual process picker to exclude specific desktop apps in one click",
            "Icon-only compact mode with adaptive bubble width calculation",
          ],
          placeholder: {
            id: "feature-bubble",
            src: "/placeholders/feature-bubble-placeholder.svg",
            aspectRatio: "16 / 10",
            dimensions: "960 × 600",
            label: "Zero-Focus Selection Bubble & Guard Wireframe (Placeholder)",
            hint: "site/public/placeholders/feature-bubble-placeholder.svg",
          },
        },
        {
          id: "streaming-card",
          badge: "API ENGINE · IN-PLACE STREAMING",
          title: "Multi-Tab Chat, Reasoning Chains & KaTeX",
          description:
            "Streams OpenAI-compatible SSE responses with collapsible DeepSeek R1 reasoning blocks, KaTeX math rendering, syntax highlighting, and quote follow-ups.",
          bullets: [
            "Structured workspace tracking generation IDs and save revisions",
            "Switchable Classic custom frame and native Windows frame styles",
            "Built-in context token meter and provider balance inquiry",
          ],
          placeholder: {
            id: "feature-card",
            src: "/placeholders/feature-card-placeholder.svg",
            aspectRatio: "16 / 10",
            dimensions: "960 × 600",
            label: "Streaming API Card & Collapsible Reasoning View (Placeholder)",
            hint: "site/public/placeholders/feature-card-placeholder.svg",
          },
        },
        {
          id: "headless-web",
          badge: "WEB ENGINE · HEADLESS PORTALS",
          title: "Embedded WebView2 Hub & Radial Quick Menu",
          description:
            "Reuse authenticated sessions on ChatGPT, Claude, DeepSeek, Qwen, and Kimi. Headless mode fills the rounded client area with a draggable radial menu.",
          bullets: [
            "Supports standalone windows and unified Tabbed Hub mode",
            "DOM injection adapters populate prompts and attachments automatically",
            "Collects and indexes official web chat history locally",
          ],
          placeholder: {
            id: "feature-web",
            src: "/placeholders/feature-web-placeholder.svg",
            aspectRatio: "16 / 10",
            dimensions: "960 × 600",
            label: "Headless WebView2 Portal & Radial Quick Actions (Placeholder)",
            hint: "site/public/placeholders/feature-web-placeholder.svg",
          },
        },
        {
          id: "file-drag",
          badge: "ATTACHMENT · GLOBAL FILE DRAG",
          title: "Hover-Triggered OLE Drop Menu to Web AI",
          description:
            "Drag files from Explorer and hold for 1 second to summon the AI drop target menu. Release on a target to open the portal and inject attachments.",
          bullets: [
            "Multi-file Ctrl/Shift selection (up to 10 files / 20 MiB per drop)",
            "Single-click file selection never false-triggers; Esc cancels immediately",
            "Strict origin verification before executing upload adapters",
          ],
          placeholder: {
            id: "feature-file-drag",
            src: "/placeholders/feature-file-drag-placeholder.svg",
            aspectRatio: "16 / 10",
            dimensions: "960 × 600",
            label: "Global File Drag Hover Menu & Upload Adapter (Placeholder)",
            hint: "site/public/placeholders/feature-file-drag-placeholder.svg",
          },
        },
      ],
    },
    workflow: {
      sectionTag: "03 / INTERACTION LOOP",
      title: "From Input Sensing to Structured Output in Three Steps",
      subtitle:
        "Engineered across Win32 hooks and React 19 state reducers to eliminate cross-boundary focus and generation races.",
      steps: [
        {
          step: "STEP 01",
          title: "Sense · Select Text or Drag Files",
          subtitle: "Selection / File Drag Hook",
          detail:
            "Highlight text in any app or hold dragged files for 1s. Validated through modifier and process filters in trigger.rs.",
          tag: "selection.rs · file_drag.rs",
        },
        {
          step: "STEP 02",
          title: "Dispatch · Zero-Focus Capsule Bubble",
          subtitle: "No-Activate Bubble Surface",
          detail:
            "Summon the floating capsule beside your cursor to add custom instructions, copy, or trigger an API / Web action.",
          tag: "overlay.rs · overlayReducer.ts",
        },
        {
          step: "STEP 03",
          title: "Persist · Stream, Pin & Sync",
          subtitle: "Structured Workspace & Sync",
          detail:
            "Pin the card for side-by-side reading, ask multi-turn follow-ups, and persist deduplicated sessions in SQLite with optional PG sync.",
          tag: "workspace.ts · chat_store",
        },
      ],
    },
    ecosystem: {
      sectionTag: "04 / MODEL ECOSYSTEM",
      title: "Bring Your Own API Key or Use Official Web Sessions",
      subtitle:
        "Deterministic provider/model resolution with one-click model discovery and connectivity checks.",
      apiTab: "OpenAI-Compatible Providers",
      webTab: "WebView2 Site Adapters",
      items: [
        {
          name: "DeepSeek",
          category: "API & Web Portal",
          protocol: "OpenAI SSE / DOM Adapter",
          models: "deepseek-chat · deepseek-reasoner (R1)",
        },
        {
          name: "OpenAI / ChatGPT",
          category: "API & Web Portal",
          protocol: "OpenAI SSE / DOM Adapter",
          models: "gpt-4o · o3-mini · gpt-4.1",
        },
        {
          name: "Anthropic Claude",
          category: "Gateway & Web Portal",
          protocol: "OpenAI Gateway / DOM Adapter",
          models: "claude-3-7-sonnet · claude-3-5-haiku",
        },
        {
          name: "Qwen (Tongyi)",
          category: "DashScope & Web Portal",
          protocol: "DashScope Compatible / Web",
          models: "qwen-max · qwen-plus · qwq-32b",
        },
        {
          name: "Google Gemini",
          category: "Compatible API & Web",
          protocol: "OpenAI Endpoint / Web Adapter",
          models: "gemini-2.5-pro · gemini-2.5-flash",
        },
        {
          name: "Ollama / vLLM",
          category: "Local Offline Deployment",
          protocol: "Localhost OpenAI API",
          models: "llama3.3 · qwen2.5-coder · deepseek-r1",
        },
      ],
      highlights: [
        {
          title: "Desktop Floating Ball & Global Hotkeys",
          body: "Summon the AI card or session history anytime via the magnetic desktop floating ball or customizable global shortcuts.",
        },
        {
          title: "Local-First SQLite with Optional PG Sync",
          body: "All history lives in %USERPROFILE%/.iox/sessions.db by default, with optional Last-Write-Wins PostgreSQL mirroring across machines.",
        },
      ],
    },
    cta: {
      tag: "READY FOR WINDOWS 10 / 11",
      titleMuted: "Stop Alt-Tabbing to Chat.",
      titleInk: "Keep AI at Your Cursor.",
      subtitle:
        "Free and open-source under the MIT License. Powered by native Rust and Windows WebView2.",
      downloadNsis: "Download Installer (.exe)",
      downloadPortable: "Download Portable (.zip)",
      systemReq: "Requires Windows 10 / 11 (x64) · WebView2 Runtime",
    },
    footer: {
      tagline: "IOX — Windows Global Selection AI Assistant built with Tauri v2, Rust & React 19.",
      placeholderGuideTitle: "Placeholder Asset Guide",
      placeholderGuideText:
        "All placeholder illustrations reside in site/public/placeholders/. Replace the files directly or update paths in src/locales/content.ts.",
      copyright: "© 2026 AimAI-Labs. Released under the MIT License.",
    },
  },
};
