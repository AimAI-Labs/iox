/**
 * 多轮对话文本（streamText）的分轮解析工具
 *
 * 历史实现把「追问：<内容>」直接拼进 streamText，并用「第一个空行」
 * 区分用户追问与助手回答。一旦追问本身包含空行（长文本、代码、列表），
 * 气泡只会显示第一段，剩余内容被当成回答。
 *
 * 新格式在追问内容之后插入一个内部 HTML 注释标记，渲染时不可见，
 * 从而可以无歧义地还原完整追问内容；旧会话仍走原来的空行回退逻辑。
 */

/** 追问分隔标记（写入 streamText 的固定前缀） */
export const FOLLOW_UP_MARKER = '\n\n---\n**追问：** ';

/** 追问结束、助手回答开始的内部标记（HTML 注释，Markdown 渲染时不可见） */
export const ANSWER_START_MARKER = '\n\n<!-- iox:answer -->\n\n';

/**
 * 按追问标记拆分。仅消费标记后的一个分隔空格，
 * 保留追问自身开头的换行/缩进（例如以代码块开头的追问）。
 */
const FOLLOW_UP_SPLIT_RE = /\n\n---\n\*\*追问：\*\*[ \t]?/;

export interface TurnChunk {
  prompt: string;
  answer: string;
}

/** 解析单个追问块（标记之后、下一轮标记之前的文本） */
export function splitTurnChunk(chunk: string): TurnChunk {
  const answerIndex = chunk.indexOf(ANSWER_START_MARKER);

  if (answerIndex !== -1) {
    return {
      prompt: chunk.slice(0, answerIndex).replace(/\s+$/, ''),
      answer: chunk.slice(answerIndex + ANSWER_START_MARKER.length),
    };
  }

  // 兼容旧会话：第一个空行之前视为追问，之后视为回答
  const blankIndex = chunk.indexOf('\n\n');
  if (blankIndex === -1) {
    return { prompt: chunk.trim(), answer: '' };
  }
  return {
    prompt: chunk.slice(0, blankIndex).trim(),
    answer: chunk.slice(blankIndex + 2),
  };
}

/** 按追问标记拆分原始文本，索引 0 为首轮问答 */
export function splitTranscript(streamText: string): string[] {
  return streamText.split(FOLLOW_UP_SPLIT_RE);
}

/** 将一次追问写入 transcript，并插入回答起始标记 */
export function createFollowUpChunk(prompt: string): string {
  return `${FOLLOW_UP_MARKER}${prompt}${ANSWER_START_MARKER}`;
}

/** 去掉仅供前端分轮的内部标记 */
export function stripInternalMarkers(text: string): string {
  return text.split(ANSWER_START_MARKER).join('\n\n');
}

/** 构造发送给模型的历史上下文 */
export function buildHistoryContext(streamText: string, maxTurns: number): string {
  if (maxTurns <= 0) return '';
  const parts = splitTranscript(streamText);
  return stripInternalMarkers(parts.slice(-maxTurns).join(FOLLOW_UP_MARKER));
}

export interface ContextUsage {
  estimatedTokens: number;
  usedTurns: number;
  maxTurns: number;
}

/** 内容长度估算，非服务商计费 token 数；不推断未知的模型窗口大小。 */
export function getContextUsage(
  streamText: string,
  selectedText: string,
  draft: string,
  maxTurns: number
): ContextUsage {
  const history = buildHistoryContext(streamText, maxTurns);
  const content = [selectedText, history, draft.trim()].filter(Boolean).join('\n\n');
  let tokenEstimate = 0;
  for (const char of content) {
    tokenEstimate += char.codePointAt(0)! <= 0x7f ? 0.25 : 1;
  }
  const usedTurns = maxTurns > 0
    ? Math.min(splitTranscript(streamText).filter((part) => part.trim()).length, maxTurns)
    : 0;
  return { estimatedTokens: Math.ceil(tokenEstimate), usedTurns, maxTurns };
}
