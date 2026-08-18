import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useConfig } from '@/hooks/useConfig';
import { useTheme } from '@/hooks/useTheme';
import { useOverlayState } from '@/hooks/useOverlayState';
import { BubbleBar, ResultCard } from '@/components/overlay';
import { Settings } from '@/components/settings';
import { WebTitleBar } from '@/components/web';
import './App.css';

export function App() {
  const { config, loading, updateConfig } = useConfig();
  const [windowLabel, setWindowLabel] = useState<string>('main');
  const urlParams = new URLSearchParams(window.location.search);
  const isWebTitleBar = urlParams.get('view') === 'web_titlebar' || windowLabel.endsWith('_bar');

  useEffect(() => {
    try {
      const current = getCurrentWebviewWindow();
      setWindowLabel(current.label);
    } catch {
      // 在纯浏览器环境预览时默认为 main
      setWindowLabel('main');
    }
  }, []);

  const overlayState = useOverlayState(config);

  // 统一应用与监听主题
  useTheme(config?.general.theme);

  const handleOpenSettings = async () => {
    try {
      await invoke('show_main_window');
    } catch (e) {
      console.error('Failed to open settings window:', e);
    }
  };

  // 全局 Esc 键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && windowLabel === 'overlay' && !overlayState.isPinned) {
        overlayState.handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [windowLabel, overlayState]);

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
        </div>
      </div>
    );
  }

  // 0. Web 官网浮窗标题栏视图
  if (isWebTitleBar) {
    return <WebTitleBar />;
  }

  // 1. Overlay 悬浮窗视图
  if (windowLabel === 'overlay') {
    return (
      <div className="overlay-root">
        {overlayState.mode === 'bubble' ? (
          <BubbleBar
            key={overlayState.animKey}
            actions={config.actions}
            selectedText={overlayState.selectedText}
            isClosing={overlayState.isClosing}
            onActionClick={overlayState.handleTriggerAction}
            onOpenSettings={handleOpenSettings}
          />
        ) : overlayState.activeAction ? (
          <ResultCard
            action={overlayState.activeAction}
            providers={config.providers}
            selectedModel={overlayState.selectedModel}
            streamText={overlayState.streamText}
            isLoading={overlayState.isLoading}
            isPinned={overlayState.isPinned}
            isClosing={overlayState.isClosing}
            error={overlayState.error}
            onModelChange={overlayState.handleModelChange}
            onSendFollowUp={overlayState.handleSendFollowUp}
            onCancel={overlayState.handleCancel}
            onPinToggle={overlayState.handlePinToggle}
            onClose={overlayState.handleClose}
          />
        ) : null}
      </div>
    );
  }

  // 2. Settings 设置面板视图 (主窗口)
  return <Settings config={config} onSave={updateConfig} />;
}

export default App;
