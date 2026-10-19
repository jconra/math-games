// The field jobs on the skill model (src/math/asking.js) and the trainers steered by it (steer in times.js, early.js,
// dividing.js, negatives.js, numbersense.js): which maker a young and an older rider get, the step they are asked at,
// the point every answer is recorded at, and that a steered trainer's step moves only when the model moves it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/math/asking.js';
import * as K from '../src/math/skill.js';
import { makeTimes, LADDER as TIMES } from '../src/math/times.js';
import { makeCounting } from '../src/math/counting.js';
import { makeAdding } from '../src/math/adding.js';
import { makeDividing } from '../src/math/dividing.js';
import { makeNegatives, signsAt, SHAPE_SIGN, LADDER as NEG } from '../src/math/negatives.js';
import { makeNumberSense, countCard, rightNow, isDone, whyNot, tipFor, lineFor } from '../src/math/numbersense.js';
import { makeRng } from '../src/lockbox/generate.js';
import { seeded } from '../src/math/early.js';

const at = (levels, o = {}) => { const r = {}; for (const [s, v] of Object.entries(levels)) K.setLevel(r, s, v, o); return r; };
const share = (rider, maps, n = 200) => { const c = {}; for (let k = 0; k < n; k++) { const m = A.chooseFor(rider, maps, { rand: seeded(k + 1) }); c[m] = (c[m] || 0) + 1; } return c; };

test('the round-up: counting and adding for a young rider, times, dividing and positive & negative for an older one', () => {
  const young = share({}, A.HERD_MAPS);
  assert.deepEqual(Object.keys(young).sort(), ['adding', 'counting', 'taking'], JSON.stringify(young));
  const teen = share(at({ number: 92, add: 90, sub: 90, mul: 60, div: 78 }), A.HERD_MAPS);
  assert.deepEqual(Object.keys(teen).sort(), ['negatives', 'times'], JSON.stringify(teen));
  // a 15-year-old's optional age: a modest head start (third-grade work), so no counting dots, and no negatives yet
  const age15 = share({ age: 15 }, A.HERD_MAPS);
  assert.ok(!age15.counting && !age15.negatives && age15.times && age15.adding, JSON.stringify(age15));
  // the step each is asked at: the rider's own level in that strand
  const r = at({ mul: 36 });
  const q = A.askFor(r, 'times');
  assert.equal(q.at, 36); assert.equal(q.step, 14); assert.equal(q.placing, false);
  assert.equal(TIMES[q.step - 1].table, 6, 'the 6s');
});

test('nothing fits: the maker nearest the rider\'s level stands in', () => {
  const r = at({ div: 0, mul: 0 });
  assert.equal(K.chooseMap(r, ['dividing']), null);
  assert.equal(A.chooseFor(r, ['dividing']), 'dividing');
  assert.equal(A.chooseFor(r, ['shares', 'dividing']), 'dividing', 'dividing starts lower than the shares');
  assert.equal(A.chooseFor(r, ['nonesuch']), null);
});

test('positive & negative: the strand finding its level leads, on a step that deals its own sign', () => {
  // the sign table matches the ladder's shapes
  for (let k = 1; k <= NEG.length; k++) for (const sh of NEG[k - 1].shapes) assert.ok(SHAPE_SIGN[sh], sh);
  assert.deepEqual(signsAt(1), ['+']); assert.deepEqual(signsAt(3), ['-']); assert.deepEqual(signsAt(6).sort(), ['+', '-']);
  // both placed: the average, every card at it
  const both = at({ add: 70, sub: 62 });
  let q = A.askFor(both, 'negatives');
  assert.equal(q.lead, null); assert.equal(q.at, 66);
  assert.equal(A.atFor(q, q.step, 'sub'), 66); assert.equal(A.atFor(q, q.step, 'add'), 66);
  // taking away still finding its level at 75: it leads (step 4, 72: taking away past zero)
  const r = at({ add: 70 }); K.setLevel(r, 'sub', 75, { placed: false });
  q = A.askFor(r, 'negatives');
  assert.equal(q.lead, 'sub'); assert.equal(q.at, 75); assert.equal(q.step, 4); assert.equal(q.placing, true);
  // adding finding its level at 73 would get step 4, which deals no adding card: step 5 (76) stands in, asked there
  const r2 = at({ sub: 60 }); K.setLevel(r2, 'add', 73, { placed: false });
  q = A.askFor(r2, 'negatives');
  assert.equal(q.lead, 'add'); assert.equal(q.step, 5); assert.equal(q.at, 76);
  // a card of the other sign is recorded at the step's own point
  assert.equal(A.atFor(q, q.step, 'sub'), K.pctAt('negatives', 5));
  assert.deepEqual(A.travel(q, { card: { rung: 5, parts: { op: '+' } } }), { strands: [{ strand: 'add', at: 76 }] });
  assert.deepEqual(A.travel(q, { card: { rung: 5, parts: { op: '-' } } }), { strands: [{ strand: 'sub', at: 76 }] });
  assert.equal(A.strandOf('negatives', { parts: { op: '-' } }), 'sub');
  assert.equal(A.strandOf('times', {}), 'mul');
});

test('the point an answer is recorded at: the pick for its own step, a lower step its own point, never below the step', () => {
  const r = at({ add: 26 });
  const q = A.askFor(r, 'adding');
  assert.equal(q.step, 7); assert.equal(q.at, 26);
  assert.equal(A.atFor(q, 7), 26, 'made at the pick');
  assert.equal(A.atFor(q, 3), 9, 'a warm-up or review card from step 3: its own point');
  assert.deepEqual(A.travel(q, { card: { rung: 2 } }), { strands: [{ strand: 'add', at: 5 }] });
  // a level under the maker's first step gets the first step: recorded at that step's point, the harder one
  const low = at({ div: 5 });
  const d = A.askFor(low, 'dividing');
  assert.equal(d.step, 1); assert.equal(d.at, 5);
  assert.equal(A.atFor(d, 1), 16);
  // the baseline climbs on the steps' points: right answers at the pick move it up (the first met starts it)
  const fresh = {};
  const q0 = A.askFor(fresh, 'times');
  assert.equal(q0.placing, true);
  const rec = K.record(fresh, 'mul', { right: true, at: A.atFor(q0, q0.step) });
  assert.ok(rec.mul.next > q0.at, `the baseline climbs: ${q0.at} -> ${rec.mul.next}`);
});

test('a steered times trainer: its step is the model\'s, answers never move it, and no warm-ups or other tables while placing', () => {
  const T = makeTimes({}, { rand: seeded(3) });
  T.steer(12, { placing: true });
  for (let n = 0; n < 6; n++) {
    const w = T.wave({ count: 11 });
    assert.equal(w.step, 12); assert.equal(w.hard, 12); assert.ok(w.placing && !w.warmup && !w.review);
    for (const t of w.targets) T.answer(t.n, !t.good);   // every pick wrong
    assert.equal(T.level().step, 12, 'misses never move a steered step');
  }
  T.steer(20);
  let reviews = 0;
  for (let n = 0; n < 9; n++) { const w = T.wave({ count: 11 }); if (w.review) { reviews++; assert.ok(w.hard < 20); } for (const t of w.targets) if (t.good) T.answer(t.n, true); }
  assert.equal(T.level().step, 20, 'rights never move it either');
  assert.ok(reviews >= 2, `the other tables still take turns once placed (${reviews})`);
  assert.equal(T.steered, true);
});

test('a steered card trainer (counting, adding, dividing, positive & negative): the step is the model\'s; a new step re-deals the cards to come', () => {
  for (const [name, make, top] of [['counting', makeCounting, 8], ['adding', makeAdding, 8], ['dividing', makeDividing, 9], ['negatives', makeNegatives, 7]]) {
    const T = make({}, { rand: seeded(7) });
    T.steer(3, { placing: true });
    let w = T.wave({ count: 5 });
    assert.equal(w.step, 3, name); assert.ok(w.cards.every((c) => c.rung === 3), `${name}: placing, every card from the step (${w.cards.map((c) => c.rung)})`);
    assert.ok(!w.warmup, name);
    // a right pick, then the model moves the level up: the cards still to come are dealt again at the new step
    const first = T.card();
    const r = T.answer(first.answer, true, first.id);
    assert.equal(r.step, 3, `${name}: the answer itself moves nothing`);
    T.steer(5, { placing: true });
    const next = T.card();
    assert.equal(next.rung, 5, `${name}: the next card comes from the new step`);
    // a wrong pick keeps the card on show as it is
    const wrongN = next.targets.find((t) => !t.good).n;
    T.answer(wrongN, false, next.id);
    T.steer(Math.min(top, 6), { placing: true });
    assert.equal(T.card().id, next.id, `${name}: the card already tried stays on show`);
    // placed: no step moves from answers, and reviews come back
    T.steer(Math.min(top, 6));
    let reviews = 0;
    for (let n = 0; n < 8; n++) {
      w = T.wave({ count: 5 });
      for (let c = T.card(), k = 0; c && k < 20; c = T.card(), k++) { if (c.review) reviews++; T.answer(c.answer, true, c.id); }
    }
    assert.equal(T.level().step, Math.min(top, 6), `${name}: rights never move a steered step`);
    assert.ok(reviews >= 2, `${name}: review cards from earlier steps once placed (${reviews})`);
  }
});

test('the range: a steered ladder, and counting cards on the shelf for the youngest', () => {
  const N = makeNumberSense({});
  N.steer(7, { placing: true });
  for (let k = 0; k < 8; k++) { const c = N.card({ rng: makeRng(k) }); assert.equal(c.step, 7); assert.equal(c.review, false); const f = N.finish(c, 3); assert.equal(f.step, 7); assert.equal(f.moved, 0); }
  N.steer(4);
  let reviews = 0; for (let k = 0; k < 12; k++) { const c = N.card({ rng: makeRng(k + 50) }); if (c.review) reviews++; N.finish(c, 0); }
  assert.ok(reviews >= 2, `easier cards for variety once placed (${reviews})`);
  assert.equal(N.level().step, 5, 'clean cards never move a steered ladder (step 5 of 11: index 4)');
  // the counting cards: one right, the counting cards' own slips and lines, "Shoot" for "Rope"
  for (let step = 1; step <= 8; step++) for (let k = 0; k < 20; k++) {
    const c = countCard(step, { rng: makeRng(step * 100 + k), what: 'bottle' });
    assert.equal(c.kind, 'pick'); assert.equal(c.step, step);
    assert.ok(!/\bRope\b|\brope\b/.test(c.rule + ' ' + c.sub), `${c.rule} · ${c.sub}`);
    assert.equal(c.targets.filter((t) => t.good).length, 1);
    assert.equal(new Set(c.targets.map((t) => t.n)).size, c.targets.length);
    const good = c.targets.findIndex((t) => t.good);
    assert.deepEqual(rightNow(c), [good]); assert.ok(!isDone(c)); assert.ok(isDone(c, new Set([good])));
    for (let i = 0; i < c.targets.length; i++) if (i !== good) assert.ok(whyNot(c, i).length > 10, whyNot(c, i));
    assert.ok(tipFor(c).length > 10);
    const L = lineFor(c, { pick: good === 0 ? 1 : 0 });
    assert.ok(L.from <= Math.min(...c.targets.map((t) => t.n)) && L.to >= Math.max(...c.targets.map((t) => t.n)));
    assert.ok(c.say && c.say.length > 3, 'read out loud');
    // the help card's picture: the counting card's own (the dots in a ten-frame, or the hop on a number line, landing on
    // the right answer)
    assert.equal(c.pic && c.pic.helper, 'count');
    assert.ok(c.pic.frame || c.pic.line, JSON.stringify(c.pic));
    if (c.pic.frame) assert.equal(c.pic.frame.n, c.targets[good].n);
    else assert.equal(c.pic.line.end, c.targets[good].n);
  }
  // the range's makers: counting for a rider never seen before, the range's own number sense for an older one
  const kinds = share({}, ['counting', 'range']);
  assert.deepEqual(Object.keys(kinds), ['counting'], JSON.stringify(kinds));
  const older = share(at({ number: 50 }), ['counting', 'range']);
  assert.deepEqual(Object.keys(older), ['range'], JSON.stringify(older));
});

test('"Up a step!" only past the highest step reached once placed, not on each up and down of the staircase', () => {
  const r = { skill: { v: 1, migrated: 1, strands: {} } };
  K.setLevel(r, 'mul', 40);
  const at = (lv) => { K.setLevel(r, 'mul', lv); return A.askFor(r, 'times'); };
  assert.equal(A.newBest(r, at(40)), false, 'the first placed step is the start');
  assert.equal(A.newBest(r, at(42)), true, 'a step past it');
  assert.equal(A.newBest(r, at(38)), false, 'down again');
  assert.equal(A.newBest(r, at(42)), false, 'back up to a step reached before: nothing new');
  assert.equal(A.newBest(r, at(45)), true);
  K.setLevel(r, 'div', 30, { placed: false });
  assert.equal(A.newBest(r, A.askFor(r, 'dividing')), false, 'a level still being found: never');
});
