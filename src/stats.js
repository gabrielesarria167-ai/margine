// Figures for the dashboard's all-time section. Amounts in cents, dates 'YYYY-MM-DD'.
const DAY = 86400000;
const utc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

// Patrimonio at the end of every day from the first movement to `today`. Transfers move money, so they change nothing.
export function dailyBalance(transactions, today) {
  const delta = new Map();
  for (const t of transactions) {
    if (t.kind === 'transfer') continue;
    delta.set(t.date, (delta.get(t.date) ?? 0) + (t.kind === 'expense' ? -t.amount_cents : t.amount_cents));
  }
  if (!delta.size) return [];
  const days = [...delta.keys()].map(utc);
  const last = Math.max(utc(today), ...days);
  const out = [];
  let bal = 0;
  for (let ms = Math.min(...days); ms <= last; ms += DAY) {
    const date = new Date(ms).toISOString().slice(0, 10);
    bal += delta.get(date) ?? 0;
    out.push({ date, cents: bal });
  }
  return out;
}

// Least-squares line through equally spaced values: value at index 0 and change per step.
export function trendLine(values) {
  const n = values.length;
  if (n < 2) return { start: values[0] ?? 0, slope: 0 };
  const mx = (n - 1) / 2;
  const my = values.reduce((a, v) => a + v, 0) / n;
  let num = 0, den = 0;
  values.forEach((v, i) => { num += (i - mx) * (v - my); den += (i - mx) ** 2; });
  const slope = num / den;
  return { start: my - slope * mx, slope };
}

// Totals per category for one kind ('income' | 'expense'), biggest first.
export function byCategory(transactions, kind) {
  const m = new Map();
  for (const t of transactions) {
    if (t.kind !== kind) continue;
    const name = t.category ?? 'Altro';
    const r = m.get(name) ?? { name, cents: 0, count: 0 };
    r.cents += t.amount_cents;
    r.count += 1;
    m.set(name, r);
  }
  return [...m.values()].sort((a, b) => b.cents - a.cents);
}

// Round gridline step (1, 2, 2.5 or 5 × a power of ten) of at least x.
export function niceStep(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= x);
}
