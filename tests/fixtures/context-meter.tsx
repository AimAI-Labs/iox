import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ContextMeter } from '../../src/components/overlay/ContextMeter';
import '../../src/App.css';

const params = new URLSearchParams(location.search);
const isZh = params.get('lang') !== 'en';
document.documentElement.classList.toggle('dark', params.get('theme') !== 'light');
document.documentElement.dataset.uiStyle = params.get('style') ?? 'classic';

function Fixture() {
  const [usedTurns, setUsedTurns] = useState(3);
  const [escapes, setEscapes] = useState(0);
  const maxTurns = params.has('disabled') ? 0 : 5;
  const usage = {
    estimatedTokens: 57712, selectionTokens: 6514, historyTokens: 50432, draftTokens: 766,
    usedTurns: Math.min(usedTurns, maxTurns), maxTurns,
  };
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEscapes((count) => count + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <main style={{ position: 'fixed', inset: 16, color: 'var(--ink)', background: 'var(--bg-card)', borderRadius: 20, overflow: 'hidden' }}>
      <div style={{ padding: 24 }}>
        <button onClick={() => setUsedTurns(5)}>Fill history</button>
        <output aria-label="Escapes reaching card">{escapes}</output>
      </div>
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <ContextMeter usage={usage} isZh={isZh} />
        <button>Send</button>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
