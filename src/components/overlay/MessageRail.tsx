import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HoverPopover } from '@/components/overlay/HoverPopover';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface RailItem {
  element: HTMLElement;
  offset: number;
  label: string;
}

export interface MessageRailProps {
  scrollRef: React.RefObject<HTMLElement | null>;
  /** 内容变化时触发重新测量（通常传 streamText 长度等轻量值） */
  refreshKey: string | number;
}

/**
 * 右侧消息定位条：
 * - 所有消息刻度合并为一根连续的分段竖条，在正文视图内垂直居中
 * - 当前视口对应的消息段高亮
 * - 悬浮刻度条时，在左侧展开一个包含全部用户消息的缩略图列表
 * - 悬浮列表项时文字右移、放大、加粗；点击平滑滚动到对应消息
 */
export const MessageRail: React.FC<MessageRailProps> = ({ scrollRef, refreshKey }) => {
  const { resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';

  const [items, setItems] = useState<RailItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const frameRef = useRef<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const updateActive = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const elements = Array.from(
      container.querySelectorAll<HTMLElement>('[data-user-message]')
    );
    if (!elements.length) {
      setActiveIndex(-1);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const probe = container.scrollTop + container.clientHeight * 0.35;
    let nextActive = 0;

    elements.forEach((element, index) => {
      const offset =
        element.getBoundingClientRect().top - containerRect.top + container.scrollTop;
      if (offset <= probe) nextActive = index;
    });

    setActiveIndex((previous) => (previous === nextActive ? previous : nextActive));
  }, [scrollRef]);

  const measure = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scrollable = container.scrollHeight > container.clientHeight + 4;
    setIsScrollable((previous) => (previous === scrollable ? previous : scrollable));

    const elements = Array.from(
      container.querySelectorAll<HTMLElement>('[data-user-message]')
    );

    const next = elements.map((element) => {
      const offset =
        element.getBoundingClientRect().top - containerRect.top + container.scrollTop;
      return {
        element,
        offset,
        label: (element.dataset.userMessageText || '').trim(),
      };
    });

    setItems((previous) => {
      const unchanged =
        previous.length === next.length &&
        previous.every(
          (item, index) =>
            item.offset === next[index].offset && item.label === next[index].label
        );
      return unchanged ? previous : next;
    });

    updateActive();
  }, [scrollRef, updateActive]);

  useEffect(() => {
    measure();
    // 流式结束后图片/公式可能继续撑开高度，延迟再校准一次
    const timer = window.setTimeout(measure, 300);
    return () => window.clearTimeout(timer);
  }, [refreshKey, measure]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        updateActive();
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    // 监听容器尺寸、消息气泡展开、图片/公式加载等导致的高度变化
    const resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(container);

    const observeChildren = () => {
      Array.from(container.children).forEach((child) => resizeObserver.observe(child));
    };
    observeChildren();

    const mutationObserver = new MutationObserver(() => {
      observeChildren();
      measure();
    });
    mutationObserver.observe(container, { childList: true });

    updateActive();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scrollRef, updateActive, measure]);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openList = useCallback(() => {
    cancelClose();
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchorRect(rect);
    setIsListOpen(true);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setIsListOpen(false);
      setAnchorRect(null);
    }, 160);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  // 正文滚动时收起列表，避免与当前定位脱节
  useEffect(() => {
    if (!isListOpen) return;
    const container = scrollRef.current;
    if (!container) return;

    const close = () => {
      setIsListOpen(false);
      setAnchorRect(null);
    };

    container.addEventListener('scroll', close, { passive: true });
    return () => container.removeEventListener('scroll', close);
  }, [isListOpen, scrollRef]);

  if (items.length < 2 || !isScrollable) return null;

  const handleJump = (item: RailItem) => {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollTo({
      top: Math.max(0, item.offset - 8),
      behavior: 'smooth',
    });
  };

  // 高度随消息数量增长但保持紧凑，整体在正文视图中垂直居中
  const railHeight = Math.min(240, Math.max(48, items.length * 16));

  return (
    <>
      <div
        ref={railRef}
        onMouseEnter={openList}
        onMouseLeave={scheduleClose}
        className="pointer-events-auto absolute right-2 top-1/2 z-20 flex w-3 -translate-y-1/2 flex-col overflow-hidden rounded-full"
        style={{ height: railHeight }}
      >
        {items.map((item, position) => (
          <button
            key={position}
            type="button"
            onClick={() => handleJump(item)}
            onFocus={openList}
            onBlur={scheduleClose}
            aria-label={item.label || (isZh ? '跳转到该用户消息' : 'Jump to message')}
            className="group relative w-full flex-1 cursor-pointer"
          >
            <span
              className={cn(
                'absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 transition-colors duration-150',
                position === activeIndex
                  ? 'bg-blue-500'
                  : 'bg-zinc-300 group-hover:bg-zinc-400 dark:bg-zinc-600 dark:group-hover:bg-zinc-500'
              )}
            />
          </button>
        ))}
      </div>

      {isListOpen && anchorRect && (
        <HoverPopover
          open
          anchorRect={anchorRect}
          placement="left"
          offset={8}
          interactive
          className="w-[300px]"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onFocus={cancelClose}
          onBlur={scheduleClose}
        >
          <div className="custom-scrollbar max-h-[min(60vh,480px)] space-y-0.5 overflow-y-auto overscroll-contain pr-0.5">
            {items.map((item, position) => (
              <button
                key={position}
                type="button"
                onClick={() => handleJump(item)}
                title={item.label}
                className="group/msg flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-right transition-colors hover:bg-hover cursor-pointer"
              >
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[12px] transition-[transform,font-size,font-weight] duration-200 ease-out group-hover/msg:translate-x-1 group-hover/msg:text-[13px] group-hover/msg:font-semibold',
                    position === activeIndex ? 'font-medium text-ink' : 'text-ink-2'
                  )}
                >
                  {item.label || (isZh ? '（无内容）' : '(No content)')}
                </span>

                <span
                  className={cn(
                    'h-[2px] w-2 shrink-0 rounded-full transition-colors',
                    position === activeIndex
                      ? 'bg-blue-500'
                      : 'bg-zinc-300 dark:bg-zinc-600'
                  )}
                />
              </button>
            ))}
          </div>
        </HoverPopover>
      )}
    </>
  );
};
