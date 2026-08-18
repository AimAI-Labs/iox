import React from 'react';
import { ActionConfig } from '@/types/config';
import { DynamicIcon } from '@/components/Icons';
import { GripVertical, MoreHorizontal, Check, Copy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWindowDrag } from '@/hooks/useWindowDrag';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';

export interface BubbleBarProps {
  actions: ActionConfig[];
  selectedText?: string;
  isClosing?: boolean;
  onActionClick: (action: ActionConfig) => void;
  onOpenSettings?: () => void;
}

export const BubbleBar: React.FC<BubbleBarProps> = ({
  actions,
  selectedText = '',
  isClosing = false,
  onActionClick,
  onOpenSettings,
}) => {
  const { copied, copy } = useCopyFeedback(1500);
  const { handleMouseDown } = useWindowDrag();
  const enabledActions = actions.filter((a) => a.enabled);

  // 快捷复制当前选中文本
  const handleQuickCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copy(selectedText);
  };

  return (
    <div className="flex items-center justify-center w-full h-full select-none">
      <div
        className={cn(
          "inline-flex items-center h-[30px] px-1.5 py-0.5 gap-0.5",
          "capsule-glass",
          "rounded-lg",
          "border border-zinc-200/80 dark:border-zinc-800/80",
          isClosing ? "animate-capsule-out" : "animate-capsule-in"
        )}
      >
        {/* 1. 左侧拖拽指示手柄 — 唯一可拖拽区域 */}
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "flex items-center justify-center w-4 h-5 rounded",
            "text-zinc-400 dark:text-zinc-500",
            "hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60",
            "cursor-grab active:cursor-grabbing transition-all duration-150"
          )}
          title="按住拖拽移动"
        >
          <GripVertical size={11} strokeWidth={2.2} />
        </div>

        {/* 2. 品牌 AI Logo Badge */}
        <div
          className={cn(
            "relative flex items-center justify-center w-5 h-5 rounded",
            "bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 dark:from-blue-400/20 dark:to-indigo-400/20",
            "border border-blue-500/20 dark:border-blue-400/30",
            "group transition-all duration-200 hover:scale-105"
          )}
          title="IOX AI 划词助手"
        >
          <Sparkles
            size={11}
            className="text-blue-600 dark:text-blue-400 transition-transform duration-200 group-hover:rotate-12 fill-blue-500/20 pointer-events-none"
          />
        </div>

        {/* 3. 动作按钮组 */}
        <div className="flex items-center gap-[2px]">
          {enabledActions.map((action) => {
            const isCopyAction = action.actionType === 'copy';

            if (isCopyAction) {
              return (
                <button
                  key={action.id}
                  onClick={handleQuickCopy}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={cn(
                    "group relative inline-flex items-center gap-1 h-[23px] px-1.5 rounded",
                    "text-[11.5px] font-medium tracking-tight whitespace-nowrap cursor-pointer",
                    "transition-all duration-150 ease-out active:scale-95",
                    copied
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/90"
                  )}
                  title="快捷复制选中文本"
                >
                  <span className="flex items-center justify-center transition-transform duration-150 group-hover:scale-110">
                    {copied ? (
                      <Check size={11} className="text-emerald-500 stroke-[2.5] animate-in zoom-in-75 duration-150" />
                    ) : (
                      <Copy size={11} strokeWidth={2} />
                    )}
                  </span>
                  <span>{copied ? '已复制' : action.name}</span>
                </button>
              );
            }

            return (
              <button
                key={action.id}
                onClick={() => onActionClick(action)}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "group relative inline-flex items-center gap-1 h-[23px] px-1.5 rounded",
                  "text-[11.5px] font-medium tracking-tight whitespace-nowrap cursor-pointer",
                  "text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400",
                  "hover:bg-zinc-100/90 dark:hover:bg-zinc-800/90",
                  "transition-all duration-150 ease-out active:scale-95"
                )}
                title={action.name}
              >
                <span className="flex items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform duration-150 group-hover:scale-110">
                  <DynamicIcon name={action.icon} size={11.5} />
                </span>
                <span>{action.name}</span>
              </button>
            );
          })}
        </div>

        {/* 4. 精致渐变分割线 */}
        <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

        {/* 5. 更多与设置按钮 */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              "group inline-flex items-center justify-center w-5 h-5 rounded",
              "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
              "hover:bg-zinc-100/90 dark:hover:bg-zinc-800/90",
              "active:scale-95 transition-all duration-150 cursor-pointer"
            )}
            title="更多与设置"
          >
            <MoreHorizontal size={12} className="transition-transform duration-200 group-hover:rotate-45" />
          </button>
        )}
      </div>
    </div>
  );
};
