use super::ChatSessionData;
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufRead, BufReader, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

/// The seam is limited to actual filesystem operations. Tests still run this
/// reader and commit algorithm, including the real temporary-file lifecycle.
pub(super) trait DurableWrite: Write {
    fn sync_all(&mut self) -> io::Result<()>;
}
impl DurableWrite for File {
    fn sync_all(&mut self) -> io::Result<()> {
        File::sync_all(self)
    }
}

pub(super) trait Io: Sync {
    fn open(&self, path: &Path) -> io::Result<Box<dyn BufRead>>;
    fn create_dir_all(&self, path: &Path) -> io::Result<()>;
    fn create_new(&self, path: &Path) -> io::Result<Box<dyn DurableWrite>>;
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()>;
    fn remove_file(&self, path: &Path) -> io::Result<()>;
}

pub(super) struct FileIo;
impl Io for FileIo {
    fn open(&self, path: &Path) -> io::Result<Box<dyn BufRead>> {
        Ok(Box::new(BufReader::new(File::open(path)?)))
    }
    fn create_dir_all(&self, path: &Path) -> io::Result<()> {
        fs::create_dir_all(path)
    }
    fn create_new(&self, path: &Path) -> io::Result<Box<dyn DurableWrite>> {
        Ok(Box::new(
            OpenOptions::new().write(true).create_new(true).open(path)?,
        ))
    }
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
        fs::rename(from, to)
    }
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }
}

fn error(path: &Path, operation: &str, line: Option<usize>) -> String {
    match line {
        Some(line) => format!("{}: line {}: {}", path.display(), line, operation),
        None => format!("{}: {}", path.display(), operation),
    }
}

pub(super) fn read(path: &Path, io: &dyn Io) -> Result<Vec<ChatSessionData>, String> {
    let mut reader = match io.open(path) {
        Ok(reader) => reader,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(_) => return Err(error(path, "cannot open session history", None)),
    };
    let mut sessions = Vec::new();
    let mut bytes = Vec::new();
    let mut line = 0;
    loop {
        line += 1;
        bytes.clear();
        let count = reader
            .read_until(b'\n', &mut bytes)
            .map_err(|_| error(path, "cannot read session history", Some(line)))?;
        if count == 0 {
            break;
        }
        let text =
            std::str::from_utf8(&bytes).map_err(|_| error(path, "invalid UTF-8", Some(line)))?;
        if text.trim().is_empty() {
            continue;
        }
        // Do not forward serde's error: it can quote private field values.
        let session = serde_json::from_str(text)
            .map_err(|_| error(path, "invalid session JSON", Some(line)))?;
        sessions.push(session);
    }
    Ok(sessions)
}

static TEMP_ID: AtomicU64 = AtomicU64::new(0);

pub(super) fn commit(path: &Path, sessions: &[ChatSessionData], io: &dyn Io) -> Result<(), String> {
    let mut bytes = Vec::new();
    for session in sessions {
        serde_json::to_writer(&mut bytes, session)
            .map_err(|_| error(path, "cannot serialize session history", None))?;
        bytes.push(b'\n');
    }
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    io.create_dir_all(dir)
        .map_err(|_| error(path, "cannot create session directory", None))?;
    let (temp, mut file) = loop {
        let name = format!(
            ".sessions-{}-{}.tmp",
            std::process::id(),
            TEMP_ID.fetch_add(1, Ordering::Relaxed)
        );
        let temp = dir.join(name);
        match io.create_new(&temp) {
            Ok(file) => break (temp, file),
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(_) => return Err(error(path, "cannot create temporary session file", None)),
        }
    };
    let result = (|| {
        file.write_all(&bytes)
            .map_err(|_| error(path, "cannot write session history", None))?;
        file.flush()
            .map_err(|_| error(path, "cannot flush session history", None))?;
        file.sync_all()
            .map_err(|_| error(path, "cannot sync session history", None))?;
        Ok(())
    })();
    // Windows requires the writer handle to be closed before replacement.
    drop(file);
    let result = result.and_then(|()| {
        io.rename(&temp, path)
            .map_err(|_| error(path, "cannot replace session history", None))
    });
    if result.is_err() {
        let _ = io.remove_file(&temp);
    }
    result
}
