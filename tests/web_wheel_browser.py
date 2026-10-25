"""Controlled wheel UI checks: uv run --offline --with playwright python tests/web_wheel_browser.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = 'http://localhost:1420/tests/fixtures/web-chrome.html'
output = Path('docs/verification/web-chrome/wheel')
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    context = browser.new_context(viewport={'width': 860, 'height': 640}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base)
    bar = page.frame_locator('#bar')
    trigger = bar.locator('.web-menu-trigger')
    expect(trigger).to_be_visible()
    initial = trigger.bounding_box()
    trigger.hover()
    wheel = bar.get_by_role('menu', name='Quick actions')
    expect(wheel).to_be_visible()
    expect(wheel.get_by_role('menuitem')).to_have_count(4)
    expect(bar.locator('.web-wheel-disc, .web-wheel-center, .web-wheel-caption')).to_have_count(0)
    after = trigger.bounding_box()
    assert abs(initial['x'] - after['x']) <= 1 and abs(initial['y'] - after['y']) <= 1, 'Hover must preserve the button under the pointer'
    page.mouse.move(200, 600)
    expect(wheel).to_have_count(0)
    trigger.click()
    reload_row = bar.locator('[data-action-id="reload"]')
    reload_pin = reload_row.get_by_role('button', name='Unpin Reload page', exact=True)
    reload_pin.click()
    assert page.evaluate("chromeFixture.calls.filter(c => c.command === 'reload_web_webview').length") == 0, 'Pin controls must not execute the action'
    expect(reload_row.get_by_role('button', name='Pin Reload page', exact=True)).to_be_visible()
    trigger.click()
    page.mouse.move(200, 600)
    trigger.hover()
    expect(wheel.get_by_role('menuitem')).to_have_count(3)
    expect(wheel.get_by_role('menuitem', name='Reload page', exact=True)).to_have_count(0)
    page.reload()
    trigger = page.frame_locator('#bar').locator('.web-menu-trigger')
    expect(trigger).to_be_visible()
    page.mouse.move(200, 600)
    trigger.hover()
    wheel = page.frame_locator('#bar').get_by_role('menu', name='Quick actions')
    expect(wheel.get_by_role('menuitem')).to_have_count(3)
    page.mouse.move(200, 600)
    expect(wheel).to_have_count(0)
    trigger.click()
    page.evaluate('chromeFixture.failNext = true')
    page.frame_locator('#bar').locator('[data-action-id="reload"]').get_by_role('button', name='Pin Reload page', exact=True).click()
    expect(page.frame_locator('#bar').get_by_role('alert')).to_be_visible()
    assert 'reload' not in page.evaluate('chromeFixture.pins')
    # A late save failure must stay visible after the user closes the full menu.
    page.evaluate('chromeFixture.holdPin()')
    page.frame_locator('#bar').locator('[data-action-id="reload"] .web-menu-pin').click()
    trigger.click()
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    page.evaluate('chromeFixture.rejectPin()')
    expect(page.frame_locator('#bar').get_by_role('alert')).to_be_visible()
    # Pin every operation using the full menu, then verify the shared preference in another card.
    for action_id in ['reload', 'openExternal', 'history', 'settings', 'moveWindow', 'minimize', 'maximize', 'closeWindow']:
        row = page.frame_locator('#bar').locator(f'[data-action-id="{action_id}"]')
        pin = row.locator('.web-menu-pin')
        if pin.get_attribute('aria-pressed') == 'false':
            pin.click()
            expect(pin).to_have_attribute('aria-pressed', 'true')
    assert len(page.evaluate('chromeFixture.pins')) == 8
    peer = context.new_page()
    peer.goto(base)
    peer_trigger = peer.frame_locator('#bar').locator('.web-menu-trigger')
    peer_trigger.hover()
    expect(peer.frame_locator('#bar').get_by_role('menuitem')).to_have_count(8)
    # The same wheel supports the Hub, native-style theme, light palette and Chinese labels.
    peer.goto(base + '?hub=1&theme=light&style=windows&lang=zh-CN')
    expect(peer.frame_locator('#bar').locator('.web-menu-trigger')).to_be_visible()
    peer.mouse.move(200, 600)
    peer.frame_locator('#bar').locator('.web-menu-trigger').hover()
    expect(peer.frame_locator('#bar').get_by_role('menuitem')).to_have_count(8)
    peer.screenshot(path=str(output / 'hub-windows-light-zh.png'))
    peer.frame_locator('#bar').locator('.web-wheel-slot').first.get_by_role('menuitem').click()
    assert peer.evaluate("chromeFixture.calls.some(c => c.command === 'open_web_page_in_browser')")
    peer.close()
    page.bring_to_front()
    page.frame_locator('#bar').locator('.web-menu-trigger').click()
    page.mouse.move(0, 0)
    trigger.hover()
    wheel = page.frame_locator('#bar').get_by_role('menu', name='Quick actions')
    expect(wheel.get_by_role('menuitem')).to_have_count(8)
    wheel.get_by_role('menuitem', name='Reload page', exact=True).click()
    page.wait_for_function("chromeFixture.calls.filter(c => c.command === 'reload_web_webview').length === 1")
    expect(wheel).to_have_count(0)
    page.mouse.move(0, 0)
    trigger.hover()
    expect(wheel).to_be_visible()
    trigger.press('Escape')
    expect(wheel).to_have_count(0)
    page.wait_for_timeout(350)
    expect(wheel).to_have_count(0)
    page.mouse.move(0, 0)
    trigger.hover()
    expect(wheel).to_be_visible()
    page.frame_locator('#site').get_by_role('textbox', name='Page input').click()
    expect(wheel).to_have_count(0)
    page.wait_for_timeout(350)
    expect(wheel).to_have_count(0)

    # The original anchor stays under the pointer in every corner; all eight actions remain reachable.
    for index, position in enumerate([[12, 12], [804, 12], [12, 584], [804, 584], [400, 300]]):
        page.mouse.move(0, 0)
        page.evaluate('(position) => chromeFixture.place({expanded:false,wheel:false,position})', position)
        trigger = page.frame_locator('#bar').locator('.web-menu-trigger')
        expect(trigger).to_have_attribute('aria-expanded', 'false')
        before = trigger.bounding_box()
        trigger.hover()
        wheel = page.frame_locator('#bar').get_by_role('menu', name='Quick actions')
        expect(wheel.get_by_role('menuitem')).to_have_count(8)
        after = trigger.bounding_box()
        assert abs(before['x'] - after['x']) <= 1 and abs(before['y'] - after['y']) <= 1
        frame = page.locator('#bar').bounding_box()
        assert frame['x'] >= 0 and frame['y'] >= 0 and frame['x'] + frame['width'] <= 860 and frame['y'] + frame['height'] <= 640
        radii = []
        for item in wheel.get_by_role('menuitem').all():
            box = item.bounding_box()
            assert box['x'] >= frame['x'] and box['y'] >= frame['y'] and box['x'] + box['width'] <= frame['x'] + frame['width'] and box['y'] + box['height'] <= frame['y'] + frame['height']
            radii.append(((box['x'] + box['width']/2 - after['x'] - after['width']/2)**2 + (box['y'] + box['height']/2 - after['y'] - after['height']/2)**2)**0.5)
        assert max(radii) - min(radii) < 1, 'The original floating button must be the center of the orbit'
        page.screenshot(path=str(output / f'corner-{index}.png'))
        # Delay the collapse reply, then drag: the first delta must use the trigger, not wheel bounds.
        page.evaluate('chromeFixture.holdLayouts()')
        page.mouse.move(after['x'] + 20, after['y'] + 20)
        page.mouse.down()
        dx, dy = (60 if position[0] < 100 else -60), (60 if position[1] < 100 else -60)
        page.mouse.move(after['x'] + 20 + dx, after['y'] + 20 + dy, steps=3)
        page.mouse.up()
        page.evaluate('chromeFixture.releaseLayout()')
        page.wait_for_function('([x,y]) => !chromeFixture.layout.menu.wheel && Math.abs(chromeFixture.layout.menu.x-x)<1 && Math.abs(chromeFixture.layout.menu.y-y)<1', arg=[position[0] + dx, position[1] + dy])
        page.wait_for_timeout(350)
        assert not page.evaluate('chromeFixture.layout.menu.wheel'), 'A completed drag must not reopen the hover wheel'

    # Empty preferences disable the wheel, while clicking the full menu remains available.
    page.mouse.move(0, 0)
    trigger.click()
    for pin in page.frame_locator('#bar').locator('.web-menu-pin').all():
        if pin.get_attribute('aria-pressed') == 'true':
            pin.click()
            expect(pin).to_have_attribute('aria-pressed', 'false')
    trigger.click()
    page.mouse.move(0, 0)
    trigger.hover()
    page.wait_for_timeout(400)
    expect(page.frame_locator('#bar').get_by_role('menuitem')).to_have_count(0)
    assert not errors, errors
    browser.close()
    print('Wheel browser checks passed: hover, corners, drag anchor, Escape/blur, shared persistent pins, delayed failures, wheel actions, Hub, themes and languages.')
