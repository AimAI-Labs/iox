import React from 'react';
import { createRoot } from 'react-dom/client';
import { FileSelectionMenu } from '../../src/components/overlay/FileSelectionMenu';
import { I18nProvider } from '../../src/hooks/useTranslation';
import '../../src/App.css';

// Browser-only fixture: exercise the real menu without a running Tauri process.
const params = new URLSearchParams(location.search);
const language = params.get('lang') === 'en' ? 'en' : 'zh';
const callbacks = new Map<number, (event: unknown) => void>();
const listeners = new Map<number, { event: string; handler: number }>();
let nextId = 0;
(window as any).fileCalls = [];
(window as any).emitFileEvent = (event: string, payload: unknown) => {
  for (const [id, listener] of listeners) {
    if (listener.event === event) callbacks.get(listener.handler)?.({ event, id, payload });
  }
};
(window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (_event: string, id: number) => listeners.delete(id) };
(window as any).__TAURI_INTERNALS__ = {
  transformCallback: (callback: (event: unknown) => void) => {
    callbacks.set(++nextId, callback);
    return nextId;
  },
  unregisterCallback: (id: number) => { callbacks.delete(id); },
  invoke: async (command: string, args: any) => {
    if (command === 'plugin:event|listen') {
      listeners.set(++nextId, { event: args.event, handler: args.handler });
      return nextId;
    }
    if (command === 'plugin:event|unlisten') { listeners.delete(args.eventId); return; }
    if (command === 'get_config') return { general: { language } };
    if (command === 'trigger_web_file_action') {
      (window as any).fileCalls.push(args);
      if (!params.has('success')) throw new Error('The selected files exceed 20 MiB.');
    }
    return 1;
  },
};
if (params.has('dark')) document.documentElement.classList.add('dark');
document.body.style.cssText = 'margin:0;width:373px;height:120px;background:transparent;';
const layout = {
  width: 373, height: 120,
  buttons: [
    { x: 18.34, y: 21.34, rotation: -10 }, { x: 82.34, y: 15.34, rotation: -5 },
    { x: 146.34, y: 13.34, rotation: 0 }, { x: 210.34, y: 15.34, rotation: 5 },
    { x: 274.34, y: 21.34, rotation: 10 },
  ],
};
const actions = [
  { id: 'copy', name: '复制', icon: 'copy', actionType: 'copy' as const, enabled: true },
  ...['豆包', '千问', 'ChatGPT', 'Kimi', 'DeepSeek'].map((name, index) => ({
    id: `web-${index}`, name, icon: 'bot', actionType: 'web' as const, enabled: true,
  })),
];
createRoot(document.getElementById('root')!).render(
  <I18nProvider languageSetting={language}>
    <div className="overlay-root">
      <FileSelectionMenu files={['C:\\文档\\项目需求与进度报告.pdf', 'C:\\图片\\设计稿.png']}
        dragId={42} layout={layout} actions={params.has('empty') ? [] : actions} isClosing={false}
        onClose={() => { document.body.dataset.closed = 'true'; }} />
    </div>
  </I18nProvider>,
);
