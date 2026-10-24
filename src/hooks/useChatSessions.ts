import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ChatSessionData, SessionMeta, SessionStorageError } from '@/types/session';
import type { ActionConfig } from '@/types/config';
import type { ConversationWorkspace } from '@/conversation/workspace';

interface UseChatSessionsProps {
  workspace: ConversationWorkspace;
  actions: ActionConfig[];
  onNavigation: () => void;
  onNewSession: () => void;
}

/** History transport adapter; conversation identities and save revisions belong to the workspace. */
export function useChatSessions({ workspace, actions, onNavigation, onNewSession }: UseChatSessionsProps) {
  const snapshot = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [storageError, setStorageError] = useState<SessionStorageError>(null);
  const mounted = useRef(true);
  const listSequence = useRef(0);
  const restoreSequence = useRef(0);
  const deleting = useRef(new Set<string>());
  const saves = useRef(new Map<string, { sessionId: string; promise: Promise<void> }>());
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; restoreSequence.current++; }; }, []);

  const refreshSessions = useCallback(async () => {
    const sequence = ++listSequence.current;
    try {
      const list = await invoke<SessionMeta[]>('list_chat_sessions');
      if (!mounted.current || sequence !== listSequence.current) return;
      setSessions(list || []); setHistoryLoaded(true);
      setStorageError((previous) => previous === 'load' ? null : previous);
    } catch (error) {
      if (mounted.current && sequence === listSequence.current) setStorageError('load');
      console.warn('Failed to list chat sessions:', error);
    }
  }, []);
  useEffect(() => { void refreshSessions(); }, [refreshSessions]);

  const candidates = workspace.getSaveCandidates();
  const saveKey = candidates.map((id) => `${id}:${snapshot.tabs.find((tab) => tab.id === id)!.revision}`).join('|');
  useEffect(() => {
    if (!saveKey) return;
    const timer = setTimeout(() => {
      for (const id of workspace.getSaveCandidates()) {
        const conversation = workspace.getSnapshot().tabs.find((tab) => tab.id === id);
        if (conversation?.sessionId && deleting.current.has(conversation.sessionId)) continue;
        const job = workspace.beginSave(id);
        if (!job) continue;
        const promise = (async () => {
          try {
            const canonical = await invoke<string>('save_chat_session', { session: job.data });
            const accepted = workspace.completeSave(job.ticket, canonical);
            if (!mounted.current) return;
            if (accepted) setStorageError((previous) => previous === 'save' ? null : previous);
            else if (workspace.getSnapshot().tabs.some((tab) => tab.id === job.conversationId)) setStorageError('save');
            // A list failure after this point cannot undo the acknowledged commit.
            void refreshSessions();
          } catch (error) {
            const relevant = workspace.getSnapshot().tabs.some((tab) => tab.pendingSave?.ticket === job.ticket);
            workspace.failSave(job.ticket);
            if (mounted.current && relevant) setStorageError('save');
            console.warn('Failed to auto-save chat session:', error);
          } finally { saves.current.delete(job.ticket); }
        })();
        saves.current.set(job.ticket, { sessionId: job.data.id, promise });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [workspace, saveKey, refreshSessions]);

  const handleSwitchSession = useCallback(async (id: string) => {
    const sequence = ++restoreSequence.current;
    const navigation = workspace.getSnapshot().navigationRevision;
    onNavigation();
    try {
      const data = await invoke<ChatSessionData>('get_chat_session', { id });
      if (!mounted.current || sequence !== restoreSequence.current || navigation !== workspace.getSnapshot().navigationRevision) return;
      // restore validates first and synchronously revokes the previous generation.
      workspace.restore(data, actions);
      setStorageError((previous) => previous === 'load' ? null : previous);
      setIsPanelOpen(false);
    } catch (error) {
      if (mounted.current && sequence === restoreSequence.current && navigation === workspace.getSnapshot().navigationRevision) setStorageError('load');
      console.error('Failed to get chat session:', error);
    }
  }, [workspace, actions, onNavigation]);

  const handleNewSession = useCallback(() => {
    restoreSequence.current++; onNewSession(); setIsPanelOpen(false);
  }, [onNewSession]);
  const handleDeleteSession = useCallback(async (event: React.MouseEvent, id: string) => {
    event.stopPropagation(); deleting.current.add(id);
    try {
      // Publish deletion after any already-started write for this persistent ID.
      await Promise.all([...saves.current.values()].filter((save) => save.sessionId === id).map((save) => save.promise));
      await invoke('delete_chat_session', { id });
      workspace.forgetSession(id);
      if (mounted.current) {
        setStorageError((previous) => previous === 'delete' ? null : previous);
        void refreshSessions();
      }
    } catch (error) {
      if (mounted.current) setStorageError('delete');
      console.error('Failed to delete chat session:', error);
    } finally { deleting.current.delete(id); }
  }, [workspace, refreshSessions]);
  const togglePanel = useCallback(() => {
    if (!isPanelOpen) void refreshSessions();
    setIsPanelOpen(!isPanelOpen);
  }, [isPanelOpen, refreshSessions]);

  return { sessions, historyLoaded, storageError, currentSessionId: snapshot.active?.sessionId ?? null,
    isPanelOpen, setIsPanelOpen, togglePanel, handleSwitchSession, handleNewSession, handleDeleteSession, refreshSessions };
}

export type ChatSessionsView = ReturnType<typeof useChatSessions>;
