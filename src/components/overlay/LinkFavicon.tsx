import React, { useEffect, useMemo, useState } from 'react';
import { getFaviconUrl } from '@/lib/links';
import { cn } from '@/lib/utils';

export interface LinkFaviconProps {
  domain: string;
  /** 页面声明的 favicon 地址，优先使用 */
  faviconUrl?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 站点图标，加载失败时回退为域名首字母。
 */
export const LinkFavicon: React.FC<LinkFaviconProps> = ({
  domain,
  faviconUrl,
  size = 20,
  className,
  style,
}) => {
  const [failed, setFailed] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);

  const sources = useMemo(() => {
    const list: string[] = [];
    if (faviconUrl) list.push(faviconUrl);
    if (domain) {
      list.push(getFaviconUrl(domain), `https://${domain}/favicon.ico`);
    }
    return list;
  }, [domain, faviconUrl]);

  useEffect(() => {
    setFailed(false);
    setSourceIndex(0);
  }, [domain, faviconUrl]);

  const initial = domain?.charAt(0).toUpperCase() || '?';
  const src = sources[sourceIndex];

  if (!domain || failed || !src) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 select-none items-center justify-center rounded-[4px] font-semibold',
          'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300',
          className
        )}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.45), ...style }}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      key={src}
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (sourceIndex + 1 < sources.length) setSourceIndex((index) => index + 1);
        else setFailed(true);
      }}
      className={cn(
        'shrink-0 rounded-[4px] bg-zinc-100 object-contain dark:bg-zinc-800',
        className
      )}
      style={{ width: size, height: size, ...style }}
    />
  );
};
