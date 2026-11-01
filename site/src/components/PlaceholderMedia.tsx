import React from "react";
import { Image as ImageIcon } from "lucide-react";
import type { PlaceholderSpec } from "../locales/content";

interface PlaceholderMediaProps {
  spec: PlaceholderSpec;
  className?: string;
}

export const PlaceholderMedia: React.FC<PlaceholderMediaProps> = ({
  spec,
  className = "",
}) => {
  return (
    <figure
      className={`group relative overflow-hidden rounded-2xl border border-[#dcdcd6] bg-[#f2f2ee] transition-all duration-300 hover:border-[#111111]/40 ${className}`}
    >
      {/* Top technical metadata bar */}
      <div className="flex items-center justify-between border-b border-[#e2e2dc] bg-[#fafaf8]/90 px-4 py-2.5 text-xs text-[#7b7b7b]">
        <span className="inline-flex items-center gap-1.5 font-medium text-[#3a3a3a]">
          <ImageIcon className="h-3.5 w-3.5 text-[#7b7b7b]" />
          <span>{spec.label}</span>
        </span>
        <span className="rounded-full border border-[#dcdcd6] bg-[#f7f7f5] px-2.5 py-0.5 font-mono text-[11px] text-[#5a5a5a]">
          {spec.dimensions}
        </span>
      </div>

      {/* SVG Placeholder Image Container */}
      <div
        className="relative w-full overflow-hidden bg-[#f4f4f0]"
        style={{ aspectRatio: spec.aspectRatio }}
      >
        <img
          src={spec.src}
          alt={spec.label}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
        />
      </div>

      {/* Bottom replacement path bar */}
      <figcaption className="flex items-center justify-between border-t border-[#e2e2dc] bg-[#fafaf8] px-4 py-2 font-mono text-[11px] text-[#7b7b7b]">
        <span className="truncate">{spec.hint}</span>
        <span className="ml-2 shrink-0 uppercase tracking-wider text-[#9a9a9a]">
          PLACEHOLDER ASSET
        </span>
      </figcaption>
    </figure>
  );
};
