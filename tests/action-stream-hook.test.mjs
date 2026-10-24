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
  h.hook.handleRestoreSession('saved answer', 'saved-model');
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
  assert.equal(h.updates.streamText, '');
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
