// THE HELP PICTURES for a job's question. Mathwood Valley's own drawings for its makers' questions (src/ui/counterpics.js
// counterPicture, which falls back to src/ui/storepics.js: equal groups, sharing out, the ratio table, the ratio bar,
// the things to count), and this game's few for its own makers (the recipe's batches of cups, the drip bag hour by
// hour, an hour of drops; the smelter's canisters to count, a load cut into equal parts, lots of a fraction of a
// tonne each cut into its parts, tonne by tonne at a price), drawn the same way: on a light card, the
// numbers given, the answer always a "?". A job's own order can also name one of Mathwood's pictures (order.pic) and
// give it its own title and line (order.help).
//   helpPicture(order) -> { svg, title, line }
import { counterPicture } from '../../../mathwood-valley/src/ui/counterpics.js';
import { fracText } from '../../../mathwood-valley/src/levels/kit.js';
import { partsWord } from '../../../mathwood-valley/labs/fishing/frac.js';

// THE COLOURS, in one place. PALE is the light card every picture has been drawn on from the start (the station's
// older jobs). NIGHT is the same drawings dark, with light lines: the pilot's jump computer and the drill's cards use
// it (a job says so with `dark: true`), and any other job could (the game's maker, 2026-11-18: "This is a space game,
// we don't need a bunch of white graphs on the screen. Try to keep things 'dark mode'"). Every drawing below takes its
// colours from K, whichever of the two is in use while it is drawn (themed). One of Mathwood Valley's own drawings
// asked for dark is not redrawn (its look is Mathwood's): the panel turns it dark as it shows it (helpPicture's `flip`,
// src/jobs/jobs.css).
export const PALE = { INK: '#2b2219', SOFT: '#8a7558', FILL: '#ead9b2', FILL2: '#d9bf8a', ASK: '#b5523a', BLUE: '#6fa8d6', AMBER: '#e8922a', DARK: '#3a3f46', STEEL: '#c3c7cc', COOL: '#4d8fd6',
  PAPER: '#fff', CARD: '#f4ecdc', GRID: '#c9bb9c', PLANET: '#c9935a', RING: '#b9a27a', FIELD: '#b5523a', SHIP: '#2f6db3' };
export const NIGHT = { INK: '#dfe9f2', SOFT: '#8fa3b6', FILL: '#1b2836', FILL2: '#2b4259', ASK: '#ffd560', BLUE: '#6fc3ff', AMBER: '#ffab45', DARK: '#06090d', STEEL: '#3d4a58', COOL: '#58a6ff',
  PAPER: '#121b25', CARD: '#0b1118', GRID: '#263749', PLANET: '#d9a066', RING: '#c2b08a', FIELD: '#ff8a5c', SHIP: '#6fc3ff' };
let K = PALE;
// fn drawn in the dark colours (dark true) or the pale ones
export function themed(dark, fn) { const was = K; K = dark ? NIGHT : PALE; try { return fn(); } finally { K = was; } }
const W = 360;
const svg = (h, body) => `<svg viewBox="0 0 ${W} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
const text = (x, y, s, { size = 13, fill = K.INK, weight = 600, anchor = 'middle' } = {}) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="system-ui, sans-serif">${s}</text>`;

const DRAW = {
  // batches of a recipe: a measuring cup per batch, filled to the recipe's amount; a half batch half as full
  cups({ amt, k, base, want }) {
    const n = Math.ceil(k[0] / k[1]), half = k[1] === 2, bw = Math.min(64, (W - 40) / n), x0 = (W - n * bw) / 2;
    const full = Math.min(1, amt[0] / amt[1]);
    let s = '';
    for (let i = 0; i < n; i++) {
      const last = half && i === n - 1, x = x0 + i * bw + 8, w = bw - 16, top = 26, h = 54;
      const f = full * (last ? 0.5 : 1);
      s += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="5" fill="${K.PAPER}" stroke="${K.INK}" stroke-width="1.4"/>`;
      s += `<rect x="${x + 2}" y="${top + h - 2 - (h - 4) * f}" width="${w - 4}" height="${(h - 4) * f}" rx="3" fill="${K.BLUE}" opacity="0.75"/>`;
      s += text(x + w / 2, top + h + 16, last ? 'half' : `${fracText(amt)}`, { size: 12, fill: K.SOFT });
      s += text(x + w / 2, 18, last ? `${base / 2} crew` : `${base} crew`, { size: 11, fill: K.SOFT });
    }
    s += text(W / 2, 118, `${want} crew: ${fracText(k)} batches of ${fracText(amt)} cup = ? cups`, { size: 14, fill: K.ASK, weight: 800 });
    return { svg: svg(128, s), line: '' };
  },
  // a drip bag shared out over the hours: one box an hour, each a "?"
  drip({ V, h }) {
    const bw = Math.min(46, (W - 120) / h), x0 = 100;
    let s = `<rect x="18" y="14" width="56" height="74" rx="10" fill="${K.PAPER}" stroke="${K.INK}" stroke-width="1.4"/><rect x="22" y="30" width="48" height="54" rx="7" fill="${K.BLUE}" opacity="0.7"/>`;
    s += text(46, 62, `${V}`, { size: 15, weight: 800 }) + text(46, 104, 'mL in the bag', { size: 11, fill: K.SOFT });
    for (let i = 0; i < h; i++) {
      s += `<rect x="${x0 + i * bw}" y="34" width="${bw - 4}" height="34" rx="4" fill="${K.FILL}" stroke="${K.INK}" stroke-width="1.2"/>` + text(x0 + i * bw + (bw - 4) / 2, 56, '?', { size: 14, fill: K.ASK, weight: 800 });
      s += text(x0 + i * bw + (bw - 4) / 2, 84, `${i + 1}`, { size: 10, fill: K.SOFT });
    }
    s += text(x0 + (h * bw) / 2, 104, `${h} hours, the same in each`, { size: 12, fill: K.SOFT });
    return { svg: svg(116, s), line: '' };
  },
  // an hour of drops: R mL, each mL F drops, shared over 60 minutes
  drops({ R, F }) {
    let s = '';
    s += `<rect x="16" y="20" width="96" height="40" rx="6" fill="${K.PAPER}" stroke="${K.INK}" stroke-width="1.4"/>` + text(64, 45, `${R} mL`, { size: 15, weight: 800 }) + text(64, 76, 'in an hour', { size: 11, fill: K.SOFT });
    s += text(130, 45, '×', { size: 20, weight: 800 });
    s += `<rect x="146" y="20" width="84" height="40" rx="6" fill="${K.PAPER}" stroke="${K.INK}" stroke-width="1.4"/>` + text(188, 45, `${F} drops`, { size: 14, weight: 800 }) + text(188, 76, 'in each mL', { size: 11, fill: K.SOFT });
    s += text(248, 45, '÷', { size: 20, weight: 800 });
    s += `<rect x="264" y="20" width="80" height="40" rx="6" fill="${K.PAPER}" stroke="${K.INK}" stroke-width="1.4"/>` + text(304, 45, '60', { size: 15, weight: 800 }) + text(304, 76, 'minutes', { size: 11, fill: K.SOFT });
    s += text(W / 2, 104, 'drops in a minute = ?', { size: 14, fill: K.ASK, weight: 800 });
    return { svg: svg(114, s), line: '' };
  },
};

// ── the smelter's canisters ──────────────────────────────────────────────────────────────────────────────────
// A canister lying on its side, as it hangs under the crane: a pale drum, a yellow strap near each end, a ring light
// at each end and a level window along its side. FULL: the window lit amber all the way along, amber rings. EMPTY:
// the window dark, blue rings (the lit window tells them apart, not the colour alone). GONE: a dotted shape where one
// was. (x, y) its middle; 64 wide, 26 high.
function canSide(x, y, look) {
  if (look === 'none') return `<rect x="${x - 32}" y="${y - 13}" width="64" height="26" rx="9" fill="none" stroke="${K.SOFT}" stroke-width="1.3" stroke-dasharray="4 4"/>`;
  const full = look === 'full', ring = full ? K.AMBER : K.COOL;
  return `<rect x="${x - 32}" y="${y - 13}" width="64" height="26" rx="9" fill="${K.STEEL}" stroke="${K.INK}" stroke-width="1.3"/>`
    + `<rect x="${x - 27}" y="${y - 13}" width="4" height="26" fill="${ring}"/><rect x="${x + 23}" y="${y - 13}" width="4" height="26" fill="${ring}"/>`
    + `<rect x="${x - 19}" y="${y - 5}" width="38" height="10" rx="2" fill="${K.DARK}"/>`
    + (full ? `<rect x="${x - 17}" y="${y - 3}" width="34" height="6" rx="1" fill="${K.AMBER}"/>` : `<rect x="${x - 17}" y="${y - 3}" width="3" height="6" rx="1" fill="${K.COOL}"/>`);
}
// the same canister seen end-on (on a rack, in a wall socket): eight-sided, its ring light round the end
function canEnd(x, y, look) {
  const pts = (r) => Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) * Math.PI / 4; return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`; }).join(' ');
  if (look === 'none') return `<polygon points="${pts(14)}" fill="none" stroke="${K.SOFT}" stroke-width="1.3" stroke-dasharray="4 4"/>`;
  const full = look === 'full';
  return `<polygon points="${pts(14)}" fill="${K.STEEL}" stroke="${K.INK}" stroke-width="1.3"/><circle cx="${x}" cy="${y}" r="9" fill="none" stroke="${full ? K.AMBER : K.COOL}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="3" fill="${full ? K.AMBER : K.DARK}"/>`;
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
        s += `<path d="M${(x0 + 8).toFixed(1)} 52h${(bw - 16).toFixed(1)}" stroke="${K.INK}" stroke-width="3" stroke-linecap="round"/><path d="M${(x0 + 16).toFixed(1)} 52v12M${(x0 + bw - 16).toFixed(1)} 52v12" stroke="${K.INK}" stroke-width="2.4" stroke-linecap="round"/>`;
      }
      s += text(W / 2, 86, `${p.g} racks of ${p.e}: how many in all?`, { size: 14, fill: K.ASK, weight: 800 });
      return { svg: svg(96, s), line: '' };
    }
    const n = p.slots.length, cols = Math.min(4, n), rows = Math.ceil(n / cols), end = p.place === 'wall' || p.place === 'rack';
    const dx = end ? 46 : 78, dy = end ? 40 : 36, x0 = W / 2 - dx * (cols - 1) / 2, y0 = 26, h = y0 + (rows - 1) * dy + 30;
    let s = '';
    if (p.place === 'ship') s += `<path d="M${x0 - 62} ${y0 - 20}h${dx * (cols - 1) + 104}q26 ${(h - 12) / 2 - 6} 0 ${h - 12}h${-(dx * (cols - 1) + 104)}q-12 ${-(h - 12) / 2} 0 ${-(h - 12)}z" fill="${K.FILL}" stroke="${K.SOFT}" stroke-width="1.3"/>`;
    if (p.place === 'wall') s += `<rect x="${x0 - 34}" y="${y0 - 22}" width="${dx * (cols - 1) + 68}" height="${h - 8}" rx="4" fill="${K.FILL}" stroke="${K.SOFT}" stroke-width="1.3"/>`;
    p.slots.forEach((look, i) => {
      const x = x0 + (i % cols) * dx, y = y0 + Math.floor(i / cols) * dy;
      if (p.place === 'wall') s += `<circle cx="${x}" cy="${y}" r="19" fill="${K.FILL2}" stroke="${K.INK}" stroke-width="1.3"/>`;
      s += end ? canEnd(x, y, look) : canSide(x, y, look);
    });
    if (p.place === 'rack') for (let r = 0; r < rows; r++) { const y = y0 + r * dy + 17; s += `<path d="M${x0 - 26} ${y}h${dx * (cols - 1) + 52}" stroke="${K.INK}" stroke-width="3" stroke-linecap="round"/>`; }
    return { svg: svg(h + 6, s), line: '' };
  },
  // THE PEOPLE A RESCUE BROUGHT HOME, to count (src/missions.js, the rescue's payout card): a small figure for each, up
  // to four to a row
  people({ n }) {
    const cols = Math.min(4, Math.max(1, n)), rows = Math.ceil(n / cols), dx = 64, dy = 62, x0 = W / 2 - dx * (cols - 1) / 2, y0 = 14;
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + (i % cols) * dx, y = y0 + Math.floor(i / cols) * dy;
      s += `<circle cx="${x}" cy="${y + 9}" r="9" fill="${K.FILL2}" stroke="${K.INK}" stroke-width="1.3"/><path d="M${x - 15} ${y + 50}v-13a15 15 0 0 1 30 0v13z" fill="${K.FILL}" stroke="${K.INK}" stroke-width="1.3"/>`;
    }
    return { svg: svg(y0 + rows * dy - 4, s), line: '' };
  },
  // THE PLACES AN EXPLORING RUN WENT TO, to count (src/missions.js, the exploring run's payout card): a small planet for
  // each, its ring round it, up to four to a row
  places({ n }) {
    const cols = Math.min(4, Math.max(1, n)), rows = Math.ceil(n / cols), dx = 70, dy = 60, x0 = W / 2 - dx * (cols - 1) / 2, y0 = 30;
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + (i % cols) * dx, y = y0 + Math.floor(i / cols) * dy;
      s += `<circle cx="${x}" cy="${y}" r="16" fill="${K.FILL2}" stroke="${K.INK}" stroke-width="1.3"/><ellipse cx="${x}" cy="${y + 1}" rx="27" ry="7" fill="none" stroke="${K.INK}" stroke-width="1.3" transform="rotate(-14 ${x} ${y})"/>`;
    }
    return { svg: svg(y0 + (rows - 1) * dy + 30, s), line: '' };
  },
  // THE PALLETS A SUPPLY RUN DELIVERED, to count (src/missions.js, the supply run's payout card): a loaded pallet for
  // each (two crates on its boards), up to four to a row
  pallets({ n }) {
    const cols = Math.min(4, Math.max(1, n)), rows = Math.ceil(n / cols), dx = 70, dy = 58, x0 = W / 2 - dx * (cols - 1) / 2, y0 = 8;
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + (i % cols) * dx, y = y0 + Math.floor(i / cols) * dy;
      s += `<rect x="${x - 22}" y="${y}" width="20" height="30" fill="${K.FILL2}" stroke="${K.INK}" stroke-width="1.3"/><rect x="${x + 2}" y="${y + 8}" width="20" height="22" fill="${K.FILL}" stroke="${K.INK}" stroke-width="1.3"/>`
        + `<path d="M${x - 26} ${y + 32}h52v5h-52zM${x - 22} ${y + 37}v5M${x} ${y + 37}v5M${x + 22} ${y + 37}v5" fill="${K.FILL2}" stroke="${K.INK}" stroke-width="1.3"/>`;
    }
    return { svg: svg(y0 + rows * dy - 10, s), line: '' };
  },
  // a load cut into d equal parts, n of them taken: each part a "?" until it is worked out
  // (unit: what the load is counted in, 'tonnes' or 'canisters'; it: what it is called over the bar, or none: "12 tonnes in all")
  fracbar({ whole, n, d, it = 'load', unit = 'tonnes' }) {
    const x0 = 10, x1 = W - 10, pw = (x1 - x0) / d;
    let s = `<path d="M${x0} 26v-6H${x1}v6" fill="none" stroke="${K.SOFT}" stroke-width="1.3"/>` + text(W / 2, 14, it ? `the ${it}: ${whole} ${unit}` : `${whole} ${unit} in all`, { size: 13 });
    for (let i = 0; i < d; i++) {
      const on = i < n;
      s += `<rect x="${(x0 + i * pw).toFixed(1)}" y="32" width="${(pw - 2).toFixed(1)}" height="30" rx="3" fill="${on ? K.FILL2 : K.PAPER}" stroke="${on ? K.ASK : K.INK}" stroke-width="1.3"/>`;
      if (on && pw > 22) s += text(x0 + i * pw + (pw - 2) / 2, 53, '?', { size: 15, fill: K.ASK, weight: 800 });
    }
    s += text(W / 2, 84, `${d} equal parts: each is ${whole} ÷ ${d}`, { size: 12.5, fill: K.SOFT });
    s += text(W / 2, 104, `${n}/${d} = the ${n === 1 ? 'shaded part' : `${n} shaded parts`}: ?`, { size: 14, fill: K.ASK, weight: 800 });
    return { svg: svg(114, s), line: '' };
  },
  // lots of a fraction (a whole number of trips, pours or pallets, a fraction of a tonne in each): each lot drawn as
  // a box cut across in d equal parts, its a parts of metal shaded amber; up to four to a row. Over them what is in
  // each (`on`: "on each trip"); under them how many parts make a tonne, and so many lots of a/d of a tonne, the
  // answer a "?"
  fraclots({ n, a, d, what = 'metal', on = 'in each' }) {
    const cols = Math.min(4, n), rows = Math.ceil(n / cols), cw = 72, ch = 28, dx = 84, dy = 40, x0 = W / 2 - dx * (cols - 1) / 2, y0 = 40;
    let s = text(W / 2, 16, `${on}: ${a}/${d} of a tonne of ${what}`, { size: 12.5, fill: K.SOFT });
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i % cols) * dx, cy = y0 + Math.floor(i / cols) * dy, x = cx - cw / 2, y = cy - ch / 2, pw = (cw - 8) / d;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw}" height="${ch}" rx="4" fill="${K.STEEL}" stroke="${K.INK}" stroke-width="1.3"/>`;
      for (let k = 0; k < d; k++) {
        s += `<rect x="${(x + 4 + k * pw).toFixed(1)}" y="${(y + 4).toFixed(1)}" width="${(pw - 1.4).toFixed(1)}" height="${ch - 8}" rx="1.5" fill="${k < a ? K.AMBER : K.PAPER}" stroke="${K.INK}" stroke-width="0.8"/>`;
      }
    }
    const yb = y0 + (rows - 1) * dy + ch / 2 + 22;
    s += text(W / 2, yb, `${d} ${partsWord(d)} make one tonne`, { size: 12.5, fill: K.SOFT });
    s += text(W / 2, yb + 22, `${n} lots of ${a}/${d} of a tonne = ? tonnes`, { size: 14, fill: K.ASK, weight: 800 });
    return { svg: svg(yb + 32, s), line: '' };
  },
  // tonnes at a price: a box for every whole tonne with what it sells for, a shorter one for the part of a tonne
  paybars({ w, price }) {
    const whole = Math.floor(w / 10), part = w % 10, shown = Math.min(whole, 4), more = whole - shown, bw = 62, mw = 78, pw = part ? 34 + 3 * part : 0;
    // (the price as it is said, 60,000: smaller in its box as it grows longer)
    const pr = Number(price).toLocaleString('en-US'), ps = pr.length > 6 ? 11 : pr.length > 5 ? 12.5 : 14;
    let s = '', x = (W - (shown * bw + (more ? mw : 0) + pw)) / 2;
    for (let i = 0; i < shown; i++) { s += `<rect x="${x.toFixed(1)}" y="30" width="${bw - 4}" height="32" rx="3" fill="${K.FILL}" stroke="${K.INK}" stroke-width="1.3"/>` + text(x + (bw - 4) / 2, 51, pr, { size: ps, weight: 800 }) + text(x + (bw - 4) / 2, 76, '1 tonne', { size: 10.5, fill: K.SOFT }); x += bw; }
    if (more) { s += `<rect x="${x.toFixed(1)}" y="30" width="${mw - 4}" height="32" rx="3" fill="none" stroke="${K.INK}" stroke-width="1.3" stroke-dasharray="4 3"/>` + text(x + (mw - 4) / 2, 50, `${more} more…`, { size: 11, fill: K.SOFT }); x += mw; }
    if (part) s += `<rect x="${x.toFixed(1)}" y="30" width="${pw - 4}" height="32" rx="3" fill="${K.FILL2}" stroke="${K.ASK}" stroke-width="1.3"/>` + text(x + (pw - 4) / 2, 52, '?', { size: 15, fill: K.ASK, weight: 800 })
      + `<path d="M${(x + (pw - 4) / 2).toFixed(1)} 64v8" stroke="${K.ASK}" stroke-width="1.2"/>` + text(Math.min(W - 44, x + (pw - 4) / 2), 86, `0.${part} of a tonne`, { size: 10.5, fill: K.ASK });
    s += text(W / 2, 16, `every tonne sells for ${pr} credits`, { size: 12.5, fill: K.SOFT });
    const last = `${whole ? `${whole} × ${pr}, and ` : ''}0.${part} × ${pr}: how many credits?`;
    s += text(W / 2, 108, last, { size: last.length > 40 ? 12.5 : 14, fill: K.ASK, weight: 800 });
    return { svg: svg(118, s), line: '' };
  },
});

// ── the pilot's seat (src/jobs/pilot.js): the jump computer's picture of the way, and the payout's two (src/missions.js) ──
// The two ends of a way: the station (a ring with four spokes) and the rocks (two lumps). (x, y) the middle of each.
const say = (n) => Number(n).toLocaleString('en-US');
const stationAt = (x, y) => `<circle cx="${x}" cy="${y}" r="8.5" fill="${K.PAPER}" stroke="${K.INK}" stroke-width="2.2"/><circle cx="${x}" cy="${y}" r="3" fill="${K.COOL}"/><path d="M${x - 13} ${y}h4.5M${x + 8.5} ${y}h4.5M${x} ${y - 13}v4.5M${x} ${y + 8.5}v4.5" stroke="${K.INK}" stroke-width="2"/>`;
const rocksAt = (x, y) => `<path d="M${x - 12} ${y + 6}l-1 -8l6 -7l8 1l4 7l-4 8z" fill="${K.SOFT}" stroke="${K.INK}" stroke-width="1.2"/><path d="M${x + 4} ${y + 9}l-1 -5l5 -3l5 3l-2 6z" fill="${K.FILL2}" stroke="${K.INK}" stroke-width="1.1"/>`;
// (from where, to where: [the near end's drawing, the far end's, their names])
const endsOf = (to) => (to === 'home' ? [rocksAt, stationAt, 'the rocks', 'the station'] : [stationAt, rocksAt, 'the station', 'the rocks']);
const hop = (xa, xb, y, h, colour, dash = '') => `<path d="M${xa.toFixed(1)} ${y}Q${((xa + xb) / 2).toFixed(1)} ${(y - h).toFixed(1)} ${xb.toFixed(1)} ${y}" fill="none" stroke="${colour}" stroke-width="2.6" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
// a bracket over x0..x1 with its words above it (the whole of a way: its length, or a "?")
const over = (x0, x1, y, words, ask = false) => `<path d="M${x0} ${y + 7}v-6H${x1}v6" fill="none" stroke="${ask ? K.ASK : K.SOFT}" stroke-width="1.4"/>` + text((x0 + x1) / 2, y - 5, words, { size: 13, fill: ask ? K.ASK : K.INK, weight: ask ? 800 : 700 });

Object.assign(DRAW, {
  // THE HOPS on the way (the youngest count them): 'count' so many hops from one end to the other; 'more' a hops to
  // the beacon and b after it, in two colours; 'left' n hops, the first b made (ticked, pale); 'line' on from a
  // numbered beacon (its number under it; the last one's a "?" when that is what is asked); 'equal' g jumps of e
  // kilometres, the whole a "?"
  hops(p) {
    if (p.mode === 'equal') {
      const x0 = 30, x1 = W - 30, y = 78, sw = (x1 - x0) / p.g, h = Math.min(30, sw * 0.42);
      let s = over(x0, x1, 22, '? kilometres in all', true);
      for (let i = 0; i < p.g; i++) s += hop(x0 + i * sw, x0 + (i + 1) * sw, y, h, K.BLUE) + text(x0 + (i + 0.5) * sw, y - h * 0.5 - 8, `${p.e} km`, { size: sw < 70 ? 11.5 : 13 });
      for (let i = 0; i <= p.g; i++) s += `<circle cx="${(x0 + i * sw).toFixed(1)}" cy="${y}" r="3.2" fill="${K.INK}"/>`;
      s += text(W / 2, y + 20, `${p.g} jumps, ${p.e} kilometres each`, { size: 12, fill: K.SOFT });
      return { svg: svg(104, s), line: '' };
    }
    if (p.mode === 'line') {
      const x0 = 28, x1 = W - 28, y = 52, sw = (x1 - x0) / p.b, h = Math.min(28, sw * 0.45), end = p.a + p.b;
      let s = '';
      for (let i = 0; i < p.b; i++) s += hop(x0 + i * sw, x0 + (i + 1) * sw, y, h, K.BLUE);
      for (let i = 0; i <= p.b; i++) s += `<circle cx="${(x0 + i * sw).toFixed(1)}" cy="${y}" r="${i === 0 || i === p.b ? 5 : 3.2}" fill="${i === 0 || i === p.b ? K.AMBER : K.INK}" stroke="${K.INK}" stroke-width="1"/>`;
      s += text(x0, y + 22, String(p.a), { size: 15, weight: 800 }) + text(x0, y + 36, 'beacon', { size: 10.5, fill: K.SOFT });
      s += p.ask === 'end' ? text(x1, y + 22, '?', { size: 16, fill: K.ASK, weight: 800 }) : text(x1, y + 22, String(end), { size: 15, weight: 800 });
      s += text(x1, y + 36, 'beacon', { size: 10.5, fill: K.SOFT });
      if (p.ask !== 'end') s += text(W / 2, y + 30, '? hops', { size: 14, fill: K.ASK, weight: 800 });
      return { svg: svg(96, s), line: '' };
    }
    const n = p.mode === 'more' ? p.a + p.b : p.n, [near, far, nearName, farName] = endsOf(p.to);
    const x0 = 44, x1 = W - 44, y = 58, sw = (x1 - x0) / n, h = Math.min(30, 10 + sw * 0.4);
    let s = near(20, y - 4) + far(W - 20, y - 4) + text(3, y + 26, nearName, { size: 10.5, fill: K.SOFT, anchor: 'start' }) + text(W - 3, y + 26, farName, { size: 10.5, fill: K.SOFT, anchor: 'end' });
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * sw, xb = xa + sw, made = p.mode === 'left' && i < p.b, after = p.mode === 'more' && i >= p.a;
      s += hop(xa, xb, y, h, made ? K.SOFT : after ? K.AMBER : K.BLUE, made ? '3 4' : '');
      if (made) s += `<path d="M${(xa + sw / 2 - 5).toFixed(1)} ${(y - h - 3).toFixed(1)}l4 4l7 -8" fill="none" stroke="${K.SOFT}" stroke-width="2" stroke-linecap="round"/>`;
    }
    for (let i = 0; i <= n; i++) {
      const beacon = p.mode === 'more' && i === p.a;
      s += `<circle cx="${(x0 + i * sw).toFixed(1)}" cy="${y}" r="${beacon ? 5.5 : 3.2}" fill="${beacon ? K.AMBER : K.INK}" stroke="${K.INK}" stroke-width="1"/>`;
      if (beacon) s += text(x0 + i * sw, y + 20, 'beacon', { size: 10.5, fill: K.SOFT });
    }
    return { svg: svg(92, s), line: '' };
  },
  // SPEED, TIME AND DISTANCE: the way cut into a stretch for each second (or minute). 'distance': every stretch the
  // speed, the whole a "?"; 'speed': the whole known, every stretch a "?"; 'time': the whole and one stretch known,
  // how many fit?
  trip({ form, speed = null, steps = null, total = null, step, to }) {
    const x0 = 16, x1 = W - 40, y = 72, far = endsOf(to)[1];
    let s = `<path d="M${x0} ${y}H${x1}" stroke="${K.SOFT}" stroke-width="2" stroke-dasharray="5 5"/>` + far(W - 20, y - 2);
    s += `<path d="M${x0 - 6} ${y - 5}l11 5l-11 5z" fill="${K.COOL}" stroke="${K.INK}" stroke-width="1"/>`;
    if (form === 'time') {
      const sw = Math.max(46, (x1 - x0) * Math.min(0.3, 1 / Math.max(2, Math.round(Number(total) / Number(speed)) || 2)));
      s += `<path d="M${x0} ${y - 8}v16M${(x0 + sw).toFixed(1)} ${y - 8}v16" stroke="${K.INK}" stroke-width="1.6"/>`;
      s += text(x0 + sw / 2, y - 12, `${speed} km`, { size: 12.5 }) + text(x0 + sw / 2, y + 22, `1 ${step[0]}`, { size: 11, fill: K.SOFT });
      s += text((x0 + sw + x1) / 2, y + 22, `${speed} more each ${step[0]} ...`, { size: 11, fill: K.SOFT });
      s += over(x0, x1, 28, `${say(total)} km`);
      s += text(W / 2, y + 44, `how many ${step[1]} of ${speed} fit in ${say(total)}?`, { size: 13.5, fill: K.ASK, weight: 800 });
      return { svg: svg(126, s), line: '' };
    }
    const n = steps, sw = (x1 - x0) / n, small = n > 4;
    for (let i = 0; i <= n; i++) s += `<path d="M${(x0 + i * sw).toFixed(1)} ${y - 8}v16" stroke="${K.INK}" stroke-width="1.6"/>`;
    for (let i = 0; i < n; i++) {
      const mx = x0 + (i + 0.5) * sw;
      s += form === 'distance' ? text(mx, y - 12, String(speed), { size: small ? 11 : 13 }) : text(mx, y - 11, '?', { size: small ? 13 : 16, fill: K.ASK, weight: 800 });
      s += text(mx, y + 22, small ? String(i + 1) : `${step[0]} ${i + 1}`, { size: small ? 10 : 10.5, fill: K.SOFT });
    }
    s += form === 'distance' ? over(x0, x1, 28, '? km', true) : over(x0, x1, 28, `${say(total)} km`);
    if (small) s += text((x0 + x1) / 2, y + 38, `${step[1]}`, { size: 10.5, fill: K.SOFT });
    return { svg: svg(small ? 116 : 104, s), line: '' };
  },
  // TWO LEGS: each leg's minutes and the two together ('time'); or all the kilometres over all the minutes ('speed')
  legs({ mode, d, s = null, t = null }) {
    const bx = [5, 189], bw = 166;
    const box = (i, top, mid, bot) => `<rect x="${bx[i]}" y="16" width="${bw}" height="60" rx="5" fill="${K.PAPER}" stroke="${K.INK}" stroke-width="1.3"/>`
      + text(bx[i] + bw / 2, 32, top, { size: 11, fill: K.SOFT }) + text(bx[i] + bw / 2, 51, mid, { size: 12, weight: 800 }) + text(bx[i] + bw / 2, 69, bot, { size: 12, fill: K.ASK, weight: 800 });
    let out = '';
    if (mode === 'time') {
      out += box(0, 'the first leg', `${say(d[0])} km at ${s[0]} a minute`, '= ? minutes') + box(1, 'the second leg', `${say(d[1])} km at ${s[1]} a minute`, '= ? minutes');
      out += text(180, 51, '+', { size: 18, weight: 800 }) + text(W / 2, 98, 'the two together = ? minutes', { size: 14, fill: K.ASK, weight: 800 });
    } else {
      out += box(0, 'all the kilometres', `${say(d[0])} + ${say(d[1])}`, '= ? km') + box(1, 'all the minutes', `${t[0]} + ${t[1]}`, '= ? minutes');
      out += text(180, 51, '÷', { size: 18, weight: 800 }) + text(W / 2, 98, 'kilometres ÷ minutes = ? kilometres a minute', { size: 13, fill: K.ASK, weight: 800 });
    }
    return { svg: svg(108, out), line: '' };
  },
  // SECONDS AND MINUTES: two sums one after the other ('minutes': the seconds, then the minutes; 'far': the seconds
  // in the minutes, then the kilometres)
  convert({ mode, d = null, sp, m = null }) {
    const bx = [10, 196], bw = 154;
    const box = (i, top, mid, bot) => `<rect x="${bx[i]}" y="16" width="${bw}" height="60" rx="5" fill="${i ? K.FILL2 : K.PAPER}" stroke="${i ? K.ASK : K.INK}" stroke-width="1.3"/>`
      + text(bx[i] + bw / 2, 32, top, { size: 11, fill: K.SOFT }) + text(bx[i] + bw / 2, 51, mid, { size: 13.5, weight: 800 }) + text(bx[i] + bw / 2, 69, bot, { size: 12, fill: K.ASK, weight: 800 });
    const out = (mode === 'minutes'
      ? box(0, '1. the seconds', `${say(d)} km ÷ ${sp}`, '= ? seconds') + box(1, '2. the minutes', '÷ 60', '= ? minutes')
      : box(0, '1. the seconds', `${m} × 60`, '= ? seconds') + box(1, '2. the kilometres', `× ${sp}`, '= ? km'))
      + `<path d="M172 46h14m-5 -5l5 5l-5 5" fill="none" stroke="${K.SOFT}" stroke-width="1.8"/>`
      + text(W / 2, 94, '60 seconds make one minute', { size: 12, fill: K.SOFT });
    return { svg: svg(102, out), line: '' };
  },
  // THE PAYOUT (src/missions.js): so many tonnes of one metal, each sold for the same; the whole a "?"
  tonnes({ n, price }) {
    const bw = Math.min(48, (W - 16) / n), x0 = (W - n * bw) / 2, pr = say(price);
    let s = text(W / 2, 16, `every tonne sold for ${pr} credits`, { size: 12.5, fill: K.SOFT });
    for (let i = 0; i < n; i++) s += `<rect x="${(x0 + i * bw).toFixed(1)}" y="26" width="${(bw - 4).toFixed(1)}" height="30" rx="3" fill="${K.FILL}" stroke="${K.INK}" stroke-width="1.3"/>` + text(x0 + i * bw + (bw - 4) / 2, 46, pr, { size: bw < 46 ? 10.5 : 12, weight: 800 }) + text(x0 + i * bw + (bw - 4) / 2, 70, '1 tonne', { size: 9.5, fill: K.SOFT });
    s += text(W / 2, 94, `${n} lots of ${pr} = ? credits`, { size: 14, fill: K.ASK, weight: 800 });
    return { svg: svg(104, s), line: '' };
  },
  // ... what the haul sold for, cut into d equal parts, n of them the crew member's share: each a "?"
  sharebar({ whole, n, d, pct = false }) {
    const x0 = 10, x1 = W - 10, pw = (x1 - x0) / d;
    let s = `<path d="M${x0} 26v-6H${x1}v6" fill="none" stroke="${K.SOFT}" stroke-width="1.3"/>` + text(W / 2, 14, `the haul sold for ${say(whole)} credits`, { size: 13 });
    for (let i = 0; i < d; i++) {
      const on = i < n;
      s += `<rect x="${(x0 + i * pw).toFixed(1)}" y="32" width="${(pw - 2).toFixed(1)}" height="30" rx="3" fill="${on ? K.FILL2 : K.PAPER}" stroke="${on ? K.ASK : K.INK}" stroke-width="1.3"/>`;
      if (on) s += text(x0 + i * pw + (pw - 2) / 2, 53, '?', { size: 15, fill: K.ASK, weight: 800 });
      else if (pct && pw > 30) s += text(x0 + i * pw + (pw - 2) / 2, 52, '10%', { size: 10, fill: K.SOFT });
    }
    s += text(W / 2, 84, pct ? `10% is one part in 10: ${say(whole)} ÷ 10` : `${d} equal parts: each is ${say(whole)} ÷ ${d}`, { size: 12.5, fill: K.SOFT });
    s += text(W / 2, 104, `your share: the ${n === 1 ? 'shaded part' : `${n} shaded parts`} = ? credits`, { size: 14, fill: K.ASK, weight: 800 });
    return { svg: svg(114, s), line: '' };
  },
});

// ── NAVIGATING (src/jobs/pilot.js): the map with the planet in the middle and its rings round it, the fuel against the
// way, the compass, and the diagrams of "which is the right way to work it out" ───────────────────────────────────────
// THE MAP: a square grid from lo to hi both ways (quad 1: 0 to hi, the planet in the corner; else -hi to hi, the planet
// in the middle), the planet and its rings at 0, 0, and on it: points [{ x, y, kind: 'field' | 'ship' | 'way', label }],
// a course [[x, y], ...] drawn leg by leg, and `ask`: words under it. size: its side in the picture (it is its own
// svg, so it can be a card's own picture). Every grid line is one unit; the axes are numbered.
//   dark   true: dark with light lines (NIGHT); false: pale; not given: whichever is in use
//   lit    1: the whole map is drawn, the planet in the middle, but only its upper right quarter is bright and
//          numbered (a level with no minus numbers yet)
//   marks  [{ x, y, kind }] put on it as it is tapped (src/jobs/panel.js): 'aim' the crossing under the finger (its two
//          lines lit, no numbers: finding the numbers is the question), 'miss' a tap that was wrong, 'field' the right one
export const mapFrame = ({ hi = 7, quad = 4, size = 150, numbers = true }) => { const lo = quad === 1 ? 0 : -hi, pad = numbers ? 16 : 6; return { lo, hi, pad, S: size, u: (size - 2 * pad) / (hi - lo) }; };
// a place on the map's picture (fx, fy: 0 to 1 across and down its square) in the map's own units: [x, y], not rounded
export function mapSpot(map, fx, fy) { const M = mapFrame(map); return [M.lo + (fx * M.S - M.pad) / M.u, M.lo + (M.S - M.pad - fy * M.S) / M.u]; }
export function navMap(o) { return o.dark == null ? drawMap(o) : themed(o.dark, () => drawMap(o)); }
function drawMap({ hi = 7, quad = 4, points = [], course = null, size = 150, ring = 2.6, numbers = true, ask = '', lit = 0, marks = [] }) {
  const { lo, pad, S, u } = mapFrame({ hi, quad, size, numbers }), span = hi - lo;
  const X = (x) => pad + (x - lo) * u, Y = (y) => S - pad - (y - lo) * u, f = (v) => v.toFixed(1), night = K === NIGHT;
  const num = (x, y, k) => `<text x="${f(x)}" y="${f(y)}" font-size="8" font-weight="700" fill="${K.INK}" stroke="${K.CARD}" stroke-width="2.4" paint-order="stroke" text-anchor="middle" font-family="system-ui, sans-serif">${k}</text>`;
  let nums = '';
  let s = `<rect x="0" y="0" width="${S}" height="${S + (ask ? 18 : 0)}" fill="${K.CARD}"/><clipPath id="m${quad}${hi}${S}"><rect x="${pad}" y="${pad}" width="${S - 2 * pad}" height="${S - 2 * pad}"/></clipPath>`;
  for (let k = lo; k <= hi; k++) {
    const axis = k === 0, w = axis ? 1.5 : night ? 0.7 : 0.5, c = axis ? K.INK : K.GRID;
    s += `<path d="M${f(X(k))} ${f(Y(lo))}V${f(Y(hi))}M${f(X(lo))} ${f(Y(k))}H${f(X(hi))}" stroke="${c}" stroke-width="${w}"/>`;
    // (a map with one quarter lit has its numbers along the two axes, written after the planet so that it does not hide them)
    if (numbers && (span <= 8 || k % 2 === 0 || lit) && !(k === 0 && quad !== 1) && !(lit && k < 0)) {
      if (lit) nums += num(X(k), Y(0) + 9, k) + num(X(0) - 6, Y(k) + 3, k);
      else s += text(X(k), S - 4, String(k), { size: 8, fill: K.SOFT, weight: 600 }) + text(6, Y(k) + 3, String(k), { size: 8, fill: K.SOFT, weight: 600 });
    }
  }
  // (only the upper right quarter bright: the other three are there, dimmed)
  if (lit) s += `<path d="M${f(X(lo))} ${f(Y(hi))}H${f(X(0))}V${f(Y(0))}H${f(X(hi))}V${f(Y(lo))}H${f(X(lo))}Z" fill="${K.CARD}" opacity="0.62"/>`;
  // the planet and its rings (clipped to the grid: in the corner on a one-quarter map)
  s += `<g clip-path="url(#m${quad}${hi}${S})"><ellipse cx="${f(X(0))}" cy="${f(Y(0))}" rx="${f(ring * u)}" ry="${f(ring * u * 0.42)}" fill="none" stroke="${K.RING}" stroke-width="${f(Math.max(2, u * 0.5))}" opacity="0.85"/><circle cx="${f(X(0))}" cy="${f(Y(0))}" r="${f(Math.max(4, u * 1.15))}" fill="${K.PLANET}" stroke="${K.INK}" stroke-width="1"/></g>`;
  s += nums;
  if (course) {
    s += `<path d="M${course.map(([x, y]) => `${f(X(x))} ${f(Y(y))}`).join('L')}" fill="none" stroke="${K.SHIP}" stroke-width="2" stroke-dasharray="5 3"/>`;
    for (const [x, y] of course.slice(1, -1)) s += `<circle cx="${f(X(x))}" cy="${f(Y(y))}" r="2.6" fill="${K.PAPER}" stroke="${K.SHIP}" stroke-width="1.4"/>`;
  }
  const diamond = (x, y, r = 5) => `<path d="M${f(x - r)} ${f(y)}L${f(x)} ${f(y - r)}L${f(x + r)} ${f(y)}L${f(x)} ${f(y + r)}Z" fill="${K.FIELD}" stroke="${K.INK}" stroke-width="0.9"/>`;
  for (const p of points) {
    const x = X(p.x), y = Y(p.y);
    if (p.kind === 'ship') s += `<path d="M${f(x - 5)} ${f(y + 5)}L${f(x)} ${f(y - 6)}L${f(x + 5)} ${f(y + 5)}L${f(x)} ${f(y + 2)}Z" fill="${K.SHIP}" stroke="${K.INK}" stroke-width="0.8"/>`;
    else s += diamond(x, y);
    if (p.label) s += text(x + (p.x > hi - 2 ? -8 : 8), y - 7, p.label, { size: 9, fill: K.INK, weight: 700, anchor: p.x > hi - 2 ? 'end' : 'start' });
  }
  for (const m of marks) {
    const x = X(m.x), y = Y(m.y);
    if (m.kind === 'aim') s += `<path d="M${f(x)} ${f(Y(lo))}V${f(Y(hi))}M${f(X(lo))} ${f(y)}H${f(X(hi))}" stroke="${K.ASK}" stroke-width="1.1" opacity="0.75"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(4, u * 0.42))}" fill="none" stroke="${K.ASK}" stroke-width="1.8"/>`;
    else if (m.kind === 'miss') s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(3.4, u * 0.32))}" fill="none" stroke="${K.SOFT}" stroke-width="1.3"/><path d="M${f(x - 2.4)} ${f(y - 2.4)}l4.8 4.8M${f(x + 2.4)} ${f(y - 2.4)}l-4.8 4.8" stroke="${K.SOFT}" stroke-width="1.3"/>`;
    else s += diamond(x, y, Math.max(5, u * 0.42));
  }
  if (ask) s += text(S / 2, S + 12, ask, { size: 10, fill: K.ASK, weight: 800 });
  return `<svg viewBox="0 0 ${S} ${S + (ask ? 18 : 0)}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${s}</svg>`;
}
// WHICH IS THE RIGHT WAY TO WORK IT OUT: a small diagram with its equation under it (an answer button's picture).
//   kind 'tri': the ship, the planet straight ahead and the field off to the side at a right angle; mark: which side
//   is asked ('far': ship to field; 'side': planet to field). kind 'arc': the ship and a rock seen across an angle.
//   eq: the equation's words; none: the diagram alone, its unknown a "?" (Help's picture). dark: as the map's
export function methodPic(kind, o = {}) { return o.dark == null ? drawMethod(kind, o) : themed(o.dark, () => drawMethod(kind, o)); }
function drawMethod(kind, { eq = '', a = 'a', b = 'b', c = '?', ang = 'angle', dist = 'distance', len = '?', mark = 'far' } = {}) {
  const w = 170, h = eq ? 118 : 100;
  let s = `<rect width="${w}" height="${h}" fill="${K.CARD}"/>`;
  if (kind === 'tri') {
    const A = [18, 78], B = [140, 78], C = [140, 22];
    s += `<path d="M${A}L${B}L${C}Z" fill="${K.PAPER}" stroke="${K.INK}" stroke-width="1.4"/><path d="M${B[0] - 9} ${B[1]}v-9h9" fill="none" stroke="${K.INK}" stroke-width="1"/>`;
    s += `<path d="M${A[0] - 6} ${A[1] + 5}l6 -11l6 11z" fill="${K.SHIP}"/><circle cx="${B[0]}" cy="${B[1]}" r="7" fill="${K.PLANET}" stroke="${K.INK}" stroke-width="1"/><path d="M${C[0] - 5} ${C[1]}l5 -5l5 5l-5 5z" fill="${K.FIELD}" stroke="${K.INK}" stroke-width="0.8"/>`;
    s += text(78, 92, a, { size: 10, fill: mark === 'base' ? K.ASK : K.INK, weight: 700 }) + text(134, 56, b, { size: 10, fill: mark === 'side' ? K.ASK : K.INK, weight: mark === 'side' ? 800 : 700, anchor: 'end' }) + text(56, 36, c, { size: mark === 'far' ? 12 : 10, fill: mark === 'far' ? K.ASK : K.INK, weight: 800 });
  } else {
    const A = [16, 55];
    s += `<path d="M${A}L150 30M${A}L150 80" stroke="${K.INK}" stroke-width="1.2"/><path d="M${A}H142" stroke="${K.SOFT}" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += `<path d="M150 30l8 12l-4 14l5 12l-9 12l-9 -10l3 -14l-5 -13z" fill="${K.SOFT}" stroke="${K.INK}" stroke-width="1"/><path d="M${A[0] - 6} ${A[1] + 5}l11 -5l-11 -5z" fill="${K.SHIP}"/>`;
    s += `<path d="M46 49.6a30 30 0 0 1 0 10.8" fill="none" stroke="${K.ASK}" stroke-width="1.4"/>` + text(30, 80, ang, { size: 9.5, fill: K.INK, weight: 700, anchor: 'start' }) + `<path d="M44 73L48 61" stroke="${K.SOFT}" stroke-width="0.8"/>` + text(98, 51, dist, { size: 9.5, fill: K.INK, weight: 700 }) + text(166, 21, len, { size: 11, fill: K.ASK, weight: 800, anchor: 'end' });
  }
  if (eq) s += `<rect x="4" y="${h - 22}" width="${w - 8}" height="18" rx="3" fill="${K.PAPER}" stroke="${K.INK}" stroke-width="1"/>` + text(w / 2, h - 9, eq, { size: eq.length > 26 ? 8.6 : 10, fill: K.INK, weight: 800 });
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${s}</svg>`;
}

Object.assign(DRAW, {
  // THE FUEL against THE WAY: a box for each unit of fuel, and under them the way out (and back) a box a unit; `ask`
  // the words under it, with their "?"
  fuel({ fuel = null, out, back = false, ask }) {
    const n = Math.max(fuel || 0, out * (back ? 2 : 1)), bw = Math.min(30, (W - 90) / n), x0 = 78;
    let s = '';
    if (fuel != null) { s += text(72, 30, 'fuel', { size: 11.5, fill: K.SOFT, anchor: 'end' }); for (let i = 0; i < fuel; i++) s += `<rect x="${(x0 + i * bw).toFixed(1)}" y="16" width="${(bw - 3).toFixed(1)}" height="20" rx="3" fill="${K.AMBER}" stroke="${K.INK}" stroke-width="1.1"/>`; }
    s += text(72, 62, back ? 'there, back' : 'the way', { size: 11.5, fill: K.SOFT, anchor: 'end' });
    for (let i = 0; i < out * (back ? 2 : 1); i++) s += `<rect x="${(x0 + i * bw).toFixed(1)}" y="48" width="${(bw - 3).toFixed(1)}" height="20" rx="3" fill="${i < out ? K.BLUE : K.PAPER}" stroke="${K.INK}" stroke-width="1.1"/>`;
    s += text(W / 2, 92, ask, { size: 13.5, fill: K.ASK, weight: 800 });
    return { svg: svg(102, s), line: '' };
  },
  // the map, large (Help's picture of a card about a point or a course)
  map(p) { return { svg: navMap({ ...p, size: 230 }), line: '' }; },
  // THE COMPASS: the ship in the middle, its nose a line (up the page when `nose` is not given as a heading), and the
  // lines it is told of: [{ deg (clockwise from the nose, or a heading), label, dash }]; `ask`: the words under it
  compass({ lines = [], ask = '', rose = false }) {
    const cx = 104, cy = 76, R = 54, rad = (d) => (d - 90) * Math.PI / 180;
    let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${K.PAPER}" stroke="${K.SOFT}" stroke-width="1.2"/>`;
    if (rose) for (const d of [0, 90, 180, 270]) s += text(cx + Math.cos(rad(d)) * (R + 11), cy + Math.sin(rad(d)) * (R + 11) + 4, `${d}°`, { size: 9.5, fill: K.SOFT });
    for (let d = 0; d < 360; d += 30) s += `<path d="M${(cx + Math.cos(rad(d)) * (R - 4)).toFixed(1)} ${(cy + Math.sin(rad(d)) * (R - 4)).toFixed(1)}L${(cx + Math.cos(rad(d)) * R).toFixed(1)} ${(cy + Math.sin(rad(d)) * R).toFixed(1)}" stroke="${K.SOFT}" stroke-width="1"/>`;
    lines.forEach((L, i) => {
      const a = rad(L.deg), r = R - 6 - (i % 2) * 4, colour = L.colour === 'ask' ? K.ASK : L.colour === 'ship' ? K.SHIP : K.INK;
      s += `<path d="M${cx} ${cy}L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}" stroke="${colour}" stroke-width="${L.colour === 'ship' ? 2.6 : 1.8}"${L.dash ? ' stroke-dasharray="5 3"' : ''} stroke-linecap="round"/>`;
      // (what each line is, listed beside the compass with a stroke of the line's own)
      if (L.label) s += `<path d="M186 ${32 + i * 20}h16" stroke="${colour}" stroke-width="${L.colour === 'ship' ? 2.6 : 1.8}"${L.dash ? ' stroke-dasharray="5 3"' : ''}/>` + text(208, 36 + i * 20, L.label, { size: 10.5, fill: colour, weight: 700, anchor: 'start' });
    });
    s += `<path d="M${cx - 5} ${cy + 5}l5 -11l5 11l-5 -3z" fill="${K.SHIP}" stroke="${K.INK}" stroke-width="0.8"/>`;
    s += text(W / 2, 166, ask, { size: ask.length > 40 ? 11.5 : 13.5, fill: K.ASK, weight: 800 });
    return { svg: svg(176, s), line: '' };
  },
  // the diagram of a "which is the right way" card, its unknown a "?"
  // (the right triangle where the card gives its sides, a, b, c; else the rock seen across an angle)
  method(p) { return { svg: methodPic(p.a != null || p.c != null ? 'tri' : 'arc', p), line: '' }; },
});

// ── THE DRILL OPERATOR'S CARDS (src/jobs/drill.js): the rock in the claw with the ore the scan shows inside it, its
// holes, the box that just holds it, a bar cut into its equal parts, and a row of sums ────────────────────────────────
const ROCKC = '#4a4640', ROCKE = '#2c2925';
const rockShape = (cx, cy, rx, ry) => { let d = ''; for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, k = 1 + 0.05 * Math.sin(i * 2.7 + 1) + 0.04 * Math.cos(i * 4.1) + 0.1 * Math.abs(Math.sin(a * 2)) ; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`; } return `<path d="${d}Z" fill="${ROCKC}" stroke="${K === NIGHT ? '#8d857b' : ROCKE}" stroke-width="2" stroke-linejoin="round"/>`; };
// a lump of ore glowing in the rock, in its metal's own colour
const lump = (x, y, r, glow) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 1.7).toFixed(1)}" fill="${glow}" opacity="0.28"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${glow}" stroke="#fff" stroke-width="0.8"/>`;
Object.assign(DRAW, {
  // what the scan shows in a rock, to count. kinds: [[glow, how many], ...]: its veins, each a short glowing bar in its
  // metal's colour. rows: [glow, ...] with each: every vein a row of so many lumps.
  scan({ kinds = null, rows = null, each = 0, ask = '' }) {
    let s = rockShape(W / 2, 66, 150, 54);
    const vein = (x, y, i, glow) => { const a = (i * 47 % 50) - 25; return `<g transform="rotate(${a} ${x.toFixed(1)} ${y.toFixed(1)})"><rect x="${(x - 17).toFixed(1)}" y="${(y - 7).toFixed(1)}" width="34" height="14" rx="7" fill="${glow}" opacity="0.3"/><rect x="${(x - 14).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="28" height="8" rx="4" fill="${glow}" stroke="#fff" stroke-width="0.8"/></g>`; };
    if (rows) {
      const g = rows.length, dy = Math.min(24, 88 / g), y0 = 66 - dy * (g - 1) / 2, dx = Math.min(34, 200 / each), x0 = W / 2 - dx * (each - 1) / 2;
      rows.forEach((glow, r) => { s += `<path d="M${x0 - 10} ${y0 + r * dy}h${dx * (each - 1) + 20}" stroke="${glow}" stroke-width="5" opacity="0.35" stroke-linecap="round"/>`; for (let e = 0; e < each; e++) s += lump(x0 + e * dx, y0 + r * dy, 5.4, glow); });
    } else {
      const all = (kinds || []).flatMap(([glow, n]) => Array(n).fill(glow)), n = all.length, cols = Math.min(5, n), nr = Math.ceil(n / cols), dx = Math.min(50, 240 / Math.max(1, cols)), dy = 30, y0 = 66 - dy * (nr - 1) / 2;
      all.forEach((glow, i) => { const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), x0 = W / 2 - dx * (inRow - 1) / 2; s += vein(x0 + (i % cols) * dx, y0 + r * dy + ((i % 2) ? 4 : -4), i, glow); });
    }
    if (ask) s += text(W / 2, 140, ask, { size: 13.5, fill: K.ASK, weight: 800 });
    return { svg: svg(ask ? 150 : 128, s), line: '' };
  },
  // the holes a rock stands: one ring for each, the ones drilled dark with a cross
  holes({ all, used, glow = '#2fe3cf' }) {
    let s = rockShape(W / 2, 60, 150, 48);
    const dx = Math.min(44, 250 / all), x0 = W / 2 - dx * (all - 1) / 2;
    for (let i = 0; i < all; i++) {
      const x = x0 + i * dx, done = i < used;
      s += done ? `<circle cx="${x}" cy="60" r="12" fill="#0d0b09" stroke="#9a8f80" stroke-width="1.5"/><path d="M${x - 6} 54l12 12M${x + 6} 54l-12 12" stroke="#9a8f80" stroke-width="2"/>`
        : `<circle cx="${x}" cy="60" r="12" fill="none" stroke="${glow}" stroke-width="2.5" stroke-dasharray="5 3"/>`;
    }
    s += text(W / 2, 130, 'Crossed: drilled. Count the open rings.', { size: 13, fill: K.ASK, weight: 800 });
    return { svg: svg(140, s), line: '' };
  },
  // the box that just holds a rock: so long, so wide, so high (drawn to those), the rock in it. per: what a cubic metre
  // of the rock weighs; vol: the box's cubic metres given (the question starts from them)
  rockbox({ l, w, h, vol = null, per = null, shape = 'round' }) {
    const k = 34, bw = l * k, bh = h * k, ox = w * 15, oy = -w * 10, x = (W - bw - ox) / 2, y = 34 - oy;
    let s = `<path d="M${x} ${y}h${bw}v${bh}h${-bw}Z M${x} ${y}l${ox} ${oy}h${bw}l${-ox} ${-oy} M${x + bw} ${y}l${ox} ${oy}v${bh}l${-ox} ${-oy}" fill="none" stroke="${K.INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
    s += rockShape(x + bw / 2 + ox * 0.45, y + bh / 2 + oy * 0.45, bw / 2 - 4, bh / 2 - (shape === 'flat' ? 1 : 3));
    const yb = y + bh;
    s += text(x + bw / 2, yb + 15, `${l} m long`, { size: 12.5 }) + text(x - 8, y + bh / 2 + 4, `${h} m high`, { size: 12.5, anchor: 'end' }) + text(x + bw + ox + 6, yb + oy + 2, `${w} m wide`, { size: 12.5, anchor: 'start' });
    const box = vol != null ? `the box: ${vol} cubic metres; about half of it is rock` : per ? `the box: ${l} × ${w} × ${h} cubic metres; about half is rock` : `the box: ${l} × ${w} × ${h} = ? cubic metres`;
    s += text(W / 2, yb + 38, box, { size: 12.5, fill: per ? K.SOFT : K.ASK, weight: per ? 600 : 800 });
    if (per) s += text(W / 2, yb + 58, `a cubic metre weighs ${per} tonnes: ? tonnes`, { size: 13.5, fill: K.ASK, weight: 800 });
    return { svg: svg(yb + (per ? 68 : 48), s), line: '' };
  },
  // a bar cut into d equal parts, the first n of them marked: `top` what the bar is, `each` the words in a part ('?':
  // in the marked parts only), `line` and `ask` the words under it
  partbar({ top, d, n = 1, each = '?', line = '', ask = '' }) {
    const x0 = 10, x1 = W - 10, pw = (x1 - x0) / d;
    let s = `<path d="M${x0} 26v-6H${x1}v6" fill="none" stroke="${K.SOFT}" stroke-width="1.3"/>` + text(W / 2, 14, top, { size: 13 });
    for (let i = 0; i < d; i++) {
      const on = i < n, mx = x0 + i * pw + (pw - 2) / 2;
      s += `<rect x="${(x0 + i * pw).toFixed(1)}" y="32" width="${(pw - 2).toFixed(1)}" height="30" rx="3" fill="${on ? K.FILL2 : K.PAPER}" stroke="${on ? K.ASK : K.INK}" stroke-width="1.3"/>`;
      if (each === '?') { if (on && pw > 22) s += text(mx, 53, '?', { size: 15, fill: K.ASK, weight: 800 }); } else if (pw > 26) s += text(mx, 52, each, { size: pw > 44 ? 12 : 10, fill: on ? K.ASK : K.SOFT, weight: 700 });
    }
    if (line) s += text(W / 2, 84, line, { size: 12.5, fill: K.SOFT });
    if (ask) s += text(W / 2, line ? 104 : 86, ask, { size: 14, fill: K.ASK, weight: 800 });
    return { svg: svg(line && ask ? 114 : 96, s), line: '' };
  },
  // one canister part full (the smelter's haul home early): a tonne cut into d equal parts, the first `have` lit in the
  // metal's own colour (glow), the empty ones each a "?"; `top` over it, `line` and `ask` under it
  canfill({ d = 8, have = 0, glow = '#ffc233', top = '', line = '', ask = '' }) {
    const x0 = 14, x1 = W - 14, pw = (x1 - x0) / d;
    let s = text(W / 2, 14, top, { size: 13 }) + `<rect x="${x0 - 4}" y="24" width="${x1 - x0 + 6}" height="40" rx="10" fill="${K.STEEL}" stroke="${K.INK}" stroke-width="1.3"/>`;
    for (let i = 0; i < d; i++) {
      const on = i < have, x = x0 + i * pw, mx = x + (pw - 2) / 2;
      s += `<rect x="${x.toFixed(1)}" y="30" width="${(pw - 2).toFixed(1)}" height="28" rx="3" fill="${on ? glow : K.PAPER}" ${on ? 'opacity="0.9"' : ''} stroke="${on ? K.INK : K.ASK}" stroke-width="1.2"/>`;
      if (!on && pw > 22) s += text(mx, 50, '?', { size: 15, fill: K.ASK, weight: 800 });
    }
    if (line) s += text(W / 2, 84, line, { size: 12.5, fill: K.SOFT });
    if (ask) s += text(W / 2, line ? 104 : 86, ask, { size: 14, fill: K.ASK, weight: 800 });
    return { svg: svg(line && ask ? 114 : 96, s), line: '' };
  },
  // a row of boxes with a sign between each two: { top (what it is), mid (its number), bot (its "= ?"), glow (a dot of
  // a metal's colour), ask (the box asked for) }; `op` the sign between them, `last` the sign before the last box
  // where that is another one, `ask` the words under the row
  boxes({ boxes = [], op = '+', last = null, ask = '' }) {
    const n = boxes.length, gap = n > 3 ? 18 : 26, bw = Math.min(150, (W - 8 - gap * (n - 1)) / n), x0 = (W - (n * bw + (n - 1) * gap)) / 2, tall = boxes.some((b) => b.bot), small = bw < 80;
    let s = '';
    boxes.forEach((b, i) => {
      const x = x0 + i * (bw + gap), mid = String(b.mid);
      s += `<rect x="${x.toFixed(1)}" y="14" width="${bw.toFixed(1)}" height="${tall ? 62 : 46}" rx="5" fill="${b.ask ? K.FILL2 : K.PAPER}" stroke="${b.ask ? K.ASK : K.INK}" stroke-width="1.3"/>`;
      if (b.glow) s += `<circle cx="${(x + 10).toFixed(1)}" cy="24" r="4.5" fill="${b.glow}" stroke="${K.INK}" stroke-width="0.6"/>`;
      s += text(x + bw / 2 + (b.glow && small ? 5 : 0), 30, b.top, { size: small ? 9.5 : 11, fill: K.SOFT }) + text(x + bw / 2, 50, mid, { size: mid.length * 7.4 > bw - 8 ? Math.max(9, (bw - 8) / mid.length * 1.75) : 13.5, weight: 800 });
      if (b.bot) s += text(x + bw / 2, 68, b.bot, { size: small ? 10.5 : 12, fill: K.ASK, weight: 800 });
      if (i < n - 1) { const sign = i === n - 2 && last ? last : op; if (sign) s += text(x + bw + gap / 2, tall ? 50 : 42, sign, { size: small ? 15 : 18, weight: 800 }); }
    });
    if (ask) s += text(W / 2, tall ? 96 : 80, ask, { size: 14, fill: K.ASK, weight: 800 });
    return { svg: svg((tall ? 80 : 64) + (ask ? 26 : 0), s), line: '' };
  },
});

// ── the crane game's pictures are its own (src/jobs/cranepics.js): its orders carry them ready made (help.svg) ──────
const t1 = (x) => String(Math.round(x * 10) / 10);

// dark: the job's pictures are drawn dark with light lines (NIGHT); one of Mathwood's own is handed back as it is,
// with `flip`, for the panel to turn dark as it shows it
export function helpPicture(order, { dark = false } = {}) {
  const also = dark ? { dark: true } : {};
  if (!order) return { svg: '', title: '', line: '' };
  // (a job's own question may bring its help picture drawn already: the dock's, src/jobs/dock.js; the crane game's,
  // src/jobs/cranepics.js)
  if (order.help && order.help.svg) return { svg: order.help.svg, title: order.help.title || '', line: order.help.line || '' };
  if (order.help && order.help.pic && DRAW[order.help.pic.kind]) {
    const d = themed(dark, () => DRAW[order.help.pic.kind](order.help.pic));
    return { svg: d.svg, title: order.help.title || '', line: order.help.line || d.line, ...also };
  }
  if (!order.pic) return { svg: '', title: '', line: '' };
  // (one of Mathwood's pictures; a job's own order may give it its own title and line)
  const h = order.help || {};
  try { const d = counterPicture(order.pic); return { svg: d.svg, title: h.title || d.title, line: h.line || d.line, ...(dark ? { flip: true } : {}) }; } catch (e) { console.warn('Pi Nebula: no picture for', order.pic, e); return { svg: '', title: '', line: '' }; }
}
