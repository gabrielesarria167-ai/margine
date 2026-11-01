// Pure money logic shared by the main process (db.js) and the renderer. All amounts are integer cents.

export const ACCOUNT_KINDS = { cash: 'Contanti', bank: 'Conto bancario', digital: 'Carta o conto digitale' };

export const EXPENSE_CATEGORIES = ['Cibo', 'Casa', 'Trasporti', 'Salute', 'Tecnologia', 'Divertimento', 'Altro'];
export const INCOME_CATEGORIES = ['Lavoro', 'Rimborso', 'Regalo', 'Altro'];
export const EXCEPTION_TYPES = { recover: 'Recupererò il denaro', emergency: 'Emergenza o necessità' };

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
export const formatEuro = (cents) => euro.format(cents / 100);

// Accepts "12,50", "1.000,50", "12.5", "1000", "€ 12". Returns cents, or null when not a valid non-negative amount.
export function parseEuro(input) {
  let s = String(input ?? '').replace(/[\s€]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "1.000" is Italian thousands, not 1.0
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ''] = s.split('.');
  const cents = Number(int) * 100 + Number(dec.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

// Balance per account id from transaction rows. Transfers move money and never change the total.
export function accountBalances(transactions) {
  const b = new Map();
  const add = (id, v) => b.set(id, (b.get(id) ?? 0) + v);
  for (const t of transactions) {
    if (t.kind === 'income' || t.kind === 'adjustment') add(t.account_id, t.amount_cents);
    else if (t.kind === 'expense') add(t.account_id, -t.amount_cents);
    else if (t.kind === 'transfer') { add(t.account_id, -t.amount_cents); add(t.to_account_id, t.amount_cents); }
  }
  return b;
}

// P = patrimonio, goal = { amount_cents, reached_at } | null. Phase 1 has one goal, so S = O.
export function totals(P, goal) {
  const S = goal?.amount_cents ?? 0;
  const D = Math.max(0, P - S);
  const F = Math.max(0, S - P);
  const status = F === 0 ? 'covered' : goal?.reached_at ? 'deficit' : 'building';
  return { P, S, O: S, D, F, status };
}

// How much of an expense would come out of protected savings.
export const overflow = (amount, D) => Math.max(0, amount - D);

export const todayISO = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time
