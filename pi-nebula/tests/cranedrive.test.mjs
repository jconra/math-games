// The crane worked by hand (kit/crane-drive.js), the round taken up again from wherever things are left
// (kit/crane-plan.js planFrom), and the crane operator job's moves and questions (src/jobs/crane.js):
//   node --test pi-nebula/tests/*.test.mjs
// The places are the Miner hangar's as the game finds them (the same as crane.test.mjs), with the rail's ends and the
// parts' sizes from kit/smelter.js; what stands still is a stand-in: the floor, the socket wall and the sockets' collars.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCycle, planFrom, stateAt, cleanAt, canAt, loadAt } from '../kit/crane-plan.js';
import { makeDrive, DRIVE } from '../kit/crane-drive.js';
import { JOB as crane, FREE, tripFrom, makeJobQueue, marksOf, mountName, RATED, EMPTY, CHANGE_AT } from '../src/jobs/crane.js';
import * as E from '../src/jobs/engine.js';
import { helpPicture } from '../src/jobs/pics.js';
import { workOf } from '../../mathwood-valley/src/math/longwork.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

const Q = Math.PI / 2, deg = Math.PI / 180;
const mounts = [];
for (const [z, o] of [[-7.208, -1], [-2.792, 1]]) for (const y of [3.644, 2.252]) for (const [x, yaw] of [[40.578, Q], [38.142, -Q]]) mounts.push({ at: [x, y, z], yaw, out: [0, o], upper: y > 3 });
const sockets = []; for (const x of [29, 31.5, 34, 36.5]) for (const y of [0.75, 2.2]) sockets.push({ at: [x, y, -18.16], n: [0, 1], upper: y > 1.5 });
const bays = []; for (let j = 0; j < 8; j++) bays.push({ at: [46 + j * 1.15, 0.65, -16.8] });
const ARMS = [-1, 1].flatMap((end) => [1, -1].map((s) => ({ z: end * (0.55 + s * 0.036), way: end * s })));
const site = { carry: 6.3, wallZ: -16.8, shipX: 39.36, turn: [39.36, -16.8], home: [46, -16.8], mounts, sockets, bays, can: { half: 1.088, seat: 0.4, clear: 0.45, rise: 0.9, lift: 0.09 },
  rail: { wall: [28, 55], ship: [-16.8, -0.8], y: 8.95 },
  dims: { R: 0.47, grip: { w: 0.35, under: 0.67, top: 0.79, half: 0.65 }, arc: { r: 0.54, tube: 0.03, z: 0.55, gap: 0.036, half: 72 * deg, shut: 108 * deg }, arms: ARMS, reach: 1.25, body: 0.7,
    sock: { deep: 0.62, bore: 0.535, mouth: 0.585, out: 0.68 }, trayShare: 0.15, cable: { x: 0.26, z: 0.3 }, cableTop: -1.16 } };
// what stands still: the floor, the wall behind the sockets, each socket's collar round its bore
const solid = (x, y, z) => {
  if (y < 0 || z < -18.78) return true;
  for (const s of sockets) { const ax = z - s.at[2], r = Math.hypot(x - s.at[0], y - s.at[1]); if (ax > -0.62 && ax < 0 && r > 0.535 && r < 0.74) return true; }
  return false;
};
const plan = planCycle(site);
const fresh = (eyes = []) => { const S = stateAt(plan, 0); return { S, D: makeDrive(site, S, { solid, eyes }) }; };
const run = (D, secs, cmd = {}) => { for (let t = 0; t < secs; t += 1 / 60) D.step(1 / 60, typeof cmd === 'function' ? cmd() : cmd); };
const until = (D, fn, secs = 120) => { for (let t = 0; t < secs; t += 1 / 60) { D.step(1 / 60); if (fn()) return t; } return null; };
const hook = (S) => [S.x + Math.sin(S.yaw) * S.slide, S.hoist, S.z + Math.cos(S.yaw) * S.slide];
// the autopilot from the rack's end (the trolley parked) to a full canister on the ship, and with it to a socket
function toShipAndBack(D, S, i = 0, k = 0) {
  const m = mounts[i], o = [m.at[0] + m.out[0], m.at[2] + m.out[1]], sk = sockets[k];
  D.go([{ axis: 'along', to: site.turn[0] }, { turn: true }, { axis: 'along', to: o[1] }, { axis: 'slide', to: o[0] - site.turn[0] }]); assert.ok(until(D, () => !D.busy) != null && !D.failed, JSON.stringify(D.failed));
  assert.ok(until(D, () => S.tray[i] > 0.999, 15) != null, 'the ship\'s tray comes out for the crane');
  D.go([{ axis: 'hoist', to: m.at[1] + site.can.lift }, { grab: 'shut' }]); assert.ok(until(D, () => !D.busy) != null && !D.failed, JSON.stringify(D.failed));
  assert.equal(D.held, i, 'it has the canister');
  D.go([{ axis: 'hoist', to: site.carry }, { axis: 'slide', to: 0 }, { axis: 'along', to: site.turn[1] }, { turn: true }, { axis: 'along', to: sk.at[0] }, { axis: 'slide', to: sk.at[2] + site.can.half + site.can.clear - site.wallZ }]);
  assert.ok(until(D, () => !D.busy) != null && !D.failed, JSON.stringify(D.failed));
}

test('by hand: a canister off the ship and docked in a socket, end on, through its iris, held by the dogs, let go, draining', () => {
  const { S, D } = fresh();
  toShipAndBack(D, S, 0, 0);
  assert.ok(S.tray[0] < 1e-6, 'the tray went home once the cradle was up');
  // (letting go in mid-air: it will not)
  D.step(1 / 60, { grab: 'open' });
  assert.equal(D.held, 0); assert.ok(D.notes.some((n) => n.key === 'letgo'), 'and it says why');
  const sk = sockets[0];
  D.go([{ axis: 'hoist', to: sk.at[1] }]); assert.ok(until(D, () => !D.busy) != null && !D.failed);
  // (pushed in before the iris is open: it waits at the mouth; then it goes in)
  assert.ok(until(D, () => S.iris[0] > 0.999, 5) != null, 'the iris opens for a canister lined up in front of it');
  D.go([{ axis: 'slide', to: sk.at[2] + site.can.half - site.can.seat - site.wallZ, v: 0.2 }]); assert.ok(until(D, () => !D.busy) != null && !D.failed);
  // (and no deeper than seated)
  const deep = D.blocked({ ...D.cfg(), slide: S.slide - 0.05 });
  assert.ok(deep && deep.what === 'seated', 'it cannot be pushed deeper than seated');
  assert.ok(until(D, () => S.lit[0] > 0.999, 3) != null, 'the dogs shut on it');
  assert.ok(D.resting(), 'seated with the dogs shut: a place it may rest');
  D.go([{ grab: 'open' }]); until(D, () => !D.busy);
  assert.equal(D.held, -1); assert.deepEqual([S.cans[0].where, S.cans[0].i], ['socket', 0]);
  const f0 = S.cans[0].fill; run(D, 5); assert.ok(S.cans[0].fill < f0 - 0.05, 'it drains as the round\'s do');
});

test('by hand: an upper socket too, lined up on the one nearer the load\'s height', () => {
  const { S, D } = fresh();
  toShipAndBack(D, S, 1, 3);   // (socket 3: the upper one at the second column)
  const sk = sockets[3];
  D.go([{ axis: 'hoist', to: sk.at[1] }]); assert.ok(until(D, () => !D.busy) != null && !D.failed);
  const L = D.lineup(); assert.ok(L && L.kind === 'socket' && L.i === 3, 'lined up on the upper socket, not the lower: ' + JSON.stringify(L && [L.kind, L.i]));
  assert.ok(until(D, () => S.iris[3] > 0.999, 5) != null, 'its iris opens');
  D.go([{ axis: 'slide', to: sk.at[2] + site.can.half - site.can.seat - site.wallZ, v: 0.2 }]); assert.ok(until(D, () => !D.busy) != null && !D.failed, JSON.stringify(D.failed));
  assert.ok(until(D, () => S.lit[3] > 0.999, 3) != null && D.resting());
  D.go([{ grab: 'open' }]); until(D, () => !D.busy);
  assert.deepEqual([S.cans[1].where, S.cans[1].i], ['socket', 3]);
});

test('by hand: nothing is lowered over a person, and a low load is not moved over one', () => {
  const { S, D } = fresh([{ x: 46.3, y: 0, z: -16.4 }]);
  run(D, 2, { hoist: -1 });
  assert.ok(Math.abs(S.hoist - site.carry) < 1e-9, 'the hook did not come down'); assert.ok(D.notes.some((n) => n.key === 'people'));
  // (someone up on the catwalk is not under it)
  const { S: S2, D: D2 } = fresh([{ x: 46.3, y: 2.6, z: -16.4 }]);
  run(D2, 2, { hoist: -1 }); assert.ok(S2.hoist < site.carry - 0.5);
  // a load brought low away from them, then pushed toward them: it stops short
  const { S: S3, D: D3 } = fresh([{ x: 50.5, y: 0, z: -16.8 }]);
  run(D3, 3.5, { hoist: -1 }); assert.ok(S3.hoist < 4);
  run(D3, 4, { move: [1, 0] });
  const [hx] = hook(S3);
  // (the cradle lies across the rail: its arms reach 0.57 m to each side, and the margin is beyond that)
  assert.ok(hx < 50.5 - (site.dims.arc.r + site.dims.arc.tube) - DRIVE.margin + 0.02, `it stopped short of the person (hook at x ${hx.toFixed(2)})`);
  assert.ok(hx > 50.5 - (site.dims.arc.r + site.dims.arc.tube) - DRIVE.margin - 0.3, `and not long before (hook at x ${hx.toFixed(2)})`);
});

test('by hand: nothing driven through anything, and the grab lets go only where a canister can rest', () => {
  const { S, D } = fresh();
  // the empty cradle comes down onto a canister on the rack only as far as its crown
  run(D, 8, { hoist: -1 });
  assert.ok(Math.abs(S.hoist - bays[0].at[1]) < 0.01, `on the canister's crown: the hook at ${S.hoist.toFixed(3)}`);
  D.step(1 / 60, { grab: 'shut' }); until(D, () => !D.busy, 5);
  assert.equal(D.held, 8, 'it took the canister in bay 1');
  // lifted a little and pushed into the next bay's canister: it stops
  D.go([{ axis: 'hoist', to: 1.2 }]); until(D, () => !D.busy);
  run(D, 3, { move: [1, 0] });
  const [hx] = hook(S);
  assert.ok(hx < bays[1].at[0] - 0.9, `it stopped before the next canister (hook at x ${hx.toFixed(2)})`);
  assert.ok(D.notes.some((n) => n.key === 'hit:canister') || D.blocked({ ...D.cfg(), x: S.x + 0.1 }), 'another canister is in the way');
  // into the wall: a canister along z pushed toward the wall stops before it
  D.go([{ axis: 'hoist', to: site.carry }, { axis: 'along', to: 44 }]); until(D, () => !D.busy);
  run(D, 4, { move: [0, -1] });
  assert.ok(hook(S)[2] - site.can.half > -18.78, 'not through the wall');
  // down onto the floor, then let go there: refused
  run(D, 8, { hoist: -1 });
  assert.ok(S.hoist - 0.47 > 0, 'not through the floor');
  D.step(1 / 60, { grab: 'open' }); assert.equal(D.held, 8, 'not let go on the floor');
  // set back down in its bay: lined up as it comes down, then it lets go
  D.go([{ axis: 'hoist', to: site.carry }, { axis: 'slide', to: 0 }, { axis: 'along', to: bays[0].at[0] + 0.2 }]); until(D, () => !D.busy);
  run(D, 9, { hoist: -1 });
  assert.ok(Math.abs(hook(S)[0] - bays[0].at[0]) < 0.004 && Math.abs(S.hoist - bays[0].at[1]) < 0.004, 'lined itself up on the bay as it came down');
  D.step(1 / 60, { grab: 'open' }); until(D, () => !D.busy, 5);
  assert.equal(D.held, -1); assert.deepEqual([S.cans[8].where, S.cans[8].i], ['bay', 0]);
});

test('by hand: let go of the stick near a place and the crane settles onto it, and it stops within a metre', () => {
  const { S, D } = fresh();
  run(D, 1.2, { move: [1, 0] });
  const x0 = S.x; run(D, 2.5);
  assert.ok(S.x - x0 < 1.0, `it stopped within a metre of letting go (${(S.x - x0).toFixed(2)} m)`);
  const onBay = bays.some((b) => Math.abs(hook(S)[0] - b.at[0]) < 0.005);
  assert.ok(onBay, `it settled onto a bay (the hook at x ${hook(S)[0].toFixed(3)})`);
});

test('by hand: along the rail only, round the turntable only on it, the carriage only along its beam', () => {
  const { S, D } = fresh();
  run(D, 20, { move: [-1, 0] });
  assert.ok(Math.abs(S.z - site.wallZ) < 1e-9, 'it stays on the wall rail');
  assert.ok(S.x >= site.rail.wall[0] + site.dims.body - 1e-6, 'it stops at the rail\'s end');
  D.step(1 / 60, { turn: true }); assert.ok(D.notes.some((n) => n.key === 'turn'), 'no turning away from the turntable');
  run(D, 3, { move: [0, 1] });
  assert.ok(Math.abs(S.slide) <= site.dims.reach + 1e-9, 'the carriage keeps to its beam');
});

test('giving the controls back: the way up from anywhere, and the round goes on from there', () => {
  const { S, D } = fresh();
  toShipAndBack(D, S, 1, 2);   // (an upper canister, to a lower socket)
  D.leave(); assert.ok(until(D, () => D.left, 60) != null, 'it worked its way up');
  assert.ok(Math.abs(S.hoist - site.carry) < 1e-9 && Math.abs(S.slide) < 1e-9);
  const p = planFrom(site, S);
  assert.ok(p.length > 60, 'a round from here');
  const L = loadAt(p, p.length - 0.01); assert.deepEqual([L.onShip, L.fullOnShip, L.onRack, L.docked.length], [8, 8, 8, 0]);
  // from every clean moment of a round, held by hand and given straight back
  let n = 0;
  for (let t = 3; t < plan.length; t += 97) {
    const u = cleanAt(plan, t); if (u == null) continue;
    const S2 = stateAt(plan, u), D2 = makeDrive(site, S2, { solid });
    D2.leave(); assert.ok(until(D2, () => D2.left, 90) != null, 'up from the round at ' + u.toFixed(1));
    const p2 = planFrom(site, S2); const L2 = loadAt(p2, p2.length - 0.01);
    assert.deepEqual([L2.onShip, L2.onRack, L2.docked.length], [8, 8, 0], 'and the round ends as a round does, from ' + u.toFixed(1));
    n++;
  }
  assert.ok(n > 10, n + ' moments');
});

test('the round taken up from any arrangement of the sixteen canisters ends as a round does', () => {
  let seed = 9; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 120; k++) {
    const places = [...mounts.map((_, i) => ['mount', i]), ...sockets.map((_, i) => ['socket', i]), ...bays.map((_, i) => ['bay', i])];
    for (let i = places.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [places[i], places[j]] = [places[j], places[i]]; }
    const held = rnd() < 0.4, cans = [];
    for (let c = 0; c < 16; c++) {
      if (held && c === 15) { cans.push({ where: 'held', rel: 0, fill: rnd() < 0.5 ? 1 : 0 }); continue; }
      const [w, i] = places[c]; cans.push({ where: w, i, yaw: w === 'mount' ? mounts[i].yaw : 0, fill: [0, 1, 0.4][Math.floor(rnd() * 3)] });
    }
    const S = { x: 30 + rnd() * 8, z: -16.8, yaw: 0, disc: 0, slide: 0, hoist: site.carry, arms: held ? 1 : 0, latch: held ? 1 : 0, tray: mounts.map(() => 0), iris: sockets.map(() => 0), lit: sockets.map(() => 0), cans };
    for (const q of cans) if (q.where === 'socket') S.iris[q.i] = S.lit[q.i] = 1;
    const p = planFrom(site, S);
    for (let t = 0; t < p.length; t += 2) { const seen = new Set(); p.cans.forEach((_, c) => { const a = canAt(p, c, t); if (a.where !== 'held') { assert.ok(!seen.has(a.where + a.i), 'two canisters in one place'); seen.add(a.where + a.i); } }); }
    const L = loadAt(p, p.length - 0.01); assert.deepEqual([L.onShip, L.fullOnShip, L.onRack, L.docked.length], [8, 8, 8, 0]);
  }
});

// ── the crane operator job ─────────────────────────────────────────────────────────────────────────────────────────
const num = (label) => Number(String(label).replace(/[−]/g, '-').replace(/,/g, '').replace(/^\+/, '').split(' ')[0].replace(/^the\s*/, ''));
test('the job\'s trips: the round\'s own, one canister each, and the moves end where the next begins', () => {
  const S = stateAt(plan, 0), P = { x: S.x, z: S.z, yaw: S.yaw, slide: 0, hoist: site.carry, held: -1, cans: S.cans.map((q) => ({ where: q.where, i: q.i, fill: q.fill })) };
  const names = [];
  for (let n = 0; n < 24; n++) {
    const T = tripFrom(site, P); if (!T) break;
    names.push(T.name);
    for (const s of T.steps) if (s.kind === 'along') {
      assert.ok(Math.abs(s.markTo - s.mark) > 1e-6);
      // (on the rail: the wall rail's marks 0 to 27, the ship rail's 0 to 16)
      const top = s.leg === 'wall' ? site.rail.wall[1] - site.rail.wall[0] : site.rail.ship[1] - site.turn[1];
      for (const m of [s.mark, s.markTo]) assert.ok(m >= -1e-9 && m <= top + 1e-9, `${s.leg} rail mark ${m} (${s.what})`);
    }
  }
  assert.deepEqual(names, [...Array(8).fill('unload'), ...Array(8).fill('load'), ...Array(8).fill('clear')].slice(0, names.length), 'unload, then load, then clear, as the round');
  assert.equal(names.length, 24);
});

test('the job\'s queue: a question holds the next move of its kind, on the level\'s marks; a right answer is exactly that move', () => {
  const S = stateAt(plan, 0), Qu = makeJobQueue(site, { start: () => S, oreOf: () => 1.2 }), W = marksOf(site);
  // (the next move is the trolley along the wall rail to the turntable: a card about a distance, or the whole route)
  assert.deepEqual(Qu.peek(), ['trip', 'along', 'route']);
  // the job picks, from a level's makers, one that suits that move
  const pick = crane.pickAsk([{ maker: 'hoist', step: 1 }, { maker: 'rail', step: 1 }], { live: { peek: Qu.peek } });
  assert.equal(pick.maker, 'rail');
  // a level none of whose questions suits the very next move asks about the first coming move one does suit (the grab)
  const ahead = Qu.ahead();
  assert.deepEqual(ahead[0], ['trip', 'along', 'route']);
  assert.ok(ahead.some((k) => k.includes('grab')), JSON.stringify(ahead));
  assert.equal(crane.pickAsk([{ maker: 'weight', step: 1 }], { live: { ahead: Qu.ahead } }).maker, 'weight');
  // the Miner's eight places each have their own name on the cards
  const names = site.mounts.map((m, i) => mountName(site, i));
  assert.equal(new Set(names).size, 8, names.join(' | '));
  assert.equal(names[0], "the top canister on the rack's side at the ship's wall end");
  // and a question about no move (Mathwood's word problems) still comes, by its weight
  const mixT = [{ maker: 'trips', step: 1, w: 1.5 }, { maker: 'words', step: 7, w: 1 }];
  assert.equal(crane.pickAsk(mixT, { rand: () => 0, live: { ahead: Qu.ahead } }).maker, 'trips');
  assert.equal(crane.pickAsk(mixT, { rand: () => 0.99, live: { ahead: Qu.ahead } }).maker, 'words');
  const a = Qu.ask('along', { prec: 1 });
  assert.ok(a && Number.isInteger(a.mark) && Number.isInteger(a.markTo) && a.what, JSON.stringify(a));
  const steps = Qu.right(a.id), asked = steps.find((s) => s.asked);
  assert.ok(asked && Math.abs(asked.to - (a.leg === 'wall' ? site.rail.wall[0] + a.markTo : site.turn[1] + a.markTo)) < 1e-9, 'the asked move goes to the answer\'s mark');
  // tenths, a hoist, a weight, a route, a time
  for (const [kind, opts] of [['hoist', { prec: 0.1 }], ['weight', {}], ['along', { prec: 0.1 }], ['time', { prec: 0.1, speeds: [0.5, 1.5, 0.6, 0.8, 1.2] }], ['route', { prec: 0.1 }], ['trip', { most: 8 }]]) {
    const r = Qu.ask(kind, opts); assert.ok(r, kind + ': nothing found');
    if (kind === 'time') assert.ok(Number.isInteger(Math.round(Math.abs(r.markTo - r.mark) / r.speed * 1e6) / 1e6), 'a whole number of seconds');
    const st = Qu.right(r.id); assert.ok(st.length > 0, kind + ': no moves given');
  }
  void W;
});

test('the job\'s makers: every level deals good questions, from the crane as it is and from the log', () => {
  assert.equal(E.register(crane), true);
  const P = crane.place;
  for (let i = 1; i < P.levels.length; i++) assert.ok(P.levels[i].grade >= P.levels[i - 1].grade, P.levels[i].id);
  for (const L of P.levels) {
    for (let k = 0; k < 30; k++) {
      const rand = seeded(L.grade * 31 + k), live = k % 2 ? null : (() => { const S = stateAt(plan, 0), Qu = makeJobQueue(site, { start: () => S }); return { ask: Qu.ask }; })();
      const who = { id: 'c', name: 'T', look: { id: 'zuri' } };
      setLevelAt(who, 'crane', L.id);
      const q = E.deal(who, crane, { rand, live });
      const o = q.order;
      assert.equal(o.coins.filter((c) => c.good).length, 1, `${L.id}: ${o.story}`);
      assert.ok(o.coins.length >= 3, `${L.id}: ${o.coins.length} coins: ${o.story} ${o.ask}`);
      assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${L.id}: two alike: ${o.coins.map((c) => c.label)}`);
      const words = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.big} ${c.small} ${c.why}`).join(' ')} ${o.rightWhy || ''}`;
      assert.ok(!/NaN|undefined|Infinity|\[object/.test(words), `${L.id}: ${words}`);
      // (no answer button carries a 1-4 key number beside its answer: the number and its unit, nothing else)
      for (const c of o.coins) assert.ok(!/^\s*[1-4][.)]\s/.test(c.big) && !/\b(key|press)\b/i.test(c.big), c.big);
      const pic = helpPicture(o); assert.ok(!o.help || pic.svg.startsWith('<svg'), `${L.id}: no picture`);
      if (o.sum) for (const x of (o.sum.chain || [o.sum])) assert.doesNotThrow(() => workOf(x), `${L.id}: ${JSON.stringify(x)}`);
    }
  }
});

test('the job\'s makers are right: distances, heights, plus and minus, times, weights, trips, routes', () => {
  const rand = seeded(7), M = crane.makers, right = (o) => o.coins.find((c) => c.good);
  for (let k = 0; k < 120; k++) {
    const r = M.rail.make(1 + (k % 2), { rand }); assert.ok(Math.abs(num(right(r).label) - Math.abs(r.facts.d)) < 1e-9);
    const h = M.hoist.make(1 + (k % 2), { rand }); assert.ok(Math.abs(num(right(h).label) - h.facts.d) < 1e-9);
    const c = M.change.make(1, { rand }); assert.equal(right(c).v - CHANGE_AT, c.facts.change); assert.ok(c.facts.change < 0 ? right(c).big.startsWith('−') : right(c).big.startsWith('+'));
    const t = M.time.make(1 + (k % 2), { rand }); assert.ok(Math.abs(num(right(t).label) * t.facts.v - t.facts.d) < 1e-6, `${t.story} -> ${right(t).label}`);
    const w = M.weight.make(2, { rand }); assert.ok(Math.abs(num(right(w).label) - (w.facts.more ? w.facts.spare : w.facts.all)) < 1e-9); assert.ok(w.facts.all <= RATED && w.facts.all >= EMPTY);
    const tr = M.trips.make(1, { rand }); assert.equal(num(right(tr).label), tr.facts.all);
    const ro = M.route.make(1 + (k % 2), { rand }); assert.ok(Math.abs(num(right(ro).label) - (ro.facts.time ? ro.facts.secs : ro.facts.all)) < 1e-9);
    const m = M.mark.make(1, { rand }); assert.equal(right(m).v, m.facts.to);
    const hp = M.hops.make(1, { rand }); assert.ok(right(hp).v <= 5 && right(hp).v >= 1);
  }
});

test('free control and the crane operator job share the operator area, a side each', () => {
  assert.equal(FREE.pair, crane.pair); assert.notEqual(FREE.side, crane.side);
  assert.equal(FREE.drive, true); assert.equal(FREE.place, null); assert.ok(crane.place && crane.open && FREE.open);
});

test('the job\'s queue: the moves before an asked one are made as the card comes, the asked one on the right answer', () => {
  const plan = planCycle(site), S = stateAt(plan, 0), Qu = makeJobQueue(site, { start: () => S, oreOf: () => 1.2 });
  // a weight card holds the first grab of a canister: the crane goes there (and down to it) by itself first
  const w = Qu.ask('weight');
  assert.ok(w);
  const before = Qu.before();
  assert.ok(before.some((s) => s.axis === 'along') && before.some((s) => s.axis === 'hoist'), JSON.stringify(before));
  assert.ok(!before.some((s) => s.grab === 'shut'));
  assert.deepEqual(Qu.before(), []);   // (made once)
  // the right answer: the grab and the lift
  const right = Qu.right(w.id);
  assert.equal(right[0].grab, 'shut');
  assert.ok(right.some((s) => s.axis === 'hoist'));
  // a card about the last 5 m of a longer way: the crane makes the rest by itself first, onto the mark the card starts on
  const Q2 = makeJobQueue(site, { start: () => S, oreOf: () => 1.2 }), h = Q2.ask('along', { prec: 1, most: 5 }), b2 = Q2.before();
  const last = b2[b2.length - 1], at0 = h.leg === 'wall' ? site.rail.wall[0] + h.mark : site.turn[1] + h.mark;
  assert.equal(last.axis, 'along'); assert.ok(Math.abs(last.to - at0) < 1e-9, JSON.stringify({ h, last }));
});

test('hurry: the moves the crane makes by itself go quicker while a card waits; a move a card asked about never', () => {
  const timeOf = (hurry, asked) => { const { D } = fresh(); D.hurry = hurry; D.go([{ axis: 'along', to: site.turn[0], asked }]); return until(D, () => !D.busy); };
  const plain = timeOf(1, false), quick = timeOf(2, false), askedQuick = timeOf(2, true);
  assert.ok(plain > 2 && quick < plain * 0.6, JSON.stringify({ plain, quick }));
  assert.ok(Math.abs(askedQuick - plain) < 1e-6, JSON.stringify({ plain, askedQuick }));
});

test('by hand it settles onto a place nearby as it comes to rest; run by the job (no stick) it stays where its moves leave it', () => {
  const offBy = (byHand) => {
    const { S, D } = fresh(); D.byHand = byHand;
    toShipAndBack(D, S, 0, 0);
    const x0 = sockets[0].at[0];
    D.go([{ axis: 'along', to: x0 + 0.5 }]); assert.ok(until(D, () => !D.busy) != null && !D.failed, JSON.stringify(D.failed));
    run(D, 3);
    return S.x - x0;
  };
  const hand = offBy(true), job = offBy(false);
  assert.ok(hand < 0.2, 'by hand: settled back toward the socket ' + hand);
  assert.ok(Math.abs(job - 0.5) < 1e-6, 'run by the job: left where it was ' + job);
});

test('low down it goes only over the patches the round works over (the station\'s people keep off them)', () => {
  const S = stateAt(plan, 0), lowOk = (x) => Math.abs(x - 42) > 3;   // (a made-up walkway across the rail, x 39 to 45)
  const D = makeDrive(site, S, { solid, eyes: [], lowOk });
  D.go([{ axis: 'along', to: 42 }]); assert.ok(until(D, () => !D.busy) != null && !D.failed);
  D.go([{ axis: 'hoist', to: 1.0 }]); until(D, () => !!D.failed, 30);
  assert.ok(D.failed && /People walk here/.test(D.failed.why), JSON.stringify(D.failed));
  assert.ok(S.hoist + 0.17 >= DRIVE.low - 0.03, 'it stayed high over the walkway: ' + S.hoist);
  // over a patch the round works over (here, past the walkway), all the way down
  D.failed = null;
  D.go([{ axis: 'hoist', to: site.carry }, { axis: 'along', to: 46.5 }, { axis: 'hoist', to: 1.0 }]); assert.ok(until(D, () => !D.busy) != null && !D.failed, JSON.stringify(D.failed));
  assert.ok(Math.abs(S.hoist - 1.0) < 1e-6);
  // and low, it does not go on over the walkway
  D.go([{ axis: 'along', to: 44 }]); until(D, () => !D.busy || !!D.failed, 30);
  assert.ok(S.x > 45 - 1e-6 && S.x < 45.5, 'stopped at the walkway: ' + S.x);
});

test('the job\'s moves come down low only over the patches the round works over: none is held up by the rule', () => {
  const seen = new Set(), patches = plan.gates.filter((g) => { const k = [g.x, g.z, g.hx, g.hz].join(); if (seen.has(k)) return false; seen.add(k); return true; });
  const lowOk = (x, z) => patches.some((g) => Math.abs(x - g.x) <= g.hx + 0.2 && Math.abs(z - g.z) <= g.hz + 0.2);
  const S = stateAt(plan, 0), D = makeDrive(site, S, { solid, eyes: [], lowOk }), Qu = makeJobQueue(site, { start: () => S, oreOf: () => 1.2 });
  let lows = 0;
  for (let n = 0; n < 30; n++) {
    const steps = Qu.right(null); if (!steps.length) break;
    D.go(steps); assert.ok(until(D, () => !D.busy, 120) != null && !D.failed, 'move ' + n + ': ' + JSON.stringify(D.failed));
    if (S.hoist < DRIVE.low) lows++;
  }
  assert.ok(lows > 3, 'it did come down low, over the places: ' + lows);
});
