import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useConfig } from './hooks/useConfig';
import { useOverlayState } from './hooks/useOverlayState';
import { BubbleBar } from './components/BubbleBar';
import { ResultCard } from './components/ResultCard';
import { Settings } from './components/Settings';
import './App.css';

export function App() {
  const { config, loading, updateConfig } = useConfig();
  const [windowLabel, setWindowLabel] = useState<string>('main');

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

  const handleOpenSettings = async () => {
    try {
      const mainWindow = await WebviewWindow.getByLabel('main');
      if (mainWindow) {
        await mainWindow.show();
        await mainWindow.setFocus();
      }
    } catch {
      // ignore
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
      <div className="loading-state" style={{ minHeight: '100vh', background: '#0f1117' }}>
        <div className="pulse-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  // 1. Overlay 悬浮窗视图
  if (windowLabel === 'overlay') {
    return (
      <div className="overlay-root">
        {overlayState.mode === 'bubble' ? (
          <BubbleBar
            actions={config.actions}
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
