import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/provider.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { isProviderSelectable, resolveProviderModel } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const provider = (overrides = {}) => ({
  id: 'p', name: 'P', baseUrl: 'https://p.example/v1', apiKey: '',
  models: [], defaultModel: '', enabled: true, ...overrides,
});

test('the default model wins over the list, and an empty default falls back to the first usable entry', () => {
  assert.equal(resolveProviderModel(provider({ defaultModel: 'chosen', models: ['first'] })), 'chosen');
  assert.equal(resolveProviderModel(provider({ defaultModel: '   ', models: ['', 'first'] })), 'first');
  assert.equal(resolveProviderModel(provider({ models: [] })), '');
  assert.equal(resolveProviderModel(undefined), '');
});

test('disabled only narrows selectable sources; a missing flag means enabled', () => {
  assert.equal(isProviderSelectable(provider({ enabled: undefined })), true);
  assert.equal(isProviderSelectable(provider({ enabled: true })), true);
  assert.equal(isProviderSelectable(provider({ enabled: false })), false);
});
