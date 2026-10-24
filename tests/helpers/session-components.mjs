import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { loadConversationModule } from './conversation-module.mjs';
const { createConversationWorkspace } = await loadConversationModule('conversation/workspace');

export const flush = () => new Promise(setImmediate);
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export function mountSessionView(view = 'hook', invoke = async () => [], overrides = {}) {
  const slots = [], effects = [], timers = new Map(), calls = [];
  let cursor = 0, dirty = false, value, timerId = 0;
  const changed = (a, b) => !a || b.some((item, i) => !Object.is(item, a[i]));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next) => {
        const resolved = typeof next === 'function' ? next(slots[index]) : next;
        if (!Object.is(resolved, slots[index])) { slots[index] = resolved; dirty = true; }
      }];
    },
    useSyncExternalStore(subscribe, getSnapshot) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { cleanup: subscribe(() => { dirty = true; }) };
      return getSnapshot();
    },
    useRef: (initial) => slots[cursor++] ??= { current: initial },
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
    react: { ...react, default: react },
    '@tauri-apps/api/core': { invoke: (command, args) => { calls.push({ command, args }); return invoke(command, args); } },
    '@/hooks/useTranslation': { useTranslation: () => ({ resolvedLanguage: 'en', t: (key) => key }) },
    '@/hooks/useCopyFeedback': { useCopyFeedback: () => ({ copied: false, copy() {} }) },
    '@/lib/utils': { cn: (...items) => items.filter(Boolean).join(' ') },
    'lucide-react': new Proxy({}, { get: (_, name) => name }),
    '@/components/overlay/MarkdownContent': { MarkdownContent: 'MarkdownContent' },
  };
  const load = (path) => {
    const source = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
    const exports = {};
    vm.runInNewContext(js, { exports, console: { warn() {}, error() {} },
      window: { confirm: () => true },
      setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
      clearTimeout: (id) => timers.delete(id),
      require: (name) => { assert.ok(modules[name], `Unexpected import: ${name}`); return modules[name]; },
    });
    return exports;
  };
  // Render the real shared alert when present, without executing child component hooks inline.
  try { modules['@/components/SessionStorageAlert'] = load('src/components/SessionStorageAlert.tsx'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const component = view === 'hook' ? load('src/hooks/useChatSessions.ts').useChatSessions
    : view === 'panel' ? load('src/components/overlay/SessionPanel.tsx').SessionPanel
    : load('src/components/settings/SessionsTab.tsx').SessionsTab;
  let props = { activeAction: { id: 'action', providerId: 'provider' }, selectedModel: 'model',
    selectedText: 'selection', streamText: 'answer', isLoading: true,
    onRestoreSession() {}, onResetToNewChat() {}, ...overrides };
  let sequence = 0;
  const workspace = createConversationWorkspace({ createId: () => `session-view-${++sequence}` });
  if (view === 'hook' && props.activeAction) {
    const plan = workspace.startInitial({ name: 'Action', icon: 'Sparkles', enabled: true, actionType: 'api', ...props.activeAction }, props.selectedModel, props.selectedText);
    workspace.append(plan.generationId, props.streamText);
  }
  props.workspace = workspace;
  props.actions = [{ name: 'Action', icon: 'Sparkles', enabled: true, actionType: 'api', ...props.activeAction }];
  props.onNavigation = () => workspace.stop();
  props.onNewSession = () => { workspace.newTab(); props.onResetToNewChat(); };
  function render(patch = {}) {
    props = { ...props, ...patch };
    if (view === 'hook' && patch.isLoading === true && !workspace.getSnapshot().active?.generation) workspace.regenerate(5);
    if (view === 'hook' && patch.streamText !== undefined) {
      const generation = workspace.getSnapshot().active?.generation;
      if (generation) workspace.append(generation.id, patch.streamText);
    }
    let iterations = 0;
    do {
      dirty = false; cursor = 0; value = component(props);
      effects.splice(0).forEach((effect) => effect());
      assert.ok(++iterations < 20, 'Render loop');
    } while (dirty);
    return value;
  }
  render();
  return { calls, render, workspace, get value() { return value; },
    async settle() { await flush(); render(); },
    async save() { if (view === 'hook' && workspace.getSnapshot().active?.generation) workspace.finish(workspace.getSnapshot().active.generation.id); render({ isLoading: false }); const pending = [...timers.values()]; timers.clear(); pending.forEach((callback) => callback()); await flush(); render(); },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}
export function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((item) => nodes(item, predicate));
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props), predicate);
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
export function textOf(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  if (Array.isArray(tree)) return tree.map(textOf).join(' ');
  if (typeof tree.type === 'function') return textOf(tree.type(tree.props));
  return textOf(tree.props?.children);
}

