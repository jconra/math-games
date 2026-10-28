// WHERE THE PLAYER'S CABIN'S THINGS GO, worked out from the cabin design it is built as (world/objects/codebuild.js, a
// labs/buildings/cabins.js preset: its rooms, doorways, porch and each room's anchors). Plain numbers, no three.js, so a
// test can read it. Everything is in the building's own frame (metres; its front toward +z; the floor at anchors.floor).
//
// The rooms: the MAIN room is the one the front door opens into (the table and chairs, the stove, the rug, the dog
// beds, the rifle rack, a lantern over the table); the other room, if there is one, is the BEDROOM (the bed, the
// painting over it, a lantern over it). A one-room cabin has it all in its one room. The porch rockers stand either
// side of the way in (or on the ground before the door, with no porch). The keepsakes hang round the walls, high, clear
// of the doorways; the ones that stand go on the table and the floor.
//
//   cabinLayout(anchors) -> { main, bed (rooms: { x0, x1, z0, z1, y, ceil }), slots: { id: spec }, keepsakes: { job: spot },
//                              bedSpots: [{ x, z, rot }], porchDogs: [[x, z, turn]], sign: { x, z, rot }, wait: { x, z },
//                              front: { x, z, ox, oz } (the front doorway, and its way out), steps: { x, z } (in front of
//                              the porch's steps) }
//   A slot's spec: { at: [x, y|null, z], rot (degrees), wall ([dx, 0, dz]: the wall it hangs on, at is on its face),
//                    looks: [[x, y, z]], box, extra: [...] } (the rest of a slot, its name, price and file: slots.js)
const D = 180 / Math.PI;

function roomOf(R, y) { const [x0, x1, z0, z1] = R.floor; return { x0, x1, z0, z1, y, ceil: R.ceiling || 3, anchors: R.anchors || {}, name: R.name }; }
const inRoom = (r, x, z, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
const mid = (r) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
// the room's wall nearest a point inside it: a point on its face, and the way to it ([dx, 0, dz])
function nearestWall(r, x, z) {
  const d = [[x - r.x0, [-1, 0, 0], [r.x0, z]], [r.x1 - x, [1, 0, 0], [r.x1, z]], [z - r.z0, [0, 0, -1], [x, r.z0]], [r.z1 - z, [0, 0, 1], [x, r.z1]]].sort((a, b) => a[0] - b[0])[0];
  return { dir: d[1], x: d[2][0], z: d[2][1] };
}

export function cabinLayout(A) {
  const y = A.floor || 0.6;
  const rooms = (A.rooms || []).filter((R) => !R.open && R.floor).map((R) => roomOf(R, y));
  const outer = (A.doorways || []).filter((d) => !d.inner);
  const fd = outer.find((d) => d.name === 'front') || outer.find((d) => d.out && d.out[2] > 0.5) || outer[0] || { centre: [0, 1.6, (A.footprint ? A.footprint.z1 : 3)], out: [0, 0, 1], w: 0.9 };
  const front = { x: fd.centre[0], z: fd.centre[2], ox: fd.out[0], oz: fd.out[2] };
  // the room the front door opens into (the one nearest it), and the other (the bedroom)
  const byDoor = rooms.slice().sort((a, b) => Math.hypot(mid(a).x - front.x, mid(a).z - front.z) - Math.hypot(mid(b).x - front.x, mid(b).z - front.z));
  const main = byDoor[0] || { x0: -2, x1: 2, z0: -2, z1: 2, y, ceil: 3, anchors: {} };
  const bed = byDoor.find((r) => r !== main) || main;
  const doorsAt = outer.concat((A.doorways || []).filter((d) => d.inner)).map((d) => [d.centre[0], d.centre[2]]);
  const clearOfDoors = (x, z, m = 1.3) => doorsAt.every(([dx, dz]) => Math.hypot(x - dx, z - dz) > m);
  const slots = {};

  // THE BED (the bedroom's corner, head to the wall), the painting over its head
  const bA = bed.anchors.bed || { x: bed.x0 + 0.8, z: bed.z0 + 1.05, rot: 0 };
  const bRot = Math.round((bA.rot || 0) * D);
  slots.bed = { at: [bA.x, null, bA.z], rot: bRot, box: [1.06, 1.9], looks: [[bA.x, y + 0.5, bA.z]] };
  { const headZ = bRot === 180 ? bed.z1 : bed.z0, dir = bRot === 180 ? [0, 0, 1] : [0, 0, -1];
    slots.picture = { at: [bA.x, y + 1.55, headZ], wall: dir, rot: 0, looks: [[bA.x, y + 1.55, headZ - dir[2] * 0.15]] }; }

  // THE WAYS THROUGH: from each room's doorways to the others' (a step inside each), kept clear: nothing stands within
  // WAY metres of them (a walker's width and a little), so the front door leads to the back one past the furniture
  const WAY = 0.62;
  const ways = [];
  for (const r of rooms) {
    const pts = (A.doorways || []).filter((d) => inRoom(r, d.centre[0], d.centre[2], 0.5))
      .map((d) => { const o = d.inner ? (inRoom(r, d.centre[0] + d.out[0] * 0.6, d.centre[2] + d.out[2] * 0.6) ? 1 : -1) : -1; return [d.centre[0] + d.out[0] * 0.6 * o, d.centre[2] + d.out[2] * 0.6 * o]; });
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) ways.push([pts[i], pts[j]]);
  }
  const segD = (x, z, [[ax, az], [bx, bz]]) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
  const wayD = (x, z) => ways.reduce((m, w) => Math.min(m, segD(x, z, w)), Infinity);
  // (a box's corners and middle all clear of the ways)
  const boxClear = (x, z, hw, hd, rot = 0) => { const c = Math.cos(rot), sn = Math.sin(rot);
    return [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd], [hw, 0], [-hw, 0], [0, hd], [0, -hd]].every(([u, v]) => wayD(x + c * u + sn * v, z - sn * u + c * v) > WAY); };

  // THE TABLE AND CHAIRS: in the main room, where the table and its two chairs keep clear of the ways through: the
  // room's own table spot first, else nearer a wall; long side along x (rot 90) or along z (rot 0), the chairs on its
  // side toward the room's middle
  const used = bed === main ? [[bA.x, bA.z, 1.6]] : [];
  const m0 = mid(main);
  const tableAt = (x, z, along) => {   // (along: 'x' or 'z', its long side)
    const toMid = along === 'x' ? (z > m0.z ? -1 : 1) : (x > m0.x ? -1 : 1);
    const chairs = along === 'x' ? [[x - 0.32, z + toMid * 0.68, toMid > 0 ? 180 : 0], [x + 0.34, z + toMid * 0.66, toMid > 0 ? 195 : 15]]
      : [[x + toMid * 0.68, z - 0.32, toMid > 0 ? 270 : 90], [x + toMid * 0.66, z + 0.34, toMid > 0 ? 285 : 105]];
    return { x, z, along, chairs };
  };
  const tA = main.anchors.table || m0;
  const tCands = [];
  for (const [x, z] of [[tA.x, tA.z], [main.x0 + 0.95, m0.z], [main.x1 - 0.95, m0.z], [m0.x, main.z0 + 0.95], [m0.x, main.z1 - 0.95], [main.x0 + 0.95, main.z0 + 1.3], [main.x1 - 0.95, main.z0 + 1.3], [main.x0 + 0.95, main.z1 - 1.3], [main.x1 - 0.95, main.z1 - 1.3]])
    for (const along of ['x', 'z']) tCands.push(tableAt(x, z, along));
  const tableOk = (T) => boxClear(T.x, T.z, T.along === 'x' ? 0.6 : 0.4, T.along === 'x' ? 0.4 : 0.6) && T.chairs.every(([cx, cz]) => boxClear(cx, cz, 0.25, 0.25) && inRoom(main, cx, cz, -0.3))
    && inRoom(main, T.x, T.z, -0.7) && used.every(([ux, uz, r]) => Math.hypot(T.x - ux, T.z - uz) > r);
  const T = tCands.find(tableOk) || tCands[0];
  slots.table = { at: [+T.x.toFixed(2), null, +T.z.toFixed(2)], rot: T.along === 'x' ? 90 : 0, box: [0.8, 1.2], looks: [[T.x, y + 0.85, T.z]],
    extra: T.chairs.map(([cx, cz, r]) => ({ file: 'chair', at: [+cx.toFixed(2), null, +cz.toFixed(2)], rot: r, fitH: 0.96, box: [0.5, 0.5] })) };
  used.push([T.x, T.z, 1.5]);

  // THE STOVE: the main room's own stove spot, else a corner of it clear of the ways, the doors, the table and the bed
  const corners = [[main.x0 + 0.6, main.z0 + 0.6], [main.x1 - 0.6, main.z0 + 0.6], [main.x0 + 0.6, main.z1 - 0.6], [main.x1 - 0.6, main.z1 - 0.6]];
  const free = (x, z, m = 1.3) => clearOfDoors(x, z, m) && used.every(([ux, uz, r]) => Math.hypot(x - ux, z - uz) > r);
  let st = main.anchors.stove ? [main.anchors.stove.x, main.anchors.stove.z] : null;
  if (st) { const w = nearestWall(main, st[0], st[1]); st = [w.x - w.dir[0] * 0.55, w.z - w.dir[2] * 0.55]; }
  if (!st) st = corners.find(([x, z]) => free(x, z) && boxClear(x, z, 0.5, 0.5)) || corners.find(([x, z]) => free(x, z)) || corners[0];
  used.push([st[0], st[1], 1.15]);
  slots.stove = { at: [+st[0].toFixed(2), null, +st[1].toFixed(2)], rot: Math.round(Math.atan2(m0.x - st[0], m0.z - st[1]) * D), box: [0.85, 0.85], looks: [[st[0], y + 0.8, st[1]]] };

  // THE RUG: under the table
  slots.rug = { at: [+T.x.toFixed(2), null, +T.z.toFixed(2)], rot: T.along === 'x' ? 0 : 90, looks: [[T.x, y + 0.02, T.z]] };

  // THE DOG BEDS: three spots along a wall, clear of the ways, the doors and the rest: the main room first, else the
  // bedroom (by its fire)
  { let spots = null;
    for (const r of [main, bed].filter((q, i, a) => a.indexOf(q) === i)) {
      const cs = [[r.x0 + 0.6, r.z0 + 0.6], [r.x1 - 0.6, r.z0 + 0.6], [r.x0 + 0.6, r.z1 - 0.6], [r.x1 - 0.6, r.z1 - 0.6]];
      const m = mid(r), busy = r === bed && bed !== main ? [[bA.x, bA.z, 1.5]] : used;
      for (const [cx, cz] of cs) {
        for (const along of [[0, cz < m.z ? 1 : -1], [cx < m.x ? 1 : -1, 0]]) {
          const s3 = [0, 1, 2].map((i) => ({ x: +(cx + along[0] * i * 0.92).toFixed(2), z: +(cz + along[1] * i * 0.92).toFixed(2), rot: [0.5, 0.2, -0.3][i] }));
          if (s3.every((q) => inRoom(r, q.x, q.z, -0.3) && clearOfDoors(q.x, q.z, 1.1) && wayD(q.x, q.z) > WAY + 0.3 && busy.every(([ux, uz, rr]) => Math.hypot(q.x - ux, q.z - uz) > rr * 0.75))) { spots = s3; break; }
        }
        if (spots) break;
      }
      if (spots) break;
    }
    if (!spots) { const [cx, cz] = corners[0]; spots = [0, 1, 2].map((i) => ({ x: cx, z: +(cz + i * 0.95).toFixed(2), rot: 0 })); }
    slots.dogbeds = { at: [spots[0].x, null, spots[0].z], rot: 0, looks: spots.map((q) => [q.x, y + 0.08, q.z]), spots };
    used.push([spots[1].x, spots[1].z, 1.3]); }

  // THE RIFLE RACK: on the main room's free stretch of wall (its shelves spot), else the wall behind the table
  { const sA = main.anchors.shelves; const p = sA ? [sA.x, sA.z] : [T.x, T.z]; const w = nearestWall(main, p[0], p[1]);
    slots.rifles = { at: [w.x, y + 1.35, w.z], wall: w.dir, rot: 0, looks: [[w.x - w.dir[0] * 0.15, y + 1.35, w.z - w.dir[2] * 0.15]] }; }

  // THE LANTERNS: one over the table, one over the bed (hung 0.55 m under the ceiling)
  // (hung from the ceiling on their cords (0.36 m over the lamp): the lanterns' bottoms over 1.8 m up, clear of the
  // eyes of the player walking about in first person)
  { const ly = (r) => (r.ceil || y + 2.6) - 0.36;   // (r.ceil: the ceiling's height, the same frame as y)
    slots.lanterns = { at: [0, 0, 0], rot: 0, looks: [[T.x, ly(main), T.z], [bA.x, ly(bed), bA.z]] }; }

  // THE PORCH ROCKERS: either side of the way in, facing out (no porch: on the ground before the door)
  { const P = A.porch, out = [front.ox, front.oz], sideV = [out[1], -out[0]];
    let pts;
    if (P && P.x1 - P.x0 > 1.6) { const pz = (P.z0 + P.z1) / 2; pts = [[Math.max(P.x0 + 0.5, front.x - 1.15), pz], [Math.min(P.x1 - 0.5, front.x + 1.15), pz]]; }
    else pts = [-1, 1].map((k) => [front.x + out[0] * 1.6 + sideV[0] * 1.3 * k, front.z + out[1] * 1.6 + sideV[1] * 1.3 * k]);
    const rot = Math.round(Math.atan2(out[0], out[1]) * D);
    slots.porch = { at: [pts[0][0], null, pts[0][1]], rot: rot + 8, looks: pts.map(([x, z]) => [x, (P ? P.y : 0) + 0.5, z]), extra: [{ file: 'porch_chair', at: [pts[1][0], null, pts[1][1]], rot: rot - 8, fit: 0.83, box: null }] }; }

  // THE KEEPSAKES: on the walls, high, a metre and more apart, clear of the doorways; the counter bell on the table,
  // the safe door leaning by the stove, the strongbox on the floor against a wall
  const wallSpots = [];
  for (const r of [main, bed].filter((q, i, a) => a.indexOf(q) === i)) {
    const H = y + Math.min(1.75, (r.ceil || 3) - 1.05);
    for (const [dir, fixed, a0, a1, axis] of [[[0, 0, -1], r.z0, r.x0, r.x1, 'x'], [[-1, 0, 0], r.x0, r.z0, r.z1, 'z'], [[1, 0, 0], r.x1, r.z0, r.z1, 'z'], [[0, 0, 1], r.z1, r.x0, r.x1, 'x']]) {
      for (let a = a0 + 0.7; a <= a1 - 0.7; a += 1.05) {
        const x = axis === 'x' ? a : fixed, z = axis === 'x' ? fixed : a;
        if (!clearOfDoors(x, z, 1.0)) continue;
        if (Math.hypot(x - slots.picture.at[0], z - slots.picture.at[2]) < 1.0) continue;
        if (Math.hypot(x - slots.rifles.at[0], z - slots.rifles.at[2]) < 1.1) continue;
        wallSpots.push({ at: [+x.toFixed(2), +H.toFixed(2), +z.toFixed(2)], wall: dir });
      }
    }
  }
  const WALL_JOBS = ['cattle', 'sheep', 'pigs', 'bandits', 'deliveries', 'targets', 'tower', 'loads', 'fish'];
  const keepsakes = {};
  WALL_JOBS.forEach((j, i) => { const s = wallSpots[i % Math.max(1, wallSpots.length)]; if (s) keepsakes[j] = { at: s.at.slice(), wall: s.wall }; });
  keepsakes.orders = { at: [+(T.x + (T.along === 'x' ? 0.25 : 0.1)).toFixed(2), null, +(T.z + (T.along === 'x' ? -0.1 : 0.25)).toFixed(2)], table: 0.8, rot: -60 };
  { const w = nearestWall(main, st[0], st[1]), bx = st[0] + (w.dir[2] ? (st[0] < mid(main).x ? 0.95 : -0.95) : 0), bz = st[1] + (w.dir[0] ? (st[1] < mid(main).z ? 0.95 : -0.95) : 0);
    keepsakes.boxes = { at: [+bx.toFixed(2), null, +bz.toFixed(2)], rot: Math.round(Math.atan2(-w.dir[0], -w.dir[2]) * D) }; }
  { const w = nearestWall(bed, bA.x + (bed.x1 - bed.x0) * 0.3, bA.z); keepsakes.loot = { at: [+(w.x - w.dir[0] * 0.35).toFixed(2), null, +(w.z - w.dir[2] * 0.35 + (w.dir[0] ? 0.9 : 0)).toFixed(2)], rot: Math.round(Math.atan2(-w.dir[0], -w.dir[2]) * D) }; }

  // OUTSIDE: the dogs on the porch, the SOLD sign by the steps, where the dog that follows waits, the steps' foot
  const P = A.porch, out = [front.ox, front.oz], sideV = [out[1], -out[0]];
  const deck = P ? Math.max(Math.abs(P.z1 - front.z), Math.abs(P.x1 - front.x) * Math.abs(out[0])) : 0.6;
  const steps = { x: front.x + out[0] * (deck + 0.7), z: front.z + out[1] * (deck + 0.7) };
  const porchDogs = P ? [[front.x + sideV[0] * 0.9 + out[0] * 0.8, front.z + sideV[1] * 0.9 + out[1] * 0.8, 0.3], [front.x - sideV[0] * 0.9 + out[0] * 1.0, front.z - sideV[1] * 0.9 + out[1] * 1.0, -0.4], [front.x + sideV[0] * 1.6 + out[0] * 1.2, front.z + sideV[1] * 1.6 + out[1] * 1.2, 0.1]]
    : [-1, 0, 1].map((k) => [steps.x + sideV[0] * k * 1.1, steps.z + sideV[1] * k * 1.1, k * 0.3]);
  const sign = { x: steps.x + sideV[0] * 2.3, z: steps.z + sideV[1] * 2.3, rot: Math.atan2(out[0], out[1]) - 0.35 };
  const wait = { x: steps.x + sideV[0] * 1.7 + out[0] * 0.8, z: steps.z + sideV[1] * 1.7 + out[1] * 0.8 };
  return { main, bed, rooms, slots, keepsakes, bedSpots: slots.dogbeds.spots, porchDogs, sign, wait, front, steps };
}
