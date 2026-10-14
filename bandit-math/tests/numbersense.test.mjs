// Tests for the shooting range's math (src/math/numbersense.js): the cards on every step of the ladder, the slips
// (the wrong numbers kids really pick), the one-line whys, the number lines, and the climb.
// Run with:  node --test bandit-math/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const M = await import('../src/math/numbersense.js');
const { makeRng } = await import('../src/lockbox/generate.js');
const { STEPS, NS, makeNumberSense, rightNow, isDone, whyNot, lineFor, tipFor, numText } = M;

const roundTo = (v, g) => Math.floor(v / g + 0.5) * g;
const at = (step) => makeNumberSense({ step, placed: true });
// the cards a step deals (reviews from lower steps left out)
function cardsAt(step, n, seed) {
  const rng = makeRng(seed), N = at(step), out = [];
  while (out.length < n) { const c = N.card({ rng }); if (!c.review) out.push(c); }
  return out;
}
// a card with these numbers, for the why lines
const card = (kind, ask, nums, good = nums.map(() => false)) => ({ kind, ask, what: 'can', targets: nums.map((n, i) => ({ n, good: good[i] })) });

test('every step deals fair cards: distinct numbers, the right count of right ones, a rule that names the target', () => {
  STEPS.forEach((S, step) => {
    for (const c of cardsAt(step, 60, 100 + step)) {
      const nums = c.targets.map((x) => x.n), good = c.targets.filter((x) => x.good).map((x) => x.n);
      assert.equal(c.kind, S.kind);
      assert.equal(c.targets.length, S.n, `${S.id}: ${S.n} targets`);
      assert.equal(new Set(nums).size, nums.length, `${S.id}: no repeats ${nums}`);
      assert.ok(nums.every(Number.isInteger), `${S.id}: whole numbers`);
      assert.ok(c.rule.includes(c.what === 'can' ? 'can' : 'bottle'), `${S.id}: "${c.rule}" names a ${c.what}`);
      if (c.kind === 'compare' || c.kind === 'estimate') assert.equal(good.length, 1, `${S.id}: one right`);
      if (c.kind === 'round' || c.kind === 'between') assert.ok(good.length >= 2 && good.length <= 3, `${S.id}: two or three right, got ${good}`);
      if (c.kind === 'order') assert.equal(good.length, nums.length, 'order: all of them, in turn');
      if (S.lo != null && !S.mirror) assert.ok(nums.every((n) => n >= S.lo && n <= S.hi), `${S.id}: ${nums} within ${S.lo}..${S.hi}`);
      if (S.kind === 'compare' && !S.neg) assert.ok(nums.every((n) => n > 0), 'no negatives before the negative steps');
    }
  });
});

test('negatives only come in on the negative steps', () => {
  const firstNeg = STEPS.findIndex((s) => s.neg || s.kind === 'between');
  assert.ok(firstNeg >= 6, 'whole numbers first, negatives later');
  for (let step = 0; step < firstNeg; step++) for (const c of cardsAt(step, 40, 7 + step)) assert.ok(c.targets.every((x) => x.n >= 0), `${STEPS[step].id}: ${c.targets.map((x) => x.n)}`);
  let some = 0;
  for (let step = firstNeg; step < STEPS.length; step++) for (const c of cardsAt(step, 20, 9 + step)) if (c.targets.some((x) => x.n < 0)) some++;
  assert.ok(some > 60, 'the negative steps really have negatives');
});

test('rounding cards: the right ones round to the card\'s number, the wrong ones are real slips', () => {
  let halves = 0, total = 0;
  for (const step of STEPS.map((s, i) => i).filter((i) => STEPS[i].kind === 'round')) {
    for (const c of cardsAt(step, 80, 31 + step)) {
      const { ten: T, to: g } = c.ask;
      total++;
      assert.ok(c.rule.includes(`rounds to ${numText(T)}`), c.rule);
      for (const x of c.targets) {
        assert.equal(roundTo(x.n, g) === T, x.good, `${x.n} rounds to ${roundTo(x.n, g)}; card ${T}`);
        assert.notEqual(x.n, T, 'the card\'s own number is never on the shelf');
        if (x.slip === 'half') { assert.equal(x.n, T + g / 2, 'the halfway slip is exactly halfway above'); halves++; }
        if (x.slip === 'over') assert.ok(x.n > T + g / 2 && x.n < T + g, `${x.n}: starts like ${T} but rounds up`);
        if (x.slip === 'under') assert.ok(x.n < T - g / 2 && x.n > T - g, `${x.n}: rounds down`);
      }
      assert.ok(c.targets.every((x) => x.n >= g && x.n < 10 * g), 'numbers of the right size');
    }
  }
  assert.ok(halves / total > 0.6, `most rounding cards carry the halfway slip (${halves}/${total})`);
});

test('estimating cards: the right bottle is the nearest ten, and the carry or borrow slip is on the shelf', () => {
  let carry = 0, carryable = 0;
  for (const step of STEPS.map((s, i) => i).filter((i) => STEPS[i].kind === 'estimate')) {
    for (const c of cardsAt(step, 80, 51 + step)) {
      const { a, op, b, exact, near } = c.ask;
      assert.equal(exact, op === '+' ? a + b : op === '−' ? a - b : a * b);
      assert.ok(exact % 10 !== 5 && exact % 10 !== 0, 'one ten is clearly nearest');
      assert.equal(near, roundTo(exact, 10));
      const tens = c.targets.map((x) => x.n);
      assert.ok(tens.every((n) => n % 10 === 0 && n > 0), `round tens ${tens}`);
      const best = Math.min(...tens.map((n) => Math.abs(n - exact)));
      assert.deepEqual(c.targets.filter((x) => Math.abs(x.n - exact) === best).map((x) => x.n), [near], 'exactly one nearest');
      assert.ok(c.rule.includes(`${a} ${op} ${b}`), c.rule);
      assert.equal(M.estimateOf(a, op, b), near, `${a} ${op} ${b}: rounding first lands on the same ten (the card's tip holds)`);
      assert.match(tipFor(c), new RegExp(`= ${near}\\.$`), tipFor(c));
      if (op === '+' && (a % 10) + (b % 10) >= 10 && roundTo(exact - 10, 10) !== near) { carryable++; if (c.targets.some((x) => x.slip === 'carry' && x.n === roundTo(exact - 10, 10))) carry++; }
    }
  }
  assert.ok(carryable > 20 && carry === carryable, `the forgotten carry is on the shelf when it can be (${carry}/${carryable})`);
});

test('between cards: the two ends are never on the shelf, and the slips sit just outside', () => {
  for (const c of cardsAt(STEPS.findIndex((s) => s.kind === 'between'), 120, 77)) {
    const { lo, hi } = c.ask;
    assert.ok(lo < 0 && hi > 0, 'from below zero to above it');
    for (const x of c.targets) {
      assert.ok(x.n !== lo && x.n !== hi, `no ${lo} or ${hi} on the shelf`);
      assert.equal(x.good, x.n > lo && x.n < hi, `${x.n} between ${lo} and ${hi}`);
      if (x.slip === 'mirror') assert.equal(x.n, -hi);
    }
    if (lo < -1) assert.ok(c.targets.some((x) => x.good && x.n < 0), 'a right one below zero when there is room');
  }
});

test('comparing with negatives: the trap is a big number after a minus sign (or one close to zero)', () => {
  const step = STEPS.findIndex((s) => s.kind === 'compare' && s.neg);
  for (const c of cardsAt(step, 80, 13)) {
    const nums = c.targets.map((x) => x.n), want = c.ask.want, ans = want === 'big' ? Math.max(...nums) : Math.min(...nums);
    assert.deepEqual(c.targets.filter((x) => x.good).map((x) => x.n), [ans]);
    if (want === 'big') assert.ok(c.targets.some((x) => x.slip === 'negbig' && x.n < 0 && -x.n > ans), `a tempting negative ${nums}`);
    else assert.ok(c.targets.some((x) => x.slip === 'nearzero' && x.n < 0 && x.n > -4), `a negative close to zero ${nums}`);
  }
});

test('ordering: the right shot is always the smallest (or largest) still standing, and the card ends with the last', () => {
  for (const step of STEPS.map((s, i) => i).filter((i) => STEPS[i].kind === 'order')) {
    for (const c of cardsAt(step, 30, 91 + step)) {
      const gone = new Set(), seen = [];
      while (!isDone(c, gone)) {
        const now = rightNow(c, gone);
        assert.equal(now.length, 1, 'one right shot at a time');
        seen.push(c.targets[now[0]].n); gone.add(now[0]);
      }
      const sorted = [...seen].sort((a, b) => (c.ask.dir === 'up' ? a - b : b - a));
      assert.deepEqual(seen, sorted);
      assert.equal(gone.size, c.targets.length);
    }
  }
  const c = card('order', { dir: 'up' }, [415, 154, 451]);
  assert.match(whyNot(c, 0, new Set()), /154 comes first: it has 1 hundred, and 415 has 4 hundreds/);
  assert.match(whyNot(card('order', { dir: 'up' }, [415, 451, 419]), 1, new Set()), /415 comes first: the hundreds match, so look at the tens \(1 against 5\)/);
  assert.match(whyNot(card('order', { dir: 'up' }, [-3, -8, 2]), 0, new Set()), /−8 is further below zero than −3, so it comes first/);
});

test('the one-line whys say the real reason', () => {
  const r = (n) => whyNot(card('round', { ten: 40, to: 10 }, [n]), 0);
  assert.match(r(45), /exactly halfway between 40 and 50, and halfway rounds up: to 50/);
  assert.match(r(48), /48 starts like 40, but it's past the halfway mark at 45: it rounds up to 50/);
  assert.match(r(34), /34 hasn't reached the halfway mark at 35, so it rounds down to 30/);
  assert.match(r(61), /61 rounds to 60, not 40/);
  assert.match(whyNot(card('round', { ten: 300, to: 100 }, [350]), 0), /halfway between 300 and 400/);
  const big = card('compare', { want: 'big' }, [-11, 4, 7]);
  assert.match(whyNot(big, 0), /−11 is 11 below zero, so it's small, not big. 7 is the biggest/);
  assert.match(whyNot(big, 1), /7 is bigger than 4/);
  const small = card('compare', { want: 'small' }, [-2, -9, 3]);
  assert.match(whyNot(small, 0), /−2 is only 2 below zero. −9 is 9 below zero, so −9 is smaller/);
  assert.match(whyNot(small, 2), /Every number below zero is smaller than 3/);
  const est = card('estimate', { a: 19, op: '+', b: 22, exact: 41, near: 40 }, [30, 40, 50]);
  assert.match(whyNot(est, 0), /19 \+ 22 = 41. 30 is 11 away from it, but 40 is only 1 away/);
  const btw = { ...card('between', { lo: -3, hi: 5 }, [-4, 7, -5, 2]) };
  btw.targets[2].slip = 'mirror';
  assert.match(whyNot(btw, 0), /−4 is further below zero than −3/);
  assert.match(whyNot(btw, 1), /7 is past 5, so it's outside/);
  assert.match(whyNot(btw, 2), /−5 isn't 5: it's below zero, left of −3/);
  // every wrong pick on every step gets a line
  STEPS.forEach((S, step) => {
    for (const c of cardsAt(step, 10, 400 + step)) {
      const now = new Set(rightNow(c));
      c.targets.forEach((x, i) => { if (!now.has(i)) assert.ok(whyNot(c, i).length > 10, `${S.id}: a why for ${x.n}`); });
    }
  });
});

test('the number lines: halfway marks for rounding, the band for between, every number plotted, no answer in a hint', () => {
  const rc = card('round', { ten: 40, to: 10 }, [44, 45, 34], [true, false, false]);
  const L = lineFor(rc, { pick: 1 });
  assert.deepEqual([L.from, L.to, L.major, L.minor], [30, 50, 5, 1]);
  assert.deepEqual(L.half, [35, 45]);
  assert.deepEqual([L.shade.a, L.shade.b], [35, 45]);
  assert.equal(L.shade.label, 'rounds to 40');
  assert.deepEqual(L.dots, [{ v: 45, kind: 'pick', label: '45' }]);
  assert.deepEqual([L.arrow.from, L.arrow.to], [45, 50]);
  assert.match(L.caption, /Halfway is 35 and 45/);
  const far = lineFor(card('round', { ten: 40, to: 10 }, [62]), { pick: 0 });
  assert.ok(far.from <= 30 && far.to >= 70, 'the line reaches a far pick');
  const hint = lineFor(rc, { hint: true });
  assert.equal(hint.dots.length, 0, 'no answer marked while stuck'); assert.equal(hint.arrow, null);
  // between: the band and every number; compare with negatives: zero on the line
  const bc = card('between', { lo: -3, hi: 5 }, [-4, 2, 7, -1], [false, true, false, true]);
  const B = lineFor(bc, { pick: 0 });
  assert.deepEqual([B.shade.a, B.shade.b], [-3, 5]);
  assert.ok(B.from <= -4 && B.to >= 7);
  assert.deepEqual(B.dots.map((d) => d.kind), ['pick', 'right', 'other', 'right']);
  const cc = card('compare', { want: 'big' }, [-11, 4, 7]);
  const C = lineFor(cc, { pick: 0 });
  assert.ok(C.from <= -11 && C.to >= 7 && C.from <= 0 && C.to >= 0);
  assert.ok(lineFor(cc, { hint: true }).dots.every((d) => d.kind === 'other'), 'a hint marks no answer');
  const ec = card('estimate', { a: 19, op: '+', b: 22, exact: 41, near: 40 }, [30, 40, 50, 60]);
  const E = lineFor(ec, { pick: 0 });
  assert.ok(E.dots.some((d) => d.kind === 'exact' && d.v === 41 && d.label === '19 + 22 = 41'));
  assert.deepEqual(E.dots.filter((d) => d.label).map((d) => d.label), ['30', '19 + 22 = 41'], 'the shelf\'s tens are the line\'s own numbers: only the pick and the sum are labelled');
  assert.deepEqual([E.arrow.from, E.arrow.to], [41, 40]);
  assert.match(tipFor(ec), /Round first: 19 is about 20, 22 is about 20, and 20 \+ 20 = 40/);
  // the lines from real cards always hold every number
  STEPS.forEach((S, step) => {
    for (const c of cardsAt(step, 15, 600 + step)) {
      const l = lineFor(c, { pick: 0 });
      assert.ok(l.to > l.from && l.major > 0, `${S.id}: a line`);
      for (const d of l.dots) assert.ok(d.v >= l.from && d.v <= l.to, `${S.id}: ${d.v} on ${l.from}..${l.to}`);
    }
  });
});

test('the climb: the first visit climbs fast and forgives one slip, then three clean cards a step, two wrong a step down', () => {
  assert.deepEqual([NS.CLEAN_TO_CLIMB, NS.ROUGH, NS.PLACE_BELOW], [3, 2, 1]);
  const rng = makeRng(3), st = {}, N = makeNumberSense(st);
  const play = (wrong) => { const c = N.card({ rng }); return N.finish(c, wrong); };
  assert.equal(st.step, 0);
  play(0); play(0); play(0);
  assert.equal(st.step, 3, 'each clean card climbs on the first visit');
  play(1);
  assert.equal(st.step, 3, 'one slip is forgiven');
  assert.equal(st.placed, false);
  play(0); assert.equal(st.step, 4);
  const r = play(1);
  assert.equal(st.placed, true, 'the second slip places the rider');
  assert.equal(st.step, 3, 'one step below where that card was dealt');
  assert.equal(r.moved, -1);
  // placed: three clean in a row climb a step (a review card in between doesn't count)
  for (let k = 0; k < 3; k++) { let c; do { c = N.card({ rng }); if (c.review) N.finish(c, 5); } while (c.review); N.finish(c, 0); }
  assert.equal(st.step, 4);
  N.newString();
  const one = (w) => { let c; do { c = N.card({ rng }); if (c.review) N.finish(c, 0); } while (c.review); return N.finish(c, w); };
  one(1); assert.equal(st.step, 4, 'one wrong shot only stops the clean run');
  one(2); assert.equal(st.step, 3, 'two wrong shots: a step down');
  one(4); assert.equal(st.step, 3, 'only one step down a string');
  N.newString(); one(2); assert.equal(st.step, 2, 'a new string can drop again');
  // the state survives a save
  const back = makeNumberSense(JSON.parse(JSON.stringify(st)));
  assert.deepEqual(back.level(), { step: 3, of: STEPS.length, label: STEPS[2].label, line: `Step 3 of ${STEPS.length}: ${STEPS[2].label}` });
  assert.equal(makeNumberSense({ step: 99 }).state.step, STEPS.length - 1, 'a broken save is clamped');
});

test('review cards from lower down come now and then and never move the ladder', () => {
  const rng = makeRng(8), st = { step: 6, placed: true }, N = makeNumberSense(st);
  let reviews = 0;
  for (let k = 0; k < 40; k++) {
    const c = N.card({ rng });
    if (c.review) { reviews++; assert.ok(c.step < 6 && STEPS[c.step].kind !== STEPS[6].kind); const r = N.finish(c, 3); assert.equal(r.moved, 0); }
  }
  assert.equal(reviews, 10, 'every 4th card');
  assert.equal(st.step, 6);
});

test('cans and bottles take turns, and a card is not dealt again straight away', () => {
  const rng = makeRng(4), N = at(2), whats = [], keys = [];
  for (let k = 0; k < 8; k++) { const c = N.card({ rng, recent: keys }); whats.push(c.what); assert.ok(!keys.includes(c.key)); keys.push(c.key); }
  assert.deepEqual(whats.slice(0, 4), ['bottle', 'can', 'bottle', 'can']);
});

test('numbers print with the real minus sign and commas', () => {
  assert.equal(numText(-3), '−3');
  assert.equal(numText(450), '450');
  assert.equal(numText(1050), '1,050');
  assert.equal(numText(0), '0');
});

// A simulated kid, right on each pick with a chance that falls as the cards get harder than their skill, settles near
// their skill and is right on about four picks in five (the owner's aim for the other topics: about 80%).
test('a simulated kid settles near their own step, right about four times in five', () => {
  for (const skill of [3, 6]) {
    for (const seed of [11, 22, 33]) {
      const rng = makeRng(seed + skill), N = makeNumberSense({});
      let picks = 0, right = 0, sum = 0, n = 0;
      for (let c = 0; c < 160; c++) {
        if (c % 5 === 0) N.newString();
        const cd = N.card({ rng }), gap = cd.step - skill;
        const p = gap < 0 ? 0.97 : gap === 0 ? 0.88 : gap === 1 ? 0.7 : 0.5;
        const gone = new Set(); let wrong = 0;
        for (let guard = 0; !isDone(cd, gone) && guard < 40; guard++) {
          const ok = rightNow(cd, gone), choice = cd.targets.some((x, i) => !gone.has(i) && !ok.includes(i));
          if (choice) picks++;
          if (!choice || rng.next() < p) { gone.add(ok[0]); if (choice) right++; } else wrong++;
        }
        N.finish(cd, wrong);
        if (c >= 50) { sum += N.state.step; n++; }
      }
      const settle = sum / n, pct = right / picks;
      assert.ok(settle >= skill - 1 && settle <= skill + 1.5, `skill ${skill} seed ${seed}: settles at ${settle.toFixed(1)}`);
      assert.ok(pct >= 0.68 && pct <= 0.9, `skill ${skill} seed ${seed}: ${(pct * 100).toFixed(0)}% right`);
    }
  }
});
