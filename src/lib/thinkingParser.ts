/**
 * 思维链（thinking）文本解析工具
 *
 * 解析模型流式输出中 `<think>...</think>` 块与正文内容。
 * 支持三种状态：
 * 1. 无 thinking 标签 —— 纯正文
 * 2. thinking 标签未闭合 —— 思考进行中
 * 3. thinking 标签已闭合 —— 思考完成，正文已拼接
 *
 * 该模块是从 `ResultCard.tsx` 抽取的公共逻辑，便于复用与单元测试。
 *
 * 注意：此处的标签字面量为 `<think>` / `</think>`，
 * 与 Rust 端 `ai/stream.rs` 中识别的标签保持一致。
 */

/** 思维链标签（与 DeepSeek / Qwen 等模型约定一致） */
export const THINKING_OPEN_TAG = "<think>";
export const THINKING_CLOSE_TAG = "</think>";

export interface ParsedThinking {
  /** 思维链文本（不含标签） */
  thinkingText: string;
  /** 正文文本（已剥离 thinking 标签与内容） */
  mainText: string;
  /** 是否处于思考中（标签未闭合） */
  isThinking: boolean;
}

/** 空解析结果 */
export const EMPTY_PARSED: ParsedThinking = {
  thinkingText: "",
  mainText: "",
  isThinking: false,
};

/**
 * 解析文本中的思维链与正文。
 *
 * @param text 模型流式累计文本
 * @returns 解析结果 {@link ParsedThinking}
 */
export function parseThinkingAndMain(text: string): ParsedThinking {
  if (!text) {
    return { ...EMPTY_PARSED };
  }

  const openIndex = text.indexOf(THINKING_OPEN_TAG);

  if (openIndex === -1) {
    return { thinkingText: "", mainText: text, isThinking: false };
  }

  const closeIndex = text.indexOf(THINKING_CLOSE_TAG, openIndex);

  if (closeIndex === -1) {
    // 思考中，标签尚未闭合
    const thinking = text.slice(openIndex + THINKING_OPEN_TAG.length);
    const prefix = text.slice(0, openIndex);
    return { thinkingText: thinking, mainText: prefix, isThinking: true };
  }

  // 思考已闭合
  const thinking = text.slice(
    openIndex + THINKING_OPEN_TAG.length,
    closeIndex
  );
  const main =
    text.slice(0, openIndex) +
    text.slice(closeIndex + THINKING_CLOSE_TAG.length);
  return { thinkingText: thinking, mainText: main.trimStart(), isThinking: false };
}
