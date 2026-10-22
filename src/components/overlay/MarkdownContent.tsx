import React, { memo, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import { openUrl } from '@tauri-apps/plugin-opener';
import { CodeBlock } from '@/components/overlay/CodeBlock';
import {
  LinkPreviewCard,
  type LinkPreviewRect,
} from '@/components/overlay/LinkPreviewCard';
import { prepareMarkdown } from '@/lib/markdown';
import { getDomain, isHttpUrl } from '@/lib/links';
import { cn } from '@/lib/utils';

type MarkdownProps = ComponentProps<typeof ReactMarkdown>;

const REMARK_PLUGINS: MarkdownProps['remarkPlugins'] = [remarkGfm, remarkMath];

/**
 * 在 GitHub 默认白名单基础上：
 * - 补充 u / mark 常用内联标签；
 * - 保留 remark-math 生成节点上的 math 类名，避免公式被过滤。
 */
const SANITIZE_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'u', 'mark'],
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ['className', /^math($|-)/],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ['className', /^math($|-)/],
    ],
  },
};

const REHYPE_PLUGINS: MarkdownProps['rehypePlugins'] = [
  // 解析原始 HTML（kbd、u、details 等），随后用白名单过滤，防止脚本注入
  rehypeRaw,
  [rehypeSanitize, SANITIZE_SCHEMA],
  // strict: 'ignore' 让中文、公式中的非常规写法不再抛错/告警
  [rehypeKatex, { throwOnError: false, strict: 'ignore' }],
];

export interface MarkdownContentProps {
  content: string;
  codeBlockWrap?: boolean;
  codeBlockLineNumbers?: boolean;
  className?: string;
}

const MARKDOWN_STYLE: React.CSSProperties = {
  // 长段落中的连续字符（URL、哈希）在窄卡片内折行，不撑破容器
  overflowWrap: 'break-word',
};

function isExternalHref(href?: string): boolean {
  return Boolean(href) && /^(https?:|mailto:)/i.test(href as string);
}

interface HoveredLink {
  href: string;
  title: string;
  domain: string;
  anchorRect: LinkPreviewRect;
}

const MarkdownContentInner: React.FC<MarkdownContentProps> = ({
  content,
  codeBlockWrap = false,
  codeBlockLineNumbers = false,
  className,
}) => {
  const [hoveredLink, setHoveredLink] = useState<HoveredLink | null>(null);

  const components = useMemo<Components>(
    () => ({
      /* 链接：交给系统浏览器打开，并在悬浮时展示预览卡片 */
      a({ href, children, title }) {
        return (
          <a
            href={href}
            title={title}
            rel="noreferrer noopener"
            onClick={(event) => {
              event.preventDefault();
              if (!isExternalHref(href)) return;
              void openUrl(href as string).catch((err) =>
                console.warn('Failed to open link:', err)
              );
            }}
            onMouseEnter={(event) => {
              // 只对外部网页链接展示预览，排除相对路径与页内锚点
              const rawHref = href || '';
              if (!/^https?:\/\//i.test(rawHref)) return;

              const resolvedHref = event.currentTarget.href || rawHref;
              if (!isHttpUrl(resolvedHref)) return;

              const rect = event.currentTarget.getBoundingClientRect();
              setHoveredLink({
                href: resolvedHref,
                title:
                  (event.currentTarget.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim() || getDomain(resolvedHref),
                domain: getDomain(resolvedHref),
                anchorRect: {
                  left: rect.left,
                  top: rect.top,
                  bottom: rect.bottom,
                  width: rect.width,
                },
              });
            }}
            onMouseLeave={() => setHoveredLink(null)}
          >
            {children}
          </a>
        );
      },

      /* 块级代码：由 pre 统一接管，从而与行内代码彻底解耦 */
      pre({ children }) {
        const codeChild = Array.isArray(children)
          ? children.find((child) => React.isValidElement(child))
          : children;

        if (React.isValidElement(codeChild)) {
          const childProps = codeChild.props as {
            className?: string;
            children?: ReactNode;
          };
          const text = Array.isArray(childProps.children)
            ? childProps.children.map(String).join('')
            : String(childProps.children ?? '');

          return (
            <CodeBlock
              code={text}
              language={childProps.className}
              codeBlockWrap={codeBlockWrap}
              codeBlockLineNumbers={codeBlockLineNumbers}
            />
          );
        }
        return <pre className="md-pre">{children}</pre>;
      },

      /* 行内代码（以及极少数没有被 pre 包裹的围栏代码兜底） */
      code({ className: codeClassName, children }) {
        if (/language-/.test(codeClassName || '')) {
          return (
            <CodeBlock
              code={String(children ?? '')}
              language={codeClassName}
              codeBlockWrap={codeBlockWrap}
              codeBlockLineNumbers={codeBlockLineNumbers}
            />
          );
        }
        return <code className="md-inline-code">{children}</code>;
      },

      /* 宽表格横向滚动，避免撑破卡片 */
      table({ children }) {
        return (
          <div className="md-table-wrap">
            <table>{children}</table>
          </div>
        );
      },

      /* GFM 任务列表复选框 */
      input({ type, checked }) {
        if (type !== 'checkbox') return <input type={type} readOnly />;
        return (
          <input
            type="checkbox"
            checked={Boolean(checked)}
            disabled
            readOnly
            className="md-task-checkbox"
          />
        );
      },

      img({ src, alt, title }) {
        return <img src={src} alt={alt || ''} title={title} loading="lazy" />;
      },
    }),
    [codeBlockWrap, codeBlockLineNumbers]
  );

  const source = useMemo(() => prepareMarkdown(content), [content]);

  // 滚动、缩放或点击时收起悬浮卡，避免位置错乱
  useEffect(() => {
    if (!hoveredLink) return;

    const dismiss = () => setHoveredLink(null);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('mousedown', dismiss, true);

    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('mousedown', dismiss, true);
    };
  }, [hoveredLink]);

  // 悬浮状态变化时复用同一棵 Markdown 元素，避免重新解析整篇内容
  const rendered = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
      >
        {source}
      </ReactMarkdown>
    ),
    [source, components]
  );

  return (
    <div className={cn('markdown-body', className)} style={MARKDOWN_STYLE}>
      {rendered}
      {hoveredLink &&
        createPortal(
          <LinkPreviewCard
            key={hoveredLink.href}
            href={hoveredLink.href}
            title={hoveredLink.title}
            domain={hoveredLink.domain}
            anchorRect={hoveredLink.anchorRect}
          />,
          document.body
        )}
    </div>
  );
};

/**
 * 统一 Markdown 渲染器。
 * memo：多轮对话中历史轮次内容不变时跳过整棵语法树的重复解析。
 */
export const MarkdownContent = memo(MarkdownContentInner);
