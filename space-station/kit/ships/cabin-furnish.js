// FURNISHING A CABIN'S ROOMS: the blueprint's items (plan boxes) turned into the cabin kit's fittings, by the room's kind:
// the galley / mess (kit/shipparts/cabin/mess.js), the bunk room (bunks.js), the science lab (lab.js), the airlock
// (airlock.js), the washroom (washroom.js) and engineering (engroom.js). kit/ships/cabin-built.js calls it; what it builds
// is left out of the plan's boxes (an item a room's fittings don't read, a door casing say, stays a box).
//   furnishRoom(q, bp, room, ctx) -> the ids of the items it built
//     ctx: { put(what, src, o) (the builder's placeInto, counting triangles by `what`: 'mess: benches' and so on), slopeAt(axis, v, at) (the hull's
//            slope over a wall line at a point along it: { y0, run } or null), openings(axis, v) (the stretches along a
//            wall line its doorways and their control panels take), look (the cabin's LOOKS entry: its leather colours the
//            bench cushions, and the things its accents name: kit/ships/cabin-built.js LOOKS), outer (the ship's own
//            door, from inside: { head, sill }) }
// Each room's fittings stand on its walls as below; every room's clear walls get the chamfered fields, and its posters
// (kit/shipparts/cabin/print.js POSTERS, by its kind) hang on its fittings or its clear walls.
// The galley: how an item is read:
//   - against a wall: the item's long side that lies on one of its room's walls (a square item: any side on a wall);
//     its fitting stands on that wall line, facing into the room (kit/shipparts/cabin/ship.js's wall frame)
//   - benches meeting at a corner make an L: the one whose box reaches the other's wall runs its seat and back cushion on
//     to the other's back cushion; the other runs its back cushion on into the corner, to the first one's wall
//   - a table: its stools stand along the sides with no bench (two along a long side, one at a short end), tucked a
//     little under its top
//   - an overhead cabinet: its fitting in that wall's top corner, its top following the hull's slope if there is one
//   - the mess's posters (kit/shipparts/cabin/print.js POSTERS, in order): the middle cabinet over the bench, the wall
//     over the second bench, the hull's side under the cabinets, the cold store's door
// The bunk room: each bunk a 2-high berth stack on its wall (its openings where nothing stands in front of it, the pillows
// at the end its "head" names, else at the open end; the ladder at the foot end), berths numbered through the ship (upper
// first, in plan order). An overhead item on a stack's own footprint: the lockers right above the berths, flush with the
// bed fronts. A locker whose plan has a diagonal from a stack's front corner: a thin end locker, its doors on the
// diagonal. A locker up to 0.3 m off its wall: the ship's shallow built-in (kit/shipparts/cabin/lockers.js), its corners
// cut as its plan says, joined to the bed fronts on a fillet, its two tall doors numbered for that stack's berths. Any
// other locker: a crew locker numbered for the berth it serves (its name's "upper" / "lower", else in turn). The room's
// posters: on the end lockers, then on the crew lockers that face whoever comes in; other overhead cabinets as the mess's.
import { part } from '../shipparts/place.js';
import { FACE, ROOM } from '../shipparts/cabin/ship.js';
import { cornerBench, messTable, stool, topCabinets, coldStore, galleyRun, coffeeMachine, mug, bottle, fruitBowl, poster, wallField } from '../shipparts/cabin/mess.js';
import { bunkStack, crewLocker } from '../shipparts/cabin/bunks.js';
import { shallowLocker, endLocker, berthLockers, lockerBody } from '../shipparts/cabin/lockers.js';
import { labBench, microscope, glovebox, vialRack, tablet, sampleCase, surveyTable, labStool, ringLight } from '../shipparts/cabin/lab.js';
import { suitLockers, pressurePanel, wallBench } from '../shipparts/cabin/airlock.js';
import { showerStall, toiletBasin } from '../shipparts/cabin/washroom.js';
import { reactorCore, drivePumps, driveDims, engStation, gearShelves } from '../shipparts/cabin/engroom.js';
import { reactorPort } from '../shipparts/cabin/reactor.js';
import { wallPipes, pipeRun, grating, hoopRail } from '../shipparts/cabin/engpipes.js';
import { washLight } from '../shipparts/cabin/lights.js';
import { screen, starScreen, hazard } from '../shipparts/cabin/bits.js';
import { shape, relief, add } from '../bevel.js';
import { POSTERS, postersFor } from '../shipparts/cabin/print.js';
import { hangs, cutsOf, outlineOf, inItem } from './blueprint.js';

const PI = Math.PI, EPS = 1e-6;
// the wall an item stands against in its room: { axis ('x': the line x = v, running along z; 'z': the line z = v), v,
// side (+1: the room on the line's high side), lo, hi (its stretch along the line), depth (out from the line) }
export function wallOf(it, room) {
  const [x0, z0, x1, z1] = it.rect, [X0, Z0, X1, Z1] = room.rect, out = [];
  if (Math.abs(x0 - X0) < EPS) out.push({ axis: 'x', v: X0, side: 1, lo: z0, hi: z1, depth: x1 - x0 });
  if (Math.abs(x1 - X1) < EPS) out.push({ axis: 'x', v: X1, side: -1, lo: z0, hi: z1, depth: x1 - x0 });
  if (Math.abs(z0 - Z0) < EPS) out.push({ axis: 'z', v: Z0, side: 1, lo: x0, hi: x1, depth: z1 - z0 });
  if (Math.abs(z1 - Z1) < EPS) out.push({ axis: 'z', v: Z1, side: -1, lo: x0, hi: x1, depth: z1 - z0 });
  return out.sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo))[0] || null;
}
// a wall fitting's placing on wall W, its middle at `mid` along it; and a point along the wall as the fitting's own x
const placing = (W, mid) => ({ at: W.axis === 'z' ? [mid, 0, W.v] : [W.v, 0, mid], rot: [0, W.axis === 'z' ? (W.side > 0 ? 0 : PI) : (W.side > 0 ? PI / 2 : -PI / 2), 0] });
const localX = (W, mid, a) => (W.axis === 'z' ? W.side : -W.side) * (a - mid);

export function furnishRoom(q, bp, room, ctx) {
  const F = ROOMS[room.kind]; if (!F) return new Set();
  const done = new Set(), items = (bp.items || []).filter((it) => it.room === room.id), f = +(room.floor || 0);
  const at = (W, mid, y = 0) => { const P = placing(W, mid); P.at[1] = f + y; return P; };
  F({ q, bp, room, ctx, done, items, f, at, A: accents(ctx.look) });
  return done;
}
const ROOMS = { galley: furnishGalley, bunks: furnishBunks, science: furnishScience, airlock: furnishAirlock, washroom: furnishWash, engineering: furnishEngineering };

// ── the galley ──────────────────────────────────────────────────────────────────────────────────────────────────
function furnishGalley({ room, ctx, done, items, f, at, A }) {
  // (the room's one downlight: over the table, its beam coming down on it and ending at its top)
  const TB = items.find((it) => it.kind === 'table'); if (ctx.disc && TB) { const c = centre(TB); ctx.disc(room, +c[0].toFixed(3), +c[1].toFixed(3), { drop: ROOM - 0.76 }); }
  // ── benches, in an L where two meet ──
  const benches = items.filter((it) => it.kind === 'bench').map((it) => ({ it, W: wallOf(it, room) })).filter((b) => b.W);
  const BACK = 0.09, slopeOver = (W) => ctx.slopeAt(W.axis, W.v, (W.lo + W.hi) / 2);
  for (const B of benches) {
    const { W } = B, mid = (W.lo + W.hi) / 2, len = W.hi - W.lo;
    let seat = [W.lo, W.hi], back = [W.lo, W.hi];
    for (const C of benches) {
      if (C === B || C.W.axis === W.axis) continue;
      // (C's wall crosses B's line at C.W.v along it; B reaches it: B owns the corner; else B runs its back on to it)
      const reach = Math.abs(W.lo - C.W.v) < EPS ? 'lo' : Math.abs(W.hi - C.W.v) < EPS ? 'hi' : null;
      if (reach) { const cut = C.W.v + (reach === 'lo' ? 1 : -1) * (FACE + BACK); seat = reach === 'lo' ? [cut, seat[1]] : [seat[0], cut]; back = reach === 'lo' ? [cut, back[1]] : [back[0], cut]; }
      else {
        const near = Math.abs(W.lo - C.W.v) < Math.abs(W.hi - C.W.v) ? 'lo' : 'hi', edge = C.W.v + (near === 'lo' ? 1 : -1) * FACE;
        if (Math.abs((near === 'lo' ? W.lo : W.hi) - edge) <= C.W.depth + 0.05) back = near === 'lo' ? [edge, back[1]] : [back[0], edge];
      }
    }
    const L = (r) => r.map((a) => +localX(W, mid, a).toFixed(4)).sort((a, b) => a - b);
    ctx.put('mess: benches', part(cornerBench, { len, depth: W.depth, seat: +B.it.h || 0.45, seatAt: L(seat), backAt: L(back), leather: ctx.look?.leather, trim: A.trim }), at(W, mid));
    B.back = back; done.add(B.it.id);
  }
  // ── the table and its stools; a mug or two and a bottle on it ──
  for (const it of items.filter((x) => x.kind === 'table')) {
    const [x0, z0, x1, z1] = it.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = +it.h || 0.75;
    ctx.put('mess: table', part(messTable, { w: x1 - x0, d: z1 - z0, h, trim: A.trim }), { at: [cx, f, cz] });
    const near = (side) => items.some((o) => o !== it && !+(o.y || 0) && (side === '-x' ? Math.abs(o.rect[2] - x0) < 0.06 && o.rect[1] < z1 && o.rect[3] > z0 : side === '+x' ? Math.abs(o.rect[0] - x1) < 0.06 && o.rect[1] < z1 && o.rect[3] > z0 : side === '-z' ? Math.abs(o.rect[3] - z0) < 0.06 && o.rect[0] < x1 && o.rect[2] > x0 : Math.abs(o.rect[1] - z1) < 0.06 && o.rect[0] < x1 && o.rect[2] > x0));
    const spots = [];
    for (const [side, along, a0, a1, pos] of [['-x', 'z', z0, z1, x0 - 0.03], ['+x', 'z', z0, z1, x1 + 0.03], ['-z', 'x', x0, x1, z0 - 0.03], ['+z', 'x', x0, x1, z1 + 0.03]]) {
      if (near(side)) continue;
      const n = a1 - a0 >= 0.9 ? 2 : 1;
      for (let k = 0; k < n; k++) { const a = a0 + (a1 - a0) * (n === 1 ? 0.5 : k ? 0.76 : 0.24); spots.push(along === 'z' ? [pos, a] : [a, pos]); }
    }
    for (const [sx, sz] of spots) ctx.put('mess: stools', part(stool, { pad: A.pad }), { at: [sx, f, sz] });
    const top = f + h;
    ctx.put('mess: small things', part(mug, { look: A.cup }), { at: [cx + 0.15 * (x1 - x0) / 0.75, top, cz - 0.25], rot: [0, 2.2, 0] });
    ctx.put('mess: small things', part(mug, { look: A.cup }), { at: [cx - 0.12, top, cz + 0.22], rot: [0, -0.6, 0] });
    ctx.put('mess: small things', part(bottle, { look: A.cup }), { at: [cx - 0.08, top, cz - 0.05] });
    done.add(it.id);
  }
  // ── against the walls: the cold store, the counter (and what stands on it), the cabinets in the top corners ──
  let posterAt = 0;
  for (const it of items) {
    if (done.has(it.id)) continue;
    const W = wallOf(it, room); if (!W) continue;
    const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo;
    if (it.kind === 'locker' && +it.h >= 1.8) { ctx.put('mess: cold store', part(coldStore, { w: len, depth: W.depth - 0.03, h: +it.h, poster: 3, handle: A.handle }), at(W, mid)); done.add(it.id); }
    else if (it.kind === 'counter') {
      // (an end open to the room, not at a wall and with nothing standing against it, gets a chamfered worktop corner)
      const [R0, R1] = W.axis === 'z' ? [room.rect[0], room.rect[2]] : [room.rect[1], room.rect[3]];
      const span = (o) => (W.axis === 'z' ? [o.rect[0], o.rect[2]] : [o.rect[1], o.rect[3]]);
      const open = (a) => Math.abs(a - R0) > EPS && Math.abs(a - R1) > EPS && !items.some((o) => o !== it && !+(o.y || 0) && span(o).some((v) => Math.abs(v - a) < 0.06) && wallOf(o, room)?.v === W.v);
      const ends = [W.lo, W.hi].map((a) => (open(a) ? 0.08 : 0)), ch = localX(W, mid, W.lo) < 0 ? ends : ends.slice().reverse();
      ctx.put('mess: counter', part(galleyRun, { len, depth: W.depth, top: +it.h || 0.9, end: ch, handle: A.handle, trim: A.trim }), at(W, mid));
      // (on it, in from the wall: the coffee machine part way from its closed end (a tall neighbour may hide that end),
      // two mugs beside it, the bowl of fruit toward the open end)
      const P = at(W, mid, +it.h || 0.9), inward = (d) => (W.axis === 'z' ? [0, 0, W.side * d] : [W.side * d, 0, 0]), alongV = W.axis === 'z' ? [1, 0, 0] : [0, 0, 1];
      const far = ends[0] ? W.hi : W.lo, sgn = far === W.hi ? -1 : 1, pt = (a, d) => { const o = inward(d); return [P.at[0] + alongV[0] * (a - mid) + o[0], P.at[1], P.at[2] + alongV[2] * (a - mid) + o[2]]; };
      ctx.put('mess: small things', part(coffeeMachine, {}), { at: pt(far + sgn * len * 0.4, 0.19), rot: P.rot });
      ctx.put('mess: small things', part(mug, { look: A.cup }), { at: pt(far + sgn * len * 0.58, 0.14), rot: [0, P.rot[1] + 0.7, 0] });
      ctx.put('mess: small things', part(mug, { look: A.cup }), { at: pt(far + sgn * len * 0.65, 0.3), rot: [0, P.rot[1] - 0.4, 0] });
      ctx.put('mess: small things', part(fruitBowl, {}), { at: pt(far + sgn * len * 0.84, 0.24), rot: P.rot });
      done.add(it.id);
    } else if (it.kind === 'overhead') {
      const slope = ctx.slopeAt(W.axis, W.v, mid), poster = W.depth >= 0.4 && posterAt === 0 ? 0 : null; if (poster === 0) posterAt++;
      ctx.put('mess: top cabinets', part(topCabinets, { len, y: +it.y, depth: W.depth, ceiling: room.ceiling === undefined || typeof room.ceiling !== 'number' ? 2.5 : room.ceiling, slope, poster, handle: A.handle, trim: A.trim }), at(W, mid));
      done.add(it.id);
    }
  }
  // ── the posters on the walls: over the second bench (the one along a partition), on the hull's side under its cabinets
  // (over the middle of its back cushion)
  const along = benches.find((b) => !slopeOver(b.W)), hull = benches.find((b) => slopeOver(b.W));
  if (along) ctx.put('mess: posters', part(poster, { i: 1, dark: true, y: 1.42 }), at(along.W, (along.back[0] + along.back[1]) / 2));
  if (hull) ctx.put('mess: posters', part(poster, { i: 2, y: 1.33 }), at(hull.W, (hull.W.lo + hull.W.hi) / 2));
  wallFields(ctx, room, items, at);
}

// ── the bunk room ───────────────────────────────────────────────────────────────────────────────────────────────
function furnishBunks({ bp, room, ctx, done, items, f, at, A }) {
  const nums = berthNumbers(bp), stacks = items.filter((it) => it.kind === 'bunk').map((it) => ({ it, W: wallOf(it, room) })).filter((S) => S.W);
  const lockers = items.filter((it) => it.kind === 'locker' && !hangs(it)).map((it) => ({ it, W: wallOf(it, room) })).filter((L) => L.W);
  const SHALLOW = 0.3, JOIN = 0.07, ceil = typeof room.ceiling === 'number' ? room.ceiling : 2.5, r3 = (v) => +v.toFixed(3);
  // a stack's bed fronts: on the plan (its footprint's edge), and as built (bunkStack's front, 0.02 m inside that)
  const faceOf = (W, built) => W.v + W.side * (W.depth - (built ? 0.02 : 0));
  // a shallow locker that runs up to a stack's front: which stack, and with which end of its own stretch
  for (const L of lockers) {
    L.meet = null; if (L.W.depth > SHALLOW + EPS) continue;
    for (const S of stacks) if (S.W.axis !== L.W.axis && inFront(L.it, S.W)) for (const e of ['lo', 'hi']) if (Math.abs(L.W[e] - faceOf(S.W)) < 0.03) L.meet = { S, e };
  }
  for (const S of stacks) {
    const { it, W } = S, mid = (W.lo + W.hi) / 2, len = W.hi - W.lo, h = +it.h || 1.9;
    // (what stands in front of its face, as stretches of its own x; a shallow locker that runs up to it with the fillet
    // that joins the two)
    const blocks = items.filter((o) => o !== it && !hangs(o) && inFront(o, W)).map((o) => {
      const [a, b] = alongOf(o, W).map((v) => localX(W, mid, v)).sort((p, q) => p - q), j = lockers.some((L) => L.it === o && L.meet?.S === S) ? JOIN + 0.06 : 0;
      return [a - j, b + j];
    });
    let open = [[-len / 2 + 0.08, len / 2 - 0.08]];
    for (const [a, b] of blocks) open = open.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, a - 0.05], [b + 0.05, q]])).filter(([p, q]) => q - p > 0.05);
    const best = open.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0], use = best && best[1] - best[0] >= 0.9 ? best : [-len / 2 + 0.08, len / 2 - 0.08];
    // (the pillows: at the end the plan names ("head": "low" / "high", the end of its long side at the lower or higher
    // plan coordinate), else at the open end)
    const bmid = blocks.length ? blocks.reduce((t, [a, b]) => t + a + b, 0) / (2 * blocks.length) : -1;
    const head = it.head === 'low' || it.head === 'high' ? (localX(W, mid, it.head === 'low' ? W.lo : W.hi) > 0 ? 1 : -1) : bmid < (use[0] + use[1]) / 2 ? 1 : -1;
    S.use = use.map(r3);
    ctx.put('bunks: berths', part(bunkStack, { len, depth: W.depth, h, open: S.use, head, nums: nums.get(it.id), bedding: A.bedding, handle: A.handle, trim: A.trim }), at(W, mid));
    done.add(it.id);
  }
  // the lockers right above the berths (an overhead item on a stack's own footprint): their faces flush with the bed
  // fronts, their doors over the openings
  for (const it of items.filter((o) => o.kind === 'overhead' && hangs(o))) {
    const S = stacks.find((T) => T.it.rect.every((v, i) => Math.abs(v - it.rect[i]) < EPS)); if (!S) continue;
    const { W } = S, mid = (W.lo + W.hi) / 2, y = +it.y, top = Math.min(ceil, y + (+it.h || 0.6)), slope = ctx.slopeAt(W.axis, W.v, mid);
    const lid = Math.max(0.05, W.depth - 0.02 - (slope ? Math.min(slope.run, Math.max(0, top - slope.y0)) : FACE));
    ctx.put('bunks: lockers over the berths', part(berthLockers, { len: r3(W.hi - W.lo), depth: W.depth, y, top, clip: [r3(S.use[0] - 0.07), r3(S.use[1] + 0.07)], lid: r3(lid), handle: A.handle, trim: A.trim }), at(W, mid));
    done.add(it.id);
  }
  // the lockers on the floor, three sorts:
  //   an END locker: its plan has a diagonal that starts at a stack's front corner (the thin locker between the beds' feet
  //     and the wall): its body from its plan, its doors on the diagonal
  //   a SHALLOW one (up to 0.3 m off its wall): the ship's shallow built-in, its corners cut as the plan says, run out to
  //     the bed fronts on a fillet where it meets them; its two tall doors numbered for that stack's berths
  //   any other: a crew locker, numbered for the berth it serves (its name's "upper" / "lower", else in turn)
  const endFace = (it) => {
    const P = outlineOf(it);
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length]; if (Math.abs(a[0] - b[0]) < EPS || Math.abs(a[1] - b[1]) < EPS) continue;
      for (const S of stacks) for (const v of [S.W.lo, S.W.hi]) { const c = S.W.axis === 'x' ? [faceOf(S.W), v] : [v, faceOf(S.W)]; for (const [p, q] of [[a, b], [b, a]]) if (dist(p, c) < 0.03) return { S, p, q }; }
    }
    return null;
  };
  const ends = [], shallow = [], crew = [];
  for (const L of lockers) { const D = endFace(L.it); if (D) ends.push({ ...L, D }); else if (L.W.depth <= SHALLOW + EPS) shallow.push(L); else crew.push(L); }
  const posters = postersFor('bunks'), hung = new Set();
  ends.forEach((L, i) => {
    const { it, D } = L, { S } = D, k = S.W.axis === 'x' ? 0 : 1, h = Math.min(ceil, +it.h || ceil), [X0, Z0, X1, Z1] = room.rect;
    // (its face: from the bed fronts as built, to the face of the wall its far end stands on)
    const p = D.p.slice(); p[k] = faceOf(S.W, true);
    const onX = Math.abs(D.q[0] - X0) < EPS || Math.abs(D.q[0] - X1) < EPS, onZ = Math.abs(D.q[1] - Z0) < EPS || Math.abs(D.q[1] - Z1) < EPS;
    const across = onZ ? Math.abs(D.q[1] - p[1]) : onX ? Math.abs(D.q[0] - p[0]) : 0, t = across > EPS ? FACE / across : 0;
    const q = [D.q[0] + (p[0] - D.q[0]) * t, D.q[1] + (p[1] - D.q[1]) * t], len = dist(p, q), m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let n = [(q[1] - p[1]) / len, -(q[0] - p[0]) / len]; if (inItem(it, m[0] + n[0] * 0.02, m[1] + n[1] * 0.02)) n = [-n[0], -n[1]];
    const pts = []; for (const v of outlineOf(it)) { const u = dist(v, D.p) < EPS ? p : v; if (!pts.length || dist(pts[pts.length - 1], u) > EPS) pts.push(u.map(r3)); }
    if (pts.length > 1 && dist(pts[0], pts[pts.length - 1]) < EPS) pts.pop();
    const poster = posters[i] ?? null; if (poster != null) hung.add(poster);
    ctx.put('bunks: end lockers', part(lockerBody, { pts, h }), { at: [0, f, 0], rot: [0, 0, 0] });
    ctx.put('bunks: end lockers', part(endLocker, { w: r3(len), h, poster, handle: A.handle, trim: A.trim }), { at: [m[0], f, m[1]], rot: [0, Math.atan2(n[0], n[1]), 0] });
    done.add(it.id);
  });
  const nearest = (it) => stacks.slice().sort((a, b) => dist(centre(a.it), centre(it)) - dist(centre(b.it), centre(it)))[0];
  for (const L of shallow) {
    const { it, W, meet } = L, mid = (W.lo + W.hi) / 2, end = (e) => (localX(W, mid, W[e]) > 0 ? 1 : 0), S = meet?.S || nearest(it), n = S ? nums.get(S.it.id) : null;
    const ext = [0, 0], join = [0, 0], cut = [0, 0], slope = ctx.slopeAt(W.axis, W.v, mid);
    if (meet) { ext[end(meet.e)] = 0.02; join[end(meet.e)] = JOIN; }
    for (const C of cutsOf(it)) {
      const front = (W.axis === 'z' ? C.hz : C.hx) === (W.side > 0), e = (W.axis === 'z' ? C.hx : C.hz) ? 'hi' : 'lo';
      if (front && !join[end(e)]) cut[end(e)] = Math.min(C.a, C.b);
    }
    const h = Math.min(ceil, +it.h || ceil, slope ? slope.y0 + W.depth - 0.02 : ceil);
    ctx.put('bunks: lockers', part(shallowLocker, { w: r3(W.hi - W.lo), depth: W.depth, h, ext, join, ends: cut, nums: n ? [n[0], n[1] ?? null] : null, handle: A.handle, trim: A.trim }), at(W, mid));
    done.add(it.id);
  }
  // (the crew lockers: the posters the end lockers left, on those facing whoever comes in)
  const into = enterDir(bp, room), facing = (W) => (W.axis === 'x' ? [W.side, 0] : [0, W.side]), free = posters.filter((i) => !hung.has(i));
  const byView = crew.slice().sort((a, b) => score(b.W) - score(a.W)), withPoster = new Map(byView.slice(0, free.length).filter((L) => score(L.W) > 0.3).map((L, i) => [L.it.id, free[i]]));
  function score(W) { const [fx, fz] = facing(W); return -(fx * into[0] + fz * into[1]); }
  const served = new Map();
  for (const L of crew) {
    const { it, W } = L, mid = (W.lo + W.hi) / 2, S = nearest(it), n = S ? nums.get(S.it.id) : null;
    const name = (it.name || '').toLowerCase(), k = served.get(S) || 0; served.set(S, k + 1);
    const num = n ? (n.length === 1 ? n[0] : /upper/.test(name) ? n[0] : /lower/.test(name) ? n[1] : n[k % 2]) : null;
    ctx.put('bunks: lockers', part(crewLocker, { w: W.hi - W.lo, depth: W.depth, h: +it.h || 2, num, poster: withPoster.get(it.id) ?? null, handle: A.handle, trim: A.trim }), at(W, mid));
    done.add(it.id);
  }
  topCorner(ctx, room, items, done, at, A, 'bunks');
  // (posters no locker took, on the clearest walls)
  for (const i of withPoster.values()) hung.add(i);
  const left = posters.filter((i) => !hung.has(i));
  if (left.length) hangPosters(ctx, room, items, at, left, 'bunks: posters');
  wallFields(ctx, room, items, at, { tag: 'bunks: wall fields', touch: true });
}
// ── the science lab ─────────────────────────────────────────────────────────────────────────────────────────────
// The bench (a counter) with its drawers, a knee space in its middle for the stool, a screen on the wall over it (under
// its cabinets, where they hang over it), the glovebox at the end the cabinets leave clear, the microscope, vials and a
// tablet on it; the sample store (a tall locker) as the SAMPLES case; the survey table (the holo item) against its wall,
// an 8-sided star screen over it; the stool at the knee space if it is out of the doors' way; the posters on the clearest
// walls.
function furnishScience({ bp, room, ctx, done, items, f, at, A }) {
  const extra = [];
  for (const it of items.filter((x) => x.kind === 'counter')) {
    const W = wallOf(it, room); if (!W) continue;
    const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo, n = Math.max(1, Math.round(len / 0.5)), cw = len / n, knee = n >= 3 ? Math.floor(n / 2) : -1, top = +it.h || 0.9;
    ctx.put('lab: bench', part(labBench, { len, depth: W.depth, top, knee, end: openEnds(W, room, items, it, mid), handle: A.handle, trim: A.trim }), at(W, mid));
    // (the cabinets over it, as a stretch of its own x)
    const over = items.find((o) => o.kind === 'overhead' && wallOf(o, room)?.axis === W.axis && Math.abs(wallOf(o, room).v - W.v) < EPS && alongOf(o, W)[1] > W.lo && alongOf(o, W)[0] < W.hi);
    const span = over ? alongOf(over, W).map((a) => localX(W, mid, a)).sort((a, b) => a - b) : null, kx = knee >= 0 ? -len / 2 + cw * (knee + 0.5) : 0;
    // the glovebox at the end with nothing hanging over it, the screen under the cabinets (or in the middle)
    // (the glovebox at the end with nothing hanging over it; the microscope between it and the knee space; the screen
    // on the knee space's other side, under the cabinets where they are)
    const gEnd = span ? (span[0] + len / 2 > len / 2 - span[1] ? -1 : 1) : -1, gx = gEnd * (len / 2 - 0.25);
    const sTop = over ? +over.y - 0.06 : top + 0.62, sh = Math.min(0.36, sTop - top - 0.12), sw = Math.min(0.56, sh * 1.6);
    let sx = kx - gEnd * (sw / 2 + 0.03); if (span) sx = Math.max(span[0] + sw / 2, Math.min(span[1] - sw / 2, sx));
    const on = (fn, o, x, z, y = top, r = 0) => { const P = toWorld(W, mid, [x, f + y, z]); ctx.put('lab: on the bench', part(fn, o), { at: P, rot: [0, rotOf(W) + r, 0] }); };
    if (len >= 1.2) on(glovebox, { w: 0.44 }, gx, FACE + 0.02);
    on(microscope, {}, kx + gEnd * 0.13, 0.25, top, -gEnd * 0.35);
    on(vialRack, { seed: 1 }, kx - gEnd * 0.42, 0.16);
    on(tablet, {}, kx - gEnd * 0.12, 0.37, top, -0.25);
    if (sh > 0.2) { ctx.put('lab: screen', part(screen, { w: +sw.toFixed(3), h: +sh.toFixed(3), rect: 'math', sub: [0.03, 0.04, 0.97, 0.8], light: 0.12 }), { at: toWorld(W, mid, [sx, f + sTop - sh / 2 - 0.05, FACE]), rot: [0, rotOf(W), 0] }); extra.push(block(W, sx - sw / 2 - 0.04, sx + sw / 2 + 0.04, mid, sTop - sh - 0.1, sTop)); }
    // the stool at the knee space, out of the doors' way
    if (knee >= 0) { const P = toWorld(W, mid, [kx, f, W.depth + 0.12]); if (!inDoorway(bp, room, P[0], P[2], 0.25)) ctx.put('lab: stool', part(labStool, { pad: A.pad }), { at: P, rot: [0, rotOf(W) + PI, 0] }); }
    done.add(it.id);
  }
  for (const it of items) {
    if (done.has(it.id)) continue;
    const W = wallOf(it, room); if (!W) continue;
    const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo;
    if (it.kind === 'locker' && +it.h >= 1.2) {
      const slope = ctx.slopeAt(W.axis, W.v, mid), h = Math.min(+it.h, slope ? slope.y0 + 0.02 : +it.h);
      ctx.put('lab: sample case', part(sampleCase, { len, depth: W.depth, h: +h.toFixed(3), handle: A.handle, trim: A.trim }), at(W, mid)); done.add(it.id);
    } else if (it.kind === 'holo') {
      // (the table a little narrower than its box, moved off whatever tall stands at one end (or a wall there))
      const h = +it.h || 0.9, [R0, R1] = W.axis === 'z' ? [room.rect[0], room.rect[2]] : [room.rect[1], room.rect[3]], tw = Math.min(len - 0.1, Math.max(0.7, len * 0.84));
      const tall = (a) => Math.abs(a - R0) < EPS || Math.abs(a - R1) < EPS || items.some((o) => o !== it && !hangs(o) && +o.h > 1.0 && alongOf(o, W).some((v) => Math.abs(v - a) < 0.06));
      const away = tall(W.hi) && !tall(W.lo) ? -1 : tall(W.lo) && !tall(W.hi) ? 1 : 0, tmid = mid + away * (len - tw) / 2;
      ctx.put('lab: survey table', part(surveyTable, { w: +tw.toFixed(3), depth: W.depth, h, trim: A.trim }), at(W, tmid)); done.add(it.id);
      // the ring of light hung over it (his picture's ring), clear of the hull's slopes
      const ceil = typeof room.ceiling === 'number' ? room.ceiling : 2.5, yr = ceil - 0.3, rr = Math.min(0.3, tw * 0.36), C = toWorld(W, tmid, [0, 0, FACE + (W.depth - FACE) / 2]);
      const cx = clearOfSlopes(ctx, room, C[0], C[2], rr, yr + 0.035);
      if (cx != null) ctx.put('lab: ring light', part(ringLight, { r: rr, drop: +(ceil - yr - 0.035).toFixed(3), trim: A.trim }), { at: [cx, f + yr, C[2]] });
      // (the star screen over it, on its wall, where the wall is clear there and the slopes leave room)
      const slope = ctx.slopeAt(W.axis, W.v, tmid), y1 = slope ? slope.y0 - 0.08 : Math.min(2.0, ceil - 0.4), sh = Math.min(0.42, y1 - h - 0.42), sw = Math.min(tw - 0.12, sh * 1.6);
      let smid = tmid;
      if (W.axis === 'z') { const c2 = clearOfSlopes(ctx, room, tmid, W.v, sw / 2 + 0.03, y1); smid = c2 ?? tmid; }
      if (sh > 0.25 && clearStretches(ctx, room, items, roomWall(room, W), y1 - sh - 0.06, y1, extra).some(([p, q]) => p <= smid - sw / 2 - 0.04 && q >= smid + sw / 2 + 0.04)) {
        ctx.put('lab: star screen', part(starScreen, { w: +sw.toFixed(3), h: +sh.toFixed(3), seed: 11 }), { ...at(W, smid), at: toWorld(W, smid, [0, f + y1 - sh / 2 - 0.04, FACE]) });
        extra.push(block(W, -sw / 2 - 0.05, sw / 2 + 0.05, smid, y1 - sh - 0.08, y1));
      }
    }
  }
  topCorner(ctx, room, items, done, at, A, 'lab');
  const screens = extra.slice();
  hangPosters(ctx, room, items, at, postersFor('science'), 'lab: posters', extra);
  wallFields(ctx, room, items, at, { tag: 'lab: wall fields', touch: true, also: asItems(screens) });
}

// ── the airlock ─────────────────────────────────────────────────────────────────────────────────────────────────
// The lockers as suit lockers (a suit behind a window in each half metre; a single one carries the airlock's poster on its
// door instead); the pressure panel by the hull's door, on the clear wall nearest it; a fold-down bench on a clear
// stretch of wall out of the doorways' way, if one is long enough; hazard hatching at the hull's door (a band on the floor
// inside its step, and up the casings' faces beside their amber strips).
function furnishAirlock({ bp, room, ctx, done, items, f, at, A }) {
  const extra = [], posters = postersFor('airlock'), lockers = items.filter((it) => it.kind === 'locker' && !hangs(it)).map((it) => ({ it, W: wallOf(it, room) })).filter((L) => L.W);
  const single = posters.length ? lockers.find((L) => Math.round((L.W.hi - L.W.lo) / 0.5) === 1) : null;
  for (const L of lockers) {
    const { it, W } = L, mid = (W.lo + W.hi) / 2;
    ctx.put('airlock: suit lockers', part(suitLockers, { len: W.hi - W.lo, depth: W.depth, h: +it.h || 2, poster: L === single ? posters[0] : null, flicker: L === lockers.find((M) => M !== single), handle: A.handle, trim: A.trim }), at(W, mid));
    done.add(it.id);
  }
  const outer = (ctx.outerDoors || []).filter((o) => o.d.rooms[0] === room.id), walls = roomWalls(room);
  // the pressure panel: the clear stretch (at its height) whose end comes nearest the hull door's wall
  if (outer.length) {
    const ow = outer[0].w, pw = 0.3, best = [];
    for (const W of walls) {
      if (ow.along === 'z' ? W.axis === 'x' && Math.abs(W.v - ow.x) < EPS : W.axis === 'z' && Math.abs(W.v - ow.z) < EPS) continue;
      for (const [a, b] of clearStretches(ctx, room, items, W, 0.98, 1.58, extra)) {
        if (b - a < pw + 0.02) continue;
        const line = ow.along === 'z' ? ow.x : ow.z, d0 = W.axis === (ow.along === 'z' ? 'z' : 'x') ? Math.min(Math.abs(a - line), Math.abs(b - line)) : 9;
        best.push({ W, c: Math.abs(a - line) < Math.abs(b - line) ? a + pw / 2 + 0.01 : b - pw / 2 - 0.01, d0 });
      }
    }
    const B = best.sort((p, q) => p.d0 - q.d0)[0];
    if (B) { ctx.put('airlock: pressure panel', part(pressurePanel, { w: pw, h: 0.46, y: 1.28 }), at(B.W, B.c)); extra.push({ axis: B.W.axis, v: B.W.v, side: B.W.side, lo: B.c - pw / 2 - 0.02, hi: B.c + pw / 2 + 0.02, y0: 0.98, y1: 1.58 }); }
  }
  // the bench: a stretch of wall clear from the floor to over its back pad, long enough, its seat out of the doorways' way
  for (const W of walls) {
    if (outer.some((o) => (o.w.along === 'z' ? W.axis === 'x' && Math.abs(W.v - o.w.x) < EPS : W.axis === 'z' && Math.abs(W.v - o.w.z) < EPS))) continue;
    const S = clearStretches(ctx, room, items, W, 0, 0.92, extra, { end: 0.0, cut: 0.0 }).find(([a, b]) => b - a >= 0.42);
    if (!S) continue;
    const len = Math.min(0.5, S[1] - S[0] - 0.02), c = (S[0] + S[1]) / 2, P = toWorld(W, c, [0, 0, 0.17]);
    if (inDoorway(bp, room, P[0], P[2], 0.17)) continue;
    ctx.put('airlock: bench', part(wallBench, { len: +len.toFixed(3), depth: 0.3, leather: A.leather?.c, trim: A.trim }), at(W, c));
    extra.push({ axis: W.axis, v: W.v, side: W.side, lo: c - len / 2, hi: c + len / 2, y0: 0, y1: 0.8 });
    break;
  }
  doorHazard(ctx, room, items, f);
  const left = posters.filter((i) => !(single && i === posters[0]));
  if (left.length) hangPosters(ctx, room, items, at, left, 'airlock: posters', extra.slice());
  wallFields(ctx, room, items, at, { tag: 'airlock: wall fields', touch: true, also: asItems(extra) });
}
// ── the washroom ────────────────────────────────────────────────────────────────────────────────────────────────
// The shower a stall on its wall, glass on its ends open to the room; the toilet hung on its wall at the end in the room's
// corner, a small basin beside it with a mirror-screen over it (when the toilet's box is long enough); the casings'
// hazard hatching at the hull door; its poster on its clearest wall.
function furnishWash({ room, ctx, done, items, f, at, A }) {
  const extra = [];
  for (const it of items) {
    const W = wallOf(it, room); if (!W || done.has(it.id)) continue;
    const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo, [R0, R1] = W.axis === 'z' ? [room.rect[0], room.rect[2]] : [room.rect[1], room.rect[3]];
    const atWall = (a) => Math.abs(a - R0) < EPS || Math.abs(a - R1) < EPS, lo = localX(W, mid, W.lo);
    if (it.kind === 'shower') {
      const ends = [!atWall(W.lo), !atWall(W.hi)];
      ctx.put('wash: shower', part(showerStall, { len, depth: W.depth, h: +it.h || 2, ends: lo < 0 ? ends : ends.slice().reverse(), trim: A.trim }), at(W, mid));
      done.add(it.id);
    } else if (it.kind === 'toilet') {
      const side = atWall(W.lo) ? Math.sign(lo) : atWall(W.hi) ? -Math.sign(lo) : 1, bx = -side * (len / 2 - 0.16);
      ctx.put('wash: toilet and basin', part(toiletBasin, { len, depth: W.depth, side, handle: A.handle, trim: A.trim }), at(W, mid));
      if (len >= 0.65) extra.push(block(W, bx - 0.18, bx + 0.18, mid, 1.08, 1.68));
      done.add(it.id);
    }
  }
  doorHazard(ctx, room, items, f);
  const fields = extra.slice();
  hangPosters(ctx, room, items, at, postersFor('washroom'), 'wash: posters', extra);
  wallFields(ctx, room, items, at, { tag: 'wash: wall fields', touch: true, also: asItems(fields) });
}

// ── engineering ─────────────────────────────────────────────────────────────────────────────────────────────────
// The machines on their walls: the one named a reactor (or the first, if none is) the reactor, the others the drive and its
// pumps, each with its end against a wall across (its pipes go into it); the console the engineering station; the lockers
// tool lockers (up to 0.3 m off their wall: the ship's shallow built-in, labelled TOOLS, a poster on its first door; a
// deeper one: crew lockers half a metre each); the racks gear shelves. Along the wall most of the machines back onto, two
// copper pipes, wall to wall, high, the poster about parallel pipes under them and a light over them washing the wall; a
// pipe down to the deck from the pair in each narrow gap between what stands on that wall. Overhead, a pipe from the
// reactor's shoulder across the room to the drive's valve chest. Down the aisle to the station a floor grating; a low
// rail before the reactor. The room's downlights: one over the aisle, one before each machine.
function furnishEngineering({ bp, room, ctx, done, items, f, at, A }) {
  const extra = [], posters = postersFor('engineering'), ceiling = typeof room.ceiling === 'number' ? room.ceiling : 2.5, r3 = (v) => +v.toFixed(3);
  const [X0, Z0, X1, Z1] = room.rect, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const machines = items.filter((it) => it.kind === 'machine').map((it) => ({ it, W: wallOf(it, room) })).filter((M) => M.W);
  const named = machines.find((M) => /reactor/i.test(M.it.name || '')) || machines[0], backs = [];
  // (first, each machine's end against a wall across, and the wall most of them back onto: the pipes' wall)
  for (const M of machines) {
    const { W } = M, mid = (W.lo + W.hi) / 2, [R0, R1] = W.axis === 'z' ? [room.rect[0], room.rect[2]] : [room.rect[1], room.rect[3]];
    const atWall = (a) => Math.abs(a - R0) < EPS || Math.abs(a - R1) < EPS;
    M.mid = mid;
    M.back = atWall(W.lo) ? Math.sign(localX(W, mid, W.lo)) : atWall(W.hi) ? Math.sign(localX(W, mid, W.hi)) : 0;
    M.backWall = M.back ? (W.axis === 'z' ? { axis: 'x', v: atWall(W.lo) ? W.lo : W.hi } : { axis: 'z', v: atWall(W.lo) ? W.lo : W.hi }) : null;
    if (M.backWall) backs.push(M.backWall);
  }
  const count = new Map(); for (const B of backs) { const k = B.axis + B.v; count.set(k, [B, (count.get(k)?.[1] || 0) + 1]); }
  const PB = [...count.values()].sort((a, b) => b[1] - a[1])[0]?.[0];
  // (the pipes' wall; how high the pair runs: under the ceiling, and under the foot of that wall's own slope if it has one)
  const PW = PB ? roomWalls(room).find((w) => w.axis === PB.axis && Math.abs(w.v - PB.v) < EPS) : null, PS = PW ? ctx.slopeAt(PW.axis, PW.v, (PW.lo + PW.hi) / 2) : null;
  const pipeY = PW ? +Math.min(ceiling - 0.38, 2.0, PS ? PS.y0 - 0.32 : 9).toFixed(3) : null;
  for (const M of machines) {
    const { it, W } = M, len = W.hi - W.lo, py = PB && M.backWall && M.backWall.axis === PB.axis && Math.abs(M.backWall.v - PB.v) < EPS ? pipeY : null;
    M.o = M === named ? { len, depth: W.depth, h: +it.h || 1.8, back: M.back, ceiling, pipeY: py, trim: A.trim } : { len, depth: W.depth, h: +it.h || 1.8, back: M.back || -1, pipeY: py, trim: A.trim };
  }
  // (the drive across the room from the reactor: its valve chest opposite the reactor's port, for the pipe overhead)
  const D = named ? machines.find((M) => M !== named && M.W.axis === named.W.axis && Math.abs(M.W.v - named.W.v) > 1) : null;
  if (D) D.o.chest = r3(localX(D.W, D.mid, named.mid));
  for (const M of machines) {
    if (M === named) ctx.put('engineering: reactor', part(reactorCore, M.o), at(M.W, M.mid));
    else ctx.put('engineering: drive and pumps', part(drivePumps, M.o), at(M.W, M.mid));
    done.add(M.it.id);
  }
  // the pipe overhead: up from the reactor's port, across under the ceiling on hangers, down to the drive's valve chest
  // (a valve on the way down); only where the ceiling leaves it room over both
  if (D) {
    const P0 = toWorld(named.W, named.mid, reactorPort(named.o)), P1 = toWorld(D.W, D.mid, driveDims(D.o).chest);
    const top = (x, z) => { let y = ROOM; for (const v of [X0, X1]) { const S = ctx.slopeAt('x', v, z); if (S) y = Math.min(y, S.y0 + Math.abs(x - v)); } return y; };
    const yT = Math.min(ROOM - 0.14, top(P0[0], P0[2]) - 0.14, top(P1[0], P1[2]) - 0.14);
    if (yT > Math.max(P0[1], P1[1]) + 0.3) {
      const up0 = [P0[0], yT, P0[2]], up1 = [P1[0], yT, P1[2]], jog = named.W.axis === 'x' ? Math.abs(P1[2] - P0[2]) : Math.abs(P1[0] - P0[0]);
      // (a jog too short to bend through: the level leg runs a little askew instead)
      const pts = (jog < 0.3 ? [P0, up0, up1, P1] : [P0, up0, named.W.axis === 'x' ? [P1[0], yT, P0[2]] : [P0[0], yT, P1[2]], up1, P1]).map((q) => q.map(r3));
      const stem = D.W.axis === 'x' ? [0, 0, Math.sign(cz - P1[2]) || 1] : [Math.sign(cx - P1[0]) || 1, 0, 0];
      ctx.put('engineering: pipes', part(pipeRun, { pts, ceiling: ROOM, valve: [pts.length - 2, 0.5, stem] }), { at: [0, f, 0], rot: [0, 0, 0] });
    }
  }
  let posterAt = 0;
  const stations = [];
  for (const it of items) {
    if (done.has(it.id)) continue;
    const W = wallOf(it, room); if (!W) continue;
    const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo;
    if (it.kind === 'console') { ctx.put('engineering: station', part(engStation, { len, depth: W.depth, h: +it.h || 1.2, handle: A.handle, trim: A.trim }), at(W, mid)); stations.push({ it, W, mid, len }); done.add(it.id); }
    else if (it.kind === 'locker' && !hangs(it)) {
      if (W.depth <= 0.3 + EPS) {
        // (the ship's shallow built-in, as the bunk room's: its plan's cut corners at its free ends, under a slope only as
        // tall as the slope lets its front be)
        const end = (e) => (localX(W, mid, W[e]) > 0 ? 1 : 0), cut = [0, 0], slope = ctx.slopeAt(W.axis, W.v, mid);
        for (const C of cutsOf(it)) { const front = (W.axis === 'z' ? C.hz : C.hx) === (W.side > 0), e = (W.axis === 'z' ? C.hx : C.hz) ? 'hi' : 'lo'; if (front) cut[end(e)] = Math.min(C.a, C.b); }
        const h = Math.min(ceiling, +it.h || ceiling, slope ? slope.y0 + W.depth - 0.02 : ceiling), P = posters[0] != null && posterAt === 0 ? posters[0] : null; if (P != null) posterAt++;
        ctx.put('engineering: tool lockers', part(shallowLocker, { w: r3(len), depth: W.depth, h: r3(h), ends: cut, cols: Math.max(1, Math.round(len / 0.5)), label: 'label:tools', poster: P, handle: A.handle, trim: A.trim }), at(W, mid));
      } else {
        const n = Math.max(1, Math.round(len / 0.5)), uw = len / n;
        for (let k = 0; k < n; k++) { const lx = -len / 2 + uw * (k + 0.5), P = posters[0] != null && posterAt === 0 && k === 0 ? posters[0] : null; if (P != null) posterAt++; ctx.put('engineering: tool lockers', part(crewLocker, { w: uw, depth: W.depth, h: +it.h || 2, label: 'label:tools', poster: P, handle: A.handle, trim: A.trim }), { at: toWorld(W, mid, [lx, f, 0]), rot: [0, rotOf(W), 0] }); }
      }
      done.add(it.id);
    } else if (it.kind === 'rack') { ctx.put('engineering: gear shelves', part(gearShelves, { len, depth: W.depth, h: +it.h || 1.8, trim: A.trim }), at(W, mid)); done.add(it.id); }
  }
  // the parallel pipes, along the wall the machines back onto most; their risers; the light over them; their poster under them
  const left = posters.slice(posterAt);
  if (PW) {
    const W = PW, mid = (W.lo + W.hi) / 2, y = pipeY, wl = W.hi - W.lo - 2 * FACE;
    // (what stands on that wall, along it: a pipe down to the deck in each narrow gap between two of them, from the upper
    // and the lower pipe in turn)
    const onWall = (it) => { const [x0, z0, x1, z1] = it.rect; return Math.abs((W.axis === 'x' ? (W.side > 0 ? x0 : x1) : (W.side > 0 ? z0 : z1)) - W.v) < EPS; };
    const on = items.filter((it) => !hangs(it) && onWall(it)).map((it) => alongOf(it, W)).sort((p, q) => p[0] - q[0]), risers = [];
    for (let i = 0; i + 1 < on.length; i++) {
      const g = on[i + 1][0] - on[i][1], m = (on[i][1] + on[i + 1][0]) / 2, lx = localX(W, mid, m);
      if (g < 0.18 || g > 0.7 || ctx.openings(W.axis, W.v).some(([p, q]) => m > p - 0.1 && m < q + 0.1)) continue;
      risers.push([r3(lx), risers.length % 2 ? 0 : 1]);
      extra.push(block(W, lx - 0.1, lx + 0.1, mid, 0, y));
    }
    // (a hull side's slope across an end of the wall: the height it starts at, for the pipes' flanges and the light's ends)
    const sl = (v) => (W.axis === 'z' ? ctx.slopeAt('x', v, W.v + W.side * 0.1)?.y0 ?? null : null);
    const slopes = localX(W, mid, W.lo) < 0 ? [sl(W.lo), sl(W.hi)] : [sl(W.hi), sl(W.lo)];
    ctx.put('engineering: pipes', part(wallPipes, { len: r3(wl), y, risers, slopes }), at(W, mid));
    let yTop = y + 0.26;
    const wy = y + 0.3, ins = slopes.map((s) => (s == null ? 0.05 : Math.max(0.05, wy + 0.08 - s))), wlen = wl - ins[0] - ins[1];
    if (!PS && wy + 0.08 < ROOM && wlen > 0.6) {
      ctx.put('engineering: lights', part(washLight, { len: r3(wlen), y: r3(wy) }), at(W, mid + (W.axis === 'z' ? W.side : -W.side) * (ins[0] - ins[1]) / 2));
      yTop = wy + 0.07;
    }
    extra.push({ axis: W.axis, v: W.v, side: W.side, lo: W.lo, hi: W.hi, y0: y - 0.08, y1: yTop });
    if (left.length) {
      const P = POSTERS[left[0]], py = y - 0.12 - P.h / 2 - 0.05, S = clearStretches(ctx, room, items, W, py - P.h / 2 - 0.03, py + P.h / 2 + 0.03, extra.filter((B) => B.y0 === 0)).filter(([a, b]) => b - a >= P.w + 0.06).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
      if (S) { ctx.put('engineering: posters', part(poster, { i: left[0], y: +py.toFixed(3) }), at(W, (S[0] + S[1]) / 2)); left.shift(); }
    }
  }
  // the grating: down the aisle before the station, from its front to what stands across from it (or the wall there)
  for (const S of stations) {
    const { W, mid, len } = S, front = W.v + W.side * W.depth;
    let end = W.axis === 'z' ? (W.side > 0 ? Z1 : Z0) : (W.side > 0 ? X1 : X0);
    for (const it of items) {
      if (it === S.it || hangs(it)) continue;
      const [a, b] = alongOf(it, W), [n0, n1] = W.axis === 'z' ? [it.rect[1], it.rect[3]] : [it.rect[0], it.rect[2]], near = W.side > 0 ? n0 : n1;
      if (b > mid - len / 2 + 0.05 && a < mid + len / 2 - 0.05 && (near - front) * W.side > -EPS) end = W.side > 0 ? Math.min(end, near) : Math.max(end, near);
    }
    const run = Math.abs(end - front) - 0.16; if (run < 0.6) continue;
    const m = front + W.side * (0.06 + run / 2);
    ctx.put('engineering: grating', part(grating, { len: r3(run), wid: r3(Math.min(len - 0.1, 1)) }), { at: W.axis === 'z' ? [mid, f, m] : [m, f, mid], rot: [0, W.axis === 'z' ? PI / 2 : 0, 0] });
  }
  // a low rail before the reactor, along its aisle edge (not across a doorway)
  if (named) {
    const { W, mid } = named, len = Math.max(0.5, W.hi - W.lo - 0.36), z = W.depth + 0.02, feet = [-len / 2, len / 2].map((x) => toWorld(W, mid, [x, 0, z]));
    if (!feet.some((q) => inDoorway(bp, room, q[0], q[2], 0.1))) ctx.put('engineering: rails', part(hoopRail, { len: r3(len), h: 0.5, z: r3(z) }), at(W, mid));
  }
  // the downlights: one before each machine (toward the room's middle, clear of the slopes), its beam coming down past
  // the machine's pipes; and two on the other side of the room's middle from the machines, one to each side of the way
  // through (before the lockers and shelves there: none over the middle, where its beam would hang between the door and
  // the station)
  if (ctx.disc && machines.length) {
    let mx = 0, mz = 0;
    for (const M of machines) { const c = centre(M.it); mx += c[0] / machines.length; mz += c[1] / machines.length; const z = c[1] + (cz - c[1]) * 0.4, x = clearOfSlopes(ctx, room, c[0] + (cx - c[0]) * 0.4, z, 0.14, ROOM); if (x != null) ctx.disc(room, r3(x), r3(z)); }
    const dx = cx - mx, dz = cz - mz, dl = Math.hypot(dx, dz), px = dl > 0.05 ? -dz / dl : 0, pz = dl > 0.05 ? dx / dl : 0, half = (Math.abs(px) * (X1 - X0) + Math.abs(pz) * (Z1 - Z0)) * 0.29;
    for (const s of dl > 0.05 ? [-1, 1] : [0]) {
      const az = Math.max(Z0 + 0.5, Math.min(Z1 - 0.5, cz + dz * 1.2 + pz * half * s)), ax = clearOfSlopes(ctx, room, Math.max(X0 + 0.5, Math.min(X1 - 0.5, cx + dx * 1.2 + px * half * s)), az, 0.14, ROOM);
      if (ax != null) ctx.disc(room, r3(ax), r3(az));
    }
  }
  if (left.length) hangPosters(ctx, room, items, at, left, 'engineering: posters', extra.slice());
  wallFields(ctx, room, items, at, { tag: 'engineering: wall fields', touch: true, also: asItems(extra) });
}

// hazard hatching at the ship's own door, where it opens from this room: a band on the floor inside its step, and up the
// face of each casing beside the opening (by its amber strip)
function doorHazard(ctx, room, items, f) {
  const O = ctx.outer || {};
  for (const { d, w } of ctx.outerDoors || []) {
    if (w.along !== 'z' || O.sill == null) continue;
    const s = w.x > 0 ? 1 : -1, [z0, z1] = [Math.max(w.span[0], room.rect[1]), Math.min(w.span[1], room.rect[3])];
    if (d.rooms[0] === room.id && z1 - z0 > 0.2) ctx.put('airlock: hazard', part(hazardBand, { len: +(z1 - z0 - 0.06).toFixed(3), wid: 0.13 }), { at: [s * (O.sill - 0.07 - 0.075), f + 0.004, (z0 + z1) / 2], rot: [-PI / 2, 0, PI / 2] });
    for (const it of items.filter((x) => x.kind === 'casing')) {
      const [x0, cz0, x1, cz1] = it.rect, sz = Math.abs(cz1 - w.span[0]) < 0.01 ? 1 : Math.abs(cz0 - w.span[1]) < 0.01 ? -1 : 0; if (!sz) continue;
      if (Math.abs(w.x - (w.x > 0 ? x1 : x0)) > 0.01) continue;
      const zf = sz > 0 ? cz1 + 0.003 : cz0 - 0.003, xe = w.x > 0 ? x0 + 0.13 : x1 - 0.13, h = +it.h || 2;
      ctx.put(room.kind === 'airlock' ? 'airlock: hazard' : 'wash: hazard', part(hazardBand, { len: +(h - 0.25).toFixed(3), wid: 0.07 }), { at: [xe, f + h / 2, zf], rot: [0, sz > 0 ? 0 : PI, PI / 2] });
      // (and on its face toward the room, a pale raised panel: the casing is dark, and from inside it read as a hole)
      const fx = w.x > 0 ? x0 : x1, fw = cz1 - cz0 - 0.04;
      if (fw > 0.1) ctx.put(room.kind === 'airlock' ? 'airlock: casing panels' : 'wash: casing panels', part(casingPanel, { w: +fw.toFixed(3), h: +(h - 0.12).toFixed(3) }), { at: [fx - (w.x > 0 ? 0.001 : -0.001), f + h / 2, (cz0 + cz1) / 2], rot: [0, w.x > 0 ? -PI / 2 : PI / 2, 0] });
    }
  }
}
function hazardBand(p, o) { return hazard(p, o.len, o.wid, [0, 0, 0]); }
function casingPanel(p, o) { add(p, 'white2', relief(shape(o.w, o.h, 0.03), [{ inset: 0, depth: 0.007, bevel: 0.006 }, { inset: 0.025, depth: 0.0035, bevel: 0.004 }])); return p; }

// ── placing helpers ─────────────────────────────────────────────────────────────────────────────────────────────
const roomWalls = (room) => { const [X0, Z0, X1, Z1] = room.rect; return [{ axis: 'x', v: X0, side: 1, lo: Z0, hi: Z1 }, { axis: 'x', v: X1, side: -1, lo: Z0, hi: Z1 }, { axis: 'z', v: Z0, side: 1, lo: X0, hi: X1 }, { axis: 'z', v: Z1, side: -1, lo: X0, hi: X1 }]; };
// a point in a wall fitting's own frame ([x along the wall, y, z out from the wall line]) in the ship's, and the fitting's
// turn about y (as placing)
const rotOf = (W) => (W.axis === 'z' ? (W.side > 0 ? 0 : PI) : (W.side > 0 ? PI / 2 : -PI / 2));
function toWorld(W, mid, [x, y, z]) {
  if (W.axis === 'z') return W.side > 0 ? [mid + x, y, W.v + z] : [mid - x, y, W.v - z];
  return W.side > 0 ? [W.v + z, y, mid - x] : [W.v - z, y, mid + x];
}
// a thing `half` either side of x (at z along the room), its top at yTop: x moved in from the hull's sides until their
// slopes clear it (a slope over a side at y0 is 45 degrees: d in from the wall it is y0 + d up), or null if it can't be
const clearOfSlopes = (ctx, room, x, z, half, yTop) => {
  let lo = room.rect[0] + half + 0.03, hi = room.rect[2] - half - 0.03;
  const a = ctx.slopeAt('x', room.rect[0], z), b = ctx.slopeAt('x', room.rect[2], z);
  if (a && yTop + 0.05 > a.y0) lo = Math.max(lo, room.rect[0] + (yTop + 0.05 - a.y0) + half);
  if (b && yTop + 0.05 > b.y0) hi = Math.min(hi, room.rect[2] - (yTop + 0.05 - b.y0) - half);
  return lo > hi ? null : Math.max(lo, Math.min(hi, x));
};
// the whole of the room's wall an item's wall W lies on
const roomWall = (room, W) => ({ ...W, lo: W.axis === 'z' ? room.rect[0] : room.rect[1], hi: W.axis === 'z' ? room.rect[2] : room.rect[3] });
// a block on wall W for clearStretches (in the wall's own stretch, world): [lo, hi] along it, [y0, y1]; from x0 to x1 in a
// fitting's own x there (its middle at mid)
const block = (W, x0, x1, mid, y0, y1) => { const a = W.axis === 'z' ? W.side * x0 + mid : -W.side * x0 + mid, b = W.axis === 'z' ? W.side * x1 + mid : -W.side * x1 + mid; return { axis: W.axis, v: W.v, side: W.side, lo: Math.min(a, b), hi: Math.max(a, b), y0, y1 }; };
// blocks as plan items hanging on their walls (for wallFields: `also`)
const asItems = (blocks) => blocks.map((B) => ({ rect: B.axis === 'x' ? (B.side > 0 ? [B.v, B.lo, B.v + 0.05, B.hi] : [B.v - 0.05, B.lo, B.v, B.hi]) : (B.side > 0 ? [B.lo, B.v, B.hi, B.v + 0.05] : [B.lo, B.v - 0.05, B.hi, B.v]), y: Math.max(0.01, B.y0), h: B.y1 - Math.max(0.01, B.y0) }));
// whether a point stands in a doorway's way: within `r` of the stretch 0.9 m into the room in front of any of its doors'
// clear openings
function inDoorway(bp, room, x, z, r) {
  const [X0, Z0, X1, Z1] = room.rect;
  for (const d of bp.doors || []) {
    if (!d.rooms.includes(room.id)) continue;
    const [dx, dz] = d.at, hw = d.width / 2;
    for (const W of [{ axis: 'x', v: X0, side: 1 }, { axis: 'x', v: X1, side: -1 }, { axis: 'z', v: Z0, side: 1 }, { axis: 'z', v: Z1, side: -1 }]) {
      if (Math.abs((W.axis === 'x' ? dx : dz) - W.v) > EPS) continue;
      const n = W.axis === 'x' ? (x - W.v) * W.side : (z - W.v) * W.side, t = W.axis === 'x' ? z : x, c = W.axis === 'x' ? dz : dx;
      if (n > -r && n < 0.9 + r && t > c - hw - r && t < c + hw + r) return true;
    }
  }
  return false;
}
// an item's ends along its wall that are open to the room (not at a wall, nothing standing against them): the worktop's
// chamfer [left, right] in its own x
function openEnds(W, room, items, it, mid) {
  const [R0, R1] = W.axis === 'z' ? [room.rect[0], room.rect[2]] : [room.rect[1], room.rect[3]];
  const open = (a) => Math.abs(a - R0) > EPS && Math.abs(a - R1) > EPS && !items.some((o) => o !== it && !+(o.y || 0) && alongOf(o, W).some((v) => Math.abs(v - a) < 0.06) && wallOf(o, room)?.v === W.v);
  const ends = [W.lo, W.hi].map((a) => (open(a) ? 0.08 : 0));
  return localX(W, mid, W.lo) < 0 ? ends : ends.slice().reverse();
}
// the clear stretches of wall W (along it, world) between heights y0 and y1: its face less its doorways (and their
// panels), what stands against it reaching into the band or hangs on it there, the blocks given; none under a slope that
// starts below the band's top. (m: the margins kept from the wall's ends (end, 0.07) and from what cuts it (cut, 0.05))
function clearStretches(ctx, room, items, W, y0, y1, blocks = [], m = {}) {
  const slope = ctx.slopeAt(W.axis, W.v, (W.lo + W.hi) / 2); if (slope && slope.y0 < y1 + 0.04) return [];
  const touches = (it) => { const [x0, z0, x1, z1] = it.rect; return W.axis === 'x' ? Math.abs((W.side > 0 ? x0 : x1) - W.v) < EPS && z1 > W.lo + EPS && z0 < W.hi - EPS : Math.abs((W.side > 0 ? z0 : z1) - W.v) < EPS && x1 > W.lo + EPS && x0 < W.hi - EPS; };
  const cut = [...ctx.openings(W.axis, W.v),
    ...items.filter((it) => touches(it) && (hangs(it) ? +it.y < y1 + 0.02 && +it.y + +it.h > y0 : +it.h > y0 - 0.02)).map((it) => alongOf(it, W)),
    ...blocks.filter((B) => B.axis === W.axis && Math.abs(B.v - W.v) < EPS && B.y1 > y0 && B.y0 < y1).map((B) => [B.lo, B.hi])];
  const e = m.end ?? 0.07, k = m.cut ?? 0.05;
  let free = [[W.lo + FACE + e, W.hi - FACE - e]];
  for (const [a, b] of cut) free = free.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, a - k], [b + k, q]]));
  return free.filter(([p, q]) => q - p > 0.1);
}
// a room's posters (POSTERS indices) on its clearest walls at eye height (each poster's middle at 1.4 m), one to a clear
// stretch, the widest stretches first; each placed is added to `blocks`
function hangPosters(ctx, room, items, at, list, tag, blocks = []) {
  const [X0, Z0, X1, Z1] = room.rect, walls = [{ axis: 'x', v: X0, side: 1, lo: Z0, hi: Z1 }, { axis: 'x', v: X1, side: -1, lo: Z0, hi: Z1 }, { axis: 'z', v: Z0, side: 1, lo: X0, hi: X1 }, { axis: 'z', v: Z1, side: -1, lo: X0, hi: X1 }];
  for (const i of list) {
    const P = POSTERS[i], y = 1.4, y0 = y - P.h / 2 - 0.04, y1 = y + P.h / 2 + 0.04;
    const spots = walls.flatMap((W) => clearStretches(ctx, room, items, W, y0, y1, blocks).map(([p, q]) => ({ W, p, q }))).filter((s) => s.q - s.p >= P.w + 0.08).sort((a, b) => (b.q - b.p) - (a.q - a.p));
    const s = spots[0]; if (!s) continue;
    const c = (s.p + s.q) / 2, mid = (s.W.lo + s.W.hi) / 2;
    ctx.put(tag, part(poster, { i, y }), at(s.W, c));
    blocks.push({ axis: s.W.axis, v: s.W.v, lo: c - P.w / 2 - 0.3, hi: c + P.w / 2 + 0.3, y0: 0, y1: 3 });
  }
  return blocks;
}

// the overhead cabinets in a room's top corners (the mess's)
function topCorner(ctx, room, items, done, at, A, tag) {
  for (const it of items) {
    if (done.has(it.id) || it.kind !== 'overhead') continue;
    const W = wallOf(it, room); if (!W) continue;
    const mid = (W.lo + W.hi) / 2, slope = ctx.slopeAt(W.axis, W.v, mid);
    ctx.put(tag + ': top cabinets', part(topCabinets, { len: W.hi - W.lo, y: +it.y, depth: W.depth, ceiling: typeof room.ceiling === 'number' ? room.ceiling : 2.5, slope, handle: A.handle, trim: A.trim }), at(W, mid));
    done.add(it.id);
  }
}
// the berths' numbers (1 to 8, round again after), through the ship's bunk rooms in plan order, the upper berth first:
// bunk id -> [upper, lower] (or [one])
function berthNumbers(bp) {
  const out = new Map(), kinds = Object.fromEntries((bp.rooms || []).map((r) => [r.id, r.kind])); let n = 0;
  for (const it of bp.items || []) if (it.kind === 'bunk' && kinds[it.room] === 'bunks') out.set(it.id, (+it.h || 1.9) >= 1.5 ? [n++ % 8 + 1, n++ % 8 + 1] : [n++ % 8 + 1]);
  return out;
}
const centre = (it) => [(it.rect[0] + it.rect[2]) / 2, (it.rect[1] + it.rect[3]) / 2], dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// an item's stretch along wall W, and whether it stands in front of a fitting on W (within 0.3 m of its front, along it)
const alongOf = (it, W) => (W.axis === 'z' ? [it.rect[0], it.rect[2]] : [it.rect[1], it.rect[3]]);
function inFront(it, W) {
  const front = W.v + W.side * W.depth, [n0, n1] = W.axis === 'x' ? [it.rect[0], it.rect[2]] : [it.rect[1], it.rect[3]], [a, b] = alongOf(it, W);
  const [f0, f1] = W.side > 0 ? [front - 0.01, front + 0.3] : [front - 0.3, front + 0.01];
  return n1 > f0 && n0 < f1 && b > W.lo + 0.01 && a < W.hi - 0.01;
}
// the way into a room through its inside doors, on average ([x, z])
function enterDir(bp, room) {
  let x = 0, z = 0;
  for (const d of bp.doors || []) {
    if (!d.rooms.includes(room.id) || d.rooms.includes('outside')) continue;
    const [X0, Z0, X1, Z1] = room.rect, [dx, dz] = d.at;
    if (Math.abs(dz - Z0) < EPS) z += 1; else if (Math.abs(dz - Z1) < EPS) z -= 1; else if (Math.abs(dx - X0) < EPS) x += 1; else if (Math.abs(dx - X1) < EPS) x -= 1;
  }
  const l = Math.hypot(x, z) || 1; return [x / l, z / l];
}

// the look's accents: the surfaces for the things it names (kit/ships/cabin-built.js LOOKS accents), in its leather's
// colour, each marked with its name (kit/bevel.js add: for a live recolour); undefined: the fitting's own
function accents(look) {
  const c = look?.leather, on = (k) => !!c && (look.accents || []).includes(k);
  return {
    pad: on('stools') ? c : undefined,
    cup: on('mugs') ? { c, r: 0.3, m: 0, w: 0.2, accent: 'mugs' } : undefined,
    handle: on('handles') ? { c, r: 0.4, m: 0.2, w: 0.3, accent: 'handles' } : undefined,
    trim: on('trim') ? { c, r: 0.45, m: 0.2, w: 0.3, accent: 'trim' } : undefined,
    bedding: on('bedding') ? { c, r: 0.86, m: 0, w: 0.25, accent: 'bedding' } : undefined,
    leather: c ? { c, r: 0.66, m: 0, w: 0.25, accent: 'leather' } : undefined,
  };
}

// ── the walls' chamfered fields: on each of the room's walls, wherever it is clear, a raised border-bevel field under the
// band (0.18 to 1.14 m) and one over it (1.6 m to under the wall's top, the hull's slope or the ceiling), in fields up to
// 1.2 m wide. Clear: no doorway (and its control panel) on that stretch, and for the lower field nothing standing
// against the wall there, for the upper nothing hanging there nor standing taller than 1.5 m.
// (o.tag: what its triangles count as; o.touch: an item stands against every wall its box touches, not only its longest
// side's (a bunk in a corner): the other rooms'; the mess's as round one built it; o.also: more boxes against the walls,
// as the plan's items ({ rect, h, y }): what the fittings add, a bench, a poster)
const FIELD = { lower: [0.18, 1.14], middle: [1.0, 1.52], upper: 1.6, most: 1.2, gap: 0.06, end: 0.07 };
function wallFields(ctx, room, items0, at, o = {}) {
  const [X0, Z0, X1, Z1] = room.rect, items = [...items0, ...(o.also || [])], tag = o.tag || 'mess: wall fields';
  const touches = (it, W) => { const [x0, z0, x1, z1] = it.rect; return (W.axis === 'x' ? Math.abs((W.side > 0 ? x0 : x1) - W.v) < EPS && z1 > W.lo + EPS && z0 < W.hi - EPS : Math.abs((W.side > 0 ? z0 : z1) - W.v) < EPS && x1 > W.lo + EPS && x0 < W.hi - EPS); };
  for (const W of [{ axis: 'x', v: X0, side: 1, lo: Z0, hi: Z1 }, { axis: 'x', v: X1, side: -1, lo: Z0, hi: Z1 }, { axis: 'z', v: Z0, side: 1, lo: X0, hi: X1 }, { axis: 'z', v: Z1, side: -1, lo: X0, hi: X1 }]) {
    const slope = ctx.slopeAt(W.axis, W.v, (W.lo + W.hi) / 2), top = slope ? slope.y0 - 0.07 : (typeof room.ceiling === 'number' ? room.ceiling : 2.5) - 0.12;
    const doors = ctx.openings(W.axis, W.v), against = items.filter((it) => { if (o.touch) return touches(it, W); const w = wallOf(it, room); return w && w.axis === W.axis && Math.abs(w.v - W.v) < EPS; });
    const span = (it) => (W.axis === 'z' ? [it.rect[0], it.rect[2]] : [it.rect[1], it.rect[3]]);
    // (and over a low bench or counter, between its top and the band's top: the middle field, under any cabinet there)
    const low = against.filter((it) => !+(it.y || 0) && +it.h <= 0.95).map(span), hangLow = against.filter((it) => +(it.y || 0) && +it.y < FIELD.middle[1] + 0.08);
    const middle = [FIELD.middle[0], Math.min(FIELD.middle[1], ...hangLow.map((it) => +it.y - 0.08)), [...against.filter((it) => !+(it.y || 0) && +it.h > 0.95).map(span), ...low.length ? [] : [[-1e9, 1e9]]]];
    const lowFree = (fs) => fs.flatMap(([p, q]) => low.filter(([a, b]) => b > p && a < q).map(([a, b]) => [Math.max(p, a), Math.min(q, b)]));
    for (const [y0, y1, blocks, only] of [[...FIELD.lower, against.filter((it) => !+(it.y || 0)).map(span)], [FIELD.upper, top, against.filter((it) => +(it.y || 0) || +it.h > 1.5).map(span)], [...middle, true]]) {
      if (y1 - y0 < 0.25) continue;
      // (the clear stretches: the wall's face less the doorways and the blocks)
      let free = [[W.lo + FACE + FIELD.end, W.hi - FACE - FIELD.end]];
      for (const [a, b] of [...doors, ...blocks]) free = free.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, a - FIELD.gap], [b + FIELD.gap, q]]));
      for (const [p, q] of only ? lowFree(free) : free) {
        if (q - p < 0.4) continue;
        const n = Math.ceil((q - p + FIELD.gap) / (FIELD.most + FIELD.gap) - EPS), w = (q - p - FIELD.gap * (n - 1)) / n;
        for (let i = 0; i < n; i++) { const a = p + i * (w + FIELD.gap) + w / 2; ctx.put(tag, part(wallField, { w: +w.toFixed(3), h: +(y1 - y0).toFixed(3), y: +((y0 + y1) / 2).toFixed(3), c: 0.05 }), at(W, a)); }
      }
    }
  }
}
