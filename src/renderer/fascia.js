// La fascia: patrimonio drawn to scale as one band. Stone = protected, green = spendable.
// previewSpend() is the signature move: an amount being typed eats into the band from the right,
// and the part that crosses into stone turns into a red exception stretch.
import { formatEuro } from '../ledger.js';
import { html } from './html.js';

let el, track, cut, cutLabel, cross, crossLabel, mark;
let current = null;
let lastSpend = 0;

export function mountFascia(root) {
  el = root;
  el.innerHTML = `
    <div class="fascia-track"></div>
    <div class="fascia-cut" aria-hidden="true"><div class="fascia-cut-label"><span class="seg-label">Spesa</span><span class="seg-amount"></span></div></div>
    <div class="fascia-cross" aria-hidden="true"><div class="fascia-cross-label"><span class="seg-label">Dal risparmio</span><span class="seg-amount"></span></div></div>
    <div class="fascia-mark" aria-hidden="true"></div>`;
  track = el.querySelector('.fascia-track');
  cut = el.querySelector('.fascia-cut');
  cutLabel = el.querySelector('.fascia-cut-label');
  cross = el.querySelector('.fascia-cross');
  crossLabel = el.querySelector('.fascia-cross-label');
  mark = el.querySelector('.fascia-mark');
  el.setAttribute('role', 'img');
  addEventListener('resize', () => { fitSegments(); previewSpend(lastSpend); });
}

const scaleOf = (t) => Math.max(t.P, t.S);

function describe(t) {
  if (!scaleOf(t)) return 'Nessun saldo registrato.';
  const parts = [`Patrimonio ${formatEuro(t.P)}`];
  if (t.S) parts.push(`${formatEuro(Math.min(t.P, t.S))} protetti`);
  if (t.F) parts.push(`${t.status === 'deficit' ? 'deficit di' : 'mancano'} ${formatEuro(t.F)}`);
  parts.push(`${formatEuro(t.D)} spendibili`);
  return `${parts.join(', ')}.`;
}

export function renderFascia(t) {
  current = t;
  el.setAttribute('aria-label', describe(t));
  const scale = scaleOf(t);
  if (!scale) {
    track.innerHTML = html`<div class="fascia-empty">Nessun saldo registrato</div>`;
  } else {
    const segs = [
      // Below the goal the stone stretch is only the covered part; "Protetto" always means the whole goal.
      ['protected', t.F ? 'Coperto' : 'Protetto', Math.min(t.P, t.S)],
      [t.status === 'deficit' ? 'deficit' : 'missing', t.status === 'deficit' ? 'Deficit' : 'Mancano', t.F],
      ['spendable', 'Spendibile', t.D],
    ].filter(([, , amount]) => amount > 0);
    track.innerHTML = html`${segs.map(([cls, label, amount]) => html`
      <div class="seg seg--${cls}" data-kind="${cls}" data-w="${(amount / scale) * 100}" aria-hidden="true">
        <span class="seg-text"><span class="seg-label">${label}</span><span class="seg-amount">${formatEuro(amount)}</span></span>
      </div>`)}`;
    // CSP forbids inline style attributes, so widths are set through the CSSOM.
    track.querySelectorAll('[data-w]').forEach((s) => { s.style.width = `${s.dataset.w}%`; });
    fitSegments();
  }
  previewSpend(lastSpend);
}

// Every stretch keeps its label and amount. It tries full, tight and compact type inside itself; a stretch
// too narrow even for that sets its message beside it, inside the neighbouring stretch against their shared
// edge, so the band stays drawn to scale.
function fitSegments() {
  const segs = [...track.querySelectorAll('.seg')];
  segs.forEach((seg) => seg.classList.remove('is-host-start'));
  let left = 0;
  segs.forEach((seg, i) => {
    const w = Number(seg.dataset.w);
    const text = seg.querySelector('.seg-text');
    text.className = 'seg-text';
    text.style.left = text.style.right = '';
    seg.classList.remove('is-tight', 'is-compact', 'is-out');
    const fits = () => {
      const cs = getComputedStyle(seg);
      return text.offsetWidth <= seg.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    };
    if (!fits()) {
      seg.classList.add('is-tight');
      if (!fits()) {
        seg.classList.replace('is-tight', 'is-compact');
        if (!fits()) {
          const before = segs[i - 1];
          const host = before ?? segs[i + 1];
          seg.classList.remove('is-compact'); // its text lives in the roomy host, so it keeps full size
          seg.classList.add('is-out'); // emptied: no padding, so the sliver keeps its true width
          text.classList.add('is-out', `on-${host.dataset.kind}`, before ? 'to-left' : 'to-right');
          if (before) text.style.right = `${100 - left}%`;
          else { text.style.left = `${left + w}%`; host.classList.add('is-host-start'); } // host's own text moves to its far end
        }
      }
    }
    left += w;
  });
}

// Every stretch keeps its own message: label + amount (full, then tight), else the amount, else a compact amount.
// Measured, not guessed, because the text width depends on the figure.
function fit(label, px, cents) {
  const name = label.querySelector('.seg-label');
  const amount = label.querySelector('.seg-amount');
  label.classList.remove('is-compact', 'is-tight');
  name.hidden = false;
  amount.hidden = false;
  if (label.offsetWidth <= px) return true;
  label.classList.add('is-tight'); // same message, one size smaller
  if (label.offsetWidth <= px) return true;
  name.hidden = true;
  if (label.offsetWidth <= px) return true;
  label.classList.add('is-compact');
  if (cents % 100 === 0) amount.textContent = `−${cents / 100} €`;
  amount.hidden = label.offsetWidth > px;
  return !amount.hidden;
}

export function previewSpend(amount) {
  lastSpend = amount || 0;
  const t = current;
  const scale = t ? scaleOf(t) : 0;
  if (!lastSpend || !scale || !t.P) {
    cut.style.clipPath = 'inset(0 0 0 100%)';
    cross.style.clipPath = 'inset(0 0 0 100%)';
    mark.style.opacity = '0';
    el.classList.remove('is-crossing');
    return;
  }
  const width = el.clientWidth;
  const end = (t.P / scale) * 100; // right edge of owned money
  const keep = (Math.max(0, t.P - lastSpend) / scale) * 100;
  const boundary = (Math.min(t.P, t.S) / scale) * 100; // where protected money starts
  const crossing = keep < boundary;

  const spent = Math.min(lastSpend, t.P);
  const fromFree = Math.min(spent, t.D); // the part that is ordinary spending
  const fromProtected = spent - fromFree; // the part that needs an exception
  const cutFrom = crossing ? boundary : keep;
  cut.style.clipPath = `inset(0 ${100 - end}% 0 ${keep}%)`;
  cutLabel.style.left = `${cutFrom}%`;
  cutLabel.querySelector('.seg-amount').textContent = `−${formatEuro(fromFree)}`;
  cutLabel.hidden = fromFree === 0;
  const cutFits = fromFree > 0 && fit(cutLabel, (width * (end - cutFrom)) / 100, fromFree);

  cross.style.clipPath = crossing ? `inset(0 ${100 - boundary}% 0 ${keep}%)` : `inset(0 ${100 - boundary}% 0 ${boundary}%)`;
  crossLabel.style.left = `${keep}%`;
  crossLabel.querySelector('.seg-amount').textContent = `−${formatEuro(fromProtected)}`;
  const crossPx = crossing ? (width * (boundary - keep)) / 100 : 0;
  // When the ordinary part is too narrow to carry any label, the red stretch names the whole expense if that fits.
  const name = crossLabel.querySelector('.seg-label');
  name.textContent = `Spesa ${formatEuro(spent)}, dal risparmio`;
  if (!(fromFree && !cutFits && fit(crossLabel, crossPx, fromProtected) && !name.hidden)) {
    name.textContent = 'Dal risparmio';
    crossLabel.querySelector('.seg-amount').textContent = `−${formatEuro(fromProtected)}`;
    fit(crossLabel, crossPx, fromProtected);
  }

  mark.style.transform = `translateX(${(width * keep) / 100 - 4}px)`;
  mark.style.opacity = '1';
  el.classList.toggle('is-crossing', crossing);
}
