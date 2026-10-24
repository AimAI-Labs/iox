import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

async function moduleAt(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const client = await moduleAt('../../src/lib/actionStreamClient.ts');
const transcript = await moduleAt('../../src/lib/chatTranscript.ts');
const reasoning = await moduleAt('../../src/lib/reasoning.ts');
const source = readFileSync(new URL('../../src/hooks/useActionStream.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

export function mountActionStream(overrides = {}, transport = {}) {
  const calls = [];
  const updates = {};
  const listeners = new Map();
  const slots = [];
  const effects = [];
  let cursor = 0;
  let sequence = 0;
  let hook;
  const changed = (a, b) => !a || b.some((value, index) => !Object.is(value, a[index]));
  const react = {
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: callback() };
      });
    },
  };
  const modules = {
    react,
    '@tauri-apps/api/core': { invoke: async (command, args) => {
      calls.push({ command, args });
      return transport.invoke?.(command, args);
    } },
    '@tauri-apps/api/event': { listen: async (name, handler) => {
      await transport.subscribe?.(name);
      listeners.set(name, handler);
      return () => listeners.delete(name);
    } },
    '@/lib/actionStreamClient': client,
    '@/lib/chatTranscript': transcript,
    '@/lib/reasoning': reasoning,
    '@/lib/formatQuote': { formatQuoteText: (text) => text },
  };
  const exports = {};
  vm.runInNewContext(js, { exports, console,
    crypto: { randomUUID: () => `hook-request-${++sequence}` },
    require: (name) => { assert.ok(modules[name], `Unexpected import: ${name}`); return modules[name]; },
  });
  const action = { id: 'action', actionType: 'api', providerId: 'provider', promptTemplate: '{text}' };
  let props = {
    config: { providers: [{ id: 'provider', models: ['model'], defaultModel: 'model' }] },
    activeAction: action, selectedText: 'selection', selectedModel: 'model',
    streamText: '', isLoading: false, isPinned: false, thinkingMode: 'quick',
    updateWindowSize: async () => {}, executeGracefulHide: () => {},
    onStartAction: (value) => { updates.activeAction = value; updates.streamText = ''; updates.isLoading = true; },
    onAppendToken: (token) => { updates.streamText = (updates.streamText ?? props.streamText) + token; },
    onStreamDone: () => { updates.isLoading = false; },
    onStreamError: (error) => { updates.error = error; updates.isLoading = false; },
    onSetStreamText: (text) => { updates.streamText = text; },
    onSetSelectedText: (text) => { updates.selectedText = text; },
    onSetLoading: (value) => { updates.isLoading = value; },
    onSetError: (error) => { updates.error = error; },
    onSetModel: (model) => { updates.selectedModel = model; },
    onSetProvider: () => {}, onSetThinkingMode: () => {},
    onNewChat: () => { updates.streamText = ''; updates.isLoading = false; },
    ...overrides,
  };
  function render(patch = {}) {
    props = { ...props, ...updates, ...patch };
    cursor = 0;
    hook = exports.useActionStream(props);
    effects.splice(0).forEach((effect) => effect());
    return hook;
  }
  render();
  return {
    action, calls, updates, listeners, render,
    get hook() { return hook; },
    emit: (kind, payload) => listeners.get(`action-stream-${kind}`)?.({ payload }),
    unmount: () => slots.forEach((slot) => slot?.cleanup?.()),
  };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export const flush = () => new Promise(setImmediate);
