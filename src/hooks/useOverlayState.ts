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
    executeGracefulHide,
    cancelCloseTimer,
    handlePinToggle,
    handleClose,
  } = useOverlayLifecycle({
    isPinned: state.isPinned,
    setIsPinned: (pinned) => dispatch({ type: 'SET_PINNED', isPinned: pinned }),
    setIsClosing: (closing) => dispatch({ type: 'SET_CLOSING', isClosing: closing }),
  });

  // 2. 选词触发与退场事件监听
  useSelectionEvents({
    onSelectionTriggered: (text) => dispatch({ type: 'SELECTION_TRIGGERED', text }),
    onRequestHide: executeGracefulHide,
    cancelCloseTimer,
    updateWindowSize,
  });

  // 3. 动作调度与流式处理
  const {
    handleTriggerAction,
    handleSendFollowUp,
    handleModelChange,
    handleCancel,
  } = useActionStream({
    config,
    selectedText: state.selectedText,
    activeAction: state.activeAction,
    selectedModel: state.selectedModel,
    streamText: state.streamText,
    isPinned: state.isPinned,
    onStartAction: (action, model, isWebCard) =>
      dispatch({ type: 'START_ACTION', action, model, isWebCard }),
    onAppendToken: (token) => dispatch({ type: 'APPEND_STREAM_TOKEN', token }),
    onStreamDone: () => dispatch({ type: 'STREAM_DONE' }),
    onStreamError: (error) => dispatch({ type: 'STREAM_ERROR', error }),
    onSetStreamText: (text) => dispatch({ type: 'SET_STREAM_TEXT', text }),
    onSetLoading: (isLoading) => dispatch({ type: 'SET_LOADING', isLoading }),
    onSetError: (error) => dispatch({ type: 'SET_ERROR', error }),
    onSetModel: (model) => dispatch({ type: 'SET_MODEL', model }),
    updateWindowSize,
    executeGracefulHide,
  });

  return {
    mode: state.mode,
    animKey: state.animKey,
    isClosing: state.isClosing,
    selectedText: state.selectedText,
    activeAction: state.activeAction,
    selectedModel: state.selectedModel,
    streamText: state.streamText,
    isLoading: state.isLoading,
    isPinned: state.isPinned,
    error: state.error,
    handleTriggerAction,
    handleSendFollowUp,
    handleModelChange,
    handleCancel,
    handleClose,
    handlePinToggle,
  };
}
