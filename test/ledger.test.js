import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEuro, accountBalances, totals, overflow, formatEuro } from '../src/ledger.js';

const g = (euros, reached_at = '2026-01-01') => ({ amount_cents: euros * 100, reached_at });

test('spendable table from doc §6', () => {
  for (const [P, S, D] of [[570, 500, 70], [10, 2, 8], [870, 500, 370], [870, 870, 0], [1000, 1000, 0]]) {
    assert.equal(totals(P * 100, g(S)).D, D * 100, `${P}/${S}`);
  }
});

test('goal above patrimonio blocks spending (doc §5.2)', () => {
  const t = totals(87000, g(1000, null));
  assert.equal(t.D, 0);
  assert.equal(t.F, 13000);
  assert.equal(t.status, 'building');
});

test('dropping under a reached goal is a deficit', () => {
  assert.equal(totals(47000, g(500)).status, 'deficit');
  assert.equal(totals(57000, g(500)).status, 'covered');
});

test('no goal means everything is spendable', () => {
  assert.deepEqual(totals(12345, null), { P: 12345, S: 0, O: 0, D: 12345, F: 0, status: 'covered' });
});

test('overflow is the part beyond spendable', () => {
  assert.equal(overflow(10000, 7000), 3000);
  assert.equal(overflow(5000, 7000), 0);
});

test('balances: transfers move money without changing the total', () => {
  const b = accountBalances([
    { kind: 'adjustment', account_id: 1, amount_cents: 15000 },
    { kind: 'adjustment', account_id: 2, amount_cents: 42000 },
    { kind: 'transfer', account_id: 2, to_account_id: 1, amount_cents: 10000 },
    { kind: 'expense', account_id: 1, amount_cents: 5000 },
    { kind: 'income', account_id: 2, amount_cents: 7000 },
    { kind: 'adjustment', account_id: 2, amount_cents: -1000 },
  ]);
  assert.equal(b.get(1), 20000);
  assert.equal(b.get(2), 38000);
});

test('parseEuro', () => {
  const cases = {
    '12,50': 1250, '1.000,50': 100050, '12.5': 1250, '1000': 100000, '1.000': 100000,
    '€ 70': 7000, '0,05': 5, '12.50': 1250, '': null, 'abc': null, '-5': null, '1,234': null, '1.2.3': null,
  };
  for (const [input, cents] of Object.entries(cases)) assert.equal(parseEuro(input), cents, input);
});

test('formatEuro uses Italian formatting', () => {
  assert.match(formatEuro(100050), /^1\.000,50\s€$/);
});
