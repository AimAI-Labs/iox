"""Windows smoke test with an isolated IOX profile and a local-only website.

Build first: cargo build --manifest-path src-tauri/Cargo.toml --bin iox
Run: uv run --offline --with playwright python tests/web_chrome_native.py
"""
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
output = root / 'docs/verification/web-chrome/native'
profile = output / 'profile'
binary = Path(os.environ.get('IOX_NATIVE_TEST_BINARY', str(root / 'src-tauri/target/debug/iox.exe')))
(profile / '.iox-dev').mkdir(parents=True, exist_ok=True)
user32 = ctypes.WinDLL('user32', use_last_error=True)
user32.SetProcessDPIAware()
callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
user32.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]
user32.EnumChildWindows.argtypes = [wintypes.HWND, callback_type, wintypes.LPARAM]
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
user32.GetParent.argtypes = [wintypes.HWND]
user32.GetParent.restype = wintypes.HWND
user32.GetWindow.argtypes = [wintypes.HWND, wintypes.UINT]
user32.GetWindow.restype = wintypes.HWND
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.ClientToScreen.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.POINT)]
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
user32.GetWindowLongW.restype = wintypes.LONG
user32.GetForegroundWindow.restype = wintypes.HWND
user32.SetForegroundWindow.argtypes = [wintypes.HWND]
user32.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
user32.SetCursorPos.argtypes = [ctypes.c_int, ctypes.c_int]
user32.WindowFromPoint.argtypes = [wintypes.POINT]
user32.WindowFromPoint.restype = wintypes.HWND
user32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
user32.GetAncestor.restype = wintypes.HWND
user32.GetAsyncKeyState.argtypes = [ctypes.c_int]
user32.GetAsyncKeyState.restype = wintypes.SHORT
user32.mouse_event.argtypes = [wintypes.DWORD, wintypes.DWORD, wintypes.DWORD, wintypes.DWORD, ctypes.c_size_t]
gdi32 = ctypes.WinDLL('gdi32', use_last_error=True)
gdi32.CreateRectRgn.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int]
gdi32.CreateRectRgn.restype = wintypes.HRGN
gdi32.PtInRegion.argtypes = [wintypes.HRGN, ctypes.c_int, ctypes.c_int]
gdi32.DeleteObject.argtypes = [wintypes.HANDLE]
user32.GetWindowRgn.argtypes = [wintypes.HWND, wintypes.HRGN]
dwm = ctypes.WinDLL('dwmapi', use_last_error=True)
dwm.DwmGetWindowAttribute.argtypes = [wintypes.HWND, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD]
dwm.DwmGetWindowAttribute.restype = wintypes.LONG


class Site(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'<title>IOX native test site</title><body style="background:#e6edf5"><h1>Native smoke test</h1><input value="Preserved conversation" aria-label="Conversation"></body>'
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def text(hwnd, class_name=False):
    value = ctypes.create_unicode_buffer(512)
    (user32.GetClassNameW if class_name else user32.GetWindowTextW)(hwnd, value, len(value))
    return value.value


def native_window(pid, title):
    matches = []

    @callback_type
    def collect(hwnd, _):
        owner = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
        if owner.value == pid and text(hwnd) == title:
            matches.append(hwnd)
        return True

    user32.EnumWindows(collect, 0)
    assert len(matches) == 1, (title, len(matches))
    return matches[0]


def rect(hwnd, client=False):
    value = wintypes.RECT()
    assert (user32.GetClientRect if client else user32.GetWindowRect)(hwnd, ctypes.byref(value))
    return (value.left, value.top, value.right - value.left, value.bottom - value.top)


def inspect_window(pid, title, headless):
    hwnd = native_window(pid, title)
    children = []

    @callback_type
    def collect(child, _):
        if user32.GetParent(child) == hwnd and text(child, True) == 'WRY_WEBVIEW':
            children.append(child)
        return True

    user32.EnumChildWindows(hwnd, collect, 0)
    assert len(children) >= 2, [(text(child, True), rect(child)) for child in children]
    _, _, width, height = rect(hwnd, True)
    origin = wintypes.POINT(0, 0)
    assert user32.ClientToScreen(hwnd, ctypes.byref(origin))
    outer = rect(hwnd)
    frame_left, frame_top = origin.x - outer[0], origin.y - outer[1]
    # Top sibling must be the local toolbar; new Hub child views must not cover it.
    toolbar = user32.GetWindow(hwnd, 5)  # GW_CHILD, first in sibling Z order
    while toolbar and toolbar not in children:
        toolbar = user32.GetWindow(toolbar, 2)  # GW_HWNDNEXT
    assert toolbar, 'Missing local toolbar child'
    toolbar_rect = rect(toolbar)
    contents = [child for child in children if child != toolbar and rect(child)[0] > -10000]
    assert len(contents) == 1, [rect(child) for child in children]
    content_rect = rect(contents[0])
    if headless:
        assert content_rect[2:] == (width, height), (content_rect, (width, height))
        assert toolbar_rect[2] < width, (toolbar_rect, width)
        # Tao retains WS_CAPTION for top-level windows and removes the nonclient area
        # through WM_NCCALCSIZE. Verify the actual client origin, not just style bits.
        assert frame_top <= frame_left + 2, ('Headless window retained a titlebar', frame_left, frame_top)
        region = gdi32.CreateRectRgn(0, 0, 0, 0)
        try:
            assert user32.GetWindowRgn(contents[0], region) > 0, 'Headless page needs a rounded native clip'
            assert not gdi32.PtInRegion(region, 0, 0), 'Top-left corner remained square'
            assert not gdi32.PtInRegion(region, width - 1, 0), 'Top-right corner remained square'
            assert not gdi32.PtInRegion(region, 0, height - 1), 'Bottom-left corner remained square'
            assert not gdi32.PtInRegion(region, width - 1, height - 1), 'Bottom-right corner remained square'
            assert gdi32.PtInRegion(region, width // 2, height // 2), 'Rounded clip removed page content'
        finally:
            gdi32.DeleteObject(region)
        if sys.getwindowsversion().build >= 22000:
            preference = wintypes.DWORD()
            assert dwm.DwmGetWindowAttribute(hwnd, 33, ctypes.byref(preference), ctypes.sizeof(preference)) == 0
            assert preference.value == 2, 'Headless window must opt into DWM rounded corners'
    else:
        assert content_rect[2] == width and content_rect[3] < height
        assert toolbar_rect[2] == width and toolbar_rect[3] == height - content_rect[3]
        assert frame_top > frame_left + 10, ('Windows titlebar was not restored', frame_left, frame_top)
    return {'title': title, 'client': [width, height], 'frame': [frame_left, frame_top], 'toolbar': toolbar_rect, 'content': content_rect}


def hold_and_drag_window(pid, title, delay_ms, direct=False):
    """Inject a real held mouse only after verifying the point belongs to our test process."""
    assert not user32.GetAsyncKeyState(1) & 0x8000, 'A user mouse gesture is already in progress'
    hwnd = native_window(pid, title)
    original_cursor = wintypes.POINT()
    user32.GetCursorPos(ctypes.byref(original_cursor))
    before = rect(hwnd)
    snapshot = inspect_window(pid, title, True)
    x, y, width, height = snapshot['toolbar']
    point = wintypes.POINT(x + width // 2, y + height // 2)
    pressed = False
    try:
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.15)
        assert user32.GetAncestor(user32.WindowFromPoint(point), 2) == hwnd, 'Test window is occluded; no input sent'
        user32.SetCursorPos(point.x, point.y)
        user32.mouse_event(0x0002, 0, 0, 0, 0)  # MOUSEEVENTF_LEFTDOWN
        pressed = True
        if direct:
            # Move past the pointer threshold first; native dragging anchors at this point.
            user32.SetCursorPos(point.x + 8, point.y)
            point.x += 8
            time.sleep(0.15)
        else:
            time.sleep(delay_ms / 1000 + 0.15)
        user32.SetCursorPos(point.x + 120, point.y + 70)
        time.sleep(0.15)
        user32.mouse_event(0x0004, 0, 0, 0, 0)  # MOUSEEVENTF_LEFTUP
        pressed = False
        time.sleep(0.15)
        after = rect(hwnd)
        assert abs(after[0] - before[0] - 120) <= 2 and abs(after[1] - before[1] - 70) <= 2, (before, after)
        assert before[2:] == after[2:], 'Window drag unexpectedly changed card size'
        return {'windowDrag': {'delayMs': delay_ms, 'direct': direct, 'before': before, 'after': after}}
    finally:
        if pressed:
            user32.mouse_event(0x0004, 0, 0, 0, 0)
        user32.SetCursorPos(original_cursor.x, original_cursor.y)


server = ThreadingHTTPServer(('127.0.0.1', 0), Site)
threading.Thread(target=server.serve_forever, daemon=True).start()
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    debug_port = sock.getsockname()[1]
config = json.loads((root / 'tests/fixtures/config/default-config.zh.json').read_text(encoding='utf-8'))
config['general'].update(autoPopupOnSelection=False, autoPopupOnFileSelection=False,
    enableFloatingBall=False, webHeadlessMode=True, uiStyle='windows', language='en', globalHotkey='Ctrl+Alt+Shift+F12')
config['actions'] = [dict(id=name.lower(), name=f'IOX Native {name}', icon='Globe', actionType='web', enabled=True,
    urlTemplate=f'http://127.0.0.1:{server.server_port}/{name}', useUrlTemplate=True) for name in ['Alpha', 'Beta']]
(profile / '.iox-dev/config.json').write_text(json.dumps(config), encoding='utf-8')
environment = os.environ.copy()
environment.update(USERPROFILE=str(profile), HOME=str(profile), IOX_ENV='dev',
    LOCALAPPDATA=str(profile / 'AppData/Local'), APPDATA=str(profile / 'AppData/Roaming'),
    WEBVIEW2_USER_DATA_FOLDER=str(profile / 'webview'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=f'--remote-debugging-port={debug_port}')
startup = subprocess.STARTUPINFO()
startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
startup.wShowWindow = 0
results = []
with (output / 'app.log').open('w', encoding='utf-8') as log:
    process = subprocess.Popen([str(binary)], cwd=root, env=environment,
        stdout=log, stderr=log, startupinfo=startup, creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        endpoint = f'http://127.0.0.1:{debug_port}'
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError(f'Isolated IOX exited: {process.returncode}; inspect {output / "app.log"}')
            try:
                urllib.request.urlopen(endpoint + '/json/version', timeout=0.5).close()
                break
            except OSError:
                time.sleep(0.1)
        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(endpoint)
            context = browser.contexts[0]
            local_pages = []
            for _ in range(100):
                local_pages = [page for page in context.pages if 'localhost:1420' in page.url]
                if local_pages:
                    break
                time.sleep(0.1)
            assert local_pages, [page.url for page in context.pages]
            main = next((page for page in local_pages if page.evaluate('window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label') == 'main'), local_pages[0])
            assert main.evaluate('typeof window.__TAURI_INTERNALS__?.invoke === "function"')
            invoke = lambda page, command, args={}: page.evaluate('([command,args]) => window.__TAURI_INTERNALS__.invoke(command,args)', [command, args])
            invoke(main, 'trigger_web_action', {'actionId': 'alpha', 'text': '', 'copyToClipboard': False})
            for _ in range(100):
                pages = context.pages
                bars = [page for page in pages if 'view=web_titlebar' in page.url and 'web_win_alpha' in page.url]
                sites = [page for page in pages if page.url.startswith(f'http://127.0.0.1:{server.server_port}/Alpha')]
                if bars and sites:
                    break
                main.wait_for_timeout(100)
            bar, site = bars[0], sites[0]
            bar.wait_for_selector('.web-menu-trigger')
            site.get_by_role('textbox').fill('Keep native conversation')
            bar.locator('.web-menu-trigger').click()
            expect(bar.get_by_role('dialog')).to_be_visible()
            main.wait_for_timeout(150)
            results.append(inspect_window(process.pid, 'IOX Native Alpha', True))
            try:
                invoke(main, 'layout_web_menu', {'expanded': True})
                raise AssertionError('Settings view must not control a Web menu')
            except Exception as error:
                assert 'owning local Web toolbar' in str(error), error
            invoke(bar, 'toggle_maximize_web_window', {'label': 'web_win_alpha'})
            assert invoke(main, 'plugin:window|is_maximized', {'label': 'web_win_alpha'})
            invoke(bar, 'toggle_maximize_web_window', {'label': 'web_win_alpha'})
            assert not invoke(main, 'plugin:window|is_maximized', {'label': 'web_win_alpha'})
            invoke(bar, 'layout_web_menu', {'expanded': False})
            invoke(main, 'show_main_window', {'targetTab': 'web'})
            main.get_by_role('navigation').get_by_role('button', name='Web Hub', exact=True).click()
            delay_field = main.get_by_role('spinbutton', name='Window drag hold delay', exact=True)
            expect(delay_field).to_have_value('300')
            delay_field.fill('175')
            expect(delay_field).to_have_value('175')
            delay_field.press('Control+s')
            for _ in range(50):
                saved_delay = invoke(main, 'get_config')['general']['webDragHoldDelayMs']
                if saved_delay == 175:
                    break
                main.wait_for_timeout(100)
            assert saved_delay == 175, ('Ctrl+S saved an old draft', saved_delay)
            disk_delay = json.loads((profile / '.iox-dev/config.json').read_text(encoding='utf-8'))['general']['webDragHoldDelayMs']
            assert disk_delay == 175, ('Ctrl+S did not persist the new delay', disk_delay)
            main.screenshot(path=str(output / 'settings-hold-delay.png'))
            config['general']['webDragHoldDelayMs'] = 175
            expect(bar.locator('.web-menu-trigger')).to_have_attribute('aria-label', 'Click for menu, drag to move menu, hold 175 ms to move window')
            menu_before_drag = invoke(bar, 'get_web_chrome')['menu']
            results.append(hold_and_drag_window(process.pid, 'IOX Native Alpha', 175))
            expect(bar.locator('.web-menu-trigger')).to_have_attribute('aria-expanded', 'false')
            assert invoke(bar, 'get_web_chrome')['menu'] == menu_before_drag, 'Window drag moved only the floating menu'
            bar.locator('.web-menu-trigger').click()
            direct_toggle = bar.get_by_role('button', name='Drag whole card', exact=True)
            expect(direct_toggle).to_have_attribute('aria-pressed', 'false')
            direct_toggle.click()
            expect(direct_toggle).to_have_attribute('aria-pressed', 'true')
            bar.screenshot(path=str(output / 'direct-drag-toggle.png'))
            bar.locator('.web-menu-trigger').click()
            menu_before_drag = invoke(bar, 'get_web_chrome')['menu']
            results.append(hold_and_drag_window(process.pid, 'IOX Native Alpha', 0, direct=True))
            expect(bar.locator('.web-menu-trigger')).to_have_attribute('aria-expanded', 'false')
            assert invoke(bar, 'get_web_chrome')['menu'] == menu_before_drag, 'Direct drag moved only the floating menu'
            bar.locator('.web-menu-trigger').click()
            expect(direct_toggle).to_have_attribute('aria-pressed', 'true')
            direct_toggle.click()
            bar.locator('.web-menu-trigger').click()
            expect(bar.locator('.web-menu-trigger')).to_have_attribute('aria-label', 'Click for menu, drag to move menu, hold 175 ms to move window')
            before = invoke(bar, 'get_web_chrome')['menu']
            invoke(bar, 'minimize_web_window', {'label': 'web_win_alpha'})
            main.wait_for_timeout(100)
            invoke(main, 'plugin:window|unminimize', {'label': 'web_win_alpha'})
            main.wait_for_timeout(100)
            after = invoke(bar, 'get_web_chrome')['menu']
            assert after == before, ('Minimize changed the menu anchor', before, after)
            layout = invoke(bar, 'layout_web_menu', {'expanded': False, 'position': [-500, 10000]})
            assert layout['menu']['x'] >= 0 and layout['menu']['y'] >= 0
            config['general']['webHeadlessMode'] = False
            invoke(main, 'save_config', {'newConfig': config})
            bar.wait_for_selector('.web-titlebar-root')
            expect(site.get_by_role('textbox')).to_have_value('Keep native conversation')
            main.wait_for_timeout(150)
            results.append(inspect_window(process.pid, 'IOX Native Alpha', False))
            config['general'].update(webHeadlessMode=True, webWindowMode='tabbed')
            invoke(main, 'save_config', {'newConfig': config})
            for action in ['alpha', 'beta']:
                invoke(main, 'trigger_web_action', {'actionId': action, 'text': '', 'copyToClipboard': False})
            for _ in range(100):
                bars = [page for page in context.pages if 'view=web_titlebar' in page.url and 'label=web_hub' in page.url]
                if bars:
                    break
                main.wait_for_timeout(100)
            hub = bars[0]
            hub.wait_for_selector('.web-menu-trigger')
            hub.locator('.web-menu-trigger').click()
            expect(hub.locator('.web-menu-tab')).to_have_count(2)
            main.wait_for_timeout(150)
            results.append(inspect_window(process.pid, 'IOX Web Hub', True))
            invoke(hub, 'switch_web_hub_tab', {'actionId': 'alpha'})
            invoke(hub, 'close_web_hub_tab', {'actionId': 'beta'})
            invoke(hub, 'close_web_hub_tab', {'actionId': 'alpha'})
            invoke(main, 'trigger_web_action', {'actionId': 'beta', 'text': '', 'copyToClipboard': False})
            hub.wait_for_selector('.web-menu-trigger')
            main.wait_for_timeout(150)
            results.append(inspect_window(process.pid, 'IOX Web Hub', True))
            config['general']['uiStyle'] = 'classic'
            invoke(main, 'save_config', {'newConfig': config})
            main.wait_for_timeout(150)
            results.append(inspect_window(process.pid, 'IOX Web Hub', True))
            (output / 'result.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
            browser.close()
        print('Native Windows checks passed: direct-drag toggle moving the real window, rounded corners, live-configured 175ms hold, full content, toolbar Z order, live mode, preserved input, maximize/restore, minimize anchor, caller validation, Hub reopen.')
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        server.shutdown()
