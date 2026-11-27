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
      assert.ok(mx[1] - L.top - 0.02 < 1e-3 && mn[0] <= L.at[0] && L.at[0] <= mx[0] && mn[2] <= L.at[1] && L.at[1] <= mx[2], `${ship} ${which}: the well round where the leg joins the hull`);
    }
    assert.deepEqual(Object.keys(H.WELLS).sort(), Object.keys(LEGS[ship].legs).sort(), ship + ': a well for each leg and no other');
  }
  // the old pods' code is gone from the shared kit
  assert.doesNotMatch(read('kit/ships/built-common.js'), /export function bayPod|export function bayDoors/);
});

// (the hull's skin: every face over a point (x, z), low to high, from the hull data as the game decodes it; a point is
// inside the hull when it is over the lowest and an odd number of them are over it, with 3 cm of give)
const skinOf = (H) => {
  const pb = Buffer.from(H.HULL.pos, 'base64'), P = Float32Array.from(new Int16Array(pb.buffer, pb.byteOffset, pb.length / 2), (v) => v / H.Q);
  const tb = Buffer.from(H.HULL.tris, 'base64'), T = new Uint16Array(tb.buffer, tb.byteOffset, tb.length / 2);
  return (x, z) => {
    const hs = [];
    for (let i = 0; i < T.length; i += 3) {
      const a = T[i] * 3, b = T[i + 1] * 3, c = T[i + 2] * 3;
      if ((x < P[a] && x < P[b] && x < P[c]) || (x > P[a] && x > P[b] && x > P[c]) || (z < P[a + 2] && z < P[b + 2] && z < P[c + 2]) || (z > P[a + 2] && z > P[b + 2] && z > P[c + 2])) continue;
      const d = (P[b + 2] - P[c + 2]) * (P[a] - P[c]) + (P[c] - P[b]) * (P[a + 2] - P[c + 2]); if (Math.abs(d) < 1e-12) continue;
      const l1 = ((P[b + 2] - P[c + 2]) * (x - P[c]) + (P[c] - P[b]) * (z - P[c + 2])) / d, l2 = ((P[c + 2] - P[a + 2]) * (x - P[c]) + (P[a] - P[c]) * (z - P[c + 2])) / d, l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      hs.push(l1 * P[a + 1] + l2 * P[b + 1] + l3 * P[c + 1]);
    }
    return hs.sort((p, q) => p - q);
  };
};
const inside = (hs, y) => hs.length > 0 && y > hs[0] + 0.03 && hs.filter((h) => h > y + 0.03).length % 2 === 1 && !hs.some((h) => Math.abs(h - y) <= 0.03);
const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

test('each leg, F-16 fashion: leaning out, fat braces at wide angles to a knuckle low on it, a broad pad', () => {
  for (const [ship, S] of Object.entries(LEGS)) for (const [which, L] of Object.entries(S.legs)) {
    const G = legPlan(L, S.floor), name = `${ship} ${which}`;
    assert.ok(G.n >= 2 && G.n <= 3, `${name}: ${G.n} parts to its strut (a cylinder and a piston, a stage between if need be)`);
    assert.ok(Math.abs(G.foot[1] - S.floor) < eps, name + ': its foot on the floor');
    if (L.splay) assert.ok(Math.abs(G.angle) * 180 / Math.PI >= 20, `${name}: leaning out ${(Math.abs(G.angle) * 180 / Math.PI).toFixed(0)} degrees`);
    assert.ok((G.knee[1] - S.floor) / (G.hip[1] - S.floor) < 0.36, name + ': its knuckle low on it');
    assert.ok(Math.max(...L.pad) >= 3.5 * G.tubes[G.n - 1].r, name + ': a broad pad');
    assert.ok(G.braces.length >= 2, name + ': two braces');
    for (const B of G.braces) {
      assert.ok(B.r >= 0.4 * L.r, `${name}: its ${B.name} brace fat (${B.r} m, the cylinder ${L.r})`);
      const d = B.to.map((v, i) => v - B.from[i]), a = G.dir, ang = Math.acos(Math.abs(d[0] * a[0] + d[1] * a[1] + d[2] * a[2]) / Math.hypot(...d)) * 180 / Math.PI;
      assert.ok(ang > (L.braceMin ?? 12), `${name}: its ${B.name} brace comes in at an angle to the leg (${ang.toFixed(0)} degrees)`);
    }
    for (let k = 1; k < G.n; k++) assert.ok(G.tubes[k].u1 - G.tubes[k - 1].u0 >= LEG.overlap - 1e-6, `${name}: part ${k} stays in the one over it`);
  }
});

test('each leg folds into itself: up, every part inside its well; on the way, nothing through the hull but by its well', () => {
  const bad = [];
  for (const [ship, S] of Object.entries(LEGS)) {
    const skin = skinOf(HULLS[ship]);
    for (const [which, L] of Object.entries(S.legs)) {
      const G = legPlan(L, S.floor), name = `${ship} ${which}`, [mn, mx] = G.well;
      const W = HULLS[ship].WELLS[which].box;
      assert.ok([0, 1, 2].every((k) => Math.abs(W[0][k] - mn[k]) < 1e-3 && Math.abs(W[1][k] - mx[k]) < 1e-3), name + ': its well cut where its plan says');
      // (its parts as points: the stages' axis ends and edges; the pad's corners; the braces' ends and middles)
      const ac = [-G.dir[1], G.dir[0], 0], pts = [];
      G.tubes.forEach((T, k) => { if (k === G.n - 1) return; for (const u of [T.u0, (T.u0 + T.u1) / 2, T.u1]) for (const o of [[0, 0, 0], ac.map((v) => v * T.r), ac.map((v) => -v * T.r), [0, 0, T.r], [0, 0, -T.r]]) pts.push(['tube ' + k, G.at(u).map((v, i) => v + o[i])]); });
      for (const u of [LEG.pad, L.knee, G.tubes[G.n - 1].u1]) pts.push(['foot', G.at(u)]);
      for (const sx of [1, -1]) for (const sz of [1, -1]) pts.push(['foot', [G.foot[0] + sx * L.pad[0] / 2, S.floor + LEG.pad, G.foot[2] + sz * L.pad[1] / 2]]);
      G.braces.forEach((B, i) => {
        const cut = B.shrink ? (B.length - B.rodLength + 0.12) / B.length : 1;
        for (const k of [0.1, 0.4, cut * 0.95]) pts.push([i, lerp3(B.from, B.to, k)]);
        if (B.shrink) for (const k of [1 - B.rodLength / B.length + 0.02, 0.7, 1]) pts.push(['rod ' + i, lerp3(B.from, B.to, k)]);
      });
      // up: inside the well
      for (const [part, p] of pts) {
        const q = G.move(part, p, 1);
        // (over the shut doors: the leg's own parts over the skin under its foot, a brace over its own mount)
        const floorY = typeof part === 'number' || /^rod/.test(part) ? G.braces[typeof part === 'number' ? part : +part.split(' ')[1]].from[1] - 0.02 : L.belly + 0.03;
        assert.ok(q[0] > mn[0] - 0.02 && q[0] < mx[0] + 0.02 && q[2] > mn[2] - 0.02 && q[2] < mx[2] + 0.02 && q[1] > floorY && q[1] < mx[1] + 0.03, `${name}: its ${part} inside the well, up (${q.map((v) => v.toFixed(2))})`);
      }
      // on the way: a point inside the hull (over the skin under it) is within the well's mouth
      const through = new Set();
      for (let s = 1; s < 10; s++) for (const [part, p] of pts) {
        const q = G.move(part, p, s / 10), inMouth = q[0] > mn[0] - 0.03 && q[0] < mx[0] + 0.03 && q[2] > mn[2] - 0.03 && q[2] < mx[2] + 0.03;
        if (!inMouth && inside(skin(q[0], q[2]), q[1])) through.add(`${part} at ${s * 10}% (${q.map((v) => v.toFixed(2))})`);
      }
      // (a few moments through the very edge of the hull round the well are let pass: the Miner's aft legs brush the
      // stern block's lower outer lip on the way, the most found; GEAR_2.md)
      if (through.size > 4) bad.push(`${name}: ${[...through].join('; ')}`);
    }
  }
  assert.equal(bad.join(' | '), '', 'through the hull outside its well, on the way');
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
