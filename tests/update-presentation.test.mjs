import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const load = async (path) => {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};

const { presentUpdateStatus } = await load('../src/lib/updatePresentation.ts');
const { zh } = await load('../src/locales/zh.ts');
const { en } = await load('../src/locales/en.ts');

const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const secs = (ms) => Math.floor(ms / SECOND);
const status = (overrides = {}) => ({
  state: 'current',
  currentVersion: '0.1.0',
  latestVersion: null,
  releaseUrl: null,
  publishedAt: null,
  checkedAt: secs(NOW),
  ...overrides,
});
const present = (value, checking = false) => presentUpdateStatus(value, checking, NOW, 'zh');

test('an unchecked app shows a neutral badge without a release link', () => {
  assert.deepEqual(present(null), {
    tone: 'idle',
    badgeKey: 'settings.update.notChecked',
    detailKey: 'settings.update.detailNotChecked',
    showReleaseLink: false,
  });
});

test('Rust checked_at is in seconds and renders as a relative check time', () => {
  assert.deepEqual(
    { key: present(status({ checkedAt: secs(NOW - 5 * MINUTE) })).detailKey,
      params: present(status({ checkedAt: secs(NOW - 5 * MINUTE) })).detailParams },
    { key: 'settings.update.checkedMinutesAgo', params: { count: 5 } },
  );
  assert.deepEqual(present(status({ checkedAt: secs(NOW - 30 * SECOND) })).detailKey, 'settings.update.checkedJustNow');
  assert.deepEqual(present(status({ checkedAt: secs(NOW - 2 * HOUR) })).detailParams, { count: 2 });
  assert.equal(present(status({ checkedAt: secs(NOW - 2 * HOUR) })).detailKey, 'settings.update.checkedHoursAgo');
  assert.deepEqual(present(status({ checkedAt: secs(NOW - 3 * DAY) })).detailParams, { count: 3 });
  assert.equal(present(status({ checkedAt: secs(NOW - 3 * DAY) })).detailKey, 'settings.update.checkedDaysAgo');
});

test('old, future and invalid check times fall back without inventing a time', () => {
  const old = present(status({ checkedAt: secs(NOW - 10 * DAY) }));
  assert.equal(old.detailKey, 'settings.update.checkedOn');
  assert.equal(typeof old.detailParams.date, 'string');
  assert.ok(old.detailParams.date.length > 0);
  assert.equal(present(status({ checkedAt: secs(NOW + DAY) })).detailKey, 'settings.update.checkedJustNow');
  assert.equal(present(status({ checkedAt: 0 })).detailKey, 'settings.update.latest');
  assert.equal(present(status({ checkedAt: Number.NaN })).detailKey, 'settings.update.latest');
});

test('an available update keeps its version, badge and release link', () => {
  const result = present(status({ state: 'available', latestVersion: '0.2.0' }));
  assert.equal(result.tone, 'available');
  assert.equal(result.badgeKey, 'settings.update.availableShort');
  assert.equal(result.detailKey, 'settings.update.detailAvailable');
  assert.deepEqual(result.detailParams, { version: '0.2.0' });
  assert.equal(result.showReleaseLink, true);
  assert.equal(
    present(status({ state: 'available', latestVersion: null })).detailKey,
    'settings.update.detailAvailableNoVersion',
  );
});

test('uncomparable tags and failed checks are warnings with a release page', () => {
  for (const [state, detailKey] of [
    ['unknown', 'settings.update.unknown'],
    ['unavailable', 'settings.update.failed'],
  ]) {
    const result = present(status({ state }));
    assert.equal(result.tone, 'warning');
    assert.equal(result.detailKey, detailKey);
    assert.equal(result.showReleaseLink, true);
  }
});

test('a manual re-check shows progress but keeps the previous release link', () => {
  const available = status({ state: 'available', latestVersion: '0.2.0' });
  assert.deepEqual(present(available, true), {
    tone: 'checking',
    badgeKey: 'settings.update.checking',
    detailKey: 'settings.update.detailChecking',
    showReleaseLink: true,
  });
  assert.equal(present(null, true).showReleaseLink, false);
});

test('both dictionaries provide the same parameterized update copy', () => {
  for (const [key, param] of [
    ['detailAvailable', '{version}'],
    ['checkedMinutesAgo', '{count}'],
    ['checkedHoursAgo', '{count}'],
    ['checkedDaysAgo', '{count}'],
    ['checkedOn', '{date}'],
  ]) {
    assert.ok(zh.settings.update[key]?.includes(param), `zh.${key} is missing ${param}`);
    assert.ok(en.settings.update[key]?.includes(param), `en.${key} is missing ${param}`);
  }
  for (const key of Object.keys(zh.settings.update)) {
    assert.ok(en.settings.update[key], `en.settings.update.${key} is missing`);
  }
});
