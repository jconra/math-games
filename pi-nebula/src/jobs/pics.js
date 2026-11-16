// THE HELP PICTURES for a job's question. Mathwood Valley's own drawings for its makers' questions (src/ui/counterpics.js
// counterPicture, which falls back to src/ui/storepics.js: equal groups, sharing out, the ratio table, the ratio bar,
// the things to count), and this game's few for its own makers (the recipe's batches of cups, the drip bag hour by
// hour, an hour of drops; the smelter's canisters to count, a load cut into equal parts, canisters of ore each cut
// into parts of a tonne, tonne by tonne at a price, down the pay slip), drawn the same way: on a light card, the numbers given, the answer always a "?". A job's own
// order can also name one of Mathwood's pictures (order.pic) and give it its own title and line (order.help).
//   helpPicture(order) -> { svg, title, line }
import { counterPicture } from '../../../mathwood-valley/src/ui/counterpics.js';
import { fracText } from '../../../mathwood-valley/src/levels/kit.js';
import { partsWord } from '../../../mathwood-valley/labs/fishing/frac.js';

const INK = '#2b2219', SOFT = '#8a7558', FILL = '#ead9b2', FILL2 = '#d9bf8a', ASK = '#b5523a', BLUE = '#6fa8d6', W = 360;
const AMBER = '#e8922a', DARK = '#3a3f46', STEEL = '#c3c7cc', COOL = '#4d8fd6';
const svg = (h, body) => `<svg viewBox="0 0 ${W} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
const text = (x, y, s, { size = 13, fill = INK, weight = 600, anchor = 'middle' } = {}) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="system-ui, sans-serif">${s}</text>`;

const DRAW = {
  // batches of a recipe: a measuring cup per batch, filled to the recipe's amount; a half batch half as full
  cups({ amt, k, base, want }) {
    const n = Math.ceil(k[0] / k[1]), half = k[1] === 2, bw = Math.min(64, (W - 40) / n), x0 = (W - n * bw) / 2;
    const full = Math.min(1, amt[0] / amt[1]);
    let s = '';
    for (let i = 0; i < n; i++) {
      const last = half && i === n - 1, x = x0 + i * bw + 8, w = bw - 16, top = 26, h = 54;
      const f = full * (last ? 0.5 : 1);
      s += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="5" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`;
      s += `<rect x="${x + 2}" y="${top + h - 2 - (h - 4) * f}" width="${w - 4}" height="${(h - 4) * f}" rx="3" fill="${BLUE}" opacity="0.75"/>`;
      s += text(x + w / 2, top + h + 16, last ? 'half' : `${fracText(amt)}`, { size: 12, fill: SOFT });
      s += text(x + w / 2, 18, last ? `${base / 2} crew` : `${base} crew`, { size: 11, fill: SOFT });
    }
    s += text(W / 2, 118, `${want} crew: ${fracText(k)} batches of ${fracText(amt)} cup = ? cups`, { size: 14, fill: ASK, weight: 800 });
    return { svg: svg(128, s), line: '' };
  },
  // a drip bag shared out over the hours: one box an hour, each a "?"
  drip({ V, h }) {
    const bw = Math.min(46, (W - 120) / h), x0 = 100;
    let s = `<rect x="18" y="14" width="56" height="74" rx="10" fill="#fff" stroke="${INK}" stroke-width="1.4"/><rect x="22" y="30" width="48" height="54" rx="7" fill="${BLUE}" opacity="0.7"/>`;
    s += text(46, 62, `${V}`, { size: 15, weight: 800 }) + text(46, 104, 'mL in the bag', { size: 11, fill: SOFT });
    for (let i = 0; i < h; i++) {
      s += `<rect x="${x0 + i * bw}" y="34" width="${bw - 4}" height="34" rx="4" fill="${FILL}" stroke="${INK}" stroke-width="1.2"/>` + text(x0 + i * bw + (bw - 4) / 2, 56, '?', { size: 14, fill: ASK, weight: 800 });
      s += text(x0 + i * bw + (bw - 4) / 2, 84, `${i + 1}`, { size: 10, fill: SOFT });
    }
    s += text(x0 + (h * bw) / 2, 104, `${h} hours, the same in each`, { size: 12, fill: SOFT });
    return { svg: svg(116, s), line: '' };
  },
  // an hour of drops: R mL, each mL F drops, shared over 60 minutes
  drops({ R, F }) {
    let s = '';
    s += `<rect x="16" y="20" width="96" height="40" rx="6" fill="#fff" stroke="${INK}" stroke-width="1.4"/>` + text(64, 45, `${R} mL`, { size: 15, weight: 800 }) + text(64, 76, 'in an hour', { size: 11, fill: SOFT });
    s += text(130, 45, '×', { size: 20, weight: 800 });
    s += `<rect x="146" y="20" width="84" height="40" rx="6" fill="#fff" stroke="${INK}" stroke-width="1.4"/>` + text(188, 45, `${F} drops`, { size: 14, weight: 800 }) + text(188, 76, 'in each mL', { size: 11, fill: SOFT });
    s += text(248, 45, '÷', { size: 20, weight: 800 });
    s += `<rect x="264" y="20" width="80" height="40" rx="6" fill="#fff" stroke="${INK}" stroke-width="1.4"/>` + text(304, 45, '60', { size: 15, weight: 800 }) + text(304, 76, 'minutes', { size: 11, fill: SOFT });
    s += text(W / 2, 104, 'drops in a minute = ?', { size: 14, fill: ASK, weight: 800 });
    return { svg: svg(114, s), line: '' };
  },
};

// ── the smelter's canisters ──────────────────────────────────────────────────────────────────────────────────
// A canister lying on its side, as it hangs under the crane: a pale drum, a yellow strap near each end, a ring light
// at each end and a level window along its side. FULL: the window lit amber all the way along, amber rings. EMPTY:
// the window dark, blue rings (the lit window tells them apart, not the colour alone). GONE: a dotted shape where one
// was. (x, y) its middle; 64 wide, 26 high.
function canSide(x, y, look) {
  if (look === 'none') return `<rect x="${x - 32}" y="${y - 13}" width="64" height="26" rx="9" fill="none" stroke="${SOFT}" stroke-width="1.3" stroke-dasharray="4 4"/>`;
  const full = look === 'full', ring = full ? AMBER : COOL;
  return `<rect x="${x - 32}" y="${y - 13}" width="64" height="26" rx="9" fill="${STEEL}" stroke="${INK}" stroke-width="1.3"/>`
    + `<rect x="${x - 27}" y="${y - 13}" width="4" height="26" fill="${ring}"/><rect x="${x + 23}" y="${y - 13}" width="4" height="26" fill="${ring}"/>`
    + `<rect x="${x - 19}" y="${y - 5}" width="38" height="10" rx="2" fill="${DARK}"/>`
    + (full ? `<rect x="${x - 17}" y="${y - 3}" width="34" height="6" rx="1" fill="${AMBER}"/>` : `<rect x="${x - 17}" y="${y - 3}" width="3" height="6" rx="1" fill="${COOL}"/>`);
}
// the same canister seen end-on (on a rack, in a wall socket): eight-sided, its ring light round the end
function canEnd(x, y, look) {
  const pts = (r) => Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) * Math.PI / 4; return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`; }).join(' ');
  if (look === 'none') return `<polygon points="${pts(14)}" fill="none" stroke="${SOFT}" stroke-width="1.3" stroke-dasharray="4 4"/>`;
  const full = look === 'full';
  return `<polygon points="${pts(14)}" fill="${STEEL}" stroke="${INK}" stroke-width="1.3"/><circle cx="${x}" cy="${y}" r="9" fill="none" stroke="${full ? AMBER : COOL}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="3" fill="${full ? AMBER : DARK}"/>`;
}

Object.assign(DRAW, {
  // the canisters to count: on the Miner (its back drawn under them), at the wall (round sockets), on the rack, in a
  // plain row; or racks of the same. Up to four to a row.
  cans(p) {
    if (p.place === 'racks') {
      const bw = (W - 20) / p.g; let s = '';
      for (let i = 0; i < p.g; i++) {
        const x0 = 10 + i * bw, mid = x0 + bw / 2, span = Math.min(bw - 24, p.e * 34), dx = p.e > 1 ? span / p.e : 0, first = mid - dx * (p.e - 1) / 2;
        for (let k = 0; k < p.e; k++) s += canEnd(first + k * dx, 34, 'empty');
        s += `<path d="M${(x0 + 8).toFixed(1)} 52h${(bw - 16).toFixed(1)}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M${(x0 + 16).toFixed(1)} 52v12M${(x0 + bw - 16).toFixed(1)} 52v12" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
      }
      s += text(W / 2, 86, `${p.g} racks of ${p.e}: how many in all?`, { size: 14, fill: ASK, weight: 800 });
      return { svg: svg(96, s), line: '' };
    }
    const n = p.slots.length, cols = Math.min(4, n), rows = Math.ceil(n / cols), end = p.place === 'wall' || p.place === 'rack';
    const dx = end ? 46 : 78, dy = end ? 40 : 36, x0 = W / 2 - dx * (cols - 1) / 2, y0 = 26, h = y0 + (rows - 1) * dy + 30;
    let s = '';
    if (p.place === 'ship') s += `<path d="M${x0 - 62} ${y0 - 20}h${dx * (cols - 1) + 104}q26 ${(h - 12) / 2 - 6} 0 ${h - 12}h${-(dx * (cols - 1) + 104)}q-12 ${-(h - 12) / 2} 0 ${-(h - 12)}z" fill="${FILL}" stroke="${SOFT}" stroke-width="1.3"/>`;
    if (p.place === 'wall') s += `<rect x="${x0 - 34}" y="${y0 - 22}" width="${dx * (cols - 1) + 68}" height="${h - 8}" rx="4" fill="${FILL}" stroke="${SOFT}" stroke-width="1.3"/>`;
    p.slots.forEach((look, i) => {
      const x = x0 + (i % cols) * dx, y = y0 + Math.floor(i / cols) * dy;
      if (p.place === 'wall') s += `<circle cx="${x}" cy="${y}" r="19" fill="${FILL2}" stroke="${INK}" stroke-width="1.3"/>`;
      s += end ? canEnd(x, y, look) : canSide(x, y, look);
    });
    if (p.place === 'rack') for (let r = 0; r < rows; r++) { const y = y0 + r * dy + 17; s += `<path d="M${x0 - 26} ${y}h${dx * (cols - 1) + 52}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`; }
    return { svg: svg(h + 6, s), line: '' };
  },
  // a load cut into d equal parts, n of them taken: each part a "?" until it is worked out
  fracbar({ whole, n, d, it = 'load' }) {
    const x0 = 10, x1 = W - 10, pw = (x1 - x0) / d;
    let s = `<path d="M${x0} 26v-6H${x1}v6" fill="none" stroke="${SOFT}" stroke-width="1.3"/>` + text(W / 2, 14, `the ${it}: ${whole} tonnes`, { size: 13 });
    for (let i = 0; i < d; i++) {
      const on = i < n;
      s += `<rect x="${(x0 + i * pw).toFixed(1)}" y="32" width="${(pw - 2).toFixed(1)}" height="30" rx="3" fill="${on ? FILL2 : '#fff'}" stroke="${on ? ASK : INK}" stroke-width="1.3"/>`;
      if (on && pw > 22) s += text(x0 + i * pw + (pw - 2) / 2, 53, '?', { size: 15, fill: ASK, weight: 800 });
    }
    s += text(W / 2, 84, `${d} equal parts: each is ${whole} ÷ ${d}`, { size: 12.5, fill: SOFT });
    s += text(W / 2, 104, `${n}/${d} = the ${n === 1 ? 'shaded part' : `${n} shaded parts`}: ?`, { size: 14, fill: ASK, weight: 800 });
    return { svg: svg(114, s), line: '' };
  },
  // canisters of ore (a whole number of canisters times a fraction of a tonne): each canister drawn with its body cut
  // across in d equal parts, its a parts of ore shaded amber; up to four to a row. Under them: how many parts make a
  // tonne, and so many lots of a/d of a tonne, the answer a "?"
  orecans({ n, a, d, what = 'ore' }) {
    const cols = Math.min(4, n), rows = Math.ceil(n / cols), cw = 72, ch = 28, dx = 84, dy = 40, x0 = W / 2 - dx * (cols - 1) / 2, y0 = 40;
    let s = text(W / 2, 16, `in each canister: ${a}/${d} of a tonne of ${what}`, { size: 12.5, fill: SOFT });
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i % cols) * dx, cy = y0 + Math.floor(i / cols) * dy, x = cx - cw / 2, y = cy - ch / 2, pw = (cw - 14) / d;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw}" height="${ch}" rx="9" fill="${STEEL}" stroke="${INK}" stroke-width="1.3"/>`
        + `<rect x="${(x + 3).toFixed(1)}" y="${y.toFixed(1)}" width="3" height="${ch}" fill="${AMBER}"/><rect x="${(x + cw - 6).toFixed(1)}" y="${y.toFixed(1)}" width="3" height="${ch}" fill="${AMBER}"/>`;
      for (let k = 0; k < d; k++) {
        s += `<rect x="${(x + 7 + k * pw).toFixed(1)}" y="${(y + 4).toFixed(1)}" width="${(pw - 1.4).toFixed(1)}" height="${ch - 8}" rx="1.5" fill="${k < a ? AMBER : '#fff'}" stroke="${INK}" stroke-width="0.8"/>`;
      }
    }
    const yb = y0 + (rows - 1) * dy + ch / 2 + 22;
    s += text(W / 2, yb, `${d} ${partsWord(d)} make one tonne`, { size: 12.5, fill: SOFT });
    s += text(W / 2, yb + 22, `${n} lots of ${a}/${d} of a tonne = ? tonnes`, { size: 14, fill: ASK, weight: 800 });
    return { svg: svg(yb + 32, s), line: '' };
  },
  // tonnes at a price: a box for every whole tonne with what it pays, a shorter one for the part of a tonne
  paybars({ w, price }) {
    const whole = Math.floor(w / 10), part = w % 10, shown = Math.min(whole, 4), more = whole - shown, bw = 62, mw = 78, pw = part ? 34 + 3 * part : 0;
    let s = '', x = (W - (shown * bw + (more ? mw : 0) + pw)) / 2;
    for (let i = 0; i < shown; i++) { s += `<rect x="${x.toFixed(1)}" y="30" width="${bw - 4}" height="32" rx="3" fill="${FILL}" stroke="${INK}" stroke-width="1.3"/>` + text(x + (bw - 4) / 2, 51, String(price), { size: 14, weight: 800 }) + text(x + (bw - 4) / 2, 76, '1 tonne', { size: 10.5, fill: SOFT }); x += bw; }
    if (more) { s += `<rect x="${x.toFixed(1)}" y="30" width="${mw - 4}" height="32" rx="3" fill="none" stroke="${INK}" stroke-width="1.3" stroke-dasharray="4 3"/>` + text(x + (mw - 4) / 2, 50, `${more} more…`, { size: 11, fill: SOFT }); x += mw; }
    if (part) s += `<rect x="${x.toFixed(1)}" y="30" width="${pw - 4}" height="32" rx="3" fill="${FILL2}" stroke="${ASK}" stroke-width="1.3"/>` + text(x + (pw - 4) / 2, 52, '?', { size: 15, fill: ASK, weight: 800 })
      + `<path d="M${(x + (pw - 4) / 2).toFixed(1)} 64v8" stroke="${ASK}" stroke-width="1.2"/>` + text(Math.min(W - 44, x + (pw - 4) / 2), 86, `0.${part} of a tonne`, { size: 10.5, fill: ASK });
    s += text(W / 2, 16, `every tonne pays ${price} credits`, { size: 12.5, fill: SOFT });
    s += text(W / 2, 108, `${whole ? `${whole} × ${price}, and ` : ''}0.${part} × ${price}: how many credits?`, { size: 14, fill: ASK, weight: 800 });
    return { svg: svg(118, s), line: '' };
  },
  // down the pay slip: the ore, the part of it that is metal, what that pays; each a "?" until it is worked out
  // (each: what one canister holds as written on the slip, "3/4" for a haul's ore; else w, in tenths of a tonne)
  payslip({ n, w, each = null, pct, metal, price }) {
    const bx = [10, 128, 246], bw = 104, t1 = (x) => String(x / 10);
    const box = (i, top, mid, bot) => `<rect x="${bx[i]}" y="20" width="${bw}" height="62" rx="5" fill="${i === 2 ? FILL2 : '#fff'}" stroke="${i === 2 ? ASK : INK}" stroke-width="1.3"/>`
      + text(bx[i] + bw / 2, 37, top, { size: 11, fill: SOFT }) + text(bx[i] + bw / 2, 57, mid, { size: 13.5, weight: 800 }) + text(bx[i] + bw / 2, 75, bot, { size: 12, fill: ASK, weight: 800 });
    let s = box(0, '1. the ore', `${n} × ${each || t1(w)}`, '= ? tonnes') + box(1, `2. the ${metal}`, `${pct}% of it`, '= ? tonnes') + box(2, '3. the pay', `× ${price}`, '= ? credits');
    for (const x of [116, 234]) s += `<path d="M${x} 51h8m-4 -4l4 4l-4 4" fill="none" stroke="${SOFT}" stroke-width="1.6"/>`;
    return { svg: svg(92, s), line: '' };
  },
});

// ── the crane operator job's pictures (src/jobs/crane.js) ─────────────────────────────────────────────────────────
const t1 = (x) => String(Math.round(x * 10) / 10);
// the trolley, seen from the side: a block under a rail with the cradle hanging
const trolleyAt = (x, y) => `<rect x="${x - 13}" y="${y - 7}" width="26" height="12" rx="2" fill="${DARK}"/><path d="M${x} ${y + 5}v14" stroke="${INK}" stroke-width="1.6"/><rect x="${x - 9}" y="${y + 19}" width="18" height="7" rx="1.5" fill="${AMBER}" stroke="${INK}" stroke-width="1"/>`;
// a place the crane goes to, under the rail: a socket's ring, a canister on the rack, the turntable
// (by the place's words: the turntable; a socket, "socket 7" (not the Miner's "sockets' side"); a bay of the rack or an
// empty canister; else a full canister)
const placeAt = (x, y, what) => (/turntable/.test(what) ? `<circle cx="${x}" cy="${y + 2}" r="11" fill="${STEEL}" stroke="${INK}" stroke-width="1.4"/>`
  : /socket \d/.test(what) ? `<circle cx="${x}" cy="${y + 30}" r="12" fill="${FILL2}" stroke="${INK}" stroke-width="1.4"/><circle cx="${x}" cy="${y + 30}" r="5" fill="${DARK}"/>`
    : canEnd(x, y + 30, /empty|bay \d/.test(what) ? 'empty' : 'full'));
Object.assign(DRAW, {
  // the rail as a number line: its metre marks, the trolley, the place it goes to; hops to count, numbers to read, or
  // the gap between two marks
  rail({ from, to, hops = false, read = false, gap = false, what = '' }) {
    const lo = Math.min(from, to), hi = Math.max(from, to), whole = Math.abs(lo - Math.round(lo)) < 1e-6 && Math.abs(hi - Math.round(hi)) < 1e-6;
    const a = Math.floor(lo) - 1, b = Math.ceil(hi) + 1, n = b - a, x0 = 24, x1 = W - 24, X = (v) => x0 + (v - a) * (x1 - x0) / n, y = 38;
    const every = n > 24 ? 5 : n > 12 ? 2 : 1;
    let s = `<path d="M${x0 - 8} ${y}H${x1 + 8}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    for (let v = a; v <= b; v++) {
      const big = v % every === 0;
      s += `<path d="M${X(v).toFixed(1)} ${y - 4}v${big ? -10 : -6}" stroke="${INK}" stroke-width="${big ? 1.6 : 1}"/>`;
      if ((read || (gap && !whole)) && big && !hops) s += text(X(v), y - 18, String(v), { size: 10.5, fill: SOFT });
    }
    if (hops) {
      const dir = to > from ? 1 : -1;
      for (let v = from; dir > 0 ? v < to - 1e-6 : v > to + 1e-6; v += dir) { const p = X(v), q = X(v + dir), m = (p + q) / 2; s += `<path d="M${p.toFixed(1)} ${y - 6}Q${m.toFixed(1)} ${y - 24} ${q.toFixed(1)} ${y - 6}" fill="none" stroke="${ASK}" stroke-width="1.6"/>`; }
    }
    s += trolleyAt(X(from), y) + placeAt(X(to), y + 8, what);
    if (gap) {
      s += text(X(from), y - 18, t1(from), { size: 12, weight: 800 }) + text(X(to), y - 18, t1(to), { size: 12, weight: 800 });
      s += `<path d="M${X(lo).toFixed(1)} ${y + 58}v-6H${X(hi).toFixed(1)}v6" fill="none" stroke="${ASK}" stroke-width="1.5"/>` + text((X(lo) + X(hi)) / 2, y + 74, '? m', { size: 14, fill: ASK, weight: 800 });
    }
    // (a long name, as the Miner's places have, does not fit: then just the question)
    const say = hops ? 'Each hop is one metre: count the hops' : read ? (what.length <= 24 ? `${what}: which mark is it under?` : 'Which mark is it under?') : gap ? 'the way between the two marks' : '';
    s += text(W / 2, gap ? 128 : 112, say, { size: 12.5, fill: SOFT });
    return { svg: svg(gap ? 138 : 122, s), line: '' };
  },
  // the hoist's scale: the hook's height and where it goes, up or down (signed: up is plus, down is minus)
  hoist({ from, to, what = '', signed = false }) {
    const top = Math.max(7, Math.ceil(Math.max(from, to))), y0 = 112, y1 = 14, Y = (v) => y0 - v * (y0 - y1) / top, x = 120;
    let s = `<path d="M${x} ${y0}V${y1}" stroke="${INK}" stroke-width="2"/>`;
    for (let v = 0; v <= top; v++) s += `<path d="M${x - 6} ${Y(v).toFixed(1)}h12" stroke="${INK}" stroke-width="1.2"/>` + text(x - 22, Y(v) + 4, String(v), { size: 10.5, fill: SOFT });
    s += `<path d="M${x - 40} ${y0}H${x + 200}" stroke="${SOFT}" stroke-width="1.4"/>` + text(x + 170, y0 + 13, 'the floor', { size: 10.5, fill: SOFT });
    const hy = Y(from), ty = Y(to);
    s += `<rect x="${x + 24}" y="${hy - 6}" width="30" height="12" rx="2" fill="${AMBER}" stroke="${INK}" stroke-width="1"/>` + text(x + 92, hy + 4, `hook ${t1(from)} m`, { size: 11.5, weight: 700 });
    s += `<path d="M${x + 24} ${ty}h30" stroke="${COOL}" stroke-width="3"/>` + text(x + 120, ty + 4, `${what.length > 22 ? 'the place' : what} ${t1(to)} m`, { size: 11, fill: SOFT, anchor: 'start' });
    s += `<path d="M${x + 39} ${hy + (to < from ? 7 : -7)}V${ty + (to < from ? -4 : 4)}" stroke="${ASK}" stroke-width="1.8" marker-end="url(#ah)"/>`;
    s += text(x + 70, (hy + ty) / 2 + 4, signed ? (to < from ? '− ?' : '+ ?') : '? m', { size: 14, fill: ASK, weight: 800 });
    const defs = `<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="${ASK}"/></marker></defs>`;
    return { svg: svg(126, defs + s), line: '' };
  },
  // a way at a speed: a second at a time
  speed({ d, v }) {
    const secs = Math.round(d / v), shown = Math.min(secs, 6), x0 = 20, x1 = W - 20, w = (x1 - x0) / (secs > 6 ? shown + 1.5 : shown);
    let s = '';
    for (let i = 0; i < shown; i++) s += `<rect x="${(x0 + i * w).toFixed(1)}" y="34" width="${(w - 3).toFixed(1)}" height="22" rx="3" fill="${FILL}" stroke="${INK}" stroke-width="1.2"/>` + text(x0 + i * w + (w - 3) / 2, 49, `${t1(v)} m`, { size: 10.5 }) + text(x0 + i * w + (w - 3) / 2, 72, '1 s', { size: 10.5, fill: SOFT });
    if (secs > 6) s += text(x0 + shown * w + w * 0.7, 50, '…', { size: 18, fill: SOFT, weight: 800 });
    s += `<path d="M${x0} 22v-6H${x1}v6" fill="none" stroke="${SOFT}" stroke-width="1.3"/>` + text(W / 2, 12, `${t1(d)} m in all`, { size: 12.5 });
    s += text(W / 2, 100, `${t1(v)} m every second: how many seconds make ${t1(d)} m? ?`, { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(110, s), line: '' };
  },
  // across the trolley's beam: its marks from the middle, the carriage, where it goes
  beam({ from, to }) {
    const x0 = 40, x1 = W - 40, X = (v) => x0 + (v + 1.3) * (x1 - x0) / 2.6, y = 46;
    let s = `<rect x="${x0 - 10}" y="${y - 9}" width="${x1 - x0 + 20}" height="14" rx="3" fill="${STEEL}" stroke="${INK}" stroke-width="1.2"/>`;
    for (let v = -12; v <= 12; v += 2) { const p = X(v / 10); s += `<path d="M${p.toFixed(1)} ${y + 5}v${v % 10 === 0 ? 9 : 5}" stroke="${INK}" stroke-width="1"/>`; if (v % 4 === 0) s += text(p, y + 26, t1(v / 10), { size: 10, fill: SOFT }); }
    s += `<rect x="${X(from) - 12}" y="${y - 16}" width="24" height="12" rx="2" fill="${AMBER}" stroke="${INK}" stroke-width="1"/>` + `<path d="M${X(to)} ${y - 22}v14" stroke="${COOL}" stroke-width="3"/>`;
    s += `<path d="M${X(Math.min(from, to))} ${y + 40}v-5H${X(Math.max(from, to))}v5" fill="none" stroke="${ASK}" stroke-width="1.5"/>` + text((X(from) + X(to)) / 2, y + 56, '? m', { size: 14, fill: ASK, weight: 800 });
    return { svg: svg(112, s), line: '' };
  },
  // the crane's plate and the load: the canister and its ore, against what the plate says
  plate({ empty, ore, rated, more = false }) {
    const x0 = 24, x1 = W - 24, X = (v) => x0 + v * (x1 - x0) / rated, y = 40;
    let s = `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="26" rx="3" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`;
    s += `<rect x="${x0}" y="${y}" width="${(X(empty) - x0).toFixed(1)}" height="26" fill="${STEEL}" stroke="${INK}" stroke-width="1"/>` + text((x0 + X(empty)) / 2, y + 17, `${t1(empty)} t`, { size: 11 });
    s += `<rect x="${X(empty).toFixed(1)}" y="${y}" width="${(X(empty + ore) - X(empty)).toFixed(1)}" height="26" fill="${AMBER}" opacity="0.8" stroke="${INK}" stroke-width="1"/>` + text((X(empty) + X(empty + ore)) / 2, y + 17, `ore ${t1(ore)} t`, { size: 11, weight: 700 });
    s += text(x0, y - 8, 'the canister', { size: 10.5, fill: SOFT, anchor: 'start' }) + text(x1, y - 8, `the plate: ${rated} t`, { size: 11.5, weight: 800, anchor: 'end' });
    s += `<path d="M${x1} ${y - 4}v34" stroke="${ASK}" stroke-width="2" stroke-dasharray="4 3"/>`;
    s += more ? `<path d="M${X(empty + ore).toFixed(1)} ${y + 36}v-5H${x1}v5" fill="none" stroke="${ASK}" stroke-width="1.5"/>` + text((X(empty + ore) + x1) / 2, y + 52, '? t to spare', { size: 13, fill: ASK, weight: 800 })
      : `<path d="M${x0} ${y + 36}v-5H${X(empty + ore).toFixed(1)}v5" fill="none" stroke="${ASK}" stroke-width="1.5"/>` + text((x0 + X(empty + ore)) / 2, y + 52, '? t on the hook', { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(104, s), line: '' };
  },
  // the round's trips: one canister a trip, in lots
  trips({ lots }) {
    const names = ['to the wall', 'onto the ship', 'back to the rack'];
    let s = '';
    lots.forEach((n, r) => {
      const y = 22 + r * 30;
      s += text(14, y + 4, names[r] || '', { size: 11, fill: SOFT, anchor: 'start' });
      for (let i = 0; i < n; i++) s += canEnd(118 + i * 28, y, r === 0 ? 'full' : 'empty').replace(/r="9"/, 'r="7"');
      s += text(W - 16, y + 5, String(n), { size: 13, weight: 800, anchor: 'end' });
    });
    s += text(W / 2, 22 + lots.length * 30 + 6, 'one canister a trip: how many trips? ?', { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(30 + lots.length * 30 + 12, s), line: '' };
  },
  // the way along and across: the T of the rail from above, each part with its marks
  route({ legs, across }) {
    const tx = 240, ty = 26;
    let s = `<path d="M24 ${ty}H${W - 20}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M${tx} ${ty}V${ty + 86}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="${tx}" cy="${ty}" r="8" fill="${STEEL}" stroke="${INK}" stroke-width="1.4"/>`;
    const w = legs.find((g) => g.leg === 'wall'), sh = legs.find((g) => g.leg === 'ship');
    if (w) s += `<path d="M${tx + 90} ${ty - 10}H${tx + 12}" stroke="${ASK}" stroke-width="2" marker-end="url(#rh)"/>` + text(tx + 52, ty - 14, `${t1(w.mark)} → ${t1(w.markTo)} m`, { size: 11, weight: 700 }) + text(tx + 52, ty + 18, '? m', { size: 12, fill: ASK, weight: 800 });
    if (sh) s += `<path d="M${tx + 10} ${ty + 12}V${ty + 70}" stroke="${ASK}" stroke-width="2" marker-end="url(#rh)"/>` + text(tx + 18, ty + 46, `${t1(sh.mark)} → ${t1(sh.markTo)} m`, { size: 11, weight: 700, anchor: 'start' }) + text(tx + 18, ty + 62, '? m', { size: 12, fill: ASK, weight: 800, anchor: 'start' });
    s += `<path d="M${tx} ${ty + 80}H${tx - 50}" stroke="${ASK}" stroke-width="2" marker-end="url(#rh)"/>` + text(tx - 30, ty + 98, `across ${t1(Math.abs(across.to - across.from))} m`, { size: 11, weight: 700 });
    s += text(70, ty + 18, 'the wall rail', { size: 10.5, fill: SOFT }) + text(tx - 50, ty + 46, 'the ship rail', { size: 10.5, fill: SOFT });
    const defs = `<defs><marker id="rh" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="${ASK}"/></marker></defs>`;
    s += text(W / 2, ty + 120, 'each part, then add them: ?', { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(ty + 130, defs + s), line: '' };
  },
});

export function helpPicture(order) {
  if (!order) return { svg: '', title: '', line: '' };
  // (a job's own question may bring its help picture drawn already: the dock's, src/jobs/dock.js)
  if (order.help && order.help.svg) return { svg: order.help.svg, title: order.help.title || '', line: order.help.line || '' };
  if (order.help && order.help.pic && DRAW[order.help.pic.kind]) {
    const d = DRAW[order.help.pic.kind](order.help.pic);
    return { svg: d.svg, title: order.help.title || '', line: order.help.line || d.line };
  }
  if (!order.pic) return { svg: '', title: '', line: '' };
  // (one of Mathwood's pictures; a job's own order may give it its own title and line)
  const h = order.help || {};
  try { const d = counterPicture(order.pic); return { svg: d.svg, title: h.title || d.title, line: h.line || d.line }; } catch (e) { console.warn('Pi Nebula: no picture for', order.pic, e); return { svg: '', title: '', line: '' }; }
}
