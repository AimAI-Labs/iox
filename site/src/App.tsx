import { useEffect, useState } from "react";
import { SITE_CONTENT, type Locale } from "./locales/content";
import { HeroSection } from "./components/HeroSection";
import { TaglineRevealSection } from "./components/TaglineRevealSection";
import { CardDrawShowcase } from "./components/CardDrawShowcase";
import { WorkflowSection } from "./components/WorkflowSection";
import { EcosystemSection } from "./components/EcosystemSection";
import { FaqSection } from "./components/FaqSection";
import { Footer } from "./components/Footer";

/**
 * Interpolate RGB between Hero off-white (#F7F7F5 -> 247, 247, 245)
 * and mono-color-skill Warm Paper (#F5F1E8 -> 245, 241, 232) as the user scrolls down.
 */
function interpolateSubstrateColor(mix: number): string {
  const clamped = Math.max(0, Math.min(1, mix));
  const r = Math.round(247 + (245 - 247) * clamped);
  const g = Math.round(247 + (241 - 247) * clamped);
  const b = Math.round(245 + (232 - 245) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [paperMix, setPaperMix] = useState<number>(0);
  const content = SITE_CONTENT[locale];

  useEffect(() => {
    let rafId = 0;

    const updateScrollColor = () => {
      const vh = window.innerHeight || 800;
      // Transition starts at 15% of hero height and completes by 95% of hero height
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

  const handleToggleLocale = () => {
    setLocale((prev) => (prev === "zh" ? "en" : "zh"));
  };

  const substrateBg = interpolateSubstrateColor(paperMix);

  return (
    <div
      className="min-h-screen text-[#111111] transition-colors duration-300 ease-editorial"
      style={{ backgroundColor: substrateBg }}
    >
      <a
        href="#showcase"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[#242321] focus:px-4 focus:py-2 focus:text-[#F5F1E8]"
      >
        Skip to content
      </a>

      {/* 1. First Screen: Reference Dot-Matrix Hero */}
      <HeroSection
        content={content}
        locale={locale}
        onToggleLocale={handleToggleLocale}
      />

      {/* 2. Below the Fold: Transitions into Mono-Color Editorial Print Wireframe */}
      <main>
        <TaglineRevealSection tagline={content.tagline} />

        <CardDrawShowcase deck={content.deck} />

        <WorkflowSection workflow={content.workflow} />

        <EcosystemSection ecosystem={content.ecosystem} />

        <FaqSection faq={content.faq} />
      </main>

      <Footer cta={content.cta} footer={content.footer} />
    </div>
  );
}
