import React from 'react';
import { useWindowDrag } from '@/hooks/useWindowDrag';
import { DynamicIcon } from '@/components/Icons';
import { MacTrafficLights } from '@/components/MacTrafficLights';
import { Pin } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * Mac 风格卡片头部导航栏
 * 左侧：Mac 交通灯三色圆点 + 动作图标 + 标题
 * 右侧：操作工具组 + 钉住 (Pin) 按钮
 * ───────────────────────────────────────────────────────── */

export interface CardHeaderProps {
  icon?: string;
  title: string;
  badge?: React.ReactNode;
  tools?: React.ReactNode;
  isPinned: boolean;
  onPinToggle: () => void;
  onClose: () => void;
  onMinimize?: () => void;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  icon,
  title,
  badge,
  tools,
  isPinned,
  onPinToggle,
  onClose,
  onMinimize,
}) => {
  const { handleMouseDown } = useWindowDrag();

  return (
    <div
      onMouseDown={handleMouseDown}
      className="flex shrink-0 items-center justify-between border-b border-line/60 bg-transparent px-3 py-2 select-none cursor-grab active:cursor-grabbing"
    >
      {/* 左侧：Mac 交通灯三色圆点 + 动作图标 + 标题 */}
      <div data-tauri-drag-region className="flex min-w-0 items-center gap-2.5">
        <MacTrafficLights
          onClose={onClose}
          onMinimize={onMinimize || onClose}
          onMaximize={onPinToggle}
          closeTitle="关闭卡片 (Esc)"
          minimizeTitle="收起"
          maximizeTitle={isPinned ? '取消固定悬浮窗' : '固定悬浮窗 (Pin)'}
          isPinned={isPinned}
        />

        <div className="flex min-w-0 items-center gap-1.5 border-l border-line/70 pl-2.5">
          {icon && (
            <DynamicIcon
              name={icon}
              size={13}
              className="pointer-events-none shrink-0 text-zinc-500 dark:text-zinc-400"
            />
          )}
          <span
            data-tauri-drag-region
            className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100 cursor-grab active:cursor-grabbing"
          >
            {title}
          </span>
          {badge}
        </div>
      </div>

      {/* 右侧：工具按钮组 + 钉住 (Pin) 按钮 */}
      <div data-tauri-drag-region className="flex shrink-0 items-center gap-1">
        {tools}

        <button
          type="button"
          onClick={onPinToggle}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            'flex size-6 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150',
            'hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer',
            isPinned && 'bg-blue-500/15 text-blue-600 dark:bg-blue-500/25 dark:text-blue-400 font-semibold'
          )}
          title={isPinned ? '取消固定悬浮窗' : '固定悬浮窗 (Pin)'}
        >
          <Pin
            size={13}
            className={cn(
              'transition-transform duration-200',
              isPinned ? 'rotate-45 fill-current text-blue-600 dark:text-blue-400' : ''
            )}
          />
        </button>
      </div>
    </div>
  );
};



