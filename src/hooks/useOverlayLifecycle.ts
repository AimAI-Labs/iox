import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { OverlayMode } from '@/state/overlayReducer';
import { ActionConfig, ApiCardConfig } from '@/types/config';
import { calculateBubbleWidth } from '@/utils/bubbleWidth';

interface UseOverlayLifecycleProps {
  actions?: ActionConfig[];
  iconOnly?: boolean;
  apiCard?: ApiCardConfig;
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
  setIsClosing: (closing: boolean) => void;
  onHideComplete: () => void;
  onHideStart?: () => void;
}

export function useOverlayLifecycle({
  actions,
  iconOnly = false,
  apiCard,
  isPinned,
  setIsPinned,
  setIsClosing,
  onHideComplete,
  onHideStart,
}: UseOverlayLifecycleProps) {
  const isPinnedRef = useRef<boolean>(isPinned);
  isPinnedRef.current = isPinned;
  const actionsRef = useRef<ActionConfig[] | undefined>(actions);
  actionsRef.current = actions;
  const iconOnlyRef = useRef<boolean>(iconOnly);
  iconOnlyRef.current = iconOnly;
  const apiCardRef = useRef<ApiCardConfig | undefined>(apiCard);
  apiCardRef.current = apiCard;
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeGenerationRef = useRef(0);

  // 提交形态与尺寸：形态政策与原生几何由同一个命令消费，避免两者交错
  const updateWindowSize = useCallback(
    async (
      newMode: OverlayMode,
      allowFocus = false,
      customSize?: { width: number; height: number }
    ) => {
      if (newMode === 'bubble') {
        const width = calculateBubbleWidth(actionsRef.current, iconOnlyRef.current);
        await invoke('layout_overlay', { mode: 'bubble', width, height: 46, allowFocus: false });
        return;
      }

      const defaultCardSize = apiCardRef.current?.cardSize || [600, 900];
      const width = customSize?.width || defaultCardSize[0] || 600;
      const height = customSize?.height || defaultCardSize[1] || 900;
      const shouldFocus = allowFocus || (apiCardRef.current?.autoFocusInput ?? false);
      await invoke('layout_overlay', { mode: 'card', width, height, allowFocus: shouldFocus });

      // 若配置了展开时自动 Pin 固定，自动同步钉住状态
      if (apiCardRef.current?.autoPinOnOpen && !isPinnedRef.current) {
        setIsPinned(true);
        invoke('set_pin_state', { pinned: true }).catch(() => {});
      }
    },
    [setIsPinned]
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

  // 执行平滑退场动画并隐藏窗口。
  // 「是否允许退场」由调用方决定：原生退场请求已由后端 overlay 政策过滤，
  // 前端只在气泡态或未固定卡片上发起主动关闭，这里不再复制 pin/形态规则。
  const executeGracefulHide = useCallback(() => {
    onHideStart?.();
    setIsClosing(true);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    const generation = ++closeGenerationRef.current;
    closeTimerRef.current = setTimeout(async () => {
      await invoke('hide_overlay');
      if (closeGenerationRef.current === generation) onHideComplete();
    }, 100);
  }, [setIsClosing, onHideComplete, onHideStart]);

  // 取消退场定时器（当新划词触发时调用）
  const cancelCloseTimer = useCallback(() => {
    closeGenerationRef.current += 1;
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

  // 用户主动关闭悬浮窗（允许越过 pin；钉住偏好由 localStorage 记忆保留，
  // 隐藏后的残留 pin 不会拦截后续划词——后端只保护「钉住且可见的卡片」）
  const handleClose = useCallback(async () => {
    executeGracefulHide();
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
