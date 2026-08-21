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
  Layers,
} from 'lucide-react';
import { ProviderConfig } from '@/types/config';
import { DynamicIcon } from '@/components/Icons';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * 极简胶囊提问栏
 * 包含：
 * 1. 独立白底圆角卡片容器 (rounded-2xl)
 * 2. 顶部透明无框输入框
 * 3. 底部工具条：+ 快捷预设、[服务商图标 / 模型名] 级联芯片、⚡极速/🧠深度思考切换、圆形发送按钮
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
  availableModels: _availableModels = [],
  thinkingMode = 'quick',
  sendKeyShortcut = 'Enter',
  onProviderChange,
  onModelChange,
  onThinkingModeChange,
  className,
}) => {
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showCascaderMenu, setShowCascaderMenu] = useState(false);
  const [activeCascaderProviderId, setActiveCascaderProviderId] = useState<string>(
    selectedProviderId || providers[0]?.id || ''
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentProvider = providers.find((p) => p.id === selectedProviderId);
  const providerName = currentProvider?.name || '选择服务商';
  const providerIconName = currentProvider?.id || currentProvider?.name || 'Cpu';
  const modelLabel = selectedModel || '选择模型';

  // 当外部 selectedProviderId 改变时同步内部激活状态
  useEffect(() => {
    if (selectedProviderId) {
      setActiveCascaderProviderId(selectedProviderId);
    }
  }, [selectedProviderId]);

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
        setShowCascaderMenu(false);
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

  // 获取当前在级联面板中高亮的服务商对象及其模型列表
  const cascaderProvider =
    providers.find((p) => p.id === activeCascaderProviderId) ||
    currentProvider ||
    providers[0];
  const cascaderModels = cascaderProvider?.models || [];

  const handleSelectModel = (providerId: string, modelName: string) => {
    if (onProviderChange && providerId !== selectedProviderId) {
      onProviderChange(providerId);
    }
    if (onModelChange) {
      onModelChange(modelName);
    }
    setShowCascaderMenu(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative shrink-0 p-3 pt-1 select-none', className)}
    >
      {/* 1. 快捷 Prompt 弹出卡片 (+ 菜单) */}
      {showPlusMenu && (
        <div className="absolute bottom-full left-3 mb-2 z-50 w-56 rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl dark:bg-zinc-900/95 animate-in fade-in zoom-in-95 duration-120">
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
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[12.5px] text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer disabled:opacity-50"
              >
                {chip.icon}
                <span className="font-medium">{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. 供应商与模型双列级联选择器 (Cascader Popover) */}
      {showCascaderMenu && providers.length > 0 && (
        <div className="absolute bottom-full left-8 mb-2 z-50 flex rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#18181b]/95 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-120 overflow-hidden divide-x divide-black/5 dark:divide-white/5">
          {/* 左侧列：服务商列表 (宽 150px) */}
          <div className="w-[155px] p-1.5 flex flex-col gap-0.5">
            <div className="px-2 py-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
              服务商
            </div>
            <div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
              {providers.map((p) => {
                const isActive = p.id === cascaderProvider?.id;
                const isSelected = p.id === selectedProviderId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onMouseEnter={() => setActiveCascaderProviderId(p.id)}
                    onClick={() => setActiveCascaderProviderId(p.id)}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-2 py-1.5 text-left text-[12px] font-medium transition-colors cursor-pointer',
                      isActive
                        ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200'
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 mr-1">
                      <DynamicIcon name={p.id || p.name} size={14} className="shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono px-1 py-0.2 rounded shrink-0",
                      isSelected ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 font-semibold" : "text-zinc-400"
                    )}>
                      {p.models.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右侧列：当前高亮服务商下的模型列表 (宽 185px) */}
          <div className="w-[190px] p-1.5 flex flex-col gap-0.5">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
              <span className="truncate max-w-28">{cascaderProvider?.name || '模型'}</span>
              <span className="text-[10px]">点击切换</span>
            </div>
            <div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
              {cascaderModels.length > 0 ? (
                cascaderModels.map((model) => {
                  const isCurrentModel =
                    cascaderProvider?.id === selectedProviderId && model === selectedModel;
                  const isDefault = model === cascaderProvider?.defaultModel;

                  return (
                    <button
                      key={model}
                      type="button"
                      onClick={() => handleSelectModel(cascaderProvider.id, model)}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-2 py-1.5 text-left text-[12px] font-medium transition-colors cursor-pointer',
                        isCurrentModel
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-semibold'
                          : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 mr-1">
                        <Layers size={12} className={cn("shrink-0", isCurrentModel ? "text-blue-500" : "text-zinc-400")} />
                        <span className="truncate">{model}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isDefault && (
                          <span className="text-[9.5px] px-1 py-0.2 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-normal">
                            默认
                          </span>
                        )}
                        {isCurrentModel && (
                          <Check size={13} className="text-blue-500 stroke-[2.5]" />
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center text-[11px] text-zinc-400">
                  暂无可用的模型
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. 独立胶囊提问卡片容器 */}
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
          {/* 左侧操作组：+ 快捷菜单、[服务商图标 / 模型选择] 双列级联芯片、⚡极速/🧠深度思考切换 */}
          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            {/* + 按钮 */}
            <button
              type="button"
              onClick={() => {
                setShowPlusMenu((prev) => !prev);
                setShowCascaderMenu(false);
              }}
              className="flex size-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              title="快捷提示词"
            >
              <Plus size={15} strokeWidth={2} />
            </button>

            {/* 供应商与模型双列级联选择芯片 */}
            {providers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowCascaderMenu((prev) => !prev);
                  setShowPlusMenu(false);
                  if (selectedProviderId) setActiveCascaderProviderId(selectedProviderId);
                }}
                className={cn(
                  'flex h-6.5 items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium transition-all duration-150 cursor-pointer border max-w-44',
                  showCascaderMenu
                    ? 'bg-zinc-200/90 dark:bg-zinc-700/90 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100'
                    : 'bg-zinc-100/90 dark:bg-zinc-800/90 border-zinc-200/60 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'
                )}
                title={`当前服务商: ${providerName}，模型: ${modelLabel} (点击级联切换)`}
              >
                <DynamicIcon name={providerIconName} size={14} className="shrink-0" />
                <span className="truncate">{modelLabel}</span>
                <ChevronDown
                  size={10}
                  className={cn(
                    'shrink-0 text-zinc-400 transition-transform duration-150',
                    showCascaderMenu && 'rotate-180'
                  )}
                />
              </button>
            )}

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

