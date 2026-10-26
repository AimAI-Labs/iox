import type { ActionConfig } from '@/types/config';
import type { ChatSessionData, ConversationTurn } from '@/types/session';
import type { TranslationKey } from '@/locales';
import { decodeSession } from '@/conversation/transcript';
import { decodeLegacyTranscript } from '@/conversation/legacyTranscript';

/** 只读视图模型：会话头部信息 + 结构化轮次，视图不再自行反解 streamText。 */
export interface SessionView {
  actionId: string;
  actionName: string;
  actionType: string;
  model: string;
  providerId?: string;
  thinkingMode: string;
  selectedText: string;
  turns: ConversationTurn[];
  /** 结构化轮次缺失，内容由旧版 streamText 还原。 */
  legacy: boolean;
}

export interface SessionRecord {
  session: ChatSessionData;
  view: SessionView;
  /** 预计算的小写检索串，避免每次输入都重新展开全部轮次。 */
  searchText: string;
}

export interface SessionDayGroup {
  key: string;
  timestamp: number;
  records: SessionRecord[];
}

/** 解析会话；结构化数据损坏时退回旧版文本，避免整条历史无法查看。 */
export function viewSession(session: ChatSessionData, actions: ActionConfig[]): SessionView {
  const hasStructured = Boolean(session.conversation);
  try {
    let sequence = 0;
    const decoded = decodeSession(session, actions, () => `turn-${sequence++}`);
    return {
      actionId: decoded.action.id,
      actionName: decoded.action.name,
      actionType: decoded.action.actionType,
      model: decoded.selectedModel || session.model,
      providerId: decoded.action.providerId ?? session.providerId,
      thinkingMode: decoded.thinkingMode,
      selectedText: decoded.selectedText,
      turns: decoded.turns,
      // decodeSession 会为旧会话补出兼容轮次，这里仍标记来源以便视图提示
      legacy: !hasStructured,
    };
  } catch {
    return legacySessionView(session, actions.find((action) => action.id === session.actionId));
  }
}

function legacySessionView(session: ChatSessionData, action?: ActionConfig): SessionView {
  const [first, ...followUps] = decodeLegacyTranscript(session.streamText || '');
  const turns: ConversationTurn[] = [];
  const base = {
    model: session.model,
    providerId: action?.providerId ?? session.providerId,
    status: 'complete' as const,
  };
  if (session.selectedText || first?.answer) {
    turns.push({
      ...base,
      id: 'turn-0',
      kind: 'selection',
      prompt: session.selectedText,
      answer: first?.answer ?? '',
    });
  }
  followUps.forEach((chunk, index) => {
    if (!chunk.prompt && !chunk.answer) return;
    turns.push({
      ...base,
      id: `turn-${index + 1}`,
      kind: 'followUp',
      prompt: chunk.prompt,
      answer: chunk.answer,
    });
  });
  return {
    actionId: session.actionId,
    actionName: action?.name ?? session.actionId,
    actionType: action?.actionType ?? 'api',
    model: session.model,
    providerId: base.providerId,
    thinkingMode: 'quick',
    selectedText: session.selectedText,
    turns,
    legacy: true,
  };
}

export function sessionSearchText(session: ChatSessionData, view: SessionView): string {
  return [
    session.title,
    view.actionName,
    view.model,
    view.selectedText,
    ...view.turns.flatMap((turn) => [turn.prompt, turn.answer]),
  ]
    .filter(Boolean)
    .join('\n')
    .toLocaleLowerCase();
}

export function buildSessionRecords(sessions: ChatSessionData[], actions: ActionConfig[]): SessionRecord[] {
  return sessions
    .map((session) => {
      const view = viewSession(session, actions);
      return { session, view, searchText: sessionSearchText(session, view) };
    })
    .sort((a, b) => b.session.updatedAt - a.session.updatedAt || a.session.id.localeCompare(b.session.id));
}

export function filterSessionRecords(
  records: SessionRecord[],
  query: string,
  actionId = ''
): SessionRecord[] {
  const needle = query.trim().toLocaleLowerCase();
  return records.filter((record) => {
    if (actionId && record.view.actionId !== actionId) return false;
    return !needle || record.searchText.includes(needle);
  });
}

export function sessionDayKey(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 记录已按更新时间倒序，分组天然保持"最近一天在最前"。 */
export function groupSessionRecords(records: SessionRecord[]): SessionDayGroup[] {
  const groups: SessionDayGroup[] = [];
  for (const record of records) {
    const timestamp = record.session.updatedAt;
    const key = timestamp ? sessionDayKey(timestamp) : 'unknown';
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.records.push(record);
      continue;
    }
    groups.push({ key, timestamp, records: [record] });
  }
  return groups;
}

export function formatSessionTime(timestamp: number, withSeconds = false): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}${withSeconds ? `:${pad(date.getSeconds())}` : ''}`;
}

export function sessionTurnCount(view: SessionView): number {
  return view.turns.length;
}

export function sessionHasStatus(view: SessionView, status: ConversationTurn['status']): boolean {
  return view.turns.some((turn) => turn.status === status);
}

/** 首轮划词轮已经展示了选中文本时，不再重复渲染原文卡片。 */
export function selectionShownInTurns(view: SessionView): boolean {
  return view.turns.some((turn) => turn.kind === 'selection' && turn.prompt === view.selectedText);
}

export interface SessionExportLabels {
  action: string;
  model: string;
  provider: string;
  created: string;
  updated: string;
  selectedText: string;
  user: string;
  assistant: string;
  untitled: string;
  error: string;
  selectionKind: string;
  followUpKind: string;
  status: Record<ConversationTurn['status'], string>;
}

export function sessionExportLabels(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): SessionExportLabels {
  return {
    action: t('sessionViewer.meta.action'),
    model: t('sessionViewer.meta.model'),
    provider: t('sessionViewer.meta.provider'),
    created: t('sessionViewer.meta.created'),
    updated: t('sessionViewer.meta.updated'),
    selectedText: t('sessionViewer.selectionText'),
    user: t('sessionViewer.export.user'),
    assistant: t('sessionViewer.export.assistant'),
    untitled: t('sessionViewer.untitled'),
    error: t('sessionViewer.errorLabel'),
    selectionKind: t('sessionViewer.turn.selection'),
    followUpKind: t('sessionViewer.turn.followUp'),
    status: {
      complete: t('sessionViewer.turn.status.complete'),
      canceled: t('sessionViewer.turn.status.canceled'),
      error: t('sessionViewer.turn.status.error'),
      streaming: t('sessionViewer.turn.status.streaming'),
    },
  };
}

export function exportSessionMarkdown(
  session: ChatSessionData,
  view: SessionView,
  labels: SessionExportLabels
): string {
  const blocks: string[] = [];
  blocks.push(`# ${session.title || labels.untitled}`, '');
  blocks.push(`- ${labels.action}: ${view.actionName}`);
  blocks.push(`- ${labels.model}: ${view.model}`);
  if (view.providerId) blocks.push(`- ${labels.provider}: ${view.providerId}`);
  if (session.createdAt) blocks.push(`- ${labels.created}: ${formatSessionTime(session.createdAt)}`);
  if (session.updatedAt) blocks.push(`- ${labels.updated}: ${formatSessionTime(session.updatedAt)}`);
  blocks.push('', '---', '');

  if (view.selectedText && !selectionShownInTurns(view)) {
    blocks.push(
      `## ${labels.selectedText}`,
      '',
      ...view.selectedText.split('\n').map((line) => `> ${line}`),
      ''
    );
  }

  view.turns.forEach((turn, index) => {
    const kind = turn.kind === 'selection' ? labels.selectionKind : labels.followUpKind;
    const status = turn.status === 'complete' ? '' : ` · ${labels.status[turn.status]}`;
    blocks.push(`## ${index + 1}. ${kind}${status}`, '');
    if (turn.prompt) blocks.push(`**${labels.user}**`, '', turn.prompt, '');
    blocks.push(`**${labels.assistant}**`, '', turn.answer, '');
    if (turn.error) blocks.push(`> ${labels.error}: ${turn.error}`, '');
    blocks.push('---', '');
  });

  // 不做空行归一化，避免改动回答正文里的代码块与空行
  return blocks.join('\n').trimEnd();
}
