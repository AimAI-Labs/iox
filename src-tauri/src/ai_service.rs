use crate::config::ProviderConfig;
use arboard::Clipboard;
use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex as TokioMutex;
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub struct AiManager {
    cancel_tokens: Arc<TokioMutex<HashMap<String, CancellationToken>>>,
}

impl AiManager {
    pub fn new() -> Self {
        Self {
            cancel_tokens: Arc::new(TokioMutex::new(HashMap::new())),
        }
    }

    pub async fn cancel(&self, action_id: &str) {
        let mut tokens: tokio::sync::MutexGuard<'_, HashMap<String, CancellationToken>> = self.cancel_tokens.lock().await;
        if let Some(token) = tokens.remove(action_id) {
            token.cancel();
        }
    }

    pub async fn register_token(&self, action_id: String, token: CancellationToken) {
        let mut tokens: tokio::sync::MutexGuard<'_, HashMap<String, CancellationToken>> = self.cancel_tokens.lock().await;
        tokens.insert(action_id, token);
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: Option<StreamDelta>,
    #[serde(rename = "finish_reason")]
    #[allow(dead_code)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StreamResponse {
    choices: Option<Vec<StreamChoice>>,
}

/// 渲染 URL 模板，将 `{text}` 替换为 URL 编码的字符串
pub fn render_url_template(template: &str, text: &str) -> String {
    let encoded_text = urlencoding::encode(text);
    template
        .replace("{text}", &encoded_text)
        .replace("{query}", &encoded_text)
        .replace("{raw_text}", text)
}

/// 渲染提示词模板，将 `{text}` 替换为实际选中的文本
pub fn render_prompt_template(template: &str, text: &str) -> String {
    template.replace("{text}", text)
}

/// 执行 Web 跳转动作
pub fn execute_web_action(
    url_template: &str,
    text: &str,
    copy_to_clipboard: bool,
) -> Result<(), String> {
    if copy_to_clipboard {
        if let Ok(mut clipboard) = Clipboard::new() {
            let _ = clipboard.set_text(text);
        }
    }

    if !url_template.trim().is_empty() {
        let url = render_url_template(url_template, text);
        open::that(&url).map_err(|e| format!("Failed to open browser URL: {}", e))?;
    }
    Ok(())
}

/// 异步执行 OpenAI 兼容协议流式请求
pub async fn execute_stream_request(
    app: AppHandle,
    ai_manager: AiManager,
    action_id: String,
    provider: ProviderConfig,
    model: String,
    system_prompt: Option<String>,
    user_prompt: String,
) {
    let cancel_token = CancellationToken::new();
    ai_manager
        .register_token(action_id.clone(), cancel_token.clone())
        .await;

    let mut messages = Vec::new();
    if let Some(sys) = system_prompt {
        if !sys.trim().is_empty() {
            messages.push(ChatMessage {
                role: "system".to_string(),
                content: sys,
            });
        }
    }
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: user_prompt,
    });

    let request_body = ChatCompletionRequest {
        model,
        messages,
        stream: true,
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build();

    let client = match client {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit(
                "action-stream-error",
                serde_json::json!({ "actionId": action_id, "error": format!("Client error: {}", e) }),
            );
            return;
        }
    };

    let endpoint = if provider.base_url.ends_with("/chat/completions") {
        provider.base_url.clone()
    } else {
        format!("{}/chat/completions", provider.base_url.trim_end_matches('/'))
    };

    let mut req = client.post(&endpoint).json(&request_body);
    if !provider.api_key.trim().is_empty() {
        req = req.header("Authorization", format!("Bearer {}", provider.api_key.trim()));
    }

    let response = tokio::select! {
        _ = cancel_token.cancelled() => {
            let _ = app.emit("action-stream-done", serde_json::json!({ "actionId": action_id, "canceled": true }));
            return;
        }
        res = req.send() => {
            match res {
                Ok(r) => r,
                Err(e) => {
                    let _ = app.emit(
                        "action-stream-error",
                        serde_json::json!({ "actionId": action_id, "error": format!("Network error: {}", e) }),
                    );
                    return;
                }
            }
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        let _ = app.emit(
            "action-stream-error",
            serde_json::json!({ "actionId": action_id, "error": format!("HTTP {}: {}", status, error_text) }),
        );
        return;
    }

    let mut stream = response.bytes_stream().eventsource();

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                let _ = app.emit("action-stream-done", serde_json::json!({ "actionId": action_id, "canceled": true }));
                break;
            }
            item = stream.next() => {
                match item {
                    Some(Ok(event)) => {
                        if event.data == "[DONE]" {
                            let _ = app.emit("action-stream-done", serde_json::json!({ "actionId": action_id }));
                            break;
                        }
                        if let Ok(parsed) = serde_json::from_str::<StreamResponse>(&event.data) {
                            if let Some(choices) = parsed.choices {
                                for choice in choices {
                                    if let Some(delta) = choice.delta {
                                        if let Some(content) = delta.content {
                                            let _ = app.emit("action-stream-token", serde_json::json!({
                                                "actionId": action_id,
                                                "token": content
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Some(Err(e)) => {
                        let _ = app.emit("action-stream-error", serde_json::json!({
                            "actionId": action_id,
                            "error": format!("SSE parse error: {}", e)
                        }));
                        break;
                    }
                    None => {
                        let _ = app.emit("action-stream-done", serde_json::json!({ "actionId": action_id }));
                        break;
                    }
                }
            }
        }
    }
}

// 辅助 URL 编码
mod urlencoding {
    pub fn encode(data: &str) -> String {
        let mut result = String::new();
        for byte in data.bytes() {
            match byte {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    result.push(byte as char);
                }
                _ => {
                    result.push_str(&format!("%{:02X}", byte));
                }
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_url_template() {
        let tmpl = "https://tongyi.aliyun.com/qianwen/?q={text}";
        let text = "你好 世界";
        let rendered = render_url_template(tmpl, text);
        assert_eq!(rendered, "https://tongyi.aliyun.com/qianwen/?q=%E4%BD%A0%E5%A5%BD%20%E4%B8%96%E7%95%8C");
    }

    #[test]
    fn test_render_prompt_template() {
        let tmpl = "翻译：{text}";
        let text = "Hello";
        assert_eq!(render_prompt_template(tmpl, text), "翻译：Hello");
    }
}
