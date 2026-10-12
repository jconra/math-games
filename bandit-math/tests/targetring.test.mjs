// The target ring's pick (src/targetring.js pickTarget), in plain numbers: which steer gets the green ring for a pointer
// and a screen; and its line test (rayHit): which body is under the pointer. How the ring looks and follows is checked by
// eye: tests/targetring.html and the rigs ~/pw/bandit-math/rigs/targetring_shots.cjs and ring_f1_check.cjs.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// the ring's module imports three.js by its bare name (the page's importmap finds it); here it gets an empty stand-in,
// as the pick itself needs no three.js
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(spec, ctx, next) {
    if (spec === 'three') return { url: 'data:text/javascript,export default {}', shortCircuit: true };
    return next(spec, ctx);
  }`));
const { pickTarget, rayHit, RING } = await import('../src/targetring.js');

const W = 1280, H = 720;
// a target on the screen: where its ring's middle is (pixels), its size there, metres from the player
const at = (x, y, { r = 30, dist = 10, ok = true, ahead = true } = {}) => ({ x, y, r, dist, ok, ahead });
const pick = (cands, o = {}) => pickTarget(cands, { width: W, height: H, ...o });

test('the pointer rings the target nearest it, within a generous zone', () => {
  const cands = [at(300, 400), at(700, 380), at(1000, 420)];
  assert.deepEqual(pick(cands, { pointer: { x: 690, y: 370 } }), { index: 1, how: 'pointer', hit: 'near' });
  assert.equal(pick(cands, { pointer: { x: 320, y: 410 } }).index, 0);
  // generous: well beside the ring (12% of the screen's height plus the ring's own size: 86 + 30 px) still counts
  assert.deepEqual(pick(cands, { pointer: { x: 700 + 110, y: 380 } }), { index: 1, how: 'pointer', hit: 'near' });
  // ... but not from the far side of the screen: the soft lock takes over (the one nearest the middle)
  assert.deepEqual(pick(cands, { pointer: { x: 700, y: 60 } }), { index: 1, how: 'soft', hit: null });
});

test('the zone grows with the target: a big near one is easy to hit at its edge', () => {
  const near = at(500, 450, { r: 160, dist: 4 }), far = at(800, 300, { r: 12, dist: 28 });
  // 230 px from the near one's middle, but inside its ring on screen plus the zone
  assert.equal(pick([near, far], { pointer: { x: 500 + 230, y: 450 } }).index, 0);
  // right on the small far one: it wins, though the big one's zone covers the pointer too
  assert.equal(pick([near, far], { pointer: { x: 802, y: 298 } }).index, 1);
});

test('with the pointer near none, the soft lock takes the one nearest the middle, ahead and within 35 m', () => {
  const mid = at(W / 2 + 40, H / 2 + 30, { dist: 12 });
  const side = at(150, 600, { dist: 6 });
  assert.deepEqual(pick([side, mid], { pointer: { x: 5, y: 5 } }), { index: 1, how: 'soft', hit: null });
  // no pointer at all (a touch screen, the mouse off the page): the same
  assert.deepEqual(pick([side, mid], { pointer: null }), { index: 1, how: 'soft', hit: null });
  // too far for the soft lock (the pointer can still ring it, up to RING.maxRange)
  const far = at(W / 2, H / 2, { dist: RING.softRange + 5 });
  assert.deepEqual(pick([side, far], { pointer: null }), { index: 0, how: 'soft', hit: null });
  assert.deepEqual(pick([side, far], { pointer: { x: W / 2, y: H / 2 } }), { index: 1, how: 'pointer', hit: 'near' });
  // behind the player (between the player and the camera): never the soft lock's choice
  const behind = at(W / 2, H / 2 + 10, { dist: 3, ahead: false });
  assert.equal(pick([behind, side], { pointer: null }).index, 1);
  // nothing near enough: none
  assert.deepEqual(pick([at(W / 2, H / 2, { dist: 60 })], { pointer: null }), { index: -1, how: 'none', hit: null });
  assert.deepEqual(pick([], { pointer: { x: 10, y: 10 } }), { index: -1, how: 'none', hit: null });
});

test('the soft lock prefers the nearer of two about as central', () => {
  const nearer = at(W / 2 + 30, H / 2, { dist: 6 }), farther = at(W / 2 - 25, H / 2, { dist: 30 });
  assert.equal(pick([farther, nearer], { pointer: null }).index, 1);
});

test('sticky: two close targets, the ring only moves when the other is clearly nearer the pointer', () => {
  const a = at(600, 400), b = at(660, 400);           // 60 px apart
  // ringed a: the pointer just past halfway toward b does not move it ...
  assert.equal(pick([a, b], { pointer: { x: 635, y: 400 }, current: 0 }).index, 0);
  assert.equal(pick([a, b], { pointer: { x: 640, y: 400 }, current: 0 }).index, 0);
  // ... clearly nearer b (by more than RING.stick of the screen's height) does
  assert.equal(pick([a, b], { pointer: { x: 660, y: 400 }, current: 0 }).index, 1);
  // and back again only when clearly nearer a
  assert.equal(pick([a, b], { pointer: { x: 625, y: 400 }, current: 1 }).index, 1);
  assert.equal(pick([a, b], { pointer: { x: 600, y: 400 }, current: 1 }).index, 0);
  // a pointer wobbling round the middle never flips it
  let cur = 0, flips = 0;
  for (let i = 0; i < 200; i++) {
    const x = 630 + 9 * Math.sin(i * 0.7) + 4 * Math.sin(i * 2.3);
    const r = pick([a, b], { pointer: { x, y: 400 + 3 * Math.cos(i) }, current: cur });
    if (r.index !== cur) flips++; cur = r.index;
  }
  assert.equal(flips, 0);
});

test('sticky in the soft lock too', () => {
  const a = at(W / 2 - 10, H / 2, { dist: 10 }), b = at(W / 2 + 12, H / 2, { dist: 10 });
  assert.equal(pick([a, b], { pointer: null, current: 1 }).index, 1);
  assert.equal(pick([a, b], { pointer: null, current: -1 }).index, 0);
});

test('the ringed target keeps the ring a little past the edge of its zone', () => {
  const a = at(400, 400, { r: 20 }), zone = RING.zone * H + 20;
  assert.equal(pick([a], { pointer: { x: 400 + zone + 15, y: 400 } }).how, 'soft');            // not ringed: outside
  assert.equal(pick([a], { pointer: { x: 400 + zone + 15, y: 400 }, current: 0 }).how, 'pointer');   // ringed: kept
});

test('targets behind the camera, hidden or caught are left out (ok: false), and off the screen too', () => {
  const hiddenOne = at(640, 360, { ok: false }), other = at(900, 360);
  assert.equal(pick([hiddenOne, other], { pointer: { x: 640, y: 360 } }).index, 1);
  assert.equal(pick([hiddenOne, other], { pointer: null }).index, 1);
  // a target behind the camera has no place on the screen (the ring marks it so: ok false, x NaN)
  const behind = { x: NaN, y: NaN, r: 0, ok: false, dist: 4, ahead: false };
  assert.deepEqual(pick([behind], { pointer: { x: 640, y: 360 } }), { index: -1, how: 'none', hit: null });
  // off the screen's edge: not ringed by the pointer at the edge, nor by the soft lock
  const off = at(-80, 360, { r: 20 });
  assert.deepEqual(pick([off], { pointer: { x: 2, y: 360 } }), { index: -1, how: 'none', hit: null });
  // even when it was the ringed one, a target that can't be picked any more loses the ring
  assert.equal(pick([hiddenOne, other], { pointer: { x: 640, y: 360 }, current: 0 }).index, 1);
});

test('the pointer reaches farther than the soft lock, but not across the valley', () => {
  const far = at(640, 300, { dist: RING.maxRange - 1 }), tooFar = at(640, 300, { dist: RING.maxRange + 1 });
  assert.equal(pick([far], { pointer: { x: 640, y: 300 } }).index, 0);
  assert.equal(pick([tooFar], { pointer: { x: 640, y: 300 } }).index, -1);
});

test('a tap (no soft lock, a bigger zone) takes the nearest to the finger or nothing', () => {
  const cands = [at(300, 500), at(900, 300)];
  const tap = (x, y) => pick(cands, { pointer: { x, y }, zone: RING.tapZone, soft: false });
  assert.equal(tap(300 + 150, 500).index, 0);            // 150 px off: within a finger's zone (144 + 30)
  assert.equal(tap(640, 40).index, -1);                  // nowhere near: nothing (not the soft lock)
});

test('the body under the pointer wins: in a tight group, pointing at the front cow rings it, not the one behind', () => {
  // the back cow's ring middle is nearer the pointer (the pointer is on the front cow's rump), but the front cow's body
  // is what is under the pointer
  const front = at(500, 420, { r: 60, dist: 10 }), back = at(610, 400, { r: 55, dist: 12 });
  const pointer = { x: 590, y: 425 };
  assert.equal(pick([front, back], { pointer }).index, 1);                              // (by the ring middles alone)
  assert.deepEqual(pick([front, back], { pointer, under: 0 }), { index: 0, how: 'pointer', hit: 'body' });
  // no stickiness against it: the ringed one loses the ring at once to the body under the pointer
  assert.equal(pick([front, back], { pointer, under: 0, current: 1 }).index, 0);
  // ... and the same the other way round
  assert.equal(pick([front, back], { pointer: { x: 505, y: 415 }, under: 1, current: 0 }).index, 1);
});

test('a body under the pointer that cannot be picked is passed over (hidden, caught, too far)', () => {
  const a = at(500, 400, { ok: false }), b = at(560, 400);
  assert.deepEqual(pick([a, b], { pointer: { x: 500, y: 400 }, under: 0 }), { index: 1, how: 'pointer', hit: 'near' });
  const far = at(500, 400, { dist: RING.maxRange + 5 });
  assert.equal(pick([far], { pointer: { x: 500, y: 400 }, under: 0 }).index, -1);
  // with no pointer (the soft lock) a body index means nothing
  assert.equal(pick([at(W / 2, H / 2), at(100, 100)], { pointer: null, under: 1 }).index, 0);
});

test('rayHit: how far along a line it first meets a shape, nearest first, and the far side of a body is skipped', () => {
  // two squares facing +z (toward a viewer at z = 10), one at z = 0 and one at z = -2, each two triangles
  const sq = (z) => [-1, -1, z, 1, -1, z, 1, 1, z, -1, -1, z, 1, 1, z, -1, 1, z];
  const pos = new Float32Array([...sq(-2), ...sq(0)]);
  const o = [0.2, 0.3, 10], d = [0, 0, -1];
  assert.equal(rayHit(o, d, pos, null), 10);                               // the near square, 10 away
  assert.equal(rayHit([0.2, 0.3, -1], d, pos, null), 1);                   // from between them: the far one
  assert.equal(rayHit([3, 0, 10], d, pos, null), Infinity);                // beside both: nothing
  // the same squares by corner numbers (as a mesh's index list)
  const corners = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
  assert.equal(rayHit(o, d, corners, new Uint16Array([0, 1, 2, 0, 2, 3])), 10);
  // seen from behind (a line going +z from z = -10): the squares face away, so a solid body's far side isn't hit ...
  assert.equal(rayHit([0.2, 0.3, -10], [0, 0, 1], pos, null), Infinity);
  // ... unless both sides count
  assert.equal(rayHit([0.2, 0.3, -10], [0, 0, 1], pos, null, 0), 8);
  // the way need not be one unit long: the answer is in its lengths
  assert.equal(rayHit(o, [0, 0, -2], pos, null), 5);
  // only nearer than maxT
  assert.equal(rayHit(o, d, pos, null, 1, 9), Infinity);
  // a slanted line through a corner region: inside one triangle of the near square, not the other
  const t = rayHit([0.9, -0.9, 10], [0, 0, -1], pos, null);
  assert.equal(t, 10);
});
