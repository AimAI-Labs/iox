import React, { useState, useMemo, useRef } from 'react';
import { ActionConfig } from '../types/config';
import { DynamicIcon } from './Icons';
import { useWindowDrag } from '../hooks/useWindowDrag';
import { invoke } from '@tauri-apps/api/core';
import {
  Pin,
  PinOff,
  X,
  Copy,
  Check,
  RotateCw,
  ExternalLink,
  Globe,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface WebCardViewProps {
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
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const { handleMouseDown } = useWindowDrag();
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
  const handleCopyUrl = async () => {
    if (!finalUrl) return;
    try {
      await navigator.clipboard.writeText(finalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
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
      {/* 顶部控制栏 */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/70 dark:bg-zinc-950/40 select-none cursor-move shrink-0"
      >
        {/* 左侧：图标、名称与域名徽标 */}
        <div data-tauri-drag-region className="flex items-center gap-2 min-w-0">
          <DynamicIcon
            name={action.icon || 'Globe'}
            size={15}
            className="text-blue-600 dark:text-blue-400 pointer-events-none shrink-0"
          />
          <span
            data-tauri-drag-region
            className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate cursor-move"
          >
            {action.name}
          </span>

          {domain && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200/60 dark:border-zinc-700/50 truncate max-w-[150px]">
              <Globe size={9} className="shrink-0" />
              <span className="truncate">{domain}</span>
            </span>
          )}
        </div>

        {/* 右侧：工具按钮 */}
        <div data-tauri-drag-region className="flex items-center gap-0.5 shrink-0">
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

          {/* Pin 固定 */}
          <button
            type="button"
            onClick={onPinToggle}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors cursor-pointer",
              isPinned
                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
            )}
            title={isPinned ? '取消固定' : '固定悬浮窗'}
          >
            {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>

          {/* 关闭 */}
          <button
            type="button"
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
            title="关闭 (Esc)"
          >
            <X size={13} />
          </button>
        </div>
      </div>

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
