// The bridge job in the game, in plain numbers (src/bridgeplan.js): the engineer's pay by rating, the bridge's
// fingerprint, the ways named as the valley has them, where the builder's camera starts, and the travellers' two ways
// across the western river (over the bridge; upriver, by the road that wades it there: no ford beside the ravine). How it plays (the builder at the ravine, the test, the bridge
// standing and walked on, the travellers crossing) is checked in the game by real input:
// ~/pw/bandit-math/rigs/builders/bridge/play.cjs desk|phone.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAY, payFor, bridgeSig, wordsHere, sideView, ROUTES, CROSS_AT, wayFor, BRIDGE_SHARE } from '../src/bridgeplan.js';
import { CROSSING } from '../world/objects/landforms.js';
import { LOADS } from '../labs/bridge/frame.js';

test('the pay: one rising amount for each rating, each heavier one paying the difference, 200 in all', () => {
  assert.equal(PAY.length, LOADS.length, 'a pay for every load the test sends');
  for (let i = 1; i < PAY.length; i++) assert.ok(PAY[i] > PAY[i - 1], 'heavier pays more');
  assert.equal(payFor(-1, -1), 0, 'nothing carried, nothing paid');
  assert.equal(payFor(0, -1), PAY[0]);
  assert.equal(payFor(1, 0), PAY[1] - PAY[0], 'the horse after the person: the difference');
  assert.equal(payFor(1, 1), 0, 'the same rating again pays nothing more');
  assert.equal(payFor(0, 3), 0, 'a lighter rating after a heavier one pays nothing');
  // whatever the order the ratings come in, the whole top rating adds up to its own pay
  for (const path of [[0, 1, 2, 3, 4], [4], [1, 0, 3, 2, 4], [2, 2, 4]]) {
    let paid = -1, sum = 0;
    for (const r of path) { sum += payFor(r, paid); paid = Math.max(paid, r); }
    assert.equal(sum, PAY[4], path.join(','));
  }
});

test('a bridge\'s fingerprint: the same bridge the same, whatever the order of its boards; any change, or the deck, a new one', () => {
  const b = (x) => ({ id: 'b' + x, a: { X: x, Y: 0, Z: 3.5 }, b: { X: x + 8, Y: 0, Z: 3.5 }, len: 8 });
  const br = { boards: [b(-8.5), b(-4), b(0.5)] };
  assert.equal(bridgeSig(br, 24), bridgeSig({ boards: [...br.boards].reverse() }, 24));
  assert.notEqual(bridgeSig(br, 24), bridgeSig(br, 0), 'the deck counts');
  assert.notEqual(bridgeSig(br, 24), bridgeSig({ boards: br.boards.slice(1) }, 24), 'a board taken down');
  const moved = { boards: [b(-8.5), b(-4), { ...b(0.5), b: { X: 8.5, Y: 0.5, Z: 3.5 } }] };
  assert.notEqual(bridgeSig(br, 24), bridgeSig(moved, 24), 'a board moved');
});

test('the ways: the lab\'s frame turned a quarter (its east runs south), every word that names a way follows', () => {
  assert.equal(wordsHere('the west bank'), 'the north bank');
  assert.equal(wordsHere('the east bank'), 'the south bank');
  assert.equal(wordsHere('on the south side'), 'on the west side');
  assert.equal(wordsHere('on the north side'), 'on the east side');
  assert.equal(wordsHere('Looking North'), 'Looking East', 'capitals kept');
  assert.equal(wordsHere('Looking west'), 'Looking north');
  assert.equal(wordsHere('the board reaching 2 feet out from the west bank, on the south side'), 'the board reaching 2 feet out from the north bank, on the west side');
  assert.equal(wordsHere('westward and eastern'), 'northward and southern', 'the words built on them too');
});

test('the builder\'s camera starts on the bridge\'s east side (the engineer stands on the west), toward the rider\'s end', () => {
  for (const az of [-Math.PI / 2, -2, -1, 0.3, 1.2, Math.PI / 2, 3]) {
    const s = sideView(az);
    assert.ok(Math.cos(s) < 0, `${az}: the lab's north side (-Z), the valley's east`);
    // (from the north end, the north half; from the south end, the south half)
    if (Math.abs(Math.sin(az)) > 0.5) assert.equal(Math.sign(Math.sin(s)), Math.sign(Math.sin(az)), `${az}: toward the rider's end`);
  }
});

test('the two ways across: over the middle of the gap on the road\'s line, or upriver on the land\'s own road, far from the ravine', () => {
  const B = ROUTES.bridge, U = ROUTES.upriver;
  assert.deepEqual(Object.keys(ROUTES).sort(), ['bridge', 'upriver'], 'no other way (no ford)');
  for (const r of [B, U]) for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    assert.ok(d > 0.5 && d < 12, `points ${d.toFixed(1)} m apart`);
  }
  // over the bridge: north to south, never turning back, straight along the deck's middle line across the gap, and
  // nowhere else near the water
  for (let i = 1; i < B.length; i++) assert.ok(B[i][1] > B[i - 1][1] - 0.01, 'north to south, never turning back');
  const over = B.filter(([, z]) => Math.abs(z - CROSSING.z) < 4);
  assert.ok(over.length >= 2 && over.every(([x]) => Math.abs(x - CROSSING.x) < 0.01), 'on the deck\'s middle line over the gap');
  for (const [x, z] of B) assert.ok(Math.abs(x - CROSSING.x) < 22, `beside the ravine at ${x}, ${z}`);
  assert.deepEqual(CROSS_AT.bridge, [CROSSING.x, CROSSING.z], 'the bridge way crosses at the gap');
  // upriver: on the land's own roads all the way (the road off the west road, the crossing, the road on west), starting
  // off the west road itself (so it never shares it with the valley's wagons), crossing the river once where the road
  // wades it, and never within 150 m of the ravine
  const planting = JSON.parse(readFileSync(new URL('../models/town/planting.json', import.meta.url), 'utf8'));
  const line = (id) => planting.strokes.find((st) => st.id === id).pts;
  const offLine = (pts, x, z) => { let best = Infinity; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1))); best = Math.min(best, Math.hypot(ax + vx * t - x, az + vz * t - z)); } return best; };
  const roads = ['landpath13', 'landpath14', 'landpath15'].map(line), west = line('landpath4');
  for (const [x, z] of U) {
    assert.ok(Math.min(...roads.map((r) => offLine(r, x, z))) < 0.5, `off the road at ${x}, ${z}`);
    assert.ok(Math.hypot(x - CROSSING.x, z - CROSSING.z) > 150, `near the ravine at ${x}, ${z}`);
  }
  assert.ok(offLine(west, ...U[0]) > 10, 'it starts off the west road (well clear of its wagons\' lane)');
  const at = CROSS_AT.upriver; assert.ok(offLine(U, at[0], at[1]) < 1.5, 'it passes over where it crosses the river');
  assert.ok(U[0][1] < at[1] - 40 && U[U.length - 1][0] < at[0] - 40, 'from the town\'s side of the river to the far side');
});

test('which way a traveller takes: upriver unless the bridge carries its kind, then over the bridge about half the time', () => {
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 200; i++) assert.equal(wayFor(false, rand), 'upriver', 'a kind the bridge can\'t carry always goes upriver');
  let over = 0; for (let i = 0; i < 2000; i++) if (wayFor(true, rand) === 'bridge') over++;
  assert.ok(BRIDGE_SHARE > 0 && BRIDGE_SHARE < 1, 'the road upriver keeps some of them');
  assert.ok(Math.abs(over / 2000 - BRIDGE_SHARE) < 0.05, `over the bridge ${(over / 20).toFixed(0)}% of the time`);
});
