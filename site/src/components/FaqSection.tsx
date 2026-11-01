import React, { useState } from "react";
import type { SiteContent } from "../locales/content";

interface FaqSectionProps {
  faq: SiteContent["faq"];
}

export const FaqSection: React.FC<FaqSectionProps> = ({ faq }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Left Column: Editorial Header & Active Negative Space */}
        <div className="flex flex-col justify-between lg:col-span-5">
          <div>
            <div className="mono-wireframe-box inline-flex items-center gap-2 px-3 py-1 font-mono text-[#2148B8] caption-3">
              <span>⊕</span>
              <span>{faq.sectionTag}</span>
            </div>
            <h2 className="heading-3 mt-6 text-[#242321]">{faq.title}</h2>
            <p className="body-6 mt-4 text-[#30343A]">{faq.subtitle}</p>
          </div>

          <div className="mono-halftone-cobalt mono-wireframe-box mt-8 hidden h-40 p-4 lg:flex lg:flex-col lg:justify-between">
            <span className="font-mono text-[#2148B8] caption-4">
              RELEASE ZONE · ACTIVE NEGATIVE SPACE
            </span>
            <span className="font-mono text-[#30343A] caption-5">
              VERIFIED AGAINST RUST / TAURI SOURCE
            </span>
          </div>
        </div>

        {/* Right Column: Ruled Wireframe Q&A List */}
        <div className="space-y-3 lg:col-span-7">
          {faq.items.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={item.question}
                className="mono-wireframe-strong bg-[#F5F1E8] transition-colors duration-300 ease-editorial"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left focus:outline-none focus:ring-2 focus:ring-[#2148B8]"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-[#2148B8] caption-3">
                      Q0{idx + 1}
                    </span>
                    <span className="title-3 text-[#242321]">
                      {item.question}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[#30343A] title-3">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-[#30343A]/30 px-6 py-4">
                    <p className="body-6 text-[#30343A]">{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
