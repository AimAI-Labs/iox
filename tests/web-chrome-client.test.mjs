import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/webChromeClient.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { createWebChromeClient } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const layout = (revision, headless = true) => ({
  revision, headless, menu: { x: 804, y: 12, width: 44, height: 44, expanded: false },
});

test('subscription precedes the initial read and a late read cannot replace a newer mode', async () => {
  const subscribed = deferred();
  const read = deferred();
  const calls = [];
  const layouts = [];
  let emit;
  const client = createWebChromeClient({
    listen: (handler) => { emit = handler; return subscribed.promise; },
    invoke: (command) => { calls.push(command); return read.promise; },
  }, (value) => layouts.push(value), assert.fail);
  assert.deepEqual(calls, []);
  subscribed.resolve(() => {});
  await Promise.resolve();
  assert.deepEqual(calls, ['get_web_chrome']);
  emit(layout(2, true));
  read.resolve(layout(1, false));
  await client.ready;
  assert.deepEqual(layouts.map((value) => [value.revision, value.headless]), [[2, true]]);
  emit(layout(1, false));
  assert.equal(layouts.length, 1);
  client.dispose();
});

test('drag updates coalesce while IPC is pending and preserve the last toggle and position', async () => {
  const first = deferred();
  const calls = [];
  let revision = 1;
  const client = createWebChromeClient({
    listen: async () => () => {},
    invoke: async (command, args) => {
      if (command === 'get_web_chrome') return layout(1);
      calls.push(args);
      if (calls.length === 1) await first.promise;
      return layout(++revision);
    },
  }, () => {}, assert.fail);
  await client.ready;
  const start = client.update({ position: [700, 20] });
  await Promise.resolve();
  const middle = client.update({ position: [600, 30] });
  const last = client.update({ position: [500, 40] });
  const open = client.update({ expanded: true });
  first.resolve();
  assert.deepEqual(await Promise.all([start, middle, last, open]), [true, true, true, true]);
  assert.deepEqual(calls, [
    { position: [700, 20] },
    { position: [500, 40], expanded: true, wheel: false },
  ]);
  client.dispose();
});

test('disposing before listener registration cleans up and prevents native reads', async () => {
  const subscribed = deferred();
  let unlistened = 0;
  const client = createWebChromeClient({
    listen: () => subscribed.promise,
    invoke: () => assert.fail('Disposed client must not invoke native commands'),
  }, () => assert.fail('Disposed client must not update views'), assert.fail);
  client.dispose();
  subscribed.resolve(() => { unlistened++; });
  await client.ready;
  assert.equal(unlistened, 1);
  assert.equal(await client.update({ expanded: true }), false);
});

test('a failed layout surfaces an error and subsequent updates can recover', async () => {
  const errors = [];
  let fail = true;
  const client = createWebChromeClient({
    listen: async () => () => {},
    invoke: async (command) => {
      if (command === 'get_web_chrome') return layout(1);
      if (fail) throw new Error('native layout failed');
      return layout(2);
    },
  }, () => {}, (error) => errors.push(error));
  await client.ready;
  assert.equal(await client.update({ expanded: true }), false);
  fail = false;
  assert.equal(await client.update({ expanded: false }), true);
  assert.equal(errors.length, 1);
  client.dispose();
});

test('opening the full menu overrides an earlier queued hover wheel', async () => {
  const first = deferred();
  const calls = [];
  let revision = 1;
  const client = createWebChromeClient({
    listen: async () => () => {},
    invoke: async (command, args) => {
      if (command === 'get_web_chrome') return layout(1);
      calls.push(args);
      if (calls.length === 1) await first.promise;
      return layout(++revision);
    },
  }, () => {}, assert.fail);
  await client.ready;
  const moving = client.update({ position: [500, 40] });
  await Promise.resolve();
  const hover = client.update({ wheel: true });
  const click = client.update({ expanded: true });
  first.resolve();
  await Promise.all([moving, hover, click]);
  assert.deepEqual(calls[1], { wheel: false, expanded: true });
  client.dispose();
});
