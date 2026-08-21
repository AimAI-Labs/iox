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

/// DeepSeek 深度思考配置
#[derive(Debug, Serialize)]
struct ThinkingConfig {
    #[serde(rename = "type")]
    thinking_type: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
    /// DeepSeek 深度思考开关
    #[serde(skip_serializing_if = "Option::is_none")]
    thinking: Option<ThinkingConfig>,
    /// DeepSeek 推理深度 ("low" | "high" | "max")
    #[serde(skip_serializing_if = "Option::is_none")]
    reasoning_effort: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    content: Option<String>,
    /// DeepSeek 推理内容 (思维链)
    reasoning_content: Option<String>,
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
///
/// 当 `thinking_enabled` 为 true 时，请求体中附带 DeepSeek 深度思考参数，
/// 并将 `reasoning_content` 包裹为 `<think>...</think>` 标签发送给前端。
pub async fn execute_stream_request(
    app: AppHandle,
    ai_manager: AiManager,
    action_id: String,
    provider: ProviderConfig,
    model: String,
    system_prompt: Option<String>,
    user_prompt: String,
    thinking_enabled: bool,
) {
    let cancel_token = CancellationToken::new();
    ai_manager
        .register_token(action_id.clone(), cancel_token.clone())
        .await;

    let mut messages = Vec::new();
    // 深度思考模式下 DeepSeek 不支持 system prompt，需跳过
    if !thinking_enabled {
        if let Some(sys) = system_prompt {
            if !sys.trim().is_empty() {
                messages.push(ChatMessage {
                    role: "system".to_string(),
                    content: sys,
                });
            }
        }
    }
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: user_prompt,
    });

    let is_deepseek = provider.id.to_lowercase().contains("deepseek")
        || provider.base_url.to_lowercase().contains("deepseek");

    let request_body = ChatCompletionRequest {
        model,
        messages,
        stream: true,
        thinking: if thinking_enabled {
            Some(ThinkingConfig {
                thinking_type: "enabled".to_string(),
            })
        } else if is_deepseek {
            Some(ThinkingConfig {
                thinking_type: "disabled".to_string(),
            })
        } else {
            None
        },
        reasoning_effort: if thinking_enabled {
            Some("high".to_string())
        } else {
            None
        },
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
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
    // 追踪是否已发送过 <think> 开标签（用于 reasoning_content → <think> 包裹）
    let mut reasoning_started = false;

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                // 如果在推理过程中被取消，先闭合 <think> 标签
                if reasoning_started {
                    let _ = app.emit("action-stream-token", serde_json::json!({
                        "actionId": action_id,
                        "token": "</think>"
                    }));
                }
                let _ = app.emit("action-stream-done", serde_json::json!({ "actionId": action_id, "canceled": true }));
                break;
            }
            item = stream.next() => {
                match item {
                    Some(Ok(event)) => {
                        if event.data == "[DONE]" {
                            // 流结束时如果仍在推理中，闭合标签
                            if reasoning_started {
                                let _ = app.emit("action-stream-token", serde_json::json!({
                                    "actionId": action_id,
                                    "token": "</think>"
                                }));
                            }
                            let _ = app.emit("action-stream-done", serde_json::json!({ "actionId": action_id }));
                            break;
                        }
                        if let Ok(parsed) = serde_json::from_str::<StreamResponse>(&event.data) {
                            if let Some(choices) = parsed.choices {
                                for choice in choices {
                                    if let Some(delta) = choice.delta {
                                        // 处理 reasoning_content (DeepSeek 思维链)
                                        if let Some(reasoning) = delta.reasoning_content {
                                            if !reasoning_started {
                                                reasoning_started = true;
                                                let _ = app.emit("action-stream-token", serde_json::json!({
                                                    "actionId": action_id,
                                                    "token": "<think>"
                                                }));
                                            }
                                            let _ = app.emit("action-stream-token", serde_json::json!({
                                                "actionId": action_id,
                                                "token": reasoning
                                            }));
                                        }
                                        // 处理正文 content
                                        if let Some(content) = delta.content {
                                            // 从推理切换到正文时，闭合 <think> 标签
                                            if reasoning_started {
                                                reasoning_started = false;
                                                let _ = app.emit("action-stream-token", serde_json::json!({
                                                    "actionId": action_id,
                                                    "token": "</think>"
                                                }));
                                            }
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
                        if reasoning_started {
                            let _ = app.emit("action-stream-token", serde_json::json!({
                                "actionId": action_id,
                                "token": "</think>"
                            }));
                        }
                        let _ = app.emit("action-stream-error", serde_json::json!({
                            "actionId": action_id,
                            "error": format!("SSE parse error: {}", e)
                        }));
                        break;
                    }
                    None => {
                        if reasoning_started {
                            let _ = app.emit("action-stream-token", serde_json::json!({
                                "actionId": action_id,
                                "token": "</think>"
                            }));
                        }
                        let _ = app.emit("action-stream-done", serde_json::json!({ "actionId": action_id }));
                        break;
                    }
                }
            }
        }
    }
}
