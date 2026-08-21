import React, { useRef, useEffect } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
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
  onNewTab: () => void;
  className?: string;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  className,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

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
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const displayTitle = tab.title || (tab.selectedText ? tab.selectedText.slice(0, 12) : '新对话');

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                'group relative flex h-6.5 items-center gap-1.5 rounded-lg px-2 text-[12px] transition-all duration-120 cursor-pointer max-w-36 shrink-0',
                isActive
                  ? 'bg-white dark:bg-[#27272a] text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/80 dark:border-zinc-700/80 font-medium'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 border border-transparent'
              )}
              title={tab.title || '会话标签'}
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
                title="关闭会话"
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
        title="新建标签页 (+)"
      >
        <Plus size={13} strokeWidth={2.4} />
      </button>
    </div>
  );
};
