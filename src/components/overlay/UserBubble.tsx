import React, { useState } from 'react';
import { User, Copy, Check, ChevronDown } from 'lucide-react';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * BUI 用户气泡 (beautifului.dev Chat)
 * 右对齐软块 — rounded-xl bg-field，无多余装饰
 * ───────────────────────────────────────────────────────── */

export interface UserBubbleProps {
  content: string;
  isInitialContext?: boolean;
  className?: string;
}

export const UserBubble: React.FC<UserBubbleProps> = ({
  content,
  isInitialContext = false,
  className,
}) => {
  const { copied, copy } = useCopyFeedback(2000);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) return null;

  const isLong = content.length > 200;
  const displayContent =
    isLong && !isExpanded ? content.slice(0, 180) + '...' : content;

  return (
    <div
      className={cn(
        'group/bubble relative mb-2.5 flex justify-end pl-12 select-text',
        className
      )}
    >
      <div className="flex max-w-full flex-col items-end gap-1">
        {/* 身份标识 — 仅初始选中文本展示 */}
        {isInitialContext && (
          <div className="flex items-center gap-1.5 px-1 text-[11px] text-ink-3 select-none">
            <User size={10} className="shrink-0" />
            <span>选中文本</span>
          </div>
        )}

        {/* 气泡本体 */}
        <div
          className="max-w-full rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/80 px-3.5 py-2 text-[12.5px] leading-[1.5] text-zinc-800 dark:text-zinc-200 break-words whitespace-pre-wrap border border-zinc-200/50 dark:border-zinc-700/50 shadow-2xs"
          style={{
            animation: 'fade-up 300ms cubic-bezier(0.23, 1, 0.32, 1) both',
          }}
        >
          <span>{displayContent}</span>

          {/* 长文本展开/收起 */}
          {isLong && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer select-none"
            >
              <span>{isExpanded ? '收起' : '展开'}</span>
              <ChevronDown
                size={10}
                className={cn(
                  'transition-transform duration-200',
                  isExpanded ? 'rotate-180' : ''
                )}
              />
            </button>
          )}
        </div>

        {/* 悬浮复制按钮 */}
        <button
          type="button"
          onClick={() => copy(content)}
          className="flex size-5 items-center justify-center rounded-[5px] text-ink-3 opacity-0 transition-opacity duration-150 hover:bg-hover hover:text-ink cursor-pointer select-none group-hover/bubble:opacity-100"
          title="复制内容"
        >
          {copied ? (
            <Check size={11} className="text-emerald-600" />
          ) : (
            <Copy size={11} />
          )}
        </button>
      </div>
    </div>
  );
};
