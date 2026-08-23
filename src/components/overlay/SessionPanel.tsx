import React from 'react';
import { Plus, Trash2, X, MessageSquare, Clock, Layers } from 'lucide-react';
import { SessionMeta } from '@/types/session';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export interface SessionPanelProps {
  isOpen: boolean;
  sessions: SessionMeta[];
  currentSessionId: string | null;
  onClose: () => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (e: React.MouseEvent, id: string) => void;
  onClearAll: () => void;
}

function formatRelativeTime(timestamp: number, isZh: boolean): string {
  if (!timestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return isZh ? '刚刚' : 'Just now';
  if (diff < 3600) return isZh ? `${Math.floor(diff / 60)} 分钟前` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return isZh ? `${Math.floor(diff / 3600)} 小时前` : `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return isZh ? `${Math.floor(diff / 86400)} 天前` : `${Math.floor(diff / 86400)}d ago`;

  const date = new Date(timestamp * 1000);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export const SessionPanel: React.FC<SessionPanelProps> = ({
  isOpen,
  sessions,
  currentSessionId,
  onClose,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onClearAll,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 rounded-[20px] overflow-hidden select-none border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xl">
      {/* 头部 */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-zinc-600 dark:text-zinc-400" />
          <span className="text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">
            {t('card.historySessions')}
          </span>
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
            {sessions.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {sessions.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
              title={t('sessions.clearAllSessions')}
            >
              <Trash2 size={12} />
              <span>{t('common.clear')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            title={t('common.close') + ' (Esc)'}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* 新建会话条 */}
      <div className="p-3 pb-1.5 shrink-0">
        <button
          type="button"
          onClick={onNewSession}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 py-2 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-400 transition-colors cursor-pointer"
        >
          <Plus size={14} strokeWidth={2.4} className="text-blue-500" />
          <span>{t('card.newChat')}</span>
        </button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500 space-y-2">
            <MessageSquare size={32} strokeWidth={1.5} className="opacity-40" />
            <p className="text-[12.5px]">{t('sessions.noSessions')}</p>
            <p className="text-[11px] opacity-75">{isZh ? '发送对话后将自动为您保存在这里' : 'Conversations will be automatically saved here'}</p>
          </div>
        ) : (
          sessions.map((s) => {
            const isCurrent = s.id === currentSessionId;
            return (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={cn(
                  'group relative flex flex-col gap-1 rounded-xl p-2.5 transition-all duration-150 cursor-pointer border',
                  isCurrent
                    ? 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/40 shadow-xs'
                    : 'bg-white/60 dark:bg-zinc-900/60 border-zinc-200/70 dark:border-zinc-800/80 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                {/* 标题与删除按钮 */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'truncate text-[13px] font-medium',
                      isCurrent
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-zinc-900 dark:text-zinc-100'
                    )}
                  >
                    {s.title || t('card.newChat')}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => onDeleteSession(e, s.id)}
                    className="opacity-0 group-hover:opacity-100 flex size-5.5 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-all cursor-pointer"
                    title={t('sessions.deleteSession')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* 元信息：模型 + 时间 */}
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                  {s.model && (
                    <div className="flex items-center gap-1 max-w-36 truncate">
                      <Layers size={10} className="shrink-0" />
                      <span className="truncate">{s.model}</span>
                    </div>
                  )}
                  {s.updatedAt && (
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      <Clock size={10} className="shrink-0" />
                      <span>{formatRelativeTime(s.updatedAt, isZh)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
