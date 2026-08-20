import React, { useEffect, useRef } from 'react';
import {
  Copy,
  FileText,
  RotateCcw,
  Sparkles,
  Pin,
  Maximize2,
  Minimize2,
  RotateCcw as ResetIcon,
  Settings,
  Scissors,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  hasSelectionText?: boolean;
  hasAnswerText?: boolean;
  isPinned?: boolean;
  isMaximized?: boolean;
  onClose: () => void;
  onCopySelection?: () => void;
  onCopyCurrentAnswer?: () => void;
  onCopyAllMarkdown?: () => void;
  onRegenerateCurrent?: () => void;
  onNewChat?: () => void;
  onTogglePin?: () => void;
  onToggleMaximize?: () => void;
  onResetSize?: () => void;
  onOpenSettings?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  visible,
  hasSelectionText = false,
  hasAnswerText = false,
  isPinned = false,
  isMaximized = false,
  onClose,
  onCopySelection,
  onCopyCurrentAnswer,
  onCopyAllMarkdown,
  onRegenerateCurrent,
  onNewChat,
  onTogglePin,
  onToggleMaximize,
  onResetSize,
  onOpenSettings,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部收起与按键监听
  useEffect(() => {
    if (!visible) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  // 视口边界防溢出计算
  const menuWidth = 210;
  const menuHeight = 310;
  const screenW = window.innerWidth || 600;
  const screenH = window.innerHeight || 900;

  const posX = x + menuWidth > screenW ? Math.max(8, screenW - menuWidth - 8) : x;
  const posY = y + menuHeight > screenH ? Math.max(8, screenH - menuHeight - 8) : y;

  const handleItemClick = (action?: () => void) => {
    onClose();
    action?.();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        'fixed z-100 flex flex-col w-52 rounded-xl p-1.5 select-none',
        'bg-white/95 dark:bg-[#1e1f23]/95 text-zinc-800 dark:text-zinc-200',
        'border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xl backdrop-blur-2xl',
        'animate-in fade-in zoom-in-95 duration-100'
      )}
    >
      {/* 1. 复制文本组 */}
      {hasSelectionText && (
        <button
          type="button"
          onClick={() => handleItemClick(onCopySelection)}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Scissors size={13} className="text-zinc-500" />
            <span>复制选中文本</span>
          </div>
          <span className="text-[10.5px] text-zinc-400">Ctrl+C</span>
        </button>
      )}

      {hasAnswerText && (
        <>
          <button
            type="button"
            onClick={() => handleItemClick(onCopyCurrentAnswer)}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Copy size={13} className="text-zinc-500" />
              <span>复制当前回答</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleItemClick(onCopyAllMarkdown)}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-zinc-500" />
              <span>复制全部对话 (Markdown)</span>
            </div>
          </button>
        </>
      )}

      <div className="my-1 h-px bg-zinc-200/80 dark:bg-zinc-700/70" />

      {/* 2. 生成与会话控制组 */}
      <button
        type="button"
        onClick={() => handleItemClick(onRegenerateCurrent)}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <RotateCcw size={13} className="text-zinc-500" />
          <span>重新生成当前回答</span>
        </div>
        <span className="text-[10.5px] text-zinc-400">Ctrl+R</span>
      </button>

      <button
        type="button"
        onClick={() => handleItemClick(onNewChat)}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-indigo-500" />
          <span>开启新会话 / 清空追问</span>
        </div>
      </button>

      <div className="my-1 h-px bg-zinc-200/80 dark:bg-zinc-700/70" />

      {/* 3. 窗口视窗与固定组 */}
      <button
        type="button"
        onClick={() => handleItemClick(onToggleMaximize)}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isMaximized ? (
            <Minimize2 size={13} className="text-emerald-500" />
          ) : (
            <Maximize2 size={13} className="text-emerald-500" />
          )}
          <span>{isMaximized ? '还原窗口' : '全屏最大化'}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => handleItemClick(onTogglePin)}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Pin size={13} className={cn('text-blue-500', isPinned && 'fill-current')} />
          <span>{isPinned ? '取消固定悬浮窗' : '固定悬浮窗 (Pin)'}</span>
        </div>
      </button>

      {onResetSize && (
        <button
          type="button"
          onClick={() => handleItemClick(onResetSize)}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ResetIcon size={13} className="text-zinc-500" />
            <span>恢复默认尺寸 (600×900)</span>
          </div>
        </button>
      )}

      <div className="my-1 h-px bg-zinc-200/80 dark:bg-zinc-700/70" />

      {/* 4. 设置组 */}
      <button
        type="button"
        onClick={() => handleItemClick(onOpenSettings)}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Settings size={13} className="text-zinc-500" />
          <span>API 卡片设置...</span>
        </div>
      </button>
    </div>
  );
};
