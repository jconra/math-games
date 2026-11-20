// THE PEOPLE AT WORK IN THE CONTROL ROOM AND IN CARGO (2026-11-20, the game's maker: "One crew member always sitting
// at the radio desk and one at traffic control, and one at the store's shipping desk", "I'd like a few people in each
// place"), as life.js has them: four in each place, the radio operator and the traffic controller only ever at their
// desks, the shipping clerk at the shipping desk, every step of everyone's day in their own place, and every spot,
// seat and talking spot of theirs where the station file has the room's floor clear: inside the room, off the desks,
// the racks, the benches and the lift. (How they look at work is the pictures' business: ~/pw/space-math/shots/lift-2/.)
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOM_CREW, ROSTER, SPOTS, SEATS, TALKS, APART } from '../src/life.js';
import { STOPS, TOWER, towerCorners, DESKS, DESK, STORE, storeBlocks, LIFT } from '../kit/places-plan.js';

const S = JSON.parse(readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
const room = (id) => S.rooms.find((r) => r.id === id);
const ROOM_OF = Object.fromEntries(STOPS.map((s) => [s.id, s.room]));      // (the lift's place -> the station file's room)
const steps = (P) => P.day.map((d) => { const [kind, group] = d.do.split(':'); return { kind, group, d }; });
// a quarter turn of the grid, as a placement's offset is turned (kit/grid.js; tests/lift.test.mjs at())
const turned = (x, z, t) => { for (let i = 0; i < t; i++) [x, z] = [z, -x]; return [x, z]; };
function placed(pl, grid) {
  const t = (((pl.turn || 0) % 4) + 4) % 4, [ox, oz] = turned((pl.off || [0, 0, 0])[0], (pl.off || [0, 0, 0])[2], t);
  return { x: pl.cell[0] * 2 + ox, y: (grid ? grid.deck : 0) + (pl.off || [0, 0, 0])[1], z: pl.cell[1] * 2 + oz, t };
}
// where a spot of life.js is in the station (each piece it names, or the first): { x, y, z, face }
function pointsOf(def) {
  const R = room(def.room), L = R.pieces.filter((p) => p.piece === def.piece && (!def.variant || p.variant === def.variant));
  return (def.all ? L : L.slice(0, 1)).map((pl) => {
    const o = placed(pl, R.grid), [lx, lz] = turned(def.local[0], def.local[2], o.t), f = def.face ? turned(def.face[0], def.face[1], o.t) : null;
    return { x: o.x + lx, y: o.y + def.local[1], z: o.z + lz, face: f };
  });
}
// a talking spot's two places, APART along the way it faces
const talkPlaces = (def) => pointsOf(def).flatMap((p) => { const L = Math.hypot(...p.face); return [-1, 1].map((s) => ({ x: p.x + p.face[0] / L * APART / 2 * s, y: p.y, z: p.z + p.face[1] / L * APART / 2 * s })); });

// ── where a person can stand in each place ──
const T0 = { x: TOWER.x, z: TOWER.z }, C = towerCorners();
const inTower = (x, z, m) => C.every((a, i) => { const b = C[(i + 1) % 8], cross = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]); return cross * Math.sign((b[0] - a[0]) * (0 - a[1]) - (b[1] - a[1]) * (0 - a[0])) > m * Math.hypot(b[0] - a[0], b[1] - a[1]); });
const deskBoxes = DESKS.map((d) => ({ kind: d.kind, box: d.turn % 2 ? [d.at[0] - DESK.deep / 2, d.at[0] + DESK.deep / 2, d.at[1] - d.long / 2, d.at[1] + d.long / 2] : [d.at[0] - d.long / 2, d.at[0] + d.long / 2, d.at[1] - DESK.deep / 2, d.at[1] + DESK.deep / 2] }));
const inBox = (x, z, b, m) => x > b[0] - m && x < b[1] + m && z > b[2] - m && z < b[3] + m;
const chairs = (id) => room(id).pieces.filter((p) => p.piece === 'chair').map((p) => placed(p, room(id).grid));
const LIFT_OUT = LIFT.half + LIFT.wall;
// (Cargo's: the plan's racks, pallets waiting and containers (places-plan.js storeBlocks), and the benches, the shipping
// desk and the scale's readout post by their own feet as the station file places them: the plan's patches for the
// benches and the desk take in the floor round them, where people stand to work at them)
function cargoBlocks() {
  const out = storeBlocks().filter((B) => B.what !== 'the packing benches' && B.what !== 'the shipping desk'), R = room('store');
  const foot = (piece, hx, hz, what) => { for (const pl of R.pieces.filter((p) => p.piece === piece)) { const o = placed(pl, R.grid); out.push({ what, box: [o.x - hx, o.x + hx, o.z - hz, o.z + hz] }); } };
  foot('bench', 1.8, 0.45, 'a packing bench'); foot('shipDesk', 1.8, 0.4, 'the shipping desk');
  for (const pl of R.pieces.filter((p) => p.piece === 'scale')) { const o = placed(pl, R.grid); out.push({ what: 'the scale\'s post', box: [o.x - 1.81, o.x - 1.69, o.z - 1.81, o.z - 1.69] }); }
  return out;
}
function clearIn(place, p, why) {
  if (place === 'tower') {
    const x = p.x - T0.x, z = p.z - T0.z;
    assert.ok(Math.abs(p.y - TOWER.floor) < 0.01, why + ': on the control room\'s floor');
    assert.ok(inTower(x, z, 0.45), why + ': inside the room, clear of its windows');
    assert.ok(Math.abs(x) > LIFT_OUT + 0.35 || Math.abs(z) > LIFT_OUT + 0.35, why + ': clear of the lift');
    for (const d of deskBoxes) assert.ok(!inBox(x, z, d.box, 0.3), why + ': clear of the ' + d.kind + ' desk');
    for (const c of chairs('tower')) assert.ok(Math.hypot(c.x - p.x, c.z - p.z) > 0.6, why + ': clear of a chair');
  } else {
    assert.ok(Math.abs(p.y - STORE.floor) < 0.15, why + ': on Cargo\'s floor');
    assert.ok(p.x > STORE.x0 + 0.45 && p.x < STORE.x1 - 0.45 && p.z > STORE.z0 + 0.45 && p.z < STORE.z1 - 0.45, why + ': inside Cargo, clear of its walls');
    const [[ax, az], [bx, bz]] = STORE.cut, side = (bx - ax) * (p.z - az) - (bz - az) * (p.x - ax), mid = (bx - ax) * (20 - az) - (bz - az) * (10 - ax);
    assert.ok(Math.sign(side) === Math.sign(mid), why + ': on the room\'s side of the slanting wall');
    for (const B of cargoBlocks()) assert.ok(!inBox(p.x, p.z, B.box, 0.3), why + ': clear of ' + B.what);
    const L = STOPS.find((s) => s.id === 'store').at; assert.ok(!inBox(p.x, p.z, [L[0] - LIFT_OUT, L[0] + LIFT_OUT, L[2] - LIFT_OUT, L[2] + LIFT_OUT], 0.35), why + ': clear of the lift');
  }
}

test('four people in each place: the control room and Cargo, nobody of the station\'s own roster', () => {
  const by = (p) => ROOM_CREW.filter((P) => P.place === p);
  assert.equal(by('tower').length, 4); assert.equal(by('store').length, 4);
  assert.equal(ROOM_CREW.length, 8, 'nobody anywhere else');
  const ids = new Set(ROSTER.map((P) => P.id)), names = new Set(ROSTER.map((P) => P.name));
  for (const P of ROOM_CREW) {
    assert.ok(!ids.has(P.id) && !names.has(P.name), P.id + ' is someone new');
    assert.ok(P.look && P.look.suit && P.look.head && P.voice, P.id + ' has a look and a voice');
  }
  assert.equal(new Set(ROOM_CREW.map((P) => P.name)).size, 8, 'eight names');
});

test('one always at the radio desk, one always at traffic control, one at the shipping desk', () => {
  const who = (id) => ROOM_CREW.find((P) => P.id === id);
  assert.deepEqual(steps(who('radio-rhea')).map((s) => s.d.do), ['sit:radioSeat'], 'the radio operator only sits at the radio desk');
  assert.deepEqual(steps(who('traffic-milo')).map((s) => s.d.do), ['sit:trafficSeat'], 'the traffic controller only sits at traffic control');
  for (const s of steps(who('radio-rhea')).concat(steps(who('traffic-milo')))) assert.ok(s.d.p == null, 'every time round');
  // the shipping clerk: sitting at it, and now and then up to its printer, at the same desk
  const gus = steps(who('clerk-gus'));
  assert.equal(gus[0].d.do, 'sit:shipSeat'); assert.ok(gus[0].d.p == null);
  assert.ok(gus.every((s) => s.d.do === 'sit:shipSeat' || s.d.do === 'stand:printer'));
  // (the desks' seats: two chairs at each control room desk, one at the shipping desk, each within 2 m of its desk)
  const want = { radioSeat: ['tower', 'radio', 2], trafficSeat: ['tower', 'traffic', 2], readoutsSeat: ['tower', 'readouts', 2], announceSeat: ['tower', 'announce', 2], shipSeat: ['store', null, 1] };
  for (const [g, [r, variant, n]] of Object.entries(want)) {
    const [d] = SEATS[g]; assert.equal(d.room, r); assert.equal(d.face, 'own');
    const desk = room(r).pieces.filter((p) => p.piece === d.near.piece && (!d.near.variant || p.variant === d.near.variant)).map((p) => placed(p, room(r).grid));
    assert.equal(desk.length, 1, g + ': its desk');
    assert.equal(variant ? d.near.variant : null, variant);
    const at = chairs(r).filter((c) => Math.hypot(c.x - desk[0].x, c.z - desk[0].z) < 2);
    assert.equal(at.length, n, g + ': ' + n + ' chair(s) at the desk');
  }
});

test('the rest work at the desks, stand about, talk and walk about: their whole day in their own place', () => {
  const kinds = new Set();
  for (const P of ROOM_CREW) for (const { kind, group } of steps(P)) {
    kinds.add(kind);
    if (kind === 'drive') continue;      // (a machine of their room's, not a spot: Cargo's forklift, tests/forklift.test.mjs)
    const defs = kind === 'sit' ? SEATS[group] : kind === 'talk' ? TALKS[group] : SPOTS[group];
    assert.ok(defs && defs.length, `${P.id}: ${kind}:${group} is a group of life.js`);
    for (const d of defs) assert.equal(d.room, ROOM_OF[P.place], `${P.id}: ${group} is in their own place`);
  }
  for (const k of ['sit', 'stand', 'walk', 'talk']) assert.ok(kinds.has(k), 'someone does ' + k);
  // (a few more about each room than the desks' three: in each place someone walking and someone standing at work)
  for (const place of ['tower', 'store']) {
    const crew = ROOM_CREW.filter((P) => P.place === place);
    assert.ok(crew.some((P) => steps(P).some((s) => s.kind === 'walk')), place + ': someone walks about the room');
    assert.ok(crew.some((P) => steps(P).some((s) => s.kind === 'stand' && s.d.clip === 'reach')), place + ': someone at work on their feet');
  }
});

test('every spot, seat and talking spot of theirs is where a person can stand in that place', () => {
  const used = new Map();
  for (const P of ROOM_CREW) for (const { kind, group } of steps(P)) used.set(kind + ':' + group, P.place);
  for (const [key, place] of used) {
    const [kind, group] = key.split(':');
    if (kind === 'sit' || kind === 'drive') continue;      // (the seats are the room's own chairs, above; the forklift: tests/forklift.test.mjs)
    const defs = kind === 'talk' ? TALKS[group] : SPOTS[group];
    for (const d of defs) {
      const pts = kind === 'talk' ? talkPlaces(d) : pointsOf(d);
      assert.ok(pts.length, key + ': the station file has its piece');
      for (const p of pts) clearIn(place, p, `${key} at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
    }
  }
  // the walks round each room go round the lift: no stretch of them crosses it
  for (const [g, place] of [['towerRound', 'tower'], ['cargoRound', 'store']]) {
    const pts = SPOTS[g].flatMap(pointsOf), L = STOPS.find((s) => s.id === place).at;
    assert.ok(pts.length >= 4, g);
    if (place === 'tower') for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; for (let k = 0; k <= 20; k++) { const x = a.x + (b.x - a.x) * k / 20, z = a.z + (b.z - a.z) * k / 20; assert.ok(!inBox(x, z, [L[0] - LIFT_OUT, L[0] + LIFT_OUT, L[2] - LIFT_OUT, L[2] + LIFT_OUT], 0.4), g + ' passes clear of the lift'); } }
  }
});
