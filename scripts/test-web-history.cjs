// Run with Node 22 and Playwright available (or set PLAYWRIGHT_MODULE to its module path).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const collector = fs.readFileSync(path.join(root, 'src-tauri/src/web_history_collector.js'), 'utf8');
const output = ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/web-history.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helpers = {};
new Function('exports', output)(helpers);
const { filterHistory, groupHistory } = helpers;

async function main() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://history.test/**', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
    await page.goto('https://history.test/');

    // Public Qianwen sidebar uses non-anchor session rows plus nested tool buttons.
    await page.route('https://www.qianwen.com/**', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
    await page.goto('https://www.qianwen.com/');
    await page.setContent('<aside><div role="list" class="sider-scrollbar"><div data-session-id="q-1" data-session-switch-target="normal"><div class="text-ellipsis">千问真实标题</div><button data-session-id="q-1" data-session-switch-target="session-tools">更多</button></div></div></aside>');
    const qwenRows = (await page.evaluate(collector)).entries;
    assert.equal(qwenRows.length, 1, 'Qianwen session rows must be recognized');
    assert.equal(qwenRows[0].url, 'https://www.qianwen.com/chat/q-1');
    assert.equal(qwenRows[0].title, '千问真实标题');

    // MiMo's sidebar uses tracked div rows, and a hash router.
    await page.route('https://aistudio.xiaomimimo.com/**', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
    await page.goto('https://aistudio.xiaomimimo.com/#/c');
    await page.setContent('<div style="display:flex"><div style="width:260px;height:700px"><div data-track-name="chat_history_list" data-track-id="chat_history_list_m-1"><span title="MiMo真实标题">MiMo真实标题</span></div></div><main style="width:800px"><article><a href="#/chat/message-link">正文链接</a></article></main></div>');
    const mimoRows = (await page.evaluate(collector)).entries;
    assert.equal(mimoRows.length, 1, 'MiMo tracked history rows must be recognized');
    assert.equal(mimoRows[0].url, 'https://aistudio.xiaomimimo.com/#/chat/m-1');
    await page.goto('https://history.test/');

    // The application layout may itself be a main element; its left sidebar is still history.
    await page.setContent('<main style="display:flex"><div class="f83a4" style="width:260px;height:700px"><a href="/a/chat/s/ds-1">DeepSeek标题</a><a href="/a/chat/s/ds-2">另一个会话</a></div><section style="width:800px"><article><a href="/a/chat/s/not-history">正文中的引用</a></article><textarea></textarea></section></main>');
    assert.equal((await page.evaluate(collector)).entries.length, 2, 'Hashed sidebar containers inside app main must be discovered');
    await page.evaluate(() => { delete window.__ioxHistoryCollector; });
    await page.setContent('<aside><div aria-busy="true" class="skeleton">Loading</div></aside>');
    for (let i = 0; i < 14; i++) await page.evaluate(collector);
    assert.equal((await page.evaluate(collector)).status, 'collecting', 'Slow loading must not become an unrecognized-sidebar failure');
    await page.goto('https://history.test/');
    await page.setContent(`<aside>
      <h3>今天</h3><a href="/c/a">Today chat</a><a href="/c/a?utm_source=other">Duplicate</a>
      <h3>昨天</h3><a href="/c/b">Yesterday chat</a>
      <h3>过去7天</h3><a href="/c/range">Range chat</a>
      <h3>更早</h3><a href="/c/old">Unknown date</a>
      <a href="/c/new">New chat button</a><a href="https://evil.test/c/leak">Outside</a>
    </aside><main><a href="/c/not-history">Chat body link</a></main>`);
    const snapshot = await page.evaluate(collector);
    assert.equal(snapshot.entries.length, 4);
    const get = id => snapshot.entries.find(row => row.url.endsWith(`/${id}`));
    assert.equal(get('a').precision, 'day');
    assert.equal(get('b').precision, 'day');
    assert.equal(get('range').precision, 'range');
    assert.equal(get('old').precision, 'unknown');
    assert.equal(get('old').dateEnd, null);
    assert.ok(get('a').dateStart > get('b').dateStart);
    for (let i = 0; i < 4; i++) await page.evaluate(collector);
    assert.equal((await page.evaluate(collector)).status, 'collecting');
    await page.locator('aside').evaluate(el => el.setAttribute('data-has-more', 'false'));
    assert.equal((await page.evaluate(collector)).status, 'ready');

    await page.evaluate(() => { delete window.__ioxHistoryCollector; });
    await page.setContent('<aside><a href="/c/title">no more conversations</a></aside>');
    for (let i = 0; i < 5; i++) await page.evaluate(collector);
    assert.equal((await page.evaluate(collector)).status, 'collecting');

    await page.route('https://chat.deepseek.com/**', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
    await page.goto('https://chat.deepseek.com/');
    await page.setContent('<aside><div data-session-id="1"><span>Today</span></div><div data-session-id="2">September</div><div data-session-id="3">Other chat</div></aside>');
    const dataRows = (await page.evaluate(collector)).entries;
    assert.equal(dataRows.length, 3);
    assert.ok(dataRows.every(row => row.precision === 'unknown'));
    assert.ok(dataRows.every(row => row.url.includes('/a/chat/s/')));
    await page.goto('https://history.test/');

    await page.evaluate(() => { delete window.__ioxHistoryCollector; });
    await page.setContent('<aside><h3>最近30天</h3><a href="/a/chat/s/deepseek">DeepSeek</a><h3>September</h3><a href="/c/month">Month</a><h3>Unrecognized date group</h3><a href="/c/unknown">Unknown</a></aside>');
    const headings = (await page.evaluate(collector)).entries;
    assert.equal(headings.length, 3);
    assert.equal(headings[1].dateLabel, 'September');
    assert.equal(headings[2].precision, 'unknown');
    for (let i = 0; i < 16; i++) await page.evaluate(collector);
    assert.equal((await page.evaluate(collector)).status, 'partial');

    await page.evaluate(() => { delete window.__ioxHistoryCollector; });
    await page.setContent('<aside><li data-updated-at="2026-10-13T08:30:00Z"><a href="/chat/exact">Exact chat</a></li></aside>');
    const exact = (await page.evaluate(collector)).entries[0];
    assert.equal(exact.precision, 'exact');
    assert.equal(exact.dateStart, Date.parse('2026-10-13T08:30:00Z') / 1000);

    await page.evaluate(() => { delete window.__ioxHistoryCollector; });
    await page.setContent('<button>Log in</button>');
    for (let i = 0; i < 3; i++) await page.evaluate(collector);
    assert.equal((await page.evaluate(collector)).status, 'login_required');

    await page.evaluate(() => { delete window.__ioxHistoryCollector; });
    await page.setContent('<aside style="height:100px;overflow-y:auto"><h3>今天</h3><a href="/c/first">First</a><div style="height:500px"></div></aside>');
    await page.evaluate(() => document.querySelector('aside').addEventListener('scroll', () => {
      if (!document.getElementById('late')) {
        const late = document.createElement('a'); late.id = 'late'; late.href = '/c/late'; late.textContent = 'Lazy loaded'; document.querySelector('aside').appendChild(late);
      }
    }));
    await page.evaluate(collector);
    const loaded = await page.evaluate(collector);
    assert.equal(loaded.entries.length, 2);
    assert.ok(await page.locator('aside').evaluate(el => el.scrollTop > 0));

    const sessions = snapshot.entries.map((row, index) => ({ ...row, id: String(index), actionId: index % 2 ? 'claude' : 'gpt', platform: index % 2 ? 'Claude' : 'ChatGPT' }));
    const options = { query: '', platform: '', time: 'all', from: '', to: '' };
    const sorted = filterHistory(sessions.slice().reverse(), options);
    assert.equal(sorted.at(-1).precision, 'unknown');
    assert.equal(groupHistory(sorted).at(-1).key, 'unknown');
    assert.equal(filterHistory(sessions, { ...options, time: 'today' }).some(row => row.precision === 'unknown'), false);
    assert.ok(filterHistory(sessions, { ...options, platform: 'gpt' }).every(row => row.actionId === 'gpt'));
    assert.equal(filterHistory(sessions, { ...options, query: 'yesterday' }).length, 1);
    assert.equal(filterHistory(sessions, { ...options, time: 'custom', from: '2026-10-20', to: '2026-10-10' }).length, 0);
    const range = sessions.find(row => row.precision === 'range');
    const date = helpers.localDayKey(range.dateStart);
    assert.ok(filterHistory(sessions, { ...options, time: 'custom', from: date, to: date }).some(row => row.id === range.id));
    console.log('PASS: sidebar extraction, exclusion of body/cross-origin/new links, deduplication, exact/day/range/unknown dates, login detection, lazy loading, descending sort, grouping, keyword/platform/date filters.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
