"""Run against pnpm dev: uv run --offline --with playwright python tests/web_new_chat_settings_browser.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

output = Path('docs/verification/web-new-chat')
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    for language, label, initial, right, disabled in [
        ('zh', '双击按键新建对话', '左 Ctrl（默认）', '右 Ctrl', '关闭'),
        ('en', 'Double-tap key for new chat', 'Left Ctrl (default)', 'Right Ctrl', 'Disabled'),
    ]:
        page = browser.new_page(viewport={'width': 960, 'height': 850})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://localhost:1420/tests/fixtures/web-chrome.html?settings&lang={language}')
        page.wait_for_load_state('networkidle')
        selector = page.get_by_role('combobox', name=label)
        expect(selector).to_contain_text(initial)
        assert page.evaluate('testGeneral.webNewChatKey') == 'ControlLeft'
        for option, key in [(right, 'ControlRight'), ('F12', 'F12'), (disabled, 'Disabled')]:
            selector.click()
            page.get_by_role('option', name=option, exact=True).click()
            expect(selector).to_contain_text(option)
            assert page.evaluate('testGeneral.webNewChatKey') == key
        page.screenshot(path=str(output / f'settings-{language}.png'), full_page=True)
        assert not errors, errors
        page.close()
    browser.close()
print('Web new chat settings: Chinese and English defaults, key changes and disabling passed')
