// THE HELP PICTURES for a job's question. Mathwood Valley's own drawings for its makers' questions (src/ui/counterpics.js
// counterPicture, which falls back to src/ui/storepics.js: equal groups, sharing out, the ratio table, the ratio bar,
// the things to count), and this game's few for its own makers (the recipe's batches of cups, the drip bag hour by
// hour, an hour of drops), drawn the same way: on a light card, the numbers given, the answer always a "?".
//   helpPicture(order) -> { svg, title, line }
import { counterPicture } from '../../../mathwood-valley/src/ui/counterpics.js';
import { fracText } from '../../../mathwood-valley/src/levels/kit.js';

const INK = '#2b2219', SOFT = '#8a7558', FILL = '#ead9b2', ASK = '#b5523a', BLUE = '#6fa8d6', W = 360;
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

export function helpPicture(order) {
  if (!order) return { svg: '', title: '', line: '' };
  if (order.help && order.help.pic && DRAW[order.help.pic.kind]) {
    const d = DRAW[order.help.pic.kind](order.help.pic);
    return { svg: d.svg, title: order.help.title || '', line: order.help.line || d.line };
  }
  if (!order.pic) return { svg: '', title: '', line: '' };
  try { return counterPicture(order.pic); } catch (e) { console.warn('Pi Nebula: no picture for', order.pic, e); return { svg: '', title: '', line: '' }; }
}
