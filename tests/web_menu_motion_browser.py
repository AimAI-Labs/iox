"""Visual interaction checks for the floating controls; run against the existing Vite server."""
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import expect, sync_playwright

output = Path('docs/verification/web-chrome/motion')
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    context = browser.new_context(viewport={'width': 860, 'height': 640})
    for theme in ['light', 'dark']:
        page = context.new_page()
        page.goto(f'http://localhost:1420/tests/fixtures/web-chrome.html?theme={theme}')
        bar = page.frame_locator('#bar')
        trigger = bar.locator('.web-menu-trigger')
        expect(trigger).to_be_visible()
        button_before = trigger.bounding_box()
        canvas_before = page.locator('#bar').bounding_box()
        surface = trigger.locator('.web-menu-trigger-surface')
        expect(surface).to_be_visible()
        # Press feedback changes the visible material while its hit target stays stationary.
        trigger.hover()
        page.mouse.down()
        page.wait_for_timeout(100)
        assert trigger.bounding_box() == button_before
        visual = surface.bounding_box()
        assert visual['width'] < button_before['width'] - 6, 'Press should visibly compress the inner control'
        page.mouse.up()
        expect(bar.get_by_role('dialog')).to_be_visible()
        trigger.click()
        page.mouse.move(200, 600)
        trigger.hover()
        expect(bar.get_by_role('menuitem')).to_have_count(4)
        assert trigger.bounding_box() == button_before
        assert page.locator('#bar').bounding_box() == canvas_before
        # The hover grace interval also contains the exit fade; reentry cancels the close.
        page.clock.install(time=datetime(2030, 1, 1, tzinfo=timezone.utc))
        page.clock.pause_at(datetime(2030, 1, 1, 0, 0, 1, tzinfo=timezone.utc))
        page.mouse.move(200, 600)
        page.clock.fast_forward(100)
        section = bar.locator('.web-quick-wheel')
        expect(section).to_have_attribute('data-closing', 'true')
        assert page.evaluate('chromeFixture.layout.menu.wheel')
        trigger.hover()
        expect(section).to_have_attribute('data-closing', 'false')
        page.clock.fast_forward(230)
        page.clock.resume()
        if theme == 'light':
            # Hold close and reopen separately: an old close receipt must not lose the
            # pending open intent when the pointer leaves again before reopen commits.
            page.evaluate('''() => {
                const fixture = chromeFixture;
                const invoke = fixture.invoke.bind(fixture);
                fixture.transitions = [];
                fixture.invoke = async (command, args = {}) => {
                    let transition;
                    if (command === 'layout_web_menu' && fixture.transitions.length < 2) {
                        await new Promise(release => {
                            transition = { wheel: args.wheel, release, completed: false };
                            fixture.transitions.push(transition);
                        });
                    }
                    const result = await invoke(command, args);
                    if (transition) transition.completed = true;
                    return result;
                };
            }''')
            page.mouse.move(200, 600)
            page.wait_for_function('chromeFixture.transitions.length === 1', timeout=3000)
            trigger.hover()
            expect(section).to_have_attribute('data-closing', 'false')
            page.evaluate('chromeFixture.transitions[0].release()')
            page.wait_for_function('chromeFixture.transitions.length === 2')
            expect(bar.locator('.web-floating-menu')).to_have_attribute('data-wheel', 'false')
            page.mouse.move(200, 600)
            page.wait_for_timeout(210)
            page.evaluate('chromeFixture.transitions[1].release()')
            page.wait_for_function('chromeFixture.transitions[1].completed')
            page.wait_for_function('chromeFixture.layout.menu.wheel === false', timeout=3000)
            expect(bar.locator('.web-floating-menu')).to_have_attribute('data-wheel', 'false')
            trigger.hover()
            expect(bar.get_by_role('menuitem')).to_have_count(4)
        expect(section).to_be_visible()
        assert page.evaluate('chromeFixture.layout.menu.wheel')
        assert trigger.bounding_box() == button_before
        first = section.get_by_role('menuitem').first
        first.hover()
        page.wait_for_timeout(180)
        page.screenshot(path=str(output / f'{theme}-hover.png'))
        trigger.click()
        expect(bar.get_by_role('dialog')).to_be_visible()
        page.screenshot(path=str(output / f'{theme}-menu.png'))
        trigger.click()
        page.mouse.move(200, 600)
        page.emulate_media(reduced_motion='reduce')
        trigger.hover()
        expect(bar.get_by_role('menuitem')).to_have_count(4)
        assert bar.locator('.web-floating-menu').evaluate('element => element.getAnimations({subtree:true}).length') == 0, 'Reduced motion should remove floating-control animations'
        assert trigger.bounding_box() == button_before
        page.close()
    browser.close()
    print('Floating motion checks passed: inner-surface press, stable hit targets/canvas, reversible hover exit, delayed close/reopen, themes, full menu and reduced motion.')
