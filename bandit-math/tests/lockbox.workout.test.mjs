// The "Work it out" boxes (src/lockbox/workout.js): order of operations O1..O5 and exponents P1..P5. The order engine
// works expressions by the rules; every box at every size plays from its start to its answer with one right choice a
// step and real slips for the wrong ones; each step credits the right strand (strand.js workCredit); the lock box
// brings them in about one box in four once they fit; simulated riders settle near their own 80% point on them.
import test from 'node:test';
import assert from 'node:assert/strict';

const W = await import('../src/lockbox/workout.js');
const SK = await import('../src/math/skill.js');
const ST = await import('../src/lockbox/strand.js');
const { makeAlgebra } = await import('../src/lockbox/algebra.js');
const { makeRng, generate } = await import('../src/lockbox/generate.js');

const T0 = Date.UTC(2026, 9, 18, 15);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const rider0 = () => ({ topics: { algebra: {} }, skill: { v: 1, migrated: 1, strands: {} } });
// the value of a text the way JavaScript reads it (2^3 as 2 ** 3, √49 as 7, 1/8 as 0.125, 1,000 as 1000)
const js = (t) => Function(`return (${String(t).replace(/,/g, '').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/')
  .replace(/√(\d+)/g, 'Math.sqrt($1)').replace(/\^(-?\d+)/g, '**($1)').replace(/\(-(\d+)\)\*\*/g, '(-$1)**')});`)();

test('the order engine works expressions by the rules', () => {
  const cases = {
    '3 + 4 * 2': 11, '(3 + 4) * 2': 14, '12 / 3 * 2': 8, '10 - 4 + 3': 9, '2 + 3^2 * 2': 20, '(-2)^2 + 5': 9,
    '-3 + 4 * (-2)': -11, '6 - (-3) * 2': 12, '-12 / (5 - 8)': 4, '(1 + 2)^2 * 2': 18, '2 * (3^2 - 4)': 10, '20 - 2 * (8 - 5) + 1': 15,
  };
  for (const [t, v] of Object.entries(cases)) assert.equal(W.valueOf(t), v, t);
  // a negative answer after an operation is written in brackets
  let toks = W.parse('-3 + 4 * (-2)');
  toks = W.apply(toks, W.nextOp(toks));
  assert.equal(W.toText(W.piecesOf(toks)), '−3 + (−8)');
  // a bracket left with one number goes, unless a power or an operation needs it round a negative
  toks = W.parse('(1 + 2)^2 * 2'); toks = W.apply(toks, W.nextOp(toks));
  assert.equal(W.toText(W.piecesOf(toks)), '3^2 × 2');
  toks = W.parse('-12 / (5 - 8)'); toks = W.apply(toks, W.nextOp(toks));
  assert.equal(W.toText(W.piecesOf(toks)), '−12 ÷ (−3)');
});

test('"which part first?" offers the real slips, each with the rule it broke', () => {
  const firstPick = (t) => W.orderSteps(t, makeRng(1)).steps[0];
  let p = firstPick('3 + 4 * 2');
  assert.equal(p.right, '4 × 2');
  assert.match(p.choices.find((c) => c.text === '3 + 4').why, /× and ÷ come before \+ and −/);
  p = firstPick('(2 + 3) * 4');
  assert.equal(p.right, '2 + 3');
  assert.match(p.choices.find((c) => c.text === '3 × 4').why, /Brackets first/);
  p = firstPick('4 * 2^2 + 1');
  assert.equal(p.right, '2^2');
  assert.match(p.choices.find((c) => c.text === '4 × 2').why, /power/);
  p = firstPick('(3 + 2)^2 * 4');
  assert.equal(p.right, '3 + 2');
  assert.match(p.choices.find((c) => c.text === '2^2').why, /Brackets first/);
  p = firstPick('12 / 3 * 2');
  assert.equal(p.right, '12 ÷ 3');
  assert.match(p.choices.find((c) => c.text === '3 × 2').why, /left to right/);
  p = firstPick('10 - 4 + 3');
  assert.equal(p.right, '10 − 4');
  assert.match(p.choices.find((c) => c.text === '4 + 3').why, /left to right/);
  // the part after a pick is the part picked
  const w = W.orderSteps('3 + 4 * 2', makeRng(2));
  assert.equal(w.steps[1].q, '4 × 2');
  assert.deepEqual(w.steps[1].span, w.steps[0].choices.find((c) => c.right).span);
  // the slips among a part's answers: 4 + 2 for 4 × 2, 3 × 2 for 3², the sign for a negative
  assert.ok(w.steps[1].choices.some((c) => c.text === '6' && /Times means/.test(c.nudge)));
  const pw = W.orderSteps('3^2 + 1', makeRng(3)).steps.find((s) => s.kind === 'part');
  assert.ok(pw.choices.some((c) => c.text === '6'), 'three squared as three times two');
  const ng = W.orderSteps('-5 - 3 * 2', makeRng(4)).steps.at(-1);
  assert.ok(ng.choices.some((c) => c.text === '11'), 'the sign slip');
});

test('every box at every size plays from its start to its answer: one right choice a step, real wrong ones', () => {
  const rng = makeRng(11);
  const counts = {};
  for (const id of W.WORK_IDS) {
    for (const frac of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      for (let i = 0; i < 60; i++) {
        const p = W.workProblem(id, { rng, frac });
        assert.equal(p.mode, 'work');
        assert.equal(p.par, p.steps.length);
        assert.equal(p.lines.length, p.steps.filter((s) => s.kind === 'part').length + 1, `${id} ${p.start}: a line per part`);
        assert.ok(Math.abs(js(p.start) - js(p.answer)) < 1e-9, `${id}: ${p.start} = ${p.answer}`);
        for (const s of p.steps) {
          const rights = s.choices.filter((c) => c.right);
          assert.equal(rights.length, 1, `${id} ${p.start}: one right choice`);
          assert.ok(s.choices.length >= (s.kind === 'pick' ? 2 : 3) && s.choices.length <= 4, `${id} ${p.start}: ${s.choices.length} choices`);
          assert.equal(new Set(s.choices.map((c) => c.text)).size, s.choices.length, `${id} ${p.start}: no two choices read the same`);
          if (s.kind === 'pick') {
            for (const c of s.choices) if (!c.right) assert.ok(c.why, 'a wrong pick says why');
          } else {
            assert.equal(rights[0].text, s.answer);
            for (const c of s.choices) if (!c.right) assert.ok(c.nudge, `${id} ${s.q}: a wrong answer says why (${c.text})`);
            if (s.eq === '=' && !/\^|√|÷ \d+\^/.test(s.q) && !s.x) assert.ok(Math.abs(js(s.q) - js(s.answer)) < 1e-9, `${s.q} = ${s.answer}`);
            assert.ok(s.help, 'every part has help');
          }
        }
        if (p.map === 'order') assert.ok(p.steps[0].kind === 'pick', 'an order box starts with "which part first?"');
        counts[id] = (counts[id] || 0) + 1;
      }
    }
  }
  assert.equal(Object.keys(counts).length, 10);
  // the boxes the generator makes on a chosen rung are these
  assert.equal(generate('O3', { rng, size: 3 }).mode, 'work');
});

test('order boxes grow: two operations at the bottom of a rung, three above it (fewer lucky picks)', () => {
  const rng = makeRng(12);
  const ops = (p) => (p.start.match(/[+−×÷]/g) || []).length;
  for (const id of ['O1', 'O2']) {
    assert.ok(Array.from({ length: 40 }, () => ops(W.workProblem(id, { rng, frac: 0 }))).every((n) => n === 2), id);
    assert.ok(Array.from({ length: 40 }, () => ops(W.workProblem(id, { rng, frac: 0.6 }))).every((n) => n === 3), id);
  }
  // the bigger rungs have more picks
  const picks = (id) => mean(Array.from({ length: 60 }, () => W.workProblem(id, { rng, frac: 0.5 }).steps.filter((s) => s.kind === 'pick').length));
  assert.ok(picks('O3') >= 2, `O3 ${picks('O3')}`);
});

test('each step credits the strand it exercises; a pick and a power rule count in the box', () => {
  assert.deepEqual(ST.workCredit({ kind: 'pick' }), { x: true });
  assert.deepEqual(ST.workCredit({ kind: 'part', x: true }), { x: true });
  assert.deepEqual(ST.workCredit({ kind: 'part', op: '÷', a: -27, b: -3 }), { strand: 'div', at: 29 });   // (the plain fact, sign aside)
  assert.deepEqual(ST.workCredit({ kind: 'part', op: '×', a: 4, b: 8 }), { strand: 'mul', at: 26 });   // (the 4s table)
  assert.deepEqual(ST.workCredit({ kind: 'part', op: '×', a: 7, b: 7 }), { strand: 'mul', at: 45 });   // (the 7s)
  assert.equal(ST.workCredit({ kind: 'part', op: '+', a: 3, b: 16 }).strand, 'add');
  assert.deepEqual(ST.workCredit({ kind: 'part', op: '−', a: 5, b: 8 }), { strand: 'sub', at: 72 });   // (past zero)
  assert.deepEqual(ST.workCredit({ kind: 'part', op: '^', a: 3, b: 2 }), { strand: 'pow', at: 58 });
  assert.deepEqual(ST.workCredit({ kind: 'part', op: '^', a: -2, b: 2 }), { strand: 'pow', at: 62 });
  // every part of every box has a credit (arithmetic in its strand, or the box)
  const rng = makeRng(13);
  for (const id of W.WORK_IDS) {
    for (let i = 0; i < 30; i++) {
      for (const s of W.workProblem(id, { rng, frac: rng.next() }).steps) {
        const cr = ST.workCredit(s);
        assert.ok(cr, `${id} ${s.q || s.right}`);
        if (!cr.x) assert.ok(cr.at <= SK.maxOf(cr.strand), `${id}: ${cr.strand} ${cr.at} is past that strand's top`);
      }
    }
  }
  // a box is recorded in its strand at its point
  const r = rider0();
  SK.setLevel(r, 'order', 50);
  const plan = ST.planOf({ rung: 'O2' });
  assert.equal(plan.strand, 'order');
  assert.equal(plan.at, 52);
  ST.recordBox(r, plan, { rung: 'O2', mode: 'work' }, { right: true, ms: 9000, size: 4, now: T0 });
  assert.equal(SK.levelOf(r, 'order'), 51);
});

test('the lock box brings them in about one box in four once they fit, never two running, never for the youngest', () => {
  const share = (setUp, n = 600) => {
    const rng = makeRng(14);
    const r = rider0();
    setUp(r);
    const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
    let work = 0, run = 0, maxRun = 0;
    const maps = {};
    for (let k = 0; k < n; k++) {
      const plan = ST.planBox(r, alg, { rng, now: T0 + k * 40000 });
      const p = alg.next('iron', plan);
      const isWork = !!W.WORK_RUNG[plan.rung];
      assert.equal(isWork, p.mode === 'work', 'the box is the plan\'s');
      if (isWork) { work++; run++; maxRun = Math.max(maxRun, run); maps[plan.map] = (maps[plan.map] || 0) + 1; } else run = 0;
      ST.recordBox(r, plan, p, { right: rng.next() < 0.8, now: T0 + k * 40000 });
      alg.record({ rung: p.rung, clean: true, solved: true });
    }
    return { share: work / n, maxRun, maps };
  };
  const placedAt = (lv) => (r) => { for (const [s, v] of Object.entries(lv)) SK.setLevel(r, s, v); };
  // an algebra rider whose arithmetic is well along: order of operations fits (its seed is 0.7 x the four)
  const mid = share(placedAt({ eq: 70, add: 70, sub: 70, mul: 55, div: 55 }));
  assert.ok(mid.share > 0.15 && mid.share < 0.3, `share ${mid.share}`);
  assert.equal(mid.maxRun, 1, 'never two running');
  // further up, exponents join in
  const top = share(placedAt({ eq: 90, add: 90, sub: 90, mul: 60, div: 60, order: 70, pow: 70 }));
  assert.ok(top.maps.order > 0 && top.maps.pow > 0, JSON.stringify(top.maps));
  // the youngest and a rider whose arithmetic is low: none
  assert.equal(share(placedAt({ eq: 3 }), 200).share, 0);
  assert.equal(share(placedAt({ eq: 40, add: 30, sub: 30, mul: 20, div: 20 }), 200).share, 0);
  // the equations stay the main work
  assert.ok(1 - mid.share > 0.7);
});

test('simulated riders settle near their own 80% point on the order boxes (3 seed sets)', () => {
  // p(know the order at point d) = 1 / (1 + exp((d - th) / 4)); a kid who doesn't know picks among the choices; the box
  // is right when every pick is right (the arithmetic parts count in their own strands)
  const know = (d, th) => 1 / (1 + Math.exp((d - th) / 4));
  for (const set of [1, 2, 3]) {
    for (const th of [50, 62, 74]) {
      const levels = [], rights = [];
      for (let kid = 0; kid < 10; kid++) {
        const rng = makeRng(set * 7919 + th * 31 + kid);
        const r = rider0();
        for (const [s, v] of Object.entries({ eq: 80, add: 80, sub: 80, mul: 58, div: 58 })) SK.setLevel(r, s, v);
        const lv = [], rt = [];
        for (let b = 0; b < 140; b++) {
          const plan = { ...ST.planOf({ rung: SK.stepFor(r, 'order').id }), ...(() => { const q = SK.stepFor(r, 'order'); return { at: q.below ? 45 : q.at, frac: q.frac, rung: q.id }; })() };
          const p = W.workProblem(plan.rung, { rng, frac: plan.frac });
          let right = true;
          for (const s of p.steps.filter((x) => x.kind === 'pick')) {
            const ok = rng.next() < know(plan.at, th) + (1 - know(plan.at, th)) / s.choices.length;
            if (!ok) right = false;
          }
          ST.recordBox(r, plan, p, { right, now: T0 + b * 40000 });
          if (b >= 70) { lv.push(SK.levelOf(r, 'order')); rt.push(right ? 1 : 0); }
        }
        levels.push(mean(lv)); rights.push(mean(rt));
      }
      const m = mean(rights);
      assert.ok(m > 0.72 && m < 0.88, `set ${set}, ability ${th}: ${(100 * m).toFixed(1)}% right, level ${mean(levels).toFixed(1)}`);
      assert.ok(Math.abs(mean(levels) - th) < 12, `set ${set}, ability ${th}: level ${mean(levels).toFixed(1)}`);
    }
  }
});
