// The round-up's series (src/math/series.js), the wagon's odds and evens (src/math/parity.js) and gang choice
// (src/missions/wagonplan.js chooseGang), and the times trainer told the table or the fact (src/math/times.js): every
// level of both ladders makes good questions, one source for the levels page and the jobs.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { seriesCard, whyNot, picture, makeSeriesDeck, TABLE_ORDER, textOf, reviewFor, herdReview, RANGE } from '../src/math/series.js';
import { makeParity } from '../src/math/parity.js';
import { makeTimes } from '../src/math/times.js';
import { chooseGang, sacksFor, GANG } from '../src/missions/wagonplan.js';
import { PLACE, examplesOf } from '../src/levels/places.js';
import * as M from '../src/levels/model.js';
import { recordFact, colourOf } from '../src/math/facts.js';
import { seeded } from '../src/levels/kit.js';

const RU = PLACE.roundup, WA = PLACE.wagon;
const cardLevels = RU.levels.filter((L) => L.gen.kind !== 'herd');
const T0 = Date.UTC(2026, 9, 21, 15);

test('every series card: one right steer, all different, the answer fills the series, no stray below zero', () => {
  const rand = seeded(11);
  for (const L of cardLevels) {
    for (let k = 0; k < 120; k++) {
      const c = seriesCard(L.gen, rand, { read: !!L.read });
      const good = c.targets.filter((x) => x.good);
      assert.equal(good.length, 1, `${L.id}: one right`);
      assert.equal(good[0].label, c.answerText, `${L.id}: the right steer wears the answer`);
      assert.equal(new Set(c.targets.map((x) => x.label)).size, c.targets.length, `${L.id}: ${c.targets.map((x) => x.label)}`);
      assert.equal(new Set(c.targets.map((x) => x.n)).size, c.targets.length, `${L.id}: steer ids differ`);
      assert.equal(c.targets.length, L.read ? 4 : 5, `${L.id}: herd size`);
      assert.ok(c.text.split(', ').filter((t) => t === '?').length === 1, `${L.id}: one blank: ${c.text}`);
      // a constant step: the blank is the step on from its neighbour; a rule: its own working
      if (c.by != null) {
        const b = c.blank;
        assert.equal(b > 0 ? c.terms[b - 1] + c.by : c.terms[1] - c.by, c.ans, `${L.id}: ${c.text}`);
        for (let i = 1; i < c.terms.length; i++) assert.equal(c.terms[i] - c.terms[i - 1], c.by, `${L.id}: steady steps`);
      }
      const neg = c.terms.some((v) => v < 0) || L.gen.neg;
      if (!neg) assert.ok(c.targets.every((x) => x.u >= 0), `${L.id}: nothing below zero (${c.targets.map((x) => x.label)})`);
      for (const t of c.texts) assert.ok(!/NaN|undefined|Infinity|e[+-]/.test(t), `${L.id}: ${t}`);
      // a wrong pick's line says something, and names the right answer's working
      const bad = c.targets.find((x) => !x.good);
      const w = whyNot(c, bad);
      assert.ok(w.line.length > 10 && !/undefined|NaN/.test(w.line), `${L.id}: ${w.line}`);
    }
  }
});

test('the series ladder climbs in small steps: counting, then the tables in the difficulty order, herds, then the rest', () => {
  const ids = RU.levels.map((L) => L.id);
  assert.deepEqual(ids.slice(0, 7), ['c1end', 'by1', 'by1b', 'tens1', 'by10', 'by5', 'by2']);
  assert.deepEqual(RU.levels.filter((L) => L.gen.table).map((L) => L.gen.table), TABLE_ORDER);
  assert.deepEqual(TABLE_ORDER, [2, 10, 5, 3, 4, 9, 6, 8, 7, 11, 12], 'the tiers: 2; 10, 5, 3; 4, 9; 6, 8, 7; 11, 12');
  // each tier's series, then that tier's herd ("rope all"), then the next tier; the any-table herd after the 12s
  const herds = RU.levels.filter((L) => L.gen.kind === 'herd');
  assert.equal(herds.length, 5);
  assert.deepEqual(ids.slice(7, 23), ['x2', 'x10', 'x5', 'x3', 'herdA', 'x4', 'x9', 'herdB', 'x6', 'x8', 'x7', 'herdC', 'x11', 'x12', 'herdD', 'herdE']);
  assert.equal(ids.indexOf('herdA') + 1, 12, 'rope all the 2s, 10s, 5s or 3s is level 12, straight after their series');
  for (const H of herds.slice(0, 4)) {
    const before = RU.levels.slice(0, ids.indexOf(H.id)).filter((L) => L.gen.table).map((L) => L.gen.table);
    assert.deepEqual(before.slice(-H.gen.tables.length), H.gen.tables, `${H.id}: straight after its own tables' series`);
  }
  assert.equal(ids[23], 'downA', 'the rest of the ladder after, as it was');
  // the first level: blank at the end, numbers up to 10, read aloud
  const rand = seeded(2);
  for (let k = 0; k < 50; k++) {
    const c = seriesCard(RU.levels[0].gen, rand, { read: true });
    assert.equal(c.blank, 3); assert.ok(Math.max(...c.terms) <= 10); assert.match(c.say, /, what comes next$/);
  }
  // grades climb on each strand along the ladder (a seed or an old save reads them)
  const last = {};
  for (const L of RU.levels) { assert.ok(L.grade >= (last[L.strand] ?? -1), `${L.id}: ${L.strand} ${L.grade} after ${last[L.strand]}`); last[L.strand] = L.grade; }
  // the design's own examples are on the ladder
  const seen = new Set();
  for (const L of cardLevels) for (let k = 0; k < 400; k++) seen.add(seriesCard(L.gen, rand).text);
  for (const ex of ['3, 6, 9, ?', '?, 36, 42, 48', '64, 72, ?, 88', '⅔, 1⅓, ?, 2⅔', '1, 2, ?, 4']) assert.ok(seen.has(ex), ex);
});

test('a times-table series puts the blank on a fact (fed to the times chart) and the job can choose it', () => {
  const rand = seeded(5);
  for (const t of TABLE_ORDER) {
    const L = RU.levels.find((x) => x.id === `x${t}`);
    for (let b = 1; b <= 12; b++) {
      const c = seriesCard(L.gen, rand, { pickFact: () => ({ a: t, b }) });
      assert.deepEqual(c.fact, { a: t, b }, `x${t} blank ${b}: ${c.text}`);
      assert.equal(c.ans, t * b);
      assert.ok(Math.min(...c.terms) >= t && Math.max(...c.terms) <= 12 * t, `${c.text}: within ${t} x 1 to 12`);
    }
  }
  // counting by 5s is a fact too; odd steps and halves are not
  assert.ok(seriesCard({ kind: 'series', by: 5, from: [5, 35], terms: 4, blank: 'any' }, rand).fact);
  assert.equal(seriesCard({ kind: 'step', by: [3, 9], from: [1, 20] }, rand).fact, null);
  assert.equal(seriesCard({ kind: 'frac', den: [2], by: [1] }, rand).fact, null);
});

test('the slips are the real ones: counted by one, a number from the card, below zero without its sign, ten tenths', () => {
  const rand = seeded(9), kinds = {};
  const tally = (L, n) => { for (let k = 0; k < n; k++) for (const x of seriesCard(L.gen, rand).targets) if (!x.good) kinds[`${L.id}:${x.trap}`] = 1; };
  for (const L of cardLevels) tally(L, 200);
  for (const k of ['by2:byOne', 'x7:neighbour', 'x6:same', 'neg:sign', 'dec:place', 'dec25:place', 'thirds2:whole', 'rule:linear', 'rule:half', 'by10:step'])
    assert.ok(kinds[k], k);
  // no card carries more than one number from the card itself
  for (const L of cardLevels) for (let k = 0; k < 100; k++) assert.ok(seriesCard(L.gen, rand).targets.filter((x) => x.trap === 'same').length <= 1);
  // "the biggest" or "the middle one" is no shortcut: the right steer's place among them is spread out
  for (const L of [RU.levels.find((x) => x.id === 'x7'), RU.levels.find((x) => x.id === 'by2')]) {
    const at = [0, 0, 0, 0, 0];
    for (let k = 0; k < 2000; k++) { const c = seriesCard(L.gen, rand), s = [...c.targets].sort((a, b) => a.u - b.u); at[s.findIndex((x) => x.good)]++; }
    assert.ok(Math.max(...at) < 2000 * 0.4, `${L.id}: right steer's place by size ${at}`);
  }
});

test('help: a whole-number series gets the number line with a hop a step; the blank stays hidden until shown', () => {
  const rand = seeded(4);
  const c = seriesCard({ kind: 'series', table: 6, by: 6, terms: 4, blank: 'any' }, rand, { pickFact: () => ({ a: 6, b: 7 }) });
  const h = picture(c, { reveal: false });
  assert.equal(h.helper, 'count');
  assert.equal(h.line.end, 42);
  assert.ok(h.line.hops.every((x) => Math.abs(x.to - x.from) === 6));
  assert.ok(!h.reveal && /6/.test(h.reason));
  const f = seriesCard({ kind: 'frac', den: [3], by: [1] }, rand);
  assert.equal(picture(f).helper, 'text', 'a fraction gets its line, not a number line');
});

test('the deck: a card at a time from the rider\'s level, the first try is the answer, a miss stays up, a herd ends it', () => {
  const r = { skill: { v: 1, migrated: 1, strands: {} } };
  const asked = [];
  const deck = makeSeriesDeck({ ask: () => { const q = M.levelFor(r, 'roundup', { now: T0 }); asked.push(q.id); return q; }, rand: seeded(3) });
  const w = deck.wave({ cards: 3 });
  assert.equal(w.kind, 'card'); assert.equal(w.card.level, 'c1end');
  const c1 = deck.card(), bad = c1.targets.find((x) => !x.good), good = c1.targets.find((x) => x.good);
  const a = deck.answer(bad.n, false, c1.id);
  assert.ok(a.first && !a.right && deck.card() === c1, 'a miss leaves the card up');
  M.recordLevel(r, 'roundup', { right: false, level: a.level, now: T0 });
  const b = deck.answer(good.n, true, c1.id);
  assert.ok(!b.first && b.right && !b.waveDone, 'roped right after: practice');
  const c2 = deck.card();
  assert.notEqual(c2, c1);
  assert.equal(deck.answer(c2.targets.find((x) => x.good).n, true, 'old.id').stale, true, 'a pick from an old card is stale');
  // help marks the card: its answer is practice
  deck.help(c2);
  assert.equal(deck.answer(c2.targets.find((x) => x.good).n, true, c2.id).helped, true);
  const c3 = deck.card();
  assert.equal(deck.answer(c3.targets.find((x) => x.good).n, true, c3.id).waveDone, true, 'three cards a wave');
  // the next card comes from the level the last answer left: set the rider just under a herd
  const s = { skill: { v: 1, migrated: 1, strands: {} } };
  M.setLevelAt(s, 'roundup', 'x3', { into: 4, now: T0 });
  const d2 = makeSeriesDeck({ ask: () => M.levelFor(s, 'roundup', { now: T0 }), rand: seeded(1) });
  d2.wave({ cards: 3 });
  const k = d2.card(), r2 = d2.answer(k.targets.find((x) => x.good).n, true, k.id);
  M.recordLevel(s, 'roundup', { right: true, level: r2.level, now: T0 });
  assert.equal(M.stateOf(s, 'roundup').id, 'herdA');
  assert.equal(d2.card(), null, 'the level is a herd now: the series wave ends there');
  assert.equal(d2.wave({ cards: 3 }), null);
});

test('the levels page examples come from the same makers (series, herds, parity, gangs, missing numbers)', () => {
  for (const P of [RU, WA]) for (const L of P.levels) {
    const ex = examplesOf(P.id, L.id, { n: 3, seed: 7 });
    assert.equal(ex.length, 3);
    for (const e of ex) assert.ok(e.q && e.a && !/undefined|NaN/.test(e.q + e.a), `${L.id}: ${e.q} -> ${e.a}`);
  }
  assert.match(examplesOf('roundup', 'herdC', { n: 1, seed: 3 })[0].q, /^Rope the [678]-herd: /);
  assert.match(examplesOf('wagon', 'odd10', { n: 1, seed: 3 })[0].q, /^Rope the odds: /);
  assert.match(examplesOf('wagon', 'g7', { n: 1, seed: 3 })[0].q, /^The 7-Gang: /);
  assert.match(examplesOf('wagon', 'miss12', { n: 1, seed: 3 })[0].q, /\?.* = \d+/);
});

test('odds and evens: about half the riders are the gang, the slips are next-door numbers and tens look-alikes', () => {
  const P = makeParity({ rand: seeded(6) });
  const traps = {};
  for (const [want, top] of [['even', 10], ['odd', 10], ['either', 20], ['either', 100]]) {
    for (let k = 0; k < 200; k++) {
      const w = P.wave({ count: 8, want, top });
      const goods = w.targets.filter((x) => x.good);
      assert.ok(goods.length >= 3 && goods.length <= 5, `${w.rule}: ${goods.length} of ${w.targets.length}`);
      assert.equal(new Set(w.targets.map((x) => x.n)).size, w.targets.length);
      for (const x of w.targets) {
        assert.ok(x.n >= 1 && x.n <= top);
        assert.equal(x.good, (x.n % 2 === 0) === (w.want === 'even'), `${w.rule}: ${x.n}`);
        if (!x.good) traps[x.trap] = 1;
      }
    }
  }
  assert.ok(traps.near && traps.tens);
  // a miss: the line says why, the rail shows the evens round it, and the number comes back
  const w = P.wave({ count: 8, want: 'even', top: 10 }), bad = w.targets.find((x) => !x.good);
  const ex = P.explain(bad.n);
  assert.match(ex.line, /is odd: .* not even$/);
  assert.ok(ex.skip.includes(`(${bad.n})`) && ex.skip.filter((v) => typeof v === 'number').every((v) => v % 2 === 0));
  P.answer(bad.n, false);
  let back = [];
  for (let k = 0; k < 4 && !back.length; k++) { P.answer(w.targets.find((x) => x.good).n, true); back = P.due(); }
  assert.deepEqual(back.map((x) => x.n), [bad.n], 'the missed number rides back 2 to 4 answers later');
  assert.deepEqual(sacksFor(8, 2, 'parity'), { sacks: 4, per: 2 });
  assert.deepEqual(sacksFor(7, 2, 'parity'), { sacks: 3, per: 2 });
});

test('the times trainer told the table or the fact: that wave, its step untouched', () => {
  const T = makeTimes({}, { rand: seeded(2), now: () => T0 });
  const step = T.state.step;
  for (const t of TABLE_ORDER) {
    const w = T.wave({ count: 11, table: t, reach: 12 });
    assert.equal(w.table, t);
    for (const x of w.targets) assert.equal(x.good, x.n % t === 0, `${t}: ${x.n}`);
    for (const x of w.targets) T.answer(x.n, x.good);
  }
  assert.equal(T.state.step, step, 'the job says what the wave is: the trainer\'s own step stays put');
  const m = T.wave({ count: 6, fact: { t: 7, a: 8, upTo: 12 } });
  assert.equal(m.kind, 'missing'); assert.match(m.rule, /7/); assert.match(m.rule, /56/);
  assert.equal(m.targets.find((x) => x.good).n, 8);
  // a table's first waves: reach 10 is up to x10
  const T2 = makeTimes({}, { rand: seeded(3), now: () => T0 });
  for (let k = 0; k < 20; k++) assert.ok(T2.wave({ count: 8, table: 7, reach: 10 }).targets.filter((x) => x.good).every((x) => x.n <= 70));
});

test('the wagon\'s gangs: the level\'s table, every 3rd gang an earlier table at ITS level once placed, facts for missing numbers', () => {
  const r = { skill: { v: 1, migrated: 1, strands: {} } };
  M.setLevelAt(r, 'wagon', 'g7', { now: T0 });
  const q = M.levelFor(r, 'wagon', { now: T0 });
  const got = [1, 2, 3, 4, 5, 6].map((n) => chooseGang(r, q, { n, rand: seeded(n) }));
  assert.deepEqual(got.map((c) => c.kind), Array(6).fill('rule'));
  assert.deepEqual(got.filter((_, i) => (i + 1) % 3).map((c) => c.table), [7, 7, 7, 7]);
  for (const c of [got[2], got[5]]) { assert.notEqual(c.table, 7); assert.equal(c.level, `g${c.table}`); assert.ok(WA.levels.find((L) => L.id === 'g7').gen.open.includes(c.table)); }
  assert.equal(got[0].count, GANG.riders);
  // a table met twice already reaches x12; before that x10
  assert.equal(chooseGang(r, q, { n: 1, met: () => 0 }).reach, 10);
  assert.equal(chooseGang(r, q, { n: 1, met: () => 2 }).reach, 12);
  // while placing: the level's own table every time
  const p = { skill: { v: 1, migrated: 1, strands: {} } };
  M.setLevelAt(p, 'wagon', 'g7', { placed: false, now: T0 });
  const qp = M.levelFor(p, 'wagon', { now: T0 });
  assert.ok(qp.placing);
  for (let n = 1; n <= 6; n++) assert.equal(chooseGang(p, qp, { n }).table, 7);
  // missing numbers: a red fact due comes first
  const s = { skill: { v: 1, migrated: 1, strands: {} } };
  M.setLevelAt(s, 'wagon', 'miss12', { now: T0 });
  recordFact(s, 8, 7, false);
  for (let k = 0; k < 4; k++) recordFact(s, 2, 2, true);
  assert.equal(colourOf(s, 7, 8), 'red');
  const c = chooseGang(s, M.levelFor(s, 'wagon', { now: T0 }), { n: 1 });
  assert.equal(c.kind, 'missing');
  assert.deepEqual([c.fact.t, c.fact.a].sort((x, y) => x - y), [7, 8]);
  // the young levels: odds and evens
  const y = { skill: { v: 1, migrated: 1, strands: {} } };
  const cy = chooseGang(y, M.levelFor(y, 'wagon', { now: T0 }), { n: 1 });
  assert.deepEqual([cy.kind, cy.want, cy.top, cy.level], ['parity', 'even', 10, 'even10']);
});

test('fractions and decimals are written the game\'s way', () => {
  assert.equal(textOf(4, 3), '1⅓', 'halves, thirds and quarters in their own characters: "1 1/3" reads as "11/3" on a card');
  assert.equal(textOf(-3, 2), '−1½');
  assert.equal(textOf(2, 3), '⅔');
  assert.equal(textOf(6, 5), '1 1/5');
  assert.equal(textOf(125, 100), '1.25');
  assert.equal(textOf(100, 100), '1');
  assert.equal(textOf(-12, 1), '−12');
});

test('the range: one card in most waves from below the rider\'s level (never the first, never while placing), steered by the times chart', () => {
  const ix = (id) => RU.levels.findIndex((L) => L.id === id);
  const r = { skill: { v: 1, migrated: 1, strands: {} } };
  M.setLevelAt(r, 'roundup', 'x7', { now: T0 });
  const rand = seeded(5);
  const review = reviewFor({ levels: RU.levels, rider: r, rand });
  const q = M.levelFor(r, 'roundup', { now: T0 });
  const got = {};
  for (let k = 0; k < 600; k++) { const x = review(q); assert.ok(x && x.i < q.i && x.level.gen.kind !== 'herd', 'below, a card level'); got[x.id] = (got[x.id] || 0) + 1; }
  for (const id of ['x6', 'x8', 'x9', 'x4']) assert.ok(got[id] > 20, `${id} in the range below (${got[id]})`);
  assert.ok(!got.x11 && !got.x12, 'nothing above the rider');
  // red facts on an earlier table bring that table back, from well below the range
  for (let b = 1; b <= 6; b++) recordFact(r, 3, b, false, { now: T0 });
  const red = {};
  for (let k = 0; k < 600; k++) { const x = review(q); red[x.id] = (red[x.id] || 0) + 1; }
  assert.ok(ix('x3') < q.i - RANGE.back && red.x3 > 150 && red.x3 > 3 * (got.x3 || 0), `the 3s, red on the chart, come back (${red.x3} of 600)`);
  // not while the level is being found, nor at a level a grown-up dealt
  const p = { skill: { v: 1, migrated: 1, strands: {} } };
  const qp = M.levelFor(p, 'roundup', { now: T0 });
  assert.equal(qp.placing, true); assert.equal(reviewFor({ levels: RU.levels, rider: p })(qp), null);
  assert.equal(review({ ...q, dev: true }), null);
  // the deck: the first card is the rider's own, then one card of the wave from below, at ITS level
  const d = makeSeriesDeck({ ask: () => M.levelFor(r, 'roundup', { now: T0 }), rand, review });
  let withReview = 0;
  for (let w = 0; w < 60; w++) {
    d.wave({ cards: 3 });
    const lv = [];
    for (let c = d.card(); c; c = d.card()) { lv.push([c.level, c.review]); d.answer(c.targets.find((x) => x.good).n, true, c.id); }
    assert.equal(lv.length, 3);
    assert.deepEqual(lv[0], ['x7', false], 'a wave opens at the rider\'s level');
    assert.ok(lv.filter((x) => x[1]).length <= RANGE.cards, 'at most one card from below');
    if (lv.some((x) => x[1])) withReview++;
    for (const [id, rv] of lv) assert.ok(rv ? ix(id) < ix('x7') : id === 'x7');
  }
  assert.ok(withReview > 30 && withReview < 56, `most waves have one (${withReview} of 60)`);
  // a review right doesn't move the rider; the 80% staircase reads their own level
  const before = M.stateOf(r, 'roundup').into;
  M.recordLevel(r, 'roundup', { right: true, level: 'x3', now: T0 });
  assert.equal(M.stateOf(r, 'roundup').into, before);
  // now and then a herd from a herd level in the range below (herdB and herdC are within 6 levels of the 11s)
  M.setLevelAt(r, 'roundup', 'x11', { now: T0 });
  const q2 = M.levelFor(r, 'roundup', { now: T0 });
  let herds = 0;
  for (let k = 0; k < 1000; k++) { const h = herdReview({ levels: RU.levels, q: q2, rand }); if (h) { herds++; assert.ok(['herdB', 'herdC'].includes(h.id), h.id); assert.equal(h.own, 'x11'); } }
  assert.ok(herds > 40 && herds < 130, `about ${RANGE.herd * 100}% of the waves (${herds / 10}%)`);
  assert.equal(herdReview({ levels: RU.levels, q: { ...q2, placing: true }, rand: () => 0 }), null);
});

test('counting on by 1s feeds the 1s to the times chart, without a times line or a 2s slip on the card', () => {
  const rand = seeded(9);
  for (let k = 0; k < 200; k++) {
    const c = seriesCard(RU.levels[1].gen, rand, { read: true });
    assert.ok(c.fact && c.fact.a === 1 && c.fact.b === c.ans);
    assert.ok(!/×/.test(c.done)); assert.ok(!c.targets.some((x) => x.trap === 'neighbour'));
  }
});

test('saved round-up levels keep their place by id in the new order (same tier, the same table)', () => {
  for (const L of RU.levels) {
    const r = { skill: { v: 1, migrated: 1, strands: {} }, levels: { v: 1, migrated: 1, places: { roundup: { id: L.id, into: 2, placed: true, g: 0, s: 'mul' } } } };
    M.levelsOf(r);
    assert.equal(r.levels.places.roundup.id, L.id);
    assert.equal(r.levels.places.roundup.into, Math.min(2, L.count));
  }
});
