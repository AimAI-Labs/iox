import type { ActionConfig } from '../types/config';
import type { ThinkingMode } from '../lib/reasoning';
import type { Conversation, ConversationSnapshot, ConversationTurn, GenerationPlan, ChatSessionData, PendingConversationSave } from '../types/session';
import { compatibilityTranscript, decodeSession, generationText, persistConversation } from './transcript';

export function createConversationWorkspace({ createId = () => crypto.randomUUID(), now = () => Date.now() }: {
  createId?: () => string; now?: () => number;
} = {}) {
  let snapshot: ConversationSnapshot = { tabs: [], activeId: null, active: null, navigationRevision: 0 };
  const listeners = new Set<() => void>();
  // These transport identities never become committed session IDs before acknowledgement.
  const saveState = new Map<string, { pendingId: string; failedRevision?: number; createdAt: number }>();
  function publish(tabs: Conversation[], activeId = snapshot.activeId, navigated = false) {
    snapshot = { tabs, activeId, active: tabs.find((c) => c.id === activeId) ?? null,
      navigationRevision: snapshot.navigationRevision + Number(navigated || activeId !== snapshot.activeId) };
    for (const id of saveState.keys()) if (!tabs.some((c) => c.id === id)) saveState.delete(id);
    listeners.forEach((listener) => listener());
  }
  function replace(c: Conversation, navigated = false) { publish(snapshot.tabs.map((old) => old.id === c.id ? c : old), snapshot.activeId, navigated); }
  function changed(c: Conversation, patch: Partial<Conversation>) { replace({ ...c, ...patch, revision: c.revision + 1 }); }
  function empty(action: ActionConfig, model: string, initialInput = '', thinkingMode: ThinkingMode = 'quick'): Conversation {
    return { id: createId(), title: '', action: { ...action }, selectedText: '', selectedModel: model,
      thinkingMode, initialInput, turns: [], sessionId: null, revision: 0, savedRevision: 0,
      generation: null, pendingSave: null, error: null };
  }
  function finish(generationId: string, result: { error?: string; canceled?: boolean } = {}) {
    const c = snapshot.tabs.find((tab) => tab.generation?.id === generationId);
    if (!c?.generation) return;
    const duration = Math.round(Math.max(0, now() - c.generation.startedAt) / 100) / 10;
    changed(c, { generation: null, error: result.error ?? null,
      turns: c.turns.map((turn) => turn.id === c.generation!.turnId
        ? { ...turn, duration, status: result.error ? 'error' : result.canceled ? 'canceled' : 'complete', ...(result.error ? { error: result.error } : {}) }
        : turn) });
  }
  function stop() { if (snapshot.active?.generation) finish(snapshot.active.generation.id, { canceled: true }); }
  function start(c: Conversation, kind: ConversationTurn['kind'], prompt: string, preceding: ConversationTurn[], maxTurns: number, navigated = true): GenerationPlan {
    const turn: ConversationTurn = { id: createId(), kind, prompt, answer: '', model: c.selectedModel,
      providerId: c.action.providerId, status: 'streaming' };
    const generation = { id: createId(), turnId: turn.id, startedAt: now() };
    const next = { ...c, selectedText: kind === 'selection' ? prompt : c.selectedText,
      title: preceding.length === 0 ? prompt.replace(/\s+/g, ' ').trim().slice(0, 40) : c.title,
      initialInput: '', turns: [...preceding, turn], generation, error: null, revision: c.revision + 1 };
    replace(next, navigated);
    return { generationId: generation.id, actionId: c.action.id,
      text: generationText(next, turn, preceding, maxTurns), modelOverride: c.selectedModel,
      promptOverride: kind === 'selection' ? c.action.promptTemplate : '{text}',
      providerId: c.action.providerId, thinkingMode: c.thinkingMode };
  }
  function select(id: string) {
    if (id === snapshot.activeId || !snapshot.tabs.some((c) => c.id === id)) return;
    stop(); publish(snapshot.tabs, id);
  }
  function remove(ids: Set<string>) {
    if (!snapshot.tabs.some((c) => ids.has(c.id))) return;
    const active = snapshot.active;
    if (active && ids.has(active.id)) stop();
    const oldIndex = snapshot.tabs.findIndex((c) => c.id === snapshot.activeId);
    const tabs = snapshot.tabs.filter((c) => !ids.has(c.id));
    if (!tabs.length && active) tabs.push(empty(active.action, active.selectedModel, '', active.thinkingMode));
    const activeId = tabs.some((c) => c.id === snapshot.activeId) ? snapshot.activeId
      : tabs[Math.min(oldIndex, tabs.length - 1)]?.id ?? null;
    publish(tabs, activeId);
  }
  function saveable(c: Conversation) {
    return c.turns.length > 0 && !c.generation && !c.pendingSave && c.revision !== c.savedRevision
      && saveState.get(c.id)?.failedRevision !== c.revision;
  }
  function beginSave(id: string): PendingConversationSave | null {
    const c = snapshot.tabs.find((tab) => tab.id === id);
    if (!c || !saveable(c)) return null;
    let state = saveState.get(id);
    if (!state) { state = { pendingId: createId(), createdAt: Math.floor(now() / 1000) }; saveState.set(id, state); }
    const time = Math.floor(now() / 1000);
    const data: ChatSessionData = { id: c.sessionId ?? state.pendingId, title: c.title,
      actionId: c.action.id, providerId: c.action.providerId, model: c.selectedModel,
      selectedText: c.selectedText, streamText: compatibilityTranscript(c),
      messages: c.turns.flatMap((turn) => [{ role: 'user' as const, content: turn.prompt, timestamp: time },
        { role: 'assistant' as const, content: turn.answer, timestamp: time }]),
      createdAt: state.createdAt, updatedAt: time, conversation: persistConversation(c) };
    const pendingSave = { ticket: createId(), conversationId: id, revision: c.revision, data };
    replace({ ...c, pendingSave }); return pendingSave;
  }
  function findTicket(ticket: string) { return snapshot.tabs.find((c) => c.pendingSave?.ticket === ticket); }
  function failSave(ticket: string) {
    const c = findTicket(ticket);
    if (!c?.pendingSave) return;
    saveState.get(c.id)!.failedRevision = c.pendingSave.revision;
    replace({ ...c, pendingSave: null });
  }
  function equivalent(a: Conversation, b: Conversation) {
    const content = (c: Conversation) => ({ selectedText: c.selectedText, ...persistConversation(c),
      turns: c.turns.map(({ id: _id, ...turn }) => turn) });
    return JSON.stringify(content(a)) === JSON.stringify(content(b));
  }
  function completeSave(ticket: string, canonicalId: string): boolean {
    const c = findTicket(ticket);
    if (!c?.pendingSave) return false;
    const pending = c.pendingSave;
    const other = snapshot.tabs.find((tab) => tab.id !== c.id && tab.sessionId === canonicalId);
    if (other) {
      if (c.revision === pending.revision && !other.pendingSave && !other.generation
        && other.revision === other.savedRevision && equivalent(c, other)) {
        publish(snapshot.tabs.filter((tab) => tab.id !== c.id), snapshot.activeId === c.id ? other.id : snapshot.activeId);
        return true;
      }
      // A canonical conflict needs another user change before retrying, including
      // edits made while this ticket was pending. Ordinary I/O failures differ.
      saveState.get(c.id)!.failedRevision = c.revision;
      replace({ ...c, pendingSave: null });
      return false;
    }
    saveState.get(c.id)!.failedRevision = undefined;
    replace({ ...c, sessionId: canonicalId, pendingSave: null, savedRevision: pending.revision });
    return true;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    startInitial(action: ActionConfig, model: string, selectedText: string, thinkingMode: ThinkingMode = 'quick') {
      stop(); const c = empty(action, model, '', thinkingMode); publish([c], c.id);
      return start(c, 'selection', selectedText, [], 0, false);
    },
    openEmpty(action: ActionConfig, model: string, initialInput = '', thinkingMode: ThinkingMode = 'quick') {
      stop(); const c = empty(action, model, initialInput, thinkingMode); publish([c], c.id);
    },
    newTab() {
      const c = snapshot.active; if (!c) return;
      stop(); const next = empty(c.action, c.selectedModel, '', c.thinkingMode);
      publish([...snapshot.tabs, next], next.id);
    },
    select,
    close(id: string) { remove(new Set([id])); },
    closeOthers(id: string) { if (snapshot.tabs.some((c) => c.id === id)) remove(new Set(snapshot.tabs.filter((c) => c.id !== id).map((c) => c.id))); },
    closeLeft(id: string) { const i = snapshot.tabs.findIndex((c) => c.id === id); if (i >= 0) remove(new Set(snapshot.tabs.slice(0, i).map((c) => c.id))); },
    closeRight(id: string) { const i = snapshot.tabs.findIndex((c) => c.id === id); if (i >= 0) remove(new Set(snapshot.tabs.slice(i + 1).map((c) => c.id))); },
    reset() { publish([], null, true); },
    chooseModel(model: string) {
      const c = snapshot.active; if (!c || !model.trim() || c.selectedModel === model) return;
      changed(c, { selectedModel: model, error: null });
    },
    chooseProvider(providerId: string, model: string) {
      const c = snapshot.active; if (!c || !providerId.trim() || !model.trim()
        || (c.action.providerId === providerId && c.selectedModel === model)) return;
      changed(c, { action: { ...c.action, providerId }, selectedModel: model, error: null });
    },
    chooseThinkingMode(mode: ThinkingMode) {
      const c = snapshot.active; if (c && ['quick', 'low', 'deep', 'max'].includes(mode) && c.thinkingMode !== mode) changed(c, { thinkingMode: mode });
    },
    reportError(error: string | null) { const c = snapshot.active; if (c && c.error !== error) replace({ ...c, error }); },
    followUp(prompt: string, maxTurns: number): GenerationPlan | null {
      if (!snapshot.active || !prompt.trim() || !snapshot.active.selectedModel.trim()) return null;
      stop(); const c = snapshot.active!;
      return start(c, 'followUp', prompt, c.turns, maxTurns);
    },
    edit(index: number, prompt: string, maxTurns: number): GenerationPlan | null {
      const c = snapshot.active;
      if (!c || c.generation || !prompt.trim() || !c.selectedModel.trim() || !Number.isInteger(index) || index < 0 || index >= c.turns.length) return null;
      if (c.turns[index].kind === 'selection' && (!c.selectedText || !c.turns[index].prompt)) return null;
      return start(c, c.turns[index].kind, prompt, c.turns.slice(0, index), maxTurns);
    },
    regenerate(maxTurns: number): GenerationPlan | null {
      if (!snapshot.active || !snapshot.active.turns.length || !snapshot.active.selectedModel.trim()) return null;
      stop(); const c = snapshot.active!;
      const last = c.turns[c.turns.length - 1]; return start(c, last.kind, last.prompt, c.turns.slice(0, -1), maxTurns);
    },
    append(generationId: string, token: string) {
      const c = snapshot.tabs.find((tab) => tab.generation?.id === generationId);
      if (c?.generation && token) changed(c, { turns: c.turns.map((turn) => turn.id === c.generation!.turnId ? { ...turn, answer: turn.answer + token } : turn) });
    },
    finish, stop,
    getSaveCandidates: () => snapshot.tabs.filter(saveable).map((c) => c.id),
    beginSave, completeSave, failSave,
    restore(session: ChatSessionData, actions: ActionConfig[]) {
      const decoded = decodeSession(session, actions, createId);
      const existing = snapshot.tabs.find((tab) => tab.sessionId === session.id);
      if (existing) {
        if (existing.id === snapshot.activeId) publish(snapshot.tabs, existing.id, true);
        else select(existing.id);
        return;
      }
      stop();
      const c = { ...empty(decoded.action, decoded.selectedModel, '', decoded.thinkingMode), ...decoded,
        sessionId: session.id, revision: 0, savedRevision: 0 };
      saveState.set(c.id, { pendingId: createId(), createdAt: session.createdAt });
      const tabs = snapshot.active ? snapshot.tabs.map((tab) => tab.id === snapshot.activeId ? c : tab) : [...snapshot.tabs, c];
      publish(tabs, c.id);
    },
    forgetSession(sessionId: string) {
      let changedAny = false;
      const tabs = snapshot.tabs.map((c) => {
        if (c.sessionId !== sessionId) return c;
        changedAny = true;
        saveState.set(c.id, { pendingId: createId(), failedRevision: c.revision, createdAt: Math.floor(now() / 1000) });
        return { ...c, sessionId: null, pendingSave: null, savedRevision: -1 };
      });
      if (changedAny) publish(tabs);
    },
  };
}

export type ConversationWorkspace = ReturnType<typeof createConversationWorkspace>;
