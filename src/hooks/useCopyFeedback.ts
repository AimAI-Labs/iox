import { useState, useCallback, useRef } from 'react';

/**
 * 剪贴板复制及反馈状态 Hook
 * @param timeout 反馈提示持续时长（毫秒），默认 1500ms
 */
export function useCopyFeedback(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      if (!text) return false;

      let success = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          success = true;
        }
      } catch {
        success = false;
      }

      // 降级回退方案
      if (!success) {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          textArea.style.top = '-9999px';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          success = document.execCommand('copy');
          document.body.removeChild(textArea);
        } catch (err) {
          console.warn('Failed to copy text using fallback:', err);
        }
      }

      if (success) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        setCopied(true);
        timerRef.current = setTimeout(() => {
          setCopied(false);
          timerRef.current = null;
        }, timeout);
      }

      return success;
    },
    [timeout]
  );

  return { copied, copy };
}

