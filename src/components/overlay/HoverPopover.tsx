import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface PopoverAnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HoverPopoverProps {
  open: boolean;
  anchorRect: PopoverAnchorRect;
  /** top: 显示在锚点上方并水平居中；left: 显示在锚点左侧并垂直居中 */
  placement?: 'top' | 'left';
  offset?: number;
  className?: string;
  /** 允许鼠标进入浮层（例如浮层内部需要点击或滚动） */
  interactive?: boolean;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  children: React.ReactNode;
}

const EDGE = 8;

/**
 * 统一的悬浮卡片（pop）容器：
 * 负责 portal、视口内定位、尺寸变化重定位、统一卡片外观与弹入动画。
 * 链接预览与消息定位条的悬浮卡共用此组件。
 */
export const HoverPopover: React.FC<HoverPopoverProps> = ({
  open,
  anchorRect,
  placement = 'top',
  offset = 8,
  className,
  interactive = false,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [origin, setOrigin] = useState('50% 100%');
  const [animationDone, setAnimationDone] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    const element = panelRef.current;
    if (!element) return;

    const update = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (placement === 'top') {
        const anchorCenter = anchorRect.left + anchorRect.width / 2;
        const left = Math.round(
          Math.min(
            Math.max(EDGE, anchorCenter - width / 2),
            Math.max(EDGE, viewportWidth - width - EDGE)
          )
        );
        const top = Math.round(Math.max(EDGE, anchorRect.top - height - offset));

        setPosition((previous) =>
          previous && previous.left === left && previous.top === top
            ? previous
            : { left, top }
        );
        setOrigin(
          `${Math.round(Math.min(Math.max(anchorCenter - left, 20), width - 20))}px 100%`
        );
      } else {
        const anchorCenter = anchorRect.top + anchorRect.height / 2;
        const left = Math.round(Math.max(EDGE, anchorRect.left - width - offset));
        const top = Math.round(
          Math.min(
            Math.max(EDGE, anchorCenter - height / 2),
            Math.max(EDGE, viewportHeight - height - EDGE)
          )
        );

        setPosition((previous) =>
          previous && previous.left === left && previous.top === top
            ? previous
            : { left, top }
        );
        setOrigin('100% 50%');
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [open, anchorRect, placement, offset]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={cn(
        'fixed z-[9999] max-w-[calc(100vw-16px)]',
        interactive ? 'pointer-events-auto' : 'pointer-events-none',
        position && !animationDone && 'floating-pop',
        className
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        left: position?.left ?? EDGE,
        top: position?.top ?? EDGE,
        transformOrigin: origin,
        visibility: position ? 'visible' : 'hidden',
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setAnimationDone(true);
      }}
    >
      <div className="rounded-xl border border-line bg-[#fcfcfd] p-3 shadow-overlay dark:bg-[#202024]">
        {children}
      </div>
    </div>,
    document.body
  );
};
