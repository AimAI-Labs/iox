use std::sync::atomic::{AtomicBool, Ordering};

static IS_PINNED: AtomicBool = AtomicBool::new(false);
static IS_DRAGGING_OVERLAY: AtomicBool = AtomicBool::new(false);

/// 设置 Overlay 的拖动状态
pub fn set_dragging_overlay(dragging: bool) {
    IS_DRAGGING_OVERLAY.store(dragging, Ordering::SeqCst);
}

/// 查询 Overlay 是否正在被拖动
pub fn is_dragging_overlay() -> bool {
    IS_DRAGGING_OVERLAY.load(Ordering::SeqCst)
}

/// 设置 Overlay 的 Pin 固定状态
pub fn set_overlay_pinned(pinned: bool) {
    IS_PINNED.store(pinned, Ordering::SeqCst);
}

/// 查询 Overlay 的 Pin 固定状态
pub fn is_overlay_pinned() -> bool {
    IS_PINNED.load(Ordering::SeqCst)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pin_state() {
        set_overlay_pinned(true);
        assert!(is_overlay_pinned());
        set_overlay_pinned(false);
        assert!(!is_overlay_pinned());
    }

    #[test]
    fn test_drag_state() {
        set_dragging_overlay(true);
        assert!(is_dragging_overlay());
        set_dragging_overlay(false);
        assert!(!is_dragging_overlay());
    }
}
