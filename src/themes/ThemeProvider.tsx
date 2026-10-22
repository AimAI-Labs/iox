import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import { resolveUiTheme, uiThemes, type UiTheme } from './registry';

const ThemeContext = createContext<UiTheme>(uiThemes.classic);

export function ThemeProvider({ style, children }: { style?: string; children: ReactNode }) {
  const theme = resolveUiTheme(style);

  useLayoutEffect(() => {
    document.documentElement.dataset.uiStyle = theme.id;
  }, [theme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useUiTheme() {
  return useContext(ThemeContext);
}
