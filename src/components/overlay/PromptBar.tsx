import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Plus,
  Zap,
  ChevronDown,
  Check,
  Brain,
  FileText,
  Languages,
  Wand2,
  Sparkles,
  Server,
  Layers,
} from 'lucide-react';
import { ProviderConfig } from '@/types/config';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * 极简胶囊提问栏
 * 包含：
 * 1. 独立白底圆角卡片容器 (rounded-2xl)
 * 2. 顶部透明无框输入框
 * 3. 底部工具条：+ 快捷预设、[供应商 / 模型] 级联芯片、⚡极速/🧠深度思考切换、圆形发送按钮
 * ───────────────────────────────────────────────────────── */

export interface ActionChip {
  label: string;
  prompt: string;
  icon: React.ReactNode;
}

const DEFAULT_ACTION_CHIPS: ActionChip[] = [
  {
    label: '深度思考',
    prompt: '请开启深度思考模式，详细列出严谨的逐步推理与思考过程：',
    icon: <Brain size={13} className="text-purple-500 shrink-0" />,
  },
  {
    label: '总结要点',
    prompt: '请帮我精简总结以上内容的核心要点：',
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
  {
    label: '对照翻译',
    prompt: '请将以上内容进行精准对照翻译：',
    icon: <Languages size={13} className="text-indigo-500 shrink-0" />,
  },
];

export interface PromptBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  providers?: ProviderConfig[];
  selectedProviderId?: string;
  selectedModel?: string;
  availableModels?: string[];
  thinkingMode?: 'quick' | 'deep';
  sendKeyShortcut?: 'Enter' | 'Ctrl+Enter';
  onProviderChange?: (providerId: string) => void;
  onModelChange?: (model: string) => void;
  onThinkingModeChange?: (mode: 'quick' | 'deep') => void;
  className?: string;
}

export const PromptBar: React.FC<PromptBarProps> = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  isLoading,
  disabled = false,
  placeholder,
  title = 'AI',
  providers = [],
  selectedProviderId = '',
  selectedModel = '',
  availableModels = [],
  thinkingMode = 'quick',
  sendKeyShortcut = 'Enter',
  onProviderChange,
  onModelChange,
  onThinkingModeChange,
  className,
}) => {
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentProvider = providers.find((p) => p.id === selectedProviderId);
  const providerLabel = currentProvider?.name || '选择服务商';
  const modelLabel = selectedModel || '选择模型';

  // 自动聚焦与高度自适应
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 80)}px`;
    }
  }, [value]);

  // 点击外部收起弹出层
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
        setShowProviderMenu(false);
        setShowModelMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sendKeyShortcut === 'Ctrl+Enter') {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!value.trim() || isLoading || disabled) return;
        onSubmit(value);
      }
    } else {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (!value.trim() || isLoading || disabled) return;
        onSubmit(value);
      }
    }
  };

  // 预设提示词：填入输入框（而非直接发送），用户可编辑后手动发送
  const handleChipClick = (chip: ActionChip) => {
    setShowPlusMenu(false);
    if (isLoading || disabled) return;
    onChange(chip.prompt);
    textareaRef.current?.focus();
  };

  const toggleThinkingMode = () => {
    const nextMode = thinkingMode === 'quick' ? 'deep' : 'quick';
    onThinkingModeChange?.(nextMode);
  };

  const inputPlaceholder = placeholder || `向${title}提问`;

  return (
    <div
      ref={containerRef}
      className={cn('relative shrink-0 p-3 pt-1 select-none', className)}
    >
      {/* 1. 快捷 Prompt 弹出卡片 (+ 菜单) */}
      {showPlusMenu && (
        <div className="absolute bottom-full left-3 mb-2 z-50 w-56 rounded-xl border border-zinc-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-zinc-700/80 dark:bg-zinc-900/95 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
            快捷预设提示词
          </div>
          <div className="flex flex-col gap-0.5">
            {DEFAULT_ACTION_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleChipClick(chip)}
                disabled={isLoading || disabled}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer disabled:opacity-50"
              >
                {chip.icon}
                <span className="font-medium">{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. 供应商选择下拉菜单 */}
      {showProviderMenu && providers.length > 0 && (
        <div className="absolute bottom-full left-10 mb-2 z-50 min-w-48 max-h-56 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-zinc-700/80 dark:bg-zinc-900/95 animate-in fade-in zoom-in-95 duration-150 custom-scrollbar">
          <div className="px-2 py-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
            选择模型服务商
          </div>
          <div className="flex flex-col gap-0.5">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onProviderChange?.(p.id);
                  setShowProviderMenu(false);
                }}
                className={cn(
                  'flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12.5px] font-medium transition-colors cursor-pointer',
                  p.id === selectedProviderId
                    ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
                )}
              >
                <div className="flex items-center gap-1.5 truncate mr-2">
                  <Server size={12} className="shrink-0 text-zinc-400" />
                  <span className="truncate">{p.name}</span>
                </div>
                {p.id === selectedProviderId && (
                  <Check size={13} className="shrink-0 text-zinc-900 dark:text-zinc-100" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. 模型选择下拉菜单 */}
      {showModelMenu && availableModels.length > 0 && (
        <div className="absolute bottom-full left-28 mb-2 z-50 min-w-44 max-h-56 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-zinc-700/80 dark:bg-zinc-900/95 animate-in fade-in zoom-in-95 duration-150 custom-scrollbar">
          <div className="px-2 py-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
            选择运行模型
          </div>
          <div className="flex flex-col gap-0.5">
            {availableModels.map((model) => (
              <button
                key={model}
                type="button"
                onClick={() => {
                  onModelChange?.(model);
                  setShowModelMenu(false);
                }}
                className={cn(
                  'flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12.5px] font-medium transition-colors cursor-pointer',
                  model === selectedModel
                    ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
                )}
              >
                <div className="flex items-center gap-1.5 truncate mr-2">
                  <Layers size={12} className="shrink-0 text-zinc-400" />
                  <span className="truncate">{model}</span>
                </div>
                {model === selectedModel && (
                  <Check size={13} className="shrink-0 text-zinc-900 dark:text-zinc-100" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. 独立胶囊提问卡片容器 */}
      <div
        className={cn(
          'flex flex-col rounded-[18px] bg-white dark:bg-[#18181b] p-3 pt-2.5 shadow-sm border border-zinc-200/90 dark:border-zinc-700/80',
          'transition-all duration-150 focus-within:border-zinc-400/90 dark:focus-within:border-zinc-500/80 focus-within:shadow-md'
        )}
      >
        {/* 输入区 */}
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={inputPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading || disabled}
          className={cn(
            'w-full resize-none bg-transparent text-[13.5px] leading-relaxed text-zinc-900 dark:text-zinc-100',
            'outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 select-text custom-scrollbar max-h-24',
            'disabled:opacity-50'
          )}
        />

        {/* 底部工具行 */}
        <div className="mt-2 flex items-center justify-between">
          {/* 左侧操作组：+ 快捷菜单、[供应商 / 模型] 级联选择器、⚡极速/🧠深度思考切换 */}
          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            {/* + 按钮 */}
            <button
              type="button"
              onClick={() => {
                setShowPlusMenu((prev) => !prev);
                setShowProviderMenu(false);
                setShowModelMenu(false);
              }}
              className="flex size-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              title="快捷提示词"
            >
              <Plus size={15} strokeWidth={2} />
            </button>

            {/* 供应商 > 模型 级联选择芯片组 */}
            <div className="flex items-center rounded-md bg-zinc-100/90 dark:bg-zinc-800/90 p-0.5 border border-zinc-200/60 dark:border-zinc-700/60 text-[12px]">
              {/* 供应商切换按钮 */}
              {providers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowProviderMenu((prev) => !prev);
                    setShowModelMenu(false);
                    setShowPlusMenu(false);
                  }}
                  className="flex h-5.5 items-center gap-1 rounded px-1.5 font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer max-w-28"
                  title={`当前服务商: ${providerLabel} (点击切换)`}
                >
                  <span className="truncate">{providerLabel}</span>
                  <ChevronDown size={10} className="shrink-0 text-zinc-400" />
                </button>
              )}

              {providers.length > 0 && availableModels.length > 0 && (
                <span className="text-zinc-300 dark:text-zinc-600 px-0.5 select-none">/</span>
              )}

              {/* 模型切换按钮 */}
              {availableModels.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowModelMenu((prev) => !prev);
                    setShowProviderMenu(false);
                    setShowPlusMenu(false);
                  }}
                  className="flex h-5.5 items-center gap-1 rounded px-1.5 font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer max-w-32"
                  title={`当前模型: ${modelLabel} (点击切换)`}
                >
                  <span className="truncate">{modelLabel}</span>
                  <ChevronDown size={10} className="shrink-0 text-zinc-400" />
                </button>
              )}
            </div>

            {/* ⚡ 极速 / 🧠 深度思考 切换按钮 */}
            <button
              type="button"
              onClick={toggleThinkingMode}
              className={cn(
                'flex h-6.5 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium transition-all duration-150 cursor-pointer border',
                thinkingMode === 'deep'
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 font-semibold shadow-xs'
                  : 'bg-zinc-100/90 dark:bg-zinc-800/90 border-zinc-200/60 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
              title={
                thinkingMode === 'deep'
                  ? '当前模式: 深度思考 (点击切换为极速模式)'
                  : '当前模式: 极速模式 (点击切换为深度思考)'
              }
            >
              {thinkingMode === 'deep' ? (
                <>
                  <Brain size={12} className="shrink-0 text-purple-500 animate-pulse" />
                  <span>深度思考</span>
                </>
              ) : (
                <>
                  <Zap size={12} className="shrink-0 text-amber-500 fill-amber-500" />
                  <span>极速</span>
                </>
              )}
            </button>
          </div>

          {/* 右侧操作组：圆形发送/停止按钮 */}
          <div className="flex items-center gap-2">
            {isLoading ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex size-7.5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-transform duration-150 hover:bg-red-600 active:scale-95 cursor-pointer"
                title="停止生成"
              >
                <Square size={10} className="fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (value.trim() && !disabled) {
                    onSubmit(value);
                  }
                }}
                disabled={!value.trim() || disabled}
                className={cn(
                  'flex size-7.5 items-center justify-center rounded-full transition-all duration-200 active:scale-95',
                  value.trim() && !disabled
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm hover:opacity-90 cursor-pointer'
                    : 'bg-zinc-200/80 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed'
                )}
                title={sendKeyShortcut === 'Ctrl+Enter' ? '发送 (Ctrl+Enter)' : '发送 (Enter)'}
              >
                <ArrowUp size={16} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
