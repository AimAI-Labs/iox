pub mod scripts;
pub mod stream;
pub mod template;
pub mod web_action;

pub use scripts::{build_dom_injection_script, build_initialization_script, ZOOM_PERSISTENCE_SCRIPT};
pub use stream::execute_stream_request;
pub use template::{render_prompt_template, render_url_template};
pub use web_action::execute_web_action;

use std::collections::HashMap;
use std::sync::Arc;
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
        let mut tokens = self.cancel_tokens.lock().await;
        if let Some(token) = tokens.remove(action_id) {
            token.cancel();
        }
    }

    pub async fn register_token(&self, action_id: String, token: CancellationToken) {
        let mut tokens = self.cancel_tokens.lock().await;
        tokens.insert(action_id, token);
    }
}
