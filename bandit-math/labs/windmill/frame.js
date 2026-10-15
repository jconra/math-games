// THE PHYSICS OF ONE WALL, AND THE WIND TEST. Plain numbers, no three.js (node runs it for the rigs).
//
// How it works, in plain words:
//   * Every board is a stiff beam that can stretch a little and bend (a "frame element": each end can move sideways, up
//     and down, and turn, so three numbers per end; the standard textbook stiffness of a beam ties them together).
//   * Wherever two boards cross or touch they are nailed. A nailed spot is a JOINT: a small hub that the boards are tied
//     to by springs. A nail group lets a board slide a hair (a stiff spring) and turn a bit more (a soft turning spring),
//     and it can only take so much force and so much twisting before the nails pull out.
//   * Posts that stand on the hilltop are tied to the ground the same way (stronger: they sit on footing stones with an
//     iron strap).
//   * Loads: the tower's own weight, and the wind's push on every board, which grows with wind speed squared and a
//     little with height. The boards on the wall facing the wind take its full push; everything behind them (the far
//     wall, the far posts, the side walls' boards seen edge on) sits partly in their wind shadow, more so the more
//     solid the near wall is and the closer behind it they stand. The wind on the front face is carried down by the
//     two side walls (the walls whose plane it blows along): a board on the front hangs between their corner posts, so
//     each side wall takes the part of its push nearer its own corner, and each side wall takes the wind on its own
//     boards. The two side walls are tied together at every storey by the front and back walls' crosspieces and
//     braces, nailed to their corner posts: a side wall that leans further than the other bends those boards the thin
//     way, and they hand part of its push across to the steadier wall (ties, below). Only part: the tie boards bend and
//     their corner nails turn, so a wall with no brace of its own still leans more and racks first.
//   * We solve "stiffness times movement = load" for every joint and board end at once (one big set of equations), then
//     solve again with the weight leaning on the movement (a tall tower that sways a bit is pushed further by its own
//     weight), and check: did any nail group get more force or twist than it holds, did any board bend or squash past
//     what it holds (a long board in compression buckles sideways long before it crushes), and did the wall sway so far
//     that it is folding over (a square with no brace in it has nothing stopping it but the nails' grip, so it RACKS:
//     folds sideways like a card table)? A post whose top is nailed to nothing (a post standing on its own, or one
//     sticking up past the last crosspiece) is checked the same way: if its top leans further than that, it is
//     bending over.
//   * A brace makes a triangle, and a triangle can't change shape without stretching a board, which boards hardly do;
//     the wind's push turns into a straight pull or push along the brace. The flatter or steeper the brace, the more
//     force it needs to carry the same push (and a long one buckles), so near 45 degrees is best. A short knee brace
//     helps, but it acts on a short lever, so its nails carry several times the wind's push.
//   * The width between the footing stones shows up twice. In each wall: the narrower the wall, the harder the posts
//     are pulled and squeezed to hold the tower up against the wind, and the steeper (weaker) a brace corner to corner
//     has to be. And for the whole tower: it can tip over in one piece on its downwind stones, like a box on a table,
//     when the wind's turning push beats its weight and the stones it has to lift (tipping, below).
//
// Units: feet, pounds, radians.
import { faceSegments, worldBoards, FACE_NORMAL, trimTower, towerHeight, woodFeet, ends } from './tower.js';

// ── the wood and the nails (a 2x4: 1.5 by 3.5 inches, nailed flat against the wall, so it bends on its wide side) ──────
export const WOOD = {
  E: 1.6e6 * 144,                     // stiffness of pine, pounds per square foot
  A: (1.5 * 3.5) / 144,               // cross-section, square feet
  I: (1.5 * 3.5 ** 3 / 12) / 20736,   // bending in the wall's plane, feet^4
  Iweak: (3.5 * 1.5 ** 3 / 12) / 20736, // bending out of the wall (the thin way: how a pushed board buckles)
  weight: 1.3,                        // pounds per foot
  bendHolds: 1500,                    // pound-feet of bending before the board snaps
  pullHolds: 12000,                   // pounds of straight pull
  width: 3.5 / 12, thick: 1.5 / 12,   // feet
};
export const NAILS = {
  //            slide spring (lb/ft)  turn spring (lb-ft per radian)  force it holds (lb)  twist it holds (lb-ft)
  face:   { kt: 2.2e5, kr: 2300,  holds: 750,  twist: 110 },   // three 16-penny nails through two boards lying face to face
  butt:   { kt: 6e4,   kr: 250,   holds: 180,  twist: 12 },    // two boards only touching end to end (a couple of slanted nails)
  ground: { kt: 1e6,   kr: 3000,  holds: 2200, twist: 160 },   // a post on its footing stone, strapped down
};
export const DRIFT_LIMIT = 1 / 30;    // a floor swaying sideways more than 1/30 of its height is folding over: it has racked
export const TOL = 0.2;               // feet: boards closer than this are touching (a 2x4 is 0.29 ft wide)

// the wind test: a breeze, then growing gusts. Speeds in miles per hour.
export const STAGES = [
  { name: 'Breeze', mph: 20 },
  { name: 'Stiff wind', mph: 35 },
  { name: 'Gust', mph: 50 },
  { name: 'Big gust', mph: 65 },
];
export const DRAG = 2.0;              // how hard wind pushes on a flat board (a drag coefficient)
// The wind shadow. A board on the far wall, straight behind the near wall's boards at its height, gets this share of
// the wind: 0.8 behind a near wall that is all gaps, less the more of the near wall is wood (about 0.6 on a 6 ft wall
// with posts and a brace, down to 0.15 behind a narrow, solid one). solidity: the part of the near wall that is wood.
export const leeShade = (solidity) => Math.max(0.15, Math.min(0.8, 0.8 - 1.4 * solidity));
// A board straight downwind of a post (the far post, and the side walls' boards, which run back from the near post
// edge on) is in that post's wake: close behind it most of the wind misses it, and the wind fills in again the further
// back it stands (half a foot back: 0.2 of the wind; 1½ ft: 0.4; 6 ft: 0.85). d: feet behind the post.
export const wakeShade = (d) => 1 - 0.9 * Math.exp(-Math.max(0, d) / (12 * WOOD.width));

// ── where boards touch: contacts, merged into joints (hubs) ─────────────────────────────────────────────────────────
// segs: [{ id, ax, ay, bx, by, len }]. Returns hubs: [{ x, y, ground, butt, items: [{ s (seg index), t (feet along) }] }]
export function findJoints(segs, { ground = true } = {}) {
  const raw = [];
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) for (const c of touch(segs[i], segs[j])) raw.push({ ...c, i, j });
  const hubs = [];
  const near = (x, y) => hubs.find((h) => Math.hypot(h.x - x, h.y - y) < TOL * 1.5);
  const add = (h, s, t) => { const o = h.items.find((it) => it.s === s); if (o) o.t = (o.t + t) / 2; else h.items.push({ s, t }); };
  for (const c of raw) {
    let h = near(c.x, c.y);
    if (!h) { h = { x: c.x, y: c.y, ground: false, butt: true, items: [] }; hubs.push(h); }
    if (!c.butt) h.butt = false;
    add(h, c.i, c.ti); add(h, c.j, c.tj);
  }
  if (ground) {
    segs.forEach((s, i) => {
      for (const [x, y, t] of [[s.ax, s.ay, 0], [s.bx, s.by, s.len]]) {
        if (y > TOL) continue;
        let h = hubs.find((q) => Math.hypot(q.x - x, q.y - y) < TOL * 1.5);
        if (!h) { h = { x, y: 0, ground: true, butt: false, items: [] }; hubs.push(h); }
        h.ground = true; h.butt = false; h.y = 0; add(h, i, t);
      }
    });
  }
  // a hub that ended up with one board and no ground is no joint
  return hubs.filter((h) => h.ground || h.items.length > 1);
}

// where two boards touch: a list of { x, y, ti, tj, butt } (ti, tj: feet along each board from its a end)
export function touch(p, q) {
  const dpx = (p.bx - p.ax) / p.len, dpy = (p.by - p.ay) / p.len, dqx = (q.bx - q.ax) / q.len, dqy = (q.by - q.ay) / q.len;
  const cross = dpx * dqy - dpy * dqx;
  if (Math.abs(cross) < 0.05) {
    // (nearly) parallel: they only touch if they lie along the same line
    const off = Math.abs((q.ax - p.ax) * dpy - (q.ay - p.ay) * dpx);
    if (off > TOL) return [];
    const t0 = (q.ax - p.ax) * dpx + (q.ay - p.ay) * dpy, t1 = (q.bx - p.ax) * dpx + (q.by - p.ay) * dpy;
    const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(p.len, Math.max(t0, t1));
    const same = dpx * dqx + dpy * dqy > 0 ? 1 : -1;
    const at = (t) => ({ x: p.ax + dpx * t, y: p.ay + dpy * t, ti: t, tj: clamp((t - t0) * same, 0, q.len) });
    if (hi - lo > TOL) return [{ ...at(lo), butt: false }, { ...at(hi), butt: false }];     // lapped side by side: nailed along the overlap
    if (hi - lo > -TOL) { const m = (lo + hi) / 2; return [{ ...at(clamp(m, 0, p.len)), butt: true }]; }   // end to end
    return [];
  }
  // crossing lines: where they meet, then the nearest point actually on each board
  const rx = q.ax - p.ax, ry = q.ay - p.ay;
  const tp = clamp((rx * dqy - ry * dqx) / cross, 0, p.len), tq = clamp((rx * dpy - ry * dpx) / cross, 0, q.len);
  // (nearest points on each board, then the gap between them)
  const px = p.ax + dpx * tp, py = p.ay + dpy * tp, qx = q.ax + dqx * tq, qy = q.ay + dqy * tq;
  // re-project each onto the other once, so an end that stops just short of a board still counts as touching it
  const tp2 = clamp((qx - p.ax) * dpx + (qy - p.ay) * dpy, 0, p.len), tq2 = clamp((px - q.ax) * dqx + (py - q.ay) * dqy, 0, q.len);
  const ax = p.ax + dpx * tp2, ay = p.ay + dpy * tp2, bx = q.ax + dqx * tq2, by = q.ay + dqy * tq2;
  const gap = Math.min(Math.hypot(px - qx, py - qy), Math.hypot(ax - qx, ay - qy), Math.hypot(px - bx, py - by));
  if (gap > TOL) return [];
  return [{ x: (px + qx) / 2, y: (py + qy) / 2, ti: tp, tj: tq, butt: false }];
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── the solve ───────────────────────────────────────────────────────────────────────────────────────────────────────
// segs: one wall's boards. loads: { side: [{ y, F }] sideways pushes (pounds, + = toward +x) handed to the joints nearest
// that height; down: [{ y, x, F }] extra weight from the walls at right angles }. weightShare(seg): how much of a board's
// weight this wall carries (corner posts are shared by two walls). Returns what broke (if anything) and how it moved.
// probes: [{ y, x }] spots to report on (windCase's ties): how far each moves under these loads without the weight
// leaning in (u0), and how far each moves for a one-pound push at each of them (flex[i][j]: at i, pushed at j).
export function solveWall(segs, loads, { weightShare = (s) => (s.post ? 0.5 : 1), pdelta = true, W, probes = null } = {}) {
  const hubs = findJoints(segs);
  // board nodes: one at every joint along each board
  const nodes = [];   // { s, t, x, y } or a hub node { hub }
  const boardNodes = segs.map(() => []);
  hubs.forEach((h, hi) => h.items.forEach((it) => {
    const list = boardNodes[it.s];
    let n = list.find((m) => Math.abs(nodes[m].t - it.t) < 0.05);
    if (n === undefined) { const s = segs[it.s], u = it.t / s.len; nodes.push({ s: it.s, t: it.t, x: s.ax + (s.bx - s.ax) * u, y: s.ay + (s.by - s.ay) * u }); n = nodes.length - 1; list.push(n); }
    it.node = n;
  }));
  // ...and at both ends of every board that is nailed anywhere (the bit past the last nail is a beam too: it catches
  // wind and has weight, and hangs on that nail)
  segs.forEach((s, si) => {
    const list = boardNodes[si]; if (!list.length) return;
    for (const t of [0, s.len]) if (!list.some((m) => Math.abs(nodes[m].t - t) < 0.05)) { nodes.push({ s: si, t, x: t ? s.bx : s.ax, y: t ? s.by : s.ay, free: true }); list.push(nodes.length - 1); }
  });
  boardNodes.forEach((list) => list.sort((a, b) => nodes[a].t - nodes[b].t));
  const hubNode = hubs.map((h) => { if (h.ground) return -1; nodes.push({ hub: h, x: h.x, y: h.y }); return nodes.length - 1; });
  const n = nodes.length * 3;
  if (!n) return { ok: true, hubs, nodes, worst: null, items: [] };

  const F = new Float64Array(n);
  // the weight: each board's pieces between its nodes put half their weight on each end
  segs.forEach((s, si) => {
    const list = boardNodes[si], w = WOOD.weight * weightShare(s);
    for (let k = 0; k + 1 < list.length; k++) { const L = nodes[list[k + 1]].t - nodes[list[k]].t; F[list[k] * 3 + 1] -= w * L / 2; F[list[k + 1] * 3 + 1] -= w * L / 2; }
  });
  // the pushes from outside (wind, and the weight of the walls at right angles), given to the joints nearest in height
  // (any point that can move: joints and board ends alike)
  const free = nodes.map((nd, i) => i);
  const nearestAt = (y, x) => {
    if (!free.length) return [];
    let best = Infinity; for (const i of free) best = Math.min(best, Math.abs(nodes[i].y - y));
    let set = free.filter((i) => Math.abs(nodes[i].y - y) < best + 0.3);
    if (x !== undefined) { const ed = set.filter((i) => Math.abs(nodes[i].x - x) < 1); if (ed.length) set = ed; }
    // a push lower than every joint goes straight into the ground
    if (y < Math.min(...free.map((i) => nodes[i].y)) * 0.5) return [];
    return set;
  };
  for (const p of loads.side || []) { const set = nearestAt(p.y, p.x); for (const i of set) F[i * 3] += p.F / set.length; }
  const probeSets = (probes || []).map((p) => nearestAt(p.y, p.x));
  for (const p of loads.down || []) { const set = nearestAt(p.y, p.x); for (const i of set) F[i * 3 + 1] -= p.F / set.length; }

  // the parts: beam pieces and nail springs
  const elems = [];
  segs.forEach((s, si) => { const list = boardNodes[si]; for (let k = 0; k + 1 < list.length; k++) elems.push({ s: si, a: list[k], b: list[k + 1] }); });
  const springs = [];
  hubs.forEach((h, hi) => {
    const kind = h.ground ? NAILS.ground : h.butt ? NAILS.butt : NAILS.face;
    for (const it of h.items) springs.push({ hub: hi, node: it.node, to: hubNode[hi], kind, s: it.s });
  });

  let u = null, N = new Float64Array(elems.length), probe = null;
  for (let pass = 0; pass < (pdelta ? 3 : 1); pass++) {
    const K = new Float64Array(n * n);
    for (let e = 0; e < elems.length; e++) addBeam(K, n, nodes, elems[e], pass ? N[e] : 0);
    for (const sp of springs) addSpring(K, n, sp);
    // (the first pass also pushes one pound at each probe, through the same equations)
    const unit = pass ? [] : probeSets.map((set) => { const P = new Float64Array(n); for (const i of set) P[i * 3] = 1 / set.length; return P; });
    const sols = solveMany(K, [F.slice(), ...unit], n);
    if (!sols) return { ok: false, hubs, nodes, worst: { kind: 'fold', util: 99, y: 0, text: 'folded over' }, items: [], u: null, mechanism: true };
    const sol = sols[0];
    if (!pass && probes) {
      const at = (x, set) => (set.length ? set.reduce((a, i) => a + x[i * 3], 0) / set.length : 0);
      probe = { u0: probeSets.map((set) => at(sol, set)), flex: probeSets.map((si) => unit.map((_, j) => at(sols[1 + j], si))) };
    }
    u = sol;
    for (let e = 0; e < elems.length; e++) N[e] = beamForces(nodes, elems[e], u).N;
  }

  // check every part
  const items = [];
  for (let e = 0; e < elems.length; e++) {
    const el = elems[e], f = beamForces(nodes, el, u), s = segs[el.s];
    const L = f.L, M = Math.max(Math.abs(f.M1), Math.abs(f.M2));
    const squash = f.N < 0 ? -f.N / Math.min(WOOD.pullHolds, Math.PI ** 2 * WOOD.E * WOOD.Iweak / (L * L)) : f.N / WOOD.pullHolds;
    const util = squash + M / WOOD.bendHolds;
    const y = (nodes[el.a].y + nodes[el.b].y) / 2;
    items.push({ type: 'board', util, s: el.s, id: s.id, y, x: (nodes[el.a].x + nodes[el.b].x) / 2, buckle: f.N < 0 && squash > M / WOOD.bendHolds, N: f.N, M });
  }
  for (const sp of springs) {
    const a = sp.node * 3, b = sp.to < 0 ? -1 : sp.to * 3;
    const dx = u[a] - (b < 0 ? 0 : u[b]), dy = u[a + 1] - (b < 0 ? 0 : u[b + 1]), dr = u[a + 2] - (b < 0 ? 0 : u[b + 2]);
    const force = Math.hypot(dx, dy) * sp.kind.kt, twist = Math.abs(dr) * sp.kind.kr;
    const util = Math.hypot(force / sp.kind.holds, twist / sp.kind.twist);
    const h = hubs[sp.hub];
    items.push({ type: 'joint', util, hub: sp.hub, s: sp.s, id: segs[sp.s].id, y: h.y, x: h.x, ground: h.ground, butt: h.butt, force, twist });
  }
  // sway: how far each level of joints moved sideways, and how much each storey leaned compared with the one below it
  const levels = [{ y: 0, ux: 0 }];
  for (let i = 0; i < hubs.length; i++) {
    if (hubs[i].ground) continue;
    const y = hubs[i].y, ux = u[hubNode[i] * 3];
    let L = levels.find((l) => Math.abs(l.y - y) < 0.4);
    if (!L) { L = { y, ux: 0, n: 0 }; levels.push(L); }
    L.ux = (L.ux * (L.n || 0) + ux) / ((L.n || 0) + 1); L.n = (L.n || 0) + 1;
  }
  levels.sort((a, b) => a.y - b.y);
  let drift = 0, driftAt = 0;
  for (let i = 1; i < levels.length; i++) {
    const r = Math.abs(levels[i].ux - levels[i - 1].ux) / Math.max(1, levels[i].y - levels[i - 1].y);
    if (r > drift) { drift = r; driftAt = levels[i - 1].y; }
  }
  items.push({ type: 'sway', util: drift / DRIFT_LIMIT, y: driftAt, drift });
  // a post whose top is nailed to nothing (standing on its own, or sticking up a foot or more past its last joint):
  // how far its top leans over its whole height, against the same limit. (tops: where it leans, for the page to draw)
  const tops = [];
  segs.forEach((s, si) => {
    const list = boardNodes[si]; if (list.length < 2 || !isUp(s)) return;
    const lo = list.reduce((a, m) => (nodes[m].y < nodes[a].y ? m : a)), hi = list.reduce((a, m) => (nodes[m].y > nodes[a].y ? m : a));
    if (!nodes[hi].free) return;
    const below = list.filter((m) => !nodes[m].free).reduce((a, m) => Math.max(a, nodes[m].y), -Infinity);
    if (nodes[hi].y - below < 1) return;
    const lean = Math.abs(u[hi * 3] - u[lo * 3]) / Math.max(1, nodes[hi].y - nodes[lo].y);
    tops.push({ y: nodes[hi].y, ux: u[hi * 3], from: nodes[lo].y });
    items.push({ type: 'sway', free: true, util: lean / DRIFT_LIMIT, y: nodes[lo].y, x: nodes[lo].x, s: si, id: s.id, drift: lean });
  });
  let worst = null; for (const it of items) if (!worst || it.util > worst.util) worst = it;
  if (worst) worst.text = describe(worst, segs, W);
  return { ok: !(worst && worst.util > 1), worst, items, hubs, nodes, u, levels, tops, segs, probe };
}

// a plain sentence for what gave way (W: how wide the wall is, so a short brace reaching from post to post on a
// narrow wall is called a brace, not a knee brace)
export function describe(it, segs, W) {
  if (it.type === 'sway' && it.free) return 'a post stood with nothing holding its top, and the wind bent it over';
  if (it.type === 'sway') {
    // a storey with knee braces in it bends its posts below the knees and leans over; one with nothing just folds
    const knees = segs.some((s) => isKnee(s, W) && Math.min(s.ay, s.by) >= it.y - 0.3 && Math.min(s.ay, s.by) < it.y + 9);
    return knees ? 'the knee braces could not hold it square: the posts bent and it racked over' : 'the square racked: it folded over sideways';
  }
  if (it.type === 'joint') {
    if (it.ground) return 'a post tore loose from its footing';
    if (it.butt) return 'two boards butted end to end pulled apart';
    const s = segs[it.s];
    return isKnee(s, W) ? 'the nails in a knee brace pulled out' : 'the nails at a joint pulled out';
  }
  const s = segs[it.s];
  const what = s.post ? 'a corner post' : isLevel(s) ? 'a crosspiece' : isUp(s) ? 'a post' : isKnee(s, W) ? 'a knee brace' : 'a brace';
  return what + (it.buckle ? ' buckled under the squeeze' : ' snapped');
}
const angOf = (s) => Math.abs(Math.atan2(s.by - s.ay, s.bx - s.ax) * 180 / Math.PI) % 180;
const isLevel = (s) => { const a = angOf(s); return a < 8 || a > 172; };
const isUp = (s) => Math.abs(angOf(s) - 90) < 8;
// a knee brace: a short slanting board (4 ft or less) that props a post against a crosspiece near the corner, so it
// does not reach across the wall from post to post. On a narrow wall (W feet wide) a brace corner to corner can be
// that short too, and it is a real brace.
export const isKnee = (s, W) => !isLevel(s) && !isUp(s) && s.len <= 4 && !(W > 0 && Math.abs(s.bx - s.ax) > W - 0.25);

// one beam piece's stiffness (plus, when it carries a push or pull, how that push changes its sideways stiffness: the
// "geometric" part that makes a squeezed board softer, the P-delta effect) added into the big matrix
function addBeam(K, n, nodes, el, Naxial) {
  const A = nodes[el.a], B = nodes[el.b];
  const dx = B.x - A.x, dy = B.y - A.y, L = Math.max(0.05, Math.hypot(dx, dy)), c = dx / L, s = dy / L;
  const { E, A: Ar, I } = WOOD;
  const ea = E * Ar / L, k1 = 12 * E * I / L ** 3, k2 = 6 * E * I / L ** 2, k3 = 4 * E * I / L, k4 = 2 * E * I / L;
  const kl = [
    [ea, 0, 0, -ea, 0, 0], [0, k1, k2, 0, -k1, k2], [0, k2, k3, 0, -k2, k4],
    [-ea, 0, 0, ea, 0, 0], [0, -k1, -k2, 0, k1, -k2], [0, k2, k4, 0, -k2, k3]];
  if (Naxial) {
    const g = Naxial / L;
    const kg = [[0, 0, 0, 0, 0, 0], [0, 6 / 5, L / 10, 0, -6 / 5, L / 10], [0, L / 10, 2 * L * L / 15, 0, -L / 10, -L * L / 30],
      [0, 0, 0, 0, 0, 0], [0, -6 / 5, -L / 10, 0, 6 / 5, -L / 10], [0, L / 10, -L * L / 30, 0, -L / 10, 2 * L * L / 15]];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) kl[i][j] += g * kg[i][j];
  }
  const T = [[c, s, 0, 0, 0, 0], [-s, c, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, 0, c, s, 0], [0, 0, 0, -s, c, 0], [0, 0, 0, 0, 0, 1]];
  const dof = [el.a * 3, el.a * 3 + 1, el.a * 3 + 2, el.b * 3, el.b * 3 + 1, el.b * 3 + 2];
  // K += T^T kl T
  const kt = []; for (let i = 0; i < 6; i++) { kt.push(new Float64Array(6)); for (let j = 0; j < 6; j++) { let v = 0; for (let m = 0; m < 6; m++) v += kl[i][m] * T[m][j]; kt[i][j] = v; } }
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { let v = 0; for (let m = 0; m < 6; m++) v += T[m][i] * kt[m][j]; K[dof[i] * n + dof[j]] += v; }
}
function beamForces(nodes, el, u) {
  const A = nodes[el.a], B = nodes[el.b];
  const dx = B.x - A.x, dy = B.y - A.y, L = Math.max(0.05, Math.hypot(dx, dy)), c = dx / L, s = dy / L;
  const g = [u[el.a * 3], u[el.a * 3 + 1], u[el.a * 3 + 2], u[el.b * 3], u[el.b * 3 + 1], u[el.b * 3 + 2]];
  const ua = c * g[0] + s * g[1], va = -s * g[0] + c * g[1], ub = c * g[3] + s * g[4], vb = -s * g[3] + c * g[4];
  const { E, A: Ar, I } = WOOD;
  const N = E * Ar / L * (ub - ua);   // + = pulled
  const M1 = E * I / L ** 2 * (6 * va + 4 * L * g[2] - 6 * vb + 2 * L * g[5]);
  const M2 = E * I / L ** 2 * (6 * va + 2 * L * g[2] - 6 * vb + 4 * L * g[5]);
  return { N, M1, M2, L };
}
function addSpring(K, n, sp) {
  const a = sp.node * 3, b = sp.to < 0 ? -1 : sp.to * 3, k = [sp.kind.kt, sp.kind.kt, sp.kind.kr];
  for (let d = 0; d < 3; d++) {
    K[(a + d) * n + a + d] += k[d];
    if (b >= 0) { K[(b + d) * n + b + d] += k[d]; K[(a + d) * n + b + d] -= k[d]; K[(b + d) * n + a + d] -= k[d]; }
  }
}
// plain Gaussian elimination with row swaps; null when the set has no answer (a part free to flop about)
// (several right-hand sides at once: rhs is a list of load vectors; returns a list of answers, or null)
function solveMany(K, rhs, n) {
  let big = 0; for (let i = 0; i < n; i++) big = Math.max(big, Math.abs(K[i * n + i]));
  for (let c = 0; c < n; c++) {
    let p = c, pv = Math.abs(K[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(K[r * n + c]); if (v > pv) { pv = v; p = r; } }
    if (pv < big * 1e-11) return null;
    if (p !== c) { for (let j = c; j < n; j++) { const t = K[c * n + j]; K[c * n + j] = K[p * n + j]; K[p * n + j] = t; } for (const F of rhs) { const t = F[c]; F[c] = F[p]; F[p] = t; } }
    const d = K[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const f = K[r * n + c] / d; if (!f) continue;
      for (let j = c; j < n; j++) K[r * n + j] -= f * K[c * n + j];
      for (const F of rhs) F[r] -= f * F[c];
    }
  }
  const out = [];
  for (const F of rhs) {
    const x = new Float64Array(n);
    for (let r = n - 1; r >= 0; r--) { let v = F[r]; for (let j = r + 1; j < n; j++) v -= K[r * n + j] * x[j]; x[r] = v / K[r * n + r]; }
    for (let i = 0; i < n; i++) if (!Number.isFinite(x[i])) return null;
    out.push(x);
  }
  return out;
}

// ── the wind on the whole tower ─────────────────────────────────────────────────────────────────────────────────────
// wind pressure (pounds per square foot) at a height: speed squared, a little stronger higher up
export function pressure(mph, y) { return 0.00256 * mph * mph * Math.pow(Math.max(y, 5) / 15, 2 / 7); }

// the wind's push on every board for wind blowing along world axis 'X' or 'Z' (sign +1 / -1):
// [{ y, F, face, x (feet along its face, for a wall board), corner (for a post) }]
// Each board catches wind on its wide face if it faces the wind, on its thin edge if the wind runs along its wall; the
// ones behind the wall facing the wind get only part of it (the wind shadow: leeShade, wakeShade).
export function windPushes(t, axis, sign, mph) {
  const out = [], wb = worldBoards(t), W = t.W, ax = axis === 'X' ? 0 : 1;
  // the wall facing the wind (its outside looks upwind), and how much of it is wood at each height
  const near = FACE_NORMAL.findIndex((n) => n[ax] === -sign), solid = solidityOf(t, near);
  // feet downwind of the near wall's plane, for a world point
  const back = (p) => sign * (ax ? p.Z : p.X) + W / 2;
  for (const b of wb) {
    const dx = b.b.X - b.a.X, dy = b.b.Y - b.a.Y, dz = b.b.Z - b.a.Z;
    const along = axis === 'X' ? dx : dz, proj = Math.sqrt(Math.max(0, b.len * b.len - along * along));
    let width = WOOD.width, shade = () => 1;
    const e = b.face >= 0 ? ends(b.src) : null;
    if (b.face >= 0) {
      const facing = FACE_NORMAL[b.face][ax];
      if (facing === 0) { width = WOOD.thick; shade = (i) => wakeShade(back(at(b, i))); }   // a wall the wind runs along: only the boards' edges, behind the near post
      else if (facing === sign) shade = (i) => leeShade(solid(at(b, i).Y));             // the far wall, behind the near one
    } else if (b.corner !== near && b.corner !== (near + 1) % 4) shade = () => wakeShade(W);   // a far post, behind a near one
    // sampled at four spots along the board, each with the wind for its height
    for (let i = 0; i < 4; i++) {
      const y = b.a.Y + dy * (i + 0.5) / 4;
      const p = { y, F: sign * pressure(mph, y) * DRAG * width * shade(i) * proj / 4, face: b.face };
      if (e) p.x = e.ax + (e.bx - e.ax) * (i + 0.5) / 4; else p.corner = b.corner;
      out.push(p);
    }
  }
  return out;
}
const at = (b, i) => ({ X: b.a.X + (b.b.X - b.a.X) * (i + 0.5) / 4, Y: b.a.Y + (b.b.Y - b.a.Y) * (i + 0.5) / 4, Z: b.a.Z + (b.b.Z - b.a.Z) * (i + 0.5) / 4 });
// how much of a wall is wood, by height: (y) -> 0..1, the boards' area in each foot of height over the wall's
// (including the corner posts at its edges)
function solidityOf(t, k) {
  const band = [], wide = t.W + WOOD.width;
  for (const s of faceSegments(t, k)) {
    const n = Math.max(1, Math.ceil(s.len / 0.25));
    for (let i = 0; i < n; i++) { const y = s.ay + (s.by - s.ay) * (i + 0.5) / n, j = Math.max(0, Math.floor(y)); band[j] = (band[j] || 0) + s.len / n * WOOD.width; }
  }
  return (y) => Math.min(1, (band[Math.max(0, Math.floor(y))] || 0) / wide);
}

// which faces carry wind blowing along an axis (the walls it blows along)
function carriers(t, axis) { return axis === 'X' ? [0, 2] : [1, 3]; }
// how much of one push carrying wall k takes: all of the wind on its own boards and on the posts at its corners; for a
// board on the wall facing the wind (or the far wall), which hangs between the two carrying walls' corner posts, the
// part nearer each corner goes to that corner's wall (as a plank resting on two trestles shares its load)
function shareOf(p, k, W) {
  const mine = (c) => c === k || c === (k + 1) % 4;
  if (p.corner !== undefined) return mine(p.corner) ? 1 : 0;
  if (p.face === k) return 1;
  if (p.face === (k + 2) % 4) return 0;
  const u = W > 0 ? Math.max(0, Math.min(1, p.x / W)) : 0.5;
  return (mine(p.face) ? 1 - u : 0) + (mine((p.face + 1) % 4) ? u : 0);
}

// the weight of the walls at right angles, handed to this wall's edges (where they are nailed to the corner posts)
function crossWeight(t, k) {
  const other = k % 2 ? [0, 2] : [1, 3], down = [];
  for (const f of other) for (const s of faceSegments(t, f)) {
    if (s.post) continue;
    // a board on the near end of this wall (face f's right edge meets face k's left one... either way, half to each end)
    const y = (s.ay + s.by) / 2, F = WOOD.weight * s.len / 2;
    down.push({ y, x: 0, F: F / 2 }, { y, x: t.W, F: F / 2 });
  }
  return down;
}

// one load case: wind along an axis from one side at one speed. Returns the governing wall's result.
export function windCase(t, axis, sign, mph) {
  const pushes = windPushes(t, axis, sign, mph);
  const total = pushes.reduce((a, p) => a + p.F, 0);
  const faces = carriers(t, axis);
  // the wind's push in each carrying wall's own sideways direction: face 0's x runs along +X, face 2's along -X,
  // face 1's along -Z, face 3's along +Z
  const dirOf = (k) => (k === 0 ? 1 : k === 2 ? -1 : k === 1 ? -1 : 1);
  // each carrying wall takes the pushes that land on it (shareOf), storey by storey as they come...
  const side = {};
  for (const k of faces) { side[k] = []; for (const p of pushes) { const s = shareOf(p, k, t.W); if (s > 0) side[k].push({ y: p.y, F: p.F * s * dirOf(k) }); } }
  // ...and the ties between them hand some across: how far each wall would lean on its own where the ties land, how
  // each gives to a push there, and so the pull in every tie (T, pounds: + pulls the first end's wall back toward the
  // second's). A wall that leans less on its own gets pulled along by the one that leans more, and holds it back.
  const links = ties(t, faces), T = links.map(() => 0);
  if (links.length) {
    const probes = {}; for (const k of faces) probes[k] = [];
    const at = links.map((l) => l.land.map((e) => { probes[e.k].push({ y: e.y, x: e.x }); return probes[e.k].length - 1; }));
    const lone = {};
    for (const k of faces) lone[k] = solveWall(faceSegments(t, k), { side: side[k], down: crossWeight(t, k) }, { W: t.W, pdelta: false, probes: probes[k] }).probe;
    if (faces.every((k) => lone[k])) {
      const n = links.length, A = new Float64Array(n * n), d = new Float64Array(n), sgn = [-1, 1];
      // how far (along the wind) the tie's end e moves for every pound of pull in tie m
      const give = (l, e, m) => { const k = links[l].land[e].k; let g = 0; for (let e2 = 0; e2 < 2; e2++) if (links[m].land[e2].k === k) g += lone[k].flex[at[l][e]][at[m][e2]] * sgn[e2]; return g; };
      for (let l = 0; l < n; l++) {
        const [a, b] = links[l].land;
        d[l] = dirOf(a.k) * lone[a.k].u0[at[l][0]] - dirOf(b.k) * lone[b.k].u0[at[l][1]];
        for (let m = 0; m < n; m++) A[l * n + m] = (l === m ? 1 / links[l].k : 0) - give(l, 0, m) + give(l, 1, m);
      }
      const sol = solveMany(A, [d], n);
      if (sol) sol[0].forEach((v, i) => { T[i] = v; });
      links.forEach((l, i) => l.land.forEach((e, j) => side[e.k].push({ y: e.y, x: e.x, F: sgn[j] * T[i] * dirOf(e.k) })));
    }
  }
  let worst = null;
  for (const k of faces) {
    const r = solveWall(faceSegments(t, k), { side: side[k], down: crossWeight(t, k) }, { W: t.W });
    if (!worst || (r.worst && r.worst.util > (worst.worst ? worst.worst.util : -1))) worst = { ...r, face: k };
  }
  // and the whole tower tipping over on its downwind stones
  const tip = tipping(t, pushes);
  if (tip.util > (worst.worst ? worst.worst.util : -1)) {
    const it = { type: 'tip', util: tip.util, y: 0, x: sign > 0 === (worst.face === 0 || worst.face === 3) ? 0 : t.W, text: 'the wind tipped the whole tower over: the stones on the windward side lifted' };
    worst = { ...worst, worst: it, ok: worst.ok && tip.util <= 1 };
  }
  return { ...worst, axis, sign, mph, total, tip, ties: links.map((l, i) => ({ id: l.id, face: l.face, L: l.L, k: l.k, T: T[i], ys: l.land.map((e) => e.y) })) };
}

// The ties between the two walls the wind blows along: every crosspiece or brace on the two walls at right angles that
// reaches from one corner post to the other. If one carrying wall leans further than the other, the tie gets bent
// sideways (the thin way) and its corner nails turn; how hard that pulls back is its stiffness k (pounds per foot of
// difference). The nails turn more easily than the board bends, and a long tie gives far more than a short one, so on
// a narrow tower the walls lean almost as one, and on a wide one each wall does most of its own holding.
// Returns [{ id, face, land: [{ k (carrying wall), x, y }, ...the far end], L, k }]
function ties(t, faces) {
  const out = [], W = t.W;
  const onPost = (c, y) => t.corners[c].some((p) => y > p.y - 0.3 && y < p.y + p.len + 0.3);
  for (let f = 0; f < 4; f++) {
    if (faces.includes(f)) continue;
    for (const s of faceSegments(t, f)) {
      const x0 = Math.min(s.ax, s.bx), x1 = Math.max(s.ax, s.bx);
      if (s.post || x1 - x0 < 0.1 || x0 > 0.35 || x1 < W - 0.35) continue;   // it has to reach both corner posts
      const yAt = (x) => s.ay + (s.by - s.ay) * Math.max(0, Math.min(1, (x - s.ax) / (s.bx - s.ax)));
      const ends = [[f, 0], [(f + 1) % 4, W]].map(([c, x]) => ({ c, y: yAt(x) }));
      if (!ends.every((e) => onPost(e.c, e.y))) continue;
      // corner c is the left edge (x 0) of wall c, or the right edge (x W) of the wall before it
      const land = ends.map((e) => (faces.includes(e.c) ? { k: e.c, x: 0, y: e.y } : { k: (e.c + 3) % 4, x: W, y: e.y }));
      const L = Math.hypot(W, ends[1].y - ends[0].y);
      out.push({ id: s.id, face: f, land, L, k: 1 / (L * L / (2 * NAILS.face.kr) + L ** 3 / (12 * WOOD.E * WOOD.Iweak)) });
    }
  }
  return out;
}

// ── tipping over ────────────────────────────────────────────────────────────────────────────────────────────────────
// The frame solve above checks each wall's boards and nails. A tower can also go over in one piece, like a box on a
// table: the wind's push, times how high up it pushes, tries to turn the tower about its downwind edge (the line
// through the two downwind stones). Against it: the tower's own weight, acting at its middle (half the width from that
// edge), and the two windward footing stones the posts are strapped to, which have to be lifted with it (a full width
// from that edge). So a tower twice as wide stands against more than twice the push (and a wider base has room for
// bigger stones); a tall narrow one goes over first.
// One footing stone's weight, by how far apart the stones are set: flat fieldstones all about as thick, so the weight
// grows with the stone's area, and four big ones only fit round a wide square. 250 lb at half a foot apart, 500 lb at
// 3 feet, 800 lb at 6, 1000 lb at 8. (The page draws each stone at the matching size: scene.js.)
export const stoneLb = (w) => 200 + 100 * w;
export function tipping(t, pushes) {
  let turn = 0, side = 0;
  for (const p of pushes) { turn += Math.abs(p.F) * p.y; side += Math.abs(p.F); }
  const weight = woodFeet(t) * WOOD.weight;
  const hold = weight * t.W / 2 + 2 * stoneLb(t.W) * t.W;
  return { util: hold > 0 ? turn / hold : 0, turn, hold, weight, push: side };
}

// the whole wind test: each stage tries the wind from all four sides. Stops at the first stage that breaks something.
// Returns { stages: [{ name, mph, ok, cases, worst }], failedAt (stage index or -1), fail (the breaking case) }
export function windTest(t, stages = STAGES) {
  const out = { stages: [], failedAt: -1, fail: null };
  if (!towerHeight(t)) return out;
  for (let i = 0; i < stages.length; i++) {
    const st = stages[i], cases = [];
    for (const [axis, sign] of [['X', 1], ['X', -1], ['Z', 1], ['Z', -1]]) cases.push(windCase(t, axis, sign, st.mph));
    let worst = null; for (const c of cases) if (!worst || (c.worst && c.worst.util > worst.worst.util)) worst = c;
    const ok = cases.every((c) => c.ok);
    out.stages.push({ name: st.name, mph: st.mph, ok, cases, worst });
    if (!ok) { out.failedAt = i; out.fail = worst; break; }
  }
  return out;
}

// after something breaks: what is left standing? Everything above the floor under the break falls; what is below is
// tested again (with the same winds up to the one that did the damage). Returns { height, tower (what stands), cut }.
export function whatStands(t, test, stages = STAGES) {
  if (test.failedAt < 0) return { height: towerHeight(t), tower: t, cut: Infinity };
  let tower = t, fail = test.fail, guard = 0, lastCut = Infinity;
  while (guard++ < 12) {
    const w = fail.worst || { y: 0 }, hubs = fail.hubs || [];
    // tipped over: it all goes
    if (w.type === 'tip') return { height: 0, tower: trimTower(t, -1), cut: 0, tipped: true };
    // the break's height: a storey that leaned too far breaks from its floor up; a joint at its own height; a board
    // from its lower end
    let y = w.y;
    if (w.type === 'board' && fail.segs && fail.segs[w.s]) y = Math.min(fail.segs[w.s].ay, fail.segs[w.s].by);
    // the floor under the break: the highest row of joints at (or just under) it that spans the wall (joints on both
    // edges), so what is left is a whole wall. If that leaves the tower as it was, the floor below that one.
    const floors = [], edge = Math.min(0.5, t.W / 4);
    for (const h of hubs) {
      if (h.ground) continue;
      const level = hubs.filter((q) => !q.ground && Math.abs(q.y - h.y) < 0.4);
      if (level.some((q) => q.x < edge) && level.some((q) => q.x > t.W - edge)) floors.push(h.y);
    }
    floors.sort((a, b) => b - a);
    let cut = floors.find((f) => f <= y + 0.3 && f < lastCut - 0.3) || 0;
    if (cut < 1) return { height: 0, tower: trimTower(t, -1), cut: 0 };
    const trimmed = trimTower(tower, cut);
    if (worldCount(trimmed) === worldCount(tower)) cut = floors.find((f) => f < cut - 0.3) || 0;
    if (cut < 1) return { height: 0, tower: trimTower(t, -1), cut: 0 };
    tower = trimTower(tower, cut); lastCut = cut;
    if (!towerHeight(tower)) return { height: 0, tower, cut: 0 };
    const again = windTest(tower, stages.slice(0, test.failedAt + 1));
    if (again.failedAt < 0) {
      // a falling top taller than what is left levers the rest over too: then the whole tower comes down
      if (towerHeight(t) - towerHeight(tower) > towerHeight(tower)) return { height: 0, tower: trimTower(t, -1), cut: 0, dragged: true };
      return { height: towerHeight(tower), tower, cut };
    }
    fail = again.fail;
  }
  return { height: 0, tower: trimTower(t, -1), cut: 0 };
}
const worldCount = (t) => worldBoards(t).length;
