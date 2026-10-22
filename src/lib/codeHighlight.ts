/**
 * 代码语法高亮
 *
 * 使用 lowlight（highlight.js 的 AST 封装）输出带 `hljs-*` 类名的节点，
 * 再按行拆分为 React 可直接渲染的片段，从而同时支持行号与自动换行。
 * 颜色由 App.css 中的 One Dark 主题规则提供。
 */

import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import scala from 'highlight.js/lib/languages/scala';
import dart from 'highlight.js/lib/languages/dart';
import lua from 'highlight.js/lib/languages/lua';
import swift from 'highlight.js/lib/languages/swift';
import objectivec from 'highlight.js/lib/languages/objectivec';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import less from 'highlight.js/lib/languages/less';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import bash from 'highlight.js/lib/languages/bash';
import powershell from 'highlight.js/lib/languages/powershell';
import dos from 'highlight.js/lib/languages/dos';
import sql from 'highlight.js/lib/languages/sql';
import graphql from 'highlight.js/lib/languages/graphql';
import markdown from 'highlight.js/lib/languages/markdown';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import latex from 'highlight.js/lib/languages/latex';
import makefile from 'highlight.js/lib/languages/makefile';

/** 一行代码的高亮片段 */
export interface CodeSegment {
  text: string;
  className?: string;
}

/** 按行拆分后的高亮结果 */
export type HighlightedLine = CodeSegment[];

const lowlight = createLowlight({
  javascript,
  typescript,
  python,
  rust,
  go,
  java,
  kotlin,
  scala,
  dart,
  lua,
  swift,
  objectivec,
  ruby,
  php,
  c,
  cpp,
  csharp,
  xml,
  css,
  scss,
  less,
  json,
  yaml,
  ini,
  bash,
  powershell,
  dos,
  sql,
  graphql,
  markdown,
  diff,
  dockerfile,
  latex,
  makefile,
});

lowlight.registerAlias({
  javascript: ['js', 'jsx', 'mjs', 'cjs'],
  typescript: ['ts', 'tsx'],
  python: ['py', 'python3'],
  rust: ['rs'],
  go: ['golang'],
  kotlin: ['kt', 'kts'],
  scala: ['sc'],
  dart: ['dart'],
  lua: ['lua'],
  swift: ['swift'],
  objectivec: ['objective-c', 'objc', 'obj-c'],
  ruby: ['rb'],
  c: ['h'],
  cpp: ['c++', 'cc', 'cxx', 'hpp'],
  csharp: ['cs', 'c#'],
  xml: ['html', 'htm', 'xhtml', 'svg', 'vue', 'svelte'],
  css: ['css'],
  scss: ['sass'],
  less: ['less'],
  json: ['jsonc', 'json5'],
  yaml: ['yml'],
  ini: ['toml', 'conf', 'properties'],
  bash: ['sh', 'shell', 'zsh', 'console'],
  powershell: ['ps1', 'ps'],
  dos: ['bat', 'cmd', 'batch'],
  sql: ['mysql', 'pgsql', 'postgresql'],
  graphql: ['gql'],
  markdown: ['md', 'mdx'],
  diff: ['patch'],
  dockerfile: ['docker'],
  latex: ['tex'],
  makefile: ['make'],
});

interface HastNode {
  type: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

function classNameOf(node: HastNode): string | undefined {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value.join(' ');
  return typeof value === 'string' ? value : undefined;
}

function collectSegments(
  node: HastNode,
  inheritedClass: string | undefined,
  output: CodeSegment[]
): void {
  if (node.type === 'text') {
    if (node.value) output.push({ text: node.value, className: inheritedClass });
    return;
  }

  const ownClass = classNameOf(node);
  const className = [inheritedClass, ownClass].filter(Boolean).join(' ') || undefined;

  node.children?.forEach((child) => collectSegments(child, className, output));
}

/** 将线性片段按换行符拆成「行 → 片段」，保证跨行 token 的高亮类名不丢失 */
function splitSegmentsIntoLines(segments: CodeSegment[]): HighlightedLine[] {
  const lines: HighlightedLine[] = [[]];

  for (const segment of segments) {
    const parts = segment.text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, className: segment.className });
    });
  }

  return lines;
}

/**
 * 对代码做语法高亮。
 * 未注册的语言返回 null，由调用方回退为纯文本渲染。
 */
export function highlightCode(code: string, language: string): HighlightedLine[] | null {
  if (!language || !lowlight.registered(language)) return null;

  try {
    const tree = lowlight.highlight(language, code) as unknown as HastNode;
    const segments: CodeSegment[] = [];
    tree.children?.forEach((child) => collectSegments(child, undefined, segments));
    return splitSegmentsIntoLines(segments);
  } catch (error) {
    console.warn('Failed to highlight code:', error);
    return null;
  }
}
