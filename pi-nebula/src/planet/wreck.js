// A CRASHED SHIP, for the rescue runs: one of our own four ships broken across into pieces with jagged breaks, the
// pieces apart on the ground, sunk a little into it and tilted, beside the landing place, in another crew's colours.
// The game's maker (2026-11-20): "can we take one of our ships and break it into parts for a rescue situation? Like
// the people in need broke their ship in half. Maybe we could color it differently." And for the medical runs (MED-1,
// MED-2): you walk down the Medic's ramp to the stasis pods on the ground, by "a crashed ship or a dead camp (start with
// one, build for many)", the pilot setting down beside them with the landing guide.
// Plain numbers, no THREE: the tests run it in node on the ships' own hull data. src/planet/wreckship.js builds the
// ship with the kit (the ships' own builders: nothing of their geometry is copied) and draws the pieces.
//
//   wreckPlan(seed, box, { ship, pieces })   how it broke (each break a jagged surface across the ship) and how each
//                                            piece lies (turned, rolled, its nose down, how deep in the ground)
//   breakApart(soups, plan)                  a ship's triangles (soups: by material, every attribute, no index) into
//                                            its pieces: the triangles along a break cut small and dealt to the side
//                                            they are on, so the break is jagged; each vertex gets aBreak, how far it
//                                            is from the break (the dark edge)
//   wreckSite(land, seed)                    where it lies: beside the landing place's ring, along it, on the
//                                            evenest ground round it
//   settle(parts, land, site, plan)          each piece's place (a matrix): lying on the ground, sunk a little, apart
//                                            from the others, none of it on the landing place
//   clearUnder(land, pieces)                 no trees, rocks or plants under the pieces (the land's trees and its
//                                            landing mark, which the cover keeps clear: src/planet/cover.js)
//   PAINTS, recolour(colors, paint)          another crew's colours: our ships' light skin and yellow turned to theirs
//   WRECK_SHIPS, shipFor(seed)               the four, and which one a seed gives
//   wreckFor(seed)                           each rescue's wreck, all three from the planet's seed: { ship (of the
//                                            four), paint (of the three), pieces (2 or 3) }; the game's maker
//                                            (WRECK1-1 C, WRECK1-2 D, WRECK1-3 C): "Randomness is good"
import { rng, subSeed } from './noise.js';
import { wrapD } from './land.js';

export const WRECK_SHIPS = ['miner', 'explorer', 'medic', 'hauler'];
export const shipFor = (seed) => WRECK_SHIPS[Math.floor(rng(subSeed(seed, 'wreck ship'))() * WRECK_SHIPS.length)];
// (each its own draw from the seed, so the ship, the colours and the pieces don't go together)
export const paintFor = (seed) => PAINT_IDS[Math.floor(rng(subSeed(seed, 'wreck paint'))() * PAINT_IDS.length)];
export const piecesFor = (seed) => (rng(subSeed(seed, 'wreck pieces'))() < 0.5 ? 2 : 3);
export const wreckFor = (seed) => ({ ship: shipFor(seed), paint: paintFor(seed), pieces: piecesFor(seed) });
export const WRECK = {
  ring: 6,                 // metres from the ring (the landing place's level ground) to the site's near side
  across: 10, along: 18,   // the site's half sizes (metres): across the ship and along it
  cut: 0.16,               // where it breaks (one break): within this share of its length either side of its middle
  // the break's teeth: big ones round the hull (how many, how deep, metres), small ones on top, and a row of them out
  // along anything that sticks out (a wing, an arm)
  teeth: { big: [5, 8], bigAmp: [0.6, 1.0], small: [10, 15], smallAmp: [0.15, 0.25], out: [1.0, 1.5], outAmp: [0.2, 0.32] },
  edge: 0.5,               // the break's finest step: triangles along it are cut down to this (metres), then cut along it
  sink: [0.3, 0.6],        // how deep the lowest point of a piece is in the ground (metres)
  apart: 1.0,              // the least gap between two pieces (metres)
  tilt: 0.3,               // the most a piece leans with the ground under it (radians)
  settle: 0.35,            // the most a piece turns as it comes to rest on the ground, each of two turns (radians)
  // and then it does not balance on an edge or a corner: its middle is over what it touches by `stand` metres, else it
  // topples over the edge it hangs past (each fall no more than `fall` radians, at most `falls` of them)
  stand: 0.3, fall: 0.2, falls: 16, lean: 45 * Math.PI / 180, touch: 0.2, dig: 0.6,
};
// where each ship breaks (its own frame, z metres, nose +z; each break's teeth reach up to 1.6 m nose-ward of it), in
// two pieces or in three: [where, how far either way it may be], kept off the canopy and the engines; the Miner's
// between its canisters and its folded arms, the Hauler's in the gap between its front and rear containers (measured
// on the built ships: ~/pw/space-math/rigs/wreck-1/probe2.log)
export const CUT_AT = {
  explorer: { 2: [[-0.6, 1.6]], 3: [[-3.4, 0.6], [1.2, 0.5]] },
  miner: { 2: [[0.1, 0.3]], 3: [[-6.0, 0.2], [0.1, 0.3]] },
  medic: { 2: [[-0.6, 1.4]], 3: [[-4.6, 0.5], [1.5, 0.4]] },
  hauler: { 2: [[-2.05, 0.15]], 3: [[-6.6, 0.3], [-2.05, 0.15]] },
};

// ── little matrices: 16 numbers, column by column (as THREE's) ──────────────────────────────────────────────────
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
const tr = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };
const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
function axisAngle(x, y, z, a) {
  const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0, t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1];
}
export const apply = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

// ── THE PLAN: how it broke, and how each piece lies ──────────────────────────────────────────────────────────────
const between = (R, [a, b]) => a + (b - a) * R();
const sign = (R) => (R() < 0.5 ? -1 : 1);
// a row of teeth: k of them round (or along), each its own height and its peak somewhere in it
function teeth(R, k, amp) { k = Math.round(k); const h = [], p = []; for (let i = 0; i < k; i++) { h.push(0.35 + 0.65 * R()); p.push(0.25 + 0.5 * R()); } return { k, amp, phase: R() * k, h, p }; }
// box: the ship's box in its own frame { min: [x, y, z], max: [x, y, z] }; pieces: 2 (in half) or 3
export function wreckPlan(seed, box, { ship = null, pieces = 2 } = {}) {
  pieces = pieces >= 3 ? 3 : 2;
  const R = rng(subSeed(seed, `wreck ${ship} ${pieces}`)), T = WRECK.teeth;
  const len = box.max[2] - box.min[2], mid = (box.min[2] + box.max[2]) / 2;
  const yc = box.min[1] + (box.max[1] - box.min[1]) * 0.55;
  // (the ship's own places to break, or (a ship this does not know) near the middle, or a fifth of the way from each end)
  const at = (CUT_AT[ship] && CUT_AT[ship][pieces]) || (pieces === 3 ? [[mid - 0.2 * len, 0.03 * len], [mid + 0.17 * len, 0.03 * len]] : [[mid, WRECK.cut * len]]);
  const cuts = at.map(([where, wander]) => {
    const z = where + (R() - 0.5) * 2 * wander;
    const big = teeth(R, between(R, T.big), between(R, T.bigAmp)), small = teeth(R, between(R, T.small), between(R, T.smallAmp));
    const out = { ...teeth(R, 9, between(R, T.outAmp)), step: between(R, T.out) };
    return { z, sx: (R() - 0.5) * 0.36, sy: (R() - 0.5) * 0.3, yc, big, small, out, amp: big.amp + small.amp + out.amp };
  });
  // each piece, from the stern: which way it is turned (yaw), rolled onto a side (roll), its nose down (pitch), how
  // far it slid out sideways (metres), how deep it is sunk; the stern piece moved least, the nose piece most
  const s = sign(R), n = cuts.length + 1;
  const poses = [];
  for (let k = 0; k < n; k++) {
    const nose = k === n - 1, stern = k === 0, middle = !nose && !stern;
    poses.push({
      yaw: stern ? s * between(R, [0.06, 0.18]) : middle ? -s * between(R, [0.3, 0.6]) : (n === 2 ? -s : s) * between(R, [0.38, 0.7]),
      roll: sign(R) * (stern ? between(R, [0.1, 0.26]) : middle ? between(R, [0.4, 0.75]) : between(R, [0.14, 0.36])),
      pitch: nose ? between(R, [0.03, 0.08]) : (R() - 0.5) * 0.06,
      side: stern ? (R() - 0.5) * 1.2 : sign(R) * between(R, [2, 4.5]),
      sink: between(R, WRECK.sink) + (nose ? 0.15 : 0),
    });
  }
  // (how far apart along the ship the pieces' places start: moved further apart if any two come nearer than WRECK.apart)
  const gap = between(R, [3.5, 6]);
  return { seed, ship, pieces: n, cuts, poses, gap, box };
}

// how far a point is past a break (metres along the ship; > 0: on the nose's side of it), with its teeth (jag: 0 to
// the break's amp, pushed toward the nose): big and small ones round the hull, and out along anything that sticks out
// past its sides (a wing, an arm, a canister: by how far out it is, from 1.2 m out)
const tooth = (T, u0) => { const u = u0 + T.phase, i = Math.floor(u), fr = u - i, ii = ((i % T.k) + T.k) % T.k, p = T.p[ii]; return T.amp * T.h[ii] * (fr < p ? fr / p : (1 - fr) / (1 - p)); };
function jag(C, x, y) {
  const t = Math.atan2(y - C.yc, x) / (2 * Math.PI) + 0.5, ax = Math.abs(x), out = Math.min(1, Math.max(0, ax - 1.2));
  return tooth(C.big, t * C.big.k) + tooth(C.small, t * C.small.k) + (out > 0 ? out * tooth(C.out, ax / C.out.step + (x < 0 ? 4.5 : 0)) : 0);
}
const base = (C, x, y, z) => z - (C.z + C.sx * x + C.sy * (y - C.yc));
export const pastBreak = (C, x, y, z) => base(C, x, y, z) - jag(C, x, y);
// which piece a point is in: how many breaks it is past
export function pieceAt(plan, x, y, z) { let k = 0; for (const C of plan.cuts) if (pastBreak(C, x, y, z) > 0) k++; return k; }

// ── BREAKING IT APART ────────────────────────────────────────────────────────────────────────────────────────────
// soups: { [material]: { [attribute]: { size, array } } } (each three vertices one triangle; 'position' in every one,
// 'normal' kept a unit length where triangles are cut). Returns { pieces: [{ [material]: { [attribute]: { size,
// array } } }] (each with 'aBreak', size 1), stats { trisIn, tris: [per piece], cut (triangles cut small), ms } }.
export function breakApart(soups, plan) {
  const t0 = Date.now(), n = plan.cuts.length + 1, pieces = Array.from({ length: n }, () => ({})), stats = { trisIn: 0, tris: new Array(n).fill(0), cut: 0, ms: 0 };
  // (a triangle along a break is cut in four until it is WRECK.edge long, unless it is all on one side (tried at points
  // across it agreeE apart, closer than a tooth is wide): then it goes whole; at the smallest, it is cut along the break)
  const minE = WRECK.edge, agreeE = 0.5;
  for (const [mat, S] of Object.entries(soups)) {
    const names = Object.keys(S), sizes = names.map((a) => S[a].size), offs = [];
    let stride = 0; for (const z of sizes) { offs.push(stride); stride += z; }
    const nOff = names.includes('normal') ? offs[names.indexOf('normal')] : -1, P = S.position.array, nv = P.length / 3;
    const out = Array.from({ length: n }, () => []);
    const vert = (k) => { const v = new Float64Array(stride); for (let a = 0; a < names.length; a++) { const A = S[names[a]].array, z = sizes[a]; for (let c = 0; c < z; c++) v[offs[a] + c] = A[k * z + c]; } return v; };
    const mid = (a, b) => { const v = new Float64Array(stride); for (let c = 0; c < stride; c++) v[c] = (a[c] + b[c]) * 0.5; if (nOff >= 0) { const l = Math.hypot(v[nOff], v[nOff + 1], v[nOff + 2]) || 1; v[nOff] /= l; v[nOff + 1] /= l; v[nOff + 2] /= l; } return v; };
    // (positions are the first three of 'position' in the stride)
    const pO = offs[names.indexOf('position')];
    const gap = (v) => { let m = 9; for (const C of plan.cuts) m = Math.min(m, Math.abs(pastBreak(C, v[pO], v[pO + 1], v[pO + 2]))); return m; };
    const emit = (k, A, B, C) => { const o = out[k]; for (const v of [A, B, C]) { for (let c = 0; c < stride; c++) o.push(v[c]); o.push(gap(v)); } stats.tris[k]++; };
    const at = (v) => pieceAt(plan, v[pO], v[pO + 1], v[pO + 2]);
    const longest = (A, B, C) => Math.max(dist(A, B, pO), dist(B, C, pO), dist(C, A, pO));
    const lerp = (a, b, t) => { const v = new Float64Array(stride); for (let c = 0; c < stride; c++) v[c] = a[c] + (b[c] - a[c]) * t; if (nOff >= 0) { const l = Math.hypot(v[nOff], v[nOff + 1], v[nOff + 2]) || 1; v[nOff] /= l; v[nOff + 1] /= l; v[nOff + 2] /= l; } return v; };
    // the smallest: cut along the break itself (where it crosses each side, between the corners), each part to its piece
    function leaf(A, B, C) {
      const V = [A, B, C], ks = V.map(at), lo = Math.min(...ks), hi = Math.max(...ks);
      if (lo === hi) { emit(lo, A, B, C); return; }
      if (hi - lo > 1) { const m = [0, 1, 2].map((c) => (A[pO + c] + B[pO + c] + C[pO + c]) / 3); emit(pieceAt(plan, m[0], m[1], m[2]), A, B, C); return; }
      const cut = plan.cuts[lo], f = V.map((v) => pastBreak(cut, v[pO], v[pO + 1], v[pO + 2])), pos = [], neg = [];
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3; (f[i] > 0 ? pos : neg).push(V[i]);
        if ((f[i] > 0) !== (f[j] > 0)) { const X = lerp(V[i], V[j], f[i] / (f[i] - f[j])); pos.push(X); neg.push(X); }
      }
      for (let i = 1; i + 1 < pos.length; i++) emit(lo + 1, pos[0], pos[i], pos[i + 1]);
      for (let i = 1; i + 1 < neg.length; i++) emit(lo, neg[0], neg[i], neg[i + 1]);
    }
    // (all on one side: tried at points across it no more than `agreeE` apart, so no tooth fits between them)
    function oneSide(A, B, C, L) {
      const n = Math.max(1, Math.ceil(L / agreeE)), k = at(A);
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        if (pieceAt(plan, A[pO] * w + B[pO] * u + C[pO] * v, A[pO + 1] * w + B[pO + 1] * u + C[pO + 1] * v, A[pO + 2] * w + B[pO + 2] * u + C[pO + 2] * v) !== k) return -1;
      }
      return k;
    }
    // (halved across its longest side each time, so a long thin triangle is cut only where the break crosses it)
    function split(A, B, C, depth) {
      const L = longest(A, B, C), k = oneSide(A, B, C, L);
      if (k >= 0) { emit(k, A, B, C); return; }
      if (L <= minE || depth >= 24) { leaf(A, B, C); return; }
      const ab = dist(A, B, pO), bc = dist(B, C, pO), ca = dist(C, A, pO);
      if (ab >= bc && ab >= ca) { const M = mid(A, B); split(A, M, C, depth + 1); split(M, B, C, depth + 1); }
      else if (bc >= ca) { const M = mid(B, C); split(B, M, A, depth + 1); split(M, C, A, depth + 1); }
      else { const M = mid(C, A); split(C, M, B, depth + 1); split(M, A, B, depth + 1); }
    }
    for (let t = 0; t < nv; t += 3) {
      stats.trisIn++;
      // (wholly on one side of every break, by the break's plane and its teeth' depth: as it is)
      let k = 0, near = false;
      for (const C of plan.cuts) {
        let lo = Infinity, hi = -Infinity;
        for (let v = t; v < t + 3; v++) { const f = base(C, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); lo = Math.min(lo, f); hi = Math.max(hi, f); }
        if (lo > C.amp) k++; else if (hi >= 0) { near = true; break; }
      }
      if (!near) { emit(k, vert(t), vert(t + 1), vert(t + 2)); continue; }
      stats.cut++;
      split(vert(t), vert(t + 1), vert(t + 2), 0);
    }
    // the soups apart again, by attribute
    for (let k = 0; k < n; k++) {
      const o = out[k], cnt = o.length / (stride + 1); if (!cnt) continue;
      const M = {};
      names.forEach((a, i) => { const z = sizes[i], arr = new Float32Array(cnt * z); for (let v = 0; v < cnt; v++) for (let c = 0; c < z; c++) arr[v * z + c] = o[v * (stride + 1) + offs[i] + c]; M[a] = { size: z, array: arr }; });
      const g = new Float32Array(cnt); for (let v = 0; v < cnt; v++) g[v] = o[v * (stride + 1) + stride];
      M.aBreak = { size: 1, array: g };
      pieces[k][mat] = M;
    }
  }
  stats.ms = Date.now() - t0;
  return { pieces, stats };
}
const dist = (a, b, o) => Math.hypot(a[o] - b[o], a[o + 1] - b[o + 1], a[o + 2] - b[o + 2]);

// ── WHERE IT LIES ────────────────────────────────────────────────────────────────────────────────────────────────
// a point of the site's frame (u across the ship, v along it, metres) on the ground
const siteAt = (S, u, v) => [S.x + u * Math.cos(S.yaw) + v * Math.sin(S.yaw), S.z - u * Math.sin(S.yaw) + v * Math.cos(S.yaw)];
// Beside the landing place's ring, along it (so a ship set down in the ring has it alongside): of sixteen places round
// the ring, the one where the ground is evenest, least steep and has the fewest trees; its nose either way.
export function wreckSite(land, seed = land.seed) {
  const R = rng(subSeed(seed, 'wreck site')), L = land.landing, n = 16, a0 = R() * Math.PI * 2, dist = L.flat + WRECK.ring + WRECK.across;
  const tr0 = land.trees || [], nt = tr0.length / 6;
  let best = null;
  for (let j = 0; j < n; j++) {
    const a = a0 + (j * 2 * Math.PI) / n, S = { x: L.x + Math.sin(a) * dist, z: L.z + Math.cos(a) * dist, yaw: a + Math.PI / 2 };
    let s = 0, s2 = 0, c = 0, steep = 0;
    for (let u = -WRECK.across; u <= WRECK.across; u += 2.5) for (let v = -WRECK.along; v <= WRECK.along; v += 3) {
      const [x, z] = siteAt(S, u, v), h = land.heightAt(x, z); s += h; s2 += h * h; c++;
      steep = Math.max(steep, land.slopeAt(x, z));
    }
    const spread = Math.sqrt(Math.max(0, s2 / c - (s / c) ** 2));
    let trees = 0;
    for (let k = 0; k < nt; k++) { const dx = wrapD(tr0[k * 6] - S.x), dz = wrapD(tr0[k * 6 + 2] - S.z); if (Math.abs(dx) < 30 && Math.abs(dz) < 30) trees++; }
    const score = spread + steep * 0.08 + trees * 0.05;
    if (!best || score < best.score) best = { ...S, a, score, spread: +spread.toFixed(2), steep: +steep.toFixed(1), trees };
  }
  // (its nose either way along the ring, and turned a little across it)
  best.yaw += (R() - 0.5) * 0.5 + (R() < 0.5 ? Math.PI : 0);
  best.dist = dist; best.y = land.heightAt(best.x, best.z);
  return best;
}

// Each piece's place: parts [{ pts (Float32Array x, y, z: its points in the ship's frame), pivot [x, y, z] }] (from the
// stern). Each is turned and rolled about its own middle as the plan says, set where the whole ship would have lain on
// the site (its middle over the site's), slid apart along the ship until the pieces are WRECK.apart from each other,
// leant with the ground under it (no more than WRECK.tilt), and lowered until its lowest point is the plan's sink
// under the ground. No point of any piece is on the landing place's level ground (the site moves out if one would be).
// Returns { mats: [16 numbers each], gap (metres between the pieces' places along the ship), site, low: [per piece:
// its lowest point's height over the ground] }
export function settle(parts, land, site, plan) {
  const L = land.landing, B = plan.box, cz = (B.min[2] + B.max[2]) / 2, cx = (B.min[0] + B.max[0]) / 2;
  const S = { ...site }, n = parts.length;
  // (samples of each piece's points: a few hundred for the gaps between them and its footprint, a few thousand for
  // its lowest point while the pieces are being moved apart; every point for the last placing)
  const every = (p, most) => { const out = [], m = p.pts.length / 3, step = Math.max(1, Math.floor(m / most)); for (let i = 0; i < m; i += step) out.push(p.pts[i * 3], p.pts[i * 3 + 1], p.pts[i * 3 + 2]); return out; };
  const sample = parts.map((p) => every(p, 500)), many = parts.map((p) => every(p, 4000));
  // COMING TO REST, as a dropped piece does: tipped toward its middle about its lowest point until a second point
  // touches, then about the line through those two until a third does (each turn no more than WRECK.settle), so it lies
  // on the ground rather than on a wing's tip or one corner; what is left of its roll and nose-down is the crash's
  const rest = (M, k) => {
    const s = many[k], piv = parts[k].pivot; let i2 = -1;
    for (let step = 0; step < 2; step++) {
      const W = [], d = []; for (let i = 0; i < s.length; i += 3) { const w = apply(M, s[i], s[i + 1], s[i + 2]); W.push(w); d.push(w[1] - land.heightAt(w[0], w[2])); }
      let i1 = 0; for (let i = 1; i < d.length; i++) if (d[i] < d[i1]) i1 = i;
      const P1 = W[i1], c = apply(M, piv[0], piv[1], piv[2]);
      let hx = c[0] - P1[0], hz = c[2] - P1[2];
      if (step === 1) { if (i2 < 0) break; const lx = W[i2][0] - P1[0], lz = W[i2][2] - P1[2], ll = Math.hypot(lx, lz); if (ll < 0.3) break; const t = (hx * lx + hz * lz) / (ll * ll); hx -= t * lx; hz -= t * lz; }
      const hl = Math.hypot(hx, hz); if (hl < 0.15) break; hx /= hl; hz /= hl;
      let phi = Infinity, nx = -1;
      for (let i = 0; i < W.length; i++) { const sd = (W[i][0] - P1[0]) * hx + (W[i][2] - P1[2]) * hz; if (sd < 0.5) continue; const f = (d[i] - d[i1]) / sd; if (f < phi) { phi = f; nx = i; } }
      if (nx < 0) break;
      if (step === 0) i2 = nx;
      phi = Math.min(phi, WRECK.settle); if (phi < 1e-4) continue;
      M = mul(tr(P1[0], P1[1], P1[2]), mul(axisAngle(hz, 0, -hx, phi), mul(tr(-P1[0], -P1[1], -P1[2]), M)));
    }
    return M;
  };
  // NOT BALANCED ON AN EDGE (two critics saw a piece of the wreck hang in the air: it stood on one corner): what it
  // touches (its points within 20 cm of its lowest, against the ground under each), and its middle over that; past an
  // edge of it, it falls over that edge, about the line through the edge's two points, until another point touches
  const standing = (M, k, band) => {
    const s = many[k], W = [], d = []; let cx = 0, cz = 0;
    for (let i = 0; i < s.length; i += 3) { const w = apply(M, s[i], s[i + 1], s[i + 2]); W.push(w); d.push(w[1] - land.heightAt(w[0], w[2])); cx += w[0]; cz += w[2]; }
    cx /= W.length; cz /= W.length;
    const lo = Math.min(...d), H = hull2(W.filter((w, i) => d[i] < lo + band).map((w) => [w[0], w[2]]));
    if (H.length < 3) return -Infinity;
    let m = Infinity; for (let e = 0; e < H.length; e++) { const a = H[e], b = H[(e + 1) % H.length], ex = b[0] - a[0], ez = b[1] - a[1]; m = Math.min(m, (ex * (cz - a[1]) - ez * (cx - a[0])) / (Math.hypot(ex, ez) || 1)); }
    return m;
  };
  const deeper = [];
  const topple = (M, k) => {
    const s = many[k]; let backing = false;
    for (let f = 0; f < WRECK.falls; f++) {
      const W = [], d = []; let cx = 0, cz = 0;
      for (let i = 0; i < s.length; i += 3) { const w = apply(M, s[i], s[i + 1], s[i + 2]); W.push(w); d.push(w[1] - land.heightAt(w[0], w[2])); cx += w[0]; cz += w[2]; }
      cx /= W.length; cz /= W.length;
      const lo = Math.min(...d), touch = []; for (let i = 0; i < W.length; i++) if (d[i] < lo + WRECK.touch) touch.push(i);
      const H = hull2(touch.map((i) => [W[i][0], W[i][2], i]));
      // (the edge its middle is furthest past, or nearest inside of)
      let worst = Infinity, edge = null;
      if (H.length < 3) { const a = H[0], b = H[H.length - 1]; edge = [a, b]; worst = -1; }
      else for (let e = 0; e < H.length; e++) { const a = H[e], b = H[(e + 1) % H.length], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1, m = (ex * (cz - a[1]) - ez * (cx - a[0])) / l; if (m < worst) { worst = m; edge = [a, b]; } }
      if (worst >= WRECK.stand) break;
      const A = W[edge[0][2]], B = W[edge[1][2]];
      let lx = B[0] - A[0], lz = B[2] - A[2], ll = Math.hypot(lx, lz);
      // (one point, or two on top of each other: it falls toward its middle about a line across that way)
      let hx, hz;
      if (ll < 0.3) { hx = cx - A[0]; hz = cz - A[2]; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl; lx = -hz; lz = hx; ll = 1; }
      else { lx /= ll; lz /= ll; hx = -lz; hz = lx; if (hx * (cx - A[0]) + hz * (cz - A[2]) < 0) { hx = -hx; hz = -hz; } }
      // (turned down on the middle's side until the next point there touches)
      const dl = (i) => d[edge[0][2]] + 0;
      let phi = Infinity; for (let i = 0; i < W.length; i++) { const sd = (W[i][0] - A[0]) * hx + (W[i][2] - A[2]) * hz; if (sd < 0.3) continue; const q = (d[i] - dl(i)) / sd; if (q < phi) phi = q; }
      if (!isFinite(phi)) break;
      phi = Math.max(0.02, Math.min(phi, WRECK.fall));
      const N = mul(tr(A[0], A[1], A[2]), mul(axisAngle(hz, 0, -hx, phi), mul(tr(-A[0], -A[1], -A[2]), M)));
      // (never over onto its back or its side: past WRECK.lean it rolls back toward upright instead, about its own length,
      // as if the crash had rolled it less)
      if (!backing && leanOf(N) <= WRECK.lean) { M = N; continue; }
      backing = true;
      const ul = Math.hypot(M[4], M[5], M[6]), lean = leanOf(M); if (lean < 0.01) break;
      M = mul(tr(cx, 0, cz), mul(axisAngle(-M[6] / ul, 0, M[4] / ul, Math.min(WRECK.fall, lean)), mul(tr(-cx, 0, -cz), M)));
    }
    return M;
  };
  const place = (gap, full) => parts.map((p, k) => {
    const P = plan.poses[k], [px, py, pz] = p.pivot, along = (k - (n - 1) / 2) * gap;
    // in the ship's frame: turned about its middle, slid; then onto the site
    const local = mul(tr(px + P.side, py, pz + along), mul(rotY(P.yaw), mul(rotX(P.pitch), mul(rotZ(P.roll), tr(-px, -py, -pz)))));
    let M = mul(tr(S.x, 0, S.z), mul(rotY(S.yaw), mul(tr(-cx, 0, -cz), local)));
    // leant with the ground under it: the plane through the ground's heights over where it lies
    const w = apply(M, px, py, pz), sp = sample[k];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < sp.length; i += 3) { const q = apply(M, sp[i], sp[i + 1], sp[i + 2]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
    const nrm = groundPlane(land, x0, x1, z0, z1), ang = Math.min(WRECK.tilt, Math.acos(Math.min(1, nrm[1])));
    if (ang > 1e-4) M = mul(tr(w[0], w[1], w[2]), mul(axisAngle(nrm[2], 0, -nrm[0], ang), mul(tr(-w[0], -w[1], -w[2]), M)));
    M = topple(rest(M, k), k);
    // lowered: its lowest point (against the ground under each point) the plan's sink in the ground, and deeper still
    // if what it would rest on is not under its middle even so (dug in rather than balanced: up to WRECK.dig more)
    let low = Infinity; const pts = full ? p.pts : many[k];
    for (let i = 0; i < pts.length; i += 3) { const q = apply(M, pts[i], pts[i + 1], pts[i + 2]), d = q[1] - land.heightAt(q[0], q[2]); if (d < low) low = d; }
    let e = 0; while (e < WRECK.dig && standing(M, k, WRECK.touch + e) < WRECK.stand) e += 0.05;
    deeper[k] = +e.toFixed(2);
    return mul(tr(0, -low - P.sink - e, 0), M);
  });
  const pointsOf = (M, k) => { const s = sample[k], out = []; for (let i = 0; i < s.length; i += 3) out.push(apply(M, s[i], s[i + 1], s[i + 2])); return out; };
  let gap = plan.gap || 3, mats = null;
  for (let tries = 0; tries < 60; tries++) {
    mats = place(gap, false);
    const W = mats.map((M, k) => pointsOf(M, k));
    // (apart: the least distance between two pieces' points)
    let near = Infinity;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (const p of W[a]) for (const q of W[b]) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < near) near = d; }
    // (off the landing place: the nearest point to its middle, across the ground)
    let inner = Infinity; for (const P of W) for (const p of P) inner = Math.min(inner, Math.hypot(wrapD(p[0] - L.x), wrapD(p[2] - L.z)));
    if (inner < L.flat + 2) { const out = L.flat + 2 - inner + 0.5; S.x += Math.sin(S.a) * out; S.z += Math.cos(S.a) * out; S.dist += out; continue; }
    if (Math.sqrt(near) >= WRECK.apart) break;
    gap += 0.5;
  }
  mats = place(gap, true);
  const low = mats.map((M, k) => { let lo = Infinity; const pts = parts[k].pts; for (let i = 0; i < pts.length; i += 3) { const q = apply(M, pts[i], pts[i + 1], pts[i + 2]); lo = Math.min(lo, q[1] - land.heightAt(q[0], q[2])); } return +lo.toFixed(3); });
  S.y = land.heightAt(S.x, S.z);
  return { mats, gap, site: S, low, deeper: deeper.slice() };
}
// how far a piece's own up leans from the sky's (radians)
const leanOf = (M) => Math.acos(Math.min(1, M[5] / Math.hypot(M[4], M[5], M[6])));
// the convex hull of points [x, z, ...] (anticlockwise seen from above, as x right and z toward the eye)
function hull2(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// the ground's facing over a box, by the plane through its heights there (least squares, a sample every 2 m or so)
function groundPlane(land, x0, x1, z0, z1) {
  const nx = Math.max(2, Math.min(12, Math.ceil((x1 - x0) / 2))), nz = Math.max(2, Math.min(12, Math.ceil((z1 - z0) / 2)));
  let sx = 0, sz = 0, sh = 0, sxx = 0, szz = 0, sxz = 0, sxh = 0, szh = 0, c = 0;
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const x = x0 + ((x1 - x0) * i) / nx - mx, z = z0 + ((z1 - z0) * j) / nz - mz, h = land.heightAt(x + mx, z + mz);
    sx += x; sz += z; sh += h; sxx += x * x; szz += z * z; sxz += x * z; sxh += x * h; szh += z * h; c++;
  }
  // h = a x + b z + c, centred (sx, sz are 0)
  const det = sxx * szz - sxz * sxz; if (Math.abs(det) < 1e-9) return [0, 1, 0];
  const hm = sh / c, a = ((sxh - sx * hm) * szz - (szh - sz * hm) * sxz) / det, b = ((szh - sz * hm) * sxx - (sxh - sx * hm) * sxz) / det;
  const l = Math.hypot(a, 1, b);
  return [-a / l, 1 / l, -b / l];
}

// ── NOTHING GROWS UNDER IT ───────────────────────────────────────────────────────────────────────────────────────
// The ground under the pieces (their triangles laid flat, each with `margin` metres round it) is marked as the landing
// place is (land.EX's landing channel: the cover leaves anything there out, src/planet/cover.js CLEAR), and the trees
// whose trunks stand there or within `trunk` metres of it are taken out of land.trees (before the planet is drawn:
// src/planet/trees.js reads them then). pieces: [{ tris: Float32Array of triangle corners (x, y, z) in the world }].
// Returns { cells, trees } (how many ground samples were marked, how many trees taken out).
export function clearUnder(land, pieces, { margin = 1.5, trunk = 2.5 } = {}) {
  const { N, EX } = land, P = land.width, T = P / N, m = N - 1, mark = new Uint8Array(N * N);
  let cells = 0;
  const cell = (x) => Math.floor((x + P / 2) / T);
  for (const pc of pieces) {
    const A = pc.tris;
    for (let t = 0; t < A.length; t += 9) {
      const x0 = Math.min(A[t], A[t + 3], A[t + 6]) - margin, x1 = Math.max(A[t], A[t + 3], A[t + 6]) + margin;
      const z0 = Math.min(A[t + 2], A[t + 5], A[t + 8]) - margin, z1 = Math.max(A[t + 2], A[t + 5], A[t + 8]) + margin;
      for (let j = cell(z0); j <= cell(z1) + 1; j++) for (let i = cell(x0); i <= cell(x1) + 1; i++) { const k = (j & m) * N + (i & m); if (!mark[k]) { mark[k] = 1; cells++; } }
    }
  }
  for (let k = 0; k < N * N; k++) if (mark[k]) EX[k * 4 + 1] = 255;
  let gone = 0;
  if (land.trees && land.trees.length) {
    const A = land.trees, keep = [], r = Math.ceil(trunk / T);
    for (let k = 0; k < A.length; k += 6) {
      const i0 = cell(A[k]), j0 = cell(A[k + 2]);
      let hit = false; for (let dj = -r; dj <= r && !hit; dj++) for (let di = -r; di <= r && !hit; di++) if (mark[((j0 + dj) & m) * N + ((i0 + di) & m)]) hit = true;
      if (hit) gone++; else for (let c = 0; c < 6; c++) keep.push(A[k + c]);
    }
    if (gone) land.trees = Float32Array.from(keep);
  }
  return { cells, trees: gone };
}

// ── ANOTHER CREW'S COLOURS ───────────────────────────────────────────────────────────────────────────────────────
// Our ships are a light skin (white to cream), graphite, black and yellow accents (each ship's PAL). A wreck from a
// crew that isn't ours: the light skin turned to their skin colour, the yellow to their accent, the greys a shade
// toward their own (dark: a multiplier, r g b). Colours as #rrggbb (the screen's), worked in the screen's numbers.
export const PAINTS = {
  rust: { name: 'Rust red', skin: '#6b2b21', accent: '#cfc6b2', dark: [1.04, 0.98, 0.96], about: 'an oxide red skin, bone-white stripes' },
  olive: { name: 'Olive drab', skin: '#4a5133', accent: '#c25f1b', dark: [1.0, 1.0, 0.92], about: 'an army olive skin, orange stripes' },
  slate: { name: 'Slate blue', skin: '#2a3d51', accent: '#d6d3c8', dark: [0.94, 0.98, 1.06], about: 'a dark steel-blue skin, white stripes' },
};
export const PAINT_IDS = Object.keys(PAINTS);
const toScreen = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
// a colour (the screen's numbers) as hue (degrees), saturation and lightness
export function hslOf([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
// which of our ships' paints a colour is: 'skin' (light, hardly coloured), 'accent' (the yellow), or null (the rest)
export function paintClass(rgb) {
  const [h, s, l] = hslOf(rgb);
  if (l > 0.6 && s < 0.42) return 'skin';
  if (s > 0.5 && h >= 28 && h <= 62 && l > 0.3) return 'accent';
  return null;
}
// colors: linear r, g, b floats (as the kit's vertex colours are), size 3 or 4 (stride); into `out` (default: a copy)
export function recolour(colors, paintId, { stride = 3, out = null } = {}) {
  const Pn = PAINTS[paintId]; const o = out || new Float32Array(colors.length);
  if (o !== colors) o.set(colors);
  if (!Pn) return o;
  const skin = hex(Pn.skin), acc = hex(Pn.accent), dark = Pn.dark || [1, 1, 1];
  for (let i = 0; i < colors.length; i += stride) {
    const c = [toScreen(colors[i]), toScreen(colors[i + 1]), toScreen(colors[i + 2])], k = paintClass(c);
    let q;
    if (k === 'skin') { const f = Math.min(1.15, hslOf(c)[2] / 0.82); q = skin.map((v) => Math.min(1, v * f)); }
    else if (k === 'accent') { const f = Math.min(1.15, hslOf(c)[2] / 0.5); q = acc.map((v) => Math.min(1, v * f)); }
    else q = c.map((v, j) => Math.min(1, v * dark[j]));
    o[i] = toLinear(q[0]); o[i + 1] = toLinear(q[1]); o[i + 2] = toLinear(q[2]);
  }
  return o;
}
// (for the tests and the notes: a short fingerprint of numbers)
export function fingerprint(arrays) {
  let h = 2166136261;
  for (const A of arrays) { const u = new Uint8Array(A.buffer, A.byteOffset, A.byteLength); for (let k = 0; k < u.length; k += 5) { h ^= u[k]; h = Math.imul(h, 16777619); } }
  return h >>> 0;
}
