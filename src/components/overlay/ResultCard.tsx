import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ActionConfig, ProviderConfig } from '@/types/config';
import { CardHeader } from '@/components/overlay/CardHeader';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import {
  Copy,
  Check,
  Send,
  Square,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ResultCardProps {
  action: ActionConfig;
  providers: ProviderConfig[];
  selectedModel: string;
  streamText: string;
  isLoading: boolean;
  isPinned: boolean;
  isClosing?: boolean;
  error: string | null;
  onModelChange: (model: string) => void;
  onSendFollowUp: (prompt: string) => void;
  onCancel: () => void;
  onPinToggle: () => void;
  onClose: () => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  action,
  providers,
  selectedModel,
  streamText,
  isLoading,
  isPinned,
  isClosing = false,
  error,
  onModelChange,
  onSendFollowUp,
  onCancel,
  onPinToggle,
  onClose,
}) => {
  const { copied, copy } = useCopyFeedback(2000);
  const [followUpInput, setFollowUpInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const provider = providers.find((p) => p.id === action.providerId);
  const availableModels = provider?.models || [];

  // 自动滚屏到底部
  useEffect(() => {
    if (bodyRef.current && isLoading) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [streamText, isLoading]);

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpInput.trim() || isLoading) return;
    onSendFollowUp(followUpInput);
    setFollowUpInput('');
  };

  return (
    <div
      className={cn(
        "flex flex-col w-full h-full",
        "bg-white/85 dark:bg-zinc-950/85 text-foreground backdrop-blur-2xl",
        "border border-black/10 dark:border-white/10",
        "rounded-xl overflow-hidden",
        isClosing ? "animate-capsule-out" : "animate-in fade-in zoom-in-95 duration-150"
      )}
    >
      {/* 统一卡片头部 */}
      <CardHeader
        icon={action.icon}
        title={action.name}
        badge={
          availableModels.length > 0 ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelPicker((prev) => !prev)}
                onMouseDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground border border-black/5 dark:border-white/10 transition-colors cursor-pointer"
                title="切换模型"
              >
                <span>{selectedModel || '默认模型'}</span>
                <ChevronDown size={11} className="opacity-60" />
              </button>

              {showModelPicker && (
                <div className="absolute top-full mt-1.5 left-0 z-50 min-w-[150px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-xl shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100">
                  {availableModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        onModelChange(m);
                        setShowModelPicker(false);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer",
                        m === selectedModel
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : undefined
        }
        tools={
          streamText ? (
            <button
              type="button"
              onClick={() => copy(streamText)}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer mr-0.5"
              title="复制回答"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          ) : undefined
        }
        isPinned={isPinned}
        onPinToggle={onPinToggle}
        onClose={onClose}
      />

      {/* 渲染正文区 */}
      <div
        ref={bodyRef}
        className="flex-1 p-4 overflow-y-auto select-text text-foreground text-xs leading-relaxed bg-transparent"
      >
        {error ? (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        ) : streamText ? (
          <div className="markdown-body">
            <ReactMarkdown>{streamText}</ReactMarkdown>
            {isLoading && <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse" />}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
            </div>
            <p className="text-xs">AI 正在思考中...</p>
          </div>
        )}
      </div>

      {/* 底部追问栏 */}
      <div className="p-2.5 px-3 border-t border-black/10 dark:border-white/10 bg-transparent">
        <form onSubmit={handleFollowUpSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="追问或进一步要求... (Enter 发送)"
            value={followUpInput}
            onChange={(e) => setFollowUpInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 h-8 px-3 text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all select-text"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer"
              title="停止生成"
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!followUpInput.trim()}
              className="inline-flex items-center justify-center w-8 h-8 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground rounded-lg transition-all active:scale-95 cursor-pointer"
              title="发送追问"
            >
              <Send size={13} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
