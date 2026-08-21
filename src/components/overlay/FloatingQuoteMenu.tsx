import React from 'react';
import { Quote } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FloatingQuoteMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onQuote: () => void;
  className?: string;
}

export const FloatingQuoteMenu: React.FC<FloatingQuoteMenuProps> = ({
  x,
  y,
  visible,
  onQuote,
  className,
}) => {
  if (!visible) return null;

  return (
    <div
      style={{ left: `${x}px`, top: `${y}px` }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onQuote();
      }}
      className={cn(
        'fixed z-90 -translate-x-1/2 -translate-y-full -mt-2 flex flex-row flex-nowrap items-center gap-1.5',
        'w-max whitespace-nowrap rounded-xl px-2.5 py-1 select-none cursor-pointer shadow-xl backdrop-blur-2xl pointer-events-auto',
        'bg-zinc-900/95 text-zinc-100 dark:bg-white/95 dark:text-zinc-900',
        'border border-white/10 dark:border-black/10 ring-1 ring-black/5 dark:ring-white/10',
        'transition-all duration-120 hover:scale-105 active:scale-95 animate-in fade-in zoom-in-95',
        className
      )}
      title="引用选中文本到提问框"
    >
      <Quote size={12} className="shrink-0 rotate-180 text-blue-400 dark:text-blue-600" />
      <span className="shrink-0 text-[12px] font-medium tracking-tight whitespace-nowrap">
        引用
      </span>
    </div>
  );
};
