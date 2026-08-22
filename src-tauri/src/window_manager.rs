use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewWindow};
use windows_sys::Win32::Foundation::*;
use windows_sys::Win32::Graphics::Dwm::*;
use windows_sys::Win32::Graphics::Gdi::*;
use windows_sys::Win32::System::Threading::*;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

/// 为主设置窗口与浮窗启用 Windows 11/10 原生 DWM 硬件级抗锯齿圆角与亚克力材质
pub fn apply_main_window_native_style(hwnd: HWND) {
    unsafe {
        // DWMWA_WINDOW_CORNER_PREFERENCE = 33
        // DWMWCP_ROUND = 2 (圆角)
        let corner_preference: u32 = 2;
        let _ = DwmSetWindowAttribute(
            hwnd,
            33, // DWMWA_WINDOW_CORNER_PREFERENCE
            &corner_preference as *const _ as *const _,
            std::mem::size_of::<u32>() as u32,
        );

        // DWMWA_SYSTEMBACKDROP_TYPE = 38
        // 3 = DWMSBT_ACRYLIC (亚克力), 2 = DWMSBT_MICA (云母)
        let backdrop_type: u32 = 3;
        let _ = DwmSetWindowAttribute(
            hwnd,
            38, // DWMWA_SYSTEMBACKDROP_TYPE
            &backdrop_type as *const _ as *const _,
            std::mem::size_of::<u32>() as u32,
        );
    }
}

/// 强制唤醒并将指定 HWND 窗口置于 Windows 最前台并激活键盘焦点（穿透 Windows 前台锁定限制）
pub fn bring_window_to_foreground(hwnd: HWND) {
    unsafe {
        if IsIconic(hwnd) != 0 {
            ShowWindow(hwnd, SW_RESTORE);
        } else {
            ShowWindow(hwnd, SW_SHOW);
        }

        let foreground_hwnd = GetForegroundWindow();
        if foreground_hwnd != hwnd {
            let foreground_thread_id = GetWindowThreadProcessId(foreground_hwnd, std::ptr::null_mut());
            let current_thread_id = windows_sys::Win32::System::Threading::GetCurrentThreadId();

            if foreground_thread_id != current_thread_id && foreground_thread_id != 0 {
                AttachThreadInput(current_thread_id, foreground_thread_id, 1);
                SetForegroundWindow(hwnd);
                BringWindowToTop(hwnd);
                AttachThreadInput(current_thread_id, foreground_thread_id, 0);
            } else {
                SetForegroundWindow(hwnd);
                BringWindowToTop(hwnd);
            }
        }
        SetActiveWindow(hwnd);
    }
}

/// 为外部 Content Webview 的 child HWND 设置底部圆角物理裁切（仅裁切 child webview，绝不影响主窗口 DWM 帧）
pub fn apply_content_webview_bottom_round(parent_hwnd: HWND, radius: i32) {
    unsafe {
        let mut children: Vec<HWND> = Vec::new();
        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let list = &mut *(lparam as *mut Vec<HWND>);
            list.push(hwnd);
            1
        }
        EnumChildWindows(
            parent_hwnd,
            Some(enum_proc),
            &mut children as *mut _ as isize,
        );

        let mut parent_rect: RECT = std::mem::zeroed();
        GetWindowRect(parent_hwnd, &mut parent_rect);

        for child in children {
            let mut child_rect: RECT = std::mem::zeroed();
            GetWindowRect(child, &mut child_rect);

            let width = child_rect.right - child_rect.left;
            let height = child_rect.bottom - child_rect.top;

            // 仅对 content webview 的 HWND 进行底部圆角裁切（高度大于 50px 且位于窗口下方）
            if height > 50 && child_rect.top > parent_rect.top + 20 {
                let diameter = radius * 2;
                // 创建从 -diameter 到 height 的圆角区域：顶部为直角平齐，仅底部两侧产生圆角
                let hrgn = CreateRoundRectRgn(0, -diameter, width + 1, height + 1, diameter, diameter);
                if !hrgn.is_null() {
                    if SetWindowRgn(child, hrgn, 1) == 0 {
                        DeleteObject(hrgn as _);
                    }
                }
            }
        }
    }
}

/// 移除 content webview 的 Region 限制（还原为直角矩形，如最大化状态）
pub fn remove_content_webview_round(parent_hwnd: HWND) {
    unsafe {
        let mut children: Vec<HWND> = Vec::new();
        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let list = &mut *(lparam as *mut Vec<HWND>);
            list.push(hwnd);
            1
        }
        EnumChildWindows(
            parent_hwnd,
            Some(enum_proc),
            &mut children as *mut _ as isize,
        );

        let mut parent_rect: RECT = std::mem::zeroed();
        GetWindowRect(parent_hwnd, &mut parent_rect);

        for child in children {
            let mut child_rect: RECT = std::mem::zeroed();
            GetWindowRect(child, &mut child_rect);
            let height = child_rect.bottom - child_rect.top;
            if height > 50 && child_rect.top > parent_rect.top + 20 {
                SetWindowRgn(child, std::ptr::null_mut(), 1);
            }
        }
    }
}

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
        let scale_factor = window.scale_factor().unwrap_or(1.0);
        let phys_width = (width as f64 * scale_factor).round() as i32;
        let phys_height = (height as f64 * scale_factor).round() as i32;

        let (x, y) = calculate_overlay_position(cursor_x, cursor_y, phys_width, phys_height);

        if let Ok(hwnd) = window.hwnd() {
            let hwnd_raw = hwnd.0 as HWND;
            apply_no_activate_style(hwnd_raw);

            unsafe {
                SetWindowPos(
                    hwnd_raw,
                    HWND_TOPMOST,
                    x,
                    y,
                    phys_width,
                    phys_height,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
                ShowWindow(hwnd_raw, SW_SHOWNOACTIVATE);
            }
        }
        let _ = window.show();
    }
}

/// 调整悬浮窗尺寸（从气泡态切换到卡片态，或卡片态折叠/重置）
pub fn resize_overlay_window(
    window: &WebviewWindow,
    width: i32,
    height: i32,
    allow_focus: bool,
) {
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let phys_width = (width as f64 * scale_factor).round() as i32;
    let phys_height = (height as f64 * scale_factor).round() as i32;

    if let Ok(hwnd) = window.hwnd() {
        let hwnd_raw = hwnd.0 as HWND;
        if allow_focus {
            remove_no_activate_style(hwnd_raw);
        } else {
            apply_no_activate_style(hwnd_raw);
        }

        unsafe {
            let mut rect: RECT = std::mem::zeroed();
            if GetWindowRect(hwnd_raw, &mut rect) != 0 {
                let current_width = rect.right - rect.left;
                let current_height = rect.bottom - rect.top;
                if current_width == phys_width && current_height == phys_height && !allow_focus {
                    return;
                }

                // 获取当前屏幕工作区，防止 600x900px 大卡片在屏幕边缘展开时溢出
                let work_area = get_screen_work_area(rect.left, rect.top);
                let mut target_x = rect.left;
                let mut target_y = rect.top;

                if target_x + phys_width > work_area.2 - 8 {
                    target_x = (work_area.2 - phys_width - 8).max(work_area.0 + 8);
                }
                if target_y + phys_height > work_area.3 - 8 {
                    target_y = (work_area.3 - phys_height - 8).max(work_area.1 + 8);
                }
                if target_x < work_area.0 + 8 {
                    target_x = work_area.0 + 8;
                }
                if target_y < work_area.1 + 8 {
                    target_y = work_area.1 + 8;
                }

                let flags = if allow_focus {
                    SWP_SHOWWINDOW
                } else {
                    SWP_NOACTIVATE | SWP_SHOWWINDOW
                };

                SetWindowPos(
                    hwnd_raw,
                    HWND_TOPMOST,
                    target_x,
                    target_y,
                    phys_width,
                    phys_height,
                    flags,
                );
            }
        }
    }
}

/// 隐藏悬浮窗
pub fn hide_overlay_window(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            ShowWindow(hwnd.0 as HWND, SW_HIDE);
        }
    }
    let _ = window.hide();
}

/// 计算常驻悬浮球贴边吸附后的目标坐标与吸附边缘 ("left" | "right")
pub fn calculate_floating_ball_snap(
    x: i32,
    y: i32,
    ball_size: i32,
    work_area: (i32, i32, i32, i32),
) -> (i32, i32, &'static str) {
    let (wa_left, wa_top, wa_right, wa_bottom) = work_area;
    let dist_to_left = (x - wa_left).abs();
    let dist_to_right = (wa_right - (x + ball_size)).abs();

    let (target_x, edge) = if dist_to_left < dist_to_right {
        (wa_left, "left")
    } else {
        (wa_right - ball_size, "right")
    };

    let min_y = wa_top + 10;
    let max_y = wa_bottom - ball_size - 10;
    let target_y = y.clamp(min_y, max_y);

    (target_x, target_y, edge)
}

/// 获取指定屏幕坐标处显示器的有效工作区 (left, top, right, bottom)
pub fn get_screen_work_area(x: i32, y: i32) -> (i32, i32, i32, i32) {
    unsafe {
        let pt = POINT { x, y };
        let hmonitor = MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(hmonitor, &mut mi) != 0 {
            (mi.rcWork.left, mi.rcWork.top, mi.rcWork.right, mi.rcWork.bottom)
        } else {
            (0, 0, 1920, 1080)
        }
    }
}

/// 将悬浮球平滑吸附到最近的屏幕边缘并返回其逻辑坐标与边缘位置
pub fn snap_floating_ball(
    window: &WebviewWindow,
    current_x: i32,
    current_y: i32,
    ball_size: i32,
) -> (i32, i32, String) {
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let phys_size = (ball_size as f64 * scale_factor).round() as i32;
    let phys_x = (current_x as f64 * scale_factor).round() as i32;
    let phys_y = (current_y as f64 * scale_factor).round() as i32;

    let work_area = get_screen_work_area(phys_x, phys_y);
    let (target_phys_x, target_phys_y, edge) =
        calculate_floating_ball_snap(phys_x, phys_y, phys_size, work_area);

    if let Ok(hwnd) = window.hwnd() {
        let hwnd_raw = hwnd.0 as HWND;
        apply_no_activate_style(hwnd_raw);
        unsafe {
            SetWindowPos(
                hwnd_raw,
                HWND_TOPMOST,
                target_phys_x,
                target_phys_y,
                phys_size,
                phys_size,
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }

    let logical_x = (target_phys_x as f64 / scale_factor).round() as i32;
    let logical_y = (target_phys_y as f64 / scale_factor).round() as i32;

    (logical_x, logical_y, edge.to_string())
}

/// 初始化常驻悬浮球（注入样式、定位并显示）
pub fn init_floating_ball(window: &WebviewWindow, saved_pos: (i32, i32)) -> (i32, i32, String) {
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let phys_size = (60.0 * scale_factor).round() as i32;

    let (phys_x, phys_y) = if saved_pos == (0, 0) {
        let work_area = get_screen_work_area(100, 100);
        (work_area.2 - phys_size, (work_area.1 + work_area.3) / 2)
    } else {
        (
            (saved_pos.0 as f64 * scale_factor).round() as i32,
            (saved_pos.1 as f64 * scale_factor).round() as i32,
        )
    };

    let work_area = get_screen_work_area(phys_x, phys_y);
    let (target_phys_x, target_phys_y, edge) =
        calculate_floating_ball_snap(phys_x, phys_y, phys_size, work_area);

    if let Ok(hwnd) = window.hwnd() {
        let hwnd_raw = hwnd.0 as HWND;
        apply_no_activate_style(hwnd_raw);
        unsafe {
            SetWindowPos(
                hwnd_raw,
                HWND_TOPMOST,
                target_phys_x,
                target_phys_y,
                phys_size,
                phys_size,
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
            ShowWindow(hwnd_raw, SW_SHOWNOACTIVATE);
        }
    }
    let _ = window.show();

    let logical_x = (target_phys_x as f64 / scale_factor).round() as i32;
    let logical_y = (target_phys_y as f64 / scale_factor).round() as i32;
    (logical_x, logical_y, edge.to_string())
}

/// 切换悬浮球展开菜单/收起球形态（原子性同步计算位置与大小，并按需切换焦点能力）
pub fn set_floating_ball_expanded(
    window: &WebviewWindow,
    expanded: bool,
    target_width: i32,
    target_height: i32,
) -> (i32, i32, String) {
    let scale_factor = window.scale_factor().unwrap_or(1.0);

    if let Ok(hwnd) = window.hwnd() {
        let hwnd_raw = hwnd.0 as HWND;
        unsafe {
            let mut current_rect: RECT = std::mem::zeroed();
            GetWindowRect(hwnd_raw, &mut current_rect);

            let work_area = get_screen_work_area(current_rect.left, current_rect.top);
            let dist_to_left = (current_rect.left - work_area.0).abs();
            let dist_to_right = (work_area.2 - current_rect.right).abs();
            let edge = if dist_to_left < dist_to_right {
                "left"
            } else {
                "right"
            };

            if expanded {
                let phys_w = (target_width as f64 * scale_factor).round() as i32;
                let phys_h = (target_height as f64 * scale_factor).round() as i32;

                let target_phys_x = if edge == "left" {
                    work_area.0 + 8
                } else {
                    work_area.2 - phys_w - 8
                };

                let min_y = work_area.1 + 8;
                let max_y = (work_area.3 - phys_h - 8).max(min_y);
                let target_phys_y = current_rect.top.clamp(min_y, max_y);

                remove_no_activate_style(hwnd_raw);
                SetWindowPos(
                    hwnd_raw,
                    HWND_TOPMOST,
                    target_phys_x,
                    target_phys_y,
                    phys_w,
                    phys_h,
                    SWP_SHOWWINDOW,
                );
                let _ = window.set_focus();

                let logical_x = (target_phys_x as f64 / scale_factor).round() as i32;
                let logical_y = (target_phys_y as f64 / scale_factor).round() as i32;
                (logical_x, logical_y, edge.to_string())
            } else {
                let phys_size = (60.0 * scale_factor).round() as i32;
                let target_phys_x = if edge == "left" {
                    work_area.0
                } else {
                    work_area.2 - phys_size
                };

                let min_y = work_area.1 + 10;
                let max_y = (work_area.3 - phys_size - 10).max(min_y);
                let target_phys_y = current_rect.top.clamp(min_y, max_y);

                apply_no_activate_style(hwnd_raw);
                SetWindowPos(
                    hwnd_raw,
                    HWND_TOPMOST,
                    target_phys_x,
                    target_phys_y,
                    phys_size,
                    phys_size,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );

                let logical_x = (target_phys_x as f64 / scale_factor).round() as i32;
                let logical_y = (target_phys_y as f64 / scale_factor).round() as i32;
                (logical_x, logical_y, edge.to_string())
            }
        }
    } else {
        (0, 0, "right".to_string())
    }
}

/// 悬浮球硬件级实时拖拽循环
pub fn run_floating_ball_drag_loop(window: &WebviewWindow) -> (i32, i32) {
    if let Ok(hwnd) = window.hwnd() {
        let hwnd_raw = hwnd.0 as HWND;
        unsafe {
            let mut cursor_start: POINT = std::mem::zeroed();
            let mut win_rect: RECT = std::mem::zeroed();

            if GetCursorPos(&mut cursor_start) != 0 && GetWindowRect(hwnd_raw, &mut win_rect) != 0 {
                let offset_x = cursor_start.x - win_rect.left;
                let offset_y = cursor_start.y - win_rect.top;

                while (GetAsyncKeyState(VK_LBUTTON as i32) as u16 & 0x8000) != 0 {
                    let mut current_cursor: POINT = std::mem::zeroed();
                    if GetCursorPos(&mut current_cursor) != 0 {
                        let new_x = current_cursor.x - offset_x;
                        let new_y = current_cursor.y - offset_y;
                        SetWindowPos(
                            hwnd_raw,
                            HWND_TOPMOST,
                            new_x,
                            new_y,
                            0,
                            0,
                            SWP_NOSIZE | SWP_NOACTIVATE,
                        );
                    }
                    thread::sleep(Duration::from_millis(8));
                }

                let mut final_rect: RECT = std::mem::zeroed();
                if GetWindowRect(hwnd_raw, &mut final_rect) != 0 {
                    let scale_factor = window.scale_factor().unwrap_or(1.0);
                    return (
                        (final_rect.left as f64 / scale_factor).round() as i32,
                        (final_rect.top as f64 / scale_factor).round() as i32,
                    );
                }
            }
        }
    }
    (0, 0)
}

/// 在独立阻塞线程中执行 120FPS 物理光标硬件级实时拖拽循环（0 IPC 开销，彻底消除卡顿）
pub fn run_overlay_drag_loop(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        if let Ok(hwnd) = window.hwnd() {
            let hwnd_raw = hwnd.0 as HWND;
            unsafe {
                crate::overlay_state::set_dragging_overlay(true);
                let mut cursor_start: POINT = std::mem::zeroed();
                let mut win_rect: RECT = std::mem::zeroed();

                if GetCursorPos(&mut cursor_start) != 0 && GetWindowRect(hwnd_raw, &mut win_rect) != 0 {
                    let offset_x = cursor_start.x - win_rect.left;
                    let offset_y = cursor_start.y - win_rect.top;

                    while (GetAsyncKeyState(VK_LBUTTON as i32) as u16 & 0x8000) != 0 {
                        let mut current_cursor: POINT = std::mem::zeroed();
                        if GetCursorPos(&mut current_cursor) != 0 {
                            let new_x = current_cursor.x - offset_x;
                            let new_y = current_cursor.y - offset_y;
                            SetWindowPos(
                                hwnd_raw,
                                std::ptr::null_mut(),
                                new_x,
                                new_y,
                                0,
                                0,
                                SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
                            );
                        }
                        thread::sleep(Duration::from_millis(8));
                    }
                }
                thread::sleep(Duration::from_millis(40));
                crate::overlay_state::set_dragging_overlay(false);
            }
        }
    }
}

/// 根据启用的 Action 列表与内容文本自适应计算胶囊悬浮气泡条（BubbleBar）的物理像素宽度
///
/// ⚠️ 单一数据源约束 / Single Source of Truth ⚠️
/// 本函数必须与前端 `src/utils/bubbleWidth.ts` 中的 `calculateBubbleWidth`
/// 保持**算法等价**（相同输入产出相同宽度）。修改任一端时，必须同步修改另一端，
/// 否则会出现气泡宽度与内容不匹配的视觉 bug。详见 `AGENTS.md` §3.1「核心设计原则」。
pub fn calculate_bubble_bar_width(actions: &[crate::config::ActionConfig], icon_only: bool) -> i32 {
    let enabled_actions: Vec<&crate::config::ActionConfig> =
        actions.iter().filter(|a| a.enabled).collect();
    if enabled_actions.is_empty() {
        return 220;
    }

    // 基础固定组件与边距 (px)：
    // - 拖拽指示手柄 (16px) + gap (2px)
    // - 分割线 (5px)
    // - Logo/设置入口 (24px)
    // - 外层胶囊容器内边距 px-1.5 (12px)
    // - 边框与安全呼吸内边距 padding (12px)
    // - 渲染阴影与安全缓冲裕量 (18px)
    let mut total_width: f64 = 16.0 + 2.0 + 5.0 + 24.0 + 12.0 + 12.0 + 18.0;

    // 按钮之间 gap-[2px]
    if enabled_actions.len() > 1 {
        total_width += ((enabled_actions.len() - 1) * 2) as f64;
    }

    if icon_only {
        // 纯图标模式下每个按钮固定宽度 23px
        total_width += (enabled_actions.len() * 23) as f64;
    } else {
        for action in enabled_actions {
            // 单个按钮内边距 px-1.5 (12px) + 图标 (14px) + gap-1 (4px)
            let mut btn_w: f64 = 12.0 + 14.0 + 4.0;
            // 计算文本宽度 (11.5px 字体: ASCII 字符约 7.5px, 中文/全角字符约 13px)
            for ch in action.name.chars() {
                if ch.is_ascii() {
                    btn_w += 7.5;
                } else {
                    btn_w += 13.0;
                }
            }
            total_width += btn_w;
        }
    }

    // 向上取整，并做上下限约束 (最小 160px，最大 1200px)
    let min_w = if icon_only { 160 } else { 220 };
    let final_width = total_width.ceil() as i32;
    final_width.clamp(min_w, 1200)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ActionConfig;

    #[test]
    fn test_position_calculation_basic() {
        let (x, y) = calculate_overlay_position(500, 500, 260, 42);
        assert_eq!(x, 500 - 130);
        assert_eq!(y, 500 - 42 - 10);
    }

    #[test]
    fn test_calculate_bubble_bar_width_various_actions() {
        // 1. 空动作列表
        assert_eq!(calculate_bubble_bar_width(&[], false), 220);
        assert_eq!(calculate_bubble_bar_width(&[], true), 220);

        // 2. 只有禁用动作
        let disabled_action = ActionConfig {
            id: "act1".to_string(),
            name: "DeepSeek".to_string(),
            icon: "bot".to_string(),
            action_type: "api".to_string(),
            provider_id: None,
            prompt_template: None,
            url_template: None,
            copy_to_clipboard: None,
            enabled: false,
            input_selector: None,
            submit_selector: None,
            auto_submit: None,
            use_url_template: None,
        };
        assert_eq!(calculate_bubble_bar_width(&[disabled_action.clone()], false), 220);
        assert_eq!(calculate_bubble_bar_width(&[disabled_action], true), 220);

        // 3. 7 个典型动作 (DeepSeek, Qwen, Perplexity, 复制, Claude, ChatGPT, 豆包)
        let sample_actions = vec![
            ActionConfig {
                id: "1".into(),
                name: "DeepSeek".into(),
                icon: "bot".into(),
                action_type: "api".into(),
                provider_id: None,
                prompt_template: None,
                url_template: None,
                copy_to_clipboard: None,
                enabled: true,
                input_selector: None,
                submit_selector: None,
                auto_submit: None,
            use_url_template: None,
            },
            ActionConfig {
                id: "2".into(),
                name: "Qwen".into(),
                icon: "bot".into(),
                action_type: "api".into(),
                provider_id: None,
                prompt_template: None,
                url_template: None,
                copy_to_clipboard: None,
                enabled: true,
                input_selector: None,
                submit_selector: None,
                auto_submit: None,
            use_url_template: None,
            },
            ActionConfig {
                id: "3".into(),
                name: "Perplexity".into(),
                icon: "bot".into(),
                action_type: "api".into(),
                provider_id: None,
                prompt_template: None,
                url_template: None,
                copy_to_clipboard: None,
                enabled: true,
                input_selector: None,
                submit_selector: None,
                auto_submit: None,
            use_url_template: None,
            },
            ActionConfig {
                id: "4".into(),
                name: "复制".into(),
                icon: "copy".into(),
                action_type: "copy".into(),
                provider_id: None,
                prompt_template: None,
                url_template: None,
                copy_to_clipboard: None,
                enabled: true,
                input_selector: None,
                submit_selector: None,
                auto_submit: None,
            use_url_template: None,
            },
            ActionConfig {
                id: "5".into(),
                name: "Claude".into(),
                icon: "bot".into(),
                action_type: "api".into(),
                provider_id: None,
                prompt_template: None,
                url_template: None,
                copy_to_clipboard: None,
                enabled: true,
                input_selector: None,
                submit_selector: None,
                auto_submit: None,
            use_url_template: None,
            },
            ActionConfig {
                id: "6".into(),
                name: "ChatGPT".into(),
                icon: "bot".into(),
                action_type: "api".into(),
                provider_id: None,
                prompt_template: None,
                url_template: None,
                copy_to_clipboard: None,
                enabled: true,
                input_selector: None,
                submit_selector: None,
                auto_submit: None,
            use_url_template: None,
            },
            ActionConfig {
                id: "7".into(),
                name: "豆包".into(),
                icon: "bot".into(),
                action_type: "api".into(),
                provider_id: None,
                prompt_template: None,
                url_template: None,
                copy_to_clipboard: None,
                enabled: true,
                input_selector: None,
                submit_selector: None,
                auto_submit: None,
            use_url_template: None,
            },
        ];

        let width = calculate_bubble_bar_width(&sample_actions, false);
        // 7 个动作总宽应该在 600px ~ 660px 之间
        assert!(width >= 600 && width <= 700, "Calculated width was {}", width);

        // 纯图标模式下 7 个动作的宽度应该更紧凑 (约 260px)
        let icon_only_width = calculate_bubble_bar_width(&sample_actions, true);
        assert!(icon_only_width >= 240 && icon_only_width <= 280, "Calculated icon_only width was {}", icon_only_width);
    }

    #[test]
    fn test_floating_ball_snap_edge_calc() {
        let work_area = (0, 0, 1920, 1080); // left, top, right, bottom
        
        // 靠近屏幕左侧 (x=100, y=300)
        let (target_x, target_y, edge) = calculate_floating_ball_snap(100, 300, 60, work_area);
        assert_eq!(target_x, 0);
        assert_eq!(target_y, 300);
        assert_eq!(edge, "left");

        // 靠近屏幕右侧 (x=1800, y=300)
        let (target_x, target_y, edge) = calculate_floating_ball_snap(1800, 300, 60, work_area);
        assert_eq!(target_x, 1920 - 60);
        assert_eq!(target_y, 300);
        assert_eq!(edge, "right");

        // 靠近屏幕顶部越界 (x=1800, y=-50) -> clamp 到 top + 10
        let (target_x, target_y, edge) = calculate_floating_ball_snap(1800, -50, 60, work_area);
        assert_eq!(target_x, 1920 - 60);
        assert_eq!(target_y, 10);
        assert_eq!(edge, "right");

        // 靠近屏幕底部越界 (x=100, y=2000) -> clamp 到 bottom - 60 - 10
        let (target_x, target_y, edge) = calculate_floating_ball_snap(100, 2000, 60, work_area);
        assert_eq!(target_x, 0);
        assert_eq!(target_y, 1080 - 60 - 10);
        assert_eq!(edge, "left");
    }
}

