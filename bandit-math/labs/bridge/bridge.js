// THE BRIDGE AS DATA: the river gap, its two stone abutments, the boards, and the deck. No drawing here and no three.js,
// so node can load it for the tests and rigs as well as the page. It follows the windmill lab's tower.js (and imports
// everything there that is not about a tower: lengths in words, the free end, connecting, sawing off the extra).
//
//   bridge = { S, D, boards: [board, ...], deck }
//   board  = { id, a: { X, Y, Z }, b: { X, Y, Z }, len }                   (the windmill's free board, unchanged)
//   deck   = null, or { y, on: [ids of the horizontal boards it rests on], planks: [plank, ...] }
//   plank  = { id, a, b, len, X, plank: true, n: { X: 0, Y: 1, Z: 0 } }  (a 2 by 8 inch plank laid flat across)
//
// Feet. X runs across the river from west to east (the west bank at X <= -S/2, the east bank at X >= S/2: S is the gap
// between the two stone faces), Y up (the top of both abutments at Y = 0, the water below), Z along the river from north
// to south (the windmill's compass: its north wind blows toward +Z): the bridge's two sides stand at Z = +D/2 (the south
// side, toward the camera at the start) and Z = -D/2 (the north side). The middle of the gap is at X = Z = 0. Every
// word a player reads uses the compass (west and east banks, north and south sides), never front, back, left or right:
// the camera walks round, and those would change with it.
//
// Where a board can rest (supportsOf): on the top of an abutment (the stone, and the bank behind it), and against the
// stone face of an abutment, above the water. Nothing else holds a board up but other boards. A board's first end goes
// in a SOCKET: a spot on the half foot on an abutment's top or face, or along a board (as the windmill's).
import { BOARD_FT, SNAP, lenWords, lenLabel, spellUnits, roundPt, along, reachOn, connectTo, connectAlong, offcutOf, makeBoard, crossesMid, isPost, isLevelB, isUprightB } from '../windmill/tower.js';
import { touch3, TOL, joints3 } from '../windmill/touch.js';

export { BOARD_FT, SNAP, lenWords, lenLabel, spellUnits, roundPt, along, reachOn, connectTo, connectAlong, offcutOf, makeBoard, crossesMid, isPost, isLevelB, isUprightB, TOL };

export const SPAN0 = 16;              // the gap between the two stone faces at the start, feet
export const SPAN_MIN = 6, SPAN_MAX = 24;
export const WIDTH = 7;               // the bridge's two sides stand this far apart (centre to centre): a wagon fits
export const STONE_BACK = 3;          // feet of stone on each abutment's top, back from its edge (sockets there)
export const BANK_BACK = 10;          // the flat top of the bank a board can rest on, back from the edge
export const FACE_DOWN = 4;           // feet of an abutment's face above the water that sockets go down to
export const ABUT_HALF = WIDTH / 2 + 2;  // the abutments are this far each way from the middle along the river (Z)
export const WATER_Y = -4.5, BED_Y = -6.5;
export const BOARDS = 30;             // full boards in a fresh stack
export const PLANKS = 36;             // deck planks on their own pile: enough for the widest gap
// a deck plank: 2 by 8 inches (1½ by 7¼), laid flat across both sides, one every 8 inches, its ends flush with the
// outer faces of the boards it rests on. Its line in the data sits DECK_LIFT above theirs (within TOL, so it touches
// them); it is drawn resting on top of them.
export const PLANK = { w: 7.25 / 12, t: 1.5 / 12, pitch: 8 / 12, over: 0.75 / 12 };
export const DECK_LIFT = 0.19;
// how a board's wide face is worked out in the windmill's frame (frame.js faceNormal): posts face out of the nearer
// side of the footprint. The bridge passes this as the footprint's width along X, so every post faces along Z: its
// thin way across the side it stands in, as a truss's posts are laid.
export const FACE_W = 1e4;

const r6 = (v) => { const r = Math.round(v * 1e6) / 1e6; return r === 0 ? 0 : r; };
const d3 = (p, q) => Math.hypot(p.X - q.X, p.Y - q.Y, p.Z - q.Z);
const near = (p, q, e = 1e-4) => Math.abs(p.X - q.X) < e && Math.abs(p.Y - q.Y) < e && Math.abs(p.Z - q.Z) < e;

// The free end of a board len feet long from its socket A, moved dx along X and dz along Z: its height from its length
// (up, or down when up = -1). The windmill's freeEnd (tower.js), but a bridge's boards hang down into the gap: never
// below the river's water (the windmill's never below the ground). null when it can't reach that far over.
export function freeEnd(A, len, dx, dz, up = 1) {
  const run2 = dx * dx + dz * dz;
  if (run2 > len * len + 1e-9) return null;
  const h = Math.sqrt(Math.max(0, len * len - run2)), Y = A.Y + (up < 0 ? -h : h);
  if (Y < WATER_Y - 1e-6) return null;
  return roundPt({ X: A.X + dx, Y, Z: A.Z + dz });
}
// ── dragging the free end: the board swings about its socket in one upright plane ───────────────────────────────
// The plane is the one facing the camera, picked once when the drag starts: looking north or south it runs east-west
// through the socket (Z stays the socket's own), looking west or east it runs north-south (X stays the socket's own).
export const planeFor = (view) => (Math.abs(view.X) > Math.abs(view.Z) ? 'Z' : 'X');
export const LEVEL_SNAP = 4 * Math.PI / 180;   // within this of level (or straight up / down) the board snaps there
// Where the free end of a board len feet long from socket A lies when the finger's spot on the plane is Q; `ax` is
// the plane's flat axis ('X' or 'Z'). Smooth, following the finger, except: within LEVEL_SNAP of level or straight
// up/down it snaps there, otherwise its rise is to the whole inch. Never below the water. -> point
export function swingEnd(A, len, ax, Q) {
  const h = Q[ax] - A[ax], v = Q.Y - A.Y;
  let th = Math.atan2(v, Math.abs(h) < 1e-9 && Math.abs(v) < 1e-9 ? 0 : h);
  const sd = h < 0 ? -1 : 1;            // which way along the flat axis
  const lev = Math.min(Math.abs(th), Math.abs(Math.PI - Math.abs(th))), upr = Math.abs(Math.PI / 2 - Math.abs(th));
  let rise, run;
  if (lev < LEVEL_SNAP) { rise = 0; run = sd * len; }
  else if (upr < LEVEL_SNAP) { rise = th > 0 ? len : -len; run = 0; }
  else {
    rise = Math.round(len * Math.sin(th) * 12) / 12;
    if (Math.abs(rise) > len) rise = Math.sign(rise) * len;
    run = sd * Math.sqrt(Math.max(0, len * len - rise * rise));
  }
  if (A.Y + rise < WATER_Y) { rise = Math.ceil((WATER_Y - A.Y) * 12 - 1e-9) / 12; run = sd * Math.sqrt(Math.max(0, len * len - rise * rise)); }
  const B = { X: A.X, Y: A.Y + rise, Z: A.Z }; B[ax] += run;
  return roundPt(B);
}
// ── the arrows: the free end moved across the board ──────────────────────────────────────────────────────────────
// Which arrow pairs show for a board from A to B: the two axes running most across it (the two smallest parts of its
// direction); the third runs along it. -> { along, across: [two of 'X', 'Y', 'Z'] }
const AXES = ['X', 'Y', 'Z'];
export function arrowAxes(A, B) {
  const d = AXES.map((k) => Math.abs(B[k] - A[k])), i = d.indexOf(Math.max(...d));
  return { along: AXES[i], across: AXES.filter((k, j) => j !== i) };
}
const nextHalf = (x, sg) => (sg > 0 ? Math.floor(x / SNAP + 1e-6) + 1 : Math.ceil(x / SNAP - 1e-6) - 1) * SNAP;
// the stops on an axis beyond v, nearest first: every half foot from the world's zero (the middle of the gap for X, the
// bank top for Y, the bridge's centre line for Z), and the socket's own place on that axis (so level, straight up and
// square across are always stops)
export function stopsFrom(v, sg, own) {
  const out = [];
  for (let k = 0, x = v; k < 60; k++) { x = nextHalf(x, sg); out.push(x); }
  if ((own - v) * sg > 1e-6) out.push(own);
  return [...new Set(out.map((x) => Math.round(x * 1e6) / 1e6))].sort((p, q) => (p - q) * sg);
}
// One press of an arrow: the free end B of a board len feet long from its socket A moved to the next stop it can reach on
// axis ax (one of the two across it) in direction sg; the other across axis kept; the axis along the board from its
// length, on the same side of the socket. A stop out of reach (or under the water) is skipped for the next one that way.
// -> the new free end, or null (that arrow isn't showing, or the board is too short to reach any stop that way)
export function arrowStep(A, B, len, ax, sg) {
  const { along, across } = arrowAxes(A, B);
  if (!across.includes(ax)) return null;
  const other = across.find((k) => k !== ax), side = Math.sign(B[along] - A[along]) || 1, keep = B[other] - A[other];
  for (const c of stopsFrom(B[ax], sg, A[ax])) {
    const r2 = len * len - (c - A[ax]) ** 2 - keep * keep;
    if (r2 < -1e-9) continue;
    const q = { [ax]: c, [other]: B[other], [along]: A[along] + side * Math.sqrt(Math.max(0, r2)) };
    if (q.Y < WATER_Y - 1e-6) continue;
    return roundPt(q);
  }
  return null;
}
export function newBridge(S = SPAN0, D = WIDTH) { return { S, D, boards: [], deck: null }; }
// the bridge as the windmill's modules want a tower: { W, D, boards } (the deck planks included when asked)
export const asTower = (br, withDeck = false) => ({ W: FACE_W, D: br.D, boards: withDeck && br.deck ? [...br.boards, ...br.deck.planks] : br.boards });
export function cleanBridge(br) {
  return { S: br.S, D: br.D ?? WIDTH, boards: (br.boards || []).map((b) => ({ id: b.id, a: roundPt(b.a), b: roundPt(b.b), len: b.len ?? d3(b.a, b.b) })),
    deck: br.deck ? { y: br.deck.y, on: [...br.deck.on], planks: br.deck.planks.map((p) => ({ ...p, a: { ...p.a }, b: { ...p.b }, n: { X: 0, Y: 1, Z: 0 }, plank: true })) } : null };
}
export const boardCount = (br) => br.boards.length;
// Is a spot already taken? A board lying along the same line over more than half of the shorter of the two (the rule the
// ✓ uses). (The windmill's spotTaken calls any overlap taken; a bridge's bottom boards are lapped end over end, and a
// lapped board's twin is lapped too.)
export function spotTaken(br, g) {
  const len = g.len || d3(g.a, g.b), dx = (g.b.X - g.a.X) / len, dy = (g.b.Y - g.a.Y) / len, dz = (g.b.Z - g.a.Z) / len;
  return br.boards.some((b) => {
    for (const p of [b.a, b.b]) {
      const vx = p.X - g.a.X, vy = p.Y - g.a.Y, vz = p.Z - g.a.Z, s = vx * dx + vy * dy + vz * dz;
      if (Math.hypot(vx - s * dx, vy - s * dy, vz - s * dz) > 0.2) return false;
    }
    const s0 = (b.a.X - g.a.X) * dx + (b.a.Y - g.a.Y) * dy + (b.a.Z - g.a.Z) * dz, s1 = (b.b.X - g.a.X) * dx + (b.b.Y - g.a.Y) * dy + (b.b.Z - g.a.Z) * dz;
    return Math.min(len, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1)) > 0.5 * Math.min(len, b.len || d3(b.a, b.b));
  });
}
export const bridgeHeight = (br) => br.boards.reduce((h, b) => Math.max(h, b.a.Y, b.b.Y), 0);

// ── where the banks hold a board up ─────────────────────────────────────────────────────────────────────────────────
// A spot resting on an abutment: { kind: 'top' (on its top: the stone, or the flat bank behind it) | 'face' (against its
// stone face, above the water), bank (-1 west, 1 east), n (the way the stone pushes back: up, or out of the face into
// the gap, as [X, Y, Z]) } or null
export function supportAt(br, p) {
  const h = br.S / 2, ax = Math.abs(p.X), bank = p.X < 0 ? -1 : 1;
  if (Math.abs(p.Z) > ABUT_HALF + 1e-6) return null;
  if (Math.abs(p.Y) <= TOL && ax >= h - TOL && ax <= h + BANK_BACK) return { kind: 'top', bank, n: [0, 1, 0] };
  if (Math.abs(ax - h) <= TOL && p.Y < -TOL && p.Y >= WATER_Y) return { kind: 'face', bank, n: [-bank, 0, 0] };
  return null;
}
// Where a board rests on the banks: [{ t (feet along it from its a end), P, kind, bank, n }].
// A board lying across a bank's edge (along the top, over the edge into the gap) bears right at the edge, where the stone
// stops: it tips about it, so that is where the bank holds it (its end further back on the stone just lies there). A
// board standing or lying with an end on a bank's top or against its face (a post's foot, a strut's foot pushed into the
// stone) rests on that end. A board lying wholly on a bank's top rests on both its ends.
export function supportsOf(br, b) {
  const out = [], L = d3(b.a, b.b) || 1, h = br.S / 2, edges = new Set();
  for (const bank of [-1, 1]) {
    const X0 = bank * h, dx = b.b.X - b.a.X;
    if (Math.abs(dx) < 1e-9) continue;
    const k = (X0 - b.a.X) / dx;
    if (k <= 0.02 || k >= 0.98) continue;
    const P = { X: X0, Y: b.a.Y + (b.b.Y - b.a.Y) * k, Z: b.a.Z + (b.b.Z - b.a.Z) * k };
    if (Math.abs(P.Y) <= TOL && Math.abs(P.Z) <= ABUT_HALF) { out.push({ t: k * L, P: { ...P, Y: 0 }, kind: 'top', bank, n: [0, 1, 0] }); edges.add(bank); }
  }
  for (const [P, t] of [[b.a, 0], [b.b, L]]) {
    const s = supportAt(br, P); if (!s) continue;
    if (s.kind === 'top' && edges.has(s.bank)) continue;
    out.push({ t, P: { X: P.X, Y: s.kind === 'top' ? 0 : P.Y, Z: P.Z }, ...s });
  }
  return out;
}
// does a board touch anything: a board, or a bank?
export function touchesAny(br, g, boards = br.boards) {
  if (supportsOf(br, g).length) return true;
  return boards.some((o) => o !== g && touch3(g, o).length > 0);
}
// what a board touches: [{ X, Y, Z, t, other (a board, or null for a bank), end ('a', 'b' or null) }]
export function contactsOf(br, me, boards = br.boards) {
  const out = [], L = me.len || d3(me.a, me.b), endOf = (t) => (t < TOL ? 'a' : t > L - TOL ? 'b' : null);
  for (const o of boards) { if (o === me || o.id === me.id) continue; for (const c of touch3(me, o)) out.push({ X: c.X, Y: c.Y, Z: c.Z, t: c.ti, other: o, end: endOf(c.ti) }); }
  for (const s of supportsOf(br, me)) out.push({ ...s.P, t: s.t, other: null, end: endOf(s.t), bank: s.bank, kind: s.kind });
  return out;
}
// which boards reach a bank through their joints (the rest would come down): a Set of boards
export function grounded(br, boards = br.boards) {
  const links = new Map(), held = new Set();
  const link = (a, b) => { (links.get(a) || links.set(a, new Set()).get(a)).add(b); (links.get(b) || links.set(b, new Set()).get(b)).add(a); };
  for (const h of joints3(boards, { ground: false })) { const bs = h.items.map((it) => boards[it.i]); for (let k = 1; k < bs.length; k++) link(bs[0], bs[k]); }
  for (const b of boards) if (supportsOf(br, b).length) held.add(b);
  const reach = new Set(held), stack = [...held];
  while (stack.length) { const s = stack.pop(); for (const o of links.get(s) || []) if (!reach.has(o)) { reach.add(o); stack.push(o); } }
  return reach;
}

// ── sockets: where a board's first end can go ───────────────────────────────────────────────────────────────────────
// On each abutment: its top, on the half foot from its edge back over the stone (STONE_BACK), across the bridge's width;
// its face, on the half foot down from the top (FACE_DOWN); and along every board at half-foot steps from either end.
// -> [{ X, Y, Z, on (the board, or null on a bank), s, bank, kind }]
export function socketsOf(br) {
  const out = [], h = br.S / 2, nz = Math.round(br.D / SNAP);
  for (const bank of [-1, 1]) for (let j = 0; j <= nz; j++) {
    const Z = r6(-br.D / 2 + j * SNAP);
    for (let i = 0; i <= Math.round(STONE_BACK / SNAP); i++) out.push({ X: r6(bank * (h + i * SNAP)), Y: 0, Z, on: null, s: 0, bank, kind: 'top' });
    for (let i = 1; i <= Math.round(FACE_DOWN / SNAP); i++) out.push({ X: r6(bank * h), Y: r6(-i * SNAP), Z, on: null, s: 0, bank, kind: 'face' });
  }
  for (const b of br.boards) {
    const ss = new Set();
    for (let s = 0; s <= b.len + 1e-6; s += SNAP) { ss.add(r6(s)); ss.add(r6(b.len - s)); }
    for (const s of [...ss].sort((p, q) => p - q)) {
      if (s < -1e-6 || s > b.len + 1e-6) continue;
      const p = roundPt(along(b, s));
      if (out.some((q) => (q.on ? near(q, p, 0.02) : near(q, p, 0.05)))) continue;
      out.push({ ...p, on: b, s });
    }
  }
  return out;
}
// is a point where a board may go? Over the gap and the stone (and a little past), across the bridge's width and a foot
// past it, from the water up to 16 feet
export const inBounds = (br, p) => Math.abs(p.Z) <= br.D / 2 + 1 + 1e-6 && Math.abs(p.X) <= br.S / 2 + STONE_BACK + 1 + 1e-6 && p.Y >= WATER_Y + 0.5 - 1e-6 && p.Y <= 16;

// ── twins: the same board mirrored across the middle of the gap, and front to back ──────────────────────────────────
// The bridge is the same seen from either bank and from either side, so a board's twins are its images mirrored front to
// back (Z: the other side of the bridge), across the middle of the gap (X: the other end of the same side), and both.
// Tried in that order; an image is offered unless it lands on the board or a twin already offered, crosses one through
// both their middles (that X is the builder's call), leaves the bounds, or touches nothing. -> [{ a, b, len }]
export function twinsOf(br, board, touches = (g) => touchesAny(br, g)) {
  const maps = [(p) => ({ X: p.X, Y: p.Y, Z: -p.Z }), (p) => ({ X: -p.X, Y: p.Y, Z: p.Z }), (p) => ({ X: -p.X, Y: p.Y, Z: -p.Z })];
  const same = (g, b) => (near(g.a, b.a) && near(g.b, b.b)) || (near(g.a, b.b) && near(g.b, b.a));
  const kept = [];
  // (the copies across the width first: the same board at every parallel stringer of the ones it is nailed to, then
  // each of those and the board itself mirrored across the middle and end to end)
  const bases = [board, ...acrossCopies(br, board)];
  for (const base of bases) {
    for (const f of [null, ...maps]) {
      const g = f ? { a: roundPt(f(base.a)), b: roundPt(f(base.b)), len: board.len } : base;
      if (g === board || same(g, board) || kept.some((k) => same(k, g))) continue;
      if ([board, ...kept].some((o) => crossesMid(g, o))) continue;
      if (!inBounds(br, g.a) || !inBounds(br, g.b)) continue;
      if (spotTaken(br, g)) continue;
      if (touches && !touches(g)) continue;
      kept.push(g);
    }
  }
  // (nearest the board first: building them all with too little wood builds the nearest)
  const mid = (q) => ({ X: (q.a.X + q.b.X) / 2, Y: (q.a.Y + q.b.Y) / 2, Z: (q.a.Z + q.b.Z) / 2 }), m0 = mid(board);
  return kept.sort((p, q) => d3(mid(p), m0) - d3(mid(q), m0));
}
// The stringers a board is nailed to (level boards running along the gap, X), and the board moved across the width onto
// each other stringer at the same height running the same way that reaches the same spot: [{ a, b, len }]
const runsX = (b) => Math.abs(b.a.Y - b.b.Y) < 0.05 && Math.abs(b.a.Z - b.b.Z) < 0.05 && Math.abs(b.a.X - b.b.X) > 0.5;
function acrossCopies(br, board) {
  const out = [], lo = (b) => Math.min(b.a.X, b.b.X), hi = (b) => Math.max(b.a.X, b.b.X);
  if (runsX(board)) return out;   // (a stringer itself: its twins are the mirrors)
  const on = br.boards.filter((o) => o !== board && o.id !== board.id && runsX(o) && touch3(board, o).length);
  if (!on.length) return out;
  const t = on[0], y = t.a.Y, z0 = t.a.Z;
  // where along the stringer the board meets it
  const P = touch3(board, t)[0], px = P ? (P.X ?? P.P?.[0] ?? (lo(t) + hi(t)) / 2) : (lo(t) + hi(t)) / 2;
  const zs = new Set();
  for (const o of br.boards) {
    if (o === t || !runsX(o) || Math.abs(o.a.Y - y) > 0.06 || Math.abs(o.a.Z - z0) < 0.2) continue;
    if (px < lo(o) - 1e-6 || px > hi(o) + 1e-6) continue;
    zs.add(Math.round((o.a.Z - z0) * 1e4) / 1e4);
  }
  for (const dz of zs) out.push({ a: roundPt({ ...board.a, Z: board.a.Z + dz }), b: roundPt({ ...board.b, Z: board.b.Z + dz }), len: board.len });
  return out;
}

// ── the deck ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE DECK MEETS THE ROAD: it rests on a horizontal board line on each side at road height (the stone tops, Y = 0, within
// ROAD_TOL: a board lying on the stones), so the planks run on from the road with no step down or up. A side's line: the
// horizontal boards on that side (both ends within 0.15 ft of Z = +D/2, or of -D/2) at road height, touching each other
// end to end or lapped, reaching from the west bank's edge to the east bank's. Boards lower down (a truss or supports
// under the deck) or higher up (a side rail) are fine, but the deck never lies on them: never a sunk or raised deck.
// -> { y, on: [ids], planks: [...] } or { why (in words), missing: ['front' | 'back'], low (the height of a side line
//    lower down that reaches bank to bank, if any: what the builder may have meant) }
export const ROAD_TOL = 0.1;
export function deckLine(br) {
  const h = br.S / 2, D = br.D;
  // a side's lines from bank to bank: [{ y, ids }], any height
  const sideLines = (s) => {
    const mine = br.boards.filter((b) => Math.abs(b.a.Y - b.b.Y) < 0.05 && Math.abs(b.a.Z - s * D / 2) < 0.15 && Math.abs(b.b.Z - s * D / 2) < 0.15);
    const ys = [...new Set(mine.map((b) => Math.round(((b.a.Y + b.b.Y) / 2) * 20) / 20))].sort((p, q) => p - q);
    const lines = [];
    for (const y of ys) {
      const at = mine.filter((b) => Math.abs((b.a.Y + b.b.Y) / 2 - y) < 0.06);
      // the chain from the board reaching the west edge, along boards that touch, to one reaching the east edge
      const lo = (b) => Math.min(b.a.X, b.b.X), hi = (b) => Math.max(b.a.X, b.b.X);
      const start = at.filter((b) => lo(b) <= -h + 1e-6);
      const seen = new Set(start), stack = [...start];
      while (stack.length) { const b = stack.pop(); for (const o of at) if (!seen.has(o) && touch3(b, o).length) { seen.add(o); stack.push(o); } }
      const chain = [...seen];
      if (chain.some((b) => hi(b) >= h - 1e-6)) lines.push({ y, ids: chain.map((b) => b.id) });
    }
    return lines;
  };
  const F = sideLines(1), B = sideLines(-1), road = (L) => L.find((l) => Math.abs(l.y) <= ROAD_TOL + 1e-9);
  const f = road(F), bk = road(B);
  if (!f || !bk) {
    const missing = [...(f ? [] : ['south']), ...(bk ? [] : ['north'])];
    const lowF = F.find((l) => l.y < -ROAD_TOL), lowB = B.find((l) => l.y < -ROAD_TOL), low = lowF || lowB ? Math.max(lowF ? lowF.y : -Infinity, lowB ? lowB.y : -Infinity) : null;
    const where = missing.length === 2 ? 'put a board on each side from the top of one stone to the other' : `the ${missing[0]} side needs a board from the top of one stone to the other`;
    const lowWords = low !== null ? ` Your boards from bank to bank are ${lenWords(Math.round(-low * 2) / 2)} below the road: they can hold the deck up from underneath, but the planks lie on boards at road height.` : '';
    return { why: `The deck has to meet the road: ${where}.${lowWords}`, missing, low };
  }
  // (and any other horizontal board at road height between the two sides, running along the gap under the planks: a
  // middle board the planks rest on as well)
  const between = br.boards.filter((b) => !f.ids.includes(b.id) && !bk.ids.includes(b.id) && Math.abs(b.a.Y - f.y) < 0.06 && Math.abs(b.b.Y - f.y) < 0.06
    && Math.abs(b.a.Z - b.b.Z) < 0.05 && Math.abs(b.a.Z) < D / 2 - 0.2 && Math.abs(b.b.X - b.a.X) > 0.5).map((b) => b.id);
  return { y: f.y, on: [...f.ids, ...bk.ids, ...between], planks: planksFor(br, f.y) };
}
// the deck planks across the gap at height y (the boards' line): one every 8 inches, from the west edge to the east
export function planksFor(br, y) {
  const h = br.S / 2, out = [], L = br.D + 2 * PLANK.over;
  let k = 0;
  for (let X = -h + PLANK.pitch / 2; X <= h - PLANK.pitch / 2 + 1e-6; X += PLANK.pitch) {
    const x = r6(X), Y = r6(y + DECK_LIFT);
    out.push({ id: 'k' + (++k), a: { X: x, Y, Z: r6(-L / 2) }, b: { X: x, Y, Z: r6(L / 2) }, len: r6(L), X: x, plank: true, n: { X: 0, Y: 1, Z: 0 } });
  }
  return out;
}

// ── where a board is, in words ───────────────────────────────────────────────────────────────────────────────────────
// post (standing straight up), diagonal (slanting), horizontal board, deck plank. Where: its side ("on the south side",
// "on the north side", "across the middle"), and along the gap ("near the west bank", "in the middle", "on the east bank"),
// to the half foot from the nearer bank when it is out over the water ("4 ft out from the west bank").
export function nounOf(b) {
  if (b.plank) return 'deck plank';
  if (isUprightB(b)) return 'post';
  return isLevelB(b) ? 'horizontal board' : 'diagonal';
}
export function sideOfBoard(b, br) {
  const Z = (b.a.Z + b.b.Z) / 2, X = (b.a.X + b.b.X) / 2, h = br.S / 2, ez = br.D / 4;
  const side = b.plank ? 'across' : Z > ez ? 'south' : Z < -ez ? 'north' : 'across';
  const span = X <= -h + 0.05 ? 'west bank' : X >= h - 0.05 ? 'east bank' : Math.abs(X) <= 1 ? 'middle' : X < 0 ? 'west' : 'east';
  return { side, span, out: Math.round((h - Math.abs(X)) * 2) / 2 };
}
export function whereWords(b, br) {
  const { side, span, out } = sideOfBoard(b, br);
  const sd = side === 'south' || side === 'north' ? ` on the ${side} side` : b.plank ? '' : ' across the middle';
  const sp = span === 'west bank' || span === 'east bank' ? `, on the ${span}` : span === 'middle' ? ', in the middle of the gap' : out < 0.75 ? `, at the ${span} bank` : `, ${lenLabel(out)} out from the ${span} bank`;
  const lo = Math.min(b.a.Y, b.b.Y), hi = Math.max(b.a.Y, b.b.Y);
  const wall = Math.abs(Math.abs(b.a.X) - br.S / 2) < 0.3 && Math.abs(Math.abs(b.b.X) - br.S / 2) < 0.3;
  const down = lenLabel(Math.round(-lo * 2) / 2);
  const up = lo > 0.3 ? `, ${lenLabel(Math.round(lo * 2) / 2)} up` : hi < -0.3 ? `, ${down} ${wall ? 'down the stone wall' : 'below the deck'}`
    : lo < -0.3 ? `, reaching ${down} ${wall ? 'down the stone wall' : 'below the deck'}` : '';
  return sd + sp + up;
}
// a board's name in the bridge, as the card says it: a deck plank, a bottom board (one the deck rests on), the top
// board (the highest horizontal board on its side, over the deck), a horizontal board, a post, a diagonal
export function roleOf(br, b) {
  if (b.plank) return 'deck plank';
  if (br.deck && br.deck.on.includes(b.id)) return 'bottom board';
  const n = nounOf(b);
  if (n === 'horizontal board' && br.deck) {
    const y = (b.a.Y + b.b.Y) / 2, side = Math.sign((b.a.Z + b.b.Z) / 2);
    const same = br.boards.filter((o) => isLevelB(o) && Math.sign((o.a.Z + o.b.Z) / 2) === side && Math.abs(o.a.Z - o.b.Z) < 0.1);
    if (side && Math.abs(b.a.Z - b.b.Z) < 0.1 && y > br.deck.y + 1 && same.every((o) => (o.a.Y + o.b.Y) / 2 <= y + 0.05)) return 'top board';
    if (Math.abs(b.a.Z - b.b.Z) > 1) return 'cross piece';
  }
  return n;
}
export const placeWords = (br, b) => `the ${roleOf(br, b)}${whereWords(b, br)}`;
// a point from the middle of the gap, to the nearest inch, for the top bar: "3 ft west · 3 ft 6 in. south · 4 ft up"
// (the same numbers with the opposite words: the mirror image)
export function pointWords(p) {
  const r = (v) => Math.round(Math.abs(v) * 12) / 12, side = (v, pos, neg) => (r(v) < 1e-9 ? '0' : lenLabel(r(v)) + ' ' + (v > 0 ? pos : neg));
  return [side(p.X, 'east', 'west'), side(p.Z, 'south', 'north'), p.Y < -1e-6 && r(p.Y) > 1e-9 ? lenLabel(r(p.Y)) + ' down' : lenLabel(Math.max(0, r(p.Y))) + ' up'];
}

// ── a bridge as a short code (the result card's "Copy this bridge"; ?bridge=<code> in the address puts it up) ─────────
// The gap, the width, every board's two ends and length (to the ten-thousandth of a foot), and whether the deck was
// laid: JSON, then base64 made safe for an address. -> string; decodeBridge -> { S, D, boards, deck: bool } or null
export function encodeBridge(br) {
  const r = (v) => Math.round(v * 1e4) / 1e4;
  const o = { v: 1, S: br.S, D: br.D, deck: !!br.deck, b: br.boards.map((b) => [r(b.a.X), r(b.a.Y), r(b.a.Z), r(b.b.X), r(b.b.Y), r(b.b.Z), r(b.len)]) };
  return btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeBridge(code) {
  try {
    const s = String(code).trim().replace(/-/g, '+').replace(/_/g, '/'), o = JSON.parse(atob(s + '='.repeat((4 - (s.length % 4)) % 4)));
    if (!o || !Array.isArray(o.b) || !(o.S > 0)) return null;
    return { S: o.S, D: o.D || WIDTH, deck: !!o.deck, boards: o.b.map((q, i) => ({ id: 'c' + (i + 1), a: { X: q[0], Y: q[1], Z: q[2] }, b: { X: q[3], Y: q[4], Z: q[5] }, len: q[6] })) };
  } catch (e) { return null; }
}
