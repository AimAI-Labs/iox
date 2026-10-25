import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const configSource = readFileSync(new URL('../src/types/config.ts', import.meta.url), 'utf8')
  .replace("from 'zod'", `from '${import.meta.resolve('zod')}'`);
const configModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(configSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText).toString('base64')}`);
const fixture = JSON.parse(readFileSync(new URL('./fixtures/config/default-config.zh.json', import.meta.url), 'utf8'));
const hookJs = ts.transpileModule(readFileSync(new URL('../src/hooks/useConfig.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const flush = () => new Promise(setImmediate);
const config = (delay) => ({ ...fixture, general: { ...fixture.general, webDragHoldDelayMs: delay } });

function setup() {
  const registration = deferred();
  const reads = [];
  const values = [];
  const effects = [];
  const exports = {};
  let emit;
  let unlistened = 0;
  vm.runInNewContext(hookJs, { exports, console, require: (name) => {
    if (name === 'react') return {
      useState: (initial) => { const index = values.push(initial) - 1; return [initial, (value) => { values[index] = value; }]; },
      useRef: (current) => ({ current }), useCallback: (fn) => fn,
      useEffect: (effect) => effects.push(effect),
    };
    if (name === '@/types/config') return configModule;
    if (name === '@tauri-apps/api/core') return { invoke: () => { const read = deferred(); reads.push(read); return read.promise; } };
    if (name === '@tauri-apps/api/event') return { listen: (_event, handler) => { emit = handler; return registration.promise; } };
    throw new Error(`Unexpected import ${name}`);
  } });
  const hook = exports.useConfig();
  const cleanup = effects[0]();
  return { hook, values, reads, cleanup, emit: (payload) => emit({ payload }),
    subscribe: () => registration.resolve(() => { unlistened++; }), unlistened: () => unlistened };
}

test('config subscribes before reading and a late read cannot undo a saved drag delay', async () => {
  const h = setup();
  assert.equal(h.reads.length, 0);
  h.subscribe();
  await flush();
  assert.equal(h.reads.length, 1);
  h.emit(config(125));
  h.reads[0].resolve(config(300));
  await flush();
  assert.equal(h.values[0].general.webDragHoldDelayMs, 125);
  assert.equal(h.values[1], false);
  h.cleanup();
  assert.equal(h.unlistened(), 1);
});

test('late listener registration is cleaned up without fetching after unmount', async () => {
  const h = setup();
  h.cleanup();
  h.subscribe();
  await flush();
  assert.equal(h.reads.length, 0);
  assert.equal(h.unlistened(), 1);
});
