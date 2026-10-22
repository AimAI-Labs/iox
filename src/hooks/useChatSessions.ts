import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChatSessionData, SessionMeta } from '@/types/session';
import { ActionConfig } from '@/types/config';
import { splitTranscript, splitTurnChunk } from '@/lib/chatTranscript';

/** 从选区或首条追问生成稳定、可读的会话标题 */
function buildSessionTitle(selectedText: string, streamText: string): string {
  let seed = selectedText.trim();

  if (!seed) {
    const parts = splitTranscript(streamText);
    seed = parts.length > 1 ? splitTurnChunk(parts[1]).prompt : streamText;
  }

  const cleaned = seed
    .replace(/\*\*追问：\*\*/g, ' ')
    .replace(/^[\s#>*`-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (cleaned || '新对话').slice(0, 28);
}

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
  const sessionIdRef = useRef<string | null>(null);
  const lastSavedRef = useRef<{
    actionId: string;
    providerId: string;
    model: string;
    selectedText: string;
    streamText: string;
  } | null>(null);
  const activeActionIdRef = useRef(activeAction?.id ?? null);

  // 同一组件实例内切换动作时，开启新的会话记录
  useEffect(() => {
    const nextActionId = activeAction?.id ?? null;
    if (activeActionIdRef.current === nextActionId) return;

    activeActionIdRef.current = nextActionId;
    sessionIdRef.current = null;
    lastSavedRef.current = null;
    setCurrentSessionId(null);
  }, [activeAction?.id]);

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

    const model = selectedModel || 'default';
    const snapshot = {
      actionId: activeAction.id,
      providerId: activeAction.providerId || '',
      model,
      selectedText,
      streamText,
    };
    const previous = lastSavedRef.current;

    // 内容与元信息均未变化时跳过重复写入
    if (
      previous &&
      previous.actionId === snapshot.actionId &&
      previous.providerId === snapshot.providerId &&
      previous.model === snapshot.model &&
      previous.selectedText === snapshot.selectedText &&
      previous.streamText === snapshot.streamText
    ) {
      return;
    }

    // 先占位，避免同一内容的并发定时器重复创建会话
    lastSavedRef.current = snapshot;

    const sessionId =
      sessionIdRef.current ||
      `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!sessionIdRef.current) {
      sessionIdRef.current = sessionId;
      setCurrentSessionId(sessionId);
    }

    const sessionData: ChatSessionData = {
      id: sessionId,
      title: buildSessionTitle(selectedText, streamText),
      actionId: activeAction.id,
      providerId: activeAction.providerId,
      model,
      selectedText,
      streamText,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      // 后端按内容去重，并返回最终使用的会话 ID
      const resolvedId = await invoke<string>('save_chat_session', {
        session: sessionData,
      });

      if (resolvedId && resolvedId !== sessionIdRef.current) {
        sessionIdRef.current = resolvedId;
        setCurrentSessionId(resolvedId);
      }

      refreshSessions();
    } catch (err) {
      // 保存失败时清掉占位，允许后续内容变化时重试
      if (lastSavedRef.current === snapshot) {
        lastSavedRef.current = null;
      }
      console.warn('Failed to auto-save chat session:', err);
    }
  }, [activeAction, selectedModel, selectedText, streamText, refreshSessions]);

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
        sessionIdRef.current = fullData.id;
        setCurrentSessionId(fullData.id);
        lastSavedRef.current = {
          actionId: fullData.actionId,
          providerId: fullData.providerId || '',
          model: fullData.model || 'default',
          selectedText: fullData.selectedText || '',
          streamText: fullData.streamText || '',
        };
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
    sessionIdRef.current = null;
    lastSavedRef.current = null;
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
    refreshSessions,
  };
}
