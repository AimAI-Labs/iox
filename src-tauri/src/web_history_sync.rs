use crate::{
    config::ActionConfig,
    web_sessions::{self, PlatformSync, SidebarEntry},
    AppState,
};
use serde::Deserialize;
use std::{
    collections::HashSet,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, Webview, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

static SYNC_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
const COLLECTOR: &str = include_str!("web_history_collector.js");

#[derive(Deserialize)]
struct Snapshot {
    origin: String,
    status: String,
    entries: Vec<SidebarEntry>,
    error: Option<String>,
    diagnostics: Option<SidebarDiagnostics>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidebarDiagnostics {
    containers: usize,
    candidates: usize,
    page_state: String,
}

struct BackgroundWindow(WebviewWindow);
impl Drop for BackgroundWindow {
    fn drop(&mut self) {
        let _ = self.0.close();
    }
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

async fn evaluate(webview: &Webview) -> Result<String, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    let sender = Mutex::new(Some(send));
    webview
        .eval_with_callback(COLLECTOR, move |value| {
            if let Ok(mut sender) = sender.lock() {
                if let Some(sender) = sender.take() {
                    let _ = sender.send(value);
                }
            }
        })
        .map_err(|e| e.to_string())?;
    tokio::time::timeout(Duration::from_secs(6), receive)
        .await
        .map_err(|_| "Sidebar read timed out".to_string())?
        .map_err(|e| e.to_string())
}

fn platform_name(action: &ActionConfig, host: &str) -> String {
    match host {
        "chatgpt.com" | "chat.openai.com" => "ChatGPT",
        "claude.ai" => "Claude",
        "chat.deepseek.com" => "DeepSeek",
        "kimi.com" | "www.kimi.com" | "kimi.moonshot.cn" => "Kimi",
        "www.doubao.com" | "doubao.com" => "豆包",
        "www.qianwen.com" | "tongyi.aliyun.com" => "千问",
        "chat.qwen.ai" => "Qwen",
        "gemini.google.com" => "Gemini",
        _ => &action.name,
    }
    .to_string()
}

async fn sync_platform(
    app: &AppHandle,
    action: &ActionConfig,
    platform: &str,
) -> Result<(), String> {
    let url = web_sessions::action_url(action)?;
    let initial_origin = url.origin().ascii_serialization();
    let origin = initial_origin.clone();
    // No data_directory override: reuse the same WebView2 profile as IOX's normal web windows.
    // The collector runs in a separate hidden page so its scrolling cannot disrupt a chat.
    let label = format!(
        "iox_history_{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    web_sessions::update_cache(
        app,
        PlatformSync {
            action_id: action.id.clone(),
            platform: platform.into(),
            status: "collecting".into(),
            count: 0,
            synced_at: None,
            error: None,
        },
        &initial_origin,
        vec![],
    )?;
    let window = BackgroundWindow(
        WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
            .title("IOX history sync")
            .visible(false)
            .focused(false)
            .skip_taskbar(true)
            .inner_size(1200.0, 900.0)
            .on_navigation(move |target| {
                matches!(target.scheme(), "http" | "https")
                    && crate::ai::web_action::is_allowed_internal_navigation(&origin, target)
            })
            .build()
            .map_err(|e| e.to_string())?,
    );
    let webview = app
        .get_webview(window.0.label())
        .ok_or("History WebView not available")?;
    let mut previous = String::new();
    let mut last_count = 0;
    for _ in 0..65 {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let raw = evaluate(&webview).await?;
        if raw == "null" || raw.is_empty() {
            continue;
        }
        let snapshot: Snapshot =
            serde_json::from_str(&raw).map_err(|e| format!("Unreadable sidebar result: {e}"))?;
        if snapshot.origin == "null" {
            continue;
        }
        let matching_origin = web_sessions::same_platform_origin(&initial_origin, &snapshot.origin);
        if !matching_origin && snapshot.status == "collecting" {
            continue;
        }
        if !matching_origin {
            web_sessions::update_cache(
                app,
                PlatformSync {
                    action_id: action.id.clone(),
                    platform: platform.into(),
                    status: "login_required".into(),
                    count: 0,
                    synced_at: Some(now()),
                    error: None,
                },
                &initial_origin,
                vec![],
            )?;
            return Ok(());
        }
        if snapshot.status == "error" {
            return Err(snapshot
                .error
                .unwrap_or_else(|| "Cannot inspect sidebar".into()));
        }
        let done = snapshot.status != "collecting";
        let read_error = if snapshot.status == "unavailable" {
            if let Some(diagnostics) = &snapshot.diagnostics {
                eprintln!("History sidebar scan: platform={platform}, containers={}, candidates={}, page_state={}",
                    diagnostics.containers, diagnostics.candidates, diagnostics.page_state);
                Some(if diagnostics.containers == 0 {
                    "未找到历史列表，请打开平台确认侧栏已展开 / History list not found; check the platform sidebar".to_string()
                } else {
                    "已找到侧栏，但没有可读取的会话；请确认登录状态 / Sidebar found, but no readable conversations; check sign-in".to_string()
                })
            } else {
                None
            }
        } else {
            None
        };
        last_count = snapshot.entries.len();
        if raw != previous {
            web_sessions::update_cache(
                app,
                PlatformSync {
                    action_id: action.id.clone(),
                    platform: platform.into(),
                    status: snapshot.status,
                    count: last_count,
                    synced_at: if done { Some(now()) } else { None },
                    error: read_error,
                },
                &snapshot.origin,
                snapshot.entries,
            )?;
            previous = raw;
        }
        if done {
            return Ok(());
        }
    }
    web_sessions::update_cache(
        app,
        PlatformSync {
            action_id: action.id.clone(),
            platform: platform.into(),
            status: "partial".into(),
            count: last_count,
            synced_at: Some(now()),
            error: Some("History loading reached the time limit".into()),
        },
        &initial_origin,
        vec![],
    )
}

#[tauri::command]
pub async fn sync_web_sessions(app: AppHandle) -> Result<(), String> {
    let Ok(guard) = SYNC_LOCK.try_lock() else {
        return Ok(());
    };
    let config = app
        .state::<AppState>()
        .config
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let mut origins = HashSet::new();
    let mut active_sources = HashSet::new();
    let mut jobs = vec![];
    for action in config
        .actions
        .into_iter()
        .filter(|a| a.action_type == "web" && a.enabled)
    {
        let url = match web_sessions::action_url(&action) {
            Ok(url) => url,
            Err(error) => {
                active_sources.insert(action.id.clone());
                web_sessions::update_cache(
                    &app,
                    PlatformSync {
                        action_id: action.id.clone(),
                        platform: action.name.clone(),
                        status: "error".into(),
                        count: 0,
                        synced_at: Some(now()),
                        error: Some(error),
                    },
                    "",
                    vec![],
                )?;
                continue;
            }
        };
        if !origins.insert(url.origin().ascii_serialization()) {
            continue;
        }
        active_sources.insert(action.id.clone());
        let platform = platform_name(&action, url.host_str().unwrap_or(""));
        web_sessions::update_cache(
            &app,
            PlatformSync {
                action_id: action.id.clone(),
                platform: platform.clone(),
                status: "queued".into(),
                count: 0,
                synced_at: None,
                error: None,
            },
            &url.origin().ascii_serialization(),
            vec![],
        )?;
        jobs.push((action, platform));
    }
    web_sessions::retain_sources(&app, &active_sources)?;
    tauri::async_runtime::spawn(async move {
        let _guard = guard;
        for (action, platform) in jobs {
            if let Err(error) = sync_platform(&app, &action, &platform).await {
                let status = PlatformSync {
                    action_id: action.id,
                    platform,
                    status: "error".into(),
                    count: 0,
                    synced_at: Some(now()),
                    error: Some(error),
                };
                if let Err(error) = web_sessions::update_cache(&app, status, "", vec![]) {
                    eprintln!("History cache: {error}");
                }
            }
        }
    });
    Ok(())
}
