//! 触发闸门：任意输入 adapter 共用的「这次输入该不该响应」判定。
//!
//! 修饰键与前台进程过滤是两个输入 adapter 都要的同一套规则；放在任一侧都会
//! 让两个 adapter 互相引用。闸门只依赖 Win32 查询，不依赖任何输入 adapter。

use windows_sys::Win32::Foundation::CloseHandle;
use windows_sys::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_CONTROL, VK_MENU, VK_SHIFT,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

/// 本程序自身的进程名：焦点在自己身上时不响应全局输入。
const SELF_PROCESS: &str = "iox.exe";

/// 检查触发修饰键是否满足条件。
pub fn modifier_satisfied(modifier: &str) -> bool {
    let key_down = |vk: u16| (unsafe { GetAsyncKeyState(vk as i32) } as u16 & 0x8000) != 0;
    match modifier.to_lowercase().as_str() {
        "ctrl" => key_down(VK_CONTROL),
        "alt" => key_down(VK_MENU),
        "shift" => key_down(VK_SHIFT),
        _ => true, // "none" 或其他值默认无修饰键要求
    }
}

/// 前台进程是否命中黑名单或就是本程序；读取不到进程名时不拦截。
pub fn foreground_blocked(blacklist: &[String]) -> bool {
    foreground_process_name().is_some_and(|name| is_blocked(&name, blacklist))
}

fn is_blocked(name: &str, blacklist: &[String]) -> bool {
    name.eq_ignore_ascii_case(SELF_PROCESS)
        || blacklist
            .iter()
            .any(|entry| entry.eq_ignore_ascii_case(name))
}

/// 获取当前前台窗口所属的进程文件名（如 "notepad.exe", "chrome.exe"）
pub fn foreground_process_name() -> Option<String> {
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

        let h_proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h_proc.is_null() {
            return None;
        }

        let mut buffer = [0u16; 1024];
        let mut size = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(h_proc, 0, buffer.as_mut_ptr(), &mut size);
        CloseHandle(h_proc);

        if ok != 0 && size > 0 {
            let full_path = String::from_utf16_lossy(&buffer[..size as usize]);
            return std::path::Path::new(&full_path)
                .file_name()
                .and_then(|name| name.to_str())
                .map(str::to_string);
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_modifier_means_no_requirement() {
        assert!(modifier_satisfied("none"));
        assert!(modifier_satisfied(""));
    }

    #[test]
    fn self_process_and_blacklist_match_case_insensitively() {
        let blacklist = vec!["Code.exe".to_string()];
        assert!(is_blocked("iox.exe", &blacklist));
        assert!(is_blocked("code.EXE", &blacklist));
        assert!(is_blocked("IOX.EXE", &[]));
        assert!(!is_blocked("chrome.exe", &blacklist));
    }
}
