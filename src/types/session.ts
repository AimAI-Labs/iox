import type { ActionConfig } from './config';
import type { ThinkingMode } from '../lib/reasoning';

export interface ConversationTurn {
  id: string;
  kind: 'selection' | 'followUp';
  prompt: string;
  answer: string;
  model: string;
  providerId?: string;
  duration?: number;
  status: 'complete' | 'canceled' | 'error' | 'streaming';
  error?: string;
}

export interface PersistedConversation {
  version: 1;
  action: ActionConfig;
  selectedModel: string;
  thinkingMode: ThinkingMode;
  turns: ConversationTurn[];
}

export interface GenerationPlan {
  generationId: string;
  actionId: string;
  text: string;
  modelOverride: string;
  promptOverride?: string;
  providerId?: string;
  thinkingMode: ThinkingMode;
}

export interface PendingConversationSave {
  ticket: string;
  conversationId: string;
  revision: number;
  data: ChatSessionData;
}

export interface Conversation {
  id: string;
  title: string;
  action: ActionConfig;
  selectedText: string;
  selectedModel: string;
  thinkingMode: ThinkingMode;
  initialInput: string;
  turns: ConversationTurn[];
  sessionId: string | null;
  revision: number;
  savedRevision: number;
  generation: { id: string; turnId: string; startedAt: number } | null;
  pendingSave: PendingConversationSave | null;
  error: string | null;
}

export interface ConversationSnapshot {
  navigationRevision: number;
  tabs: Conversation[];
  activeId: string | null;
  active: Conversation | null;
}

export interface ChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/** 上下文用量投影；只有模块计算，视图仅负责展示。 */
export interface ContextUsage {
  estimatedTokens: number;
  selectionTokens: number;
  historyTokens: number;
  draftTokens: number;
  usedTurns: number;
  maxTurns: number;
}

export interface ChatSessionData {
  id: string;
  title: string;
  actionId: string;
  providerId?: string;
  model: string;
  selectedText: string;
  streamText: string;
  messages: ChatMessageItem[];
  createdAt: number;
  updatedAt: number;
  conversation?: PersistedConversation;
}

export interface SessionMeta {
  id: string;
  title: string;
  actionId: string;
  model: string;
  updatedAt: number;
}

export type SessionStorageError = 'load' | 'save' | 'delete' | 'clear' | null;
