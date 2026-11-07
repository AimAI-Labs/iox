import { createContext, useContext, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { resolveUiTheme, uiThemes, type UiTheme } from './registry';

const ThemeContext = createContext<UiTheme>(uiThemes.classic);

export function ThemeProvider({ style, children }: { style?: string; children: ReactNode }) {
  const theme = resolveUiTheme(style);

  useLayoutEffect(() => {
    document.documentElement.dataset.uiStyle = theme.id;
  }, [theme]);

  useEffect(() => {
    let disposed = false;
    const syncMaximized = () => {
      try {
        void getCurrentWindow()
          .isMaximized()
          .then((maximized) => {
            if (!disposed) {
              document.documentElement.dataset.maximized = maximized ? 'true' : 'false';
            }
          })
          .catch(() => {});
      } catch {
        // Ignore outside Tauri runtime (e.g. unit tests)
      }
    };
    syncMaximized();
    window.addEventListener('resize', syncMaximized);
    return () => {
      disposed = true;
      window.removeEventListener('resize', syncMaximized);
    };
  }, []);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useUiTheme() {
  return useContext(ThemeContext);
}
