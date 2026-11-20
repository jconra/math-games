// THE HAULER AT THE DOCK, ROUND 4 (the game's maker's answers, 2026-11-20): its containers a box or a tank at random
// (HAUL3-1: "I would just do it randomly"); a short sealed tunnel the size of its door from the bridge's end in to its
// crew door (HAUL3-2: "Add a short, narrow tunnel, the size of the door, from the bridge's end in to the door" and "What
// is the point of having a tunnel if it isn't sealed?"); once all nine rings are built, walk across and in (HAUL3-3), the
// bridge standing once built (HAUL3-6: "we need the bridge built before it is accessible ... I'd be fine with it where
// you can get on it and look around after the bridge is built"); a ring of lights round its crew door, red, then green
// when the bridge reaches it (HAUL3-4); and it is not flown (HAUL3-6). No browser: the plain rules, and the modules'
// text where they need three.js. (The bridge walked in a page: ~/pw/space-math/rigs/hauler-4/steps_walk.js.)
//   node --test pi-nebula/tests/dockwalk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawMix, MIX_LOOKS } from '../kit/ships/cargo-mix.js';
import { bridgeOf, built, nextShip, bridgeStands, BRIDGE } from '../src/jobs/dock.js';

const here = (p) => new URL('../' + p, import.meta.url);
const text = (p) => readFileSync(here(p), 'utf8');
const KIT = text('kit/ships/hauler-built.js'), DOCKF = text('src/haulerdock.js'), WALK = text('src/dockwalk.js'), BOARD = text('src/boarding.js'), LINK = text('src/jobs/docklink.js'), MAIN = text('src/main.js'), BRIDGEK = text('kit/dockbridge.js');
const ROOM = JSON.parse(text('kit/rooms/ship-hauler-built.json'));
const num = (re, s = KIT) => { const m = s.match(re); assert.ok(m, String(re)); return +m[1]; };
const PLACES = ['port upper front', 'port upper rear', 'port lower front', 'port lower rear', 'starboard upper front', 'starboard upper rear', 'starboard lower front', 'starboard lower rear'];
// (a seeded draw, for a test that comes out the same every time)
const seeded = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

test('the containers: each place a box or a tank, at random, each on its own (HAUL3-1)', () => {
  assert.deepEqual(MIX_LOOKS, ['ribbed', 'tank']);
  const one = drawMix(PLACES, seeded(1));
  assert.deepEqual(Object.keys(one), PLACES);
  for (const v of Object.values(one)) assert.ok(MIX_LOOKS.includes(v), v);
  assert.deepEqual(drawMix(PLACES, seeded(1)), one, 'the same draw for the same numbers');
  // (each place at even odds, and the places each on their own: over many draws every place is a box about half the
  // time, and the eight are not all one look most of the time)
  const N = 4000, rand = seeded(7), boxes = Object.fromEntries(PLACES.map((p) => [p, 0])), mixes = new Set();
  let allSame = 0;
  for (let i = 0; i < N; i++) {
    const d = drawMix(PLACES, rand), v = Object.values(d);
    for (const p of PLACES) if (d[p] === 'ribbed') boxes[p]++;
    if (v.every((x) => x === v[0])) allSame++;
    mixes.add(v.join(','));
  }
  for (const p of PLACES) assert.ok(boxes[p] / N > 0.45 && boxes[p] / N < 0.55, `${p}: ${boxes[p] / N}`);
  assert.ok(allSame / N < 0.02, `all eight alike ${allSame / N} of the time`);
  assert.ok(mixes.size > 200, `${mixes.size} different mixes`);
  // (the ends of the range)
  assert.ok(Object.values(drawMix(PLACES, () => 0)).every((v) => v === 'ribbed'));
  assert.ok(Object.values(drawMix(PLACES, () => 0.999)).every((v) => v === 'tank'));
});

test('the mix is drawn when the Hauler is made: at the dock each time the game starts, in the Ship Lab on its Mix chip', () => {
  // (the dock: a new draw just before it is built, the containers built before it forgotten)
  assert.match(DOCKF, /api\.mix = HB\.drawMix\(\); forgetPiece\('hbContainer'\);/);
  assert.ok(DOCKF.indexOf('HB.drawMix()') < DOCKF.indexOf('builds.plain = make()'), 'drawn before it is built');
  // (the lab: no button of its own; the Mix chip it had draws again each time it is pressed)
  assert.match(KIT, /if \(k === 'mix'\) drawMix\(\); else if \(CARGO_LOOK\.look === k\) return;/);
  assert.equal((KIT.match(/chip\(/g) || []).length, 4, 'the same chips as before: Unload one, Load one, the clamps, the looks');
});

test('the bridge stands once built, kept with the crew member, and after the next ship\'s bridge is begun (HAUL3-3, HAUL3-6)', () => {
  // (a crew member who never went to the dock: no bridge, and left as they were)
  const fresh = { id: 'a', name: 'A' };
  assert.equal(bridgeStands(fresh), false); assert.deepEqual(fresh, { id: 'a', name: 'A' });
  assert.equal(bridgeStands(null), false);
  const c = { id: 'b', name: 'B' };
  for (let i = 0; i < BRIDGE.rings - 1; i++) { built(c); assert.equal(bridgeStands(c), false, `${i + 1} rings`); }
  built(c); assert.equal(bridgeOf(c).rings, 9); assert.equal(bridgeStands(c), true, 'all nine rings');
  // (kept with them: saved and loaded again)
  assert.equal(bridgeStands(JSON.parse(JSON.stringify(c))), true, 'after a reload');
  // (the dock's job played again: a new bridge for the next ship begins from ring 1; the one built stands)
  nextShip(c); assert.equal(bridgeOf(c).rings, 0); assert.equal(bridgeStands(c), true);
  built(c); assert.equal(bridgeStands(c), true);
  // (a save from before this, a ship docked long ago)
  assert.equal(bridgeStands({ jobs: { dock: { bridge: { ship: 3, rings: 2 } } } }), true);
  assert.equal(bridgeStands({ jobs: { dock: { bridge: { ship: 1, rings: 8 } } } }), false);
});

test('walked: the bridge stands for the crew member playing, its walls added, the airlock\'s outer door opens; the Hauler boarded by the shared code', () => {
  assert.match(WALK, /bridgeStands\(crew\(\)\)/);
  assert.match(WALK, /walls\.add\('dock:bridge'/);
  assert.match(WALK, /entry\.locked = !on; if \(on\) W\.keepShut\.delete\(door\); else W\.keepShut\.add\(door\);/);
  // (the outer door is a door now: two halves sliding apart, as the inner door's; locked while it leads nowhere)
  const HANGAR = text('kit/hangar.js');
  assert.match(HANGAR, /p\.leaf\('airlock-outer:' \+ sx, \(q\) => half\(q, sx\), \{ slide: \[sx \* AR, 0, 0\], door: 0 \}\);/);
  // the Hauler's line in the boarding's ships: its own deck plan, at the dock, near from the airlock, no flight
  const line = BOARD.match(/export const DOCKED_SHIP = (\{[^\n]*\});/); assert.ok(line, 'DOCKED_SHIP');
  assert.match(line[1], /id: 'hauler', dock: true, near: \['airlock'\]/); assert.match(line[1], /bp: 'hauler-his-plan'/);
  assert.ok(!/flight/.test(line[1]), 'not flown (HAUL3-6)');
  assert.match(BOARD, /\n  DOCKED_SHIP,\n\];/);
  // (gone into only once the bridge stands; its cabin built and dropped as the others')
  assert.match(BOARD, /\(s\.near\.has\(here\) \|\| inShip === s\) && \(!s\.dock \|\| s\.dock\.open\(\)\)/);
  assert.match(MAIN, /makeBoarding\(\{ W, walls, quality: W\.quality, dock: dockWalk\.boarding \}\)/);
  // (nothing about flying: the Hauler is in no list of flown ships)
  assert.ok(!/hauler/i.test(text('src/fleet.js').match(/export const SHIPS = \[[\s\S]*?\n\];/)[0]), 'not in the fleet');
  assert.match(BOARD, /export const FLOWN = \['ship-miner'\];/);
});

test('the tunnel: the door\'s size, from the bridge\'s end in to the door, between the front clamp frame and the front pod (HAUL3-2)', () => {
  const door = KIT.match(/export const CREWDOOR = \{ z: \[([\d.]+), ([\d.]+)\], sill: DECK, head: ([\d.]+)/).slice(1).map(Number);
  const deck = num(/export const DECK = ([\d.]+)/, text('kit/ships/hauler-built.hull.js'));
  // its numbers (src/haulerdock.js TUNNEL): the door's width, its floor under the stair's top, its roof at the door's head
  assert.match(DOCKF, /half: \(HB\.CREWDOOR\.z\[1\] - HB\.CREWDOOR\.z\[0\]\) \/ 2, wall: 0\.025,/);
  assert.match(DOCKF, /floor: DOCK\.deck - 0\.05, roof: toBridgeY\(HB\.CREWDOOR\.head\), z0: DOCK\.z0 \+ DOCK\.rings \* DOCK\.L,/);
  const half = (door[1] - door[0]) / 2, wall = 0.025, mid = (door[0] + door[1]) / 2;
  // (what stands beside the door along the ship: the front clamp frame's station behind, the front pod's back end in
  // front, each with the lamps between: the tunnel's outside clear of both)
  const station = +KIT.match(/export const STATIONS = \[\{ z: \[([\d.]+), ([\d.]+)\]/)[2];
  const pod = KIT.match(/name: 'front port', at: \[[\d.]+, [\d.]+, ([\d.]+)\], up: -1, mesh: 'front', scale: ([\d.]+)/), podHalf = JSON.parse(text('kit/ships/hauler-built.hull.js').match(/POD_HALF = (\{[^;]*\})/)[1]).front[2] * +pod[2];
  const back = mid - half - wall, front = mid + half + wall, podEnd = +pod[1] - podHalf;
  assert.ok(back > station + 0.1, `its back wall ${back} past the frame's station ${station}`);
  assert.ok(front < podEnd, `its front wall ${front.toFixed(3)} short of the pod's back end ${podEnd.toFixed(3)}`);
  // (the side lamps stand in the strip of skin between the tunnel's walls and the door section's ends: 2.72 and 3.72)
  const L = KIT.match(/side: \{ z: \[([\d.]+), ([\d.]+)\], y: \[[^\]]+\] \}, sideLamp: \[([\d.]+), [\d.]+\], rim: ([\d.]+)/).slice(1).map(Number);
  const lampHalf = L[2] / 2 + L[3];
  assert.ok(L[0] - lampHalf >= 2.72 && L[0] + lampHalf <= back, `the back lamps ${L[0]} ± ${lampHalf}`);
  assert.ok(L[1] - lampHalf >= front && L[1] + lampHalf <= 3.72, `the front lamps ${L[1]} ± ${lampHalf}`);
  // (sealed: a floor, two walls, a roof, a gasket all round where it meets the hull, a plate across the bridge's end)
  for (const k of ['the floor and the roof', 'the two walls', 'THE SEAL', 'the plate across the tube\'s end']) assert.ok(BRIDGEK.includes(k), k);
  assert.ok(deck > 1 && door[2] - deck >= 1.9, 'a person stands in the doorway');
});

test('the docked pose: the door lifted, the stair laid level on the tunnel\'s floor', () => {
  // (the stair turns by its angle times smooth(t): DOCKED.stair is where that comes to a quarter turn)
  const deck = num(/export const DECK = ([\d.]+)/, text('kit/ships/hauler-built.hull.js'));
  const Y = deck - num(/const STAIR_Y = DECK - ([\d.]+)/), Ls = num(/STAIR_L = ([\d.]+)/), angle = Math.PI / 2 + Math.asin(Y / Ls);
  assert.match(KIT, /export const DOCKED = \{ crew: 1, stair: \+unsmooth\(PI \/ 2 \/ CREWSTAIR\.angle\)\.toFixed\(5\) \};/);
  const unsmooth = (k) => 0.5 - Math.sin(Math.asin(1 - 2 * k) / 3), t = unsmooth(Math.PI / 2 / angle), smooth = t * t * (3 - 2 * t);
  assert.ok(Math.abs(smooth * angle - Math.PI / 2) < 1e-9, 'a quarter turn');
  assert.ok(t > 0 && t < 1);
  // (its length, laid down, reaches from its hinge just inside the door out to the bridge's deck, across the tunnel)
  assert.ok(Ls > 1.8 && Ls < 2.1);
});

test('the docking lights: a ring round the crew door, red, then green when the bridge reaches it (HAUL3-4)', () => {
  const v = ROOM.pieces.filter((p) => p.piece === 'hbDockLights').map((p) => p.variant);
  assert.deepEqual(v, ['port'], 'in the Hauler\'s room file: the Ship Lab shows them');
  assert.match(KIT, /hbDockLights: \{[^\n]*variants: \['port', 'port, housings'\]/);
  assert.match(KIT, /red: \[1\.6, 0\.14, 0\.1\], green: \[0\.25, 2\.2, 0\.6\]/);
  // (all round: a row over the door's head, a row under its sill, and both sides)
  const above = num(/above: ([\d.]+), below:/), below = num(/below: ([\d.]+), z:/), head = num(/sill: DECK, head: ([\d.]+)/), deck = num(/export const DECK = ([\d.]+)/, text('kit/ships/hauler-built.hull.js'));
  assert.ok(above > head && below < deck, `rows at ${above} and ${below}, the door ${deck} to ${head}`);
  // (the game draws the lenses in a colour of its own: red waiting, green docked; the job turns them green as the wave
  // of light reaches the Hauler, before its door lifts and the tunnel seals over them)
  assert.match(DOCKF, /variant = pl\.piece === 'hbDockLights' \? 'port, housings'/);
  assert.match(WALK, /h\.lights\(api\.on \? 'green' : 'red'\)/);
  assert.match(LINK, /const green = s >= DOCKING\.lights;\n\s+H\.lights\(green \? 'green' : 'red', green \? glow : 1\);/);
  const D = LINK.match(/export const DOCKING = \{ lights: ([\d.]+), door: \[([\d.]+), [\d.]+\], tunnel: \[([\d.]+), [\d.]+\]/).slice(1).map(Number);
  assert.ok(D[0] < D[1] && D[1] < D[2], 'green first, then the door, then the tunnel');
});
