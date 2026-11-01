import React, { useEffect, useRef, useState } from "react";
import type { SiteContent } from "../locales/content";

interface CardDrawShowcaseProps {
  deck: SiteContent["deck"];
  workflow: SiteContent["workflow"];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export const CardDrawShowcase: React.FC<CardDrawShowcaseProps> = ({
  deck,
  workflow,
}) => {
  const containerRef = useRef<HTMLElement | null>(null);
  // Normalized overall scroll progress P in [0, 1] across the entire 580vh stage
  const [progress, setProgress] = useState<number>(0);
  const totalCards = deck.cards.length;

  useEffect(() => {
    let rafId = 0;

    const updateScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const scrollable = Math.max(1, rect.height - vh);
      const scrolled = clamp(-rect.top, 0, scrollable);
      setProgress(scrolled / scrollable);
    };

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateScroll);
    };

    updateScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Timeline allocation across P in [0, 1]:
  // - [0.00, 0.58]: Phase 1 — Card Draw & 3D Flip Showcase (Plates 01 -> 05)
  // - [0.58, 0.80]: Phase 2 — 4-way Fly-out of 01 components (Up/Down/Left/Right) + Center Emergence of 02 Workflow
  // - [0.80, 1.00]: Phase 3 — 02 Workflow Hold & Step Highlight (Step 01 -> 02 -> 03)
  const PHASE1_END = 0.58;
  const PHASE2_END = 0.80;

  const deckRatio = clamp(progress / PHASE1_END, 0, 1);
  const continuousIndex = deckRatio * (totalCards - 1);
  const activeIndex = clamp(Math.round(continuousIndex), 0, totalCards - 1);
  const activeCard = deck.cards[activeIndex];

  // Phase 2 transition progress (0 -> 1)
  const rawTransition = clamp(
    (progress - PHASE1_END) / (PHASE2_END - PHASE1_END),
    0,
    1
  );
  const flyOut = easeInOutCubic(rawTransition);

  // Workflow emergence starts slightly into the fly-out (rawTransition in [0.18, 1.0])
  // so the center opens up as the 4 parts of 01 split apart
  const workflowEnter = easeOutCubic(
    clamp((rawTransition - 0.18) / 0.82, 0, 1)
  );

  // Phase 3 step emphasis across P in [0.76, 0.98]
  const workflowHoldRatio = clamp((progress - 0.76) / 0.22, 0, 1);
  const activeWorkflowStep = Math.min(
    workflow.steps.length - 1,
    Math.floor(workflowHoldRatio * workflow.steps.length)
  );

  const scrollToProgress = (targetP: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const containerTop = window.scrollY + rect.top;
    const vh = window.innerHeight || 800;
    const scrollable = Math.max(1, rect.height - vh);

    window.scrollTo({
      top: containerTop + clamp(targetP, 0, 1) * scrollable,
      behavior: "smooth",
    });
  };

  const scrollToCard = (targetIdx: number) => {
    const cardRatio = targetIdx / Math.max(1, totalCards - 1);
    scrollToProgress(cardRatio * PHASE1_END);
  };

  const isPhase1Interactive = rawTransition < 0.45;
  const isWorkflowInteractive = rawTransition >= 0.35;

  return (
    <section
      id="showcase"
      ref={containerRef}
      className="relative h-[580vh] w-full select-none"
    >
      {/* Anchor marker at 82% of container height so #workflow nav link scrolls straight to Stage 3 */}
      <div
        id="workflow"
        className="pointer-events-none absolute left-0 top-[78%] h-px w-full"
        aria-hidden="true"
      />

      {/* Sticky Full-Viewport Stage */}
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden px-6 py-8 md:py-10">
        {/* ── LAYER 1: 01 / Card Draw Showcase (4 Directional Fly-Out Groups) ── */}
        <div
          aria-hidden={!isPhase1Interactive}
          style={{
            pointerEvents: isPhase1Interactive ? "auto" : "none",
          }}
          className="mx-auto flex h-full w-full max-w-6xl flex-col justify-between"
        >
          {/* 1A. TOP BAR — Flies UP on transition */}
          <div
            style={{
              opacity: Math.max(0, 1 - flyOut * 1.25),
              transform: `translate3d(0, ${-flyOut * 180}px, 0) scale(${
                1 - flyOut * 0.04
              })`,
            }}
            className="mono-wireframe-strong bg-[#F5F1E8]/95 px-4 py-3 backdrop-blur-sm will-change-transform"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[#2148B8] caption-3">
                  ⊕ {deck.sectionTag}
                </span>
                <span className="hidden font-mono text-[#30343A]/60 caption-4 sm:inline">
                  / {deck.scrollHint}
                </span>
              </div>

              {/* Interactive Plate Selector Tabs 01..05 */}
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

          {/* CENTER SPLIT: Left Intro (flies LEFT) + Right Card Flip Stack (flies RIGHT) */}
          <div className="my-auto grid grid-cols-1 items-center gap-6 py-4 lg:grid-cols-12 lg:gap-10">
            {/* 1B. LEFT INTRODUCTION PANEL — Flies LEFT on transition */}
            <div
              style={{
                opacity: Math.max(0, 1 - flyOut * 1.15),
                transform: `translate3d(${-flyOut * 520}px, 0, 0) rotate(${
                  -flyOut * 5
                }deg)`,
              }}
              className="flex flex-col justify-between will-change-transform lg:col-span-5"
            >
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

                {/* Keyed content wrapper for crisp text update when activeIndex changes */}
                <div
                  key={activeCard.id}
                  className="animate-fade-in transition-opacity duration-300 ease-editorial"
                >
                  <h2 className="heading-4 mt-5 text-[#242321]">
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

                  <ul className="mt-5 space-y-2 border-t border-[#30343A]/30 pt-4">
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
                </div>

                {/* Ruled Stat Strip & Manual Prev/Next Buttons */}
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
                      onClick={() => {
                        if (activeIndex < totalCards - 1) {
                          scrollToCard(activeIndex + 1);
                        } else {
                          scrollToProgress(0.86);
                        }
                      }}
                      className="mono-wireframe-strong px-3 py-2 font-mono text-[#30343A] transition-transform duration-300 ease-editorial caption-3 hover:bg-[#30343A] hover:text-[#F5F1E8] active:scale-95"
                    >
                      DRAW NEXT →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 1C. RIGHT 3D CARD FLIP & DRAW STACK — Flies RIGHT on transition */}
            <div
              style={{
                opacity: Math.max(0, 1 - flyOut * 1.15),
                transform: `translate3d(${flyOut * 560}px, 0, 0) rotate(${
                  flyOut * 5
                }deg)`,
                perspective: "1400px",
              }}
              className="relative flex min-h-[320px] items-center justify-center will-change-transform sm:min-h-[420px] lg:col-span-7 lg:min-h-[480px]"
            >
              {/* Background Halftone Registration Mat */}
              <div className="mono-halftone-bg mono-wireframe-box absolute inset-4 hidden sm:block" />

              {/* 3D Stacked Deck Container */}
              <div
                className="relative aspect-[3/2] w-full max-w-[660px]"
                style={{ transformStyle: "preserve-3d" }}
              >
                {deck.cards.map((card, idx) => {
                  // delta = idx - continuousIndex:
                  // - delta == 0: card is active on top of the stack
                  // - delta > 0: card is waiting underneath in the deck (fanned down-right)
                  // - delta < 0: card is being flipped & drawn off the top of the deck
                  const delta = idx - continuousIndex;
                  const isFlippedOut = delta < 0;
                  const flipAmount = isFlippedOut ? clamp(-delta, 0, 1.15) : 0;
                  const stackDepth = !isFlippedOut ? clamp(delta, 0, 4) : 0;

                  // 3D Card Flip + Draw Physics:
                  // As a card flips out (delta: 0 -> -1), it lifts up, rotates around Y (-38deg) and X (14deg) and Z (8deg),
                  // and arcs away while revealing the next card rising smoothly from stackDepth 1 -> 0!
                  const translateX = isFlippedOut
                    ? flipAmount * 145
                    : stackDepth * 14;
                  const translateY = isFlippedOut
                    ? -flipAmount * 95 -
                      Math.sin(Math.min(1, flipAmount) * Math.PI) * 38
                    : stackDepth * 15;
                  const translateZ = isFlippedOut
                    ? flipAmount * 90
                    : -stackDepth * 28;
                  const rotateY = isFlippedOut ? -flipAmount * 36 : 0;
                  const rotateX = isFlippedOut ? flipAmount * 14 : 0;
                  const rotateZ = isFlippedOut
                    ? flipAmount * 9
                    : stackDepth * 1.5;
                  const scale = isFlippedOut
                    ? 1 + flipAmount * 0.02
                    : Math.max(0.85, 1 - stackDepth * 0.038);
                  const opacity = isFlippedOut
                    ? Math.max(0, 1 - Math.pow(flipAmount, 1.25))
                    : Math.max(0.28, 1 - stackDepth * 0.18);

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
                        transform: `translate3d(${translateX}px, ${translateY}px, ${translateZ}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
                        pointerEvents:
                          Math.abs(delta) < 0.55 || delta > 0 ? "auto" : "none",
                      }}
                      className="mono-wireframe-strong absolute inset-0 flex cursor-pointer flex-col justify-between bg-[#F5F1E8] p-2 will-change-transform sm:p-3"
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

          {/* 1D. BOTTOM PROGRESS RULER — Flies DOWN on transition */}
          <div
            style={{
              opacity: Math.max(0, 1 - flyOut * 1.25),
              transform: `translate3d(0, ${flyOut * 180}px, 0) scale(${
                1 - flyOut * 0.04
              })`,
            }}
            className="mono-wireframe-box flex items-center justify-between bg-[#F5F1E8]/90 px-4 py-2 font-mono text-[#30343A] will-change-transform caption-4"
          >
            <span>
              {deck.drawStatusLabel}: 0{activeIndex + 1} / 0{totalCards}
            </span>
            <div className="mx-4 h-1 flex-1 bg-[#30343A]/15">
              <div
                className="h-full origin-left bg-[#2148B8]"
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

        {/* ── LAYER 2: ⊕ 02 / 交互机制信息表 (Emerges from Center as 01 Flies Out) ── */}
        <div
          aria-hidden={!isWorkflowInteractive}
          style={{
            opacity: workflowEnter,
            transform: `translate3d(0, ${(1 - workflowEnter) * 28}px, 0) scale(${
              0.82 + 0.18 * workflowEnter
            })`,
            pointerEvents: isWorkflowInteractive ? "auto" : "none",
          }}
          className="absolute inset-0 flex items-center justify-center px-6 py-8 will-change-transform"
        >
          <div className="mono-wireframe-strong mx-auto w-full max-w-6xl bg-[#F5F1E8] p-6 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#30343A] pb-4">
              <span className="font-mono text-[#2148B8] caption-3">
                ⊕ {workflow.sectionTag}
              </span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => scrollToCard(totalCards - 1)}
                  className="border border-[#30343A]/40 px-2.5 py-1 font-mono text-[#30343A] transition-colors hover:border-[#2148B8] hover:text-[#2148B8] caption-4"
                >
                  ↑ BACK TO DECK (05)
                </button>
                <span className="hidden font-mono text-[#30343A]/75 caption-4 sm:inline">
                  LAYOUT: RULED INFORMATION POSTER
                </span>
              </div>
            </div>

            <div className="mt-6 max-w-[680px] md:mt-8">
              <h2 className="heading-2 text-[#242321]">{workflow.title}</h2>
              <p className="body-3 mt-3 text-[#30343A]">{workflow.subtitle}</p>
            </div>

            {/* 3-Column Wireframe Steps with Scroll-Linked Step Emphasis */}
            <div className="mt-8 grid grid-cols-1 gap-6 md:mt-10 md:grid-cols-3">
              {workflow.steps.map((step, index) => {
                const isHighlighted = index === activeWorkflowStep;
                const stepOffset = clamp(
                  (workflowEnter - index * 0.12) / 0.88,
                  0,
                  1
                );

                return (
                  <article
                    key={step.step}
                    style={{
                      opacity: stepOffset,
                      transform: `translate3d(0, ${
                        (1 - stepOffset) * 24
                      }px, 0)`,
                    }}
                    className={`flex flex-col justify-between border p-6 transition-colors duration-300 ease-editorial ${
                      isHighlighted
                        ? "border-[#2148B8] bg-[#2148B8]/[0.04]"
                        : "border-[#30343A] bg-[#F5F1E8]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-[#30343A]/30 pb-3">
                        <span
                          className={`font-mono caption-3 ${
                            isHighlighted
                              ? "text-[#2148B8]"
                              : "text-[#C65F38]"
                          }`}
                        >
                          {step.step}
                        </span>
                        <span className="font-mono text-[#30343A]/60 caption-5">
                          0{index + 1} / 03
                        </span>
                      </div>

                      <h3 className="title-1 mt-5 text-[#242321]">
                        {step.title}
                      </h3>
                      <div className="mt-1 font-mono text-[#30343A]/75 caption-4">
                        {step.subtitle}
                      </div>
                      <p className="body-6 mt-4 text-[#30343A]">
                        {step.detail}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-[#30343A]/40 pt-3 font-mono text-[#30343A] caption-4">
                      MODULE: {step.tag}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
