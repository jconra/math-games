// The other station's outside (kit/oldstation-plan.js): shape B as the game's maker picked it, with the ring of solar
// panels turned upright ("Can we rotate the ring 90 degrees on the x axis so that the ring goes above and below the
// station. The tower may have to be shorter to not interfere with the rings."), red, its old bridge standing. No
// browser: the plan and the plate builder are plain numbers (the built meshes are looked at in labs/oldstation/).
//   node --test pi-nebula/tests/oldstation.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { oldStationPlans, oldStationGear, armsOf, footOf, ringAt, OLD_LOOK, OLD_TINT, LIT, BODY, BODY_PATH, HANGARS, DOORS, PORT, BRIDGE, RING, ARMS, TOWER, KEEL, OLD_BOX, OLD_VIEWS, ROUND } from '../kit/oldstation-plan.js';
import { BODY_PATH as OUR_BODY, HANGARS as OUR_HANGARS, DOOR, LEVELS } from '../kit/outside-plan.js';
import { hullArrays, mergeHulls } from '../kit/hull-plates.js';
import { STATION_LOOK, HULL_LOOKS, plateSizes } from '../kit/hull-look.js';

const text = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const A = mergeHulls(oldStationPlans().map((p) => hullArrays(p, { ...plateSizes(OLD_LOOK), lap: 0 }))), G = oldStationGear();
function* pointsOf(list) { for (const a of list) for (let i = 0; i < a.position.length; i += 3) yield [a.position[i], a.position[i + 1], a.position[i + 2]]; }
const hullPoints = () => pointsOf(['band', 'tiers', 'trim'].map((g) => A.groups[g]));
const inBox = (p, b) => p[0] > b[0][0] && p[0] < b[0][1] && p[1] > b[1][0] && p[1] < b[1][1] && p[2] > b[2][0] && p[2] < b[2][1];
// (how far a point is from the ring's axis, in the ring's own plane)
const fromAxis = (p) => Math.hypot(p[1] - RING.y, p[2]);

test('the other station: its plan is sound (whole triangles, nothing missing, every number real, inside its box)', () => {
  for (const g of ['band', 'tiers', 'trim']) {
    const a = A.groups[g], n = a.position.length / 3;
    assert.ok(a.index.length > 0 && a.index.length % 3 === 0);
    for (const v of a.position) assert.ok(Number.isFinite(v));
    for (const v of a.normal) assert.ok(Number.isFinite(v));
    for (const i of a.index) assert.ok(i < n);
  }
  for (const a of [G.lit, G.glow]) { assert.ok(a.triangles > 0); for (const v of a.position) assert.ok(Number.isFinite(v)); for (const v of a.color) assert.ok(v >= 0 && Number.isFinite(v)); for (const i of a.index) assert.ok(i < a.position.length / 3); }
  for (const p of [...hullPoints(), ...pointsOf([G.lit, G.glow])]) assert.ok(p.every((v, k) => v >= OLD_BOX.min[k] && v <= OLD_BOX.max[k]), 'outside its box: ' + p.map((v) => v.toFixed(1)));
  assert.equal(oldStationPlans().length, 3);   // (the body, the tower, the keel)
});

test('shape B: a shorter body than ours, two hangars side by side, their doors in the east face as ours are, open behind their shields', () => {
  const len = (P) => Math.max(...P.map((p) => p[1])) - Math.min(...P.map((p) => p[1]));
  assert.ok(len(BODY_PATH) < len(OUR_BODY) * 0.7, 'shorter than ours');
  assert.equal(HANGARS.length, 2); assert.ok(HANGARS.length < OUR_HANGARS.length, 'fewer hangars than ours');
  // side by side along the body, ours' spacing apart at least, each door within the east face
  assert.ok(Math.abs(HANGARS[1].z - HANGARS[0].z) >= DOOR.w + 2 * DOOR.jamb);
  for (const d of DOORS) { assert.deepEqual(d.out, [1, 0, 0]); assert.equal(d.at[0], BODY.x1); assert.ok(Math.abs(d.at[2]) + d.w / 2 + d.jamb <= BODY.z1 - BODY.cut, d.name); assert.equal(d.w, DOOR.w); assert.equal(d.h, DOOR.h); }
  assert.equal(A.stats.doors, 2, 'two doors with shields across them (the port has none: its way in is shut)');
});

test('the ring stands upright (his words: "above and below the station"), round the body\'s middle, clear of everything on it', () => {
  // upright, in the plane across the body's middle: it passes over the roof and the tower, under the keel, past both ends
  assert.equal(RING.x, 0); assert.ok(RING.y > LEVELS.belly && RING.y < LEVELS.roof);
  const top = ringAt(90, RING.r0), bottom = ringAt(270, RING.r0), north = ringAt(180, RING.r0), south = ringAt(0, RING.r0);
  assert.ok(top[1] > TOWER.top + TOWER.mast + 1 + TOWER.beacon + 15, 'the ring goes well over the tower\'s beacon');
  assert.ok(bottom[1] < KEEL.foot - KEEL.mast - 0.8 - KEEL.beacon - 15, 'and well under the keel\'s light');
  assert.ok(north[2] < BODY.z0 - 15 && south[2] > BODY.z1 + 15, 'and well past both ends');
  // every plate of the hull is well inside its inner rim
  let most = 0; for (const p of hullPoints()) most = Math.max(most, fromAxis(p));
  assert.ok(most < RING.r0 - 10, 'the hull reaches ' + most.toFixed(1) + ' m out from the ring\'s middle');
  // the ring is drawn where it is said to be: a panel's every corner in the ring's band (the one hanging loose aside)
  assert.equal(RING.panels, 24); assert.equal(RING.gone.length, 3); assert.ok(!RING.gone.includes(RING.loose));
});

test('the tower is shorter, so the ring clears it ("The tower may have to be shorter")', () => {
  // shape B's tower (rigs/station2-1/look.js) had its top at 44 m and a 12 m mast
  assert.ok(TOWER.top <= 44 - 5 && TOWER.mast < 12);
  const tower = oldStationPlans().find((p) => p.name === 'tower'), tops = tower.tiers[0].profile.map((q) => q[1]);
  assert.equal(Math.max(...tops), TOWER.top);
  const gap = ringAt(90, RING.r0)[1] - (TOWER.top + TOWER.mast + 1 + TOWER.beacon);
  assert.ok(gap >= 15, 'the beacon stands ' + gap.toFixed(1) + ' m under the ring');
});

test('six girders hold the ring, each on the roof, the underside or an end wall: none through a hangar, none in front of a door', () => {
  const arms = armsOf();
  assert.equal(arms.length, 6); assert.deepEqual(arms.map((a) => a.face), ['end', 'roof', 'roof', 'end', 'underside', 'underside']);
  for (const a of ARMS) assert.ok(footOf(a), 'arm at ' + a + ' meets the hull');
  // nothing straight up or down: the tower and the keel stand free in the gaps
  assert.ok(!ARMS.includes(90) && !ARMS.includes(270));
  // a hangar (its room, inside the body), and the way a ship leaves it (out of its door and on, 400 m)
  const rooms = HANGARS.map((h) => [[BODY.x0, BODY.x1], [-1, 12], [h.z - 13.5, h.z + 13.5]]), ways = HANGARS.map((h) => [[BODY.x1, BODY.x1 + 400], [-1, DOOR.h + 1], [h.z - DOOR.w / 2 - 1, h.z + DOOR.w / 2 + 1]]);
  for (const A2 of arms) {
    // (along each girder, its four corners every metre)
    const len = Math.hypot(...A2.to.map((v, k) => v - A2.from[k])), d = A2.to.map((v, k) => (v - A2.from[k]) / len), up = [0, d[2], -d[1]];
    for (let u = 0; u <= len; u += 1) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = [0, 1, 2].map((k) => A2.from[k] + d[k] * u + [1, 0, 0][k] * sx * 2.5 + up[k] * sy * 2.5);
      for (const b of rooms) assert.ok(!inBox(p, b), `the girder at ${A2.a}° goes through a hangar at ${p.map((v) => v.toFixed(1))}`);
    }
  }
  // nothing of the ring or its girders (the gear, but for the plain rooms behind the doors) in a ship's way out
  for (const p of pointsOf([G.lit, G.glow])) if (p[0] > BODY.x1 + 0.8) for (const b of ways) assert.ok(!inBox(p, b), 'in a ship\'s way out: ' + p.map((v) => v.toFixed(1)));
});

test('red, as ours is blue: the same small lean, turned; the "old and worn" look; most windows dark (power failing)', () => {
  const swap = (hex) => '#' + hex.slice(5, 7) + hex.slice(3, 5) + hex.slice(1, 3);
  assert.equal(OLD_TINT.grey, swap(STATION_LOOK.grey)); assert.equal(OLD_TINT.grey2, swap(STATION_LOOK.grey2));
  for (const [k, v] of Object.entries(HULL_LOOKS['old and worn'])) if (!(k in OLD_TINT)) assert.deepEqual(OLD_LOOK[k], v, k);
  assert.ok(LIT.hull <= 0.2 && LIT.tower <= 0.35);
  assert.ok(A.stats.lit / A.stats.windows < 0.3, `${A.stats.lit} of ${A.stats.windows} windows lit`);
  // (and three panels gone, one hanging loose: the gear draws 20 whole and the loose one)
  assert.equal(RING.panels - RING.gone.length, 21);
});

test('their old bridge stands out of the west face, away from the hangars, where our own dock is; a Hauler docked at its end clears everything', () => {
  assert.deepEqual(BRIDGE.out, [-1, 0, 0]); assert.equal(BRIDGE.at[0], BODY.x0 - PORT.proud); assert.equal(BRIDGE.at[1], 0);
  // the bridge's own numbers (kit/dockbridge.js DOCK) and the Hauler's size as it waits (src/haulerdock.js SIZE), read
  // from their files (they need three.js)
  const DOCKF = text('kit/dockbridge.js'), num = (k) => +DOCKF.match(new RegExp('\\b' + k + ':\\s*([\\d.]+)'))[1];
  const moduleAt = num('z0') + num('rings') * num('L') + num('gap'), R = num('R');
  const S = text('src/haulerdock.js').match(/SIZE = \{ x: \[([-\d.]+), ([-\d.]+)\], y: \[([-\d.]+), ([-\d.]+)\], z: \[([-\d.]+), ([-\d.]+)\]/).slice(1).map(Number);
  const wide = S[1] - S[0], long = S[5] - S[4], x0 = BRIDGE.at[0];
  const tube = [[x0 - moduleAt, x0], [-0.1, 2 * 1.42 + 0.1], [-R - 0.2, R + 0.2]];
  const hauler = [[x0 - moduleAt - wide - 0.5, x0 - moduleAt], [0, S[3] + 1.5], [-long, long]];   // (its door's place along it left open: as long again each way)
  for (const p of [...hullPoints(), ...pointsOf([G.lit, G.glow])]) {
    assert.ok(!inBox(p, hauler), 'in a docked Hauler\'s way: ' + p.map((v) => v.toFixed(1)));
    if (p[0] < x0 - 0.05) assert.ok(!inBox(p, tube), 'in the bridge\'s way: ' + p.map((v) => v.toFixed(1)));
  }
  // its port: in the west face, in the hangars' band, a doorway our airlock's size
  assert.ok(Math.abs(PORT.z) + PORT.w / 2 + PORT.jamb < BODY.z1 - BODY.cut && PORT.y >= LEVELS.band.foot && PORT.y + PORT.h < LEVELS.band.top);
});

test('built from our own kit, not copied: the hull builder, our body\'s cross-section, our girders and stand-in rooms, our bridge', () => {
  const plan = text('kit/oldstation-plan.js'), built = text('kit/oldstation.js');
  for (const name of ['bodyTiers', 'flatsOf', 'girder', 'standInHangar', 'Tris', 'boxPath', 'gearColour']) assert.match(plan, new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from './outside-plan.js'`), name);
  for (const own of [/class Tris/, /function boxPath/, /function flatsOf/, /function girder/]) assert.doesNotMatch(plan, own);
  assert.match(built, /import \{ buildHull \} from '\.\/hull\.js'/); assert.match(built, /import \{ wholeBridge \} from '\.\/dockbridge\.js'/);
});

test('cheap: its hull, ring and girders under our own outside\'s count in a few draws; the lab has its places to look from', () => {
  const draws = ['band', 'tiers', 'trim'].filter((k) => A.groups[k].index.length).length + 2 + 2;   // (+ glass, shields; + the gear and its lights)
  const tris = A.stats.triangles.all + G.lit.triangles + G.glow.triangles;
  assert.ok(tris < 40000, tris + ' triangles'); assert.ok(draws <= 7, draws + ' draws');
  for (const k of ['approach', 'hangars', 'bridge', 'side', 'above', 'below']) assert.ok(OLD_VIEWS[k] && OLD_VIEWS[k].name && OLD_VIEWS[k].at.length === 3);
  // the way round stays outside the ring
  assert.ok(ROUND.r > RING.r1 * 2);
});
