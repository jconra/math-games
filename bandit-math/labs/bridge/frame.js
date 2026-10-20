// THE BRIDGE TEST IN THREE DIMENSIONS: the whole bridge as one frame of free boards, standing on the two stone
// abutments, with weight rolling across its deck. Plain numbers, no three.js: node runs it for the tests and rigs, and
// the page runs it in a worker (cross-worker.js).
//
// It is the windmill lab's frame (labs/windmill/frame.js) with gravity instead of wind. From there, unchanged: the wood
// and the nails (WOOD, NAILS), how a board's wide face is laid (prepBoards: a board that is not straight up has its wide
// side up and down; a post faces across its side of the bridge), where boards touch and the kinds of joint (face to
// face, end to end, toe-nailed), how much of its strength a joint's nails are using (nailUse), the beam pieces and the
// banded solver (toWorld, rcm, makeEnvelope, factor, solveEnv). What is the bridge's own, and why:
//   * THE BANKS hold it up, not footing stones. A board lying across a bank's edge bears right at the edge (it tips
//     about it); a board's end on a bank's top, or pushed against an abutment's stone face, rests there (bridge.js
//     supportsOf). The stone pushes back square to its surface, stiffly, and only pushes: where a board would pull away
//     it lifts off (the support lets go, and the sums are done again without it). Along the surface, only friction holds
//     (half of what presses it there, and a few pounds of grip): a strut's foot on the flat top slides, the same strut
//     pushed into the face holds.
//   * A board's foot standing on a horizontal board IN THE SAME SIDE (a post or a diagonal on the bottom board of a
//     truss) is lapped and face-nailed, not toe-nailed as the windmill takes it: in a truss the boards of a side are
//     nailed through their faces. A board's end on a board it does not lie face to face with (a deck plank on the bottom
//     boards, a cross piece on the side of the top board) is toe-nailed, as in the windmill.
//   * DECK PLANKS (2 by 8 inches, laid flat) are boards in the frame like any other, with their own size and strength;
//     they rest on the two bottom-board lines and bear on them for nothing when pressed down; they touch nothing else.
//   * THE LOAD: a person, a horse, wagons, a cattle drive (LOADS): every foot, hoof and wheel a weight on the deck plank
//     under it (shared between the two planks it stands between, by how near it is to each), moved across half a foot at
//     a time. Each spot is solved on its own; a board's bending is checked under the weights on it as well as at its ends.
//   * BUCKLING: a squeezed board buckles between its joints (the windmill's check, the thin way); and the whole frame is
//     also checked for buckling as one: how many times the squeeze it carries now would make it bow out sideways (the
//     smallest "buckling factor" of the frame, found by repeated solving: inverse iteration), so a top board left free
//     to bow out of the side between its ends is caught, not only one bowing between two joints.
//   * No wind, no tipping, no racking limit: weight only. A side with no diagonal holds only by its nails' stiffness,
//     so it sags, its joints twist loose and it folds: the sums show that by themselves. There are no special shapes:
//     every board is checked the same way, wherever it is.
//
// Exports: crossTest(bridge) (the whole test: every load in turn, as long as the bridge carries them), LOADS, SECTIONS,
// and for the rigs and tests solveLoads (one set of weights, no giving way) and internals.
import { WOOD as WOOD_W, NAILS as NAILS_W, TOE_SHARE, TOL, internals as WI } from '../windmill/frame.js';
import { supportsOf, FACE_W, PLANK, DECK_LIFT, deckLine } from './bridge.js';

const { prepBoards, faceToFace, markLegs, nailUse, rcm, makeEnvelope, factor, solveEnv, toWorld, groundedSet } = WI;
// The bridge's wood and nails are stronger than the windmill's (its numbers are on the cautious side): clear, dry pine
// (a 2x4 snaps at about 2,300 pound-feet, not 1,500) and nails at full strength (three 16-penny nails hold about
// 1,200-1,500 lb, not 750). Only what they hold changes; how stiff they are stays the windmill's.
const WOOD_STRONG = 1.6, NAIL_STRONG = 1.8;
const WOOD = { ...WOOD_W, bendHolds: WOOD_W.bendHolds * WOOD_STRONG, bendHoldsWeak: WOOD_W.bendHoldsWeak * WOOD_STRONG,
  twistHolds: WOOD_W.twistHolds * WOOD_STRONG, pullHolds: WOOD_W.pullHolds * WOOD_STRONG };
const NAILS = Object.fromEntries(Object.entries(NAILS_W).map(([k, n]) => [k, (k === 'face' || k === 'butt' || k === 'toe')
  ? { ...n, holds: n.holds * NAIL_STRONG, pull: n.pull * NAIL_STRONG, twist: n.twist * NAIL_STRONG, ...(n.bend ? { bend: n.bend * NAIL_STRONG } : {}) } : n]));
export { WOOD, NAILS, TOL };

// ── the wood: a 2x4 (the windmill's numbers) and a deck plank (2 by 8, laid flat) ─────────────────────────────────────
// A plank's numbers are a 2x4's scaled by its section: area, bending stiffness both ways, twisting (a thin rectangle),
// and strength (section modulus: bending; area: pulling; twisting by J over the thickness).
const S2x4 = { b: 1.5, h: 3.5 }, S2x8 = { b: 1.5, h: 7.25 };
const secOf = ({ b, h }, J) => {
  const A = b * h / 144, I = b * h ** 3 / 12 / 20736, Iw = h * b ** 3 / 12 / 20736, Smod = b * h * h / 6, SmodW = h * b * b / 6;
  const ref = 1.5 * 3.5 * 3.5 / 6, refW = 3.5 * 1.5 * 1.5 / 6, A0 = 1.5 * 3.5;
  return { A, I, Iw, J: J / 20736, bend: WOOD.bendHolds * Smod / ref, bendW: WOOD.bendHoldsWeak * SmodW / refW,
    twist: WOOD.twistHolds * (J / b) / (2.877 / 1.5), pull: WOOD.pullHolds * b * h / A0, weight: WOOD.weight * b * h / A0 };
};
export const SECTIONS = { board: secOf(S2x4, 2.877), plank: secOf(S2x8, 7.12) };

// the banks: how stiff the stone is to push into (pounds per foot), how stiffly friction holds along it, and what it
// takes to slide a board's foot along it: half what presses it there, plus a little grip (a nail or two into the sill)
export const BANK = { kN: 1e6, kT: 5e4, mu: 0.5, grip: 25 };
// a board resting on a bank is tied to the spot it rests on stiffly, and turns on it freely
const REST = { kt: 1e6, kr: 100, kb: 100 };
const HINGE = 0.01;                      // a nail group that twisted loose turns this much more easily (the windmill's)
const MERGE = TOL * 1.5;

// ── the loads: the ratings, lightest first ───────────────────────────────────────────────────────────────────────────
// Each crosses from the west bank to the east, along the middle of the deck. parts: every foot, hoof and wheel: dx
// (feet behind the load's front: 0 at the front, negative further back), z (across the deck), lb. The weights are the
// usual ones for each: a grown man, a saddle horse with its rider, a farm family's covered wagon with its horse, a loaded
// freight wagon with its team of two, and a herd of steers walking two abreast, nose to tail.
const hooves = (dx, z, lb, base = 4.3, front = 0.6, spread = 0.35) => [
  { dx, z: z - spread, lb: lb * front / 2 }, { dx, z: z + spread, lb: lb * front / 2 },
  { dx: dx - base, z: z - spread, lb: lb * (1 - front) / 2 }, { dx: dx - base, z: z + spread, lb: lb * (1 - front) / 2 }];
const wheels = (dx, track, base, lb, front = 0.45) => [
  { dx, z: -track / 2, lb: lb * front / 2, wheel: true }, { dx, z: track / 2, lb: lb * front / 2, wheel: true },
  { dx: dx - base, z: -track / 2, lb: lb * (1 - front) / 2, wheel: true }, { dx: dx - base, z: track / 2, lb: lb * (1 - front) / 2, wheel: true }];
const herd = (rows, gap, lb) => { const out = []; for (let r = 0; r < rows; r++) for (const z of [-1.4, 1.4]) out.push(...hooves(-r * gap, z, lb, 4.4, 0.55, 0.3)); return out; };
// wide, tall: the room it needs over the deck (feet: its whole width, and its height above the deck)
export const LOADS = [
  { key: 'person', name: 'A person', short: 'person', lb: 180, gold: 5, wide: 2, tall: 6.2, parts: [{ dx: 0, z: 0, lb: 180 }] },
  { key: 'horse', name: 'Horse and rider', short: 'horse and rider', lb: 1300, gold: 15, wide: 3, tall: 8.5, parts: hooves(0, 0, 1300) },
  { key: 'covered', name: 'Covered wagon', short: 'covered wagon', lb: 2500, gold: 30, wide: 6.2, tall: 9.5, model: 'covered', horses: 1,
    parts: [...hooves(0, 0, 1000), ...wheels(-7.4, 5.5, 6.4, 1500)] },
  { key: 'freight', name: 'Loaded freight wagon', short: 'freight wagon', lb: 5000, gold: 60, wide: 6.5, tall: 8, model: 'freight', horses: 2,
    parts: [...hooves(0, -1.3, 1000), ...hooves(0, 1.3, 1000), ...wheels(-7.6, 5.2, 6.7, 3000)] },
  { key: 'cattle', name: 'Cattle drive', short: 'cattle drive', lb: 13200, gold: 100, wide: 6, tall: 5.5, head: 12, rowGap: 7, steer: 1100, step: 1,
    parts: herd(6, 7, 1100) },
];
for (const L of LOADS) { L.length = -Math.min(...L.parts.map((p) => p.dx)); L.total = L.parts.reduce((s, p) => s + p.lb, 0); }
// where every part of a load is when its front is at X = x: [{ X, Z, lb, i }]
export const partsAt = (load, x) => load.parts.map((p, i) => ({ X: x + p.dx, Z: p.z, lb: p.lb, i }));
// THE ROOM a load needs: is any board (not a deck plank, nor a board the deck rests on) in the way of it, over the deck
// from bank to bank: within half its width of the middle (and a 2x4's half thickness), from the deck's top to its
// height? -> [ids in the way], the lowest first
export function inTheWay(bridge, load) {
  if (!bridge.deck) return [];
  const top = bridge.deck.y + DECK_LIFT + PLANK.t / 2, h = bridge.S / 2 + 1, w = load.wide / 2, on = new Set(bridge.deck.on), r = 0.15;
  const lo = [-h - r, top + 0.05 - r, -w - r], hi = [h + r, top + load.tall + r, w + r];
  const hits = [];
  for (const b of bridge.boards) {
    if (on.has(b.id)) continue;
    const A = [b.a.X, b.a.Y, b.a.Z], d = [b.b.X - b.a.X, b.b.Y - b.a.Y, b.b.Z - b.a.Z];
    let t0 = 0, t1 = 1, hit = true;
    for (let k = 0; k < 3 && hit; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (A[k] < lo[k] || A[k] > hi[k]) hit = false; continue; }
      let a = (lo[k] - A[k]) / d[k], c = (hi[k] - A[k]) / d[k]; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) hit = false;
    }
    if (hit) hits.push(b);
  }
  return hits.sort((p, q) => Math.min(p.a.Y, p.b.Y) - Math.min(q.a.Y, q.b.Y)).map((b) => b.id);
}
// the front's positions as it crosses (half a foot a step): from just before its front reaches the deck to just after
// its last part leaves it
export function positionsOf(load, S, step = 0.5) {
  const out = [];
  for (let x = -S / 2 - 0.25; ; x += step) { out.push(Math.round(x * 1000) / 1000); if (x - load.length > S / 2 + 1e-9 || out.length > 2000) break; }
  return out;
}

// ── small vector helpers (as the windmill's) ───────────────────────────────────────────────────────────────────────
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const norm = (u) => Math.hypot(u[0], u[1], u[2]);
const unit = (u) => { const l = norm(u) || 1; return [u[0] / l, u[1] / l, u[2] / l]; };
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ptAt = (b, t) => [b.A[0] + b.d[0] * t, b.A[1] + b.d[1] * t, b.A[2] + b.d[2] * t];
const r3 = (v) => { const r = Math.round(v * 1e3) / 1e3; return r === 0 ? 0 : r; };
const r4 = (v) => { const r = Math.round(v * 1e4) / 1e4; return r === 0 ? 0 : r; };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ── the boards, ready for the sums ──────────────────────────────────────────────────────────────────────────────────
// (the windmill's prepBoards, with each board's size: a deck plank's, or a 2x4's)
function prep(br, boards) {
  const bs = prepBoards({ W: FACE_W, D: br.D, boards });
  for (const b of bs) { b.sec = b.src.plank ? SECTIONS.plank : SECTIONS.board; b.plank = !!b.src.plank; }
  return bs;
}
// where two boards touch (the windmill's rule; its own copy there is not exported under this name)
const touch3 = WI.touch3;
const boxApart = (p, q) => {
  for (let k = 0; k < 3; k++) {
    if (Math.min(p.A[k], p.B[k]) - TOL > Math.max(q.A[k], q.B[k])) return true;
    if (Math.min(q.A[k], q.B[k]) - TOL > Math.max(p.A[k], p.B[k])) return true;
  }
  return false;
};

// The joints: touching spots merged into hubs (spots within 1.5 TOL are one hub, as the windmill's), and the spots where
// boards rest on the banks (a hub with a support: { n (the way the stone pushes), bank, kind }). A deck plank touches
// only the boards the deck rests on (deckOn). gone: [{ id, P }] supports a board no longer has there (its foot slid);
// cuts: nails pulled out (that board is no longer at that hub).
// -> hubs [{ P, ground, support, items: [{ b, t, ground }], contacts: [{ i, j, ti, tj, butt }] }]
function findHubs(br, boards, { cuts = [], gone = [], lifted = [], slips = [], deckOn = null } = {}) {
  const hubs = [];
  const hubAt = (P) => {
    for (const q of hubs) if (dist(q.P, P) < MERGE) return q;
    const h = { P: [...P], ground: false, support: null, items: [], contacts: [] }; hubs.push(h); return h;
  };
  const add = (h, i, t, ground = false) => {
    const o = h.items.find((it) => it.b === i);
    if (o) { o.t = (o.t + t) / 2; if (ground) o.ground = true; } else h.items.push({ b: i, t, ground });
  };
  const on = deckOn ? new Set(deckOn) : null;
  for (let i = 0; i < boards.length; i++) for (let j = i + 1; j < boards.length; j++) {
    const p = boards[i], q = boards[j];
    if (p.plank || q.plank) { if (p.plank && q.plank) continue; const o = p.plank ? q : p; if (!on || !on.has(o.id)) continue; }
    if (boxApart(p, q)) continue;
    for (const c of touch3(p, q)) {
      const h = hubAt(c.P);
      add(h, i, c.ti); add(h, j, c.tj); h.contacts.push({ i, j, ti: c.ti, tj: c.tj, butt: c.butt });
    }
  }
  const off = (list, id, P) => list.some((g) => g.id === id && dist(g.P, P) < MERGE);
  boards.forEach((b, i) => {
    if (b.plank) return;
    for (const s of supportsOf(br, b.src)) {
      const P = [s.P.X, s.P.Y, s.P.Z];
      if (off(gone, b.id, P) || off(lifted, b.id, P)) continue;
      const h = hubAt(P); h.ground = true;
      if (!h.support) h.support = { n: s.n, bank: s.bank, kind: s.kind, slip: false };
      { const sl = slips.find((x) => x.id === b.id && dist(x.P, P) < MERGE); if (sl) { h.support.slip = true; h.support.slipDir = sl.dir || null; } }
      add(h, i, Math.max(0, Math.min(b.L, s.t)), true);
    }
  });
  if (cuts.length) for (const h of hubs) {
    const out = new Set();
    for (const c of cuts) if (dist(c.P, h.P) < MERGE) { const bi = boards.findIndex((b) => b.id === c.id); if (bi >= 0) out.add(bi); }
    if (!out.size) continue;
    h.items = h.items.filter((it) => !out.has(it.b));
    h.contacts = h.contacts.filter((c) => !out.has(c.i) && !out.has(c.j));
  }
  return hubs.filter((h) => (h.ground ? h.items.some((it) => it.ground) : h.items.length > 1));
}

// ── the joint kinds (the windmill's classify, two rules changed: see the top) ───────────────────────────────────────
function contactKind(boards, c) {
  if (c.butt) return { type: 'butt' };
  const p = boards[c.i], q = boards[c.j], { shared, c: plane } = faceToFace(p, q);
  // (a deck plank's end rests on the board under it, wherever that board's own end is)
  if (p.plank !== q.plank) { const [k, o] = p.plank ? [c.i, c.j] : [c.j, c.i]; return { type: 'toe', end: k, tEnd: k === c.i ? c.ti : c.tj, carrier: o }; }
  const endOf = (b, t) => t < TOL || t > b.L - TOL;
  // (an end standing on another board's side is toe-nailed only when the two don't lie face to face)
  const stands = (b, t, o) => endOf(b, t) && !o.post && !shared;
  if (stands(p, c.ti, q) && !endOf(q, c.tj)) return { type: 'toe', end: c.i, tEnd: c.ti, carrier: c.j };
  if (stands(q, c.tj, p) && !endOf(p, c.ti)) return { type: 'toe', end: c.j, tEnd: c.tj, carrier: c.i };
  return { type: 'face', shared, plane };
}
function orthoSet(vs) {
  const out = [];
  for (const v of vs) {
    let u = [...v];
    for (const o of out) { const k = dot(u, o); u = [u[0] - k * o[0], u[1] - k * o[1], u[2] - k * o[2]]; }
    if (norm(u) > 0.3) out.push(unit(u));
    if (out.length === 3) break;
  }
  return out;
}
function classify(boards, hubs) {
  markLegs(boards, hubs);
  for (const h of hubs) {
    const here = new Set(h.items.map((it) => it.b));
    const cs = h.contacts.filter((c) => here.has(c.i) && here.has(c.j)).map((c) => ({ ...c, ...contactKind(boards, c) }));
    const ends = new Set(cs.filter((c) => c.type === 'toe').map((c) => c.end));
    for (const it of h.items) {
      const b = boards[it.b], end = it.t < TOL ? 'a' : it.t > b.L - TOL ? 'b' : null;
      it.eIn = end === 'a' ? b.d : end === 'b' ? [-b.d[0], -b.d[1], -b.d[2]] : null;
      it.soft = []; it.lapped = false; it.endToEnd = false; it.restsOn = false; it.bearsUp = false;
      // (resting on a bank: tied stiffly to the spot, turning freely; the bank itself is checked at the hub)
      if (h.ground && it.ground) { it.kind = 'rest'; continue; }
      const mine = cs.filter((c) => c.i === it.b || c.j === it.b);
      const toes = mine.filter((c) => c.type === 'toe' && c.carrier === it.b);
      if (toes.length && !ends.has(it.b)) {
        const c = toes.reduce((a, x) => (Math.abs(boards[x.end].d[1]) > Math.abs(boards[a.end].d[1]) ? x : a));
        const e = boards[c.end], eEnd = c.tEnd < e.L / 2 ? e.d : [-e.d[0], -e.d[1], -e.d[2]];
        it.kind = 'toe'; it.toeEnd = c.end; it.toeAxis = eEnd;
        it.toeN = new Set(toes.map((x) => x.end)).size;
        it.restsOn = !e.post && Math.abs(e.d[1]) < 0.3 && Math.abs(b.d[1]) < 0.3;
        continue;
      }
      let face = false, butt = true;
      const soft = [];
      for (const c of mine) {
        const j = c.i === it.b ? c.j : c.i, o = boards[j];
        if (c.type === 'butt') { it.endToEnd = true; continue; }
        butt = false;
        if (c.type === 'toe') { if (b.plank && !o.plank) it.bearsUp = true; continue; }
        face = true;
        if (c.shared) {
          if (!b.post && (!c.plane || Math.abs(dot(b.n, c.plane)) > 0.9)) { soft.push(b.n); it.lapped = true; }
          else soft.push(c.plane || (o.post ? b.n : o.n));
        } else if (c.plane) soft.push(c.plane);
      }
      it.endToEnd = it.endToEnd && !!it.eIn;
      it.kind = face || !butt ? 'face' : 'butt';
      it.soft = it.kind === 'face' ? (soft.length ? orthoSet(soft) : [b.n]) : [];
      // (a deck plank resting on a board, toe-nailed to it at its end and touching nothing else there: it turns on that
      // board freely, as a toe-nailed end does, and bears on it pressed down; only lifting off and sliding cost nails)
      if (it.bearsUp && !face) { it.kind = 'toe'; it.toeAxis = it.eIn || b.d; it.toeN = 1; it.restsOn = false; it.soft = []; }
    }
  }
}
const hinged = (it, s) => !!it.hinges && it.hinges.some((x) => Math.abs(dot(x, s)) > 0.9);
// an item's springs: [kt (any way), the 3x3 turning stiffness (row by row)] (the windmill's springOf, and the rest tie)
// (PINS, for the rigs' hand checks only: joints that don't slip and turn freely about every axis but the faces', as the
// textbook method of joints takes them)
const PINS = { kt: 1e9, kr: 1, kb: 1e4 };
function springOf(it, pins = false) {
  const k = it.kind === 'rest' ? REST : pins ? PINS : NAILS[it.kind];
  const R = [k.kb, 0, 0, 0, k.kb, 0, 0, 0, k.kb];
  if (it.kind === 'face') {
    for (const s of it.soft) {
      const kr = hinged(it, s) ? k.kr * HINGE : k.kr;
      for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) R[a * 3 + c] += (kr - k.kb) * s[a] * s[c];
    }
  } else for (let a = 0; a < 3; a++) R[a * 4] = k.kr;
  return { kt: k.kt, R };
}

// ── the beam piece (the windmill's, with each board's own size) ───────────────────────────────────────────────────
function localK(L, sec) {
  const { E, G } = WOOD, { A, I, Iw, J } = sec, k = new Float64Array(144);
  const s = (i, j, v) => { k[i * 12 + j] = v; k[j * 12 + i] = v; };
  const ea = E * A / L, gj = G * J / L;
  s(0, 0, ea); s(6, 6, ea); s(0, 6, -ea);
  s(3, 3, gj); s(9, 9, gj); s(3, 9, -gj);
  const z1 = 12 * E * I / L ** 3, z2 = 6 * E * I / L ** 2, z3 = 4 * E * I / L, z4 = 2 * E * I / L;
  s(1, 1, z1); s(1, 5, z2); s(1, 7, -z1); s(1, 11, z2); s(5, 5, z3); s(5, 7, -z2); s(5, 11, z4); s(7, 7, z1); s(7, 11, -z2); s(11, 11, z3);
  const y1 = 12 * E * Iw / L ** 3, y2 = 6 * E * Iw / L ** 2, y3 = 4 * E * Iw / L, y4 = 2 * E * Iw / L;
  s(2, 2, y1); s(2, 4, -y2); s(2, 8, -y1); s(2, 10, -y2); s(4, 4, y3); s(4, 8, y2); s(4, 10, y4); s(8, 8, y1); s(8, 10, y2); s(10, 10, y3);
  return k;
}
function localKg(L) {
  const k = new Float64Array(144), s = (i, j, v) => { k[i * 12 + j] = v; k[j * 12 + i] = v; };
  const a = 6 / 5 / L, b = 1 / 10, c = 2 * L / 15, d = -L / 30;
  s(1, 1, a); s(1, 5, b); s(1, 7, -a); s(1, 11, b); s(5, 5, c); s(5, 7, -b); s(5, 11, d); s(7, 7, a); s(7, 11, -b); s(11, 11, c);
  s(2, 2, a); s(2, 4, -b); s(2, 8, -a); s(2, 10, -b); s(4, 4, c); s(4, 8, b); s(4, 10, d); s(8, 8, a); s(8, 10, b); s(10, 10, c);
  return k;
}
function vecToLocal(R, g, out) {
  for (let blk = 0; blk < 4; blk++) for (let a = 0; a < 3; a++) out[blk * 3 + a] = R[a * 3] * g[blk * 3] + R[a * 3 + 1] * g[blk * 3 + 1] + R[a * 3 + 2] * g[blk * 3 + 2];
  return out;
}
function vecToWorld(R, l, out) {
  for (let blk = 0; blk < 4; blk++) for (let c = 0; c < 3; c++) out[blk * 3 + c] = R[c] * l[blk * 3] + R[3 + c] * l[blk * 3 + 1] + R[6 + c] * l[blk * 3 + 2];
  return out;
}
function addPointLoad(out, L, xi, f) {
  const x2 = xi * xi, x3 = x2 * xi;
  const N1 = 1 - 3 * x2 + 2 * x3, N2 = L * (xi - 2 * x2 + x3), N3 = 3 * x2 - 2 * x3, N4 = L * (x3 - x2);
  out[0] += (1 - xi) * f[0]; out[6] += xi * f[0];
  out[1] += N1 * f[1]; out[5] += N2 * f[1]; out[7] += N3 * f[1]; out[11] += N4 * f[1];
  out[2] += N1 * f[2]; out[4] -= N2 * f[2]; out[8] += N3 * f[2]; out[10] -= N4 * f[2];
}
const envAdd = (env, i, j, v) => { if (i < j) { const t = i; i = j; j = t; } env.a[env.rp[i] + j - env.fc[i]] += v; };

// ── the model of the standing bridge ───────────────────────────────────────────────────────────────────────────────
// Every board gets a node at each joint along it and at both ends; every hub gets a node of its own; a hub resting on a
// bank is held by the bank's spring (stiff square into the stone, friction along it).
function buildModel(br, boards, hubs) {
  const nodes = [], boardNodes = boards.map(() => []);
  const nodeAt = (bi, t) => {
    const list = boardNodes[bi];
    for (const m of list) if (Math.abs(nodes[m].t - t) < 0.05) return m;
    nodes.push({ b: bi, t, P: ptAt(boards[bi], t), hub: -1 }); list.push(nodes.length - 1); return nodes.length - 1;
  };
  hubs.forEach((h) => { for (const it of h.items) it.node = nodeAt(it.b, it.t); });
  boards.forEach((b, bi) => { if (boardNodes[bi].length) { nodeAt(bi, 0); nodeAt(bi, b.L); } });
  boardNodes.forEach((l) => l.sort((p, q) => nodes[p].t - nodes[q].t));
  hubs.forEach((h, hi) => { nodes.push({ b: -1, t: 0, P: h.P, hub: hi }); h.node = nodes.length - 1; });
  const elems = [];
  boardNodes.forEach((list, bi) => {
    const b = boards[bi];
    for (let k = 0; k + 1 < list.length; k++) {
      const na = list[k], nb = list[k + 1], L = nodes[nb].t - nodes[na].t;
      if (L < 1e-6) continue;
      const R = new Float64Array([...b.d, ...b.w, ...b.n]);
      elems.push({ b: bi, na, nb, L, R, kl: localK(L, b.sec), kgl: localKg(L), t0: nodes[na].t, sec: b.sec });
    }
  });
  for (const e of elems) { e.K = toWorld(e.kl, e.R); e.Kg = toWorld(e.kgl, e.R); }
  // the ties of every board to its hubs, and the banks' springs under the hubs that rest on them
  const springs = [];
  hubs.forEach((h, hi) => { for (const it of h.items) { const s = springOf(it, !!br.pins); springs.push({ hub: hi, it, node: it.node, to: h.node, Kt: [s.kt, 0, 0, 0, s.kt, 0, 0, 0, s.kt], R: s.R }); } });
  const supports = [];
  hubs.forEach((h, hi) => {
    if (!h.ground || !h.support) return;
    const n = h.support.n, Kt = [];
    // (a foot that has slid a hair is held only square into the stone: it slides along it freely. A foot in a notch in the
    // stone face is held up by the notch's floor as well as by the face: stiffly both ways, sliding only along the river)
    // (a foot that slid a hair one way comes to rest again: it still grips across the way it slid, so only that way is
    // free. With no way known, every way along the stone is)
    const kT = h.support.slip && !h.support.slipDir ? 0 : BANK.kT, seat = h.support.kind === 'face', sd = h.support.slip ? h.support.slipDir : null;
    for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) Kt.push((BANK.kN - kT) * (n[a] * n[c] + (seat && a === 1 && c === 1 ? 1 : 0)) + (a === c ? kT : 0) - (sd ? kT * sd[a] * sd[c] : 0));
    // (br.roller: a bank whose top lets boards slide along X freely, as the textbook sums take one end; rigs only)
    if (br.roller && h.support.bank === br.roller && h.support.kind === 'top') Kt[0] = 0;
    supports.push({ hub: hi, node: h.node, Kt, n });
  });
  const links = nodes.map(() => []);
  const link = (p, q) => { if (p < 0 || q < 0 || p === q) return; links[p].push(q); links[q].push(p); };
  for (const e of elems) link(e.na, e.nb);
  for (const s of springs) link(s.node, s.to);
  const rank = rcm(links), env = makeEnvelope(links, rank);
  const dof = (node, k) => rank[node] * 6 + k;
  for (const e of elems) {
    const g = []; for (let k = 0; k < 6; k++) g.push(dof(e.na, k)); for (let k = 0; k < 6; k++) g.push(dof(e.nb, k));
    e.dof = g;
    for (let p = 0; p < 12; p++) for (let q = 0; q <= p; q++) { const v = e.K[p * 12 + q]; if (v) envAdd(env, g[p], g[q], v); }
  }
  const add33 = (na, nb, off, K) => {
    for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) {
      const v = K[a * 3 + c]; if (!v) continue;
      const i = dof(na, off + a), j = dof(na, off + c);
      if (i >= j) envAdd(env, i, j, v);
      if (nb >= 0) {
        const i2 = dof(nb, off + a), j2 = dof(nb, off + c);
        if (i2 >= j2) envAdd(env, i2, j2, v);
        // (the cross terms -K between the two nodes: each pair once)
        envAdd(env, dof(na, off + a), dof(nb, off + c), -v);
      }
    }
  };
  for (const s of springs) { add33(s.node, s.to, 0, s.Kt); add33(s.node, s.to, 3, s.R); }
  for (const s of supports) add33(s.node, -1, 0, s.Kt);
  const M = { br, boards, hubs, nodes, boardNodes, elems, springs, supports, rank, dof, n: env.n, env };
  factor(env);
  // the weight of every piece
  M.Fg = new Float64Array(env.n);
  for (const e of elems) {
    e.fg = new Float64Array(12);
    const m = Math.max(2, Math.ceil(e.L / 0.5)), ds = e.L / m, f = [0, -e.sec.weight * ds, 0], fl = [0, 0, 0];
    for (let a = 0; a < 3; a++) fl[a] = e.R[a * 3] * f[0] + e.R[a * 3 + 1] * f[1] + e.R[a * 3 + 2] * f[2];
    for (let k = 0; k < m; k++) addPointLoad(e.fg, e.L, (k + 0.5) / m, fl);
    const gw = vecToWorld(e.R, e.fg, new Float64Array(12));
    for (let p = 0; p < 12; p++) M.Fg[e.dof[p]] += gw[p];
  }
  M.elemsOf = boards.map(() => []);
  elems.forEach((e, k) => M.elemsOf[e.b].push(k));
  return M;
}

// ── weights on the frame ───────────────────────────────────────────────────────────────────────────────────────────
// loads: [{ b (board index), s (feet along it from its a end), f: [X, Y, Z] pounds }]. -> { F (the load vector), perElem
// (Map element -> its local consistent loads), pts (Map element -> [{ x (feet along the piece), f (local) }]) }
function loadVector(M, loads) {
  const F = new Float64Array(M.n), perElem = new Map(), pts = new Map(), tmp = new Float64Array(12);
  for (const ld of loads) {
    const es = M.elemsOf[ld.b]; if (!es || !es.length) continue;
    let e = null;
    for (const k of es) { const el = M.elems[k]; if (ld.s >= el.t0 - 1e-9 && ld.s <= el.t0 + el.L + 1e-9) { e = k; break; } }
    if (e === null) e = ld.s < M.elems[es[0]].t0 ? es[0] : es[es.length - 1];
    const el = M.elems[e], x = clamp(ld.s - el.t0, 0, el.L), xi = x / el.L;
    const fl = [0, 1, 2].map((a) => el.R[a * 3] * ld.f[0] + el.R[a * 3 + 1] * ld.f[1] + el.R[a * 3 + 2] * ld.f[2]);
    let loc = perElem.get(e); if (!loc) { loc = new Float64Array(12); perElem.set(e, loc); }
    tmp.fill(0); addPointLoad(tmp, el.L, xi, fl);
    for (let p = 0; p < 12; p++) loc[p] += tmp[p];
    (pts.get(e) || pts.set(e, []).get(e)).push({ x, f: fl });
    const gw = vecToWorld(el.R, tmp, new Float64Array(12));
    for (let p = 0; p < 12; p++) F[el.dof[p]] += gw[p];
  }
  return { F, perElem, pts };
}
// Feet, hooves and wheels on the deck: each shared between the two deck planks it stands between (all of it on a plank
// it stands right on), at its place across the deck. A part on a bank, or between a bank's edge and the first plank,
// has that share on the bank. -> { loads (for loadVector), lost (pounds standing where a plank should be but is not), on
// (pounds on the bridge) }
function deckLoads(M, parts, deck) {
  const out = [], h = M.br.S / 2;
  if (!deck) return { loads: out, lost: parts.reduce((s, p) => s + (Math.abs(p.X) < h ? p.lb : 0), 0), on: 0 };
  const xs = deck.planks.map((p) => p.X), byId = new Map(M.boards.map((b, i) => [b.id, i]));
  let lost = 0, on = 0;
  const put = (k, lb, Z) => {
    const bi = byId.get(deck.planks[k].id);
    if (bi === undefined) { lost += lb; return; }
    const b = M.boards[bi], s = clamp(Z - b.A[2], 0, b.L);
    out.push({ b: bi, s, f: [0, -lb, 0] }); on += lb;
  };
  for (const p of parts) {
    if (Math.abs(p.X) >= h) continue;
    let k = 0; while (k < xs.length && xs[k] <= p.X) k++;
    if (k === 0) { const t = (p.X + h) / Math.max(1e-6, xs[0] + h); put(0, p.lb * t, p.Z); continue; }
    if (k === xs.length) { const t = (h - p.X) / Math.max(1e-6, h - xs[k - 1]); put(k - 1, p.lb * t, p.Z); continue; }
    const t = (p.X - xs[k - 1]) / (xs[k] - xs[k - 1]);
    if (t < 1 - 1e-9) put(k - 1, p.lb * (1 - t), p.Z);
    if (t > 1e-9) put(k, p.lb * t, p.Z);
  }
  return { loads: out, lost, on };
}

// ── solving: K u = F, with each board's squeeze or pull leaning on how it bends (the windmill's P-delta rounds) ──────
function solve(M, Fl) {
  const n = M.n, F = new Float64Array(n);
  for (let i = 0; i < n; i++) F[i] = M.Fg[i] + (Fl ? Fl[i] : 0);
  let u = solveEnv(M.env, F);
  const N = new Float64Array(M.elems.length), ue = new Float64Array(12), r = new Float64Array(n);
  const N0 = new Float64Array(M.elems.length);
  let unstable = false, last = Infinity, grow = 0, rounds = 0;
  const axial = () => {
    for (let e = 0; e < M.elems.length; e++) {
      const el = M.elems[e], g = el.dof;
      N[e] = WOOD.E * el.sec.A / el.L * (el.R[0] * (u[g[6]] - u[g[0]]) + el.R[1] * (u[g[7]] - u[g[1]]) + el.R[2] * (u[g[8]] - u[g[2]]));
    }
  };
  axial(); N0.set(N);
  // (a few rounds only: the squeeze's own lean on how a board bends is the first correction or two; a frame near
  // bowing out is the buckling check's to find, and one past it runs away: unstable)
  for (let it = 0; it < 4; it++) {
    rounds++;
    axial();
    r.set(F);
    for (let e = 0; e < M.elems.length; e++) {
      const el = M.elems[e], g = el.dof, Ne = N[e]; if (!Ne) continue;
      for (let p = 0; p < 12; p++) ue[p] = u[g[p]];
      for (let p = 0; p < 12; p++) { let s = 0; const row = p * 12; for (let c = 0; c < 12; c++) s += el.Kg[row + c] * ue[c]; r[g[p]] -= Ne * s; }
    }
    const nu = solveEnv(M.env, r);
    let diff = 0, big = 0;
    for (let i = 0; i < n; i++) { diff = Math.max(diff, Math.abs(nu[i] - u[i])); big = Math.max(big, Math.abs(nu[i])); }
    u = nu;
    // (to a ten-thousandth of the biggest movement: the squeeze's own lean is a few percent at most, so this is far finer
    // than any check needs)
    if (diff <= 1e-9 + 1e-4 * big) break;
    if (diff > last * 0.97) grow++; else grow = 0;
    last = diff;
    if (big > 50) { unstable = true; break; }
  }
  axial();
  // (a board end thrown more than 3 feet is no answer the frame can stand at: it is folding)
  let big = 0; for (let i = 0; i < n; i++) if (i % 6 < 3) big = Math.max(big, Math.abs(u[i]));
  if (big > 3) unstable = true;
  return { u, N, N0, unstable, rounds };
}

// ── buckling of the whole frame ────────────────────────────────────────────────────────────────────────────────────
// The smallest lam with (K + lam Kg(N)) singular: how many times the squeeze in the boards now the frame could carry
// before it bows out. Only squeezed pieces soften it (a pulled board's stiffening is left out: on the safe side). By
// inverse iteration: x <- K^-1 B x, B = -sum over squeezed pieces of N Kg, from a start with every number in it (or the
// shape found at the last spot: it changes little as a load moves half a foot). -> { lam, shape (per element: its part
// of the bowing, 0..1 of the most), x }
function buckling(M, N, start = null, rounds = 24) {
  const n = M.n;
  let squeezed = false; for (let e = 0; e < M.elems.length; e++) if (N[e] < -1) { squeezed = true; break; }
  if (!squeezed) return { lam: Infinity, shape: null, x: null };
  const Bx = (x, out) => {
    out.fill(0);
    const ue = new Float64Array(12);
    for (let e = 0; e < M.elems.length; e++) {
      const el = M.elems[e], Ne = N[e]; if (!(Ne < -1)) continue;
      const g = el.dof; for (let p = 0; p < 12; p++) ue[p] = x[g[p]];
      for (let p = 0; p < 12; p++) { let s = 0; const row = p * 12; for (let c = 0; c < 12; c++) s += el.Kg[row + c] * ue[c]; out[g[p]] += -Ne * s; }
    }
    return out;
  };
  let x = start && start.length === n ? Float64Array.from(start) : new Float64Array(n).map((_, i) => Math.sin(i * 12.9898 + 1) * 0.5 + 0.5 * Math.sin(i * 0.37));
  const y = new Float64Array(n);
  let lam = Infinity, prev = Infinity;
  for (let k = 0; k < rounds; k++) {
    Bx(x, y);
    let yy = 0; for (let i = 0; i < n; i++) yy += y[i] * x[i];
    if (!(yy > 1e-30)) return { lam: Infinity, shape: null, x: null };
    const z = solveEnv(M.env, y);
    // Rayleigh: lam = x'Kx / x'Bx with x = z: z'Kz = z'y (Kz = y), z'Bz needs B z
    let zy = 0; for (let i = 0; i < n; i++) zy += z[i] * y[i];
    const Bz = Bx(z, new Float64Array(n));
    let zBz = 0; for (let i = 0; i < n; i++) zBz += z[i] * Bz[i];
    lam = zBz > 1e-30 ? zy / zBz : Infinity;
    let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(z[i]));
    for (let i = 0; i < n; i++) x[i] = z[i] / (m || 1);
    if (k >= 2 && Math.abs(lam - prev) <= 0.003 * Math.abs(lam)) break;
    prev = lam;
  }
  // each squeezed piece's part of the bowing: its share of x'Bx
  const shape = new Float64Array(M.elems.length), ue = new Float64Array(12);
  let most = 0;
  for (let e = 0; e < M.elems.length; e++) {
    const el = M.elems[e], Ne = N[e]; if (!(Ne < -1)) continue;
    const g = el.dof; for (let p = 0; p < 12; p++) ue[p] = x[g[p]];
    let s = 0; for (let p = 0; p < 12; p++) { let r = 0; const row = p * 12; for (let c = 0; c < 12; c++) r += el.Kg[row + c] * ue[c]; s += ue[p] * r; }
    shape[e] = Math.max(0, -Ne * s); most = Math.max(most, shape[e]);
  }
  if (most > 0) for (let e = 0; e < shape.length; e++) shape[e] /= most;
  return { lam, shape, x };
}

// ── checking every part ────────────────────────────────────────────────────────────────────────────────────────────
// -> { items, worst, strain (per board id), joints (per hub), move (per board id), sag (feet, the deck's lowest dip),
//      lift (a support pulling away: the hub, or null), lam }
function checkAll(M, sol, live, { buckle = true, start = null } = {}) {
  const { u, N } = sol;
  const items = [], strain = {}, hubUtil = new Float64Array(M.hubs.length);
  const bump = (id, v) => { if (!(strain[id] >= v)) strain[id] = v; };
  for (const b of M.boards) strain[b.id] = 0;
  const ue = new Float64Array(12), ul = new Float64Array(12), f = new Float64Array(12);
  // (a frame that runs away under the load has no forces worth reading: what counts is that it bows out, below)
  if (!sol.unstable) M.elems.forEach((el, e) => {
    const g = el.dof; for (let p = 0; p < 12; p++) ue[p] = u[g[p]];
    vecToLocal(el.R, ue, ul);
    const Ne = N[e], wl = live.perElem.get(e);
    for (let p = 0; p < 12; p++) {
      let s = 0; const row = p * 12; for (let c = 0; c < 12; c++) s += (el.kl[row + c] + Ne * el.kgl[row + c]) * ul[c];
      f[p] = s - el.fg[p] - (wl ? wl[p] : 0);
    }
    // (the pull along the piece: from its a end, less every weight's push along it as it is passed; one sitting right
    // on a node goes into the joint there. The most squeezed and the most pulled stretch are what the wood is asked.)
    const ps0 = live.pts.get(e), ns = [];
    { let v = -f[0]; const qs = ps0 ? [...ps0].sort((p, q) => p.x - q.x) : [];
      for (const q of qs) if (q.x <= 1e-6) v -= q.f[0];
      ns.push(v);
      for (const q of qs) if (q.x > 1e-6 && q.x < el.L - 1e-6) { v -= q.f[0]; ns.push(v); } }
    const pull = ns.reduce((a, v) => (Math.abs(v) > Math.abs(a) ? v : a), ns[0]), squeeze = Math.max(0, -Math.min(...ns)), tension = Math.max(0, ...ns);
    let Ms = Math.max(Math.abs(f[5]), Math.abs(f[11])), Mw = Math.max(Math.abs(f[4]), Math.abs(f[10]));
    // (under a weight on the piece: the bending there, from the forces at its a end, the weights before it on it)
    const ps = live.pts.get(e);
    if (ps) for (const q of ps) {
      let mz = f[5] - q.x * f[1], my = f[4] + q.x * f[2];
      for (const o of ps) if (o.x < q.x - 1e-9) { mz += (q.x - o.x) * -o.f[1]; my += (q.x - o.x) * o.f[2]; }
      Ms = Math.max(Ms, Math.abs(mz)); Mw = Math.max(Mw, Math.abs(my));
    }
    const T = Math.abs(f[3]), sec = el.sec;
    const buckleAt = Math.PI ** 2 * WOOD.E * sec.Iw / (el.L * el.L);
    const squash = Math.max(squeeze / Math.min(sec.pull, buckleAt), tension / sec.pull);
    const bend = Ms / sec.bend + Mw / sec.bendW;
    const util = Math.hypot(squash + bend, T / sec.twist);
    const b = M.boards[el.b];
    items.push({ type: 'board', util, b: el.b, id: b.id, P: ptAt(b, el.t0 + el.L / 2), buckle: squeeze / Math.min(sec.pull, buckleAt) > Math.max(bend, tension / sec.pull), N: pull, Ms, Mw, T });
    bump(b.id, util);
  });
  if (!sol.unstable) for (const sp of M.springs) {
    const it = sp.it; if (it.kind === 'rest') continue;
    const a = M.dof(sp.node, 0), hb = M.dof(sp.to, 0), dt = [0, 0, 0], dr = [0, 0, 0];
    for (let k = 0; k < 3; k++) { dt[k] = u[hb + k] - u[a + k]; dr[k] = u[hb + 3 + k] - u[a + 3 + k]; }
    const F = [0, 1, 2].map((r) => sp.Kt[r * 3] * dt[0] + sp.Kt[r * 3 + 1] * dt[1] + sp.Kt[r * 3 + 2] * dt[2]);
    const Mo = [0, 1, 2].map((r) => sp.R[r * 3] * dr[0] + sp.R[r * 3 + 1] * dr[1] + sp.R[r * 3 + 2] * dr[2]);
    // (a deck plank held up by the board it rests on bears there: that costs its nails nothing)
    if (it.bearsUp && F[1] > 0) F[1] = 0;
    const b = M.boards[it.b], r = nailUse(b, it, F, Mo, M.hubs[sp.hub]);
    items.push({ type: 'joint', util: r.util, b: it.b, id: b.id, hub: sp.hub, P: M.hubs[sp.hub].P, kind: it.kind, toeEnd: it.toeEnd, ...r });
    bump(b.id, r.util); hubUtil[sp.hub] = Math.max(hubUtil[sp.hub], r.util);
  }
  // the banks: pressed into the stone (else lifting away), and sliding along it
  let lift = null;
  if (!sol.unstable) for (const s of M.supports) {
    const d = M.dof(s.node, 0), U = [u[d], u[d + 1], u[d + 2]];
    const Fv = [0, 1, 2].map((r) => -(s.Kt[r * 3] * U[0] + s.Kt[r * 3 + 1] * U[1] + s.Kt[r * 3 + 2] * U[2]));
    const h = M.hubs[s.hub], seat = h.support.kind === 'face';
    // (the stone only pushes: on a notch, into the face and up from the notch's floor, each of them)
    const press = dot(Fv, s.n), up = seat ? Fv[1] : 0;
    const along = seat ? Math.abs(Fv[2]) : norm([Fv[0] - press * s.n[0], Fv[1] - press * s.n[1], Fv[2] - press * s.n[2]]);
    const pull = Math.min(press, seat ? up : Infinity);
    if (pull < -5 && (!lift || pull < lift.press)) lift = { hub: s.hub, press: pull, P: h.P };
    const util = h.support.slip && !h.support.slipDir ? 0 : along / (BANK.mu * Math.max(0, press) + BANK.grip);
    const rest = h.items.filter((it) => it.ground).map((it) => M.boards[it.b]);
    const who = rest.reduce((a, o) => (!a || Math.abs(o.d[1]) > Math.abs(a.d[1]) ? o : a), null);
    // (the way it would slide: along the stone, the push it is not pressed by)
    const tv = seat ? [0, 0, Fv[2]] : [Fv[0] - press * s.n[0], Fv[1] - press * s.n[1], Fv[2] - press * s.n[2]], tl = norm(tv) || 1;
    items.push({ type: 'slide', util, hub: s.hub, P: h.P, press, along, dir: tv.map((v) => v / tl), b: who ? who.i : undefined, id: who ? who.id : null, kind: h.support.kind, bank: h.support.bank, slip: h.support.slip });
    if (who) bump(who.id, util);
    hubUtil[s.hub] = Math.max(hubUtil[s.hub], util);
  }
  // a board with nothing stopping it moving (the solver held it still to finish)
  if (M.env.loose.length) {
    const inv = new Int32Array(M.nodes.length); M.rank.forEach((r, node) => { inv[r] = node; });
    const seen = new Set();
    for (const d of M.env.loose) {
      const nd = M.nodes[inv[Math.floor(d / 6)]]; if (nd.b < 0 || seen.has(nd.b)) continue;
      seen.add(nd.b); const b = M.boards[nd.b];
      items.push({ type: 'loose', util: 99, b: nd.b, id: b.id, P: ptAt(b, b.L / 2) }); bump(b.id, 1);
    }
  }
  // the whole frame bowing out
  let lam = Infinity, mode = null;
  if (buckle || sol.unstable) {
    const bk = buckling(M, sol.unstable ? sol.N0 : N, start);
    lam = bk.lam; mode = bk.x;
    if (bk.shape && lam < 1e6) {
      // the board that bows most, among the squeezed ones (its share of the bowing, by board)
      const per = new Map();
      bk.shape.forEach((s, e) => { const id = M.boards[M.elems[e].b].id; per.set(id, Math.max(per.get(id) || 0, s)); });
      let top = null; for (const [id, s] of per) if (!top || s > top.s) top = { id, s };
      for (const [id, s] of per) if (s > 0.2) bump(id, s / lam);
      if (top) {
        const bi = M.boards.findIndex((b) => b.id === top.id), b = M.boards[bi];
        items.push({ type: 'bow', util: sol.unstable ? Math.max(1.5, 1 / lam) : 1 / lam, b: bi, id: top.id, P: ptAt(b, b.L / 2), lam, ids: [...per].filter(([, s]) => s > 0.5).map(([id]) => id), unstable: sol.unstable });
      }
    }
  }
  // (running away with boards only butted end to end somewhere: that joint is the hinge it folds on, not a bow. Two
  // boards meeting end to end with nothing lapped over them hold almost nothing, deck planks or not)
  if (sol.unstable) {
    // (two boards whose ends only meet, in one line, with nothing lapped over the joint: however it was nailed, that
    // joint is a hinge)
    const over = Math.max(1.6, ...items.filter((x) => x.type === 'bow').map((x) => x.util + 0.01)), seenB = new Set();
    const same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 0.05, meets = (P, b) => same(P, b.A) || same(P, ptAt(b, b.L));
    const through = (P, o) => { const t = dot([P[0] - o.A[0], P[1] - o.A[1], P[2] - o.A[2]], o.d); return t > -0.05 && t < o.L + 0.05 && same(P, ptAt(o, Math.max(0, Math.min(o.L, t)))); };
    for (const sp of M.springs) {
      const b = M.boards[sp.it.b], P = M.hubs[sp.hub].P; if (b.plank || seenB.has(sp.it.b) || !meets(P, b)) continue;
      const others = M.boards.filter((o) => o !== b && !o.plank && through(P, o));
      if (others.length !== 1 || !meets(P, others[0]) || Math.abs(dot(b.d, others[0].d)) < 0.99) continue;
      seenB.add(sp.it.b);
      items.push({ type: 'joint', util: over, b: sp.it.b, id: b.id, hub: sp.hub, P, kind: 'butt', unstable: true }); bump(b.id, over);
    }
  }
  if (sol.unstable && !items.some((it) => it.type === 'bow' || it.type === 'loose')) {
    // (running away with nothing squeezed to blame: the board thrown furthest is folding)
    let w = null, far = 0;
    M.boards.forEach((b, bi) => { for (const m of M.boardNodes[bi]) { const d = M.dof(m, 0), v = Math.hypot(u[d], u[d + 1], u[d + 2]); if (v > far) { far = v; w = bi; } } });
    if (w !== null) { const b = M.boards[w]; items.push({ type: 'bow', util: 1.5, b: w, id: b.id, P: ptAt(b, b.L / 2), lam: 0, ids: [b.id], unstable: true }); bump(b.id, 1.5); }
  }
  const joints = M.hubs.map((h, hi) => ({ X: r3(h.P[0]), Y: r3(h.P[1]), Z: r3(h.P[2]), util: r3(hubUtil[hi]) }));
  const move = {};
  let sag = 0;
  M.boards.forEach((b, bi) => {
    const list = M.boardNodes[bi]; if (!list.length) return;
    const e0 = list[0], e1 = list[list.length - 1], d0 = M.dof(e0, 0), d1 = M.dof(e1, 0);
    if (sol.unstable) { move[b.id] = [[0, 0, 0], [0, 0, 0]]; return; }
    move[b.id] = [[r4(u[d0]), r4(u[d0 + 1]), r4(u[d0 + 2])], [r4(u[d1]), r4(u[d1 + 1]), r4(u[d1 + 2])]];
    if (b.plank) for (const m of list) sag = Math.max(sag, -u[M.dof(m, 1)]);
  });
  for (const k in strain) strain[k] = r3(strain[k]);
  let worst = null; for (const it of items) if (!worst || it.util > worst.util) worst = it;
  return { items, worst, strain, joints, move, sag, lift, lam, mode };
}

// ── words for what gave (the page turns them into the card's sentences: crossing.js) ───────────────────────────────
const KIND = { board: (it) => (it.buckle ? 'buckle' : 'snap'), joint: (it) => (it.kind === 'butt' ? 'butt' : it.kind === 'toe' ? 'toe' : 'nails'), slide: () => 'slide', bow: () => 'bow', loose: () => 'loose' };

// ── the standing bridge as the test goes ────────────────────────────────────────────────────────────────────────────
// state: { br, boards (standing), deck, cuts, hinges, gone (supports a foot slid off), M (the model of what stands) }
// (models are kept by which supports have let go, so a load moving on doesn't make them again; state.M = null says the
// bridge changed, and every model made before is stale)
function modelOf(state, lifted = [], slips = []) {
  const key = lifted.map((l) => l.id + '@' + l.P.map(r3).join(',')).join(';') + '|' + slips.map((l) => l.id + '@' + l.P.map(r3).join(',') + (l.dir ? '>' + l.dir.map((v) => Math.round(v * 20)).join(',') : '')).join(';');
  if (!state.M) state.cache = new Map();
  const hit = state.cache.get(key);
  if (hit) { state.M = hit; return hit; }
  const boards = prep(state.br, state.boards);
  const hubs = findHubs(state.br, boards, { cuts: state.cuts, gone: state.gone, lifted, slips, deckOn: state.deck ? state.deck.on : null });
  classify(boards, hubs);
  if (state.hinges.length) for (const h of hubs) for (const it of h.items) {
    const id = boards[it.b].id, axes = state.hinges.filter((x) => x.id === id && dist(x.P, h.P) < MERGE).map((x) => x.axis);
    if (axes.length) it.hinges = axes;
  }
  state.M = buildModel(state.br, boards, hubs); state.cache.set(key, state.M); state.models++;
  return state.M;
}
// what no longer reaches a bank through its joints falls: the ids that fell
function settle(state) {
  const boards = prep(state.br, state.boards);
  const hubs = findHubs(state.br, boards, { cuts: state.cuts, gone: state.gone, deckOn: state.deck ? state.deck.on : null });
  const keep = groundedSet(boards, hubs), gone = boards.filter((b, i) => !keep.has(i)).map((b) => b.id);
  const ids = new Set(boards.map((b) => b.id));
  for (const b of state.boards) if (!ids.has(b.id)) gone.push(b.id);
  if (gone.length) remove(state, gone);
  return gone;
}
function remove(state, ids) { const s = new Set(ids); state.boards = state.boards.filter((b) => !s.has(b.id)); state.M = null; }
// the worst part past its limit gives way; then what falls with it. -> the event
function giveWay(state, M, chk, w) {
  const b = w.b !== undefined ? M.boards[w.b] : null;
  const hinge = w.type === 'joint' && w.kind === 'face' && w.axis && w.parts && w.parts[2] >= Math.max(w.parts[0], w.parts[1]);
  let broke = [], out = [];
  if (w.type === 'board' || w.type === 'bow') { broke = [b.id]; out = [b.id]; }
  else if (hinge) { broke = [b.id]; state.hinges.push({ id: b.id, P: [...M.hubs[w.hub].P], axis: [...w.axis] }); state.M = null; }
  else if (w.type === 'joint') {
    broke = [w.kind === 'toe' && w.toeEnd !== undefined ? M.boards[w.toeEnd].id : b.id];
    state.cuts.push({ id: b.id, P: [...M.hubs[w.hub].P] }); state.M = null;
  } else if (w.type === 'slide') {
    const h = M.hubs[w.hub];
    for (const it of h.items) if (it.ground) state.gone.push({ id: M.boards[it.b].id, P: [...h.P] });
    broke = h.items.filter((it) => it.ground).map((it) => M.boards[it.b].id); state.M = null;
  } else if (w.type === 'loose') { const set = new Set(chk.items.filter((it) => it.type === 'loose').map((it) => it.id)); broke = [...set]; out = [...set]; }
  if (out.length) remove(state, out);
  const fell = [...out, ...settle(state)];
  const ev = { kind: hinge ? 'hinge' : KIND[w.type](w), at: { X: r3(w.P[0]), Y: r3(w.P[1]), Z: r3(w.P[2]) }, broke, fell, util: r3(w.util), id: b ? b.id : null };
  if (w.type === 'joint') { ev.joint = w.kind; if (w.toeEnd !== undefined) ev.on = b.id; }
  if (w.type === 'slide') { ev.bank = w.bank; ev.face = w.kind === 'face'; }
  if (w.type === 'bow') ev.ids = w.ids;
  if (w.type === 'board') { ev.N = Math.round(w.N); ev.bend = Math.round(Math.max(w.Ms, w.Mw)); ev.weakWay = w.Mw / b.sec.bendW > w.Ms / b.sec.bend; }
  return ev;
}

// (a foot sliding: the way it slid; sliding again another way, it is free every way along the stone)
function addSlip(list, id, P, dir) {
  const was = list.find((x) => x.id === id && dist(x.P, P) < MERGE);
  if (was) { was.dir = null; return; }
  list.push({ id, P: [...P], dir: dir || null });
}
// One load at one spot, with whatever gives giving way (and the rest solved again, at that same spot), until what is
// left holds or nothing is left. -> { chk (the last sums), events, lost (pounds left with no plank under them), on }
function standAt(state, parts, opts) {
  const events = [];
  let guard = 0, chk = null, live = null, info = null;
  for (;;) {
    if (!state.boards.length) return { chk: null, events, lost: parts.reduce((s, p) => s + p.lb, 0), on: 0 };
    let lifted = [], slips = state.slid.map((x) => ({ ...x })), M, sol;
    // A support pulling away lets go, and one pushed along the stone harder than friction holds slides a hair (it is
    // held only square into the stone from then on): both only at this spot, since further on they may bear again.
    // One at a time, the worst first, and the sums done again. (A foot sliding a hair is no break: the board still
    // rests on the stone, and the rest of the frame takes up what the rubbing held. Only what gives after that is.)
    for (let k = 0; k < 40; k++) {
      M = modelOf(state, lifted, slips);
      info = deckLoads(M, parts, state.deck);
      live = loadVector(M, info.loads);
      sol = solve(M, live.F); opts.solves++;
      chk = checkAll(M, sol, live, { buckle: opts.buckle, start: opts.mode && opts.mode.length === M.n ? opts.mode : null });
      // (a support pulling away lets go first, one at a time; feet sliding all slide together, which takes far fewer
      // rounds than one at a time when a whole row of stringer ends slides at once)
      const slides = chk.items.filter((it) => it.type === 'slide' && it.util > 1);
      if (!chk.lift && !slides.length) break;
      if (chk.lift) { const h = M.hubs[chk.lift.hub]; for (const it of h.items) if (it.ground) lifted.push({ id: M.boards[it.b].id, P: [...h.P] }); continue; }
      for (const sl of slides) { const h = M.hubs[sl.hub]; for (const it of h.items) if (it.ground) addSlip(slips, M.boards[it.b].id, h.P, sl.dir); }
    }
    chk.slips = slips;
    if (chk.mode) opts.mode = chk.mode;
    if (!chk.worst || chk.worst.util <= 1 || guard++ > 120) break;
    // (still sliding after all that: it slides, and stays slid, still resting on the stone; no break)
    if (chk.worst.type === 'slide') {
      const h = M.hubs[chk.worst.hub];
      for (const it of h.items) if (it.ground) addSlip(state.slid, M.boards[it.b].id, h.P, chk.worst.dir);
      state.M = null; continue;
    }
    // (a collapse: past the first ten breaks at one spot, every board more than twice past its limit goes at once)
    if (events.length >= 10) {
      const many = [...new Set(chk.items.filter((it) => it.type === 'board' && it.util > 2).map((it) => it.id))];
      if (many.length > 1) { remove(state, many); const fell = [...many, ...settle(state)]; events.push({ kind: 'collapse', at: { X: 0, Y: 0, Z: 0 }, broke: many, fell, util: r3(chk.worst.util), id: many[0] }); state.M = null; continue; }
    }
    const ev = giveWay(state, M, chk, chk.worst);
    // (boards that came loose after a foot slid along the stone, with nothing else given way first at this spot: that
    // foot sliding is what let them go)
    if (ev.kind === 'loose' && slips.length && !events.length) { ev.kind = 'slide'; ev.slid = slips.map((s) => s.id); ev.at = { X: r3(slips[0].P[0]), Y: r3(slips[0].P[1]), Z: r3(slips[0].P[2]) }; ev.bank = Math.sign(slips[0].P[0]) || -1; ev.face = slips[0].P[1] < -0.05; }
    events.push(ev);
    state.M = null;
  }
  return { chk, events, lost: info ? info.lost : 0, on: info ? info.on : 0 };
}

// THE TEST: first the bridge alone under its own weight (what can't hold itself up goes), then every load in turn,
// lightest first, rolling from the west bank to the east half a foot at a time. A load stops (and falls back to the bank:
// nobody is hurt) where the deck under it is gone; then the heavier loads don't try. -> {
//   calm: { events, strain, joints, move },
//   crossings: [{ key, name, lb, made (got across), steps: [{ x (its front), strain, joints, move, sag, peak, events,
//     lost }], events, stopAt (x where it stopped, or null), sag (the most, feet), peak ({ util, kind, id }: the most any
//     part was used while it crossed) }],
//   rating (index into LOADS of the heaviest load that got across, -1 for none), standing ({ S, D, boards, deck }),
//   stood (nothing gave), ms, solves, models }
export function crossTest(bridge, { loads = LOADS, step = 0.5, buckle = true, onPart = null } = {}) {
  const t0 = now(), br = { S: bridge.S, D: bridge.D, boards: bridge.boards, deck: bridge.deck };
  const planks = bridge.deck ? bridge.deck.planks.map((p) => ({ ...p, a: { ...p.a }, b: { ...p.b } })) : [];
  const state = { br, boards: [...bridge.boards.map((b) => ({ ...b, a: { ...b.a }, b: { ...b.b } })), ...planks], deck: bridge.deck, cuts: [], hinges: [], gone: [], slid: [], M: null, Mkey: '', models: 0 };
  const opts = { solves: 0, buckle, mode: null };
  const lost0 = settle(state);
  const first = standAt(state, [], opts);
  const pick = (c) => (c ? { strain: c.strain, joints: c.joints, move: c.move } : { strain: {}, joints: [], move: {} });
  const calm = { events: [...(lost0.length ? [{ kind: 'loose', at: { X: 0, Y: 0, Z: 0 }, broke: lost0, fell: lost0, util: 1 }] : []), ...first.events], ...pick(first.chk) };
  const crossings = [];
  let rating = -1, any = calm.events.length > 0;
  // (fallen under her own weight, with nothing left to cross on: no load starts. calm.down says so, and there are no
  // crossings at all; a bridge built with no deck still sends each load its "no deck" crossing below)
  const deckLeft = state.deck && state.boards.some((b) => !b.plank) && state.deck.planks.some((p) => state.boards.some((b) => b.id === p.id));
  if (any && !deckLeft) calm.down = true;
  // (each part handed on as soon as it is worked out, so the page can play the first load while the rest is summed)
  if (onPart) onPart({ part: 'calm', calm });
  if (calm.down) {
    const standing = { S: br.S, D: br.D, boards: state.boards.filter((b) => !b.plank), deck: null };
    return { calm, crossings, rating, standing, stood: false, down: true, ms: Math.round((now() - t0) * 10) / 10, solves: opts.solves, models: state.models };
  }
  for (let li = 0; li < loads.length; li++) {
    const load = loads[li];
    const cr = { key: load.key, name: load.name, lb: load.lb, made: true, steps: [], events: [], stopAt: null, sag: 0, peak: { util: 0, kind: null, id: null } };
    crossings.push(cr);
    const stop = (extra) => { Object.assign(cr, { made: false, stopAt: -br.S / 2 }, extra); if (onPart) onPart({ part: 'crossing', index: li, crossing: cr, rating }); };
    if (!state.boards.length || !state.deck) { stop({ nodeck: !state.deck }); break; }
    // (no room for it: it stays on the bank, and the bridge is untouched)
    const way = inTheWay({ ...br, boards: state.boards.filter((b) => !b.plank), deck: state.deck }, load);
    if (way.length) { stop({ blocked: way }); break; }
    opts.mode = null;
    for (const x of positionsOf(load, br.S, load.step || step)) {
      const parts = partsAt(load, x);
      const r = standAt(state, parts, opts);
      const c = r.chk;
      const peak = c && c.worst ? { util: r3(c.worst.util), kind: KIND[c.worst.type](c.worst), id: c.worst.id ?? null } : { util: 0, kind: null, id: null };
      cr.steps.push({ x, ...pick(c), sag: c ? r4(c.sag) : 0, peak, events: r.events, lost: Math.round(r.lost) });
      cr.events.push(...r.events.map((e) => ({ ...e, x })));
      if (r.events.length) any = true;
      if (c && !r.events.length) { cr.sag = Math.max(cr.sag, c.sag); if (peak.util > cr.peak.util) cr.peak = peak; }
      // (more than a few pounds standing where the planks have gone: the load can't go on)
      if (r.lost > 20 || !c) { cr.made = false; cr.stopAt = x; break; }
    }
    cr.sag = r4(cr.sag);
    if (cr.made) rating = li;
    if (onPart) onPart({ part: 'crossing', index: li, crossing: cr, rating });
    if (!cr.made) break;
  }
  const deck = state.deck ? { ...state.deck, planks: state.deck.planks.filter((p) => state.boards.some((b) => b.id === p.id)) } : null;
  const standing = { S: br.S, D: br.D, boards: state.boards.filter((b) => !b.plank), deck };
  return { calm, crossings, rating, standing, stood: !any, ms: Math.round((now() - t0) * 10) / 10, solves: opts.solves, models: state.models };
}

// For the rigs and the hand checks: one set of weights on the bridge as built, nothing giving way. weights: parts on the
// deck ([{ X, Z, lb }], as a load's partsAt gives them) and/or pushes right on boards ([{ id, s, f: [X, Y, Z] }]).
// -> { u, M, chk, force (per board id: { N (pull, pounds; a squeeze is negative), M (the most bending, pound-feet) }),
//      reactions ([{ P, n, press, along }]), sag, lam }
export function solveLoads(bridge, { parts = [], pushes = [], buckle = true, selfWeight = true } = {}) {
  const br = { S: bridge.S, D: bridge.D, boards: bridge.boards, deck: bridge.deck, roller: bridge.roller, pins: bridge.pins };
  const planks = bridge.deck ? bridge.deck.planks : [];
  const state = { br, boards: [...bridge.boards, ...planks], deck: bridge.deck, cuts: [], hinges: [], gone: [], slid: [], M: null, Mkey: '', models: 0 };
  const M = modelOf(state);
  if (!selfWeight) { M.Fg.fill(0); for (const e of M.elems) e.fg.fill(0); }
  const info = deckLoads(M, parts, bridge.deck);
  const byId = new Map(M.boards.map((b, i) => [b.id, i]));
  for (const p of pushes) { const bi = byId.get(p.id); if (bi !== undefined) info.loads.push({ b: bi, s: p.s, f: p.f }); }
  const live = loadVector(M, info.loads), sol = solve(M, live.F), chk = checkAll(M, sol, live, { buckle });
  const force = {};
  for (const it of chk.items) if (it.type === 'board') {
    const f = force[it.id] || (force[it.id] = { N: it.N, M: 0, Nmin: it.N, Nmax: it.N });
    f.M = Math.max(f.M, it.Ms, it.Mw); f.Nmin = Math.min(f.Nmin, it.N); f.Nmax = Math.max(f.Nmax, it.N);
    if (Math.abs(it.N) > Math.abs(f.N)) f.N = it.N;
  }
  const reactions = chk.items.filter((it) => it.type === 'slide').map((it) => ({ P: it.P, press: it.press, along: it.along, kind: it.kind, bank: it.bank }));
  return { u: sol.u, M, chk, force, reactions, sag: chk.sag, lam: chk.lam, unstable: sol.unstable, live };
}
// the pull (+) or squeeze (-) in a board s feet along it (pounds), as the check found it: the piece there
export function forceAt(res, id, s) {
  const M = res.M, bi = M.boards.findIndex((b) => b.id === id); if (bi < 0) return null;
  const es = M.elemsOf[bi], k = es.findIndex((e) => s >= M.elems[e].t0 - 1e-5 && s <= M.elems[e].t0 + M.elems[e].L + 1e-5);
  const boardItems = res.chk.items.filter((it) => it.type === 'board' && it.b === bi);
  return boardItems[k < 0 ? 0 : k].N;
}
// how far a point on a board moved (feet, [X, Y, Z]): s feet along it, between its nodes by the beam's own shape
export function moveAt(res, id, s) {
  const M = res.M, bi = M.boards.findIndex((b) => b.id === id); if (bi < 0) return null;
  const es = M.elemsOf[bi]; if (!es.length) return null;
  const k = es.find((e) => s >= M.elems[e].t0 - 1e-5 && s <= M.elems[e].t0 + M.elems[e].L + 1e-5) ?? (s < M.elems[es[0]].t0 ? es[0] : es[es.length - 1]);
  const el = M.elems[k], ue = new Float64Array(12), ul = new Float64Array(12);
  for (let p = 0; p < 12; p++) ue[p] = res.u[el.dof[p]];
  vecToLocal(el.R, ue, ul);
  const L = el.L, xi = clamp((s - el.t0) / L, 0, 1), x2 = xi * xi, x3 = x2 * xi;
  const N1 = 1 - 3 * x2 + 2 * x3, N2 = L * (xi - 2 * x2 + x3), N3 = 3 * x2 - 2 * x3, N4 = L * (x3 - x2);
  const loc = [(1 - xi) * ul[0] + xi * ul[6], N1 * ul[1] + N2 * ul[5] + N3 * ul[7] + N4 * ul[11], N1 * ul[2] - N2 * ul[4] + N3 * ul[8] - N4 * ul[10]];
  // (plus each weight on the piece's own bend, as a beam held fixed at both nodes: Roark's fixed-fixed beam)
  const x = s - el.t0, fixed = (P, a, EI) => { const b = L - a, [xx, aa, bb] = x <= a ? [x, a, b] : [L - x, b, a]; return P * bb * bb * xx * xx * (3 * aa * L - 3 * aa * xx - bb * xx) / (6 * EI * L ** 3); };
  for (const q of (res.live && res.live.pts.get(k)) || []) { loc[1] += fixed(q.f[1], q.x, WOOD.E * el.sec.I); loc[2] += fixed(q.f[2], q.x, WOOD.E * el.sec.Iw); }
  return [0, 1, 2].map((c) => el.R[c] * loc[0] + el.R[3 + c] * loc[1] + el.R[6 + c] * loc[2]);
}
// the deck a bridge would get: bridge.js deckLine, here too for the rigs
export { deckLine };
export const internals = { prep, findHubs, classify, buildModel, solve, checkAll, buckling, deckLoads, loadVector, modelOf, settle, giveWay, standAt, localK };
