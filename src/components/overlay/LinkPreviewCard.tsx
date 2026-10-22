import React, { useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, Link as LinkIcon } from 'lucide-react';
import { LinkFavicon } from '@/components/overlay/LinkFavicon';
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
  }, [anchorRect, href, title, domain]);

  return (
    <div
      ref={cardRef}
      className={cn(
        'pointer-events-none fixed z-[9999] w-[300px] max-w-[calc(100vw-16px)]',
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
        <div className="flex items-start gap-2.5">
          <LinkFavicon domain={domain} size={28} className="mt-0.5" />

          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink">
              {title}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-ink-3">{domain}</div>
          </div>

          <ExternalLink size={12} className="mt-0.5 shrink-0 text-ink-3" />
        </div>

        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-field px-2 py-1">
          <LinkIcon size={10} className="shrink-0 text-ink-3" />
          <span className="truncate text-[10.5px] text-ink-2">{href}</span>
        </div>
      </div>
    </div>
  );
};
