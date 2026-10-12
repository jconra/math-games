// Tests for the lock boxes: run with  node --test tests/lockbox.test.mjs  (from bandit-math/).
// LOCKBOX_FUZZ=3 multiplies the fuzz counts.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lockbox/engine.js';
import { generate, makeRng, RUNGS, RUNG, verdictOf, VERDICT } from '../src/lockbox/generate.js';
import { buildButtons } from '../src/lockbox/buttons.js';
import { makeBox, starsFor, goldFor } from '../src/lockbox/box.js';
import { makeAlgebra, ARITH_LEVEL, NUMBER_LINE_SHOWS } from '../src/lockbox/algebra.js';
import { tidyChoices, slipLine, sumsOf } from '../src/lockbox/tidy.js';

const { F, num, xt, br, line, lineText, applyMove, addNum, addX, divBy, mulBy, FLIP, DIST, COMB, solve, lineKey,
  legalMoves, lineFits, trueAnswer, printedNumbers, allValues, keySteps, evalSide, isSolved, solvedValue } = E;

const SCALE = Number(process.env.LOCKBOX_FUZZ || 1);
const MOVE_RUNGS = RUNGS.filter((r) => r.stage);
const HEAVY = new Set(['R13', 'R14', 'R15']);
const fuzzCount = (id) => Math.round((HEAVY.has(id) ? 1000 : 2000) * SCALE);
const MINUS = '−';

// A display string must read like school writes it.
function assertClean(s, where) {
  assert.ok(!/\+ ?[-−]/.test(s), `"+ −" in ${s} (${where})`);
  assert.ok(!/[-−] ?[-−]/.test(s), `"− −" in ${s} (${where})`);
  assert.ok(!/(^|[^0-9/])1x/.test(s), `"1x" in ${s} (${where})`);
  assert.ok(!/(^|[^0-9])0x/.test(s), `"0x" in ${s} (${where})`);
  assert.ok(!s.includes('-'), `a hyphen instead of a minus in ${s} (${where})`);
  assert.ok(!/×/.test(s), `a times cross in ${s} (${where})`);
  assert.ok(!s.includes('undefined') && !s.includes('NaN'), `junk in ${s} (${where})`);
}

// ---------- fractions and writing ----------

test('fractions are exact and reduced', () => {
  assert.equal(`${F(6, 8)}`, '3/4');
  assert.equal(`${F(-6, -8)}`, '3/4');
  assert.equal(`${F(6, -8)}`, '-3/4');
  assert.ok(F(1, 3).add(F(1, 6)).eq(F(1, 2)));
  assert.ok(F(1, 3).mul(F(3)).isOne());
  assert.ok(F(0, 5).eq(F(0)));
  assert.equal(Object.is(F(0).n, -0), false);
  assert.throws(() => F(1, 0));
  assert.throws(() => F(1).div(F(0)));
});

test("The brief's example: 4x − 6 = −8x + 18 is par 3 and plays out like the brief", () => {
  const st = RUNG.R13.stage;
  const l = line([xt(4), num(-6)], [xt(-8), num(18)]);
  assert.equal(lineText(l), `4x ${MINUS} 6 = ${MINUS}8x + 18`);
  const s = solve(l, st);
  assert.equal(s.d, 3);
  const a = applyMove(l, addNum(6), true);
  assert.equal(lineText(a.mid), `4x ${MINUS} 6 + 6 = ${MINUS}8x + 18 + 6`);
  assert.equal(lineText(a.out), `4x = ${MINUS}8x + 24`);
  assert.equal(a.ev.L[0].text, `${MINUS}6 + 6 = 0`);
  assert.equal(a.ev.R[0].text, '18 + 6 = 24');
  const b = applyMove(a.out, addX(8), true);
  assert.equal(lineText(b.out), '12x = 24');
  const c = applyMove(b.out, divBy(12), true);
  assert.equal(lineText(c.out), 'x = 2');
  assert.ok(isSolved(c.out));
  // −4x first is also a shortest route
  const d = applyMove(l, addX(-4));
  assert.equal(lineText(d.out), `${MINUS}6 = ${MINUS}12x + 18`);
  assert.equal(solve(d.out, st).d, 2);
  // the trap −6 plays honestly
  const t = applyMove(l, addNum(-6), true);
  assert.equal(lineText(t.out), `4x ${MINUS} 12 = ${MINUS}8x + 12`);
  assert.equal(t.ev.L[0].text, `${MINUS}6 ${MINUS} 6 = ${MINUS}12`);
  assert.equal(solve(t.out, st).d, 3);
});

test('writing terms: x not 1x, x/4, brackets, opposites', () => {
  assert.equal(lineText(line([xt(1), num(4)], [num(9)])), 'x + 4 = 9');
  assert.equal(lineText(line([xt(-1), num(5)], [num(12)])), `${MINUS}x + 5 = 12`);
  assert.equal(lineText(line([num(5), xt(-1)], [num(12)])), `5 ${MINUS} x = 12`);
  assert.equal(lineText(line([xt(F(1, 4))], [num(3)])), 'x/4 = 3');
  assert.equal(lineText(line([xt(F(-3, 4))], [num(3)])), `${MINUS}3x/4 = 3`);
  assert.equal(lineText(line([br(3, [xt(1), num(2)])], [num(18)])), '3(x + 2) = 18');
  assert.equal(lineText(line([br(-1, [xt(1), num(-2)])], [num(18)])), `${MINUS}(x ${MINUS} 2) = 18`);
  assert.equal(lineText(line([xt(21)], [num(42)])), '21x = 42');
  assert.equal(E.moveLabel(mulBy(-3)), '·(−3)');
  assert.equal(E.moveLabel(divBy(-4)), '÷(−4)');
  assert.equal(E.moveLabel(FLIP), '·(−1)');
  assert.equal(E.moveLabel(addX(-1)), `${MINUS}x`);
});

test('−x = 7 is not solved, x = 7 and 7 = x are', () => {
  assert.equal(isSolved(line([xt(-1)], [num(7)])), false);
  assert.ok(E.isOppositeOfX(line([xt(-1)], [num(7)])));
  assert.ok(isSolved(line([xt(1)], [num(7)])));
  assert.ok(solvedValue(line([num(-7)], [xt(1)])).eq(F(-7)));
  assert.equal(isSolved(line([xt(1)], [num(7), num(1)])), false);
});

test('division opens a bracket, distribute and combine work', () => {
  const l = line([br(3, [xt(1), num(2)])], [num(18)]);
  assert.equal(lineText(applyMove(l, divBy(3)).out), 'x + 2 = 6');
  const d = applyMove(l, DIST, true);
  assert.equal(lineText(d.out), '3x + 6 = 18');
  assert.equal(d.ev.L[0].text, '3(x + 2) = 3·x + 3·2 = 3x + 6');
  const c = applyMove(line([xt(3), num(2), xt(2)], [num(17)]), COMB, true);
  assert.equal(lineText(c.out), '5x + 2 = 17');
  assert.equal(c.ev.L[0].text, '3x + 2x = 5x');
  // the inside number is not cancelled by taking it away outside
  assert.equal(lineText(applyMove(l, addNum(-2)).out), `3(x + 2) ${MINUS} 2 = 16`);
  // a side that empties shows 0
  assert.equal(lineText(applyMove(line([xt(4)], [xt(-8), num(24)]), addX(-4)).out), `0 = ${MINUS}12x + 24`);
});

// ---------- every rung, fuzzed ----------

for (const rung of MOVE_RUNGS) {
  test(`${rung.id} ${rung.name}: ${fuzzCount(rung.id)} problems hold every rule`, () => {
    const rng = makeRng(1000 + RUNGS.indexOf(rung));
    const st = rung.stage;
    const recent = [];
    const pars = new Map();
    for (let i = 0; i < fuzzCount(rung.id); i++) {
      const p = generate(rung.id, { rng, size: 1 + (i % 3), recent });
      assert.ok(p, 'generate returned a problem');
      assert.ok(!recent.includes(p.key), `repeat of one of the last 20: ${p.key}`);
      recent.push(p.key); if (recent.length > 20) recent.shift();
      const l = p.start;
      const text = lineText(l);
      assertClean(text, rung.id);
      assert.ok(lineFits(l, st), `start fits: ${text}`);
      for (const v of allValues(l)) assert.ok(Math.abs(v.n) <= 99 && v.d <= 99, `±99: ${text}`);
      for (const t of [...l.L, ...l.R]) if (t.t === 'n') assert.ok(!t.v.isZero(), `zero constant: ${text}`);
      const truth = trueAnswer(l);
      if (p.kind === 'one') {
        assert.equal(truth.kind, 'one', text);
        assert.ok(truth.x.isInt(), `integer answer: ${text}`);
        assert.ok(truth.x.eq(F(p.x)), `answer ${p.x}: ${text}`);
        assert.ok(evalSide(l.L, truth.x).eq(evalSide(l.R, truth.x)), `x fits: ${text}`);
        if (p.x !== 0) assert.ok(!printedNumbers(l).has(Math.abs(p.x)), `x printed: ${text}`);
        // the route reaches x = N, every line on it fits the rung (so every in-between value is within ±99)
        let cur = l;
        const s = solve(l, st);
        assert.equal(s.d, p.par, text);
        assert.ok(p.par >= 1 && p.par <= rung.maxPar, `par ${p.par} on ${text}`);
        assert.equal(s.path.length, p.par);
        for (const m of s.path) {
          const r = applyMove(cur, m);
          assert.ok(r && lineFits(r.out, st), `route stays in the rung: ${text}`);
          cur = r.out;
          assertClean(lineText(cur), `${rung.id} route`);
        }
        assert.ok(isSolved(cur) && solvedValue(cur).eq(F(p.x)), `route ends at x = ${p.x}: ${text}`);
      } else {
        assert.equal(truth.kind, p.kind, text);
      }
      pars.set(p.par, (pars.get(p.par) || 0) + 1);
    }
    assert.ok(pars.size >= 1);
  });
}

// ---------- the search agrees with brute force ----------
// 1) "closer" taken from one search matches judging every next line on its own, at the start and after random
//    presses (the lines kids actually see), and the smaller usefulMoves set never beats the every-move search;
// 2) an independent brute force over a much wider move set (every number −25..25, every x-term −12x..12x, · and ÷ by
//    ±2..±12, the flip, brackets, combine) finds no shorter route.

function bruteNoShorter(l, st, below) {
  const moves = [];
  for (let v = -25; v <= 25; v++) if (v) moves.push(addNum(v));
  if (st.addx) for (let v = -12; v <= 12; v++) if (v) moves.push(addX(v));
  if (st.mul) for (let v = 2; v <= 12; v++) { moves.push(mulBy(v)); if (st.sign === 'any') moves.push(mulBy(-v)); }
  if (st.div) for (let v = 2; v <= 12; v++) { moves.push(divBy(v)); if (st.sign === 'any') moves.push(divBy(-v)); }
  if (st.flip) moves.push(FLIP);
  if (st.dist) moves.push(DIST);
  if (st.comb) moves.push(COMB);
  let layer = [l];
  const seen = new Set([lineKey(l)]);
  for (let d = 1; d < below; d++) {
    const next = [];
    for (const x of layer) {
      for (const m of moves) {
        const r = applyMove(x, m);
        if (!r || !lineFits(r.out, st)) continue;
        const k = lineKey(r.out);
        if (seen.has(k)) continue;
        seen.add(k);
        if (isSolved(r.out)) return { found: d, line: lineText(r.out) };
        next.push(r.out);
      }
    }
    layer = next;
  }
  return null;
}

for (const rung of MOVE_RUNGS.filter((r) => r.id !== 'R15')) {
  test(`${rung.id}: the search agrees with a wide brute force and with judging each next line on its own`, () => {
    const rng = makeRng(77 + RUNGS.indexOf(rung));
    const st = rung.stage;
    // R14 lines wander far after random presses and every one of them is searched move by move: fewer of those
    const n = Math.round((rung.id === 'R14' ? 10 : HEAVY.has(rung.id) ? 40 : 120) * SCALE);
    for (let i = 0; i < n; i++) {
      const p = generate(rung.id, { rng, size: 1 + (i % 3) });
      let cur = p.start;
      for (let step = 0; step < 3; step++) {
        const s = solve(cur, st);
        const where = lineText(cur);
        // every legal move is tried, so the smaller move set can never find a shorter route
        assert.ok(s.d <= solve(cur, st, { useful: true }).d, `useful set shorter on ${where}`);
        if (!s.approx && Number.isFinite(s.d)) {
          // "closer" from one search = the next lines whose own fewest-moves count is one less, judged one by one
          const good = new Set(E.closerMoves(cur, st).closer.map((c) => c.key));
          for (const c of legalMoves(cur, st)) {
            const own = solve(c.out, st);
            if (own.approx && own.d !== s.d - 1) continue;   // a far-off line with only an upper bound: can't judge
            assert.equal(good.has(c.key), own.d === s.d - 1, `${E.moveLabel(c.move)} on ${where}: own ${own.d}, line ${s.d}`);
          }
        }
        // nothing shorter with every number −25..25, every x-term −12x..12x, · and ÷ by ±2..±12
        if (s.d <= 3) {
          const b = bruteNoShorter(cur, st, s.d);
          assert.equal(b, null, `brute force found a shorter route on ${where}: ${JSON.stringify(b)}`);
        }
        const legal = legalMoves(cur, st);
        if (!legal.length) break;
        cur = legal[Math.floor(rng.next() * legal.length)].out;
      }
    }
  });
}

test('a clever first move counts: −22 on 2(x + 6) − x = 3x + 22 (then −x, ÷2, combine)', () => {
  const st = RUNG.R14.stage;
  const l = line([br(2, [xt(1), num(6)]), xt(-1)], [xt(3), num(22)]);
  const s = solve(l, st);
  assert.equal(s.d, 4);
  const after = applyMove(l, addNum(-22)).out;
  assert.equal(solve(after, st).d, 3);
  assert.ok(E.closerMoves(l, st).closer.some((c) => c.key === lineKey(after)), '−22 is closer');
  // the smaller move set misses it, which is why the game never judges with it
  assert.equal(solve(after, st, { useful: true }).d, 4);
});

test('vault verdicts: the quick last step agrees with trying every move', () => {
  const st = RUNG.R15.stage;
  const rng = makeRng(61);
  const all = { goal: VERDICT.goal, goalId: 'verdict-every-move', maxDepth: 5 };
  let n = 0;
  for (let i = 0; i < 150 * SCALE; i++) {
    const p = generate('R15', { rng, size: 1 + (i % 3) });
    if (p.kind === 'one') continue;
    let cur = p.start;
    for (let step = 0; step < 3; step++) {
      const a = solve(cur, st, { ...VERDICT, maxDepth: 5 }), b = solve(cur, st, all);
      if (!a.approx && !b.approx) { assert.equal(a.d, b.d, `verdict distance on ${lineText(cur)}`); n++; }
      const legal = legalMoves(cur, st);
      if (!legal.length) break;
      cur = legal[Math.floor(rng.next() * legal.length)].out;
    }
  }
  assert.ok(n > 100, `compared ${n}`);
});

// ---------- buttons ----------

for (const rung of MOVE_RUNGS.filter((r) => r.id !== 'R15')) {
  test(`${rung.id}: button sets have a productive move, no twins, no forbidden moves, through random play`, () => {
    const rng = makeRng(555 + RUNGS.indexOf(rung));
    const st = rung.stage;
    const n = Math.round((rung.id === 'R14' ? 40 : HEAVY.has(rung.id) ? 150 : 300) * SCALE);
    for (let i = 0; i < n; i++) {
      const p = generate(rung.id, { rng, size: 1 + (i % 3) });
      let cur = p.start;
      for (let step = 0; step < 6 && !isSolved(cur); step++) {
        const count = 2 + (step % 3);
        const bb = buildButtons(cur, st, { count, rng, fav: ['sign', 'undo', 'part', null][i % 4] });
        const shown = bb.slots.filter(Boolean);
        assert.equal(bb.slots.length, 4);
        const d = solve(cur, st).d;
        if (!Number.isFinite(d)) break;
        assert.ok(shown.some((b) => b.role === 'good'), `no productive button on ${lineText(cur)}`);
        assert.ok(shown.length >= Math.min(2, bb.all.length) && shown.length <= count, `count ${shown.length} for ${count}`);
        assert.equal(new Set(shown.map((b) => b.key)).size, shown.length, `two buttons with the same effect on ${lineText(cur)}`);
        for (const b of shown) {
          assertClean(b.label, 'button');
          assert.ok(!/[÷·]\(?−?0\)?$/.test(b.label), `÷0 or ·0: ${b.label}`);
          assert.ok(!/[÷·].*x/.test(b.label), `·x or ÷x: ${b.label}`);
          const r = applyMove(cur, b.move);
          assert.ok(r && lineFits(r.out, st), `button ${b.label} breaks the rung on ${lineText(cur)}`);
          const dd = solve(r.out, st).d;
          if (b.role === 'good') assert.equal(dd, d - 1, `good ${b.label} on ${lineText(cur)}`);
          else assert.ok(!(dd < d), `${b.role} ${b.label} is actually closer on ${lineText(cur)}`);
        }
        // + and − on the top row, · and ÷ on the bottom row (unless a row overflows)
        const top = bb.slots.slice(0, 2).filter(Boolean), bottom = bb.slots.slice(2).filter(Boolean);
        if (shown.filter((b) => b.move.k === 'add').length <= 2) assert.ok(bottom.every((b) => b.move.k !== 'add'), 'an add on the bottom row');
        if (shown.filter((b) => b.move.k !== 'add').length <= 2) assert.ok(top.every((b) => b.move.k === 'add'), 'a ÷ on the top row');
        // a row only overflows when the line has nothing left for the other row
        const nonAdd = (b) => b.move.k !== 'add';
        if (shown.filter((b) => !nonAdd(b)).length > 2) assert.ok(bb.all.filter(nonAdd).every((b) => shown.includes(b)), `adds overflow but a ·/÷ was left out on ${lineText(cur)}`);
        if (shown.filter(nonAdd).length > 2) assert.ok(bb.all.filter((b) => !nonAdd(b)).every((b) => shown.includes(b)), `·/÷ overflow but an add was left out on ${lineText(cur)}`);
        // press a random shown button (kids do)
        const pickB = shown[Math.floor(rng.next() * shown.length)];
        cur = applyMove(cur, pickB.move).out;
      }
    }
  });
}

test('the right button moves between slots', () => {
  const st = RUNG.R13.stage;
  const rng = makeRng(9);
  const l = line([xt(4), num(-6)], [xt(-8), num(18)]);
  const where = new Set();
  for (let i = 0; i < 60; i++) {
    const bb = buildButtons(l, st, { count: 4, rng });
    where.add(bb.slots.findIndex((b) => b && b.role === 'good'));
  }
  assert.ok(where.size >= 2, `good slot always ${[...where]}`);
});

test('kid’s favourite trap shows up when asked for', () => {
  const st = RUNG.R3.stage;
  const rng = makeRng(3);
  const l = line([xt(12)], [num(24)]);
  let undo = 0, part = 0;
  for (let i = 0; i < 100; i++) {
    const bb = buildButtons(l, st, { count: 2, rng, fav: 'part' });
    const t = bb.slots.filter(Boolean).find((b) => b.role !== 'good');
    if (t && t.tag === 'part') part++;
    if (t && t.tag === 'undo') undo++;
  }
  assert.ok(part > 80, `part trap ${part}/100`);
});

// ---------- a box played through: undo, jam rewind, hints, stars, the check ----------

test('undo restores the exact line; the press still counts', () => {
  const p = { rung: 'R13', mode: 'moves', kind: 'one', start: line([xt(4), num(-6)], [xt(-8), num(18)]), x: 2, par: 3 };
  const B = makeBox(p, { stage: RUNG.R13.stage, level: 4, rng: makeRng(1) });
  const before = lineText(B.line);
  B.press(addNum(-6));
  assert.equal(B.moves, 1);
  assert.ok(B.undo());
  assert.equal(lineText(B.line), before);
  assert.equal(lineKey(B.line), lineKey(p.start));
  assert.equal(B.moves, 1);
  assert.equal(B.undo(), false);
});

test('jam guard: 3 not-closer presses rewind to the last good line and open hint 1', () => {
  const p = { rung: 'R13', mode: 'moves', kind: 'one', start: line([xt(4), num(-6)], [xt(-8), num(18)]), x: 2, par: 3 };
  const B = makeBox(p, { stage: RUNG.R13.stage, level: 4, rng: makeRng(1) });
  const r1 = B.press(addNum(6));
  assert.ok(r1.closer);
  const good = lineText(B.line);
  const goodKey = lineKey(B.line);
  B.press(addNum(-24));
  B.press(addNum(-3));
  const r = B.press(addNum(5));
  assert.ok(r.jam, 'jammed');
  assert.equal(lineText(B.line), good);
  assert.equal(lineKey(B.line), goodKey);
  assert.equal(B.hintLevel, 1);
  assert.ok(B.jammed);
  assert.equal(B.ledger.filter((e) => e.struck).length, 3);
  // finishing from here is still possible and the box is not clean
  B.press(addX(8)); B.press(divBy(12));
  assert.ok(B.solved);
  const f = B.finish();
  assert.equal(f.clean, false);
  assert.equal(f.moves, 6);
});

test('jam guard: moves past par + 3 rewind once, only on a not-closer press', () => {
  const st = RUNG.R6.stage;
  const p = { rung: 'R6', mode: 'moves', kind: 'one', start: line([xt(2), num(5)], [num(17)]), x: 6, par: 2 };
  const B = makeBox(p, { stage: st, level: 4, rng: makeRng(2) });
  const seq = [[1, false], [-6, true], [2, false], [-2, true], [3, false], [-3, true]];
  for (const [v, closer] of seq) { const r = B.press(addNum(v)); assert.equal(r.closer, closer, `${v}`); assert.equal(r.jam, null, `${v}`); }
  assert.equal(B.moves, 6);
  assert.equal(lineText(B.line), '2x = 12');
  const r = B.press(addNum(4));        // move 7, past par + 3, not closer: jams
  assert.ok(r.jam);
  assert.equal(lineText(B.line), '2x = 12');
  const r2 = B.press(addNum(4));       // only once
  assert.equal(r2.jam, null);
  // a press that IS closer never jams, even far past par
  const B2 = makeBox(p, { stage: st, level: 4, rng: makeRng(2) });
  for (const [v] of seq) B2.press(addNum(v));
  assert.equal(B2.press(divBy(2)).jam, null);   // move 7, but closer
  assert.ok(B2.solved);
});

test('jam guard keeps progress made after an earlier slip', () => {
  const st = RUNG.R13.stage;
  const p = { rung: 'R13', mode: 'moves', kind: 'one', start: line([xt(4), num(-6)], [xt(-8), num(18)]), x: 2, par: 3 };
  const B = makeBox(p, { stage: st, level: 4, rng: makeRng(1) });
  B.press(addNum(-6));                 // slip: 4x − 12 = −8x + 12
  B.press(addNum(12));                 // closer: 4x = −8x + 24
  const keep = lineText(B.line);
  B.press(addNum(3)); B.press(addNum(-1));
  const r = B.press(addNum(2));
  assert.ok(r.jam);
  assert.equal(lineText(B.line), keep);
});

test('stars and gold follow the table, never 0 for a finish', () => {
  assert.equal(starsFor(3, 3), 3);
  assert.equal(starsFor(4, 3), 2);
  assert.equal(starsFor(5, 3), 2);
  assert.equal(starsFor(6, 3), 1);
  assert.equal(starsFor(20, 3), 1);
  assert.equal(starsFor(3, 3, 2), 2);
  assert.equal(starsFor(3, 3, 3), 1);
  assert.equal(goldFor('tin', 3), 10);
  assert.equal(goldFor('iron', 2), 16);
  assert.equal(goldFor('brass', 1), 21);
  assert.equal(goldFor('vault', 3), 60);
  assert.equal(goldFor('vault', 2), 48);
});

test('hints climb Look → Rule → Show and cap the stars', () => {
  const p = { rung: 'R7', mode: 'moves', kind: 'one', start: line([xt(5), num(-4)], [num(-19)]), x: -3, par: 2 };
  const B = makeBox(p, { stage: RUNG.R7.stage, level: 3, rng: makeRng(4) });
  const h1 = B.hint();
  assert.equal(h1.level, 1);
  assert.ok(h1.targets.some((t) => t.side === 'L' && t.index === 1), 'the −4 wiggles');
  const h2 = B.hint();
  assert.equal(h2.level, 2);
  assert.ok(B.canLeave(0));
  const h3 = B.hint();
  assert.equal(h3.level, 3);
  assert.ok(B.buttons.slots.some((b) => b && b.key === h3.key));
  B.press(addNum(4)); B.press(divBy(5));
  assert.ok(B.solved);
  assert.equal(B.finish().stars, 1);
  assert.equal(B.finish().clean, false);
});

test('the check works out both sides of the ORIGINAL line', () => {
  const l = line([xt(4), num(-6)], [xt(-8), num(18)]);
  assert.deepEqual(keySteps(l.L, F(2)), ['4·2 − 6', '8 − 6', '2']);
  assert.deepEqual(keySteps(l.R, F(2)), ['−8·2 + 18', '−16 + 18', '2']);
  assert.deepEqual(keySteps([br(2, [xt(1), num(3)])], F(5)), ['2(5 + 3)', '2·8', '16']);
  assert.deepEqual(keySteps([xt(1), num(3)], F(-2)), ['−2 + 3', '1']);
  assert.deepEqual(keySteps([xt(F(1, 3)), num(4)], F(21)), ['21/3 + 4', '7 + 4', '11']);
  const rng = makeRng(31);
  for (const rung of MOVE_RUNGS.filter((r) => r.id !== 'R15')) {
    for (let i = 0; i < 200 * SCALE; i++) {
      const p = generate(rung.id, { rng, size: 1 + (i % 3) });
      const x = F(p.x);
      const a = keySteps(p.start.L, x), b = keySteps(p.start.R, x);
      assert.equal(a[a.length - 1], b[b.length - 1], `key ${p.x} on ${lineText(p.start)}: ${a} vs ${b}`);
      a.concat(b).forEach((s) => assertClean(s, 'key steps'));
      const wrong = keySteps(p.start.L, x.add(F(1))).pop() === keySteps(p.start.R, x.add(F(1))).pop();
      assert.equal(wrong, false, `a wrong key fits ${lineText(p.start)}`);
    }
  }
});

test('a whole box played by the best route: 3 stars, clean, key passes', () => {
  const rng = makeRng(12);
  for (const rung of MOVE_RUNGS.filter((r) => r.id !== 'R15')) {
    for (let i = 0; i < 30; i++) {
      const p = generate(rung.id, { rng, size: 2 });
      const B = makeBox(p, { stage: rung.stage, level: 4, rng, tier: 'iron' });
      let guard = 0;
      while (!B.solved && guard++ < 10) {
        const g = B.buttons.slots.find((b) => b && b.role === 'good');
        assert.ok(g, `no good button on ${lineText(B.line)}`);
        const r = B.press(g.move);
        assert.ok(r.closer);
        B.makeButtons();
      }
      assert.ok(B.solved, lineText(p.start));
      const kt = B.keyTest();
      assert.ok(kt.x.eq(F(p.x)));
      assert.equal(kt.left[kt.left.length - 1], kt.right[kt.right.length - 1]);
      B.keyResult(true);
      const f = B.finish();
      assert.equal(f.stars, 3);
      assert.equal(f.gold, 20);
      // the box's par is the fewest moves, or the steps card's count where that is longer (3(x + 2) = 18 opens the
      // brackets first); a productive button never needs more than that
      assert.ok(f.moves >= p.par && f.moves <= B.par, `${lineText(p.start)}: ${f.moves} moves, par ${p.par}/${B.par}`);
      assert.ok(f.clean);
    }
  }
});

test('R15 vault boxes: verdicts and the x = 0 box', () => {
  const rng = makeRng(15);
  const st = RUNG.R15.stage;
  let all = 0, none = 0, one = 0;
  for (let i = 0; i < 300; i++) {
    const p = generate('R15', { rng, size: 2 });
    const B = makeBox(p, { stage: st, level: 4, rng });
    let guard = 0;
    while (!B.solved && guard++ < 8) {
      if (p.kind !== 'one' && verdictOf(B.line)) { assert.ok(B.verdict(p.kind).ok); break; }
      const g = B.buttons.slots.find((b) => b && b.role === 'good');
      assert.ok(g, `no good button on ${lineText(B.line)} (${p.kind})`);
      B.press(g.move);
      B.makeButtons();
    }
    assert.ok(B.solved, `${lineText(p.start)} ${p.kind}`);
    assert.equal(B.finish().stars, 3, `${lineText(p.start)} took ${B.moves} for par ${p.par}`);
    if (p.kind === 'all') all++; else if (p.kind === 'none') none++; else one++;
  }
  assert.ok(all && none && one);
});

test('warm-up rungs: balance the wagon and which key fits', () => {
  const rng = makeRng(5);
  for (const id of ['R0a', 'R0b']) {
    for (let i = 0; i < 500; i++) {
      const p = generate(id, { rng, size: 1 + (i % 3) });
      assert.equal(p.choices.length, 3);
      assert.equal(new Set(p.choices).size, 3);
      assert.ok(p.choices.includes(p.answer));
      assert.ok(p.choices.every((c) => c >= 0));
      const ls = keySteps(p.start.L, F(p.answer)), rs = keySteps(p.start.R, F(p.answer));
      assert.equal(ls[ls.length - 1], rs[rs.length - 1], `${lineText(p.start)} with ${p.answer}`);
      for (const c of p.choices) {
        if (c === p.answer) continue;
        assert.notEqual(keySteps(p.start.L, F(c)).pop(), keySteps(p.start.R, F(c)).pop(), `${c} also fits ${lineText(p.start)}`);
      }
      if (id === 'R0a') {
        // the "answer goes here" slips are among the wrong coins
        const B = makeBox(p, {});
        assert.equal(B.choose(p.choices.find((c) => c !== p.answer)).ok, false);
        assert.equal(B.choose(p.answer).ok, true);
        assert.equal(B.finish().stars, 2);
      }
    }
  }
});

// ---------- the ladder ----------

const result = (rung, clean) => ({ rung, clean, solved: true, stars: clean ? 3 : 1, moves: 1, par: 1, traps: [] });

test('first visit climbs one rung per clean box', () => {
  const A = makeAlgebra({}, { rng: makeRng(1) });
  assert.equal(A.level().rung, 'R1');
  const seen = [];
  for (let i = 0; i < 8; i++) { const p = A.next(); seen.push(p.rung); A.record(result(p.rung, true)); }
  assert.deepEqual(seen, ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']);
  assert.equal(A.level().rung, 'R9');
  assert.ok(A.level().placing);
});

test('the first slip is forgiven; the second miss ends the climb one rung below', () => {
  const A = makeAlgebra({}, { rng: makeRng(2) });
  for (let i = 0; i < 4; i++) { const p = A.next(); A.record(result(p.rung, true)); }   // R1..R4 clean
  assert.equal(A.next().rung, 'R5');
  A.record(result('R5', false));          // a slip: another R5 box, still climbing
  assert.equal(A.level().rung, 'R5');
  assert.ok(A.level().placing);
  assert.equal(A.next().rung, 'R5');
  A.record(result('R5', true));           // clean: the climb goes on
  assert.equal(A.next().rung, 'R6');
  A.record(result('R6', true));
  assert.equal(A.next().rung, 'R7');
  A.record(result('R7', false));          // the second miss ends it
  const L = A.level();
  assert.equal(L.rung, 'R6');
  assert.equal(L.placing, false);
  assert.ok(!L.stamped.includes('R6'));
  assert.ok(L.stamped.includes('R5'));
});

test('a slip and then a miss on the same rung ends the climb below it', () => {
  const A = makeAlgebra({}, { rng: makeRng(12) });
  for (let i = 0; i < 2; i++) { const p = A.next(); A.record(result(p.rung, true)); }   // R1, R2
  A.next(); A.record(result('R3', false));
  A.next(); A.record(result('R3', false));
  assert.equal(A.level().rung, 'R2');
  assert.equal(A.level().placing, false);
});

test('3 clean in a row up a level, 1 miss down a level, stamp on a clean level-4 box at 4 of the last 5 clean', () => {
  const st = { placing: false, rung: 'R6', levels: { R6: 2 }, stamped: [] };
  const A = makeAlgebra(st, { rng: makeRng(3) });
  for (let i = 0; i < 3; i++) A.record(result('R6', true));
  assert.equal(A.level().level, 3);
  A.record(result('R6', false));
  assert.equal(A.level().level, 2);
  for (let i = 0; i < 6; i++) A.record(result('R6', true));
  assert.equal(A.level().level, 4);
  assert.equal(A.level().rung, 'R6');
  A.record(result('R6', false));         // a miss at level 4: down to 3, not stamped
  assert.equal(A.level().level, 3);
  for (let i = 0; i < 3; i++) A.record(result('R6', true));
  assert.equal(A.level().level, 4);      // last 5: 1 1 0 1 1 ... 1
  A.record(result('R6', false));
  A.record(result('R6', true)); A.record(result('R6', true)); A.record(result('R6', true));
  assert.equal(A.level().level, 4);
  assert.equal(A.level().rung, 'R6', 'last 5 were 1 1 0 1 1 1 → 4 of 5 but the stamp needs a clean box at level 4');
  A.record(result('R6', true));
  assert.equal(A.level().rung, 'R7', 'stamped');
  assert.ok(A.level().stamped.includes('R6'));
  assert.equal(A.level().level, 2);
});

test('older rungs mix in once 2 are stamped; a missed type comes back 2-4 boxes later', () => {
  const st = { placing: false, rung: 'R8', levels: { R8: 3 }, stamped: ['R5', 'R6', 'R7'], ownRun: 5, ownNeed: 4 };
  const A = makeAlgebra(st, { rng: makeRng(4) });
  let older = 0;
  for (let i = 0; i < 300; i++) { const p = A.next(); if (p.rung !== 'R8') older++; }
  assert.ok(older > 150 && older < 250, `older ${older}/300`);
  // a missed R7 comes back
  const B = makeAlgebra({ placing: false, rung: 'R8', levels: { R8: 3 }, stamped: ['R7'], ownRun: 0, ownNeed: 5 }, { rng: makeRng(5) });
  B.record(result('R8', false));
  const after = [];
  for (let i = 0; i < 6; i++) { const p = B.next(); after.push(p.rung); B.record(result(p.rung, true)); }
  const k = after.indexOf('R8');
  assert.ok(k >= 0, `R8 back in ${after}`);
});

test('no problem repeats within the last 20, and the state survives JSON', () => {
  const st = {};
  const A = makeAlgebra(st, { rng: makeRng(6) });
  const keys = [];
  for (let i = 0; i < 60; i++) {
    const p = A.next();
    assert.ok(!keys.slice(-20).includes(p.key), `repeat ${p.key}`);
    keys.push(p.key);
    A.record(result(p.rung, i % 4 !== 0));
  }
  const copy = JSON.parse(JSON.stringify(st));
  const A2 = makeAlgebra(copy, { rng: makeRng(7) });
  assert.equal(A2.level().rung, A.level().rung);
  assert.ok(A2.next());
});

test('a new session starts with two easy boxes from stamped rungs', () => {
  let t = 1e12;
  const st = { placing: false, rung: 'R9', levels: { R9: 2 }, stamped: ['R6', 'R7', 'R8'], ownRun: 0, ownNeed: 5, lastAt: t };
  t += 3 * 60 * 60 * 1000;
  const A = makeAlgebra(st, { rng: makeRng(8), now: () => t });
  const a = A.next(); A.record(result(a.rung, true));
  const b = A.next(); A.record(result(b.rung, true));
  const c = A.next();
  assert.ok(['R6', 'R7', 'R8'].includes(a.rung) && ['R6', 'R7', 'R8'].includes(b.rung), `${a.rung} ${b.rung}`);
  assert.equal(c.rung, 'R9');
});

test('tiers change the number size, not the rung', () => {
  const A = makeAlgebra({ placing: false, rung: 'R7', levels: { R7: 3 } }, { rng: makeRng(9) });
  assert.equal(A.next('tin').size, 1);
  assert.equal(A.next('brass').size, 3);
  assert.equal(A.next('vault').rung, 'R7');
});

// ---------- a pretend kid plays hundreds of boxes through the ladder ----------
// Mostly right, sometimes a slip, now and then an undo or a hint. Every box must end (solved or left), every button
// set must offer a way forward, the ledger's links must stay true, and the ladder must keep climbing for a strong kid.

function playKid(A, rng, { skill = 0.85, tier = 'iron', boxes = 300 } = {}) {
  const seen = { rungs: new Set(), jams: 0, undos: 0, hints: 0, results: [] };
  for (let n = 0; n < boxes; n++) {
    const p = A.next(tier);
    const rung = RUNG[p.rung];
    seen.rungs.add(p.rung);
    const B = makeBox(p, { stage: rung.stage, level: p.level, rng, fav: A.fav(), tier });
    let presses = 0;
    if (p.mode !== 'moves') {
      const wrong = p.choices.find((c) => c !== p.answer);
      if (rng.next() > skill) assert.equal(B.choose(wrong).ok, false);
      assert.ok(B.choose(p.answer).ok);
    } else {
      while (!B.solved && presses < 40) {
        if (p.kind !== 'one' && verdictOf(B.line)) { if (B.verdict(p.kind).ok) break; }
        const shown = B.buttons.slots.filter(Boolean);
        assert.ok(shown.length >= 1, `no buttons on ${lineText(B.line)}`);
        assert.ok(shown.some((b) => b.role === 'good'), `no way forward on ${lineText(B.line)} (${p.rung})`);
        if (rng.next() < 0.04) { B.hint(); seen.hints++; }
        const r = rng.next();
        const pick = r < skill ? shown.find((b) => b.role === 'good') : shown[Math.floor(rng.next() * shown.length)];
        const res = B.press(pick.move);
        presses++;
        if (res.jam) seen.jams++;
        if (!B.solved && rng.next() < 0.05 && B.undo()) seen.undos++;
        // the ledger's links: every live line was made from the line before it on the trail
        const trail = B.trail;
        for (let i = 1; i < trail.length; i++) assert.equal(trail[i].parent, B.ledger.indexOf(trail[i - 1]), 'ledger link');
        if (!B.solved) B.makeButtons();
      }
      assert.ok(B.solved, `box never finished: ${lineText(p.start)} (${p.rung}) after ${presses} presses`);
    }
    if (p.kind === 'one') {
      const kt = B.keyTest();
      assert.equal(kt.left[kt.left.length - 1], kt.right[kt.right.length - 1], `the check on ${lineText(p.start)}`);
      B.keyResult(true);
    }
    const f = B.finish();
    assert.ok(f.solved && f.stars >= 1 && f.stars <= 3 && f.gold > 0);
    A.record(f);
    seen.results.push(f);
  }
  return seen;
}

test('a strong kid climbs the whole ladder; a shaky kid still finishes every box', () => {
  const strong = makeAlgebra({}, { rng: makeRng(21) });
  const s = playKid(strong, makeRng(22), { skill: 1, boxes: 40 });
  assert.ok(strong.level().stamped.length >= 12, `stamped ${strong.level().stamped}`);
  assert.ok(['R14', 'R15'].includes(strong.level().rung) || !strong.level().placing, strong.level().label);

  const shaky = makeAlgebra({}, { rng: makeRng(23) });
  const t = playKid(shaky, makeRng(24), { skill: 0.7, boxes: 250 });
  assert.ok(t.jams > 0, 'the jam guard fired at least once');
  assert.ok(t.results.every((r) => r.solved));
  // the shaky kid's state survives a save and a reload
  const again = makeAlgebra(JSON.parse(JSON.stringify(shaky.state)), { rng: makeRng(25) });
  assert.equal(again.level().rung, shaky.level().rung);
  void s;
});

test('the jam rewinds to a line that still has a productive button', () => {
  const rng = makeRng(31);
  for (const id of ['R6', 'R7', 'R10', 'R11', 'R12', 'R13', 'R14']) {
    for (let i = 0; i < 40; i++) {
      const p = generate(id, { rng, size: 2 });
      const B = makeBox(p, { stage: RUNG[id].stage, level: 4, rng });
      // three presses that are not closer in a row
      let jam = null;
      for (let k = 0; k < 3; k++) {
        const bad = B.buttons.slots.filter(Boolean).find((b) => b.role !== 'good');
        if (!bad) break;
        jam = B.press(bad.move).jam;
        if (B.solved) break;
        B.makeButtons();
      }
      if (!jam) continue;
      assert.equal(lineKey(B.line), lineKey(p.start), `rewound to the start on ${lineText(p.start)}`);
      B.makeButtons();
      assert.ok(B.buttons.slots.some((b) => b && b.role === 'good'));
      assert.equal(B.hintLevel, 1);
    }
  }
});

test('warm-up boxes never print their own answer', () => {
  const rng = makeRng(41);
  for (const id of ['R0a', 'R0b']) {
    for (let i = 0; i < 800; i++) {
      const p = generate(id, { rng, size: 1 + (i % 3) });
      assert.ok(!printedNumbers(p.start).has(p.answer), `${lineText(p.start)} shows ${p.answer}`);
    }
  }
});

// ---------- do the arithmetic: pick the tidied line ----------

test("tidied-line cards: a real player's slip (−10 + 18 worked as −28) and the brief's example", () => {
  const a = tidyChoices(line([xt(3), num(-10)], [xt(5), num(-18)]), addNum(18), { rng: makeRng(1) });
  assert.equal(lineText(a.mid), `3x ${MINUS} 10 + 18 = 5x ${MINUS} 18 + 18`);
  const texts = a.cards.map((c) => c.text);
  assert.equal(a.cards.filter((c) => c.right).length, 1);
  assert.equal(a.cards.find((c) => c.right).text, '3x + 8 = 5x');
  assert.ok(texts.includes(`3x ${MINUS} 28 = 5x`), texts.join(' | '));
  const slip = a.cards.find((c) => c.text === `3x ${MINUS} 28 = 5x`);
  assert.equal(slip.tag, 'sign');
  assert.equal(slipLine(slip, addNum(18)), `${MINUS}10 + 18 is 8, not ${MINUS}28.`);
  // a kid who keeps taking the wrong sign gets that card instead
  const f = tidyChoices(line([xt(3), num(-10)], [xt(5), num(-18)]), addNum(18), { rng: makeRng(1), fav: 'flip' });
  assert.ok(f.cards.some((c) => c.text === `3x ${MINUS} 8 = 5x` && c.tag === 'flip'), f.cards.map((c) => c.text).join(' | '));
  // the brief: 4x − 6 = −8x + 18, +6 → 4x = −8x + 24 (right), 4x = −8x + 18 (one side only), 4x = −8x + 12 (sign slip)
  const b = tidyChoices(line([xt(4), num(-6)], [xt(-8), num(18)]), addNum(6), { rng: makeRng(2) });
  const bt = b.cards.map((c) => c.text).sort();
  assert.deepEqual(bt, [`4x = ${MINUS}8x + 12`, `4x = ${MINUS}8x + 18`, `4x = ${MINUS}8x + 24`].sort());
  assert.equal(b.cards.find((c) => c.text === `4x = ${MINUS}8x + 18`).tag, 'oneside');
  assert.equal(slipLine(b.cards.find((c) => c.tag === 'oneside'), addNum(6)), 'Both sides get the +6.');
  // no sum to work out: no cards
  assert.equal(tidyChoices(line([xt(4)], [num(8)]), divBy(4)), null);
});

for (const rung of MOVE_RUNGS.filter((r) => RUNGS.indexOf(r) >= RUNGS.indexOf(RUNG.R5))) {
  test(`${rung.id}: tidied-line cards are fair through random play`, () => {
    const rng = makeRng(808 + RUNGS.indexOf(rung));
    const st = rung.stage;
    let made = 0;
    for (let i = 0; i < Math.round(150 * SCALE); i++) {
      const p = generate(rung.id, { rng, size: 1 + (i % 3) });
      let cur = p.start;
      for (let step = 0; step < 5 && !isSolved(cur); step++) {
        const legal = legalMoves(cur, st);
        if (!legal.length) break;
        for (const { move } of legal.filter((c) => c.move.k === 'add')) {
          const t = tidyChoices(cur, move, { rng, fav: [null, 'sign', 'flip', 'drop', 'oneside'][i % 5] });
          const sums = sumsOf(cur, move);
          if (!t) { assert.ok(!sums || !sums.sums.length, `no cards but a sum on ${lineText(cur)} ${E.moveLabel(move)}`); continue; }
          made++;
          const right = t.cards.filter((c) => c.right);
          assert.equal(right.length, 1);
          assert.equal(lineKey(right[0].line), lineKey(applyMove(cur, move).out), 'the right card is the real tidied line');
          assert.ok(t.cards.length >= 2 && t.cards.length <= 3, `${t.cards.length} cards`);
          assert.equal(new Set(t.cards.map((c) => c.text)).size, t.cards.length, `two cards read the same on ${lineText(cur)}`);
          for (const c of t.cards) {
            assertClean(c.text, 'card');
            if (c.right) continue;
            assert.ok(['sign', 'flip', 'drop', 'oneside'].includes(c.tag), c.tag);
            // a wrong card is never the right line with its terms in another order
            assert.notEqual(lineKey(c.line), lineKey(right[0].line), `card ${c.text} is the right line reordered`);
            const said = slipLine(c, move);
            assertClean(said, 'slip line');
            assert.ok(said.length > 5 && said.length < 60, said);
          }
        }
        cur = legal[Math.floor(rng.next() * legal.length)].out;
      }
    }
    assert.ok(made > 50, `cards made ${made}`);
  });
}

test('a wrong tidied line costs no move but the box is not clean, and the slip is counted', () => {
  const p = { rung: 'R7', mode: 'moves', kind: 'one', start: line([xt(5), num(-17)], [num(-47)]), x: -6, par: 2 };
  const B = makeBox(p, { stage: RUNG.R7.stage, level: ARITH_LEVEL, rng: makeRng(4) });
  const t = tidyChoices(B.line, addNum(17), { rng: makeRng(4) });
  const wrong = t.cards.find((c) => !c.right);
  assert.equal(B.tidyPick(wrong), false);
  assert.equal(B.tidyPick(t.cards.find((c) => c.right)), true);
  B.press(addNum(17));
  B.makeButtons();
  B.press(divBy(5));
  assert.ok(B.solved);
  B.keyResult(true);
  const f = B.finish();
  assert.equal(f.moves, 2);
  assert.equal(f.stars, 3);
  assert.equal(f.clean, false);
  assert.deepEqual(f.arith, [wrong.tag]);
  // the ladder counts it: twice makes it this kid's slip, and earns more number lines
  const A = makeAlgebra({ placing: false, rung: 'R8', levels: { R8: 3 }, stamped: ['R7'] }, { rng: makeRng(5) });
  assert.equal(A.favArith(), null);
  A.record({ ...f, rung: 'R7' }); A.record({ ...f, rung: 'R7' });
  assert.equal(A.favArith(), wrong.tag);
  let shown = 0;
  while (A.numberLineDue() && shown < 50) { A.sawNumberLine(); shown++; }
  assert.equal(shown, NUMBER_LINE_SHOWS + (wrong.tag === 'oneside' ? 0 : 4));
});

test('do-the-arithmetic boxes come up in review of stamped rungs from R5 up, never on the frontier', () => {
  const st = { placing: false, rung: 'R10', levels: { R10: 3 }, stamped: ['R3', 'R6', 'R7', 'R8', 'R9'], ownRun: 9, ownNeed: 4 };
  const A = makeAlgebra(st, { rng: makeRng(14) });
  let five = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const p = A.next();
    if (p.level === ARITH_LEVEL) {
      five++;
      assert.ok(p.review && p.rung !== 'R10' && p.rung !== 'R3', `${p.rung} at level 5`);
    }
    if (p.rung === 'R10') assert.ok(p.level <= 4);
    n++;
  }
  assert.ok(five > 60 && five < n / 2, `level-5 boxes ${five}/${n}`);
});
