import React from "react";
import { Cpu, Layers } from "lucide-react";
import type { SiteContent } from "../locales/content";

interface EcosystemSectionProps {
  ecosystem: SiteContent["ecosystem"];
}

export const EcosystemSection: React.FC<EcosystemSectionProps> = ({
  ecosystem,
}) => {
  return (
    <section
      id="ecosystem"
      className="border-t border-[#e5e5e0] bg-[#f4f4f0]/60 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-[#8d8d8d]">
            {ecosystem.sectionTag}
          </span>
          <h2 className="mt-3 text-3xl font-medium tracking-tight text-[#111111] md:text-5xl">
            {ecosystem.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#7b7b7b]">
            {ecosystem.subtitle}
          </p>
        </div>

        {/* Provider / Portal Cards */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ecosystem.items.map((item) => (
            <div
              key={item.name}
              className="rounded-2xl border border-[#e2e2dc] bg-[#fafaf8] p-6 transition-all hover:border-[#111111]/40"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-[#111111]">
                  {item.name}
                </h3>
                <span className="rounded-full bg-[#efefea] px-2.5 py-0.5 font-mono text-[11px] text-[#5a5a5a]">
                  {item.category}
                </span>
              </div>
              <div className="mt-3 font-mono text-xs text-[#8d8d8d]">
                {item.protocol}
              </div>
              <div className="mt-2 truncate font-mono text-xs text-[#3a3a3a]">
                {item.models}
              </div>
            </div>
          ))}
        </div>

        {/* Additional architectural highlights */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {ecosystem.highlights.map((hl, idx) => (
            <div
              key={hl.title}
              className="flex items-start gap-4 rounded-2xl border border-[#dcdcd6] bg-[#fafaf8] p-6"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-white">
                {idx === 0 ? (
                  <Layers className="h-5 w-5" />
                ) : (
                  <Cpu className="h-5 w-5" />
                )}
              </div>
              <div>
                <h4 className="text-base font-medium text-[#111111]">
                  {hl.title}
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-[#6b6b6b]">
                  {hl.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
