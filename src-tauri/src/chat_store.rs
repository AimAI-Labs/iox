use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

mod jsonl;
#[cfg(test)]
mod tests;

// Every production command uses this same process-local lock.
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

/// 合并内容完全相同的重复会话：
/// - 会话已按 updated_at 倒序，保留最新一条
/// - 合并时保留最早的创建时间
fn dedupe_sessions_by_content(sessions: &mut Vec<ChatSessionData>) {
    let mut index = 0;

    while index < sessions.len() {
        if sessions[index].stream_text.trim().is_empty() {
            index += 1;
            continue;
        }

        let mut next = index + 1;
        while next < sessions.len() {
            let same_content = sessions[next].action_id == sessions[index].action_id
                && sessions[next].selected_text == sessions[index].selected_text
                && sessions[next].stream_text == sessions[index].stream_text;

            if same_content {
                let removed = sessions.remove(next);
                if removed.created_at > 0
                    && (sessions[index].created_at == 0
                        || removed.created_at < sessions[index].created_at)
                {
                    sessions[index].created_at = removed.created_at;
                }
            } else {
                next += 1;
            }
        }

        index += 1;
    }
}

/// 写入或更新到内存列表，返回最终使用的会话 ID。
/// 若找不到传入 ID，但存在内容完全一致的会话，则复用已有 ID，避免重复存储。
fn upsert_session(sessions: &mut Vec<ChatSessionData>, mut session: ChatSessionData) -> String {
    if let Some(pos) = sessions.iter().position(|item| item.id == session.id) {
        let existing_created_at = sessions[pos].created_at;
        if existing_created_at > 0
            && (session.created_at == 0 || existing_created_at < session.created_at)
        {
            session.created_at = existing_created_at;
        }

        let id = session.id.clone();
        sessions[pos] = session;
        return id;
    }

    if !session.stream_text.trim().is_empty() {
        if let Some(pos) = sessions.iter().position(|item| {
            item.action_id == session.action_id
                && item.selected_text == session.selected_text
                && item.stream_text == session.stream_text
        }) {
            let existing_id = sessions[pos].id.clone();
            let existing_created_at = sessions[pos].created_at;

            session.id = existing_id.clone();
            if existing_created_at > 0
                && (session.created_at == 0 || existing_created_at < session.created_at)
            {
                session.created_at = existing_created_at;
            }

            sessions[pos] = session;
            return existing_id;
        }
    }

    let id = session.id.clone();
    sessions.insert(0, session);
    id
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

/// Owns the complete read/normalize/change/commit transaction.
struct SessionStore<'a> {
    path: PathBuf,
    lock: &'a Mutex<()>,
    io: &'a dyn jsonl::Io,
}

impl<'a> SessionStore<'a> {
    fn new(path: PathBuf, lock: &'a Mutex<()>) -> Self {
        Self {
            path,
            lock,
            io: &jsonl::FileIo,
        }
    }

    fn snapshot(&self) -> Result<Vec<ChatSessionData>, String> {
        let mut sessions = jsonl::read(&self.path, self.io)?;
        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        dedupe_sessions_by_content(&mut sessions);
        for session in &mut sessions {
            repair_legacy_title(session);
        }
        Ok(sessions)
    }

    fn all(&self) -> Result<Vec<ChatSessionData>, String> {
        let _guard = self.lock.lock().map_err(|_| "会话存储锁异常".to_string())?;
        self.snapshot()
    }

    fn list(&self) -> Result<Vec<SessionMeta>, String> {
        Ok(self
            .all()?
            .into_iter()
            .map(|s| SessionMeta {
                id: s.id,
                title: s.title,
                action_id: s.action_id,
                model: s.model,
                updated_at: s.updated_at,
            })
            .collect())
    }

    fn get(&self, id: &str) -> Result<ChatSessionData, String> {
        self.all()?
            .into_iter()
            .find(|s| s.id == id)
            .ok_or_else(|| format!("Session '{}' not found", id))
    }

    fn save(&self, mut session: ChatSessionData) -> Result<String, String> {
        let _guard = self.lock.lock().map_err(|_| "会话存储锁异常".to_string())?;
        let mut sessions = self.snapshot()?;
        prepare_session(&mut session);
        let canonical = upsert_session(&mut sessions, session);
        self.commit(sessions, Some(&canonical))?;
        Ok(canonical)
    }

    fn delete(&self, id: &str) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|_| "会话存储锁异常".to_string())?;
        let mut sessions = self.snapshot()?;
        sessions.retain(|s| s.id != id);
        self.commit(sessions, None)
    }

    fn clear(&self) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|_| "会话存储锁异常".to_string())?;
        self.snapshot()?;
        self.commit(Vec::new(), None)
    }

    // Called only while the transaction lock is held; stable sorting preserves ties.
    fn commit(
        &self,
        mut sessions: Vec<ChatSessionData>,
        canonical: Option<&str>,
    ) -> Result<(), String> {
        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        sessions.truncate(200);
        if canonical.is_some_and(|id| !sessions.iter().any(|s| s.id == id)) {
            return Err("会话未能保留在历史上限内，保存已取消".to_string());
        }
        jsonl::commit(&self.path, &sessions, self.io)
    }
}

fn production_store() -> SessionStore<'static> {
    SessionStore::new(
        crate::config::AppConfig::sessions_path(),
        &SESSION_STORE_LOCK,
    )
}

#[tauri::command]
pub fn list_chat_sessions() -> Result<Vec<SessionMeta>, String> {
    production_store().list()
}
#[tauri::command]
pub fn get_all_full_chat_sessions() -> Result<Vec<ChatSessionData>, String> {
    production_store().all()
}
#[tauri::command]
pub fn get_chat_session(id: String) -> Result<ChatSessionData, String> {
    production_store().get(&id)
}
#[tauri::command]
pub fn save_chat_session(session: ChatSessionData) -> Result<String, String> {
    production_store().save(session)
}
#[tauri::command]
pub fn delete_chat_session(id: String) -> Result<(), String> {
    production_store().delete(&id)
}
#[tauri::command]
pub fn clear_all_chat_sessions() -> Result<(), String> {
    production_store().clear()
}

#[tauri::command]
pub fn open_sessions_directory() -> Result<String, String> {
    let path = crate::config::AppConfig::sessions_path();
    let dir = path.parent().unwrap_or(&path);
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let dir_str = dir.to_string_lossy().to_string();
    let _ = open::that(dir);
    Ok(dir_str)
}
