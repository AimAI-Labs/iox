use crate::{
    config::ActionConfig,
    web_sessions::{self, PlatformSync, SidebarEntry, WebSession},
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
const CACHE_FRESH_SECONDS: u64 = 180;

fn recent_success(status: Option<&PlatformSync>, timestamp: u64) -> bool {
    status.is_some_and(|status| {
        matches!(
            status.status.as_str(),
            "ready" | "empty" | "partial" | "incremental"
        ) && status
            .synced_at
            .is_some_and(|at| timestamp >= at && timestamp - at < CACHE_FRESH_SECONDS)
    })
}

fn cache_seed(origin: &str, cached: &[WebSession], full_sync: bool) -> Result<String, String> {
    let rows: Vec<_> = cached
        .iter()
        .take(if full_sync { 0 } else { 2000 })
        .map(|row| {
            serde_json::json!({
                "url": row.url, "title": row.title, "dateStart": row.date_start,
                "dateEnd": row.date_end, "precision": row.precision,
            })
        })
        .collect();
    // Initialization scripts also run after authentication redirects; never expose history there.
    Ok(format!(
        "if (location.origin === {}) {{ window.__ioxHistoryCache = {}; }}",
        serde_json::to_string(origin).map_err(|e| e.to_string())?,
        serde_json::to_string(&rows).map_err(|e| e.to_string())?,
    ))
}

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
    cached: &[WebSession],
    full_sync: bool,
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
            .initialization_script(cache_seed(&initial_origin, cached, full_sync)?)
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
                if done || cached.is_empty() {
                    snapshot.entries
                } else {
                    vec![]
                },
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
            status: if last_count > 0 {
                "partial"
            } else {
                "unavailable"
            }
            .into(),
            count: last_count,
            synced_at: Some(now()),
            error: Some("History loading reached the time limit".into()),
        },
        &initial_origin,
        vec![],
    )
}

#[tauri::command]
pub async fn sync_web_sessions(
    app: AppHandle,
    full_sync: Option<bool>,
    skip_fresh: Option<bool>,
) -> Result<(), String> {
    let Ok(guard) = SYNC_LOCK.try_lock() else {
        return Ok(());
    };
    let config = app.state::<AppState>().config.snapshot();
    let cached = web_sessions::list_web_sessions()?;
    let full_sync = full_sync.unwrap_or(false);
    let skip_fresh = skip_fresh.unwrap_or(false) && !full_sync;
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
        let previous = cached
            .platforms
            .iter()
            .find(|p| p.action_id == action.id && p.platform == platform);
        let source_rows: Vec<_> = cached
            .sessions
            .iter()
            .filter(|row| {
                row.action_id == action.id
                    && tauri::Url::parse(&row.url).is_ok_and(|target| {
                        web_sessions::same_platform_origin(
                            &url.origin().ascii_serialization(),
                            &target.origin().ascii_serialization(),
                        )
                    })
            })
            .cloned()
            .collect();
        let changed_origin =
            source_rows.is_empty() && cached.sessions.iter().any(|row| row.action_id == action.id);
        if skip_fresh && !changed_origin && recent_success(previous, now()) {
            continue;
        }
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
        jobs.push((action, platform, source_rows));
    }
    web_sessions::retain_sources(&app, &active_sources)?;
    tauri::async_runtime::spawn(async move {
        let _guard = guard;
        for (action, platform, rows) in jobs {
            if let Err(error) = sync_platform(&app, &action, &platform, &rows, full_sync).await {
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cache_seed_is_origin_scoped_and_contains_only_comparison_fields() {
        let row = WebSession {
            id: "private-id".into(),
            action_id: "private-action".into(),
            platform: "private-platform".into(),
            title: "Cached title".into(),
            url: "https://chatgpt.com/c/1".into(),
            date_start: Some(1000),
            date_end: Some(1000),
            precision: "exact".into(),
            date_label: "private-label".into(),
            source_order: 99,
        };
        let seed = cache_seed("https://chatgpt.com", &[row.clone()], false).unwrap();
        assert!(seed.starts_with("if (location.origin === \"https://chatgpt.com\") {"));
        assert!(seed.contains("Cached title"));
        assert!(seed.contains("\"dateStart\":1000"));
        assert!(!seed.contains("private-"));
        let full = cache_seed("https://chatgpt.com", &[row], true).unwrap();
        assert!(full.contains("window.__ioxHistoryCache = [];"));
    }
    #[test]
    fn recent_success_uses_ttl_and_never_hides_failures_or_clock_changes() {
        let mut status = PlatformSync {
            action_id: "a".into(),
            platform: "AI".into(),
            status: "incremental".into(),
            count: 5,
            synced_at: Some(1000),
            error: None,
        };
        assert!(recent_success(Some(&status), 1100));
        assert!(!recent_success(Some(&status), 1180));
        assert!(!recent_success(Some(&status), 999));
        status.status = "error".into();
        assert!(!recent_success(Some(&status), 1100));
        assert!(!recent_success(None, 1100));
    }
}
