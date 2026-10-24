import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { loadConversationModule } from './conversation-module.mjs';
const { createConversationWorkspace } = await loadConversationModule('conversation/workspace');
const conversationTranscript = await loadConversationModule('conversation/transcript');

async function moduleAt(path, rewrite = (source) => source) {
  const source = rewrite(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const client = await moduleAt('../../src/lib/actionStreamClient.ts');
const reasoning = await moduleAt('../../src/lib/reasoning.ts');
const provider = await moduleAt('../../src/lib/provider.ts');
const config = await moduleAt('../../src/types/config.ts', (source) =>
  source.replace("from 'zod'", `from '${import.meta.resolve('zod')}'`)
);
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
    '@/lib/reasoning': reasoning,
    '@/lib/provider': provider,
    '@/types/config': config,
    '@/conversation/transcript': conversationTranscript,
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
  const workspace = createConversationWorkspace({ createId: () => `conversation-${++sequence}` });
  if (props.activeAction) {
    const initialAction = { name: 'Test action', icon: 'Sparkles', enabled: true, actionType: 'api', ...props.activeAction };
    workspace.restore({ id: 'seed', title: '', actionId: initialAction.id, providerId: initialAction.providerId,
      model: props.selectedModel, selectedText: props.selectedText, streamText: props.streamText,
      messages: [], createdAt: 1, updatedAt: 1 }, [initialAction]);
    workspace.forgetSession('seed');
    workspace.chooseThinkingMode(props.thinkingMode);
    if (props.isLoading) workspace.regenerate(5);
  }
  props.workspace = workspace;
  props.selectionText = props.selectedText;
  props.onShowCard = () => {};
  let previous = workspace.getSnapshot().active;
  const unsubscribe = workspace.subscribe(() => {
    const active = workspace.getSnapshot().active;
    const text = active ? conversationTranscript.compatibilityTranscript(active) : '';
    const oldText = previous ? conversationTranscript.compatibilityTranscript(previous) : '';
    if (text !== oldText) updates.streamText = text;
    if (active?.selectedText !== previous?.selectedText) updates.selectedText = active?.selectedText ?? '';
    updates.isLoading = Boolean(active?.generation);
    updates.error = active?.error ?? null;
    updates.activeAction = active?.action ?? null;
    updates.selectedModel = active?.selectedModel ?? '';
    previous = active;
  });
  function render(patch = {}) {
    props = { ...props, ...patch };
    if ('selectedText' in patch) props.selectionText = patch.selectedText;
    if ('activeAction' in patch && patch.activeAction?.id !== workspace.getSnapshot().active?.action.id) {
      if (patch.activeAction) workspace.openEmpty({ name: 'Action', icon: 'Sparkles', enabled: true, ...patch.activeAction }, props.selectedModel);
      else workspace.reset();
    }
    cursor = 0;
    hook = exports.useActionStream(props);
    effects.splice(0).forEach((effect) => effect());
    return hook;
  }
  render();
  return {
    action, calls, updates, listeners, render, workspace,
    get hook() { return hook; },
    emit: (kind, payload) => listeners.get(`action-stream-${kind}`)?.({ payload }),
    unmount: () => { unsubscribe(); slots.forEach((slot) => slot?.cleanup?.()); },
  };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export const flush = () => new Promise(setImmediate);
