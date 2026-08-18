import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { OverlayMode } from '@/state/overlayReducer';

interface SelectionEventPayload {
  text: string;
  cursorX: number;
  cursorY: number;
}

interface UseSelectionEventsProps {
  onSelectionTriggered: (text: string) => void;
  onRequestHide: () => void;
  cancelCloseTimer: () => void;
  updateWindowSize: (mode: OverlayMode, allowFocus?: boolean) => Promise<void>;
}

export function useSelectionEvents({
  onSelectionTriggered,
  onRequestHide,
  cancelCloseTimer,
  updateWindowSize,
}: UseSelectionEventsProps) {
  useEffect(() => {
    const unlistenSelection = listen<SelectionEventPayload>('selection-triggered', (event) => {
      cancelCloseTimer();
      onSelectionTriggered(event.payload.text);
      invoke('set_pin_state', { pinned: false }).catch(() => {});
      updateWindowSize('bubble', false);
    });

    const unlistenRequestHide = listen('request-overlay-hide', () => {
      onRequestHide();
    });

    return () => {
      unlistenSelection.then((fn) => fn());
      unlistenRequestHide.then((fn) => fn());
    };
  }, [onSelectionTriggered, onRequestHide, cancelCloseTimer, updateWindowSize]);
}
