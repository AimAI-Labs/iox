import { WebSession } from '@/types/web-session';

export type TimeFilter = 'all' | 'today' | '7d' | '30d' | 'custom';

export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function filterHistory(sessions: WebSession[], options: {
  query: string; platform: string; time: TimeFilter; from: string; to: string; now?: Date;
}): WebSession[] {
  const now = options.now ?? new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  let lower = -Infinity;
  let upper = Infinity;
  if (options.time === 'today' || options.time === '7d' || options.time === '30d') {
    if (options.time !== 'today') start.setDate(start.getDate() - (options.time === '7d' ? 6 : 29));
    lower = start.getTime() / 1000;
    upper = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000 - 1;
  } else if (options.time === 'custom') {
    if (options.from) lower = new Date(`${options.from}T00:00:00`).getTime() / 1000;
    if (options.to) upper = new Date(`${options.to}T23:59:59`).getTime() / 1000;
  }
  const query = options.query.trim().toLocaleLowerCase();
  if (lower > upper || Number.isNaN(lower) || Number.isNaN(upper)) return [];
  return sessions.filter(session => {
    if (options.platform && session.actionId !== options.platform) return false;
    if (!`${session.platform} ${session.title}`.toLocaleLowerCase().includes(query)) return false;
    if (options.time !== 'all') {
      if (session.dateStart === null || session.dateEnd === null) return false;
      if (session.dateEnd < lower || session.dateStart > upper) return false;
    }
    return true;
  }).sort((a, b) => (b.dateEnd ?? -Infinity) - (a.dateEnd ?? -Infinity)
    || a.sourceOrder - b.sourceOrder || a.id.localeCompare(b.id));
}

export function groupHistory(sessions: WebSession[]): { key: string; sessions: WebSession[] }[] {
  const groups = new Map<string, WebSession[]>();
  for (const session of sessions) {
    const key = session.dateEnd === null ? 'unknown' : session.precision === 'range'
      ? `range:${session.dateStart}:${session.dateEnd}` : localDayKey(session.dateEnd);
    const rows = groups.get(key) ?? [];
    rows.push(session);
    groups.set(key, rows);
  }
  return [...groups].map(([key, rows]) => ({ key, sessions: rows }));
}
