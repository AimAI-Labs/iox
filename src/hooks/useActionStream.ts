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
  onStartAction: (action: ActionConfig, model?: string) => void;
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
        if (!isPinned) {
          executeGracefulHide();
        }
        return;
      }

      // 2. Web 官网原生浮窗模式
      if (action.actionType === 'web') {
        if (action.copyToClipboard && selectedText) {
          try {
            await navigator.clipboard.writeText(selectedText);
          } catch {
            // ignore
          }
        }

        try {
          await invoke('trigger_web_action', {
            actionId: action.id,
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

      // 3. API 流式卡片模式
      const provider = config?.providers.find((p) => p.id === action.providerId);
      const defaultModel = provider?.defaultModel || 'default';

      onStartAction(action, defaultModel);
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

      // 根据配置截取最近 N 轮历史对话
      const maxTurns = config?.apiCard?.contextTurns ?? 5;
      const historyParts = streamText.split(/\n\n---\n\*\*追问：\*\*\s*/);
      const recentHistory = historyParts.slice(-maxTurns).join('\n\n---\n**追问：** ');

      const followUpCombined = selectedText
        ? `原始选中文本：\n${selectedText}\n\n前序对话：\n${recentHistory}\n\n最新追问：\n${followUpPrompt}`
        : `前序对话：\n${recentHistory}\n\n最新追问：\n${followUpPrompt}`;

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
    [
      activeAction,
      config?.apiCard?.contextTurns,
      streamText,
      selectedText,
      selectedModel,
      onSetStreamText,
      onSetLoading,
      onSetError,
    ]
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

  // 针对当前轮次重新生成 (保留前序多轮历史)
  const handleRegenerateCurrentTurn = useCallback(
    async (thinkingPromptAugment?: string) => {
      if (!activeAction) return;

      onSetLoading(true);
      onSetError(null);

      const parts = streamText.split(/\n\n---\n\*\*追问：\*\*\s*/);
      if (parts.length <= 1) {
        // 第一轮回答重新生成
        onSetStreamText('');
        const promptTemplate = thinkingPromptAugment
          ? `${thinkingPromptAugment}\n\n${activeAction.promptTemplate || '{text}'}`
          : activeAction.promptTemplate;

        try {
          await invoke('trigger_api_action', {
            actionId: activeAction.id,
            text: selectedText,
            modelOverride: selectedModel,
            promptOverride: promptTemplate,
          });
        } catch (err) {
          onSetError(String(err));
          onSetLoading(false);
        }
      } else {
        // 多轮追问：保留前 N-1 轮历史，仅重置最新一轮
        const lastPart = parts[parts.length - 1];
        const firstNewline = lastPart.indexOf('\n\n');
        const latestPrompt = firstNewline === -1 ? lastPart.trim() : lastPart.slice(0, firstNewline).trim();

        const precedingParts = parts.slice(0, -1);
        const maxTurns = config?.apiCard?.contextTurns ?? 5;
        const recentHistory = precedingParts.slice(-maxTurns).join('\n\n---\n**追问：** ');

        // 重置 streamText 为去掉最新轮 assistant 内容的状态
        const baseStreamText = precedingParts.join('\n\n---\n**追问：** ') + `\n\n---\n**追问：** ${latestPrompt}\n\n`;
        onSetStreamText(baseStreamText);

        const followUpCombined = selectedText
          ? `原始选中文本：\n${selectedText}\n\n前序对话：\n${recentHistory}\n\n最新追问：\n${latestPrompt}`
          : `前序对话：\n${recentHistory}\n\n最新追问：\n${latestPrompt}`;

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
      }
    },
    [
      activeAction,
      streamText,
      selectedText,
      selectedModel,
      config?.apiCard?.contextTurns,
      onSetStreamText,
      onSetLoading,
      onSetError,
    ]
  );

  // 开启新会话 (清空追问历史，保留选中文本)
  const handleNewChat = useCallback(() => {
    onSetStreamText('');
    onSetLoading(false);
    onSetError(null);
  }, [onSetStreamText, onSetLoading, onSetError]);

  // 导出完整对话为 Markdown
  const handleExportMarkdown = useCallback(async () => {
    let md = `# IOX AI 对话记录\n\n- **动作**: ${activeAction?.name || 'AI'}\n- **模型**: ${selectedModel || '默认'}\n- **时间**: ${new Date().toLocaleString()}\n\n`;
    if (selectedText) {
      md += `### 原始选中文本\n> ${selectedText.replace(/\n/g, '\n> ')}\n\n---\n\n`;
    }
    md += `### 对话内容\n\n${streamText}\n`;

    try {
      await navigator.clipboard.writeText(md);
    } catch (err) {
      console.warn('Failed to export markdown:', err);
    }
  }, [activeAction?.name, selectedModel, selectedText, streamText]);

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
    handleRegenerateCurrentTurn,
    handleNewChat,
    handleExportMarkdown,
    handleCancel,
  };
}
