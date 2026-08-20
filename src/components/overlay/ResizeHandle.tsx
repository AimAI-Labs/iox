import React, { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/* ─────────────────────────────────────────────────────────
 * ResizeHandle — 右下角原生缩放手柄
 * mousedown 触发 Tauri startResizeDragging，由系统接管
 * 整个 resize 循环 (WM_SYSCOMMAND SC_SIZE)，零 IPC 洪泛
 * ───────────────────────────────────────────────────────── */

export const ResizeHandle: React.FC = () => {
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      await getCurrentWindow().startResizeDragging('SouthEast');
    } catch {
      // 权限或平台不支持时静默失败
    }
  }, []);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 bottom-0 z-20 flex size-4 cursor-nwse-resize items-end justify-end p-0.5 select-none"
      title="拖拽调整大小"
    >
      {/* BUI 极简三点角标 */}
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        className="text-ink-3/50"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="1" />
        <circle cx="7" cy="3.5" r="1" />
        <circle cx="3.5" cy="7" r="1" />
      </svg>
    </div>
  );
};
