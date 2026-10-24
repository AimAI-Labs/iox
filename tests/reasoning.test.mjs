import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { mountActionStream } from './helpers/action-stream-hook.mjs';

const source = readFileSync(new URL('../src/lib/reasoning.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { getThinkingRequestOptions, THINKING_LEVELS } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('slider levels map to the official low, high and max effort values', () => {
  const provider = { id: 'deepseek', baseUrl: 'https://api.deepseek.com' };
  assert.deepEqual(THINKING_LEVELS, ['quick', 'low', 'deep', 'max']);
  for (const [mode, effort] of [['low', 'low'], ['deep', 'high'], ['max', 'max']]) {
    assert.deepEqual(getThinkingRequestOptions(mode, provider), {
      thinkingEnabled: true, reasoningEffort: effort,
    });
  }
});

test('turning thinking off omits effort and disables thinking', () => {
  assert.deepEqual(getThinkingRequestOptions('quick', { id: 'deepseek', baseUrl: '' }), {
    thinkingEnabled: false,
  });
});

test('other providers and missing providers do not receive DeepSeek reasoning parameters', () => {
  for (const mode of THINKING_LEVELS) {
    assert.deepEqual(getThinkingRequestOptions(mode, { id: 'other', baseUrl: 'https://example.com/v1' }), {
      thinkingEnabled: false,
    });
    assert.deepEqual(getThinkingRequestOptions(mode), { thinkingEnabled: false });
  }
});

test('initial answers, follow-ups and both regenerate paths use the selected effort', async () => {
  const transcriptSource = readFileSync(new URL('../src/lib/chatTranscript.ts', import.meta.url), 'utf8');
  const transcriptJs = ts.transpileModule(transcriptSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const transcript = await import(`data:text/javascript;base64,${Buffer.from(transcriptJs).toString('base64')}`);

  for (const mode of THINKING_LEVELS) {
    const provider = { id: 'deepseek', baseUrl: 'https://api.deepseek.com', models: ['deepseek-flash'], defaultModel: 'deepseek-flash' };
    const action = { id: 'test', actionType: 'api', providerId: provider.id, promptTemplate: '{text}' };
    const props = {
      config: { providers: [provider] }, selectedText: 'question', activeAction: action,
      selectedModel: provider.defaultModel, streamText: 'answer', thinkingMode: mode,
      updateWindowSize: async () => {},
    };
    const mounted = mountActionStream(props);
    await mounted.hook.handleTriggerAction(action);
    await mounted.hook.handleSendFollowUp('follow-up');
    await mounted.hook.handleRegenerateCurrentTurn();
    const multiTurn = mountActionStream({ ...props, streamText: `answer${transcript.createFollowUpChunk('follow-up')}second answer` });
    await multiTurn.hook.handleRegenerateCurrentTurn();
    const calls = [...mounted.calls, ...multiTurn.calls].filter((call) => call.command === 'trigger_api_action');
    assert.equal(calls.length, 4);
    for (const { command, args } of calls) {
      assert.equal(command, 'trigger_api_action');
      const expected = getThinkingRequestOptions(mode, provider);
      assert.equal(args.thinkingEnabled, expected.thinkingEnabled);
      assert.equal(args.reasoningEffort, expected.reasoningEffort);
      assert.equal(typeof args.requestId, 'string');
    }
    mounted.unmount();
    multiTurn.unmount();
  }
});
