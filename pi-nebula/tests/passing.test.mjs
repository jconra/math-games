// Two people meeting (src/passing.js, the plain part of src/people.js's walking, src/aboardplan.js's and src/player.js's
// bodies): never nearer than PASS.apart, middle to middle; met head on, each keeps to their own right and they pass;
// where the floor is too narrow for two (the Miner's mess past its table), the crew aboard turn back as before.
//   node --test pi-nebula/tests/passing.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PASS, passBy, bumps, roomAt, roomFor, facing } from '../src/passing.js';
import { placesOf, wayOf, walkStep, wayBack, floorOf } from '../src/aboardplan.js';

// THE GAME'S MAKER (2026-11-20): "It would be nice if people had hitboxes small enough to allow them to walk by each
// other, but not walk directly through each other. If everyone walked toward the right side then they should be able to
// pass eachother"

// (the station's people walk as src/people.js walk() does, its sums here: toward the way's end, steered by passBy for
// everyone in the lane (summed, held to 1.2, added sideways 1.2 times), turned at LIFE.turn, a step not taken that
// would come within PASS.apart of anyone (bumps), slid along a wall)
const LIFE = { turn: 3, lane: PASS.lane };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function stationStep(P, others, dt, free) {
  const gx = P.goal[0] - P.x, gz = P.goal[1] - P.z, gd = Math.hypot(gx, gz);
  if (gd < 0.08) { P.there = true; P.walking = false; return; }
  let dx = gx / gd, dz = gz / gd;
  const sx = -dz, sz = dx, myH = Math.atan2(dx, dz);
  let steer = 0, slow = 1;
  for (const Q of others) {
    const me = !!Q.player, coming = me ? Q.speed > 0.3 && facing(Q.heading, myH) : Q.walking && facing(Q.heading, myH);
    const r = passBy(dx, dz, Q.x - P.x, Q.z - P.z, { coming, player: me, walking: !me && Q.walking, lane: LIFE.lane });
    if (r) { steer += r.steer; slow = Math.min(slow, r.slow); }
  }
  steer = Math.max(-1.2, Math.min(1.2, steer));
  dx += sx * steer * 1.2; dz += sz * steer * 1.2;
  const L = Math.hypot(dx, dz); dx /= L; dz /= L;
  const diff = wrap(Math.atan2(dx, dz) - P.heading);
  P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * dt));
  if (Math.abs(diff) > 1.3) return;
  const step = Math.min(gd, P.speed * slow * dt);
  let nx = P.x + dx * step, nz = P.z + dz * step;
  if (!free(nx, nz)) { if (free(P.x, nz)) nx = P.x; else if (free(nx, P.z)) nz = P.z; else return; }
  if (bumps(P.x, P.z, nx, nz, others)) return;
  P.x = nx; P.z = nz;
}
// (a hall, `wide` metres across, x = 0 its middle, running along z; a body 0.26 m across each way against its walls, as
// the station's people walk: src/people.js walls.move(..., 0.26))
const hall = (wide) => (x) => Math.abs(x) <= wide / 2 - 0.26;
const walker = (x, z, goal, speed = 1.2) => ({ x, z, goal, speed, heading: Math.atan2(goal[0] - x, goal[1] - z), walking: true, there: false });
function twoInAHall(wide, bOff = 0, secs = 20) {
  const free = hall(wide), A = walker(0, -6, [0, 6]), B = walker(bOff, 6, [bOff, -6], 1.1), dt = 1 / 30;
  let nearest = Infinity, abreast = null;
  for (let t = 0; t < secs && !(A.there && B.there); t += dt) {
    const zb = B.z - A.z;
    stationStep(A, B.there ? [] : [B], dt, free); stationStep(B, A.there ? [] : [A], dt, free);
    nearest = Math.min(nearest, Math.hypot(A.x - B.x, A.z - B.z));
    // (where each was as they went by each other: A going up the hall (its right: -x), B coming down it (its right: +x))
    if (abreast == null && Math.sign(B.z - A.z) !== Math.sign(zb)) abreast = { a: A.x, b: B.x };
  }
  return { A, B, nearest, abreast };
}

test('the body: two people\'s middles never nearer than PASS.apart; a step toward someone already too near is not taken, one away always is', () => {
  // (the figures: 0.38 m across the chest, 0.29 m front to back: two chests never meet at PASS.apart)
  assert.ok(PASS.apart >= 0.38 && PASS.apart < 0.6, 'smaller than before (0.6), never smaller than a chest across');
  const Q = { x: 0, z: 0.45 };
  assert.equal(bumps(0, 0, 0, 0.1, [Q]), Q, 'to within PASS.apart: not taken');
  assert.equal(bumps(0, 0, 0, 0.04, [Q]), null, 'still PASS.apart off');
  assert.equal(bumps(0, 0.2, 0, 0.1, [Q]), null, 'too near already, a step away is always let be');
  assert.equal(bumps(0, 0, 0.5, 0.1, [Q]), null, 'sideways past them, PASS.apart off');
});

test('keep right: met head on, each steers to their own right; someone standing or walking on ahead, round them on the side away', () => {
  // (walking up z: one's right is -x, the steer's + side)
  const up = [0, 1];
  // someone coming the other way, dead ahead, a little to the left, a little to the right: to the right each time
  for (const lat of [0, -0.2, 0.2]) assert.ok(passBy(...up, -lat, 1.2, { coming: true }).steer > 0, `coming, ${lat} m: to the right`);
  // clear to the left already (PASS.comfy): no more steering
  assert.ok(passBy(...up, PASS.comfy + 0.01, 1.2, { coming: true }) === null || passBy(...up, PASS.comfy + 0.01, 1.2, { coming: true }).steer <= 0);
  // the player coming down one's right side already: round them on the left, not across in front of them
  assert.ok(passBy(...up, -0.35, 1.2, { coming: true, player: true }).steer < 0, 'the player on their right: to the left');
  assert.ok(passBy(...up, 0.1, 1.2, { coming: true, player: true }).steer > 0, 'the player on their left: to the right');
  // standing dead ahead: to the right; walking on ahead, dead ahead: to the left; a little to one side: away from them
  assert.ok(passBy(...up, 0, 1.2, {}).steer > 0);
  assert.ok(passBy(...up, 0, 1.2, { walking: true }).steer < 0);
  assert.ok(passBy(...up, -0.3, 1.2, {}).steer < 0, 'standing to the right: round them on the left');
  // behind, or past the lane: nothing
  assert.equal(passBy(...up, 0, -0.5, { coming: true }), null);
  assert.equal(passBy(...up, 0, PASS.meet + 0.1, { coming: true }), null);
  assert.equal(passBy(...up, 0, PASS.lane[0] + 0.1, {}), null);
  assert.ok(facing(0, Math.PI) && !facing(0, 0.4));
});

test('two of the station\'s people meeting head on in a hall pass on their rights, never in each other', () => {
  // a corridor (2.4 m), a narrow one (1.2 m: 0.68 m for a body's middle, room for two), each walker dead on, a little
  // off, and on the wrong side of the other (0.2 m to the other's right)
  for (const wide of [2.4, 1.2]) for (const off of [0, -0.05, 0.05, -0.2, 0.2]) {
    const r = twoInAHall(wide, off);
    assert.ok(r.A.there && r.B.there, `${wide} m hall, ${off} m off: both get where they were going`);
    assert.ok(r.nearest >= PASS.apart - 1e-9, `${wide} m hall, ${off} m off: never nearer than PASS.apart (${r.nearest.toFixed(3)})`);
    assert.ok(r.abreast && r.abreast.a < r.abreast.b, `${wide} m hall, ${off} m off: abreast, each on their own right (${JSON.stringify(r.abreast)})`);
  }
});

test('one of the station\'s people meeting the player head on makes room on their right; the player is not steered and gets by', () => {
  const free = hall(1.6), A = walker(0, -6, [0, 6]), dt = 1 / 30;
  const pl = { player: true, x: 0, z: 5, heading: Math.PI, speed: 1.6 };
  let nearest = Infinity, abreast = null;
  for (let t = 0; t < 15; t += dt) {
    const z0 = pl.z - A.z;
    // (the player straight down the hall's middle, pushed out to PASS.apart from anyone walked into, as src/player.js)
    if (pl.z > -6) { pl.z -= pl.speed * dt; const d = Math.hypot(pl.x - A.x, pl.z - A.z); if (d < PASS.apart) { const k = PASS.apart / d; pl.x = A.x + (pl.x - A.x) * k; pl.z = A.z + (pl.z - A.z) * k; } }
    stationStep(A, [pl], dt, free);
    nearest = Math.min(nearest, Math.hypot(pl.x - A.x, pl.z - A.z));
    if (abreast == null && Math.sign(pl.z - A.z) !== Math.sign(z0)) abreast = { a: A.x, player: pl.x };
  }
  assert.ok(A.there, 'there');
  assert.ok(nearest >= PASS.apart - 1e-9, nearest);
  assert.ok(abreast && abreast.a < -0.25 && Math.abs(abreast.player) < 0.05, `they made room on their right (-x), the player went straight on: ${JSON.stringify(abreast)}`);
});

// ── ABOARD (src/aboardplan.js walkStep): the Miner's cabin, on the blueprint's own floor (floorOf) ────────────────────
const bp = JSON.parse(readFileSync(new URL('../kit/ships/miner-ore-cockpit.blueprint.json', import.meta.url), 'utf8'));
const free = floorOf(bp), P = placesOf(bp, { deck: 0, cockpitFloor: 0.62 }), place = (id) => P.find((p) => p.id === id);
const band = (z) => { const [l, r] = roomAt(0.1, z, -1, 0, free, 1.5); return l + r; };

test('room for two as a real pair finds it: in a station hall, the bodies\' own size; in a ship\'s cabin (its walls let a body nearer), more', () => {
  // (a pair shoulder past shoulder: 0.9 m across; the station's people are 0.52 m across against its walls, a ship's
  // cabin lets a body to 0.15 m of its walls)
  assert.equal(roomFor(0.26), PASS.apart + PASS.spare);
  assert.ok(Math.abs(roomFor(0.15) - 0.62) < 1e-9);
});

test('the Miner\'s floor for two: its airlock wide enough for two to pass; its mess past the table, its bunks\' aisle and its doors not', () => {
  // (the game's walls, measured across the cabin every 5 cm (rigs/passing-1/cabin.cjs): the mess past its table 0.38 to
  // 0.41 m for a body's middle, the airlock 1.29 to 1.59, the aisle between the bunks 0.49, the doors (open) 0.48; two
  // middles need roomFor(0.15) = 0.62 there. Here, the blueprint's own floor, its walls a voxel thicker: floorOf, r 0.18)
  const need = roomFor(free.r);
  for (const z of [1.2, 1.5, 1.8]) assert.ok(band(z) < PASS.apart, `the mess past its table at z ${z}: ${band(z).toFixed(2)} m, too narrow even for two bodies`);
  for (const z of [-1.2, -0.5]) assert.ok(band(z) >= need, `the airlock at z ${z}: ${band(z).toFixed(2)} m`);
  assert.ok(band(-3) < need, `the bunks' aisle: ${band(-3).toFixed(2)} m, too narrow for a pair`);
  for (const z of [0.5, -2, 3]) assert.ok(band(z) < need, `the door at z ${z}: ${band(z).toFixed(2)} m`);
});

// (two of the crew aboard, each walking from one place to another as src/aboard.js walks them, met with each other (and
// the player standing by, or not there): -> how near they came, where each was as they went by, who turned back)
function crewTwo({ a: [af, at], b: [bf, bt], after = 0, secs = 40 }) {
  const mk = (from, to, first) => {
    const a = place(from), b = place(to);
    return { pos: { x: a.x, z: a.z }, heading: 0, wait: 0, leg: 0, from: a, target: b, there: null, turned: 0, getUp: true, first,
      way: [a.stand, ...wayOf(bp, a.room, b.room), b.stand, ...(b.kind === 'sit' ? [[b.x, b.z]] : [])].map(([x, z]) => ({ x, z })) };
  };
  const A = mk(af, at, true), B = mk(bf, bt, false), dt = 1 / 30;
  let nearest = Infinity, abreast = null;
  const other = (W, Q) => (Q.there ? [] : [{ x: Q.pos.x, z: Q.pos.z, walking: true, heading: Q.heading, held: Q.wait > 0.3, first: Q.first }]);
  for (let t = 0; t < secs && !(A.there && B.there); t += dt) {
    const z0 = B.pos.z - A.pos.z;
    for (const [W, Q] of [[A, B], [B, A]]) {
      if (W.there || (W === B && t < after)) continue;
      const r = walkStep(W, dt, null, { others: other(W, Q), free });
      if (r === 'back') {
        const back = wayBack(W.way.slice(0, W.leg).map((v) => [v.x, v.z]), W.from);
        [W.from, W.target] = [W.target, W.from]; W.wait = 0; W.turned++; W.getUp = false;
        if (back.length) { W.way = back.map(([x, z]) => ({ x, z })); W.leg = 0; } else W.there = W.target;
      } else if (r === 'wait' || r === 'aside') W.wait += dt;
      else if (r === 'there') W.there = W.target;
      if (W.there) W.pos = { x: W.there.x, z: W.there.z };
    }
    if (!A.there && !B.there && t > after + dt) nearest = Math.min(nearest, Math.hypot(A.pos.x - B.pos.x, A.pos.z - B.pos.z));
    if (abreast == null && !A.there && !B.there && Math.sign(B.pos.z - A.pos.z) !== Math.sign(z0)) abreast = { a: +A.pos.x.toFixed(2), b: +B.pos.x.toFixed(2), z: +A.pos.z.toFixed(2) };
  }
  return { A, B, nearest, abreast };
}

test('two of the crew meeting head on where the Miner is wide enough (its airlock) pass on their rights, never in each other', () => {
  // A: from the bench by the mess door aft to a bunk; B: from the other bunk forward to the bench by the cockpit, set
  // off so they meet in the airlock (or elsewhere, and one turns back)
  let passed = 0;
  for (const after of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
    const r = crewTwo({ a: ['bench-a', 'bunk-p'], b: ['bunk-s', 'bench-b'], after });
    assert.ok(r.A.there && r.B.there, `(${after} s) both get there`);
    assert.ok(r.nearest >= PASS.apart - 1e-9, `(${after} s) never nearer than PASS.apart (${r.nearest.toFixed(3)})`);
    // (walking aft, -z, A's right is +x; walking forward, B's right is -x)
    if (r.abreast && r.abreast.z < 0.2 && r.abreast.z > -1.9 && r.A.turned + r.B.turned === 0) { assert.ok(r.abreast.a > r.abreast.b, `(${after} s) in the airlock, each on their own right: ${JSON.stringify(r.abreast)}`); passed++; }
  }
  assert.ok(passed > 0, 'some met in the airlock and passed there');
});

test('a passage too narrow for two keeps the turn-back: two of the crew met in the Miner\'s mess past its table, one turns back, never in each other', () => {
  let turned = 0;
  for (const after of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5]) {
    // A: from the bench by the cockpit aft to a bunk; B: from the bench by the mess door forward to the cockpit's step
    // bench, both through the mess past its table
    const r = crewTwo({ a: ['bench-b', 'bunk-p'], b: ['bunk-s', 'bench-b'], after: after + 1.5 });
    assert.ok(r.A.there && r.B.there, `(${after} s) both get somewhere to sit or lie`);
    assert.ok(r.nearest >= PASS.apart - 1e-9, `(${after} s) never nearer than PASS.apart (${r.nearest.toFixed(3)})`);
    turned += r.A.turned + r.B.turned;
  }
  assert.ok(turned > 0, 'met in the narrow mess, one turned back');
});

test('the player met head on in the Miner\'s airlock: the walker makes room on their right and walks on, never turned back', () => {
  // (the player standing in the airlock: in its middle, and just aft of the mess door's mouth, where the game showed him
  // stepped aside beside the door and still turned back, the room felt from where he stood rather than from the way's
  // line (PASSING-1); the captain coming aft through the door from either bench)
  for (const [from, at] of [['bench-b', [0, -1.0]], ['bench-b', [0.04, -0.1]], ['bench-a', [0.04, -0.1]], ['bench-a', [-0.1, -0.2]]]) {
    const a = place(from), b = place('bunk-p');
    const W = { pos: { x: a.x, z: a.z }, heading: 0, wait: 0, leg: 0, from: a, target: b, there: null, turned: 0, getUp: true,
      way: [a.stand, ...wayOf(bp, a.room, b.room), b.stand].map(([x, z]) => ({ x, z })) };
    const pl = { x: at[0], z: at[1] }, dt = 1 / 30;
    let nearest = Infinity, side = null, r;
    for (let t = 0; t < 20 && r !== 'there'; t += dt) {
      r = walkStep(W, dt, pl, { free });
      assert.notEqual(r, 'back', `${from}, the player at ${at}: room to pass, no turning back`);
      if (r === 'wait' || r === 'aside') W.wait += dt;
      nearest = Math.min(nearest, Math.hypot(pl.x - W.pos.x, pl.z - W.pos.z));
      if (side == null && W.pos.z < pl.z) side = W.pos.x - pl.x;
    }
    assert.equal(r, 'there', `${from}, the player at ${at}`);
    assert.ok(nearest >= PASS.apart - 1e-9, nearest);
    // (walking aft, -z: their right is +x)
    assert.ok(side > PASS.apart - 0.01, `${from}, the player at ${at}: went by the player on their right (${side.toFixed(2)} m to +x)`);
  }
});
