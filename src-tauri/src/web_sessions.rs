use crate::{config::ActionConfig, AppState};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager};

static STORE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSession {
    pub id: String,
    pub action_id: String,
    pub platform: String,
    pub title: String,
    pub url: String,
    pub date_start: Option<u64>,
    pub date_end: Option<u64>,
    pub precision: String,
    pub date_label: String,
    pub source_order: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformSync {
    pub action_id: String,
    pub platform: String,
    pub status: String,
    pub count: usize,
    pub synced_at: Option<u64>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryCache {
    pub version: u32,
    pub sessions: Vec<WebSession>,
    pub platforms: Vec<PlatformSync>,
}

impl Default for HistoryCache {
    fn default() -> Self {
        Self {
            version: 1,
            sessions: vec![],
            platforms: vec![],
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidebarEntry {
    pub title: String,
    pub url: String,
    pub date_start: Option<u64>,
    pub date_end: Option<u64>,
    pub precision: String,
    #[serde(default)]
    pub date_label: String,
    pub source_order: usize,
}

pub fn normalize_url(raw: &str) -> Result<String, String> {
    let url = tauri::Url::parse(raw.trim()).map_err(|_| "Invalid conversation URL")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Only HTTP(S) conversation links without credentials are allowed".into());
    }
    Ok(url.to_string())
}

pub fn action_url(action: &ActionConfig) -> Result<tauri::Url, String> {
    if action.action_type != "web" {
        return Err("Not a web action".into());
    }
    let base = crate::ai::web_action::normalize_web_action_url(
        action.url_template.as_deref().unwrap_or(""),
    );
    let base = crate::ai::render_url_template(&base, "");
    tauri::Url::parse(&normalize_url(&base)?).map_err(|e| e.to_string())
}

pub fn same_platform_origin(left: &str, right: &str) -> bool {
    if left == right {
        return true;
    }
    let (Ok(left), Ok(right)) = (tauri::Url::parse(left), tauri::Url::parse(right)) else {
        return false;
    };
    if left.scheme() != "https" || right.scheme() != "https" || left.port() != right.port() {
        return false;
    }
    [
        &["chat.openai.com", "chatgpt.com"][..],
        &["kimi.com", "www.kimi.com", "kimi.moonshot.cn"],
        &["doubao.com", "www.doubao.com"],
    ]
    .iter()
    .any(|aliases| {
        aliases.contains(&left.host_str().unwrap_or(""))
            && aliases.contains(&right.host_str().unwrap_or(""))
    })
}

fn store_path() -> PathBuf {
    // Keep manual bookmarks untouched. They are not platform history.
    let name = if cfg!(debug_assertions) {
        "web-history-dev.json"
    } else {
        "web-history.json"
    };
    crate::config::AppConfig::config_dir().join(name)
}

impl HistoryCache {
    fn read(path: &Path) -> Result<Self, String> {
        let bytes = match fs::read(path) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Self::default()),
            Err(e) => return Err(e.to_string()),
        };
        let cache: Self = serde_json::from_slice(&bytes)
            .map_err(|e| format!("Cannot read history cache: {e}"))?;
        if cache.version != 1 {
            return Err("Unsupported history cache version".into());
        }
        Ok(cache)
    }

    fn write(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        use std::io::Write;
        let temp = path.with_extension("json.tmp");
        let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
        file.write_all(&serde_json::to_vec_pretty(self).map_err(|e| e.to_string())?)
            .and_then(|_| file.sync_all())
            .map_err(|e| e.to_string())?;
        drop(file);
        fs::rename(temp, path).map_err(|e| e.to_string())
    }

    fn replace_sidebar(
        &mut self,
        mut status: PlatformSync,
        origin: &str,
        entries: Vec<SidebarEntry>,
    ) {
        let mut sessions = vec![];
        let mut seen = std::collections::HashSet::new();
        for entry in entries.into_iter().take(2000) {
            let Ok(url) = normalize_url(&entry.url) else {
                continue;
            };
            let Ok(parsed) = tauri::Url::parse(&url) else {
                continue;
            };
            if parsed.origin().ascii_serialization() != origin
                || !seen.insert(url.clone())
                || entry.title.trim().is_empty()
            {
                continue;
            }
            let valid_date = matches!(entry.precision.as_str(), "exact" | "day" | "range")
                && matches!((entry.date_start, entry.date_end), (Some(start), Some(end)) if start <= end && start > 946684800 && end < 4102444800);
            sessions.push(WebSession {
                id: format!("{}::{url}", status.action_id),
                action_id: status.action_id.clone(),
                platform: status.platform.clone(),
                title: entry.title.trim().chars().take(300).collect(),
                url,
                date_start: if valid_date { entry.date_start } else { None },
                date_end: if valid_date { entry.date_end } else { None },
                precision: if valid_date {
                    entry.precision
                } else {
                    "unknown".into()
                },
                date_label: entry.date_label.chars().take(80).collect(),
                source_order: entry.source_order,
            });
        }
        let mut existing: Vec<_> = self
            .sessions
            .iter()
            .filter(|s| {
                s.action_id == status.action_id
                    && tauri::Url::parse(&s.url).is_ok_and(|url| {
                        same_platform_origin(origin, &url.origin().ascii_serialization())
                    })
            })
            .cloned()
            .collect();
        existing.sort_by_key(|s| s.source_order);
        let merge = matches!(status.status.as_str(), "incremental" | "partial");
        if merge {
            for row in &mut sessions {
                if row.precision == "unknown" {
                    if let Some(old) = existing.iter().find(|old| old.id == row.id) {
                        row.date_start = old.date_start;
                        row.date_end = old.date_end;
                        row.precision = old.precision.clone();
                        row.date_label = old.date_label.clone();
                    }
                }
            }
            let observed: std::collections::HashSet<_> =
                sessions.iter().map(|s| s.id.clone()).collect();
            sessions.sort_by_key(|s| s.source_order);
            sessions.extend(existing.into_iter().filter(|s| !observed.contains(&s.id)));
            for (index, row) in sessions.iter_mut().enumerate() {
                row.source_order = index;
            }
        }
        // Only a complete scan can reconcile deletions. No overlap can simply mean many new chats.
        if !sessions.is_empty()
            || matches!(status.status.as_str(), "empty" | "login_required" | "ready")
        {
            self.sessions.retain(|s| s.action_id != status.action_id);
            self.sessions.extend(sessions);
        }
        status.count = self
            .sessions
            .iter()
            .filter(|s| s.action_id == status.action_id)
            .count();
        if status.synced_at.is_none() {
            status.synced_at = self
                .platforms
                .iter()
                .find(|p| p.action_id == status.action_id)
                .and_then(|p| p.synced_at);
        }
        self.platforms.retain(|p| p.action_id != status.action_id);
        self.platforms.push(status);
    }
}

pub fn update_cache(
    app: &AppHandle,
    status: PlatformSync,
    origin: &str,
    entries: Vec<SidebarEntry>,
) -> Result<(), String> {
    let _guard = STORE_LOCK.lock().map_err(|e| e.to_string())?;
    let path = store_path();
    let mut cache = HistoryCache::read(&path)?;
    let previous = cache.clone();
    cache.replace_sidebar(status, origin, entries);
    if cache == previous {
        return Ok(());
    }
    cache.write(&path)?;
    let _ = app.emit("web_sessions_changed", ());
    Ok(())
}

pub fn retain_sources(
    app: &AppHandle,
    active: &std::collections::HashSet<String>,
) -> Result<(), String> {
    let _guard = STORE_LOCK.lock().map_err(|e| e.to_string())?;
    let path = store_path();
    let mut cache = HistoryCache::read(&path)?;
    let previous = cache.clone();
    cache.sessions.retain(|s| active.contains(&s.action_id));
    cache.platforms.retain(|p| active.contains(&p.action_id));
    if cache == previous {
        return Ok(());
    }
    cache.write(&path)?;
    let _ = app.emit("web_sessions_changed", ());
    Ok(())
}

#[tauri::command]
pub fn list_web_sessions() -> Result<HistoryCache, String> {
    let _guard = STORE_LOCK.lock().map_err(|e| e.to_string())?;
    let mut cache = HistoryCache::read(&store_path())?;
    cache.sessions.sort_by(|a, b| {
        b.date_end
            .cmp(&a.date_end)
            .then(a.source_order.cmp(&b.source_order))
            .then(a.id.cmp(&b.id))
    });
    Ok(cache)
}

#[tauri::command]
pub async fn open_web_session(app: AppHandle, id: String, external: bool) -> Result<(), String> {
    let session = list_web_sessions()?
        .sessions
        .into_iter()
        .find(|s| s.id == id)
        .ok_or("Session no longer exists; sync again")?;
    let url = normalize_url(&session.url)?;
    if external {
        return open::that_detached(&url).map_err(|e| e.to_string());
    }
    let config = app.state::<AppState>().config.snapshot();
    let action = config
        .actions
        .iter()
        .find(|a| a.id == session.action_id && a.action_type == "web")
        .ok_or("Web platform removed")?;
    let base = action_url(action)?;
    let target = tauri::Url::parse(&url).map_err(|e| e.to_string())?;
    if !same_platform_origin(
        &base.origin().ascii_serialization(),
        &target.origin().ascii_serialization(),
    ) {
        return Err("Platform URL changed; sync again".into());
    }
    // Website timestamps must not change when a cached record is opened.
    crate::ai::web_action::resume_web_session(&app, &config, action, &url)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn status(state: &str) -> PlatformSync {
        PlatformSync {
            action_id: "gpt".into(),
            platform: "ChatGPT".into(),
            status: state.into(),
            count: 1,
            synced_at: Some(1800000000),
            error: None,
        }
    }
    fn entry(url: &str) -> SidebarEntry {
        SidebarEntry {
            title: "Real title".into(),
            url: url.into(),
            date_start: Some(1700000000),
            date_end: Some(1700000000),
            precision: "exact".into(),
            date_label: "".into(),
            source_order: 0,
        }
    }
    #[test]
    fn snapshot_deduplicates_and_rejects_cross_origin_links() {
        let mut cache = HistoryCache::default();
        cache.replace_sidebar(
            status("ready"),
            "https://chatgpt.com",
            vec![
                entry("https://chatgpt.com/c/1"),
                entry("https://chatgpt.com/c/1"),
                entry("https://evil.test/c/2"),
            ],
        );
        assert_eq!(cache.sessions.len(), 1);
        assert_eq!(cache.sessions[0].date_end, Some(1700000000));
        cache.replace_sidebar(
            status("ready"),
            "https://chatgpt.com",
            vec![entry("https://chatgpt.com/c/2")],
        );
        assert_eq!(cache.sessions.len(), 1);
        assert!(cache.sessions[0].url.ends_with("/2"));
    }
    #[test]
    fn unknown_dates_are_not_replaced_with_sync_time_and_logout_clears_cache() {
        let mut cache = HistoryCache::default();
        let mut row = entry("https://chatgpt.com/c/1");
        row.date_start = None;
        cache.replace_sidebar(status("ready"), "https://chatgpt.com", vec![row]);
        assert_eq!(cache.sessions[0].date_end, None);
        assert_eq!(cache.sessions[0].precision, "unknown");
        cache.replace_sidebar(status("login_required"), "https://chatgpt.com", vec![]);
        assert!(cache.sessions.is_empty());
    }
    #[test]
    fn cache_round_trip_and_corruption_are_safe() {
        let path =
            std::env::temp_dir().join(format!("iox-sidebar-test-{}.json", std::process::id()));
        let cache = HistoryCache::default();
        cache.write(&path).unwrap();
        cache.write(&path).unwrap();
        assert_eq!(HistoryCache::read(&path).unwrap().version, 1);
        fs::write(&path, "corrupt").unwrap();
        assert!(HistoryCache::read(&path).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "corrupt");
        fs::remove_file(path).unwrap();
    }
    #[test]
    fn unsafe_urls_are_rejected() {
        for raw in [
            "javascript:alert(1)",
            "file:///C:/secret",
            "https://u:p@chatgpt.com/c/a",
        ] {
            assert!(normalize_url(raw).is_err());
        }
    }

    #[test]
    fn incremental_updates_keep_older_rows_and_update_existing_titles() {
        let mut cache = HistoryCache::default();
        cache.replace_sidebar(
            status("ready"),
            "https://chatgpt.com",
            vec![
                entry("https://chatgpt.com/c/old"),
                entry("https://chatgpt.com/c/current"),
            ],
        );
        let mut changed = entry("https://chatgpt.com/c/current");
        changed.title = "Renamed on website".into();
        changed.date_start = None;
        changed.date_end = None;
        changed.precision = "unknown".into();
        cache.replace_sidebar(
            status("incremental"),
            "https://chatgpt.com",
            vec![entry("https://chatgpt.com/c/new"), changed],
        );
        assert_eq!(cache.sessions.len(), 3);
        let current = cache
            .sessions
            .iter()
            .find(|s| s.url.ends_with("/current"))
            .unwrap();
        assert_eq!(current.title, "Renamed on website");
        assert_eq!(current.date_end, Some(1700000000));
        assert_eq!(cache.platforms[0].count, 3);
    }

    #[test]
    fn incomplete_scans_preserve_overlap_but_complete_scans_reconcile_deletions() {
        let mut cache = HistoryCache::default();
        cache.replace_sidebar(
            status("ready"),
            "https://chatgpt.com",
            vec![
                entry("https://chatgpt.com/c/1"),
                entry("https://chatgpt.com/c/2"),
            ],
        );
        cache.replace_sidebar(
            status("partial"),
            "https://chatgpt.com",
            vec![entry("https://chatgpt.com/c/2")],
        );
        assert_eq!(cache.sessions.len(), 2);
        cache.replace_sidebar(status("error"), "", vec![]);
        assert_eq!(cache.sessions.len(), 2);
        cache.replace_sidebar(
            status("ready"),
            "https://chatgpt.com",
            vec![entry("https://chatgpt.com/c/2")],
        );
        assert_eq!(cache.sessions.len(), 1);
    }

    #[test]
    fn queued_updates_preserve_cache_metadata_and_repeated_updates_are_idempotent() {
        let mut cache = HistoryCache::default();
        cache.replace_sidebar(
            status("ready"),
            "https://chatgpt.com",
            vec![
                entry("https://chatgpt.com/c/1"),
                entry("https://chatgpt.com/c/2"),
            ],
        );
        let mut queued = status("queued");
        queued.synced_at = None;
        queued.count = 0;
        cache.replace_sidebar(queued.clone(), "https://chatgpt.com", vec![]);
        assert_eq!(cache.platforms[0].count, 2);
        assert_eq!(cache.platforms[0].synced_at, Some(1800000000));
        let previous = cache.clone();
        cache.replace_sidebar(queued, "https://chatgpt.com", vec![]);
        assert_eq!(cache, previous);
    }

    #[test]
    fn disjoint_partial_results_do_not_delete_older_cached_conversations() {
        let mut cache = HistoryCache::default();
        cache.replace_sidebar(
            status("ready"),
            "https://chatgpt.com",
            vec![entry("https://chatgpt.com/c/old")],
        );
        cache.replace_sidebar(
            status("partial"),
            "https://chatgpt.com",
            vec![entry("https://chatgpt.com/c/new")],
        );
        assert_eq!(cache.sessions.len(), 2);
        cache.replace_sidebar(status("login_required"), "https://chatgpt.com", vec![]);
        assert!(cache.sessions.is_empty());
    }
}
