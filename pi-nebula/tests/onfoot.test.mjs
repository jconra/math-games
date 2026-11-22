// THE RESCUE ON FOOT, the plain part (src/rescueplan.js): where the Medic stands as landed, its ramp toward the pods; the
// Medic's two patient beds as onbed beds (the starboard one got onto from its other side); the rescued's places, a bed
// while one is free and then a seat; getting out of a pod (onbed's own moves on the pod's bed) leaves them clear of it;
// lying on a patient bed, the back on its raised stretcher. node --test pi-nebula/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { medicStand, toWorld, toShip, patientBeds, bedToShip, seatsFor, choose, leanOn, MEDIC, PATIENT, POD_OUT, OUT, ON } from '../src/rescueplan.js';
import { placesOf } from '../src/aboardplan.js';
import { pose, SECS } from '../src/onbed.js';
import { bedFrame, POD, podScale } from '../kit/stasispod-plan.js';
// (the Medic's cockpit floor over its deck: kit/ships/medic-built.js COCKPIT.floor, a three.js module)
const COCKPIT = { floor: 0.8 };

const BP = JSON.parse(fs.readFileSync(new URL('../kit/ships/' + MEDIC.bp + '.blueprint.json', import.meta.url)));
const DECK = BP.grid.deck;
// the eight people's builds, as onbed's tests have the patients' (thigh, shin, hips' half width, hip height standing)
const WHO = [{ a: 0.412, b: 0.469, w: 0.121, hs: 0.87 }, { a: 0.429, b: 0.506, w: 0.125, hs: 0.92 }, { a: 0.39, b: 0.45, w: 0.115, hs: 0.83 }];
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

test('the Medic is the one boarding.js boards: its blueprint, its cabin felt as finely, its ways passed at the same', () => {
  const src = fs.readFileSync(new URL('../src/boarding.js', import.meta.url), 'utf8');
  assert.match(src, new RegExp(`id: 'medic'.*bp: '${MEDIC.bp}'`));
  assert.match(src, new RegExp(`CABIN_WALLS = \\{ voxel: ${MEDIC.cabin.voxel}, r: ${MEDIC.cabin.r} \\}`));
  assert.match(src, new RegExp(`WAY_OPEN = ${MEDIC.wayOpen};`));
});

test('set down in the ring, the Medic turns its ramp side toward the pods, wherever they lie', () => {
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, L = { x: 12, y: 40, z: -7, flat: 18 };
    const pods = [0, 1, 2].map((i) => ({ x: L.x + Math.cos(a) * 25 + i, z: L.z + Math.sin(a) * 25 - i }));
    const S = medicStand(L, pods);
    assert.equal(S.side, 'port'); assert.equal(S.x, L.x); assert.equal(S.y, L.y); assert.equal(S.z, L.z);
    // (its port side, +x of its own frame, points at the pods' middle)
    const p = toWorld(S, [1, 0, 0]), cx = pods.reduce((s, q) => s + q.x, 0) / 3, cz = pods.reduce((s, q) => s + q.z, 0) / 3;
    const dx = cx - L.x, dz = cz - L.z, l = Math.hypot(dx, dz);
    assert.ok(near(p[0] - L.x, dx / l, 2e-3) && near(p[2] - L.z, dz / l, 2e-3), `turn ${k}`);
    // (and back again)
    const q = toShip(S, toWorld(S, [1.3, 1.74, -2.2])); assert.ok(near(q[0], 1.3, 1e-9) && near(q[1], 1.74, 1e-9) && near(q[2], -2.2, 1e-9));
  }
});

test('the two patient beds: heads at the hull, got onto from the bay floor toward the nose, the starboard one mirrored', () => {
  const B = patientBeds(BP, DECK);
  assert.equal(B.length, 2);
  const bay = BP.rooms.find((r) => r.id === 'bay');
  for (const b of B) {
    const it = BP.items.find((x) => x.id === b.id);
    // (the head's wall is the hull's side of its item; along it, away from the wall; it lies on the deck)
    const head = bedToShip(b, [0, 0, 0]), foot = bedToShip(b, [0, 0, 2]);
    assert.equal(head[0], b.side === 'port' ? it.rect[2] : it.rect[0]); assert.equal(head[1], DECK);
    assert.ok(Math.abs(foot[0]) < Math.abs(head[0]), 'runs inward');
    // (its open side, onbed's +x, is toward the nose: the bay's floor, past the item's forward edge)
    const out = bedToShip(b, [1, 0, 0]); assert.ok(near(out[2] - head[2], 1, 1e-9), b.id);
    assert.equal(b.mirror, b.side === 'starboard');
    // (where one stands at its side: on the bay's floor, clear of the item, inside the bay)
    const st = bedToShip(b, [b.bed.stand[0], 0, b.bed.stand[1]]);
    assert.ok(st[2] > it.rect[3] - 0.01 && st[2] < bay.rect[3], `${b.id} stand ${st}`);
    assert.ok(st[0] > bay.rect[0] && st[0] < bay.rect[2]);
    assert.equal(b.bed.top, +it.h);
  }
});

test('the rescued take a patient bed while one is free, then a seat (never the pilot\'s); six all find a place', () => {
  const places = placesOf(BP, { deck: DECK, cockpitFloor: COCKPIT ? COCKPIT.floor : 0.8, jobs: ['pilot', 'medic'] });
  const seats = seatsFor(places), beds = patientBeds(BP, DECK);
  assert.ok(seats.every((p) => p.kind === 'sit' && p.job !== 'pilot'));
  const firstCockpit = seats.findIndex((p) => p.cockpit);
  assert.ok(firstCockpit < 0 || seats.slice(firstCockpit).every((p) => p.cockpit), 'off the flight deck first');
  const taken = new Set(), got = [];
  for (let k = 0; k < 6; k++) { const c = choose(beds, seats, taken); assert.ok(c, `person ${k + 1} has a place`); taken.add(c.place.id); got.push(c.kind); }
  assert.deepEqual(got.slice(0, 2), ['bed', 'bed']);
  assert.ok(got.slice(2).every((k) => k === 'seat'));
  // (no place twice)
  assert.equal(taken.size, 6);
});

test('out of a pod: onbed\'s own moves end standing at its front, clear of the pod, feet never under the floor', () => {
  const F = bedFrame(podScale()), front = POD.his.wide / 2 * podScale();
  const bed = { ...F.bed, stand: [F.bed.edge + POD_OUT.stand, F.bed.z] };
  for (const who of WHO) {
    for (const m of OUT) for (let t = 0; t <= SECS[m] + 1e-9; t += 1 / 30) {
      const p = pose(m, t, bed, who);
      for (const f of p.feet) assert.ok(f[1] > -0.06, `${m} ${t.toFixed(2)}: a foot ${f[1].toFixed(3)} under the floor`);
    }
    const end = pose(OUT[OUT.length - 1], SECS[OUT[OUT.length - 1]], bed, who);
    // (the hips at the stand, upright, facing out of the pod's front; across the pod, the bed's x is the pod's z)
    assert.ok(near(end.hips[0], bed.stand[0], 1e-6) && near(end.hips[1], who.hs, 1e-6) && Math.abs(end.lean) < 1e-6);
    const podZ = F.toPod(end.hips[0], 0, end.hips[2])[2];
    assert.ok(podZ - front >= 0.15, `the hips ${(podZ - front).toFixed(3)} m past the pod's front`);
  }
});

test('lying on a patient bed: the back on the stretcher\'s raised back, the hips and the feet on its pad', () => {
  const b = patientBeds(BP, DECK)[0];
  for (const who of WHO) {
    for (const m of ON) for (let t = 0; t <= SECS[m] + 1e-9; t += 1 / 30) { const p = pose(m, t, b.bed, who); for (const f of p.feet) assert.ok(f[1] > -0.06, `${m}: a foot under the floor`); }
    const p = pose('lying', 0, b.bed, who), lean = leanOn(p.lean);
    assert.ok(near(lean, Math.PI / 2 - PATIENT.back, 1e-9));
    assert.ok(p.hips[1] > b.bed.top && p.hips[1] < b.bed.top + 0.2);
    // (the feet on the pad, short of its foot: the item is 2 m long)
    for (const f of p.feet) assert.ok(f[2] < 2.0 && Math.abs(f[0]) < b.bed.pad, `feet at ${f}`);
  }
  assert.equal(leanOn(0.4), 0.4);
});
