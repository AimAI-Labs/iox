use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
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

/// 获取应用安装/运行目录下的 sessions.jsonl 路径
fn get_sessions_file_path() -> PathBuf {
    let data_dir = if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            // 如果在 target/debug 等临时开发目录下，尽量放在工作目录下的 data/
            let path = parent.join("data");
            if fs::create_dir_all(&path).is_ok() {
                path
            } else {
                PathBuf::from("data")
            }
        } else {
            PathBuf::from("data")
        }
    } else {
        PathBuf::from("data")
    };
    let _ = fs::create_dir_all(&data_dir);
    data_dir.join("sessions.jsonl")
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

/// 获取所有会话元数据列表
#[tauri::command]
pub fn list_chat_sessions() -> Result<Vec<SessionMeta>, String> {
    let sessions = load_all_sessions_from_jsonl();
    let metas = sessions
        .into_iter()
        .map(|s| SessionMeta {
            id: s.id,
            title: s.title,
            action_id: s.action_id,
            model: s.model,
            updated_at: s.updated_at,
        })
        .collect();
    Ok(metas)
}

/// 获取所有完整会话列表（供设置面板查看和搜索）
#[tauri::command]
pub fn get_all_full_chat_sessions() -> Result<Vec<ChatSessionData>, String> {
    Ok(load_all_sessions_from_jsonl())
}

/// 读取单个会话完整数据
#[tauri::command]
pub fn get_chat_session(id: String) -> Result<ChatSessionData, String> {
    let sessions = load_all_sessions_from_jsonl();
    sessions
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("Session '{}' not found", id))
}

/// 保存或更新会话数据到 JSONL
#[tauri::command]
pub fn save_chat_session(mut session: ChatSessionData) -> Result<(), String> {
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

    let mut sessions = load_all_sessions_from_jsonl();
    if let Some(pos) = sessions.iter().position(|s| s.id == session.id) {
        sessions[pos] = session;
    } else {
        sessions.insert(0, session);
    }

    write_all_sessions_to_jsonl(sessions)
}

/// 删除指定会话
#[tauri::command]
pub fn delete_chat_session(id: String) -> Result<(), String> {
    let mut sessions = load_all_sessions_from_jsonl();
    sessions.retain(|s| s.id != id);
    write_all_sessions_to_jsonl(sessions)
}

/// 清空所有历史会话
#[tauri::command]
pub fn clear_all_chat_sessions() -> Result<(), String> {
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
