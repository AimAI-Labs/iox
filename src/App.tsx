import { useEffect, useState, Suspense, lazy } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useConfig } from '@/hooks/useConfig';
import { useTheme, broadcastThemeChange } from '@/hooks/useTheme';
import { useOverlayState } from '@/hooks/useOverlayState';
import { BubbleBar, ResultCard, FloatingBall } from '@/components/overlay';
import { Toaster } from 'sonner';
import './App.css';

// 懒加载非悬浮窗视图，极大加速 Overlay 首屏渲染与降低内存占用
const Settings = lazy(() => import('@/components/settings').then((m) => ({ default: m.Settings })));
const WebTitleBar = lazy(() => import('@/components/web').then((m) => ({ default: m.WebTitleBar })));

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

  // 统一应用与监听主题及透明度
  useTheme(config?.general.theme, config?.general.overlayOpacity);

  const handleOpenSettings = async (tab?: string) => {
    try {
      overlayState.handleClose();
      await invoke('show_main_window', { targetTab: tab });
    } catch (e) {
      console.error('Failed to open settings window:', e);
    }
  };

  // 全局 Esc 键与鼠标侧键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && windowLabel === 'overlay') {
        if (overlayState.mode === 'bubble' || !overlayState.isPinned) {
          overlayState.handleClose();
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // 3: 鼠标后退侧键, 4: 鼠标前进侧键
      if ((e.button === 3 || e.button === 4) && windowLabel === 'overlay') {
        if (overlayState.mode === 'bubble' || !overlayState.isPinned) {
          overlayState.handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('auxclick', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('auxclick', handleMouseDown);
    };
  }, [windowLabel, overlayState]);

  // 监听 Overlay 在 Card 模式下的手动拖拽缩放，防抖自动记忆尺寸
  useEffect(() => {
    if (windowLabel !== 'overlay') return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (overlayState.mode !== 'card') return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(async () => {
        try {
          const win = getCurrentWebviewWindow();
          const size = await win.innerSize();
          const scale = await win.scaleFactor();
          const w = Math.round(size.width / scale);
          const h = Math.round(size.height / scale);
          if (w >= 360 && h >= 300) {
            await invoke('save_api_card_size', { width: w, height: h });
          }
        } catch {
          // ignore
        }
      }, 300);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [windowLabel, overlayState.mode]);

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
    return (
      <Suspense fallback={null}>
        <WebTitleBar />
      </Suspense>
    );
  }

  // 1. 常驻悬浮球视图
  if (windowLabel === 'floating_ball') {
    return <FloatingBall config={config} />;
  }

  // 2. Overlay 悬浮窗视图 (保持同步直出渲染，零时延)
  if (windowLabel === 'overlay') {
    if (!overlayState.visible) {
      return null;
    }

    return (
      <div className="overlay-root">
        {overlayState.mode === 'bubble' ? (
          <BubbleBar
            key={overlayState.animKey}
            actions={config.actions}
            selectedText={overlayState.selectedText}
            isClosing={overlayState.isClosing}
            iconOnly={config.general.iconOnlyBubble}
            onActionClick={overlayState.handleTriggerAction}
            onActionContextMenu={overlayState.handleTriggerActionWithoutText}
            onOpenSettings={handleOpenSettings}
          />
        ) : overlayState.activeAction ? (
          <ResultCard
            action={overlayState.activeAction}
            providers={config.providers}
            selectedModel={overlayState.selectedModel}
            streamText={overlayState.streamText}
            selectedText={overlayState.selectedText}
            isLoading={overlayState.isLoading}
            isPinned={overlayState.isPinned}
            isClosing={overlayState.isClosing}
            error={overlayState.error}
            apiCard={config.apiCard}
            theme={config.general.theme}
            thinkingMode={overlayState.thinkingMode}
            onThemeChange={(newTheme) => {
              updateConfig({
                ...config,
                general: {
                  ...config.general,
                  theme: newTheme,
                },
              });
              broadcastThemeChange(newTheme, config.general.overlayOpacity);
            }}
            onProviderChange={overlayState.handleProviderChange}
            onModelChange={overlayState.handleModelChange}
            onThinkingModeChange={overlayState.handleThinkingModeChange}
            onSendFollowUp={overlayState.handleSendFollowUp}
            onRegenerateCurrentTurn={overlayState.handleRegenerateCurrentTurn}
            onNewChat={overlayState.handleNewChat}
            onRestoreSession={overlayState.handleRestoreSession}
            onExportMarkdown={overlayState.handleExportMarkdown}
            onOpenSettings={() => handleOpenSettings('api_card')}
            onCancel={overlayState.handleCancel}
            onPinToggle={overlayState.handlePinToggle}
            onClose={overlayState.handleClose}
            onResetSize={overlayState.handleResetCardSize}
          />
        ) : null}
      </div>
    );
  }

  // 2. Settings 设置面板视图 (主窗口异步载入)
  return (
    <>
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={3500}
        theme={config.general.theme === 'system' ? 'system' : (config.general.theme as 'dark' | 'light')}
      />
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen bg-transparent">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
            </div>
          </div>
        }
      >
        <Settings config={config} onSave={updateConfig} />
      </Suspense>
    </>
  );
}

export default App;
