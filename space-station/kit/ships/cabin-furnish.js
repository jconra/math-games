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
import { postersFor } from '../shipparts/cabin/print.js';
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
const ROOMS = { galley: furnishGalley, bunks: furnishBunks };

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
  wallFields(ctx, room, items, at, { tag: 'bunks: wall fields', touch: true });
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
