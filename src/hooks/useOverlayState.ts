import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ActionConfig, AppConfig } from '../types/config';

export type OverlayMode = 'bubble' | 'card';

interface SelectionEventPayload {
  text: string;
  cursorX: number;
  cursorY: number;
}

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

export function useOverlayState(config: AppConfig | null) {
  const [mode, setMode] = useState<OverlayMode>('bubble');
  const [selectedText, setSelectedText] = useState<string>('');
  const [activeAction, setActiveAction] = useState<ActionConfig | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [streamText, setStreamText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState<number>(0);

  const activeActionRef = useRef<ActionConfig | null>(null);
  activeActionRef.current = activeAction;

  // 调整窗口尺寸
  const updateWindowSize = useCallback(async (newMode: OverlayMode, allowFocus = false) => {
    if (newMode === 'bubble') {
      await invoke('resize_overlay', { width: 500, height: 46, allowFocus: false });
    } else {
      await invoke('resize_overlay', { width: 460, height: 420, allowFocus });
    }
  }, []);

  // 监听后端划词触发事件
  useEffect(() => {
    const unlistenSelection = listen<SelectionEventPayload>('selection-triggered', (event) => {
      setSelectedText(event.payload.text);
      setMode('bubble');
      setStreamText('');
      setError(null);
      setIsLoading(false);
      setIsPinned(false);
      invoke('set_pin_state', { pinned: false }).catch(() => {});
      setAnimKey((prev) => prev + 1);
      updateWindowSize('bubble', false);
    });

    const unlistenToken = listen<StreamTokenPayload>('action-stream-token', (event) => {
      if (activeActionRef.current && event.payload.actionId === activeActionRef.current.id) {
        setStreamText((prev) => prev + event.payload.token);
      }
    });

    const unlistenDone = listen<StreamDonePayload>('action-stream-done', (event) => {
      if (activeActionRef.current && event.payload.actionId === activeActionRef.current.id) {
        setIsLoading(false);
      }
    });

    const unlistenError = listen<StreamErrorPayload>('action-stream-error', (event) => {
      if (activeActionRef.current && event.payload.actionId === activeActionRef.current.id) {
        setError(event.payload.error);
        setIsLoading(false);
      }
    });

    return () => {
      unlistenSelection.then((fn) => fn());
      unlistenToken.then((fn) => fn());
      unlistenDone.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, [updateWindowSize]);

  // 执行 Action
  const handleTriggerAction = async (action: ActionConfig) => {
    if (action.actionType === 'web') {
      // 网页直达模式
      try {
        await invoke('trigger_web_action', {
          urlTemplate: action.urlTemplate || '',
          text: selectedText,
          copyToClipboard: action.copyToClipboard || false,
        });
        if (!isPinned) {
          await invoke('hide_overlay');
        }
      } catch (err) {
        setError(String(err));
      }
      return;
    }

    // API 流式卡片模式
    setActiveAction(action);
    setMode('card');
    setStreamText('');
    setError(null);
    setIsLoading(true);

    // 计算当前绑定的默认模型
    const provider = config?.providers.find((p) => p.id === action.providerId);
    const defaultModel = provider?.defaultModel || 'default';
    setSelectedModel(defaultModel);

    // 展开卡片窗口
    await updateWindowSize('card', true);

    try {
      await invoke('trigger_api_action', {
        actionId: action.id,
        text: selectedText,
        modelOverride: defaultModel,
        promptOverride: action.promptTemplate,
      });
    } catch (err) {
      setError(String(err));
      setIsLoading(false);
    }
  };

  // 发送追问
  const handleSendFollowUp = async (followUpPrompt: string) => {
    if (!activeAction || !followUpPrompt.trim()) return;

    setStreamText((prev) => prev + `\n\n---\n**追问：** ${followUpPrompt}\n\n`);
    setIsLoading(true);
    setError(null);

    const followUpCombined = `原始上下文：\n${selectedText}\n\n追问：\n${followUpPrompt}`;

    try {
      await invoke('trigger_api_action', {
        actionId: activeAction.id,
        text: followUpCombined,
        modelOverride: selectedModel,
        promptOverride: '{text}',
      });
    } catch (err) {
      setError(String(err));
      setIsLoading(false);
    }
  };

  // 切换模型
  const handleModelChange = async (newModel: string) => {
    if (!activeAction) return;
    setSelectedModel(newModel);
    setStreamText('');
    setIsLoading(true);
    setError(null);

    try {
      await invoke('trigger_api_action', {
        actionId: activeAction.id,
        text: selectedText,
        modelOverride: newModel,
        promptOverride: activeAction.promptTemplate,
      });
    } catch (err) {
      setError(String(err));
      setIsLoading(false);
    }
  };

  // 停止生成
  const handleCancel = async () => {
    if (activeAction) {
      await invoke('cancel_action', { actionId: activeAction.id });
      setIsLoading(false);
    }
  };

  // 关闭/隐藏
  const handleClose = async () => {
    setIsPinned(false);
    await invoke('set_pin_state', { pinned: false }).catch(() => {});
    await invoke('hide_overlay');
  };

  // 固定/解绑 Pin
  const handlePinToggle = () => {
    setIsPinned((prev) => {
      const next = !prev;
      invoke('set_pin_state', { pinned: next }).catch(() => {});
      return next;
    });
  };

  return {
    mode,
    animKey,
    selectedText,
    activeAction,
    selectedModel,
    streamText,
    isLoading,
    isPinned,
    error,
    handleTriggerAction,
    handleSendFollowUp,
    handleModelChange,
    handleCancel,
    handleClose,
    handlePinToggle,
  };
}

