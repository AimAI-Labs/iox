import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * BUI Thinking — 可展开推理轨迹 (beautifului.dev Reasoning 变体)
 * 思考中: 四角星 + Shimmer 流光文字 + 实时秒数
 * 思考后: 静默耗时标题 + Grid 0fr/1fr 平滑折叠
 * ───────────────────────────────────────────────────────── */

export interface ThinkingBlockProps {
  thinkingText: string;
  isThinking: boolean;
  isOpen?: boolean;
  autoCollapseOnDone?: boolean;
  onToggleOpen?: () => void;
  className?: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  thinkingText,
  isThinking,
  isOpen: controlledIsOpen,
  autoCollapseOnDone = true,
  onToggleOpen: controlledToggleOpen,
  className,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const userToggledRef = useRef<boolean>(false);
  const { copied, copy } = useCopyFeedback(2000);

  const isControlled = typeof controlledIsOpen === 'boolean';
  const expanded = isControlled ? controlledIsOpen : internalIsOpen;

  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);

  // 耗时计时器
  useEffect(() => {
    if (isThinking) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
      const interval = setInterval(() => {
        if (startTimeRef.current !== null) {
          const sec = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
          setElapsedSeconds(parseFloat(sec));
        }
      }, 100);
      return () => clearInterval(interval);
    }
    if (startTimeRef.current !== null) {
      const finalSec = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
      setElapsedSeconds(parseFloat(finalSec));
    }
    // 思考结束且用户未手动展开过，若开启自动折叠则收起
    if (!userToggledRef.current && !isControlled && autoCollapseOnDone) {
      setInternalIsOpen(false);
    }
  }, [isThinking, isControlled, autoCollapseOnDone]);

  useLayoutEffect(() => {
    if (traceRef.current) {
      setLineHeight(traceRef.current.offsetHeight);
    }
  }, [thinkingText, expanded]);

  if (!thinkingText && !isThinking) {
    return null;
  }

  const handleToggle = () => {
    userToggledRef.current = true;
    if (controlledToggleOpen) {
      controlledToggleOpen();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  return (
    <div className={cn('flex w-full flex-col mb-1.5 select-none', className)}>
      {/* 1. Header — 四角星 + 状态文字 + 折叠箭头 */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={handleToggle}
        className="-mx-1 flex w-fit items-center gap-2 rounded-control px-1.5 py-1 transition-colors duration-100 hover:bg-hover-2 cursor-pointer group"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          className="shrink-0 transition-colors duration-200"
          fill={isThinking ? 'var(--ink-2)' : 'var(--ink-3)'}
        >
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>

        <span role="status" className="contents">
          {isThinking ? (
            /* 思考中 — Shimmer 流光 + 实时秒数 */
            <span
              className="bg-clip-text text-[13px] font-medium whitespace-nowrap text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, var(--ink-3) 35%, var(--ink) 50%, var(--ink-3) 65%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer-text 1.4s linear infinite',
              }}
            >
              {resolvedLanguage === 'zh'
                ? `思考中 ${elapsedSeconds > 0 ? `· ${elapsedSeconds.toFixed(1)}s` : ''}`
                : `Thinking ${elapsedSeconds > 0 ? `· ${elapsedSeconds.toFixed(1)}s` : ''}`}
            </span>
          ) : (
            /* 思考完成 — 静默耗时 */
            <span
              className="text-[13px] font-medium whitespace-nowrap text-ink-2"
              style={{ animation: 'fade-in 350ms ease-out both' }}
            >
              {t('card.thinkingDuration', { seconds: elapsedSeconds > 0 ? elapsedSeconds.toFixed(1) : '0' })}
            </span>
          )}
        </span>

        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 transition-transform duration-300"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* 2. 可展开轨迹 — Grid 0fr / 1fr 丝滑过渡 */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: expanded ? '1fr' : '0fr',
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-1 ml-[5px] pl-4">
            {/* 左侧垂直线导轨 */}
            <span
              aria-hidden
              className="absolute left-[3px] w-px bg-line"
              style={{
                top: -8,
                height: lineHeight ? Math.max(0, lineHeight - 2) : 0,
                transition: 'height 500ms cubic-bezier(0.23, 1, 0.32, 1)',
              }}
            />

            <div ref={traceRef} className="group/trace relative flex flex-col gap-1 py-1">
              {/* 推理正文 */}
              <div className="max-h-60 overflow-y-auto pr-1 text-[12.5px] leading-relaxed text-ink-2 whitespace-pre-wrap break-words select-text custom-scrollbar">
                {thinkingText || (resolvedLanguage === 'zh' ? 'AI 正在深入拆解问题与逻辑推理中...' : 'AI is reasoning and analyzing the problem...')}
                {isThinking && (
                  <span className="ml-0.5 inline-block h-3 w-[3px] translate-y-0.5 rounded-full bg-ink align-middle" />
                )}
              </div>

              {/* 悬浮复制按钮 */}
              {thinkingText && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copy(thinkingText);
                  }}
                  className="absolute right-0 top-0 flex size-5 items-center justify-center rounded-[5px] text-ink-3 opacity-0 transition-opacity duration-150 hover:bg-hover hover:text-ink cursor-pointer group-hover/trace:opacity-100"
                  title={t('common.copy')}
                >
                  {copied ? (
                    <Check size={11} className="text-emerald-600" />
                  ) : (
                    <Copy size={11} />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
