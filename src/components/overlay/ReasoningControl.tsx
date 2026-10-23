import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Brain, Zap } from 'lucide-react';
import { THINKING_LEVELS, type ThinkingMode } from '@/lib/reasoning';
import { cn } from '@/lib/utils';

const EFFORT_LABELS = ['Off', 'Low', 'High', 'Max'];
const EFFORT_COLORS = [
  { text: 'text-zinc-500 dark:text-zinc-400', light: '#71717a', dark: '#a1a1aa' },
  { text: 'text-sky-600 dark:text-sky-400', light: '#0284c7', dark: '#38bdf8' },
  { text: 'text-violet-600 dark:text-violet-400', light: '#7c3aed', dark: '#a78bfa' },
  { text: 'text-amber-700 dark:text-amber-400', light: '#b45309', dark: '#fbbf24' },
];

interface ReasoningControlProps {
  value: ThinkingMode;
  onChange?: (value: ThinkingMode) => void;
  supportsEffort: boolean;
  isZh: boolean;
}

export function ReasoningControl({ value, onChange, supportsEffort, isZh }: ReasoningControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const labels = EFFORT_LABELS;
  const index = THINKING_LEVELS.indexOf(value);
  const enabled = value !== 'quick';
  const title = 'Reasoning effort';
  const fallbackLabel = isZh ? '深度思考' : 'Reasoning';
  const buttonLabel = supportsEffort
    ? `${title}: ${labels[index]}`
    : fallbackLabel;

  useEffect(() => {
    setOpen(false);
  }, [supportsEffort]);

  useEffect(() => {
    if (!open) return;
    sliderRef.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="reasoning-control relative"
      style={{
        '--reasoning-accent-light': EFFORT_COLORS[index].light,
        '--reasoning-accent-dark': EFFORT_COLORS[index].dark,
      } as CSSProperties}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={!onChange}
        onClick={() => supportsEffort ? setOpen((previous) => !previous) : onChange?.(enabled ? 'quick' : 'deep')}
        className="reasoning-toggle flex size-6.5 items-center justify-center rounded-md border cursor-pointer disabled:cursor-default disabled:opacity-50"
        aria-label={buttonLabel}
        aria-expanded={supportsEffort ? open : undefined}
        aria-controls={open ? panelId : undefined}
        aria-pressed={supportsEffort ? undefined : enabled}
        title={buttonLabel}
      >
        {enabled ? <Brain size={14} /> : <Zap size={14} />}
      </button>

      {open && supportsEffort && (
        <div
          id={panelId}
          role="group"
          aria-label={title}
          className="reasoning-panel absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-xl border border-line bg-[#fcfcfd] p-3 shadow-lg dark:bg-[#18181b]"
        >
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="font-medium text-ink">{title}</span>
            <span className="reasoning-effort-value">
              <span className="sr-only" role="status">{labels[index]}</span>
              <span
                className="reasoning-effort-reel"
                style={{ '--reasoning-level': index } as CSSProperties}
                aria-hidden="true"
              >
                {labels.map((label, level) => (
                  <span key={label} className={cn('reasoning-effort-row', EFFORT_COLORS[level].text)}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {label}
                  </span>
                ))}
              </span>
            </span>
          </div>
          <div
            className="reasoning-slider-control"
            style={{ '--reasoning-position': index / 3 } as CSSProperties}
          >
            <span className="reasoning-slider-track" aria-hidden="true">
              <span className="reasoning-slider-fill" />
            </span>
            <span className="reasoning-slider-thumb" aria-hidden="true" />
            <input
              ref={sliderRef}
              type="range"
              min={0}
              max={3}
              step={1}
              value={index}
              onChange={(event) => onChange?.(THINKING_LEVELS[Number(event.target.value)])}
              aria-label={title}
              aria-valuetext={labels[index]}
              className="reasoning-slider"
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-ink-3" aria-hidden="true">
            {labels.map((label, level) => (
              <span key={label} className={cn('transition-colors duration-200 motion-reduce:transition-none', level === index && EFFORT_COLORS[level].text)}>{label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
