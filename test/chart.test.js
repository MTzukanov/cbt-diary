import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, periodFor, entriesIn, emotionFrequency, emotionDaily } from '../js/chart.js';

const entry = (datetime, emotions) => ({ datetime, emotions });

const entries = [
  entry('2026-09-01T09:00', [{ key: 'joy', intensity: 8 }, { name: 'Boredom', intensity: 3 }]),
  entry('2026-09-01T20:00', [{ key: 'joy', intensity: 5 }, { key: 'anxiety', intensity: 7 }]),
  entry('2026-09-03T10:00', [{ key: 'anxiety', intensity: 9 }, { name: 'boredom ', intensity: 5 }]),
  entry('2026-09-10T10:00', [{ key: 'joy', intensity: 2 }]),
];

test('day arithmetic crosses month ends and DST', () => {
  assert.equal(addDays('2026-02-27', 2), '2026-03-01');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(daysBetween('2026-03-25', '2026-04-05'), 11);
  assert.equal(daysBetween('2026-10-20', '2026-10-30'), 10);
});

test('periodFor counts back from today, "all" starts at the first entry', () => {
  assert.deepEqual(periodFor('7', entries, '2026-09-10'), { start: '2026-09-04', end: '2026-09-10' });
  assert.deepEqual(periodFor('all', entries, '2026-09-26'), { start: '2026-09-01', end: '2026-09-26' });
  assert.deepEqual(periodFor('all', [], '2026-09-26'), { start: '2026-09-26', end: '2026-09-26' });
  // An entry dated in the future extends the period so it stays visible.
  assert.equal(periodFor('30', entries, '2026-09-05').end, '2026-09-10');
});

test('entriesIn filters by day, inclusive', () => {
  assert.equal(entriesIn(entries, { start: '2026-09-01', end: '2026-09-03' }).length, 3);
});

test('emotionFrequency counts entries and averages, merging own emotions case-insensitively', () => {
  const rows = emotionFrequency(entries);
  assert.deepEqual(rows.map((r) => [r.id, r.count, r.avg]), [
    ['k:joy', 3, 5],
    ['k:anxiety', 2, 8],
    ['n:boredom', 2, 4],
  ]);
});

test('emotionDaily keeps the highest rating per day', () => {
  assert.deepEqual(emotionDaily(entries, 'k:joy'), [
    { day: '2026-09-01', value: 8 },
    { day: '2026-09-10', value: 2 },
  ]);
});

test('dailyStats gives peak and average per day across emotions', async () => {
  const { dailyStats } = await import('../js/chart.js');
  assert.deepEqual(dailyStats(entries), [
    { day: '2026-09-01', max: 8, avg: 5.8 },
    { day: '2026-09-03', max: 9, avg: 7 },
    { day: '2026-09-10', max: 2, avg: 2 },
  ]);
});
