/**
 * 标题栏手势判定。
 *
 * Tauri 内置的 `data-tauri-drag-region` 会在双击时自行调用
 * `internal_toggle_maximize`，与组件里的双击处理叠加后一次双击会切换两次最大化状态。
 * 自定义标题栏因此不再声明 drag region 属性：按下只记录起点，移动超过阈值才进入
 * 原生拖动，双击则交给 React 事件调用本窗口的 toggle 命令。
 */
export type TitleBarPress = 'ignore' | 'arm-drag';

/** 超过该位移才认为是拖动，避免单击时短暂抖动触发原生移动循环。 */
export const TITLE_BAR_DRAG_THRESHOLD = 3;

export function resolveTitleBarPress(
  button: number,
  interactive: boolean,
  detail = 1
): TitleBarPress {
  return button === 0 && !interactive && detail <= 1 ? 'arm-drag' : 'ignore';
}

export function isDragThresholdExceeded(deltaX: number, deltaY: number): boolean {
  return Math.hypot(deltaX, deltaY) >= TITLE_BAR_DRAG_THRESHOLD;
}

export function isTitleBarToggleGesture(button: number, interactive: boolean): boolean {
  return button === 0 && !interactive;
}
