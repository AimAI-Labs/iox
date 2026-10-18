//! Read actual Explorer/desktop selection through Shell COM, without clipboard access.
use crate::file_drag::{DragDwell, FileDragSession, FileMenuLayout};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use windows::core::Interface;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, IServiceProvider,
    CLSCTX_INPROC_SERVER, CLSCTX_LOCAL_SERVER, COINIT_APARTMENTTHREADED,
};
use windows::Win32::System::Variant::VARIANT;
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, UIA_DataItemControlTypeId, UIA_ListItemControlTypeId,
};
use windows::Win32::UI::Shell::{
    IFolderView2, IShellBrowser, IShellWindows, SID_STopLevelBrowser, ShellWindows,
    SIGDN_FILESYSPATH, SWC_DESKTOP, SWFO_NEEDDISPATCH,
};
use windows_sys::Win32::Foundation::{HWND, POINT};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
use windows_sys::Win32::UI::WindowsAndMessaging::*;

static GENERATION: AtomicU64 = AtomicU64::new(0);
static MOUSE_DOWN: Mutex<Option<ShellTarget>> = Mutex::new(None);
static DRAG_SESSION: Mutex<Option<FileDragSession>> = Mutex::new(None);

#[derive(Clone, Copy, PartialEq)]
struct ShellTarget {
    view: usize,
    foreground: usize,
}

fn filter_files(paths: Vec<String>) -> Vec<String> {
    let mut files = Vec::new();
    for path in paths {
        if Path::new(&path).is_absolute()
            && Path::new(&path).is_file()
            && !files
                .iter()
                .any(|existing: &String| existing.eq_ignore_ascii_case(&path))
        {
            files.push(path);
        }
    }
    files
}

/// Require a real native drop from this gesture before any file bytes can be read.
pub fn claim_dropped_files(drag_id: u64, files: &[String]) -> Result<(), String> {
    DRAG_SESSION
        .lock()
        .map_err(|_| "文件拖放不可用")?
        .as_mut()
        .ok_or("文件拖放已失效，请重新拖入文件")?
        .claim(drag_id, files)
}

pub fn allow_retry(drag_id: u64) {
    if let Ok(mut session) = DRAG_SESSION.lock() {
        if let Some(session) = session.as_mut() {
            session.allow_retry(drag_id);
        }
    }
}

pub fn cancel_pending() {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    if let Ok(mut session) = DRAG_SESSION.lock() {
        *session = None;
    }
}

fn dismiss_menu(app: &AppHandle) {
    let id = DRAG_SESSION
        .lock()
        .ok()
        .and_then(|session| session.as_ref().map(|s| s.id));
    cancel_pending();
    if let Some(drag_id) = id {
        let _ = app.emit_to("overlay", "file-drag-cancelled", drag_id);
    }
}

fn enabled(app: &AppHandle) -> bool {
    app.try_state::<crate::AppState>().is_some_and(|state| {
        state.config.try_lock().is_ok_and(|config| {
            config.general.auto_popup_on_file_selection
                && config.actions.iter().any(|action| action.enabled && action.action_type == "web")
                && crate::selection::is_modifier_satisfied(&config.general.trigger_modifier)
                && !config
                    .blacklist
                    .iter()
                    .any(|entry| entry.eq_ignore_ascii_case("explorer.exe"))
        })
    })
}

fn pointer() -> Option<((i32, i32), bool)> {
    let mut point = POINT { x: 0, y: 0 };
    // SAFETY: point is writable stack storage; the button query borrows no handles.
    unsafe {
        if GetCursorPos(&mut point) == 0 {
            return None;
        }
        Some(((point.x, point.y), GetAsyncKeyState(VK_LBUTTON as i32) < 0))
    }
}

/// Cheap HWND ancestry check on the hook thread. No COM calls on the hook thread.
fn target_at(point: (i32, i32)) -> Option<ShellTarget> {
    // SAFETY: Win32 validates borrowed HWNDs; only class names and ancestry are queried.
    unsafe {
        let mut hwnd = WindowFromPoint(POINT {
            x: point.0,
            y: point.1,
        });
        let mut content = false;
        while !hwnd.is_null() {
            let mut name = [0u16; 128];
            let len = GetClassNameW(hwnd, name.as_mut_ptr(), name.len() as i32);
            let class = String::from_utf16_lossy(&name[..len.max(0) as usize]);
            if matches!(
                class.as_str(),
                "SysHeader32" | "ScrollBar" | "Edit" | "RichEditD2DPT" | "RICHEDIT50W"
            ) {
                return None;
            }
            content |= class == "DirectUIHWND" || class == "SysListView32";
            if class == "SHELLDLL_DefView" {
                let root = GetAncestor(hwnd, GA_ROOT);
                if content {
                    return Some(ShellTarget {
                        view: hwnd as usize,
                        foreground: root as usize,
                    });
                }
                return None;
            }
            hwnd = GetParent(hwnd);
        }
        None
    }
}

pub fn mouse_down(app: &AppHandle, point: (i32, i32), inside_overlay: bool) {
    if inside_overlay {
        return;
    }
    dismiss_menu(app);
    let target = if enabled(app) { target_at(point) } else { None };
    if let Ok(mut down) = MOUSE_DOWN.lock() {
        *down = target;
    }
    let Some(target) = target else {
        return;
    };
    let generation = GENERATION.load(Ordering::SeqCst);
    let app = app.clone();
    std::thread::spawn(move || {
        // Let Explorer update its selection. COM/UIA must never run inside WH_MOUSE_LL.
        std::thread::sleep(Duration::from_millis(50));
        if !is_current(generation, target)
            || !pointer().is_some_and(|(_, held)| held)
            || pinned_card(&app)
        {
            return;
        }
        let Some(files) = shell_files(target, point, false) else {
            return;
        };
        if files.is_empty() {
            return;
        }
        // SAFETY: these system metrics are read-only and require no borrowed resources.
        let threshold = unsafe {
            (
                GetSystemMetrics(SM_CXDRAG).max(1),
                GetSystemMetrics(SM_CYDRAG).max(1),
            )
        };
        let delay_ms = app.state::<crate::AppState>().config.lock()
            .map(|config| config.general.file_drag_hover_delay_ms).unwrap_or(1000);
        let mut dwell = DragDwell::new(point, threshold, delay_ms);
        let started = Instant::now();
        loop {
            if !is_current(generation, target) {
                return;
            }
            let Some((position, held)) = pointer() else {
                return;
            };
            if !held {
                return;
            }
            if dwell.update(position, started.elapsed().as_millis() as u64, held) {
                let main_app = app.clone();
                let _ = app.run_on_main_thread(move || {
                    if !is_current(generation, target)
                        || !enabled(&main_app)
                        || pinned_card(&main_app)
                        || !pointer().is_some_and(|(_, held)| held)
                    {
                        return;
                    }
                    if let Ok(mut session) = DRAG_SESSION.lock() {
                        *session = Some(FileDragSession::new(generation, files.clone()));
                    } else {
                        return;
                    }
                    crate::selection::cancel_pending_hide();
                    crate::overlay_state::set_overlay_bubble_mode(true);
                    let count = main_app.state::<crate::AppState>().config.lock()
                        .map(|config| config.actions.iter().filter(|a| a.enabled && a.action_type == "web").count())
                        .unwrap_or(0);
                    let layout = FileMenuLayout::new(count);
                    let (width, height) = crate::window_manager::fit_overlay_size(
                        &main_app, position.0, position.1, layout.width, layout.height,
                    );
                    let _ = main_app.emit_to(
                        "overlay",
                        "files-selected",
                        FilesPayload {
                            files,
                            drag_id: generation,
                            layout,
                        },
                    );
                    crate::window_manager::show_overlay_at(
                        &main_app, position.0, position.1, width, height,
                    );
                });
                return;
            }
            std::thread::sleep(Duration::from_millis(25));
        }
    });
}

/// Consume Shell gestures without invoking text-copy detection. Preserve an inside
/// release until OLE delivers the native drop event after the low-level mouse hook.
pub fn mouse_up(app: &AppHandle, point: (i32, i32)) -> bool {
    let from_shell = MOUSE_DOWN
        .lock()
        .ok()
        .and_then(|mut down| down.take())
        .is_some();
    if !from_shell {
        return false;
    }
    if !crate::selection::is_point_inside_window(app, "overlay", point.0, point.1) {
        dismiss_menu(app);
    } else {
        // Cancel a worker which has not displayed a menu, but retain its drop session.
        GENERATION.fetch_add(1, Ordering::SeqCst);
    }
    true
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FileDropPayload {
    drag_id: u64,
    x: f64,
    y: f64,
    scale_factor: f64,
}

/// Called only for native OLE file events belonging to the overlay window.
pub fn handle_drag_drop(window: &tauri::Window, event: &tauri::DragDropEvent) {
    let app = window.app_handle();
    match event {
        tauri::DragDropEvent::Enter { position, .. } | tauri::DragDropEvent::Over { position } => {
            let id = DRAG_SESSION
                .lock()
                .ok()
                .and_then(|s| s.as_ref().map(|s| s.id));
            if let Some(drag_id) = id {
                let scale = window.scale_factor().unwrap_or(1.0);
                let _ = app.emit_to(
                    "overlay",
                    "file-drag-over",
                    FileDropPayload {
                        drag_id,
                        x: position.x,
                        y: position.y,
                        scale_factor: scale,
                    },
                );
            }
        }
        tauri::DragDropEvent::Drop { paths, position } => {
            let files = filter_files(
                paths
                    .iter()
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect(),
            );
            let id = DRAG_SESSION.lock().ok().and_then(|mut s| {
                let session = s.as_mut()?;
                session.accept_drop(&files).then_some(session.id)
            });
            if let Some(drag_id) = id {
                let scale = window.scale_factor().unwrap_or(1.0);
                let _ = app.emit_to(
                    "overlay",
                    "file-drag-drop",
                    FileDropPayload {
                        drag_id,
                        x: position.x,
                        y: position.y,
                        scale_factor: scale,
                    },
                );
            } else {
                dismiss_menu(app);
            }
        }
        tauri::DragDropEvent::Leave => {
            let id = DRAG_SESSION
                .lock()
                .ok()
                .and_then(|s| s.as_ref().map(|s| s.id));
            if let Some(drag_id) = id {
                let _ = app.emit_to("overlay", "file-drag-leave", drag_id);
            }
        }
        _ => {}
    }
}

fn pinned_card(app: &AppHandle) -> bool {
    crate::overlay_state::is_overlay_pinned()
        && !crate::overlay_state::is_overlay_bubble_mode()
        && crate::selection::is_overlay_visible(app)
}

fn is_current(generation: u64, target: ShellTarget) -> bool {
    GENERATION.load(Ordering::SeqCst) == generation
        // SAFETY: querying window identity never activates it or changes focus.
        && unsafe { foreground_matches(target) && IsWindow(target.view as HWND) != 0 }
}

fn window_class(hwnd: HWND) -> String {
    let mut name = [0u16; 128];
    // SAFETY: HWND is only queried; invalid windows produce a zero length.
    let len = unsafe { GetClassNameW(hwnd, name.as_mut_ptr(), name.len() as i32) };
    String::from_utf16_lossy(&name[..len.max(0) as usize])
}

fn foreground_matches(target: ShellTarget) -> bool {
    // SAFETY: the returned borrowed HWND is only compared and queried, never dereferenced.
    let foreground = unsafe { GetForegroundWindow() };
    foreground as usize == target.foreground
        || (matches!(window_class(foreground).as_str(), "Progman" | "WorkerW")
            && matches!(
                window_class(target.foreground as HWND).as_str(),
                "Progman" | "WorkerW"
            ))
}

fn point_on_item(point: (i32, i32)) -> bool {
    // SAFETY: UIA interfaces remain on the initialized worker thread. No focus or
    // selection is modified; the control tree only distinguishes items from blank space.
    unsafe {
        let Ok(automation): Result<IUIAutomation, _> =
            CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
        else {
            return false;
        };
        let Ok(mut element) = automation.ElementFromPoint(windows::Win32::Foundation::POINT {
            x: point.0,
            y: point.1,
        }) else {
            return false;
        };
        let Ok(walker) = automation.ControlViewWalker() else {
            return false;
        };
        for _ in 0..5 {
            if element.CurrentControlType().is_ok_and(|kind| {
                kind == UIA_ListItemControlTypeId || kind == UIA_DataItemControlTypeId
            }) {
                return true;
            }
            let Ok(parent) = walker.GetParentElement(&element) else {
                break;
            };
            element = parent;
        }
        false
    }
}
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FilesPayload {
    files: Vec<String>,
    drag_id: u64,
    layout: FileMenuLayout,
}

struct Apartment;
impl Drop for Apartment {
    fn drop(&mut self) {
        // SAFETY: created only after successful CoInitializeEx on this worker thread.
        unsafe { CoUninitialize() };
    }
}

fn shell_files(target: ShellTarget, point: (i32, i32), is_drag: bool) -> Option<Vec<String>> {
    // SAFETY: all COM objects stay on this initialized worker apartment and are dropped
    // before Apartment; Shell-allocated display names are freed with CoTaskMemFree.
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().ok()?;
        let _apartment = Apartment;
        if !is_drag && !point_on_item(point) {
            return None;
        }
        let windows: IShellWindows =
            CoCreateInstance(&ShellWindows, None, CLSCTX_LOCAL_SERVER).ok()?;
        let mut candidates = Vec::new();
        let empty = VARIANT::default();
        let mut desktop = 0;
        if let Ok(dispatch) =
            windows.FindWindowSW(&empty, &empty, SWC_DESKTOP, &mut desktop, SWFO_NEEDDISPATCH)
        {
            candidates.push(dispatch);
        }
        for index in 0..windows.Count().ok()? {
            if let Ok(dispatch) = windows.Item(&VARIANT::from(index)) {
                candidates.push(dispatch);
            }
        }
        for dispatch in candidates {
            let Ok(provider) = dispatch.cast::<IServiceProvider>() else {
                continue;
            };
            let Ok(browser) = provider.QueryService::<IShellBrowser>(&SID_STopLevelBrowser) else {
                continue;
            };
            let Ok(view) = browser.QueryActiveShellView() else {
                continue;
            };
            let Ok(hwnd) = view.GetWindow() else { continue };
            // This rejects inactive tabs, different Explorer windows and other Shell views.
            if hwnd.0 as usize != target.view {
                continue;
            }
            let folder = view.cast::<IFolderView2>().ok()?;
            let items = folder.GetSelection(false).ok()?;
            let mut paths = Vec::new();
            for index in 0..items.GetCount().ok()? {
                let Ok(item) = items.GetItemAt(index) else {
                    continue;
                };
                let Ok(name) = item.GetDisplayName(SIGDN_FILESYSPATH) else {
                    continue;
                };
                let path = name.to_string();
                CoTaskMemFree(Some(name.0.cast()));
                if let Ok(path) = path {
                    paths.push(path);
                }
            }
            return Some(filter_files(paths));
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn filters_folders_missing_relative_and_duplicate_paths() {
        let dir = std::env::temp_dir().join(format!("iox-selection-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("文件.txt");
        std::fs::write(&file, b"test").unwrap();
        let path = file.to_str().unwrap().to_string();
        assert_eq!(
            filter_files(vec![
                dir.to_str().unwrap().into(),
                path.clone(),
                path.clone(),
                "relative.txt".into(),
                dir.join("missing").to_str().unwrap().into()
            ]),
            vec![path]
        );
        std::fs::remove_file(file).unwrap();
        std::fs::remove_dir(dir).unwrap();
    }
}
