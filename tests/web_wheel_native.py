"""Isolated Windows/WebView2 wheel smoke; all input stays inside CDP.

Run: uv run --offline --with playwright python tests/web_wheel_native.py
Set IOX_NATIVE_TEST_BINARY or --binary to a fresh debug executable. The default
is target/debug/examples/web_wheel_smoke.exe, built from a temporary example
containing `fn main() { iox_lib::run(); }`. Link the generated Tauri resource.lib
into the example too: tauri-build only adds Windows manifest resources to bins.
Remove that example source afterward.
The existing Vite server must serve http://localhost:1420.
WebView2 CDP ignores pointer moves outside a child viewport, so independent hover
cases reload only the local toolbar to reset hover bookkeeping. The source page
must retain its instance, input and native child HWND throughout those cases.
"""

import argparse
import ctypes
from ctypes import wintypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import socket
import subprocess
import threading
import time
import urllib.request

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PINS = ["reload", "openExternal", "history", "minimize"]
FINAL_PINS = ["openExternal", "history", "minimize", "settings"]
HOVER_PAINT_SAMPLES = []
USER32 = ctypes.WinDLL("user32", use_last_error=True)
GDI32 = ctypes.WinDLL("gdi32", use_last_error=True)
CALLBACK = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
USER32.SetProcessDPIAware()
USER32.EnumWindows.argtypes = [CALLBACK, wintypes.LPARAM]
USER32.EnumChildWindows.argtypes = [wintypes.HWND, CALLBACK, wintypes.LPARAM]
USER32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
USER32.GetParent.argtypes = [wintypes.HWND]
USER32.GetParent.restype = wintypes.HWND
USER32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
USER32.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
USER32.ClientToScreen.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.POINT)]
USER32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
USER32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
USER32.GetDpiForWindow.argtypes = [wintypes.HWND]
USER32.GetDpiForWindow.restype = wintypes.UINT
USER32.IsWindowVisible.argtypes = [wintypes.HWND]
USER32.IsWindowVisible.restype = wintypes.BOOL
USER32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]
USER32.SetWindowPos.restype = wintypes.BOOL
USER32.GetWindowRgn.argtypes = [wintypes.HWND, wintypes.HANDLE]
GDI32.CreateRectRgn.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int]
GDI32.CreateRectRgn.restype = wintypes.HANDLE
GDI32.GetRgnBox.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.RECT)]
GDI32.DeleteObject.argtypes = [wintypes.HANDLE]


class Site(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b"""<!doctype html><meta charset="utf-8">
        <title>Owned IOX wheel smoke page</title>
        <body style="background:#e6edf5"><h1>Owned native wheel smoke</h1>
        <input aria-label="Conversation" value="Initial conversation">
        <script>window.nativeSmokeInstance = crypto.randomUUID();</script></body>"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def unused_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def invoke(page, command, args=None):
    return page.evaluate(
        "([command,args]) => window.__TAURI_INTERNALS__.invoke(command,args)",
        [command, args or {}],
    )


def wait_for(probe, message, timeout=20, pump=None):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = probe()
        if result:
            return result
        # Playwright's synchronous event queue advances during its API calls.
        # Polling only cached context.pages with time.sleep misses newly created views.
        if pump is not None:
            pump()
        else:
            time.sleep(0.1)
    raise AssertionError(message)


def window_text(hwnd, class_name=False):
    buffer = ctypes.create_unicode_buffer(512)
    getter = USER32.GetClassNameW if class_name else USER32.GetWindowTextW
    getter(hwnd, buffer, len(buffer))
    return buffer.value


def native_window(pid, title):
    matches = []

    @CALLBACK
    def collect(hwnd, _):
        owner = wintypes.DWORD()
        USER32.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
        if owner.value == pid and window_text(hwnd) == title:
            matches.append(hwnd)
        return True

    USER32.EnumWindows(collect, 0)
    assert len(matches) == 1, (title, matches)
    return matches[0]


def rectangle(hwnd, client=False):
    value = wintypes.RECT()
    getter = USER32.GetClientRect if client else USER32.GetWindowRect
    assert getter(hwnd, ctypes.byref(value))
    return [value.left, value.top, value.right - value.left, value.bottom - value.top]


def close_rect(actual, expected, tolerance=2):
    return all(abs(a - b) <= tolerance for a, b in zip(actual, expected))


def native_layout(pid, title, page):
    layout = invoke(page, "get_web_chrome")
    menu = layout["menu"]
    hwnd = native_window(pid, title)
    scale = USER32.GetDpiForWindow(hwnd) / 96
    client = rectangle(hwnd, client=True)
    origin = wintypes.POINT()
    assert USER32.ClientToScreen(hwnd, ctypes.byref(origin))
    children = []

    @CALLBACK
    def collect(child, _):
        if USER32.GetParent(child) == hwnd and window_text(child, True) == "WRY_WEBVIEW":
            children.append(child)
        return True

    USER32.EnumChildWindows(hwnd, collect, 0)
    expected_toolbar = [
        origin.x + round(menu["x"] * scale),
        origin.y + round(menu["y"] * scale),
        round(menu["width"] * scale),
        round(menu["height"] * scale),
    ]
    bars = [child for child in children if close_rect(rectangle(child), expected_toolbar)]
    assert len(bars) == 1, ("Native toolbar bounds", expected_toolbar, [rectangle(child) for child in children])
    contents = [child for child in children if child != bars[0] and rectangle(child)[0] > -10000]
    assert len(contents) == 1, ("Visible source views", [rectangle(child) for child in children])
    content_rect = rectangle(contents[0])
    assert close_rect(content_rect, [origin.x, origin.y, client[2], client[3]])
    toolbar_rect = rectangle(bars[0])
    region = GDI32.CreateRectRgn(0, 0, 0, 0)
    assert region
    try:
        clipped = USER32.GetWindowRgn(bars[0], region) != 0
        clip = wintypes.RECT()
        if clipped:
            assert GDI32.GetRgnBox(region, ctypes.byref(clip)) != 0
        expected_clip = [round(menu['buttonX'] * scale), round(menu['buttonY'] * scale),
                         round(min(44, menu['width']) * scale), round(min(44, menu['height']) * scale)]
        if not menu['expanded'] and not menu['wheel']:
            assert clipped and close_rect([clip.left, clip.top, clip.right-clip.left, clip.bottom-clip.top], expected_clip), 'Collapsed canvas must clip drawing and hit testing to the button'
        else:
            assert not clipped, 'Open menu must clear the collapsed button region'
    finally:
        GDI32.DeleteObject(region)
    trigger = page.locator(".web-menu-trigger").bounding_box()
    assert trigger is not None
    button_screen = [toolbar_rect[0] + trigger["x"] * scale, toolbar_rect[1] + trigger["y"] * scale]
    expected_button = [origin.x + (menu["x"] + menu["buttonX"]) * scale,
                       origin.y + (menu["y"] + menu["buttonY"]) * scale]
    button_center = [button_screen[0] + trigger['width'] * scale / 2, button_screen[1] + trigger['height'] * scale / 2]
    expected_center = [expected_button[0] + min(44, menu['width']) * scale / 2,
                       expected_button[1] + min(44, menu['height']) * scale / 2]
    assert close_rect(button_center, expected_center), ("DOM/native button anchor", button_center, expected_center)
    return dict(menu=menu, toolbar=toolbar_rect, buttonScreen=button_screen,
                buttonCenter=button_center,
                content=content_rect, contentHwnd=int(contents[0]), toolbarHwnd=int(bars[0]),
                window=rectangle(hwnd), logicalClient=[client[2] / scale, client[3] / scale], scale=scale)


def source_state(page):
    return page.evaluate("({instance:window.nativeSmokeInstance,url:location.href,input:document.querySelector('input').value})")


def assert_rejected(page, command, args, expected):
    result = page.evaluate("""async ([command,args]) => {
      try { await window.__TAURI_INTERNALS__.invoke(command,args); return {accepted:true}; }
      catch (error) { return {accepted:false,error:String(error)}; }
    }""", [command, args])
    assert not result["accepted"] and expected in result["error"], result


class App:
    def __init__(self, binary, profile, output, generation):
        self.port = unused_port()
        self.endpoint = f"http://127.0.0.1:{self.port}"
        self.log = (output / f"app-{generation}.log").open("w", encoding="utf-8")
        environment = os.environ.copy()
        environment.update(
            USERPROFILE=str(profile), HOME=str(profile), IOX_ENV="dev",
            LOCALAPPDATA=str(profile / "AppData/Local"), APPDATA=str(profile / "AppData/Roaming"),
            WEBVIEW2_USER_DATA_FOLDER=str(profile / "webview"),
            WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=f"--remote-debugging-port={self.port} --remote-debugging-address=127.0.0.1",
        )
        startup = subprocess.STARTUPINFO()
        startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startup.wShowWindow = 0
        self.process = subprocess.Popen([str(binary)], cwd=ROOT, env=environment,
                                        stdout=self.log, stderr=self.log, startupinfo=startup,
                                        creationflags=subprocess.CREATE_NO_WINDOW)

    def ready(self):
        def probe():
            assert self.process.poll() is None, f"Owned test app exited {self.process.returncode}"
            try:
                with urllib.request.urlopen(self.endpoint + "/json/version", timeout=0.5):
                    return True
            except OSError:
                return False
        wait_for(probe, "Owned WebView2 CDP endpoint did not start", timeout=30)

    def close(self):
        # Never enumerate/terminate unrelated apps or WebView2 processes.
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        self.log.close()


def find_main(context):
    def probe():
        for page in context.pages:
            if page.url.startswith("http://localhost:1420") and page.evaluate(
                "window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label"
            ) == "main":
                # Cached frontend files can expose the bridge before Rust setup
                # has registered AppState after creating the static WebViews.
                try:
                    invoke(page, "get_config")
                except Exception as error:
                    if "state not managed" in str(error):
                        continue
                    raise
                return page
        return None
    try:
        return wait_for(probe, "Owned settings WebView not found", pump=lambda:
            context.pages[0].wait_for_timeout(100) if context.pages else time.sleep(0.1))
    except AssertionError:
        print("CDP target diagnostics: " + json.dumps([
            dict(url=page.url, title=page.title(), metadata=page.evaluate(
                "window.__TAURI_INTERNALS__?.metadata ?? null")) for page in context.pages
        ]))
        raise


def open_card(context, main, action_id, site_url):
    invoke(main, "trigger_web_action", dict(actionId=action_id, text="", copyToClipboard=False))

    def probe():
        bars = [page for page in context.pages if "view=web_titlebar" in page.url and f"label=web_win_{action_id}" in page.url]
        sites = [page for page in context.pages if page.url == site_url]
        return (bars[0], sites[0]) if bars and sites else None

    bar, site = wait_for(probe, f"Owned card {action_id} not found", pump=lambda: main.wait_for_timeout(100))
    bar.emulate_media(reduced_motion="reduce")
    bar.locator(".web-menu-trigger").wait_for()
    bar.evaluate("""() => {
      window.nativeWheelTrace = [];
      for (const type of ['pointerenter','pointerleave','pointermove','focus','blur']) {
        window.addEventListener(type, event => {
          window.nativeWheelTrace.push({type, target:event.target?.className,
            x:event.clientX,y:event.clientY,focused:document.hasFocus(),time:performance.now()});
          if (window.nativeWheelTrace.length > 100) window.nativeWheelTrace.shift();
        }, true);
      }
    }""")
    site.get_by_role("textbox", name="Conversation").wait_for()
    return bar, site


def collapse(bar):
    bar.mouse.move(-10, -10)
    invoke(bar, "layout_web_menu", dict(expanded=False))
    expect(bar.locator(".web-floating-menu")).to_have_attribute("data-wheel", "false")
    expect(bar.locator(".web-menu-trigger")).to_have_attribute("aria-expanded", "false")


def short_window_menu_cases(pid, title, bar, output):
    hwnd = native_window(pid, title)
    original = rectangle(hwnd)
    client = rectangle(hwnd, client=True)
    scale = USER32.GetDpiForWindow(hwnd) / 96
    frame_width, frame_height = original[2] - client[2], original[3] - client[3]

    def resize(height):
        # Only resize this test-owned window; never inject OS pointer/keyboard input.
        assert USER32.SetWindowPos(hwnd, None, 0, 0, round(600 * scale) + frame_width,
                                   round(height * scale) + frame_height, 0x0016)
        wait_for(lambda: abs(rectangle(hwnd, client=True)[3] / scale - height) < 1,
                 'Owned test window did not resize', pump=lambda: bar.wait_for_timeout(30))

    results = []
    try:
        resize(400)
        for y, upward in [(180, False), (332, True)]:
            collapse(bar)
            invoke(bar, 'layout_web_menu', dict(expanded=False, wheel=False, position=[300, y]))
            before = native_layout(pid, title, bar)
            bar.locator('.web-menu-trigger').click()
            expect(bar.locator('.web-floating-menu')).to_have_attribute('data-upward', str(upward).lower())
            opened = native_layout(pid, title, bar)
            assert close_rect(before['buttonCenter'], opened['buttonCenter'])
            assert opened['menu']['y'] >= 12 and opened['menu']['y'] + opened['menu']['height'] <= 388
            if not upward:
                assert opened['menu']['height'] == 208
            assert before['contentHwnd'] == opened['contentHwnd']
            assert before['content'] == opened['content']
            bar.locator('[data-action-id="closeWindow"] .web-menu-pin').scroll_into_view_if_needed()
            bar.screenshot(path=str(output / f'menu-anchor-{y}.png'))
            assert close_rect(opened['buttonCenter'], native_layout(pid, title, bar)['buttonCenter'])
            bar.locator('.web-menu-trigger').click()
            restored = native_layout(pid, title, bar)
            assert close_rect(before['buttonCenter'], restored['buttonCenter'])
            results.append(dict(anchor=y, before=before, opened=opened, restored=restored))
        collapse(bar)
        invoke(bar, 'layout_web_menu', dict(expanded=False, wheel=False, position=[300, 180]))
        bar.locator('.web-menu-trigger').click()
        before_resize = native_layout(pid, title, bar)
        resize(300)
        expect(bar.locator('.web-floating-menu')).to_have_attribute('data-upward', 'true')
        resized = native_layout(pid, title, bar)
        assert close_rect(before_resize['buttonCenter'], resized['buttonCenter'])
        assert resized['menu']['height'] == 212
        results.append(dict(beforeResize=before_resize, resized=resized))
        resize(640)
        expect(bar.locator('.web-floating-menu')).to_have_attribute('data-upward', 'false')
        grown = native_layout(pid, title, bar)
        assert close_rect(before_resize['buttonCenter'], grown['buttonCenter'])
        assert grown['menu']['height'] == 360
        resize(80)
        wait_for(lambda: invoke(bar, 'get_web_chrome')['menu']['height'] <= 56,
                 'Menu did not shrink', pump=lambda: bar.wait_for_timeout(30))
        resize(640)
        wait_for(lambda: invoke(bar, 'get_web_chrome')['menu']['height'] == 360,
                 'Menu did not recover after shrinking', pump=lambda: bar.wait_for_timeout(30))
        expect(bar.locator('.web-menu-trigger')).to_be_visible()
        results.append(dict(grown=grown, recovered=native_layout(pid, title, bar)))
        return results
    finally:
        collapse(bar)
        assert USER32.SetWindowPos(hwnd, None, 0, 0, original[2], original[3], 0x0016)
        bar.wait_for_timeout(100)


def open_menu(bar):
    collapse(bar)
    bar.locator(".web-menu-trigger").click()
    expect(bar.get_by_role("dialog")).to_be_visible()


def hover_wheel(bar, count):
    # CDP cannot send the native mouse-leave generated when a physical pointer exits
    # a 44px child WebView. Reset only the local toolbar before each independent case.
    bar.reload(wait_until="networkidle")
    bar.locator(".web-menu-trigger").wait_for()
    bar.bring_to_front()
    bar.evaluate("""() => {
      window.nativeHoverPaint = [];
      const sample = () => {
        const root = document.querySelector('.web-floating-menu');
        const header = root?.querySelector('.web-menu-header');
        if (root && header) window.nativeHoverPaint.push({
          width:innerWidth, expanded:root.dataset.expanded, wheel:root.dataset.wheel,
          background:getComputedStyle(root).backgroundColor,
          headerVisibility:getComputedStyle(header).visibility,
          headerX:header.getBoundingClientRect().x,headerY:header.getBoundingClientRect().y,
          headerWidth:header.getBoundingClientRect().width,
          headerHeight:header.getBoundingClientRect().height
        });
        if (window.nativeHoverPaint.length < 90) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }""")
    bar.mouse.move(-10, -10)
    bar.locator(".web-menu-trigger").hover()
    wheel = bar.get_by_role("menu", name="Quick actions", exact=True)
    try:
        expect(wheel).to_be_visible()
    except AssertionError:
        print("Hover diagnostics: " + json.dumps(bar.evaluate("""() => ({
          trace:window.nativeWheelTrace,focused:document.hasFocus(),visibility:document.visibilityState,
          active:document.activeElement?.className,html:document.querySelector('.web-floating-menu')?.outerHTML
        })""")))
        print("Native hover layout: " + json.dumps(invoke(bar, "get_web_chrome")))
        raise
    expect(wheel.get_by_role("menuitem")).to_have_count(count)
    bar.wait_for_timeout(160)
    samples = bar.evaluate("window.nativeHoverPaint")
    expanded_view = [frame for frame in samples if frame["width"] > 44 and frame["expanded"] == "false"]
    assert expanded_view, "No native hover paint frames captured"
    assert all(frame["background"] == "rgba(0, 0, 0, 0)" for frame in expanded_view), ("Hover paints an opaque enlarged surface", expanded_view)
    assert all(frame["headerWidth"] == 44 and frame["headerHeight"] == 44 for frame in expanded_view), ("Hover stretches button background", expanded_view)
    assert all(frame["headerVisibility"] == "visible" for frame in expanded_view), ("The stationary hover button must remain visible", expanded_view)
    assert len({(frame['headerX'], frame['headerY']) for frame in expanded_view}) == 1, ("Hover changed the button offset", expanded_view)
    HOVER_PAINT_SAMPLES.append(samples)
    return wheel


def disk_config(profile):
    return json.loads((profile / ".iox-dev/config.json").read_text(encoding="utf-8"))


def first_run(playwright, binary, profile, output, site_base):
    app = App(binary, profile, output, 1)
    browser = None
    try:
        app.ready()
        browser = playwright.chromium.connect_over_cdp(app.endpoint)
        context = browser.contexts[0]
        main = find_main(context)
        assert invoke(main, "get_config")["general"]["webMenuPinnedActions"] == DEFAULT_PINS
        initial_disk = disk_config(profile)
        assert_rejected(main, "set_web_menu_action_pinned", dict(actionId="settings", pinned=True), "owning local Web toolbar")
        assert disk_config(profile) == initial_disk
        alpha, source_a = open_card(context, main, "wheel_alpha", site_base + "/Alpha")
        beta, source_b = open_card(context, main, "wheel_beta", site_base + "/Beta")
        source_a.get_by_role("textbox").fill("Owned Alpha conversation")
        source_b.get_by_role("textbox").fill("Owned Beta conversation")
        sources = [(source_a, source_state(source_a)), (source_b, source_state(source_b))]
        collapse(beta)
        menu_anchors = short_window_menu_cases(app.process.pid, "IOX Wheel Native Alpha", alpha, output)
        baseline = native_layout(app.process.pid, "IOX Wheel Native Alpha", alpha)
        width, height = baseline["logicalClient"]
        corners = [[12, 12], [width - 56, 12], [12, height - 56], [width - 56, height - 56]]
        results = []
        for index, position in enumerate(corners):
            collapse(alpha)
            invoke(alpha, "layout_web_menu", dict(expanded=False, wheel=False, position=position))
            before = native_layout(app.process.pid, "IOX Wheel Native Alpha", alpha)
            hover_wheel(alpha, 4)
            opened = native_layout(app.process.pid, "IOX Wheel Native Alpha", alpha)
            assert opened["menu"]["wheel"] and not opened["menu"]["expanded"]
            assert opened["menu"]["width"] == 280 and opened["menu"]["height"] == 280
            assert close_rect(before["buttonScreen"], opened["buttonScreen"])
            assert before["contentHwnd"] == opened["contentHwnd"]
            assert before["toolbarHwnd"] == opened["toolbarHwnd"]
            assert before["toolbar"] == opened["toolbar"], 'Hover must not move or resize the native HWND'
            assert before["window"] == opened["window"] and before["content"] == opened["content"]
            alpha.screenshot(path=str(output / f"wheel-corner-{index}.png"))
            collapse(alpha)
            after = native_layout(app.process.pid, "IOX Wheel Native Alpha", alpha)
            assert close_rect(before["buttonScreen"], after["buttonScreen"])
            assert before["toolbar"] == after["toolbar"], 'Hover collapse must not move or resize the native HWND'
            results.append(dict(corner=position, collapsed=before, wheel=opened, restored=after))
            for source, expected in sources:
                assert source_state(source) == expected, "Wheel hover reloaded or changed source input"

        stale_draft = invoke(main, "get_config")
        settings_hwnd = native_window(app.process.pid, "IOX")
        settings_visible = bool(USER32.IsWindowVisible(settings_hwnd))
        open_menu(alpha)
        settings_pin = alpha.locator('.web-menu-action-row[data-action-id="settings"] .web-menu-pin')
        expect(settings_pin).to_have_attribute("aria-pressed", "false")
        settings_pin.click()
        expect(settings_pin).to_have_attribute("aria-pressed", "true")
        assert bool(USER32.IsWindowVisible(settings_hwnd)) == settings_visible, "Pin click executed Settings"
        assert disk_config(profile)["general"]["webMenuPinnedActions"] == DEFAULT_PINS + ["settings"]
        collapse(alpha)
        peer_wheel = hover_wheel(beta, 5)
        expect(peer_wheel.get_by_role("menuitem", name="Web window settings", exact=True)).to_be_visible()
        collapse(beta)
        open_menu(alpha)
        reload_pin = alpha.locator('.web-menu-action-row[data-action-id="reload"] .web-menu-pin')
        reload_pin.click()
        expect(reload_pin).to_have_attribute("aria-pressed", "false")
        assert invoke(main, "get_config")["general"]["webMenuPinnedActions"] == FINAL_PINS
        assert disk_config(profile)["general"]["webMenuPinnedActions"] == FINAL_PINS
        assert_rejected(alpha, "set_web_menu_action_pinned", dict(actionId="unknown", pinned=True), "Unknown Web menu action")
        stale_draft["general"]["theme"] = "dark"
        invoke(main, "save_config", dict(newConfig=stale_draft, preserveWebMenuPins=True))
        committed = invoke(main, "get_config")
        assert committed["general"]["webMenuPinnedActions"] == FINAL_PINS
        assert committed["general"]["theme"] == "dark"
        assert disk_config(profile) == committed
        collapse(alpha)
        peer_wheel = hover_wheel(beta, 4)
        expect(peer_wheel.get_by_role("menuitem", name="Reload page", exact=True)).to_have_count(0)
        expect(peer_wheel.get_by_role("menuitem", name="Web window settings", exact=True)).to_be_visible()
        for source, expected in sources:
            assert source_state(source) == expected, "Pinning or config save reloaded source input"
        return dict(corners=results, menuAnchors=menu_anchors, pins=FINAL_PINS, sourcePreserved=True, peerSynchronized=True,
                    callerRejected=True, staleDraftPreserved=True)
    finally:
        try:
            if browser is not None:
                browser.close()
        finally:
            app.close()


def restart_run(playwright, binary, profile, output, site_base):
    app = App(binary, profile, output, 2)
    browser = None
    try:
        app.ready()
        browser = playwright.chromium.connect_over_cdp(app.endpoint)
        context = browser.contexts[0]
        main = find_main(context)
        committed = invoke(main, "get_config")
        assert committed["general"]["webMenuPinnedActions"] == FINAL_PINS
        assert committed["general"]["theme"] == "dark"
        alpha, _ = open_card(context, main, "wheel_alpha", site_base + "/Alpha")
        wheel = hover_wheel(alpha, 4)
        expect(wheel.get_by_role("menuitem", name="Reload page", exact=True)).to_have_count(0)
        expect(wheel.get_by_role("menuitem", name="Web window settings", exact=True)).to_be_visible()
        snapshot = native_layout(app.process.pid, "IOX Wheel Native Alpha", alpha)
        alpha.screenshot(path=str(output / "wheel-after-restart.png"))
        return dict(pins=committed["general"]["webMenuPinnedActions"], layout=snapshot)
    finally:
        try:
            if browser is not None:
                browser.close()
        finally:
            app.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=Path(os.environ.get(
        "IOX_NATIVE_TEST_BINARY", str(ROOT / "src-tauri/target/debug/examples/web_wheel_smoke.exe"))))
    parser.add_argument("--output", type=Path, default=ROOT / "docs/verification/web-chrome/wheel-native" / time.strftime("%Y%m%d-%H%M%S"))
    args = parser.parse_args()
    binary = args.binary.resolve()
    assert binary.is_file(), f"Build a fresh isolated smoke executable first: {binary}"
    with urllib.request.urlopen("http://localhost:1420", timeout=5) as response:
        assert response.status == 200
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    profile = output / "profile"
    (profile / ".iox-dev").mkdir(parents=True)
    for directory in [profile / "AppData/Local", profile / "AppData/Roaming"]:
        directory.mkdir(parents=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), Site)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    site_base = f"http://127.0.0.1:{server.server_port}"
    config = json.loads((ROOT / "tests/fixtures/config/default-config.zh.json").read_text(encoding="utf-8"))
    config["general"].update(autoPopupOnSelection=False, autoPopupOnFileSelection=False,
        enableFloatingBall=False, autoStart=False, webHeadlessMode=True,
        webWindowMode="multi_window", uiStyle="windows", language="en", globalHotkey="Ctrl+Alt+Shift+F11")
    config["providers"] = []
    config["actions"] = [dict(id="wheel_" + name.lower(), name="IOX Wheel Native " + name,
        icon="Globe", actionType="web", enabled=True, urlTemplate=site_base + "/" + name,
        useUrlTemplate=True) for name in ["Alpha", "Beta"]]
    (profile / ".iox-dev/config.json").write_text(json.dumps(config), encoding="utf-8")
    try:
        with sync_playwright() as playwright:
            first = first_run(playwright, binary, profile, output, site_base)
            (output / "first-run.json").write_text(json.dumps(first, indent=2), encoding="utf-8")
            restarted = restart_run(playwright, binary, profile, output, site_base)
        result = dict(firstRun=first, restarted=restarted, physicalInputInjected=False,
                      hoverPaintSamples=HOVER_PAINT_SAMPLES,
                      hoverCaseReset="local toolbar reload; source WebView retained",
                      binary=str(binary), output=str(output))
        (output / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        print("Native wheel smoke passed: four-corner HWND bounds/button anchors, source preservation, pin/unpin disk writes, peer sync, caller rejection, stale settings save, and restart persistence.")
        print(f"Artifacts: {output}")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
