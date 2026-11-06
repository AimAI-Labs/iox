//! 基于 GitHub Release 的更新检测。
//!
//! 自动检查是尽力而为的后台任务：网络、限流或响应解析失败时只保留“无法检查”的
//! 降级状态，不阻塞启动、不弹错误通知。只有确认存在新版本才广播 `update_available`。

use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::AppState;

const RELEASES_API: &str = "https://api.github.com/repos/AimAI-Labs/iox/releases/latest";
const STARTUP_DELAY: Duration = Duration::from_secs(10);
const CHECK_INTERVAL: Duration = Duration::from_secs(12 * 60 * 60);

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub state: String,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_url: Option<String>,
    pub published_at: Option<String>,
    pub checked_at: u64,
}

#[derive(Debug, Deserialize)]
struct Release {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    draft: bool,
}

static LAST_STATUS: Mutex<Option<UpdateStatus>> = Mutex::new(None);

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0)
}

/// Accept `v1.2.3`, `1.2`, `1.2.3-beta.1` and ignore build metadata.
fn parse_version(value: &str) -> Option<(u64, u64, u64)> {
    let trimmed = value.trim();
    let trimmed = trimmed
        .strip_prefix('v')
        .or_else(|| trimmed.strip_prefix('V'))
        .unwrap_or(trimmed);
    let core = trimmed.split(['-', '+']).next()?;
    let mut parts = core.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next().unwrap_or("0").parse().ok()?;
    let patch = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(latest), Some(current)) => latest > current,
        _ => false,
    }
}

fn unavailable(current: &str) -> UpdateStatus {
    UpdateStatus {
        state: "unavailable".into(),
        current_version: current.to_string(),
        latest_version: None,
        release_url: None,
        published_at: None,
        checked_at: now_secs(),
    }
}

async fn latest_release() -> Result<Release, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .connect_timeout(Duration::from_secs(4))
        .user_agent(concat!("IOX/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| "update client unavailable".to_string())?;
    let response = client
        .get(RELEASES_API)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|_| "update request failed".to_string())?;
    if !response.status().is_success() {
        // Only the status line is kept; response bodies are never surfaced or logged.
        return Err(format!("github status {}", response.status().as_u16()));
    }
    response
        .json::<Release>()
        .await
        .map_err(|_| "update response invalid".to_string())
}

async fn resolve(current: &str) -> UpdateStatus {
    let release = match latest_release().await {
        Ok(release) => release,
        Err(reason) => {
            eprintln!("Update check unavailable: {reason}");
            return unavailable(current);
        }
    };
    if release.draft || release.prerelease {
        return unavailable(current);
    }
    let latest = release.tag_name.trim();
    let available = is_newer(latest, current);
    UpdateStatus {
        state: if available { "available" } else { "current" }.into(),
        current_version: current.to_string(),
        latest_version: parse_version(latest).map(|_| {
            latest
                .strip_prefix('v')
                .or_else(|| latest.strip_prefix('V'))
                .unwrap_or(latest)
                .to_string()
        }),
        release_url: Some(release.html_url),
        published_at: release.published_at,
        checked_at: now_secs(),
    }
}

fn publish(status: UpdateStatus) -> UpdateStatus {
    if let Ok(mut cached) = LAST_STATUS.lock() {
        *cached = Some(status.clone());
    }
    status
}

/// 手动检查；失败时返回降级状态而不是错误，前端可展示“暂时无法检查”。
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> UpdateStatus {
    let current = app.package_info().version.to_string();
    let status = publish(resolve(&current).await);
    if status.state == "available" {
        let _ = app.emit("update_available", &status);
    }
    status
}

/// 设置页首帧读取缓存，避免每次打开设置都请求 GitHub。
#[tauri::command]
pub fn get_update_status() -> Option<UpdateStatus> {
    LAST_STATUS.lock().ok().and_then(|cached| cached.clone())
}

pub fn spawn_background(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(STARTUP_DELAY).await;
        loop {
            let enabled = app
                .state::<AppState>()
                .config
                .try_snapshot()
                .map(|config| config.general.auto_check_update)
                .unwrap_or(true);
            if enabled {
                let current = app.package_info().version.to_string();
                let status = publish(resolve(&current).await);
                if status.state == "available" {
                    let _ = app.emit("update_available", &status);
                }
            }
            tokio::time::sleep(CHECK_INTERVAL).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_release_tags_with_optional_prefix_and_suffix() {
        assert_eq!(parse_version("v0.1.0"), Some((0, 1, 0)));
        assert_eq!(parse_version("1.2"), Some((1, 2, 0)));
        assert_eq!(parse_version("1.2.3-beta.1"), Some((1, 2, 3)));
        assert_eq!(parse_version("1.2.3+build.7"), Some((1, 2, 3)));
        assert_eq!(parse_version("nightly"), None);
        assert_eq!(parse_version("v"), None);
    }

    #[test]
    fn only_newer_versions_offer_an_update() {
        assert!(is_newer("v0.2.0", "0.1.0"));
        assert!(is_newer("0.1.10", "0.1.9"));
        assert!(!is_newer("0.1.0", "0.1.0"));
        assert!(!is_newer("0.0.9", "0.1.0"));
        assert!(!is_newer("latest", "0.1.0"));
        assert!(!is_newer("0.2.0", "unknown"));
    }

    #[test]
    fn unavailable_status_still_reports_the_local_version() {
        let status = unavailable("0.1.0");
        assert_eq!(status.state, "unavailable");
        assert_eq!(status.current_version, "0.1.0");
        assert_eq!(status.latest_version, None);
        assert!(status.release_url.is_none());
    }
}
