import React from "react";
import { ArrowRight } from "lucide-react";
import type { SiteContent } from "../locales/content";

interface WorkflowSectionProps {
  workflow: SiteContent["workflow"];
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({
  workflow,
}) => {
  return (
    <section
      id="workflow"
      className="border-t border-[#e5e5e0] py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-[#8d8d8d]">
            {workflow.sectionTag}
          </span>
          <h2 className="mt-3 text-3xl font-medium tracking-tight text-[#111111] md:text-5xl">
            {workflow.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#7b7b7b]">
            {workflow.subtitle}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {workflow.steps.map((step, index) => (
            <div
              key={step.step}
              className="relative flex flex-col justify-between rounded-3xl border border-[#e2e2dc] bg-[#fafaf8] p-7 transition-colors hover:border-[#111111]/40"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold tracking-wider text-[#111111]">
                    {step.step}
                  </span>
                  {index < workflow.steps.length - 1 && (
                    <ArrowRight className="hidden h-4 w-4 text-[#9a9a9a] md:block" />
                  )}
                </div>

                <h3 className="mt-5 text-xl font-medium tracking-tight text-[#111111]">
                  {step.title}
                </h3>
                <div className="mt-1 font-mono text-xs text-[#8d8d8d]">
                  {step.subtitle}
                </div>
                <p className="mt-3.5 text-sm leading-relaxed text-[#6b6b6b]">
                  {step.detail}
                </p>
              </div>

              <div className="mt-6 border-t border-[#ecece7] pt-4 font-mono text-[11px] text-[#7b7b7b]">
                {step.tag}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
