// PICTURES for the fishing questions, drawn as SVG text (no page needed, so node tests can check them):
//   rulerPic   a wooden ruler with the fish laid along it from its nose at 0, the keeper limit as a red line
//   barsPic    fraction bars: each length as a bar cut into its parts, the parts it has shaded, all to one scale
//   weighPic   two weights laid end to end on a pound scale: how much together
//   tablePic   a ratio table (rows that grow by the same "times" in every column)
//   groupsPic  fish in groups of n, one kept from each group ("keep 1 in every 4")
// Every picture is a <svg class="pic" viewBox="0 0 320 h">. Numbers with fractions are drawn stacked (3 over 4).
import { fr, simplest, value, fracText, partsWord } from './frac.js';

export const INK = '#2b2219', RED = '#b0401f', GREEN = '#3f6e22', WOOD = '#8a5a32', RULER = '#f0cc68';
const FONT = 'font-family="Bitter, Georgia, serif" font-weight="700"';
const r1 = (v) => Math.round(v * 10) / 10;

// ── text with stacked fractions ─────────────────────────────────────────────────────────────────────────────────────
// "1 1/4 ft" -> pieces: [{ t: '1 ' }, { f: ['1', '4'] }, { t: ' ft' }]
function pieces(s) {
  const out = [], re = /(\d+)\/(\d+)/g; let last = 0, m;
  while ((m = re.exec(s))) { if (m.index > last) out.push({ t: s.slice(last, m.index) }); out.push({ f: [m[1], m[2]] }); last = m.index + m[0].length; }
  if (last < s.length) out.push({ t: s.slice(last) });
  return out;
}
const CH = 0.56;    // about how wide a character of the bold serif is, in ems
// how wide the text will be (px)
export function textWidth(s, size = 16) {
  return pieces(String(s)).reduce((w, p) => w + (p.t !== undefined ? p.t.length * size * CH : Math.max(p.f[0].length, p.f[1].length) * size * 0.72 * CH + 4), 0);
}
// text at x (anchor: start | middle | end), y its baseline; fractions stacked about the middle of the lower-case letters
export function stext(x, y, s, { size = 16, anchor = 'middle', fill = INK, weight = 700 } = {}) {
  s = String(s);
  const w = textWidth(s, size); let cx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const mid = y - size * 0.33, fs = size * 0.72;
  let out = '';
  for (const p of pieces(s)) {
    if (p.t !== undefined) {
      if (p.t.trim()) out += `<text x="${r1(cx)}" y="${r1(y)}" ${FONT} font-weight="${weight}" font-size="${size}" fill="${fill}" xml:space="preserve">${p.t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
      cx += p.t.length * size * CH;
    } else {
      const fw = Math.max(p.f[0].length, p.f[1].length) * fs * CH + 4, c = cx + fw / 2;
      out += `<text x="${r1(c)}" y="${r1(mid - 2.5)}" text-anchor="middle" ${FONT} font-size="${r1(fs)}" fill="${fill}">${p.f[0]}</text>`;
      out += `<line x1="${r1(cx + 1)}" y1="${r1(mid)}" x2="${r1(cx + fw - 1)}" y2="${r1(mid)}" stroke="${fill}" stroke-width="${size > 15 ? 1.6 : 1.2}"/>`;
      out += `<text x="${r1(c)}" y="${r1(mid + fs * 0.8 + 1)}" text-anchor="middle" ${FONT} font-size="${r1(fs)}" fill="${fill}">${p.f[1]}</text>`;
      cx += fw;
    }
  }
  return out;
}

// a fish seen from the side, nose at x0, tail at x1, its middle at y, h tall
export function fishSvg(x0, x1, y, colour = '#7d8a4e', h = null) {
  const L = Math.max(4, x1 - x0); h = h || Math.max(5, Math.min(L * 0.26, 15));
  const b = (dx, dy) => `${r1(x0 + dx)} ${r1(y + dy)}`;
  return `<path d="M${b(0, 0)} Q${b(L * 0.34, -h)} ${b(L * 0.8, -h * 0.22)} L${b(L, -h * 0.62)} L${b(L * 0.93, 0)} L${b(L, h * 0.62)} L${b(L * 0.8, h * 0.22)} Q${b(L * 0.34, h)} ${b(0, 0)} Z" fill="${colour}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`
    + `<circle cx="${r1(x0 + Math.min(L * 0.1, 7))}" cy="${r1(y - h * 0.18)}" r="${r1(Math.max(1.4, Math.min(h * 0.14, 2.4)))}" fill="${INK}"/>`;
}

// ── the ruler ────────────────────────────────────────────────────────────────────────────────────────────────────────
// unit 'ft' | 'in'; from..to: the stretch shown (fractions of the unit; plain numbers are wholes); parts: tick marks to
// one unit (4: quarters); labelParts: which ticks get a number (default: as many as fit); marks: what lies along it:
//   { v (a fraction, in the ruler's unit), kind: 'fish' | 'limit', label, colour, red (the asked one drawn in red) }
// Fish lie in rows above the ruler, nose at `from` (0), in the order given; the limit is one red line across them all.
export function rulerPic({ unit = 'ft', from = 0, to = 1, parts = 4, labelParts = null, marks = [], note = '' }) {
  const f0 = typeof from === 'number' ? fr(from) : from, f1 = typeof to === 'number' ? fr(to) : to;
  const v0 = value(f0), v1 = value(f1), X0 = 22, X1 = 298, sx = (X1 - X0) / (v1 - v0), X = (v) => X0 + (v - v0) * sx;
  const fish = marks.filter((m) => m.kind === 'fish'), limits = marks.filter((m) => m.kind !== 'fish');
  const ROW = 30, top = limits.length ? 24 : 8, rulerY = top + fish.length * ROW + 6, H = rulerY + 26 + 30 + (note ? 18 : 0);
  let s = '';
  // the fish, a row each, with their lengths written after the tail (or before the nose when there is no room)
  fish.forEach((m, i) => {
    const y = top + i * ROW + ROW / 2, xe = X(value(m.v));
    s += fishSvg(X(v0 > 0 ? v0 : 0), xe, y, m.colour);
    if (m.label) {
      const w = textWidth(m.label, 15), room = X1 + 20 - xe;
      s += room > w + 6 ? stext(xe + 5, y + 5, m.label, { size: 15, anchor: 'start', fill: m.red ? RED : INK })
        : stext(xe - 6, y - 9, m.label, { size: 15, anchor: 'end', fill: m.red ? RED : INK });
    }
  });
  // the ruler: a yellow strip, ticks down from its top edge, numbers under it
  s += `<rect x="${X0 - 8}" y="${rulerY}" width="${X1 - X0 + 16}" height="26" rx="3" fill="${RULER}" stroke="#8a6a24" stroke-width="1.2"/>`;
  const n0 = Math.ceil(v0 * parts - 1e-9), n1 = Math.floor(v1 * parts + 1e-9);
  const every = labelParts || (() => { const room = (X1 - X0) / (n1 - n0 || 1); return room > 34 ? 1 : room > 17 ? 2 : room > 8 ? 4 : parts; })();
  for (let k = n0; k <= n1; k++) {
    const x = r1(X(k / parts)), whole = k % parts === 0, half = (2 * k) % parts === 0, len = whole ? 16 : half ? 12 : (4 * k) % parts === 0 ? 9 : 6;
    s += `<line x1="${x}" y1="${rulerY}" x2="${x}" y2="${rulerY + len}" stroke="${INK}" stroke-width="${whole ? 1.8 : 1.1}"/>`;
    if (k % every === 0 || whole) {
      const lab = unit === 'in' && !whole ? null : fracText(simplest(fr(k, parts)));
      if (lab !== null) s += stext(x, rulerY + 26 + 17, lab, { size: lab.includes('/') ? 15 : 14 });
    }
  }
  s += stext(X1 + 2, rulerY + 21, unit === 'ft' ? 'ft' : 'in.', { size: 11, anchor: 'end', fill: '#6d5320' });
  // the limit (or a marked spot): a red dashed line from above the fish down through the ruler
  for (const m of limits) {
    const x = r1(X(value(m.v))), col = m.colour || RED;
    s += `<line x1="${x}" y1="${top - 6}" x2="${x}" y2="${rulerY + 26}" stroke="${col}" stroke-width="2.4" stroke-dasharray="5 3"/>`;
    if (m.label) s += stext(Math.min(X1 - 10, Math.max(X0 + 30, x)), top - 9, m.label, { size: 14, fill: col });
  }
  if (note) s += stext(160, H - 6, note, { size: 13, fill: '#5a4632', weight: 600 });
  return `<svg class="pic" viewBox="0 0 320 ${H}">${s}</svg>`;
}

// ── fraction bars ────────────────────────────────────────────────────────────────────────────────────────────────────
// rows: [{ f (a fraction), label (left), colour, note (right, e.g. "= 16/24") }]; whole: how many units the bars span;
// common: also cut every bar (thin, dashed) into this many parts a unit, the shared bottom number
export function barsPic(rows, { whole = 1, common = null, unitLabel = '' } = {}) {
  const hasNote = rows.some((r) => r.note), X0 = 74, X1 = hasNote ? 252 : 304, ROW = 40, H = rows.length * ROW + 30;
  const sx = (X1 - X0) / whole;
  let s = '';
  rows.forEach((r, i) => {
    const y = 10 + i * ROW, h = 24, cut = r.f.d, filled = value(r.f);
    s += stext(X0 - 8, y + h / 2 + 6, r.label, { size: 15, anchor: 'end' });
    // the whole bar(s), then the shaded part, then the cuts
    s += `<rect x="${X0}" y="${y}" width="${r1(X1 - X0)}" height="${h}" fill="#fffaf0" stroke="${INK}" stroke-width="1.4"/>`;
    s += `<rect x="${X0}" y="${y}" width="${r1(Math.min(filled, whole) * sx)}" height="${h}" fill="${r.colour || '#d9a441'}" opacity="0.85"/>`;
    if (common) for (let k = 1; k < common * whole; k++) { const x = r1(X0 + k / common * sx); s += `<line x1="${x}" y1="${y + 3}" x2="${x}" y2="${y + h - 3}" stroke="${INK}" stroke-width="0.7" stroke-dasharray="2 2" opacity="0.6"/>`; }
    for (let k = 1; k < cut * whole; k++) { const x = r1(X0 + k / cut * sx), w = k % cut === 0; s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${INK}" stroke-width="${w ? 2.4 : 1.3}"/>`; }
    s += `<rect x="${X0}" y="${y}" width="${r1(X1 - X0)}" height="${h}" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
    if (r.note) s += stext(X1 + 8, y + h / 2 + 6, r.note, { size: 14, anchor: 'start', fill: r.noteColour || INK });
  });
  // the wholes along the bottom
  const yb = 10 + rows.length * ROW + 4;
  for (let k = 0; k <= whole; k++) s += stext(X0 + k * sx, yb + 10, String(k) + (k === whole && unitLabel ? ' ' + unitLabel : ''), { size: 13, fill: '#5a4632' });
  // a line down from the end of the first bar's shading, so the others can be held against it
  const xe = r1(X0 + Math.min(value(rows[0].f), whole) * sx);
  s += `<line x1="${xe}" y1="6" x2="${xe}" y2="${10 + rows.length * ROW - 12}" stroke="${RED}" stroke-width="1.8" stroke-dasharray="4 3"/>`;
  return `<svg class="pic" viewBox="0 0 320 ${H}">${s}</svg>`;
}

// ── two weights end to end ───────────────────────────────────────────────────────────────────────────────────────────
// a, b: { f, label, colour }; parts: cuts in a pound (the shared bottom number); total: the label under the bracket
export function weighPic(a, b, { parts = 4, total = '' } = {}) {
  const sum = value(a.f) + value(b.f), whole = Math.max(1, Math.ceil(sum - 1e-9)), X0 = 18, X1 = 302, sx = (X1 - X0) / whole;
  const y = 50, h = 26; let s = '';
  const xa = X0 + value(a.f) * sx, xb = xa + value(b.f) * sx;
  s += `<rect x="${X0}" y="${y}" width="${X1 - X0}" height="${h}" fill="#fffaf0" stroke="${INK}" stroke-width="1.4"/>`;
  s += `<rect x="${X0}" y="${y}" width="${r1(xa - X0)}" height="${h}" fill="${a.colour || '#d9a441'}" opacity="0.9"/>`;
  s += `<rect x="${r1(xa)}" y="${y}" width="${r1(xb - xa)}" height="${h}" fill="${b.colour || '#7d9a54'}" opacity="0.9"/>`;
  for (let k = 1; k < parts * whole; k++) { const x = r1(X0 + k / parts * sx), w = k % parts === 0; s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${INK}" stroke-width="${w ? 2.6 : 1}"/>`; }
  s += `<rect x="${X0}" y="${y}" width="${X1 - X0}" height="${h}" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
  // each weight's label over its stretch, kept inside the picture and clear of each other (a small weight's label
  // can't fit over its own stretch: it moves over, or the second one goes up a line)
  const wa = textWidth(a.label, 14), wb = textWidth(b.label, 14), keep = (x, w) => Math.min(X1 + 10 - w / 2, Math.max(X0 - 6 + w / 2, x));
  const la = keep((X0 + xa) / 2, wa); let lb = keep((xa + xb) / 2, wb), yb2 = y - 9;
  if (lb - wb / 2 < la + wa / 2 + 8) { lb = keep(la + wa / 2 + 8 + wb / 2, wb); if (lb - wb / 2 < la + wa / 2 + 4) { lb = keep((xa + xb) / 2, wb); yb2 = y - 27; } }
  s += stext(la, y - 9, a.label, { size: 14 }) + stext(lb, yb2, b.label, { size: 14 });
  for (let k = 0; k <= whole; k++) s += stext(X0 + k * sx, y + h + 15, k + (k === whole ? ' lb' : ''), { size: 13, fill: '#5a4632' });
  // the bracket under both: together
  const yb = y + h + 24;
  s += `<path d="M${X0} ${yb} v6 H${r1(xb)} v-6" fill="none" stroke="${GREEN}" stroke-width="2"/>`;
  if (total) s += stext(keep((X0 + xb) / 2, textWidth(total, 15)), yb + 26, total, { size: 15, fill: GREEN });
  return `<svg class="pic" viewBox="0 0 320 ${yb + 34}">${s}</svg>`;
}

// ── a ratio table ────────────────────────────────────────────────────────────────────────────────────────────────────
// head: column names; rows: arrays of numbers (or '?'); hl: [row, col] drawn green (the answer) ; steps: the "× 2" by
// each row after the first (from the first row)
export function tablePic({ head, rows, hl = null, steps = [] }) {
  const n = head.length, X0 = 56, cw = Math.min(88, (300 - X0) / n), RH = 30, H = (rows.length + 1) * RH + 12;
  let s = '';
  head.forEach((h, j) => { s += stext(X0 + cw * j + cw / 2, 24, h, { size: 15, fill: '#4a2f17' }); });
  s += `<line x1="${X0}" y1="${RH + 2}" x2="${X0 + cw * n}" y2="${RH + 2}" stroke="${INK}" stroke-width="1.6"/>`;
  rows.forEach((row, i) => {
    const y = RH * (i + 1) + 6;
    row.forEach((v, j) => {
      const on = hl && hl[0] === i && hl[1] === j;
      if (on) s += `<rect x="${X0 + cw * j + 6}" y="${y + 2}" width="${cw - 12}" height="${RH - 6}" rx="6" fill="rgba(79,122,42,.22)" stroke="${GREEN}" stroke-width="1.6"/>`;
      s += stext(X0 + cw * j + cw / 2, y + 20, String(v), { size: 17, fill: on ? GREEN : v === '?' ? RED : INK });
    });
    if (i > 0 && steps[i - 1]) s += stext(X0 - 8, y + 19, steps[i - 1], { size: 13, anchor: 'end', fill: '#8a5a28' });
  });
  for (let j = 1; j < n; j++) s += `<line x1="${X0 + cw * j}" y1="8" x2="${X0 + cw * j}" y2="${H - 6}" stroke="${INK}" stroke-width="0.8" opacity="0.4"/>`;
  return `<svg class="pic" viewBox="0 0 320 ${H}">${s}</svg>`;
}

// ── groups: keep 1 in every n ────────────────────────────────────────────────────────────────────────────────────────
export function groupsPic({ per, groups, colour = '#7d8a4e' }) {
  const fishW = 22, gap = 10, perRow = Math.max(1, Math.floor((300 + gap) / (per * (fishW + 2) + gap + 6))), rows = Math.ceil(groups / perRow);
  const gw = per * (fishW + 2) + 6, H = rows * 34 + 8; let s = '';
  for (let g = 0; g < groups; g++) {
    const gx = 10 + (g % perRow) * (gw + gap), gy = 6 + Math.floor(g / perRow) * 34;
    s += `<rect x="${gx}" y="${gy}" width="${gw}" height="26" rx="6" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="3 2" opacity="0.6"/>`;
    for (let i = 0; i < per; i++) {
      const x = gx + 4 + i * (fishW + 2);
      s += fishSvg(x, x + fishW - 2, gy + 13, i === 0 ? colour : '#c9bba0', 6);
      if (i === 0) s += `<circle cx="${x + fishW / 2 - 1}" cy="${gy + 13}" r="11" fill="none" stroke="${GREEN}" stroke-width="2"/>`;
    }
  }
  return `<svg class="pic" viewBox="0 0 320 ${H}">${s}</svg>`;
}

export { partsWord };
