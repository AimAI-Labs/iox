import { useEffect } from 'react';

export type ThemeMode = 'system' | 'dark' | 'light';

/**
 * 响应系统与自定义深浅色主题切换 Hook，并动态同步悬浮窗背景透明度
 *
 * 当 theme 或 overlayOpacity 为 undefined 时跳过对应逻辑，
 * 允许由其他组件（如 Settings）独占管理主题，避免竞争 DOM。
 *
 * @param theme 目标主题 ('system' | 'dark' | 'light')，undefined 时不管理主题
 * @param overlayOpacity 悬浮窗背景透明度 (50 ~ 100)，undefined 时不管理透明度
 */
export function useTheme(theme?: ThemeMode, overlayOpacity?: number) {
  // 动态同步背景透明度 CSS 变量
  useEffect(() => {
    if (overlayOpacity === undefined) return;
    const root = document.documentElement;
    const opacityVal = Math.min(Math.max(overlayOpacity, 50), 100) / 100;
    root.style.setProperty('--overlay-opacity', opacityVal.toString());
  }, [overlayOpacity]);

  useEffect(() => {
    if (theme === undefined) return;
    const root = document.documentElement;
    const currentTheme = theme || 'system';
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        currentTheme === 'dark' ||
        (currentTheme === 'system' && mediaQuery.matches);

      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    // 立即应用计算出的主题
    applyTheme();

    // 当配置为跟随系统时，监听系统深浅色切换事件
    if (currentTheme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => {
        mediaQuery.removeEventListener('change', applyTheme);
      };
    }
  }, [theme]);
}
