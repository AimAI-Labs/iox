"""With Vite running: uv run --offline --with playwright python tests/web_frame_browser.py."""
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page()
    page.goto('http://localhost:1420/tests/fixtures/web-frame.html')
    expect(page.locator('#root > div')).to_have_css('background-color', 'rgb(77, 107, 254)')
    page.goto('http://localhost:1420/tests/fixtures/web-frame.html?hub')
    frame = page.locator('#root > div')
    expect(frame).to_have_css('background-color', 'rgb(77, 107, 254)')
    page.evaluate("switchFrameTab('act_web_qwen')")
    expect(frame).to_have_css('background-color', 'rgb(97, 92, 237)')
    browser.close()
print('Web frame DeepSeek and Hub color checks passed.')
