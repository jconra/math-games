// THE FORKLIFT'S ROUND IN CARGO (2026-11-20, the game's maker, FORK1-1, C: "Now and then one of Cargo's people drives it
// to carry a pallet: from the loading floor by the containers to the shelves, then parks it again"), as the plain
// numbers say it (kit/forkliftround.js): every round, from each pallet waiting to each place on the shelf, stays inside
// Cargo and clear of its racks, containers, benches, desk, scale and lift and of the other pallets; it parks back in its
// bay exactly as it stood; its forks go in under a pallet and carry it clear of the shelf's beam; on the first shelf
// (2026-11-20, the game's maker, FORK2-1, B) the pallet stands on the shelf's deck, going in and out over its beam and
// under the shelf above; its way keeps off the spots where Cargo's people stand to work. (How it looks driving is the
// pictures' business: shots/forklift-2/, shots/forklift-3/.)
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORKLIFT, forkliftScale, STORE, RACKS, FLOOR, CARGO, PALLET, baysOf, palletBox } from '../kit/places-plan.js';
import { TRUCK, FORKS, TURN, DRIVE, PARKED, PLACES, round, clearOf, nearestTo, palletFoot, axleOf, poseFor, outline, wallGap } from '../kit/forkliftround.js';
import { ROOM_CREW, SPOTS, TALKS, APART } from '../src/life.js';

const S = JSON.parse(readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
const store = S.rooms.find((r) => r.id === 'store');
const waiting = PLACES.filter((q) => !q.shelf), shelf = PLACES.filter((q) => q.shelf);
// (every round: each pallet waiting to each place on the shelf, and the other way, each shelf place back to each
// place waiting)
const all = () => [...waiting.flatMap((A) => shelf.map((B) => round(A.id, B.id))), ...shelf.flatMap((A) => waiting.map((B) => round(A.id, B.id)))];
// how near it may come to each thing (m): its carriage's face stops a few centimetres short of a rack's face (nothing of
// the rack stands out there at the floor's level but its posts' feet), its front wheels pass a rack's posts by 10 cm;
// the pallet over or under the place it works at (on the floor level under the first shelf's, or on the first shelf
// over the floor level's): its carriage passes over or under it, the rest of it (its mast's foot and top) 10 cm off
const MARGIN = { 'rack 6': 0.05, 'rack 6\'s posts': 0.09, 'the pallet it takes or leaves': -0.001, 'the pallet over or under the one it takes or leaves': 0.09, 'the walls': 0.6, 'the lift': 0.2 };
// (the first shelf: how high its deck is, the beam's top; the underside of the shelf over it)
const UP = RACKS.levels[1] + RACKS.beam, ABOVE = RACKS.levels[2];

test('the forklift\'s parts, read off the game\'s maker\'s file: wheels, forks and seat where a forklift has them', () => {
  const k = forkliftScale();
  assert.ok(TRUCK.front.x > 0 && TRUCK.front.x < TRUCK.face, 'the front axle under the mast, behind the forks');
  assert.ok(TRUCK.back.x < TRUCK.seat.x && TRUCK.back.x > TRUCK.rear, 'the back axle under the seat\'s back, inside its body');
  assert.ok(TRUCK.base > 1.4 && TRUCK.base < 2, 'between its axles ' + TRUCK.base.toFixed(2) + ' m');
  for (const w of [TRUCK.front, TRUCK.back]) assert.ok(Math.abs(w.y - w.r) < 0.02 && w.r > 0.2 && w.r < 0.35, 'a wheel on the floor, ' + (2 * w.r).toFixed(2) + ' m across');
  assert.ok(TRUCK.seat.y > 0.9 && TRUCK.seat.y < 1.2, 'its seat ' + TRUCK.seat.y.toFixed(2) + ' m up');
  assert.ok(FORKLIFT.carriage * k < TRUCK.face && FORKLIFT.face < FORKLIFT.forks[0] + 0.02, 'the carriage in front of the mast, the forks leave it at its face');
});

test('its pallets: four waiting on the loading floor by the containers, four places on the racks\' floor level and two on the first shelf over them, free at the start', () => {
  assert.equal(waiting.length, 4); assert.equal(shelf.filter((q) => !q.up).length, 4); assert.equal(shelf.filter((q) => q.up).length, 2);
  // (the first shelf's places: each over a place on the floor level, standing on the shelf's deck)
  for (const q of shelf.filter((q) => q.up)) {
    assert.ok(shelf.some((s) => !s.up && s.at[0] === q.at[0] && s.at[1] === q.at[1]), q.id + ' over a place on the floor level');
    assert.equal(q.y, UP, q.id + ' on the first shelf\'s deck, ' + UP.toFixed(2) + ' m up');
  }
  assert.ok(shelf.filter((q) => q.up).every((q) => !CARGO.pallets.some((p) => p.at === q.id)), 'the first shelf free at the start');
  // (on the loading floor's paint, south of container 03, the forklift's way up to each clear)
  for (const q of waiting) { const [x0, x1, z0, z1] = palletBox(q.at); assert.ok(x0 > STORE.x0 + 4 && x1 < 4.6 && z0 > 1.2 && z1 < 22.6, q.id + ' on the loading floor'); }
  for (let i = 1; i < waiting.length; i++) assert.ok(waiting[i].at[0] - waiting[i - 1].at[0] - PALLET.wide >= TRUCK.half * 2 - PALLET.wide + 0.3, 'room between pallets waiting for its body');
  // (the shelf: the last row's floor level, between its posts, in the rack)
  const row = RACKS.z.length - 1, rz = RACKS.z[row], posts = Array.from({ length: baysOf(row) + 1 }, (_, i) => RACKS.x0[row] + i * RACKS.bay);
  for (const q of shelf) {
    const [x0, x1, z0, z1] = palletBox(q.at);
    assert.ok(z0 > rz - RACKS.deep / 2 && z1 < rz + RACKS.deep / 2 + 0.06, q.id + ' in the rack, its front edge no more than a hand proud');
    assert.ok(posts.every((p) => x1 < p - 0.08 || x0 > p + 0.08), q.id + ' between the posts');
  }
  // (each pallet where nothing else stands; the room's own still pallets have left those places)
  const at = CARGO.pallets.map((p) => p.at);
  assert.equal(new Set(at).size, at.length);
  assert.ok(shelf.some((q) => !at.includes(q.id)), 'a place on the shelf free at the start');
  const placed = (pl) => { let [ox, , oz] = pl.off || [0, 0, 0]; for (let i = 0; i < (pl.turn || 0) % 4; i++) [ox, oz] = [oz, -ox]; return [pl.cell[0] * 2 + ox, (pl.off || [0, 0, 0])[1], pl.cell[1] * 2 + oz]; };
  for (const pl of store.pieces.filter((p) => p.piece === 'pallet').map(placed)) for (const q of PLACES) {
    const [x0, x1, z0, z1] = palletBox(q.at);
    assert.ok(Math.abs(pl[1] - q.y) > 0.5 || pl[0] + 0.6 < x0 || pl[0] - 0.6 > x1 || pl[2] + 0.5 < z0 || pl[2] - 0.5 > z1, 'a still pallet of the room\'s in the forklift\'s place ' + q.id);
  }
  // (the room's own on the first shelf stand at its deck's height too)
  assert.ok(store.pieces.filter((p) => p.piece === 'pallet').map(placed).some((pl) => Math.abs(pl[1] - UP) < 1e-6), 'the room\'s own pallets on the first shelf at ' + UP);
});

test('its forks: in under a pallet low, carrying it clear of the shelf\'s first beam', () => {
  const k = forkliftScale();
  assert.ok(FORKLIFT.blade * k + FORKS.low < PALLET.deck - 0.02, 'low: the blades under the pallet\'s deck');
  assert.ok(FORKLIFT.forks ? (0.017 * k + FORKS.low) > 0.01 : true, 'low: off the floor');
  assert.ok(palletFoot(FORKS.low) === 0 && palletFoot(FORKS.carry) > 0.05, 'the pallet on the floor with the forks low, lifted with them up');
  assert.ok(palletFoot(FORKS.carry) + PALLET.top < RACKS.levels[1] - 0.04, 'carried, its load clears the first beam');
  // (the carriage, up with them, stays under the beam too, and on its mast)
  const carriageTop = 0.324 * k + FORKS.carry;
  assert.ok(carriageTop < RACKS.levels[1] && carriageTop < FORKLIFT.mast, 'the carriage under the beam and on its mast');
});

test('the first shelf: the pallet stands on it, not over it nor in it, and goes in and out over its beam and under the shelf above', () => {
  const k = forkliftScale(), bladeLow = 0.017 * k, bladeTop = FORKLIFT.blade * k;
  // set down: the forks low there, the pallet's foot on the shelf's deck exactly, the blades between the two decks
  assert.equal(palletFoot(FORKS.upLow, UP), UP, 'set down, it stands on the shelf');
  assert.ok(bladeLow + FORKS.upLow > UP + 0.02, 'the blades over the shelf\'s deck (' + ((bladeLow + FORKS.upLow - UP) * 100).toFixed(1) + ' cm)');
  assert.ok(bladeTop + FORKS.upLow < UP + PALLET.deck - 0.02, 'the blades under the pallet\'s deck: free of it (' + ((UP + PALLET.deck - bladeTop - FORKS.upLow) * 100).toFixed(1) + ' cm)');
  // going in and coming out: its foot over the shelf's front beam, the tallest load under the shelf above
  const foot = palletFoot(FORKS.over);
  assert.ok(foot > UP + 0.015 && foot < UP + 0.03, 'its foot ' + ((foot - UP) * 100).toFixed(1) + ' cm over the beam');
  assert.ok(foot + PALLET.top < ABOVE - 0.015, 'the tallest load ' + ((ABOVE - foot - PALLET.top) * 100).toFixed(1) + ' cm under the shelf above going in');
  assert.ok(UP + PALLET.top < ABOVE - 0.03, 'and ' + ((ABOVE - UP - PALLET.top) * 100).toFixed(1) + ' cm under it standing there');
  // over the floor level's pallets under it: the forks, and a pallet on them
  assert.ok(bladeLow + FORKS.upLow > PALLET.top + 0.3 && foot > PALLET.top + 0.3, 'the forks and the pallet well over a load on the floor level');
  // the forks' frame rises past the top of the mast, as in the picture he saw; its face stays in front of the shelf
  // above's beam (3 cm proud of the rack's face), whose height it rises to
  const top = 0.324 * k + FORKS.over, q = PLACES.find((p) => p.up), face = poseFor(q.at, q.h).z - TRUCK.face, beam = RACKS.z.at(-1) + RACKS.deep / 2 + 0.03;
  assert.ok(top > FORKLIFT.mast + 0.3 && top > ABOVE, 'the forks\' frame ' + (top - FORKLIFT.mast).toFixed(2) + ' m over the top of the mast');
  assert.ok(face - beam > 0.03, 'its face ' + ((face - beam) * 100).toFixed(1) + ' cm in front of the shelf above\'s beam');
  // each round to the first shelf: up there only stopped short of the rack (a forks leg), slowly and straight in and
  // out, and down again before it turns away; never up while carrying it along the floor
  for (const R of all().filter((r) => [r.from, r.to].some((id) => PLACES.find((p) => p.id === id).up))) {
    let lift = FORKS.rest;
    R.legs.forEach((L, i) => {
      if (L.kind === 'forks') { lift = L.to; return; }
      const high = lift > FORKS.carry + 1e-6 || L.forks > FORKS.carry + 1e-6;
      assert.equal(!!L.up, high, R.from + ' to ' + R.to + ': leg ' + i + ' up only at the shelf');
      if (L.up) {
        assert.equal(L.speed, DRIVE.slow, 'slowly');
        assert.ok(L.way.every((p) => Math.abs(Math.sin(p.h - L.way[0].h)) < 1e-9) && Math.abs(L.way.at(-1).s - TURN.shortUp) < 1e-6, 'straight in or out, ' + TURN.shortUp + ' m');
      }
      lift = L.forks;
    });
    assert.ok(lift <= FORKS.carry, 'down at the end');
  }
});

test('every round stays inside Cargo, clear of everything in it, and parks back in its bay as it stood', () => {
  assert.equal(all().filter(Boolean).length, 48, 'twenty-four rounds each way (sixteen to the floor level, eight to the first shelf)');
  assert.equal(round('w0', 'w1'), null, 'never from the loading floor to the loading floor');
  for (const R of all()) {
    const name = R.from + ' to ' + R.to, drives = R.legs.filter((L) => L.kind === 'drive');
    // (from where it parks, back to where it parks, exactly; each leg on from where the one before ended)
    const first = drives[0].way[0], last = drives[drives.length - 1].way.at(-1);
    for (const p of [first, last]) assert.ok(Math.abs(p.x - PARKED.x) < 1e-6 && Math.abs(p.z - PARKED.z) < 1e-6 && Math.abs(p.h - PARKED.h) < 1e-6, name + ': parked at its place');
    for (let i = 1; i < drives.length; i++) { const a = drives[i - 1].way.at(-1), b = drives[i].way[0]; assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6 && Math.abs(Math.sin(a.h - b.h)) < 1e-6, name + ': leg ' + i + ' goes on from where the last ended'); }
    // (never a jump along a way: each pose a little on from the last, its turn too)
    for (const L of drives) for (let i = 1; i < L.way.length; i++) { const a = L.way[i - 1], b = L.way[i]; assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.08 && Math.abs(Math.sin(b.h - a.h)) < 0.05, name + ': a smooth way'); }
    // (it takes the pallet up where it stands and sets it down in its new place)
    assert.deepEqual(R.legs.filter((L) => L.take || L.leave).map((L) => L.take || L.leave), [R.from, R.to]);
    // (carrying only between)
    let carrying = false; for (const L of R.legs) { if (L.take) carrying = true; if (L.leave) carrying = false; if (L.kind === 'drive') assert.equal(L.carrying, carrying, name + ': carrying as it should'); }
    // clear of everything (the room's things, the walls, the other pallets as they stand at the start)
    const near = clearOf(R);
    for (const [what, v] of Object.entries(near)) assert.ok(v.gap >= (MARGIN[what] ?? 0.14), `${name}: ${what} only ${v.gap} m away, at ${v.at} (leg ${v.leg})`);
    // inside the room: every corner of it, every pose
    for (const L of drives) for (const p of L.way) for (const o of outline(p, L.carrying)) assert.ok(wallGap(o.c[0], o.c[1]) > 1, name + ': inside Cargo');
  }
});

test('its rounds keep off the spots where Cargo\'s people stand to work and talk, and someone of theirs drives it', () => {
  // (the pallets' spots from the north side, the talking spots, the containers, the scale, the benches)
  const pts = [];
  for (const g of ['pallets', 'containers', 'scale', 'benches', 'printer', 'cold']) for (const d of SPOTS[g]) if (d.piece === 'storeHall') pts.push([g, d.local[0], d.local[2]]);
  for (const d of TALKS.cargo) for (const s of [-1, 1]) pts.push(['talk', d.local[0] + d.face[0] * APART / 2 * s, d.local[2] + d.face[1] * APART / 2 * s]);
  for (const R of all()) for (const [g, x, z] of pts) { const n = nearestTo(R, [x, z]); assert.ok(n > 0.55, `${R.from} to ${R.to} comes ${n.toFixed(2)} m from a ${g} spot at ${x}, ${z}`); }
  const drivers = ROOM_CREW.filter((P) => P.place === 'store' && P.day.some((d) => d.do === 'drive:forklift'));
  assert.ok(drivers.length >= 1, 'someone of Cargo\'s drives it');
  // (now and then: a step of their day, not every time round)
  for (const P of drivers) assert.ok(P.day.find((d) => d.do === 'drive:forklift').p < 1 && P.day.length >= 5, P.id + ' drives it now and then');
  // (its lanes: south of the last racks, and past the lift's west side)
  assert.ok(TURN.lane - TURN.r > RACKS.z.at(-1) + RACKS.deep / 2 + 0.5 && TURN.lane < FLOOR.benches[2] - 1.2);
  assert.ok(axleOf(PARKED)[0] < TURN.west - TURN.r);
});
