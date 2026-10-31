use super::*;
use std::fs;
use std::sync::atomic::{AtomicU64, Ordering};

static TEST_ID: AtomicU64 = AtomicU64::new(0);

struct Fixture {
    root: PathBuf,
    lock: Mutex<()>,
}

impl Fixture {
    fn new() -> Self {
        let root = loop {
            let candidate = std::env::temp_dir().join(format!(
                "iox-session-test-{}-{}",
                std::process::id(),
                TEST_ID.fetch_add(1, Ordering::Relaxed)
            ));
            match fs::create_dir(&candidate) {
                Ok(()) => break candidate,
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(e) => panic!("cannot create isolated test directory: {e}"),
            }
        };
        Self {
            root,
            lock: Mutex::new(()),
        }
    }

    fn db(&self) -> PathBuf {
        self.root.join("nested/sessions.db")
    }

    fn legacy(&self) -> PathBuf {
        self.root.join("nested/sessions.jsonl")
    }

    fn backup(&self) -> PathBuf {
        self.root.join("nested/sessions.jsonl.migrated")
    }

    fn store(&self) -> SessionStore<'_> {
        SessionStore::new(self.db(), self.legacy(), &self.lock)
    }

    fn seed_legacy(&self, values: &[ChatSessionData]) {
        fs::create_dir_all(self.legacy().parent().unwrap()).unwrap();
        let bytes = values
            .iter()
            .map(|s| serde_json::to_string(s).unwrap() + "\n")
            .collect::<String>();
        fs::write(self.legacy(), bytes).unwrap();
    }

    /// 直接落库，用于构造旧版本写入的时间戳（`prepare_session` 会覆盖 updated_at）。
    fn seed_rows(&self, values: &[ChatSessionData]) {
        let conn = sqlite::open(&self.db()).unwrap();
        for value in values {
            conn.execute(
                "INSERT OR REPLACE INTO sessions
                     (id, title, action_id, model, created_at, updated_at, content_hash, payload)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7)",
                rusqlite::params![
                    &value.id,
                    &value.title,
                    &value.action_id,
                    &value.model,
                    i64::try_from(value.created_at).unwrap_or(i64::MAX),
                    i64::try_from(value.updated_at).unwrap_or(i64::MAX),
                    serde_json::to_string(value).unwrap(),
                ],
            )
            .unwrap();
        }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn sample(id: &str, stream: &str, created: u64, updated: u64) -> ChatSessionData {
    ChatSessionData {
        id: id.into(),
        title: "test".into(),
        action_id: "act".into(),
        provider_id: None,
        model: "model".into(),
        selected_text: String::new(),
        stream_text: stream.into(),
        messages: vec![],
        conversation: None,
        created_at: created,
        updated_at: updated,
    }
}

#[test]
fn missing_history_reads_empty_without_creating_files() {
    let f = Fixture::new();
    assert!(f.store().all().unwrap().is_empty());
    assert!(f.store().list().unwrap().is_empty());
    assert!(f.store().get("absent").is_err());
    assert!(!f.root.join("nested").exists());
}

#[test]
fn save_get_list_delete_clear_round_trip() {
    let f = Fixture::new();
    let store = f.store();

    assert_eq!(store.save(sample("one", "answer", 1, 1)).unwrap(), "one");
    assert_eq!(store.get("one").unwrap().stream_text, "answer");
    assert_eq!(store.list().unwrap()[0].id, "one");
    assert!(f.db().exists());
    // 新连接读取同一数据库仍然可见。
    assert_eq!(f.store().all().unwrap().len(), 1);

    store.delete("one").unwrap();
    assert!(store.get("one").is_err());
    assert!(store.list().unwrap().is_empty());

    store.save(sample("two", "answer", 1, 1)).unwrap();
    store.clear().unwrap();
    assert!(store.all().unwrap().is_empty());
    assert!(store.delete("gone").is_ok());
}

#[test]
fn saves_return_canonical_and_preserve_upsert_rules() {
    let f = Fixture::new();
    let store = f.store();

    assert_eq!(
        store.save(sample("original", "answer", 100, 1)).unwrap(),
        "original"
    );
    // 内容相同的新 ID 复用已有 ID。
    assert_eq!(
        store.save(sample("fresh", "answer", 200, 1)).unwrap(),
        "original"
    );
    assert_eq!(store.get("original").unwrap().created_at, 100);

    // 同一 ID 的新内容不会抬高创建时间。
    store.save(sample("original", "changed", 300, 1)).unwrap();
    assert_eq!(store.get("original").unwrap().created_at, 100);

    // 空回答不参与去重。
    store.save(sample("empty-a", "", 1, 1)).unwrap();
    store.save(sample("empty-b", "", 1, 1)).unwrap();
    assert_eq!(store.all().unwrap().len(), 3);

    let mut defaults = sample("", "", 0, 0);
    defaults.title.clear();
    defaults.selected_text = "selected\ntext".into();
    let id = store.save(defaults).unwrap();
    let saved = store.get(&id).unwrap();
    assert!(!id.is_empty());
    assert_eq!(saved.title, "selected text");
    assert!(saved.created_at > 0);
}

#[test]
fn limit_is_applied_on_save_and_rejects_evicted_canonical() {
    let f = Fixture::new();
    let seeded: Vec<_> = (0..201)
        .map(|i| sample(&i.to_string(), &format!("content{i}"), 1, 1))
        .collect();
    f.seed_rows(&seeded);
    // 读取不做裁剪。
    assert_eq!(f.store().all().unwrap().len(), 201);

    let id = f.store().save(sample("new", "new", 1, 1)).unwrap();
    let all = f.store().all().unwrap();
    assert_eq!(all.len(), 200);
    assert_eq!(all[0].id, id);

    // 所有已有记录都更新，新会话必然被裁剪，因此保存必须整体回滚。
    let g = Fixture::new();
    let future: Vec<_> = (0..200)
        .map(|i| sample(&i.to_string(), &format!("future{i}"), 1, 4_000_000_000))
        .collect();
    g.seed_rows(&future);
    let error = g.store().save(sample("evicted", "new", 1, 1)).unwrap_err();
    assert!(error.contains("上限"), "{error}");
    let remaining = g.store().all().unwrap();
    assert_eq!(remaining.len(), 200);
    assert!(!remaining.iter().any(|s| s.id == "evicted"));
}

#[test]
fn content_hash_does_not_merge_distinct_structured_conversations() {
    let f = Fixture::new();
    let store = f.store();
    let make = |id: &str, model: &str| {
        let mut value = serde_json::to_value(sample(id, "identical projection", 1, 2)).unwrap();
        value["conversation"] = serde_json::json!({"version":1,"turns":[{"model":model}]});
        serde_json::from_value::<ChatSessionData>(value).unwrap()
    };

    store.save(make("a", "model-a")).unwrap();
    store.save(make("b", "model-b")).unwrap();
    assert_eq!(store.all().unwrap().len(), 2);

    assert_eq!(store.save(make("c", "model-c")).unwrap(), "c");
    assert_eq!(store.all().unwrap().len(), 3);
    assert_eq!(store.save(make("d", "model-c")).unwrap(), "c");
    assert_eq!(store.all().unwrap().len(), 3);

    // 兼容文本相同但缺少结构化负载，属于不同内容。
    assert_eq!(
        store
            .save(sample("legacy", "identical projection", 1, 1))
            .unwrap(),
        "legacy"
    );
    assert_eq!(store.all().unwrap().len(), 4);
}

#[test]
fn structured_conversation_json_round_trips_without_dropping_extensions() {
    let f = Fixture::new();
    let mut value = serde_json::to_value(sample("structured", "answer", 1, 1)).unwrap();
    let snapshot = serde_json::json!({
        "version": 1,
        "action": { "id": "act", "name": "Original action" },
        "turns": [{"prompt": "literal **追问：**", "answer": "code\n\n```rust\n```", "model": "first-model"}],
        "futureExtension": {"keep": true}
    });
    value["conversation"] = snapshot.clone();
    let session: ChatSessionData = serde_json::from_value(value).unwrap();

    f.store().save(session).unwrap();
    let stored = serde_json::to_value(f.store().get("structured").unwrap()).unwrap();
    assert_eq!(stored.get("conversation"), Some(&snapshot));
}

#[test]
fn legacy_jsonl_is_imported_once_and_backed_up() {
    let f = Fixture::new();
    let mut newest = sample(
        "newest",
        "**追问：** hello world <!-- iox:answer --> answer",
        15,
        30,
    );
    newest.title = "**追问：** newest".into();
    let mut older = newest.clone();
    older.id = "older".into();
    older.created_at = 10;
    older.updated_at = 20;
    f.seed_legacy(&[older, newest]);

    let all = f.store().all().unwrap();
    assert_eq!(all.len(), 1, "内容重复的旧记录应合并");
    assert_eq!(all[0].id, "newest", "保留最新一条的身份");
    assert_eq!(all[0].created_at, 10, "合并后保留最早创建时间");
    assert_eq!(all[0].title, "hello world", "旧标题应被修复");
    assert_eq!(f.store().list().unwrap()[0].title, "hello world");
    assert!(!f.legacy().exists());
    assert!(f.backup().exists());

    // 导入标记生效，重复读取不会再次导入或改写数据。
    assert_eq!(f.store().all().unwrap().len(), 1);
    f.store().clear().unwrap();
    assert!(f.store().all().unwrap().is_empty());
    assert!(f.backup().exists());
}

#[test]
fn invalid_legacy_jsonl_is_reported_and_preserved() {
    let f = Fixture::new();
    let valid = serde_json::to_string(&sample("ok", "answer", 1, 2)).unwrap();
    let bytes = format!("{valid}\n{{\"secret\":\"PRIVATE_BODY\"}}");
    fs::create_dir_all(f.legacy().parent().unwrap()).unwrap();
    fs::write(f.legacy(), &bytes).unwrap();

    let store = f.store();
    for error in [
        store.all().unwrap_err(),
        store.list().unwrap_err(),
        store.get("ok").unwrap_err(),
        store.save(sample("new", "new", 1, 1)).unwrap_err(),
        store.clear().unwrap_err(),
    ] {
        assert!(error.contains(&f.legacy().display().to_string()));
        assert!(error.contains('2'), "错误应指出行号: {error}");
        assert!(!error.contains("PRIVATE_BODY"));
    }
    assert_eq!(fs::read(f.legacy()).unwrap(), bytes.as_bytes());
    assert!(!f.backup().exists());
}

#[test]
fn corrupt_database_is_reported_and_preserved() {
    let f = Fixture::new();
    fs::create_dir_all(f.db().parent().unwrap()).unwrap();
    fs::write(f.db(), b"PRIVATE_BODY is not a database").unwrap();
    let before = fs::read(f.db()).unwrap();

    let store = f.store();
    let error = store.all().unwrap_err();
    assert!(!error.contains("PRIVATE_BODY"));
    assert!(store.list().is_err());
    assert!(store.save(sample("new", "new", 1, 1)).is_err());
    assert_eq!(fs::read(f.db()).unwrap(), before);
}

#[test]
fn directory_at_database_path_is_an_error() {
    let f = Fixture::new();
    fs::create_dir_all(f.db()).unwrap();
    assert!(f.store().all().is_err());
    assert!(f.store().clear().is_err());
}

#[test]
fn concurrent_saves_keep_every_session() {
    let f = Fixture::new();
    let store = f.store();
    std::thread::scope(|scope| {
        for index in 0..8 {
            let store = &store;
            scope.spawn(move || {
                store
                    .save(sample(&format!("s{index}"), &format!("c{index}"), 1, 1))
                    .unwrap();
            });
        }
    });
    let all = f.store().all().unwrap();
    assert_eq!(all.len(), 8);
    for index in 0..8 {
        assert!(all.iter().any(|s| s.id == format!("s{index}")));
    }
}

fn change(session: ChatSessionData) -> SyncChange {
    SyncChange {
        id: session.id.clone(),
        updated_at: session.updated_at,
        deleted_at: 0,
        session: Some(session),
    }
}

fn remote_tombstone(id: &str, at: u64) -> SyncChange {
    SyncChange {
        id: id.to_string(),
        updated_at: at,
        deleted_at: at,
        session: None,
    }
}

#[test]
fn delete_keeps_a_tombstone_for_remote_propagation() {
    let f = Fixture::new();
    let store = f.store();
    store.save(sample("gone", "answer", 1, 1)).unwrap();
    store.delete("gone").unwrap();

    assert!(store.get("gone").is_err());
    assert!(store.list().unwrap().is_empty());

    let pending = store.pending(0).unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].id, "gone");
    assert!(pending[0].deleted_at > 0);
    assert!(pending[0].session.is_none());
}

#[test]
fn remote_newer_version_wins_and_replays_are_skipped() {
    let f = Fixture::new();
    let store = f.store();
    f.seed_rows(&[sample("a", "local", 1, 100)]);

    let mut newer = sample("a", "remote", 1, 200);
    newer.created_at = 5;
    let stats = store.apply(&[change(newer.clone())]).unwrap();
    assert_eq!(stats.applied, 1);
    assert_eq!(store.get("a").unwrap().stream_text, "remote");
    // 合并后保留本地更早的创建时间。
    assert_eq!(store.get("a").unwrap().created_at, 1);

    // 重复应用同一版本是幂等的。
    let stats = store.apply(&[change(newer)]).unwrap();
    assert_eq!((stats.applied, stats.skipped), (0, 1));

    // 更旧的远程版本不能覆盖本地。
    let stats = store
        .apply(&[change(sample("a", "stale", 1, 150))])
        .unwrap();
    assert_eq!((stats.applied, stats.skipped), (0, 1));
    assert_eq!(store.get("a").unwrap().stream_text, "remote");
}

#[test]
fn remote_tombstone_removes_local_row_and_newer_payload_resurrects_it() {
    let f = Fixture::new();
    let store = f.store();
    f.seed_rows(&[sample("a", "local", 1, 100)]);

    let stats = store.apply(&[remote_tombstone("a", 200)]).unwrap();
    assert_eq!(stats.applied, 1);
    assert!(store.get("a").is_err());

    // 已删除的行可以再次被更新的远程版本恢复。
    let mut revived = sample("a", "revived", 1, 300);
    revived.created_at = 1;
    let stats = store.apply(&[change(revived)]).unwrap();
    assert_eq!(stats.applied, 1);
    assert_eq!(store.get("a").unwrap().stream_text, "revived");
    assert_eq!(store.all().unwrap().len(), 1);
}

#[test]
fn local_delete_propagates_through_pending_changes() {
    let f = Fixture::new();
    let store = f.store();
    store.save(sample("a", "answer", 1, 1)).unwrap();
    store.save(sample("b", "other", 1, 1)).unwrap();
    store.delete("a").unwrap();

    let pending = store.pending(0).unwrap();
    let deleted: Vec<_> = pending
        .iter()
        .filter(|change| change.deleted_at > 0)
        .collect();
    assert_eq!(deleted.len(), 1);
    assert_eq!(deleted[0].id, "a");
    assert_eq!(deleted[0].deleted_at, deleted[0].updated_at);
    assert!(deleted[0].session.is_none());
    assert!(pending
        .iter()
        .any(|change| change.id == "b" && change.session.is_some()));
}

#[test]
fn retention_trim_turns_evicted_rows_into_tombstones() {
    let f = Fixture::new();
    let seeded: Vec<_> = (0..201)
        .map(|i| sample(&i.to_string(), &format!("content{i}"), 1, 1))
        .collect();
    f.seed_rows(&seeded);

    f.store().save(sample("new", "new", 1, 1)).unwrap();

    let pending = f.store().pending(0).unwrap();
    let tombstones: Vec<_> = pending
        .iter()
        .filter(|change| change.deleted_at > 0)
        .collect();
    // 201 条种子 + 1 条新会话 = 202 条，裁剪后应淘汰 2 条并留下墓碑。
    assert_eq!(tombstones.len(), 2, "超限淘汰必须留下墓碑供推送");
    assert!(tombstones.iter().all(|change| change.session.is_none()));
    assert!(tombstones.iter().any(|change| change.id == "0"));
    assert_eq!(
        pending
            .iter()
            .filter(|change| change.session.is_some())
            .count(),
        200
    );
}

#[test]
fn sync_cursors_persist_per_key() {
    let f = Fixture::new();
    let store = f.store();
    assert_eq!(store.cursor("pull::a").unwrap(), 0);
    store.set_cursor("pull::a", 42).unwrap();
    store.set_cursor("push::a", 7).unwrap();
    assert_eq!(store.cursor("pull::a").unwrap(), 42);
    assert_eq!(store.cursor("push::a").unwrap(), 7);
    // 新的连接读取同一个数据库。
    assert_eq!(f.store().cursor("pull::a").unwrap(), 42);
}
