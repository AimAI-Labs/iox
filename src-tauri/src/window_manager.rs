use tauri::{AppHandle, Manager, WebviewWindow};
use windows_sys::Win32::Foundation::*;
use windows_sys::Win32::Graphics::Gdi::*;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

/// 为指定窗口注入 WS_EX_NOACTIVATE 扩展样式
pub fn apply_no_activate_style(hwnd: HWND) {
    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let new_ex_style = ex_style | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style as isize);
    }
}

/// 移除 WS_EX_NOACTIVATE 扩展样式（用于卡片输入或 Pin 固定时获取焦点）
pub fn remove_no_activate_style(hwnd: HWND) {
    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let new_ex_style = (ex_style & !WS_EX_NOACTIVATE) | WS_EX_TOOLWINDOW;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style as isize);
    }
}

/// 计算窗口相对于当前光标与屏幕工作区的防遮挡坐标
pub fn calculate_overlay_position(
    cursor_x: i32,
    cursor_y: i32,
    width: i32,
    height: i32,
) -> (i32, i32) {
    unsafe {
        let pt = POINT {
            x: cursor_x,
            y: cursor_y,
        };
        let hmonitor = MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;

        let work_area = if GetMonitorInfoW(hmonitor, &mut mi) != 0 {
            mi.rcWork
        } else {
            RECT {
                left: 0,
                top: 0,
                right: 1920,
                bottom: 1080,
            }
        };

        // 水平居中
        let mut target_x = cursor_x - (width / 2);
        // 默认放置在光标上方 10px
        let mut target_y = cursor_y - height - 10;

        // 若上方超出屏幕工作区，则反转至光标下方 15px
        if target_y < work_area.top + 5 {
            target_y = cursor_y + 15;
        }

        // 左右边缘吸附约束 (Clamp)
        let min_x = work_area.left + 8;
        let max_x = work_area.right - width - 8;
        if target_x < min_x {
            target_x = min_x;
        }
        if target_x > max_x {
            target_x = max_x;
        }

        // 下边缘约束
        let max_y = work_area.bottom - height - 8;
        if target_y > max_y {
            target_y = max_y;
        }

        (target_x, target_y)
    }
}

/// 显示并在指定坐标定位 Overlay 窗口
pub fn show_overlay_at(
    app: &AppHandle,
    cursor_x: i32,
    cursor_y: i32,
    width: i32,
    height: i32,
) {
    if let Some(window) = app.get_webview_window("overlay") {
        let (x, y) = calculate_overlay_position(cursor_x, cursor_y, width, height);

        if let Ok(hwnd) = window.hwnd() {
            let hwnd_raw = hwnd.0 as HWND;
            apply_no_activate_style(hwnd_raw);

            unsafe {
                SetWindowPos(
                    hwnd_raw,
                    HWND_TOPMOST,
                    x,
                    y,
                    width,
                    height,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
            }
        }
    }
}

/// 调整悬浮窗尺寸（从气泡态切换到卡片态，或卡片态折叠）
pub fn resize_overlay_window(
    window: &WebviewWindow,
    width: i32,
    height: i32,
    allow_focus: bool,
) {
    if let Ok(hwnd) = window.hwnd() {
        let hwnd_raw = hwnd.0 as HWND;
        if allow_focus {
            remove_no_activate_style(hwnd_raw);
        } else {
            apply_no_activate_style(hwnd_raw);
        }

        unsafe {
            let flags = if allow_focus {
                SWP_NOMOVE | SWP_SHOWWINDOW
            } else {
                SWP_NOMOVE | SWP_NOACTIVATE | SWP_SHOWWINDOW
            };

            SetWindowPos(
                hwnd_raw,
                HWND_TOPMOST,
                0,
                0,
                width,
                height,
                flags,
            );
        }
    }
}

/// 隐藏悬浮窗
pub fn hide_overlay_window(window: &WebviewWindow) {
    let _ = window.hide();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_position_calculation_basic() {
        let (x, y) = calculate_overlay_position(500, 500, 260, 42);
        assert_eq!(x, 500 - 130);
        assert_eq!(y, 500 - 42 - 10);
    }
}
