import React, { useState } from 'react';
import { ActionConfig, AppConfig } from '@/types/config';
import { DynamicIcon } from '@/components/Icons';
import { IOXLogo } from '@/components/common';
import { Send, Settings as SettingsIcon, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FloatingMenuProps {
  config: AppConfig;
  selectedText?: string;
  edge: 'left' | 'right';
  onClose: () => void;
  onTriggerAction: (action: ActionConfig, customPrompt?: string) => void;
  onOpenSettings: () => void;
}

export const FloatingMenu: React.FC<FloatingMenuProps> = ({
  config,
  selectedText = '',
  onClose,
  onTriggerAction,
  onOpenSettings,
}) => {
  const [inputText, setInputText] = useState('');
  const enabledActions = (config.actions || []).filter((a) => a.enabled);

  const handleSendQuery = () => {
    const query = inputText.trim();
    if (!query && !selectedText) return;

    // 优先选择第一个 API 类型的动作，或默认动作
    const defaultAction =
      enabledActions.find((a) => a.actionType === 'api') ||
      enabledActions[0];

    if (defaultAction) {
      onTriggerAction(defaultAction, query || selectedText);
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendQuery();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose]);

  return (
    <div
      className={cn(
        'w-full h-full rounded-2xl p-3 shadow-2xl transition-all duration-200 select-none box-border',
        'bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl',
        'border border-black/10 dark:border-white/10',
        'text-zinc-900 dark:text-zinc-100 flex flex-col gap-2.5 animate-in fade-in zoom-in-95'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between pb-1 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-1.5">
          <IOXLogo size={16} />
          <span className="text-xs font-semibold tracking-tight">IOX 快捷助手</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="打开设置"
          >
            <SettingsIcon size={13} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="收起"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* 选中文本预览提示 */}
      {selectedText ? (
        <div className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-1.5 text-[11px] flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-primary font-medium text-[10px]">
            <Sparkles size={11} />
            <span>已捕获选中文本</span>
          </div>
          <p className="line-clamp-2 text-zinc-700 dark:text-zinc-300 italic font-mono text-[10.5px]">
            "{selectedText}"
          </p>
        </div>
      ) : null}

      {/* 动作列表网格 */}
      <div className="grid grid-cols-3 gap-1.5">
        {enabledActions.slice(0, 6).map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onTriggerAction(action, selectedText)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-xs transition-all duration-150',
              'bg-black/[0.03] dark:bg-white/[0.04] hover:bg-primary/15 dark:hover:bg-primary/20',
              'border border-black/[0.04] dark:border-white/[0.06] hover:border-primary/30',
              'text-zinc-700 dark:text-zinc-200 hover:text-primary font-medium group cursor-pointer active:scale-95'
            )}
          >
            <DynamicIcon
              name={action.icon}
              size={15}
              className="text-zinc-600 dark:text-zinc-400 group-hover:text-primary group-hover:scale-110 transition-transform"
            />
            <span className="text-[10.5px] truncate max-w-full">{action.name}</span>
          </button>
        ))}
      </div>

      {/* 自由提问输入框 */}
      <div className="relative flex items-center mt-0.5">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedText ? '针对选中文本提问...' : '快速提问 AI... (Enter 发送)'}
          className={cn(
            'w-full text-xs pl-2.5 pr-8 py-1.5 rounded-xl transition-all outline-none',
            'bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10',
            'focus:border-primary/60 focus:bg-white dark:focus:bg-zinc-800/90 text-foreground placeholder:text-muted-foreground'
          )}
          autoFocus
        />
        <button
          type="button"
          onClick={handleSendQuery}
          disabled={!inputText.trim() && !selectedText}
          className={cn(
            'absolute right-1.5 p-1 rounded-lg text-primary transition-all',
            inputText.trim() || selectedText
              ? 'opacity-100 hover:bg-primary/10 active:scale-90 cursor-pointer'
              : 'opacity-30 cursor-not-allowed'
          )}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
};
