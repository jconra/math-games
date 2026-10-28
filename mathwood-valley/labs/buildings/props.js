// THE PROPS that go with a building: separate pieces, not part of its mesh, so the Town Lab can move them, take them
// away or put more down. A building lists the ones it comes with ({ type, x, y, z, rot, ... }); buildProps turns a list
// into three meshes (wood, iron, hay), from the Material Lab's parts kit like the building itself.
//
//   barrel   the Material Lab's coopered barrel (labs/materials/barrel.js)
//   trough   a plank water trough on two skids, iron bands round its ends, dark water in it
//   crate    a slatted crate (size), its dark inside showing between the slats
//   bale     a hay bale (0.9 x 0.4 x 0.46 m), two strings round it
//   hayHeap  a heap of loose hay, forked off a load (w x d, h high): low lumps lying over one another
//   bucket   a wooden bucket, two iron hoops, a wire bail
//   wagon    a farm wagon: plank box, four spoked wheels (the back ones bigger), the tongue down on the ground
//   bench    a long plank bench: a thick seat on two splayed leg frames, a stretcher between them (len)
//   woodpile split firewood stacked on two rails, ends out, a few billets on top (len)
//   hitchrail a peeled log rail on two posts, an iron ring on each post for the reins (len)
//   plank    a long board leaning on a wall (len, lean: how far its foot stands out)
// and the general store's (their faces from the store's picture, art.js STORE_ART, through goods.js):
//   barrel   fill: 'apples' | 'crackers' | 'pickles' (open, heaped full); keg (a small one: nails)
//   crate    fill: 'apples' (heaped), stencil: 'APPLES' | 'CRACKERS' (on its front), pails: how many tin pails on it
//   sack     a sack standing or lying (lie), print 'flour' | 'coffee' | 'burlap': a stuffed box, tied at its top
//   pail     a tin pail with its bail; washtub (hung: on a nail on the wall, its bottom to it); coalBucket
//   shovel   a long-handled shovel, spade or fork leaning on a wall (kind, lean); broom
//   bench    back: a settee's back rail on it

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, buildGeometry } from '../materials/cabin.js';
import { rng } from '../materials/textures.js';
import { makeBarrel } from '../materials/barrel.js';
import { T, RX, RY, RZ, mul, vary, ngon } from './parts.js';
import { Goods } from './goods.js';
import { STORE_ART, regionUV } from './art.js';

const PLANK = [1.04, 0.98, 0.92], DARKW = [0.78, 0.72, 0.66], IRON = [0.85, 0.8, 0.76], TWINE = [0.62, 0.5, 0.36];

// each maker works in the prop's own frame (M: where it stands and which way it turns) through `put`
const placer = (k, M) => ({
  b: (size, pos, rot, o) => k.board(size, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) }),
  x: (group, size, pos, rot, o = {}) => k.box(group, size, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) }),
  p: (group, poly, len, pos, rot, o = {}) => k.prism(group, poly, len, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) }),
  hay: (size, pos, rot) => k.parts.hay.push({ size, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()), o: { tint: vary(k, [1, 0.96, 0.88], 0.88, 1.08) } }),
});

export const MAKERS = {
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
    if (!o.fill) for (let i = 0; i < 3; i++) q.b([s - 0.02, 0.022, (s - 0.04) / 3 - 0.02], [0, s - 0.011, -s / 2 + 0.02 + (i + 0.5) * (s - 0.04) / 3], null, { long: 0, tint: vary(k, PLANK, 0.85, 1.1), skip: '-y' });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.b([0.05, s - 0.02, 0.05], [sx * (s / 2 - 0.02), (s - 0.02) / 2, sz * (s / 2 - 0.02)], null, { long: 1, tint: vary(k, DARKW, 0.9, 1.1), skip: '-y' });
    k.solid([s, s, s], null, null, mul(M, T(0, s / 2, 0)));
    // (the store's: heaped with apples instead of a lid, a word stencilled on its front, tin pails stood on it)
    if (o.fill && o.gd) o.gd.dome(s / 2 - 0.03, 0.09, mul(M, T(0, s - 0.03, 0), new THREE.Matrix4().makeScale(1, 1, 1)), 10, STORE_ART.heaps[o.fill], [1, 1, 1], 2);
    if (o.fill === 'apples' && o.gd) heapApples(o.gd, mul(M, T(0, s - 0.03, 0)), s / 2 - 0.03, 0.09, 7, k.R);
    if (o.stencil && o.decals) { const r = STORE_ART.stencils[o.stencil]; o.decals.push(plane(r, s * 0.84, s * 0.84 * r[3] / r[2], mul(M, T(0, s * 0.52, s / 2 + 0.004)))); }
    for (let i = 0; i < (o.pails || 0); i++) MAKERS.pail(k, mul(M, T((i - (o.pails - 1) / 2) * 0.27, s, (i % 2 ? 0.05 : -0.05)), RY(i * 1.3)), { gd: o.gd });
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
  hayHeap(k, M, o) {
    const q = placer(k, M), w = o.w ?? 1.6, d = o.d ?? 1.4, h = o.h ?? 0.8, HAY = [1, 0.96, 0.88];
    const lump = (r, jit) => ngon(8, r, jit, k.R).map(([x, z]) => [x * w, z * d]);
    q.p('hay', lump(0.5, 0.25), h * 0.55, [0, h * 0.27, 0], [0, k.r(0, 3), 0], { taper: 0.45, tint: vary(k, HAY, 0.9, 1.05) });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + k.r(-0.4, 0.4), rr = k.r(0.18, 0.3), hh = h * k.r(0.35, 0.6);
      q.p('hay', lump(k.r(0.26, 0.36), 0.3), hh, [Math.cos(a) * rr * w, hh / 2 - 0.02, Math.sin(a) * rr * d], [k.r(-0.12, 0.12), k.r(0, 3), k.r(-0.12, 0.12)], { taper: 0.6, tint: vary(k, HAY, 0.88, 1.06) });
    }
    q.p('hay', lump(0.24, 0.3), h * 0.42, [0, h * 0.68, 0], [0, k.r(0, 3), 0], { taper: 0.7, tint: vary(k, HAY, 0.92, 1.08) });
    k.solid([w * 0.8, h, d * 0.8], null, null, mul(M, T(0, h / 2, 0)));
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
    // (a settee's back: two posts up from the back legs, a top rail and a rail under it)
    if (o.back) {
      for (const s of [-1, 1]) q.b([0.06, 0.5, 0.05], [s * (L / 2 - 0.22), H + 0.22, -D / 2 + 0.04], [-0.12, 0, 0], { long: 1, tint: vary(k, DARKW, 0.9, 1.1) });
      for (const y of [0.24, 0.42]) q.b([L - 0.2, y > 0.3 ? 0.11 : 0.07, 0.035], [0, H + y, -D / 2 + 0.03 - y * 0.12], [-0.12, 0, 0], { long: 0, tint: vary(k, PLANK, 0.85, 1.0) });
    }
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
  // a tin pail: a tapered round body, a rolled rim, a wire bail laid down over it
  // (its tin is matte galvanized grey, from the store's picture: the kit's iron, without a sky to reflect, came out black)
  pail(k, M, o) {
    if (o.gd) galvPail(k, o.gd, M, o.h ?? 0.24, k.r(0.85, 1.05));
    k.solid([0.26, o.h ?? 0.24, 0.26], null, null, mul(M, T(0, (o.h ?? 0.24) / 2, 0)));
  },
  coalBucket(k, M, o) {
    const q = placer(k, M), h = 0.34, r = 0.15;
    q.p('iron', ngon(12, r), h, [0, h / 2, 0], null, { tint: [0.9, 0.86, 0.84], smooth: true, taper: -0.15, skip: '+y' });
    if (o.gd) o.gd.dome(r * 1.05, 0.07, mul(M, T(0, h - 0.02, 0)), 9, STORE_ART.tile.coal, [1, 1, 1], 2);
    q.x('iron', [0.3, 0.01, 0.01], [0, h + 0.07, 0], null, { tint: [0.5, 0.48, 0.46] });
    for (const s of [-1, 1]) q.x('iron', [0.01, 0.1, 0.01], [s * 0.15, h + 0.02, 0], null, { tint: [0.5, 0.48, 0.46] });
  },
  // a galvanized washtub: wide and shallow, two handles; hung: on a nail on the wall, its bottom against it
  // a galvanized oval washtub, 0.7 m long and a quarter of a metre deep, a rolled rim, a handle at each end; hung: on a
  // nail by its rim, its bottom out (as they hung), else standing
  washtub(k, M, o) {
    if (!o.gd) return;
    const h = 0.26, z = [1.9, 1.88, 1.84], W = o.hung ? mul(M, T(0, 0, h + 0.03), RX(-Math.PI / 2)) : M;
    o.gd.lathe([[0, 0], [0.26, 0], [0.275, 0.014], [0.33, 0.22], [0.345, 0.236], [0.35, 0.252], [0.338, 0.262], [0.322, 0.258]], W, 16, STORE_ART.tile.tin, z, { oval: [1, 0.74], flat: true });
    // (the handles: a strap bent into a loop at each end, riveted under the rim)
    for (const s of [-1, 1]) for (const [dx, dy, w, hh] of [[0.03, 0.2, 0.06, 0.018], [0.058, 0.2, 0.018, 0.07], [0.03, 0.2, 0.06, 0.018]].map((q, i) => [q[0], q[1] + (i - 1) * 0.026, q[2], q[3]])) {
      o.gd.box([w, hh, 0.07], mul(W, T(s * (0.35 + dx), dy, 0)), { '+x': STORE_ART.tile.tin, '-x': STORE_ART.tile.tin, '+y': STORE_ART.tile.tin, '-y': STORE_ART.tile.tin, '+z': STORE_ART.tile.tin, '-z': STORE_ART.tile.tin }, z.map((c) => c * 0.85));
    }
    if (o.hung) k.box('iron', [0.012, 0.012, 0.07], null, null, { m: mul(M, T(0, 0.35 * 0.74 * 0.62 + 0.24, 0.035)), tint: [0.4, 0.38, 0.36] });
  },
  // a shovel (rounded blade), a spade (square) or a fork, its handle leaning back to the wall: its foot `lean` out
  shovel(k, M, o) {
    const L = o.len ?? 1.45, lean = o.lean ?? 0.3, a = Math.asin(Math.min(0.8, lean / L)), kind = o.kind || 'shovel';
    const S = mul(M, T(0, 0, lean), RX(-a)), WOODT = [1.15, 1.0, 0.82];
    k.prism('wood', ngon(6, 0.018), L - 0.3, null, null, { m: mul(S, T(0, 0.3 + (L - 0.3) / 2, 0)), tint: vary(k, WOODT, 0.9, 1.1), smooth: true, strip: 2 });
    k.box('wood', [0.11, 0.025, 0.035], null, null, { m: mul(S, T(0, L - 0.01, 0)), tint: WOODT, long: 0 });   // the D grip's bar
    const IRONT = [1.0, 0.95, 0.9].map((c) => c * k.r(0.8, 1.1));
    if (kind === 'fork') { for (let i = 0; i < 4; i++) k.box('iron', [0.01, 0.3, 0.012], null, null, { m: mul(S, T(-0.06 + i * 0.04, 0.15, 0.01)), tint: IRONT }); k.box('iron', [0.14, 0.03, 0.02], null, null, { m: mul(S, T(0, 0.3, 0)), tint: IRONT }); }
    else { const w = kind === 'spade' ? 0.19 : 0.24; k.box('iron', [w, 0.3, 0.008], null, null, { m: mul(S, T(0, 0.15, 0.012), RX(kind === 'spade' ? 0 : -0.25)), tint: IRONT }); k.prism('iron', ngon(6, 0.024), 0.1, null, null, { m: mul(S, T(0, 0.32, 0)), tint: IRONT, smooth: true, taper: 0.3 }); }
  },
  broom(k, M, o) {
    const lean = o.lean ?? 0.18, L = 1.4, a = Math.asin(lean / L), S = mul(M, T(0, 0, lean), RX(-a));
    k.prism('wood', ngon(6, 0.015), L - 0.3, null, null, { m: mul(S, T(0, 0.3 + (L - 0.3) / 2, 0)), tint: [1.1, 0.95, 0.8], smooth: true, strip: 2 });
    if (o.gd) o.gd.cyl(0.13, 0.34, mul(S, T(0, 0.17, 0), new THREE.Matrix4().makeScale(1, 1, 0.3)), 8, STORE_ART.tile.rope, null, [1.2, 1.1, 0.8], { taper: 0.25 });
  },
  // a sack, stuffed: a box whose sides bulge and whose top is gathered and tied; standing, or lying on its side (lie)
  // a sack turned on a lathe, plain cloth all round (cream cotton for flour, burlap else): slumped, widest low down and
  // sagging its own way, gathered to a neck tied with twine and a ruffle above the tie; oval in section. Its label is
  // printed on its front only (a patch of the lathe a little proud of it, the label's picture laid once across it).
  // Standing, or lying on its side (lie: its turn), its label up
  sack(k, M, o) {
    if (!o.gd) return;
    const h = o.h ?? 0.62, f = h / 0.67, print = o.print || 'flour', cloth = print === 'flour' ? STORE_ART.tile.cotton : STORE_ART.burlap;
    const label = { flour: STORE_ART.flour, coffee: STORE_ART.coffee }[print], tint = vary(k, [1, 1, 1], 0.88, 1.06), ph = k.r(0, 6.28);
    const prof = [[0, 0], [0.21, 0], [0.27, 0.04], [0.285, 0.13], [0.27, 0.3], [0.235, 0.44], [0.16, 0.53], [0.07, 0.58], [0.042, 0.6], [0.075, 0.652], [0, 0.67]].map(([r, y]) => [r, y * f]);
    // (the sag: a lobe or two out, a hollow between, most at mid height; the shoulders slumped down a little)
    const bump = (a, y) => { const t = y / h; return t > 0.02 && t < 0.85 ? (0.06 * Math.sin(a * 2 + ph) + 0.03 * Math.sin(a * 3 + ph * 2)) * Math.sin(Math.min(1, t / 0.8) * Math.PI) : 0; };
    const lift = (a, y) => { const t = y / h; return t > 0.5 && t < 0.8 ? -0.025 * (1 + Math.sin(a + ph)) * Math.sin((t - 0.5) / 0.3 * Math.PI) : 0; };
    const S = o.lie ? mul(M, RY(o.lie), T(-h * 0.46, 0.165, 0), RZ(-Math.PI / 2)) : mul(M, RZ(k.r(-0.04, 0.04)));
    const ov = o.lie ? [0.6, 1] : [1, 0.62], turn = o.lie ? Math.PI / 2 : Math.PI;
    o.gd.lathe(prof, S, 10, cloth, tint, { oval: ov, bump, lift, turn });
    if (label) {
      // (the label: from a third up to three quarters, a quarter of the way round, 1 cm proud)
      const lp = prof.filter(([, y]) => y > 0.24 * h && y < 0.66 * h), lab = [[prof[3][0], 0.24 * h], ...lp, [prof[5][0] * 0.98, 0.66 * h]].map(([r, y]) => [r * 1.03, y]);
      o.gd.lathe(lab, S, 5, label, tint, { oval: ov, bump, lift, turn, arc: [Math.PI - 0.75, Math.PI + 0.75] });
    }
    if (!o.lie) o.gd.lathe([[0.05, 0.596 * f], [0.052, 0.61 * f], [0.046, 0.62 * f]], S, 8, STORE_ART.tile.rope, [0.8, 0.7, 0.55], { flat: true, oval: [1, 0.62] });
    k.solid([0.48, o.lie ? 0.34 : h, o.lie ? h : 0.34], null, null, mul(M, T(0, (o.lie ? 0.34 : h) / 2, 0)));
  },
};
// a galvanized pail turned on a lathe: tapered sides, a rolled rim, its dark inside and floor, two ears and a wire bail
// laid down over one side (its frame M at its foot)
export function galvPail(k, gd, M, h = 0.24, shade = 1, bailUp = false) {
  const zinc = [0.98, 0.97, 0.95].map((c) => c * shade), f = h / 0.244;
  gd.lathe([[0, 0], [0.098, 0], [0.102, 0.012 * f], [0.122, 0.222 * f], [0.131, 0.232 * f], [0.127, 0.244 * f]], M, 12, STORE_ART.tile.tin, zinc);
  gd.lathe([[0.119, 0.244 * f], [0.099, 0.03 * f], [0, 0.03 * f]], M, 10, STORE_ART.tile.tin, zinc.map((c) => c * 0.42));
  for (const s of [-1, 1]) k.box('iron', [0.012, 0.035, 0.02], null, null, { m: mul(M, T(s * 0.128, 0.215 * f, 0)), tint: [1.6, 1.6, 1.7] });
  const pts = [], up = bailUp ? 1 : 0.45; for (let i = 0; i <= 6; i++) { const t = i / 6 * Math.PI; pts.push([0.13 * Math.cos(t), 0.215 * f + 0.13 * Math.sin(t) * up, 0.13 * Math.sin(t) * Math.sqrt(1 - up * up)]); }
  for (let i = 0; i < 6; i++) { const [a, b] = [pts[i], pts[i + 1]], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(0, 1, 0)); m.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); k.box('iron', [0.006, 0.006, L + 0.006], null, null, { m: mul(M, m), tint: [1.2, 1.2, 1.25], skip: '+z-z' }); }
}
// real apples heaped on a heap (a dome of radius r, its top hd over the frame M): n low-poly apples, each its own shade
export function heapApples(gd, M, r, hd, n, R) {
  for (let i = 0; i < n; i++) {
    const ang = i * 2.399 + R() * 0.4, rho = r * 0.78 * Math.sqrt((i + 0.5) / n), y = hd * Math.sqrt(Math.max(0, 1 - (rho / r) ** 2)) + 0.022;
    const tint = R() < 0.25 ? [0.9, 1.25, 0.75] : [1, 1, 1].map((c) => c * (0.85 + R() * 0.25));
    gd.lathe([[0, -0.034], [0.032, -0.022], [0.039, 0.006], [0.027, 0.031], [0, 0.026]], mul(M, T(Math.cos(ang) * rho, y, Math.sin(ang) * rho), RX(R() * 0.8 - 0.4), RZ(R() * 0.8 - 0.4)), 6, STORE_ART.tile.felt, tint);
  }
}
// a decal plane (a region of the store's picture), w x h, placed by m
function plane(reg, w, h, m) {
  const g = new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1] = regionUV(reg), U = g.attributes.uv;
  for (let i = 0; i < U.count; i++) U.setXY(i, u0 + (u1 - u0) * U.getX(i), v0 + (v1 - v0) * U.getY(i));
  g.applyMatrix4(m); return g;
}
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

// a list of props into meshes: { geos: { wood, iron, hay, goods?, decal? }, tris, ms }. bake(geo): the building's light, if any
export function buildProps(list, { seed = 5, bake = null } = {}) {
  const t0 = performance.now(), k = new Kit(seed); k.parts.hay = []; k.parts.glow = [];
  const counts = {}, gd = new Goods(STORE_ART.w, STORE_ART.h), decals = [];
  for (const p0 of list) {
    const p = { ...p0, gd, decals }, M = mul(T(p.x, p.y || 0, p.z), RY(p.rot || 0));
    if (p.type === 'barrel' || p.type === 'keg') {
      // (a keg: a small barrel; a barrel with a fill stands open, heaped with it, a hand's width below its rim)
      const h = p.type === 'keg' ? 0.5 : p.h ?? 0.86, r = p.type === 'keg' ? 0.2 : 0.3;
      makeBarrel(k, { x: p.x, y: p.y || 0, z: p.z, h, r, tint: [1.12, 1.06, 1.0], staves: p.type === 'keg' ? 10 : 12, hoops: 2, lid: !p.fill });
      if (p.fill) gd.dome(r * 0.86 - 0.025, 0.1, mul(M, T(0, h - 0.07, 0)), 12, STORE_ART.heaps[p.fill], [1, 1, 1], 3);
      if (p.fill === 'apples') heapApples(gd, mul(M, T(0, h - 0.07, 0)), r * 0.86 - 0.025, 0.1, 9, k.R);
    } else if (MAKERS[p.type]) MAKERS[p.type](k, M, p);
    counts[p.type] = (counts[p.type] || 0) + 1;
  }
  const R = rng(seed + 3), geos = {};
  geos.wood = buildGeometry(k.parts.wood, 'wood', R, { topAt: () => 1.2 });
  geos.iron = buildGeometry(k.parts.iron, 'iron', R, { topAt: () => 1.2 });
  geos.hay = buildGeometry(k.parts.hay, 'stone', R, {});
  const goods = gd.build(); if (goods) geos.goods = goods;
  if (decals.length) { geos.decal = mergeGeometries(decals); for (const g of decals) g.dispose(); }
  if (bake) for (const g in geos) bake(geos[g]);
  let tris = 0; for (const g in geos) tris += geos[g].index.count / 3;
  return { geos, counts, tris, solids: k.occ, ms: performance.now() - t0 };
}
