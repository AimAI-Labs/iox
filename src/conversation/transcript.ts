import type { ActionConfig } from '../types/config';
import type {
  ChatSessionData, ContextUsage, Conversation, ConversationTurn, PersistedConversation,
} from '../types/session';
import { decodeLegacyTranscript, encodeLegacyTranscript } from './legacyTranscript';

/** 旧版 streamText 镜像；只在写盘与历史读取时使用，视图不再反解这段文本。 */
export function compatibilityTranscript(conversation: Pick<Conversation, 'turns'>): string {
  return encodeLegacyTranscript(conversation.turns);
}

export function historyContext(turns: ConversationTurn[], maxTurns: number): string {
  if (maxTurns <= 0) return '';
  return turns.slice(-Math.floor(maxTurns)).map((turn) => `用户：\n${turn.prompt}\n\n助手：\n${turn.answer}`).join('\n\n');
}

export function contextUsage(conversation: Conversation, draft: string, maxTurns: number): ContextUsage {
  const history = historyContext(conversation.turns, maxTurns);
  const selectionTokens = estimateTokens(conversation.selectedText);
  const historyTokens = estimateTokens(history);
  const draftTokens = estimateTokens(draft.trim());
  return {
    estimatedTokens: selectionTokens + historyTokens + draftTokens,
    selectionTokens, historyTokens, draftTokens,
    usedTurns: Math.max(0, Math.min(conversation.turns.length, Math.floor(maxTurns))),
    maxTurns,
  };
}

/** 按来源分别估算并取整，确保明细之和等于展示总数。 */
function estimateTokens(content: string): number {
  let tokens = 0;
  for (const char of content) tokens += char.codePointAt(0)! <= 0x7f ? 0.25 : 1;
  return Math.ceil(tokens);
}

export function exportMarkdown(conversation: Conversation): string {
  const selection = conversation.selectedText ? `### 原始选中文本\n> ${conversation.selectedText.replace(/\n/g, '\n> ')}\n\n` : '';
  const turns = conversation.turns.map((turn) => `### 用户\n\n${turn.prompt}\n\n### 助手\n\n${turn.answer}`).join('\n\n---\n\n');
  return `# IOX AI 对话记录\n\n- **动作**: ${conversation.action.name}\n- **模型**: ${conversation.selectedModel}\n\n${selection}${turns}\n`;
}

export function persistConversation(conversation: Conversation): PersistedConversation {
  return {
    version: 1, action: { ...conversation.action }, selectedModel: conversation.selectedModel,
    thinkingMode: conversation.thinkingMode,
    turns: conversation.turns.map((turn) => ({ ...turn, status: turn.status === 'streaming' ? 'canceled' : turn.status })),
  };
}

function validatePersisted(value: unknown): PersistedConversation {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) throw new Error('Unsupported conversation version');
  const c = value as PersistedConversation;
  if (!c.action || typeof c.action.id !== 'string' || typeof c.action.name !== 'string'
    || typeof c.action.icon !== 'string' || !['api', 'web', 'copy'].includes(c.action.actionType)
    || typeof c.action.enabled !== 'boolean' || typeof c.selectedModel !== 'string'
    || !['quick', 'low', 'deep', 'max'].includes(c.thinkingMode) || !Array.isArray(c.turns)
    || c.turns.some((t) => !t || typeof t.id !== 'string' || !['selection', 'followUp'].includes(t.kind)
      || typeof t.prompt !== 'string' || typeof t.answer !== 'string' || typeof t.model !== 'string'
      || !['complete', 'canceled', 'error', 'streaming'].includes(t.status)
      || (t.providerId !== undefined && typeof t.providerId !== 'string')
      || (t.duration !== undefined && (!Number.isFinite(t.duration) || t.duration < 0))
      || (t.error !== undefined && typeof t.error !== 'string'))) throw new Error('Invalid structured conversation');
  return c;
}

export function decodeSession(session: ChatSessionData, actions: ActionConfig[], createId: () => string) {
  if (session.conversation !== undefined) {
    const c = validatePersisted(session.conversation);
    return {
      title: session.title, selectedText: session.selectedText,
      action: { ...c.action }, selectedModel: c.selectedModel, thinkingMode: c.thinkingMode,
      turns: c.turns.map((turn) => ({ ...turn, status: turn.status === 'streaming' ? 'canceled' as const : turn.status })),
    };
  }
  // 没有结构化轮次的历史会话走兼容 adapter，解码后即成为普通轮次。
  const configured = actions.find((a) => a.id === session.actionId);
  const action: ActionConfig = configured ? { ...configured } : {
    id: session.actionId, name: session.actionId, icon: 'Sparkles', actionType: 'api',
    enabled: true, promptTemplate: '{text}',
  };
  if (session.providerId) action.providerId = session.providerId;
  const [first, ...followUps] = decodeLegacyTranscript(session.streamText);
  const turns: ConversationTurn[] = [];
  if (session.selectedText || first.answer) turns.push({
    id: createId(), kind: 'selection', prompt: session.selectedText, answer: first.answer,
    model: session.model, providerId: action.providerId, status: 'complete',
  });
  for (const chunk of followUps) turns.push({
    id: createId(), kind: 'followUp', prompt: chunk.prompt, answer: chunk.answer,
    model: session.model, providerId: action.providerId, status: 'complete',
  });
  return { title: session.title, selectedText: session.selectedText, action, selectedModel: session.model, thinkingMode: 'quick' as const, turns };
}

export function generationText(conversation: Conversation, turn: ConversationTurn, preceding: ConversationTurn[], maxTurns: number): string {
  return turn.kind === 'selection' ? turn.prompt
    : buildFollowUpPrompt(historyContext(preceding, maxTurns), conversation.selectedText, turn.prompt);
}

/** 只使用调用方传入的历史，避免编辑重发时混入被替换轮次及后续内容。 */
function buildFollowUpPrompt(history: string, selectedText: string, prompt: string): string {
  const selection = selectedText ? `原始选中文本：\n${selectedText}\n\n` : '';
  return `${selection}前序对话：\n${history}\n\n最新追问：\n${prompt}`;
}
