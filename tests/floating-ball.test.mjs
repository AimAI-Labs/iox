import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('floating window bypasses the native redirection bitmap before WebView paints', () => {
  const config = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  const window = config.app.windows.find((window) => window.label === 'floating_ball');
  assert.equal(window.transparent, true);
  assert.equal(window.noRedirectionBitmap, true);
  assert.equal(window.focus, false);
});

// Run the component's hooks and event handlers without a native Tauri window.
function mountBall(t, overrides = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const hooks = [];
  const effects = [];
  const calls = [];
  const requests = [];
  const listeners = new Map();
  let cursor = 0;
  let tree;
  let initializedNative = false;
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
    exports, console, setTimeout, clearTimeout, crypto: globalThis.crypto,
    requestAnimationFrame: (callback) => setTimeout(() => callback(0), 16),
    cancelAnimationFrame: clearTimeout,
    window: {
      matchMedia: () => ({ matches: Boolean(overrides.reducedMotion) }),
      addEventListener: (event, handler) => listeners.set(`dom:${event}`, handler),
      removeEventListener: (event) => listeners.delete(`dom:${event}`),
    },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-dom') return { flushSync: (callback) => {
        callback();
        cursor = 0;
        tree = exports.FloatingBall({ config });
      } };
      if (name === '@tauri-apps/api/event') return { listen: async (event, handler) => {
        listeners.set(event, handler);
        return () => listeners.delete(event);
      } };
      if (name === '@tauri-apps/api/core') return { invoke: async (command, args) => {
        calls.push(command);
        const initializing = command === 'set_floating_ball_expanded' && !initializedNative && !args.expanded;
        requests.push({ command, args, initializing });
        if (initializing) {
          initializedNative = true;
          return [0, 0, 'top-right'];
        }
        if (overrides[command]) return overrides[command](args);
        if (command === 'set_floating_ball_expanded') return [0, 0, 'top-right'];
        return command === 'get_current_selection' ? 'selected text' : [0, 0, 'top-right', 'right'];
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
  const unmount = () => hooks.forEach((hook) => hook?.cleanup?.());
  t.after(unmount);
  const find = (type, node = tree) => {
    if (!node || typeof node !== 'object') return undefined;
    if (node.type === type || node.props?.['data-testid'] === type) return node;
    return node.props?.children.flat(Infinity).map((child) => find(type, child)).find(Boolean);
  };
  const advance = async (ms) => {
    t.mock.timers.tick(ms);
    await new Promise(setImmediate);
    await render();
  };
  return { render, calls, requests, config, find, advance, unmount,
    emit: (event) => listeners.get(event)?.(), get tree() { return tree; } };
}

test('hover opens after 220ms and keeps the ball as a visible corner', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(219);
  assert.equal(ball.find('menu'), undefined);
  await ball.advance(1);
  assert.ok(ball.find('menu'));
  assert.ok(ball.find('floating-ball-trigger'));
  assert.equal(ball.find('menu').props.corner, 'top-right');
  assert.equal(ball.calls.filter((call) => call === 'init_floating_ball').length, 1);
  void ball.find('menu').props.onClose();
  await ball.advance(200);
  assert.equal(ball.find('menu'), undefined);
  assert.equal(ball.calls.filter((call) => call === 'init_floating_ball').length, 1);
});

for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
  test(`anchor is committed before native expansion: ${corner}`, async (t) => {
    let anchorAtResize;
    const ball = mountBall(t, { init_floating_ball: () => [0, 0, corner], set_floating_ball_expanded: (args) => {
      if (args.expanded) anchorAtResize = ball.tree.props['data-corner'];
      return [0, 0, corner];
    } });
    await ball.render();
    ball.tree.props.onMouseEnter();
    await ball.advance(220);
    assert.equal(anchorAtResize, corner);
  });
}

test('card is removed before restricting the native input region, while the corner stays anchored', async (t) => {
  let menuAtShrink;
  let cornerAtShrink;
  const ball = mountBall(t, { set_floating_ball_expanded: (args) => {
    if (!args.expanded) {
      menuAtShrink = ball.find('menu');
      cornerAtShrink = ball.tree.props['data-corner'];
    }
    return [0, 0, 'bottom-left'];
  } });
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  ball.find('menu').props.onClose();
  await ball.advance(200);
  assert.equal(menuAtShrink, undefined);
  assert.equal(cornerAtShrink, 'bottom-left');
});

test('passing over the ball cancels the pending hover without copying', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(100);
  ball.tree.props.onMouseLeave();
  await ball.advance(300);
  assert.equal(ball.find('menu'), undefined);
  assert.equal(ball.calls.includes('get_current_selection'), false);
});

test('a freely placed ball stays visible while idle and still opens its menu', async (t) => {
  const ball = mountBall(t, { init_floating_ball: () => [500, 300, 'top-right', 'none'] });
  await ball.render();
  await ball.advance(10000);
  assert.doesNotMatch(ball.find('floating-ball-trigger').props.className, /is-idle|is-docked/);
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  assert.ok(ball.find('menu'));
});

test('dragging away from an edge disables hiding and docking again restores it', async (t) => {
  let placement = [500, 300, 'top-right', 'none'];
  const ball = mountBall(t, { start_floating_ball_dragging: () => placement });
  await ball.render();
  const drag = async () => {
    const button = ball.find('floating-ball-trigger');
    button.props.onMouseDown({ button: 0, screenX: 100, screenY: 100 });
    await button.props.onMouseMove({ screenX: 120, screenY: 100 });
    await ball.render();
  };
  await drag();
  await ball.advance(10000);
  assert.doesNotMatch(ball.find('floating-ball-trigger').props.className, /is-idle|is-docked/);
  placement = [0, 300, 'top-left', 'left'];
  await drag();
  await ball.advance(2500);
  assert.match(ball.find('floating-ball-trigger').props.className, /is-docked-left/);
  assert.match(ball.find('floating-ball-trigger').props.className, /is-idle/);
});

test('custom hover delay controls menu expansion and updates while waiting', async (t) => {
  const ball = mountBall(t);
  ball.config.general.floatingBallHoverDelayMs = 800;
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(799);
  assert.equal(ball.find('menu'), undefined);
  ball.config.general.floatingBallHoverDelayMs = 400;
  await ball.render();
  await ball.advance(399);
  assert.equal(ball.find('menu'), undefined);
  await ball.advance(1);
  assert.ok(ball.find('menu'));
  assert.equal(ball.calls.filter((call) => call === 'init_floating_ball').length, 1);
});

test('custom idle delay controls edge hiding and cancels on pointer entry', async (t) => {
  const ball = mountBall(t);
  ball.config.general.floatingBallHideDelayMs = 1200;
  await ball.render();
  await ball.advance(1199);
  assert.doesNotMatch(ball.find('floating-ball-trigger').props.className, /is-idle/);
  await ball.advance(1);
  assert.match(ball.find('floating-ball-trigger').props.className, /is-idle/);
  ball.tree.props.onMouseEnter();
  await ball.render();
  assert.doesNotMatch(ball.find('floating-ball-trigger').props.className, /is-idle/);
  ball.tree.props.onMouseLeave();
  ball.config.general.floatingBallHideDelayMs = 700;
  await ball.render();
  await ball.advance(699);
  assert.doesNotMatch(ball.find('floating-ball-trigger').props.className, /is-idle/);
  await ball.advance(1);
  assert.match(ball.find('floating-ball-trigger').props.className, /is-idle/);
});

test('leaving closes after a grace period and reentering cancels dismissal', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  ball.tree.props.onMouseLeave();
  await ball.advance(200);
  ball.tree.props.onMouseEnter();
  await ball.advance(500);
  assert.ok(ball.find('menu'));
  ball.tree.props.onMouseLeave();
  await ball.advance(299);
  assert.ok(ball.find('menu'));
  await ball.advance(1);
  assert.match(ball.tree.props.className, /is-closing/);
  await ball.advance(200);
  assert.equal(ball.find('menu'), undefined);
});

test('late selection cannot reopen a closed menu', async (t) => {
  let resolveSelection;
  const ball = mountBall(t, { get_current_selection: () => new Promise((resolve) => { resolveSelection = resolve; }) });
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  assert.ok(ball.find('menu'), 'expansion must not wait for clipboard');
  void ball.find('menu').props.onClose();
  await ball.advance(200);
  resolveSelection('late text');
  await ball.advance(1);
  assert.equal(ball.find('menu'), undefined);
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
  const button = ball.find('floating-ball-trigger');
  ball.tree.props.onMouseEnter();
  for (let i = 0; i < 2; i++) {
    button.props.onMouseDown({ button: 0, screenX: 100, screenY: 100 });
    await button.props.onMouseUp({ button: 0 });
  }
  await button.props.onDoubleClick();
  await ball.advance(500);
  assert.equal(ball.calls.includes('show_main_window'), true);
  assert.equal(ball.calls.includes('get_current_selection'), false);
  assert.equal(ball.find('menu'), undefined);
});

test('dragging cancels hover and does not capture text', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  ball.tree.props.onMouseEnter();
  const button = ball.find('floating-ball-trigger');
  button.props.onMouseDown({ button: 0, screenX: 100, screenY: 100 });
  await button.props.onMouseMove({ screenX: 120, screenY: 100 });
  await ball.advance(500);
  assert.ok(ball.calls.includes('start_floating_ball_dragging'));
  assert.equal(ball.calls.includes('get_current_selection'), false);
  assert.equal(ball.find('menu'), undefined);
});

test('typing keeps the menu open when the pointer leaves', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  ball.find('menu').props.onInputFocusChange(true);
  ball.tree.props.onMouseLeave();
  await ball.advance(1000);
  assert.ok(ball.find('menu'));
  ball.find('menu').props.onInputFocusChange(false);
  await ball.advance(300);
  await ball.advance(200);
  assert.equal(ball.find('menu'), undefined);
});

test('global Escape closes a menu that has not taken keyboard focus', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  assert.equal(ball.calls.includes('focus_floating_ball_input'), false);
  ball.emit('floating-ball-dismiss');
  await ball.advance(1);
  assert.equal(ball.find('menu'), undefined);
});

test('leaving during a slow native region expansion queues collapse', async (t) => {
  let finishExpand;
  const ball = mountBall(t, { set_floating_ball_expanded: (args) => args.expanded
    ? new Promise((resolve) => { finishExpand = resolve; }) : [0, 0, 'top-right'] });
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  ball.tree.props.onMouseLeave();
  await ball.advance(300);
  finishExpand([0, 0, 'bottom-left']);
  await ball.advance(1);
  assert.equal(ball.find('menu'), undefined);
  const lastResize = ball.requests.filter((request) => request.command === 'set_floating_ball_expanded').at(-1);
  assert.equal(lastResize.args.expanded, false);
  assert.deepEqual(Object.keys(lastResize.args), ['expanded']);
});

test('brief leave and reentry also preserve a pending native expansion', async (t) => {
  let finishExpand;
  const ball = mountBall(t, { set_floating_ball_expanded: (args) => new Promise((resolve) => { finishExpand = resolve; }) });
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  ball.tree.props.onMouseLeave();
  await ball.advance(100);
  ball.tree.props.onMouseEnter();
  finishExpand([0, 0, 'bottom-right']);
  await ball.advance(500);
  assert.ok(ball.find('menu'));
  assert.equal(ball.requests.filter((request) => request.command === 'set_floating_ball_expanded' && !request.initializing).length, 1);
});

test('releasing the mouse outside the trigger does not disable later hover', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  ball.tree.props.onMouseEnter();
  ball.find('floating-ball-trigger').props.onMouseDown({ button: 0, screenX: 100, screenY: 100 });
  ball.tree.props.onMouseLeave();
  ball.emit('dom:mouseup');
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  assert.ok(ball.find('menu'));
});

test('closing keeps the surface and native input region until the return animation completes', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  void ball.find('menu').props.onClose();
  await ball.advance(100);
  assert.ok(ball.find('menu'));
  assert.match(ball.tree.props.className, /is-closing/);
  assert.equal(ball.requests.some((request) => request.command === 'set_floating_ball_expanded' && !request.initializing && !request.args.expanded), false);
  await ball.advance(100);
  assert.equal(ball.find('menu'), undefined);
  assert.equal(ball.requests.at(-1).args.expanded, false);
});

test('reentering during hover dismissal reverses without resizing or remounting', async (t) => {
  const ball = mountBall(t);
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  ball.tree.props.onMouseLeave();
  await ball.advance(300);
  assert.match(ball.tree.props.className, /is-closing/);
  await ball.advance(80);
  ball.tree.props.onMouseEnter();
  await ball.advance(400);
  assert.ok(ball.find('menu'));
  assert.doesNotMatch(ball.tree.props.className, /is-closing/);
  assert.equal(ball.requests.filter((request) => request.command === 'set_floating_ball_expanded' && !request.initializing).length, 1);
});

test('reduced motion skips the visual close delay', async (t) => {
  const ball = mountBall(t, { reducedMotion: true });
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  void ball.find('menu').props.onClose();
  await ball.advance(1);
  assert.equal(ball.find('menu'), undefined);
});

test('Escape during a slow native collapse cancels reentry instead of reopening', async (t) => {
  let finishCollapse;
  const ball = mountBall(t, { set_floating_ball_expanded: (args) => args.expanded
    ? [0, 0, 'top-right'] : new Promise((resolve) => { finishCollapse = resolve; }) });
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  ball.tree.props.onMouseLeave();
  await ball.advance(300);
  await ball.advance(200);
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  ball.emit('floating-ball-dismiss');
  finishCollapse([0, 0, 'top-right']);
  await ball.advance(500);
  assert.equal(ball.find('menu'), undefined);
});

test('reentry waits for a committing native collapse before starting another expansion', async (t) => {
  let finishCollapse;
  const ball = mountBall(t, { set_floating_ball_expanded: (args) => args.expanded
    ? [0, 0, 'top-right'] : new Promise((resolve) => { finishCollapse = resolve; }) });
  await ball.render();
  ball.tree.props.onMouseEnter();
  await ball.advance(220);
  ball.tree.props.onMouseLeave();
  await ball.advance(300);
  await ball.advance(200);
  ball.tree.props.onMouseEnter();
  await ball.advance(300);
  assert.equal(ball.requests.filter((request) => request.command === 'set_floating_ball_expanded' && !request.initializing).length, 2);
  finishCollapse([0, 0, 'top-right']);
  await ball.advance(1);
  assert.equal(ball.find('menu'), undefined);
  await ball.advance(220);
  assert.ok(ball.find('menu'));
});

test('each direct API action has a unique execution identity', async (t) => {
  const ball = mountBall(t, { reducedMotion: true });
  await ball.render();
  for (let count = 0; count < 2; count++) {
    ball.tree.props.onMouseEnter();
    await ball.advance(220);
    await ball.find('menu').props.onTriggerAction({ id: 'api-action', actionType: 'api' });
    await ball.render();
  }
  const requests = ball.requests.filter((request) => request.command === 'trigger_api_action');
  assert.equal(requests.length, 2);
  assert.equal(typeof requests[0].args.requestId, 'string');
  assert.ok(requests[0].args.requestId.length > 0);
  assert.notEqual(requests[0].args.requestId, requests[1].args.requestId);
});
