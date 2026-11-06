import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/titleBarGesture.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { resolveTitleBarPress, isDragThresholdExceeded, isTitleBarToggleGesture } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('a left press on the titlebar arms dragging instead of starting it immediately', () => {
  assert.equal(resolveTitleBarPress(0, false), 'arm-drag');
});

test('interactive controls never drag or maximize the window', () => {
  assert.equal(resolveTitleBarPress(0, true), 'ignore');
  assert.equal(isTitleBarToggleGesture(0, true), false);
});

test('only the primary button drives the window', () => {
  assert.equal(resolveTitleBarPress(1, false), 'ignore');
  assert.equal(resolveTitleBarPress(2, false), 'ignore');
  assert.equal(isTitleBarToggleGesture(1, false), false);
});

test('dragging starts only after the pointer leaves the click tolerance', () => {
  assert.equal(isDragThresholdExceeded(0, 0), false);
  assert.equal(isDragThresholdExceeded(2, 0), false);
  assert.equal(isDragThresholdExceeded(2, 2), false);
  assert.equal(isDragThresholdExceeded(3, 0), true);
  assert.equal(isDragThresholdExceeded(2, 3), true);
});

test('a plain double click on empty titlebar space toggles maximize', () => {
  assert.equal(isTitleBarToggleGesture(0, false), true);
});
