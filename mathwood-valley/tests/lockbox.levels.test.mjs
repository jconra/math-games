// The lock boxes on the levels: the ladder's makers (src/lockbox/levelbox.js, findx.js), the plan for a rider and where
// an answer goes (src/lockbox/levelplan.js), and the rules card's words (src/lockbox/rules.js).
// Run with:  node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const { PLACE } = await import('../src/levels/places.js');
const LV = await import('../src/levels/model.js');
const { levelBox, levelExample, boxText, factTables } = await import('../src/lockbox/levelbox.js');
const { findProblem, findHint, subText } = await import('../src/lockbox/findx.js');
const { planLevelBox, recordPlan, isAlgebra, ALGEBRA_FROM } = await import('../src/lockbox/levelplan.js');
const { makeAlgebra } = await import('../src/lockbox/algebra.js');
const { makeRng, generate, RUNG, RUNG_IDS } = await import('../src/lockbox/generate.js');
const { evalSide, F, lineText, solve } = await import('../src/lockbox/engine.js');
const { stepsRoute } = await import('../src/lockbox/steps.js');
const { rulesHTML, ALGEBRA_TITLE } = await import('../src/lockbox/rules.js');
const Facts = await import('../src/math/facts.js');

const LADDER = PLACE.lockbox.levels;
const L = (id) => LADDER.find((x) => x.id === id);
const idx = (id) => LADDER.findIndex((x) => x.id === id);
const makesTrue = (p, v) => evalSide(p.start.L, F(v)).eq(evalSide(p.start.R, F(v)));
const numsOf = (p) => [...p.start.L, ...p.start.R].filter((t) => t.t === 'n').map((t) => Math.abs(t.v.n));

test('the design\'s order: the picture boxes, find x to 10, 15, 20, times, divided by, bigger, two steps, then x on both sides', () => {
  assert.deepEqual(LADDER.slice(0, 11).map((x) => x.id), ['whatAdd', 'whatSub', 'x10', 'x15', 'x20', 'xMul', 'xDiv', 'xBig', 'two', 'twoNeg', 'both']);
  assert.equal(ALGEBRA_FROM, 'both');
  assert.equal(PLACE.lockbox.fastFrom, 'both');
  for (const lv of LADDER) assert.equal(lv.count, idx(lv.id) < idx('both') ? 5 : 10, `${lv.id}: 5 boxes below x on both sides, 10 from there`);
  assert.ok(Math.abs(LV.levelPct('lockbox', 'both') - 50) <= 5, 'x on both sides about halfway up');
});

test('below x on both sides every box is FOUND (a tap, no moves); from there every box is worked with moves', () => {
  const rng = makeRng(4);
  for (const lv of LADDER) {
    for (let into = 0; into < lv.count; into++) {
      const p = levelBox(lv.gen, { rng, into, count: lv.count });
      if (idx(lv.id) < idx('both')) {
        assert.ok(p.mode === 'count' || p.mode === 'key', `${lv.id}: ${p.mode}`);
        assert.ok(Array.isArray(p.choices) && p.choices.includes(p.answer), `${lv.id}: the answer is one of the keys`);
        assert.equal(isAlgebra(lv.id), false);
      } else {
        assert.ok(['moves', 'ineq', 'work'].includes(p.mode), `${lv.id}: ${p.mode}`);
        assert.equal(isAlgebra(lv.id), true);
      }
    }
  }
});

test('find x: exactly one key makes both sides the same; keys differ; the answer is never printed in the line', () => {
  const rng = makeRng(21);
  for (const lv of LADDER.filter((x) => x.gen.find === true)) {
    for (let k = 0; k < 60; k++) {
      const p = levelBox(lv.gen, { rng, into: k % 5, count: 5 });
      assert.equal(p.choices.length, lv.gen.keys, `${lv.id}: ${lv.gen.keys} keys`);
      assert.equal(new Set(p.choices).size, p.choices.length, `${lv.id}: ${p.choices}`);
      assert.deepEqual(p.choices.filter((v) => makesTrue(p, v)), [p.answer], `${lineText(p.start)}: ${p.choices}`);
      if (!lv.gen.neg) assert.ok(p.choices.every((v) => v > 0), `${lv.id}: no negative keys (${p.choices})`);
      assert.ok(!numsOf(p).includes(Math.abs(p.answer)) || p.answer < 0, `${lineText(p.start)}: x is printed`);
      assert.equal(p.par, 1);
    }
  }
});

test('the numbers stay in the level and grow across it: up to 10, then 11 to 15, then 16 to 20', () => {
  const rng = makeRng(8);
  const most = (id, into) => Math.max(...Array.from({ length: 80 }, () => Math.max(...numsOf(levelBox(L(id).gen, { rng, into, count: 5 })), levelBox(L(id).gen, { rng, into, count: 5 }).answer)));
  assert.ok(most('x10', 4) <= 10);
  assert.ok(most('x15', 0) <= 11 && most('x15', 4) === 15, `${most('x15', 0)} ${most('x15', 4)}`);
  assert.ok(most('x20', 0) <= 16 && most('x20', 4) === 20);
  assert.ok(most('whatAdd', 0) <= 7 && most('whatAdd', 4) <= 10, 'the picture boxes: sums growing to 10');
  // the picture boxes: "what" in words, taking away only on its level
  for (let k = 0; k < 30; k++) {
    const a = levelBox(L('whatAdd').gen, { rng, into: k % 5 }), s = levelBox(L('whatSub').gen, { rng, into: k % 5 });
    assert.match(a.words, /plus what equals/); assert.match(s.words, /take away what leaves/);
    assert.ok(a.say && s.say, 'read out loud from the clips');
  }
});

test('times and divided by ask the rider\'s own fact, easy tables first across the level', () => {
  const p = levelBox(L('xMul').gen, { rng: makeRng(1), fact: { a: 7, b: 8 } });
  assert.equal(lineText(p.start).replace(/^56 = 7x$/, '7x = 56'), '7x = 56'); assert.deepEqual(p.fact, { a: 7, b: 8 });
  const d = levelBox(L('xDiv').gen, { rng: makeRng(1), fact: { a: 4, b: 3 } });
  assert.equal(d.answer, 12); assert.deepEqual(d.fact, { a: 4, b: 3 });
  assert.deepEqual(factTables(0, 5), [2, 3, 5, 10]);
  assert.ok(factTables(4, 5).includes(7));
  // a rider: the plan picks the fact and the answer goes to the times chart
  const r = { name: 'T' };
  LV.setLevelAt(r, 'lockbox', 'xMul');
  const alg = makeAlgebra({}, { rng: makeRng(2), strand: true });
  const { plan, problem } = planLevelBox(r, alg, { rng: makeRng(3) });
  assert.equal(plan.id, 'xMul');
  assert.ok(problem.fact && [2, 3, 5, 10].includes(problem.fact.a), JSON.stringify(problem.fact));
  recordPlan(r, plan, problem, { right: false });
  assert.equal(Facts.colourOf(r, problem.fact.a, problem.fact.b), 'red');
});

test('from x on both sides: + and − first, then ×, then ÷; every box has a route on the steps card', () => {
  const rng = makeRng(13);
  for (const id of ['both', 'bothMul', 'bothDiv', 'opp', 'paren', 'vault']) {
    for (let into = 0; into < 10; into++) {
      const p = levelBox(L(id).gen, { rng, into, count: 10 });
      const st = RUNG[p.rung].stage;
      if (p.kind === 'one') assert.ok(stepsRoute(p.start, st), `${id}: ${lineText(p.start)} has a route`);
      if (id === 'both') {
        assert.ok(lineText(p.start).split('=').every((s) => /x/.test(s)), `${lineText(p.start)}: x on both sides`);
        assert.ok(!st.mul && !st.div, 'no × or ÷ moves yet');
        assert.ok(p.par <= 2);
      }
      if (id === 'bothDiv') assert.match(lineText(p.start), /x\/\d/);
    }
  }
  // B1 and B3 sit outside the old ladder's order (the sheep and old saves read it by index)
  assert.ok(!RUNG_IDS.includes('B1') && !RUNG_IDS.includes('B3') && RUNG.B1 && RUNG.B3);
});

test('a new rider starts at "what plus 3 equals 8" and climbs one level a right box; a miss is checked', () => {
  const r = { name: 'N' };
  const alg = makeAlgebra({}, { rng: makeRng(5), strand: true });
  const seen = [];
  for (let k = 0; k < 4; k++) {
    const { plan, problem } = planLevelBox(r, alg, { rng: makeRng(10 + k) });
    seen.push(plan.id);
    assert.equal(plan.placing, true);
    recordPlan(r, plan, problem, { right: true });
  }
  assert.deepEqual(seen, ['whatAdd', 'whatSub', 'x10', 'x15']);
  // a miss: the same level asked again
  let { plan, problem } = planLevelBox(r, alg, { rng: makeRng(30) });
  recordPlan(r, plan, problem, { right: false });
  assert.equal(planLevelBox(r, alg, { rng: makeRng(31) }).plan.id, plan.id);
});

test('a new sitting opens with one warm-up box from the level below; a right one there doesn\'t move the rider', () => {
  const r = { name: 'W' };
  LV.setLevelAt(r, 'lockbox', 'x20', { into: 2 });
  const state = { lastAt: Date.now() - 3 * 3600 * 1000 };
  const alg = makeAlgebra(state, { rng: makeRng(6), strand: true });
  assert.equal(state.warm, 2);
  const a = planLevelBox(r, alg, { rng: makeRng(7) });
  assert.equal(a.plan.id, 'x15'); assert.equal(a.plan.kind, 'warm');
  recordPlan(r, a.plan, a.problem, { right: true });
  assert.deepEqual([LV.stateOf(r, 'lockbox').id, LV.stateOf(r, 'lockbox').into], ['x20', 2]);
  assert.equal(planLevelBox(r, alg, { rng: makeRng(8) }).plan.id, 'x20', 'then the rider\'s own level');
});

test('fast boxes count double only from x on both sides; 10 boxes a level there', () => {
  const run = (id) => {
    const r = { name: 'F' };
    LV.setLevelAt(r, 'lockbox', id);
    const alg = makeAlgebra({}, { rng: makeRng(9), strand: true });
    const t0 = Date.now();
    for (let k = 0; k < 6; k++) { const { plan, problem } = planLevelBox(r, alg, { rng: makeRng(k) }); recordPlan(r, plan, problem, { right: true, ms: 10000, size: 2, now: t0 + k }); }
    const { plan, problem } = planLevelBox(r, alg, { rng: makeRng(99) });
    return recordPlan(r, plan, problem, { right: true, ms: 5000, size: 2, now: t0 + 9 });
  };
  assert.equal(run('two').fast, false, 'two steps: finding x, never double');
  assert.equal(run('bothMul').fast, true, 'from x on both sides a fast box counts double');
});

test('an answer goes to the level AND to its strand at the level\'s grade (the stats\' kinds of math)', () => {
  const r = { name: 'S' };
  LV.setLevelAt(r, 'lockbox', 'x15');
  const alg = makeAlgebra({}, { rng: makeRng(1), strand: true });
  const { plan, problem } = planLevelBox(r, alg, { rng: makeRng(2) });
  recordPlan(r, plan, problem, { right: true });
  assert.equal(LV.stateOf(r, 'lockbox').into, 1);
  assert.ok(r.skill.strands.eq.h.length === 1 && r.skill.strands.eq.h[0][1] === L('x15').grade);
  assert.ok(r.skill.strands.add || r.skill.strands.sub, 'a find-x box also counts in its adding or taking away (half weight)');
  // a box made some other way (the store's equation) is recorded the old way, on the strands only
  const p = generate('R6', { rng: makeRng(3) });
  recordPlan(r, { map: 'lockbox', strand: 'eq', at: 56, rung: 'R6' }, p, { right: true });
  assert.equal(LV.stateOf(r, 'lockbox').into, 1, 'the level is not moved');
});

test('Ask Hob on a find-x box: try a key, then the way back from the answer, then the answer', () => {
  const p = findProblem({ shapes: ['x+a=b'], max: 10, keys: 3 }, { rng: makeRng(4) });
  assert.match(findHint(p, 1), /Try a key/);
  assert.match(findHint(p, 2), /Take \d+ away from \d+/);
  assert.match(findHint(p, 3), new RegExp(`x = ${p.answer}`));
  const q = findProblem({ shapes: ['ax+b=c'], max: 10, keys: 4 }, { rng: makeRng(5) });
  assert.match(findHint(q, 2), /First take/);
  assert.equal(subText(q.start.L, 3).replace(/\d+ × 3/, 'k × 3').includes('k × 3'), true);
});

test('the ladder\'s examples come from the same maker the game deals from', () => {
  for (const lv of LADDER) {
    const ex = PLACE.lockbox.example(lv, () => 0.3);
    const own = levelExample(lv.gen, () => 0.3);
    assert.deepEqual(ex, own, lv.id);
    assert.ok(ex.q && ex.a && !/undefined|NaN/.test(ex.q + ex.a), `${lv.id}: ${JSON.stringify(ex)}`);
  }
  assert.deepEqual(boxText(levelBox(L('whatSub').gen, { rng: makeRng(1) })).q.slice(-1), '?');
});

test('"You\'ve reached algebra!": the golden rule, a worked example and the steps', () => {
  const html = rulesHTML({ first: true });
  assert.match(html, /Whatever you do to one side, do to the other/);
  assert.match(html, /both sides/);
  assert.match(html, /Open the brackets/);
  assert.equal(ALGEBRA_TITLE, 'You’ve reached algebra!');
  assert.ok(!/both sides<\/b>\. Guessing/.test(rulesHTML({ first: false })), 'the cheer only the first time');
  assert.match(rulesHTML({ flip: 'flip the sign' }), /flip the sign/);
});
