import { useState, useCallback } from 'react';

/**
 * 剪贴板复制及反馈状态 Hook
 * @param timeout 反馈提示持续时长（毫秒），默认 1500ms
 */
export function useCopyFeedback(timeout = 1500) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), timeout);
        return true;
      } catch (err) {
        console.warn('Failed to copy text:', err);
        return false;
      }
    },
    [timeout]
  );

  return { copied, copy };
}
