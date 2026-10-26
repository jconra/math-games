// The lock box on the strands (src/lockbox/strand.js, kbox.js): which box comes next at every level of the equations
// and inequalities strands, the kindergarten boxes at the bottom, what each answer credits (the box in its strand, each
// number part in its own strand at its point, an x part in the box), the read-aloud lines, the old ladder's fields
// kept in step for the deer, the sheep and the sheriff's tier, and simulated riders whose level follows their answers.
// Simulated riders answer a question asked at point d right with chance
//   p(d) = G + (1 - G - SLIP) / (1 + exp((d - th) / W))   (G: a lucky guess; SLIP: a careless slip; W: how gradually it gets harder)
import test from 'node:test';
import assert from 'node:assert/strict';

const SK = await import('../src/math/skill.js');
const ST = await import('../src/lockbox/strand.js');
const KB = await import('../src/lockbox/kbox.js');
const { makeAlgebra } = await import('../src/lockbox/algebra.js');
const { generate, makeRng, RUNG, RUNG_IDS, verdictOf } = await import('../src/lockbox/generate.js');
const { makeBox } = await import('../src/lockbox/box.js');
const { makeIneqBox } = await import('../src/lockbox/ineqbox.js');
const { partsOf } = await import('../src/lockbox/parts.js');
const { bracketProducts } = await import('../src/lockbox/products.js');
const Q = await import('../src/lockbox/ineq.js');
const E = await import('../src/lockbox/engine.js');
const { compose } = await import('../src/audio/readaloud.js');

const T0 = Date.UTC(2026, 9, 18, 15);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const rider0 = () => ({ topics: { algebra: {} }, skill: { v: 1, migrated: 1, strands: {} } });
const curve = ({ G = 0, SLIP = 0.03, W = 4 } = {}) => {
  const p = (d, th) => G + (1 - G - SLIP) / (1 + Math.exp((d - th) / W));
  const d80 = (th) => { let lo = -60, hi = 160; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (p(m, th) > 0.8) lo = m; else hi = m; } return lo; };
  return { p, d80 };
};

// play a box along its good buttons: every part a kid would be asked, in order
function walk(problem, rng) {
  if (problem.mode !== 'moves' && problem.mode !== 'ineq') return [];
  const rung = RUNG[problem.rung], ineq = problem.mode === 'ineq';
  const B = ineq ? makeIneqBox(problem, { stage: rung.stage, level: 3, rng }) : makeBox(problem, { stage: rung.stage, level: 3, rng });
  const parts = [];
  for (let k = 0; k < 14 && !B.solved && !B.chainsSolved; k++) {
    if (!ineq && problem.kind !== 'one' && verdictOf(B.line)) break;   // (a vault verdict box: said once it shows)
    const g = (B.buttons?.slots || []).filter(Boolean).find((s) => s.role === 'good');
    if (!g) break;
    if (g.move.k === 'dist' && !ineq) for (const q of bracketProducts(B.line, { rng })) parts.push({ product: q });
    const P = ineq ? Q.chainParts(B.line, g.move, { rng }) : partsOf(B.line, g.move, { rng });
    if (P) parts.push(...P.qs);
    const res = B.press(g.move);
    if (!res || res.solved) break;
    B.makeButtons();
  }
  return parts;
}

// ---- the kindergarten boxes ----------------------------------------------------------------------------------------

test('kindergarten boxes: a + x = b and a − x = b with countable numbers, three answers, never the answer printed', () => {
  const rng = makeRng(1);
  for (const id of KB.K_IDS) {
    for (const frac of [0, 0.33, 0.67, 1]) {
      for (let i = 0; i < 150; i++) {
        const p = generate(id, { rng, frac });
        assert.equal(p.mode, 'count');
        assert.equal(p.kind, 'one');
        const got = p.op === '+' ? p.a + p.x : p.a - p.x;
        assert.equal(got, p.b, `${p.words} answers ${p.x}`);
        assert.equal(E.trueAnswer(p.start).x.n, p.x, 'the line itself solves to the answer');
        assert.ok(p.x >= 1 && p.a >= 1 && p.b >= 1 && Math.max(p.a, p.b) <= 10, p.key);
        if (id === 'K1') assert.ok(p.b <= 5 && p.op === '+', p.key);
        if (id === 'K2') assert.ok(p.b <= 10 && p.op === '+', p.key);
        assert.ok(p.x !== p.a && p.x !== p.b, `the answer is printed in ${p.words}`);
        assert.equal(p.choices.length, 3);
        assert.equal(new Set(p.choices).size, 3);
        assert.ok(p.choices.includes(p.x) && p.choices.every((c) => c >= 1), String(p.choices));
        assert.ok(KB.THING_SVG[p.thing], p.thing);
        // written the way it is said, and sayable from the maker's clips (never another voice)
        assert.match(p.words, p.op === '+' ? /^\d+ plus what equals \d+\?$/ : /^\d+ take away what leaves \d+\?$/);
        assert.ok(compose(p.say), `the clips can say "${p.say}"`);
      }
    }
  }
  // K3 takes away most of the time, and adds now and then
  const k3 = Array.from({ length: 400 }, () => generate('K3', { rng, frac: 0.5 }).op);
  const minus = k3.filter((o) => o === '−').length / k3.length;
  assert.ok(minus > 0.55 && minus < 0.75, `K3 takes away ${minus}`);
});

test('kindergarten boxes: hints look, then the picture help, then the answer; a wrong count says what it makes', () => {
  const p = generate('K1', { rng: makeRng(2), frac: 0.5 });
  const B = makeBox(p, { rng: makeRng(3) });
  assert.equal(B.par, 1);
  assert.match(B.hint().text, /^Count the /);
  assert.match(B.hint().text, p.op === '+' ? /empty spots/ : /Cross out/);
  assert.equal(B.hint().text, `It's ${p.answer}.`);
  const wrong = p.choices.find((c) => c !== p.answer);
  assert.equal(B.choose(wrong).ok, false);
  assert.equal(B.choose(p.answer).ok, true);
  const r = B.finish();
  assert.equal(r.solved, true);
  assert.equal(r.clean, false, 'a wrong count first: not clean');
  assert.match(KB.kNudge({ op: '+', a: 3, b: 5 }, 1), /^3 \+ 1 makes 4, not 5\.$/);
  assert.match(KB.kNudge({ op: '−', a: 7, b: 3 }, 2), /7 − 2 leaves 5, not 3\./);
});

// ---- the scale: a box at every level --------------------------------------------------------------------------------

test('a rider whose questions are read out gets boxes the clips can say, no further than their adding and taking away reach', () => {
  const rng = makeRng(21);
  // a 6-year-old at adding 1, taking away 0, the equations placed at 20: picture boxes and the balance, never x − 2 = 1
  const r = rider0(); r.age = 6;
  SK.setLevel(r, 'add', 1); SK.setLevel(r, 'sub', 0); SK.setLevel(r, 'eq', 20);
  const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
  const rungs = new Set();
  for (let k = 0; k < 40; k++) { const plan = ST.planBox(r, alg, { rng, now: T0 }); rungs.add(plan.rung); assert.ok(plan.at <= 10 + 0.05, `${plan.rung} at ${plan.at}`); }
  assert.ok([...rungs].every((id) => ['K1', 'K2', 'K3', 'R0a'].includes(id)), [...rungs].join(' '));
  // their adding grows: up to x + 4 = 9 (R1, read aloud), never R2 while read-aloud is on
  SK.setLevel(r, 'add', 30); SK.setLevel(r, 'sub', 30); SK.setLevel(r, 'eq', 40);
  for (let k = 0; k < 40; k++) { const plan = ST.planBox(r, alg, { rng, now: T0 }); assert.ok(['R0a', 'R0b', 'R1'].includes(plan.rung), plan.rung); }
  // read-aloud on for no sure reason (no age): not held, so a teen who skipped the age isn't held down with it
  const t = rider0(); SK.setLevel(t, 'eq', 20, { placed: false });
  assert.equal(SK.readAloud(t), true);
  assert.equal(ST.youngMost(t), null);
  t.readAloud = 'on';
  assert.equal(ST.youngMost(t), 24, 'read-aloud set to always: held');
  // read-aloud switched off by a grown-up: the equations as usual
  r.readAloud = false;
  assert.equal(ST.youngMost(r), null);
  const plans = Array.from({ length: 20 }, () => ST.planBox(r, alg, { rng, now: T0 }));
  assert.ok(plans.every((p) => p.rung === 'R4' || p.review) && plans.some((p) => p.rung === 'R4'), plans.map((p) => p.rung).join(' '));
});

test('boxes across the whole scale: every equations level 0..100 and inequalities level 64..100 makes a box on its rung', () => {
  const rng = makeRng(7);
  const seen = new Set();
  for (let lv = 0; lv <= 100; lv += 1) {
    const r = rider0();
    SK.setLevel(r, 'eq', lv);
    const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
    for (let k = 0; k < 3; k++) {
      const plan = ST.planBox(r, alg, { rng, now: T0 });
      const p = alg.next('iron', plan);
      assert.ok(p && p.start, `a box at ${lv}`);
      assert.equal(p.rung, plan.rung);
      seen.add(p.rung);
      // the point being asked in this box's strand: its level, or its baseline's probe while it is being found
      const st = r.skill.strands[plan.strand];
      const most = ST.youngMost(r), cap = most == null ? 100 : Math.max(SK.MAPS[plan.map].anchors[0], most);
      const at = Math.min(st.placed ? st.level : st.base.at, cap, SK.capOf(plan.map));   // (read aloud: held at most)
      // the rung is the one the level sits on (a review, warm-up or comeback is from below)
      if (plan.kind === 'level') {
        const want = SK.stepAt(plan.map, at);
        assert.equal(plan.rung, want.id, `level ${at} on ${plan.map}`);
        assert.equal(plan.at, want.below ? SK.MAPS[plan.map].anchors[0] : at);
        assert.equal(plan.level, ST.levelOfFrac(want.frac));
      } else {
        assert.ok(plan.review);
        assert.ok(plan.at <= at - ST.REVIEW.below, `a ${plan.kind} at ${plan.at} for a rider at ${at}`);
      }
      if (lv < 4) assert.equal(plan.map, 'lockboxK', 'under 4 only the kindergarten boxes');
      if (lv > 13) assert.notEqual(plan.map, 'lockboxK', 'past 13 no kindergarten boxes');
      if (p.mode === 'count') assert.ok(KB.K_RUNG[p.rung]);
      ST.recordBox(r, plan, p, { right: true, now: T0 });
      SK.setLevel(r, 'eq', lv);   // (stay at this level)
    }
  }
  for (let lv = 64; lv <= 100; lv += 2) {
    const r = rider0();
    SK.setLevel(r, 'eq', 96); SK.setLevel(r, 'ineq', lv);
    const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
    for (let k = 0; k < 6; k++) {
      const plan = ST.planBox(r, alg, { rng, now: T0 + k * 1000 });
      const p = alg.next('iron', plan);
      assert.ok(p, `an inequality box at ${lv}`);
      seen.add(p.rung);
      if (plan.map === 'lockboxIneq') assert.equal(p.mode, 'ineq');
    }
  }
  for (const id of [...KB.K_IDS, ...RUNG_IDS]) assert.ok(seen.has(id), `rung ${id} was dealt somewhere on the scale`);
});

test('the inequalities come in at equations 75, and stay on offer even when their own strand fell below I1', () => {
  const rng = makeRng(8);
  const share = (eqLv, ineqLv) => {
    const r = rider0();
    SK.setLevel(r, 'eq', eqLv);
    if (ineqLv != null) SK.setLevel(r, 'ineq', ineqLv);
    const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
    let n = 0;
    for (let k = 0; k < 300; k++) if (ST.planBox(r, alg, { rng, now: T0 + k * 60000 }).map === 'lockboxIneq') n++;
    return n / 300;
  };
  assert.equal(share(70), 0, 'not before');
  assert.ok(share(80) > 0.3, 'once the equations are past 75 (the strand starts at 0.85 of them)');
  // a rider whose first inequalities went badly: their strand sits at 50, under I1's gate (64)
  const low = share(84, 50);
  assert.ok(low > 0.2 && low < 0.45, `still about one box in three: ${low}`);
  const r = rider0(); SK.setLevel(r, 'eq', 84); SK.setLevel(r, 'ineq', 50);
  const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
  let plan;
  do plan = ST.planBox(r, alg, { rng, now: T0 }); while (plan.map !== 'lockboxIneq');
  assert.deepEqual([plan.rung, plan.at], ['I1', 70], 'at the first rung, recorded at its point');
  assert.equal(share(70, 50), 0, 'not while the equations are below INEQ.fromEq');
});

test('reviews: about one box in four once placed, never two running, from well below the level; warm-ups start a sitting', () => {
  const rng = makeRng(9);
  // (at 72 every box is an equation: the inequalities aren't in yet)
  const LV = 72;
  const r = rider0();
  SK.setLevel(r, 'eq', LV);
  const alg = makeAlgebra(r.topics.algebra, { rng, strand: true, now: () => T0 });
  const kinds = [];
  for (let k = 0; k < 400; k++) {
    const plan = ST.planBox(r, alg, { rng, now: T0 + k * 30000 });
    kinds.push(plan.kind);
    if (plan.review) {
      assert.ok(plan.at <= LV - ST.REVIEW.below, `a review at ${plan.at}`);
      assert.equal(plan.at, SK.pctAt('lockbox', plan.rung, (Math.min(4, plan.level) - 2) / 3), 'recorded at the rung\'s own point');
      assert.ok(RUNG[plan.rung].stage, 'a review is a solve-for-x box');
    }
    alg.record({ rung: plan.rung, clean: true, solved: true, moves: 1, par: 1 });
  }
  const rev = kinds.filter((k) => k === 'review').length / kinds.length;
  assert.ok(rev > 0.15 && rev < 0.3, `reviews ${rev}`);
  for (let i = 1; i < kinds.length; i++) assert.ok(!(kinds[i] !== 'level' && kinds[i - 1] === 'review' && kinds[i] === 'review'), 'two reviews running');
  // a new sitting: two warm-ups
  const st = JSON.parse(JSON.stringify(r.topics.algebra));
  const later = T0 + 400 * 30000 + 3 * 3600 * 1000;
  const alg2 = makeAlgebra(st, { rng, strand: true, now: () => later });
  const w = [];
  for (let k = 0; k < 3; k++) { const plan = ST.planBox(r, alg2, { rng, now: later }); w.push(plan.kind); alg2.record({ rung: plan.rung, clean: true, solved: true }); }
  assert.deepEqual(w.slice(0, 2), ['warm', 'warm']);
  assert.notEqual(w[2], 'warm');
  // no reviews while the level is still being found
  const f = rider0();
  const alg3 = makeAlgebra(f.topics.algebra, { rng, strand: true });
  const plan = ST.planBox(f, alg3, { rng, now: T0 });
  assert.equal(SK.isPlaced(f, 'eq'), false);
  assert.equal(plan.kind, 'level');
});

test('a missed box type comes back 2 to 4 boxes later, unless the level has dropped below it', () => {
  const rng = makeRng(10);
  const r = rider0();
  SK.setLevel(r, 'eq', 84);
  const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
  alg.record({ rung: 'R9', clean: false, solved: true });
  const got = [];
  for (let k = 0; k < 6; k++) { const plan = ST.planBox(r, alg, { rng, now: T0 + k }); got.push(plan.rung + ':' + plan.kind); alg.record({ rung: plan.rung, clean: true, solved: true }); }
  assert.ok(got.includes('R9:due'), got.join(' '));
  // the comeback for a rung now above the level is dropped
  const r2 = rider0(); SK.setLevel(r2, 'eq', 60);
  const alg2 = makeAlgebra(r2.topics.algebra, { rng, strand: true });
  alg2.record({ rung: 'R13', clean: false, solved: true });
  for (let k = 0; k < 6; k++) { const plan = ST.planBox(r2, alg2, { rng, now: T0 + k }); assert.notEqual(plan.rung, 'R13'); alg2.record({ rung: plan.rung, clean: true, solved: true }); }
  assert.equal(alg2.state.due.length, 0);
});

test('the vault: about one box in ten asks "infinitely many / no solution", never two running, never right after the rung went up', () => {
  const rng = makeRng(11);
  let v = 0, n = 0;
  for (let run = 0; run < 6; run++) {
    const r = rider0();
    SK.setLevel(r, 'eq', 97);
    const alg = makeAlgebra(r.topics.algebra, { rng: makeRng(600 + run), strand: true });
    ST.syncLadder(r, alg);
    let last = false;
    for (let k = 0; k < 80; k++) {
      const plan = ST.planBox(r, alg, { rng, now: T0 + k * 60000 });
      if (plan.rung !== 'R15') { alg.next('iron', plan); last = false; continue; }
      const p = alg.next('iron', plan);
      const verdict = p.kind !== 'one';
      n++; if (verdict) v++;
      assert.ok(!(verdict && last), 'two verdict boxes running');
      last = verdict;
      alg.record({ rung: p.rung, clean: true, solved: true });
    }
  }
  assert.ok(v / n > 0.04 && v / n < 0.18, `${v} of ${n}`);
  // just after the rung went up (R14 -> R15), the next box is a real one
  const r = rider0(); SK.setLevel(r, 'eq', 93);
  const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
  ST.syncLadder(r, alg);
  SK.setLevel(r, 'eq', 97);
  ST.syncLadder(r, alg);
  assert.equal(alg.state.justUp, true);
  for (let k = 0; k < 30; k++) {
    alg.state.justUp = true;
    assert.equal(alg.next('vault', { rung: 'R15', level: 3 }).kind, 'one');
  }
});

// ---- the credits --------------------------------------------------------------------------------------------------

test('the points of plain arithmetic follow the field ladders', () => {
  const c = (f, ...a) => { const r = f(...a); return r && `${r.strand} ${r.at}`; };
  assert.equal(c(ST.sumCredit, 2, 1), 'add 0');
  assert.equal(c(ST.sumCredit, 6, 4), 'add 9');
  assert.equal(c(ST.sumCredit, 8, 5), 'add 15');
  assert.equal(c(ST.sumCredit, 27, 6), 'add 24');
  assert.equal(c(ST.sumCredit, 36, 27), 'add 30');
  assert.equal(c(ST.sumCredit, 13, -5), 'sub 19');
  assert.equal(c(ST.sumCredit, 52, -27), 'sub 30');
  assert.equal(c(ST.sumCredit, -3, 7), 'add 60', 'a negative plus a positive');
  assert.equal(c(ST.sumCredit, -7, 3), 'add 64');
  assert.equal(c(ST.sumCredit, -4, -5), 'sub 68');
  assert.equal(c(ST.sumCredit, 3, -8), 'sub 72', 'taking away past zero');
  // one shape with bigger numbers sits a little above its own step, not at the mixed steps (82, 90)
  assert.equal(c(ST.sumCredit, -10, 18), 'add 64', '−3 + 7 with numbers to 20');
  assert.equal(c(ST.sumCredit, -30, 12), 'add 72', '−7 + 3 with numbers past 20');
  assert.equal(c(ST.sumCredit, -12, -5), 'sub 72');
  assert.equal(c(ST.sumCredit, 3, -18), 'sub 76');
  assert.equal(c(ST.timesCredit, 2, 8), 'mul 19', 'the 2s, not the 8s');
  assert.equal(c(ST.timesCredit, 3, 4), 'mul 26');
  assert.equal(c(ST.timesCredit, 7, 8), 'mul 39');
  assert.equal(c(ST.timesCredit, 7, 7), 'mul 45');
  assert.equal(c(ST.timesCredit, 4, 15), 'mul 52');
  assert.equal(c(ST.timesCredit, -3, 4), 'mul 26', 'with a negative: the plain fact (the sign rule is the box\'s own work)');
  assert.equal(c(ST.quotientCredit, 27, 9), 'div 33');
  assert.equal(c(ST.quotientCredit, 20, 5), 'div 25');
  assert.equal(c(ST.quotientCredit, 56, 8), 'div 37');
  assert.equal(c(ST.quotientCredit, 60, 4), 'div 45');
  assert.equal(c(ST.quotientCredit, -27, -3), 'div 29', 'division with negatives: the plain fact, 27 ÷ 3');
  assert.equal(ST.quotientCredit(7, 2), null, 'not whole: left out');
});

test('each part credits the strand it exercises: −27 ÷ (−3) in division, 5x − 4x in the box, the sign in the box', () => {
  const { line, xt, num, F, divBy, addX, addNum } = E;
  // −3x = −27, ÷(−3): "−27 ÷ (−3)"
  const P1 = partsOf(line([xt(-3)], [num(-27)]), divBy(F(-3)), {});
  const q1 = P1.qs.find((q) => q.prompt.includes('27'));
  assert.deepEqual(ST.partCredit(q1), { strand: 'div', at: 29 });
  // 5x = 4x + 27, −4x: "5x − 4x" is an x part
  const P2 = partsOf(line([xt(5)], [xt(4), num(27)]), addX(F(-4)), {});
  assert.equal(P2.qs.length, 1);
  assert.deepEqual(ST.partCredit(P2.qs[0]), { x: true });
  // x + 7 = 3, −7: "3 − 7" past zero
  const P3 = partsOf(line([xt(1), num(7)], [num(3)]), addNum(F(-7)), {});
  assert.deepEqual(ST.partCredit(P3.qs[0]), { strand: 'sub', at: 72 });
  // the inequalities' "which way does the sign point now?" is the box's own work
  const c = Q.chain([[xt(-3)], [num(12)]], ['≥']);
  const P4 = Q.chainParts({ form: 'one', chains: [c], active: 0 }, divBy(F(-3)), {});
  const sign = P4.qs.find((q) => q.kind === 'sign');
  assert.deepEqual(ST.partCredit(sign), { x: true });
  // brackets: 5 · x is algebra, 5 · 8 is multiplication
  const prods = bracketProducts(line([E.br(F(5), [xt(1), num(8)])], [num(60)]), {});
  assert.deepEqual(prods.map(ST.productCredit), [{ x: true }, { strand: 'mul', at: 19 }]);
  // every part on every rung credits something sensible
  const rng = makeRng(12);
  const by = {};
  for (const id of RUNG_IDS) {
    for (let i = 0; i < 12; i++) {
      const p = generate(id, { rng, size: 2 });
      for (const q of walk({ ...p, level: 3 }, rng)) {
        const cr = q.product ? ST.productCredit(q.product) : ST.partCredit(q);
        if (!cr) continue;
        const k = cr.x ? 'x' : cr.strand;
        by[k] = (by[k] || 0) + 1;
        if (!cr.x) { assert.ok(['add', 'sub', 'mul', 'div'].includes(cr.strand), id); assert.ok(cr.at >= 0 && cr.at <= SK.maxOf(cr.strand), `${id}: ${cr.strand} ${cr.at} is past that strand's top`); }
      }
    }
  }
  for (const k of ['add', 'sub', 'mul', 'div', 'x']) assert.ok(by[k] > 5, `parts credited to ${k}: ${JSON.stringify(by)}`);
});

test('recording a box: its strand at its point, the missing-number boxes in adding too, timed as a sit-down answer', () => {
  const r = rider0();
  SK.setLevel(r, 'eq', 30);
  const plan = { map: 'lockbox', strand: 'eq', rung: 'R2', level: 3, frac: 0.33, at: 28, kind: 'level', review: false };
  const p = generate('R2', { rng: makeRng(13), size: 2 });
  const out = ST.recordBox(r, plan, p, { right: true, ms: 9000, size: 3, now: T0 });
  assert.equal(out.eq.level, 31);
  assert.equal(out.eq.timed, true);
  assert.deepEqual(r.skill.strands.eq.t.at(-1), [9000, 3]);
  assert.equal(r.skill.strands.add, undefined, 'a moves box credits its parts, not the box, to adding');
  // a set-aside box is a miss
  ST.recordBox(r, plan, p, { right: false, now: T0 });
  assert.equal(SK.levelOf(r, 'eq'), 27);
  // a kindergarten box: equations, and adding at half weight
  const k = rider0();
  const kp = generate('K2', { rng: makeRng(14), frac: 0.5 });
  ST.recordBox(k, ST.planOf(kp, { frac: 0.5 }), kp, { right: true, now: T0 });
  assert.ok(SK.isMet(k, 'eq') && SK.isMet(k, kp.op === '+' ? 'add' : 'sub'));
  assert.equal(k.skill.strands.eq.h[0][1], 5.5, 'K2 halfway to K3: (4 + 7) / 2');
  // a box from the store (a set problem) is recorded at its rung's point
  const sp = { ...generate('R6', { rng: makeRng(15), size: 2 }), level: 3 };
  assert.equal(ST.planOf(sp).at, SK.pctAt('lockbox', 'R6', 1 / 3));
  // a number part: its own strand, size 1, timed
  const pr = ST.recordPart(r, { strand: 'div', at: 33 }, { right: true, ms: 2500, now: T0 });
  assert.equal(pr.div.timed, true);
  assert.equal(ST.recordPart(r, { x: true }, { right: true }), null, 'an x part is not recorded on its own');
});

test('the old ladder\'s fields follow the strand: the rung (never a kindergarten one), its level, placing, stamped', () => {
  const r = rider0();
  const alg = makeAlgebra(r.topics.algebra, { strand: true });
  SK.setLevel(r, 'eq', 3);
  ST.syncLadder(r, alg);
  assert.equal(r.topics.algebra.rung, 'R0a', 'a kindergarten level reads as the first rung');
  SK.setLevel(r, 'eq', 59);
  ST.syncLadder(r, alg);
  assert.deepEqual([r.topics.algebra.rung, r.topics.algebra.levels.R6, r.topics.algebra.placing], ['R6', 3, false]);
  assert.ok(r.topics.algebra.stamped.includes('R4') && !r.topics.algebra.stamped.includes('R6'));
  SK.setLevel(r, 'eq', 30, { placed: false });
  ST.syncLadder(r, alg);
  assert.equal(r.topics.algebra.placing, true);
  SK.setLevel(r, 'eq', 96); SK.setLevel(r, 'ineq', 80);
  ST.syncLadder(r, alg);
  assert.equal(r.topics.algebra.rung, 'I2');
  // the old readers still work: the deer's rung and the sheriff's tier
  assert.ok(RUNG[r.topics.algebra.rung]);
});

test('read aloud: the low boxes (kindergarten, balance, "Which key fits", add-on) and a plain sum or difference are said from the clips', () => {
  const k = generate('K3', { rng: makeRng(16), frac: 1 });
  assert.ok(compose(ST.boxSay(k)));
  const key = generate('R0b', { rng: makeRng(17), size: 1 });
  assert.match(ST.boxSay(key), /^\d+ and what make \d+$/);
  assert.ok(compose(ST.boxSay(key)));
  // every low box at every size can be said, and says its own numbers ("? + 2 = 4 + 3": "2 and what make 4 plus 3")
  const rng = makeRng(161);
  for (const id of [...KB.K_IDS, 'R0a', 'R0b', 'R1']) {
    for (const size of [1, 2, 3]) {
      for (let i = 0; i < 60; i++) {
        const p = generate(id, { rng, size });
        const said = ST.boxSay(p);
        assert.ok(said && compose(said), `${id}: "${said}" can be said`);
        const nums = said.match(/\d+/g).map(Number);
        const printed = E.lineText(p.start).match(/\d+/g).map(Number);
        assert.deepEqual([...nums].sort((a, b) => a - b), [...printed].sort((a, b) => a - b), `${id}: ${E.lineText(p.start)} said "${said}"`);
      }
    }
  }
  assert.equal(ST.boxSay(generate('R6', { rng: makeRng(18) })), null);
  assert.equal(ST.boxSay(generate('R2', { rng: makeRng(18) })), null, 'no clip says "what take away 3 leaves 5": not read');
  const { line, xt, num, F, addNum } = E;
  const P = partsOf(line([xt(1), num(4)], [num(9)]), addNum(F(-4)), {});
  assert.equal(ST.partSay(P.qs[0]), '9 minus 4');
  assert.ok(compose(ST.partSay(P.qs[0])));
  const N = partsOf(line([xt(1), num(7)], [num(3)]), addNum(F(-7)), {});
  assert.equal(ST.partSay(N.qs[0]), '3 minus 7');
  const neg = partsOf(line([xt(1), num(-10)], [num(-8)]), addNum(F(10)), {});
  assert.equal(ST.partSay(neg.qs[0]), null, 'no clip says "negative": not read');
  // a rider's questions are read while their best strand is under 30 (skill.js readAloud)
  const r = rider0(); SK.setLevel(r, 'eq', 5);
  assert.equal(SK.readAloud(r), true);
  SK.setLevel(r, 'mul', 40);
  assert.equal(SK.readAloud(r), false);
});

// ---- simulated riders -----------------------------------------------------------------------------------------------

test('a simulated rider\'s level moves with the answers: up with right boxes, down with misses', () => {
  const rng = makeRng(19);
  const r = rider0();
  SK.setLevel(r, 'eq', 40);
  const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
  const play = (right, n) => {
    for (let k = 0; k < n; k++) {
      const plan = ST.planBox(r, alg, { rng, now: T0 + k });
      const p = alg.next('iron', plan);
      ST.recordBox(r, plan, p, { right, now: T0 });
      alg.record({ rung: p.rung, clean: right, solved: true });
      ST.syncLadder(r, alg);   // (as the panel does after each box)
    }
  };
  play(true, 30);
  const up = SK.levelOf(r, 'eq');
  assert.ok(up > 55, `30 right boxes from 40: ${up}`);
  play(false, 5);
  assert.ok(SK.levelOf(r, 'eq') <= up - 12, `then 5 misses: ${SK.levelOf(r, 'eq')}`);
  assert.equal(r.topics.algebra.rung, SK.stepAt('lockbox', SK.levelOf(r, 'eq')).id, 'the ladder mirror follows');
});

test('simulated riders settle near their own 80% point on the boxes, from a baseline on first meeting (3 seed sets)', () => {
  const { p, d80 } = curve({ G: 0 });
  const kidP = curve({ G: 1 / 3 }).p;   // (a pick box: one of three answers)
  for (const set of [1, 2, 3]) {
    for (const th of [10, 40, 70, 90]) {
      const levels = [], rights = [];
      for (let kid = 0; kid < 12; kid++) {
        const rng = makeRng(set * 10007 + th * 101 + kid);
        const r = rider0();
        for (const s of ['add', 'sub']) SK.setLevel(r, s, Math.min(90, th));
        for (const s of ['mul', 'div']) SK.setLevel(r, s, Math.min(55, th));
        const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
        let lv = [], rt = [];
        for (let b = 0; b < 160; b++) {
          const plan = ST.planBox(r, alg, { rng, now: T0 + b * 40000 });
          const prob = alg.next('iron', plan);
          const pick = prob.mode !== 'moves' && prob.mode !== 'ineq';
          const th2 = plan.strand === 'ineq' ? th - 6 : th;
          const right = rng.next() < (pick ? kidP : p)(plan.at, th2);
          ST.recordBox(r, plan, prob, { right, now: T0 + b * 40000 });
          alg.record({ rung: prob.rung, clean: right, solved: true });
          if (b >= 80) { lv.push(SK.levelOf(r, 'eq')); if (plan.kind === 'level' && plan.strand === 'eq') rt.push(right ? 1 : 0); }
        }
        levels.push(mean(lv)); rights.push(mean(rt));
      }
      const target = Math.max(0, d80(th));
      const err = mean(levels) - target;
      assert.ok(Math.abs(err) <= (th === 10 ? 5 : 3.5), `set ${set}, ability ${th}: settles at ${mean(levels).toFixed(1)}, own 80% point ${target.toFixed(1)}`);
      if (th >= 40) assert.ok(mean(rights) > 0.74 && mean(rights) < 0.86, `set ${set}, ability ${th}: ${(100 * mean(rights)).toFixed(1)}% right at the level`);
    }
  }
});

test('the picture boxes are for riders who are read to; a part with a negative in it is told apart', () => {
  const rng = makeRng(31);
  const t = rider0(); t.age = 15;
  SK.setLevel(t, 'eq', 12);
  const alg = makeAlgebra(t.topics.algebra, { rng, strand: true });
  const rungs = new Set(Array.from({ length: 30 }, () => ST.planBox(t, alg, { rng, now: T0 }).rung));
  assert.ok(![...rungs].some((id) => /^K/.test(id)), `a teen at equations 12: ${[...rungs].join(' ')}`);
  const k = rider0(); k.age = 6; SK.setLevel(k, 'eq', 5);
  const algK = makeAlgebra(k.topics.algebra, { rng, strand: true });
  assert.ok(Array.from({ length: 20 }, () => ST.planBox(k, algK, { rng, now: T0 }).rung).some((id) => /^K/.test(id)), 'a 6-year-old still gets them');
  const { line, xt, num, F, addNum } = E;
  const P = partsOf(line([xt(1), num(7)], [num(3)]), addNum(F(-7)), {});
  assert.equal(ST.hasNegative(P.qs[0]), true, '3 − 7');
  const P2 = partsOf(line([xt(1), num(4)], [num(9)]), addNum(F(-4)), {});
  assert.equal(ST.hasNegative(P2.qs[0]), false, '9 − 4 (made as 9 + (−4)): plain taking away');
  const P3 = partsOf(line([xt(3)], [num(12)]), E.divBy(F(3)), {});
  assert.equal(ST.hasNegative(P3.qs.find((q) => q.kind === 'scale') || P3.qs[0]), false, '12 ÷ 3');
});

test('a teen (13 and up) is never dealt the coin-picture boxes R0a / R0b: the add-on box is their easiest, and the baseline\'s bottom', () => {
  const rng = makeRng(31);
  for (const lv of [3, 9, 13, 18]) {
    const r = rider0(); r.age = 15;
    SK.setLevel(r, 'eq', lv, { placed: false });
    const alg = makeAlgebra(r.topics.algebra, { rng, strand: true });
    for (let k = 0; k < 40; k++) {
      const plan = ST.planBox(r, alg, { rng, now: T0 + k * 60000 });
      if (plan.map !== 'lockbox') continue;
      assert.ok(!['R0a', 'R0b'].includes(plan.rung), `eq ${lv}: ${plan.rung}`);
      assert.equal(plan.floor, 20);
      ST.recordBox(r, plan, { rung: plan.rung, mode: 'moves' }, { right: false, now: T0 + k * 60000 });
    }
  }
  // a younger rider still gets them
  const y = rider0(); y.age = 8; SK.setLevel(y, 'eq', 12);
  const alg = makeAlgebra(y.topics.algebra, { rng, strand: true });
  const rungs = new Set(); for (let k = 0; k < 30; k++) rungs.add(ST.planBox(y, alg, { rng, now: T0 + k * 60000 }).rung);
  assert.ok(rungs.has('R0a') || rungs.has('R0b'), [...rungs].join(' '));
});

test('a plain part for a rider whose adding and taking away are below the negatives offers no negative wrong answers', () => {
  const rng = makeRng(5);
  let plainParts = 0;
  for (let i = 0; i < 60; i++) {
    const p = generate('R1', { rng, size: 2 });
    const side = p.start.L.some((t) => t.t === 'x') ? p.start.L : p.start.R;
    const a = side.find((t) => t.t === 'n');
    for (const sign of [1, -1]) {
      const P = partsOf(p.start, { k: 'add', term: { t: 'n', v: E.F(sign * a.v.n) } }, { rng, positive: true });
      for (const q of P.qs) {
        plainParts++;
        assert.equal(q.choices.length, 4, q.prompt);
        assert.ok(q.choices.every((c) => !c.text.startsWith(E.MINUS) && !c.text.startsWith('-')), `${q.prompt}: ${q.choices.map((c) => c.text).join(' ')}`);
      }
    }
  }
  assert.ok(plainParts > 60);
  // a part that works with negatives keeps its sign slips
  const l = { L: [{ t: 'x', v: E.F(1) }, { t: 'n', v: E.F(-10) }], R: [{ t: 'n', v: E.F(-18) }] };
  const P = partsOf(l, { k: 'add', term: { t: 'n', v: E.F(10) } }, { rng, positive: true });
  assert.ok(P.qs.some((q) => q.choices.some((c) => !c.right && /^[−-]/.test(c.text))), 'the −18 + 10 part still offers the sign slip');
});

test('read aloud: a box worked by moves is asked in the words of its buttons, not as a missing number', async () => {
  const { moveBoxLine, spokenMath } = await import('../src/lockbox/panel.js');
  assert.equal(spokenMath('x + 4 = 9'), 'x plus 4 equals 9');
  assert.equal(spokenMath('3x = 12'), '3 x equals 12');
  const rng = makeRng(12);
  for (let i = 0; i < 30; i++) {
    const p = generate('R1', { rng, size: 2 });
    const line = moveBoxLine(p, 'Get x alone. Same move on both sides.');
    const side = p.start.L.some((t) => t.t === 'x') ? p.start.L : p.start.R;
    const a = side.find((t) => t.t === 'n').v.n;
    assert.match(line, new RegExp(`which move takes the ${a} away\\? Do the same to both sides\\.$`), line);
    assert.ok(!/and what make/.test(line), line);
  }
  const p2 = generate('R2', { rng, size: 2 });
  assert.match(moveBoxLine(p2, 'Dark coins are negative numbers.'), /equals .*\. Dark coins are negative numbers\.$/);
});
