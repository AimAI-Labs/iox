"""Short-window menu anchoring: run against the existing Vite fixture server."""
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

output = Path('docs/verification/web-chrome/menu-anchor')
output.mkdir(parents=True, exist_ok=True)

def center(box):
    return (box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    for theme in ['light', 'dark']:
        for hub in [False, True]:
            page = browser.new_page(viewport={'width': 860, 'height': 400}, reduced_motion='reduce')
            page.goto(f'http://localhost:1420/tests/fixtures/web-chrome.html?theme={theme}' + ('&hub' if hub else ''))
            bar = page.frame_locator('#bar')
            trigger = bar.locator('.web-menu-trigger')
            expect(trigger).to_be_visible()
            for anchor_y, upward in [(180, False), (332, True)]:
                page.evaluate('(y) => chromeFixture.place({expanded:false,wheel:false,position:[400,y]})', anchor_y)
                before = center(trigger.bounding_box())
                trigger.click()
                root = bar.locator('.web-floating-menu')
                expect(root).to_have_attribute('data-upward', str(upward).lower())
                after = center(trigger.bounding_box())
                assert abs(before[0] - after[0]) <= 1 and abs(before[1] - after[1]) <= 1, (before, after)
                canvas = page.locator('#bar').bounding_box()
                assert canvas['y'] >= 12 and canvas['y'] + canvas['height'] <= 388
                body = bar.locator('.web-menu-body')
                header = bar.locator('.web-menu-header').bounding_box()
                content = body.bounding_box()
                if upward:
                    assert content['y'] + content['height'] <= header['y'] + 1
                else:
                    assert header['y'] + header['height'] <= content['y'] + 1
                    assert canvas['height'] == 208
                # Actions stay reachable in the reduced space, while the header stays fixed.
                bar.locator('[data-action-id="closeWindow"] .web-menu-pin').scroll_into_view_if_needed()
                expect(trigger).to_be_visible()
                assert center(trigger.bounding_box()) == after
                page.screenshot(path=str(output / f'{theme}-{"hub" if hub else "single"}-{anchor_y}.png'))
                trigger.click()
                expect(trigger).to_have_attribute('aria-expanded', 'false')
                assert center(trigger.bounding_box()) == before
            page.evaluate('chromeFixture.place({expanded:false,wheel:false,position:[400,220]})')
            trigger.click()
            page.wait_for_function('chromeFixture.layout.menu.height === 168')
            before_grow = center(trigger.bounding_box())
            page.set_viewport_size({'width': 860, 'height': 640})
            expected_height = 408 if hub else 360
            page.wait_for_function('(height) => chromeFixture.layout.menu.height === height', arg=expected_height)
            assert center(trigger.bounding_box()) == before_grow
            page.set_viewport_size({'width': 860, 'height': 80})
            page.wait_for_function('chromeFixture.layout.menu.height <= 56')
            page.set_viewport_size({'width': 860, 'height': 640})
            page.wait_for_function('(height) => chromeFixture.layout.menu.height === height', arg=560 if hub else 360)
            expect(trigger).to_be_visible()
            assert body.evaluate('el => el.clientHeight') > 150
            page.close()
    browser.close()
print('Short-window menu checks passed: stable trigger center, downward shrinking, upward opening, scrolling, collapse restoration and shrink/grow recovery.')
