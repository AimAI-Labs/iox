import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UserBubble } from '../../src/components/overlay/UserBubble';
import { I18nProvider } from '../../src/hooks/useTranslation';
import '../../src/App.css';

function Fixture() {
  const [content, setContent] = useState('Original sent message');
  const [editing, setEditing] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const ctrlEnter = new URLSearchParams(location.search).has('ctrl');
  return (
    <I18nProvider languageSetting="en">
      <main className="m-4 w-[380px] rounded-2xl bg-white p-4 dark:bg-zinc-900">
        <UserBubble
          content={content} isEditing={editing} editDisabled={disabled}
          sendKeyShortcut={ctrlEnter ? 'Ctrl+Enter' : 'Enter'}
          onStartEdit={() => setEditing(true)} onCancelEdit={() => setEditing(false)}
          onSubmitEdit={(value) => { setContent(value.trim()); setEditing(false); }}
        />
        <textarea aria-label="Bottom draft" defaultValue="Untouched bottom draft" />
        <button onClick={() => setDisabled(!disabled)}>Toggle loading</button>
        <button onClick={() => document.documentElement.classList.toggle('dark')}>Toggle theme</button>
      </main>
    </I18nProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
