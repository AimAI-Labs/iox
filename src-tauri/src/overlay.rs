//! 悬浮窗协调 module。
//!
//! 唯一决定悬浮窗的形态（气泡/卡片）、新输入能否接管、以及一次关闭是否还有效。
//! 文本划词与文件拖放是输入 adapter：它们采集输入、广播自己的载荷，然后把
//! 「现在显示什么形态」交给这里；原生窗口的定位、尺寸、可见性与命中查询由
//! `window_manager` 这一 Win32 adapter 提供。

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::window_manager;

/// 前端退场动画的最大让步时间：动画结束后仍未回调则兜底隐藏。
const HIDE_FALLBACK_MS: u64 = 280;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Mode {
    Bubble,
    Card,
}

impl Mode {
    /// 与前端共享的形态标签；未识别的值按卡片处理（卡片才拥有输入能力）。
    pub fn from_label(label: &str) -> Self {
        if label == "bubble" {
            Self::Bubble
        } else {
            Self::Card
        }
    }
}

/// 一次读出的悬浮窗形态；所有政策都是它的纯函数。
#[derive(Clone, Copy, Debug)]
struct Snapshot {
    mode: Mode,
    pinned: bool,
    visible: bool,
}

/// 钉住且仍在屏幕上的卡片：新输入零打扰，退场请求让路。
/// 隐藏后的残留 pin 不再保护——pin 是跨会话偏好，不拦截下一次划词。
fn protected_card(snapshot: Snapshot) -> bool {
    snapshot.pinned && snapshot.mode == Mode::Card && snapshot.visible
}

/// 新输入（文本、文件，或将来的第三种输入）是否可以接管悬浮窗。
fn accepts_input(snapshot: Snapshot) -> bool {
    !protected_card(snapshot)
}

/// 键盘退场政策：气泡态任意按键都退场，卡片态只有 Esc。
fn key_dismisses(mode: Mode, is_escape: bool) -> bool {
    mode == Mode::Bubble || is_escape
}

static PINNED: AtomicBool = AtomicBool::new(false);
static DRAGGING: AtomicBool = AtomicBool::new(false);
static BUBBLE_MODE: AtomicBool = AtomicBool::new(true);
static HIDE_GENERATION: HideGeneration = HideGeneration(AtomicU64::new(0));

/// 关闭代次：每次退场领取新代次，任何新输入都会作废尚未落地的旧关闭。
#[derive(Default)]
struct HideGeneration(AtomicU64);

impl HideGeneration {
    fn next(&self) -> u64 {
        self.0.fetch_add(1, Ordering::SeqCst) + 1
    }

    fn supersede(&self) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }

    fn is_current(&self, generation: u64) -> bool {
        self.0.load(Ordering::SeqCst) == generation
    }
}

fn mode() -> Mode {
    if BUBBLE_MODE.load(Ordering::SeqCst) {
        Mode::Bubble
    } else {
        Mode::Card
    }
}

fn set_mode(mode: Mode) {
    BUBBLE_MODE.store(mode == Mode::Bubble, Ordering::SeqCst);
}

pub fn set_pinned(pinned: bool) {
    PINNED.store(pinned, Ordering::SeqCst);
}

/// Overlay 是否正在被用户拖动：拖动期间的输入不触发取词。
pub fn is_dragging() -> bool {
    DRAGGING.load(Ordering::SeqCst)
}

/// 当前形态快照：可见性取原生窗口的真实状态，而不是「上次显示过」的记忆。
fn snapshot(app: &AppHandle) -> Snapshot {
    Snapshot {
        mode: mode(),
        pinned: PINNED.load(Ordering::SeqCst),
        visible: window_manager::overlay_is_visible(app),
    }
}

/// 输入 adapter 的守门：受保护的卡片不接受接管。
pub fn can_accept_input(app: &AppHandle) -> bool {
    accepts_input(snapshot(app))
}

/// 输入已被接纳：作废所有待处理的旧关闭，切回气泡态并交给原生命中测试 adapter 显示。
pub fn present_bubble(app: &AppHandle, cursor: (i32, i32), size: (i32, i32)) {
    HIDE_GENERATION.supersede();
    set_mode(Mode::Bubble);
    window_manager::show_overlay_at(app, cursor.0, cursor.1, size.0, size.1);
}

/// 请求退场：广播退场动画事件，并以 280ms 兜底保证最终隐藏。
/// 新输入会推进关闭代次，因此旧关闭不会隐藏新输入。
pub fn request_dismissal(app: &AppHandle) {
    let snapshot = snapshot(app);
    if protected_card(snapshot) || !snapshot.visible {
        return;
    }
    let generation = HIDE_GENERATION.next();
    let _ = app.emit("request-overlay-hide", ());

    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(HIDE_FALLBACK_MS));
        if HIDE_GENERATION.is_current(generation) {
            hide_if_unprotected(&app);
        }
    });
}

/// 退场兜底的落点：固定卡片继续受保护，其余情况隐藏原生窗口。
fn hide_if_unprotected(app: &AppHandle) {
    if protected_card(snapshot(app)) {
        return;
    }
    window_manager::hide_overlay(app);
}

/// 强制关闭：用户主动关闭时允许越过 pin（前端已按同一政策确认过意图）。
pub fn close(app: &AppHandle) {
    HIDE_GENERATION.supersede();
    set_mode(Mode::Bubble);
    window_manager::hide_overlay(app);
}

/// 键盘钩子的退场入口：钩子只上报「按下的是不是 Esc」。
pub fn dismiss_on_key(app: &AppHandle, is_escape: bool) {
    if key_dismisses(mode(), is_escape) {
        request_dismissal(app);
    }
}

/// 前端唯一的形态与几何入口：先提交形态政策，再由原生 adapter 调整尺寸与激活样式。
pub fn apply_layout(
    app: &AppHandle,
    mode: Mode,
    width: i32,
    height: i32,
    allow_focus: bool,
) -> Result<(), String> {
    set_mode(mode);
    window_manager::resize_overlay(app, width, height, allow_focus)
}

/// 在原生拖动循环期间持有「正在拖动」标记：拖动中的输入不取词，也不因失焦退场。
pub fn drag(app: &AppHandle) {
    if DRAGGING.swap(true, Ordering::SeqCst) {
        return;
    }
    window_manager::run_overlay_drag_loop(app);
    DRAGGING.store(false, Ordering::SeqCst);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(mode: Mode, pinned: bool, visible: bool) -> Snapshot {
        Snapshot {
            mode,
            pinned,
            visible,
        }
    }

    #[test]
    fn only_a_pinned_visible_card_owns_the_overlay() {
        for mode in [Mode::Bubble, Mode::Card] {
            for pinned in [true, false] {
                for visible in [true, false] {
                    let current = state(mode, pinned, visible);
                    let protected = mode == Mode::Card && pinned && visible;
                    assert_eq!(protected_card(current), protected, "{current:?}");
                    assert_eq!(accepts_input(current), !protected, "{current:?}");
                }
            }
        }
    }

    #[test]
    fn a_hidden_pinned_card_neither_blocks_input_nor_protects_itself() {
        let stale_pin = state(Mode::Card, true, false);
        assert!(accepts_input(stale_pin));
        assert!(!protected_card(stale_pin));
    }

    #[test]
    fn bubble_accepts_new_input_even_when_pinned() {
        assert!(accepts_input(state(Mode::Bubble, true, true)));
    }

    #[test]
    fn keyboard_dismissal_only_needs_escape_in_card_mode() {
        assert!(key_dismisses(Mode::Bubble, true));
        assert!(key_dismisses(Mode::Bubble, false));
        assert!(key_dismisses(Mode::Card, true));
        assert!(!key_dismisses(Mode::Card, false));
    }

    #[test]
    fn new_input_supersedes_every_pending_dismissal() {
        let generation = HideGeneration::default();
        let pending = generation.next();
        assert!(generation.is_current(pending));

        generation.supersede();
        assert!(!generation.is_current(pending), "旧关闭不得隐藏新输入");

        let fresh = generation.next();
        assert!(generation.is_current(fresh));
        assert!(!generation.is_current(pending));
    }
}
