// Tests for the back woods' gang camps (src/missions/backwoods.js: the spots, the dials and how a new camp's spot is
// picked) and that the spots keep clear of what the survey kept them from (read from the files that place those
// things: they need three.js, so their numbers are read as text here).
// Run with:  node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { BACKWOODS, AREAS, WOODS, pickSpot, cachesOf, fillCaches, openCache, takeCache, tickCaches, bundlePay, LOOT_PAY } = await import('../src/missions/backwoods.js');
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const SQUARE = { x: -12, z: -205 };   // (models/town/layout.json game.square)
const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const segD = (p, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz, t = Math.max(0, Math.min(1, ((p.x - a[0]) * vx + (p.z - a[1]) * vz) / L2)); return Math.hypot(a[0] + vx * t - p.x, a[1] + vz * t - p.z); };
// the western river's stretch where the bridge is to go (the survey's line)
const RIVER = [[-640, -262], [-625, -245], [-579, -200], [-560, -170], [-546, -150], [-533, -120], [-529, -100], [-502, -60], [-470, -50]];

test('the spots: in every woods, named, out in the back woods (200 to 560 m from the square)', () => {
  assert.equal(BACKWOODS.length, 16);
  for (const a of ['west', 'south', 'east']) { assert.ok(AREAS[a], a); assert.ok(BACKWOODS.filter((b) => b.area === a).length >= 3, a); }
  for (const b of BACKWOODS) { assert.ok(AREAS[b.area], JSON.stringify(b)); const t = d(b, SQUARE); assert.ok(t >= 200 && t <= 560, `${b.x},${b.z}: ${t.toFixed(0)} m`); }
  for (let i = 0; i < BACKWOODS.length; i++) for (let j = i + 1; j < BACKWOODS.length; j++) assert.ok(d(BACKWOODS[i], BACKWOODS[j]) >= 40, `${i} ${j}`);
});

test('the spots keep clear of the bridge\'s river, the camps, the hideouts, the deer and the lake', () => {
  for (const b of BACKWOODS) {
    let r = Infinity; for (let i = 1; i < RIVER.length; i++) r = Math.min(r, segD(b, RIVER[i - 1], RIVER[i]));
    assert.ok(r >= 90, `${b.x},${b.z} is ${r.toFixed(0)} m from the western river`);
  }
  const camps = [...read('src/camps.js').matchAll(/spot: \{ x: (-?\d+), z: (-?\d+) \}/g)].map((m) => ({ x: +m[1], z: +m[2] }));
  assert.equal(camps.length, 3);
  const caches = [...read('src/missions/loot.js').match(/export const CACHES = \[([\s\S]*?)\n\];/)[1].matchAll(/x: (-?\d+), z: (-?\d+)/g)].map((m) => ({ x: +m[1], z: +m[2] }));
  assert.equal(caches.length, 5);
  const deer = [...read('src/deer.js').match(/herds: \[([\s\S]*?)\n  \],/)[1].matchAll(/x: (-?\d+), z: (-?\d+)/g)].map((m) => ({ x: +m[1], z: +m[2] }));
  assert.ok(deer.length >= 7, 'the back woods have deer too: ' + deer.length);
  const lake = { x: 0, z: -30 };
  for (const b of BACKWOODS) {
    for (const c of camps) assert.ok(d(b, c) >= 90, `camp ${c.x},${c.z}`);
    for (const c of caches) assert.ok(d(b, c) >= 70, `hideout ${c.x},${c.z}`);
    for (const c of deer) assert.ok(d(b, c) >= 50, `deer ${c.x},${c.z} from ${b.x},${b.z}`);
    assert.ok(d(b, lake) >= 150, 'the lake shore is left for the fishing dock');
  }
});

test('pickSpot: apart from the camps and the player, out of sight, not used lately', () => {
  const player = { x: -480, z: -265 };   // (standing on a spot)
  for (let k = 0; k < 200; k++) {
    const camps = [{ x: -340, z: 105, area: 'south' }, { x: -154, z: -100 }];
    const b = pickSpot({ camps, player, rand: Math.random });
    assert.ok(b);
    assert.ok(d(b, player) >= WOODS.fromPlayer);
    for (const c of camps) assert.ok(d(b, c) >= WOODS.apart);
  }
  // nothing out of sight: nothing pitched
  assert.equal(pickSpot({ camps: [], player: { x: 0, z: 0 }, unseen: () => false }), null);
  // only one spot out of sight, used lately: nothing
  const only = BACKWOODS[3];
  assert.equal(pickSpot({ camps: [], player: { x: 0, z: 0 }, unseen: (x, z) => x === only.x && z === only.z, recent: [only] }), null);
  assert.equal(pickSpot({ camps: [], player: { x: 0, z: 0 }, unseen: (x, z) => x === only.x && z === only.z }), only);
});

test('pickSpot: a new camp goes to the woods with the fewest camps (the three spread over the woods)', () => {
  const camps = [{ x: -480, z: -265, area: 'west' }, { x: 475, z: 40, area: 'east' }];
  for (let k = 0; k < 50; k++) assert.equal(pickSpot({ camps, player: SQUARE }).area, 'south');
  // three pitched one after another from the square spread over the three woods, every time (seeded dice)
  let seed = 7; const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < 100; k++) {
    const got = []; for (let i = 0; i < 3; i++) got.push(pickSpot({ camps: got, player: SQUARE, rand }));
    assert.deepEqual(new Set(got.map((b) => b.area)).size, 3);
  }
});

test('the dials hold together', () => {
  assert.ok(WOODS.camps >= 2 && WOODS.camps <= BACKWOODS.length / 3);
  assert.ok(WOODS.again[0] > 30 && WOODS.again[1] >= WOODS.again[0]);
  assert.ok(WOODS.fromPlayer > WOODS.found && WOODS.strike > WOODS.found, 'a camp is never pitched or struck within finding distance');
  assert.ok(WOODS.far > WOODS.fromPlayer, 'a camp pitched may be drawn: it must be out of sight then');
  assert.ok(WOODS.guardGone > WOODS.guardNear);
});

// ── THE LOOT CACHES: 16 spots, a quarter open, a taken one closes and another opens (the game's maker, 2026-10-29) ──
const seeded = (n) => { let seed = n; return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); };

test('the caches: 16 spots, all well outside town; 4 open at once, at 4 different spots', () => {
  assert.equal(BACKWOODS.length, 16);
  for (const b of BACKWOODS) assert.ok(d(b, SQUARE) >= 200, `${b.x},${b.z} is only ${d(b, SQUARE).toFixed(0)} m from the square`);
  assert.equal(WOODS.camps, 4);
  for (let k = 0; k < 50; k++) {
    const S = {}, C = cachesOf(S), got = fillCaches(C, { player: SQUARE, rand: seeded(k + 1) });
    assert.equal(got.length, 4); assert.equal(C.open.length, 4); assert.equal(S.camps, C, 'saved with the rider');
    assert.equal(new Set(C.open.map((o) => o.i)).size, 4);
    for (const o of C.open) assert.ok(BACKWOODS[o.i]);
    assert.equal(fillCaches(C, { player: SQUARE }).length, 0, 'no more than 4');
    assert.equal(openCache(C, { player: SQUARE }), null);
  }
});

test('a cache taken closes, and after a while another opens: never the same spot, never one closed lately', () => {
  const rand = seeded(11), S = {}, C = cachesOf(S); fillCaches(C, { player: SQUARE, rand });
  const used = [];
  for (let k = 0; k < 200; k++) {
    const take = C.open[Math.floor(rand() * C.open.length)].i;
    assert.ok(takeCache(C, take, rand));
    assert.equal(C.open.length, 3, 'it closes'); assert.ok(!C.open.some((o) => o.i === take));
    assert.equal(C.wait.length, 1);
    assert.ok(C.wait[0] >= WOODS.again[0] && C.wait[0] <= WOODS.again[1]);
    // not yet: nothing opens before its time
    assert.deepEqual(tickCaches(C, WOODS.again[0] - 1, { player: SQUARE, rand }), []);
    const got = tickCaches(C, WOODS.again[1], { player: SQUARE, rand });
    assert.equal(got.length, 1, 'another opens'); assert.equal(C.open.length, 4); assert.equal(C.wait.length, 0);
    assert.notEqual(got[0].i, take, 'never the same spot');
    assert.ok(!C.recent.includes(got[0].i), 'not one closed lately');
    assert.equal(new Set(C.open.map((o) => o.i)).size, 4);
    used.push(take);
  }
  // nothing out of sight just then: it waits, and opens once a spot is
  const C2 = cachesOf({}); fillCaches(C2, { player: SQUARE }); takeCache(C2, C2.open[0].i);
  assert.deepEqual(tickCaches(C2, 1e4, { player: SQUARE, unseen: () => false }), []);
  assert.equal(C2.wait.length, 1); assert.equal(C2.wait[0], 0);
  assert.equal(tickCaches(C2, 1, { player: SQUARE }).length, 1);
});

test('about one cache in three fights, decided when it opens; a saved state reads back, a damaged one is made sound', () => {
  const rand = seeded(5); let fights = 0, n = 0;
  for (let k = 0; k < 600; k++) { const C = cachesOf({}); fillCaches(C, { player: SQUARE, rand }); for (const o of C.open) { n++; if (o.fight) fights++; } }
  assert.ok(Math.abs(fights / n - 1 / 3) < 0.05, `${fights} of ${n}`);
  const S = {}; const C = cachesOf(S); fillCaches(C, { player: SQUARE }); takeCache(C, C.open[1].i);
  const back = cachesOf(JSON.parse(JSON.stringify(S)));
  assert.deepEqual(back, C);
  for (const bad of [null, 7, 'x', { open: 'x' }, { open: [{ i: 99 }, { i: -1 }, null, { i: 2 }, { i: 2 }], recent: [3, 'x'], wait: [NaN, 5e9] }]) {
    const T = { camps: bad }, B = cachesOf(T);
    assert.ok(B.open.every((o) => BACKWOODS[o.i])); assert.ok(B.open.length + B.wait.length <= WOODS.camps);
    tickCaches(B, 0, { player: SQUARE }); assert.equal(B.open.length + B.wait.length, WOODS.camps, 'what is missing is on its way');
  }
});

test("the pay: 200 gold for a cache's loot handed back, shared over its bundles", () => {
  assert.equal(LOOT_PAY, 200);
  for (const n of [1, 2, 3, 4, 5]) { let t = 0; for (let k = 0; k < n; k++) { const g = bundlePay(k, n); assert.ok(Number.isInteger(g) && g > 0); t += g; } assert.equal(t, 200, `${n} bundles`); }
  const loot = read('src/missions/loot.js');
  assert.match(loot, /const gold = bundlePay\(trip\.at, trip\.problems\.length\)/, 'each bundle pays its share');
  assert.doesNotMatch(loot, /pay\.trip|pay\.clean|pay\.each/, 'no other pay for the trip');
});

test("the cards: a camp's card only right at it, the held-up wagon's only within 30 m", () => {
  const loot = read('src/missions/loot.js'), wagon = read('src/missions/wagonjob.js');
  assert.match(loot, /card: 20, cardOff: 24,/);
  assert.match(wagon, /card: 30, cardOff: 34,/);
  assert.match(wagon, /near: 60,/, 'the hold-up itself still carries from 60 m');
});
