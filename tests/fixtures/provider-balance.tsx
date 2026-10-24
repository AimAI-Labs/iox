import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PromptBar } from '../../src/components/overlay/PromptBar';
import '../../src/App.css';

const params = new URLSearchParams(location.search);
const language = params.get('lang') ?? 'zh-CN';
Object.defineProperty(navigator, 'languages', { value: [language] });
document.documentElement.classList.toggle('dark', params.get('theme') !== 'light');
document.documentElement.dataset.uiStyle = params.get('style') ?? 'classic';

const fixture = {
  mode: params.get('mode') ?? 'normal',
  calls: [] as { providerId: string }[],
};
Object.assign(window, {
  balanceFixture: fixture,
  __TAURI_INTERNALS__: {
    invoke: async (command: string, args: { providerId: string }) => {
      if (command !== 'fetch_provider_balance') return null;
      fixture.calls.push({ providerId: args.providerId });
      if (fixture.mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 2000));
      if (fixture.mode === 'error') throw 'network';
      if (fixture.mode === 'changed') throw 'configChanged';
      const primary = {
        currency: fixture.mode === 'usd' ? 'USD' as const : 'CNY' as const,
        totalBalance: args.providerId === 'second' ? '99.00' : '12.3400',
        grantedBalance: '2.00', toppedUpBalance: '10.3400',
      };
      return {
        isAvailable: fixture.mode !== 'insufficient',
        balanceInfos: fixture.mode === 'multi' ? [
          { ...primary, currency: 'USD', totalBalance: '7.89' }, primary,
        ] : [primary],
      };
    },
  },
});

const providers = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: params.has('missing') ? '' : 'fixture-key', models: ['deepseek-chat'], defaultModel: 'deepseek-chat', enabled: !params.has('disabled') },
  { id: 'second', name: 'DeepSeek 2', baseUrl: 'https://api.deepseek.com/v1', apiKey: 'other-fixture-key', models: ['deepseek-chat'], defaultModel: 'deepseek-chat', enabled: true },
  { id: 'other', name: 'Other', baseUrl: 'https://example.com/v1', apiKey: 'fixture-key', models: ['other-model'], defaultModel: 'other-model', enabled: true },
];

function Fixture() {
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState('deepseek');
  const [mounted, setMounted] = useState(true);
  return (
    <main style={{ position: 'fixed', inset: 0, background: 'var(--bg-card)', color: 'var(--ink)' }}>
      <div data-controls style={{ display: 'flex', gap: 12, padding: 16, fontSize: 12 }}>
        <button onClick={() => setSelected('second')}>Second account</button>
        <button onClick={() => setSelected('other')}>Other provider</button>
        <button onClick={() => setMounted(!mounted)}>Toggle card</button>
      </div>
      <div style={{ position: 'absolute', bottom: 8, left: 4, right: 4 }}>
        {mounted && <PromptBar value={value} onChange={setValue} onSubmit={() => {}} onCancel={() => {}}
          isLoading={false} providers={providers} selectedProviderId={selected} selectedModel="deepseek-chat"
          onProviderChange={setSelected} thinkingMode="quick"
          contextUsage={{ estimatedTokens: 640, selectionTokens: 200, historyTokens: 400, draftTokens: 40, usedTurns: 3, maxTurns: 5 }}
        />}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
