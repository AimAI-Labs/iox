import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChatSessionData, SessionMeta } from '@/types/session';
import { ActionConfig } from '@/types/config';

interface UseChatSessionsProps {
  activeAction: ActionConfig | null;
  selectedModel: string;
  selectedText: string;
  streamText: string;
  isLoading: boolean;
  onRestoreSession: (session: ChatSessionData) => void;
  onResetToNewChat: () => void;
}

export function useChatSessions({
  activeAction,
  selectedModel,
  selectedText,
  streamText,
  isLoading,
  onRestoreSession,
  onResetToNewChat,
}: UseChatSessionsProps) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 刷新历史会话列表
  const refreshSessions = useCallback(async () => {
    try {
      const list = await invoke<SessionMeta[]>('list_chat_sessions');
      setSessions(list || []);
    } catch (err) {
      console.warn('Failed to list chat sessions:', err);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // 自动持久化当前会话（防抖保存）
  const saveCurrentSession = useCallback(async () => {
    if (!activeAction || (!streamText && !selectedText)) return;

    const sessionId = currentSessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!currentSessionId) {
      setCurrentSessionId(sessionId);
    }

    // 截取标题
    const titleSnippet = selectedText.trim() || streamText.slice(0, 30).trim() || '新对话';
    const title = titleSnippet.slice(0, 24).replace(/\n/g, ' ');

    const sessionData: ChatSessionData = {
      id: sessionId,
      title,
      actionId: activeAction.id,
      providerId: activeAction.providerId,
      model: selectedModel || 'default',
      selectedText,
      streamText,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await invoke('save_chat_session', { session: sessionData });
      refreshSessions();
    } catch (err) {
      console.warn('Failed to auto-save chat session:', err);
    }
  }, [activeAction, currentSessionId, selectedModel, selectedText, streamText, refreshSessions]);

  // 当流式回答结束或有更新时自动保存
  useEffect(() => {
    if (isLoading) return;
    if (streamText || selectedText) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveCurrentSession();
      }, 500);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [streamText, selectedText, isLoading, saveCurrentSession]);

  // 切换加载指定的历史会话
  const handleSwitchSession = useCallback(
    async (id: string) => {
      try {
        const fullData = await invoke<ChatSessionData>('get_chat_session', { id });
        setCurrentSessionId(fullData.id);
        onRestoreSession(fullData);
        setIsPanelOpen(false);
      } catch (err) {
        console.error('Failed to get chat session:', err);
      }
    },
    [onRestoreSession]
  );

  // 开启一个全新的对话
  const handleNewSession = useCallback(() => {
    setCurrentSessionId(null);
    onResetToNewChat();
    setIsPanelOpen(false);
  }, [onResetToNewChat]);

  // 删除某条历史会话
  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      try {
        await invoke('delete_chat_session', { id });
        if (currentSessionId === id) {
          handleNewSession();
        }
        refreshSessions();
      } catch (err) {
        console.error('Failed to delete chat session:', err);
      }
    },
    [currentSessionId, handleNewSession, refreshSessions]
  );

  // 清空所有历史会话
  const handleClearAllSessions = useCallback(async () => {
    try {
      await invoke('clear_all_chat_sessions');
      handleNewSession();
      refreshSessions();
    } catch (err) {
      console.error('Failed to clear all chat sessions:', err);
    }
  }, [handleNewSession, refreshSessions]);

  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => {
      if (!prev) {
        refreshSessions();
      }
      return !prev;
    });
  }, [refreshSessions]);

  return {
    sessions,
    currentSessionId,
    isPanelOpen,
    setIsPanelOpen,
    togglePanel,
    handleSwitchSession,
    handleNewSession,
    handleDeleteSession,
    handleClearAllSessions,
    refreshSessions,
  };
}
