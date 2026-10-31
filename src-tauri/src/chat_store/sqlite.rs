use super::{ChatSessionData, SessionMeta};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::time::Duration;

/// `PRAGMA user_version` 持有已落盘的 schema 版本。
const SCHEMA_VERSION: i64 = 1;

/// SQLite 整数是有符号的；时间戳饱和而不是回绕。
fn to_sql_timestamp(value: u64) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

fn from_sql_timestamp(value: i64) -> u64 {
    u64::try_from(value).unwrap_or(0)
}

/// 打开连接并保证 schema 就绪；每次调用创建一个短生命周期连接。
pub(super) fn open(path: &Path) -> Result<Connection, String> {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    if !parent.as_os_str().is_empty() {
        std::fs::create_dir_all(parent).map_err(|_| "无法创建会话目录".to_string())?;
    }

    let conn = Connection::open(path).map_err(|_| "无法打开会话数据库".to_string())?;
    conn.busy_timeout(Duration::from_secs(5))
        .map_err(|_| "无法配置会话数据库等待策略".to_string())?;
    // journal_mode 会回传一行结果，不能走 execute_batch。
    conn.query_row("PRAGMA journal_mode = WAL", [], |_| Ok(()))
        .map_err(|_| "无法启用会话数据库日志".to_string())?;
    // WAL 下 FULL 仍然每次提交落盘，与旧的临时文件 fsync 语义一致。
    conn.execute_batch("PRAGMA synchronous = FULL; PRAGMA temp_store = MEMORY;")
        .map_err(|_| "无法配置会话数据库持久性".to_string())?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<(), String> {
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|_| "无法读取会话数据库版本".to_string())?;
    if version > SCHEMA_VERSION {
        return Err("会话数据库由更高版本创建，无法读取".to_string());
    }
    if version < 1 {
        conn.execute_batch(
            "BEGIN;
             CREATE TABLE IF NOT EXISTS sessions (
                 id           TEXT PRIMARY KEY NOT NULL,
                 title        TEXT NOT NULL,
                 action_id    TEXT NOT NULL,
                 model        TEXT NOT NULL,
                 created_at   INTEGER NOT NULL,
                 updated_at   INTEGER NOT NULL,
                 content_hash TEXT,
                 payload      TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS sessions_by_updated ON sessions(updated_at DESC, id DESC);
             CREATE UNIQUE INDEX IF NOT EXISTS sessions_by_content
                 ON sessions(content_hash) WHERE content_hash IS NOT NULL;
             CREATE TABLE IF NOT EXISTS meta (
                 key   TEXT PRIMARY KEY NOT NULL,
                 value TEXT NOT NULL
             );
             PRAGMA user_version = 1;
             COMMIT;",
        )
        .map_err(|_| "无法创建会话数据库结构".to_string())?;
    }
    Ok(())
}

fn decode(id: &str, payload: &str) -> Result<ChatSessionData, String> {
    serde_json::from_str(payload).map_err(|_| format!("会话 {} 的数据无法解析", id))
}

pub(super) fn list(conn: &Connection) -> Result<Vec<SessionMeta>, String> {
    let mut statement = conn
        .prepare_cached(concat!(
            "SELECT id, title, action_id, model, updated_at FROM sessions",
            " ORDER BY updated_at DESC, id DESC"
        ))
        .map_err(|_| "无法读取会话列表".to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(SessionMeta {
                id: row.get(0)?,
                title: row.get(1)?,
                action_id: row.get(2)?,
                model: row.get(3)?,
                updated_at: from_sql_timestamp(row.get::<_, i64>(4)?),
            })
        })
        .map_err(|_| "无法读取会话列表".to_string())?;
    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row.map_err(|_| "无法读取会话列表".to_string())?);
    }
    Ok(sessions)
}

pub(super) fn all(conn: &Connection) -> Result<Vec<ChatSessionData>, String> {
    let mut statement = conn
        .prepare_cached(concat!(
            "SELECT id, payload FROM sessions",
            " ORDER BY updated_at DESC, id DESC"
        ))
        .map_err(|_| "无法读取会话历史".to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|_| "无法读取会话历史".to_string())?;
    let mut sessions = Vec::new();
    for row in rows {
        let (id, payload) = row.map_err(|_| "无法读取会话历史".to_string())?;
        sessions.push(decode(&id, &payload)?);
    }
    Ok(sessions)
}

pub(super) fn get(conn: &Connection, id: &str) -> Result<Option<ChatSessionData>, String> {
    let payload: Option<String> = conn
        .query_row(
            "SELECT payload FROM sessions WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| "无法读取会话".to_string())?;
    payload.map(|text| decode(id, &text)).transpose()
}

fn preserve_earliest_creation(session: &mut ChatSessionData, created_at: u64) {
    if created_at > 0 && (session.created_at == 0 || created_at < session.created_at) {
        session.created_at = created_at;
    }
}

fn created_at_of(conn: &Connection, sql: &str, id: &str) -> Result<Option<i64>, String> {
    conn.query_row(sql, params![id], |row| row.get(0))
        .optional()
        .map_err(|_| "无法读取会话创建时间".to_string())
}

/// 在给定连接（通常是事务）内完成去重与写入，返回最终使用的会话 ID。
fn write_session(
    conn: &Connection,
    session: &mut ChatSessionData,
    content_hash: Option<&str>,
) -> Result<String, String> {
    if let Some(created) = created_at_of(
        conn,
        "SELECT created_at FROM sessions WHERE id = ?1",
        &session.id,
    )? {
        preserve_earliest_creation(session, from_sql_timestamp(created));
    } else if let Some(hash) = content_hash {
        let existing: Option<(String, i64)> = conn
            .query_row(
                "SELECT id, created_at FROM sessions WHERE content_hash = ?1",
                params![hash],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|_| "无法读取会话内容索引".to_string())?;
        if let Some((id, created)) = existing {
            session.id = id;
            preserve_earliest_creation(session, from_sql_timestamp(created));
        }
    }

    // 内容哈希即身份：合并其它持有相同内容的行，保留最早的创建时间。
    if let Some(hash) = content_hash {
        let duplicate: Option<i64> = conn
            .query_row(
                "SELECT created_at FROM sessions WHERE content_hash = ?1 AND id <> ?2",
                params![hash, &session.id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|_| "无法读取会话内容索引".to_string())?;
        if let Some(created) = duplicate {
            preserve_earliest_creation(session, from_sql_timestamp(created));
            conn.execute(
                "DELETE FROM sessions WHERE content_hash = ?1 AND id <> ?2",
                params![hash, &session.id],
            )
            .map_err(|_| "无法合并重复会话".to_string())?;
        }
    }

    let payload = serde_json::to_string(session).map_err(|_| "无法序列化会话".to_string())?;
    conn.execute(
        "INSERT INTO sessions (id, title, action_id, model, created_at, updated_at, content_hash, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             action_id = excluded.action_id,
             model = excluded.model,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             content_hash = excluded.content_hash,
             payload = excluded.payload",
        params![
            &session.id,
            &session.title,
            &session.action_id,
            &session.model,
            to_sql_timestamp(session.created_at),
            to_sql_timestamp(session.updated_at),
            content_hash,
            payload
        ],
    )
    .map_err(|_| "无法写入会话".to_string())?;
    Ok(session.id.clone())
}

fn trim_history(conn: &Connection, limit: usize) -> Result<(), String> {
    conn.execute(
        concat!(
            "DELETE FROM sessions WHERE id NOT IN (",
            "SELECT id FROM sessions ORDER BY updated_at DESC, id DESC LIMIT ?1)"
        ),
        params![limit as i64],
    )
    .map_err(|_| "无法裁剪会话历史".to_string())?;
    Ok(())
}

fn exists(conn: &Connection, id: &str) -> Result<bool, String> {
    Ok(created_at_of(conn, "SELECT created_at FROM sessions WHERE id = ?1", id)?.is_some())
}

/// 保存会话；调用方负责串行化与 `prepare_session`。
pub(super) fn save(
    conn: &mut Connection,
    session: &mut ChatSessionData,
    content_hash: Option<&str>,
    limit: usize,
) -> Result<String, String> {
    let tx = conn
        .transaction()
        .map_err(|_| "无法开始会话事务".to_string())?;
    let canonical = write_session(&tx, session, content_hash)?;
    trim_history(&tx, limit)?;
    if !exists(&tx, &canonical)? {
        // 提前返回时事务被丢弃，超限写入不会落盘。
        return Err("会话未能保留在历史上限内，保存已取消".to_string());
    }
    tx.commit().map_err(|_| "无法提交会话事务".to_string())?;
    Ok(canonical)
}

pub(super) fn delete(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])
        .map_err(|_| "无法删除会话".to_string())?;
    Ok(())
}

pub(super) fn clear(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM sessions", [])
        .map_err(|_| "无法清空会话历史".to_string())?;
    Ok(())
}

pub(super) fn legacy_imported(conn: &Connection) -> Result<bool, String> {
    let found: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM meta WHERE key = 'legacy_jsonl_import'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| "无法读取会话数据库标记".to_string())?;
    Ok(found.is_some())
}

/// 旧版文件按 `updated_at` 倒序导入：已存在的相同内容只合并创建时间，
/// 保留最早的一条身份与最新的一条正文。
fn merge_created_at(
    conn: &Connection,
    session: &ChatSessionData,
    hash: &str,
) -> Result<bool, String> {
    let existing: Option<(String, String)> = conn
        .query_row(
            "SELECT id, payload FROM sessions WHERE content_hash = ?1",
            params![hash],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|_| "无法读取会话内容索引".to_string())?;
    let Some((id, payload)) = existing else {
        return Ok(false);
    };

    let mut stored = decode(&id, &payload)?;
    preserve_earliest_creation(&mut stored, session.created_at);
    // 列与负载必须同步，否则 `all`/`get` 读回的创建时间仍是旧值。
    let payload = serde_json::to_string(&stored).map_err(|_| "无法序列化会话".to_string())?;
    conn.execute(
        "UPDATE sessions SET created_at = ?1, payload = ?2 WHERE content_hash = ?3",
        params![to_sql_timestamp(stored.created_at), payload, hash],
    )
    .map_err(|_| "无法合并重复会话".to_string())?;
    Ok(true)
}

/// 一次性导入旧版 JSONL；失败时事务回滚，调用方保留原文件。
pub(super) fn import(
    conn: &mut Connection,
    sessions: &mut [ChatSessionData],
    limit: usize,
) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|_| "无法开始会话事务".to_string())?;
    for session in sessions.iter_mut() {
        let hash = super::content_hash(session);
        if let Some(hash) = hash.as_deref() {
            if merge_created_at(&tx, session, hash)? {
                continue;
            }
        }
        write_session(&tx, session, hash.as_deref())?;
    }
    trim_history(&tx, limit)?;
    tx.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('legacy_jsonl_import', '1')",
        [],
    )
    .map_err(|_| "无法写入会话数据库标记".to_string())?;
    tx.commit().map_err(|_| "无法提交会话事务".to_string())?;
    Ok(())
}
