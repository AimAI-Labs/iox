"""Exercise the actual website injection and its toast on a local page."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
toast_script = (root / 'src-tauri/src/ai/web_toast.js').read_text(encoding='utf-8')
upload_source = (root / 'src-tauri/src/ai/file_upload.rs').read_text(encoding='utf-8')
upload_script = re.search(r'const ATTACHMENT_SCRIPT: &str = r#"(.*?)"#;', upload_source, re.S).group(1)
payload = json.dumps([{'name': 'example.txt', 'data': 'aGk='}])
artifacts = root / '.artifacts.local'
artifacts.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 900, 'height': 600})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('http://localhost:1420/toast-test', lambda route: route.fulfill(
        content_type='text/html', body='<html><body><h1>AI website</h1></body></html>'))

    def inject(request_id, theme='light'):
        prefix = f'const requestId={json.dumps(request_id)},toastTheme={json.dumps(theme)},expectedOrigin=location.origin;'
        page.evaluate('() => {' + prefix + toast_script + upload_script.replace('__FILES__', payload) + '}')

    def open_page(with_input=False):
        page.goto('http://localhost:1420/toast-test')
        if with_input:
            page.evaluate('''() => {
                const input=document.createElement('input');input.type='file';input.multiple=true;
                window.changeCount=0;input.addEventListener('change',()=>window.changeCount++);document.body.append(input);
            }''')

    open_page()
    inject('waiting')
    toast = page.locator('[data-iox-toast-host] .toast')
    expect(toast).to_contain_text('正在等待附件入口')
    box = toast.bounding_box()
    assert abs(box['x'] + box['width'] / 2 - 450) < 1 and box['y'] < 50
    expect(page.locator('[data-iox-toast-host]')).to_have_count(1)
    page.screenshot(path=str(artifacts / 'web-toast-waiting.png'), animations='disabled')
    page.get_by_role('button', name='关闭提示 / Dismiss notification').click()
    expect(toast).to_have_count(0)
    page.evaluate("document.body.insertAdjacentHTML('beforeend','<input type=file multiple>')")
    page.wait_for_timeout(600)
    assert page.locator('input[type=file]').evaluate('(input) => input.files.length') == 0

    for theme in ['light', 'dark']:
        open_page(with_input=True)
        inject('success-' + theme, theme)
        toast = page.locator('[data-iox-toast-host] .toast')
        expect(toast).to_have_attribute('data-type', 'success')
        expect(toast).to_have_attribute('data-theme', theme)
        expect(toast).to_contain_text('附件已交给网页')
        assert page.evaluate('window.changeCount') == 1
        inject('success-' + theme, theme)
        assert page.evaluate('window.changeCount') == 1
        page.screenshot(path=str(artifacts / f'web-toast-success-{theme}.png'), animations='disabled')
    expect(toast).to_have_count(0, timeout=5000)

    open_page()
    inject('navigation')
    page.evaluate("history.pushState({},'', '/auth/login')")
    toast = page.locator('[data-iox-toast-host] .toast')
    expect(toast).to_have_attribute('data-type', 'error')
    expect(toast).to_contain_text('附件已停止')
    page.screenshot(path=str(artifacts / 'web-toast-error.png'), animations='disabled')
    assert not errors, errors
    browser.close()
    print('Website toast checks passed: top-center, loading, close cancels, success, deduplication, auto-dismiss, light/dark, navigation errors.')
