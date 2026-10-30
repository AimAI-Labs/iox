import { WebSession } from '@/types/web-session';

export type TimeFilter = 'all' | 'today' | '7d' | '30d' | 'custom';

export interface HistoryFilter {
  query: string;
  platform: string;
  time: TimeFilter;
  /** `YYYY-MM-DD`，仅 `custom` 使用；留空表示该侧不设边界。 */
  from: string;
  to: string;
  /** `HH:mm`，仅 `custom` 使用；留空表示开始取 00:00、结束取该日 23:59。 */
  fromTime?: string;
  toTime?: string;
  now?: Date;
}

/** 会话时间重叠区间（Unix 秒）；`valid` 为 false 时表示输入本身矛盾或无法解析。 */
export interface TimeWindow {
  lower: number;
  upper: number;
  valid: boolean;
}

const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const END_OF_DAY = 86_399;

export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localDayStart(day: string): number | null {
  const value = new Date(`${day}T00:00:00`).getTime();
  return Number.isNaN(value) ? null : value / 1000;
}

function clockSeconds(clock: string | undefined): number | null {
  if (!clock) return null;
  const matched = CLOCK_PATTERN.exec(clock);
  return matched ? Number(matched[1]) * 3600 + Number(matched[2]) * 60 : null;
}

/**
 * 解析当前筛选的时间窗。自定义时间段按本地时间解释，结束时间包含整分钟，
 * 以便 `09:00` 这种输入覆盖该分钟内的会话。
 */
export function timeWindow(options: Omit<HistoryFilter, 'query' | 'platform'>): TimeWindow {
  const now = options.now ?? new Date();
  if (options.time === 'all') return { lower: -Infinity, upper: Infinity, valid: true };
  if (options.time !== 'custom') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (options.time !== 'today') start.setDate(start.getDate() - (options.time === '7d' ? 6 : 29));
    return {
      lower: start.getTime() / 1000,
      upper: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000 - 1,
      valid: true,
    };
  }

  const fromBase = options.from ? localDayStart(options.from) : null;
  const toBase = options.to ? localDayStart(options.to) : null;
  const fromClock = clockSeconds(options.fromTime);
  const toClock = clockSeconds(options.toTime);
  if ((options.from && fromBase === null) || (options.to && toBase === null)) {
    return { lower: 0, upper: 0, valid: false };
  }
  if ((options.fromTime && fromClock === null) || (options.toTime && toClock === null)) {
    return { lower: 0, upper: 0, valid: false };
  }

  const lower = fromBase === null ? -Infinity : fromBase + (fromClock ?? 0);
  // 结束时间留空表示当天结束；给定时向后延伸 59 秒覆盖该分钟。
  const upper = toBase === null
    ? Infinity
    : toBase + (options.toTime ? (toClock ?? 0) + 59 : END_OF_DAY);
  if (lower > upper) return { lower, upper, valid: false };
  return { lower, upper, valid: true };
}

export function filterHistory(sessions: WebSession[], options: HistoryFilter): WebSession[] {
  const window = timeWindow(options);
  if (!window.valid) return [];
  const query = options.query.trim().toLocaleLowerCase();
  return sessions.filter(session => {
    if (options.platform && session.actionId !== options.platform) return false;
    if (!`${session.platform} ${session.title}`.toLocaleLowerCase().includes(query)) return false;
    if (options.time !== 'all') {
      if (session.dateStart === null || session.dateEnd === null) return false;
      if (session.dateEnd < window.lower || session.dateStart > window.upper) return false;
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
