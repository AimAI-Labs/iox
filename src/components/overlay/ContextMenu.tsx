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
  Sun,
  Moon,
  Monitor,
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
  currentTheme?: 'system' | 'dark' | 'light';
  onThemeChange?: (theme: 'system' | 'dark' | 'light') => void;
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
  currentTheme = 'system',
  onThemeChange,
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
  const menuWidth = 220;
  const menuHeight = 320;
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
        'fixed z-100 flex flex-col w-56 rounded-2xl p-1.5 select-none',
        'bg-white/85 dark:bg-[#18181b]/90 text-zinc-800 dark:text-zinc-200',
        'border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-3xl',
        'ring-1 ring-black/5 dark:ring-white/5',
        'animate-in fade-in zoom-in-95 duration-120'
      )}
    >
      {/* 1. 复制文本组 */}
      {hasSelectionText && (
        <button
          type="button"
          onClick={() => handleItemClick(onCopySelection)}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium hover:bg-zinc-100/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Scissors size={13.5} className="text-zinc-500 dark:text-zinc-400" />
            <span>复制选中文本</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-white/5">
            Ctrl+C
          </span>
        </button>
      )}

      {hasAnswerText && (
        <>
          <button
            type="button"
            onClick={() => handleItemClick(onCopyCurrentAnswer)}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium hover:bg-zinc-100/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Copy size={13.5} className="text-zinc-500 dark:text-zinc-400" />
              <span>复制当前回答</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleItemClick(onCopyAllMarkdown)}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium hover:bg-zinc-100/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FileText size={13.5} className="text-zinc-500 dark:text-zinc-400" />
              <span>导出对话 (Markdown)</span>
            </div>
          </button>
        </>
      )}

      {(hasSelectionText || hasAnswerText) && (
        <div className="my-1 h-px bg-zinc-200/70 dark:bg-white/10" />
      )}

      {/* 2. 生成与会话控制组 */}
      <button
        type="button"
        onClick={() => handleItemClick(onRegenerateCurrent)}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium hover:bg-zinc-100/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <RotateCcw size={13.5} className="text-zinc-500 dark:text-zinc-400" />
          <span>重新生成当前回答</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-white/5">
          Ctrl+R
        </span>
      </button>

      <button
        type="button"
        onClick={() => handleItemClick(onNewChat)}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium hover:bg-zinc-100/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={13.5} className="text-blue-500" />
          <span>开启新对话</span>
        </div>
      </button>

      <div className="my-1 h-px bg-zinc-200/70 dark:bg-white/10" />

      {/* 3. 窗口视窗与固定组 */}
      <button
        type="button"
        onClick={() => handleItemClick(onToggleMaximize)}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium hover:bg-zinc-100/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isMaximized ? (
            <Minimize2 size={13.5} className="text-emerald-500" />
          ) : (
            <Maximize2 size={13.5} className="text-emerald-500" />
          )}
          <span>{isMaximized ? '还原窗口' : '全屏最大化'}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => handleItemClick(onTogglePin)}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium hover:bg-zinc-100/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Pin size={13.5} className={cn('text-blue-500', isPinned && 'fill-current')} />
          <span>{isPinned ? '取消固定悬浮窗' : '固定悬浮窗 (Pin)'}</span>
        </div>
      </button>

      {onResetSize && (
        <button
          type="button"
          onClick={() => handleItemClick(onResetSize)}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium hover:bg-zinc-100/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ResetIcon size={13.5} className="text-zinc-500 dark:text-zinc-400" />
            <span>恢复默认尺寸 (600×900)</span>
          </div>
        </button>
      )}

      <div className="my-1 h-px bg-zinc-200/70 dark:bg-white/10" />

      {/* 4. 外观主题快速切换 */}
      {onThemeChange && (
        <div className="flex items-center justify-between px-2.5 py-1.5 text-[12px] font-medium text-zinc-600 dark:text-zinc-400">
          <span>外观主题</span>
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/5 p-0.5 rounded-lg border border-zinc-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                onThemeChange('system');
                onClose();
              }}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer',
                currentTheme === 'system'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              )}
              title="跟随系统主题"
            >
              <Monitor size={11} />
              <span>系统</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onThemeChange('light');
                onClose();
              }}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer',
                currentTheme === 'light'
                  ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              )}
              title="浅色模式"
            >
              <Sun size={11} />
              <span>浅色</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onThemeChange('dark');
                onClose();
              }}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer',
                currentTheme === 'dark'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              )}
              title="深色模式"
            >
              <Moon size={11} />
              <span>深色</span>
            </button>
          </div>
        </div>
      )}

      <div className="my-1 h-px bg-zinc-200/70 dark:bg-white/10" />

      {/* 5. 设置组 */}
      <button
        type="button"
        onClick={() => handleItemClick(onOpenSettings)}
        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium hover:bg-zinc-100/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Settings size={13.5} className="text-zinc-500 dark:text-zinc-400" />
          <span>API 卡片设置...</span>
        </div>
      </button>
    </div>
  );
};
