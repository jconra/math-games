// The loose-pigs job's math (src/missions/pigmath.js): every pig's sum really comes to its answer, every answer has
// exactly one pen, both pens get a pig, the pens read low to high like a number line: NEGATIVE / POSITIVE for positive &
// negative sums (no zero pen, no pig landing on zero), LESS THAN n / MORE THAN n for the youngest riders' sums; the
// kind and the step come from the rider's skill model; and every wrong pen has its one plain line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makePigBatch, penFor, judge, pigLevel, pigsFor, PIG_MATH } from '../src/missions/pigmath.js';
import { seeded, LADDER as NEG_LADDER } from '../src/math/negatives.js';
import { LADDER as ADD_LADDER } from '../src/math/adding.js';
import { LADDER as TAKE_LADDER } from '../src/math/taking.js';
import { setLevel } from '../src/math/skill.js';

const MINUS = '−';
// what a written sum comes to: '−3 + 8' -> 5, '5 − (−3)' -> 8
const sumOf = (t) => {
  const m = String(t).replace(/−/g, '-').match(/^(-?\d+) ([+-]) \(?(-?\d+)\)?$/);
  assert.ok(m, `a sum we can read: ${t}`);
  const s = +m[1], t2 = +m[3];
  return m[2] === '+' ? s + t2 : s - t2;
};
const rider = (step) => ({ topics: { negatives: { step } } });
const ALL = [...NEG_LADDER.map((_, i) => ['negatives', i + 1]), ...ADD_LADDER.map((_, i) => ['adding', i + 1]), ...TAKE_LADDER.map((_, i) => ['taking', i + 1])];

test('every batch: the sums are right, each pig has one pen, both pens get a pig, pens low to high, none on the split', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const [map, step] of ALL) {
      const b = makePigBatch({}, { map, step, rand: seeded(seed * 31 + step) });
      const where = `seed ${seed} ${map} ${step}`;
      assert.equal(b.pens.length, 2, where);
      assert.equal(b.pigs.length, PIG_MATH.size, where);
      assert.equal(b.mode, map === 'negatives' ? 'signs' : 'sizes', where);
      if (map === 'negatives') assert.equal(b.split, 0, where);
      assert.deepEqual(b.pens.map((p) => p.value), [-1, 1], `${where}: below on the left, above on the right`);
      const texts = new Set();
      for (const p of b.pigs) {
        assert.equal(sumOf(p.text), p.answer, `${where}: ${p.text} = ${p.answer}`);
        assert.equal(p.parts.start + p.parts.change, p.answer, where);
        assert.notEqual(p.answer, b.split, `${where}: ${p.text} lands right on ${b.split}`);
        assert.equal(penFor(b, p.answer), p.pen, `${where}: ${p.text} goes in pen ${p.pen}`);
        assert.ok(!texts.has(p.text), `${where}: ${p.text} twice`);
        texts.add(p.text);
        assert.ok(!/−0|\+ 0$|− 0$/.test(p.text), `${where}: no nothing-sums (${p.text})`);
        if (map !== 'negatives') assert.ok(p.answer >= 0 && !/−\d+ [+−]|\(−/.test(p.text), `${where}: no negatives for the youngest (${p.text})`);
      }
      for (let i = 0; i < 2; i++) assert.ok(b.pigs.some((p) => p.pen === i), `${where}: pen ${i} gets a pig`);
    }
  }
});

test('positive & negative: NEGATIVE / POSITIVE, left to right like the number line, and no zero pen', () => {
  const b = makePigBatch(rider(1), { rand: seeded(5) });
  assert.deepEqual(b.pens.map((p) => p.label), ['NEGATIVE', 'POSITIVE']);
  assert.equal(penFor(b, -4), 0); assert.equal(penFor(b, 7), 1);
  for (let seed = 1; seed <= 60; seed++) for (let step = 1; step <= NEG_LADDER.length; step++) {
    for (const p of makePigBatch({}, { step, rand: seeded(seed + step * 7) }).pigs) assert.notEqual(p.answer, 0, `${p.text}: no pig lands on zero`);
  }
});

test('the youngest: LESS THAN n / MORE THAN n, n a round number in the middle of the step\'s answers', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const b = makePigBatch({}, { map: 'adding', step: 2, rand: seeded(seed) });
    assert.deepEqual(b.pens.map((p) => p.label), [`LESS THAN ${b.split}`, `MORE THAN ${b.split}`]);
    assert.ok(b.split >= 3 && b.split <= 10, `adding up to 10 splits at ${b.split}`);
    const two = makePigBatch({}, { map: 'adding', step: 8, rand: seeded(seed) });
    assert.ok([20, 50, 100].includes(two.split) || two.split % 10 === 0, `two-digit sums split at a ten: ${two.split}`);
  }
});

test('the skill model picks the kind of sum and the step: adding or taking away for the young, positive & negative after', () => {
  const kinds = new Set();
  for (let k = 0; k < 20; k++) kinds.add(pigsFor({}, { rand: () => k / 20 }).map);
  assert.deepEqual([...kinds].sort(), ['adding', 'taking'], 'a rider never seen before');
  const older = {}; setLevel(older, 'add', 70); setLevel(older, 'sub', 70);
  const f = pigsFor(older);
  assert.equal(f.map, 'negatives');
  assert.ok(f.q.step >= 2 && f.q.step <= NEG_LADDER.length, `step ${f.q.step}`);
  // the batch reads the step it is given; an old rider's own step only when none is
  assert.equal(makePigBatch({}, { map: 'negatives', step: 4, rand: seeded(1) }).level, 4);
  assert.equal(pigLevel(rider(4)), 4);
  assert.equal(pigLevel(rider(99)), NEG_LADDER.length);
  assert.equal(pigLevel({}), 1);
});

test('every wrong pen has one plain line that says where the sum really lands and names the right pen', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const [map, step] of [['negatives', 1], ['negatives', 3], ['negatives', 6], ['adding', 2], ['adding', 7], ['taking', 5]]) {
      const b = makePigBatch({}, { map, step, rand: seeded(seed + step * 100) });
      for (const p of b.pigs) {
        for (let i = 0; i < 2; i++) {
          const j = judge(b, p, i);
          assert.equal(j.right, i === p.pen);
          assert.ok(j.line && j.line.length > 10 && j.line.length < 220, `a short line: ${j.line}`);
          assert.ok(!/\n/.test(j.line), 'one line');
          const ans = (p.answer < 0 ? MINUS : '') + Math.abs(p.answer);
          assert.ok(j.line.includes(ans), `the line says where it lands (${ans}): ${j.line}`);
          assert.ok(j.line.includes(b.pens[p.pen].label), `it names the right pen: ${j.line}`);
          if (!j.right) assert.ok(j.line.startsWith(`Not ${b.pens[i].label}`), j.line);
        }
      }
    }
  }
});
