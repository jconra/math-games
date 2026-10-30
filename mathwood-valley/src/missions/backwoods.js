// THE GANG'S LOOT CACHES, in plain numbers (no three.js, so the tests can load it): the 16 spots out in the back woods
// where the gang may hide a cache, what the woods are called, the dials, how a new cache's spot is picked, which caches
// are open now (saved with the rider) and what a cache handed back pays. Used by src/missions/loot.js (which says what
// the camps are); tested in tests/backwoods.test.mjs.
//
// The game's maker (2026-10-29): 10 to 20 spawn spots with about a quarter of them active at once, all well outside
// town ("like bandits that are hiding from the Sheriff"); a cache taken is gone and some other random one opens; no
// most a day, but rare enough that doing 5 in a day is a challenge; about 200 gold for the loot handed back.
//
//   pickSpot({ camps, player, recent, unseen, rand })  -> a spot of BACKWOODS for a new camp, or null (none fits now)
//     camps: every gang camp standing [{ x, z, area }]; player: { x, z }; recent: spots used lately (left out);
//     unseen(x, z): true where a camp could appear without being seen (out of sight, or too far to be drawn); rand: the
//     dice (0..1). A spot fits when it is WOODS.apart from every camp, WOODS.fromPlayer from the player, unseen and not
//     used lately; of those, one in the woods with the fewest camps, at random.
//   cachesOf(S)            the caches' state in rider.topics.loot (S.camps, made sound): { open: [{ i, fight }] (i: a
//                          spot of BACKWOODS; fight: its gang fights instead of running, decided when it opened),
//                          recent: [i] (closed lately: not opened again yet), wait: [s] (till each new one opens) }
//   fillCaches(C, opts)    opens caches till WOODS.camps are open or on their way (a new rider; a damaged save) -> opened
//   openCache(C, opts)     one more cache open now -> { i, fight } or null (no spot fits now: tried again later)
//   takeCache(C, i, rand)  the loot of cache i on the horse: it closes, and a new one opens WOODS.again s later
//   tickCaches(C, dt, opts)  each second or so: the waits counted down, and the caches due opened -> [{ i, fight }]
//     opts: { player, unseen, rand } as pickSpot's
//   bundlePay(k, n)        the gold for bundle k of a trip of n: LOOT_PAY shared out, so the whole trip pays LOOT_PAY

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
  camps: 4,             // caches open at once (a quarter of the spots)
  fight: 1 / 3,         // a cache's gang fights (shoots, can be roped; two roped and the rest run) instead of running off
  recent: 4,            // the spots closed last are left out for a new one (so a taken cache never comes straight back)
  again: [180, 360],    // s from a cache's loot going on the horse to a new one opening elsewhere (3 to 6 of the valley's
                        // hours: a day is 24 minutes, world.js DAY_MIN): with the 3 still open, 5 in a day is a long ride
  found: 60,            // m: riding this near a camp finds it (it goes on the compass till it's looted)
  apart: 70,            // m: two camps are never nearer than this (with 4 open and 4 closed lately left out of 16, any
                        // more and a new one could find no spot)
  fromPlayer: 170,      // m: a camp is never pitched (or struck) nearer the player than this
  strike: 140,          // m: an emptied camp is struck once the player is this far off and it's out of sight
  far: 330,             // m from the camera: further off, a camp isn't drawn (a speck in the haze among the trees)
  guardNear: 180,       // m: the gang and their horses are made when the player comes this near ...
  guardGone: 300,       // ... and put away again (still there: back when the player returns) past this, out of sight
  leanto: 0.5,          // a camp's shelter is a lean-to this often (otherwise a tent)
};
export const LOOT_PAY = 200;   // gold for a cache's loot handed back to the families (shared over its bundles)

export function pickSpot({ camps = [], player = null, recent = [], unseen = () => true, rand = Math.random, spots = BACKWOODS } = {}) {
  const count = {}; for (const c of camps) if (c.area) count[c.area] = (count[c.area] || 0) + 1;
  const ok = spots.filter((b) => !recent.includes(b) && camps.every((c) => Math.hypot(c.x - b.x, c.z - b.z) >= WOODS.apart)
    && (!player || Math.hypot(player.x - b.x, player.z - b.z) >= WOODS.fromPlayer) && unseen(b.x, b.z));
  if (!ok.length) return null;
  const least = Math.min(...ok.map((b) => count[b.area] || 0)), pool = ok.filter((b) => (count[b.area] || 0) === least);
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

// ── WHICH CACHES ARE OPEN (saved with the rider) ────────────────────────────────────────────────────────────────────
const spotIx = (i) => Number.isInteger(i) && i >= 0 && i < BACKWOODS.length;
export function cachesOf(S) {
  const c = S && S.camps && typeof S.camps === 'object' ? S.camps : {};
  const open = [];
  for (const o of Array.isArray(c.open) ? c.open : []) if (o && spotIx(o.i) && !open.some((p) => p.i === o.i)) open.push({ i: o.i, fight: !!o.fight });
  const C = {
    open: open.slice(0, WOODS.camps),
    recent: (Array.isArray(c.recent) ? c.recent : []).filter(spotIx).slice(-WOODS.recent),
    wait: (Array.isArray(c.wait) ? c.wait : []).filter((t) => Number.isFinite(t)).map((t) => Math.max(0, Math.min(WOODS.again[1], t))),
  };
  C.wait = C.wait.slice(0, Math.max(0, WOODS.camps - C.open.length));
  if (S && typeof S === 'object') S.camps = C;
  return C;
}
export function openCache(C, { player = null, unseen = () => true, rand = Math.random } = {}) {
  if (C.open.length >= WOODS.camps) return null;
  const camps = C.open.map((o) => BACKWOODS[o.i]);
  const b = pickSpot({ camps, player, recent: [...C.recent, ...C.open.map((o) => o.i)].map((i) => BACKWOODS[i]), unseen, rand });
  if (!b) return null;
  const o = { i: BACKWOODS.indexOf(b), fight: rand() < WOODS.fight };
  C.open.push(o);
  return o;
}
export function fillCaches(C, opts = {}) {
  const got = [];
  while (C.open.length + C.wait.length < WOODS.camps) { const o = openCache(C, opts); if (!o) break; got.push(o); }
  return got;
}
export function takeCache(C, i, rand = Math.random) {
  const k = C.open.findIndex((o) => o.i === i); if (k < 0) return false;
  C.open.splice(k, 1);
  C.recent = [...C.recent.filter((j) => j !== i), i].slice(-WOODS.recent);
  C.wait.push(WOODS.again[0] + rand() * (WOODS.again[1] - WOODS.again[0]));
  return true;
}
export function tickCaches(C, dt, opts = {}) {
  const got = [];
  for (let k = 0; k < C.wait.length; k++) C.wait[k] = Math.max(0, C.wait[k] - dt);
  while (C.wait.some((t) => t <= 0)) {
    const k = C.wait.findIndex((t) => t <= 0);
    const o = openCache(C, opts); if (!o) break;   // (no spot fits now: it waits at 0, tried again next time)
    C.wait.splice(k, 1); got.push(o);
  }
  // (a cache missing with no wait for it, as after a damaged save: one is on its way)
  while (C.open.length + C.wait.length < WOODS.camps) C.wait.push(WOODS.again[0]);
  return got;
}
export function bundlePay(k, n) {
  const each = Math.floor(LOOT_PAY / n);
  return k === n - 1 ? LOOT_PAY - each * (n - 1) : each;
}
