// The drill operator's game (src/drill.js: a rock's own numbers, what a hole takes, the holes it stands, the field as
// a place, the full scan's readout, the store and the row's picture of it), what a store sells for and each share of
// it (src/missions.js), the smelter's slips about a haul the player went out for agreeing with the payout
// (src/jobs/smelter.js), and every level of the drill operator's ladder, every card of it true of the rock in the claw
// (src/jobs/drill.js).
//   node --test pi-nebula/tests/drill.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import * as MS from '../src/missions.js';
import * as DR from '../src/drill.js';
import { MISSIONS } from '../src/missions.js';
import { DRILL, ORE, SHAPES, KINDS, ODDS, NAMES, makeRock, makeField, makeRun, drillHole, holeWorth, bestHole, take, oreLeft, oreBy, scanOf, rockSells, storeOf, rowOf, rowCount, crewLoad, seeded as seed } from '../src/drill.js';
import { JOB as drill, SHARE } from '../src/jobs/drill.js';
import { JOB as smelter, haulOf, flownHaul, forget, sellsFor, priceOf, METALS, CARRIES, HOLD, CAN_HOLDS } from '../src/jobs/smelter.js';
import { helpPicture, PALE } from '../src/jobs/pics.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PLACE } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

const crewOf = () => ({ id: 'c1', name: 'Maya', look: { id: 'zuri' } });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const num = (label) => { const s = String(label).replace(/,/g, ''), m = s.match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };
const rightOf = (o) => num(o.coins.find((c) => c.good).label);
const sumOf = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const MINING = MISSIONS.mining;
const randDir = (rand) => { const z = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - z * z); return [s * Math.cos(a), z, s * Math.sin(a)]; };

// ── a rock ────────────────────────────────────────────────────────────────────────────────────────────────────────
test('a rock has real numbers of its own: its box, its weight (half its box at so many tonnes a cubic metre), the part of it that is ore, whole tonnes of each metal', () => {
  // every kind of rock there is: its ore a whole number of tonnes, its part as easy said as a fraction or a percent
  for (const [shape, per, part, often] of KINDS) {
    const S = SHAPES[shape], vol = S.box[0] * S.box[1] * S.box[2], weight = vol / 2 * per;
    assert.ok(S && often > 0); assert.ok([2, 4, 5, 10].includes(part), `1 in ${part}`); assert.ok(Number.isInteger(weight / part) && weight / part >= 1 && weight / part <= HOLD, `${shape} ${per}: ${weight} / ${part}`);
  }
  assert.deepEqual(Object.keys(SHAPES), ['flat', 'round', 'long']); assert.deepEqual(Object.values(SHAPES).map((S) => S.holes), [4, 5, 6]);
  const shapes = new Set(), totals = new Set();
  for (let s = 1; s <= 400; s++) {
    const r = makeRock(seed(s)), S = SHAPES[r.shape]; shapes.add(r.shape); totals.add(r.ore0);
    assert.deepEqual(r.box, S.box); assert.equal(r.vol, r.box[0] * r.box[1] * r.box[2]); assert.equal(r.weight, r.vol / 2 * r.per); assert.equal(r.ore0, r.weight / r.part);
    assert.ok(Number.isInteger(r.weight) && Number.isInteger(r.ore0) && r.ore0 >= 1);
    // its metals: one, two or three, a whole number of tonnes of each, the most first, adding up to its ore
    const ms = Object.entries(r.metals);
    assert.ok(ms.length >= 1 && ms.length <= 3); for (const [m, t] of ms) assert.ok(NAMES.includes(m) && Number.isInteger(t) && t >= 1, `${m} ${t}`);
    assert.equal(sumOf(r.metals), r.ore0); for (let i = 1; i < ms.length; i++) assert.ok(ms[i][1] <= ms[i - 1][1]);
    // its veins: two to five, each one metal's, their tonnes (in tenths) adding up to that metal's; the first metal in
    // two unlike veins, neither a whole number of tonnes; the same number of lumps in every vein
    assert.ok(r.veins.length >= 2 && r.veins.length <= 5, String(r.veins.length));
    for (const [m, t] of ms) assert.ok(near(r.veins.filter((V) => V.metal === m).reduce((a, V) => a + V.tonnes, 0), t), `${m}: its veins`);
    const first = r.veins.filter((V) => V.metal === ms[0][0]); assert.equal(first.length, 2); assert.ok(first[0].tonnes > first[1].tonnes); for (const V of first) assert.ok(Math.round(V.tonnes * 10) % 10 !== 0 && near(V.tonnes * 10, Math.round(V.tonnes * 10)));
    assert.ok(r.each >= 3 && r.each <= 5); assert.equal(r.lumps.length, r.veins.length * r.each);
    r.veins.forEach((V, v) => { const mine = r.lumps.filter((L) => L.vein === v); assert.equal(mine.length, r.each); assert.equal(V.lumps, r.each); assert.ok(mine.every((L) => L.metal === V.metal && L.ore > 0 && L.ore === L.ore0 && Math.hypot(...L.p) <= 0.72 + 1e-9)); assert.ok(near(mine.reduce((a, L) => a + L.ore, 0), V.tonnes)); });
    assert.ok(near(oreLeft(r), r.ore0)); assert.equal(r.holes, S.holes); assert.equal(r.left, r.holes); assert.deepEqual(r.made, []); assert.equal(r.broken, false); assert.equal(r.scanned, false);
  }
  assert.deepEqual([...shapes].sort(), ['flat', 'long', 'round']); assert.ok(totals.size >= 5, 'small rocks and big ones');
  // a rock asked for by its kind and its metals
  const r = makeRock(seed(3), { kind: ['round', 3, 4], metals: { iron: 2, gold: 1 } });
  assert.deepEqual([r.shape, r.weight, r.part, r.ore0], ['round', 12, 4, 3]); assert.deepEqual(r.metals, { iron: 2, gold: 1 });
  // each metal has its glow and its symbol
  for (const m of NAMES) assert.ok(/^#[0-9a-f]{6}$/.test(ORE[m].glow) && ORE[m].sym.length === 2, m);
  assert.equal(new Set(NAMES.map((m) => ORE[m].glow)).size, NAMES.length, 'each its own colour');
});

test('a hole: all of a lump on its line, less and less out to its reach, nothing past it; the metal taken is gone from the rock', () => {
  assert.equal(take(0), 1); assert.equal(take(DRILL.core), 1); assert.equal(take(DRILL.reach), 0); assert.equal(take(1), 0);
  assert.ok(take(0.2) > take(0.3) && take(0.2) < 1 && take(0.3) > 0);
  for (let s = 1; s <= 60; s++) {
    const r = makeRock(seed(s)), before = oreLeft(r), by0 = oreBy(r), b = bestHole(r), worth = holeWorth(r, b.dir);
    assert.ok(near(worth, b.worth) && worth > 0.25, `seed ${s}: the best hole takes ${worth}`);
    const h = drillHole(r, b.dir);
    // (what it takes of each metal is whole hundredths of a tonne: a little under what lay near its line)
    assert.ok(h.took <= worth + 1e-9 && h.took > worth - 0.01 * Object.keys(by0).length - 1e-9, `${h.took} of ${worth}`); for (const t of Object.values(h.by)) assert.ok(near(t * 100, Math.round(t * 100), 1e-6) && t > 0);
    assert.ok(near(oreLeft(r), before - h.took)); assert.equal(h.bare, false); assert.equal(h.left, r.holes - 1); assert.equal(r.made.length, 1);
    // metal by metal: what it took is what left the rock
    assert.ok(near(sumOf(h.by), h.took)); const by1 = oreBy(r); for (const m of Object.keys(by0)) assert.ok(near((by1[m] || 0) + (h.by[m] || 0), by0[m]), m);
    // the same spot again finds almost nothing
    assert.ok(holeWorth(r, b.dir) < 0.5 * worth, `${holeWorth(r, b.dir)} left near a hole that took ${worth}`);
    // a hole takes no more than there is room for: the rest stays in the rock
    const r2 = makeRock(seed(s)), h2 = drillHole(r2, bestHole(r2).dir, 0.1);
    assert.ok(h2.took <= 0.1 + 1e-9 && h2.took >= 0.1 - 0.01 * Object.keys(r2.metals).length - 1e-9, String(h2.took)); assert.ok(near(oreLeft(r2), r2.ore0 - h2.took));
  }
  // a hole in bare rock gives nothing, and still uses one of the rock's holes
  const r = makeRock(seed(11)); let bare = null;
  for (let i = 0; i < 4000 && !bare; i++) { const d = randDir(seed(i + 1)); if (holeWorth(r, d) === 0) bare = d; }
  assert.ok(bare, 'somewhere on the rock is bare');
  const h = drillHole(r, bare); assert.equal(h.took, 0); assert.equal(h.bare, true); assert.deepEqual(h.by, {}); assert.equal(h.left, r.holes - 1); assert.ok(near(oreLeft(r), r.ore0));
});

test('a rock stands only so many holes: after the last it crumbles, and no more can be drilled', () => {
  for (const shape of Object.keys(SHAPES)) {
    const r = makeRock(seed(5), { kind: KINDS.find((k) => k[0] === shape) }), rand = seed(9);
    for (let i = 0; i < r.holes; i++) { const h = drillHole(r, randDir(rand)); assert.equal(h.left, r.holes - 1 - i); assert.equal(h.broke, i === r.holes - 1); }
    assert.equal(r.broken, true); assert.equal(drillHole(r, [0, 1, 0]), null); assert.equal(r.made.length, SHAPES[shape].holes);
  }
});

test('a smart spot beats any spot: a careful driller gets most of a rock, holes at random far less', () => {
  let careful = 0, careless = 0, total = 0;
  for (let s = 1; s <= 120; s++) {
    const a = makeRock(seed(s)), b = makeRock(seed(s)), rand = seed(s + 1000); total += a.ore0;
    while (!a.broken) careful += drillHole(a, bestHole(a).dir).took;
    while (!b.broken) careless += drillHole(b, randDir(rand)).took;
  }
  assert.ok(careful / total > 0.85, `a careful driller: ${(careful / total).toFixed(2)}`);
  assert.ok(careless / total < 0.6 && careless / total > 0.2, `holes at random: ${(careless / total).toFixed(2)}`);
  assert.ok(careful > 1.5 * careless);
});

// ── the field ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('the field is a place: thirty rocks, each where it lies, none on top of the ship or of another, a different field every trip, with rocks of several metals', () => {
  const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const places = new Set(), tonnes = {};
  for (let s = 1; s <= 80; s++) {
    const F = makeField(seed(s));
    assert.equal(F.length, DRILL.field); assert.equal(new Set(F.map((r) => r.id)).size, F.length);
    for (const r of F) {
      const out = Math.hypot(r.pos[0], r.pos[2]);
      assert.ok(out >= DRILL.near - 0.01 && out <= DRILL.wide + 0.01, `seed ${s}: ${out} m out`); assert.ok(Math.abs(r.pos[1]) <= DRILL.thick / 2 + 0.01);
      for (const [m, t] of Object.entries(r.metals)) tonnes[m] = (tonnes[m] || 0) + t;
    }
    for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) assert.ok(far(F[i].pos, F[j].pos) >= DRILL.apart - 0.01, `seed ${s}: two rocks ${far(F[i].pos, F[j].pos).toFixed(1)} m apart`);
    // near ones and far ones, all round the ship; small ones and big ones; several metals, and rocks of more than one
    const outs = F.map((r) => Math.hypot(r.pos[0], r.pos[2])); assert.ok(Math.min(...outs) < 140 && Math.max(...outs) > 170, `seed ${s}`);
    assert.ok(F.some((r) => r.pos[2] > 0) && F.some((r) => r.pos[2] < 0) && F.some((r) => r.pos[0] > 0) && F.some((r) => r.pos[0] < 0));
    assert.ok(new Set(F.map((r) => r.ore0)).size >= 3, `seed ${s}: sizes`);
    assert.ok(new Set(F.flatMap((r) => Object.keys(r.metals))).size >= 4, `seed ${s}: ${[...new Set(F.flatMap((r) => Object.keys(r.metals)))]}`);
    assert.ok(F.some((r) => Object.keys(r.metals).length >= 2), `seed ${s}: a rock of two metals`);
    places.add(F.map((r) => `${r.pos}|${JSON.stringify(r.metals)}`).join(';'));
  }
  assert.equal(places.size, 80, 'no two fields alike');
  // the same seed, the same field (the tests, the lab)
  assert.deepEqual(makeField(seed(7)).map((r) => [r.pos, r.metals, r.shape]), makeField(seed(7)).map((r) => [r.pos, r.metals, r.shape]));
  // the dearer the metal, the rarer: by how common each is, and so in the fields
  for (let i = 1; i < NAMES.length; i++) { assert.ok(ODDS[NAMES[i]] < ODDS[NAMES[i - 1]], NAMES[i]); assert.ok(priceOf(NAMES[i]) > priceOf(NAMES[i - 1])); assert.ok(tonnes[NAMES[i]] < tonnes[NAMES[i - 1]], `${NAMES[i]}: ${tonnes[NAMES[i]]}`); }
  // nothing marks a rock out: a rock with a lot of a dear metal is a rock like any other
  for (const r of makeField(seed(3))) assert.deepEqual(Object.keys(r).sort(), ['box', 'broken', 'each', 'holes', 'id', 'left', 'look', 'lumps', 'made', 'metals', 'ore0', 'part', 'per', 'pos', 'scanned', 'shape', 'veins', 'vol', 'weight']);
  assert.ok(!('RICH' in MS) && !('isRich' in MS) && !('tune' in DR) && !('canistersOf' in DR), 'no rich rock, no bonus, no sorting by canister');
});

test('the full scan\'s numbers are the rock\'s own: exactly the tonnes of each metal in it, before and after a hole', () => {
  for (let s = 1; s <= 80; s++) {
    const r = makeRock(seed(s)), scan = scanOf(r);
    // a rock nobody has drilled: its whole tonnes, the most first
    assert.deepEqual(Object.fromEntries(scan.map((x) => [x.metal, x.tonnes])), r.metals); for (let i = 1; i < scan.length; i++) assert.ok(scan[i].tonnes <= scan[i - 1].tonnes);
    assert.equal(rockSells(r), Object.entries(r.metals).reduce((a, [m, t]) => a + t * priceOf(m), 0));
    // after a hole: what is left, to the hundredth of a tonne
    const h = drillHole(r, bestHole(r).dir), left = oreBy(r);
    for (const x of scanOf(r)) assert.ok(near(x.tonnes, left[x.metal], 1e-9), `${x.metal}: ${x.tonnes} for ${left[x.metal]}`);
    assert.ok(near(scanOf(r).reduce((a, x) => a + x.tonnes, 0) + h.took, r.ore0, 1e-9), 'what the scan reads and what the hole took make the rock\'s whole tonnes');
  }
});

// ── the store ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('the store is one: every bit of every metal drilled is aboard, to the full six tonnes and never more', () => {
  assert.equal(DRILL.cans, 8); assert.deepEqual(CAN_HOLDS, [3, 4]); assert.equal(DRILL.hold, 6); assert.equal(HOLD, 6); assert.equal(DRILL.can, 0.75);
  for (let s = 1; s <= 40; s++) {
    const rand = seed(s), R = makeRun({ rand }), took = {}, pick = seed(s + 50); let guard = 0, out = 0;
    while (R.stage !== 'full' && guard++ < 900) {
      if (R.stage === 'look') { R.pick(R.rocks[Math.floor(pick() * R.rocks.length)].id); R.asked(); }
      const rock = R.held, before = oreLeft(rock), h = R.drill(s % 2 ? bestHole(rock).dir : randDir(pick));
      assert.ok(near(oreLeft(rock), before - h.took)); out += h.took;
      for (const [m, t] of Object.entries(h.by)) took[m] = (took[m] || 0) + t;
      // every bit that left a rock is in the store, metal by metal, and nothing else is
      assert.deepEqual(Object.keys(R.ore).sort(), Object.keys(took).sort()); for (const m of Object.keys(took)) assert.ok(near(R.ore[m], took[m], 1e-9), m);
      assert.ok(near(R.aboard, Math.min(DRILL.hold, out), 1e-6)); assert.ok(R.aboard <= DRILL.hold + 1e-9); assert.equal(R.full, Math.min(8, Math.floor(R.aboard / 0.75 + 1e-6)));
      // the store is whole hundredths of a tonne, exactly: what is said and sold is what is aboard, with no rounding
      const st = R.store(); assert.equal(Math.round(sumOf(st) * 100), Math.round(R.aboard * 100)); for (const [m, t] of Object.entries(st)) { assert.equal(t, R.ore[m], m); assert.ok(near(t * 100, Math.round(t * 100), 1e-6), `${m}: ${t}`); }
      assert.equal(R.sells(), sellsFor(st).pay);
    }
    assert.equal(R.stage, 'full', `seed ${s}`); assert.equal(R.aboard, 6); assert.equal(R.full, 8); assert.ok(near(sumOf(R.ore), 6, 1e-6)); assert.equal(Math.round(sumOf(R.store()) * 100), 600);
    assert.equal(R.drill([0, 1, 0]), null, 'full is full');
  }
  // rounding loses nothing: the hundredths are shared so that they add up
  assert.deepEqual(storeOf({ iron: 1.003, nickel: 2.005, gold: 2.992 }), { iron: 1, nickel: 2.01, gold: 2.99 });
  assert.deepEqual(storeOf({ iron: 3, nickel: 1.5, titanium: 1.5 }), { iron: 3, nickel: 1.5, titanium: 1.5 });
  assert.deepEqual(storeOf({}), {});
});

test('the row of eight is only a picture of the store: coloured in proportion, a metal at a time', () => {
  // the game's maker's own two examples
  assert.deepEqual(rowCount({ iron: 3, nickel: 1.5, titanium: 1.5 }), { iron: 4, nickel: 2, titanium: 2 }, 'half iron, a quarter nickel, a quarter titanium: 4, 2 and 2');
  assert.deepEqual(rowCount({ nickel: 0.75, copper: 1.5, iron: 3.75 }), { iron: 5, nickel: 1, copper: 2 }, '1/8 nickel, 1/4 copper, 5/8 iron: 1, 2 and 5');
  const none = rowOf({}); assert.equal(none.length, 8); assert.ok(none.every((c) => c.fill === 0 && c.parts.length === 0));
  // a store half full fills four canisters; each metal as long as its share, in the chart's order, nothing lost
  const row = rowOf({ gold: 0.6, iron: 2.4 });
  assert.deepEqual(row.map((c) => +c.fill.toFixed(3)), [1, 1, 1, 1, 0, 0, 0, 0]);
  assert.deepEqual(row.slice(0, 4).map((c) => c.parts.map(([m, f]) => [m, +f.toFixed(3)])), [[['iron', 1]], [['iron', 1]], [['iron', 1]], [['iron', 0.2], ['gold', 0.8]]]);
  for (let s = 1; s <= 30; s++) {
    const rand = seed(s), ore = {}; let left = 6 * rand();
    for (const m of NAMES) { if (rand() < 0.5) { const t = left * rand(); ore[m] = t; left -= t; } }
    const R = rowOf(ore), by = {}; for (const c of R) for (const [m, f] of c.parts) by[m] = (by[m] || 0) + f * 0.75;
    for (const m of Object.keys(ore)) assert.ok(near(by[m] || 0, ore[m], 1e-6), `${m}: ${by[m]} drawn for ${ore[m]}`);
    assert.ok(near(R.reduce((a, c) => a + c.fill, 0) * 0.75, sumOf(ore), 1e-6));
    const order = R.flatMap((c) => c.parts.map((p) => p[0])).filter((m, i, a) => a.indexOf(m) === i); assert.deepEqual(order, NAMES.filter((m) => ore[m] > 1e-9), 'a metal at a time');
  }
});

// ── a run ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('a run: find a rock, its question, drill, let go or crumble, on to the next, until the store is full; the question changes nothing', () => {
  const R = makeRun({ rand: seed(3) });
  assert.equal(R.stage, 'look'); assert.equal(R.aboard, 0); assert.equal(R.full, 0); assert.equal(R.rocks.length, DRILL.field);
  assert.equal(R.drill([0, 1, 0]), null, 'nothing in the claw'); assert.equal(R.letGo(), false);
  const first = R.rocks[2]; assert.equal(R.pick(first.id), first); assert.equal(R.stage, 'ask'); assert.equal(R.pick(R.rocks[0].id), null, 'one rock at a time');
  // the question is over, however it was answered: the rock is exactly as it was
  const before = JSON.stringify(first);
  assert.equal(R.asked.length, 0, 'it takes no answer'); assert.equal(R.asked(), true); assert.equal(R.stage, 'drill'); assert.equal(JSON.stringify(first), before);
  const h = R.drill(bestHole(first).dir); assert.ok(h.took > 0 && near(R.aboard, h.took)); assert.equal(h.rock, first);
  assert.equal(R.letGo(), true); assert.equal(R.stage, 'look'); assert.equal(R.held, null);
  assert.ok(!R.rocks.includes(first), 'a rock worked is gone'); assert.equal(R.rocks.length, DRILL.field - 1, 'and no other is put in its place');
  // the last hole crumbles the rock, and the run is back to looking
  const second = R.rocks[0]; R.pick(second.id); R.asked();
  let last = null; while (R.stage === 'drill') last = R.drill(randDir(seed(R.stats.holes + 4)));
  assert.ok(last.broke || last.done); if (!last.done) { assert.equal(R.stage, 'look'); assert.ok(!R.rocks.includes(second)); }
  assert.equal(R.stats.rocks, 2);
  // two runs alike but for the rocks' questions (asked at once, or put away a while): the same store
  const play = (wait) => { const X = makeRun({ rand: seed(21) }), pick = seed(5); let g = 0; while (X.stage !== 'full' && g++ < 500) { if (X.stage === 'look') { X.pick(X.rocks[Math.floor(pick() * X.rocks.length)].id); if (wait) X.asked(); else X.asked(); } X.drill(bestHole(X.held).dir); } return X.store(); };
  assert.deepEqual(play(true), play(false));
});

test('every run fills its store: a careful driller from a few rocks, a careless one from more; and the rocks never run out', () => {
  let careful = 0, careless = 0; const N = 30;
  for (let s = 1; s <= N; s++) {
    for (const smart of [true, false]) {
      const rand = seed(s), R = makeRun({ rand }), pick = seed(s + 7); let guard = 0;
      while (R.stage !== 'full' && guard++ < 2000) { if (R.stage === 'look') { R.pick(R.rocks[Math.floor(pick() * R.rocks.length)].id); R.asked(); } R.drill(smart ? bestHole(R.held).dir : randDir(pick)); assert.ok(R.rocks.length >= 7, 'more rocks further out'); }
      assert.equal(R.stage, 'full', `seed ${s}`); assert.equal(R.full, 8);
      if (smart) careful += R.stats.rocks; else careless += R.stats.rocks;
    }
  }
  assert.ok(careful / N >= 2 && careful / N <= 5, `a careful driller: ${careful / N} rocks`);
  assert.ok(careless / N > careful / N + 1.5 && careless / N <= 12, `a careless one: ${careless / N} rocks`);
  // a driller who only ever hits bare rock uses the field up, and there is always more of it
  const R = makeRun({ rand: seed(2) }); let g = 0;
  while (g++ < 400) { R.pick(R.rocks[0].id); R.asked(); R.letGo(); }
  assert.ok(R.rocks.length >= 7); assert.equal(R.aboard, 0);
});

test('the captain\'s own driller works the same game by the same rules: a full store, an ordinary mixed load', () => {
  const sold = [];
  for (let s = 1; s <= 200; s++) { const st = crewLoad(seed(s)); assert.equal(Math.round(sumOf(st) * 100), 600, `seed ${s}`); for (const m of Object.keys(st)) assert.ok(NAMES.includes(m)); sold.push(sellsFor(st).pay); }
  const mean = sold.reduce((a, b) => a + b, 0) / sold.length;
  // an ordinary mixed load sells for about 17,000 to 20,000 credits (the price list's one number is set for that)
  assert.ok(mean >= 17000 && mean <= 20000, `an ordinary load sells for ${Math.round(mean)}`);
  assert.ok(Math.min(...sold) >= 6 * priceOf('iron') && Math.max(...sold) <= 6 * priceOf('gold'));
  assert.ok(new Set(sold).size > 100, 'loads differ');
});

// ── the money ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('choosing well is worth it: a driller who goes for the dear metals brings home visibly more than one who takes any rock', () => {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const play = (s, choose) => { const R = makeRun({ rand: seed(s) }); let at = [0, 0, 0], g = 0; while (R.stage !== 'full' && g++ < 500) { if (R.stage === 'look') { const six = [...R.rocks].sort((a, b) => dist(a.pos, at) - dist(b.pos, at)).slice(0, 6), next = choose(six); at = next.pos; R.pick(next.id); R.asked(); } const b = bestHole(R.held); if (b.worth < 0.03) R.letGo(); else R.drill(b.dir); } return R.sells(); };
  let any = 0, choosy = 0; const N = 120;
  for (let s = 1; s <= N; s++) { any += play(s, (six) => six[0]); choosy += play(s, (six) => [...six].sort((a, b) => rockSells(b) - rockSells(a))[0]); }
  assert.ok(choosy / any > 1.12 && choosy / any < 2, `choosy ${Math.round(choosy / N)} against ${Math.round(any / N)}`);
});

test('home from a run at the drill: the store is one haul on every slip, the smelter\'s slips agree with the payout, and the share waiting is the contract\'s part of the plain sum', () => {
  const live = (round) => ({ round, canisters: CARRIES, phase: 'unload', onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 1, percent: 30 }, { socket: 2, percent: 90 }], drained: 1, onRack: 8, carried: 0,
    steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 } });
  const M = smelter.makers, rand = seeded(17);
  for (let s = 1; s <= 12; s++) for (const roles of [['drill'], ['pilot', 'drill'], ['pilot', 'drill', 'engineer']]) {
    const n = 20 + s; forget(); flownHaul(n, null);
    const R = makeRun({ rand: seed(s) }), pick = seed(s + 3); let g = 0;
    while (R.stage !== 'full' && g++ < 900) { if (R.stage === 'look') { R.pick(R.rocks[Math.floor(pick() * R.rocks.length)].id); R.asked(); } R.drill(bestHole(R.held).dir); }
    const store = R.store(), crew = crewOf(); crew.mission = { id: 'mining', captain: 'ruiz', roles, state: 'signed', signed: 1 };
    const P = MS.land(crew, { n, store }), H = haulOf(n);
    // the haul's facts are the store, and what it sells for is the plain sum
    assert.equal(H.flown, true); assert.deepEqual(H.store, store); assert.equal(H.tonnes, 6); assert.equal(H.canisters, 8); assert.deepEqual(H.ore, { n: 3, d: 4 });
    const plain = Object.entries(store).reduce((a, [m, t]) => a + Math.round(t * 100) * priceOf(m) / 100, 0);
    assert.equal(H.pay, plain); assert.equal(P.sold, plain); assert.equal(P.share, MS.shareOf(roles)); assert.equal(P.pay, Math.round(plain * MS.shareOf(roles) / 100));
    assert.deepEqual(P.lots.map((L) => [L.metal, L.tonnes]).sort(), Object.entries(store).sort()); for (const L of P.lots) { assert.equal(L.price, priceOf(L.metal)); assert.ok(near(L.pay, L.tonnes * L.price, 1e-6)); }
    assert.equal(P.lots.reduce((a, L) => a + L.pay, 0), P.sold);
    // the smelter's slips about this haul: one metal of the store at a time, each once, each the payout's own number;
    // the line under the right answer says what the whole haul pays
    const seen = new Set();
    for (let k = 0; k < P.lots.length; k++) {
      const o = M.pay.make(2, { rand, live: live(n) }), L = P.lots.find((x) => x.metal === o.facts.metal);
      assert.ok(o.facts.lot && L && !seen.has(L.metal), o.story); seen.add(L.metal);
      assert.ok(near(rightOf(o), L.pay, 1e-6), `${o.story} -> ${o.answer}, the payout says ${L.pay}`); assert.equal(o.facts.price, L.price);
      assert.ok(o.rightWhy.includes(`pays ${P.sold.toLocaleString('en-US')} credits`), o.rightWhy); assert.equal(o.facts.from, 'This haul');
      assert.equal(o.coins.filter((c) => c.good).length, 1); assert.ok(o.coins.length >= 3, o.story); assert.ok(!/NaN|undefined/.test(JSON.stringify(o)));
    }
    assert.equal(M.pay.make(2, { rand, live: live(n) }).facts.lot, undefined, 'each metal once: then slips from the log');
    // its canisters: 3/4 of a tonne of metal in each, no one metal named; the whole of them six tonnes
    const whole = M.ore.make(1, { rand, live: live(n) }); assert.equal(whole.facts.kind, 'haul'); assert.equal(rightOf(whole), 6); assert.ok(/3\/4 of a tonne of metal in each/.test(whole.story), whole.story);
    const some = M.ore.make(2, { rand, live: live(n) }); assert.ok(['wall', 'ship'].includes(some.facts.kind)); assert.ok(/of metal/.test(some.story) && !/(iron|nickel|copper|cobalt|titanium|gold)/.test(some.story), some.story);
    const load = M.weigh.make(2, { rand, live: { ...live(n), docked: [], fullOnShip: 0, phase: 'load' } }); assert.equal(load.facts.w, H.fill); assert.ok(H.fill / 10 >= 0.75 + 0.1 - 1e-9);
    // collected: the credits are up by exactly the share
    crew.credits = 500; const got = MS.collect(crew); assert.deepEqual(got, { pay: P.pay, credits: 500 + P.pay });
    flownHaul(n, null);
  }
  forget();
});

// ── the ladder ────────────────────────────────────────────────────────────────────────────────────────────────────
const LEVELS = ['kVeins', 'kHoles', 'kCans', 'kLumps', 'tonnes', 'share', 'part', 'parts', 'box', 'tenths', 'fill', 'weight', 'percent', 'fillParts', 'anyPercent', 'ball', 'credits', 'myShare'];
// (a rock in the claw, as src/drillview.js hands it to the makers: the game's own rock; and the canisters as they are)
const LIVE = (k) => ({ rock: makeRock(seed(k * 7 + 1)), cans: { full: k % 9, of: 8 } });

test('the drill joins Mathwood\'s levels: eighteen levels, easiest first, kindergarten to eighth grade', () => {
  assert.equal(E.register(drill), true);
  const L = PLACE.drill.levels;
  assert.deepEqual(L.map((x) => x.id), LEVELS);
  for (let i = 1; i < L.length; i++) assert.ok(L[i].grade >= L[i - 1].grade, `${L[i].id}: ${L[i].grade} after ${L[i - 1].grade}`);
  assert.equal(L[0].grade, 0); assert.ok(L[L.length - 1].grade >= 76);
  for (let i = 1; i < L.length; i++) assert.ok(L[i].grade - L[i - 1].grade <= 12, `${L[i - 1].id} to ${L[i].id}: ${L[i].grade - L[i - 1].grade}`);
  for (const x of L) assert.ok(x.title && x.line, x.id);
  assert.equal(drill.dark, true);
});

test('every level of the drill ladder deals good cards about the rock in the claw: one right answer, wrong ones that say why, a dark picture', () => {
  const WEST = /\b(horse|cattle|wagon|saloon|stagecoach|rifle|cowhand|steer|Yuma|Tucson|jerky|harvest supper|town social|miles?|pounds?)\b/i;
  // every card is about the work in hand: the rock, its ore, the scan, the canisters
  const WORK = /\b(rock|rocks|ore|scan|veins?|holes?|canisters?|lumps?|drill)\b/i;
  for (const L of drill.place.levels) {
    const rand = seeded(L.id.length * 97 + L.grade + 3), keys = new Set();
    for (let k = 0; k < 90; k++) {
      const crew = crewOf(); setLevelAt(crew, 'drill', L.id);
      const live = k % 4 === 3 ? null : LIVE(k), q = E.deal(crew, drill, { rand, live }), o = q.order;
      assert.equal(q.level.id, L.id); keys.add(o.key);
      assert.equal(o.coins.filter((c) => c.good).length, 1, `${L.id}: ${o.story}`);
      assert.ok(o.coins.length >= 3, `${L.id}/${o.key}: ${o.coins.length} answers: ${o.story}`);
      assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${L.id}: two answers alike: ${o.coins.map((c) => c.label)}`);
      const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.big} ${c.small} ${c.label} ${c.why}`).join(' ')} ${o.rightWhy || ''} ${(o.lines || []).flat().join(' ')} ${o.help.line} ${(o.help.steps || []).join(' ')}`;
      assert.ok(!/NaN|undefined|Infinity|\[object/.test(text), `${L.id}: ${text}`);
      assert.ok(!WEST.test(`${o.story} ${o.ask}`), `${L.id}: the west got in: ${o.story} ${o.ask}`);
      assert.ok(WORK.test(`${o.story} ${o.ask}`), `${L.id}: not about the work in hand: ${o.story} ${o.ask}`);
      assert.ok(!/smelter|furnace|crusher|load\b|slag|pays double|rich rock|quarter more/i.test(text), `${L.id}: other words got in: ${text}`);
      for (const c of o.coins) if (!c.good) assert.ok(c.why && c.why.length > 8, `${L.id}: a wrong answer with no reason: ${c.label}`);
      assert.ok(o.rightWhy, L.id);
      // Help: a picture for this question, one click away, drawn dark with light lines (none of the pale card's colours)
      const h = helpPicture(o, { dark: true }); assert.ok(h.svg && h.svg.includes('<svg') && !/NaN|undefined/.test(h.svg), `${L.id}: no picture for ${o.key}`);
      for (const pale of [PALE.CARD, PALE.INK, PALE.FILL, PALE.FILL2, PALE.SOFT, '"#fff"']) assert.ok(!h.svg.includes(pale) || (pale === '"#fff"' && /stroke="#fff"/.test(h.svg) && !/fill="#fff"/.test(h.svg)), `${L.id}/${o.key}: a pale colour, ${pale}`);
      // what a card pays by itself is the engine's own sum (it is not paid on a run)
      assert.ok(q.worth.pay >= E.PAY.min && q.worth.pay <= E.PAY.max);
    }
    assert.ok(keys.size >= 1, L.id);
  }
});

test('nothing on a card is untrue: every number on it is the rock\'s own, the same the full scan reads and the store counts', () => {
  const deal = (id, k, live) => { const crew = crewOf(); setLevelAt(crew, 'drill', id); return E.deal(crew, drill, { rand: seeded(k * 31 + id.length), live }).order; };
  const kinds = new Set();
  for (let k = 0; k < 140; k++) {
    for (const id of LEVELS) {
      const live = LIVE(k), r = live.rock, o = deal(id, k, live), ans = rightOf(o), [maker, kind] = o.key.split(':'), W = r.weight, T = r.ore0, d = r.part, ms = Object.entries(r.metals), why = `${o.key}: ${o.story} ${o.ask} -> ${o.answer}`;
      kinds.add(`${maker}:${kind}`);
      const says = (...words) => { for (const w of words) assert.ok(`${o.story} ${(o.lines || []).flat().join(' ')}`.includes(w), `${why}: it should say "${w}"`); };
      if (maker === 'veins') {
        if (kind === 'count') assert.equal(ans, r.veins.length, why);
        else if (kind === 'both') { const a = r.veins.filter((V) => V.metal === ms[0][0]).length; assert.equal(ans, r.veins.length, why); says(`${a} ${a === 1 ? 'vein' : 'veins'} of ${ms[0][0]}`); }
        else if (kind === 'holes') { says(`stands ${r.holes} holes`); assert.equal(ans, r.holes - o.facts.used, why); assert.match(o.ask, /^After \d holes?, how many will be left\?$/); }
        else { assert.equal(ans, CARRIES - o.facts.full, why); if (live.cans.full >= 1 && live.cans.full <= 7) { assert.equal(o.facts.full, live.cans.full, 'the canisters as they are'); assert.match(o.ask, /still to fill\?$/); } else assert.match(o.ask, /^When \d of them/); }
      } else if (maker === 'lumps') { says(`${r.veins.length} veins`, `${r.each} lumps`); assert.equal(ans, r.lumps.length, why); }
      else if (maker === 'plain') {
        if (kind === 'metals') { for (const [m, t] of ms) says(`${t} ${t === 1 ? 'tonne' : 'tonnes'} of ${m}`); assert.equal(ans, T, why); }
        else if (kind === 'whole') { says(`${T} ${T === 1 ? 'tonne' : 'tonnes'} of ore`, `${W - T} ${W - T === 1 ? 'tonne' : 'tonnes'} of plain rock`); assert.equal(ans, W, why); }
        else { says(`weighs ${W} tonnes`); assert.equal(ans, W - T, why); }
      } else if (maker === 'per') { says(`weighs ${W} tonnes`, `every ${d} tonnes`); assert.equal(ans, T, why); }
      else if (maker === 'part') {
        if (kind === 'one') { says(`weighs ${W} tonnes`, `1/${d} of it is ore`); assert.equal(ans, T, why); }
        else if (kind === 'plain') { says(`weighs ${W} tonnes`, `${d - 1}/${d} of it is plain rock`); assert.equal(ans, W - T, why); }
        else if (kind === 'metal') { const F = o.facts, m = ms.find(([, t]) => t === F.ans); assert.ok(m && near(F.n / F.d, F.ans / T), why); says(`${T} tonnes of ore`, `${F.n}/${F.d} of the ore is`); assert.equal(ans, F.ans); }
        else { says(`weighs ${W} tonnes`, `${T} ${T === 1 ? 'tonne' : 'tonnes'} of it`); assert.equal(o.coins.find((c) => c.good).big, `1/${d}`, why); }
      } else if (maker === 'box') {
        const [l, w, h] = r.box;
        if (kind === 'volume') { says(`${l} metres long`, `${w} metres wide`, `${h} ${h === 1 ? 'metre' : 'metres'} high`); assert.equal(ans, r.vol, why); }
        else if (kind === 'weight') { says(`is ${r.vol} cubic metres`, `weighs ${r.per} tonnes`, 'about half'); assert.equal(ans, W, why); }
        else { says(`${l} metres long`, `weighs ${r.per} tonnes`, 'about half'); assert.equal(ans, W, why); }
      } else if (maker === 'tenths') {
        const two = r.veins.filter((V) => V.metal === ms[0][0]); says(`${two[0].tonnes} tonnes of ${ms[0][0]}`, String(two[1].tonnes));
        assert.ok(near(ans, kind === 'add' ? ms[0][1] : two[0].tonnes - two[1].tonnes, 1e-9), why);
      } else if (maker === 'percent') {
        const p = 100 / d;
        if (kind === 'of') { says(`weighs ${W} tonnes`, `${p}% of it is ore`); assert.equal(ans, T, why); }
        else if (kind === 'which') { says(`weighs ${W} tonnes`, `${T} ${T === 1 ? 'tonne' : 'tonnes'} of it`); assert.equal(ans, p, why); }
        else { says(`weighs ${W} tonnes`, `${100 - p}% of it is plain rock`); assert.equal(ans, W - T, why); }
      } else if (maker === 'worth') {
        for (const [m, t] of ms) { says(`${t} ${t === 1 ? 'tonne' : 'tonnes'} of ${m}`); assert.ok(`${o.story}`.includes(priceOf(m).toLocaleString('en-US')), `${why}: ${m}'s price on the chart`); }
        assert.equal(ans, kind === 'rock' ? rockSells(r) : rockSells(r) * SHARE / 100, why);
      } else assert.fail(`a card not of this rock: ${o.key}`);
      // the sums the worked sheet is given end on the right answer
      if (o.sum && typeof ans === 'number' && maker !== 'part' || (o.sum && kind !== 'which')) { const last = o.sum.chain ? o.sum.chain[o.sum.chain.length - 1] : o.sum, end = last.op === 'add' ? last.a + last.b : last.op === 'sub' ? last.a - last.b : last.op === 'mul' ? last.a * last.b : last.a / last.b; assert.ok(near(end, ans, 1e-6), `${why}: the sums end on ${end}`); }
    }
  }
  for (const want of ['veins:count', 'veins:both', 'veins:holes', 'veins:cans', 'lumps:veins', 'plain:metals', 'plain:whole', 'plain:rest', 'per:every', 'part:one', 'part:plain', 'part:metal', 'part:which', 'box:volume', 'box:weight', 'box:size', 'tenths:add', 'tenths:more', 'percent:of', 'percent:which', 'percent:plain', 'worth:rock', 'worth:share']) assert.ok(kinds.has(want), want);
  // with no rock in the claw (the levels page): a rock made by the game's own rules, so the card is a real rock's still
  const o = deal('part', 3, null); assert.match(o.story, /weighs \d+ tonnes, and 1\/\d+ of it is ore/);
});

test('a rock\'s card pays nothing by itself on a run, but the level and the kinds of math hear it', () => {
  const crew = crewOf(); setLevelAt(crew, 'drill', 'part');
  const q = E.deal(crew, drill, { rand: seeded(5), live: LIVE(2) }), right = q.order.coins.findIndex((c) => c.good);
  const r = E.answer(crew, drill, q, right, { ms: 9000, pay: false });
  assert.equal(r.right, true); assert.equal(r.pay, 0); assert.equal(E.credits(crew), 0);
  assert.equal(crew.jobs.drill.n, 1); assert.equal(crew.jobs.drill.right, 1); assert.equal(crew.jobs.drill.earned, 0);
  assert.ok(crew.levels.places.drill, 'the level heard it');
  // a wrong answer teaches: its line why, and nothing else
  const q2 = E.deal(crew, drill, { rand: seeded(6), live: LIVE(3) }), wrong = q2.order.coins.findIndex((c) => !c.good), w = E.answer(crew, drill, q2, wrong, { pay: false });
  assert.equal(w.right, false); assert.ok(w.why && w.why.length > 8); assert.equal(w.pay, 0);
});
