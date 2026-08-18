import { useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ActionConfig, AppConfig } from '@/types/config';
import { OverlayMode } from '@/state/overlayReducer';

interface StreamTokenPayload {
  actionId: string;
  token: string;
}

interface StreamDonePayload {
  actionId: string;
  canceled?: boolean;
}

interface StreamErrorPayload {
  actionId: string;
  error: string;
}

interface UseActionStreamProps {
  config: AppConfig | null;
  selectedText: string;
  activeAction: ActionConfig | null;
  selectedModel: string;
  streamText: string;
  isPinned: boolean;
  onStartAction: (action: ActionConfig, model?: string, isWebCard?: boolean) => void;
  onAppendToken: (token: string) => void;
  onStreamDone: () => void;
  onStreamError: (error: string) => void;
  onSetStreamText: (text: string) => void;
  onSetLoading: (loading: boolean) => void;
  onSetError: (error: string | null) => void;
  onSetModel: (model: string) => void;
  updateWindowSize: (
    mode: OverlayMode,
    allowFocus?: boolean,
    customSize?: { width: number; height: number }
  ) => Promise<void>;
  executeGracefulHide: () => void;
}

export function useActionStream({
  config,
  selectedText,
  activeAction,
  selectedModel,
  streamText,
  isPinned,
  onStartAction,
  onAppendToken,
  onStreamDone,
  onStreamError,
  onSetStreamText,
  onSetLoading,
  onSetError,
  onSetModel,
  updateWindowSize,
  executeGracefulHide,
}: UseActionStreamProps) {
  const activeActionRef = useRef<ActionConfig | null>(activeAction);
  activeActionRef.current = activeAction;

  // 监听流式事件
  useEffect(() => {
    const unlistenToken = listen<StreamTokenPayload>('action-stream-token', (event) => {
      if (activeActionRef.current && event.payload.actionId === activeActionRef.current.id) {
        onAppendToken(event.payload.token);
      }
    });

    const unlistenDone = listen<StreamDonePayload>('action-stream-done', (event) => {
      if (activeActionRef.current && event.payload.actionId === activeActionRef.current.id) {
        onStreamDone();
      }
    });

    const unlistenError = listen<StreamErrorPayload>('action-stream-error', (event) => {
      if (activeActionRef.current && event.payload.actionId === activeActionRef.current.id) {
        onStreamError(event.payload.error);
      }
    });

    return () => {
      unlistenToken.then((fn) => fn());
      unlistenDone.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, [onAppendToken, onStreamDone, onStreamError]);

  // 触发动作
  const handleTriggerAction = useCallback(
    async (action: ActionConfig) => {
      // 1. 快捷复制模式
      if (action.actionType === 'copy') {
        if (selectedText) {
          try {
            await navigator.clipboard.writeText(selectedText);
          } catch (err) {
            console.warn('Copy action failed:', err);
          }
        }
        return;
      }

      // 2. 网页直达模式
      if (action.actionType === 'web') {
        try {
          await invoke('trigger_web_action', {
            urlTemplate: action.urlTemplate || '',
            text: selectedText,
            copyToClipboard: action.copyToClipboard || false,
          });
          if (!isPinned) {
            executeGracefulHide();
          }
        } catch (err) {
          onSetError(String(err));
        }
        return;
      }

      // 3. Web 官网内嵌卡片模式
      if (action.actionType === 'web_card') {
        onStartAction(action, undefined, true);

        if (action.copyToClipboard && selectedText) {
          try {
            await navigator.clipboard.writeText(selectedText);
          } catch {
            // ignore
          }
        }

        await updateWindowSize('card', true, { width: 560, height: 500 });
        return;
      }

      // 4. API 流式卡片模式
      const provider = config?.providers.find((p) => p.id === action.providerId);
      const defaultModel = provider?.defaultModel || 'default';

      onStartAction(action, defaultModel, false);
      await updateWindowSize('card', true);

      try {
        await invoke('trigger_api_action', {
          actionId: action.id,
          text: selectedText,
          modelOverride: defaultModel,
          promptOverride: action.promptTemplate,
        });
      } catch (err) {
        onSetError(String(err));
        onSetLoading(false);
      }
    },
    [
      config?.providers,
      selectedText,
      isPinned,
      executeGracefulHide,
      updateWindowSize,
      onStartAction,
      onSetError,
      onSetLoading,
    ]
  );

  // 发送追问
  const handleSendFollowUp = useCallback(
    async (followUpPrompt: string) => {
      if (!activeAction || !followUpPrompt.trim()) return;

      onSetStreamText(streamText + `\n\n---\n**追问：** ${followUpPrompt}\n\n`);
      onSetLoading(true);
      onSetError(null);

      const followUpCombined = `原始上下文：\n${selectedText}\n\n追问：\n${followUpPrompt}`;

      try {
        await invoke('trigger_api_action', {
          actionId: activeAction.id,
          text: followUpCombined,
          modelOverride: selectedModel,
          promptOverride: '{text}',
        });
      } catch (err) {
        onSetError(String(err));
        onSetLoading(false);
      }
    },
    [activeAction, streamText, selectedText, selectedModel, onSetStreamText, onSetLoading, onSetError]
  );

  // 切换模型
  const handleModelChange = useCallback(
    async (newModel: string) => {
      if (!activeAction) return;
      onSetModel(newModel);
      onSetStreamText('');
      onSetLoading(true);
      onSetError(null);

      try {
        await invoke('trigger_api_action', {
          actionId: activeAction.id,
          text: selectedText,
          modelOverride: newModel,
          promptOverride: activeAction.promptTemplate,
        });
      } catch (err) {
        onSetError(String(err));
        onSetLoading(false);
      }
    },
    [activeAction, selectedText, onSetModel, onSetStreamText, onSetLoading, onSetError]
  );

  // 停止生成
  const handleCancel = useCallback(async () => {
    if (activeAction) {
      await invoke('cancel_action', { actionId: activeAction.id });
      onSetLoading(false);
    }
  }, [activeAction, onSetLoading]);

  return {
    handleTriggerAction,
    handleSendFollowUp,
    handleModelChange,
    handleCancel,
  };
}
