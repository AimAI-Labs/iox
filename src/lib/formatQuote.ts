/**
 * 将选中文本格式化为标准 Markdown 块引用格式
 * 每一行前缀添加 `> `，末尾添加两个换行符
 */
export function formatQuoteText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const lines = trimmed.split('\n');
  const quoteContent = lines.map((line) => `> ${line}`).join('\n');
  return `${quoteContent}\n\n`;
}
