import React, { useRef, useEffect, useState } from 'react';
import { Plus, X, Loader2, PanelLeftClose, PanelRightClose, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  title: string;
  actionId: string;
  providerId?: string;
  model: string;
  selectedText: string;
  streamText: string;
  isLoading: boolean;
  error?: string | null;
  turnSnapshots?: Record<string, { model: string; duration?: number }>;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseLeftTabs?: (tabId: string) => void;
  onCloseRightTabs?: (tabId: string) => void;
  onNewTab: () => void;
  className?: string;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseLeftTabs,
  onCloseRightTabs,
  onNewTab,
  className,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 右键上下文菜单状态
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    tabId: string;
    tabIndex: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    tabId: '',
    tabIndex: -1,
  });

  // 支持鼠标滚轮在标签栏区域横向平滑滚动
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollRef.current && e.deltaY !== 0) {
      e.stopPropagation();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // 当切换标签或增加标签时，自动将当前激活的标签滚动至视口可见区域
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId, tabs.length]);

  // 点击外部与按 Escape 关闭右键菜单
  useEffect(() => {
    if (!contextMenu.visible) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.visible]);

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      tabId,
      tabIndex: index,
    });
  };

  const closeMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // 边界安全计算
  const menuWidth = 145;
  const menuHeight = 140;
  const posX = Math.min(contextMenu.x, Math.max(10, window.innerWidth - menuWidth - 10));
  const posY = Math.min(contextMenu.y + 4, Math.max(10, window.innerHeight - menuHeight - 10));

  return (
    <div
      className={cn(
        'flex items-center gap-1 min-w-0 max-w-full py-0.5 select-none overflow-hidden',
        className
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 横向滚动标签容器 */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const displayTitle = tab.title || t('card.newChat');

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => onSelectTab(tab.id)}
              onContextMenu={(e) => handleTabContextMenu(e, tab.id, index)}
              className={cn(
                'group relative flex h-6.5 items-center gap-1.5 rounded-lg px-2 text-[12px] transition-all duration-120 cursor-pointer max-w-36 shrink-0',
                isActive
                  ? 'bg-white dark:bg-[#27272a] text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/80 dark:border-zinc-700/80 font-medium'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 border border-transparent'
              )}
              title={tab.title || t('card.tabNew')}
            >
              {/* 生成状态指示 */}
              {tab.isLoading ? (
                <Loader2 size={11} className="shrink-0 animate-spin text-blue-500" />
              ) : (
                <span
                  className={cn(
                    'size-1.5 rounded-full shrink-0 transition-colors',
                    isActive ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600 group-hover:bg-zinc-400'
                  )}
                />
              )}

              {/* 标签标题 */}
              <span className="truncate max-w-24 text-[11.5px] leading-none">
                {displayTitle}
              </span>

              {/* 关闭按钮 (×) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className={cn(
                  'flex size-3.5 items-center justify-center rounded-sm text-zinc-400 transition-colors cursor-pointer ml-0.5',
                  'hover:bg-zinc-200 hover:text-red-500 dark:hover:bg-zinc-700 dark:hover:text-red-400',
                  isActive ? 'opacity-80 hover:opacity-100' : 'opacity-0 group-hover:opacity-80'
                )}
                title={t('common.close')}
              >
                <X size={10} strokeWidth={2.2} />
              </button>
            </div>
          );
        })}
      </div>

      {/* [+] 新增会话标签按钮 (固定在标签栏右侧) */}
      <button
        type="button"
        onClick={onNewTab}
        className="flex size-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ml-0.5"
        title={t('card.tabNew')}
      >
        <Plus size={13} strokeWidth={2.4} />
      </button>

      {/* 标签右键上下文菜单 */}
      {contextMenu.visible && (
        <div
          ref={menuRef}
          style={{ left: `${posX}px`, top: `${posY}px` }}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            'fixed z-100 flex flex-col w-36 rounded-xl p-1 select-none',
            'bg-white/95 dark:bg-[#1f2024]/95 text-zinc-800 dark:text-zinc-200',
            'border border-black/10 dark:border-white/10 shadow-xl backdrop-blur-2xl',
            'animate-in fade-in zoom-in-95 duration-100'
          )}
        >
          {/* 1. 关闭当前 */}
          <button
            type="button"
            onClick={() => {
              closeMenu();
              onCloseTab(contextMenu.tabId);
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11.5px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer text-left"
          >
            <Trash2 size={12} className="text-zinc-400 shrink-0" />
            <span>{t('common.close')}</span>
          </button>

          {/* 2. 关闭其他 */}
          <button
            type="button"
            disabled={tabs.length <= 1}
            onClick={() => {
              closeMenu();
              onCloseOtherTabs?.(contextMenu.tabId);
            }}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors text-left',
              tabs.length <= 1
                ? 'opacity-40 cursor-not-allowed text-zinc-400'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer'
            )}
          >
            <Sparkles size={12} className="text-zinc-400 shrink-0" />
            <span>{t('card.tabCloseOthers')}</span>
          </button>

          <div className="my-0.5 h-px bg-zinc-200/60 dark:bg-white/5" />

          {/* 3. 关闭左侧 */}
          <button
            type="button"
            disabled={contextMenu.tabIndex <= 0}
            onClick={() => {
              closeMenu();
              onCloseLeftTabs?.(contextMenu.tabId);
            }}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors text-left',
              contextMenu.tabIndex <= 0
                ? 'opacity-40 cursor-not-allowed text-zinc-400'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer'
            )}
          >
            <PanelLeftClose size={12} className="text-zinc-400 shrink-0" />
            <span>{resolvedLanguage === 'zh' ? '关闭左侧标签' : 'Close to Left'}</span>
          </button>

          {/* 4. 关闭右侧 */}
          <button
            type="button"
            disabled={contextMenu.tabIndex >= tabs.length - 1}
            onClick={() => {
              closeMenu();
              onCloseRightTabs?.(contextMenu.tabId);
            }}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors text-left',
              contextMenu.tabIndex >= tabs.length - 1
                ? 'opacity-40 cursor-not-allowed text-zinc-400'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer'
            )}
          >
            <PanelRightClose size={12} className="text-zinc-400 shrink-0" />
            <span>{t('card.tabCloseRight')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
