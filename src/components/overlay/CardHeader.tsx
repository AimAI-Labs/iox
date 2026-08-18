import React from 'react';
import { DynamicIcon } from '@/components/Icons';
import { useWindowDrag } from '@/hooks/useWindowDrag';
import { Pin, PinOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CardHeaderProps {
  icon: string;
  title: string;
  badge?: React.ReactNode;
  tools?: React.ReactNode;
  isPinned: boolean;
  onPinToggle: () => void;
  onClose: () => void;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  icon,
  title,
  badge,
  tools,
  isPinned,
  onPinToggle,
  onClose,
}) => {
  const { handleMouseDown } = useWindowDrag();

  return (
    <div
      onMouseDown={handleMouseDown}
      className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/70 dark:bg-zinc-950/40 select-none cursor-move shrink-0"
    >
      {/* 左侧：图标、标题与徽标/切换器 */}
      <div data-tauri-drag-region className="flex items-center gap-2 min-w-0">
        <DynamicIcon
          name={icon || 'Sparkles'}
          size={15}
          className="text-blue-600 dark:text-blue-400 pointer-events-none shrink-0"
        />
        <span
          data-tauri-drag-region
          className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate cursor-move"
        >
          {title}
        </span>
        {badge}
      </div>

      {/* 右侧：工具按钮与 Pin/关闭 */}
      <div data-tauri-drag-region className="flex items-center gap-0.5 shrink-0">
        {tools}

        {/* Pin 固定切换 */}
        <button
          type="button"
          onClick={onPinToggle}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors cursor-pointer",
            isPinned
              ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
          )}
          title={isPinned ? '取消固定' : '固定悬浮窗'}
        >
          {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>

        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
          title="关闭 (Esc)"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
