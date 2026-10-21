// Tests for src/math/wordproblems.js (the word problems at the general store counter).
// Run with:  node --test bandit-math/tests/wordproblems.test.mjs
// Every random choice is seeded. To check a result isn't luck of the seeds, run again on other seed sets:
//   SEED_OFFSET=1000 node --test bandit-math/tests/wordproblems.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeOrder, makeWordProblems, lockboxProblem, seeded as seededAt, LADDER, TYPES, FOLK, CLEAN_TO_CLIMB, MISS_DOWN,
  PLACEMENT_MISSES, PLACE_BELOW, COMEBACK_MIN, COMEBACK_MAX, SAME_KIND_RUN, EQ_RUNG,
} from '../src/math/wordproblems.js';
import { checkProblem } from '../src/lockbox/generate.js';
import { lineText } from '../src/lockbox/engine.js';
import { picture } from '../src/ui/storepics.js';

const OFFSET = Number(process.env.SEED_OFFSET) || 0;
const seeded = (seed) => seededAt(seed + OFFSET);
// every kind on every step it could come up on (and a few it couldn't, so a comeback after a step down is safe too)
const STEPS = LADDER.map((_, i) => i + 1);

function* everyOrder(perCombo = 25) {
  let seed = 1;
  for (const type of TYPES) for (const step of STEPS) {
    const r = seeded(seed++);
    for (let i = 0; i < perCombo; i++) yield makeOrder(type, { rand: r, step });
  }
}

test('the ladder: 9 steps, from groups and totals up to stories told backwards; every kind is on some step', () => {
  assert.equal(LADDER.length, 9);
  assert.deepEqual(Object.keys(LADDER[0].mix).sort(), ['groups', 'parts']);
  assert.ok(LADDER[LADDER.length - 1].mix.equation, 'the top step has the equations');
  for (const type of TYPES) assert.ok(LADDER.some((s) => s.mix[type]), `${type} is dealt somewhere`);
  // each kind arrives on its own step, in the agreed order
  const first = (type) => LADDER.findIndex((s) => s.mix[type]);
  const order = ['groups', 'share', 'compare', 'rate', 'money', 'twostep', 'recipe', 'percent', 'equation'];
  for (let i = 1; i < order.length; i++) assert.ok(first(order[i]) > first(order[i - 1]), `${order[i]} after ${order[i - 1]}`);
  for (const s of LADDER) { assert.ok(s.coins >= 3 && s.coins <= 4); assert.ok(s.label); }
});

test('every kind, every step: one right coin, wrong coins never equal the answer and never repeat, 3 or 4 coins', () => {
  let n = 0;
  for (const o of everyOrder()) {
    n++;
    const good = o.coins.filter((c) => c.good);
    assert.equal(good.length, 1, `${o.key}: exactly one right coin`);
    assert.ok(o.coins.length >= 3 && o.coins.length <= 4, `${o.key}: ${o.coins.length} coins`);
    const labels = o.coins.map((c) => c.label);
    assert.equal(new Set(labels).size, labels.length, `${o.key}: no two coins alike ${labels}`);
    for (const c of o.coins.filter((x) => !x.good)) {
      assert.notEqual(c.label, good[0].label);
      if (!o.equation && !o.wide) { assert.notEqual(c.v, good[0].v); assert.ok(Number.isInteger(c.v) && c.v > 0, `${o.key}: ${c.v}`); }
      assert.ok(c.slip, `${o.key}: the wrong coin ${c.label} is a named slip`);
      assert.ok(c.why && c.why.length > 10 && c.why.length < 200, `${o.key}: a one-line reason for ${c.label}: ${c.why}`);
    }
    assert.ok(o.story && o.ask && o.rightWhy && o.who && o.who.name, `${o.key}: has its words`);
    assert.ok(!/undefined|NaN|\[object/.test(o.story + o.ask + o.rightWhy + o.coins.map((c) => c.why + c.label).join('')), `${o.key}: ${o.story} ${o.ask}`);
  }
  assert.ok(n > 1000);
});

test('units on every answer: "12 pounds", "$36", "35¢", "5 miles an hour"', () => {
  for (const o of everyOrder(10)) {
    if (o.equation) continue;
    if (o.wide) { for (const c of o.coins) assert.match(c.label, /^\d+ \w+, \d+ left over$/, `${o.key}: ${c.label}`); continue; }   // (word coins: "22 sacks, 2 left over")
    for (const c of o.coins) {
      assert.match(c.label, /\d/);
      const units = c.label.replace(/[\d\s]/g, '');
      assert.ok(units.length >= 1, `${o.key}: ${c.label} carries its units`);
      assert.ok(c.small, `${o.key}: the coin's small line says the units (${c.label})`);
      if (o.unit === 'money') assert.match(c.label, o.cents ? /^\d+¢$/ : /^\$\d+$/);
    }
  }
  const o = makeOrder('rate', { rand: seeded(5), step: 5 });
  assert.ok(o.coins.every((c) => /(miles|mile|hours?|days?)( an hour| a day)?$/.test(c.label)), o.coins.map((c) => c.label).join(', '));
});

test('the right answer is right: worked out again from the numbers in the story', () => {
  // the story's numbers, in order (money signs, percents and "¢" stripped)
  const nums = (s) => (s.match(/\d+/g) || []).map(Number);
  for (const o of everyOrder(15)) {
    const r = o.coins.find((c) => c.good).v, n = nums(o.story);
    const k = o.key.split(':');
    if (k[0] === 'groups') assert.equal(r, n[0] * n[1], o.story);
    if (k[0] === 'compare') assert.equal(r, Math.max(n[0], n[1]) - Math.min(n[0], n[1]), o.story);
    if (k[0] === 'recipe') assert.equal(r, n[1] * n[2] / n[0], o.story);
    if (k[0] === 'share' && ['beans', 'riders', 'jars', 'canteens', 'bread'].includes(k[1])) assert.equal(r, Math.ceil(n[0] / n[1]), o.story);
    else if (k[0] === 'share') assert.equal(r, n[0] / n[1], o.story);
    if (k[0] === 'rate' && k[1] === 'speed') assert.equal(r, n[0] / n[1], o.story);
    if (k[0] === 'rate' && k[1] === 'time') assert.equal(r, n[1] / n[0], o.story);
    if (k[0] === 'rate' && k[1] === 'distance') assert.equal(r, n[0] * n[1], o.story);
    if (k[0] === 'percent' && k[1] === 'off') assert.equal(r, n[0] - n[0] * n[1] / 100, o.story);
    if (k[0] === 'percent' && k[1] === 'tax') assert.equal(r, n[0] + n[0] * n[1] / 100, o.story);
    if (k[0] === 'money' && k[1] === 'change') assert.equal(r, n[n.length - 1] - n[0], o.story);
    if (k[0] === 'money' && k[1] === 'several') assert.equal(r, n[0] * n[1], o.story);
    if (k[0] === 'bulk') {
      const m = nums(o.story + ' ' + o.ask);
      if (k[1] === 'mul') assert.equal(r, m[0] * m[1], o.story + ' ' + o.ask);
      if (k[1] === 'up') assert.equal(r, Math.ceil(m[0] / m[1]), o.story);
      if (k[1] === 'even') assert.equal(r, m[0] / m[1], o.story);
      if (k[1] === 'rem') assert.equal(o.coins.find((c) => c.good).label, `${Math.floor(m[0] / m[1])} ${o.coins[0].label.split(' ')[1].replace(',', '')}, ${m[0] % m[1]} left over`, o.story);
    }
    if (k[0] === 'equation') {
      const { a, b, c, x } = o.equation;
      assert.equal(a * x + b, c);
      assert.deepEqual(n.slice().sort((p, q) => p - q), [a, Math.abs(b), c].sort((p, q) => p - q), `${o.story}: the equation's numbers are the story's`);
    }
  }
});

test('the classic slips are there: 4 + 3 for groups, the hours taken for the speed, the dropped leftover for whole crates', () => {
  const find = (type, step, test) => { const r = seeded(9); for (let i = 0; i < 400; i++) { const o = makeOrder(type, { rand: r, step }); if (test(o)) return o; } return null; };
  const g = find('groups', 1, () => true);
  const [a, b] = g.story.match(/\d+/g).map(Number);
  assert.ok(g.coins.some((c) => c.slip === 'added' && c.v === a + b), 'added instead of multiplied');
  const rate = find('rate', 5, (o) => o.key.startsWith('rate:speed') && o.coins.some((c) => c.slip === 'swapped'));
  const [d, t] = rate.story.match(/\d+/g).map(Number);
  assert.ok(rate.coins.some((c) => c.slip === 'swapped' && c.v === t), `the hours (${t}) taken for the speed: ${d} miles in ${t}`);
  // the wagon from Yuma: an Old West wagon's speed (2 to 4 miles an hour), with believable wrong ones
  const r = seeded(1); let yuma = null;
  for (let i = 0; i < 20000 && !yuma; i++) { const o = makeOrder('rate', { rand: r, step: 5 }); if (/Yuma, which is \d+ miles away/.test(o.story) && /in \d+ hours/.test(o.story)) yuma = o; }
  assert.ok(yuma, 'the Yuma wagon story turns up');
  assert.match(yuma.answer, /^[234] miles an hour$/);
  const crates = find('share', 7, (o) => /crate|wagon|box/.test(o.ask) && /enough|everyone|every jar/.test(o.ask));
  assert.ok(crates, 'whole-crates orders come up from step 7');
  assert.ok(crates.coins.some((c) => c.slip === 'leftover' && c.v === crates.coins.find((x) => x.good).v - 1), 'the dropped leftover is one short');
  const two = find('twostep', 6, () => true);
  assert.ok(two.coins.some((c) => c.slip === 'stopped'), 'stopped after the first step');
  const rec = find('recipe', 7, () => true);
  assert.ok(rec.coins.some((c) => c.slip === 'addedOn'), 'added on to a recipe instead of scaling it');
  const pct = find('percent', 8, (o) => o.key.startsWith('percent:off'));
  assert.ok(pct.coins.some((c) => c.slip === 'discountOnly'), 'gave the discount instead of the price');
});

test('no keyword tricks: "each", "left", "more" and "in all" each turn up in more than one kind of problem', () => {
  const where = {};
  for (const o of everyOrder(12)) {
    const text = (o.story + ' ' + o.ask).toLowerCase();
    for (const w of ['each', 'left', 'more', 'in all']) if (new RegExp(`\\b${w}\\b`).test(text)) (where[w] = where[w] || new Set()).add(o.type);
  }
  for (const w of ['each', 'more', 'in all']) assert.ok(where[w] && where[w].size >= 2, `"${w}" in ${[...(where[w] || [])]}`);
  // "each" is in multiplying stories and sharing stories alike
  assert.ok(where.each.has('groups') && where.each.has('share'), [...where.each].join());
  // "more" in adding stories and taking-away stories
  assert.ok(where.more.has('compare') && where.more.has('parts'), [...where.more].join());
});

test('the top step: the equation fits the lock box (two steps), and the wrong equations are the real slips', () => {
  const r = seeded(4);
  for (let i = 0; i < 300; i++) {
    const o = makeOrder('equation', { rand: r, step: 9 });
    const { a, b, c, x, text } = o.equation;
    assert.equal(o.answer, text);
    assert.match(text, /^\dx [+−] \d+ = \d+$/);
    const p = lockboxProblem(o.equation);
    assert.ok(p, `${text} makes a lock box`);
    assert.equal(p.rung, EQ_RUNG);
    assert.equal(lineText(p.start).replace(/\s/g, ''), text.replace(/\s/g, '').replace('·', ''), 'the lock box shows the same equation');
    assert.equal(checkProblem(EQ_RUNG, p.start.L, p.start.R, x), null);
    assert.ok(p.par >= 1 && p.par <= 2);
    assert.ok(o.coins.length >= 3);
    for (const k of o.coins.filter((q) => !q.good)) assert.ok(['swapped', 'wrongSide', 'oneOnly'].includes(k.slip), k.slip);
    assert.ok(o.pic.kind === 'equation' && o.pic.a === a && o.pic.c === c);
  }
});

test('every kind has its own picture, and no picture gives the answer away', () => {
  const kinds = {};
  for (const o of everyOrder(8)) {
    kinds[o.type] = o.pic.kind;
    const right = o.coins.find((c) => c.good).v;
    const flat = JSON.stringify(o.pic);
    // the picture's numbers are the story's; the answer only shows if the story says it too
    const storyNums = new Set((o.story.match(/\d+/g) || []).map(Number));
    const picNums = (flat.match(/-?\d+/g) || []).map(Number);
    if (typeof right === 'number' && !storyNums.has(right)) assert.ok(!picNums.includes(right), `${o.key}: the picture holds the answer ${right}: ${flat}`);
  }
  assert.deepEqual(kinds, { groups: 'groups', share: 'share', parts: 'parts', compare: 'compare', rate: 'road', money: kinds.money, twostep: 'twostep', recipe: 'ratio', percent: 'percent', equation: 'equation', bulk: kinds.bulk });
  assert.ok(['lots', 'share'].includes(kinds.bulk));
  assert.ok(['groups', 'parts'].includes(kinds.money));
});

// ---- the trainer ---------------------------------------------------------------------------------------------------

// Play orders by a rule: right(order) -> true for right first time; a wrong one is then picked right.
function play(Q, n, right) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = Q.next();
    const ok = right(o, i);
    const miss = ok ? null : Q.answer(o, o.coins.findIndex((c) => !c.good));
    const pick = Q.answer(o, o.coins.findIndex((c) => c.good));
    out.push({ o, ok, res: miss || pick, step: Q.state.step });   // (res: what the first pick did)
  }
  return out;
}

test('no repeats in a row: never the same story twice running, nor the same townsperson, nor one kind 3 times', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const Q = makeWordProblems({}, { rand: seeded(seed) });
    let prev = null; const kinds = [];
    const rr = seeded(seed * 97);
    for (let i = 0; i < 120; i++) {
      const o = Q.next();
      if (prev) {
        assert.notEqual(o.key, prev.key, `seed ${seed}: ${o.key} twice running`);
        assert.notEqual(o.story, prev.story);
        assert.notEqual(o.who.name, prev.who.name, 'a new face each time');
      }
      kinds.push(o.back ? null : o.type);
      const run = kinds.slice(-(SAME_KIND_RUN + 1));
      if (run.length === SAME_KIND_RUN + 1 && run.every((k) => k && k === run[0])) assert.fail(`seed ${seed}: ${run[0]} ${SAME_KIND_RUN + 1} times running`);
      const ok = rr() < 0.8;
      if (!ok) Q.answer(o, o.coins.findIndex((c) => !c.good));
      Q.answer(o, o.coins.findIndex((c) => c.good));
      prev = o;
    }
  }
});

test('the ladder: 3 right first time moves up, a miss moves down; only the first pick of an order counts', () => {
  assert.deepEqual([CLEAN_TO_CLIMB, MISS_DOWN, PLACEMENT_MISSES], [3, 1, 2]);
  const state = { step: 4, placing: false };
  const Q = makeWordProblems(state, { rand: seeded(2) });
  play(Q, 2, () => true);
  assert.equal(state.step, 4, 'two right: not yet');
  play(Q, 1, () => true);
  assert.equal(state.step, 5, 'three right: up a step');
  play(Q, 1, () => false);
  assert.equal(state.step, 4, 'a miss: down a step');
  // the second (right) pick after a miss changes nothing more
  const o = Q.next();
  const a = Q.answer(o, o.coins.findIndex((c) => !c.good));
  const b = Q.answer(o, o.coins.findIndex((c) => c.good));
  assert.equal(a.first, true); assert.equal(b.first, false); assert.equal(b.moved, 0);
  assert.equal(state.step, 3);
  // never below step 1, never above the top
  const low = { step: 1, placing: false }; const L = makeWordProblems(low, { rand: seeded(3) });
  play(L, 5, () => false); assert.equal(low.step, 1);
  const top = { step: LADDER.length, placing: false }; const T = makeWordProblems(top, { rand: seeded(3) });
  play(T, 9, () => true); assert.equal(top.step, LADDER.length);
});

test('peeking is free: a right pick after opening the picture is paid but neither climbs nor drops', () => {
  const state = { step: 3, placing: false, streak: 2 };
  const Q = makeWordProblems(state, { rand: seeded(4) });
  const o = Q.next();
  const res = Q.answer(o, o.coins.findIndex((c) => c.good), { helped: true });
  assert.equal(res.right, true);
  assert.equal(state.step, 3);
  assert.equal(state.streak, 2, 'the streak waits');
});

test('first visit climbs fast, forgives one slip, and settles PLACE_BELOW below the step of the second miss', () => {
  const state = {};
  const Q = makeWordProblems(state, { rand: seeded(5) });
  assert.equal(state.step, 1); assert.equal(state.placing, true);
  play(Q, 4, () => true);
  assert.equal(state.step, 5, 'one step an order while every order is right');
  play(Q, 1, () => false);
  assert.equal(state.placing, true, 'the first slip is forgiven');
  assert.equal(state.step, 5);
  play(Q, 1, () => true);
  assert.equal(state.step, 6);
  const r = play(Q, 1, () => false);
  assert.equal(state.placing, false);
  assert.equal(r[0].res.placed, true);
  assert.equal(state.step, 6 - PLACE_BELOW);
  // a kid who gets everything right climbs to the top and stops climbing there
  const s2 = {}; const Q2 = makeWordProblems(s2, { rand: seeded(6) });
  play(Q2, 12, () => true);
  assert.equal(s2.step, LADDER.length); assert.equal(s2.placing, false);
});

test('a missed kind comes back 2 to 4 orders later, with new numbers', () => {
  let seen = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const state = { step: 5, placing: false };
    const Q = makeWordProblems(state, { rand: seeded(seed) });
    const o = Q.next();
    Q.answer(o, o.coins.findIndex((c) => !c.good));
    Q.answer(o, o.coins.findIndex((c) => c.good));
    const after = [];
    for (let i = 0; i < 6; i++) { const n = Q.next(); after.push(n); Q.answer(n, n.coins.findIndex((c) => c.good)); }
    const back = after.findIndex((n) => n.back);
    assert.ok(back >= COMEBACK_MIN - 1 && back <= COMEBACK_MAX - 1, `seed ${seed}: came back at ${back + 1} (${after.map((n) => n.type + (n.back ? '*' : ''))})`);
    assert.equal(after[back].type, o.type);
    assert.notEqual(after[back].story, o.story);
    seen++;
  }
  assert.equal(seen, 30);
});

test('state is plain JSON: it survives a save and a reload, and junk is cleaned up', () => {
  const state = {};
  const Q = makeWordProblems(state, { rand: seeded(7) });
  play(Q, 10, (o, i) => i % 4 !== 3);
  const back = JSON.parse(JSON.stringify(state));
  assert.deepEqual(back, state);
  const Q2 = makeWordProblems(back, { rand: seeded(8) });
  assert.equal(Q2.level().step, state.step);
  const junk = { step: 'x', placing: 3, due: [{ type: 'nope', at: 1 }, null], recent: 'abc', byType: [] };
  const Q3 = makeWordProblems(junk, { rand: seeded(9) });
  assert.equal(junk.step, 1); assert.deepEqual(junk.due, []); assert.ok(Array.isArray(junk.recent));
  assert.ok(Q3.next().coins.length >= 3);
  assert.match(Q3.level().line, /^Step 1 of 9: /);
});

test('simulated kids settle near 4 in 5 right first time on their own step, and stronger kids settle higher', (t) => {
  // A kid whose chance on an order falls off with its step (90%, 70% or 50% on step 5). The 3-up, 1-down ladder
  // settles where p^3 = 1/2, about 79% right; measured 78.5 to 79.4% over 4 seed sets (SEED_OFFSET 0, 1000, 2000,
  // 3000), every kid strength.
  // Re-measure with other seeds: SEED_OFFSET=1000 node --test ...
  const band = [0.74, 0.85];
  const lines = [], steps = {};
  for (const A of [0.9, 0.7, 0.5]) {
    const tally = [0, 0], st = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = {};
      const Q = makeWordProblems(state, { rand: seeded(seed) });
      const rr = seeded(seed * 7919 + 13);
      const skill = 5 + Math.log(A / (1 - A)) / 0.9;
      const P = (step) => 1 / (1 + Math.exp(-0.9 * (skill - step)));
      for (let i = 0; i < 400; i++) {
        const o = Q.next();
        const ok = rr() < P(o.step);
        if (i >= 80) { tally[1]++; if (ok) tally[0]++; st.push(state.step); }
        if (!ok) Q.answer(o, o.coins.findIndex((c) => !c.good));
        Q.answer(o, o.coins.findIndex((c) => c.good));
      }
    }
    const share = tally[0] / tally[1];
    steps[A] = st.reduce((a, b) => a + b, 0) / st.length;
    lines.push(`kid at ${A * 100}% on step 5: ${(share * 100).toFixed(1)}% right first time, settles near step ${steps[A].toFixed(2)}`);
    assert.ok(share >= band[0] && share <= band[1], lines[lines.length - 1]);
  }
  assert.ok(steps[0.9] > steps[0.7] + 0.5 && steps[0.7] > steps[0.5] + 0.5, `stronger kids settle higher ${JSON.stringify(steps)}`);
  t.diagnostic(lines.join('\n'));
});

test('townsfolk: a good spread of names, she and he, each with a look for the person who walks up', () => {
  assert.ok(FOLK.length >= 12);
  assert.ok(FOLK.some((f) => f.she) && FOLK.some((f) => !f.she));
  assert.equal(new Set(FOLK.map((f) => f.name)).size, FOLK.length);
  for (const f of FOLK) assert.ok(f.look && f.look.outfit && f.look.palette);
});

test('every picture draws, shows a "?", and never prints the answer (not even an equation\'s)', () => {
  for (const o of everyOrder(6)) {
    const p = picture(o.pic);
    assert.ok(p.svg.startsWith('<svg') && p.title && p.line, `${o.key}: draws`);
    assert.ok(p.svg.includes('?') || p.line.includes('?'), `${o.key}: the unknown is a "?"`);
    if (o.equation) {
      const flat = (t) => t.replace(/\s/g, '');
      assert.ok(!flat(p.line).includes(flat(o.equation.text)) && !flat(p.svg).includes(flat(o.equation.text)), `${o.key}: the picture prints ${o.equation.text}`);
    }
    assert.ok(!/undefined|NaN/.test(p.svg + p.line), `${o.key}: ${p.line}`);
  }
});

test('a recipe order never prints its answer in the story', () => {
  for (let seed = 0; seed < 3000; seed++) {
    const o = makeOrder('recipe', { rand: seededAt(seed), step: 1 + seed % LADDER.length });
    const nums = (o.story.match(/\d+/g) || []).map(Number);
    const ans = Number(String(o.answer).match(/[\d.]+/)[0]);   // (the answer is the right coin's label, e.g. '12 cups')
    assert.ok(!nums.includes(ans), `seed ${seed}: ${o.story} -> ${o.answer}`);
  }
});

// ---- on the strands (the adaptive game) -------------------------------------------------------------------------------
import { K_LADDER, K_TYPES, SIZE, setupOf } from '../src/math/wordproblems.js';
import { STRAND, MAPS } from '../src/math/strands.js';
import { needsLong, longPoint } from '../src/math/longwork.js';

test('the youngest riders\' picture stories: small numbers, 3 coins, the things drawn from the start, read out', () => {
  assert.deepEqual(MAPS.storeK.anchors.length, K_LADDER.length);
  for (const type of K_TYPES) for (let step = 1; step <= K_LADDER.length; step++) {
    const r = seeded(700 + step);
    for (let i = 0; i < 40; i++) {
      const o = makeOrder(type, { rand: r, step, ladder: 'K' });
      assert.equal(o.ladder, 'K'); assert.ok(o.picFirst, 'the picture shows from the start');
      assert.equal(o.coins.length, 3, `${o.key}: 3 coins`);
      assert.equal(o.coins.filter((c) => c.good).length, 1);
      const nums = (o.story.match(/\d+/g) || []).map(Number);
      assert.ok(nums.every((v) => v <= Math.max(K_LADDER[step - 1].most, 5)), `${o.story}: small numbers`);
      const right = o.coins.find((c) => c.good).v;
      if (type === 'kmore') assert.equal(right, nums[0] + nums[1]);
      if (type === 'kleft') assert.equal(right, nums[0] - nums[1]);
      if (type === 'kgroups') assert.equal(right, nums[0] * nums[1]);
      assert.ok(right <= 20 && right >= 1);
      assert.equal(o.read, `${o.story} ${o.ask}`, 'the words to read out');
      const p = picture(o.pic);
      assert.equal(o.pic.kind, 'things');
      assert.match(p.svg, /\?/); assert.ok(!/undefined|NaN/.test(p.svg + p.line));
      assert.ok(!new RegExp(`>[^<]*\\b${right}\\b[^<]*<`).test(p.svg) || nums.includes(right), `${o.key}: the picture doesn't print ${right}`);
      assert.ok(o.credit.length === 1 && o.credit[0].weight === 0.5 && ['add', 'sub', 'mul'].includes(o.credit[0].strand), JSON.stringify(o.credit));
      assert.ok(!/undefined|NaN/.test(o.story + o.ask + o.rightWhy + o.coins.map((c) => c.why).join('')), o.story);
    }
  }
});

test('big orders (bulk): the sum comes from the Long work step, needs the worked area, and the worked area has its setup', () => {
  for (let longStep = 1; longStep <= 9; longStep++) {
    const r = seeded(800 + longStep);
    for (let i = 0; i < 30; i++) {
      const o = makeOrder('bulk', { rand: r, step: 8, longStep });
      const L = o.long;
      assert.ok(L, `${o.key}: has its worked area`);
      const [x, y] = L.op === 'mul' ? [L.a, L.b] : [L.n, L.d];
      assert.ok(needsLong(L.op, x, y));
      assert.equal(L.point, MAPS.long.anchors[longStep - 1], `${o.story}: made at the Long work step's point`);
      assert.equal(L.setup.choices.filter((c) => c.good).length, 1);
      assert.equal(L.setup.choices.find((c) => c.good).label, `${x} ${L.op === 'mul' ? '×' : '÷'} ${y}`);
      for (const c of L.setup.choices) if (!c.good) assert.ok(c.why && c.why.length > 10);
      if (L.op === 'div') { assert.ok(L.final, 'a division ends with the word answer'); assert.deepEqual(L.final.choices.map((c) => c.label), o.coins.map((c) => c.label)); }
      else assert.equal(L.final, null);
      assert.ok(o.credit.some((c) => c.strand === 'long' && c.long && c.weight === 0.5 && c.at === L.point), 'a coin picked without the worked area counts in Long work at 0.5');
    }
  }
  // whole crates: 112 cans, crates of 5 -> 23 crates (22 full, the last 2 need one more)
  let crates = null;
  for (let sd = 1; sd < 400 && !crates; sd++) { const o = makeOrder('bulk', { rand: seeded(sd), step: 7, longStep: 4 }); if (o.key.startsWith('bulk:up') && o.long.n % o.long.d) crates = o; }
  const q = Math.floor(crates.long.n / crates.long.d);
  assert.equal(crates.coins.find((c) => c.good).v, q + 1);
  assert.ok(crates.coins.some((c) => c.v === q && c.slip === 'roundDown'), 'forgot the leftover is a coin');
});

test('stories wrapped round a long sum read right at every size (no 349-pound sacks, no 25-seat wagons)', () => {
  for (let longStep = 1; longStep <= 9; longStep++) {
    const r = seeded(900 + longStep);
    for (let i = 0; i < 60; i++) {
      const o = makeOrder('bulk', { rand: r, step: 9, longStep });
      if (/sack holds (\d+) pounds/.test(o.story)) assert.ok(Number(RegExp.$1) <= 99, o.story);
      if (/a wagon seats (\d+)/.test(o.story)) assert.ok(Number(RegExp.$1) <= 12, o.story);
      assert.ok(!/church/i.test(o.story));
    }
  }
});

test('orders on the strands: a step given makes the order there and never moves the ladder; a missed kind still comes back', () => {
  const Q = makeWordProblems({}, { rand: seeded(31) });
  const before = Q.state.step;
  let missed = null;
  for (let i = 0; i < 12; i++) {
    const o = Q.next({ step: 7 });
    assert.equal(o.step, 7); assert.ok(o.fixed);
    const res = Q.answer(o, o.coins.findIndex((c) => (i === 0 ? !c.good : c.good)));
    assert.equal(res.moved, 0);
    if (i === 0) missed = o.type;
  }
  assert.equal(Q.state.step, before, 'the old ladder stays where it was');
  assert.ok(Q.state.byType[missed].n >= 1);
  // the picture stories' ladder
  const k = Q.next({ step: 2, ladder: 'K' });
  assert.equal(k.ladder, 'K'); assert.ok(K_TYPES.includes(k.type)); assert.equal(k.step, 2);
});

test('what else each order counts in: every kind\'s credit names a real strand, at a point, light unless it is the kind\'s own math', () => {
  const seen = {};
  for (const o of everyOrder(6)) {
    for (const c of o.credit) {
      assert.ok(STRAND[c.strand], `${o.key}: ${c.strand}`);
      assert.ok(c.at >= 0 && c.at <= 100);
      assert.ok(c.weight === 0.5 || c.weight === 1, `${o.key}: weight ${c.weight}`);
      (seen[o.type] = seen[o.type] || new Set()).add(c.strand);
    }
    assert.ok(o.size >= 1);
  }
  assert.ok(seen.groups.has('mul')); assert.ok(seen.share.has('div')); assert.ok(seen.parts.has('add') && seen.parts.has('sub'));
  assert.ok(seen.compare.has('sub')); assert.ok(seen.rate.has('ratio')); assert.ok(seen.money.has('money')); assert.ok(seen.recipe.has('ratio'));
  assert.ok(seen.percent.has('pct')); assert.ok(seen.equation.has('eq')); assert.ok(seen.twostep.has('mul'));
  const m = makeOrder('money', { rand: seeded(3), step: 5 });
  assert.equal(m.credit[0].strand, 'money'); assert.equal(m.credit[0].weight, 1, 'money counts fully in Money');
  assert.equal(SIZE.twostep, 2);
});

test('speeds are the Old West\'s, right and wrong: no wagon at 441 miles an hour (every mover, every step, both ways round)', () => {
  const cap = { wagon: { hour: 7, day: 18 }, herd: { hour: 6, day: 18 }, stage: { hour: 12 }, rider: { hour: 11 } };
  for (let sd = 1; sd <= 3000; sd++) {
    const o = makeOrder('rate', { rand: seeded(sd), step: 4 + (sd % 6) });
    const who = o.key.split(':')[2], per = /a day/.test(o.story + o.ask) ? 'day' : 'hour';
    for (const c of o.coins) {
      if (/miles? (an hour|a day)$/.test(c.label)) assert.ok(c.v >= 1 && c.v <= cap[who][per], `${o.story} ${o.ask}: ${c.label}`);
      if (/^(\d+) (hours?|days?)$/.test(c.label)) assert.ok(c.v >= 1 && c.v <= (per === 'day' ? 30 : 14), `${o.story} ${o.ask}: ${c.label}`);
    }
    assert.ok(o.coins.length >= 3, o.story);
  }
});

test('a speed in miles a day stays in the tables unless the rider\'s Long work is up to it; a long one gets the worked area', () => {
  let longOnes = 0;
  for (let sd = 1; sd <= 400; sd++) {
    const kept = makeOrder('rate', { rand: seeded(sd), step: 9, longMost: 30 });
    assert.equal(kept.long, null, `${kept.story}: kept to the tables`);
    const free = makeOrder('rate', { rand: seeded(sd), step: 9 });
    if (free.long) {
      longOnes++;
      const [x, y] = free.long.op === 'mul' ? [free.long.a, free.long.b] : [free.long.n, free.long.d];
      assert.equal(free.long.point, longPoint(free.long.op, x, y));
      assert.ok(free.credit.some((c) => c.strand === 'long'));
    }
  }
  assert.ok(longOnes > 10, `${longOnes} long ones`);
});

test('more goods in the orders: coffee, vegetables, bread, matches and canteens all turn up', () => {
  const text = [];
  for (const o of everyOrder(12)) text.push(o.story);
  const all = text.join(' ');
  for (const w of ['coffee', 'vegetables', 'bread', 'matches', 'canteens']) assert.match(all, new RegExp(w), `${w} turns up`);
  for (const w of ['sacks', 'loaves', 'boxes', 'crates']) assert.match(all, new RegExp(w), `${w} turns up`);
});

test('the setup choices: the right sum and three wrong ones, each with a nudge', () => {
  for (const [op, x, y] of [['mul', 16, 7], ['div', 112, 5]]) {
    const S = setupOf(op, x, y);
    assert.equal(S.choices.length, 4); assert.equal(new Set(S.choices.map((c) => c.label)).size, 4);
    assert.equal(S.choices.filter((c) => c.good).length, 1);
  }
});

test('a step of one kind only (the first picture stories) deals on and on: the same-kind rule can\'t empty it', () => {
  const Q = makeWordProblems({}, { rand: seeded(77) });
  for (let i = 0; i < 30; i++) { const o = Q.next({ step: 1, ladder: 'K' }); assert.equal(o.type, 'kmore'); Q.answer(o, o.coins.findIndex((c) => c.good)); }
});

test('"several at one price" grows with the step: no one-digit times fact past "two steps", credited where its money sits', () => {
  const rand = seeded(77);
  let seen = { 5: 0, 7: 0 };
  for (const step of [5, 6, 7, 8, 9]) for (let i = 0; i < 400; i++) {
    const o = makeOrder('money', { rand, step });
    if (!/^money:several/.test(o.key)) continue;
    const m = /wants (\d+) .*?\$?(\d+)¢? each/.exec(o.story);
    const n = +m[1], each = +m[2];
    if (step >= 7) { assert.ok(n >= 11 && !o.cents, `step ${step}: ${o.story}`); seen[7]++; }
    if (step === 5) { assert.ok(n <= 9 && each <= 9, o.story); seen[5]++; }
    assert.ok(o.credit.every((c) => c.strand !== 'money' || c.at <= 50), JSON.stringify(o.credit));
  }
  assert.ok(seen[5] > 20 && seen[7] > 20, JSON.stringify(seen));
});

test('one left over is said in the singular ("the last can needs a crate too")', () => {
  const o = makeOrder('bulk', { rand: seeded(3), step: 7, sum: { op: 'div', n: 157, d: 6 } });
  if (o.rightWhy) assert.ok(!/\b1 (cans|canteens|people|loaves)\b/.test(o.rightWhy), o.rightWhy);
  const whys = (o.coins || []).map((c) => c.why || '').filter(Boolean);
  assert.ok(whys.some((w) => /nowhere to go/.test(w)), whys.join(' | '));
  for (const w of whys) assert.ok(!/\b1 (cans|canteens|people|loaves)\b/.test(w), w);
});
