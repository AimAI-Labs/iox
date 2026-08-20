use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

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

/// 获取会话存储目录 %APPDATA%/iox/sessions/
fn get_sessions_dir() -> PathBuf {
    let base = if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata).join("iox").join("sessions")
    } else if let Ok(userprofile) = std::env::var("USERPROFILE") {
        PathBuf::from(userprofile).join(".iox").join("sessions")
    } else {
        PathBuf::from(".").join("sessions")
    };
    let _ = fs::create_dir_all(&base);
    base
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
    format!("session_{}_{:08x}", ts, nanos)
}

/// 获取所有会话元数据列表（按最近更新时间倒序排序，上限 50 条）
#[tauri::command]
pub fn list_chat_sessions() -> Result<Vec<SessionMeta>, String> {
    let dir = get_sessions_dir();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(session) = serde_json::from_str::<ChatSessionData>(&content) {
                    list.push(SessionMeta {
                        id: session.id,
                        title: session.title,
                        action_id: session.action_id,
                        model: session.model,
                        updated_at: session.updated_at,
                    });
                }
            }
        }
    }

    list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(list)
}

/// 读取单个会话完整数据
#[tauri::command]
pub fn get_chat_session(id: String) -> Result<ChatSessionData, String> {
    let path = get_sessions_dir().join(format!("{}.json", id));
    if !path.exists() {
        return Err(format!("Session '{}' not found", id));
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str::<ChatSessionData>(&content).map_err(|e| e.to_string())
}

/// 保存或更新会话数据
#[tauri::command]
pub fn save_chat_session(mut session: ChatSessionData) -> Result<(), String> {
    if session.id.is_empty() {
        session.id = generate_session_id();
    }
    if session.created_at == 0 {
        session.created_at = current_timestamp();
    }
    session.updated_at = current_timestamp();

    // 标题为空时截取初始用户输入或文本的前 24 个字
    if session.title.trim().is_empty() {
        let snippet = if !session.selected_text.trim().is_empty() {
            &session.selected_text
        } else if let Some(first_msg) = session.messages.first() {
            &first_msg.content
        } else {
            "新对话"
        };
        session.title = snippet.chars().take(24).collect();
    }

    let dir = get_sessions_dir();
    let path = dir.join(format!("{}.json", session.id));
    let json = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    // 自动清理超过 50 个的历史会话（删除最旧的）
    clean_excess_sessions(50);

    Ok(())
}

/// 删除指定会话
#[tauri::command]
pub fn delete_chat_session(id: String) -> Result<(), String> {
    let path = get_sessions_dir().join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 清空所有历史会话
#[tauri::command]
pub fn clear_all_chat_sessions() -> Result<(), String> {
    let dir = get_sessions_dir();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}

fn clean_excess_sessions(max_limit: usize) {
    if let Ok(mut list) = list_chat_sessions() {
        if list.len() > max_limit {
            let to_remove = list.split_off(max_limit);
            let dir = get_sessions_dir();
            for item in to_remove {
                let path = dir.join(format!("{}.json", item.id));
                let _ = fs::remove_file(path);
            }
        }
    }
}
