import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

const FADE_OUT_MS = 700;

export function StreamingCursor({ active, className }: { active: boolean; className?: string }) {
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(false), FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!active && !visible) return null;

  return (
    <span
      aria-hidden="true"
      data-active={active}
      className={cn('stream-cursor', className)}
      style={{ '--cursor-fade-duration': `${FADE_OUT_MS}ms` } as CSSProperties}
    />
  );
}
