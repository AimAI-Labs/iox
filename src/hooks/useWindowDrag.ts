import React, { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useWindowDrag() {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 仅响应鼠标左键按下
    if (e.button !== 0) return;

    // 若点击在按钮、输入框、下拉菜单等交互控件上，不触发拖拽
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [data-no-drag="true"]')) {
      return;
    }

    // 防止文本被意外划选
    e.preventDefault();

    // 触发 Rust 专用后台线程执行 120FPS 物理光标极速硬件级跟随（整次拖拽仅 1 次 IPC）
    invoke('start_overlay_dragging').catch(() => {});
  }, []);

  return {
    handleMouseDown,
    handlePointerDown: handleMouseDown,
  };
}
