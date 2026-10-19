// The pictures for the store counter's other questions (src/math/counter.js: money, time, decimals, percent, ratios).
// Two kinds of picture:
//   the LEAD: part of the question itself, shown above the coins from the start (the grandfather clock to read, the
//             coins to count, the stagecoach timetable, the pan of cornbread in tenths)
//   the HELP: shown after a wrong pick, or on "Draw it for me" after a long think: how the problem is built (the coins
//             with their values, a count-up line for change, the points lined up, a time line with a hop an hour, a bar
//             cut into equal parts, a ratio table) with a "?" where the answer goes. It never shows the answer itself.
//
//   counterPicture(pic) -> { svg, title, line }   pic = an order's .lead or .pic; kinds this file doesn't draw (parts,
//                                                 share, groups, road, ratio, percent, twostep) go to src/ui/storepics.js
// Plain strings, no page needed (tests/counter.test.mjs draws every kind).
import { picture as storePicture } from './storepics.js';
import { clockSvg } from './clockface.js';
import { usd, cents, ampm, clock, hour12, dur, dec, DAYS, u } from '../math/counterkit.js';

const INK = '#2b2219', SOFT = '#8a7558', FILL = '#ead9b2', FILL2 = '#d9bf8a', BRASS = '#b47f2c', ASK = '#b5523a', GREEN = '#5d7a3a', OFF = '#f3c9b4', TAX = '#cfe0b5';
const W = 360;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f1 = (n) => Number(n).toFixed(1);
const text = (x, y, s, { size = 13, fill = INK, anchor = 'middle', weight = 600 } = {}) =>
  `<text x="${f1(x)}" y="${f1(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Bitter, Georgia, serif">${esc(s)}</text>`;
const q = (x, y, size = 18) => text(x, y, '?', { size, fill: ASK, weight: 800 });
const svg = (h, body, w = W) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
const box = (x, y, w, h, { fill = FILL, stroke = INK, dash = false, rx = 3 } = {}) =>
  `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(1, w))}" height="${f1(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.3"${dash ? ' stroke-dasharray="4 3"' : ''}/>`;
const brace = (x0, x1, y, label, { up = true, ask = false, size = 13 } = {}) => {
  const d = up ? -6 : 6;
  return `<path d="M${f1(x0)} ${y}v${d}H${f1(x1)}v${-d}" fill="none" stroke="${SOFT}" stroke-width="1.3"/>`
    + (ask ? q((x0 + x1) / 2, up ? y - 10 : y + 24) : text((x0 + x1) / 2, up ? y - 10 : y + 20, label, { size }));
};
const hop = (x0, x1, y, label, { color = BRASS, size = 11.5 } = {}) => {
  const mx = (x0 + x1) / 2, hgt = Math.min(26, Math.max(12, (x1 - x0) * 0.35));
  return `<path d="M${f1(x0)} ${y}Q${f1(mx)} ${f1(y - hgt * 2)} ${f1(x1)} ${y}" fill="none" stroke="${color}" stroke-width="1.8" marker-end="url(#bmq-ar)"/>`
    + (label ? text(mx, y - hgt - 4, label, { size, fill: color, weight: 700 }) : '');
};
const ARROW = `<defs><marker id="bmq-ar" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="${BRASS}"/></marker></defs>`;

// a coin drawn at (x, y): a quarter, dime, nickel or penny, roughly to scale (the dime is the smallest)
const COIN_LOOK = { quarter: { r: 21, fill: '#cfccc3' }, nickel: { r: 18, fill: '#c3c0b6' }, penny: { r: 16.5, fill: '#c98552' }, dime: { r: 15, fill: '#d9d6cd' } };
const COIN_VALUE = { quarter: 25, dime: 10, nickel: 5, penny: 1 };
function coinAt(k, x, y) {
  const c = COIN_LOOK[k];
  return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${c.r}" fill="${c.fill}" stroke="${INK}" stroke-width="1.3"/>`
    + `<circle cx="${f1(x)}" cy="${f1(y)}" r="${c.r - 3.5}" fill="none" stroke="${INK}" stroke-width="0.7" opacity="0.45"/>`
    + `<path d="M${f1(x - c.r * 0.28)} ${f1(y + c.r * 0.32)}q${f1(c.r * 0.1)} ${f1(-c.r * 0.7)} ${f1(c.r * 0.5)} ${f1(-c.r * 0.55)}q${f1(-c.r * 0.12)} ${f1(c.r * 0.3)} ${f1(-c.r * 0.04)} ${f1(c.r * 0.6)}" fill="none" stroke="${INK}" stroke-width="1" opacity="0.5"/>`;
}

// the place of each digit of a decimal string, lined up on the point: '3.45' -> { whole: '3', part: '45' }
const split = (s) => { const [a, b = ''] = String(s).replace('$', '').split('.'); return { whole: a, part: b }; };

const DRAW = {
  // the coins: their names under them (the question), or their values (the help: count on from the biggest)
  coins(p) {
    const list = [];
    for (const c of p.coins) for (let i = 0; i < c.n; i++) list.push(c.k);
    const n = list.length, gap = Math.min(50, (W - 30) / n), x0 = W / 2 - gap * (n - 1) / 2;
    let s = '';
    list.forEach((k, i) => {
      const x = x0 + i * gap;
      s += coinAt(k, x, 34);
      s += text(x, 72, p.values ? `${COIN_VALUE[k]}¢` : k, { size: p.values ? 14 : 11.5, fill: p.values ? ASK : SOFT, weight: p.values ? 800 : 600 });
    });
    if (p.values) s += text(W / 2, 98, 'count on: biggest first', { size: 12.5, fill: SOFT });
    return { svg: svg(p.values ? 106 : 82, s), line: p.values ? 'A quarter is 25¢, a dime 10¢, a nickel 5¢, a penny 1¢. Start with the biggest and count on, a coin at a time.' : '' };
  },
  // making change the storekeeper's way: count up from the price to what was paid, a hop at a time
  countup(p) {
    const pts = [p.from];
    let x = p.from;
    if (x % 5) { x = Math.min(p.to, Math.ceil(x / 5) * 5); pts.push(x); }
    if (x % 10 && x + 5 <= p.to) { x += 5; pts.push(x); }
    if (x < p.to && x % 25) { const nx = Math.min(p.to, Math.ceil(x / 25) * 25); if (nx > x && nx < p.to) { x = nx; pts.push(x); } }
    if (x < p.to) pts.push(p.to);
    // (one hop straight there would be the answer itself: split it at a quarter, a dime or a nickel on the way)
    if (pts.length === 2) {
      const mid = [25, 10, 5].map((k) => Math.floor((p.to - 1) / k) * k).find((v) => v > p.from && v < p.to);
      if (mid != null) pts.splice(1, 0, mid);
    }
    const x0 = 24, x1 = W - 24, sc = (x1 - x0) / (p.to - p.from), X = (v) => x0 + (v - p.from) * sc, y = 70;
    let s = ARROW + `<path d="M${x0} ${y}H${x1}" stroke="${INK}" stroke-width="2"/>`;
    for (const v of pts) s += `<path d="M${f1(X(v))} ${y - 6}v12" stroke="${INK}" stroke-width="2"/>` + text(X(v), y + 22, cents(v), { size: 12.5 });
    for (let i = 1; i < pts.length; i++) s += hop(X(pts[i - 1]), X(pts[i]), y - 4, `+${cents(pts[i] - pts[i - 1])}`);
    s += text(W / 2, y + 46, `the change = all the hops added: ?`, { size: 13.5, fill: ASK, weight: 800 });
    return { svg: svg(y + 56, s), line: `Count up from ${cents(p.from)} to ${cents(p.to)}, the way a storekeeper makes change, and add up the hops.` };
  },
  // a sum or a take-away with the points lined up, and the empty places filled with 0
  columns(p) {
    const rows = p.rows.map(split), wl = Math.max(...rows.map((r) => r.whole.length)), pl = Math.max(...rows.map((r) => r.part.length));
    const cw = 38, xp = W / 2 + 16, top = 36;   // xp: the point
    const wx = (i) => xp - 7 - cw * (wl - i - 0.5), px = (j) => xp + 7 + cw * (j + 0.5);   // the whole digits' and the parts' columns
    const head = p.money ? ['dimes', 'cents'] : ['tenths', 'hundredths'];
    let s = text(wx(wl - 1), 16, p.money ? 'dollars' : 'ones', { size: 10.5, fill: SOFT });
    for (let j = 0; j < pl; j++) s += text(px(j), 16 + (j % 2) * 12, head[j] || '', { size: 10.5, fill: SOFT });
    rows.forEach((r, i) => {
      const y = top + 24 + i * 32;
      const ws = r.whole.padStart(wl, ' ');
      for (let j = 0; j < wl; j++) if (ws[j] !== ' ') s += text(wx(j), y, ws[j], { size: 23, weight: 700 });
      s += text(xp, y, '.', { size: 24, weight: 800 });
      for (let j = 0; j < pl; j++) s += text(px(j), y, r.part[j] ?? '0', { size: 23, weight: 700, fill: r.part[j] == null ? GREEN : INK });
      if (p.money) s += text(wx(0) - cw * 0.75, y, '$', { size: 21, weight: 700 });
      if (i === rows.length - 1) s += text(wx(0) - cw * (p.money ? 1.5 : 1), y, p.op, { size: 23, weight: 800, fill: BRASS });
    });
    const yr = top + 24 + (rows.length - 1) * 32 + 11;
    s += `<path d="M${f1(wx(0) - cw * (p.money ? 1.8 : 1.3))} ${yr}H${f1(px(pl - 1) + cw * 0.6)}" stroke="${INK}" stroke-width="2"/>`;
    s += q((wx(0) + px(pl - 1)) / 2, yr + 30, 24);
    const filled = rows.some((r) => r.part.length < pl);
    return { svg: svg(yr + 42, s), line: `Line the points up, one under the other${filled ? ' (a green 0 fills an empty place)' : ''}, then ${p.op === '+' ? 'add' : 'take away'} column by column from the right.` };
  },
  // several at one price, then the change: the bill first, then what's left of the note
  bill(p) {
    const n = p.n, bw = (W - 20) / n;
    let s = text(10, 14, 'Step 1: the bill', { size: 12, anchor: 'start', fill: BRASS, weight: 800 });
    for (let i = 0; i < n; i++) s += box(10 + i * bw, 20, bw - 3, 26) + text(10 + i * bw + (bw - 3) / 2, 38, usd(p.price), { size: 13 });
    s += text(W - 12, 62, `${n} × ${usd(p.price)} = ?`, { size: 13, anchor: 'end', fill: ASK, weight: 800 });
    s += text(10, 82, 'Step 2: the change', { size: 12, anchor: 'start', fill: BRASS, weight: 800 });
    s += box(10, 88, W - 20, 26, { fill: FILL2 }) + text(W / 2, 106, `paid ${usd(p.paid)}`, { size: 13 });
    const bx = 10 + (W - 20) * Math.min(0.75, Math.max(0.25, n * p.price / p.paid));
    s += box(10, 120, bx - 12, 26) + text((10 + bx) / 2 - 1, 138, 'the bill', { size: 12 }) + box(bx, 120, W - 10 - bx, 26, { fill: OFF, stroke: ASK }) + q((bx + W - 10) / 2, 140);
    s += text((bx + W - 10) / 2, 162, 'change', { size: 12, fill: SOFT });
    return { svg: svg(170, s), line: `First the bill: ${n} at ${usd(p.price)} each. Then the change is what's left of the ${usd(p.paid)}.` };
  },
  // two deals: the price of one in each
  deals(p) {
    let s = '';
    p.deals.forEach(([n, c], i) => {
      const y = 22 + i * 46;
      s += box(10, y, 120, 32, { fill: FILL2 }) + text(70, y + 21, `${n} for ${cents(c)}`, { size: 15, weight: 700 });
      s += `<path d="M138 ${y + 16}H196" stroke="${BRASS}" stroke-width="2" marker-end="url(#bmq-ar)"/>` + text(167, y + 10, `÷ ${n}`, { size: 13, fill: BRASS, weight: 800 });
      s += box(206, y, 144, 32) + q(250, y + 23) + text(268, y + 21, 'each', { size: 13, fill: SOFT, anchor: 'start' });
    });
    return { svg: svg(116, ARROW + s), line: `Find what one ${p.one} costs in each deal, then compare: the cheaper one each is the better buy.` };
  },
  // a whole cut into equal parts; some of them shaded (a part, the part that comes off, or the tax or tip added on)
  pctbar(p) {
    const n = Math.min(20, p.n), each = 100 / n, take = p.take * (n / p.n);
    const lab = (v) => (p.money ? usd(v) : p.unit === 'money' ? `$${v}` : Array.isArray(p.unit) ? u(v, p.unit) : String(v));
    const extra = p.mode === 'tax' || p.mode === 'tip';
    const x0 = 10, x1 = extra ? W - 10 - (W - 20) * Math.min(0.35, take / n) - 6 : W - 10, pw = (x1 - x0) / n;
    let s = brace(x0, x1, 26, lab(p.whole));
    for (let i = 0; i < n; i++) {
      const lit = !extra && i >= n - Math.ceil(take - 1e-9) && (p.mode === 'off' || p.mode === 'part');
      const half = lit && i === n - Math.ceil(take) && take % 1;
      s += box(x0 + i * pw, 32, pw - 1.5, 30, { fill: lit && !half ? (p.mode === 'off' ? OFF : FILL2) : FILL, stroke: lit ? ASK : INK, rx: 2 });
      if (half) s += box(x0 + i * pw + (pw - 1.5) / 2, 32, (pw - 1.5) / 2, 30, { fill: p.mode === 'off' ? OFF : FILL2, stroke: ASK, rx: 2 });
    }
    if (extra) s += box(x1 + 4, 32, pw * take, 30, { fill: TAX, stroke: GREEN, rx: 2 }) + q(x1 + 4 + pw * take / 2, 53, 16);
    const pct = Math.round(take * each * 10) / 10;
    const tag = p.mode === 'off' ? `${pct}% off = the red parts` : extra ? `${pct}% ${p.mode} = the green part` : `${pct}% = the shaded part${take > 1 ? 's' : ''}: ?`;
    s += text(W / 2, 84, tag, { size: 12.5, fill: extra ? GREEN : ASK, weight: 700 });
    s += text(W / 2, 104, `each part is ${Math.round(each * 10) / 10}% of ${lab(p.whole)}`, { size: 12.5, fill: SOFT });
    const line = p.mode === 'off' ? `${lab(p.whole)} cut into ${n} equal parts. Work out one part, then the ${pct}% that comes off, then what's left to pay.`
      : extra ? `${lab(p.whole)} cut into ${n} equal parts of ${each}%. The ${p.mode} is ${pct}%: work out one part, then add the ${p.mode} on.`
        : `${lab(p.whole)} cut into ${n} equal parts of ${Math.round(each * 10) / 10}%. Work out one part (÷ ${n}), then take ${p.take} of them.`;
    return { svg: svg(112, s), line };
  },
  clock(p) {
    return { svg: clockSvg(p.h, p.m, { help: !!p.help }), line: p.help ? 'The short hand tells the hour: the last number it has passed (lit yellow). The long hand tells the minutes: count by 5s from the top.' : '' };
  },
  // a time line from one time to another: a hop for each whole hour, the minutes at the ends
  timeline(p) {
    const end = p.to != null ? p.to : p.from + p.add, x0 = 26, x1 = W - 26, sc = (x1 - x0) / (end - p.from), X = (v) => x0 + (v - p.from) * sc, y = 72;
    const lab = (v) => (p.plain ? `${hour12(v)} o'clock` : ampm(v));
    let s = ARROW + `<path d="M${x0} ${y}H${x1}" stroke="${INK}" stroke-width="2"/>`;
    const firstH = Math.ceil(p.from / 60) * 60, lastH = Math.floor(end / 60) * 60, hours = Math.max(0, (lastH - firstH) / 60);
    const marks = [];
    for (let v = firstH; v <= lastH; v += 60) marks.push(v);
    const many = marks.length > 9;
    marks.forEach((v, i) => {
      const mid = v % 1440 === 0 ? 'midnight' : v % 1440 === 720 ? 'noon' : '';
      s += `<path d="M${f1(X(v))} ${y - 5}v10" stroke="${mid ? ASK : INK}" stroke-width="${mid ? 2.4 : 1.5}"/>`;
      if (mid) s += text(X(v), y + 34, mid, { size: 11, fill: ASK, weight: 800 });
      if (!many || i % 2 === 0 || mid) s += text(X(v), y + 18, mid ? '12' : String(hour12(v)), { size: 11, fill: SOFT });
      if (i > 0) s += hop(X(marks[i - 1]), X(v), y - 3, many ? '' : '1 h', { size: 10 });
    });
    if (firstH > p.from) s += hop(X(p.from), X(Math.min(firstH, end)), y - 3, `${Math.min(firstH, end) - p.from} min`, { color: GREEN, size: 10 });
    if (lastH < end && lastH >= firstH) s += hop(X(lastH), X(end), y - 3, `${end - lastH} min`, { color: GREEN, size: 10 });
    s += `<circle cx="${x0}" cy="${y}" r="5" fill="${INK}"/>` + text(x0, y + 50, lab(p.from), { size: 12.5, anchor: 'start', weight: 700 });
    s += `<circle cx="${x1}" cy="${y}" r="5" fill="${p.to != null ? INK : ASK}"/>` + (p.to != null ? text(x1, y + 50, lab(end), { size: 12.5, anchor: 'end', weight: 700 }) : text(x1, y + 50, 'ends: ?', { size: 13, anchor: 'end', weight: 800, fill: ASK }));
    if (p.to != null) s += brace(x0, x1, 22, '', { ask: true });
    const line = p.to != null
      ? `Hop from ${lab(p.from)} to the next whole hour, then an hour a hop${p.midnight ? ' (past midnight the clock starts again)' : p.noon ? ' (past noon the clock starts again at 1)' : ''}, then the minutes left. Add up the hops.`
      : `Count on from ${lab(p.from)}: to the next whole hour, then an hour a hop, then the minutes left.`;
    void hours;
    return { svg: svg(y + 60, s), line };
  },
  // the stagecoach timetable on the store wall (the two stops asked about marked)
  timetable(p) {
    const rh = 28;
    let s = box(20, 6, W - 40, 30 + rh * p.stops.length, { fill: '#f1e4c4', rx: 4 }) + text(W / 2, 26, 'STAGECOACH  ·  WESTBOUND', { size: 13, weight: 800, fill: BRASS });
    p.stops.forEach(([name, at], i) => {
      const y = 36 + i * rh, mark = p.mark && p.mark.includes(i);
      if (mark) s += box(26, y + 2, W - 52, rh - 4, { fill: FILL2, stroke: BRASS, rx: 3 });
      s += text(40, y + rh / 2 + 5, name, { size: 14, anchor: 'start', weight: mark ? 800 : 600 }) + text(W - 40, y + rh / 2 + 5, at, { size: 14, anchor: 'end', weight: mark ? 800 : 600 });
    });
    return { svg: svg(44 + rh * p.stops.length, s), line: '' };
  },
  // minutes as hours: a bar of 60 for each whole hour, and the minutes left over
  hourbars(p) {
    const full = Math.floor(p.total / 60), left = p.total % 60, x0 = 10, x1 = W - 10, sc = (x1 - x0) / p.total;
    let s = brace(x0, x1, 22, `${p.total} minutes`);
    for (let i = 0; i < full; i++) s += box(x0 + i * 60 * sc, 28, 60 * sc - 2, 30) + text(x0 + (i + 0.5) * 60 * sc, 48, '60 min', { size: 12 });
    if (left) s += box(x0 + full * 60 * sc, 28, left * sc - 1, 30, { fill: OFF, stroke: ASK }) + q(x0 + (full * 60 + left / 2) * sc, 49, 15);
    s += text(W / 2, 82, 'how many 60s, and how many minutes left?', { size: 12.5, fill: ASK, weight: 700 });
    return { svg: svg(92, s), line: `An hour is 60 minutes. Count the 60s in ${p.total}; what's left over is the minutes.` };
  },
  // a trip across days: the days side by side, a day's 24 hours at a time
  days(p) {
    const d0 = Math.floor(p.start / 1440), end = p.start + p.len * 60, d1 = Math.floor(end / 1440), n = d1 - d0 + 1;
    const x0 = 10, dw = (W - 20) / n, X = (v) => x0 + (v - d0 * 1440) / 1440 * dw;
    let s = ARROW;
    for (let i = 0; i < n; i++) {
      s += box(x0 + i * dw, 40, dw - 2, 30, { fill: i % 2 ? FILL2 : FILL }) + text(x0 + (i + 0.5) * dw, 32, DAYS[(d0 + i) % 7], { size: 12.5, weight: 700 });
      s += text(x0 + i * dw + 3, 84, 'midnight', { size: 9.5, anchor: 'start', fill: SOFT });
    }
    s += `<circle cx="${f1(X(p.start))}" cy="55" r="5" fill="${INK}"/>` + text(X(p.start), 100, ampm(p.start), { size: 11.5, weight: 700 });
    if (p.len >= 24) s += hop(X(p.start), X(p.start + 1440), 40, '+24 h');
    s += text(W / 2, 122, `${p.len} hours on: which day, and what time? ?`, { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(130, s), line: p.len >= 24 ? `24 hours on is the same time the next day. Then count the ${p.len - 24} hours left.` : 'Count on to midnight, then on into the next day.' };
  },
  // tenths: a pan (or a wheel, a mile of fence, a bar) cut into 10 equal pieces, some taken
  tenths(p) {
    const n = p.n || 10, k = p.shaded;
    let s = '';
    if (p.what === 'wheel') {
      const cx = W / 2, cy = 62, R = 52;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2, on = i < k;
        s += `<path d="M${cx} ${cy}L${f1(cx + R * Math.cos(a0))} ${f1(cy + R * Math.sin(a0))}A${R} ${R} 0 0 1 ${f1(cx + R * Math.cos(a1))} ${f1(cy + R * Math.sin(a1))}Z" fill="${on ? '#f1c86a' : '#f8e7b0'}" stroke="${INK}" stroke-width="1.2"${on ? ` transform="translate(${f1(6 * Math.cos((a0 + a1) / 2))} ${f1(6 * Math.sin((a0 + a1) / 2))})"` : ''}/>`;
        if (p.help) { const am = (a0 + a1) / 2; s += text(cx + R * 0.68 * Math.cos(am), cy + R * 0.68 * Math.sin(am) + 4, '0.1', { size: 10 }); }
      }
      return { svg: svg(128, s), line: p.help ? 'Each wedge is one tenth of the wheel: 0.1. Count the wedges bought: that many tenths.' : '' };
    }
    const rows = p.what === 'pan' ? 2 : 1, per = n / rows, x0 = 14, pw = (W - 28) / per, ph = rows === 2 ? 34 : 40, y0 = 16;
    if (p.what === 'pan') s += box(x0 - 6, y0 - 6, W - 16, rows * ph + 12, { fill: '#5a4a3a', stroke: INK, rx: 6 });
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / per), c = i % per, x = x0 + c * pw, y = y0 + r * ph, taken = i < k;
      const fill = p.what === 'pan' ? (taken ? '#5a4a3a' : '#e3b25a') : taken ? FILL2 : FILL;
      s += box(x + 1, y + 1, pw - 2, ph - 2, { fill, stroke: taken ? ASK : INK, dash: taken && p.what === 'pan', rx: 2 });
      if (p.help) s += text(x + pw / 2, y + ph / 2 + 5, '0.1', { size: 11, fill: taken ? '#f6edd6' : INK });
    }
    const h = y0 + rows * ph + 12;
    if (p.help) s += text(W / 2, h + 14, `each piece is one tenth: 0.1`, { size: 12.5, fill: ASK, weight: 700 });
    const what = p.what === 'pan' ? 'pan' : p.what === 'mile' ? 'mile' : 'whole';
    return { svg: svg(p.help ? h + 22 : h, s), line: p.help ? `Each piece is one tenth of the ${what}: 0.1. ${p.what === 'pan' ? 'The empty spots are the pieces eaten.' : 'Count the shaded pieces.'} So many tenths is 0.something.` : '' };
  },
  // hundredths: a square cut into 100, so many shaded (one or two to compare)
  grid(p) {
    const v = p.values, n = v.length, cell = n === 2 ? 11 : 12, size = cell * 10, gap = 40, x00 = W / 2 - (n * size + (n - 1) * gap) / 2;
    let s = '';
    v.forEach((val, g) => {
      const x0 = x00 + g * (size + gap), y0 = 8;
      for (let i = 0; i < 100; i++) {
        const r = Math.floor(i / 10), c = i % 10, on = c * 10 + r < val;   // (filled a column of ten at a time: tenths are columns)
        s += `<rect x="${f1(x0 + c * cell)}" y="${f1(y0 + r * cell)}" width="${cell}" height="${cell}" fill="${on ? FILL2 : '#fbf6ea'}" stroke="${SOFT}" stroke-width="0.6"/>`;
      }
      s += `<rect x="${f1(x0)}" y="${y0}" width="${size}" height="${size}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
      s += text(x0 + size / 2, y0 + size + 20, p.labels[g], { size: 15, weight: 800 });
    });
    return { svg: svg(8 + size + 30, s), line: n === 2 ? 'Each square is one whole cut into 100. A column is a tenth (0.1), a small square a hundredth (0.01). Which has more shaded?' : 'A dollar is 100 cents: each small square is one cent, one hundredth of the dollar (0.01). A column is a dime, a tenth (0.1).' };
  },
  // times or divided by 10 or 100: the digits move along the places, the point stays put
  shift(p) {
    const places = p.places, val = p.from, digits = String(val).padStart(places + 1, '0'), wholeLen = digits.length - places;
    const k = p.by === 100 ? 2 : 1, dir = p.op === '×' ? -1 : 1;
    const cols = ['hundreds', 'tens', 'ones', 'tenths', 'hundredths', 'thousandths'], one = 2;   // the ones column's index
    const cw = 58, x0 = W / 2 - cw * 3, colX = (i) => x0 + cw * (i + 0.5);
    let s = ARROW;
    cols.forEach((c, i) => { s += text(colX(i), 12 + (i % 2) * 10, c, { size: 9.5, fill: SOFT }); if (i === one) s += `<path d="M${f1(x0 + cw * (one + 1))} 20v74" stroke="${SOFT}" stroke-width="1" stroke-dasharray="3 3"/>`; });
    const pos = (j) => one - (wholeLen - 1) + j;   // column of digit j
    for (let j = 0; j < digits.length; j++) {
      const c = pos(j); if (c < 0 || c >= cols.length) continue;
      s += text(colX(c), 44, digits[j], { size: 22, weight: 700 });
      const c2 = c + dir * k;
      if (c2 >= 0 && c2 < cols.length) s += `<path d="M${f1(colX(c))} 50Q${f1((colX(c) + colX(c2)) / 2)} 66 ${f1(colX(c2))} 74" fill="none" stroke="${BRASS}" stroke-width="1.5" marker-end="url(#bmq-ar)"/>`;
    }
    s += text(x0 + cw * (one + 1), 46, '.', { size: 24, weight: 800 }) + text(x0 + cw * (one + 1), 92, '.', { size: 24, weight: 800 });
    s += text(W / 2, 112, `${p.op} ${p.by}: every digit moves ${k === 2 ? 'two places' : 'one place'} ${dir < 0 ? 'left' : 'right'}: ?`, { size: 12.5, fill: ASK, weight: 800 });
    return { svg: svg(120, s), line: `${p.op === '×' ? 'Times' : 'Divided by'} ${p.by} moves every digit ${k === 2 ? 'two places' : 'one place'} to the ${dir < 0 ? 'left' : 'right'}; the point stays where it is. Fill an empty place with 0.` };
  },
  // equal lots of a decimal: n bars, each labelled
  bars(p) {
    const n = p.n, bw = (W - 20) / n;
    let s = brace(10, W - 10, 28, '', { ask: true });
    for (let i = 0; i < n; i++) s += box(10 + i * bw, 34, bw - 3, 30) + text(10 + i * bw + (bw - 3) / 2, 54, p.label, { size: n > 6 ? 10.5 : 13 });
    return { svg: svg(74, s), line: p.line || '' };
  },
  // a decimal times a decimal as an area: the shaded part of a 1-by-1 square
  area(p) {
    const cell = 12, x0 = W / 2 - 60, y0 = 10;
    let s = '';
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
      const on = c < p.a && r < p.b;
      s += `<rect x="${f1(x0 + c * cell)}" y="${f1(y0 + r * cell)}" width="${cell}" height="${cell}" fill="${on ? FILL2 : '#fbf6ea'}" stroke="${SOFT}" stroke-width="0.6"/>`;
    }
    s += `<rect x="${x0}" y="${y0}" width="120" height="120" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
    s += `<rect x="${x0}" y="${y0}" width="${p.a * cell}" height="${p.b * cell}" fill="none" stroke="${ASK}" stroke-width="2"/>`;
    s += text(x0 + p.a * cell / 2, y0 + 120 + 18, `0.${p.a}`, { size: 13, fill: ASK, weight: 800 }) + text(x0 - 8, y0 + p.b * cell / 2 + 4, `0.${p.b}`, { size: 13, fill: ASK, weight: 800, anchor: 'end' });
    s += text(x0 + 140, y0 + 60, 'the whole square is 1', { size: 11.5, fill: SOFT, anchor: 'start' });
    return { svg: svg(150, s), line: `0.${p.a} × 0.${p.b} is the red box inside a square of 1 by 1. Each small square is one hundredth (0.01): count them.` };
  },
  // how many pieces fit: a bar as long as the whole, marked every piece
  fit(p) {
    const x0 = 10, x1 = W - 10, n = Math.round(p.whole / p.part), pw = (x1 - x0) / n;
    let s = brace(x0, x1, 26, `${Number.isInteger(p.whole) ? p.whole : dec(Math.round(p.whole * 10), 1)}`);
    for (let i = 0; i < n; i++) s += box(x0 + i * pw, 32, pw - 2, 28, { fill: i === 0 ? FILL2 : FILL, dash: i > 0 });
    s += text(x0 + pw / 2, 76, p.label, { size: 12.5, fill: BRASS, weight: 800 });
    s += text(W / 2, 98, `how many pieces of ${p.label} fit? ?`, { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(106, s), line: `Count how many pieces of ${p.label} it takes to make the whole: ${p.label}, then ${p.label} more, and so on. That's the same as dividing.` };
  },
  // up or down in percent: the old and the new side by side, the change compared with the old
  change(p) {
    const big = Math.max(p.old, p.now), x0 = 70, x1 = W - 20, sc = (x1 - x0) / big;
    const lab = (v) => (p.money ? `$${v}` : `${v}`);
    let s = text(x0 - 8, 36, 'before', { size: 12, anchor: 'end', fill: SOFT }) + box(x0, 18, p.old * sc, 28, { fill: FILL2 }) + text(x0 + p.old * sc / 2, 37, lab(p.old), { size: 13 });
    s += text(x0 - 8, 76, 'now', { size: 12, anchor: 'end', fill: SOFT }) + box(x0, 58, p.now * sc, 28) + text(x0 + Math.min(p.old, p.now) * sc / 2, 77, lab(p.now), { size: 13 });
    const a = Math.min(p.old, p.now) * sc, b = big * sc;
    s += box(x0 + a + 1, p.now > p.old ? 58 : 18, b - a - 1, 28, { fill: OFF, stroke: ASK, dash: true });
    s += text(W / 2, 108, `the change, out of ${lab(p.old)}: ?%`, { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(116, s), line: `First the change (how much it went ${p.now > p.old ? 'up' : 'down'}). Then compare it with where it started, ${lab(p.old)}: change ÷ ${p.old}, as a percent.` };
  },
  // simple interest: the same amount added each year
  interest(p) {
    const n = p.years, bw = (W - 20) / n, one = p.P * p.r / 100;
    let s = text(10, 16, `$${p.P} in the bank, ${p.r}% a year`, { size: 13, anchor: 'start', weight: 700 });
    for (let i = 0; i < n; i++) s += box(10 + i * bw, 26, bw - 4, 34, { fill: TAX, stroke: GREEN }) + text(10 + i * bw + (bw - 4) / 2, 40, `year ${i + 1}`, { size: 10.5, fill: GREEN }) + text(10 + i * bw + (bw - 4) / 2, 55, `${p.r}% of $${p.P}`, { size: 11 });
    s += brace(10, W - 14, 70, '', { up: false, ask: true });
    void one;
    return { svg: svg(100, s), line: `Each year adds ${p.r}% of $${p.P} (1% is $${p.P / 100}). Add up the ${n} years${p.total ? ', then the $' + p.P + ' that was put in' : ''}.` };
  },
  // a ratio table: so many lots, each lot b of one thing and a of the other
  ratiotable(p) {
    const k = p.k, show = k <= 5 ? Array.from({ length: k }, (_, i) => i + 1) : [1, 2, 3, null, k];
    const cw = Math.min(56, (W - 110) / show.length), x0 = 100;
    let s = text(x0 - 8, 36, p.top, { size: 11.5, anchor: 'end', fill: SOFT }) + text(x0 - 8, 72, p.bot, { size: 11.5, anchor: 'end', fill: SOFT });
    show.forEach((j, i) => {
      const x = x0 + i * cw;
      if (j == null) { s += text(x + cw / 2, 36, '…', { size: 16 }) + text(x + cw / 2, 72, '…', { size: 16 }); return; }
      s += box(x, 16, cw - 4, 28, { fill: j === k ? FILL2 : FILL }) + text(x + (cw - 4) / 2, 35, String(p.b * j), { size: 13.5, weight: 700 });
      if (j === k) s += box(x, 52, cw - 4, 28, { fill: OFF, stroke: ASK }) + q(x + (cw - 4) / 2, 72);
      else s += box(x, 52, cw - 4, 28) + text(x + (cw - 4) / 2, 71, String(p.a * j), { size: 13.5, weight: 700 });
    });
    s += text(x0 + cw / 2 - 2, 98, `+${p.b}, +${p.a} each time`, { size: 11.5, fill: BRASS, anchor: 'start', weight: 700 });
    return { svg: svg(106, s), line: `Every column is one more lot: ${p.b} more on top, ${p.a} more underneath. ${p.b * k} is ${k} lots of ${p.b}.` };
  },
  // shares by a ratio: a bar in a + b equal parts, a of them for one, b for the other
  ratiobar(p) {
    const parts = p.a + p.b, x0 = 10, x1 = W - 10, pw = (x1 - x0) / parts;
    let s = brace(x0, x1, 26, String(p.total));
    for (let i = 0; i < parts; i++) {
      const mine = i < p.a ? 0 : 1, asked = mine === p.ask;
      s += box(x0 + i * pw, 32, pw - 2, 30, { fill: mine ? FILL : FILL2, stroke: asked ? ASK : INK });
    }
    s += text(x0 + p.a * pw / 2, 80, p.names[0], { size: 12.5, weight: 700 }) + text(x0 + (p.a + p.b / 2) * pw, 80, p.names[1], { size: 12.5, weight: 700 });
    s += text(W / 2, 102, `${p.total} in ${parts} equal parts; ${p.names[p.ask]}: ?`, { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(110, s), line: `${p.a} to ${p.b} means ${parts} equal parts in all: ${p.a} for ${p.names[0]}, ${p.b} for ${p.names[1]}. Split ${p.total} into ${parts} parts first.` };
  },
};

export const COUNTER_TITLES = {
  coins: 'The coins', countup: 'Counting up the change', columns: 'Points lined up', bill: 'Two steps', deals: 'The price of one',
  pctbar: 'Cut into equal parts', clock: 'Reading the clock', timeline: 'Hour by hour', timetable: 'The timetable', hourbars: 'Hours and minutes',
  days: 'Day by day', tenths: 'Tenths', grid: 'Hundredths', shift: 'Moving the digits', bars: 'Equal lots', area: 'Tenths times tenths',
  fit: 'How many fit', change: 'Up or down', interest: 'Year by year', ratiotable: 'The ratio table', ratiobar: 'Parts of the whole',
};

export function counterPicture(pic) {
  if (!pic) return { svg: '', title: '', line: '' };
  const d = DRAW[pic.kind];
  if (!d) return storePicture(pic);
  const { svg: s, line } = d(pic);
  return { svg: s, title: COUNTER_TITLES[pic.kind] || '', line };
}
export { clock as clockText, dur as durText };
