use arboard::Clipboard;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use windows_sys::Win32::Foundation::*;
use windows_sys::Win32::System::Threading::*;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

static HOOK_ACTIVE: AtomicBool = AtomicBool::new(false);
static LAST_DOWN_POS: std::sync::Mutex<Option<(i32, i32)>> = std::sync::Mutex::new(None);

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

/// 校验选中文本的有效性
pub fn is_text_valid(text: &str, min_len: usize) -> bool {
    let trimmed = text.trim();
    !trimmed.is_empty() && trimmed.chars().count() >= min_len
}

/// 检查修饰键过滤是否满足
pub fn is_modifier_satisfied(modifier: &str) -> bool {
    unsafe {
        match modifier {
            "Ctrl" => (GetKeyState(VK_CONTROL as i32) as u16 & 0x8000) != 0,
            "Alt" => (GetKeyState(VK_MENU as i32) as u16 & 0x8000) != 0,
            "Shift" => (GetKeyState(VK_SHIFT as i32) as u16 & 0x8000) != 0,
            _ => true, // "None" 或未配置时默认满足
        }
    }
}

/// 获取当前前台窗口所属的进程文件名（如 "Code.exe"）
pub fn get_foreground_process_name() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        if process_id == 0 {
            return None;
        }

        let process_handle = OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION,
            0,
            process_id,
        );
        if process_handle.is_null() {
            return None;
        }

        let mut buffer = [0u16; MAX_PATH as usize];
        let mut size = buffer.len() as u32;
        let success = QueryFullProcessImageNameW(process_handle, 0, buffer.as_mut_ptr(), &mut size);
        CloseHandle(process_handle);

        if success != 0 && size > 0 {
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
                        dwExtraInfo: 0,
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
                        dwExtraInfo: 0,
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
                        dwExtraInfo: 0,
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
                        dwExtraInfo: 0,
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

/// 安全提取选中文本（备份原始剪贴板 -> 复制选区 -> 恢复原剪贴板）
pub fn extract_selected_text_safely() -> Option<String> {
    let mut clipboard = Clipboard::new().ok()?;
    
    // 1. 备份原剪贴板文本
    let original_text = clipboard.get_text().ok();

    // 2. 模拟 Ctrl+C
    simulate_ctrl_c();
    thread::sleep(Duration::from_millis(50));

    // 3. 读取新剪贴板内容
    let selected_text = clipboard.get_text().ok();

    // 4. 恢复原剪贴板文本
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

            if w_param as u32 == WM_LBUTTONDOWN {
                if let Ok(mut last_pos) = LAST_DOWN_POS.lock() {
                    *last_pos = Some((x, y));
                }
            } else if w_param as u32 == WM_LBUTTONUP {
                let start_pos = {
                    if let Ok(mut last_pos) = LAST_DOWN_POS.lock() {
                        last_pos.take()
                    } else {
                        None
                    }
                };

                if let Some(p1) = start_pos {
                    let p2 = (x, y);
                    // 拖拽距离阈值 6px
                    if is_drag_valid(p1, p2, 6.0) {
                        // 异步处理选词与弹窗，不阻塞当前钩子链
                        trigger_selection_detection_async(p2);
                    }
                }
            }
        }
    });
    CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param)
}

static APP_HANDLE: std::sync::Mutex<Option<AppHandle>> = std::sync::Mutex::new(None);

pub fn set_app_handle(handle: AppHandle) {
    if let Ok(mut h) = APP_HANDLE.lock() {
        *h = Some(handle);
    }
}

fn trigger_selection_detection_async(cursor_pos: (i32, i32)) {
    thread::spawn(move || {
        let _ = std::panic::catch_unwind(move || {
            // 短暂延时以等待宿主窗口选区稳定
            thread::sleep(Duration::from_millis(60));

            let app_handle = {
                if let Ok(h) = APP_HANDLE.lock() {
                    h.clone()
                } else {
                    None
                }
            };

            let Some(handle) = app_handle else { return };

            // 检查配置
            let (auto_popup, min_len, modifier, blacklist) = {
                if let Some(state) = handle.try_state::<crate::AppState>() {
                    if let Ok(config) = state.config.lock() {
                        (
                            config.general.auto_popup_on_selection,
                            config.general.min_selection_length,
                            config.general.trigger_modifier.clone(),
                            config.blacklist.clone(),
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
                if blacklist.iter().any(|b: &String| b.eq_ignore_ascii_case(&proc_name)) {
                    return;
                }
            }

            if let Some(text) = extract_selected_text_safely() {
                if is_text_valid(&text, min_len) {
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
                    
                    // 调度窗口定位与展示
                    crate::window_manager::show_overlay_at(&handle, cursor_pos.0, cursor_pos.1, 440, 48);
                }
            }
        });
    });
}

/// 启动全局鼠标监听线程
pub fn start_mouse_hook(handle: AppHandle) {
    set_app_handle(handle);
    if HOOK_ACTIVE.swap(true, Ordering::SeqCst) {
        return;
    }

    thread::spawn(|| {
        unsafe {
            let hook = SetWindowsHookExW(
                WH_MOUSE_LL,
                Some(mouse_hook_proc),
                std::ptr::null_mut(),
                0,
            );

            if hook.is_null() {
                HOOK_ACTIVE.store(false, Ordering::SeqCst);
                return;
            }

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            UnhookWindowsHookEx(hook);
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
}
