import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import { WebTitleBar } from '../../src/components/web/WebTitleBar';
import { ThemeProvider } from '../../src/themes/ThemeProvider';
import { WebviewTab } from '../../src/components/settings/WebviewTab';
import { I18nProvider } from '../../src/hooks/useTranslation';
import { appConfigSchema, DEFAULT_WEB_MENU_PINNED_ACTIONS, type WebMenuActionId } from '../../src/types/config';
import defaultConfig from './config/default-config.zh.json';
import '../../src/App.css';
import type { WebChromeLayout, WebMenuChange } from '../../src/lib/webChromeClient';

const params = new URLSearchParams(location.search);
const hub = params.has('hub');
const language = params.get('lang') ?? 'en-US';
const label = hub ? 'web_hub' : 'web_win_fixture';
const actions = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((name) => ({
  id: name.toLowerCase(), name, icon: 'Globe', enabled: true, actionType: 'web' as const,
}));

if (params.has('settings')) {
  const initial = appConfigSchema.parse(defaultConfig);
  function SettingsFixture() {
    const [general, setGeneral] = useState(initial.general);
    Object.assign(window, { testGeneral: general });
    return <ThemeProvider style="classic"><I18nProvider languageSetting={language.startsWith('zh') ? 'zh' : 'en'}>
      <main style={{ maxWidth: 800, margin: '24px auto' }}>
        <WebviewTab general={general} actions={[]} onUpdateGeneral={(changes) => setGeneral((current) => ({ ...current, ...changes }))} />
      </main>
    </I18nProvider></ThemeProvider>;
  }
  createRoot(document.getElementById('root')!).render(<SettingsFixture />);
} else if (!params.has('bar')) {
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
    heldLayout: null as Promise<void> | null,
    releaseLayout: () => {},
    holdLayouts() { fixture.heldLayout = new Promise<void>((resolve) => { fixture.releaseLayout = () => { fixture.heldLayout = null; resolve(); }; }); },
    heldPin: null as Promise<void> | null,
    rejectPin: () => {},
    holdPin() { fixture.heldPin = new Promise<void>((_, reject) => { fixture.rejectPin = () => { fixture.heldPin = null; reject(new Error('Controlled pin failure')); }; }); },
    pins: JSON.parse(localStorage.getItem('web-wheel-fixture-pins') ?? JSON.stringify(DEFAULT_WEB_MENU_PINNED_ACTIONS)) as WebMenuActionId[],
    onPins: (_pins: WebMenuActionId[]) => {},
    setPins(pins: WebMenuActionId[]) { fixture.pins = pins; fixture.onPins([...pins]); },
    holdDelay: Number(params.get('holdDelay') ?? 300),
    onDelay: (_delay: number) => {},
    setDelay(delay: number) { fixture.holdDelay = delay; fixture.onDelay(delay); },
    layout: { revision: 0, headless: true, menu: { x: innerWidth - 56, y: 12, width: 44, height: 44, expanded: false, wheel: false, buttonX: 0, buttonY: 0 } } as WebChromeLayout,
    hubState: { tabs: actions.slice(0, 3).map((action) => ({ actionId: action.id, name: action.name, icon: action.icon, url: 'https://example.test/' })), activeTabId: 'beta' },
    onChrome: (_layout: WebChromeLayout) => {},
    onHub: (_state: unknown) => {},
    place(changes: WebMenuChange = {}) {
      const old = fixture.layout.menu;
      const wheel = fixture.layout.headless && (changes.wheel ?? (changes.expanded === undefined && old.wheel));
      const expanded = fixture.layout.headless && !wheel && (changes.expanded ?? old.expanded);
      const width = Math.max(1, Math.min(expanded || wheel ? 280 : 44, innerWidth - 24));
      const height = Math.max(1, Math.min(expanded ? (hub ? 560 : 360) : wheel ? 280 : 44, innerHeight - 24));
      const anchorX = old.x + old.buttonX;
      const anchorY = old.y + old.buttonY;
      const [x, y] = changes.position ?? [anchorX + 44 - (wheel ? width / 2 + 22 : width), anchorY - (wheel ? height / 2 - 22 : 0)];
      const left = Math.max(12, Math.min(x, innerWidth - width - 12));
      const top = Math.max(12, Math.min(y, innerHeight - height - 12));
      const menu = {
        x: left, y: top, width, height, expanded, wheel,
        buttonX: wheel ? Math.max(0, Math.min(width - 44, anchorX - left)) : expanded ? width - 44 : 0,
        buttonY: wheel ? Math.max(0, Math.min(height - 44, anchorY - top)) : 0,
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
      if (command === 'layout_web_menu') { if (fixture.heldLayout) await fixture.heldLayout; return fixture.place(args as WebMenuChange); }
      if (command === 'get_web_hub_state') return structuredClone(fixture.hubState);
      if (fixture.failNext) { fixture.failNext = false; throw new Error('Controlled operation failure'); }
      if (command === 'set_web_menu_action_pinned') {
        if (fixture.heldPin) await fixture.heldPin;
        const id = args.actionId as WebMenuActionId;
        fixture.setPins(args.pinned ? [...fixture.pins.filter(item => item !== id), id] : fixture.pins.filter(item => item !== id));
        localStorage.setItem('web-wheel-fixture-pins', JSON.stringify(fixture.pins));
        return [...fixture.pins];
      }
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
  window.addEventListener('storage', (event) => {
    if (event.key === 'web-wheel-fixture-pins' && event.newValue) fixture.setPins(JSON.parse(event.newValue));
  });
  fixture.place();
} else {
  Object.defineProperty(navigator, 'languages', { value: [language] });
  document.documentElement.classList.toggle('dark', params.get('theme') !== 'light');
  const fixture = (parent as unknown as { chromeFixture: {
    onChrome: (layout: WebChromeLayout) => void; onHub: (state: unknown) => void;
    invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
    holdDelay: number; onDelay: (delay: number) => void;
    pins: WebMenuActionId[]; onPins: (pins: WebMenuActionId[]) => void;
  } }).chromeFixture;
  fixture.onChrome = (layout) => { void emit('web_chrome_layout_changed', layout); };
  fixture.onHub = (state) => { void emit('web_hub_state_changed', state); };
  mockIPC((command, args) => fixture.invoke(command, args as Record<string, unknown>), { shouldMockEvents: true });
  mockWindows(label);
  function ToolbarFixture() {
    const [delay, setDelay] = useState(fixture.holdDelay);
    const [pins, setPins] = useState(fixture.pins);
    fixture.onDelay = setDelay;
    fixture.onPins = setPins;
    return <WebTitleBar label={label} title="Web workspace" url="https://example.test/" actions={actions} dragHoldDelayMs={delay} pinnedActions={pins} />;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode><ThemeProvider style={params.get('style') ?? 'classic'}>
      <ToolbarFixture />
    </ThemeProvider></StrictMode>,
  );
}
