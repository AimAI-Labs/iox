import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/chatTranscript.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { getContextUsage, buildHistoryContext, createFollowUpChunk } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('context meter resets for new chats and includes drafts and selected text', () => {
  assert.deepEqual(getContextUsage('', '', '', 5), { estimatedTokens: 0, usedTurns: 0, maxTurns: 5 });
  assert.ok(getContextUsage('', '选中文本', 'draft', 5).estimatedTokens > 0);
});

test('only retained turns contribute to the context length', () => {
  const recent = `answer${createFollowUpChunk('follow-up')}最新回答`;
  const full = `old text`.repeat(1000) + createFollowUpChunk('question') + recent;
  assert.equal(getContextUsage(full, '', '', 1).estimatedTokens,
    getContextUsage(recent, '', '', 1).estimatedTokens);
  assert.equal(getContextUsage(full, '', '', 1).usedTurns, 1);
  assert.ok(getContextUsage(recent, '', 'more text', 1).estimatedTokens >
    getContextUsage(recent, '', '', 1).estimatedTokens);
});

test('zero context turns excludes history from both requests and the meter', () => {
  assert.equal(buildHistoryContext('old answer', 0), '');
  assert.deepEqual(getContextUsage('old answer', '', '', 0),
    { estimatedTokens: 0, usedTurns: 0, maxTurns: 0 });
});
