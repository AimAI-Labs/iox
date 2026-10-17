import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/state/overlayReducer.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { overlayReducer, initialOverlayState } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('file selection opens the bubble and replaces previous text and errors', () => {
  const result = overlayReducer({ ...initialOverlayState, selectedText: 'old', error: 'old error' }, {
    type: 'FILES_SELECTED', files: ['C:\\文档\\报告.pdf', 'C:\\image.png'],
  });
  assert.equal(result.visible, true);
  assert.equal(result.mode, 'bubble');
  assert.deepEqual(result.selectedFiles, ['C:\\文档\\报告.pdf', 'C:\\image.png']);
  assert.equal(result.selectedText, '');
  assert.equal(result.error, null);
});

test('text selection and completed hiding clear previous files', () => {
  const state = overlayReducer(initialOverlayState, { type: 'FILES_SELECTED', files: ['C:\\report.pdf'] });
  const text = overlayReducer(state, { type: 'SELECTION_TRIGGERED', text: 'hello' });
  assert.deepEqual(text.selectedFiles, []);
  assert.equal(text.selectedText, 'hello');
  const hidden = overlayReducer(state, { type: 'HIDE_COMPLETE' });
  assert.deepEqual(hidden.selectedFiles, []);
  assert.equal(hidden.visible, false);
});
