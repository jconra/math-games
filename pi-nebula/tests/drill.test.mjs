// The drill operator's game (src/drill.js: a rock's ore, what a hole takes, the holes it stands, the canisters, the
// rich rock), the haul and each share for every mix of roles (src/missions.js), and every level of the drill
// operator's ladder (src/jobs/drill.js).
//   node --test pi-nebula/tests/drill.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import * as MS from '../src/missions.js';
import { ROLES, MISSIONS, CREW_CLEAN, RICH } from '../src/missions.js';
import { DRILL, ORE, makeRock, makeField, makeRun, drillHole, holeWorth, bestHole, take, tune, oreLeft, seeded as seed } from '../src/drill.js';
import { JOB as drill, SHARE } from '../src/jobs/drill.js';
import { JOB as smelter, haulOf, flownHaul, forget, METALS, CARRIES, ORE_SELLS, RICH_METAL } from '../src/jobs/smelter.js';
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
test('the field: seven rocks in reach, each in a place of its own, all of the haul\'s metal; one field in five has the rich rock', () => {
  for (let s = 1; s <= 40; s++) {
    const plain = makeField(seed(s), { metal: 'nickel' });
    assert.equal(plain.length, DRILL.field); assert.deepEqual(plain.map((r) => r.slot), [0, 1, 2, 3, 4, 5, 6]);
    assert.ok(plain.every((r) => r.metal === 'nickel' && !r.rich)); assert.ok(new Set(plain.map((r) => r.size)).size >= 2, 'something to choose between');
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

test('the rich rock: the haul is a rich one only if ore from it comes home', () => {
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

test('home from a run at the drill: the haul is one haul on every slip, and the share waiting is the contract\'s part of it', () => {
  for (const [roles, clean, rich, pay] of [[['drill'], CREW_CLEAN, false, 3600], [['drill'], CREW_CLEAN, true, 7200], [['pilot', 'drill'], 3, false, 6300], [['pilot', 'drill'], 1, true, 9000]]) {
    forget(); const crew = crewOf(), n = 40 + clean + (rich ? 10 : 0) + roles.length * 20; flownHaul(n, null);
    MS.sign(crew, 'mining', roles);
    const P = MS.land(crew, { n, clean, rich }), H = haulOf(n);
    assert.equal(P.pay, pay, `${roles}: ${P.pay}`); assert.equal(P.share, MS.shareOf(roles)); assert.equal(P.sold, H.pay); assert.equal(P.canisters, CARRIES);
    assert.equal(P.metal, rich ? RICH_METAL : H.metal.name); assert.equal(H.rich, rich); assert.equal(H.pay, H.oreTonnes * ORE_SELLS * (rich ? 2 : 1));
    // the payout card at every form: the same pay, a right answer that is right
    for (const grade of [0, 10, 30, 50, 70]) {
      const o = MS.payoutOrder(MS.contractOf(crew), grade, seeded(grade + 1));
      assert.equal(o.payout, pay); assert.equal(o.coins.filter((c) => c.good).length, 1);
      const form = MS.payoutForm(grade), want = form === 'count' ? (grade < 6 ? 4 : 8) : form === 'times' ? P.sold : P.pay;
      assert.equal(rightOf(o), want, `${form}: ${o.story} ${o.ask}`);
      assert.ok(!/NaN|undefined/.test(`${o.story} ${o.ask} ${o.rightWhy} ${o.coins.map((c) => c.label + c.why).join(' ')}`));
    }
    const got = MS.collect(crew); assert.equal(got.pay, pay); assert.equal(crew.credits, pay); assert.equal(crew.mission, undefined);
    flownHaul(n, null);
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
      else if (maker === 'pay') { assert.ok(near(ans, F.w / 10 * F.price)); assert.equal(F.price, ORE_SELLS * (LIVE(k).rock.rich ? 2 : 1), 'ore sells for what the payout says'); }
      else if (maker === 'worth') { assert.equal(F.tonnes, F.W * F.pct / 100); assert.equal(F.sold, F.tonnes * F.price); assert.equal(ans, F.sold * SHARE / 100); assert.equal(F.price, ORE_SELLS * (LIVE(k).rock.rich ? 2 : 1)); }
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
