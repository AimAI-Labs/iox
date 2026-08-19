import React, { useState } from 'react';
import { ActionConfig } from '@/types/config';
import { DynamicIcon } from '@/components/Icons';
import { IOXLogo } from '@/components/common';
import { GripVertical, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWindowDrag } from '@/hooks/useWindowDrag';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';

export interface BubbleBarProps {
  actions: ActionConfig[];
  selectedText?: string;
  isClosing?: boolean;
  onActionClick: (action: ActionConfig) => void;
  onOpenSettings?: () => void;
  onReorderActions?: (newActions: ActionConfig[]) => void;
  isPreview?: boolean;
}

export const BubbleBar: React.FC<BubbleBarProps> = ({
  actions,
  selectedText = '',
  isClosing = false,
  onActionClick,
  onOpenSettings,
  onReorderActions,
  isPreview = false,
}) => {
  const { copied, copy } = useCopyFeedback(1500);
  const { handleMouseDown } = useWindowDrag();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const enabledActions = actions.filter((a) => a.enabled);
  const isDraggable = Boolean(onReorderActions);

  // 快捷复制当前选中文本
  const handleQuickCopy = async (action: ActionConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    if (copied) return;
    const textToCopy = selectedText || (isPreview ? '选中文本示例' : '');
    if (!textToCopy && !isPreview) return;

    const success = await copy(textToCopy);
    if (success && !isPreview) {
      // 真实划词场景下展示 450ms 成功动效后，通知父组件平滑退场
      setTimeout(() => {
        onActionClick(action);
      }, 450);
    }
  };

  // 拖拽完成排序处理
  const handleDropAction = (targetActionId: string) => {
    if (!draggedId || draggedId === targetActionId || !onReorderActions) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const srcIndex = actions.findIndex((a) => a.id === draggedId);
    const dstIndex = actions.findIndex((a) => a.id === targetActionId);

    if (srcIndex !== -1 && dstIndex !== -1) {
      const newActions = [...actions];
      const [moved] = newActions.splice(srcIndex, 1);
      newActions.splice(dstIndex, 0, moved);
      onReorderActions(newActions);
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div className="flex items-center justify-center w-full h-full select-none">
      <div
        className={cn(
          "inline-flex items-center h-[30px] px-1.5 py-0.5 gap-0.5",
          "capsule-glass",
          "rounded-lg",
          "border border-zinc-200/80 dark:border-zinc-800/80",
          !isPreview && (isClosing ? "animate-capsule-out" : "animate-capsule-in")
        )}
      >
        {/* 1. 左侧拖拽指示手柄 */}
        <div
          onMouseDown={!isPreview ? handleMouseDown : undefined}
          className={cn(
            "flex items-center justify-center w-4 h-5 rounded",
            "text-zinc-400 dark:text-zinc-500",
            !isPreview && "hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 cursor-grab active:cursor-grabbing",
            isPreview && "cursor-default opacity-80",
            "transition-all duration-150"
          )}
          title={isPreview ? "气泡拖拽手柄（划词时可按此拖拽）" : "按住拖拽移动"}
        >
          <GripVertical size={11} strokeWidth={2.2} />
        </div>

        {/* 2. 动作按钮组 (支持拖拽位置排序) */}
        <div className="flex items-center gap-[2px]">
          {enabledActions.map((action) => {
            const isCopyAction = action.actionType === 'copy';
            const isActionDragging = draggedId === action.id;
            const isActionDragOver = dragOverId === action.id && draggedId !== action.id;

            const dragHandlers = isDraggable
              ? {
                  draggable: true,
                  onDragStart: (e: React.DragEvent) => {
                    e.stopPropagation();
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', action.id);
                    setDraggedId(action.id);
                  },
                  onDragOver: (e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverId !== action.id) {
                      setDragOverId(action.id);
                    }
                  },
                  onDragEnd: () => {
                    setDraggedId(null);
                    setDragOverId(null);
                  },
                  onDrop: (e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropAction(action.id);
                  },
                }
              : {};

            if (isCopyAction) {
              return (
                <button
                  key={action.id}
                  onClick={(e) => handleQuickCopy(action, e)}
                  onMouseDown={(e) => e.stopPropagation()}
                  {...dragHandlers}
                  className={cn(
                    "group relative inline-flex items-center gap-1 h-[23px] px-1.5 rounded",
                    "text-[11.5px] font-medium tracking-tight whitespace-nowrap",
                    isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                    "transition-all duration-150 ease-out active:scale-95",
                    isActionDragging && "opacity-25 scale-90 border border-dashed border-blue-500",
                    isActionDragOver && "bg-blue-500/20 ring-1 ring-blue-500/50 scale-105",
                    copied
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/30"
                      : "text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/90"
                  )}
                  title={isDraggable ? `按住拖拽调整「${action.name}」排列顺序` : (copied ? "已复制到剪贴板" : action.name)}
                >
                  <span className="w-3.5 h-3.5 flex items-center justify-center pointer-events-none shrink-0">
                    {copied ? (
                      <Check size={11.5} className="text-emerald-500 dark:text-emerald-400 stroke-[2.5] animate-in zoom-in-75 duration-150" />
                    ) : (
                      <Copy size={11.5} strokeWidth={2} className="text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform duration-150 group-hover:scale-110" />
                    )}
                  </span>
                  <span className="pointer-events-none">{action.name}</span>
                </button>
              );
            }

            return (
              <button
                key={action.id}
                onClick={() => onActionClick(action)}
                onMouseDown={(e) => e.stopPropagation()}
                {...dragHandlers}
                className={cn(
                  "group relative inline-flex items-center gap-1 h-[23px] px-1.5 rounded",
                  "text-[11.5px] font-medium tracking-tight whitespace-nowrap",
                  isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                  "text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400",
                  "hover:bg-zinc-100/90 dark:hover:bg-zinc-800/90",
                  "transition-all duration-150 ease-out active:scale-95",
                  isActionDragging && "opacity-25 scale-90 border border-dashed border-blue-500",
                  isActionDragOver && "bg-blue-500/20 ring-1 ring-blue-500/50 scale-105"
                )}
                title={isDraggable ? `按住拖拽调整「${action.name}」排列顺序` : action.name}
              >
                <span className="w-3.5 h-3.5 flex items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform duration-150 group-hover:scale-110 pointer-events-none shrink-0">
                  <DynamicIcon name={action.icon} size={11.5} />
                </span>
                <span className="pointer-events-none">{action.name}</span>
              </button>
            );
          })}
        </div>

        {/* 3. 精致渐变分割线 */}
        {(onOpenSettings || isPreview) && (
          <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />
        )}

        {/* 4. 品牌 Logo / 设置入口 */}
        {(onOpenSettings || isPreview) && (
          <button
            type="button"
            onClick={!isPreview ? onOpenSettings : undefined}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              "relative flex items-center justify-center w-6 h-6 rounded-md",
              "bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 dark:from-blue-400/15 dark:to-indigo-400/15",
              "border border-blue-500/20 dark:border-blue-400/25",
              "group transition-all duration-200 hover:scale-105 active:scale-95 shrink-0",
              !isPreview ? "cursor-pointer" : "cursor-default opacity-80"
            )}
            title={!isPreview ? "更多与设置" : "IOX AI 划词助手"}
          >
            <IOXLogo
              size={22}
              className="transition-transform duration-200 group-hover:scale-110"
            />
          </button>
        )}
      </div>
    </div>
  );
};
