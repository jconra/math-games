// THE SHIPPING COMPUTER'S PICTURES (src/jobs/cargo.js): the things to count for the youngest, and the help pictures,
// drawn the way the station's other job pictures are (src/jobs/pics.js: the numbers given, what is asked a "?"), in
// the dark look the game's maker asked for ("This is a space game ... Try to keep things 'dark mode'": pics.js NIGHT).
// Mathwood Valley's supply orders (mathwood-valley/src/math/supplies.js) have the same pictures in its parchment
// colours: a day at a time, the days on a calendar, a load packed into crates with the last few needing one too.
//   cargoPic(p) -> svg     p.kind: 'count' | 'meals' | 'pack' | 'pallets' | 'boxes' | 'calendar' | 'litres' | 'sum'
import { NIGHT as K } from './pics.js';

const W = 360;
const svg = (h, body) => `<svg viewBox="0 0 ${W} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (x, y, s, { size = 13, fill = K.INK, weight = 600, anchor = 'middle' } = {}) => `<text x="${f1(x)}" y="${f1(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="system-ui, sans-serif">${esc(s)}</text>`;
const rect = (x, y, w, h, { fill = K.FILL, stroke = K.INK, rx = 3, dash = false, sw = 1.3 } = {}) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(1, w))}" height="${f1(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ' stroke-dasharray="4 3"' : ''}/>`;

// ── the things, small: a person, a crate of food, a drum of water, a pallet with its load, a container ──────────────
const ICON = {
  person: (x, y, s = 1) => `<circle cx="${f1(x)}" cy="${f1(y - 13 * s)}" r="${f1(6 * s)}" fill="${K.FILL2}" stroke="${K.INK}" stroke-width="1.2"/><path d="M${f1(x - 9 * s)} ${f1(y + 6 * s)}q${f1(9 * s)} ${f1(-17 * s)} ${f1(18 * s)} 0z" fill="${K.BLUE}" stroke="${K.INK}" stroke-width="1.2"/>`,
  crate: (x, y, s = 1) => `${rect(x - 11 * s, y - 16 * s, 22 * s, 18 * s, { fill: '#8a6a3c', stroke: K.INK })}<path d="M${f1(x - 11 * s)} ${f1(y - 10 * s)}h${f1(22 * s)}M${f1(x - 11 * s)} ${f1(y - 4 * s)}h${f1(22 * s)}" stroke="#4a3820" stroke-width="1"/>`,
  drum: (x, y, s = 1) => `<rect x="${f1(x - 8 * s)}" y="${f1(y - 19 * s)}" width="${f1(16 * s)}" height="${f1(21 * s)}" rx="${f1(3 * s)}" fill="${K.COOL}" stroke="${K.INK}" stroke-width="1.2"/><path d="M${f1(x - 8 * s)} ${f1(y - 12 * s)}h${f1(16 * s)}M${f1(x - 8 * s)} ${f1(y - 5 * s)}h${f1(16 * s)}" stroke="${K.DARK}" stroke-width="1"/>`,
  pallet: (x, y, s = 1) => `${rect(x - 14 * s, y - 20 * s, 28 * s, 16 * s, { fill: '#d9d4c7', stroke: K.INK })}<path d="M${f1(x - 14 * s)} ${f1(y - 12 * s)}h${f1(28 * s)}" stroke="${K.ASK}" stroke-width="2"/>${rect(x - 16 * s, y - 4 * s, 32 * s, 4 * s, { fill: '#6b5638', stroke: K.INK, rx: 1, sw: 1 })}`,
  container: (x, y, s = 1, c = '#2c8a57') => `${rect(x - 26 * s, y - 34 * s, 52 * s, 34 * s, { fill: c, stroke: K.INK })}<path d="M${f1(x)} ${f1(y - 32 * s)}v${f1(30 * s)}" stroke="${K.DARK}" stroke-width="1.4"/>`,
};

// THINGS TO COUNT, in rows (up to 6 to a row; groups: drawn in boxes of so many, the boxes counted)
function count({ thing = 'crate', n = 3, group = 0, ask = '', two = null }) {
  const per = 6, s = n > 12 ? 0.8 : 1, dx = 40 * s, dy = 44 * s, rows = Math.ceil(n / per);
  let b = '';
  if (two) {
    // (two kinds side by side, "and"): two[0] of thing, two[1] of `two.thing`
    const [a, c] = two.n, t2 = two.thing || thing, gap = 26, wA = Math.min(per, a) * dx, wC = Math.min(per, c) * dx, x0 = (W - wA - wC - gap) / 2;
    for (let i = 0; i < a; i++) b += ICON[thing](x0 + (i % per) * dx + dx / 2, 40 + Math.floor(i / per) * dy, s);
    b += text(x0 + wA + gap / 2, 34, '+', { size: 18, weight: 800 });
    for (let i = 0; i < c; i++) b += ICON[t2](x0 + wA + gap + (i % per) * dx + dx / 2, 40 + Math.floor(i / per) * dy, s);
    const h = 40 + (Math.max(Math.ceil(a / per), Math.ceil(c / per)) - 1) * dy + 22;
    return svg(h + (ask ? 24 : 4), b + (ask ? text(W / 2, h + 14, ask, { size: 14, fill: K.ASK, weight: 800 }) : ''));
  }
  if (group) {
    const g = Math.ceil(n / group), gw = (group * dx + 14), x0 = (W - Math.min(g, 4) * (gw + 10) + 10) / 2;
    for (let i = 0; i < g; i++) {
      const gx = x0 + (i % 4) * (gw + 10), gy = 10 + Math.floor(i / 4) * (dy + 16), m = Math.min(group, n - i * group);
      b += rect(gx, gy, gw, dy + 4, { fill: 'none', stroke: K.SOFT, dash: true });
      for (let j = 0; j < m; j++) b += ICON[thing](gx + 7 + j * dx + dx / 2, gy + dy - 4, s);
    }
    const h = 10 + Math.ceil(g / 4) * (dy + 16);
    return svg(h + (ask ? 24 : 4), b + (ask ? text(W / 2, h + 10, ask, { size: 14, fill: K.ASK, weight: 800 }) : ''));
  }
  const x0 = (W - Math.min(per, n) * dx) / 2;
  for (let i = 0; i < n; i++) b += ICON[thing](x0 + (i % per) * dx + dx / 2, 40 + Math.floor(i / per) * dy, s);
  const h = 40 + (rows - 1) * dy + 18;
  return svg(h + (ask ? 24 : 4), b + (ask ? text(W / 2, h + 14, ask, { size: 14, fill: K.ASK, weight: 800 }) : ''));
}

// A DAY AT A TIME: each person's so many a day as dots, then the days in a row (Mathwood's supply order's picture)
function meals({ people, each = 1, days = 1, unit = 'meal packs', word = '' }) {
  const show = Math.min(people, 12), gap = Math.min(28, (W - 20) / show);
  let b = text(10, 14, days > 1 ? 'One day' : 'Each one', { size: 12, anchor: 'start', fill: K.AMBER, weight: 800 });
  for (let i = 0; i < show; i++) {
    const cx = 10 + gap * (i + 0.5);
    b += `<circle cx="${f1(cx)}" cy="28" r="7" fill="${K.FILL2}" stroke="${K.INK}" stroke-width="1.1"/>`;
    for (let k = 0; k < Math.min(each, 4); k++) b += `<circle cx="${f1(cx)}" cy="${f1(44 + k * 9)}" r="3.4" fill="${K.AMBER}"/>`;
  }
  if (people > show) b += text(10 + gap * show + 4, 32, `… ${people} in all`, { size: 11, anchor: 'start', fill: K.SOFT });
  b += text(W - 10, 14, `${people} people × ${each} each`, { size: 12, anchor: 'end', fill: K.SOFT });
  let y = 50 + Math.min(each, 4) * 9 + 12;
  if (days > 1) {
    const n = Math.min(days, 14), bw = (W - 20) / n;
    b += text(10, y - 4, `${days} days${word ? ` (a ${word})` : ''}`, { size: 12, anchor: 'start', fill: K.AMBER, weight: 800 });
    for (let i = 0; i < n; i++) b += rect(10 + i * bw + 1, y + 2, bw - 2, 20, { fill: K.FILL });
    y += 30;
  }
  b += text(W / 2, y + 14, `in all: ? ${unit}`, { size: 14, fill: K.ASK, weight: 800 });
  return svg(y + 22, b);
}

// PACKED INTO CRATES (or drums, pallets, containers): the whole load as a bar, cut into lots of `per`; the last few
// left over need one more lot too
function pack({ total, per, unit = 'meal packs', box = ['crate', 'crates'] }) {
  const full = Math.floor(total / per), left = total - full * per, x0 = 10, x1 = W - 10, scale = (x1 - x0) / (full * per + (left ? per : 0));
  let b = rect(x0, 18, total * scale, 26, { fill: K.FILL2 }) + text(x0 + total * scale / 2, 36, `${total} ${unit}`, { size: 13 });
  const shown = Math.min(3, full);
  for (let i = 0; i < shown; i++) b += rect(x0 + i * per * scale + 1, 58, per * scale - 2, 30) + text(x0 + (i + 0.5) * per * scale, 78, String(per), { size: 12 });
  const m0 = x0 + shown * per * scale, m1 = x0 + full * per * scale;
  if (full > shown) b += rect(m0 + 1, 58, m1 - m0 - 2, 30, { fill: 'none', dash: true }) + text((m0 + m1) / 2, 78, `more ${box[1]} of ${per}…`, { size: 11, fill: K.SOFT });
  if (left) {
    b += rect(m1 + 1, 58, per * scale - 2, 30, { fill: 'none', stroke: K.ASK, dash: true }) + rect(m1 + 1, 58, Math.max(2, left * scale - 2), 30, { fill: '#5a3a2a', stroke: K.ASK });
    b += text(x1, 106, `the last ${left} need a ${box[0]} too`, { size: 12, anchor: 'end', fill: K.ASK, weight: 700 });
  }
  b += text(x0, 106, `${box[1]}: ?`, { size: 13, anchor: 'start', fill: K.ASK, weight: 800 });
  return svg(114, b);
}

// A WEEK OR A FORTNIGHT on a calendar: the days to count
function calendar({ days }) {
  const weeks = days / 7, cw = (W - 20) / 7, ch = 24;
  let b = '';
  ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach((n, i) => { b += text(10 + cw * (i + 0.5), 14, n, { size: 11, fill: K.SOFT }); });
  for (let w = 0; w < weeks; w++) for (let i = 0; i < 7; i++) b += rect(10 + cw * i + 1, 22 + w * (ch + 6), cw - 2, ch, { fill: w % 2 ? K.FILL2 : K.FILL });
  const h = 22 + weeks * (ch + 6) + 18;
  b += text(10, h - 2, weeks > 1 ? 'a fortnight: two weeks. How many days?' : 'a week: how many days?', { size: 13, anchor: 'start', fill: K.ASK, weight: 800 });
  return svg(h + 6, b);
}

// A ROW OF BOXES, the sum's numbers in them and a sign between (the pallets in all: food + water; or the steps in turn)
function boxes({ items = [], op = '+', ask = '' }) {
  const n = items.length, gap = 26, bw = Math.min(120, (W - 8 - gap * (n - 1)) / n), x0 = (W - (n * bw + (n - 1) * gap)) / 2;
  let b = '';
  items.forEach((it, i) => {
    const x = x0 + i * (bw + gap);
    b += rect(x, 12, bw, 50, { fill: it.ask ? K.FILL2 : K.PAPER, stroke: it.ask ? K.ASK : K.INK, rx: 5 });
    b += text(x + bw / 2, 28, it.top, { size: 11, fill: K.SOFT }) + text(x + bw / 2, 50, String(it.mid), { size: 15, weight: 800, fill: it.ask ? K.ASK : K.INK });
    if (i < n - 1) b += text(x + bw + gap / 2, 44, it.op || op, { size: 18, weight: 800 });
  });
  if (ask) b += text(W / 2, 88, ask, { size: 14, fill: K.ASK, weight: 800 });
  return svg(ask ? 98 : 70, b);
}

// PALLETS INTO CONTAINERS: the pallets drawn two to a container, the containers counted
function containers({ pallets, per = 2 }) {
  const k = Math.ceil(pallets / per), cw = 110, x0 = (W - k * cw - (k - 1) * 20) / 2;
  let b = '';
  for (let i = 0; i < k; i++) {
    const x = x0 + i * (cw + 20), cols = ['#2c8a57', '#a8392f', '#2f62b8'];
    b += rect(x, 18, cw, 64, { fill: cols[i % 3], stroke: K.INK }) + rect(x + 8, 26, cw - 16, 50, { fill: K.DARK, stroke: K.SOFT, sw: 1 });
    for (let j = 0; j < per; j++) { const has = i * per + j < pallets; b += has ? ICON.pallet(x + 30 + j * 50, 72, 1) : rect(x + 16 + j * 50, 48, 28, 24, { fill: 'none', stroke: K.SOFT, dash: true }); }
  }
  b += text(W / 2, 104, `${pallets} pallets, ${per} in each container: ? containers`, { size: 13.5, fill: K.ASK, weight: 800 });
  return svg(112, b);
}

export function cargoPic(p) {
  if (!p) return '';
  if (p.kind === 'count') return count(p);
  if (p.kind === 'meals') return meals(p);
  if (p.kind === 'pack') return pack(p);
  if (p.kind === 'calendar') return calendar(p);
  if (p.kind === 'boxes') return boxes(p);
  if (p.kind === 'containers') return containers(p);
  return '';
}
