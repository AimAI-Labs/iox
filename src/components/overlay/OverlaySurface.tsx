import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useOverlayState } from '@/hooks/useOverlayState';
import { broadcastThemeChange } from '@/hooks/useTheme';
import { BubbleBar } from '@/components/overlay/BubbleBar';
import { ResultCard } from '@/components/overlay/ResultCard';
import { FileSelectionMenu } from '@/components/overlay/FileSelectionMenu';
import type { AppConfig } from '@/types/config';

interface OverlaySurfaceProps {
  config: AppConfig;
  updateConfig: (config: AppConfig) => Promise<boolean>;
}

/**
 * 悬浮窗视图：只有 overlay 窗口才建立划词生命周期。
 *
 * 设置窗口、悬浮球与官网浮窗不再挂载同一套 hook——它们此前会把 pin 偏好、
 * 窗口形态与尺寸写进共享的悬浮窗状态，也会消费本不属于它们的划词事件。
 * 视图分流必须发生在建立 hook 之前。
 */
export function OverlaySurface({ config, updateConfig }: OverlaySurfaceProps) {
  const overlay = useOverlayState(config);

  // Esc 与鼠标侧键：前端只在悬浮窗自己持有键盘焦点时收到这些事件，
  // 退场政策与原生钩子一致——固定卡片不因 Esc 退场。
  useEffect(() => {
    const dismiss = () => {
      if (overlay.mode === 'bubble' || !overlay.isPinned) overlay.handleClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    const handleMouseDown = (e: MouseEvent) => {
      // 3: 鼠标后退侧键, 4: 鼠标前进侧键
      if (e.button === 3 || e.button === 4) dismiss();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('auxclick', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('auxclick', handleMouseDown);
    };
  }, [overlay.mode, overlay.isPinned, overlay.handleClose]);

  // 卡片态手动拖拽缩放后防抖记忆尺寸
  useEffect(() => {
    if (overlay.mode !== 'card') return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
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
  }, [overlay.mode]);

  if (!overlay.visible) {
    return null;
  }

  const handleOpenSettings = async (tab?: string) => {
    try {
      overlay.handleClose();
      const targetTab = typeof tab === 'string' ? tab : undefined;
      await invoke('show_main_window', { targetTab });
    } catch (e) {
      console.error('Failed to open settings window:', e);
    }
  };

  return (
    <div className="overlay-root">
      {overlay.mode === 'bubble' ? (
        overlay.selectedFiles.length ? (
          <FileSelectionMenu
            key={overlay.animKey}
            files={overlay.selectedFiles}
            dragId={overlay.fileDragId!}
            layout={overlay.fileMenuLayout!}
            actions={config.actions}
            isClosing={overlay.isClosing}
            onClose={overlay.handleClose}
          />
        ) : (
          <BubbleBar
            key={overlay.animKey}
            actions={config.actions}
            selectedText={overlay.selectedText}
            isClosing={overlay.isClosing}
            iconOnly={config.general.iconOnlyBubble}
            onActionClick={overlay.handleTriggerAction}
            onActionDoubleClick={overlay.handleTriggerQuoteAction}
            onActionContextMenu={overlay.handleTriggerActionWithoutText}
            onOpenSettings={() => handleOpenSettings()}
          />
        )
      ) : overlay.conversation ? (
        <ResultCard
          conversation={overlay.conversation}
          tabs={overlay.tabs}
          activeTabId={overlay.activeTabId!}
          chatSessions={overlay.chatSessions}
          providers={config.providers}
          isPinned={overlay.isPinned}
          isClosing={overlay.isClosing}
          apiCard={config.apiCard}
          theme={config.general.theme}
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
          onProviderChange={overlay.handleProviderChange}
          onModelChange={overlay.handleModelChange}
          onThinkingModeChange={overlay.handleThinkingModeChange}
          onSendFollowUp={overlay.handleSendFollowUp}
          onEditMessage={overlay.handleEditMessage}
          onRegenerateCurrentTurn={overlay.handleRegenerateCurrentTurn}
          onNewChat={overlay.handleNewChat}
          onSelectTab={overlay.handleSelectTab}
          onCloseTab={overlay.handleCloseTab}
          onCloseOtherTabs={overlay.handleCloseOtherTabs}
          onCloseLeftTabs={overlay.handleCloseLeftTabs}
          onCloseRightTabs={overlay.handleCloseRightTabs}
          onExportMarkdown={overlay.handleExportMarkdown}
          onOpenSettings={() => handleOpenSettings('api_card')}
          onCancel={overlay.handleCancel}
          onPinToggle={overlay.handlePinToggle}
          onClose={overlay.handleClose}
          onResetSize={overlay.handleResetCardSize}
        />
      ) : null}
    </div>
  );
}
