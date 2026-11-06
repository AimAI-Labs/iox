/**
 * 标题栏拖拽/双击的唯一手势判定。
 *
 * Tauri 内置的 `data-tauri-drag-region` 会在双击时自行调用
 * `internal_toggle_maximize`，与组件里的 `onDoubleClick -> toggle_maximize_*`
 * 叠加后一次双击会切换两次最大化状态，表现为圆角模式下双击导航栏无法稳定放大。
 * 自定义标题栏因此不再声明 drag region 属性，统一由本函数决定行为。
 */
export type TitleBarPress = 'ignore' | 'drag' | 'toggle-maximize';

export function resolveTitleBarPress(
  button: number,
  detail: number,
  interactive: boolean
): TitleBarPress {
  if (button !== 0 || interactive) return 'ignore';
  // 第二次按下仍是同一次拖拽手势的一部分，只切换一次最大化，不再重复 startDragging。
  return detail >= 2 ? 'toggle-maximize' : 'drag';
}
