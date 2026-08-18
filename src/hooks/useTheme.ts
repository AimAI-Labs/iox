import { useEffect } from 'react';

export type ThemeMode = 'system' | 'dark' | 'light';

/**
 * 响应系统与自定义深浅色主题切换 Hook
 * @param theme 目标主题 ('system' | 'dark' | 'light')
 */
export function useTheme(theme: ThemeMode = 'system') {
  useEffect(() => {
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
