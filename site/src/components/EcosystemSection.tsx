import React from "react";
import type { SiteContent } from "../locales/content";

interface EcosystemSectionProps {
  ecosystem: SiteContent["ecosystem"];
}

export const EcosystemSection: React.FC<EcosystemSectionProps> = ({
  ecosystem,
}) => {
  return (
    <section id="ecosystem" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      {/* Top Registration Bar */}
      <div className="mono-wireframe-box flex flex-wrap items-center justify-between gap-4 px-4 py-2">
        <span className="font-mono text-[#C65F38] caption-3">
          ⊕ {ecosystem.sectionTag}
        </span>
        <span className="font-mono text-[#30343A]/75 caption-4">
          INK PLATES: #30343A + #C65F38
        </span>
      </div>

      {/* Asymmetric Header */}
      <div className="mt-10 max-w-[680px]">
        <h2 className="heading-2 text-[#242321]">{ecosystem.title}</h2>
        <p className="body-3 mt-4 text-[#30343A]">{ecosystem.subtitle}</p>
      </div>

      {/* 6 Specimen Cells in Wireframe Grid */}
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ecosystem.items.map((item, idx) => (
          <article
            key={item.name}
            className="mono-wireframe-strong flex flex-col justify-between bg-[#F5F1E8] p-6 transition-colors duration-300 ease-editorial hover:border-[#2148B8]"
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#30343A]/30 pb-3">
                <span className="font-mono text-[#2148B8] caption-4">
                  SPECIMEN 0{idx + 1}
                </span>
                <span className="border border-[#30343A] px-2 py-0.5 font-mono text-[#30343A] caption-5">
                  {item.category}
                </span>
              </div>

              <h3 className="title-1 mt-4 text-[#242321]">{item.name}</h3>
              <div className="mt-2 font-mono text-[#30343A]/75 caption-4">
                {item.protocol}
              </div>
            </div>

            <div className="mt-6 border-t border-[#30343A]/30 pt-3 font-mono text-[#242321] caption-4">
              {item.models}
            </div>
          </article>
        ))}
      </div>

      {/* Two Archival Proof Plates */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {ecosystem.highlights.map((hl, idx) => (
          <div
            key={hl.code}
            className="mono-wireframe-strong mono-halftone-bg flex flex-col justify-between bg-[#F5F1E8] p-6 md:p-8"
          >
            <div className="flex items-center justify-between border-b border-[#30343A] pb-3">
              <span
                className={`font-mono caption-3 ${
                  idx === 0 ? "text-[#2148B8]" : "text-[#C65F38]"
                }`}
              >
                {hl.code}
              </span>
              <span className="font-mono text-[#30343A] caption-5">⊕</span>
            </div>
            <h4 className="title-1 mt-6 text-[#242321]">{hl.title}</h4>
            <p className="body-6 mt-3 text-[#30343A]">{hl.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
