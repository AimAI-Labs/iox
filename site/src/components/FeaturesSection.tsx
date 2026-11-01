import React from "react";
import { Check } from "lucide-react";
import { PlaceholderMedia } from "./PlaceholderMedia";
import type { SiteContent } from "../locales/content";

interface FeaturesSectionProps {
  showcase: SiteContent["showcase"];
  features: SiteContent["features"];
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({
  showcase,
  features,
}) => {
  return (
    <>
      {/* 01 / Panorama Product Showcase with Placeholder */}
      <section
        id="showcase"
        className="mx-auto max-w-6xl px-6 py-20 md:py-28"
      >
        <div className="mx-auto max-w-3xl text-center">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-[#8d8d8d]">
            {showcase.sectionTag}
          </span>
          <h2 className="mt-3 text-3xl font-medium tracking-tight text-[#111111] md:text-5xl">
            {showcase.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#7b7b7b]">
            {showcase.subtitle}
          </p>
        </div>

        <div className="mt-12">
          <PlaceholderMedia
            spec={showcase.placeholder}
            className="shadow-card"
          />
        </div>

        {/* Key Technical Metrics */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {showcase.metrics.map((metric) => (
            <div
              key={metric.value}
              className="rounded-2xl border border-[#e2e2dc] bg-[#fafaf8] p-6 transition-colors hover:border-[#111111]/30"
            >
              <div className="font-mono text-lg font-semibold tracking-tight text-[#111111]">
                {metric.value}
              </div>
              <div className="mt-1.5 text-sm font-medium text-[#2b2b2b]">
                {metric.label}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#7b7b7b]">
                {metric.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 02 / Core Features Bento Grid */}
      <section
        id="features"
        className="border-t border-[#e5e5e0] bg-[#f4f4f0]/60 py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <span className="font-mono text-xs font-medium uppercase tracking-widest text-[#8d8d8d]">
              {features.sectionTag}
            </span>
            <h2 className="mt-3 text-3xl font-medium tracking-tight text-[#111111] md:text-5xl">
              {features.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#7b7b7b]">
              {features.subtitle}
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">
            {features.items.map((item) => (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-3xl border border-[#e2e2dc] bg-[#fafaf8] p-6 shadow-hairline transition-all duration-300 hover:border-[#111111]/35 md:p-8"
              >
                <div>
                  <span className="inline-block rounded-full border border-[#dcdcd6] bg-[#f2f2ee] px-3 py-1 font-mono text-[11px] font-medium text-[#5a5a5a]">
                    {item.badge}
                  </span>
                  <h3 className="mt-4 text-xl font-medium tracking-tight text-[#111111] md:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#6b6b6b]">
                    {item.description}
                  </p>

                  <ul className="mt-5 space-y-2 border-t border-[#ecece7] pt-4">
                    {item.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 text-xs text-[#3a3a3a] md:text-[13px]"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#111111]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7">
                  <PlaceholderMedia spec={item.placeholder} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
