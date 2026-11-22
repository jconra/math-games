// THE SURVEY TABLE'S PICTURES: what the surveyor's cards show (src/jobs/survey.js), drawn the way every card's picture
// is in this game, dark with light lines (src/jobs/pics.js NIGHT; the game's maker, 2026-11-18: "This is a space game,
// we don't need a bunch of white graphs on the screen. Try to keep things 'dark mode'"). Each drawing is plain svg text
// made from a card's own facts, so the card carries it ready made (o.lead on the card, help.svg in Help) and node can
// check it. The Explorer's survey table is a holo table (kit/shipparts/cabin/science.js): a hologram of the land in the
// station's shield blue, with glowing contour lines; the scan and the map here are drawn in that blue.
//
//   scanPic({ items, dim, title })            the scan's window over the land: each find a small picture (ice a blue
//                                             hexagon, metal an amber lump, a crystal a violet gem); dim: a kind to
//                                             leave bright, the others dimmed (Help: "count only the ice")
//   kindRows({ items })                       the same finds lined up by kind, one row each, no numbers (Help: which has most)
//   rowsPic({ title, kind, rows, key, hi, match })   a picture chart: a row of pictures for each place; key: what one
//                                             picture stands for (1, 2, 5, 10); hi: rows lit; match: the two rows lit
//                                             matched one to one, the ones left over ringed (Help: how many more)
//   barPic({ title, unit, bars, step, top, hi, dash, bracket })   a bar chart, the scale up the left side counted by
//                                             `step`; hi: bars lit; dash: a dashed line from the top of those bars
//                                             across to the scale, a "?" there; bracket: two bars, the gap between
//                                             their tops marked "?"
//   dotsPic({ title, unit, lo, hi, counts, lit })    a line plot: a dot over the number line for each thing measured
//   linePic({ title, unit, points, step, top, hi })  a line graph of a reading through the day
//   readingsPic({ title, unit, values, avg, missing })   the readings as bars with their numbers on them; avg: a dashed
//                                             line across them marked "?" (Help: level them out); missing: the bar not
//                                             known, dashed, "?"
//   gridPic({ cols, rows, cells, kind, ring, title })    the squares a probe may land on, the ones with the find marked
//   pairPic({ a, b, kind })                   two probes at once: every square of one grid with every square of the
//                                             other, as a table; the pairs where both land on the find shaded
//   numberLine({ a, b, y })                   a line across the map from a to b, 0 marked (Help: how far apart)
//   landMap(map, { points, marks, ask, seed })   THE SURVEY MAP: the land below seen from straight above, its contour
//                                             lines, a grid of one unit a line, the Explorer over (0, 0); points
//                                             [{ x, y, kind, label }], marks (the panel's taps: 'aim', 'miss', 'field');
//                                             drawn in the frame of the pilot's map (pics.js mapFrame), so the panel's
//                                             tap (pics.js mapSpot) reads it the same way
//   surveyLink()                              the job panel's `live` for this job (src/jobs/panel.js): the card's top
//                                             ("Survey table") and the job's own small stylesheet
import { NIGHT as K, mapFrame } from './pics.js';

const f = (v) => (Math.round(v * 10) / 10).toString();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const W = 360;
const svg = (w, h, body, label = '') => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg"${label ? ` aria-label="${esc(label)}"` : ''}>${body}</svg>`;
const text = (x, y, s, { size = 12, fill = K.INK, weight = 600, anchor = 'middle' } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="system-ui, sans-serif">${esc(s)}</text>`;

// the colours of the finds and of the table's hologram
export const COLOUR = { ice: '#6fc3ff', metal: '#ffab45', crystal: '#d79bff', holo: '#4fb6ff', contour: '#2c6f93', lit: K.ASK };

// ── a find's picture ────────────────────────────────────────────────────────────────────────────────────────────────
export function icon(kind, x, y, r = 8, { dim = false } = {}) {
  const c = COLOUR[kind] || K.INK, op = dim ? ' opacity="0.22"' : '';
  if (kind === 'ice') {
    let d = ''; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; d += `${i ? 'L' : 'M'}${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)}`; }
    return `<path d="${d}Z" fill="${c}" fill-opacity="0.85" stroke="${K.INK}" stroke-width="0.9"${op}/>`;
  }
  if (kind === 'metal') {
    let d = ''; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, k = 0.82 + 0.18 * Math.abs(Math.sin(i * 2.3 + 1)); d += `${i ? 'L' : 'M'}${f(x + Math.cos(a) * r * k)} ${f(y + Math.sin(a) * r * k * 0.85)}`; }
    return `<path d="${d}Z" fill="${c}" fill-opacity="0.9" stroke="${K.INK}" stroke-width="0.9" stroke-linejoin="round"${op}/>`;
  }
  // a crystal: a gem, tall
  return `<path d="M${f(x)} ${f(y - r * 1.1)}L${f(x + r * 0.7)} ${f(y - r * 0.25)}L${f(x)} ${f(y + r * 1.1)}L${f(x - r * 0.7)} ${f(y - r * 0.25)}Z" fill="${c}" fill-opacity="0.88" stroke="${K.INK}" stroke-width="0.9"${op}/>`;
}

// the scan's frame: a dark window with cut corners, faint contour rings of the land under it
function scanFrame(w, h, seed = 1) {
  const c = 10;
  let s = `<rect width="${w}" height="${h}" fill="${K.CARD}"/>`;
  s += `<path d="M${c} 2H${w - c}L${w - 2} ${c}V${h - c}L${w - c} ${h - 2}H${c}L2 ${h - c}V${c}Z" fill="#0d1824" stroke="${COLOUR.holo}" stroke-opacity="0.55" stroke-width="1.2"/>`;
  s += contours(w, h, seed, 0.35);
  return s;
}
// contour rings round two or three hills, from a seed (the same seed, the same land)
function contours(w, h, seed, op = 0.5, clip = '') {
  let r = seed * 9301 + 49297, s = '';
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const hills = 2 + Math.floor(rnd() * 2);
  for (let k = 0; k < hills; k++) {
    const cx = w * (0.15 + 0.7 * rnd()), cy = h * (0.2 + 0.6 * rnd()), R = Math.min(w, h) * (0.25 + 0.25 * rnd()), ph = rnd() * 6;
    for (let ring = 1; ring <= 3; ring++) {
      const rr = R * ring / 3; let d = '';
      for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2, q = 1 + 0.16 * Math.sin(a * 3 + ph + ring) + 0.08 * Math.cos(a * 5 - ph); d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr * q * 1.25)} ${f(cy + Math.sin(a) * rr * q * 0.8)}`; }
      s += `<path d="${d}Z" fill="none" stroke="${COLOUR.contour}" stroke-width="1" opacity="${op}"${clip}/>`;
    }
  }
  return s;
}

// ── the scan's window, and the finds lined up by kind ─────────────────────────────────────────────────────────────
// items: [{ kind, x, y }] with x, y from 0 to 1 across the window
export function scanPic({ items = [], dim = null, title = '', seed = 3 } = {}) {
  const w = W, h = 150, top = title ? 18 : 0;
  let s = scanFrame(w, h + top, seed);
  if (title) s += text(14, 14, title, { size: 11, fill: K.SOFT, anchor: 'start' });
  for (const it of items) s += icon(it.kind, 20 + it.x * (w - 40), top + 18 + it.y * (h - 36), 12, { dim: !!dim && it.kind !== dim });
  return svg(w, h + top, s, 'the scan');
}
export function kindRows({ items = [], kinds = null } = {}) {
  const list = kinds || [...new Set(items.map((i) => i.kind))];
  const h = 26 + list.length * 30;
  let s = `<rect width="${W}" height="${h}" fill="${K.CARD}"/>`;
  list.forEach((k, r) => {
    const n = items.filter((i) => i.kind === k).length, y = 26 + r * 30;
    for (let i = 0; i < n; i++) s += icon(k, 30 + i * 26, y, 9);
  });
  s += text(W / 2, h - 4, 'one row for each kind', { size: 10, fill: K.SOFT });
  return svg(W, h, s, 'the finds lined up by kind');
}

// ── a picture chart ──────────────────────────────────────────────────────────────────────────────────────────────
// rows: [{ label, n }] (n pictures; with a key, n is the pictures, each standing for `key`)
export function rowsPic({ title = '', kind = 'ice', rows = [], key = 1, hi = [], match = false, count = null } = {}) {
  const lab = 84, step = 24, y0 = title ? 34 : 14, h = y0 + rows.length * 30 + (key > 1 ? 26 : 6);
  let s = `<rect width="${W}" height="${h}" fill="${K.CARD}"/>`;
  if (title) s += text(W / 2, 18, title, { size: 12, fill: K.INK, weight: 700 });
  const low = match && hi.length === 2 ? Math.min(rows[hi[0]].n, rows[hi[1]].n) : null;
  rows.forEach((row, r) => {
    const y = y0 + r * 30 + 12, lit = hi.includes(r);
    if (lit) s += `<rect x="4" y="${f(y - 13)}" width="${W - 8}" height="26" rx="4" fill="${K.FILL2}" opacity="0.55"/>`;
    s += text(lab - 8, y + 4, row.label, { size: 12, fill: lit ? K.ASK : K.INK, weight: 700, anchor: 'end' });
    s += `<path d="M${lab} ${f(y - 12)}V${f(y + 12)}" stroke="${K.GRID}" stroke-width="1"/>`;
    for (let i = 0; i < row.n; i++) {
      const x = lab + 14 + i * step;
      s += icon(kind, x, y, 9, { dim: hi.length > 0 && !lit });
      if (low != null && lit && i >= low) s += `<circle cx="${f(x)}" cy="${f(y)}" r="12" fill="none" stroke="${K.ASK}" stroke-width="1.6"/>`;
      if (count && lit && i < count.length) s += text(x, y + 22, count[i], { size: 9, fill: K.ASK, weight: 700 });
    }
  });
  if (key > 1) { const y = h - 12; s += icon(kind, W / 2 - 62, y - 3, 8) + text(W / 2 - 48, y + 1, `stands for ${key}`, { size: 11, fill: K.SOFT, anchor: 'start' }); }
  return svg(W, h, s, title || 'a picture chart');
}

// ── a bar chart ──────────────────────────────────────────────────────────────────────────────────────────────────
// bars: [{ label, v }]; the scale goes up by `step` to `top`
export function barPic({ title = '', unit = '', bars = [], step = 1, top = 10, hi = [], dash = [], bracket = null, kind = null } = {}) {
  const h = 200, x0 = 40, x1 = W - 12, y0 = h - 24, y1 = title ? 30 : 12, n = bars.length;
  const Y = (v) => y0 - (y0 - y1) * v / top, gap = (x1 - x0) / n, bw = Math.min(46, gap * 0.56);
  let s = `<rect width="${W}" height="${h}" fill="${K.CARD}"/>`;
  if (title) s += text(W / 2, 17, title, { size: 12, fill: K.INK, weight: 700 });
  const lines = Math.round(top / step), every = lines > 10 ? 2 : 1;
  for (let k = 0; k <= lines; k++) {
    const v = k * step, y = Y(v);
    s += `<path d="M${x0} ${f(y)}H${x1}" stroke="${k ? K.GRID : K.INK}" stroke-width="${k ? 0.8 : 1.4}"/>`;
    if (k % every === 0) s += text(x0 - 6, y + 4, String(v), { size: 10, fill: K.SOFT, anchor: 'end' });
  }
  s += `<path d="M${x0} ${f(y0)}V${f(y1 - 4)}" stroke="${K.INK}" stroke-width="1.4"/>`;
  if (unit) s += `<text transform="translate(11 ${f((y0 + y1) / 2)}) rotate(-90)" font-size="10" fill="${K.SOFT}" text-anchor="middle" font-family="system-ui, sans-serif">${esc(unit)}</text>`;
  const colour = kind ? COLOUR[kind] : COLOUR.holo;
  bars.forEach((b, i) => {
    const cx = x0 + gap * (i + 0.5), lit = hi.includes(i), y = Y(b.v);
    s += `<rect x="${f(cx - bw / 2)}" y="${f(y)}" width="${f(bw)}" height="${f(y0 - y)}" fill="${colour}" fill-opacity="${hi.length && !lit ? 0.25 : 0.75}" stroke="${lit ? K.ASK : K.INK}" stroke-width="${lit ? 2 : 1}"/>`;
    s += text(cx, y0 + 15, b.label, { size: 11, fill: lit ? K.ASK : K.INK, weight: 700 });
  });
  for (const i of dash) {
    const cx = x0 + gap * (i + 0.5), y = Y(bars[i].v);
    s += `<path d="M${f(cx - bw / 2)} ${f(y)}H${x0}" stroke="${K.ASK}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
  }
  if (dash.length === 1 && !bracket) s += `<circle cx="${x0}" cy="${f(Y(bars[dash[0]].v))}" r="9" fill="${K.CARD}" stroke="${K.ASK}" stroke-width="1.4"/>` + text(x0, Y(bars[dash[0]].v) + 4, '?', { size: 11, fill: K.ASK, weight: 800 });
  if (bracket) {
    const [a, b] = bracket, ya = Y(bars[a].v), yb = Y(bars[b].v), xb = x0 + gap * (Math.max(a, b) + 0.5) + bw / 2 + 8;
    // (a dashed line from each bar's top across to the bracket, the bracket between the two levels)
    for (const i of [a, b]) s += `<path d="M${f(x0 + gap * (i + 0.5) + bw / 2)} ${f(Y(bars[i].v))}H${f(xb)}" stroke="${K.ASK}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    s += `<path d="M${f(xb - 4)} ${f(ya)}H${f(xb + 4)}M${f(xb - 4)} ${f(yb)}H${f(xb + 4)}M${f(xb)} ${f(ya)}V${f(yb)}" stroke="${K.ASK}" stroke-width="1.6"/>`;
    s += text(Math.min(xb + 12, W - 6), (ya + yb) / 2 + 4, '?', { size: 13, fill: K.ASK, weight: 800 });
  }
  return svg(W, h, s, title || 'a bar chart');
}

// ── a line plot ──────────────────────────────────────────────────────────────────────────────────────────────────
// counts: { [value]: how many }, from lo to hi on the number line
export function dotsPic({ title = '', unit = '', lo = 1, hi = 9, counts = {}, lit = [] } = {}) {
  const most = Math.max(4, ...Object.values(counts)), h = 56 + most * 17 + (title ? 20 : 0), y0 = h - 34, x0 = 28, x1 = W - 28, n = hi - lo;
  const X = (v) => x0 + (x1 - x0) * (v - lo) / Math.max(1, n);
  let s = `<rect width="${W}" height="${h}" fill="${K.CARD}"/>`;
  if (title) s += text(W / 2, 17, title, { size: 12, fill: K.INK, weight: 700 });
  s += `<path d="M${x0 - 10} ${y0}H${x1 + 10}" stroke="${K.INK}" stroke-width="1.4"/>`;
  for (let v = lo; v <= hi; v++) {
    const x = X(v), on = lit.includes(v);
    if (on) s += `<rect x="${f(x - 11)}" y="${f(y0 - most * 17 - 8)}" width="22" height="${f(most * 17 + 30)}" rx="4" fill="${K.FILL2}" opacity="0.55"/>`;
    s += `<path d="M${f(x)} ${y0 - 4}V${y0 + 4}" stroke="${K.INK}" stroke-width="1.2"/>` + text(x, y0 + 17, String(v), { size: 11, fill: on ? K.ASK : K.INK, weight: 700 });
    for (let k = 0; k < (counts[v] || 0); k++) s += `<circle cx="${f(x)}" cy="${f(y0 - 12 - k * 17)}" r="6" fill="${COLOUR.crystal}" fill-opacity="0.85" stroke="${K.INK}" stroke-width="0.9"/>`;
  }
  if (unit) s += text(W / 2, h - 3, unit, { size: 10, fill: K.SOFT });
  return svg(W, h, s, title || 'a line plot');
}

// ── a line graph ─────────────────────────────────────────────────────────────────────────────────────────────────
// points: [{ label, v }] in order of time
export function linePic({ title = '', unit = '', points = [], step = 5, top = 30, hi = [] } = {}) {
  const h = 200, x0 = 40, x1 = W - 16, y0 = h - 24, y1 = title ? 30 : 12, n = points.length;
  const Y = (v) => y0 - (y0 - y1) * v / top, X = (i) => x0 + 18 + (x1 - x0 - 30) * i / Math.max(1, n - 1);
  let s = `<rect width="${W}" height="${h}" fill="${K.CARD}"/>`;
  if (title) s += text(W / 2, 17, title, { size: 12, fill: K.INK, weight: 700 });
  for (let v = 0; v <= top; v += step) s += `<path d="M${x0} ${f(Y(v))}H${x1}" stroke="${v ? K.GRID : K.INK}" stroke-width="${v ? 0.8 : 1.4}"/>` + text(x0 - 6, Y(v) + 4, String(v), { size: 10, fill: K.SOFT, anchor: 'end' });
  s += `<path d="M${x0} ${f(y0)}V${f(y1 - 4)}" stroke="${K.INK}" stroke-width="1.4"/>`;
  if (unit) s += `<text transform="translate(11 ${f((y0 + y1) / 2)}) rotate(-90)" font-size="10" fill="${K.SOFT}" text-anchor="middle" font-family="system-ui, sans-serif">${esc(unit)}</text>`;
  s += `<path d="M${points.map((p, i) => `${f(X(i))} ${f(Y(p.v))}`).join('L')}" fill="none" stroke="${COLOUR.holo}" stroke-width="2.2"/>`;
  points.forEach((p, i) => {
    const lit = hi.includes(i);
    if (lit) s += `<path d="M${f(X(i))} ${f(Y(p.v))}V${f(y0)}M${f(X(i))} ${f(Y(p.v))}H${x0}" stroke="${K.ASK}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
    s += `<circle cx="${f(X(i))}" cy="${f(Y(p.v))}" r="${lit ? 5 : 4}" fill="${lit ? K.ASK : COLOUR.holo}" stroke="${K.INK}" stroke-width="1"/>`;
    s += text(X(i), y0 + 15, p.label, { size: 10, fill: lit ? K.ASK : K.INK, weight: 700 });
  });
  return svg(W, h, s, title || 'a line graph');
}

// ── the readings as bars with their numbers ──────────────────────────────────────────────────────────────────────
export function readingsPic({ title = '', unit = '', values = [], avg = null, avgSaid = '', missing = null, sorted = false } = {}) {
  const h = 156, x0 = 16, x1 = W - 16, y0 = h - 22, y1 = title ? 44 : 22, n = values.length;
  const known = values.filter((v, i) => i !== missing), top = Math.max(...known) * 1.15 || 1;
  const Y = (v) => y0 - (y0 - y1) * v / top, gap = (x1 - x0) / n, bw = Math.min(40, gap * 0.6);
  let s = `<rect width="${W}" height="${h}" fill="${K.CARD}"/>`;
  if (title) s += text(W / 2, 17, title, { size: 12, fill: K.INK, weight: 700 });
  s += `<path d="M${x0} ${y0}H${x1}" stroke="${K.INK}" stroke-width="1.4"/>`;
  const vals = sorted ? [...values].sort((a, b) => a - b) : values;
  vals.forEach((v, i) => {
    const cx = x0 + gap * (i + 0.5), gone = i === missing, hgt = gone ? (y0 - y1) * 0.55 : y0 - Y(v);
    s += `<rect x="${f(cx - bw / 2)}" y="${f(y0 - hgt)}" width="${f(bw)}" height="${f(hgt)}" fill="${gone ? 'none' : COLOUR.holo}" fill-opacity="0.7" stroke="${gone ? K.ASK : K.INK}" stroke-width="${gone ? 1.6 : 1}"${gone ? ' stroke-dasharray="5 3"' : ''}/>`;
    s += text(cx, y0 - hgt - 6, gone ? '?' : String(v), { size: 12, fill: gone ? K.ASK : K.INK, weight: 800 });
  });
  // (the average's level, where the bars would all stand if they were levelled out: its number not written, unless the
  // card gives it already, a missing reading's)
  if (avg != null && avg !== false) s += `<path d="M${x0} ${f(Y(avg))}H${x1}" stroke="${K.ASK}" stroke-width="1.4" stroke-dasharray="6 4"/>` + text(x1 - 4, Y(avg) - 5, `the average: ${avgSaid || '?'}`, { size: 10, fill: K.ASK, weight: 700, anchor: 'end' });
  if (unit) s += text(W / 2, h - 5, unit, { size: 10, fill: K.SOFT });
  return svg(W, h, s, title || 'the readings');
}

// ── the squares a probe may land on ──────────────────────────────────────────────────────────────────────────────
// cells: [true | false] row by row (true: the find is there)
export function gridPic({ cols = 4, rows = 3, cells = [], kind = 'ice', ring = false, title = '', half = false, size = 30 } = {}) {
  const gw = cols * size, gh = rows * size, h = gh + (title ? 34 : 16) + (half ? 18 : 0), x0 = (W - gw) / 2, y0 = title ? 26 : 8;
  let s = `<rect width="${W}" height="${h}" fill="${K.CARD}"/>`;
  if (title) s += text(W / 2, 17, title, { size: 12, fill: K.INK, weight: 700 });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const on = !!cells[r * cols + c], x = x0 + c * size, y = y0 + r * size;
    s += `<rect x="${f(x + 1)}" y="${f(y + 1)}" width="${size - 2}" height="${size - 2}" rx="3" fill="${on ? '#14283a' : K.PAPER}" stroke="${on && ring ? K.ASK : K.GRID}" stroke-width="${on && ring ? 1.8 : 1}"/>`;
    if (on) s += icon(kind, x + size / 2, y + size / 2, size * 0.3);
  }
  if (half) s += text(W / 2, h - 5, `half of the ${cols * rows} squares is ${cols * rows / 2}`, { size: 11, fill: K.SOFT });
  return svg(W, h, s, title || 'the squares');
}

// two probes at once: a row for each square of the first grid, a column for each square of the second
export function pairPic({ a = { n: 2, k: 1, label: 'first' }, b = { n: 3, k: 1, label: 'second' }, kind = 'ice', shade = true } = {}) {
  const c = 27, gw = b.n * c, gh = a.n * c, x0 = (W - gw) / 2 + 24, y0 = 42, h = y0 + gh + 24;
  let s = `<rect width="${W}" height="${h}" fill="${K.CARD}"/>`;
  s += text(x0 + gw / 2, 14, b.label, { size: 11, fill: K.SOFT, weight: 700 });
  s += text(x0 - 22, y0 + gh / 2 + 4, a.label, { size: 11, fill: K.SOFT, weight: 700, anchor: 'end' });
  for (let j = 0; j < b.n; j++) s += j < b.k ? icon(kind, x0 + j * c + c / 2, y0 - 12, 8) : `<rect x="${f(x0 + j * c + c / 2 - 7)}" y="${y0 - 19}" width="14" height="14" rx="2" fill="${K.PAPER}" stroke="${K.GRID}"/>`;
  for (let i = 0; i < a.n; i++) s += i < a.k ? icon(kind, x0 - 12, y0 + i * c + c / 2, 8) : `<rect x="${f(x0 - 19)}" y="${f(y0 + i * c + c / 2 - 7)}" width="14" height="14" rx="2" fill="${K.PAPER}" stroke="${K.GRID}"/>`;
  for (let i = 0; i < a.n; i++) for (let j = 0; j < b.n; j++) {
    const both = i < a.k && j < b.k;
    s += `<rect x="${f(x0 + j * c + 1)}" y="${f(y0 + i * c + 1)}" width="${c - 2}" height="${c - 2}" rx="2" fill="${both && shade ? '#2b4f6b' : K.PAPER}" stroke="${both && shade ? K.ASK : K.GRID}" stroke-width="${both && shade ? 1.4 : 0.8}"/>`;
  }
  s += text(W / 2, h - 6, `every square of one with every square of the other: ${a.n} rows of ${b.n}`, { size: 10, fill: K.SOFT });
  return svg(W, h, s, 'two probes at once');
}

// a line across the map from a to b, 0 marked
export function numberLine({ a = -3, b = 4, label = 'across' } = {}) {
  const lo = Math.min(a, b, 0) - 1, hi = Math.max(a, b, 0) + 1, h = 70, x0 = 20, x1 = W - 20, X = (v) => x0 + (x1 - x0) * (v - lo) / (hi - lo);
  let s = `<rect width="${W}" height="${h}" fill="${K.CARD}"/><path d="M${x0} 34H${x1}" stroke="${K.INK}" stroke-width="1.4"/>`;
  for (let v = lo; v <= hi; v++) s += `<path d="M${f(X(v))} 29V39" stroke="${v === 0 ? K.INK : K.SOFT}" stroke-width="${v === 0 ? 2 : 1}"/>` + text(X(v), 54, v < 0 ? `−${-v}` : String(v), { size: 10, fill: v === 0 ? K.INK : K.SOFT, weight: v === 0 ? 800 : 600 });
  s += `<path d="M${f(X(a))} 22H${f(X(b))}" stroke="${K.ASK}" stroke-width="2" stroke-dasharray="5 3"/>`;
  s += `<circle cx="${f(X(a))}" cy="34" r="5" fill="${COLOUR.holo}" stroke="${K.INK}"/>` + icon('ice', X(b), 34, 7);
  s += text(W / 2, 14, `${label}: ? units`, { size: 11, fill: K.ASK, weight: 800 });
  return svg(W, h, s, 'a line across the map');
}

// ── THE SURVEY MAP: the land below, from straight above ─────────────────────────────────────────────────────────
// map: { hi, quad (1: 0 to hi, the Explorer in the corner; 4: -hi to hi, the Explorer in the middle), size }
export function landMap(map, { points = [], marks = [], ask = '', seed = 5, path = null } = {}) {
  const { lo, hi, pad, S, u } = mapFrame(map), span = hi - lo;
  const X = (x) => pad + (x - lo) * u, Y = (y) => S - pad - (y - lo) * u, fs = Math.max(8, Math.min(10, S / 30));
  const id = `lm${map.quad}${hi}${S}${seed}`;
  let s = `<rect x="0" y="0" width="${S}" height="${S + (ask ? 18 : 0)}" fill="${K.CARD}"/><clipPath id="${id}"><rect x="${pad}" y="${pad}" width="${S - 2 * pad}" height="${S - 2 * pad}"/></clipPath>`;
  s += `<rect x="${pad}" y="${pad}" width="${S - 2 * pad}" height="${S - 2 * pad}" fill="#0d1824"/>`;
  s += `<g clip-path="url(#${id})"><g transform="translate(${pad} ${pad})">${contours(S - 2 * pad, S - 2 * pad, seed, 0.45)}</g></g>`;
  for (let k = lo; k <= hi; k++) {
    const axis = k === 0;
    s += `<path d="M${f(X(k))} ${f(Y(lo))}V${f(Y(hi))}M${f(X(lo))} ${f(Y(k))}H${f(X(hi))}" stroke="${axis ? K.INK : K.GRID}" stroke-width="${axis ? 1.5 : 0.8}"/>`;
    if (span <= (S >= 260 ? 12 : 8) || k % 2 === 0) {
      const t = k < 0 ? `−${-k}` : String(k);
      if (!(k === 0 && map.quad !== 1)) s += text(X(k), S - 4, t, { size: fs, fill: K.SOFT, weight: 600 }) + text(pad / 2, Y(k) + fs / 3, t, { size: fs, fill: K.SOFT, weight: 600 });
    }
  }
  if (map.quad !== 1) s += text(X(0) - 5, S - 4, '0', { size: fs, fill: K.SOFT, weight: 600 });
  // the Explorer, over (0, 0)
  const ex = X(0), ey = Y(0);
  s += `<circle cx="${f(ex)}" cy="${f(ey)}" r="${f(Math.max(7, u * 0.55))}" fill="none" stroke="${COLOUR.holo}" stroke-width="1.2" opacity="0.8"/>`;
  s += `<path d="M${f(ex - 5)} ${f(ey + 5)}L${f(ex)} ${f(ey - 6)}L${f(ex + 5)} ${f(ey + 5)}L${f(ex)} ${f(ey + 2)}Z" fill="${COLOUR.holo}" stroke="${K.INK}" stroke-width="0.8"/>`;
  if (path) s += `<path d="M${path.map(([x, y]) => `${f(X(x))} ${f(Y(y))}`).join('L')}" fill="none" stroke="${K.ASK}" stroke-width="1.8" stroke-dasharray="5 3"/>`;
  for (const p of points) {
    const x = X(p.x), y = Y(p.y);
    if (p.kind === 'probe') s += `<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="${COLOUR.holo}" stroke="${K.INK}" stroke-width="1"/>`;
    else s += icon(p.kind || 'ice', x, y, Math.max(5, u * 0.36));
    if (p.label) s += text(x + (p.x > hi - 2 ? -8 : 8), y - 8, p.label, { size: 9, fill: K.INK, weight: 700, anchor: p.x > hi - 2 ? 'end' : 'start' });
  }
  for (const m of marks) {
    const x = X(m.x), y = Y(m.y);
    if (m.kind === 'aim') s += `<path d="M${f(x)} ${f(Y(lo))}V${f(Y(hi))}M${f(X(lo))} ${f(y)}H${f(X(hi))}" stroke="${K.ASK}" stroke-width="1.1" opacity="0.75"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(4, u * 0.42))}" fill="none" stroke="${K.ASK}" stroke-width="1.8"/>`;
    else if (m.kind === 'miss') s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(3.4, u * 0.32))}" fill="none" stroke="${K.SOFT}" stroke-width="1.3"/><path d="M${f(x - 2.4)} ${f(y - 2.4)}l4.8 4.8M${f(x + 2.4)} ${f(y - 2.4)}l-4.8 4.8" stroke="${K.SOFT}" stroke-width="1.3"/>`;
    else s += icon(m.find || 'ice', x, y, Math.max(6, u * 0.42));
  }
  if (ask) s += text(S / 2, S + 12, ask, { size: 10, fill: K.ASK, weight: 800 });
  return `<svg viewBox="0 0 ${S} ${S + (ask ? 18 : 0)}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg" aria-label="the survey map">${s}</svg>`;
}

// ── the job panel's link ─────────────────────────────────────────────────────────────────────────────────────────
const CSS = new URL('./survey.css', import.meta.url).href;
function ensureCss() {
  if (typeof document === 'undefined' || document.querySelector('link[data-pnsurvey]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.pnsurvey = '1'; document.head.appendChild(l);
}
export function surveyLink({ small = null } = {}) {
  return {
    mount: () => ensureCss(),
    head: () => `<header class="pnj-cardtop is-survey"><span class="pnj-icon is-survey" aria-hidden="true"></span><b>Survey table</b><small>${esc((small && small()) || 'The scan of the land below')}</small></header>`,
  };
}
