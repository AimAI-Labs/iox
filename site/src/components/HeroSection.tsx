import React from "react";
import { DotMatrixCanvas } from "./DotMatrixCanvas";
import { Navbar } from "./Navbar";
import SpecularButton from "./SpecularButton/SpecularButton";
import { AiProviderLogos } from "./AiProviderLogos";
import type { Locale, SiteContent } from "../locales/content";
import type { SiteTheme } from "../hooks/useSiteTheme";

interface HeroSectionProps {
  content: SiteContent;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  theme: SiteTheme;
  onToggleTheme: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  content,
  locale,
  onLocaleChange,
  theme,
  onToggleTheme,
}) => {
  const { hero, nav } = content;

  return (
    <section id="top" className="hero">
      {/* Dynamic Dot-Matrix LED Halftone Canvas */}
      <DotMatrixCanvas theme={theme} />

      {/* Top Navigation */}
      <Navbar
        content={nav}
        locale={locale}
        onLocaleChange={onLocaleChange}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {/* Copy block — strictly aligned with reference geometry so hands frame the CTA */}
      <div className="copy">
        <h1>
          <span className="line-reconnecting">{hero.titleMuted}</span>
          <span className="line-creativity">{hero.titleInk}</span>
        </h1>
        <p className="subline">{hero.subline}</p>
        <div className="hero-cta">
          <SpecularButton
            size="sm"
            radius={999}
            tint="#111111"
            tintOpacity={0.96}
            baseColor="#8a8a8a"
            intensity={1.4}
            glow={1.4}
            autoAnimate
            speed={0.7}
            followMouse={false}
            className="specular-button--rainbow"
            onClick={() => { window.location.hash = "download"; }}
          >
            {hero.primaryCta}
          </SpecularButton>
        </div>
      </div>

      {/* Supported AI Ecosystem Logos Bar */}
      <AiProviderLogos label={hero.ecosystemLabel} />
    </section>
  );
};
