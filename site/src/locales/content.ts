export type Locale = "zh" | "en";

export interface PlaceholderSpec {
  id: string;
  src: string;
  aspectRatio: string;
  dimensions: string;
  label: string;
  hint: string;
}

export interface CardSpecimenItem {
  id: string;
  plateNo: string;
  inkAccent: "cobalt" | "terracotta";
  badge: string;
  title: string;
  outcome: string;
  description: string;
  bullets: string[];
  statValue: string;
  statLabel: string;
  placeholder: PlaceholderSpec;
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

export interface FaqItem {
  question: string;
  answer: string;
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
    titleMuted: string;
    titleInk: string;
    subline: string;
    primaryCta: string;
    ecosystemLabel: string;
  };
  tagline: {
    indexLabel: string;
    words: string[];
    caption: string;
  };
  deck: {
    sectionTag: string;
    title: string;
    subtitle: string;
    scrollHint: string;
    drawStatusLabel: string;
    cards: CardSpecimenItem[];
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
    items: EcosystemItem[];
    highlights: { code: string; title: string; body: string }[];
  };
  faq: {
    sectionTag: string;
    title: string;
    subtitle: string;
    items: FaqItem[];
  };
  cta: {
    tag: string;
    titleMuted: string;
    titleInk: string;
    subtitle: string;
    riskReversal: string;
    downloadNsis: string;
    downloadPortable: string;
    systemReq: string;
  };
  footer: {
    tagline: string;
    recipeNote: string;
    placeholderGuideTitle: string;
    placeholderGuideText: string;
    privacyLabel: string;
    termsLabel: string;
    copyright: string;
  };
}

export const SITE_CONTENT: Record<Locale, SiteContent> = {
  zh: {
    nav: {
      brandSubtitle: "Input / Output Extension",
      links: [
        { label: "牌组预览", href: "#showcase" },
        { label: "交互机制", href: "#workflow" },
        { label: "模型生态", href: "#ecosystem" },
        { label: "常见问题", href: "#faq" },
      ],
      langSwitch: "EN",
      github: "GitHub",
      download: "下载 Windows 版",
    },
    hero: {
      titleMuted: "划词即达，无感唤醒。",
      titleInk: "重塑桌面 AI 交互延伸。",
      subline:
        "不是另一个臃肿的聊天窗口，而是潜入每一次阅读、编码与创作的零失焦原生层。",
      primaryCta: "获取 IOX 桌面端",
      ecosystemLabel: "原生支持 OpenAI 兼容协议与主流 AI 官网直达",
    },
    tagline: {
      indexLabel: "PRINT SPECIMEN · MANIFESTO",
      words: [
        "每一次切换窗口复制粘贴，",
        "都在打断深度思考的连续性。",
        "IOX",
        "将模型推理与官网容器",
        "直接锚定在你的系统光标旁，",
        "让焦点始终留在正文中。",
      ],
      caption: "向下滚动进入单墨色印刷线框标本馆 · MONO COLOR WIREFRAME EDITION",
    },
    deck: {
      sectionTag: "01 / 滚轮抽卡标本展示",
      title: "五张核心印版，层层抽解桌面 AI 工作流",
      subtitle:
        "滚动鼠标滚轮或点击下方印版编号，逐张抽出预览 IOX 的底层交互线框标本。",
      scrollHint: "SCROLL TO DRAW SPECIMEN CARDS",
      drawStatusLabel: "当前抽选印版",
      cards: [
        {
          id: "plate-overview",
          plateNo: "PLATE 01 / 05",
          inkAccent: "cobalt",
          badge: "OVERLAY SURFACE · 单实例共生层",
          title: "隐于光标之下，显于思绪之间",
          outcome: "将跨软件问答耗时从 15 秒缩短至 1 秒以内",
          description:
            "划词胶囊与流式问答卡片共用同一个原生悬浮窗口，由 Rust 统一调度尺寸、定位与输入焦点接管。",
          bullets: [
            "气泡态严格保持无激活样式，宿主编辑器选区绝不闪烁",
            "转为卡片态时平滑接管输入，支持钉住窗口对照阅读",
            "自动感知多显示器 DPI 缩放与屏幕边缘避障",
          ],
          statValue: "< 15 ms",
          statLabel: "钩子唤醒延迟",
          placeholder: {
            id: "overview",
            src: "/placeholders/preview-overview-placeholder.svg",
            aspectRatio: "3 / 2",
            dimensions: "1200 × 800",
            label: "PLATE 01 · 全局划词气泡与流式卡片共生总览",
            hint: "site/public/placeholders/preview-overview-placeholder.svg",
          },
        },
        {
          id: "plate-bubble",
          plateNo: "PLATE 02 / 05",
          inkAccent: "terracotta",
          badge: "SELECTION HOOK · 四重防误触与取词保护",
          title: "精准识别划词意图，毫秒级还原剪贴板",
          outcome: "零焦点抢占，零剪贴板历史污染",
          description:
            "结合欧氏位移距离、有效字符校验、修饰键状态与进程黑名单过滤，仅在真实划选文本时呼出操作胶囊。",
          bullets: [
            "优先通过 UI Automation 读取选区，受保护复制通道自动兜底",
            "取词前后校验剪贴板序列号，瞬間恢复原有文本内容",
            "内置可视化进程拾取器，一键框选排除指定桌面软件",
          ],
          statValue: "0 Focus Loss",
          statLabel: "WS_EX_NOACTIVATE",
          placeholder: {
            id: "feature-bubble",
            src: "/placeholders/feature-bubble-placeholder.svg",
            aspectRatio: "3 / 2",
            dimensions: "1200 × 800",
            label: "PLATE 02 · 零失焦划词胶囊与防误触几何线框",
            hint: "site/public/placeholders/feature-bubble-placeholder.svg",
          },
        },
        {
          id: "plate-card",
          plateNo: "PLATE 03 / 05",
          inkAccent: "cobalt",
          badge: "API ENGINE · 原地流式推理工作区",
          title: "多标签并发会话、思考链折叠与公式渲染",
          outcome: "在当前代码或论文旁直接完成深度推导",
          description:
            "基于 OpenAI 兼容 SSE 流式传输，原生解析 DeepSeek R1 等模型的思考过程，支持数学公式、代码高亮与选区引用追问。",
          bullets: [
            "每个标签页独立维护生成代次与数据库保存修订号",
            "支持选中回答片段一键添加为引用上下文继续追问",
            "内置上下文 Token 用量仪表与服务商账户余额查询",
          ],
          statValue: "200 Sessions",
          statLabel: "SQLite 事务去重归档",
          placeholder: {
            id: "feature-card",
            src: "/placeholders/feature-card-placeholder.svg",
            aspectRatio: "3 / 2",
            dimensions: "1200 × 800",
            label: "PLATE 03 · 流式问答卡片与思考链折叠线框",
            hint: "site/public/placeholders/feature-card-placeholder.svg",
          },
        },
        {
          id: "plate-web",
          plateNo: "PLATE 04 / 05",
          inkAccent: "terracotta",
          badge: "WEB ENGINE · 无头官网容器与环绕快捷盘",
          title: "直接复用主流 AI 官网登录态与免费额度",
          outcome: "无需配置 API Key 即可调用顶尖模型",
          description:
            "在内置 WebView2 容器中通过 DOM 注入适配器自动填入划选文本；开启无头模式后网页占满圆角窗口，由悬浮圆盘轻盈操控。",
          bullets: [
            "支持独立窗口模式与多站点聚合的统一标签中心",
            "悬停 250 毫秒展开扇形快捷按钮，长按可切换整窗拖动",
            "支持采集并本地缓存各 AI 官网的历史会话列表",
          ],
          statValue: "250 ms",
          statLabel: "扇形快捷圆盘唤醒",
          placeholder: {
            id: "feature-web",
            src: "/placeholders/feature-web-placeholder.svg",
            aspectRatio: "3 / 2",
            dimensions: "1200 × 800",
            label: "PLATE 04 · WebView2 无头圆角窗口与环绕菜单线框",
            hint: "site/public/placeholders/feature-web-placeholder.svg",
          },
        },
        {
          id: "plate-file-drag",
          plateNo: "PLATE 05 / 05",
          inkAccent: "cobalt",
          badge: "OLE DROP TARGET · 全局文件拖拽直传",
          title: "拖拽文件悬停一秒，附件自动注入目标官网",
          outcome: "省去打开浏览器、寻找入口、手动选择文件的繁琐步骤",
          description:
            "按住桌面或资源管理器中的文件拖拽并停留 1 秒即可呼出投放菜单，松手后自动打开对应 AI 官网并上传附件。",
          bullets: [
            "支持多选拖拽，单次最多投递 10 个文件、合计 20 MiB",
            "单击选中文件绝不误触，按 Esc 或移出菜单区域即刻取消",
            "严格校验目标站点来源，绝不向无关网页注入上传脚本",
          ],
          statValue: "10 Files / 20 MiB",
          statLabel: "单次 OLE 附件投递",
          placeholder: {
            id: "feature-file-drag",
            src: "/placeholders/feature-file-drag-placeholder.svg",
            aspectRatio: "3 / 2",
            dimensions: "1200 × 800",
            label: "PLATE 05 · 全局文件拖拽悬停菜单与上传线框",
            hint: "site/public/placeholders/feature-file-drag-placeholder.svg",
          },
        },
      ],
    },
    workflow: {
      sectionTag: "02 / 交互机制信息表",
      title: "三步完成从输入感知到结构化沉淀",
      subtitle:
        "从底层 Win32 消息循环到前端状态机，每一处跨边界交互均经过竞态与焦点校验。",
      steps: [
        {
          step: "STEP 01",
          title: "全局感知 · 划选文本或拖拽文件",
          subtitle: "Selection & File Drag Hook",
          detail:
            "在任意编辑器、浏览器或阅读器中划选文本，或拖拽本地文件悬停 1 秒，经修饰键与进程黑名单校验后精准触发。",
          tag: "selection.rs · file_drag.rs",
        },
        {
          step: "STEP 02",
          title: "瞬时呼出 · 零失焦胶囊动作分流",
          subtitle: "No Activate Bubble Surface",
          detail:
            "光标旁浮现极简胶囊，可附加临时指令、一键复制，或直接分流至 API 流式卡片与内置 WebView2 官网窗口。",
          tag: "overlay.rs · overlayReducer.ts",
        },
        {
          step: "STEP 03",
          title: "深度沉淀 · 多轮追问与事务归档",
          subtitle: "Structured Workspace & Sync",
          detail:
            "原地钉住卡片进行多轮引用追问，会话通过 SQLite 单事务与 blake3 哈希去重保存，并支持可选 PostgreSQL 远程镜像。",
          tag: "workspace.ts · chat_store",
        },
      ],
    },
    ecosystem: {
      sectionTag: "03 / 开放模型与官网档案",
      title: "自有 API 密钥与主流 AI 官网无缝兼得",
      subtitle:
        "遵循显式默认模型到首个非空模型的确定性解析策略，支持一键拉取服务商模型列表与连通性测试。",
      items: [
        {
          name: "DeepSeek",
          category: "API 与官网直达",
          protocol: "OpenAI SSE / DOM Adapter",
          models: "deepseek chat · deepseek reasoner",
        },
        {
          name: "OpenAI / ChatGPT",
          category: "API 与官网直达",
          protocol: "OpenAI SSE / DOM Adapter",
          models: "gpt 4o · o3 mini · gpt 4.1",
        },
        {
          name: "Anthropic Claude",
          category: "兼容网关与官网直达",
          protocol: "OpenAI Gateway / DOM Adapter",
          models: "claude 3.7 sonnet · claude 3.5 haiku",
        },
        {
          name: "通义千问 Qwen",
          category: "百炼 API 与官网直达",
          protocol: "DashScope Compatible / Web",
          models: "qwen max · qwen plus · qwq 32b",
        },
        {
          name: "Google Gemini",
          category: "兼容端点与官网直达",
          protocol: "OpenAI Endpoint / Web Adapter",
          models: "gemini 2.5 pro · gemini 2.5 flash",
        },
        {
          name: "Ollama / vLLM",
          category: "本地离线私有部署",
          protocol: "Localhost OpenAI API",
          models: "llama 3.3 · qwen 2.5 coder · deepseek r1",
        },
      ],
      highlights: [
        {
          code: "ARCHIVE SPECIMEN A · FLOATING ENTRY",
          title: "桌面常驻悬浮球与全局快捷键",
          body: "除划词唤醒外，可通过磁性吸附悬浮球或自定义热键直接呼出空白问答卡片与双模历史会话检索窗口。",
        },
        {
          code: "ARCHIVE SPECIMEN B · LOCAL FIRST SYNC",
          title: "本地 SQLite 真源与可选 PostgreSQL 镜像",
          body: "默认全部会话保存在本地 sessions.db，断网完全可用；开启远程同步后支持跨设备后写胜出合并与墓碑清理。",
        },
      ],
    },
    faq: {
      sectionTag: "04 / 常见疑虑解答",
      title: "关于焦点、隐私与系统开销的技术事实",
      subtitle: "所有回答均对应仓库真实源码实现，不含任何虚构承诺。",
      items: [
        {
          question: "划词弹出气泡时，会导致当前编辑器或 PDF 阅读器失去焦点吗？",
          answer:
            "不会。气泡态严格注入 Win32 WS_EX_NOACTIVATE 扩展样式，展示与定位过程绝不抢夺宿主窗口焦点，选区高亮与光标位置完整保留。",
        },
        {
          question: "剪贴板取词会覆盖我原本复制的内容吗？",
          answer:
            "IOX 优先通过 Windows UI Automation 接口直接读取选区；当回退至受保护的 Ctrl+C 取词时，会在触发前备份文本并校验剪贴板序列号，取词后毫秒级恢复原文本。",
        },
        {
          question: "我的 API Key 和对话历史保存在哪里？会上传到第三方服务器吗？",
          answer:
            "所有配置与会话历史均保存在本机用户目录下的 config.json 与 sessions.db（SQLite）中。除非您主动配置并开启私有 PostgreSQL 同步，数据绝不离开本机。",
        },
        {
          question: "没有购买 API Key 可以直接使用吗？",
          answer:
            "可以。通过 Web 动作引擎，您可以直接在内置 WebView2 窗口中登录并使用 DeepSeek、ChatGPT、Claude、通义千问、Kimi 等官网的免费额度，划选文本会自动注入输入框。",
        },
        {
          question: "在终端、游戏或特定软件中如何避免划词误触？",
          answer:
            "IOX 内置终端保护逻辑与进程黑名单，您可以在设置页使用可视化进程拾取器直接框选目标窗口将其排除，或配置必须按住指定修饰键才触发。",
        },
        {
          question: "软件是否免费？安装包体积与系统要求如何？",
          answer:
            "IOX 遵循 MIT 开源协议完全免费提供。基于 Rust 与系统内置 WebView2 构建，支持 Windows 10 与 Windows 11 64 位系统，提供安装版与解压即用的便携版。",
        },
      ],
    },
    cta: {
      tag: "WINDOWS 10 / 11 · MIT OPEN SOURCE",
      titleMuted: "告别切窗复制，",
      titleInk: "让 AI 回归指尖直觉。",
      subtitle:
        "开源免费，本地 SQLite 隐私存储，内置 WebView2 轻量复用。",
      riskReversal: "MIT 开源协议 · 无需注册账号 · 本地数据完全自主可控",
      downloadNsis: "下载安装版 (.exe)",
      downloadPortable: "下载便携版 (.zip)",
      systemReq: "运行环境：Windows 10 / 11 (x64) · WebView2 Runtime",
    },
    footer: {
      tagline: "IOX · 基于 Tauri v2、Rust 与 React 19 构建的 Windows 全局划词 AI 助手。",
      recipeNote:
        "RECIPE · Substrate: Warm Paper #F5F1E8 · Inks: Charcoal #30343A (80%) + Cobalt #2148B8 / Terracotta #C65F38 (20%) · Process: Wireframe & Halftone Plate",
      placeholderGuideTitle: "线框占位图片替换指南",
      placeholderGuideText:
        "页面中 5 张印版预览图均位于 site/public/placeholders/ 目录，直接覆盖同名文件即可替换为真实产品截图。",
      privacyLabel: "本地隐私说明",
      termsLabel: "MIT 开源许可",
      copyright: "© 2026 AimAI Labs. Released under the MIT License.",
    },
  },
  en: {
    nav: {
      brandSubtitle: "Input / Output Extension",
      links: [
        { label: "Specimens", href: "#showcase" },
        { label: "Workflow", href: "#workflow" },
        { label: "Ecosystem", href: "#ecosystem" },
        { label: "FAQ", href: "#faq" },
      ],
      langSwitch: "中文",
      github: "GitHub",
      download: "Download for Windows",
    },
    hero: {
      titleMuted: "Select to Invoke.",
      titleInk: "Zero Focus Desktop AI.",
      subline:
        "Not another bloated chat window. A native extension woven silently into your reading, coding, and writing flow.",
      primaryCta: "Get IOX for Windows",
      ecosystemLabel: "Natively supports OpenAI compatible APIs and official Web AI portals",
    },
    tagline: {
      indexLabel: "PRINT SPECIMEN · MANIFESTO",
      words: [
        "Every",
        "window",
        "switch",
        "breaks",
        "your",
        "train",
        "of",
        "thought.",
        "IOX",
        "anchors",
        "streaming",
        "reasoning",
        "and",
        "web",
        "portals",
        "right",
        "beside",
        "your",
        "cursor",
        "while",
        "preserving",
        "host",
        "focus.",
      ],
      caption: "SCROLL FOR MONO COLOR WIREFRAME SPECIMENS · WARM PAPER EDITION",
    },
    deck: {
      sectionTag: "01 / SCROLL CARD DRAW SHOWCASE",
      title: "Five Wireframe Plates Engineered for Flow",
      subtitle:
        "Scroll down or click any plate index below to draw each wireframe specimen from the stack.",
      scrollHint: "SCROLL TO DRAW SPECIMEN CARDS",
      drawStatusLabel: "ACTIVE SPECIMEN PLATE",
      cards: [
        {
          id: "plate-overview",
          plateNo: "PLATE 01 / 05",
          inkAccent: "cobalt",
          badge: "OVERLAY SURFACE · SINGLE INSTANCE",
          title: "Hidden Beneath the Cursor, Ready at a Thought",
          outcome: "Cut cross app lookup time from 15 seconds to under 1 second",
          description:
            "Selection bubble and streaming card share a single native overlay surface, coordinated by Rust for DPI scaling and focus policy.",
          bullets: [
            "Bubble state enforces no activate style so editor highlights stay intact",
            "Card state smoothly acquires focus when clicked and supports window pinning",
            "Automatic multi monitor DPI adaptation and screen edge collision avoidance",
          ],
          statValue: "< 15 ms",
          statLabel: "Hook Wake Latency",
          placeholder: {
            id: "overview",
            src: "/placeholders/preview-overview-placeholder.svg",
            aspectRatio: "3 / 2",
            dimensions: "1200 × 800",
            label: "PLATE 01 · Overlay Surface & Streaming Card Specimen",
            hint: "site/public/placeholders/preview-overview-placeholder.svg",
          },
        },
        {
          id: "plate-bubble",
          plateNo: "PLATE 02 / 05",
          inkAccent: "terracotta",
          badge: "SELECTION HOOK · QUAD LAYER GUARD",
          title: "Precision Selection Detection & Clipboard Guard",
          outcome: "Zero stolen focus and zero clipboard history pollution",
          description:
            "Combines drag distance, character validation, modifier keys, and process blacklists before summoning the floating action capsule.",
          bullets: [
            "Reads selections via UI Automation first with protected copy fallback",
            "Verifies clipboard sequence numbers and restores prior text in milliseconds",
            "Visual process picker excludes specific desktop apps in one click",
          ],
          statValue: "0 Focus Loss",
          statLabel: "WS_EX_NOACTIVATE",
          placeholder: {
            id: "feature-bubble",
            src: "/placeholders/feature-bubble-placeholder.svg",
            aspectRatio: "3 / 2",
            dimensions: "1200 × 800",
            label: "PLATE 02 · Zero Focus Capsule & Euclidean Guard Wireframe",
            hint: "site/public/placeholders/feature-bubble-placeholder.svg",
          },
        },
        {
          id: "plate-card",
          plateNo: "PLATE 03 / 05",
          inkAccent: "cobalt",
          badge: "API ENGINE · STREAMING WORKSPACE",
          title: "Multi Tab Sessions, Reasoning Chains & KaTeX",
          outcome: "Verify complex code and math proofs right beside your source file",
          description:
            "Streams OpenAI compatible SSE responses with collapsible DeepSeek R1 reasoning blocks, KaTeX math rendering, and quote follow ups.",
          bullets: [
            "Independent generation IDs and database save revisions per tab",
            "Highlight any answer snippet to quote and ask multi turn follow ups",
            "Built in context token usage meter and provider balance inquiry",
          ],
          statValue: "200 Sessions",
          statLabel: "Transactional SQLite Store",
          placeholder: {
            id: "feature-card",
            src: "/placeholders/feature-card-placeholder.svg",
            aspectRatio: "3 / 2",
            dimensions: "1200 × 800",
            label: "PLATE 03 · Streaming API Card & Reasoning Wireframe",
            hint: "site/public/placeholders/feature-card-placeholder.svg",
          },
        },
        {
          id: "plate-web",
          plateNo: "PLATE 04 / 05",
          inkAccent: "terracotta",
          badge: "WEB ENGINE · HEADLESS PORTALS",
          title: "Embedded WebView2 Hub & Radial Quick Disc",
          outcome: "Use official web AI sessions immediately without API keys",
          description:
            "Reuse authenticated sessions on ChatGPT, Claude, DeepSeek, Qwen, and Kimi. Headless mode fills the rounded window with a radial menu.",
          bullets: [
            "Switch between standalone portal windows and unified Tabbed Hub",
            "Hover 250ms on the floating button to fan out pinned quick actions",
            "Locally indexes and caches official web chat session history",
          ],
          statValue: "250 ms",
          statLabel: "Radial Action Fan Out",
          placeholder: {
            id: "feature-web",
            src: "/placeholders/feature-web-placeholder.svg",
            aspectRatio: "3 / 2",
            dimensions: "1200 × 800",
            label: "PLATE 04 · Headless WebView2 & Radial Disc Wireframe",
            hint: "site/public/placeholders/feature-web-placeholder.svg",
          },
        },
        {
          id: "plate-file-drag",
          plateNo: "PLATE 05 / 05",
          inkAccent: "cobalt",
          badge: "OLE DROP TARGET · GLOBAL FILE DRAG",
          title: "Hold Dragged Files for One Second to Upload",
          outcome: "Send local documents to web AI portals in a single drag gesture",
          description:
            "Drag files from Explorer and hold for 1 second to summon the AI drop target menu. Release to open the portal and inject attachments.",
          bullets: [
            "Supports multi file selection up to 10 files and 20 MiB per drop",
            "Single click file selection never false triggers; Esc cancels immediately",
            "Strict origin verification before executing upload adapters",
          ],
          statValue: "10 Files / 20 MiB",
          statLabel: "OLE Drop Payload",
          placeholder: {
            id: "feature-file-drag",
            src: "/placeholders/feature-file-drag-placeholder.svg",
            aspectRatio: "3 / 2",
            dimensions: "1200 × 800",
            label: "PLATE 05 · Global File Drag Hover Menu Wireframe",
            hint: "site/public/placeholders/feature-file-drag-placeholder.svg",
          },
        },
      ],
    },
    workflow: {
      sectionTag: "02 / RULED INFORMATION POSTER",
      title: "Three Steps from Input Sensing to Archive",
      subtitle:
        "Engineered across Win32 hooks and React 19 reducers to eliminate focus and generation race conditions.",
      steps: [
        {
          step: "STEP 01",
          title: "Sense · Select Text or Drag Files",
          subtitle: "Selection & File Drag Hook",
          detail:
            "Highlight text in any desktop app or hold dragged files for 1 second. Validated through modifier and process filters.",
          tag: "selection.rs · file_drag.rs",
        },
        {
          step: "STEP 02",
          title: "Dispatch · Zero Focus Capsule",
          subtitle: "No Activate Bubble Surface",
          detail:
            "Summon the floating capsule beside your cursor to attach custom prompts, copy, or trigger an API or Web action.",
          tag: "overlay.rs · overlayReducer.ts",
        },
        {
          step: "STEP 03",
          title: "Persist · Stream, Pin & Sync",
          subtitle: "Structured Workspace & Sync",
          detail:
            "Pin the card for side by side reading, ask multi turn follow ups, and persist deduplicated sessions in SQLite.",
          tag: "workspace.ts · chat_store",
        },
      ],
    },
    ecosystem: {
      sectionTag: "03 / ARCHIVAL PLATE MATRIX",
      title: "Bring Your Own API Key or Use Official Web Sessions",
      subtitle:
        "Deterministic model resolution with one click model discovery and connectivity verification.",
      items: [
        {
          name: "DeepSeek",
          category: "API & Web Portal",
          protocol: "OpenAI SSE / DOM Adapter",
          models: "deepseek chat · deepseek reasoner",
        },
        {
          name: "OpenAI / ChatGPT",
          category: "API & Web Portal",
          protocol: "OpenAI SSE / DOM Adapter",
          models: "gpt 4o · o3 mini · gpt 4.1",
        },
        {
          name: "Anthropic Claude",
          category: "Gateway & Web Portal",
          protocol: "OpenAI Gateway / DOM Adapter",
          models: "claude 3.7 sonnet · claude 3.5 haiku",
        },
        {
          name: "Qwen (Tongyi)",
          category: "DashScope & Web Portal",
          protocol: "DashScope Compatible / Web",
          models: "qwen max · qwen plus · qwq 32b",
        },
        {
          name: "Google Gemini",
          category: "Compatible API & Web",
          protocol: "OpenAI Endpoint / Web Adapter",
          models: "gemini 2.5 pro · gemini 2.5 flash",
        },
        {
          name: "Ollama / vLLM",
          category: "Local Offline Runtime",
          protocol: "Localhost OpenAI API",
          models: "llama 3.3 · qwen 2.5 coder · deepseek r1",
        },
      ],
      highlights: [
        {
          code: "ARCHIVE SPECIMEN A · FLOATING ENTRY",
          title: "Magnetic Desktop Floating Ball & Global Hotkeys",
          body: "Summon the AI card or session history anytime via the dockable desktop floating ball or customizable global shortcuts.",
        },
        {
          code: "ARCHIVE SPECIMEN B · LOCAL FIRST SYNC",
          title: "Local SQLite Truth with Optional PostgreSQL Mirror",
          body: "All history lives in local sessions.db by default, with optional Last Write Wins PostgreSQL mirroring across devices.",
        },
      ],
    },
    faq: {
      sectionTag: "04 / TECHNICAL FAQ",
      title: "Verified Facts on Focus, Privacy & Footprint",
      subtitle: "Every answer reflects the actual Rust and React implementation in this repository.",
      items: [
        {
          question: "Does the selection bubble steal focus from my active editor or PDF viewer?",
          answer:
            "Never. The bubble surface applies the Win32 WS_EX_NOACTIVATE extended style, ensuring your active caret and text highlight remain untouched.",
        },
        {
          question: "Will capturing selected text overwrite my system clipboard?",
          answer:
            "IOX queries Windows UI Automation first. When falling back to protected Ctrl+C capture, it backs up text, checks clipboard sequence numbers, and restores your clipboard within milliseconds.",
        },
        {
          question: "Where are my API keys and chat history stored?",
          answer:
            "Everything is stored locally in your user profile under config.json and sessions.db (SQLite). Nothing leaves your machine unless you explicitly configure a private PostgreSQL sync database.",
        },
        {
          question: "Can I use IOX without paying for API keys?",
          answer:
            "Yes. Web actions let you sign into official portals like DeepSeek, ChatGPT, Claude, and Qwen inside the built in WebView2 container and inject selected text automatically.",
        },
        {
          question: "How do I prevent accidental triggers in terminals or games?",
          answer:
            "Built in terminal guards and process blacklists filter out unwanted triggers. You can use the visual process picker to exclude any window in one click or require modifier keys.",
        },
        {
          question: "Is IOX free and what are the system requirements?",
          answer:
            "IOX is free and open source under the MIT License. It runs on 64 bit Windows 10 and Windows 11 using the native WebView2 runtime.",
        },
      ],
    },
    cta: {
      tag: "WINDOWS 10 / 11 · MIT OPEN SOURCE",
      titleMuted: "Stop Switching Windows.",
      titleInk: "Keep AI at Your Cursor.",
      subtitle:
        "Free and open source under the MIT License. Local SQLite storage with native Rust performance.",
      riskReversal: "MIT Licensed · No Account Required · 100% Local Data Ownership",
      downloadNsis: "Download Installer (.exe)",
      downloadPortable: "Download Portable (.zip)",
      systemReq: "Requires Windows 10 / 11 (x64) · WebView2 Runtime",
    },
    footer: {
      tagline: "IOX · Windows Global Selection AI Assistant built with Tauri v2, Rust & React 19.",
      recipeNote:
        "RECIPE · Substrate: Warm Paper #F5F1E8 · Inks: Charcoal #30343A (80%) + Cobalt #2148B8 / Terracotta #C65F38 (20%) · Process: Wireframe & Halftone Plate",
      placeholderGuideTitle: "Wireframe Placeholder Guide",
      placeholderGuideText:
        "All 5 specimen plates reside in site/public/placeholders/. Replace the SVG files directly to swap in product screenshots.",
      privacyLabel: "Local Privacy Policy",
      termsLabel: "MIT License",
      copyright: "© 2026 AimAI Labs. Released under the MIT License.",
    },
  },
};
