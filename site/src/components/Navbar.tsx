import React from "react";
import { Moon, Sun } from "lucide-react";
import type { Locale, SiteContent } from "../locales/content";
import type { SiteTheme } from "../hooks/useSiteTheme";

interface NavbarProps {
  content: SiteContent["nav"];
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  theme: SiteTheme;
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  content,
  locale,
  onLocaleChange,
  theme,
  onToggleTheme,
}) => {
  return (
    <nav className="hero-nav" aria-label={content.navigationLabel}>
      <a href="#top" className="brand-link" aria-label={content.homeLabel}>
        <span>IOX</span>
      </a>

      <div className="nav-links">
        {content.links.map((link) => (
          <a key={link.href} href={link.href} className="nav-link">
            {link.label}
          </a>
        ))}
        <a
          href="https://github.com/AimAI-Labs/iox"
          target="_blank"
          rel="noreferrer"
          className="nav-link"
        >
          {content.github}
        </a>
      </div>

      <div className="nav-controls">
        <div className="locale-switch" role="group" aria-label={content.languageLabel} data-locale={locale}>
          <span className="locale-switch__indicator" aria-hidden="true" />
          {(["zh", "en"] as const).map((language) => (
            <button
              key={language}
              type="button"
              className="locale-switch__option button-xsm"
              aria-pressed={locale === language}
              aria-label={language === "zh" ? "切换为中文" : "Switch to English"}
              lang={language === "zh" ? "zh-CN" : "en"}
              onClick={() => onLocaleChange(language)}
            >
              {language === "zh" ? "中" : "EN"}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === "light" ? content.switchToDark : content.switchToLight}
          aria-pressed={theme === "dark"}
        >
          <Sun className="theme-toggle__sun" size={18} strokeWidth={1.7} aria-hidden="true" />
          <Moon className="theme-toggle__moon" size={18} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};
