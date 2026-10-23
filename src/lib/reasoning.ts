export const THINKING_LEVELS = ['quick', 'low', 'deep', 'max'] as const;
export type ThinkingMode = (typeof THINKING_LEVELS)[number];

type Provider = { id: string; baseUrl: string };

export function isDeepSeekProvider(provider?: Provider): boolean {
  return Boolean(provider && (
    provider.id.toLowerCase().includes('deepseek') ||
    provider.baseUrl.toLowerCase().includes('deepseek')
  ));
}

export function getThinkingRequestOptions(mode: ThinkingMode, provider?: Provider) {
  if (mode === 'quick' || !isDeepSeekProvider(provider)) return { thinkingEnabled: false };
  return {
    thinkingEnabled: true,
    reasoningEffort: mode === 'deep' ? 'high' : mode,
  };
}
