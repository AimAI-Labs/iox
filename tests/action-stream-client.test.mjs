import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const path = new URL('../src/lib/actionStreamClient.ts', import.meta.url);
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { createActionStreamClient } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise(setImmediate);

function setup(options = {}) {
  assert.equal(typeof createActionStreamClient, 'function', 'The execution lifecycle client is missing');
  const listeners = new Map();
  const calls = [];
  const events = [];
  let sequence = 0;
  let removed = 0;
  const client = createActionStreamClient({
    createRequestId: () => `request-${++sequence}`,
    listen: async (name, handler) => {
      await options.subscription?.(name);
      listeners.set(name, handler);
      return () => { removed++; listeners.delete(name); };
    },
    invoke: async (command, args) => {
      calls.push({ command, args });
      return options.invoke?.(command, args);
    },
    onToken: (token) => events.push(['token', token]),
    onDone: (canceled) => events.push(['done', canceled]),
    onError: (error) => events.push(['error', error]),
  });
  return {
    client, calls, events, listeners,
    get removed() { return removed; },
    emit: (kind, payload) => listeners.get(`action-stream-${kind}`)?.({ payload }),
    start: (actionId = 'action', prepare) => client.start({ actionId, text: 'question' }, prepare),
  };
}

test('only the current action/request pair receives events, and terminal events seal it', async () => {
  const h = setup();
  await h.start();
  const identity = { actionId: 'action', requestId: 'request-1' };
  h.emit('token', { actionId: 'action', token: 'legacy' });
  h.emit('token', { ...identity, requestId: 'old', token: 'old' });
  h.emit('token', { ...identity, actionId: 'other', token: 'other' });
  h.emit('token', { ...identity, token: 'answer' });
  h.emit('done', { ...identity, canceled: false });
  h.emit('token', { ...identity, token: 'late' });
  h.emit('done', { ...identity, canceled: true });
  h.emit('error', { ...identity, error: 'late error' });
  assert.deepEqual(h.events, [['token', 'answer'], ['done', false]]);
  h.client.dispose();
});

test('replacement ignores old tokens, done, errors and a late command rejection', async () => {
  const accepted = deferred();
  const h = setup({ invoke: (command, args) => command === 'trigger_api_action' && args.requestId === 'request-1' ? accepted.promise : undefined });
  const first = h.start();
  await flush();
  const second = h.start();
  h.emit('token', { actionId: 'action', requestId: 'request-1', token: 'stale' });
  h.emit('done', { actionId: 'action', requestId: 'request-1', canceled: true });
  h.emit('error', { actionId: 'action', requestId: 'request-1', error: 'stale' });
  assert.equal(h.calls.filter((c) => c.command === 'trigger_api_action').length, 1);
  accepted.reject(new Error('old command failure'));
  await Promise.all([first, second]);
  h.emit('token', { actionId: 'action', requestId: 'request-2', token: 'new' });
  assert.deepEqual(h.events, [['token', 'new']]);
  assert.equal(h.calls.filter((c) => c.command === 'trigger_api_action').length, 2);
  h.client.dispose();
});

test('cancellation before acceptance waits and targets that execution, never a new one', async () => {
  const accepted = deferred();
  const h = setup({ invoke: (command, args) => command === 'trigger_api_action' && args.requestId === 'request-1' ? accepted.promise : true });
  const first = h.start();
  await flush();
  const canceled = h.client.cancel();
  const second = h.start();
  assert.equal(h.calls.filter((c) => c.command === 'cancel_action').length, 0);
  accepted.resolve();
  await Promise.all([first, canceled, second]);
  const cancellations = h.calls.filter((c) => c.command === 'cancel_action');
  assert.equal(cancellations.length, 1);
  assert.deepEqual(cancellations[0].args, { actionId: 'action', requestId: 'request-1' });
  h.emit('done', { actionId: 'action', requestId: 'request-1', canceled: true });
  h.emit('token', { actionId: 'action', requestId: 'request-2', token: 'still running' });
  assert.deepEqual(h.events, [['token', 'still running']]);
  h.client.dispose();
});

test('cancellation before subscription is ready never submits a request', async () => {
  const subscribed = deferred();
  const h = setup({ subscription: () => subscribed.promise });
  const starting = h.start();
  await h.client.cancel();
  assert.deepEqual(h.events, [['done', true]]);
  subscribed.resolve();
  await starting;
  assert.equal(h.calls.length, 0);
  h.client.dispose();
});

test('delayed view preparation cannot submit an obsolete initial request', async () => {
  const prepared = deferred();
  const h = setup();
  const first = h.start('action', () => prepared.promise);
  await flush();
  await h.start();
  prepared.resolve();
  await first;
  assert.deepEqual(h.calls.filter((c) => c.command === 'trigger_api_action').map((c) => c.args.requestId), ['request-2']);
  h.client.dispose();
});

test('different actions start independently without automatically canceling each other', async () => {
  const firstAccepted = deferred();
  const h = setup({ invoke: (command, args) => command === 'trigger_api_action' && args.actionId === 'first' ? firstAccepted.promise : undefined });
  const first = h.start('first');
  await flush();
  await h.start('second');
  assert.deepEqual(h.calls.map((c) => c.args.actionId), ['first', 'second']);
  assert.equal(h.calls.some((c) => c.command === 'cancel_action'), false);
  firstAccepted.resolve();
  await first;
  h.client.dispose();
});

test('detach revokes ownership synchronously before its cancellation resolves', async () => {
  const cancel = deferred();
  const h = setup({ invoke: (command) => command === 'cancel_action' ? cancel.promise : undefined });
  await h.start();
  const detached = h.client.detach();
  h.emit('token', { actionId: 'action', requestId: 'request-1', token: 'stale' });
  h.emit('error', { actionId: 'action', requestId: 'request-1', error: 'stale' });
  await h.start('other');
  cancel.reject(new Error('late cancel error'));
  await detached;
  h.emit('token', { actionId: 'other', requestId: 'request-2', token: 'current' });
  assert.deepEqual(h.events, [['token', 'current']]);
  h.client.dispose();
});

test('manual stop retains ownership until its canceled terminal event arrives', async () => {
  const h = setup();
  await h.start();
  await h.client.cancel();
  assert.deepEqual(h.events, []);
  h.emit('token', { actionId: 'action', requestId: 'request-1', token: '</think>' });
  h.emit('done', { actionId: 'action', requestId: 'request-1', canceled: true });
  await h.client.cancel();
  assert.deepEqual(h.events, [['token', '</think>'], ['done', true]]);
  assert.equal(h.calls.filter((c) => c.command === 'cancel_action').length, 1);
  h.client.dispose();
});

test('current start and cancellation failures end locally without affecting later requests', async () => {
  const h = setup({ invoke: () => { throw new Error('transport unavailable'); } });
  await h.start();
  assert.deepEqual(h.events, [['error', 'Error: transport unavailable']]);
  h.client.dispose();
  const canceling = setup({ invoke: (command) => {
    if (command === 'cancel_action') throw new Error('cancel failed');
  } });
  await canceling.start();
  await canceling.client.cancel();
  canceling.emit('token', { actionId: 'action', requestId: 'request-1', token: 'too late' });
  assert.deepEqual(canceling.events, [['error', 'Error: cancel failed']]);
  canceling.client.dispose();
});

test('subscription failure prevents requests and cleans subscriptions resolving later', async () => {
  const pending = deferred();
  const h = setup({ subscription: (name) => name.endsWith('token') ? Promise.reject(new Error('listen failed')) : pending.promise });
  await h.start();
  assert.equal(h.calls.length, 0);
  assert.deepEqual(h.events, [['error', 'Error: listen failed']]);
  pending.resolve();
  await flush();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.removed, 2);
  h.client.dispose();
});

test('disposing before listener registration finishes cleans every late subscription', async () => {
  const pending = deferred();
  const h = setup({ subscription: () => pending.promise });
  const starting = h.start();
  h.client.dispose();
  pending.resolve();
  await starting;
  assert.equal(h.removed, 3);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.calls.length, 0);
  assert.deepEqual(h.events, []);
});

test('events may arrive synchronously during command acceptance without losing the first token', async () => {
  let h;
  h = setup({ invoke: (command, args) => {
    if (command === 'trigger_api_action') {
      h.emit('token', { ...args, token: 'first' });
      h.emit('done', { ...args, canceled: false });
    }
  } });
  await h.start();
  assert.deepEqual(h.events, [['token', 'first'], ['done', false]]);
  h.client.dispose();
});
