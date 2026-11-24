// THE RESCUE ON FOOT, the plain part (src/rescueplan.js): where the Medic stands as landed, its ramp toward the pods; the
// Medic's two patient beds as onbed beds (the starboard one got onto from its other side); the rescued's places, a bed
// while one is free and then a seat; getting out of a pod (onbed's own moves on the pod's bed) leaves them clear of it;
// lying on a patient bed, the back on its raised stretcher. node --test pi-nebula/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { medicStand, toWorld, toShip, patientBeds, bedToShip, seatsFor, choose, leanOn, restOrder, crewBeds, bedFor, nextShut, MEDIC, PATIENT, POD_OUT, OUT, ON } from '../src/rescueplan.js';
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
    // (its pads' top: under the item's height by what the kit's bed and stretcher leave, PATIENT.under)
    assert.ok(near(b.bed.top, +it.h - PATIENT.under, 1e-9));
  }
});

test('the rescued take their places in the game\'s maker\'s order: the patient beds, the crew room\'s bunk and bed, then the stools (the lab\'s first); nobody up on the lab\'s worktop', () => {
  // (RESC4-1 B: "after the patient beds, the crew room's bunk and bed, then stools"; and of two sat up on the lab's
  // worktop, 2026-11-23: "That look up kind of high ... we can do stools instead.")
  const places = placesOf(BP, { deck: DECK, cockpitFloor: COCKPIT ? COCKPIT.floor : 0.8, jobs: ['pilot', 'medic'] });
  const seats = seatsFor(places), order = restOrder(BP, DECK, places);
  assert.ok(seats.every((p) => p.kind === 'sit' && p.job !== 'pilot'));
  const firstCockpit = seats.findIndex((p) => p.cockpit);
  assert.ok(firstCockpit < 0 || seats.slice(firstCockpit).every((p) => p.cockpit), 'off the flight deck first');
  // (six rescued: two beds, the bunk, the bed, the lab's stool and the crew room's first: four stools for two of them)
  assert.deepEqual(order.slice(0, 6).map((c) => c.kind + ':' + c.place.id), ['bed:bed-p', 'bed:bed-s', 'bed:bunk', 'bed:bed', 'seat:lab-stool', 'seat:stool-1']);
  assert.deepEqual(order.slice(6, 8).map((c) => c.place.id), ['stool-2', 'stool-3']);
  assert.ok(order.every((c) => c.kind === 'bed' || c.kind === 'seat') && !order.some((c) => /^bench/.test(c.place.id)), 'nobody on the worktop');
  // (every stool is a seat of the blueprint's own: none added)
  for (const c of order.filter((q) => q.kind === 'seat' && !q.place.cockpit)) assert.ok(BP.items.some((it) => it.id === c.place.id && it.kind === 'bench'), c.place.id);
  const taken = new Set(), got = [];
  for (let k = 0; k < 6; k++) { const c = choose(order, taken); assert.ok(c, `person ${k + 1} has a place`); taken.add(c.place.id); got.push(c.place.id); }
  assert.equal(taken.size, 6, 'no place twice');
  // (a place the crew aboard are in is passed over: the next in the order)
  const busy = new Set(['bunk']), next = []; for (let k = 0; k < 6; k++) { const c = choose(order, new Set([...busy, ...next])); next.push(c.place.id); }
  assert.deepEqual(next, ['bed-p', 'bed-s', 'bed', 'lab-stool', 'stool-1', 'stool-2']);
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

// ── rescue-8 ──────────────────────────────────────────────────────────────────────────────────────────────────────
test('a patient bed\'s top is its stretcher\'s pads\' own top, as the kit builds it: under the item\'s height by what the base and the stretcher leave', () => {
  // (kit/shipparts/cabin/medbay.js patientBed: the base's top `pad` under the item's height, the stretcher's frame 0.02
  // under that; stretcher.js: its pads from 0.02 over its frame, `th` thick)
  const bay = fs.readFileSync(new URL('../kit/shipparts/cabin/medbay.js', import.meta.url), 'utf8'), str = fs.readFileSync(new URL('../kit/shipparts/cabin/stretcher.js', import.meta.url), 'utf8');
  const pad = +/top = o\.top \?\? 0\.8,.*?pad = ([\d.]+), bt = top - pad/.exec(bay)[1], frame = +/frame: r3\(bt - ([\d.]+)\)/.exec(bay)[1];
  const m = /yP = yF \+ ([\d.]+), th = ([\d.]+)/.exec(str), up = +m[1], th = +m[2], back = +/back: o\.back \?\? ([\d.]+)/.exec(bay)[1];
  assert.ok(near(PATIENT.under, pad + frame - up - th, 1e-9), `the pads' top is ${pad + frame - up - th} under the item's height`);
  assert.ok(near(PATIENT.back, back, 1e-9), 'and its back section is raised as the kit raises it');
  for (const b of patientBeds(BP, DECK)) assert.ok(near(b.bed.top, 0.8 - PATIENT.under, 1e-9));
});

test('on a patient bed each one\'s hips are placed by their own trunk, so their head comes onto the pillow; any other bed is as it is', () => {
  const [b] = patientBeds(BP, DECK);
  // (trunks, the hip joints' middle to the head's bone: short, middling, long)
  const zs = [0.5, 0.62, 0.7, 0.8, 1.2].map((t) => bedFor(b, { t }).z);
  for (let k = 1; k < zs.length; k++) assert.ok(zs[k] >= zs[k - 1], 'a longer trunk lies no nearer the head\'s wall');
  assert.equal(zs[0], PATIENT.hips, 'never nearer the wall than the back section\'s hinge');
  assert.equal(zs[zs.length - 1], PATIENT.most, 'nor further down the bed than its pads let the feet lie');
  // (between: the head's own bone over the pillow's middle, the trunk lying up the raised back)
  const mid = bedFor(b, { t: 0.7 });
  assert.ok(near(mid.z - 0.7 * Math.cos(PATIENT.back), PATIENT.head, 2e-3));
  assert.ok(PATIENT.head > 0.15 && PATIENT.head < 0.43, 'the pillow lies 0.15 to 0.43 m from the wall');
  assert.equal(mid.stand[1], mid.z, 'and they stand at its side where their hips will lie');
  assert.equal(mid.top, b.bed.top);
  // (the feet still on its pads, short of its foot: the stretcher's pads end 1.83 m from the wall)
  for (const who of WHO) for (const t of [0.55, 0.7, 0.8]) { const own = bedFor(b, { ...who, t }), p = pose('lying', 0, own, who); for (const f of p.feet) assert.ok(f[2] < 1.99, `feet at ${f[2]}`); }
  // (nobody's measures, or another kind of bed: the bed's own numbers)
  assert.equal(bedFor(b, null), b.bed);
  for (const c of crewBeds(BP, DECK)) assert.equal(bedFor(c, { t: 0.7 }), c.bed);
});

test('her paramedic goes to the nearest pod still shut, and aboard again when none is', () => {
  const pods = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 8, z: 0 }, { x: 12, z: 0 }].map((p) => ({ ...p, open: false }));
  // (down the row from where they come to it, never back and forth across it)
  let at = { x: 13, z: 5 }; const order = [];
  for (let k = 0; k < 4; k++) { const i = nextShut(pods, at); order.push(i); pods[i].open = true; at = pods[i]; }
  assert.deepEqual(order, [3, 2, 1, 0]);
  assert.equal(nextShut(pods, at), -1);
  // (one opened by someone else meanwhile is passed over)
  assert.equal(nextShut([{ x: 0, z: 0, open: true }, { x: 9, z: 0, open: false }], { x: 1, z: 0 }), 1);
});

test('getting out of a pod, the feet are carried over its front rim: higher than over a plain bed by the rim\'s own height', () => {
  const F = bedFrame(podScale()), plain = { ...F.bed, stand: [F.bed.edge + POD_OUT.stand, F.bed.z] }, pod = { ...plain, rim: POD_OUT.rim };
  assert.ok(POD_OUT.rim >= 0.07, 'the rim stands up to 7 cm over the pad\'s height');
  for (const who of WHO) {
    let over = 0;
    for (let t = 0; t <= SECS.swingout + 1e-9; t += 1 / 30) {
      const a = pose('swingout', t, plain, who), b = pose('swingout', t, pod, who);
      // (the same turn, the same hips; only the feet are higher, and never lower)
      assert.deepEqual(a.hips, b.hips); assert.equal(a.heading, b.heading);
      b.feet.forEach((f, i) => { assert.ok(f[1] >= a.feet[i][1] - 1e-9); over = Math.max(over, f[1] - a.feet[i][1]); });
      // (carried round, out past the pad's edge: clear of the rim's top)
      if (t / SECS.swingout > 0.25 && t / SECS.swingout < 0.5) for (const f of b.feet) if (f[0] > pod.edge) assert.ok(f[1] > pod.top + POD_OUT.rim + 0.04, `a foot at ${f} over the rim`);
    }
    assert.ok(near(over, POD_OUT.rim, 1e-6));
    // (and on their feet at the end as before: the last move is the plain one's)
    assert.deepEqual(pose('hopdown', SECS.hopdown, pod, who).feet, pose('hopdown', SECS.hopdown, plain, who).feet);
  }
});
