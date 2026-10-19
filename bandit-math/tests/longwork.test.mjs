// Long multiplication and long division worked a step at a time (src/math/longwork.js): every step's answer is the
// real next digit, the four answers are distinct with one right and a nudge on each wrong one, the board shows each
// answer only once it's picked, the two worked examples go step by step as at the board, and every sum the ladder makes needs the
// worked area and sits at its step's point on the Long work strand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { workMul, workDiv, makeLong, LADDER, LONG, longPoint, needsLong, pointOf, mulAt, divAt, addAt, subAt, noCarry, digitsOf, seeded } from '../src/math/longwork.js';
import { MAPS, maxOf, stepAt } from '../src/math/skill.js';

// the board as text rows, every cell that shows once the step being asked is `at`
function grid(w, at = Infinity) {
  const g = Array.from({ length: w.board.rows }, () => Array(w.board.cols).fill(' '));
  for (const c of w.board.cells) if (c.ch && at >= c.from && !(c.kind === 'carry' && c.off != null && at >= c.off)) g[c.r][c.c] = c.ch;
  return g.map((r) => r.join('').replace(/\s+$/, ''));
}
function checkChoices(st, where) {
  assert.equal(st.choices.length, LONG.CHOICES, `${where}: 4 answers`);
  assert.equal(st.choices.filter((c) => c.good).length, 1, `${where}: one right`);
  assert.equal(st.choices.find((c) => c.good).v, st.answer, `${where}: the right one is the answer`);
  assert.equal(new Set(st.choices.map((c) => c.v)).size, st.choices.length, `${where}: no repeats`);
  for (const c of st.choices) if (!c.good) assert.ok(c.why && c.why.length > 8 && !/undefined|NaN/.test(c.why), `${where}: a nudge for ${c.v}: ${c.why}`);
  for (let i = 1; i < st.choices.length; i++) assert.ok(st.choices[i].v > st.choices[i - 1].v, `${where}: in number order`);
  assert.ok(st.choices.every((c) => c.v >= 0), `${where}: nothing below 0`);
}

test('112 ÷ 5 as at the board: "How many times does 5 go into 11?", 2 on top, bring down the 2, 22 r 2', () => {
  const w = workDiv(112, 5);
  assert.deepEqual(w.answer, { q: 22, r: 2 });
  assert.equal(w.steps.length, 2);
  const [a, b] = w.steps;
  assert.equal(a.ask, 'How many times does 5 go into 11?');
  assert.equal(a.answer, 2);
  assert.match(a.intro, /5 doesn't go into 1, so start with 11/);
  // the place on top where the answer goes: over the second digit of 112 (the end of 11)
  const X0 = 2;
  assert.deepEqual(a.slot, { r: 0, c: X0 + 1, w: 1 });
  assert.match(a.done, /2 goes on top\. 2 × 5 = 10, under the 11\. 11 − 10 = 1\. Bring down the 2: 12\./);
  assert.equal(b.ask, 'How many times does 5 go into 12?');
  assert.equal(b.answer, 2);
  assert.match(b.done, /2 is the remainder: 22 r 2/);
  for (const s of w.steps) checkChoices(s, s.ask);
  assert.deepEqual(grid(w), ['   22 r2', '5 112', '  10', '   12', '   10', '    2']);
  // before the first answer: just the problem
  assert.deepEqual(grid(w, 0).filter((r) => r.trim()), ['5 112']);
  assert.equal(w.point, 45);
});

test('a zero in the answer is asked like any digit (4 into 1 is 0), and leaving it out is the slip', () => {
  const w = workDiv(412, 4);
  assert.deepEqual(w.steps.map((s) => [s.ask, s.answer]), [['How many times does 4 go into 4?', 1], ['How many times does 4 go into 1?', 0], ['How many times does 4 go into 12?', 3]]);
  const zero = w.steps[1];
  checkChoices(zero, 'zero step');
  assert.ok(zero.choices.some((c) => c.v === 1 && c.slip === 'zeroSkipped' && /0 goes on top/.test(c.why)));
  assert.equal(grid(w)[0].trim(), '103');
  assert.equal(w.point, 51);
});

test('dividing by a two-digit number: 288 ÷ 12 starts with 28', () => {
  const w = workDiv(288, 12);
  assert.equal(w.steps[0].ask, 'How many times does 12 go into 28?');
  assert.match(w.steps[0].intro, /12 doesn't go into 2, so start with 28/);
  assert.deepEqual(w.steps.map((s) => s.answer), [2, 4]);
  assert.equal(w.point, 58);
});

test('16 × 7 (one day of 8 hands × 2 meals first): 7 × 6 = 42 carries the 4, then 7 × 1 + 4 = 11', () => {
  const w = workMul(16, 7, { lead: { a: 8, b: 2, ask: 'One day first' } });
  assert.deepEqual(w.steps.map((s) => [s.kind, s.ask, s.answer]), [
    ['lead', 'One day first: 8 × 2 = ?', 16], ['mul', '7 × 6 = ?', 42], ['carry', '7 × 1, plus the 4 carried = ?', 11]]);
  assert.equal(w.first, 1, 'the board shows from the long sum on (8 × 2 = 16 would give the 16 away)');
  assert.ok(w.board.cells.every((c) => c.from >= 1));
  assert.match(w.steps[1].done, /Write the 2, carry the 4/);
  const carry = w.steps[2];
  assert.ok(carry.choices.some((c) => c.v === 7 && c.slip === 'carryLost'), 'forgot the carry is an answer');
  assert.deepEqual(grid(w), ['  4', '  16', ' × 7', ' 112'], 'the carried 4 sits over the 1 of 16');
  assert.equal(w.point, 42);
});

test('16 × 24: two rows (a 0 holds the ones place), then adding them; 64 + 32 = 96 (the 0 left out) is the slip', () => {
  const w = workMul(16, 24);
  assert.deepEqual(w.steps.map((s) => s.answer), [24, 6, 12, 3, 384]);
  assert.match(w.steps[2].intro, /a 0 holds the ones place/);
  const sum = w.steps[4];
  assert.equal(sum.kind, 'sum');
  assert.equal(sum.ask, 'Add the rows: 64 + 320 = ?');
  assert.ok(sum.choices.some((c) => c.v === 96 && c.slip === 'noZero'));
  const g = grid(w);
  assert.deepEqual(g.slice(-4), [' ×24', '  64', ' 320', ' 384']);
  // the first row's carry is gone (done with) once the second row starts; the second row's carry shows
  assert.equal(grid(w, 1)[0].trim(), '2', 'the first row\'s carry while it is worked');
  assert.equal(grid(w, 2)[0].trim(), '', 'no carry over the top number as the second row starts');
  assert.equal(grid(w, 3)[0].trim(), '1', 'then the second row\'s');
  assert.equal(w.point, 49);
});

test('every division from 2 to 25 and 10 to 999: the digits on top make the answer, the remainder is the last difference', () => {
  let n = 0;
  for (let d = 2; d <= 25; d++) for (let x = d; x <= 999; x += 7) {
    if (!needsLong('div', x, d)) continue;
    const w = workDiv(x, d), q = Math.floor(x / d), r = x % d;
    const top = w.steps.map((s) => s.answer).join('').replace(/^0+(?=\d)/, '');
    assert.equal(Number(top), q, `${x} ÷ ${d}`);
    for (const s of w.steps) { checkChoices(s, `${x} ÷ ${d}: ${s.ask}`); assert.ok(s.answer >= 0 && s.answer <= 9); assert.ok(s.slot && s.slot.r === 0); }
    // the board never shows a digit before its step is answered: the cell at a step's slot comes in after it
    w.steps.forEach((s, k) => { const at = w.board.cells.find((c) => c.r === s.slot.r && c.c === s.slot.c && c.ch); assert.equal(at.from, k + 1); assert.equal(Number(at.ch), s.answer); });
    const g = grid(w);
    assert.equal(Number(g[g.length - 1].trim()), r, `${x} ÷ ${d}: the last line is the remainder`);
    assert.ok(w.board.cells.every((c) => c.r >= 0 && c.r < w.board.rows && c.c >= 0 && c.c < w.board.cols), 'on the board');
    n++;
  }
  assert.ok(n > 1500, `${n} divisions`);
});

test('every multiplication up to 349 × 39: each row is the top times that digit, the last line is the product', () => {
  let n = 0;
  for (let a = 11; a <= 349; a += 3) for (const b of [3, 7, 9, 12, 16, 24, 38]) {
    if (!needsLong('mul', a, b)) continue;
    const w = workMul(a, b), g = grid(w);
    assert.equal(Number(g[g.length - 1].trim()), a * b, `${a} × ${b}`);
    for (const s of w.steps) checkChoices(s, `${a} × ${b}: ${s.ask}`);
    // every step's slot gets exactly its answer once picked
    w.steps.forEach((s, k) => {
      if (!s.slot) return;
      const cells = w.board.cells.filter((c) => c.r === s.slot.r && c.c >= s.slot.c && c.c < s.slot.c + s.slot.w && c.from === k + 1);
      const v = Number(cells.sort((x, y) => x.c - y.c).map((c) => c.ch).join(''));
      assert.equal(v, s.kind === 'sum' ? a * b : s.answer % 10 ** s.slot.w, `${a} × ${b} step ${k}`);
    });
    n++;
  }
  assert.ok(n > 600, `${n} products`);
});

test('the Long work ladder: every sum made needs the worked area and sits at its step\'s point; the map matches', () => {
  assert.deepEqual(MAPS.long.anchors, LADDER.map((s) => s.at));
  assert.deepEqual(MAPS.long.ids, LADDER.map((s) => s.id));
  assert.equal(maxOf('long'), 64);
  for (let step = 1; step <= LADDER.length; step++) {
    for (let seed = 1; seed <= 3; seed++) {
      const r = seeded(seed * 100 + step);
      for (let i = 0; i < 60; i++) {
        const s = makeLong(step, { rand: r });
        const [x, y] = s.op === 'mul' ? [s.a, s.b] : [s.n, s.d];
        assert.equal(s.op, LADDER[step - 1].op);
        assert.ok(needsLong(s.op, x, y), `${JSON.stringify(s)} needs the worked area`);
        assert.equal(longPoint(s.op, x, y), LADDER[step - 1].at, JSON.stringify(s));
        assert.equal(stepAt('long', longPoint(s.op, x, y)).step, step);
        const w = s.op === 'mul' ? workMul(x, y) : workDiv(x, y);
        assert.ok(w.steps.length >= 2 && w.steps.length <= 8, `${w.line}: ${w.steps.length} steps`);
      }
    }
  }
  // asking for one kind: the nearest step of that kind at or below, else the lowest above
  assert.equal(makeLong(3, { rand: seeded(1), op: 'div' }).step, 2);
  assert.equal(makeLong(1, { rand: seeded(1), op: 'div' }).step, 2);
  assert.equal(makeLong(9, { rand: seeded(1), op: 'mul' }).step, 8);
});

test('where a sum sits: facts in the tables on their own strands, bigger sums on Long work', () => {
  assert.deepEqual(pointOf('mul', 7, 6), { strand: 'mul', at: mulAt(7, 6) });
  assert.ok(mulAt(2, 3) < mulAt(3, 4) && mulAt(3, 4) < mulAt(6, 8) && mulAt(6, 8) < mulAt(7, 12), 'harder tables sit higher');
  assert.equal(mulAt(7, 2), mulAt(2, 7), 'a fact counts at its easier way round');
  assert.deepEqual(pointOf('mul', 16, 7), { strand: 'long', at: 42 });
  assert.deepEqual(pointOf('mul', 12, 10), { strand: 'mul', at: 24 }, 'times 10 is not long (the 10s table)');
  assert.equal(pointOf('mul', 16, 10).strand, 'mul', 'times 10 is not long');
  assert.deepEqual(pointOf('div', 28, 7), { strand: 'div', at: 37 });
  assert.equal(divAt(29, 7), 45, 'a remainder');
  assert.deepEqual(pointOf('div', 112, 5), { strand: 'long', at: 45 });
  assert.equal(pointOf('div', 120, 10).strand, 'div', 'divided by 10 is not long');
  assert.equal(pointOf('div', 84, 20).strand, 'div', 'counting up in 20s is not long');
  assert.equal(pointOf('div', 112, 25).strand, 'div', 'counting up in 25s is not long');
  assert.equal(pointOf('div', 288, 24).strand, 'long');
  assert.equal(addAt(3, 4), 5); assert.equal(addAt(8, 5), 15); assert.equal(addAt(27, 6), 24); assert.equal(addAt(38, 45), 30); assert.equal(addAt(64, 320), 34);
  assert.equal(subAt(9, 1), 0); assert.equal(subAt(13, 5), 19); assert.equal(subAt(52, 27), 30);
  for (const [a, b] of [[21, 3], [16, 7], [112, 5], [16, 24], [124, 36]]) assert.ok(needsLong('mul', a, b), `${a} × ${b}`);
  for (const [a, b] of [[12, 3], [7, 6], [12, 12], [16, 10]]) assert.ok(!needsLong('mul', a, b), `${a} × ${b} is in the tables`);
  assert.equal(noCarry(16, 7), 72);
  assert.deepEqual(digitsOf(412), [4, 1, 2]);
});

test('a nudge never gives the answer away for a times step', () => {
  for (let a = 13; a <= 99; a++) for (let b = 3; b <= 9; b++) {
    if (!needsLong('mul', a, b)) continue;
    for (const s of workMul(a, b).steps) for (const c of s.choices) if (!c.good) assert.ok(!new RegExp(`(=|makes) ${s.answer}([^0-9]|$)`).test(c.why), `${a} × ${b}: "${s.ask}" nudge for ${c.v} says ${s.answer}: ${c.why}`);
  }
});
