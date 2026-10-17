import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CalendarDays, ExternalLink, LoaderCircle, MessageSquare, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ActionConfig } from '@/types/config';
import { PlatformSync, WebHistory, WebSession } from '@/types/web-session';
import { filterHistory, groupHistory, localDayKey, TimeFilter } from '@/lib/web-history';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

const fieldClass = 'rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30';
const buttonClass = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs text-foreground hover:bg-primary/10 disabled:opacity-50';
const activeStatuses = new Set(['queued', 'collecting']);

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

  const sync = useCallback(async () => {
    try { await invoke('sync_web_sessions'); await load(); }
    catch (e) { setError(String(e)); }
  }, [load]);

  useEffect(() => {
    let alive = true;
    void load();
    const subscription = listen('web_sessions_changed', () => { if (alive) void load(); });
    void subscription.then(() => { if (alive) void sync(); }).catch(e => { if (alive) setError(String(e)); });
    const timer = window.setInterval(() => void sync(), 180_000);
    return () => {
      alive = false;
      generation.current++;
      window.clearInterval(timer);
      void subscription.then(unlisten => unlisten()).catch(() => {});
    };
  }, [load, sync]);

  const enabledIds = useMemo(() => new Set(actions.filter(a => a.actionType === 'web' && a.enabled).map(a => a.id)), [actions]);
  const platforms = history.platforms.filter(p => enabledIds.has(p.actionId));
  const syncing = platforms.some(p => activeStatuses.has(p.status));
  const sessions = useMemo(() => history.sessions.filter(s => enabledIds.has(s.actionId)), [history.sessions, enabledIds]);
  const filtered = useMemo(() => filterHistory(sessions, { query, platform, time, from, to }), [sessions, query, platform, time, from, to]);
  const groups = useMemo(() => groupHistory(filtered), [filtered]);
  const invalidRange = time === 'custom' && from && to && from > to;
  const today = localDayKey(Date.now() / 1000);
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDayKey(yesterdayDate.getTime() / 1000);

  const statusLabel = (status: PlatformSync['status']) => ({
    queued: text('等待同步', 'Queued'), collecting: text('正在读取侧栏', 'Reading sidebar'),
    ready: text('已同步侧栏', 'Sidebar synced'), empty: text('暂无会话', 'No conversations'),
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
        <button className={cn(buttonClass, 'shrink-0')} type="button" disabled={syncing} onClick={() => void sync()}>
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />{syncing ? text('同步中', 'Syncing') : text('同步会话', 'Sync history')}
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-40 flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
          <input className={cn(fieldClass, 'w-full pl-9')} aria-label={text('搜索会话', 'Search conversations')} placeholder={text('搜索会话标题', 'Search conversation titles')} value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <select className={cn(fieldClass, 'max-w-40')} aria-label={text('筛选平台', 'Filter platform')} value={platform} onChange={e => setPlatform(e.target.value)}>
          <option value="">{text('全部平台', 'All platforms')}</option>
          {platforms.map(p => <option key={p.actionId} value={p.actionId}>{p.platform}</option>)}
        </select>
        <select className={fieldClass} aria-label={text('筛选时间', 'Filter time')} value={time} onChange={e => setTime(e.target.value as TimeFilter)}>
          <option value="all">{text('全部时间', 'All time')}</option><option value="today">{text('今天', 'Today')}</option>
          <option value="7d">{text('最近 7 天', 'Last 7 days')}</option><option value="30d">{text('最近 30 天', 'Last 30 days')}</option>
          <option value="custom">{text('自定义日期', 'Custom dates')}</option>
        </select>
      </div>
      {time === 'custom' && <div className="flex flex-wrap items-center gap-2 text-xs">
        <CalendarDays size={14} className="text-muted-foreground" />
        <input type="date" className={fieldClass} aria-label={text('开始日期', 'Start date')} value={from} onChange={e => setFrom(e.target.value)} />
        <span>—</span><input type="date" className={fieldClass} aria-label={text('结束日期', 'End date')} value={to} onChange={e => setTo(e.target.value)} />
        {invalidRange && <span role="alert" className="text-red-500">{text('开始日期不能晚于结束日期', 'Start date must precede end date')}</span>}
      </div>}

      {error && <div role="alert" className="rounded-lg bg-red-500/10 p-3 text-xs text-red-500">{error}<button type="button" className="ml-2 underline" onClick={() => void sync()}>{text('重试', 'Retry')}</button></div>}
      <details className="rounded-lg border border-border/40 px-3 py-2 text-xs" open={platforms.some(p => ['error', 'login_required', 'unavailable', 'partial'].includes(p.status)) || undefined}>
        <summary className="cursor-pointer text-muted-foreground">{text('平台同步状态', 'Platform sync status')} · {platforms.filter(p => ['ready', 'empty'].includes(p.status)).length}/{platforms.length}</summary>
        <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
          {!enabledIds.size && <p>{text('请先启用网页 AI 动作，然后在 IOX 中登录。', 'Enable a web AI action and sign in within IOX first.')}</p>}
          {platforms.map(p => <div key={p.actionId} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{p.platform}</span>
            <span className={cn('text-muted-foreground', ['error', 'unavailable', 'login_required', 'partial'].includes(p.status) && 'text-amber-600 dark:text-amber-400')} title={p.error ?? undefined}>{statusLabel(p.status)}</span>
            {p.count > 0 && <span className="text-muted-foreground">{p.count}</span>}
            {!activeStatuses.has(p.status) && <button type="button" className="text-primary hover:underline" onClick={() => void openPlatform(p.actionId)}>{text('打开平台', 'Open platform')}</button>}
            {p.error && <span className="w-full break-words text-[11px] text-muted-foreground">{p.error}</span>}
          </div>)}
        </div>
      </details>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/40 bg-background/20">
        {loading ? <p className="p-6 text-sm text-muted-foreground">{text('正在加载…', 'Loading…')}</p> : groups.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground"><MessageSquare className="mx-auto mb-3 opacity-50" size={26} />
            <p className="text-sm">{syncing ? text('正在读取各平台的历史会话…', 'Reading platform history…') : sessions.length ? text('没有符合筛选条件的会话', 'No conversations match your filters') : text('尚未同步到侧栏会话', 'No sidebar conversations synced yet')}</p>
            <p className="mt-2 text-xs">{text('请在 IOX 内登录平台。读取失败时可打开平台检查侧栏，再重新同步。', 'Sign in within IOX. If reading fails, open the platform, check its sidebar and sync again.')}</p>
          </div>
        ) : groups.map(group => <div key={group.key}>
          <h3 className="sticky top-0 z-10 border-b border-border/30 bg-background/95 px-4 py-2 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">{groupLabel(group.key, group.sessions[0])}<span className="ml-2 opacity-60">{group.sessions.length}</span></h3>
          {group.sessions.map(session => <div key={session.id} className="group flex items-center gap-1 border-b border-border/20 pr-3 hover:bg-primary/5">
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-primary/10" disabled={!!opening} title={session.url} onClick={() => void open(session, false)}>
              <span className="w-20 shrink-0 truncate rounded-md bg-primary/10 px-2 py-1 text-center text-[11px] font-medium text-primary">{session.platform}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{session.title}</span>
              {opening === session.id ? <LoaderCircle size={14} className="shrink-0 animate-spin" /> : <span className="shrink-0 text-[10px] text-muted-foreground">{session.precision === 'exact' && session.dateEnd ? new Date(session.dateEnd * 1000).toLocaleTimeString(resolvedLanguage, { hour: '2-digit', minute: '2-digit' }) : session.precision === 'range' ? text('范围', 'Range') : ''}</span>}
            </button>
            <button type="button" disabled={!!opening} className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label={`${text('在浏览器打开', 'Open in browser')}: ${session.title}`} onClick={() => void open(session, true)}><ExternalLink size={13} /></button>
          </div>)}
        </div>)}
      </div>
      <footer className="flex flex-wrap justify-between gap-1 text-[10px] leading-relaxed text-muted-foreground">
        <span>{text(`显示 ${filtered.length} / ${sessions.length} 条`, `${filtered.length} / ${sessions.length} conversations`)}</span>
        <span>{text('日期范围按重叠筛选；未提供日期的会话仅在“全部时间”显示。', 'Date ranges match by overlap; undated chats appear under All time only.')}</span>
      </footer>
    </section>
  );
}
