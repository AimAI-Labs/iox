import React, { useState } from 'react';
import { ActionConfig } from '../types/config';
import { DynamicIcon } from './Icons';
import { GripVertical, MoreHorizontal, Check, Copy, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface BubbleBarProps {
  actions: ActionConfig[];
  selectedText?: string;
  onActionClick: (action: ActionConfig) => void;
  onOpenSettings?: () => void;
}

export const BubbleBar: React.FC<BubbleBarProps> = ({
  actions,
  selectedText = '',
  onActionClick,
  onOpenSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const enabledActions = actions.filter((a) => a.enabled);

  // 快捷复制当前选中文本
  const handleQuickCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center justify-start w-full h-full p-1 select-none">
      <div
        className={cn(
          "inline-flex items-center h-10 px-2.5 py-1 gap-1",
          "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md",
          "border border-zinc-200/80 dark:border-zinc-800/80",
          "rounded-full shadow-lg shadow-black/10 dark:shadow-black/40",
          "animate-in fade-in zoom-in-95 duration-150"
        )}
      >
        {/* 1. 左侧拖拽指示手柄 (Lucide GripVertical) */}
        <div
          data-tauri-drag-region
          className="flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-grab active:cursor-grabbing px-0.5 transition-colors"
          title="按住拖拽移动"
        >
          <GripVertical size={14} />
        </div>

        {/* 2. 品牌 AI Logo (Lucide Sparkles) */}
        <div className="flex items-center justify-center px-1 pr-1.5" title="IOX AI">
          <Sparkles size={16} className="text-blue-600 dark:text-blue-400 fill-blue-500/20 transition-transform duration-200 hover:scale-110" />
        </div>

        {/* 3. 动作按钮组 (Lucide 图标 + 标签) */}
        <div className="flex items-center gap-1">
          {enabledActions.map((action) => {
            // 如果是复制动作，绑定快速复制交互
            const isCopyAction = action.id === 'act_copy' || action.name === '复制';

            if (isCopyAction) {
              return (
                <button
                  key={action.id}
                  onClick={handleQuickCopy}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                    "text-xs font-medium text-zinc-700 dark:text-zinc-200",
                    "hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-600 dark:hover:text-blue-400",
                    "active:scale-95 transition-all duration-150 cursor-pointer whitespace-nowrap"
                  )}
                  title="复制选中文本"
                >
                  {copied ? (
                    <Check size={14} className="text-emerald-500 animate-in zoom-in-50 duration-150" />
                  ) : (
                    <Copy size={14} />
                  )}
                  <span>{copied ? '已复制' : action.name}</span>
                </button>
              );
            }

            return (
              <button
                key={action.id}
                onClick={() => onActionClick(action)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                  "text-xs font-medium text-zinc-700 dark:text-zinc-200",
                  "hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-600 dark:hover:text-blue-400",
                  "active:scale-95 transition-all duration-150 cursor-pointer whitespace-nowrap"
                )}
                title={action.name}
              >
                <DynamicIcon name={action.icon} size={14} />
                <span>{action.name}</span>
              </button>
            );
          })}
        </div>

        {/* 4. 分割线 */}
        <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

        {/* 5. 更多 / 设置按钮 (Lucide MoreHorizontal) */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-full",
              "text-zinc-500 dark:text-zinc-400",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-100",
              "active:scale-95 transition-all duration-150 cursor-pointer"
            )}
            title="更多与设置"
          >
            <MoreHorizontal size={15} />
          </button>
        )}
      </div>
    </div>
  );
};
