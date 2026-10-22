import { useEffect, useState } from 'react';
import {
  fetchLinkMetadata,
  getCachedLinkMetadata,
  type LinkMetadata,
} from '@/lib/linkMetadata';

/**
 * 读取链接元数据：优先取缓存，否则后台抓取。
 */
export function useLinkMetadata(href: string): LinkMetadata | null {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(
    () => getCachedLinkMetadata(href) ?? null
  );

  useEffect(() => {
    let alive = true;
    const cached = getCachedLinkMetadata(href);
    setMetadata(cached ?? null);

    if (!cached) {
      void fetchLinkMetadata(href).then((result) => {
        if (alive && result) setMetadata(result);
      });
    }

    return () => {
      alive = false;
    };
  }, [href]);

  return metadata;
}
