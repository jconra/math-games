// THE CREW LAB'S SWEEPS (2026-11-15; the game's maker: "you can always feel free to use the same method to look for
// problems too, such as making sure necks are centered in collars and heads aren't poking through hair"). Two
// measurements of one person, each made at the outfit's rest (the bones as they were before any clip: a Line-up tile's
// person keeps them, c.rest), in the Head bone's frame (metres; x their left, y up, z forward), the frame the kit's
// collar is measured in (kit/crew.js THE COLLAR FIT). Used by the sweep rigs (~/pw/space-math/rigs/crewlab-lineup/
// sweep.cjs), which walk the Line-ups; nothing in the lab calls them.
// And a third (2026-11-15), in the pose shown: HUMAN PROPORTIONS (figureOf, proportionsOf, further down): a figure's
// neck, shoulders, arms, hands, legs and head measured in heads and held to real adults' ranges; the lab's Normal figure
// (Camera window) asks figureOf how tall the person stands.
//   neckOf(c)  THE NECK IN ITS COLLAR: the neck where it comes out of the collar (its points the Head bone carries
//              under half of, from the collar's rim to 10 mm above it, each way round) against the collar's outside
//              there. Each of 72 steps round: the gap from the neck's outside to the collar's outside (mm; under 0 the
//              neck stands out past the collar there: the 2026-11-15 picture, a neck too far back, out through the back
//              of the collar). Returns { front, back, left, right } (the least gap within 30 degrees of each way, mm;
//              the front's often the chin over a high collar, not the neck), least and leastAt (the least gap round the
//              sides and the back, 45 degrees off ahead and further, and where: degrees, 0 ahead, 90 their left, 180 behind),
//              forward (mm the head would come forward to even the front and the back: (front - back) / 2) and side
//              (mm to their left to even the sides), or null (no collar, no neck: a helmet, an open collar)
//   pokeOf(c)  THE HEAD THROUGH ITS HAIR: every scalp point the hair covers (looked at from the skull's centre: the hair
//              there in every direction round it, 3 degree steps, so the hair's edge doesn't count; the ears left out),
//              against the hair's inner layer and its outside in that direction. Returns { points (scalp points under
//              hair), inner (points out past the inner layer by over 1 mm), innerMm (the most), outer (points out past
//              the hair's outside by over 0.5 mm: skin showing through), outerMm, worst: [azimuth, elevation] of the
//              deepest, through, throughMm, throughWorst (2026-11-15: of the outer ones, those with hair over the scalp
//              within 18 degrees above, below and to either side: skin showing THROUGH the hair, not the
//              neck in front of a hair's edge tucked into the nape, which outer counts too: Crew 1's swept hair and the
//              braided crown, hidden) } or null (no hair mesh)
import * as THREE from 'three';

const _v = new THREE.Vector3(), F = new THREE.Matrix4();
const DEG = 180 / Math.PI;
// (a person's bones put at rest for a measurement, and back as they were after)
function atRest(c, fn) {
  if (!c.rest) throw new Error('sweeps: a person with no rest kept (a Line-up tile\'s person keeps it)');
  const was = c.rest.map(([b]) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
  for (const [b, p, q, s] of c.rest) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(s); }
  c.root.updateMatrixWorld(true);
  try { return fn(); } finally { c.rest.forEach(([b], i) => { b.position.copy(was[i][0]); b.quaternion.copy(was[i][1]); b.scale.copy(was[i][2]); }); c.root.updateMatrixWorld(true); }
}
// (a skinned mesh's points at the pose now, in the Head bone's frame; and how much of each the Head bone carries)
function pointsOf(m, head, withShare) {
  const n = m.geometry.attributes.position.count, P = new Float32Array(n * 3);
  F.copy(head.matrixWorld).invert();
  for (let i = 0; i < n; i++) { m.getVertexPosition(i, _v); _v.applyMatrix4(m.matrixWorld).applyMatrix4(F).toArray(P, i * 3); }
  if (!withShare) return { P, n };
  const bones = m.skeleton.bones, rides = bones.map((b) => { for (let p = b; p; p = p.parent) if (p === head) return true; return false; });
  const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, HW = new Float32Array(n);
  for (let i = 0; i < n; i++) { let w = 0; for (let k = 0; k < 4; k++) if (rides[si.getComponent(i, k)]) w += sw.getComponent(i, k); HW[i] = w; }
  return { P, n, HW };
}

export function neckOf(c) {
  const C = c.collar, m = c.meshes.head;
  if (!C || !m || c.meshes.visor) return null;
  return atRest(c, () => {
    const { P, n, HW } = pointsOf(m, c.bones.Head, true), nt = C.nt;
    const NR = new Float32Array(nt).fill(-Infinity), WL = new Float32Array(nt).fill(Infinity);
    // (the collar's centre on its rim's highest level; each step round its rim, and its outside there)
    const top = Math.max(...C.rim), kt = Math.min(C.ny - 1, Math.round((top - C.y0) / C.step)), cx = C.cx[kt], cz = C.cz[kt];
    for (let j = 0; j < nt; j++) if (C.rim[j] > -Infinity) WL[j] = C.wall[Math.min(C.ny - 1, Math.round((C.rim[j] - C.y0) / C.step))][j];
    // (the neck's skin sliced level by level, every 5 mm as the collar is, each slice sampled along its length: the
    // farthest out each step round, from each step's rim to 10 mm above it)
    const I = m.geometry.index, cnt = I ? I.count : n, lo = Math.min(...C.rim.filter((v) => v > -Infinity)), hi = top + 0.010, pts = [];
    for (let t = 0; t + 2 < cnt; t += 3) {
      const ia = I ? I.getX(t) : t, ib = I ? I.getX(t + 1) : t + 1, ic = I ? I.getX(t + 2) : t + 2;
      if ((HW[ia] + HW[ib] + HW[ic]) / 3 >= 0.5) continue;
      const ya = P[ia * 3 + 1], yb = P[ib * 3 + 1], yc = P[ic * 3 + 1], y0 = Math.min(ya, yb, yc), y1 = Math.max(ya, yb, yc);
      if (y1 < lo || y0 > hi) continue;
      for (let k = Math.max(0, Math.ceil((Math.max(y0, lo) - C.y0) / 0.0025)); C.y0 + k * 0.0025 <= Math.min(y1, hi); k++) {
        const y = C.y0 + k * 0.0025; pts.length = 0;
        for (const [u, v] of [[ia, ib], [ib, ic], [ic, ia]]) {
          const yu = P[u * 3 + 1], yv = P[v * 3 + 1]; if ((yu - y) * (yv - y) > 0 || yu === yv) continue;
          const f = (y - yu) / (yv - yu); pts.push(P[u * 3] + (P[v * 3] - P[u * 3]) * f, P[u * 3 + 2] + (P[v * 3 + 2] - P[u * 3 + 2]) * f);
        }
        if (pts.length < 4) continue;
        const kk = Math.min(C.ny - 1, Math.max(0, Math.round((y - C.y0) / C.step)));
        for (let q = 0; q <= 4; q++) {
          const x = pts[0] + (pts[2] - pts[0]) * q / 4, z = pts[1] + (pts[3] - pts[1]) * q / 4, dx = x - C.cx[kk], dz = z - C.cz[kk];
          const j = Math.floor((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI) * nt) % nt;
          if (!(C.rim[j] > -Infinity) || y < C.rim[j] || y > C.rim[j] + 0.010) continue;
          NR[j] = Math.max(NR[j], Math.hypot(dx, dz));
        }
      }
    }
    const gap = Array.from(NR, (r, j) => (r > -Infinity && WL[j] < Infinity ? (WL[j] - r) * 1000 : null));
    const at = (j) => Math.round(-180 + (j + 0.5) * 360 / nt);
    // (the least within 30 degrees of a way: 0 ahead, 90 their left, 180 behind, -90 their right)
    const way = (d) => { let m0 = null; for (let j = 0; j < nt; j++) { const a = Math.abs(((at(j) - d + 540) % 360) - 180); if (a <= 30 && gap[j] != null) m0 = m0 == null ? gap[j] : Math.min(m0, gap[j]); } return m0; };
    const front = way(0), back = way(180), left = way(90), right = way(-90);
    // (the least all round but the front, where the chin may stand over a high collar: the sides and the back)
    let least = null, leastAt = null; gap.forEach((g, j) => { if (g != null && Math.abs(at(j)) > 45 && (least == null || g < least)) { least = g; leastAt = at(j); } });
    if (least == null) return null;
    const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
    return { front: r1(front), back: r1(back), left: r1(left), right: r1(right), least: r1(least), leastAt,
      forward: front != null && back != null ? r1((front - back) / 2) : null, side: left != null && right != null ? r1((left - right) / 2) : null,
      round: gap.filter((g) => g != null).length, centre: [cx, cz] };
  });
}

const STEP = 3, NA = 360 / STEP, NE = 180 / STEP;
export function pokeOf(c) {
  const hm = c.meshes.head, hairs = []; c.root.traverse((o) => { if (o.isSkinnedMesh && o.userData.part === 'hair') hairs.push(o); });
  if (!hm || !hairs.length) return null;
  return atRest(c, () => {
    const head = c.bones.Head, H = pointsOf(hm, head, true);
    // (2026-11-16: a head worn sized (kit/crew.js THE HEAD'S PLACE: size) carries its hair sized with it, so every length
    // here is the head's own, times its size, k: a sized pair reads as it did unsized, its millimetres k times. A
    // head as made: k 1, as before)
    const k = c.place && +c.place.size > 0 ? +c.place.size : 1;
    // (the skull's centre: the middle of the head's top 12 cm, side to side and front to back, 9 cm under its top)
    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < H.n; i++) if (H.HW[i] > 0.5) y1 = Math.max(y1, H.P[i * 3 + 1]);
    for (let i = 0; i < H.n; i++) { if (H.HW[i] <= 0.5 || H.P[i * 3 + 1] < y1 - 0.12 * k) continue; x0 = Math.min(x0, H.P[i * 3]); x1 = Math.max(x1, H.P[i * 3]); z0 = Math.min(z0, H.P[i * 3 + 2]); z1 = Math.max(z1, H.P[i * 3 + 2]); }
    const O = [(x0 + x1) / 2, y1 - 0.09 * k, (z0 + z1) / 2];
    const bin = (x, y, z) => {
      const dx = x - O[0], dy = y - O[1], dz = z - O[2], r = Math.hypot(dx, dy, dz);
      const a = Math.floor(((Math.atan2(dx, dz) * DEG + 360) % 360) / STEP) % NA, e = Math.min(NE - 1, Math.floor((Math.asin(Math.max(-1, Math.min(1, dy / r))) * DEG + 90) / STEP));
      return [e * NA + a, r];
    };
    const lo = new Float32Array(NA * NE).fill(Infinity), hi = new Float32Array(NA * NE).fill(-Infinity);
    const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
    for (const m of hairs) {
      const { P } = pointsOf(m, head, false), I = m.geometry.index, cnt = I ? I.count : P.length / 3;
      for (let t = 0; t + 2 < cnt; t += 3) {
        const ia = I ? I.getX(t) : t, ib = I ? I.getX(t + 1) : t + 1, ic = I ? I.getX(t + 2) : t + 2;
        A.fromArray(P, ia * 3); B.fromArray(P, ib * 3); Cc.fromArray(P, ic * 3);
        // (each triangle sampled about every 1.5 mm)
        const L = Math.max(A.distanceTo(B), B.distanceTo(Cc), Cc.distanceTo(A)), ks = Math.min(40, Math.max(1, Math.ceil(L / (0.0015 * k))));
        for (let u = 0; u <= ks; u++) for (let v = 0; v <= ks - u; v++) {
          const w = ks - u - v, x = (A.x * u + B.x * v + Cc.x * w) / ks, y = (A.y * u + B.y * v + Cc.y * w) / ks, z = (A.z * u + B.z * v + Cc.z * w) / ks;
          const [b, r] = bin(x, y, z); if (r < lo[b]) lo[b] = r; if (r > hi[b]) hi[b] = r;
        }
      }
    }
    // (covered: the hair there and in every direction round it)
    const covered = (b) => { const e = Math.floor(b / NA), a = b % NA; for (let de = -1; de <= 1; de++) for (let da = -1; da <= 1; da++) { const ee = e + de; if (ee < 0 || ee >= NE) return false; if (!(lo[ee * NA + ((a + da + NA) % NA)] < Infinity)) return false; } return true; };
    const out = { points: 0, inner: 0, innerMm: 0, outer: 0, outerMm: 0, worst: null, through: 0, throughMm: 0, throughWorst: null, centre: O };
    // (the scalp's outside each way round; and a point RINGED by hair: going up, down and to either side from it, within
    // 18 degrees, a way where the hair's outside stands beyond the scalp. Skin poking through a hair has hair over the
    // scalp all round it; the neck in front of a hair's edge tucked into the nape has none below it)
    const skin = new Float32Array(NA * NE).fill(-Infinity);
    for (let i = 0; i < H.n; i++) { if (H.HW[i] < 0.5) continue; const [b, r] = bin(H.P[i * 3], H.P[i * 3 + 1], H.P[i * 3 + 2]); if (r > skin[b]) skin[b] = r; }
    const hairOver = (k) => skin[k] > -Infinity && hi[k] >= skin[k];
    const ringed = (b) => {
      const e = Math.floor(b / NA), a = b % NA;
      for (const [de, da] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let found = false;
        for (let k = 1; k <= 6 && !found; k++) { const ee = e + de * k; if (ee < 0 || ee >= NE) break; if (hairOver(ee * NA + ((a + da * k + NA) % NA))) found = true; }
        if (!found) return false;
      }
      return true;
    };
    for (let i = 0; i < H.n; i++) {
      if (H.HW[i] < 0.5) continue;
      const x = H.P[i * 3], y = H.P[i * 3 + 1], z = H.P[i * 3 + 2], [b, r] = bin(x, y, z);
      if (!covered(b)) continue;
      // (the ears left out: to either side, below 20 degrees up)
      const az = Math.atan2(x - O[0], z - O[2]) * DEG, el = Math.asin((y - O[1]) / r) * DEG;
      if (Math.abs(Math.abs(az) - 90) < 35 && el < 20) continue;
      out.points++;
      const di = (r - lo[b]) * 1000, dout = (r - hi[b]) * 1000;
      if (di > 1 * k) { out.inner++; out.innerMm = Math.max(out.innerMm, di); }
      if (dout > 0.5 * k) { out.outer++; if (dout > out.outerMm) { out.outerMm = dout; out.worst = [Math.round(az), Math.round(el)]; } }
      if (dout > 0.5 * k && ringed(b)) { out.through++; if (dout > out.throughMm) { out.throughMm = dout; out.throughWorst = [Math.round(az), Math.round(el)]; } }
    }
    out.innerMm = Math.round(out.innerMm * 10) / 10; out.outerMm = Math.round(out.outerMm * 10) / 10; out.throughMm = Math.round(out.throughMm * 10) / 10;
    return out;
  });
}

// ── HUMAN PROPORTIONS (2026-11-15) ──────────────────────────────────────────────────────────────────────────────────
// The game's maker, of a look seen from behind in a ship's airlock: "this neck is freakishly long. I wish that a critic
// agent could do better at knowing when human proportions are off." Every check before had looked at the crew from the
// front or three-quarter, by eye, with nothing to compare against; the game's camera follows the player from BEHIND
// and inside a ship comes within a metre of the head. So a figure is measured, in the views the game shows, in units
// of its own head (chin to the top of the skull, hair left out), and held to what real adults measure.
//   figureOf(c, { renderer, game, paint, keep })
//       a person's landmarks and lengths IN THE POSE SHOWN (not put at rest: the game's standing pose is what is
//       seen), in the person's own frame (metres as made; feet on y 0, x their left, z forward; a recipe's size
//       divided out). From its meshes and joints: the head's height H, its chin and skull base, the whole height,
//       the joints, the arm's and hand's lengths, the fingertips' height, the crotch. With a renderer (the page's
//       own; nothing is drawn to the screen), from three level pictures BY PART (the person drawn in flat colours:
//       skin, outfit, hair, hands; from behind, from the front, from their left; a millimetre a pixel): the bare neck
//       each way, the shoulders' tops, fall and width; and from the game's own camera behind them (src/chase.js), at
//       each of `game`'s distances, how much bare neck it shows (all the skin, and from the skull's base down).
//       `paint`: the painted hair (a buzz cut, a nape's taper, a shaved side's stubble) counted as hair (on unless
//       false). `keep`: the pictures kept (fig._img) for pictureOf. Returns null for a person with no head.
//   proportionsOf(fig, sex)   the figure's proportions in heads and shares of its height, each against NORMAL's range
//       for that sex ('f' | 'm': the outfit's skeleton, c.body): { rows: [{ key, label, unit, value, lo, hi, mid, out
//       (how far outside the range, in units of the spread real adults show in that measure: see N below; 0
//       inside), side ('under' | 'over'), src }], score (the outs added up), worst }
//   NORMAL, MEASURES, SKULL_BASE (below); pictureOf(fig._img, 'back' | 'front' | 'left', lines) a picture by part as a PNG
// Used by ~/pw/space-math/rigs/proportions/measure.cjs, which measures every figure the game shows. Run it again
// after any change to the crew (a head, a hair, an outfit, a seat, the stance).
const median = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((p, q) => p - q); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const mean = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)); return s.length ? s.reduce((p, q) => p + q, 0) / s.length : null; };
// THE SKULL'S BASE: the figure-drawing rule that the bottom of the ear, the base of the nose and the base of the skull
// lie on one level; that level is 0.70 of the head's height under its top (ANSUR's base of the nose: 16.19 of 23.20 cm
// in men, 15.28 of 21.76 cm in women)
export const SKULL_BASE = 0.70;

// a person's meshes by part (the eyes and a visor apart from the head's skin)
export function partsOf(root) {
  const P = { suit: [], head: [], hair: [], hand: [], eyes: [], visor: [] };
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const mat = o.material && o.material.name;
    if (mat === 'visor') P.visor.push(o); else if (mat === 'eye' || mat === 'cornea') P.eyes.push(o); else if (P[o.userData.part]) P[o.userData.part].push(o);
  });
  return P;
}
// (a skinned mesh's points at the pose now, in the frame M (from the world))
function posed(m, M) {
  const n = m.geometry.attributes.position.count, P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { m.getVertexPosition(i, _v); _v.applyMatrix4(m.matrixWorld).applyMatrix4(M).toArray(P, i * 3); }
  return P;
}
// (how much of each point the bones picked carry)
function shareOf(m, pick) {
  const n = m.geometry.attributes.position.count, on = m.skeleton.bones.map(pick), si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, W = new Float32Array(n);
  for (let i = 0; i < n; i++) { let w = 0; for (let k = 0; k < 4; k++) if (on[si.getComponent(i, k)]) w += sw.getComponent(i, k); W[i] = w; }
  return W;
}
const rides = (b, top) => { for (let p = b; p; p = p.parent) if (p === top) return true; return false; };
// (a mesh's triangles cut by the upright plane x = x0: segments [z, y, z, y])
function sliceX(P, m, x0) {
  const I = m.geometry.index, cnt = I ? I.count : P.length / 3, out = [];
  for (let t = 0; t + 2 < cnt; t += 3) {
    const a = I ? I.getX(t) : t, b = I ? I.getX(t + 1) : t + 1, c = I ? I.getX(t + 2) : t + 2, q = [];
    for (const [u, w] of [[a, b], [b, c], [c, a]]) {
      const xu = P[u * 3] - x0, xw = P[w * 3] - x0; if ((xu > 0) === (xw > 0)) continue;
      const f = xu / (xu - xw); q.push(P[u * 3 + 2] + (P[w * 3 + 2] - P[u * 3 + 2]) * f, P[u * 3 + 1] + (P[w * 3 + 1] - P[u * 3 + 1]) * f);
    }
    if (q.length === 4) out.push(q);
  }
  return out;
}

// (a mesh's triangles cut by the level plane y = y0: how far the cut reaches [least x, most x, least z, most z], or null)
function levelCut(P, m, y0) {
  const I = m.geometry.index, cnt = I ? I.count : P.length / 3; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let t = 0; t + 2 < cnt; t += 3) {
    const a = I ? I.getX(t) : t, b = I ? I.getX(t + 1) : t + 1, c = I ? I.getX(t + 2) : t + 2;
    for (const [u, w] of [[a, b], [b, c], [c, a]]) {
      const yu = P[u * 3 + 1] - y0, yw = P[w * 3 + 1] - y0; if ((yu > 0) === (yw > 0)) continue;
      const f = yu / (yu - yw), x = P[u * 3] + (P[w * 3] - P[u * 3]) * f, z = P[u * 3 + 2] + (P[w * 3 + 2] - P[u * 3 + 2]) * f;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
  }
  return x1 > x0 ? [x0, x1, z0, z1] : null;
}

// THE HEAD'S OWN MEASURES, in its Head bone's frame (so a nod or a turn changes nothing): its top, its chin, its
// height H, its skull base, its width and length
function headOf(c, P) {
  const head = c.bones.Head; if (!head || !P.head.length) return null;
  // (the head's skin: its largest mesh)
  const m = P.head.reduce((a, b) => (b.geometry.attributes.position.count > a.geometry.attributes.position.count ? b : a));
  const HF = head.matrixWorld.clone().invert(), HP = posed(m, HF), n = HP.length / 3;
  let top = -Infinity, bottom = Infinity; for (let i = 0; i < n; i++) { top = Math.max(top, HP[i * 3 + 1]); bottom = Math.min(bottom, HP[i * 3 + 1]); }
  // (its own middle, side to side: between its widest points in its top 12 cm)
  let x0 = Infinity, x1 = -Infinity; for (let i = 0; i < n; i++) if (HP[i * 3 + 1] > top - 0.12) { x0 = Math.min(x0, HP[i * 3]); x1 = Math.max(x1, HP[i * 3]); }
  const xc = (x0 + x1) / 2;
  // (the middle slice, front to back: per millimetre of height its foremost and its rearmost point)
  const y0 = top - 0.42, nb = 421, zf = new Float32Array(nb).fill(-Infinity), zb = new Float32Array(nb).fill(Infinity);
  for (const [za, ya, zc, yc] of sliceX(HP, m, xc)) {
    const k = Math.max(1, Math.ceil(Math.hypot(zc - za, yc - ya) / 0.0004));
    for (let i = 0; i <= k; i++) { const z = za + (zc - za) * i / k, y = ya + (yc - ya) * i / k, b = Math.round((y - y0) / 0.001); if (b < 0 || b >= nb) continue; if (z > zf[b]) zf[b] = z; if (z < zb[b]) zb[b] = z; }
  }
  for (let b = 1; b < nb; b++) { if (zf[b] === -Infinity) zf[b] = zf[b - 1]; if (zb[b] === Infinity) zb[b] = zb[b - 1]; }
  // THE CHIN: the head's foremost point is the tip of the nose; from 3 cm under it going down (to 11.5 cm under it), the
  // chin's underside is where the front falls away (6 mm lower it is over 15 mm further back: the step back to the
  // throat; a soft chin: 12 mm lower). The chin's foremost point: within 25 mm above that; its underside: the lowest
  // height where the front is still within 12 mm of that foremost point. Read from the top down, so a nod, which
  // swings the throat about under the head, changes nothing. (Checked against the Tripo heads' own Chin bones.)
  // (2026-11-16: every one of those lengths is the head's own, so a head worn sized (kit/crew.js THE HEAD'S PLACE: size)
  // is read by them sized alike, k: at 1.12 the step back under t6's lower lip had grown past 15 mm in 6 and was taken
  // for the chin, 5 cm too high. A head as made: k 1, every length as it was)
  const k = c.place && +c.place.size > 0 ? +c.place.size : 1, mm = (v) => Math.round(v * k);
  let nose = nb - 1; for (let b = 0; b < nb; b++) if (zf[b] > zf[nose]) nose = b;
  let cliff = -1;
  for (const drop0 of [6, 12]) { const drop = mm(drop0); for (let b = nose - mm(30); b > Math.max(drop + 1, nose - mm(115)) && cliff < 0; b--) if (zf[b] > -Infinity && zf[b - drop] > -Infinity && zf[b] - zf[b - drop] > 0.015 * k) cliff = b; if (cliff >= 0) break; }
  let chin = null;
  if (cliff >= 0) {
    let bp = cliff; for (let b = cliff; b <= Math.min(nose - mm(15), cliff + mm(25)); b++) if (zf[b] > zf[bp]) bp = b;
    let bm = bp; for (let b = bp; b >= Math.max(0, cliff - mm(14)); b--) { if (zf[b] >= zf[bp] - 0.012 * k) bm = b; else break; }
    chin = [xc, y0 + bm * 0.001, zf[bm]];
  }
  const chinBone = c.bones.Chin ? c.bones.Chin.getWorldPosition(new THREE.Vector3()).applyMatrix4(HF).toArray() : null;
  // (a visor, or no chin found: a helmet, which is no person's head. With no chin its lowest rigid point stands in)
  let helmet = P.visor.length > 0;
  if (!chin) { helmet = true; const W = shareOf(m, (b) => rides(b, head)); let lo = Infinity; for (let i = 0; i < n; i++) if (W[i] > 0.9 && HP[i * 3 + 1] < lo) { lo = HP[i * 3 + 1]; chin = [xc, lo, HP[i * 3 + 2]]; } }
  if (!chin) return null;
  const H = top - chin[1], bOf = (y) => Math.max(0, Math.min(nb - 1, Math.round((y - y0) / 0.001)));
  // (the skull's base: the point on the back of the head SKULL_BASE of its height under its top; the nape's hollow:
  // the back's foremost point from there down to 4 cm under the chin's level)
  const ySB = top - SKULL_BASE * H, skullBase = [xc, ySB, zb[bOf(ySB)]];
  let hol = bOf(ySB); for (let b = bOf(chin[1] - 0.04); b <= bOf(ySB); b++) if (zb[b] > zb[hol]) hol = b;
  // (the skull's width above the ears and its length, between 0.15 and 0.36 of its height under its top)
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (let i = 0; i < n; i++) { const y = HP[i * 3 + 1]; if (y > top - 0.15 * H || y < top - 0.36 * H) continue; bx0 = Math.min(bx0, HP[i * 3]); bx1 = Math.max(bx1, HP[i * 3]); bz0 = Math.min(bz0, HP[i * 3 + 2]); bz1 = Math.max(bz1, HP[i * 3 + 2]); }
  return { mesh: m, xc, top, bottom, chin, chinBone, helmet, H, skullBase, hollow: [xc, y0 + hol * 0.001, zb[hol]], breadth: bx1 - bx0, length: bz1 - bz0 };
}

// PICTURES BY PART: the person drawn in flat colours (skin, outfit, hair, hands, a visor), so a picture can be measured
const NONE = 0, SKIN = 1, SUIT = 2, HAIR = 3, HAND = 4, VISOR = 5;
const IDCOL = { skin: 0xff0000, suit: 0x0000ff, hand: 0x00ff00, visor: 0xffff00, hair: 0x000000 };
const idMats = new Map(), targets = new Map();
const idMat = (kind, side) => { const k = kind + side; if (!idMats.has(k)) idMats.set(k, new THREE.MeshBasicMaterial({ color: IDCOL[kind], side })); return idMats.get(k); };
const target = (w, h, float) => { const k = w + 'x' + h + (float ? 'f' : ''); if (!targets.has(k)) targets.set(k, new THREE.WebGLRenderTarget(w, h, float ? { type: THREE.FloatType, depthBuffer: true } : { depthBuffer: true })); return targets.get(k); };
// (a camera in the person's own frame: { eye, at, w, h } and half ([half width, half height] metres: level, no
// perspective) or fov (degrees tall); px(point) -> its pixel [column, row from the top])
function viewOf(c, { eye, at, half, fov, w, h }) {
  c.root.updateMatrixWorld(true);
  const M = c.root.matrixWorld, s = new THREE.Vector3().setFromMatrixScale(M).y || 1;
  const cam = half ? new THREE.OrthographicCamera(-half[0] * s, half[0] * s, half[1] * s, -half[1] * s, 0.01 * s, 30 * s) : new THREE.PerspectiveCamera(fov, w / h, 0.02 * s, 80 * s);
  cam.position.set(eye[0], eye[1], eye[2]).applyMatrix4(M);
  cam.up.set(0, 1, 0).applyQuaternion(c.root.getWorldQuaternion(new THREE.Quaternion()));
  cam.lookAt(new THREE.Vector3(at[0], at[1], at[2]).applyMatrix4(M));
  cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const px = (p) => { _v.set(p[0], p[1], p[2]).applyMatrix4(M).project(cam); return [(_v.x + 1) / 2 * w, (1 - _v.y) / 2 * h]; };
  return { cam, w, h, eye, at, px };
}
// (the picture: what is drawn at each pixel, row 0 the top. Drawn into a target of its own with the page's renderer,
// each part's material swapped for a flat colour and put back; card hair keeps its own material, so its strands' own
// cut-out edge is what is measured: with no light it draws black)
function shoot(renderer, c, P, V) {
  const rt = target(V.w, V.h), buf = new Uint8Array(V.w * V.h * 4), was = [], vis = c.root.visible;
  const back = renderer.getRenderTarget(), col = renderer.getClearColor(new THREE.Color()), al = renderer.getClearAlpha();
  const set = (m, mat) => { was.push([m, m.material, m.frustumCulled]); if (mat) m.material = mat; m.frustumCulled = false; };
  for (const m of P.suit) set(m, idMat('suit', m.material.side));
  for (const m of P.head) set(m, idMat('skin', m.material.side));
  for (const m of P.eyes) set(m, idMat('skin', THREE.FrontSide));
  for (const m of P.hand) set(m, idMat('hand', m.material.side));
  for (const m of P.visor) set(m, idMat('visor', THREE.DoubleSide));
  for (const m of P.hair) set(m, m.material.alphaTest > 0 ? null : idMat('hair', m.material.side));
  c.root.visible = true;
  try {
    renderer.setRenderTarget(rt); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(c.root, V.cam);
    renderer.readRenderTargetPixels(rt, 0, 0, V.w, V.h, buf);
  } finally {
    for (const [m, mat, fc] of was) { m.material = mat; m.frustumCulled = fc; }
    c.root.visible = vis; renderer.setRenderTarget(back); renderer.setClearColor(col, al);
  }
  const cls = new Uint8Array(V.w * V.h);
  for (let y = 0; y < V.h; y++) for (let x = 0; x < V.w; x++) {
    const o = ((V.h - 1 - y) * V.w + x) * 4, r = buf[o] > 127, g = buf[o + 1] > 127, b = buf[o + 2] > 127;
    cls[y * V.w + x] = r && g && b ? NONE : r && g ? VISOR : r ? SKIN : b ? SUIT : g ? HAND : HAIR;
  }
  return cls;
}
// THE PAINTED HAIR (a buzz cut, a nape's taper, a shaved side's stubble: drawn on the skin, no mesh): the head alone,
// lit evenly, drawn with its paint and without (the kit's c.paintView), the hair's colour black for the moment. How
// much darker a pixel is with the paint is how much hair is painted there (0 none; full stubble about 0.4 and over).
// Everything is put back as it was. null for a person the kit gives no paint view (an older build's)
function paintOf(renderer, c, P, V) {
  if (!c.paintView || !c.setColours || !c.paintShown) return null;
  const float = renderer.capabilities.isWebGL2 && !!renderer.extensions.get('EXT_color_buffer_float');
  const rt = target(V.w, V.h, float), n = V.w * V.h, A = float ? new Float32Array(n * 4) : new Uint8Array(n * 4), B = float ? new Float32Array(n * 4) : new Uint8Array(n * 4);
  const S = new THREE.Scene(); S.add(new THREE.AmbientLight(0xffffff, Math.PI));
  const parent = c.root.parent, shown = { ...c.paintShown }, cols = c.recipe && c.recipe.colours ? { ...c.recipe.colours } : {}, vis = c.root.visible;
  const hid = []; c.root.traverse((o) => { if (o.isMesh && !P.head.includes(o) && o.visible) { hid.push(o); o.visible = false; } });
  const fc = P.head.map((m) => m.frustumCulled); P.head.forEach((m) => { m.frustumCulled = false; });
  const back = renderer.getRenderTarget(), col = renderer.getClearColor(new THREE.Color()), al = renderer.getClearAlpha();
  c.root.visible = true;
  try {
    S.add(c.root); c.setColours({ hair: '#000000' });
    renderer.setRenderTarget(rt); renderer.setClearColor(0xffffff, 1);
    c.paintView({ buzz: true, under: true, ears: false }); renderer.clear(); renderer.render(S, V.cam); renderer.readRenderTargetPixels(rt, 0, 0, V.w, V.h, A);
    c.paintView({ buzz: false, under: false, ears: false }); renderer.clear(); renderer.render(S, V.cam); renderer.readRenderTargetPixels(rt, 0, 0, V.w, V.h, B);
  } finally {
    c.paintView(shown); c.recipe.colours = cols; c.setColours({});
    if (parent) parent.add(c.root); else S.remove(c.root);
    hid.forEach((o) => { o.visible = true; }); P.head.forEach((m, i) => { m.frustumCulled = fc[i]; });
    c.root.visible = vis; renderer.setRenderTarget(back); renderer.setClearColor(col, al); c.root.updateMatrixWorld(true);
  }
  const D = new Float32Array(n);
  for (let y = 0; y < V.h; y++) for (let x = 0; x < V.w; x++) {
    const o = ((V.h - 1 - y) * V.w + x) * 4, on = A[o] + A[o + 1] + A[o + 2], off = B[o] + B[o + 1] + B[o + 2];
    D[y * V.w + x] = off > 1e-4 ? Math.max(0, 1 - on / off) : 0;
  }
  return D;
}

const PX = 0.001;      // (a pixel of the level pictures, metres)
const PAINTED = 0.2;   // (how much darker painted hair makes the skin where it counts as hair: full stubble is about 0.4)
export function figureOf(c, { renderer = null, game = [2.6, 1.0, 0.7], paint = true, keep = false } = {}) {
  c.root.updateMatrixWorld(true);
  const P = partsOf(c.root), toRoot = c.root.matrixWorld.clone().invert(), B = c.bones;
  const J = (n) => (B[n] ? B[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot) : null);
  const Hd = headOf(c, P); if (!Hd || !P.suit.length) return null;
  const fromHead = toRoot.clone().multiply(B.Head.matrixWorld), inRoot = (p) => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(fromHead);
  const H = Hd.H, chin = inRoot(Hd.chin), skullBase = inRoot(Hd.skullBase), hollow = inRoot(Hd.hollow), crown = inRoot([Hd.xc, Hd.top, Hd.skullBase[2] + 0.08]);
  // (the whole figure: from the outfit's lowest point to the head's highest, hair left out)
  const SP = P.suit.map((m) => posed(m, toRoot)), HP = posed(Hd.mesh, toRoot);
  let floor = Infinity, topY = -Infinity;
  for (const A of SP) for (let i = 1; i < A.length; i += 3) floor = Math.min(floor, A[i]);
  for (let i = 1; i < HP.length; i += 3) topY = Math.max(topY, HP[i]);
  const fig = { H, helmet: Hd.helmet, floor, topY, stature: topY - floor, chin: chin.toArray(), skullBase: skullBase.toArray(), hollow: hollow.toArray(),
    chinUnderItsBone: Hd.chinBone ? Hd.chinBone[1] - Hd.chin[1] : null, headBreadth: Hd.breadth, headLength: Hd.length, neckEndY: inRoot([Hd.xc, Hd.bottom, 0]).y };
  // THE JOINTS (the outfit's skeleton: the shoulder joint is the upper arm's, the elbow the forearm's, the hip the
  // thigh's, the knee the shin's)
  const pair = (n) => [J(n + 'L'), J(n + 'R')];
  const [uaL, uaR] = pair('UpperArm'), [laL, laR] = pair('LowerArm'), [wrL, wrR] = pair('Wrist'), [ulL, ulR] = pair('UpperLeg'), [llL, llR] = pair('LowerLeg'), [ftL, ftR] = pair('Foot');
  fig.joints = { head: J('Head').toArray(), neck: J('Neck').toArray(), shoulderL: uaL.toArray(), shoulderR: uaR.toArray(), elbowL: laL.toArray(), elbowR: laR.toArray(), wristL: wrL.toArray(), wristR: wrR.toArray(),
    hipL: ulL.toArray(), hipR: ulR.toArray(), kneeL: llL.toArray(), kneeR: llR.toArray(), ankleL: ftL.toArray(), ankleR: ftR.toArray() };
  fig.shoulderJointY = (uaL.y + uaR.y) / 2; fig.shoulderJointWidth = Math.abs(uaL.x - uaR.x); fig.elbowY = (laL.y + laR.y) / 2; fig.wristY = (wrL.y + wrR.y) / 2;
  fig.hipJointY = (ulL.y + ulR.y) / 2; fig.kneeY = (llL.y + llR.y) / 2; fig.ankleY = (ftL.y + ftR.y) / 2;
  fig.upperArm = (uaL.distanceTo(laL) + uaR.distanceTo(laR)) / 2; fig.forearm = (laL.distanceTo(wrL) + laR.distanceTo(wrR)) / 2;
  fig.thigh = (ulL.distanceTo(llL) + ulR.distanceTo(llR)) / 2; fig.shin = (llL.distanceTo(ftL) + llR.distanceTo(ftR)) / 2;
  // THE HANDS: their own part's points, or (an outfit made with hands of its own) the outfit's points its wrist and
  // finger bones carry. The fingertips' height: each hand's lowest point. The hand's length: along the middle finger's
  // joints from the wrist, then on to the farthest point its last joint carries
  const tipY = [], handLen = [];
  for (const s of ['L', 'R']) {
    const wrist = B['Wrist' + s], last = B['Middle4' + s] || B['Middle3' + s], lp = last ? J(last.name) : null;
    let lo = Infinity, ext = 0;
    (P.hand.length ? P.hand : P.suit).forEach((m) => {
      const Q = P.hand.length ? posed(m, toRoot) : SP[P.suit.indexOf(m)], W = shareOf(m, (b) => rides(b, wrist)), WL = last ? shareOf(m, (b) => b === last) : null;
      for (let i = 0; i < W.length; i++) {
        if (W[i] < 0.5) continue;
        lo = Math.min(lo, Q[i * 3 + 1]);
        if (WL && WL[i] > 0.5) ext = Math.max(ext, Math.hypot(Q[i * 3] - lp.x, Q[i * 3 + 1] - lp.y, Q[i * 3 + 2] - lp.z));
      }
    });
    const chain = ['Wrist', 'Middle1', 'Middle2', 'Middle3', 'Middle4'].map((n) => J(n + s)).filter(Boolean);
    let L = 0; for (let i = 1; i < chain.length; i++) L += chain[i].distanceTo(chain[i - 1]);
    tipY.push(lo < Infinity ? lo : null); handLen.push(chain.length > 2 && ext > 0 ? L + ext : null);
  }
  fig.fingertipY = mean(tipY); fig.handLength = mean(handLen);
  // THE CROTCH: on the outfit's middle slice (between the hip joints), the lowest cloth within 6 cm front to back of
  // the hip joints' line, where that lies 3 to 16 cm under the hip joints (a coat's skirt or an apron hanging lower
  // there: not found, null)
  { const xm = (ulL.x + ulR.x) / 2, zm = (ulL.z + ulR.z) / 2; let lo = Infinity;
    P.suit.forEach((m, k) => { for (const [za, ya, zc, yc] of sliceX(SP[k], m, xm)) for (const [z, y] of [[za, ya], [zc, yc]]) if (Math.abs(z - zm) < 0.06 && y < fig.hipJointY + 0.02 && y > fig.hipJointY - 0.3) lo = Math.min(lo, y); });
    fig.crotchY = lo < fig.hipJointY - 0.03 && lo > fig.hipJointY - 0.16 ? lo : null; }
  if (!renderer) return fig;

  // ── three level pictures by part: the head, the neck and the shoulders, a millimetre a pixel ──
  const cx = J('Neck').x, cz = J('Neck').z, yLo = chin.y - 0.36, yHi = topY + 0.16, hh = (yHi - yLo) / 2, yc = (yHi + yLo) / 2, hw = 0.45, w = Math.round(hw * 2 / PX), h = Math.round(hh * 2 / PX);
  const rowOf = (y) => Math.round((yHi - y) / PX), yOf = (row) => yHi - row * PX;      // (a row's top edge)
  const views = { back: viewOf(c, { eye: [cx, yc, cz - 6], at: [cx, yc, cz], half: [hw, hh], w, h }), front: viewOf(c, { eye: [cx, yc, cz + 6], at: [cx, yc, cz], half: [hw, hh], w, h }),
    left: viewOf(c, { eye: [cx + 6, yc, cz], at: [cx, yc, cz], half: [hw, hh], w, h }) };
  const img = {}; for (const k of Object.keys(views)) img[k] = shoot(renderer, c, P, views[k]);
  const at = (I, col, row) => (col < 0 || col >= w || row < 0 || row >= h ? NONE : I[row * w + col]);
  // (each column's highest cloth; a row's run of one kind through or nearest a column)
  const topSuit = (I) => { const T = new Int32Array(w).fill(h); for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (I[y * w + x] === SUIT) { T[x] = y; break; } return T; };
  const runAt = (I, row, col, kind) => {
    if (at(I, col, row) !== kind) { let near = null; for (let d = 1; d < 60 && near == null; d++) { if (at(I, col - d, row) === kind) near = col - d; else if (at(I, col + d, row) === kind) near = col + d; } if (near == null) return null; col = near; }
    let a = col, b = col; while (at(I, a - 1, row) === kind) a--; while (at(I, b + 1, row) === kind) b++; return [a, b];
  };
  // (the neck's own middle: of the head's skin cut level 2 cm under the chin, side to side and front to back)
  const nk = levelCut(HP, Hd.mesh, chin.y - 0.02), neckX = nk ? (nk[0] + nk[1]) / 2 : skullBase.x, neckZ = nk ? (nk[2] + nk[3]) / 2 : (skullBase.z + chin.z) / 2 - 0.02;
  // FROM BEHIND. The neck's middle line and 10 mm either side of it. In each column: the collar's top (the highest
  // cloth); the bare skin straight above it, up to hair or the head's top; the painted hair from there down. THE BARE
  // NECK: from the hair's lower edge (mesh or paint) or the skull's base, whichever is LOWER, down to the collar's top
  // (the back of a head above its skull base is not neck)
  {
    const I = img.back, T = topSuit(I), xOf = (col) => cx + hw - (col + 0.5) * PX, colOf = (x) => Math.round((cx + hw - x) / PX - 0.5);
    const colN = colOf(neckX), sbRow = rowOf(skullBase.y), ct0 = median(Array.from({ length: 11 }, (_, i) => T[colN - 5 + i])), run = runAt(I, ct0 - 6, colN, SKIN);
    fig.neckWidthAtCollar = run ? (run[1] - run[0] + 1) * PX : null;
    // THE NECK'S WIDTH: its narrowest side to side, from 1 cm under the chin's level down to the collar's top behind
    // (or 5.5 cm under the chin, whichever comes first): the head's own skin cut level every 5 mm, so hair hanging
    // over the neck changes nothing
    { const yTop = chin.y - 0.01, yBot = Math.min(yTop, Math.max(chin.y - 0.055, yOf(ct0) + 0.003)); let nar = Infinity;
      for (let y = yTop; y >= yBot - 1e-6; y -= 0.005) { const q = levelCut(HP, Hd.mesh, y); if (q) nar = Math.min(nar, q[1] - q[0]); }
      fig.neckWidthLeast = nar < Infinity ? nar : null; }
    const D = paint ? paintOf(renderer, c, P, views.back) : null;
    if (keep) fig._img = { w, h, yHi, px: PX, back: img.back, front: img.front, left: img.left, paint: D };
    const bare = [], skin = [], collarY = [], hairY = [], paintY = [];
    for (let col = colN - 10; col <= colN + 10; col++) {
      const cr = T[col]; if (cr >= h) continue;
      let rt = cr; while (rt > 0 && at(I, col, rt - 1) === SKIN) rt--;
      const above = at(I, col, rt - 1);
      // (painted hair: from the top of the bare skin down while it stays painted at half strength or more (PAINTED:
      // a taper fades out downward, and its faint foot does not read as hair), gaps of up to 8 mm let through)
      let foot = null;
      if (D) { let miss = 0; for (let r = rt; r < cr; r++) { let s = 0, k = 0; for (let dx = -4; dx <= 4; dx++) for (let dy = -2; dy <= 2; dy++) if (at(I, col + dx, r + dy) === SKIN) { s += D[(r + dy) * w + col + dx]; k++; } if (k && s / k > PAINTED) { foot = r; miss = 0; } else if (++miss > 8) break; } }
      const from = Math.max(sbRow, rt, foot != null ? foot + 1 : -1);
      bare.push(Math.max(0, cr - from) * PX); skin.push((cr - rt) * PX); collarY.push(yOf(cr));
      if (above === HAIR) hairY.push(yOf(rt)); if (foot != null) paintY.push(yOf(foot + 1));
    }
    const n = bare.length;
    fig.back = { collarY: median(collarY), napeBare: median(bare), napeSkin: median(skin), hairLowY: hairY.length > n / 2 ? median(hairY) : null, paintLowY: paintY.length > n / 2 ? median(paintY) : null, neckX: xOf(colN) };
    // THE SHOULDERS from behind. Their tops: the cloth's top over each shoulder joint. Their fall: the line from where
    // the neck goes into the cloth (3 mm outside the skin's run, at the cloth's top there) down to that top, degrees
    // under level. Their width: the widest the outfit is from 2 cm over the shoulder joints to 10 cm under them
    const side = {};
    for (const [s, j] of [['L', uaL], ['R', uaR]]) {
      const cj = colOf(j.x), top = yOf(median(Array.from({ length: 7 }, (_, i) => T[cj - 3 + i])));
      const edge = run ? (s === 'L' ? run[0] - 3 : run[1] + 3) : null, edgeY = edge != null && T[edge] < h ? yOf(T[edge]) : null;
      side[s] = { topY: top, edgeX: edge != null ? xOf(edge) : null, edgeY, fall: edgeY != null ? Math.atan2(edgeY - top, Math.abs(j.x - xOf(edge))) * DEG : null };
    }
    let wide = 0, wideY = null;
    for (let r = rowOf(fig.shoulderJointY + 0.02); r <= rowOf(fig.shoulderJointY - 0.10); r++) { let a = -1, b = -1; for (let x = 0; x < w; x++) if (I[r * w + x] === SUIT) { if (a < 0) a = x; b = x; } if (a >= 0 && (b - a + 1) * PX > wide) { wide = (b - a + 1) * PX; wideY = yOf(r); } }
    // (the cloth's top line every centimetre across, for drawings: [x from the neck's middle, y])
    const line = []; for (let k = -40; k <= 40; k++) { const col = colOf(cx + k / 100); line.push([k / 100, col >= 0 && col < w && T[col] < h ? Math.round(yOf(T[col]) * 1e4) / 1e4 : null]); }
    fig.shoulders = { topY: (side.L.topY + side.R.topY) / 2, fall: mean([side.L.fall, side.R.fall]), width: wide, widthY: wideY, L: side.L, R: side.R, line };
  }
  // FROM THE FRONT: the chin down to the collar's top on the chin's middle line (under 0: the chin behind the collar)
  {
    const I = img.front, cc = Math.round(views.front.px(chin.toArray())[0]), chinRow = rowOf(chin.y), ys = [], skins = [];
    for (let col = cc - 10; col <= cc + 10; col++) {
      let cr = -1; for (let r = chinRow - 60; r < h; r++) if (at(I, col, r) === SUIT) { cr = r; break; }
      if (cr < 0) continue;
      ys.push(yOf(cr)); let k = 0; for (let r = chinRow; r < cr; r++) if (at(I, col, r) === SKIN) k++; skins.push(k * PX);
    }
    const y = median(ys);
    fig.front = { collarY: y, neck: y != null ? chin.y - y : null, skin: median(skins) };
  }
  // FROM THEIR LEFT: the bare neck on the neck's middle line, from the skull's base level (or the hair, where that
  // hangs lower) down to the collar's top
  {
    const I = img.left, T = topSuit(I), colN = Math.round(views.left.px([cx, chin.y, neckZ])[0]), sbRow = rowOf(skullBase.y);
    const ct0 = median(Array.from({ length: 11 }, (_, i) => T[colN - 5 + i])), run = runAt(I, ct0 - 6, colN, SKIN);
    fig.neckDepthAtCollar = run ? (run[1] - run[0] + 1) * PX : null;
    const bare = [], collarY = [];
    for (let col = colN - 10; col <= colN + 10; col++) {
      const cr = T[col]; if (cr >= h) continue;
      let rt = cr; while (rt > 0 && at(I, col, rt - 1) === SKIN) rt--;
      bare.push(Math.max(0, cr - Math.max(sbRow, rt)) * PX); collarY.push(yOf(cr));
    }
    fig.side = { collarY: median(collarY), bare: median(bare) };
  }
  // THE GAME'S OWN CAMERA, from behind (src/chase.js: it looks at a point 1.5 m over the feet from 0.26 radians
  // above, 60 degrees tall, 2.6 m away on the station's open floors and about 0.7 m in a ship's corridor): on the
  // neck's middle line, the bare skin over the collar's top and the hair over that, in pixels of a 432 x 936 picture;
  // `neck`: that skin as a length at the neck (the pixels turned back into metres by how far off the neck is): ALL
  // of it, the back of the head too where the hair is cut high; `bare`: the same from the skull's base down (or from
  // the hair, where that hangs lower): the level measure's own rule, so the two can be told apart (painted hair is
  // skin to this camera)
  fig.game = {};
  for (const d of game) {
    const gw = 432, gh = 936, V = viewOf(c, { eye: [cx, 1.5 + Math.sin(0.26) * d, cz - Math.cos(0.26) * d], at: [cx, 1.5, cz], fov: 60, w: gw, h: gh }), I = shoot(renderer, c, P, V);
    const g = (col, row) => (col < 0 || col >= gw || row < 0 || row >= gh ? NONE : I[row * gw + col]);
    const pc = Math.round(V.px([fig.back.neckX, fig.back.collarY + 0.02, hollow.z])[0]), r0 = Math.max(0, Math.round(V.px(crown.toArray())[1]) - 4), sbG = Math.round(V.px(skullBase.toArray())[1]), runs = [], bares = [], hairs = [];
    for (let col = pc - 3; col <= pc + 3; col++) {
      let cr = -1; for (let r = r0; r < gh; r++) if (g(col, r) === SUIT) { cr = r; break; }
      if (cr < 0) continue;
      let rt = cr; while (rt > 0 && g(col, rt - 1) === SKIN) rt--;
      let ht = rt; while (ht > 0 && g(col, ht - 1) === HAIR) ht--;
      runs.push(cr - rt); bares.push(Math.max(0, cr - Math.max(rt, sbG))); hairs.push(rt - ht);
    }
    const eye = new THREE.Vector3(...V.eye), dir = new THREE.Vector3(...V.at).sub(eye).normalize(), depth = new THREE.Vector3(fig.back.neckX, fig.back.collarY + 0.03, hollow.z).sub(eye).dot(dir), f = gh / 2 / Math.tan(30 / DEG);
    const np = median(runs), bp = median(bares), hp = median(hairs);
    fig.game[d] = { neckPx: np, hairPx: hp, neck: np != null ? np * depth / f : null, bare: bp != null ? bp * depth / f : null, overHair: hp ? np / hp : null };
  }
  return fig;
}

// THE NORMAL ADULT RANGES a figure is held to: [the least, the most, the middle, where it is from].
//   ANSUR  the US Army's 1988 body survey (1,774 men, 2,208 women; Gordon et al. 1989, Natick TR-89/044). Each range
//          is the 5th to the 95th person in a hundred, each ratio worked out person by person from the survey's public
//          tables (https://www.openlab.psu.edu/ansur/) by ~/pw/space-math/rigs/proportions/ansur_stats.py. The
//          head's height (chin to the top of the skull) is not in those tables: it is the report's own head-board
//          mean (Menton-Top of Head: 23.20 cm men, 21.76 cm women), so a measure "in heads" is the body's own spread
//          over the mean head.
//   CANON  the figure-drawing canon as Loomis teaches it (Figure Drawing for All It's Worth, 1943): a grown figure
//          7 1/2 heads tall (8 idealised); the crotch at the middle of the height; the wrists level with the crotch and
//          the fingertips at mid thigh; the pit of the neck a third of a head under the chin; the hand as long as the
//          face. It agrees with the survey everywhere the two can be compared, so the ranges are the survey's.
//   RULE   this file's own working rule, where neither says.
// Each measure (proportionsOf works them out):
//   nape          the bare neck from behind: the hair's lower edge or the skull's base (whichever is lower) down to
//                 the collar's top, in heads. The most: ANSUR's skull base down to the 7th neck bone on a bare neck,
//                 the most there is to see with no collar at all (mean 0.32); a collar or longer hair covers some, so
//                 any less is normal (RULE: a uniform's collar most often leaves 0.10 to 0.30).
//   neckSide      the bare neck from the side, the skull's base level down to the collar's top. The most: ANSUR's
//                 skull base level down to the point where the neck meets the shoulder (mean 0.37).
//   neckFront     the chin down to the collar's top, front. The most: ANSUR's chin to the pit of the neck (mean 0.37;
//                 CANON a third of a head). The least, 0.10 (about 2 cm): RULE, under that the chin sits on the collar.
//   neckWidth     the neck's narrowest from behind, in heads: ANSUR's girth over the larynx as a width (girth / pi).
//   shoulderDrop  how far the shoulders' tops (the cloth over the shoulder joints) sit under the chin, in heads:
//                 ANSUR's shoulder point under the chin (mean 0.36; CANON a third of a head); the least 0.04 less
//                 (RULE: a centimetre of cloth).
//   shoulderFall  how steeply the shoulders fall from the neck, degrees under level: ANSUR's line from the neck-shoulder
//                 point down to the shoulder point (mean 26).
//   shoulderWidth across the shoulders and upper arms, in heads: ANSUR's width over the upper arms, the most 0.15 more
//                 (RULE: about 3 cm of jacket). CANON: two heads for a woman, two and a third for a man.
//   heads         the whole height in heads: ANSUR's 5th to 95th height over the mean head is 7.0 to 8.1 (mean 7.5,
//                 CANON 7 1/2); the most 0.1 more for boots (RULE).
//   headBreadth   the skull's width above the ears over the head's height: ANSUR.
//   legs          the crotch's height over the whole height: ANSUR (mean 0.47 to 0.48; CANON a half).
//   hips, knee    the hip joints' and the knees' height over the whole height: ANSUR's top of the thigh bone and
//                 middle of the kneecap.
//   arm           the shoulder's top down to the fingertips, arm hanging, over the whole height: ANSUR's shoulder
//                 point to fingertip.
//   armSplit      the upper arm against the forearm (joint to joint): ANSUR's shoulder point to elbow over elbow to
//                 wrist is 1.18 to 1.37; the least here 1.05 (RULE: the shoulder JOINT lies some 3.5 cm under the
//                 shoulder point the survey measures from).
//   fingertips    where the fingertips reach on the thigh: 0 at the knee, 1 at the crotch (CANON: mid thigh): ANSUR.
//   fingertipHeight  the fingertips' height over the whole height (for an outfit whose crotch a coat hides): ANSUR.
//   hand          the hand's length over the whole height: ANSUR (CANON: the face's length).
// HOW FAR OUT a measure is, is told in units of the SPREAD real adults show in it: the survey's own 5th to 95th
// person. That is the range's width, except where a RULE has widened the range (any less bare neck is normal, a
// jacket's 3 cm, a boot's sole): there the survey's own spread is given last, so 0.08 of a head too much bare neck
// counts as the half a spread it is and not as a fifth of a range that starts at nothing.
const N = (lo, hi, mid, src, spread) => ({ lo, hi, mid, src, spread: spread || hi - lo });
export const NORMAL = {
  f: { nape: N(0, 0.40, 0.2, 'ANSUR, RULE', 0.17), neckSide: N(0, 0.45, 0.25, 'ANSUR', 0.16), neckFront: N(0.10, 0.48, 0.25, 'ANSUR, RULE', 0.21), neckWidth: N(0.427, 0.502, 0.462, 'ANSUR'),
    shoulderDrop: N(0.20, 0.48, 0.36, 'ANSUR, RULE', 0.25), shoulderFall: N(19, 32, 25.7, 'ANSUR'), shoulderWidth: N(1.82, 2.31, 1.99, 'ANSUR, RULE', 0.34),
    heads: N(7.0, 8.1, 7.5, 'ANSUR, CANON', 0.96), headBreadth: N(0.630, 0.703, 0.664, 'ANSUR'), legs: N(0.449, 0.499, 0.473, 'ANSUR'), hips: N(0.504, 0.554, 0.529, 'ANSUR'), knee: N(0.266, 0.297, 0.281, 'ANSUR'),
    arm: N(0.420, 0.470, 0.444, 'ANSUR'), armSplit: N(1.05, 1.37, 1.28, 'ANSUR, RULE', 0.17), fingertips: N(0.30, 0.67, 0.49, 'ANSUR'), fingertipHeight: N(0.349, 0.399, 0.374, 'ANSUR'), hand: N(0.103, 0.118, 0.111, 'ANSUR') },
  m: { nape: N(0, 0.41, 0.2, 'ANSUR, RULE', 0.17), neckSide: N(0, 0.45, 0.25, 'ANSUR', 0.17), neckFront: N(0.10, 0.47, 0.25, 'ANSUR, RULE', 0.21), neckWidth: N(0.479, 0.567, 0.521, 'ANSUR'),
    shoulderDrop: N(0.18, 0.48, 0.35, 'ANSUR, RULE', 0.26), shoulderFall: N(20, 33, 26.4, 'ANSUR'), shoulderWidth: N(1.94, 2.45, 2.12, 'ANSUR, RULE', 0.36),
    heads: N(7.1, 8.15, 7.6, 'ANSUR, CANON', 0.94), headBreadth: N(0.616, 0.694, 0.654, 'ANSUR'), legs: N(0.454, 0.501, 0.477, 'ANSUR'), hips: N(0.507, 0.553, 0.529, 'ANSUR'), knee: N(0.274, 0.302, 0.287, 'ANSUR'),
    arm: N(0.4285, 0.4726, 0.450, 'ANSUR'), armSplit: N(1.05, 1.34, 1.26, 'ANSUR, RULE', 0.16), fingertips: N(0.27, 0.61, 0.45, 'ANSUR'), fingertipHeight: N(0.347, 0.394, 0.372, 'ANSUR'), hand: N(0.104, 0.1175, 0.110, 'ANSUR') },
};
// (each measure: its key, what it is called in the tables, its unit)
export const MEASURES = [
  ['nape', 'Bare neck from behind', 'heads'], ['neckSide', 'Bare neck from the side', 'heads'], ['neckFront', 'Chin down to the collar, front', 'heads'], ['neckWidth', 'Neck at its narrowest', 'heads'],
  ['shoulderDrop', 'Shoulder tops under the chin', 'heads'], ['shoulderFall', 'Shoulders\' fall from the neck', 'degrees'], ['shoulderWidth', 'Shoulder width', 'heads'],
  ['heads', 'Whole height', 'heads'], ['headBreadth', 'Head width', 'of its height'], ['legs', 'Crotch', 'of the height'], ['hips', 'Hip joints', 'of the height'], ['knee', 'Knees', 'of the height'],
  ['arm', 'Arm, shoulder top to fingertips', 'of the height'], ['armSplit', 'Upper arm against forearm', 'ratio'], ['fingertips', 'Fingertips on the thigh', '0 knee, 1 crotch'], ['fingertipHeight', 'Fingertips', 'of the height'], ['hand', 'Hand', 'of the height'],
];
// (a helmet's head is no person's: the measures that lean on the head's size are left out of its count)
const HEADED = ['nape', 'neckSide', 'neckFront', 'neckWidth', 'shoulderDrop', 'shoulderWidth', 'heads', 'headBreadth'];
export function proportionsOf(fig, sex) {
  const H = fig.H, R = NORMAL[sex === 'f' ? 'f' : 'm'], st = fig.stature, v = {};
  v.nape = fig.back ? fig.back.napeBare / H : null; v.neckSide = fig.side ? fig.side.bare / H : null; v.neckFront = fig.front && fig.front.neck != null ? fig.front.neck / H : null;
  v.neckWidth = fig.neckWidthLeast != null ? fig.neckWidthLeast / H : null;
  v.shoulderDrop = fig.shoulders ? (fig.chin[1] - fig.shoulders.topY) / H : null; v.shoulderFall = fig.shoulders ? fig.shoulders.fall : null; v.shoulderWidth = fig.shoulders ? fig.shoulders.width / H : null;
  v.heads = st / H; v.headBreadth = fig.headBreadth / H;
  v.legs = fig.crotchY != null ? (fig.crotchY - fig.floor) / st : null; v.hips = (fig.hipJointY - fig.floor) / st; v.knee = (fig.kneeY - fig.floor) / st;
  v.arm = fig.shoulders && fig.fingertipY != null ? (fig.shoulders.topY - fig.fingertipY) / st : null; v.armSplit = fig.upperArm / fig.forearm;
  v.fingertips = fig.crotchY != null && fig.fingertipY != null ? (fig.fingertipY - fig.kneeY) / (fig.crotchY - fig.kneeY) : null;
  v.fingertipHeight = fig.fingertipY != null ? (fig.fingertipY - fig.floor) / st : null; v.hand = fig.handLength != null ? fig.handLength / st : null;
  const rows = MEASURES.map(([key, label, unit]) => {
    const x = v[key], r = R[key], out = x == null || !Number.isFinite(x) ? 0 : x < r.lo ? (r.lo - x) / r.spread : x > r.hi ? (x - r.hi) / r.spread : 0;
    return { key, label, unit, value: x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000, lo: r.lo, hi: r.hi, mid: r.mid, out: Math.round(out * 100) / 100, side: !out ? '' : x < r.lo ? 'under' : 'over', src: r.src };
  });
  const counted = rows.filter((r) => !(fig.helmet && HEADED.includes(r.key)));
  return { sex: sex === 'f' ? 'f' : 'm', H, helmet: !!fig.helmet, rows, score: Math.round(counted.reduce((s, r) => s + r.out, 0) * 100) / 100, worst: counted.reduce((a, r) => (r.out > (a ? a.out : 0) ? r : a), null) };
}
// a picture by part as a PNG (a data URL): G a figure's kept pictures (figureOf's keep: fig._img), which 'back' |
// 'front' | 'left'; the painted hair laid darker over the skin from behind; lines [[y, colour, label]]: level lines
export function pictureOf(G, which, lines = []) {
  const { w, h } = G, I = G[which], cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), im = g.createImageData(w, h), COL = [[244, 246, 248], [214, 150, 110], [70, 96, 150], [30, 26, 24], [226, 170, 130], [240, 220, 60]];
  for (let i = 0; i < w * h; i++) {
    let c = COL[I[i]];
    if (which === 'back' && G.paint && I[i] === SKIN) { const d = Math.min(1, G.paint[i] / 0.4); c = [c[0] * (1 - d) + 60 * d, c[1] * (1 - d) + 50 * d, c[2] * (1 - d) + 45 * d]; }
    im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  g.font = '13px sans-serif'; g.lineWidth = 1;
  for (const [y, col, label] of lines) { const r = Math.round((G.yHi - y) / G.px) + 0.5; g.strokeStyle = col; g.fillStyle = col; g.beginPath(); g.moveTo(0, r); g.lineTo(w, r); g.stroke(); if (label) g.fillText(label, 6, r - 3); }
  return cv.toDataURL('image/png');
}
