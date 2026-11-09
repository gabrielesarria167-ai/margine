import { formatEuro, parseEuro, totals, todayISO, ACCOUNT_KINDS, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../ledger.js';
import { dailyBalance, trendLine, byCategory, niceStep } from '../stats.js';
import { html } from './html.js';
import { icon } from './icons.js';
import { call, refresh, toast, fmtDay, fmtDayYear, fmtStamp } from './store.js';
import { renderFascia } from './fascia.js';

const KIND_ICON = { cash: 'cash', bank: 'bank', digital: 'digital' };

// ---------- shared: movements table ----------

function describeRow(t, names) {
  const acc = names.get(t.account_id) ?? '';
  const abs = formatEuro(Math.abs(t.amount_cents));
  const sub = [t.category, t.note].filter(Boolean).join(' · ');
  switch (t.kind) {
    case 'income': return { title: t.description, sub, acc, amt: `+${abs}`, cls: 'amt--in' };
    case 'transfer': return { title: 'Trasferimento', sub: t.note ?? '', acc: `${acc} → ${names.get(t.to_account_id) ?? ''}`, amt: abs, cls: 'amt--move' };
    case 'adjustment': return {
      title: t.description, sub: t.note ?? '', acc, amt: `${t.amount_cents < 0 ? '−' : '+'}${abs}`,
      cls: t.amount_cents < 0 ? '' : 'amt--in', tag: t.description === 'Saldo iniziale' ? null : 'Rettifica',
    };
    default: return { title: t.description, sub, acc, amt: `−${abs}`, cls: '' };
  }
}

function exceptionLine(t) {
  const why = `Motivo: ${t.exception_reason}`;
  if (t.exception_type === 'recover') {
    return `${formatEuro(t.overflow_cents)} dal risparmio. Recupero previsto ${formatEuro(t.expected_recovery_cents)} da ${t.recovery_source} entro il ${fmtDayYear(t.recovery_due)}. ${why}`;
  }
  return `${formatEuro(t.overflow_cents)} dal risparmio per un'emergenza. ${why}`;
}

function movementsTable(rows, accounts) {
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  return html`
    <table class="table">
      <thead><tr><th scope="col">Data</th><th scope="col">Movimento</th><th scope="col">Conto</th><th scope="col">Importo</th></tr></thead>
      <tbody>${rows.map((t) => {
        const r = describeRow(t, names);
        return html`<tr data-date="${t.date}">
          <td class="date">${fmtDay(t.date)}</td>
          <td>
            <div class="desc">${r.title}${r.tag ? html`<span class="tag">${r.tag}</span>` : ''}${t.exception_type ? html`<span class="tag tag--exception">Eccezione · ${t.exception_type === 'recover' ? 'recupero' : 'emergenza'}</span>` : ''}</div>
            ${r.sub ? html`<p class="desc-sub">${r.sub}</p>` : ''}
            ${t.exception_type ? html`<p class="desc-sub is-exception">${exceptionLine(t)}</p>` : ''}
          </td>
          <td class="acct">${r.acc}</td>
          <td class="amt ${r.cls}">${r.amt}</td>
        </tr>`;
      })}</tbody>
    </table>`;
}

const emptyMovements = () => html`
  <div class="empty"><p>Nessun movimento ancora, a parte i saldi iniziali. Le spese e le entrate che registri compariranno qui.</p></div>`;

function statusSentence(t) {
  if (t.status === 'deficit') return html`Il patrimonio è sceso sotto il risparmio protetto: deficit di <strong>${formatEuro(t.F)}</strong>.`;
  if (t.status === 'building') return html`Tutto il patrimonio è protetto finché non raggiungi l'obiettivo: mancano <strong>${formatEuro(t.F)}</strong>.`;
  if (!t.S) return 'Nessun obiettivo di risparmio: tutto il patrimonio è spendibile.';
  return html`<strong>${formatEuro(t.S)}</strong> restano protetti, fuori dalle spese ordinarie.`;
}

// ---------- dashboard: da sempre ----------

const wholeEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' });
const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', timeZone: 'UTC' });
const signedEuro = (c) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${formatEuro(Math.abs(c))}`;
// Slice shades step by lightness, biggest category darkest: green for income, red for expenses.
// shortcut: categories past the last shade all share the lightest one; add shades if people keep more than that.
const GREENS = ['#00502C', '#007A43', '#4FA57A', '#9FCFB4', '#C9E3D3'];
const REDS = ['#6E130E', '#9A1C15', '#C8261E', '#DB4F47', '#E7807A', '#F0AEA9', '#F6D3D0'];

// Patrimonio day by day with its trend line: green area when the trend rises, red when it falls.
function balanceChart(series) {
  if (series.length < 2) return html`<p class="chart-note">Il grafico compare dal secondo giorno con dei movimenti.</p>`;
  const values = series.map((p) => p.cents);
  const n = values.length;
  const max = Math.max(...values, 100);
  const step = niceStep(max / 3);
  const top = step * Math.ceil(max / step);
  const X = (i) => (i / (n - 1) * 1000).toFixed(1);
  const Y = (v) => (240 - v / top * 240).toFixed(1);
  const line = `M${values.map((v, i) => `${X(i)},${Y(v)}`).join('L')}`;
  const { start, slope } = trendLine(values);
  const perMonth = Math.round(slope * 30.44);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step);
  let months = series.map((p, i) => [p.date, i]).filter(([d, i]) => i > 0 && d.endsWith('-01'));
  const every = Math.ceil(months.length / 12); // keep month labels readable over long histories
  months = months.filter((_, k) => k % every === 0);
  const pct = (i) => `${(i / (n - 1) * 100).toFixed(2)}%`;
  return html`
    <div class="chart ${slope >= 0 ? 'chart--up' : 'chart--down'}">
      <div class="chart-legend">
        <span><span class="key-area" aria-hidden="true"></span>Patrimonio, giorno per giorno</span>
        <span><span class="key-trend" aria-hidden="true"></span>Tendenza: ${perMonth >= 0 ? '+' : '−'}${formatEuro(Math.abs(perMonth))} al mese</span>
      </div>
      <div class="chart-scroll"><div class="chart-plot">
        <div class="chart-box">
          <svg viewBox="0 0 1000 240" preserveAspectRatio="none" role="img"
            aria-label="Patrimonio dal ${fmtDayYear(series[0].date)} a oggi: da ${formatEuro(values[0])} a ${formatEuro(values[n - 1])}, tendenza ${signedEuro(perMonth)} al mese">
            <path class="chart-grid" d="${ticks.slice(1).map((t) => `M0,${Y(t)}H1000`).join('')}"></path>
            <path class="chart-months" d="${months.map(([, i]) => `M${X(i)},0V240`).join('')}"></path>
            <path class="chart-area" d="${line}L1000,240L0,240Z"></path>
            <path class="chart-line" d="${line}"></path>
            <path class="chart-trend" d="M0,${Y(start)}L1000,${Y(start + slope * (n - 1))}"></path>
          </svg>
        </div>
        <div class="chart-y" aria-hidden="true">${ticks.map((t) => html`<span data-style="top: ${Y(t) / 2.4}%">${wholeEuro.format(t / 100)}</span>`)}</div>
        <div class="chart-x" aria-hidden="true">${months.map(([d, i]) => html`<span data-style="left: ${pct(i)}">${monthFmt.format(new Date(`${d}T00:00:00Z`))}</span>`)}</div>
      </div></div>
    </div>`;
}

function ranking({ id, title, sub, lead, of, rows, ramp, builtIn, income, empty }) {
  const total = rows.reduce((a, r) => a + r.cents, 0);
  if (!total) return html`<section class="ranking" aria-labelledby="${id}"><h2 id="${id}">${title}</h2><div class="empty"><p>${empty}</p></div></section>`;
  let deg = 0;
  const slices = rows.map((r, i) => {
    const a = deg;
    deg += r.cents / total * 360;
    return { ...r, color: ramp[Math.min(i, ramp.length - 1)], a, b: deg, share: r.cents / total * 100 };
  });
  // 1deg of canvas between slices keeps neighbours apart; a single slice gets none.
  const pie = slices.length === 1 ? slices[0].color : `conic-gradient(${slices.map((x) =>
    `${x.color} ${x.a.toFixed(2)}deg ${(x.b - 1).toFixed(2)}deg, var(--canvas) ${(x.b - 1).toFixed(2)}deg ${x.b.toFixed(2)}deg`).join(', ')})`;
  const pctOf = (x) => `${Math.round(x.share)}%`;
  return html`
    <section class="ranking" aria-labelledby="${id}">
      <h2 id="${id}">${title}</h2>
      <p class="muted">${sub}</p>
      <div class="rank-head">
        <div class="pie" role="img" aria-label="${title}: ${slices.map((x) => `${x.name} ${pctOf(x)}`).join(', ')}" data-style="background: ${pie}"></div>
        <div class="rank-lead">
          <p class="label">${lead}</p>
          <p class="name">${slices[0].name}</p>
          <p class="muted">${pctOf(slices[0])} di tutte le ${of}</p>
        </div>
      </div>
      <table class="table rank">
        <thead><tr><th scope="col">Categoria</th><th scope="col">Quota</th><th scope="col" class="pct">%</th><th scope="col">Importo</th></tr></thead>
        <tbody>${slices.map((x) => html`<tr>
          <td>
            <div class="desc"><span class="swatch" aria-hidden="true" data-style="background: ${x.color}"></span>${x.name}${builtIn.includes(x.name) ? '' : html`<span class="tag">personale</span>`}</div>
            <p class="desc-sub">${x.count} ${x.count === 1 ? 'movimento' : 'movimenti'}</p>
          </td>
          <td class="bar-cell"><span class="rank-bar ${income ? 'rank-bar--in' : ''}"><span data-style="width: ${x.share.toFixed(1)}%"></span></span></td>
          <td class="pct">${pctOf(x)}</td>
          <td class="amt ${income ? 'amt--in' : ''}">${formatEuro(x.cents)}</td>
        </tr>`)}</tbody>
      </table>
    </section>`;
}

function allTime(s) {
  const incomes = byCategory(s.transactions, 'income');
  const expenses = byCategory(s.transactions, 'expense');
  const sum = (rows) => rows.reduce((a, r) => a + r.cents, 0);
  const count = (rows) => rows.reduce((a, r) => a + r.count, 0);
  const tin = sum(incomes), tout = sum(expenses), net = tin - tout;
  const series = dailyBalance(s.transactions, todayISO());
  const kept = !tin ? '' : net >= 0 ? `Hai tenuto il ${Math.round(net / tin * 100)}% di ciò che è entrato` : 'Hai speso più di quanto è entrato';
  const movimenti = (c) => `${c} ${c === 1 ? 'movimento' : 'movimenti'}`;
  return html`
    <section class="section" aria-labelledby="dasempre">
      <h2 id="dasempre">Da sempre</h2>
      ${series.length ? html`<p class="muted">Dal ${fmtDayYear(series[0].date)}, il primo movimento registrato. Saldi iniziali e rettifiche contano nel patrimonio, non tra entrate e uscite.</p>` : ''}
      <dl class="figures">
        <div><dt>Entrate</dt><dd class="is-in">${formatEuro(tin)}</dd><dd class="note">${movimenti(count(incomes))}</dd></div>
        <div><dt>Uscite</dt><dd>${formatEuro(tout)}</dd><dd class="note">${movimenti(count(expenses))}</dd></div>
        <div><dt>Risultato netto</dt><dd>${signedEuro(net)}</dd>${kept ? html`<dd class="note">${kept}</dd>` : ''}</div>
      </dl>
      ${balanceChart(series)}
    </section>
    <div class="section rankings">
      ${ranking({ id: 'arrivano', title: 'Da dove arrivano', sub: 'Entrate per categoria, da sempre.', lead: 'Prima fonte', of: 'entrate',
        rows: incomes, ramp: GREENS, builtIn: INCOME_CATEGORIES, income: true, empty: 'Nessuna entrata registrata. Le categorie compariranno qui.' })}
      ${ranking({ id: 'vanno', title: 'Dove vanno', sub: 'Uscite per categoria, da sempre.', lead: 'Prima voce di spesa', of: 'uscite',
        rows: expenses, ramp: REDS, builtIn: EXPENSE_CATEGORIES, income: false, empty: 'Nessuna spesa registrata. Le categorie compariranno qui.' })}
    </div>`;
}

// ---------- dashboard ----------

function dashboard(main, s) {
  const t = s.totals;
  const goalStatus = t.status === 'deficit'
    ? html`<p class="status status--deficit">Deficit di ${formatEuro(t.F)}</p>`
    : t.status === 'building'
      ? html`<p class="status status--building">Mancano ${formatEuro(t.F)}</p>`
      : html`<p class="status muted">${t.S ? html`Coperto${s.goal?.reached_at ? ` dal ${fmtDay(s.goal.reached_at.slice(0, 10))}` : ''}` : 'Nessun obiettivo fissato'}</p>`;
  const recent = s.transactions.filter((x) => x.description !== 'Saldo iniziale').slice(0, 6);

  main.innerHTML = html`
    <div class="view">
      <div class="answer-grid">
        <section class="answer">
          <h1><span class="answer-lead">Denaro spendibile</span><span class="answer-figure ${t.D ? '' : 'is-zero'}">${formatEuro(t.D)}</span></h1>
          <p class="answer-note">${statusSentence(t)}</p>
          <div class="actions">
            <button class="btn" data-open="income">${icon('income')}Nuova entrata</button>
            <button class="btn" data-open="transfer">${icon('transfer')}Trasferimento</button>
            <button class="btn" data-open="check">${icon('check')}Verifica saldo</button>
          </div>
        </section>
        <aside class="goal-state" aria-label="Obiettivo di risparmio">
          <h2>Obiettivo di risparmio</h2>
          <p class="goal-figure">${formatEuro(t.O)}</p>
          ${goalStatus}
          <button class="btn" data-open="goal">${icon('goal')}Nuovo obiettivo</button>
        </aside>
      </div>

      <dl class="stations">
        <div><dt>Patrimonio effettivo</dt><dd>${formatEuro(t.P)}</dd></div>
        ${s.accounts.map((a) => html`<div><dt>${icon(KIND_ICON[a.kind])}${a.name}</dt><dd>${formatEuro(a.balance_cents)}</dd></div>`)}
        <div><dt>Ultimo controllo</dt><dd class="small">${s.lastCheck ? fmtStamp(s.lastCheck.checked_at) : 'Mai verificato'}</dd></div>
      </dl>

      ${allTime(s)}

      <section class="section">
        <h2>Ultimi movimenti ${recent.length ? html`<a href="#/transazioni">Tutte le transazioni</a>` : ''}</h2>
        ${recent.length ? movementsTable(recent, s.accounts) : emptyMovements()}
      </section>
      <p class="section"><button class="btn btn--ghost" data-open="account">${icon('plus')}Aggiungi un conto</button></p>
    </div>`;
  // The page's CSP forbids style attributes in markup; computed sizes and colours are applied through the CSSOM.
  main.querySelectorAll('[data-style]').forEach((el) => { el.style.cssText = el.dataset.style; });
}

// ---------- transazioni ----------

function transactions(main, s) {
  main.innerHTML = html`
    <div class="view">
      <header class="view-head">
        <div>
          <h1>Transazioni</h1>
          <p class="guide" aria-live="off"></p>
        </div>
        <div class="actions">
          <button class="btn" data-open="income">${icon('income')}Nuova entrata</button>
          <button class="btn" data-open="transfer">${icon('transfer')}Trasferimento</button>
        </div>
      </header>
      ${s.transactions.length ? movementsTable(s.transactions, s.accounts) : emptyMovements()}
    </div>`;

  // Guide words: the date span currently in view, recomputed as the list scrolls.
  const guide = main.querySelector('.guide');
  const rows = [...main.querySelectorAll('tr[data-date]')];
  const update = () => {
    const box = main.getBoundingClientRect();
    const seen = rows.filter((r) => { const b = r.getBoundingClientRect(); return b.bottom > box.top + 1 && b.top < box.bottom - 1; }).map((r) => r.dataset.date);
    if (!seen.length) { guide.textContent = ''; return; }
    const from = seen.at(-1), to = seen[0]; // rows are newest first
    guide.textContent = from === to ? fmtDayYear(from) : `Dal ${fmtDay(from)} al ${fmtDayYear(to)}`;
  };
  let queued = false;
  main.onscroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
  update();
}

// ---------- risparmi ----------

// Under the protected figure, say when and how it was set rather than repeating the amount.
function savingsNote(s) {
  const t = s.totals;
  if (!s.goal || !t.S) return 'Nessun obiettivo fissato: tutto il patrimonio è spendibile.';
  if (t.status !== 'covered') return statusSentence(t);
  const reached = s.goal.reached_at ? `, coperto dal patrimonio dal ${fmtDay(s.goal.reached_at.slice(0, 10))}` : '';
  return `Obiettivo fissato il ${fmtDay(s.goal.set_at.slice(0, 10))}${reached}.`;
}

function savings(main, s) {
  const t = s.totals;
  main.innerHTML = html`
    <div class="view">
      <header class="view-head"><h1>Risparmi</h1></header>
      <div class="answer-grid">
        <section class="answer">
          <h2><span class="answer-lead">Risparmio protetto</span></h2>
          <p class="answer-figure ${t.S ? '' : 'is-zero'}">${formatEuro(t.S)}</p>
          <p class="answer-note">${savingsNote(s)}</p>
          <div class="actions"><button class="btn btn--primary" data-open="goal">${icon('goal')}Nuovo obiettivo</button></div>
        </section>
        <aside class="goal-state" aria-label="Come si calcola">
          <h2>Come si calcola</h2>
          <p class="status">${formatEuro(t.P)} di patrimonio, meno ${formatEuro(t.S)} protetti: <strong>${formatEuro(t.D)}</strong> spendibili.</p>
        </aside>
      </div>
      <p class="prose section">Il risparmio protetto non è un conto separato: è la parte del patrimonio che hai deciso di non spendere. Non cresce con le entrate e non cala con le spese. Cambia solo quando fissi un nuovo obiettivo. Spenderlo resta possibile, ma richiede un'eccezione motivata che rimane nello storico.</p>

      <section class="section">
        <h2>Storico degli obiettivi</h2>
        ${s.goals.length ? html`
          <table class="table">
            <thead><tr><th scope="col">Fissato il</th><th scope="col">Nota</th><th scope="col">Raggiunto</th><th scope="col">Obiettivo</th></tr></thead>
            <tbody>${s.goals.map((g) => html`<tr>
              <td class="date">${fmtDay(g.set_at.slice(0, 10))}</td>
              <td>${g.note ?? ''}</td>
              <td class="acct">${g.reached_at ? fmtDay(g.reached_at.slice(0, 10)) : 'Non ancora'}</td>
              <td class="amt">${formatEuro(g.amount_cents)}</td>
            </tr>`)}</tbody>
          </table>`
        : html`<div class="empty"><p>Non hai ancora fissato un obiettivo. Finché non lo fai, tutto il patrimonio conta come spendibile.</p></div>`}
      </section>
    </div>`;
}

// ---------- first run ----------

function setup(main) {
  // Contanti and Conto bancario keep their fixed names; only a card or digital account is named by the user.
  const row = (kind, name, removable = false) => html`
    <div class="setup-row" data-kind="${kind}">
      ${icon(KIND_ICON[kind])}
      ${kind === 'digital'
        ? html`<label class="field"><span class="label">Nome</span><input class="input" name="name" value="${name}" maxlength="60" required></label>`
        : html`<div class="field"><span class="label">Conto</span><p class="setup-name">${name}</p></div>`}
      <label class="field"><span class="label">Saldo attuale<span class="visually-hidden"> ${name}</span></span><span class="money"><input class="input" name="balance" inputmode="decimal" autocomplete="off"></span></label>
      ${removable ? html`<button type="button" class="btn icon-btn" data-remove aria-label="Rimuovi questo conto">${icon('close')}</button>` : html`<span></span>`}
    </div>`;

  main.innerHTML = html`
    <form class="view setup" novalidate>
      <h1>Benvenuto in Margine</h1>
      <p class="prose">Inserisci quanto hai adesso, in contanti e sul conto. Potrai verificare i saldi in qualsiasi momento.</p>
      <div class="setup-accounts">
        ${row('cash', ACCOUNT_KINDS.cash)}
        ${row('bank', ACCOUNT_KINDS.bank)}
      </div>
      <p><button type="button" class="btn btn--ghost" data-add>${icon('plus')}Aggiungi carta o conto digitale</button></p>
      <div class="setup-goal">
        <div class="field">
          <label for="setup-goal">Obiettivo di risparmio</label>
          <p class="hint" id="setup-goal-hint">La parte del patrimonio da non spendere. Può essere più alta di quanto hai ora: in quel caso nulla è spendibile finché non la raggiungi.</p>
          <div class="money"><input class="input" id="setup-goal" name="goal" inputmode="decimal" autocomplete="off" aria-describedby="setup-goal-hint"></div>
        </div>
      </div>
      <p class="form-error" role="alert" hidden></p>
      <div class="actions"><button class="btn btn--primary" type="submit">Inizia</button></div>
    </form>`;

  const form = main.querySelector('form');
  const list = form.querySelector('.setup-accounts');
  const errorBox = form.querySelector('.form-error');

  const read = () => {
    const accounts = [...list.querySelectorAll('.setup-row')].map((r) => ({
      kind: r.dataset.kind,
      name: r.querySelector('[name=name]')?.value.trim() ?? ACCOUNT_KINDS[r.dataset.kind],
      raw: r.querySelector('[name=balance]').value,
      input: r.querySelector('[name=balance]'),
    }));
    const goalRaw = form.goal.value;
    return { accounts, goalRaw };
  };
  const preview = () => {
    const { accounts, goalRaw } = read();
    const P = accounts.reduce((a, x) => a + (parseEuro(x.raw) ?? 0), 0);
    const goal = parseEuro(goalRaw) ?? 0;
    renderFascia(totals(P, goal ? { amount_cents: goal, reached_at: P >= goal ? 'now' : null } : null));
  };

  form.addEventListener('input', preview);
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) {
      list.insertAdjacentHTML('beforeend', String(row('digital', ACCOUNT_KINDS.digital, true)));
      list.lastElementChild.querySelector('[name=name]').select();
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) { rm.closest('.setup-row').remove(); preview(); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { accounts, goalRaw } = read();
    errorBox.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    const bad = accounts.find((a) => !a.name || (a.raw.trim() && parseEuro(a.raw) == null));
    const goal = goalRaw.trim() ? parseEuro(goalRaw) : 0;
    if (bad || goal == null) {
      const target = bad ? (!bad.name ? bad.input.closest('.setup-row').querySelector('[name=name]') : bad.input) : form.goal;
      target.setAttribute('aria-invalid', 'true');
      errorBox.textContent = bad && !bad.name ? 'Dai un nome a ogni conto.' : 'Scrivi gli importi in euro, per esempio 150 oppure 1.250,50.';
      errorBox.hidden = false;
      target.focus();
      return;
    }
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      await call('setup', { accounts: accounts.map((a) => ({ kind: a.kind, name: a.name, opening_cents: parseEuro(a.raw) ?? 0 })), goal_cents: goal });
      await refresh();
      toast('Margine è pronto.');
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      button.disabled = false;
    }
  });
  preview();
  list.querySelector('[name=balance]').focus();
}

export const VIEWS = { dashboard, transazioni: transactions, risparmi: savings, setup };
