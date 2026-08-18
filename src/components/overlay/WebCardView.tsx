import React, { useState, useMemo, useRef } from 'react';
import { ActionConfig } from '@/types/config';
import { CardHeader } from '@/components/overlay/CardHeader';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { invoke } from '@tauri-apps/api/core';
import {
  Copy,
  Check,
  RotateCw,
  ExternalLink,
  Globe,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WebCardViewProps {
  action: ActionConfig;
  selectedText: string;
  isPinned: boolean;
  isClosing?: boolean;
  onPinToggle: () => void;
  onClose: () => void;
}

export const WebCardView: React.FC<WebCardViewProps> = ({
  action,
  selectedText,
  isPinned,
  isClosing = false,
  onPinToggle,
  onClose,
}) => {
  const { copied, copy } = useCopyFeedback(1500);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 动态渲染 URL 模板
  const finalUrl = useMemo(() => {
    const template = action.urlTemplate || '';
    if (!template.trim()) return '';
    const encoded = encodeURIComponent(selectedText);
    return template
      .replace(/{text}/g, encoded)
      .replace(/{query}/g, encoded)
      .replace(/{raw_text}/g, selectedText);
  }, [action.urlTemplate, selectedText]);

  // 获取域名简写
  const domain = useMemo(() => {
    try {
      if (!finalUrl) return '';
      const parsed = new URL(finalUrl);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }, [finalUrl]);

  // 刷新 iframe
  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  // 复制当前 URL
  const handleCopyUrl = () => {
    if (finalUrl) {
      copy(finalUrl);
    }
  };

  // 在系统外部浏览器中打开
  const handleOpenExternal = async () => {
    if (!finalUrl) return;
    try {
      await invoke('trigger_web_action', {
        urlTemplate: finalUrl,
        text: '',
        copyToClipboard: false,
      });
    } catch (e) {
      console.error('Failed to open external browser:', e);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col w-full h-full",
        "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl",
        "border border-zinc-200/80 dark:border-zinc-800/80",
        "rounded-2xl overflow-hidden shadow-2xl",
        isClosing ? "animate-capsule-out" : "animate-in fade-in zoom-in-95 duration-150"
      )}
    >
      {/* 统一头部控制栏 */}
      <CardHeader
        icon={action.icon || 'Globe'}
        title={action.name}
        badge={
          domain ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200/60 dark:border-zinc-700/50 truncate max-w-[150px]">
              <Globe size={9} className="shrink-0" />
              <span className="truncate">{domain}</span>
            </span>
          ) : undefined
        }
        tools={
          <>
            {/* 刷新 */}
            <button
              type="button"
              onClick={handleRefresh}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="刷新页面"
            >
              <RotateCw size={12} className={cn(isLoading && "animate-spin text-blue-500")} />
            </button>

            {/* 复制链接 */}
            <button
              type="button"
              onClick={handleCopyUrl}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="复制网页链接"
            >
              {copied ? (
                <Check size={12} className="text-emerald-500" />
              ) : (
                <Copy size={12} />
              )}
            </button>

            {/* 外部浏览器打开 */}
            <button
              type="button"
              onClick={handleOpenExternal}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="在系统默认浏览器中打开"
            >
              <ExternalLink size={12} />
            </button>

            {/* 分隔线 */}
            <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
          </>
        }
        isPinned={isPinned}
        onPinToggle={onPinToggle}
        onClose={onClose}
      />

      {/* 正文 iframe 容器 */}
      <div className="relative flex-1 w-full h-full bg-background overflow-hidden">
        {/* Loading 骨架屏 / 指示器 */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
            </div>
            <p className="text-[11px] text-muted-foreground">正在载入网页...</p>
          </div>
        )}

        {finalUrl ? (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={finalUrl}
            className="w-full h-full border-0 bg-white"
            title={action.name}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoading(false)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
            <AlertCircle size={24} className="text-amber-500" />
            <p className="text-xs text-muted-foreground">
              未配置有效的 URL 模板，请在设置中配置网页地址。
            </p>
          </div>
        )}
      </div>

      {/* 底部轻量提示条 */}
      <div className="px-3 py-1 bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 select-none">
        <span className="truncate">如遇部分网站禁止内嵌，请点击右上角在浏览器中打开</span>
        <button
          type="button"
          onClick={handleOpenExternal}
          className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2 shrink-0 ml-2 cursor-pointer"
        >
          浏览器打开
        </button>
      </div>
    </div>
  );
};
