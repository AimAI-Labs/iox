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
  const targetProgressRef = useRef<number>(0);
  const currentProgressRef = useRef<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const totalCards = deck.cards.length;

  useEffect(() => {
    let rafId = 0;
    let isAnimating = false;
    let lastTime = performance.now();

    const measureTargetScroll = () => {
      const container = containerRef.current;
      if (!container) return 0;

      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const scrollable = Math.max(1, rect.height - vh);
      const scrolled = clamp(-rect.top, 0, scrollable);
      return scrolled / scrollable;
    };

    const tick = (now: number) => {
      const dt = Math.min(64, Math.max(1, now - lastTime));
      lastTime = now;

      const target = targetProgressRef.current;
      const current = currentProgressRef.current;
      const diff = target - current;

      if (Math.abs(diff) < 0.00015) {
        currentProgressRef.current = target;
        setProgress(target);
        isAnimating = false;
        return;
      }

      // Frame-rate independent exponential smoothing (~0.11 per 16.67ms frame)
      const alpha = 1 - Math.pow(1 - 0.11, dt / 16.67);
      const next = current + diff * alpha;
      currentProgressRef.current = next;
      setProgress(next);
      rafId = requestAnimationFrame(tick);
    };

    const handleScroll = () => {
      targetProgressRef.current = measureTargetScroll();
      if (!isAnimating) {
        isAnimating = true;
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    };

    const initial = measureTargetScroll();
    targetProgressRef.current = initial;
    currentProgressRef.current = initial;
    setProgress(initial);

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Timeline allocation across P in [0, 1]:
  // - [0.00, 0.58]: Phase 1 — Card Flip & Draw Showcase (Plates 01 -> 05)
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
  // Keep readable content opaque while it can still be interacted with.
  const phase1Opacity = 1 - easeOutCubic((rawTransition - 0.45) / 0.55);

  return (
    <section
      id="showcase"
      ref={containerRef}
      className="relative h-[580vh] w-full select-none"
    >
      {/* Anchor marker at 78% of container height so #workflow nav link scrolls straight to Stage 3 */}
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
              opacity: phase1Opacity,
              transform: `translate3d(0, ${-flyOut * 180}px, 0) scale(${
                1 - flyOut * 0.04
              })`,
            }}
            className="wireframe-bar mono-wireframe-strong bg-paper px-4 py-3 will-change-transform"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-plate-cobalt caption-3">
                  ⊕ {deck.sectionTag}
                </span>
                <span className="hidden font-mono text-ink-muted caption-4 sm:inline">
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
                      ? "bg-plate-cobalt text-on-accent"
                      : "bg-plate-terracotta text-on-accent";
                  return (
                    <button
                      key={card.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => scrollToCard(idx)}
                      className={`px-3 py-1 font-mono transition-colors duration-300 ease-editorial caption-3 focus:outline-none focus:ring-2 focus:ring-plate-cobalt ${
                        isSelected
                          ? accentBg
                          : "border border-rule/30 bg-transparent text-ink-charcoal hover:border-rule"
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
                opacity: phase1Opacity,
                transform: `translate3d(${-flyOut * 520}px, 0, 0) rotate(${
                  -flyOut * 5
                }deg)`,
              }}
              className="flex flex-col justify-between will-change-transform lg:col-span-5"
            >
              <div className="wireframe-panel mono-wireframe-strong bg-paper p-6 md:p-8">
                <div className="flex items-center justify-between border-b border-rule/30 pb-3">
                  <span
                    className={`font-mono caption-3 ${
                      activeCard.inkAccent === "cobalt"
                        ? "text-plate-cobalt"
                        : "text-plate-terracotta"
                    }`}
                  >
                    {activeCard.plateNo}
                  </span>
                  <span className="font-mono text-ink-muted caption-4">
                    {activeCard.badge}
                  </span>
                </div>

                <div
                  key={activeCard.id}
                  className="transition-opacity duration-300 ease-editorial"
                >
                  <h2 className="heading-4 mt-5 text-ink-carbon">
                    {activeCard.title}
                  </h2>

                  <div
                    className={`mt-4 border p-3 font-mono caption-3 ${
                      activeCard.inkAccent === "cobalt"
                        ? "border-plate-cobalt bg-plate-cobalt/5 text-plate-cobalt"
                        : "border-plate-terracotta bg-plate-terracotta/5 text-plate-terracotta"
                    }`}
                  >
                    ✦ {activeCard.outcome}
                  </div>

                  <p className="body-6 mt-4 text-ink-charcoal">
                    {activeCard.description}
                  </p>

                  <ul className="mt-5 space-y-2 border-t border-rule/30 pt-4">
                    {activeCard.bullets.map((bullet, bIdx) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-ink-carbon body-6"
                      >
                        <span className="font-mono text-plate-cobalt caption-3">
                          0{bIdx + 1}
                        </span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Ruled Stat Strip & Manual Prev/Next Buttons */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
                  <div className="shrink-0">
                    <div className="whitespace-nowrap font-mono text-xl font-semibold text-ink-carbon">
                      {activeCard.statValue}
                    </div>
                    <div className="whitespace-nowrap font-mono text-ink-muted caption-4">
                      {activeCard.statLabel}
                    </div>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={activeIndex === 0}
                      onClick={() => scrollToCard(Math.max(0, activeIndex - 1))}
                      className="mono-wireframe-strong inline-flex shrink-0 items-center justify-center whitespace-nowrap px-2 py-2 font-mono text-ink-charcoal transition-transform duration-300 ease-editorial caption-3 hover:bg-ink-charcoal hover:text-on-accent active:scale-95 disabled:opacity-60"
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
                      className="mono-wireframe-strong inline-flex shrink-0 items-center justify-center whitespace-nowrap px-2 py-2 font-mono text-ink-charcoal transition-transform duration-300 ease-editorial caption-3 hover:bg-ink-charcoal hover:text-on-accent active:scale-95"
                    >
                      DRAW NEXT →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 1C. RIGHT PHYSICAL CARD FLIP & TUCK-TO-BACK DECK — Flies RIGHT on transition */}
            <div
              style={{
                opacity: phase1Opacity,
                transform: `translate3d(${flyOut * 560}px, 0, 0) rotate(${
                  flyOut * 5
                }deg)`,
              }}
              className="relative flex min-h-[320px] items-center justify-center will-change-transform sm:min-h-[420px] lg:col-span-7 lg:min-h-[480px]"
            >
              {/* Background Halftone Registration Mat */}
              <div className="mono-halftone-bg mono-wireframe-box absolute inset-4 hidden sm:block" />

              {/* Flat Z-Sorted Deck Container (Zero-overlap upper-right arc clearance) */}
              <div className="relative aspect-[3/2] w-full max-w-[490px] lg:-ml-8">
                {deck.cards.map((card, idx) => {
                  const delta = idx - continuousIndex;
                  const activeDrawU =
                    continuousIndex - Math.floor(continuousIndex);
                  const deckRecoil = Math.sin(activeDrawU * Math.PI);

                  let translateX = 0;
                  let translateY = 0;
                  let rotateZ = 0;
                  let scale = 1;
                  let zIndex = 50;

                  if (delta >= 0) {
                    // Card is currently on top (delta == 0) or waiting in the stack (delta > 0)
                    // Steps toward upper-right (+12px X, -9px Y per card) and gently recoils left-down while top card is drawn
                    const stackDepth = delta;
                    translateX = stackDepth * 12 - deckRecoil * 36;
                    translateY = -stackDepth * 9 + deckRecoil * 20;
                    rotateZ = stackDepth * 1.1 - deckRecoil * 1.2;
                    scale = 1 - stackDepth * 0.03;
                    zIndex = 50 - idx * 5;
                  } else if (delta > -1) {
                    // Card is actively lifting along an upper-right circular arc and tucking behind the last card (u in (0, 1))
                    const u = -delta; // 0 -> 1
                    const easedU = easeInOutCubic(u);
                    const targetBackDepth = totalCards - 1; // 4 (last card slot)
                    const baseDepth = easedU * targetBackDepth;

                    // Upper-right circular arc:
                    // u in [0, 0.5]: sweeps up (-Y) and far right (+X) until completely clearing the deck's right edge at u = 0.5
                    // u in (0.5, 1.0]: switches zIndex at zero-overlap apex (u = 0.5) and arcs back behind the deck into slot #5
                    const sinPi = Math.sin(u * Math.PI);
                    const sin2Pi = Math.sin(2 * u * Math.PI);

                    translateX = baseDepth * 12 + 415 * sinPi + 28 * sin2Pi;
                    translateY = -baseDepth * 9 - 170 * sinPi - 34 * sin2Pi;
                    rotateZ = baseDepth * 1.1 + 12.5 * sinPi;
                    scale = 1 - baseDepth * 0.03 - 0.1 * sinPi;

                    // At u = 0.5, the lifted card is at (+439px, -188px) while the deck is at (-30px, +15px) -> 0% pixel overlap!
                    zIndex = u <= 0.5 ? 60 : 10 - idx;
                  } else {
                    // Card has settled at the back of the deck (delta <= -1) and advances one slot as subsequent cards are drawn
                    const backDepth = totalCards + delta;
                    translateX = backDepth * 12 - deckRecoil * 36;
                    translateY = -backDepth * 9 + deckRecoil * 20;
                    rotateZ = backDepth * 1.1 - deckRecoil * 1.2;
                    scale = 1 - backDepth * 0.03;
                    zIndex = 10 + idx;
                  }

                  const accentBorder =
                    card.inkAccent === "cobalt"
                      ? "border-plate-cobalt"
                      : "border-plate-terracotta";

                  return (
                    <figure
                      key={card.id}
                      data-accent={card.inkAccent}
                      onClick={() => scrollToCard(idx)}
                      style={{
                        zIndex,
                        transform: `translate3d(${translateX}px, ${translateY}px, 0) rotateZ(${rotateZ}deg) scale(${scale})`,
                      }}
                      className="wireframe-preview mono-wireframe-strong absolute inset-0 flex cursor-pointer flex-col justify-between bg-paper p-2 shadow-[0_6px_20px_rgba(36,35,33,0.08)] will-change-transform sm:p-3"
                    >
                      {/* Top Specimen Plate Header */}
                      <div className="wireframe-preview__chrome flex items-center justify-between border-b border-rule bg-paper px-3 py-2">
                        <div className="flex items-center gap-2 font-mono text-ink-charcoal caption-3">
                          <span
                            className={`inline-block h-2 w-2 ${
                              card.inkAccent === "cobalt"
                                ? "bg-plate-cobalt"
                                : "bg-plate-terracotta"
                            }`}
                          />
                          <span>{card.placeholder.label}</span>
                        </div>
                        <span className="font-mono text-ink-muted caption-4">
                          {card.placeholder.dimensions}
                        </span>
                      </div>

                      {/* Solid Opaque Wireframe SVG Artwork */}
                      <div
                        className={`wireframe-preview__artwork relative flex-1 overflow-hidden border ${accentBorder} bg-paper`}
                      >
                        <img
                          src={card.placeholder.src}
                          alt={card.placeholder.label}
                          className="h-full w-full bg-paper object-cover"
                          draggable={false}
                        />
                      </div>

                      {/* Bottom Replacement Path & Registration Footer */}
                      <figcaption className="wireframe-preview__chrome flex items-center justify-between border-t border-rule bg-paper px-3 py-1.5 font-mono text-ink-muted caption-5">
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
              opacity: phase1Opacity,
              transform: `translate3d(0, ${flyOut * 180}px, 0) scale(${
                1 - flyOut * 0.04
              })`,
            }}
            className="wireframe-bar mono-wireframe-box flex items-center justify-between bg-paper px-4 py-2 font-mono text-ink-charcoal will-change-transform caption-4"
          >
            <span>
              {deck.drawStatusLabel}: 0{activeIndex + 1} / 0{totalCards}
            </span>
            <div className="mx-4 h-1 flex-1 bg-ink-charcoal/15">
              <div
                className="h-full origin-left bg-plate-cobalt"
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
            opacity: isWorkflowInteractive ? 1 : workflowEnter,
            transform: `translate3d(0, ${(1 - workflowEnter) * 28}px, 0) scale(${
              0.82 + 0.18 * workflowEnter
            })`,
            pointerEvents: isWorkflowInteractive ? "auto" : "none",
          }}
          className="absolute inset-0 flex items-center justify-center px-6 py-8 will-change-transform"
        >
          <div className="wireframe-panel mono-wireframe-strong mx-auto w-full max-w-6xl bg-paper p-6 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-4">
              <span className="font-mono text-plate-cobalt caption-3">
                ⊕ {workflow.sectionTag}
              </span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => scrollToCard(totalCards - 1)}
                  className="border border-rule/40 px-2.5 py-1 font-mono text-ink-charcoal transition-colors hover:border-plate-cobalt hover:text-plate-cobalt caption-4"
                >
                  ↑ BACK TO DECK (05)
                </button>
                <span className="hidden font-mono text-ink-muted caption-4 sm:inline">
                  LAYOUT: RULED INFORMATION POSTER
                </span>
              </div>
            </div>

            <div className="mt-6 max-w-[680px] md:mt-8">
              <h2 className="heading-2 text-ink-carbon">{workflow.title}</h2>
              <p className="body-3 mt-3 text-ink-charcoal">{workflow.subtitle}</p>
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
                    data-active={isHighlighted}
                    style={{
                      opacity: isWorkflowInteractive ? 1 : stepOffset,
                      transform: `translate3d(0, ${
                        (1 - stepOffset) * 24
                      }px, 0)`,
                    }}
                    className={`wireframe-step flex flex-col justify-between border p-6 transition-colors duration-300 ease-editorial ${
                      isHighlighted
                        ? "border-plate-cobalt bg-plate-cobalt/[0.04]"
                        : "border-rule bg-paper"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-rule/30 pb-3">
                        <span
                          className={`font-mono caption-3 ${
                            isHighlighted
                              ? "text-plate-cobalt"
                              : "text-plate-terracotta"
                          }`}
                        >
                          {step.step}
                        </span>
                        <span className="font-mono text-ink-muted caption-5">
                          0{index + 1} / 03
                        </span>
                      </div>

                      <h3 className="title-1 mt-5 text-ink-carbon">
                        {step.title}
                      </h3>
                      <div className="mt-1 font-mono text-ink-muted caption-4">
                        {step.subtitle}
                      </div>
                      <p className="body-6 mt-4 text-ink-charcoal">
                        {step.detail}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-rule/40 pt-3 font-mono text-ink-charcoal caption-4">
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
