import React from "react";
import { Download, Package } from "lucide-react";
import type { SiteContent } from "../locales/content";

interface FooterProps {
  cta: SiteContent["cta"];
  footer: SiteContent["footer"];
}

export const Footer: React.FC<FooterProps> = ({ cta, footer }) => {
  return (
    <footer className="border-t border-[#e5e5e0] bg-[#f7f7f5]">
      {/* Bottom Call-to-Action Section */}
      <div
        id="download"
        className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28"
      >
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-[#8d8d8d]">
          {cta.tag}
        </span>

        <h2 className="mt-4 text-4xl font-medium tracking-tight md:text-6xl">
          <span className="block text-[#9a9a9a]">{cta.titleMuted}</span>
          <span className="block text-[#111111]">{cta.titleInk}</span>
        </h2>

        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-[#7b7b7b] md:text-base">
          {cta.subtitle}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://github.com/AimAI-Labs/iox/releases"
            target="_blank"
            rel="noreferrer"
            className="cta !mt-0"
          >
            <span className="cta-pill inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span>{cta.downloadNsis}</span>
            </span>
          </a>

          <a
            href="https://github.com/AimAI-Labs/iox/releases"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[#d4d4ce] bg-white px-5 py-2.5 text-[13.5px] font-medium text-[#111111] transition-colors hover:border-[#111111]"
          >
            <Package className="h-4 w-4 text-[#5a5a5a]" />
            <span>{cta.downloadPortable}</span>
          </a>
        </div>

        <p className="mt-5 font-mono text-xs text-[#8d8d8d]">{cta.systemReq}</p>
      </div>

      {/* Bottom Legal & Placeholder Asset Notice */}
      <div className="border-t border-[#e5e5e0] bg-[#f2f2ee]/70 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 font-semibold text-[#111111]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="2" y="2" width="4" height="16" rx="1.5" />
                <circle
                  cx="13"
                  cy="10"
                  r="5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                />
              </svg>
              <span>IOX</span>
            </div>
            <p className="mt-1.5 text-xs text-[#7b7b7b]">{footer.tagline}</p>
          </div>

          <div className="max-w-md rounded-xl border border-[#dcdcd6] bg-[#fafaf8] px-4 py-3 text-xs text-[#6b6b6b]">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#3a3a3a]">
              {footer.placeholderGuideTitle}
            </div>
            <p className="mt-1 leading-relaxed">{footer.placeholderGuideText}</p>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-6xl border-t border-[#e5e5e0] px-6 pt-6 text-xs text-[#8d8d8d]">
          {footer.copyright}
        </div>
      </div>
    </footer>
  );
};
