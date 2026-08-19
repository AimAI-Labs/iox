use crate::overlay_state::*;
use arboard::Clipboard;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use windows_sys::Win32::Foundation::*;
use windows_sys::Win32::System::DataExchange::GetClipboardSequenceNumber;
use windows_sys::Win32::System::Threading::*;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

static HOOK_ACTIVE: AtomicBool = AtomicBool::new(false);
static SELECTION_SEQ: AtomicU64 = AtomicU64::new(0);
static HIDE_SEQ: AtomicU64 = AtomicU64::new(0);
static CLIPBOARD_LOCK: Mutex<()> = Mutex::new(());
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

pub fn set_app_handle(handle: AppHandle) {
    let _ = APP_HANDLE.set(handle);
}

/// 鼠标点击状态跟踪器（用于识别双击与三击）
struct ClickState {
    last_down_pos: Option<(i32, i32)>,
    /// 按下时刻按下点是否位于目标窗口客户区（必须按下时同步命中测试，窗口拖动后坐标语义即失效）
    last_down_in_client: bool,
    last_up_pos: (i32, i32),
    last_up_time: Option<Instant>,
    click_count: u32,
}

static CLICK_STATE: Mutex<ClickState> = Mutex::new(ClickState {
    last_down_pos: None,
    last_down_in_client: false,
    last_up_pos: (0, 0),
    last_up_time: None,
    click_count: 0,
});

const IOX_EXTRA_INFO: usize = 0x494F58; // "IOX"
const LLKHF_INJECTED_FLAG: u32 = 0x00000010;

/// 检查指定屏幕物理坐标 (x, y) 是否落在 Overlay 窗口内
pub fn is_point_inside_overlay(app: &AppHandle, x: i32, y: i32) -> bool {
    if let Some(window) = app.get_webview_window("overlay") {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let hwnd_raw = hwnd.0 as HWND;
                if IsWindowVisible(hwnd_raw) != 0 {
                    let mut rect: RECT = std::mem::zeroed();
                    if GetWindowRect(hwnd_raw, &mut rect) != 0 {
                        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
                    }
                }
            }
        }
    }
    false
}

/// 检查屏幕物理坐标 (x, y) 是否位于目标窗口的 Client（工作区/客户区）内
/// 用于精准过滤标题栏拖拽（HTCAPTION）、边框缩放（HTLEFT..HTBOTTOMRIGHT）、滚动条拖动（HTVSCROLL）等非选词交互
pub fn is_point_in_client_area(x: i32, y: i32) -> bool {
    unsafe {
        let pt = POINT { x, y };
        let hwnd = WindowFromPoint(pt);
        if hwnd.is_null() {
            return false;
        }

        // 构造 MAKELPARAM(x, y)
        let l_param = ((y as i16 as u16 as u32) << 16) | (x as i16 as u16 as u32);
        let mut hit_test_result: usize = 0;

        let res = SendMessageTimeoutW(
            hwnd,
            WM_NCHITTEST,
            0,
            l_param as isize,
            SMTO_ABORTIFHUNG | SMTO_NORMAL,
            20, // 20ms 安全超时，避免目标进程无响应时卡死钩子
            &mut hit_test_result,
        );

        if res != 0 {
            // HTCLIENT = 1, HTTRANSPARENT = -1 (isize as usize)
            hit_test_result == (HTCLIENT as usize) || (hit_test_result as isize == -1)
        } else {
            // 若消息超时或失败，退化为允许后续流程
            true
        }
    }
}

/// 检查 Overlay 窗口当前是否在屏幕上处于可见显示状态
pub fn is_overlay_visible(app: &AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("overlay") {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let hwnd_raw = hwnd.0 as HWND;
                return IsWindowVisible(hwnd_raw) != 0;
            }
        }
    }
    false
}

/// 尝试隐藏未固定的 Overlay 窗口
pub fn hide_overlay_if_unpinned(app: &AppHandle) {
    if is_overlay_pinned() {
        return;
    }
    if let Some(window) = app.get_webview_window("overlay") {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let hwnd_raw = hwnd.0 as HWND;
                if IsWindowVisible(hwnd_raw) != 0 {
                    ShowWindow(hwnd_raw, SW_HIDE);
                }
            }
        }
        let _ = window.hide();
    }
}

/// 优雅请求隐藏 Overlay（向前端广播退场动画事件，并设置 280ms 延时兜底，带 HIDE_SEQ 防抖）
pub fn request_hide_overlay_gracefully(app: &AppHandle) {
    if is_overlay_pinned() {
        return;
    }
    if !is_overlay_visible(app) {
        return;
    }
    let seq = HIDE_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
    // 向前端广播退场动画事件
    let _ = app.emit("request-overlay-hide", ());

    // 启动 280ms 延时兜底线程，确保在前端未响应时依然安全隐藏
    let app_handle = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(280));
        // 若期间有新的选词任务触发，自动取消兜底隐藏
        if HIDE_SEQ.load(Ordering::SeqCst) == seq {
            hide_overlay_if_unpinned(&app_handle);
        }
    });
}

/// 计算鼠标两点之间的欧氏位移距离
pub fn calc_drag_distance(p1: (i32, i32), p2: (i32, i32)) -> f64 {
    let dx = (p2.0 - p1.0) as f64;
    let dy = (p2.1 - p1.1) as f64;
    (dx * dx + dy * dy).sqrt()
}

/// 检查位移是否满足拖选最小阈值
pub fn is_drag_valid(p1: (i32, i32), p2: (i32, i32), min_distance: f64) -> bool {
    calc_drag_distance(p1, p2) >= min_distance
}

/// 校验选中文本是否有效（非空且大于最小长度要求）
pub fn is_text_valid(text: &str, min_len: usize) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return false;
    }
    // 计算有效字符数（忽略纯空白）
    trimmed.chars().count() >= min_len
}

/// 检查触发修饰键是否满足条件
pub fn is_modifier_satisfied(modifier: &str) -> bool {
    match modifier.to_lowercase().as_str() {
        "ctrl" => unsafe {
            (GetAsyncKeyState(VK_CONTROL as i32) as u16 & 0x8000) != 0
        },
        "alt" => unsafe {
            (GetAsyncKeyState(VK_MENU as i32) as u16 & 0x8000) != 0
        },
        "shift" => unsafe {
            (GetAsyncKeyState(VK_SHIFT as i32) as u16 & 0x8000) != 0
        },
        _ => true, // "none" 或其他值默认无修饰键要求
    }
}

/// 获取当前前台窗口所属的进程文件名（如 "notepad.exe", "chrome.exe"）
pub fn get_foreground_process_name() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }

        let h_proc = OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION,
            0,
            pid,
        );

        if h_proc.is_null() {
            return None;
        }

        let mut buffer = [0u16; 1024];
        let mut size = buffer.len() as u32;

        let ok = QueryFullProcessImageNameW(
            h_proc,
            0,
            buffer.as_mut_ptr(),
            &mut size,
        );

        CloseHandle(h_proc);

        if ok != 0 && size > 0 {
            let full_path = String::from_utf16_lossy(&buffer[..size as usize]);
            let file_name = std::path::Path::new(&full_path)
                .file_name()
                .and_then(|f| f.to_str())
                .map(|s| s.to_string());
            return file_name;
        }
        None
    }
}

/// 模拟按下与释放 Ctrl+C
pub fn simulate_ctrl_c() {
    unsafe {
        let mut inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: 0,
                        time: 0,
                        dwExtraInfo: IOX_EXTRA_INFO,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: 0x43, // 'C'
                        wScan: 0,
                        dwFlags: 0,
                        time: 0,
                        dwExtraInfo: IOX_EXTRA_INFO,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: 0x43,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: IOX_EXTRA_INFO,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: IOX_EXTRA_INFO,
                    },
                },
            },
        ];

        SendInput(
            inputs.len() as u32,
            inputs.as_mut_ptr(),
            std::mem::size_of::<INPUT>() as i32,
        );
    }
}

/// 安全提取选中文本（单例互斥锁保护：备份原始剪贴板 -> 记录序列号 -> 模拟 Ctrl+C -> 校验序列号更新 -> 读取新选区 -> 恢复原剪贴板）
pub fn extract_selected_text_safely() -> Option<String> {
    let _guard = CLIPBOARD_LOCK.lock().ok()?;
    let mut clipboard = Clipboard::new().ok()?;

    // 1. 备份原剪贴板文本
    let original_text = clipboard.get_text().ok();

    // 2. 记录模拟复制前的剪贴板序列号
    let seq_before = unsafe { GetClipboardSequenceNumber() };

    // 3. 模拟 Ctrl+C
    simulate_ctrl_c();

    // 4. 轮询等待剪贴板序列号发生更新（最大等待 80ms，每 8ms 检测一次）
    let start = Instant::now();
    let timeout = Duration::from_millis(80);
    let mut seq_changed = false;

    while start.elapsed() < timeout {
        thread::sleep(Duration::from_millis(8));
        let seq_now = unsafe { GetClipboardSequenceNumber() };
        if seq_now != seq_before {
            seq_changed = true;
            break;
        }
    }

    // 若剪贴板序列号未发生任何改变，说明前台程序未执行复制操作（即没有选中文本）
    if !seq_changed {
        return None;
    }

    // 5. 读取新复制的剪贴板内容
    let selected_text = clipboard.get_text().ok();

    // 6. 恢复原剪贴板文本（零污染）
    if let Some(orig) = original_text {
        let _ = clipboard.set_text(orig);
    } else {
        let _ = clipboard.clear();
    }

    selected_text
}

/// 鼠标低级钩子回调
unsafe extern "system" fn mouse_hook_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    let _ = std::panic::catch_unwind(|| {
        if n_code >= 0 && l_param != 0 {
            let hook_struct = *(l_param as *const MSLLHOOKSTRUCT);
            let x = hook_struct.pt.x;
            let y = hook_struct.pt.y;
            let msg = w_param as u32;

            let app_handle = APP_HANDLE.get().cloned();

            if msg == WM_LBUTTONDOWN {
                let mut is_potential_dbl_click = false;
                let dbl_click_time_ms = GetDoubleClickTime() as u128;
                let now = Instant::now();

                if let Ok(mut state) = CLICK_STATE.lock() {
                    state.last_down_pos = Some((x, y));
                    // 命中测试必须在“按下时刻”完成：若拖动/缩放窗口后于抬起时用按下坐标重测，
                    // 该坐标可能已落到移动后窗口的客户区或其后方窗口的客户区，
                    // 导致“移动窗口”被误判为“拖选文本”而错误触发 Ctrl+C
                    state.last_down_in_client = is_point_in_client_area(x, y);
                    if let Some(last_up) = state.last_up_time {
                        let elapsed = now.duration_since(last_up).as_millis();
                        let dist = calc_drag_distance(state.last_up_pos, (x, y));
                        // 若距离上次抬起在系统双击窗口期内且位移极小，判定可能处于双击/三击动作中
                        if elapsed <= dbl_click_time_ms && dist <= 8.0 {
                            is_potential_dbl_click = true;
                        }
                    }
                }

                // 若在悬浮窗外部按下左键，且悬浮窗非固定：
                // 若处于双击中途，则智能拦截即时隐藏广播，避免双击时“先闪退再弹出”
                if let Some(ref handle) = app_handle {
                    if is_overlay_visible(handle) && !is_point_inside_overlay(handle, x, y) && !is_potential_dbl_click {
                        request_hide_overlay_gracefully(handle);
                    }
                }
            } else if msg == WM_RBUTTONDOWN
                || msg == WM_MBUTTONDOWN
                || msg == WM_MOUSEWHEEL
                || msg == WM_MOUSEHWHEEL
                || msg == WM_XBUTTONDOWN
                || msg == WM_NCXBUTTONDOWN
            {
                // 右键、中键、滚轮滚动或鼠标侧键点击时平滑请求隐藏
                if let Some(ref handle) = app_handle {
                    if is_overlay_visible(handle) {
                        let is_xbutton = msg == WM_XBUTTONDOWN || msg == WM_NCXBUTTONDOWN;
                        // 侧键触发时，无论是在悬浮窗内部还是外部均应隐藏（胶囊条不消费侧键）
                        // 右键/中键/滚轮则在悬浮窗外部时平滑隐藏
                        if is_xbutton || !is_point_inside_overlay(handle, x, y) {
                            request_hide_overlay_gracefully(handle);
                        }
                    }
                }
            } else if msg == WM_LBUTTONUP {
                let mut is_drag = false;
                let mut is_double_or_triple = false;

                if let Ok(mut state) = CLICK_STATE.lock() {
                    let start_pos = state.last_down_pos.take();
                    let now = Instant::now();
                    let dbl_click_time_ms = GetDoubleClickTime() as u128;

                    if let Some(p1) = start_pos {
                        let p2 = (x, y);

                        // 使用按下时刻缓存的命中测试结果：按下点位于非客户区
                        // （如标题栏 HTCAPTION、窗口边框、滚动条等）时，绝非文本选择操作
                        let is_client_start = state.last_down_in_client;

                        if is_client_start {
                            // 1. 判断是否为拖拽选词（位移 >= 6px）
                            if is_drag_valid(p1, p2, 6.0) {
                                is_drag = true;
                                state.click_count = 0;
                                state.last_up_time = Some(now);
                                state.last_up_pos = p2;
                            } else {
                                // 2. 判断是否为双击/三击选词（时间差在系统双击阈值内，位移 <= 8px）
                                let is_within_time = match state.last_up_time {
                                    Some(last_time) => now.duration_since(last_time).as_millis() <= dbl_click_time_ms,
                                    None => false,
                                };
                                let is_within_dist = calc_drag_distance(state.last_up_pos, p2) <= 8.0;

                                if is_within_time && is_within_dist {
                                    state.click_count += 1;
                                    state.last_up_time = Some(now);
                                    state.last_up_pos = p2;
                                    if state.click_count >= 2 {
                                        is_double_or_triple = true;
                                    }
                                } else {
                                    state.click_count = 1;
                                    state.last_up_time = Some(now);
                                    state.last_up_pos = p2;
                                }
                            }
                        } else {
                            state.click_count = 0;
                            state.last_up_time = None;
                        }
                    }
                }

                if (is_drag || is_double_or_triple) && !is_dragging_overlay() {
                    // 若点击在悬浮窗内部，不触发选词逻辑
                    let inside_overlay = if let Some(ref handle) = app_handle {
                        is_point_inside_overlay(handle, x, y)
                    } else {
                        false
                    };

                    if !inside_overlay {
                        // 递增全局任务序列号并派发异步取词
                        let seq = SELECTION_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
                        trigger_selection_detection_async((x, y), seq, is_double_or_triple);
                    }
                }
            }
        }
    });
    CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param)
}

/// 键盘低级钩子回调
/// - Bubble 模式下：任意按键都优雅隐藏胶囊条
/// - Card 模式下：仅 Esc 键触发隐藏
unsafe extern "system" fn keyboard_hook_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    let _ = std::panic::catch_unwind(|| {
        if n_code >= 0 && l_param != 0 {
            let kbd_struct = *(l_param as *const KBDLLHOOKSTRUCT);
            
            // 忽略由本程序或其他程序通过 SendInput 注入的合成按键
            if (kbd_struct.flags & LLKHF_INJECTED_FLAG) != 0 || kbd_struct.dwExtraInfo == IOX_EXTRA_INFO {
                return;
            }

            let vk = kbd_struct.vkCode as u16;
            let msg = w_param as u32;

            if msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN {
                let should_hide = if is_overlay_bubble_mode() {
                    // Bubble 模式下，任意按键都触发隐藏
                    true
                } else {
                    // Card 模式下，仅 Esc 键触发隐藏
                    vk == VK_ESCAPE
                };

                if should_hide {
                    let app_handle = APP_HANDLE.get().cloned();
                    if let Some(ref handle) = app_handle {
                        if is_overlay_visible(&handle) {
                            request_hide_overlay_gracefully(&handle);
                        }
                    }
                }
            }
        }
    });
    CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param)
}

fn trigger_selection_detection_async(cursor_pos: (i32, i32), task_seq: u64, is_double_or_triple: bool) {
    thread::spawn(move || {
        let _ = std::panic::catch_unwind(move || {
            // 等待宿主窗口选区稳定（双击在复杂应用中等待 75ms，普通拖选等待 55ms）
            let wait_ms = if is_double_or_triple { 75 } else { 55 };
            thread::sleep(Duration::from_millis(wait_ms));

            // 防抖校验：若期间有更新的操作产生，废弃旧任务
            if SELECTION_SEQ.load(Ordering::SeqCst) != task_seq {
                return;
            }

            let app_handle = APP_HANDLE.get().cloned();
            let Some(handle) = app_handle else { return };

            // 检查配置
            let (auto_popup, min_len, modifier, blacklist, actions) = {
                if let Some(state) = handle.try_state::<crate::AppState>() {
                    if let Ok(config) = state.config.lock() {
                        (
                            config.general.auto_popup_on_selection,
                            config.general.min_selection_length,
                            config.general.trigger_modifier.clone(),
                            config.blacklist.clone(),
                            config.actions.clone(),
                        )
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            };

            if !auto_popup {
                return;
            }

            if !is_modifier_satisfied(&modifier) {
                return;
            }

            if let Some(proc_name) = get_foreground_process_name() {
                if proc_name.eq_ignore_ascii_case("iox.exe")
                    || blacklist.iter().any(|b: &String| b.eq_ignore_ascii_case(&proc_name))
                {
                    return;
                }
            }

            if let Some(text) = extract_selected_text_safely() {
                // 提取完成后再次进行防抖校验
                if SELECTION_SEQ.load(Ordering::SeqCst) != task_seq {
                    return;
                }

                if is_text_valid(&text, min_len) {
                    // 取消任何待处理的隐藏操作
                    HIDE_SEQ.fetch_add(1, Ordering::SeqCst);

                    // 触发全局划词事件
                    #[derive(serde::Serialize, Clone)]
                    #[serde(rename_all = "camelCase")]
                    struct SelectionPayload {
                        text: String,
                        cursor_x: i32,
                        cursor_y: i32,
                    }

                    let payload = SelectionPayload {
                        text: text.clone(),
                        cursor_x: cursor_pos.0,
                        cursor_y: cursor_pos.1,
                    };

                    let _ = handle.emit("selection-triggered", payload);
                    
                    // 动态计算胶囊气泡所需物理宽度并调度窗口定位与展示
                    let bubble_width = crate::window_manager::calculate_bubble_bar_width(&actions);
                    crate::window_manager::show_overlay_at(&handle, cursor_pos.0, cursor_pos.1, bubble_width, 46);
                }
            }
        });
    });
}

/// 启动全局鼠标与键盘监听线程
pub fn start_mouse_hook(handle: AppHandle) {
    set_app_handle(handle);
    if HOOK_ACTIVE.swap(true, Ordering::SeqCst) {
        return;
    }

    thread::spawn(|| {
        unsafe {
            let mouse_hook = SetWindowsHookExW(
                WH_MOUSE_LL,
                Some(mouse_hook_proc),
                std::ptr::null_mut(),
                0,
            );
            let kbd_hook = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(keyboard_hook_proc),
                std::ptr::null_mut(),
                0,
            );

            if mouse_hook.is_null() && kbd_hook.is_null() {
                HOOK_ACTIVE.store(false, Ordering::SeqCst);
                return;
            }

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            if !mouse_hook.is_null() {
                UnhookWindowsHookEx(mouse_hook);
            }
            if !kbd_hook.is_null() {
                UnhookWindowsHookEx(kbd_hook);
            }
            HOOK_ACTIVE.store(false, Ordering::SeqCst);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_drag_distance() {
        let p1 = (100, 100);
        let p2 = (103, 104);
        assert_eq!(calc_drag_distance(p1, p2), 5.0);
        assert!(!is_drag_valid(p1, p2, 6.0));

        let p3 = (106, 108);
        assert_eq!(calc_drag_distance(p1, p3), 10.0);
        assert!(is_drag_valid(p1, p3, 6.0));
    }

    #[test]
    fn test_text_validation() {
        assert!(!is_text_valid("", 1));
        assert!(!is_text_valid("   \n\t  ", 1));
        assert!(is_text_valid("a", 1));
        assert!(!is_text_valid("a", 2));
        assert!(is_text_valid("Hello World", 2));
    }

    #[test]
    fn test_pin_state() {
        set_overlay_pinned(true);
        assert!(is_overlay_pinned());
        set_overlay_pinned(false);
        assert!(!is_overlay_pinned());
    }
}

