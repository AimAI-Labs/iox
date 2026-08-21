import { useReducer } from 'react';
import { AppConfig } from '@/types/config';
import {
  overlayReducer,
  initialOverlayState,
  OverlayMode,
} from '@/state/overlayReducer';
import { useOverlayLifecycle } from '@/hooks/useOverlayLifecycle';
import { useSelectionEvents } from '@/hooks/useSelectionEvents';
import { useActionStream } from '@/hooks/useActionStream';

export type { OverlayMode };

/**
 * 悬浮窗统一状态管理 Facade Hook
 */
export function useOverlayState(config: AppConfig | null) {
  const [state, dispatch] = useReducer(overlayReducer, initialOverlayState);

  // 1. 生命周期与动画控制
  const {
    updateWindowSize,
    handleResetCardSize,
    executeGracefulHide,
    cancelCloseTimer,
    handlePinToggle,
    handleClose,
  } = useOverlayLifecycle({
    actions: config?.actions,
    iconOnly: config?.general.iconOnlyBubble,
    apiCard: config?.apiCard,
    isPinned: state.isPinned,
    currentMode: state.mode,
    setIsPinned: (pinned) => dispatch({ type: 'SET_PINNED', isPinned: pinned }),
    setIsClosing: (closing) => dispatch({ type: 'SET_CLOSING', isClosing: closing }),
    onHideComplete: () => dispatch({ type: 'HIDE_COMPLETE' }),
  });

  // 2. 选词触发与退场事件监听
  useSelectionEvents({
    isPinned: state.isPinned,
    onSelectionTriggered: (text) => dispatch({ type: 'SELECTION_TRIGGERED', text }),
    onRequestHide: executeGracefulHide,
    cancelCloseTimer,
    updateWindowSize,
  });

  // 3. 动作调度与流式处理
  const {
    handleTriggerAction,
    handleSendFollowUp,
    handleProviderChange,
    handleModelChange,
    handleThinkingModeChange,
    handleRegenerateCurrentTurn,
    handleNewChat,
    handleRestoreSession,
    handleExportMarkdown,
    handleCancel,
  } = useActionStream({
    config,
    selectedText: state.selectedText,
    activeAction: state.activeAction,
    selectedModel: state.selectedModel,
    streamText: state.streamText,
    isPinned: state.isPinned,
    thinkingMode: state.thinkingMode,
    onStartAction: (action, model) =>
      dispatch({ type: 'START_ACTION', action, model }),
    onAppendToken: (token) => dispatch({ type: 'APPEND_STREAM_TOKEN', token }),
    onStreamDone: () => dispatch({ type: 'STREAM_DONE' }),
    onStreamError: (error) => dispatch({ type: 'STREAM_ERROR', error }),
    onSetStreamText: (text) => dispatch({ type: 'SET_STREAM_TEXT', text }),
    onSetLoading: (isLoading) => dispatch({ type: 'SET_LOADING', isLoading }),
    onSetError: (error) => dispatch({ type: 'SET_ERROR', error }),
    onSetModel: (model) => dispatch({ type: 'SET_MODEL', model }),
    onSetProvider: (providerId, defaultModel) =>
      dispatch({ type: 'SET_PROVIDER', providerId, defaultModel }),
    onSetThinkingMode: (mode) =>
      dispatch({ type: 'SET_THINKING_MODE', mode }),
    onNewChat: () => dispatch({ type: 'NEW_CHAT' }),
    updateWindowSize,
    executeGracefulHide,
  });

  return {
    mode: state.mode,
    visible: state.visible,
    animKey: state.animKey,
    isClosing: state.isClosing,
    selectedText: state.selectedText,
    activeAction: state.activeAction,
    selectedModel: state.selectedModel,
    streamText: state.streamText,
    isLoading: state.isLoading,
    isPinned: state.isPinned,
    error: state.error,
    thinkingMode: state.thinkingMode,
    handleTriggerAction,
    handleSendFollowUp,
    handleProviderChange,
    handleModelChange,
    handleThinkingModeChange,
    handleRegenerateCurrentTurn,
    handleNewChat,
    handleRestoreSession,
    handleExportMarkdown,
    handleCancel,
    handleClose,
    handlePinToggle,
    handleResetCardSize,
    updateWindowSize,
  };
}
