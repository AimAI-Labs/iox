import React from 'react';
import { useWindowDrag } from '@/hooks/useWindowDrag';
import { DynamicIcon } from '@/components/Icons';
import { MacTrafficLights } from '@/components/MacTrafficLights';
import { WindowsCaptionControls } from '@/components/WindowsCaptionControls';
import { TabBar, TabItem } from '@/components/overlay/TabBar';
import { useTranslation } from '@/hooks/useTranslation';
import { useUiTheme } from '@/themes/ThemeProvider';
import { Pin, Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * Mac 风格卡片头部导航栏
 * 左侧：Mac 交通灯三色圆点
 * 中间：自适应多标签栏 (TabBar) 或 动作图标+标题
 * 右侧：操作工具组 + 会话历史 + 钉住 (Pin) 按钮
 * ───────────────────────────────────────────────────────── */

export interface CardHeaderProps {
  icon?: string;
  title: string;
  badge?: React.ReactNode;
  tools?: React.ReactNode;
  isPinned: boolean;
  isMaximized?: boolean;
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
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  icon,
  title,
  badge,
  tools,
  isPinned,
  isMaximized = false,
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
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const { handleMouseDown } = useWindowDrag();
  const uiTheme = useUiTheme();
  const isNativeStyle = uiTheme.titleBarControls === 'windows';

  return (
    <div
      onMouseDown={handleMouseDown}
      className="flex shrink-0 items-center justify-between border-b border-line/60 bg-transparent px-3 py-1.5 select-none cursor-grab active:cursor-grabbing gap-2"
    >
      {/* 左侧：经典样式下的 Mac 交通灯三色圆点；原生样式改用右侧系统风格按钮 */}
      {!isNativeStyle && (
        <div data-tauri-drag-region className="flex shrink-0 items-center">
          <MacTrafficLights
            onClose={onClose}
            onMinimize={onMinimize}
            onMaximize={onToggleMaximize}
            isMaximized={isMaximized}
            closeTitle={t('card.closeCard')}
            minimizeTitle={resolvedLanguage === 'zh' ? '收起并保留会话' : 'Minimize and Keep Session'}
            maximizeTitle={isMaximized ? (resolvedLanguage === 'zh' ? '还原窗口尺寸' : 'Restore Window Size') : (resolvedLanguage === 'zh' ? '全屏最大化' : 'Maximize Window')}
          />
        </div>
      )}

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
            className="max-w-36 truncate text-[13px] font-medium leading-[1.4] text-zinc-900 dark:text-zinc-100 cursor-grab active:cursor-grabbing"
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
              title={t('card.newChat')}
            >
              <Plus size={13} strokeWidth={2.4} />
            </button>
          )}
        </div>
      )}

      {/* 右侧：工具按钮组 + 会话历史 + 钉住 (Pin) 按钮 */}
      <div data-tauri-drag-region className="flex shrink-0 items-center gap-1">
        {tools}

        {/* 会话历史列表按钮 */}
        {onToggleSessions && (
          <button
            type="button"
            onClick={onToggleSessions}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex size-6 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
            title={t('card.historySessions')}
          >
            <MessageSquare size={13} strokeWidth={1.8} />
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
          title={isPinned ? t('common.unpin') : t('common.pin')}
        >
          <Pin
            size={13}
            className={cn(
              'transition-transform duration-200',
              isPinned ? 'rotate-45 fill-current text-blue-600 dark:text-blue-400' : ''
            )}
          />
        </button>

        {/* 原生样式：系统风格的最小化 / 最大化 / 关闭按钮 */}
        {isNativeStyle && (
          <WindowsCaptionControls
            onClose={onClose}
            onMinimize={onMinimize}
            onMaximize={onToggleMaximize}
            isMaximized={isMaximized}
            closeTitle={t('card.closeCard')}
            minimizeTitle={resolvedLanguage === 'zh' ? '收起并保留会话' : 'Minimize and Keep Session'}
            maximizeTitle={isMaximized ? (resolvedLanguage === 'zh' ? '还原窗口尺寸' : 'Restore Window Size') : (resolvedLanguage === 'zh' ? '全屏最大化' : 'Maximize Window')}
            className="ml-1 -mr-3"
          />
        )}
      </div>
    </div>
  );
};
