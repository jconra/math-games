// SHIP BLUEPRINTS: the rooms of a ship drawn on the space its shell actually has, and the checks that keep them
// inside it. Plain data and plain functions (no three.js), so the lab and the rigs run the very same checks.
//
// A BLUEPRINT is a JSON file (space-station/kit/ships/<id>.blueprint.json):
//   { "id", "name", "idea", "ship", "shell": "<a shell in assets/ships>", "grid": { "cell": 0.5, "step": 0.5, "deck": metres },
//     "rooms": [ { "id", "name", "kind", "rect": [x0, z0, x1, z1], "floor": 0, "ceiling": 2.5 } ],
//     "doors": [ { "id", "rooms": ["a", "b" | "outside"], "at": [x, z], "width": 0.8, "leaves"?, "splay"? } ],
//     "items": [ { "id", "kind", "room", "rect": [x0, z0, x1, z1], "h": metres, "y"?, "name"?, "cut"? } ] }
//   Metres, in the ship's frame: x toward the ship's left (port), z toward the nose, the middle line x 0, the shell's
//   middle z 0; heights from the deck (grid.deck metres off the ground: the shell's door sill).
//   rect     a room's floor on the ship grid (its edges on the 0.5 m lines); an item's footprint on the half grid (0.25 m)
//   floor    a room's floor above the deck (the cockpit stands 0.3 m up over the nose leg); ceiling: its height above
//            that floor, or "canopy" where the glass is the room's top (then only the head room where people walk counts)
//   doors    on the wall two rooms share ("at" its middle, on that wall); "outside" for the ship's own door, which must
//            be in one of the shell's door openings (the space file's doors.list, when it has more than one each side:
//            the Medic's ramps and crew doors; else doors.port or doors.starboard). A hatch ("hatch": true) is a door in a
//            room's floor instead: a square
//            "width" on a side, "at" its middle, inside its room; the outer door of a shell whose door is in its belly
//            (the space file's doors.belly: the Miner's lift) is one, inside the belly's opening
//            "width" is the clear opening. Every inside door is a pocket door (the cabin kit's doorway): its leaves slide
//            into the wall beside it. "leaves": 2 (the default: two leaves parting), or 1 / -1 (one leaf, sliding toward
//            +x or -x on a wall along x, +z or -z on a wall along z). doorReach says how much wall that takes.
//   eyes     (optional) where the lab's camera stands in each room, by room id: { "at": [x, z], "look": [x, z] }, at a
//            person's eye height (the lab finds a spot itself for a room not listed)
//   items    furniture as footprints with a height: beds, seats, counters, consoles, lockers, tables, machinery
//            "y": a HANGING item's bottom above its room's floor (an overhead cabinet in the wall's top corner): it hangs
//            on a wall, over furniture or high enough to walk under; people walk beneath it only where it is 2.0 m up
//            "cut": corners of its footprint cut off on a diagonal: { "x0z1": [0.33, 0.3] } cuts the corner at its low x
//            and high z, from 0.33 m along x and 0.3 m along z (a number alone: both alike). Written against its own
//            corners, so it moves with the item. Every check uses the true outline (outlineOf): the floor in a cut
//            corner is floor people may stand on
//            "head" (a bunk, optional): "low" or "high": the pillows at the end of its long side with the lower or the
//            higher plan coordinate (so the foot and the ladder at the other); left out, the furnishing puts the pillows
//            at the end nothing stands in front of. The checker does not read it
//            "fit" (optional): a particular fitting the room's furnishing builds for this item: "drinks" (a galley's
//            drink unit, a locker beside the cold store: kit/ships/cabin-furnish.js). The checker does not read it
//   splay    (a door, optional, "splay": true) furniture may stand beside this door on a 45 degree splay: the space kept
//            clear in front of it narrows from the opening's edges (instead of the opening's whole width for 0.5 m), and
//            in exchange a person's 0.5 m square must fit standing in the doorway, wholly inside the opening, on each
//            side. For a door with an angled built-in beside it (the washroom's, by the berths' end locker); every other
//            door keeps the whole rectangle
// A SPACE file (assets/ships/<shell>.space.json, from the rigs' space.mjs) holds the shell's clear inside: on a 0.1 m
// grid, where each spot's clear space starts and ends above the deck (H.floorCm, H.topCm).
//
// THE CHECKS (each with marks for the drawing):
//   floor     every room and item stands on the inside floor (not over the hull's sides, nor on bulk; an item may
//             stand on a ledge of the hull up to 0.3 m high, as on a plinth)
//   head      at head height (2.0 m) and below nothing pokes through the hull: room walls, and every item's top
//   ceiling   each room's ceiling (2.5 m, or its own) is under the hull, except over its furniture, where the hull's
//             slope is the ceiling; and every hanging item's top under the hull
//   headroom  at least 2.0 m clear wherever people walk (a 0.5 m wide person, between furniture), under the hull and
//             under any hanging item
//   corridor  corridors at least 0.9 m clear
//   doors     doors at least 0.8 m wide (a washroom's 0.6: its kind's `door`), each on a wall the two rooms share; the
//             outer door in the shell's door
//   pockets   (a blueprint with "sliding": true: its inside doors are planned as the kit's sliding doors) every inside
//             door's frame and the wall its open leaves park in (doorReach) are real wall with a face on both sides, all
//             the way (no open room, no other door's frame or pocket); its frame does not run past either room's corner
//   walk      a walk from the outer door to every room (through doors only)
//   fit       rooms do not overlap; items inside their room, not on each other, not in a doorway (0.5 m clear each
//             side of it, the opening's whole width; a "splay" door: see above); a hanging item on a wall, over what
//             stands under it, under its room's ceiling
//   sizes     each room at least its kind's size
//   stretcher (only where there are patient beds) a stretcher's way, STRETCHER wide, from an outer door to the long
//             side of every patient bed: a wider walk, through doors at least that wide
export const STRETCHER = 1.0;
export const HEAD = 2.0, CEIL = 2.5, CORRIDOR = 0.9, DOOR = 0.8, BODY = 0.5, DOOR_CLEAR = 0.5, LEDGE = 0.3;

// the kinds of room: colour, the least floor area (m2) and least width (m)
export const ROOM_KINDS = {
  cockpit: { label: 'Cockpit', color: '#4fb6ff', min: 4, minW: 1.5 },
  airlock: { label: 'Airlock', color: '#f2b547', min: 2.25, minW: 1.5 },
  galley: { label: 'Galley / mess', color: '#e08a4f', min: 4.5, minW: 1.5 },
  bunks: { label: 'Bunks', color: '#7d8cff', min: 4, minW: 1.5 },
  science: { label: 'Science lab', color: '#3fd0b0', min: 4, minW: 1.5 },
  engineering: { label: 'Engineering', color: '#ff6b5e', min: 6, minW: 2 },
  storage: { label: 'Storage', color: '#a0a8b4', min: 1, minW: 0.5 },
  // (a washroom's door may be narrower: 0.6 m clear, as on boats, motorhomes and aircraft)
  washroom: { label: 'Washroom', color: '#9fdcff', min: 1.5, minW: 1, door: 0.6 },
  corridor: { label: 'Corridor', color: '#6b7a8c', min: 0, minW: CORRIDOR },
  medbay: { label: 'Med bay', color: '#5fd3c4', min: 6, minW: 2 },
  // (a medical ship's pharmacy and lab: its own colour beside the med bay's, which a survey ship's science lab is not)
  lab: { label: 'Pharmacy / medical lab', color: '#b5d94c', min: 2, minW: 1 },
};
// the kinds of item: default footprint (across, along: metres, quarter metres), height, colour, a short label
export const ITEM_KINDS = {
  seat: { label: 'Bucket seat', w: 0.75, d: 0.75, h: 1.3, color: '#d9a35b', tag: 'S' },
  console: { label: 'Console', w: 1.5, d: 0.5, h: 0.9, color: '#5aa9e6', tag: 'C' },
  bunk: { label: 'Bunk (2-high)', w: 1, d: 2, h: 1.9, color: '#6f7fe0', tag: 'B2' },
  bed: { label: 'Bunk (single)', w: 1, d: 2, h: 0.6, color: '#8e9bef', tag: 'B' },
  counter: { label: 'Counter', w: 0.5, d: 1.5, h: 0.9, color: '#c98a5a', tag: 'K' },
  table: { label: 'Table', w: 0.75, d: 1.25, h: 0.75, color: '#d6c3a5', tag: 'T' },
  bench: { label: 'Bench', w: 0.5, d: 1.25, h: 0.45, color: '#8a6d55', tag: 'b' },
  locker: { label: 'Locker', w: 0.5, d: 0.5, h: 2, color: '#9aa4b0', tag: 'L' },
  rack: { label: 'Shelves', w: 0.5, d: 1, h: 1.9, color: '#7f8a96', tag: 'R' },
  holo: { label: 'Survey table', w: 1, d: 1.25, h: 0.9, color: '#3fd0b0', tag: 'H' },
  machine: { label: 'Machinery', w: 1, d: 1.5, h: 1.8, color: '#c0563f', tag: 'M' },
  shower: { label: 'Shower', w: 0.75, d: 0.75, h: 2, color: '#9fdcff', tag: 'Sh' },
  toilet: { label: 'Toilet', w: 0.5, d: 0.75, h: 0.8, color: '#cfe8f7', tag: 'WC' },
  patient: { label: 'Patient bed', w: 1, d: 2, h: 0.8, color: '#e6dec6', tag: 'P' },
  scanner: { label: 'Triage scanner', w: 1, d: 2.25, h: 1.5, color: '#46b8a8', tag: 'Sc' },
  pharmacy: { label: 'Pharmacy wall', w: 0.5, d: 1.5, h: 2, color: '#9fe0d6', tag: 'Ph' },
  // (a box round the edge of the hull's own door where its opening runs on past the room it opens into)
  casing: { label: 'Door casing', w: 0.5, d: 0.25, h: 2.06, color: '#565c64', tag: 'Cs' },
  // (hangs: y is its bottom above the floor; it goes in a wall's top corner, under the hull's slope)
  overhead: { label: 'Overhead cabinet', w: 0.5, d: 1, h: 0.6, y: 1.9, hang: true, color: '#c9b98f', tag: 'OC' },
};
// a hanging item (its bottom off the floor)
export const hangs = (it) => +(it?.y || 0) > 0;
// the least clear opening of a door: its rooms' kinds' (a washroom's 0.6), or DOOR
export const doorMin = (bp, d) => Math.min(DOOR, ...(d.rooms || []).map((id) => ROOM_KINDS[bp.rooms.find((r) => r.id === id)?.kind]?.door ?? DOOR));
// THE POCKETS (the cabin kit's doorway, kit/shell.js: a frame FRAME wide round the opening; two leaves each park out to
// the opening's width + 0.1 from its middle, one leaf to 1.5 times it + 0.1 on its side): along the door's wall, the
// frame [lo, hi], each pocket [lo, hi], and the whole run
export const FRAME = 0.1;
export function doorReach(d, wall) {
  const c = wall.along === 'z' ? d.at[1] : d.at[0], c0 = d.width, fw = c0 / 2 + FRAME, L = d.leaves ?? 2;
  const frame = [c - fw, c + fw];
  const pockets = L === 2 ? [[c - c0 - 0.1, c - fw], [c + fw, c + c0 + 0.1]] : L > 0 ? [[c + fw, c + 1.5 * c0 + 0.1]] : [[c - 1.5 * c0 - 0.1, c - fw]];
  return { frame, pockets, run: [Math.min(frame[0], ...pockets.map((p) => p[0])), Math.max(frame[1], ...pockets.map((p) => p[1]))] };
}
// the faces on a wall line: for each side, the stretches along it that are some room's wall ({ x } or { z } as doorWall
// gives, side -1: the rooms on the low side of the line, +1 the high side)
export function wallFaces(bp, wall) {
  const out = { '-1': [], '1': [] };
  for (const r of bp.rooms) {
    const [x0, z0, x1, z1] = r.rect;
    if (wall.along === 'z') { if (Math.abs(x1 - wall.x) < 1e-6) out['-1'].push([z0, z1, r.id]); if (Math.abs(x0 - wall.x) < 1e-6) out['1'].push([z0, z1, r.id]); }
    else { if (Math.abs(z1 - wall.z) < 1e-6) out['-1'].push([x0, x1, r.id]); if (Math.abs(z0 - wall.z) < 1e-6) out['1'].push([x0, x1, r.id]); }
  }
  return out;
}
// is [a, b] covered by the union of stretches?
const covered = (list, a, b) => { let at = a; for (const [lo, hi] of list.slice().sort((p, q) => p[0] - q[0])) { if (lo > at + 1e-6) break; at = Math.max(at, hi); } return at >= b - 1e-6; };

const EPS = 1e-6;
export const snap = (v, s) => Math.round(v / s) * s;
export const rectW = (r) => r[2] - r[0], rectL = (r) => r[3] - r[1];
export const normRect = (r) => [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])];
// (a point on a rect's low edge is in it, on its high edge not: two rects that touch share no point)
const inRect = (r, x, z) => x >= r[0] - EPS && x < r[2] - EPS && z >= r[1] - EPS && z < r[3] - EPS;
const overlap = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > EPS && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > EPS;

// AN ITEM'S TRUE OUTLINE: its rect less the corners cut off it ("cut"). cutsOf: each cut as { hx, hz (at the rect's high
// x, high z?), a, b (how far along x, along z) }; outlineOf: the outline's points, going round from (x0, z0) by (x1, z0).
export const cutsOf = (it) => Object.entries(it?.cut || {}).map(([key, v]) => { const [a, b] = Array.isArray(v) ? v : [v, v]; return { key, hx: key.includes('x1'), hz: key.includes('z1'), a: +a, b: +b }; }).filter((C) => C.a > EPS && C.b > EPS);
export function outlineOf(it) {
  const [x0, z0, x1, z1] = it.rect, C = Object.fromEntries(cutsOf(it).map((c) => [(c.hx ? 'x1' : 'x0') + (c.hz ? 'z1' : 'z0'), c])), P = [];
  // (at each corner: the point on the side the outline arrives by, then the one on the side it leaves by)
  const corner = (key, x, z, sx, sz, xFirst) => { const c = C[key]; if (!c) { P.push([x, z]); return; } const px = [x + sx * c.a, z], pz = [x, z + sz * c.b]; if (xFirst) P.push(px, pz); else P.push(pz, px); };
  corner('x0z0', x0, z0, 1, 1, false); corner('x1z0', x1, z0, -1, 1, true); corner('x1z1', x1, z1, -1, -1, false); corner('x0z1', x0, z1, 1, -1, true);
  return P;
}
// is a point on an item's footprint (its rect, not in a cut corner)?
const inCuts = (cuts, r, x, z) => cuts.some((c) => Math.abs(x - r[c.hx ? 2 : 0]) / c.a + Math.abs(z - r[c.hz ? 3 : 1]) / c.b < 1 - EPS);
export const inItem = (it, x, z) => inRect(it.rect, x, z) && !inCuts(cutsOf(it), it.rect, x, z);
// do two outlines (each with no dents) share any floor? (they do unless some side of one has the other wholly beyond it)
export function outlinesMeet(P, Q) {
  for (const S of [P, Q]) for (let i = 0; i < S.length; i++) {
    const [ax, az] = S[i], [bx, bz] = S[(i + 1) % S.length], ux = bz - az, uz = ax - bx, len = Math.hypot(ux, uz); if (len < EPS) continue;
    const span = (T) => { let lo = Infinity, hi = -Infinity; for (const [x, z] of T) { const d = (x * ux + z * uz) / len; if (d < lo) lo = d; if (d > hi) hi = d; } return [lo, hi]; };
    const [p0, p1] = span(P), [q0, q1] = span(Q);
    if (Math.min(p1, q1) - Math.max(p0, q0) <= EPS) return false;
  }
  return true;
}
const rectOutline = (r) => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
// the floor kept clear at a door (wall as doorWall gives): DOOR_CLEAR each side of it, the opening's whole width; a
// "splay" door's narrows at 45 degrees from the opening's edges (to DOOR_CLEAR, or where its two sides meet)
export function doorZone(w, door) {
  if (w.hatch) return rectOutline(w.rect);
  const [lo, hi] = w.span, v = w.along === 'z' ? w.x : w.z, D = door?.splay ? Math.min(DOOR_CLEAR, (hi - lo) / 2) : DOOR_CLEAR, t = door?.splay ? D : 0;
  const P = [[lo, v], [lo + t, v - D], [hi - t, v - D], [hi, v], [hi - t, v + D], [lo + t, v + D]].filter((p, i, A) => Math.hypot(p[0] - A[(i + 1) % A.length][0], p[1] - A[(i + 1) % A.length][1]) > EPS);
  // (written along the wall then across it: a wall along z has those the other way round)
  return w.along === 'z' ? P.map(([a, b]) => [b, a]) : P;
}

// the space's grid: where the clear space starts and ends above the deck at a point (metres; [0, 0]: none)
export function spaceAt(space) {
  const H = space.H, c = H.cell;
  return (x, z) => {
    const a = Math.floor((x - H.x0) / c + EPS), b = Math.floor((z - H.z0) / c + EPS);
    if (a < 0 || b < 0 || a >= H.nx || b >= H.nz) return [0, 0];
    const n = a + H.nx * b; return [H.floorCm[n] / 100, H.topCm[n] / 100];
  };
}

// which wall a door is on: { x } (a wall along z at that x) or { z }, the rooms on each side, and its span
export function doorWall(bp, door) {
  const R = Object.fromEntries(bp.rooms.map((r) => [r.id, r]));
  const [ia, ib] = door.rooms || [], a = R[ia], b = ib === 'outside' ? null : R[ib], [x, z] = door.at, hw = door.width / 2;
  // (a hatch: in its room's floor, wholly inside it; its square as rect)
  if (door.hatch) { if (!a || x - hw < a.rect[0] - 0.01 || x + hw > a.rect[2] + 0.01 || z - hw < a.rect[1] - 0.01 || z + hw > a.rect[3] + 0.01) return null; return { hatch: true, along: 'hatch', x, z, span: [x - hw, x + hw], rect: [x - hw, z - hw, x + hw, z + hw] }; }
  const edges = (r) => [{ x: r.rect[0], lo: r.rect[1], hi: r.rect[3] }, { x: r.rect[2], lo: r.rect[1], hi: r.rect[3] }, { z: r.rect[1], lo: r.rect[0], hi: r.rect[2] }, { z: r.rect[3], lo: r.rect[0], hi: r.rect[2] }];
  const on = (e) => (e.x !== undefined ? Math.abs(e.x - x) < 0.01 && z - hw >= e.lo - 0.01 && z + hw <= e.hi + 0.01 : Math.abs(e.z - z) < 0.01 && x - hw >= e.lo - 0.01 && x + hw <= e.hi + 0.01);
  if (!a) return null;
  const ea = edges(a).find(on); if (!ea) return null;
  if (ib !== 'outside') { if (!b || !edges(b).some((e) => on(e) && (e.x !== undefined) === (ea.x !== undefined))) return null; }
  return ea.x !== undefined ? { x: ea.x, span: [z - hw, z + hw], along: 'z' } : { z: ea.z, span: [x - hw, x + hw], along: 'x' };
}

// the rooms whose walls hold a door at a point (for dropping a door on a wall in the editor)
export function wallsAt(bp, x, z, reach = 0.4) {
  const hits = [];
  for (const r of bp.rooms) {
    const [x0, z0, x1, z1] = r.rect;
    for (const [ex, lo, hi] of [[x0, z0, z1], [x1, z0, z1]]) if (Math.abs(ex - x) < reach && z > lo && z < hi) hits.push({ room: r.id, x: ex, along: 'z', d: Math.abs(ex - x) });
    for (const [ez, lo, hi] of [[z0, x0, x1], [z1, x0, x1]]) if (Math.abs(ez - z) < reach && x > lo && x < hi) hits.push({ room: r.id, z: ez, along: 'x', d: Math.abs(ez - z) });
  }
  return hits.sort((p, q) => p.d - q.d);
}

// ── THE CHECKS ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function checkBlueprint(bp, space) {
  const at = spaceAt(space), H = space.H, c = H.cell, nx = H.nx, nz = H.nz;
  const cx = (a) => H.x0 + (a + 0.5) * c, cz = (b) => H.z0 + (b + 0.5) * c;
  const rooms = bp.rooms, items = bp.items || [], doors = bp.doors || [];
  const roomIx = Object.fromEntries(rooms.map((r, i) => [r.id, i]));
  const marks = [], add = (check, m) => marks.push({ check, ...m });
  // each 0.1 m cell: its room, the item on it
  // (and the hanging item over it: the lowest)
  const N = nx * nz, roomOf = new Int16Array(N).fill(-1), itemOf = new Int16Array(N).fill(-1), hangOf = new Int16Array(N).fill(-1);
  const overlapCells = [], cuts = items.map(cutsOf), outlines = items.map(outlineOf);
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    const x = cx(a), z = cz(b), n = a + nx * b;
    for (let i = 0; i < rooms.length; i++) if (inRect(rooms[i].rect, x, z)) { if (roomOf[n] >= 0) overlapCells.push(n); else roomOf[n] = i; }
    for (let i = 0; i < items.length; i++) if (inRect(items[i].rect, x, z) && !inCuts(cuts[i], items[i].rect, x, z)) { if (!hangs(items[i])) itemOf[n] = i; else if (hangOf[n] < 0 || +items[i].y < +items[hangOf[n]].y) hangOf[n] = i; }
  }
  // (the clear height over a cell: the hull's, or a hanging item's bottom)
  const under = (n, T, f) => (hangOf[n] >= 0 ? Math.min(T, f + +items[hangOf[n]].y) : T);
  // cells outside the space's grid (a room drawn beyond it) are counted too
  const outOfGrid = (r) => r[0] < H.x0 - EPS || r[1] < H.z0 - EPS || r[2] > H.x0 + nx * c + EPS || r[3] > H.z0 + nz * c + EPS;
  const fl = (i) => +(rooms[i].floor || 0), ceilOf = (i) => (typeof rooms[i].ceiling === 'number' ? rooms[i].ceiling : rooms[i].ceiling === 'canopy' ? null : CEIL);
  const bad = { floor: [], head: [], ceiling: [], headroom: [] };
  const free = new Uint8Array(N);   // a person may be on this cell (in a room, on its floor, not on an item)
  for (let n = 0; n < N; n++) {
    const i = roomOf[n]; if (i < 0) continue;
    const a = n % nx, b = (n / nx) | 0, [F, T] = at(cx(a), cz(b)), f = fl(i);
    const it = itemOf[n] >= 0 ? items[itemOf[n]] : null;
    // (a hanging item's top under the hull, wherever it hangs)
    for (let i = 0; i < items.length; i++) if (hangs(items[i]) && inRect(items[i].rect, cx(a), cz(b)) && !inCuts(cuts[i], items[i].rect, cx(a), cz(b)) && T < f + +items[i].y + +items[i].h - EPS) { bad.ceiling.push(n); break; }
    // (an item may stand on a ledge of the hull up to LEDGE high: its plinth; people's floor may not)
    if (T <= f + EPS || F > f + (it ? LEDGE : 0) + 0.01) { bad.floor.push(n); continue; }
    const need = it ? +it.h + Math.max(0, F - f) : ceilOf(i) ?? 0;
    if (!it) free[n] = 1;
    if (T < f + Math.min(need, HEAD) - EPS) bad.head.push(n);
    else if (need > HEAD && T < f + need - EPS) bad.ceiling.push(n);
  }
  // items off any room's floor (an item outside its room is counted under "fit")
  for (const it of items) if (outOfGrid(it.rect)) bad.floor.push(-1);
  for (const r of rooms) if (outOfGrid(r.rect)) bad.floor.push(-1);
  // where a person can stand: the 0.5 m square round the cell free (furniture, the hull and no-room block it)
  // (the square: the cell and k cells each way, 2k + 1 cells = BODY across)
  const k = Math.floor(BODY / c / 2), stand = new Uint8Array(N);
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    let ok = free[a + nx * b] === 1;
    for (let db = -k; ok && db <= k; db++) for (let da = -k; ok && da <= k; da++) { const aa = a + da, bb = b + db; ok = aa >= 0 && bb >= 0 && aa < nx && bb < nz && free[aa + nx * bb] === 1; }
    stand[a + nx * b] = ok ? 1 : 0;
  }
  // (a cell where a person's square fits covers its neighbours too: those are walked on as well)
  const walked = new Uint8Array(N);
  for (let n = 0; n < N; n++) if (stand[n]) { const a = n % nx, b = (n / nx) | 0; for (let db = -k; db <= k; db++) for (let da = -k; da <= k; da++) { const aa = a + da, bb = b + db; if (aa >= 0 && bb >= 0 && aa < nx && bb < nz) walked[aa + nx * bb] = 1; } }
  for (let n = 0; n < N; n++) if (walked[n] && roomOf[n] >= 0) { const a = n % nx, b = (n / nx) | 0, f = fl(roomOf[n]), T = under(n, at(cx(a), cz(b))[1], f); if (T < f + HEAD - EPS) bad.headroom.push(n); }

  // ── doors ──
  const doorRes = doors.map((d) => {
    const wall = doorWall(bp, d), problems = [], least = doorMin(bp, d);
    if (!(d.width >= least - EPS)) problems.push(`${d.width} m wide (at least ${least})`);
    if (!wall) problems.push(d.rooms?.[1] === 'outside' ? `not on a wall of ${d.rooms?.[0]}` : `not on a wall ${d.rooms?.join(' and ')} share`);
    if (wall && d.rooms[1] === 'outside') {
      const sds = space.doors?.list || [space.doors?.port || space.doors?.starboard].filter(Boolean), sd = sds[0], bd = space.doors?.belly;
      if (bd) { const r = wall.rect; if (!wall.hatch) problems.push(`not a hatch: the shell's door is in its belly (x ${bd.x[0]} to ${bd.x[1]}, z ${bd.z[0]} to ${bd.z[1]})`); else if (r[0] < bd.x[0] - 0.05 || r[2] > bd.x[1] + 0.05 || r[1] < bd.z[0] - 0.05 || r[3] > bd.z[1] + 0.05) problems.push(`not in the shell's belly door (x ${bd.x[0]} to ${bd.x[1]}, z ${bd.z[0]} to ${bd.z[1]})`); }
      else if (!sd) problems.push('the shell has no door');
      else if (wall.hatch) problems.push('a hatch: the shell\'s door is in its side');
      else {
        const inDoor = (q) => { const side = q.side === 'port' ? 1 : -1; return !(wall.along !== 'z' || side * wall.x < 0 || Math.abs(q.face - wall.x) > 0.7 || wall.span[0] < q.z[0] - 0.05 || wall.span[1] > q.z[1] + 0.05); };
        if (!sds.some(inDoor)) problems.push(sds.length > 1 ? `not in any of the shell's doors (${sds.map((q) => `${q.name || q.side}: z ${q.z[0]} to ${q.z[1]}, face x ${q.face}`).join('; ')})` : `not in the shell's door (z ${sd.z[0]} to ${sd.z[1]}, its face at x ${sd.face})`);
      }
    }
    return { door: d, wall, problems };
  });
  // ── the pockets: each inside door's frame and leaves in real wall, faced both sides, clear of every other door ──
  // (asked for by a blueprint whose inside doors are planned as sliding doors: "sliding": true)
  const pocketBad = [], lineOf = (w) => (w.along === 'z' ? 'x' + w.x.toFixed(3) : 'z' + w.z.toFixed(3));
  const doorRuns = doorRes.filter((r) => r.wall && !r.wall.hatch).map((r) => ({ r, line: lineOf(r.wall), reach: r.door.rooms[1] === 'outside' ? { frame: r.wall.span, pockets: [], run: r.wall.span } : doorReach(r.door, r.wall) }));
  for (const D of bp.sliding ? doorRuns : []) {
    const { r, reach } = D; if (r.door.rooms[1] === 'outside') continue;
    const F = wallFaces(bp, r.wall), why = [];
    for (const s of ['-1', '1']) if (!covered(F[s], reach.run[0], reach.run[1])) why.push('its leaves would park where there is no wall on one side');
    // (the frame within each of its own rooms' walls: not past a corner, where a wall across would meet it)
    for (const s of ['-1', '1']) if (!F[s].some(([lo, hi, id]) => r.door.rooms.includes(id) && lo <= reach.frame[0] + 1e-6 && hi >= reach.frame[1] - 1e-6)) why.push('its frame runs past a corner of a room it opens into');
    for (const E of doorRuns) if (E !== D && E.line === D.line && Math.min(E.reach.run[1], reach.run[1]) - Math.max(E.reach.run[0], reach.run[0]) > 1e-6) why.push(`its frame or pocket meets door ${E.r.door.id}'s`);
    if (why.length) { const [lo, hi] = reach.run, w = r.wall; pocketBad.push({ door: r.door.id, at: r.door.at, what: [...new Set(why)].join('; '), rect: w.along === 'z' ? [w.x - 0.06, lo, w.x + 0.06, hi] : [lo, w.z - 0.06, hi, w.z + 0.06] }); }
  }
  // ── the walk: from the outer door, cell to cell; from one room into another only through a door ──
  const outers = doorRes.filter((r) => r.wall && r.door.rooms[1] === 'outside' && !r.problems.length), outer = outers[0];
  const reach = new Uint8Array(N), q = [];
  const doorOK = (n, m) => {
    // the edge between cells n and m: crossing allowed if a door of those two rooms spans it
    const ra = rooms[roomOf[n]].id, rb = rooms[roomOf[m]].id, a1 = n % nx, b1 = (n / nx) | 0, a2 = m % nx, b2 = (m / nx) | 0;
    for (const r of doorRes) {
      if (!r.wall || r.problems.length) continue; const ids = r.door.rooms; if (!(ids.includes(ra) && ids.includes(rb))) continue;
      if (r.wall.along === 'z' && a1 !== a2) { const ex = H.x0 + Math.max(a1, a2) * c, zz = cz(b1); if (Math.abs(ex - r.wall.x) < c / 2 && zz > r.wall.span[0] && zz < r.wall.span[1]) return true; }
      if (r.wall.along === 'x' && b1 !== b2) { const ez = H.z0 + Math.max(b1, b2) * c, xx = cx(a1); if (Math.abs(ez - r.wall.z) < c / 2 && xx > r.wall.span[0] && xx < r.wall.span[1]) return true; }
    }
    return false;
  };
  for (const outer of outers) {
    // start on the cells just inside each outer door
    const w = outer.wall, ri = roomIx[outer.door.rooms[0]];
    for (let n = 0; n < N; n++) {
      if (!stand[n] || roomOf[n] !== ri) continue; const a = n % nx, b = (n / nx) | 0;
      // (a hatch: on it, or within a step of it)
      if (w.hatch ? cx(a) > w.rect[0] - 0.3 && cx(a) < w.rect[2] + 0.3 && cz(b) > w.rect[1] - 0.3 && cz(b) < w.rect[3] + 0.3 : Math.abs(cx(a) - w.x) < BODY + 0.3 && cz(b) > w.span[0] && cz(b) < w.span[1]) { reach[n] = 1; q.push(n); }
    }
  }
  while (q.length) {
    const n = q.pop(), a = n % nx, b = (n / nx) | 0;
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const aa = a + da, bb = b + db; if (aa < 0 || bb < 0 || aa >= nx || bb >= nz) continue;
      const m = aa + nx * bb; if (reach[m] || !stand[m]) continue;
      if (roomOf[m] !== roomOf[n] && !doorOK(n, m)) continue;
      reach[m] = 1; q.push(m);
    }
  }
  const reached = new Set(); for (let n = 0; n < N; n++) if (reach[n]) reached.add(roomOf[n]);
  // ── the stretcher's way (only where there are patient beds): the walk again with a body STRETCHER wide, from the
  // outer doors, from room to room only through doors at least that wide; each patient bed needs some of it along one
  // of its long sides (within 0.6 m)
  const beds = items.filter((it) => it.kind === 'patient'), bedsOff = [];
  if (beds.length) {
    const ks = Math.max(k, Math.floor(STRETCHER / c / 2)), wide = new Uint8Array(N), r2 = new Uint8Array(N), q2 = [];
    for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
      let ok = free[a + nx * b] === 1;
      for (let db = -ks; ok && db <= ks; db++) for (let da = -ks; ok && da <= ks; da++) { const aa = a + da, bb = b + db; ok = aa >= 0 && bb >= 0 && aa < nx && bb < nz && free[aa + nx * bb] === 1; }
      wide[a + nx * b] = ok ? 1 : 0;
    }
    const wideDoor = (n, m) => { if (!doorOK(n, m)) return false; const ra = rooms[roomOf[n]].id, rb = rooms[roomOf[m]].id; return doorRes.some((r) => r.wall && !r.problems.length && r.door.rooms.includes(ra) && r.door.rooms.includes(rb) && r.door.width >= STRETCHER - EPS); };
    for (const outer of outers) {
      if (outer.door.width < STRETCHER - EPS) continue;
      const w = outer.wall, ri = roomIx[outer.door.rooms[0]];
      for (let n = 0; n < N; n++) { if (!wide[n] || roomOf[n] !== ri) continue; const a = n % nx, b = (n / nx) | 0; if (w.hatch ? false : Math.abs(cx(a) - w.x) < STRETCHER / 2 + 0.35 && cz(b) > w.span[0] && cz(b) < w.span[1]) { r2[n] = 1; q2.push(n); } }
    }
    while (q2.length) {
      const n = q2.pop(), a = n % nx, b = (n / nx) | 0;
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const aa = a + da, bb = b + db; if (aa < 0 || bb < 0 || aa >= nx || bb >= nz) continue;
        const m = aa + nx * bb; if (r2[m] || !wide[m]) continue;
        if (roomOf[m] !== roomOf[n] && !wideDoor(n, m)) continue;
        r2[m] = 1; q2.push(m);
      }
    }
    // (the stretcher's body covers the cells round its middle: the bed's side is reached where any of those touch it)
    const near = new Uint8Array(N); for (let n = 0; n < N; n++) if (r2[n]) { const a = n % nx, b = (n / nx) | 0; for (let db = -ks; db <= ks; db++) for (let da = -ks; da <= ks; da++) { const aa = a + da, bb = b + db; if (aa >= 0 && bb >= 0 && aa < nx && bb < nz) near[aa + nx * bb] = 1; } }
    for (const it of beds) {
      const [x0, z0, x1, z1] = it.rect, alongZ = z1 - z0 >= x1 - x0, sides = alongZ ? [[x0 - 0.6, z0, x0, z1], [x1, z0, x1 + 0.6, z1]] : [[x0, z0 - 0.6, x1, z0], [x0, z1, x1, z1 + 0.6]];
      const hit = sides.some((R) => { for (let n = 0; n < N; n++) { if (!near[n]) continue; const a = n % nx, b = (n / nx) | 0; if (inRect(R, cx(a), cz(b))) return true; } return false; });
      if (!hit) bedsOff.push(it);
    }
  }
  // ── corridors: the clear width across, all along ──
  const corrBad = [];
  for (const [i, r] of rooms.entries()) {
    if (r.kind !== 'corridor') continue;
    const along = rectL(r.rect) >= rectW(r.rect) ? 'z' : 'x', [x0, z0, x1, z1] = r.rect;
    let worst = Infinity;
    const steps = along === 'z' ? Math.round((z1 - z0) / c) : Math.round((x1 - x0) / c);
    for (let s = 0; s < steps; s++) {
      let run = 0, best = 0;
      const across = along === 'z' ? Math.round((x1 - x0) / c) : Math.round((z1 - z0) / c);
      for (let t = 0; t < across; t++) {
        const x = along === 'z' ? x0 + (t + 0.5) * c : x0 + (s + 0.5) * c, z = along === 'z' ? z0 + (s + 0.5) * c : z0 + (t + 0.5) * c;
        const a = Math.floor((x - H.x0) / c), b = Math.floor((z - H.z0) / c), n = a + nx * b;
        const ok = a >= 0 && b >= 0 && a < nx && b < nz && free[n] && at(x, z)[1] >= fl(i) + HEAD - EPS;
        run = ok ? run + 1 : 0; best = Math.max(best, run);
      }
      const wdt = best * c; worst = Math.min(worst, wdt);
      if (wdt < CORRIDOR - EPS) corrBad.push(along === 'z' ? [x0, z0 + s * c, x1, z0 + (s + 1) * c] : [x0 + s * c, z0, x0 + (s + 1) * c, z1]);
    }
    r._clear = +worst.toFixed(2);
  }
  // ── fit: rooms apart; items in their room, apart, out of doorways ──
  const fit = [], splayed = doors.filter((d) => d.splay).map((d) => d.id);
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) if (overlap(rooms[i].rect, rooms[j].rect)) fit.push({ what: `${rooms[i].name} and ${rooms[j].name} overlap`, rect: [Math.max(rooms[i].rect[0], rooms[j].rect[0]), Math.max(rooms[i].rect[1], rooms[j].rect[1]), Math.min(rooms[i].rect[2], rooms[j].rect[2]), Math.min(rooms[i].rect[3], rooms[j].rect[3])] });
  for (const it of items) {
    const r = rooms[roomIx[it.room]], name = it.name || ITEM_KINDS[it.kind]?.label || it.kind;
    if (!r) fit.push({ what: `${name}: no room ${it.room}`, rect: it.rect });
    else if (it.rect[0] < r.rect[0] - EPS || it.rect[1] < r.rect[1] - EPS || it.rect[2] > r.rect[2] + EPS || it.rect[3] > r.rect[3] + EPS) fit.push({ what: `${name} is not inside ${r.name}`, rect: it.rect });
  }
  // (a hanging item may be over a standing one, its bottom above the other's top)
  const above = (p, q) => hangs(p) && !hangs(q) && +p.y >= +q.h - EPS;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (overlap(items[i].rect, items[j].rect) && outlinesMeet(outlines[i], outlines[j]) && !above(items[i], items[j]) && !above(items[j], items[i])) fit.push({ what: `${items[i].name || items[i].kind} and ${items[j].name || items[j].kind} overlap`, rect: items[i].rect });
  // (a hanging item hangs on one of its room's walls, under its ceiling)
  for (const it of items) {
    const r = rooms[roomIx[it.room]]; if (!hangs(it) || !r) continue;
    const name = it.name || ITEM_KINDS[it.kind]?.label || it.kind, q = it.rect, R = r.rect;
    if (![q[0] - R[0], q[1] - R[1], R[2] - q[2], R[3] - q[3]].some((d) => Math.abs(d) < EPS)) fit.push({ what: `${name} hangs on no wall`, rect: q });
    if (typeof r.ceiling === 'number' || r.ceiling === undefined) { const top = +it.y + +it.h, ceil = r.ceiling ?? CEIL; if (top > ceil + EPS) fit.push({ what: `${name} goes through ${r.name}'s ceiling (${top.toFixed(2)} m, the ceiling ${ceil})`, rect: q }); }
  }
  for (const r of doorRes) {
    if (!r.wall) continue;
    const w = r.wall, zone = doorZone(w, r.door);
    items.forEach((it, i) => { if (outlinesMeet(zone, outlines[i])) fit.push({ what: `${it.name || ITEM_KINDS[it.kind]?.label} is in the doorway of ${r.door.id}`, rect: it.rect }); });
    // (a splayed door: a person's square standing in the doorway, wholly inside the opening, on each side of the line)
    if (r.door.splay && !w.hatch) {
      const alongZ = w.along === 'z', i0 = Math.round(((alongZ ? w.x : w.z) - (alongZ ? H.x0 : H.z0)) / c), m = alongZ ? nz : nx, mid = alongZ ? cz : cx;
      for (const s of [-1, 0]) {
        let ok = false; const i = i0 + s;
        for (let j = 0; !ok && j < m; j++) { const t = mid(j); if (t - BODY / 2 < w.span[0] - EPS || t + BODY / 2 > w.span[1] + EPS) continue; ok = i >= 0 && i < (alongZ ? nx : nz) && stand[alongZ ? i + nx * j : j + nx * i] === 1; }
        if (!ok) fit.push({ what: `no room for a person to stand in the doorway of ${r.door.id} (its ${s < 0 ? 'low' : 'high'} side)`, rect: alongZ ? [w.x - DOOR_CLEAR, w.span[0], w.x + DOOR_CLEAR, w.span[1]] : [w.span[0], w.z - DOOR_CLEAR, w.span[1], w.z + DOOR_CLEAR] });
      }
    }
  }
  // ── sizes ──
  const sizes = rooms.map((r) => {
    const K = ROOM_KINDS[r.kind] || { min: 0, minW: 0 }, w = rectW(r.rect), l = rectL(r.rect), area = w * l;
    return { id: r.id, name: r.name, kind: r.kind, w: +w.toFixed(2), l: +l.toFixed(2), area: +area.toFixed(2), min: K.min, ok: area >= K.min - EPS && Math.min(w, l) >= K.minW - EPS, ceiling: r.ceiling ?? CEIL, floor: r.floor || 0, clear: r._clear };
  });
  for (const r of rooms) delete r._clear;

  // ── marks: cells merged into runs along x ──
  const runs = (list, check) => {
    const set = new Set(list.filter((n) => n >= 0));
    for (const n of set) {
      const a = n % nx, b = (n / nx) | 0; if (a > 0 && set.has(n - 1)) continue;
      let e = a; while (e + 1 < nx && set.has(e + 1 + nx * b)) e++;
      add(check, { rect: [H.x0 + a * c, H.z0 + b * c, H.x0 + (e + 1) * c, H.z0 + (b + 1) * c] });
    }
  };
  runs(bad.floor, 'floor'); runs(bad.head, 'head'); runs(bad.ceiling, 'ceiling'); runs(bad.headroom, 'headroom');
  for (const r of corrBad) add('corridor', { rect: r });
  for (const r of doorRes) if (r.problems.length) add('doors', { door: r.door.id, at: r.door.at, what: r.problems.join('; ') });
  for (const p of pocketBad) add('pockets', p);
  rooms.forEach((r, i) => { if (!reached.has(i)) add('walk', { room: r.id, rect: r.rect, what: `${r.name} cannot be walked to` }); });
  for (const f of fit) add('fit', { rect: f.rect, what: f.what });
  for (const it of bedsOff) add('stretcher', { rect: it.rect, what: `${it.name || 'a patient bed'} cannot be reached with a stretcher` });
  for (const s of sizes) if (!s.ok) add('sizes', { room: s.id, rect: rooms[roomIx[s.id]].rect, what: `${s.name} is ${s.w} x ${s.l} m (${s.area} m2; at least ${s.min} m2)` });
  const count = (id) => marks.filter((m) => m.check === id).length, m2 = (l) => +(new Set(l.filter((n) => n >= 0)).size * c * c).toFixed(2);
  const checks = [
    { id: 'floor', name: 'On the floor', pass: !bad.floor.length, detail: bad.floor.length ? `${m2(bad.floor)} m2 off the inside floor (over the hull or on bulk)` : 'every room and item stands on the inside floor' },
    { id: 'head', name: 'Nothing through the hull at head height', pass: !bad.head.length, detail: bad.head.length ? `${m2(bad.head)} m2 where a wall or an item's top goes through the hull` : 'room walls to 2.0 m and every item under the hull' },
    { id: 'ceiling', name: 'Nothing through the hull at the ceiling', pass: !bad.ceiling.length, detail: bad.ceiling.length ? `${m2(bad.ceiling)} m2 of ceiling (or a hanging item's top) above the hull` : 'every ceiling and hanging item under the hull (over furniture, the hull slopes in)' },
    { id: 'headroom', name: `Head room ${HEAD} m where people walk`, pass: !bad.headroom.length, detail: bad.headroom.length ? `${m2(bad.headroom)} m2 walked on with less` : 'everywhere a person can stand' },
    { id: 'corridor', name: `Corridors ${CORRIDOR} m clear`, pass: !corrBad.length, detail: rooms.some((r) => r.kind === 'corridor') ? sizes.filter((s) => s.kind === 'corridor').map((s) => `${s.name} ${s.clear} m`).join(', ') : 'no corridor' },
    { id: 'doors', name: `Doors ${DOOR} m (a washroom's ${ROOM_KINDS.washroom.door}), on shared walls`, pass: !count('doors'), detail: count('doors') ? marks.filter((m) => m.check === 'doors').map((m) => `${m.door}: ${m.what}`).join('; ') : `${doors.length} doors` + (outer ? `, the outer one in the shell's door` : '') },
    { id: 'pockets', name: 'Sliding doors: their leaves park in real wall', pass: !pocketBad.length, detail: !bp.sliding ? 'not asked: this blueprint\'s doors are not planned as sliding doors ("sliding": true asks)' : pocketBad.length ? pocketBad.map((p) => `${p.door}: ${p.what}`).join('; ') : `${doorRuns.filter((D) => D.r.door.rooms[1] !== 'outside').length} inside doors, each leaf in wall faced on both sides` },
    { id: 'walk', name: 'A walk to every room', pass: !!outer && reached.size === rooms.length, detail: !outer ? 'no outer door in the shell\'s door' : reached.size === rooms.length ? `all ${rooms.length} rooms from the outer door` : marks.filter((m) => m.check === 'walk').map((m) => m.what).join('; ') },
    { id: 'fit', name: 'Rooms and items fit together', pass: !fit.length, detail: fit.length ? fit.map((f) => f.what).join('; ') : 'no overlaps, doorways clear' + (splayed.length ? ` (${splayed.join(', ')}: furniture beside it on a 45 degree splay, a person's width clear through it)` : '') },
    { id: 'sizes', name: 'Room sizes', pass: sizes.every((s) => s.ok), detail: sizes.map((s) => `${s.name} ${s.w}x${s.l}`).join(', ') },
    ...(beds.length ? [{ id: 'stretcher', name: `A stretcher's way (${STRETCHER} m) to every patient bed`, pass: !bedsOff.length, detail: bedsOff.length ? bedsOff.map((it) => `${it.name || 'a patient bed'} cannot be reached`).join('; ') : `${beds.length} beds from the outer doors, through doors ${STRETCHER} m wide or more` }] : []),
  ];
  return { checks, marks, sizes, pass: checks.every((k) => k.pass), reach, stand, grid: { x0: H.x0, z0: H.z0, nx, nz, c } };
}
