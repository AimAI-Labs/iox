/**
 * Markdown 预处理工具
 *
 * 模型输出（尤其是流式片段、复制粘贴的示例文本）经常出现代码围栏不闭合、
 * 闭合围栏长度与开围栏不一致、多个代码块之间漏写闭合等情况。
 * 严格按 CommonMark 解析时，这些瑕疵会让**后续整段正文被吞进代码块**。
 * 这里在渲染前做一次轻量修补，保证每段围栏都能正常闭合。
 */

/** 围栏代码块行：最多 3 个缩进 + 3 个以上反引号/波浪号 + info string */
const FENCE_LINE_PATTERN = /^([ ]{0,3})(`{3,}|~{3,})(.*)$/;

/**
 * 本身可能包含嵌套围栏示例的语言标记。
 * 对这些块内的「更短围栏行」保持为代码内容，避免破坏合法的嵌套示例。
 */
const NESTED_EXAMPLE_LANGS = new Set(['', 'markdown', 'md', 'mdx', 'text', 'txt', 'plaintext']);

interface OpenFence {
  indent: string;
  marker: string;
  char: string;
  length: number;
  language: string;
}

function parseFence(indent: string, marker: string, info: string): OpenFence | null {
  // 反引号围栏的 info string 不允许再出现反引号
  if (marker[0] === '`' && info.includes('`')) return null;
  const language = info.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return { indent, marker, char: marker[0], length: marker.length, language };
}

/**
 * 修补 Markdown 代码围栏：
 * 1. 块内出现带语言标记的新围栏 → 视为上一块漏写闭合，自动切分；
 * 2. 非嵌套示例类代码块中，闭合围栏长度不足 → 补足为合法闭合；
 * 3. 文末仍有未闭合围栏 → 自动补齐闭合围栏，避免流式中间态吞掉后续内容。
 */
export function normalizeMarkdownFences(text: string): string {
  if (!text || (!text.includes('```') && !text.includes('~~~'))) return text;

  const output: string[] = [];
  let open: OpenFence | null = null;

  for (const line of text.split('\n')) {
    const match = FENCE_LINE_PATTERN.exec(line);

    if (!open) {
      if (match) {
        open = parseFence(match[1], match[2], match[3]);
      }
      output.push(line);
      continue;
    }

    if (!match || match[2][0] !== open.char) {
      output.push(line);
      continue;
    }

    const length = match[2].length;
    const info = match[3].trim();
    const nestedExample = NESTED_EXAMPLE_LANGS.has(open.language);

    if (!info) {
      // 合法闭合；非嵌套示例代码块容忍长度写错的闭合围栏
      if (length >= open.length || !nestedExample) {
        output.push(`${open.indent}${open.marker}`);
        open = null;
      } else {
        output.push(line);
      }
      continue;
    }

    // 带语言标记的新围栏出现在块内：上一块漏写闭合，切分后继续
    if (length >= open.length) {
      const next = parseFence(match[1], match[2], match[3]);
      if (next) {
        output.push(`${open.indent}${open.marker}`);
        output.push(line);
        open = next;
      } else {
        output.push(line);
      }
      continue;
    }

    output.push(line);
  }

  if (open) output.push(`${open.indent}${open.marker}`);

  return output.join('\n');
}

/* ─────────────────────────────────────────────────────────
 * LaTeX 分隔符兼容
 * remark-math 只识别 $...$ / $$...$$，
 * 但模型经常输出 \[...\] / \(...\)，需要先转换。
 * ───────────────────────────────────────────────────────── */

/** 行内代码片段（含反引号定界符），用于屏蔽转换 */
const INLINE_CODE_PATTERN = /(`+)[\s\S]*?\1/g;

/** 单行裸方括号块级公式：内容必须含 LaTeX 命令，避免误伤引用式链接 */
const PLAIN_BRACKET_MATH_PATTERN = /^\[[ \t]*(\S[^\n]*?)[ \t]*\]$/gm;

function convertMathDelimiters(text: string): string {
  const codeSpans: string[] = [];

  // 先屏蔽行内代码，公式转换不能影响代码内容
  const masked = text.replace(INLINE_CODE_PATTERN, (match) => {
    const index = codeSpans.push(match) - 1;
    return `\u0000CODE${index}\u0000`;
  });

  const converted = masked
    // \[ ... \] → $$ ... $$（可跨行）
    .replace(/\\\[([\s\S]+?)\\\]/g, (match, body: string) => {
      const inner = body.trim();
      return inner ? `\n$$\n${inner}\n$$\n` : match;
    })
    // \( ... \) → $ ... $
    .replace(/\\\(([\s\S]+?)\\\)/g, (match, body: string) => {
      const inner = body.trim();
      return inner ? '$' + inner + '$' : match;
    })
    // 兼容复制后丢失反斜杠的单行 [ ... ] 公式（必须包含 LaTeX 命令）
    .replace(PLAIN_BRACKET_MATH_PATTERN, (match, body: string) => {
      if (!/\\[a-zA-Z]+/.test(body)) return match;
      return `\n$$\n${body}\n$$\n`;
    });

  return converted.replace(/\u0000CODE(\d+)\u0000/g, (_match, index: string) => {
    return codeSpans[Number(index)] ?? '';
  });
}

/**
 * 只在围栏代码块之外执行转换，避免改动代码示例中的 LaTeX 文本。
 */
function transformOutsideFences(
  text: string,
  transform: (chunk: string) => string
): string {
  const lines = text.split('\n');
  const output: string[] = [];
  let chunk: string[] = [];
  let open: { char: string; length: number } | null = null;

  const flush = () => {
    if (!chunk.length) return;
    output.push(transform(chunk.join('\n')));
    chunk = [];
  };

  for (const line of lines) {
    const match = FENCE_LINE_PATTERN.exec(line);

    if (open) {
      output.push(line);
      if (
        match &&
        match[2][0] === open.char &&
        match[2].length >= open.length &&
        !match[3].trim()
      ) {
        open = null;
      }
      continue;
    }

    if (match) {
      flush();
      open = { char: match[2][0], length: match[2].length };
      output.push(line);
      continue;
    }

    chunk.push(line);
  }

  flush();
  return output.join('\n');
}

/**
 * 将 LaTeX 的 \[...\] / \(...\) / 单行 [ ... ] 统一转换为 remark-math 支持的美元符号语法。
 */
export function normalizeMathDelimiters(text: string): string {
  if (!text || (!text.includes('\\[') && !text.includes('\\(') && !text.includes('['))) {
    return text;
  }
  return transformOutsideFences(text, convertMathDelimiters);
}

/**
 * Markdown 渲染前的统一预处理：修补代码围栏 + 兼容 LaTeX 分隔符。
 */
export function prepareMarkdown(text: string): string {
  if (!text) return text;
  return normalizeMathDelimiters(normalizeMarkdownFences(text));
}
