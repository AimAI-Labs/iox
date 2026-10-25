"""Run against pnpm dev: uv run --offline --with playwright python tests/web_chrome_browser.py."""
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

base = 'http://localhost:1420/tests/fixtures/web-chrome.html'
output = Path('docs/verification/web-chrome')
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 860, 'height': 640}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    gesture_page = browser.new_page(viewport={'width': 860, 'height': 640}, reduced_motion='reduce')
    gesture_page.goto(f'{base}?lang=en-US')
    gesture_page.wait_for_load_state('networkidle')
    gesture_page.clock.install(time=datetime(2030, 1, 1, tzinfo=timezone.utc))
    gesture_page.clock.pause_at(datetime(2030, 1, 1, 0, 0, 1, tzinfo=timezone.utc))
    gesture_bar = gesture_page.frame_locator('#bar')
    gesture_trigger = gesture_bar.locator('.web-menu-trigger')
    expect(gesture_trigger).to_have_attribute('aria-expanded', 'false')
    box = gesture_page.locator('#bar').bounding_box()
    gesture_page.mouse.move(box['x'] + 22, box['y'] + 22)
    gesture_page.mouse.down()
    gesture_page.clock.fast_forward(999)
    assert gesture_page.evaluate("chromeFixture.calls.filter(c => c.command === 'plugin:window|start_dragging').length") == 0
    gesture_page.clock.fast_forward(1)
    assert gesture_page.evaluate("chromeFixture.calls.filter(c => c.command === 'plugin:window|start_dragging').length") == 1, 'A one-second hold must start native window dragging'
    gesture_page.mouse.up()
    expect(gesture_trigger).to_have_attribute('aria-expanded', 'false')
    gesture_trigger.click()
    expect(gesture_trigger).to_have_attribute('aria-expanded', 'true')
    gesture_trigger.press('Escape')

    # A press released before the threshold remains a normal click, with no delayed drag.
    gesture_trigger.hover()
    gesture_page.mouse.down()
    gesture_page.clock.fast_forward(900)
    gesture_page.mouse.up()
    expect(gesture_trigger).to_have_attribute('aria-expanded', 'true')
    gesture_page.clock.fast_forward(200)
    assert gesture_page.evaluate("chromeFixture.calls.filter(c => c.command === 'plugin:window|start_dragging').length") == 1
    gesture_trigger.press('Escape')

    # Starting to move before the threshold commits to menu dragging for this gesture.
    box = gesture_page.locator('#bar').bounding_box()
    gesture_page.mouse.move(box['x'] + 22, box['y'] + 22)
    gesture_page.mouse.down()
    gesture_page.mouse.move(500, 150, steps=4)
    gesture_page.clock.fast_forward(1500)
    gesture_page.mouse.up()
    assert gesture_page.evaluate("chromeFixture.calls.filter(c => c.command === 'plugin:window|start_dragging').length") == 1
    expect(gesture_trigger).to_have_attribute('aria-expanded', 'false')

    # Losing focus or unmounting the headless view must cancel the pending hold.
    gesture_trigger.hover()
    gesture_page.mouse.down()
    gesture_page.clock.fast_forward(500)
    gesture_bar.locator('body').evaluate("() => window.dispatchEvent(new Event('blur'))")
    gesture_page.clock.fast_forward(600)
    gesture_page.mouse.up()
    assert gesture_page.evaluate("chromeFixture.calls.filter(c => c.command === 'plugin:window|start_dragging').length") == 1
    gesture_trigger.hover()
    gesture_page.mouse.down()
    gesture_page.clock.fast_forward(500)
    gesture_page.evaluate('chromeFixture.setHeadless(false)')
    gesture_page.clock.fast_forward(600)
    gesture_page.mouse.up()
    assert gesture_page.evaluate("chromeFixture.calls.filter(c => c.command === 'plugin:window|start_dragging').length") == 1
    gesture_page.evaluate('chromeFixture.setHeadless(true); chromeFixture.failNext = true')
    expect(gesture_trigger).to_be_visible()
    gesture_trigger.hover()
    gesture_page.mouse.down()
    gesture_page.clock.fast_forward(1000)
    gesture_page.mouse.up()
    expect(gesture_bar.get_by_role('alert')).to_be_visible()
    gesture_page.close()

    for theme in ['dark', 'light']:
        for lang in ['en-US', 'zh-CN']:
            page.goto(f'{base}?theme={theme}&lang={lang}')
            page.wait_for_load_state('networkidle')
            bar = page.frame_locator('#bar')
            trigger = bar.locator('.web-menu-trigger')
            expect(trigger).to_have_attribute('aria-expanded', 'false')
            # Web content remains clickable; the overlay occupies only its small iframe.
            page.frame_locator('#site').get_by_role('button', name='Page action').click()
            assert page.evaluate('chromeFixture.pageClicks') == 1
            page.frame_locator('#site').get_by_role('textbox').fill('Keep this conversation')
            page.evaluate('chromeFixture.setHeadless(false)')
            expect(bar.locator('.web-titlebar-root')).to_be_visible()
            page.evaluate('chromeFixture.setHeadless(true)')
            expect(trigger).to_be_visible()
            expect(page.frame_locator('#site').get_by_role('textbox')).to_have_value('Keep this conversation')
            # Real pointer dragging moves the iframe. It must not also open the menu.
            box = page.locator('#bar').bounding_box()
            page.mouse.move(box['x'] + 22, box['y'] + 22)
            page.mouse.down()
            page.mouse.move(430, 210, steps=8)
            page.mouse.up()
            page.wait_for_function('chromeFixture.layout.menu.x < 600')
            expect(trigger).to_have_attribute('aria-expanded', 'false')
            trigger.click()
            expect(bar.get_by_role('dialog')).to_be_visible()
            page.screenshot(path=str(output / f'single-{theme}-{lang}.png'))
            trigger.press('Escape')
            expect(trigger).to_have_attribute('aria-expanded', 'false')
            trigger.click()
            bar.locator('.web-menu-action').nth(0).click()
            page.wait_for_function("chromeFixture.calls.some(c => c.command === 'reload_web_webview')")
            bar.locator('.web-menu-action').nth(1).click()
            page.wait_for_function("chromeFixture.calls.some(c => c.command === 'open_web_page_in_browser')")
            expect(trigger).to_have_attribute('aria-expanded', 'false')
            trigger.click()
            page.evaluate('chromeFixture.failNext = true')
            bar.locator('.web-menu-action').nth(1).click()
            expect(bar.get_by_role('alert')).to_be_visible()
            page.set_viewport_size({'width': 520, 'height': 400})
            page.wait_for_function('chromeFixture.layout.menu.x + chromeFixture.layout.menu.width <= innerWidth')
            box = page.locator('#bar').bounding_box()
            assert box['x'] >= 0 and box['y'] >= 0 and box['x'] + box['width'] <= 520
            page.set_viewport_size({'width': 860, 'height': 640})

    page.goto(f'{base}?hub&lang=en-US&style=windows')
    page.wait_for_load_state('networkidle')
    bar = page.frame_locator('#bar')
    bar.locator('.web-menu-trigger').click()
    expect(bar.locator('.web-menu-tab')).to_have_count(3)
    assert bar.locator('.web-floating-menu').evaluate('el => getComputedStyle(el).borderRadius') == '0px'
    bar.get_by_role('button', name='Alpha', exact=True).click()
    expect(bar.get_by_role('button', name='Alpha', exact=True)).to_have_attribute('aria-pressed', 'true')
    bar.get_by_role('button', name='Close Beta', exact=True).click()
    expect(bar.locator('.web-menu-tab')).to_have_count(2)
    bar.get_by_role('combobox').select_option('delta')
    expect(bar.locator('.web-menu-tab')).to_have_count(3)
    expect(bar.get_by_role('button', name='Delta', exact=True)).to_have_attribute('aria-pressed', 'true')
    bar.get_by_role('button', name='Close tabs to the left', exact=True).click()
    expect(bar.locator('.web-menu-tab')).to_have_count(1)
    bar.locator('.web-menu-action').nth(0).click()
    page.wait_for_function("chromeFixture.calls.some(c => c.command === 'reload_web_hub_active_tab')")
    page.screenshot(path=str(output / 'hub-windows.png'))
    assert not errors, errors
    browser.close()
    print('Web menu browser checks passed: exact one-second hold, cancellation, drag errors, pointer dragging, live mode, operations, Hub, themes, languages, bounds.')
