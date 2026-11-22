// The way to the wreck (src/planet/guideplan.js) and the sensors' card that finds it (src/jobs/sensors.js): the way's
// colour stands out from each planet's ground (green, or purple where the ground is near green), the radar and the
// arrow point back to the wreck from anywhere with no edge, every level of the sensors' ladder deals true cards, and
// the Medic sets down beside the wreck by hand and by autopilot with the game's own flight model (src/planet/landing.js).
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { guideColour, groundColours, oklab, offsetTo, shipFrame, aheadOfYaw, radarDot, distWords, edgeSpot, inBox, WAY_COLOURS, STAND } from '../src/planet/guideplan.js';
import { makeLand } from '../src/planet/land.js';
import * as E from '../src/jobs/engine.js';
import { JOB as sensors, sensorsMap, SQUARE } from '../src/jobs/sensors.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PROBLEMS, PLACE } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';
import { workOf } from '../../mathwood-valley/src/math/longwork.js';
import * as F from '../src/flymodel.js';
import { flightOf } from '../src/fleet.js';
import { planetPad, groundSolid, planDown, padNose } from '../src/planet/landing.js';

const hue = (rgb) => { const L = oklab(rgb); return Math.atan2(L[2], L[1]) * 180 / Math.PI; };
const gap = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };

test('the way\'s colour: green on a grey moon and on a red or orange ground, purple where the ground is green; never near the ground\'s own', () => {
  // a grey moon: nothing to clash with, green as he said
  assert.equal(guideColour({ dust: [0.5, 0.5, 0.5], rock: [0.36, 0.36, 0.36], bright: [0.72, 0.72, 0.71], dark: [0.3, 0.3, 0.3] }).id, 'green');
  // a red and orange canyon (the planet he looked at): green
  assert.equal(guideColour({ dust: [0.75, 0.4, 0.25], rock: [0.54, 0.22, 0.18], bright: [0.71, 0.46, 0.33], dark: [0.35, 0.11, 0.13], grass: [0.56, 0.34, 0.24], grass2: [0.69, 0.52, 0.23] }).id, 'green');
  // a green meadow (Earth's colours): purple
  assert.equal(guideColour({ dust: [0.42, 0.33, 0.24], rock: [0.39, 0.37, 0.33], grass: [0.3, 0.45, 0.2], grass2: [0.36, 0.5, 0.25] }).id, 'purple');
  // every planet the game makes (sixty seeds): green or purple nearly always, and whatever it is, its hue well away
  // from every coloured part of that planet's ground
  let gp = 0;
  for (let s = 1; s <= 60; s++) {
    const L = makeLand(s, { n: 64 }), c = guideColour(L.palette);
    if (c.id === 'green' || c.id === 'purple') gp++;
    for (const g of groundColours(L.palette)) {
      const lab = oklab(g); if (Math.hypot(lab[1], lab[2]) < STAND.grey) continue;
      assert.ok(gap(hue(c.rgb), hue(g)) >= (c.id === 'green' || c.id === 'purple' ? STAND.hue : 20), `seed ${s} ${L.kind.id}: ${c.id} beside ${g.map((v) => Math.round(v * 255))}`);
    }
    assert.ok(WAY_COLOURS.some((w) => w.id === c.id) && /^#[0-9a-f]{6}$/.test(c.hex));
  }
  assert.ok(gp >= 54, `green or purple on ${gp} of 60`);
});

test('the radar and the arrow point back to the wreck from anywhere: no edge, nothing wraps', () => {
  const wreck = [100, 0, -40];
  // flown 5 km off past the ground's repeat (2,048 m), it is still the whole way back
  const far = offsetTo([5100, 80, -40], wreck);
  assert.equal(far.dx, -5000); assert.equal(far.dz, 0); assert.equal(far.dist, 5000);
  // the ship's own frame: ahead along -z (yaw 0), the wreck 300 m ahead and 200 m to its right
  const ahead = aheadOfYaw(0);
  const [r, a] = shipFrame(200, -300, ahead);
  assert.ok(Math.abs(r - 200) < 1e-9 && Math.abs(a - 300) < 1e-9, `${r} ${a}`);
  // turned a quarter to its left (nose along -x), the same wreck is now off to its right and behind... its right side
  const [r2, a2] = shipFrame(200, -300, aheadOfYaw(Math.PI / 2));
  assert.ok(Math.abs(r2 - 300) < 1e-9 && Math.abs(a2 + 200) < 1e-9, `${r2} ${a2}`);
  // on the radar: inside its reach where it is, beyond it on the rim, the way to turn
  assert.deepEqual(radarDot(200, 300, 1000), { x: 0.2, y: 0.3, beyond: false });
  const rim = radarDot(-3000, 4000, 1000);
  assert.equal(rim.beyond, true); assert.ok(Math.abs(Math.hypot(rim.x, rim.y) - 1) < 1e-9); assert.ok(rim.x < 0 && rim.y > 0);
  // the words
  assert.equal(distWords(7.4), '7 m'); assert.equal(distWords(418), '420 m'); assert.equal(distWords(1234), '1.2 km'); assert.equal(distWords(12500), '13 km');
  // the arrow out of sight: on the box's edge, pointing toward where the wreck is; behind the eye, turned round
  const box = { left: 20, top: 60, right: 1260, bottom: 700 };
  const e = edgeSpot(2000, 380, box);
  assert.equal(e.x, 1260); assert.ok(Math.abs(e.angle) < 1e-9);
  const b = edgeSpot(400, 380, box, true);
  assert.equal(b.x, 1260); assert.ok(Math.abs(b.y - 380) < 1e-6);
  assert.ok(inBox(640, 380, box) && !inBox(10, 380, box));
});

test('the sensors\' ladder joins Mathwood\'s levels, easiest first, each on the school guide', () => {
  assert.equal(E.register(sensors), true);
  assert.deepEqual(PROBLEMS, []);
  const L = PLACE.sensors.levels;
  assert.deepEqual(L.map((l) => l.grade), [4, 18, 30, 34, 50, 60, 82]);
  for (let i = 1; i < L.length; i++) assert.ok(L[i].grade >= L[i - 1].grade);
});

test('every sensors card is true: one right answer, the wreck where the card puts it, the answer the way the ship flies', () => {
  const rand = seeded(41), crewOf = () => ({ id: 'c1', name: 'Test' });
  const seen = new Set();
  for (const Lv of sensors.place.levels) {
    for (let k = 0; k < 60; k++) {
      const crew = crewOf(); setLevelAt(crew, 'sensors', Lv.id);
      const q = E.deal(crew, sensors, { rand }), o = q.order, f = o.facts, right = o.coins.find((c) => c.good);
      assert.equal(q.level.id, Lv.id);
      assert.equal(o.coins.filter((c) => c.good).length, 1, o.story);
      assert.ok(o.coins.length >= 3, `${Lv.id}: ${o.coins.length} answers`);
      assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${Lv.id}: two answers alike`);
      const words = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.big} ${c.small} ${c.why}`).join(' ')} ${o.rightWhy} ${o.help.line} ${(o.help.steps || []).join(' ')}`;
      assert.ok(!/NaN|undefined|Infinity|\[object/.test(words), words);
      // the wreck's place: whole squares, never on the ship, a unit of the ground's metres
      assert.ok(Number.isInteger(f.x) && Number.isInteger(f.y) && (f.x || f.y), JSON.stringify(f));
      assert.equal(f.unit, SQUARE);
      // the answer is the place, or how far it is, as the form asks
      const m = Number(String(right.big).replace(/,/g, ''));
      if (f.form === 'count') { assert.equal(m, Math.abs(f.x) + Math.abs(f.y)); assert.ok(f.x === 0 || f.y === 0); assert.ok(m <= 5); }
      else if (f.form === 'pair' || f.form === 'signs') {
        assert.equal(right.v, `(${f.x}, ${f.y})`);
        if (f.form === 'pair') assert.ok(f.x > 0 && f.y > 0, 'the youngest: ahead and to the right');
        else assert.ok(f.x < 0 || f.y < 0, 'a minus in it');
      } else if (f.form === 'one') assert.ok(m === f.y * f.unit || m === f.x * f.unit);
      else if (f.form === 'both') assert.equal(m, (Math.abs(f.x) + Math.abs(f.y)) * f.unit);
      else if (f.form === 'straight') assert.equal(m, Math.round(Math.hypot(f.x, f.y)) * f.unit);
      else assert.fail('a form: ' + f.form);
      // within the radar's and the flying's easy reach: no wreck more than 1.3 km off
      assert.ok(Math.hypot(f.x, f.y) * f.unit <= 1300);
      // the picture drawn, and its sums can be worked on paper
      assert.ok(/^<svg/.test(o.lead) && /^<svg/.test(o.help.svg));
      for (const s of !o.sum ? [] : o.sum.chain || [o.sum]) assert.ok(workOf(s), `${o.key}: a sum that can't be worked`);
      seen.add(o.key.split(':').slice(0, 2).join(':'));
    }
  }
  for (const k of ['grid:count', 'grid:pair', 'signs:pair', 'metres:one', 'metres:both', 'metres:straight']) assert.ok(seen.has(k), k);
  // a picture by itself: the wreck drawn where it is asked, and the scale under it when there is one
  const svg = sensorsMap({ hi: 8, lo: -8, at: [-4, 6], metres: 100, ask: 'the wreck: (?, ?)' });
  assert.ok(svg.includes('1 square = 100 metres') && svg.includes('the wreck: (?, ?)') && svg.includes('wreck'));
});

// ── setting down beside the wreck: the planet as the game's one flight model sees it (src/planet/landing.js) ──
test('setting down: by hand on the level ground beside the wreck the Medic\'s legs take it; elsewhere the ground is never flown through', () => {
  const land = makeLand(3), L = land.landing, cfg = planetPad(flightOf('medic'), land, { toward: [L.x + 40, L.z] }), solid = groundSolid(land, cfg);
  // (its ramps' side toward the pods: the pods off to +x, its nose along -z or +z, its left toward +x)
  const n = padNose(land, [L.x + 40, L.z]); assert.ok(Math.abs(n[0]) < 1e-9 && Math.abs(Math.abs(n[1]) - 1) < 1e-9);
  const left = F.turn(cfg.q0, [0, 0, -1]); assert.ok(left[0] > 0.99, `its left: ${left}`);
  // brought down by hand a little off the pad, turned a little: down on the floor, where and as it was put
  const S = F.makeShip(cfg); F.place(S, [L.x + 4, L.y + 6, L.z - 3], F.facing([0.8, 0, 0.6]));
  const down = { ...F.noControls(), move: [0, -0.6, 0] };
  for (let k = 0; k < 60 * 20 && !S.landed; k++) F.stepShip(S, down, 1 / 60, solid);
  assert.equal(S.landed, true, 'down');
  assert.equal(F.standing(S), 'floor');
  assert.ok(Math.abs(S.p[0] - (L.x + 4)) < 0.6 && Math.abs(S.p[2] - (L.z - 3)) < 0.6, `where it was put: ${S.p}`);
  assert.ok(Math.abs(S.p[1] - L.y) < 0.02, `on the level ground: ${S.p[1]} ${L.y}`);
  // somewhere else, pushed down at the ground and flown along it: never under it, and never down there
  let worst = Infinity, bumped = 0;
  const T = F.makeShip(cfg), x0 = L.x + 300, z0 = L.z + 260; F.place(T, [x0, land.heightAt(x0, z0) + 6, z0], F.facing([1, 0, 0]));
  const into = { ...F.noControls(), move: [0.7, -1, 0] };
  for (let k = 0; k < 60 * 25; k++) {
    F.stepShip(T, into, 1 / 60, solid); bumped = Math.max(bumped, T.bump);
    for (const p of F.pointsOf(T)) worst = Math.min(worst, p[1] - land.heightAt(p[0], p[2]));
  }
  assert.ok(bumped > 0, 'it met the ground');
  assert.ok(worst > -0.3, `a point of it ${worst.toFixed(2)} m into the ground`);
  assert.equal(T.landed, false, 'not down: only the level ground by the wreck is to set down on');
});

test('setting down: the autopilot\'s way down, from out of the jump half a kilometre off, ends on the pad beside the wreck, as it stands', () => {
  for (const seed of [3, 7, 11]) {
    const land = makeLand(seed), L = land.landing, cfg = planetPad(flightOf('medic'), land, { toward: [L.x - 30, L.z + 30] }), solid = groundSolid(land, cfg);
    const S = F.makeShip(cfg), x0 = L.x + 420, z0 = L.z - 330; F.place(S, [x0, land.heightAt(x0, z0) + 45, z0], F.facing([0, 0, 1]));
    const plan = planDown(S, land); let t = 0, low = Infinity;
    while (t < 240 && !(S.landed && F.onPad(S))) {
      const C = F.fly(S, plan, 1 / 30) || F.noControls(); F.stepShip(S, C, 1 / 30, solid); t += 1 / 30;
      for (const p of F.pointsOf(S)) low = Math.min(low, p[1] - land.heightAt(p[0], p[2]));
    }
    assert.equal(F.onPad(S), true, `seed ${seed}: on its pad after ${t.toFixed(0)} s, at ${S.p.map((v) => v.toFixed(1))}`);
    assert.equal(F.standing(S), 'pad');
    assert.ok(low > -0.3, `seed ${seed}: through the ground by ${low.toFixed(2)} m on the way`);
    assert.ok(t < 120, `seed ${seed}: ${t.toFixed(0)} s`);
  }
});
