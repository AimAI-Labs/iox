import React from 'react';
import { createRoot } from 'react-dom/client';
import { FileSelectionMenu } from '../../src/components/overlay/FileSelectionMenu';
import { I18nProvider } from '../../src/hooks/useTranslation';
import '../../src/App.css';

// Browser-only fixture: exercise the real menu without a running Tauri process.
const params = new URLSearchParams(location.search);
const language = params.get('lang') === 'en' ? 'en' : 'zh';
(window as any).__TAURI_INTERNALS__ = {
  transformCallback: () => 1,
  unregisterCallback: () => {},
  invoke: async (command: string) => {
    if (command === 'get_config') return { general: { language } };
    if (command === 'trigger_web_file_action') throw new Error('The selected files exceed 20 MiB.');
    return 1;
  },
};
if (params.has('dark')) document.documentElement.classList.add('dark');
document.body.style.cssText = 'margin:0;width:360px;height:146px;background:transparent;';
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
        actions={params.has('empty') ? [] : actions} isClosing={false}
        onClose={() => { document.body.dataset.closed = 'true'; }}
        onOpenSettings={() => { document.body.dataset.settings = 'true'; }} />
    </div>
  </I18nProvider>,
);
