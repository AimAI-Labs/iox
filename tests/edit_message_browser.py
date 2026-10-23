"""Run against pnpm dev with: uv run --offline --with playwright python tests/edit_message_browser.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

artifacts = Path('.artifacts.local')
artifacts.mkdir(exist_ok=True)
url = 'http://127.0.0.1:1420/tests/fixtures/edit-message.html'

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 500, 'height': 650})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def open_editor():
        page.locator('[data-user-message]').hover()
        page.get_by_role('button', name='Edit message', exact=True).click()
        editor = page.get_by_role('textbox', name='Edit sent message', exact=True)
        expect(editor).to_be_focused()
        return editor

    page.goto(url)
    page.wait_for_load_state('networkidle')
    editor = open_editor()
    expect(editor).to_have_value('Original sent message')
    editor.fill('Canceled change')
    page.get_by_role('button', name='Cancel', exact=True).click()
    expect(page.locator('[data-user-message]')).to_contain_text('Original sent message')

    editor = open_editor()
    editor.fill('  ')
    expect(page.get_by_role('button', name='Resend', exact=True)).to_be_disabled()
    editor.press('Enter')
    expect(editor).to_be_visible()
    editor.press('Escape')
    expect(editor).to_have_count(0)

    editor = open_editor()
    expect(editor).to_have_value('Original sent message')
    editor.fill('Edited question')
    editor.press('Shift+Enter')
    editor.press('Enter')
    expect(page.locator('[data-user-message]')).to_contain_text('Edited question')
    expect(page.get_by_role('textbox', name='Bottom draft')).to_have_value('Untouched bottom draft')

    page.goto(url + '?ctrl')
    page.wait_for_load_state('networkidle')
    editor = open_editor()
    editor.fill('Paragraph one')
    editor.press('Enter')
    editor.press('End')
    editor.type('Paragraph two')
    expect(editor).to_have_value('Paragraph one\nParagraph two')
    page.get_by_role('button', name='Toggle theme').click()
    page.screenshot(path=str(artifacts / 'edit-message-dark.png'), animations='disabled')
    editor.press('Control+Enter')
    expect(editor).to_have_count(0)
    expect(page.locator('[data-user-message]')).to_contain_text('Paragraph two')

    page.get_by_role('button', name='Toggle loading').click()
    page.locator('[data-user-message]').hover()
    expect(page.get_by_role('button', name='Edit message', exact=True)).to_be_disabled()
    page.get_by_role('button', name='Toggle loading').click()
    editor = open_editor()
    editor.fill(('A long message with wrapping text. ' * 20 + '\n') * 10)
    assert editor.evaluate('(element) => element.clientHeight') <= 240
    page.get_by_role('button', name='Toggle theme').click()
    page.screenshot(path=str(artifacts / 'edit-message-light.png'), animations='disabled')
    page.get_by_role('button', name='Resend', exact=True).click()
    expect(editor).to_have_count(0)
    expect(page.get_by_role('textbox', name='Bottom draft')).to_have_value('Untouched bottom draft')
    assert not errors, errors
    browser.close()
    print('Message editing browser checks passed: inline edit, cancel, Escape, empty guard, resend, both shortcuts, multiline, loading guard, draft isolation, light/dark layouts.')
