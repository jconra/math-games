// THE LIFT, THE CONTROL ROOM AND THE STORE ROOM (2026-11-19), as the plain numbers say them: the lift's rules (which
// box a player is in, the same spot in the box at the other stop, the panel's choices, the words it says), the boxes
// where the plan and the station file put them, and the two places laid out as the agreed drawings have them, nothing
// overlapping and a clear way to walk. (What they look like is the pictures' business: ~/pw/space-math/shots/lift-1/.)
//   node --test pi-nebula/tests/lift.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIFT, STOPS, TOWER, towerCorners, DESKS, DESK, STORE, SLOT, RACKS, baysOf, FLOOR, storeBlocks } from '../kit/places-plan.js';
import { stopIn, carry, choices, placeOf, dirOf, words, RIDE } from '../src/liftrules.js';
import { SPIRE, SLOTS, DOCK, DECK_PATH, outsidePlans } from '../kit/outside-plan.js';

const S = JSON.parse(readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
const room = (id) => S.rooms.find((r) => r.id === id);
const stop = (id) => STOPS.find((s) => s.id === id);
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
// where a placement is, in metres (kit/grid.js: 2 m cells, off turned with the piece, a room's own grid's deck)
function at(pl, grid = null) {
  let [ox, oy, oz] = pl.off || [0, 0, 0];
  for (let i = 0; i < (((pl.turn || 0) % 4) + 4) % 4; i++) [ox, oz] = [oz, -ox];
  return { x: pl.cell[0] * 2 + ox, y: (grid ? grid.deck : 0) + oy, z: pl.cell[1] * 2 + oz };
}
const overlap = (a, b, gap = 0) => a[0] < b[1] - gap && b[0] < a[1] - gap && a[2] < b[3] - gap && b[2] < a[3] - gap;
const liftBox = (s, out = LIFT.half + LIFT.wall) => [s.at[0] - out, s.at[0] + out, s.at[2] - out, s.at[2] + out];

test('the lift: three stops, top to bottom, each the same box the same way round', () => {
  assert.deepEqual(STOPS.map((s) => s.id), ['tower', 'deck', 'store']);
  assert.ok(STOPS[0].at[1] > STOPS[1].at[1] && STOPS[1].at[1] > STOPS[2].at[1]);
  assert.ok(STOPS.every((s) => s.turn === 1), 'every doorway faces east');
  // plan_1, place A: on the spine's west side just south of the junction (the drawings' x 12 to 14, z 28 to 30: the
  // station's cell [6, 14], x 11 to 13 and z 27 to 29); the store's box straight under it; the tower's in the middle
  assert.deepEqual(stop('deck').at, [12, 0, 28]);
  assert.equal(stop('store').at[0], stop('deck').at[0]); assert.equal(stop('store').at[2], stop('deck').at[2]);
  assert.equal(stop('tower').at[0], TOWER.x); assert.equal(stop('tower').at[2], TOWER.z);
  assert.ok(near(TOWER.x, SPIRE.x) && near(TOWER.z, SPIRE.z), 'the control room is in the tower');
});

test('the lift: which box a player is in', () => {
  for (const s of STOPS) {
    assert.equal(stopIn(s.at), s.id, s.id + ': its middle');
    assert.equal(stopIn([s.at[0] + 0.7, s.at[1], s.at[2] - 0.7]), s.id, s.id + ': by a corner, inside');
    assert.equal(stopIn([s.at[0] + 1.6, s.at[1], s.at[2]]), null, s.id + ': out of its doorway');
    assert.equal(stopIn([s.at[0], s.at[1] + 3, s.at[2]]), null, s.id + ': on the floor above');
  }
  assert.equal(stopIn({ x: 15, y: 0, z: 28 }), null, 'in the spine');
  assert.equal(stopIn([12, -2.4, 28]), null, 'between the deck and the store');
});

test('the lift: the same spot and the same way round in the box at the other stop', () => {
  for (const a of STOPS) for (const b of STOPS) {
    const c = carry(a.at, 0.3, a.id, b.id);
    c.at.forEach((v, i) => assert.ok(near(v, b.at[i], 1e-9)));
    assert.ok(near(c.heading, 0.3));
    const off = carry([a.at[0] + 0.5, a.at[1], a.at[2] - 0.3], 1, a.id, b.id);
    assert.equal(stopIn(off.at), b.id);
    assert.ok(near(off.at[0] - b.at[0], 0.5) && near(off.at[2] - b.at[2], -0.3) && near(off.at[1], b.at[1]));
  }
  assert.equal(carry([0, 0, 0], 0, 'deck', 'nowhere'), null);
});

test('the lift: its panel, its words, how long it takes', () => {
  assert.deepEqual(choices('deck').map((s) => s.id), ['tower', 'store']);
  assert.deepEqual(choices('tower').map((s) => s.id), ['deck', 'store']);
  assert.deepEqual(choices('store').map((s) => s.id), ['tower', 'deck']);
  assert.equal(dirOf('deck', 'tower'), 'up'); assert.equal(dirOf('deck', 'store'), 'down'); assert.equal(dirOf('store', 'tower'), 'up');
  assert.equal(words('deck', 'tower'), 'Going up to the control room');
  assert.equal(words('tower', 'store'), 'Going down to the store room');
  assert.equal(words('store', 'deck'), 'Going up to the main deck');
  assert.deepEqual(STOPS.map((s) => s.name), ['Control room', 'Main deck', 'Store room']);
  const total = RIDE.shut + RIDE.go + RIDE.open; assert.ok(total > 2 && total < 5, 'a ride is a few seconds');
  assert.equal(placeOf([40, TOWER.floor, 25]), 'tower'); assert.equal(placeOf([5, 0, 5]), 'deck'); assert.equal(placeOf([5, STORE.floor, 5]), 'store');
  assert.equal(placeOf([42, 12, 25]), 'deck', 'a hangar\'s catwalk is the main deck');
});

test('the station file: the boxes where the plan has them, the deck\'s let into the spine\'s wall', () => {
  const box = (r) => { const z = room(r); const p = z.pieces.find((q) => q.piece === 'liftBox'); return { ...at(p, z.grid), turn: p.turn, variant: p.variant }; };
  for (const s of STOPS) { const b = box(s.room); assert.ok(near(b.x, s.at[0]) && near(b.y, s.at[1]) && near(b.z, s.at[2]) && b.turn === s.turn, s.id); }
  assert.equal(box('lift').variant, 'deck');
  assert.equal(box('tower').variant, 'free ' + (Math.round((TOWER.ceiling - TOWER.floor - LIFT.h) * 1000) / 1000));
  assert.equal(box('store').variant, 'free ' + (STORE.h - LIFT.h));
  // the doorway: a door of its own between the box and the spine, on the spine's wall line, where the spine's wall was
  const d = room('door-lift'); assert.deepEqual(d.with, ['lift', 'spine-s']);
  assert.deepEqual(d.pieces[0].cell, [6.5, 14]); assert.equal(d.pieces[0].piece, 'liftDoor');
  const spine = room('spine-s').pieces.filter((p) => p.cell[0] === 6.5 && p.cell[1] === 14);
  assert.ok(!spine.some((p) => p.piece === 'wall'), 'no wall left across the doorway');
  assert.ok(spine.some((p) => p.piece === 'trim' && p.variant === 'cornice-grey'), 'a cornice over it, as every doorway has');
  assert.ok(room('spine-s').pieces.some((p) => p.piece === 'sign' && p.variant === 'TERMINAL'), 'the TERMINAL sign is still on the spine');
  assert.ok(S.portals.some((P) => P.a === 'spine-s' && P.b === 'lift' && P.door && P.door[0] === 13 && P.door[1] === 28));
  // nothing else stands in the box's cell on the main deck
  for (const r of S.rooms) if (r.id !== 'lift' && !r.grid) for (const p of r.pieces) if (p.piece === 'floor' || p.piece === 'ceiling') assert.ok(!(p.cell[0] === 6 && p.cell[1] === 14), 'a ' + p.piece + ' of ' + r.id + ' in the lift');
  // the control room and the store have no way in but the lift
  for (const id of ['tower', 'store']) assert.ok(!S.portals.some((P) => P.a === id || P.b === id), id + ' has no opening to any other room');
});

test('the control room: in the tower\'s control centre, under its roof, a desk at each side and the lift in the middle', () => {
  // the tower's band (kit/outside-plan.js spirePlan: 44.6 to 48 m, 3.4 m out from a 10 m square cut 2.2 m): the room is
  // inside it
  const band = { foot: 44.6, top: 48, half: 5 + 3.4, roof: 49.2 };
  assert.ok(TOWER.floor > band.foot && TOWER.top < band.top && TOWER.ceiling < band.roof);
  assert.ok(TOWER.half + TOWER.thick < band.half, 'its walls are inside the tower\'s');
  const legOut = 2.2 + 3.4 * (2 - Math.SQRT2), legIn = legOut - (band.half - TOWER.half) * (2 - Math.SQRT2);
  assert.ok(Math.abs(TOWER.leg - legIn) < 0.02, 'its corners are cut as the tower\'s are');
  const C = towerCorners(); assert.equal(C.length, 8);
  // a point is in the room if it is inside all eight walls
  const inside = (x, z, m = 0) => C.every((a, i) => { const b = C[(i + 1) % 8], cross = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]); return cross * Math.sign((b[0] - a[0]) * (0 - a[1]) - (b[1] - a[1]) * (0 - a[0])) > m * Math.hypot(b[0] - a[0], b[1] - a[1]); });
  const lift = liftBox({ at: [0, 0, 0] });
  const desks = DESKS.map((d) => { const along = d.turn % 2 ? [d.at[0] - DESK.deep / 2, d.at[0] + DESK.deep / 2, d.at[1] - d.long / 2, d.at[1] + d.long / 2] : [d.at[0] - d.long / 2, d.at[0] + d.long / 2, d.at[1] - DESK.deep / 2, d.at[1] + DESK.deep / 2]; return { ...d, box: along }; });
  assert.deepEqual(desks.map((d) => d.kind).sort(), ['announce', 'radio', 'readouts', 'traffic']);
  for (const d of desks) {
    for (const [x, z] of [[d.box[0], d.box[2]], [d.box[1], d.box[2]], [d.box[0], d.box[3]], [d.box[1], d.box[3]]]) assert.ok(inside(x, z, 0.25), d.kind + ' is inside the room, clear of its walls');
    assert.ok(!overlap(d.box, lift, -1.5), d.kind + ' is well clear of the lift');
    for (const e of desks) if (e !== d) assert.ok(!overlap(d.box, e.box, -0.8), d.kind + ' and ' + e.kind + ' leave a way between them');
    // its back to the windows: its front (+z at turn 0) faces the middle
    const th = d.turn * Math.PI / 2, fx = Math.sin(th), fz = Math.cos(th); assert.ok(fx * -d.at[0] + fz * -d.at[1] > 0, d.kind + ' faces the room');
  }
  // the radio desk looks over the dock (west), traffic control over the hangar doors (east)
  assert.ok(desks.find((d) => d.kind === 'radio').at[0] < 0 && desks.find((d) => d.kind === 'traffic').at[0] > 0);
  // a clear way round the lift: a ring 1.4 m out from its walls is in the room and clear of every desk
  for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2, r = 1.22 + 1.4, x = Math.cos(a) * r, z = Math.sin(a) * r; assert.ok(inside(x, z, 0.3)); for (const d of desks) assert.ok(!(x > d.box[0] - 0.3 && x < d.box[1] + 0.3 && z > d.box[2] - 0.3 && z < d.box[3] + 0.3), 'the way round the lift at ' + x.toFixed(1) + ', ' + z.toFixed(1) + ' runs into ' + d.kind); }
  // the station file: the room, the box, the four desks, two chairs at each
  const T = room('tower');
  assert.equal(T.pieces.filter((p) => p.piece === 'console').length, 4);
  assert.equal(T.pieces.filter((p) => p.piece === 'chair').length, 8);
  assert.equal(T.grid.deck, TOWER.floor);
});

test('the store: the whole lower level inside the deck\'s hull, its floor the cargo slots\' foot', () => {
  assert.equal(STORE.floor, SLOTS.foot);
  // the deck's outline (kit/outside-plan.js DECK_PATH) holds the store's every corner
  const inDeck = (x, z) => { let c = false; for (let i = 0, j = DECK_PATH.length - 1; i < DECK_PATH.length; j = i++) { const [xi, zi] = DECK_PATH[i], [xj, zj] = DECK_PATH[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  for (const [x, z] of [[STORE.x0 + 0.01, STORE.z1 - 0.01], [STORE.x1 - 0.01, STORE.z1 - 0.01], [STORE.x1 - 0.01, STORE.z0 + 0.01], ...STORE.cut]) assert.ok(inDeck(x, z) || inDeck(x + 0.05, z + 0.05), `${x}, ${z} is inside the deck`);
  assert.ok(STORE.floor + STORE.h < -0.7, 'its ceiling is under the deck\'s top');
  const deck = outsidePlans().find((p) => p.name === 'west deck'), foot = deck.tiers[0].profile[1][1];
  assert.ok(STORE.floor > foot, 'its floor is over the hull\'s slope');
  // about 30 m by 45 m, as the drawing has it
  assert.ok(STORE.x1 - STORE.x0 >= 30 && STORE.z1 - STORE.z0 >= 45);
  // the slots: the outside's own, and the containers' ends come in as far as the outside's containers do
  assert.deepEqual(SLOT.z, SLOTS.z); assert.deepEqual(SLOT.full, SLOTS.full);
  assert.ok(STORE.x0 > SLOTS.x + 0.35 && STORE.x0 < SLOTS.x + 0.5, 'the west wall stands just in from the slots\' face, in front of the walls between the slots outside');
  assert.ok(Math.abs(SLOT.end - (SLOTS.x - 0.45 + DOCK.in)) < 0.01);
});

test('the store: laid out as the agreed drawing, nothing overlapping, a clear way to walk', () => {
  // six rows of racks, aisles 3.7 m wide, stopping short of the east wall with a lane up it
  assert.equal(RACKS.z.length, 6);
  for (let i = 1; i < 6; i++) assert.ok(Math.abs(RACKS.z[i] - RACKS.z[i - 1] - RACKS.deep - 3.7) < 0.15, 'aisle ' + i);
  const ends = RACKS.z.map((_, i) => RACKS.x0[i] + baysOf(i) * RACKS.bay);
  assert.ok(ends.every((x) => STORE.x1 - x > 4), 'a lane up the east wall');
  assert.ok(RACKS.levels.length === 3 && RACKS.top < STORE.h - 0.3, 'two shelves over the floor, under the ceiling');
  // the scale north of container 01, out of the containers' way, by the cut corner
  const [sx0, sx1, sz0, sz1] = FLOOR.scale;
  assert.ok(sz1 < SLOT.z[0] - SLOT.box[0] / 2 - 1, 'north of container 01');
  assert.ok(sx0 > SLOT.end + 1, 'clear of the containers\' ends');
  // the cold store doors in the east wall, at the ends of two aisles
  const aisles = RACKS.z.slice(0, -1).map((z, i) => (z + RACKS.z[i + 1]) / 2);
  for (const d of FLOOR.cold) assert.ok(aisles.some((a) => Math.abs(a - d.z) < 0.2), 'cold store ' + d.n + ' at an aisle\'s end');
  // the forklift's place is left empty: nothing stands on it
  const blocks = [...storeBlocks(), { what: 'the scale', box: FLOOR.scale }, { what: 'the lift', box: liftBox(stop('store')) }];
  for (const b of blocks) assert.ok(!overlap(b.box, FLOOR.forklift), b.what + ' stands in the forklift\'s place');
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) assert.ok(!overlap(blocks[i].box, blocks[j].box), blocks[i].what + ' overlaps ' + blocks[j].what);
  // a clear way: a walk on a half-metre grid (a person 0.6 m wide) from the lift's doorway to every aisle, the scale,
  // the loading floor, both cold store doors, the benches and the forklift's place
  const step = 0.5, r = 0.35, nx = Math.ceil((STORE.x1 - STORE.x0) / step), nz = Math.ceil((STORE.z1 - STORE.z0) / step);
  const [[ax, az], [bx, bz]] = STORE.cut, wallFace = 0.3;
  const free = (x, z) => x > STORE.x0 + wallFace + r && x < STORE.x1 - wallFace - r && z > STORE.z0 + wallFace + r && z < STORE.z1 - wallFace - r
    && ((bx - ax) * (z - az) - (bz - az) * (x - ax)) / Math.hypot(bx - ax, bz - az) < -(wallFace + r)
    && !blocks.some((b) => x > b.box[0] - r && x < b.box[1] + r && z > b.box[2] - r && z < b.box[3] + r);
  const key = (i, k) => i * nz + k, seen = new Uint8Array(nx * nz), cell = (x, z) => [Math.round((x - STORE.x0) / step), Math.round((z - STORE.z0) / step)];
  const s = stop('store'), [i0, k0] = cell(s.at[0] + 1.8, s.at[2]); assert.ok(free(s.at[0] + 1.8, s.at[2]), 'the way out of the lift\'s doorway is clear');
  const queue = [[i0, k0]]; seen[key(i0, k0)] = 1;
  while (queue.length) { const [i, k] = queue.pop(); for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = k + dk; if (a < 0 || b < 0 || a >= nx || b >= nz || seen[key(a, b)]) continue; if (!free(STORE.x0 + a * step, STORE.z0 + b * step)) continue; seen[key(a, b)] = 1; queue.push([a, b]); } }
  const reach = (x, z, what) => { const [i, k] = cell(x, z); assert.ok(seen[key(i, k)], 'no clear way from the lift to ' + what); };
  aisles.forEach((z, i) => { reach(12, z, 'aisle ' + (i + 1)); reach(8, z, 'the west end of aisle ' + (i + 1)); });
  reach(1, 1, 'the scale\'s south side'); reach(0, 6, 'container 01'); reach(1.5, 17.6, 'the loading floor'); reach(22.5, 2, 'cold store 1'); reach(22.5, 12, 'cold store 2');
  reach(-1, 24.6, 'the packing benches'); reach(-1, 28.6, 'the shipping desk'); reach(6.9, 32.9, 'the forklift\'s place'); reach(22.5, -7, 'the lane\'s north end');
  // the station file: the shell, the box, a row of shelving for each row, most places on them with a pallet
  const R = room('store');
  assert.equal(R.grid.deck, STORE.floor);
  assert.equal(R.pieces.filter((p) => p.piece === 'rack').length, 6);
  const pallets = R.pieces.filter((p) => p.piece === 'pallet'), places = RACKS.z.reduce((n, _, i) => n + baysOf(i) * RACKS.levels.length * 2, 0);
  assert.ok(pallets.length > places * 0.6 && pallets.length <= places + FLOOR.waiting.length, `${pallets.length} pallets for ${places} places on the racks`);
  for (const p of pallets) { const q = at(p); assert.ok(RACKS.levels.some((y) => Math.abs(q.y - y - (y ? RACKS.beam : 0)) < 1e-6), 'a pallet on a shelf or the floor'); }
});
