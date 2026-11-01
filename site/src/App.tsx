import { useEffect, useState, type CSSProperties } from "react";
import { SITE_CONTENT, type Locale } from "./locales/content";
import { HeroSection } from "./components/HeroSection";
import { TaglineRevealSection } from "./components/TaglineRevealSection";
import { CardDrawShowcase } from "./components/CardDrawShowcase";
import { EcosystemSection } from "./components/EcosystemSection";
import { FaqSection } from "./components/FaqSection";
import { Footer } from "./components/Footer";
import { useSiteTheme } from "./hooks/useSiteTheme";

/**
 * Interpolate RGB between Hero off-white (#F7F7F5 -> 247, 247, 245)
 * and mono-color-skill Warm Paper (#F5F1E8 -> 245, 241, 232) as the user scrolls down.
 */
function interpolateSubstrateColor(mix: number): string {
  const clamped = Math.max(0, Math.min(1, mix));
  const r = Math.round(247 + (245 - 247) * clamped);
  const g = Math.round(247 + (241 - 247) * clamped);
  const b = Math.round(245 + (232 - 245) * clamped);
  return `${r} ${g} ${b}`;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      return localStorage.getItem("iox-site-locale") === "en" ? "en" : "zh";
    } catch {
      return "zh";
    }
  });
  const { theme, toggleTheme } = useSiteTheme();
  const [paperMix, setPaperMix] = useState<number>(0);
  const content = SITE_CONTENT[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    try {
      localStorage.setItem("iox-site-locale", locale);
    } catch {
      // Language selection also works without browser storage.
    }
  }, [locale]);

  useEffect(() => {
    let rafId = 0;

    const updateScrollColor = () => {
      const vh = window.innerHeight || 800;
      const mix = Math.max(
        0,
        Math.min(1, (window.scrollY - vh * 0.15) / (vh * 0.8))
      );
      setPaperMix(mix);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateScrollColor);
    };

    updateScrollColor();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const substrateBg = interpolateSubstrateColor(paperMix);

  return (
    <div
      className="site-shell min-h-screen text-ink"
      style={{ "--substrate-rgb": substrateBg } as CSSProperties}
    >
      <a
        href="#showcase"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink-carbon focus:px-4 focus:py-2 focus:text-canvas"
      >
        Skip to content
      </a>

      {/* 1. First Screen: Reference Dot-Matrix Hero */}
      <HeroSection
        content={content}
        locale={locale}
        onLocaleChange={setLocale}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* 2. Below the Fold: Mono-Color Editorial Print Wireframe */}
      <main>
        <TaglineRevealSection tagline={content.tagline} />

        {/* Unified Sticky Stage: 01 Card Flip Showcase -> 4-Way Fly-Out -> 02 Workflow Center Emergence */}
        <CardDrawShowcase
          deck={content.deck}
          workflow={content.workflow}
        />

        <EcosystemSection ecosystem={content.ecosystem} />

        <FaqSection faq={content.faq} />
      </main>

      <Footer cta={content.cta} footer={content.footer} />
    </div>
  );
}
