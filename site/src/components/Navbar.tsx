import React from "react";
import type { Locale, SiteContent } from "../locales/content";

interface NavbarProps {
  content: SiteContent["nav"];
  locale: Locale;
  onToggleLocale: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  content,
  onToggleLocale,
}) => {
  return (
    <nav className="hero-nav" aria-label="Main Navigation">
      <a href="#top" className="brand-link" aria-label="IOX Home">
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="4" height="16" rx="1.5" />
          <circle
            cx="13"
            cy="10"
            r="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
          />
        </svg>
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleLocale}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#30343A]/30 bg-white/75 px-3 py-1.5 font-mono text-xs font-semibold text-[#30343A] backdrop-blur-sm transition-colors duration-300 ease-editorial hover:border-[#111111] hover:text-[#111111]"
          aria-label="Switch Language"
        >
          <span>{content.langSwitch}</span>
        </button>

        <a href="#download" className="signin-btn">
          {content.download}
        </a>
      </div>
    </nav>
  );
};
