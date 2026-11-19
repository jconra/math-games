// The crane's round as a timetable (kit/crane-plan.js): node --test pi-nebula/tests/*.test.mjs
// The places are the Miner hangar's, typed in here as the game finds them from its pieces (kit/crane.js): the ship's
// eight mounts (two rows, front and back, both sides), the eight sockets (four along, two high), the rack's eight bays;
// the bridge crane's reach (the bridge along the hangar, the trolley along the bridge) and where it parks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCycle, planFrom, startOf, valueAt, canAt, fillAt, dockedAt, gateAt, loadAt, steadyAt, moveTime, along, SPEED } from '../kit/crane-plan.js';

const Q = Math.PI / 2;
const mounts = [];
// (the mounts' heights: the parked Miner on its longer legs, 12 cm higher than before 2026-11-16: 3.644 and 2.252 then)
for (const [z, out] of [[-7.208, -1], [-2.792, 1]]) for (const y of [3.764, 2.372]) for (const [x, yaw] of [[40.578, Q], [38.142, -Q]]) mounts.push({ at: [x, y, z], yaw, out: [0, out], upper: y > 3 });
const sockets = []; for (const x of [29, 31.5, 34, 36.5]) for (const y of [0.75, 2.2]) sockets.push({ at: [x, y, -18.16], n: [0, 1], upper: y > 1.5 });
const bays = []; for (let j = 0; j < 8; j++) bays.push({ at: [46 + j * 1.15, 0.65, -16.8] });
export const SITE = { carry: 6.28, rail: { y: 8.52, x: [21.1, 56.9], z: [-17.65, 7.65] }, home: [21.5, -5], mounts, sockets, bays, can: { half: 1.088, seat: 0.4, clear: 0.45, rise: 0.9, lift: 0.09 } };
const site = SITE;
const plan = planCycle(site);
const times = []; for (let t = 0; t < plan.length; t += 0.5) times.push(t);

test('a move speeds up, runs steady and slows down, and gets there', () => {
  const [T, k] = moveTime(10, { v: 2, a: 0.8 });
  assert.ok(Math.abs(T - 7.5) < 1e-9 && Math.abs(k - 1 / 3) < 1e-9);
  assert.equal(along(0, k), 0); assert.equal(along(1, k), 1);
  let last = 0; for (let x = 0; x <= 1.0001; x += 0.01) { const p = along(x, k); assert.ok(p >= last - 1e-12, 'never backwards'); last = p; }
  const [T2, k2] = moveTime(0.2, { v: 2, a: 0.8 }); assert.ok(k2 === 0.5 && Math.abs(T2 - 1) < 1e-9, 'a short move never reaches full speed');
});

test('the round: unload, load, clear, then done (it does not start again by itself), a canister a minute or so', () => {
  assert.deepEqual(plan.phases.map((p) => p.name), ['unload', 'load', 'clear', 'done']);
  for (const p of plan.phases.slice(0, 3)) assert.ok(p.t1 > p.t0);
  assert.equal(plan.phases[3].t1, Infinity, 'done is for good');
  assert.ok(plan.length > 600 && plan.length < 2400, 'a round takes ' + plan.length.toFixed(0) + ' s');
  const unload = plan.phases[0]; assert.ok((unload.t1 - unload.t0) / 8 > 30 && (unload.t1 - unload.t0) / 8 < 110);
  // (done: home, the cradle up and open, nothing moving)
  for (const k of ['x', 'z']) assert.ok(Math.abs(plan.T[k].last - plan.T[k].v0) < 1e-9, k + ' comes home');
  assert.ok(Math.abs(plan.T.hoist.last - site.carry) < 1e-9 && plan.T.arms.last === 0 && plan.T.latch.last === 0);
});

test('every moving part moves in order: one move ends before its next begins, where the last one ended', () => {
  for (const tr of Object.values(plan.T).flat()) {
    for (let i = 0; i < tr.segs.length; i++) {
      const s = tr.segs[i]; assert.ok(s.t1 > s.t0);
      if (i) { assert.ok(s.t0 >= tr.segs[i - 1].t1 - 1e-9); assert.ok(Math.abs(s.a - tr.segs[i - 1].b) < 1e-9); }
    }
  }
});

test('three ways at once: the bridge, the trolley and the cradle\'s turn travel together, and set off before the lift is done', () => {
  let together = 0, early = 0;
  for (const s of plan.T.x.segs) {
    const z = plan.T.z.segs.find((q) => Math.abs(q.t0 - s.t0) < 1e-6), y = plan.T.yaw.segs.find((q) => Math.abs(q.t0 - s.t0) < 1e-6);
    if (z) together++;
    if (z && y) together++;
    // (a trip off a place: the lift still going when the bridge sets off)
    const lift = plan.T.hoist.segs.find((q) => q.t0 < s.t0 - 1e-6 && q.t1 > s.t0 + 1e-6 && q.b > q.a);
    if (lift) early++;
  }
  assert.ok(together > 20, together + ' trips with x and y together');
  assert.ok(early >= 16, early + ' trips set off before the lift was done');
  // (the cradle turns a canister itself: a canister off the ship lies along x, into a socket it points at the wall)
  const d = plan.docks[0], yawIn = canAt(plan, d.c, d.t0).yaw;
  assert.ok(Math.abs(Math.sin(yawIn)) < 1e-6, 'end on to the wall');
  assert.ok(Math.abs(Math.cos(mounts[d.c].yaw)) < 1e-6, 'it lay along the ship');
});

test('never two canisters in one place, never two in the cradle, and all sixteen always somewhere', () => {
  for (const t of times) {
    const seen = new Set(); let held = 0;
    plan.cans.forEach((_, c) => { const a = canAt(plan, c, t); if (a.where === 'held') held++; else { const k = a.where + a.i; assert.ok(!seen.has(k), `two canisters at ${k}, t ${t}`); seen.add(k); } });
    assert.ok(held <= 1, 'two held at ' + t);
  }
});

test('upper canisters come off the ship before the ones under them, and go back on after them', () => {
  const offAt = (i) => plan.cans[i].spans.find((s) => s.where === 'held').t0;
  for (let i = 0; i < 8; i++) if (!mounts[i].upper) { const above = mounts.findIndex((m) => m.upper && m.at[0] === mounts[i].at[0] && m.at[2] === mounts[i].at[2]); assert.ok(offAt(above) < offAt(i)); }
  const onAt = (i) => { for (const c of plan.cans) { const s = c.spans.find((q, n) => n > 0 && q.where === 'mount' && q.i === i); if (s) return s.t0; } return null; };
  for (let i = 0; i < 8; i++) if (!mounts[i].upper) { const above = mounts.findIndex((m) => m.upper && m.at[0] === mounts[i].at[0] && m.at[2] === mounts[i].at[2]); assert.ok(onAt(i) < onAt(above)); }
});

test('a lower socket is filled before the one over it, and emptied after it', () => {
  const dock = (k) => plan.docks.find((d) => d.k === k);
  for (let k = 0; k < 8; k++) if (!sockets[k].upper) { const over = sockets.findIndex((s) => s.upper && s.at[0] === sockets[k].at[0]); assert.ok(dock(k).t0 < dock(over).t0); assert.ok(dock(over).t1 < dock(k).t1); }
});

test('it only travels with the load high: off the ground the hook moves sideways only near the top', () => {
  let lastX = valueAt(plan.T.x, 0), lastZ = valueAt(plan.T.z, 0), pushes = 0;
  for (let t = 0; t < plan.length; t += 0.1) {
    const x = valueAt(plan.T.x, t), z = valueAt(plan.T.z, t), h = valueAt(plan.T.hoist, t), moved = Math.hypot(x - lastX, z - lastZ);
    // (low down only the slow push into a collar or out of it, and backing off a docked canister)
    if (moved > 1e-6 && h < site.carry - SPEED.clearOff - 0.05) { pushes++; assert.ok(moved < 0.1 * SPEED.trolley.v + 1e-6, 'a fast sideways move low down at ' + t.toFixed(1)); }
    lastX = x; lastZ = z;
  }
  assert.ok(pushes > 0);
});

test('a canister is only let go of where it is held: on a tray that is out, seated in a collar, on the rack', () => {
  plan.cans.forEach((can, c) => {
    for (let n = 1; n < can.spans.length; n++) {
      const s = can.spans[n], t = s.t0, hook = [valueAt(plan.T.x, t), valueAt(plan.T.hoist, t), valueAt(plan.T.z, t)];
      const near = (p, tol = 1e-3) => assert.ok(Math.hypot(hook[0] - p[0], hook[1] - p[1], hook[2] - p[2]) < tol, `canister ${c} ${s.where}${s.i ?? ''} at ${t.toFixed(1)}: the cradle is ${hook.map((v) => v.toFixed(3))}, the place ${p.map((v) => v.toFixed(3))}`);
      if (s.where === 'mount') { const m = mounts[s.i]; assert.ok(valueAt(plan.T.tray[s.i], t) > 0.999, 'its tray is out'); near([m.at[0] + m.out[0], m.at[1] + site.can.lift, m.at[2] + m.out[1]]); assert.ok(Math.abs(Math.sin(s.yaw - m.yaw)) < 1e-6, 'it lies along its mount'); }
      else if (s.where === 'socket') { const k = sockets[s.i]; near([k.at[0], k.at[1], k.at[2] + site.can.half - site.can.seat]); assert.ok(valueAt(plan.T.iris[s.i], t) > 0.999, 'its iris is open'); assert.ok(Math.abs(Math.sin(s.yaw)) < 1e-6, 'end on'); }
      else if (s.where === 'bay') { near(bays[s.i].at); assert.ok(Math.abs(Math.sin(s.yaw)) < 1e-6, 'along the bay'); }
      else if (s.where === 'held') { assert.ok(valueAt(plan.T.latch, t) > 0.999 && valueAt(plan.T.arms, t) > 0.999, 'latched and arms shut before it is lifted'); }
      // (on a tray or the rack the cradle has let go by then; in a socket the collar takes hold first, and only when its
      // ring is fully lit do the arms open)
      if (s.where === 'mount' || s.where === 'bay') assert.ok(valueAt(plan.T.arms, t) < 0.001 && valueAt(plan.T.latch, t) < 0.001, 'arms open and latch off when it is let go');
      if (s.where === 'socket') { const open = plan.T.arms.segs.find((q) => q.t0 >= t && q.b === 0), lit = plan.T.lit[s.i].segs.find((q) => q.t0 >= t - 1e-9 && q.b === 1); assert.ok(lit && open && open.t0 >= lit.t1 - 1e-9, 'the collar holds it before the arms let go'); }
    }
  });
});

test('a docked canister drains, its ring is lit for as long as it is docked, and the display is its own', () => {
  for (const d of plan.docks) {
    assert.ok(Math.abs(fillAt(plan, d.c, d.t0) - 1) < 1e-9, 'docked full');
    assert.ok(fillAt(plan, d.c, d.t1) === 0, 'drained before it is taken out');
    for (let t = d.t0 + SPEED.clamp + 0.01; t < d.t1; t += 7) { assert.ok(valueAt(plan.T.lit[d.k], t) > 0.999); assert.equal(dockedAt(plan, t)[d.k], d.c); }
    assert.ok(valueAt(plan.T.lit[d.k], d.t1 + SPEED.clamp + 0.01) < 0.001);
  }
  assert.equal(plan.docks.length, 8);
});

test('the patch of floor it works over is watched from before it comes down until it is back up', () => {
  for (const t of times) {
    const low = valueAt(plan.T.hoist, t) < site.carry - 1.5, trayOut = plan.T.tray.some((tr) => valueAt(tr, t) > 0.001);
    if (low || trayOut) { const g = gateAt(plan, t); assert.ok(g, 'nothing watched at ' + t + ' with the cradle or a tray down'); }
  }
  for (const g of plan.gates) assert.ok(g.t1 > g.t0 + 3 && g.hx >= 0.5 && g.hz >= 0.5);
});

test('the load in plain numbers: eight full at the start, none on the ship when unloading is done, eight empties on and the rack full at the end', () => {
  const at = (t) => loadAt(plan, t), P = Object.fromEntries(plan.phases.map((p) => [p.name, p]));
  assert.deepEqual([at(0).onShip, at(0).fullOnShip, at(0).onRack, at(0).docked.length], [8, 8, 8, 0]);
  const a = at(P.load.t0 + 0.1); assert.deepEqual([a.onShip, a.onRack, a.docked.length], [0, 8, 8]);
  const b = at(P.clear.t0 + 0.1); assert.deepEqual([b.onShip, b.fullOnShip, b.onRack, b.docked.length, b.drained], [8, 0, 0, 8, 8]);
  const e = at(plan.length); assert.deepEqual([e.onShip, e.fullOnShip, e.onRack, e.docked.length, e.phase], [8, 0, 8, 0, 'done']);
  for (const t of times) { const L = at(t); assert.equal(L.onShip + L.onRack + L.docked.length + L.carried, 16); for (const d of L.docked) assert.ok(d.percent >= 0 && d.percent <= 100); }
});

test('how long the load stays as it is: a count said to hold for so many seconds does, and one about to change says so', () => {
  const counts = (L) => ({ onShip: L.onShip, fullOnShip: L.fullOnShip, docked: L.docked.length, drained: L.drained, onRack: L.onRack });
  let short = 0, long = 0;
  for (let t = 0; t < plan.length - 61; t += 7.3) {
    const now = counts(loadAt(plan, t)), S = steadyAt(plan, t, 60, 5);
    for (const k in now) {
      assert.ok(S[k] >= 0 && S[k] <= 60 && S[k] % 5 === 0, `${k} at ${t}: ${S[k]}`);
      for (let s = 0; s <= S[k]; s += 1) assert.equal(counts(loadAt(plan, t + s))[k], now[k], `${k} at ${t} + ${s} (said ${S[k]})`);
      if (S[k] < 60) { short++; assert.notEqual(counts(loadAt(plan, t + S[k] + 5))[k], now[k], `${k} at ${t}: said ${S[k]}`); } else long++;
    }
  }
  assert.ok(short > 20 && long > 20, `${short} short, ${long} long`);
  // (done: nothing changes any more)
  assert.equal(steadyAt(plan, plan.length - 1, 20).onShip, 20);
});

test('the next haul starts from what this one left: the rack\'s drained canisters are its empties', () => {
  assert.deepEqual([...plan.next.onMount].sort((a, b) => a - b), [8, 9, 10, 11, 12, 13, 14, 15]);
  assert.deepEqual([...plan.next.inBay].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  let p = plan; for (let n = 0; n < 3; n++) { p = planCycle(site, p.next); assert.ok(Math.abs(p.length - plan.length) < 30, 'every round about the same length'); }
});

test('a haul that came home early: part-full and empty canisters on the ship, each as full as it came home; the round still ends done', () => {
  // (how kit/crane.js starts the round for such a haul: the standard start, the ship's canisters as full as they are)
  for (const fills of [[1, 1, 1, 0.625, 0.5, 0, 0, 0], [0.125, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0.375, 1, 0, 0.75, 0], [0, 0, 0, 0, 1, 1, 1, 1], [1, 1, 1, 1, 0, 0, 0, 0], [0.875, 0.875, 0.875, 0.875, 0.875, 0.875, 0.875, 0.875]]) {
    const S = startOf(site); for (const q of S.cans) if (q.where === 'mount') q.fill = fills[q.i];
    let p; try { p = planFrom(site, S); } catch (e) { assert.fail(`${fills}: ${e.message}`); }
    fills.forEach((f, i) => { const a = canAt(p, i, 0); assert.deepEqual([a.where, a.i], ['mount', i]); assert.equal(fillAt(p, i, 0), f); });
    const L0 = loadAt(p, 0); assert.equal(L0.onShip, 8); assert.equal(L0.fullOnShip, fills.filter((f) => f > 0.5).length); assert.equal(L0.onRack, 8); assert.equal(L0.docked.length, 0);
    // every canister with metal in it goes to the wall and drains from where its level is, in that part of the time
    fills.forEach((f, i) => {
      if (!f) return;
      const dock = p.docks.find((d) => d.c === i), drain = p.cans[i].fill[p.cans[i].fill.length - 1];
      assert.ok(dock, `${fills}: canister ${i} never docked`); assert.equal(drain.a, f); assert.equal(drain.b, 0); assert.ok(Math.abs((drain.t1 - drain.t0) - f * SPEED.drain) < 1e-6);
    });
    // never two canisters in one place on the way
    for (let t = 0; t < p.length; t += 2) { const seen = new Set(); p.cans.forEach((_, c) => { const a = canAt(p, c, t); if (a.where === 'held') return; const k = a.where + a.i; assert.ok(!seen.has(k), `${fills}: two canisters at ${k}, t ${t}`); seen.add(k); }); }
    // the end: the wall clear, eight empties on the ship and eight on the rack, no metal left in any of them
    const L = loadAt(p, p.length);
    assert.equal(L.phase, 'done'); assert.equal(L.docked.length, 0); assert.equal(L.onShip, 8); assert.equal(L.fullOnShip, 0); assert.equal(L.onRack, 8);
    p.cans.forEach((_, c) => assert.equal(fillAt(p, c, p.length), 0, `${fills}: canister ${c}`));
    assert.ok(p.next.onMount.every((c) => c >= 0) && p.next.inBay.every((c) => c >= 0), 'and the next haul starts from there');
  }
});

test('the round taken up from any arrangement of the sixteen canisters ends done, everything in its place', () => {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let n = 0; n < 150; n++) {
    const S = startOf(site);
    // (the sixteen canisters dealt out among the mounts, sockets and bays, some full, a lower mount or socket only
    // under a filled upper one if at all)
    const places = [...mounts.map((m, i) => ['mount', i]), ...sockets.map((s, k) => ['socket', k]), ...bays.map((b, j) => ['bay', j])];
    for (let i = places.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [places[i], places[j]] = [places[j], places[i]]; }
    S.cans.forEach((q, c) => { const [where, i] = places[c]; q.where = where; q.i = i; q.fill = rnd() < 0.4 ? 1 : rnd() < 0.5 ? rnd() : 0; q.yaw = where === 'mount' ? mounts[i].yaw : 0; if (where === 'socket') S.lit[i] = 1, S.iris[i] = 1; });
    let p;
    try { p = planFrom(site, S); } catch (e) { assert.fail('arrangement ' + n + ': ' + e.message); }
    const L = loadAt(p, p.length);
    assert.equal(L.phase, 'done'); assert.equal(L.docked.length, 0, 'the wall clear at ' + n); assert.equal(L.fullOnShip, 0, 'no ore left on the ship at ' + n);
  }
});
