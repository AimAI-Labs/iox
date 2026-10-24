use super::*;
use std::fs;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

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
    fn path(&self) -> PathBuf {
        self.root.join("nested/sessions.jsonl")
    }
    fn store(&self) -> SessionStore<'_> {
        SessionStore::new(self.path(), &self.lock)
    }
    fn seed(&self, bytes: &[u8]) {
        fs::create_dir_all(self.path().parent().unwrap()).unwrap();
        fs::write(self.path(), bytes).unwrap();
    }
    fn sessions(&self, values: &[ChatSessionData]) {
        self.seed(
            &values
                .iter()
                .map(|s| serde_json::to_string(s).unwrap() + "\n")
                .collect::<String>()
                .into_bytes(),
        );
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
fn queries_missing_history_do_not_create_directories() {
    let f = Fixture::new();
    assert!(f.store().all().unwrap().is_empty());
    assert!(f.store().list().unwrap().is_empty());
    assert!(f.store().get("absent").is_err());
    assert!(!f.path().parent().unwrap().exists());
}

#[test]
fn every_intent_rejects_corrupt_history_and_preserves_bytes() {
    for suffix in [b"{\"secret\":\"PRIVATE_BODY\"}".as_slice(), b"\xff", b"{}"] {
        for middle in [false, true] {
            let f = Fixture::new();
            let valid = serde_json::to_string(&sample("ok", "answer", 1, 2)).unwrap();
            let mut bytes = format!("{valid}\n").into_bytes();
            bytes.extend_from_slice(suffix);
            if middle {
                bytes.extend_from_slice(format!("\n{valid}\n").as_bytes());
            }
            f.seed(&bytes);
            let store = f.store();
            let errors = [
                store.all().unwrap_err(),
                store.list().unwrap_err(),
                store.get("ok").unwrap_err(),
                store.save(sample("new", "new", 1, 1)).unwrap_err(),
                store.delete("ok").unwrap_err(),
                store.clear().unwrap_err(),
            ];
            for error in errors {
                assert!(error.contains(&f.path().display().to_string()));
                assert!(error.contains("2"));
                assert!(!error.contains("PRIVATE_BODY"));
            }
            assert_eq!(fs::read(f.path()).unwrap(), bytes);
        }
    }
}

#[test]
fn queries_normalize_legacy_duplicates_without_writing() {
    let f = Fixture::new();
    let mut old = sample(
        "old",
        "**追问：** hello world <!-- iox:answer --> answer",
        10,
        20,
    );
    old.title = "**追问：** old".into();
    let mut new = old.clone();
    new.id = "new".into();
    new.updated_at = 30;
    new.created_at = 15;
    let mut value = serde_json::to_value(&new).unwrap();
    value.as_object_mut().unwrap().remove("messages");
    let bytes = format!("\n{}\n  \n{}", serde_json::to_string(&old).unwrap(), value).into_bytes();
    f.seed(&bytes);
    let store = f.store();
    let all = store.all().unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].id, "new");
    assert_eq!(all[0].created_at, 10);
    assert_eq!(all[0].title, "hello world");
    assert!(all[0].messages.is_empty());
    assert_eq!(store.list().unwrap()[0].title, "hello world");
    assert_eq!(store.get("new").unwrap().title, "hello world");
    assert_eq!(fs::read(f.path()).unwrap(), bytes);
    store.save(sample("another", "different", 1, 1)).unwrap();
    assert_eq!(store.get("new").unwrap().title, "hello world");
}

#[test]
fn saves_return_committed_canonical_and_preserve_upsert_rules() {
    let f = Fixture::new();
    let store = f.store();
    assert_eq!(
        store.save(sample("original", "answer", 100, 1)).unwrap(),
        "original"
    );
    assert_eq!(
        store.save(sample("fresh", "answer", 200, 1)).unwrap(),
        "original"
    );
    assert_eq!(store.get("original").unwrap().created_at, 100);
    store.save(sample("original", "changed", 300, 1)).unwrap();
    assert_eq!(store.get("original").unwrap().created_at, 100);
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
    store.delete("original").unwrap();
    assert!(store.get("original").is_err());
    store.clear().unwrap();
    assert!(store.all().unwrap().is_empty());
    assert!(fs::read(f.path()).unwrap().is_empty());
}

#[test]
fn limit_is_applied_on_commit_and_rejects_evicted_canonical() {
    let f = Fixture::new();
    let records: Vec<_> = (0..201)
        .map(|i| sample(&i.to_string(), &format!("content{i}"), 1, 1))
        .collect();
    f.sessions(&records);
    assert_eq!(f.store().all().unwrap().len(), 201);
    let id = f.store().save(sample("new", "new", 1, 1)).unwrap();
    let all = f.store().all().unwrap();
    assert_eq!(all.len(), 200);
    assert_eq!(all[0].id, id);
    assert_eq!(all[1].id, "0");
    let future: Vec<_> = (0..200)
        .map(|i| sample(&i.to_string(), &format!("future{i}"), 1, u64::MAX))
        .collect();
    f.sessions(&future);
    let bytes = fs::read(f.path()).unwrap();
    assert!(f.store().save(sample("evicted", "new", 1, 1)).is_err());
    assert_eq!(fs::read(f.path()).unwrap(), bytes);
}

#[test]
fn opening_a_directory_is_an_error() {
    let f = Fixture::new();
    fs::create_dir_all(f.path()).unwrap();
    assert!(f.store().all().is_err());
    assert!(f.store().clear().is_err());
}

use jsonl::{DurableWrite, FileIo, Io};
use std::io::{self, BufRead, Read, Write};
use std::path::Path;

#[derive(Clone, Copy, Debug, PartialEq)]
enum Failure {
    Open,
    Read,
    Directory,
    Create,
    Write,
    Flush,
    Sync,
    Rename,
}
struct FaultIo(Failure);
fn injected() -> io::Error {
    io::Error::other("injected filesystem failure PRIVATE_BODY")
}

struct InterruptedReader {
    inner: Box<dyn BufRead>,
    consumed_line: bool,
}
impl Read for InterruptedReader {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        self.inner.read(bytes)
    }
}
impl BufRead for InterruptedReader {
    fn fill_buf(&mut self) -> io::Result<&[u8]> {
        if self.consumed_line {
            return Err(injected());
        }
        let bytes = self.inner.fill_buf()?;
        let length = bytes
            .iter()
            .position(|b| *b == b'\n')
            .map_or(bytes.len(), |i| i + 1);
        Ok(&bytes[..length])
    }
    fn consume(&mut self, amount: usize) {
        self.inner.consume(amount);
        self.consumed_line = true;
    }
}

struct FaultWriter {
    inner: Box<dyn DurableWrite>,
    failure: Failure,
    wrote: bool,
}
impl Write for FaultWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if self.failure == Failure::Write {
            if self.wrote {
                return Err(injected());
            }
            self.wrote = true;
            return self.inner.write(&bytes[..bytes.len().min(7)]);
        }
        self.inner.write(bytes)
    }
    fn flush(&mut self) -> io::Result<()> {
        if self.failure == Failure::Flush {
            return Err(injected());
        }
        self.inner.flush()
    }
}
impl DurableWrite for FaultWriter {
    fn sync_all(&mut self) -> io::Result<()> {
        if self.failure == Failure::Sync {
            return Err(injected());
        }
        self.inner.sync_all()
    }
}
impl Io for FaultIo {
    fn open(&self, path: &Path) -> io::Result<Box<dyn BufRead>> {
        if self.0 == Failure::Open {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "PRIVATE_BODY",
            ));
        }
        let inner = FileIo.open(path)?;
        if self.0 == Failure::Read {
            return Ok(Box::new(InterruptedReader {
                inner,
                consumed_line: false,
            }));
        }
        Ok(inner)
    }
    fn create_dir_all(&self, path: &Path) -> io::Result<()> {
        if self.0 == Failure::Directory {
            Err(injected())
        } else {
            FileIo.create_dir_all(path)
        }
    }
    fn create_new(&self, path: &Path) -> io::Result<Box<dyn DurableWrite>> {
        if self.0 == Failure::Create {
            return Err(injected());
        }
        Ok(Box::new(FaultWriter {
            inner: FileIo.create_new(path)?,
            failure: self.0,
            wrote: false,
        }))
    }
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
        if self.0 == Failure::Rename {
            Err(injected())
        } else {
            FileIo.rename(from, to)
        }
    }
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        FileIo.remove_file(path)
    }
}

#[test]
fn actual_io_faults_preserve_original_and_only_clean_owned_temporary_files() {
    for failure in [
        Failure::Open,
        Failure::Read,
        Failure::Directory,
        Failure::Create,
        Failure::Write,
        Failure::Flush,
        Failure::Sync,
        Failure::Rename,
    ] {
        let f = Fixture::new();
        f.sessions(&[sample("old", "existing", 1, 1)]);
        let before = fs::read(f.path()).unwrap();
        let unrelated = f.path().parent().unwrap().join(".sessions-unrelated.tmp");
        fs::write(&unrelated, b"keep").unwrap();
        let io = FaultIo(failure);
        let store = SessionStore {
            path: f.path(),
            lock: &f.lock,
            io: &io,
        };
        let error = store.save(sample("new", "new", 1, 1)).unwrap_err();
        assert!(!error.contains("PRIVATE_BODY"));
        assert!(error.contains(&f.path().display().to_string()));
        assert_eq!(fs::read(f.path()).unwrap(), before, "{failure:?}");
        assert_eq!(fs::read(&unrelated).unwrap(), b"keep");
        assert_eq!(
            fs::read_dir(f.path().parent().unwrap()).unwrap().count(),
            2,
            "{failure:?}"
        );
        assert!(store.delete("missing").is_err());
        // Empty snapshots perform no write calls, but still flush/sync/replace.
        if failure != Failure::Write {
            assert!(store.clear().is_err());
        }
        assert_eq!(fs::read(f.path()).unwrap(), before);
        if matches!(failure, Failure::Open | Failure::Read) {
            assert!(store.all().is_err());
        }
    }
}

#[test]
fn first_commit_failures_never_publish_a_partial_formal_file() {
    for failure in [
        Failure::Directory,
        Failure::Create,
        Failure::Write,
        Failure::Flush,
        Failure::Sync,
        Failure::Rename,
    ] {
        let f = Fixture::new();
        let io = FaultIo(failure);
        let store = SessionStore {
            path: f.path(),
            lock: &f.lock,
            io: &io,
        };
        assert!(store.save(sample("first", "answer", 1, 1)).is_err());
        assert!(!f.path().exists());
        if let Ok(entries) = fs::read_dir(f.path().parent().unwrap()) {
            assert_eq!(entries.count(), 0);
        }
    }
}

#[test]
fn directory_creation_failure_is_propagated_with_real_filesystem() {
    let f = Fixture::new();
    fs::write(f.root.join("nested"), b"not a directory").unwrap();
    assert!(f.store().save(sample("new", "new", 1, 1)).is_err());
    assert_eq!(fs::read(f.root.join("nested")).unwrap(), b"not a directory");
}

#[cfg(windows)]
#[test]
fn windows_rename_sharing_conflict_preserves_existing_history() {
    use std::os::windows::fs::OpenOptionsExt;
    let f = Fixture::new();
    f.sessions(&[sample("old", "existing", 1, 1)]);
    let before = fs::read(f.path()).unwrap();
    // FILE_SHARE_READ | FILE_SHARE_WRITE permits strict reads but excludes deletion/replacement.
    let handle = fs::OpenOptions::new()
        .read(true)
        .share_mode(1 | 2)
        .open(f.path())
        .unwrap();
    assert!(f.store().save(sample("new", "new", 1, 1)).is_err());
    assert_eq!(fs::read(f.path()).unwrap(), before);
    assert_eq!(fs::read_dir(f.path().parent().unwrap()).unwrap().count(), 1);
    drop(handle);
    f.store().save(sample("new", "new", 1, 1)).unwrap();
    assert_eq!(f.store().all().unwrap().len(), 2);
}

struct BlockingIo {
    entered: std::sync::mpsc::Sender<()>,
    release: Mutex<std::sync::mpsc::Receiver<()>>,
    committing: std::sync::mpsc::Sender<()>,
    commit_release: Mutex<std::sync::mpsc::Receiver<()>>,
}
impl Io for BlockingIo {
    fn open(&self, path: &Path) -> io::Result<Box<dyn BufRead>> {
        let file = FileIo.open(path)?;
        self.entered.send(()).unwrap();
        self.release
            .lock()
            .unwrap()
            .recv_timeout(Duration::from_secs(5))
            .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "read gate was not released"))?;
        Ok(file)
    }
    fn create_dir_all(&self, path: &Path) -> io::Result<()> {
        FileIo.create_dir_all(path)
    }
    fn create_new(&self, path: &Path) -> io::Result<Box<dyn DurableWrite>> {
        FileIo.create_new(path)
    }
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
        self.committing.send(()).unwrap();
        self.commit_release
            .lock()
            .unwrap()
            .recv_timeout(Duration::from_secs(5))
            .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "commit gate was not released"))?;
        FileIo.rename(from, to)
    }
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        FileIo.remove_file(path)
    }
}

#[test]
fn shared_lock_covers_read_modify_commit_for_save_save_and_save_delete() {
    for delete in [false, true] {
        let f = Fixture::new();
        f.sessions(&[
            sample("remove", "remove", 1, 1),
            sample("keep", "keep", 1, 1),
        ]);
        let (entered_tx, entered_rx) = std::sync::mpsc::channel();
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        let (committing_tx, committing_rx) = std::sync::mpsc::channel();
        let (commit_release_tx, commit_release_rx) = std::sync::mpsc::channel();
        let io = BlockingIo {
            entered: entered_tx,
            release: Mutex::new(release_rx),
            committing: committing_tx,
            commit_release: Mutex::new(commit_release_rx),
        };
        let start = std::sync::Barrier::new(2);
        std::thread::scope(|scope| {
            let first = scope.spawn(|| {
                SessionStore {
                    path: f.path(),
                    lock: &f.lock,
                    io: &io,
                }
                .save(sample("first", "first", 1, 1))
            });
            entered_rx
                .recv_timeout(Duration::from_secs(5))
                .expect("first save did not reach the read gate");
            assert!(matches!(
                f.lock.try_lock(),
                Err(std::sync::TryLockError::WouldBlock)
            ));
            let second = scope.spawn(|| {
                start.wait();
                if delete {
                    f.store().delete("remove")
                } else {
                    f.store().save(sample("second", "second", 1, 1)).map(|_| ())
                }
            });
            start.wait();
            release_tx.send(()).unwrap();
            committing_rx
                .recv_timeout(Duration::from_secs(5))
                .expect("first save did not reach the commit gate");
            assert!(matches!(
                f.lock.try_lock(),
                Err(std::sync::TryLockError::WouldBlock)
            ));
            commit_release_tx.send(()).unwrap();
            first.join().unwrap().unwrap();
            second.join().unwrap().unwrap();
        });
        let records = f.store().all().unwrap();
        assert!(records.iter().any(|s| s.id == "keep"));
        assert!(records.iter().any(|s| s.id == "first"));
        if delete {
            assert!(!records.iter().any(|s| s.id == "remove"));
        } else {
            assert!(records.iter().any(|s| s.id == "second"));
        }
    }
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
fn matching_compatibility_text_does_not_merge_distinct_structured_conversations() {
    let f = Fixture::new();
    let make = |id: &str, model: &str| {
        let mut value = serde_json::to_value(sample(id, "identical projection", 1, 2)).unwrap();
        value["conversation"] = serde_json::json!({"version":1,"turns":[{"model":model}]});
        serde_json::from_value::<ChatSessionData>(value).unwrap()
    };
    f.sessions(&[make("a", "model-a"), make("b", "model-b")]);
    assert_eq!(f.store().all().unwrap().len(), 2);
    assert_eq!(f.store().save(make("c", "model-c")).unwrap(), "c");
    assert_eq!(f.store().all().unwrap().len(), 3);
    assert_eq!(f.store().save(make("d", "model-c")).unwrap(), "c");
    let legacy = sample("legacy", "identical projection", 1, 1);
    assert_eq!(f.store().save(legacy).unwrap(), "legacy");
    assert_eq!(f.store().all().unwrap().len(), 4);
}
