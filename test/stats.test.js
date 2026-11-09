import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyBalance, trendLine, byCategory, niceStep } from '../src/stats.js';

const tx = (kind, amount_cents, date, category) => ({ kind, amount_cents, date, category });

test('dailyBalance fills gaps, ignores transfers and runs to today', () => {
  const s = dailyBalance([
    tx('adjustment', 10000, '2026-02-27'),
    tx('expense', 3000, '2026-03-01'),
    tx('transfer', 5000, '2026-03-01'),
    tx('income', 2000, '2026-03-01'),
  ], '2026-03-02');
  assert.deepEqual(s.map((p) => [p.date, p.cents]), [
    ['2026-02-27', 10000], ['2026-02-28', 10000], ['2026-03-01', 9000], ['2026-03-02', 9000],
  ]);
  assert.deepEqual(dailyBalance([], '2026-03-02'), []);
});

test('trendLine fits a straight line exactly and handles one point', () => {
  assert.deepEqual(trendLine([10, 20, 30, 40]), { start: 10, slope: 10 });
  assert.deepEqual(trendLine([5]), { start: 5, slope: 0 });
  assert.ok(trendLine([40, 30, 20]).slope < 0);
});

test('byCategory sums and ranks, biggest first', () => {
  const r = byCategory([
    tx('expense', 500, '2026-03-01', 'Cibo'), tx('expense', 900, '2026-03-02', 'Casa'),
    tx('expense', 700, '2026-03-03', 'Cibo'), tx('income', 99999, '2026-03-03', 'Lavoro'),
  ], 'expense');
  assert.deepEqual(r, [{ name: 'Cibo', cents: 1200, count: 2 }, { name: 'Casa', cents: 900, count: 1 }]);
});

test('niceStep rounds up to 1, 2, 2.5 or 5 steps', () => {
  assert.deepEqual([23000, 21000, 9000, 41].map(niceStep), [25000, 25000, 10000, 50]);
});
