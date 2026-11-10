// THE GROW POD: a small window in a ship's wall with green plants growing behind frosted glass, under a grow lamp.
// From the game's maker's words and his picture of two big ones in a ship's galley wall (2026-11-09): "it would be cool
// to put at least one of these plant growing pods in there. Maybe it could be a bit blurry like it has frosted glass
// over it, with green plants showing." "I imagine they would be smaller than those." "Maybe the plant chamber could be
// slowly spinning the plants."
// A WALL fitting (kit/shipparts/cabin/ship.js): x along the wall, centred; z = 0 on the wall line, its back on the wall's
// face (FACE), facing +z; y = 0 the deck. Nothing of it goes into the wall: the frame stands 3.4 cm out of the face and
// the glass sits 2 cm down inside the frame; the depth behind the glass is drawn by the glass itself (kit/growglass.js:
// the plants slide behind the frame as the eye moves, and the pod's side wall shows on the side looked from).
//   growPod(p, o)
//     o.size    the glass, metres across (0.36; 0.30 to 0.45 suits a ship's wall): an eight-sided one across its flats,
//               a round one its diameter. The frame adds 4.3 cm all round.
//     o.shape   'oct' (eight-sided: the ships' own shape) or 'round'
//     o.n       how many in a row (1), o.gap between their frames (0.04); a row stands on one shallow back plate
//               (o.plate false: none; o.back its surface: dark; o.backTrim: a thin line of another surface all round
//               it, none unless asked for. back: 'white', backTrim: 'black' is a plate in the wall's own panel colour
//               with a dark trim: lighter on a pale wall than the dark plate). o.plate true gives a single pod a plate
//               too (eight-sided): it covers a wall seam or a panel's edge under the pod
//     o.frost   how frosted: 'light', 'medium', 'heavy'
//     o.plant   'ring'   a rotary garden: five potted plants on a wheel's rim, growing in toward its middle
//               'climb'  climbers out of a planter, winding up in front of a honeycomb frame
//               'herbs'  herbs in two troughs, one above the other
//               'carousel'  REAL plants, not a picture (the game's maker, 2026-11-10: "I think it would be cool if the
//                        plants were 3d and it looked like the leaves had some depth"): five potted plants on a
//                        turntable with an upright axle, in a chamber behind a lightly frosted pane. The near ones
//                        cross the glass one way, the far ones cross back behind them, smaller and hazier; all upright;
//                        walking past, the near ones slide across the far ones. Its lamp is a bar across the top.
//               (a list gives each pod of a row its own)
//     o.lamp    where the grow lamp is: 'top' (a strip along the top) or 'rim' (a line of light round the rim; not for
//               a carousel). The plants are brightest by it and darker away from it (o.shade: how lit the furthest
//               are: 0.22 a ring, 0.3 climbers, 0.5 herbs, 0.2 a carousel); it never turns.
//     o.tint    the lamp's colour: 'pink' (pink-white) or 'warm' (warm white), or a number between (0 warm .. 1 pink);
//               o.lampGlow its own brightness (1)
//     o.move    true (the planting's own: a ring TURNS slowly, its plants hanging as they go round and brightening as
//               they pass the lamp; a carousel's turntable goes round; the others' leaves sway a little), 'turn',
//               'stir', or false (still). The glass, its grain and the frame never move; the movement is worked out on
//               the graphics card from the kit's one clock (materials.js U.time): nothing is done for it each frame.
//     o.turn    a turning pod's seconds for one turn (GROW.turn: 60); negative turns it the other way (a carousel's
//               near plants cross from left to right, its far ones from right to left; negative: the other way)
//     o.y       the height of its middle (1.33)
//     o.glow    this pod's own brightness (1), times GROW.glow (kit/growglass.js: THE number that sets how bright every
//               pod's glass is)
//     o.light   the light it throws on what is near it (0.2: a soft green-white, baked, reaching 1.3 m; 0: none)
//     o.pool    the same light as a small real-time pool on the wall round it (0.1, reaching 1.1 m; 0: none): a wall
//               panel has too few corners for the baked light to show on it. A row has ONE pool for all its pods (a
//               room shows only its strongest few pools)
//     o.clamps  how many clamps hold the frame (4, on the diagonals; 0: none)
//     o.trim    the frame's surface (black: the satin charcoal of the ships' ribs and rims), o.clamp the clamps' (the
//               mess's gunmetal: a named surface the cabin's looks would turn into the frame's own black)
//     o.seed    which painting of its planting (1): each different one is another picture on the pods' sheet (a
//               carousel: its plants grown another way: other greens, other leaves, turned another way on the table)
//     o.deep    how deep the pod looks, times the usual (1)
//   growPodSize(o)   [w, h, d]: the whole fitting's size on the wall (frames and back plate), and how far it stands out
// COST (counted in a built room). One pod: the eight-sided frame 48 triangles, a round one 144; each clamp 38; the glass
// 6 (round: 22); a back plate 22. So 206 an eight-sided pod, 318 a round one (54 and 166 with no clamps; 340 a round one
// on a plate), 640 a row of three eight-sided; a plate's trim 22 more. The frame, clamps and plate are the cabin's
// 'solid' material (no new draw). A picture pod's glass is the 'pod' material: every one in a room's batch is ONE draw,
// with one texture (512 x 512 for three kinds of pod). A CAROUSEL (real plants) is 1,542 triangles with its frame and
// clamps (its inside 1,336: chamber 10, axle 12, lamp 12, turntable 60, plants about 1,240): its inside is the 'podIn'
// material and its pane 'podPane', so all the carousels in a batch are TWO draws, no texture.
// THE MATERIALS must be in the kit's list: three lines in kit/materials.js (kit/growglass.js gives them).
import * as THREE from 'three';
import { shape, relief, solid, RINGS, add } from '../../bevel.js';
import { MAT_KEYS } from '../../materials.js';
import { GROW, FROST, INSIDE, podCell } from '../../growglass.js';
import { FACE } from './ship.js';
import { GUN, pool, strip } from './mess.js';

const PI = Math.PI, TAU = PI * 2, OCT = 1 - Math.SQRT1_2;   // (OCT: a regular octagon's corner cut, as a share of its width)
// the frame's section, from the wall in to the glass: the outer bevel's width, the flat top's, the inner slope's; how
// far the top stands out of the wall; the level the inner slope comes down to (where the glass is)
// (a ship wall's panels stand up to 1 cm out of its face in places: the glass is kept in front of them)
const RIM = { out: 0.007, top: 0.02, in: 0.016, proud: 0.034, glass: 0.0145 }, BAND = RIM.out + RIM.top + RIM.in;
const RINGS_RIM = [{ inset: 0, depth: RIM.proud, bevel: RIM.out }, { inset: RIM.top, depth: RIM.glass, bevel: RIM.in }];
// a back plate: how far it stands out (clear of the wall's own raised panels, which would show through a thinner one),
// how far it shows round the frames
const PLATE = 0.013, PLATE_EDGE = 0.035, PLATE_TRIM = 0.008;   // (PLATE_TRIM: how wide a trim shows round a plate)
const SHADE = { ring: 0.22, climb: 0.3, herbs: 0.5, carousel: 0.2 };   // how lit the plants furthest from the lamp are, by planting
const SEG = 24;                             // a round pod's sides
const LIGHT = [0.72, 1.0, 0.74];            // the light a pod throws (not so green or so white that a cabin's look re-tones it)
const rand = (seed) => { let a = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// a round frame: the eight-sided one's section turned round a circle of radius r (smooth round, a crisp edge between
// its three bands), on z = 0 facing +z
function roundFrame(r) {
  const prof = [[r + BAND, 0], [r + BAND - RIM.out, RIM.proud], [r + RIM.in, RIM.proud], [r, RIM.glass]], pos = [], nor = [], uv = [], ix = [];
  for (let b = 0; b < prof.length - 1; b++) {
    const [r0, z0] = prof[b], [r1, z1] = prof[b + 1], l = Math.hypot(r1 - r0, z1 - z0), nr = (z1 - z0) / l, nz = (r0 - r1) / l, base = pos.length / 3;
    for (let i = 0; i < SEG; i++) {
      const a = i / SEG * TAU, c = Math.cos(a), s = Math.sin(a);
      pos.push(r0 * c, r0 * s, z0, r1 * c, r1 * s, z1); nor.push(nr * c, nr * s, nz, nr * c, nr * s, nz); uv.push(r0 * c, r0 * s, r1 * c, r1 * s);
    }
    for (let i = 0; i < SEG; i++) { const a0 = base + i * 2, a1 = base + ((i + 1) % SEG) * 2; ix.push(a0, a1, a1 + 1, a0, a1 + 1, a0 + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); return g;
}
// the glass: a flat eight-sided or round plate on z = 0 facing +z, `over` bigger all round than its opening (it tucks
// under the frame's lip); its uv the place on the glass (-1 .. 1 across the opening of half-size hs)
function glassPlate(round, hs, over) {
  const pts = [], r = hs + over;
  if (round) for (let i = 0; i < SEG; i++) { const a = i / SEG * TAU; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  else { const t = r * Math.tan(PI / 8); pts.push([-t, -r], [t, -r], [r, -t], [r, t], [t, r], [-t, r], [-r, t], [-r, -t]); }
  const pos = [], nor = [], uv = [], ix = [];
  for (const [x, y] of pts) { pos.push(x, y, 0); nor.push(0, 0, 1); uv.push(x / hs, y / hs); }
  for (let i = 1; i < pts.length - 1; i++) ix.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); return g;
}
const fill = (g, name, val) => { const n = g.attributes.position.count, a = new Float32Array(n * 4); for (let i = 0; i < n; i++) a.set(val, i * 4); g.setAttribute(name, new THREE.BufferAttribute(a, 4)); };

// ── a carousel's inside: REAL plants on a turntable (kit/growglass.js podInside draws it; INSIDE: its sizes) ─────────
// In the pod's own frame: x right, y up, z out of the glass, the glass's middle 0. Five plants in clay pots, no two
// alike (a tall leafy stem, a broad-leaved head, a tuft of thin blades, a two-stemmed vine with red fruit, a low round
// bush), each leaf a folded, drooping blade of 12 triangles in one of several greens; about 200 to 330 triangles a plant.
const lin = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
const GREENS = ['#3f7a2a', '#4d8c34', '#5f9e3c', '#6aa84a', '#2f6b2e', '#7ab650', '#3a6e3a', '#86b95a'].map(lin);
const RIB = lin('#d2e6a0'), STEM = lin('#5d7f35');
function insideOf(hs, R) {
  // (u: the unit the sizes are in: the glass's half-size for the chamber, a little more for the plants)
  const I = INSIDE, P = [], L = [], C = [], ix = [];
  let u = hs;
  // (a corner: placed by T, marked with what it is: 0 still, 1 turning, 2 the lamp)
  let T = (q) => q, kind = 0;
  const v = (q, col, leafy = 0) => { const w = T(q); P.push(w[0], w[1], w[2]); L.push(w[0], w[1], w[2], kind); C.push(col[0], col[1], col[2], leafy); return P.length / 3 - 1; };
  const tri = (a, b, c) => ix.push(a, b, c), quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const box = (x0, x1, y0, y1, z0, z1, col) => { const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].map((q) => v(q, col)); for (const [a, b, cc, d] of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) quad(c[a], c[b], c[cc], c[d]); };
  const prism = (pts, r, col, sides = 3) => { let prev = null; for (const q of pts) { const ring = []; for (let k = 0; k < sides; k++) ring.push(v([q[0] + r * Math.cos(k * TAU / sides), q[1], q[2] + r * Math.sin(k * TAU / sides)], col)); if (prev) for (let k = 0; k < sides; k++) quad(prev[k], prev[(k + 1) % sides], ring[(k + 1) % sides], ring[k]); prev = ring; } };
  const green = (lift = 0) => { const g = GREENS[Math.floor(R() * GREENS.length)], k = 0.85 + 0.3 * R() + lift; return g.map((c) => Math.min(1, c * k)); };
  // a leaf from its stem end b, pointing along yaw, `pitch` above level, len x wid, its tip drooping, folded along its rib
  const leaf = (b, yaw, pitch, len, wid, droop, col, fold = 0.25) => {
    const dx = Math.sin(yaw), dz = Math.cos(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), rib = col.map((c, i) => c + (RIB[i] - c) * 0.18);
    const mid = (t) => [b[0] + dx * len * t * cp, b[1] + len * t * sp - droop * len * t * t, b[2] + dz * len * t * cp];
    const M = [0, 0.25, 0.5, 0.75, 1].map((t) => v(mid(t), rib, 1));
    const side = (sg) => [0.25, 0.5, 0.75].map((t, k) => { const m = mid(t), w = wid * [0.8, 1.0, 0.68][k] * 0.5; return v([m[0] + dz * w * sg, m[1] - fold * w, m[2] - dx * w * sg], col, 1); });
    for (const S of [side(1), side(-1)]) { tri(M[0], S[0], M[1]); tri(M[1], S[0], S[1]); tri(M[1], S[1], M[2]); tri(M[2], S[1], S[2]); tri(M[2], S[2], M[3]); tri(M[3], S[2], M[4]); }
  };
  const fruit = (c, r, col) => { const q = [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]].map((d) => v([c[0] + d[0], c[1] + d[1], c[2] + d[2]], col)); for (const [a, b] of [[0, 4], [4, 1], [1, 5], [5, 0]]) { tri(q[a], q[b], q[2]); tri(q[b], q[a], q[3]); } };
  // a clay pot standing on y = 0, soil in its mouth: gives the soil's height
  const pot = () => {
    const rb = 0.1 * u, rt = 0.135 * u, h = 0.19 * u, clay = lin('#7f5a40'), clay2 = lin('#9c7553'), soil = lin('#2b1e14'), a = [], b = [], s = [];
    for (let k = 0; k < 8; k++) { const t = k / 8 * TAU, c = Math.cos(t), sn = Math.sin(t); a.push(v([rb * c, 0, rb * sn], clay)); b.push(v([rt * c, h, rt * sn], clay2)); s.push(v([rt * 0.92 * c, h * 0.9, rt * 0.92 * sn], soil)); }
    for (let k = 0; k < 8; k++) quad(a[k], a[(k + 1) % 8], b[(k + 1) % 8], b[k]);
    const m = v([0, h * 0.9, 0], soil); for (let k = 0; k < 8; k++) tri(m, s[k], s[(k + 1) % 8]);
    return h * 0.9;
  };
  const PLANT = [
    // a tall leafy stem, its leaves turning round it up its length, a small tuft at the top
    () => { const s0 = pot(), lean = (R() - 0.5) * 0.15, H = 0.95 * u, at = (y) => [lean * (y - s0), y, 0];
      prism([0, 0.25, 0.5, 0.75, 1].map((t) => at(s0 + t * (H - s0))), 0.012 * u, STEM);
      let yaw = R() * TAU; for (let k = 0; k < 10; k++) { const t = k / 9, l = (0.32 - 0.14 * t) * u; yaw += 2.4; leaf(at(s0 + 0.08 * u + t * (H - s0 - 0.1 * u)), yaw, 0.35 + 0.4 * t, l, l * 0.45, 0.3, green()); }
      for (let k = 0; k < 3; k++) leaf(at(H), yaw + k * 2.1, 1.1, 0.12 * u, 0.06 * u, 0.1, green(0.15)); },
    // a broad-leaved head: the outer leaves low and long, the young middle ones upright and paler
    () => { const s0 = pot(); let yaw = R() * TAU;
      for (let k = 0; k < 14; k++) { const t = k / 13, l = (0.46 - 0.16 * t) * u; yaw += 2.4; leaf([0, s0, 0], yaw, 0.45 + 0.7 * t, l, l * 0.62, 0.45 * (1 - t) + 0.1, green(0.12 * t), 0.35); } },
    // a tuft of thin blades, arching
    () => { const s0 = pot(); for (let k = 0; k < 16; k++) { const yaw = R() * TAU, r = 0.05 * u * R(); leaf([r * Math.sin(yaw), s0, r * Math.cos(yaw)], yaw, 1.2 + 0.28 * R(), (0.55 + 0.3 * R()) * u, 0.05 * u, 0.25 + 0.2 * R(), green(), 0.1); } },
    // a vine of two stems leaning apart, red fruit hanging under every other leaf
    () => { const s0 = pot(), red = lin('#c8371f');
      for (const sg of [-1, 1]) {
        const H = (0.7 + 0.1 * R()) * u, at = (y) => [sg * 0.22 * (y - s0) + 0.02 * u * Math.sin(y / u * 9), y, 0];
        prism([0, 0.25, 0.5, 0.75, 1].map((t) => at(s0 + t * (H - s0))), 0.01 * u, STEM);
        let yaw = R() * TAU;
        for (let k = 0; k < 7; k++) {
          const t = k / 6, l = (0.24 - 0.09 * t) * u, p0 = at(s0 + 0.08 * u + t * (H - s0 - 0.08 * u)); yaw += 2.4;
          leaf(p0, yaw, 0.3 + 0.3 * t, l, l * 0.55, 0.25, green());
          if (k % 2) fruit([p0[0] - Math.sin(yaw) * 0.04 * u, p0[1] - 0.035 * u, p0[2] - Math.cos(yaw) * 0.04 * u], (0.045 + 0.012 * R()) * u, red);
        }
      } },
    // a low round bush of small leaves
    () => { const s0 = pot(), c = [0, s0 + 0.16 * u, 0]; prism([[0, s0, 0], c], 0.014 * u, STEM);
      for (let k = 0; k < 26; k++) { const yaw = R() * TAU, el = Math.acos(1 - 1.15 * R()), r0 = 0.12 * u, l = (0.13 + 0.06 * R()) * u; leaf([c[0] + Math.sin(el) * Math.sin(yaw) * r0, c[1] + Math.cos(el) * r0 * 0.8, c[2] + Math.sin(el) * Math.cos(yaw) * r0], yaw, PI / 2 - el, l, l * 0.75, 0.15, green(0.08)); } },
  ];
  // the chamber (back, sides, floor, ceiling), its axle and the lamp bar: still
  u = hs;
  const X = I.wide * u, Y0 = I.floor * u, Y1 = I.top * u, Z0 = -I.back * u, Z1 = -0.002, wall = lin('#1e2823'), wall2 = lin('#151c19');
  quad(v([-X, Y0, Z0], wall2), v([X, Y0, Z0], wall2), v([X, Y1, Z0], wall), v([-X, Y1, Z0], wall));
  quad(v([-X, Y0, Z1], wall2), v([-X, Y0, Z0], wall2), v([-X, Y1, Z0], wall), v([-X, Y1, Z1], wall));
  quad(v([X, Y0, Z0], wall2), v([X, Y0, Z1], wall2), v([X, Y1, Z1], wall), v([X, Y1, Z0], wall));
  quad(v([-X, Y0, Z1], wall2), v([X, Y0, Z1], wall2), v([X, Y0, Z0], wall2), v([-X, Y0, Z0], wall2));
  quad(v([-X, Y1, Z0], wall), v([X, Y1, Z0], wall), v([X, Y1, Z1], wall), v([-X, Y1, Z1], wall));
  const za = -I.axle * u, ty = I.tableY * u;
  prism([[0, ty, za], [0, Y1, za]], 0.028 * u, lin('#4d544f'), 6);
  kind = 2; const [lx, ly, lz] = I.lamp; box(-lx * u, lx * u, (ly - 0.03) * u, (ly + 0.03) * u, (lz - 0.035) * u, (lz + 0.035) * u, [1, 1, 1]);
  // the turntable (its top in two shades by turns, so its turning shows; a pale rim) and the plants on it: turning
  kind = 1;
  const TR = I.table * u, th = 0.06 * u, SEG = 20, top = [lin('#383e3a'), lin('#2c322e')], rim = lin('#5d635e');
  for (let i = 0; i < SEG; i++) {
    const a0 = i / SEG * TAU, a1 = (i + 1) / SEG * TAU, c = top[i % 2], p0 = [TR * Math.sin(a0), ty, za + TR * Math.cos(a0)], p1 = [TR * Math.sin(a1), ty, za + TR * Math.cos(a1)];
    tri(v([0, ty, za], c), v(p0, c), v(p1, c));
    quad(v(p0, rim), v(p1, rim), v([p1[0], ty - th, p1[2]], rim), v([p0[0], ty - th, p0[2]], rim));
  }
  const rr = I.ring * u;
  u = 1.35 * hs;   // (the plants: a little bigger than the chamber's unit)
  PLANT.forEach((build, i) => {
    const a = i / PLANT.length * TAU + 0.14 * Math.sin(i * 2.4 + 1), px = rr * Math.sin(a), pz = za + rr * Math.cos(a), yaw = R() * TAU, cy = Math.cos(yaw), sy = Math.sin(yaw);
    T = (q) => [px + q[0] * cy + q[2] * sy, ty + q[1], pz - q[0] * sy + q[2] * cy];
    build();
  });
  // (aLocal and aCol go on after the piece takes the geometry: a piece keeps only position, normal and uv)
  const g = new THREE.BufferGeometry(), nor = new Float32Array(P.length); for (let i = 2; i < nor.length; i += 3) nor[i] = 1;
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(ix); return [g, { aLocal: new THREE.Float32BufferAttribute(L, 4), aCol: new THREE.Float32BufferAttribute(C, 4) }];
}

const sizes = (o) => { const size = o.size ?? 0.36, n = Math.max(1, Math.round(o.n ?? 1)), gap = o.gap ?? 0.04, W = size + 2 * BAND, plate = o.plate ?? n > 1; return { size, n, gap, W, plate, len: n * W + (n - 1) * gap }; };
export function growPodSize(o = {}) {
  const { W, plate, len } = sizes(o), e = plate ? 2 * PLATE_EDGE + (o.backTrim ? 2 * PLATE_TRIM : 0) : 0;
  return [len + e, W + e, RIM.proud + ((o.clamps ?? 4) ? 0.008 : 0) + (plate ? PLATE : 0)];
}

export function growPod(p, o = {}) {
  if (!MAT_KEYS.includes('pod')) throw new Error('kit: the grow pod\'s glass needs the \'pod\' material in kit/materials.js (the three lines to add are at the top of kit/growglass.js)');
  const { size, n, gap, W, plate, len } = sizes(o), round = (o.shape ?? 'oct') === 'round', y = o.y ?? 1.33, hs = size / 2;
  const frost = o.frost ?? 'medium', F = FROST[frost]; if (!F) throw new Error('kit: no grow pod frost "' + frost + '" (' + Object.keys(FROST).join(', ') + ')');
  const z0 = FACE + (plate ? PLATE : 0), move = o.move ?? true, turn = o.turn ?? GROW.turn, clamps = o.clamps ?? 4;
  // (one pod's plate is eight-sided, a row's a long plate with its corners cut; a trim is a second, lower plate that
  // shows as a thin line all round the first)
  if (plate) {
    const slab = (look, grow, high) => { const w = len + 2 * PLATE_EDGE + 2 * grow, h = W + 2 * PLATE_EDGE + 2 * grow; add(p, look, relief(shape(w, h, n > 1 ? 0.05 + grow * 0.6 : OCT * h, 0, y), RINGS.bevel(high, Math.min(0.006, high * 0.5))), [0, 0, FACE]); };
    slab(o.back ?? 'dark', 0, PLATE);
    if (o.backTrim) slab(o.backTrim, PLATE_TRIM, PLATE - 0.0025);   // (still clear of the wall's raised panels)
  }
  for (let k = 0; k < n; k++) {
    const cx = (k - (n - 1) / 2) * (W + gap), plant = Array.isArray(o.plant) ? o.plant[k % o.plant.length] : o.plant ?? 'ring', R = rand((o.seed ?? 1) * 97 + k * 31 + 5);
    // the frame, and the clamps across it on the diagonals
    add(p, o.trim ?? 'black', round ? roundFrame(hs) : relief(shape(W, W, OCT * W), RINGS_RIM, { hole: true }), [cx, y, z0]);
    for (let c = 0; c < clamps; c++) {
      const a = PI / 4 + c * TAU / clamps, rc = hs + BAND * 0.62;
      add(p, o.clamp ?? GUN, solid(shape(0.05, 0.04, 0.009), RIM.proud + 0.008, { edge: 0.005, back: false }), [cx + rc * Math.cos(a), y + rc * Math.sin(a), z0], [0, 0, a]);
    }
    const tint = typeof o.tint === 'number' ? o.tint : (o.tint ?? 'pink') === 'warm' ? 0 : 1, glassAt = [cx, y, z0 + RIM.glass - 0.0005];
    if (plant === 'carousel') {
      // REAL plants: the chamber and all in it (one draw for all the pods' insides), the frosted pane in front (another)
      if (!MAT_KEYS.includes('podIn') || !MAT_KEYS.includes('podPane')) throw new Error('kit: a carousel grow pod needs the \'podIn\' and \'podPane\' materials in kit/materials.js (the lines to add are at the top of kit/growglass.js)');
      const [geo, more] = insideOf(hs, rand((o.seed ?? 1) * 7919 + k * 131)), gi = add(p, null, geo, glassAt, null, 'podIn');
      for (const [name, a] of Object.entries(more)) gi.setAttribute(name, a);
      fill(gi, 'aPod', [hs, round ? 1 : 0, move === false || !turn ? 0 : TAU / turn, R() * TAU]);
      fill(gi, 'aLamp', [tint, o.lampGlow ?? 1, o.glow ?? 1, o.shade ?? SHADE.carousel]);
      const gp = add(p, null, glassPlate(round, hs, 0.004), glassAt, null, 'podPane');
      fill(gp, 'aPod', [hs, o.glow ?? 1, round ? 1 : 0, 1]);
      fill(gp, 'aLook', [F.haze, F.grain, 1, R()]);
      fill(gp, 'aLamp', [0, o.lampGlow ?? 1, tint, o.shade ?? SHADE.carousel]);
    } else {
      // the glass: which pictures it shows, and how (kit/growglass.js)
      const g = add(p, null, glassPlate(round, hs, 0.004), glassAt, null, 'pod'), cell = podCell(plant, frost, o.seed ?? 1);
      const how = move === true ? (plant === 'ring' ? 'turn' : 'stir') : move, ring = plant === 'ring';
      fill(g, 'aCell', [...cell.near, ...cell.far]);
      fill(g, 'aPod', [hs, o.glow ?? 1, round ? 1 : 0, o.deep ?? 1]);
      fill(g, 'aLook', [F.haze, F.grain, k % 2 ? -1 : 1, R()]);
      fill(g, 'aMove', [ring ? R() * TAU : 0, how === 'turn' && turn ? TAU / turn : 0, how === 'stir' ? GROW.stir : 0, ring ? 0 : (R() - 0.5) * 0.3]);
      fill(g, 'aLamp', [(o.lamp ?? 'top') === 'rim' ? 1 : 0, o.lampGlow ?? 1, tint, o.shade ?? SHADE[plant] ?? 0.3]);
    }
    // its light on what is near it: soft, short, baked (it follows the cabin's light strips' level)
    const i = (o.light ?? 0.2) * (size / 0.36) ** 2;
    if (i > 0) strip(p, [cx, y, z0 + 0.14], i, [0, 0, 1], 1.3, LIGHT);
  }
  // (one pool for a whole row: a room shows only its strongest few)
  const pl = (o.pool ?? 0.1) * (size / 0.36) ** 2 * Math.sqrt(n);
  if (pl > 0) pool(p, [0, y, z0 + 0.3 + 0.08 * (n - 1)], pl, 1.1 + 0.25 * (n - 1), LIGHT);
  return p;
}
