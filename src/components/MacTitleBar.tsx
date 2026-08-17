import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

interface MacTitleBarProps {
  title?: string;
}

export const MacTitleBar: React.FC<MacTitleBarProps> = ({ title = 'IOX 设置' }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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
    // 若点击的是交通灯按钮则忽略，防止劫持点击
    if ((e.target as HTMLElement).closest('button, .traffic-light')) {
      return;
    }
    if (e.button === 0) {
      try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.startDragging();
      } catch (err) {
        console.warn('startDragging failed:', err);
      }
    }
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, .traffic-light')) {
      return;
    }
    try {
      await invoke('toggle_maximize_main_window');
    } catch {
      try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.toggleMaximize();
      } catch (err) {
        console.warn('Toggle maximize on double click failed:', err);
      }
    }
  };

  return (
    <header
      className="mac-titlebar"
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="mac-traffic-lights"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="traffic-light traffic-light-close"
          onClick={handleClose}
          onMouseDown={(e) => e.stopPropagation()}
          title="关闭 (隐藏至后台)"
          tabIndex={-1}
        >
          {isHovered && (
            <svg viewBox="0 0 24 24" className="traffic-icon" aria-hidden="true">
              <path
                d="M6 6L18 18M6 18L18 6"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="traffic-light traffic-light-minimize"
          onClick={handleMinimize}
          onMouseDown={(e) => e.stopPropagation()}
          title="最小化"
          tabIndex={-1}
        >
          {isHovered && (
            <svg viewBox="0 0 24 24" className="traffic-icon" aria-hidden="true">
              <path
                d="M4 12H20"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="traffic-light traffic-light-maximize"
          onClick={handleMaximize}
          onMouseDown={(e) => e.stopPropagation()}
          title="最大化 / 还原"
          tabIndex={-1}
        >
          {isHovered && (
            <svg viewBox="0 0 24 24" className="traffic-icon" aria-hidden="true">
              <path
                d="M7 17L17 7M7 7H17V17"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      <div
        className="mac-titlebar-title"
        data-tauri-drag-region
      >
        {title}
      </div>

      <div className="mac-titlebar-placeholder" />
    </header>
  );
};
