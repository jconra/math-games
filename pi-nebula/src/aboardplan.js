// WHO IS ABOARD A SHIP, THE PLAIN PART (src/aboard.js draws and moves them): every seat and bed of a ship's rooms as a
// place to sit or lie, read from the ship's own blueprint, and the way between two rooms through their doors. Nothing
// of three.js, so it is tested in Node (tests/aboard.test.mjs); nothing of any one ship: any boarded ship's blueprint.
//   placesOf(bp, { deck, cockpitFloor, jobs }) -> the places;  wayOf(bp, fromRoom, toRoom) -> the doors' middles
//   walkStep(walker, dt, player) -> 'walk' | 'there' | 'wait' | 'back';  inTheWay(at, to, player, waited, heading)
//   wayBack(passed, place) -> the way back to the place just left
export const SIT = ['seat', 'bench', 'chair', 'stool', 'sofa'], LIE = ['bunk', 'bed', 'berth', 'cot'];
// how they walk (m/s, radians a second), how near the player they come (m), how long they stay (s: sitting, lying),
// how near a place the player must be to be offered it (m); how long someone walking waits for the player in their
// way, the player still pressing on them, before they turn back (s: inTheWay); a bed's pad over its floor (m), a body's
// back under its middle lying (m), the feet from a bed's middle (m); a seat's front edge from its middle, where they
// stand to sit (m)
export const WALK = { speed: 1.05, turn: 4, room: 0.85, sit: [20, 45], lie: [45, 90], reach: 0.95, back: 1.0 };
export const BED = { pad: 0.42, back: 0.13, feet: 0.92 };
export const CLIP = { stand: 'Stand_Listen', sit: 'Sit_Listen', walk: 'Walk' };

// EVERY PLACE TO SIT OR LIE in a ship's rooms, in the ship's own frame (x to port, z to the nose, y up from its ground
// line), from its blueprint: [{ id, item, kind: 'sit' | 'lie', room, x, y, z, heading (sitting: the way they face;
// lying: the way the head is from the feet), job (the cockpit's seats: 'pilot', then the next of `jobs`), stand [x, z]
// (where to stand to sit or lie down: toward the room's nearest door) }]
export function placesOf(bp, { deck = 0, cockpitFloor = null, jobs = ['pilot', 'drill'] } = {}) {
  const out = [], rooms = new Map((bp.rooms || []).map((r) => [r.id, r])), items = bp.items || [];
  const tables = items.filter((it) => it.kind === 'table').map((it) => ({ room: it.room, x: (it.rect[0] + it.rect[2]) / 2, z: (it.rect[1] + it.rect[3]) / 2 }));
  const doorsOf = (room) => (bp.doors || []).filter((d) => d.rooms.includes(room) && !d.hatch);
  let cockpitN = 0;
  for (const it of items) {
    const sit = SIT.includes(it.kind), lie = LIE.includes(it.kind); if (!sit && !lie) continue;
    // (a step is not a seat: a bench that low is something to step on)
    if (sit && it.kind === 'bench' && (+it.h || 0.45) < 0.4) continue;
    const r = rooms.get(it.room); if (!r) continue;
    const [x0, z0, x1, z1] = it.rect, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const cockpit = r.kind === 'cockpit' || r.id === 'cockpit';
    const floor = deck + (cockpit && cockpitFloor != null ? cockpitFloor : (r.floor || 0));
    const doors = doorsOf(it.room), nearDoor = (x, z) => doors.reduce((b, q) => (!b || Math.hypot(q.at[0] - x, q.at[1] - z) < Math.hypot(b.at[0] - x, b.at[1] - z) ? q : b), null);
    const standOf = (x, z) => { const q = nearDoor(x, z); if (!q) return [x, z]; const dx = q.at[0] - x, dz = q.at[1] - z, L = Math.hypot(dx, dz) || 1, k = Math.min(0.62, L * 0.7); return [+(x + dx / L * k).toFixed(3), +(z + dz / L * k).toFixed(3)]; };
    if (sit) {
      // (facing: a cockpit's seats, the nose; else the nearest table in the room; else away from the nearest wall)
      let heading;
      const tb = tables.filter((t) => t.room === it.room).sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0];
      if (cockpit) heading = 0;
      else if (tb && Math.hypot(tb.x - cx, tb.z - cz) < 1.6) heading = Math.atan2(tb.x - cx, tb.z - cz);
      else { const [rx0, rz0, rx1, rz1] = r.rect, e = [[cx - rx0, Math.PI / 2], [rx1 - cx, -Math.PI / 2], [cz - rz0, 0], [rz1 - cz, Math.PI]].sort((a, b) => a[0] - b[0]); heading = e[0][1]; }
      // (a long bench seats more than one: a place each 0.6 m along it)
      const long = Math.max(w, d), n = it.kind === 'bench' ? Math.max(1, Math.floor(long / 0.6 + 1e-6)) : 1;
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n, x = w >= d ? x0 + w * f : cx, z = w >= d ? cz : z0 + d * f;
        const job = cockpit && it.kind === 'seat' ? (/pilot/i.test(it.name || '') && !/co-?pilot/i.test(it.name || '') ? 'pilot' : null) : null;
        out.push({ id: it.id + (n > 1 ? '.' + k : ''), item: it.id, name: it.name || it.kind, kind: 'sit', room: it.room, x: +x.toFixed(3), y: +floor.toFixed(3), z: +z.toFixed(3), heading, job, cockpit, stand: standOf(x, z) });
      }
      if (cockpit && it.kind === 'seat') cockpitN++;
    } else {
      // (a bed: its long way; its head at the end its plan names ("head": "low" / "high"), else the higher; a bunk's
      // lower berth only, the one a person lies on without a ladder)
      const alongX = w > d, hi = it.head !== 'low', heading = alongX ? (hi ? Math.PI / 2 : -Math.PI / 2) : (hi ? 0 : Math.PI);
      out.push({ id: it.id, item: it.id, name: it.name || it.kind, kind: 'lie', room: it.room, x: +cx.toFixed(3), y: +(floor + (it.kind === 'bunk' ? BED.pad : +it.top || 0.5)).toFixed(3), z: +cz.toFixed(3), heading, job: null, stand: standOf(cx, cz) });
    }
  }
  // (the cockpit's seats with no job by name: the pilot's first if none is named, then the next job in turn)
  const cs = out.filter((p) => p.cockpit && p.kind === 'sit' && SIT.includes((items.find((it) => it.id === p.item) || {}).kind) && (items.find((it) => it.id === p.item) || {}).kind === 'seat');
  if (cs.length && !cs.some((p) => p.job === 'pilot')) cs[0].job = 'pilot';
  let j = 1; for (const p of cs) if (!p.job && j < jobs.length) p.job = jobs[j++];
  return out;
}
// THE WAY between two rooms, through their doors (the rooms' own graph): the doors' middles in turn, or null
export function wayOf(bp, from, to) {
  if (from === to) return [];
  const doors = (bp.doors || []).filter((d) => !d.hatch && d.rooms.every((r) => r !== 'outside')), seen = new Map([[from, null]]), q = [from];
  while (q.length) { const r = q.shift(); if (r === to) break; for (const d of doors) if (d.rooms.includes(r)) { const o = d.rooms.find((x) => x !== r); if (!seen.has(o)) { seen.set(o, { d, r }); q.push(o); } } }
  if (!seen.has(to)) return null;
  const out = []; for (let r = to; seen.get(r); r = seen.get(r).r) out.unshift(seen.get(r).d.at.slice());
  return out;
}
// THE PLAYER IN THE WAY of someone walking aboard ("never nearer than WALK.room to the player": they wait for the player
// to pass). at: where they are; to: the point they are walking to next; player: where the player is (each { x, z }, the
// ship's own frame); waited: how long they have waited for the player already (s); heading: the way they face (for a
// moment with no way to go). -> null: walk on; 'wait': the player near and ahead of them along their way; 'back': and
// still pressing on them, nearer than WALK.room, after WALK.back seconds of waiting. A ship's passages are too narrow for
// the player to get round someone standing in them (the Miner's mess, past its table, is 0.75 m), so then they turn
// back to the place they just left and are out of the way there (wayBack)
export function inTheWay(at, to, player, waited = 0, heading = 0) {
  if (!player) return null;
  const px = player.x - at.x, pz = player.z - at.z, d = Math.hypot(px, pz);
  if (d >= WALK.room + 0.5) return null;
  const vx = to.x - at.x, vz = to.z - at.z, L = Math.hypot(vx, vz);
  const ax = L > 0.05 ? vx / L : Math.sin(heading), az = L > 0.05 ? vz / L : Math.cos(heading);
  if (px * ax + pz * az <= 0) return null;
  return d < WALK.room && waited >= WALK.back ? 'back' : 'wait';
}
// ONE STEP OF SOMEONE WALKING ABOARD (src/aboard.js, each frame), in the ship's own frame: W { pos, heading, way, leg,
// wait, target } (pos and the way's points { x, z }; target: the place the way goes to); player: { x, z }, or null.
// Turned toward the next point of the way and on along it at WALK.speed (slower while turned far from it) -> 'walk';
// 'there': the way's end reached; or the player in the way (inTheWay): 'wait', or 'back' (src/aboard.js turns them
// back, or they wait), no step taken. The last step, from where one stands by a seat onto it, is never waited over:
// sitting down takes them out of the way (a seat is beside the way through, never on it)
export function walkStep(W, dt, player = null) {
  const to = W.way[W.leg], vx = to.x - W.pos.x, vz = to.z - W.pos.z, L = Math.hypot(vx, vz);
  const want = Math.atan2(vx, vz), diff = Math.atan2(Math.sin(want - W.heading), Math.cos(want - W.heading));
  W.heading += Math.sign(diff) * Math.min(Math.abs(diff), WALK.turn * dt);
  const sitting = !!W.target && W.target.kind === 'sit' && W.leg === W.way.length - 1;
  const ahead = sitting ? null : inTheWay(W.pos, to, player, W.wait, W.heading);
  if (ahead) return ahead;
  W.wait = 0;
  const step = Math.min(L, WALK.speed * dt * (Math.abs(diff) > 1 ? 0.3 : 1));
  if (L > 1e-4) { W.pos.x += vx / L * step; W.pos.z += vz / L * step; }
  if (L - step < 0.05) { W.leg++; if (W.leg >= W.way.length) return 'there'; }
  return 'walk';
}
// THE WAY BACK to the place just left: the points of the way already passed ([x, z] each, in the order walked), the
// last first, down to where one stands by that place; a seat is sat down on from there (as on the way out to a place)
export function wayBack(passed, p) {
  return [...passed.slice().reverse(), ...(p.kind === 'sit' ? [[p.x, p.z]] : [])];
}
