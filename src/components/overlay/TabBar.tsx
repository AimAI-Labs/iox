import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Loader2, PanelLeftClose, PanelRightClose, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  title: string;
  isLoading: boolean;
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
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const [menuMaxHeight, setMenuMaxHeight] = useState<number | undefined>(undefined);
  const [menuResizeTick, setMenuResizeTick] = useState(0);

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

  // 窗口尺寸变化时重新测量菜单
  useEffect(() => {
    if (!contextMenu.visible) return;
    const handleResize = () => setMenuResizeTick((tick) => tick + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [contextMenu.visible]);

  // 按真实尺寸定位，超出可视区域时上移并限制高度
  useLayoutEffect(() => {
    if (!contextMenu.visible) return;
    const element = menuRef.current;
    if (!element) return;

    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const previousMaxHeight = element.style.maxHeight;
    element.style.maxHeight = 'none';
    const naturalHeight = element.offsetHeight;
    const width = element.offsetWidth;
    element.style.maxHeight = previousMaxHeight;

    const availableHeight = Math.max(120, viewportHeight - margin * 2);
    const height = Math.min(naturalHeight, availableHeight);
    const left = Math.round(
      Math.min(
        Math.max(margin, contextMenu.x),
        Math.max(margin, viewportWidth - width - margin)
      )
    );
    const top = Math.round(
      Math.min(
        Math.max(margin, contextMenu.y),
        Math.max(margin, viewportHeight - height - margin)
      )
    );

    const nextMaxHeight = naturalHeight > availableHeight ? availableHeight : undefined;
    setMenuPosition((previous) =>
      previous.left === left && previous.top === top ? previous : { left, top }
    );
    setMenuMaxHeight((previous) => (previous === nextMaxHeight ? previous : nextMaxHeight));
  }, [contextMenu.visible, contextMenu.x, contextMenu.y, menuResizeTick]);

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

              {/* 标签标题（保留上下行高，避免中文/英文上缘被裁切） */}
              <span className="max-w-24 truncate text-[11.5px] leading-[1.4]">
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

      {/* 标签右键上下文菜单（与正文菜单统一样式） */}
      {contextMenu.visible &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              left: `${menuPosition.left}px`,
              top: `${menuPosition.top}px`,
              maxHeight: menuMaxHeight,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              'fixed z-[100] flex w-56 flex-col overflow-y-auto rounded-2xl p-1.5 select-none custom-scrollbar',
              'bg-white/85 dark:bg-[#18181b]/90 text-zinc-800 dark:text-zinc-200',
              'border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-3xl',
              'ring-1 ring-black/5 dark:ring-white/5',
              'animate-in fade-in zoom-in-95 duration-120'
            )}
          >
            {/* 1. 关闭当前 */}
            <button
              type="button"
              onClick={() => {
                closeMenu();
                onCloseTab(contextMenu.tabId);
              }}
              className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-medium text-zinc-800 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-zinc-100 cursor-pointer text-left"
            >
              <Trash2 size={13.5} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
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
                'flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-medium transition-colors text-left',
                tabs.length <= 1
                  ? 'cursor-not-allowed text-zinc-400 opacity-50 dark:text-zinc-600'
                  : 'cursor-pointer text-zinc-800 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-zinc-100'
              )}
            >
              <Sparkles size={13.5} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
              <span>{t('card.tabCloseOthers')}</span>
            </button>

            <div className="my-1 h-px bg-zinc-200/70 dark:bg-white/10" />

            {/* 3. 关闭左侧 */}
            <button
              type="button"
              disabled={contextMenu.tabIndex <= 0}
              onClick={() => {
                closeMenu();
                onCloseLeftTabs?.(contextMenu.tabId);
              }}
              className={cn(
                'flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-medium transition-colors text-left',
                contextMenu.tabIndex <= 0
                  ? 'cursor-not-allowed text-zinc-400 opacity-50 dark:text-zinc-600'
                  : 'cursor-pointer text-zinc-800 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-zinc-100'
              )}
            >
              <PanelLeftClose size={13.5} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
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
                'flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-medium transition-colors text-left',
                contextMenu.tabIndex >= tabs.length - 1
                  ? 'cursor-not-allowed text-zinc-400 opacity-50 dark:text-zinc-600'
                  : 'cursor-pointer text-zinc-800 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-zinc-100'
              )}
            >
              <PanelRightClose size={13.5} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
              <span>{t('card.tabCloseRight')}</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};
