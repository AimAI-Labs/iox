import React from 'react';
import { useWindowDrag } from '@/hooks/useWindowDrag';
import { DynamicIcon } from '@/components/Icons';
import { MacTrafficLights } from '@/components/MacTrafficLights';
import { TabBar, TabItem } from '@/components/overlay/TabBar';
import { Pin, RotateCcw, Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * Mac 风格卡片头部导航栏
 * 左侧：Mac 交通灯三色圆点
 * 中间：自适应多标签栏 (TabBar) 或 动作图标+标题
 * 右侧：操作工具组 + 会话历史 + 重置尺寸 + 钉住 (Pin) 按钮
 * ───────────────────────────────────────────────────────── */

export interface CardHeaderProps {
  icon?: string;
  title: string;
  badge?: React.ReactNode;
  tools?: React.ReactNode;
  isPinned: boolean;
  isMaximized?: boolean;
  sessionCount?: number;
  tabs?: TabItem[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
  onCloseTab?: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseLeftTabs?: (tabId: string) => void;
  onCloseRightTabs?: (tabId: string) => void;
  onNewTab?: () => void;
  onNewChat?: () => void;
  onToggleSessions?: () => void;
  onPinToggle: () => void;
  onToggleMaximize?: () => void;
  onClose: () => void;
  onMinimize?: () => void;
  onResetSize?: () => void;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  icon,
  title,
  badge,
  tools,
  isPinned,
  isMaximized = false,
  sessionCount,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseLeftTabs,
  onCloseRightTabs,
  onNewTab,
  onNewChat,
  onToggleSessions,
  onPinToggle,
  onToggleMaximize,
  onClose,
  onMinimize,
  onResetSize,
}) => {
  const { handleMouseDown } = useWindowDrag();

  return (
    <div
      onMouseDown={handleMouseDown}
      className="flex shrink-0 items-center justify-between border-b border-line/60 bg-transparent px-3 py-1.5 select-none cursor-grab active:cursor-grabbing gap-2"
    >
      {/* 左侧：Mac 交通灯三色圆点 */}
      <div data-tauri-drag-region className="flex shrink-0 items-center">
        <MacTrafficLights
          onClose={onClose}
          onMinimize={onMinimize}
          onMaximize={onToggleMaximize}
          isMaximized={isMaximized}
          closeTitle="关闭卡片 (Esc)"
          minimizeTitle="收起并保留会话"
          maximizeTitle={isMaximized ? '还原窗口尺寸' : '全屏最大化'}
        />
      </div>

      {/* 中间：多标签栏 (TabBar) 或 默认动作标题 */}
      {tabs && tabs.length > 0 && onSelectTab && onCloseTab && onNewTab ? (
        <div className="flex-1 min-w-0 flex items-center overflow-hidden">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId || ''}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
            onCloseOtherTabs={onCloseOtherTabs}
            onCloseLeftTabs={onCloseLeftTabs}
            onCloseRightTabs={onCloseRightTabs}
            onNewTab={onNewTab}
          />
        </div>
      ) : (
        <div data-tauri-drag-region className="flex flex-1 min-w-0 items-center gap-1.5 pl-1">
          {icon && (
            <DynamicIcon
              name={icon}
              size={13}
              className="pointer-events-none shrink-0 text-zinc-500 dark:text-zinc-400"
            />
          )}
          <span
            data-tauri-drag-region
            className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100 cursor-grab active:cursor-grabbing max-w-36"
          >
            {title}
          </span>
          {badge}

          {/* [+] 开启新会话按钮 */}
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex size-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer ml-0.5"
              title="开启新对话 (+)"
            >
              <Plus size={13} strokeWidth={2.4} />
            </button>
          )}
        </div>
      )}

      {/* 右侧：工具按钮组 + 会话历史 + 重置尺寸 + 钉住 (Pin) 按钮 */}
      <div data-tauri-drag-region className="flex shrink-0 items-center gap-1">
        {tools}

        {/* 会话历史列表按钮 */}
        {onToggleSessions && (
          <button
            type="button"
            onClick={onToggleSessions}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex size-6 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer relative"
            title="查看历史对话记录"
          >
            <MessageSquare size={13} strokeWidth={1.8} />
            {sessionCount !== undefined && sessionCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-2 rounded-full bg-blue-500" />
            )}
          </button>
        )}

        {onResetSize && (
          <button
            type="button"
            onClick={onResetSize}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex size-6 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
            title="恢复默认卡片尺寸 (600 × 900)"
          >
            <RotateCcw size={12} />
          </button>
        )}

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
