import React, { useEffect, useRef, useState } from "react";
import type { SiteContent } from "../locales/content";

interface CardDrawShowcaseProps {
  deck: SiteContent["deck"];
}

export const CardDrawShowcase: React.FC<CardDrawShowcaseProps> = ({ deck }) => {
  const containerRef = useRef<HTMLElement | null>(null);
  const [continuousIndex, setContinuousIndex] = useState<number>(0);
  const totalCards = deck.cards.length;

  useEffect(() => {
    let rafId = 0;

    const updateProgress = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 800;
      const scrollableDistance = Math.max(1, rect.height - viewportHeight);
      const scrolled = Math.max(0, Math.min(scrollableDistance, -rect.top));
      const progress = scrolled / scrollableDistance;

      setContinuousIndex(progress * (totalCards - 1));
    };

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [totalCards]);

  const activeIndex = Math.min(
    totalCards - 1,
    Math.max(0, Math.round(continuousIndex))
  );
  const activeCard = deck.cards[activeIndex];

  const scrollToCard = (targetIdx: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const containerTop = window.scrollY + rect.top;
    const viewportHeight = window.innerHeight || 800;
    const scrollableDistance = Math.max(1, rect.height - viewportHeight);
    const targetProgress = targetIdx / Math.max(1, totalCards - 1);

    window.scrollTo({
      top: containerTop + targetProgress * scrollableDistance,
      behavior: "smooth",
    });
  };

  return (
    <section
      id="showcase"
      ref={containerRef}
      className="relative h-[380vh] w-full"
    >
      {/* Sticky Viewport Stage */}
      <div className="sticky top-0 flex min-h-screen w-full flex-col justify-between overflow-hidden px-6 py-8 md:py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-between">
          {/* Top Editorial Ruled Header Bar */}
          <div className="mono-wireframe-strong bg-[#F5F1E8]/90 px-4 py-3 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[#2148B8] caption-3">
                  ⊕ {deck.sectionTag}
                </span>
                <span className="hidden font-mono text-[#30343A]/60 caption-4 sm:inline">
                  / {deck.scrollHint}
                </span>
              </div>

              {/* Interactive Plate Selector Tabs */}
              <div
                className="flex flex-wrap items-center gap-1"
                role="tablist"
                aria-label={deck.drawStatusLabel}
              >
                {deck.cards.map((card, idx) => {
                  const isSelected = idx === activeIndex;
                  const accentBg =
                    card.inkAccent === "cobalt"
                      ? "bg-[#2148B8] text-[#F5F1E8]"
                      : "bg-[#C65F38] text-[#F5F1E8]";
                  return (
                    <button
                      key={card.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => scrollToCard(idx)}
                      className={`px-3 py-1 font-mono transition-colors duration-300 ease-editorial caption-3 focus:outline-none focus:ring-2 focus:ring-[#2148B8] ${
                        isSelected
                          ? accentBg
                          : "border border-[#30343A]/30 bg-transparent text-[#30343A] hover:border-[#30343A]"
                      }`}
                    >
                      0{idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center Asymmetric Editorial Split: Left Specimen Details + Right Stacked Card Draw Deck */}
          <div className="my-auto grid grid-cols-1 items-center gap-8 py-6 lg:grid-cols-12 lg:gap-12">
            {/* Left Column (5 cols): Active Specimen Narrative & Ruled Metadata */}
            <div className="flex flex-col justify-between lg:col-span-5">
              <div className="mono-wireframe-strong bg-[#F5F1E8] p-6 md:p-8">
                <div className="flex items-center justify-between border-b border-[#30343A]/30 pb-3">
                  <span
                    className={`font-mono caption-3 ${
                      activeCard.inkAccent === "cobalt"
                        ? "text-[#2148B8]"
                        : "text-[#C65F38]"
                    }`}
                  >
                    {activeCard.plateNo}
                  </span>
                  <span className="font-mono text-[#30343A]/70 caption-4">
                    {activeCard.badge}
                  </span>
                </div>

                <h2 className="heading-4 mt-6 text-[#242321]">
                  {activeCard.title}
                </h2>

                <div
                  className={`mt-4 border p-3 font-mono caption-3 ${
                    activeCard.inkAccent === "cobalt"
                      ? "border-[#2148B8] bg-[#2148B8]/5 text-[#2148B8]"
                      : "border-[#C65F38] bg-[#C65F38]/5 text-[#C65F38]"
                  }`}
                >
                  ✦ {activeCard.outcome}
                </div>

                <p className="body-6 mt-4 text-[#30343A]">
                  {activeCard.description}
                </p>

                <ul className="mt-6 space-y-2 border-t border-[#30343A]/30 pt-4">
                  {activeCard.bullets.map((bullet, bIdx) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-[#242321] body-6"
                    >
                      <span className="font-mono text-[#2148B8] caption-3">
                        0{bIdx + 1}
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                {/* Ruled Stat Strip */}
                <div className="mt-6 flex items-center justify-between border-t border-[#30343A] pt-4">
                  <div>
                    <div className="font-mono text-2xl font-semibold text-[#242321]">
                      {activeCard.statValue}
                    </div>
                    <div className="font-mono text-[#30343A]/75 caption-4">
                      {activeCard.statLabel}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={activeIndex === 0}
                      onClick={() => scrollToCard(Math.max(0, activeIndex - 1))}
                      className="mono-wireframe-strong px-3 py-2 font-mono text-[#30343A] transition-transform duration-300 ease-editorial caption-3 hover:bg-[#30343A] hover:text-[#F5F1E8] active:scale-95 disabled:opacity-30"
                    >
                      ← PREV
                    </button>
                    <button
                      type="button"
                      disabled={activeIndex === totalCards - 1}
                      onClick={() =>
                        scrollToCard(Math.min(totalCards - 1, activeIndex + 1))
                      }
                      className="mono-wireframe-strong px-3 py-2 font-mono text-[#30343A] transition-transform duration-300 ease-editorial caption-3 hover:bg-[#30343A] hover:text-[#F5F1E8] active:scale-95 disabled:opacity-30"
                    >
                      DRAW NEXT →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (7 cols): Stacked Card Draw Stage */}
            <div className="relative flex min-h-[360px] items-center justify-center sm:min-h-[460px] lg:col-span-7 lg:min-h-[520px]">
              {/* Background Halftone Registration Mat */}
              <div className="mono-halftone-bg mono-wireframe-box absolute inset-4 hidden sm:block" />

              {/* Stacked Cards Container */}
              <div className="relative aspect-[3/2] w-full max-w-[680px]">
                {deck.cards.map((card, idx) => {
                  // delta < 0 means this card is being drawn out (scrolled past)
                  // delta >= 0 means this card is on top (0) or waiting deeper in the deck (> 0)
                  const delta = idx - continuousIndex;
                  const isDrawnOut = delta < 0;
                  const drawProgress = isDrawnOut
                    ? Math.min(1.2, -delta)
                    : 0;
                  const stackDepth = !isDrawnOut
                    ? Math.min(4, delta)
                    : 0;

                  // Physical card-draw transform:
                  // When drawn out: lifts up, arcs to upper-right/left with a crisp card-draw rotation and fades out
                  // When stacked in deck: sits offset down-right with subtle rotational fan
                  const translateX = isDrawnOut
                    ? drawProgress * 108
                    : stackDepth * 14;
                  const translateY = isDrawnOut
                    ? -drawProgress * 84 - Math.sin(Math.min(1, drawProgress) * Math.PI) * 32
                    : stackDepth * 16;
                  const rotateDeg = isDrawnOut
                    ? drawProgress * 12
                    : stackDepth * 1.6;
                  const scale = isDrawnOut
                    ? 1 + drawProgress * 0.04
                    : Math.max(0.84, 1 - stackDepth * 0.042);
                  const opacity = isDrawnOut
                    ? Math.max(0, 1 - Math.pow(drawProgress, 1.35))
                    : Math.max(0.2, 1 - stackDepth * 0.22);

                  const zIndex = totalCards * 10 - idx * 2;
                  const accentBorder =
                    card.inkAccent === "cobalt"
                      ? "border-[#2148B8]"
                      : "border-[#C65F38]";

                  return (
                    <figure
                      key={card.id}
                      onClick={() => scrollToCard(idx)}
                      style={{
                        zIndex,
                        opacity,
                        transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotateDeg}deg) scale(${scale})`,
                        pointerEvents:
                          Math.abs(delta) < 0.6 || delta > 0 ? "auto" : "none",
                      }}
                      className="mono-wireframe-strong absolute inset-0 flex cursor-pointer flex-col justify-between bg-[#F5F1E8] p-2 transition-shadow duration-300 ease-editorial will-change-transform sm:p-3"
                    >
                      {/* Top Specimen Plate Header */}
                      <div className="flex items-center justify-between border-b border-[#30343A] px-3 py-2">
                        <div className="flex items-center gap-2 font-mono text-[#30343A] caption-3">
                          <span
                            className={`inline-block h-2 w-2 ${
                              card.inkAccent === "cobalt"
                                ? "bg-[#2148B8]"
                                : "bg-[#C65F38]"
                            }`}
                          />
                          <span>{card.placeholder.label}</span>
                        </div>
                        <span className="font-mono text-[#30343A]/75 caption-4">
                          {card.placeholder.dimensions}
                        </span>
                      </div>

                      {/* Wireframe SVG Artwork */}
                      <div
                        className={`relative flex-1 overflow-hidden border ${accentBorder} bg-[#F5F1E8]`}
                      >
                        <img
                          src={card.placeholder.src}
                          alt={card.placeholder.label}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </div>

                      {/* Bottom Replacement Path & Registration Footer */}
                      <figcaption className="flex items-center justify-between border-t border-[#30343A] px-3 py-1.5 font-mono text-[#30343A]/80 caption-5">
                        <span className="truncate">{card.placeholder.hint}</span>
                        <span className="ml-2 shrink-0 uppercase">
                          {card.plateNo}
                        </span>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Progress Ruler */}
          <div className="mono-wireframe-box flex items-center justify-between bg-[#F5F1E8]/85 px-4 py-2 font-mono text-[#30343A] caption-4">
            <span>
              {deck.drawStatusLabel}: 0{activeIndex + 1} / 0{totalCards}
            </span>
            <div className="mx-4 h-1 flex-1 bg-[#30343A]/15">
              <div
                className="h-full bg-[#2148B8] transition-transform duration-300 ease-editorial origin-left"
                style={{
                  transform: `scaleX(${
                    (continuousIndex + 1) / totalCards
                  })`,
                }}
              />
            </div>
            <span>ONE INK WIREFRAME DECK</span>
          </div>
        </div>
      </div>
    </section>
  );
};
