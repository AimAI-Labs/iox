//! 基于 GitHub Release 的更新检测。
//!
//! 自动检查是尽力而为的后台任务：网络、限流或响应解析失败时只返回 `unavailable`，
//! 不阻塞启动、不弹错误通知，也不会覆盖上一次成功的结果。只有确认存在新版本才更新
//! 徽标；设置页打开时读取的是最近一次成功检查的缓存。

use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::AppState;

const RELEASES_API: &str = "https://api.github.com/repos/AimAI-Labs/iox/releases/latest";
const STARTUP_DELAY: Duration = Duration::from_secs(10);
const CHECK_INTERVAL: Duration = Duration::from_secs(12 * 60 * 60);

/// `state` 取值：
/// - `available`：远端版本更高；
/// - `current`：已是最新；
/// - `unknown`：请求成功但 tag 不是可比较的版本号，保留发布页链接；
/// - `unavailable`：请求失败，仅用于手动检查的即时反馈，不写入缓存。
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

fn check_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

fn wake_signal() -> &'static tokio::sync::Notify {
    static WAKE: OnceLock<tokio::sync::Notify> = OnceLock::new();
    WAKE.get_or_init(tokio::sync::Notify::new)
}

/// 配置里打开自动检查时立即唤醒后台循环，而不是等满 12 小时。
pub fn wake() {
    wake_signal().notify_one();
}

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

fn status(
    state: &str,
    current: &str,
    latest_version: Option<String>,
    release_url: Option<String>,
    published_at: Option<String>,
) -> UpdateStatus {
    UpdateStatus {
        state: state.into(),
        current_version: current.to_string(),
        latest_version,
        release_url,
        published_at,
        checked_at: now_secs(),
    }
}

fn unavailable(current: &str) -> UpdateStatus {
    status("unavailable", current, None, None, None)
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
    let link = Some(release.html_url);
    let published = release.published_at;
    if parse_version(latest).is_none() {
        // A tag such as `nightly` must not be reported as "up to date".
        return status("unknown", current, Some(latest.to_string()), link, published);
    }
    let available = is_newer(latest, current);
    let version = latest
        .strip_prefix('v')
        .or_else(|| latest.strip_prefix('V'))
        .unwrap_or(latest)
        .to_string();
    status(
        if available { "available" } else { "current" },
        current,
        Some(version),
        link,
        published,
    )
}

fn cached() -> Option<UpdateStatus> {
    LAST_STATUS.lock().ok().and_then(|cached| cached.clone())
}

/// 只缓存成功的检查结果；瞬时失败保留上一次可用状态，避免徽标闪回消失。
/// 同时拒绝迟到的旧结果覆盖较新的检查。
fn should_replace(cached: Option<&UpdateStatus>, next: &UpdateStatus) -> bool {
    next.state != "unavailable" && cached.is_none_or(|old| old.checked_at <= next.checked_at)
}

fn store(status: &UpdateStatus) {
    let Ok(mut cached) = LAST_STATUS.lock() else {
        return;
    };
    if should_replace(cached.as_ref(), status) {
        *cached = Some(status.clone());
    }
}

async fn check_once(app: &AppHandle, emit: bool) -> UpdateStatus {
    let _guard = check_lock().lock().await;
    let current = app.package_info().version.to_string();
    let status = resolve(&current).await;
    store(&status);
    if emit && status.state != "unavailable" {
        let _ = app.emit("update_status", &status);
    }
    status
}

/// 手动检查；失败时返回降级状态而不是错误，前端可展示“暂时无法检查”。
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> UpdateStatus {
    check_once(&app, true).await
}

/// 设置页首帧读取缓存，避免每次打开设置都请求 GitHub。
#[tauri::command]
pub fn get_update_status() -> Option<UpdateStatus> {
    cached()
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
                check_once(&app, true).await;
            }
            tokio::select! {
                _ = wake_signal().notified() => {}
                _ = tokio::time::sleep(CHECK_INTERVAL) => {}
            }
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
    fn only_successful_and_newer_results_replace_the_cache() {
        let mut older = status("current", "0.1.0", Some("0.1.0".into()), None, None);
        older.checked_at = 10;
        let mut newer = status("available", "0.1.0", Some("0.2.0".into()), None, None);
        newer.checked_at = 20;

        assert!(should_replace(None, &older));
        assert!(should_replace(Some(&older), &newer));
        assert!(!should_replace(Some(&newer), &older));
        assert!(!should_replace(Some(&older), &unavailable("0.1.0")));
    }
}
