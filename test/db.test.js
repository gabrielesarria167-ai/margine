import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.js';

// Doc §3 example: Contanti €150, Conto €420, goal €500.
function setup() {
  const db = openDb(':memory:');
  const cash = db.createAccount({ name: 'Contanti', kind: 'cash', opening_cents: 15000 });
  const bank = db.createAccount({ name: 'Conto bancario', kind: 'bank', opening_cents: 42000 });
  db.setGoal({ amount_cents: 50000 });
  return { db, cash, bank };
}
const expense = (account_id, amount_cents, extra = {}) =>
  ({ account_id, amount_cents, description: 'Test', category: 'Cibo', date: '2026-11-01', ...extra });

test('dashboard example: 570 / 500 / 70', () => {
  const { db } = setup();
  const t = db.getState().totals;
  assert.deepEqual([t.P, t.S, t.D, t.status], [57000, 50000, 7000, 'covered']);
});

test('doc §7.3 values: spend 50, then 70 arrives → 520/20, then 590/90, goal untouched', () => {
  const { db, bank } = setup();
  db.addExpense(expense(bank, 5000));
  let t = db.getState().totals;
  assert.deepEqual([t.P, t.S, t.D], [52000, 50000, 2000]);
  db.addIncome({ account_id: bank, amount_cents: 7000, description: 'Cliente', category: 'Lavoro', date: '2026-11-02' });
  t = db.getState().totals;
  assert.deepEqual([t.P, t.S, t.D], [59000, 50000, 9000]);
  assert.equal(db.getState().goal.amount_cents, 50000);
});

test('recover exception stores the expected recovery', () => {
  const { db, bank } = setup();
  db.addExpense(expense(bank, 10000, {
    exception: { type: 'recover', reason: 'Componente per lavoro', expected_recovery_cents: 12000, recovery_source: 'Cliente', recovery_due: '2026-12-01' },
  }));
  const ex = db.getState().transactions[0];
  assert.deepEqual([ex.exception_type, ex.overflow_cents, ex.expected_recovery_cents, ex.recovery_status], ['recover', 3000, 12000, 'pending']);
});

test('over-limit expense without exception is refused and writes nothing', () => {
  const { db, bank } = setup();
  const before = db.getState().transactions.length;
  assert.throws(() => db.addExpense(expense(bank, 10000)), { code: 'EXCEPTION_REQUIRED' });
  assert.equal(db.getState().transactions.length, before);
  assert.deepEqual(db.previewExpense(10000), { spendable_cents: 7000, overflow_cents: 3000 });
});

test('exception records the overflow and keeps the goal', () => {
  const { db, bank } = setup();
  db.addExpense(expense(bank, 10000, { exception: { type: 'emergency', reason: 'Riparazione urgente' } }));
  const s = db.getState();
  assert.equal(s.transactions[0].overflow_cents, 3000);
  assert.equal(s.goal.amount_cents, 50000);
  assert.equal(s.totals.status, 'deficit'); // 470 < 500 after the goal had been reached
  assert.equal(s.totals.F, 3000);
});

test('exception on an ordinary expense is refused; recover needs its fields', () => {
  const { db, bank } = setup();
  assert.throws(() => db.addExpense(expense(bank, 1000, { exception: { type: 'emergency', reason: 'x' } })), { code: 'INVALID' });
  assert.throws(() => db.addExpense(expense(bank, 10000, { exception: { type: 'recover', reason: 'x' } })), { code: 'INVALID' });
  assert.throws(() => db.addExpense(expense(bank, 10000, { exception: { type: 'emergency', reason: '  ' } })), { code: 'INVALID' });
});

test('transfer moves money without changing patrimonio', () => {
  const { db, cash, bank } = setup();
  db.addTransfer({ account_id: bank, to_account_id: cash, amount_cents: 10000, date: '2026-11-01' });
  const s = db.getState();
  assert.equal(s.totals.P, 57000);
  assert.deepEqual(s.accounts.map((a) => a.balance_cents), [25000, 32000]);
});

test('balances never go negative', () => {
  const { db, cash, bank } = setup();
  assert.throws(() => db.addTransfer({ account_id: cash, to_account_id: bank, amount_cents: 15001, date: '2026-11-01' }), { code: 'INSUFFICIENT_FUNDS' });
  db.setGoal({ amount_cents: 0 });
  assert.throws(() => db.addExpense(expense(cash, 15001)), { code: 'INSUFFICIENT_FUNDS' });
});

test('goal above patrimonio: building, then reached by income (doc §5.2)', () => {
  const { db, bank } = setup();
  db.addIncome({ account_id: bank, amount_cents: 30000, description: 'Lavoro', category: 'Lavoro', date: '2026-11-01' });
  db.setGoal({ amount_cents: 100000 });
  let t = db.getState().totals;
  assert.deepEqual([t.P, t.D, t.F, t.status], [87000, 0, 13000, 'building']);
  db.addIncome({ account_id: bank, amount_cents: 13000, description: 'Lavoro', category: 'Lavoro', date: '2026-11-02' });
  t = db.getState().totals;
  assert.deepEqual([t.D, t.F, t.status], [0, 0, 'covered']);
  assert.ok(db.getState().goal.reached_at);
});

test('balance check: difference becomes a traceable adjustment; equal count only logs the check', () => {
  const { db, cash } = setup();
  assert.throws(() => db.checkBalance({ account_id: cash, counted_cents: 14000 }), { code: 'INVALID' }); // reason required
  assert.deepEqual(db.checkBalance({ account_id: cash, counted_cents: 14000, reason: 'Spesa non registrata' }), { difference_cents: -1000 });
  const s = db.getState();
  assert.equal(s.accounts[0].balance_cents, 14000);
  assert.equal(s.transactions[0].kind, 'adjustment');
  assert.equal(s.transactions[0].amount_cents, -1000);
  const n = s.transactions.length;
  db.checkBalance({ account_id: cash, counted_cents: 14000 });
  assert.equal(db.getState().transactions.length, n);
  assert.ok(db.getState().lastCheck.checked_at);
});

test('file database persists and reopens without re-migrating', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'margine-')), 'm.db');
  const a = openDb(file);
  a.createAccount({ name: 'Contanti', kind: 'cash', opening_cents: 100 });
  a.close();
  const b = openDb(file);
  assert.equal(b.getState().totals.P, 100);
  b.close();
});

test('setup is all-or-nothing', () => {
  const db = openDb(':memory:');
  assert.throws(() => db.setup({ accounts: [{ name: 'Contanti', kind: 'cash', opening_cents: 100 }, { name: '', kind: 'digital' }] }), { code: 'INVALID' });
  assert.equal(db.getState().accounts.length, 0);
  db.setup({ accounts: [{ name: 'Contanti', kind: 'cash', opening_cents: 15000 }, { name: 'Conto', kind: 'bank', opening_cents: 42000 }], goal_cents: 50000 });
  assert.equal(db.getState().totals.D, 7000);
  assert.deepEqual(db.getState().accounts.map((a) => a.name), ['Contanti', 'Conto bancario']); // fixed names win over input
});
