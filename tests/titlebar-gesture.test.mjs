import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/titleBarGesture.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { resolveTitleBarPress } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('a single click on the titlebar starts dragging', () => {
  assert.equal(resolveTitleBarPress(0, 1, false), 'drag');
});

test('the second click toggles maximize exactly once instead of dragging again', () => {
  assert.equal(resolveTitleBarPress(0, 2, false), 'toggle-maximize');
  assert.equal(resolveTitleBarPress(0, 3, false), 'toggle-maximize');
});

test('interactive controls never drag or maximize the window', () => {
  assert.equal(resolveTitleBarPress(0, 1, true), 'ignore');
  assert.equal(resolveTitleBarPress(0, 2, true), 'ignore');
});

test('only the primary button drives the window', () => {
  assert.equal(resolveTitleBarPress(1, 1, false), 'ignore');
  assert.equal(resolveTitleBarPress(2, 2, false), 'ignore');
});
