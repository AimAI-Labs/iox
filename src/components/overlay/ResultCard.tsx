import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { ActionConfig, ProviderConfig } from '@/types/config';
import { CardHeader } from '@/components/overlay/CardHeader';
import { LoadingState } from '@/components/overlay/LoadingState';
import { ThinkingBlock } from '@/components/overlay/ThinkingBlock';
import { CodeBlock } from '@/components/overlay/CodeBlock';
import { PromptBar } from '@/components/overlay/PromptBar';
import { ResponseToolbar } from '@/components/overlay/ResponseToolbar';
import { UserBubble } from '@/components/overlay/UserBubble';
import { ResizeHandle } from '@/components/overlay/ResizeHandle';
import { DynamicIcon } from '@/components/Icons';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { AlertCircle, RotateCcw, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * 流式结果卡片 (参考千问桌面端布局)
 * ───────────────────────────────────────────────────────── */

export interface ResultCardProps {
  action: ActionConfig;
  providers: ProviderConfig[];
  selectedModel: string;
  streamText: string;
  selectedText?: string;
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

// 辅助函数：解析思维链 (<think>...</think>) 与正文内容
function parseThinkingAndMain(text: string) {
  if (!text) {
    return { thinkingText: '', mainText: '', isThinking: false };
  }

  const openTag = '<think>';
  const closeTag = '</think>';
  const openIndex = text.indexOf(openTag);

  if (openIndex === -1) {
    return { thinkingText: '', mainText: text, isThinking: false };
  }

  const closeIndex = text.indexOf(closeTag, openIndex);

  if (closeIndex === -1) {
    // 思考中，标签尚未闭合
    const thinking = text.slice(openIndex + openTag.length);
    const prefix = text.slice(0, openIndex);
    return { thinkingText: thinking, mainText: prefix, isThinking: true };
  }

  // 思考已闭合
  const thinking = text.slice(openIndex + openTag.length, closeIndex);
  const main = text.slice(0, openIndex) + text.slice(closeIndex + closeTag.length);
  return { thinkingText: thinking, mainText: main.trimStart(), isThinking: false };
}

export const ResultCard: React.FC<ResultCardProps> = ({
  action,
  providers,
  selectedModel,
  streamText,
  selectedText = '',
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
  const [isThinkingOpen, setIsThinkingOpen] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

  // 耗时计时
  const [totalDuration, setTotalDuration] = useState<number | undefined>(undefined);
  const requestStartTimeRef = useRef<number | null>(null);

  const provider = providers.find((p) => p.id === action.providerId);
  const availableModels = provider?.models || [];

  // 监听请求起止以计算总耗时
  useEffect(() => {
    if (isLoading) {
      if (requestStartTimeRef.current === null) {
        requestStartTimeRef.current = Date.now();
      }
      setTotalDuration(undefined);
    } else if (requestStartTimeRef.current !== null) {
      const sec = ((Date.now() - requestStartTimeRef.current) / 1000).toFixed(1);
      setTotalDuration(parseFloat(sec));
      requestStartTimeRef.current = null;
    }
  }, [isLoading]);

  // 解析当前最新的思维链与正文状态
  const { thinkingText, mainText, isThinking } = useMemo(() => {
    return parseThinkingAndMain(streamText);
  }, [streamText]);

  // 当处于思考中时自动保持展开，思考结束后自动收起
  const prevThinkingRef = useRef(isThinking);
  useEffect(() => {
    if (isThinking) {
      setIsThinkingOpen(true);
    } else if (prevThinkingRef.current && !isThinking) {
      setIsThinkingOpen(false);
    }
    prevThinkingRef.current = isThinking;
  }, [isThinking]);

  // 结构化多轮对话气泡流 (Conversation Turns)
  const conversationTurns = useMemo(() => {
    const parts = streamText.split(/\n\n---\n\*\*追问：\*\*\s*/);
    if (parts.length <= 1) {
      return [
        {
          id: 'turn-0',
          userPrompt: '',
          rawAssistantText: streamText,
        },
      ];
    }

    return parts.map((part, index) => {
      if (index === 0) {
        return {
          id: 'turn-0',
          userPrompt: '',
          rawAssistantText: part,
        };
      }
      const firstNewline = part.indexOf('\n\n');
      if (firstNewline === -1) {
        return {
          id: `turn-${index}`,
          userPrompt: part.trim(),
          rawAssistantText: '',
        };
      }
      return {
        id: `turn-${index}`,
        userPrompt: part.slice(0, firstNewline).trim(),
        rawAssistantText: part.slice(firstNewline + 2),
      };
    });
  }, [streamText]);

  // 智能自动滚屏
  useEffect(() => {
    if (bodyRef.current && isAutoScrollRef.current && isLoading) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [streamText, isLoading, thinkingText, isThinkingOpen]);

  const handleScroll = () => {
    if (!bodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.current;
    // 如果用户距离底部超过 40px，则暂停自动滚动
    isAutoScrollRef.current = scrollHeight - (scrollTop + clientHeight) < 40;
  };

  const handleFollowUpSubmit = (prompt: string) => {
    if (!prompt.trim() || isLoading) return;
    onSendFollowUp(prompt);
    setFollowUpInput('');
    isAutoScrollRef.current = true;
  };

  const handleRegenerate = () => {
    if (isLoading) return;
    onModelChange(selectedModel);
  };

  const handleToggleThinking = () => {
    setIsThinkingOpen((prev) => !prev);
  };

  return (
    <div
      className={cn(
        'relative flex flex-col w-full h-full select-none',
        'bg-[#fcfcfd]/95 dark:bg-[#18181b]/95 text-zinc-900 dark:text-zinc-100 backdrop-blur-2xl',
        'rounded-[20px] overflow-hidden shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80',
        isClosing
          ? 'animate-capsule-out'
          : 'animate-in fade-in zoom-in-95 duration-150'
      )}
    >
      {/* 1. 样图风格极简卡片头部 */}
      <CardHeader
        icon={action.icon}
        title={action.name}
        tools={
          mainText ? (
            <button
              type="button"
              onClick={() => copy(mainText)}
              onMouseDown={(e) => e.stopPropagation()}
              className="mr-0.5 flex size-7 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-100 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 active:scale-95 cursor-pointer"
              title="复制完整回答"
            >
              {copied ? (
                <Check size={14} className="text-emerald-600" />
              ) : (
                <Copy size={14} strokeWidth={1.8} />
              )}
            </button>
          ) : undefined
        }
        isPinned={isPinned}
        onPinToggle={onPinToggle}
        onClose={onClose}
      />


      {/* 2. 正文与对话流内容区 */}
      <div
        ref={bodyRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3.5 pt-3 pb-2 text-[13px] text-ink select-text custom-scrollbar"
      >
        {/* 初始用户选中文本气泡 (如果存在) */}
        {selectedText && (
          <UserBubble content={selectedText} isInitialContext={true} />
        )}

        {error ? (
          /* BUI 错误提示卡 */
          <div className="flex flex-col gap-2 rounded-[10px] border border-red-500/20 bg-red-500/5 p-3 text-red-600 dark:text-red-400 animate-fade-up">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <AlertCircle size={14} className="shrink-0" />
              <span>请求发生异常</span>
            </div>
            <p className="pl-6 text-[12px] leading-relaxed break-words opacity-90">
              {error}
            </p>
            <div className="flex items-center gap-1.5 pl-6">
              <button
                type="button"
                onClick={handleRegenerate}
                className="inline-flex h-6 items-center gap-1 rounded-[6px] bg-red-500/90 px-2 text-[11.5px] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-red-500 active:scale-[0.96] cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>重试</span>
              </button>
              <button
                type="button"
                onClick={() => copy(error)}
                className="inline-flex h-6 items-center gap-1 rounded-[6px] bg-field px-2 text-[11.5px] text-ink-2 transition-colors duration-100 hover:bg-hover hover:text-ink active:scale-[0.96] cursor-pointer"
              >
                <Copy size={11} />
                <span>复制错误信息</span>
              </button>
            </div>
          </div>
        ) : streamText ? (
          /* 正常对话流渲染 */
          <div className="flex flex-col gap-3">
            {conversationTurns.map((turn, index) => {
              const isLast = index === conversationTurns.length - 1;
              const {
                thinkingText: turnThinking,
                mainText: turnMain,
                isThinking: turnIsThinking,
              } = parseThinkingAndMain(turn.rawAssistantText);

              return (
                <div key={turn.id} className="flex flex-col gap-1.5">
                  {/* 用户追问气泡 */}
                  {turn.userPrompt && (
                    <UserBubble content={turn.userPrompt} />
                  )}

                  {/* BUI Section 轮次块 */}
                  {(turnThinking || turnMain || turnIsThinking || isLast) && (
                    <div className="flex flex-col">
                      {/* Section 头部 — 动作名 + 模型 + 耗时 */}
                      <div className="mb-1 flex items-center gap-1.5 text-[12px] leading-[1.3] select-none">
                        <DynamicIcon
                          name={action.icon}
                          size={13}
                          className="shrink-0 text-ink-3"
                        />
                        <span className="font-medium text-ink">{action.name}</span>
                        {selectedModel && (
                          <span className="max-w-44 truncate text-ink-3">
                            {selectedModel}
                          </span>
                        )}
                        {isLast && !isLoading && totalDuration !== undefined && (
                          <span className="font-mono text-ink-3 tabular-nums">
                            for {totalDuration.toFixed(1)}s
                          </span>
                        )}
                      </div>

                      {/* 思维链折叠组件 */}
                      {(turnThinking || turnIsThinking) && (
                        <ThinkingBlock
                          thinkingText={turnThinking}
                          isThinking={turnIsThinking}
                          isOpen={isThinkingOpen}
                          onToggleOpen={handleToggleThinking}
                        />
                      )}

                      {/* Markdown 正文 */}
                      {turnMain && (
                        <div className="markdown-body">
                          <ReactMarkdown
                            components={{
                              code: CodeBlock as any,
                              pre: ({ children }: any) => <>{children}</>,
                            }}
                          >
                            {turnMain}
                          </ReactMarkdown>
                          {isLoading && isLast && !turnIsThinking && (
                            <span className="ml-0.5 inline-block h-3.5 w-[3px] translate-y-0.5 rounded-full bg-primary align-middle animate-pulse" />
                          )}
                        </div>
                      )}

                      {/* 最后一轮完成时的结果工具栏 */}
                      {isLast && !isLoading && turnMain && (
                        <ResponseToolbar
                          text={turnMain}
                          durationSeconds={totalDuration}
                          hasThinking={Boolean(turnThinking)}
                          isThinkingOpen={isThinkingOpen}
                          onToggleThinking={handleToggleThinking}
                          onCopy={() => copy(turnMain)}
                          isCopied={copied}
                          onRegenerate={handleRegenerate}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* 首字等待 — BUI Pixel-Grid LoadingState */
          <div className="pt-1.5">
            <LoadingState label="AI 正在深入思考分析中..." />
          </div>
        )}
      </div>

      {/* 3. 样图风格独立胶囊提问栏 */}
      <PromptBar
        value={followUpInput}
        onChange={setFollowUpInput}
        onSubmit={handleFollowUpSubmit}
        onCancel={onCancel}
        isLoading={isLoading}
        disabled={Boolean(error)}
        title={action.name || '千问'}
        selectedModel={selectedModel}
        availableModels={availableModels}
        onModelChange={onModelChange}
        onRegenerate={handleRegenerate}
      />

      {/* 4. 右下角原生缩放手柄 */}
      <ResizeHandle />
    </div>
  );
};
