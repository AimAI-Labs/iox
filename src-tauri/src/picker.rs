use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use windows_sys::Win32::Foundation::*;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

static IS_PICKING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PickedProcessInfo {
    pub process_name: String,
    pub window_title: String,
}

/// 获取当前是否处于拾取模式中
pub fn is_picking() -> bool {
    IS_PICKING.load(Ordering::SeqCst)
}

/// 取消拾取模式
pub fn cancel_picking() {
    IS_PICKING.store(false, Ordering::SeqCst);
}

/// 阻塞式全局鼠标拾取循环（在后台异步线程中运行）
pub fn pick_window_blocking() -> Result<Option<PickedProcessInfo>, String> {
    IS_PICKING.store(true, Ordering::SeqCst);

    // 延时等待鼠标左键释放，防止直接捕获点击“拾取窗口”按钮时的旧按键事件
    thread::sleep(Duration::from_millis(250));

    let current_pid = std::process::id();

    loop {
        if !IS_PICKING.load(Ordering::SeqCst) {
            return Ok(None);
        }

        unsafe {
            // 1. 检测 Esc 键取消
            if (GetAsyncKeyState(VK_ESCAPE as i32) as u16 & 0x8000) != 0 {
                IS_PICKING.store(false, Ordering::SeqCst);
                return Ok(None);
            }

            // 2. 检测鼠标右键取消
            if (GetAsyncKeyState(VK_RBUTTON as i32) as u16 & 0x8000) != 0 {
                IS_PICKING.store(false, Ordering::SeqCst);
                return Ok(None);
            }

            // 3. 检测鼠标左键点击
            if (GetAsyncKeyState(VK_LBUTTON as i32) as u16 & 0x8000) != 0 {
                let mut pt: POINT = std::mem::zeroed();
                GetCursorPos(&mut pt);

                let hwnd = WindowFromPoint(pt);
                if !hwnd.is_null() {
                    let root_hwnd = GetAncestor(hwnd, GA_ROOT);
                    let target_hwnd = if root_hwnd.is_null() { hwnd } else { root_hwnd };

                    let mut pid: u32 = 0;
                    GetWindowThreadProcessId(target_hwnd, &mut pid);

                    if pid != 0 {
                        // 排除自身 PID
                        if pid == current_pid {
                            thread::sleep(Duration::from_millis(150));
                            continue;
                        }

                        if let Some(proc_name) = get_process_name_by_pid(pid) {
                            // 排除自身可执行文件名
                            if proc_name.eq_ignore_ascii_case("iox.exe") {
                                thread::sleep(Duration::from_millis(150));
                                continue;
                            }

                            // 获取窗口标题
                            let mut title_buf = [0u16; 512];
                            let mut len = GetWindowTextW(target_hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
                            if len == 0 && target_hwnd != hwnd {
                                // 若根窗口无标题，尝试读取子窗口标题
                                len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
                            }

                            let window_title = if len > 0 {
                                String::from_utf16_lossy(&title_buf[..len as usize])
                            } else {
                                proc_name.clone()
                            };

                            IS_PICKING.store(false, Ordering::SeqCst);
                            return Ok(Some(PickedProcessInfo {
                                process_name: proc_name,
                                window_title,
                            }));
                        }
                    }
                }
            }
        }

        thread::sleep(Duration::from_millis(20));
    }
}

/// 根据 PID 获取进程文件名（如 "notepad.exe"）
pub fn get_process_name_by_pid(pid: u32) -> Option<String> {
    unsafe {
        let h_proc = windows_sys::Win32::System::Threading::OpenProcess(
            windows_sys::Win32::System::Threading::PROCESS_QUERY_LIMITED_INFORMATION,
            0,
            pid,
        );
        if h_proc.is_null() {
            return None;
        }

        let mut buffer = [0u16; 1024];
        let mut size = buffer.len() as u32;
        let ok = windows_sys::Win32::System::Threading::QueryFullProcessImageNameW(
            h_proc,
            0,
            buffer.as_mut_ptr(),
            &mut size,
        );
        CloseHandle(h_proc);

        if ok != 0 && size > 0 {
            let full_path = String::from_utf16_lossy(&buffer[..size as usize]);
            Path::new(&full_path)
                .file_name()
                .and_then(|f| f.to_str())
                .map(|s| s.to_string())
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cancel_picking_flag() {
        IS_PICKING.store(true, Ordering::SeqCst);
        assert!(is_picking());
        cancel_picking();
        assert!(!is_picking());
    }

    #[test]
    fn test_serialization() {
        let info = PickedProcessInfo {
            process_name: "Code.exe".to_string(),
            window_title: "IOX - Visual Studio Code".to_string(),
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"processName\":\"Code.exe\""));
        assert!(json.contains("\"windowTitle\":\"IOX - Visual Studio Code\""));
    }
}
