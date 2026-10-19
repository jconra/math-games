// Tests for src/math/dividing.js (the Dividing topic's cards in the round-up) and src/ui/groups.js (its picture).
// Run with:  node --test bandit-math/tests/dividing.test.mjs   (SEED_OFFSET=1000 for another seed set)
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDividing, makeCard, explainPick, pictureFor, classify, remCode, LADDER, SLIP_KINDS, seeded as seededAt,
  CLEAN_TO_CLIMB, MAX_DOWN_PER_WAVE, PLACEMENT_MISSES, PLACE_BELOW, REVIEWS_COUNT_UP, GROUPS_MOST } from '../src/math/dividing.js';
import { groupsSvg } from '../src/ui/groups.js';
import { makeTopic, hasTopic, HERD_TOPICS } from '../src/math/topic.js';

const OFFSET = Number(process.env.SEED_OFFSET) || 0;
const seeded = (seed) => seededAt(seed + OFFSET);
const DIV = '÷';

// every card the ladder deals, at every step, for a few hundred waves
function* everyCard(per = 120, seed = 1) {
  for (let step = 1; step <= LADDER.length; step++) {
    const D = makeDividing({}, { rand: seeded(seed + step) });
    D.setStep(step);
    for (let i = 0; i < per; i++) { const w = D.wave({ count: 4 + (i % 3) }); for (const c of w.cards) yield { step, c }; }
  }
}
const valueOf = (c) => (c.kind === 'rem' ? remCode(c.q, c.r) : c.kind === 'missing' ? (c.ask === 'n' ? c.n : c.d) : c.q);

test('the dials match the round-up topics\' rules (3 clean up, one step down a wave, one slip forgiven, reviews don\'t climb)', () => {
  assert.deepEqual([CLEAN_TO_CLIMB, MAX_DOWN_PER_WAVE, PLACEMENT_MISSES, PLACE_BELOW, REVIEWS_COUNT_UP], [3, 1, 2, 2, false]);
});

test('it plugs into the topic shape: makeTopic(\'dividing\') deals cards the round-up can rope', () => {
  assert.ok(hasTopic('dividing') && HERD_TOPICS.includes('dividing'));
  const T = makeTopic('dividing', {}, { rand: seeded(3) });
  assert.equal(T.topic, 'dividing'); assert.equal(T.name, 'Dividing'); assert.equal(T.shape, 'cards');
  const w = T.wave({ count: 5 });
  assert.ok(w.card && w.cards.length >= 1 && w.rule);
  for (const k of ['answer', 'explain', 'help', 'hint', 'level', 'due', 'card']) assert.equal(typeof T[k], 'function', k);
  assert.match(T.level().line, /^Step \d+ of \d+: /);
});

test('every card: one right answer, the sum is right, the wrong ones are named slips, no repeats, all positive', () => {
  let n = 0;
  for (const { step, c } of everyCard()) {
    n++;
    assert.equal(c.kind, LADDER[c.rung - 1].kind, `step ${step}: the card is its step's kind`);
    assert.equal(c.targets.filter((t) => t.good).length, 1);
    const good = c.targets.find((t) => t.good);
    assert.equal(good.n, c.answer); assert.equal(good.label, c.label);
    assert.equal(c.answer, valueOf(c));
    assert.equal(c.n, c.d * c.q + c.r);
    assert.ok(c.r >= 0 && c.r < c.d, 'the leftover is smaller than the rows');
    if (c.kind === 'rem') assert.ok(c.r >= 1, 'a remainder card has something left over'); else assert.equal(c.r, 0);
    const ns = c.targets.map((t) => t.n);
    assert.equal(new Set(ns).size, ns.length, `${c.rule}: no repeats`);
    assert.equal(new Set(c.targets.map((t) => t.label)).size, ns.length, `${c.rule}: no two cards read the same`);
    assert.ok(c.targets.length >= 4 && c.targets.length <= 6);
    for (const t of c.targets) {
      assert.ok(Number.isInteger(t.n) && t.n > 0, `${c.rule}: ${t.label}`);
      if (!t.good) assert.ok(SLIP_KINDS.includes(t.trap), `${c.rule}: ${t.label} is a ${t.trap}`);
      if (!t.good) { const e = explainPick(c, t.n); assert.ok(e.line.length > 15 && e.line.length < 170, `${c.rule}: ${t.label}: "${e.line}"`); }
    }
  }
  assert.ok(n > 2000);
});

test('the ladder: words first, then each table\'s division facts in the times tables\' order, both ways round, then remainders', () => {
  const at = (step) => { const D = makeDividing({}, { rand: seeded(40 + step) }); D.setStep(step); return D.wave({ count: 5, cards: 6 }).cards.filter((c) => !c.review); };
  for (const c of at(1)) { assert.equal(c.kind, 'share'); assert.ok(!c.rule.includes(DIV), `words: ${c.rule}`); assert.ok(c.n <= 20, 'no more than 20 to share'); }
  for (const c of at(3)) { assert.equal(c.kind, 'fact'); assert.match(c.rule, /^\d+ ÷ \d+ = \?$/); assert.ok([2, 10, 5].includes(c.d)); }
  for (const c of at(7)) { assert.equal(c.kind, 'missing'); assert.match(c.rule, /\?/); }
  for (const c of at(8)) { assert.equal(c.kind, 'rem'); assert.match(c.rule, /= \? r \?$/); assert.match(c.label, /^\d+ r \d+$/); assert.ok(c.d <= 5); }
  // the right pick's toast reads as a fact of the family: "6 × 4 = 24", "24 ÷ 4 = 6"
  const m = makeCard({ kind: 'missing', n: 24, d: 6, ask: 'n', rand: seeded(1) }); assert.equal(`${m.text} = ${m.label}`, '6 × 4 = 24'); assert.equal(m.rule, '? ÷ 6 = 4');
  const k = makeCard({ kind: 'missing', n: 24, d: 6, ask: 'd', rand: seeded(1) }); assert.equal(`${k.text} = ${k.label}`, '24 ÷ 4 = 6'); assert.equal(k.rule, '24 ÷ ? = 4');
  const r = makeCard({ kind: 'rem', n: 13, d: 4, rand: seeded(1) }); assert.equal(r.label, '3 r 1');
});

test('the real slips are there: a row off, the dropped leftover, the one already on the card, taking away', () => {
  const kinds = {};
  for (const { c } of everyCard(60, 9)) for (const t of c.targets) if (!t.good) (kinds[c.kind] ||= {})[t.trap] = ((kinds[c.kind] || {})[t.trap] || 0) + 1;
  assert.ok(kinds.fact.near > kinds.fact.mult, 'a row off is the commonest fact slip');
  assert.ok(kinds.fact.divisor && kinds.fact.sub);
  assert.ok(kinds.rem.noRem > kinds.rem.swap && kinds.rem.short, 'dropping the leftover leads on remainder cards');
  const c = makeCard({ kind: 'fact', n: 24, d: 6, rand: seeded(2), size: 6 });
  assert.equal(classify(c, 18), 'sub'); assert.match(explainPick(c, 18).line, /24 − 6 = 18/);
  assert.equal(explainPick(c, 5).line, '5 in each of 6 rows is 30: 6 too many. 24 makes 4 in each row.');
  const r = makeCard({ kind: 'rem', n: 13, d: 4, rand: seeded(2), size: 6 });
  assert.equal(classify(r, remCode(3, 0)), 'noRem'); assert.match(explainPick(r, remCode(3, 0)).line, /left over/);
  assert.equal(classify(r, remCode(2, 5)), 'short');
});

test('no place in the order gives the answer away: on the round-up\'s 4 and 5 answer cards the best fixed place is right at most 16 points over a guess (3 seed sets)', () => {
  const spread = [];
  for (const seed of [11, 22, 33]) {
    const tally = {};
    for (let step = 1; step <= LADDER.length; step++) {
      const r = seeded(seed + step), D = makeDividing({}, { rand: r }); D.setStep(step);
      for (let i = 0; i < 60; i++) for (const c0 of D.wave({ count: 5 }).cards) for (const size of [4, 5]) {
        const c = makeCard({ kind: c0.kind, n: c0.n, d: c0.d, ask: c0.ask, size, rand: r });
        const rank = c.targets.map((t) => t.n).sort((a, b) => a - b).indexOf(c.answer);
        const t = (tally[size] ||= { n: 0, ranks: {} }); t.n++; t.ranks[rank] = (t.ranks[rank] || 0) + 1;
      }
    }
    for (const [k, t] of Object.entries(tally)) {
      const best = Math.max(...Object.values(t.ranks)) / t.n, guess = 1 / Number(k);
      spread.push(+(100 * (best - guess)).toFixed(1));
      assert.ok(best - guess <= 0.16, `${k} answers: the best place is right ${(100 * best).toFixed(0)}% against a guess's ${(100 * guess).toFixed(0)}%`);
    }
  }
  assert.equal(spread.length, 6, `points over a guess: ${spread.join(', ')}`);
});

test('the help hides the answer; after a miss the rows are dealt out in full with the leftover set aside', () => {
  for (const { c } of everyCard(40, 5)) {
    const help = pictureFor(c, { reveal: false });
    if (help.kind === 'groups') {
      assert.ok(help.total <= (c.kind === 'rem' ? 100 : GROUPS_MOST));
      const { svg } = groupsSvg(help);
      assert.ok(svg.startsWith('<svg'));
      assert.ok(!svg.includes(`>${c.label}<`), `${c.rule}: the help never writes ${c.label}`);
      // no row holds the answer yet (the first round is dealt), unless the rows are the story itself (? ÷ 6 = 4)
      if (!c.ask) { assert.equal(help.dealt, 1); if (c.q > 1) assert.ok(help.dealt < c.q); }
      if (c.ask === 'd') assert.ok(!svg.includes(`row ${c.d}<`) || c.d === 1, `${c.rule}: the rows aren't all drawn`);
    } else {
      assert.equal(help.kind, 'chart');
      assert.equal(help.missed, undefined, 'nothing pinned on the chart before a pick');
      assert.ok(help.line && !help.line.includes(`= ${c.label}`));
    }
    const wrong = c.targets.find((t) => !t.good);
    const after = pictureFor(c, { reveal: true, picked: wrong.n, reason: 'why' });
    if (after.kind === 'groups' && !c.ask) {
      const { svg } = groupsSvg(after);
      assert.equal((svg.match(/<circle [^>]*fill="#e2ad4c"/g) || []).length, c.q * c.d, `${c.rule}: every row dealt`);
      assert.equal((svg.match(/fill="none" stroke="#f08a6c"/g) || []).length, c.r, `${c.rule}: the leftover set aside`);
    }
  }
});

test('climbing: 3 clean cards up, a miss down (once a wave), comebacks and reviews don\'t climb, help makes it not clean', () => {
  const D = makeDividing({}, { rand: seeded(7) });
  D.setStep(3);
  const right = () => { const c = D.card(); return D.answer(c.answer, true, c.id); };
  const wrong = () => { const c = D.card(); const t = c.targets.find((x) => !x.good); return D.answer(t.n, false, c.id); };
  // three clean cards of the kid's own step (a review card from an earlier step, right or not, doesn't count)
  let own = 0, res = null;
  for (let w = 0; w < 6 && own < 3; w++) { D.wave({ count: 5, cards: 3 }); while (D.card() && own < 3) { const c = D.card(); res = right(); if (!c.review && !c.back) own++; } }
  assert.equal(own, 3); assert.equal(res.step, 4);
  D.wave({ count: 5, cards: 4 });
  while (D.card() && D.card().review) right();
  const w1 = wrong(); assert.equal(w1.step, 3, 'a miss: down a step');
  assert.ok(w1.comeback, 'it comes back');
  assert.equal(w1.card.id, D.card().id, 'the same card stays up to try again');
  right(); wrong();
  assert.equal(D.level().step, 3, 'only one step down a wave');
  // help before the first pick: right, but not a clean card
  D.setStep(5); D.wave({ count: 5, cards: 6 });
  for (let i = 0; i < 4; i++) { D.help(D.card()); right(); }
  assert.equal(D.level().step, 5, 'helped cards never climb');
  const c = D.card(); const h = D.explain(c, c.targets.find((t) => !t.good).n);
  assert.ok(h.line && h.picture && h.picture.reveal !== false);
});

test('first visit: climbs a step per clean card, forgives one slip, and settles two below at the second', () => {
  const D = makeDividing({}, { rand: seeded(8) });
  D.wave({ count: 5, cards: 8 });
  const right = () => { const c = D.card(); return D.answer(c.answer, true, c.id); };
  const wrong = () => { const c = D.card(); return D.answer(c.targets.find((x) => !x.good).n, false, c.id); };
  right(); right(); right();
  assert.equal(D.level().step, 4); assert.equal(D.level().placing, true);
  wrong(); assert.equal(D.level().placing, true, 'one slip is forgiven');
  right(); const at = D.level().step;
  wrong();
  assert.equal(D.level().placing, false); assert.equal(D.level().step, Math.max(1, at - 2));
});

test('a kid settles near 80% right on their own step (3 seed sets, spread quoted)', () => {
  // a simulated kid: right with a chance that falls with the step (strong at the start of the ladder, weak at the end)
  const rates = [];
  for (const seed of [101, 202, 303]) {
    const r = seeded(seed), D = makeDividing({}, { rand: r });
    const skill = (step) => Math.max(0.15, Math.min(0.98, 1.08 - 0.07 * step));
    let own = 0, ownRight = 0;
    for (let w = 0; w < 400; w++) {
      const wv = D.wave({ count: 5 });
      while (D.card()) {
        const c = D.card(), mine = !wv.warmup && !c.review && !c.back && c.rung === D.level().step && D.level().placing === false;
        const ok = r() < skill(c.rung);
        const res = D.answer(ok ? c.answer : c.targets.find((t) => !t.good).n, ok, c.id);
        if (mine && res.first) { own++; if (ok) ownRight++; }
        if (!ok) D.answer(c.answer, true, c.id);
      }
    }
    rates.push(ownRight / own);
  }
  const lo = Math.min(...rates), hi = Math.max(...rates);
  assert.ok(lo > 0.68 && hi < 0.9, `own-step share right ${rates.map((x) => (100 * x).toFixed(1)).join(' / ')}%`);
});

test('the state saves as plain JSON and a reload mid-wave carries on', () => {
  const S = {};
  const D = makeDividing(S, { rand: seeded(12) });
  D.wave({ count: 5 });
  const c = D.card();
  const copy = JSON.parse(JSON.stringify(S));
  const D2 = makeDividing(copy, { rand: seeded(13) });
  assert.equal(D2.card().id, c.id); assert.equal(D2.card().rule, c.rule);
  // a damaged save is mended, not thrown
  const bad = makeDividing({ step: 'x', cur: { cards: [1, 2] }, soon: [null, { kind: 'zz' }], rungs: 4 });
  assert.equal(bad.level().step, 1);
  assert.ok(bad.wave({ count: 5 }).card);
});

test('the sick sheep: dividing sums from the kid\'s own step, one cure each, a row off or the leftover dropped', async () => {
  const { makeFlock, flockTopics, levelOf, SHEEP_MATH } = await import('../src/missions/sheepmath.js');
  assert.ok(SHEEP_MATH.topics.includes('dividing'));
  const { setLevel } = await import('../src/math/skill.js');
  const divRider = {}; setLevel(divRider, 'div', 30); setLevel(divRider, 'mul', 30);
  assert.ok(flockTopics(divRider).includes('dividing'), 'a rider at dividing gets dividing flocks');
  const rand = seeded(17);
  // what a written answer comes to: '4' -> 4, '3 r 2' -> 302 (the round-up's way)
  let rem = false;
  const v = (t) => { const m = /(\d+)(?: r (\d+))?\s*$/.exec(t); return m[2] || rem ? remCode(+m[1], +(m[2] || 0)) : +m[1]; };
  for (let lv = 1; lv <= LADDER.length; lv++) {
    const rider = { topicsOn: { dividing: true }, topics: { dividing: { step: lv } } };
    rem = LADDER[lv - 1].kind === 'rem';
    assert.equal(levelOf(rider, 'dividing'), lv);
    for (let k = 0; k < 30; k++) {
      const F = makeFlock(rider, 'dividing', { rand });
      for (const s of F.sheep) {
        const [lhs, rhs] = s.shown.split(' = '), [n, d] = lhs.split(' ÷ ').map(Number);
        const right = LADDER[lv - 1].kind === 'rem' ? remCode(Math.floor(n / d), n % d) : n / d;
        assert.equal(s.answer, right, s.shown);
        assert.equal(v(rhs) === right, !s.sick, `${s.shown}: sick only when wrong`);
        assert.equal(s.bottles.filter((b) => b.right).length, s.sick ? 1 : 0);
        for (const b of s.bottles) { assert.match(b.label, /^should be \d+( r \d+)?$/); assert.equal(v(b.label), b.value); if (!b.right) assert.ok(b.why.length > 15); }
        assert.ok(!s.bottles.some((b) => b.value === v(rhs)), 'no bottle says what the sum already says');
        if (s.help.kind === 'chart') { assert.equal(s.help.table, d); assert.equal(s.help.find, n); }
        if (LADDER[lv - 1].kind === 'rem' && s.sick) assert.ok(['noRem', 'short'].includes(s.slip));
      }
    }
  }
});
