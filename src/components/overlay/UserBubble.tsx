import React, { useLayoutEffect, useRef, useState } from 'react';
import { User, Copy, Check, ChevronDown, Pencil } from 'lucide-react';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * BUI 用户气泡 (beautifului.dev Chat)
 * 右对齐软块 — rounded-xl bg-field，无多余装饰
 * 超长内容按高度折叠，展开按钮始终位于可视区域内
 * ───────────────────────────────────────────────────────── */

export interface UserBubbleProps {
  content: string;
  isInitialContext?: boolean;
  isEditing?: boolean;
  editDisabled?: boolean;
  sendKeyShortcut?: 'Enter' | 'Ctrl+Enter';
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: (content: string) => void;
  className?: string;
}

/** 折叠时展示约 4 行（12.5px × 1.5 ≈ 18.75px/行） */
const COLLAPSED_MAX_HEIGHT = 75;

export const UserBubble: React.FC<UserBubbleProps> = ({
  content,
  isInitialContext = false,
  isEditing = false,
  editDisabled = false,
  sendKeyShortcut = 'Enter',
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  className,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';
  const { copied, copy } = useCopyFeedback(2000);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(content);

  useLayoutEffect(() => {
    setDraft(content);
    if (isEditing) {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(content.length, content.length);
    }
  }, [content, isEditing]);

  useLayoutEffect(() => {
    if (!isEditing || !editorRef.current) return;
    editorRef.current.style.height = 'auto';
    editorRef.current.style.height = `${Math.min(240, Math.max(48, editorRef.current.scrollHeight))}px`;
  }, [draft, isEditing]);

  // 切换会话导致内容变化时，回到折叠态
  useLayoutEffect(() => {
    setIsExpanded(false);
  }, [content]);

  // 按真实渲染高度判断是否需要折叠，避免按字符数误伤短文本
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element || isExpanded) return;

    const measure = () => {
      setIsOverflowing(element.scrollHeight - element.clientHeight > 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content, isExpanded, isEditing]);

  if (!content) return null;

  return (
    <div
      data-user-message="true"
      data-user-message-text={content.slice(0, 160)}
      className={cn(
        'group/bubble relative mb-2.5 flex justify-end pl-12 select-text',
        className
      )}
    >
      <div className={cn('flex min-w-0 max-w-full flex-col items-end gap-1', isEditing && 'w-full')}>
        {/* 身份标识 — 仅初始选中文本展示 */}
        {isInitialContext && (
          <div className="flex items-center gap-1.5 px-1 text-[11px] text-ink-3 select-none">
            <User size={10} className="shrink-0" />
            <span>{t('bubble.copySelected')}</span>
          </div>
        )}

        {/* 气泡本体 */}
        {isEditing ? (
          <form
            className="w-full rounded-2xl border border-blue-400/70 bg-white p-3 shadow-sm dark:border-blue-500/60 dark:bg-zinc-800"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim() && !editDisabled) onSubmitEdit?.(draft);
            }}
          >
            <textarea
              ref={editorRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={editDisabled}
              aria-label={isZh ? '编辑已发送消息' : 'Edit sent message'}
              className="block w-full resize-none bg-transparent text-[12.5px] leading-[1.5] text-zinc-800 outline-none select-text custom-scrollbar dark:text-zinc-200"
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  onCancelEdit?.();
                }
                const send = sendKeyShortcut === 'Ctrl+Enter'
                  ? (event.ctrlKey || event.metaKey)
                  : (!event.shiftKey && !event.ctrlKey && !event.metaKey);
                if (event.key === 'Enter' && send) {
                  event.preventDefault();
                  if (draft.trim() && !editDisabled) onSubmitEdit?.(draft);
                }
              }}
            />
            <div className="mt-2 flex justify-end gap-2 select-none">
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={editDisabled}
                className="rounded-full px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={!draft.trim() || editDisabled}
                className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-40"
              >
                {isZh ? '重新发送' : 'Resend'}
              </button>
            </div>
          </form>
        ) : (
          <div
            className="max-w-full rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/80 px-3.5 py-2 text-[12.5px] leading-[1.5] text-zinc-800 dark:text-zinc-200 break-words [overflow-wrap:anywhere] whitespace-pre-wrap border border-zinc-200/50 dark:border-zinc-700/50 shadow-2xs"
            style={{
              animation: 'fade-up 300ms cubic-bezier(0.23, 1, 0.32, 1) both',
            }}
          >
            <div
              ref={contentRef}
              className={cn('relative', !isExpanded && 'overflow-hidden')}
              style={!isExpanded ? { maxHeight: COLLAPSED_MAX_HEIGHT } : undefined}
            >
              {content}

              {/* 底部渐隐遮罩，提示内容被折叠 */}
              {!isExpanded && isOverflowing && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-zinc-200/95 via-zinc-200/70 to-transparent dark:from-zinc-800/95 dark:via-zinc-800/70" />
              )}
            </div>

            {/* 展开/收起 — 固定在折叠区域外部，始终可见 */}
            {isOverflowing && (
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-medium text-zinc-500 transition-colors duration-150 hover:bg-zinc-300/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100 cursor-pointer select-none"
              >
                <span>{isExpanded ? t('card.collapseText') : t('card.expandText')}</span>
                <ChevronDown
                  size={11}
                  className={cn(
                    'transition-transform duration-200',
                    isExpanded && 'rotate-180'
                  )}
                />
              </button>
            )}
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/bubble:opacity-100 focus-within:opacity-100">
            {onStartEdit && (
              <button
                type="button"
                onClick={onStartEdit}
                disabled={editDisabled}
                className="flex size-5 items-center justify-center rounded-[5px] text-ink-3 hover:bg-hover hover:text-ink cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed"
                title={isZh ? '编辑消息' : 'Edit message'}
                aria-label={isZh ? '编辑消息' : 'Edit message'}
              >
                <Pencil size={11} />
              </button>
            )}
            <button
              type="button"
              onClick={() => copy(content)}
              className="flex size-5 items-center justify-center rounded-[5px] text-ink-3 hover:bg-hover hover:text-ink cursor-pointer select-none"
              title={t('common.copy')}
            >
              {copied ? (
                <Check size={11} className="text-emerald-600" />
              ) : (
                <Copy size={11} />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
