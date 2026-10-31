import { createRoot } from 'react-dom/client';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import { WebFrame } from '../../src/components/web/WebFrame';
import { ThemeProvider } from '../../src/themes/ThemeProvider';
import type { WebHubState } from '../../src/types/config';
import { appConfigSchema } from '../../src/types/config';
import config from './config/default-config.zh.json';
import '../../src/App.css';

const params = new URLSearchParams(location.search);
const hub = params.has('hub');
const state: WebHubState = {
  tabs: [
    { actionId: 'act_web_deepseek', name: 'DeepSeek', icon: 'DeepSeek', url: 'https://example.test/' },
    { actionId: 'act_web_qwen', name: 'Qwen', icon: 'Qwen', url: 'https://example.test/' },
  ],
  activeTabId: 'act_web_deepseek',
};
mockIPC((command) => command === 'get_web_hub_state' ? state : null, { shouldMockEvents: true });
mockWindows(hub ? 'web_hub' : 'web_win_act_web_deepseek');
Object.assign(window, { switchFrameTab: (actionId: string) => {
  state.activeTabId = actionId;
  return emit('web_hub_state_changed', structuredClone(state));
} });
createRoot(document.getElementById('root')!).render(
  <ThemeProvider style="classic"><WebFrame label={hub ? 'web_hub' : 'web_win_act_web_deepseek'} actions={appConfigSchema.parse(config).actions} /></ThemeProvider>,
);
