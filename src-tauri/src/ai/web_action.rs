use super::scripts::{build_dom_injection_script, build_initialization_script};
use super::template::render_url_template;
use crate::config::{ActionConfig, AppConfig};
use crate::AppState;
use arboard::Clipboard;
use serde::{Deserialize, Serialize};
use tauri::webview::WebviewBuilder;
use tauri::window::WindowBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl};

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
        if !self.tabs.iter().any(|t| t.action_id == tab.action_id) {
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
    let template = action
        .url_template
        .as_deref()
        .unwrap_or("")
        .trim();
    if template.is_empty() {
        return Err(format!("Web action '{}' has no configured URL template", action.name));
    }

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

        let input_sel = action.input_selector.as_deref().unwrap_or_else(|| {
            if template.contains("deepseek.com") || action.id == "act_web_deepseek" {
                "textarea#chat-input, textarea"
            } else if template.contains("tongyi.aliyun.com") || action.id == "act_web_tongyi" || action.id == "tongyi" {
                "textarea, div[contenteditable='true']"
            } else if template.contains("kimi.moonshot.cn") {
                "div[contenteditable='true'], textarea"
            } else if template.contains("claude.ai") {
                "div[contenteditable='true'], fieldset textarea"
            } else if template.contains("doubao.com") {
                "textarea[data-testid*='input'], textarea"
            } else {
                "textarea, div[contenteditable='true']"
            }
        });

        let submit_sel = action.submit_selector.as_deref().or_else(|| {
            if template.contains("deepseek.com") || action.id == "act_web_deepseek" {
                Some("div[role='button'][aria-label*='发送'], div[role='button'][aria-label*='Send'], button[type='submit']")
            } else if template.contains("kimi.moonshot.cn") {
                Some("button[data-testid*='send'], button.send-button")
            } else if template.contains("claude.ai") {
                Some("button[aria-label='Send Message']")
            } else if template.contains("doubao.com") {
                Some("button[data-testid*='send']")
            } else {
                None
            }
        });

        let script = build_dom_injection_script(text, input_sel, submit_sel, auto_sub);
        (base_url, Some(script))
    };

    let target_url: tauri::Url = target_url_str
        .parse()
        .map_err(|e| format!("Invalid target URL '{}': {}", target_url_str, e))?;

    let mode = config.general.web_window_mode.as_str();

    if mode == "tabbed" {
        execute_tabbed_hub_action(app, config, action, target_url, &target_url_str, injection_script)
    } else {
        execute_multi_window_action(app, config, action, target_url, &target_url_str, injection_script)
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
) -> Result<(), String> {
    let sanitized_id: String = action
        .id
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect();
    let label = format!("web_win_{}", sanitized_id);
    let content_label = format!("{}_web", label);
    let bar_label = format!("{}_bar", label);

    // 复用已存在的独立窗口
    if let Some(window) = app.get_window(&label) {
        if let Some(content_wv) = app.get_webview(&content_label) {
            if let Some(ref script) = injection_script {
                let _ = content_wv.eval(script);
            } else {
                let _ = content_wv.navigate(target_url);
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

    let init_script = build_initialization_script(&config.general.theme, injection_script.as_deref());
    let content_builder = WebviewBuilder::new(&content_label, WebviewUrl::External(target_url))
        .transparent(true)
        .zoom_hotkeys_enabled(true)
        .initialization_script(&init_script);

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

    if let Some(script) = injection_script {
        let wv_clone = content_wv.clone();
        tauri::async_runtime::spawn(async move {
            let delays = [800, 1800, 3500, 6000];
            for delay in delays {
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                let _ = wv_clone.eval(&script);
            }
        });
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
) -> Result<(), String> {
    let window_label = "web_hub";
    let bar_label = "web_hub_bar";
    let sanitized_id: String = action
        .id
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect();
    let tab_content_label = format!("web_hub_tab_{}", sanitized_id);

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

    let init_script = build_initialization_script(&config.general.theme, injection_script.as_deref());

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
                let _ = content_wv.eval(script);
            } else {
                let _ = content_wv.navigate(target_url);
            }
        } else {
            // 动态挂载新的 Tab Child Webview
            let content_builder = WebviewBuilder::new(&tab_content_label, WebviewUrl::External(target_url))
                .transparent(true)
                .zoom_hotkeys_enabled(true)
                .initialization_script(&init_script);

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

            if let Some(ref script) = injection_script {
                let wv_clone = new_wv.clone();
                let script_clone = script.clone();
                tauri::async_runtime::spawn(async move {
                    let delays = [800, 1800, 3500, 6000];
                    for delay in delays {
                        tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                        let _ = wv_clone.eval(&script_clone);
                    }
                });
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
    let content_builder = WebviewBuilder::new(&tab_content_label, WebviewUrl::External(target_url))
        .transparent(true)
        .zoom_hotkeys_enabled(true)
        .initialization_script(&init_script);

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

    if let Some(script) = injection_script {
        let wv_clone = content_wv.clone();
        tauri::async_runtime::spawn(async move {
            let delays = [800, 1800, 3500, 6000];
            for delay in delays {
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                let _ = wv_clone.eval(&script);
            }
        });
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
            url: "https://chat.deepseek.com".into(),
        };
        state.add_or_activate(tab_ds2);
        assert_eq!(state.tabs.len(), 2, "Duplicate tab should not increase count");
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
}
