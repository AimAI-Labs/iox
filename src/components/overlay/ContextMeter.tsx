import { useEffect, useId, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { HoverPopover, type PopoverAnchorRect } from './HoverPopover';
import { translations } from '@/locales';
import type { ContextUsage } from '@/types/session';

export function ContextMeter({ usage, isZh }: { usage: ContextUsage; isZh: boolean }) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchorRect, setAnchorRect] = useState<PopoverAnchorRect | null>(null);
  const open = anchorRect !== null;
  const labels = translations[isZh ? 'zh' : 'en'].card.contextMeter;
  const { estimatedTokens, selectionTokens, historyTokens, draftTokens, usedTurns, maxTurns } = usage;
  const progress = maxTurns > 0 ? Math.min(1, Math.max(0, usedTurns / maxTurns)) : 0;
  const format = (value: number) => value.toLocaleString(isZh ? 'zh-CN' : 'en-US');
  const turnsLabel = `${format(usedTurns)} / ${format(maxTurns)}`;
  const rows = [
    { label: labels.selection, value: selectionTokens, color: 'var(--context-selection)' },
    { label: labels.history, value: historyTokens, color: 'var(--context-history)' },
    { label: labels.draft, value: draftTokens, color: 'var(--context-draft)' },
  ];

  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function show() {
    cancelClose();
    if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!triggerRef.current?.matches(':focus-visible')) setAnchorRect(null);
    }, 120);
  }

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setAnchorRect(null);
    };
    const updateAnchor = () => {
      if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
    };
    window.addEventListener('keydown', closeOnEscape, true);
    window.addEventListener('resize', updateAnchor);
    return () => {
      window.removeEventListener('keydown', closeOnEscape, true);
      window.removeEventListener('resize', updateAnchor);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${labels.title}: ~${format(estimatedTokens)} tokens; ${labels.turns}: ${turnsLabel}`}
        aria-describedby={anchorRect ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        onClick={show}
        className="context-meter-trigger"
        data-open={open}
      >
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="11" strokeWidth="2.5" className="context-meter-track" />
          <circle
            cx="14" cy="14" r="11" pathLength="100" strokeWidth="2.5"
            strokeDasharray={`${progress * 100} 100`}
            strokeLinecap={progress > 0 ? 'round' : 'butt'}
            transform="rotate(-90 14 14)"
            className="context-meter-fill"
          />
          <text x="14" y="14" dy=".35em" textAnchor="middle" fill="currentColor" className="context-meter-count">
            {usedTurns}
          </text>
        </svg>
      </button>

      {anchorRect && (
        <HoverPopover
          open anchorRect={anchorRect} interactive
          className="context-usage-popover shadow-overlay custom-scrollbar"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div id={tooltipId} role="tooltip" className="context-usage-content">
            <div className="context-usage-heading">
              <span>{labels.title}</span>
              <span className="context-usage-total-label">{labels.total} <strong>~{format(estimatedTokens)}</strong></span>
            </div>

            <dl className="context-usage-breakdown">
              {rows.map((row) => (
                <div key={row.label} className="context-usage-row">
                  <dt><span className="context-usage-swatch" style={{ backgroundColor: row.color }} />{row.label}</dt>
                  <dd>{format(row.value)}</dd>
                </div>
              ))}
            </dl>

            <div className="context-usage-history">
              <div className="context-usage-row">
                <span className="context-usage-history-label"><Layers size={14} aria-hidden="true" />{labels.turns}</span>
                <strong className="context-usage-turns">{turnsLabel} <span>{labels.turnUnit}</span></strong>
              </div>
              <div
                role="progressbar" aria-label={labels.turns}
                aria-valuenow={usedTurns} aria-valuemin={0} aria-valuemax={maxTurns}
                aria-valuetext={maxTurns > 0 ? `${turnsLabel} ${labels.turnUnit}` : labels.disabled}
                className="context-usage-progress"
              >
                <span style={{ transform: `scaleX(${progress})` }} />
              </div>
              <div className="context-usage-legend">
                <span><i className="context-usage-swatch context-usage-retained" />{labels.retained}</span>
                <span><i className="context-usage-swatch context-usage-available" />{labels.available}</span>
              </div>
              {maxTurns === 0 && <p className="context-usage-disabled">{labels.disabled}</p>}
            </div>

            <p className="context-usage-note">{labels.note}</p>
          </div>
        </HoverPopover>
      )}
    </>
  );
}
