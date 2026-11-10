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
// at the open end, the ladder at the foot end), berths numbered through the ship (upper first, in plan order); each
// locker numbered for the berth it serves (its name's "upper" / "lower", else in turn), its posters on the lockers that
// face whoever comes in; the overhead cabinets as the mess's.
import { part } from '../shipparts/place.js';
import { FACE } from '../shipparts/cabin/ship.js';
import { cornerBench, messTable, stool, topCabinets, coldStore, galleyRun, coffeeMachine, mug, bottle, fruitBowl, poster, wallField } from '../shipparts/cabin/mess.js';
import { bunkStack, crewLocker } from '../shipparts/cabin/bunks.js';
import { labBench, microscope, glovebox, vialRack, tablet, sampleCase, surveyTable, labStool } from '../shipparts/cabin/lab.js';
import { suitLockers, pressurePanel, wallBench } from '../shipparts/cabin/airlock.js';
import { showerStall, toiletBasin } from '../shipparts/cabin/washroom.js';
import { screen, starScreen, hazard } from '../shipparts/cabin/bits.js';
import { POSTERS, postersFor } from '../shipparts/cabin/print.js';
import { hangs } from './blueprint.js';

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
const ROOMS = { galley: furnishGalley, bunks: furnishBunks, science: furnishScience, airlock: furnishAirlock, washroom: furnishWash };

// ── the galley ──────────────────────────────────────────────────────────────────────────────────────────────────
function furnishGalley({ room, ctx, done, items, f, at, A }) {
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
function furnishBunks({ bp, room, ctx, done, items, at, A }) {
  const nums = berthNumbers(bp), stacks = items.filter((it) => it.kind === 'bunk').map((it) => ({ it, W: wallOf(it, room) })).filter((S) => S.W);
  for (const S of stacks) {
    const { it, W } = S, mid = (W.lo + W.hi) / 2, len = W.hi - W.lo, h = +it.h || 1.9;
    // (what stands in front of its face, as stretches of its own x)
    const blocks = items.filter((o) => o !== it && !hangs(o) && inFront(o, W)).map((o) => alongOf(o, W).map((a) => localX(W, mid, a)).sort((a, b) => a - b));
    let open = [[-len / 2 + 0.08, len / 2 - 0.08]];
    for (const [a, b] of blocks) open = open.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, a - 0.05], [b + 0.05, q]])).filter(([p, q]) => q - p > 0.05);
    const best = open.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0], use = best && best[1] - best[0] >= 0.9 ? best : [-len / 2 + 0.08, len / 2 - 0.08];
    const bmid = blocks.length ? blocks.reduce((t, [a, b]) => t + a + b, 0) / (2 * blocks.length) : -1, head = bmid < (use[0] + use[1]) / 2 ? 1 : -1;
    ctx.put('bunks: berths', part(bunkStack, { len, depth: W.depth, h, open: use.map((v) => +v.toFixed(3)), head, nums: nums.get(it.id), bedding: A.bedding, handle: A.handle, trim: A.trim }), at(W, mid));
    done.add(it.id);
  }
  // the lockers: each the number of the berth it serves; the posters on those facing whoever comes in
  const lockers = items.filter((it) => it.kind === 'locker' && !hangs(it)).map((it) => ({ it, W: wallOf(it, room) })).filter((L) => L.W);
  const into = enterDir(bp, room), facing = (W) => (W.axis === 'x' ? [W.side, 0] : [0, W.side]);
  const posters = postersFor('bunks'), byView = lockers.slice().sort((a, b) => score(b.W) - score(a.W)), withPoster = new Map(byView.slice(0, posters.length).filter((L) => score(L.W) > 0.3).map((L, i) => [L.it.id, posters[i]]));
  function score(W) { const [fx, fz] = facing(W); return -(fx * into[0] + fz * into[1]); }
  const served = new Map();
  for (const L of lockers) {
    const { it, W } = L, mid = (W.lo + W.hi) / 2, c = centre(it);
    const S = stacks.slice().sort((a, b) => dist(centre(a.it), c) - dist(centre(b.it), c))[0], n = S ? nums.get(S.it.id) : null;
    const name = (it.name || '').toLowerCase(), k = served.get(S) || 0; served.set(S, k + 1);
    const num = n ? (n.length === 1 ? n[0] : /upper/.test(name) ? n[0] : /lower/.test(name) ? n[1] : n[k % 2]) : null;
    ctx.put('bunks: lockers', part(crewLocker, { w: W.hi - W.lo, depth: W.depth, h: +it.h || 2, num, poster: withPoster.get(it.id) ?? null, handle: A.handle, trim: A.trim }), at(W, mid));
    done.add(it.id);
  }
  topCorner(ctx, room, items, done, at, A, 'bunks');
  // (posters no locker took, on the clearest walls)
  const hung = new Set(withPoster.values()), left = posters.filter((i) => !hung.has(i));
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
      ctx.put('lab: survey table', part(surveyTable, { w: len, depth: W.depth, h: +it.h || 0.9, trim: A.trim }), at(W, mid)); done.add(it.id);
      // (the star screen over it, on its wall, where the wall is clear there)
      const slope = ctx.slopeAt(W.axis, W.v, mid), y1 = slope ? slope.y0 - 0.08 : 2.25, sh = Math.min(0.48, y1 - (+it.h || 0.9) - 0.42), sw = Math.min(len - 0.16, sh * 1.6);
      if (sh > 0.25 && clearStretches(ctx, room, items, roomWall(room, W), y1 - sh - 0.06, y1, extra).some(([p, q]) => p <= mid - sw / 2 - 0.04 && q >= mid + sw / 2 + 0.04)) {
        ctx.put('lab: star screen', part(starScreen, { w: +sw.toFixed(3), h: +sh.toFixed(3), seed: 11 }), { ...at(W, mid, y1 - sh / 2 - 0.04), at: toWorld(W, mid, [0, f + y1 - sh / 2 - 0.04, FACE]) });
        extra.push(block(W, mid - sw / 2 - 0.05, mid + sw / 2 + 0.05, mid, y1 - sh - 0.08, y1));
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
    ctx.put('airlock: suit lockers', part(suitLockers, { len: W.hi - W.lo, depth: W.depth, h: +it.h || 2, poster: L === single ? posters[0] : null, handle: A.handle, trim: A.trim }), at(W, mid));
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
    }
  }
}
function hazardBand(p, o) { return hazard(p, o.len, o.wid, [0, 0, 0]); }

// ── placing helpers ─────────────────────────────────────────────────────────────────────────────────────────────
const roomWalls = (room) => { const [X0, Z0, X1, Z1] = room.rect; return [{ axis: 'x', v: X0, side: 1, lo: Z0, hi: Z1 }, { axis: 'x', v: X1, side: -1, lo: Z0, hi: Z1 }, { axis: 'z', v: Z0, side: 1, lo: X0, hi: X1 }, { axis: 'z', v: Z1, side: -1, lo: X0, hi: X1 }]; };
// a point in a wall fitting's own frame ([x along the wall, y, z out from the wall line]) in the ship's, and the fitting's
// turn about y (as placing)
const rotOf = (W) => (W.axis === 'z' ? (W.side > 0 ? 0 : PI) : (W.side > 0 ? PI / 2 : -PI / 2));
function toWorld(W, mid, [x, y, z]) {
  if (W.axis === 'z') return W.side > 0 ? [mid + x, y, W.v + z] : [mid - x, y, W.v - z];
  return W.side > 0 ? [W.v + z, y, mid - x] : [W.v - z, y, mid + x];
}
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
