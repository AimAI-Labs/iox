import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { mountActionStream } from './helpers/action-stream-hook.mjs';

async function loadModule(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const transcript = await loadModule('../src/lib/chatTranscript.ts');

function setup(overrides = {}, rejectRequest = false) {
  const streamText = 'first answer' + transcript.createFollowUpChunk('old question') +
    'old answer' + transcript.createFollowUpChunk('later question') + 'later answer';
  const mounted = mountActionStream({
    config: { apiCard: { contextTurns: 5 }, providers: [{ id: 'deepseek', baseUrl: 'https://api.deepseek.com' }] },
    activeAction: { id: 'test', providerId: 'deepseek', promptTemplate: 'Translate: {text}' },
    selectedModel: 'test-model', selectedText: 'original selection', streamText,
    thinkingMode: 'deep', isLoading: false,
    ...overrides,
  }, { invoke: () => { if (rejectRequest) throw new Error('request failed'); } });
  return { hook: mounted.hook, calls: mounted.calls, updates: mounted.updates, streamText };
}

test('editing an earlier question preserves preceding history and replaces everything below it', async () => {
  const { hook, calls, updates } = setup();
  assert.equal(await hook.handleEditMessage(1, 'new question\n\nwith paragraphs'), true);
  assert.equal(updates.streamText, 'first answer' + transcript.createFollowUpChunk('new question\n\nwith paragraphs'));
  assert.equal(updates.isLoading, true);
  assert.equal(updates.error, null);
  assert.equal(calls.length, 1);
  const { command, args } = calls[0];
  assert.equal(command, 'trigger_api_action');
  assert.ok(args.text.includes('first answer'));
  assert.ok(args.text.includes('original selection'));
  assert.ok(args.text.includes('new question\n\nwith paragraphs'));
  for (const old of ['old question', 'old answer', 'later question', 'later answer']) {
    assert.ok(!args.text.includes(old), `Must exclude ${old}`);
  }
  assert.equal(args.promptOverride, '{text}');
  assert.equal(args.modelOverride, 'test-model');
  assert.equal(args.reasoningEffort, 'high');
});

test('editing the initial selection clears all answers and uses the original action template', async () => {
  const { hook, calls, updates } = setup();
  assert.equal(await hook.handleEditMessage(0, 'edited selection'), true);
  assert.equal(updates.selectedText, 'edited selection');
  assert.equal(updates.streamText, '');
  assert.equal(calls[0].args.text, 'edited selection');
  assert.equal(calls[0].args.promptOverride, 'Translate: {text}');
});

test('editing the latest question keeps earlier questions and answers', async () => {
  const { hook, calls, updates } = setup();
  await hook.handleEditMessage(2, 'new latest');
  assert.ok(calls[0].args.text.includes('old question'));
  assert.ok(calls[0].args.text.includes('old answer'));
  assert.ok(!calls[0].args.text.includes('later answer'));
  assert.ok(updates.streamText.endsWith(transcript.createFollowUpChunk('new latest')));
});

test('editing respects the configured history limit', async () => {
  const { hook, calls } = setup({ config: { apiCard: { contextTurns: 0 }, providers: [] } });
  await hook.handleEditMessage(2, 'new latest');
  assert.ok(!calls[0].args.text.includes('old answer'));
  assert.ok(!calls[0].args.text.includes('first answer'));
});

test('invalid edits and edits during generation leave the transcript intact', async () => {
  for (const [props, index, text] of [
    [{}, 1, '   '], [{}, -1, 'edit'], [{}, 10, 'edit'], [{}, 1.5, 'edit'],
    [{ isLoading: true }, 1, 'edit'], [{ selectedText: '' }, 0, 'edit'],
    [{ activeAction: null }, 1, 'edit'], [{ selectedModel: '' }, 1, 'edit'],
  ]) {
    const { hook, calls, updates } = setup(props);
    assert.equal(await hook.handleEditMessage(index, text), false);
    assert.equal(calls.length, 0);
    assert.equal(updates.streamText, undefined);
  }
});

test('a failed resend retains the edited message and reports the failure', async () => {
  const { hook, updates } = setup({}, true);
  assert.equal(await hook.handleEditMessage(1, 'edited'), true);
  assert.ok(updates.streamText.endsWith(transcript.createFollowUpChunk('edited')));
  assert.equal(updates.isLoading, false);
  assert.match(updates.error, /request failed/);
});
