// The bridge crane worked live (kit/crane-drive.js): free control by a pretend stick, the autopilot the crane game
// drives, the round taken up again from wherever things are left (kit/crane-plan.js planFrom):
//   node --test pi-nebula/tests/*.test.mjs
// The places are the Miner hangar's as the game finds them (the same as crane.test.mjs), the parts' sizes kit/smelter.js's
// (typed in: node has no three.js); what stands still is a stand-in: the floor, the socket wall and the sockets' collars.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCycle, planFrom, stateAt, startOf, loadAt } from '../kit/crane-plan.js';
import { makeDrive, DRIVE } from '../kit/crane-drive.js';
import { JOB as craneJob, MAKERS, PLACE, makeGame, tripFrom, toGrid, quadrantOf, mountName, magicMoves, SPEEDS, CHANGE_AT } from '../src/jobs/crane.js';
import * as E from '../src/jobs/engine.js';
import { helpPicture } from '../src/jobs/pics.js';
import { workOf } from '../../mathwood-valley/src/math/longwork.js';

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

test('by hand: lowered the moment it is over the tray, the tray still coming out: it waits for the tray, then takes the canister', () => {
  const { S, D } = fresh(), m = mounts[1], o = [m.at[0], m.at[2] + m.out[1]];
  assert.ok(until(D, () => Math.hypot(S.x - o[0], S.z - o[1]) < 0.12, 20, toward(S, o[0], o[1])) != null, 'over the tray');
  assert.ok(S.tray[1] < 0.999, 'its tray still on its way out: ' + S.tray[1].toFixed(3));
  assert.ok(until(D, () => D.held === 1, 15, { hoist: -1 }) != null, 'down at once: the tray all the way out (' + S.tray[1].toFixed(3) + '), and the canister taken (the hook at ' + S.hoist.toFixed(2) + ')');
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

// ── the crane game (src/jobs/crane.js): its cards, from the live crane, and the moves they make ──────────────────────
const stepsFor = (D, S, list) => list.map((s) => (typeof s.until === 'string' ? { until: s.until === 'tray' ? () => S.tray[s.i] > 0.999 : s.until === 'lit' ? () => S.lit[s.k] > 0.999 : () => D.held === s.c } : s));
function playLevel(L, cards = 10) {
  const S = startOf(site), D = makeDrive(site, S, { solid, eyes: [] }); D.byHand = false;
  const Q = makeGame(site, { state: () => S });
  const live = { ask: (k, o) => { const r = Q.ask(k, o); if (r) D.go(stepsFor(D, S, Q.before())); return r; }, peek: () => Q.peek(), pass: () => D.go(stepsFor(D, S, Q.skip())) };
  const out = [];
  for (let n = 0; n < cards; n++) {
    const a = craneJob.pickAsk(L.gen.mix, { live });
    assert.ok(a, `${L.id}: a maker for the next move (${Q.peek()})`);
    const o = MAKERS[a.maker].make(a.step, { live });
    assert.ok(until(D, () => !D.busy, 90) != null && !D.failed, `${L.id} card ${n}: getting into place: ${JSON.stringify(D.failed)}`);
    const f = o.facts || {};
    const v = f.straight ? null : f.both ? { x: SPEEDS.x, z: SPEEDS.y } : f.even ? (f.speed === SPEEDS.h && f.kind === 'lower' ? { hoist: SPEEDS.h } : f.axis === 'y' ? { z: SPEEDS.y } : { x: SPEEDS.x }) : null;
    const st = Q.right(null, { even: !!(f.even || f.both), v });
    D.go(stepsFor(D, S, st.concat(Q.left() === 0 ? Q.rest() : [])));
    assert.ok(until(D, () => !D.busy, 120) != null && !D.failed, `${L.id} card ${n}: the answer's move: ${JSON.stringify(D.failed)}`);
    out.push({ o, f, maker: a.maker });
  }
  return { S, out };
}

test('the crane game: every level deals good cards from the crane as it is, ten in a row, and the crane makes every move', () => {
  for (const L of PLACE.levels) {
    const { S, out } = playLevel(L);
    for (const { o, f, maker } of out) {
      const words = `${o.story} ${o.ask} ${o.coins.map((c) => c.big + ' ' + c.small + ' ' + (c.why || '')).join(' ')}`;
      assert.ok(!/NaN|undefined|Infinity|\[object/.test(words), `${L.id}: ${words}`);
      assert.equal(o.coins.filter((c) => c.good).length, 1, `${L.id}: one right answer`);
      assert.ok(o.coins.length >= 3, `${L.id} ${maker}: ${o.coins.length} answers`);
      for (const c of o.coins) assert.ok(!/^\s*[1-4][.)]\s/.test(c.big), c.big);
      assert.ok(f.live, `${L.id} ${maker}: a card about the crane as it is, not one from the log`);
      const pic = helpPicture(o); assert.ok(pic.svg.startsWith('<svg') && !/NaN|undefined/.test(pic.svg), `${L.id} ${maker}: its picture`);
      if (o.sum) assert.ok(workOf(o.sum.chain ? o.sum.chain[0] : o.sum), `${L.id} ${maker}: its sum can be worked on paper`);
    }
    // (two whole trips: two canisters off the ship and docked)
    assert.equal(S.cans.filter((q) => q.where === 'socket').length, 2, `${L.id}: two docked`);
  }
});

test('the crane game\'s makers are right: quadrants, squares, readings, distances, pairs, turns, heights, plus and minus, times, both at once, straight across', () => {
  const at = (L, n) => playLevel(PLACE.levels.find((q) => q.id === L), n).out;
  const right = (o) => o.coins.find((c) => c.good);
  for (const { o, f } of at('quad', 5).filter((x) => x.maker === 'quad')) assert.equal(right(o).v, f.quad);
  for (const { o, f } of at('dist', 5).filter((x) => x.maker === 'dist')) assert.ok(Math.abs(right(o).v - f.d) < 1e-9 && f.d >= 2);
  for (const { o } of at('degrees', 5).filter((x) => x.maker === 'turn')) assert.equal(right(o).v, 90);
  for (const { o, f } of at('change', 5).filter((x) => x.maker === 'change')) { assert.equal(right(o).v - CHANGE_AT, f.change); assert.ok(f.change < 0, 'down is minus'); }
  for (const { o, f } of at('time', 5).filter((x) => x.maker === 'time')) assert.ok(Number.isInteger(right(o).v) && f.T === right(o).v, 'whole seconds at the first time level');
  for (const { o, f } of at('both', 5).filter((x) => x.maker === 'both')) assert.ok(Number.isInteger(right(o).v) && right(o).v === f.T);
  for (const { o, f } of at('straight', 5).filter((x) => x.maker === 'straight')) assert.ok(Number.isInteger(right(o).v), 'a whole straight line: ' + f.d);
  // (from the log, without a crane: still good cards)
  for (const L of PLACE.levels) for (const a of L.gen.mix) { const o = MAKERS[a.maker].make(a.step, {}); assert.equal(o.coins.filter((c) => c.good).length, 1); assert.ok(!/NaN|undefined/.test(o.story + o.ask)); }
});

test('the crane game: the grid counts from the hangar\'s south-west corner, the quadrants as a coordinate plane\'s, the Miner\'s places by name', () => {
  assert.deepEqual(toGrid(site, 19, 9), [0, 0]);
  assert.deepEqual(toGrid(site, 59, -19), [40, 28]);
  assert.equal(quadrantOf(site, 30, 20), 1); assert.equal(quadrantOf(site, 10, 20), 2); assert.equal(quadrantOf(site, 10, 5), 3); assert.equal(quadrantOf(site, 30, 5), 4);
  const names = mounts.map((_, i) => mountName(site, i));
  assert.equal(new Set(names).size, 8, names.join(', '));
  assert.ok(names.every((n) => /^(Upper|Lower)-(Forward|Aft)-(Port|Starboard)$/.test(n)));
  // (the trip: the round's own next one, and a test lift once the round is done)
  const S = startOf(site), t1 = tripFrom(site, S);
  assert.equal(t1.phase, 'unload'); assert.equal(t1.from.kind, 'mount'); assert.equal(t1.to.kind, 'socket');
});

test('the crane game pays as every job does: about 50 credits at the first level, 200 at the last', () => {
  E.register(craneJob);
  const pays = PLACE.levels.map((L) => E.payFor(L));
  assert.equal(pays[0], 50); assert.equal(pays[pays.length - 1], 200);
  for (let i = 1; i < pays.length; i++) assert.ok(pays[i] >= pays[i - 1] && pays[i] - pays[i - 1] <= 20, 'no big jumps: ' + pays.join(', '));
  const grades = PLACE.levels.map((L) => L.grade); for (let i = 1; i < grades.length; i++) assert.ok(grades[i] > grades[i - 1] && grades[i] - grades[i - 1] <= 10, 'small steps up the school guide: ' + grades.join(', '));
});

test('the magic keeps the round\'s rules: upper canisters off the ship first, lower sockets first, never the trip\'s own canister or place', () => {
  const S = startOf(site), keep = 1, keepPlace = { kind: 'socket', i: 0 };
  const apply = (m) => { const q = S.cans[m.c]; if (q.where === 'socket') S.lit[q.i] = 0; q.where = m.to.where; q.i = m.to.i; if (m.to.where === 'socket') S.lit[m.to.i] = 1; };
  const twin = (list, i, up) => list.findIndex((q, j) => j !== i && !!q.upper === up && Math.abs(q.at[0] - list[i].at[0]) < 0.1 && Math.abs(q.at[2] - list[i].at[2]) < 0.1);
  let moves = 0;
  for (;;) {
    const [m] = magicMoves(site, S, 'unload', keep, keepPlace); if (!m) break;
    assert.notEqual(m.c, keep, 'never the trip\'s canister');
    assert.ok(!(m.to.where === 'socket' && m.to.i === 0), 'never the trip\'s place');
    const from = S.cans[m.c];
    if (from.where === 'mount' && !mounts[from.i].upper) { const up = twin(mounts, from.i, true); assert.ok(!S.cans.some((q) => q.where === 'mount' && q.i === up), 'a lower one only with the one over it gone'); }
    if (sockets[m.to.i].upper) { const lo = twin(sockets, m.to.i, false); assert.ok(S.cans.some((q) => q.where === 'socket' && q.i === lo), 'an upper socket only over a filled lower one'); }
    apply(m); moves++;
  }
  assert.ok(moves >= 5, moves + ' moved');
  assert.equal(S.cans[keep].where, 'mount', 'the trip\'s own canister is still on the ship');
  // (loading only once no ore is left on the ship; clearing only drained canisters)
  assert.equal(magicMoves(site, S, 'load', -1, null).length, 0, 'no loading while ore is still on the ship');
  S.cans.forEach((q) => { if (q.where === 'socket') q.fill = 0.5; });
  assert.equal(magicMoves(site, S, 'clear', -1, null).length, 0, 'none cleared while still draining');
});
