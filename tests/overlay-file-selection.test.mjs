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

test('native file drops reach the overlay through Webview events with Tauri unstable enabled', () => {
  // With unstable, Tauri creates WindowChild webviews and emits WebviewEvent::DragDrop
  // instead of WindowEvent::DragDrop. Frontend-only drop tests cannot catch this gap.
  const cargo = readFileSync(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
  assert.match(cargo, /tauri\s*=\s*\{[^\n]*"unstable"/);
  assert.ok(
    /\.on_webview_event\(\|webview, event\|\s*\{\s*if webview\.label\(\) == "overlay"\s*\{\s*if let tauri::WebviewEvent::DragDrop\(event\) = event\s*\{\s*file_selection::handle_drag_drop\(&webview\.window\(\), event\);/.test(app),
    'Route native overlay WebviewEvent::DragDrop events to the file drop handler',
  );
});

test('file selection opens the bubble and replaces previous text and errors', () => {
  const result = overlayReducer({ ...initialOverlayState, selectedText: 'old', error: 'old error' }, {
    type: 'FILES_SELECTED', dragId: 42, files: ['C:\\文档\\报告.pdf', 'C:\\image.png'],
  });
  assert.equal(result.fileDragId, 42);
  assert.equal(result.visible, true);
  assert.equal(result.mode, 'bubble');
  assert.deepEqual(result.selectedFiles, ['C:\\文档\\报告.pdf', 'C:\\image.png']);
  assert.equal(result.selectedText, '');
  assert.equal(result.error, null);
});

test('text selection and completed hiding clear previous files', () => {
  const state = overlayReducer(initialOverlayState, { type: 'FILES_SELECTED', dragId: 42, files: ['C:\\report.pdf'] });
  const text = overlayReducer(state, { type: 'SELECTION_TRIGGERED', text: 'hello' });
  assert.deepEqual(text.selectedFiles, []);
  assert.equal(text.fileDragId, null);
  assert.equal(text.selectedText, 'hello');
  const hidden = overlayReducer(state, { type: 'HIDE_COMPLETE' });
  assert.deepEqual(hidden.selectedFiles, []);
  assert.equal(hidden.fileDragId, null);
  assert.equal(hidden.visible, false);
});
