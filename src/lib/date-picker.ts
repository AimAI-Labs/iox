/** 自定义日期/时间选择器的纯逻辑：日期键、日历网格与本地化标签。 */

export interface CalendarDay {
  /** `YYYY-MM-DD` */
  date: string;
  day: number;
  /** 属于相邻月份，用于弱化显示。 */
  outside: boolean;
  today: boolean;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

export function formatDayKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export function parseDayKey(value: string): { year: number; monthIndex: number; day: number } | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) return null;
  const year = Number(matched[1]);
  const monthIndex = Number(matched[2]) - 1;
  const day = Number(matched[3]);
  const probe = new Date(year, monthIndex, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== monthIndex || probe.getDate() !== day) return null;
  return { year, monthIndex, day };
}

export function todayKey(now: Date = new Date()): string {
  return formatDayKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export function shiftMonth(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

/** 一周起始日（0 = 周日）；浏览器不支持 `weekInfo` 时回退到周一。 */
export function weekStart(locale: string): number {
  try {
    const info = (new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay?: number } }).weekInfo;
    if (info && typeof info.firstDay === 'number') return info.firstDay % 7;
  } catch {
    // 旧版引擎没有 weekInfo，使用 ISO 周一
  }
  return 1;
}

export function weekdayLabels(locale: string, firstDay: number): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  // 2024-01-07 是周日，用它推导一周内在该列应显示的星期名
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 7 + ((firstDay + index) % 7))));
}

export function monthLabel(year: number, monthIndex: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(year, monthIndex, 1));
}

export function formatDayDisplay(value: string, locale: string): string {
  const parts = parseDayKey(value);
  if (!parts) return '';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(parts.year, parts.monthIndex, parts.day));
}

export function dayAriaLabel(value: string, locale: string): string {
  const parts = parseDayKey(value);
  if (!parts) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(new Date(parts.year, parts.monthIndex, parts.day));
}

/** 固定 6 行的月历网格，避免切换月份时面板高度跳动。 */
export function buildMonthGrid(year: number, monthIndex: number, today: string, firstDay: number): CalendarDay[] {
  const offset = (new Date(year, monthIndex, 1).getDay() - firstDay + 7) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, monthIndex, 1 - offset + index);
    const key = formatDayKey(date.getFullYear(), date.getMonth(), date.getDate());
    return {
      date: key,
      day: date.getDate(),
      outside: date.getFullYear() !== year || date.getMonth() !== monthIndex,
      today: key === today,
    };
  });
}

export function parseClockValue(value: string): { hour: number; minute: number } | null {
  const matched = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return matched ? { hour: Number(matched[1]), minute: Number(matched[2]) } : null;
}

export function formatClockValue(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}
