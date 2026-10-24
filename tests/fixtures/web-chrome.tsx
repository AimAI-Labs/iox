import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import { WebTitleBar } from '../../src/components/web/WebTitleBar';
import { ThemeProvider } from '../../src/themes/ThemeProvider';
import '../../src/App.css';
import type { WebChromeLayout, WebMenuChange } from '../../src/lib/webChromeClient';

const params = new URLSearchParams(location.search);
const hub = params.has('hub');
const language = params.get('lang') ?? 'en-US';
const label = hub ? 'web_hub' : 'web_win_fixture';
const actions = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((name) => ({
  id: name.toLowerCase(), name, icon: 'Globe', enabled: true, actionType: 'web' as const,
}));

if (!params.has('bar')) {
  const page = document.createElement('iframe');
  page.id = 'site';
  page.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;background:#edf0f4';
  page.srcdoc = `<body style="margin:0;padding:48px;font:14px system-ui;color:#334155;background:#edf0f4">
    <p style="font-size:11px;letter-spacing:2px;color:#64748b">PROJECT WORKSPACE</p>
    <h1 style="font-size:30px;font-weight:550;margin:32px 0 16px">A little more room to think.</h1>
    <p style="max-width:360px;line-height:1.7;color:#64748b">The page stays interactive around the floating menu.</p>
    <input aria-label="Page input" value="Current conversation" style="width:300px;padding:12px;margin:24px 0;border:1px solid #cbd5e1;border-radius:8px" />
    <p><button onclick="parent.chromeFixture.pageClicks++" style="padding:8px 16px">Page action</button></p></body>`;
  const bar = document.createElement('iframe');
  bar.id = 'bar';
  bar.style.cssText = 'position:fixed;border:0;z-index:2;background:transparent';
  const barParams = new URLSearchParams(params);
  barParams.set('bar', '1');
  bar.src = `web-chrome.html?${barParams}`;
  document.body.append(page, bar);
  const fixture = {
    calls: [] as { command: string; args: Record<string, unknown> }[],
    pageClicks: 0,
    failNext: false,
    layout: { revision: 0, headless: true, menu: { x: innerWidth - 56, y: 12, width: 44, height: 44, expanded: false } } as WebChromeLayout,
    hubState: { tabs: actions.slice(0, 3).map((action) => ({ actionId: action.id, name: action.name, icon: action.icon, url: 'https://example.test/' })), activeTabId: 'beta' },
    onChrome: (_layout: WebChromeLayout) => {},
    onHub: (_state: unknown) => {},
    place(changes: WebMenuChange = {}) {
      const old = fixture.layout.menu;
      const expanded = fixture.layout.headless && (changes.expanded ?? old.expanded);
      const width = Math.max(1, Math.min(expanded ? 280 : 44, innerWidth - 24));
      const height = Math.max(1, Math.min(expanded ? (hub ? 560 : 360) : 44, innerHeight - 24));
      const [x, y] = changes.position ?? [old.x + old.width - width, old.y];
      const menu = {
        x: Math.max(12, Math.min(x, innerWidth - width - 12)),
        y: Math.max(12, Math.min(y, innerHeight - height - 12)), width, height, expanded,
      };
      fixture.layout = { revision: fixture.layout.revision + 1, headless: fixture.layout.headless, menu };
      Object.assign(bar.style, fixture.layout.headless ? {
        left: `${menu.x}px`, top: `${menu.y}px`, width: `${width}px`, height: `${height}px`,
      } : { left: '0px', top: '0px', width: `${innerWidth}px`, height: '38px' });
      page.style.top = fixture.layout.headless ? '0px' : '38px';
      page.style.height = fixture.layout.headless ? '100%' : 'calc(100% - 38px)';
      fixture.onChrome(structuredClone(fixture.layout));
      return structuredClone(fixture.layout);
    },
    setHeadless(enabled: boolean) { fixture.layout.headless = enabled; fixture.place(); },
    async invoke(command: string, args: Record<string, unknown> = {}) {
      fixture.calls.push({ command, args });
      if (command === 'get_web_chrome') return structuredClone(fixture.layout);
      if (command === 'layout_web_menu') return fixture.place(args as WebMenuChange);
      if (command === 'get_web_hub_state') return structuredClone(fixture.hubState);
      if (fixture.failNext) { fixture.failNext = false; throw new Error('Controlled operation failure'); }
      if (command === 'switch_web_hub_tab') fixture.hubState.activeTabId = args.actionId as string;
      if (command === 'close_web_hub_tab') {
        fixture.hubState.tabs = fixture.hubState.tabs.filter((tab) => tab.actionId !== args.actionId);
        if (!fixture.hubState.tabs.some((tab) => tab.actionId === fixture.hubState.activeTabId)) {
          fixture.hubState.activeTabId = fixture.hubState.tabs[0]?.actionId ?? '';
        }
      }
      if (command === 'trigger_web_action') {
        const action = actions.find((item) => item.id === args.actionId)!;
        fixture.hubState.tabs.push({ actionId: action.id, name: action.name, icon: action.icon, url: 'https://example.test/' });
        fixture.hubState.activeTabId = action.id;
      }
      fixture.onHub(structuredClone(fixture.hubState));
      return null;
    },
  };
  Object.assign(window, { chromeFixture: fixture });
  window.addEventListener('resize', () => fixture.place());
  fixture.place();
} else {
  Object.defineProperty(navigator, 'languages', { value: [language] });
  document.documentElement.classList.toggle('dark', params.get('theme') !== 'light');
  const fixture = (parent as unknown as { chromeFixture: {
    onChrome: (layout: WebChromeLayout) => void; onHub: (state: unknown) => void;
    invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
  } }).chromeFixture;
  fixture.onChrome = (layout) => { void emit('web_chrome_layout_changed', layout); };
  fixture.onHub = (state) => { void emit('web_hub_state_changed', state); };
  mockIPC((command, args) => fixture.invoke(command, args as Record<string, unknown>), { shouldMockEvents: true });
  mockWindows(label);
  createRoot(document.getElementById('root')!).render(
    <StrictMode><ThemeProvider style={params.get('style') ?? 'classic'}>
      <WebTitleBar label={label} title="Web workspace" url="https://example.test/" actions={actions} />
    </ThemeProvider></StrictMode>,
  );
}
