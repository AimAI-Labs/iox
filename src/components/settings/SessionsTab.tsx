import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import {
  MessageSquare,
  Search,
  Trash2,
  FolderOpen,
  Copy,
  Check,
  Clock,
  Layers,
  FileText,
  Sparkles,
} from 'lucide-react';
import { ChatSessionData } from '@/types/session';
import { CodeBlock } from '@/components/overlay/CodeBlock';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { cn } from '@/lib/utils';

function formatFullTime(timestamp: number): string {
  if (!timestamp) return '';
  const d = new Date(timestamp * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

export const SessionsTab: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSessionData[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { copied, copy } = useCopyFeedback(2000);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await invoke<ChatSessionData[]>('get_all_full_chat_sessions');
      setSessions(data || []);
      if (data && data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data[0].id);
      }
    } catch (err) {
      console.warn('Failed to load full sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await invoke('delete_chat_session', { id });
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (selectedSessionId === id) {
          setSelectedSessionId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('确定要清空所有历史对话记录吗？此操作不可恢复。')) return;
    try {
      await invoke('clear_all_chat_sessions');
      setSessions([]);
      setSelectedSessionId(null);
    } catch (err) {
      console.error('Failed to clear sessions:', err);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke('open_sessions_directory');
    } catch (err) {
      console.error('Failed to open directory:', err);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.streamText.toLowerCase().includes(q) ||
      s.selectedText.toLowerCase().includes(q) ||
      s.model.toLowerCase().includes(q)
    );
  });

  const currentSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4">
      {/* 顶部操作工具行 */}
      <div className="flex shrink-0 items-center justify-between gap-3 bg-white/40 dark:bg-zinc-900/40 p-3 rounded-xl border border-black/5 dark:border-white/5">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            placeholder="搜索会话标题、模型或内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 rounded-lg text-xs bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-foreground outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-white/80 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/80 transition-colors cursor-pointer"
            title="在资源管理器中打开 JSONL 存储目录"
          >
            <FolderOpen size={13} />
            <span>打开存储目录</span>
          </button>

          {sessions.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              <span>清空全部</span>
            </button>
          )}
        </div>
      </div>

      {/* 左右主体分栏 */}
      <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
        {/* 左侧会话卡片列表 */}
        <div className="w-72 shrink-0 flex flex-col rounded-xl bg-white/40 dark:bg-zinc-900/40 border border-black/5 dark:border-white/5 overflow-hidden">
          <div className="px-3 py-2 border-b border-black/5 dark:border-white/5 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 flex justify-between">
            <span>会话列表 ({filteredSessions.length})</span>
            <span>JSONL 格式存储</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {loading ? (
              <div className="py-12 text-center text-xs text-zinc-400">正在加载会话...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400 space-y-1">
                <MessageSquare size={24} className="mx-auto opacity-30" />
                <p>暂无匹配会话</p>
              </div>
            ) : (
              filteredSessions.map((s) => {
                const active = s.id === selectedSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className={cn(
                      'group flex flex-col gap-1 p-2.5 rounded-lg transition-all duration-150 cursor-pointer border text-left',
                      active
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'bg-white/60 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-medium">{s.title}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 flex size-5 items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        title="删除该条记录"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                      <span className="truncate max-w-28">{s.model}</span>
                      <span>{formatFullTime(s.updatedAt).slice(5, 16)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右侧会话详情预览 */}
        <div className="flex-1 flex flex-col rounded-xl bg-white/40 dark:bg-zinc-900/40 border border-black/5 dark:border-white/5 overflow-hidden">
          {currentSession ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* 详情头部 */}
              <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5">
                <div className="flex flex-col min-w-0 pr-4">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {currentSession.title}
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 font-mono">
                    <span className="flex items-center gap-1">
                      <Layers size={11} /> {currentSession.model}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {formatFullTime(currentSession.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => copy(currentSession.streamText)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/80 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/80 transition-colors cursor-pointer text-foreground"
                    title="复制回答全文"
                  >
                    {copied ? (
                      <Check size={13} className="text-emerald-500" />
                    ) : (
                      <Copy size={13} />
                    )}
                    <span>{copied ? '已复制' : '复制回答'}</span>
                  </button>
                </div>
              </div>

              {/* 详情内容滚动区 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar select-text">
                {/* 原始选中文本 (如有) */}
                {currentSession.selectedText && (
                  <div className="rounded-lg bg-zinc-100/80 dark:bg-zinc-800/60 p-3 border border-zinc-200/60 dark:border-zinc-700/60">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 mb-1.5">
                      <FileText size={12} />
                      <span>原始选中文本</span>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {currentSession.selectedText}
                    </p>
                  </div>
                )}

                {/* AI 回答渲染 */}
                <div className="markdown-body text-xs leading-relaxed text-foreground">
                  <ReactMarkdown
                    components={{
                      code: (props: any) => (
                        <CodeBlock
                          {...props}
                          codeBlockWrap={true}
                          codeBlockLineNumbers={true}
                        />
                      ),
                      pre: ({ children }: any) => <>{children}</>,
                    }}
                  >
                    {currentSession.streamText}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-2">
              <Sparkles size={32} className="opacity-30" />
              <p className="text-xs">选择左侧会话查看完整对话记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
