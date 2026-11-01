import React, { useEffect, useRef, useState } from "react";
import type { SiteContent } from "../locales/content";

interface TaglineRevealSectionProps {
  tagline: SiteContent["tagline"];
}

export const TaglineRevealSection: React.FC<TaglineRevealSectionProps> = ({
  tagline,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeWordCount, setActiveWordCount] = useState<number>(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setActiveWordCount(tagline.words.length);
      return;
    }

    let rafId = 0;
    const updateReveal = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;

      // Start revealing when section top enters 78% of viewport, finish when top reaches 22%
      const start = vh * 0.78;
      const end = vh * 0.22;
      const progress = Math.max(
        0,
        Math.min(1, (start - rect.top) / Math.max(1, start - end))
      );

      const count = Math.round(progress * tagline.words.length);
      setActiveWordCount(count);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateReveal);
    };

    updateReveal();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [tagline.words.length]);

  return (
    <section
      ref={sectionRef}
      aria-label={tagline.indexLabel}
      className="relative mx-auto max-w-6xl px-6 py-20 md:py-24"
    >
      {/* Editorial registration header strip */}
      <div className="mono-wireframe-box flex flex-wrap items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-2 font-mono text-[#2148B8] caption-3">
          <span>⊕</span>
          <span>{tagline.indexLabel}</span>
        </div>
        <span className="font-mono text-[#30343A]/70 caption-4">
          PLATE 00 · EDITORIAL STATEMENT
        </span>
      </div>

      {/* B11 Mandatory Word-by-Word Tagline Reveal */}
      <div className="mt-12 max-w-[680px]">
        <p className="heading-3 flex flex-wrap gap-x-2 gap-y-2 leading-tight">
          {tagline.words.map((word, idx) => {
            const isRevealed = idx < activeWordCount;
            return (
              <span
                key={`${word}-${idx}`}
                className="transition-opacity duration-500 ease-editorial"
                style={{
                  color: idx === 2 || word === "IOX" ? "#2148B8" : "#30343A",
                  opacity: isRevealed ? 1 : 0.26,
                }}
              >
                {word}
              </span>
            );
          })}
        </p>
      </div>

      {/* Active negative space release zone + bottom ruled microcopy */}
      <div className="mt-12 flex items-center justify-between border-t border-[#30343A]/30 pt-4 font-mono text-[#30343A]/75 caption-4">
        <span>{tagline.caption}</span>
        <span>EMPTY PAPER QUOTA ≥ 35%</span>
      </div>
    </section>
  );
};
