import { useId } from 'react';
import type { ContextUsage } from '@/lib/chatTranscript';

export function ContextMeter({ usage, isZh }: { usage: ContextUsage; isZh: boolean }) {
  const tooltipId = useId();
  const { estimatedTokens, usedTurns, maxTurns } = usage;
  const progress = maxTurns > 0 ? usedTurns / maxTurns : 0;
  const lengthLabel = isZh
    ? `上下文长度：约 ${estimatedTokens.toLocaleString()} tokens`
    : `Context length: ~${estimatedTokens.toLocaleString()} tokens`;
  const turnsLabel = isZh
    ? `历史上下文：${usedTurns} / ${maxTurns} 轮`
    : `History: ${usedTurns} / ${maxTurns} turns`;
  const explanation = isZh
    ? '圆环表示保留的历史轮数；长度含选中文本、历史及草稿，为估算值。'
    : 'Ring shows retained history turns. Length estimates selection, history and draft.';

  return (
    <span
      tabIndex={0}
      role="img"
      aria-label={`${lengthLabel}; ${turnsLabel}`}
      aria-describedby={tooltipId}
      className="group/context relative flex size-7 shrink-0 cursor-help items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" strokeWidth="2.5" className="stroke-zinc-200 dark:stroke-zinc-700" />
        <circle
          cx="12" cy="12" r="9" pathLength="100" strokeWidth="2.5"
          strokeDasharray={`${progress * 100} 100`}
          strokeLinecap={progress > 0 ? 'round' : 'butt'}
          transform="rotate(-90 12 12)"
          className="stroke-blue-500 dark:stroke-blue-400"
        />
      </svg>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden w-60 rounded-xl border border-zinc-200 bg-white p-3 text-left text-xs leading-relaxed text-zinc-700 shadow-lg group-hover/context:block group-focus-visible/context:block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <span className="block font-medium">{lengthLabel}</span>
        <span className="block mt-1">{turnsLabel}</span>
        <span className="block mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{explanation}</span>
      </span>
    </span>
  );
}
