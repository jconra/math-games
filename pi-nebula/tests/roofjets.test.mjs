// The small ships on the roof's landing pads (src/roofjets.js): the game's maker's own closed-canopy fighter, on each of
// the four pads or not, "50/50 each time the station exterior loads".
//   node --test pi-nebula/tests/roofjets.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JET, JET_PADS, jetsFor, jetBox } from '../src/roofjets.js';
import { PADS, SHELL_PADS } from '../kit/outside-plan.js';

test('four pads; each has a ship about one time in two, by the seed alone, each pad for itself', () => {
  assert.equal(JET_PADS.length, 4); assert.equal(PADS.length + SHELL_PADS.length, 4);
  assert.deepEqual(jetsFor(7), jetsFor(7), 'the same seed, the same pads');
  const N = 4000, on = [0, 0, 0, 0], many = [0, 0, 0, 0, 0]; let both01 = 0;
  for (let s = 0; s < N; s++) { const J = jetsFor(s * 7919 + 13), names = J.map((j) => j.pad); many[J.length]++; JET_PADS.forEach((p, i) => { if (names.includes(p.name)) on[i]++; }); if (names.includes(JET_PADS[0].name) && names.includes(JET_PADS[1].name)) both01++; }
  for (const [i, n] of on.entries()) assert.ok(n > N * 0.44 && n < N * 0.56, `${JET_PADS[i].name}: ${n} of ${N}`);
  // (every number of ships turns up: none about one start in sixteen, all four as often)
  for (const [k, want] of [1, 4, 6, 4, 1].entries()) assert.ok(Math.abs(many[k] / N - want / 16) < 0.04, `${k} ships: ${many[k]} of ${N}`);
  assert.ok(Math.abs(both01 / N - 0.25) < 0.04, 'one pad\'s coin says nothing of the next\'s: ' + both01);
});

test('a ship stands on its pad, inside its edge, its foot on the pad\'s top, nose out and only a little turned', () => {
  for (let s = 0; s < 300; s++) for (const j of jetsFor(s)) {
    const p = JET_PADS.find((q) => q.name === j.pad); assert.ok(p, j.pad);
    assert.deepEqual([j.at[0], j.at[2]], [p.x, p.z]); assert.ok(Math.abs(j.at[1] - p.top) < 1e-9 && p.top > 10, 'on the pad\'s top');
    assert.ok(Math.abs(j.yaw - p.yaw) <= JET.turn + 1e-9, 'turned no more than ' + JET.turn);
    // (nose out: east from the body's roof, west from the dock's top)
    assert.ok(Math.cos(j.yaw) * (p.x > 30 ? 1 : -1) > 0.9, `${p.name}: nose out`);
    const B = jetBox(j); assert.equal(B.position.length, 24); assert.equal(B.index.length, 36); assert.ok([...B.index].every((i) => i < 8));
    for (let i = 0; i < 8; i++) {
      const [x, y, z] = [B.position[i * 3], B.position[i * 3 + 1], B.position[i * 3 + 2]];
      assert.ok(Math.abs(x - p.x) <= p.half[0] && Math.abs(z - p.z) <= p.half[1], `${p.name}: its box inside the pad's edge (${(x - p.x).toFixed(1)}, ${(z - p.z).toFixed(1)} of ${p.half})`);
      assert.ok(y >= p.top - 1e-6 && y <= p.top + JET.tall + 1e-6);
    }
  }
});

test('the file is the game\'s maker\'s own fighter, lightened: one mesh under 5,000 triangles, about a megabyte and a half', () => {
  const b = fs.readFileSync(new URL(JET.file, new URL('../src/roofjets.js', import.meta.url)));
  assert.equal(b.toString('latin1', 0, 4), 'glTF'); assert.ok(b.length > 1.0e6 && b.length < 1.6e6, b.length + ' bytes');
  const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  let tris = 0; for (const m of j.meshes) for (const p of m.primitives) tris += j.accessors[p.indices].count / 3;
  assert.equal(j.meshes.length, 1); assert.ok(tris > 4000 && tris < 5000, tris + ' triangles');
  const acc = j.accessors[j.meshes[0].primitives[0].attributes.POSITION];
  assert.ok(Math.abs(acc.max[0] - acc.min[0] - 1) < 0.01 && Math.abs(acc.min[1]) < 1e-3, 'one unit long along x, its lowest point on the floor');
});
