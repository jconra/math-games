// THE LANDING GEAR'S LOOK (the game's maker, 2026-11-26: "The ship would look a lot better if none of this was here and
// you could just see the landing gear. We should just have doors that slide in place. Its fine if the landing gear is
// kind of magic and folds into itself"; "I don't see front landing gear on the miner ship"): kit/ships/gear-plan.js,
// the hull data's wells and doors (kit/ships/*-built.hull.js, made by ~/pw/space-math/rigs/gear-2/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGS, LEG, FEET, DOOR, legPlan, doorSlide, gearOrder } from '../kit/ships/gear-plan.js';
import * as EXPLORER from '../kit/ships/explorer-built.hull.js';
import * as MINER from '../kit/ships/miner-built.hull.js';
import * as MEDIC from '../kit/ships/medic-built.hull.js';

const HULLS = { explorer: EXPLORER, miner: MINER }, eps = 1e-9;
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('every ship stands on legs fore and aft, and on both sides aft', () => {
  for (const [ship, feet] of Object.entries(FEET)) {
    assert.ok(feet.some(([, z]) => z > 2), ship + ': a leg well forward of its middle');
    assert.ok(feet.some(([x, z]) => z < -2 && x > 0.5) && feet.some(([x, z]) => z < -2 && x < -0.5), ship + ': a leg aft on each side');
  }
  // (the Medic's and the Hauler's feet as their own data has them)
  for (const [name, W] of Object.entries(MEDIC.WELLS)) {
    const x = (W.x[0] + W.x[1]) / 2, z = (W.z[0] + W.z[1]) / 2;
    for (const s of [1, -1]) assert.ok(FEET.medic.some(([fx, fz]) => Math.abs(fx - s * x) < 0.05 && Math.abs(fz - z) < 0.05), 'the Medic\'s ' + name + ' legs');
  }
  const at = JSON.parse(read('kit/ships/hauler-built.js').match(/export const GEAR = \{ speed: [\d.]+, at: (\{[^}]*\}) \}/)[1].replace(/'/g, '"'));
  for (const [x, z] of Object.values(at)) assert.ok(FEET.hauler.some(([fx, fz]) => fx === x && fz === z), 'the Hauler\'s leg at ' + x + ', ' + z);
});

test('the gear\'s coverings are gone: no gear pods, every leg in a well of its own cut in the hull', () => {
  for (const [ship, H] of Object.entries(HULLS)) {
    for (const [which, L] of Object.entries(LEGS[ship].legs)) {
      const W = H.WELLS[which], D = H.DOORS[which];
      assert.ok(W && !W.bay && W.rim.length > 0, `${ship} ${which}: a well with its rim`);
      assert.ok(D && D.length === 2 && D.every((h) => h.polys.length > 0), `${ship} ${which}: two doors cut from the skin`);
      const [mn, mx] = W.box;
      // (its well round where it joins the hull, up to its top)
      assert.ok(Math.abs((mn[0] + mx[0]) / 2 - L.at[0]) < 1e-3 && Math.abs((mn[2] + mx[2]) / 2 - L.at[1]) < 1e-3 && Math.abs(mx[1] - L.top - 0.02) < 1e-3, `${ship} ${which}: the well round the leg`);
    }
    assert.deepEqual(Object.keys(H.WELLS).sort(), Object.keys(LEGS[ship].legs).sort(), ship + ': a well for each leg and no other');
  }
  // the old pods' code is gone from the shared kit
  assert.doesNotMatch(read('kit/ships/built-common.js'), /export function bayPod|export function bayDoors/);
});

test('each leg: splayed out to a wider stance, its braces meeting it at angles over the foot; up, folded into itself inside its well', () => {
  for (const [ship, S] of Object.entries(LEGS)) for (const [which, L] of Object.entries(S.legs)) {
    const G = legPlan(L, S.floor), name = `${ship} ${which}`, W = HULLS[ship].WELLS[which], [mn, mx] = W.box;
    assert.ok(G.n >= 2 && G.n <= 3, `${name}: ${G.n} parts to its strut (a cylinder and a piston, a stage between if need be)`);
    // down: its foot on the floor, out from under its hip (or under it, for a leg on the middle line)
    assert.ok(Math.abs(G.foot[1] - S.floor) < eps, name + ': its foot on the floor');
    assert.ok(Math.abs(G.foot[0]) >= Math.abs(G.hip[0]) + (L.splay || 0) - 1e-9, name + ': its foot further out than its hip');
    assert.ok(G.tubes[0].r > G.tubes[G.n - 1].r * 1.5, name + ': a fat cylinder, a slimmer piston');
    assert.ok(G.braces.length >= 2, name + ': two or three braces');
    for (const B of G.braces) {
      const d = B.fit.map((v, i) => v - B.anchor[i]), a = G.dir, ang = Math.acos(Math.abs(d[0] * a[0] + d[1] * a[1] + d[2] * a[2]) / Math.hypot(...d)) * 180 / Math.PI;
      assert.ok(ang > 5, `${name}: its ${B.name} brace comes in at an angle to the leg (${ang.toFixed(0)} degrees)`);
      assert.ok(B.sleeve.length + B.rod.length >= B.dDown + 0.015 && B.sleeve.length <= B.dUp + 1e-9 && B.rod.length <= B.dUp + 1e-9, `${name}: its ${B.name} brace's rod stays in its sleeve, down and up`);
    }
    for (let k = 1; k < G.n; k++) assert.ok(G.tubes[k].u1 - G.tubes[k - 1].u0 >= LEG.overlap - 1e-6, `${name}: part ${k} stays in the one over it`);
    // up: every part of it (its cylinder and piston, round their ends; the braces; the pad's corners) inside its well,
    // the foot over the shut door
    const inWell = (p, what) => assert.ok(p[0] > mn[0] - 1e-6 && p[0] < mx[0] + 1e-6 && p[2] > mn[2] - 1e-6 && p[2] < mx[2] + 1e-6 && p[1] > L.belly + 0.05 && p[1] < mx[1] + 1e-6, `${name}: ${what} inside the well, up (${p.map((v) => v.toFixed(3))})`);
    const ac = [-G.dir[1], G.dir[0], 0];   // (across the leg, square to it)
    G.tubes.forEach((T, k) => { for (const u of [T.u0, T.u1]) for (const o of [ac.map((v) => v * T.r), ac.map((v) => -v * T.r), [0, 0, T.r], [0, 0, -T.r]]) inWell(G.up(G.at(u).map((v, i) => v + o[i]), T.rise), `part ${k}`); });
    for (const B of G.braces) for (const p of [B.up.anchor, B.up.fit]) inWell(p, `its ${B.name} brace`);
    for (const sx of [1, -1]) for (const sz of [1, -1]) inWell(G.up([G.foot[0] + sx * L.pad[0] / 2, S.floor, G.foot[2] + sz * L.pad[1] / 2], G.footRise), 'its pad');
    assert.ok(Math.abs(G.up(G.at(G.tubes[0].u1), G.tubes[0].rise)[1] - L.top) < 1e-6, name + ': the cylinder\'s top at the well\'s top, up');
  }
});

test('the doors slide apart, clear of the well\'s mouth and into the hull, and come back flush', () => {
  for (const [ship, H] of Object.entries(HULLS)) for (const [which, halves] of Object.entries(H.DOORS)) {
    const box = H.WELLS[which].box;
    halves.forEach((h, i) => {
      const S = doorSlide(h), k = h.axis, half = h.polys.flat().map((p) => p[k]), name = `${ship} ${which} door ${i}`;
      assert.equal(h.len.toFixed(3), (box[1][k] - box[0][k]).toFixed(3), name + ': its length the well\'s');
      // (slid open, every point of it is past the mouth's edge on its own side)
      const moved = half.map((v) => v + S[k]);
      const dir = h.one || h.dir;
      assert.ok(dir > 0 ? Math.min(...moved) >= box[1][k] - 1e-6 : Math.max(...moved) <= box[0][k] + 1e-6, name + ': clear of the mouth');
      // (and into the hull: the slide's part across the line points against the skin's outward normal)
      const across = S.map((v, j) => (j === k ? 0 : v)), into = -(across[0] * h.n[0] + across[1] * h.n[1] + across[2] * h.n[2]);
      assert.ok(into > 0.5 * (h.sink ?? DOOR.sink), name + ': it sinks into the hull as it goes');
    });
  }
});

test('in turn: up the legs fold first, then the doors shut; down the doors open first, then the legs come down', () => {
  const legs = [{ t: 0 }, { t: 0 }], doors = [{ t: 0 }, { t: 0 }], log = [];
  const move = (list, mode) => { let m = false; for (const D of list) { const t = mode === 'open' ? Math.min(1, D.t + 0.25) : Math.max(0, D.t - 0.25); if (t !== D.t) { D.t = t; m = true; } } if (m) log.push(list === legs ? 'legs' : 'doors'); return m; };
  while (gearOrder(legs, doors, true, move));
  assert.deepEqual(log, ['legs', 'legs', 'legs', 'legs', 'doors', 'doors', 'doors', 'doors'], 'up: the legs all the way, then the doors');
  assert.ok(legs.every((D) => D.t === 1) && doors.every((D) => D.t === 1));
  log.length = 0;
  while (gearOrder(legs, doors, false, move));
  assert.deepEqual(log, ['doors', 'doors', 'doors', 'doors', 'legs', 'legs', 'legs', 'legs'], 'down: the doors all the way open, then the legs');
});
