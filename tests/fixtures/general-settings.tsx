import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GeneralTab } from '../../src/components/settings/GeneralTab';
import { I18nProvider } from '../../src/hooks/useTranslation';
import type { GeneralConfig } from '../../src/types/config';
import '../../src/App.css';

const language = new URLSearchParams(location.search).has('en') ? 'en' : 'zh';
const initial: GeneralConfig = {
  autoPopupOnSelection: true,
  autoPopupOnFileSelection: false,
  minSelectionLength: 1,
  triggerModifier: 'None',
  globalHotkey: 'Alt+Space',
  theme: 'light',
  autoStart: false,
  webWindowMode: 'multi_window',
  autoCopyOnWebAction: false,
  language,
};
document.body.style.cssText = 'margin:0;background:hsl(var(--background));color:hsl(var(--foreground));';

function Fixture() {
  const [general, setGeneral] = useState(initial);
  return (
    <I18nProvider languageSetting={language}>
      <main style={{ maxWidth: 800, margin: '24px auto' }}>
        <GeneralTab general={general} onUpdateGeneral={(updated) => {
          setGeneral((current) => {
            const next = { ...current, ...updated };
            (window as any).testGeneral = next;
            return next;
          });
        }} />
      </main>
    </I18nProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
