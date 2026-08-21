import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { invoke } from '@tauri-apps/api/core';
import { ActionConfig, ProviderConfig, ApiCardConfig } from '@/types/config';
import { CardHeader } from '@/components/overlay/CardHeader';
import { TabItem } from '@/components/overlay/TabBar';
import { LoadingState } from '@/components/overlay/LoadingState';
import { ThinkingBlock } from '@/components/overlay/ThinkingBlock';
import { CodeBlock } from '@/components/overlay/CodeBlock';
import { PromptBar } from '@/components/overlay/PromptBar';
import { ResponseToolbar } from '@/components/overlay/ResponseToolbar';
import { UserBubble } from '@/components/overlay/UserBubble';
import { ResizeHandle } from '@/components/overlay/ResizeHandle';
import { ContextMenu } from '@/components/overlay/ContextMenu';
import { SessionPanel } from '@/components/overlay/SessionPanel';
import { FloatingQuoteMenu } from '@/components/overlay/FloatingQuoteMenu';
import { DynamicIcon } from '@/components/Icons';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { useChatSessions } from '@/hooks/useChatSessions';
import { AlertCircle, RotateCcw, Copy, Check, Brain, FileText, Wand2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseThinkingAndMain } from '@/lib/thinkingParser';

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
  apiCard?: ApiCardConfig;
  theme?: 'system' | 'dark' | 'light';
  thinkingMode?: 'quick' | 'deep';
  onThemeChange?: (theme: 'system' | 'dark' | 'light') => void;
  onProviderChange?: (providerId: string) => void;
  onModelChange: (model: string) => void;
  onThinkingModeChange?: (mode: 'quick' | 'deep') => void;
  onSendFollowUp: (prompt: string) => void;
  onRegenerateCurrentTurn?: () => void;
  onNewChat?: () => void;
  onRestoreSession?: (text: string, model?: string, providerId?: string) => void;
  onExportMarkdown?: () => void;
  onOpenSettings?: () => void;
  onCancel: () => void;
  onPinToggle: () => void;
  onClose: () => void;
  onResetSize?: () => void;
}

const SUGGESTED_CHIPS = [
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

// 辅助函数 parseThinkingAndMain 已抽取至 @/lib/thinkingParser，便于复用与测试

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
  apiCard,
  theme = 'system',
  thinkingMode = 'quick',
  onThemeChange,
  onProviderChange,
  onModelChange,
  onThinkingModeChange,
  onSendFollowUp,
  onRegenerateCurrentTurn,
  onNewChat,
  onRestoreSession,
  onExportMarkdown,
  onOpenSettings,
  onCancel,
  onPinToggle,
  onClose,
  onResetSize,
}) => {
  const { copied, copy } = useCopyFeedback(2000);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isThinkingOpen, setIsThinkingOpen] = useState(apiCard?.thinkingDefaultOpen ?? true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // 选中文本悬浮引用胶囊菜单状态
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
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

  // 记录每个会话轮次对应的模型名称与独立耗时快照 (解耦全局 selectedModel)
  const [turnSnapshots, setTurnSnapshots] = useState<
    Record<string, { model: string; duration?: number }>
  >({});

  // 顶部原生多会话 Tab 列表
  const [tabs, setTabs] = useState<TabItem[]>(() => [
    {
      id: `tab_init_${Date.now()}`,
      title: action.name || '新对话',
      actionId: action.id,
      providerId: action.providerId,
      model: selectedModel || 'default',
      selectedText,
      streamText,
      isLoading,
      turnSnapshots: {},
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || 'tab_init');

  // 记录上一次激活的 Tab ID，用于在切换/新建 Tab 时精准阻断跨会话陈旧数据污染
  const lastActiveTabIdRef = useRef<string>(activeTabId);

  // 当当前活动 Tab 的 streamText / selectedText / isLoading / turnSnapshots 变化时，实时同步到 tabs 数组中
  useEffect(() => {
    // 若当前 render 是由于用户切换/新建 Tab 触发的，不使用上一个 Tab 的旧 props 覆写当前 Tab
    if (activeTabId !== lastActiveTabIdRef.current) {
      lastActiveTabIdRef.current = activeTabId;
      return;
    }

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === activeTabId) {
          return {
            ...t,
            streamText,
            selectedText,
            isLoading,
            model: selectedModel,
            turnSnapshots,
          };
        }
        return t;
      })
    );
  }, [activeTabId, streamText, selectedText, isLoading, selectedModel, turnSnapshots]);

  // 新建 Tab
  const handleNewTab = React.useCallback(() => {
    const newId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newTab: TabItem = {
      id: newId,
      title: '新对话',
      actionId: action.id,
      providerId: action.providerId,
      model: selectedModel || 'default',
      selectedText: '',
      streamText: '',
      isLoading: false,
      turnSnapshots: {},
    };
    lastActiveTabIdRef.current = newId;
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setTurnSnapshots({});
    setTotalDuration(undefined);
    setFollowUpInput('');
    onNewChat?.();
  }, [action.id, action.providerId, selectedModel, onNewChat]);

  // 切换 Tab
  const handleSelectTab = React.useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) return;
      const target = tabs.find((t) => t.id === tabId);
      if (!target) return;

      lastActiveTabIdRef.current = tabId;
      setActiveTabId(tabId);
      setFollowUpInput('');
      setTurnSnapshots(target.turnSnapshots || {});
      setTotalDuration(undefined);
      onRestoreSession?.(target.streamText, target.model, target.providerId);
    },
    [activeTabId, tabs, onRestoreSession]
  );

  // 关闭单 Tab
  const handleCloseTab = React.useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) {
          const newId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          lastActiveTabIdRef.current = newId;
          setActiveTabId(newId);
          setTurnSnapshots({});
          setTotalDuration(undefined);
          setFollowUpInput('');
          onNewChat?.();
          return [
            {
              id: newId,
              title: '新对话',
              actionId: action.id,
              providerId: action.providerId,
              model: selectedModel || 'default',
              selectedText: '',
              streamText: '',
              isLoading: false,
              turnSnapshots: {},
            },
          ];
        }

        const remaining = prev.filter((t) => t.id !== tabId);
        if (tabId === activeTabId) {
          const nextActive = remaining[0];
          lastActiveTabIdRef.current = nextActive.id;
          setActiveTabId(nextActive.id);
          setTurnSnapshots(nextActive.turnSnapshots || {});
          setTotalDuration(undefined);
          setFollowUpInput('');
          onRestoreSession?.(nextActive.streamText, nextActive.model, nextActive.providerId);
        }
        return remaining;
      });
    },
    [activeTabId, action.id, action.providerId, selectedModel, onNewChat, onRestoreSession]
  );

  // 关闭其他 Tab
  const handleCloseOtherTabs = React.useCallback(
    (targetId: string) => {
      const target = tabs.find((t) => t.id === targetId);
      if (!target) return;

      setTabs([target]);
      if (activeTabId !== targetId) {
        lastActiveTabIdRef.current = targetId;
        setActiveTabId(targetId);
        setTurnSnapshots(target.turnSnapshots || {});
        setTotalDuration(undefined);
        setFollowUpInput('');
        onRestoreSession?.(target.streamText, target.model, target.providerId);
      }
    },
    [tabs, activeTabId, onRestoreSession]
  );

  // 关闭左侧 Tab
  const handleCloseLeftTabs = React.useCallback(
    (targetId: string) => {
      const targetIdx = tabs.findIndex((t) => t.id === targetId);
      if (targetIdx <= 0) return;

      const remaining = tabs.slice(targetIdx);
      setTabs(remaining);

      // 如果当前活跃 Tab 位于被关闭的左侧区域，切换至目标 Tab
      const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
      if (activeIdx < targetIdx) {
        const target = tabs[targetIdx];
        lastActiveTabIdRef.current = target.id;
        setActiveTabId(target.id);
        setTurnSnapshots(target.turnSnapshots || {});
        setTotalDuration(undefined);
        setFollowUpInput('');
        onRestoreSession?.(target.streamText, target.model, target.providerId);
      }
    },
    [tabs, activeTabId, onRestoreSession]
  );

  // 关闭右侧 Tab
  const handleCloseRightTabs = React.useCallback(
    (targetId: string) => {
      const targetIdx = tabs.findIndex((t) => t.id === targetId);
      if (targetIdx >= tabs.length - 1 || targetIdx === -1) return;

      const remaining = tabs.slice(0, targetIdx + 1);
      setTabs(remaining);

      // 如果当前活跃 Tab 位于被关闭的右侧区域，切换至目标 Tab
      const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
      if (activeIdx > targetIdx) {
        const target = tabs[targetIdx];
        lastActiveTabIdRef.current = target.id;
        setActiveTabId(target.id);
        setTurnSnapshots(target.turnSnapshots || {});
        setTotalDuration(undefined);
        setFollowUpInput('');
        onRestoreSession?.(target.streamText, target.model, target.providerId);
      }
    },
    [tabs, activeTabId, onRestoreSession]
  );

  // 多会话管理 Hook
  const chatSessions = useChatSessions({
    activeAction: action,
    selectedModel,
    selectedText,
    streamText,
    isLoading,
    onRestoreSession: (saved) => {
      setTurnSnapshots({
        'turn-0': { model: saved.model },
      });
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                title: saved.title || '历史会话',
                streamText: saved.streamText,
                model: saved.model,
                providerId: saved.providerId,
              }
            : t
        )
      );
      onRestoreSession?.(saved.streamText, saved.model, saved.providerId);
    },
    onResetToNewChat: () => {
      setTurnSnapshots({});
      setTotalDuration(undefined);
      setFollowUpInput('');
      onNewChat?.();
    },
  });

  const bodyRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

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

  // 耗时计时
  const [totalDuration, setTotalDuration] = useState<number | undefined>(undefined);
  const requestStartTimeRef = useRef<number | null>(null);

  const provider = providers.find((p) => p.id === action.providerId);
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

  // 监听请求起止以计算总耗时并快照记录本轮的模型与耗时
  useEffect(() => {
    const currentTurnId = `turn-${Math.max(0, conversationTurns.length - 1)}`;
    if (isLoading) {
      if (requestStartTimeRef.current === null) {
        requestStartTimeRef.current = Date.now();
      }
      setTotalDuration(undefined);
      setTurnSnapshots((prev) => ({
        ...prev,
        [currentTurnId]: {
          model: prev[currentTurnId]?.model || selectedModel,
          duration: prev[currentTurnId]?.duration,
        },
      }));
    } else if (requestStartTimeRef.current !== null) {
      const sec = parseFloat(((Date.now() - requestStartTimeRef.current) / 1000).toFixed(1));
      setTotalDuration(sec);
      requestStartTimeRef.current = null;
      setTurnSnapshots((prev) => ({
        ...prev,
        [currentTurnId]: {
          model: prev[currentTurnId]?.model || selectedModel,
          duration: sec,
        },
      }));
    }
  }, [isLoading, selectedModel, conversationTurns.length]);

  // 解析当前最新的思维链与正文状态
  const { thinkingText, mainText, isThinking } = useMemo(() => {
    return parseThinkingAndMain(streamText);
  }, [streamText]);

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
    const trimmed = prompt.trim();
    // 提交问题时，若当前标签页仍为默认「新对话」或动作名，即时将标题设定为问题内容
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId && (!t.title || t.title === '新对话' || t.title === action.name)
          ? { ...t, title: trimmed.slice(0, 12) }
          : t
      )
    );
    onSendFollowUp(trimmed);
    setFollowUpInput('');
    isAutoScrollRef.current = true;
  };

  const handleToggleThinking = () => {
    setIsThinkingOpen((prev) => !prev);
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'relative flex flex-col w-full h-full transition-all duration-200 ease-out',
        'bg-[#fcfcfd]/95 dark:bg-[#18181b]/95 text-zinc-900 dark:text-zinc-100 backdrop-blur-2xl',
        isMaximized
          ? 'rounded-none shadow-none border-none'
          : 'rounded-[20px] shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80',
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
        sessionCount={chatSessions.sessions.length}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onCloseOtherTabs={handleCloseOtherTabs}
        onCloseLeftTabs={handleCloseLeftTabs}
        onCloseRightTabs={handleCloseRightTabs}
        onNewTab={handleNewTab}
        onNewChat={handleNewTab}
        onToggleSessions={chatSessions.togglePanel}
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
        isMaximized={isMaximized}
        onPinToggle={onPinToggle}
        onToggleMaximize={handleToggleMaximize}
        onClose={onClose}
        onMinimize={onClose}
        onResetSize={onResetSize}
      />

      {/* 2. 正文与对话流内容区 */}
      <div
        ref={bodyRef}
        onContextMenu={handleContextMenu}
        onScroll={handleScroll}
        onMouseUp={handleSelectionCheck}
        onKeyUp={handleSelectionCheck}
        style={{ fontSize: `${apiCard?.fontSize || 13}px` }}
        className="flex-1 min-h-0 overflow-y-auto px-3.5 pt-3 pb-2 text-ink select-text custom-scrollbar"
      >
        {/* 初始用户选中文本气泡 (如果存在) */}
        {selectedText && (
          <UserBubble content={selectedText} isInitialContext={true} />
        )}

        {!streamText && !selectedText && !isLoading ? (
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
              开启与 {action.name} 的新会话
            </h3>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 max-w-xs mb-4 leading-relaxed">
              在下方输入框输入问题，或点击以下常用提示词快捷发起
            </p>

            {/* 快捷推荐提示词芯片 */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-sm">
              {SUGGESTED_CHIPS.map((chip) => (
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
        ) : error ? (
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

              const turnInfo = turnSnapshots[turn.id];
              const displayTurnModel = turnInfo?.model || selectedModel;
              const displayTurnDuration = turnInfo?.duration ?? (isLast && !isLoading ? totalDuration : undefined);

              return (
                <div key={turn.id} className="flex flex-col gap-1.5">
                  {/* 用户追问气泡 */}
                  {turn.userPrompt && (
                    <UserBubble content={turn.userPrompt} />
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
                        <div className="markdown-body">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              code: (props: any) => (
                                <CodeBlock
                                  {...props}
                                  codeBlockWrap={apiCard?.codeBlockWrap}
                                  codeBlockLineNumbers={apiCard?.codeBlockLineNumbers}
                                />
                              ),
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
                          durationSeconds={apiCard?.showDuration !== false ? displayTurnDuration : undefined}
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
          /* 首字等待 — 仅在 isLoading === true 且 streamText 为空时展示 */
          <div className="pt-1.5">
            <LoadingState label="AI 正在深入思考分析中..." onCancel={onCancel} />
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
        title={action.name || 'AI'}
        providers={providers}
        selectedProviderId={action.providerId}
        selectedModel={selectedModel}
        availableModels={availableModels}
        thinkingMode={thinkingMode}
        sendKeyShortcut={apiCard?.sendKeyShortcut}
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
        hasAnswerText={Boolean(mainText || streamText)}
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

      {/* 6. 多会话历史侧滑面板 */}
      <SessionPanel
        isOpen={chatSessions.isPanelOpen}
        sessions={chatSessions.sessions}
        currentSessionId={chatSessions.currentSessionId}
        onClose={() => chatSessions.setIsPanelOpen(false)}
        onSelectSession={chatSessions.handleSwitchSession}
        onNewSession={chatSessions.handleNewSession}
        onDeleteSession={chatSessions.handleDeleteSession}
        onClearAll={chatSessions.handleClearAllSessions}
      />
    </div>
  );
};
