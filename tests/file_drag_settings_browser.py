"""Run against pnpm dev with Python Playwright and installed Chrome."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

artifacts = Path('.artifacts.local')
artifacts.mkdir(exist_ok=True)
base = 'http://localhost:1420/tests/fixtures/general-settings.html'

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1000, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    for suffix, toggle_name, delay_name in [('', '拖动文件', '悬停时间'), ('?en', 'File drag menu', 'Hover delay')]:
        page.goto(base + suffix)
        page.wait_for_load_state('networkidle')
        toggle = page.get_by_role('switch', name=toggle_name, exact=True)
        slider = page.get_by_role('slider', name=delay_name, exact=True)
        expect(slider).to_have_count(0)
        toggle.click()
        expect(slider).to_be_visible()
        expect(slider).to_have_value('1000')
        slider.press('End')
        expect(slider).to_have_value('3000')
        assert page.evaluate('window.testGeneral.fileDragHoverDelayMs') == 3000
        slider.press('Home')
        slider.press('ArrowRight')
        expect(slider).to_have_value('300')
        assert page.evaluate('window.testGeneral.fileDragHoverDelayMs') == 300
        toggle.click()
        expect(slider).to_have_count(0)
        toggle.click()
        expect(slider).to_have_value('300')
        language = 'en' if suffix else 'zh'
        page.screenshot(path=str(artifacts / f'file-drag-settings-{language}.png'), animations='disabled')
    assert not errors, errors
    browser.close()
    print('File drag settings checks passed: conditional display, legacy default, limits, live value, retained delay, Chinese/English.')
