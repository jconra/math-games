// the Ship Lab's emblem options (labs/ships/emblems.js): two or three designs each for the Miner, the Explorer and the
// Hauler, each small enough for its place on the hull (about the Medic's pulse line's size: 1.6 m along, 0.7 m tall)
import test from 'node:test';
import assert from 'node:assert/strict';
import { EMBLEMS, WIDTH } from '../labs/ships/emblems.js';

test('each of the three ships has two or three designs to pick from, and the Medic none (it has its own)', () => {
  assert.deepEqual(Object.keys(EMBLEMS).sort(), ['explorer', 'hauler', 'miner']);
  for (const E of Object.values(EMBLEMS)) {
    const n = Object.keys(E.designs).length;
    assert.ok(n >= 2 && n <= 3, `${n} designs`);
    assert.equal(E.colour.length, 3);
  }
});

test('every design is line art that fits its place: no wider than the Medic\'s line, no taller than its flank', () => {
  for (const [ship, E] of Object.entries(EMBLEMS)) {
    const k = E.spot.scale || 1, room = ship === 'hauler' ? [0.4, 0.42] : [0.85, 0.42];   // (the Hauler's panel is narrow)
    for (const [id, D] of Object.entries(E.designs)) {
      assert.ok(D.name && D.tip, `${ship} ${id} has a name and a tip`);
      for (const S of D.strokes) {
        assert.ok(S.pts.length >= 2, `${ship} ${id}: a stroke of one point`);
        for (const [x, y] of S.pts) {
          assert.ok(Number.isFinite(x) && Number.isFinite(y), `${ship} ${id}: a point not a number`);
          assert.ok(Math.abs(x * k) <= room[0] && Math.abs(y * k) <= room[1], `${ship} ${id}: (${x}, ${y}) outside its place`);
        }
      }
    }
  }
  assert.equal(WIDTH, 0.045);   // (the Medic's pulse line's own width)
});
