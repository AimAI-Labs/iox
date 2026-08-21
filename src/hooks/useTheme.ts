import { useEffect, useState } from 'react';
import { listen, emit } from '@tauri-apps/api/event';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeEventPayload {
  theme: ThemeMode;
  overlayOpacity?: number;
}

/**
 * 全局广播主题变更事件给所有 Webview 窗口
 */
export async function broadcastThemeChange(theme: ThemeMode, overlayOpacity?: number) {
  try {
    await emit('theme_changed', { theme, overlayOpacity });
  } catch (err) {
    console.warn('Failed to broadcast theme_changed:', err);
  }
}

/**
 * 响应系统与自定义深浅色主题切换 Hook，并动态同步悬浮窗背景透明度
 * @param theme 目标主题 ('system' | 'dark' | 'light')
 * @param overlayOpacity 悬浮窗背景透明度 (50 ~ 100)
 */
export function useTheme(theme: ThemeMode = 'system', overlayOpacity: number = 90) {
  const [activeTheme, setActiveTheme] = useState<ThemeMode>(theme || 'system');
  const [activeOpacity, setActiveOpacity] = useState<number>(overlayOpacity ?? 90);

  useEffect(() => {
    setActiveTheme(theme || 'system');
  }, [theme]);

  useEffect(() => {
    setActiveOpacity(overlayOpacity ?? 90);
  }, [overlayOpacity]);

  // 监听来自其他窗口的实时主题与透明度广播
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<ThemeEventPayload>('theme_changed', (event) => {
      if (event.payload?.theme) {
        setActiveTheme(event.payload.theme);
      }
      if (event.payload?.overlayOpacity !== undefined) {
        setActiveOpacity(event.payload.overlayOpacity);
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.warn('Failed to listen to theme_changed:', err);
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // 动态同步背景透明度 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    const opacityVal = Math.min(Math.max(activeOpacity ?? 90, 50), 100) / 100;
    root.style.setProperty('--overlay-opacity', opacityVal.toString());
  }, [activeOpacity]);

  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = activeTheme || 'system';
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
  }, [activeTheme]);
}

