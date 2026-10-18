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
document.body.style.cssText = 'margin:0;width:360px;height:194px;background:transparent;';
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
        dragId={42} actions={params.has('empty') ? [] : actions} isClosing={false}
        onClose={() => { document.body.dataset.closed = 'true'; }}
        onOpenSettings={() => { document.body.dataset.settings = 'true'; }} />
    </div>
  </I18nProvider>,
);
