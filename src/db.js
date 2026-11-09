import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import {
  accountBalances, totals, overflow, todayISO,
  ACCOUNT_KINDS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, EXCEPTION_TYPES,
} from './ledger.js';

// Append-only. Never edit a shipped step: other people's databases already ran it.
const MIGRATIONS = [
  `CREATE TABLE accounts (
     id INTEGER PRIMARY KEY, name TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('cash','bank','digital')), created_at TEXT NOT NULL);
   CREATE TABLE transactions (
     id INTEGER PRIMARY KEY,
     kind TEXT NOT NULL CHECK (kind IN ('expense','income','transfer','adjustment')),
     amount_cents INTEGER NOT NULL,
     account_id INTEGER NOT NULL REFERENCES accounts(id),
     to_account_id INTEGER REFERENCES accounts(id),
     date TEXT NOT NULL, description TEXT, category TEXT, note TEXT, created_at TEXT NOT NULL);
   CREATE TABLE exceptions (
     id INTEGER PRIMARY KEY,
     transaction_id INTEGER NOT NULL UNIQUE REFERENCES transactions(id),
     type TEXT NOT NULL CHECK (type IN ('recover','emergency')),
     reason TEXT NOT NULL, overflow_cents INTEGER NOT NULL,
     expected_recovery_cents INTEGER, recovery_source TEXT, recovery_due TEXT,
     recovery_status TEXT NOT NULL DEFAULT 'pending'
       CHECK (recovery_status IN ('pending','partial','recovered','cancelled')));
   CREATE TABLE goals (
     id INTEGER PRIMARY KEY, amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
     set_at TEXT NOT NULL, reached_at TEXT, note TEXT);
   CREATE TABLE balance_checks (
     id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id),
     counted_cents INTEGER NOT NULL, computed_cents INTEGER NOT NULL,
     adjustment_id INTEGER REFERENCES transactions(id), reason TEXT, checked_at TEXT NOT NULL);`,
  `CREATE TABLE categories (
     id INTEGER PRIMARY KEY,
     kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
     name TEXT NOT NULL COLLATE NOCASE, created_at TEXT NOT NULL,
     UNIQUE (kind, name));`,
];

const DEFAULT_CATEGORIES = { expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES };

export class LedgerError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new LedgerError(code, message); };

// Validation at the IPC trust boundary: the renderer is never trusted for amounts, ids or rules.
const cents = (v, label) => (Number.isSafeInteger(v) && v > 0 ? v : fail('INVALID', `${label}: inserisci un importo maggiore di zero.`));
const text = (v, label, { required = false, max = 200 } = {}) => {
  const s = String(v ?? '').trim();
  if (required && !s) fail('INVALID', `${label} è obbligatorio.`);
  if (s.length > max) fail('INVALID', `${label} è troppo lungo.`);
  return s || null;
};
const isoDate = (v, label) => {
  const s = String(v ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : fail('INVALID', `${label}: data non valida.`);
};
const oneOf = (v, list, label) => (list.includes(v) ? v : fail('INVALID', `${label} non valida.`));
const now = () => new Date().toISOString();

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  migrate(db, file);

  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const get = (sql, ...p) => db.prepare(sql).get(...p);
  const run = (sql, ...p) => db.prepare(sql).run(...p);

  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); markGoalReached(); db.exec('COMMIT'); return r; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  };

  const balances = () => accountBalances(all('SELECT kind, amount_cents, account_id, to_account_id FROM transactions'));
  const patrimonio = (b = balances()) => [...b.values()].reduce((a, v) => a + v, 0);
  const currentGoal = () => get('SELECT * FROM goals ORDER BY id DESC LIMIT 1') ?? null;
  const current = () => totals(patrimonio(), currentGoal());

  function markGoalReached() {
    const goal = currentGoal();
    if (goal && !goal.reached_at && patrimonio() >= goal.amount_cents) run('UPDATE goals SET reached_at = ? WHERE id = ?', now(), goal.id);
  }

  // Built-in categories, then the user's own in the order added, with Altro always last.
  const categoryList = (kind) => [
    ...DEFAULT_CATEGORIES[kind].filter((c) => c !== 'Altro'),
    ...all('SELECT name FROM categories WHERE kind = ? ORDER BY id', kind).map((r) => r.name),
    'Altro',
  ];

  // A new or changed name for one of the user's categories: tidy, capitalised, not clashing with any other.
  const categoryName = (kind, name, except = null) => {
    const s = text(String(name ?? '').replace(/\s+/g, ' '), 'Nome della categoria', { required: true, max: 30 });
    const label = s.charAt(0).toLocaleUpperCase('it-IT') + s.slice(1);
    const key = label.toLocaleLowerCase('it-IT');
    const dupe = categoryList(kind).find((c) => c !== except && c.toLocaleLowerCase('it-IT') === key);
    if (dupe) fail('INVALID', `La categoria «${dupe}» esiste già.`);
    return label;
  };
  // Only categories the user added can change; built-in ones are not in the table.
  const ownCategory = (kind, name) => {
    oneOf(kind, Object.keys(DEFAULT_CATEGORIES), 'Tipo di categoria');
    return get('SELECT * FROM categories WHERE kind = ? AND name = ?', kind, String(name ?? '')) ?? fail('INVALID', 'Categoria non trovata.');
  };

  const account = (id) => get('SELECT * FROM accounts WHERE id = ?', id) ?? fail('INVALID', 'Conto non trovato.');
  const requireFunds = (accountId, amount) => {
    const bal = balances().get(accountId) ?? 0;
    if (amount > bal) fail('INSUFFICIENT_FUNDS', `Sul conto «${account(accountId).name}» non ci sono abbastanza soldi.`);
  };
  const insertTx = (t) => Number(run(
    `INSERT INTO transactions (kind, amount_cents, account_id, to_account_id, date, description, category, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    t.kind, t.amount_cents, t.account_id, t.to_account_id ?? null, t.date, t.description ?? null, t.category ?? null, t.note ?? null, now(),
  ).lastInsertRowid);

  function insertAccount({ name, kind, opening_cents = 0 }) {
    oneOf(kind, Object.keys(ACCOUNT_KINDS), 'Tipo di conto');
    if (!Number.isSafeInteger(opening_cents) || opening_cents < 0) fail('INVALID', 'Saldo iniziale non valido.');
    // Cash and bank accounts carry their fixed Italian name; only digital accounts are named by the user.
    const label = kind === 'digital' ? text(name, 'Nome del conto', { required: true, max: 60 }) : ACCOUNT_KINDS[kind];
    const id = Number(run('INSERT INTO accounts (name, kind, created_at) VALUES (?, ?, ?)', label, kind, now()).lastInsertRowid);
    if (opening_cents > 0) insertTx({ kind: 'adjustment', amount_cents: opening_cents, account_id: id, date: todayISO(), description: 'Saldo iniziale' });
    return id;
  }

  return {
    close: () => db.close(),

    getState() {
      const b = balances();
      const accounts = all('SELECT * FROM accounts ORDER BY id').map((a) => ({ ...a, balance_cents: b.get(a.id) ?? 0 }));
      const goal = currentGoal();
      return {
        accounts,
        goal,
        totals: totals(patrimonio(b), goal),
        lastCheck: get('SELECT checked_at, account_id FROM balance_checks ORDER BY id DESC LIMIT 1') ?? null,
        goals: all('SELECT * FROM goals ORDER BY id DESC'),
        categories: { expense: categoryList('expense'), income: categoryList('income') },
        transactions: all(
          `SELECT t.*, e.type AS exception_type, e.reason AS exception_reason, e.overflow_cents,
                  e.expected_recovery_cents, e.recovery_source, e.recovery_due, e.recovery_status
           FROM transactions t LEFT JOIN exceptions e ON e.transaction_id = t.id
           ORDER BY t.date DESC, t.id DESC`),
      };
    },

    previewExpense(amount) {
      const { D } = current();
      return { spendable_cents: D, overflow_cents: overflow(cents(amount, 'Importo'), D) };
    },

    createAccount(input) {
      return tx(() => insertAccount(input));
    },

    // First run: all accounts and the goal in one transaction, so a failure never leaves a half-made setup.
    setup({ accounts, goal_cents }) {
      return tx(() => {
        if (!Array.isArray(accounts) || !accounts.length) fail('INVALID', 'Aggiungi almeno un conto.');
        accounts.forEach(insertAccount);
        if (goal_cents) run('INSERT INTO goals (amount_cents, set_at) VALUES (?, ?)', cents(goal_cents, 'Obiettivo'), now());
      });
    },

    addExpense(input) {
      return tx(() => {
        const amount = cents(input.amount_cents, 'Importo');
        const accountId = account(input.account_id).id;
        const row = {
          kind: 'expense', amount_cents: amount, account_id: accountId,
          description: text(input.description, 'Descrizione', { required: true }),
          category: oneOf(input.category, categoryList('expense'), 'Categoria'),
          date: isoDate(input.date, 'Data'), note: text(input.note, 'Nota', { max: 1000 }),
        };
        requireFunds(accountId, amount);
        const over = overflow(amount, current().D);
        const ex = input.exception;
        if (over > 0 && !ex) fail('EXCEPTION_REQUIRED', 'Questa spesa intacca il risparmio protetto: serve un’eccezione motivata.');
        if (over === 0 && ex) fail('INVALID', 'Questa spesa rientra nel denaro spendibile: non serve un’eccezione.');
        const id = insertTx(row);
        if (ex) {
          const type = oneOf(ex.type, Object.keys(EXCEPTION_TYPES), 'Tipologia di eccezione');
          const recover = type === 'recover';
          run(`INSERT INTO exceptions (transaction_id, type, reason, overflow_cents, expected_recovery_cents, recovery_source, recovery_due)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            id, type, text(ex.reason, 'Motivazione', { required: true, max: 1000 }), over,
            recover ? cents(ex.expected_recovery_cents, 'Importo da recuperare') : null,
            recover ? text(ex.recovery_source, 'Provenienza del recupero', { required: true }) : null,
            recover ? isoDate(ex.recovery_due, 'Data prevista di recupero') : null);
        }
        return id;
      });
    },

    addIncome(input) {
      return tx(() => insertTx({
        kind: 'income', amount_cents: cents(input.amount_cents, 'Importo'), account_id: account(input.account_id).id,
        description: text(input.description, 'Provenienza', { required: true }),
        category: oneOf(input.category, categoryList('income'), 'Categoria'),
        date: isoDate(input.date, 'Data di ricezione'), note: text(input.note, 'Nota', { max: 1000 }),
      }));
    },

    // A category of the user's own, e.g. "paghetta" → "Paghetta". Returns the stored name.
    addCategory({ kind, name }) {
      return tx(() => {
        oneOf(kind, Object.keys(DEFAULT_CATEGORIES), 'Tipo di categoria');
        const label = categoryName(kind, name);
        run('INSERT INTO categories (kind, name, created_at) VALUES (?, ?, ?)', kind, label, now());
        return label;
      });
    },

    // Renames the category and the movements already filed under it, so history keeps matching.
    renameCategory({ kind, name, to }) {
      return tx(() => {
        const cat = ownCategory(kind, name);
        const label = categoryName(kind, to, cat.name);
        run('UPDATE categories SET name = ? WHERE id = ?', label, cat.id);
        run('UPDATE transactions SET category = ? WHERE kind = ? AND category = ?', label, kind, cat.name);
        return label;
      });
    },

    // Removes the category; its movements move to Altro (the form says so before confirming). Amounts never change.
    deleteCategory({ kind, name }) {
      return tx(() => {
        const cat = ownCategory(kind, name);
        const moved = Number(run('UPDATE transactions SET category = ? WHERE kind = ? AND category = ?', 'Altro', kind, cat.name).changes);
        run('DELETE FROM categories WHERE id = ?', cat.id);
        return { moved };
      });
    },

    addTransfer(input) {
      return tx(() => {
        const amount = cents(input.amount_cents, 'Importo');
        const from = account(input.account_id).id;
        const to = account(input.to_account_id).id;
        if (from === to) fail('INVALID', 'Scegli due conti diversi.');
        requireFunds(from, amount);
        return insertTx({ kind: 'transfer', amount_cents: amount, account_id: from, to_account_id: to,
          date: isoDate(input.date, 'Data'), note: text(input.note, 'Nota', { max: 1000 }) });
      });
    },

    setGoal({ amount_cents, note }) {
      return tx(() => {
        if (!Number.isSafeInteger(amount_cents) || amount_cents < 0) fail('INVALID', 'Obiettivo non valido.');
        return Number(run('INSERT INTO goals (amount_cents, set_at, note) VALUES (?, ?, ?)',
          amount_cents, now(), text(note, 'Nota', { max: 1000 })).lastInsertRowid);
      });
    },

    // Records what the user actually counted. A difference becomes a traceable adjustment; past movements are never edited.
    checkBalance({ account_id, counted_cents, reason }) {
      return tx(() => {
        const id = account(account_id).id;
        if (!Number.isSafeInteger(counted_cents) || counted_cents < 0) fail('INVALID', 'Saldo verificato non valido.');
        const computed = balances().get(id) ?? 0;
        const diff = counted_cents - computed;
        let adjustmentId = null;
        if (diff !== 0) {
          adjustmentId = insertTx({ kind: 'adjustment', amount_cents: diff, account_id: id, date: todayISO(),
            description: 'Rettifica saldo', note: text(reason, 'Motivazione della rettifica', { required: true, max: 1000 }) });
        }
        run('INSERT INTO balance_checks (account_id, counted_cents, computed_cents, adjustment_id, reason, checked_at) VALUES (?, ?, ?, ?, ?, ?)',
          id, counted_cents, computed, adjustmentId, text(reason, 'Motivazione', { max: 1000 }), now());
        return { difference_cents: diff };
      });
    },
  };
}

function migrate(db, file) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version >= MIGRATIONS.length) return;
  if (version > 0 && file !== ':memory:') { // keep a copy before changing a real user's data
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); // flush WAL so the copy is complete
    fs.copyFileSync(file, `${file}.bak-v${version}`);
  }
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try { db.exec(MIGRATIONS[v]); db.exec(`PRAGMA user_version = ${v + 1}`); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
}
