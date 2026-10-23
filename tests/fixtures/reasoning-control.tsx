import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PromptBar } from '../../src/components/overlay/PromptBar';
import { I18nProvider } from '../../src/hooks/useTranslation';
import type { ThinkingMode } from '../../src/lib/reasoning';
import '../../src/App.css';

function Fixture() {
  const [mode, setMode] = useState<ThinkingMode>('quick');
  const [value, setValue] = useState('');
  const [deepseek, setDeepseek] = useState(true);
  const provider = {
    id: deepseek ? 'deepseek' : 'other', name: deepseek ? 'DeepSeek' : 'Other',
    baseUrl: deepseek ? 'https://api.deepseek.com' : 'https://example.com',
    apiKey: '', models: ['deepseek-flash'], defaultModel: 'deepseek-flash',
  };
  return (
    <I18nProvider languageSetting="zh">
      <main style={{ width: 420, height: 520, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <button onClick={() => setDeepseek(!deepseek)}>切换服务商</button>
          <button onClick={() => document.documentElement.classList.toggle('dark')}>切换主题</button>
          <output aria-label="selected mode">{mode}</output>
        </div>
        <PromptBar
          value={value} onChange={setValue} onSubmit={() => {}} onCancel={() => {}} isLoading={false}
          providers={[provider]} selectedProviderId={provider.id} selectedModel={provider.defaultModel}
          thinkingMode={mode} onThinkingModeChange={setMode}
        />
      </main>
    </I18nProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
