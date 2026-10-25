"""Delay React's layout receipt and verify the button's native canvas never moves on hover."""
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

output = Path('docs/verification/web-chrome/hover-flash')
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    context = browser.new_context(viewport={'width': 860, 'height': 640})
    for theme in ['light', 'dark']:
        for style in ['classic', 'windows']:
            page = context.new_page()
            page.goto(f'http://localhost:1420/tests/fixtures/web-chrome.html?theme={theme}&style={style}')
            bar = page.frame_locator('#bar')
            trigger = bar.locator('.web-menu-trigger')
            expect(trigger).to_be_visible()
            canvas_before = page.locator('#bar').bounding_box()
            button_before = trigger.bounding_box()
            page.evaluate('chromeFixture.holdPresentation()')
            trigger.hover()
            page.wait_for_function('chromeFixture.layout.menu.wheel && document.querySelector("#bar").clientWidth === 280')
            # The hit region expanded, but the component has not received the new presentation.
            expect(bar.locator('.web-floating-menu')).to_have_attribute('data-wheel', 'false')
            page.screenshot(path=str(output / f'{theme}-{style}-pending.png'))
            surface = bar.locator('.web-floating-menu').evaluate('element => ({background: getComputedStyle(element).backgroundColor, border: getComputedStyle(element).borderWidth})')
            assert surface['background'] == 'rgba(0, 0, 0, 0)', f'Uncommitted menu paints a large surface: {surface}'
            assert surface['border'] == '0px', f'Uncommitted menu paints an outline: {surface}'
            header = bar.locator('.web-menu-header').bounding_box()
            assert header['width'] == 44 and header['height'] == 44, f'The button background must stay 44px while native size grows: {header}'
            expect(bar.locator('.web-menu-header')).to_be_visible()
            assert trigger.bounding_box() == button_before, 'The button must stay visible at its original coordinates before React receives the layout'
            assert page.locator('#bar').bounding_box() == canvas_before, 'Hover must not move or resize the native canvas'
            page.evaluate('chromeFixture.releasePresentation()')
            expect(bar.get_by_role('menuitem')).to_have_count(4)
            assert trigger.bounding_box() == button_before
            assert page.locator('#bar').bounding_box() == canvas_before
            page.mouse.move(200, 600)
            expect(bar.get_by_role('menuitem')).to_have_count(0)
            # Repeat real hover transitions without reduced motion.
            for _ in range(3):
                trigger.hover()
                expect(bar.get_by_role('menuitem')).to_have_count(4)
                page.mouse.move(200, 600)
                expect(bar.get_by_role('menuitem')).to_have_count(0)
            trigger.click()
            expect(bar.get_by_role('dialog')).to_be_visible()
            assert bar.locator('.web-floating-menu').evaluate('element => getComputedStyle(element).backgroundColor') != 'rgba(0, 0, 0, 0)', 'The full menu still needs its panel background'
            page.close()
    browser.close()
    print('Hover anchor checks passed: stationary native canvas, continuous button visibility/coordinates across delayed layout, repeated hover, themes/styles and full menu.')
