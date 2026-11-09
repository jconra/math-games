// FURNISHING A CABIN'S ROOMS: the blueprint's items (plan boxes) turned into the cabin kit's fittings, for the room kinds
// that have them so far (this round: the galley / mess, kit/shipparts/cabin/mess.js). kit/ships/cabin-built.js calls it;
// what it builds is left out of the plan's boxes.
//   furnishRoom(q, bp, room, ctx) -> the ids of the items it built
//     ctx: { put(what, src, o) (the builder's placeInto, counting triangles by `what`: 'mess: benches' and so on), slopeAt(axis, v, at) (the hull's
//            slope over a wall line at a point along it: { y0, run } or null), openings(axis, v) (the stretches along a
//            wall line its doorways and their control panels take), look (the cabin's LOOKS entry) }
// How an item is read:
//   - against a wall: the item's long side that lies on one of its room's walls (a square item: any side on a wall);
//     its fitting stands on that wall line, facing into the room (kit/shipparts/cabin/ship.js's wall frame)
//   - benches meeting at a corner make an L: the one whose box reaches the other's wall runs its seat and back cushion on
//     to the other's back cushion; the other runs its back cushion on into the corner, to the first one's wall
//   - a table: its stools stand along the sides with no bench (two along a long side, one at a short end), tucked a
//     little under its top
//   - an overhead cabinet: its fitting in that wall's top corner, its top following the hull's slope if there is one
//   - the mess's posters (kit/shipparts/cabin/print.js POSTERS, in order): the middle cabinet over the bench, the wall
//     over the second bench, the hull's side under the cabinets, the cold store's door
import { part } from '../shipparts/place.js';
import { FACE } from '../shipparts/cabin/ship.js';
import { cornerBench, messTable, stool, topCabinets, coldStore, galleyRun, coffeeMachine, mug, bottle, fruitBowl, poster, wallField } from '../shipparts/cabin/mess.js';

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
  if (room.kind !== 'galley') return new Set();
  const done = new Set(), items = (bp.items || []).filter((it) => it.room === room.id), f = +(room.floor || 0);
  const at = (W, mid, y = 0) => { const P = placing(W, mid); P.at[1] = f + y; return P; };
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
    ctx.put('mess: benches', part(cornerBench, { len, depth: W.depth, seat: +B.it.h || 0.45, seatAt: L(seat), backAt: L(back), leather: ctx.look?.leather }), at(W, mid));
    B.back = back; done.add(B.it.id);
  }
  // ── the table and its stools; a mug or two and a bottle on it ──
  for (const it of items.filter((x) => x.kind === 'table')) {
    const [x0, z0, x1, z1] = it.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = +it.h || 0.75;
    ctx.put('mess: table', part(messTable, { w: x1 - x0, d: z1 - z0, h }), { at: [cx, f, cz] });
    const near = (side) => items.some((o) => o !== it && !+(o.y || 0) && (side === '-x' ? Math.abs(o.rect[2] - x0) < 0.06 && o.rect[1] < z1 && o.rect[3] > z0 : side === '+x' ? Math.abs(o.rect[0] - x1) < 0.06 && o.rect[1] < z1 && o.rect[3] > z0 : side === '-z' ? Math.abs(o.rect[3] - z0) < 0.06 && o.rect[0] < x1 && o.rect[2] > x0 : Math.abs(o.rect[1] - z1) < 0.06 && o.rect[0] < x1 && o.rect[2] > x0));
    const spots = [];
    for (const [side, along, a0, a1, pos] of [['-x', 'z', z0, z1, x0 - 0.03], ['+x', 'z', z0, z1, x1 + 0.03], ['-z', 'x', x0, x1, z0 - 0.03], ['+z', 'x', x0, x1, z1 + 0.03]]) {
      if (near(side)) continue;
      const n = a1 - a0 >= 0.9 ? 2 : 1;
      for (let k = 0; k < n; k++) { const a = a0 + (a1 - a0) * (k + 1) / (n + 1); spots.push(along === 'z' ? [pos, a] : [a, pos]); }
    }
    for (const [sx, sz] of spots) ctx.put('mess: stools', part(stool, {}), { at: [sx, f, sz] });
    const top = f + h;
    ctx.put('mess: small things', part(mug, {}), { at: [cx + 0.15 * (x1 - x0) / 0.75, top, cz - 0.25], rot: [0, 2.2, 0] });
    ctx.put('mess: small things', part(mug, {}), { at: [cx - 0.12, top, cz + 0.22], rot: [0, -0.6, 0] });
    ctx.put('mess: small things', part(bottle, {}), { at: [cx - 0.08, top, cz - 0.05] });
    done.add(it.id);
  }
  // ── against the walls: the cold store, the counter (and what stands on it), the cabinets in the top corners ──
  let posterAt = 0;
  for (const it of items) {
    if (done.has(it.id)) continue;
    const W = wallOf(it, room); if (!W) continue;
    const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo;
    if (it.kind === 'locker' && +it.h >= 1.8) { ctx.put('mess: cold store', part(coldStore, { w: len, depth: W.depth - 0.03, h: +it.h, poster: 3 }), at(W, mid)); done.add(it.id); }
    else if (it.kind === 'counter') {
      // (an end open to the room, not at a wall and with nothing standing against it, gets a chamfered worktop corner)
      const [R0, R1] = W.axis === 'z' ? [room.rect[0], room.rect[2]] : [room.rect[1], room.rect[3]];
      const span = (o) => (W.axis === 'z' ? [o.rect[0], o.rect[2]] : [o.rect[1], o.rect[3]]);
      const open = (a) => Math.abs(a - R0) > EPS && Math.abs(a - R1) > EPS && !items.some((o) => o !== it && !+(o.y || 0) && span(o).some((v) => Math.abs(v - a) < 0.06) && wallOf(o, room)?.v === W.v);
      const ends = [W.lo, W.hi].map((a) => (open(a) ? 0.08 : 0)), ch = localX(W, mid, W.lo) < 0 ? ends : ends.slice().reverse();
      ctx.put('mess: counter', part(galleyRun, { len, depth: W.depth, top: +it.h || 0.9, end: ch }), at(W, mid));
      // (on it, in from the wall: the coffee machine part way from its closed end (a tall neighbour may hide that end),
      // two mugs beside it, the bowl of fruit toward the open end)
      const P = at(W, mid, +it.h || 0.9), inward = (d) => (W.axis === 'z' ? [0, 0, W.side * d] : [W.side * d, 0, 0]), alongV = W.axis === 'z' ? [1, 0, 0] : [0, 0, 1];
      const far = ends[0] ? W.hi : W.lo, sgn = far === W.hi ? -1 : 1, pt = (a, d) => { const o = inward(d); return [P.at[0] + alongV[0] * (a - mid) + o[0], P.at[1], P.at[2] + alongV[2] * (a - mid) + o[2]]; };
      ctx.put('mess: small things', part(coffeeMachine, {}), { at: pt(far + sgn * len * 0.4, 0.19), rot: P.rot });
      ctx.put('mess: small things', part(mug, {}), { at: pt(far + sgn * len * 0.58, 0.14), rot: [0, P.rot[1] + 0.7, 0] });
      ctx.put('mess: small things', part(mug, {}), { at: pt(far + sgn * len * 0.65, 0.3), rot: [0, P.rot[1] - 0.4, 0] });
      ctx.put('mess: small things', part(fruitBowl, {}), { at: pt(far + sgn * len * 0.84, 0.24), rot: P.rot });
      done.add(it.id);
    } else if (it.kind === 'overhead') {
      const slope = ctx.slopeAt(W.axis, W.v, mid), poster = W.depth >= 0.4 && posterAt === 0 ? 0 : null; if (poster === 0) posterAt++;
      ctx.put('mess: top cabinets', part(topCabinets, { len, y: +it.y, depth: W.depth, ceiling: room.ceiling === undefined || typeof room.ceiling !== 'number' ? 2.5 : room.ceiling, slope, poster }), at(W, mid));
      done.add(it.id);
    }
  }
  // ── the posters on the walls: over the second bench (the one along a partition), on the hull's side under its cabinets
  // (over the middle of its back cushion)
  const along = benches.find((b) => !slopeOver(b.W)), hull = benches.find((b) => slopeOver(b.W));
  if (along) ctx.put('mess: posters', part(poster, { i: 1, dark: true, y: 1.42 }), at(along.W, (along.back[0] + along.back[1]) / 2));
  if (hull) ctx.put('mess: posters', part(poster, { i: 2, y: 1.33 }), at(hull.W, (hull.W.lo + hull.W.hi) / 2));
  wallFields(ctx, room, items, at);
  return done;
}

// ── the walls' chamfered fields: on each of the room's walls, wherever it is clear, a raised border-bevel field under the
// band (0.18 to 1.14 m) and one over it (1.6 m to under the wall's top, the hull's slope or the ceiling), in fields up to
// 1.2 m wide. Clear: no doorway (and its control panel) on that stretch, and for the lower field nothing standing
// against the wall there, for the upper nothing hanging there nor standing taller than 1.5 m.
const FIELD = { lower: [0.18, 1.14], upper: 1.6, most: 1.2, gap: 0.06, end: 0.07 };
function wallFields(ctx, room, items, at) {
  const [X0, Z0, X1, Z1] = room.rect;
  for (const W of [{ axis: 'x', v: X0, side: 1, lo: Z0, hi: Z1 }, { axis: 'x', v: X1, side: -1, lo: Z0, hi: Z1 }, { axis: 'z', v: Z0, side: 1, lo: X0, hi: X1 }, { axis: 'z', v: Z1, side: -1, lo: X0, hi: X1 }]) {
    const slope = ctx.slopeAt(W.axis, W.v, (W.lo + W.hi) / 2), top = slope ? slope.y0 - 0.07 : (typeof room.ceiling === 'number' ? room.ceiling : 2.5) - 0.12;
    const doors = ctx.openings(W.axis, W.v), against = items.filter((it) => { const w = wallOf(it, room); return w && w.axis === W.axis && Math.abs(w.v - W.v) < EPS; });
    const span = (it) => (W.axis === 'z' ? [it.rect[0], it.rect[2]] : [it.rect[1], it.rect[3]]);
    for (const [y0, y1, blocks] of [[...FIELD.lower, against.filter((it) => !+(it.y || 0)).map(span)], [FIELD.upper, top, against.filter((it) => +(it.y || 0) || +it.h > 1.5).map(span)]]) {
      if (y1 - y0 < 0.25) continue;
      // (the clear stretches: the wall's face less the doorways and the blocks)
      let free = [[W.lo + FACE + FIELD.end, W.hi - FACE - FIELD.end]];
      for (const [a, b] of [...doors, ...blocks]) free = free.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, a - FIELD.gap], [b + FIELD.gap, q]]));
      for (const [p, q] of free) {
        if (q - p < 0.4) continue;
        const n = Math.ceil((q - p + FIELD.gap) / (FIELD.most + FIELD.gap) - EPS), w = (q - p - FIELD.gap * (n - 1)) / n;
        for (let i = 0; i < n; i++) { const a = p + i * (w + FIELD.gap) + w / 2; ctx.put('mess: wall fields', part(wallField, { w: +w.toFixed(3), h: +(y1 - y0).toFixed(3), y: +((y0 + y1) / 2).toFixed(3), c: 0.05 }), at(W, a)); }
      }
    }
  }
}
