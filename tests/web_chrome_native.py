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
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
output = root / 'docs/verification/web-chrome/native'
profile = output / 'profile'
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
    else:
        assert content_rect[2] == width and content_rect[3] < height
        assert toolbar_rect[2] == width and toolbar_rect[3] == height - content_rect[3]
        assert frame_top > frame_left + 10, ('Windows titlebar was not restored', frame_left, frame_top)
    return {'title': title, 'client': [width, height], 'frame': [frame_left, frame_top], 'toolbar': toolbar_rect, 'content': content_rect}


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
    process = subprocess.Popen([str(root / 'src-tauri/target/debug/iox.exe')], cwd=root, env=environment,
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
            local_pages = [page for page in context.pages if 'localhost:1420' in page.url]
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
            (output / 'result.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
            browser.close()
        print('Native Windows checks passed: full content, local toolbar Z order, live decorations, preserved input, maximize/restore, minimize anchor, caller validation, Hub add/switch/close-last/reopen.')
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        server.shutdown()
