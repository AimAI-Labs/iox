import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConversationModule } from './helpers/conversation-module.mjs';

const { contextUsage } = await loadConversationModule('conversation/transcript');

const action = { id: 'a', name: 'Action', icon: 'Sparkles', actionType: 'api', enabled: true, promptTemplate: '{text}' };
const turn = (patch = {}) => ({ id: 't', kind: 'followUp', prompt: 'question', answer: 'answer', model: 'm', status: 'complete', ...patch });
const conversation = (patch = {}) => ({
  id: 'c', title: '', action, selectedText: '', selectedModel: 'm', thinkingMode: 'quick',
  initialInput: '', turns: [], sessionId: null, revision: 0, savedRevision: 0,
  generation: null, pendingSave: null, error: null, ...patch,
});

test('context meter resets for new chats and includes drafts and selected text', () => {
  assert.deepEqual(contextUsage(conversation(), '', 5), {
    estimatedTokens: 0, selectionTokens: 0, historyTokens: 0, draftTokens: 0, usedTurns: 0, maxTurns: 5,
  });
  assert.ok(contextUsage(conversation({ selectedText: '选中文本' }), 'draft', 5).estimatedTokens > 0);
});

test('only retained turns contribute to the context length', () => {
  const recent = conversation({ turns: [turn({ prompt: 'follow-up', answer: '最新回答' })] });
  const full = conversation({ turns: [turn({ id: 'old', answer: 'old text'.repeat(1000) }), ...recent.turns] });
  assert.equal(contextUsage(full, '', 1).estimatedTokens, contextUsage(recent, '', 1).estimatedTokens);
  assert.equal(contextUsage(full, '', 1).historyTokens, contextUsage(recent, '', 1).historyTokens);
  assert.equal(contextUsage(full, '', 1).usedTurns, 1);
  assert.ok(contextUsage(recent, 'more text', 1).estimatedTokens > contextUsage(recent, '', 1).estimatedTokens);
});

test('zero context turns excludes history from both requests and the meter', () => {
  const only = conversation({ turns: [turn()] });
  assert.deepEqual(contextUsage(only, '', 0), {
    estimatedTokens: 0, selectionTokens: 0, historyTokens: 0, draftTokens: 0, usedTurns: 0, maxTurns: 0,
  });
});

test('context breakdown estimates each source and sums to the displayed total', () => {
  const usage = contextUsage(conversation({ selectedText: '选中文本', turns: [turn()] }), '  draft  ', 5);
  assert.equal(usage.selectionTokens, 4);
  assert.equal(usage.draftTokens, 2);
  assert.ok(usage.historyTokens > 0);
  assert.equal(usage.estimatedTokens, usage.selectionTokens + usage.historyTokens + usage.draftTokens);
});

test('disabled history keeps selection and draft estimates without counting old turns', () => {
  const usage = contextUsage(conversation({ selectedText: '选区', turns: [turn()] }), 'draft', 0);
  assert.equal(usage.historyTokens, 0);
  assert.equal(usage.usedTurns, 0);
  assert.equal(usage.estimatedTokens, 4);
});

test('a prompt containing the legacy marker literal stays a single turn', () => {
  const literal = 'before\n\n---\n**追问：** literal\n\n<!-- iox:answer -->\n\n```js\nx\n```';
  const single = conversation({ turns: [turn({ prompt: literal, answer: 'answer' })] });
  assert.equal(contextUsage(single, '', 5).usedTurns, 1);
});
