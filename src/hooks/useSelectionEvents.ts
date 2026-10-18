import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { OverlayMode } from '@/state/overlayReducer';

interface SelectionEventPayload {
  text: string;
  cursorX: number;
  cursorY: number;
}

interface UseSelectionEventsProps {
  isPinned: boolean;
  onSelectionTriggered: (text: string) => void;
  onFilesSelected: (files: string[], dragId: number) => void;
  onRequestHide: () => void;
  cancelCloseTimer: () => void;
  updateWindowSize: (mode: OverlayMode, allowFocus?: boolean) => Promise<void>;
}

export function useSelectionEvents({
  isPinned,
  onSelectionTriggered,
  onFilesSelected,
  onRequestHide,
  cancelCloseTimer,
  updateWindowSize,
}: UseSelectionEventsProps) {
  const isPinnedRef = useRef(isPinned);
  isPinnedRef.current = isPinned;

  useEffect(() => {
    const unlistenSelection = listen<SelectionEventPayload>('selection-triggered', (event) => {
      cancelCloseTimer();
      onSelectionTriggered(event.payload.text);
      // 钉住是跨会话偏好：划词不重置后端 Pin 状态。
      // 后端以「钉住 && 可见 && 卡片态」判定零打扰，气泡态划词照常刷新且 Pin 保留
      updateWindowSize('bubble', false);
    });

    const unlistenRequestHide = listen('request-overlay-hide', () => {
      onRequestHide();
    });

    const unlistenFiles = listen<{ files: string[]; dragId: number }>('files-selected', (event) => {
      if (!event.payload.files.length) return;
      cancelCloseTimer();
      onFilesSelected(event.payload.files, event.payload.dragId);
      // Native selection already sizes and places the menu without taking focus.
    });

    return () => {
      unlistenSelection.then((fn) => fn());
      unlistenRequestHide.then((fn) => fn());
      unlistenFiles.then((fn) => fn());
    };
  }, [onSelectionTriggered, onFilesSelected, onRequestHide, cancelCloseTimer, updateWindowSize]);
}

