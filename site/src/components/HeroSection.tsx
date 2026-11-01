import React from "react";
import { DotMatrixCanvas } from "./DotMatrixCanvas";
import { Navbar } from "./Navbar";
import type { Locale, SiteContent } from "../locales/content";

interface HeroSectionProps {
  content: SiteContent;
  locale: Locale;
  onToggleLocale: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  content,
  locale,
  onToggleLocale,
}) => {
  const { hero, nav } = content;

  return (
    <section id="top" className="hero">
      {/* Dynamic Dot-Matrix LED Halftone Canvas */}
      <DotMatrixCanvas />

      {/* Top Navigation */}
      <Navbar
        content={nav}
        locale={locale}
        onToggleLocale={onToggleLocale}
      />

      {/* Copy block — strictly aligned with reference geometry so hands frame the CTA */}
      <div className="copy">
        <h1>
          <span className="line-reconnecting">{hero.titleMuted}</span>
          <span className="line-creativity">{hero.titleInk}</span>
        </h1>
        <p className="subline">{hero.subline}</p>
        <a href="#download" className="cta" aria-label={hero.primaryCta}>
          <span className="cta-pill">{hero.primaryCta}</span>
        </a>
      </div>

      {/* Supported AI Ecosystem Logos Bar */}
      <div className="logos" aria-label={hero.ecosystemLabel}>
        <div className="logo-item">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 1a9 9 0 110 18 9 9 0 010-18zm0 3a6 6 0 100 12 6 6 0 000-12zm0 3a3 3 0 110 6 3 3 0 010-6z" />
          </svg>
          <span>OpenAI</span>
        </div>

        <div className="logo-item">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 15c0-7 5-12 14-12-1 9-6 14-13 13l-1 2-2-1z" />
          </svg>
          <span>DeepSeek</span>
        </div>

        <div className="logo-item">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 1l8 4.5v9L10 19l-8-4.5v-9zM10 6l-4 2.3v4.4L10 15l4-2.3V8.3z" />
          </svg>
          <span>Claude</span>
        </div>

        <div className="logo-item">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M1 5q4.5-3 9 0t9 0v3q-4.5 3-9 0t-9 0zm0 7q4.5-3 9 0t9 0v3q-4.5 3-9 0t-9 0z" />
          </svg>
          <span>Qwen</span>
        </div>

        <div className="logo-item">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M1 17L7 6l3 5 3-7 6 13z" />
          </svg>
          <span>Gemini</span>
        </div>

        <div className="logo-item">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 1l9 4-9 4-9-4zm-9 8l9 4 9-4v3l-9 4-9-4zm0 5l9 4 9-4v2l-9 4-9-4z" />
          </svg>
          <span>Ollama</span>
        </div>
      </div>
    </section>
  );
};
