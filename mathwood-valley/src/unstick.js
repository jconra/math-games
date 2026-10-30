// "I'M STUCK: MOVE ME" (the menu's button, src/main.js openMenu): the rider (and the horse, if ridden) moved at once to
// the nearest safe open spot, with no penalty. The game keeps a short trail of good spots as the rider goes about:
// a place the rider stood at freely (on the ground, not inside anything that blocks, not in water, with room all round),
// taken once a second and kept when it is a couple of metres on from the last one. Unstuck, the rider goes back to the
// newest of those still good and not right where they stand now (stuck at a spot that looks open, the same spot is no
// help); with none, to the nearest building's door (the spot on the ground in front of its steps); with none of those
// good either, to the town square. Indoors it works the same: the trail runs through the room and in at its door.
//
//   const U = makeUnstick({ blocked, wet })   blocked(x, z): true where a walker can't go (src/world.js W.blocked);
//                                             wet(x, z): true in a stream or pond (W.waterAt(x, z) > 0.3)
//   U.update(dt, { x, z }, ok)   each frame of play; ok false (working a counter, inside the cabin, mounting) skips it
//   U.pick({ x, z }, { doors, square, room })   the spot to move to: { x, z, from: 'trail'|'door'|'square' } (room: the
//                                             open ground it needs all round, more for a horse)
//   U.trail                      the good spots kept, oldest first
//   U.clear()                    a fresh trail (a teleport across the valley: the old spots are far behind)
//   goodSpot(x, z, { blocked, wet, room })   the test a spot passes to be kept or used (exported for the tests)

export const UNSTICK = {
  every: 1,      // s between looks at where the rider stands
  apart: 2,      // m on from the last kept spot before another is kept
  keep: 12,      // spots in the trail
  room: 0.8,     // m of open ground all round a good spot (a horse needs its length: checked at both ends)
  away: 1.5,     // m: a trail spot nearer than this to where the rider is stuck is skipped
};

export function goodSpot(x, z, { blocked, wet = () => false, room = UNSTICK.room } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || blocked(x, z) || wet(x, z)) return false;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, px = x + Math.sin(a) * room, pz = z + Math.cos(a) * room;
    if (blocked(px, pz) || wet(px, pz)) return false;
  }
  return true;
}

export function makeUnstick({ blocked, wet = () => false, room = UNSTICK.room } = {}) {
  const U = { trail: [] };
  let t = 0;
  const good = (x, z, r = room) => goodSpot(x, z, { blocked, wet, room: r });
  U.update = (dt, at, ok = true) => {
    if (!ok || !at) { t = 0; return; }
    if ((t += dt) < UNSTICK.every) return;
    t = 0;
    const last = U.trail[U.trail.length - 1];
    if (last && Math.hypot(at.x - last.x, at.z - last.z) < UNSTICK.apart) return;
    if (!good(at.x, at.z)) return;
    U.trail.push({ x: at.x, z: at.z });
    if (U.trail.length > UNSTICK.keep) U.trail.shift();
  };
  U.clear = () => { U.trail.length = 0; t = 0; };
  U.pick = (at, { doors = [], square = null, room: need = room } = {}) => {
    for (let i = U.trail.length - 1; i >= 0; i--) {
      const q = U.trail[i];
      if (at && Math.hypot(q.x - at.x, q.z - at.z) < UNSTICK.away) continue;
      if (good(q.x, q.z, need)) return { x: q.x, z: q.z, from: 'trail' };
    }
    const ds = doors.filter((d) => d && Number.isFinite(d.x) && Number.isFinite(d.z))
      .map((d) => ({ d, k: at ? Math.hypot(d.x - at.x, d.z - at.z) : 0 })).sort((a, b) => a.k - b.k);
    for (const { d } of ds) {
      if (at && Math.hypot(d.x - at.x, d.z - at.z) < UNSTICK.away) continue;
      if (good(d.x, d.z, need)) return { x: d.x, z: d.z, from: 'door', rot: d.rot };
    }
    if (square) return { x: square.x, z: square.z, from: 'square', rot: square.rot };
    return null;
  };
  return U;
}
