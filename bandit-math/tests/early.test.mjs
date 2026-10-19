// Tests for the early topics: Counting, Adding and Taking away (src/math/counting.js, adding.js, taking.js), the card
// trainer they share (src/math/early.js), their sick-sheep sums, and the pure part of their helper (src/ui/counthelp.js).
// Run with:  node --test bandit-math/tests/early.test.mjs
// Every random choice is seeded. To check a result isn't luck of the seeds, run again on other seed sets:
//   SEED_OFFSET=1000 node --test bandit-math/tests/early.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/math/early.js';
import * as Cn from '../src/math/counting.js';
import * as Ad from '../src/math/adding.js';
import * as Tk from '../src/math/taking.js';
import { makeTopic, hasTopic, HERD_TOPICS } from '../src/math/topic.js';
import { flockTopics, levelOf, makeFlock } from '../src/missions/sheepmath.js';
import { setLevel } from '../src/math/skill.js';
import { TOPICS } from '../src/save.js';
import { layoutCountHelp } from '../src/ui/counthelp.js';

const NOW = 1e12, HOUR = 3600e3;
const OFFSET = Number(process.env.SEED_OFFSET) || 0;
const seeded = (seed) => E.seeded(seed + OFFSET);
const TOPIC = { counting: Cn, adding: Ad, taking: Tk };
const MAKE = { counting: Cn.makeCounting, adding: Ad.makeAdding, taking: Tk.makeTaking };
const make = (topic, seed = 1, state = {}, now = NOW) => MAKE[topic](state, { rand: seeded(seed), now: () => now });

// Many cards from every step of a topic.
function cardsOf(topic, perStep = 80, seed = 1) {
  const M = TOPIC[topic], rand = seeded(seed), out = [];
  M.LADDER.forEach((row, i) => {
    for (let k = 0; k < perStep; k++) {
      const p = M.problem(E.pick(row.shapes, rand), row, rand);
      out.push({ step: i + 1, p, c: { ...M.card(p, { size: 3 + (k % 4), rand }), parts: p } });
    }
  });
  return out;
}

// Play a wave: every card right first time, or wrong once then right, by a rule.
function playWave(T, w, rightFirst) {
  let card = w.card, guard = 0;
  const seen = [];
  while (card && guard++ < 40) {
    seen.push(card);
    if (rightFirst(card)) { card = T.answer(card.answer, true, card.id).card; continue; }
    T.answer(card.targets.find((t) => !t.good).n, false, card.id);
    card = T.answer(card.answer, true, card.id).card;
  }
  return seen;
}

// ---- the ladders ------------------------------------------------------------------------------------------------

test('every card has one right answer, no repeated numbers, and only real numbers', () => {
  for (const topic of Object.keys(TOPIC)) {
    for (const { step, p, c } of cardsOf(topic)) {
      const M = TOPIC[topic];
      assert.equal(c.answer, M.answerOf(p), `${topic} ${c.rule}`);
      assert.ok(Number.isInteger(c.answer) && c.answer >= 0, `${topic} step ${step}: ${c.rule} = ${c.answer}`);
      assert.equal(c.targets.filter((t) => t.good).length, 1, `${topic} ${c.rule}: one right`);
      assert.equal(c.targets.find((t) => t.good).n, c.answer);
      const ns = c.targets.map((t) => t.n);
      assert.equal(new Set(ns).size, ns.length, `${topic} ${c.rule}: no number twice ${ns}`);
      assert.ok(ns.every((n) => Number.isInteger(n) && n >= 0), `${topic} ${c.rule}: ${ns}`);
      assert.ok(c.rule && c.text && c.done && c.sub, `${topic}: the card has its words`);
      assert.ok(!/undefined|NaN/.test(`${c.rule} ${c.text} ${c.done} ${c.sub}`), `${topic}: ${c.rule} / ${c.done}`);
      for (const t of c.targets) assert.equal(t.label, String(t.n));
    }
  }
});

test('each ladder starts gentle and climbs', () => {
  const at = (topic, step) => cardsOf(topic, 120).filter((x) => x.step === step).map((x) => x.p);
  // counting: dots up to 5 first; counting by 2s, 5s and 10s and 10 more / less up to 100 at the top
  assert.ok(at('counting', 1).every((p) => p.shape === 'dots' && p.n >= 2 && p.n <= 5));
  assert.ok(at('counting', 2).every((p) => p.shape === 'after' && p.n + 1 <= 10));
  assert.ok(at('counting', 7).every((p) => p.shape === 'skip' && [2, 5, 10].includes(p.by)));
  assert.ok(at('counting', 8).some((p) => p.shape === 'tenMore') && at('counting', 8).every((p) => Cn.answerOf(p) <= 100));
  assert.ok(at('counting', 6).some((p) => p.shape === 'after' && (p.n + 1) % 10 === 0), 'step 6 counts over a ten (after 29)');
  // adding: + 1 or 2 within 10 first; sums past 10 in the middle; two-digit sums up to 100 at the top
  assert.ok(at('adding', 1).every((p) => p.shape === 'sum' && Math.min(p.a, p.b) <= 2 && p.a + p.b <= 10));
  assert.ok(at('adding', 2).every((p) => p.a + p.b <= 10));
  assert.ok(at('adding', 3).some((p) => p.shape === 'part' && p.t === 10), 'making 10');
  assert.ok(at('adding', 5).every((p) => p.a + p.b > 10 && p.a + p.b <= 18 && p.a < 10 && p.b < 10));
  assert.ok(at('adding', 7).some((p) => p.shape === 'sum' && (p.a % 10) + (p.b % 10) >= 10 && p.a + p.b > 20), 'carrying');
  assert.ok(at('adding', 8).every((p) => p.a >= 10 && p.b >= 10 && p.a + p.b <= 99));
  // taking away: − 1 or 2 first; past 10 in the middle; two-digit at the top
  assert.ok(at('taking', 1).every((p) => p.shape === 'diff' && p.b <= 2 && p.a <= 10));
  assert.ok(at('taking', 3).some((p) => p.shape === 'left') && at('taking', 3).some((p) => p.a === 10));
  assert.ok(at('taking', 4).some((p) => p.shape === 'part'));
  assert.ok(at('taking', 6).filter((p) => p.shape === 'diff').every((p) => p.a > 10 && (p.a % 10) < p.b && p.b < 10), 'past 10');
  assert.ok(at('taking', 8).every((p) => p.a >= 30 && p.b >= 11 && p.a - p.b >= 5));
});

test('a card asks for as many answers as it is told (3 to 6), one right', () => {
  for (const topic of Object.keys(TOPIC)) {
    const T = make(topic, 3);
    for (let step = 1; step <= TOPIC[topic].LADDER.length; step++) {
      T.setStep(step);
      for (const count of [3, 4, 5, 6]) {
        const w = T.wave({ count });
        for (const c of w.cards) assert.ok(c.targets.length <= count && c.targets.length >= 3, `${topic} ${c.rule}: ${c.targets.length} of ${count}`);
        playWave(T, w, () => true);
      }
    }
  }
});

// ---- the wrong picks --------------------------------------------------------------------------------------------

test('the real slips are named', () => {
  const C = (p, n) => Cn.classify(p, n), A = (p, n) => Ad.classify(p, n), K = (p, n) => Tk.classify(p, n);
  assert.equal(C({ shape: 'after', n: 7 }, 7), 'same');
  assert.equal(C({ shape: 'after', n: 7 }, 6), 'back');
  assert.equal(C({ shape: 'after', n: 7 }, 9), 'skip');
  assert.equal(C({ shape: 'after', n: 29 }, 20), 'tenBack');
  assert.equal(C({ shape: 'after', n: 29 }, 40), 'tenJump');
  assert.equal(C({ shape: 'after', n: 16 }, 71), 'turn');
  assert.equal(C({ shape: 'before', n: 30 }, 20), 'tenDrop');
  assert.equal(C({ shape: 'before', n: 30 }, 39), 'wrongTen');
  assert.equal(C({ shape: 'dots', n: 7 }, 5), 'row');
  assert.equal(C({ shape: 'dots', n: 13 }, 10), 'frame');
  assert.equal(C({ shape: 'dots', n: 7 }, 8), 'over');
  assert.equal(C({ shape: 'skip', by: 5, start: 5 }, 16), 'byOne');
  assert.equal(C({ shape: 'skip', by: 5, start: 5 }, 25), 'skipOne');
  assert.equal(C({ shape: 'tenMore', n: 34 }, 35), 'byOne');
  assert.equal(C({ shape: 'tenMore', n: 34 }, 24), 'wrongWay');
  assert.equal(A({ shape: 'sum', a: 8, b: 5 }, 12), 'countStart');
  assert.equal(A({ shape: 'sum', a: 8, b: 5 }, 3), 'noTen');
  assert.equal(A({ shape: 'sum', a: 8, b: 5 }, 14), 'over');
  assert.equal(A({ shape: 'sum', a: 9, b: 4 }, 5), 'takeAway');
  assert.equal(A({ shape: 'sum', a: 27, b: 6 }, 23), 'noCarry');
  assert.equal(A({ shape: 'sum', a: 27, b: 6 }, 213), 'stuck');
  assert.equal(A({ shape: 'sum', a: 23, b: 5 }, 73), 'place');
  assert.equal(A({ shape: 'sum', a: 34, b: 20 }, 36), 'place');
  assert.equal(A({ shape: 'sum', a: 30, b: 40 }, 7), 'zeros');
  assert.equal(A({ shape: 'sum', a: 36, b: 27 }, 56), 'half');
  assert.equal(A({ shape: 'part', a: 3, t: 8 }, 8), 'total');
  assert.equal(A({ shape: 'part', a: 3, t: 8 }, 11), 'added');
  assert.equal(A({ shape: 'part', a: 3, t: 8 }, 6), 'countStart');
  assert.equal(K({ shape: 'diff', a: 9, b: 4 }, 6), 'countStart');
  assert.equal(K({ shape: 'diff', a: 9, b: 4 }, 13), 'added');
  assert.equal(K({ shape: 'diff', a: 9, b: 4 }, 4), 'given');
  assert.equal(K({ shape: 'diff', a: 17, b: 4 }, 3), 'noTen');
  assert.equal(K({ shape: 'diff', a: 13, b: 5 }, 12), 'flip');
  assert.equal(K({ shape: 'diff', a: 34, b: 6 }, 32), 'flip');
  assert.equal(K({ shape: 'diff', a: 34, b: 6 }, 38), 'noBorrow');
  assert.equal(K({ shape: 'diff', a: 53, b: 26 }, 33), 'flip');
  assert.equal(K({ shape: 'diff', a: 53, b: 26 }, 37), 'noBorrow');
  assert.equal(K({ shape: 'diff', a: 46, b: 20 }, 44), 'place');
  assert.equal(K({ shape: 'diff', a: 70, b: 30 }, 4), 'zeros');
  assert.equal(K({ shape: 'part', a: 8, r: 5 }, 5), 'left');
  assert.equal(K({ shape: 'part', a: 8, r: 5 }, 8), 'total');
  assert.equal(Cn.classify({ shape: 'after', n: 7 }, 8), null, 'the answer is no slip');
});

test('every wrong pick gets one plain line that says the right answer', () => {
  for (const topic of Object.keys(TOPIC)) {
    const M = TOPIC[topic];
    const specific = {};
    for (const { c } of cardsOf(topic, 60, 5)) {
      for (const t of c.targets.filter((x) => !x.good)) {
        const { slip, line } = M.whyNot(c, t.n);
        assert.equal(slip, t.trap === 'other' ? M.classify(c.parts, t.n) : t.trap, `${topic} ${c.rule}: ${t.n}`);
        assert.ok(line && !line.includes('\n') && line.length <= 190, `${topic} ${c.rule} ${t.n}: ${line}`);
        assert.ok(!/undefined|NaN|\[object/.test(line), line);
        assert.ok(new RegExp(`(^|[^0-9])${c.answer}([^0-9]|$)`).test(line), `${topic} ${c.rule} picked ${t.n}: "${line}" names ${c.answer}`);
        if (slip !== 'other') { specific[slip] = (specific[slip] || 0) + 1; assert.ok(!/^Not that one/.test(line), `${slip} has its own line: ${line}`); }
      }
    }
    assert.ok(Object.keys(specific).length >= 8, `${topic}: many kinds of slip are dealt (${Object.keys(specific)})`);
  }
});

test('some lines, word for word', () => {
  const C = (p, n) => Cn.whyNot({ parts: p }, n).line, A = (p, n) => Ad.whyNot({ parts: p }, n).line, K = (p, n) => Tk.whyNot({ parts: p }, n).line;
  assert.equal(C({ shape: 'after', n: 7 }, 7), "That's 7 itself. After 7 comes 8: 7, 8.");
  assert.equal(C({ shape: 'dots', n: 7 }, 5), "That's just the first row of 5. Count on from 5: 6, 7. There are 7.");
  assert.equal(C({ shape: 'after', n: 29 }, 20), '20 goes back to the start of the ten. After 29 the ones run out, so the tens go up: 30.');
  assert.equal(A({ shape: 'sum', a: 8, b: 5 }, 12), 'You counted the 8 as a hop. Start at 8 and count on 5: 9, 10, 11, 12, 13.');
  assert.equal(A({ shape: 'sum', a: 8, b: 5 }, 3), "That's only the ones. 8 + 2 makes 10, then 3 more: 13.");
  assert.equal(A({ shape: 'sum', a: 27, b: 6 }, 23), "7 + 6 = 13: that's a new ten. Carry it: 27 + 6 = 33.");
  assert.equal(K({ shape: 'diff', a: 9, b: 4 }, 6), 'You counted the 9 as a hop. Start at 9 and hop back 4: 8, 7, 6, 5.');
  assert.equal(K({ shape: 'diff', a: 13, b: 5 }, 12), "That did 5 − 3. 3 can't take away 5: go back 3 to 10, then 2 more: 8.");
  assert.equal(K({ shape: 'part', a: 8, r: 5 }, 8), "That's the 8 you started with. 8 − 3 = 5, so 3 were taken.");
  assert.equal(K({ shape: 'diff', a: 56, b: 47 }, 19), 'You broke a ten into ones, but kept it too: 5 tens became 4. 16 − 7 = 9 ones, and 4 tens − 4 tens = 0 tens: 9.');
});

test('no guessing rule beats a plain guess by much: where the answer sits among the numbers is random', (t) => {
  const rules = {
    smallest: (ns) => Math.min(...ns), biggest: (ns) => Math.max(...ns),
    second: (ns) => [...ns].sort((a, b) => a - b)[1], secondBig: (ns) => [...ns].sort((a, b) => b - a)[1],
    middle: (ns) => [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)],
    runMiddle: (ns) => ns.find((n) => ns.includes(n - 1) && ns.includes(n + 1)),
  };
  const lines = [];
  for (const topic of Object.keys(TOPIC)) {
    const all = cardsOf(topic, 400, 9);
    let guess = 0; const hit = {};
    for (const step of TOPIC[topic].LADDER.map((_, i) => i + 1)) {
      const cs = all.filter((x) => x.step === step);
      const g = cs.reduce((s, x) => s + 1 / x.c.targets.length, 0) / cs.length;
      for (const [r, f] of Object.entries(rules)) {
        const share = cs.filter((x) => f(x.c.targets.map((y) => y.n)) === x.c.answer).length / cs.length;
        hit[r] = (hit[r] || 0) + share / TOPIC[topic].LADDER.length;
        // (the first steps' answers are small numbers: there is little room for wrong ones below them)
        assert.ok(share <= g + 0.17, `${topic} step ${step}: "${r}" is right ${(share * 100).toFixed(0)}% (a guess ${(g * 100).toFixed(0)}%)`);
      }
      guess += g / TOPIC[topic].LADDER.length;
    }
    for (const [r, v] of Object.entries(hit)) assert.ok(v <= guess + 0.07, `${topic} overall: "${r}" ${(v * 100).toFixed(0)}% against a guess's ${(guess * 100).toFixed(0)}%`);
    lines.push(`${topic}: guess ${(guess * 100).toFixed(0)}%, ${Object.entries(hit).map(([r, v]) => `${r} ${(v * 100).toFixed(0)}%`).join(', ')}`);
  }
  t.diagnostic(lines.join('\n'));
});

// ---- the trainer ------------------------------------------------------------------------------------------------

test('first visit: climbs a step a clean card, forgives one slip, settles PLACE_BELOW below at the second miss', () => {
  for (const topic of Object.keys(TOPIC)) {
    const T = make(topic, 2);
    assert.equal(T.state.step, 1);
    let w = T.wave();
    let c = w.card;
    c = T.answer(c.answer, true, c.id).card;
    assert.equal(T.state.step, 2, `${topic}: up a step`);
    c = T.answer(c.answer, true, c.id).card;
    assert.equal(T.state.step, 3);
    // a slip: forgiven (no step down, still finding the step)
    T.answer(c.targets.find((x) => !x.good).n, false, c.id);
    assert.equal(T.state.placed, false);
    assert.equal(T.state.step, 3);
    c = T.answer(c.answer, true, c.id).card;   // (right on the second try: no climb)
    assert.equal(T.state.step, 3);
    while (c) c = T.answer(c.answer, true, c.id).card;
    w = T.wave();
    c = w.card;
    const at = T.state.step;
    T.answer(c.targets.find((x) => !x.good).n, false, c.id);
    assert.equal(T.state.placed, true, `${topic}: placed at the second miss`);
    assert.equal(T.state.step, Math.max(1, at - E.PLACE_BELOW));
  }
});

test('once placed: 3 clean cards climb a step; a rough wave drops one step at most; nothing else is taken', () => {
  assert.equal(E.CLEAN_TO_CLIMB, 3); assert.equal(E.MAX_DOWN_PER_WAVE, 1); assert.equal(E.REVIEWS_COUNT_UP, false);
  for (const topic of Object.keys(TOPIC)) {
    const T = make(topic, 4);
    T.setStep(4);
    let w = T.wave({ cards: 3 });
    const own = w.cards.filter((c) => !c.review && !c.back).length;
    playWave(T, w, () => true);
    assert.equal(T.state.step, own >= 3 ? 5 : 4, `${topic}: ${own} clean cards on its own step`);
    T.setStep(5);
    w = T.wave({ cards: 4 });
    playWave(T, w, () => false);
    assert.equal(T.state.step, 4, `${topic}: four misses in one wave drop one step`);
  }
});

test('warm-ups come from below the step and never move it; a card right after help pays but does not climb', () => {
  for (const topic of Object.keys(TOPIC)) {
    let now = NOW;
    const state = {};
    let T = MAKE[topic](state, { rand: seeded(6), now: () => now });
    T.setStep(6);
    playWave(T, T.wave(), () => true);
    now += 2 * HOUR;
    T = MAKE[topic](state, { rand: seeded(7), now: () => now });
    const before = T.state.step;
    const w = T.wave();
    assert.equal(w.warmup, true, `${topic}: a new session opens with a warm-up`);
    assert.ok(w.cards.every((c) => c.rung <= before - E.WARMUP_BELOW), `${topic}: warm-up cards from below (${w.cards.map((c) => c.rung)})`);
    playWave(T, w, () => false);
    assert.equal(T.state.step, before, 'warm-ups never move the step');
    // help before a pick: the right pick after it doesn't count toward the climb
    T.setStep(3);
    const w2 = T.wave({ cards: 3 });
    const c = w2.card;
    const h = T.help(c);
    assert.equal(h.helper, 'count'); assert.equal(h.reveal, false);
    const r = T.answer(c.answer, true, c.id);
    assert.equal(r.helped, true); assert.equal(T.state.streak, 0);
  }
});

test('a missed card comes back 2 to 4 cards later, and numbers never repeat a problem in a wave', () => {
  for (const topic of Object.keys(TOPIC)) {
    const T = make(topic, 8);
    T.setStep(5);
    let backs = 0, gaps = [];
    for (let k = 0; k < 30; k++) {
      const w = T.wave({ cards: 5 });
      const keys = w.cards.map((c) => TOPIC[topic].key(c.parts));
      assert.equal(new Set(keys).size, keys.length, `${topic}: no problem twice in a wave ${keys}`);
      for (let i = 1; i < w.cards.length; i++) assert.notEqual(w.cards[i].answer, w.cards[i - 1].answer, 'never the same answer twice in a row');
      let c = w.card, i = 0, missAt = -1, missKey = null;
      while (c) {
        if (missAt < 0 && i === 0) { missAt = i; missKey = TOPIC[topic].key(c.parts); const r = T.answer(c.targets.find((x) => !x.good).n, false, c.id); if (r.comeback) backs++; }
        else if (missKey && TOPIC[topic].key(c.parts) === missKey && i > missAt) { gaps.push(i - missAt); missKey = null; }
        c = T.answer(c.answer, true, c.id).card; i++;
      }
    }
    assert.ok(backs >= 25, `${topic}: missed cards are lined up to come back (${backs})`);
    assert.ok(gaps.length >= 15 && gaps.every((g) => g >= 2 && g <= 4), `${topic}: back after 2 to 4 cards (${gaps})`);
  }
});

test('the saved state is plain JSON and a reload mid-wave carries on; a stale pick changes nothing', () => {
  for (const topic of Object.keys(TOPIC)) {
    const state = {};
    const T = make(topic, 9, state);
    T.setStep(4);
    const w = T.wave();
    T.answer(w.card.answer, true, w.card.id);
    const copy = JSON.parse(JSON.stringify(state));
    const T2 = make(topic, 9, copy);
    assert.deepEqual(T2.card(), T.card(), `${topic}: the same card after a reload`);
    const stale = T2.answer(w.card.answer, true, w.card.id);
    assert.equal(stale.stale, true);
    assert.equal(T2.state.step, T.state.step);
    // junk in the save is repaired, never thrown on
    const junk = make(topic, 1, { step: 'x', cur: { cards: [{ nope: 1 }] }, soon: [1, null, { p: 7 }], review: 'no' });
    assert.equal(junk.state.step, 1); assert.equal(junk.state.cur, null);
    assert.ok(junk.wave().card);
  }
});

test('a card keeps its line for a right pick (the round-up toast), before and after it is answered and after a reload', () => {
  for (const topic of Object.keys(TOPIC)) {
    const T = make(topic, 11);
    for (let step = 1; step <= TOPIC[topic].LADDER.length; step++) {
      T.setStep(step);
      let c = T.wave().card, guard = 0;
      while (c && guard++ < 8) {
        const want = TOPIC[topic].card(c.parts, { size: 3, rand: seeded(1) }).done;
        assert.equal(typeof c.done, 'string'); assert.equal(c.done, want, `${topic} ${c.rule}`);
        assert.equal(T.explain(c, c.answer).line, want, `${topic} ${c.rule}: explain() of the answer is the card's line`);
        assert.ok(c.done.includes(String(c.answer)), `${topic} ${c.rule}: "${c.done}" names the answer`);
        const id = c.id, r = T.answer(c.answer, true, id);
        if (r.waveDone) break;
        c = r.card;
      }
    }
  }
  // a wave saved when the line was written over with a number gets its line back
  const state = {}, T = make('adding', 12, state);
  T.setStep(3); T.wave();
  const copy = JSON.parse(JSON.stringify(state));
  for (const c of copy.cur.cards) { c.done = 0; delete c.got; }
  const T2 = make('adding', 12, copy), c2 = T2.card();
  assert.equal(c2.done, Ad.card(c2.parts, { size: 3, rand: seeded(1) }).done);
});

test('explain() and help(): the picture for the helper, the answer hidden until a pick', () => {
  for (const topic of Object.keys(TOPIC)) {
    const T = make(topic, 10);
    for (let step = 1; step <= TOPIC[topic].LADDER.length; step++) {
      T.setStep(step);
      const w = T.wave();
      const c = w.card, wrong = c.targets.find((x) => !x.good);
      const h = T.help(c);
      assert.equal(h.helper, 'count'); assert.equal(h.reveal, false); assert.ok(h.reason);
      assert.ok(h.frame || h.line, `${topic} ${c.rule}: a frame or a line`);
      T.answer(wrong.n, false, c.id);
      const ex = T.explain(c, wrong.n);
      assert.equal(ex.numberLine.helper, 'count'); assert.equal(ex.numberLine.reveal, true); assert.equal(ex.numberLine.picked, wrong.n);
      assert.equal(ex.numberLine.reason, ex.line);
      assert.equal(T.help(c).again, true, '"Show me" after a miss brings back the same picture');
      if (h.line) assert.equal(h.line.end, ['part'].includes(c.parts.shape) ? h.line.end : c.answer, `${topic} ${c.rule}: the hop lands on the answer`);
      playWave(T, { card: T.card() }, () => true);
    }
  }
});

test('simulated kids settle near 80% right on their own step, and stronger kids settle higher', (t) => {
  // The negatives tests' kid model: right with chance 1 / (1 + e^(−0.9 (skill − step))). Measured with
  // ~/pw/bandit-math/rigs/early/settle.mjs: 80.5 to 81.9% on every topic (40 kids a set, 3 seed sets).
  const lines = [];
  for (const topic of Object.keys(TOPIC)) {
    const steps = {};
    for (const A of [0.9, 0.5]) {
      const tally = [0, 0], st = [];
      for (const seed of [1, 2, 3, 4]) {
        let now = NOW;
        const state = {};
        let T = MAKE[topic](state, { rand: seeded(seed), now: () => now });
        const rr = seeded(seed * 7919 + 13);
        const skill = 4 + Math.log(A / (1 - A)) / 0.9;
        const P = (rung) => 1 / (1 + Math.exp(-0.9 * (skill - rung)));
        for (let w = 0; w < 160; w++) {
          if (w > 0 && w % 20 === 0) { now += 3 * HOUR; T = MAKE[topic](state, { rand: seeded(seed * 31 + w), now: () => now }); }
          const wv = T.wave();
          let card = wv.card, guard = 0;
          while (card && guard++ < 30) {
            const ok = rr() < P(card.rung);
            if (w >= 50 && !wv.warmup && !card.review && !card.back) { tally[1]++; if (ok) tally[0]++; }
            if (!ok) T.answer(card.targets.find((x) => !x.good).n, false);
            card = T.answer(card.answer, true).card;
          }
          if (w >= 50) st.push(T.state.step);
          now += 60e3;
        }
      }
      const share = tally[0] / tally[1];
      steps[A] = st.reduce((a, b) => a + b, 0) / st.length;
      lines.push(`${topic}, kid at ${A * 100}% on step 4: ${(share * 100).toFixed(1)}% right on its own step, near step ${steps[A].toFixed(2)}`);
      assert.ok(share >= 0.75 && share <= 0.88, lines[lines.length - 1]);
    }
    assert.ok(steps[0.9] > steps[0.5] + 1, `${topic}: stronger kids settle higher ${JSON.stringify(steps)}`);
  }
  t.diagnostic(lines.join('\n'));
});

// ---- the game's hooks -------------------------------------------------------------------------------------------

test('the topics plug into the herd, the sheep and the title', () => {
  for (const id of ['counting', 'adding', 'taking']) {
    assert.ok(HERD_TOPICS.includes(id) && hasTopic(id), id);
    const state = {};
    const T = makeTopic(id, state, { rand: seeded(1) });
    assert.equal(T.topic, id); assert.equal(T.mode, 'cards'); assert.ok(T.payEvery >= 1);
    assert.equal(T.state, state, 'the state object passed in is the one changed');
    for (const k of ['wave', 'answer', 'explain', 'help', 'hint', 'level', 'due', 'card']) assert.equal(typeof T[k], 'function', k);
    const w = T.wave({ count: 5 });
    assert.equal(w.kind, 'card'); assert.ok(w.rule && w.card && w.cards.length >= 1);
    assert.equal(w.targets.filter((x) => x.good).length, 1);
    const lv = T.level();
    assert.match(lv.line, /^Step 1 of 8: .+, still finding the starting step$/);
    assert.ok(TOPICS.find((x) => x.id === id).ready, `${id} is tickable on the title`);
    assert.equal(levelOf({ topics: { [id]: { step: 99 } } }, id), 8);
  }
  // the sheep deal the early topics to a young rider (the skill model: a rider never seen before starts at 0), and not
  // to an older one
  assert.deepEqual(flockTopics({}), ['counting', 'adding', 'taking']);
  const older = {}; for (const [s, v] of [['number', 80], ['add', 70], ['sub', 70], ['mul', 40], ['div', 40], ['eq', 50]]) setLevel(older, s, v);
  for (const id of ['counting', 'adding', 'taking']) assert.ok(!flockTopics(older).includes(id), `${id}: not for a rider well past it`);
});

test('sick sheep: one real slip in a sick sum, a right sum on a healthy one, bottles that never give it away', () => {
  for (const id of ['counting', 'adding', 'taking']) {
    for (let step = 1; step <= 8; step++) {
      const rider = { topicsOn: { [id]: true }, topics: { [id]: { step } } };
      for (let k = 0; k < 12; k++) {
        const f = makeFlock(rider, id, { rand: seeded(step * 100 + k) });
        assert.equal(f.level, step);
        const shown = new Set();
        for (const s of f.sheep) {
          assert.ok(!shown.has(s.shown), `${id}: no sum twice in a flock (${s.shown})`); shown.add(s.shown);
          assert.ok((s.shown.match(/●/g) || []).length <= 6, `${id}: at most six dots fit a sheep's card (${s.shown})`);
          assert.equal(s.help.kind, 'count'); assert.equal(s.help.helper, 'count');
          const vals = s.bottles.map((b) => b.value);
          assert.equal(new Set(vals).size, vals.length, `${id} ${s.shown}: bottles differ ${vals}`);
          assert.ok(s.bottles.length >= 2 && s.bottles.length <= 3);
          if (s.sick) {
            assert.notEqual(s.shown, s.fixed, `${id}: a sick sum is wrong`);
            assert.ok(s.slip && s.slip !== 'other');
            assert.equal(s.bottles.filter((b) => b.right).length, 1);
            assert.equal(s.bottles.find((b) => b.right).value, s.answer);
            assert.ok(s.healed && s.healed.length < 190);
          } else {
            assert.equal(s.shown, s.fixed, `${id}: a healthy sum is right`);
            assert.equal(s.bottles.filter((b) => b.right).length, 0);
            assert.ok(s.fine.startsWith("She's fine"));
          }
          for (const b of s.bottles) {
            assert.match(b.label, /^should be \d+$/);
            if (!b.right) assert.ok(b.why && new RegExp(`(^|[^0-9])${s.answer}([^0-9]|$)`).test(b.why), `${id} ${s.shown} bottle ${b.value}: ${b.why}`);
          }
        }
        assert.ok(f.sheep.some((s) => s.sick) && f.sheep.some((s) => !s.sick));
      }
    }
  }
});

// ---- the helper's drawing (no page needed) ------------------------------------------------------------------------

test('helper: the answer stays hidden until it is shown', () => {
  const c = { parts: { shape: 'sum', a: 8, b: 5 }, answer: 13 };
  const pic = Ad.picture(c);
  const hid = layoutCountHelp({ ...pic, reveal: false }, { width: 600 });
  assert.equal(hid.line.end.text, '?');
  assert.ok(hid.line.labels.every((l) => l.v <= 8), `no numbers past the start: ${hid.line.labels.map((l) => l.v)}`);
  assert.equal(hid.line.arcs.length, 5, 'a hop for each one counted on');
  assert.equal(hid.frames.dots.length, 13);
  assert.equal(hid.frames.dots.filter((d) => d.cls === 'more').length, 5, 'the 5 counted on are gold');
  const shown = layoutCountHelp({ ...pic, reveal: true, picked: 12 }, { width: 600 });
  assert.equal(shown.line.end.text, '13');
  assert.equal(shown.line.picked.v, 12);
  // a missing number: the hops are drawn, but their count (the answer) is hidden
  const part = layoutCountHelp({ ...Ad.picture({ parts: { shape: 'part', a: 3, t: 8 }, answer: 5 }), reveal: false }, { width: 600 });
  assert.equal(part.line.badge.text, 'how many hops?');
  assert.ok(part.line.arcs.every((a) => !a.showLabel));
  assert.equal(part.frames.dots.filter((d) => d.cls === 'empty').length, 5);
  // counting dots: numbered one by one only once shown
  const dots = Cn.picture({ parts: { shape: 'dots', n: 13 }, answer: 13 });
  assert.equal(layoutCountHelp({ ...dots, reveal: false }).frames.counted, false);
  const counted = layoutCountHelp({ ...dots, reveal: true });
  assert.equal(counted.frames.counted, true); assert.equal(counted.frames.list.length, 2);
  // taking away: the ones taken are crossed out
  const take = layoutCountHelp({ ...Tk.picture({ parts: { shape: 'diff', a: 9, b: 4 }, answer: 5 }), reveal: false });
  assert.equal(take.frames.dots.filter((d) => d.cross).length, 4);
  // counting by 5s: the numbers the card gives stay named while the answer is hidden
  const skip = layoutCountHelp({ ...Cn.picture({ parts: { shape: 'skip', by: 5, start: 5 }, answer: 20 }), reveal: false });
  assert.deepEqual(skip.line.labels.filter((l) => l.key).map((l) => l.v).sort((a, b) => a - b), [5, 10, 15]);
  assert.equal(skip.line.end.text, '?');
});

test('helper: every card of every step can be drawn, at phone width too', () => {
  for (const topic of Object.keys(TOPIC)) {
    for (const { c } of cardsOf(topic, 20, 12)) {
      const pic = TOPIC[topic].picture(c);
      for (const width of [320, 620]) for (const reveal of [true, false]) {
        const L = layoutCountHelp({ ...pic, reveal, picked: c.targets.find((x) => !x.good).n }, { width });
        assert.ok(L.H > 20 && L.H < 260, `${topic} ${c.rule}: height ${L.H}`);
        if (L.line) {
          assert.ok(L.line.arcs.every((a) => a.x0 >= 0 && a.x1 <= L.W && a.peak > 0), `${topic} ${c.rule}: hops inside`);
          assert.ok(L.line.end.x >= 0 && L.line.end.x <= L.W);
        }
        if (L.frames) assert.ok(L.frames.list.every((f) => f.x >= 0 && f.x + f.w <= L.W), `${topic} ${c.rule}: frames inside`);
      }
    }
  }
});
