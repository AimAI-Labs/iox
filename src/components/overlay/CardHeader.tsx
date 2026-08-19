import React from 'react';
import { DynamicIcon } from '@/components/Icons';
import { useWindowDrag } from '@/hooks/useWindowDrag';
import { MacTrafficLights } from '@/components/MacTrafficLights';

export interface CardHeaderProps {
  icon: string;
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
      className="flex items-center justify-between px-3.5 py-2.5 border-b border-black/10 dark:border-white/10 bg-transparent select-none cursor-grab active:cursor-grabbing shrink-0"
    >
      {/* 左侧：Mac 交通灯三色圆点 + 动作图标 + 标题 + 模型徽标 */}
      <div data-tauri-drag-region className="flex items-center gap-2.5 min-w-0">
        <MacTrafficLights
          onClose={onClose}
          onMinimize={onMinimize || onClose}
          onMaximize={onPinToggle}
          closeTitle="关闭卡片 (Esc)"
          minimizeTitle="收起"
          maximizeTitle={isPinned ? "取消固定悬浮窗" : "固定悬浮窗 (Pin)"}
          isPinned={isPinned}
        />

        <div className="flex items-center gap-1.5 min-w-0 pl-1 border-l border-zinc-200/60 dark:border-zinc-800/80">
          <DynamicIcon
            name={icon || 'Sparkles'}
            size={14}
            className="text-blue-600 dark:text-blue-400 pointer-events-none shrink-0"
          />
          <span
            data-tauri-drag-region
            className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate cursor-grab active:cursor-grabbing"
          >
            {title}
          </span>
          {badge}
        </div>
      </div>

      {/* 右侧：工具按钮组 */}
      <div data-tauri-drag-region className="flex items-center gap-1 shrink-0">
        {tools}
      </div>
    </div>
  );
};

