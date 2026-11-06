// SHIP BLUEPRINTS: the rooms of a ship drawn on the space its shell actually has, and the checks that keep them
// inside it. Plain data and plain functions (no three.js), so the lab and the rigs run the very same checks.
//
// A BLUEPRINT is a JSON file (space-station/kit/ships/<id>.blueprint.json):
//   { "id", "name", "idea", "ship", "shell": "<a shell in assets/ships>", "grid": { "cell": 0.5, "step": 0.5, "deck": metres },
//     "rooms": [ { "id", "name", "kind", "rect": [x0, z0, x1, z1], "floor": 0, "ceiling": 2.5 } ],
//     "doors": [ { "id", "rooms": ["a", "b" | "outside"], "at": [x, z], "width": 0.8 } ],
//     "items": [ { "id", "kind", "room", "rect": [x0, z0, x1, z1], "h": metres, "name"? } ] }
//   Metres, in the ship's frame: x toward the ship's left (port), z toward the nose, the middle line x 0, the shell's
//   middle z 0; heights from the deck (grid.deck metres off the ground: the shell's door sill).
//   rect     a room's floor on the ship grid (its edges on the 0.5 m lines); an item's footprint on the half grid (0.25 m)
//   floor    a room's floor above the deck (the cockpit stands 0.3 m up over the nose leg); ceiling: its height above
//            that floor, or "canopy" where the glass is the room's top (then only the head room where people walk counts)
//   doors    on the wall two rooms share ("at" its middle, on that wall); "outside" for the ship's own door, which must
//            be in the shell's door opening. A hatch ("hatch": true) is a door in a room's floor instead: a square
//            "width" on a side, "at" its middle, inside its room; the outer door of a shell whose door is in its belly
//            (the space file's doors.belly: the Miner's lift) is one, inside the belly's opening
//   items    furniture as footprints with a height: beds, seats, counters, consoles, lockers, tables, machinery
// A SPACE file (assets/ships/<shell>.space.json, from the rigs' space.mjs) holds the shell's clear inside: on a 0.1 m
// grid, where each spot's clear space starts and ends above the deck (H.floorCm, H.topCm).
//
// THE CHECKS (each with marks for the drawing):
//   floor     every room and item stands on the inside floor (not over the hull's sides, nor on bulk; an item may
//             stand on a ledge of the hull up to 0.3 m high, as on a plinth)
//   head      at head height (2.0 m) and below nothing pokes through the hull: room walls, and every item's top
//   ceiling   each room's ceiling (2.5 m, or its own) is under the hull, except over its furniture, where the hull's
//             slope is the ceiling
//   headroom  at least 2.0 m clear wherever people walk (a 0.5 m wide person, between furniture)
//   corridor  corridors at least 0.9 m clear
//   doors     doors at least 0.8 m wide, each on a wall the two rooms share; the outer door in the shell's door
//   walk      a walk from the outer door to every room (through doors only)
//   fit       rooms do not overlap; items inside their room, not on each other, not in a doorway
//   sizes     each room at least its kind's size
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
  washroom: { label: 'Washroom', color: '#9fdcff', min: 1.5, minW: 1 },
  corridor: { label: 'Corridor', color: '#6b7a8c', min: 0, minW: CORRIDOR },
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
};

const EPS = 1e-6;
export const snap = (v, s) => Math.round(v / s) * s;
export const rectW = (r) => r[2] - r[0], rectL = (r) => r[3] - r[1];
export const normRect = (r) => [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])];
// (a point on a rect's low edge is in it, on its high edge not: two rects that touch share no point)
const inRect = (r, x, z) => x >= r[0] - EPS && x < r[2] - EPS && z >= r[1] - EPS && z < r[3] - EPS;
const overlap = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > EPS && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > EPS;

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
  const N = nx * nz, roomOf = new Int16Array(N).fill(-1), itemOf = new Int16Array(N).fill(-1);
  const overlapCells = [];
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    const x = cx(a), z = cz(b), n = a + nx * b;
    for (let i = 0; i < rooms.length; i++) if (inRect(rooms[i].rect, x, z)) { if (roomOf[n] >= 0) overlapCells.push(n); else roomOf[n] = i; }
    for (let i = 0; i < items.length; i++) if (inRect(items[i].rect, x, z)) { itemOf[n] = i; }
  }
  // cells outside the space's grid (a room drawn beyond it) are counted too
  const outOfGrid = (r) => r[0] < H.x0 - EPS || r[1] < H.z0 - EPS || r[2] > H.x0 + nx * c + EPS || r[3] > H.z0 + nz * c + EPS;
  const fl = (i) => +(rooms[i].floor || 0), ceilOf = (i) => (typeof rooms[i].ceiling === 'number' ? rooms[i].ceiling : rooms[i].ceiling === 'canopy' ? null : CEIL);
  const bad = { floor: [], head: [], ceiling: [], headroom: [] };
  const free = new Uint8Array(N);   // a person may be on this cell (in a room, on its floor, not on an item)
  for (let n = 0; n < N; n++) {
    const i = roomOf[n]; if (i < 0) continue;
    const a = n % nx, b = (n / nx) | 0, [F, T] = at(cx(a), cz(b)), f = fl(i);
    const it = itemOf[n] >= 0 ? items[itemOf[n]] : null;
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
  for (let n = 0; n < N; n++) if (walked[n] && roomOf[n] >= 0) { const a = n % nx, b = (n / nx) | 0, T = at(cx(a), cz(b))[1]; if (T < fl(roomOf[n]) + HEAD - EPS) bad.headroom.push(n); }

  // ── doors ──
  const doorRes = doors.map((d) => {
    const wall = doorWall(bp, d), problems = [];
    if (!(d.width >= DOOR - EPS)) problems.push(`${d.width} m wide (at least ${DOOR})`);
    if (!wall) problems.push(d.rooms?.[1] === 'outside' ? `not on a wall of ${d.rooms?.[0]}` : `not on a wall ${d.rooms?.join(' and ')} share`);
    if (wall && d.rooms[1] === 'outside') {
      const sd = space.doors?.port || space.doors?.starboard, bd = space.doors?.belly;
      if (bd) { const r = wall.rect; if (!wall.hatch) problems.push(`not a hatch: the shell's door is in its belly (x ${bd.x[0]} to ${bd.x[1]}, z ${bd.z[0]} to ${bd.z[1]})`); else if (r[0] < bd.x[0] - 0.05 || r[2] > bd.x[1] + 0.05 || r[1] < bd.z[0] - 0.05 || r[3] > bd.z[1] + 0.05) problems.push(`not in the shell's belly door (x ${bd.x[0]} to ${bd.x[1]}, z ${bd.z[0]} to ${bd.z[1]})`); }
      else if (!sd) problems.push('the shell has no door');
      else if (wall.hatch) problems.push('a hatch: the shell\'s door is in its side');
      else {
        const side = sd.side === 'port' ? 1 : -1;
        if (wall.along !== 'z' || side * wall.x < 0 || Math.abs(sd.face - wall.x) > 0.7 || wall.span[0] < sd.z[0] - 0.05 || wall.span[1] > sd.z[1] + 0.05) problems.push(`not in the shell's door (z ${sd.z[0]} to ${sd.z[1]}, its face at x ${sd.face})`);
      }
    }
    return { door: d, wall, problems };
  });
  // ── the walk: from the outer door, cell to cell; from one room into another only through a door ──
  const outer = doorRes.find((r) => r.wall && r.door.rooms[1] === 'outside' && !r.problems.length);
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
  if (outer) {
    // start on the cells just inside the outer door
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
  const fit = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) if (overlap(rooms[i].rect, rooms[j].rect)) fit.push({ what: `${rooms[i].name} and ${rooms[j].name} overlap`, rect: [Math.max(rooms[i].rect[0], rooms[j].rect[0]), Math.max(rooms[i].rect[1], rooms[j].rect[1]), Math.min(rooms[i].rect[2], rooms[j].rect[2]), Math.min(rooms[i].rect[3], rooms[j].rect[3])] });
  for (const it of items) {
    const r = rooms[roomIx[it.room]], name = it.name || ITEM_KINDS[it.kind]?.label || it.kind;
    if (!r) fit.push({ what: `${name}: no room ${it.room}`, rect: it.rect });
    else if (it.rect[0] < r.rect[0] - EPS || it.rect[1] < r.rect[1] - EPS || it.rect[2] > r.rect[2] + EPS || it.rect[3] > r.rect[3] + EPS) fit.push({ what: `${name} is not inside ${r.name}`, rect: it.rect });
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (overlap(items[i].rect, items[j].rect)) fit.push({ what: `${items[i].name || items[i].kind} and ${items[j].name || items[j].kind} overlap`, rect: items[i].rect });
  for (const r of doorRes) {
    if (!r.wall) continue;
    const w = r.wall, zone = w.hatch ? w.rect : w.along === 'z' ? [w.x - DOOR_CLEAR, w.span[0], w.x + DOOR_CLEAR, w.span[1]] : [w.span[0], w.z - DOOR_CLEAR, w.span[1], w.z + DOOR_CLEAR];
    for (const it of items) if (overlap(zone, it.rect)) fit.push({ what: `${it.name || ITEM_KINDS[it.kind]?.label} is in the doorway of ${r.door.id}`, rect: it.rect });
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
  rooms.forEach((r, i) => { if (!reached.has(i)) add('walk', { room: r.id, rect: r.rect, what: `${r.name} cannot be walked to` }); });
  for (const f of fit) add('fit', { rect: f.rect, what: f.what });
  for (const s of sizes) if (!s.ok) add('sizes', { room: s.id, rect: rooms[roomIx[s.id]].rect, what: `${s.name} is ${s.w} x ${s.l} m (${s.area} m2; at least ${s.min} m2)` });
  const count = (id) => marks.filter((m) => m.check === id).length, m2 = (l) => +(new Set(l.filter((n) => n >= 0)).size * c * c).toFixed(2);
  const checks = [
    { id: 'floor', name: 'On the floor', pass: !bad.floor.length, detail: bad.floor.length ? `${m2(bad.floor)} m2 off the inside floor (over the hull or on bulk)` : 'every room and item stands on the inside floor' },
    { id: 'head', name: 'Nothing through the hull at head height', pass: !bad.head.length, detail: bad.head.length ? `${m2(bad.head)} m2 where a wall or an item's top goes through the hull` : 'room walls to 2.0 m and every item under the hull' },
    { id: 'ceiling', name: 'Nothing through the hull at the ceiling', pass: !bad.ceiling.length, detail: bad.ceiling.length ? `${m2(bad.ceiling)} m2 of ceiling above the hull` : 'every ceiling under the hull (over furniture, the hull slopes in)' },
    { id: 'headroom', name: `Head room ${HEAD} m where people walk`, pass: !bad.headroom.length, detail: bad.headroom.length ? `${m2(bad.headroom)} m2 walked on with less` : 'everywhere a person can stand' },
    { id: 'corridor', name: `Corridors ${CORRIDOR} m clear`, pass: !corrBad.length, detail: rooms.some((r) => r.kind === 'corridor') ? sizes.filter((s) => s.kind === 'corridor').map((s) => `${s.name} ${s.clear} m`).join(', ') : 'no corridor' },
    { id: 'doors', name: `Doors ${DOOR} m, on shared walls`, pass: !count('doors'), detail: count('doors') ? marks.filter((m) => m.check === 'doors').map((m) => `${m.door}: ${m.what}`).join('; ') : `${doors.length} doors` + (outer ? `, the outer one in the shell's door` : '') },
    { id: 'walk', name: 'A walk to every room', pass: !!outer && reached.size === rooms.length, detail: !outer ? 'no outer door in the shell\'s door' : reached.size === rooms.length ? `all ${rooms.length} rooms from the outer door` : marks.filter((m) => m.check === 'walk').map((m) => m.what).join('; ') },
    { id: 'fit', name: 'Rooms and items fit together', pass: !fit.length, detail: fit.length ? fit.map((f) => f.what).join('; ') : 'no overlaps, doorways clear' },
    { id: 'sizes', name: 'Room sizes', pass: sizes.every((s) => s.ok), detail: sizes.map((s) => `${s.name} ${s.w}x${s.l}`).join(', ') },
  ];
  return { checks, marks, sizes, pass: checks.every((k) => k.pass), reach, stand, grid: { x0: H.x0, z0: H.z0, nx, nz, c } };
}
