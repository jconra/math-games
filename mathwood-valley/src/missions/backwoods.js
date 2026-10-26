// THE BACK WOODS' GANG CAMPS, in plain numbers (no three.js, so the tests can load it): where the gang may pitch a camp
// in the back woods, what the woods are called, the dials, and how a new camp's spot is picked. Used by
// src/missions/loot.js (which says what the camps are); tested in tests/backwoods.test.mjs.
//
//   pickSpot({ camps, player, recent, unseen, rand })  -> a spot of BACKWOODS for a new camp, or null (none fits now)
//     camps: every gang camp standing [{ x, z, area }] (the hideout too: no area); player: { x, z }; recent: spots used
//     lately (left out); unseen(x, z): true where a camp could appear without being seen (out of sight, or too far to
//     be drawn); rand: the dice (0..1)
//   A spot fits when it is WOODS.apart from every camp, WOODS.fromPlayer from the player, unseen and not used lately;
//   of those, one in the woods with the fewest camps, at random.

// The back woods' camp spots (from ~/pw/bandit-math/rigs/town/E/survey.cjs: a clearing of 4.5 m with no trunk in it and
// trees about, the ground within 1.4 m over it, dry, reachable by a horse from the square, 200 to 560 m out, at least 35 m
// from the roads and the town trail, 60 m from the wagon job's loop, 90 m from the camps and the western river where the
// bridge is to go, 70 m from the hideouts, 60 m from the deer; the lake shore left for the fishing dock). area: which
// woods, for what the card and Hob call it. x, z: metres, world.
export const BACKWOODS = [
  { x: -480, z: -265, area: 'west' }, { x: -545, z: -300, area: 'west' }, { x: -430, z: -265, area: 'west' }, { x: -505, z: -315, area: 'west' },
  { x: -245, z: 70, area: 'south' }, { x: -340, z: 105, area: 'south' }, { x: -355, z: 65, area: 'south' }, { x: -310, z: -90, area: 'south' },
  { x: 475, z: 40, area: 'east' }, { x: 505, z: -140, area: 'east' }, { x: 535, z: -100, area: 'east' }, { x: 470, z: 80, area: 'east' },
  { x: 470, z: -115, area: 'east' }, { x: 440, z: 5, area: 'east' }, { x: 465, z: -35, area: 'east' }, { x: 465, z: -75, area: 'east' },
];
export const AREAS = { west: 'the woods out west', south: 'the woods south-west of town', east: 'the woods out east' };

export const WOODS = {
  camps: 3,             // gang camps in the back woods at once (with their loot still in them)
  found: 60,            // m: riding this near a camp finds it (it goes on the compass till it's looted)
  again: [150, 300],    // s from a camp's loot going on the horse to a new camp pitched elsewhere
  apart: 120,           // m: two camps are never nearer than this
  fromPlayer: 170,      // m: a camp is never pitched (or struck) nearer the player than this
  strike: 140,          // m: an emptied camp is struck once the player is this far off and it's out of sight
  far: 330,             // m from the camera: further off, a camp isn't drawn (a speck in the haze among the trees)
  guardChance: 0.6,     // a guard at a new camp (his fire burning); otherwise the camp's fire ring is cold
  guardNear: 180,       // m: his horse and he are made when the player comes this near ...
  guardGone: 300,       // ... and put away again (still on guard: back when the player returns) past this, out of sight
  leanto: 0.5,          // a camp's shelter is a lean-to this often (otherwise the tent, like the hideout's)
};

export function pickSpot({ camps = [], player = null, recent = [], unseen = () => true, rand = Math.random, spots = BACKWOODS } = {}) {
  const count = {}; for (const c of camps) if (c.area) count[c.area] = (count[c.area] || 0) + 1;
  const ok = spots.filter((b) => !recent.includes(b) && camps.every((c) => Math.hypot(c.x - b.x, c.z - b.z) >= WOODS.apart)
    && (!player || Math.hypot(player.x - b.x, player.z - b.z) >= WOODS.fromPlayer) && unseen(b.x, b.z));
  if (!ok.length) return null;
  const least = Math.min(...ok.map((b) => count[b.area] || 0)), pool = ok.filter((b) => (count[b.area] || 0) === least);
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}
