"""Run against `pnpm dev` with Python Playwright and installed Chrome."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

artifacts = Path('.artifacts.local')
artifacts.mkdir(exist_ok=True)
base = 'http://localhost:1420/tests/fixtures/file-menu.html'

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 373, 'height': 120}, device_scale_factor=2)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base)
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('button')).to_have_count(5)
    expect(page.get_by_role('status')).to_have_count(0)
    expect(page.get_by_text('2 个文件', exact=False)).to_have_count(0)
    expect(page.get_by_role('button', name='豆包', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='复制', exact=True)).to_have_count(0)
    assert page.locator('.overlay-root').evaluate('(el) => el.scrollHeight <= el.clientHeight')
    assert page.locator('[data-file-action-id]').evaluate_all('''buttons => buttons.every(button => {
        const box = button.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight
            && hit?.closest('button') === button;
    })''')
    boxes = page.locator('[data-file-action-id]').evaluate_all('buttons => buttons.map(b => b.getBoundingClientRect().toJSON())')
    assert boxes[2]['top'] < boxes[0]['top']
    page.screenshot(path=str(artifacts / 'file-menu-light.png'))
    first = page.locator('[data-file-action-id="web-0"]')
    original_box = first.bounding_box()
    first.hover()
    page.wait_for_function('''() => {
        const surface = document.querySelector('[data-file-action-id="web-0"] > .file-ai-card-surface');
        return Math.abs(new DOMMatrixReadOnly(getComputedStyle(surface).transform).m42 + 6) < 0.1;
    }''')
    assert first.bounding_box() == original_box, 'Hover must not move the drop target'
    page.screenshot(path=str(artifacts / 'file-menu-hover.png'))
    page.mouse.move(0, 0)
    page.wait_for_function('''() => {
        const surface = document.querySelector('[data-file-action-id="web-0"] > .file-ai-card-surface');
        return Math.abs(new DOMMatrixReadOnly(getComputedStyle(surface).transform).m42) < 0.1;
    }''')
    page.emulate_media(reduced_motion='reduce')
    assert first.locator('.file-ai-card-surface').evaluate('(el) => getComputedStyle(el).transitionDuration') == '0s'
    page.emulate_media(reduced_motion='no-preference')
    page.get_by_role('button', name='豆包', exact=True).click()
    assert page.evaluate('window.fileCalls.length') == 0
    page.evaluate("""() => {
        const box = document.querySelector('[data-file-action-id="web-0"]').getBoundingClientRect();
        const payload = {dragId: 42, x: (box.left + box.width / 2) * 2, y: (box.top + box.height / 2) * 2, scaleFactor: 2};
        window.emitFileEvent('file-drag-over', payload);
    }""")
    expect(page.locator('[data-file-action-id="web-0"]')).to_have_attribute('data-drag-hovered', 'true')
    expect(page.locator('[data-file-actions] > g:last-child button')).to_have_attribute('data-file-action-id', 'web-0')
    assert page.evaluate('window.fileCalls.length') == 0
    page.evaluate("""() => {
        const box = document.querySelector('[data-file-action-id="web-0"]').getBoundingClientRect();
        const payload = {dragId: 42, x: box.left + box.width / 2, y: box.top + box.height / 2, scaleFactor: 1};
        window.emitFileEvent('file-drag-drop', payload);
        window.emitFileEvent('file-drag-drop', payload);
    }""")
    assert page.evaluate('window.fileCalls.length') == 1
    assert page.evaluate('window.fileCalls[0].dragId') == 42
    expect(page.get_by_role('button', name='豆包', exact=True)).to_have_attribute('title', 'Error: The selected files exceed 20 MiB.')
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
    expect(page.get_by_role('button')).to_have_count(5)
    page.screenshot(path=str(artifacts / 'file-menu-dark.png'))
    page.evaluate("window.emitFileEvent('file-drag-cancelled', 42)")
    expect(page.locator('body')).to_have_attribute('data-closed', 'true')

    page.set_viewport_size({'width': 360, 'height': 180})
    page.goto(base + '?success')
    page.wait_for_load_state('networkidle')
    assert page.locator('[data-file-action-id]').evaluate_all('''buttons => buttons.every(button => {
        const box = button.getBoundingClientRect();
        return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
    })''')
    page.evaluate('''() => {
        const box = document.querySelector('[data-file-action-id="web-4"]').getBoundingClientRect();
        window.emitFileEvent('file-drag-drop', {dragId: 42, x: box.left + box.width / 2, y: box.top + box.height / 2, scaleFactor: 1});
    }''')
    expect(page.locator('body')).to_have_attribute('data-closed', 'true')
    assert page.evaluate('window.fileCalls[0].actionId') == 'web-4'

    page.goto(base + '?empty')
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('button')).to_have_count(0)
    assert not errors, errors
    browser.close()
    print('File menu browser checks passed: AI-only light/dark, drop highlight, single submission, retry, success, overflow, error tooltip, cancellation, empty menu.')
