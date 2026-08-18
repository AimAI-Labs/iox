use super::AiManager;
use crate::config::ProviderConfig;
use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;

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
