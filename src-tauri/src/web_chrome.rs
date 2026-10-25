use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

use crate::AppState;

pub const TITLEBAR_HEIGHT: f64 = 38.0;
const MENU_BUTTON_SIZE: f64 = 44.0;
const MENU_MARGIN: f64 = 12.0;
const MENU_MIN_OPEN_HEIGHT: f64 = 160.0;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuLayout {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub expanded: bool,
    pub wheel: bool,
    pub button_x: f64,
    pub button_y: f64,
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
    wheel: Option<bool>,
    position: Option<(f64, f64)>,
    hub: bool,
    reflow: bool,
) -> Result<MenuLayout, String> {
    if !viewport.0.is_finite() || !viewport.1.is_finite() {
        return Err("Invalid menu viewport".into());
    }
    if position.is_some_and(|(x, y)| !x.is_finite() || !y.is_finite()) {
        return Err("Invalid menu position".into());
    }
    let wheel =
        wheel.unwrap_or_else(|| expanded.is_none() && previous.is_some_and(|layout| layout.wheel));
    let expanded = !wheel && expanded.unwrap_or(previous.is_some_and(|layout| layout.expanded));
    // Button and hover modes share the same native canvas. Only its hit region changes.
    let width = 280.0;
    let height = if expanded {
        if hub {
            560.0
        } else {
            360.0
        }
    } else {
        280.0
    };
    let width = f64::min(width, (viewport.0 - MENU_MARGIN * 2.0).max(1.0));
    let mut height = f64::min(height, (viewport.1 - MENU_MARGIN * 2.0).max(1.0));
    let mut anchor = previous.map_or(
        (viewport.0 - MENU_BUTTON_SIZE - MENU_MARGIN, MENU_MARGIN),
        |old| (old.x + old.button_x, old.y + old.button_y),
    );
    if !expanded && !wheel {
        if let Some(button_position) = position {
            // Collapsed dragging still receives the button's coordinates, not canvas bounds.
            anchor = button_position;
        }
    }
    let mut upward = previous.is_some_and(|old| old.expanded && old.button_y > 0.0);
    if expanded {
        if let Some(old) = previous.filter(|old| old.expanded && !reflow) {
            // Keep an open panel's size stable while its header is dragged or queried.
            height = height.min(old.height);
        }
        if position.is_none() {
            let button_height = MENU_BUTTON_SIZE.min(height);
            let min_anchor_y = MENU_MARGIN.min((viewport.1 - button_height).max(0.0));
            anchor.1 = anchor.1.clamp(
                min_anchor_y,
                (viewport.1 - MENU_MARGIN - button_height).max(min_anchor_y),
            );
            let below = (viewport.1 - MENU_MARGIN - anchor.1).max(1.0);
            let above = (anchor.1 + button_height - MENU_MARGIN).max(1.0);
            let (available, opposite) = if upward {
                (above, below)
            } else {
                (below, above)
            };
            // Prefer opening below; reflow may switch sides to restore useful list space.
            if opposite > available
                && (available < MENU_MIN_OPEN_HEIGHT || (reflow && available < height))
            {
                upward = !upward;
            }
            height = height.min(if upward { above } else { below });
        }
    }
    let max_button_x = (width - MENU_BUTTON_SIZE).max(0.0);
    let max_button_y = (height - MENU_BUTTON_SIZE).max(0.0);
    if !expanded && position.is_none() {
        if let Some(old) = previous.filter(|old| {
            !old.expanded
                && old.width == width
                && old.height == height
                && old.x >= 0.0
                && old.y >= 0.0
                && old.x + width <= viewport.0.max(1.0)
                && old.y + height <= viewport.1.max(1.0)
        }) {
            return Ok(MenuLayout {
                expanded,
                wheel,
                ..old
            });
        }
    }
    let panel_position = position.filter(|_| expanded || wheel);
    let (x, y) = panel_position.unwrap_or_else(|| {
        if !expanded {
            (anchor.0 - max_button_x / 2.0, anchor.1 - max_button_y / 2.0)
        } else {
            // The header stays at the button, with scrollable content on the chosen side.
            (
                anchor.0 - max_button_x,
                anchor.1 - if upward { max_button_y } else { 0.0 },
            )
        }
    });
    let min_x = MENU_MARGIN.min((viewport.0 - width).max(0.0));
    let min_y = MENU_MARGIN.min((viewport.1 - height).max(0.0));
    let x = x.clamp(min_x, (viewport.0 - width - MENU_MARGIN).max(min_x));
    let y = y.clamp(min_y, (viewport.1 - height - MENU_MARGIN).max(min_y));
    let (button_x, button_y) = if !expanded {
        if panel_position.is_some() {
            // Drag positions describe the panel bounds, so its button moves with the panel.
            previous.filter(|old| !old.expanded).map_or(
                (max_button_x / 2.0, max_button_y / 2.0),
                |old| {
                    (
                        old.button_x.clamp(0.0, max_button_x),
                        old.button_y.clamp(0.0, max_button_y),
                    )
                },
            )
        } else {
            // Clamp the panel while retaining the trigger under the pointer whenever it fits.
            (
                (anchor.0 - x).clamp(0.0, max_button_x),
                (anchor.1 - y).clamp(0.0, max_button_y),
            )
        }
    } else {
        (max_button_x, if upward { max_button_y } else { 0.0 })
    };
    Ok(MenuLayout {
        x,
        y,
        width,
        height,
        expanded,
        wheel,
        button_x,
        button_y,
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
    wheel: Option<bool>,
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
    let (layout, relayout_content, toolbar_geometry_changed, toolbar_region_changed) = {
        let mut windows = state.web_chrome.windows.lock().map_err(|e| e.to_string())?;
        let previous = windows.get(window.label()).copied();
        let menu = calculate_menu_layout(
            (size.width as f64 / scale, size.height as f64 / scale),
            previous.map(|old| old.menu),
            if headless { expanded } else { Some(false) },
            if headless { wheel } else { Some(false) },
            position,
            hub,
            relayout_content,
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
            relayout_content
                || previous.is_none_or(|old| {
                    old.headless != headless
                        || (old.menu.x, old.menu.y, old.menu.width, old.menu.height)
                            != (menu.x, menu.y, menu.width, menu.height)
                }),
            relayout_content
                || previous.is_none_or(|old| old.headless != headless || old.menu != menu),
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
        if toolbar_geometry_changed {
            bar.set_bounds(bounds).map_err(|e| e.to_string())?;
            crate::window_manager::raise_web_toolbar(&bar);
        }
        if toolbar_region_changed {
            let clip = (headless && !layout.menu.expanded && !layout.menu.wheel).then(|| {
                let menu = layout.menu;
                (
                    (menu.button_x * scale).round() as i32,
                    (menu.button_y * scale).round() as i32,
                    (MENU_BUTTON_SIZE.min(menu.width) * scale).round() as i32,
                    (MENU_BUTTON_SIZE.min(menu.height) * scale).round() as i32,
                )
            });
            crate::window_manager::set_web_menu_region(&bar, clip);
        }
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
        if let Err(error) = apply_layout(&window, None, None, None, true) {
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
    wheel: Option<bool>,
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
                apply_layout(&window, expanded, wheel, position, false)
            };
            let _ = send.send(result);
        })
        .map_err(|e| e.to_string())?;
    receive.await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_web_chrome(webview: tauri::Webview) -> Result<WebChromeLayout, String> {
    menu_layout(webview, None, None, None, false).await
}

#[tauri::command]
pub async fn layout_web_menu(
    webview: tauri::Webview,
    expanded: Option<bool>,
    wheel: Option<bool>,
    position: Option<(f64, f64)>,
) -> Result<WebChromeLayout, String> {
    menu_layout(webview, expanded, wheel, position, true).await
}

#[tauri::command]
pub fn set_web_menu_action_pinned(
    webview: tauri::Webview,
    action_id: String,
    pinned: bool,
) -> Result<Vec<String>, String> {
    let window = caller_window(&webview)?;
    window
        .app_handle()
        .state::<AppState>()
        .config
        .set_web_menu_action_pinned(&action_id, pinned)
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
        let collapsed =
            calculate_menu_layout((860.0, 640.0), None, None, None, None, false, false).unwrap();
        assert_eq!(trigger(collapsed), (804.0, 12.0));
        let open = calculate_menu_layout(
            (860.0, 640.0),
            Some(collapsed),
            Some(true),
            None,
            None,
            false,
            false,
        )
        .unwrap();
        assert!(open.expanded);
        assert_eq!(open.x + open.width, collapsed.x + collapsed.width);
        assert_eq!(open.width, 280.0);
        let closed = calculate_menu_layout(
            (860.0, 640.0),
            Some(open),
            Some(false),
            None,
            None,
            false,
            false,
        )
        .unwrap();
        assert_eq!(closed, collapsed);
    }

    #[test]
    fn menu_serialization_exposes_presentation_and_button_offset() {
        let collapsed =
            calculate_menu_layout((860.0, 640.0), None, None, None, None, false, false).unwrap();
        let value = serde_json::to_value(collapsed).unwrap();
        assert_eq!(value["wheel"], false);
        assert_eq!(value["buttonX"], 236.0);
        assert_eq!(value["buttonY"], 0.0);
    }

    fn trigger(layout: MenuLayout) -> (f64, f64) {
        (layout.x + layout.button_x, layout.y + layout.button_y)
    }

    fn assert_button_inside(layout: MenuLayout) {
        assert!(layout.button_x >= 0.0 && layout.button_y >= 0.0);
        assert!(layout.button_x + MENU_BUTTON_SIZE.min(layout.width) <= layout.width);
        assert!(layout.button_y + MENU_BUTTON_SIZE.min(layout.height) <= layout.height);
    }

    #[test]
    fn full_menu_shrinks_below_its_anchor_in_short_windows() {
        for hub in [false, true] {
            let viewport = (860.0, 400.0);
            let button =
                calculate_menu_layout(viewport, None, None, None, Some((400.0, 180.0)), hub, false)
                    .unwrap();
            let open =
                calculate_menu_layout(viewport, Some(button), Some(true), None, None, hub, false)
                    .unwrap();
            assert_eq!(trigger(open), trigger(button));
            assert_eq!(open.y, 180.0);
            assert_eq!(open.height, 208.0);
            assert_eq!(open.button_y, 0.0);
            let closed =
                calculate_menu_layout(viewport, Some(open), Some(false), None, None, hub, false)
                    .unwrap();
            assert_eq!(trigger(closed), trigger(button));
        }
    }

    #[test]
    fn full_menu_opens_above_a_low_anchor_without_moving_its_header() {
        for hub in [false, true] {
            let viewport = (860.0, 400.0);
            let button =
                calculate_menu_layout(viewport, None, None, None, Some((400.0, 332.0)), hub, false)
                    .unwrap();
            let open =
                calculate_menu_layout(viewport, Some(button), Some(true), None, None, hub, false)
                    .unwrap();
            assert_eq!(trigger(open), trigger(button));
            assert!(open.button_y > 0.0);
            assert!(open.y >= MENU_MARGIN);
            assert!(open.y + open.height <= viewport.1 - MENU_MARGIN);
            assert_button_inside(open);
            let retained =
                calculate_menu_layout(viewport, Some(open), None, None, None, hub, false).unwrap();
            assert_eq!(retained, open);
            let closed =
                calculate_menu_layout(viewport, Some(open), Some(false), None, None, hub, false)
                    .unwrap();
            assert_eq!(trigger(closed), trigger(button));
        }
    }

    #[test]
    fn full_menu_dragging_keeps_its_size_and_opening_direction() {
        let viewport = (860.0, 400.0);
        for y in [180.0, 332.0] {
            let button =
                calculate_menu_layout(viewport, None, None, None, Some((400.0, y)), false, false)
                    .unwrap();
            let open =
                calculate_menu_layout(viewport, Some(button), Some(true), None, None, false, false)
                    .unwrap();
            let moved = calculate_menu_layout(
                viewport,
                Some(open),
                None,
                None,
                Some((200.0, 20.0)),
                false,
                false,
            )
            .unwrap();
            assert_eq!((moved.x, moved.y), (200.0, 20.0));
            assert_eq!(moved.height, open.height);
            assert_eq!(moved.button_y, open.button_y);
            let retained =
                calculate_menu_layout(viewport, Some(moved), None, None, None, false, false)
                    .unwrap();
            assert_eq!(retained, moved);
        }
    }

    #[test]
    fn resizing_an_open_menu_preserves_a_visible_anchor_and_scroll_room() {
        let button = calculate_menu_layout(
            (860.0, 400.0),
            None,
            None,
            None,
            Some((400.0, 180.0)),
            false,
            false,
        )
        .unwrap();
        let open = calculate_menu_layout(
            (860.0, 400.0),
            Some(button),
            Some(true),
            None,
            None,
            false,
            false,
        )
        .unwrap();
        let resized =
            calculate_menu_layout((860.0, 300.0), Some(open), None, None, None, false, true)
                .unwrap();
        assert_eq!(trigger(resized), trigger(button));
        assert!(resized.button_y > 0.0);
        assert_eq!(resized.height, 212.0);
        assert!(resized.y >= MENU_MARGIN);
        assert!(resized.y + resized.height <= 288.0);
    }

    #[test]
    fn growing_the_window_restores_the_available_menu_height() {
        let button = calculate_menu_layout(
            (860.0, 400.0),
            None,
            None,
            None,
            Some((400.0, 220.0)),
            false,
            false,
        )
        .unwrap();
        let open = calculate_menu_layout(
            (860.0, 400.0),
            Some(button),
            Some(true),
            None,
            None,
            false,
            false,
        )
        .unwrap();
        assert_eq!(open.height, 168.0);
        let grown =
            calculate_menu_layout((860.0, 640.0), Some(open), None, None, None, false, true)
                .unwrap();
        assert_eq!(trigger(grown), trigger(open));
        assert_eq!(grown.height, 360.0);
    }

    #[test]
    fn a_tiny_window_does_not_lock_the_menu_to_a_clipped_height() {
        let open =
            calculate_menu_layout((860.0, 640.0), None, Some(true), None, None, false, false)
                .unwrap();
        let tiny =
            calculate_menu_layout((40.0, 30.0), Some(open), None, None, None, false, true).unwrap();
        assert!(tiny.height < MENU_BUTTON_SIZE);
        let restored =
            calculate_menu_layout((860.0, 640.0), Some(tiny), None, None, None, false, true)
                .unwrap();
        assert_eq!(restored.height, 360.0);
        assert_button_inside(restored);
    }

    #[test]
    fn wheel_keeps_trigger_in_place_at_all_corners_and_collapses_back() {
        for hub in [false, true] {
            for position in [
                (12.0, 12.0),
                (804.0, 12.0),
                (12.0, 584.0),
                (804.0, 584.0),
                (400.0, 300.0),
            ] {
                let button = calculate_menu_layout(
                    (860.0, 640.0),
                    None,
                    None,
                    None,
                    Some(position),
                    hub,
                    false,
                )
                .unwrap();
                let wheel = calculate_menu_layout(
                    (860.0, 640.0),
                    Some(button),
                    None,
                    Some(true),
                    None,
                    hub,
                    false,
                )
                .unwrap();
                assert!(wheel.wheel && !wheel.expanded);
                assert_eq!((wheel.width, wheel.height), (280.0, 280.0));
                assert_eq!(trigger(wheel), trigger(button));
                assert_eq!(
                    (
                        wheel.x,
                        wheel.y,
                        wheel.width,
                        wheel.height,
                        wheel.button_x,
                        wheel.button_y
                    ),
                    (
                        button.x,
                        button.y,
                        button.width,
                        button.height,
                        button.button_x,
                        button.button_y
                    ),
                    "Hover must never move or resize the WebView carrying the button"
                );
                assert!(wheel.x >= 12.0 && wheel.y >= 12.0);
                assert!(wheel.x + wheel.width <= 848.0 && wheel.y + wheel.height <= 628.0);
                assert_button_inside(wheel);
                let closed = calculate_menu_layout(
                    (860.0, 640.0),
                    Some(wheel),
                    None,
                    Some(false),
                    None,
                    hub,
                    false,
                )
                .unwrap();
                assert_eq!(closed, button);
            }
        }
    }

    #[test]
    fn all_presentation_transitions_keep_modes_exclusive_and_preserve_trigger() {
        let button = calculate_menu_layout(
            (860.0, 640.0),
            None,
            None,
            None,
            Some((500.0, 100.0)),
            false,
            false,
        )
        .unwrap();
        let full = calculate_menu_layout(
            (860.0, 640.0),
            Some(button),
            Some(true),
            None,
            None,
            false,
            false,
        )
        .unwrap();
        let wheel = calculate_menu_layout(
            (860.0, 640.0),
            Some(button),
            None,
            Some(true),
            None,
            false,
            false,
        )
        .unwrap();
        for previous in [button, full, wheel] {
            let retained = calculate_menu_layout(
                (860.0, 640.0),
                Some(previous),
                None,
                None,
                None,
                false,
                false,
            )
            .unwrap();
            assert_eq!(retained, previous);
            for (expanded, wheel_flag, expected) in [
                (Some(true), None, full),
                (Some(false), None, button),
                (None, Some(true), wheel),
                (Some(true), Some(true), wheel),
                (Some(false), Some(true), wheel),
            ] {
                let layout = calculate_menu_layout(
                    (860.0, 640.0),
                    Some(previous),
                    expanded,
                    wheel_flag,
                    None,
                    false,
                    false,
                )
                .unwrap();
                assert_eq!(layout, expected);
                assert_eq!(trigger(layout), trigger(button));
                assert!(!(layout.expanded && layout.wheel));
            }
        }
        let no_headless = calculate_menu_layout(
            (860.0, 640.0),
            Some(wheel),
            Some(false),
            Some(false),
            None,
            false,
            false,
        )
        .unwrap();
        assert_eq!(no_headless, button);
    }

    #[test]
    fn wheel_drag_positions_are_current_bounds_and_resize_clamps_button_inside() {
        let button =
            calculate_menu_layout((860.0, 640.0), None, None, None, None, false, false).unwrap();
        let wheel = calculate_menu_layout(
            (860.0, 640.0),
            Some(button),
            None,
            Some(true),
            None,
            false,
            false,
        )
        .unwrap();
        let moved = calculate_menu_layout(
            (860.0, 640.0),
            Some(wheel),
            None,
            None,
            Some((100.0, 140.0)),
            false,
            false,
        )
        .unwrap();
        assert_eq!((moved.x, moved.y), (100.0, 140.0));
        assert_eq!(
            (moved.button_x, moved.button_y),
            (wheel.button_x, wheel.button_y)
        );
        let closed = calculate_menu_layout(
            (860.0, 640.0),
            Some(moved),
            Some(false),
            None,
            None,
            false,
            false,
        )
        .unwrap();
        assert_eq!(trigger(closed), trigger(moved));
        assert_eq!((closed.x, closed.y), (moved.x, moved.y));
        for viewport in [(640.0, 480.0), (240.0, 220.0), (40.0, 30.0), (0.0, 0.0)] {
            let resized =
                calculate_menu_layout(viewport, Some(wheel), None, None, None, false, false)
                    .unwrap();
            assert!(resized.wheel);
            assert_button_inside(resized);
            assert!(resized.x >= 0.0 && resized.y >= 0.0);
            assert!(resized.width <= (viewport.0 - 24.0).max(1.0));
            assert!(resized.height <= (viewport.1 - 24.0).max(1.0));
        }
    }

    #[test]
    fn wheel_geometry_uses_logical_client_coordinates_at_every_dpi() {
        let mut baseline = None;
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let viewport = (860.0 * scale / scale, 640.0 * scale / scale);
            let button =
                calculate_menu_layout(viewport, None, None, None, None, false, false).unwrap();
            let wheel =
                calculate_menu_layout(viewport, Some(button), None, Some(true), None, false, false)
                    .unwrap();
            assert_eq!(trigger(wheel), (804.0, 12.0));
            if let Some(expected) = baseline {
                assert_eq!(wheel, expected);
            }
            baseline = Some(wheel);
        }
    }

    #[test]
    fn dragging_and_resizing_keep_the_whole_menu_reachable() {
        let open = calculate_menu_layout(
            (860.0, 640.0),
            None,
            Some(true),
            None,
            Some((5000.0, -50.0)),
            true,
            false,
        )
        .unwrap();
        assert_eq!(open.y, MENU_MARGIN);
        assert_eq!(open.x + open.width, 848.0);
        let smaller =
            calculate_menu_layout((240.0, 220.0), Some(open), None, None, None, true, false)
                .unwrap();
        assert_eq!((smaller.width, smaller.height), (216.0, 196.0));
        assert_eq!((smaller.x, smaller.y), (MENU_MARGIN, MENU_MARGIN));
        let tiny = calculate_menu_layout((0.0, 0.0), Some(smaller), None, None, None, true, false)
            .unwrap();
        assert_eq!((tiny.width, tiny.height), (1.0, 1.0));
        assert_eq!((tiny.x, tiny.y), (0.0, 0.0));
    }

    #[test]
    fn menu_rejects_non_finite_drag_coordinates() {
        for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            assert!(calculate_menu_layout(
                (860.0, 640.0),
                None,
                None,
                None,
                Some((value, 0.0)),
                false,
                false
            )
            .is_err());
            assert!(calculate_menu_layout(
                (860.0, 640.0),
                None,
                None,
                None,
                Some((0.0, value)),
                false,
                false
            )
            .is_err());
        }
    }
}
