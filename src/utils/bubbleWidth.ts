import { ActionConfig } from '@/types/config';

/**
 * 根据启用的 Action 列表自适应计算胶囊悬浮气泡条（BubbleBar）所需的物理窗口宽度 (px)
 */
export function calculateBubbleWidth(actions?: ActionConfig[], iconOnly = false): number {
  if (!actions || actions.length === 0) {
    return 220;
  }

  const enabledActions = actions.filter((a) => a.enabled);
  if (enabledActions.length === 0) {
    return 220;
  }

  // 基础固定组件与边距 (px)：
  // - 拖拽指示手柄 (16px) + gap (2px)
  // - 分割线 (5px)
  // - Logo/设置入口 (24px)
  // - 外层胶囊容器内边距 px-1.5 (12px)
  // - 边框与安全呼吸内边距 padding (12px)
  // - 渲染阴影与安全缓冲裕量 (18px)
  let totalWidth = 16 + 2 + 5 + 24 + 12 + 12 + 18;

  // 按钮间距 gap-[2px]
  if (enabledActions.length > 1) {
    totalWidth += (enabledActions.length - 1) * 2;
  }

  if (iconOnly) {
    // 纯图标模式下每个按钮固定宽度 23px
    totalWidth += enabledActions.length * 23;
  } else {
    for (const action of enabledActions) {
      // 单个按钮内边距 px-1.5 (12px) + 图标 (14px) + gap-1 (4px)
      let btnW = 12 + 14 + 4;
      // 计算文本宽度 (11.5px 字体: ASCII 字符约 7.5px, 中文/全角字符约 13px)
      for (let i = 0; i < action.name.length; i++) {
        const code = action.name.charCodeAt(i);
        if (code >= 0 && code <= 127) {
          btnW += 7.5;
        } else {
          btnW += 13;
        }
      }
      totalWidth += btnW;
    }
  }

  const minW = iconOnly ? 160 : 220;
  const finalWidth = Math.ceil(totalWidth);
  return Math.min(Math.max(finalWidth, minW), 1200);
}

