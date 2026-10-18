import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Run the component's hooks and event handlers without a native Tauri window.
function mountBall(t) {
  const hooks = [];
  const effects = [];
  const calls = [];
  let cursor = 0;
  let tree;
  const changed = (a, b) => !a || a.some((value, i) => !Object.is(value, b[i]));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      hooks[index] ??= { value: initial };
      return [hooks[index].value, (value) => {
        hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return hooks[index] ??= { current: initial };
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (changed(hooks[index]?.deps, deps)) hooks[index] = { value: callback, deps };
      return hooks[index].value;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (changed(hooks[index]?.deps, deps)) {
        effects.push(() => {
          hooks[index]?.cleanup?.();
          hooks[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const source = readFileSync(new URL('../src/components/overlay/FloatingBall.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, console, setTimeout, clearTimeout,
    require(name) {
      if (name === 'react') return react;
      if (name === '@tauri-apps/api/core') return { invoke: async (command) => {
        calls.push(command);
        return command === 'get_current_selection' ? 'selected text' : [0, 0, 'right'];
      } };
      if (name.includes('useTranslation')) return { useTranslation: () => ({ t: (key) => key }) };
      if (name.includes('utils')) return { cn: (...values) => values.filter(Boolean).join(' ') };
      return { IOXLogo: 'logo', FloatingMenu: 'menu' };
    },
  });
  const config = { general: { enableFloatingBall: true, floatingBallAutoHide: true } };
  const render = async () => {
    cursor = 0;
    tree = exports.FloatingBall({ config });
    effects.splice(0).forEach((effect) => effect());
    await new Promise(setImmediate);
    return tree;
  };
  t.after(() => hooks.forEach((hook) => hook?.cleanup?.()));
  return { render, calls, config, get tree() { return tree; } };
}

test('opening and closing the menu does not reinitialize the ball window', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  const button = ball.tree.props.children[0];
  button.props.onMouseDown({ button: 0, screenX: 100, screenY: 100 });
  await button.props.onMouseUp({ button: 0 });
  await new Promise((resolve) => setTimeout(resolve, 250));
  await ball.render();
  assert.equal(ball.tree.props.children[0].type, 'menu');
  assert.equal(ball.calls.filter((call) => call === 'init_floating_ball').length, 1);
  ball.tree.props.children[0].props.onClose();
  await ball.render();
  assert.equal(ball.calls.filter((call) => call === 'init_floating_ball').length, 1);
});

test('changing auto-hide preference does not reset native window geometry', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  const initialCalls = [...ball.calls];
  ball.config.general.floatingBallAutoHide = false;
  await ball.render();
  assert.deepEqual(ball.calls, initialCalls);
});

test('double click opens settings without capturing text or opening the menu', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  const button = ball.tree.props.children[0];
  for (let i = 0; i < 2; i++) {
    button.props.onMouseDown({ button: 0, screenX: 100, screenY: 100 });
    await button.props.onMouseUp({ button: 0 });
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  await ball.render();
  assert.equal(ball.calls.includes('show_main_window'), true);
  assert.equal(ball.calls.includes('get_current_selection'), false);
  assert.notEqual(ball.tree.props.children[0].type, 'menu');
});
