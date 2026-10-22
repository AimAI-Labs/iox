import React from 'react';
import { LinkCardContent } from '@/components/overlay/LinkCardContent';
import { HoverPopover, type PopoverAnchorRect } from '@/components/overlay/HoverPopover';
import { useLinkMetadata } from '@/hooks/useLinkMetadata';

export interface LinkPreviewCardProps {
  href: string;
  title: string;
  domain: string;
  anchorRect: PopoverAnchorRect;
}

/**
 * 链接悬浮预览卡：复用统一的 HoverPopover 容器。
 */
export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  href,
  title,
  domain,
  anchorRect,
}) => {
  const metadata = useLinkMetadata(href);

  return (
    <HoverPopover
      open
      anchorRect={anchorRect}
      placement="top"
      offset={8}
      className="w-[320px]"
    >
      <LinkCardContent link={{ href, domain, title }} metadata={metadata} />
    </HoverPopover>
  );
};
