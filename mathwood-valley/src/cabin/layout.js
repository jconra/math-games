// WHERE THE PLAYER'S CABIN'S THINGS GO, worked out from the cabin design it is built as (world/objects/codebuild.js, a
// labs/buildings/cabins.js preset: its rooms, doorways, windows, fireplaces, porch and each room's anchors). Plain
// numbers, no three.js, so a test can read it. Everything is in the building's own frame (metres; its front toward +z;
// the floor at anchors.floor).
//
// The rooms: the MAIN room is the one the front door opens into (the table and chairs, the stove, the rug, the dog
// beds, the rifle rack, a lantern over the table); the other room, if there is one, is the BEDROOM (the bed, the
// painting over it, a lantern over it). A one-room cabin has it all in its one room. The porch rockers stand either
// side of the way in (or on the ground before the door, with no porch).
//
// THE FLOOR KEPT CLEAR (FLOOR below): before every doorway, inside and out (the door's width and FLOOR.side either side,
// FLOOR.out into the room: the door swings in there too); the walking line between a room's doorways; the hearth and
// a stride before it; the room a chair is pulled out into, the stove's front, the bed's open side. Nothing that stands
// on the floor goes there (the rug lies flat: it may).
// THE WALLS (WALLS below): every window, doorway, fireplace and mantel on a wall, with a margin round its casing, and
// the furniture standing against it (to its height; the stove's pipe all the way up) are kept clear. What hangs goes on
// the clear stretches: the steer horns over the mantel or a window where they fit, else in the middle of the widest
// clear stretch; the rest one by one, each in the middle of the widest gap left at its own height (so they come out
// spaced evenly, away from the corners and each other): the wanted posters and the fish at the eyes, the little shelves
// (the pig, the cans, the bridge, the windmill) a little lower, the sheep bell beside a door, the freight sign over one.
// The spots are worked out for every keepsake whether it's earned or not, so a new one never moves the others.
//
// SAVED SPOTS: the Building Lab's "Place things" (labs/buildings/placing.js) saves the game maker's own spots in
// models/cabin/placement.json, by design (placementKey) and thing; those win over the worked-out ones (opts.saved).
//
//   cabinLayout(anchors, { saved }) -> { main, bed (rooms: { x0, x1, z0, z1, y, ceil }), slots: { id: spec },
//                              keepsakes: { job: spot }, bedSpots: [{ x, z, rot }], porchDogs: [[x, z, turn]],
//                              sign: { x, z, rot }, wait: { x, z }, front: { x, z, ox, oz } (the front doorway, and its way
//                              out), steps: { x, z } (in front of the porch's steps), hearths: [hearth] (each fireplace:
//                              its opening, the fire's middle, where to stand to light it), walls: [wall], zones: [zone],
//                              things: [thing] (what the lab can move), checks: [problem] (checkLayout's) }
//   A slot's spec: { at: [x, y|null, z], rot (degrees), wall ([dx, 0, dz]: the wall it hangs on, at is on its face),
//                    looks: [[x, y, z]], box, extra: [...] } (the rest of a slot, its name, price and file: slots.js)
//   A keepsake's spot: on a wall { at, wall }; on the table { at, table, rot }; on the floor { at, rot }
//   checkLayout(anchors, layout) -> [{ id, what }]: anything over a window or doorway, standing in a doorway's way, on
//                              the hearth, in another thing, off its wall... (the tests want none; the lab shows them red)
//   placementKey(look)      -> 'tworoom' (a preset with its own seed) or 'tworoom/587' (another seed: other windows)
//   wallRect(id, tier)      -> [x0, x1, y0, y1] a wall thing's outline round its middle (KEEP_RECT, the posters by tier)
const D = 180 / Math.PI;

// THE FLOOR: kept clear (metres)
export const FLOOR = {
  side: 0.4,          // past each side of a doorway
  out: 1.2,           // out from a doorway with a door (it swings in there), into the room and onto the porch
  open: 0.9,          // out from an open doorway between two rooms (nothing swings: a walker's approach)
  way: 0.62,          // either side of the walking line between a room's doorways (a walker's width and a little) ...
  narrow: 0.42,       // ... or, in a cabin too small for that, at least this (a path 85 cm wide: checkLayout's)
  hearth: 0.5,        // before the hearth's stones (where you kneel to light it)
  hearthSide: 0,      // past each end of the hearth's stones
  stove: 0.7,         // before the stove's door (its own, or a cabin's box stove)
  chair: 0.35,        // behind a chair (pulled out to sit)
  bedSide: 0.5,       // along the bed's open side
  gap: 0.08,          // between two things standing on the floor
};
// THE WALLS: kept clear round what is in them, and between what hangs on them (metres)
export const WALLS = {
  window: [0.12, 0.14, 0.17],   // past a window's opening: its sides, under its sill, over its head (its casing is 7 to 10 cm)
  door: [0.22, 0.14],           // past a doorway's sides (the door swings open beside it), over its head
  hearth: [0.12, 0.12],         // past a fireplace's opening and its mantel
  end: 0.3,                     // from a wall's ends (the corners)
  gap: 0.3,                     // between two things side by side on a wall
  above: 0.12,                  // between two things one over the other
  floor: 0.25,                  // the lowest a thing hangs (its bottom over the floor)
  joist: 0.21,                  // under the ceiling on the walls the joists run into (the front and back), their ends in it
  ceil: 0.07,                   // ... and on the end walls
  furniture: 0.1,               // over the top of the furniture against a wall
};
// what hangs, round its middle (the spot's `at`): [x0, x1, y0, y1] along the wall and up (pieces.js, real size). The
// wanted posters by their buckle: one, two, then a second row.
export const KEEP_RECT = {
  cattle: [-0.88, 0.88, -0.29, 0.33],   // the steer horns on their plaque (the tips curl up)
  sheep: [-0.08, 0.08, -0.13, 0.08],    // the sheep bell on its strap
  pigs: [-0.2, 0.2, -0.02, 0.17],       // the carved pig on its little shelf
  bandits: [-0.36, 0.36, -0.7, 0.22],   // the wanted posters, all four (gold)
  deliveries: [-0.5, 0.5, -0.125, 0.125],   // the freight company's sign
  targets: [-0.23, 0.23, -0.02, 0.12],  // the shot-up cans on their shelf
  loads: [-0.21, 0.21, -0.02, 0.13],    // the model bridge on its shelf
  fish: [-0.3, 0.3, -0.16, 0.16],       // the mounted fish on its plaque
  tower: [-0.15, 0.15, -0.02, 0.42],    // the carved windmill on its shelf
  picture: [-0.38, 0.38, -0.31, 0.31],  // the painting in its frame (fitted 0.75 m across)
  rifles: [-0.66, 0.66, -0.38, 0.46],   // the rifle rack, the guns on it
};
const POSTERS = { tin: [-0.36, 0.36, -0.22, 0.22], copper: [-0.36, 0.36, -0.22, 0.22], silver: [-0.36, 0.36, -0.7, 0.22], gold: [-0.36, 0.36, -0.7, 0.22] };
export const wallRect = (id, tier) => (id === 'bandits' && POSTERS[tier] ? POSTERS[tier] : KEEP_RECT[id]);
// where each hangs: the middle of what you see, this high over the floor; `near`: beside a door (the bell), over a
// doorway (the sign), over the mantel or a window (the horns)
const HANG = {
  cattle: { y: 2.05, over: true },
  rifles: { y: 1.42, room: 'main' },
  deliveries: { y: 2.2, door: 'over' },
  sheep: { y: 1.62, door: 'beside' },
  bandits: { y: 1.48 },
  fish: { y: 1.6 },
  picture: { y: 1.62 },
  pigs: { y: 1.42 }, targets: { y: 1.42 }, loads: { y: 1.42 }, tower: { y: 1.36 },
};
// the order they are hung in: the big ones first (they need the long stretches)
// (the windmill first of the shelves: it gets a mantel's end where there's one)
const WALL_ORDER = ['cattle', 'rifles', 'deliveries', 'sheep', 'bandits', 'fish', 'tower', 'pigs', 'targets', 'loads'];
const SHELF = ['tower', 'pigs', 'targets', 'loads'];   // (they stand on a little shelf of their own: or on a mantel)
export const WALL_JOBS = ['cattle', 'sheep', 'pigs', 'bandits', 'deliveries', 'targets', 'tower', 'loads', 'fish'];
// what stands on the floor against a wall: [width along the wall, depth out from it, height]
export const FLOOR_BOX = { boxes: [0.56, 0.24, 0.66], loot: [0.52, 0.5, 0.42] };   // (the safe door leans back 8 degrees: its foot 14 cm out)

function roomOf(R, y) { const [x0, x1, z0, z1] = R.floor; return { x0, x1, z0, z1, y, ceil: R.ceiling || 3, anchors: R.anchors || {}, name: R.name, wall: R.wall || 'logs', joists: R.joists || [] }; }
const inRoom = (r, x, z, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
const mid = (r) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
const f2 = (x) => +(+x).toFixed(2);
// the room's wall nearest a point inside it: a point on its face, and the way to it ([dx, 0, dz])
function nearestWall(r, x, z) {
  const d = [[x - r.x0, [-1, 0, 0], [r.x0, z]], [r.x1 - x, [1, 0, 0], [r.x1, z]], [z - r.z0, [0, 0, -1], [x, r.z0]], [r.z1 - z, [0, 0, 1], [x, r.z1]]].sort((a, b) => a[0] - b[0])[0];
  return { dir: d[1], x: d[2][0], z: d[2][1] };
}
// a box on the floor (centre, half sizes, turned rot radians) as its corners, and two boxes overlapping (separating axes)
function corners(b) { const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [b.x + c * u * b.hw + s * v * b.hd, b.z - s * u * b.hw + c * v * b.hd]); }
function boxesMeet(a, b, gap = 0) {
  if (!a.rot && !b.rot) return Math.abs(a.x - b.x) < a.hw + b.hw + gap - 1e-6 && Math.abs(a.z - b.z) < a.hd + b.hd + gap - 1e-6;   // (both square to the walls)
  const A = corners({ ...a, hw: a.hw + gap / 2, hd: a.hd + gap / 2 }), B = corners({ ...b, hw: b.hw + gap / 2, hd: b.hd + gap / 2 });
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % 4], nx = z1 - z0, nz = x0 - x1;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, z] of A) { const d = x * nx + z * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const [x, z] of B) { const d = x * nx + z * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 + 1e-6 || b1 <= a0 + 1e-6) return false;
  }
  return true;
}
const rectBox = (x0, x1, z0, z1, extra = {}) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, rot: 0, ...extra });
const segD = (x, z, [[ax, az], [bx, bz]]) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)); return Math.hypot(x - ax - dx * t, z - az - dz * t); };

// a design's key in models/cabin/placement.json: the preset alone with its own seed (the town's player's cabin), else
// the preset and the seed (a New look's seed moves the windows)
export function placementKey(look = {}, presets = null) {
  const own = presets && presets[look.preset] ? presets[look.preset].seed : null;
  return look.seed == null || look.seed === '' || +look.seed === own ? String(look.preset || 'cabin') : `${look.preset}/${look.seed}`;
}

// THE WALLS of the rooms: each { id, room, dir (out of the room, to the wall), axis ('x': it runs along x), at (its
// line: z for an 'x' wall), a0..a1 (its stretch), top (the highest a thing may reach on it), busy: [{ u0, u1, v0, v1,
// what }] (kept clear: v in the frame's heights) }; a point on it: u along it, v up
function wallsOf(rooms, y, A) {
  const walls = [];
  for (const r of rooms) for (const [side, dir, axis, at, a0, a1] of [['back', [0, 0, -1], 'x', r.z0, r.x0, r.x1], ['front', [0, 0, 1], 'x', r.z1, r.x0, r.x1], ['left', [-1, 0, 0], 'z', r.x0, r.z0, r.z1], ['right', [1, 0, 0], 'z', r.x1, r.z0, r.z1]]) {
    walls.push({ id: `${r.name}:${side}`, room: r, side, dir, axis, at, a0, a1, y, top: r.ceil - (axis === 'x' ? WALLS.joist : WALLS.ceil), busy: [] });
  }
  const P = (w, u, v) => (w.axis === 'x' ? [u, v, w.at] : [w.at, v, u]);
  // the wall an opening is in: its way out along the wall's, its middle within `near` of the wall's line and on its stretch
  const wallOf = (c, out, near = 0.6) => walls.filter((w) => Math.abs((w.axis === 'x' ? out[2] : out[0])) > 0.9 && Math.abs((w.axis === 'x' ? c[2] : c[0]) - w.at) < near
    && (w.axis === 'x' ? c[0] : c[2]) > w.a0 - 0.1 && (w.axis === 'x' ? c[0] : c[2]) < w.a1 + 0.1);
  const along = (w, c) => (w.axis === 'x' ? c[0] : c[2]);
  for (const d of A.doorways || []) for (const w of wallOf(d.centre, d.out, 0.65)) { const u = along(w, d.centre); w.busy.push({ u0: u - d.w / 2 - WALLS.door[0], u1: u + d.w / 2 + WALLS.door[0], v0: y - 1, v1: y + d.h + WALLS.door[1], what: 'doorway', kind: 'door', door: d }); }
  for (const g of A.windows || []) for (const w of wallOf(g.centre, g.out, 0.2)) { const u = along(w, g.centre), M = WALLS.window; w.busy.push({ u0: u - g.w / 2 - M[0], u1: u + g.w / 2 + M[0], v0: g.y0 - M[1], v1: g.y1 + M[2], what: 'window', kind: 'window', win: g }); }
  for (const h of A.hearths || []) for (const w of wallOf(h.centre, h.into.map((q) => -q), 0.2)) {
    const u = along(w, h.centre), M = WALLS.hearth;
    w.busy.push({ u0: u - h.w / 2 - M[0], u1: u + h.w / 2 + M[0], v0: y - 1, v1: h.y1 + M[1], what: 'fireplace', kind: 'hearth', hearth: h });
    if (h.mantel) w.busy.push({ u0: u - h.mantel[0] / 2 - M[0] * 0.5, u1: u + h.mantel[0] / 2 + M[0] * 0.5, v0: y - 1, v1: h.mantel[1] + M[1], what: 'mantel', kind: 'mantel', hearth: h });
  }
  // (a middle chimney's stone mass against the wall between the rooms: all the way up)
  for (const b of A.blocks || []) for (const w of walls) {
    if (w.axis === 'x' ? Math.min(Math.abs(b.z0 - w.at), Math.abs(b.z1 - w.at)) > 0.25 && !(b.z0 < w.at && b.z1 > w.at) : Math.min(Math.abs(b.x0 - w.at), Math.abs(b.x1 - w.at)) > 0.25 && !(b.x0 < w.at && b.x1 > w.at)) continue;
    const u0 = w.axis === 'x' ? b.x0 : b.z0, u1 = w.axis === 'x' ? b.x1 : b.z1; if (u1 < w.a0 || u0 > w.a1) continue;
    w.busy.push({ u0: u0 - 0.12, u1: u1 + 0.12, v0: y - 1, v1: b.mass ? 99 : b.y1 + 2.5, what: b.mass ? 'the chimney' : 'the stove', kind: 'block' });
  }
  return { walls, P };
}

export function cabinLayout(A, { saved = null, trace = null } = {}) {
  const y = A.floor || 0.6;
  const rooms = (A.rooms || []).filter((R) => !R.open && R.floor).map((R) => roomOf(R, y));
  const outer = (A.doorways || []).filter((d) => !d.inner);
  const fd = outer.find((d) => d.name === 'front') || outer.find((d) => d.out && d.out[2] > 0.5) || outer[0] || { centre: [0, 1.6, (A.footprint ? A.footprint.z1 : 3)], out: [0, 0, 1], w: 0.9 };
  const front = { x: fd.centre[0], z: fd.centre[2], ox: fd.out[0], oz: fd.out[2] };
  // the room the front door opens into (the one nearest it), and the other (the bedroom)
  const byDoor = rooms.slice().sort((a, b) => Math.hypot(mid(a).x - front.x, mid(a).z - front.z) - Math.hypot(mid(b).x - front.x, mid(b).z - front.z));
  const main = byDoor[0] || { x0: -2, x1: 2, z0: -2, z1: 2, y, ceil: 3, anchors: {} };
  const bed = byDoor.find((r) => r !== main) || main;
  const both = [bed, main].filter((q, i, a) => a.indexOf(q) === i), mainFirst = [main, bed].filter((q, i, a) => a.indexOf(q) === i);
  const roomAt = (x, z, m = 0.05) => rooms.find((r) => inRoom(r, x, z, m)) || null;
  const m0 = mid(main);

  // ── THE FLOOR KEPT CLEAR ──
  // zones: boxes on the floor nothing stands in ({ x, z, hw, hd, rot, what }); ways: the walking lines between doorways
  const zones = [];
  for (const d of A.doorways || []) {
    const o = d.out, across = Math.abs(o[0]) > 0.5 ? 'z' : 'x', hwA = d.w / 2 + FLOOR.side;
    // (both sides of it: into each room it opens to, and out onto the porch or the ground; its middle is on the wall's
    // outside face, or in the middle of a wall between rooms: the zone runs from there through the wall and out)
    for (const s of [1, -1]) {
      const len = d.inner ? FLOOR.open + 0.15 : s > 0 ? FLOOR.out : FLOOR.out + 0.3;
      const zx = d.centre[0] + o[0] * s * len / 2, zz = d.centre[2] + o[2] * s * len / 2;
      zones.push({ x: zx, z: zz, hw: across === 'x' ? hwA : len / 2, hd: across === 'x' ? len / 2 : hwA, rot: 0, what: `before the ${d.name || 'door'} doorway`, door: d, outside: !d.inner && s > 0 });
    }
  }
  for (const h of A.hearths || []) {
    const n = h.into, along = Math.abs(n[0]) > 0.5 ? 'z' : 'x', dep = h.slab[1] + FLOOR.hearth, hw = h.slab[0] / 2 + FLOOR.hearthSide;
    const cx = h.centre[0] + n[0] * dep / 2, cz = h.centre[2] + n[2] * dep / 2;
    zones.push({ x: cx, z: cz, hw: along === 'x' ? hw : dep / 2, hd: along === 'x' ? dep / 2 : hw, rot: 0, what: 'on the hearth', hearth: h });
  }
  for (const b of A.blocks || []) {
    zones.push({ ...rectBox(b.x0 - (b.stove ? 0.25 : 0.05), b.x1 + (b.stove ? 0.25 : 0.05), b.z0 - (b.stove ? 0.25 : 0.05), b.z1 + (b.stove ? 0.25 : 0.05)), what: b.mass ? 'in the chimney' : 'by the stove' });
    if (b.stove) { const f = b.front || [1, 0, 0], cx = (b.x0 + b.x1) / 2 + f[0] * ((b.x1 - b.x0) / 2 + FLOOR.stove / 2), cz = (b.z0 + b.z1) / 2 + f[2] * ((b.z1 - b.z0) / 2 + FLOOR.stove / 2);
      zones.push({ x: cx, z: cz, hw: Math.abs(f[0]) > 0.5 ? FLOOR.stove / 2 : (b.x1 - b.x0) / 2, hd: Math.abs(f[0]) > 0.5 ? (b.z1 - b.z0) / 2 : FLOOR.stove / 2, rot: 0, what: 'before the stove' }); }
  }
  // the ways through: from each room's doorways to the others' (a step inside each), kept clear: nothing stands within
  // FLOOR.way of them, so the front door leads to the back one past the furniture
  const ways = [];
  for (const r of rooms) {
    const pts = (A.doorways || []).filter((d) => inRoom(r, d.centre[0], d.centre[2], 0.5))
      .map((d) => { const o = d.inner ? (inRoom(r, d.centre[0] + d.out[0] * 0.6, d.centre[2] + d.out[2] * 0.6) ? 1 : -1) : -1; return [d.centre[0] + d.out[0] * 0.6 * o, d.centre[2] + d.out[2] * 0.6 * o]; });
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) ways.push([pts[i], pts[j]]);
  }
  const wayD = (x, z) => ways.reduce((m, w) => Math.min(m, segD(x, z, w)), Infinity);
  const boxOffWays = (b, m = FLOOR.way) => { const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0);
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (wayD(b.x + c * u * b.hw + s * v * b.hd, b.z - s * u * b.hw + c * v * b.hd) <= m) return false;
    return true; };
  const boxIn = (b, r) => corners(b).every(([x, z]) => inRoom(r, x, z, 0.01));
  const doorsIn = (r) => (A.doorways || []).filter((d) => inRoom(r, d.centre[0], d.centre[2], 0.6)).map((d) => [d.centre[0], d.centre[2]]);
  const doorDist = (r, x, z) => Math.min(3, ...doorsIn(r).map(([dx, dz]) => Math.hypot(x - dx, z - dz)));
  const wallGap = (r, b) => Math.min(...corners(b).map(([x, z]) => Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z)));
  const fireAt = (A.hearths || []).map((h) => [h.centre[0] + h.into[0] * 0.3, h.centre[2] + h.into[2] * 0.3]);
  const hasFire = (r) => (A.hearths || []).some((h) => inRoom(r, h.centre[0] + h.into[0] * 0.5, h.centre[2] + h.into[2] * 0.5, 0.1));
  const stepsAlong = (a0, a1, step = 0.1) => { const o = []; for (let a = a0; a <= a1 + 1e-6; a += step) o.push(a); return o; };
  const gridIn = (r, hw, hd, step = 0.1) => { const o = []; for (const x of stepsAlong(r.x0 + hw + 0.02, r.x1 - hw - 0.02, step)) for (const z of stepsAlong(r.z0 + hd + 0.02, r.z1 - hd - 0.02, step)) o.push([x, z]); return o; };

  // the walls, with what's in them (what stands against them is added as it is placed: furnish)
  const { walls } = wallsOf(rooms, y, A);
  for (const w of walls) w.base = w.busy.slice();
  // (what stands against a wall keeps the wall over it clear to its height; the stove's pipe all the way up)
  const shadeWalls = (q) => {
    for (const w of walls) {
      const cs = corners(q), d = Math.min(...cs.map(([x, z]) => (w.axis === 'x' ? Math.abs(z - w.at) : Math.abs(x - w.at))));
      const inSpan = cs.some(([x, z]) => { const u = w.axis === 'x' ? x : z, v = w.axis === 'x' ? z : x; return u > w.a0 - 0.05 && u < w.a1 + 0.05 && Math.abs(v - w.at) < (q.pipe ? 1.0 : 0.5); });
      if (!inSpan || d > (q.pipe ? 0.9 : 0.45) || roomAt(q.x, q.z) !== w.room) continue;
      const us = cs.map(([x, z]) => (w.axis === 'x' ? x : z));
      w.busy.push({ u0: Math.min(...us) - (q.pipe ? 0.15 : 0.05), u1: Math.max(...us) + (q.pipe ? 0.15 : 0.05), v0: y - 1, v1: q.pipe ? 99 : y + q.h + WALLS.furniture, what: q.id === 'table' ? (q.chair != null ? 'a chair' : 'the table') : q.id === 'dogbeds' ? 'a dog bed' : q.id === 'safe' ? 'the safe door' : `the ${q.id}`, kind: 'furniture' });
    }
  };

  // ── THE FURNITURE ON THE FLOOR: each piece at the best of the spots on a 10 cm grid where it, and the room it needs
  // round it (a chair pulled out, the stove's front, the bed's open side), keeps clear of the doorways' floor, the
  // hearth, the ways through and what stands already; asked again less strictly (the ways, then the room round it) only
  // when nothing fits. The pieces go in one at a time, so the order matters in a small cabin: a few orders are tried
  // and the one that kept the most clear is kept. ──
  // (uses: the room round things kept clear; fire: just the floor before the stove's door and the hearth, kept clear
  // till the last)
  const LEVELS = [{ ways: FLOOR.way, uses: true, fire: true }, { ways: FLOOR.narrow, uses: true, fire: true }, { ways: FLOOR.narrow, uses: false, fire: true }, { ways: 0, uses: false, fire: false }];
  let stands = [], uses = [], picked = {};
  const clearOf = (b, gap = FLOOR.gap) => zones.every((q) => !boxesMeet(b, q)) && stands.every((q) => !boxesMeet(b, q, gap));
  // cands: [{ room, boxes: [box], use: [box], ... }] -> the best by score (higher is better), at the strictest level any fits
  // (hearthOk: the bed in a cabin with no other room for it may stand before the hearth before it's let in the way)
  const pick = (cands, score, { gap = FLOOR.gap, levels = LEVELS, id = null, hearthOk = false } = {}) => {
    if (id) picked[id] = null;
    for (const L of levels) {
      let top = null;
      for (const c of cands) {
        if (trace && id) trace(id, LEVELS.indexOf(L), !c.boxes.every((b) => boxIn(b, c.room)) ? 'out of the room' : !c.boxes.every((b) => zones.every((q) => !boxesMeet(b, q))) ? 'zone ' + (zones.find((q) => c.boxes.some((b) => boxesMeet(b, q))) || {}).what : !c.boxes.every((b) => stands.every((q) => !boxesMeet(b, q, gap))) ? 'stands ' + (stands.find((q) => c.boxes.some((b) => boxesMeet(b, q, gap))) || {}).id : (L.ways && !c.boxes.every((b) => boxOffWays(b, L.ways))) ? 'ways' : 'uses');
        if (!c.boxes.every((b) => boxIn(b, c.room) && clearOf(b, gap) && uses.every((q) => !(L.uses || (L.fire && q.fire && !(hearthOk && q.id === 'hearth'))) || !boxesMeet(b, q)) && (!L.ways || boxOffWays(b, L.ways)))) continue;
        if (L.uses && !(c.use || []).every((b) => clearOf(b, 0))) continue;
        const s = score(c); if (!top || s > top.s) top = { ...c, s };
      }
      if (top) { if (id) picked[id] = LEVELS.indexOf(L); return top; }
    }
    return null;
  };

  // THE BED's spots: in the bedroom (the main room only if the bedroom has none), its head against a wall (rot 0: the
  // head to the back, -z; 180: to the front; 90: to the left; 270: to the right), best in a corner, away from the doors,
  // with its open side kept clear; the painting goes over its head
  const HEAD = { 0: [0, 0, -1], 180: [0, 0, 1], 90: [-1, 0, 0], 270: [1, 0, 0] };
  const bedCands = [];
  for (const r of both) for (const rot of [0, 180, 90, 270]) {
    const alongX = rot === 0 || rot === 180, hw = alongX ? 0.53 : 0.95, hd = alongX ? 0.95 : 0.53;
    const fixed = rot === 0 ? r.z0 + hd + 0.02 : rot === 180 ? r.z1 - hd - 0.02 : rot === 90 ? r.x0 + hw + 0.02 : r.x1 - hw - 0.02;
    for (const a of alongX ? stepsAlong(r.x0 + hw + 0.02, r.x1 - hw - 0.02) : stepsAlong(r.z0 + hd + 0.02, r.z1 - hd - 0.02)) {
      const x = alongX ? a : fixed, z = alongX ? fixed : a, box = { x, z, hw, hd, rot: 0 }, open = [];
      for (const s of [-1, 1]) {
        const sb = alongX ? { x: x + s * (hw + FLOOR.bedSide / 2), z, hw: FLOOR.bedSide / 2, hd: hd - 0.15, rot: 0 } : { x, z: z + s * (hd + FLOOR.bedSide / 2), hw: hw - 0.15, hd: FLOOR.bedSide / 2, rot: 0 };
        if (boxIn(sb, r)) open.push(sb);
      }
      open.sort((p, q) => Math.hypot(p.x - mid(r).x, p.z - mid(r).z) - Math.hypot(q.x - mid(r).x, q.z - mid(r).z));
      bedCands.push({ room: r, x, z, rot, boxes: [box], use: open.slice(0, 1), box });
    }
  }
  const anchorBed = bed.anchors.bed;
  // (the painting hangs over the bed's head: a spot whose head wall has room for it there is better)
  const picFits = (c) => {
    const hd = HEAD[c.rot], w = walls.find((q) => q.room === c.room && q.dir[0] === hd[0] && q.dir[2] === hd[2]); if (!w) return false;
    const rc = KEEP_RECT.picture, u = w.axis === 'x' ? c.x : c.z, v = y + HANG.picture.y - (rc[2] + rc[3]) / 2;
    return [0, 0.15, -0.15].some((du) => u + du + rc[0] >= w.a0 + WALLS.end && u + du + rc[1] <= w.a1 - WALLS.end && w.base.every((b) => b.u1 <= u + du + rc[0] || b.u0 >= u + du + rc[1] || b.v1 <= v + rc[2] || b.v0 >= v + rc[3]));
  };
  for (const c of bedCands) c.pre = (c.room === bed ? 3 : 0) + (wallGap(c.room, c.box) < 0.06 ? 1 : 0) + (picFits(c) ? 0.8 : 0) + 0.35 * doorDist(c.room, c.x, c.z)
    - (anchorBed ? 0.15 * Math.hypot(c.x - anchorBed.x, c.z - anchorBed.z) : 0) - (fireAt.some(([fx, fz]) => Math.hypot(c.x - fx, c.z - fz) < 1.5) ? 0.4 : 0);

  // THE STOVE's spots: its back to a wall, its front straight out from it and kept clear; the room with no fireplace
  // first, then the main room; a corner, away from the doors and the bed
  // (its middle 56 cm out from the wall: its pipe goes up through the ceiling's boards clear of the wall's top log)
  const stBox = (x, z) => ({ x, z, hw: 0.48, hd: 0.48, rot: 0 });
  const stUse = (x, z, a) => ({ x: x + Math.sin(a) * (0.48 + FLOOR.stove / 2), z: z + Math.cos(a) * (0.48 + FLOOR.stove / 2), hw: 0.4, hd: FLOOR.stove / 2, rot: a, what: 'before the stove' });
  const sCands = [];
  for (const r of mainFirst) { const k = 0.56;
    for (const x of stepsAlong(r.x0 + k, r.x1 - k)) { sCands.push({ room: r, x, z: r.z0 + k, a: 0 }); sCands.push({ room: r, x, z: r.z1 - k, a: Math.PI }); }
    for (const z of stepsAlong(r.z0 + k, r.z1 - k)) { sCands.push({ room: r, x: r.x0 + k, z, a: Math.PI / 2 }); sCands.push({ room: r, x: r.x1 - k, z, a: -Math.PI / 2 }); } }
  const sA = main.anchors.stove;
  // (its pipe (17 cm to the stove's left and back of its middle, pieces.js stovefire) up between two joists, not into one)
  const pipeHits = (c) => { const px = c.x - 0.079 * Math.cos(c.a) - 0.046 * Math.sin(c.a); return c.room.joists.some((jx) => Math.abs(jx - px) < 0.16); };
  for (let i = sCands.length - 1; i >= 0; i--) if (pipeHits(sCands[i])) sCands.splice(i, 1);
  for (const c of sCands) { c.boxes = [stBox(c.x, c.z)]; c.use = [stUse(c.x, c.z, c.a)];
    c.pre = (hasFire(c.room) ? 0 : 1) + (c.room === main ? 0.5 : 0) + (Math.min(c.x - c.room.x0, c.room.x1 - c.x) < 0.5 && Math.min(c.z - c.room.z0, c.room.z1 - c.z) < 0.5 ? 0.6 : 0) + 0.3 * doorDist(c.room, c.x, c.z) - (sA ? 0.1 * Math.hypot(c.x - sA.x, c.z - sA.z) : 0); }

  // THE TABLE AND CHAIRS' spots: in the main room (the bedroom only if it has none), the long side along x (rot 90) or
  // z (rot 0), the two chairs on one long side (toward the room's middle first) or one at each end; near the room's own
  // table spot and a window, away from the doors
  const tableAt = (x, z, along, toMid, ends = false, tuck = false) => tableChairs(x, z, along, m0, toMid, ends, tuck);
  const tBox = (T) => ({ x: T.x, z: T.z, hw: T.along === 'x' ? 0.6 : 0.4, hd: T.along === 'x' ? 0.4 : 0.6, rot: 0 });
  const chairBox = ([cx, cz]) => ({ x: cx, z: cz, hw: 0.25, hd: 0.25, rot: 0 });
  // (a chair's room to be pulled out: behind it, away from the table)
  const chairUse = (T, [cx, cz]) => {
    if (T.ends) return T.along === 'x' ? { x: cx + Math.sign(cx - T.x) * (0.25 + FLOOR.chair / 2), z: cz, hw: FLOOR.chair / 2, hd: 0.25, rot: 0 } : { x: cx, z: cz + Math.sign(cz - T.z) * (0.25 + FLOOR.chair / 2), hw: 0.25, hd: FLOOR.chair / 2, rot: 0 };
    return T.along === 'x' ? { x: cx, z: cz + T.toMid * (0.25 + FLOOR.chair / 2), hw: 0.25, hd: FLOOR.chair / 2, rot: 0 } : { x: cx + T.toMid * (0.25 + FLOOR.chair / 2), z: cz, hw: FLOOR.chair / 2, hd: 0.25, rot: 0 };
  };
  const tA = main.anchors.table || m0, wins = (A.windows || []).map((g) => [g.centre[0], g.centre[2]]);
  // (before the hearth, past its stones: where you stand to tend the fire, and the way to it: nothing low stands there
  // while there's room elsewhere, and never the table and its chairs)
  const hearthFront = (A.hearths || []).map((h) => {
    const n = h.into, along = Math.abs(n[0]) > 0.5 ? 'z' : 'x', d0 = h.slab[1] + FLOOR.hearth, dep = 0.45, hw = h.slab[0] / 2 + 0.1;   // (95 cm clear before its stones)
    return { id: 'hearth', x: h.centre[0] + n[0] * (d0 + dep / 2), z: h.centre[2] + n[2] * (d0 + dep / 2), hw: along === 'x' ? hw : dep / 2, hd: along === 'x' ? dep / 2 : hw, rot: 0, what: 'before the hearth', fire: true };
  });
  const tCands = [], tNear = [];
  for (const r of mainFirst) for (const [x, z] of gridIn(r, 0.4, 0.4, 0.1))
    for (const along of ['x', 'z']) for (const side of [1, -1, 0, 2, -2]) {
      const T0 = tableAt(x, z, along), Tt = side === 1 ? T0 : side === -1 ? tableAt(x, z, along, -T0.toMid) : side === 0 ? tableAt(x, z, along, T0.toMid, true) : tableAt(x, z, along, side > 0 ? T0.toMid : -T0.toMid, false, true);
      const c = { room: r, T: Tt, x, z, boxes: [tBox(Tt), ...Tt.chairs.map(chairBox)], use: Tt.chairs.map((q) => chairUse(Tt, q)), side };
      if (!c.boxes.every((b) => boxIn(b, r) && zones.every((q) => !boxesMeet(b, q)))) continue;   // (never in a zone: dropped once, not every try)
      (c.boxes.some((b) => hearthFront.some((q) => boxesMeet(b, q))) ? tNear : tCands).push(c);
      c.pre = (r === main ? 3 : 0) - 0.3 * Math.hypot(x - tA.x, z - tA.z) + 0.25 * doorDist(r, x, z) + (wins.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 1.6) ? 0.2 : 0) + (side === 1 ? 0.1 : 0) - (Math.abs(side) === 2 ? 0.6 : 0);
    }
  if (!tCands.length) tCands.push(...tNear);   // (a cabin with no other room for it)

  // THE DOG BEDS' spots: three, by the walls, near one another; the first by the fire (the hearth, else the stove), the
  // main room first, the bedroom if there's no room
  const dBox = (x, z) => ({ x, z, hw: 0.44, hd: 0.44, rot: 0 });
  const dAny = [], dWall = [];
  const breeze = (A.rooms || []).filter((R) => R.open && R.floor).map((R) => ({ ...roomOf(R, y), open: true }));
  // (a bed's middle at least half a metre off a wall: the dog on it lies along the wall, and is longer than the bed)
  for (const r of [...mainFirst, ...breeze]) for (const [x, z] of gridIn(r, 0.48, 0.48, 0.1)) {
    const c = { room: r, x, z, boxes: [dBox(x, z)] }; if (!zones.every((q) => !boxesMeet(c.boxes[0], q))) continue;
    dAny.push(c); if (wallGap(r, c.boxes[0]) < 0.3) dWall.push(c);
  }

  // a thing on the floor against a wall at u (its back to the wall): its box on the floor
  const againstWall = (w, u, [bw, bd]) => {
    const n = w.dir, cx = w.axis === 'x' ? u : w.at - n[0] * (bd / 2 + 0.02), cz = w.axis === 'x' ? w.at - n[2] * (bd / 2 + 0.02) : u;
    return { x: cx, z: cz, hw: w.axis === 'x' ? bw / 2 : bd / 2, hd: w.axis === 'x' ? bd / 2 : bw / 2, rot: 0 };
  };
  const builtIn = (A.blocks || []).find((b) => b.stove && rooms.some((r) => inRoom(r, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 0.1)));
  // one try: the pieces in this order -> { cost, ... } (cost: how much had to be let go)
  const furnish = (order) => {
    stands = []; uses = []; picked = {};
    uses.push(...hearthFront);
    for (const w of walls) w.busy = w.base.slice();
    const got = {};
    for (const id of order) {
      if (id === 'bed') {
        const p = pick(bedCands, (c) => c.pre, { id: 'bed', hearthOk: true });
        got.bA = p ? { x: p.x, z: p.z, rot: p.rot } : { x: bed.x0 + 0.6, z: bed.z0 + 0.97, rot: 0 };
        stands.push({ id: 'bed', ...(p ? p.box : { x: got.bA.x, z: got.bA.z, hw: 0.53, hd: 0.95, rot: 0 }), h: 0.98 });
        if (p) for (const u of p.use) uses.push({ id: 'bed', ...u, what: 'beside the bed' });
      } else if (id === 'stove' && builtIn) {
        // (a cabin with its own box stove: the iron stove bought is that one, its fire lit; nothing more stands)
        got.st = { x: (builtIn.x0 + builtIn.x1) / 2, z: (builtIn.z0 + builtIn.z1) / 2, a: Math.atan2((builtIn.front || [1, 0, 0])[0], (builtIn.front || [1, 0, 0])[2]), room: roomAt((builtIn.x0 + builtIn.x1) / 2, (builtIn.z0 + builtIn.z1) / 2, 0.3) || main, builtIn: true };
        picked.stove = 0;
      } else if (id === 'stove') {
        // (not hard by the bed (a hot iron stove), and less still in the way of an outside door: where there's anywhere else)
        const bS = stands.find((q) => q.id === 'bed'), byBed = (c) => (bS && boxesMeet(c.boxes[0], bS, 0.1) ? 0.5 : 0);
        const byDoor = (c) => (zones.some((q) => q.door && !q.door.inner && !q.outside && boxesMeet(c.boxes[0], q, 0.4)) ? 1 : 0);
        const bA = got.bA, p = pick(sCands, (c) => c.pre - byBed(c) - byDoor(c) + (bA ? Math.min(1, Math.hypot(c.x - bA.x, c.z - bA.z) - 1.2) * 0.3 : 0), { id: 'stove' });
        got.st = p ? { x: p.x, z: p.z, a: p.a, room: p.room } : { x: main.x1 - 0.5, z: main.z0 + 0.5, a: Math.PI, room: main };
        stands.push({ id: 'stove', ...stBox(got.st.x, got.st.z), h: 99, pipe: true });
        uses.push({ id: 'stove', ...stUse(got.st.x, got.st.z, got.st.a), fire: true });
      } else if (id === 'table') {
        // (never jammed against the bed's side, where it's got into: only if there's nowhere else at all)
        const side = uses.filter((u) => u.id === 'bed'), clear = tCands.filter((c) => !c.boxes.some((b) => side.some((u) => boxesMeet(b, u))));
        let p = pick(clear, (c) => c.pre, { id: 'table' });
        if (!p) { p = pick(tCands, (c) => c.pre, { id: 'table' }); if (p) picked.table = 3; }
        const T = got.T = p ? p.T : tableAt(tA.x, tA.z, 'x');
        stands.push({ id: 'table', ...tBox(T), h: 0.8 });
        T.chairs.forEach((c, i) => { stands.push({ id: 'table', ...chairBox(c), h: 0.96, chair: i }); uses.push({ id: 'table', ...chairUse(T, c), what: 'where a chair is pulled out' }); });
      } else if (id === 'dogs') {
        const warm = fireAt.length ? fireAt : got.st ? [[got.st.x, got.st.z]] : [[m0.x, m0.z]];
        const firstScore = (c) => (c.room === main ? 0.4 : 0) - 0.4 * Math.min(...warm.map(([wx, wz]) => Math.hypot(c.x - wx, c.z - wz))) + 0.1 * doorDist(c.room, c.x, c.z);
        // (for each of the likeliest firsts, two more beside it, one at a time: the first three found together)
        const triple = (first) => {
          const g = [first]; stands.push({ id: 'dogbeds', ...dBox(first.x, first.z), h: 0.3 });
          for (let i = 1; i < 3; i++) {
            const last = g[g.length - 1], near = dWall.filter((c) => { const d = Math.hypot(c.x - last.x, c.z - last.z); return d < 1.6 && d > 1.04; });
            const q = pick(near, (c) => -Math.abs(Math.hypot(c.x - last.x, c.z - last.z) - 1.1) * 2 + (c.room === last.room ? 1 : 0), { gap: 0.15, levels: [LEVELS[0], LEVELS[1]] });
            if (!q) break; g.push(q); stands.push({ id: 'dogbeds', ...dBox(q.x, q.z), h: 0.3 });
          }
          stands.splice(stands.length - g.length, g.length);
          return g;
        };
        let spots = null;
        const firsts = dWall.filter((c, i) => i % 2 === 0 && pick([c], () => 0, { gap: 0.15, levels: [LEVELS[0], LEVELS[1]] })).sort((a, b) => firstScore(b) - firstScore(a)).slice(0, 90);
        for (const c of firsts) { const t = triple(c); if (t.length === 3) { spots = t; picked.dogbeds = 0; break; } }
        let part = [];   // (the most found apart, if three never are)
        if (!spots) {   // (no three together: one at a time, wherever they fit, by a wall or not)
          spots = []; let worst = 0;
          for (let i = 0; i < 3; i++) { const last = spots[spots.length - 1];
            const q = pick(dAny, (c) => (wallGap(c.room, c.boxes[0]) < 0.3 ? 0.5 : 0) + (c.room === main ? 0.4 : 0) + (last ? -Math.hypot(c.x - last.x, c.z - last.z) * 0.3 : firstScore(c)), { gap: 0.15, id: 'dogbed', levels: LEVELS.slice(0, 3) });
            worst = Math.max(worst, picked.dogbed == null ? 3 : picked.dogbed);
            if (!q) break; spots.push(q); stands.push({ id: 'dogbeds', ...dBox(q.x, q.z), h: 0.3 }); }
          stands.splice(stands.length - spots.length, spots.length);
          delete picked.dogbed; picked.dogbeds = spots.length === 3 ? worst : null;
          if (spots.length < 3) part = spots;
        }
        if (spots.length < 3) {   // (no room for three apart: three beds pushed together, overlapping a little, as dogs pile up)
          spots = []; let worst = 0;
          for (let i = 0; i < 3; i++) { const last = spots[spots.length - 1];
            const q = pick(dAny, (c) => (last ? -Math.abs(Math.hypot(c.x - last.x, c.z - last.z) - 0.66) * 2 : (wallGap(c.room, c.boxes[0]) < 0.25 ? 0.5 : 0) + firstScore(c)), { gap: 0.02, id: 'dogbed', levels: LEVELS.slice(0, 3) });   // (never in the walking line: fewer beds rather)
            worst = Math.max(worst, picked.dogbed == null ? 3 : picked.dogbed);
            if (!q) break; spots.push(q); stands.push({ id: 'dogbeds', ...dBox(q.x, q.z), hw: 0.22, hd: 0.22, h: 0.3 }); }
          stands.splice(stands.length - spots.length, spots.length);
          delete picked.dogbed; picked.dogbeds = spots.length === 3 ? Math.max(1, worst) : null;
        }
        // (a cabin with no room for three: as many beds as fit, the dogs sharing them: interior.js bedSpots)
        if (spots.length < 3) { spots = part.length >= spots.length ? part : spots; picked.dogbeds = spots.length ? 3 + (3 - spots.length) : null; }
        if (!spots.length) {   // (no clear spot for even one: the best there is, the walking line let go)
          const q = pick(dAny, (c) => (wallGap(c.room, c.boxes[0]) < 0.3 ? 0.5 : 0) + firstScore(c), { gap: 0.15, id: 'dogbed' });
          delete picked.dogbed; picked.dogbeds = q ? 3 : null;
          spots.push(q || { x: main.x0 + 0.5, z: main.z0 + 0.5, room: main });
        }
        // (each bed turned so the dog on it lies along the nearest wall, its back to it: interior.js and cabin.js lay the dog
        // a quarter turn from the bed's rot)
        got.spots = spots.map((q, i) => {
          const r = q.room || roomAt(q.x, q.z) || main, d = [[q.x - r.x0, 'x0'], [r.x1 - q.x, 'x1'], [q.z - r.z0, 'z0'], [r.z1 - q.z, 'z1']].sort((a, b) => a[0] - b[0])[0][1];
          const heading = d === 'z0' || d === 'z1' ? (i % 2 ? -Math.PI / 2 : Math.PI / 2) : (i % 2 ? Math.PI : 0);
          return { x: f2(q.x), z: f2(q.z), rot: f2(heading - Math.PI / 2 + [0.12, -0.08, 0.05][i]) };
        });
        for (const q of got.spots) stands.push({ id: 'dogbeds', ...dBox(q.x, q.z), h: 0.3 });
      }
    }
    // the safe door leaning on a wall with room round it (where it shows: not squeezed in beside the stove); the strongbox
    // on the floor against a wall (the wall behind each clear to its height: no doorway, no fireplace)
    for (const q of stands) shadeWalls(q);
    const fires = [...(A.hearths || []).map((h) => [h.centre[0], h.centre[2]]), [got.st.x, got.st.z]];
    const fireD = (b) => Math.min(...fires.map(([x, z]) => Math.hypot(b.x - x, b.z - z)));
    const gapTo = (b) => Math.min(9, ...stands.map((q) => Math.hypot(b.x - q.x, b.z - q.z) - Math.max(q.hw, q.hd)));
    for (const [id, size, score] of [['boxes', FLOOR_BOX.boxes, (w, u, b) => Math.min(1, gapTo(b)) + 0.2 * Math.min(1.5, fireD(b)) + (w.room === main ? 0.15 : 0)], ['loot', FLOOR_BOX.loot, (w, u, b) => Math.min(1.5, gapTo(b)) + (w.side === 'back' ? 0.3 : 0) + (w.room === bed ? 0.2 : 0)]]) {
      const cands = [];
      for (const w of walls) for (let u = w.a0 + size[0] / 2 + 0.08; u <= w.a1 - size[0] / 2 - 0.08 + 1e-6; u += 0.05) {
        const b = againstWall(w, u, size);
        if (w.busy.every((q) => q.u1 <= u - size[0] / 2 || q.u0 >= u + size[0] / 2 || q.v1 <= y || q.v0 >= y + size[2])) cands.push({ room: w.room, w, u, b, boxes: [b] });
      }
      // (a hand's breadth or more from what stands beside it, closer only where there's no room; the strongbox on the
      // table rather than in the walking line)
      const lv = id === 'loot' ? LEVELS.slice(0, 3) : LEVELS, s = pick(cands, (c) => score(c.w, c.u, c.b), { gap: 0.25, id, levels: lv }) || pick(cands, (c) => score(c.w, c.u, c.b), { gap: FLOOR.gap, id, levels: lv });
      if (s) { got[id] = { at: [f2(s.b.x), null, f2(s.b.z)], rot: Math.round(Math.atan2(-s.w.dir[0], -s.w.dir[2]) * D) }; const q = { id: id === 'boxes' ? 'safe' : id, ...s.b, h: size[2] }; stands.push(q); shadeWalls(q); }
      else got[id] = { at: [f2(main.x0 + 0.4), null, f2(main.z0 + 0.4)], rot: 0 };
    }
    // (how much was let go: a piece standing in the walking line (level 3) is nearly as bad as one with nowhere to go,
    // worse than the dogs sharing a bed)
    // (each piece's share: the table (the lock boxes are opened at it) most, then the bed; and the table out of the main
    // room counts against a try)
    const W8 = { table: 1.5, bed: 1.2, stove: 1, dogbeds: 0.8, boxes: 0.5, loot: 0.5 };
    got.cost = Object.entries(picked).reduce((a, [k, v]) => a + (W8[k] || 1) * (v == null ? (k === 'boxes' || k === 'loot' ? 4 : 10) : v === 3 ? 8 : v), 0)
      + (got.T && !inRoom(main, got.T.x, got.T.z) ? 2 : 0);
    return got;
  };
  const ORDERS = [['bed', 'stove', 'table', 'dogs'], ['bed', 'stove', 'dogs', 'table'], ['bed', 'table', 'stove', 'dogs'], ['bed', 'dogs', 'stove', 'table'], ['stove', 'table', 'bed', 'dogs'], ['table', 'bed', 'stove', 'dogs'], ['stove', 'bed', 'table', 'dogs']];
  let F = null, bestK = 0, lastK = 0;
  const tries = [];
  for (let k = 0; k < ORDERS.length; k++) { const g = furnish(ORDERS[k]); lastK = k; tries.push({ ...picked }); if (!F || g.cost < F.cost) { F = g; bestK = k; } if (F.cost === 0) break; }
  if (lastK !== bestK) F = furnish(ORDERS[bestK]);   // (the walls and the lists as the best try left them)
  const { bA, st, T } = F, headDir = HEAD[bA.rot];
  const slots = {};
  slots.bed = { at: [f2(bA.x), null, f2(bA.z)], rot: bA.rot, box: [1.06, 1.9], looks: [[bA.x, y + 0.5, bA.z]] };
  slots.stove = st.builtIn ? { at: [f2(st.x), null, f2(st.z)], rot: Math.round(st.a * D), box: null, builtIn: true, looks: [[st.x, y + 0.55, st.z]] }
    : { at: [f2(st.x), null, f2(st.z)], rot: Math.round(st.a * D), box: [0.85, 0.85], looks: [[st.x, y + 0.8, st.z]] };
  // (the table's model is long along its own x: rot 0 lays it along x)
  slots.table = { at: [f2(T.x), null, f2(T.z)], rot: T.along === 'x' ? 0 : 90, box: [1.2, 0.8], looks: [[T.x, y + 0.85, T.z]],
    extra: T.chairs.map(([cx, cz, r]) => ({ file: 'chair', at: [f2(cx), null, f2(cz)], rot: r, fitH: 0.96, box: [0.5, 0.5] })) };
  // the rug: under the table
  // (out from under the table toward the room's middle (its chairs' side): the chairs stand on it, not half off it, and
  // a table against a wall doesn't put the rug under the wall; inside the room, never on the hearth's stones or under the
  // stove: moved along the table, or a smaller rug, where it must)
  { const r = roomAt(T.x, T.z) || main, ax = T.along === 'x', RUG = [2.1, 1.4];
    const bad = (b) => !boxIn(b, r) || zones.some((q) => (q.hearth || /chimney|stove/.test(q.what)) && boxesMeet(b, q)) || stands.some((q) => q.id === 'stove' && boxesMeet(b, q));
    // (how far out it wants to be: 30 cm when the table's back is near a wall or its chairs are on one side, else none;
    // the nearest to that, along the table as little as may be, the whole rug before a smaller one)
    const back = ax ? (T.toMid > 0 ? T.z - 0.4 - r.z0 : r.z1 - T.z - 0.4) : (T.toMid > 0 ? T.x - 0.4 - r.x0 : r.x1 - T.x - 0.4);
    const want = !T.ends || back < 0.35 ? 0.3 : 0;
    let got = null;
    for (const sc of [1, 0.9, 0.8, 0.7]) for (let k = 0; k <= 0.5 + 1e-6; k += 0.05) for (const l of [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3]) {
      const rx = T.x + (ax ? l : T.toMid * k), rz = T.z + (ax ? T.toMid * k : l), b = { x: rx, z: rz, hw: (ax ? RUG[0] : RUG[1]) * sc / 2, hd: (ax ? RUG[1] : RUG[0]) * sc / 2, rot: 0 };
      if (bad(b)) continue;
      const cost = Math.abs(k - want) * 2 + Math.abs(l) * 1.5 + (1 - sc) * 2.5;
      if (!got || cost < got.cost) got = { rx, rz, sc, cost };
    }
    if (!got) got = { rx: T.x, rz: T.z, sc: 0.6 };
    slots.rug = { at: [f2(got.rx), null, f2(got.rz)], rot: ax ? 0 : 90, ...(got.sc < 1 ? { size: RUG.map((q) => f2(q * got.sc)) } : {}), looks: [[got.rx, y + 0.02, got.rz]] }; }
  slots.dogbeds = { at: [F.spots[0].x, null, F.spots[0].z], rot: 0, looks: F.spots.map((q) => [q.x, y + 0.08, q.z]), spots: F.spots };

  // ── THE HEARTHS: each fireplace's opening, the fire's middle, where to stand to light it (in its room, a stride out) ──
  const hearths = (A.hearths || []).map((h, i) => {
    const n = h.into, stand = [h.centre[0] + n[0] * (h.slab[1] + 0.55), h.centre[2] + n[2] * (h.slab[1] + 0.55)];
    // (looked at to light it: the opening, or the mantel over it, as a rider standing before it looks)
    const looks = [[h.centre[0] - n[0] * 0.05, y + 0.55, h.centre[2] - n[2] * 0.05], [h.centre[0], (h.mantel ? h.mantel[1] : h.y1) - 0.1, h.centre[2]], [h.centre[0], (h.mantel ? h.mantel[1] : h.y1) + 0.3, h.centre[2]]];   // (and the wall over it: looked at straight ahead)
    return { i, centre: h.centre, w: h.w, y1: h.y1, into: n, fire: h.fire || [h.centre[0] - n[0] * 0.28, y + 0.16, h.centre[2] - n[2] * 0.28], stand, look: looks[0], looks, room: (roomAt(stand[0], stand[1], 0.3) || {}).name || null, mantel: h.mantel };
  });

  // ── THE LANTERNS: one over the table, one over the bed (hung 0.36 m under the ceiling on their cords: their bottoms
  // over 1.8 m up, clear of the eyes of the player walking about in first person) ──
  { const ly = (r) => (r.ceil || y + 2.6) - 0.36;
    // (the bedroom's toward the bed's foot: clear of what hangs over its head)
    slots.lanterns = { at: [0, 0, 0], rot: 0, looks: [[T.x, ly(main), T.z], [f2(bA.x - headDir[0] * 0.4), ly(bed), f2(bA.z - headDir[2] * 0.4)]] }; }

  // ── THE PORCH ROCKERS: on the porch either side of the way in, facing out, clear of the doorway's floor (the best spot
  // each side; both on one side if the other has none); with no porch, on the ground before the door ──
  { const P = A.porch, out = [front.ox, front.oz], sideV = [out[1], -out[0]], rot = Math.round(Math.atan2(out[0], out[1]) * D);
    const outZones = zones.filter((q) => q.outside), rBox = (x, z) => ({ x, z, hw: 0.3, hd: 0.32, rot: 0 });
    let pts = null;
    if (P && out[2] > 0.5) {
      const cands = [];
      for (const x of stepsAlong(P.x0 + 0.32, P.x1 - 0.32, 0.05)) for (const z of stepsAlong(P.z0 + 0.4, P.z1 - 0.34, 0.05)) if (outZones.every((q) => !boxesMeet(rBox(x, z), q))) cands.push({ x, z, side: Math.sign(x - front.x) });
      const sc = (c) => -Math.abs(Math.abs(c.x - front.x) - 1.3) - (c.z - P.z0) * 0.5;
      const L = cands.filter((c) => c.side < 0).sort((a, b) => sc(b) - sc(a))[0], R = cands.filter((c) => c.side > 0).sort((a, b) => sc(b) - sc(a))[0];
      if (L && R) pts = [[L.x, L.z], [R.x, R.z]];
      else { const one = cands.filter((c) => c.side === (L ? -1 : 1)).sort((a, b) => sc(b) - sc(a)), a = one[0], b = a && one.find((c) => Math.abs(c.x - a.x) > 0.72 || Math.abs(c.z - a.z) > 0.72); if (a && b) pts = [[a.x, a.z], [b.x, b.z]]; }
    }
    if (!pts) pts = [-1, 1].map((k) => [front.x + out[0] * 1.6 + sideV[0] * 1.45 * k, front.z + out[1] * 1.6 + sideV[1] * 1.45 * k]);
    slots.porch = { at: [f2(pts[0][0]), null, f2(pts[0][1])], rot: rot + 8, looks: pts.map(([x, z]) => [x, (P ? P.y : 0) + 0.5, z]), extra: [{ file: 'porch_chair', at: [f2(pts[1][0]), null, f2(pts[1][1])], rot: rot - 8, fit: 0.83, box: null }] }; }

  // ── THE KEEPSAKES THAT STAND: the counter bell on the table; the safe door and the strongbox (furnish, above) ──
  const keepsakes = {};
  keepsakes.orders = { at: [f2(T.x + (T.along === 'x' ? 0.25 : 0.1)), null, f2(T.z + (T.along === 'x' ? -0.1 : 0.25))], table: 0.8, rot: -60 };
  keepsakes.boxes = F.boxes; keepsakes.loot = F.loot;
  // (no floor left for the strongbox: it stands open on the table, at the other end from the bell)
  if (picked.loot == null) keepsakes.loot = { at: [f2(T.x - (T.along === 'x' ? 0.3 : 0)), null, f2(T.z - (T.along === 'x' ? 0 : 0.3))], table: 0.8, rot: T.along === 'x' ? 0 : 90 };

  // ── WHAT HANGS ──
  // a spot on a wall for a thing of outline rc ([x0, x1, y0, y1] round its middle) at height v (its middle): free of
  // everything on the wall (busy, and what is hung already, with the gaps), within the wall's stretch and under its top
  const hung = [];   // { id, w, u, v, rc }
  let gapNow = WALLS.gap;   // (the gap side by side: closer in a cabin with little wall)
  // (end: how far from the wall's ends; skip: what's in the wall it may stand on (a mantel shelf))
  const fits = (w, u, v, rc, { end = WALLS.end, skip = null } = {}) => {
    const u0 = u + rc[0], u1 = u + rc[1], v0 = v + rc[2], v1 = v + rc[3];
    if (u0 < w.a0 + end - 1e-6 || u1 > w.a1 - end + 1e-6 || v0 < y + WALLS.floor || v1 > w.top) return false;
    return w.busy.every((b) => (skip && skip(b)) || b.u1 <= u0 || b.u0 >= u1 || b.v1 <= v0 || b.v0 >= v1)
      && hung.every((h) => h.w !== w || h.u + h.rc[1] + gapNow <= u0 || h.u + h.rc[0] - gapNow >= u1 || h.v + h.rc[3] + WALLS.above <= v0 || h.v + h.rc[2] - WALLS.above >= v1);
  };
  // how much room it has either side at its own height (to the nearest thing, or the wall's end): the smaller side
  const roomBeside = (w, u, v, rc) => {
    const v0 = v + rc[2] - WALLS.above, v1 = v + rc[3] + WALLS.above;
    let lo = u + rc[0] - (w.a0 + WALLS.end), hi = (w.a1 - WALLS.end) - (u + rc[1]);
    for (const b of w.busy) if (!(b.v1 <= v0 || b.v0 >= v1)) { if (b.u1 <= u + rc[0]) lo = Math.min(lo, u + rc[0] - b.u1); if (b.u0 >= u + rc[1]) hi = Math.min(hi, b.u0 - (u + rc[1])); }
    for (const h of hung) if (h.w === w && !(h.v + h.rc[3] <= v0 || h.v + h.rc[2] >= v1)) { const e0 = h.u + h.rc[0], e1 = h.u + h.rc[1]; if (e1 <= u + rc[0]) lo = Math.min(lo, u + rc[0] - e1); if (e0 >= u + rc[1]) hi = Math.min(hi, e0 - (u + rc[1])); }
    return Math.min(lo, hi);
  };
  // the middle of what you see at height Y over the floor -> the thing's middle
  const vFor = (rc, Y) => y + Y - (rc[2] + rc[3]) / 2;
  const seen = (w) => (w.room === main ? 0.25 : 0) + ((w.dir[0] * front.ox + w.dir[2] * front.oz) < -0.5 ? 0.15 : 0);   // (the main room's, and the wall facing you as you come in)
  const best = (list) => list.reduce((a, b) => (!a || b.s > a.s ? b : a), null);
  const tryAt = (id, w, u, v, rc, bonus = 0, o = {}) => (fits(w, u, v, rc, o) ? { id, w, u, v, rc, s: Math.min(1.2, roomBeside(w, u, v, rc)) + bonus } : null);
  const hang = (c) => { if (!c) return null; hung.push({ id: c.id, w: c.w, u: c.u, v: c.v, rc: c.rc }); return c; };
  const SMALLER = [0.85, 0.75];
  const spread = (id, rc, Y, { rooms: rs = null, heights = [0, 0.15, -0.15, 0.3, -0.3, 0.45], bonus = () => 0 } = {}) => {
    for (const dy of heights) {
      const v = vFor(rc, Y + dy), cands = [];
      for (const w of walls) { if (rs && !rs.includes(w.room)) continue; for (let u = w.a0; u <= w.a1; u += 0.05) { const c = tryAt(id, w, u, v, rc, bonus(w, u) + seen(w) * 0.5 - Math.abs(dy) * 0.4); if (c) cands.push(c); } }
      const b = best(cands); if (b) return b;
    }
    return null;
  };
  // the painting: over the bed's head, its middle at the eyes (over the headboard)
  const pictureSpot = () => {
    const rc = KEEP_RECT.picture, w = walls.find((q) => q.room === bed && q.dir[0] === headDir[0] && q.dir[2] === headDir[2]), u0 = w && w.axis === 'x' ? bA.x : bA.z;
    let c = null;
    if (w) for (const du of [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3]) for (const dy of [0, 0.1, 0.2]) { c = c || tryAt('picture', w, u0 + du, vFor(rc, HANG.picture.y + dy), rc); }
    return c || spread('picture', rc, HANG.picture.y, { rooms: [bed] }) || spread('picture', rc, HANG.picture.y);
  };
  // (centred over each mantel or window it fits over: bonus by kind)
  const overOpenings = (id, rc, kinds) => {
    const over = [];
    for (const w of walls) for (const b of w.busy) {
      if (!(b.kind in kinds)) continue;
      // (centred over it; a doorway near a corner keeps its sign over it all the same, closer to the wall's end)
      const q = tryAt(id, w, (b.u0 + b.u1) / 2, b.v1 + 0.04 - rc[2], rc, kinds[b.kind] + seen(w) + (b.door ? ((id === 'deliveries') === !!b.door.inner ? 0.4 : 0) : 0), b.kind === 'door' ? { end: 0.06 } : {}); if (q) over.push(q);   // (the agent's sign over the doorway between the rooms first)
    }
    return best(over.filter((q) => q.s > 0.6)) || best(over);
  };
  const hangOne = (id) => {
    const rc = KEEP_RECT[id], H = HANG[id];
    let c = null;
    // the horns: centred over a mantel, else over a window, where they fit under the ceiling
    if (H.over) c = overOpenings(id, rc, { mantel: 0.6, window: 0.3 });
    // the freight sign: over a doorway (the front's first), just over the casing
    else if (H.door === 'over') c = overOpenings(id, rc, { door: 0.01 });
    else if (H.door === 'beside') {
      // the sheep bell: on a nail beside a doorway (the front's first), at the eyes
      const by = [];
      for (const w of walls) for (const b of w.busy) {
        if (b.kind !== 'door') continue;
        const pref = b.door && b.door.name === 'front' ? 1 : b.door && !b.door.inner ? 0.5 : 0;
        for (const u of [b.u0 - 0.3 - rc[1], b.u1 + 0.3 - rc[0]]) { const q = tryAt(id, w, u, vFor(rc, H.y), rc); if (q) { q.s = Math.min(q.s, 0.3) + pref; by.push(q); } }   // (a hand's breadths off the door's casing)
      }
      c = best(by);
    }
    // (a little standing keepsake: on a mantel's shelf, at an end of it, where it's low enough to stand under what hangs over)
    if (!c && SHELF.includes(id)) {
      const on = [];
      for (const w of walls) for (const b of w.busy) {
        if (b.kind !== 'mantel') continue;
        const top = b.hearth.mantel[1], mid = (b.u0 + b.u1) / 2, half = b.hearth.mantel[0] / 2;
        for (const s0 of [-1, 1]) { const q = tryAt(id, w, mid + s0 * (half - 0.08 - rc[1]), top + 0.012 - rc[2], rc, 0.5 + seen(w), { skip: (x) => x.hearth === b.hearth }); if (q) on.push(q); }
      }
      c = best(on);
      // (else beside the horns hung over the mantel, level with them: one each side)
      const horns = hung.find((h) => h.id === 'cattle' && h.w.busy.some((b) => b.kind === 'mantel' && Math.abs((b.u0 + b.u1) / 2 - h.u) < 0.05));
      if (!c && horns) {
        const by = [];
        for (const s0 of [-1, 1]) { const u = horns.u + s0 * (horns.rc[1] + gapNow + 0.02 + rc[1]), q = tryAt(id, horns.w, u, horns.v + (horns.rc[2] + horns.rc[3]) / 2 - (rc[2] + rc[3]) / 2, rc, 0.4); if (q) by.push(q); }
        c = best(by);
      }
    }
    if (!c) c = spread(id, rc, H.y, { rooms: H.room === 'main' ? [main] : null }) || spread(id, rc, H.y);
    // (no stretch left at its height: over a window or a doorway, where it fits under the ceiling: a little shelf over a
    // window, the posters over a door)
    if (!c) c = overOpenings(id, rc, { window: 0.1, door: 0, mantel: 0 });
    // (the rifle rack wants a long stretch: over the mantel if there's none)
    if (!c && id === 'rifles') c = overOpenings(id, rc, { mantel: 0.1 });
    // (and with no room for it anywhere, a smaller rack, for carbines)
    // (and with no room for it anywhere, a smaller one: a rack for carbines, smaller posters...)
    for (const k of SMALLER) { if (c) break; const sm = rc.map((q) => q * k); c = spread(id, sm, H.y) || overOpenings(id, sm, { window: 0.1, door: 0, mantel: 0.1 }); if (c) c.scale = k; }
    return c;
  };
  // everything in an order; when one finds no spot, it goes first and they are all hung again (the best try kept)
  const hangAll = (order) => { hung.length = 0; const P = {}; for (const id of order) P[id] = hang(id === 'picture' ? pictureSpot() : hangOne(id)); return P; };
  const misses = (P) => Object.values(P).filter((c) => !c).length;
  let order = ['picture', ...WALL_ORDER], place = null, best0 = null;
  for (const g of [WALLS.gap, 0.22, 0.15]) {
    gapNow = g; order = ['picture', ...WALL_ORDER];
    let P = hangAll(order), bestO = order, last = P;
    for (let k = 0; k < 6 && misses(P); k++) {
      // (what the last try left out goes first in the next)
      const miss = order.filter((id) => !last[id]); order = [...miss, ...order.filter((id) => !miss.includes(id))];
      last = hangAll(order); if (misses(last) < misses(P)) { P = last; bestO = order; }
    }
    if (!best0 || misses(P) < best0.n) best0 = { n: misses(P), g, order: bestO };
    if (!misses(P)) break;
  }
  gapNow = best0.g; place = hangAll(best0.order);
  // (a thing hung partly over a piece of furniture against its wall (the bed's head, the table) centred over it, where it
  // fits there)
  for (const [id, c] of Object.entries(place)) {
    if (!c || (HANG[id] && (HANG[id].over || HANG[id].door))) continue;
    const w = c.w, u0 = c.u + c.rc[0], u1 = c.u + c.rc[1];
    const b = w.busy.find((q) => q.kind === 'furniture' && /^the (bed|table)$/.test(q.what) && q.u1 > u0 + 0.05 && q.u0 < u1 - 0.05 && q.u1 - q.u0 > (u1 - u0) * 0.8 && q.v1 <= c.v + c.rc[2]);
    if (!b) continue;
    const m = (b.u0 + b.u1) / 2, i = hung.findIndex((h) => h.id === id), h = hung.splice(i, 1)[0];
    if (Math.abs(m - c.u) > 0.03 && fits(w, m, c.v, c.rc)) { c.u = m; h.u = m; }
    hung.push(h);
  }
  const hangMissed = Object.keys(place).filter((id) => !place[id]);
  // the spots: on the wall's face (stand() in interior.js hangs it just off it, facing into the room)
  // (off: how far it hangs off the wall's face: clear of the battens on a board wall)
  const spotOf = (c) => { const w = c.w, at = w.axis === 'x' ? [f2(c.u), f2(c.v), f2(w.at)] : [f2(w.at), f2(c.v), f2(c.u)]; return { at, wall: w.dir.slice(), ...(c.scale ? { scale: c.scale } : {}), ...(w.room.wall === 'boards' ? { off: 0.07 } : {}) }; };
  const fallback = (r) => ({ at: [f2((r.x0 + r.x1) / 2), f2(y + 1.6), f2(r.z0)], wall: [0, 0, -1] });
  { const s = place.picture ? spotOf(place.picture) : fallback(bed);
    slots.picture = { at: s.at, wall: s.wall, rot: 0, looks: [[s.at[0] - s.wall[0] * 0.15, s.at[1], s.at[2] - s.wall[2] * 0.15]], ...(s.scale ? { scale: s.scale } : {}), ...(s.off ? { off: s.off } : {}) }; }
  { const s = place.rifles ? spotOf(place.rifles) : fallback(main);
    slots.rifles = { at: s.at, wall: s.wall, rot: 0, looks: [[s.at[0] - s.wall[0] * 0.15, s.at[1], s.at[2] - s.wall[2] * 0.15]], ...(s.scale ? { scale: s.scale } : {}), ...(s.off ? { off: s.off } : {}) }; }
  for (const j of WALL_JOBS) keepsakes[j] = place[j] ? spotOf(place[j]) : fallback(main);

  // ── THE GAME MAKER'S OWN SPOTS (the Building Lab's Place things): they win ──
  if (saved && typeof saved === 'object') applySaved(saved, { slots, keepsakes, y, tableAt });

  // OUTSIDE: the dogs on the porch, the SOLD sign by the steps, where the dog that follows waits, the steps' foot
  const P = A.porch, out = [front.ox, front.oz], sideV = [out[1], -out[0]];
  const deck = P ? Math.max(Math.abs(P.z1 - front.z), Math.abs(P.x1 - front.x) * Math.abs(out[0])) : 0.6;
  const steps = { x: front.x + out[0] * (deck + 0.7), z: front.z + out[1] * (deck + 0.7) };
  const porchDogs = P ? [[front.x + sideV[0] * 0.9 + out[0] * 0.8, front.z + sideV[1] * 0.9 + out[1] * 0.8, 0.3], [front.x - sideV[0] * 0.9 + out[0] * 1.0, front.z - sideV[1] * 0.9 + out[1] * 1.0, -0.4], [front.x + sideV[0] * 1.6 + out[0] * 1.2, front.z + sideV[1] * 1.6 + out[1] * 1.2, 0.1]]
    : [-1, 0, 1].map((k) => [steps.x + sideV[0] * k * 1.1, steps.z + sideV[1] * k * 1.1, k * 0.3]);
  const sign = { x: steps.x + sideV[0] * 2.3, z: steps.z + sideV[1] * 2.3, rot: Math.atan2(out[0], out[1]) - 0.35 };
  const wait = { x: steps.x + sideV[0] * 1.7 + out[0] * 0.8, z: steps.z + sideV[1] * 1.7 + out[1] * 0.8 };
  // (crowded: the pieces a cabin too small for everything had to stand in the walking line, or found no clear spot at all)
  const crowded = Object.entries(picked).filter(([k, v]) => (v == null && k !== 'loot') || v === 3).map(([k]) => k);   // (the strongbox with no floor stands on the table: not crowded)
  const Lay = { picked, crowded, tries, hangMissed, order: ORDERS[bestK], main, bed, rooms, open: breeze, slots, keepsakes, bedSpots: slots.dogbeds.spots, porchDogs, sign, wait, front, steps, hearths, walls, zones, ways, things: THINGS };
  Lay.checks = checkLayout(A, Lay);
  return Lay;
}

// the table at (x, z), its long side along x or z, and its two chairs: on one long side, toward the room's middle m0
// (toMid: +1 or -1 to say which), or one at each end
// (tuck: the chairs pushed in under the table's edge, in a cabin with little floor)
export function tableChairs(x, z, along, m0, toMid = along === 'x' ? (z > m0.z ? -1 : 1) : (x > m0.x ? -1 : 1), ends = false, tuck = false) {
  const a = tuck ? 0.48 : 0.68, b = tuck ? 0.46 : 0.66;
  const chairs = ends ? (along === 'x' ? [[x - 0.82, z, 90], [x + 0.82, z, 270]] : [[x, z - 0.82, 0], [x, z + 0.82, 180]])
    : along === 'x' ? [[x - 0.32, z + toMid * a, toMid > 0 ? 180 : 0], [x + 0.34, z + toMid * b, toMid > 0 ? 195 : 15]]
    : [[x + toMid * a, z - 0.32, toMid > 0 ? 270 : 90], [x + toMid * b, z + 0.34, toMid > 0 ? 285 : 105]];
  return { x, z, along, toMid, ends, tuck, chairs };
}

// a worked-out layout with saved spots put in (the lab's Place things, as a thing is dragged): -> a new layout, its
// checks done again
export function withSpots(A, Lay, saved) {
  const slots = JSON.parse(JSON.stringify(Lay.slots)), keepsakes = JSON.parse(JSON.stringify(Lay.keepsakes)), m0 = mid(Lay.main);
  if (saved) applySaved(saved, { slots, keepsakes, y: A.floor || 0.6, tableAt: (x, z, along) => tableChairs(x, z, along, m0) });
  const L2 = { ...Lay, slots, keepsakes, bedSpots: slots.dogbeds.spots };
  L2.checks = checkLayout(A, L2);
  return L2;
}

// THE THINGS the lab's Place things can move: { id, kind: 'wall' | 'floor', of: 'keepsake' | 'slot', name }
export const THINGS = [
  ...['cattle', 'bandits', 'fish', 'deliveries', 'sheep', 'pigs', 'targets', 'loads', 'tower'].map((id) => ({ id, kind: 'wall', of: 'keepsake' })),
  { id: 'picture', kind: 'wall', of: 'slot' }, { id: 'rifles', kind: 'wall', of: 'slot' },
  { id: 'boxes', kind: 'floor', of: 'keepsake', against: true }, { id: 'loot', kind: 'floor', of: 'keepsake', against: true },
  { id: 'table', kind: 'floor', of: 'slot' }, { id: 'stove', kind: 'floor', of: 'slot' }, { id: 'bed', kind: 'floor', of: 'slot' }, { id: 'dogbeds', kind: 'floor', of: 'slot' }, { id: 'rug', kind: 'floor', of: 'slot', flat: true },
];

// the saved spots put in: a wall thing { at, wall }; a floor keepsake { at, rot }; the table { at, rot } (its chairs, the
// rug under it and the bell on it go with it, unless the rug has its own); the stove, the bed { at, rot }; the dog beds
// { spots: [{ x, z, rot }] }
const okNum = (v) => typeof v === 'number' && Number.isFinite(v);
const okAt = (a) => Array.isArray(a) && a.length === 3 && okNum(a[0]) && okNum(a[2]) && (a[1] === null || okNum(a[1]));
const okWall = (w) => Array.isArray(w) && w.length === 3 && w.every(okNum) && Math.abs(Math.hypot(...w) - 1) < 0.01;
function applySaved(S, { slots, keepsakes, y, tableAt }) {
  for (const [id, s] of Object.entries(S)) {
    if (!s || typeof s !== 'object') continue;
    const wallish = THINGS.find((t) => t.id === id && t.kind === 'wall');
    if (wallish && okAt(s.at) && okNum(s.at[1]) && okWall(s.wall)) {
      const sc = okNum(s.scale) && s.scale >= 0.5 && s.scale < 1 ? { scale: s.scale } : {};   // (a smaller one: layout.js SMALLER)
      const off = ((wallish.of === 'keepsake' ? keepsakes[id] : slots[id]) || {}).off, of = off ? { off } : {};   // (the cabin's walls' own: boards or logs)
      if (wallish.of === 'keepsake') keepsakes[id] = { at: s.at.slice(), wall: s.wall.slice(), ...sc, ...of };
      else { const { scale, ...was } = slots[id]; void scale; slots[id] = { ...was, at: s.at.slice(), wall: s.wall.slice(), ...sc, ...of, looks: [[s.at[0] - s.wall[0] * 0.15, s.at[1], s.at[2] - s.wall[2] * 0.15]] }; }
      continue;
    }
    if ((id === 'boxes' || id === 'loot') && okAt(s.at)) { keepsakes[id] = { at: [s.at[0], null, s.at[2]], rot: okNum(s.rot) ? s.rot : 0 }; continue; }
    if (id === 'table' && okAt(s.at)) {
      const along = Math.abs(Math.sin((s.rot || 0) / D)) < 0.5 ? 'x' : 'z', Tt = tableAt(s.at[0], s.at[2], along);
      slots.table = { ...slots.table, at: [s.at[0], null, s.at[2]], rot: along === 'x' ? 0 : 90, looks: [[Tt.x, y + 0.85, Tt.z]], extra: Tt.chairs.map(([cx, cz, r]) => ({ file: 'chair', at: [f2(cx), null, f2(cz)], rot: r, fitH: 0.96, box: [0.5, 0.5] })) };
      if (!S.rug) { const k = Tt.toMid * 0.3, rx = along === 'x' ? Tt.x : Tt.x + k, rz = along === 'x' ? Tt.z + k : Tt.z; slots.rug = { ...slots.rug, at: [f2(rx), null, f2(rz)], rot: along === 'x' ? 0 : 90, looks: [[rx, y + 0.02, rz]] }; }
      keepsakes.orders = { at: [f2(Tt.x + (along === 'x' ? 0.25 : 0.1)), null, f2(Tt.z + (along === 'x' ? -0.1 : 0.25))], table: 0.8, rot: -60 };
      const L = slots.lanterns.looks[0]; slots.lanterns = { ...slots.lanterns, looks: [[Tt.x, L[1], Tt.z], slots.lanterns.looks[1]] };
      continue;
    }
    if ((id === 'stove' || id === 'bed' || id === 'rug') && okAt(s.at)) {
      const sl = slots[id]; slots[id] = { ...sl, at: [s.at[0], null, s.at[2]], rot: okNum(s.rot) ? s.rot : sl.rot, looks: sl.looks.map((p) => [s.at[0], p[1], s.at[2]]) };
      if (id === 'bed') { const L = slots.lanterns.looks; slots.lanterns = { ...slots.lanterns, looks: [L[0], [s.at[0], L[1][1], s.at[2]]] }; }
      continue;
    }
    if (id === 'dogbeds' && Array.isArray(s.spots) && s.spots.length >= 1 && s.spots.every((q) => q && okNum(q.x) && okNum(q.z))) {
      const spots = s.spots.slice(0, 3).map((q) => ({ x: q.x, z: q.z, rot: okNum(q.rot) ? q.rot : 0 }));
      slots.dogbeds = { ...slots.dogbeds, at: [spots[0].x, null, spots[0].z], looks: spots.map((q) => [q.x, y + 0.08, q.z]), spots };
    }
  }
}

// THE CHECKS: everything as it stands now (worked out or saved) against the cabin: -> [{ id, what }]
export function checkLayout(A, Lay) {
  const y = A.floor || 0.6, out = [], say = (id, what) => out.push({ id, what });
  const { walls } = wallsOf(Lay.rooms, y, A);
  const tol = 0.03;   // (a little looser than the placing's own margins: what it placed always passes)
  // the wall things: each against the wall it's on
  const wallThings = [];
  for (const id of [...WALL_JOBS, 'picture', 'rifles']) {
    const s = WALL_JOBS.includes(id) ? Lay.keepsakes[id] : Lay.slots[id]; if (!s || !s.wall) continue;
    const rc = s.scale ? KEEP_RECT[id].map((q) => q * s.scale) : KEEP_RECT[id];
    const w = walls.find((q) => q.dir[0] === s.wall[0] && q.dir[2] === s.wall[2] && Math.abs((q.axis === 'x' ? s.at[2] : s.at[0]) - q.at) < 0.05 && (q.axis === 'x' ? s.at[0] : s.at[2]) > q.a0 - 0.05 && (q.axis === 'x' ? s.at[0] : s.at[2]) < q.a1 + 0.05);
    if (!w) { say(id, 'is not on a wall'); continue; }
    const u = w.axis === 'x' ? s.at[0] : s.at[2], v = s.at[1], r = [u + rc[0], u + rc[1], v + rc[2], v + rc[3]];
    wallThings.push({ id, w, r });
    if (r[0] < w.a0 - tol || r[1] > w.a1 + tol) say(id, 'runs past the end of its wall');
    if (r[3] > w.room.ceil - 0.02) say(id, 'goes up into the ceiling');
    if (r[2] < y + 0.05) say(id, 'goes down into the floor');
    for (const b of w.busy) {
      if (b.kind === 'block') continue;
      const M = b.kind === 'window' ? WALLS.window : b.kind === 'door' ? [WALLS.door[0] - 0.08, 0, WALLS.door[1] - 0.06] : [0.05, 0, 0.05];
      // (the opening itself and its casing: the margins less a little)
      const bu0 = b.u0 + (b.kind === 'window' ? M[0] - 0.08 : b.kind === 'door' ? 0.08 : 0), bu1 = b.u1 - (b.kind === 'window' ? M[0] - 0.08 : b.kind === 'door' ? 0.08 : 0);
      const bv0 = b.v0 + (b.kind === 'window' ? M[1] - 0.06 : 0), bv1 = b.kind === 'mantel' ? b.hearth.mantel[1] : b.v1 - (b.kind === 'window' ? M[2] - 0.1 : b.kind === 'door' ? 0.06 : 0.04);   // (on the mantel's shelf is fine)
      if (r[1] > bu0 + tol && r[0] < bu1 - tol && r[3] > bv0 + tol && r[2] < bv1 - tol) say(id, `covers ${b.what === 'window' ? 'a window' : b.what === 'doorway' ? 'a doorway' : 'the ' + b.what}`);
    }
  }
  for (let i = 0; i < wallThings.length; i++) for (let j = i + 1; j < wallThings.length; j++) {
    const a = wallThings[i], b = wallThings[j]; if (a.w !== b.w) continue;
    if (a.r[1] > b.r[0] + 0.05 && a.r[0] < b.r[1] - 0.05 && a.r[3] > b.r[2] + 0.04 && a.r[2] < b.r[3] - 0.04) say(a.id, `overlaps ${b.id} on the wall`);
  }
  // the floor things: in a doorway's way, on the hearth, in each other
  const fl = [];
  const T = Lay.slots.table;
  if (T) {
    const along = Math.abs(Math.sin((T.rot || 0) / D)) < 0.5 ? 'x' : 'z'; fl.push({ id: 'table', x: T.at[0], z: T.at[2], hw: along === 'x' ? 0.6 : 0.4, hd: along === 'x' ? 0.4 : 0.6, rot: 0 });
    for (const [i, c] of (T.extra || []).entries()) fl.push({ id: 'table', part: 'chair ' + (i + 1), x: c.at[0], z: c.at[2], hw: 0.22, hd: 0.22, rot: 0 });
  }
  if (Lay.slots.stove && !Lay.slots.stove.builtIn) fl.push({ id: 'stove', x: Lay.slots.stove.at[0], z: Lay.slots.stove.at[2], hw: 0.4, hd: 0.4, rot: 0 });
  if (Lay.slots.bed) { const b = Lay.slots.bed, side = Math.abs(Math.sin((b.rot || 0) / D)) > 0.5; fl.push({ id: 'bed', x: b.at[0], z: b.at[2], hw: side ? 0.93 : 0.5, hd: side ? 0.5 : 0.93, rot: 0 }); }
  for (const q of (Lay.slots.dogbeds && Lay.slots.dogbeds.spots) || []) fl.push({ id: 'dogbeds', x: q.x, z: q.z, hw: 0.4, hd: 0.4, rot: 0 });
  for (const id of ['boxes', 'loot']) { const s = Lay.keepsakes[id]; if (!s || s.table) continue; const sz = FLOOR_BOX[id], r = (s.rot || 0) / D, side = Math.abs(Math.sin(r)) > 0.5;
    fl.push({ id, x: s.at[0], z: s.at[2], hw: (side ? sz[1] : sz[0]) / 2 - 0.02, hd: (side ? sz[0] : sz[1]) / 2 - 0.02, rot: 0 }); }
  const shrink = (q, k = tol) => ({ ...q, hw: Math.max(0.01, q.hw - k), hd: Math.max(0.01, q.hd - k) });
  // (what hangs low behind what stands against its wall: the headboard, the table, a chair's back; the stove's pipe)
  const tall = { table: 0.8, stove: 9, bed: 0.98, dogbeds: 0.3, boxes: 0.66, loot: 0.42 };
  for (const t of wallThings) for (const q of fl) {
    const cs = corners(q), d = Math.min(...cs.map(([x, z]) => Math.abs((t.w.axis === 'x' ? z : x) - t.w.at))), us = cs.map(([x, z]) => (t.w.axis === 'x' ? x : z));
    if (d > (q.id === 'stove' ? 0.75 : 0.3) || !inRoom(t.w.room, q.x, q.z, 0.05)) continue;
    const h = q.part ? 0.96 : tall[q.id];
    if (t.r[1] > Math.min(...us) + tol && t.r[0] < Math.max(...us) - tol && t.r[2] < y + h - tol) say(t.id, `hangs behind ${q.part ? 'a chair' : q.id === 'boxes' ? 'the safe door' : q.id === 'loot' ? 'the strongbox' : q.id === 'dogbeds' ? 'a dog bed' : q.id === 'stove' ? "the stove's pipe" : 'the ' + q.id}`);
  }
  for (const q of fl) {
    const where = q.part ? `${q.id} (${q.part})` : q.id;
    if (![...Lay.rooms, ...(Lay.open || [])].some((r) => corners(shrink(q)).every(([x, z]) => inRoom(r, x, z, 0.02)))) say(q.id, `${where} is not inside a room`);
    for (const z of Lay.zones || []) if (!z.outside && boxesMeet(shrink(q), z)) say(q.id, `${where} stands ${z.what}`);
    for (const w of Lay.ways || []) if (corners(shrink(q, 0.1)).concat([[q.x, q.z]]).some(([x, zz]) => segD(x, zz, w) < FLOOR.narrow - 0.04)) { say(q.id, `${where} stands in the way between the doors`); break; }
  }
  for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) {
    const a = fl[i], b = fl[j]; if (a.id === b.id) continue;
    if (boxesMeet(shrink(a), shrink(b))) say(a.id, `${a.part ? `${a.id} (${a.part})` : a.id} stands in ${b.part ? `${b.id} (${b.part})` : b.id}`);
  }
  // the rockers outside: off the porch's way in
  const P = Lay.slots.porch;
  if (P) for (const at of [P.at, ...(P.extra || []).map((e) => e.at)]) for (const z of Lay.zones || []) if (z.outside && z.door && z.door.name === 'front' && boxesMeet({ x: at[0], z: at[2], hw: 0.28, hd: 0.3, rot: 0 }, shrink(z))) say('porch', 'a rocker stands in the way in');
  return out;
}
