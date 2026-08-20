import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { OverlayMode } from '@/state/overlayReducer';
import { ActionConfig } from '@/types/config';
import { calculateBubbleWidth } from '@/utils/bubbleWidth';

interface UseOverlayLifecycleProps {
  actions?: ActionConfig[];
  iconOnly?: boolean;
  apiCardSize?: [number, number];
  isPinned: boolean;
  currentMode: OverlayMode;
  setIsPinned: (pinned: boolean) => void;
  setIsClosing: (closing: boolean) => void;
  onHideComplete: () => void;
}

export function useOverlayLifecycle({
  actions,
  iconOnly = false,
  apiCardSize,
  isPinned,
  currentMode,
  setIsPinned,
  setIsClosing,
  onHideComplete,
}: UseOverlayLifecycleProps) {
  const isPinnedRef = useRef<boolean>(isPinned);
  isPinnedRef.current = isPinned;
  const currentModeRef = useRef<OverlayMode>(currentMode);
  currentModeRef.current = currentMode;
  const actionsRef = useRef<ActionConfig[] | undefined>(actions);
  actionsRef.current = actions;
  const iconOnlyRef = useRef<boolean>(iconOnly);
  iconOnlyRef.current = iconOnly;
  const apiCardSizeRef = useRef<[number, number] | undefined>(apiCardSize);
  apiCardSizeRef.current = apiCardSize;
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 调整窗口尺寸并同步模式到 Rust 端
  const updateWindowSize = useCallback(
    async (
      newMode: OverlayMode,
      allowFocus = false,
      customSize?: { width: number; height: number }
    ) => {
      currentModeRef.current = newMode;
      // 同步模式到 Rust 端，供键盘钩子判断消失逻辑
      invoke('set_overlay_mode', { mode: newMode }).catch(() => {});
      if (newMode === 'bubble') {
        const width = calculateBubbleWidth(actionsRef.current, iconOnlyRef.current);
        await invoke('resize_overlay', { width, height: 46, allowFocus: false });
      } else {
        const defaultCardSize = apiCardSizeRef.current || [600, 900];
        const width = customSize?.width || defaultCardSize[0] || 600;
        const height = customSize?.height || defaultCardSize[1] || 900;
        await invoke('resize_overlay', { width, height, allowFocus });
      }
    },
    []
  );

  // 一键重置卡片尺寸为 600x900px
  const handleResetCardSize = useCallback(async () => {
    await updateWindowSize('card', true, { width: 600, height: 900 });
    await invoke('save_api_card_size', { width: 600.0, height: 900.0 }).catch(() => {});
  }, [updateWindowSize]);

  // 组件加载时同步初始钉住状态至 Rust 后端
  const hasSyncedInitialPin = useRef(false);
  if (!hasSyncedInitialPin.current) {
    hasSyncedInitialPin.current = true;
    invoke('set_pin_state', { pinned: isPinned }).catch(() => {});
  }

  // 执行平滑退场动画并隐藏窗口 (force = true 时允许主动关闭固定窗口)
  const executeGracefulHide = useCallback(
    (force = false) => {
      // 关键修复：钉住 (Pin) 仅对 Card 态生效！Bubble 气泡态永远允许退场隐藏
      if (isPinnedRef.current && currentModeRef.current === 'card' && !force) return;
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

  // 主动关闭悬浮窗（强制隐藏；钉住偏好由 localStorage 记忆保留，
  // 隐藏后的残留 Pin 不会拦截后续划词——后端以「钉住 && 可见 && 卡片态」判定零打扰）
  const handleClose = useCallback(async () => {
    executeGracefulHide(true);
  }, [executeGracefulHide]);

  return {
    updateWindowSize,
    handleResetCardSize,
    executeGracefulHide,
    cancelCloseTimer,
    handlePinToggle,
    handleClose,
  };
}
