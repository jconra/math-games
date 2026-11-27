// A STEP THAT MEETS A WALL (src/slide.js, walls.js move's slide for everyone who walks), tried on a made-up floor plan
// by numbers: a hull wall with a 2 m opening in it, a ramp's tread 2 m wide outside it (no floor beyond its edges, as
// the Medic's ramp on a planet: RAMP_2.md) and a cabin inside; a body felt as walls.js feels one (its middle and a ring
// of 8 points 0.28 m out), walking at the player's pace (1.6 m/s, 60 frames a second, src/player.js), the stick held
// forward at several angles off straight. The same plan stood turned (a ship set down crooked: the walls' frame).
//   node --test pi-nebula/tests/slide.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSlide, NUDGE } from '../src/slide.js';

const R = 0.28, STRIDE = 0.05, STEP = 1.6 / 60;
// the plan, in its own frame (x out of the ship, z across): solid boxes [x0, x1, z0, z1], and where there is a floor
// (the tread 0.1 m in from each jamb: a body's middle on its very edge is 0.18 m from where it fits the opening, within
// NUDGE.most; the Medic's own, where the body is slim from just outside its skin, is like it: RAMP_2.md)
const OPEN = [-0.75, 1.25], TREAD = [-0.65, 1.15];
const PLAN = {
  // the hull's skin and its jambs, 0.47 m deep (the Medic's: the cabin's wall line at 2.5, the skin at 2.97), either
  // side of the opening; a corner of the cabin beyond (a wall across, 1.5 m in)
  solid: [[2.5, 2.97, -4, OPEN[0]], [2.5, 2.97, OPEN[1], 4], [-1.0, -0.8, -4, 4]],
  floor: (x, z) => (x <= 2.97 ? x > -0.8 : z >= TREAD[0] && z <= TREAD[1] && x < 8),
};
// the plan stood turned by `yaw` about straight up and moved to (ox, oz): a point of the world into the plan's frame
function world(yaw = 0, ox = 0, oz = 0, plan = PLAN) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const toPlan = (x, z) => { const dx = x - ox, dz = z - oz; return [c * dx - s * dz, s * dx + c * dz]; };
  const toWorld = (lx, lz) => [c * lx + s * lz + ox, -s * lx + c * lz + oz];
  const solidAt = (lx, lz) => plan.solid.some(([x0, x1, z0, z1]) => lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1);
  // (walls.js free: the middle and the ring, the ring turned with the frame the walls there run in)
  const free = (x, z) => {
    const [lx, lz] = toPlan(x, z);
    if (solidAt(lx, lz)) return false;
    for (let i = 0; i < 8; i++) if (solidAt(lx + Math.cos(i * Math.PI / 4) * R, lz + Math.sin(i * Math.PI / 4) * R)) return false;
    return true;
  };
  const floor = (x, z) => plan.floor(...toPlan(x, z));
  const tryStep = (pos, sx, sz) => { const x = pos.x + sx, z = pos.z + sz; if (!floor(x, z) || !free(x, z)) return false; pos.x = x; pos.z = z; return true; };
  const fr = yaw ? { c, s } : null;
  return { toPlan, toWorld, free, floor, tryStep, fr, blocked: makeSlide(tryStep, STRIDE) };
}
// walls.js move for one frame's walk: steps of no more than a stride, each slid along the walls when it meets one
function move(Wd, pos, dx, dz) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / STRIDE)), sx = dx / n, sz = dz / n;
  for (let i = 0; i < n; i++) if (!Wd.tryStep(pos, sx, sz) && !Wd.blocked(pos, sx, sz, Wd.fr, R, false)) break;
}
// the stick held forward at `off` rad from straight in (the plan's -x), from (x, z) in the plan, `secs` at most, until
// done(plan x, plan z); every frame's place checked as a place a body may stand
function walk(Wd, [x, z], off, done, secs = 12, dir = -1) {
  const [wx, wz] = Wd.toWorld(x, z), pos = { x: wx, y: 0, z: wz };
  const [ux, uz] = Wd.toWorld(dir * Math.cos(off), Math.sin(off)), [o0, o1] = Wd.toWorld(0, 0), vx = ux - o0, vz = uz - o1;
  let n = 0, inWall = 0;
  for (; n < secs * 60; n++) {
    const x0 = pos.x, z0 = pos.z;
    move(Wd, pos, vx * STEP, vz * STEP);
    if (!Wd.free(pos.x, pos.z) || !Wd.floor(pos.x, pos.z)) inWall++;
    // (no frame's move further than a shuffle and a stride: nobody jumps)
    assert.ok(Math.hypot(pos.x - x0, pos.z - z0) <= NUDGE.most + STRIDE + 1e-9, 'a frame moves no further than NUDGE.most and a stride');
    if (done(...Wd.toPlan(pos.x, pos.z))) break;
  }
  const [px, pz] = Wd.toPlan(pos.x, pos.z);
  return { ok: done(px, pz), secs: n / 60, at: [+px.toFixed(3), +pz.toFixed(3)], inWall };
}
const MID = (TREAD[0] + TREAD[1]) / 2, STARTS = [MID, TREAD[0] + 0.3, TREAD[1] - 0.3];
const OFFS = [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3];
const inside = (x) => x < 2.2, past = (x) => x > 6.5;

test('walked up the ramp a little off straight, from anywhere across its foot: through the opening, never in a wall', () => {
  for (const yaw of [0, 0.6, 2.3]) {
    const Wd = world(yaw, 3.1, -7.4);
    for (const z of STARTS) for (const off of OFFS) {
      const r = walk(Wd, [7.1, z], off, inside);
      // (a walk that leaves the tread's side before the opening, steering off its edge, is no catch on the frame: the
      // offsets here are all ones that reach the opening's line on the tread from these starts)
      assert.equal(r.inWall, 0, `yaw ${yaw} from ${z} at ${off}: never where a body may not stand`);
      assert.ok(r.ok, `yaw ${yaw} from across ${z} at ${off} rad: in through the opening (ended at ${r.at} after ${r.secs} s)`);
      // (and with no more than a short slow down along the frame: a straight walk in is 4.9 m at 1.6 m/s, 3.1 s)
      assert.ok(r.secs < 4.0, `yaw ${yaw} from ${z} at ${off}: in within 4 s (${r.secs.toFixed(2)})`);
    }
  }
});

test('walked down and out a little off straight: out through the opening and down the tread', () => {
  const Wd = world(0.9, -2, 5);
  for (const z of [MID, OPEN[0] + 0.5, OPEN[1] - 0.5]) for (const off of OFFS) {
    const r = walk(Wd, [1.5, z], off, (x, zz) => past(x) || (x > 3.3 && (zz < TREAD[0] + 0.02 || zz > TREAD[1] - 0.02)), 12, 1);
    assert.equal(r.inWall, 0, `from ${z} at ${off}: never where a body may not stand`);
    assert.ok(r.at[0] > 3.3, `from across ${z} at ${off} rad: out past the opening's jambs (ended at ${r.at})`);
  }
});

test('the corner shuffle reaches no further than NUDGE.most: caught a little further off, she stays caught', () => {
  // (a slot 0.6 m wide, its tread ending `reach` off the slot's middle: walked 0.2 rad off straight up to the corner of
  // the tread's edge and the wall's face, she is eased in from within NUDGE.most of where the front of her body first
  // goes into its mouth (her middle in line with the slot, 0.3 m off its middle; from there in, a frame's shuffle at a
  // time as her shoulders round its corner), and stays caught from further: nobody is pulled to an opening from further
  // off)
  const mouth = 0.3;
  for (const [reach, gets] of [[mouth + NUDGE.most - 0.04, true], [mouth + NUDGE.most + 0.04, false]]) for (const sg of [1, -1]) {
    const slot = { solid: [[2.5, 2.97, -4, -0.3], [2.5, 2.97, 0.3, 4]], floor: (x, z) => (x <= 2.97 ? x > -4 : Math.abs(z) <= reach && x < 8) };
    const Wd = world(0, 0, 0, slot), off = 0.2 * sg, z0 = sg * reach - (4.5 - 3.25) * Math.tan(off);
    const r = walk(Wd, [4.5, z0], off, inside, 8);
    assert.equal(r.inWall, 0);
    assert.equal(r.ok, gets, `tread to ${reach.toFixed(2)}, at ${off}: ${gets ? 'eased in' : 'held at the frame'} (ended at ${r.at})`);
  }
});

test('into a corner with no opening: stays put, never through it', () => {
  // (a wall ahead across the whole way and one along its side: pushed into the corner they make, at angles)
  const box = { solid: [[2.5, 2.97, -4, 4], [2.97, 8, 1.5, 1.8]], floor: (x) => x < 8 };
  const Wd = world(0.4, 1, 1, box);
  for (const off of [0.1, 0.2, 0.45]) {
    const r = walk(Wd, [4.0, 0.6], off, (x) => x < 2.97, 6);
    assert.equal(r.inWall, 0, `at ${off}: never in a wall`);
    assert.ok(!r.ok && r.at[0] >= 2.97 + R - 1e-3 && r.at[1] <= 1.5 - R + 1e-3, `at ${off}: held in the corner (${r.at})`);
  }
});

test('head on (the push along one of the walls\' ways): only the shuffle square across it, as before', () => {
  // (the slide's second shuffle is tried only for a push off square: head on, the moves are exactly those of the one
  // shuffle across the push, counted step by step against the plain rule written out here)
  // (pressed square against a flat wall with no opening, a floor all along it: the step, its crawl twice, then the one
  // shuffle: each side a sideways step at a time out to NUDGE.most, the push tried after each; then no way on)
  const flat = { solid: [[2.5, 2.97, -9, 9]], floor: (x) => x > 2.97 && x < 8 }, Wd = world(0, 0, 0, flat), calls = [];
  const spy = (pos, sx, sz) => { calls.push([sx, sz]); return Wd.tryStep(pos, sx, sz); };
  const blocked = makeSlide(spy, STRIDE), pos = { x: 2.97 + R + 0.001, y: 0, z: 0 };
  assert.equal(blocked(pos, -STEP, 0, null, R, false), false);
  assert.deepEqual(pos, { x: 2.97 + R + 0.001, y: 0, z: 0 }, 'not moved');
  const k = Math.round(NUDGE.most / NUDGE.step);
  assert.equal(calls.length, 1 + 2 + 2 * k * 2, 'the step, the crawl twice, one shuffle each side (sideways, then the push)');
  const side = calls.filter(([sx, sz]) => sx === 0 && Math.abs(Math.abs(sz) - NUDGE.step) < 1e-12).length;
  assert.equal(side, 2 * k, 'every sideways step square across the push, along the face');
  // (a push off square into the same flat wall slides along it: the wall's own way, and no shuffle at all)
  calls.length = 0;
  const p2 = { x: 2.97 + R + 0.001, y: 0, z: 0 };
  assert.equal(blocked(p2, -STEP * Math.cos(0.2), STEP * Math.sin(0.2), null, R, false), true);
  assert.ok(p2.x === 2.97 + R + 0.001 && p2.z > 0, 'slid along the face');
  assert.equal(calls.length, 2 + 1, 'the two parts tried, then the crawl along the face: no shuffle');
});
