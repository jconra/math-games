// A COOPERED BARREL from the parts kit (cabin.js's Kit): many boards, not one log. Nothing in here knows about any
// cabin, so it can stand anywhere a Kit is building (the Town Lab will use it as a prop of its own).
//
//   staves  14 to 18 boards round it, each its own width and shade, bulging at the middle and narrower at the ends.
//           Each stave is one board, bowed: a box with rows of corners along it, bent out at the middle and in and
//           narrower at the ends (the kit's o.shape). Thin dark seams between them: the boards' darker bevelled edges,
//           and a dark core inside.
//   hoops   2 or 3 iron bands, a centimetre proud of the staves, the odd one rusty
//   lid     3 or 4 boards across, sitting just below the stave tops (sawn boards, no tree rings)
//
// About 300 triangles. Weathering (greyer up high, dirt at the base) comes from the cabin's own tint and shader.

import * as THREE from 'three';

const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const RY = (a) => new THREE.Matrix4().makeRotationY(a);
const mul = (m, ...more) => { const r = m.clone(); for (const x of more) r.multiply(x); return r; };

// k: a Kit. o: x, z (where it stands, on the ground at y = 0 unless y), h (height, m), r (radius at the bulge, m),
// staves (how many), hoops (2 or 3), tint (the wood's tint), turn (radians round its axis), lid (false: open)
export function makeBarrel(k, o = {}) {
  const x = o.x || 0, y0 = o.y || 0, z = o.z || 0, h = o.h ?? 0.86, rMid = o.r ?? 0.3, rEnd = rMid * 0.86;
  const n = o.staves ?? 14 + Math.floor(k.R() * 5), turn = o.turn ?? k.R() * Math.PI * 2;
  const tint = o.tint || [1, 1, 1], th = 0.022;
  const base = T(x, y0, z);
  // the staves' widths: each its own, all together going once round
  const wts = Array.from({ length: n }, () => k.r(0.8, 1.2)), sum = wts.reduce((p, q) => p + q, 0);
  // the bow: 1 at the middle, 0 at the ends; at the ends a stave is pulled in to rEnd and narrowed to match
  const bow = (ly) => 1 - (2 * ly / h) ** 2, dr = rMid - rEnd;
  const shape = (lx, ly, lz) => { const f = bow(ly); return [lx * (rEnd + dr * f) / rMid, ly, lz - dr * (1 - f)]; };
  const cuts = [-0.32, -0.14, 0.14, 0.32].map((c) => c * h);
  let a = turn, maxDa = 0;
  for (let i = 0; i < n; i++) {
    const da = wts[i] / sum * Math.PI * 2, ac = a + da / 2, w = 2 * rMid * Math.sin(da / 2) + 0.004;
    maxDa = Math.max(maxDa, da);
    const shade = tint.map((c) => c * k.r(0.88, 1.12)), strip = Math.floor(k.R() * 12);
    // its outside face on the barrel's skin at the bulge; the inside face is left flat (it shows only above the lid)
    const m = mul(base, RY(Math.PI / 2 - ac), T(0, h / 2, rMid - th / 2));
    k.board([w, h, th], null, null, { m, long: 1, strip, uShift: k.r(0, 1.2), tint: shade, shape, cuts, segFaces: '+z', skip: '-y+x-x' });
    a += da;
  }
  // the dark inside, where the staves part at the bulge
  const core = Array.from({ length: 12 }, (_, i) => { const t = (i + 0.5) / 12 * Math.PI * 2; return [Math.cos(t) * (rEnd - th), Math.sin(t) * (rEnd - th)]; });
  k.prism('wood', core, h - 0.04, null, null, { m: mul(base, T(0, h / 2, 0)), tint: [0.08, 0.07, 0.06], smooth: true, skip: '+y-y' });
  // the lid: boards across, just below the stave tops, each cut to the round
  const nl = o.lidBoards ?? 3 + Math.floor(k.R() * 2), rl = rEnd - th - 0.002, lw = 2 * rl / nl;
  if (o.lid !== false) for (let j = 0; j < nl; j++) {
    // (cut to the round at its outer edge, so its corners stay inside the staves)
    const cz = -rl + lw * (j + 0.5), ce = Math.abs(cz) + lw / 2 - 0.003, len = 2 * Math.sqrt(Math.max(0.0004, rl * rl - ce * ce));
    k.board([len, 0.02, lw - 0.006], null, null, { m: mul(base, RY(turn), T(0, h - 0.035, cz)), long: 0, strip: Math.floor(k.R() * 10), tint: tint.map((c) => c * k.r(0.85, 1.05)), skip: '-y+x-x' });
  }
  // the hoops: near each end, and one above the bulge. A flat stave's edges stand further from the middle than its
  // centre line, and the hoop's own sixteen flats sit inside its corners: the hoop goes round outside both
  const at = o.hoops === 2 ? [0.08, 0.92] : [0.08, 0.62, 0.92];
  for (const f of at) {
    const rs = rEnd + dr * bow((f - 0.5) * h), r = (rs / Math.cos(maxDa / 2) + 0.01) / Math.cos(Math.PI / 16), rusty = k.R() < 0.4;
    const ring = Array.from({ length: 16 }, (_, i) => { const t = (i + 0.5) / 16 * Math.PI * 2; return [Math.cos(t) * r, Math.sin(t) * r]; });
    k.prism('iron', ring, 0.045, null, null, { m: mul(base, T(0, h * f, 0)), smooth: true, skip: '+y-y', tint: rusty ? [1.7, 1.05, 0.7] : [0.85, 0.82, 0.8] });
  }
  k.solid([2 * rMid, h, 2 * rMid], [x, y0 + h / 2, z]);
}
