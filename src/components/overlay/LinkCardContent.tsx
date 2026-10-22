import React from 'react';
import { LinkFavicon } from '@/components/overlay/LinkFavicon';
import { formatPublishedDate, type LinkMetadata } from '@/lib/linkMetadata';
import type { LinkInfo } from '@/lib/links';
import { cn } from '@/lib/utils';

export interface LinkCardContentProps {
  link: LinkInfo;
  metadata: LinkMetadata | null;
  className?: string;
}

/**
 * 链接卡片正文：站点 / 日期 → 标题 → 描述。
 * 悬浮预览卡与右侧详情栏共用，保证两处样式一致。
 */
export const LinkCardContent: React.FC<LinkCardContentProps> = ({
  link,
  metadata,
  className,
}) => {
  const siteName = metadata?.siteName || link.domain;
  const title = metadata?.title || link.title;
  const description = metadata?.description;
  const publishedAt = formatPublishedDate(metadata?.publishedAt);

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <div className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-ink-3">
        <LinkFavicon
          domain={link.domain}
          faviconUrl={metadata?.favicon}
          size={16}
          className="rounded-[4px]"
        />
        <span className="truncate font-medium text-ink-2">{siteName}</span>
        {publishedAt && (
          <>
            <span className="shrink-0 text-ink-3/40">|</span>
            <span className="shrink-0 tabular-nums">{publishedAt}</span>
          </>
        )}
      </div>

      <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
        {title}
      </div>

      {description && (
        <div className="line-clamp-2 text-[11.5px] leading-relaxed text-ink-3">
          {description}
        </div>
      )}
    </div>
  );
};
