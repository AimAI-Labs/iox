"""Run against pnpm dev: uv run --offline --with playwright python tests/web_chrome_browser.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = 'http://localhost:1420/tests/fixtures/web-chrome.html'
output = Path('docs/verification/web-chrome')
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 860, 'height': 640}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
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
    print('Web menu browser checks passed: pointer dragging, live mode, operations, Hub, themes, languages, bounds.')
