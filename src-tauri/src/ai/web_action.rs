use super::scripts::build_initialization_script;
use super::template::render_url_template;
use super::vendors::get_vendor_adapter;
use crate::config::{ActionConfig, AppConfig};
use crate::AppState;
use arboard::Clipboard;
use serde::{Deserialize, Serialize};
use tauri::webview::WebviewBuilder;
use tauri::window::WindowBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl};

fn cancel_injection(app: &AppHandle, label: &str) {
    if let Ok(mut tasks) = app.state::<AppState>().web_injections.lock() {
        if let Some(token) = tasks.remove(label) {
            token.cancel();
        }
        if let Some(webview) = app.get_webview(label) {
            // Also invalidate JavaScript timers for same-document/hash navigation.
            let _ = webview.eval("window.__iox_injection_epoch = (window.__iox_injection_epoch || 0) + 1;");
        }
    }
}

fn schedule_injection(webview: &tauri::Webview, script: &str, delays: &[u64]) {
    let app = webview.app_handle().clone();
    let label = webview.label().to_string();
    let token = tokio_util::sync::CancellationToken::new();
    if let Ok(mut tasks) = app.state::<AppState>().web_injections.lock() {
        if let Some(old) = tasks.insert(label, token.clone()) {
            old.cancel();
        }
    } else {
        return;
    }
    let webview = webview.clone();
    let script = script.to_string();
    let delays = delays.to_vec();
    tauri::async_runtime::spawn(async move {
        for delay in delays {
            tokio::select! {
                biased;
                _ = token.cancelled() => return,
                _ = tokio::time::sleep(std::time::Duration::from_millis(delay)) => {}
            }
            // Serialize the final check/enqueue with cancel + navigation.
            if let Ok(_tasks) = app.state::<AppState>().web_injections.lock() {
                if token.is_cancelled() {
                    return;
                }
                let _ = webview.eval(&script);
            }
        }
    });
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WebHubTab {
    pub action_id: String,
    pub name: String,
    pub icon: String,
    pub url: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebHubState {
    pub tabs: Vec<WebHubTab>,
    pub active_tab_id: Option<String>,
}

impl WebHubState {
    pub fn add_or_activate(&mut self, tab: WebHubTab) {
        if let Some(existing) = self.tabs.iter_mut().find(|t| t.action_id == tab.action_id) {
            *existing = tab.clone();
        } else {
            self.tabs.push(tab.clone());
        }
        self.active_tab_id = Some(tab.action_id);
    }

    pub fn remove_tab(&mut self, action_id: &str) -> Option<String> {
        let idx = self.tabs.iter().position(|t| t.action_id == action_id)?;
        self.tabs.remove(idx);
        if self.active_tab_id.as_deref() == Some(action_id) {
            if self.tabs.is_empty() {
                self.active_tab_id = None;
            } else if idx < self.tabs.len() {
                self.active_tab_id = Some(self.tabs[idx].action_id.clone());
            } else {
                self.active_tab_id = Some(self.tabs[self.tabs.len() - 1].action_id.clone());
            }
        }
        self.active_tab_id.clone()
    }
}

/// 智能规范化 Web Action URL，处理已废弃或重定向的官方历史 URL
pub fn normalize_web_action_url(raw_url: &str) -> String {
    let trimmed = raw_url.trim();
    if trimmed.contains("tongyi.aliyun.com/qianwen") {
        "https://www.qianwen.com/".to_string()
    } else if trimmed.contains("kimi.moonshot.cn") {
        "https://www.kimi.com/".to_string()
    } else {
        trimmed.to_string()
    }
}

/// 提取域名的主域（例如 passport.aliyun.com -> aliyun.com）
pub fn get_registrable_domain(host: &str) -> &str {
    let parts: Vec<&str> = host.split('.').collect();
    if parts.len() >= 2 {
        if parts.len() >= 3 {
            let last_two = format!("{}.{}", parts[parts.len() - 2], parts[parts.len() - 1]);
            if ["com.cn", "net.cn", "org.cn", "gov.cn", "co.uk", "com.hk"].contains(&last_two.as_str()) {
                let start_idx = host.len() - parts[parts.len() - 3].len() - 1 - last_two.len();
                return &host[start_idx..];
            }
        }
        let start_idx = host.len() - parts[parts.len() - 2].len() - 1 - parts[parts.len() - 1].len();
        &host[start_idx..]
    } else {
        host
    }
}

/// 判断导航跳转是否应在当前 WebView 内部进行（允许重定向/认证），还是应在系统默认浏览器中打开（外部出站链接）
pub fn is_allowed_internal_navigation(initial_origin: &str, nav_url: &tauri::Url) -> bool {
    // 1. 非 HTTP/HTTPS 协议（例如 about:blank, data: 等）在内部处理
    let scheme = nav_url.scheme();
    if scheme != "http" && scheme != "https" {
        return true;
    }

    let nav_origin = nav_url.origin().ascii_serialization();
    // 2. 完全同源
    if nav_origin == initial_origin {
        return true;
    }

    let nav_host = match nav_url.host_str() {
        Some(h) => h.to_lowercase(),
        None => return true,
    };

    let initial_parsed = tauri::Url::parse(initial_origin).ok();
    let initial_host = initial_parsed
        .as_ref()
        .and_then(|u| u.host_str())
        .map(|h| h.to_lowercase())
        .unwrap_or_default();

    // 3. 同主域（例如 chat.deepseek.com 与 auth.deepseek.com）
    if !initial_host.is_empty() {
        let initial_domain = get_registrable_domain(&initial_host);
        let nav_domain = get_registrable_domain(&nav_host);
        if !initial_domain.is_empty() && initial_domain == nav_domain {
            return true;
        }
    }

    // 4. 常见 AI 官方重定向与多域名生态放行
    // 阿里 / 通义千问生态
    let is_ali_init = initial_host.contains("aliyun.com") || initial_host.contains("qianwen.com") || initial_host.contains("tongyi.cn");
    let is_ali_nav = nav_host.contains("aliyun.com") || nav_host.contains("qianwen.com") || nav_host.contains("tongyi.cn") || nav_host.contains("taobao.com") || nav_host.contains("alibaba.com");
    if is_ali_init && is_ali_nav {
        return true;
    }

    // OpenAI / ChatGPT 生态
    let is_openai_init = initial_host.contains("openai.com") || initial_host.contains("chatgpt.com");
    let is_openai_nav = nav_host.contains("openai.com") || nav_host.contains("chatgpt.com") || nav_host.contains("oaistatic.com") || nav_host.contains("auth0.com");
    if is_openai_init && is_openai_nav {
        return true;
    }

    // 字节 / 豆包生态
    let is_doubao_init = initial_host.contains("doubao.com");
    let is_doubao_nav = nav_host.contains("doubao.com") || nav_host.contains("volcengine.com") || nav_host.contains("bytedance.com");
    if is_doubao_init && is_doubao_nav {
        return true;
    }

    // Kimi / 月之暗面生态
    let is_kimi_init = initial_host.contains("kimi.com") || initial_host.contains("moonshot.cn") || initial_host.contains("kimi.ai") || initial_host.contains("moonshot.ai");
    let is_kimi_nav = nav_host.contains("kimi.com") || nav_host.contains("moonshot.cn") || nav_host.contains("kimi.ai") || nav_host.contains("moonshot.ai");
    if is_kimi_init && is_kimi_nav {
        return true;
    }

    // 5. 身份认证与统一登录授权放行 (SSO, OAuth, CAS, Clerk, Auth0)
    if nav_host.starts_with("passport.")
        || nav_host.starts_with("auth.")
        || nav_host.starts_with("login.")
        || nav_host.starts_with("accounts.")
        || nav_host.starts_with("account.")
        || nav_host.starts_with("sso.")
        || nav_host.contains("clerk.com")
        || nav_host.contains("auth0.com")
    {
        return true;
    }

    // 6. 其他非同源外部链接在系统浏览器中打开
    false
}

/// 执行 Web 动作：根据配置以 Multi-Window 独立浮窗或 Multi-Tab Hub 统一浮窗形式调度 AI 官网
pub fn execute_web_action(
    app: &AppHandle,
    config: &AppConfig,
    action: &ActionConfig,
    text: &str,
    copy_override: Option<bool>,
    auto_submit_override: Option<bool>,
) -> Result<(), String> {
    let is_empty_text = text.trim().is_empty();

    // 1. 安全复制划选文本到剪贴板 (仅在非空文本时执行)
    let should_copy = if is_empty_text {
        false
    } else {
        copy_override.unwrap_or(false) || config.general.auto_copy_on_web_action
    };
    if should_copy {
        if let Ok(mut clipboard) = Clipboard::new() {
            let _ = clipboard.set_text(text);
        }
    }

    // 2. 提取并决定目标 URL 及注入脚本
    let raw_template = action
        .url_template
        .as_deref()
        .unwrap_or("")
        .trim();
    if raw_template.is_empty() {
        return Err(format!("Web action '{}' has no configured URL template", action.name));
    }

    let normalized_template = normalize_web_action_url(raw_template);
    let template = normalized_template.as_str();

    let is_url_template = template.contains("{text}") || template.contains("{query}") || template.contains("{raw_text}");
    let use_url_mode = action.use_url_template.unwrap_or(false);
    let auto_sub = auto_submit_override.unwrap_or_else(|| action.auto_submit.unwrap_or(true));

    let (target_url_str, injection_script) = if is_empty_text {
        // 1. 空文本直达模式：不注入任何 DOM 脚本与自动提交，直接直达原生官网首页
        let base_url = if is_url_template {
            render_url_template(template, "")
        } else {
            template.to_string()
        };
        (base_url, None)
    } else if is_url_template && use_url_mode && auto_sub {
        // 2. 仅在用户显式开启 use_url_template 且允许自动提交时：直接通过 URL 查询参数直达官网
        (render_url_template(template, text), None)
    } else {
        // 3. 默认统一走纯净基础 URL + 受控组件 DOM 注入模式 (支持精准聚焦、多行块引用与双击防自动发送)
        let base_url = if is_url_template {
            render_url_template(template, "")
        } else {
            template.to_string()
        };

        let adapter = get_vendor_adapter(&action.id, template);
        let script = adapter.build_injection_script(
            text,
            action.input_selector.as_deref(),
            action.submit_selector.as_deref(),
            auto_sub,
        );
        (base_url, Some(script))
    };

    let target_url: tauri::Url = target_url_str
        .parse()
        .map_err(|e| format!("Invalid target URL '{}': {}", target_url_str, e))?;

    let mode = config.general.web_window_mode.as_str();

    if mode == "tabbed" {
        execute_tabbed_hub_action(app, config, action, target_url, &target_url_str, injection_script, None)
    } else {
        execute_multi_window_action(app, config, action, target_url, &target_url_str, injection_script, None)
    }
}

const ATTACHMENT_ORIGIN_NOTICE: &str = "(()=>{if(window.top!==window)return;const p=document.createElement('div');p.style.cssText='position:fixed;z-index:2147483647;bottom:20px;right:20px;padding:16px;background:#18212f;color:white';p.textContent='IOX：页面来源已改变或需要登录，本次附件已停止。请登录并返回官网后重新选择文件。';p.onclick=()=>p.remove();document.body?.appendChild(p)})();";

fn eval_attachment(webview: &tauri::Webview, script: &str, origin: &str) {
    // Native guard prevents even passing file bytes to a login/foreign document.
    if webview
        .url()
        .map(|url| super::file_upload::is_attachment_destination(&url, origin))
        .unwrap_or(false)
    {
        let _ = webview.eval(script);
    } else {
        let _ = webview.eval(ATTACHMENT_ORIGIN_NOTICE);
    }
}

fn site_view_readiness() -> &'static std::sync::Mutex<std::collections::HashSet<String>> {
    static READY: std::sync::OnceLock<std::sync::Mutex<std::collections::HashSet<String>>> =
        std::sync::OnceLock::new();
    READY.get_or_init(Default::default)
}

fn site_view_is_ready(label: &str) -> bool {
    site_view_readiness()
        .lock()
        .map(|ready| ready.contains(label))
        .unwrap_or(false)
}

/// Track every site document, including views first opened through a text action.
fn attachment_on_page_load(
    app: &AppHandle,
    builder: WebviewBuilder<tauri::Wry>,
    label: &str,
    script: Option<String>,
    origin: Option<String>,
) -> WebviewBuilder<tauri::Wry> {
    if let Ok(mut ready) = site_view_readiness().lock() {
        ready.remove(label);
    }
    let has_attachment = script.is_some() && origin.is_some();
    let cancellation = tokio_util::sync::CancellationToken::new();
    if has_attachment {
        if let Ok(mut tasks) = app.state::<AppState>().web_injections.lock() {
            if let Some(old) = tasks.insert(label.to_string(), cancellation.clone()) {
                old.cancel();
            }
        } else {
            cancellation.cancel();
        }
    }
    let pending = std::sync::Arc::new(std::sync::Mutex::new(script.zip(origin)));
    if has_attachment {
        let expires = pending.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            if let Ok(mut pending) = expires.lock() {
                *pending = None;
            };
        });
    }
    builder.on_page_load(move |webview, payload| {
        let finished = payload.event() == tauri::webview::PageLoadEvent::Finished
            && matches!(payload.url().scheme(), "http" | "https");
        if let Ok(mut ready) = site_view_readiness().lock() {
            if finished {
                ready.insert(webview.label().to_string());
            } else {
                ready.remove(webview.label());
            }
        }
        if !finished {
            return;
        }
        // Consume on the first completed document, including login redirects. No replay later.
        let attachment = pending.lock().ok().and_then(|mut pending| pending.take());
        if let Some((script, origin)) = attachment {
            let state = webview.state::<AppState>();
            let Ok(_tasks) = state.web_injections.lock() else {
                return;
            };
            // Serialize the final check/enqueue with cancel + session navigation.
            if cancellation.is_cancelled() {
                return;
            }
            if super::file_upload::is_attachment_destination(payload.url(), &origin) {
                eval_attachment(&webview, &script, &origin);
            } else {
                let _ = webview.eval(ATTACHMENT_ORIGIN_NOTICE);
            }
        }
    })
}

fn schedule_action_injection(
    webview: &tauri::Webview,
    script: &str,
    delays: &[u64],
    attachment_origin: Option<&str>,
) {
    if let Some(origin) = attachment_origin {
        // Reused documents already exist; JS owns retries and cancels on navigation.
        eval_attachment(webview, script, origin);
    } else {
        schedule_injection(webview, script, delays);
    }
}

pub fn execute_web_file_action(
    app: &AppHandle,
    config: &AppConfig,
    action_id: &str,
    files: &[String],
) -> Result<(), String> {
    let action = super::file_upload::enabled_web_action(config, action_id)?;
    let template = normalize_web_action_url(action.url_template.as_deref().unwrap_or_default());
    let target_url_str = render_url_template(&template, "");
    let target_url: tauri::Url = target_url_str
        .parse()
        .map_err(|_| "官网地址无效".to_string())?;
    if !matches!(target_url.scheme(), "https" | "http") || target_url.host_str().is_none() {
        return Err("官网地址必须为 HTTP 或 HTTPS".into());
    }
    let origin = target_url.origin().ascii_serialization();
    let sanitized_id: String = action
        .id
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let content_label = if config.general.web_window_mode == "tabbed" {
        format!("web_hub_tab_{}", sanitized_id)
    } else {
        format!("web_win_{}_web", sanitized_id)
    };
    // Reject before reading bytes; evaluating into a loading document could discard the payload.
    if app.get_webview(&content_label).is_some() && !site_view_is_ready(&content_label) {
        return Err("官网正在加载，请稍后重试".into());
    }
    let attachments = super::file_upload::read_attachments(files)?;
    static NEXT_REQUEST: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    let request_id = format!(
        "file-{}",
        NEXT_REQUEST.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    );
    let script = super::file_upload::build_attachment_script(&origin, &attachments, &request_id);
    if config.general.web_window_mode == "tabbed" {
        execute_tabbed_hub_action(
            app,
            config,
            action,
            target_url,
            &target_url_str,
            Some(script),
            Some(origin),
        )
    } else {
        execute_multi_window_action(
            app,
            config,
            action,
            target_url,
            &target_url_str,
            Some(script),
            Some(origin),
        )
    }
}

/// 恢复原始会话，不触发输入注入或自动提交。
pub fn resume_web_session(
    app: &AppHandle,
    config: &AppConfig,
    action: &ActionConfig,
    url: &str,
) -> Result<(), String> {
    let target_url = tauri::Url::parse(url).map_err(|e| e.to_string())?;
    // Exact saved conversation URL: never normalize to a homepage or inject a prompt.
    if config.general.web_window_mode == "tabbed" {
        execute_tabbed_hub_action(app, config, action, target_url, url, None, None)
    } else {
        execute_multi_window_action(app, config, action, target_url, url, None, None)
    }
}

/// 独立多窗口模式调度 (`multi_window`)
fn execute_multi_window_action(
    app: &AppHandle,
    config: &AppConfig,
    action: &ActionConfig,
    target_url: tauri::Url,
    target_url_str: &str,
    injection_script: Option<String>,
    attachment_origin: Option<String>,
) -> Result<(), String> {
    let sanitized_id: String = action
        .id
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect();
    let label = format!("web_win_{}", sanitized_id);
    let content_label = format!("{}_web", label);
    let bar_label = format!("{}_bar", label);
    cancel_injection(app, &content_label);

    // 复用已存在的独立窗口
    if let Some(window) = app.get_window(&label) {
        if let Some(content_wv) = app.get_webview(&content_label) {
            if let Some(ref script) = injection_script {
                schedule_action_injection(&content_wv, script, &[30, 300, 1000], attachment_origin.as_deref());
            } else {
                content_wv.navigate(target_url).map_err(|e| e.to_string())?;
            }
        }
        let _ = window.set_title(&action.name);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let (saved_w, saved_h) = config.general.web_window_size;
    let initial_width = if saved_w >= 520.0 { saved_w } else { 860.0 };
    let initial_height = if saved_h >= 400.0 { saved_h } else { 640.0 };
    let titlebar_height = 38.0;

    let window = WindowBuilder::new(app, &label)
        .title(&action.name)
        .inner_size(initial_width, initial_height)
        .min_inner_size(520.0, 400.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .visible(false)
        .build()
        .map_err(|e| format!("Failed to create web window: {}", e))?;

    if let Ok(hwnd) = window.hwnd() {
        crate::window_manager::apply_main_window_native_style(hwnd.0 as _);
    }
    let icon = tauri::include_image!("icons/icon.png");
    let _ = window.set_icon(icon);

    let title_param = urlencoding::encode(&action.name);
    let url_param = urlencoding::encode(target_url_str);
    let bar_path = format!(
        "index.html?view=web_titlebar&label={}&title={}&url={}",
        label, title_param, url_param
    );

    let bar_builder = WebviewBuilder::new(&bar_label, WebviewUrl::App(bar_path.into()))
        .transparent(true);

    let titlebar_wv = window
        .add_child(
            bar_builder,
            tauri::LogicalPosition::new(0.0, 0.0),
            tauri::LogicalSize::new(initial_width, titlebar_height),
        )
        .map_err(|e| format!("Failed to create titlebar webview: {}", e))?;

    let init_script = build_initialization_script(&config.general.theme, None);
    let initial_origin = target_url.origin().ascii_serialization();
    let content_builder = WebviewBuilder::new(&content_label, WebviewUrl::External(target_url))
        .transparent(true)
        .zoom_hotkeys_enabled(true)
        .on_navigation(move |nav_url| {
            if is_allowed_internal_navigation(&initial_origin, nav_url) {
                true
            } else {
                let _ = open::that_detached(nav_url.as_str());
                false
            }
        })
        .initialization_script(&init_script);
    let content_builder = attachment_on_page_load(
        app,
        content_builder,
        &content_label,
        injection_script.clone(),
        attachment_origin.clone(),
    );

    let content_wv = window
        .add_child(
            content_builder,
            tauri::LogicalPosition::new(0.0, titlebar_height),
            tauri::LogicalSize::new(initial_width, initial_height - titlebar_height),
        )
        .map_err(|e| format!("Failed to create content webview: {}", e))?;

    let scale = window.scale_factor().unwrap_or(1.0);
    if let Ok(hwnd) = window.hwnd() {
        let radius = (12.0 * scale).round() as i32;
        crate::window_manager::apply_content_webview_bottom_round(hwnd.0 as _, radius);
    }

    if attachment_origin.is_none() {
        if let Some(script) = injection_script {
            schedule_injection(&content_wv, &script, &[800, 1800, 3500, 6000]);
        }
    }

    let titlebar_clone = titlebar_wv.clone();
    let content_clone = content_wv.clone();
    let window_clone = window.clone();
    let app_handle = app.clone();

    window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if !window_clone.is_maximized().unwrap_or(false) {
                    if let Ok(size) = window_clone.inner_size() {
                        let scale = window_clone.scale_factor().unwrap_or(1.0);
                        let w = (size.width as f64 / scale).round();
                        let h = (size.height as f64 / scale).round();
                        if w >= 520.0 && h >= 400.0 {
                            if let Some(state) = app_handle.try_state::<AppState>() {
                                if let Ok(mut config) = state.config.lock() {
                                    config.general.web_window_size = (w, h);
                                    let _ = config.save();
                                }
                            }
                        }
                    }
                }
                let _ = window_clone.hide();
            }
            tauri::WindowEvent::Resized(physical_size) => {
                let scale = window_clone.scale_factor().unwrap_or(1.0);
                let bar_physical_h = (38.0 * scale).round() as u32;
                let content_physical_h = physical_size.height.saturating_sub(bar_physical_h);

                let is_maximized = window_clone.is_maximized().unwrap_or(false);
                if let Ok(hwnd) = window_clone.hwnd() {
                    let hwnd_raw = hwnd.0 as _;
                    if is_maximized {
                        crate::window_manager::remove_content_webview_round(hwnd_raw);
                    } else {
                        let r = (12.0 * scale).round() as i32;
                        crate::window_manager::apply_content_webview_bottom_round(hwnd_raw, r);
                    }
                }

                let _ = titlebar_clone.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                    physical_size.width,
                    bar_physical_h,
                )));
                let _ = content_clone.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                    physical_size.width,
                    content_physical_h,
                )));
                let _ = content_clone.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                    0,
                    bar_physical_h as i32,
                )));
            }
            _ => {}
        }
    });

    let _ = window.show();
    let _ = window.set_focus();

    Ok(())
}

/// 统一多标签 Hub 模式调度 (`tabbed`)
fn execute_tabbed_hub_action(
    app: &AppHandle,
    config: &AppConfig,
    action: &ActionConfig,
    target_url: tauri::Url,
    target_url_str: &str,
    injection_script: Option<String>,
    attachment_origin: Option<String>,
) -> Result<(), String> {
    let window_label = "web_hub";
    let bar_label = "web_hub_bar";
    let sanitized_id: String = action
        .id
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect();
    let tab_content_label = format!("web_hub_tab_{}", sanitized_id);
    cancel_injection(app, &tab_content_label);

    let tab_info = WebHubTab {
        action_id: action.id.clone(),
        name: action.name.clone(),
        icon: action.icon.clone(),
        url: target_url_str.to_string(),
    };

    let (saved_w, saved_h) = config.general.web_window_size;
    let initial_width = if saved_w >= 520.0 { saved_w } else { 860.0 };
    let initial_height = if saved_h >= 400.0 { saved_h } else { 640.0 };
    let titlebar_height = 38.0;

    let init_script = build_initialization_script(&config.general.theme, None);

    // 1. 如果 web_hub 窗口已存在
    if let Some(window) = app.get_window(window_label) {
        let scale = window.scale_factor().unwrap_or(1.0);
        let bar_physical_h = (38.0 * scale).round() as u32;
        let window_size = window.inner_size().unwrap_or(tauri::PhysicalSize::new(
            (initial_width * scale).round() as u32,
            (initial_height * scale).round() as u32,
        ));
        let content_physical_h = window_size.height.saturating_sub(bar_physical_h);

        // 检查该 Tab 的 child webview 是否已挂载
        if let Some(content_wv) = app.get_webview(&tab_content_label) {
            if let Some(ref script) = injection_script {
                schedule_action_injection(&content_wv, script, &[30, 300, 1000], attachment_origin.as_deref());
            } else {
                content_wv.navigate(target_url).map_err(|e| e.to_string())?;
            }
        } else {
            // 动态挂载新的 Tab Child Webview
            let initial_origin = target_url.origin().ascii_serialization();
            let content_builder = WebviewBuilder::new(&tab_content_label, WebviewUrl::External(target_url.clone()))
                .transparent(true)
                .zoom_hotkeys_enabled(true)
                .on_navigation(move |nav_url| {
                    if is_allowed_internal_navigation(&initial_origin, nav_url) {
                        true
                    } else {
                        let _ = open::that_detached(nav_url.as_str());
                        false
                    }
                })
                .initialization_script(&init_script);
            let content_builder = attachment_on_page_load(
                app,
                content_builder,
                &tab_content_label,
                injection_script.clone(),
                attachment_origin.clone(),
            );

            let new_wv = window
                .add_child(
                    content_builder,
                    tauri::LogicalPosition::new(0.0, titlebar_height),
                    tauri::LogicalSize::new(
                        window_size.width as f64 / scale,
                        content_physical_h as f64 / scale,
                    ),
                )
                .map_err(|e| format!("Failed to create tab content webview: {}", e))?;

            if attachment_origin.is_none() {
                if let Some(ref script) = injection_script {
                    schedule_injection(&new_wv, script, &[800, 1800, 3500, 6000]);
                }
            }
        }

        // 更新 AppState 中的 Hub 状态
        if let Some(state) = app.try_state::<AppState>() {
            if let Ok(mut hub_state) = state.web_hub_state.lock() {
                hub_state.add_or_activate(tab_info);
            }
            let _ = switch_web_hub_tab(app, &state, &action.id);
        }

        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    // 2. 如果 web_hub 窗口不存在，创建新 Hub 窗口与 Tab 体系
    let window = WindowBuilder::new(app, window_label)
        .title("IOX Web Hub")
        .inner_size(initial_width, initial_height)
        .min_inner_size(520.0, 400.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .visible(false)
        .build()
        .map_err(|e| format!("Failed to create web hub window: {}", e))?;

    if let Ok(hwnd) = window.hwnd() {
        crate::window_manager::apply_main_window_native_style(hwnd.0 as _);
    }
    let icon = tauri::include_image!("icons/icon.png");
    let _ = window.set_icon(icon);

    // 构建顶部 Hub 专用多标签栏 Webview
    let bar_path = format!("index.html?view=web_titlebar&label={}", window_label);
    let bar_builder = WebviewBuilder::new(bar_label, WebviewUrl::App(bar_path.into()))
        .transparent(true);

    let titlebar_wv = window
        .add_child(
            bar_builder,
            tauri::LogicalPosition::new(0.0, 0.0),
            tauri::LogicalSize::new(initial_width, titlebar_height),
        )
        .map_err(|e| format!("Failed to create hub titlebar webview: {}", e))?;

    // 构建首个 AI Tab Webview
    let initial_origin = target_url.origin().ascii_serialization();
    let content_builder = WebviewBuilder::new(&tab_content_label, WebviewUrl::External(target_url))
        .transparent(true)
        .zoom_hotkeys_enabled(true)
        .on_navigation(move |nav_url| {
            if is_allowed_internal_navigation(&initial_origin, nav_url) {
                true
            } else {
                let _ = open::that_detached(nav_url.as_str());
                false
            }
        })
        .initialization_script(&init_script);
    let content_builder = attachment_on_page_load(
        app,
        content_builder,
        &tab_content_label,
        injection_script.clone(),
        attachment_origin.clone(),
    );

    let content_wv = window
        .add_child(
            content_builder,
            tauri::LogicalPosition::new(0.0, titlebar_height),
            tauri::LogicalSize::new(initial_width, initial_height - titlebar_height),
        )
        .map_err(|e| format!("Failed to create hub initial tab content webview: {}", e))?;

    let scale = window.scale_factor().unwrap_or(1.0);
    if let Ok(hwnd) = window.hwnd() {
        let radius = (12.0 * scale).round() as i32;
        crate::window_manager::apply_content_webview_bottom_round(hwnd.0 as _, radius);
    }

    if attachment_origin.is_none() {
        if let Some(script) = injection_script {
            schedule_injection(&content_wv, &script, &[800, 1800, 3500, 6000]);
        }
    }

    // 记录 AppState 状态
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut hub_state) = state.web_hub_state.lock() {
            hub_state.add_or_activate(tab_info);
        }
        let hub_snapshot = state.web_hub_state.lock().unwrap().clone();
        let _ = app.emit("web_hub_state_changed", &hub_snapshot);
    }

    // 窗口尺寸与多 Webview 协同自适应监听
    let titlebar_clone = titlebar_wv.clone();
    let window_clone = window.clone();
    let app_handle = app.clone();

    window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if !window_clone.is_maximized().unwrap_or(false) {
                    if let Ok(size) = window_clone.inner_size() {
                        let scale = window_clone.scale_factor().unwrap_or(1.0);
                        let w = (size.width as f64 / scale).round();
                        let h = (size.height as f64 / scale).round();
                        if w >= 520.0 && h >= 400.0 {
                            if let Some(state) = app_handle.try_state::<AppState>() {
                                if let Ok(mut config) = state.config.lock() {
                                    config.general.web_window_size = (w, h);
                                    let _ = config.save();
                                }
                            }
                        }
                    }
                }
                let _ = window_clone.hide();
            }
            tauri::WindowEvent::Resized(physical_size) => {
                let scale = window_clone.scale_factor().unwrap_or(1.0);
                let bar_physical_h = (38.0 * scale).round() as u32;
                let content_physical_h = physical_size.height.saturating_sub(bar_physical_h);

                let is_maximized = window_clone.is_maximized().unwrap_or(false);
                if let Ok(hwnd) = window_clone.hwnd() {
                    let hwnd_raw = hwnd.0 as _;
                    if is_maximized {
                        crate::window_manager::remove_content_webview_round(hwnd_raw);
                    } else {
                        let r = (12.0 * scale).round() as i32;
                        crate::window_manager::apply_content_webview_bottom_round(hwnd_raw, r);
                    }
                }

                let _ = titlebar_clone.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                    physical_size.width,
                    bar_physical_h,
                )));

                // 同步调整当前 active tab 的尺寸
                if let Some(state) = app_handle.try_state::<AppState>() {
                    if let Ok(hub_state) = state.web_hub_state.lock() {
                        if let Some(ref active_id) = hub_state.active_tab_id {
                            let sanitized_id: String = active_id.chars()
                                .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
                                .collect();
                            let tab_label = format!("web_hub_tab_{}", sanitized_id);
                            if let Some(active_wv) = app_handle.get_webview(&tab_label) {
                                let _ = active_wv.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                                    physical_size.width,
                                    content_physical_h,
                                )));
                                let _ = active_wv.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                                    0,
                                    bar_physical_h as i32,
                                )));
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    });

    let _ = window.show();
    let _ = window.set_focus();

    Ok(())
}

/// 切换 Web Hub 当前激活的 Tab
pub fn switch_web_hub_tab(app: &AppHandle, state: &AppState, action_id: &str) -> Result<(), String> {
    let mut hub_state = state.web_hub_state.lock().map_err(|e| e.to_string())?;
    if !hub_state.tabs.iter().any(|t| t.action_id == action_id) {
        return Err(format!("Tab with action_id '{}' not found", action_id));
    }
    hub_state.active_tab_id = Some(action_id.to_string());
    let current_active = hub_state.active_tab_id.clone();
    let tabs = hub_state.tabs.clone();
    drop(hub_state);

    if let Some(window) = app.get_window("web_hub") {
        let scale = window.scale_factor().unwrap_or(1.0);
        let bar_physical_h = (38.0 * scale).round() as u32;
        if let Ok(size) = window.inner_size() {
            let content_physical_h = size.height.saturating_sub(bar_physical_h);
            for tab in &tabs {
                let sanitized_id: String = tab.action_id.chars()
                    .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
                    .collect();
                let tab_label = format!("web_hub_tab_{}", sanitized_id);
                if let Some(wv) = app.get_webview(&tab_label) {
                    if Some(&tab.action_id) == current_active.as_ref() {
                        let _ = wv.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(0, bar_physical_h as i32)));
                        let _ = wv.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(size.width, content_physical_h)));
                    } else {
                        let _ = wv.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(-20000, -20000)));
                    }
                }
            }
            if let Ok(hwnd) = window.hwnd() {
                let is_maximized = window.is_maximized().unwrap_or(false);
                if !is_maximized {
                    let r = (12.0 * scale).round() as i32;
                    crate::window_manager::apply_content_webview_bottom_round(hwnd.0 as _, r);
                }
            }
        }
    }

    let hub_state_snapshot = state.web_hub_state.lock().unwrap().clone();
    let _ = app.emit("web_hub_state_changed", &hub_state_snapshot);
    Ok(())
}

/// 关闭 Web Hub 中指定的 Tab
pub fn close_web_hub_tab(app: &AppHandle, state: &AppState, action_id: &str) -> Result<(), String> {
    let mut hub_state = state.web_hub_state.lock().map_err(|e| e.to_string())?;
    let new_active = hub_state.remove_tab(action_id);
    let is_empty = hub_state.tabs.is_empty();
    drop(hub_state);

    let sanitized_id: String = action_id.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect();
    let tab_label = format!("web_hub_tab_{}", sanitized_id);
    if let Some(wv) = app.get_webview(&tab_label) {
        let _ = wv.close();
    }

    if is_empty {
        if let Some(window) = app.get_window("web_hub") {
            let _ = window.hide();
        }
    } else if let Some(ref active_id) = new_active {
        let _ = switch_web_hub_tab(app, state, active_id);
    }

    let hub_state_snapshot = state.web_hub_state.lock().unwrap().clone();
    let _ = app.emit("web_hub_state_changed", &hub_state_snapshot);
    Ok(())
}

/// 刷新 Web Hub 当前活跃 Tab
pub fn reload_web_hub_active_tab(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let active_id = {
        let hub_state = state.web_hub_state.lock().map_err(|e| e.to_string())?;
        hub_state.active_tab_id.clone()
    };
    if let Some(action_id) = active_id {
        let sanitized_id: String = action_id.chars()
            .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
            .collect();
        let tab_label = format!("web_hub_tab_{}", sanitized_id);
        if let Some(wv) = app.get_webview(&tab_label) {
            let _ = wv.eval("window.location.reload()");
            return Ok(());
        }
    }
    Err("No active tab to reload".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_web_hub_state_flow() {
        let mut state = WebHubState::default();
        assert!(state.tabs.is_empty());
        assert_eq!(state.active_tab_id, None);

        // 1. 添加 DeepSeek Tab
        let tab_ds = WebHubTab {
            action_id: "act_deepseek".into(),
            name: "DeepSeek".into(),
            icon: "bot".into(),
            url: "https://chat.deepseek.com".into(),
        };
        state.add_or_activate(tab_ds);
        assert_eq!(state.tabs.len(), 1);
        assert_eq!(state.active_tab_id.as_deref(), Some("act_deepseek"));

        // 2. 添加 Kimi Tab
        let tab_kimi = WebHubTab {
            action_id: "act_kimi".into(),
            name: "Kimi".into(),
            icon: "moon".into(),
            url: "https://kimi.moonshot.cn".into(),
        };
        state.add_or_activate(tab_kimi);
        assert_eq!(state.tabs.len(), 2);
        assert_eq!(state.active_tab_id.as_deref(), Some("act_kimi"));

        // 3. 再次激活 DeepSeek Tab
        let tab_ds2 = WebHubTab {
            action_id: "act_deepseek".into(),
            name: "DeepSeek".into(),
            icon: "bot".into(),
            url: "https://chat.deepseek.com/a/chat/s/restored".into(),
        };
        state.add_or_activate(tab_ds2);
        assert_eq!(state.tabs.len(), 2, "Duplicate tab should not increase count");
        assert_eq!(state.tabs[0].url, "https://chat.deepseek.com/a/chat/s/restored");
        assert_eq!(state.active_tab_id.as_deref(), Some("act_deepseek"));

        // 4. 关闭当前激活的 DeepSeek Tab，自动流转到 Kimi
        let next_active = state.remove_tab("act_deepseek");
        assert_eq!(next_active.as_deref(), Some("act_kimi"));
        assert_eq!(state.active_tab_id.as_deref(), Some("act_kimi"));
        assert_eq!(state.tabs.len(), 1);

        // 5. 关闭最后一个 Kimi Tab
        let next_active2 = state.remove_tab("act_kimi");
        assert_eq!(next_active2, None);
        assert_eq!(state.active_tab_id, None);
        assert!(state.tabs.is_empty());
    }

    #[test]
    fn test_normalize_web_action_url() {
        assert_eq!(
            normalize_web_action_url("https://tongyi.aliyun.com/qianwen/"),
            "https://www.qianwen.com/"
        );
        assert_eq!(
            normalize_web_action_url("https://tongyi.aliyun.com/qianwen/?q={text}"),
            "https://www.qianwen.com/"
        );
        assert_eq!(
            normalize_web_action_url("https://kimi.moonshot.cn/"),
            "https://www.kimi.com/"
        );
        assert_eq!(
            normalize_web_action_url("https://kimi.moonshot.cn/chat/"),
            "https://www.kimi.com/"
        );
        assert_eq!(
            normalize_web_action_url("https://chat.deepseek.com/"),
            "https://chat.deepseek.com/"
        );
    }

    #[test]
    fn test_is_allowed_internal_navigation() {
        // 同源导航放行
        let initial = "https://www.qianwen.com";
        let nav1: tauri::Url = "https://www.qianwen.com/chat/123".parse().unwrap();
        assert!(is_allowed_internal_navigation(initial, &nav1));

        // 阿里 / 千问跨域重定向与认证放行
        let nav_sso: tauri::Url = "https://passport.aliyun.com/login".parse().unwrap();
        assert!(is_allowed_internal_navigation(initial, &nav_sso));

        let initial_tongyi = "https://tongyi.aliyun.com";
        let nav_qw: tauri::Url = "https://www.qianwen.com/".parse().unwrap();
        assert!(is_allowed_internal_navigation(initial_tongyi, &nav_qw));

        // Kimi / Moonshot 跨域重定向放行
        let initial_kimi = "https://kimi.moonshot.cn";
        let nav_kimi_new: tauri::Url = "https://www.kimi.com/chat/".parse().unwrap();
        assert!(is_allowed_internal_navigation(initial_kimi, &nav_kimi_new));

        let initial_kimi_com = "https://www.kimi.com";
        let nav_moonshot: tauri::Url = "https://auth.moonshot.cn/login".parse().unwrap();
        assert!(is_allowed_internal_navigation(initial_kimi_com, &nav_moonshot));

        // 外部无关第三方链接拦截（例如跳转到 wikipedia/github）
        let nav_ext: tauri::Url = "https://en.wikipedia.org/wiki/AI".parse().unwrap();
        assert!(!is_allowed_internal_navigation(initial, &nav_ext));

        let nav_github: tauri::Url = "https://github.com/rust-lang/rust".parse().unwrap();
        assert!(!is_allowed_internal_navigation(initial, &nav_github));
    }
}
