use super::{ChatSessionData, SessionMeta};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::time::Duration;

/// `PRAGMA user_version` 持有已落盘的 schema 版本。
const SCHEMA_VERSION: i64 = 2;

/// 墓碑保留期：离线超过该窗口的设备可能复活已删除会话。
pub(super) const TOMBSTONE_TTL_SECONDS: u64 = 30 * 24 * 60 * 60;

/// 一条待推送或待应用的同步变更；墓碑没有负载。
#[derive(Debug, Clone)]
pub struct SyncChange {
    pub id: String,
    pub updated_at: u64,
    pub deleted_at: u64,
    pub session: Option<ChatSessionData>,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct ApplyStats {
    pub applied: usize,
    pub skipped: usize,
}

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

    // v2：软删除墓碑，用于把删除传播到远程。
    if version < 2 {
        conn.execute_batch(
            "BEGIN;
             ALTER TABLE sessions ADD COLUMN deleted_at INTEGER NOT NULL DEFAULT 0;
             PRAGMA user_version = 2;
             COMMIT;",
        )
        .map_err(|_| "无法升级会话数据库结构".to_string())?;
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
            " WHERE deleted_at = 0 ORDER BY updated_at DESC, id DESC"
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
            " WHERE deleted_at = 0 ORDER BY updated_at DESC, id DESC"
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
            "SELECT payload FROM sessions WHERE id = ?1 AND deleted_at = 0",
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

fn created_at_of(conn: &Connection, id: &str) -> Result<Option<i64>, String> {
    conn.query_row(
        "SELECT created_at FROM sessions WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )
    .optional()
    .map_err(|_| "无法读取会话创建时间".to_string())
}

/// 写入墓碑；`payload` 与内容哈希被清空，既释放空间也避免占用去重索引。
fn tombstone(conn: &Connection, id: &str, at: u64) -> Result<(), String> {
    let at = to_sql_timestamp(at);
    conn.execute(
        "UPDATE sessions SET deleted_at = ?1, updated_at = ?1, content_hash = NULL, payload = ''
         WHERE id = ?2",
        params![at, id],
    )
    .map_err(|_| "无法删除会话".to_string())?;
    Ok(())
}

/// 在给定连接（通常是事务）内完成去重与写入，返回最终使用的会话 ID。
fn write_session(
    conn: &Connection,
    session: &mut ChatSessionData,
    content_hash: Option<&str>,
) -> Result<String, String> {
    if let Some(created) = created_at_of(conn, &session.id)? {
        preserve_earliest_creation(session, from_sql_timestamp(created));
    } else if let Some(hash) = content_hash {
        let existing: Option<(String, i64)> = conn
            .query_row(
                "SELECT id, created_at FROM sessions WHERE content_hash = ?1 AND deleted_at = 0",
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

    // 内容哈希即身份：其它持有相同内容的行转为墓碑，让远程也收敛到同一个 ID。
    if let Some(hash) = content_hash {
        let duplicate: Option<(String, i64)> = conn
            .query_row(
                "SELECT id, created_at FROM sessions
                 WHERE content_hash = ?1 AND id <> ?2 AND deleted_at = 0",
                params![hash, &session.id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|_| "无法读取会话内容索引".to_string())?;
        if let Some((id, created)) = duplicate {
            preserve_earliest_creation(session, from_sql_timestamp(created));
            tombstone(conn, &id, session.updated_at)?;
        }
    }

    let payload = serde_json::to_string(session).map_err(|_| "无法序列化会话".to_string())?;
    conn.execute(
        "INSERT INTO sessions
             (id, title, action_id, model, created_at, updated_at, content_hash, payload, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)
         ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             action_id = excluded.action_id,
             model = excluded.model,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             content_hash = excluded.content_hash,
             payload = excluded.payload,
             deleted_at = 0",
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

fn trim_history(conn: &Connection, limit: usize, now: u64) -> Result<(), String> {
    let evicted: Vec<String> = {
        let mut statement = conn
            .prepare_cached(concat!(
                "SELECT id FROM sessions WHERE deleted_at = 0",
                " ORDER BY updated_at DESC, id DESC LIMIT -1 OFFSET ?1"
            ))
            .map_err(|_| "无法裁剪会话历史".to_string())?;
        let rows = statement
            .query_map(params![limit as i64], |row| row.get::<_, String>(0))
            .map_err(|_| "无法裁剪会话历史".to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|_| "无法裁剪会话历史".to_string())?
    };
    // 逐条转墓碑：超限淘汰必须传播到远程，否则下次拉取会把它复活。
    for id in evicted {
        tombstone(conn, &id, now)?;
    }

    let cutoff = now.saturating_sub(TOMBSTONE_TTL_SECONDS);
    conn.execute(
        "DELETE FROM sessions WHERE deleted_at > 0 AND deleted_at < ?1",
        params![to_sql_timestamp(cutoff)],
    )
    .map_err(|_| "无法清理会话墓碑".to_string())?;
    Ok(())
}

fn exists(conn: &Connection, id: &str) -> Result<bool, String> {
    let found: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM sessions WHERE id = ?1 AND deleted_at = 0",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| "无法校验会话".to_string())?;
    Ok(found.is_some())
}

/// 保存会话；调用方负责串行化与 `prepare_session`。
pub(super) fn save(
    conn: &mut Connection,
    session: &mut ChatSessionData,
    content_hash: Option<&str>,
    limit: usize,
    now: u64,
) -> Result<String, String> {
    let tx = conn
        .transaction()
        .map_err(|_| "无法开始会话事务".to_string())?;
    let canonical = write_session(&tx, session, content_hash)?;
    trim_history(&tx, limit, now)?;
    if !exists(&tx, &canonical)? {
        // 提前返回时事务被丢弃，超限写入不会落盘。
        return Err("会话未能保留在历史上限内，保存已取消".to_string());
    }
    tx.commit().map_err(|_| "无法提交会话事务".to_string())?;
    Ok(canonical)
}

pub(super) fn delete(conn: &Connection, id: &str, now: u64) -> Result<(), String> {
    let live: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM sessions WHERE id = ?1 AND deleted_at = 0",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| "无法读取会话".to_string())?;
    if live.is_none() {
        return Ok(());
    }
    tombstone(conn, id, now)
}

pub(super) fn clear(conn: &mut Connection, now: u64) -> Result<(), String> {
    let ids: Vec<String> = {
        let mut statement = conn
            .prepare_cached("SELECT id FROM sessions WHERE deleted_at = 0")
            .map_err(|_| "无法清空会话历史".to_string())?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|_| "无法清空会话历史".to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|_| "无法清空会话历史".to_string())?
    };
    let tx = conn
        .transaction()
        .map_err(|_| "无法开始会话事务".to_string())?;
    for id in ids {
        tombstone(&tx, &id, now)?;
    }
    tx.commit().map_err(|_| "无法提交会话事务".to_string())?;
    Ok(())
}

/// 本地在 `since` 之后发生变化（含墓碑）的记录，供推送使用。
pub(super) fn pending(conn: &Connection, since: u64) -> Result<Vec<SyncChange>, String> {
    let mut statement = conn
        .prepare_cached(
            "SELECT id, updated_at, deleted_at, payload FROM sessions
             WHERE updated_at > ?1 ORDER BY updated_at ASC, id ASC",
        )
        .map_err(|_| "无法读取待同步会话".to_string())?;
    let rows = statement
        .query_map(params![to_sql_timestamp(since)], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|_| "无法读取待同步会话".to_string())?;

    let mut changes = Vec::new();
    for row in rows {
        let (id, updated_at, deleted_at, payload) =
            row.map_err(|_| "无法读取待同步会话".to_string())?;
        let deleted_at = from_sql_timestamp(deleted_at);
        changes.push(SyncChange {
            session: if deleted_at > 0 {
                None
            } else {
                Some(decode(&id, &payload)?)
            },
            id,
            updated_at: from_sql_timestamp(updated_at),
            deleted_at,
        });
    }
    Ok(changes)
}

fn local_state(conn: &Connection, id: &str) -> Result<Option<(u64, u64)>, String> {
    let row: Option<(i64, i64)> = conn
        .query_row(
            "SELECT updated_at, deleted_at FROM sessions WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|_| "无法读取本地会话状态".to_string())?;
    Ok(row.map(|(updated, deleted)| (from_sql_timestamp(updated), from_sql_timestamp(deleted))))
}

/// 应用远程变更：`updated_at` 大的胜出，写入与删除都按此判定。
pub(super) fn apply_remote(
    conn: &mut Connection,
    changes: &[SyncChange],
) -> Result<ApplyStats, String> {
    let tx = conn
        .transaction()
        .map_err(|_| "无法开始会话事务".to_string())?;
    let mut stats = ApplyStats::default();

    for change in changes {
        if let Some((local_updated, _)) = local_state(&tx, &change.id)? {
            if change.updated_at <= local_updated {
                stats.skipped += 1;
                continue;
            }
        }

        if change.deleted_at > 0 {
            let inserted = tx
                .execute(
                    "INSERT INTO sessions
                         (id, title, action_id, model, created_at, updated_at, content_hash, payload, deleted_at)
                     VALUES (?1, '', '', '', 0, ?2, NULL, '', ?2)
                     ON CONFLICT(id) DO NOTHING",
                    params![&change.id, to_sql_timestamp(change.updated_at)],
                )
                .map_err(|_| "无法写入会话墓碑".to_string())?;
            if inserted == 0 {
                tombstone(&tx, &change.id, change.updated_at)?;
            }
        } else if let Some(session) = &change.session {
            let mut session = session.clone();
            let hash = super::content_hash(&session);
            write_session(&tx, &mut session, hash.as_deref())?;
        } else {
            stats.skipped += 1;
            continue;
        }
        stats.applied += 1;
    }

    tx.commit().map_err(|_| "无法提交会话事务".to_string())?;
    Ok(stats)
}

pub(super) fn cursor(conn: &Connection, key: &str) -> Result<u64, String> {
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| "无法读取同步游标".to_string())?;
    Ok(value.and_then(|text| text.parse::<u64>().ok()).unwrap_or(0))
}

pub(super) fn set_cursor(conn: &Connection, key: &str, value: u64) -> Result<(), String> {
    conn.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value.to_string()],
    )
    .map_err(|_| "无法写入同步游标".to_string())?;
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
pub(super) fn merge_created_at(
    conn: &Connection,
    session: &ChatSessionData,
    hash: &str,
) -> Result<bool, String> {
    let existing: Option<(String, String)> = conn
        .query_row(
            "SELECT id, payload FROM sessions WHERE content_hash = ?1 AND deleted_at = 0",
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
    now: u64,
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
    trim_history(&tx, limit, now)?;
    tx.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('legacy_jsonl_import', '1')",
        [],
    )
    .map_err(|_| "无法写入会话数据库标记".to_string())?;
    tx.commit().map_err(|_| "无法提交会话事务".to_string())?;
    Ok(())
}
