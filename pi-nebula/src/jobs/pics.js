// THE HELP PICTURES for a job's question. Mathwood Valley's own drawings for its makers' questions (src/ui/counterpics.js
// counterPicture, which falls back to src/ui/storepics.js: equal groups, sharing out, the ratio table, the ratio bar,
// the things to count), and this game's few for its own makers (the recipe's batches of cups, the drip bag hour by
// hour, an hour of drops; the smelter's canisters to count, a load cut into equal parts, tonne by tonne at a price,
// down the pay slip), drawn the same way: on a light card, the numbers given, the answer always a "?". A job's own
// order can also name one of Mathwood's pictures (order.pic) and give it its own title and line (order.help).
//   helpPicture(order) -> { svg, title, line }
import { counterPicture } from '../../../mathwood-valley/src/ui/counterpics.js';
import { fracText } from '../../../mathwood-valley/src/levels/kit.js';

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
  payslip({ n, w, pct, metal, price }) {
    const bx = [10, 128, 246], bw = 104, t1 = (x) => String(x / 10);
    const box = (i, top, mid, bot) => `<rect x="${bx[i]}" y="20" width="${bw}" height="62" rx="5" fill="${i === 2 ? FILL2 : '#fff'}" stroke="${i === 2 ? ASK : INK}" stroke-width="1.3"/>`
      + text(bx[i] + bw / 2, 37, top, { size: 11, fill: SOFT }) + text(bx[i] + bw / 2, 57, mid, { size: 13.5, weight: 800 }) + text(bx[i] + bw / 2, 75, bot, { size: 12, fill: ASK, weight: 800 });
    let s = box(0, '1. the ore', `${n} × ${t1(w)}`, '= ? tonnes') + box(1, `2. the ${metal}`, `${pct}% of it`, '= ? tonnes') + box(2, '3. the pay', `× ${price}`, '= ? credits');
    for (const x of [116, 234]) s += `<path d="M${x} 51h8m-4 -4l4 4l-4 4" fill="none" stroke="${SOFT}" stroke-width="1.6"/>`;
    return { svg: svg(92, s), line: '' };
  },
});

export function helpPicture(order) {
  if (!order) return { svg: '', title: '', line: '' };
  if (order.help && order.help.pic && DRAW[order.help.pic.kind]) {
    const d = DRAW[order.help.pic.kind](order.help.pic);
    return { svg: d.svg, title: order.help.title || '', line: order.help.line || d.line };
  }
  if (!order.pic) return { svg: '', title: '', line: '' };
  // (one of Mathwood's pictures; a job's own order may give it its own title and line)
  const h = order.help || {};
  try { const d = counterPicture(order.pic); return { svg: d.svg, title: h.title || d.title, line: h.line || d.line }; } catch (e) { console.warn('Pi Nebula: no picture for', order.pic, e); return { svg: '', title: '', line: '' }; }
}
