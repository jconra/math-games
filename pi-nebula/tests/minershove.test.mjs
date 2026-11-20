// THE MINER, SHOVED (the game's maker, 2026-11-20, SHIP2-2 B: "Shove it like the other two, with its canisters riding
// on it. The crane takes them off wherever it ends up, the same as when you land crooked."). The Explorer or the Medic
// flown into the Miner's hangar shoves it as it shoves the other two, about the floor its crane can unload it on
// (src/fleet.js othersOf `keep`, src/flymodel.js); while the crane's grab is down at it the crane has hold of it
// (src/flymodel.js grabbed); and the crane's round, taken up where it ends up (src/crane.js shove: kit/crane-plan.js
// moveMounts and planFrom, as for a ship set down crooked), takes every canister off it there and loads it there. No
// browser: plain numbers. (What the page does with them, the drawing, the canisters riding, the waiting: the rigs,
// ~/pw/space-math/SHIP_3.md.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/fleet.js';
import * as M from '../src/flymodel.js';
import { stationSolid, SKIN } from '../src/flysolid.js';
import { HANGARS, DOOR } from '../kit/outside-plan.js';
import { standElements, yawOf } from '../src/standing.js';
import { planCycle, planFrom, stateAt, cleanAt, valueAt, canAt, moveMounts } from '../kit/crane-plan.js';

const DT = 1 / 60, MZ = HANGARS[0].z;
// what a flown ship bumps into, and the ships parked in the other hangars as it meets them
function solidOf(cfg) { const s = stationSolid({ bay: cfg.bay, bays: cfg.others.map((o) => o.bay) }), L = cfg.others.map(M.makeOther); return { ...s, push: (S) => M.pushOthers(S, L), others: L }; }
// the Miner's corners where it stands, [x, z] (its one box, turned as three.js turns: x' = c x + s z, z' = -s x + c z)
function corners(O) {
  const c = Math.cos(O.yaw), s = Math.sin(O.yaw), out = [];
  for (const b of O.boxes) for (const lx of [b.x0, b.x1]) for (const lz of [-b.r, b.r]) out.push([O.p[0] + c * lx + s * lz, O.p[1] - s * lx + c * lz]);
  return out;
}
// the Miner stood somewhere already (shoved there before), as the crane would have it: [x, z] of its pad's middle, turned
const standAt = (O, at, yaw) => M.otherAt(O, standElements({ p: [at[0], 0, at[1]], q: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] }, O.cfg.at));
// a flown ship held on `keys` for `secs`, the parked ships sliding as they are shoved: what the Miner did meanwhile
function ram(S, solid, keys, secs) {
  const O = solid.others.find((o) => o.cfg.id === 'miner'), K = O.cfg.keep, C = M.controlsOf(new Set(keys));
  let fastest = 0, out = 0, deepest = 0;
  for (let t = 0; t < secs; t += DT) {
    M.stepShip(S, C, DT, solid); for (const o of solid.others) M.stepOther(o, DT);
    fastest = Math.max(fastest, Math.hypot(O.v[0], O.v[1]));
    for (const [x, z] of corners(O)) out = Math.max(out, K.x0 - x, x - K.x1, K.z0 - z, z - K.z1);
    // (how deep any point of the flown ship is into the Miner)
    for (const p of M.pointsOf(S)) for (let k = 0; k <= 0.5; k += 0.05) if (M.insideOther(O, p, -k)) deepest = Math.max(deepest, k);
  }
  return { O, fastest, out, deepest };
}

test('the Miner, as the other ships meet it: as heavy as the other two, and it slides only about its own floor', () => {
  for (const id of ['explorer', 'medic']) {
    const L = F.flightOf(id).others, miner = L.find((o) => o.id === 'miner'), other = L.find((o) => o.id !== 'miner');
    assert.equal(miner.mass, 2); assert.equal(miner.gyr, 4);
    assert.equal(miner.mass, other.mass, id + ': the Miner shoved like the other one'); assert.equal(miner.gyr, other.gyr);
    // (its floor: where the crane can get at every canister of it, any way round: src/flymodel.js MINER.floor)
    assert.deepEqual(miner.keep, { x0: M.MINER.floor.x[0], x1: M.MINER.floor.x[1], z0: M.MINER.floor.z[0], z1: M.MINER.floor.z[1] }, id + ': the Miner kept on its floor');
    assert.equal(other.keep, undefined, id + ': the other one kept in its bay, as before');
  }
  // (the Miner, flown, meets the other two as it always did: no keep, no change)
  for (const o of M.OTHERS) assert.equal(o.keep, undefined);
  // (its floor, from the hangar's things: the rack's front at z = -15.7 less a tray's 0.8 m; the cart from z = 5.0 less a
  // carried canister's 0.5 m past the ship's side; the rails' ends at x = 56.9)
  const K = F.flightOf('explorer').others.find((o) => o.id === 'miner').keep;
  assert.ok(K.z0 >= -15.7 + 0.8 - 1e-9 && K.z1 <= 5.0 - 0.5 + 1e-9 && K.x1 <= 56.9 + 1e-9 && K.x1 < DOOR.x, 'kept off the rack, the cart and the door');
});

test('rammed nose first, slow and fast, by the Explorer and by the Medic: shoved back, it slows and stops by itself, on its floor', () => {
  for (const id of ['explorer', 'medic']) {
    const cfg = F.flightOf(id), went = {};
    for (const how of ['slow', 'fast']) {
      const solid = solidOf(cfg), S = M.makeShip(cfg);
      // (slow: from just short of its nose, a short push; fast: from outside the door, flat out)
      if (how === 'slow') M.place(S, [42.3 + 6.8 + SKIN + 9.6, 1.6, MZ], M.facing([-1, 0, 0]));
      else M.place(S, [DOOR.x + 25, 1.6, MZ], M.facing([-1, 0, 0]));
      const r = ram(S, solid, ['forward'], how === 'slow' ? 1.0 : 3.5), r2 = ram(S, solid, [], 6), O = r.O;
      went[how] = O.cfg.at[0] - O.p[0];
      assert.ok(O.moved && O.hits > 0 && went[how] > 0.1, `${id}, ${how}: it is shoved back (${went[how].toFixed(2)} m)`);
      assert.ok(M.otherStill(O), `${id}, ${how}: and has stopped by itself`);
      assert.ok(Math.max(r.fastest, r2.fastest) <= M.SHOVE.most + 1e-9, `${id}, ${how}: never faster than a shoved ship goes`);
      assert.ok(Math.max(r.out, r2.out) < 1e-6, `${id}, ${how}: every corner of it always on its floor (${Math.max(r.out, r2.out).toFixed(3)})`);
      assert.ok(Math.max(r.deepest, r2.deepest) <= 0.1 + 1e-9, `${id}, ${how}: the ${id} never into it (deepest ${Math.max(r.deepest, r2.deepest).toFixed(2)} m)`);
    }
    assert.ok(went.fast > went.slow + 1, `${id}: rammed fast it goes further (${went.slow.toFixed(1)} and ${went.fast.toFixed(1)} m)`);
  }
});

test('rammed in the side and from behind (stood across its hangar, or tail to the door, by earlier shoves): shoved, on its floor', () => {
  // (stood near the door's side of its floor: the Medic gets only its nose about 4 m in past another hangar's door, its
  // tail fin too tall for the 8.4 m that a ship flown into another hangar feels over it)
  for (const id of ['explorer', 'medic']) {
    const cfg = F.flightOf(id);
    for (const [what, yaw, at] of [['the side', Math.PI / 2, [50, -5.5]], ['behind', Math.PI, [47, MZ]], ['the side, at an angle', 0.6, [45, -6]]]) {
      const solid = solidOf(cfg), O0 = solid.others.find((o) => o.cfg.id === 'miner'); standAt(O0, at, yaw);
      assert.ok(corners(O0).every(([x, z]) => x >= O0.cfg.keep.x0 && x <= O0.cfg.keep.x1 && z >= O0.cfg.keep.z0 && z <= O0.cfg.keep.z1), what + ': (stood on its floor)');
      const p0 = [...O0.p], y0 = O0.yaw, S = M.makeShip(cfg); M.place(S, [DOOR.x + 20, 1.6, at[1] + 1.5], M.facing([-1, 0, 0]));
      const r = ram(S, solid, ['forward'], 4), r2 = ram(S, solid, [], 6), O = r.O;
      const moved = Math.hypot(O.p[0] - p0[0], O.p[1] - p0[1]), turned = Math.abs(O.yaw - y0) * 180 / Math.PI;
      assert.ok(O.hits > 0 && (moved > 0.3 || turned > 2), `${id}, ${what}: shoved (${moved.toFixed(2)} m, turned ${turned.toFixed(1)} degrees)`);
      assert.ok(M.otherStill(O), `${id}, ${what}: and still again`);
      assert.ok(Math.max(r.out, r2.out) < 1e-6, `${id}, ${what}: always on its floor`);
      assert.ok(Math.max(r.deepest, r2.deepest) <= 0.1 + 1e-9, `${id}, ${what}: the ${id} never into it (deepest ${Math.max(r.deepest, r2.deepest).toFixed(2)} m)`);
    }
  }
});

test('held while its crane has hold of it: a wall then, and shoved again once let go', () => {
  const cfg = F.flightOf('medic'), solid = solidOf(cfg), O = solid.others.find((o) => o.cfg.id === 'miner'), S = M.makeShip(cfg);
  M.place(S, [DOOR.x + 20, 1.4, MZ], M.facing([-1, 0, 0]));
  O.held = true; ram(S, solid, ['forward'], 4);
  assert.ok(O.hits > 0 && !O.moved && O.p[0] === O.cfg.at[0] && O.yaw === 0, 'held: rammed, it does not move');
  O.held = false; ram(S, solid, ['forward'], 2); ram(S, solid, [], 5);
  assert.ok(O.moved && O.p[0] < O.cfg.at[0] - 0.1, 'let go: the next push shoves it');
  // (and held while it slides, it stops there)
  const solid2 = solidOf(cfg), O2 = solid2.others.find((o) => o.cfg.id === 'miner'), S2 = M.makeShip(cfg); M.place(S2, [DOOR.x + 25, 1.4, MZ], M.facing([-1, 0, 0]));
  ram(S2, solid2, ['forward'], 3.5); assert.ok(!M.otherStill(O2), '(sliding)'); O2.held = true; M.stepOther(O2, DT); assert.ok(M.otherStill(O2), 'held as it slides: it stops');
});

// THE CRANE'S PLACES (the Miner hangar's, typed in as the game finds them: tests/crane.test.mjs, tests/flying.test.mjs)
function craneSite() {
  const Q = Math.PI / 2, mounts = [], sockets = [], bays = [];
  for (const [z, out] of [[-7.208, -1], [-2.792, 1]]) for (const y of [3.764, 2.372]) for (const [x, yaw] of [[40.578, Q], [38.142, -Q]]) mounts.push({ at: [x, y, z], yaw, out: [0, out], upper: y > 3 });
  for (const x of [29, 31.5, 34, 36.5]) for (const y of [0.75, 2.2]) sockets.push({ at: [x, y, -18.16], n: [0, 1], upper: y > 1.5 });
  for (let j = 0; j < 8; j++) bays.push({ at: [46 + j * 1.15, 0.65, -16.8] });
  return { carry: 6.28, rail: { y: 8.52, x: [21.1, 56.9], z: [-17.65, 7.65] }, home: [21.5, -5], mounts, sockets, bays, can: { half: 1.088, seat: 0.4, clear: 0.45, rise: 0.9, lift: 0.09 } };
}
const minerOther = () => M.makeOther(F.flightOf('explorer').others.find((o) => o.id === 'miner'));
const grabOf = (P, site, t) => ({ x: valueAt(P.T.x, t), z: valueAt(P.T.z, t), h: valueAt(P.T.hoist, t), carry: site.carry });
// the round's next moment, from t, with nothing half done and the grab up at carrying height (src/crane.js takeUp)
function nextUp(P, site, t) { for (let u = t; u <= P.length + 1e-9; u += 1 / 60) if (cleanAt(P, u, 0) != null && valueAt(P.T.hoist, u) >= site.carry - M.SHOVE.grab.down) return u; return P.length; }
// the moments a canister comes off a mount or onto one: [t, mount]
const atShip = (P) => P.cans.flatMap((can) => can.spans.flatMap((q, k) => (k && q.where === 'held' && can.spans[k - 1].where === 'mount' ? [[q.t0, can.spans[k - 1].i]] : q.where === 'mount' && k ? [[q.t0, q.i]] : [])));

test('the crane has hold of it exactly while its grab is down at it, parked or stood anywhere on its floor', () => {
  for (const [what, at, yaw] of [['parked', null, 0], ['shoved back and turned', [33, -6.5], 0.5], ['stood across its hangar', [41, -5], -Math.PI / 2]]) {
    const site = craneSite(), O = minerOther();
    if (at) { standAt(O, at, yaw); site.mounts = moveMounts(site.mounts, M.otherElements(O)); }
    const P = planCycle(site), n = { all: 0, held: 0 };
    // (every canister off the ship and onto it: held then)
    const moments = atShip(P); assert.equal(moments.length, 16, what + ': eight off and eight on');
    for (const [t, i] of moments) assert.ok(M.grabbed(O, grabOf(P, site, t)), `${what}: held as a canister comes off or onto mount ${i} (${t.toFixed(0)} s)`);
    for (let t = 0; t < P.length; t += 0.25) {
      const g = grabOf(P, site, t), held = M.grabbed(O, g); n.all++; if (held) n.held++;
      // (at the wall, at the rack, carrying, at home: never)
      if (g.h >= site.carry - M.SHOVE.grab.down || g.z < -15.5) assert.ok(!held, `${what}: not held at ${t.toFixed(1)} s (the grab at ${g.x.toFixed(1)}, ${g.z.toFixed(1)}, ${g.h.toFixed(2)} m up)`);
    }
    assert.ok(n.held / n.all > 0.05 && n.held / n.all < 0.25, `${what}: held ${(100 * n.held / n.all).toFixed(1)}% of the round`);
  }
});

test('shoved at any moment it can be, the round goes on from where it ends up: soon, never down at its old places, and every canister off it and onto it there', () => {
  const site0 = craneSite(), parked = site0.mounts.map((m) => ({ ...m, at: [...m.at], out: [...m.out] })), P = planCycle(site0), O = minerOther();
  // (where it ends up: back along its floor, turned; across it; nose to the door's side of its floor and turned the other way)
  const ends = [[[34, -6], 0.35], [[44, -2.5], -0.25], [[47, -8], Math.PI]];
  let tried = 0, longest = 0;
  for (let t = 0, k = 0; t < P.length; t += 6.7, k++) {
    if (M.grabbed(O, grabOf(P, site0, t))) continue;      // (held: it cannot be shoved now)
    const u = nextUp(P, site0, t);
    longest = Math.max(longest, u - t);
    // (the round running on to that moment never comes down at the ship's old places)
    for (let w = t; w < u; w += 1 / 30) assert.ok(!M.grabbed(O, grabOf(P, site0, w)), `shoved at ${t.toFixed(1)} s: nothing comes down at the ship before ${u.toFixed(1)} s`);
    // the round taken up there, as src/crane.js does it (kit/crane.js restand: the mounts where it stands, the canisters
    // on it turned with it)
    const [at, yaw] = ends[k % ends.length], Q = minerOther(); standAt(Q, at, yaw);
    const e = M.otherElements(Q), site = { ...site0, mounts: moveMounts(parked, e) }, S = stateAt(P, u);
    for (const q of S.cans) if (q.where === 'mount') q.yaw += yawOf(e);
    const P2 = planFrom(site, S);
    tried++;
    // (no jump: the crane goes on from where it was)
    for (const k2 of ['x', 'z', 'hoist', 'yaw']) assert.ok(Math.abs(valueAt(P2.T[k2], 0) - S[k2 === 'hoist' ? 'hoist' : k2]) < 1e-9, `taken up at ${u.toFixed(1)} s: ${k2} goes on from where it was`);
    // every canister it takes off the ship, or puts on it, at a mount where the ship now stands: the cradle on the tray
    for (const [t2, i] of atShip(P2)) {
      const m = site.mounts[i], hook = [valueAt(P2.T.x, t2), valueAt(P2.T.z, t2)];
      assert.ok(Math.hypot(hook[0] - m.at[0] - m.out[0], hook[1] - m.at[2] - m.out[1]) < 1e-6, `taken up at ${u.toFixed(1)} s: at mount ${i} where it now stands`);
      assert.ok(M.grabbed(Q, grabOf(P2, site, t2)), 'and held there');
    }
    // done there: eight empties on it, the rack's eight filled with the drained ones, every tray home, the crane home
    const end = P2.cans.map((_, c) => canAt(P2, c, P2.length));
    assert.equal(end.filter((q) => q.where === 'mount').length, 8, `taken up at ${u.toFixed(1)} s: eight on the ship at the end`);
    assert.equal(end.filter((q) => q.where === 'bay').length, 8);
    assert.ok(P2.T.tray.every((tr) => Math.abs(valueAt(tr, P2.length)) < 1e-9), `taken up at ${u.toFixed(1)} s: every tray home at the end`);
    for (let t2 = 0; t2 < P2.length; t2 += 1) { const x = valueAt(P2.T.x, t2), z = valueAt(P2.T.z, t2); assert.ok(x >= site.rail.x[0] - 1e-9 && x <= site.rail.x[1] + 1e-9 && z >= site.rail.z[0] - 1e-9 && z <= site.rail.z[1] + 1e-9, 'always within the crane\'s reach'); }
  }
  assert.ok(tried > 150, tried + ' moments tried');
  assert.ok(longest < 30, `the round gets to a moment it can be taken up at within ${longest.toFixed(1)} s (the crane finishing a trip at the wall or the rack)`);
});

test('a ship stood somewhere, taken back as it stands, and put back', () => {
  const O = minerOther(); standAt(O, [33.5, -7.25], 0.7);
  const e = M.otherElements(O), O2 = M.otherAt(minerOther(), e);
  assert.ok(Math.abs(O2.p[0] - 33.5) < 1e-9 && Math.abs(O2.p[1] + 7.25) < 1e-9 && Math.abs(O2.yaw - 0.7) < 1e-12 && O2.moved && M.otherStill(O2));
  M.otherElements(O2).forEach((v, i) => assert.ok(Math.abs(v - e[i]) < 1e-9));
  M.otherAt(O2, null); assert.ok(!O2.moved && O2.p[0] === O2.cfg.at[0] && O2.p[1] === O2.cfg.at[2] && O2.yaw === 0 && M.otherElements(O2) === null);
});
