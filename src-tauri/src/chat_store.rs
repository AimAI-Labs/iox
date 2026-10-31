use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

mod jsonl;
mod sqlite;
#[cfg(test)]
mod tests;

/// 历史保留上限；放宽它需要前端分页，因此暂与旧实现保持一致。
const MAX_SESSIONS: usize = 200;

// 所有生产命令共用这个进程内锁，保证读改写与一次性导入不会交错。
static SESSION_STORE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageItem {
    pub role: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSessionData {
    pub id: String,
    pub title: String,
    pub action_id: String,
    pub provider_id: Option<String>,
    pub model: String,
    pub selected_text: String,
    pub stream_text: String,
    #[serde(default)]
    pub messages: Vec<ChatMessageItem>,
    // 该负载由 conversation 模块按版本管理；保留未知字段。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversation: Option<serde_json::Value>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub id: String,
    pub title: String,
    pub action_id: String,
    pub model: String,
    pub updated_at: u64,
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn generate_session_id() -> String {
    let ts = current_timestamp();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("sess_{}_{:08x}", ts, nanos)
}

/// 修复旧版本写入的“--- **追问：** ...”标题
fn repair_legacy_title(session: &mut ChatSessionData) -> bool {
    const MARKER: &str = "**追问：**";
    if !session.title.contains(MARKER) {
        return false;
    }

    let Some(index) = session.stream_text.find(MARKER) else {
        return false;
    };
    let rest = &session.stream_text[index + MARKER.len()..];
    let prompt = rest.split("<!-- iox:answer -->").next().unwrap_or(rest);
    let cleaned = prompt.split_whitespace().collect::<Vec<_>>().join(" ");

    if cleaned.is_empty() {
        return false;
    }

    let title: String = cleaned.chars().take(28).collect();
    if session.title == title {
        return false;
    }

    session.title = title;
    true
}

/// 去重身份：与历史 `same_content` 判定一致，空回答不参与去重。
#[derive(Serialize)]
struct SessionContent<'a> {
    action_id: &'a str,
    selected_text: &'a str,
    stream_text: &'a str,
    conversation: &'a Option<serde_json::Value>,
}

fn content_hash(session: &ChatSessionData) -> Option<String> {
    if session.stream_text.trim().is_empty() {
        return None;
    }
    let bytes = serde_json::to_vec(&SessionContent {
        action_id: &session.action_id,
        selected_text: &session.selected_text,
        stream_text: &session.stream_text,
        conversation: &session.conversation,
    })
    .ok()?;
    Some(blake3::hash(&bytes).to_hex().to_string())
}

fn prepare_session(session: &mut ChatSessionData) {
    if session.id.is_empty() {
        session.id = generate_session_id();
    }
    if session.created_at == 0 {
        session.created_at = current_timestamp();
    }
    session.updated_at = current_timestamp();

    if session.title.trim().is_empty() {
        let snippet = if !session.selected_text.trim().is_empty() {
            &session.selected_text
        } else if let Some(first_msg) = session.messages.first() {
            &first_msg.content
        } else if !session.stream_text.trim().is_empty() {
            &session.stream_text
        } else {
            "新对话"
        };
        session.title = snippet
            .chars()
            .take(28)
            .collect::<String>()
            .replace('\n', " ");
    }

    // 空标题回退后也尝试修复旧格式追问标记
    repair_legacy_title(session);
}

/// 拥有 SQLite 读写事务与旧版 JSONL 的一次性导入。
struct SessionStore<'a> {
    db_path: PathBuf,
    legacy_path: PathBuf,
    lock: &'a Mutex<()>,
}

impl<'a> SessionStore<'a> {
    fn new(db_path: PathBuf, legacy_path: PathBuf, lock: &'a Mutex<()>) -> Self {
        Self {
            db_path,
            legacy_path,
            lock,
        }
    }

    fn guard(&self) -> Result<std::sync::MutexGuard<'_, ()>, String> {
        self.lock.lock().map_err(|_| "会话存储锁异常".to_string())
    }

    /// 只读入口：历史完全不存在时不创建目录或文件。
    fn read_connection(&self) -> Result<Option<rusqlite::Connection>, String> {
        if !self.db_path.exists() && !self.legacy_path.exists() {
            return Ok(None);
        }
        Ok(Some(self.open_connection()?))
    }

    fn open_connection(&self) -> Result<rusqlite::Connection, String> {
        let mut conn = sqlite::open(&self.db_path)?;
        self.import_legacy(&mut conn)?;
        Ok(conn)
    }

    fn import_legacy(&self, conn: &mut rusqlite::Connection) -> Result<(), String> {
        if sqlite::legacy_imported(conn)? || !self.legacy_path.exists() {
            return Ok(());
        }

        let mut sessions = jsonl::read(&self.legacy_path)?;
        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        for session in &mut sessions {
            repair_legacy_title(session);
        }
        sqlite::import(conn, &mut sessions, MAX_SESSIONS)?;

        // 导入标记已提交；备份失败只影响用户找回原文件，不回滚数据。
        let backup = self.legacy_path.with_extension("jsonl.migrated");
        let _ = std::fs::rename(&self.legacy_path, backup);
        Ok(())
    }

    fn all(&self) -> Result<Vec<ChatSessionData>, String> {
        let _guard = self.guard()?;
        match self.read_connection()? {
            Some(conn) => sqlite::all(&conn),
            None => Ok(Vec::new()),
        }
    }

    fn list(&self) -> Result<Vec<SessionMeta>, String> {
        let _guard = self.guard()?;
        match self.read_connection()? {
            Some(conn) => sqlite::list(&conn),
            None => Ok(Vec::new()),
        }
    }

    fn get(&self, id: &str) -> Result<ChatSessionData, String> {
        let _guard = self.guard()?;
        let session = match self.read_connection()? {
            Some(conn) => sqlite::get(&conn, id)?,
            None => None,
        };
        session.ok_or_else(|| format!("Session '{}' not found", id))
    }

    fn save(&self, mut session: ChatSessionData) -> Result<String, String> {
        let _guard = self.guard()?;
        let mut conn = self.open_connection()?;
        prepare_session(&mut session);
        let hash = content_hash(&session);
        sqlite::save(&mut conn, &mut session, hash.as_deref(), MAX_SESSIONS)
    }

    fn delete(&self, id: &str) -> Result<(), String> {
        let _guard = self.guard()?;
        match self.read_connection()? {
            Some(conn) => sqlite::delete(&conn, id),
            None => Ok(()),
        }
    }

    fn clear(&self) -> Result<(), String> {
        let _guard = self.guard()?;
        // 先完成导入，避免清空后旧文件在下一次读取时又被导回来。
        let conn = self.open_connection()?;
        sqlite::clear(&conn)
    }
}

fn production_store() -> SessionStore<'static> {
    SessionStore::new(
        crate::config::AppConfig::sessions_db_path(),
        crate::config::AppConfig::sessions_path(),
        &SESSION_STORE_LOCK,
    )
}

/// 同步命令在主线程执行；数据库与导入都是阻塞 IO，统一切到阻塞线程池。
async fn run_blocking<T: Send + 'static>(
    task: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    match tauri::async_runtime::spawn_blocking(task).await {
        Ok(result) => result,
        Err(_) => Err("会话存储任务执行失败".to_string()),
    }
}

#[tauri::command]
pub async fn list_chat_sessions() -> Result<Vec<SessionMeta>, String> {
    run_blocking(|| production_store().list()).await
}

#[tauri::command]
pub async fn get_all_full_chat_sessions() -> Result<Vec<ChatSessionData>, String> {
    run_blocking(|| production_store().all()).await
}

#[tauri::command]
pub async fn get_chat_session(id: String) -> Result<ChatSessionData, String> {
    run_blocking(move || production_store().get(&id)).await
}

#[tauri::command]
pub async fn save_chat_session(session: ChatSessionData) -> Result<String, String> {
    run_blocking(move || production_store().save(session)).await
}

#[tauri::command]
pub async fn delete_chat_session(id: String) -> Result<(), String> {
    run_blocking(move || production_store().delete(&id)).await
}

#[tauri::command]
pub async fn clear_all_chat_sessions() -> Result<(), String> {
    run_blocking(|| production_store().clear()).await
}

#[tauri::command]
pub fn open_sessions_directory() -> Result<String, String> {
    let path = crate::config::AppConfig::sessions_db_path();
    let dir = path.parent().unwrap_or(&path);
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let dir_str = dir.to_string_lossy().to_string();
    let _ = open::that(dir);
    Ok(dir_str)
}
