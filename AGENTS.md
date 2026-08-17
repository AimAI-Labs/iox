# IOX 开发与协作规范 (AGENTS.md)

---

## 1. 项目概述

**IOX (Input/Output Extension)** 是一款基于 **Tauri v2 + Rust + React 19** 构建的轻量级 Windows 全局划词 AI 助手。

### 核心特性
1. **全局无感划词**：在任意 Windows 应用（浏览器、IDE、Word、PDF 等）中划选文本，光标旁即时弹出微型胶囊操作条（Bubble）。
2. **防误触与无失焦保证**：
   - 注入 Windows 扩展样式 `WS_EX_NOACTIVATE`，弹出气泡时**不抢夺宿主程序焦点**，确保用户选中的高亮文本不消失；
   - 内置欧氏位移距离判定、有效字符检测、修饰键过滤与进程黑名单四重防误触机制。
3. **零污染安全取词**：取词时先在内存中备份剪贴板，瞬时模拟 `Ctrl+C` 提取选中文本后，**立即恢复原剪贴板内容**。
4. **双模动作调度 (Hybrid Action Engine)**：
   - **API 流式卡片模式**：原地展开悬浮卡片，基于 SSE 逐字流式渲染（支持 DeepSeek、Qwen、GLM、OpenAI、本地 Ollama 等 OpenAI 兼容协议）；
   - **Web 官网直达模式**：利用智能 URL 传参（如 `https://tongyi.aliyun.com/qianwen/?q={text}`）或自动写入剪贴板后调起默认浏览器，无缝复用已登录各 AI 官网的免费会话。
5. **单一自适应悬浮窗架构**：气泡态与卡片态在同一个透明无边框窗口内平滑过渡，避免多窗口切换闪烁与 IPC 同步复杂度。

---

## 2. 技术栈与目录结构

### 2.1 技术栈
- **后端**：Tauri v2, Rust (Edition 2021), `windows-sys` / `windows` (Win32 API, Hooks, Window Styles), `reqwest` (SSE Streaming), `tokio`, `serde`/`serde_json`
- **前端**：React 19, TypeScript (~5.8), Vite, Lucide React, React Markdown, CSS / Tailwind CSS
- **包管理**：`pnpm`

### 2.2 核心代码目录

```
iox/
├── src-tauri/
│   ├── Cargo.toml                  # Rust 依赖配置
│   ├── tauri.conf.json             # Tauri 窗口与权限配置
│   └── src/
│       ├── main.rs                 # 应用程序入口
│       ├── lib.rs                  # Tauri 应用初始化、IPC 注册与事件分发
│       ├── config.rs               # 结构化配置模型与 %APPDATA%/iox/config.json 持久化
│       ├── selection.rs            # WH_MOUSE_LL 鼠标钩子、防误触算法与剪贴板安全取词
│       ├── window_manager.rs       # WS_EX_NOACTIVATE 无失焦控制、DPI 物理坐标与边缘吸附
│       └── ai_service.rs           # OpenAI 兼容 SSE 流式客户端与 Web Action URL 调度
├── src/
│   ├── types/
│   │   └── config.ts               # 前后端共享数据类型定义
│   ├── components/
│   │   ├── BubbleBar.tsx           # 紧凑型胶囊悬浮气泡条 (260x38px)
│   │   ├── ResultCard.tsx          # 原地展开流式卡片 (Markdown 渲染、模型切换、追问)
│   │   ├── Settings.tsx            # 模型服务商、动作与快捷键设置面板
│   │   └── Icons.tsx               # 动态图标映射
│   ├── hooks/
│   │   ├── useConfig.ts            # 配置读取与保存 Hook
│   │   └── useOverlayState.ts      # 悬浮窗多态状态机 (Hidden / Bubble / Card)
│   ├── App.tsx                     # 根路由与多视图分发 (Overlay / Settings)
│   ├── App.css                     # 毛玻璃与过渡动画系统
│   └── main.tsx                    # React 入口
├── docs/
│   └── superpowers/
│       ├── specs/                  # 经确认的系统设计规格文档 (Design Spec)
│       └── plans/                  # 经确认的分步实施计划 (Implementation Plan)
└── AGENTS.md                       # 本协作规范指南
```

---

## 3. 关键架构原则与开发约束

### 3.1 核心设计原则
1. **恪守 KISS 与 YAGNI 原则**：保持逻辑极简清晰，严禁过度工程化与多余的防御性抽象。
2. **保持单向单一状态流**：悬浮窗的生命周期状态明确：
   $$\text{HIDDEN} \xrightarrow{\text{划词/快捷键}} \text{BUBBLE} \xrightarrow{\text{点击 API 动作}} \text{CARD} \xrightarrow{\text{Esc/失焦/关闭}} \text{HIDDEN}$$
3. **非失焦生命周期管理**：
   - 气泡态下窗口必须带 `WS_EX_NOACTIVATE` 样式，绝不能抢夺宿主焦点；
   - 仅当用户主动点击卡片中的“追问输入框”或“Pin 固定”时，窗口才按需获取键盘输入焦点。

### 3.2 编码与协作准则
- **修改 Rust 后端**：涉及 Win32 API 调用时，优先使用安全的包装，并在 `unsafe` 块附近写明前置与后置不变量；多线程操作共享状态统一使用 `Arc<Mutex<T>>` 或 `tokio::sync`。
- **修改前端组件**：保持组件小而聚焦，样式使用现代化毛玻璃自适应风格，确保在暗色/浅色背景下文字均清晰可读。
- **配置文件维护**：配置文件统一保存于 `%APPDATA%/iox/config.json`，读写操作需具备版本兼容与默认值回退机制。

---

## 4. 常用开发与测试命令

| 目的 | 终端命令 (PowerShell) | 说明 |
| :--- | :--- | :--- |
| **启动本地开发环境** | `pnpm tauri dev` | 启动 Vite 开发服务器与 Tauri 桌面端热重载 |
| **前端类型与打包检查** | `pnpm build` | 执行 `tsc` 类型检查及 Vite 生产构建 |
| **Rust 编译与类型检查** | `cargo check --manifest-path src-tauri/Cargo.toml` | 极速检查 Rust 后端编译错误 |
| **运行 Rust 单元测试** | `cargo test --manifest-path src-tauri/Cargo.toml` | 运行配置解析、防抖算法与 URL 模板测试 |
| **生产安装包打包** | `pnpm tauri build` | 构建 Windows 安装包与便携版 `.exe` |

---


