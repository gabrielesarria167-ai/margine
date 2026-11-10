import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb, MIGRATIONS } from '../src/db.js';
import { todayISO, localISO } from '../src/ledger.js';

const today = todayISO();

// Doc §3 example: Contanti €150, Conto €420, goal €500.
function setup() {
  const db = openDb(':memory:');
  const cash = db.createAccount({ name: 'Contanti', kind: 'cash', opening_cents: 15000 });
  const bank = db.createAccount({ name: 'Conto bancario', kind: 'bank', opening_cents: 42000 });
  db.setGoal({ amount_cents: 50000 });
  return { db, cash, bank };
}
const expense = (account_id, amount_cents, extra = {}) =>
  ({ account_id, amount_cents, description: 'Test', category: 'Cibo', date: today, ...extra });

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
  db.addIncome({ account_id: bank, amount_cents: 7000, description: 'Cliente', category: 'Lavoro', date: today });
  t = db.getState().totals;
  assert.deepEqual([t.P, t.S, t.D], [59000, 50000, 9000]);
  assert.equal(db.getState().goal.amount_cents, 50000);
});

test('recover exception stores the expected recovery', () => {
  const { db, bank } = setup();
  db.addExpense(expense(bank, 10000, {
    exception: { type: 'recover', reason: 'Componente per lavoro', expected_recovery_cents: 12000, recovery_source: 'Cliente', recovery_due: '2026-12-01' },
  }));
  const ex = db.getState().transactions.find((t) => t.kind === 'expense');
  assert.deepEqual([ex.exception_type, ex.overflow_cents, ex.expected_recovery_cents, ex.recovery_status], ['recover', 3000, 12000, 'pending']);
});

test('over-limit expense without exception is refused and writes nothing', () => {
  const { db, bank } = setup();
  const before = db.getState().transactions.length;
  assert.throws(() => db.addExpense(expense(bank, 10000)), { code: 'EXCEPTION_REQUIRED' });
  assert.equal(db.getState().transactions.length, before);
});

test('exception records the overflow and keeps the goal', () => {
  const { db, bank } = setup();
  db.addExpense(expense(bank, 10000, { exception: { type: 'emergency', reason: 'Riparazione urgente' } }));
  const s = db.getState();
  assert.equal(s.transactions.find((t) => t.kind === 'expense').overflow_cents, 3000);
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
  db.addTransfer({ account_id: bank, to_account_id: cash, amount_cents: 10000, date: today });
  const s = db.getState();
  assert.equal(s.totals.P, 57000);
  assert.deepEqual(s.accounts.map((a) => a.balance_cents), [25000, 32000]);
});

test('balances never go negative', () => {
  const { db, cash, bank } = setup();
  assert.throws(() => db.addTransfer({ account_id: cash, to_account_id: bank, amount_cents: 15001, date: today }), { code: 'INSUFFICIENT_FUNDS' });
  db.setGoal({ amount_cents: 0 });
  assert.throws(() => db.addExpense(expense(cash, 15001)), { code: 'INSUFFICIENT_FUNDS' });
});

test('goal above patrimonio: building, then reached by income (doc §5.2)', () => {
  const { db, bank } = setup();
  db.addIncome({ account_id: bank, amount_cents: 30000, description: 'Lavoro', category: 'Lavoro', date: today });
  db.setGoal({ amount_cents: 100000 });
  let t = db.getState().totals;
  assert.deepEqual([t.P, t.D, t.F, t.status], [87000, 0, 13000, 'building']);
  db.addIncome({ account_id: bank, amount_cents: 13000, description: 'Lavoro', category: 'Lavoro', date: today });
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

test('own categories: added once, usable, Altro stays last, duplicates and blanks refused', () => {
  const { db, bank } = setup();
  assert.equal(db.addCategory({ kind: 'income', name: '  paghetta ' }), 'Paghetta');
  assert.deepEqual(db.getState().categories.income, ['Lavoro', 'Rimborso', 'Regalo', 'Paghetta', 'Altro']);
  assert.deepEqual(db.getState().categories.expense.at(-1), 'Altro');
  assert.throws(() => db.addCategory({ kind: 'income', name: 'PAGHETTA' }), { code: 'INVALID' });
  assert.throws(() => db.addCategory({ kind: 'income', name: 'lavoro' }), { code: 'INVALID' });
  assert.throws(() => db.addCategory({ kind: 'income', name: '   ' }), { code: 'INVALID' });
  assert.throws(() => db.addCategory({ kind: 'transfer', name: 'X' }), { code: 'INVALID' });
  db.addIncome({ account_id: bank, amount_cents: 2000, description: 'Nonna', category: 'Paghetta', date: today });
  assert.throws(() => db.addExpense(expense(bank, 100, { category: 'Paghetta' })), { code: 'INVALID' }); // income-only
});

test('own categories: rename carries history along, delete moves movements to Altro', () => {
  const { db, bank } = setup();
  db.addCategory({ kind: 'income', name: 'paghetta' });
  db.addCategory({ kind: 'expense', name: 'paghetta' }); // same name, other kind: kept apart
  db.addIncome({ account_id: bank, amount_cents: 2000, description: 'Nonna', category: 'Paghetta', date: today });
  db.addExpense(expense(bank, 500, { category: 'Paghetta' }));
  const cats = (kind) => db.getState().categories[kind];
  const catOf = (kind) => db.getState().transactions.find((t) => t.kind === kind).category;

  assert.equal(db.renameCategory({ kind: 'income', name: 'Paghetta', to: 'mancia' }), 'Mancia');
  assert.deepEqual(cats('income'), ['Lavoro', 'Rimborso', 'Regalo', 'Mancia', 'Altro']);
  assert.equal(catOf('income'), 'Mancia');
  assert.equal(catOf('expense'), 'Paghetta');
  assert.equal(db.renameCategory({ kind: 'income', name: 'Mancia', to: 'MANCIA' }), 'MANCIA'); // own case change is fine
  assert.throws(() => db.renameCategory({ kind: 'income', name: 'MANCIA', to: 'regalo' }), { code: 'INVALID' });
  assert.throws(() => db.renameCategory({ kind: 'income', name: 'Lavoro', to: 'Stipendio' }), { code: 'INVALID' }); // built-in
  assert.throws(() => db.deleteCategory({ kind: 'expense', name: 'Altro' }), { code: 'INVALID' });

  const before = db.getState().totals;
  assert.deepEqual(db.deleteCategory({ kind: 'income', name: 'MANCIA' }), { moved: 1 });
  assert.equal(catOf('income'), 'Altro');
  assert.deepEqual(cats('income'), ['Lavoro', 'Rimborso', 'Regalo', 'Altro']);
  assert.deepEqual(db.getState().totals, before);
  assert.equal(catOf('expense'), 'Paghetta');
});

test('impossible and future movement dates are refused; a future recovery date is fine', () => {
  const { db, bank } = setup();
  for (const date of ['2026-02-31', '2026-13-01', '2026-1-1', '2026-11-01T10:00']) {
    assert.throws(() => db.addExpense(expense(bank, 100, { date })), { code: 'INVALID' }, date);
  }
  assert.throws(() => db.addIncome({ account_id: bank, amount_cents: 100, description: 'X', category: 'Lavoro', date: '2999-01-01' }), { code: 'INVALID' });
  const big = expense(bank, 10000, { exception: { type: 'recover', reason: 'Auto', expected_recovery_cents: 10000, recovery_source: 'Lavoro', recovery_due: '2028-02-29' } }); // real leap day, in the future
  db.addExpense(big);
});

test('a database from a newer version is refused, not written to', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'margine-')), 'm.db');
  openDb(file).close();
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA user_version = 999');
  raw.close();
  assert.throws(() => openDb(file), /versione più recente/);
  fs.rmSync(file); // the failed open must have released the file
});

test('movements dated before an account\'s opening balance are refused', () => {
  const { db, cash, bank } = setup();
  const yesterday = localISO(Date.now() - 86400000);
  assert.throws(() => db.addExpense(expense(bank, 100, { date: yesterday })), { code: 'INVALID' });
  assert.throws(() => db.addIncome({ account_id: bank, amount_cents: 100, description: 'X', category: 'Lavoro', date: yesterday }), { code: 'INVALID' });
  assert.throws(() => db.addTransfer({ account_id: bank, to_account_id: cash, amount_cents: 100, date: yesterday }), { code: 'INVALID' });
  db.addExpense(expense(bank, 100)); // same day as the opening balance is fine
});

test('setup runs only once', () => {
  const db = openDb(':memory:');
  db.setup({ accounts: [{ name: 'Contanti', kind: 'cash', opening_cents: 15000 }] });
  assert.throws(() => db.setup({ accounts: [{ name: 'Contanti', kind: 'cash', opening_cents: 15000 }] }), { code: 'INVALID' });
  assert.equal(db.getState().totals.P, 15000);
});

test('upgrading an old database keeps a backup and the data', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'margine-')), 'm.db');
  const raw = new DatabaseSync(file);
  raw.exec(MIGRATIONS[0]);
  raw.exec("INSERT INTO accounts (name, kind, created_at) VALUES ('Contanti', 'cash', '2026-01-01T09:00:00.000Z'); PRAGMA user_version = 1;");
  raw.close();
  const db = openDb(file);
  assert.deepEqual(db.getState().accounts.map((a) => a.name), ['Contanti']);
  assert.equal(db.addCategory({ kind: 'expense', name: 'gatto' }), 'Gatto'); // table added by the upgrade
  db.close();
  const bak = new DatabaseSync(`${file}.bak-v1`);
  assert.equal(bak.prepare('PRAGMA user_version').get().user_version, 1);
  assert.equal(bak.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 1);
  bak.close();
});

test('main and preload expose the same actions', () => {
  const list = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').match(/const ACTIONS = (\[.*?\]);/)[1];
  assert.equal(list('preload.cjs'), list('main.js'));
});
