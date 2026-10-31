//! Native keyboard integration; eligibility follows the actual foreground and pointer owner.

use std::cell::RefCell;
use std::sync::atomic::{AtomicU16, AtomicU64, AtomicUsize, Ordering};
use tauri::{Emitter, Manager};
use windows_sys::Win32::Foundation::POINT;
use windows_sys::Win32::System::Threading::GetCurrentProcessId;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_LWIN, VK_RCONTROL, VK_RMENU, VK_RSHIFT,
    VK_RWIN,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetAncestor, GetCursorPos, GetForegroundWindow, GetWindowThreadProcessId, WindowFromPoint,
    GA_ROOT,
};

use crate::config::WebNewChatKey;
use crate::double_tap::DoubleTap;

static KEY: AtomicU16 = AtomicU16::new(0);
static LAST_FOREGROUND: AtomicUsize = AtomicUsize::new(0);
static REVISION: AtomicU64 = AtomicU64::new(0);

thread_local! {
    static DETECTOR: RefCell<DoubleTap> = RefCell::new(DoubleTap::default());
}

pub fn configure(key: WebNewChatKey) {
    if KEY.swap(key.virtual_key(), Ordering::SeqCst) != key.virtual_key() {
        interrupt();
    }
}

/// Focus, clicks and Hub tab changes must not join taps from separate interactions.
pub fn interrupt() {
    REVISION.fetch_add(1, Ordering::SeqCst);
}

fn observe_foreground(current: usize) {
    if LAST_FOREGROUND.swap(current, Ordering::SeqCst) != current {
        interrupt();
    }
}

pub fn window_event(_window: &tauri::Window, event: &tauri::WindowEvent) {
    if matches!(event, tauri::WindowEvent::Focused(_)) {
        // Child WebViews can report focus changes without changing the active native card.
        // These notifications invalidate a pair only when the OS foreground actually changes.
        observe_foreground(foreground());
    }
}

fn foreground() -> usize {
    // SAFETY: GetForegroundWindow returns a borrowed HWND; no ownership or dereference.
    unsafe { GetForegroundWindow() as usize }
}

fn pointer_target(foreground: usize, pointer_root: usize, owned: bool) -> usize {
    if foreground != 0 && foreground == pointer_root && owned {
        foreground
    } else {
        0
    }
}

fn hovered_target() -> usize {
    // SAFETY: The HWNDs are borrowed snapshots. No window is activated or dereferenced;
    // coordinates and WindowFromPoint use the same physical screen coordinate space.
    unsafe {
        let window = GetForegroundWindow();
        let mut process = 0;
        GetWindowThreadProcessId(window, &mut process);
        let mut point: POINT = std::mem::zeroed();
        if GetCursorPos(&mut point) == 0 {
            return 0;
        }
        let under_pointer = GetAncestor(WindowFromPoint(point), GA_ROOT);
        pointer_target(
            window as usize,
            under_pointer as usize,
            process == GetCurrentProcessId(),
        )
    }
}

pub fn key(app: &tauri::AppHandle, vk: u16, down: bool, time: u32) {
    observe_foreground(foreground());
    let revision = REVISION.load(Ordering::SeqCst);
    let configured = KEY.load(Ordering::SeqCst);
    let target = hovered_target();
    // SAFETY: GetAsyncKeyState reads the current desktop's key state without modifying input.
    let modified = unsafe {
        [
            VK_LCONTROL,
            VK_RCONTROL,
            VK_LSHIFT,
            VK_RSHIFT,
            VK_LMENU,
            VK_RMENU,
            VK_LWIN,
            VK_RWIN,
        ]
        .into_iter()
        .any(|modifier| modifier != configured && GetAsyncKeyState(modifier as i32) < 0)
    };
    let triggered = DETECTOR.with(|detector| {
        let mut detector = detector.borrow_mut();
        // The hook runs before the incoming transition updates async key state. Reconcile
        // the preceding held keys first, then apply this event, so a lost keyup cannot stick.
        // SAFETY: This only reads desktop key state; it neither logs keys nor injects input.
        detector.sync_pressed_keys(|key| unsafe { GetAsyncKeyState(key as i32) < 0 });
        detector.key(vk, down, time, (target, revision), configured, modified)
    });
    if !triggered {
        return;
    }
    let handle = app.clone();
    // WebView and window operations run after the low-level hook has returned.
    let _ = app.run_on_main_thread(move || {
        if REVISION.load(Ordering::SeqCst) != revision
            || KEY.load(Ordering::SeqCst) != configured
            || hovered_target() != target
        {
            return;
        }
        let window = handle.windows().into_values().find(|window| {
            crate::web_chrome::is_web_window(window.label())
                && window.hwnd().is_ok_and(|hwnd| hwnd.0 as usize == target)
        });
        if let Some(window) = window {
            if crate::ai::web_action::new_chat_in_window(&handle, &window).is_err() {
                let _ =
                    handle.emit_to(format!("{}_bar", window.label()), "web-new-chat-failed", ());
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_actual_foreground_and_pointer_owner_define_eligibility() {
        assert_eq!(pointer_target(42, 42, true), 42);
        assert_eq!(pointer_target(42, 43, true), 0);
        assert_eq!(pointer_target(42, 42, false), 0);
        assert_eq!(pointer_target(42, 0, true), 0);
        assert_eq!(pointer_target(0, 0, true), 0);
    }
}
