// Tests for src/math/times.js: the times-table trainer behind the round-up.
// Run with:  node --test mathwood-valley/tests/*.test.mjs   (Node 22 does not take a bare folder here)
// Every random choice is seeded. To check a result isn't luck of the seeds, run again on other seed
// sets:  SEED_OFFSET=1000 node --test mathwood-valley/tests/times.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeTimes, seeded as seededAt, LADDER, ORDER, tablesAt, reachAt, stepOf, skipLine, hintFor, TRAP_KINDS,
  CLEAN_TO_CLIMB, MAX_DOWN_PER_WAVE, PLACEMENT_MISSES, PLACE_BELOW,
} from '../src/math/times.js';
import { makeTopic, hasTopic, HERD_TOPICS } from '../src/math/topic.js';

const NOW = 1e12;
const HOUR = 3600e3;
const OFFSET = Number(process.env.SEED_OFFSET) || 0;
const seeded = seed => seededAt(seed + OFFSET);
const make = (seed = 1, state = {}, now = NOW) => makeTimes(state, { rand: seeded(seed), now: () => now });

// Rope every right target in a wave.
const ropeAll = (T, w) => { for (const x of w.targets) if (x.good) T.answer(x.n, true); };

// Pull the product out of a missing-number card: '7 × ? = 56' -> 56.
const productOf = rule => Number(rule.split('=')[1]);

// ---------------------------------------------------------------------------------------------
// A simulated kid. Its chance of judging a target right falls off as the material gets harder:
// `A` is its chance on the 9s up to x10 (step 12, the middle of the ladder). Easy-stage strays are
// easier to spot; near misses and look-alikes are harder.
const TRAP_DIFF = { far: -2, neighbour: 0.4, near: 0.8, parity: 0.2, shared: 0.4, lookalike: 0.5, given: 0.3, other: 0 };
function kid(A, { ref = 12, slope = 0.6 } = {}) {
  const skill = ref + Math.log(A / (1 - A)) / slope;
  const P = (w, x) => {
    let d = w.hard - (w.stage === 'easy' ? 2 : 0);
    if (!x.good) d += TRAP_DIFF[x.trap] ?? 0;
    return 1 / (1 + Math.exp(-slope * (P.skill - d)));
  };
  P.skill = skill;
  return P;
}

// Play one wave. 'herd': the kid sizes up every steer, ropes the ones it thinks are in the herd, and
// takes up to two more looks for any right ones it passed over. 'throws': every throw is right with
// the kid's chance on this wave (the plain model).
function play(T, w, P, rnd, model, log) {
  if (model === 'throws') {
    const goods = w.targets.filter(x => x.good), traps = w.targets.filter(x => !x.good);
    const p = goods.reduce((s, x) => s + P(w, x), 0) / goods.length;
    const tried = new Set();
    let left = goods.length, guard = 0;
    while (left > 0 && guard++ < 60) {
      const free = traps.filter(x => !tried.has(x));
      if (rnd() < p || !free.length) { T.answer(goods[goods.length - left].n, true); log.push(1); left--; }
      else { const x = free[Math.floor(rnd() * free.length)]; tried.add(x); T.answer(x.n, false); log.push(0); }
    }
    return;
  }
  let pending = w.targets.slice();
  for (let look = 0; look < 3 && pending.some(x => x.good); look++) {
    const roped = pending.filter(x => (rnd() < P(w, x)) === x.good);
    for (let i = roped.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [roped[i], roped[j]] = [roped[j], roped[i]]; }
    for (const x of roped) { T.answer(x.n, x.good); log.push(x.good ? 1 : 0); }
    pending = pending.filter(x => !roped.includes(x));
  }
}

// ---------------------------------------------------------------------------------------------

test('the ladder: tables unlock 2, 10, 5, 3, 4, 9, 11, 6, 8, 7, 12, small multiples first, missing numbers last', () => {
  assert.deepEqual(ORDER, [2, 10, 5, 3, 4, 9, 11, 6, 8, 7, 12]);
  const firstSeen = [];
  for (const r of LADDER) if (r.table && !firstSeen.includes(r.table)) firstSeen.push(r.table);
  assert.deepEqual(firstSeen, ORDER);
  // 2s, 10s and 5s up to x5 first, then the same three up to x10.
  assert.deepEqual(LADDER.slice(0, 6).map(r => [r.table, r.upTo]), [[2, 5], [10, 5], [5, 5], [2, 10], [10, 10], [5, 10]]);
  // Every table but the 11s is met up to x5 before up to x10.
  for (const t of ORDER) {
    const five = LADDER.findIndex(r => r.table === t && r.upTo === 5), ten = LADDER.findIndex(r => r.table === t && r.upTo === 10);
    assert.ok(ten >= 0, `${t}s reach x10`);
    if (t !== 11) assert.ok(five >= 0 && five < ten, `${t}s: x5 before x10`);
  }
  assert.equal(LADDER.at(-1).kind, 'missing');
  assert.equal(LADDER.at(-2).kind, 'missing');
  assert.deepEqual(tablesAt(3), [2, 10, 5]);
  assert.deepEqual(tablesAt(10), [2, 10, 5, 3, 4]);
  assert.equal(reachAt(4, 9), 5);
  assert.equal(reachAt(4, 10), 10);
  assert.equal(reachAt(7, LADDER.length), 12);
  assert.equal(stepOf(9, 10), 12);
});

test('every wave has right and wrong targets; right ones are multiples, wrong ones are not', () => {
  const T = make(3);
  const rnd = seeded(99);
  let missing = 0, rule = 0;
  for (let step = 1; step <= LADDER.length; step++) {
    T.setStep(step);
    for (let i = 0; i < 25; i++) {
      const w = T.wave();
      const goods = w.targets.filter(x => x.good), strays = w.targets.filter(x => !x.good);
      assert.ok(goods.length >= 1 && strays.length >= 1, `step ${step}: both kinds in ${w.rule}`);
      assert.equal(new Set(w.targets.map(x => x.n)).size, w.targets.length, `no number twice in ${w.rule}`);
      for (const x of w.targets) assert.ok(Number.isInteger(x.n) && x.n >= 1, `whole numbers only (${x.n})`);
      for (const x of strays) assert.ok(typeof x.trap === 'string' && x.trap.length, 'every stray says what kind of trap it is');
      if (w.kind === 'missing') {
        missing++;
        const p = productOf(w.rule);
        assert.match(w.rule, /\?/);
        assert.equal(goods.length, 1, 'one right answer on a missing-number card');
        assert.equal(w.table * goods[0].n, p, `${w.rule}: ${goods[0].n} fits`);
        for (const x of strays) assert.notEqual(w.table * x.n, p, `${w.rule}: ${x.n} must not fit`);
        assert.ok(w.targets.length >= 3 && w.targets.length <= 6);
      } else {
        rule++;
        assert.equal(w.rule, `Rope the ${w.table}-herd`);
        assert.equal(w.targets.length, 10);
        for (const x of goods) {
          assert.equal(x.n % w.table, 0, `${x.n} is in the ${w.table}-herd`);
          assert.ok(x.n / w.table <= w.reach, `${x.n} is within x${w.reach}`);
        }
        for (const x of strays) assert.notEqual(x.n % w.table, 0, `${x.n} is not in the ${w.table}-herd`);
      }
      // Answer like a so-so kid so misses, comebacks and step changes all happen along the way.
      for (const x of w.targets) if (x.good || rnd() < 0.15) T.answer(x.n, x.good);
      T.setStep(step);
    }
  }
  assert.ok(missing > 20 && rule > 400);
});

test('early waves use clearly-wrong strays: odd ones for the even tables', () => {
  const T = make(5);
  const w = T.wave();
  assert.equal(w.table, 2);
  assert.equal(w.stage, 'easy');
  for (const x of w.targets) if (!x.good) { assert.equal(x.n % 2, 1); assert.equal(x.trap, 'far'); }

  // A new table met later starts easy too: the 4s up to x5.
  const U = make(6);
  U.setStep(stepOf(4, 5));
  const v = U.wave();
  assert.equal(v.table, 4);
  assert.equal(v.stage, 'easy');
  assert.equal(v.fresh, true, 'a new table asks for a slow herd');
  for (const x of v.targets) if (!x.good) assert.equal(x.n % 2, 1, `${x.n}: odd strays for an even table`);
  // ...and turns designed after its first couple of waves.
  ropeAll(U, v); ropeAll(U, U.wave()); U.setStep(stepOf(4, 5));
  let designed = false;
  for (let i = 0; i < 4; i++) { const x = U.wave(); if (x.table === 4 && x.stage === 'designed') designed = true; ropeAll(U, x); U.setStep(stepOf(4, 5)); }
  assert.ok(designed);
});

test('the kind of trap changes every wave, and every kind gets used', () => {
  const T = make(11);
  let prev = null;
  const mains = {};
  for (const t of [3, 4, 6, 7, 8, 9, 11, 12, 5, 10, 2]) {
    T.setStep(stepOf(t, 10));
    for (let i = 0; i < 40; i++) {
      const w = T.wave();
      ropeAll(T, w);
      T.setStep(stepOf(t, 10));
      if (w.stage !== 'designed') continue;
      assert.notEqual(w.main, prev, `wave ${w.id}: the main trap kind repeats (${w.main})`);
      prev = w.main;
      (mains[w.table] ||= new Set()).add(w.main);
      // The main kind leads the wave.
      const strays = w.targets.filter(x => !x.good && !x.back);
      const lead = strays.filter(x => x.trap === w.main).length;
      for (const k of TRAP_KINDS) if (k !== w.main) assert.ok(strays.filter(x => x.trap === k).length <= lead, `${w.main} leads ${w.rule}`);
    }
  }
  for (const t of [3, 4, 6, 7, 8, 9, 12]) assert.ok(mains[t].size >= 3, `${t}s: ${[...mains[t]]}`);
  assert.ok(mains[2].size >= 2);
  const all = new Set(Object.values(mains).flatMap(s => [...s]));
  for (const k of TRAP_KINDS) assert.ok(all.has(k), `${k} gets used`);
});

test('no odd/even, last-digit or size rule sorts the herd from the strays', () => {
  for (const t of [3, 4, 6, 7, 8, 9, 11, 12, 5, 10]) {
    const T = make(20 + t);
    const run = { goods: [], strays: [] };
    let waves = 0;
    for (let i = 0; i < 60; i++) {
      T.setStep(stepOf(t, 10));
      const w = T.wave();
      ropeAll(T, w);
      if (w.table !== t || w.stage !== 'designed') continue;
      waves++;
      const g = w.targets.filter(x => x.good).map(x => x.n), s = w.targets.filter(x => !x.good).map(x => x.n);
      run.goods.push(...g); run.strays.push(...s);
      // Within every wave: if the herd is all one parity, some stray shares it.
      const par = new Set(g.map(n => n % 2));
      if (par.size === 1) assert.ok(s.some(n => n % 2 === [...par][0]), `${w.rule} ${g} | ${s}: odd/even sorts it`);
      // Within every wave: some stray ends in a digit a herd number ends in (the 5s and 10s are the
      // exception: there the last digit IS the rule, and the hint says so).
      if (t !== 5 && t !== 10) assert.ok(s.some(n => g.some(m => m % 10 === n % 10)), `${w.rule} ${g} | ${s}: last digit sorts it`);
    }
    assert.ok(waves >= 20, `${t}s: enough designed waves (${waves})`);
    // Over the whole run: no set of last digits, no parity, and no size cut-off sorts them.
    if (t !== 5 && t !== 10) {
      const gd = new Set(run.goods.map(n => n % 10)), sd = new Set(run.strays.map(n => n % 10));
      assert.ok([...gd].every(d => sd.has(d)), `${t}s: every herd last digit also shows up on strays`);
    }
    if (t % 2 === 0) assert.ok(run.strays.some(n => n % 2 === 0), `${t}s: even strays exist`);
    else assert.ok(run.goods.some(n => n % 2 === 0) && run.goods.some(n => n % 2 === 1));
    const maxG = Math.max(...run.goods), minG = Math.min(...run.goods);
    assert.ok(run.strays.some(n => n < maxG) && run.strays.some(n => n > minG), `${t}s: size doesn't sort them`);
    assert.ok(run.strays.filter(n => n > maxG).length < run.strays.length / 4, `${t}s: strays mostly sit among the herd's sizes`);
  }
});

test('explain(): one plain line and the skip-count with the wrong number in brackets', () => {
  const T = make(1);
  assert.deepEqual(T.explain(27, 6), { good: false, line: 'Three past 24, not in the 6-herd', skip: [6, 12, 18, 24, '(27)', 30], anchor: null, also: '27 is 3 × 9' });
  const e4 = T.explain(4, 6);
  assert.equal(e4.line, 'Two short of 6, not in the 6-herd');
  assert.deepEqual(e4.skip, ['(4)', 6]);
  const e55 = T.explain(55, 7);
  assert.equal(e55.line, 'One short of 56, not in the 7-herd');
  assert.deepEqual(e55.skip, [35, 42, 49, '(55)', 56]);
  assert.equal(e55.anchor, '7 × 5 = 35');
  const e = T.explain(66, 7);
  assert.deepEqual(e.skip, [35, 42, 49, 56, 63, '(66)', 70]);
  const big = T.explain(130, 12);
  assert.deepEqual(big.skip, [60, 72, 84, 96, 108, 120, '(130)', 132]);
  assert.equal(big.anchor, '12 × 5 = 60');
  assert.deepEqual(T.explain(141, 12).skip, [120, 132, '(141)', 144]);
  const good = T.explain(24, 6);
  assert.equal(good.good, true);
  assert.deepEqual(good.skip, [6, 12, 18, 24]);
  assert.equal(good.sacks, 4);
  assert.match(good.line, /24/);

  // Every stray across a long run gets a sensible line and a short, ordered count.
  const U = make(4);
  for (let i = 0; i < 300; i++) {
    U.setStep(1 + (i % 22));
    const w = U.wave();
    for (const x of w.targets.filter(y => !y.good)) {
      const ex = U.explain(x.n);
      assert.match(ex.line, new RegExp(`(past|short of) \\d+, not in the ${w.table}-herd$`));
      assert.ok(ex.skip.length <= 9, `${ex.skip}`);
      const at = ex.skip.indexOf(`(${x.n})`);
      assert.ok(at >= 0, `${x.n} is bracketed in ${ex.skip}`);
      const nums = ex.skip.filter(v => typeof v === 'number');
      assert.ok(nums.every(v => v % w.table === 0), 'the count is the herd');
      if (at > 0) assert.ok(ex.skip[at - 1] < x.n);
      if (at < ex.skip.length - 1) assert.ok(ex.skip[at + 1] > x.n);
    }
  }

  // A missing-number card explains the product of the wrong pick.
  const M = make(8);
  M.setStep(LADDER.length - 1);
  let w;
  do { w = M.wave(); } while (w.kind !== 'missing');
  const wrong = w.targets.find(x => !x.good), right = w.targets.find(x => x.good);
  const ex = M.explain(wrong.n);
  assert.match(ex.line, new RegExp(`^${w.table} × ${wrong.n} = ${w.table * wrong.n}, \\w+ ${w.table}s? (too many|short)$`));
  assert.ok(ex.skip.includes(`(${w.table * wrong.n})`));
  assert.equal(M.explain(right.n).good, true);
  assert.match(M.hint(), /Count by/);
});

test('hint(): a rule of thumb for every table', () => {
  for (const t of ORDER) assert.ok(hintFor(t).length > 10);
  for (const t of [2, 5, 10]) assert.match(hintFor(t), /ends in/);
  for (const t of [3, 9]) assert.match(hintFor(t), /digits/);
  assert.match(hintFor(6), /Even/);
  assert.match(hintFor(4), /[Hh]alve/);
  assert.match(hintFor(11), /twin/);
  for (const t of [7, 8, 12]) { assert.match(hintFor(t, 10), /Count on from/); assert.match(hintFor(t, 5), /Count by/); }
  const T = make(2);
  T.setStep(stepOf(9, 10));
  const w = T.wave();
  assert.equal(T.hint(), hintFor(w.table, w.reach));
});

test('the hints are true for every multiple up to x12', () => {
  const digitSum = n => String(n).split('').reduce((s, d) => s + +d, 0);
  for (let n = 1; n <= 160; n++) {
    // 2s, 5s and 10s: the last digit.
    assert.equal(n % 2 === 0, [0, 2, 4, 6, 8].includes(n % 10));
    assert.equal(n % 5 === 0, [0, 5].includes(n % 10));
    assert.equal(n % 10 === 0, n % 10 === 0);
    // 3s: the digit sum is in the 3-herd. 6s: even, and the same. 9s: the digit sum makes 9 or 18.
    assert.equal(n % 3 === 0, digitSum(n) % 3 === 0);
    assert.equal(n % 6 === 0, n % 2 === 0 && digitSum(n) % 3 === 0);
    if (n <= 108) assert.equal(n % 9 === 0, digitSum(n) === 9 || digitSum(n) === 18, `${n}`);
    // 4s: halve twice with nothing left over.
    assert.equal(n % 4 === 0, n % 2 === 0 && (n / 2) % 2 === 0);
    // 11s: twin digits up to 99.
    if (n < 100) assert.equal(n % 11 === 0, n >= 10 && n % 10 === Math.floor(n / 10));
  }
  assert.match(hintFor(6), /3-herd/);
  assert.match(hintFor(9), /9, or 18 for 99/);
  // The counting hints list real multiples.
  for (const t of [7, 8, 12]) for (const reach of [5, 10, 12]) {
    const nums = hintFor(t, reach).match(/\d+/g).map(Number).filter(v => v !== t && v !== 5);
    assert.ok(nums.every(v => v % t === 0), `${hintFor(t, reach)}`);
  }
});

test('the trap kind that fools a kid comes up a bit more', () => {
  const T = make(60);
  T.setStep(stepOf(8, 10));
  const mains = {};
  for (let i = 0; i < 300; i++) {
    const w = T.wave();
    if (w.stage === 'designed') mains[w.main] = (mains[w.main] || 0) + 1;
    // This kid only ever falls for near misses.
    for (const x of w.targets) if (x.good || x.trap === 'near') T.answer(x.n, x.good);
    T.setStep(stepOf(8, 10));
  }
  const others = Object.entries(mains).filter(([k]) => k !== 'near').map(([, v]) => v);
  assert.ok(mains.near > Math.max(...others), JSON.stringify(mains));
  assert.ok(T.state.traps.near.fooled > 50);
});

test('once every table is open, the hard ones (6, 7, 8, 9, 12) come up more', () => {
  const T = make(61);
  const count = {};
  for (let i = 0; i < 600; i++) {
    T.setStep(LADDER.findIndex(r => r.table === 0) + 1);
    const w = T.wave();
    count[w.table] = (count[w.table] || 0) + 1;
    ropeAll(T, w);
  }
  const hard = [6, 7, 8, 9, 12].reduce((s, t) => s + (count[t] || 0), 0) / 5;
  const easy = [2, 10, 5, 3, 4, 11].reduce((s, t) => s + (count[t] || 0), 0) / 6;
  assert.ok(hard > easy * 1.4, JSON.stringify(count));
  for (const t of ORDER) assert.ok(count[t] > 0, `${t}s still come up`);
});

test('level(): a plain label for parents', () => {
  const T = make(1);
  assert.deepEqual(
    { step: T.level().step, label: T.level().label, placing: T.level().placing },
    { step: 1, label: '2s, 10s and 5s up to x5', placing: true });
  T.setStep(9);
  const L = T.level();
  assert.equal(L.detail, 'the 4s up to x5');
  assert.equal(L.label, 'Adding the 3s and 4s');
  assert.match(L.line, /^Step 9 of 24: /);
  assert.deepEqual(L.tables, [2, 10, 5, 3, 4]);
  T.setStep(LADDER.length);
  assert.match(T.level().label, /Missing numbers/);
});

test('first visit: up a step per right answer; one slip is forgiven, the second miss settles', () => {
  assert.equal(PLACEMENT_MISSES, 2);
  const T = make(7);
  const w = T.wave();
  assert.equal(w.placing, true);
  const goods = w.targets.filter(x => x.good);
  goods.forEach((x, i) => {
    const r = T.answer(x.n, true);
    assert.equal(r.step, 2 + i, 'one step per right answer');
    assert.equal(r.placed, false);
  });
  const w2 = T.wave();
  assert.equal(w2.step, 1 + goods.length, 'the next wave is the step reached');
  const g2 = w2.targets.filter(x => x.good), s2 = w2.targets.filter(x => !x.good);
  assert.equal(T.answer(g2[0].n, true).step, w2.step + 1);
  // the first miss is forgiven: back to the step this wave was dealt at, and the rest of the wave doesn't climb
  const r1 = T.answer(s2[0].n, false);
  assert.equal(r1.placed, false, 'one slip does not end the climb');
  assert.equal(r1.step, w2.step, 'back to the step of the wave the slip was on');
  for (const x of g2.slice(1)) assert.equal(T.answer(x.n, true).step, w2.step, 'the rest of that wave does not climb');
  // the next wave tests that step again; the second miss settles PLACE_BELOW steps below the step of the wave it was on
  const w3 = T.wave();
  assert.equal(w3.step, w2.step);
  assert.equal(w3.placing, true);
  T.answer(w3.targets.find(x => x.good).n, true);
  const r2 = T.answer(w3.targets.find(x => !x.good).n, false);
  assert.equal(r2.placed, true);
  assert.equal(r2.step, Math.max(1, w3.step - PLACE_BELOW), 'settles PLACE_BELOW steps below the step of the wave it missed on');
  assert.equal(T.level().placing, false);

  // A misclick on the very first wave: the climb goes on after it.
  const V = make(8);
  const v = V.wave();
  V.answer(v.targets.find(x => !x.good).n, false);
  ropeAll(V, v);
  assert.equal(V.level().step, 1, 'the wave with the slip does not climb');
  assert.equal(V.level().placing, true);
  const v2 = V.wave();
  ropeAll(V, v2);
  assert.equal(V.level().step, 1 + v2.targets.filter(x => x.good).length, 'a clean wave climbs again');

  // A kid who misses twice straight away starts at step 1.
  const U = make(9);
  const strays = U.wave().targets.filter(x => !x.good);
  assert.equal(U.answer(strays[0].n, false).placed, false);
  const u = U.answer(strays[1].n, false);
  assert.deepEqual([u.placed, u.step], [true, 1]);
});

test('first visit: a teenager who knows the early tables is not stuck on the 2s', () => {
  // Knows everything up to step 13 (the 11s) perfectly, nothing above it.
  for (const seed of [1, 2, 3]) {
    const T = make(seed);
    let waves = 0;
    while (!T.state.placed && waves < 20) {
      const w = T.wave(); waves++;
      const knows = w.hard <= 13;
      // Ropes right ones first if it knows them; otherwise ropes a stray first.
      const order = knows ? w.targets.filter(x => x.good) : [w.targets.find(x => !x.good), ...w.targets.filter(x => x.good)];
      for (const x of order) T.answer(x.n, x.good);
    }
    assert.ok(waves <= 6, `placed within ${waves} waves`);
    const s = T.level().step;
    assert.ok(s >= 9 && s <= 17, `seed ${seed}: placed at step ${s}`);
    // Placed above what it knows? The misses bring it back down, a step a wave. On material it doesn't
    // know it ropes a stray between right ones (so it never strings a run of rights together there).
    for (let i = 0; i < 3; i++) {
      const w = T.wave();
      const knows = w.hard <= 13;
      const goods = w.targets.filter(y => y.good), strays = w.targets.filter(y => !y.good);
      const order = knows ? goods : goods.flatMap((g, k) => (strays[k] ? [strays[k], g] : [g]));
      for (const x of order) T.answer(x.n, x.good);
    }
    assert.ok(T.level().step <= 14, `seed ${seed}: back near what it knows (${T.level().step})`);
  }
  // A kid who knows the lot climbs to the top and never sees a miss; reaching the top ends the
  // first-visit climb (there is nothing left to find).
  const T = make(4);
  for (let i = 0; i < 8; i++) ropeAll(T, T.wave());
  assert.equal(T.level().step, LADDER.length);
  assert.equal(T.level().placing, false);
});

test('after placing: 5 right in a row moves up a step, a miss moves down a step, at most once a wave', () => {
  // Decided settings: 5 right in a row to climb (a wave has 5 or 6 right steers, so with 3 a kid could climb
  // twice in a wave but drop only once, and settled near 64% right) and at most one step down a wave.
  assert.deepEqual([CLEAN_TO_CLIMB, MAX_DOWN_PER_WAVE], [5, 1]);
  const T = make(9);
  T.setStep(10);
  const w = T.wave({ count: 2 * (CLEAN_TO_CLIMB + 2) });   // room for a full run of rights and two more
  const goods = w.targets.filter(x => x.good), strays = w.targets.filter(x => !x.good);
  assert.ok(goods.length >= CLEAN_TO_CLIMB + 2 && strays.length >= 2);
  for (let i = 0; i < CLEAN_TO_CLIMB - 1; i++) assert.equal(T.answer(goods[i].n, true).step, 10, `right answer ${i + 1} doesn't climb yet`);
  assert.deepEqual([T.answer(goods[CLEAN_TO_CLIMB - 1].n, true).step, T.level().step], [11, 11]);
  const miss = T.answer(strays[0].n, false);
  assert.deepEqual([miss.step, miss.moved], [10, -1]);
  // More misses in the same wave count once: they reset the run of rights but move nothing.
  T.answer(goods[CLEAN_TO_CLIMB].n, true);
  const again = T.answer(strays[1].n, false);
  assert.deepEqual([again.step, again.moved], [10, 0]);
  assert.equal(T.state.streak, 0);
  // The next wave can move down again.
  const w2 = T.wave();
  assert.equal(T.answer(w2.targets.find(x => !x.good).n, false).step, 9);
  // A rough wave, every stray roped, still costs one step.
  T.setStep(17);
  let w3 = T.wave();
  while (w3.review) { ropeAll(T, w3); w3 = T.wave(); }   // another table's turn never moves the step
  for (const x of w3.targets.filter(y => !y.good)) T.answer(x.n, false);
  assert.equal(T.level().step, 16);
  // The run of rights carries on from one wave into the next (a wave has only 5 or 6 right steers).
  T.setStep(10);
  const own = () => { let x = T.wave(); while (x.review) { ropeAll(T, x); x = T.wave(); } return x; };
  const a = own().targets.filter(y => y.good);
  for (const x of a.slice(0, CLEAN_TO_CLIMB - 2)) assert.equal(T.answer(x.n, true).step, 10);
  const b = own().targets.filter(y => y.good);
  assert.equal(T.answer(b[0].n, true).step, 10);
  assert.equal(T.answer(b[1].n, true).step, 11, 'the run went on across the two waves');
  // The bottom and the top hold.
  T.setStep(1); T.wave(); T.answer(1, false); assert.equal(T.level().step, 1);
});

test('warm-ups: two easy waves from well below the step at the start of a session; they never move the step', () => {
  const state = {};
  let T = make(12, state, NOW);
  assert.equal(T.wave().warmup, false, 'a brand-new rider gets no warm-ups');
  T.setStep(14);
  ropeAll(T, T.wave());

  // Same session (a reload five minutes later): no warm-ups.
  T = make(13, state, NOW + 5 * 60e3);
  assert.equal(T.wave().warmup, false);

  // Next day: two warm-ups, then back to work.
  T = make(14, state, NOW + 30 * HOUR);
  const before = T.level().step;
  for (let i = 0; i < 2; i++) {
    const w = T.wave();
    assert.equal(w.warmup, true);
    assert.equal(w.stage, 'easy');
    assert.ok(w.hard <= before - 3, `warm-up from well below (${w.hard} vs ${before})`);
    T.answer(w.targets.find(x => !x.good).n, false);   // a slip in a warm-up
    for (const x of w.targets) if (x.good) T.answer(x.n, true);
    assert.equal(T.level().step, before, 'warm-ups never move the step');
  }
  assert.equal(T.wave().warmup, false);
});

test('a missed number comes back 2 to 4 answers later, and again next session', () => {
  const state = {};
  const T = make(15, state);
  T.setStep(stepOf(6, 10));
  let w = T.wave();
  while (w.table !== 6) { ropeAll(T, w); w = T.wave(); }
  const stray = w.targets.find(x => !x.good);
  const r = T.answer(stray.n, false);
  assert.ok(r.comeback && r.comeback.n === stray.n && r.comeback.after >= 2 && r.comeback.after <= 4);
  // due(): nothing until the time is up, then the number (for herds where the wrong steer wanders off).
  const goods = w.targets.filter(x => x.good);
  for (let i = 0; i < r.comeback.after; i++) {
    assert.deepEqual(T.due(), [], `not due after ${i} answers`);
    T.answer(goods[i % goods.length].n, true);
  }
  const back = T.due();
  assert.deepEqual(back.map(x => [x.n, x.good, x.back]), [[stray.n, false, true]]);

  // Without due(): the number rides in with the next wave of that table, which comes round again
  // within three waves (the tables take turns).
  const w2 = T.wave();
  const x2 = w2.targets.find(x => !x.good);
  T.answer(x2.n, false);
  let w3 = T.wave(), gap = 1;
  while (w3.table !== w2.table && gap < 5) { ropeAll(T, w3); w3 = T.wave(); gap++; }
  assert.ok(gap <= 3, `the ${w2.table}s came round again ${gap} waves later`);
  assert.ok(w3.targets.some(x => x.n === x2.n && x.back && !x.good), `${x2.n} comes back`);
  ropeAll(T, w3);

  // Next session: after the warm-ups, the missed numbers come back.
  const U = make(16, state, NOW + 30 * HOUR);
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const w = U.wave();
    if (w.warmup) { assert.ok(!w.targets.some(x => x.back), 'warm-ups stay easy'); ropeAll(U, w); continue; }
    for (const x of w.targets) if (x.back) seen.add(`${w.table}:${x.n}`);
    ropeAll(U, w);
  }
  assert.ok(seen.has(`6:${stray.n}`) && seen.has(`${w2.table}:${x2.n}`), `came back next session: ${[...seen]}`);
  // Left alone next session, they are done with.
  assert.ok(!U.state.review.some(r => r.n === stray.n && r.t === 6));
});

test('a pile of misses does not take over the session', () => {
  const state = {};
  const T = make(17, state);
  T.setStep(17);
  // Miss strays on many different tables.
  for (let i = 0; i < 30; i++) {
    const w = T.wave();
    const s = w.targets.find(x => !x.good);
    T.answer(s.n, false); T.setStep(17);
    ropeAll(T, w);
  }
  const U = make(18, state, NOW + 30 * HOUR);
  const tables = [];
  for (let i = 0; i < 14; i++) { const w = U.wave(); tables.push(w.warmup ? 'warm' : w.review ? 'review' : 'focus'); ropeAll(U, w); U.setStep(17); }
  const focus = tables.slice(2).filter(k => k === 'focus').length;
  assert.ok(focus >= 4, `the step's own table still gets waves: ${tables}`);
});

test('state is plain JSON and survives a save and reload at any moment', () => {
  const play1 = (reload) => {
    let state = {};
    const rand = seeded(21), rnd = seeded(22);
    let T = makeTimes(state, { rand, now: () => NOW });
    const out = [];
    for (let i = 0; i < 80; i++) {
      if (reload) { state = JSON.parse(JSON.stringify(state)); T = makeTimes(state, { rand, now: () => NOW }); }
      const w = T.wave();
      out.push(JSON.stringify(w));
      for (const x of w.targets) {
        if (!x.good && rnd() > 0.2) continue;
        if (reload) { state = JSON.parse(JSON.stringify(state)); T = makeTimes(state, { rand, now: () => NOW }); }
        const r = T.answer(x.n, x.good);
        out.push(JSON.stringify(r));
        if (!x.good) out.push(JSON.stringify(T.explain(x.n)));
      }
      out.push(JSON.stringify(T.level()));
      assert.deepEqual(JSON.parse(JSON.stringify(state)), state, 'nothing in the state that JSON would change');
    }
    return out;
  };
  const a = play1(false), b = play1(true);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.equal(b[i], a[i], `step ${i} differs after a reload`);
});

test('a broken or partial saved object is repaired, not trusted', () => {
  const bad = {
    step: 'x', placed: 'yes', soon: 5, review: [null, { kind: 'rule', t: 6, n: 27, sess: 0 }, 'junk'],
    cur: { targets: 'no' }, tables: { 6: 'bad', 7: { waves: 'x' } }, traps: { near: null },
  };
  const T = make(30, bad);
  assert.equal(T.level().step, 1);
  assert.equal(T.state.placed, false);
  assert.equal(T.state.review.length, 1);
  const w = T.wave();
  assert.ok(w.targets.length === 10);
  assert.deepEqual(JSON.parse(JSON.stringify(T.state)), T.state);
  assert.equal(make(31, { step: 999 }).level().step, LADDER.length);
  const U = makeTimes(undefined, { rand: seeded(1) });
  assert.ok(U.state && U.wave().targets.length);
  // A caller that marks a real multiple as wrong can't jam the waves on one table.
  const V = make(32);
  V.setStep(15);
  const v = V.wave();
  V.answer(v.targets.find(x => x.good).n, false);
  const seen = new Set();
  for (let i = 0; i < 12; i++) { const x = V.wave(); seen.add(x.table); ropeAll(V, x); }
  assert.ok(seen.size >= 2);
});

test('simulated kids at 90%, 70% and 50% settle at the same share right, on different steps', (t) => {
  // The ladder is judged on the step's own waves. With 5 right in a row up and at most one step down a
  // wave (several misses in a wave count once), the kid climbs until about 1 answer in 5 is wrong:
  // measured on 20 seed sets, 80 to 83% right on the step's own waves in the 'herd' model (single seeds
  // 79 to 84%) and 78 to 82% in the plain 'throws' model (single seeds 76 to 83%). With 3 right in a row
  // (the rule before) they sat near 64% and 57%. Reviews of older tables and the warm-ups run easier,
  // which lifts the whole session by 5 or 6 points (about 87% and 85%). These waves have 10 numbers and
  // leave due() out; the round-up deals 11 and hands fooled numbers back mid-wave, which runs a point or
  // two harder (78 to 81% and 77 to 80% on the own step: see the dial notes in times.js). If the dials at
  // the top of times.js change, re-measure (~/pw/bandit-math/rigs/mathlane/times_settle.mjs, and with
  // ROUNDUP=1 for the round-up's way) and move these bands.
  const BANDS = { herd: { own: [0.75, 0.88], all: [0.80, 0.93] }, throws: { own: [0.72, 0.87], all: [0.77, 0.92] } };
  const lines = [];
  for (const model of ['herd', 'throws']) {
    const meanStep = {}, meanOwn = {};
    for (const A of [0.9, 0.7, 0.5]) {
      const own = [], all = [], steps = [];
      for (const seed of [1, 2, 3]) {
        const state = {};
        let now = NOW;
        let T = makeTimes(state, { rand: seeded(seed), now: () => now });
        const P = kid(A), rnd = seeded(seed * 7919 + 13);
        const tally = { own: [0, 0], all: [0, 0] };
        for (let i = 0; i < 300; i++) {
          if (i > 0 && i % 25 === 0) { now += 30 * HOUR; T = makeTimes(state, { rand: seeded(seed * 31 + i), now: () => now }); }
          const w = T.wave(), log = [];
          play(T, w, P, rnd, model, log);
          if (i < 75) continue;   // skip the first quarter while the kid finds its step
          const right = log.filter(x => x).length;
          tally.all[0] += right; tally.all[1] += log.length;
          if (!w.warmup && !w.review) { tally.own[0] += right; tally.own[1] += log.length; }
          steps.push(T.level().step);
        }
        const o = tally.own[0] / tally.own[1], a = tally.all[0] / tally.all[1];
        own.push(o); all.push(a);
        const B = BANDS[model];
        assert.ok(o >= B.own[0] && o <= B.own[1], `${model} kid ${A} seed ${seed}: ${(o * 100).toFixed(1)}% right on its own step's waves`);
        assert.ok(a >= B.all[0] && a <= B.all[1], `${model} kid ${A} seed ${seed}: ${(a * 100).toFixed(1)}% right over the whole session`);
        assert.ok(a > o, `${model} kid ${A} seed ${seed}: the reviews and warm-ups run easier`);
      }
      meanStep[A] = steps.reduce((s, x) => s + x, 0) / steps.length;
      meanOwn[A] = own.reduce((s, x) => s + x, 0) / own.length;
      const pct = r => (r * 100).toFixed(1);
      const spread = r => ((Math.max(...r) - Math.min(...r)) * 100).toFixed(1);
      lines.push(`${model} kid at ${A * 100}%: own step ${own.map(pct).join(' / ')}% (spread ${spread(own)}), whole session ${all.map(pct).join(' / ')}% (spread ${spread(all)}), settles near step ${meanStep[A].toFixed(1)}`);
    }
    // the ladder, not the kid, sets the share right: a stronger kid just settles on a higher step
    const shares = Object.values(meanOwn);
    assert.ok(Math.max(...shares) - Math.min(...shares) < 0.08, `${model}: the kids' shares right differ too much ${JSON.stringify(meanOwn)}`);
    // (in both models the kid at 90% settles well above the kid at 70%, and that one above the kid at 50%)
    assert.ok(meanStep[0.9] > meanStep[0.5] + 1, `${model}: stronger kids settle higher ${JSON.stringify(meanStep)}`);
    assert.ok(meanStep[0.9] > meanStep[0.7] + 1 && meanStep[0.7] > meanStep[0.5] + 0.5, `${model}: stronger kids settle higher ${JSON.stringify(meanStep)}`);
  }
  t.diagnostic(lines.join('\n'));
});

test('a kid who is learning climbs the ladder', () => {
  const T = make(40);
  const P = kid(0.5), rnd = seeded(41), log = [];
  const steps = [];
  for (let i = 0; i < 400; i++) {
    P.skill += 0.02;   // gets a little better every wave
    play(T, T.wave(), P, rnd, 'herd', log);
    steps.push(T.level().step);
  }
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  assert.ok(avg(steps.slice(300)) > avg(steps.slice(50, 150)) + 3, `${avg(steps.slice(50, 150))} -> ${avg(steps.slice(300))}`);
});

test('the tables take turns: a kid who slips every wave still gets other tables', () => {
  for (const [seed, t] of [[70, 4], [71, 8], [72, 7]]) {
    const T = make(seed);
    T.setStep(stepOf(t, 10));
    const tables = [];
    for (let i = 0; i < 30; i++) {
      const w = T.wave();
      tables.push(w.table);
      T.answer(w.targets.find(x => !x.good).n, false);   // one slip every wave
      ropeAll(T, w);
      T.setStep(stepOf(t, 10));
    }
    // Two waves on the step's own table, then one on another: never three in a row on one table.
    assert.deepEqual(tables.slice(0, 2), [t, t], `${t}s: ${tables}`);
    let run = 1, longest = 1;
    for (let i = 1; i < tables.length; i++) { run = tables[i] === tables[i - 1] ? run + 1 : 1; longest = Math.max(longest, run); }
    assert.ok(longest <= 2, `${t}s: ${tables}`);
    const own = tables.filter(x => x === t).length;
    assert.equal(own, 20, `${t}s: the step's own table gets two waves in three: ${tables}`);
  }
});

test('due(): a tangled steer gets another turn, never a twin', () => {
  const T = make(73);
  T.setStep(stepOf(7, 10));
  let w = T.wave();
  while (w.table !== 7) { ropeAll(T, w); w = T.wave(); }
  const goods = w.targets.filter(x => x.good), stray = w.targets.find(x => !x.good);
  const r = T.answer(stray.n, false);
  let back = [];
  for (let i = 0; i < r.comeback.after; i++) { T.answer(goods[i].n, true); back = back.concat(T.due()); }
  assert.deepEqual(back.map(x => [x.n, x.good, x.back]), [[stray.n, false, true]]);
  assert.equal(T.state.cur.targets.filter(x => x.n === stray.n).length, 1, 'one steer per number');
  // Roping it wrong a second time is another miss, with its own comeback.
  const r2 = T.answer(stray.n, false);
  assert.equal(r2.right, false);
  assert.ok(r2.comeback && r2.comeback.n === stray.n);
  // Once every right one is roped the wave is over, and nothing more comes back into it.
  for (const x of goods.slice(r.comeback.after)) T.answer(x.n, true);
  assert.deepEqual(T.due(), []);
  assert.ok(T.state.soon.some(x => x.n === stray.n && x.t === 7), 'it waits for the next wave of the 7s');
});

test('a long break with the game left open starts a new session', () => {
  let now = NOW;
  const T = makeTimes({}, { rand: seeded(74), now: () => now });
  T.setStep(14);
  ropeAll(T, T.wave());
  now += 10 * 60e3;
  assert.equal(T.wave().warmup, false, 'a short break is the same session');
  now += 2 * HOUR;
  const w = T.wave();
  assert.equal(w.warmup, true, 'after a long one: warm-ups');
  assert.equal(T.state.session, 2);
});

test('a wave holds `count` targets (the round-up spawns one steer per target)', () => {
  const T = make(75);
  for (let step = 1; step <= LADDER.length; step++) {
    for (const count of [4, 6, 8, 10, 12]) {
      T.setStep(step);
      const w = T.wave({ count });
      if (w.kind === 'rule') assert.equal(w.targets.length, count, `step ${step}, ${w.rule}, count ${count}`);
      else assert.equal(w.targets.length, Math.min(count, 6), 'missing-number cards carry up to 6 answers');
      ropeAll(T, w);
    }
  }
  // Very big herds: never more than asked, but the smallest tables run out of sensible strays.
  T.setStep(1);
  const big = T.wave({ count: 20 });
  assert.ok(big.targets.length <= 20 && big.targets.length >= 12, `${big.rule}: ${big.targets.length}`);
});

test('the topic interface other topics will share', () => {
  // (more topics join as they are built: times tables is always one of them, and an unknown id is never one)
  assert.equal(HERD_TOPICS[0], 'times');
  assert.equal(hasTopic('times'), true);
  assert.equal(hasTopic('nope'), false);
  assert.equal(makeTopic('nope', {}), null);
  const state = {};
  const T = makeTopic('times', state, { rand: seeded(1) });
  assert.equal(T.topic, 'times');
  assert.equal(T.name, 'Times tables');
  for (const k of ['wave', 'answer', 'explain', 'hint', 'level', 'due']) assert.equal(typeof T[k], 'function', k);
  assert.equal(T.state, state, 'the state object passed in is the one changed');
  const w = T.wave();
  assert.ok(w.rule && w.targets.every(x => 'n' in x && 'good' in x));
});

test('dealing waves is quick', () => {
  const T = make(50);
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) { T.setStep(1 + (i % LADDER.length)); ropeAll(T, T.wave()); }
  const ms = performance.now() - t0;
  assert.ok(ms < 3000, `${ms.toFixed(0)} ms for 2000 waves`);
});

test('skipLine handles the edges', () => {
  assert.deepEqual(skipLine(2, 1).skip, ['(1)', 2]);
  assert.deepEqual(skipLine(10, 95).skip, [50, 60, 70, 80, 90, '(95)', 100]);
  assert.deepEqual(skipLine(3, 3).skip, [3]);
});
