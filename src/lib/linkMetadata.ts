/**
 * 网页元数据（Open Graph / description / favicon）请求与缓存
 */

import { invoke } from '@tauri-apps/api/core';

export interface LinkMetadata {
  url: string;
  siteName?: string;
  title?: string;
  description?: string;
  publishedAt?: string;
  favicon?: string;
}

const cache = new Map<string, LinkMetadata>();
const pending = new Map<string, Promise<LinkMetadata | null>>();

// 限制并发抓取数量，避免一次展开大量链接时集中请求
const MAX_CONCURRENT = 3;
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeRequests += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRequests = Math.max(0, activeRequests - 1);
  waitQueue.shift()?.();
}

export function getCachedLinkMetadata(url: string): LinkMetadata | undefined {
  return cache.get(url);
}

/** 抓取链接元数据；同一 URL 复用缓存与在途请求 */
export function fetchLinkMetadata(url: string): Promise<LinkMetadata | null> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const request = acquireSlot()
    .then(() => invoke<LinkMetadata>('fetch_link_metadata', { url }))
    .then((metadata) => {
      cache.set(url, metadata);
      return metadata;
    })
    .catch((error) => {
      console.warn('Failed to fetch link metadata:', error);
      return null;
    })
    .finally(() => {
      pending.delete(url);
      releaseSlot();
    });

  pending.set(url, request);
  return request;
}

/** 将 ISO / 日期字符串格式化为 YYYY/MM/DD，无法识别时返回空串 */
export function formatPublishedDate(value?: string): string {
  if (!value) return '';

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim());
  if (iso) {
    return `${iso[1]}/${iso[2].padStart(2, '0')}/${iso[3].padStart(2, '0')}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${String(
      parsed.getDate()
    ).padStart(2, '0')}`;
  }

  return '';
}
