// The drill operator's game (src/drill.js: a rock's own numbers, what a hole takes, the holes it stands, the field as
// a place, the full scan's readout, the eight canisters, one metal to each, and heading home early with their levels
// rounded to eighths), what a store sells for and each share of
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
import { DRILL, ORE, SHAPES, KINDS, ODDS, NAMES, makeRock, makeField, makeRun, drillHole, holeWorth, bestHole, take, oreLeft, oreBy, scanOf, rockSells, emptyCans, stow, roomFor, storeOf, roundCans, crewLoad, seeded as seed } from '../src/drill.js';
import { JOB as drill, SHARE } from '../src/jobs/drill.js';
import { JOB as smelter, haulOf, flownHaul, forget, sellsFor, lotsWords, tonnesWords, eighthsText, priceOf, METALS, CARRIES, HOLD, CAN_TONNES } from '../src/jobs/smelter.js';
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
  const shapes = new Set(), totals = new Set(), counts = {};
  for (let s = 1; s <= 400; s++) {
    const r = makeRock(seed(s)), S = SHAPES[r.shape]; shapes.add(r.shape); totals.add(r.ore0);
    assert.deepEqual(r.box, S.box); assert.equal(r.vol, r.box[0] * r.box[1] * r.box[2]); assert.equal(r.weight, r.vol / 2 * r.per); assert.equal(r.ore0, r.weight / r.part);
    assert.ok(Number.isInteger(r.weight) && Number.isInteger(r.ore0) && r.ore0 >= 1);
    // its metals: one, two, three or four, a whole number of tonnes of each, the most first, adding up to its ore
    const ms = Object.entries(r.metals); counts[ms.length] = (counts[ms.length] || 0) + 1;
    assert.ok(ms.length >= 1 && ms.length <= 4); if (ms.length === 4) assert.ok(r.ore0 >= 4, 'four metals only in a rock with four tonnes of ore or more'); for (const [m, t] of ms) assert.ok(NAMES.includes(m) && Number.isInteger(t) && t >= 1, `${m} ${t}`);
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
  // SOME ROCKS HOLD FOUR METALS (the game's maker: "I want to be able to drill a rock that has 4 different ores in it
  // and get them all"): about one rock in seventeen, and most fields of thirty have one or two
  assert.deepEqual(Object.keys(counts), ['1', '2', '3', '4']); assert.ok(counts[4] >= 12 && counts[4] <= 40, `rocks of four metals: ${counts[4]} of 400`);
  let fields = 0; for (let s = 1; s <= 100; s++) if (makeField(seed(s)).some((x) => Object.keys(x.metals).length === 4)) fields++;
  assert.ok(fields >= 65, `fields with a rock of four metals: ${fields} of 100`);
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
    // a hole takes no more of a metal than the canisters have room for: exactly the room, down to the last hundredth
    // of a tonne, and the rest stays in the rock
    for (const room of [0.05, 0.01]) {
      const r2 = makeRock(seed(s)), d2 = bestHole(r2).dir, m = Object.entries(drillHole(makeRock(seed(s)), d2).by).sort((p, q) => q[1] - p[1])[0][0];
      const cans = emptyCans().map(() => ({ metal: m, t: 1 })); cans[5].t = 1 - room;
      const h2 = drillHole(r2, d2, cans);
      assert.ok(near(h2.took, room), `${h2.took} for a room of ${room}`); assert.deepEqual(Object.keys(h2.by), [m]); assert.equal(h2.bare, false);
      assert.ok(near(oreLeft(r2), r2.ore0 - room)); assert.ok(cans.every((c) => c.metal === m && near(c.t, 1)), 'and the canister is full');
    }
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
      // (within the field, whose middle is ahead of where the ship arrives; none on top of the ship)
      const out = Math.hypot(r.pos[0], r.pos[2] - DRILL.ahead);
      assert.ok(out <= DRILL.wide + 0.01 && Math.hypot(...r.pos) >= DRILL.near - 0.01, `seed ${s}: ${out} m out`); assert.ok(Math.abs(r.pos[1]) <= DRILL.thick / 2 + 0.01);
      for (const [m, t] of Object.entries(r.metals)) tonnes[m] = (tonnes[m] || 0) + t;
    }
    for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) assert.ok(far(F[i].pos, F[j].pos) >= DRILL.apart - 0.01, `seed ${s}: two rocks ${far(F[i].pos, F[j].pos).toFixed(1)} m apart`);
    // near ones and far ones, to the left and to the right, most of them ahead; small ones and big ones; several
    // metals, and rocks of more than one
    const outs = F.map((r) => Math.hypot(...r.pos)); assert.ok(Math.min(...outs) < 130 && Math.max(...outs) > 250, `seed ${s}: ${Math.min(...outs)} to ${Math.max(...outs)}`);
    assert.ok(F.some((r) => r.pos[0] > 0) && F.some((r) => r.pos[0] < 0)); assert.ok(F.filter((r) => r.pos[2] > 0).length >= 24, 'ahead of the ship');
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
  assert.ok(!('RICH' in MS) && !('isRich' in MS) && !('tune' in DR) && !('purge' in DR) && !('rowOf' in DR), 'no rich rock, no bonus, no purging a canister, no store shared by all the canisters');
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

// ── the canisters ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE GAME'S MAKER (2026-11-18): "the canisters don't mix ore. So if you collect 3 metals then it will dedicate 3
// canisters to that type. If one fills up, like iron, then it gets another canister. Once each canister is designated
// then you can't except any new types of ore. ... If they go back early ... round the level to the nearest 1/8th"
// (what is always true of the eight)
function checkCans(cans, why = '') {
  assert.equal(cans.length, 8, why);
  for (const c of cans) {
    assert.ok(c.metal === null || NAMES.includes(c.metal), why); assert.ok(c.t >= 0 && c.t <= 1 + 1e-9, `${why}: ${c.t}`);
    // one metal to a canister; an empty one is no metal's
    assert.equal(c.metal === null, c.t === 0, `${why}: ${JSON.stringify(c)}`);
  }
  // a metal has one part-full canister at the most: it goes into its own before it is given another
  for (const m of NAMES) assert.ok(cans.filter((c) => c.metal === m && c.t < 1 - 1e-9).length <= 1, `${why}: two part-full canisters of ${m}`);
}
const C8 = (list) => list.map(([metal, t]) => ({ metal, t }));
// a player at the drill, for these tests: the nearest rock that holds a metal the canisters have room for (choose: one
// of the six nearest instead), a hole each time where the most would come aboard; rocks: heads home when so many rocks
// are worked (not given: plays until all eight canisters are full)
function playRun(s, { rocks = Infinity, choose = null, each = null } = {}) {
  const R = makeRun({ rand: seed(s) }); let at = [0, 0, 0], g = 0;
  const far = (r) => Math.hypot(r.pos[0] - at[0], r.pos[1] - at[1], r.pos[2] - at[2]);
  const wanted = (r) => Object.entries(oreBy(r)).some(([m, t]) => t >= 0.03 && R.roomFor(m) > 1e-6);
  while (!R.done && g++ < 20000) {
    if (R.stage === 'look') {
      if (R.stats.rocks >= rocks && R.home()) break;
      const order = [...R.rocks].sort((a, b) => far(a) - far(b)), next = choose ? choose(order.slice(0, 6)) : order.find(wanted) || order[0];
      at = next.pos; R.pick(next.id); R.asked();
    }
    const b = bestHole(R.held, 160, (d) => holeWorth(R.held, d, R.cans));
    if (b.worth < 0.005) { R.letGo(); continue; }
    const rock = R.held, before = oreBy(rock), h = R.drill(b.dir);
    if (each) each(R, h, rock, before);
  }
  return R;
}

test('the canisters do not mix ore: a canister is given to a metal the first time it comes aboard, and never holds two', () => {
  // one canister holds one tonne: eight canisters, eight tonnes (no slip tells tonnes and canisters together)
  assert.equal(DRILL.cans, 8); assert.equal(CAN_TONNES, 1); assert.equal(DRILL.hold, 8); assert.equal(HOLD, 8); assert.equal(DRILL.can, 1);
  const cans = emptyCans(); assert.deepEqual(cans, Array(8).fill({ metal: null, t: 0 }));
  // his own example: three metals collected, three canisters, one each
  assert.deepEqual(stow(cans, { iron: 0.4, nickel: 0.25, titanium: 0.1 }), { by: { iron: 0.4, nickel: 0.25, titanium: 0.1 }, stays: {} });
  assert.deepEqual(cans.slice(0, 4), C8([['iron', 0.4], ['nickel', 0.25], ['titanium', 0.1], [null, 0]]));
  // more of a metal goes into its own canister, not into a new one
  stow(cans, { nickel: 0.3 }); assert.deepEqual(cans[1], { metal: 'nickel', t: 0.55 }); assert.equal(cans.filter((c) => c.metal).length, 3);
  // "If one fills up, like iron, then it gets another canister": the next empty one, with what the first had no room for
  assert.deepEqual(stow(cans, { iron: 0.9 }), { by: { iron: 0.9 }, stays: {} });
  assert.deepEqual(cans.slice(0, 5), C8([['iron', 1], ['nickel', 0.55], ['titanium', 0.1], ['iron', 0.3], [null, 0]]));
  assert.deepEqual(storeOf(cans), { iron: 1.3, nickel: 0.55, titanium: 0.1 }); checkCans(cans);
  // a big find fills canister after canister
  const big = emptyCans(); stow(big, { copper: 2.5 }); assert.deepEqual(big.slice(0, 4), C8([['copper', 1], ['copper', 1], ['copper', 0.5], [null, 0]]));
  // the room there is for a metal: its own part-full canister, and every empty one
  assert.ok(near(roomFor(cans, 'iron'), 0.7 + 4)); assert.ok(near(roomFor(cans, 'gold'), 4)); assert.ok(near(roomFor(emptyCans(), 'gold'), 8));
  // any finds at all, in any order: never two metals in a canister, never two part-full canisters of one metal, and
  // every bit found is either aboard or left behind
  for (let s = 1; s <= 200; s++) {
    const rand = seed(s), C = emptyCans(), got = {};
    for (let i = 0; i < 40; i++) {
      const found = {}; for (const m of NAMES) if (rand() < 0.3) found[m] = Math.ceil(rand() * 90) / 100;
      const before = C.map((c) => c.metal), { by, stays } = stow(C, found);
      for (const m of Object.keys(found)) assert.ok(near((by[m] || 0) + (stays[m] || 0), found[m]), `seed ${s}: ${m}`);
      for (const [m, t] of Object.entries(by)) got[m] = (got[m] || 0) + t;
      // a canister once given to a metal is that metal's for good
      C.forEach((c, k) => { if (before[k]) assert.equal(c.metal, before[k], `seed ${s}: canister ${k} changed its metal`); });
      checkCans(C, `seed ${s}`);
      // what is left behind is only ever for want of room: that metal's canisters are full and no empty one is left
      for (const m of Object.keys(stays)) assert.ok(roomFor(C, m) < 1e-9, `seed ${s}: ${m} left behind with room for it`);
    }
    const st = storeOf(C); assert.deepEqual(Object.keys(st).sort(), Object.keys(got).sort()); for (const m of Object.keys(got)) assert.ok(near(st[m], got[m], 1e-6), `seed ${s}: ${m}`);
    assert.ok(Object.values(st).reduce((a, b) => a + b, 0) <= 8 + 1e-9);
  }
});

test('with every canister given out no new metal is taken: it stays in the rock; and a metal whose canisters are full takes no more', () => {
  // all eight given out, five metals aboard, three canisters part-full
  const cans = C8([['iron', 1], ['iron', 1], ['iron', 0.6], ['nickel', 1], ['nickel', 0.2], ['copper', 0.5], ['cobalt', 1], ['titanium', 1]]);
  const was = JSON.stringify(cans);
  // gold is new, and no canister is empty: none of it is taken, and nothing aboard changes
  assert.deepEqual(stow(cans, { gold: 0.4 }), { by: {}, stays: { gold: 0.4 } }); assert.equal(JSON.stringify(cans), was);
  assert.equal(roomFor(cans, 'gold'), 0); assert.equal(roomFor(cans, 'cobalt'), 0); assert.ok(near(roomFor(cans, 'copper'), 0.5));
  // a metal with a canister of its own still tops it off, to the brim exactly: the rest is left
  assert.deepEqual(stow(cans, { gold: 0.2, copper: 0.7, cobalt: 0.3 }), { by: { copper: 0.5 }, stays: { copper: 0.2, cobalt: 0.3, gold: 0.2 } });
  assert.deepEqual(cans[5], { metal: 'copper', t: 1 }); checkCans(cans);
  // the last empty canister, and two metals new in one hole: the one the hole found more of gets it (two alike: the
  // chart's order)
  const last = C8([['iron', 1], ['iron', 1], ['iron', 1], ['iron', 1], ['iron', 1], ['iron', 1], ['iron', 1], [null, 0]]);
  assert.deepEqual(stow(last.map((c) => ({ ...c })), { gold: 0.2, cobalt: 0.5 }), { by: { cobalt: 0.5 }, stays: { gold: 0.2 } });
  assert.deepEqual(stow(last.map((c) => ({ ...c })), { gold: 0.3, cobalt: 0.3 }), { by: { cobalt: 0.3 }, stays: { gold: 0.3 } });
  // IN A ROCK: the hole is made, the iron it found tops off iron's canister, and the gold it found stays in the rock:
  // the scan reads every bit of it afterwards
  for (let s = 1; s <= 40; s++) {
    const rock = makeRock(seed(s), { kind: ['round', 4, 4], metals: { gold: 2, iron: 2 } }), R = makeRun({ rand: seed(s) });
    R.cans = C8([['iron', 1], ['iron', 0.4], ['nickel', 1], ['nickel', 1], ['copper', 1], ['cobalt', 1], ['titanium', 1], ['titanium', 0.5]]);
    R.rocks.push(rock); R.pick(rock.id); R.asked();
    assert.equal(R.given, 8); assert.equal(R.full, 6);
    const dir = bestHole(rock).dir, would = drillHole(makeRock(seed(s), { kind: ['round', 4, 4], metals: { gold: 2, iron: 2 } }), dir).by;
    assert.ok(near(holeWorth(rock, dir, R.cans), Math.min(0.6, would.iron || 0)), 'what would come aboard is the iron there is room for');
    const h = R.drill(dir);
    assert.deepEqual(Object.keys(h.by).filter((m) => m !== 'iron'), [], `seed ${s}: only iron comes aboard`); assert.ok(near(h.by.iron || 0, Math.min(0.6, would.iron || 0)), `seed ${s}: ${h.by.iron} of ${would.iron}`);
    if (would.gold) { assert.ok(near(h.stays.gold, would.gold), `seed ${s}: the gold found stays`); assert.equal(h.bare, false); }
    assert.ok(near(oreBy(rock).gold, 2), `seed ${s}: the rock keeps its gold`); assert.equal(scanOf(rock).find((x) => x.metal === 'gold').tonnes, 2);
    assert.equal(h.left, rock.holes - 1, 'the hole is made all the same'); assert.ok(!R.cans.some((c) => c.metal === 'gold')); checkCans(R.cans);
    assert.ok(near(h.took, h.by.iron || 0)); assert.ok(near(oreLeft(rock), 4 - h.took));
  }
});

test('a rock of four metals: all four come aboard, each into a canister of its own', () => {
  for (let s = 1; s <= 40; s++) {
    const R = makeRun({ rand: seed(s) }), rock = makeRock(seed(s + 500), { kind: ['round', 4, 4], metals: { iron: 1, nickel: 1, cobalt: 1, gold: 1 } });
    assert.equal(rock.ore0, 4); assert.equal(Object.keys(rock.metals).length, 4);
    R.rocks.push(rock); R.pick(rock.id); R.asked();
    // a hole straight at each metal's biggest lump (four holes; a round rock stands five)
    for (const m of Object.keys(rock.metals)) {
      const lump = rock.lumps.filter((L) => L.metal === m).sort((a, b) => b.ore - a.ore)[0], h = R.drill(lump.p);
      assert.ok(h.by[m] > 0, `seed ${s}: the hole at the ${m} takes some`); assert.deepEqual(h.stays, {}, `seed ${s}: nothing is left for want of a canister`);
    }
    assert.deepEqual(Object.keys(R.store()).sort(), ['cobalt', 'gold', 'iron', 'nickel'], `seed ${s}`);
    assert.equal(R.given, 4, 'four canisters, one for each metal'); assert.deepEqual(R.cans.slice(0, 4).map((c) => c.metal).sort(), ['cobalt', 'gold', 'iron', 'nickel']); checkCans(R.cans);
    for (const c of R.cans.slice(4)) assert.deepEqual(c, { metal: null, t: 0 });
    // every bit that left the rock is aboard
    assert.ok(near(R.aboard + oreLeft(rock), 4, 1e-6));
  }
  // and rocks the field makes by itself hold four: the first one found in these fields, drilled where its ore is thick
  let seen = 0;
  for (let s = 1; s <= 40 && seen < 5; s++) {
    const R = makeRun({ rand: seed(s) }), rock = R.rocks.find((r) => Object.keys(r.metals).length === 4); if (!rock) continue;
    seen++; R.pick(rock.id); R.asked(); while (R.stage === 'drill' && R.held === rock) R.drill(bestHole(rock, 240, (d) => holeWorth(rock, d, R.cans)).dir);
    assert.ok(Object.keys(R.store()).length >= 3 && R.given === Object.keys(R.store()).length, `seed ${s}: ${JSON.stringify(R.store())}`); checkCans(R.cans);
  }
  assert.equal(seen, 5);
});

// ── a run ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('a run: find a rock, its question, drill, let go or crumble, on to the next; the question changes nothing', () => {
  const R = makeRun({ rand: seed(3) });
  assert.equal(R.stage, 'look'); assert.equal(R.aboard, 0); assert.equal(R.full, 0); assert.equal(R.given, 0); assert.equal(R.rocks.length, DRILL.field); checkCans(R.cans);
  assert.equal(R.drill([0, 1, 0]), null, 'nothing in the claw'); assert.equal(R.letGo(), false);
  const first = R.rocks[2]; assert.equal(R.pick(first.id), first); assert.equal(R.stage, 'ask'); assert.equal(R.pick(R.rocks[0].id), null, 'one rock at a time');
  // the question is over, however it was answered: the rock is exactly as it was
  const before = JSON.stringify(first);
  assert.equal(R.asked.length, 0, 'it takes no answer'); assert.equal(R.asked(), true); assert.equal(R.stage, 'drill'); assert.equal(JSON.stringify(first), before);
  const h = R.drill(bestHole(first).dir); assert.ok(h.took > 0 && near(R.aboard, h.took)); assert.equal(h.rock, first); assert.deepEqual(h.stays, {});
  assert.deepEqual([...new Set(R.cans.filter((c) => c.metal).map((c) => c.metal))].sort(), Object.keys(h.by).sort(), 'canisters for the metals the first hole found, and no others'); assert.ok(R.given >= Object.keys(h.by).length);
  assert.equal(R.letGo(), true); assert.equal(R.stage, 'look'); assert.equal(R.held, null);
  assert.ok(!R.rocks.includes(first), 'a rock worked is gone'); assert.equal(R.rocks.length, DRILL.field - 1, 'and no other is put in its place');
  // the last hole crumbles the rock, and the run is back to looking
  const second = R.rocks[0]; R.pick(second.id); R.asked();
  let last = null; while (R.stage === 'drill') last = R.drill(randDir(seed(R.stats.holes + 4)));
  assert.ok(last.broke || last.done); if (!last.done) { assert.equal(R.stage, 'look'); assert.ok(!R.rocks.includes(second)); }
  assert.equal(R.stats.rocks, 2);
  // two runs alike but for the rocks' questions (asked at once, or put away a while): the same canisters
  const play = (wait) => { const X = makeRun({ rand: seed(21) }), pick = seed(5); let g = 0; while (!X.done && g++ < 300) { if (X.stage === 'look') { X.pick(X.rocks[Math.floor(pick() * X.rocks.length)].id); if (wait) X.asked(); else X.asked(); } X.drill(bestHole(X.held).dir); } return X.cans; };
  assert.deepEqual(play(true), play(false));
  // a driller who only ever lets rocks go uses the field up, and there is always more of it
  const B = makeRun({ rand: seed(2) }); let g = 0;
  while (g++ < 400) { B.pick(B.rocks[0].id); B.asked(); B.letGo(); assert.ok(B.rocks.length >= 7, 'more rocks further out'); }
  assert.equal(B.aboard, 0); assert.equal(B.canHome(), false, 'nothing aboard: nothing to head home with'); assert.equal(B.home(), false); assert.equal(B.stage, 'look');
});

test('the run is over by itself when all eight canisters are full: every bit drilled is aboard, exactly, and nothing is rounded', () => {
  let rocks = 0; const N = 30;
  for (let s = 1; s <= N; s++) {
    const took = {};
    const R = playRun(s, { each(X, h, rock, before) {
      // metal by metal: what left the rock is what came aboard, in whole hundredths of a tonne; what stayed is still in it
      const after = oreBy(rock);
      for (const m of Object.keys(before)) assert.ok(near(before[m] - (after[m] || 0), h.by[m] || 0, 1e-9), `seed ${s}: ${m}`);
      for (const [m, t] of Object.entries(h.by)) { took[m] = (took[m] || 0) + t; assert.ok(near(t * 100, Math.round(t * 100), 1e-6)); }
      checkCans(X.cans, `seed ${s}`);
      for (const c of X.cans) assert.ok(near(c.t * 100, Math.round(c.t * 100), 1e-6), `seed ${s}: a level of ${c.t}`);
      const st = X.store(); assert.deepEqual(Object.keys(st).sort(), Object.keys(took).sort()); for (const m of Object.keys(took)) assert.ok(near(st[m], took[m], 1e-6), `seed ${s}: ${m}`);
      assert.ok(near(X.aboard, sumOf(st), 1e-6)); assert.equal(X.full, X.cans.filter((c) => c.t === 1).length); assert.equal(X.sells(), sellsFor(st).pay);
      assert.equal(h.done, X.cans.every((c) => c.t === 1)); assert.equal(X.stage === 'full', h.done);
    } });
    // all eight full: each a tonne of one metal, so the store is whole tonnes of each, eight in all
    assert.equal(R.stage, 'full', `seed ${s}`); assert.equal(R.done, true); assert.equal(R.early, false); assert.equal(R.aboard, 8); assert.equal(R.full, 8); assert.equal(R.given, 8);
    for (const c of R.cans) assert.ok(NAMES.includes(c.metal) && c.t === 1);
    const st = R.store(); assert.equal(sumOf(st), 8); for (const t of Object.values(st)) assert.ok(Number.isInteger(t) && t >= 1);
    assert.deepEqual(R.load(), { store: st, cans: R.cans }); assert.notEqual(R.load().cans, R.cans);
    assert.equal(R.drill([0, 1, 0]), null, 'full is full'); assert.equal(R.canHome(), false); assert.equal(R.home(), false, 'and there is no heading home early from a full load');
    rocks += R.stats.rocks;
  }
  assert.ok(rocks / N >= 3 && rocks / N <= 30, `rocks worked to fill all eight: ${rocks / N}`);
});

test('heading home early: each part-full canister is rounded to the nearest 1/8 of a tonne, and that rounded load is what comes home', () => {
  // full ones stay full; 0.43 is nearest 3/8; 0.06 rounds to nothing (the canister comes home empty, no metal's);
  // 0.07 to 1/8; 0.94 to a full one; a half stays a half; 0.19 to 1/4
  assert.deepEqual(roundCans(C8([['iron', 1], ['iron', 0.43], ['nickel', 0.06], ['copper', 0.07], ['gold', 0.94], ['cobalt', 0.5], [null, 0], ['titanium', 0.19]])),
    C8([['iron', 1], ['iron', 0.375], [null, 0], ['copper', 0.125], ['gold', 1], ['cobalt', 0.5], [null, 0], ['titanium', 0.25]]));
  assert.equal(DRILL.eighths, 8);
  for (let h = 0; h <= 100; h++) { const [c] = roundCans([{ metal: 'iron', t: h / 100 }]); assert.ok(near(c.t * 8, Math.round(c.t * 8)) && Math.abs(c.t - h / 100) <= 1 / 16 + 1e-9, `${h} hundredths -> ${c.t}`); }
  let early = 0, parted = 0;
  for (let s = 1; s <= 60; s++) for (const rocks of [1, 2, 4]) {
    // (a few rocks, then home; the canisters as they were at that moment are kept to compare)
    let was = null;
    const R = playRun(s, { rocks, each(X) { was = X.cans.map((c) => ({ ...c })); } });
    if (R.stage === 'full') continue;
    early++; assert.equal(R.stage, 'home'); assert.equal(R.early, true); assert.equal(R.done, true);
    R.cans.forEach((c, i) => {
      const b = was[i];
      if (b.t === 1) assert.deepEqual(c, b, 'a full canister is not touched');
      assert.ok(near(c.t * 8, Math.round(c.t * 8), 1e-9), `seed ${s}: a level of ${c.t}`); assert.ok(Math.abs(c.t - b.t) <= 1 / 16 + 1e-9, `seed ${s}: ${b.t} -> ${c.t}`);
      assert.equal(c.t, Math.round(b.t * 8) / 8, `seed ${s}: ${b.t} to the nearest eighth`); assert.equal(c.metal, c.t > 0 ? b.metal : null);
      if (b.t > 0 && b.t < 1) parted++;
    });
    checkCans(R.cans, `seed ${s}`);
    // the rounded load is what comes home and what is sold: each metal's tonnes, in eighths, times its price, added up
    const { store, cans } = R.load(), by = {}; for (const c of cans) if (c.metal) by[c.metal] = (by[c.metal] || 0) + c.t;
    assert.deepEqual(Object.fromEntries(Object.entries(store).sort()), Object.fromEntries(Object.entries(by).sort()));
    for (const t of Object.values(store)) assert.ok(near(t * 8, Math.round(t * 8), 1e-9) && t > 0);
    const plain = Object.entries(store).reduce((a, [m, t]) => a + t * priceOf(m), 0);
    assert.equal(R.sells(), plain); assert.equal(sellsFor(store).pay, plain); assert.ok(Number.isInteger(plain / 125), `seed ${s}: ${plain}`);
    // the run is over: no more drilling, no second rounding
    assert.equal(R.pick(R.rocks[0].id), null); assert.equal(R.drill([0, 1, 0]), null); assert.equal(R.home(), false); assert.deepEqual(R.load().cans, cans);
  }
  assert.ok(early > 100 && parted > 150, `${early} runs headed home early, ${parted} part-full canisters rounded`);
  // with a rock in the claw too: it is let be, and the run is over
  const R = makeRun({ rand: seed(9) }), rock = R.rocks[0]; R.pick(rock.id); R.asked(); R.drill(bestHole(rock).dir);
  assert.equal(R.canHome(), R.cans.some((c) => c.t >= 0.07)); if (R.canHome()) { assert.equal(R.home(), true); assert.equal(R.stage, 'home'); assert.equal(R.letGo(), false); }
  // under a sixteenth of a tonne aboard rounds to nothing: there is nothing to head home with yet
  const T = makeRun({ rand: seed(9) }); T.cans[0] = { metal: 'iron', t: 0.06 }; assert.equal(T.canHome(), false); assert.equal(T.home(), false); assert.equal(T.stage, 'look');
  T.cans[0].t = 0.07; assert.equal(T.canHome(), true);
});

test('the captain\'s own driller works the same game by the same rules: all eight canisters full, one metal to each, an ordinary mixed load', () => {
  const sold = [];
  for (let s = 1; s <= 200; s++) {
    const { store, cans } = crewLoad(seed(s));
    checkCans(cans, `seed ${s}`); for (const c of cans) assert.ok(NAMES.includes(c.metal) && c.t === 1, `seed ${s}: ${JSON.stringify(c)}`);
    assert.equal(sumOf(store), 8, `seed ${s}`); for (const [m, t] of Object.entries(store)) { assert.ok(NAMES.includes(m) && Number.isInteger(t)); assert.equal(t, cans.filter((c) => c.metal === m).length); }
    sold.push(sellsFor(store).pay);
  }
  const mean = sold.reduce((a, b) => a + b, 0) / sold.length;
  // an ordinary mixed load of eight tonnes sells for about 24,000 to 27,000 credits, as it did while the canisters
  // filled as one store (25,800 then; the prices are as they were, and whether they should come down is the game's
  // maker's to say: src/jobs/smelter.js PRICE_TIMES)
  assert.ok(mean >= 24000 && mean <= 27000, `an ordinary load sells for ${Math.round(mean)}`);
  assert.ok(Math.min(...sold) >= HOLD * priceOf('iron') && Math.max(...sold) <= HOLD * priceOf('gold'));
  for (const x of sold) assert.ok(Number.isInteger(x / 1000), 'whole canisters sell for whole thousands');
  assert.ok(new Set(sold).size > 15, 'loads differ');
});

// ── the money ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('choosing well is worth it: a driller who goes for the dear metals brings home visibly more than one who takes any rock', () => {
  // (eight rocks each, then home with what is aboard)
  let any = 0, choosy = 0; const N = 120;
  for (let s = 1; s <= N; s++) { any += playRun(s, { rocks: 8, choose: (six) => six[0] }).sells(); choosy += playRun(s, { rocks: 8, choose: (six) => [...six].sort((a, b) => rockSells(b) - rockSells(a))[0] }).sells(); }
  assert.ok(choosy / any > 1.12 && choosy / any < 2, `choosy ${Math.round(choosy / N)} against ${Math.round(any / N)}`);
});

test('home from a run at the drill: the load is one haul on every slip, the payout is each metal\'s tonnes times its price added up, and the smelter\'s slip about it tells the same amounts', () => {
  const live = (round) => ({ round, canisters: CARRIES, phase: 'unload', onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 1, percent: 30 }, { socket: 2, percent: 90 }], drained: 1, onRack: 8, carried: 0,
    steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 } });
  const M = smelter.makers, rand = seeded(17); let fullRuns = 0, earlyRuns = 0, fracs = 0;
  // (runs played until all eight are full, and runs that head home after one, two or three rocks)
  for (let s = 1; s <= 16; s++) for (const rocks of [Infinity, 1, 2, 3]) {
    const roles = [['drill'], ['pilot', 'drill'], ['pilot', 'drill', 'engineer']][s % 3], n = 20 + s; forget(); flownHaul(n, null);
    const R = playRun(s, { rocks }), { store } = R.load(), crew = crewOf(); crew.mission = { id: 'mining', captain: 'ruiz', roles, state: 'signed', signed: 1 };
    const full = R.stage === 'full', total = Math.round(sumOf(store) * 1000) / 1000; if (full) fullRuns++; else earlyRuns++;
    const P = MS.land(crew, { n, store }), H = haulOf(n), why0 = `seed ${s}, ${rocks} rocks: ${JSON.stringify(store)}`;
    // the haul's facts are the load: the tonnes of each metal in the Miner's eight canisters
    assert.equal(H.flown, true); assert.deepEqual(H.store, store); assert.equal(H.tonnes, total); assert.equal(H.canisters, 8); if (full) assert.equal(H.tonnes, 8);
    for (const gone of ['ore', 'fill', 'yield', 'oreTonnes', 'metal10']) assert.ok(!(gone in H), `a haul has no ${gone}`);
    // THE PAYOUT IS THE PLAIN SUM: each metal's tonnes times what a tonne of it sells for, added up; and the share of it
    const plain = Object.entries(store).reduce((a, [m, t]) => a + t * priceOf(m), 0);
    assert.equal(H.pay, plain, why0); assert.equal(P.sold, plain); assert.equal(P.tonnes, total); assert.equal(P.share, MS.shareOf(roles)); assert.equal(P.pay, Math.round(plain * MS.shareOf(roles) / 100));
    assert.deepEqual(P.lots.map((L) => [L.metal, L.tonnes]).sort(), Object.entries(store).sort()); for (const L of P.lots) { assert.equal(L.price, priceOf(L.metal)); assert.equal(L.pay, L.tonnes * L.price); assert.ok(Number.isInteger(L.pay)); }
    assert.equal(P.lots.reduce((a, L) => a + L.pay, 0), P.sold);
    // THE PAYOUT SLIP: a row for each metal, its tonnes times its price; an eighth is a fraction, never 0.125
    const rows = MS.payoutLines(P);
    P.lots.forEach((L, i) => {
      assert.equal(rows[i][1], `${eighthsText(L.tonnes)} ${L.tonnes <= 1 ? 'tonne' : 'tonnes'} × ${L.price.toLocaleString('en-US')} = ${L.pay.toLocaleString('en-US')}`);
      assert.ok(!/\d\.\d/.test(rows[i][1]), rows[i][1]); if (!Number.isInteger(L.tonnes)) { fracs++; assert.ok(/\d\/[248] tonnes? ×/.test(rows[i][1]), rows[i][1]); }
    });
    assert.ok(!/\d\.\d/.test(lotsWords(P.lots)), lotsWords(P.lots));
    // THE SMELTER'S SLIP about this haul reads by the same pattern (each metal's tonnes at its price, added up), its
    // amounts exactly as they came home, and its answer is what the payout says the haul sold for; once at each rung
    for (const step of [2, 3]) {
      const o = M.pay.make(step, { rand, live: live(n) }), f = o.facts, why = `${why0} at step ${step}: ${o.story}`;
      assert.equal(f.from, 'Your crew\'s haul'); assert.equal(f.mine, true); assert.equal(f.haul, n); assert.equal(f.ans, P.sold); assert.equal(rightOf(o), P.sold, why);
      assert.deepEqual(Object.fromEntries(f.load.parts.map((p) => [p.metal, p.amt])), store, why); assert.equal(f.load.total, total);
      for (let i = 1; i < f.load.parts.length; i++) assert.ok(f.load.parts[i].amt <= f.load.parts[i - 1].amt, 'the most first');
      assert.equal(o.coins.filter((c) => c.good).length, 1); assert.ok(o.coins.length >= 3, why); assert.ok(!/NaN|undefined/.test(JSON.stringify(o)));
      // nothing is told round any more, and nothing says "about"
      const text = `${o.story} ${o.ask} ${o.lines.flat().join(' ')} ${o.coins.map((c) => `${c.label} ${c.why}`).join(' ')} ${o.rightWhy} ${o.help.line}`;
      assert.ok(!/about/i.test(text), text); assert.equal(o.ask, 'What is the total sale price?');
      // tonnes only, by the chart of what a tonne sells for; no canisters; an eighth as a fraction
      assert.ok(/tonne/.test(text) && !/canister|slag|yield|\d\.\d/.test(text), text); assert.equal(o.chart.title, 'A tonne sells for');
      assert.ok(o.story.startsWith('Your crew came home with ') && o.story.includes(tonnesWords(f.load.parts[0].amt, true)), o.story);
      assert.deepEqual(o.lines.slice(0, -1).map(([k, v]) => [k.toLowerCase(), v]), f.load.parts.map((p) => [p.metal, tonnesWords(p.amt, true)])); assert.deepEqual(o.lines[o.lines.length - 1], ['Sold for', '?']);
      // its sums are whole-number sums that end on the answer: a part of a tonne is what one part sells for, then so many of them
      const chain = o.sum.chain || [o.sum]; for (const x of chain) assert.ok(Number.isInteger(x.a) && Number.isInteger(x.b), `${why}: ${JSON.stringify(x)}`);
      const end = chain[chain.length - 1], ends = end.op === 'add' ? end.a + end.b : end.op === 'mul' ? end.a * end.b : end.a / end.b; assert.equal(ends, P.sold, why);
      assert.notEqual(M.pay.make(step, { rand, live: live(n) }).facts.mine, true, 'once a haul at each rung: then slips from the log');
    }
    // the slips that ask a share of the haul in the hangar are from the log (its shares need not be quarters of the load)
    for (const o of [M.each.make(1, { rand, live: live(n) }), M.part.make(1, { rand, live: live(n) }), M.part.make(2, { rand, live: live(n) })]) assert.equal(o.facts.live, false, o.story);
    // a haul that did not come home with all eight full is not said to have: the slip that counts the canisters "still
    // on the Miner" of 8 full ones is from the log
    if (H.tonnes < 8) for (let k = 0; k < 6; k++) { const o = M.count.make(2, { rand, live: live(n) }); assert.notEqual(o.facts.live, true, o.story); }
    // collected: the credits are up by exactly the share
    crew.credits = 500; const got = MS.collect(crew); assert.deepEqual(got, { pay: P.pay, credits: 500 + P.pay });
    flownHaul(n, null);
  }
  assert.ok(fullRuns >= 16 && earlyRuns >= 30 && fracs >= 30, `${fullRuns} full runs, ${earlyRuns} early ones, ${fracs} rows with a part of a tonne`);
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
