import React, { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────
 * BUI CodeBlock — 代码块 (beautifului.dev)
 * 凹陷底色 + mono 行号 + 实时可复制的 Copy 按钮
 * ───────────────────────────────────────────────────────── */

export interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  inline,
  className,
  children,
  ...props
}) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const rawCode = String(children).replace(/\n$/, '');

  // 拆分行以支持 BUI 优雅行号
  const lines = useMemo(() => rawCode.split('\n'), [rawCode]);

  // 行内代码 — BUI 凹陷 chip
  if (inline || (!match && !rawCode.includes('\n'))) {
    return (
      <code
        className={cn(
          'rounded-[5px] bg-inset px-1.5 py-0.5 font-mono text-[11.5px] text-ink',
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('Failed to copy code:', err);
    }
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-[10px] border border-line bg-inset shadow-hairline">
      {/* 顶部语言与复制栏 */}
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 select-none">
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[12px] font-medium text-ink">
            {language || 'code'}
          </span>
        </span>

        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'flex h-6 items-center gap-1 rounded-[6px] px-1.5 text-[11.5px] font-medium',
            'transition-colors duration-100 hover:bg-hover cursor-pointer',
            copied ? 'text-emerald-600' : 'text-ink-3 hover:text-ink'
          )}
          title="复制代码"
        >
          {copied ? (
            <Check size={10} strokeWidth={2.5} />
          ) : (
            <Copy size={10} strokeWidth={2} />
          )}
          <span>{copied ? '已复制' : '复制'}</span>
        </button>
      </div>

      {/* 代码正文与行号区 */}
      <pre className="overflow-x-auto bg-inset px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] text-ink-2 select-text custom-scrollbar">
        {lines.map((line, index) => (
          <div key={index} className="flex">
            <span className="w-5 shrink-0 select-none pr-2.5 text-right text-[10.5px] leading-[1.86] text-ink-3/60">
              {index + 1}
            </span>
            <span className="whitespace-pre">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
};
