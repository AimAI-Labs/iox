import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ActionConfig, ProviderConfig } from '../types/config';
import { DynamicIcon } from './Icons';
import { useWindowDrag } from '../hooks/useWindowDrag';
import { WebCardView } from './WebCardView';
import {
  Pin,
  PinOff,
  X,
  Copy,
  Check,
  Send,
  Square,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ResultCardProps {
  action: ActionConfig;
  providers: ProviderConfig[];
  selectedModel: string;
  selectedText?: string;
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
  selectedText = '',
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
  // 若当前动作为 Web 官网卡片模式，渲染专用 Web 视图容器
  if (action.actionType === 'web_card') {
    return (
      <WebCardView
        action={action}
        selectedText={selectedText}
        isPinned={isPinned}
        isClosing={isClosing}
        onPinToggle={onPinToggle}
        onClose={onClose}
      />
    );
  }

  const [copied, setCopied] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const { handleMouseDown } = useWindowDrag();
  const bodyRef = useRef<HTMLDivElement>(null);

  const provider = providers.find((p) => p.id === action.providerId);
  const availableModels = provider?.models || [];

  // 自动滚屏到底部
  useEffect(() => {
    if (bodyRef.current && isLoading) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [streamText, isLoading]);

  // 复制结果
  const handleCopy = async () => {
    if (!streamText) return;
    try {
      await navigator.clipboard.writeText(streamText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

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
        "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl",
        "border border-zinc-200/80 dark:border-zinc-800/80",
        "rounded-2xl overflow-hidden",
        isClosing ? "animate-capsule-out" : "animate-in fade-in zoom-in-95 duration-150"
      )}
    >
      {/* 头部控制栏 */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/20 select-none cursor-move"
      >
        <div data-tauri-drag-region className="flex items-center gap-2">
          <DynamicIcon name={action.icon} size={16} className="text-blue-600 dark:text-blue-400 pointer-events-none" />
          <span data-tauri-drag-region className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 cursor-move">
            {action.name}
          </span>

          {/* 模型选择下拉 */}
          {availableModels.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelPicker((prev) => !prev)}
                onMouseDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                title="切换模型"
              >
                <span>{selectedModel || '默认模型'}</span>
                <ChevronDown size={11} className="text-zinc-400" />
              </button>

              {showModelPicker && (
                <div className="absolute top-full mt-1.5 left-0 z-50 min-w-[150px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100">
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
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div data-tauri-drag-region className="flex items-center gap-1">
          {streamText && (
            <button
              type="button"
              onClick={handleCopy}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="复制回答"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          )}

          <button
            type="button"
            onClick={onPinToggle}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors cursor-pointer",
              isPinned
                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
            title={isPinned ? '取消固定' : '固定悬浮窗'}
          >
            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
            title="关闭 (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 渲染正文区 */}
      <div
        ref={bodyRef}
        className="flex-1 p-4 overflow-y-auto select-text text-zinc-800 dark:text-zinc-200 text-xs leading-relaxed"
      >
        {error ? (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        ) : streamText ? (
          <div className="markdown-body">
            <ReactMarkdown>{streamText}</ReactMarkdown>
            {isLoading && <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-600 dark:bg-blue-400 animate-pulse" />}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400 dark:text-zinc-500">
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
      <div className="p-2.5 px-3 border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/60 dark:bg-zinc-950/40">
        <form onSubmit={handleFollowUpSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="追问或进一步要求... (Enter 发送)"
            value={followUpInput}
            onChange={(e) => setFollowUpInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 h-8 px-3 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all select-text"
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
              className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all active:scale-95 cursor-pointer"
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
