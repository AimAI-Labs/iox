import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/web-history.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { filterHistory, timeWindow, localDayKey } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const at = (day, hour = 0, minute = 0, second = 0) => new Date(2026, 9, day, hour, minute, second).getTime() / 1000;
const session = (id, start, end, patch = {}) => ({
  id, actionId: 'web-1', platform: 'Platform', title: id, url: `https://example.com/${id}`,
  dateStart: start, dateEnd: end, precision: 'exact', dateLabel: '', sourceOrder: 0, ...patch,
});
const opts = (patch = {}) => ({
  query: '', platform: '', time: 'custom', from: '', to: '', fromTime: '', toTime: '', ...patch,
});

const sessions = [
  session('early', at(20, 8, 0), at(20, 8, 5)),
  session('morning', at(20, 9, 30), at(20, 9, 35)),
  session('late', at(20, 18, 0), at(20, 18, 30, 59)),
  session('next', at(21, 18, 31), at(21, 18, 40)),
];

test('custom range narrows the window to the exact minute of the given times', () => {
  const result = filterHistory(sessions, opts({ from: '2026-10-20', to: '2026-10-20', fromTime: '09:00', toTime: '10:00' }));
  assert.deepEqual(result.map(s => s.id), ['morning']);
});

test('a custom end time covers its whole minute and an empty time keeps the whole day', () => {
  const minute = filterHistory(sessions, opts({ from: '2026-10-20', to: '2026-10-20', fromTime: '18:31', toTime: '18:31' }));
  assert.deepEqual(minute.map(s => s.id), []);
  assert.deepEqual(
    filterHistory(sessions, opts({ from: '2026-10-20', to: '2026-10-20', toTime: '18:30' })).map(s => s.id),
    ['late', 'morning', 'early'],
  );
  assert.deepEqual(
    filterHistory(sessions, opts({ from: '2026-10-20', to: '2026-10-20' })).map(s => s.id),
    ['late', 'morning', 'early'],
  );
  assert.deepEqual(
    filterHistory(sessions, opts({ from: '2026-10-20', fromTime: '18:30' })).map(s => s.id),
    ['next', 'late'],
  );
});

test('reversed or malformed ranges yield no results and report an invalid window', () => {
  const reversedDay = opts({ from: '2026-10-21', to: '2026-10-20' });
  const reversedClock = opts({ from: '2026-10-20', to: '2026-10-20', fromTime: '18:00', toTime: '09:00' });
  const malformed = opts({ from: '2026-10-20', fromTime: '9:00' });
  for (const options of [reversedDay, reversedClock, malformed]) {
    assert.equal(timeWindow(options).valid, false);
    assert.deepEqual(filterHistory(sessions, options), []);
  }
  assert.equal(timeWindow(opts({ from: '2026-10-20', to: '2026-10-20', fromTime: '09:00', toTime: '09:00' })).valid, true);
});

test('range-precision sessions match by overlap and undated ones stay out of custom ranges', () => {
  const spanning = session('span', at(19, 22, 0), at(20, 10, 0), { precision: 'range' });
  const undated = session('undated', null, null, { precision: 'unknown' });
  const result = filterHistory([spanning, undated], opts({ from: '2026-10-20', to: '2026-10-20', fromTime: '09:00', toTime: '09:30' }));
  assert.deepEqual(result.map(s => s.id), ['span']);
});

test('presets keep their calendar-day boundaries and All time ignores the custom inputs', () => {
  const now = new Date(2026, 9, 20, 15, 0);
  assert.equal(localDayKey(at(20, 15, 0)), '2026-10-20');
  const today = filterHistory(sessions, { ...opts({ time: 'today', now }), from: '2026-10-01', to: '2026-10-02' });
  assert.deepEqual(today.map(s => s.id), ['late', 'morning', 'early']);
  assert.deepEqual(
    filterHistory(sessions, { ...opts({ time: 'all', now, from: '2026-10-21', to: '2026-10-21', fromTime: '18:30' }) }).map(s => s.id),
    ['next', 'late', 'morning', 'early'],
  );
  const window = timeWindow({ time: '7d', from: '', to: '', now });
  assert.equal(window.lower, at(14));
  assert.equal(window.upper, at(21) - 1);
});
