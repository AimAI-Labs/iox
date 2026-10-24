import assert from 'node:assert/strict';
import test from 'node:test';
import { deferred, flush, mountActionStream } from './helpers/action-stream-hook.mjs';

test('the hook filters stale execution events while retaining current canceled completion', async (t) => {
  const h = mountActionStream();
  t.after(h.unmount);
  await h.hook.handleTriggerAction(h.action);
  const first = h.calls.find((call) => call.command === 'trigger_api_action').args;
  await h.hook.handleSendFollowUp('next');
  const latest = h.calls.filter((call) => call.command === 'trigger_api_action').at(-1).args;
  assert.ok(first.requestId);
  assert.notEqual(latest.requestId, first.requestId);
  const before = h.updates.streamText;
  h.emit('token', { ...first, token: 'stale' });
  h.emit('done', { ...first, canceled: true });
  h.emit('error', { ...first, error: 'stale' });
  assert.equal(h.updates.streamText, before);
  assert.equal(h.updates.isLoading, true);
  await h.hook.handleCancel();
  assert.equal(h.updates.isLoading, true);
  const canceled = h.calls.filter((call) => call.command === 'cancel_action').at(-1);
  assert.equal(canceled.args.requestId, latest.requestId);
  h.emit('done', { ...latest, canceled: true });
  assert.equal(h.updates.isLoading, false);
});

test('a newer request is not overwritten by an earlier delayed window resize', async (t) => {
  const resized = deferred();
  let resizing = 0;
  const h = mountActionStream({ updateWindowSize: () => ++resizing === 1 ? resized.promise : Promise.resolve() });
  t.after(h.unmount);
  const first = h.hook.handleTriggerAction(h.action);
  await flush();
  await h.hook.handleTriggerAction(h.action);
  resized.resolve();
  await first;
  assert.equal(h.calls.filter((call) => call.command === 'trigger_api_action').length, 1);
});

test('restoring a session synchronously detaches the old request and ignores its events', async (t) => {
  const h = mountActionStream();
  t.after(h.unmount);
  await h.hook.handleTriggerAction(h.action);
  const first = h.calls.find((call) => call.command === 'trigger_api_action').args;
  h.hook.handleDetachStream();
  h.workspace.restore({ id: 'saved', title: 'Saved', actionId: 'saved-action', model: 'saved-model',
    selectedText: 'saved selection', streamText: 'saved answer', messages: [], createdAt: 1, updatedAt: 1 }, []);
  h.emit('token', { ...first, token: 'stale' });
  h.emit('error', { ...first, error: 'stale error' });
  assert.equal(h.updates.streamText, 'saved answer');
  assert.equal(h.updates.error, null);
  await flush();
  assert.equal(h.calls.find((call) => call.command === 'cancel_action').args.requestId, first.requestId);
});

test('new chat detaches immediately even while start acceptance is pending', async (t) => {
  const accepted = deferred();
  const h = mountActionStream({}, { invoke: (command) => command === 'trigger_api_action' ? accepted.promise : true });
  t.after(h.unmount);
  const starting = h.hook.handleTriggerAction(h.action);
  await flush();
  const first = h.calls.find((call) => call.command === 'trigger_api_action').args;
  const resetting = h.hook.handleNewChat();
  h.emit('token', { ...first, token: 'stale' });
  assert.equal(h.workspace.getSnapshot().active.turns.length, 0);
  assert.equal(h.updates.isLoading, false);
  accepted.reject(new Error('late failure'));
  await Promise.all([starting, resetting]);
  assert.notEqual(h.updates.error, 'Error: late failure');
});

test('re-render and effect cleanup do not duplicate listeners or cancel another action', async () => {
  const h = mountActionStream();
  await h.hook.handleTriggerAction(h.action);
  h.render();
  h.render();
  assert.equal(h.listeners.size, 3);
  const before = h.calls.filter((call) => call.command === 'cancel_action').length;
  h.render({ activeAction: { ...h.action, id: 'different' } });
  assert.equal(h.calls.filter((call) => call.command === 'cancel_action').length, before);
  h.unmount();
  await flush();
  assert.equal(h.listeners.size, 0);
});

test('ignored copy gestures do not detach a running API request', async (t) => {
  for (const method of ['handleTriggerActionWithoutText', 'handleTriggerQuoteAction']) {
    const h = mountActionStream();
    t.after(h.unmount);
    await h.hook.handleTriggerAction(h.action);
    const request = h.calls.find((call) => call.command === 'trigger_api_action').args;
    await h.hook[method]({ id: 'copy', actionType: 'copy' });
    h.emit('token', { ...request, token: 'still owned' });
    assert.equal(h.updates.streamText, 'still owned', method);
  }
});


test('API execution updates the workspace owner instead of a parallel view snapshot', async (t) => {
  const h = mountActionStream(); t.after(h.unmount);
  const before = h.workspace.getSnapshot().activeId;
  await h.hook.handleTriggerAction({ ...h.action, name: 'Action', icon: 'Sparkles', enabled: true });
  assert.notEqual(h.workspace.getSnapshot().activeId, before);
  const request = h.calls.find((call) => call.command === 'trigger_api_action').args;
  h.emit('token', { ...request, token: 'owned answer' });
  assert.equal(h.workspace.getSnapshot().active.turns[0].answer, 'owned answer');
});

test('a bound disabled provider still runs and resolves its first listed model', async (t) => {
  const config = { providers: [
    { id: 'provider', models: ['model'], defaultModel: 'model', enabled: true },
    { id: 'off', models: ['off-model'], defaultModel: '', enabled: false },
  ] };
  const h = mountActionStream({ config }); t.after(h.unmount);
  await h.hook.handleTriggerAction({ ...h.action, providerId: 'off' });
  const request = h.calls.find((call) => call.command === 'trigger_api_action').args;
  assert.equal(request.providerOverride, 'off');
  assert.equal(request.modelOverride, 'off-model');
});

test('the provider switcher only offers enabled entries', async (t) => {
  const config = { providers: [
    { id: 'provider', models: ['model'], defaultModel: 'model', enabled: true },
    { id: 'off', models: ['off-model'], defaultModel: 'off-model', enabled: false },
  ] };
  const h = mountActionStream({ config }); t.after(h.unmount);
  h.hook.handleProviderChange('off');
  assert.equal(h.workspace.getSnapshot().active.action.providerId, 'provider');
});

test('switching and closing tabs cancels their execution and cannot deliver into another tab', async (t) => {
  const h = mountActionStream(); t.after(h.unmount);
  await h.hook.handleTriggerAction(h.action);
  const firstId = h.workspace.getSnapshot().activeId;
  const request = h.calls.find((call) => call.command === 'trigger_api_action').args;
  h.emit('token', { ...request, token: 'partial A' });
  h.hook.handleNewChat();
  const secondId = h.workspace.getSnapshot().activeId;
  h.emit('token', { ...request, token: 'late A' });
  h.emit('done', { ...request, canceled: false });
  assert.equal(h.workspace.getSnapshot().activeId, secondId);
  assert.equal(h.workspace.getSnapshot().active.turns.length, 0);
  h.hook.handleSelectTab(firstId);
  assert.equal(h.workspace.getSnapshot().active.turns[0].answer, 'partial A');
  assert.equal(h.workspace.getSnapshot().active.turns[0].status, 'canceled');
  await h.hook.handleRegenerateCurrentTurn();
  const latest = h.calls.filter((call) => call.command === 'trigger_api_action').at(-1).args;
  h.hook.handleCloseTab(firstId);
  h.emit('token', { ...latest, token: 'closed A' });
  assert.equal(h.workspace.getSnapshot().activeId, secondId);
  assert.equal(h.workspace.getSnapshot().active.turns.length, 0);
});

test('a missing provider model preserves the original selection for retry after configuration', async (t) => {
  const action = { id: 'empty-provider', actionType: 'api', providerId: 'provider', promptTemplate: 'Translate: {text}' };
  const h = mountActionStream({ config: { providers: [] }, selectedText: 'keep this original selection' });
  t.after(h.unmount);
  await h.hook.handleTriggerAction(action);
  assert.equal(h.workspace.getSnapshot().active.selectedText, 'keep this original selection');
  assert.equal(h.workspace.getSnapshot().active.turns[0].prompt, 'keep this original selection');
  assert.ok(h.workspace.getSnapshot().active.error);
  h.hook.handleModelChange('configured-model');
  await h.hook.handleRegenerateCurrentTurn();
  assert.equal(h.calls.find((call) => call.command === 'trigger_api_action').args.text, 'keep this original selection');
});

test('the provider selected for the turn is forwarded with its model and reasoning options', async (t) => {
  const h = mountActionStream({ config: { providers: [
    { id: 'provider', models: ['old-model'], defaultModel: 'old-model' },
    { id: 'chosen', models: ['chosen-model'], defaultModel: 'chosen-model', baseUrl: 'https://api.deepseek.com' },
  ] } });
  t.after(h.unmount);
  h.hook.handleProviderChange('chosen');
  h.hook.handleThinkingModeChange('deep');
  await h.hook.handleSendFollowUp('chosen provider');
  const request = h.calls.find((call) => call.command === 'trigger_api_action').args;
  assert.equal(request.providerOverride, 'chosen');
  assert.equal(request.modelOverride, 'chosen-model');
  assert.equal(request.reasoningEffort, 'high');
  assert.equal(h.workspace.getSnapshot().active.turns.at(-1).providerId, 'chosen');
});
