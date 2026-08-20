import React from 'react';
import { Copy, Check, RotateCcw, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * BUI 响应工具栏 (beautifului.dev StreamingText action row)
 * 左侧 mono 等宽元信息，右侧纯图标操作组
 * ───────────────────────────────────────────────────────── */

export interface ResponseToolbarProps {
  text: string;
  durationSeconds?: number;
  hasThinking?: boolean;
  isThinkingOpen?: boolean;
  onToggleThinking?: () => void;
  onCopy: () => void;
  isCopied: boolean;
  onRegenerate?: () => void;
  className?: string;
}

/* BUI 图标按钮基类 */
const iconBtn =
  'flex size-6 items-center justify-center rounded-[6px] text-ink-3 ' +
  'transition-colors duration-100 hover:bg-hover-2 hover:text-ink-2 ' +
  'active:scale-[0.96] cursor-pointer';

export const ResponseToolbar: React.FC<ResponseToolbarProps> = ({
  text,
  durationSeconds,
  hasThinking = false,
  isThinkingOpen = false,
  onToggleThinking,
  onCopy,
  isCopied,
  onRegenerate,
  className,
}) => {
  if (!text) return null;

  // 字符数计算 (剔除思维链标签)
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const charCount = cleanText.length;

  return (
    <div
      className={cn(
        'mt-1.5 flex items-center gap-1 select-none animate-fade-up',
        className
      )}
    >
      {/* 左侧元信息 — mono tabular-nums */}
      <div className="flex items-center gap-2 font-mono text-[11.5px] text-ink-3 tabular-nums">
        <span>{charCount} 字</span>
        {typeof durationSeconds === 'number' && durationSeconds > 0 && (
          <span>{durationSeconds.toFixed(1)}s</span>
        )}
      </div>

      {/* 右侧操作图标组 */}
      <div className="ml-auto flex items-center gap-0.5">
        {hasThinking && onToggleThinking && (
          <button
            type="button"
            onClick={onToggleThinking}
            className={cn(
              iconBtn,
              isThinkingOpen ? 'bg-hover text-ink' : ''
            )}
            title={isThinkingOpen ? '收起思考过程' : '展开思考过程'}
          >
            <Brain size={14} strokeWidth={1.8} />
          </button>
        )}

        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className={iconBtn}
            title="重新生成"
          >
            <RotateCcw size={14} strokeWidth={1.8} />
          </button>
        )}

        <button
          type="button"
          onClick={onCopy}
          className={cn(iconBtn, isCopied ? 'text-emerald-600' : '')}
          title="复制回答"
        >
          {isCopied ? (
            <Check size={14} strokeWidth={2} />
          ) : (
            <Copy size={14} strokeWidth={1.8} />
          )}
        </button>
      </div>
    </div>
  );
};
