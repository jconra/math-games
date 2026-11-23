// THE RESCUE ON FOOT, the plain part (src/rescueplan.js): where the Medic stands as landed, its ramp toward the pods; the
// Medic's two patient beds as onbed beds (the starboard one got onto from its other side); the rescued's places, a bed
// while one is free and then a seat; getting out of a pod (onbed's own moves on the pod's bed) leaves them clear of it;
// lying on a patient bed, the back on its raised stretcher. node --test pi-nebula/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { medicStand, toWorld, toShip, patientBeds, bedToShip, seatsFor, choose, leanOn, restOrder, crewBeds, benchPerches, BENCH, MEDIC, PATIENT, POD_OUT, OUT, ON } from '../src/rescueplan.js';
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

test('the rescued take their places in the game\'s maker\'s order: the patient beds, the crew room\'s bunk and bed, the lab\'s bench, then the stools', () => {
  // (RESC4-1 B: "after the patient beds, the crew room's bunk and bed, then stools"; "They should be able to sit on the
  // bench in the lab area too. If I remember right there is a long bench there.")
  const places = placesOf(BP, { deck: DECK, cockpitFloor: COCKPIT ? COCKPIT.floor : 0.8, jobs: ['pilot', 'medic'] });
  const seats = seatsFor(places), order = restOrder(BP, DECK, places);
  assert.ok(seats.every((p) => p.kind === 'sit' && p.job !== 'pilot'));
  const firstCockpit = seats.findIndex((p) => p.cockpit);
  assert.ok(firstCockpit < 0 || seats.slice(firstCockpit).every((p) => p.cockpit), 'off the flight deck first');
  assert.deepEqual(order.slice(0, 6).map((c) => c.kind + ':' + c.place.id), ['bed:bed-p', 'bed:bed-s', 'bed:bunk', 'bed:bed', 'perch:bench.0', 'perch:bench.1']);
  assert.deepEqual(order.slice(6, 10).map((c) => c.place.id), ['lab-stool', 'stool-1', 'stool-2', 'stool-3']);
  const taken = new Set(), got = [];
  for (let k = 0; k < 6; k++) { const c = choose(order, taken); assert.ok(c, `person ${k + 1} has a place`); taken.add(c.place.id); got.push(c.place.id); }
  assert.equal(taken.size, 6, 'no place twice');
  // (a place the crew aboard are in is passed over: the next in the order)
  const busy = new Set(['bunk']), next = []; for (let k = 0; k < 6; k++) { const c = choose(order, new Set([...busy, ...next])); next.push(c.place.id); }
  assert.deepEqual(next, ['bed-p', 'bed-s', 'bed', 'bench.0', 'bench.1', 'lab-stool']);
  // (beds and seats given apart, as before: a bed while one is free, then a seat)
  const old = choose(patientBeds(BP, DECK), new Set(['bed-p', 'bed-s']), seats); assert.equal(old.kind, 'seat');
});

test('the crew room\'s bunk and bed: lain along, heads at the pillows\' ends, got onto from the room\'s floor, stood at clear of the bunk\'s step', () => {
  const B = crewBeds(BP, DECK), crew = BP.rooms.find((r) => r.id === 'crew');
  assert.deepEqual(B.map((b) => b.id), ['bunk', 'bed']);
  for (const b of B) {
    const it = BP.items.find((x) => x.id === b.id), [x0, z0, x1, z1] = it.rect;
    assert.ok(b.lie && b.back === 0);
    // (a proper turn: x = y cross z)
    assert.deepEqual(b.frame.x, [b.frame.z[2], 0, -b.frame.z[0]]);
    const head = bedToShip(b, [0, 0, 0]), foot = bedToShip(b, [0, 0, 1.9]), open = bedToShip(b, [b.bed.edge, 0, b.bed.z]);
    assert.ok(foot[0] >= x0 - 1e-9 && foot[0] <= x1 + 1e-9 && foot[2] >= z0 - 1e-9 && foot[2] <= z1 + 1e-9, `${b.id}: its foot on it`);
    const st = bedToShip(b, [b.bed.stand[0], 0, b.bed.stand[1]]);
    assert.ok(st[0] > crew.rect[0] && st[0] < crew.rect[2] && st[2] > crew.rect[1] && st[2] < crew.rect[3], `${b.id}: stood at inside the room`);
    // (stood at off the bed's own rect and off the room's low step)
    for (const o of BP.items.filter((q) => q.room === 'crew' && ((q.kind === 'bench' && +q.h <= 0.35) || q.id === b.id))) assert.ok(!(st[0] > o.rect[0] && st[0] < o.rect[2] && st[2] > o.rect[1] && st[2] < o.rect[3]), `${b.id}: stood at on ${o.id}`);
    if (b.id === 'bunk') { assert.equal(head[2], z1, 'the bunk\'s head at its cubby'); assert.equal(b.bed.top, 0.42); assert.ok(open[0] > (x0 + x1) / 2, 'got onto from the room, away from the hull'); }
    else { assert.equal(head[0], x0, 'the bed\'s head away from the kitchen counter'); assert.equal(b.bed.top, +it.h); assert.ok(open[2] > (z0 + z1) / 2, 'got onto from the room, away from the stern'); }
    // (lying there: the hips on the pad, the feet on it)
    for (const who of WHO) { const p = pose('lying', 0, b.bed, who); assert.ok(p.hips[1] > b.bed.top && p.hips[1] < b.bed.top + 0.2); for (const f of p.feet) assert.ok(f[2] < 2.0 && Math.abs(f[0]) < b.bed.pad + 1e-6, `${b.id} feet at ${f}`); }
  }
});

test('the lab\'s long bench: sat up on along its clear stretch, off its sink and out from under its shelves, the hop up from the aisle', () => {
  const P = benchPerches(BP, DECK), it = BP.items.find((x) => x.id === 'bench'), shelf = BP.items.find((x) => x.id === 'labshelf'), island = BP.items.find((x) => x.id === 'island');
  assert.ok(P.length >= 2, 'two on it');
  for (const p of P) {
    const z = bedToShip(p, [p.bed.edge - 0.13, 0, 0])[2];
    assert.ok(z > shelf.rect[3] + 0.2 && z < it.rect[3] - 0.5 + 0.01, `${p.id} at ${z}: clear of the shelves and the sink's column`);
    assert.equal(p.bed.top, +it.h); assert.ok(p.perch);
    // (facing out from the hull, the hop up from the aisle between the bench and the island)
    const st = bedToShip(p, [p.bed.stand[0], 0, 0]); assert.ok(st[0] > it.rect[2] && st[0] < island.rect[0], `${p.id} stood at ${st[0]}`);
    for (const who of WHO) {
      for (let t = 0; t <= SECS.hop + 1e-9; t += 1 / 30) { const q = pose('hop', t, p.bed, who); for (const f of q.feet) assert.ok(f[1] > -0.06, `hop ${t.toFixed(2)}: a foot under the floor`); }
      // (perched: the hips on its top, near its front edge; the feet off the floor)
      const end = pose('hop', SECS.hop, p.bed, who);
      assert.ok(end.hips[1] > p.bed.top && end.hips[1] < p.bed.top + 0.2 && end.hips[0] > p.bed.edge - 0.3 && end.hips[0] < p.bed.edge, JSON.stringify(end.hips));
      for (const f of end.feet) assert.ok(f[1] > 0.02, 'the feet off the floor ' + f);
    }
  }
  assert.ok(Math.abs(P[1].frame.o[2] - P[0].frame.o[2]) >= BENCH.gap - 1e-9, 'a body\'s width apart');
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
