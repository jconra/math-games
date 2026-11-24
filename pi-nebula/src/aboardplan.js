// WHO IS ABOARD A SHIP, THE PLAIN PART (src/aboard.js draws and moves them): every seat and bed of a ship's rooms as a
// place to sit or lie, read from the ship's own blueprint, and the way between two rooms through their doors. Nothing
// of three.js, so it is tested in Node (tests/aboard.test.mjs); nothing of any one ship: any boarded ship's blueprint.
//   placesOf(bp, { deck, cockpitFloor, jobs }) -> the places;  wayOf(bp, fromRoom, toRoom) -> the doors' middles
//   walkStep(walker, dt, player, { others, free, wall }) -> 'walk' | 'there' | 'wait' | 'aside' | 'back'
//   inTheWay(at, to, player, waited, heading);  wayBack(passed, place) -> the way back to the place just left
//   floorOf(bp, r) -> free(x, z): the blueprint's own floor for a body of half width r (free.r; the rooms, their doors,
//   round the furniture), for Node; the game asks its walls (src/aboard.js)
import { PASS, roomAt, roomFor, squeezeFor, sideOn, overlaps, bumps, facing } from './passing.js';
export const SIT = ['seat', 'bench', 'chair', 'stool', 'sofa'], LIE = ['bunk', 'bed', 'berth', 'cot'];
// how they walk (m/s, radians a second), how near the player they wait for them in a passage too narrow to pass (m),
// how long they stay (s: sitting, lying), how near a place the player must be to be offered it (m); how long someone
// walking waits for the player in their way, the player still pressing on them, before they turn back (s: inTheWay);
// how fast they step aside, making room to pass (m/s), how long they keep out of the way making way (s: walkStep); a
// bed's pad over its floor (m), a body's back under its middle
// lying (m), the feet from a bed's middle (m); a seat's front edge from its middle, where they stand to sit (m)
export const WALK = { speed: 1.05, turn: 4, room: 0.85, sit: [20, 45], lie: [45, 90], reach: 0.95, back: 1.0, side: 0.6, give: 1.5 };
export const BED = { pad: 0.42, back: 0.13, feet: 0.92 };
// (side: stepping sideways, turned side-on to squeeze past someone: to the body's left, to its right; at sideSpeed)
export const CLIP = { stand: 'Stand_Listen', sit: 'Sit_Listen', walk: 'Walk', side: ['Run_Left', 'Run_Right'], sideSpeed: 0.4 };
// A STOOL AT A WORKTOP (one seat standing against a counter, no table by it: the Medic's lab stool; the game's maker,
// 2026-11-23: the rescued sit on "stools"). The kit stands it tucked in at the worktop's knee space, turned to the
// worktop, a backrest behind, its seat higher than a chair's (kit/ships/medic-furnish.js furnishLab, `W.depth + 0.14`;
// kit/shipparts/cabin/lab.js labStool, 0.62 m). Whoever sits there sits on it as it is drawn, at work at the worktop
// (faced away from the wall, as a seat with no table is, they sat 11 cm off it and 17 cm down in it, its backrest in
// their belly). out: its middle from the worktop's front edge (m); seat: its seat's height; chair: the height the
// sitting clip sits at (a chair's: the crew room's stools, kit/shipparts/cabin/mess.js stool). A place there carries
// `up`: how far over a chair's its sitter is drawn (src/aboard.js, src/rescued.js; the floor they walk on is still y)
export const AT_COUNTER = { out: 0.14, seat: 0.62, chair: 0.45 };

// EVERY PLACE TO SIT OR LIE in a ship's rooms, in the ship's own frame (x to port, z to the nose, y up from its ground
// line), from its blueprint: [{ id, item, kind: 'sit' | 'lie', room, x, y, z, heading (sitting: the way they face;
// lying: the way the head is from the feet), job (the cockpit's seats: 'pilot', then the next of `jobs`), stand [x, z]
// (where to stand to sit or lie down: toward the room's nearest door) }]
export function placesOf(bp, { deck = 0, cockpitFloor = null, jobs = ['pilot', 'drill'] } = {}) {
  const out = [], rooms = new Map((bp.rooms || []).map((r) => [r.id, r])), items = bp.items || [];
  const tables = items.filter((it) => it.kind === 'table').map((it) => ({ room: it.room, x: (it.rect[0] + it.rect[2]) / 2, z: (it.rect[1] + it.rect[3]) / 2 }));
  // (the counter a seat stands against, its rect sharing an edge with the counter's: where its stool is tucked in (its
  // middle AT_COUNTER.out from that edge, where the seat is along it) and the way to the counter)
  const counterAt = (it) => {
    const [x0, z0, x1, z1] = it.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, o = AT_COUNTER.out, E = 0.011;
    for (const c of items) {
      if (c.kind !== 'counter' || c.room !== it.room) continue;
      const [a0, b0, a1, b1] = c.rect, alongZ = Math.min(z1, b1) - Math.max(z0, b0) > 0.1, alongX = Math.min(x1, a1) - Math.max(x0, a0) > 0.1;
      if (alongZ && Math.abs(x0 - a1) < E) return { x: a1 + o, z: cz, heading: -Math.PI / 2 };
      if (alongZ && Math.abs(x1 - a0) < E) return { x: a0 - o, z: cz, heading: Math.PI / 2 };
      if (alongX && Math.abs(z0 - b1) < E) return { x: cx, z: b1 + o, heading: Math.PI };
      if (alongX && Math.abs(z1 - b0) < E) return { x: cx, z: b0 - o, heading: 0 };
    }
    return null;
  };
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
      // (facing: a cockpit's seats, the nose; else the nearest table in the room; else the worktop it stands against;
      // else away from the nearest wall)
      let heading, at = null;
      const tb = tables.filter((t) => t.room === it.room).sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0];
      if (cockpit) heading = 0;
      else if (tb && Math.hypot(tb.x - cx, tb.z - cz) < 1.6) heading = Math.atan2(tb.x - cx, tb.z - cz);
      else if (Math.max(w, d) < 1.2 - 1e-6 && (at = counterAt(it))) heading = at.heading;
      else { const [rx0, rz0, rx1, rz1] = r.rect, e = [[cx - rx0, Math.PI / 2], [rx1 - cx, -Math.PI / 2], [cz - rz0, 0], [rz1 - cz, Math.PI]].sort((a, b) => a[0] - b[0]); heading = e[0][1]; }
      // (a long bench seats more than one: a place each 0.6 m along it)
      const long = Math.max(w, d), n = it.kind === 'bench' ? Math.max(1, Math.floor(long / 0.6 + 1e-6)) : 1;
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n, x = at ? at.x : w >= d ? x0 + w * f : cx, z = at ? at.z : w >= d ? cz : z0 + d * f;
        const job = cockpit && it.kind === 'seat' ? (/pilot/i.test(it.name || '') && !/co-?pilot/i.test(it.name || '') ? 'pilot' : null) : null;
        out.push({ id: it.id + (n > 1 ? '.' + k : ''), item: it.id, name: it.name || it.kind, kind: 'sit', room: it.room, x: +x.toFixed(3), y: +floor.toFixed(3), z: +z.toFixed(3), heading, job, cockpit, stand: standOf(x, z), ...(at ? { up: +(AT_COUNTER.seat - AT_COUNTER.chair).toFixed(3) } : {}) });
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
// THE PLAYER IN THE WAY of someone walking aboard, where the floor is too narrow for two to pass (walkStep: they wait
// for the player to pass). at: where they are; to: the point they are walking to next; player: where the player is
// (each { x, z }, the ship's own frame); waited: how long they have waited for the player already (s); heading: the way
// they face (for a moment with no way to go). -> null: walk on; 'wait': the player near and ahead of them along their
// way; 'back': and still pressing on them, nearer than WALK.room, after WALK.back seconds of waiting. Where it is too
// narrow there is no getting round someone standing in it (the Miner's mess, past its table, is 0.75 m between the
// table and the counter: 0.38 to 0.41 m for two bodies' middles, as the cabin's walls are felt, under PASS.apart), so
// then they turn back to the place they just left and are out of the way there (wayBack)
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
// wait, target, getUp } (pos and the way's points { x, z }; target: the place the way goes to; getUp: the way starts at
// the place they are leaving); player: { x, z }, or null; others: the rest aboard ({ x, z, walking, heading, held: held
// up just now, first: earlier in the list than W }); free(x, z): can a body stand there (the cabin's walls; null:
// anywhere); wall: how near the walls let a body's middle (m: the cabin's own, src/boarding.js CABIN_WALLS.r; free.r).
// Turned toward the next point of the way and on along it at WALK.speed (slower while turned far from it) -> 'walk';
// 'there': the way's end reached; 'wait': no step taken; 'aside': a step back out of someone's way, making way (W.wait
// goes on counting); 'back': src/aboard.js turns them back (or they wait).
//   - NEVER NEARER THAN PASS.apart to anyone (passing.js), but squeezing past (below): a step that would be is not taken.
//     Overlapping anyone (nearer than PASS.apart), at half speed (PASS.slow).
//   - MET HEAD ON (the player in their lane ahead, or another of the crew walking at them), where the floor across is
//     wide enough for two as a real pair would find it (passing.js roomFor: 0.62 m for the two middles where the walls
//     let a body as near as 0.15 m: the Miner's airlock, not its bunks' aisle nor a door): a step to their own right
//     at WALK.side, until the one met is PASS.comfy to their left or the floor runs out (the player coming down their
//     right side already: to their left), and on past them. Wide enough all the way from just behind them to just past
//     the one met, so they come alongside where it is (not in a door, nor the mouth of one); the player standing still,
//     just round where they stand.
//   - WHERE IT IS TOO NARROW FOR TWO TO PASS FORWARD (the Miner's mess past its table, its bunks' aisle, its doors):
//     they squeeze past (the game's maker, 2026-11-21): a step to the side of the passage as above, turned side-on
//     facing the one met from PASS.turnAt off (W.side), and on past them, their middles as near as PASS.squeeze.
//   - WHERE EVEN A SQUEEZE DOES NOT FIT (the floor across under squeezeFor for the two middles: nowhere in the Miner): as
//     before, they wait for the player to pass (inTheWay) and, still pressed on after a moment, turn back ('back'); two
//     of the crew so met: the one later in the list turns back after WALK.back, the other after three times that.
//     Held up against the one met where it looked wide enough (the player standing square in a narrow place, say),
//     after twice the while: turned back the same way.
//   - MAKING WAY ('aside'): two of the crew each in the other's way, not head on (off the same bunks for the same door),
//     the later in the list steps back out of it for WALK.give seconds; held up against the player two seconds, the same.
// The walls (free) are asked only of a step aside: on along the way they walk as ever. Getting up from a place, the last
// step onto a seat, and any step from or toward a point where a body is not free (the spot one stands at by a bunk is
// in its edge) make no room (met there, they wait), and the last step onto a seat is never waited over: sitting down
// takes them out of the way (a seat is beside the way through, never on it).
export function walkStep(W, dt, player = null, { others = [], free = null, wall = (free && free.r) || 0.15 } = {}) {
  // (a point of the way they are at already (turned back just past it), or passed abreast, stepped aside to make room
  // beside it: on to the next)
  let to = W.way[W.leg];
  while (W.leg < W.way.length - 1 && Math.hypot(to.x - W.pos.x, to.z - W.pos.z) < 0.06) to = W.way[++W.leg];
  if (W.leg > 0 && W.leg < W.way.length - 1) {
    const a = W.way[W.leg - 1], lx = to.x - a.x, lz = to.z - a.z, ll = Math.hypot(lx, lz), px = W.pos.x - to.x, pz = W.pos.z - to.z, side = ll > 1e-6 ? Math.abs(px * -lz + pz * lx) / ll : 0;
    if (ll > 1e-6 && (px * lx + pz * lz) / ll >= 0 && side > 0.04 && side < 0.5) { W.leg++; to = W.way[W.leg]; }
  }
  const vx = to.x - W.pos.x, vz = to.z - W.pos.z, L = Math.hypot(vx, vz);
  const want = Math.atan2(vx, vz), diff = Math.atan2(Math.sin(want - W.heading), Math.cos(want - W.heading));
  W.heading += Math.sign(diff) * Math.min(Math.abs(diff), WALK.turn * dt);
  const sitting = !!W.target && W.target.kind === 'sit' && W.leg === W.way.length - 1;
  // (where one stands by a bunk, or by a bench just through a door, is in the furniture's or the door frame's edge, as the
  // walls feel a body: from anywhere not free, or to such a point, the steps are not asked)
  const loose = sitting || (W.leg === 0 && !!W.getUp) || (!!free && (!free(W.pos.x, W.pos.z) || !free(to.x, to.z))), ok = !free || loose ? () => true : free;
  const ux = L > 0.05 ? vx / L : Math.sin(W.heading), uz = L > 0.05 ? vz / L : Math.cos(W.heading);
  // (ahead, and to one's right, along the way itself (the leg from the point before): stepped aside off it, the way
  // still runs where it did, while the straight line to its next point has turned)
  const p0 = W.leg > 0 ? W.way[W.leg - 1] : null, ll = p0 ? Math.hypot(to.x - p0.x, to.z - p0.z) : 0;
  const ax = ll > 0.05 ? (to.x - p0.x) / ll : ux, az = ll > 0.05 ? (to.z - p0.z) / ll : uz, sx = -az, sz = ax, myH = Math.atan2(ax, az);
  const bodies = player ? [player, ...others] : others;
  // (how fast the player comes toward them along the way, from where they were a step ago: + coming, 0 standing, -
  // walking on ahead of them)
  const pv = player && W.seen && dt > 0 ? -((player.x - W.seen.x) * ax + (player.z - W.seen.z) * az) / dt : 0;
  W.seen = player ? { x: player.x, z: player.z } : null;
  // (making way for a while (below): only that, till it is over)
  if (W.giving > 0) { W.giving -= dt; return makeWay(W, dt, bodies, free) ? 'aside' : 'wait'; }
  // met head on: the player in the lane ahead (not walking on ahead of them), or another walking at them (the nearest),
  // from PASS.meet ahead
  let met = null;
  if (!sitting) for (const o of bodies) {
    const ox = o.x - W.pos.x, oz = o.z - W.pos.z, ahead = ox * ax + oz * az, lat = ox * sx + oz * sz;
    if (ahead <= 0 || ahead > PASS.meet || Math.abs(lat) > PASS.lane[1]) continue;
    // (another of the crew: walking at them; or, near (PASS.turnAt), walking any way but theirs: two coming at the same
    // door turn toward its middle, across each other's way)
    const d = Math.hypot(ox, oz);
    if (o === player ? pv < -0.2 : !(o.walking && (facing(o.heading, myH) || (d < PASS.turnAt && Math.cos(o.heading - myH) < 0.3)))) continue;
    if (!met || d < met.d) met = { o, ahead, lat, d, player: o === player, v: o === player ? Math.max(0, pv) : WALK.speed };
  }
  // (room for two to pass: the floor across wide enough for their two middles, PASS.apart either way along the way
  // from where they will come alongside (as far along as they walk at each other: where the player stands, if they stand
  // still), so they come alongside where it is: a door, or the mouth of one, is no room)
  // (felt every 3 cm across and every 15 cm along: a cabin's walls are 5 cm voxels; a phone asks it a few hundred times
  // a frame at most, and only while someone is met)
  const need = roomFor(wall), wideAt = (x, z) => { const [l, r] = roomAt(x, z, sx, sz, ok, need, 0.03); return l + r >= need - 0.03; };
  // (felt from the way's own line, abreast of them: stepped aside already, they may stand by a door's mouth that the
  // way goes through the middle of)
  const along = p0 ? (W.pos.x - p0.x) * ax + (W.pos.z - p0.z) * az : 0, ox = p0 ? p0.x + ax * along : W.pos.x, oz = p0 ? p0.z + az * along : W.pos.z;
  const wide = (lo, hi) => { for (let t = lo; t <= hi + 1e-9; t += 0.15) if (!wideAt(ox + ax * t, oz + az * t)) return false; return wideAt(ox + ax * hi, oz + az * hi); };
  const at = met ? met.ahead * WALK.speed / (WALK.speed + met.v) : 0;
  // (getting up, or sitting down: in the furniture, no room made; met then, they wait as before)
  const lo = met ? Math.max(-PASS.apart, at - PASS.apart) : 0, hi = met ? Math.min(met.ahead + PASS.apart, at + PASS.apart) : 0;
  const room = !met || (!loose && wide(lo, hi));
  // TOO NARROW FOR TWO TO PASS FORWARD: they squeeze past each other (the game's maker, 2026-11-21: "In the narrow places
  // too, he turns side-on and you squeeze past each other"), their middles as near as PASS.squeeze, wherever the floor
  // across leaves the two middles that (squeezeFor: the Miner's mess past its table, its bunks' aisle, its doors all
  // do); getting up or sitting down, in the furniture's edge where the floor is not felt, as well
  // (felt from the way's line, or, where it runs through a table's corner, from the free floor nearest it across)
  const needS = squeezeFor(), wideS = (x, z) => {
    for (let k = 0; k <= 0.45 + 1e-9; k += 0.03) for (const g of k ? [1, -1] : [1]) {
      const px = x + sx * k * g, pz = z + sz * k * g; if (!ok(px, pz)) continue;
      const [l, r] = roomAt(px, pz, sx, sz, ok, needS, 0.03); return l + r >= needS - 0.03;
    }
    return false;
  };
  let squeeze = !room && loose;
  if (!room && !loose) { squeeze = true; for (let t = lo; t <= hi + 1e-9; t += 0.15) if (!wideS(ox + ax * t, oz + az * t)) { squeeze = false; break; } }
  // (squeezing past, or still turned side-on from a squeeze till PASS.turnOff apart again: the middles as near as
  // PASS.squeeze)
  const apart = squeeze || W.sideAim ? PASS.squeeze : PASS.apart;
  // (turned side-on, facing the one met, from PASS.turnAt off; so till they are PASS.turnOff apart again: W.side, the
  // turn from the way walked, + to their left, eased round; src/aboard.js draws it)
  if (squeeze && met.d < PASS.turnAt) { if (!W.sideAim) W.sideAim = sideOn(met.lat); }
  else if (W.sideAim) { const by = nearestOf(W.pos, bodies); if (!by || by.d > PASS.turnOff) W.sideAim = 0; }
  const sd = (W.sideAim || 0) - (W.side || 0); W.side = (W.side || 0) + Math.sign(sd) * Math.min(Math.abs(sd), 5 * dt);
  // (where even a squeeze does not fit: they wait for them as before, and turn back; ahead along the way itself, as they
  // are not always on its line: kept off the furniture it passes close by, or held up beside it)
  // (the player beside the way, not on it: from here to its next point they are never walked within PASS.apart of)
  if (!room && !squeeze) {
    if (met.player && segGap(player, W.pos, to) < PASS.apart + PASS.spare) { const r = inTheWay(W.pos, { x: W.pos.x + ax, z: W.pos.z + az }, player, W.wait, W.heading); if (r) return r; }
    else if (!met.player && met.d < WALK.room + 0.5) return W.wait >= WALK.back * (met.o.first ? 1 : 3) ? 'back' : 'wait';
  }
  let moved = 0; const x0 = W.pos.x, z0 = W.pos.z;
  // (their bodies overlapping anyone's (middles nearer than PASS.apart): every step at half speed, PASS.slow)
  const pace = overlaps(W.pos.x, W.pos.z, bodies) ? PASS.slow : 1;
  // making room: a step to their own right (or left, the player coming down their right already), till the one met is
  // PASS.comfy the other side, as far as the floor goes (one met clear on their right already is passed as they are);
  // squeezing, to the side of the passage the same way, as far as it goes
  if (met && (room || (squeeze && !loose)) && !(!met.player && met.lat >= PASS.apart)) {
    // (squeezing: only till the one met is PASS.apart to the side, as far as the floor goes; one already that far off
    // the way, beside it rather than in it, is gone by as they are)
    const g = met.player && met.lat > PASS.wrong ? -1 : 1, off = room ? PASS.comfy : PASS.apart, need = g > 0 ? met.lat + off : off - met.lat;
    if (need > 0) {
      const s = Math.min(need, WALK.side * dt * pace), nx = W.pos.x + sx * g * s, nz = W.pos.z + sz * g * s;
      if (ok(nx, nz) && !bumps(W.pos.x, W.pos.z, nx, nz, bodies, undefined, apart)) { W.pos.x = nx; W.pos.z = nz; moved += s; }
    }
  }
  // on toward the way's next point (slower with someone met close ahead), as ever: straight, the walls not asked (the way
  // is the doors' middles and the places, drawn straight, through a table's corner as before), never nearer anyone than
  // PASS.apart; stepped aside, back toward the way's line as they go on
  const step = Math.min(L, WALK.speed * dt * (Math.abs(diff) > 1 ? 0.3 : 1) * (met && met.ahead < 1.2 ? 0.6 : 1) * pace);
  // (that straight step into someone beside it (the player stood by the lift as they come by): along the way itself
  // instead, or a little round, where the floor is free)
  if (step > 1e-5) {
    const tries = [[ux, uz, false], [ax, az, true]];
    for (const a of [0.4, -0.4, 0.8, -0.8]) tries.push([ux * Math.cos(a) - uz * Math.sin(a), uz * Math.cos(a) + ux * Math.sin(a), true]);
    for (const [dx, dz, asked] of tries) {
      const nx = W.pos.x + dx * step, nz = W.pos.z + dz * step;
      if ((asked && (!free || !ok(nx, nz))) || bumps(W.pos.x, W.pos.z, nx, nz, bodies, undefined, apart)) continue;
      W.pos.x = nx; W.pos.z = nz; moved += step; break;
    }
  }
  // (overlapping: the step aside and the step on together no further than half speed, PASS.slow; the two can point
  // much the same way)
  if (pace < 1) {
    const got = Math.hypot(W.pos.x - x0, W.pos.z - z0), most = WALK.speed * pace * dt;
    if (got > most + 1e-9) { const k = most / got, nx = x0 + (W.pos.x - x0) * k, nz = z0 + (W.pos.z - z0) * k; if (bumps(x0, z0, nx, nz, bodies, undefined, apart)) { W.pos.x = x0; W.pos.z = z0; moved = 0; } else { W.pos.x = nx; W.pos.z = nz; moved = most; } }
  }
  if (Math.hypot(to.x - W.pos.x, to.z - W.pos.z) < 0.05) { W.leg++; W.getUp = false; if (W.leg >= W.way.length) return 'there'; }
  if (moved > 1e-6) { W.wait = 0; return 'walk'; }
  // (held up against the one met though it looked wide enough (they came alongside where it narrows): after twice the
  // while, turned back as where it is too narrow)
  if (met && met.d < PASS.apart + 0.15 && W.wait >= WALK.back * (met.player ? 2 : met.o.first ? 2 : 4)) return 'back';
  // MAKING WAY, held up against someone who is held up by them (two of the crew each in the other's way, going the same
  // way or across: neither met head on): the one later in the list steps back from the other, where the floor is free,
  // so the other can go on; and anyone held up against the player a good while steps back from them the same way (the
  // player is not steered: it is the crew who make way)
  const by = nearestOf(W.pos, bodies);
  if (by && by.d < PASS.apart + 0.05 && (by.o === player ? W.wait > 2 * WALK.back : (by.o.first && by.o.held && W.wait > 0.5 * WALK.back))) { W.giving = WALK.give; return makeWay(W, dt, bodies, free) ? 'aside' : 'wait'; }
  return 'wait';
}
// (making way: for WALK.give seconds no step on along their way, a step back from whoever is nearest while they are
// near, where the floor is free; -> moved)
function makeWay(W, dt, bodies, free) {
  const by = nearestOf(W.pos, bodies);
  if (!by || by.d > PASS.apart + 0.35) return false;
  // (overlapping anyone, at half speed as every step)
  const s = WALK.side * dt * (overlaps(W.pos.x, W.pos.z, bodies) ? PASS.slow : 1), gx = (W.pos.x - by.o.x) / (by.d || 1), gz = (W.pos.z - by.o.z) / (by.d || 1);
  for (const a of [0, 0.6, -0.6, 1.2, -1.2, 1.57, -1.57]) {
    const dx = gx * Math.cos(a) - gz * Math.sin(a), dz = gz * Math.cos(a) + gx * Math.sin(a), nx = W.pos.x + dx * s, nz = W.pos.z + dz * s;
    if ((free && !free(nx, nz)) || bumps(W.pos.x, W.pos.z, nx, nz, bodies)) continue;
    W.pos.x = nx; W.pos.z = nz; return true;
  }
  return false;
}
// (the nearest of some bodies to a point: { o, d }, or null)
function nearestOf(p, bodies) {
  let best = null;
  for (const o of bodies) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (!best || d < best.d) best = { o, d }; }
  return best;
}
// (how near a point comes to the straight walk from a to b)
function segGap(p, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz, t = L2 > 1e-9 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / L2)) : 0;
  return Math.hypot(p.x - a.x - vx * t, p.z - a.z - vz * t);
}
// THE BLUEPRINT'S OWN FLOOR (for Node, where there are no walls to ask): a body whose middle is at (x, z), r across each
// way, stands in a room clear of its edges, or in a door's opening between two rooms, and clear of every piece of
// furniture (low or high: the game's walls stop a person at a bench as at a locker). The cabin's walls as the game
// feels them are a voxel or so thicker than the plan's lines: CABIN_WALLS.r (0.15) and 3 cm give the Miner's mess past
// its table 0.39 m for a body's middle, where the game measures 0.38 to 0.41 (rigs/passing-1/cabin.cjs).
export function floorOf(bp, r = 0.18, frame = 0.1) {
  const rooms = bp.rooms || [], items = (bp.items || []).filter((it) => it.kind !== 'overhead' && rooms.some((q) => q.id === it.room));
  const byId = new Map(rooms.map((q) => [q.id, q]));
  // (a door's opening: its width less its frame, across the wall it is in (the wall the two rooms share: along x when
  // one ends in z where the other begins), and through that wall into either room)
  const doors = (bp.doors || []).filter((d) => !d.hatch && d.rooms.every((q) => byId.has(q))).map((d) => {
    const [A, B] = d.rooms.map((q) => byId.get(q).rect);
    return { at: d.at, half: d.width / 2 - frame - r, alongX: Math.abs(A[3] - B[1]) < 1e-6 || Math.abs(A[1] - B[3]) < 1e-6 };
  });
  const free = (x, z) => {
    let inRoom = rooms.some((q) => x >= q.rect[0] + r && x <= q.rect[2] - r && z >= q.rect[1] + r && z <= q.rect[3] - r);
    if (!inRoom) inRoom = doors.some((d) => (d.alongX ? Math.abs(x - d.at[0]) <= d.half && Math.abs(z - d.at[1]) <= r + 0.05 : Math.abs(z - d.at[1]) <= d.half && Math.abs(x - d.at[0]) <= r + 0.05));
    if (!inRoom) return false;
    return !items.some((it) => x > it.rect[0] - r && x < it.rect[2] + r && z > it.rect[1] - r && z < it.rect[3] + r);
  };
  free.r = r;      // (how near its walls let a body's middle: walkStep's `wall`)
  return free;
}
// THE WAY BACK to the place just left: the points of the way already passed ([x, z] each, in the order walked), the
// last first, down to where one stands by that place; a seat is sat down on from there (as on the way out to a place)
export function wayBack(passed, p) {
  return [...passed.slice().reverse(), ...(p.kind === 'sit' ? [[p.x, p.z]] : [])];
}
