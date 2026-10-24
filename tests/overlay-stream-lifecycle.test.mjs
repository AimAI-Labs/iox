import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/hooks/useOverlayLifecycle.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function setup(isPinned) {
  const events = [];
  const timers = [];
  const exports = {};
  vm.runInNewContext(js, { exports,
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
    clearTimeout: () => {},
    require: (name) => {
      if (name === 'react') return { useRef: (current) => ({ current }), useCallback: (fn) => fn };
      if (name === '@tauri-apps/api/core') return { invoke: async () => {} };
      if (name === '@/utils/bubbleWidth') return { calculateBubbleWidth: () => 100 };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const hook = exports.useOverlayLifecycle({ isPinned, currentMode: 'card',
    setIsPinned: () => {}, setIsClosing: () => events.push('closing'),
    onHideStart: () => events.push('detach'), onHideComplete: () => events.push('hidden'),
  });
  return { hook, events, timers };
}

test('an actual close revokes the stream before its exit animation starts', async () => {
  const h = setup(true);
  await h.hook.handleClose();
  assert.deepEqual(h.events, ['detach', 'closing']);
  await h.timers[0]();
  assert.deepEqual(h.events, ['detach', 'closing', 'hidden']);
});

test('a pinned card ignoring passive hide keeps its running stream', () => {
  const h = setup(true);
  h.hook.executeGracefulHide();
  assert.deepEqual(h.events, []);
  assert.equal(h.timers.length, 0);
});
