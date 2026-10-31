//! Click a website's own new-conversation control without navigating or granting IPC.

const SCRIPT: &str = include_str!("new_chat.js");

pub fn build_script(origin: &str) -> String {
    let origin = serde_json::to_string(origin).unwrap();
    format!("(()=>{{{SCRIPT}\nreturn clickNewChat({{origin:{origin}}});}})()")
}
