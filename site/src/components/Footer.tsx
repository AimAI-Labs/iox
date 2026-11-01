import React from "react";
import type { SiteContent } from "../locales/content";

interface FooterProps {
  cta: SiteContent["cta"];
  footer: SiteContent["footer"];
}

export const Footer: React.FC<FooterProps> = ({ cta, footer }) => {
  return (
    <footer className="mx-auto max-w-6xl px-6 pb-16 pt-12">
      {/* Final Conversion Plate (Mono-Color Editorial Poster) */}
      <div
        id="download"
        className="mono-wireframe-strong mono-halftone-bg relative bg-[#F5F1E8] p-8 md:p-16"
      >
        {/* Corner Registration Marks */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#30343A] pb-4">
          <span className="font-mono text-[#C65F38] caption-3">
            ⊕ {cta.tag}
          </span>
          <span className="font-mono text-[#30343A] caption-4">
            FINAL EDITION · WINDOWS X64
          </span>
        </div>

        <div className="mt-10 max-w-[680px]">
          <h2 className="heading-1">
            <span className="block text-[#30343A]/60">{cta.titleMuted}</span>
            <span className="block text-[#242321]">{cta.titleInk}</span>
          </h2>

          <p className="body-3 mt-6 text-[#30343A]">{cta.subtitle}</p>

          {/* Risk Reversal Strip */}
          <div className="mt-4 font-mono text-[#2148B8] caption-3">
            ✦ {cta.riskReversal}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="https://github.com/AimAI-Labs/iox/releases"
              target="_blank"
              rel="noreferrer"
              className="border border-[#242321] bg-[#242321] px-6 py-3 text-[#F5F1E8] transition-transform duration-300 ease-editorial button-sm hover:-translate-y-0.5 active:scale-95"
            >
              {cta.downloadNsis}
            </a>

            <a
              href="https://github.com/AimAI-Labs/iox/releases"
              target="_blank"
              rel="noreferrer"
              className="border border-[#30343A] bg-[#F5F1E8] px-6 py-3 text-[#242321] transition-colors duration-300 ease-editorial button-sm hover:border-[#2148B8] hover:text-[#2148B8] active:scale-95"
            >
              {cta.downloadPortable}
            </a>
          </div>

          <p className="mt-6 font-mono text-[#30343A]/75 caption-4">
            {cta.systemReq}
          </p>
        </div>
      </div>

      {/* Editorial Print Colophon & Placeholder Guide */}
      <div className="mono-wireframe-box mt-6 grid grid-cols-1 gap-6 bg-[#F5F1E8] p-6 md:grid-cols-12">
        <div className="md:col-span-6">
          <div className="flex items-center gap-2 font-semibold text-[#242321] title-3">
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
          <p className="body-6 mt-2 text-[#30343A]">{footer.tagline}</p>
          <p className="mt-3 font-mono text-[#2148B8] caption-5">
            {footer.recipeNote}
          </p>
        </div>

        <div className="border border-[#30343A]/40 p-4 md:col-span-6">
          <div className="font-mono text-[#242321] caption-3">
            {footer.placeholderGuideTitle}
          </div>
          <p className="body-6 mt-1 text-[#30343A]">
            {footer.placeholderGuideText}
          </p>
        </div>
      </div>

      {/* Legal & Navigation Bottom Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 font-mono text-[#30343A]/80 caption-4">
        <span>{footer.copyright}</span>
        <div className="flex items-center gap-6">
          <a
            href="#faq"
            className="underline-offset-4 hover:text-[#2148B8] hover:underline"
          >
            {footer.privacyLabel}
          </a>
          <a
            href="https://github.com/AimAI-Labs/iox/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:text-[#2148B8] hover:underline"
          >
            {footer.termsLabel}
          </a>
          <a
            href="#top"
            className="underline-offset-4 hover:text-[#2148B8] hover:underline"
          >
            ↑ TOP
          </a>
        </div>
      </div>
    </footer>
  );
};
