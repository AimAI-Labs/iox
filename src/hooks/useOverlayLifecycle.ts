import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { OverlayMode } from '@/state/overlayReducer';
import { ActionConfig } from '@/types/config';
import { calculateBubbleWidth } from '@/utils/bubbleWidth';

interface UseOverlayLifecycleProps {
  actions?: ActionConfig[];
  iconOnly?: boolean;
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
  setIsClosing: (closing: boolean) => void;
  onHideComplete: () => void;
}

export function useOverlayLifecycle({
  actions,
  iconOnly = false,
  isPinned,
  setIsPinned,
  setIsClosing,
  onHideComplete,
}: UseOverlayLifecycleProps) {
  const isPinnedRef = useRef<boolean>(isPinned);
  isPinnedRef.current = isPinned;
  const actionsRef = useRef<ActionConfig[] | undefined>(actions);
  actionsRef.current = actions;
  const iconOnlyRef = useRef<boolean>(iconOnly);
  iconOnlyRef.current = iconOnly;
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 调整窗口尺寸并同步模式到 Rust 端
  const updateWindowSize = useCallback(
    async (
      newMode: OverlayMode,
      allowFocus = false,
      customSize?: { width: number; height: number }
    ) => {
      // 同步模式到 Rust 端，供键盘钩子判断消失逻辑
      invoke('set_overlay_mode', { mode: newMode }).catch(() => {});
      if (newMode === 'bubble') {
        const width = calculateBubbleWidth(actionsRef.current, iconOnlyRef.current);
        await invoke('resize_overlay', { width, height: 46, allowFocus: false });
      } else {
        const width = customSize?.width || 460;
        const height = customSize?.height || 420;
        await invoke('resize_overlay', { width, height, allowFocus });
      }
    },
    []
  );

  // 组件加载时同步初始钉住状态至 Rust 后端
  const hasSyncedInitialPin = useRef(false);
  if (!hasSyncedInitialPin.current) {
    hasSyncedInitialPin.current = true;
    invoke('set_pin_state', { pinned: isPinned }).catch(() => {});
  }

  // 执行平滑退场动画并隐藏窗口 (force = true 时允许主动关闭固定窗口)
  const executeGracefulHide = useCallback(
    (force = false) => {
      if (isPinnedRef.current && !force) return;
      setIsClosing(true);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      closeTimerRef.current = setTimeout(async () => {
        await invoke('hide_overlay');
        onHideComplete();
      }, 100);
    },
    [setIsClosing, onHideComplete]
  );

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

  // 主动关闭悬浮窗（隐藏窗口，保留用户记忆的钉住偏好）
  const handleClose = useCallback(async () => {
    executeGracefulHide(true);
  }, [executeGracefulHide]);

  return {
    updateWindowSize,
    executeGracefulHide,
    cancelCloseTimer,
    handlePinToggle,
    handleClose,
  };
}
