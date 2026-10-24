import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';

import type { SessionStorageError } from '@/types/session';

const messages = {
  load: ['无法读取历史会话，已保留当前内容。', 'Could not load history. Your current content is preserved.'],
  save: ['会话保存失败，当前对话仍保留在窗口中。', 'Could not save the conversation. It remains in this window.'],
  delete: ['删除失败，历史会话未移除。', 'Could not delete the conversation. History is unchanged.'],
  clear: ['清空失败，历史会话未移除。', 'Could not clear history. History is unchanged.'],
} as const;

export function SessionStorageAlert({ error }: { error: SessionStorageError }): React.ReactElement | null {
  const { resolvedLanguage } = useTranslation();
  if (!error) return null;
  return (
    <div role="alert" className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
      {messages[error][resolvedLanguage === 'zh' ? 0 : 1]}
    </div>
  );
}

