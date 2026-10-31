import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import {
  Check, Clock, Copy, FolderOpen, Hash, Layers, MessageSquare,
  Search, Sparkles, Trash2, X,
} from 'lucide-react';
import type { ActionConfig } from '@/types/config';
import type { ChatSessionData, SessionStorageError } from '@/types/session';
import { Button, ConfirmDialog, Select } from '@/components/ui';
import { SessionStorageAlert } from '@/components/SessionStorageAlert';
import { SessionTurnList } from '@/components/settings/SessionTurnList';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import {
  buildSessionRecords,
  exportSessionMarkdown,
  filterSessionRecords,
  formatSessionTime,
  groupSessionRecords,
  sessionDayKey,
  sessionExportLabels,
  sessionHasStatus,
  type SessionRecord,
} from '@/lib/session-view';

// 破坏性操作需要二次确认的时间窗口
const CONFIRM_TIMEOUT_MS = 4000;
// 会话增删由窗口自己完成，其他窗口据此刷新各自的列表
const SESSIONS_CHANGED_EVENT = 'chat_sessions_changed';

export interface SessionViewerProps {
  actions: ActionConfig[];
  initialSessionId?: string | null;
  /** 每次从其他窗口请求打开时递增，用于重新读取列表并定位会话。 */
  requestRevision?: number;
  onRequestClose?: () => void;
}

/** 历史会话查看视图：窗口主体内容，列表检索、结构化轮次与元信息。 */
export const SessionViewer: React.FC<SessionViewerProps> = ({
  actions,
  initialSessionId = null,
  requestRevision = 0,
  onRequestClose,
}) => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ChatSessionData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSessionId);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [storageError, setStorageError] = useState<SessionStorageError>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // 清空全部会话是破坏性操作，用独立弹窗二次确认
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { copied, copy } = useCopyFeedback(1800);

  const alive = useRef(true);
  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<ChatSessionData[]>('get_all_full_chat_sessions');
      if (!alive.current) return;
      setSessions(data ?? []);
      setStorageError((previous) => (previous === 'load' ? null : previous));
    } catch (error) {
      if (!alive.current) return;
      setStorageError('load');
      console.warn('Failed to load chat sessions:', error);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  // 每次打开请求重新读取，避免展示窗口打开前的陈旧快照
  useEffect(() => {
    setSelectedId(initialSessionId ?? null);
    setPendingDeleteId(null);
    setConfirmClearOpen(false);
    void fetchSessions();
  }, [requestRevision, initialSessionId, fetchSessions]);

  useEffect(() => () => {
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
  }, []);

  const records = useMemo(() => buildSessionRecords(sessions, actions), [sessions, actions]);

  const actionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const record of records) {
      if (!seen.has(record.view.actionId)) seen.set(record.view.actionId, record.view.actionName);
    }
    return [
      { value: '', label: t('sessionViewer.allActions') },
      ...[...seen].map(([value, label]) => ({ value, label })),
    ];
  }, [records, t]);

  const filtered = useMemo(
    () => filterSessionRecords(records, query, actionFilter),
    [records, query, actionFilter]
  );
  const groups = useMemo(() => groupSessionRecords(filtered), [filtered]);
  const active = useMemo(
    () => filtered.find((record) => record.session.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  const moveSelection = useCallback((delta: number) => {
    if (filtered.length === 0) return;
    const currentIndex = filtered.findIndex((record) => record.session.id === active?.session.id);
    const nextIndex = Math.min(filtered.length - 1, Math.max(0, (currentIndex < 0 ? 0 : currentIndex) + delta));
    setSelectedId(filtered[nextIndex].session.id);
  }, [filtered, active]);

  // 选中项滚动到可视区，并让详情回到顶部
  useEffect(() => {
    if (!active) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-session-id="${CSS.escape(active.session.id)}"]`
    );
    node?.scrollIntoView({ block: 'nearest' });
    detailRef.current?.scrollTo({ top: 0 });
  }, [active]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 弹窗打开时独占键盘：Esc 只关闭弹窗，方向键不再切换会话
      if (confirmClearOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setConfirmClearOpen(false);
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestClose?.();
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(event.key === 'ArrowDown' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmClearOpen, onRequestClose, moveSelection]);

  const exportLabels = useMemo(() => sessionExportLabels(t), [t]);

  const handleCopyAll = async () => {
    if (!active) return;
    await copy(exportSessionMarkdown(active.session, active.view, exportLabels));
  };

  const notifySessionsChanged = useCallback(() => {
    void emit(SESSIONS_CHANGED_EVENT).catch((error) => {
      console.warn('Failed to broadcast session changes:', error);
    });
  }, []);

  const handleDelete = async (id: string) => {
    if (pendingDeleteId !== id) {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      setPendingDeleteId(id);
      confirmTimer.current = window.setTimeout(() => setPendingDeleteId(null), CONFIRM_TIMEOUT_MS);
      return;
    }
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    setPendingDeleteId(null);
    try {
      await invoke('delete_chat_session', { id });
      if (!alive.current) return;
      setSessions((previous) => previous.filter((session) => session.id !== id));
      setSelectedId((previous) => (previous === id ? null : previous));
      setStorageError((previous) => (previous === 'delete' ? null : previous));
      notifySessionsChanged();
    } catch (error) {
      if (!alive.current) return;
      setStorageError('delete');
      console.error('Failed to delete chat session:', error);
    }
  };

  const closeClearDialog = useCallback(() => setConfirmClearOpen(false), []);

  const handleClearAll = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await invoke('clear_all_chat_sessions');
      if (!alive.current) return;
      setSessions([]);
      setSelectedId(null);
      setStorageError((previous) => (previous === 'clear' ? null : previous));
      setConfirmClearOpen(false);
      notifySessionsChanged();
    } catch (error) {
      if (!alive.current) return;
      // 关闭弹窗，让列表上方的错误提示可见
      setStorageError('clear');
      setConfirmClearOpen(false);
      console.error('Failed to clear chat sessions:', error);
    } finally {
      if (alive.current) setClearing(false);
    }
  };

  const handleOpenDirectory = async () => {
    try {
      await invoke('open_sessions_directory');
    } catch (error) {
      console.warn('Failed to open sessions directory:', error);
    }
  };

  const dayLabel = (timestamp: number) => {
    if (!timestamp) return t('sessionViewer.unknownDate');
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = startOfToday.getTime() / 1000;
    if (timestamp >= today) return t('sessionViewer.today');
    if (timestamp >= today - 86400) return t('sessionViewer.yesterday');
    return sessionDayKey(timestamp);
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-5 select-none">
      {/* 顶部：标题与检索工具，与设置页各 Tab 的头部结构一致 */}
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{t('sessionViewer.title')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('sessionViewer.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-52 min-w-0">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('sessionViewer.searchPlaceholder')}
              className="h-8 w-full rounded-lg border border-border/60 bg-background/60 pl-8 pr-7 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                title={t('sessionViewer.clearSearch')}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {actionOptions.length > 2 && (
            <Select
              value={actionFilter}
              options={actionOptions}
              onChange={setActionFilter}
              wrapperClassName="w-32 shrink-0"
              aria-label={t('sessionViewer.filterAction')}
            />
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void handleOpenDirectory()}
            title={t('sessionViewer.openDirectory')}
          >
            <FolderOpen size={13} />
            <span>{t('sessionViewer.openDirectory')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setConfirmClearOpen(true)}
            disabled={sessions.length === 0}
            title={t('sessionViewer.clearAll')}
          >
            <Trash2 size={13} />
            <span>{t('sessionViewer.clearAll')}</span>
          </Button>
        </div>
      </header>

      {storageError && <SessionStorageAlert error={storageError} />}

      <div className="flex min-h-0 flex-1 gap-4">
        {/* 会话列表 */}
        <div className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background/30">
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border/40 px-3 text-[11px] font-medium text-muted-foreground">
            <span>{t('sessionViewer.listLabel')}</span>
            <span className="font-mono tabular-nums">
              {filtered.length === records.length
                ? records.length
                : `${filtered.length}/${records.length}`}
            </span>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2 custom-scrollbar">
            {loading && records.length === 0 ? (
              <p className="px-2 py-10 text-center text-[11.5px] text-muted-foreground">
                {t('sessionViewer.loading')}
              </p>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-3 py-12 text-center text-muted-foreground">
                <MessageSquare size={26} className="opacity-30" />
                <p className="text-[11.5px]">{t('sessionViewer.empty')}</p>
                <p className="text-[10.5px] opacity-75">{t('sessionViewer.emptyHint')}</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-10 text-center text-[11.5px] text-muted-foreground">
                {t('sessionViewer.noResult')}
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.key}>
                  <div className="sticky top-0 z-10 flex items-center justify-between bg-[var(--bg-card)] px-2 pb-1 pt-2 text-[10px] font-medium text-muted-foreground/80">
                    <span>{dayLabel(group.timestamp)}</span>
                    <span className="font-mono tabular-nums opacity-70">{group.records.length}</span>
                  </div>
                  <div className="space-y-1">
                    {group.records.map((record) => {
                      const isActive = active?.session.id === record.session.id;
                      const failed = sessionHasStatus(record.view, 'error');
                      const canceled = sessionHasStatus(record.view, 'canceled');
                      return (
                        <button
                          key={record.session.id}
                          type="button"
                          data-session-id={record.session.id}
                          onClick={() => {
                            setSelectedId(record.session.id);
                            setPendingDeleteId(null);
                          }}
                          className={cn(
                            'flex w-full flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors',
                            isActive
                              ? 'border-primary/40 bg-primary/10 shadow-xs'
                              : 'border-transparent hover:border-border/60 hover:bg-black/[0.035] dark:hover:bg-white/[0.04]'
                          )}
                        >
                          <div className="flex items-start gap-1.5">
                            <span
                              className={cn(
                                'line-clamp-2 min-w-0 flex-1 text-[12.5px] font-medium leading-snug',
                                isActive ? 'text-primary dark:text-blue-400' : 'text-foreground'
                              )}
                            >
                              {record.session.title || t('sessionViewer.untitled')}
                            </span>
                            {record.view.legacy && (
                              <span className="mt-px shrink-0 rounded border border-border/60 px-1 text-[9px] leading-4 text-muted-foreground">
                                {t('sessionViewer.legacy')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                            <span className="max-w-24 truncate">{record.view.actionName}</span>
                            <span className="opacity-40">·</span>
                            <span className="max-w-28 truncate font-mono">{record.view.model}</span>
                            <span className="ml-auto shrink-0 font-mono tabular-nums">
                              {formatSessionTime(record.session.updatedAt).slice(11)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[9.5px]">
                            <span className="rounded bg-black/[0.04] px-1.5 py-px text-muted-foreground dark:bg-white/[0.06]">
                              {t('sessionViewer.turns', { count: record.view.turns.length })}
                            </span>
                            {failed && (
                              <span className="rounded bg-red-500/10 px-1.5 py-px text-red-600 dark:text-red-400">
                                {t('sessionViewer.turn.status.error')}
                              </span>
                            )}
                            {canceled && (
                              <span className="rounded bg-amber-500/10 px-1.5 py-px text-amber-600 dark:text-amber-400">
                                {t('sessionViewer.turn.status.canceled')}
                              </span>
                            )}
                            {record.view.thinkingMode !== 'quick' && (
                              <span className="rounded bg-violet-500/10 px-1.5 py-px text-violet-600 dark:text-violet-400">
                                {t('sessionViewer.meta.thinking')}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 详情 */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-background/30">
          {active ? (
            <>
              <div className="flex shrink-0 items-start gap-3 border-b border-border/40 px-5 py-3 select-none">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[14px] font-semibold text-foreground">
                    {active.session.title || t('sessionViewer.untitled')}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles size={10} />
                      {active.view.actionName}
                    </span>
                    <span className="inline-flex max-w-56 items-center gap-1 font-mono">
                      <Layers size={10} className="shrink-0" />
                      <span className="truncate">{active.view.model}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare size={10} />
                      {t('sessionViewer.turns', { count: active.view.turns.length })}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock size={10} />
                      {formatSessionTime(active.session.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void handleCopyAll()}
                    title={t('sessionViewer.copyAll')}
                  >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>{copied ? t('sessionViewer.copiedAll') : t('sessionViewer.copyAll')}</span>
                  </Button>
                  <Button
                    variant={pendingDeleteId === active.session.id ? 'destructive' : 'ghost'}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void handleDelete(active.session.id)}
                    title={t('sessionViewer.delete')}
                  >
                    <Trash2 size={12} />
                    <span>
                      {pendingDeleteId === active.session.id
                        ? t('sessionViewer.confirmDelete')
                        : t('sessionViewer.delete')}
                    </span>
                  </Button>
                </div>
              </div>

              <div ref={detailRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 custom-scrollbar select-text">
                {active.view.legacy && (
                  <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-400">
                    {t('sessionViewer.legacyHint')}
                  </div>
                )}
                <SessionMetaGrid record={active} />
                <SessionTurnList view={active.view} className="mt-3.5" />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageSquare size={30} className="opacity-30" />
              <p className="text-[12px]">
                {records.length === 0
                  ? t('sessionViewer.empty')
                  : filtered.length === 0
                    ? t('sessionViewer.noResult')
                    : t('sessionViewer.selectHint')}
              </p>
              {records.length === 0 && (
                <p className="text-[10.5px] opacity-75">{t('sessionViewer.emptyHint')}</p>
              )}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmClearOpen}
        destructive
        busy={clearing}
        title={t('sessionViewer.clearDialog.title')}
        description={t('sessionViewer.clearDialog.description', { count: sessions.length })}
        confirmLabel={t('sessionViewer.clearDialog.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => void handleClearAll()}
        onCancel={closeClearDialog}
      />
    </section>
  );
};

const SessionMetaGrid: React.FC<{ record: SessionRecord }> = ({ record }) => {
  const { t } = useTranslation();
  const { session, view } = record;
  const thinkingLabels: Record<string, string> = {
    quick: t('sessionViewer.thinking.quick'),
    low: t('sessionViewer.thinking.low'),
    deep: t('sessionViewer.thinking.deep'),
    max: t('sessionViewer.thinking.max'),
  };

  const fields: { label: string; value: string; mono?: boolean; icon?: boolean }[] = [
    { label: t('sessionViewer.meta.action'), value: view.actionName },
    { label: t('sessionViewer.meta.model'), value: view.model, mono: true },
    {
      label: t('sessionViewer.meta.thinking'),
      value: thinkingLabels[view.thinkingMode] ?? view.thinkingMode,
    },
    { label: t('sessionViewer.meta.turns'), value: String(view.turns.length) },
    { label: t('sessionViewer.meta.provider'), value: view.providerId || t('sessionViewer.meta.none'), mono: Boolean(view.providerId) },
    { label: t('sessionViewer.meta.created'), value: formatSessionTime(session.createdAt) || t('sessionViewer.meta.none'), mono: true },
    { label: t('sessionViewer.meta.updated'), value: formatSessionTime(session.updatedAt, true) || t('sessionViewer.meta.none'), mono: true },
    { label: t('sessionViewer.meta.sessionId'), value: session.id, mono: true, icon: true },
  ];

  return (
    <dl className="grid gap-2.5 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3 [grid-template-columns:repeat(auto-fit,minmax(118px,1fr))]">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground/80">
            {field.icon && <Hash size={9} />}
            {field.label}
          </dt>
          <dd
            className={cn('mt-0.5 truncate text-[11.5px] text-foreground', field.mono && 'font-mono')}
            title={field.value}
          >
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};
