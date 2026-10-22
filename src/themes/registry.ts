import type { UiStyle } from '@/types/config';

export type { UiStyle };

export interface UiTheme {
  readonly id: string;
  /** 窗口外框由系统绘制 (native) 还是应用自绘 (custom) */
  readonly windowChrome: 'custom' | 'native';
  /** 自绘标题栏内的窗口控制形式 */
  readonly titleBarControls: 'traffic-lights' | 'hidden';
}

/**
 * 样式策略注册表：新增样式时先扩展 `UiStyle`，
 * 此处缺少条目会直接产生类型错误，避免样式与配置脱节。
 */
export const uiThemes: Record<UiStyle, UiTheme> = {
  classic: {
    id: 'classic',
    windowChrome: 'custom',
    titleBarControls: 'traffic-lights',
  },
  windows: {
    id: 'windows',
    windowChrome: 'native',
    titleBarControls: 'hidden',
  },
};

export function resolveUiTheme(style?: string): UiTheme {
  if (style && Object.prototype.hasOwnProperty.call(uiThemes, style)) {
    return uiThemes[style as UiStyle];
  }
  return uiThemes.classic;
}
