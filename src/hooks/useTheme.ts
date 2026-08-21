import { useEffect, useState, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeEventPayload {
  theme: ThemeMode;
  overlayOpacity?: number;
}

// 记录最近一次主动执行的 View Transition，防止 useEffect 二次触发碰撞闪屏
let lastTransitionHandled: { timestamp: number; isDark: boolean } | null = null;

/**
 * 统一切换主题（带水滴扩散/收缩过渡动效与鼠标点击原点捕获）
 * @param targetTheme 目标主题 ('system' | 'dark' | 'light')
 * @param originX 水滴圆心横坐标 (默认窗口中心)
 * @param originY 水滴圆心纵坐标 (默认窗口中心)
 * @param onPersist 配置持久化与跨窗口广播回调
 */
export function switchThemeWithTransition(
  targetTheme: ThemeMode,
  originX?: number,
  originY?: number,
  onPersist?: () => void
) {
  const root = document.documentElement;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const willBeDark =
    targetTheme === 'dark' || (targetTheme === 'system' && mediaQuery.matches);
  const isCurrentlyDark = root.classList.contains('dark');

  // 如果深浅色模式实质上没有变化，直接同步配置返回，避免无谓重绘
  if (willBeDark === isCurrentlyDark) {
    onPersist?.();
    return;
  }

  const applyDOM = () => {
    if (willBeDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    onPersist?.();
  };

  const doc = document as any;
  if (!doc.startViewTransition) {
    applyDOM();
    return;
  }

  const x = originX ?? window.innerWidth / 2;
  const y = originY ?? window.innerHeight / 2;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  // 记录本次过渡，防止后续 useEffect 重复触发造成闪屏
  lastTransitionHandled = {
    timestamp: Date.now(),
    isDark: willBeDark,
  };

  try {
    const transition = doc.startViewTransition(() => {
      applyDOM();
    });

    transition.ready
      ?.then(() => {
        if (willBeDark) {
          // 浅色 -> 深色：深色新视图从点击原点向外扩散至全屏 (Expand)
          root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 400,
              easing: 'cubic-bezier(0.2, 0, 0, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          );
        } else {
          // 深色 -> 浅色：深色旧视图向点击原点收缩 (Shrink)，露出底层浅色新视图
          root.animate(
            {
              clipPath: [
                `circle(${endRadius}px at ${x}px ${y}px)`,
                `circle(0px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 400,
              easing: 'cubic-bezier(0.2, 0, 0, 1)',
              pseudoElement: '::view-transition-old(root)',
            }
          );
        }
      })
      .catch((err: any) => {
        console.warn('View Transition animation error:', err);
      });
  } catch {
    applyDOM();
  }
}

/**
 * 兼容旧签名的包装函数
 */
export function toggleThemeWithTransition(
  applyNewTheme: () => void,
  originX?: number,
  originY?: number
) {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  switchThemeWithTransition(isDark ? 'light' : 'dark', originX, originY, applyNewTheme);
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
      return;
    }

    const willBeDark =
      currentTheme === 'dark' ||
      (currentTheme === 'system' && mediaQuery.matches);
    const isCurrentlyDark = root.classList.contains('dark');

    // 检查是否已经在 switchThemeWithTransition 中由点击事件执行了过渡
    if (
      lastTransitionHandled &&
      Date.now() - lastTransitionHandled.timestamp < 1000 &&
      lastTransitionHandled.isDark === willBeDark
    ) {
      return;
    }

    if (willBeDark === isCurrentlyDark) {
      return;
    }

    // 来自外部（系统切换或跨窗口广播）的被动变更
    switchThemeWithTransition(currentTheme);

    // 当配置为跟随系统时，监听系统深浅色切换事件
    if (currentTheme === 'system') {
      const handleChange = () => switchThemeWithTransition('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [activeTheme]);
}
