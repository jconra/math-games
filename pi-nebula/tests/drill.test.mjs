// The drill operator's game (src/drill.js: a rock's ore, what a hole takes, the holes it stands, the field's mix of
// metals, the canisters and the metal each is sold as, the rich rock), the haul and each share for every mix of roles
// (src/missions.js), the smelter's slips about a sorted haul agreeing with the payout (src/jobs/smelter.js), and every
// level of the drill operator's ladder (src/jobs/drill.js).
//   node --test pi-nebula/tests/drill.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import * as MS from '../src/missions.js';
import { ROLES, MISSIONS, CREW_CLEAN, RICH } from '../src/missions.js';
import { DRILL, ORE, FIELD, USUAL, makeRock, makeField, fieldRock, makeRun, drillHole, holeWorth, bestHole, take, tune, oreLeft, oreBy, canistersOf, canPrice, loadSells, seeded as seed } from '../src/drill.js';
import { JOB as drill, SHARE } from '../src/jobs/drill.js';
import { JOB as smelter, haulOf, flownHaul, forget, lotsWords, METALS, CARRIES, ORE_SELLS, ORE_PRICE, RICH_METAL } from '../src/jobs/smelter.js';
import { helpPicture } from '../src/jobs/pics.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PLACE } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

const crewOf = () => ({ id: 'c1', name: 'Maya', look: { id: 'zuri' } });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const num = (label) => { const s = String(label).replace(/,/g, ''), m = s.match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };
const rightOf = (o) => num(o.coins.find((c) => c.good).label);
const MINING = MISSIONS.mining;

// ── a rock ────────────────────────────────────────────────────────────────────────────────────────────────────────
test('a rock: its ore by its size and how rich it is, in veins of lumps inside it; the holes it stands', () => {
  for (const [size, S] of Object.entries(DRILL.sizes)) for (const [grade, k] of Object.entries(DRILL.grades)) {
    for (let s = 1; s <= 40; s++) {
      const r = makeRock(seed(s * 7 + size.length), { metal: 'copper', size, grade });
      assert.equal(r.size, size); assert.equal(r.grade, grade); assert.equal(r.metal, 'copper'); assert.equal(r.rich, false);
      assert.equal(r.holes, S.holes); assert.equal(r.left, S.holes); assert.equal(r.broken, false);
      assert.ok(r.ore0 >= S.ore[0] * k - 1e-9 && r.ore0 <= S.ore[1] * k + 1e-9, `${size} ${grade}: ${r.ore0}`);
      assert.ok(near(oreLeft(r), r.ore0, 1e-9), 'the lumps hold all its ore');
      const veins = new Set(r.lumps.map((L) => L.vein)).size;
      assert.ok(veins >= S.veins[0] && veins <= S.veins[1], `${size}: ${veins} veins`);
      for (const L of r.lumps) { assert.ok(Math.hypot(...L.p) <= 0.7201, 'a lump inside the rock'); assert.ok(L.ore > 0 && L.ore === L.ore0); }
    }
  }
  // small 4 holes, middling 5, big 6
  assert.deepEqual(Object.values(DRILL.sizes).map((S) => S.holes), [4, 5, 6]);
  // every metal the smelter pours has its own glow and symbol
  for (const m of METALS) { assert.match(ORE[m.name].glow, /^#[0-9a-f]{6}$/); assert.ok(ORE[m.name].sym.length === 2, m.name); }
  assert.equal(new Set(METALS.map((m) => ORE[m.name].glow)).size, METALS.length, 'no two metals glow alike');
});

test('a hole: all of a lump on its line, less and less out to its reach, nothing past it; the ore taken is gone from the rock', () => {
  assert.equal(take(0), 1); assert.equal(take(DRILL.core), 1); assert.equal(take(DRILL.reach), 0); assert.equal(take(1), 0);
  assert.ok(take(0.2) > take(0.3) && take(0.3) > 0, 'gradual, not a step');
  // one lump straight under the spot: the hole takes all of it; a hole on the far side takes none of it
  const one = () => ({ id: 1, size: 'small', holes: 4, left: 4, lumps: [{ p: [0, 0.5, 0], ore: 0.6, ore0: 0.6, vein: 0 }], ore0: 0.6, made: [], broken: false, tuned: false });
  let r = one(); assert.ok(near(holeWorth(r, [0, 1, 0]), 0.6)); assert.equal(oreLeft(r), 0.6, 'looking takes nothing');
  let h = drillHole(r, [0, 3, 0]); assert.ok(near(h.took, 0.6)); assert.equal(h.wasted, false); assert.equal(h.left, 3); assert.ok(near(oreLeft(r), 0));
  r = one(); h = drillHole(r, [0, -1, 0]); assert.equal(h.took, 0); assert.equal(h.wasted, true, 'a hole in bare rock wastes one'); assert.equal(oreLeft(r), 0.6); assert.equal(r.left, 3);
  // a lump off to the side: a part of it, by how far off
  r = one(); r.lumps[0].p = [0.2, 0.5, 0]; h = drillHole(r, [0, 1, 0]); assert.ok(near(h.took, 0.6 * take(0.2))); assert.ok(near(oreLeft(r), 0.6 - h.took));
  // the canisters' room left caps what is taken; the rest stays in the rock
  r = one(); h = drillHole(r, [0, 1, 0], 0.25); assert.ok(near(h.took, 0.25)); assert.ok(near(oreLeft(r), 0.35));
  // whatever the hole, what is taken and what is left add up
  for (let s = 1; s <= 60; s++) {
    const rand = seed(s), rock = makeRock(rand, { metal: 'iron' }), before = oreLeft(rock), got = drillHole(rock, [rand() - 0.5, rand() - 0.5, rand() - 0.5]);
    assert.ok(got.took >= 0 && near(got.took + oreLeft(rock), before, 1e-9)); assert.equal(rock.made.length, 1);
  }
});

test('a rock stands only so many holes: after the last it is broken, and no more can be drilled', () => {
  for (const size of ['small', 'medium', 'big']) {
    const rock = makeRock(seed(5), { metal: 'nickel', size }), n = DRILL.sizes[size].holes;
    for (let i = 1; i <= n; i++) { const h = drillHole(rock, [Math.sin(i), Math.cos(i), 0.3]); assert.equal(h.left, n - i); assert.equal(h.broke, i === n); }
    assert.equal(rock.broken, true); assert.equal(drillHole(rock, [0, 1, 0]), null);
  }
});

test('the scan\'s question right at the first try: every lump gives a quarter more, once; a miss changes nothing', () => {
  const a = makeRock(seed(3), { metal: 'iron' }), ore = a.ore0;
  assert.equal(tune(a, false), false); assert.ok(near(oreLeft(a), ore), 'a miss never punishes');
  assert.equal(tune(a, true), true); assert.ok(near(oreLeft(a), ore * 1.25)); assert.equal(DRILL.bonus, 1.25);
  assert.equal(tune(a, true), false, 'once'); assert.ok(near(oreLeft(a), ore * 1.25));
});

test('a smart spot beats any spot: a careful driller gets most of a rock, holes at random far less', () => {
  let careful = 0, random = 0, all = 0;
  for (let s = 1; s <= 150; s++) {
    const A = makeRock(seed(s), { metal: 'iron' }), rand = seed(s), B = makeRock(rand, { metal: 'iron' }); all += A.ore0;
    while (!A.broken) careful += drillHole(A, bestHole(A).dir).took;
    while (!B.broken) random += drillHole(B, [rand() - 0.5, rand() - 0.5, rand() - 0.5]).took;
  }
  assert.ok(careful / all > 0.85, `careful: ${(careful / all).toFixed(2)}`);
  assert.ok(random / all < 0.6 && random / all > 0.2, `at random: ${(random / all).toFixed(2)}`);
  assert.ok(careful > random * 1.6);
});

// ── the field and the run ─────────────────────────────────────────────────────────────────────────────────────────
test('a field of one metal only (the Drill Lab\'s): seven rocks in reach, each in a place of its own, all of that metal; one field in five has the rich rock', () => {
  for (let s = 1; s <= 40; s++) {
    const plain = makeField(seed(s), { metal: 'nickel' });
    assert.equal(plain.length, DRILL.field); assert.deepEqual(plain.map((r) => r.slot), [0, 1, 2, 3, 4, 5, 6]);
    assert.ok(plain.every((r) => r.metal === 'nickel' && !r.rich && !r.also), 'one metal, no streaks'); assert.ok(new Set(plain.map((r) => r.size)).size >= 2, 'something to choose between');
    assert.ok(new Set(plain.map((r) => r.grade)).size >= 2);
    const rich = makeField(seed(s), { metal: 'nickel', rich: true }), R = rich.filter((r) => r.rich);
    assert.equal(R.length, 1); assert.equal(R[0].metal, RICH_METAL); assert.equal(R[0].size, 'big'); assert.equal(R[0].grade, 'thick'); assert.notEqual(R[0].slot, 0);
    assert.ok(rich.filter((r) => !r.rich).every((r) => r.metal === 'nickel'));
    assert.ok(R[0].ore0 >= Math.max(...plain.map((r) => r.ore0)) * 0.8, 'the rich rock is a big one');
  }
  assert.equal(RICH, 0.2);
});

test('a run: pick, scan, drill, let go or break, on to the next, until the eight canisters are full', () => {
  const R = makeRun({ rand: seed(11), metal: 'copper' });
  assert.equal(R.stage, 'look'); assert.equal(R.cans, 0); assert.equal(R.full, 0); assert.equal(DRILL.cans, CARRIES);
  assert.equal(R.drill([0, 1, 0]), null, 'nothing in the claw yet'); assert.equal(R.pick(-1), null);
  const first = R.rocks[2]; assert.equal(R.pick(first.id), first); assert.equal(R.stage, 'scan'); assert.equal(R.held, first);
  assert.equal(R.pick(R.rocks[0].id), null, 'one rock at a time'); assert.equal(R.drill([0, 1, 0]), null, 'the scan first');
  assert.equal(R.scanned(true), true); assert.equal(R.stage, 'drill'); assert.equal(first.tuned, true);
  const h = R.drill(bestHole(first).dir); assert.ok(h.took > 0); assert.ok(near(R.cans, h.took)); assert.equal(R.stats.holes, 1);
  // let go early: the rock is gone, another has drifted into its place
  assert.equal(R.letGo(), true); assert.equal(R.stage, 'look'); assert.equal(R.held, null);
  assert.equal(R.rocks.length, DRILL.field); assert.ok(!R.rocks.includes(first)); assert.equal(R.rocks[2].slot, 2); assert.equal(R.rocks[2].fresh, true);
  // a rock drilled to its last hole breaks, and the run is back to looking
  const second = R.rocks[0]; R.pick(second.id); R.scanned(false);
  let last = null; while (R.stage === 'drill') last = R.drill([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
  assert.ok(last.broke || last.done); if (!last.done) { assert.equal(R.stage, 'look'); assert.ok(!R.rocks.includes(second)); }
  assert.equal(R.stats.rocks, 2); assert.equal(R.stats.tuned, 1);
});

test('every run fills its eight canisters, never more: a careful driller from a few rocks, a careless one from more', () => {
  const play = (s, careful) => {
    const rand = seed(s), R = makeRun({ rand, metal: 'iron', rich: s % 5 === 0 }); let guard = 0;
    while (R.stage !== 'full') {
      assert.ok(guard++ < 400, 'the run ends');
      if (R.stage === 'look') { R.pick((careful ? [...R.rocks].sort((a, b) => oreLeft(b) - oreLeft(a))[0] : R.rocks[Math.floor(rand() * R.rocks.length)]).id); R.scanned(careful); }
      else { const r = R.drill(careful ? bestHole(R.held).dir : [rand() - 0.5, rand() - 0.5, rand() - 0.5]); assert.ok(r.cans <= DRILL.cans + 1e-9); }
    }
    assert.equal(R.cans, DRILL.cans); assert.equal(R.full, 8); assert.equal(R.drill([0, 1, 0]), null, 'full: no more drilling');
    return R;
  };
  let a = 0, b = 0;
  for (let s = 1; s <= 60; s++) { const A = play(s, true), B = play(s, false); a += A.stats.rocks; b += B.stats.rocks; assert.ok(A.stats.rocks <= 6, `seed ${s}: ${A.stats.rocks} rocks`); assert.ok(B.stats.rocks <= 30); }
  assert.ok(a / 60 >= 2.5 && a / 60 <= 5, `careful: ${a / 60} rocks a load`);
  assert.ok(b / 60 > a / 60 * 2, `careless: ${b / 60} rocks a load`);
});

test('the rich rock: its ore is aboard only once a hole has found it', () => {
  const R = makeRun({ rand: seed(4), metal: 'copper', rich: true }), rich = R.rocks.find((r) => r.rich);
  assert.equal(R.richField, true); assert.equal(R.rich, false);
  // a plain rock first: still not a rich haul
  const plain = R.rocks.find((r) => !r.rich); R.pick(plain.id); R.scanned(false); R.drill(bestHole(plain).dir); assert.equal(R.rich, false); R.letGo();
  // a hole in the rich rock's bare side: nothing of it aboard yet
  R.pick(rich.id); R.scanned(false);
  const bare = (() => { for (let i = 0; i < 400; i++) { const d = [Math.sin(i * 1.7), Math.cos(i * 2.3), Math.sin(i * 0.9 + 1)]; if (holeWorth(rich, d) === 0) return d; } return null; })();
  if (bare) { R.drill(bare); assert.equal(R.rich, false); }
  R.drill(bestHole(rich).dir); assert.equal(R.rich, true);
  // a field without one never gives a rich haul
  const N = makeRun({ rand: seed(4), metal: 'copper' }); assert.ok(N.rocks.every((r) => !r.rich));
});

// ── the money ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('the haul and each share for every mix of roles: the drill 20%, with the pilot 30%; a rich haul double', () => {
  assert.equal(ROLES.drill.share, 20); assert.equal(ROLES.drill.ready, true); assert.equal(SHARE, ROLES.drill.share);
  assert.equal(CREW_CLEAN, 2, 'the crew\'s own pilot: the middle haul');
  // the drill alone (the crew's pilot flies): 6 tonnes of ore, 18,000 credits, 3,600 of it the crew member's
  const d = MS.forecast({ clean: CREW_CLEAN, roles: ['drill'] });
  assert.deepEqual([d.oreTonnes, d.sold, d.share, d.pay], [6, 18000, 20, 3600]);
  assert.equal(MS.forecast({ clean: CREW_CLEAN, rich: true, roles: ['drill'] }).pay, 7200);
  // the pilot and the drill: by the jump's green lamps
  assert.deepEqual([1, 2, 3].map((c) => MS.forecast({ clean: c, roles: ['pilot', 'drill'] }).pay), [4500, 5400, 6300]);
  assert.deepEqual([1, 2, 3].map((c) => MS.forecast({ clean: c, rich: true, roles: ['pilot', 'drill'] }).pay), [9000, 10800, 12600]);
  // the pilot alone, as before
  assert.deepEqual([1, 2, 3].map((c) => MS.forecast({ clean: c, roles: ['pilot'] }).pay), [1500, 1800, 2100]);
  // counting one rich haul in five: the drill alone about 4,300 a run, the two together about 6,500; all three roles
  // (when the engineer's game is made) about the 8,300 the game's maker asked for a ten minute run
  const mean = (roles, c) => (1 - RICH) * MS.forecast({ clean: c, roles }).pay + RICH * MS.forecast({ clean: c, rich: true, roles }).pay;
  assert.ok(near(mean(['drill'], 2), 4320)); assert.ok(near(mean(['pilot', 'drill'], 2), 6480));
  assert.ok(MS.forecast({ clean: 1, roles: MINING.roles }).pay <= 8300 && MS.forecast({ clean: 3, roles: MINING.roles }).pay >= 8300);
  // a share is always the same part of the same haul, whoever holds it: the parts add up
  for (const c of [0, 1, 2, 3]) for (const rich of [false, true]) {
    const each = MINING.roles.map((id) => MS.forecast({ clean: c, rich, roles: [id] }).pay);
    assert.equal(each.reduce((x, y) => x + y, 0), MS.forecast({ clean: c, rich, roles: MINING.roles }).pay);
    assert.equal(MS.forecast({ clean: c, rich, roles: ['pilot', 'drill'] }).pay, each[0] + each[1]);
  }
});

// ── the field's mix, the canisters, the money of a sorted haul ─────────────────────────────────────────────────────
const LOADS = {
  copper: Array(8).fill('copper'),
  careless: ['copper', 'nickel', 'nickel', 'iron', 'iron', 'iron', 'iron', 'iron'],
  choosy: ['gold', 'cobalt', 'cobalt', 'copper', 'copper', 'copper', 'nickel', 'nickel'],
  lucky: ['titanium', 'titanium', 'titanium', 'cobalt', 'copper', 'copper', 'iron', 'iron'],
  every: ['gold', 'titanium', 'cobalt', 'copper', 'nickel', 'iron', 'iron', 'iron'],
};

test('a field is a mix of metals: the dearer the metal, the rarer its rocks and the less ore in them; each with its glow and tag', () => {
  assert.deepEqual(USUAL, ['iron', 'nickel', 'copper', 'cobalt', 'gold']); assert.ok(!USUAL.includes(RICH_METAL), 'titanium is the rich rock\'s alone');
  assert.equal(USUAL.reduce((n, m) => n + FIELD[m].often, 0), 100);
  for (let i = 1; i < USUAL.length; i++) { assert.ok(FIELD[USUAL[i]].often < FIELD[USUAL[i - 1]].often, 'rarer'); assert.ok(ORE_PRICE[USUAL[i]] > ORE_PRICE[USUAL[i - 1]], 'dearer'); }
  assert.deepEqual(FIELD.gold.sizes, ['small']); assert.ok(!FIELD.gold.grades.includes('thick') && !FIELD.cobalt.grades.includes('thick') && !FIELD.cobalt.sizes.includes('big'));
  const count = {}, ore = {}; let streaks = 0, all = 0;
  for (let s = 1; s <= 600; s++) {
    const F = makeField(seed(s)), kinds = {};
    assert.equal(F.length, DRILL.field); assert.deepEqual(F.map((r) => r.slot), [0, 1, 2, 3, 4, 5, 6]);
    for (const r of F) {
      all++; kinds[r.metal] = (kinds[r.metal] || 0) + 1; count[r.metal] = (count[r.metal] || 0) + 1; ore[r.metal] = (ore[r.metal] || 0) + r.ore0;
      assert.ok(USUAL.includes(r.metal) && !r.rich); assert.ok(FIELD[r.metal].sizes.includes(r.size) && FIELD[r.metal].grades.includes(r.grade), `${r.metal}: ${r.size} ${r.grade}`);
      assert.ok(ORE[r.metal].glow && ORE[r.metal].sym);
      // every lump is the rock's own metal, or its streak's; the streak a short vein of a DEARER metal, a third to half a canister
      const by = oreBy(r);
      if (r.also) {
        streaks++; assert.ok(ORE_PRICE[r.also] > ORE_PRICE[r.metal], `${r.metal} + ${r.also}`); assert.deepEqual(Object.keys(by).sort(), [r.also, r.metal].sort());
        assert.ok(by[r.also] >= DRILL.streak.ore[0] - 1e-9 && by[r.also] <= DRILL.streak.ore[1] + 1e-9); assert.ok(by[r.metal] > by[r.also] * 0.9 || r.size === 'small');
        const mine = r.lumps.filter((L) => L.metal === r.also); assert.ok(mine.length >= 3 && mine.length <= 4); assert.equal(new Set(mine.map((L) => L.vein)).size, 1);
      } else assert.deepEqual(Object.keys(by), [r.metal]);
      assert.ok(near(oreLeft(r), r.ore0));
    }
    // something to choose between: three metals or more, never more than three rocks of one, something dearer than nickel
    assert.ok(Object.keys(kinds).length >= 3, `field ${s}: ${JSON.stringify(kinds)}`); assert.ok(Math.max(...Object.values(kinds)) <= 3);
    assert.ok(F.some((r) => ORE_PRICE[r.metal] > ORE_PRICE.nickel));
  }
  // how often, and how much: iron the commonest and the biggest, gold the rarest and the least
  const share = USUAL.map((m) => 100 * count[m] / all), each = USUAL.map((m) => ore[m] / count[m]);
  for (let i = 1; i < USUAL.length; i++) { assert.ok(share[i] < share[i - 1], `${USUAL[i]}: ${share[i].toFixed(1)} of 100`); assert.ok(each[i] < each[i - 1] + 1e-9, `${USUAL[i]}: ${each[i].toFixed(2)} canisters a rock`); }
  assert.ok(share[4] >= 4 && share[4] <= 12, `gold: ${share[4]}`); assert.ok(each[4] < 1 && each[0] > 1.5);
  assert.ok(streaks / all > 0.17 && streaks / all < 0.3, `streaks: ${(streaks / all).toFixed(2)}`);
  // the rich rock: one of the seven, titanium, big and thick, no streak; a rock that drifts in is a usual one
  for (let s = 1; s <= 40; s++) {
    const F = makeField(seed(s), { rich: true }), R = F.filter((r) => r.rich);
    assert.equal(R.length, 1); assert.deepEqual([R[0].metal, R[0].size, R[0].grade, R[0].also], [RICH_METAL, 'big', 'thick', null]); assert.notEqual(R[0].slot, 0);
    assert.ok(F.filter((r) => !r.rich).every((r) => USUAL.includes(r.metal)));
    const next = fieldRock(seed(s)); assert.ok(USUAL.includes(next.metal) && !next.rich);
  }
  assert.equal(fieldRock(seed(3), { metal: 'gold' }).also, null, 'nothing is dearer than gold');
});

test('a hole takes whatever lies near its line, metal by metal; the drill sorts it, and a canister is sold as the metal there is most of in it', () => {
  // an iron rock with a streak of gold: a hole down the streak brings gold, a hole elsewhere iron
  let seen = 0;
  for (let s = 1; s <= 80 && seen < 12; s++) {
    const rock = makeRock(seed(s), { metal: 'iron', size: 'big', grade: 'fair', also: 'gold' }), gold = rock.lumps.filter((L) => L.metal === 'gold');
    assert.equal(rock.also, 'gold'); assert.ok(gold.length >= 3);
    const before = oreBy(rock), h = drillHole(rock, gold[1].p), after = oreBy(rock);
    assert.ok(near(Object.values(h.by).reduce((a, b) => a + b, 0), h.took), 'the parts add up to what the hole took');
    assert.ok(h.by.gold > 0, 'the hole down the streak brings gold'); for (const m of ['iron', 'gold']) assert.ok(near((before[m] || 0) - (after[m] || 0), h.by[m] || 0, 1e-9));
    seen++;
  }
  // the canisters, from the ore aboard: dearest first along the row, each sold as the most of what is in it
  const none = canistersOf({}); assert.equal(none.length, DRILL.cans); assert.ok(none.every((c) => c.fill === 0 && c.metal === null));
  let row = canistersOf({ copper: 2.6, gold: 0.7, iron: 1.2 });
  assert.deepEqual(row.map((c) => c.metal), ['gold', 'copper', 'copper', 'iron', 'iron', null, null, null]);   // (the fourth: 0.3 of copper under 0.7 of iron)
  assert.ok(near(row[0].fill, 1) && near(row[4].fill, 0.5)); assert.deepEqual(row[0].parts.map(([m]) => m), ['gold', 'copper']);
  assert.ok(near(row.reduce((n, c) => n + c.fill, 0), 4.5), 'nothing lost, nothing made');
  // half a canister or more of a metal makes a canister of it; less is lost in its neighbour; even shares go to the dearer
  assert.deepEqual(canistersOf({ gold: 0.4, iron: 7.6 }).map((c) => c.metal), Array(8).fill('iron'));
  assert.deepEqual(canistersOf({ gold: 0.6, iron: 7.4 }).map((c) => c.metal), ['gold', ...Array(7).fill('iron')]);
  assert.deepEqual(canistersOf({ gold: 0.5, iron: 7.5 }).map((c) => c.metal), ['gold', ...Array(7).fill('iron')]);
  assert.deepEqual(canistersOf({ titanium: 3, cobalt: 1, gold: 1, iron: 3 }).map((c) => c.metal), ['gold', 'titanium', 'titanium', 'titanium', 'cobalt', 'iron', 'iron', 'iron']);
  // whole runs: the ore aboard metal by metal is what the holes took, and the load is eight canisters of metals drilled
  for (let s = 1; s <= 60; s++) {
    const rand = seed(s), R = makeRun({ rand, rich: s % 5 === 0 }), took = {}; let guard = 0;
    assert.equal(R.metal, null, 'a mix');
    while (R.stage !== 'full') {
      assert.ok(guard++ < 500);
      if (R.stage === 'look') { R.pick(R.rocks[Math.floor(rand() * R.rocks.length)].id); R.scanned(s % 2 === 0); continue; }
      const h = R.drill(s % 3 ? bestHole(R.held).dir : [rand() - 0.5, rand() - 0.5, rand() - 0.5]);
      for (const [m, t] of Object.entries(h.by)) took[m] = (took[m] || 0) + t;
      assert.ok(near(Object.values(R.ore).reduce((a, b) => a + b, 0), R.cans, 1e-6));
      assert.equal(R.row().filter((c) => c.fill >= 1 - 1e-6).length, R.full);
    }
    const load = R.load(); assert.equal(load.length, CARRIES); assert.ok(load.every((m) => ORE_PRICE[m] && took[m] > 0), `seed ${s}: ${load}`);
    for (const m of Object.keys(took)) { const n = load.filter((x) => x === m).length; assert.ok(Math.abs(n - took[m]) < 1.02, `seed ${s}: ${n} canisters of ${m} from ${took[m].toFixed(2)}`); if (took[m] >= 1.01) assert.ok(n >= 1); }
    assert.equal(load.includes(RICH_METAL) ? R.rich : true, true);
  }
});

test('a sorted haul sells for what is in it: a canister of each metal its own price, and each share for every mix of roles a share of that', () => {
  assert.deepEqual(ORE_PRICE, { iron: 1600, nickel: 2400, copper: 3200, cobalt: 4000, titanium: 6000, gold: 8000 });
  // a canister of 5/8, 3/4 or 7/8 of a tonne of ore: a round number of hundreds (titanium: of fifties)
  assert.deepEqual(['iron', 'nickel', 'copper', 'cobalt', 'titanium', 'gold'].map((m) => canPrice(m, [3, 4])), [1200, 1800, 2400, 3000, 4500, 6000]);
  for (const ore of [[5, 8], [3, 4], [7, 8]]) for (const m of Object.keys(ORE_PRICE)) assert.equal(canPrice(m, ore) % (m === RICH_METAL ? 50 : 100), 0, `${m} ${ore}`);
  const SOLD = { copper: 19200, careless: 12000, choosy: 22800, lucky: 23700, every: 21300 };      // (the crew's own pilot: 3/4 of a tonne a canister)
  for (const [name, load] of Object.entries(LOADS)) {
    assert.equal(loadSells(load, [3, 4]), SOLD[name], name);
    for (const clean of [0, 1, 2, 3]) {
      const [a, d] = MS.oreFor(clean), sold = load.reduce((sum, m) => sum + ORE_PRICE[m] * a / d, 0);
      assert.ok(Number.isInteger(sold) && sold % 50 === 0);
      const each = MINING.roles.map((id) => MS.forecastLoad({ clean, load, roles: [id] }));
      for (const [i, id] of MINING.roles.entries()) { assert.equal(each[i].sold, sold); assert.equal(each[i].pay, sold * ROLES[id].share / 100); assert.ok(Number.isInteger(each[i].pay), `${name}: ${id} ${each[i].pay}`); }
      // the parts add up, whoever holds them
      assert.equal(MS.forecastLoad({ clean, load, roles: MINING.roles }).pay, each.reduce((n, x) => n + x.pay, 0));
      assert.equal(MS.forecastLoad({ clean, load, roles: ['pilot', 'drill'] }).pay, each[0].pay + each[1].pay);
    }
  }
  // the drill alone (20%): a careless load 2,400, a choosy one 4,560, against the crew's own ordinary haul's 3,600
  assert.deepEqual(['careless', 'choosy', 'copper'].map((k) => MS.forecastLoad({ clean: CREW_CLEAN, load: LOADS[k], roles: ['drill'] }).pay), [2400, 4560, 3840]);
  assert.equal(MS.forecast({ clean: CREW_CLEAN, roles: ['drill'] }).pay, 3600);
});

test('choosing changes the pay: over many fields a choosy driller earns visibly more than a careless one, not several times more', () => {
  const play = (s, pick, rich = false) => {
    const rand = seed(s * 13 + 5), R = makeRun({ rand, rich }); let guard = 0;
    while (R.stage !== 'full') {
      assert.ok(guard++ < 600);
      if (R.stage === 'look') { R.pick(pick(R, rand).id); R.scanned(true); continue; }
      const b = bestHole(R.held); if (b.worth < 0.06) R.letGo(); else R.drill(b.dir);
    }
    return { sold: loadSells(R.load(), MS.oreFor(CREW_CLEAN)), rocks: R.stats.rocks };
  };
  const any = (R, rand) => R.rocks[Math.floor(rand() * R.rocks.length)], big = (R) => [...R.rocks].sort((a, b) => oreLeft(b) - oreLeft(a))[0];
  const dear = (R) => [...R.rocks].sort((a, b) => ORE_PRICE[b.metal] - ORE_PRICE[a.metal] || oreLeft(b) - oreLeft(a))[0];
  const mean = (pick, rich) => { let sold = 0, rocks = 0; const n = 150; for (let s = 1; s <= n; s++) { const r = play(s, pick, rich); sold += r.sold; rocks += r.rocks; } return { pay: sold / n * SHARE / 100, rocks: rocks / n }; };
  const A = mean(any), B = mean(big), C = mean(dear);
  // the drill's 20%, the crew's own pilot flying: about 3,400 for any rock, 2,900 for the biggest glow, 4,700 for the dearest in reach
  assert.ok(A.pay > 2900 && A.pay < 3900, `any rock: ${A.pay}`); assert.ok(B.pay > 2500 && B.pay < 3400, `the biggest glow: ${B.pay}`); assert.ok(C.pay > 4200 && C.pay < 5300, `the dearest: ${C.pay}`);
  assert.ok(C.pay > B.pay * 1.3 && C.pay < B.pay * 2.2, 'visibly more, not several times more');
  // ... and the dear rocks are small: the choosy load takes more rocks than the biggest glows do
  assert.ok(C.rocks > B.rocks + 1, `${C.rocks} rocks against ${B.rocks}`);
  // a field with the rich rock, worked first: about four canisters of titanium, and a load worth more than any usual way of choosing
  const L = mean((R) => R.rocks.find((r) => r.rich) || dear(R), true);
  assert.ok(L.pay > C.pay * 1.15 && L.pay < C.pay * 1.6, `the lucky field: ${L.pay}`);
});

test('the rich rock\'s rule: its own canisters pay double, and only those', () => {
  for (const ore of [[5, 8], [3, 4], [7, 8]]) {
    assert.equal(canPrice(RICH_METAL, ore), 2 * ORE_SELLS * ore[0] / ore[1], 'a canister of titanium: twice a canister of a usual haul\'s ore');
    // swap canisters of the load for titanium, one by one: each adds its own price and changes no other
    for (let k = 0; k <= 4; k++) {
      const load = [...Array(k).fill(RICH_METAL), ...LOADS.careless.slice(k)], plain = LOADS.careless.slice(k);
      assert.equal(loadSells(load, ore), k * canPrice(RICH_METAL, ore) + loadSells(plain, ore));
    }
  }
  // a haul is called a rich one when titanium is in its canisters, and never otherwise
  flownHaul(71, null); flownHaul(71, { ore: [3, 4], load: LOADS.lucky }); assert.equal(haulOf(71).rich, true);
  flownHaul(71, { ore: [3, 4], load: LOADS.choosy, rich: true }); assert.equal(haulOf(71).rich, false, 'the field had one, but none of it came home');
  // a crew's own haul from a rich rock (the crew member did not drill): all titanium, the whole of it double, as it always was
  flownHaul(71, { ore: [3, 4], rich: true }); const H = haulOf(71); assert.equal(H.mix, undefined); assert.equal(H.metal.name, RICH_METAL); assert.equal(H.pay, 2 * H.oreTonnes * ORE_SELLS);
  assert.equal(H.pay, loadSells(Array(8).fill(RICH_METAL), [3, 4]), 'the same as eight canisters of titanium drilled');
  flownHaul(71, null);
  assert.throws(() => flownHaul(71, { ore: [3, 4], load: ['iron'] }), /canisters/); assert.throws(() => flownHaul(71, { ore: [3, 4], load: Array(8).fill('cheese') }), /canisters/);
  assert.equal(flownHaul(71), null);
});

test('home from a run at the drill: the sorted haul is one haul on every slip, the smelter\'s slips agree with the payout, and the share waiting is the contract\'s part of it', () => {
  const M = smelter.makers, chainOf = (o) => (o.sum.chain ? o.sum.chain : [o.sum]), endOf = (st) => (st.op === 'mul' ? st.a * st.b : st.a / st.b);
  const live = (round) => ({ round, canisters: CARRIES, phase: 'unload', onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 1, percent: 30 }, { socket: 2, percent: 90 }], drained: 1, onRack: 8, carried: 0,
    steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 } });
  let k = 0;
  for (const [name, load] of Object.entries(LOADS)) for (const [roles, clean] of [[['drill'], CREW_CLEAN], [['pilot', 'drill'], 3], [['pilot', 'drill'], 1]]) {
    forget(); const crew = crewOf(), n = 300 + k++, rand = seeded(n); flownHaul(n, null);
    MS.sign(crew, 'mining', roles);
    const before = haulOf(n), P = MS.land(crew, { n, clean, rich: load.includes(RICH_METAL), load }), H = haulOf(n), want = MS.forecastLoad({ clean, load, roles });
    // the haul: its lots, the most canisters first; what it sells for is their sum; the same haul every time it is read
    assert.deepEqual(H, haulOf(n)); assert.equal(H.flown, true); assert.deepEqual(H.load, load); assert.equal(H.fill >= before.fill, true);
    assert.equal(H.mix.reduce((c, L) => c + L.canisters, 0), CARRIES); assert.equal(H.mix.reduce((c, L) => c + L.pay, 0), H.pay);
    for (const [i, L] of H.mix.entries()) {
      assert.equal(L.canisters, load.filter((m) => m === L.metal.name).length); assert.equal(L.sells, ORE_PRICE[L.metal.name]); assert.equal(L.each, L.sells * H.ore.n / H.ore.d); assert.equal(L.pay, L.canisters * L.each);
      if (i) assert.ok(H.mix[i - 1].canisters >= L.canisters);
    }
    assert.equal(H.metal, H.mix[0].metal); assert.equal(H.rich, load.includes(RICH_METAL)); assert.equal(H.yield, null);
    // the payout: the contract's part of what the haul sells for
    assert.equal(P.sold, H.pay); assert.equal(P.sold, want.sold); assert.equal(P.pay, want.pay); assert.equal(P.share, MS.shareOf(roles)); assert.equal(P.pay, P.sold * P.share / 100);
    assert.deepEqual(P.mix, H.mix.map((L) => ({ metal: L.metal.name, canisters: L.canisters, each: L.each, pay: L.pay }))); assert.equal(P.metal, H.mix[0].metal.name);
    // the smelter's slips about this haul: each lot's ore, each lot's pay (once each), and the whole in the line under the right answer
    const L1 = live(n), said = new Set();
    for (let i = 0; i < H.mix.length; i++) {
      const o = M.pay.make(2, { rand, live: L1 }), F = o.facts, lot = H.mix.find((x) => x.metal.name === F.metal);
      assert.equal(F.lot, true); assert.ok(lot && !said.has(F.metal), `${name}: ${o.story}`); said.add(F.metal);
      assert.equal(F.from, H.rich ? 'This haul: a rich rock' : 'This haul'); assert.equal(F.haul, n);
      assert.equal(rightOf(o), lot.pay, `${o.story} -> ${o.answer}`); assert.equal(F.whole, P.sold); assert.deepEqual(F.each, [H.ore.n, H.ore.d]); assert.equal(F.n, lot.canisters); assert.equal(F.sells, lot.sells);
      assert.ok(o.story.includes(`${lot.canisters} of its 8 canisters`) && o.story.includes(`${H.ore.n}/${H.ore.d} of a tonne`) && o.story.includes(`${F.metal[0].toUpperCase() + F.metal.slice(1)} ore sells for ${lot.sells.toLocaleString('en-US')} credits a tonne`), o.story);
      assert.ok(o.rightWhy.includes(`pays ${P.sold.toLocaleString('en-US')} credits`), o.rightWhy);
      // (sums for the head: the price cut into the canister's parts, the parts in a canister, the canisters; each whole)
      const chain = chainOf(o); assert.ok(chain.length <= 3); assert.ok(near(endOf(chain[chain.length - 1]), lot.pay)); for (const st of chain) assert.ok(Number.isInteger(endOf(st)) && Number.isInteger(st.a) && Number.isInteger(st.b), `${o.story}: ${JSON.stringify(st)}`);
      assert.equal(o.coins.filter((c) => c.good).length, 1); assert.ok(o.coins.length >= 3); assert.ok(o.coins.filter((c) => !c.good).every((c) => c.why));
      assert.ok(!/NaN|undefined|null/.test(`${o.story} ${o.ask} ${o.rightWhy} ${o.coins.map((c) => c.label + c.why).join(' ')}`), o.story);
    }
    assert.equal(M.pay.make(2, { rand, live: L1 }).facts.live, false, 'every lot once: then slips from the log');
    // (the tonnes of one lot's ore: whole tonnes at the easier step, a mixed number at the harder; never the haul as if it were one metal)
    for (const step of [1, 2, 1, 2, 1, 2]) {
      const o = M.ore.make(step, { rand, live: { ...L1, docked: [], fullOnShip: 0, phase: 'load' } }), F = o.facts;
      assert.notEqual(F.kind, 'haul');
      if (F.kind !== 'lot') continue;
      const lot = H.mix.find((x) => x.metal.name === F.metal);
      assert.deepEqual([F.n, F.a, F.d], [lot.canisters, H.ore.n, H.ore.d]); assert.equal(Number.isInteger(lot.oreTonnes), step === 1); assert.ok(near(F.ans[0] / F.ans[1], lot.oreTonnes));
      assert.ok(o.story.includes('sorted by metal') && o.story.includes(`${lot.canisters} of its 8 canisters hold ${F.metal} ore`), o.story);
    }
    // (its canisters counted in the hangar are any of them: their ore is not named by a metal)
    forget(); const some = M.ore.make(2, { rand, live: L1 });
    if (['wall', 'ship'].includes(some.facts.kind)) { assert.equal(some.facts.metal, null); assert.ok(!Object.keys(ORE_PRICE).some((m) => `${some.story} ${some.ask}`.includes(m)), some.story); assert.match(some.ask, /tonnes of ore/); }
    // (its canisters' weight is the haul's own, as for any haul)
    const w = M.weigh.make(2, { rand, live: { ...L1, docked: [], fullOnShip: 0, phase: 'load' } }); assert.equal(w.facts.w, H.fill);
    // the payout card at every form: the same pay, a right answer that is right, and the same haul as the slips
    for (const grade of [0, 10, 30, 50, 70]) {
      const o = MS.payoutOrder(MS.contractOf(crew), grade, seeded(grade + 1)), form = MS.payoutForm(grade);
      assert.equal(o.payout, P.pay); assert.equal(o.coins.filter((c) => c.good).length, 1);
      if (form === 'count') { assert.equal(rightOf(o), grade < 6 ? 4 : 8); assert.ok(o.story.includes(lotsWords(P.mix)), o.story); assert.ok(o.story.includes(`sold for ${P.sold.toLocaleString('en-US')} credits`)); }
      else if (form === 'times') {
        const lot = P.mix.find((x) => x.metal === o.facts.metal); assert.equal(rightOf(o), lot.pay); assert.equal(o.facts.n * o.facts.per, lot.pay); assert.equal(o.facts.per, lot.each);
        assert.ok(o.rightWhy.includes(`The whole haul sold for ${P.sold.toLocaleString('en-US')} credits`), o.rightWhy); assert.ok(lot.canisters >= 2 || P.mix.every((x) => x.canisters < 2));
      } else assert.equal(rightOf(o), P.pay, `${form}: ${o.story}`);
      assert.ok(o.rightWhy.includes(`${P.pay.toLocaleString('en-US')} credits`), `${form}: ${o.rightWhy}`);
      assert.ok(!/NaN|undefined|null/.test(`${o.story} ${o.ask} ${o.rightWhy} ${o.coins.map((c) => c.label + c.why).join(' ')}`), o.story);
    }
    const got = MS.collect(crew); assert.equal(got.pay, want.pay); assert.equal(crew.credits, want.pay); assert.equal(crew.mission, undefined);
    flownHaul(n, null);
  }
  assert.equal(lotsWords([{ metal: 'copper', canisters: 5 }, { metal: 'iron', canisters: 2 }, { metal: 'gold', canisters: 1 }]), '5 canisters of copper ore, 2 of iron ore and 1 of gold ore');
  assert.equal(lotsWords([{ metal: 'gold', canisters: 1 }, { metal: 'iron', canisters: 7 }]), '1 canister of gold ore and 7 of iron ore');
});

test('home from a run the crew drilled (the pilot\'s seat only): one metal, as it always was', () => {
  for (const [roles, clean, rich, pay] of [[['pilot'], 2, false, 1800], [['pilot'], 3, true, 4200]]) {
    forget(); const crew = crewOf(), n = 40 + clean + (rich ? 10 : 0); flownHaul(n, null);
    MS.sign(crew, 'mining', roles);
    const P = MS.land(crew, { n, clean, rich }), H = haulOf(n);
    assert.equal(P.pay, pay); assert.equal(P.mix, undefined); assert.equal(H.mix, undefined); assert.equal(P.metal, rich ? RICH_METAL : H.metal.name); assert.equal(H.pay, H.oreTonnes * ORE_SELLS * (rich ? 2 : 1));
    for (const grade of [0, 10, 30, 50, 70]) { const o = MS.payoutOrder(MS.contractOf(crew), grade, seeded(grade + 1)), form = MS.payoutForm(grade); assert.equal(rightOf(o), form === 'count' ? (grade < 6 ? 4 : 8) : form === 'times' ? P.sold : P.pay); }
    MS.collect(crew); flownHaul(n, null);
  }
});

// ── the drill operator's ladder ───────────────────────────────────────────────────────────────────────────────────
const LEVELS = ['kVeins', 'kHoles', 'kCans', 'kLumps', 'tonnes', 'share', 'part', 'parts', 'box', 'tenths', 'fill', 'weight', 'percent', 'fillParts', 'anyPercent', 'ball', 'credits', 'myShare'];
const LIVE = (k) => ({ rock: { metal: ['iron', 'nickel', 'copper', 'cobalt', 'titanium'][k % 5], size: ['small', 'medium', 'big'][k % 3], holes: 4 + (k % 3), rich: k % 5 === 4 }, cans: { full: k % 9, of: 8 } });

test('the drill joins Mathwood\'s levels: eighteen levels, easiest first, kindergarten to eighth grade', () => {
  assert.equal(E.register(drill), true);
  const L = PLACE.drill.levels;
  assert.deepEqual(L.map((x) => x.id), LEVELS);
  for (let i = 1; i < L.length; i++) assert.ok(L[i].grade >= L[i - 1].grade, `${L[i].id}: ${L[i].grade} after ${L[i - 1].grade}`);
  assert.equal(L[0].grade, 0); assert.ok(L[L.length - 1].grade >= 76);
  for (let i = 1; i < L.length; i++) assert.ok(L[i].grade - L[i - 1].grade <= 12, `${L[i - 1].id} to ${L[i].id}: ${L[i].grade - L[i - 1].grade}`);
  for (const x of L) assert.ok(x.title && x.line, x.id);
});

test('every level of the drill ladder deals good cards about the rock in the claw: one right answer, wrong ones that say why, a picture', () => {
  const WEST = /\b(horse|cattle|wagon|saloon|stagecoach|rifle|cowhand|steer|Yuma|Tucson|jerky|harvest supper|town social|miles?|pounds?)\b/i;
  // every card is about the work in hand: the rock, its ore, the scan, the cutter, the canisters
  const WORK = /\b(rock|rocks|ore|scan|veins?|holes?|cutter|canisters?|lumps?|drill)\b/i;
  for (const L of drill.place.levels) {
    const rand = seeded(L.id.length * 97 + L.grade + 3), keys = new Set();
    for (let k = 0; k < 90; k++) {
      const crew = crewOf(); setLevelAt(crew, 'drill', L.id);
      const live = k % 4 === 3 ? null : LIVE(k), q = E.deal(crew, drill, { rand, live }), o = q.order;
      assert.equal(q.level.id, L.id); keys.add(o.key);
      assert.equal(o.coins.filter((c) => c.good).length, 1, `${L.id}: ${o.story}`);
      assert.ok(o.coins.length >= 3, `${L.id}: ${o.coins.length} answers`);
      assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${L.id}: two answers alike: ${o.coins.map((c) => c.label)}`);
      const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.big} ${c.small} ${c.label} ${c.why}`).join(' ')} ${o.rightWhy || ''}`;
      assert.ok(!/NaN|undefined|Infinity|\[object/.test(text), `${L.id}: ${text}`);
      assert.ok(!WEST.test(`${o.story} ${o.ask}`), `${L.id}: the west got in: ${o.story} ${o.ask}`);
      assert.ok(WORK.test(`${o.story} ${o.ask}`), `${L.id}: not about the work in hand: ${o.story} ${o.ask}`);
      assert.ok(!/smelter|furnace|crusher|load\b|slag/i.test(text), `${L.id}: the smelter's words got in: ${text}`);
      for (const c of o.coins) if (!c.good) assert.ok(c.why && c.why.length > 8, `${L.id}: a wrong answer with no reason: ${c.label}`);
      assert.ok(o.rightWhy, L.id);
      // Help: a picture for this question, one click away
      const h = helpPicture(o); assert.ok(h.svg && h.svg.includes('<svg'), `${L.id}: no picture for ${o.key}`);
      // a rock in the claw: the card names its own metal
      if (live && /ore\b/.test(o.story) && /(iron|nickel|copper|cobalt|titanium|gold) ore/.test(o.story)) assert.ok(o.story.includes(`${live.rock.metal} ore`), `${L.id}: another rock's metal: ${o.story}`);
      // what a card pays by itself is the engine's own sum (it is not paid on a run)
      assert.ok(q.worth.pay >= E.PAY.min && q.worth.pay <= E.PAY.max);
    }
    assert.ok(keys.size >= 1, L.id);
  }
});

test('the drill ladder\'s answers are right: the counting, the parts, the box, the canisters filled, the percents, the worth, the share', () => {
  const deal = (id, k, live = LIVE(k)) => { const crew = crewOf(); setLevelAt(crew, 'drill', id); return E.deal(crew, drill, { rand: seeded(k * 31 + id.length), live }).order; };
  for (let k = 0; k < 120; k++) {
    for (const id of LEVELS) {
      const o = deal(id, k), F = o.facts || {}, ans = rightOf(o), [maker, kind] = o.key.split(':');
      if (maker === 'veins') {
        if (kind === 'count') assert.equal(ans, F.n);
        else if (kind === 'both') { assert.equal(ans, F.a + F.b); assert.ok(F.a + F.b <= 10); }
        else if (kind === 'holes') { assert.equal(ans, F.all - F.used); assert.equal(F.all, LIVE(k).rock.holes, 'the rock\'s own holes'); assert.match(o.ask, /After \d+ holes?, how many will be left\?/); }
        else if (kind === 'cans') { assert.equal(ans, CARRIES - F.full); const full = LIVE(k).cans.full; if (full >= 1 && full <= 7) { assert.equal(F.full, full, 'the canisters as they are'); assert.match(o.ask, /still to fill\?$/); } else assert.match(o.ask, /^When \d of them/); }
      } else if (maker === 'lumps') assert.equal(ans, F.g * F.e);
      else if (maker === 'part') { assert.equal(ans, F.whole * F.n / F.d); assert.ok(o.story.includes(`weighs ${F.whole} tonnes`)); }
      else if (maker === 'percent') assert.ok(near(ans, F.whole * F.pct / 100), `${o.story}: ${ans}`);
      else if (maker === 'weigh') assert.ok(near(ans, F.ans / 10), `${o.story}: ${ans}`);
      else if (maker === 'box') {
        if (kind === 'volume') assert.equal(ans, F.l * F.w * F.h);
        else if (kind === 'weight') assert.equal(ans, F.l * F.w * F.h * F.per);
        else { assert.equal(ans, F.s ** 3 / 2 * F.per); assert.equal(F.ball * 2, F.box); }
      } else if (maker === 'fill') { assert.ok(near(ans, F.T / (F.n / F.d))); assert.ok(Number.isInteger(ans)); }
      else if (maker === 'pay') { assert.ok(near(ans, F.w / 10 * F.price)); assert.equal(F.price, ORE_PRICE[LIVE(k).rock.metal], 'the rock\'s own ore sells for what the payout says'); assert.ok(o.story.includes(`${LIVE(k).rock.metal} ore sells for`.replace(/^./, (c) => c.toUpperCase())), o.story); }
      else if (maker === 'worth') { assert.equal(F.tonnes, F.W * F.pct / 100); assert.equal(F.sold, F.tonnes * F.price); assert.equal(ans, F.sold * SHARE / 100); assert.equal(F.price, ORE_PRICE[LIVE(k).rock.metal]); }
      else assert.ok(['groups', 'share', 'partsLeft', 'partsTogether', 'crates', 'kgroups', 'parts'].some((w) => o.key.startsWith(w)) || o.key.length > 0, o.key);
      // the sums the worked sheet is given end on the right answer
      if (o.sum) { const last = o.sum.chain ? o.sum.chain[o.sum.chain.length - 1] : o.sum, end = last.op === 'add' ? last.a + last.b : last.op === 'sub' ? last.a - last.b : last.op === 'mul' ? last.a * last.b : last.a / last.b; assert.ok(near(end, ans, 1e-6), `${o.key}: the sums end on ${end}, the answer is ${ans}`); }
    }
  }
  // with no rock in the claw (the levels page): a plain telling, a usual metal
  const o = deal('kHoles', 3, null); assert.ok(/holes? left\?|in all\?/.test(o.ask));
});

test('a scan\'s card pays nothing by itself on a run, but the level and the kinds of math hear it', () => {
  const crew = crewOf(); setLevelAt(crew, 'drill', 'part');
  const q = E.deal(crew, drill, { rand: seeded(5), live: LIVE(2) }), right = q.order.coins.findIndex((c) => c.good);
  const r = E.answer(crew, drill, q, right, { ms: 9000, pay: false });
  assert.equal(r.right, true); assert.equal(r.pay, 0); assert.equal(E.credits(crew), 0);
  assert.equal(crew.jobs.drill.n, 1); assert.equal(crew.jobs.drill.right, 1); assert.equal(crew.jobs.drill.earned, 0);
  assert.ok(crew.levels.places.drill, 'the level heard it');
  // the smelter's own cards are untouched by the telling: still about loads and the furnace
  const S = E.deal(crewOf(), smelter, { rand: seeded(8) }); assert.ok(S.order.story.length > 0);
});
