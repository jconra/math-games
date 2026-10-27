// WORK IT OUT from any job (src/ui/tools.js, src/math/longwork.js): adding and taking away in columns (the carrying and
// borrowing done by the board), the sum read off a question (decimals and dollars and cents too), a story's sum filled in
// with no "What do we work out?" first, decimals in the columns (the points lined up, the point put back in a product,
// the point gone up in a division, a decimal divisor's points moved first), and the times chart's green and red
// (src/ui/timeschart.js marks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { workAdd, workSub, workMul, workDiv, workOf, sumFrom, sumWords, seeded } from '../src/math/longwork.js';
import { sumLabel } from '../src/ui/tools.js';
import { counterOrder } from '../src/math/counter.js';
import { seeded as seedW } from '../src/math/wordproblems.js';
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
  // money in whole cents or dollars: the store's change working ("15¢ and 35¢ change make 50¢: 50¢ − 15¢ = 35¢")
  assert.deepEqual(sumFrom('15¢ and 35¢ change make 50¢: 50¢ − 15¢ = 35¢'), { op: 'sub', a: 50, b: 15 });
  assert.deepEqual(sumFrom('50¢ − 15¢ = 35¢ change'), { op: 'sub', a: 50, b: 15 });
  assert.deepEqual(sumFrom('$20 − $7 = $13'), { op: 'sub', a: 20, b: 7 });
  assert.deepEqual(sumFrom('65¢ and 35¢ change make $1.00: $1.00 − 65¢ = 35¢'), { op: 'sub', a: 100, b: 65 });
  for (const t of ['What + 3 = 8', '3, 6, 9, ?', '3/4 + 1/4', '2x + 5 = 17', '15 − 20', '', null]) assert.equal(sumFrom(t), null, String(t));
  // a sum written with its answer wins over one said along the way
  assert.deepEqual(sumFrom('12 is 4 × 3, so 4 × 4 = 16 cups'), { op: 'mul', a: 4, b: 4 });
  assert.deepEqual(sumFrom('10% of 80 is 8, so 20% is 2 × 8 = 16'), { op: 'mul', a: 2, b: 8 });
});

test('decimals read off a question stay decimals (2.6 is never 26); dollars and cents keep their $', () => {
  assert.deepEqual(sumFrom('3.90 − 1.48 = 2.42 pounds'), { op: 'sub', a: 3.9, b: 1.48 });
  assert.deepEqual(sumFrom('2.6 × 6'), { op: 'mul', a: 2.6, b: 6 });
  assert.deepEqual(sumFrom('6 ÷ 0.5 = 12: 12 bags of 0.5 make 6 pounds'), { op: 'div', a: 6, b: 0.5 });
  assert.deepEqual(sumFrom('$3.45 + $2.80'), { op: 'add', a: 3.45, b: 2.8, money: true, cash: 'ab' });
  assert.deepEqual(sumFrom('$1.30 + $5.75 = $7.05'), { op: 'add', a: 1.3, b: 5.75, money: true, cash: 'ab' });
  assert.deepEqual(sumFrom('2 × $2.75 = $5.50, then $20 − $5.50 = $14.50'), { op: 'mul', a: 2, b: 2.75, money: true, cash: 'b' });
  assert.deepEqual(sumFrom('$1.50 ÷ 10 = $0.15: every digit moves'), { op: 'div', a: 1.5, b: 10, money: true, cash: 'a' });
  // whole dollars shared out unevenly come out in cents: $4.00 ÷ 10 is $0.40, never 0 r 4
  assert.deepEqual(sumFrom('$4.00 ÷ 10 = $0.40'), { op: 'div', a: 4, b: 10, money: true, cash: 'a' });
  assert.equal(workOf(sumFrom('$4.00 ÷ 10 = $0.40')).line, '$4.00 ÷ 10 = $0.40');
  // whole dollars and whole cents stay plain whole numbers
  assert.deepEqual(sumFrom('$80 ÷ 10 = $8'), { op: 'div', a: 80, b: 10 });
  assert.deepEqual(sumFrom('$1.35 ÷ 3 = 45¢: 3 × 45¢ = $1.35'), { op: 'div', a: 135, b: 3 });
  assert.equal(sumWords({ op: 'add', a: 1.3, b: 5.75, money: true, cash: 'ab' }), '$1.30 + $5.75');
  assert.equal(sumLabel({ op: 'mul', a: 2.6, b: 6 }), '2.6 × 6');
});

test('no "What do we work out?" anywhere: a story\'s sum opens straight on the columns, filled in; its button doesn\'t say it', () => {
  const s = { op: 'mul', a: 4, b: 3, story: true };
  const w = workOf(s);
  assert.equal(w.steps[0].kind, 'mul', 'the first step is the sum itself');
  assert.ok(w.steps.every((x) => !/what do we work out/i.test(x.ask)));
  assert.equal(sumLabel(s), 'The sum on this question');
  assert.equal(sumLabel({ op: 'mul', a: 7, b: 8 }), '7 × 8');
  assert.match(sumLabel(null), /Nothing to work out/);
});

// a decimal's whole board once every step is done: each row read left to right, the points put in
function boardText(w, at = w.steps.length) {
  const rows = [];
  for (let r = 0; r < w.board.rows; r++) {
    let out = '';
    for (let c = 0; c < w.board.cols; c++) {
      const cs = w.board.cells.filter((x) => x.r === r && x.c === c && x.from <= at && (x.off == null || x.off > at) && x.kind !== 'from');
      const dig = cs.filter((x) => x.kind !== 'point' && x.kind !== 'carry' && x.kind !== 'borrow'), pt = cs.some((x) => x.kind === 'point');
      out += (dig.length ? dig[dig.length - 1].ch : ' ') + (pt ? '.' : '');
    }
    rows.push(out.replace(/\s+$/, ''));
  }
  return rows;
}
const steps4 = (w) => { for (const s of w.steps) { assert.equal(s.choices.length, 4, s.ask); assert.equal(s.choices.filter((c) => c.good).length, 1, s.ask); assert.equal(new Set(s.choices.map((c) => c.label)).size, 4, s.ask); } };

test('decimals times: multiplied as if there were no points (26 × 6 = 156), then the point put back: 1 digit after it, 15.6', () => {
  const w = workMul(2.6, 6);
  steps4(w);
  assert.deepEqual(w.steps.map((s) => s.ask), ['6 × 6 = ?', '6 × 2, plus the 3 carried = ?', 'Where does the point go in 156?']);
  assert.match(w.steps[0].intro, /as if there were no points: 26 × 6/);
  const pt = w.steps[2];
  assert.equal(pt.kind, 'point');
  assert.deepEqual(pt.choices.map((c) => c.label), ['0.156', '1.56', '15.6', '156'], 'the choices Dad named');
  assert.equal(pt.choices.find((c) => c.good).label, '15.6');
  assert.match(pt.intro, /1 in 2\.6 and none in 6/);
  assert.ok(pt.choices.filter((c) => !c.good).every((c) => c.why.length > 20));
  assert.ok(pt.slot.ring, 'a ring round the answer row (its digits stay in view)');
  assert.equal(w.answer, 15.6); assert.equal(w.line, '2.6 × 6 = 15.6');
  assert.deepEqual(boardText(w).slice(1).map((r) => r.trim()), ['2.6', '× 6', '15.6'], 'the board: 2.6 over × 6, the answer 15.6');
  assert.ok(boardText(w).some((r) => /^ *2\.6$/.test(r)), 'the 2.6 is written with its point');
  // the order the question gives doesn't matter: 6 × 2.6 is the same board
  assert.equal(workMul(6, 2.6).line, '2.6 × 6 = 15.6');
  // the point before the product's digits are all there: 0.3 × 0.2 = 0.06 (the board writes the 0s in front)
  const t = workMul(0.3, 0.2);
  assert.equal(t.steps.at(-1).choices.find((c) => c.good).label, '0.06');
  assert.ok(boardText(t).some((r) => r.trim() === '0.06'), boardText(t).join('|'));
});

test('decimals times: two decimals (1.5 × 2.4: two digits after the point, 3.60), money ($0.80 × 6: $4.80)', () => {
  const w = workMul(1.5, 2.4);
  steps4(w);
  assert.equal(w.steps.at(-2).kind, 'sum', 'the rows added first, as ever');
  assert.equal(w.steps.at(-1).choices.find((c) => c.good).label, '3.60');
  assert.match(w.steps.at(-1).intro, /1 in 1\.5 and 1 in 2\.4\. That's 2 digits/);
  assert.equal(w.answer, 3.6);
  const m = workOf({ op: 'mul', a: 0.8, b: 6, money: true, cash: 'a' });
  steps4(m);
  assert.equal(m.line, '$0.80 × 6 = $4.80');
  assert.deepEqual(m.steps.at(-1).choices.map((c) => c.label), ['$0.48', '$4.80', '$48.00', '$480.00']);
  assert.ok(boardText(m).some((r) => r.trim() === '$4.80'), boardText(m).join('|'));
  assert.ok(boardText(m).some((r) => r.trim() === '$0.80'), 'the $ in front of the price');
});

test('decimals adding and taking away: the points lined up, a 0 put on the end where needed (shown), the point straight down', () => {
  const a = workAdd(5.7, 1.43);
  steps4(a);
  assert.equal(a.line, '5.70 + 1.43 = 7.13');
  assert.match(a.steps[0].intro, /Line up the points.*5\.7 has no hundredths: a 0 holds the place, 5\.70/);
  assert.ok(a.board.cells.some((c) => c.kind === 'pad' && c.ch === '0'), 'the 0 put on is marked (its own colour)');
  assert.match(a.steps.at(-1).done, /The point comes straight down: 7\.13/);
  assert.deepEqual(boardText(a).slice(1).map((r) => r.trim()), ['5.70', '+1.43', '7.13']);
  const m = workOf({ op: 'add', a: 1.3, b: 5.75, money: true, cash: 'ab' });
  steps4(m);
  assert.equal(m.line, '$5.75 + $1.30 = $7.05');
  assert.equal(m.answer, 7.05);
  assert.equal(boardText(m).at(-1).trim(), '$7.05');
  const s = workSub(3.2, 1.75);
  steps4(s);
  assert.equal(s.line, '3.20 − 1.75 = 1.45');
  assert.equal(s.steps[0].ask, '10 − 5 = ?', 'the 0 put on is borrowed into');
  assert.match(s.steps[0].intro, /borrow 1 from the next column/);
  assert.equal(boardText(s).at(-1).trim(), '1.45');
  // less than 1: the 0 in front of the point is written
  assert.equal(boardText(workSub(1.2, 0.75)).at(-1).trim(), '0.45');
  assert.equal(boardText(workAdd(0.3, 0.45)).at(-1).trim(), '0.75');
  // a few hundred of them: always the right answer on the board
  const r = seeded(9);
  for (let k = 0; k < 300; k++) {
    const x = Math.floor(r() * 2000) / 100, y = Math.floor(r() * 2000) / 100;
    const w = workAdd(x, y); steps4(w);
    assert.ok(Math.abs(w.answer - (x + y)) < 1e-9, `${x} + ${y}`);
    assert.equal(Number(boardText(w).at(-1).trim()), Math.round((x + y) * 100) / 100, `${x} + ${y}: ${boardText(w).join('|')}`);
    const [hi, lo] = x >= y ? [x, y] : [y, x], d = workSub(hi, lo);
    if (!d) continue;
    steps4(d);
    assert.equal(Number(boardText(d).at(-1).trim()), Math.round((hi - lo) * 100) / 100, `${hi} − ${lo}: ${boardText(d).join('|')}`);
  }
});

test('decimals divided: a decimal by a whole number (the point straight up: 7.5 ÷ 3 = 2.5), money ($2.20 ÷ 4 = $0.55)', () => {
  const w = workDiv(7.5, 3);
  steps4(w);
  assert.deepEqual(w.steps.map((s) => s.ask), ['How many times does 3 go into 7?', 'How many times does 3 go into 15?']);
  assert.match(w.steps[0].intro, /point goes straight up/);
  assert.equal(w.line, '7.5 ÷ 3 = 2.5'); assert.deepEqual(w.answer, { q: 2.5, r: 0 });
  assert.equal(boardText(w)[0].trim(), '2.5', 'the answer on top, with its point');
  // the point on top is there from the first step, before any digit
  assert.ok(w.board.cells.some((c) => c.r === 0 && c.kind === 'point' && c.from === 0));
  const m = workOf({ op: 'div', a: 2.2, b: 4, money: true, cash: 'a' });
  steps4(m);
  assert.equal(m.line, '$2.20 ÷ 4 = $0.55');
  assert.equal(boardText(m)[0].trim(), '$0.55', 'a 0 in front of the point, the $ on the answer');
  assert.match(m.steps[0].intro, /4 doesn't go into 2: a 0 goes on top/);
  // a 0 put on the end so it comes out even: 7.8 ÷ 4 = 1.95
  const e = workDiv(7.8, 4);
  assert.equal(e.line, '7.8 ÷ 4 = 1.95');
  assert.ok(e.board.cells.some((c) => c.kind === 'pad'), 'the 0 put on, marked');
  // whole numbers stay as ever (a remainder, no point)
  assert.deepEqual(workDiv(112, 5).answer, { q: 22, r: 2 });
  assert.ok(!workDiv(112, 5).board.cells.some((c) => c.kind === 'point'));
});

test('decimals divided by a decimal: both points move first (6 ÷ 0.5 is the same as 60 ÷ 5), a step of its own, then divide', () => {
  const w = workDiv(6, 0.5);
  steps4(w);
  const mv = w.steps[0];
  assert.equal(mv.kind, 'move'); assert.ok(mv.wide, 'sums as answers: two to a row');
  assert.equal(mv.ask, '6 ÷ 0.5 is the same as?');
  assert.equal(mv.choices.find((c) => c.good).label, '60 ÷ 5');
  assert.deepEqual(mv.choices.map((c) => c.label).sort(), ['0.6 ÷ 5', '6 ÷ 5', '60 ÷ 5', '600 ÷ 5']);
  assert.equal(mv.note, '6 ÷ 0.5', 'the sum as given shows over the empty board');
  assert.equal(w.first, 1, 'the board (60 ÷ 5) comes up once the points have moved');
  assert.equal(w.steps[1].ask, 'How many times does 5 go into 6?');
  assert.equal(w.line, '6 ÷ 0.5 = 12');
  assert.ok(w.board.cells.some((c) => c.kind === 'pad' && c.ch === '0'), 'the 0 the move put on 6, marked');
  assert.equal(workDiv(3, 0.25).steps[0].choices.find((c) => c.good).label, '300 ÷ 25');
  assert.equal(workDiv(1.2, 0.3).line, '1.2 ÷ 0.3 = 4');
  assert.equal(workDiv(0.4, 0.2).steps[0].choices.find((c) => c.good).label, '4 ÷ 2');
});

test('the store\'s decimal questions hand Work it out the question\'s own sum, worked to the right coin (the fence boards: 2.6 × 6, never 6 × 26)', () => {
  const kinds = {};
  for (let step = 1; step <= 6; step++) {
    for (let k = 0; k < 60; k++) {
      const o = counterOrder('dec', { step, rand: seedW(500 * step + k) });
      const s = o.sum || sumFrom(o.rightWhy);
      if (!s) continue;
      kinds[o.key.split(':').slice(0, 2).join(':')] = true;
      const w = workOf(s);
      const right = o.coins.find((c) => c.good);
      const got = w.op === 'div' ? w.answer.q : w.answer;
      assert.ok(Math.abs(got * 1e6 - right.v) < 1, `${o.key}: ${o.story} ${o.ask} -> ${w.line}, the coin ${right.label}`);
      if (o.key === 'dec:boards') assert.ok(!Number.isInteger(s.a) && Number.isInteger(s.b), `${o.story}: ${sumWords(s)}`);
    }
  }
  for (const k of ['dec:add', 'dec:sub', 'dec:boards', 'dec:price', 'dec:share', 'dec:bags', 'dec:one', 'dec:many']) assert.ok(kinds[k], `${k} has its sum`);
});

test('the times chart from the tools: 12 x 12, each fact green, yellow or red either way round, counted once', () => {
  const rider = {};
  recordFact(rider, 7, 8, false);
  recordFact(rider, 3, 4, true);
  recordFact(rider, 9, 2, true);
  recordFact(rider, 6, 7, false); recordFact(rider, 7, 6, true);
  const m = chart(rider);
  assert.equal(chartSize({ marks: m }), 12);
  assert.deepEqual(markCount(m), { green: 2, yellow: 1, red: 1 });
  const w = chartWords({ marks: m });
  assert.equal(w.title, 'Your times tables');
  assert.match(w.line, /Green: 2 facts/);
  assert.match(w.line, /Yellow: 1/);
  assert.match(w.line, /Red: 1 missed/);
  assert.match(chartWords({ marks: chart({}) }).line, /turns yellow/);
});
