use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// 串行化会话文件的读改写，避免并发保存互相覆盖
static SESSION_STORE_LOCK: Mutex<()> = Mutex::new(());

fn lock_session_store() -> Result<std::sync::MutexGuard<'static, ()>, String> {
    SESSION_STORE_LOCK
        .lock()
        .map_err(|_| "会话存储锁异常".to_string())
}

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

/// 获取与 config.json 同目录的 sessions.jsonl 路径
fn get_sessions_file_path() -> PathBuf {
    let path = crate::config::AppConfig::sessions_path();
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    path
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

/// 内部辅助：从 JSONL 文件中加载全部完整会话
fn load_all_sessions_from_jsonl() -> Vec<ChatSessionData> {
    let path = get_sessions_file_path();
    if !path.exists() {
        return Vec::new();
    }

    let file = match fs::File::open(&path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };

    let reader = BufReader::new(file);
    let mut sessions = Vec::new();

    for line in reader.lines().flatten() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(session) = serde_json::from_str::<ChatSessionData>(trimmed) {
            sessions.push(session);
        }
    }

    // 按最后更新时间倒序排序
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    sessions
}

/// 内部辅助：将全部会话批量写回 JSONL 文件（上限 200 条）
fn write_all_sessions_to_jsonl(mut sessions: Vec<ChatSessionData>) -> Result<(), String> {
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    if sessions.len() > 200 {
        sessions.truncate(200);
    }

    let path = get_sessions_file_path();
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&path)
        .map_err(|e| e.to_string())?;

    for session in sessions {
        if let Ok(line) = serde_json::to_string(&session) {
            writeln!(file, "{}", line).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
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

/// 获取所有会话元数据列表
#[tauri::command]
pub fn list_chat_sessions() -> Result<Vec<SessionMeta>, String> {
    let _guard = lock_session_store()?;
    let mut sessions = load_all_sessions_from_jsonl();
    let original_count = sessions.len();

    dedupe_sessions_by_content(&mut sessions);

    let mut changed = sessions.len() != original_count;
    for session in &mut sessions {
        changed |= repair_legacy_title(session);
    }

    let metas = sessions
        .iter()
        .map(|s| SessionMeta {
            id: s.id.clone(),
            title: s.title.clone(),
            action_id: s.action_id.clone(),
            model: s.model.clone(),
            updated_at: s.updated_at,
        })
        .collect();

    if changed {
        let _ = write_all_sessions_to_jsonl(sessions);
    }

    Ok(metas)
}

/// 获取所有完整会话列表（供设置面板查看和搜索）
#[tauri::command]
pub fn get_all_full_chat_sessions() -> Result<Vec<ChatSessionData>, String> {
    let _guard = lock_session_store()?;
    Ok(load_all_sessions_from_jsonl())
}

/// 读取单个会话完整数据
#[tauri::command]
pub fn get_chat_session(id: String) -> Result<ChatSessionData, String> {
    let _guard = lock_session_store()?;
    let sessions = load_all_sessions_from_jsonl();
    sessions
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("Session '{}' not found", id))
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

/// 保存或更新会话数据到 JSONL，返回最终使用的会话 ID。
#[tauri::command]
pub fn save_chat_session(mut session: ChatSessionData) -> Result<String, String> {
    let _guard = lock_session_store()?;

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
        session.title = snippet.chars().take(28).collect::<String>().replace('\n', " ");
    }

    // 空标题回退后也尝试修复旧格式追问标记
    repair_legacy_title(&mut session);

    let mut sessions = load_all_sessions_from_jsonl();
    dedupe_sessions_by_content(&mut sessions);

    let canonical_id = upsert_session(&mut sessions, session);
    write_all_sessions_to_jsonl(sessions)?;

    Ok(canonical_id)
}

/// 删除指定会话
#[tauri::command]
pub fn delete_chat_session(id: String) -> Result<(), String> {
    let _guard = lock_session_store()?;
    let mut sessions = load_all_sessions_from_jsonl();
    sessions.retain(|s| s.id != id);
    write_all_sessions_to_jsonl(sessions)
}

/// 清空所有历史会话
#[tauri::command]
pub fn clear_all_chat_sessions() -> Result<(), String> {
    let _guard = lock_session_store()?;
    let path = get_sessions_file_path();
    if path.exists() {
        let _ = fs::write(&path, "");
    }
    Ok(())
}

/// 在 Windows 资源管理器中打开会话存储目录
#[tauri::command]
pub fn open_sessions_directory() -> Result<String, String> {
    let path = get_sessions_file_path();
    let dir = path.parent().unwrap_or(&path);
    let dir_str = dir.to_string_lossy().to_string();
    let _ = open::that(dir);
    Ok(dir_str)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(id: &str, stream: &str, created_at: u64, updated_at: u64) -> ChatSessionData {
        ChatSessionData {
            id: id.to_string(),
            title: "test".to_string(),
            action_id: "act".to_string(),
            provider_id: None,
            model: "model".to_string(),
            selected_text: String::new(),
            stream_text: stream.to_string(),
            messages: Vec::new(),
            created_at,
            updated_at,
        }
    }

    #[test]
    fn dedupe_keeps_newest_and_earliest_creation_time() {
        let mut sessions = vec![
            sample("new", "same content", 200, 300),
            sample("old", "same content", 100, 200),
        ];

        dedupe_sessions_by_content(&mut sessions);

        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "new");
        assert_eq!(sessions[0].created_at, 100);
    }

    #[test]
    fn upsert_reuses_existing_id_for_identical_content() {
        let mut sessions = vec![sample("existing", "hello", 100, 200)];

        let canonical = upsert_session(&mut sessions, sample("fresh", "hello", 300, 300));

        assert_eq!(canonical, "existing");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "existing");
        assert_eq!(sessions[0].created_at, 100);
    }

    #[test]
    fn upsert_preserves_creation_time_on_id_update() {
        let mut sessions = vec![sample("same", "v1", 100, 100)];

        let canonical = upsert_session(&mut sessions, sample("same", "v2", 900, 900));

        assert_eq!(canonical, "same");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].stream_text, "v2");
        assert_eq!(sessions[0].created_at, 100);
    }

    #[test]
    fn repairs_legacy_marker_title() {
        let mut session = sample(
            "id",
            "\n\n---\n**追问：** 去网上找几个有关 bilibili 的网站\n\n<!-- iox:answer -->\n\n回答",
            1,
            1,
        );
        session.title = "--- **追问：** 去网上找几个有关 bilibili 的网站".to_string();

        assert!(repair_legacy_title(&mut session));
        assert_eq!(session.title, "去网上找几个有关 bilibili 的网站");
    }

    #[test]
    fn empty_stream_sessions_are_not_deduped() {
        let mut sessions = vec![sample("a", "", 100, 100), sample("b", "", 200, 200)];

        dedupe_sessions_by_content(&mut sessions);

        assert_eq!(sessions.len(), 2);
    }
}
