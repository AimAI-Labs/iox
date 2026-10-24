"""Run against pnpm dev: uv run --offline --with playwright python tests/context_meter_browser.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = 'http://127.0.0.1:1420/tests/fixtures/context-meter.html'
screenshots = Path('docs/verification/context-meter')
screenshots.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 440, 'height': 460}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    for theme in ['dark', 'light']:
        for lang in ['zh', 'en']:
            page.goto(f'{base}?theme={theme}&lang={lang}')
            page.wait_for_load_state('networkidle')
            trigger = page.locator('.context-meter-trigger')
            trigger.hover()
            tooltip = page.get_by_role('tooltip')
            expect(tooltip).to_be_visible()
            expect(tooltip).to_contain_text('57,712')
            expect(tooltip.locator('dd')).to_have_text(['6,514', '50,432', '766'])
            progress = page.get_by_role('progressbar')
            expect(progress).to_have_attribute('aria-valuenow', '3')
            expect(progress).to_have_attribute('aria-valuemax', '5')
            # The portal remains visible when moving across the gap from the trigger.
            tooltip.hover()
            page.wait_for_timeout(200)
            expect(tooltip).to_be_visible()
            page.screenshot(path=str(screenshots / f'{theme}-{lang}.png'),
                            style='main > div:first-child { visibility: hidden; }')
            box = page.locator('.context-usage-popover').bounding_box()
            assert box['x'] >= 8 and box['y'] >= 8
            assert box['x'] + box['width'] <= 432
            # Escape dismisses the tooltip before the card receives it.
            page.keyboard.press('Escape')
            expect(tooltip).not_to_be_visible()
            expect(page.locator('output')).to_have_text('0')
            trigger.focus()
            expect(tooltip).to_be_visible()
            page.keyboard.press('Tab')
            expect(tooltip).not_to_be_visible()

    page.goto(f'{base}?style=windows&disabled')
    page.wait_for_load_state('networkidle')
    page.locator('.context-meter-trigger').focus()
    expect(page.get_by_role('tooltip')).to_contain_text('已关闭历史上下文')
    expect(page.get_by_role('progressbar')).to_have_attribute('aria-valuenow', '0')
    assert page.locator('.context-usage-popover').evaluate("el => getComputedStyle(el).borderRadius") == '0px'
    page.set_viewport_size({'width': 260, 'height': 220})
    page.wait_for_timeout(200)
    panel = page.locator('.context-usage-popover')
    box = panel.bounding_box()
    assert box['x'] >= 8 and box['y'] >= 8
    assert box['x'] + box['width'] <= 252
    assert box['y'] + box['height'] <= 212
    page.screenshot(path=str(screenshots / 'windows-small.png'))

    page.goto(base)
    page.wait_for_load_state('networkidle')
    page.get_by_role('button', name='Fill history').click()
    page.locator('.context-meter-trigger').focus()
    expect(page.get_by_role('progressbar')).to_have_attribute('aria-valuenow', '5')
    assert not errors, errors
    browser.close()
    print('Context meter browser checks passed: themes, locales, hover, focus, Escape, full/disabled history and small viewport.')
