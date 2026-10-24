"""Run against pnpm dev: uv run --offline --with playwright python tests/provider_balance_browser.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = 'http://127.0.0.1:1420/tests/fixtures/provider-balance.html'
output = Path('docs/verification/provider-balance')
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 600, 'height': 500}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install()

    for theme in ['dark', 'light']:
        for lang in ['zh-CN', 'en-US']:
            page.goto(f'{base}?theme={theme}&lang={lang}')
            page.wait_for_load_state('networkidle')
            amount = page.locator('.balance-pill-amount')
            expect(amount).to_contain_text('12.34')
            assert page.evaluate('balanceFixture.calls.length') == 1, 'StrictMode must not duplicate requests'
            ring = page.locator('.context-meter-trigger').bounding_box()
            capsule = page.locator('.balance-pill').bounding_box()
            assert capsule['x'] + capsule['width'] < ring['x']
            assert abs(capsule['y'] + capsule['height'] / 2 - ring['y'] - ring['height'] / 2) < 1
            amount.click()
            details = page.get_by_role('dialog')
            expect(details).to_be_visible()
            expect(details).to_contain_text('2.00')
            expect(details).to_contain_text('10.34')
            page.screenshot(path=str(output / f'{theme}-{lang}.png'), style='[data-controls] { visibility: hidden; }')
            page.keyboard.press('Escape')
            expect(details).not_to_be_visible()
            expect(amount).to_be_focused()
            page.clock.fast_forward(300_000)
            expect(page.locator('.balance-pill-refresh')).to_be_enabled()
            assert page.evaluate('balanceFixture.calls.length') == 2
            page.locator('.balance-pill-refresh').click()
            expect(page.locator('.balance-pill-refresh')).to_be_enabled()
            assert page.evaluate('balanceFixture.calls.length') == 3
            page.evaluate("balanceFixture.mode = 'error'")
            page.locator('.balance-pill-refresh').click()
            expect(page.locator('.balance-pill')).to_have_attribute('data-warning', 'true')
            expect(amount).to_contain_text('12.34')
            amount.click()
            expect(details).to_contain_text('查询失败' if lang == 'zh-CN' else 'Unable to fetch')
            page.evaluate("balanceFixture.mode = 'normal'")
            page.get_by_role('button', name='Second account').click()
            expect(amount).to_contain_text('99.00')
            page.get_by_role('button', name='Other provider').click()
            expect(page.locator('.balance-pill')).to_have_count(0)

    page.goto(f'{base}?mode=multi')
    page.wait_for_load_state('networkidle')
    amount = page.locator('.balance-pill-amount')
    expect(amount).to_contain_text('12.34')
    expect(amount).to_contain_text('+1')
    amount.click()
    expect(page.get_by_role('dialog')).to_contain_text('USD')
    expect(page.get_by_role('dialog')).to_contain_text('CNY')

    page.goto(f'{base}?mode=usd&lang=en-US&style=windows')
    page.wait_for_load_state('networkidle')
    expect(page.locator('.balance-pill-amount')).to_contain_text('$12.34')
    page.locator('.balance-pill-amount').click()
    assert page.locator('.balance-popover').evaluate('el => getComputedStyle(el).borderRadius') == '0px'

    page.goto(f'{base}?missing')
    page.wait_for_load_state('networkidle')
    expect(page.locator('.balance-pill-refresh')).to_be_disabled()
    page.locator('.balance-pill-amount').click()
    expect(page.get_by_role('dialog')).to_contain_text('请先配置 API Key')
    assert page.evaluate('balanceFixture.calls.length') == 0

    page.goto(f'{base}?mode=insufficient&disabled')
    page.wait_for_load_state('networkidle')
    expect(page.locator('.balance-pill-amount')).to_contain_text('12.34')
    expect(page.locator('.balance-pill')).to_have_attribute('data-warning', 'true')
    page.locator('.balance-pill-amount').click()
    expect(page.get_by_role('dialog')).to_contain_text('余额不足')
    page.set_viewport_size({'width': 360, 'height': 420})
    page.wait_for_timeout(200)
    box = page.locator('.balance-popover').bounding_box()
    assert box['x'] >= 8 and box['x'] + box['width'] <= 352
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(output / 'small-window.png'), style='[data-controls] { visibility: hidden; }')

    page.goto(base)
    page.wait_for_load_state('networkidle')
    page.evaluate("balanceFixture.mode = 'slow'")
    page.locator('.balance-pill-refresh').click()
    expect(page.locator('.balance-pill-refresh')).to_be_disabled()
    page.clock.fast_forward(2000)
    expect(page.locator('.balance-pill-refresh')).to_be_enabled()
    count = page.evaluate('balanceFixture.calls.length')
    page.get_by_role('button', name='Toggle card').click()
    page.clock.fast_forward(600_000)
    assert page.evaluate('balanceFixture.calls.length') == count
    page.get_by_role('button', name='Toggle card').click()
    page.clock.fast_forward(2000)
    expect(page.locator('.balance-pill-refresh')).to_be_enabled()
    assert page.evaluate('balanceFixture.calls.length') == count + 1
    assert not errors, errors
    browser.close()
    print('Balance browser checks passed: placement, themes/locales, polling, manual refresh, errors, accounts, currencies, missing keys, narrow windows and cleanup.')
