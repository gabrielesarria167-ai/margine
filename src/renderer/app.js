import { html } from './html.js';
import { icon } from './icons.js';
import { store, refresh, setRender } from './store.js';
import { mountFascia, renderFascia } from './fascia.js';
import { VIEWS } from './views.js';
import { openForm } from './forms.js';

const NAV = [['dashboard', 'Dashboard', 'dashboard'], ['transazioni', 'Transazioni', 'transactions'], ['risparmi', 'Risparmi', 'shield']];
const appEl = document.querySelector('.app');
const main = document.querySelector('main');
const sheet = document.getElementById('sheet');

document.querySelector('.rail').innerHTML = String(html`
  <p class="wordmark"><span class="wordmark-mark" aria-hidden="true"><i></i><i></i></span>Margine</p>
  <div class="nav">${NAV.map(([route, label, ic]) => html`<a href="#/${route}" data-route="${route}">${icon(ic)}${label}</a>`)}</div>
  <div class="rail-foot"><button class="btn btn--primary btn--rail" data-open="expense">${icon('plus')}Nuova spesa</button></div>`);
document.querySelector('.toast').innerHTML = String(html`${icon('done')}<span></span>`);
mountFascia(document.querySelector('.fascia'));

let lastRoute = null;
setRender(() => {
  const s = store.state;
  const isSetup = !s.accounts.length;
  const asked = location.hash.slice(2);
  const route = isSetup ? 'setup' : VIEWS[asked] && asked !== 'setup' ? asked : 'dashboard';
  appEl.toggleAttribute('data-setup', isSetup);
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (!sheet.open) renderFascia(s.totals);
  const scroll = route === lastRoute ? main.scrollTop : 0;
  main.onscroll = null;
  VIEWS[route](main, s);
  main.scrollTop = scroll;
  if (route !== lastRoute && lastRoute) main.focus({ preventScroll: true });
  lastRoute = route;
});

addEventListener('hashchange', () => refresh());
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open]');
  if (opener) openForm(opener.dataset.open);
});

refresh().catch((err) => {
  main.innerHTML = String(html`<div class="view"><p class="form-error" role="alert">Impossibile aprire i dati di Margine: ${err.message}</p></div>`);
});
