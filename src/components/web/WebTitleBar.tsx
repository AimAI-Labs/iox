import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { MacTitleBar } from '@/components/MacTitleBar';
import { RotateCw, ExternalLink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';

interface WebTitleBarProps {
  label?: string;
  title?: string;
  url?: string;
}

export const WebTitleBar: React.FC<WebTitleBarProps> = ({
  label: propLabel,
  title: propTitle,
  url: propUrl,
}) => {
  const urlParams = new URLSearchParams(window.location.search);
  const windowLabel = propLabel || urlParams.get('label') || 'web_win';
  const displayTitle = propTitle || urlParams.get('title') || 'Web 官网浮窗';
  const targetUrl = propUrl || urlParams.get('url') || '';

  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. 关闭当前 Web 窗口
  const handleClose = async () => {
    try {
      await invoke('close_web_window', { label: windowLabel });
    } catch {
      try {
        const win = getCurrentWebviewWindow();
        await win.close();
      } catch (err) {
        console.warn('Failed to close web window:', err);
      }
    }
  };

  // 2. 最小化当前 Web 窗口
  const handleMinimize = async () => {
    try {
      await invoke('minimize_web_window', { label: windowLabel });
    } catch {
      try {
        const win = getCurrentWebviewWindow();
        await win.minimize();
      } catch (err) {
        console.warn('Failed to minimize web window:', err);
      }
    }
  };

  // 3. 最大化/还原当前 Web 窗口
  const handleMaximize = async () => {
    try {
      await invoke('toggle_maximize_web_window', { label: windowLabel });
    } catch {
      try {
        const win = getCurrentWebviewWindow();
        await win.toggleMaximize();
      } catch (err) {
        console.warn('Failed to toggle maximize web window:', err);
      }
    }
  };

  // 4. 刷新网页内容
  const handleReload = async () => {
    setIsRefreshing(true);
    try {
      await invoke('reload_web_webview', { contentLabel: `${windowLabel}_web` });
    } catch (err) {
      console.warn('Failed to reload webview:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // 5. 在系统默认浏览器打开
  const handleOpenExternal = async () => {
    if (!targetUrl) return;
    try {
      await openUrl(targetUrl);
    } catch {
      try {
        await invoke('open_in_browser', { url: targetUrl });
      } catch (err) {
        console.warn('Failed to open external URL:', err);
      }
    }
  };

  return (
    <div className="w-screen h-screen bg-transparent flex items-center justify-center box-border overflow-hidden select-none">
      <div className="w-full h-full flex flex-col bg-[var(--bg-overlay-card)] text-foreground rounded-t-xl border-t border-l border-r border-b border-black/10 dark:border-white/10 overflow-hidden backdrop-blur-2xl">
        <MacTitleBar
          title={displayTitle}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onMaximize={handleMaximize}
          tools={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReload}
                onMouseDown={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="刷新页面"
              >
                <RotateCw size={12} className={isRefreshing ? "animate-spin text-blue-500" : ""} />
              </button>

              {targetUrl && (
                <button
                  type="button"
                  onClick={handleOpenExternal}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="在默认浏览器中打开"
                >
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
};
