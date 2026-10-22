import React, { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { highlightCode, type HighlightedLine } from '@/lib/codeHighlight';

/* ─────────────────────────────────────────────────────────
 * BUI CodeBlock — 代码块 (beautifului.dev)
 * One Dark 语法高亮 + mono 行号 + 实时可复制的 Copy 按钮
 * ───────────────────────────────────────────────────────── */

export interface CodeBlockProps {
  /** 代码正文（由 Markdown <pre> 提取，已去掉末尾换行） */
  code: string;
  /** 原始 className，如 "language-typescript" */
  language?: string;
  codeBlockWrap?: boolean;
  codeBlockLineNumbers?: boolean;
  className?: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  jsx: 'React JSX',
  tsx: 'React TSX',
  py: 'Python',
  python: 'Python',
  rs: 'Rust',
  rust: 'Rust',
  go: 'Go',
  golang: 'Go',
  java: 'Java',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  scala: 'Scala',
  sc: 'Scala',
  dart: 'Dart',
  lua: 'Lua',
  swift: 'Swift',
  objectivec: 'Objective-C',
  'objective-c': 'Objective-C',
  objc: 'Objective-C',
  ruby: 'Ruby',
  rb: 'Ruby',
  php: 'PHP',
  c: 'C',
  h: 'C',
  cpp: 'C++',
  'c++': 'C++',
  cs: 'C#',
  csharp: 'C#',
  html: 'HTML',
  xml: 'XML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  json: 'JSON',
  jsonc: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  ini: 'INI',
  sh: 'Shell',
  shell: 'Shell',
  zsh: 'Shell',
  bash: 'Bash',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  bat: 'Batch',
  cmd: 'Batch',
  sql: 'SQL',
  graphql: 'GraphQL',
  md: 'Markdown',
  markdown: 'Markdown',
  tex: 'LaTeX',
  latex: 'LaTeX',
  diff: 'Diff',
  dockerfile: 'Dockerfile',
  makefile: 'Makefile',
  vue: 'Vue',
  svelte: 'Svelte',
};

function parseLanguage(language?: string): string {
  if (!language) return '';
  const match = /(?:^|\s)language-([^\s]+)/.exec(language);
  return match ? match[1].toLowerCase() : '';
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  codeBlockWrap = false,
  codeBlockLineNumbers = false,
  className,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const rawCode = useMemo(() => code.replace(/\n$/, ''), [code]);
  const lang = parseLanguage(language);
  const displayLanguage = LANGUAGE_LABELS[lang] || lang || 'Text';

  const lines = useMemo<HighlightedLine[]>(() => {
    const highlighted = lang ? highlightCode(rawCode, lang) : null;
    if (highlighted) return highlighted;
    return rawCode.split('\n').map((text) => [{ text }]);
  }, [rawCode, lang]);

  const gutterWidth = Math.max(String(lines.length).length, 2);

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
    <div
      className={cn(
        'md-code-block my-2.5 overflow-hidden rounded-[10px] border shadow-hairline',
        className
      )}
    >
      {/* 顶部语言与复制栏 */}
      <div className="md-code-block-header flex select-none items-center justify-between border-b px-3 py-1.5">
        <span className="md-code-block-lang text-[11.5px] font-medium">
          {displayLanguage}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'md-code-block-copy flex h-6 items-center gap-1 rounded-[6px] px-1.5 text-[11.5px] font-medium',
            'cursor-pointer transition-colors duration-100',
            copied && 'is-copied'
          )}
          title={t('card.codeCopy')}
        >
          {copied ? (
            <Check size={10} strokeWidth={2.5} />
          ) : (
            <Copy size={10} strokeWidth={2} />
          )}
          <span>{copied ? t('card.codeCopied') : t('card.codeCopy')}</span>
        </button>
      </div>

      {/* 代码正文与行号区 */}
      <pre className="md-code-block-scroll custom-scrollbar overflow-x-auto px-3 py-2.5 select-text">
        <code className="block">
          {lines.map((line, index) => (
            <div key={index} className="md-code-block-line">
              {codeBlockLineNumbers && (
                <span
                  className="md-code-block-gutter shrink-0 select-none pr-2.5 text-right tabular-nums"
                  style={{ width: `calc(${gutterWidth}ch + 10px)` }}
                >
                  {index + 1}
                </span>
              )}
              <span
                className={cn(
                  'flex-1',
                  codeBlockWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                )}
              >
                {line.map((segment, segmentIndex) => (
                  <span key={segmentIndex} className={segment.className}>
                    {segment.text}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
};
