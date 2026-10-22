import React, { useLayoutEffect, useRef, useState } from 'react';
import { LinkCardContent } from '@/components/overlay/LinkCardContent';
import { useLinkMetadata } from '@/hooks/useLinkMetadata';
import { cn } from '@/lib/utils';

export interface LinkPreviewRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

export interface LinkPreviewCardProps {
  href: string;
  title: string;
  domain: string;
  anchorRect: LinkPreviewRect;
}

const GAP = 8;
const EDGE = 8;

/**
 * 链接悬浮预览卡：固定在视口坐标上，自动避开窗口边缘与底部。
 */
export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  href,
  title,
  domain,
  anchorRect,
}) => {
  const metadata = useLinkMetadata(href);
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: EDGE, top: EDGE });
  const [origin, setOrigin] = useState({ x: 150, y: 0 });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;

    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const maxLeft = Math.max(EDGE, window.innerWidth - width - EDGE);
    const anchorCenter = anchorRect.left + anchorRect.width / 2;
    const left = Math.min(Math.max(EDGE, anchorCenter - width / 2), maxLeft);

    // 统一放在链接上方，避免遮挡下方正文
    const top = Math.max(EDGE, anchorRect.top - height - GAP);

    setPosition({ left, top });
    // 让缩放动画从链接位置展开，而不是从卡片中心“飘”出来
    setOrigin({
      x: Math.min(Math.max(anchorCenter - left, 20), width - 20),
      y: height,
    });
    setReady(true);
  }, [anchorRect, href, title, domain, metadata]);

  return (
    <div
      ref={cardRef}
      className={cn(
        'pointer-events-none fixed z-[9999] w-[320px] max-w-[calc(100vw-16px)]',
        ready && 'link-preview-pop'
      )}
      style={{
        left: position.left,
        top: position.top,
        transformOrigin: `${origin.x}px ${origin.y}px`,
        visibility: ready ? 'visible' : 'hidden',
      }}
    >
      <div className="rounded-xl border border-line bg-[#fcfcfd] p-3 shadow-overlay dark:bg-[#202024]">
        <LinkCardContent
          link={{ href, domain, title }}
          metadata={metadata}
        />
      </div>
    </div>
  );
};
