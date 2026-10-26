import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, FileText } from 'lucide-react';
import { MarkdownContent } from '@/components/overlay/MarkdownContent';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { selectionShownInTurns, type SessionView } from '@/lib/session-view';
import type { ConversationTurn } from '@/types/session';

const STATUS_CLASS: Record<Exclude<ConversationTurn['status'], 'complete'>, string> = {
  canceled: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  error: 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400',
  streaming: 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

export interface SessionTurnListProps {
  view: SessionView;
  /** 设置页内嵌预览使用更紧凑的间距。 */
  dense?: boolean;
  className?: string;
}

/** 只读轮次渲染：查看面板与设置页预览共用，避免各自反解历史文本。 */
export const SessionTurnList: React.FC<SessionTurnListProps> = ({ view, dense = false, className }) => {
  const { t } = useTranslation();
  const { copied, copy } = useCopyFeedback(1600);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) setCopiedTurnId(null);
  }, [copied]);

  const showSelectionText = Boolean(view.selectedText) && !selectionShownInTurns(view);
  const statusLabels = useMemo(
    () => ({
      canceled: t('sessionViewer.turn.status.canceled'),
      error: t('sessionViewer.turn.status.error'),
      streaming: t('sessionViewer.turn.status.streaming'),
    }),
    [t]
  );

  const handleCopy = async (turn: ConversationTurn) => {
    if (!turn.answer) return;
    const ok = await copy(turn.answer);
    if (ok) setCopiedTurnId(turn.id);
  };

  return (
    <div className={cn('flex flex-col', dense ? 'gap-2.5' : 'gap-3.5', className)}>
      {showSelectionText && (
        <section className="rounded-xl border border-border/50 bg-muted/25 px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground">
            <FileText size={11} />
            <span>{t('sessionViewer.selectionText')}</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground/90">
            {view.selectedText}
          </p>
        </section>
      )}

      {view.turns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-[12px] text-muted-foreground">
          {t('sessionViewer.emptyTurns')}
        </div>
      ) : (
        view.turns.map((turn, index) => {
          const isSelection = turn.kind === 'selection';
          const showStatus = turn.status !== 'complete';
          return (
            <article
              key={turn.id}
              className="overflow-hidden rounded-xl border border-border/50 bg-background/50"
            >
              <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/40 bg-muted/25 px-3 py-1.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-[11px] font-medium text-foreground/80">
                  {isSelection ? t('sessionViewer.turn.selection') : t('sessionViewer.turn.followUp')}
                </span>
                {showStatus && (
                  <span
                    className={cn(
                      'rounded-full border px-1.5 py-px text-[10px] font-medium',
                      STATUS_CLASS[turn.status as Exclude<ConversationTurn['status'], 'complete'>]
                    )}
                  >
                    {statusLabels[turn.status as keyof typeof statusLabels]}
                  </span>
                )}

                <div className="ml-auto flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
                  {turn.model && (
                    <span className="max-w-40 truncate" title={turn.model}>
                      {turn.model}
                    </span>
                  )}
                  {typeof turn.duration === 'number' && (
                    <span className="tabular-nums">{t('sessionViewer.duration', { seconds: turn.duration })}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleCopy(turn)}
                    className="flex size-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 disabled:opacity-40"
                    disabled={!turn.answer}
                    title={t('sessionViewer.copyTurn')}
                    aria-label={t('sessionViewer.copyTurn')}
                  >
                    {copied && copiedTurnId === turn.id ? (
                      <Check size={11} className="text-emerald-500" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                </div>
              </header>

              {turn.prompt && (
                <div className="border-b border-dashed border-border/40 px-3 py-2">
                  <div className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground/80">
                    {isSelection ? t('sessionViewer.selectionText') : t('sessionViewer.turn.prompt')}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground/90">
                    {turn.prompt}
                  </p>
                </div>
              )}

              <div className={cn('px-3', dense ? 'py-2' : 'py-2.5')}>
                {turn.answer ? (
                  <MarkdownContent
                    content={turn.answer}
                    codeBlockWrap
                    codeBlockLineNumbers
                    className={cn(
                      'leading-relaxed text-foreground',
                      dense ? 'text-[12px]' : 'text-[12.5px]'
                    )}
                  />
                ) : (
                  <p className="text-[11.5px] italic text-muted-foreground">{t('sessionViewer.emptyAnswer')}</p>
                )}
              </div>

              {turn.error && (
                <div className="border-t border-red-500/20 bg-red-500/5 px-3 py-2 text-[11.5px] leading-relaxed text-red-600 dark:text-red-400">
                  {turn.error}
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  );
};
