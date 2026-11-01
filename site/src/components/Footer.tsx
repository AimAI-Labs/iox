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
        className="wireframe-panel mono-wireframe-strong mono-halftone-bg relative bg-paper p-8 md:p-16"
      >
        {/* Corner Registration Marks */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-4">
          <span className="font-mono text-plate-terracotta caption-3">
            ⊕ {cta.tag}
          </span>
          <span className="font-mono text-ink-charcoal caption-4">
            FINAL EDITION · WINDOWS X64
          </span>
        </div>

        <div className="mt-10 max-w-[680px]">
          <h2 className="heading-1">
            <span className="block text-ink-muted">{cta.titleMuted}</span>
            <span className="block text-ink-carbon">{cta.titleInk}</span>
          </h2>

          <p className="body-3 mt-6 text-ink-charcoal">{cta.subtitle}</p>

          {/* Risk Reversal Strip */}
          <div className="mt-4 font-mono text-plate-cobalt caption-3">
            ✦ {cta.riskReversal}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="https://github.com/AimAI-Labs/iox/releases"
              target="_blank"
              rel="noreferrer"
              className="border border-ink-carbon bg-ink-carbon px-6 py-3 text-canvas transition-transform duration-300 ease-editorial button-sm hover:-translate-y-0.5 active:scale-95"
            >
              {cta.downloadNsis}
            </a>

            <a
              href="https://github.com/AimAI-Labs/iox/releases"
              target="_blank"
              rel="noreferrer"
              className="border border-rule bg-paper px-6 py-3 text-ink-carbon transition-colors duration-300 ease-editorial button-sm hover:border-plate-cobalt hover:text-plate-cobalt active:scale-95"
            >
              {cta.downloadPortable}
            </a>
          </div>

          <p className="mt-6 font-mono text-ink-muted caption-4">
            {cta.systemReq}
          </p>
        </div>
      </div>

      {/* Product summary and useful project links */}
      <div className="wireframe-panel mono-wireframe-box mt-6 grid grid-cols-1 gap-8 bg-paper p-6 md:grid-cols-12 md:p-8">
        <div className="md:col-span-6">
          <a href="#top" className="inline-flex text-ink-carbon title-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">IOX</a>
          <p className="body-5 mt-3 text-ink-charcoal">{footer.tagline}</p>
          <p className="body-6 mt-2 max-w-md text-ink-muted">{footer.description}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {footer.highlights.map((highlight) => (
              <li key={highlight} className="wireframe-badge rounded-full border border-rule/40 px-3 py-1 text-ink-charcoal caption-4">{highlight}</li>
            ))}
          </ul>
        </div>

        <nav aria-label={footer.resourcesTitle} className="md:col-span-5 md:col-start-8">
          <h3 className="text-ink-muted title-4">{footer.resourcesTitle}</h3>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
            {footer.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noreferrer" : undefined}
                  className="inline-flex items-center gap-2 text-ink-charcoal body-5 underline-offset-4 hover:text-plate-cobalt hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  {link.label}{link.external && <span aria-hidden="true" className="text-ink-muted">↗</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Legal & Navigation Bottom Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 font-mono text-ink-muted caption-4">
        <span>{footer.copyright}</span>
        <div className="flex items-center gap-6">
          <a
            href="#faq"
            className="underline-offset-4 hover:text-plate-cobalt hover:underline"
          >
            {footer.privacyLabel}
          </a>
          <a
            href="https://github.com/AimAI-Labs/iox/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:text-plate-cobalt hover:underline"
          >
            {footer.termsLabel}
          </a>
          <a
            href="#top"
            className="underline-offset-4 hover:text-plate-cobalt hover:underline"
          >
            ↑ {footer.backToTop}
          </a>
        </div>
      </div>
    </footer>
  );
};
