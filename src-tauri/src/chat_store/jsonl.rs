use super::ChatSessionData;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

fn error(path: &Path, operation: &str, line: Option<usize>) -> String {
    match line {
        Some(line) => format!("{}: line {}: {}", path.display(), line, operation),
        None => format!("{}: {}", path.display(), operation),
    }
}

/// 严格读取旧版 `sessions.jsonl`：任何坏行都整体失败，供一次性导入使用。
pub(super) fn read(path: &Path) -> Result<Vec<ChatSessionData>, String> {
    let file = File::open(path).map_err(|_| error(path, "无法打开旧版会话历史", None))?;
    let mut reader = BufReader::new(file);
    let mut sessions = Vec::new();
    let mut bytes = Vec::new();
    let mut line = 0;
    loop {
        line += 1;
        bytes.clear();
        let count = reader
            .read_until(b'\n', &mut bytes)
            .map_err(|_| error(path, "无法读取旧版会话历史", Some(line)))?;
        if count == 0 {
            break;
        }
        let text =
            std::str::from_utf8(&bytes).map_err(|_| error(path, "非法的 UTF-8", Some(line)))?;
        if text.trim().is_empty() {
            continue;
        }
        // 不转发 serde 的错误：它可能引用私有字段值。
        let session =
            serde_json::from_str(text).map_err(|_| error(path, "非法的会话 JSON", Some(line)))?;
        sessions.push(session);
    }
    Ok(sessions)
}
