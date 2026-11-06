import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { MacTrafficLights } from '@/components/MacTrafficLights';
import { useUiTheme } from '@/themes/ThemeProvider';
import { cn } from '@/lib/utils';
import { resolveTitleBarPress } from '@/lib/titleBarGesture';

export interface MacTitleBarProps {
  title?: React.ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  badge?: React.ReactNode;
  tools?: React.ReactNode;
  className?: string;
}

export const MacTitleBar: React.FC<MacTitleBarProps> = ({
  title = 'IOX 设置',
  onClose,
  onMinimize,
  onMaximize,
  badge,
  tools,
  className,
}) => {
  const uiTheme = useUiTheme();
  const showTrafficLights = uiTheme.titleBarControls === 'traffic-lights';

  const handleClose = async () => {
    if (onClose) {
      onClose();
      return;
    }
    try {
      await invoke('hide_main_window');
    } catch {
      try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.hide();
      } catch (err) {
        console.warn('Close/hide main window failed:', err);
      }
    }
  };

  const handleMinimize = async () => {
    if (onMinimize) {
      onMinimize();
      return;
    }
    try {
      await invoke('minimize_main_window');
    } catch {
      try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.minimize();
      } catch (err) {
        console.warn('Minimize main window failed:', err);
      }
    }
  };

  const handleMaximize = async () => {
    if (onMaximize) {
      onMaximize();
      return;
    }
    try {
      await invoke('toggle_maximize_main_window');
    } catch {
      try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.toggleMaximize();
      } catch (err) {
        console.warn('Toggle maximize main window failed:', err);
      }
    }
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    const interactive = Boolean(
      (e.target as HTMLElement).closest('button, .traffic-light, input, select, textarea, a, [data-no-drag="true"]')
    );
    const gesture = resolveTitleBarPress(e.button, e.detail, interactive);
    if (gesture === 'ignore') return;
    if (gesture === 'toggle-maximize') {
      e.preventDefault();
      await handleMaximize();
      return;
    }
    try {
      const appWindow = getCurrentWebviewWindow();
      await appWindow.startDragging();
    } catch (err) {
      console.warn('startDragging failed:', err);
    }
  };

  return (
    <header
      className={cn("mac-titlebar", className)}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center gap-2">
        {showTrafficLights && (
          <MacTrafficLights
            onClose={handleClose}
            onMinimize={handleMinimize}
            onMaximize={handleMaximize}
          />
        )}
        {badge}
      </div>

      <div className="mac-titlebar-title">
        {title}
      </div>

      <div className="flex items-center justify-end gap-1 min-w-[70px]">
        {tools}
      </div>
    </header>
  );
};

