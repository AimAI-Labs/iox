import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/date-picker.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const {
  buildMonthGrid, dayAriaLabel, formatClockValue, formatDayDisplay, formatDayKey,
  monthLabel, parseClockValue, parseDayKey, shiftMonth, todayKey, weekStart, weekdayLabels,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('day keys pad fields and reject impossible dates', () => {
  assert.equal(formatDayKey(2026, 9, 3), '2026-10-03');
  assert.deepEqual(parseDayKey('2026-10-03'), { year: 2026, monthIndex: 9, day: 3 });
  assert.deepEqual(parseDayKey('2024-02-29'), { year: 2024, monthIndex: 1, day: 29 });
  for (const invalid of ['2026-02-31', '2026-13-01', '2026-10-32', '2026-1-01', '', 'today']) {
    assert.equal(parseDayKey(invalid), null, invalid);
  }
  assert.equal(todayKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('month navigation crosses year boundaries in both directions', () => {
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, monthIndex: 11 });
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, monthIndex: 0 });
  assert.deepEqual(shiftMonth(2026, 1, 13), { year: 2027, monthIndex: 2 });
});

test('the grid always spans six weeks and honours the locale week start', () => {
  const mondayFirst = buildMonthGrid(2026, 9, '2026-10-30', 1);
  assert.equal(mondayFirst.length, 42);
  assert.equal(mondayFirst[0].date, '2026-09-28');
  assert.equal(mondayFirst[0].outside, true);
  assert.equal(mondayFirst[41].date, '2026-11-08');
  assert.deepEqual(mondayFirst[32], { date: '2026-10-30', day: 30, outside: false, today: true });
  assert.equal(mondayFirst.filter(day => !day.outside).length, 31);

  const sundayFirst = buildMonthGrid(2026, 9, '2026-10-30', 0);
  assert.equal(sundayFirst[0].date, '2026-09-27');
  assert.equal(sundayFirst[6].date, '2026-10-03');
});

test('localized labels follow the requested locale', () => {
  assert.equal(weekdayLabels('zh-CN', 1)[0], '一');
  assert.equal(weekdayLabels('en-US', 1)[0], 'M');
  assert.equal(weekdayLabels('zh-CN', 0).length, 7);
  assert.match(monthLabel(2026, 9, 'zh-CN'), /2026年10月/);
  assert.match(monthLabel(2026, 9, 'en-US'), /October 2026/);
  assert.match(formatDayDisplay('2026-10-30', 'zh-CN'), /2026\/10\/30/);
  assert.match(formatDayDisplay('2026-10-30', 'en-US'), /10\/30\/2026/);
  assert.equal(dayAriaLabel('2026-10-30', 'zh-CN').includes('2026'), true);
  assert.equal(formatDayDisplay('', 'zh-CN'), '');
});

test('week start falls back to Monday when the runtime lacks weekInfo', () => {
  assert.ok([0, 1].includes(weekStart('zh-CN')));
  assert.equal(weekStart('en-US'), 0);
});

test('clock values round-trip and reject malformed input', () => {
  assert.deepEqual(parseClockValue('09:05'), { hour: 9, minute: 5 });
  assert.deepEqual(parseClockValue('23:59'), { hour: 23, minute: 59 });
  for (const invalid of ['9:05', '24:00', '09:60', '', '09:05:00']) {
    assert.equal(parseClockValue(invalid), null, invalid);
  }
  assert.equal(formatClockValue(7, 4), '07:04');
});
