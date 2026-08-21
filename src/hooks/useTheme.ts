import { useEffect, useState, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeEventPayload {
  theme: ThemeMode;
  overlayOpacity?: number;
}

/**
 * 带水滴扩散与收缩圆形遮罩 (Clip-Path) 的主题切换动效
 */
export function toggleThemeWithTransition(
  applyNewTheme: () => void,
  originX?: number,
  originY?: number
) {
  // 检查浏览器/Webview 是否支持 View Transitions API
  const doc = document as any;
  if (!doc.startViewTransition) {
    applyNewTheme();
    return;
  }

  const x = originX ?? window.innerWidth / 2;
  const y = originY ?? window.innerHeight / 2;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = doc.startViewTransition(() => {
    applyNewTheme();
  });

  transition.ready
    ?.then(() => {
      const isDark = document.documentElement.classList.contains('dark');
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      document.documentElement.animate(
        {
          clipPath: isDark ? clipPath : [...clipPath].reverse(),
        },
        {
          duration: 380,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
          pseudoElement: isDark
            ? '::view-transition-new(root)'
            : '::view-transition-old(root)',
        }
      );
    })
    .catch(() => {
      // 降级处理
      applyNewTheme();
    });
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
  const isInitialMountRef = useRef(true);

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

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      applyTheme();
    } else {
      toggleThemeWithTransition(applyTheme);
    }

    // 当配置为跟随系统时，监听系统深浅色切换事件
    if (currentTheme === 'system') {
      const handleChange = () => toggleThemeWithTransition(applyTheme);
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [activeTheme]);
}

