import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ProviderConfig, ApiCardConfig } from '@/types/config';
import { CardHeader } from '@/components/overlay/CardHeader';
import { TabItem } from '@/components/overlay/TabBar';
import { LoadingState } from '@/components/overlay/LoadingState';
import { ThinkingBlock } from '@/components/overlay/ThinkingBlock';
import { MarkdownContent } from '@/components/overlay/MarkdownContent';
import { StreamingCursor } from '@/components/overlay/StreamingCursor';
import { PromptBar } from '@/components/overlay/PromptBar';
import { ResponseToolbar } from '@/components/overlay/ResponseToolbar';
import { UserBubble } from '@/components/overlay/UserBubble';
import { ResizeHandle } from '@/components/overlay/ResizeHandle';
import { ContextMenu } from '@/components/overlay/ContextMenu';
import { SessionPanel } from '@/components/overlay/SessionPanel';
import { SessionStorageAlert } from '@/components/SessionStorageAlert';
import { LinkDock } from '@/components/overlay/LinkDock';
import { LinkPanel } from '@/components/overlay/LinkPanel';
import { MessageRail } from '@/components/overlay/MessageRail';
import { FloatingQuoteMenu } from '@/components/overlay/FloatingQuoteMenu';
import { DynamicIcon } from '@/components/Icons';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import type { ChatSessionsView } from '@/hooks/useChatSessions';
import type { Conversation } from '@/types/session';
import { useTranslation } from '@/hooks/useTranslation';
import { AlertCircle, ArrowDown, RotateCcw, Copy, Check, Brain, FileText, Wand2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseThinkingAndMain } from '@/lib/thinkingParser';
import { contextUsage as getContextUsage } from '@/conversation/transcript';
import { collectLinksFromRoot, linksEqual, type LinkInfo } from '@/lib/links';
import { isProviderSelectable } from '@/lib/provider';
import type { ThinkingMode } from '@/lib/reasoning';

/* ─────────────────────────────────────────────────────────
 * 流式结果卡片 (参考千问桌面端布局)
 * ───────────────────────────────────────────────────────── */

export interface ResultCardProps {
  conversation: Conversation;
  tabs: TabItem[];
  activeTabId: string;
  chatSessions: ChatSessionsView;
  providers: ProviderConfig[];
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
  onCloseLeftTabs: (id: string) => void;
  onCloseRightTabs: (id: string) => void;
  isPinned: boolean;
  isClosing?: boolean;
  apiCard?: ApiCardConfig;
  theme?: 'system' | 'dark' | 'light';
  onThemeChange?: (theme: 'system' | 'dark' | 'light') => void;
  onProviderChange?: (providerId: string) => void;
  onModelChange: (model: string) => void;
  onThinkingModeChange?: (mode: ThinkingMode) => void;
  onSendFollowUp: (prompt: string) => void;
  onEditMessage?: (turnIndex: number, prompt: string) => Promise<boolean>;
  onRegenerateCurrentTurn?: () => void;
  onNewChat?: () => void;
  onExportMarkdown?: () => void;
  onOpenSettings?: () => void;
  onCancel: () => void;
  onPinToggle: () => void;
  onClose: () => void;
  onResetSize?: () => void;
}

function getSuggestedChips(isZh: boolean) {
  if (isZh) {
    return [
      {
        label: '深度思考',
        prompt: '请开启深度思考模式，详细列出严谨的逐步推理与思考过程：',
        icon: <Brain size={13} className="text-purple-500 shrink-0" />,
      },
      {
        label: '总结要点',
        prompt: '请帮我精简总结以上内容的核心要点与主要结论：',
        icon: <FileText size={13} className="text-blue-500 shrink-0" />,
      },
      {
        label: '润色优化',
        prompt: '请帮我润色优化这段内容，使其更加地道通顺：',
        icon: <Wand2 size={13} className="text-amber-500 shrink-0" />,
      },
      {
        label: '深入解释',
        prompt: '请结合原理与背景，更详细地展开解释：',
        icon: <Sparkles size={13} className="text-emerald-500 shrink-0" />,
      },
    ];
  }

  return [
    {
      label: 'Deep Reasoning',
      prompt: 'Please use deep reasoning to systematically analyze and explain step-by-step:',
      icon: <Brain size={13} className="text-purple-500 shrink-0" />,
    },
    {
      label: 'Key Takeaways',
      prompt: 'Please summarize the key points and conclusions concisely:',
      icon: <FileText size={13} className="text-blue-500 shrink-0" />,
    },
    {
      label: 'Polish Text',
      prompt: 'Please polish and improve the fluency and clarity of this content:',
      icon: <Wand2 size={13} className="text-amber-500 shrink-0" />,
    },
    {
      label: 'Explain in Depth',
      prompt: 'Please provide an in-depth explanation with principles and context:',
      icon: <Sparkles size={13} className="text-emerald-500 shrink-0" />,
    },
  ];
}

// 辅助函数 parseThinkingAndMain 已抽取至 @/lib/thinkingParser，便于复用与测试

export const ResultCard: React.FC<ResultCardProps> = ({
  conversation,
  tabs,
  activeTabId,
  chatSessions,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseLeftTabs,
  onCloseRightTabs,
  providers,
  isPinned,
  isClosing = false,
  apiCard,
  theme = 'system',
  onThemeChange,
  onProviderChange,
  onModelChange,
  onThinkingModeChange,
  onSendFollowUp,
  onEditMessage,
  onRegenerateCurrentTurn,
  onNewChat,
  onExportMarkdown,
  onOpenSettings,
  onCancel,
  onPinToggle,
  onClose,
  onResetSize,
}) => {
  const { action, selectedModel, selectedText, initialInput, thinkingMode, error } = conversation;
  const isLoading = conversation.generation !== null;
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';
  const suggestedChips = getSuggestedChips(isZh);

  const { copied, copy } = useCopyFeedback(2000);
  const [followUpInput, setFollowUpInput] = useState(initialInput || '');
  const [editingTurnIndex, setEditingTurnIndex] = useState<number | null>(null);
  const contextUsage = useMemo(
    () => getContextUsage(conversation, followUpInput, apiCard?.contextTurns ?? 5),
    [conversation, followUpInput, apiCard?.contextTurns]
  );
  const [isThinkingOpen, setIsThinkingOpen] = useState(apiCard?.thinkingDefaultOpen ?? true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // 选中文本悬浮引用胶囊菜单状态
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // 当从外部传入初始预填引用文本时，自动设置到 followUpInput 并聚焦输入框末尾
  useEffect(() => {
    if (initialInput) {
      setFollowUpInput(initialInput);
      const focusTextarea = () => {
        if (promptInputRef.current) {
          promptInputRef.current.focus();
          const len = promptInputRef.current.value.length;
          promptInputRef.current.setSelectionRange(len, len);
        }
      };
      focusTextarea();
      const t1 = setTimeout(focusTextarea, 60);
      const t2 = setTimeout(focusTextarea, 150);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [initialInput]);
  const [quoteMenu, setQuoteMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    text: string;
  }>({
    x: 0,
    y: 0,
    visible: false,
    text: '',
  });

  const bodyRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const update = () => {
      setShowScrollToBottom(body.scrollHeight - body.scrollTop - body.clientHeight > 2);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(body);
    Array.from(body.children).forEach((child) => observer.observe(child));
    body.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      body.removeEventListener('scroll', update);
    };
  });

  // 按回答轮次保存外链，详情栏只展示用户点击的那一轮
  const [linksByTurn, setLinksByTurn] = useState<Record<string, LinkInfo[]>>({});
  const [activeLinkTurnId, setActiveLinkTurnId] = useState<string | null>(null);
  const answerLinks = activeLinkTurnId ? linksByTurn[activeLinkTurnId] || [] : [];

  // 监听划选文本以展示浮动引用胶囊 (带边缘安全夹紧防变形)
  const handleSelectionCheck = React.useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setQuoteMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    const text = sel.toString().trim();
    if (text.length >= 2 && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (bodyRef.current && bodyRef.current.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        const bodyRect = bodyRef.current.getBoundingClientRect();
        // 水平与垂直安全边界计算，防止靠右或靠顶溢出变形
        const rawX = rect.left + rect.width / 2;
        const clampedX = Math.max(bodyRect.left + 45, Math.min(rawX, bodyRect.right - 45));
        const clampedY = Math.max(bodyRect.top + 28, rect.top);
        setQuoteMenu({
          x: clampedX,
          y: clampedY,
          visible: true,
          text,
        });
        return;
      }
    }
    setQuoteMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  // 点击悬浮引用将选中文本以 Markdown 格式插入输入框
  const handleQuoteText = React.useCallback(() => {
    if (!quoteMenu.text) return;
    const quoteBlock = `> ${quoteMenu.text}\n\n`;
    setFollowUpInput((prev) => {
      if (!prev) return quoteBlock;
      return `${quoteBlock}${prev}`;
    });
    setQuoteMenu((prev) => ({ ...prev, visible: false }));
    window.getSelection()?.removeAllRanges();
    setTimeout(() => {
      promptInputRef.current?.focus();
    }, 50);
  }, [quoteMenu.text]);

  // 底部模型切换器只展示已启用的服务商配置；停用只收窄可选来源，不阻断已绑定动作的执行
  const enabledProviders = useMemo(
    () => providers.filter(isProviderSelectable),
    [providers]
  );
  const provider = enabledProviders.find((p) => p.id === action.providerId);
  const availableModels = provider?.models || [];

  // 最大化切换
  const handleToggleMaximize = async () => {
    try {
      const nextMax = await invoke<boolean>('toggle_maximize_overlay');
      setIsMaximized(nextMax);
    } catch (err) {
      console.warn('Failed to toggle maximize overlay:', err);
    }
  };

  // 右键菜单呼出
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
    });
  };

  // 重新生成处理
  const handleRegenerate = React.useCallback(() => {
    if (isLoading) return;
    if (onRegenerateCurrentTurn) {
      onRegenerateCurrentTurn();
    } else {
      onModelChange(selectedModel);
    }
  }, [isLoading, onRegenerateCurrentTurn, onModelChange, selectedModel]);

  // 监听全局 Ctrl+R 快捷重新生成
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        handleRegenerate();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleRegenerate]);

  const conversationTurns = useMemo(() => conversation.turns.map((turn) => ({
    ...turn,
    userPrompt: turn.kind === 'selection' ? '' : turn.prompt,
    rawAssistantText: turn.answer,
  })), [conversation.turns]);

  // 从各轮已渲染的正文独立收集外链，避免跨轮次混合
  useEffect(() => {
    const next: Record<string, LinkInfo[]> = {};
    bodyRef.current?.querySelectorAll<HTMLElement>('[data-answer-markdown]').forEach((root) => {
      const turnId = root.dataset.answerMarkdown;
      if (turnId) next[turnId] = collectLinksFromRoot(root);
    });
    setLinksByTurn((prev) =>
      Object.keys(prev).length === Object.keys(next).length &&
      Object.entries(next).every(([turnId, links]) => prev[turnId] && linksEqual(prev[turnId], links))
        ? prev
        : next
    );
  }, [conversation.turns, error, activeTabId]);

  // 回答被清空或切换会话后收起链接详情栏
  useEffect(() => {
    if (!answerLinks.length) setActiveLinkTurnId(null);
  }, [answerLinks.length]);

  useEffect(() => {
    setFollowUpInput(initialInput);
    setActiveLinkTurnId(null);
    setLinksByTurn({});
    setEditingTurnIndex(null);
    setContextMenu({ x: 0, y: 0, visible: false });
    setQuoteMenu({ x: 0, y: 0, visible: false, text: '' });
    isAutoScrollRef.current = true;
    // Drafts and menus belong to the visible conversation; stream updates preserve the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // 解析当前最新的思维链与正文状态
  const { thinkingText, mainText, isThinking } = useMemo(() => {
    return parseThinkingAndMain(conversation.turns[conversation.turns.length - 1]?.answer ?? '');
  }, [conversation.turns]);

  // 当处于思考中时根据配置展开，思考结束后根据配置自动收起
  const prevThinkingRef = useRef(isThinking);
  useEffect(() => {
    if (isThinking) {
      if (apiCard?.thinkingDefaultOpen ?? true) {
        setIsThinkingOpen(true);
      }
    } else if (prevThinkingRef.current && !isThinking) {
      if (apiCard?.autoCollapseThinkingOnDone ?? true) {
        setIsThinkingOpen(false);
      }
    }
    prevThinkingRef.current = isThinking;
  }, [isThinking, apiCard?.thinkingDefaultOpen, apiCard?.autoCollapseThinkingOnDone]);

  // 每轮回答默认跟随最新内容，滚轮操作只暂停当前这一轮。
  useEffect(() => {
    if (isLoading) isAutoScrollRef.current = true;
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) return;
    // 等本帧正文、链接条等布局完成，再把最新生成的位置带入视野。
    const frame = requestAnimationFrame(() => {
      if (bodyRef.current && isAutoScrollRef.current) {
        const thinkingContent = bodyRef.current.querySelector<HTMLElement>('[data-thinking-content="true"]');
        if (thinkingContent) thinkingContent.scrollTop = thinkingContent.scrollHeight;
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [conversation.turns, isLoading, thinkingText, isThinkingOpen, linksByTurn]);

  const handleWheel = (event: React.WheelEvent) => {
    if (event.deltaX || event.deltaY) isAutoScrollRef.current = false;
  };

  const handleScrollToBottom = () => {
    const body = bodyRef.current;
    if (!body) return;
    isAutoScrollRef.current = true;
    body.scrollTo({
      top: body.scrollHeight,
      behavior: isLoading || window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  };

  const handleFollowUpSubmit = (prompt: string) => {
    if (!prompt.trim() || isLoading) return;
    onSendFollowUp(prompt);
    setFollowUpInput('');
    isAutoScrollRef.current = true;
  };

  const handleToggleThinking = () => {
    setIsThinkingOpen((prev) => !prev);
  };

  const handleEditSubmit = async (turnIndex: number, prompt: string) => {
    if (!onEditMessage || isLoading || !prompt.trim() || !selectedModel.trim()) return;
    setActiveLinkTurnId(null);
    isAutoScrollRef.current = true;
    if (await onEditMessage(turnIndex, prompt)) setEditingTurnIndex(null);
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'relative flex flex-col w-full h-full transition-all duration-200 ease-out',
        // 使用不透明背景并移除 backdrop-blur / 外阴影，与 Web 卡片保持一致；
        // 悬浮窗尺寸与卡片一致，外阴影会被窗口边缘裁切成一圈灰色硬边
        'bg-[#fcfcfd] dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100',
        isMaximized
          ? 'rounded-none border-none'
          : 'rounded-[var(--ui-card-radius)] border border-black/10 dark:border-white/10',
        'overflow-hidden',
        isClosing
          ? 'animate-capsule-out'
          : 'animate-in fade-in zoom-in-95 duration-150'
      )}
    >
      {/* 1. 极简卡片头部导航 */}
      <CardHeader
        icon={action.icon}
        title={action.name}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseLeftTabs={onCloseLeftTabs}
        onCloseRightTabs={onCloseRightTabs}
        onNewTab={onNewChat}
        onNewChat={onNewChat}
        onToggleSessions={chatSessions.togglePanel}
        tools={
          mainText ? (
            <button
              type="button"
              onClick={() => copy(mainText)}
              onMouseDown={(e) => e.stopPropagation()}
              className="mr-0.5 flex size-7 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-100 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 active:scale-95 cursor-pointer"
              title={t('card.copyFullResponse')}
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
        isMaximized={isMaximized}
        onPinToggle={onPinToggle}
        onToggleMaximize={handleToggleMaximize}
        onClose={onClose}
        onMinimize={onClose}
      />

      {!chatSessions.isPanelOpen && <SessionStorageAlert error={chatSessions.storageError} />}

      {/* 2. 正文与对话流内容区 */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={bodyRef}
          onContextMenu={handleContextMenu}
          onWheelCapture={handleWheel}
          onMouseUp={handleSelectionCheck}
          onKeyUp={handleSelectionCheck}
          style={{ fontSize: `${apiCard?.fontSize || 13}px` }}
          className="h-full overflow-y-auto px-3.5 pt-3 pb-12 text-ink select-text custom-scrollbar"
        >
        {/* 初始用户选中文本气泡 (如果存在) */}
        {selectedText && (
          <UserBubble
            content={selectedText}
            isInitialContext={true}
            isEditing={editingTurnIndex === 0}
            editDisabled={isLoading}
            sendKeyShortcut={apiCard?.sendKeyShortcut}
            onStartEdit={onEditMessage ? () => setEditingTurnIndex(0) : undefined}
            onCancelEdit={() => setEditingTurnIndex(null)}
            onSubmitEdit={(prompt) => { void handleEditSubmit(0, prompt); }}
          />
        )}

        {conversationTurns.length === 0 && !isLoading && !error ? (
          /* 聚焦型新对话欢迎看板 (Empty State) */
          <div className="flex flex-col items-center justify-center h-full min-h-[220px] px-4 py-8 text-center select-none animate-in fade-in zoom-in-95 duration-200">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs mb-3">
              <DynamicIcon
                name={action.icon}
                size={24}
                className="text-primary dark:text-blue-400"
              />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              {isZh ? `开启与 ${action.name} 的新会话` : `Start a new chat with ${action.name}`}
            </h3>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 max-w-xs mb-4 leading-relaxed">
              {isZh ? '在下方输入框输入问题，或点击以下常用提示词快捷发起' : 'Type a question below or choose a prompt to start'}
            </p>

            {/* 快捷推荐提示词芯片 */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-sm">
              {suggestedChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setFollowUpInput(chip.prompt);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11.5px] font-medium bg-zinc-100/90 dark:bg-zinc-800/90 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 transition-all cursor-pointer hover:scale-102 active:scale-98"
                >
                  {chip.icon}
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : conversationTurns.length > 0 ? (
          /* 正常对话流渲染 */
          <div className="flex flex-col gap-3">
            {conversationTurns.map((turn, index) => {
              const isLast = index === conversationTurns.length - 1;
              const {
                thinkingText: turnThinking,
                mainText: turnMain,
                isThinking: turnIsThinking,
              } = parseThinkingAndMain(turn.rawAssistantText);

              const displayTurnModel = turn.model;
              const displayTurnDuration = turn.duration;

              return (
                <div key={turn.id} className="flex flex-col gap-1.5">
                  {/* 用户追问气泡 */}
                  {turn.userPrompt && (
                    <UserBubble
                      content={turn.userPrompt}
                      isEditing={editingTurnIndex === index}
                      editDisabled={isLoading}
                      sendKeyShortcut={apiCard?.sendKeyShortcut}
                      onStartEdit={onEditMessage ? () => setEditingTurnIndex(index) : undefined}
                      onCancelEdit={() => setEditingTurnIndex(null)}
                      onSubmitEdit={(prompt) => { void handleEditSubmit(index, prompt); }}
                    />
                  )}

                  {/* BUI Section 轮次块 */}
                  {(turnThinking || turnMain || turnIsThinking || isLast) && (
                    <div className="flex flex-col">
                      {/* Section 头部 — 动作名 + 该轮对应的真实模型快照 + 耗时 */}
                      <div className="mb-1 flex items-center gap-1.5 text-[12px] leading-[1.3] select-none">
                        <DynamicIcon
                          name={action.icon}
                          size={13}
                          className="shrink-0 text-ink-3"
                        />
                        <span className="font-medium text-ink">{action.name}</span>
                        {displayTurnModel && (
                          <span className="max-w-44 truncate text-ink-3">
                            {displayTurnModel}
                          </span>
                        )}
                        {displayTurnDuration !== undefined && (apiCard?.showDuration ?? true) && (
                          <span className="font-mono text-ink-3 tabular-nums">
                            for {displayTurnDuration.toFixed(1)}s
                          </span>
                        )}
                      </div>

                      {/* 思维链折叠组件 */}
                      {(turnThinking || turnIsThinking) && (
                        <ThinkingBlock
                          thinkingText={turnThinking}
                          isThinking={turnIsThinking}
                          isOpen={isThinkingOpen}
                          autoCollapseOnDone={apiCard?.autoCollapseThinkingOnDone ?? true}
                          onToggleOpen={handleToggleThinking}
                        />
                      )}

                      {/* Markdown 正文 */}
                      {turnMain && (
                        <div className="relative" data-answer-markdown={turn.id}>
                          <MarkdownContent
                            content={turnMain}
                            codeBlockWrap={apiCard?.codeBlockWrap}
                            codeBlockLineNumbers={apiCard?.codeBlockLineNumbers}
                          />
                          <StreamingCursor
                            active={isLoading && isLast && !turnIsThinking}
                            className="text-primary"
                          />
                        </div>
                      )}

                      {isLast && isLoading && !turnThinking && !turnMain && !turnIsThinking && (
                        <LoadingState onCancel={onCancel} />
                      )}

                      {/* 最后一轮完成时的结果工具栏 */}
                      {isLast && !isLoading && turnMain && (
                        <ResponseToolbar
                          text={turnMain}
                          durationSeconds={apiCard?.showDuration !== false ? displayTurnDuration : undefined}
                          hasThinking={Boolean(turnThinking)}
                          isThinkingOpen={isThinkingOpen}
                          onToggleThinking={handleToggleThinking}
                          onCopy={() => copy(turnMain)}
                          isCopied={copied}
                          onRegenerate={handleRegenerate}
                        />
                      )}

                      {(linksByTurn[turn.id]?.length ?? 0) > 0 && (
                        <LinkDock
                          links={linksByTurn[turn.id]}
                          onOpen={() => setActiveLinkTurnId(turn.id)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : isLoading ? (
          /* 首字等待 — 仅在 isLoading === true 且 streamText 为空时展示 */
          <div className="pt-1.5">
            <LoadingState onCancel={onCancel} />
          </div>
        ) : null}
        {error && (
          /* BUI 错误提示卡 */
          <div className="flex flex-col gap-2 rounded-[10px] border border-red-500/20 bg-red-500/5 p-3 text-red-600 dark:text-red-400 animate-fade-up">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <AlertCircle size={14} className="shrink-0" />
              <span>{t('card.errorOccurred')}</span>
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
                <span>{t('card.retry')}</span>
              </button>
              <button
                type="button"
                onClick={() => copy(error)}
                className="inline-flex h-6 items-center gap-1 rounded-[6px] bg-field px-2 text-[11.5px] text-ink-2 transition-colors duration-100 hover:bg-hover hover:text-ink active:scale-[0.96] cursor-pointer"
              >
                <Copy size={11} />
                <span>{t('card.copyError')}</span>
              </button>
            </div>
          </div>

        )}
        </div>

        <MessageRail
          scrollRef={bodyRef}
          refreshKey={`${conversation.turns.length}:${conversation.turns[conversation.turns.length - 1]?.answer.length ?? 0}:${selectedText.length}:${activeTabId}`}
        />
        {showScrollToBottom && <button
          type="button"
          onClick={handleScrollToBottom}
          title={isZh ? '回到底部' : 'Scroll to bottom'}
          aria-label={isZh ? '回到底部' : 'Scroll to bottom'}
          className="absolute bottom-3 right-4 z-20 flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-md transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 cursor-pointer"
        >
          <ArrowDown size={16} strokeWidth={2} />
        </button>}
      </div>

      {/* 3. 样图风格独立胶囊提问栏 */}
      <PromptBar
        value={followUpInput}
        onChange={setFollowUpInput}
        onSubmit={handleFollowUpSubmit}
        onCancel={onCancel}
        isLoading={isLoading}
        disabled={Boolean(error)}
        title={action.name || 'AI'}
        providers={enabledProviders}
        selectedProviderId={action.providerId}
        selectedModel={selectedModel}
        availableModels={availableModels}
        thinkingMode={thinkingMode}
        sendKeyShortcut={apiCard?.sendKeyShortcut}
        contextUsage={contextUsage}
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
        onThinkingModeChange={onThinkingModeChange}
        inputRef={promptInputRef}
      />

      {/* 4. 选中文本悬浮引用胶囊 */}
      <FloatingQuoteMenu
        x={quoteMenu.x}
        y={quoteMenu.y}
        visible={quoteMenu.visible}
        onQuote={handleQuoteText}
      />

      {/* 5. 右下角原生缩放手柄 */}
      <ResizeHandle onReset={onResetSize} />

      {/* 5. 极简 macOS 风格自定义右键菜单 */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        visible={contextMenu.visible}
        hasSelectionText={Boolean(selectedText || window.getSelection()?.toString())}
        hasAnswerText={conversation.turns.some((turn) => Boolean(turn.answer))}
        isPinned={isPinned}
        isMaximized={isMaximized}
        currentTheme={theme}
        onThemeChange={onThemeChange}
        onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
        onCopySelection={() => {
          const sel = window.getSelection()?.toString() || selectedText;
          if (sel) copy(sel);
        }}
        onCopyCurrentAnswer={() => {
          if (mainText) copy(mainText);
        }}
        onCopyAllMarkdown={onExportMarkdown}
        onRegenerateCurrent={handleRegenerate}
        onNewChat={chatSessions.handleNewSession}
        onTogglePin={onPinToggle}
        onToggleMaximize={handleToggleMaximize}
        onResetSize={onResetSize}
        onOpenSettings={onOpenSettings}
      />

      {/* 6. 回答链接详情栏 */}
      <LinkPanel
        isOpen={activeLinkTurnId !== null && answerLinks.length > 0}
        links={answerLinks}
        onClose={() => setActiveLinkTurnId(null)}
      />

      {/* 7. 多会话历史侧滑面板 */}
      <SessionPanel
        storageError={chatSessions.storageError}
        historyLoaded={chatSessions.historyLoaded}
        isOpen={chatSessions.isPanelOpen}
        sessions={chatSessions.sessions}
        currentSessionId={chatSessions.currentSessionId}
        onClose={() => chatSessions.setIsPanelOpen(false)}
        onSelectSession={chatSessions.handleSwitchSession}
        onNewSession={chatSessions.handleNewSession}
        onDeleteSession={chatSessions.handleDeleteSession}
      />
    </div>
  );
};
