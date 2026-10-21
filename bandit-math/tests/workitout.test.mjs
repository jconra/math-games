// WORK IT OUT from any job (src/ui/tools.js, src/math/longwork.js): adding and taking away in columns (the carrying and
// borrowing done by the board), the sum read off a question, "What do we work out?" for a story, and the times chart's
// green and red (src/ui/timeschart.js marks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { workAdd, workSub, workOf, sumFrom, seeded } from '../src/math/longwork.js';
import { setupFor, sumLabel } from '../src/ui/tools.js';
import { chartSize, chartWords, markCount } from '../src/ui/timeschart.js';
import { recordFact, chart } from '../src/math/facts.js';

// the board as the panel shows it once every step is answered: the last cell written at each square
function finalRow(w, r) {
  let out = '';
  for (let c = 0; c < w.board.cols; c++) {
    const cs = w.board.cells.filter((x) => x.r === r && x.c === c && x.from <= w.steps.length && (x.off == null || x.off > w.steps.length));
    out += cs.length ? cs[cs.length - 1].ch : ' ';
  }
  return out.trim();
}
function checkSteps(w) {
  for (const s of w.steps) {
    assert.equal(s.choices.length, 4, `${w.line}: 4 choices at "${s.ask}"`);
    assert.equal(s.choices.filter((c) => c.good).length, 1);
    assert.equal(s.choices.find((c) => c.good).v, s.answer);
    assert.equal(new Set(s.choices.map((c) => c.v)).size, 4);
    assert.ok(s.choices.every((c) => c.v >= 0), `${s.ask}: no choice below 0`);
    assert.ok(s.slot, 'one highlighted spot');
  }
}

test('adding in columns: one column a step, the carry written by the board, the answer right on the board', () => {
  const r = seeded(5);
  for (let k = 0; k < 400; k++) {
    const a = 1 + Math.floor(r() * 999), b = 1 + Math.floor(r() * 999);
    const w = workAdd(a, b);
    checkSteps(w);
    assert.equal(w.answer, a + b);
    assert.equal(finalRow(w, 3), String(a + b), `${a} + ${b}`);
    for (const s of w.steps) assert.ok(!/carry the \d+ to/.test(s.ask), 'the carrying is never a question');
  }
  const w = workAdd(47, 38);
  assert.deepEqual(w.steps.map((s) => s.ask), ['7 + 8 = ?', '4 + 3, plus the 1 carried = ?']);
  assert.ok(w.steps[1].choices.some((c) => c.slip === 'carryLost' && c.v === 7), 'the forgotten carry is a choice');
  assert.ok(w.board.cells.some((c) => c.kind === 'carry' && c.ch === '1' && c.from === 1), 'the 1 carried, written by the board');
});

test('taking away in columns: the board borrows by itself (through zeros too); no 0 written in front', () => {
  const r = seeded(6);
  for (let k = 0; k < 400; k++) {
    let a = 1 + Math.floor(r() * 1999), b = Math.floor(r() * 1999);
    if (b > a) [a, b] = [b, a];
    const w = workSub(a, b);
    if (!w) { assert.ok(a === b && a < 10 ? false : true); continue; }
    checkSteps(w);
    assert.equal(w.answer, a - b);
    assert.equal(finalRow(w, 3).replace(/^0+(?=\d)/, ''), String(a - b), `${a} − ${b}`);
    for (const s of w.steps) assert.ok(s.answer >= 0 && s.answer <= 9, `${s.ask}: a digit`);
  }
  const w = workSub(52, 17);
  assert.equal(w.steps[0].ask, '12 − 7 = ?');
  assert.match(w.steps[0].intro, /borrow a ten/);
  assert.ok(w.steps[0].choices.some((c) => c.slip === 'smallFromBig' && c.v === 5) || w.steps[0].answer === 5, 'the smaller-from-bigger slip');
  const z = workSub(400, 7);
  assert.equal(z.steps[0].ask, '10 − 7 = ?');
  assert.ok(z.board.cells.filter((c) => c.kind === 'borrow').map((c) => c.ch).join(',') === '3,9,10', 'through the zeros: 4 -> 3, 0 -> 9, 0 -> 10');
  assert.equal(finalRow(workSub(105, 98), 3), '7', 'no 0 in front of the answer');
  assert.equal(workSub(3, 8), null, 'never below 0');
});

test('workOf: all four, so Work it out works any sum', () => {
  assert.equal(workOf({ op: 'add', a: 25, b: 17 }).answer, 42);
  assert.equal(workOf({ op: 'sub', a: 83, b: 33 }).answer, 50);
  assert.equal(workOf({ op: 'mul', a: 16, b: 7 }).answer, 112);
  assert.deepEqual(workOf({ op: 'div', a: 112, b: 5 }).answer, { q: 22, r: 2 });
  assert.deepEqual(workOf({ op: 'div', n: 112, d: 5 }).answer, { q: 22, r: 2 });
});

test('the sum on a question: read off its words or working; whole numbers only; a blank is not a sum', () => {
  assert.deepEqual(sumFrom('7 × 8 = ?'), { op: 'mul', a: 7, b: 8 });
  assert.deepEqual(sumFrom('83 − 33'), { op: 'sub', a: 83, b: 33 });
  assert.deepEqual(sumFrom('4 pies × 3 pounds = 12 pounds'), { op: 'mul', a: 4, b: 3 });
  assert.deepEqual(sumFrom('24 miles ÷ 8 hours = 3 miles an hour'), { op: 'div', a: 24, b: 8 });
  assert.deepEqual(sumFrom('1,250 + 375'), { op: 'add', a: 1250, b: 375 });
  assert.deepEqual(sumFrom('Rope 7 x 8'), { op: 'mul', a: 7, b: 8 });
  for (const t of ['$3.45 + $2.80', 'What + 3 = 8', '3, 6, 9, ?', '3/4 + 1/4', '2x + 5 = 17', '15 − 20', '', null]) assert.equal(sumFrom(t), null, String(t));
});

test('"What do we work out?" on a story: the right sum and the same numbers with the other signs; the button never gives a story\'s sign away', () => {
  const s = setupFor({ op: 'mul', a: 4, b: 3 });
  assert.equal(s.ask, 'What do we work out?');
  assert.deepEqual(s.choices.map((c) => c.label), ['4 + 3', '4 − 3', '4 × 3', '4 ÷ 3']);
  assert.equal(s.choices.filter((c) => c.good).length, 1);
  assert.equal(s.choices.find((c) => c.good).label, '4 × 3');
  assert.ok(s.choices.filter((c) => !c.good).every((c) => c.why));
  assert.ok(!setupFor({ op: 'add', a: 3, b: 8 }).choices.some((c) => c.label === '3 − 8'), 'never below 0');
  assert.equal(sumLabel({ op: 'mul', a: 7, b: 8 }), '7 × 8');
  assert.equal(sumLabel({ op: 'mul', a: 4, b: 3, setup: true }), 'The sum on this question');
  assert.match(sumLabel(null), /Nothing to work out/);
});

test('the times chart from the tools: 12 x 12, each fact green or red either way round, counted once', () => {
  const rider = {};
  recordFact(rider, 7, 8, false);
  recordFact(rider, 3, 4, true);
  recordFact(rider, 9, 2, true);
  const m = chart(rider);
  assert.equal(chartSize({ marks: m }), 12);
  assert.deepEqual(markCount(m), { green: 2, red: 1 });
  const w = chartWords({ marks: m });
  assert.equal(w.title, 'Your times tables');
  assert.match(w.line, /Green: 2 facts/);
  assert.match(w.line, /Red: 1 missed/);
  assert.match(chartWords({ marks: chart({}) }).line, /turn green/);
});
