pub mod file_upload;
pub mod models;
pub mod requests;
pub mod scripts;
pub mod stream;
pub mod template;
pub mod vendors;
pub mod web_action;

pub use vendors::{get_vendor_adapter, VendorAdapter, VendorRegistry};

pub use models::fetch_provider_models;
pub use scripts::{
    build_dom_injection_script, build_initialization_script, ZOOM_PERSISTENCE_SCRIPT,
};
pub(crate) use stream::execute_stream_request;
pub use template::{render_prompt_template, render_url_template};
pub use web_action::{
    close_web_hub_tab, execute_web_action, reload_web_hub_active_tab, switch_web_hub_tab,
    WebHubState, WebHubTab,
};

pub use requests::AiManager;
