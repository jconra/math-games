// The crane's views worked by hand (src/craneview.js): the orbit with no stop, one wall camera, the crane's own view
// straight down from the grab, the mark to line up by.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VIEWS, VIEW_NAMES, WALL_CAM, ORBIT, orbitBy, orbitEye, clearAlong, hangarClear, fitFov, grabCam, markOf, markCorners } from '../src/craneview.js';
import { startOf } from '../kit/crane-plan.js';
import { makeDrive } from '../kit/crane-drive.js';

// (the Miner hangar's places and a stand-in for what stands still, as tests/cranedrive.test.mjs has them)
const Q = Math.PI / 2, deg = Math.PI / 180;
const mounts = [];
// (the mounts' heights: the parked Miner on its longer legs, 12 cm higher than before 2026-11-16, as tests/crane.test.mjs)
for (const [z, o] of [[-7.208, -1], [-2.792, 1]]) for (const y of [3.764, 2.372]) for (const [x, yaw] of [[40.578, Q], [38.142, -Q]]) mounts.push({ at: [x, y, z], yaw, out: [0, o], upper: y > 3 });
const sockets = []; for (const x of [29, 31.5, 34, 36.5]) for (const y of [0.75, 2.2]) sockets.push({ at: [x, y, -18.16], n: [0, 1], upper: y > 1.5 });
const bays = []; for (let j = 0; j < 8; j++) bays.push({ at: [46 + j * 1.15, 0.65, -16.8] });
const ARMS = [-1, 1].flatMap((end) => [1, -1].map((s) => ({ z: end * (0.55 + s * 0.036), way: end * s })));
const site = { carry: 6.28, rail: { y: 8.52, x: [21.1, 56.9], z: [-17.65, 7.65] }, home: [21.5, -5], mounts, sockets, bays, can: { half: 1.088, seat: 0.4, clear: 0.45, rise: 0.9, lift: 0.09 }, grid: { origin: [19, -19], x: [0, 1], y: [1, 0], size: [28, 40] },
  dims: { R: 0.47, grip: { w: 0.35, under: 0.67, top: 0.79, half: 0.65 }, arc: { r: 0.54, tube: 0.03, z: 0.55, gap: 0.036, half: 72 * deg, shut: 108 * deg }, arms: ARMS,
    cable: { x: 0.24, z: 0.24 }, cableTop: -0.8, hookTop: 1.09, block: { half: 0.32, h: 0.22, rot: 0.3, rotH: 0.08 }, trolley: { x: 0.5, z: 0.36, y0: -0.8, y1: -0.3 },
    sock: { deep: 0.62, bore: 0.535, mouth: 0.585, out: 0.68 }, trayShare: 0.15 } };
// what stands still: the floor, the wall behind the sockets, each socket's collar round its bore
const solid = (x, y, z) => {
  if (y < 0 || z < -18.78) return true;
  for (const s of sockets) { const ax = z - s.at[2], r = Math.hypot(x - s.at[0], y - s.at[1]); if (ax > -0.62 && ax < 0 && r > 0.535 && r < 0.74) return true; }
  return false;
};
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('three views: following the load, the crane\'s own from the grab, one wall camera (in the station file)', () => {
  assert.deepEqual(VIEWS, ['follow', 'crane', WALL_CAM]);
  for (const v of VIEWS) assert.ok(VIEW_NAMES[v], v);
  const R = JSON.parse(read('kit/rooms/station.json'));
  assert.ok(R.views[WALL_CAM], 'the wall camera kept');
  assert.deepEqual(Object.keys(R.views).filter((n) => /^miner-cam/.test(n)), [WALL_CAM], 'and only that one');
  // (the crane game goes round the same three after its own view from above)
  assert.match(read('src/jobs/cranelink.js'), /VIEWS = \['grid', \.\.\.DRIVE_VIEWS\]/);
});

test('the orbit has no stop: a drag goes on round, whole turns either way', () => {
  for (const way of [1, -1]) {
    let a = 0, turned = 0, last = 0;
    // (three whole turns, a little at a time, as a drag comes in)
    const px = (Math.PI * 2 * 3) / ORBIT.perPixel, steps = 600;
    for (let i = 0; i < steps; i++) { a = orbitBy(a, way * px / steps); let d = a - last; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; turned += d; last = a; assert.ok(a >= -Math.PI - 1e-9 && a <= Math.PI + 1e-9); }
    assert.ok(Math.abs(Math.abs(turned) - Math.PI * 6) < 1e-6, `three whole turns: ${turned}`);
    assert.equal(Math.sign(turned), -way);
  }
  // (past the old stop at 2.6 radians, and the far side, straight behind the hook from the hangar's middle)
  assert.ok(Math.abs(orbitBy(2.5, -0.2 / ORBIT.perPixel) - 2.7) < 1e-9);
  assert.ok(Math.abs(Math.abs(orbitBy(0, Math.PI / ORBIT.perPixel)) - Math.PI) < 1e-9);
  assert.doesNotMatch(read('src/cranedrive.js'), /Math\.max\(-2\.6/, 'no stop left in free control');
});

test('the follow view is brought in along its own line where it would be behind a wall or inside something', () => {
  // (the hook by the socket wall, the view swung round to the wall's side: straight out would be through the wall)
  const hook = [33, 5.5, -16.5], look = [33, 4.6, -16.5];
  const clear = hangarClear(site, solid);
  const eye = orbitEye(hook, 0, Math.PI, 9);
  assert.ok(eye[2] < -18.78, 'straight out it would be behind the wall');
  const t = clearAlong(look, eye, clear);
  assert.ok(t > 0 && t < 1);
  const at = look.map((v, i) => v + (eye[i] - v) * t);
  assert.ok(clear(...at), 'where it is brought in to is clear');
  assert.ok(at[2] > -18.78 + ORBIT.r && at[2] >= site.rail.z[0] - 0.6, `inside the hangar: ${at}`);
  // (out in the middle of the hangar it stays where it was put, all the way round)
  for (let q = 0; q < 8; q++) { const e = orbitEye([40, 5.5, -5], 0, q * Math.PI / 4, 9); assert.equal(clearAlong([40, 4.6, -5], e, clear), 1, `turn ${q}`); }
});

test('the crane\'s own view: on the grab, straight down, nothing of the crane under it; a held canister cut away', () => {
  const S = startOf(site), d = site.dims;
  for (const h of [6.2, 4.5, 2.0]) {
    S.hoist = h; S.x = 40; S.z = -5;
    const g = grabCam(S, d);
    assert.equal(g.down, true);
    // (straight down, from the grab's middle: the same x and z, below it)
    assert.deepEqual([g.at[0], g.at[2]], [S.x, S.z]); assert.deepEqual([g.look[0], g.look[2]], [S.x, S.z]); assert.ok(g.look[1] < g.at[1]);
    // (rides with the grab: just under the grab's frame, below the trolley, the block and the cables)
    assert.ok(Math.abs(g.at[1] - (h + d.grip.under - 0.09)) < 1e-9);
    assert.ok(g.at[1] < h + d.grip.under && g.at[1] > h + d.R, 'under the frame, over a canister\'s top');
    assert.ok(g.at[1] < site.rail.y + d.trolley.y0, 'under the trolley');
    // (the open arms: out to the sides, outside the picture's cone, never under it)
    const v = Math.tan((g.fov / 2) * Math.PI / 180), corner = Math.atan(Math.hypot(v, v * 16 / 9));   // (a wide screen's corner)
    for (const a of d.arms) {
      const lo = h + d.arc.r * Math.cos(d.arc.half), side = d.arc.r * Math.sin(d.arc.half), off = Math.hypot(side, a.z);
      assert.ok(Math.atan2(off, g.at[1] - lo) > corner, 'an open arm is out of sight');
    }
    assert.equal(g.near, 0.03, 'empty: the game\'s own near plane');
  }
  // holding a canister: the near plane just past its underside
  S.cans[0].where = 'held'; S.hoist = 5;
  const g = grabCam(S, d);
  assert.ok(g.near > g.at[1] - (S.hoist - d.R) && g.near < g.at[1] - (S.hoist - d.R) + 0.2, `near ${g.near}`);
});

test('the mark: on the place it is lined up with, amber then green as the lights; otherwise on what is under the grab', () => {
  const S = startOf(site), D = makeDrive(site, S, { solid, eyes: [] });
  // (out over the floor, nothing near: light lines, a canister's middle over the floor)
  S.x = 33; S.z = -10; S.hoist = 5;
  let m = markOf({ ...D.read(), place: null }, S, site, solid);
  assert.equal(m.look, 'off'); assert.ok(Math.abs(m.at[1] - (0 + site.dims.R)) < 0.06, `on the floor: ${m.at}`);
  const c = markCorners(m), len = Math.hypot(c[0][0] - c[3][0], c[0][2] - c[3][2]), wid = Math.hypot(c[0][0] - c[1][0], c[0][2] - c[1][2]);
  assert.ok(Math.abs(len - 2 * site.can.half) < 1e-9 && Math.abs(wid - 2 * site.dims.R) < 1e-9, 'a canister\'s size');
  // (lying the cradle's way)
  S.yaw = Math.PI / 2; m = markOf({ ...D.read(), place: null }, S, site, solid); const k = markCorners(m);
  assert.ok(Math.abs(Math.abs(k[0][0] - k[3][0]) - 2 * site.can.half) < 1e-9, 'turned with the cradle');
  // (lined up with a place: the box on it, its colour the lights')
  const place = { kind: 'socket', i: 2, at: [34, 2.2, -16.4], axis: 0 };
  assert.equal(markOf({ ...D.read(), place, aids: { x: 'near', y: 'on', h: 'off' } }, S, site, solid).look, 'near');
  const on = markOf({ ...D.read(), place, aids: { x: 'on', y: 'on', h: 'off' } }, S, site, solid);
  assert.equal(on.look, 'on'); assert.deepEqual(on.at, place.at);
});

test('brought in close, the lens widens just enough to keep the load in the picture; out in the open it is as it was', () => {
  // (far off: as it was, on a wide screen and an upright phone)
  assert.equal(fitFov(62, 16 / 9, 9, 1.4), 62); assert.equal(fitFov(62, 400 / 860, 9, 1.4), 62);
  // (close: wider, more so on an upright phone, never past the most)
  const wide = fitFov(62, 16 / 9, 2.4, 1.4), phone = fitFov(62, 400 / 860, 2.4, 1.4);
  assert.ok(wide > 62 && phone > wide && phone <= 110, `${wide} ${phone}`);
  // (the ball round the load fits the narrower way)
  const across = (fov, aspect) => Math.atan(Math.tan((fov / 2) * Math.PI / 180) * Math.min(1, aspect));
  assert.ok(across(fitFov(62, 16 / 9, 3, 1.4), 16 / 9) >= Math.asin(1.4 * 1.1 / 3) - 1e-9);
  assert.ok(across(fitFov(62, 400 / 860, 3.5, 1.4), 400 / 860) >= Math.asin(1.4 * 1.1 / 3.5) - 1e-9);
});
