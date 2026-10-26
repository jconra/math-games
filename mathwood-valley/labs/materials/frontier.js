// THE FRONTIER CABIN: a second cabin from the same parts kit as cabin.js, built to look like an 1880s Montana homestead
// (and the game's Tripo cabin) instead of a tidy modern house: hewn logs with pale chinking between them and their ends
// crossing at the corners, big split shakes on the roof (each its own width, a little crooked, the odd gap or missing
// one), a ridge that has sagged, plain dark weathered wood where the neat cabin has white trim, board shutters, a
// pole-railed porch on stone piers and a fieldstone chimney.
//
// It costs about as many triangles as the Tripo model, a third of the neat cabin:
//   - fewer, bigger pieces: a log is one box, a shake is one box (and a shake is three times the size of a shingle)
//   - faces nobody can ever see are left out: a shake's underside and its top end (under the next course), the back
//     of a shutter, the inside faces of a chimney stone
//   - a long log gets extra corners only along its outside face, where the baked shading needs them
//
// More baked shadow, in two passes:
//   - the voxel bake from cabin.js (Occlusion), reaching further here (2.4 m), so a porch ceiling sees the deck under
//     it and the wall under the eaves sees the roof over it
//   - a close-range pass of its own (Contact, below): short rays from each corner tested against the real boxes nearby,
//     so the 4 cm gap between two logs, the lip of a shake over the course under it and a window's reveal go dark;
//     the 8 cm voxels are far too coarse to see those
//
// The same layout as the neat cabin: middle at x = z = 0, ground at y = 0, the porch faces +z (south), +x is east. Metres.

import * as THREE from 'three';
import { rng } from './textures.js';
import { Kit, buildGeometry, Occlusion } from './cabin.js';

const W = 6.4, D = 4.8;                    // the log walls' outside faces (the log ends stick out past these)
const PIER = 0.4;                          // top of the stone piers: the bottom logs sit on them
const C = 0.31;                            // one course: a log and the chinking over it
const NC = 9;                              // courses on the front and back walls (the eave walls)
const EAVE = PIER + NC * C;                // 3.19: top of the eave walls
const PITCH = 37 * Math.PI / 180, TP = Math.tan(PITCH);
const RIDGE = EAVE + (D / 2) * TP;         // 5.0
const GX = 0.42, OV_F = 0.12, OV_B = 0.5;  // how far the main roof runs past the gable walls, and past the eave walls
const PD = 1.9, DECK = 0.5;                // porch depth, the top of its deck
const P_TOP = EAVE - 0.22, P_PITCH = 10 * Math.PI / 180;   // the porch roof meets the front wall here, at this slope
const POST_Z = D / 2 + PD - 0.16;
// the chimney: a wide base up to the shoulder, then a narrower stack up past the ridge
const CH = { x0: -W / 2 - 0.84, x1: -W / 2 + 0.02, z1: 0.56, sh: 2.3, sx0: -W / 2 - 0.72, sx1: -W / 2 - 0.08, sz: 0.36, top: RIDGE + 0.75 };
export const FRONTIER = { W, D, PD, DECK, EAVE, RIDGE };

// the underside of the main roof over a spot (the top of the sheathing is the slope's plane; the boards are 2.4 cm)
const roofUnder = (z) => RIDGE - 0.01 - Math.abs(z) * TP;
// the height of the roof edge water drips from, above a point: what the grime streaks run down from
export function topAt(x, z) {
  if (x < -W / 2 - 0.03 && Math.abs(z) < CH.z1 + 0.05) return CH.top;                                   // the chimney
  if (z > D / 2 - 0.35 && z < D / 2 + 0.06 && Math.abs(x) < W / 2 + 0.1) return DECK + 0.35;           // the front wall: the porch roof keeps the rain off it
  if (z > D / 2 + 0.02) return P_TOP - (z - D / 2) * Math.tan(P_PITCH) - 0.05;                           // under the porch roof
  return Math.max(EAVE, RIDGE - Math.abs(z) * TP) - 0.02;                                                // under the main roof
}

// ── colours: tints on the trim sheet's strips (1 = the strip as drawn) ─────────────────────────────────────────────────
const LOG = [1.12, 0.94, 0.78], LOG_GREY = [1.1, 1.04, 0.98];     // hewn logs: brown, some gone grey
const CHINK = [2.1, 1.95, 1.7];                                      // mud-and-lime chinking (on the stone texture)
const DARKW = [0.62, 0.55, 0.5];                                     // door, frames, shutters, barge boards: old dark wood
const BOARD = [0.92, 0.86, 0.82];                                    // the gable boards
const POLE = [1.5, 1.32, 1.12];                                      // peeled poles: posts, rails, rafters
const DECKW = [0.86, 0.82, 0.8];
const SPLIT = [1.1, 0.92, 0.74];                                     // fresh-split firewood
const smooth01 = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// every wood corner's own tint: up high the sun has bleached the brown out of it (silver-grey), low down it is darker and
// dirtier (rain splash, damp). Done per corner, so one tall post goes from one to the other along its length.
function weatherTint(x, y, z, t, o) {
  if (o.fresh) return t;
  const f = smooth01(y, 0.3, 4.6), lum = t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11, g = 0.6 * (o.bleach ?? 1);
  const lo = [t[0] * 0.8, t[1] * 0.77, t[2] * 0.74];
  const hi = [(t[0] + (lum * 0.86 - t[0]) * g) * 1.1, (t[1] + (lum * 1.02 - t[1]) * g) * 1.1, (t[2] + (lum * 1.32 - t[2]) * g) * 1.1];
  return [lo[0] + (hi[0] - lo[0]) * f, lo[1] + (hi[1] - lo[1]) * f, lo[2] + (hi[2] - lo[2]) * f];
}
function stoneTint(x, y, z, t) { const f = 0.78 + 0.22 * smooth01(y, 0, 1.2); return [t[0] * f, t[1] * f, t[2] * f * 0.97]; }

// the roof sags: a little at the eaves, more along the ridge (the long timbers have bent in the middle), and the porch
// roof drops toward its front edge between the end posts. Bends the finished corners of the parts marked with o.warp.
function warp(v, name) {
  if (name === 'main') {
    const hx = W / 2 + GX, f = 1 - (v.x / hx) ** 2;
    v.y -= Math.max(0, f) * (0.03 + 0.035 * smooth01(v.y, EAVE, RIDGE));
  } else if (name === 'porch') {
    const hx = W / 2 + 0.3, f = Math.max(0, 1 - (v.x / hx) ** 2);
    v.y -= 0.04 * f * Math.min(1.2, Math.max(0, (v.z - D / 2) / (POST_Z - D / 2))) * smooth01(v.y, 1.3, 2.3);
  }
}

// ── the walls: each in its own frame ──────────────────────────────────────────────────────────────────────────────────
// x along the wall (to the right, seen from outside), y up, z out of it, from the middle of its outside face at ground
// level. Front and back are the eave walls; east and west the gable walls, their courses half a log higher or lower,
// so the logs cross at the corners.
const WALL = {
  front: { th: 0, d: D / 2, hw: W / 2, side: false },
  back: { th: Math.PI, d: D / 2, hw: W / 2, side: false },
  east: { th: Math.PI / 2, d: W / 2, hw: D / 2, side: true },
  west: { th: -Math.PI / 2, d: W / 2, hw: D / 2, side: true },
};
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), ONE = new THREE.Vector3(1, 1, 1);
function wallM(w, a, y, out, rot) {
  return new THREE.Matrix4().makeRotationY(w.th).multiply(new THREE.Matrix4().compose(new THREE.Vector3(a, y, w.d + out), _q.setFromEuler(_e.set(...(rot || [0, 0, 0]), 'YXZ')), ONE));
}
const mul = (m, ...more) => { const r = m.clone(); for (const x of more) r.multiply(x); return r; };
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const RX = (a) => new THREE.Matrix4().makeRotationX(a), RY = (a) => new THREE.Matrix4().makeRotationY(a), RZ = (a) => new THREE.Matrix4().makeRotationZ(a);
// an n-sided outline round the middle, each corner pushed in or out by up to jit/2 of the radius (R: the kit's random)
const ngon = (n, r, jit = 0, R = () => 0.5) => Array.from({ length: n }, (_, i) => { const a = (i + 0.5) / n * Math.PI * 2, rr = r * (1 + (R() - 0.5) * jit); return [Math.cos(a) * rr, Math.sin(a) * rr]; });

// the openings, in each wall's frame: a0..a1 along it, and the courses taken out of it (c0..c1)
const OPEN = {
  front: [{ a0: -0.98, a1: -0.02, c0: 1, c1: 6, door: true }, { a0: 1.2, a1: 2.05, c0: 4, c1: 6, shutters: [-1, 1], crooked: -1 }],
  back: [{ a0: 0.7, a1: 1.38, c0: 4, c1: 5, shutters: [1] }],
  east: [{ a0: -0.45, a1: 0.4, c0: 4, c1: 6, shutters: [-1, 1] }],
  west: [],
};

// rows of corners along a log: just short of the corner where the crossing logs stand out in front of it, and enough
// between that no stretch is longer than `step` (the baked shading changes only from one row to the next)
function cutsFor(len, marks, step = 1.8) {
  const h = len / 2, pts = [-h, ...marks.filter((x) => x > -h + 0.05 && x < h - 0.05).sort((p, q) => p - q), h], out = [];
  for (let q = 0; q < pts.length - 1; q++) {
    if (q > 0) out.push(pts[q]);
    const n = Math.ceil((pts[q + 1] - pts[q]) / step);
    for (let r = 1; r < n; r++) out.push(pts[q] + (pts[q + 1] - pts[q]) * r / n);
  }
  return out;
}

function walls(k) {
  for (const [name, w] of Object.entries(WALL)) {
    const n = w.side ? 10 : 9, bots = [], tops = [];
    for (let i = 0; i < n; i++) {
      const g = k.r(0.025, 0.06);
      // a gable wall starts and ends with a half log, so its courses sit between the eave walls' courses
      bots.push(w.side ? Math.max(PIER, PIER + (i - 0.5) * C) : PIER + i * C);
      tops.push(w.side ? Math.min(PIER + (i + 0.5) * C - g, EAVE - 0.012) : PIER + (i + 1) * C - g);
    }
    w.bots = bots; w.tops = tops;
    const opens = OPEN[name];
    const frontEnd = name === 'east' ? 0 : name === 'west' ? 1 : -1;   // which end of a gable log is at the porch
    for (let i = 0; i < n; i++) {
      const yb = bots[i], yt = tops[i], h = yt - yb;
      // the ends: ragged lengths past the corner. A gable wall's ends reach out under the eaves, so they stay under the
      // roof (and under the porch roof, and clear of the deck, at the front)
      const e = [k.r(0.16, 0.42), k.r(0.16, 0.42)];
      if (w.side) {
        const maxE = Math.max(0.02, (roofUnder(D / 2) - yt) / TP - 0.05);
        e[0] = Math.min(e[0], maxE); e[1] = Math.min(e[1], maxE);
        if (yt > P_TOP - 0.24 || yb < DECK + 0.08) e[frontEnd] = Math.min(e[frontEnd], 0.03);
      }
      let spans = [[-w.hw - e[0], w.hw + e[1]]];
      for (const o of opens) if (i >= o.c0 && i <= o.c1) spans = spans.flatMap(([s, f]) => (o.a1 <= s || o.a0 >= f ? [[s, f]] : [[s, o.a0], [o.a1, f]].filter(([p, q]) => q - p > 0.05)));
      for (const [s, f] of spans) {
        const t = k.r(0.22, 0.27), len = f - s, mid = (s + f) / 2;
        const marks = [-w.hw + 0.28, w.hw - 0.28].map((x) => x - mid);
        // a little out of true: leaning in or out, one end higher, not quite square to the wall
        const rot = [k.r(-0.03, 0.03), k.r(-0.005, 0.005), k.r(-0.004, 0.004) * (len > 2 ? 1 : 2)];
        const grey = k.R() < 0.22, lum = k.r(0.86, 1.14), tint = (grey ? LOG_GREY : LOG).map((c) => c * lum);
        k.board([len, h, t], null, null, { m: wallM(w, mid, (yb + yt) / 2, k.r(-0.012, 0.012) - t / 2, rot), long: 0, tint, strip: [10, 11, 1, 3, 5, 9][Math.floor(k.R() * 6)], cuts: cutsFor(len, marks), segFaces: '+z', contactSide: 0.45, pairAO: true });
      }
      // the chinking over this log: a strip set back in the gap, only its face drawn (cut round the openings). The
      // close-range shadow counts only half on upright faces (contactSide): a log's face or the chinking has corners
      // only along its edges, so the dark of the gap would spread over the whole face; the gap's top and bottom take it
      // in full
      if (i < n - 1) {
        const y0 = yt - 0.012, y1 = bots[i + 1] + 0.012;
        let cs = [[-w.hw + 0.18, w.hw - 0.18]];
        for (const o of opens) if (i >= o.c0 - 1 && i <= o.c1) cs = cs.flatMap(([s, f]) => (o.a1 <= s || o.a0 >= f ? [[s, f]] : [[s, o.a0 + 0.02], [o.a1 - 0.02, f]].filter(([p, q]) => q - p > 0.05)));
        for (const [s, f] of cs) {
          const len = f - s, mid = (s + f) / 2;
          k.box('stone', [len, y1 - y0, 0.06], null, null, { m: wallM(w, mid, (y0 + y1) / 2, -0.028 - 0.03, [k.r(-0.02, 0.02), 0, 0]), tint: CHINK.map((c) => c * k.r(0.92, 1.06)), skip: '-z+y-y+x-x', cuts: cutsFor(len, [], 2.2), long: 0, contactSide: 0.55, pairAO: true });
        }
      }
    }
    // the light-blocking core: the walls' insides, well behind the chinking
    if (name === 'front') k.solid([W - 0.44, EAVE - PIER, D - 0.44], [0, (EAVE + PIER) / 2, 0]);
    for (const o of opens) opening(k, w, o);
  }
}

// the frame round an opening: rough boards lining the sides (standing a little proud of the logs, so they read as the
// frame), a crooked header board over it; for a window a sill, dark glass, a cross of glazing bars and board shutters;
// for the door the door itself
function opening(k, w, o) {
  const y0 = w.tops[o.c0 - 1], y1 = w.bots[o.c1 + 1], h = y1 - y0, wd = o.a1 - o.a0, ac = (o.a0 + o.a1) / 2, dep = 0.29;
  const add = (group, size, a, y, out, rot, opt = {}) => (group === 'wood' ? k.board(size, null, null, { m: wallM(w, a, y, out, rot), tint: DARKW, ...opt }) : k.box(group, size, null, null, { m: wallM(w, a, y, out, rot), ...opt }));
  add('wood', [0.07, h + 0.02, dep], o.a0 + 0.035, y0 + h / 2, -dep / 2 + 0.025, [0, 0, k.r(-0.01, 0.01)], { long: 1 });
  add('wood', [0.07, h + 0.02, dep], o.a1 - 0.035, y0 + h / 2, -dep / 2 + 0.025, [0, 0, k.r(-0.01, 0.01)], { long: 1 });
  add('wood', [wd + k.r(0.24, 0.4), 0.12, 0.07], ac + k.r(-0.04, 0.04), y1 + 0.035, 0.035, [0, 0, k.r(-0.025, 0.025)], { long: 0, skip: '-z' });
  k.solid([wd, h, 0.12], null, null, wallM(w, ac, y0 + h / 2, -0.1));
  if (o.door) {
    // five planks of their own widths on two battens and a brace, iron strap hinges, a latch
    const dz = -0.06, ws = [0.22, 0.17, 0.2, 0.18, 0.19], sum = ws.reduce((p, q) => p + q, 0), inner = wd - 0.14;
    add('wood', [inner, h, 0.01], ac, y0 + h / 2, dz - 0.03, null, { tint: [0.12, 0.1, 0.09], skip: '-z+x-x+y-y', long: 1 });   // the dark room behind the gaps
    let a = o.a0 + 0.07;
    const doorW = [0.95, 0.88, 0.82];   // the door's planks: grey and sun-dried, lighter than the logs round them
    for (const pw of ws) { const ww = pw / sum * inner; add('wood', [ww - 0.006, h - 0.02, 0.04], a + ww / 2, y0 + h / 2 - 0.01, dz, [0, 0, k.r(-0.004, 0.004)], { long: 1, skip: '-z', tint: doorW.map((c) => c * k.r(0.85, 1.1)) }); a += ww; }
    const ya = y0 + 0.32, yb2 = y1 - 0.32;
    for (const yy of [ya, yb2]) add('wood', [inner - 0.06, 0.12, 0.03], ac, yy, dz + 0.035, null, { long: 0, skip: '-z' });
    const br = Math.atan2(yb2 - ya, inner - 0.2), bl = Math.hypot(yb2 - ya, inner - 0.2);
    add('wood', [bl, 0.11, 0.03], ac, (ya + yb2) / 2, dz + 0.035, [0, 0, -br], { long: 0, skip: '-z' });
    for (const yy of [ya, yb2]) { add('iron', [0.5, 0.045, 0.012], o.a0 + 0.07 + 0.25, yy, dz + 0.056); add('iron', [0.05, 0.1, 0.05], o.a0 + 0.06, yy, dz + 0.03); }
    add('iron', [0.03, 0.16, 0.025], o.a1 - 0.17, y0 + 1.0, dz + 0.04); add('iron', [0.13, 0.025, 0.04], o.a1 - 0.17, y0 + 0.93, dz + 0.06);
    return;
  }
  add('wood', [wd + 0.26, 0.05, dep + 0.08], ac, y0 - 0.005, -dep / 2 + 0.07, [k.r(-0.03, 0.01), 0, k.r(-0.02, 0.02)], { long: 0 });   // the sill
  add('glass', [wd - 0.12, h, 0.012], ac, y0 + h / 2, -0.13);
  add('wood', [0.03, h, 0.025], ac, y0 + h / 2, -0.11, null, { long: 1, skip: '-z' });
  add('wood', [wd - 0.12, 0.03, 0.025], ac, y0 + h * 0.52, -0.11, null, { long: 0, skip: '-z' });
  for (const side of o.shutters || []) shutter(k, w, side < 0 ? o.a0 - 0.08 : o.a1 + 0.08, y1 + 0.02, wd / 2 + 0.05, h + 0.06, side, o.crooked === side ? 0.11 : 0);
}

// a board shutter standing open against the wall: two planks on two battens, hung from its top corner by the window.
// side -1 lies to the left of it. A crooked one has lost its bottom hinge and swung round the top one.
function shutter(k, w, pa, py, wid, hgt, side, crooked) {
  const P = wallM(w, pa, py, 0.02, [0, 0, -side * crooked]);
  const add = (size, dx, dy, dz, opt) => k.board(size, null, null, { m: mul(P, T(dx, dy, dz)), skip: '-z', tint: DARKW.map((c) => c * 1.06), ...opt });
  const pw = wid / 2;
  for (let q = 0; q < 2; q++) add([pw - 0.008, hgt - q * k.r(0, 0.05), 0.024], side * (q + 0.5) * pw, -hgt / 2, 0.012, { long: 1 });
  for (const yy of [0.17, hgt - 0.17]) add([wid - 0.06, 0.085, 0.02], side * wid / 2, -yy, 0.034, { long: 0 });
}

// the gable ends: vertical boards, each its own width with a gap beside it, cut to the roof line, over a dark backing
function gables(k) {
  for (const name of ['east', 'west']) {
    const w = WALL[name], yb = EAVE - 0.08;
    for (const dir of [1, -1]) {             // from the middle out each way, so the boards at the ridge each have one slope
      let a = 0;
      while (a < D / 2) {
        const bw = Math.min(k.r(0.2, 0.34), D / 2 + 0.03 - a); if (bw < 0.05) break;
        const ac = dir * (a + bw / 2), h = roofUnder(ac) - 0.015 - yb;
        const hidden = name === 'west' && a + bw < CH.sz - 0.02;   // behind the chimney stack
        if (h > 0.05 && !hidden) k.board([bw, h, 0.025], null, null, { m: wallM(w, ac, yb + h / 2, 0.03, [0, 0, k.r(-0.006, 0.006)]), long: 1, tint: BOARD.map((c) => c * k.r(0.85, 1.12)), skip: '-z', slope: -TP * dir });
        a += bw + (k.R() < 0.15 ? k.r(0.03, 0.05) : k.r(0.006, 0.022));
      }
    }
    // the backing (seen only through the gaps): one dark triangle
    const hb = RIDGE - EAVE - 0.04;
    k.prism('wood', [[-D / 2 + 0.01, 0], [D / 2 - 0.01, 0], [0, -hb]], 0.01, null, null, { m: mul(wallM(w, 0, EAVE - 0.012, 0.008), RX(Math.PI / 2)), tint: [0.22, 0.19, 0.17], skip: '-y' });
    // the attic, for the light
    for (let i = 0; i < 5 && name === 'east'; i++) { const y0 = EAVE + i * (RIDGE - EAVE) / 5, y1 = y0 + (RIDGE - EAVE) / 5, hw = (RIDGE - y1) / TP; k.solid([W - 0.1, y1 - y0, Math.max(0.05, 2 * hw - 0.1)], [0, (y0 + y1) / 2, 0]); }
  }
}

// ── the roofs ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// one roof slope in its own frame (its top edge along x at height topY, z = 0, running down toward +z), moved into
// place by M: sheathing boards (only where they can be seen from below), a thick starter strip at the eave, courses of
// split shakes, and for the main roof the ridge boards, barge boards and the purlin ends under the gables
function roofSlope(k, M, o) {
  const { x0, x1, topY, len, pitch, warpName, hole } = o;
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const up = new THREE.Vector3(0, sp, -cp), nrm = new THREE.Vector3(0, cp, sp);
  const eave = new THREE.Vector3(0, topY - len * sp, len * cp);
  const at = (x, s, n) => eave.clone().addScaledVector(up, s).addScaledVector(nrm, n).setX(x);
  const Rp = RX(pitch);                                               // a box's z runs down the slope, its y out of it
  const frame = (x, s, n, extra) => { const m = mul(M, T(...at(x, s, n).toArray()), Rp); if (extra) m.multiply(extra); return m; };
  const wood = (size, x, s, n, extra, opt) => k.board(size, null, null, { warp: warpName, ...opt, m: frame(x, s, n, extra) });
  // sheathing: wide boards across the slope. Over the eave overhang and the gable overhangs they show from below; over
  // the attic nobody sees them, so there they are left out
  for (let s = 0; s < len - 0.02;) {
    const ds = Math.min(k.r(0.38, 0.5), len - s), full = s < o.eaveS + 0.02;
    const j1 = k.r(-1.7, -0.8), j2 = k.r(0.8, 1.7);
    const pieces = full ? [[x0, j1], [j1, j2], [j2, x1]] : [[x0, -W / 2 + 0.3], [W / 2 - 0.3, x1]];
    for (const [a, b] of pieces) wood([b - a - 0.004, 0.024, ds - 0.006], (a + b) / 2, s + ds / 2, -0.012, null, { long: 0, tint: (o.ceiling ? DECKW : DARKW).map((c) => c * k.r(0.9, 1.1)), skip: '+y' });
    s += ds;
  }
  for (let q = 0; q < 6; q++) { const a = x0 + (x1 - x0) * q / 6, b = a + (x1 - x0) / 6; k.solid([b - a, 0.1, len], null, null, frame((a + b) / 2, len / 2, -0.07)); k.occ[k.occ.length - 1].warp = warpName; }
  // over the attic, a dark underlay where the sheathing is left out (seen only through a gap or a missing shake)
  if (o.main) {
    const a = -W / 2 + 0.28, b = W / 2 - 0.28, s0 = o.eaveS, s1 = len + 0.02;
    k.box('wood', [b - a, 0.01, s1 - s0], null, null, { m: frame(0, (s0 + s1) / 2, -0.004), warp: warpName, tint: [0.2, 0.18, 0.16], skip: '-y+x-x+z-z', cuts: [-2.2, -1.1, 0, 1.1, 2.2], long: 0, strip: 10 });
  }
  // the starter strip: the first course needs something under its butt, and it gives the eave its thick edge
  for (const [a, b] of [[x0 - 0.04, -1.1], [-1.1, 1.3], [1.3, x1 + 0.04]]) wood([b - a, 0.07, 0.2], (a + b) / 2, 0.1, 0.035, null, { long: 0, tint: DARKW, skip: '-z' });
  // the shakes. Each course rests its butts on the course below, so every shake tilts up a little: that lift, and the
  // butt's thickness, are the dark line under each course. Widths at random; a joint never lines up with one in the
  // course below (rain would run straight through); a few are left out. Drawn: the top and the butt (the thin sides,
  // the underside and the top end, all under or between other shakes, are left out). The top gets two extra rows of
  // corners just below where the next course's butt lies over it, so the baked shadow is a sharp band there, not a
  // long fade. A wide shake shows two strips of the trim sheet across it: the bevel between them looks like a split.
  let s = -0.06, row = 0, below = [];
  const _c = new THREE.Vector3(), _a = new THREE.Vector3();
  while (s < len - 0.1) {
    const e = k.r(0.3, 0.36), joints = [];
    let x = x0 - 0.03, first = true;
    while (x < x1 + 0.03) {
      let w = first ? k.r(0.12, 0.5) : k.R() < 0.3 ? k.r(0.24, 0.36) : k.r(0.36, 0.6);
      first = false;
      for (const j of below) if (Math.abs(x + w - j) < 0.05) w += 0.1;
      w = Math.min(w, x1 + 0.05 - x); if (w < 0.07) break;
      const gap = k.R() < 0.05 ? k.r(0.025, 0.05) : k.r(0.003, 0.014);
      // (real shakes taper, thick butt to thin top, so they lie flatter than a box resting on the course below would)
      const th = k.r(0.028, 0.045), L = Math.min(e * 2.3, len - s + 0.03), lift = 0.5 * th / e, cx = x + (w - gap) / 2;
      const ctr = at(cx, s + L / 2, 0).applyMatrix4(M);
      const missing = row > 1 && s < len - 0.9 && k.R() < 0.014;
      if (!missing && !(hole && hole(ctr.x, ctr.z))) {
        const extra = mul(RY(k.r(-0.03, 0.03)), RZ(k.r(-0.025, 0.025)), RX(-lift));
        const m = frame(cx, s + L / 2, th / 2 + 0.002 + (L / 2) * Math.sin(lift), extra);
        // the trim sheet has a nail every 1.2 m along a strip: slide each shake's u so its nail sits under the next course
        _c.setFromMatrixPosition(m); _a.set(0, 0, 1).transformDirection(m);
        const uShift = 0.6 - _c.dot(_a) + (L / 2 - 0.1) + 1.2 * Math.floor(k.R() * 3);
        const r = k.R(), g = k.r(0.93, 1.07);
        const tint = r < 0.06 ? [0.84, 0.82, 0.82] : r < 0.1 ? [1.1, 0.98, 0.86] : [g * 1.06, g * 1.02, g];   // a few darker, a few newer replacements
        k.board([w - gap, th, L], null, null, { m, warp: warpName, long: 2, strip: [0, 2, 6][Math.floor(k.R() * 3)], span: w > 0.38 ? 2 : 1, tint, uShift, skip: row === 0 ? '-z+x-x' : '-y-z+x-x', bleach: 1.1, cuts: [L / 2 - e + 0.02, L / 2 - e + 0.07], segFaces: '+y' });
      }
      joints.push(x + w); x += w;
    }
    below = joints; s += e; row++;
  }
  if (!o.main) return;
  // the ridge: two rough boards over the top course, in pieces of their own lengths, each a little off line
  for (let a = x0 - 0.03; a < x1 + 0.02;) {
    const pl = Math.min(k.r(1.6, 2.8), x1 + 0.04 - a);
    wood([pl - 0.01, 0.03, 0.24], a + pl / 2, len - 0.1, 0.075, mul(RY(k.r(-0.012, 0.012)), RX(-0.1)), { long: 0, tint: DARKW.map((c) => c * 1.15) });
    a += pl;
  }
  // barge boards along the gable edges, hanging below the roof edge and covering the ends of the courses
  for (const x of [x0 - 0.025, x1 + 0.025]) wood([0.045, 0.26, len + 0.06], x, len / 2 - 0.02, -0.02, RY(k.r(-0.01, 0.01)), { long: 2, tint: DARKW, strip: 10 });
  // the purlins: poles along the roof, their ends sticking out of the gables under the overhang (and the ridge pole)
  for (const [ss, r] of [[len * 0.45, 0.085], ...(o.ridgePole ? [[len - 0.02, 0.1]] : [])]) {
    for (const sx of [1, -1]) {
      if (sx < 0 && ss > len - 0.1) continue;   // the ridge pole's west end is inside the chimney
      const L = GX + 0.2, xc = sx * (W / 2 + GX - 0.03 - L / 2);
      k.prism('wood', ngon(7, r, 0.15, k.R), L, null, null, { m: frame(xc, ss, -0.024 - r, mul(RX(-pitch), RZ(-sx * Math.PI / 2))), warp: warpName, tint: POLE.map((c) => c * 0.8), smooth: true, skip: '-y' });
    }
  }
}

function roofs(k) {
  // shakes whose middles are well inside the chimney stack are left out; the ones round its edge run on into the stones
  // (hidden there), so no gap opens beside it
  const hole = (x, z) => x > CH.sx0 + 0.06 && x < CH.sx1 - 0.06 && Math.abs(z) < CH.sz - 0.06;
  const x0 = -W / 2 - GX, x1 = W / 2 + GX;
  const lenF = (D / 2 + OV_F) / Math.cos(PITCH), lenB = (D / 2 + OV_B) / Math.cos(PITCH);
  roofSlope(k, T(0, 0.02, 0), { x0, x1, topY: RIDGE, len: lenF, pitch: PITCH, warpName: 'main', hole, eaveS: OV_F / Math.cos(PITCH), main: true, ridgePole: true });
  roofSlope(k, mul(T(0, 0.02, 0), RY(Math.PI)), { x0, x1, topY: RIDGE, len: lenB, pitch: PITCH, warpName: 'main', hole, eaveS: OV_B / Math.cos(PITCH), main: true });
  // the porch's lean-to, from the wall under the main eave down past the posts
  const lenP = (PD + 0.32) / Math.cos(P_PITCH);
  roofSlope(k, T(0, 0, D / 2 + 0.02), { x0: -W / 2 - 0.2, x1: W / 2 + 0.2, topY: P_TOP, len: lenP, pitch: P_PITCH, warpName: 'porch', eaveS: lenP, ceiling: true });
}

// ── the porch ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function porch(k) {
  const z0 = D / 2 + 0.005, z1 = D / 2 + PD, xs = [-W / 2 + 0.06, -1.35, 0.45, W / 2 - 0.06];
  // where the porch roof's rafters are over the posts, so the beam fits under them
  const rTop = P_TOP - (POST_Z - D / 2 - 0.02) * Math.tan(P_PITCH) - (0.024 + 0.11) / Math.cos(P_PITCH);
  const beamY = rTop - 0.1;   // the beam's middle (its top under the rafters); the posts run up into it
  // the deck: boards running out from the wall, each its own width, gaps between, a few a little cupped or proud
  for (let x = -W / 2 - 0.12; x < W / 2 + 0.1;) {
    const bw = Math.min(k.r(0.17, 0.28), W / 2 + 0.12 - x), gap = k.r(0.006, 0.022); if (bw < 0.06) break;
    const zEnd = z1 + k.r(-0.03, 0.05), y = DECK - 0.02 + k.r(-0.008, 0.005), tint = DECKW.map((c) => c * k.r(0.85, 1.1));
    const pieces = k.R() < 0.18 ? (() => { const j = k.r(z0 + 0.5, zEnd - 0.5); return [[z0, j], [j, zEnd]]; })() : [[z0, zEnd]];
    for (const [a, b] of pieces) k.board([bw - gap, 0.04, b - a - 0.004], [x + (bw - gap) / 2, y + k.r(-0.004, 0.004), (a + b) / 2], [k.r(-0.004, 0.004), k.r(-0.006, 0.006), k.r(-0.02, 0.02)], { long: 2, tint, skip: '-y', strip: [1, 3, 5, 9][Math.floor(k.R() * 4)] });
    x += bw;
  }
  // the rim timbers the deck sits on, and the dark under it
  k.board([W + 0.34, 0.22, 0.09], [0, DECK - 0.15, z1 - 0.05], [0, k.r(-0.004, 0.004), k.r(-0.004, 0.004)], { long: 0, tint: DARKW, strip: 10 });
  for (const sx of [-1, 1]) k.board([0.09, 0.22, PD - 0.06], [sx * (W / 2 + 0.12), DECK - 0.15, D / 2 + PD / 2 - 0.03], null, { long: 2, tint: DARKW, strip: 11 });
  k.box('wood', [W + 0.1, DECK - 0.16, PD - 0.2], [0, (DECK - 0.16) / 2, D / 2 + (PD - 0.2) / 2], null, { tint: [0.3, 0.27, 0.25], skip: '-y', long: 0 });
  k.solid([W + 0.3, DECK - 0.02, PD], [0, (DECK - 0.02) / 2, D / 2 + PD / 2]);
  // stone piers under the posts: two rough stones each
  for (const x of xs) pier(k, x, POST_Z, DECK - 0.26);
  // posts: peeled poles, a little out of plumb; the beam on them in three lengths, joined over the posts
  for (const x of xs) {
    const r = k.r(0.085, 0.1), hgt = beamY - DECK;
    // leaning sideways along the beam (a lean toward the yard would push its top out from under the beam); spun on its
    // own axis so the seven sides don't all line up
    const lean = (k.R() < 0.5 ? -1 : 1) * k.r(0.012, 0.035), m = mul(T(x, DECK + hgt / 2, POST_Z), RZ(lean), RX(k.r(-0.01, 0.01)), RY(k.r(0, 6)));
    k.prism('wood', ngon(7, r, 0.12, k.R), hgt, null, null, { m, tint: POLE.map((c) => c * k.r(0.9, 1.08)), smooth: true, skip: '+y-y', warp: 'porch', strip: 3 });
  }
  const bx = [-W / 2 - 0.18, xs[1] + 0.08, xs[2] - 0.06, W / 2 + 0.18];
  for (let i = 0; i < 3; i++) k.board([bx[i + 1] - bx[i] - 0.006, 0.2, 0.22], [(bx[i] + bx[i + 1]) / 2, beamY, POST_Z], [k.r(-0.01, 0.01), k.r(-0.008, 0.008), k.r(-0.006, 0.006)], { long: 0, tint: LOG, strip: 10, warp: 'porch' });
  k.solid([W + 0.3, 0.2, 0.22], [0, beamY, POST_Z]);
  // the ledger along the wall that the rafters hang from, and the rafters: poles from the wall out past the beam
  k.board([W + 0.3, 0.16, 0.1], [0, P_TOP - 0.13, D / 2 + 0.05], null, { long: 0, tint: LOG, strip: 11 });
  const lenP = (PD + 0.32) / Math.cos(P_PITCH);
  for (let x = -W / 2 - 0.08; x < W / 2 + 0.12; x += (W + 0.16) / 7) {
    // from inside the ledger (its end hidden there) out to the eave
    const r = k.r(0.05, 0.06), L = lenP - 0.05;
    const m = mul(T(x + k.r(-0.03, 0.03), 0, D / 2 + 0.02), T(0, P_TOP, 0), RX(P_PITCH), T(0, -0.024 - r, 0.02 + L / 2), RX(Math.PI / 2));
    k.prism('wood', ngon(6, r, 0.15, k.R), L, null, null, { m, warp: 'porch', tint: POLE.map((c) => c * 0.86), smooth: true, skip: '-y' });
  }
  // the rails: a pole from post to post at hand height, and a couple of uprights; across the step opening, none
  const rail = (ax, az, bx2, bz) => {
    const L = Math.hypot(bx2 - ax, bz - az) + 0.1, y = DECK + 0.86 + k.r(-0.03, 0.03);
    const ang = Math.atan2(bz - az, bx2 - ax);
    k.prism('wood', ngon(6, 0.045, 0.15, k.R), L, null, null, { m: mul(T((ax + bx2) / 2, y, (az + bz) / 2), RY(-ang), RZ(-Math.PI / 2 + k.r(-0.02, 0.02))), tint: POLE.map((c) => c * k.r(0.88, 1.05)), smooth: true, skip: '+y-y' });
    for (const f of [0.36, 0.68]) {
      const px = ax + (bx2 - ax) * (f + k.r(-0.06, 0.06)), pz = az + (bz - az) * f, ph = y - DECK;
      k.prism('wood', ngon(6, 0.035, 0.2, k.R), ph, [px, DECK + ph / 2, pz], [k.r(-0.04, 0.04), 0, k.r(-0.05, 0.05)], { tint: POLE.map((c) => c * k.r(0.85, 1.0)), smooth: true, skip: '+y-y' });
    }
  };
  rail(xs[0], POST_Z, xs[1], POST_Z); rail(xs[2], POST_Z, xs[3], POST_Z);
  rail(xs[0], D / 2 + 0.05, xs[0], POST_Z); rail(xs[3], D / 2 + 0.05, xs[3], POST_Z);
  // the step: a hewn block and a flat stone below it
  const sx = (xs[1] + xs[2]) / 2;
  k.board([1.1, 0.31, 0.34], [sx, 0.155, z1 + 0.19], [0, k.r(-0.04, 0.04), 0], { long: 0, tint: LOG, strip: 10, skip: '-y' });
  k.box('stone', [1.05, 0.14, 0.5], [sx + 0.05, 0.05, z1 + 0.6], [k.r(-0.03, 0.03), 0.06, k.r(-0.02, 0.02)], { tint: [0.92, 0.9, 0.86], skip: '-y' });
  // a bench under the window: a plank on two log stumps
  for (const dx of [-0.5, 0.5]) k.prism('wood', ngon(6, 0.11, 0.15, k.R), 0.4, [1.62 + dx, DECK + 0.2, D / 2 + 0.24], [0, k.r(0, 3), 0], { tint: LOG, smooth: true, skip: '-y' });
  k.board([1.4, 0.05, 0.3], [1.62, DECK + 0.425, D / 2 + 0.24], [0, k.r(-0.04, 0.04), 0], { long: 0, tint: DECKW });
}

function pier(k, x, z, top) {
  const t = [k.r(0.8, 1.05), k.r(0.78, 1.0), k.r(0.74, 0.95)];
  k.box('stone', [k.r(0.42, 0.5), top * 0.52, k.r(0.4, 0.48)], [x, top * 0.24, z], [k.r(-0.04, 0.04), k.r(-0.3, 0.3), k.r(-0.04, 0.04)], { tint: t, skip: '-y' });
  k.box('stone', [k.r(0.32, 0.38), top * 0.48, k.r(0.3, 0.36)], [x + k.r(-0.03, 0.03), top * 0.74, z + k.r(-0.03, 0.03)], [k.r(-0.04, 0.04), k.r(-0.4, 0.4), k.r(-0.04, 0.04)], { tint: t.map((c) => c * k.r(0.9, 1.1)), skip: '-y' });
}

function footing(k) {
  // piers under the corners and the middle of the eave walls; the crawl space between them in deep shadow
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) pier(k, sx * (W / 2 - 0.12), sz * (D / 2 - 0.12), PIER - 0.01);
  k.box('stone', [W - 0.5, PIER - 0.04, D - 0.5], [0, (PIER - 0.04) / 2, 0], null, { tint: [0.42, 0.4, 0.38], skip: '-y' });
  k.solid([W - 0.3, PIER, D - 0.3], [0, PIER / 2, 0]);
}

// ── the chimney: fieldstone ───────────────────────────────────────────────────────────────────────────────────────────
// a mortar core, and round it, course by course, rough stones of every size: big corner stones that show on two faces,
// stones between them, each a little skew, proud or sunk. The faces against the wall aren't clad (no one sees them)
// until the stack is clear of the roof. Faces of a stone that point into the core are left out.
function chimney(k) {
  const pal = [[1.15, 1.1, 1.02], [0.95, 0.92, 0.88], [1.22, 1.06, 0.88], [1.05, 0.97, 0.88], [1.3, 1.2, 1.06], [0.82, 0.78, 0.74]];
  // each stone its own height inside the course, pushed in or out, and turned in the face (the joints wander): fieldstone,
  // not cut blocks. `face` is the axis the stone's face looks along ('x' or 'z'; a corner stone has two)
  const stone = (size, x, y, z, skip, face) => {
    const sh = k.r(0, 0.08), tw = k.r(-0.2, 0.2);
    const rot = face === 'x' ? [tw, k.r(-0.08, 0.08), k.r(-0.05, 0.05)] : face === 'z' ? [k.r(-0.05, 0.05), k.r(-0.08, 0.08), tw] : [k.r(-0.06, 0.06), k.r(-0.15, 0.15), k.r(-0.06, 0.06)];
    k.box('stone', [size[0], size[1] - sh, size[2]], [x + k.r(-0.03, 0.03), y + k.r(-0.5, 0.5) * sh, z + k.r(-0.03, 0.03)], rot, { tint: pal[Math.floor(k.R() * pal.length)].map((c) => c * k.r(0.82, 1.12)), skip: skip + '-y' });
  };
  // stones along one face: from a to b along `along` ('x' or 'z'), the face at `at`, sticking in by a depth
  const run = (along, a, b, at, outSign, y, h) => {
    for (let p = a; p < b - 0.06;) {
      const L = Math.min(k.r(0.24, 0.56), b - p), dpt = k.r(0.18, 0.26), mid = p + L / 2, c = at - outSign * dpt / 2, j = k.r(0.025, 0.05);
      if (along === 'z') stone([dpt, h - j, L - j], c, y, mid, outSign > 0 ? '-x' : '+x', 'x');
      else stone([L - j, h - j, dpt], mid, y, c, outSign > 0 ? '-z' : '+z', 'z');
      p += L;
    }
  };
  let y = 0, c = 0;
  while (y < CH.top - 0.06) {
    const h = k.r(0.26, 0.4), stack = y > CH.sh + 0.2, shoulder = !stack && y > CH.sh;
    const x0 = stack ? CH.sx0 : shoulder ? (CH.x0 + CH.sx0) / 2 : CH.x0, x1 = stack ? CH.sx1 : CH.x1;
    const z1 = stack ? CH.sz : shoulder ? (CH.z1 + CH.sz) / 2 : CH.z1, z0 = -z1, yc = y + h / 2;
    const backFace = y > RIDGE - 0.5;     // the stack's face toward the cabin, once it clears the roof
    // corner stones (west-north, west-south, and the two on the cabin side once it shows), longer one way or the other
    // course by course, so the corners are bonded
    const cx = c % 2 ? k.r(0.32, 0.42) : k.r(0.22, 0.3), cz = c % 2 ? k.r(0.22, 0.3) : k.r(0.32, 0.42);
    const corners = [[x0, z0, 1, 1], [x0, z1, 1, -1]];
    if (backFace) corners.push([x1, z0, -1, 1], [x1, z1, -1, -1]);
    for (const [px, pz, ix, iz] of corners) stone([cx - 0.02, h - 0.025, cz - 0.02], px + ix * cx / 2, yc, pz + iz * cz / 2, (ix > 0 ? '+x' : '-x') + (iz > 0 ? '+z' : '-z'));
    run('z', z0 + cz, z1 - cz, x0, -1, yc, h);                                 // the outside (west) face
    run('x', x0 + cx, backFace ? x1 - cx : x1, z0, -1, yc, h);                 // north face
    run('x', x0 + cx, backFace ? x1 - cx : x1, z1, 1, yc, h);                  // south face
    if (backFace) run('z', z0 + cz, z1 - cz, x1, 1, yc, h);
    y += h; c++;
  }
  // the mortar core, set back behind the stones' faces, showing in the joints
  const mortar = [1.45, 1.36, 1.2];
  k.box('stone', [CH.x1 - CH.x0 - 0.08, CH.sh + 0.2, 2 * CH.z1 - 0.12], [(CH.x0 + CH.x1) / 2 + 0.04, (CH.sh + 0.2) / 2, 0], null, { tint: mortar, skip: '-y+x' });
  k.box('stone', [CH.sx1 - CH.sx0 - 0.12, y - CH.sh, 2 * CH.sz - 0.12], [(CH.sx0 + CH.sx1) / 2, (y + CH.sh) / 2, 0], null, { tint: mortar, skip: '-y' });
  // a flat cap stone and the flue's dark mouth
  k.box('stone', [CH.sx1 - CH.sx0 + 0.06, 0.08, 2 * CH.sz + 0.06], [(CH.sx0 + CH.sx1) / 2, y + 0.03, 0], [0, 0.04, k.r(-0.02, 0.02)], { tint: [0.95, 0.93, 0.9] });
  k.box('iron', [0.3, 0.02, 0.32], [(CH.sx0 + CH.sx1) / 2, y + 0.075, 0], [0, 0.04, 0]);
  k.solid([CH.x1 - CH.x0, CH.sh, 2 * CH.z1], [(CH.x0 + CH.x1) / 2, CH.sh / 2, 0]);
  k.solid([CH.sx1 - CH.sx0 - 0.04, y - CH.sh, 2 * CH.sz - 0.04], [(CH.sx0 + CH.sx1) / 2, (y + CH.sh) / 2, 0]);
}

// ── odds and ends: a barrel by the porch, a stack of split firewood and a chopping block by the east wall ─────────────
function extras(k) {
  const bx = W / 2 + 0.55, bz = D / 2 + PD - 0.35;
  k.prism('wood', ngon(12, 0.3), 0.86, [bx, 0.43, bz], [0, k.r(0, 1), 0], { tint: LOG.map((c) => c * 1.1), smooth: true, skip: '-y', strip: 3 });
  for (const y of [0.16, 0.7]) k.prism('iron', ngon(12, 0.312), 0.05, [bx, y, bz], null, { smooth: true, skip: '+y-y' });
  k.solid([0.6, 0.86, 0.6], [bx, 0.43, bz]);
  // firewood: split billets (three-sided), stacked in rows, their ends out
  const fx = W / 2 + 0.36;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5 - (row > 1 ? 1 : 0); i++) {
    const z = -D / 2 + 0.4 + i * 0.21 + (row % 2) * 0.1, y = 0.09 + row * 0.15;
    const r = k.r(0.08, 0.11), tri = [[r, 0], [-r * 0.6, r * k.r(0.75, 0.95)], [-r * 0.6, -r * k.r(0.75, 0.95)]];
    k.prism('wood', tri, k.r(0.4, 0.48), null, null, { m: mul(T(fx + k.r(-0.03, 0.03), y, z), RZ(-Math.PI / 2), RY(k.r(0, 6.28))), tint: SPLIT.map((c) => c * k.r(0.8, 1.05)), strip: 2, fresh: true });
  }
  k.solid([0.48, 0.45, 1.1], [fx, 0.22, -D / 2 + 0.9]);
  k.prism('wood', ngon(8, 0.21, 0.1, k.R), 0.46, [W / 2 + 1.25, 0.23, -1.0], [0, k.r(0, 3), 0], { tint: LOG, smooth: true, skip: '-y' });
}

// ── contact shadows: the close-range half of the bake ─────────────────────────────────────────────────────────────────
// From each corner, a dozen short rays (35 cm) go out over the half of the sky its face looks at, and each is tested
// against the real boxes nearby (the ray turned into the box's own frame, where the box is just -half..+half on each
// side). Nearer hits darken more. A corner buried inside another part counts as fully shut in. Boxes are filed in a
// coarse grid (60 cm cells) so each corner only tests the few dozen boxes round it.
class Contact {
  constructor(parts, reach = 0.35, cell = 0.6) {
    const n = parts.length, inv = new THREE.Matrix4();
    this.L = reach; this.cell = cell;
    this.E = new Float32Array(n * 12); this.H = new Float32Array(n * 3); this.S = new Float32Array(n * 4);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], ext = [];
    for (let i = 0; i < n; i++) {
      const { size, m, o } = parts[i], e = inv.copy(m).invert().elements, me = m.elements;
      this.E.set([e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10], e[12], e[13], e[14]], i * 12);
      // a round post is smaller than its box; and every box a centimetre smaller, so parts that only touch (two shakes
      // side by side, a little skew) don't count as burying each other's corners
      const h = size.map((s, a) => { const x = s / 2 * (o.poly && a !== 1 ? 0.82 : 1); return x - Math.min(0.01, 0.25 * x); });
      this.H.set(h, i * 3);
      this.S.set([me[12], me[13], me[14], Math.hypot(...h)], i * 4);
      const ex = [0, 1, 2].map((a) => Math.abs(me[a]) * h[0] + Math.abs(me[4 + a]) * h[1] + Math.abs(me[8 + a]) * h[2] + reach);
      ext.push(ex);
      for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], me[12 + a] - ex[a]); hi[a] = Math.max(hi[a], me[12 + a] + ex[a]); }
    }
    this.lo = lo; this.dim = [0, 1, 2].map((a) => Math.max(1, Math.ceil((hi[a] - lo[a]) / cell)));
    this.cells = new Map();
    for (let i = 0; i < n; i++) {
      const me = parts[i].m.elements, r = [0, 1, 2].map((a) => [Math.floor((me[12 + a] - ext[i][a] - lo[a]) / cell), Math.floor((me[12 + a] + ext[i][a] - lo[a]) / cell)]);
      for (let z = r[2][0]; z <= r[2][1]; z++) for (let y = r[1][0]; y <= r[1][1]; y++) for (let x = r[0][0]; x <= r[0][1]; x++) {
        const key = (z * this.dim[1] + y) * this.dim[0] + x;
        let list = this.cells.get(key); if (!list) this.cells.set(key, (list = [])); list.push(i);
      }
    }
    this.dirs = []; const N = 12;
    for (let i = 0; i < N; i++) { const t = (i + 0.5) / N, r = Math.sqrt(t), a = i * 2.39996; this.dirs.push([r * Math.cos(a), Math.sqrt(1 - t), r * Math.sin(a)]); }
    this.cand = new Int32Array(4096);
  }
  at(px, py, pz, nx, ny, nz, self, spin) {
    const c = this.cell, ix = Math.floor((px - this.lo[0]) / c), iy = Math.floor((py - this.lo[1]) / c), iz = Math.floor((pz - this.lo[2]) / c);
    const list = this.cells.get((iz * this.dim[1] + iy) * this.dim[0] + ix); if (!list) return 1;
    const S = this.S, E = this.E, H = this.H, L = this.L, cand = this.cand;
    let nc = 0;
    for (const i of list) {
      if (i === self) continue;
      const dx = S[i * 4] - px, dy = S[i * 4 + 1] - py, dz = S[i * 4 + 2] - pz, r = S[i * 4 + 3] + L;
      if (dx * dx + dy * dy + dz * dz < r * r && nc < cand.length) cand[nc++] = i;
    }
    if (!nc) return 1;
    // a frame round the normal, turned by `spin` so neighbouring corners don't all use the same few directions
    let tx, ty, tz; if (Math.abs(ny) < 0.9) { tx = nz; ty = 0; tz = -nx; } else { tx = 1; ty = 0; tz = 0; }
    const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
    let bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    [tx, ty, tz, bx, by, bz] = [tx * cs + bx * sn, ty * cs + by * sn, tz * cs + bz * sn, bx * cs - tx * sn, by * cs - ty * sn, bz * cs - tz * sn];
    const ox = px + nx * 0.004, oy = py + ny * 0.004, oz = pz + nz * 0.004;
    let blocked = 0;
    for (const [a, b, d] of this.dirs) {
      const wx = tx * a + nx * b + bx * d, wy = ty * a + ny * b + by * d, wz = tz * a + nz * b + bz * d;
      let best = L;
      for (let q = 0; q < nc; q++) {
        const i = cand[q], e = i * 12, h = i * 3;
        let t0 = 0, t1 = best, miss = false;
        for (let ax = 0; ax < 3 && !miss; ax++) {
          const o = E[e + ax] * ox + E[e + 3 + ax] * oy + E[e + 6 + ax] * oz + E[e + 9 + ax];
          const dd = E[e + ax] * wx + E[e + 3 + ax] * wy + E[e + 6 + ax] * wz, hh = H[h + ax];
          if (Math.abs(dd) < 1e-9) { if (o < -hh || o > hh) miss = true; continue; }
          let ta = (-hh - o) / dd, tb = (hh - o) / dd; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
          if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) miss = true;
        }
        if (!miss) best = t0;
      }
      if (best < L) blocked += 1 - 0.5 * best / L;
    }
    return 1 - blocked / this.dirs.length;
  }
}

// ── build it all ──────────────────────────────────────────────────────────────────────────────────────────────────────
// the weathering this cabin starts with (main.js puts these on the sliders when it is chosen): all of it on, and turned
// up, so the moss, the streaks and the worn edges show from the first view; the baked shadow strong and in the sunlight
export const LOOK = {
  state: { moss: true, grime: true, wear: true, decals: false, mossAmt: 0.42, patch: 1.2, mossSharp: 0.55, grimeAmt: 0.9, streaks: 4.5, grimeSharp: 0.4, edgeAmt: 1, edgeCm: 2.8 },
  uniforms: { uMossUp: 0.6, uMossLow: 0.75, uMossShade: 1.0, uMossTuck: 0.9, uMossHeight: 1.1, uMossBreak: 0.85, uStreakLen: 2.2, uSplashH: 0.85, uCornerDirt: 0.9, uEdgeBreak: 0.75, uAOAmt: 1.3, uAOSun: 0.4, uGrimeColor: '#4a443b' },
};
// where the starting decals go on this cabin: [stamp, point, normal]
const SPOTS = [['sign', [W / 2, 4.05, 0], [1, 0, 0]], ['poster', [-2.2, 1.75, D / 2], [0, 0, 1]], ['horseshoe', [-0.5, 2.66, D / 2 + 0.08], [0, 0, 1]], ['stain', [W / 2, 1.05, -1.4], [1, 0, 0]]];

export function buildFrontier(seed = 23) {
  const t0 = performance.now(), k = new Kit(seed);
  footing(k); walls(k); gables(k); roofs(k); porch(k); chimney(k); extras(k);
  const R = rng(seed + 1), geos = {};
  for (const g in k.parts) geos[g] = buildGeometry(k.parts[g], g, R, { topAt, warp, tintAt: g === 'wood' ? weatherTint : g === 'stone' ? stoneTint : null });
  const t1 = performance.now();
  // the bake: the voxel pass (reaching 2.4 m) times the contact pass. The roof's sag bent the drawn corners; the boxes
  // the rays test against are moved down with it (by the sag at their middle), or the corners would be baked as if
  // sunk into the parts under them
  const sag = (O) => { if (!O.warp) return O.m; const c = new THREE.Vector3().setFromMatrixPosition(O.m), w = c.clone(); warp(w, O.warp); return mul(T(w.x - c.x, w.y - c.y, w.z - c.z), O.m); };
  const occ = new Occlusion(k.occ.map((O) => ({ size: O.size, m: sag(O) })), 1.6, 0.08, { reach: 2.4, rays: 24, groundReach: 0.7 });
  const all = [], first = {};
  for (const g in k.parts) { first[g] = all.length; all.push(...k.parts[g]); }
  const con = new Contact(all.map((P) => ({ size: P.size, o: P.o, m: sag({ m: P.m, warp: P.o.warp }) })));
  for (const g in geos) {
    const geo = geos[g], P = geo.attributes.position.array, N = geo.attributes.normal.array, A = geo.attributes.aAO.array, H = geo.attributes.aHalf.array, of = geo.userData.partOf;
    for (let i = 0; i < A.length; i++) {
      const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
      const part = first[g] + of[i], soft = Math.abs(N[i * 3 + 1]) < 0.7 ? all[part].o.contactSide ?? 1 : 1;
      // (a little light always gets in, bounced off the ground and the walls: the darkest spot keeps 18% of the sky)
      A[i] = 0.18 + 0.82 * occ.at(...p) * (1 - soft * (1 - con.at(...p, part, ((i * 2654435761) >>> 0) / 4294967296 * 6.283)));
      H[i * 4 + 3] = occ.rain(...p);
    }
    // a log's face has corners only along its top and bottom edges, so where the two differ (a crossing log's end in
    // front of one of them) the face shades in diagonal triangles. Each upright pair gets the same value: their average.
    const pairs = new Map();
    for (let i = 0; i < A.length; i++) {
      const part = first[g] + of[i];
      if (!all[part].o.pairAO || Math.abs(N[i * 3 + 1]) > 0.5) continue;
      const key = `${part},${Math.round(P[i * 3] * 20)},${Math.round(P[i * 3 + 2] * 20)},${Math.round(N[i * 3] * 4)},${Math.round(N[i * 3 + 2] * 4)}`;
      const e = pairs.get(key); if (e) e.push(i); else pairs.set(key, [i]);
    }
    for (const list of pairs.values()) { if (list.length < 2) continue; const m = list.reduce((t, i) => t + A[i], 0) / list.length; for (const i of list) A[i] = m; }
    geo.attributes.aAO.needsUpdate = true; geo.attributes.aHalf.needsUpdate = true;
  }
  const counts = {}; for (const g in k.parts) counts[g] = k.parts[g].length;
  return { geos, occ, counts, parts: all.length, msBuild: t1 - t0, msAO: performance.now() - t1, topAt, spots: SPOTS, dims: FRONTIER };
}
