// THE LANDING GEAR'S LOOK (the game's maker, 2026-11-26: "The ship would look a lot better if none of this was here and
// you could just see the landing gear. We should just have doors that slide in place. Its fine if the landing gear is
// kind of magic and folds into itself"; "I don't see front landing gear on the miner ship"): kit/ships/gear-plan.js,
// the hull data's wells and doors (kit/ships/*-built.hull.js, made by ~/pw/space-math/rigs/gear-2/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGS, LEG, FEET, DOOR, telescope, doorSlide, gearOrder } from '../kit/ships/gear-plan.js';
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
      // (its foot and its top tube go up into the well's mouth, and the top tube's top is in the well)
      assert.ok(L.at[0] - L.pad[0] / 2 > mn[0] - eps && L.at[0] + L.pad[0] / 2 < mx[0] + eps, `${ship} ${which}: the foot fits the well across`);
      assert.ok(L.at[1] - L.pad[1] / 2 > mn[2] - eps && L.at[1] + L.pad[1] / 2 < mx[2] + eps, `${ship} ${which}: the foot fits the well along the ship`);
      assert.ok(L.top <= mx[1] + eps && L.r * 2 < Math.min(mx[0] - mn[0], mx[2] - mn[2]), `${ship} ${which}: the top tube in the well`);
    }
    assert.deepEqual(Object.keys(H.WELLS).sort(), Object.keys(LEGS[ship].legs).sort(), ship + ': a well for each leg and no other');
  }
  // the old pods' code is gone from the shared kit
  assert.doesNotMatch(read('kit/ships/built-common.js'), /export function bayPod|export function bayDoors/);
});

test('each leg folds into itself: down its foot is on the floor, up every tube is inside the top one and the foot over the shut door', () => {
  for (const [ship, S] of Object.entries(LEGS)) for (const [which, L] of Object.entries(S.legs)) {
    const T = telescope({ top: L.top, belly: L.belly, floor: S.floor }), name = `${ship} ${which}`;
    assert.ok(T.n >= 2 && T.n <= 3, `${name}: ${T.n} tubes (few, so the leg looks like a leg)`);
    // down
    assert.ok(Math.abs(T.foot.y0 - S.floor) < eps, name + ': its foot on the floor');
    assert.ok(Math.abs(T.tubes[T.n - 1].y0 - T.foot.y1) < 1e-6, name + ': its last tube stands in its foot');
    for (let k = 1; k < T.n; k++) assert.ok(T.tubes[k - 1].y0 - T.tubes[k].y1 <= -LEG.overlap + 1e-6, `${name}: tube ${k} overlaps the one over it`);
    assert.equal(T.tubes[0].rise, 0, name + ': the top tube never moves');
    // up: each tube moved by its rise lies within the top tube's span; the foot just over the belly
    for (const tb of T.tubes) assert.ok(tb.y0 + tb.rise > T.tubes[0].y0 - 1e-6 && tb.y1 + tb.rise < L.top + 1e-6, name + ': a tube inside the top one, up');
    assert.ok(Math.abs(T.foot.y0 + T.foot.rise - (L.belly + LEG.clear)) < 1e-6, name + ': the stowed foot just over the shut door');
    assert.ok(T.foot.y1 + T.foot.rise <= T.tubes[0].y0 + 1e-6, name + ': the stowed foot under the tubes');
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
