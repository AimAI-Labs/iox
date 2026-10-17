import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  ExternalLink,
  Globe,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { ActionConfig } from '@/types/config';
import { PlatformSync, WebHistory, WebSession } from '@/types/web-session';
import { filterHistory, groupHistory, localDayKey, TimeFilter } from '@/lib/web-history';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Select, SelectOption } from '@/components/ui';
import { DynamicIcon } from '@/components/Icons';

const fieldClass = 'rounded-lg border border-border/60 bg-background/70 px-3 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30';
const buttonClass = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border/60 px-3 text-xs text-foreground hover:bg-primary/10 disabled:opacity-50 transition-colors';
const activeStatuses = new Set(['queued', 'collecting']);

function PlatformSyncBadge({
  platform,
  actionIcon,
  isSelected,
  onClick,
  onDoubleClick,
  statusLabel,
  text,
}: {
  platform: PlatformSync;
  actionIcon?: string;
  isSelected?: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  statusLabel: string;
  text: (cn: string, en: string) => string;
}) {
  const isSyncing = activeStatuses.has(platform.status);

  return (
    <div className="relative group/badge flex shrink-0 items-center justify-center">
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        data-platform-badge={platform.actionId}
        data-platform-status={platform.status}
        data-platform-count={platform.count}
        data-selected={isSelected ? "true" : "false"}
        className={cn(
          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background/80 transition-all duration-200 outline-none cursor-pointer",
          isSelected
            ? "border-primary bg-primary/15 ring-2 ring-primary/40 ring-offset-1.5 ring-offset-background shadow-xs scale-105"
            : isSyncing
            ? "border-primary/40 shadow-xs"
            : platform.status === 'error'
            ? "border-red-500/60 hover:border-red-500 hover:bg-red-500/10"
            : ['login_required', 'unavailable', 'partial'].includes(platform.status)
            ? "border-amber-500/60 hover:border-amber-500 hover:bg-amber-500/10"
            : "border-border/60 hover:border-primary/50 hover:bg-muted/70"
        )}
        aria-label={`${platform.platform}: ${statusLabel} (${platform.count})`}
        title={`${platform.platform}: ${statusLabel} · ${text(`已同步 ${platform.count} 条 (单击筛选，双击打开)`, `${platform.count} synced (Click to filter, double click to open)`)}`}
      >
        {/* Syncing spinning ring */}
        {isSyncing && (
          <span className="absolute -inset-[2.5px] rounded-full border-2 border-transparent border-t-primary border-r-primary/50 animate-spin pointer-events-none" />
        )}

        {/* Brand Icon */}
        <DynamicIcon name={actionIcon || platform.platform} size={15} />

        {/* Status dot in bottom right */}
        <span
          className={cn(
            "absolute bottom-0 right-0 flex h-2 w-2 items-center justify-center rounded-full border-[1.5px] border-background",
            isSyncing
              ? "bg-primary animate-pulse"
              : platform.status === 'error'
              ? "bg-red-500"
              : ['login_required', 'unavailable', 'partial'].includes(platform.status)
              ? "bg-amber-500"
              : "bg-emerald-500"
          )}
        />
      </button>

      {/* Hover Floating Card Tooltip */}
      <div
        role="tooltip"
        className={cn(
          "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none",
          "opacity-0 scale-95 group-hover/badge:opacity-100 group-hover/badge:scale-100 transition-all duration-150 flex flex-col items-center"
        )}
      >
        <div className="flex flex-col items-center rounded-lg border border-border/80 bg-popover/95 dark:bg-zinc-900/95 px-3 py-2 text-center shadow-xl backdrop-blur-md whitespace-nowrap min-w-32">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <DynamicIcon name={actionIcon || platform.platform} size={13} />
            <span>{platform.platform}</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className={cn(
                isSyncing && "text-primary font-medium",
                platform.status === 'error' && "text-red-500",
                ['login_required', 'unavailable', 'partial'].includes(platform.status) && "text-amber-500",
                ['ready', 'incremental'].includes(platform.status) && "text-emerald-500 font-medium"
              )}
            >
              {statusLabel}
            </span>
            <span className="font-mono text-foreground/90">
              · {text(`已同步 ${platform.count} 条`, `${platform.count} conversations`)}
            </span>
          </div>
          {platform.error && (
            <p className="mt-1 max-w-44 break-words text-[10px] text-red-500/90 leading-tight">
              {platform.error}
            </p>
          )}
          <span className="mt-1.5 text-[9px] text-muted-foreground/60 border-t border-border/40 pt-1 w-full">
            {text('单击筛选此平台 · 双击打开平台', 'Click to filter · Double-click to open')}
          </span>
        </div>
        {/* Tooltip arrow */}
        <div className="w-2 h-2 rotate-45 -mt-1 bg-popover dark:bg-zinc-900 border-r border-b border-border/80" />
      </div>
    </div>
  );
}

export function WebSessionsTab({ actions }: { actions: ActionConfig[] }) {
  const { resolvedLanguage } = useTranslation();
  const zh = resolvedLanguage === 'zh';
  const text = (cn: string, en: string) => zh ? cn : en;
  const [history, setHistory] = useState<WebHistory>({ version: 1, sessions: [], platforms: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const [time, setTime] = useState<TimeFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [opening, setOpening] = useState('');
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const data = await invoke<WebHistory>('list_web_sessions');
      if (request === generation.current) { setHistory(data); setError(''); }
    } catch (e) {
      if (request === generation.current) setError(String(e));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  const sync = useCallback(async (fullSync = false, skipFresh = false) => {
    try { await invoke('sync_web_sessions', { fullSync, skipFresh }); await load(); }
    catch (e) { setError(String(e)); }
  }, [load]);

  useEffect(() => {
    let alive = true;
    void load();
    const subscription = listen('web_sessions_changed', () => { if (alive) void load(); });
    void subscription.then(() => { if (alive) void sync(false, true); }).catch(e => { if (alive) setError(String(e)); });
    const timer = window.setInterval(() => void sync(false, true), 180_000);
    return () => {
      alive = false;
      generation.current++;
      window.clearInterval(timer);
      void subscription.then(unlisten => unlisten()).catch(() => {});
    };
  }, [load, sync]);

  const enabledIds = useMemo(() => new Set(actions.filter(a => a.actionType === 'web' && a.enabled).map(a => a.id)), [actions]);
  const actionMap = useMemo(() => new Map(actions.map(a => [a.id, a])), [actions]);
  const platforms = history.platforms.filter(p => enabledIds.has(p.actionId));
  const syncing = platforms.some(p => activeStatuses.has(p.status));
  const lastChecked = Math.max(0, ...platforms.map(p => p.syncedAt ?? 0));
  const sessions = useMemo(() => history.sessions.filter(s => enabledIds.has(s.actionId)), [history.sessions, enabledIds]);
  const filtered = useMemo(() => filterHistory(sessions, { query, platform, time, from, to }), [sessions, query, platform, time, from, to]);
  const groups = useMemo(() => groupHistory(filtered), [filtered]);
  const invalidRange = time === 'custom' && from && to && from > to;
  const today = localDayKey(Date.now() / 1000);
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDayKey(yesterdayDate.getTime() / 1000);

  const platformOptions = useMemo<SelectOption[]>(() => [
    {
      value: '',
      label: text('全部平台', 'All platforms'),
      icon: Globe,
    },
    ...platforms.map(p => {
      const action = actionMap.get(p.actionId);
      const iconName = action?.icon || p.platform;
      return {
        value: p.actionId,
        label: p.platform,
        icon: (props: any) => <DynamicIcon name={iconName} {...props} size={14} />,
      };
    }),
  ], [platforms, actionMap, text]);

  const timeOptions = useMemo<SelectOption[]>(() => [
    { value: 'all', label: text('全部时间', 'All time'), icon: Clock },
    { value: 'today', label: text('今天', 'Today'), icon: Calendar },
    { value: '7d', label: text('最近 7 天', 'Last 7 days'), icon: CalendarRange },
    { value: '30d', label: text('最近 30 天', 'Last 30 days'), icon: CalendarDays },
    { value: 'custom', label: text('自定义日期', 'Custom dates'), icon: CalendarDays },
  ], [text]);

  const statusLabel = (status: PlatformSync['status']) => ({
    queued: text('等待同步', 'Queued'), collecting: text('正在读取侧栏', 'Reading sidebar'),
    ready: text('已同步侧栏', 'Sidebar synced'), empty: text('暂无会话', 'No conversations'),
    incremental: text('增量已同步', 'Up to date'),
    partial: text('已加载部分历史', 'Partial history'), login_required: text('需要登录', 'Sign in required'),
    unavailable: text('未识别到侧栏', 'Sidebar not recognized'), error: text('同步失败', 'Sync failed'),
  }[status]);

  const open = async (session: WebSession, external: boolean) => {
    if (opening) return;
    setOpening(session.id);
    try { await invoke('open_web_session', { id: session.id, external }); }
    catch (e) { toast.error(text('打开会话失败', 'Could not open conversation'), { description: String(e) }); }
    finally { setOpening(''); }
  };

  const openPlatform = async (actionId: string) => {
    try { await invoke('trigger_web_action', { actionId, text: '', copyToClipboard: false, autoSubmitOverride: false }); }
    catch (e) { toast.error(String(e)); }
  };

  const groupLabel = (key: string, first: WebSession) => {
    if (key === 'unknown') return text('平台未提供日期', 'Date not provided by platform');
    if (key.startsWith('range:')) {
      return `${localDayKey(first.dateStart!)} — ${localDayKey(first.dateEnd!)} · ${text('平台日期范围', 'Platform date range')}`;
    }
    if (key === today) return text('今天', 'Today');
    if (key === yesterday) return text('昨天', 'Yesterday');
    return key;
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{text('网页会话', 'Web conversations')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{text('自动聚合已登录平台的侧栏会话，按平台会话时间排列。', 'Automatically collect signed-in sidebar conversations, ordered by their platform dates.')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className={buttonClass} type="button" disabled={syncing} onClick={() => void sync()}>
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />{syncing ? text('同步中', 'Syncing') : text('增量同步', 'Sync changes')}
          </button>
          <button className={buttonClass} type="button" disabled={syncing} onClick={() => void sync(true)} title={text('重新扫描全部历史，校准较早会话的改名和删除', 'Rescan all history to reconcile older changes and deletions')}>{text('全量同步', 'Full sync')}</button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-44 flex-1">
          <Search size={13} className="absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
          <input
            className={cn(fieldClass, 'h-8 w-full pl-9 py-0')}
            aria-label={text('搜索会话', 'Search conversations')}
            placeholder={text('搜索会话标题', 'Search conversation titles')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <Select
          wrapperClassName="w-40 shrink-0"
          value={platform}
          onChange={val => setPlatform(val)}
          options={platformOptions}
          aria-label={text('筛选平台', 'Filter platform')}
        />
        <Select
          wrapperClassName="w-36 shrink-0"
          value={time}
          onChange={val => setTime(val as TimeFilter)}
          options={timeOptions}
          aria-label={text('筛选时间', 'Filter time')}
        />
      </div>
      {time === 'custom' && <div className="flex flex-wrap items-center gap-2 text-xs">
        <CalendarDays size={13} className="text-muted-foreground" />
        <input type="date" className={cn(fieldClass, 'h-8 py-0')} aria-label={text('开始日期', 'Start date')} value={from} onChange={e => setFrom(e.target.value)} />
        <span>—</span>
        <input type="date" className={cn(fieldClass, 'h-8 py-0')} aria-label={text('结束日期', 'End date')} value={to} onChange={e => setTo(e.target.value)} />
        {invalidRange && <span role="alert" className="text-red-500 text-xs">{text('开始日期不能晚于结束日期', 'Start date must precede end date')}</span>}
      </div>}

      {error && <div role="alert" className="rounded-lg bg-red-500/10 p-3 text-xs text-red-500">{error}<button type="button" className="ml-2 underline" onClick={() => void sync()}>{text('重试', 'Retry')}</button></div>}
      {/* Horizontal Circular Platform Sync Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border/40 bg-background/30 px-3.5 py-2.5 no-scrollbar select-none">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-medium text-muted-foreground shrink-0">{text('平台状态', 'Platforms')}:</span>
          {!enabledIds.size ? (
            <span className="text-xs text-muted-foreground">{text('请先启用网页 AI 动作，然后在 IOX 中登录。', 'Enable a web AI action and sign in within IOX first.')}</span>
          ) : (
            platforms.map(p => {
              const action = actionMap.get(p.actionId);
              return (
                <PlatformSyncBadge
                  key={p.actionId}
                  platform={p}
                  actionIcon={action?.icon}
                  isSelected={platform === p.actionId}
                  onClick={() => setPlatform(prev => (prev === p.actionId ? '' : p.actionId))}
                  onDoubleClick={() => void openPlatform(p.actionId)}
                  statusLabel={statusLabel(p.status)}
                  text={text}
                />
              );
            })
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
          <span>
            {text(
              `已就绪 ${platforms.filter(p => ['ready', 'incremental', 'empty'].includes(p.status)).length}/${platforms.length}`,
              `${platforms.filter(p => ['ready', 'incremental', 'empty'].includes(p.status)).length}/${platforms.length} ready`
            )}
          </span>
          {platforms.some(p => p.status === 'login_required') && (
            <span className="text-amber-500 font-medium">· {text('需登录', 'Sign in required')}</span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/40 bg-background/20">
        {loading ? <p className="p-6 text-sm text-muted-foreground">{text('正在加载…', 'Loading…')}</p> : groups.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground"><MessageSquare className="mx-auto mb-3 opacity-50" size={26} />
            <p className="text-sm">{syncing ? text('正在读取各平台的历史会话…', 'Reading platform history…') : sessions.length ? text('没有符合筛选条件的会话', 'No conversations match your filters') : text('尚未同步到侧栏会话', 'No sidebar conversations synced yet')}</p>
            <p className="mt-2 text-xs">{text('请在 IOX 内登录平台。读取失败时可打开平台检查侧栏，再重新同步。', 'Sign in within IOX. If reading fails, open the platform, check its sidebar and sync again.')}</p>
          </div>
        ) : groups.map(group => <div key={group.key}>
          <h3 className="sticky top-0 z-10 border-b border-border/30 bg-background/95 px-4 py-2 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">{groupLabel(group.key, group.sessions[0])}<span className="ml-2 opacity-60">{group.sessions.length}</span></h3>
          {group.sessions.map(session => {
            const action = actionMap.get(session.actionId);
            const iconName = action?.icon || session.platform;

            return (
              <div key={session.id} className="group flex items-center gap-1 border-b border-border/20 pr-3 hover:bg-primary/5">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:bg-primary/10"
                  disabled={!!opening}
                  title={session.url}
                  onClick={() => void open(session, false)}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-black/5 dark:bg-white/5 text-muted-foreground transition-all group-hover:border-primary/30 group-hover:bg-primary/10"
                    title={session.platform}
                    data-platform={session.platform}
                  >
                    <DynamicIcon name={iconName} size={15} />
                    <span className="sr-only">{session.platform}</span>
                  </div>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/90">{session.title}</span>
                  {opening === session.id ? (
                    <LoaderCircle size={13} className="shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="shrink-0 text-[10px] text-muted-foreground font-mono">
                      {session.precision === 'exact' && session.dateEnd
                        ? new Date(session.dateEnd * 1000).toLocaleTimeString(resolvedLanguage, { hour: '2-digit', minute: '2-digit' })
                        : session.precision === 'range'
                        ? text('范围', 'Range')
                        : ''}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={!!opening}
                  className="rounded-md p-1.5 text-muted-foreground/70 hover:bg-primary/10 hover:text-primary transition-colors"
                  aria-label={`${text('在浏览器打开', 'Open in browser')}: ${session.title}`}
                  onClick={() => void open(session, true)}
                >
                  <ExternalLink size={13} />
                </button>
              </div>
            );
          })}
        </div>)}
      </div>
      <footer className="flex flex-wrap justify-between gap-1 text-[10px] leading-relaxed text-muted-foreground">
        <span>{text(`显示 ${filtered.length} / ${sessions.length} 条缓存`, `${filtered.length} / ${sessions.length} cached conversations`)}{lastChecked > 0 && ` · ${text('最近检查 ', 'Last checked ')}${new Date(lastChecked * 1000).toLocaleTimeString(resolvedLanguage, {hour: '2-digit', minute: '2-digit'})}`}</span>
        <span>{text('日期范围按重叠筛选；未提供日期的会话仅在“全部时间”显示。', 'Date ranges match by overlap; undated chats appear under All time only.')}</span>
      </footer>
    </section>
  );
}
