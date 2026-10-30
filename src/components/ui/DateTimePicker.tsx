import * as React from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildMonthGrid,
  dayAriaLabel,
  formatClockValue,
  formatDayDisplay,
  monthLabel,
  parseClockValue,
  parseDayKey,
  shiftMonth,
  todayKey,
  weekStart,
  weekdayLabels,
} from '@/lib/date-picker';

type Placement = 'top' | 'bottom';

interface PanelPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  placement: Placement;
}

const triggerClass = 'flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-input/80 bg-background/50 px-2.5 py-1 text-xs text-foreground shadow-none transition-all duration-150 outline-none hover:bg-accent/40 hover:border-input active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50';
const triggerOpenClass = 'ring-1.5 ring-primary border-primary bg-background/80';
const panelClass = 'fixed z-[99999] overflow-hidden rounded-lg border border-border/80 bg-popover/95 dark:bg-zinc-900/95 backdrop-blur-2xl shadow-2xl';
const panelEnterClass = 'animate-in fade-in-0 zoom-in-95 duration-150';
const navButtonClass = 'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-1.5 focus-visible:ring-primary';
const timeItemClass = 'flex h-7 w-full items-center justify-center rounded-md text-[11px] tabular-nums transition-colors outline-none focus-visible:ring-1.5 focus-visible:ring-primary';
const footButtonClass = 'rounded-md px-1.5 py-0.5 text-[10px] transition-colors outline-none focus-visible:ring-1.5 focus-visible:ring-primary';

/** 与 `Select` 一致的浮层定位：订阅先于交互，滚动/缩放时重算并夹在视口内。 */
function useAnchoredPanel(disabled: boolean | undefined, panelWidth: number, panelHeight: number) {
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState<PanelPosition | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const updatePosition = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: Placement = spaceBelow < panelHeight && rect.top > spaceBelow ? 'top' : 'bottom';
    setCoords(placement === 'bottom'
      ? { top: rect.bottom + 4, left, width: panelWidth, placement }
      : { bottom: window.innerHeight - rect.top + 4, left, width: panelWidth, placement });
  }, [panelHeight, panelWidth]);

  const toggle = React.useCallback(() => {
    if (disabled) return;
    if (open) { close(); return; }
    updatePosition();
    setOpen(true);
  }, [close, disabled, open, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close(true);
    };
    const handleReposition = () => updatePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, { capture: true, passive: true });
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, { capture: true });
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, open, updatePosition]);

  React.useEffect(() => {
    if (disabled && open) close();
  }, [close, disabled, open]);

  return { open, coords, triggerRef, panelRef, toggle, close };
}

function PickerPanel({
  coords,
  panelRef,
  label,
  className,
  children,
}: {
  coords: PanelPosition;
  panelRef: React.RefObject<HTMLDivElement | null>;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={{
        top: coords.top !== undefined ? `${coords.top}px` : undefined,
        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
      }}
      className={cn(
        panelClass,
        panelEnterClass,
        coords.placement === 'bottom' ? 'slide-in-from-top-1' : 'slide-in-from-bottom-1',
        className
      )}
    >
      {children}
    </div>,
    document.body
  );
}

function useLocaleText(locale: string) {
  const zh = locale.toLowerCase().startsWith('zh');
  return (cn: string, en: string) => (zh ? cn : en);
}

export interface DatePickerProps {
  /** `YYYY-MM-DD`，空字符串表示未选择。 */
  value: string;
  onChange: (value: string) => void;
  /** 用于本地化月份、星期与日期显示，例如 `zh` / `en`。 */
  locale?: string;
  placeholder?: string;
  'aria-label': string;
  title?: string;
  className?: string;
  disabled?: boolean;
}

const DATE_PANEL_WIDTH = 220;

export function DatePicker({
  value,
  onChange,
  locale = 'zh',
  placeholder,
  'aria-label': ariaLabel,
  title,
  className,
  disabled = false,
}: DatePickerProps) {
  const text = useLocaleText(locale);
  const firstDay = React.useMemo(() => weekStart(locale), [locale]);
  const labels = React.useMemo(() => weekdayLabels(locale, firstDay), [firstDay, locale]);
  const today = todayKey();
  const [view, setView] = React.useState(() => {
    const base = parseDayKey(value) ?? parseDayKey(today)!;
    return { year: base.year, monthIndex: base.monthIndex };
  });
  const { open, coords, triggerRef, panelRef, toggle, close } = useAnchoredPanel(disabled, DATE_PANEL_WIDTH, 280);
  const days = React.useMemo(() => buildMonthGrid(view.year, view.monthIndex, today, firstDay), [firstDay, today, view]);
  const focusIndex = React.useMemo(() => {
    const selected = days.findIndex(day => day.date === value);
    if (selected >= 0) return selected;
    const current = days.findIndex(day => day.date === today);
    return current >= 0 ? current : 0;
  }, [days, today, value]);
  const dayRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const openPicker = () => {
    if (!open) {
      const base = parseDayKey(value) ?? parseDayKey(today)!;
      setView({ year: base.year, monthIndex: base.monthIndex });
    }
    toggle();
  };

  React.useEffect(() => {
    if (!open) return;
    dayRefs.current[focusIndex]?.focus({ preventScroll: true });
  }, [open]);

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowLeft' ? -1
      : event.key === 'ArrowRight' ? 1
      : event.key === 'ArrowUp' ? -7
      : event.key === 'ArrowDown' ? 7
      : 0;
    if (!delta) return;
    const current = dayRefs.current.findIndex(button => button === document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    dayRefs.current[current + delta]?.focus({ preventScroll: true });
  };

  const display = formatDayDisplay(value, locale);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={openPicker}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(triggerClass, open && triggerOpenClass, className)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <CalendarDays size={13} className="shrink-0 text-muted-foreground" />
          <span className={cn('truncate tabular-nums', !display && 'text-muted-foreground')}>
            {display || placeholder || text('选择日期', 'Select date')}
          </span>
        </span>
        <ChevronDown
          size={13}
          className={cn('shrink-0 text-muted-foreground opacity-70 transition-transform duration-200', open && 'rotate-180 text-foreground opacity-100')}
        />
      </button>

      {open && coords && (
        <PickerPanel coords={coords} panelRef={panelRef} label={ariaLabel} className="p-2">
          <div className="mb-1 flex items-center justify-between px-0.5">
            <button type="button" className={navButtonClass} aria-label={text('上个月', 'Previous month')} onClick={() => setView(shiftMonth(view.year, view.monthIndex, -1))}>
              <ChevronLeft size={13} />
            </button>
            <span className="text-[11px] font-medium text-foreground">{monthLabel(view.year, view.monthIndex, locale)}</span>
            <button type="button" className={navButtonClass} aria-label={text('下个月', 'Next month')} onClick={() => setView(shiftMonth(view.year, view.monthIndex, 1))}>
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-x-0.5 gap-y-0.5">
            {labels.map((label, index) => (
              <span key={`${label}-${index}`} className="flex h-6 items-center justify-center text-[10px] text-muted-foreground/80">{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-x-0.5 gap-y-0.5" onKeyDown={handleGridKeyDown}>
            {days.map((day, index) => {
              const selected = day.date === value;
              return (
                <button
                  key={day.date}
                  ref={element => { dayRefs.current[index] = element; }}
                  type="button"
                  tabIndex={index === focusIndex ? 0 : -1}
                  onClick={() => { onChange(day.date); close(true); }}
                  aria-label={dayAriaLabel(day.date, locale)}
                  aria-current={day.today ? 'date' : undefined}
                  aria-pressed={selected}
                  className={cn(
                    'flex h-7 w-full items-center justify-center rounded-md text-[11px] tabular-nums transition-colors outline-none focus-visible:ring-1.5 focus-visible:ring-primary',
                    day.outside ? 'text-muted-foreground/45 hover:bg-accent/60' : 'text-foreground hover:bg-accent',
                    day.today && !selected && 'text-primary ring-1 ring-inset ring-primary/35',
                    selected && 'bg-primary font-medium text-primary-foreground hover:bg-primary'
                  )}
                >
                  {day.day}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 flex items-center justify-between border-t border-border/40 pt-1.5">
            <button type="button" className={cn(footButtonClass, 'text-primary hover:bg-primary/10')} onClick={() => { onChange(today); close(true); }}>
              {text('今天', 'Today')}
            </button>
            <button type="button" className={cn(footButtonClass, 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')} onClick={() => { onChange(''); close(true); }}>
              {text('清除', 'Clear')}
            </button>
          </div>
        </PickerPanel>
      )}
    </>
  );
}

export interface TimePickerProps {
  /** `HH:mm`，空字符串表示未选择。 */
  value: string;
  onChange: (value: string) => void;
  locale?: string;
  placeholder?: string;
  'aria-label': string;
  title?: string;
  className?: string;
  disabled?: boolean;
}

const TIME_PANEL_WIDTH = 120;
const TIME_COLUMN_CLASS = 'custom-scrollbar h-[11.125rem] min-w-0 flex-1 space-y-0.5 overflow-y-auto pr-1';
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);
const twoDigits = (value: number) => String(value).padStart(2, '0');

/** 让选中项居中；不使用 `scrollIntoView`，避免连带滚动其他祖先。 */
function centerItem(column: HTMLElement | null, item: HTMLElement | null | undefined) {
  if (!column || !item) return;
  const columnRect = column.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  column.scrollTop += itemRect.top - columnRect.top - (columnRect.height - itemRect.height) / 2;
}

export function TimePicker({
  value,
  onChange,
  locale = 'zh',
  placeholder = '--:--',
  'aria-label': ariaLabel,
  title,
  className,
  disabled = false,
}: TimePickerProps) {
  const text = useLocaleText(locale);
  const parsed = parseClockValue(value);
  const now = new Date();
  const { open, coords, triggerRef, panelRef, toggle, close } = useAnchoredPanel(disabled, TIME_PANEL_WIDTH, 280);
  const hourColumnRef = React.useRef<HTMLDivElement>(null);
  const minuteColumnRef = React.useRef<HTMLDivElement>(null);
  const hourRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const minuteRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const activeHour = parsed?.hour ?? now.getHours();
  const activeMinute = parsed?.minute ?? now.getMinutes();

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      centerItem(hourColumnRef.current, hourRefs.current[activeHour]);
      centerItem(minuteColumnRef.current, minuteRefs.current[activeMinute]);
      hourRefs.current[activeHour]?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const handleColumnKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    refs: React.RefObject<Array<HTMLButtonElement | null>>,
    count: number
  ) => {
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    const current = (refs.current ?? []).findIndex(button => button === document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    (refs.current ?? [])[Math.min(count - 1, Math.max(0, current + delta))]?.focus();
  };

  const pickHour = (hour: number) => onChange(formatClockValue(hour, parsed?.minute ?? 0));
  const pickMinute = (minute: number) => {
    onChange(formatClockValue(parsed?.hour ?? now.getHours(), minute));
    close(true);
  };
  const pickNow = () => {
    onChange(formatClockValue(now.getHours(), now.getMinutes()));
    close(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(triggerClass, open && triggerOpenClass, className)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Clock size={13} className="shrink-0 text-muted-foreground" />
          <span className={cn('truncate tabular-nums', !parsed && 'text-muted-foreground')}>{parsed ? value : placeholder}</span>
        </span>
        <ChevronDown
          size={13}
          className={cn('shrink-0 text-muted-foreground opacity-70 transition-transform duration-200', open && 'rotate-180 text-foreground opacity-100')}
        />
      </button>

      {open && coords && (
        <PickerPanel coords={coords} panelRef={panelRef} label={ariaLabel} className="p-1.5">
          <div className="flex gap-1 px-0.5 pb-0.5 text-[10px] text-muted-foreground/70">
            <span className="flex-1 text-center">{text('时', 'Hour')}</span>
            <span className="flex-1 text-center">{text('分', 'Minute')}</span>
          </div>
          <div className="flex gap-1">
            <div
              ref={hourColumnRef}
              className={TIME_COLUMN_CLASS}
              role="group"
              aria-label={text('小时', 'Hour')}
              onKeyDown={event => handleColumnKeyDown(event, hourRefs, HOURS.length)}
            >
              {HOURS.map(hour => (
                <button
                  key={hour}
                  ref={element => { hourRefs.current[hour] = element; }}
                  type="button"
                  tabIndex={activeHour === hour ? 0 : -1}
                  onClick={() => pickHour(hour)}
                  aria-pressed={parsed?.hour === hour}
                  className={cn(timeItemClass, parsed?.hour === hour ? 'bg-primary font-medium text-primary-foreground' : 'text-foreground hover:bg-accent')}
                >
                  {twoDigits(hour)}
                </button>
              ))}
            </div>
            <div
              ref={minuteColumnRef}
              className={TIME_COLUMN_CLASS}
              role="group"
              aria-label={text('分钟', 'Minute')}
              onKeyDown={event => handleColumnKeyDown(event, minuteRefs, MINUTES.length)}
            >
              {MINUTES.map(minute => (
                <button
                  key={minute}
                  ref={element => { minuteRefs.current[minute] = element; }}
                  type="button"
                  tabIndex={activeMinute === minute ? 0 : -1}
                  onClick={() => pickMinute(minute)}
                  aria-pressed={parsed?.minute === minute}
                  className={cn(timeItemClass, parsed?.minute === minute ? 'bg-primary font-medium text-primary-foreground' : 'text-foreground hover:bg-accent')}
                >
                  {twoDigits(minute)}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-1">
            <button type="button" className={cn(footButtonClass, 'text-primary hover:bg-primary/10')} onClick={pickNow}>
              {text('现在', 'Now')}
            </button>
            <button type="button" className={cn(footButtonClass, 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')} onClick={() => { onChange(''); close(true); }}>
              {text('清除', 'Clear')}
            </button>
          </div>
        </PickerPanel>
      )}
    </>
  );
}
