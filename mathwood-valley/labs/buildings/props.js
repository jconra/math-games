// THE PROPS that go with a building: separate pieces, not part of its mesh, so the Town Lab can move them, take them
// away or put more down. A building lists the ones it comes with ({ type, x, y, z, rot, ... }); buildProps turns a list
// into three meshes (wood, iron, hay), from the Material Lab's parts kit like the building itself.
//
//   barrel   the Material Lab's coopered barrel (labs/materials/barrel.js)
//   trough   a plank water trough on two skids, iron bands round its ends, dark water in it
//   crate    a slatted crate (size), its dark inside showing between the slats
//   bale     a hay bale (0.9 x 0.4 x 0.46 m), two strings round it
//   bucket   a wooden bucket, two iron hoops, a wire bail
//   wagon    a farm wagon: plank box, four spoked wheels (the back ones bigger), the tongue down on the ground
//   bench    a long plank bench: a thick seat on two splayed leg frames, a stretcher between them (len)
//   woodpile split firewood stacked on two rails, ends out, a few billets on top (len)
//   hitchrail a peeled log rail on two posts, an iron ring on each post for the reins (len)
//   plank    a long board leaning on a wall (len, lean: how far its foot stands out)

import * as THREE from 'three';
import { Kit, buildGeometry } from '../materials/cabin.js';
import { rng } from '../materials/textures.js';
import { makeBarrel } from '../materials/barrel.js';
import { T, RX, RY, RZ, mul, vary, ngon } from './parts.js';

const PLANK = [1.04, 0.98, 0.92], DARKW = [0.78, 0.72, 0.66], IRON = [0.85, 0.8, 0.76], TWINE = [0.62, 0.5, 0.36];

// each maker works in the prop's own frame (M: where it stands and which way it turns) through `put`
const placer = (k, M) => ({
  b: (size, pos, rot, o) => k.board(size, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) }),
  x: (group, size, pos, rot, o = {}) => k.box(group, size, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) }),
  p: (group, poly, len, pos, rot, o = {}) => k.prism(group, poly, len, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) }),
  hay: (size, pos, rot) => k.parts.hay.push({ size, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()), o: { tint: vary(k, [1, 0.96, 0.88], 0.88, 1.08) } }),
});

const MAKERS = {
  trough(k, M, o) {
    const q = placer(k, M), L = o.len ?? 1.8, w = 0.6, h = 0.55;
    for (const s of [-1, 1]) for (const [y, hh] of [[0.24, 0.2], [0.44, 0.2]]) q.b([L, hh - 0.004, 0.05], [0, y, s * (w / 2 - 0.025)], [0, 0, 0], { long: 0, tint: vary(k, PLANK, 0.85, 1.1), skip: s > 0 ? '' : '' });
    for (const s of [-1, 1]) q.b([0.05, 0.41, w - 0.1], [s * (L / 2 - 0.05), 0.34, 0], null, { long: 1, tint: vary(k, PLANK, 0.85, 1.05) });
    q.b([L - 0.1, 0.05, w - 0.1], [0, 0.17, 0], null, { long: 0, tint: DARKW });
    for (const s of [-1, 1]) q.b([0.1, 0.13, w + 0.14], [s * (L / 2 - 0.25), 0.065, 0], null, { long: 2, tint: DARKW, strip: 10 });
    for (const s of [-1, 1]) q.x('iron', [0.035, 0.43, w + 0.012], [s * (L / 2 - 0.12), 0.34, 0], null, { tint: [1.5, 1.0, 0.72], skip: '-y' });
    q.x('iron', [L - 0.12, 0.012, w - 0.12], [0, 0.47, 0], null, { tint: [0.3, 0.36, 0.38] });    // the water
    k.solid([L, h, w], null, null, mul(M, T(0, h / 2, 0)));
  },
  crate(k, M, o) {
    const q = placer(k, M), s = o.size ?? 0.6, n = 3, sh = (s - 0.04) / n;
    q.x('wood', [s - 0.06, s - 0.06, s - 0.06], [0, s / 2, 0], null, { tint: [0.15, 0.13, 0.11], skip: '-y' });
    for (let f = 0; f < 4; f++) {
      const a = f * Math.PI / 2, dx = Math.sin(a) * (s / 2 - 0.012), dz = Math.cos(a) * (s / 2 - 0.012);
      for (let i = 0; i < n; i++) q.b([s - 0.1, sh - 0.025, 0.022], [dx, 0.03 + (i + 0.5) * sh, dz], [0, a, 0], { long: 0, tint: vary(k, PLANK, 0.85, 1.15), skip: '-z+x-x' });
    }
    for (let i = 0; i < 3; i++) q.b([s - 0.02, 0.022, (s - 0.04) / 3 - 0.02], [0, s - 0.011, -s / 2 + 0.02 + (i + 0.5) * (s - 0.04) / 3], null, { long: 0, tint: vary(k, PLANK, 0.85, 1.1), skip: '-y' });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.b([0.05, s - 0.02, 0.05], [sx * (s / 2 - 0.02), (s - 0.02) / 2, sz * (s / 2 - 0.02)], null, { long: 1, tint: vary(k, DARKW, 0.9, 1.1), skip: '-y' });
    k.solid([s, s, s], null, null, mul(M, T(0, s / 2, 0)));
  },
  bale(k, M, o) {
    const q = placer(k, M), L = 0.9, H = 0.4, Wd = 0.46;
    q.hay([L, H - 0.01, Wd], [0, H / 2, 0], [0, 0, 0]);
    for (const x of [-0.22, 0.22]) {
      q.b([0.018, 0.008, Wd + 0.012], [x, H + 0.0, 0], null, { long: 2, tint: TWINE, strip: 13, skip: '-y+z-z' });
      for (const s of [-1, 1]) q.b([0.018, H - 0.02, 0.008], [x, H / 2, s * (Wd / 2 + 0.002)], null, { long: 1, tint: TWINE, strip: 13, skip: '-y+y' + (s > 0 ? '-z' : '+z') });
    }
    k.solid([L, H, Wd], null, null, mul(M, T(0, H / 2, 0)));
  },
  bucket(k, M, o) {
    const q = placer(k, M), h = 0.3, r = 0.14;
    q.p('wood', ngon(10, r * 0.85), h, [0, h / 2, 0], null, { tint: vary(k, PLANK, 0.85, 1.05), taper: -0.2, skip: '+y' });
    q.p('iron', ngon(10, r * 0.95), 0.012, [0, h - 0.06, 0], null, { tint: [0.25, 0.3, 0.32], skip: '-y' });   // water
    for (const [y, rr] of [[0.06, 0.9], [h - 0.05, 1.04]]) q.p('iron', ngon(10, r * rr + 0.006), 0.03, [0, y, 0], null, { tint: IRON, skip: '+y-y', smooth: true });
    for (const s of [-1, 1]) q.x('iron', [0.008, 0.16, 0.008], [s * (r * 1.1), h + 0.06, 0], [0, 0, -s * 0.35], { tint: IRON });
    q.x('iron', [0.16, 0.008, 0.008], [0, h + 0.13, 0], null, { tint: IRON });
  },
  wagon(k, M, o) {
    const q = placer(k, M), bl = 3.1, bw = 1.05, fy = 0.92;
    // the box: floor boards, two boards up each side, the end boards
    for (let i = 0; i < 4; i++) q.b([bw - 0.01, 0.035, bl / 4 - 0.004], [0, fy, -bl / 2 + (i + 0.5) * bl / 4], null, { long: 2, tint: vary(k, PLANK, 0.8, 1.05), skip: '' });
    for (const s of [-1, 1]) for (const y of [fy + 0.13, fy + 0.33]) q.b([0.035, 0.19, bl], [s * (bw / 2 + 0.017), y, 0], null, { long: 2, tint: vary(k, PLANK, 0.85, 1.1), cuts: [-0.8, 0, 0.8] });
    for (const s of [-1, 1]) q.b([bw + 0.07, 0.38, 0.035], [0, fy + 0.22, s * (bl / 2 + 0.017)], null, { long: 0, tint: vary(k, PLANK, 0.85, 1.05) });
    for (const s of [-1, 1]) for (const z of [-1.1, 0, 1.1]) q.b([0.05, 0.42, 0.05], [s * (bw / 2 + 0.06), fy + 0.2, z], null, { long: 1, tint: DARKW });   // stakes
    q.b([0.12, 0.12, bl * 0.75], [0, fy - 0.1, 0], null, { long: 2, tint: DARKW, strip: 10 });   // the reach
    // the axles and bolsters, and four wheels: rim pieces, spokes, a hub (the back ones bigger)
    for (const [z, rad] of [[-bl / 2 + 0.55, 0.56], [bl / 2 - 0.55, 0.46]]) {
      q.b([1.55, 0.1, 0.1], [0, rad, z], null, { long: 0, tint: DARKW, strip: 11 });
      q.b([bw, 0.14, 0.14], [0, Math.max(rad + 0.12, fy - 0.09), z], null, { long: 0, tint: DARKW, strip: 10 });
      if (fy - 0.16 - (rad + 0.05) > 0.05) q.b([0.14, fy - 0.16 - (rad + 0.05), 0.14], [0, (fy - 0.16 + rad + 0.05) / 2, z], null, { long: 1, tint: DARKW });
      for (const s of [-1, 1]) wheel(k, mul(M, T(s * 0.72, rad, z), RZ(Math.PI / 2)), rad);
    }
    // the tongue, down on the ground in front
    const tl = 2.2, ta = Math.atan2(0.42, tl);
    q.b([0.08, 0.08, tl], [0, 0.26, bl / 2 - 0.55 + tl / 2 + 0.2], [ta, 0, 0], { long: 2, tint: DARKW, strip: 10 });
    q.b([0.9, 0.07, 0.07], [0, 0.06, bl / 2 + 1.75], null, { long: 0, tint: DARKW });
    k.solid([bw + 0.2, 0.5, bl], null, null, mul(M, T(0, fy + 0.2, 0)));
    k.solid([1.5, 1.0, 0.25], null, null, mul(M, T(0, 0.5, -bl / 2 + 0.55)));
    k.solid([1.5, 0.8, 0.25], null, null, mul(M, T(0, 0.4, bl / 2 - 0.55)));
  },
  bench(k, M, o) {
    const q = placer(k, M), L = o.len ?? 1.9, H = 0.46, D = 0.34;
    q.b([L, 0.06, D], [0, H - 0.03, 0], null, { long: 0, tint: vary(k, PLANK, 0.85, 1.05), cuts: [-0.5, 0.5], segFaces: '+y' });
    for (const s of [-1, 1]) {
      const x = s * (L / 2 - 0.22);
      for (const z of [-1, 1]) q.b([0.07, H - 0.06, 0.07], [x, (H - 0.06) / 2, z * (D / 2 - 0.06)], [z * 0.08, 0, 0], { long: 1, tint: vary(k, DARKW, 0.9, 1.1), skip: '-y' });
      q.b([0.06, 0.06, D - 0.06], [x, 0.16, 0], null, { long: 2, tint: DARKW });
    }
    q.b([L - 0.44, 0.06, 0.05], [0, 0.16, 0], null, { long: 0, tint: DARKW });
    k.solid([L, H, D], null, null, mul(M, T(0, H / 2, 0)));
  },
  woodpile(k, M, o) {
    const q = placer(k, M), L = o.len ?? 1.1, rows = o.rows ?? 4;
    for (const s of [-1, 1]) q.b([L + 0.1, 0.07, 0.07], [0, 0.035, s * 0.16], null, { long: 0, tint: DARKW, strip: 10 });
    const SPLIT = [1.1, 0.92, 0.74];
    for (let row = 0; row < rows; row++) {
      const n = Math.max(2, Math.round(L / 0.2) - (row > 2 ? 1 : 0));
      for (let i = 0; i < n; i++) {
        const x = -L / 2 + (L / n) * (i + 0.5) + (row % 2 ? 0.05 : 0) + k.r(-0.02, 0.02), y = 0.13 + row * 0.15;
        // (most of them rounds of a small log, bark on, the rings on their ends; one in three split in half or thirds,
        // turned its own way round its length; all lying along z, so their ends face out)
        const r = k.r(0.065, 0.085), ph = k.r(0, 6.28), c = Math.cos(ph), sn = Math.sin(ph), split = k.R() < 0.35;
        const poly = (split ? [[r, 0], [-r * 0.6, r * k.r(0.75, 0.95)], [-r * 0.6, -r * k.r(0.75, 0.95)]] : ngon(7, r, 0.12, k.R)).map(([a, b]) => [a * c - b * sn, a * sn + b * c]);
        q.p('wood', poly, k.r(0.42, 0.5), [x, y - (split ? 0 : 0.01), k.r(-0.03, 0.03)], [Math.PI / 2, 0, 0], split ? { tint: vary(k, SPLIT, 0.78, 1.05), strip: 2, fresh: true } : { tint: vary(k, [0.8, 0.72, 0.62], 0.8, 1.05), strip: 10, smooth: true, ends: 'log' });
      }
    }
    k.solid([L, rows * 0.15 + 0.05, 0.46], null, null, mul(M, T(0, (rows * 0.15 + 0.05) / 2, 0)));
  },
  hitchrail(k, M, o) {
    const q = placer(k, M), L = o.len ?? 2.6, H = 0.98, LOG = [0.95, 0.88, 0.8];
    for (const s of [-1, 1]) {
      q.p('wood', ngon(7, 0.075, 0.12, k.R), H + 0.05, [s * (L / 2 - 0.15), (H + 0.05) / 2 - 0.02, 0], [0, k.r(0, 3), k.r(-0.03, 0.03)], { tint: vary(k, LOG, 0.85, 1.05), smooth: true, ends: 'log', skip: '-y' });
      // the ring: eight little iron pieces round, hung from a staple on the post's front
      const rx = s * (L / 2 - 0.15), ry = H - 0.25, rz = 0.085, rr = 0.05;
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; q.x('iron', [0.012, 0.042, 0.012], [rx + Math.cos(a) * rr, ry + Math.sin(a) * rr, rz], [0, 0, a], { tint: [0.9, 0.8, 0.72] }); }
      q.x('iron', [0.02, 0.03, 0.03], [rx, ry + rr + 0.015, rz - 0.02], null, { tint: [0.9, 0.8, 0.72] });
    }
    q.p('wood', ngon(7, 0.07, 0.1, k.R), L + 0.3, [0, H + 0.02, 0], [0, 0, Math.PI / 2], { tint: vary(k, LOG, 0.9, 1.1), smooth: true, ends: 'log' });
    k.solid([L, 0.15, 0.15], null, null, mul(M, T(0, H, 0)));
  },
  plank(k, M, o) {
    const q = placer(k, M), L = o.len ?? 2.2, lean = o.lean ?? 0.4, a = Math.asin(Math.min(0.9, lean / L));
    q.b([0.26, L, 0.035], [0, L / 2 * Math.cos(a), lean / 2], [-a, 0, 0], { long: 1, tint: vary(k, PLANK, 0.8, 1.0), cuts: [-0.5, 0.5] });
    q.b([0.2, L * 0.92, 0.03], [0.24, L * 0.46 * Math.cos(a), lean * 0.46 + 0.02], [-a, 0, 0.03], { long: 1, tint: vary(k, DARKW, 0.85, 1.05) });
  },
};
// a spoked wheel in its own frame (its axle along y)
function wheel(k, M, rad) {
  const n = 10, ns = 8, tint = vary(k, DARKW, 0.9, 1.1), ring = rad - 0.04;
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * Math.PI * 2, L = 2 * rad * Math.sin(Math.PI / n) + 0.012;
    k.board([L, 0.07, 0.075], null, null, { m: mul(M, RY(-a), T(0, 0, ring), RY(0)), long: 0, tint, strip: 10, skip: '+x-x' });
    k.box('iron', [L, 0.06, 0.012], null, null, { m: mul(M, RY(-a), T(0, 0, rad - 0.0), RY(0)), tint: [0.7, 0.66, 0.62], skip: '-z+x-x' });
  }
  for (let i = 0; i < ns; i++) { const a = i / ns * Math.PI * 2; k.board([0.035, 0.045, ring - 0.08], null, null, { m: mul(M, RY(-a), T(0, 0, (ring + 0.08) / 2)), long: 2, tint, skip: '+z-z' }); }
  k.prism('wood', ngon(8, 0.09), 0.22, null, null, { m: M, tint: DARKW, smooth: true, ends: 'log' });
}

// a list of props into meshes: { geos: { wood, iron, hay }, tris, ms }. bake(geo): the building's light, if any
export function buildProps(list, { seed = 5, bake = null } = {}) {
  const t0 = performance.now(), k = new Kit(seed); k.parts.hay = []; k.parts.glow = [];
  const counts = {};
  for (const p of list) {
    const M = mul(T(p.x, p.y || 0, p.z), RY(p.rot || 0));
    if (p.type === 'barrel') makeBarrel(k, { x: p.x, y: p.y || 0, z: p.z, h: p.h, tint: [1.12, 1.06, 1.0], staves: 12, hoops: 2 });
    else if (MAKERS[p.type]) MAKERS[p.type](k, M, p);
    counts[p.type] = (counts[p.type] || 0) + 1;
  }
  const R = rng(seed + 3), geos = {};
  geos.wood = buildGeometry(k.parts.wood, 'wood', R, { topAt: () => 1.2 });
  geos.iron = buildGeometry(k.parts.iron, 'iron', R, { topAt: () => 1.2 });
  geos.hay = buildGeometry(k.parts.hay, 'stone', R, {});
  if (bake) for (const g in geos) bake(geos[g]);
  let tris = 0; for (const g in geos) tris += geos[g].index.count / 3;
  return { geos, counts, tris, solids: k.occ, ms: performance.now() - t0 };
}
