// The loose-pigs job's math (src/missions/pigmath.js): every pig's sum really comes to its answer, every answer has
// exactly one pen, every pen gets a pig, the pens read low to high like a number line, the first steps use the
// NEGATIVE / ZERO / POSITIVE signs and the higher ones real values that are the commonest slips, and every wrong pen has
// its one plain line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makePigBatch, penFor, judge, pigLevel, PIG_MATH } from '../src/missions/pigmath.js';
import { seeded, LADDER as NEG_LADDER, slipsFor } from '../src/math/negatives.js';

const MINUS = '−';
// what a written sum comes to: '−3 + 8' -> 5, '5 − (−3)' -> 8
const sumOf = (t) => {
  const m = String(t).replace(/−/g, '-').match(/^(-?\d+) ([+-]) \(?(-?\d+)\)?$/);
  assert.ok(m, `a sum we can read: ${t}`);
  const s = +m[1], t2 = +m[3];
  return m[2] === '+' ? s + t2 : s - t2;
};
const rider = (step) => ({ topics: { negatives: { step } } });

test('every batch: the sums are right, each pig has one pen, every pen gets a pig, pens low to high', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (let step = 1; step <= NEG_LADDER.length; step++) {
      const b = makePigBatch(rider(step), { rand: seeded(seed * 31 + step) });
      const where = `seed ${seed} step ${step}`;
      assert.equal(b.pens.length, 3, where);
      assert.equal(b.pigs.length, PIG_MATH.size, where);
      assert.equal(b.mode, step <= PIG_MATH.signsUpTo ? 'signs' : 'values', where);
      const values = b.pens.map((p) => p.value);
      assert.deepEqual([...values].sort((x, y) => x - y), values, `${where}: pens read low to high`);
      assert.equal(new Set(values).size, 3, `${where}: three different pens`);
      const texts = new Set();
      for (const p of b.pigs) {
        assert.equal(sumOf(p.text), p.answer, `${where}: ${p.text} = ${p.answer}`);
        assert.equal(p.parts.start + p.parts.change, p.answer, where);
        assert.equal(penFor(b, p.answer), p.pen, `${where}: ${p.text} goes in pen ${p.pen}`);
        assert.ok(!texts.has(p.text), `${where}: ${p.text} twice`);
        texts.add(p.text);
        assert.ok(!/−0|\+ 0$|− 0$/.test(p.text), `${where}: no nothing-sums (${p.text})`);
      }
      for (let i = 0; i < 3; i++) assert.ok(b.pigs.some((p) => p.pen === i), `${where}: pen ${i} gets a pig`);
    }
  }
});

test('the first steps say NEGATIVE / ZERO / POSITIVE, left to right like the number line', () => {
  const b = makePigBatch(rider(1), { rand: seeded(5) });
  assert.deepEqual(b.pens.map((p) => p.label), ['NEGATIVE', 'ZERO', 'POSITIVE']);
  assert.equal(penFor(b, -4), 0); assert.equal(penFor(b, 0), 1); assert.equal(penFor(b, 7), 2);
});

test('real values: the pens are one sum’s answer and its two commonest slips (wrong side of zero, wrong way)', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const step = PIG_MATH.signsUpTo + 1 + (seed % (NEG_LADDER.length - PIG_MATH.signsUpTo));
    const b = makePigBatch(rider(step), { rand: seeded(seed) });
    assert.equal(b.mode, 'values');
    for (const p of b.pens) assert.equal(p.label, (p.value < 0 ? MINUS : '') + Math.abs(p.value));
    // some pig's sum has all three pens as its answer, its sign slip and its wrong-way slip
    const hit = b.pigs.some((p) => {
      const sl = slipsFor(p.parts.start, p.parts.op, p.parts.term);
      return [p.answer, sl.sign, sl.way].sort((x, y) => x - y).join() === b.pens.map((x) => x.value).join();
    });
    assert.ok(hit, `seed ${seed}: pens ${b.pens.map((x) => x.label)} are one sum's slips`);
    // sizes stay near the step's own (a wrong-way pen can be about double a hop)
    const max = NEG_LADDER[step - 1].max;
    for (const p of b.pigs) assert.ok(Math.abs(p.parts.start) <= 2 * max + 6 && Math.abs(p.parts.term) <= 2 * max + 6, `${p.text} at step ${step}`);
  }
});

test('the level follows the kid’s positive & negative step and never goes past the ladder', () => {
  assert.equal(pigLevel({}), 1);
  assert.equal(pigLevel(rider(4)), 4);
  assert.equal(pigLevel(rider(99)), NEG_LADDER.length);
  assert.equal(pigLevel(rider(-3)), 1);
  const r = rider(5); makePigBatch(r, { rand: seeded(2) });
  assert.equal(r.topics.negatives.step, 5, 'the batch reads the step, never moves it');
});

test('every wrong pen has one plain line that says where the hop really lands; the right pen is right', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const step of [1, 2, 3, 4, 6, 7]) {
      const b = makePigBatch(rider(step), { rand: seeded(seed + step * 100) });
      for (const p of b.pigs) {
        for (let i = 0; i < 3; i++) {
          const j = judge(b, p, i);
          assert.equal(j.right, i === p.pen);
          assert.ok(j.line && j.line.length > 10 && j.line.length < 220, `a short line: ${j.line}`);
          assert.ok(!/\n/.test(j.line), 'one line');
          const ans = (p.answer < 0 ? MINUS : '') + Math.abs(p.answer);
          if (!j.right) {
            assert.ok(j.line.includes(ans), `the line says where it lands (${ans}): ${j.line}`);
            if (b.mode === 'values') assert.equal(j.picked, b.pens[i].value);
            else assert.ok(j.line.includes(b.pens[p.pen].label), `it names the right pen: ${j.line}`);
          }
        }
      }
    }
  }
  // the slip this topic is here for, told the topic's way
  const b = { mode: 'values', pens: [{ value: -11, label: '−11' }, { value: -5, label: '−5' }, { value: 5, label: '5' }] };
  const pig = { text: '−3 + 8', parts: { start: -3, change: 8, op: '+', term: 8 }, answer: 5, pen: 2 };
  assert.match(judge(b, pig, 0).line, /You went down 8\. Adding 8 goes UP the line/);
  assert.match(judge(b, pig, 1).line, /wrong side of zero/i);
});
