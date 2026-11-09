// Every action opens in one side sheet (a modal <dialog>) under the fascia, so the band stays visible and
// previews the effect of what is being typed. The main process re-validates everything on save.
import {
  formatEuro, parseEuro, totals, overflow, todayISO,
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, ACCOUNT_KINDS, EXCEPTION_TYPES,
} from '../ledger.js';
import { html } from './html.js';
import { icon } from './icons.js';
import { store, call, refresh, toast, fmtDayYear } from './store.js';
import { renderFascia, previewSpend } from './fascia.js';

const dlg = document.getElementById('sheet');
dlg.addEventListener('close', () => { previewSpend(0); if (store.state) renderFascia(store.state.totals); });
dlg.addEventListener('click', (e) => {
  if (e.target === dlg) dlg.close(); // click outside the sheet
  if (e.target.closest('[data-close]')) dlg.close();
});

// ---------- field builders ----------

const errorSlot = (name) => html`<p class="field-error" id="e-${name}" hidden></p>`;
const money = (name, label, { value = '', large = false, hint = '' } = {}) => html`
  <div class="field">
    <label for="f-${name}">${label}</label>
    ${hint ? html`<p class="hint" id="h-${name}">${hint}</p>` : ''}
    <span class="money ${large ? 'money--lg' : ''}"><input class="input" id="f-${name}" name="${name}" inputmode="decimal" autocomplete="off" value="${value}" aria-describedby="e-${name} ${hint ? `h-${name}` : ''}"></span>
    ${errorSlot(name)}
  </div>`;
const text = (name, label, value = '') => html`
  <div class="field"><label for="f-${name}">${label}</label><input class="input" id="f-${name}" name="${name}" value="${value}" maxlength="200" autocomplete="off" aria-describedby="e-${name}">${errorSlot(name)}</div>`;
const area = (name, label, value = '') => html`
  <div class="field"><label for="f-${name}">${label}</label><textarea class="textarea" id="f-${name}" name="${name}" maxlength="1000" aria-describedby="e-${name}">${value}</textarea>${errorSlot(name)}</div>`;
const select = (name, label, options, selected) => html`
  <div class="field"><label for="f-${name}">${label}</label><select class="select" id="f-${name}" name="${name}" aria-describedby="e-${name}">
    ${options.map(([v, l]) => html`<option value="${v}" ${String(v) === String(selected) ? 'selected' : ''}>${l}</option>`)}
  </select>${errorSlot(name)}</div>`;
const date = (name, label, value = todayISO()) => html`
  <div class="field"><label for="f-${name}">${label}</label><input class="input" type="date" id="f-${name}" name="${name}" value="${value}" aria-describedby="e-${name}">${errorSlot(name)}</div>`;

// Categories as pills (radio buttons) plus "Aggiungi la tua", which saves a new one and selects it.
const categoryPills = (kind, selected) => html`${store.state.categories[kind].map((c) => html`
  <label class="pill"><input type="radio" name="category" value="${c}" ${c === selected ? 'checked' : ''}>${c}</label>`)}`;
const categoryField = (kind, selected) => html`
  <fieldset class="cat-field">
    <legend>Categoria</legend>
    <div class="pills"><span class="pill-list">${categoryPills(kind, selected)}</span><button type="button" class="btn pill-add" data-cat-open>${icon('plus')}Aggiungi la tua</button></div>
    <div class="cat-new" hidden>
      <label for="f-newcat">Nome della nuova categoria</label>
      <div class="cat-new-row">
        <input class="input" id="f-newcat" maxlength="30" autocomplete="off" aria-describedby="e-newcat h-newcat">
        <button type="button" class="btn" data-cat-add>Aggiungi</button>
      </div>
      <p class="hint" id="h-newcat">Resta tra le categorie di ${kind === 'income' ? 'entrata' : 'spesa'} e compare nella dashboard.</p>
      <p class="field-error" id="e-newcat" hidden></p>
      <button type="button" class="btn btn--ghost cat-cancel" data-cat-cancel>Annulla</button>
    </div>
  </fieldset>`;

function wireCategories(form, kind) {
  const box = form.querySelector('.cat-new');
  const input = box.querySelector('input');
  const err = box.querySelector('.field-error');
  const opener = form.querySelector('[data-cat-open]');
  const addBtn = box.querySelector('[data-cat-add]');
  const show = (on) => {
    box.hidden = !on;
    opener.hidden = on;
    err.hidden = true;
    input.removeAttribute('aria-invalid');
    if (on) input.focus(); else { input.value = ''; opener.focus(); }
  };
  const add = async () => {
    addBtn.disabled = true;
    try {
      const name = await call('addCategory', { kind, name: input.value });
      const list = store.state.categories[kind];
      list.splice(list.length - 1, 0, name); // same order the database returns: before Altro
      form.querySelector('.pill-list').innerHTML = String(categoryPills(kind, name));
      show(false);
      form.dispatchEvent(new Event('input')); // forms that keep a draft pick up the new choice
      toast(`Categoria «${name}» aggiunta.`);
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    } finally { addBtn.disabled = false; }
  };
  opener.onclick = () => show(true);
  box.querySelector('[data-cat-cancel]').onclick = () => show(false);
  addBtn.onclick = add;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); } // never submit the whole form from here
    if (e.key === 'Escape') { e.preventDefault(); show(false); }
  });
}

const accountOptions = () => store.state.accounts.map((a) => [a.id, `${a.name} · ${formatEuro(a.balance_cents)}`]);
const accountById = (id) => store.state.accounts.find((a) => a.id === Number(id));
const signed = (c) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${formatEuro(Math.abs(c))}`;

// ---------- sheet plumbing ----------

function sheet({ title, body, foot }) {
  dlg.innerHTML = String(html`
    <form class="sheet-form" novalidate>
      <header class="sheet-head">
        <h2 id="sheet-title">${title}</h2>
        <button type="button" class="btn icon-btn" data-close aria-label="Chiudi">${icon('close')}</button>
      </header>
      <div class="sheet-body">${body}<p class="form-error" role="alert" hidden></p></div>
      <footer class="sheet-foot">${foot}</footer>
    </form>`);
  if (!dlg.open) dlg.showModal();
  const form = dlg.querySelector('form');
  form.querySelector('.sheet-body .input, .sheet-body .select, .sheet-body input, .sheet-body .textarea')?.focus();
  return form;
}

const footer = (label, { cls = 'btn--primary', back = null } = {}) => html`
  ${back ? html`<button type="button" class="btn spacer" data-back>${back}</button>` : html`<button type="button" class="btn spacer" data-close>Annulla</button>`}
  <button type="submit" class="btn ${cls}">${label}</button>`;

function clearErrors(form) {
  form.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field-error, .form-error').forEach((x) => { x.hidden = true; });
}
function showErrors(form, errors) {
  for (const [name, message] of errors) {
    form.elements[name]?.setAttribute('aria-invalid', 'true');
    const slot = form.querySelector(`#e-${name}`);
    if (slot) { slot.textContent = message; slot.hidden = false; }
  }
  form.elements[errors[0][0]]?.focus();
}
function formError(form, message) {
  const box = form.querySelector('.form-error');
  box.textContent = message;
  box.hidden = false;
}
const read = (form, draft) => {
  for (const el of form.elements) {
    if (!el.name || !(el.name in draft)) continue;
    if (el.type === 'radio') { if (el.checked) draft[el.name] = el.value; } else draft[el.name] = el.value;
  }
};

// Runs a save; on failure shows the message in the sheet and returns the error.
async function save(form, fn) {
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try { await fn(); return null; }
  catch (err) { formError(form, err.message); return err; }
  finally { button.disabled = false; button.removeAttribute('aria-busy'); }
}
async function done(message) {
  dlg.close();
  await refresh();
  toast(message);
}

// ---------- spesa, with the exception flow (doc §7) ----------

function expenseForm() {
  const s = store.state;
  const draft = {
    amount: '', description: '', category: EXPENSE_CATEGORIES[0], account_id: s.accounts[0].id, date: todayISO(), note: '',
    type: 'recover', expected: '', source: '', due: '', reason: '',
  };
  const A = () => parseEuro(draft.amount) ?? 0;
  const over = () => overflow(A(), s.totals.D);
  const payload = (exception) => ({
    amount_cents: A(), description: draft.description, category: draft.category, account_id: Number(draft.account_id),
    date: draft.date, note: draft.note, ...(exception ? { exception } : {}),
  });

  function details(message) {
    const form = sheet({
      title: 'Nuova spesa',
      body: html`
        ${money('amount', 'Importo', { value: draft.amount, large: true })}
        <p class="verdict" aria-live="polite"></p>
        ${text('description', 'Descrizione', draft.description)}
        ${categoryField('expense', draft.category)}
        ${select('account_id', 'Pagato con', accountOptions(), draft.account_id)}
        ${date('date', 'Data', draft.date)}
        ${area('note', 'Nota (facoltativa)', draft.note)}`,
      foot: footer('Registra spesa'),
    });
    wireCategories(form, 'expense');
    const verdict = form.querySelector('.verdict');
    const button = form.querySelector('[type=submit]');
    const update = () => {
      read(form, draft);
      const amount = A();
      const o = over();
      previewSpend(amount);
      verdict.classList.toggle('is-over', o > 0);
      verdict.innerHTML = String(!amount
        ? html`Adesso puoi spendere <strong>${formatEuro(s.totals.D)}</strong>.`
        : o
          ? html`Supera lo spendibile di <strong>${formatEuro(o)}</strong>. Per registrarla serve un'eccezione motivata.`
          : html`Dopo questa spesa restano <strong>${formatEuro(s.totals.D - amount)}</strong> spendibili.`);
      button.textContent = o ? "Continua con l'eccezione" : 'Registra spesa';
      button.className = `btn ${o ? 'btn--signal' : 'btn--primary'}`;
    };
    form.addEventListener('input', update);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      read(form, draft);
      const acc = accountById(draft.account_id);
      const errors = [];
      if (!A()) errors.push(['amount', 'Inserisci un importo maggiore di zero, per esempio 12,50.']);
      else if (A() > acc.balance_cents) errors.push(['amount', `Su ${acc.name} ci sono solo ${formatEuro(acc.balance_cents)}.`]);
      if (!draft.description.trim()) errors.push(['description', 'Scrivi a cosa si riferisce la spesa.']);
      if (!draft.date) errors.push(['date', 'Scegli la data della spesa.']);
      if (errors.length) return showErrors(form, errors);
      if (over()) return exception();
      const err = await save(form, () => call('addExpense', payload()));
      if (!err) done('Spesa registrata.');
      else if (err.code === 'EXCEPTION_REQUIRED') exception();
    });
    update();
    if (message) formError(form, message);
  }

  function exception() {
    if (!draft.expected) draft.expected = draft.amount; // usually you expect back what you spent
    const form = sheet({
      title: 'Spesa oltre lo spendibile',
      body: html`
        <div class="warning">${icon('alert')}<div>
          <p><strong>${formatEuro(A())}</strong> di spesa, di cui <strong>${formatEuro(over())}</strong> oltre lo spendibile.</p>
          <p>Questa parte verrà presa dal risparmio protetto. L'obiettivo resta ${formatEuro(s.totals.O)}: non viene ridotto per far sembrare la spesa ordinaria.</p>
        </div></div>
        <fieldset class="choice">
          <legend>Perché usi il risparmio?</legend>
          <label><input type="radio" name="type" value="recover" ${draft.type === 'recover' ? 'checked' : ''}><strong>${EXCEPTION_TYPES.recover}</strong><span>Spendi ora e prevedi di riavere la somma, per esempio da un cliente o da un progetto.</span></label>
          <label><input type="radio" name="type" value="emergency" ${draft.type === 'emergency' ? 'checked' : ''}><strong>${EXCEPTION_TYPES.emergency}</strong><span>Una spesa imprevista o necessaria che non verrà recuperata.</span></label>
        </fieldset>
        <div class="recover-fields" ${draft.type === 'recover' ? '' : 'hidden'}>
          ${money('expected', 'Importo da recuperare', { value: draft.expected })}
          ${text('source', 'Da chi lo recuperi', draft.source)}
          ${date('due', 'Data prevista di recupero', draft.due)}
        </div>
        ${area('reason', 'Motivazione', draft.reason)}`,
      foot: footer('Rivedi', { cls: 'btn--signal', back: 'Indietro' }),
    });
    const recoverFields = form.querySelector('.recover-fields');
    form.addEventListener('change', () => { read(form, draft); recoverFields.hidden = draft.type !== 'recover'; });
    form.querySelector('[data-back]').onclick = () => { read(form, draft); details(); };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearErrors(form);
      read(form, draft);
      const errors = [];
      if (draft.type === 'recover') {
        if (!parseEuro(draft.expected)) errors.push(['expected', "Inserisci quanto prevedi di recuperare."]);
        if (!draft.source.trim()) errors.push(['source', 'Indica un cliente, un progetto o un\'altra fonte.']);
        if (!draft.due) errors.push(['due', 'Scegli una data prevista.']);
      }
      if (!draft.reason.trim()) errors.push(['reason', 'Scrivi perché questa spesa usa il risparmio.']);
      if (errors.length) return showErrors(form, errors);
      confirm();
    });
  }

  function confirm() {
    const recover = draft.type === 'recover';
    const after = totals(s.totals.P - A(), s.goal);
    const afterLine = after.F
      ? `Patrimonio ${formatEuro(after.P)}, protetto ${formatEuro(after.S)}, ${after.status === 'deficit' ? 'deficit di' : 'mancano'} ${formatEuro(after.F)}`
      : `Patrimonio ${formatEuro(after.P)}, protetto ${formatEuro(after.S)}, spendibili ${formatEuro(after.D)}`;
    const form = sheet({
      title: "Conferma l'eccezione",
      body: html`
        <p class="verdict">Controlla prima di registrare. L'eccezione resterà nello storico delle transazioni.</p>
        <dl class="summary">
          <div><dt>Spesa</dt><dd>${formatEuro(A())} · ${draft.description}</dd></div>
          <div><dt>Dal risparmio protetto</dt><dd class="is-signal">${formatEuro(over())}</dd></div>
          <div><dt>Motivo</dt><dd>${EXCEPTION_TYPES[draft.type]}</dd></div>
          <div><dt>Motivazione</dt><dd>${draft.reason}</dd></div>
          ${recover ? html`<div><dt>Recupero previsto</dt><dd>${formatEuro(parseEuro(draft.expected))} da ${draft.source}, entro il ${fmtDayYear(draft.due)}</dd></div>` : ''}
          <div><dt>Dopo la spesa</dt><dd>${afterLine}</dd></div>
        </dl>`,
      foot: footer('Conferma e registra', { cls: 'btn--signal', back: 'Modifica' }),
    });
    form.querySelector('[data-back]').onclick = () => exception();
    form.querySelector('[type=submit]').focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ex = recover
        ? { type: 'recover', reason: draft.reason, expected_recovery_cents: parseEuro(draft.expected), recovery_source: draft.source, recovery_due: draft.due }
        : { type: 'emergency', reason: draft.reason };
      const err = await save(form, () => call('addExpense', payload(ex)));
      if (!err) done('Eccezione registrata.');
      else if (err.code === 'INVALID' && !over()) details(err.message);
    });
  }

  details();
}

// ---------- entrata ----------

function incomeForm() {
  const s = store.state;
  const form = sheet({
    title: 'Nuova entrata',
    body: html`
      ${money('amount', 'Importo ricevuto', { large: true })}
      <p class="verdict" aria-live="polite"></p>
      ${text('description', 'Provenienza')}
      ${categoryField('income', INCOME_CATEGORIES[0])}
      ${select('account_id', 'Ricevuto su', accountOptions(), (s.accounts.find((a) => a.kind === 'bank') ?? s.accounts[0]).id)}
      ${date('date', 'Data di ricezione')}
      ${area('note', 'Nota (facoltativa)')}
      <p class="hint">Registra solo denaro già incassato: le entrate previste non fanno parte del patrimonio.</p>`,
    foot: footer('Registra entrata'),
  });
  wireCategories(form, 'income');
  const verdict = form.querySelector('.verdict');
  const update = () => {
    const amount = parseEuro(form.amount.value) ?? 0;
    const t = totals(s.totals.P + amount, s.goal);
    renderFascia(t);
    verdict.innerHTML = String(!amount
      ? html`Lo spendibile adesso è <strong>${formatEuro(s.totals.D)}</strong>.`
      : t.F
        ? html`Mancheranno <strong>${formatEuro(t.F)}</strong> all'obiettivo.`
        : html`Lo spendibile salirà a <strong>${formatEuro(t.D)}</strong>. L'obiettivo non cambia.`);
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const amount = parseEuro(form.amount.value);
    const errors = [];
    if (!amount) errors.push(['amount', 'Inserisci un importo maggiore di zero, per esempio 250.']);
    if (!form.description.value.trim()) errors.push(['description', 'Scrivi da chi o da cosa arriva il denaro.']);
    if (!form.date.value) errors.push(['date', 'Scegli la data di ricezione.']);
    if (errors.length) return showErrors(form, errors);
    const err = await save(form, () => call('addIncome', {
      amount_cents: amount, description: form.description.value, account_id: Number(form.account_id.value),
      category: form.category.value, date: form.date.value, note: form.note.value,
    }));
    if (!err) done('Entrata registrata.');
  });
  update();
}

// ---------- trasferimento ----------

function transferForm() {
  const s = store.state;
  if (s.accounts.length < 2) {
    sheet({
      title: 'Trasferimento',
      body: html`<p class="verdict">Per spostare denaro servono almeno due conti, per esempio contanti e conto bancario.</p>`,
      foot: html`<button type="button" class="btn spacer" data-close>Annulla</button><button type="button" class="btn btn--primary" data-open="account">Aggiungi un conto</button>`,
    });
    return;
  }
  const from = s.accounts.find((a) => a.kind !== 'cash') ?? s.accounts[0];
  const to = s.accounts.find((a) => a.id !== from.id);
  const form = sheet({
    title: 'Trasferimento',
    body: html`
      ${money('amount', 'Importo', { large: true })}
      <div class="row-2">
        ${select('account_id', 'Da', accountOptions(), from.id)}
        ${select('to_account_id', 'A', accountOptions(), to.id)}
      </div>
      <p class="verdict" aria-live="polite"></p>
      ${date('date', 'Data')}
      ${area('note', 'Nota (facoltativa)')}`,
    foot: footer('Registra trasferimento'),
  });
  const verdict = form.querySelector('.verdict');
  const update = () => {
    const amount = parseEuro(form.amount.value) ?? 0;
    const a = accountById(form.account_id.value), b = accountById(form.to_account_id.value);
    verdict.innerHTML = String(amount && a.id !== b.id
      ? html`Sposti <strong>${formatEuro(amount)}</strong> da ${a.name} a ${b.name}. Il patrimonio non cambia.`
      : html`Un trasferimento non è né un'entrata né una spesa: cambia solo dove si trova il denaro.`);
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const amount = parseEuro(form.amount.value);
    const a = accountById(form.account_id.value), b = accountById(form.to_account_id.value);
    const errors = [];
    if (!amount) errors.push(['amount', 'Inserisci un importo maggiore di zero.']);
    else if (amount > a.balance_cents) errors.push(['amount', `Su ${a.name} ci sono solo ${formatEuro(a.balance_cents)}.`]);
    if (a.id === b.id) errors.push(['to_account_id', 'Scegli due conti diversi.']);
    if (!form.date.value) errors.push(['date', 'Scegli una data.']);
    if (errors.length) return showErrors(form, errors);
    const err = await save(form, () => call('addTransfer', {
      amount_cents: amount, account_id: a.id, to_account_id: b.id, date: form.date.value, note: form.note.value,
    }));
    if (!err) done('Trasferimento registrato.');
  });
  update();
}

// ---------- obiettivo ----------

function goalForm() {
  const s = store.state;
  const form = sheet({
    title: 'Nuovo obiettivo di risparmio',
    body: html`
      ${money('amount', 'Obiettivo', { large: true, hint: `Attuale: ${formatEuro(s.totals.O)}. Può superare il patrimonio di oggi.` })}
      <p class="verdict" aria-live="polite"></p>
      ${area('note', 'Nota (facoltativa)')}`,
    foot: footer('Fissa obiettivo'),
  });
  const verdict = form.querySelector('.verdict');
  const update = () => {
    const goal = parseEuro(form.amount.value);
    if (goal == null) { renderFascia(s.totals); verdict.textContent = 'Scrivi quanto vuoi tenere da parte.'; return; }
    const t = totals(s.totals.P, goal ? { amount_cents: goal, reached_at: s.totals.P >= goal ? 'now' : null } : null);
    renderFascia(t);
    verdict.innerHTML = String(!goal
      ? html`Senza obiettivo tutto il patrimonio diventa spendibile: <strong>${formatEuro(t.D)}</strong>.`
      : t.F
        ? html`Lo spendibile scende a <strong>${formatEuro(0)}</strong> finché mancano <strong>${formatEuro(t.F)}</strong>.`
        : html`Resteranno spendibili <strong>${formatEuro(t.D)}</strong>.`);
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const goal = parseEuro(form.amount.value);
    if (goal == null) return showErrors(form, [['amount', 'Scrivi un importo in euro, anche 0 per non proteggere nulla.']]);
    const err = await save(form, () => call('setGoal', { amount_cents: goal, note: form.note.value }));
    if (!err) done('Obiettivo aggiornato.');
  });
  update();
}

// ---------- verifica saldo (doc §10) ----------

function checkForm() {
  const s = store.state;
  const form = sheet({
    title: 'Verifica saldo',
    body: html`
      ${select('account_id', 'Conto', accountOptions(), s.accounts[0].id)}
      ${money('counted', 'Saldo verificato', { large: true, hint: "Quanto hai contato nel portafoglio o letto nell'app della banca." })}
      <p class="verdict" aria-live="polite"></p>
      <div class="reason-field" hidden>${area('reason', 'Motivazione della rettifica')}</div>`,
    foot: footer('Registra controllo'),
  });
  const verdict = form.querySelector('.verdict');
  const reasonField = form.querySelector('.reason-field');
  const diffNow = () => {
    const counted = parseEuro(form.counted.value);
    return counted == null ? null : counted - accountById(form.account_id.value).balance_cents;
  };
  const update = () => {
    const acc = accountById(form.account_id.value);
    const diff = diffNow();
    reasonField.hidden = !diff;
    renderFascia(totals(s.totals.P + (diff ?? 0), s.goal));
    verdict.innerHTML = String(diff == null
      ? html`Saldo registrato su ${acc.name}: <strong>${formatEuro(acc.balance_cents)}</strong>.`
      : diff
        ? html`Registrato ${formatEuro(acc.balance_cents)}: differenza di <strong>${signed(diff)}</strong>. Verrà registrata una rettifica, i movimenti passati non cambiano.`
        : html`Corrisponde al saldo registrato. Verrà annotato solo il controllo.`);
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const counted = parseEuro(form.counted.value);
    if (counted == null) return showErrors(form, [['counted', 'Scrivi il saldo che hai verificato, anche 0.']]);
    const diff = diffNow();
    if (diff && !form.reason.value.trim()) return showErrors(form, [['reason', 'Spiega da cosa nasce la differenza.']]);
    const err = await save(form, () => call('checkBalance', { account_id: Number(form.account_id.value), counted_cents: counted, reason: form.reason.value }));
    if (!err) done(diff ? 'Rettifica registrata.' : 'Controllo registrato.');
  });
  update();
}

// ---------- conto ----------

function accountForm() {
  const form = sheet({
    title: 'Nuovo conto',
    body: html`
      ${select('kind', 'Tipo', Object.entries(ACCOUNT_KINDS), 'digital')}
      <div class="name-field">${text('name', 'Nome', ACCOUNT_KINDS.digital)}</div>
      ${money('opening', 'Saldo attuale', { hint: 'Verrà registrato come saldo iniziale.' })}`,
    foot: footer('Aggiungi conto'),
  });
  // Contanti and Conto bancario keep their fixed names; only a card or digital account is named.
  const nameField = form.querySelector('.name-field');
  const named = () => form.kind.value === 'digital';
  form.kind.addEventListener('change', () => { nameField.hidden = !named(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const opening = form.opening.value.trim() ? parseEuro(form.opening.value) : 0;
    const errors = [];
    if (named() && !form.name.value.trim()) errors.push(['name', 'Dai un nome al conto.']);
    if (opening == null) errors.push(['opening', 'Scrivi un importo in euro, per esempio 120,50.']);
    if (errors.length) return showErrors(form, errors);
    const err = await save(form, () => call('createAccount', { kind: form.kind.value, name: named() ? form.name.value : ACCOUNT_KINDS[form.kind.value], opening_cents: opening }));
    if (!err) done('Conto aggiunto.');
  });
}

const FORMS = { expense: expenseForm, income: incomeForm, transfer: transferForm, goal: goalForm, check: checkForm, account: accountForm };

export function openForm(kind) {
  if (!store.state?.accounts.length || !FORMS[kind]) return;
  previewSpend(0);
  renderFascia(store.state.totals);
  FORMS[kind]();
}
