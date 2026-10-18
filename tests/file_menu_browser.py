"""Run against `pnpm dev` with Python Playwright and installed Chrome."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

artifacts = Path('.artifacts.local')
artifacts.mkdir(exist_ok=True)
base = 'http://127.0.0.1:1420/tests/fixtures/file-menu.html'

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 360, 'height': 194}, device_scale_factor=2)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base)
    page.wait_for_load_state('networkidle')
    expect(page.get_by_text('2 个文件', exact=False)).to_be_visible()
    expect(page.get_by_role('button', name='豆包', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='复制', exact=True)).to_have_count(0)
    assert page.locator('.overlay-root').evaluate('(el) => el.scrollHeight <= el.clientHeight')
    page.screenshot(path=str(artifacts / 'file-menu-light.png'))
    page.get_by_role('button', name='豆包', exact=True).click()
    assert page.evaluate('window.fileCalls.length') == 0
    page.evaluate("""() => {
        const box = document.querySelector('[data-file-action-id="web-0"]').getBoundingClientRect();
        const payload = {dragId: 42, x: (box.left + box.width / 2) * 2, y: (box.top + box.height / 2) * 2, scaleFactor: 2};
        window.emitFileEvent('file-drag-over', payload);
    }""")
    expect(page.locator('[data-file-action-id="web-0"]')).to_have_attribute('data-drag-hovered', 'true')
    assert page.evaluate('window.fileCalls.length') == 0
    page.evaluate("""() => {
        const box = document.querySelector('[data-file-action-id="web-0"]').getBoundingClientRect();
        const payload = {dragId: 42, x: box.left + box.width / 2, y: box.top + box.height / 2, scaleFactor: 1};
        window.emitFileEvent('file-drag-drop', payload);
        window.emitFileEvent('file-drag-drop', payload);
    }""")
    assert page.evaluate('window.fileCalls.length') == 1
    assert page.evaluate('window.fileCalls[0].dragId') == 42
    expect(page.get_by_role('alert')).to_contain_text('exceed 20 MiB')
    expect(page.get_by_role('button', name='豆包', exact=True)).to_be_enabled()
    page.screenshot(path=str(artifacts / 'file-menu-error.png'))

    page.get_by_role('button', name='豆包', exact=True).click()
    assert page.evaluate('window.fileCalls.length') == 2

    page.goto(base + '?success')
    page.wait_for_load_state('networkidle')
    page.evaluate("""() => {
        const box = document.querySelector('[data-file-action-id="web-0"]').getBoundingClientRect();
        window.emitFileEvent('file-drag-drop', {dragId: 42, x: box.left + box.width / 2, y: box.top + box.height / 2, scaleFactor: 1});
    }""")
    expect(page.locator('body')).to_have_attribute('data-closed', 'true')

    page.goto(base + '?dark&lang=en')
    page.wait_for_load_state('networkidle')
    expect(page.get_by_text('2 files', exact=False)).to_be_visible()
    page.screenshot(path=str(artifacts / 'file-menu-dark.png'))
    page.get_by_role('button', name='Close', exact=True).click()
    expect(page.locator('body')).to_have_attribute('data-closed', 'true')

    page.goto(base + '?empty')
    page.wait_for_load_state('networkidle')
    page.get_by_role('button', name='尚未启用官网动作，点击添加').click()
    expect(page.locator('body')).to_have_attribute('data-settings', 'true')
    assert not errors, errors
    browser.close()
    print('File menu browser checks passed: light/dark, web-only actions, drop highlight, single submission, retry, success, overflow, error, close, empty settings.')
