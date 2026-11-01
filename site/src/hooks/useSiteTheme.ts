import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export type SiteTheme = "light" | "dark";

export function useSiteTheme() {
  const [theme, setTheme] = useState<SiteTheme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  );
  const transitioning = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem("iox-site-theme", theme);
    } catch {
      // Theme switching remains available when browser storage is disabled.
    }
  }, [theme]);

  function toggleTheme() {
    if (transitioning.current) return;
    const next = theme === "light" ? "dark" : "light";
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = next;
      flushSync(() => setTheme(next));
    };

    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply();
      return;
    }

    root.dataset.themeTransition = next;
    root.style.setProperty("--theme-sweep-size", `${window.innerWidth + window.innerHeight}px`);
    transitioning.current = true;
    try {
      const transition = document.startViewTransition(apply);
      void transition.finished.catch(() => {}).finally(() => {
        transitioning.current = false;
        delete root.dataset.themeTransition;
      });
    } catch {
      transitioning.current = false;
      delete root.dataset.themeTransition;
      apply();
    }
  }

  return { theme, toggleTheme };
}
