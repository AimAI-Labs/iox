import type { ProviderConfig } from '@/types/config';

export const BALANCE_REFRESH_MS = 5 * 60 * 1000;

type BalanceProvider = Pick<ProviderConfig, 'id' | 'baseUrl' | 'apiKey'>;
export type BalanceError = 'unsupported' | 'missingKey' | 'providerMissing' | 'unauthorized'
  | 'rateLimited' | 'timeout' | 'network' | 'invalidResponse' | 'server' | 'configChanged';

export interface ProviderBalance {
  isAvailable: boolean;
  balanceInfos: {
    currency: 'CNY' | 'USD';
    totalBalance: string;
    grantedBalance: string;
    toppedUpBalance: string;
  }[];
}

export interface BalanceSnapshot {
  loading: boolean;
  data: ProviderBalance | null;
  error: BalanceError | null;
  updatedAt: number | null;
}

export interface BalanceAccount {
  getSnapshot: () => BalanceSnapshot;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
}

/** 能力按真实 API 来源选择，不能因模型名或服务商别名把其他账号的密钥送往官网。 */
export function getBalanceAdapter(provider?: Pick<BalanceProvider, 'baseUrl'>): 'deepseek' | null {
  if (!provider) return null;
  try {
    const url = new URL(provider.baseUrl.trim());
    if (url.protocol === 'https:' && url.hostname === 'api.deepseek.com'
      && !url.port && !url.username && !url.password) return 'deepseek';
  } catch { /* 非 URL 的配置不具备余额查询能力。 */ }
  return null;
}

export function formatBalanceAmount(value: string, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 8,
  }).format(Number(value));
}

const ERROR_CODES: BalanceError[] = ['unsupported', 'missingKey', 'providerMissing', 'unauthorized',
  'rateLimited', 'timeout', 'network', 'invalidResponse', 'server', 'configChanged'];

interface BalanceClock {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
}

const defaultClock: BalanceClock = {
  now: Date.now,
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer),
};

/** 每个账号只有一个请求和刷新时钟；React 只订阅不可变快照。缓存仅存在内存。 */
export function createProviderBalanceStore(
  fetchBalance: (providerId: string, expected: BalanceProvider) => Promise<ProviderBalance>,
  clock: BalanceClock = defaultClock,
) {
  const accounts = new Map<string, { baseUrl: string; apiKey: string; account: BalanceAccount }>();

  function createAccount(provider: BalanceProvider): BalanceAccount {
    let snapshot: BalanceSnapshot = { loading: false, data: null, error: null, updatedAt: null };
    let lastAttemptAt: number | null = null;
    let inFlight: Promise<void> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const listeners = new Set<() => void>();

    function publish(next: BalanceSnapshot) {
      snapshot = next;
      for (const listener of listeners) listener();
    }

    function clearTimer() {
      if (timer !== null) clock.clearTimeout(timer);
      timer = null;
    }

    function schedule() {
      clearTimer();
      if (listeners.size === 0 || inFlight || !provider.apiKey.trim()) return;
      const remaining = lastAttemptAt === null ? 0 : BALANCE_REFRESH_MS - (clock.now() - lastAttemptAt);
      timer = clock.setTimeout(() => { void refresh(false); }, Math.max(0, remaining));
    }

    function refresh(force = true): Promise<void> {
      if (inFlight) return inFlight;
      if (!provider.apiKey.trim()) {
        publish({ ...snapshot, error: 'missingKey' });
        return Promise.resolve();
      }
      if (!force && lastAttemptAt !== null && clock.now() - lastAttemptAt < BALANCE_REFRESH_MS) {
        schedule();
        return Promise.resolve();
      }
      clearTimer();
      lastAttemptAt = clock.now();
      inFlight = Promise.resolve().then(() => fetchBalance(provider.id, provider))
        .then((data) => publish({ loading: false, data, error: null, updatedAt: clock.now() }))
        .catch((error: unknown) => {
          const code = ERROR_CODES.includes(error as BalanceError) ? error as BalanceError : 'network';
          publish({ ...snapshot, loading: false, error: code });
        })
        .finally(() => { inFlight = null; schedule(); });
      publish({ ...snapshot, loading: true, error: null });
      return inFlight;
    }

    return {
      getSnapshot: () => snapshot,
      refresh: () => refresh(),
      subscribe(listener) {
        listeners.add(listener);
        if (listeners.size === 1) void refresh(false);
        return () => {
          listeners.delete(listener);
          if (listeners.size === 0) clearTimer();
        };
      },
    };
  }

  return {
    account(provider: BalanceProvider): BalanceAccount {
      const cached = accounts.get(provider.id);
      if (cached && cached.baseUrl === provider.baseUrl && cached.apiKey === provider.apiKey) return cached.account;
      const account = createAccount({ ...provider });
      accounts.set(provider.id, { baseUrl: provider.baseUrl, apiKey: provider.apiKey, account });
      return account;
    },
  };
}
