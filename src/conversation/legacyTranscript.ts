import type { ConversationTurn } from '../types/session';

/**
 * 旧版 streamText 的轮次编码（只读兼容 + 落盘镜像）。
 *
 * 0.1 版本把追问直接拼进纯文本：`\n\n---\n**追问：** <内容>`，并用第一个空行
 * 切分追问与回答。该格式对含空行、代码块或标记字面量的正文本就有损，因此现在仅用于：
 * 1. 读取尚未带有 `conversation` 字段的历史会话；
 * 2. 写盘时保留 `streamText` 镜像，供旧版本与外部工具读取。
 *
 * 结构化轮次是唯一的事实来源，任何新的读写路径都不应再解释这段文本。
 */

const FOLLOW_UP_MARKER = '\n\n---\n**追问：** ';
const ANSWER_START_MARKER = '\n\n<!-- iox:answer -->\n\n';
const FOLLOW_UP_SPLIT_RE = /\n\n---\n\*\*追问：\*\*[ \t]?/;

export interface LegacyTurn {
  prompt: string;
  answer: string;
}

/** 把结构化轮次编码成旧版文本；首轮只写回答，与历史数据保持一致。 */
export function encodeLegacyTranscript(
  turns: Pick<ConversationTurn, 'kind' | 'prompt' | 'answer'>[]
): string {
  return turns
    .map((turn) => (turn.kind === 'selection'
      ? turn.answer
      : `${FOLLOW_UP_MARKER}${turn.prompt}${ANSWER_START_MARKER}${turn.answer}`))
    .join('');
}

/**
 * 解码旧版文本。索引 0 是首轮回答（prompt 为空，由调用方用 selectedText 补齐），
 * 其余元素是完整的追问轮次。含分隔标记字面量的历史文本无法无损还原，这是旧格式的
 * 已知限制，结构化解码路径不受影响。
 */
export function decodeLegacyTranscript(streamText: string): LegacyTurn[] {
  const [first = '', ...rest] = streamText.split(FOLLOW_UP_SPLIT_RE);
  return [{ prompt: '', answer: first }, ...rest.map(splitLegacyChunk)];
}

function splitLegacyChunk(chunk: string): LegacyTurn {
  const answerIndex = chunk.indexOf(ANSWER_START_MARKER);
  if (answerIndex !== -1) {
    return {
      prompt: chunk.slice(0, answerIndex).replace(/\s+$/, ''),
      answer: chunk.slice(answerIndex + ANSWER_START_MARKER.length),
    };
  }
  // 更早的历史没有回答起始标记，只能按第一个空行近似切分。
  const blankIndex = chunk.indexOf('\n\n');
  if (blankIndex === -1) return { prompt: chunk.trim(), answer: '' };
  return { prompt: chunk.slice(0, blankIndex).trim(), answer: chunk.slice(blankIndex + 2) };
}
