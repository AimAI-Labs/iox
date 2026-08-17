// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let location = info.location().map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column())).unwrap_or_default();
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic payload".to_string()
        };
        eprintln!("🔥 [PANIC DETECTED] at {}: {}", location, payload);
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open("iox_panic.log") {
            use std::io::Write;
            let _ = writeln!(f, "[PANIC] at {}: {}", location, payload);
        }
    }));

    iox_lib::run()
}
