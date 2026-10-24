import { useMemo, useSyncExternalStore } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { createProviderBalanceStore, getBalanceAdapter, type ProviderBalance } from '@/lib/providerBalance';
import type { ProviderConfig } from '@/types/config';

const store = createProviderBalanceStore((providerId, expected) => invoke<ProviderBalance>('fetch_provider_balance', {
  providerId, expectedBaseUrl: expected.baseUrl, expectedApiKey: expected.apiKey,
}));
const subscribeNone = () => () => {};
const getEmptySnapshot = () => null;

export function useProviderBalance(provider?: ProviderConfig) {
  const account = useMemo(() => provider && getBalanceAdapter(provider) ? store.account(provider) : null,
    [provider?.id, provider?.baseUrl, provider?.apiKey]);
  const snapshot = useSyncExternalStore(account?.subscribe ?? subscribeNone, account?.getSnapshot ?? getEmptySnapshot);
  return { snapshot, refresh: account?.refresh };
}
