// Checks the numbers getting on and off a horse is played by (src/actors/mountplan.js, read by src/actors/seat.js and
// src/player.js): the clips are as long as the game thinks, its tables hang together (a foot always holds the rider up
// while the root is put on the ground, the weights stay between 0 and 1), the dismount's clock runs the mount backward,
// and the walk up to the stirrup picks the side and goes round the horse, not through it. (How it looks is checked by
// eye: ~/pw/bandit-math/rigs/mount/.)
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MOUNTING as M, MOUNT_CLIPS, weightAt, smoothKeys, mountClock, clipName, sidesFor, cornersFor, spotAt } from '../src/actors/mountplan.js';

const MODELS = new URL('../models/', import.meta.url);
function glb(path) {
  const b = fs.readFileSync(new URL(path, MODELS));
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
}
const length = (g, name) => { const a = g.animations.find((x) => x.name === name); return a ? Math.max(...a.samplers.map((s) => g.accessors[s.input].max[0])) : null; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const samples = (from, to, n = 400) => Array.from({ length: n + 1 }, (_, i) => from + (to - from) * i / n);

test('both skeletons have the four clips, as long as the plan says', () => {
  for (const body of ['m', 'f']) {
    const g = glb(`people/clips_${body}.glb`);
    for (const name of MOUNT_CLIPS) {
      const want = name.startsWith('Mount') ? M.mount : M.dismount, got = length(g, name);
      assert.ok(got !== null, `clips_${body}.glb has ${name}`);
      assert.ok(near(got, want, 0.002), `${name} lasts ${got} s in clips_${body}.glb, the plan says ${want}`);
    }
  }
  assert.deepEqual(MOUNT_CLIPS, [clipName(true, 1), clipName(true, -1), clipName(false, 1), clipName(false, -1)]);
});

test('every table runs forward in time inside the mount, its weights between 0 and 1', () => {
  const tables = { ground: M.ground, ...Object.fromEntries(Object.entries(M.feet).map(([k, v]) => ['feet.' + k, v])),
    ...Object.fromEntries(Object.entries(M.pin).map(([k, v]) => ['pin.' + k, v])), ...Object.fromEntries(Object.entries(M.out).map(([k, v]) => ['out.' + k, v])) };
  for (const [name, tab] of Object.entries(tables)) {
    for (let i = 0; i < tab.length; i++) {
      const [t, w] = tab[i];
      assert.ok(t >= 0 && t <= M.mount + 1e-9, `${name}: ${t} s is inside the mount`);
      assert.ok(w >= 0 && w <= 1, `${name}: weight ${w}`);
      if (i) assert.ok(t > tab[i - 1][0], `${name}: its times go forward`);
    }
  }
  // the root starts on the ground and ends on the horse; the feet start on the ground; the stirrup foot and the hands are let go by the end
  assert.equal(weightAt(M.ground, 0), 1); assert.equal(weightAt(M.ground, M.mount), 0);
  assert.equal(weightAt(M.feet.near, 0), 1); assert.equal(weightAt(M.feet.far, 0), 1);
  for (const k of Object.keys(M.pin)) assert.equal(weightAt(M.pin[k], M.mount), 0, `pin.${k} let go at the end (Ride's own pose then)`);
  for (const k of Object.keys(M.out)) assert.equal(weightAt(M.out[k], M.mount), 1, `out.${k}: all of legsOut once seated, as riding has it`);
});

test('while the root is held to the ground, a foot always holds the rider up (on the ground or in the stirrup)', () => {
  for (const t of samples(0, M.mount)) {
    if (weightAt(M.ground, t) < 0.5) continue;
    const held = Math.max(weightAt(M.feet.near, t), weightAt(M.feet.far, t), weightAt(M.pin.nearFoot, t));
    assert.ok(held >= 0.5, `at ${t.toFixed(3)} s the root is on the ground but no foot is (${held.toFixed(2)})`);
  }
  // and the far foot is off the ground before the root lets go of it (the push off it lifts the rider; from after the
  // little hop on it before the spring)
  const offAt = samples(0.75, 1.2).find((t) => weightAt(M.feet.far, t) < 0.01), lettingGo = samples(0.75, 1.2).find((t) => weightAt(M.ground, t) < 0.99);
  assert.ok(offAt !== undefined && lettingGo !== undefined && offAt < M.ground[M.ground.length - 1][0], 'the far foot leaves the ground before the root is all on the horse');
});

test('the dismount runs the mount backward: from Ride\'s first frame (the mount\'s end) to the Idle it started in', () => {
  assert.ok(near(mountClock(0), M.mount), 'the dismount starts where the mount ends');
  assert.ok(near(mountClock(M.dismount), 0), 'and ends where the mount starts');
  let last = Infinity;
  for (const t of samples(0, M.dismount)) { const m = mountClock(t); assert.ok(m <= last + 1e-9, `its clock never runs forward (${t.toFixed(3)} s)`); last = m; }
  for (const [t, v] of M.back) assert.ok(near(mountClock(t), v, 1e-9), `it passes through ${t} -> ${v}`);
});

test('smoothKeys passes through its keys and never overshoots them', () => {
  const keys = [[0, 0], [0.3, 1], [0.5, 1], [1, -2], [1.4, 0.5]];
  for (const [t, v] of keys) assert.ok(near(smoothKeys(keys, t), v, 1e-9));
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1], lo = Math.min(v0, v1), hi = Math.max(v0, v1);
    for (const t of samples(t0, t1, 50)) { const v = smoothKeys(keys, t); assert.ok(v >= lo - 1e-9 && v <= hi + 1e-9, `between ${t0} and ${t1}: ${v}`); }
  }
  assert.equal(smoothKeys(keys, -1), 0); assert.equal(smoothKeys(keys, 9), 0.5);
});

test('the spot is beside the horse, clear of its body, on the side asked for', () => {
  const [x, y, z] = spotAt(1), [xr] = spotAt(-1);
  assert.ok(x > 0.55 && xr === -x, 'on its left (+x), mirrored to its right');
  assert.ok(near(y, -0.895, 1e-9), 'on the bay\'s ground, 1.505 m under its seat');
  assert.ok(z > 0 && z < 1, 'by its shoulder, ahead of the saddle');
  assert.deepEqual(spotAt(1, 0.6), [x * 0.6, y * 0.6, z * 0.6], 'a smaller person: nearer, as their riding root is');
  assert.ok(M.face < -Math.PI / 2 && M.face > -Math.PI, 'facing in toward the horse, turned a little toward its tail');
});

test('getting on: the side the rider is on, the left when it is all the same, round the horse never through it', () => {
  assert.deepEqual(sidesFor(1.2), [1, -1]); assert.deepEqual(sidesFor(0), [1, -1]); assert.deepEqual(sidesFor(-1.2), [-1, 1]);
  assert.deepEqual(sidesFor(-0.32, 1.15), [1, -1], 'a big horse: its wider middle still counts as no side');
  assert.deepEqual(cornersFor(1.0, 0.2, 1), [], 'already on its left: straight there');
  // on its right, mounting from its left: round the nearer end (the head: in front of its middle), the far corner first
  const r = cornersFor(-1.0, 0.4, 1); assert.equal(r.length, 2); assert.ok(r[0][0] < 0 && r[1][0] > 0 && r[0][1] > 1 && r[1][1] > 1);
  // behind it: round the tail
  const b = cornersFor(0.1, -2.5, 1); assert.equal(b.length, 1); assert.ok(b[0][0] > 0 && b[0][1] < -1.5);
  // every corner is out past the horse's body (its middle line from rump to chest, 0.7 m round for the bay)
  for (const [a, l] of [...r, ...b, ...cornersFor(-1, -1, 1, 1.15)]) {
    const t = Math.max(-1.0 * 1.15, Math.min(0.9 * 1.15, l)), d = Math.hypot(a, l - t);
    assert.ok(d >= 0.7, `corner [${a}, ${l}] is ${d.toFixed(2)} m from its body`);
  }
});
