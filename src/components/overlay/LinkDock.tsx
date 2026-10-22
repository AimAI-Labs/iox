import React from 'react';
import { ChevronRight } from 'lucide-react';
import { LinkFavicon } from '@/components/overlay/LinkFavicon';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { LinkInfo } from '@/lib/links';

export interface LinkDockProps {
  links: LinkInfo[];
  onOpen: () => void;
}

const FAVICON_SIZE = 20;

/**
 * 回答底部的链接聚合条：前 3 个站点图标叠放 + 链接总数。
 */
export const LinkDock: React.FC<LinkDockProps> = ({ links, onOpen }) => {
  const { t } = useTranslation();

  // 图标按站点去重，避免同一网站的多个链接重复堆叠
  const previews: LinkInfo[] = [];
  const seenDomains = new Set<string>();
  for (const link of links) {
    if (seenDomains.has(link.domain)) continue;
    seenDomains.add(link.domain);
    previews.push(link);
    if (previews.length === 3) break;
  }
  const extraCount = links.length - previews.length;

  return (
    <div className="flex shrink-0 items-center px-3.5 pb-1 pt-0.5">
      <button
        type="button"
        onClick={onOpen}
        className="group flex items-center gap-2.5 rounded-full border border-line/70 bg-white/70 py-1 pl-1.5 pr-2.5 shadow-hairline transition-[background-color,border-color,box-shadow,transform] duration-200 hover:border-line-strong hover:bg-white hover:shadow-md active:scale-[0.98] dark:bg-zinc-900/60 dark:hover:bg-zinc-800 cursor-pointer"
        title={t('card.linksInAnswer')}
      >
        <span className="flex items-center">
          {previews.map((link, index) => (
            <span
              key={link.href}
              className={cn(
                'inline-flex transition-[margin] duration-200 ease-out',
                index > 0 && '-ml-[7px] group-hover:ml-0.5'
              )}
            >
              <LinkFavicon
                domain={link.domain}
                size={FAVICON_SIZE}
                className="rounded-full ring-2 ring-white dark:ring-[#18181b]"
              />
            </span>
          ))}

          {extraCount > 0 && (
            <span
              className="-ml-[7px] flex items-center justify-center rounded-full bg-zinc-200 text-[9px] font-semibold text-ink-2 ring-2 ring-white transition-[margin] duration-200 ease-out group-hover:ml-0.5 dark:bg-zinc-700 dark:text-zinc-300 dark:ring-[#18181b]"
              style={{ width: FAVICON_SIZE, height: FAVICON_SIZE }}
            >
              +{extraCount}
            </span>
          )}
        </span>

        <span className="text-[11px] font-medium tabular-nums text-ink-2 transition-colors group-hover:text-ink">
          {t('card.linkCount', { count: links.length })}
        </span>

        <ChevronRight
          size={11}
          className="text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </button>
    </div>
  );
};
