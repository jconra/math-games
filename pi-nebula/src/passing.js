// TWO PEOPLE MEETING, THE PLAIN PART: how near two people's bodies ever come, and which way each goes to get past the
// other. Nothing of three.js, so it is tested in Node (tests/passing.test.mjs). One size for everyone, so nobody is
// bigger to one than to another: the station's people (src/people.js), the crew aboard a ship (src/aboardplan.js,
// src/aboard.js) and the player's own body (src/player.js).
//
// THE GAME'S MAKER (2026-11-20, of the captain met head-on in the Miner's narrow mess): "It would be nice if people had
// hitboxes small enough to allow them to walk by each other, but not walk directly through each other. If everyone
// walked toward the right side then they should be able to pass eachother"
//
// SO:
//   - PASS.apart: two people's middles are never nearer than this (m), anywhere: a body against another body is the
//     body itself, not the room people like to keep. The figures measure 0.38 m across the chest and 0.29 m front to
//     back (the player's; the station's people as much or a little more), so at PASS.apart two chests never meet,
//     head on or side by side; going by each other that near, their shoulders brush. Against walls and furniture each
//     body is as it was (src/walls.js BODY.r; a ship's cabin, src/boarding.js CABIN_WALLS.r). It was 0.6 m.
//   - KEEP RIGHT (passBy): someone walking who meets another walking the other way (or the player coming at them)
//     moves toward their own right side of the way, from PASS.meet ahead (two walking at each other close fast),
//     until the other is PASS.comfy to their left or the floor runs out; the two pass left shoulder to left shoulder.
//     Someone standing in the way, or walking the same way, is gone round on the side away from them, as before (dead
//     ahead: to the right of someone standing, to the left of someone walking on ahead). The player is not steered:
//     the others make room on their right, unless the player is already coming down that side (more than PASS.wrong
//     to their right), when crossing in front of them would not make room: then on their left.
//   - WHERE THE FLOOR IS TOO NARROW FOR TWO as a real pair would find it (roomFor), nobody steps aside to make room:
//     the crew aboard wait and turn back as before (src/aboardplan.js walkStep), the station's people make way as before
//     (src/people.js makeWay).
//
//   passBy(dx, dz, ox, oz, { coming, player, walking, lane }) -> { steer, slow, ahead, lat } | null
//       dx, dz: the way walked (a unit vector); ox, oz: where the other is, from here. steer: + toward one's right, -
//       toward one's left (0..1 each); slow: how much slower (1: not); null: not in the lane ahead
//   bumps(x0, z0, x1, z1, bodies, at) -> the body a step from (x0, z0) to (x1, z1) would come nearer than PASS.apart
//       to, and nearer than it was (a step away from someone already too near is always let be), or null
//   roomAt(x, z, sx, sz, free, most) -> [left, right]: how far the floor is free to either side (m, sx sz: one's right)
//   roomFor(wall) -> the floor across two middles need to pass, where the walls feel a body `wall` m each way
export const PASS = { apart: 0.40, comfy: 0.75, wrong: 0.2, spare: 0.02, lane: [2.0, 0.75], meet: 3.0, pair: 0.9 };
// (the floor across, for the two middles, that two need to go by each other shoulder past shoulder, as a real pair
// would (PASS.pair: two people's shoulders, 0.45 m each), where the walls feel a body `wall` m across each way: a
// station's hall (0.26) asks no more than the bodies' own PASS.apart; a ship's cabin, whose walls let a body as near as
// 0.15 m, 0.60 m (its airlock: 1.3 m and more; its bunks' aisle, its doors, 0.48; its mess past the table, 0.38 to 0.41))
export const roomFor = (wall) => Math.max(PASS.apart, PASS.pair - 2 * wall) + PASS.spare;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// (two headings more or less opposite: walking at each other)
export const facing = (a, b) => Math.cos(wrap(a - b)) < -0.3;

export function passBy(dx, dz, ox, oz, { coming = false, player = false, walking = false, lane = PASS.lane } = {}) {
  const sx = -dz, sz = dx, ahead = ox * dx + oz * dz, lat = ox * sx + oz * sz;
  // (two walking at each other close twice as fast: met head on, they keep right from further off, PASS.meet)
  const far = coming ? Math.max(lane[0], PASS.meet) : lane[0];
  if (ahead < -0.1 || ahead > far) return null;
  const slow = ahead < 1.0 ? 0.55 + Math.max(0, ahead) * 0.45 : 1;
  // head on: to one's own right until they are PASS.comfy to the left (from as far as PASS.apart to the right: nearer
  // than that they would be walked into), unless it is the player coming down one's right side
  if (coming) {
    const near = 1 - Math.max(0, ahead) / far;
    if (lat < PASS.apart && lat > -PASS.comfy && !(player && lat > PASS.wrong)) return { steer: near * Math.min(1, (PASS.comfy + lat) / PASS.comfy), slow, ahead, lat };
    if (player && lat > PASS.wrong && lat < PASS.comfy) return { steer: -near * Math.min(1, (PASS.comfy - lat) / PASS.comfy), slow, ahead, lat };
    if (ahead > lane[0]) return null;
  }
  // someone standing, or walking on ahead: round them on the side away from them
  if (Math.abs(lat) > lane[1]) return null;
  const w = (1 - Math.max(0, ahead) / lane[0]) * (1 - Math.abs(lat) / lane[1]);
  return { steer: (lat > 0.05 ? -1 : lat < -0.05 ? 1 : walking ? -1 : 1) * w, slow, ahead, lat };
}

export function bumps(x0, z0, x1, z1, bodies, at = (b) => b) {
  for (const b of bodies) {
    const p = at(b); if (!p) continue;
    const d1 = Math.hypot(p.x - x1, p.z - z1);
    if (d1 < PASS.apart && d1 < Math.hypot(p.x - x0, p.z - z0) - 1e-9) return b;
  }
  return null;
}

export function roomAt(x, z, sx, sz, free, most = 0.9, step = 0.02) {
  const out = [0, 0];
  for (let i = 0; i < 2; i++) {
    const g = i ? 1 : -1;
    for (let k = step; k <= most + 1e-9; k += step) { if (!free(x + sx * k * g, z + sz * k * g)) break; out[i] = k; }
  }
  return out;
}
