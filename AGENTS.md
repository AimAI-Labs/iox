# IOX 开发与协作规范

本文件说明当前代码组织、状态归属与验证要求。实现细节以源码、`package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 为准；历史 README、设计文档和审查报告可能滞后。

## 1. 项目现状

**IOX (Input/Output Extension)** 是基于 **Tauri v2 + Rust + React 19** 的 Windows 全局划词 AI 助手与桌面扩展。

- **文本输入**：通过全局鼠标/键盘钩子感知划词，结合位移、有效字符、修饰键、前台进程过滤及 UI Automation 选区检测防止误触；取词使用受保护的 `Ctrl+C` 流程。
- **API 动作**：OpenAI 兼容 SSE 请求，支持思考内容、Markdown、公式、代码高亮、多轮追问、多标签及本地会话历史。
- **Web 动作**：在内置 WebView2 官网窗口中通过 URL 模板或 DOM 注入传递输入，支持独立窗口与统一标签窗口；登录状态属于内置 WebView 环境。`copy` 是独立动作类型。
- **文件拖拽**：可选的全局文件拖拽悬停菜单，将附件交给官网上传适配器；该功能默认关闭，不等同于单击选中文件即触发。
- **桌面入口**：常驻悬浮球、全局快捷键、托盘、设置页，以及 API/Web 两类会话历史入口。
- **界面**：暗色/浅色/跟随系统，中英双语；`classic` 自绘外框与 `windows` 原生外框两种样式。

气泡与 API 卡片共用一个 `overlay` 窗口；整个应用还包含 `main` 设置窗口、`floating_ball` 悬浮球，以及动态创建的官网窗口和子 WebView。

## 2. 技术栈与开发环境

| 范围 | 当前配置 |
| --- | --- |
| 原生端 | Rust 2021、Tauri 2、Tokio、reqwest 0.12、eventsource-stream、serde |
| Windows 集成 | `windows` / `windows-sys`、Win32 钩子与窗口样式、COM/UI Automation/OLE、arboard |
| 前端 | React 19、TypeScript 5.8、Vite 7、Tailwind CSS 3.4、Zod 4 |
| 内容与界面 | react-markdown、remark/rehype、KaTeX、lowlight、Lucide、LobeHub Icons、Sonner |
| 工具 | Node.js 22（`mise.toml`）、pnpm 11.20.0（`packageManager`）、Rust stable/MSVC |

开发与原生验证以 Windows 为目标，需要可用的 MSVC 构建工具和 WebView2 运行环境。前端 `@/` 别名指向 `src/`。Vite 固定使用 `1420` 端口，端口被占用时会直接失败。

## 3. 目录与职责

```text
iox/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json             # 静态窗口、开发入口、NSIS 打包配置
│   ├── capabilities/default.json   # Tauri 窗口/WebView/opener 权限
│   └── src/
│       ├── main.rs / lib.rs        # 入口、应用状态、IPC 注册与初始化
│       ├── config.rs               # 配置默认值/迁移/文件读写、ConfigStore 提交
│       ├── trigger.rs              # 文本/文件输入共用的修饰键与进程过滤
│       ├── selection.rs            # 全局钩子、选区检测、剪贴板取词
│       ├── overlay.rs              # 原生悬浮窗形态、Pin、输入接管与退场政策
│       ├── window_manager.rs       # Win32 样式、焦点、DPI、定位、尺寸与原生拖动
│       ├── file_drag.rs            # 文件拖拽与悬停检测
│       ├── file_selection.rs       # OLE 投放目标、文件菜单与输入载荷
│       ├── picker.rs / tray.rs     # 进程拾取器、托盘入口
│       ├── ai/
│       │   ├── requests.rs         # AiManager：请求受理、替换、取消与终结
│       │   ├── stream.rs           # HTTP/SSE 传输、服务商与模型解析
│       │   ├── models.rs           # 服务商模型发现
│       │   ├── web_action.rs       # 官网独立窗口/标签窗口与动作调度
│       │   ├── vendors/            # 各官网 DOM 注入适配器
│       │   ├── file_upload.rs      # 官网附件准备与上传脚本
│       │   └── scripts.rs / template.rs # 注入脚本、提示词与 URL 模板
│       ├── chat_store.rs           # API 会话查询、去重、保存与删除
│       ├── chat_store/jsonl.rs     # 严格读取、临时文件与替换提交
│       ├── chat_store/tests.rs     # 文件事务、故障注入与并发测试
│       ├── web_sessions.rs         # 官网会话缓存、校验与打开
│       ├── web_history_sync.rs     # 官网历史同步协调
│       ├── web_history_collector.js # 官网历史 DOM 采集脚本
│       ├── site_presets.rs         # 官网预设与能力信息
│       └── link_metadata.rs        # 回答外链的元信息
├── src/
│   ├── App.tsx / main.tsx          # 按窗口标签/查询参数分发视图
│   ├── App.css                    # 全局与悬浮界面样式
│   ├── components/
│   │   ├── overlay/               # OverlaySurface、气泡、卡片、悬浮球、文件菜单等
│   │   ├── settings/              # 设置与 API/Web 历史；actions/ 管理动作表单
│   │   ├── web/                   # 官网标题栏与 Hub 标签栏
│   │   ├── ui/                    # 通用界面组件
│   │   └── common/                # 共用视觉组件
│   ├── conversation/
│   │   ├── workspace.ts           # 对话、标签、生成与保存修订的状态拥有者
│   │   ├── transcript.ts          # 结构化轮次、请求上下文与持久化投影
│   │   └── legacyTranscript.ts    # 旧版 streamText 的兼容边界
│   ├── state/overlayReducer.ts    # 悬浮窗展示状态与气泡输入缓冲
│   ├── hooks/                     # 配置、流请求、历史、窗口生命周期与事件适配
│   ├── lib/                       # actionStreamClient、服务商规则、文件/链接等纯逻辑
│   ├── types/                     # Zod 配置契约、结构化会话与官网历史类型
│   ├── themes/                    # 样式策略注册表、Provider、CSS tokens
│   ├── locales/                   # zh/en 翻译
│   └── utils/bubbleWidth.ts       # 气泡自适应宽度计算
├── tests/                         # Node 测试、受控适配器、浏览器夹具与手动脚本
├── scripts/                       # 官网历史采集与 UI 验证脚本
├── .github/workflows/release.yml # Windows NSIS 与便携 ZIP 发布
└── docs/                          # 本地规格、计划、架构与审查记录（当前被 Git 忽略）
```

`src/components/ui/bui/` 当前被 `tsconfig.json` 排除，不应当作已纳入生产类型检查的组件入口。新增生产组件优先复用现有 `ui/` 与主题策略。

## 4. 架构与修改约束

### 4.1 状态归属

保持 KISS/YAGNI；修改前先确定状态归属，避免在组件、hook 和原生层各存一份同义状态。

| 状态/政策 | 归属 |
| --- | --- |
| 已提交配置与提交顺序 | Rust `ConfigStore`；`useConfig` 负责前端校验、读取与订阅 |
| 原生窗口接管、Pin 与退场政策 | `overlay.rs`；`window_manager.rs` 执行窗口操作 |
| 前端展示、文件菜单与气泡输入 | `overlayReducer`；`useOverlayState` 组合各适配器 |
| 对话标签、结构化轮次、generation、保存修订 | `conversation/workspace.ts` |
| 请求身份与 IPC/事件生命周期 | Rust `ai/requests.rs` 与前端 `lib/actionStreamClient.ts` |
| 历史查询与保存传输 | `useChatSessions`；文件事务由 Rust `chat_store` 负责 |

`App.tsx` 只做视图分发。只有 `OverlaySurface` 挂载 `useOverlayState` 等悬浮生命周期，避免设置页、官网标题栏或悬浮球重复订阅划词与流事件。

### 4.2 悬浮窗、焦点与输入

- 前端形态为 `bubble | card`，隐藏通过 `visible` 表示。常见路径是隐藏 → 划词气泡 → API 卡片 → 退场；文件输入在气泡形态展示菜单，其他入口也可以直接打开卡片。
- 气泡必须保持 `WS_EX_NOACTIVATE`，展示和定位不得抢夺宿主焦点。卡片按显式交互及 `apiCard.autoFocusInput` 配置决定焦点；形态、尺寸和 `allowFocus` 通过 `layout_overlay` 一起提交。
- 原生政策保护“可见且固定的卡片”，阻止新文本/文件接管及被动退场；用户主动关闭是独立意图。隐藏后的 Pin 偏好不能阻挡下一次输入。
- 改动退场流程时，检查原生事件、前端动画定时器、隐藏 IPC 与后端兜底之间的交错，覆盖新输入到达和 Pin 状态变化。仅验证某一层的关闭代次，不能证明跨边界竞态已经消除。
- 文本与文件输入共用 `trigger.rs` 的过滤规则。剪贴板取词当前仅备份/恢复文本，不保证图片、文件列表、富文本或剪贴板历史的完整还原；保留终端保护、互斥与剪贴板序列号校验。
- Win32/COM/OLE 改动应使用现有包装，在 `unsafe` 附近说明资源生命周期与调用前提，保证句柄释放、线程要求及 DPI 坐标单位一致。

### 4.3 流请求与对话

- `trigger_api_action`、`cancel_action` 和 `action-stream-token/done/error` 使用 `actionId + requestId` 关联。前端先建立监听，再提交请求；取消必须指向具体请求。
- `AiManager` 对同一动作的新请求终结旧请求，`RequestHandle` 校验内部身份；取消、替换、错误和正常完成只能终结一次，终结后不得继续接受 token。
- `actionStreamClient` 管理受理、取消、迟到事件与 detach；`useActionStream` 连接传输和 workspace。不要把请求竞态处理重新散落到渲染组件。
- `generationId`、保存 `ticket`、持久化 `sessionId` 各有用途，不得混用。旧 generation 的 token 和旧保存回执不能修改新的对话状态。
- 视图读取结构化 `Conversation`/`ConversationTurn`。旧 `streamText` 编码只用于兼容读写，集中经 `transcript.ts` / `legacyTranscript.ts` 转换，不在视图中重新解析。
- 保存成功须以 Rust 返回的 canonical ID 确认对应修订；保存失败应保留未保存状态并提供可见反馈。关闭、重置、删除或切换时要检查未完成生成和待保存内容。
- 服务商/模型解析保持前后端一致：显式默认模型 → 首个非空模型 → 未配置。服务商 `enabled` 只控制选择器来源，不阻断已绑定动作；缺失服务商不应静默回退到其他账号。

### 4.4 官网、样式与文案

- Web 动作类型为 `web`，旧 `web_card` 由迁移兼容；窗口模式为 `multi_window | tabbed`。按已有窗口、Hub 状态与注入取消机制扩展功能。
- Web 卡片无头模式由 `general.webHeadlessMode` 控制，默认关闭；独立窗口和 Hub 共用 `web_chrome.rs` 布局，开启后网页占满客户区，本地 `_bar` WebView 改为可拖动的悬浮菜单，承接导航栏与标签操作。配置切换不得重建或导航官网内容。
- Web 菜单位置与带修订号的原生布局由 `web_chrome.rs` 持有，前端 `webChromeClient` 先订阅再读取并过滤迟到回执；原生回调只读已提交政策的原子投影，不在 `ConfigStore` 发布期间重入配置锁。WebView 裁切与层级操作必须定位并校验确切的子 HWND，不通过屏幕坐标猜测内容视图，也不把本地菜单权限授予官网页面。
- 各官网的选择器、输入与提交差异集中在 `ai/vendors/`；修改预设时核对 Rust `site_presets.rs` 与前端 `lib/sitePresets.ts`。附件注入及历史采集需保持来源校验，不向无关站点注入内容。
- 官网历史通过采集与缓存呈现，不等同于 API 本地对话历史；未知日期保留未知语义，不能用同步时间伪造会话时间。
- 界面优先使用 `themes/registry.ts`、`tokens.css` 和现有组件，兼顾两种外框及暗浅背景。新增文案同步更新 `locales/zh.ts` 与 `locales/en.ts`。
- 新增窗口、WebView 或原生能力时，同时检查 Tauri 配置、capabilities 与 `App.tsx` 分流。

## 5. 配置与持久化

### 5.1 实际路径

配置根目录由 `AppConfig::home_dir()` 与 `config_dir_name()` 决定：优先 `USERPROFILE`，其次 `HOME`，最后当前目录。

| 环境 | 默认目录 |
| --- | --- |
| Debug 构建，或显式 `IOX_ENV=dev` | `%USERPROFILE%/.iox-dev/` |
| 其他 Release 构建 | `%USERPROFILE%/.iox/` |

根目录内保存 `config.json`、API 历史 `sessions.jsonl`，以及官网历史缓存。缓存文件名按构建类型区分为 Debug 的 `web-history-dev.json` 与 Release 的 `web-history.json`。`%APPDATA%/iox` 已不符合当前实现。

### 5.2 配置提交与契约

- Rust `config.rs` 是持久化格式与默认值的事实来源；前端 `types/config.ts` 使用 Zod schema 推导类型。配置读写边界必须校验，Rust `Option` 的 `null` 在前端边界归一化。
- 新字段同步更新 Rust serde 默认值/迁移、Zod schema/共享常量、设置界面与契约测试。API 卡片尺寸使用 `apiCard.cardSize`，`general.apiCardSize` 仅保留旧配置迁移用途。
- 所有运行期写入经 `ConfigStore.commit/replace`，顺序为持久化 → 替换内存 → 广播 `config_updated` / 应用原生效果。不要另建直接写盘、广播或乐观替换配置的旁路。
- `ConfigStore` 串行提交不代表前端旧读取、广播与设置草稿自动解决冲突。修改相关流程时验证迟到读取和整份旧草稿覆盖即时更新的情况。
- 保留配置迁移、缺省回退和损坏文件隔离流程。默认值夹具为 `tests/fixtures/config/default-config.zh.json`；有意改变默认值时可运行 `cargo test --manifest-path src-tauri/Cargo.toml regenerate_config_contract_fixture -- --ignored`，检查差异后重新运行契约测试。

### 5.3 会话文件

- `chat_store` 查询缺失文件可返回空历史，查询本身不创建目录。其他读取/解析错误应报告，不能跳过坏行后写回而丢失旧数据。
- 保存与删除使用进程内事务锁；在同目录创建临时文件，完整写入、flush/sync、关闭句柄后替换。失败保留旧文件并清理临时文件；不先删旧文件再写入。
- 当前最多保留 200 条 API 会话。去重返回 canonical ID；修改去重、排序或裁剪规则时，确保成功返回的会话确实保留在文件中。
- 不在测试或调试时重置真实用户目录，不在日志、夹具或提交中泄露 API key、选中文本和会话正文。

## 6. 开发与验证命令

从仓库根目录使用 PowerShell：

| 目的 | 命令 | 说明 |
| --- | --- | --- |
| 安装依赖 | `pnpm install` | 使用仓库声明的 pnpm 版本与锁文件 |
| 完整桌面开发 | `pnpm tauri dev` | 启动 Vite 与 Tauri，使用开发配置目录 |
| 前端预览开发 | `pnpm dev` | 只启动 Vite，不能替代原生验证 |
| 前端类型与构建 | `pnpm build` | `tsc && vite build` |
| 前端回归 | `pnpm test` | Node test runner 执行 `tests/*.test.mjs` |
| 文件输入回归 | `pnpm test:files` | 文件菜单与投放逻辑 |
| 悬浮球回归 | `pnpm test:floating-ball` | 悬浮球相关测试 |
| Rust 编译检查 | `cargo check --manifest-path src-tauri/Cargo.toml` | 编译与类型检查 |
| Rust 回归 | `cargo test --manifest-path src-tauri/Cargo.toml` | 配置、流请求、会话事务、窗口政策等 |
| Rust 格式检查 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 检查格式；格式化时避免无关文件改动 |
| 生产打包 | `pnpm tauri build` | 当前 bundle 目标为 NSIS；生成 release 可执行文件 |

- 按修改范围运行检查：前端通常执行 `pnpm build` 与相关 Node 测试，后端执行 Cargo 检查与相关测试，跨端协议同时验证两侧。纯文档变更核对路径、命令和 `git diff --check`。
- 当前无 `pnpm lint` 脚本。`pnpm test` 不运行 Python 浏览器脚本或 `scripts/` 下的手动验证；这些脚本需另行检查其环境与夹具要求。
- Node/受控 adapter 测试不证明真实 Win32、WebView2 或 HTTP 行为。焦点、Pin/退场、混合 DPI、多屏、悬浮球、OLE 拖放及官网注入改动需补 Windows 桌面验证，并明确报告未验证项。
- 不将历史报告中的通过数当作当前结果。检查失败时记录失败用例与影响，不通过放宽断言掩盖回归。
- 发布工作流位于 `.github/workflows/release.yml`，由 `v*` tag 或手动触发，构建 NSIS 并额外打包便携 ZIP。发布变更需同步 `package.json`、`Cargo.toml` 与 `tauri.conf.json` 的版本。

## 7. 检索与协作

- 仓库存在 `.codegraph/` 时，理解/定位代码优先使用 `codegraph_explore` 或 `codegraph explore "问题或符号"`；不自行建立索引。对索引未覆盖的内容或明确提示过期的文件使用 `rg` 与直接读取；没有索引则直接检索。
- 涉及库、框架、SDK、API、CLI 或云服务的用法、配置、升级和专属调试时，通过 Context7 获取当前文档：先 `npx ctx7@latest library <官方名称> "具体问题"`，再以返回的 ID 执行 `npx ctx7@latest docs <libraryId> "具体问题"`。每个问题最多 3 次命令，版本问题选对应版本 ID；纯重构、业务逻辑、代码审查及一般编程不需要查询。
- Context7 CLI 在默认沙箱外运行。配额错误应告知用户使用 `npx ctx7@latest login` 或设置 `CONTEXT7_API_KEY`；查询不得携带密钥等敏感信息。
- `docs/`、`Requirements.md`、`.codegraph/` 与本地代理状态目录受 `.gitignore` 管理。本地规格、计划与审查记录可提供上下文，但不等于已提交、已审批或已验收；未经任务要求不强制加入被忽略的文件。
- 修改前检查工作区，保留已有改动；只修改任务涉及的文件。交付说明具体变更、实际运行的检查及尚未验证的行为。
