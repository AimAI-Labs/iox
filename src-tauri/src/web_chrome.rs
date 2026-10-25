use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

use crate::AppState;

pub const TITLEBAR_HEIGHT: f64 = 38.0;
const MENU_BUTTON_SIZE: f64 = 44.0;
const MENU_MARGIN: f64 = 12.0;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuLayout {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub expanded: bool,
}

fn content_layout(height: u32, scale: f64, headless: bool) -> (u32, u32) {
    let top = if headless {
        0
    } else {
        (TITLEBAR_HEIGHT * scale).round() as u32
    };
    (top, height.saturating_sub(top))
}

fn calculate_menu_layout(
    viewport: (f64, f64),
    previous: Option<MenuLayout>,
    expanded: Option<bool>,
    position: Option<(f64, f64)>,
    hub: bool,
) -> Result<MenuLayout, String> {
    if position.is_some_and(|(x, y)| !x.is_finite() || !y.is_finite()) {
        return Err("Invalid menu position".into());
    }
    let expanded = expanded.unwrap_or(previous.is_some_and(|layout| layout.expanded));
    let width = if expanded { 280.0 } else { MENU_BUTTON_SIZE };
    let height = if expanded {
        if hub {
            560.0
        } else {
            360.0
        }
    } else {
        MENU_BUTTON_SIZE
    };
    let width = f64::min(width, (viewport.0 - MENU_MARGIN * 2.0).max(1.0));
    let height = f64::min(height, (viewport.1 - MENU_MARGIN * 2.0).max(1.0));
    let (x, y) = position.unwrap_or_else(|| match previous {
        // Keep the right edge in place when opening/closing the menu.
        Some(old) => (old.x + old.width - width, old.y),
        None => (viewport.0 - width - MENU_MARGIN, MENU_MARGIN),
    });
    let min_x = MENU_MARGIN.min((viewport.0 - width).max(0.0));
    let min_y = MENU_MARGIN.min((viewport.1 - height).max(0.0));
    Ok(MenuLayout {
        x: x.clamp(min_x, (viewport.0 - width - MENU_MARGIN).max(min_x)),
        y: y.clamp(min_y, (viewport.1 - height - MENU_MARGIN).max(min_y)),
        width,
        height,
        expanded,
    })
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebChromeLayout {
    pub revision: u64,
    pub headless: bool,
    pub menu: MenuLayout,
}

pub struct WebChromeState {
    // Native projection of committed config. Resize callbacks must never reenter ConfigStore:
    // publishing config effects can synchronously trigger window events while its lock is held.
    headless: AtomicBool,
    windows: Mutex<HashMap<String, WebChromeLayout>>,
}

impl WebChromeState {
    pub fn new(headless: bool) -> Self {
        Self {
            headless: AtomicBool::new(headless),
            windows: Mutex::new(HashMap::new()),
        }
    }

    pub fn headless(&self) -> bool {
        self.headless.load(Ordering::Relaxed)
    }

    pub fn set_headless(&self, enabled: bool) {
        self.headless.store(enabled, Ordering::Relaxed);
    }
}

pub fn is_web_window(label: &str) -> bool {
    label == "web_hub" || label.starts_with("web_win_")
}

pub fn headless(app: &tauri::AppHandle) -> bool {
    app.state::<AppState>().web_chrome.headless()
}

fn caller_window(webview: &tauri::Webview) -> Result<tauri::Window, String> {
    let window = webview.window();
    if !is_web_window(window.label()) || webview.label() != format!("{}_bar", window.label()) {
        return Err("Only the owning local Web toolbar may control its menu".into());
    }
    Ok(window)
}

fn apply_layout(
    window: &tauri::Window,
    expanded: Option<bool>,
    position: Option<(f64, f64)>,
    relayout_content: bool,
) -> Result<WebChromeLayout, String> {
    let app = window.app_handle();
    let state = app.state::<AppState>();
    let headless = state.web_chrome.headless();
    // Creation may have started from a config snapshot before a concurrent commit.
    // Reconcile decorations from current native policy before measuring the client area.
    let decorated = crate::window_manager::is_native_chrome() && !headless;
    if window.is_decorated().map_err(|e| e.to_string())? != decorated {
        window
            .set_decorations(decorated)
            .map_err(|e| e.to_string())?;
    }
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let hub = window.label() == "web_hub";
    let (layout, relayout_content) = {
        let mut windows = state.web_chrome.windows.lock().map_err(|e| e.to_string())?;
        let previous = windows.get(window.label()).copied();
        let menu = calculate_menu_layout(
            (size.width as f64 / scale, size.height as f64 / scale),
            previous.map(|old| old.menu),
            if headless { expanded } else { Some(false) },
            position,
            hub,
        )?;
        let layout = WebChromeLayout {
            revision: previous.map_or(1, |old| old.revision + 1),
            headless,
            menu,
        };
        windows.insert(window.label().to_string(), layout);
        (
            layout,
            relayout_content || previous.is_none_or(|old| old.headless != headless),
        )
    };
    let active_label = if hub {
        state
            .web_hub_state
            .lock()
            .map_err(|e| e.to_string())?
            .active_tab_id
            .as_ref()
            .map(|id| {
                let id: String = id
                    .chars()
                    .map(|c| {
                        if c.is_alphanumeric() || c == '_' || c == '-' {
                            c
                        } else {
                            '_'
                        }
                    })
                    .collect();
                format!("web_hub_tab_{id}")
            })
    } else {
        Some(format!("{}_web", window.label()))
    };
    let (top, height) = content_layout(size.height, scale, headless);
    let radius = if window.is_maximized().unwrap_or(false)
        || (!headless && crate::window_manager::is_native_chrome())
    {
        None
    } else {
        Some((12.0 * scale).round() as i32)
    };
    // No config, menu or Hub lock is held while touching native views.
    if relayout_content {
        if let Ok(hwnd) = window.hwnd() {
            crate::window_manager::set_window_corner_preference(hwnd.0 as _, radius.is_some());
        }
    }
    let bar_label = format!("{}_bar", window.label());
    for view in window.webviews().into_iter().filter(|_| relayout_content) {
        if view.label() == bar_label {
            continue;
        }
        let visible = active_label.as_deref() == Some(view.label());
        view.set_bounds(tauri::Rect {
            position: tauri::PhysicalPosition::new(
                if visible { 0 } else { -20000 },
                if visible { top as i32 } else { -20000 },
            )
            .into(),
            size: tauri::PhysicalSize::new(size.width, height).into(),
        })
        .map_err(|e| e.to_string())?;
        crate::window_manager::set_web_content_round(&view, radius, headless);
    }
    if let Some(bar) = app.get_webview(&bar_label) {
        let bounds = if headless {
            tauri::Rect {
                position: tauri::LogicalPosition::new(layout.menu.x, layout.menu.y).into(),
                size: tauri::LogicalSize::new(layout.menu.width, layout.menu.height).into(),
            }
        } else {
            tauri::Rect {
                position: tauri::PhysicalPosition::new(0, 0).into(),
                size: tauri::PhysicalSize::new(size.width, top).into(),
            }
        };
        bar.set_bounds(bounds).map_err(|e| e.to_string())?;
        crate::window_manager::raise_web_toolbar(&bar);
        let _ = app.emit_to(
            tauri::EventTarget::webview(&bar_label),
            "web_chrome_layout_changed",
            layout,
        );
    }
    Ok(layout)
}

pub fn layout_window(window: &tauri::Window) {
    let window = window.clone();
    let dispatch = window.clone();
    let _ = dispatch.run_on_main_thread(move || {
        // Windows can report zero client bounds while minimized. Preserve the menu anchor.
        if window.is_minimized().unwrap_or(false) {
            return;
        }
        if let Err(error) = apply_layout(&window, None, None, true) {
            eprintln!("Web window layout failed: {error}");
        }
    });
}

pub fn layout_all(app: &tauri::AppHandle) {
    for (label, window) in app.windows() {
        if is_web_window(&label) {
            layout_window(&window);
        }
    }
}

async fn menu_layout(
    webview: tauri::Webview,
    expanded: Option<bool>,
    position: Option<(f64, f64)>,
    require_headless: bool,
) -> Result<WebChromeLayout, String> {
    let window = caller_window(&webview)?;
    let dispatch = window.clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    dispatch
        .run_on_main_thread(move || {
            let result = if require_headless && !headless(window.app_handle()) {
                Err("Web headless mode is disabled".into())
            } else {
                apply_layout(&window, expanded, position, false)
            };
            let _ = send.send(result);
        })
        .map_err(|e| e.to_string())?;
    receive.await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_web_chrome(webview: tauri::Webview) -> Result<WebChromeLayout, String> {
    menu_layout(webview, None, None, false).await
}

#[tauri::command]
pub async fn layout_web_menu(
    webview: tauri::Webview,
    expanded: Option<bool>,
    position: Option<(f64, f64)>,
) -> Result<WebChromeLayout, String> {
    menu_layout(webview, expanded, position, true).await
}

#[tauri::command]
pub async fn open_web_page_in_browser(webview: tauri::Webview) -> Result<(), String> {
    let window = caller_window(&webview)?;
    let app = window.app_handle();
    let label = if window.label() == "web_hub" {
        let state = app.state::<AppState>();
        let id = state
            .web_hub_state
            .lock()
            .map_err(|e| e.to_string())?
            .active_tab_id
            .clone()
            .ok_or("No active tab")?;
        let id: String = id
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '_' || c == '-' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        format!("web_hub_tab_{id}")
    } else {
        format!("{}_web", window.label())
    };
    let content = app.get_webview(&label).ok_or("Webview not found")?;
    let url = content.url().map_err(|e| e.to_string())?;
    if !matches!(url.scheme(), "https" | "http") {
        return Err("Only HTTP and HTTPS pages may be opened".into());
    }
    open::that_detached(url.as_str()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn headless_content_fills_client_area_at_every_dpi() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            assert_eq!(content_layout(801, scale, true), (0, 801));
            let (top, height) = content_layout(801, scale, false);
            assert_eq!(top, (38.0 * scale).round() as u32);
            assert_eq!(top + height, 801);
        }
        assert_eq!(content_layout(0, 1.5, true), (0, 0));
    }

    #[test]
    fn menu_starts_in_top_right_and_expands_without_leaving_window() {
        let collapsed = calculate_menu_layout((860.0, 640.0), None, None, None, false).unwrap();
        assert_eq!((collapsed.x, collapsed.y), (804.0, 12.0));
        let open = calculate_menu_layout((860.0, 640.0), Some(collapsed), Some(true), None, false)
            .unwrap();
        assert!(open.expanded);
        assert_eq!(open.x + open.width, collapsed.x + collapsed.width);
        assert_eq!(open.width, 280.0);
        let closed =
            calculate_menu_layout((860.0, 640.0), Some(open), Some(false), None, false).unwrap();
        assert_eq!(closed, collapsed);
    }

    #[test]
    fn dragging_and_resizing_keep_the_whole_menu_reachable() {
        let open = calculate_menu_layout(
            (860.0, 640.0),
            None,
            Some(true),
            Some((5000.0, -50.0)),
            true,
        )
        .unwrap();
        assert_eq!(open.y, MENU_MARGIN);
        assert_eq!(open.x + open.width, 848.0);
        let smaller = calculate_menu_layout((240.0, 220.0), Some(open), None, None, true).unwrap();
        assert_eq!((smaller.width, smaller.height), (216.0, 196.0));
        assert_eq!((smaller.x, smaller.y), (MENU_MARGIN, MENU_MARGIN));
        let tiny = calculate_menu_layout((0.0, 0.0), Some(smaller), None, None, true).unwrap();
        assert_eq!((tiny.width, tiny.height), (1.0, 1.0));
        assert_eq!((tiny.x, tiny.y), (0.0, 0.0));
    }

    #[test]
    fn menu_rejects_non_finite_drag_coordinates() {
        for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            assert!(
                calculate_menu_layout((860.0, 640.0), None, None, Some((value, 0.0)), false)
                    .is_err()
            );
            assert!(
                calculate_menu_layout((860.0, 640.0), None, None, Some((0.0, value)), false)
                    .is_err()
            );
        }
    }
}
