//! 远程 PostgreSQL 双向同步：本地 SQLite 始终是读写真源，远程只做合并。
//!
//! 合并规则：`updated_at` 更大的版本胜出；删除写入墓碑（`deleted_at > 0`）后同样
//! 按时间比较。所有操作幂等，因此游标可以回退重放。

mod pg;

use crate::chat_store::{self, ApplyStats, ChatSessionData, SyncChange};
use crate::config::SyncConfig;
use serde::Serialize;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;

/// 游标回退窗口：容忍同秒写入与设备间时钟偏差，重复推拉是幂等的。
const CURSOR_OVERLAP: u64 = 300;
const STARTUP_DELAY: Duration = Duration::from_secs(15);
const SAVE_DEBOUNCE: Duration = Duration::from_secs(5);
const IDLE_INTERVAL: Duration = Duration::from_secs(300);

static WAKE: LazyLock<Arc<tokio::sync::Notify>> =
    LazyLock::new(|| Arc::new(tokio::sync::Notify::new()));
static STATUS: LazyLock<Mutex<SyncStatus>> = LazyLock::new(|| Mutex::new(SyncStatus::default()));

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    /// `disabled` | `idle` | `syncing` | `error`
    pub state: String,
    pub last_success_at: u64,
    pub last_error: Option<String>,
    pub last_pulled: usize,
    pub last_pushed: usize,
}

impl Default for SyncStatus {
    fn default() -> Self {
        Self {
            state: "disabled".to_string(),
            last_success_at: 0,
            last_error: None,
            last_pulled: 0,
            last_pushed: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncOutcome {
    pub applied: usize,
    pub skipped: usize,
    pub pushed: usize,
}

pub fn status() -> SyncStatus {
    STATUS
        .lock()
        .map(|status| status.clone())
        .unwrap_or_default()
}

fn publish(status: &mut SyncStatus) {
    if let Ok(mut current) = STATUS.lock() {
        *current = status.clone();
    }
}

fn publish_state(state: &str, error: Option<String>) {
    if let Ok(mut current) = STATUS.lock() {
        current.state = state.to_string();
        current.last_error = error;
    }
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// 会话保存后唤醒后台同步；未启用时任务会立刻回到等待。
pub fn request_sync() {
    WAKE.notify_one();
}

async fn blocking<T: Send + 'static>(
    task: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    match tauri::async_runtime::spawn_blocking(task).await {
        Ok(result) => result,
        Err(_) => Err("同步任务执行失败".to_string()),
    }
}

async fn run_inner(settings: &SyncConfig) -> Result<SyncOutcome, String> {
    let client = pg::connect(settings).await?;
    pg::ensure_schema(&client).await?;

    let namespace = settings.namespace.clone();
    let pull_key = format!("sync_pull_cursor::{namespace}");
    let push_key = format!("sync_push_cursor::{namespace}");

    // 拉取：应用比本地更新的远程版本（含墓碑）。
    let pull_cursor = {
        let key = pull_key.clone();
        blocking(move || chat_store::sync_cursor(&key)).await?
    };
    let since = pull_cursor.saturating_sub(CURSOR_OVERLAP);
    let remote = pg::fetch(&client, &namespace, since).await?;
    let newest_remote = remote
        .iter()
        .map(|row| row.updated_at)
        .max()
        .unwrap_or(pull_cursor);

    let mut changes: Vec<SyncChange> = Vec::with_capacity(remote.len());
    for row in remote {
        let session = if row.deleted_at > 0 {
            None
        } else {
            match row.payload {
                Some(value) => Some(
                    serde_json::from_value::<ChatSessionData>(value)
                        .map_err(|_| format!("远程会话 {} 的数据无法解析", row.id))?,
                ),
                None => return Err(format!("远程会话 {} 缺少内容", row.id)),
            }
        };
        changes.push(SyncChange {
            id: row.id,
            updated_at: row.updated_at,
            deleted_at: row.deleted_at,
            session,
        });
    }

    let stats = if changes.is_empty() {
        ApplyStats::default()
    } else {
        blocking(move || chat_store::sync_apply(&changes)).await?
    };
    if newest_remote > pull_cursor {
        let key = pull_key.clone();
        blocking(move || chat_store::sync_set_cursor(&key, newest_remote)).await?;
    }

    // 推送：本地比远程新的行（含墓碑），远程侧再做一次后写胜出保护。
    let push_cursor = {
        let key = push_key.clone();
        blocking(move || chat_store::sync_cursor(&key)).await?
    };
    let pending = {
        let since = push_cursor.saturating_sub(CURSOR_OVERLAP);
        blocking(move || chat_store::sync_pending(since)).await?
    };
    let newest_local = pending
        .iter()
        .map(|change| change.updated_at)
        .max()
        .unwrap_or(push_cursor);
    let pushed = pg::push(&client, &namespace, &pending).await?;
    if newest_local > push_cursor {
        let key = push_key.clone();
        blocking(move || chat_store::sync_set_cursor(&key, newest_local)).await?;
    }

    Ok(SyncOutcome {
        applied: stats.applied,
        skipped: stats.skipped,
        pushed,
    })
}

pub async fn run_once(settings: &SyncConfig) -> Result<SyncOutcome, String> {
    if !settings.enabled {
        return Err("远程同步未启用".to_string());
    }

    publish_state("syncing", None);
    let result = run_inner(settings).await;
    match &result {
        Ok(outcome) => publish(&mut SyncStatus {
            state: "idle".to_string(),
            last_success_at: now(),
            last_error: None,
            last_pulled: outcome.applied,
            last_pushed: outcome.pushed,
        }),
        Err(error) => publish(&mut SyncStatus {
            state: "error".to_string(),
            last_error: Some(error.clone()),
            ..status()
        }),
    }
    result
}

/// 启动后台循环：保存后防抖推送，空闲时定时拉取。
pub fn spawn_background(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(STARTUP_DELAY).await;
        loop {
            tokio::select! {
                _ = WAKE.notified() => tokio::time::sleep(SAVE_DEBOUNCE).await,
                _ = tokio::time::sleep(IDLE_INTERVAL) => {}
            }

            let settings = app.state::<crate::AppState>().config.snapshot().sync;
            if !settings.enabled {
                publish_state("disabled", None);
                continue;
            }
            let _ = run_once(&settings).await;
        }
    });
}

#[tauri::command]
pub fn get_sync_status() -> SyncStatus {
    status()
}

#[tauri::command]
pub async fn sync_now(state: tauri::State<'_, crate::AppState>) -> Result<SyncOutcome, String> {
    let settings = state.config.snapshot().sync;
    run_once(&settings).await
}

/// 测试连接使用设置页草稿，避免把未保存的地址误当成已提交配置。
#[tauri::command]
pub async fn test_pg_connection(settings: SyncConfig) -> Result<String, String> {
    let client = pg::connect(&settings).await?;
    pg::server_version(&client).await
}
