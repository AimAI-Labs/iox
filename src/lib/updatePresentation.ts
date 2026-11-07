import type { TranslationKey } from '@/locales';
import type { UpdateStatus } from '@/hooks/useUpdateCheck';

export type UpdateTone = 'idle' | 'checking' | 'current' | 'available' | 'warning';

/** 版本区域的展示投影；文案键交给 i18n，避免把本地化文本写进状态判断。 */
export interface UpdatePresentation {
  tone: UpdateTone;
  badgeKey: TranslationKey;
  detailKey: TranslationKey;
  detailParams?: Record<string, string | number>;
  showReleaseLink: boolean;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Rust 的 `checked_at` 以秒为单位；异常或未来时间都收敛为「刚刚检查」。 */
function checkedAgo(
  checkedAtSeconds: number,
  now: number,
  language: 'zh' | 'en',
): Pick<UpdatePresentation, 'detailKey' | 'detailParams'> {
  const checkedMs = Number.isFinite(checkedAtSeconds) && checkedAtSeconds > 0
    ? checkedAtSeconds * 1000
    : 0;
  if (checkedMs === 0) return { detailKey: 'settings.update.latest' };

  const elapsed = Math.max(0, now - checkedMs);
  if (elapsed < MINUTE_MS) return { detailKey: 'settings.update.checkedJustNow' };
  if (elapsed < HOUR_MS) {
    return { detailKey: 'settings.update.checkedMinutesAgo', detailParams: { count: Math.floor(elapsed / MINUTE_MS) } };
  }
  if (elapsed < DAY_MS) {
    return { detailKey: 'settings.update.checkedHoursAgo', detailParams: { count: Math.floor(elapsed / HOUR_MS) } };
  }
  if (elapsed < 7 * DAY_MS) {
    return { detailKey: 'settings.update.checkedDaysAgo', detailParams: { count: Math.floor(elapsed / DAY_MS) } };
  }
  const locale = language === 'zh' ? 'zh-CN' : 'en-US';
  return {
    detailKey: 'settings.update.checkedOn',
    detailParams: { date: new Date(checkedMs).toLocaleDateString(locale) },
  };
}

/**
 * 手动检查期间优先显示「检查中」，但保留上一次状态的发布页入口，
 * 避免重新检查时可用的更新链接闪烁消失。
 */
export function presentUpdateStatus(
  status: UpdateStatus | null,
  checking: boolean,
  now: number,
  language: 'zh' | 'en',
): UpdatePresentation {
  const showReleaseLink = status?.state === 'available'
    || status?.state === 'unknown'
    || status?.state === 'unavailable';

  if (checking) {
    return {
      tone: 'checking',
      badgeKey: 'settings.update.checking',
      detailKey: 'settings.update.detailChecking',
      showReleaseLink,
    };
  }

  if (!status) {
    return {
      tone: 'idle',
      badgeKey: 'settings.update.notChecked',
      detailKey: 'settings.update.detailNotChecked',
      showReleaseLink: false,
    };
  }

  switch (status.state) {
    case 'available':
      return status.latestVersion
        ? {
          tone: 'available',
          badgeKey: 'settings.update.availableShort',
          detailKey: 'settings.update.detailAvailable',
          detailParams: { version: status.latestVersion },
          showReleaseLink: true,
        }
        : {
          tone: 'available',
          badgeKey: 'settings.update.availableShort',
          detailKey: 'settings.update.detailAvailableNoVersion',
          showReleaseLink: true,
        };
    case 'current':
      return {
        tone: 'current',
        badgeKey: 'settings.update.stateCurrent',
        ...checkedAgo(status.checkedAt, now, language),
        showReleaseLink: false,
      };
    case 'unknown':
      return {
        tone: 'warning',
        badgeKey: 'settings.update.stateUnknown',
        detailKey: 'settings.update.unknown',
        showReleaseLink: true,
      };
    case 'unavailable':
    default:
      return {
        tone: 'warning',
        badgeKey: 'settings.update.stateFailed',
        detailKey: 'settings.update.failed',
        showReleaseLink: true,
      };
  }
}
