import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getIconThemeColor } from '@/components/Icons';
import type { ActionConfig, WebHubState } from '@/types/config';

export function actionForWebWindow(actions: ActionConfig[], label: string) {
  return actions.find((item) => `web_win_${item.id.replace(/[^\p{L}\p{N}_-]/gu, '_')}` === label);
}

/** The native region clips this local view to the four edges of a headless card. */
export function WebFrame({ label, actions }: { label: string; actions: ActionConfig[] }) {
  const [hubState, setHubState] = useState<WebHubState>({ tabs: [], activeTabId: null });
  const hub = label === 'web_hub';
  useEffect(() => {
    if (!hub) return;
    let disposed = false;
    let events = 0;
    let cleanup: (() => void) | undefined;
    void listen<WebHubState>('web_hub_state_changed', (event) => {
      events++;
      if (!disposed) setHubState(event.payload);
    }).then(async (unlisten) => {
      if (disposed) { unlisten(); return; }
      cleanup = unlisten;
      const beforeRead = events;
      const state = await invoke<WebHubState>('get_web_hub_state');
      if (!disposed && events === beforeRead) setHubState(state);
    }).catch((error) => console.warn('Failed to get Web Hub frame state:', error));
    return () => { disposed = true; cleanup?.(); };
  }, [hub]);

  const tab = hubState.tabs.find((item) => item.actionId === hubState.activeTabId);
  const icon = hub
    ? actions.find((item) => item.id === tab?.actionId)?.icon ?? tab?.icon
    : actionForWebWindow(actions, label)?.icon;
  const color = getIconThemeColor(icon);
  return <div aria-hidden className="pointer-events-none fixed inset-0 bg-black/10 dark:bg-white/10"
    style={color ? { backgroundColor: color } : undefined} />;
}
