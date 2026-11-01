import React from "react";
import type { SiteContent } from "../locales/content";

interface WorkflowSectionProps {
  workflow: SiteContent["workflow"];
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({
  workflow,
}) => {
  return (
    <section id="workflow" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      {/* Ruled Information Poster Header */}
      <div className="mono-wireframe-strong bg-[#F5F1E8] p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#30343A] pb-4">
          <span className="font-mono text-[#2148B8] caption-3">
            ⊕ {workflow.sectionTag}
          </span>
          <span className="font-mono text-[#30343A]/75 caption-4">
            LAYOUT: RULED INFORMATION POSTER
          </span>
        </div>

        {/* Asymmetric Heading & Active Negative Space */}
        <div className="mt-8 max-w-[680px]">
          <h2 className="heading-2 text-[#242321]">{workflow.title}</h2>
          <p className="body-3 mt-4 text-[#30343A]">{workflow.subtitle}</p>
        </div>

        {/* 3-Column Wireframe Steps */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {workflow.steps.map((step, index) => {
            const isMiddle = index === 1;
            return (
              <article
                key={step.step}
                className={`flex flex-col justify-between border p-6 transition-transform duration-500 ease-editorial hover:-translate-y-1 ${
                  isMiddle
                    ? "border-[#2148B8] bg-[#2148B8]/[0.03]"
                    : "border-[#30343A] bg-[#F5F1E8]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#30343A]/30 pb-3">
                    <span
                      className={`font-mono caption-3 ${
                        isMiddle ? "text-[#2148B8]" : "text-[#C65F38]"
                      }`}
                    >
                      {step.step}
                    </span>
                    <span className="font-mono text-[#30343A]/60 caption-5">
                      0{index + 1} / 03
                    </span>
                  </div>

                  <h3 className="title-1 mt-6 text-[#242321]">{step.title}</h3>
                  <div className="mt-1 font-mono text-[#30343A]/75 caption-4">
                    {step.subtitle}
                  </div>
                  <p className="body-6 mt-4 text-[#30343A]">{step.detail}</p>
                </div>

                <div className="mt-8 border-t border-[#30343A]/40 pt-3 font-mono text-[#30343A] caption-4">
                  MODULE: {step.tag}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
