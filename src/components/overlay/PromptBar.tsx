import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Plus,
  Zap,
  AlignLeft,
  Mic,
  ChevronDown,
  Check,
  Sparkles,
  Brain,
  FileText,
  Languages,
  Wand2,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * 极简胶囊提问栏 (参考千问桌面端布局)
 * 包含：
 * 1. 独立白底圆角卡片容器 (rounded-2xl)
 * 2. 顶部透明无框输入框 ("向千问提问")
 * 3. 底部工具条：+ 快捷菜单、⚡ 模式/模型选择、≡ 更多、Mic、圆形发送按钮
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
  selectedModel?: string;
  availableModels?: string[];
  onModelChange?: (model: string) => void;
  onRegenerate?: () => void;
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
  title = '千问',
  selectedModel = '',
  availableModels = [],
  onModelChange,
  onRegenerate,
  className,
}) => {
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        setShowModelMenu(false);
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!value.trim() || isLoading || disabled) return;
      onSubmit(value);
    }
  };

  const handleChipClick = (chip: ActionChip) => {
    setShowPlusMenu(false);
    if (isLoading || disabled) return;
    onSubmit(chip.prompt);
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

      {/* 2. 模型选择下拉菜单 (⚡ 快速 ∨) */}
      {showModelMenu && availableModels.length > 0 && (
        <div className="absolute bottom-full left-8 mb-2 z-50 min-w-44 max-h-56 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-zinc-700/80 dark:bg-zinc-900/95 animate-in fade-in zoom-in-95 duration-150 custom-scrollbar">
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
                <span className="truncate mr-2">{model}</span>
                {model === selectedModel && (
                  <Check size={13} className="shrink-0 text-zinc-900 dark:text-zinc-100" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. 更多选项下拉菜单 (≡ 更多) */}
      {showMoreMenu && (
        <div className="absolute bottom-full left-20 mb-2 z-50 w-40 rounded-xl border border-zinc-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-zinc-700/80 dark:bg-zinc-900/95 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex flex-col gap-0.5">
            {onRegenerate && (
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  onRegenerate();
                }}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw size={13} className="shrink-0 text-zinc-500" />
                <span>重新生成回答</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. 样图同款独立胶囊提问卡片容器 */}
      <div
        className={cn(
          'flex flex-col rounded-[18px] bg-white/90 dark:bg-zinc-900/80 p-3 pt-2.5 shadow-sm border border-zinc-200/90 dark:border-zinc-700/80',
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
          {/* 左侧操作组：+ 快捷菜单、⚡ 快速/模型选择、≡ 更多 */}
          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            {/* + 按钮 */}
            <button
              type="button"
              onClick={() => {
                setShowPlusMenu((prev) => !prev);
                setShowModelMenu(false);
                setShowMoreMenu(false);
              }}
              className="flex size-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              title="快捷提示词"
            >
              <Plus size={15} strokeWidth={2} />
            </button>

            {/* ⚡ 快速 / 模型 ∨ 按钮 */}
            <button
              type="button"
              onClick={() => {
                if (availableModels.length > 0) {
                  setShowModelMenu((prev) => !prev);
                  setShowPlusMenu(false);
                  setShowMoreMenu(false);
                }
              }}
              className={cn(
                'flex h-6 items-center gap-1 rounded-md px-1.5 text-[12.5px] font-medium text-zinc-700 transition-colors',
                'hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer'
              )}
              title={selectedModel ? `当前模型: ${selectedModel}` : '选择模型'}
            >
              <Zap size={12} className="shrink-0 text-amber-500 fill-amber-500" />
              <span className="max-w-28 truncate">
                {selectedModel ? (selectedModel.length > 8 ? '快速' : selectedModel) : '快速'}
              </span>
              <ChevronDown size={11} strokeWidth={2.4} className="shrink-0 text-zinc-400" />
            </button>

            {/* ≡ 更多 按钮 */}
            <button
              type="button"
              onClick={() => {
                setShowMoreMenu((prev) => !prev);
                setShowPlusMenu(false);
                setShowModelMenu(false);
              }}
              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[12.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
              title="更多选项"
            >
              <AlignLeft size={13} className="shrink-0 text-zinc-500" />
              <span>更多</span>
            </button>
          </div>

          {/* 右侧操作组：Mic 麦克风 + 经典圆形发送/停止按钮 */}
          <div className="flex items-center gap-2">
            {/* 麦克风图标 */}
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 cursor-pointer"
              title="语音输入"
            >
              <Mic size={15} strokeWidth={1.8} />
            </button>

            {/* 圆形发送/停止圆钮 */}
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
                title="发送 (Enter)"
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

