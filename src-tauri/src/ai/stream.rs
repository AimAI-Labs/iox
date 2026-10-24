use super::requests::{Outcome, RequestHandle};
use crate::config::ProviderConfig;
use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};

/// DeepSeek 官方支持的推理强度；旧调用未指定时沿用 high。
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReasoningEffort {
    Low,
    #[default]
    High,
    Max,
}

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
    reasoning_effort: Option<ReasoningEffort>,
}

fn thinking_parameters(
    is_deepseek: bool,
    enabled: bool,
    effort: Option<ReasoningEffort>,
) -> (Option<ThinkingConfig>, Option<ReasoningEffort>) {
    if !is_deepseek {
        return (None, None);
    }
    (
        Some(ThinkingConfig {
            thinking_type: if enabled { "enabled" } else { "disabled" }.to_string(),
        }),
        if enabled {
            Some(effort.unwrap_or_default())
        } else {
            None
        },
    )
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

/// Executes an already accepted request. All output and termination belong to its handle.
pub(crate) async fn execute_stream_request(
    request: RequestHandle,
    provider: ProviderConfig,
    model: String,
    system_prompt: Option<String>,
    user_prompt: String,
    thinking_enabled: bool,
    reasoning_effort: Option<ReasoningEffort>,
) {
    let outcome = send_request(
        &request,
        provider,
        model,
        system_prompt,
        user_prompt,
        thinking_enabled,
        reasoning_effort,
    )
    .await;
    request.finish(outcome);
}

async fn send_request(
    request: &RequestHandle,
    provider: ProviderConfig,
    model: String,
    system_prompt: Option<String>,
    user_prompt: String,
    thinking_enabled: bool,
    reasoning_effort: Option<ReasoningEffort>,
) -> Outcome {
    let mut messages = Vec::new();
    // DeepSeek thinking mode does not accept a system prompt.
    if !thinking_enabled {
        if let Some(sys) = system_prompt {
            if !sys.trim().is_empty() {
                messages.push(ChatMessage {
                    role: "system".into(),
                    content: sys,
                });
            }
        }
    }
    messages.push(ChatMessage {
        role: "user".into(),
        content: user_prompt,
    });
    let is_deepseek = provider.id.to_lowercase().contains("deepseek")
        || provider.base_url.to_lowercase().contains("deepseek");
    let (thinking, reasoning_effort) =
        thinking_parameters(is_deepseek, thinking_enabled, reasoning_effort);
    let request_body = ChatCompletionRequest {
        model,
        messages,
        stream: true,
        thinking,
        reasoning_effort,
    };
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
    {
        Ok(client) => client,
        Err(error) => return Outcome::Failed(format!("Client error: {error}")),
    };
    let endpoint = if provider.base_url.ends_with("/chat/completions") {
        provider.base_url.clone()
    } else {
        format!(
            "{}/chat/completions",
            provider.base_url.trim_end_matches('/')
        )
    };
    let mut req = client.post(&endpoint).json(&request_body);
    if !provider.api_key.trim().is_empty() {
        req = req.header(
            "Authorization",
            format!("Bearer {}", provider.api_key.trim()),
        );
    }
    let response = match cancellable(request, async {
        req.send()
            .await
            .map_err(|error| format!("Network error: {error}"))
    })
    .await
    {
        Ok(response) => response,
        Err(outcome) => return outcome,
    };
    if !response.status().is_success() {
        let status = response.status();
        // Reading a failed response body may also block; cancellation must cover it.
        return match cancellable(request, async {
            response
                .text()
                .await
                .map_err(|error| format!("HTTP {status}: failed reading response: {error}"))
        })
        .await
        {
            Ok(body) => Outcome::Failed(format!("HTTP {status}: {body}")),
            Err(outcome) => outcome,
        };
    }
    let stream = response.bytes_stream().eventsource().map(|item| {
        item.map(|event| event.data)
            .map_err(|error| format!("SSE parse error: {error}"))
    });
    read_sse(request, stream).await
}

/// The two HTTP waits use the same cancellation seam, including error-body reads.
async fn cancellable<T>(
    request: &RequestHandle,
    future: impl std::future::Future<Output = Result<T, String>>,
) -> Result<T, Outcome> {
    tokio::select! {
        biased;
        _ = request.cancellation().cancelled() => Err(Outcome::Canceled),
        result = future => result.map_err(Outcome::Failed),
    }
}

async fn read_sse(
    request: &RequestHandle,
    stream: impl futures_util::Stream<Item = Result<String, String>>,
) -> Outcome {
    futures_util::pin_mut!(stream);
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(30);
    let mut received_any = false;
    loop {
        tokio::select! {
            biased;
            _ = request.cancellation().cancelled() => return Outcome::Canceled,
            _ = tokio::time::sleep_until(deadline), if !received_any => {
                return Outcome::Failed("首字等待超时（30s），服务端未返回任何数据。请检查网络或 API 端点是否支持流式输出。".into());
            }
            item = stream.next() => match item {
                Some(Ok(data)) => {
                    received_any = true;
                    if data == "[DONE]" { return Outcome::Completed; }
                    if let Ok(parsed) = serde_json::from_str::<StreamResponse>(&data) {
                        for choice in parsed.choices.into_iter().flatten() {
                            if let Some(delta) = choice.delta {
                                if let Some(reasoning) = delta.reasoning_content { request.reasoning(&reasoning); }
                                if let Some(content) = delta.content { request.content(&content); }
                            }
                        }
                    }
                }
                Some(Err(error)) => return Outcome::Failed(error),
                None => return Outcome::Completed,
            }
        }
    }
}
#[cfg(test)]
mod driver_tests {
    use super::super::requests::{tests::recording, EventData};
    use super::*;
    use futures_util::stream;

    #[tokio::test]
    async fn done_eof_and_sse_error_finish_once_after_closing_reasoning() {
        for ending in [
            Some(Ok("[DONE]".to_string())),
            None,
            Some(Err("broken SSE".to_string())),
        ] {
            let (manager, events, sink) = recording();
            let request = manager.begin("a".into(), "r".into(), sink).unwrap();
            let reasoning =
                Ok(r#"{"choices":[{"delta":{"reasoning_content":"why"}}]}"#.to_string());
            let input = stream::iter(std::iter::once(reasoning).chain(ending));
            let outcome = read_sse(&request, input).await;
            request.finish(outcome);
            assert!(!request.finish(Outcome::Completed));
            assert!(!request.content("late"));
            let events = events.lock().unwrap();
            assert_eq!(events.len(), 4);
            assert_eq!(
                events[2].data,
                EventData::Token {
                    token: "</think>".into()
                }
            );
            assert!(!matches!(events[3].data, EventData::Token { .. }));
        }
    }

    #[tokio::test(start_paused = true)]
    async fn first_event_timeout_and_cancel_close_reasoning_without_late_tokens() {
        for cancel in [false, true] {
            let (manager, events, sink) = recording();
            let request = manager.begin("a".into(), "r".into(), sink).unwrap();
            request.reasoning("why");
            let pending = read_sse(&request, stream::pending());
            tokio::pin!(pending);
            assert!(futures_util::poll!(&mut pending).is_pending());
            if cancel {
                assert!(manager.cancel("a", "r").unwrap());
            } else {
                tokio::time::advance(std::time::Duration::from_secs(30)).await;
            }
            request.finish(pending.await);
            let events = events.lock().unwrap();
            assert_eq!(events.len(), 4);
            assert_eq!(
                events[2].data,
                EventData::Token {
                    token: "</think>".into()
                }
            );
            assert_eq!(
                matches!(events[3].data, EventData::Done { canceled: true }),
                cancel
            );
        }
    }

    #[tokio::test]
    async fn cancel_interrupts_pending_send_and_error_body_reads() {
        for phase in ["send", "error body"] {
            let (manager, events, sink) = recording();
            let request = manager.begin("a".into(), phase.into(), sink).unwrap();
            let waiting = cancellable(&request, std::future::pending::<Result<(), String>>());
            tokio::pin!(waiting);
            assert!(futures_util::poll!(&mut waiting).is_pending());
            manager.cancel("a", phase).unwrap();
            assert!(matches!(waiting.await, Err(Outcome::Canceled)));
            assert!(!request.finish(Outcome::Canceled));
            assert_eq!(events.lock().unwrap().len(), 1);
        }
    }

    #[tokio::test(start_paused = true)]
    async fn first_event_deadline_stops_after_receiving_an_sse_event() {
        let (manager, events, sink) = recording();
        let request = manager.begin("a".into(), "r".into(), sink).unwrap();
        let input = stream::iter([Ok(r#"{"choices":[{"delta":{"content":"hello"}}]}"#.into())])
            .chain(stream::pending());
        let waiting = read_sse(&request, input);
        tokio::pin!(waiting);
        assert!(futures_util::poll!(&mut waiting).is_pending());
        tokio::time::advance(std::time::Duration::from_secs(31)).await;
        assert!(futures_util::poll!(&mut waiting).is_pending());
        assert_eq!(events.lock().unwrap().len(), 1);
        manager.cancel("a", "r").unwrap();
        assert!(matches!(waiting.await, Outcome::Canceled));
    }

    #[tokio::test]
    async fn controlled_network_http_and_request_timeout_failures_are_terminal_errors() {
        for message in [
            "Network error: refused",
            "HTTP 401: denied",
            "Network error: operation timed out",
        ] {
            let (manager, events, sink) = recording();
            let request = manager.begin("a".into(), "r".into(), sink).unwrap();
            let result = cancellable(
                &request,
                std::future::ready(Err::<(), _>(message.to_string())),
            )
            .await;
            request.finish(result.err().unwrap());
            assert!(!request.finish(Outcome::Completed));
            assert_eq!(
                events.lock().unwrap()[0].data,
                EventData::Error {
                    error: message.into()
                }
            );
        }
    }
}

#[cfg(test)]
mod reasoning_tests {
    use super::*;

    fn request_parameters(
        is_deepseek: bool,
        enabled: bool,
        effort: Option<ReasoningEffort>,
    ) -> serde_json::Value {
        let (thinking, reasoning_effort) = thinking_parameters(is_deepseek, enabled, effort);
        serde_json::to_value(ChatCompletionRequest {
            model: "deepseek-flash".to_string(),
            messages: vec![],
            stream: true,
            thinking,
            reasoning_effort,
        })
        .unwrap()
    }

    #[test]
    fn serializes_all_official_effort_levels() {
        for (effort, expected) in [
            (ReasoningEffort::Low, "low"),
            (ReasoningEffort::High, "high"),
            (ReasoningEffort::Max, "max"),
        ] {
            let request = request_parameters(true, true, Some(effort));
            assert_eq!(request["thinking"]["type"], "enabled");
            assert_eq!(request["reasoning_effort"], expected);
        }
    }

    #[test]
    fn legacy_calls_default_to_high() {
        assert_eq!(
            request_parameters(true, true, None)["reasoning_effort"],
            "high"
        );
    }

    #[test]
    fn disabled_thinking_omits_effort() {
        let request = request_parameters(true, false, Some(ReasoningEffort::Max));
        assert_eq!(request["thinking"]["type"], "disabled");
        assert!(request.get("reasoning_effort").is_none());
    }

    #[test]
    fn other_providers_omit_deepseek_parameters() {
        let request = request_parameters(false, true, Some(ReasoningEffort::Max));
        assert!(request.get("thinking").is_none());
        assert!(request.get("reasoning_effort").is_none());
    }

    #[test]
    fn rejects_unknown_effort_values() {
        assert!(serde_json::from_str::<ReasoningEffort>("\"medium\"").is_err());
    }
}
