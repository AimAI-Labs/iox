use crate::chat_store::SyncChange;
use crate::config::{normalize_pg_ssl_mode, SyncConfig};
use std::sync::Arc;
use std::time::Duration;
use tokio_postgres::config::SslMode;
use tokio_postgres::{Client, Config, NoTls};
use tokio_postgres_rustls::MakeRustlsConnect;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// 远程一行；`payload` 为 NULL 表示墓碑。
pub struct RemoteRow {
    pub id: String,
    pub updated_at: u64,
    pub deleted_at: u64,
    pub payload: Option<serde_json::Value>,
}

fn to_i64(value: u64) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

fn ssl_mode(mode: &str) -> SslMode {
    match normalize_pg_ssl_mode(mode).as_str() {
        "disable" => SslMode::Disable,
        "require" => SslMode::Require,
        _ => SslMode::Prefer,
    }
}

/// 只转发可安全展示的信息：服务端错误只给 SQLSTATE，避免回显语句与参数。
fn describe(error: tokio_postgres::Error) -> String {
    if let Some(db) = error.as_db_error() {
        return format!("远程数据库返回错误 {}", db.code().code());
    }
    let mut text = error.to_string();
    if text.chars().count() > 160 {
        text = text.chars().take(160).collect();
    }
    format!("无法连接远程数据库：{text}")
}

fn tls() -> Result<MakeRustlsConnect, String> {
    let mut roots = rustls::RootCertStore::empty();
    roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config = rustls::ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .map_err(|_| "无法初始化 TLS 配置".to_string())?
        .with_root_certificates(roots)
        .with_no_client_auth();
    Ok(MakeRustlsConnect::new(config))
}

pub async fn connect(settings: &SyncConfig) -> Result<Client, String> {
    if settings.host.trim().is_empty() {
        return Err("远程数据库地址不能为空".to_string());
    }
    if settings.database.trim().is_empty() {
        return Err("远程数据库名称不能为空".to_string());
    }
    if settings.user.trim().is_empty() {
        return Err("远程数据库用户不能为空".to_string());
    }

    let mode = ssl_mode(&settings.ssl_mode);
    let mut config = Config::new();
    config
        .host(settings.host.trim())
        .port(settings.port)
        .dbname(settings.database.trim())
        .user(settings.user.trim())
        .application_name("iox")
        .connect_timeout(CONNECT_TIMEOUT)
        .ssl_mode(mode);
    if !settings.password.is_empty() {
        config.password(&settings.password);
    }

    if mode == SslMode::Disable {
        let (client, connection) = config.connect(NoTls).await.map_err(describe)?;
        tokio::spawn(async move {
            let _ = connection.await;
        });
        return Ok(client);
    }

    let (client, connection) = config.connect(tls()?).await.map_err(describe)?;
    tokio::spawn(async move {
        let _ = connection.await;
    });
    Ok(client)
}

pub async fn ensure_schema(client: &Client) -> Result<(), String> {
    client
        .batch_execute(
            "CREATE TABLE IF NOT EXISTS iox_sessions (
                 namespace  TEXT NOT NULL,
                 id         TEXT NOT NULL,
                 updated_at BIGINT NOT NULL,
                 deleted_at BIGINT NOT NULL DEFAULT 0,
                 payload    JSONB,
                 PRIMARY KEY (namespace, id)
             );
             CREATE INDEX IF NOT EXISTS iox_sessions_by_updated
                 ON iox_sessions (namespace, updated_at);",
        )
        .await
        .map_err(describe)
}

pub async fn server_version(client: &Client) -> Result<String, String> {
    let row = client
        .query_one("SELECT version()", &[])
        .await
        .map_err(describe)?;
    let version: String = row.get(0);
    let headline = version.split(" on ").next().unwrap_or(version.as_str());
    Ok(headline.to_string())
}

pub async fn fetch(client: &Client, namespace: &str, since: u64) -> Result<Vec<RemoteRow>, String> {
    let rows = client
        .query(
            "SELECT id, updated_at, deleted_at, payload FROM iox_sessions
             WHERE namespace = $1 AND updated_at > $2
             ORDER BY updated_at ASC, id ASC",
            &[&namespace, &to_i64(since)],
        )
        .await
        .map_err(describe)?;

    let mut output = Vec::with_capacity(rows.len());
    for row in rows {
        output.push(RemoteRow {
            id: row.try_get("id").map_err(describe)?,
            updated_at: u64::try_from(row.try_get::<_, i64>("updated_at").map_err(describe)?)
                .unwrap_or(0),
            deleted_at: u64::try_from(row.try_get::<_, i64>("deleted_at").map_err(describe)?)
                .unwrap_or(0),
            payload: row.try_get("payload").map_err(describe)?,
        });
    }
    Ok(output)
}

/// 推送本地变更：`updated_at` 更旧的写入不会覆盖远程较新的行。
pub async fn push(
    client: &Client,
    namespace: &str,
    changes: &[SyncChange],
) -> Result<usize, String> {
    if changes.is_empty() {
        return Ok(0);
    }

    let statement = client
        .prepare(
            "INSERT INTO iox_sessions (namespace, id, updated_at, deleted_at, payload)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (namespace, id) DO UPDATE SET
                 updated_at = excluded.updated_at,
                 deleted_at = excluded.deleted_at,
                 payload = excluded.payload
             WHERE excluded.updated_at > iox_sessions.updated_at",
        )
        .await
        .map_err(describe)?;

    for change in changes {
        let payload = match &change.session {
            Some(session) => {
                Some(serde_json::to_value(session).map_err(|_| "无法序列化会话".to_string())?)
            }
            None => None,
        };
        client
            .execute(
                &statement,
                &[
                    &namespace,
                    &change.id,
                    &to_i64(change.updated_at),
                    &to_i64(change.deleted_at),
                    &payload,
                ],
            )
            .await
            .map_err(describe)?;
    }
    Ok(changes.len())
}
