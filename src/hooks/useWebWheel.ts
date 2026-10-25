import { useCallback, useEffect, useRef } from 'react';
import type { WebMenuChange, WebMenuLayout } from '@/lib/webChromeClient';

type Update = (change: WebMenuChange) => Promise<boolean>;

export function useWebWheel(layout: WebMenuLayout, update: Update, enabled: boolean) {
  const state = useRef({ layout, update, enabled, inside: false, suspended: false, requested: false,
    openTimer: null as ReturnType<typeof setTimeout> | null,
    closeTimer: null as ReturnType<typeof setTimeout> | null });
  Object.assign(state.current, { layout, update, enabled });

  const clearTimers = useCallback(() => {
    const current = state.current;
    if (current.openTimer !== null) clearTimeout(current.openTimer);
    if (current.closeTimer !== null) clearTimeout(current.closeTimer);
    current.openTimer = current.closeTimer = null;
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    const current = state.current;
    if (current.layout.wheel || current.requested) void current.update({ wheel: false });
    current.requested = false;
  }, [clearTimers]);

  const suspend = useCallback(() => {
    state.current.suspended = true;
    dismiss();
  }, [dismiss]);

  const enter = useCallback(() => {
    const current = state.current;
    current.inside = true;
    if (current.closeTimer !== null) clearTimeout(current.closeTimer);
    current.closeTimer = null;
    if (!current.enabled || current.suspended || current.layout.expanded || current.layout.wheel || current.requested || current.openTimer !== null) return;
    current.openTimer = setTimeout(() => {
      current.openTimer = null;
      if (!current.inside || current.suspended || !current.enabled || current.layout.expanded) return;
      current.requested = true;
      void current.update({ wheel: true }).then((accepted) => { if (!accepted) current.requested = false; });
    }, 250);
  }, []);

  const leave = useCallback(() => {
    const current = state.current;
    clearTimers();
    current.inside = false;
    current.suspended = false;
    if (current.layout.wheel || current.requested) {
      current.closeTimer = setTimeout(dismiss, 180);
    }
  }, [clearTimers, dismiss]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') suspend(); };
    window.addEventListener('blur', dismiss);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimers();
      window.removeEventListener('blur', dismiss);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [clearTimers, dismiss, suspend]);

  useEffect(() => { if (!enabled) dismiss(); }, [enabled, dismiss]);

  return { enter, leave, suspend, dismiss };
}
