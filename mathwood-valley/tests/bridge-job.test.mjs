// The bridge job in the game, in plain numbers (src/bridgeplan.js): the engineer's pay by rating, the bridge's
// fingerprint, the ways named as the valley has them, where the builder's camera starts, and the two ways across the
// western river (over the bridge, through the ford). How it plays (the builder at the ravine, the test, the bridge
// standing and walked on, the travellers crossing) is checked in the game by real input:
// ~/pw/bandit-math/rigs/builders/bridge/play.cjs desk|phone.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PAY, payFor, bridgeSig, wordsHere, sideView, ROUTES } from '../src/bridgeplan.js';
import { CROSSING, FORD } from '../world/objects/landforms.js';
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

test('the two ways across: the same ends; one over the middle of the gap on the road\'s line, the other through the ford', () => {
  const B = ROUTES.bridge, F = ROUTES.ford;
  assert.deepEqual(B[0], F[0], 'they start together on the north bank');
  assert.deepEqual(B[B.length - 1], F[F.length - 1], 'and end together on the south');
  for (const r of [B, F]) for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    assert.ok(d > 0.5 && d < 12, `points ${d.toFixed(1)} m apart`);
    assert.ok(r[i][1] > r[i - 1][1] - 0.01, 'north to south, never turning back');
  }
  // over the bridge: straight along the deck's middle line across the gap (x of the crossing)
  const over = B.filter(([, z]) => Math.abs(z - CROSSING.z) < 4);
  assert.ok(over.length >= 2 && over.every(([x]) => Math.abs(x - CROSSING.x) < 0.01), 'on the deck\'s middle line over the gap');
  // the ford: through the lane's own points where it crosses the river (its middle a dozen metres west of the road)
  const mid = F.filter(([, z]) => Math.abs(z - CROSSING.z) < 6);
  assert.ok(mid.length >= 2, 'it crosses the river');
  for (const [x, z] of mid) {
    const dl = Math.min(...FORD.pts.map(([fx, fz]) => Math.hypot(fx - x, fz - z)));
    assert.ok(dl < 1, `on the ford's lane (${dl.toFixed(2)} m)`);
    assert.ok(x < CROSSING.x - 10, 'well west of the road');
  }
});
