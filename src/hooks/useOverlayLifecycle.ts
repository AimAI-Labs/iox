import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { OverlayMode } from '@/state/overlayReducer';

interface UseOverlayLifecycleProps {
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
  setIsClosing: (closing: boolean) => void;
}

export function useOverlayLifecycle({
  isPinned,
  setIsPinned,
  setIsClosing,
}: UseOverlayLifecycleProps) {
  const isPinnedRef = useRef<boolean>(isPinned);
  isPinnedRef.current = isPinned;
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 调整窗口尺寸
  const updateWindowSize = useCallback(
    async (
      newMode: OverlayMode,
      allowFocus = false,
      customSize?: { width: number; height: number }
    ) => {
      if (newMode === 'bubble') {
        await invoke('resize_overlay', { width: 500, height: 46, allowFocus: false });
      } else {
        const width = customSize?.width || 460;
        const height = customSize?.height || 420;
        await invoke('resize_overlay', { width, height, allowFocus });
      }
    },
    []
  );

  // 执行平滑退场动画并隐藏窗口
  const executeGracefulHide = useCallback(() => {
    if (isPinnedRef.current) return;
    setIsClosing(true);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(async () => {
      await invoke('hide_overlay');
      setIsClosing(false);
    }, 100);
  }, [setIsClosing]);

  // 取消退场定时器（当新划词触发时调用）
  const cancelCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // 切换 Pin 固定状态
  const handlePinToggle = useCallback(() => {
    const next = !isPinnedRef.current;
    setIsPinned(next);
    invoke('set_pin_state', { pinned: next }).catch(() => {});
  }, [setIsPinned]);

  // 关闭悬浮窗
  const handleClose = useCallback(async () => {
    setIsPinned(false);
    await invoke('set_pin_state', { pinned: false }).catch(() => {});
    executeGracefulHide();
  }, [setIsPinned, executeGracefulHide]);

  return {
    updateWindowSize,
    executeGracefulHide,
    cancelCloseTimer,
    handlePinToggle,
    handleClose,
  };
}
