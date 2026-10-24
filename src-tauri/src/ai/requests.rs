use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio_util::sync::CancellationToken;

/// Synchronous submission only: sinks must not re-enter the manager or perform network I/O.
pub(crate) type EventSink = Arc<dyn Fn(StreamEvent) + Send + Sync>;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub(crate) enum EventData {
    Token { token: String },
    Done { canceled: bool },
    Error { error: String },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StreamEvent {
    pub action_id: String,
    pub request_id: String,
    #[serde(flatten)]
    pub data: EventData,
}

impl StreamEvent {
    pub fn name(&self) -> &'static str {
        match self.data {
            EventData::Token { .. } => "action-stream-token",
            EventData::Done { .. } => "action-stream-done",
            EventData::Error { .. } => "action-stream-error",
        }
    }
}

pub(crate) enum Outcome {
    Completed,
    Canceled,
    Failed(String),
}

struct ActiveRequest {
    request_id: String,
    identity: Arc<()>,
    cancellation: CancellationToken,
    thinking: bool,
    sink: EventSink,
}

impl ActiveRequest {
    fn emit(&self, action_id: &str, data: EventData) {
        (self.sink)(StreamEvent {
            action_id: action_id.into(),
            request_id: self.request_id.clone(),
            data,
        });
    }

    fn token(&self, action_id: &str, token: &str) {
        self.emit(
            action_id,
            EventData::Token {
                token: token.into(),
            },
        );
    }

    fn close_thinking(&mut self, action_id: &str) {
        if self.thinking {
            self.thinking = false;
            self.token(action_id, "</think>");
        }
    }

    fn finish(mut self, action_id: &str, outcome: Outcome) {
        self.close_thinking(action_id);
        let data = match outcome {
            Outcome::Completed => EventData::Done { canceled: false },
            Outcome::Canceled => {
                self.cancellation.cancel();
                EventData::Done { canceled: true }
            }
            Outcome::Failed(error) => EventData::Error { error },
        };
        self.emit(action_id, data);
    }
}

/// Owns current executions and serializes eligibility, event submission and termination.
/// The lock is held only for these short synchronous operations, never HTTP awaits.
#[derive(Clone, Default)]
pub struct AiManager {
    active: Arc<Mutex<HashMap<String, ActiveRequest>>>,
}

impl AiManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub(crate) fn begin(
        &self,
        action_id: String,
        request_id: String,
        sink: EventSink,
    ) -> Result<RequestHandle, String> {
        let mut active = self
            .active
            .lock()
            .map_err(|_| "AI request manager unavailable".to_string())?;
        if let Some(old) = active.remove(&action_id) {
            old.finish(&action_id, Outcome::Canceled);
        }
        let identity = Arc::new(());
        let cancellation = CancellationToken::new();
        active.insert(
            action_id.clone(),
            ActiveRequest {
                request_id,
                identity: identity.clone(),
                cancellation: cancellation.clone(),
                thinking: false,
                sink,
            },
        );
        Ok(RequestHandle {
            manager: self.clone(),
            action_id,
            identity,
            cancellation,
        })
    }

    pub fn cancel(&self, action_id: &str, request_id: &str) -> Result<bool, String> {
        let mut active = self
            .active
            .lock()
            .map_err(|_| "AI request manager unavailable".to_string())?;
        if !active
            .get(action_id)
            .is_some_and(|request| request.request_id == request_id)
        {
            return Ok(false);
        }
        active
            .remove(action_id)
            .unwrap()
            .finish(action_id, Outcome::Canceled);
        Ok(true)
    }
}

#[derive(Clone)]
pub(crate) struct RequestHandle {
    manager: AiManager,
    action_id: String,
    // Internal identity also prevents a reused external requestId from reviving old handles.
    identity: Arc<()>,
    cancellation: CancellationToken,
}

impl RequestHandle {
    pub fn cancellation(&self) -> &CancellationToken {
        &self.cancellation
    }

    fn update(&self, operation: impl FnOnce(&mut ActiveRequest)) -> bool {
        let Ok(mut active) = self.manager.active.lock() else {
            eprintln!("AI request manager unavailable while publishing");
            return false;
        };
        let Some(request) = active
            .get_mut(&self.action_id)
            .filter(|r| Arc::ptr_eq(&r.identity, &self.identity))
        else {
            return false;
        };
        operation(request);
        true
    }

    pub fn reasoning(&self, delta: &str) -> bool {
        self.update(|request| {
            if delta.is_empty() {
                return;
            }
            if !request.thinking {
                request.thinking = true;
                request.token(&self.action_id, "<think>");
            }
            request.token(&self.action_id, delta);
        })
    }

    pub fn content(&self, delta: &str) -> bool {
        self.update(|request| {
            if delta.is_empty() {
                return;
            }
            request.close_thinking(&self.action_id);
            request.token(&self.action_id, delta);
        })
    }

    pub fn finish(&self, outcome: Outcome) -> bool {
        let Ok(mut active) = self.manager.active.lock() else {
            eprintln!("AI request manager unavailable while finishing");
            return false;
        };
        if !active
            .get(&self.action_id)
            .is_some_and(|r| Arc::ptr_eq(&r.identity, &self.identity))
        {
            return false;
        }
        active
            .remove(&self.action_id)
            .unwrap()
            .finish(&self.action_id, outcome);
        true
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub(crate) fn recording() -> (AiManager, Arc<Mutex<Vec<StreamEvent>>>, EventSink) {
        let events = Arc::new(Mutex::new(Vec::new()));
        let output = events.clone();
        (
            AiManager::new(),
            events,
            Arc::new(move |event| output.lock().unwrap().push(event)),
        )
    }

    #[test]
    fn replacement_cancels_previous_execution() {
        let (manager, events, sink) = recording();
        let old = manager
            .begin("a".into(), "old".into(), sink.clone())
            .unwrap();
        old.reasoning("thought");
        let new = manager.begin("a".into(), "new".into(), sink).unwrap();
        assert!(old.cancellation().is_cancelled());
        assert!(!old.content("late"));
        assert!(!old.finish(Outcome::Failed("late".into())));
        assert!(!manager.cancel("a", "old").unwrap());
        assert!(new.content("new answer"));
        assert!(new.finish(Outcome::Completed));
        let events = events.lock().unwrap();
        assert_eq!(events.iter().filter(|e| e.request_id == "old").count(), 4);
        assert_eq!(
            events[2].data,
            EventData::Token {
                token: "</think>".into()
            }
        );
        assert_eq!(events[3].data, EventData::Done { canceled: true });
        assert_eq!(events[4].request_id, "new");
    }

    #[test]
    fn precise_cancel_before_and_after_replacement_and_independent_actions() {
        let (manager, events, sink) = recording();
        assert!(!manager.cancel("a", "first").unwrap());
        let first = manager
            .begin("a".into(), "first".into(), sink.clone())
            .unwrap();
        let other = manager
            .begin("b".into(), "other".into(), sink.clone())
            .unwrap();
        assert!(manager.cancel("a", "first").unwrap());
        assert!(!manager.cancel("a", "first").unwrap());
        let next = manager.begin("a".into(), "next".into(), sink).unwrap();
        assert!(!manager.cancel("a", "first").unwrap());
        assert!(!first.finish(Outcome::Completed));
        assert!(next.content("next"));
        assert!(other.content("other"));
        assert!(next.finish(Outcome::Completed));
        assert!(other.finish(Outcome::Completed));
        assert_eq!(
            events
                .lock()
                .unwrap()
                .iter()
                .filter(|e| matches!(e.data, EventData::Done { .. }))
                .count(),
            3
        );
    }

    #[test]
    fn every_terminal_path_closes_thinking_once_and_blocks_late_output() {
        for outcome in [
            Outcome::Completed,
            Outcome::Canceled,
            Outcome::Failed("network".into()),
        ] {
            let (manager, events, sink) = recording();
            let request = manager.begin("a".into(), "r".into(), sink).unwrap();
            assert!(request.reasoning("why"));
            assert!(request.finish(outcome));
            assert!(!request.finish(Outcome::Completed));
            assert!(!request.content("late"));
            assert!(!request.reasoning("late"));
            let events = events.lock().unwrap();
            assert_eq!(events.len(), 4);
            assert_eq!(
                events[2].data,
                EventData::Token {
                    token: "</think>".into()
                }
            );
            assert!(!matches!(events[3].data, EventData::Token { .. }));
            assert!(events
                .iter()
                .all(|e| e.action_id == "a" && e.request_id == "r"));
        }
    }

    #[test]
    fn content_closes_thinking_and_reused_external_ids_cannot_revive_old_handle() {
        let (manager, events, sink) = recording();
        let old = manager.begin("a".into(), "r".into(), sink.clone()).unwrap();
        old.reasoning("why");
        old.content("answer");
        old.finish(Outcome::Completed);
        let current = manager.begin("a".into(), "r".into(), sink).unwrap();
        assert!(!old.content("late"));
        assert!(!old.finish(Outcome::Completed));
        assert!(current.content("current"));
        let events = events.lock().unwrap();
        assert_eq!(
            events
                .iter()
                .filter(|e| e.data
                    == EventData::Token {
                        token: "</think>".into()
                    })
                .count(),
            1
        );
        let payload = serde_json::to_value(&events[0]).unwrap();
        assert_eq!(payload["actionId"], "a");
        assert_eq!(payload["requestId"], "r");
    }

    #[test]
    fn concurrent_token_submission_and_cancel_have_one_ordered_terminal_event() {
        use std::sync::mpsc;
        let manager = AiManager::new();
        let events = Arc::new(Mutex::new(Vec::new()));
        let output = events.clone();
        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        let release_rx = Mutex::new(release_rx);
        let request = manager
            .begin(
                "a".into(),
                "r".into(),
                Arc::new(move |event| {
                    if matches!(event.data, EventData::Token { .. }) {
                        entered_tx.send(()).unwrap();
                        release_rx.lock().unwrap().recv().unwrap();
                    }
                    output.lock().unwrap().push(event);
                }),
            )
            .unwrap();
        let producer = request.clone();
        let publishing = std::thread::spawn(move || producer.content("first"));
        entered_rx.recv().unwrap();
        let canceling = std::thread::spawn(move || manager.cancel("a", "r").unwrap());
        release_tx.send(()).unwrap();
        assert!(publishing.join().unwrap());
        assert!(canceling.join().unwrap());
        assert!(!request.content("late"));
        let events = events.lock().unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(
            events[0].data,
            EventData::Token {
                token: "first".into()
            }
        );
        assert_eq!(events[1].data, EventData::Done { canceled: true });
    }
}
