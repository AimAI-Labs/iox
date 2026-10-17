//! Read actual Explorer/desktop selection through Shell COM, without clipboard access.
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;
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
use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetDoubleClickTime;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

static GENERATION: AtomicU64 = AtomicU64::new(0);
static MOUSE_DOWN: Mutex<Option<ShellTarget>> = Mutex::new(None);
static SELECTED_FILES: Mutex<Vec<String>> = Mutex::new(Vec::new());

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

/// Only paths from the most recently shown menu may be read by attachment IPC.
pub fn validate_selected_files(files: &[String]) -> Result<(), String> {
    let selected = SELECTED_FILES
        .lock()
        .map_err(|_| "File selection unavailable")?;
    if files.is_empty() || files.iter().any(|path| !selected.contains(path)) {
        return Err("File selection expired; select the files again".into());
    }
    Ok(())
}

pub fn cancel_pending() {
    GENERATION.fetch_add(1, Ordering::SeqCst);
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

pub fn mouse_down(point: (i32, i32), inside_overlay: bool) {
    cancel_pending();
    if !inside_overlay {
        if let Ok(mut files) = SELECTED_FILES.lock() {
            files.clear();
        }
    }
    if let Ok(mut down) = MOUSE_DOWN.lock() {
        *down = if inside_overlay {
            None
        } else {
            target_at(point)
        };
    }
}

/// Returns true for a Shell file gesture when the independent file setting is enabled.
pub fn mouse_up(app: &AppHandle, point: (i32, i32), repeated_click: bool, is_drag: bool) -> bool {
    let target = MOUSE_DOWN.lock().ok().and_then(|mut down| down.take());
    let Some(target) = target else { return false };
    if target_at(point) != Some(target) {
        return false;
    }
    let settings = app.try_state::<crate::AppState>().and_then(|state| {
        // Never wait on configuration persistence while running inside WH_MOUSE_LL.
        state.config.try_lock().ok().map(|config| {
            (
                config.general.auto_popup_on_file_selection,
                config.general.trigger_modifier.clone(),
                config.blacklist.clone(),
            )
        })
    });
    let Some((enabled, modifier, blacklist)) = settings else {
        return false;
    };
    if !enabled {
        return false;
    }
    let Some(process) = crate::selection::get_foreground_process_name() else {
        return false;
    };
    if !process.eq_ignore_ascii_case("explorer.exe") {
        return false;
    }
    // A second click opens files; it cancels the first-click worker without creating another.
    if repeated_click
        || !crate::selection::is_modifier_satisfied(&modifier)
        || blacklist
            .iter()
            .any(|entry| entry.eq_ignore_ascii_case(&process))
    {
        return true;
    }
    let generation = GENERATION.load(Ordering::SeqCst);
    let app = app.clone();
    std::thread::spawn(move || {
        // Wait out Windows' double-click interval, so opening a file never flashes a menu.
        // SAFETY: read-only system timing query; no pointers or handles are borrowed.
        let delay = unsafe { GetDoubleClickTime() } as u64 + 25;
        std::thread::sleep(Duration::from_millis(delay));
        if !is_current(generation, target) || pinned_card(&app) {
            return;
        }
        let Some(files) = shell_files(target, point, is_drag) else {
            return;
        };
        if files.is_empty() || !is_current(generation, target) {
            return;
        }
        let main_app = app.clone();
        let _ = app.run_on_main_thread(move || {
            if !is_current(generation, target) || pinned_card(&main_app) {
                return;
            }
            if let Some(state) = main_app.try_state::<crate::AppState>() {
                if !state
                    .config
                    .lock()
                    .is_ok_and(|config| config.general.auto_popup_on_file_selection)
                {
                    return;
                }
            }
            if let Ok(mut selected) = SELECTED_FILES.lock() {
                *selected = files.clone();
            }
            crate::selection::cancel_pending_hide();
            crate::overlay_state::set_overlay_bubble_mode(true);
            let _ = main_app.emit("files-selected", FilesPayload { files });
            crate::window_manager::show_overlay_at(&main_app, point.0, point.1, 360, 146);
        });
    });
    true
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
struct FilesPayload {
    files: Vec<String>,
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
