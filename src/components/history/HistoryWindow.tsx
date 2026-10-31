import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AppConfig } from '@/types/config';
import { MacTitleBar } from '@/components/MacTitleBar';
import { useTranslation } from '@/hooks/useTranslation';
import { useUiTheme } from '@/themes/ThemeProvider';
import { SessionViewer } from './SessionViewer';

// 与原生 open_history_window 约定的事件名，载荷是要定位的会话 ID
const OPEN_REQUEST_EVENT = 'open_history_session';

export interface HistoryWindowProps {
  config: AppConfig;
}

interface OpenRequest {
  sessionId: string | null;
  revision: number;
}

/** 历史会话独立窗口：外框、标题栏与拖动/缩放行为与设置窗口保持一致。 */
export const HistoryWindow: React.FC<HistoryWindowProps> = ({ config }) => {
  const { t } = useTranslation();
  const uiTheme = useUiTheme();
  const [request, setRequest] = useState<OpenRequest>({ sessionId: null, revision: 0 });

  // 与设置窗口一致：屏蔽浏览器默认右键菜单
  useEffect(() => {
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener('contextmenu', preventContextMenu, true);
    return () => document.removeEventListener('contextmenu', preventContextMenu, true);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string | null>(OPEN_REQUEST_EVENT, (event) => {
      setRequest((previous) => ({
        sessionId: event.payload ?? null,
        revision: previous.revision + 1,
      }));
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((error) => {
        console.warn('Failed to listen for history window requests:', error);
      });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleClose = useCallback(() => {
    void invoke('hide_history_window').catch((error) => {
      console.warn('Failed to hide history window:', error);
    });
  }, []);

  const handleMinimize = useCallback(() => {
    void invoke('minimize_history_window').catch((error) => {
      console.warn('Failed to minimize history window:', error);
    });
  }, []);

  const handleMaximize = useCallback(() => {
    void invoke('toggle_maximize_history_window').catch((error) => {
      console.warn('Failed to toggle history window:', error);
    });
  }, []);

  return (
    <div className="w-screen h-screen bg-transparent flex items-center justify-center box-border overflow-hidden select-none">
      <div className="app-window-frame w-full h-full flex flex-col bg-[var(--bg-overlay-card)] text-foreground rounded-[var(--ui-window-radius)] border border-black/10 dark:border-white/10 overflow-hidden backdrop-blur-2xl">
        {/* 自绘沉浸式标题栏；Windows 原生样式下由系统标题栏接管 */}
        {uiTheme.windowChrome === 'custom' && (
          <MacTitleBar
            title={t('sessionViewer.title')}
            onClose={handleClose}
            onMinimize={handleMinimize}
            onMaximize={handleMaximize}
          />
        )}

        <div
          className="flex flex-1 overflow-hidden"
          style={{ height: 'calc(100% - var(--ui-titlebar-height))' }}
        >
          <main className="flex-1 h-full overflow-hidden bg-transparent flex flex-col">
            <SessionViewer
              actions={config.actions}
              initialSessionId={request.sessionId}
              requestRevision={request.revision}
              onRequestClose={handleClose}
            />
          </main>
        </div>
      </div>
    </div>
  );
};
