import React from "react";
import type { SiteContent } from "../locales/content";
import { MODEL_CATALOG_UPDATED_AT } from "../data/ecosystemModels";

interface EcosystemSectionProps {
  ecosystem: SiteContent["ecosystem"];
}

export const EcosystemSection: React.FC<EcosystemSectionProps> = ({
  ecosystem,
}) => {
  return (
    <section id="ecosystem" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      {/* Top Registration Bar */}
      <div className="wireframe-bar mono-wireframe-box flex flex-wrap items-center justify-between gap-4 px-4 py-2">
        <span className="font-mono text-plate-terracotta caption-3">
          ⊕ {ecosystem.sectionTag}
        </span>
        <time dateTime={MODEL_CATALOG_UPDATED_AT} className="font-mono text-ink-muted caption-4">
          {ecosystem.modelsUpdatedLabel} · {MODEL_CATALOG_UPDATED_AT}
        </time>
      </div>

      {/* Asymmetric Header */}
      <div className="mt-10 max-w-[680px]">
        <h2 className="heading-2 text-ink-carbon">{ecosystem.title}</h2>
        <p className="body-3 mt-4 text-ink-charcoal">{ecosystem.subtitle}</p>
      </div>

      {/* 6 Specimen Cells in Wireframe Grid */}
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ecosystem.items.map((item, idx) => (
          <article
            key={item.name}
            className="wireframe-panel mono-wireframe-strong flex flex-col justify-between bg-paper p-6 transition-colors duration-300 ease-editorial hover:border-plate-cobalt"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule/30 pb-3">
                <span className="font-mono text-plate-cobalt caption-4">
                  SPECIMEN 0{idx + 1}
                </span>
                <span className="wireframe-badge border border-rule px-2 py-0.5 font-mono text-ink-charcoal caption-5">
                  {item.category}
                </span>
              </div>

              <h3 className="title-1 mt-4 text-ink-carbon">{item.name}</h3>
              <div className="mt-2 font-mono text-ink-muted caption-4">
                {item.protocol}
              </div>
            </div>

            <div className="mt-6 border-t border-rule/30 pt-4">
              <ul className="flex flex-wrap gap-2">
                {item.models.map((model) => (
                  <li key={model} className="whitespace-nowrap rounded-md border border-rule/40 bg-canvas px-2 py-1 text-ink-charcoal caption-4">
                    {model}
                  </li>
                ))}
              </ul>
              <a
                href={item.modelsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-plate-cobalt caption-4 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                aria-label={`${item.name} · ${ecosystem.modelsLinkLabel}`}
              >
                {ecosystem.modelsLinkLabel}<span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-4 text-ink-muted caption-2">{ecosystem.modelsNote}</p>

      {/* Two Archival Proof Plates */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {ecosystem.highlights.map((hl, idx) => (
          <div
            key={hl.code}
            className="wireframe-panel mono-wireframe-strong mono-halftone-bg flex flex-col justify-between bg-paper p-6 md:p-8"
          >
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <span
                className={`font-mono caption-3 ${
                  idx === 0 ? "text-plate-cobalt" : "text-plate-terracotta"
                }`}
              >
                {hl.code}
              </span>
              <span className="font-mono text-ink-charcoal caption-5">⊕</span>
            </div>
            <h4 className="title-1 mt-6 text-ink-carbon">{hl.title}</h4>
            <p className="body-6 mt-3 text-ink-charcoal">{hl.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
