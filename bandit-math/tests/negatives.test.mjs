// Tests for src/math/negatives.js (the "Positive & negative" trainer) and the pure parts of src/ui/numberline.js.
// Run with:  node --test bandit-math/tests/negatives.test.mjs
// Every random choice is seeded. To check a result isn't luck of the seeds, run again on other seed sets:
//   SEED_OFFSET=1000 node --test bandit-math/tests/negatives.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeNegatives, makeCard, slipsFor, classify, explainPick, nudge, problemText, problemWords, numText, words,
  seeded as seededAt, LADDER, SLIP_KINDS, CLEAN_TO_CLIMB, PLACEMENT_MISSES, WARMUP_WAVES, COMEBACK_MIN, COMEBACK_MAX,
  CONTRAST_CHANCE, MAX_DOWN_PER_WAVE, REVIEWS_COUNT_UP, PLACE_BELOW,
} from '../src/math/negatives.js';
import { layoutNumberLine, watchHesitation, describeHop, numText as nlNum, textWidth } from '../src/ui/numberline.js';

const NOW = 1e12;
const HOUR = 3600e3;
const OFFSET = Number(process.env.SEED_OFFSET) || 0;
const seeded = (seed) => seededAt(seed + OFFSET);
const make = (seed = 1, state = {}, now = NOW) => makeNegatives(state, { rand: seeded(seed), now: () => now });
const MINUS = '−';

// Work a printed problem out from its text alone ('−10 + 18', '5 − (−3)'), so the answers are checked
// against the words on the card, not against the code that made them.
function solveText(text) {
  const m = text.match(/^(−?\d+) ([+−]) \(?(−?\d+)\)?$/);
  assert.ok(m, `the card reads like a sum: ${text}`);
  const v = (s) => Number(s.replace(MINUS, '-'));
  return m[2] === '+' ? v(m[1]) + v(m[3]) : v(m[1]) - v(m[3]);
}

// Play cards: answer every card right first time, or wrong once then right, by a rule.
function playWave(N, w, rightFirst) {
  let card = w.card, guard = 0;
  const seen = [];
  while (card && guard++ < 40) {
    seen.push(card);
    const ok = rightFirst(card);
    if (ok) { card = N.answer(card.answer, true).card; continue; }
    const wrong = card.targets.find((t) => !t.good);
    N.answer(wrong.n, false);
    card = N.answer(card.answer, true).card;
  }
  return seen;
}

// Lots of cards from every step, from many seeds.
function manyCards(seeds = 60) {
  const out = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const N = make(seed);
    N.setStep(1 + (seed % LADDER.length));
    for (let k = 0; k < 4; k++) {
      const w = N.wave({ count: 3 + (seed + k) % 4 });
      out.push(...w.cards);
      playWave(N, w, () => true);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

test('her test question: −10 + 18 is 8, and the wrong answers are the real slips', () => {
  // every card with 4 or more answers has the four anchors: the answer, her slip (−28), the wrong side of
  // zero (−8) and dropped signs (28, which is also starting at 10); 5 or 6 answers add one-off slips next
  // to an anchor picked at random
  const c = makeCard(-10, '+', 18, { size: 6, rand: seeded(1) });
  assert.equal(c.text, `${MINUS}10 + 18`);
  assert.equal(c.answer, 8);
  assert.deepEqual(c.parts, { start: -10, change: 18, op: '+', term: 18 });
  const by = Object.fromEntries(c.targets.filter((t) => !t.good).map((t) => [t.trap, t.n]));
  assert.equal(by.way, -28, 'went down 18 instead of up (what she wrote)');
  assert.equal(by.sign, -8, 'right size, wrong side of zero');
  assert.equal(by.drop, 28, 'dropped the negative sign');
  for (const t of c.targets.filter((x) => !x.good && !['way', 'sign', 'drop'].includes(x.trap))) {
    assert.ok([7, 9, -7, -9, -27, -29, 27, 29].includes(t.n), `${t.label} is one off an anchor`);
  }
  assert.equal(c.targets.filter((t) => t.good).length, 1);
  // one off (7 or 9) turns up on about half of the 6-answer cards, never on all of them (the answer would
  // then always have a next-door number)
  let near = 0;
  for (let seed = 1; seed <= 40; seed++) if (makeCard(-10, '+', 18, { size: 6, rand: seeded(seed) }).targets.some((t) => t.trap === 'near')) near++;
  assert.ok(near >= 8 && near <= 30, `one off on ${near} of 40 cards`);
  // with 5 answers: her slip is always there, with at least two of the other real ones
  for (let seed = 1; seed <= 20; seed++) {
    const f = makeCard(-10, '+', 18, { size: 5, rand: seeded(seed) });
    const kinds = f.targets.map((t) => t.trap);
    assert.ok(kinds.includes('way'), f.targets.map((t) => t.label).join(' '));
    assert.ok(['sign', 'drop', 'near'].filter((k) => kinds.includes(k)).length >= 2, f.targets.map((t) => `${t.label} ${t.trap}`).join(', '));
  }
  const ex = explainPick(c, -28);
  assert.equal(ex.slip, 'way');
  assert.equal(ex.line, 'You went down 18. Adding 18 goes UP the line: 10 steps to zero, 8 more.');
  // and the twin, −10 − 18, is −28
  const d = makeCard(-10, '-', 18, { rand: seeded(1) });
  assert.equal(d.answer, -28);
  assert.equal(d.targets.find((t) => t.trap === 'way').n, 8);
});

test('every card: the answer is right, worked out from the printed text', () => {
  for (const c of manyCards()) {
    assert.equal(c.answer, solveText(c.text), c.text);
    assert.equal(c.answer, c.parts.start + c.parts.change, c.text);
    assert.equal(c.parts.change, c.parts.op === '-' ? -c.parts.term : c.parts.term, c.text);
    assert.ok(Math.abs(c.answer) <= 99, `${c.text} stays within 99`);
  }
});

test('every wrong answer really is the slip it is named for, and never the answer', () => {
  let counted = 0;
  for (const c of manyCards()) {
    const { start: s, change: ch } = c.parts, r = c.answer;
    for (const t of c.targets) {
      if (t.good) { assert.equal(t.n, r); continue; }
      assert.notEqual(t.n, r, `${c.text}: a wrong answer equals the answer`);
      const way = s - ch, drop = Math.abs(s) + Math.abs(ch), start = -s + ch;
      const fits = {
        way: t.n === way,                                      // went the other way
        sign: r !== 0 && t.n === -r,                           // wrong side of zero
        drop: t.n === drop,                                    // dropped the signs, added the sizes
        start: t.n === start,                                  // started on the wrong side of zero (−s, same hop)
        near: Math.abs(t.n - r) === 1,                         // one off
        signNear: r !== 0 && Math.abs(t.n + r) === 1,          // wrong side of zero and one off
        wayNear: Math.abs(t.n - way) === 1,                    // went the other way and one off
        dropNear: Math.abs(t.n - drop) === 1,
        startNear: Math.abs(t.n - start) === 1,
        near2: Math.abs(t.n - r) === 2,
      };
      assert.ok(fits[t.trap], `${c.text}: ${t.label} is named ${t.trap} but isn't that slip`);
      // the name is the first kind it fits, so the tally of what fools a kid is consistent
      const firstFit = ['way', 'sign', 'drop', 'start', 'near', 'signNear', 'wayNear', 'dropNear', 'startNear', 'near2'].find((k) => fits[k]);
      assert.equal(t.trap, firstFit, `${c.text}: ${t.label}`);
      assert.equal(classify(c.parts.start, c.parts.op, c.parts.term, t.n), t.trap);
      counted++;
    }
  }
  assert.ok(counted > 500);
});

test('no duplicates on a card, exactly one right answer, and 4 to 6 answers', () => {
  for (const c of manyCards()) {
    const ns = c.targets.map((t) => t.n);
    assert.equal(new Set(ns).size, ns.length, `${c.text}: ${ns}`);
    assert.equal(c.targets.filter((t) => t.good).length, 1, c.text);
    assert.ok(ns.length >= 4 && ns.length <= 6, `${c.text}: ${ns.length} answers`);
  }
  for (const size of [4, 5, 6]) {
    const c = makeCard(-10, '+', 18, { size, rand: seeded(size) });
    assert.equal(c.targets.length, size);
  }
  // three answers always leave a shortcut (the answer alone on its side of zero, or half of the only pair of
  // opposites), so a card asked for with 3 gets 4
  assert.equal(makeCard(1, '-', -7, { size: 3, rand: seeded(1) }).targets.length, 4);
  const N = make(3);
  assert.ok(N.wave({ count: 3 }).cards.every((c) => c.targets.length === 4));
});

test('the went-the-wrong-way slip is on every card (it is her mistake)', () => {
  for (const c of manyCards()) assert.ok(c.targets.some((t) => t.trap === 'way'), c.text);
});

test('no shortcut: the right answer is never the only positive or the only negative one', () => {
  for (const c of manyCards()) {
    if (c.answer === 0) continue;
    const same = c.targets.filter((t) => !t.good && Math.sign(t.n) === Math.sign(c.answer));
    assert.ok(same.length >= 1, `${c.text}: ${c.targets.map((t) => t.label).join(' ')}`);
  }
});

test('no shortcut: "the one whose opposite is also there" does not pick the answer', () => {
  let checked = 0, fooled = 0;
  for (const c of manyCards(120)) {
    const ns = c.targets.map((t) => t.n);
    if (!c.answer || !ns.includes(-c.answer)) continue;
    checked++;
    const wrongPair = c.targets.some((t) => !t.good && t.n !== 0 && t.n !== -c.answer && ns.includes(-t.n));
    if (!wrongPair) fooled++;
  }
  assert.ok(checked > 200);
  // a tiny problem like −1 − 1 can run out of numbers; allow a sliver
  assert.ok(fooled / checked < 0.01, `${fooled} of ${checked} cards let the opposite-pair shortcut work`);
});

test('no shortcut across a wave: on the mixed steps the answers are positive and negative', () => {
  let pos = 0, neg = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const N = make(seed);
    N.setStep(6);
    for (let k = 0; k < 3; k++) {
      const w = N.wave({ count: 5 });
      for (const c of w.cards) (c.answer > 0 ? pos++ : c.answer < 0 ? neg++ : 0);
      playWave(N, w, () => true);
    }
  }
  assert.ok(pos > 40 && neg > 40, `positive ${pos}, negative ${neg}`);
  assert.ok(Math.min(pos, neg) / Math.max(pos, neg) > 0.6);
});

test('display text uses the real minus sign and brackets around a negative being added or taken away', () => {
  assert.equal(problemText(5, '-', -3), `5 ${MINUS} (${MINUS}3)`);
  assert.equal(problemText(4, '+', -9), `4 + (${MINUS}9)`);
  assert.equal(problemText(-10, '+', 18), `${MINUS}10 + 18`);
  assert.equal(problemText(3, '-', 8), `3 ${MINUS} 8`);
  for (const c of manyCards()) {
    for (const s of [c.text, ...c.targets.map((t) => t.label)]) assert.ok(!s.includes('-'), `no hyphen-minus in "${s}"`);
    if (c.parts.term < 0) assert.match(c.text, /[+−] \(−\d+\)$/, c.text);
    else assert.doesNotMatch(c.text, /\(/, c.text);
    if (c.parts.start < 0) assert.ok(c.text.startsWith(MINUS), c.text);
    for (const t of c.targets) assert.equal(t.label, (t.n < 0 ? MINUS : '') + Math.abs(t.n));
  }
  assert.equal(numText(-8), `${MINUS}8`);
  assert.equal(nlNum(-8), `${MINUS}8`);
  // explanations and nudges print numbers with the real minus sign too
  const c = makeCard(-7, '+', 3, { rand: seeded(2) });
  for (const t of c.targets) assert.ok(!explainPick(c, t.n).line.includes('-7'), 'no hyphen in the explanation');
  assert.ok(!nudge(c).includes('-7'));
});

test('words: "negative" for a value, "minus" only for taking away', () => {
  assert.equal(words(-6), 'negative six');
  assert.equal(words(48), 'forty-eight');
  assert.equal(problemWords(-10, '+', 18), 'negative ten plus eighteen');
  assert.equal(problemWords(5, '-', -3), 'five minus negative three');
  assert.equal(problemWords(-4, '-', 5), 'negative four minus five');
  for (const c of manyCards(20)) {
    assert.equal((c.say.match(/minus/g) || []).length, c.parts.op === '-' ? 1 : 0, c.say);
  }
});

test('the slips are worked out right for every shape', () => {
  assert.deepEqual(slipsFor(-7, '+', 3), {
    way: -10, sign: 4, drop: 10, start: 10, near: [-5, -3], signNear: [5, 3], wayNear: [-11, -9], dropNear: [9, 11],
    startNear: [9, 11], near2: [-6, -2],
  });
  assert.equal(slipsFor(-4, '-', 5).start, -1);     // 4 − 5: started on the wrong side of zero
  assert.equal(classify(-7, '+', 3, 10), 'drop');   // dropped the sign and started at 7 give the same 10: drop is named first
  assert.equal(classify(-4, '-', 5, -1), 'start');
  assert.equal(slipsFor(-4, '-', 5).way, 1);        // went up 5
  assert.equal(slipsFor(3, '-', 8).way, 11);        // went up 8
  assert.equal(slipsFor(5, '-', -3).way, 2);        // took away 3 instead of adding it
  assert.equal(slipsFor(4, '+', -9).way, 13);       // went up 9
  assert.equal(classify(5, '-', -3, 8), null);
});

test('explanations: one plain line tied to the slip', () => {
  const lines = (s, op, t) => {
    const c = makeCard(s, op, t, { rand: seeded(3), size: 6 });
    return Object.fromEntries(c.targets.filter((x) => !x.good).map((x) => [x.trap, explainPick(c, x.n).line]));
  };
  const a = lines(-4, '-', 5);
  assert.match(a.way, /^You went up 5\. Taking away 5 goes DOWN the line/);
  const b = lines(5, '-', -3);
  assert.match(b.way, /^You took away 3\. Taking away −3 turns around and goes UP 3/);
  const c = lines(4, '+', -9);
  assert.match(c.way, /^You went up 9\. Adding −9 goes DOWN 9: 4 steps to zero, 5 more\.$/);
  const d = lines(-10, '+', 18);
  assert.match(d.sign, /wrong side of zero/);
  // a negative number's sign is "the negative sign" ("minus" is only for taking away)
  assert.match(d.drop, /^You dropped the negative sign and added 10 and 18 to get 28\./);
  for (const line of [...Object.values(a), ...Object.values(b), ...Object.values(c), ...Object.values(d)]) {
    assert.ok(line.length < 140, `short enough for one line on screen: ${line}`);
    assert.ok(!/\bminus (one|two|three|four|five|six|seven|eight|nine|ten|\d)/.test(line), `no "minus" for a value: ${line}`);
  }
});

test('explain() hands the number line what it needs; help() keeps the answer hidden', () => {
  const N = make(4);
  N.setStep(6);
  const w = N.wave();
  const c = w.card;
  const wrong = c.targets.find((t) => !t.good);
  const ex = N.explain(c, wrong.n);
  assert.equal(ex.slip, wrong.trap);
  assert.equal(ex.numberLine.start, c.parts.start);
  assert.equal(ex.numberLine.change, c.parts.change);
  assert.equal(ex.numberLine.result, c.answer);
  assert.equal(ex.numberLine.picked, wrong.n);
  assert.equal(ex.numberLine.reason, ex.line);
  assert.deepEqual(N.explain(wrong.n), ex, 'explain(n) works on the card showing now');
  const h = N.help(c);
  assert.equal(h.reveal, false);
  assert.equal(h.start, c.parts.start);
  assert.ok(!h.reason.includes(numText(c.answer) + '.') || Math.abs(c.answer) === Math.abs(c.parts.term), `the nudge doesn't say the answer: ${h.reason}`);
  assert.ok(typeof N.hint() === 'string' && N.hint().length > 10);
});

test('the wave: a few cards played one at a time, each with its own answers', () => {
  const N = make(5);
  N.setStep(3);
  const w = N.wave({ count: 5 });
  assert.equal(w.kind, 'sum');
  assert.ok(w.cards.length >= 3);
  assert.equal(w.rule, `${w.card.text} = ?`);
  assert.deepEqual(w.targets, w.card.targets);
  assert.deepEqual(N.card(), w.card);
  const texts = w.cards.map((c) => c.text);
  assert.equal(new Set(texts).size, texts.length, 'no problem twice in a wave');
  // a right answer moves on; the last one ends the wave
  let r;
  for (let i = 0; i < w.cards.length; i++) {
    const c = N.card();
    assert.equal(c.text, w.cards[i].text);
    r = N.answer(c.answer, true);
    assert.equal(r.right, true);
  }
  assert.equal(r.waveDone, true);
  assert.equal(r.card, null);
  assert.equal(N.card(), null);
  // a wrong answer keeps the same card
  const w2 = N.wave();
  const bad = w2.card.targets.find((t) => !t.good);
  const r2 = N.answer(bad.n, false);
  assert.equal(r2.right, false);
  assert.equal(r2.card.text, w2.card.text);
  assert.equal(r2.waveDone, false);
});

test('the ladder adapts: 3 clean cards up, a miss down, at most one step down per wave', () => {
  const N = make(6);
  N.setStep(3);
  N.state.warmups = 0;
  const w = N.wave({ count: 5, cards: 6 });
  // a clean card on the kid's own step; a review card (from an earlier step) or a comeback on the way is
  // answered right too, but doesn't count toward the 3 in a row
  const ownClean = () => {
    for (let g = 0; g < 10; g++) {
      const c = N.card(), streak = N.state.streak, r = N.answer(c.answer, true);
      if (!c.review && !c.back) return r;
      assert.deepEqual([r.moved, N.state.streak], [0, streak], 'a review card or comeback does not count toward the climb');
    }
    assert.fail('no card from the step itself');
  };
  for (let i = 0; i < CLEAN_TO_CLIMB - 1; i++) assert.equal(ownClean().step, 3);
  assert.equal(ownClean().moved, 1, 'the third clean card moves up');
  assert.equal(N.state.step, 4);
  // a miss moves down; a second miss in the same wave doesn't move again
  let c = N.card();
  assert.equal(N.answer(c.targets.find((t) => !t.good).n, false).moved, -1);
  N.answer(c.answer, true);
  c = N.card();
  if (c) {
    const r = N.answer(c.targets.find((t) => !t.good).n, false);
    assert.equal(r.moved, 0, 'one step down per wave at most');
  }
  assert.equal(N.state.step, 3);
  // the next wave can move down again
  const w2 = N.wave();
  N.answer(w2.card.targets.find((t) => !t.good).n, false);
  assert.equal(N.state.step, 2);
  // a second try that is right doesn't count toward the climb
  N.answer(N.card().answer, true);
  assert.equal(N.state.streak, 0);
  assert.ok(w.cards.length >= 6);
});

test('first visit climbs fast, forgives one slip, and settles below the step of the second miss', () => {
  // a kid who gets everything right: a step per card, to the top
  const A = make(7);
  let cards = 0;
  while (!A.state.placed && cards < 30) {
    const w = A.wave();
    cards += playWave(A, w, () => true).length;
  }
  assert.equal(A.state.step, LADDER.length);
  assert.ok(cards <= LADDER.length + 2, `${cards} cards to reach the top`);
  // each climb is tested on the new step: the cards still to come are dealt again
  const B = make(8);
  const w = B.wave();
  B.answer(B.card().answer, true);
  assert.equal(B.card().rung, 2, 'the next card comes from the new step');
  // a kid who is fine up to step 3 and lost above it
  const C = make(9);
  let guard = 0;
  while (!C.state.placed && guard++ < 20) playWave(C, C.wave(), (c) => c.rung <= 3);
  assert.equal(C.state.step, 4 - PLACE_BELOW, `settles PLACE_BELOW below the step of the second miss (at ${C.state.step})`);
  assert.equal(PLACEMENT_MISSES, 2);
  // one slip alone doesn't end the climb
  const D = make(10);
  D.wave();
  D.answer(D.card().answer, true);
  const before = D.state.step;
  D.answer(D.card().targets.find((t) => !t.good).n, false);
  assert.equal(D.state.placed, false);
  assert.equal(D.state.step, before);
  D.answer(D.card().answer, true);
  D.answer(D.card().answer, true);
  assert.ok(D.state.step > before, 'the climb goes on after one slip');
});

test('warm-ups: 2 easy waves at the start of a session, from below, that never move the step', () => {
  let t = NOW;
  const N = makeNegatives({}, { rand: seeded(11), now: () => t });
  N.setStep(6);
  playWave(N, N.wave(), () => true);
  const step = N.state.step;
  t += 2 * HOUR;   // a new session
  for (let k = 0; k < WARMUP_WAVES; k++) {
    const w = N.wave();
    assert.equal(w.warmup, true);
    for (const c of w.cards) assert.ok(c.rung <= step - 2, `warm-up card from step ${c.rung}`);
    for (const c of w.cards) assert.ok(c.targets.length <= 4, 'warm-ups have fewer answers');
    playWave(N, w, () => false);
    assert.equal(N.state.step, step, 'misses in a warm-up move nothing');
  }
  assert.equal(N.wave().warmup, false);
});

test('a missed card comes back 2 to 4 cards later, and again next session', () => {
  let t = NOW;
  const N = makeNegatives({}, { rand: seeded(12), now: () => t });
  N.setStep(5);
  N.state.warmups = 0;
  const w = N.wave({ cards: 6 });
  const missed = w.card;
  const r = N.answer(missed.targets.find((x) => !x.good).n, false);
  assert.ok(r.comeback && r.comeback.after >= COMEBACK_MIN && r.comeback.after <= COMEBACK_MAX);
  N.answer(missed.answer, true);
  // play on until it comes back
  let later = 0, back = null, guard = 0;
  while (guard++ < 20) {
    let c = N.card();
    if (!c) c = N.wave({ cards: 6 }).card;
    later++;
    if (c.text === missed.text) { back = c; break; }
    N.answer(c.answer, true);
  }
  assert.ok(back, 'it came back');
  assert.equal(back.back, true);
  assert.equal(later, r.comeback.after, `back ${later} cards later`);
  N.answer(back.answer, true);
  // next session it rides in again, after the warm-ups
  t += 3 * HOUR;
  for (let k = 0; k < WARMUP_WAVES; k++) playWave(N, N.wave(), () => true);
  const w2 = N.wave();
  assert.ok(w2.cards.some((c) => c.text === missed.text && c.back), 'back again next session');
  // answered clean then, it is done with
  playWave(N, w2, () => true);
  assert.ok(!N.state.review.some((x) => problemText(x.s, x.op, x.t) === missed.text));
});

test('a card that comes back and is missed again waits for next session (no endless loop)', () => {
  const N = make(13);
  N.setStep(4);
  N.state.warmups = 0;
  let backs = 0;
  for (let k = 0; k < 8; k++) {
    const w = N.wave();
    playWave(N, w, (c) => { if (c.back) backs++; return c.rung < 4; });
  }
  assert.ok(backs <= 12, `${backs} returning cards in 8 waves`);
});

test('mixed practice: once placed, about one card in three is from an earlier step', () => {
  const N = make(14);
  N.setStep(5);
  N.state.warmups = 0;
  let review = 0, all = 0;
  for (let k = 0; k < 20; k++) {
    const step = N.state.step;
    const w = N.wave();
    for (const c of w.cards) { all++; if (c.review) { review++; assert.ok(c.rung < step, `review card from step ${c.rung}, kid at ${step}`); } }
    playWave(N, w, (c) => c.rung !== 5 || all % 4 !== 0);   // mostly right, a slip now and then
  }
  assert.ok(review / all > 0.15 && review / all < 0.45, `${review} of ${all}`);
});

test('the top steps pair the equation twins: −a + b next to −a − b', () => {
  let twins = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const N = make(seed);
    N.setStep(6);
    N.state.warmups = 0;
    for (let k = 0; k < 4; k++) {
      const w = N.wave();
      for (let i = 1; i < w.cards.length; i++) {
        const a = w.cards[i - 1].parts, b = w.cards[i].parts;
        if (a.start === b.start && a.term === b.term && a.op !== b.op && a.start < 0) twins++;
      }
      playWave(N, w, () => true);
    }
  }
  assert.ok(twins >= 10, `${twins} twin pairs`);
});

test('the ladder: 7 steps from −3 + 7 up to numbers up to 50, labels with the real minus sign', () => {
  assert.equal(LADDER.length, 7);
  assert.deepEqual(LADDER.map((r) => r.max), [10, 10, 10, 12, 10, 20, 50]);
  for (const r of LADDER) assert.ok(!r.label.includes('-'), r.label);
  // each early step deals its own shape, and now and then its contrast: the same kind of sum with the other
  // sign, so "every answer is positive on this step" never works
  const upPos = (c) => c.parts.start < 0 && c.parts.op === '+' && c.parts.term > 0 && c.answer > 0;
  const upNeg = (c) => c.parts.start < 0 && c.parts.op === '+' && c.parts.term > 0 && c.answer < 0;
  // 8 − 3: step 3's contrast too (a minus with an answer above zero), so "minus means a negative answer"
  // doesn't work there either (with −3 + 7 as its contrast, the sign of the sum always said the answer's sign)
  const short = (c) => c.parts.start > 0 && c.parts.op === '-' && c.parts.term > 0 && c.answer > 0;
  const shapes = {
    1: [upPos, upNeg],
    3: [(c) => c.parts.start < 0 && c.parts.op === '-' && c.parts.term > 0, short],
    4: [(c) => c.parts.start > 0 && c.parts.op === '-' && c.parts.term > 0 && c.answer < 0, short],
  };
  for (const [step, [own, contrast]] of Object.entries(shapes)) {
    let owns = 0, contrasts = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const N = make(Number(step) * 100 + seed);
      N.setStep(Number(step));
      N.state.warmups = 0;
      const w = N.wave({ cards: 8 });
      for (const c of w.cards.filter((x) => !x.review && !x.back)) {
        assert.ok(own(c) || contrast(c), `step ${step}: ${c.text}`);
        if (own(c)) owns++; else contrasts++;
      }
    }
    const share = contrasts / (owns + contrasts);
    assert.ok(share > CONTRAST_CHANCE - 0.12 && share < CONTRAST_CHANCE + 0.12, `step ${step}: ${contrasts} contrast cards of ${owns + contrasts}`);
  }
  assert.deepEqual(SLIP_KINDS, ['way', 'sign', 'drop', 'near']);
  const lv = make(1).level();
  assert.equal(lv.of, 7);
  assert.match(lv.line, /^Step 1 of 7/);
});

test('state is plain JSON: it survives a save and reload mid-wave', () => {
  const state = {};
  const N = makeNegatives(state, { rand: seeded(15), now: () => NOW });
  N.setStep(4);
  const w = N.wave();
  N.answer(w.card.answer, true);
  N.answer(N.card().targets.find((t) => !t.good).n, false);
  const saved = JSON.stringify(state);
  const back = JSON.parse(saved);
  assert.deepEqual(back, JSON.parse(JSON.stringify(state)));
  const M = makeNegatives(back, { rand: seeded(15), now: () => NOW + 1000 });
  assert.equal(M.card().text, N.card().text, 'the same card is showing after the reload');
  assert.equal(M.state.step, N.state.step);
  const r = M.answer(M.card().answer, true);
  assert.equal(r.right, true);
  // a broken or empty save is repaired, not thrown
  for (const junk of [null, undefined, 7, 'x', [], { step: 'high', cur: { cards: 'no' }, soon: [1, 2], review: {} }]) {
    const X = makeNegatives(junk, { rand: seeded(1), now: () => NOW });
    const ww = X.wave();
    assert.ok(ww.card && ww.card.targets.length >= 3);
  }
  // nothing but plain data in the state
  const walk = (v) => {
    if (v === null || ['number', 'string', 'boolean'].includes(typeof v)) return;
    assert.ok(Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype, 'plain object');
    for (const k of Object.keys(v)) walk(v[k]);
  };
  walk(state);
});

test('seeded runs repeat exactly', () => {
  const run = () => {
    const N = make(16);
    const out = [];
    for (let k = 0; k < 4; k++) { const w = N.wave(); out.push(w.cards.map((c) => c.text + c.targets.map((t) => t.n).join(','))); playWave(N, w, (c) => c.rung < 4); }
    return JSON.stringify(out);
  };
  assert.equal(run(), run());
});

// ---- found in review (fixer round 1) ------------------------------------------------------------------------------

// Cards the trainer deals with `count` answers each, from every step, with a slip now and then. Each seed's step
// is held where it starts, so the mix of steps doesn't depend on how fast the ladder climbs (with the climb free,
// a dial like REVIEWS_COUNT_UP moved most of the cards down to steps 1 to 4).
function dealt(count, seeds = 60, waves = 12) {
  const out = [];
  for (let seed = 1; seed <= seeds; seed++) {
    let t = NOW;
    const N = makeNegatives({}, { rand: seeded(seed * 7 + count), now: () => t });
    const step = 1 + (seed % LADDER.length);
    N.setStep(step);
    const rr = seeded(seed * 13 + count);
    for (let k = 0; k < waves; k++) {
      N.setStep(step);
      let card = N.wave({ count }).card, guard = 0;
      while (card && guard++ < 30) {
        out.push(card);
        if (rr() < 0.2) N.answer(card.targets.find((x) => !x.good).n, false);
        card = N.answer(card.answer, true).card;
      }
      t += 60e3;
    }
  }
  return out;
}
// How often a rule picks the right answer: it picks at random among the numbers it fits (all of them if none).
function ruleScore(cards, rule) {
  let acc = 0, chance = 0;
  for (const c of cards) {
    const ns = c.targets.map((t) => t.n);
    const fit = c.targets.filter((t) => rule(t.n, ns));
    const pool = fit.length ? fit : c.targets;
    if (pool.some((t) => t.good)) acc += 1 / pool.length;
    chance += 1 / c.targets.length;
  }
  return { acc: acc / cards.length, chance: chance / cards.length };
}
const hasOpp = (x, ns) => x !== 0 && ns.includes(-x);
const hasNb = (x, ns) => ns.includes(x - 1) || ns.includes(x + 1);
const mid3 = (x, ns) => ns.includes(x - 1) && ns.includes(x + 1);

test('no shortcut: "has its opposite AND a neighbour" and "the middle of three in a row" are no better than a guess', () => {
  for (const count of [4, 5, 6]) {
    const cards = dealt(count);
    for (const [name, rule] of [['opposite and neighbour', (x, ns) => hasOpp(x, ns) && hasNb(x, ns)], ['middle of three', mid3], ['a neighbour one away', hasNb], ['its opposite is there', hasOpp]]) {
      const { acc, chance } = ruleScore(cards, rule);
      assert.ok(acc < chance + 0.1, `${count} answers, "${name}": right ${(acc * 100).toFixed(1)}% (a guess: ${(chance * 100).toFixed(1)}%)`);
    }
    // When one of these rules singles out one number on a card, that number is the answer no more often than
    // any other anchor (about 1 time in 4). It can be the answer on a given card: the one-off slips go next to
    // an anchor picked at random. (An earlier build forbade it card by card, and those choices left patterns
    // that a scorer learning from the cards picked up.)
    for (const [name, rule] of [['opposite and neighbour', (x, ns) => hasOpp(x, ns) && hasNb(x, ns)], ['middle of three', mid3]]) {
      let single = 0, hit = 0;
      for (const c of cards) {
        const ns = c.targets.map((t) => t.n);
        const fit = c.targets.filter((t) => rule(t.n, ns));
        if (fit.length === 1) { single++; if (fit[0].good) hit++; }
      }
      if (single >= 40) assert.ok(hit / single < 0.33, `${count} answers, "${name}" singles out the answer on ${hit} of ${single} cards`);
    }
  }
});

// The rules of thumb a kid could read from the numbers alone: each cue, its opposite, and any two together.
const THUMB_RULES = (() => {
  const cues = {
    pos: (x) => x > 0, neg: (x) => x < 0, opp: hasOpp, nb1: hasNb, mid3,
    nb2: (x, ns) => ns.includes(x - 2) || ns.includes(x + 2),
    maxAbs: (x, ns) => Math.abs(x) === Math.max(...ns.map(Math.abs)), minAbs: (x, ns) => Math.abs(x) === Math.min(...ns.map(Math.abs)),
    maxVal: (x, ns) => x === Math.max(...ns), minVal: (x, ns) => x === Math.min(...ns),
    midVal: (x, ns) => { const s = [...ns].sort((a, b) => a - b); return x === s[(s.length - 1) >> 1] || x === s[s.length >> 1]; },
  };
  const lits = Object.entries(cues).flatMap(([k, f]) => [[k, f], [`!${k}`, (x, ns) => !f(x, ns)]]);
  const rules = [];
  for (let i = 0; i < lits.length; i++) {
    rules.push([lits[i][0], lits[i][1]]);
    for (let j = i + 1; j < lits.length; j++) if (lits[i][0].replace('!', '') !== lits[j][0].replace('!', '')) rules.push([`${lits[i][0]} & ${lits[j][0]}`, (x, ns) => lits[i][1](x, ns) && lits[j][1](x, ns)]);
  }
  return rules;
})();
// The rule of thumb that does best on a set of cards, and how it does.
function bestThumb(set) {
  let worst = { acc: 0 };
  for (const [name, rule] of THUMB_RULES) { const s = ruleScore(set, rule); if (s.acc - s.chance > (worst.acc - (worst.chance || 0))) worst = { name, ...s }; }
  return worst;
}
// The odd/even and next-door rules (see their test).
const par = (x) => Math.abs(x % 2);
const parMaj = (x, ns) => ns.filter((y) => par(y) === par(x)).length * 2 > ns.length;
const within2 = (x, ns) => ns.filter((y) => y !== x && Math.abs(y - x) <= 2).length;
const crowded = (x, ns) => { const k = within2(x, ns); return k > 0 && k === Math.max(...ns.map((v) => within2(v, ns))); };
const ODD_EVEN_RULES = {
  'odd/even like most': parMaj,
  'of the next-door pair, the one odd/even like most': (x, ns) => hasNb(x, ns) && parMaj(x, ns),
  'odd/even like most, with the most numbers within 2': (x, ns) => parMaj(x, ns) && crowded(x, ns),
};

test('no shortcut: no simple rule of thumb (one cue or two together) is much better than a guess', () => {
  // The best of these sits 12.7 to 14.4 points above a guess over all steps, and 6 to 11.5 on steps 5 to 7
  // (10 seed sets, with dealt() holding each seed's step; 8 to 13.5 when the sample was left to climb).
  // What's left is about size: her slip (the wrong way) always lands farther from zero, so on a hop toward
  // zero (all of steps 1, 2 and 4) the answer and its opposite are never the biggest numbers; "has its
  // opposite and isn't the biggest" is then a coin toss between those two. Picking the wrong answers to even
  // out these cues (an earlier build: 6 to 9 points here) left an odd/even pattern that was much worse (see
  // the next test). What kids actually meet leans on steps 1 to 4: see the test after next.
  const cards = dealt(5, 40);
  const mixed = cards.filter((c) => c.rung >= 5);
  for (const [label, set, slack] of [['all steps', cards, 0.15], ['steps 5 to 7', mixed, 0.15]]) {
    const worst = bestThumb(set);
    assert.ok(worst.acc < worst.chance + slack, `${label}: "${worst.name}" is right ${(worst.acc * 100).toFixed(1)}% (a guess: ${(worst.chance * 100).toFixed(1)}%)`);
  }
});

test('no shortcut: odd/even and next-door rules are no better than a guess', () => {
  // The round-2 review found these: every real slip (the wrong way, the wrong side of zero, dropped signs) is
  // odd or even like the answer, and only the one-off slips are not, so "of the next-door pair, the one that
  // is odd or even like most of the card" was right 42 to 57% of the time (a guess: 20 to 25%). The one-off
  // slips now sit next to an anchor picked at random.
  for (const count of [4, 5, 6]) {
    const cards = dealt(count, 40);
    for (const [name, rule] of Object.entries(ODD_EVEN_RULES)) {
      const { acc, chance } = ruleScore(cards, rule);
      assert.ok(acc < chance + 0.1, `${count} answers, "${name}": right ${(acc * 100).toFixed(1)}% (a guess: ${(chance * 100).toFixed(1)}%)`);
    }
  }
});

// The cards simulated kids actually meet once they have found their step: the same kids as the settle test
// (90%, 70% or 50% right on step 4 cards), from wave 60 on, leaving out comebacks (repeats of a missed card).
function kidsMeet(waves = 140) {
  const out = [];
  for (const A of [0.9, 0.7, 0.5]) {
    for (const seed of [1, 2, 3, 4]) {
      let now = NOW;
      const state = {};
      let N = makeNegatives(state, { rand: seeded(seed), now: () => now });
      const rr = seeded(seed * 7919 + 13);
      const skill = 4 + Math.log(A / (1 - A)) / 0.9;
      const P = (rung) => 1 / (1 + Math.exp(-0.9 * (skill - rung)));
      for (let w = 0; w < waves; w++) {
        if (w > 0 && w % 20 === 0) { now += 3 * HOUR; N = makeNegatives(state, { rand: seeded(seed * 31 + w), now: () => now }); }
        let card = N.wave().card, guard = 0;
        while (card && guard++ < 30) {
          if (w >= 60 && !card.back) out.push(card);
          if (rr() >= P(card.rung)) N.answer(card.targets.find((x) => !x.good).n, false);
          card = N.answer(card.answer, true).card;
        }
        now += 60e3;
      }
    }
  }
  return out;
}

test('no shortcut on the cards settled kids actually meet', (t) => {
  // dealt() weighs every step about the same. Settled kids meet steps 1 to 4 far more: about 87% of their cards
  // (about 70% when review cards and comebacks still counted toward the climb, which kept kids a step higher).
  // On a hop toward zero (steps 1, 2 and 4) "has its opposite and isn't the biggest" is a coin toss between the
  // answer and its opposite (see the rule-of-thumb test above), so on what kids meet the best rule of thumb is
  // 13.8 to 15.6 points better than a guess (30 seed sets; 11.4 to 13.2 before). This check allows 17: it keeps
  // that leftover from growing, it doesn't call it fixed. Evening it out would be a change to how steps 1, 2
  // and 4 pick their wrong answers. The odd/even rules stay well inside 10 points here (5.4 to 8.7).
  const cards = kidsMeet();
  const low = cards.filter((c) => c.rung <= 4).length / cards.length;
  const worst = bestThumb(cards);
  const line = `"${worst.name}" is right ${(worst.acc * 100).toFixed(1)}% (a guess: ${(worst.chance * 100).toFixed(1)}%), on ${cards.length} cards, ${(low * 100).toFixed(0)}% of them from steps 1 to 4`;
  assert.ok(worst.acc < worst.chance + 0.17, line);
  for (const [name, rule] of Object.entries(ODD_EVEN_RULES)) {
    const { acc, chance } = ruleScore(cards, rule);
    assert.ok(acc < chance + 0.1, `"${name}": right ${(acc * 100).toFixed(1)}% (a guess: ${(chance * 100).toFixed(1)}%)`);
  }
  t.diagnostic(line);
});

test('step 2 is mostly −7 + 3, with a zero pair now and then (not every other card)', () => {
  let upNeg = 0, zero = 0, runs = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const N = make(seed);
    N.setStep(2);
    N.state.warmups = 0;
    let last = null;
    for (let k = 0; k < 6; k++) {
      const w = N.wave();
      for (const c of w.cards.filter((x) => x.rung === 2 && !x.back && (x.shape === 'upNeg' || x.shape === 'zero'))) {
        if (c.shape === 'zero') zero++; else upNeg++;
        if (last === 'upNeg' && c.shape === 'upNeg') runs++;
        last = c.shape;
      }
      playWave(N, w, () => true);
      N.setStep(2);
    }
  }
  const share = zero / (zero + upNeg);
  assert.ok(share > 0.1 && share < 0.24, `zero pairs are ${(share * 100).toFixed(1)}% of step 2's own cards`);
  assert.ok(runs > 50, `${runs} times two "−7 + 3" cards in a row`);
});

test('first visit: missing the comeback of the forgiven slip settles below where the kid is, not below the slip', () => {
  let found = 0;
  for (let seed = 1; seed <= 200 && found < 5; seed++) {
    const N = make(seed);
    const S = N.state;
    let missed = null, card = N.wave().card, guard = 0;
    while (!S.placed && guard++ < 40) {
      if (!card) { card = N.wave().card; continue; }
      if (!missed && card.rung === 3) {
        N.answer(card.targets.find((t) => !t.good).n, false);   // the one forgiven slip
        assert.equal(S.placed, false);
        missed = card.text;
        card = N.answer(card.answer, true).card;
      } else if (missed && card.back && card.text === missed) {
        const at = S.step;
        const r = N.answer(card.targets.find((t) => !t.good).n, false);   // its comeback, missed again
        assert.equal(S.placed, true);
        assert.equal(S.step, Math.max(1, at - PLACE_BELOW), `seed ${seed}: at step ${at}, settled at ${S.step}`);
        assert.ok(r.moved >= -1);
        if (at >= 5) found++;
        break;
      } else card = N.answer(card.answer, true).card;
    }
  }
  assert.ok(found >= 1, 'the case where the kid had climbed well past the slip came up');
});

test('never the same answer on two cards in a row: comebacks and the first card of a wave included', () => {
  for (let seed = 1; seed <= 60; seed++) {
    let t = NOW;
    const state = {};
    let N = makeNegatives(state, { rand: seeded(seed), now: () => t });
    N.setStep(1 + (seed % 7));
    const rr = seeded(seed + 500);
    let prev = null;
    for (let k = 0; k < 25; k++) {
      let card = N.wave().card, guard = 0;
      while (card && guard++ < 30) {
        if (prev) assert.notEqual(card.answer, prev.answer, `seed ${seed}: ${prev.text} then ${card.text}`);
        prev = card;
        if (rr() < 0.3) N.answer(card.targets.find((x) => !x.good).n, false);
        if (rr() < 0.1) N = makeNegatives(state, { rand: seeded(seed * 31 + k), now: () => t });   // a reload
        card = N.answer(card.answer, true).card;
      }
      t += 60e3;
      if (k === 12) t += 2 * HOUR;
    }
  }
});

test('a card missed in a warm-up comes back 2 to 4 cards later, not after last session\'s list', () => {
  let checked = 0;
  for (let seed = 1; seed <= 30; seed++) {
    let t = NOW;
    const N = makeNegatives({}, { rand: seeded(seed), now: () => t });
    N.setStep(6);
    for (let k = 0; k < 4; k++) playWave(N, N.wave(), (c) => c.rung < 6);   // leaves a review list behind
    t += 2 * HOUR;
    const w = N.wave();
    assert.equal(w.warmup, true);
    const missed = w.card;
    const r = N.answer(missed.targets.find((x) => !x.good).n, false);
    N.answer(missed.answer, true);
    let later = 0, card = N.card(), guard = 0;
    while (guard++ < 20) {
      if (!card) { card = N.wave().card; continue; }
      later++;
      if (card.back && card.text === missed.text) break;
      card = N.answer(card.answer, true).card;
    }
    assert.ok(later >= COMEBACK_MIN && later <= COMEBACK_MAX + 1, `seed ${seed}: back ${later} cards later (meant ${r.comeback.after})`);
    checked++;
  }
  assert.equal(checked, 30);
});

test('a pick that lands after its card is gone changes nothing and is not called a miss', () => {
  const N = make(21);
  const w = N.wave();
  let c = w.card, last = null;
  while (c) { last = c; c = N.answer(c.answer, true).card; }
  const clock = N.state.clock;
  const late = N.answer(last.answer, true);
  assert.equal(late.right, true);
  assert.equal(late.stale, true);
  assert.equal(N.state.clock, clock, 'nothing was recorded');
  // a target from the card before, when the game passes the card's id
  const w2 = N.wave();
  const first = w2.card;
  N.answer(first.answer, true, first.id);
  const now = N.card();
  const r = N.answer(first.targets.find((x) => !x.good).n, false, first.id);
  assert.equal(r.stale, true);
  assert.equal(N.card().text, now.text);
  assert.equal(N.state.cur.cards[N.state.cur.at].misses, 0, 'the card showing now was not marked wrong');
});

test('card ids never repeat within a wave, even after reloads mid-wave', () => {
  const state = {};
  let N = makeNegatives(state, { rand: seeded(5), now: () => NOW });
  N.setStep(4);
  N.state.warmups = 0;
  const w = N.wave({ cards: 4 });
  for (let k = 0; k < 3; k++) {
    N = makeNegatives(state, { rand: seeded(6 + k), now: () => NOW });   // reload
    const c = N.card();
    if (!c) break;
    N.answer(c.targets.find((t) => !t.good).n, false);
    N.answer(c.answer, true);
  }
  const ids = state.cur.cards.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, ids.join(' '));
  for (const id of ids) assert.ok(id.startsWith(`${w.id}.`), `${id} belongs to wave ${w.id}`);
});

test('"Show me" after a wrong pick brings back the picture with the answer, not the hidden one', () => {
  const N = make(22);
  N.setStep(6);
  const w = N.wave();
  assert.equal(N.help(w.card).reveal, false, 'before any pick the answer stays hidden');
  const bad = w.card.targets.find((t) => !t.good);
  N.answer(bad.n, false);
  const h = N.help(N.card());
  assert.equal(h.reveal, true);
  assert.equal(h.picked, bad.n);
  assert.equal(h.result, w.card.answer);
  assert.equal(h.reason, N.explain(w.card, bad.n).line);
  // the next card starts hidden again
  const next = N.answer(w.card.answer, true).card;
  if (next) assert.equal(N.help(next).reveal, false);
});

test('a right pick after the number line came up to help pays, but does not count toward climbing', () => {
  const N = make(23);
  N.setStep(3);
  N.state.warmups = 0;
  N.wave({ cards: 6 });
  N.answer(N.card().answer, true);
  N.answer(N.card().answer, true);
  assert.equal(N.state.streak, CLEAN_TO_CLIMB - 1);
  // the kid waited, the line came up with the answer hidden, then a right pick: no step up, the run just waits
  const c = N.card();
  assert.equal(N.help(c).reveal, false);
  const r = N.answer(c.answer, true);
  assert.deepEqual([r.right, r.helped, r.moved], [true, true, 0]);
  assert.equal(N.state.streak, CLEAN_TO_CLIMB - 1);
  assert.equal(N.report().steps.find((x) => x.step === c.rung).helped, 1);
  // the next clean card climbs
  assert.equal(N.answer(N.card().answer, true).moved, 1);
  // "Show me" after a miss shows the answer again; it doesn't make the card count as helped (a miss already counted)
  const M = make(25);
  M.setStep(4);
  const m = M.wave().card;
  M.answer(m.targets.find((t) => !t.good).n, false);
  assert.equal(M.help(M.card()).reveal, true);
  assert.equal(M.answer(m.answer, true).helped, false);
  // first visit: a helped card doesn't climb either
  const F = make(24);
  F.wave();
  const f = F.card();
  F.help(f);
  F.answer(f.answer, true);
  assert.deepEqual([F.state.step, F.state.placed], [1, false]);
});

test('wrong-pick words: "right size" for the wrong side of zero, and no "count the marks" on a long hop', () => {
  const c = makeCard(-10, '+', 18, { size: 6, rand: seeded(1) });
  assert.match(explainPick(c, -8).line, /^Right size, wrong side of zero\. From −10, 10 steps up reaches zero, then 8 more lands on 8\.$/);
  assert.match(explainPick(makeCard(-6, '-', 5, { rand: seeded(1) }), -12).line, /Count the spaces between the marks/);
  assert.doesNotMatch(explainPick(makeCard(-35, '+', 48, { rand: seeded(1) }), 12).line, /marks/);
  assert.match(explainPick(c, -9).line, /^Wrong side of zero, and one off\./);
  assert.equal(classify(-10, '+', 18, -9), 'signNear');
});

test('the mixed steps keep the answers close to half positive, half negative', () => {
  let pos = 0, neg = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const N = make(seed);
    N.setStep(6 + (seed % 2));
    N.state.warmups = 0;
    for (let k = 0; k < 8; k++) {
      const w = N.wave();
      for (const c of w.cards.filter((x) => !x.review && !x.back)) (c.answer > 0 ? pos++ : c.answer < 0 ? neg++ : 0);
      playWave(N, w, () => true);
      N.setStep(6 + (seed % 2));
    }
  }
  const share = pos / (pos + neg);
  assert.ok(share > 0.4 && share < 0.6, `positive ${pos}, negative ${neg}`);
});

test('simulated kids settle at about the same share right on their own step, on different steps', (t) => {
  // A kid whose chance on a card falls off with the card's step (90%, 70% or 50% on step 4). With 3 clean cards
  // on the kid's own step to climb (review cards and comebacks don't count) and at most one step down a wave,
  // they settle near 81% right on their own step's cards (79.8 to 82.7% over 30 seed sets of 4 kids). With the
  // review cards and comebacks counting toward the 3 in a row (the rule before) they sat near 65%, about a step
  // higher. Re-measure with ~/pw/bandit-math/rigs/mathlane/neg_settle.mjs.
  assert.equal(MAX_DOWN_PER_WAVE, 1);
  assert.equal(REVIEWS_COUNT_UP, false, 'a decided setting: review cards and comebacks do not count toward the climb');
  const band = [0.76, 0.87];
  const lines = [], steps = {};
  for (const A of [0.9, 0.7, 0.5]) {
    const tally = [0, 0], st = [];
    for (const seed of [1, 2, 3, 4]) {
      let now = NOW;
      const state = {};
      let N = makeNegatives(state, { rand: seeded(seed), now: () => now });
      const rr = seeded(seed * 7919 + 13);
      const skill = 4 + Math.log(A / (1 - A)) / 0.9;
      const P = (rung) => 1 / (1 + Math.exp(-0.9 * (skill - rung)));
      for (let w = 0; w < 240; w++) {
        if (w > 0 && w % 20 === 0) { now += 3 * HOUR; N = makeNegatives(state, { rand: seeded(seed * 31 + w), now: () => now }); }
        const wv = N.wave();
        let card = wv.card, guard = 0;
        while (card && guard++ < 30) {
          const ok = rr() < P(card.rung);
          if (w >= 60 && !wv.warmup && !card.review && !card.back) { tally[1]++; if (ok) tally[0]++; }
          if (!ok) N.answer(card.targets.find((x) => !x.good).n, false);
          card = N.answer(card.answer, true).card;
        }
        if (w >= 60) st.push(N.state.step);
        now += 60e3;
      }
    }
    const share = tally[0] / tally[1];
    steps[A] = st.reduce((a, b) => a + b, 0) / st.length;
    lines.push(`kid at ${A * 100}% on step 4: ${(share * 100).toFixed(1)}% right on its own step's cards, settles near step ${steps[A].toFixed(2)}`);
    assert.ok(share >= band[0] && share <= band[1], lines[lines.length - 1]);
  }
  assert.ok(steps[0.9] > steps[0.7] + 0.5 && steps[0.7] > steps[0.5] + 0.5, `stronger kids settle higher ${JSON.stringify(steps)}`);
  t.diagnostic(lines.join('\n'));
});

// ---- the number line (the parts that don't need a page) --------------------------------------------------------

test('number line: a hop that crosses zero is drawn in two parts, "+10 to zero" and "+8 more"', () => {
  const L = layoutNumberLine({ start: -10, change: 18, width: 760 });
  assert.equal(L.parts.length, 2);
  assert.deepEqual(L.parts.map((p) => p.label), ['+10 to zero', '+8 more']);
  assert.deepEqual(L.parts.map((p) => [p.from, p.to]), [[-10, 0], [0, 8]]);
  assert.ok(L.lo <= -10 && L.hi >= 8);
  assert.ok(L.ticks.some((t) => t.zero), 'zero is marked');
  assert.ok(L.keyLabels.some((k) => k.kind === 'zero' && k.text === '0'));
  assert.equal(L.keyLabels.find((k) => k.kind === 'end').text, '8');
  // going down across zero
  const D = layoutNumberLine({ start: 3, change: -8 });
  assert.deepEqual(D.parts.map((p) => p.label), [`${MINUS}3 to zero`, `${MINUS}5 more`]);
  // not crossing: one part
  assert.deepEqual(layoutNumberLine({ start: -7, change: 3 }).parts.map((p) => p.label), ['+3']);
  assert.deepEqual(layoutNumberLine({ start: -4, change: -5 }).parts.map((p) => p.label), [`${MINUS}5`]);
  assert.deepEqual(layoutNumberLine({ start: -6, change: 6 }).parts.map((p) => p.label), ['+6 to zero']);
});

test('number line: ticks fit the range, labels never overlap, the key numbers are always shown', () => {
  for (const [s, ch, w] of [[-10, 18, 760], [-35, 48, 760], [-35, 48, 420], [-7, 3, 760], [-48, -43, 900], [2, -3, 360], [-90, 99, 760]]) {
    const L = layoutNumberLine({ start: s, change: ch, width: w });
    // the finished picture: plain numbers that give way to the landing number ("late") are faded out by then
    for (const t of L.ticks.filter((x) => x.late)) assert.ok(Math.abs(t.x - L.keyLabels.find((k) => k.kind === 'end').x) < 60, `${s} + ${ch}: only numbers by the landing wait`);
    const labs = [...L.ticks.filter((t) => t.label && !t.late).map((t) => ({ x: t.x, w: textWidth(t.label, 19, 'tick') })), ...L.keyLabels];
    labs.sort((a, b) => a.x - b.x);
    for (let i = 1; i < labs.length; i++) assert.ok(labs[i].x - labs[i - 1].x >= (labs[i].w + labs[i - 1].w) / 2 - 1, `${s} + ${ch}: labels overlap`);
    assert.ok(L.ticks.length >= 6 && L.ticks.length <= 120, `${s} + ${ch}: ${L.ticks.length} ticks`);
    for (const v of [s, s + ch, 0]) assert.ok(L.keyLabels.some((k) => k.v === v), `${s} + ${ch}: ${v} is labelled`);
    for (const k of L.keyLabels) assert.ok(k.x - k.w / 2 >= 0 && k.x + k.w / 2 <= L.W, 'inside the picture');
  }
});

test('number line: the hidden-answer version, the turn-around, the pick, the tiny version', () => {
  const G = layoutNumberLine({ start: -10, change: 18, reveal: false });
  assert.equal(G.keyLabels.find((k) => k.kind === 'end').text, '?');
  assert.equal(G.parts[1].label, '+? more');
  assert.ok(!G.parts.some((p) => p.label.includes('8')));
  const T = layoutNumberLine({ start: 5, change: 3, op: '-', term: -3 });
  assert.equal(T.turn.text, `Taking away ${MINUS}3 is the same as adding 3`);
  const A = layoutNumberLine({ start: 4, change: -9, op: '+', term: -9 });
  assert.equal(A.turn.text, `Adding ${MINUS}9 is the same as taking away 9`);
  assert.equal(layoutNumberLine({ start: -10, change: 18, op: '+', term: 18 }).turn, null);
  const P = layoutNumberLine({ start: -10, change: -18, picked: 8 });
  assert.ok(P.hi >= 8, 'the pick is on the line');
  assert.ok(P.keyLabels.some((k) => k.kind === 'pick' && k.text === '8'));
  const I = layoutNumberLine({ start: -10, change: 18, size: 'inline', width: 240 });
  assert.ok(I.H < 70, `tiny: ${I.H}px high`);
  assert.deepEqual(I.parts.map((p) => p.label), ['+10', '+8']);
  assert.equal(describeHop({ start: -10, change: 18 }), `Start at ${MINUS}10. Up 10 to zero, then 8 more. Lands on 8.`);
});

test('hesitation timer: fires once after the wait, and not at all once answered or cancelled', async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let shown = 0;
  const a = watchHesitation({ after: 40, onShow: () => shown++ });
  assert.equal(a.waiting, true);
  await sleep(90);
  assert.equal(shown, 1);
  assert.equal(a.shown, true);
  await sleep(60);
  assert.equal(shown, 1, 'only once');
  let b = 0;
  const h = watchHesitation({ after: 40, onShow: () => b++ });
  await sleep(10);
  h.answered();
  await sleep(70);
  assert.equal(b, 0, 'answered in time: no help');
  let c = 0;
  const k = watchHesitation({ after: 40, onShow: () => c++ });
  k.cancel();
  await sleep(70);
  assert.equal(c, 0, 'cancelled: no help');
  k.restart();
  await sleep(70);
  assert.equal(c, 1, 'restart waits again for the next card');
  // the default wait is 8 seconds
  let d = 0;
  const e = watchHesitation({ onShow: () => d++ });
  await sleep(50);
  assert.equal(d, 0);
  e.cancel();
});
