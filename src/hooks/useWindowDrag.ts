import React, { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isDragThresholdExceeded, resolveTitleBarPress } from '@/lib/titleBarGesture';

export function useWindowDrag() {
  const detachRef = useRef<(() => void) | null>(null);

  const stopTracking = useCallback(() => {
    detachRef.current?.();
    detachRef.current = null;
  }, []);

  useEffect(() => stopTracking, [stopTracking]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const interactive = Boolean(
        target?.closest('button, .traffic-light, input, select, textarea, a, [data-no-drag="true"]')
      );
      if (resolveTitleBarPress(e.button, interactive, e.detail) !== 'arm-drag') {
        stopTracking();
        return;
      }

      e.preventDefault();
      stopTracking();
      const startX = e.clientX;
      const startY = e.clientY;

      const onMove = (move: MouseEvent) => {
        if (!isDragThresholdExceeded(move.clientX - startX, move.clientY - startY)) {
          return;
        }
        stopTracking();
        // 触发 Rust 专用后台线程执行 120FPS 物理光标极速硬件级跟随（整次拖拽仅 1 次 IPC）
        invoke('start_overlay_dragging').catch(() => {});
      };
      const onUp = () => stopTracking();

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('blur', onUp);
      detachRef.current = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('blur', onUp);
      };
    },
    [stopTracking]
  );

  return {
    handleMouseDown,
    handlePointerDown: handleMouseDown,
  };
}
