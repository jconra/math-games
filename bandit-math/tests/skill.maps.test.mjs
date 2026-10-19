// The skill model (src/math/skill.js) driven through the game's REAL makers and choosing (src/math/asking.js and the
// store's makers), with learners who answer by the true point of the material they are shown (not the point the
// model asked for). These see what tests on one continuous strand can't: a point recorded above a maker's hardest
// question, a credit point past its strand's top, a share story far above a young rider.
import test from 'node:test';
import assert from 'node:assert/strict';

const K = await import('../src/math/skill.js');
const A = await import('../src/math/asking.js');
const { signsAt } = await import('../src/math/negatives.js');
const { makeWordProblems, LADDER: STORE } = await import('../src/math/wordproblems.js');
const { makeSupplies, LADDER: SUPPLIES } = await import('../src/math/supplies.js');
const { counterOrder, COUNTER_MAPS } = await import('../src/math/counter.js');

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fresh = (extra = {}) => ({ skill: { v: 1, migrated: 1, strands: {} }, ...extra });
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
// right with this chance at the TRUE point of the material (G: a guess among the few answers)
const pr = (pt, th, G = 0.2) => G + (1 - G - 0.03) / (1 + Math.exp((pt - th) / 4));
const own = (map, step) => K.MAPS[map].anchors[step - 1];

// One round-up card: the job's own choosing, asking and recording; answered by the card's true point.
function card(r, R, ctx, answer) {
  const map = A.chooseFor(r, A.HERD_MAPS, { last: ctx.last, rand: R }); ctx.last = map;
  const q = A.askFor(r, map);
  let strand = map === 'negatives' ? q.lead : K.MAPS[map].strand;
  if (!strand) { const sg = signsAt(q.step); strand = sg.length === 1 ? (sg[0] === '+' ? 'add' : 'sub') : (R() < 0.5 ? 'add' : 'sub'); }
  const at = A.atFor(q, q.step, strand);
  const ok = answer(map, q, R);
  K.record(r, [{ strand, at }], { right: ok });
  return { map, q, strand, at, ok };
}

test('the round-up: a kindergartner who counts everything stays at counting\'s top and keeps read-aloud (3 seed sets)', () => {
  for (const set of [1, 2, 3]) for (const age of [null, 5]) {
    const R = rng(set * 131 + (age || 0)), r = fresh({ age }), ctx = { last: null };
    let top = 0, counting = 0;
    for (let k = 0; k < 80; k++) {
      const c = card(r, R, ctx, (map) => (map === 'counting' ? true : R() < 0.3));
      if (c.map === 'counting') { counting++; top = Math.max(top, c.at); }
    }
    const tag = `set ${set}, age ${age}`;
    assert.ok(counting > 10, `${tag}: ${counting} counting cards`);
    assert.ok(top <= K.capOf('counting'), `${tag}: a counting card recorded at ${top}`);
    assert.ok(K.levelOf(r, 'number') <= K.capOf('counting') + K.SKILL.UP, `${tag}: Numbers ${K.levelOf(r, 'number')}`);
    assert.equal(K.readAloud(r), true, `${tag}: read-aloud still on`);
  }
});

test('the round-up: two-digit adders are placed near their own level, not past the negatives, and meet positive & negative (3 seed sets)', () => {
  for (const set of [1, 2, 3]) for (const th of [30, 45, 60]) {
    const placedAt = [], negs = [], high = [];
    for (let k = 0; k < 40; k++) {
      const R = rng(set * 7001 + th * 13 + k), r = fresh(), ctx = { last: null };
      let n = 0, neg = 0;
      for (let g = 0; g < 400 && n < 250; g++) {
        const c = card(r, R, ctx, (map, q, R2) => (['adding', 'taking', 'negatives'].includes(map) ? R2() < pr(own(map, q.step), th) : R2() < 0.8));
        if (['adding', 'taking', 'negatives'].includes(c.map)) { n++; if (c.map === 'negatives') neg++; }
        if (c.map === 'adding' || c.map === 'taking') assert.ok(c.at <= K.capOf(c.map), `two-digit sums recorded at ${c.at}`);
      }
      for (const s of ['add', 'sub']) if (K.isPlaced(r, s)) placedAt.push(K.levelOf(r, s));
      negs.push(neg);
      high.push(['add', 'sub'].some((s) => K.isPlaced(r, s) && K.levelOf(r, s) >= 50 && th <= 30) ? 1 : 0);
    }
    const tag = `set ${set}, 80% point near ${th}`;
    assert.ok(placedAt.length >= 60, `${tag}: ${placedAt.length} of 80 strands placed`);
    if (th === 30) {
      assert.ok(mean(placedAt) < 40, `${tag}: placed at ${mean(placedAt).toFixed(1)} on average`);
      assert.equal(mean(high), 0, `${tag}: placed at 50 or more`);
    }
    if (th >= 45) assert.ok(mean(negs) > 20, `${tag}: ${mean(negs).toFixed(0)} positive & negative cards in 250`);
  }
});

test('every point a store order, a counter question or a delivery part credits is at or under that strand\'s top', () => {
  const R = rng(5);
  const check = (c, what) => { if (c && c.strand) assert.ok(c.at >= 0 && c.at <= K.maxOf(c.strand), `${what}: ${c.strand} ${c.at} (top ${K.maxOf(c.strand)})`); };
  const Q = makeWordProblems({}, { rand: R });
  for (let step = 1; step <= STORE.length; step++) for (let i = 0; i < 40; i++) { const o = Q.next({ step }); for (const c of o.credit || []) check(c, `store step ${step} ${o.type}`); }
  for (let step = 1; step <= 4; step++) for (let i = 0; i < 20; i++) { const o = Q.next({ step, ladder: 'K' }); for (const c of o.credit || []) check(c, `picture story ${step}`); }
  for (const map of COUNTER_MAPS) for (let step = 1; step <= K.MAPS[map].anchors.length; step++) for (let i = 0; i < 20; i++) {
    const o = counterOrder(map, { step, frac: R(), rand: R });
    for (const c of o.credit || []) check(c, `counter ${map} ${step}`);
  }
  const S = makeSupplies({}, { rand: R });
  for (let step = 1; step <= SUPPLIES.length; step++) for (let i = 0; i < 20; i++) { const o = S.next({ step }); for (const p of o.parts) check(p.credit, `delivery step ${step} ${p.key}`); }
});

test('Loot the gang: a rider who gets every share right gets Division placed; a guessing kindergartner stays where they were', () => {
  for (const age of [6, 10, 15]) {
    const r = fresh({ age });
    let q = A.askFor(r, 'shares');
    for (let i = 0; i < 30 && !K.isPlaced(r, 'div'); i++) {
      const at = A.atFor(q, q.step, 'div');
      K.record(r, [{ strand: 'div', at, weight: A.lightly(r, 'div', at, 1) }], { right: true, sitDown: true, ms: 6000 });
      q = A.askFor(r, 'shares');
    }
    assert.equal(K.isPlaced(r, 'div'), true, `age ${age}: every share right, Division placed`);
  }
  for (const set of [1, 2, 3]) {
    const R = rng(set * 991), ends = [];
    for (let k = 0; k < 200; k++) {
      const r = fresh({ age: 6 });
      for (let i = 0; i < 40; i++) {
        const q = A.askFor(r, 'shares'), at = A.atFor(q, q.step, 'div');
        K.record(r, [{ strand: 'div', at, weight: A.lightly(r, 'div', at, 1) }], { right: R() < 1 / 3, sitDown: true, ms: 7000 });
      }
      ends.push(K.levelOf(r, 'div'));
    }
    const lifted = ends.filter((v) => v >= 10).length / ends.length;
    assert.ok(lifted <= 0.08, `set ${set}: ${(100 * lifted).toFixed(0)}% of guessers lifted to where dividing cards fit`);
  }
});
