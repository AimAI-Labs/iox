import { useCallback, useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  isDragThresholdExceeded,
  isTitleBarToggleGesture,
  resolveTitleBarPress,
} from '@/lib/titleBarGesture';

const DEFAULT_INTERACTIVE =
  'button, .traffic-light, input, select, textarea, a, [data-no-drag="true"]';

interface TitleBarDragOptions {
  onMaximize?: () => void | Promise<void>;
  /** 额外的交互元素选择器，例如 Hub 标签项。 */
  interactiveSelector?: string;
}

/**
 * 单击+位移启动原生拖动，双击切换最大化。
 *
 * 不能在 mousedown 里立即 `startDragging()`：那会把鼠标交给系统移动循环，
 * 第二次点击是否还能带回 `detail === 2` 并不可靠，表现为双击时好时坏。
 */
export function useTitleBarDrag({ onMaximize, interactiveSelector }: TitleBarDragOptions = {}) {
  const pending = useRef<{ x: number; y: number } | null>(null);
  const detach = useRef<(() => void) | null>(null);

  const stopTracking = useCallback(() => {
    detach.current?.();
    detach.current = null;
    pending.current = null;
  }, []);

  useEffect(() => stopTracking, [stopTracking]);

  const isInteractive = useCallback(
    (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(target.closest(interactiveSelector ?? DEFAULT_INTERACTIVE)),
    [interactiveSelector]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (resolveTitleBarPress(event.button, isInteractive(event.target)) !== 'arm-drag') return;
      stopTracking();
      pending.current = { x: event.clientX, y: event.clientY };

      const onMove = (move: MouseEvent) => {
        const start = pending.current;
        if (!start || !isDragThresholdExceeded(move.clientX - start.x, move.clientY - start.y)) {
          return;
        }
        stopTracking();
        getCurrentWebviewWindow().startDragging().catch((error) => {
          console.warn('startDragging failed:', error);
        });
      };
      const onUp = () => stopTracking();

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('blur', onUp);
      detach.current = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('blur', onUp);
      };
    },
    [isInteractive, stopTracking]
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!onMaximize || !isTitleBarToggleGesture(event.button, isInteractive(event.target))) {
        return;
      }
      event.preventDefault();
      void onMaximize();
    },
    [isInteractive, onMaximize]
  );

  return { handleMouseDown, handleDoubleClick };
}
