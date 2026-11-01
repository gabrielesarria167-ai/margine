// App state and the IPC bridge. Every write goes through call() and is re-validated in the main process.
export const store = { state: null };

let renderFn = () => {};
export const setRender = (fn) => { renderFn = fn; };

export async function call(name, arg) {
  let r;
  try { r = await window.margine[name](arg); }
  catch { r = { ok: false, code: 'INTERNAL', message: 'Errore imprevisto. I dati non sono stati modificati.' }; }
  if (!r.ok) throw Object.assign(new Error(r.message), { code: r.code });
  return r.data;
}

export async function refresh() {
  store.state = await call('getState');
  renderFn();
}

let toastTimer;
export function toast(message) {
  const el = document.querySelector('.toast');
  el.querySelector('span').textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
}

const dayFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const dayYearFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const stampFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// 'YYYY-MM-DD' is a local calendar day; new Date('YYYY-MM-DD') would read it as UTC midnight.
const localDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const fmtDay = (iso) => {
  const d = localDay(iso);
  return (d.getFullYear() === new Date().getFullYear() ? dayFmt : dayYearFmt).format(d);
};
export const fmtDayYear = (iso) => dayYearFmt.format(localDay(iso));
export const fmtStamp = (ts) => stampFmt.format(new Date(ts));
