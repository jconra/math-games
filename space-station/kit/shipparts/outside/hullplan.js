// LAYING OUT A HULL: the placements (a ship layout file's { piece, cell, turn, level, variant }) for a hull of one
// section from the hull pieces (hull.js), so a ship's file can be written from a few numbers. Plain data, no three.js:
// it runs in the browser or in node.
//   hullBody({ section, mid, z0, z1, runs, paint, wall })   the body between cell edges z0 and z1 (z0 < z1)
//     section  a name in SECTIONS (sections.js)
//     mid      the cell x of the hull's middle line (0: a hull an odd number of cells across, centred on cell 0)
//     runs     where the panels break along the hull (cells, adding up to z1 - z0; default 4s, then a 2, then a 1);
//              an opening wants a break each side of it; sideRuns { 1: [...], -1: [...] } the same for one side
//     paint    words added to each kind of piece: { side, lo, up, roof, belly } (e.g. { lo: 'dark', belly: 'grey' })
//     wall(s, zc, len)  the side wall at one run: s the side (+1 is +x), zc the run's middle, len its cells. Returns
//              a column of [variant, level] from the bottom up, each a hull panel ('x4 h2 ystripe') or a hull opening
//              ('door', 'window x4'); null for the plain wall
//   hullEnds({ section, mid, z0, z1, nose, tail, mouth })  the nose cap at z1 and the tail cap at z0 (cap styles)
//   splitRuns(len)  4s, then a 2, then a 1
//   mountOn({ section, face, z, s, level, x })  the placement for a free part on a face of the hull (below)
// Turns: a piece faces +z at turn 0; the +x side wall is turn 1, the -x side turn 3.
import { SECTIONS, capLength } from './sections.js';

export function splitRuns(len) {
  const out = []; let left = len;
  for (const r of [4, 2, 1]) while (left >= r - 1e-9) { out.push(r); left -= r; }
  return out;
}
const words = (base, extra) => (extra ? base + ' ' + extra : base);
const rt = ([a, b]) => a + ':' + b;

export function hullBody({ section = 'sample', mid = 0, z0, z1, runs = null, sideRuns = {}, paint = {}, wall = null }) {
  const S = typeof section === 'string' ? SECTIONS[section] : section, out = [], len = z1 - z0;
  const check = (rr) => { if (Math.abs(rr.reduce((a, b) => a + b, 0) - len) > 1e-9) throw new Error('hullplan: the runs do not add up to the hull\'s length'); return rr; };
  runs = check(runs || splitRuns(len));
  const sideH = S.r - S.up[1] - (S.b + S.lo[1]), sideL = S.b + S.lo[1];
  // the two sides, each in its own runs (an opening needs a break each side of it)
  for (const s of [1, -1]) {
    const turn = s > 0 ? 1 : 3, x = mid + s * S.w;
    let za = z0;
    for (const L of check(sideRuns[s] || runs)) {
      const zc = za + L / 2, col = wall?.(s, zc, L) || [[`x${L} h${sideH}`, sideL]];
      for (const [vv, level] of col) out.push({ piece: /^(door|window|porthole|mouth|hatch)/.test(vv) ? 'hullOpening' : 'hullPanel', cell: [x, zc], turn, level, variant: words(vv, paint.side) });
      if (S.lo[0] && S.lo[1]) out.push({ piece: 'hullSlope', cell: [x, zc], turn, level: sideL, variant: words(`down ${rt(S.lo)} x${L}`, paint.lo) });
      if (S.up[0] && S.up[1]) out.push({ piece: 'hullSlope', cell: [x, zc], turn, level: S.r - S.up[1], variant: words(`up ${rt(S.up)} x${L}`, paint.up) });
      za += L;
    }
  }
  // the roof and the belly, across in runs
  let za = z0;
  for (const L of runs) {
    const zc = za + L / 2;
    for (const [kind, half, level] of [['roof', S.w - S.up[0], S.r], ['belly', S.w - S.lo[0], S.b]]) {
      let xa = -half;
      for (const W of splitRuns(2 * half)) { out.push({ piece: 'hullPanel', cell: [mid + xa + W / 2, zc], turn: 0, level, variant: words(`${kind} x${W} d${L}`, paint[kind]) }); xa += W; }
    }
    za += L;
  }
  return out;
}

export function hullEnds({ section = 'sample', mid = 0, z0, z1, nose = 'canopy', tail = 'flat', mouth = null, paint = {} }) {
  const name = typeof section === 'string' ? section : 'sample', out = [];
  if (nose) out.push({ piece: 'hullCap', cell: [mid, z1], turn: 0, level: 0, variant: words(`nose ${name} ${nose}`, paint.nose) });
  if (tail) out.push({ piece: 'hullCap', cell: [mid, z0], turn: 0, level: 0, variant: words(`tail ${name} ${tail}${mouth ? ' mouth ' + mouth : ''}`, paint.tail) });
  return out;
}
// WHERE A PART GOES ON THE HULL (the grid's answer to "a point on the hull and its normal"): the placement that puts a
// free part's origin on a face of a hull of that section, facing out of it (a part faces +z in its own frame).
//   face 'side' (s +1 or -1; at `level`), 'roof' or 'belly' (at cell x across from the middle line; the part stays
//   upright, its +z toward the nose), 'tail' (the flat end at z; level), 'nose' (the end face of a nose cap of that
//   style starting at z; level, x); z the cell z along the hull; off a nudge in metres (the part's own frame)
export function mountOn({ section = 'sample', mid = 0, face, z, s = 1, level = 0, x = 0, style = 'canopy', off }) {
  const S = typeof section === 'string' ? SECTIONS[section] : section, o = off ? { off } : {};
  if (face === 'side') return { cell: [mid + s * S.w, z], turn: s > 0 ? 1 : 3, level, ...o };
  if (face === 'roof') return { cell: [mid + x, z], turn: 0, level: S.r, ...o };
  if (face === 'belly') return { cell: [mid + x, z], turn: 0, level: S.b, ...o };
  if (face === 'tail') return { cell: [mid + x, z], turn: 2, level, ...o };
  if (face === 'nose') return { cell: [mid + x, z + capLength(style)], turn: 0, level, ...o };
  throw new Error('hullplan: no face ' + face);
}
export { capLength };
