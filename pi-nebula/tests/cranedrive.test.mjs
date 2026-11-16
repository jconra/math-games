// The bridge crane worked live (kit/crane-drive.js): free control by a pretend stick, the autopilot the crane game
// drives, the round taken up again from wherever things are left (kit/crane-plan.js planFrom):
//   node --test pi-nebula/tests/*.test.mjs
// The places are the Miner hangar's as the game finds them (the same as crane.test.mjs), the parts' sizes kit/smelter.js's
// (typed in: node has no three.js); what stands still is a stand-in: the floor, the socket wall and the sockets' collars.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCycle, planFrom, stateAt, startOf, loadAt } from '../kit/crane-plan.js';
import { makeDrive, DRIVE } from '../kit/crane-drive.js';

const Q = Math.PI / 2, deg = Math.PI / 180;
const mounts = [];
for (const [z, o] of [[-7.208, -1], [-2.792, 1]]) for (const y of [3.644, 2.252]) for (const [x, yaw] of [[40.578, Q], [38.142, -Q]]) mounts.push({ at: [x, y, z], yaw, out: [0, o], upper: y > 3 });
const sockets = []; for (const x of [29, 31.5, 34, 36.5]) for (const y of [0.75, 2.2]) sockets.push({ at: [x, y, -18.16], n: [0, 1], upper: y > 1.5 });
const bays = []; for (let j = 0; j < 8; j++) bays.push({ at: [46 + j * 1.15, 0.65, -16.8] });
const ARMS = [-1, 1].flatMap((end) => [1, -1].map((s) => ({ z: end * (0.55 + s * 0.036), way: end * s })));
export const site = { carry: 6.28, rail: { y: 8.52, x: [21.1, 56.9], z: [-17.65, 7.65] }, home: [21.5, -5], mounts, sockets, bays, can: { half: 1.088, seat: 0.4, clear: 0.45, rise: 0.9, lift: 0.09 }, grid: { origin: [19, 9] },
  dims: { R: 0.47, grip: { w: 0.35, under: 0.67, top: 0.79, half: 0.65 }, arc: { r: 0.54, tube: 0.03, z: 0.55, gap: 0.036, half: 72 * deg, shut: 108 * deg }, arms: ARMS,
    cable: { x: 0.24, z: 0.24 }, cableTop: -0.8, hookTop: 1.09, block: { half: 0.32, h: 0.22, rot: 0.3, rotH: 0.08 }, trolley: { x: 0.5, z: 0.36, y0: -0.8, y1: -0.3 },
    sock: { deep: 0.62, bore: 0.535, mouth: 0.585, out: 0.68 }, trayShare: 0.15 } };
// what stands still: the floor, the wall behind the sockets, each socket's collar round its bore
export const solid = (x, y, z) => {
  if (y < 0 || z < -18.78) return true;
  for (const s of sockets) { const ax = z - s.at[2], r = Math.hypot(x - s.at[0], y - s.at[1]); if (ax > -0.62 && ax < 0 && r > 0.535 && r < 0.74) return true; }
  return false;
};
const fresh = (eyes = []) => { const S = startOf(site); return { S, D: makeDrive(site, S, { solid, eyes }) }; };
const run = (D, secs, cmd = {}) => { for (let t = 0; t < secs; t += 1 / 60) D.step(1 / 60, typeof cmd === 'function' ? cmd() : cmd); };
const until = (D, fn, secs = 120, cmd = {}) => { for (let t = 0; t < secs; t += 1 / 60) { D.step(1 / 60, typeof cmd === 'function' ? cmd() : cmd); if (fn()) return t; } return null; };
// a pretend thumb: pushes toward a point, gentler as it gets near
const toward = (S, x, z) => () => { const dx = x - S.x, dz = z - S.z, L = Math.hypot(dx, dz); return { move: L < 0.03 ? [0, 0] : [dx / Math.max(L, 1), dz / Math.max(L, 1)] }; };

test('by hand: a canister off the ship by itself, turned end on, docked by itself in socket 1, let go, draining', () => {
  const { S, D } = fresh(), m = mounts[1], o = [m.at[0], m.at[2] + m.out[1]];
  run(D, 14, toward(S, o[0], o[1]));
  assert.ok(Math.hypot(S.x - o[0], S.z - o[1]) < 0.15, 'over the tray');
  assert.ok(until(D, () => D.held === 1, 12, { hoist: -1 }) != null, 'lowered onto it, it takes it by itself');
  assert.ok(Math.hypot(S.x - o[0], S.z - o[1]) < 0.005, 'lined up on it exactly');
  assert.ok(until(D, () => S.hoist > 5.5, 10, { hoist: 1 }) != null);
  const sk = sockets[0], W = [sk.at[0], sk.at[2] + site.can.half + site.can.clear];
  run(D, 14, toward(S, W[0], W[1] + 0.3));
  assert.ok(Math.abs(Math.sin(S.yaw)) < 0.01, 'turned end on to the wall by itself');
  assert.ok(until(D, () => Math.abs(S.hoist - sk.at[1]) < 0.3, 10, { hoist: -1 }) != null, 'down to the socket');
  assert.ok(until(D, () => S.cans[1].where === 'socket', 20) != null, 'in it goes by itself, and it lets go: ' + JSON.stringify(S.cans[1]));
  assert.equal(S.cans[1].i, 0); assert.ok(S.lit[0] > 0.99, 'the dogs shut on it');
  const f = S.cans[1].fill; run(D, 5); assert.ok(S.cans[1].fill < f, 'it drains');
  assert.equal(D.held, -1);
});

test('by hand: the lights go amber near a place and green when each way is right', () => {
  const { S, D } = fresh(), m = mounts[0], o = [m.at[0], m.at[2] + m.out[1]];
  D.step(1 / 60, {}); assert.deepEqual(D.read().aids, { x: 'off', y: 'off', h: 'off' }, 'far from everything');
  run(D, 14, toward(S, o[0] + 0.3, o[1]));
  const r = D.read().aids; assert.ok(r.x !== 'off' || r.y !== 'off', 'near: ' + JSON.stringify(r));
  run(D, 3, {});
  const r2 = D.read().aids; assert.equal(r2.x, 'on'); assert.equal(r2.y, 'on', 'lined itself up: ' + JSON.stringify(r2));
});

test('by hand: it holds on in mid-air (it lets go only where a canister can rest), and takes a docked one back', () => {
  const { S, D } = fresh(), m = mounts[0], o = [m.at[0], m.at[2] + m.out[1]];
  run(D, 14, toward(S, o[0], o[1]));
  until(D, () => D.held === 0, 12, { hoist: -1 });
  run(D, 3, { hoist: 1 });
  run(D, 6, toward(S, o[0] - 6, o[1] + 4));
  run(D, 4, {}); assert.equal(D.held, 0, 'still held in mid-air');
  // (into socket 3 and back out again)
  const sk = sockets[4], W = [sk.at[0], sk.at[2] + site.can.half + site.can.clear];
  run(D, 12, toward(S, W[0], W[1] + 0.3)); until(D, () => Math.abs(S.hoist - sk.at[1]) < 0.3, 10, { hoist: -1 });
  assert.ok(until(D, () => S.cans[0].where === 'socket', 20) != null, 'docked');
  assert.ok(until(D, () => !D.busy, 5) != null, 'let go');
  run(D, 2, { hoist: 1 });
  assert.ok(until(D, () => D.held === 0, 20, { hoist: -1 }) != null, 'lowered back onto it, it takes it (the dogs let go first)');
  const z0 = S.z; run(D, 6, { move: [0, 1] });
  assert.ok(S.z > z0 + 0.5 && S.lit[4] < 0.01, 'drawn back out of the collar, the dogs open: ' + (S.z - z0).toFixed(2) + ' ' + S.lit[4]);
});

test('nothing driven through anything: the floor, the wall, a canister in the way', () => {
  const { S, D } = fresh();
  run(D, 20, toward(S, 33, -17.0));
  run(D, 12, { hoist: -1 });
  assert.ok(S.hoist + 0.16 > 0, 'the empty cradle not through the floor: ' + S.hoist);
  run(D, 6, { move: [0, -1] });
  const pts = []; D.blocked(D.cfg()); assert.ok(S.z > -18.78 + 0.5, 'not into the wall: ' + S.z);
  void pts;
});

test('free control: no rule for people (they run: src/crane.js); the autopilot waits for anyone under the load', () => {
  const man = [{ x: 30, y: 0, z: -12 }];
  const { S, D } = fresh(man);
  D.go([{ to: { x: 30, z: -12 } }]); until(D, () => !D.busy, 30);
  run(D, 6, { hoist: -1 });
  assert.ok(S.hoist < 3, 'by hand it comes down over them: ' + S.hoist);
  const B = fresh(man); B.D.rules.people = true;
  B.D.go([{ to: { x: 30, z: -12 } }, { to: { hoist: 1 } }]); run(B.D, 20);
  assert.ok(B.S.hoist > 5, 'the autopilot does not: ' + B.S.hoist);
  assert.ok(B.D.notes.some((n) => n.key === 'people') && B.D.busy, 'it waits, and says why');
  man.length = 0; run(B.D, 12); assert.ok(!B.D.busy, 'and goes on when they have gone');
});

test('the autopilot: x, y and the turn at once, each at its own speed, and exactly where asked', () => {
  const { S, D } = fresh();
  D.go([{ to: { x: 30, z: -10, yaw: Q } }]);
  let both = 0;
  for (let t = 0; t < 30 && D.busy; t += 1 / 60) { const x0 = S.x, z0 = S.z, y0 = S.yaw; D.step(1 / 60); if (S.x !== x0 && S.z !== z0 && S.yaw !== y0) both++; }
  assert.ok(both > 60, 'moving all three together for ' + both + ' frames');
  assert.ok(Math.abs(S.x - 30) < 1e-6 && Math.abs(S.z + 10) < 1e-6 && Math.abs(S.yaw - Q) < 1e-6);
  // (a move asked at a set speed takes its time: 10 m at 2 m a second, very nearly 5 s)
  D.go([{ to: { x: 40 }, v: { x: 2 }, even: true, asked: true }]);
  const T = until(D, () => !D.busy, 20); assert.ok(Math.abs(T - 5) < 0.15, 'took ' + T);
});

test('giving the controls back: the way up from anywhere, and the round goes on from there to done', () => {
  for (const at of [[33, -17.0, 0.9], [38.14, -8.21, 4.6], [48.3, -16.8, 2.5]]) {
    const { S, D } = fresh();
    D.go([{ to: { x: at[0], z: at[1] } }, { to: { hoist: at[2] } }]); until(D, () => !D.busy, 40);
    D.leave(); assert.ok(until(D, () => D.left, 60) != null, 'it got up from ' + at);
    assert.ok(Math.abs(S.hoist - site.carry) < 1e-6);
    const p = planFrom(site, S); assert.equal(loadAt(p, p.length).phase, 'done');
  }
});

test('the round, taken up after a canister was docked by hand, carries on: the one docked by hand counts', () => {
  const { S, D } = fresh(), m = mounts[1], o = [m.at[0], m.at[2] + m.out[1]];
  run(D, 14, toward(S, o[0], o[1])); until(D, () => D.held === 1, 12, { hoist: -1 }); until(D, () => S.hoist > 5.5, 10, { hoist: 1 });
  const sk = sockets[0], W = [sk.at[0], sk.at[2] + site.can.half + site.can.clear];
  run(D, 14, toward(S, W[0], W[1] + 0.3)); until(D, () => Math.abs(S.hoist - sk.at[1]) < 0.3, 10, { hoist: -1 }); until(D, () => S.cans[1].where === 'socket', 20);
  D.leave(); until(D, () => D.left, 60);
  const p = planFrom(site, S), L0 = loadAt(p, 0);
  assert.equal(L0.docked.length, 1); assert.equal(L0.onShip, 7);
  const L = loadAt(p, p.length); assert.equal(L.phase, 'done'); assert.equal(L.onShip, 8); assert.equal(L.fullOnShip, 0);
});
