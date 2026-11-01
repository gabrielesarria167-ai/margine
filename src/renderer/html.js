// Tagged template that escapes every interpolation unless it is already-built markup.
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const out = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(out).join('') : v == null || v === false ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]));
export const raw = (s) => new Raw(s);
export const html = (strings, ...vals) => raw(strings.reduce((acc, s, i) => acc + s + (i < vals.length ? out(vals[i]) : ''), ''));
