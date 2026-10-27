// WORK IT OUT ON ANY QUESTION (src/math/jobsums.js, src/ui/tools.js): a question answered with one coin that takes two
// sums or more is handed over in steps (the bill, then the change from $20; all the parts, one part, then a family's
// parts), each step saying what it finds and the first's answer carried into the next; every job hands over the part
// that is on screen now (a delivery's second part, a lock box's part being asked, a builder's card); and with nothing
// to read, the entry to type a sum by hand (its numbers, its limits and its friendly lines).
import test from 'node:test';
import assert from 'node:assert/strict';

const J = await import('../src/math/jobsums.js');
const { workOf, sumWords } = await import('../src/math/longwork.js');
const { counterOrder, COUNTER } = await import('../src/math/counter.js');
const { makeOrder, LADDER, K_LADDER, seeded } = await import('../src/math/wordproblems.js');
const { makeSupplyOrder } = await import('../src/math/supplies.js');
const { sumLabel, readSum } = await import('../src/ui/tools.js');
const { generate, makeRng, RUNG } = await import('../src/lockbox/generate.js');
const { K_RUNG } = await import('../src/lockbox/kbox.js');
const { findProblem } = await import('../src/lockbox/findx.js');
const { lineText } = await import('../src/lockbox/engine.js');
const { partsOf } = await import('../src/lockbox/parts.js');
const WQ = await import('../labs/windmill/questions.js');
const BQ = await import('../labs/bridge/questions.js');

const near = (x, y) => Math.abs(x - y) < 1e-6;
const steps = (s) => (s ? (s.chain ? s.chain : [s]) : []);
const last = (s) => steps(s)[steps(s).length - 1];
// the store's Work it out for an order, as store.js J.workSum hands it over (not the worked area's own sums)
const storeSum = (o) => (o.equation ? null : o.long ? null : o.sum ? J.sumOf(o.sum) : J.workFrom(o.rightWhy || ''));
// every step a sum the columns can do, coming to its own answer, its carried numbers an earlier step's answer
function checkSteps(s, what) {
  const ss = steps(s);
  ss.forEach((x, i) => {
    const w = workOf(x);
    assert.ok(w && w.steps.length, `${what}: step ${i + 1} (${sumWords(x)}) works in columns`);
    const got = w.op === 'div' ? (w.answer.r ? w.answer.q : w.answer.q ?? w.answer) : w.answer;
    assert.ok(near(typeof got === 'number' ? got : got.q, J.answerOf(x)), `${what}: ${w.line} is the step's answer ${J.answerOf(x)}`);
    for (const [side, k] of Object.entries(x.carried || {})) {
      assert.ok(k < i, `${what}: carried from an earlier step`);
      assert.ok(near(x[side], J.answerOf(ss[k])), `${what}: ${sumWords(x)} carries step ${k + 1}'s answer`);
    }
  });
}
// the coin the kid picks, as a number (cents coins in cents, a ¢ order's sums in cents too)
function coinOf(o) {
  const lab = String(o.coins.find((c) => c.good).label).replace(/,/g, '');
  const m = /(\d+(?:\.\d+)?)/.exec(lab);
  return m ? Number(m[1]) : NaN;
}

test('two steps answered with one coin are walked in steps: the cost of 3 tins, then the change from $20, the $6.75 carried', () => {
  const s = J.workFrom('3 × $2.25 = $6.75, then $20 − $6.75 = $13.25');
  assert.equal(s.chain.length, 2);
  assert.deepEqual(s.chain.map(sumWords), ['3 × $2.25', '$20.00 − $6.75']);
  assert.deepEqual(s.chain[1].carried, { b: 0 }, 'the $6.75 is the first sum\'s answer');
  assert.equal(J.answerOf(s.chain[0]), 6.75);
  assert.equal(workOf(s.chain[1]).line, '$20.00 − $6.75 = $13.25');
  // three numbers times each other: one day for everybody, then all the days
  assert.deepEqual(J.workFrom('5 hands × 3 a day × 7 days = 105 pounds').chain.map((x) => [x.a, x.b]), [[5, 3], [15, 7]]);
  // equal groups as they are written for the youngest: adding the baskets one at a time
  assert.deepEqual(J.workFrom('3 baskets of 4: 4 + 4 + 4 = 12 horseshoes').chain.map(sumWords), ['4 + 4', '8 + 4']);
  // shares by a ratio: the parts, one part (a "× 1" says nothing new and is left out)
  assert.deepEqual(J.workFrom('4 + 1 = 5 parts; 40 ÷ 5 = 8 a part; Ike gets 1 × 8 = 8').chain.map(sumWords), ['4 + 1', '40 ÷ 5']);
  // a check back is not a step; a sum said along the way with no answer is not one either
  assert.equal(J.workFrom('$1.35 ÷ 3 = 45¢: 3 × 45¢ = $1.35').chain, undefined);
  assert.deepEqual(J.workFrom('12 is 4 × 3, so 4 × 4 = 16 cups'), { op: 'mul', a: 4, b: 4 });
  assert.deepEqual(J.workFrom('$1.30 + $5.75 = $7.05'), { op: 'add', a: 1.3, b: 5.75, money: true, cash: 'ab' });
  // working that doesn't come to its answer isn't read as steps; fractions, times of day and negatives aren't sums
  assert.equal(J.workFrom('3/4 + 1/4 = 1'), null);
  assert.equal(J.workFrom('6:00 am + 24 hours'), null);
  assert.equal(sumLabel(s), 'The sums on this question', 'the button doesn\'t say them');
  assert.equal(readSum(s), s);
  assert.equal(readSum({ chain: [{ op: 'add', a: 1 }] }), null);
});

test('the store\'s two-step makers say what each step finds, never its answer, and walk to the coin', () => {
  const cases = [
    ['twostep', 6], ['twostep', 7], ['twostep', 9], ['percent', 8], ['percent', 9], ['recipe', 7], ['recipe', 9],
  ];
  let n = 0;
  for (const [type, step] of cases) {
    for (let k = 0; k < 40; k++) {
      const o = makeOrder(type, { step, rand: seeded(97 * k + step) });
      const s = storeSum(o);
      if (!s) continue;
      assert.ok(s.chain && s.chain.length >= 2, `${type} ${step}: ${o.rightWhy} is in steps`);
      checkSteps(s, o.rightWhy);
      assert.ok(near(J.answerOf(last(s)), coinOf(o)), `${o.rightWhy}: worked through, the coin (${o.coins.find((c) => c.good).label})`);
      assert.match(s.chain[0].say, /^First /);
      assert.ok(s.chain.slice(1).every((x) => /^Then /.test(x.say)), `${type}: each later step starts "Then"`);
      // (a step's words never give its answer away, unless that number is on the order already or in the sum itself)
      for (const x of s.chain) {
        const v = J.answerOf(x), said = new RegExp(`(^|[^\\d.])${String(v).replace('.', '\\.')}(?![\\d.])`);
        assert.ok(v < 10 || !said.test(x.say) || said.test(`${o.story} ${o.ask}`) || v === x.a || v === x.b, `"${x.say}" doesn't say its own answer (${v})`);
      }
      n++;
    }
  }
  assert.ok(n > 200, `two-step orders walked (${n})`);
  // the change story, word for word
  let o;
  for (let k = 0; k < 80 && !(o && /change/.test(o.key)); k++) o = makeOrder('twostep', { step: 7, rand: seeded(k) });
  const s = storeSum(o), [A, B] = s.chain;
  assert.match(A.say, /^First the cost of \d+ /);
  assert.match(B.say, /^Then the change from \$\d+$/);
  assert.deepEqual(B.carried, { b: 0 });
});

test('the counter\'s questions in steps: change after several, the better buy, tips and tax, any percent, interest, ratios', () => {
  const want = { money: [5, 6, 7], pct: [2, 3, 5], ratio: [3, 4, 5] };
  let chains = 0;
  for (const [map, sts] of Object.entries(want)) {
    for (const step of sts) {
      for (let k = 0; k < 30; k++) {
        const o = counterOrder(map, { step, rand: seeded(1000 * step + 37 * k + 11) });
        const s = storeSum(o);
        if (!s) continue;
        checkSteps(s, `${map} ${step}: ${o.rightWhy}`);
        if (s.chain) chains++;
        // (the better buy is two prices of one to compare, the coin is the deal: no answer to reach)
        if (/better/.test(o.key)) { assert.equal(s.chain.length, 2, 'both prices of one'); continue; }
        const coin = coinOf(o), got = J.answerOf(last(s));
        assert.ok(near(got, coin) || near(got * 100, coin), `${map} ${step}: ${o.rightWhy} -> ${got} (coin ${o.coins.find((c) => c.good).label})`);
      }
    }
  }
  assert.ok(chains > 150, `counter questions in steps (${chains})`);
  // the several-at-one-price change, in dollars and cents: the bill, then the change
  const o = counterOrder('money', { step: 5, rand: seeded(5011) });
  const s = storeSum(o);
  assert.match(s.chain[0].say, /^First the cost of/);
  assert.match(s.chain[1].say, /^Then the change from \$(10|20)$/);
  assert.ok(s.chain[1].money && s.chain[1].carried.b === 0);
});

test('every store question: a sum or steps that come to the coin, or the entry (a clock, coins to count, a word, a story told backwards)', () => {
  const none = new Set(), wrong = [];
  let n = 0, worked = 0;
  const tally = (name, o) => {
    n++;
    if (o.long) { worked++; return; }   // (the order's own worked area: its own sum, counted)
    const s = storeSum(o);
    if (!s) { none.add(name); return; }
    worked++;
    checkSteps(s, `${name}: ${o.rightWhy}`);
  };
  for (const map of Object.keys(COUNTER)) for (let st = 1; st <= COUNTER[map].STEPS.length; st++) for (let k = 0; k < 8; k++) tally(`${map} ${st}`, counterOrder(map, { step: st, rand: seeded(31 * k + st) }));
  for (let st = 1; st <= LADDER.length; st++) for (const type of Object.keys(LADDER[st - 1].mix)) for (let k = 0; k < 6; k++) tally(`words ${type} ${st}`, makeOrder(type, { step: st, rand: seeded(17 * k + st) }));
  for (let st = 1; st <= K_LADDER.length; st++) for (const type of Object.keys(K_LADDER[st - 1].mix)) for (let k = 0; k < 6; k++) tally(`K ${type} ${st}`, makeOrder(type, { step: st, rand: seeded(13 * k + st), ladder: 'K' }));
  assert.equal(wrong.length, 0);
  // (what has no column sum: reading the clock, counting coins, tenths and hundredths, the percent a change is, time
  // across the hours, the story told backwards: the lock box solves it)
  for (const name of none) assert.match(name, /^(time [1-57-9]|money 1|dec [12]|pct 4|words equation|money 6)/, `${name}: no sum`);
  assert.ok(worked / n > 0.75, `most store questions hand over a sum (${worked} of ${n})`);
  // the picture stories: how many in all, how many are left
  assert.deepEqual(storeSum(makeOrder('kmore', { step: 1, rand: seeded(3), ladder: 'K' })).op, 'add');
  assert.deepEqual(storeSum(makeOrder('kleft', { step: 2, rand: seeded(3), ladder: 'K' })).op, 'sub');
});

test('a delivery hands over the part on the slip: one day for everybody then all the days, the cans shared into crates, the cost; a word to know: the entry', () => {
  const kinds = {};
  for (let step = 1; step <= 8; step++) {
    for (let k = 0; k < 25; k++) {
      const o = makeSupplyOrder({ step, rand: seeded(400 * step + k), vocab: { week: true, fortnight: true, dozen: true } });
      for (const p of o.parts) {
        // (as delivery.js DL.workSum: the part's own worked area first)
        const s = p.long ? null : p.key === 'vocab' ? null : p.sum ? J.sumOf(p.sum) : J.workFrom(p.rightWhy || '');
        kinds[p.key] = (kinds[p.key] || 0) + 1;
        if (p.key === 'vocab') { assert.equal(s, null, 'a word to know: the entry'); continue; }
        if (p.long) continue;
        assert.ok(s, `${step} ${p.key}: ${p.ask}`);
        checkSteps(s, `${step} ${p.key}`);
        if (p.key === 'total') {
          assert.equal(J.answerOf(last(s)), o.total, `${p.rightWhy}: worked through, the total`);
          if (o.rate > 1 && !o.noDays && o.days) {
            assert.deepEqual(s.chain.map((x) => [x.a, x.b]), [[o.hands, o.rate], [o.hands * o.rate, o.days]], 'one day first, then the days');
            assert.match(s.chain[0].say, /^First one day for all/);
          }
        }
        if (p.key === 'crates') {
          assert.deepEqual([s.op, s.a, s.b], ['div', o.total, o.per], `${p.ask}: the total shared into crates`);
          const w = workOf(s);
          assert.equal(w.answer.q + (w.answer.r ? 1 : 0), o.crates, 'the quotient, and one more for a leftover, is the crates (the one more stays the kid\'s)');
        }
        if (p.key === 'cost') assert.equal(J.answerOf(s), o.cost);
      }
    }
  }
  assert.ok(kinds.vocab && kinds.total && kinds.crates && kinds.cost, JSON.stringify(kinds));
});

test('the lock box: the part being asked ("27 ÷ 9", "5x − 4x" as 5 − 4, a product, a power), a find-x or picture box\'s line, a balance in two steps', () => {
  assert.deepEqual(J.partSum('27 ÷ 9'), { op: 'div', a: 27, b: 9 });
  assert.deepEqual(J.partSum('5x − 4x'), { op: 'sub', a: 5, b: 4 });
  assert.deepEqual(J.partSum('x + 3x'), { op: 'add', a: 1, b: 3 });
  assert.deepEqual(J.partSum('12x ÷ 4'), { op: 'div', a: 12, b: 4 });
  assert.deepEqual(J.partSum('4 · 3'), { op: 'mul', a: 4, b: 3 });
  assert.deepEqual(J.partSum('5 × 5 × 5').chain.map(sumWords), ['5 × 5', '25 × 5']);
  assert.deepEqual(J.partSum('2^3').chain.map(sumWords), ['2 × 2', '4 × 2']);
  for (const t of ['−10 + 18', '27 ÷ (−3)', '√49', '1 ÷ 8', '3 + 4 × 2', '3x/2 + x', '']) assert.equal(J.partSum(t), null, t);
  // the parts a real box asks, as its prompts say them (parts.js): numbers only, worked to the part's answer
  const rng = makeRng(7);
  let asked = 0;
  for (const id of ['R3', 'R6', 'R11', 'R12']) {
    for (let k = 0; k < 10; k++) {
      const p = generate(id, { rng, size: 2 });
      if (!p || p.mode !== 'moves' || !p.route || !p.route.length) continue;
      const res = partsOf(p.start, p.route[0] && p.route[0].move ? p.route[0].move : null, { rng });
      for (const q of (res && res.qs) || []) {
        const s = J.partSum(q.prompt);
        if (!s) continue;
        asked++;
        const v = Number(String(q.answer).replace('x', '').replace('−', '-') || 1);
        if (Number.isFinite(v)) assert.ok(near(J.answerOf(last(s)), Math.abs(v)), `${q.prompt} = ${q.answer}`);
      }
    }
  }
  // the find-x boxes, the picture boxes and the balance: the line on screen, worked to x
  let found = 0;
  const lines = [];
  for (const id of Object.keys(K_RUNG)) for (let k = 0; k < 10; k++) lines.push(generate(id, { rng, size: 2 }));
  for (let k = 0; k < 20; k++) lines.push(generate('R0a', { rng, size: 2 }), generate('R0b', { rng, size: 2 }));
  for (const shapes of [['x+a=b', 'a+x=b'], ['x-a=b', 'a-x=b'], ['ax=b', 'x/a=b'], ['ax+b=c', 'ax-b=c']]) {
    for (let k = 0; k < 15; k++) lines.push(findProblem({ find: true, shapes, max: 20, keys: 4 }, { rng, into: k % 5, count: 5 }));
  }
  for (const p of lines) {
    if (!p || p.x == null || p.x < 0) continue;
    const t = lineText(p.start), s = J.blankWork(t);
    assert.ok(s, `${p.rung} ${p.mode}: ${t} hands over a sum`);
    checkSteps(s, t);
    assert.ok(near(J.answerOf(last(s)), p.x), `${t}: worked through, x = ${p.x}`);
    assert.ok(s.story, `${t}: the button doesn't say it`);
    found++;
  }
  assert.ok(found > 60 && asked >= 0, `find-x, picture and balance boxes (${found})`);
  const bal = J.blankWork('10 + 7 = ? + 15');
  assert.deepEqual(bal.chain.map(sumWords), ['10 + 7', '17 − 15']);
  assert.equal(bal.chain[0].say, 'First the side you can work out');
});

test('a builder\'s card: the missing angle, the third corner, a right triangle\'s squares (the root stays the kid\'s), half a board; naming one: the entry', () => {
  let r = 11;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const TOP = { ...WQ.TOPICS, ...BQ.TOPICS };
  const seen = {};
  for (const [topic, [, mk]] of Object.entries(TOP)) {
    for (let k = 0; k < 8; k++) {
      const q = mk(rnd);
      if (!q) continue;
      // (as main.js reads it: the handle's kind, topic and answer, and the card's line on the page)
      const s = J.buildSum({ kind: q.kind, topic: q.topic, answer: q.answer }, q.prompt);
      seen[topic] = (seen[topic] || 0) + (s ? 1 : 0);
      if (/^(name-angle|tri-corners|tri-sides|f|z)$/.test(topic)) { assert.equal(s, null, `${topic}: ${q.prompt}`); continue; }
      if (topic === 'x' && q.answer === q.geo.a) { assert.equal(s, null, 'across an X: equal, no sum'); continue; }
      assert.ok(s && s.story, `${topic}: ${q.prompt}`);
      checkSteps(s, q.prompt);
      const end = J.answerOf(last(s));
      if (/^(line|corner|x|c|tri-sum)$/.test(topic)) assert.equal(end, q.answer, `${q.prompt}: worked, the angle`);
      else {
        const side = topic === 'reach' ? q.answer / 12 : q.answer;   // (how high it reaches: in inches on the coins)
        assert.ok(near(end, side * side), `${q.prompt}: worked, the side squared (${end})`);
      }
    }
  }
  for (const t of ['line', 'corner', 'tri-sum', 'hyp', 'leg', 'reach', 'panel']) assert.ok(seen[t] > 0, `${t} cards hand over sums`);
  const third = J.buildSum({ kind: 'angle', topic: 'tri-sum', answer: 70 }, 'Two corners of this triangle are 65° and 45°. What is the third corner?');
  assert.deepEqual(third.chain.map(sumWords), ['65 + 45', '180 − 110']);
  assert.match(third.chain[1].say, /from 180/);
  assert.deepEqual(J.buildSum({ kind: 'easy', answer: 3.5 }, 'Your board is 7 feet long. Sawn in half, how long would each piece be?'), { op: 'div', a: 7, b: 2, story: true });
  assert.deepEqual(J.buildSum({ kind: 'easy', answer: 7 }, 'Your board is 3½ feet long. Two boards this long laid end to end: how long are they together?'), { op: 'add', a: 3.5, b: 3.5, story: true });
  assert.equal(J.buildSum(null), null);
});

test('typing your own sum: digits, one point, a $; up to 6 digits and 2 after the point; friendly lines for what the columns can\'t do', () => {
  assert.deepEqual(J.ownSum('1250', '+', '375'), { sum: { op: 'add', a: 1250, b: 375 } });
  assert.deepEqual(J.ownSum('20', 'sub', '6.75'), { sum: { op: 'sub', a: 20, b: 6.75 } });
  assert.deepEqual(J.ownSum('$20', '−', '$6.75'), { sum: { op: 'sub', a: 20, b: 6.75, money: true, cash: 'ab' } }, 'dollars: the $ on the board');
  assert.deepEqual(J.ownSum('$2.25', '×', '3'), { sum: { op: 'mul', a: 2.25, b: 3, money: true, cash: 'a' } });
  assert.deepEqual(J.ownSum('$20', '÷', '4'), { sum: { op: 'div', a: 20, b: 4, money: true, cash: 'a' } });
  assert.deepEqual(J.ownSum('$20', '÷', '$5'), { sum: { op: 'div', a: 20, b: 5 } }, 'how many $5 in $20: a count');
  assert.deepEqual(J.ownSum('.5', 'mul', '4'), { sum: { op: 'mul', a: 0.5, b: 4 } });
  assert.equal(workOf(J.ownSum('999999', '×', '999999').sum).answer, 999998000001, 'the biggest allowed works');
  assert.equal(workOf(J.ownSum('999999.99', '+', '0.01').sum).answer, 1000000);
  const why = (a, o, b) => J.ownSum(a, o, b);
  assert.deepEqual(why('', '+', '3'), { why: 'Type the first number.', at: 'a' });
  assert.deepEqual(why('3', '', '3'), { why: 'Pick a sign: +, −, × or ÷.', at: 'op' });
  assert.deepEqual(why('3', '+', ''), { why: 'Type the second number.', at: 'b' });
  assert.deepEqual(why('3', '−', '8'), { why: 'The bigger number goes on top: 8 − 3 works in columns.', at: 'b', swap: true });
  assert.deepEqual(why('5', '÷', '0'), { why: 'Nothing can be shared into 0 groups. Divide by a number bigger than 0.', at: 'b' });
  assert.equal(why('1234567', '+', '1').why, 'Up to 6 digits before the point.');
  assert.equal(why('1.234', '+', '1').why, 'Up to 2 digits after the point.');
  assert.equal(why('1.2.3', '+', '1').why, 'A number is digits, with one point at most.');
  assert.equal(J.ownNumber('0001').v, 1, '0s in front don\'t count toward the 6');
  assert.equal(J.ownNumber('$').empty, true);
  // the sign as a key (the keyboard's - * / x) or a word
  for (const [k, op] of [['-', 'sub'], ['*', 'mul'], ['x', 'mul'], ['/', 'div'], ['÷', 'div'], ['×', 'mul'], ['+', 'add']]) assert.equal(J.ownSum('12', k, '4').sum.op, op, k);
  // nothing ever below 0 or not a sum gets through
  for (let a = 0; a < 30; a++) for (const o of ['+', '−', '×', '÷']) {
    const r = J.ownSum(String(a), o, String((a * 7) % 13));
    if (r.sum) assert.ok(workOf(r.sum), `${a} ${o}: works`);
    else assert.ok(r.why && r.at, `${a} ${o}: a line why`);
  }
});

test('the button never says a question is too easy for it, and is never left with nothing to do', () => {
  assert.equal(sumLabel(null), 'Type your own sum');
  for (const s of [null, { op: 'add', a: 2, b: 1 }, { op: 'mul', a: 3, b: 4, story: true }, { chain: [{ op: 'mul', a: 3, b: 2 }, { op: 'sub', a: 20, b: 6 }], story: true }, { own: true, op: 'mul', a: 16, b: 7 }]) {
    const k = sumLabel(s);
    assert.ok(k && !/nothing|easy|too |don't need|no need|not needed/i.test(k), `"${k}"`);
  }
  assert.equal(sumLabel({ op: 'add', a: 2, b: 1 }), '2 + 1', 'a small sum is worked like any other');
});
