import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/file-drop.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { findFileDropTarget } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const targets = [
  { id: 'first', left: 10, top: 50, right: 80, bottom: 90, disabled: false },
  { id: 'second', left: 90, top: 50, right: 160, bottom: 90, disabled: false },
  { id: 'disabled', left: 170, top: 50, right: 240, bottom: 90, disabled: true },
];
test('uses physical coordinates at 100%, 150% and 200% scale', () => {
  for (const scale of [1, 1.5, 2]) {
    assert.equal(findFileDropTarget({ x: 30 * scale, y: 60 * scale }, scale, targets), 'first');
    assert.equal(findFileDropTarget({ x: 110 * scale, y: 60 * scale }, scale, targets), 'second');
  }
});
test('blank areas, button gaps, disabled targets and invalid scale cannot receive files', () => {
  for (const point of [{ x: 20, y: 20 }, { x: 85, y: 60 }, { x: 200, y: 60 }, { x: 80, y: 60 }]) {
    assert.equal(findFileDropTarget(point, 1, targets), null);
  }
  assert.equal(findFileDropTarget({ x: 20, y: 60 }, 0, targets), null);
});
