use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewWindow};
use windows_sys::Win32::Foundation::*;
use windows_sys::Win32::Graphics::Dwm::*;
use windows_sys::Win32::Graphics::Gdi::*;
use windows_sys::Win32::System::Threading::*;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

/// 当前界面样式是否启用系统原生标题栏（由 `apply_ui_style` 依据配置同步）
static NATIVE_CHROME: AtomicBool = AtomicBool::new(false);

/// 界面样式策略：新增样式时只需扩展此处与 `config::normalize_ui_style`
#[derive(Debug, Clone, Copy)]
pub struct UiStylePolicy {
    pub native_chrome: bool,
}

pub fn ui_style_policy(style: &str) -> UiStylePolicy {
    match style {
        "windows" => UiStylePolicy { native_chrome: true },
        _ => UiStylePolicy { native_chrome: false },
    }
}

/// 是否处于 Windows 原生标题栏样式
pub fn is_native_chrome() -> bool {
    NATIVE_CHROME.load(Ordering::Relaxed)
}

/// 将配置的深浅色映射为系统窗口主题
pub fn to_window_theme(theme: &str) -> Option<tauri::Theme> {
    match theme {
        "dark" => Some(tauri::Theme::Dark),
        "light" => Some(tauri::Theme::Light),
        _ => None,
    }
}

/// 划词浮窗、常驻悬浮球与后台采集窗不参与界面样式装饰：
/// 浮窗需保持无边框无激活，后台窗全程隐藏。
fn is_style_exempt(label: &str) -> bool {
    matches!(label, "overlay" | "floating_ball") || label.starts_with("iox_history_")
}

/// 将配置中的界面样式应用到全部窗口：`windows` 使用系统标题栏与直角边框，
/// 其余样式保持自绘无边框 + DWM 圆角。
pub fn apply_ui_style(app: &AppHandle, style: &str, theme: &str) {
    let native = ui_style_policy(style).native_chrome;
    NATIVE_CHROME.store(native, Ordering::Relaxed);
    let window_theme = to_window_theme(theme);

    // 使用 windows() 而非 webview_windows()：Web 卡片由 WindowBuilder + 子 Webview 构建，
    // 不会出现在 webview_windows() 中，否则永远无法附加系统标题栏。
    for (label, window) in app.windows() {
        if is_style_exempt(&label) {
            continue;
        }
        let native = native
            && !(crate::web_chrome::is_web_window(&label) && crate::web_chrome::headless(app));
        apply_window_ui_style(&window, native, window_theme);
    }
}

/// 仅同步系统标题栏配色，不重建窗口装饰
pub fn sync_window_theme(app: &AppHandle, theme: &str) {
    let window_theme = to_window_theme(theme);
    for (label, window) in app.windows() {
        if is_style_exempt(&label) {
            continue;
        }
        let _ = window.set_theme(window_theme);
    }
}

/// 配置成功提交后的窗口 adapter：只应用新旧快照之间实际变化的原生效果。
/// 窗口操作失败不回滚配置，内存与磁盘仍以已提交状态为准。
pub fn apply_config_effects(
    app: &AppHandle,
    previous: &crate::config::AppConfig,
    current: &crate::config::AppConfig,
) {
    let headless_changed = previous.general.web_headless_mode != current.general.web_headless_mode;
    if headless_changed {
        app.state::<crate::AppState>()
            .web_chrome
            .set_headless(current.general.web_headless_mode);
    }
    if previous.general.ui_style != current.general.ui_style || headless_changed {
        apply_ui_style(app, &current.general.ui_style, &current.general.theme);
    } else if previous.general.theme != current.general.theme {
        sync_window_theme(app, &current.general.theme);
    }

    if headless_changed || previous.general.ui_style != current.general.ui_style {
        crate::web_chrome::layout_all(app);
    }

    if previous.general.enable_floating_ball != current.general.enable_floating_ball {
        if let Some(window) = app.get_webview_window("floating_ball") {
            if current.general.enable_floating_ball {
                init_floating_ball(&window, current.general.floating_ball_pos);
            } else {
                let _ = window.hide();
            }
        }
    }
}

/// 对单个窗口应用界面策略：系统标题栏开关、直角/圆角与标题栏配色
pub fn apply_window_ui_style(window: &tauri::Window, native: bool, theme: Option<tauri::Theme>) {
    let _ = window.set_theme(theme);
    let _ = window.set_decorations(native);
    if let Ok(hwnd) = window.hwnd() {
        apply_main_window_native_style(hwnd.0 as _);
    }
}

/// Run against the exact WRY container owned by this WebView, never another sibling view.
fn with_web_child(view: &tauri::Webview, update: impl FnOnce(HWND) + Send + 'static) {
    let Ok(parent) = view.window().hwnd() else {
        return;
    };
    let parent = parent.0 as isize;
    let _ = view.with_webview(move |platform| {
        // with_webview runs on the UI thread; the controller owns its parent container.
        // Validate that it is still a child of our window before using the borrowed HWND.
        unsafe {
            let mut child = Default::default();
            if platform.controller().ParentWindow(&mut child).is_ok() {
                let child = child.0 as HWND;
                if !child.is_null() && GetParent(child) == parent as HWND {
                    update(child);
                }
            }
        }
    });
}

pub fn raise_web_toolbar(view: &tauri::Webview) {
    with_web_child(view, |child| {
        // The validated child HWND is borrowed on the UI thread. Raising the local toolbar
        // only changes sibling order and does not activate the window or the remote page.
        unsafe {
            SetWindowPos(
                child,
                HWND_TOP,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
    });
}

/// Keep the toolbar canvas stationary; clipped areas must pass input to the page below.
pub fn set_web_menu_region(view: &tauri::Webview, clip: Option<(i32, i32, i32, i32)>) {
    with_web_child(view, move |child| {
        // The validated child HWND is borrowed on the UI thread. Windows owns a region
        // after successful SetWindowRgn; on failure we retain ownership and release it.
        unsafe {
            let Some((x, y, width, height)) = clip else {
                SetWindowRgn(child, std::ptr::null_mut(), 1);
                return;
            };
            let region = CreateRectRgn(x, y, x + width, y + height);
            if !region.is_null() && SetWindowRgn(child, region, 1) == 0 {
                DeleteObject(region as _);
            }
        }
    });
}

pub fn set_web_content_round(view: &tauri::Webview, radius: Option<i32>, all_corners: bool) {
    with_web_child(view, move |child| {
        // This exact content container clips all its descendants. On success Windows takes
        // ownership of the region; on failure we must release it. None also clears old clips.
        unsafe {
            let Some(radius) = radius.filter(|radius| *radius > 0) else {
                SetWindowRgn(child, std::ptr::null_mut(), 1);
                return;
            };
            let mut rect: RECT = std::mem::zeroed();
            if GetClientRect(child, &mut rect) == 0 {
                return;
            }
            let diameter = radius * 2;
            let region = CreateRoundRectRgn(
                0,
                if all_corners { 0 } else { -diameter },
                rect.right + 1,
                rect.bottom + 1,
                diameter,
                diameter,
            );
            if !region.is_null() && SetWindowRgn(child, region, 1) == 0 {
                DeleteObject(region as _);
            }
        }
    });
}

/// 为主设置窗口与浮窗启用 Windows 11/10 原生 DWM 硬件级抗锯齿圆角与亚克力材质。
/// Windows 原生标题栏样式下改为直角边框。
pub fn apply_main_window_native_style(hwnd: HWND) {
    set_window_corner_preference(hwnd, !is_native_chrome());
    unsafe {
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

/// Per-window policy: headless Web cards round independently of the global titlebar style.
pub fn set_window_corner_preference(hwnd: HWND, rounded: bool) {
    let preference: u32 = if rounded { 2 } else { 1 };
    // The caller borrows a live window HWND; DWM copies the preference during this call.
    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd,
            33, // DWMWA_WINDOW_CORNER_PREFERENCE
            &preference as *const _ as *const _,
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

/// Fit the entire file menu inside the cursor monitor's work area, preserving its shape.
pub fn fit_overlay_size(app: &AppHandle, x: i32, y: i32, width: f64, height: f64) -> (i32, i32) {
    let scale = app.get_webview_window("overlay")
        .and_then(|window| window.scale_factor().ok()).unwrap_or(1.0);
    // SAFETY: MONITORINFO contains only integers/RECTs; zero is a valid initial value.
    let mut info: MONITORINFO = unsafe { std::mem::zeroed() };
    info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
    // SAFETY: the nearest monitor is only queried; info is valid writable storage.
    let available = unsafe {
        let monitor = MonitorFromPoint(POINT { x, y }, MONITOR_DEFAULTTONEAREST);
        if GetMonitorInfoW(monitor, &mut info) != 0 {
            ((info.rcWork.right - info.rcWork.left - 16) as f64 / scale,
             (info.rcWork.bottom - info.rcWork.top - 24) as f64 / scale)
        } else { (1920.0 / scale, 1040.0 / scale) }
    };
    let factor = (available.0 / width).min(available.1 / height).min(1.0);
    ((width * factor).ceil().max(160.0) as i32, (height * factor).ceil() as i32)
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

/// 检查指定屏幕物理坐标 (x, y) 是否落在指定窗口的可见且可命中区域内
pub fn is_point_inside_window(app: &AppHandle, label: &str, x: i32, y: i32) -> bool {
    if let Some(window) = app.get_webview_window(label) {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let hwnd_raw = hwnd.0 as HWND;
                if IsWindowVisible(hwnd_raw) != 0 {
                    let mut rect: RECT = std::mem::zeroed();
                    if GetWindowRect(hwnd_raw, &mut rect) != 0 {
                        return x >= rect.left
                            && x < rect.right
                            && y >= rect.top
                            && y < rect.bottom
                            && window_region_contains(hwnd_raw, x - rect.left, y - rect.top);
                    }
                }
            }
        }
    }
    false
}

/// 检查指定屏幕物理坐标 (x, y) 是否落在 Overlay 或 Floating Ball 窗口内
pub fn is_point_inside_overlay(app: &AppHandle, x: i32, y: i32) -> bool {
    is_point_inside_window(app, "overlay", x, y)
        || is_point_inside_window(app, "floating_ball", x, y)
}

/// Overlay 窗口当前是否在屏幕上可见（形态政策只看原生真相，不看记忆状态）
pub fn overlay_is_visible(app: &AppHandle) -> bool {
    app.get_webview_window("overlay")
        .and_then(|window| window.hwnd().ok())
        .is_some_and(|hwnd| unsafe { IsWindowVisible(hwnd.0 as HWND) != 0 })
}

/// 原生隐藏 Overlay 窗口
pub fn hide_overlay(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        if let Ok(hwnd) = window.hwnd() {
            // SAFETY: 窗口由本进程持有；隐藏不改变焦点、所有权或几何。
            unsafe {
                ShowWindow(hwnd.0 as HWND, SW_HIDE);
            }
        }
        let _ = window.hide();
    }
}

/// 原生调整 Overlay 尺寸与激活样式（气泡态保持无激活，卡片态按需获取输入焦点）
pub fn resize_overlay(
    app: &AppHandle,
    width: i32,
    height: i32,
    allow_focus: bool,
) -> Result<(), String> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| "Overlay window not found".to_string())?;
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let phys_width = (width as f64 * scale_factor).round() as i32;
    let phys_height = (height as f64 * scale_factor).round() as i32;

    let Ok(hwnd) = window.hwnd() else {
        return Ok(());
    };
    let hwnd_raw = hwnd.0 as HWND;
    if allow_focus {
        remove_no_activate_style(hwnd_raw);
    } else {
        apply_no_activate_style(hwnd_raw);
    }

    // SAFETY: hwnd_raw 属于本次调用取得的存活窗口；读取矩形与 SetWindowPos 均不改所有权。
    unsafe {
        let mut rect: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd_raw, &mut rect) == 0 {
            return Ok(());
        }
        if rect.right - rect.left == phys_width
            && rect.bottom - rect.top == phys_height
            && !allow_focus
        {
            return Ok(());
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
    Ok(())
}

/// 保留自由位置，仅在距侧边 24 逻辑像素以内吸附；球体大小已按 DPI 缩放。
pub fn calculate_floating_ball_snap(
    x: i32,
    y: i32,
    ball_size: i32,
    work_area: (i32, i32, i32, i32),
) -> (i32, i32, &'static str) {
    let (wa_left, wa_top, wa_right, wa_bottom) = work_area;
    let dist_to_left = (x - wa_left).abs();
    let dist_to_right = (wa_right - (x + ball_size)).abs();

    let snap_distance = (ball_size * 2 / 5).max(1);
    let max_x = (wa_right - ball_size).max(wa_left);
    let (target_x, edge) = if dist_to_left <= snap_distance && dist_to_left <= dist_to_right {
        (wa_left, "left")
    } else if dist_to_right <= snap_distance {
        (max_x, "right")
    } else {
        let target_x = x.clamp(wa_left, max_x);
        let edge = if target_x == wa_left { "left" } else if target_x == max_x { "right" } else { "none" };
        (target_x, edge)
    };

    let min_y = wa_top + 10;
    let max_y = (wa_bottom - ball_size - 10).max(min_y);
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

/// 停靠后重建固定画布布局，返回球体逻辑坐标及卡片角落。
pub type FloatingBallPosition = (i32, i32, String, String);

pub fn snap_floating_ball(
    window: &WebviewWindow,
    current_x: i32,
    current_y: i32,
) -> FloatingBallPosition {
    init_floating_ball(window, (current_x, current_y))
}

/// 初始化固定画布；前端提交角落定位后才显示，保存坐标仍表示 60px 球体。
pub fn init_floating_ball(window: &WebviewWindow, saved_pos: (i32, i32)) -> FloatingBallPosition {
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

    let layout = calculate_floating_menu_placement(
        (target_phys_x, target_phys_y, target_phys_x + phys_size, target_phys_y + phys_size),
        (328.0 * scale_factor).round() as i32,
        (400.0 * scale_factor).round() as i32, work_area);
    if let Ok(hwnd) = window.hwnd() {
        let hwnd_raw = hwnd.0 as HWND;
        // SAFETY: Live owned window. Only initialization/docking changes geometry,
        // while hidden; hover transitions only change its region.
        unsafe {
            ShowWindow(hwnd_raw, SW_HIDE);
            apply_no_activate_style(hwnd_raw);
            SetWindowPos(hwnd_raw, HWND_TOPMOST, layout.x, layout.y, layout.width, layout.height,
                SWP_NOACTIVATE);
        }
        let _ = set_floating_canvas_region(hwnd_raw, false, layout.corner, phys_size);
        *FLOATING_CANVAS.lock().unwrap() = FloatingCanvas { corner: layout.corner, expanded: false };
    }
    // The frontend commits this corner before set_floating_ball_expanded shows it.
    ((target_phys_x as f64 / scale_factor).round() as i32,
     (target_phys_y as f64 / scale_factor).round() as i32, layout.corner.to_string(), edge.to_string())
}

struct FloatingMenuPlacement {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    corner: &'static str,
}

/// 坐标均为物理像素。保留球体所在角，在空间更多的一侧延展。
fn calculate_floating_menu_placement(
    ball: (i32, i32, i32, i32),
    width: i32,
    height: i32,
    area: (i32, i32, i32, i32),
) -> FloatingMenuPlacement {
    let left = (ball.0 - area.0).abs() < (area.2 - ball.2).abs();
    let top = area.3 - ball.1 >= ball.3 - area.1;
    let available_width = if left { area.2 - ball.0 } else { ball.2 - area.0 };
    let available_height = if top { area.3 - ball.1 } else { ball.3 - area.1 };
    let width = width.min(available_width).max(1);
    let height = height.min(available_height).max(1);
    FloatingMenuPlacement {
        x: if left { ball.0 } else { ball.2 - width },
        y: if top { ball.1 } else { ball.3 - height },
        width,
        height,
        corner: match (top, left) {
            (true, true) => "top-left",
            (true, false) => "top-right",
            (false, true) => "bottom-left",
            (false, false) => "bottom-right",
        },
    }
}

fn calculate_collapsed_ball_position(
    rect: (i32, i32, i32, i32),
    size: i32,
    corner: &str,
) -> (i32, i32) {
    (
        if corner.ends_with("left") { rect.0 } else { rect.2 - size },
        if corner.starts_with("bottom") { rect.3 - size } else { rect.1 },
    )
}

struct FloatingCanvas {
    corner: &'static str,
    expanded: bool,
}
static FLOATING_CANVAS: Mutex<FloatingCanvas> = Mutex::new(FloatingCanvas {
    corner: "top-right", expanded: false,
});

pub fn floating_menu_is_expanded() -> bool {
    FLOATING_CANVAS.lock().unwrap().expanded
}

/// Local window coordinates; windows without a custom region retain rectangular hit testing.
pub fn window_region_contains(hwnd: HWND, x: i32, y: i32) -> bool {
    // SAFETY: The caller supplies a live window. This temporary region is never
    // transferred to Windows and is always released after querying it.
    unsafe {
        let region = CreateRectRgn(0, 0, 0, 0);
        if region.is_null() { return true; }
        let has_region = GetWindowRgn(hwnd, region) != 0;
        let inside = !has_region || PtInRegion(region, x, y) != 0;
        DeleteObject(region);
        inside
    }
}

/// Keep the WebView surface at its final dimensions. Cropping the native window
/// also excludes the transparent desktop area from mouse hit testing.
fn set_floating_canvas_region(hwnd: HWND, expanded: bool, corner: &str, ball_size: i32) -> Result<(), String> {
    // SAFETY: Caller provides a live HWND. The newly allocated region transfers
    // to Windows only on success; on failure we retain ownership and delete it.
    unsafe {
        let mut rect: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return Err("Cannot read floating canvas bounds".into());
        }
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        let (x, y, w, h) = if expanded { (0, 0, width, height) } else {
            let (x, y) = calculate_collapsed_ball_position((0, 0, width, height), ball_size, corner);
            (x, y, ball_size, ball_size)
        };
        let region = CreateRectRgn(x, y, x + w, y + h);
        if region.is_null() { return Err("Cannot create floating canvas region".into()); }
        if SetWindowRgn(hwnd, region, 1) == 0 {
            DeleteObject(region);
            return Err("Cannot apply floating canvas region".into());
        }
        Ok(())
    }
}

/// Hover never moves or resizes the HWND or WebView: only the visible/input region changes.
pub fn set_floating_ball_expanded(
    window: &WebviewWindow,
    expanded: bool,
) -> Result<(i32, i32, String), String> {
    let scale = window.scale_factor().unwrap_or(1.0);
    let hwnd = window.hwnd().map_err(|error| error.to_string())?.0 as HWND;
    let corner = FLOATING_CANVAS.lock().unwrap().corner;
    set_floating_canvas_region(hwnd, expanded, corner, (60.0 * scale).round() as i32)?;
    FLOATING_CANVAS.lock().unwrap().expanded = expanded;
    apply_no_activate_style(hwnd);
    // SAFETY: HWND belongs to the live window; show without activation, without geometry changes.
    unsafe { ShowWindow(hwnd, SW_SHOWNOACTIVATE); }
    Ok((0, 0, corner.to_string()))
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
                    let corner = FLOATING_CANVAS.lock().unwrap().corner;
                    let (x, y) = calculate_collapsed_ball_position(
                        (final_rect.left, final_rect.top, final_rect.right, final_rect.bottom),
                        (60.0 * scale_factor).round() as i32, corner);
                    return ((x as f64 / scale_factor).round() as i32,
                        (y as f64 / scale_factor).round() as i32);
                }
            }
        }
    }
    (0, 0)
}

/// 在独立阻塞线程中执行 120FPS 物理光标硬件级实时拖拽循环（0 IPC 开销，彻底消除卡顿）。
/// 「正在拖动」标记由协调 module 在调用前后持有，这里只搬运原生窗口。
pub fn run_overlay_drag_loop(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
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
    fn floating_ball_keeps_free_positions_and_only_snaps_near_edges() {
        for scale in [1, 2] {
            let area = (-1280 * scale, 0, 0, 1080 * scale);
            let size = 60 * scale;
            assert_eq!(calculate_floating_ball_snap(-600 * scale, 300 * scale, size, area),
                (-600 * scale, 300 * scale, "none"));
            assert_eq!(calculate_floating_ball_snap(-1260 * scale, 300 * scale, size, area),
                (-1280 * scale, 300 * scale, "left"));
            assert_eq!(calculate_floating_ball_snap(-80 * scale, 300 * scale, size, area),
                (-60 * scale, 300 * scale, "right"));
            assert_eq!(calculate_floating_ball_snap(-90 * scale, 300 * scale, size, area),
                (-90 * scale, 300 * scale, "none"));
        }
    }

    #[test]
    fn test_floating_ball_snap_edge_calc() {
        let work_area = (0, 0, 1920, 1080); // left, top, right, bottom
        
        // 靠近屏幕左侧 (x=100, y=300)
        let (target_x, target_y, edge) = calculate_floating_ball_snap(20, 300, 60, work_area);
        assert_eq!(target_x, 0);
        assert_eq!(target_y, 300);
        assert_eq!(edge, "left");

        // 靠近屏幕右侧 (x=1800, y=300)
        let (target_x, target_y, edge) = calculate_floating_ball_snap(1840, 300, 60, work_area);
        assert_eq!(target_x, 1920 - 60);
        assert_eq!(target_y, 300);
        assert_eq!(edge, "right");

        // 靠近屏幕顶部越界 (x=1800, y=-50) -> clamp 到 top + 10
        let (target_x, target_y, edge) = calculate_floating_ball_snap(1840, -50, 60, work_area);
        assert_eq!(target_x, 1920 - 60);
        assert_eq!(target_y, 10);
        assert_eq!(edge, "right");

        // 靠近屏幕底部越界 (x=100, y=2000) -> clamp 到 bottom - 60 - 10
        let (target_x, target_y, edge) = calculate_floating_ball_snap(20, 2000, 60, work_area);
        assert_eq!(target_x, 0);
        assert_eq!(target_y, 1080 - 60 - 10);
        assert_eq!(edge, "left");
    }

    #[test]
    fn floating_menu_preserves_all_four_corner_anchors_at_multiple_scales() {
        for scale in [1.0, 1.5, 2.0] {
            let px = |value: i32| (value as f64 * scale).round() as i32;
            let work_area = (0, 0, px(1920), px(1080));
            for (x, y, corner) in [(0, 100, "top-left"), (1860, 100, "top-right"),
                (0, 900, "bottom-left"), (1860, 900, "bottom-right")] {
                let ball = (px(x), px(y), px(x + 60), px(y + 60));
                let layout = calculate_floating_menu_placement(ball, px(328), px(360), work_area);
                assert_eq!(layout.corner, corner);
                assert_eq!((layout.width, layout.height), (px(328), px(360)));
                let rect = (layout.x, layout.y, layout.x + layout.width, layout.y + layout.height);
                assert_eq!(calculate_collapsed_ball_position(rect, px(60), corner), (px(x), px(y)));
                assert!(rect.0 >= work_area.0 && rect.1 >= work_area.1);
                assert!(rect.2 <= work_area.2 && rect.3 <= work_area.3);
            }
        }
    }

    #[test]
    fn floating_menu_supports_negative_monitor_coordinates_and_small_work_areas() {
        let area = (-1280, -400, 0, 400);
        let layout = calculate_floating_menu_placement((-60, 250, 0, 310), 328, 360, area);
        assert_eq!(layout.corner, "bottom-right");
        assert_eq!((layout.x, layout.y), (-328, -50));
        let small = calculate_floating_menu_placement((0, 100, 60, 160), 328, 360, (0, 0, 240, 280));
        assert_eq!((small.width, small.height), (240, 180));
        assert_eq!(small.corner, "top-left");
        assert_eq!(calculate_collapsed_ball_position((small.x, small.y, small.x + small.width,
            small.y + small.height), 60, small.corner), (0, 100));
    }

    #[test]
    fn floating_ball_config_disables_redirection_before_creation() {
        let config: tauri::Config = serde_json::from_str(include_str!("../tauri.conf.json"))
            .expect("window configuration must match the installed Tauri version");
        let ball = config.app.windows.iter().find(|window| window.label == "floating_ball")
            .expect("floating ball window");
        assert!(ball.transparent && ball.no_redirection_bitmap);
        assert!(!ball.focus && !ball.visible && !ball.shadow);
    }

    #[test]
    fn floating_canvas_region_changes_never_move_or_resize_the_native_window() {
        // SAFETY: This test owns a hidden STATIC window and destroys it on this thread.
        unsafe {
            let class = [83u16, 84, 65, 84, 73, 67, 0];
            let hwnd = CreateWindowExW(WS_EX_NOREDIRECTIONBITMAP, class.as_ptr(), std::ptr::null(), WS_POPUP,
                100, 200, 656, 800, std::ptr::null_mut(), std::ptr::null_mut(),
                std::ptr::null_mut(), std::ptr::null());
            assert!(!hwnd.is_null());
            for corner in ["top-left", "top-right", "bottom-left", "bottom-right"] {
                for expanded in [false, true, false, true, false] {
                    set_floating_canvas_region(hwnd, expanded, corner, 120).unwrap();
                    let mut rect: RECT = std::mem::zeroed();
                    assert_ne!(GetWindowRect(hwnd, &mut rect), 0);
                    assert_eq!((rect.left, rect.top, rect.right, rect.bottom), (100, 200, 756, 1000));
                    let mut client: RECT = std::mem::zeroed();
                    assert_ne!(GetClientRect(hwnd, &mut client), 0);
                    assert_eq!((client.right, client.bottom), (656, 800));
                    let region = CreateRectRgn(0, 0, 0, 0);
                    assert_ne!(GetWindowRgn(hwnd, region), 0);
                    let (x, y) = calculate_collapsed_ball_position((0, 0, 656, 800), 120, corner);
                    assert_ne!(PtInRegion(region, x + 60, y + 60), 0);
                    assert_eq!(PtInRegion(region, 328, 400) != 0, expanded);
                    assert!(window_region_contains(hwnd, x + 60, y + 60));
                    assert_eq!(window_region_contains(hwnd, 328, 400), expanded);
                    DeleteObject(region);
                    assert_eq!(IsWindowVisible(hwnd), 0);
                }
            }
            DestroyWindow(hwnd);
        }
    }

    #[test]
    fn native_composition_survives_input_focus_style_changes() {
        struct TestWindow(HWND);
        impl Drop for TestWindow {
            fn drop(&mut self) {
                // SAFETY: 测试独占该隐藏窗口，在创建线程销毁。
                unsafe { DestroyWindow(self.0); }
            }
        }
        // SAFETY: STATIC 是内置窗口类；窗口不显示、不激活，不操作用户窗口。
        unsafe {
            let class = [83u16, 84, 65, 84, 73, 67, 0];
            let hwnd = CreateWindowExW(WS_EX_NOREDIRECTIONBITMAP, class.as_ptr(), std::ptr::null(), WS_POPUP,
                0, 0, 60, 60, std::ptr::null_mut(), std::ptr::null_mut(),
                std::ptr::null_mut(), std::ptr::null());
            assert!(!hwnd.is_null(), "hidden composition test window");
            let window = TestWindow(hwnd);
            apply_no_activate_style(window.0);
            let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            assert_ne!(style & WS_EX_NOREDIRECTIONBITMAP, 0);
            assert_ne!(style & WS_EX_NOACTIVATE, 0);
            remove_no_activate_style(hwnd);
            let input_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            assert_ne!(input_style & WS_EX_NOREDIRECTIONBITMAP, 0);
            assert_eq!(input_style & WS_EX_NOACTIVATE, 0);
            assert_eq!(IsWindowVisible(hwnd), 0);
        }
    }
}

