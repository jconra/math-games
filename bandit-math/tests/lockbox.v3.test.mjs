// Lock box v3: working every step (parts.js), and the inequalities (ineq.js).
// Run with  node --test tests/lockbox.v3.test.mjs  (from bandit-math/).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lockbox/engine.js';
import { generate, makeRng, RUNGS, RUNG } from '../src/lockbox/generate.js';
import { makeBox } from '../src/lockbox/box.js';
import { stepsRoute } from '../src/lockbox/steps.js';
import { partsOf, assemble, partNudge, partHelp, answerText } from '../src/lockbox/parts.js';

const { line, xt, num, br, F, lineText, lineKey, applyMove, addNum, addX, divBy, mulBy, FLIP, COMB, DIST, legalMoves } = E;
const M = '−';

// A display string must read like school writes it.
function assertClean(s, where) {
  assert.ok(typeof s === 'string' && s.length, `empty text (${where})`);
  assert.ok(!/\+ ?[-−]/.test(s), `"+ −" in ${s} (${where})`);
  assert.ok(!/[-−] ?[-−]/.test(s), `"− −" in ${s} (${where})`);
  assert.ok(!/(^|[^0-9/])1x/.test(s), `"1x" in ${s} (${where})`);
  assert.ok(!/(^|[^0-9])0x/.test(s), `"0x" in ${s} (${where})`);
  assert.ok(!s.includes('-'), `a hyphen instead of a minus in ${s} (${where})`);
  assert.ok(!s.includes('undefined') && !s.includes('NaN') && !s.includes('Infinity'), `junk in ${s} (${where})`);
}
// a nudge or a help line must not hand over the answer
function assertNoAnswer(text, answer, where) {
  const a = answer.replace(/^\+/, '');
  for (const pat of [`= ${a}`, `is ${a}`, `makes ${a}`, `get ${a}`]) {
    assert.ok(!(text.includes(pat) && !new RegExp(`${pat.replace(/[()]/g, '\\$&')}[0-9x/]`).test(text)), `"${text}" gives away ${a} (${where})`);
  }
}

// Every question a parts list asks is well made, and the answers put the line back exactly as the move makes it.
function checkParts(l, m, where) {
  const P = partsOf(l, m, { rng: makeRng(7) });
  if (m.k === 'dist') { assert.equal(P, null); return null; }
  assert.ok(P, `no parts for ${E.moveLabel(m)} on ${lineText(l)}`);
  const out = applyMove(l, m).out;
  const back = assemble(P);
  assert.equal(lineText(back), lineText(out), `${where}: ${E.moveLabel(m)} on ${lineText(l)}`);
  assert.equal(lineKey(back), lineKey(out));
  for (const q of P.qs) {
    const w = `${where}: ${q.prompt} (${E.moveLabel(m)} on ${lineText(l)})`;
    assertClean(q.prompt, w);
    assert.equal(q.answer, answerText(q.result));
    assert.equal(q.choices.length, 4, `${w}: ${q.choices.map((c) => c.text).join(' ')}`);
    assert.equal(q.choices.filter((c) => c.right).length, 1, w);
    assert.equal(q.choices.find((c) => c.right).text, q.answer, w);
    assert.equal(new Set(q.choices.map((c) => c.text.replace(/^\+/, ''))).size, 4, `twins in ${w}: ${q.choices.map((c) => c.text).join(' ')}`);
    for (const c of q.choices) {
      assertClean(c.text, w);
      if (c.right) continue;
      assert.ok(['pm', 'sign', 'one', 'off', 'drop', 'nox', 'swap'].includes(c.tag), `${w}: tag ${c.tag}`);
      const n = partNudge(q, c);
      assertClean(n.replace(/-/g, ''), w);
      assertNoAnswer(n, q.answer, w);
    }
    const hl = partHelp(q);
    assert.ok(hl.length > 5);
    assertNoAnswer(hl, q.answer, w);
    for (const t of q.tokens) assertClean(t.text, w);
    // the part points at chips that are really on the shown line
    for (const i of q.at) assert.ok(P.shown[q.room][i], `${w}: no chip ${q.room}${i}`);
  }
  for (const a of P.autos) {
    assertClean(a.text, `${where} auto`);
    for (const i of a.at) assert.ok(P.shown[a.room][i]);
  }
  return P;
}

// ---------- the owner's examples ----------

test('5x = 4x + 27, −4x: the 4x − 4x cancels by itself; "5x − 4x = ?" asks x, 9x, 1, −x', () => {
  const P = partsOf(line([xt(5)], [xt(4), num(27)]), addX(-4), { rng: makeRng(1) });
  assert.equal(P.show, 'mid');
  assert.deepEqual(P.autos.map((a) => [a.room, a.kind, a.text]), [['R', 'zero', `4x ${M} 4x = 0`]]);
  assert.equal(P.qs.length, 1);
  const q = P.qs[0];
  assert.equal(q.prompt, `5x ${M} 4x`);
  assert.equal(q.answer, 'x');
  assert.deepEqual(q.choices.map((c) => c.text).sort(), ['1', '9x', 'x', `${M}x`].sort());
  assert.equal(lineText(assemble(P)), 'x = 27');
});

test('27 = 9x, ÷9: 9x ÷ 9 frees x by itself and "27 ÷ 9 = ?" is asked', () => {
  const P = partsOf(line([num(27)], [xt(9)]), divBy(9), { rng: makeRng(1) });
  assert.deepEqual(P.autos.map((a) => [a.room, a.kind]), [['R', 'free']]);
  assert.deepEqual(P.qs.map((q) => [q.prompt, q.answer]), [['27 ÷ 9', '3']]);
  assert.equal(lineText(assemble(P)), '3 = x');
});

test('−3x = −27, ÷(−3): "−27 ÷ (−3) = ?" with the sign slip −9 among the answers', () => {
  const P = partsOf(line([xt(-3)], [num(-27)]), divBy(-3), { rng: makeRng(4) });
  const q = P.qs[0];
  assert.equal(q.prompt, `${M}27 ÷ (${M}3)`);
  assert.equal(q.answer, '9');
  assert.ok(q.choices.some((c) => c.text === `${M}9` && c.tag === 'sign'));
  assert.ok(q.choices.every((c) => c.right || c.text !== '9'));
});

test('a sum of two numbers shows its number line (start and hop, not the landing)', () => {
  const P = partsOf(line([xt(3), num(-10)], [xt(5), num(-18)]), addNum(18), { rng: makeRng(2) });
  const q = P.qs[0];
  assert.equal(q.prompt, `${M}10 + 18`);
  assert.equal(q.answer, '8');
  assert.deepEqual(q.line, { start: -10, change: 18 });
  // the slips: subtracted instead of added (−28), the wrong sign (−8), the signs dropped (28) or one off
  assert.ok(q.choices.some((c) => c.text === `${M}28` && c.tag === 'pm'));
  assert.ok(q.choices.some((c) => c.text === `${M}8` && c.tag === 'sign'));
  // an x sum gets no number line
  assert.equal(partsOf(line([xt(5)], [xt(4), num(27)]), addX(-4)).qs[0].line, null);
});

test('the operation done on only one term is one of the slips (12 left as 12 after ÷6)', () => {
  const P = partsOf(line([xt(6), num(12)], [num(30)]), divBy(6), { rng: makeRng(3) });
  assert.deepEqual(P.qs.map((q) => q.prompt), ['12 ÷ 6', '30 ÷ 6']);
  assert.ok(P.qs[0].choices.some((c) => c.text === '12' && c.tag === 'one'));
  assert.equal(lineText(assemble(P)), 'x + 2 = 5');
});

test('fractions as they come: x/3 + 4 = 11, ·3 frees x and asks 4 · 3 and 11 · 3; 3x ÷ 2 answers 3x/2', () => {
  const P = partsOf(line([xt(F(1, 3)), num(4)], [num(11)]), mulBy(3));
  assert.deepEqual(P.autos.map((a) => a.text), ['x/3 · 3 = x']);
  assert.deepEqual(P.qs.map((q) => [q.prompt, q.answer]), [['4 · 3', '12'], ['11 · 3', '33']]);
  const Q = partsOf(line([xt(3)], [num(12)]), divBy(2));
  assert.equal(Q.qs[0].answer, '3x/2');
  assert.equal(Q.qs[0].choices.length, 4);
});

test('the flip, combining, and brackets that open by themselves', () => {
  let P = partsOf(line([xt(-1)], [num(7)]), FLIP);
  assert.deepEqual(P.autos.map((a) => a.kind), ['free']);
  assert.deepEqual(P.qs.map((q) => [q.prompt, q.answer]), [[`7 · (${M}1)`, `${M}7`]]);
  P = partsOf(line([xt(3), num(2), xt(2)], [num(-10), num(18)]), COMB);
  assert.deepEqual(P.qs.map((q) => [q.room, q.prompt, q.answer]), [['L', '3x + 2x', '5x'], ['R', `${M}10 + 18`, '8']]);
  assert.equal(lineText(assemble(P)), '5x + 2 = 8');
  P = partsOf(line([br(3, [xt(1), num(2)])], [num(18)]), divBy(3));
  assert.deepEqual(P.autos.map((a) => a.kind), ['open']);
  assert.equal(lineText(assemble(P)), 'x + 2 = 6');
  assert.equal(partsOf(line([br(3, [xt(1), num(2)])], [num(18)]), DIST), null);   // (products.js asks those)
});

// ---------- every move on every rung ----------

test('every move asks the right parts with valid distractors, and the answers rebuild the move\'s line', () => {
  let asked = 0, autos = 0;
  for (const r of RUNGS.filter((x) => x.stage && !x.ineq)) {
    const rng = makeRng(911);
    for (let i = 0; i < 25; i++) {
      const p = generate(r.id, { rng, size: 1 + (i % 3) });
      let l = p.start;
      // the start and a line or two along the card's route; every legal move from each
      const route = stepsRoute(l, r.stage, p.kind === 'one' ? null : undefined) || [];
      const lines = [l];
      for (const st of route.slice(0, 2)) { const o = applyMove(l, st.move); if (!o) break; l = o.out; lines.push(l); }
      for (const ln of lines) {
        for (const c of legalMoves(ln, r.stage)) {
          const P = checkParts(ln, c.move, r.id);
          if (P) { asked += P.qs.length; autos += P.autos.length; }
        }
      }
    }
  }
  assert.ok(asked > 3000 && autos > 500, `${asked} questions, ${autos} autos`);
});

// ---------- a whole box worked part by part ----------

test('a full solve by right answers ends on the same ledger, and wrong answers are gentle on the stars', () => {
  for (const id of ['R6', 'R7', 'R8', 'R9', 'R9b', 'R10', 'R11', 'R12', 'R13', 'R14']) {
    const rng = makeRng(31);
    for (let i = 0; i < 12; i++) {
      const p = generate(id, { rng, size: 1 + (i % 3) });
      const st = RUNG[id].stage;
      const route = stepsRoute(p.start, st);
      assert.ok(route, `${id} ${lineText(p.start)}`);
      // box A: worked part by part, one wrong answer before every right one
      const A = makeBox(p, { stage: st, level: 4, rng: makeRng(5) });
      const B = makeBox(p, { stage: st, level: 4, rng: makeRng(5) });
      for (const { move } of route) {
        const P = partsOf(A.line, move, { rng });
        if (P) {
          for (const q of P.qs) {
            const wrong = q.choices.find((c) => !c.right);
            assert.equal(A.partPick(false, q, wrong), false);
            assert.equal(A.partPick(true, q, q.choices.find((c) => c.right)), true);
          }
          const built = assemble(P);
          A.press(move);
          assert.equal(lineText(built), lineText(A.line), `${id}: ${lineText(p.start)} ${E.moveLabel(move)}`);
        } else {
          A.productPick(true);
          A.press(move);
        }
        B.press(move);
      }
      assert.ok(A.solved && B.solved, `${id} ${lineText(p.start)}`);
      // the ledger is line for line what a box pressed the same way without the parts writes
      assert.deepEqual(A.ledger.map((e) => lineText(e.line)), B.ledger.map((e) => lineText(e.line)));
      const ra = A.finish(), rb = B.finish();
      assert.equal(ra.stars, rb.stars);
      assert.equal(ra.clean, rb.clean);
      assert.equal(ra.gold, rb.gold);
      assert.ok(ra.partSlips > 0 || route.every((s) => !partsOf(p.start, s.move)?.qs.length));
      assert.equal(rb.partSlips, 0);
    }
  }
});

test('a wrong answer adding two numbers is counted by its kind for the ladder', () => {
  const p = { rung: 'R7', mode: 'moves', kind: 'one', start: line([xt(3), num(-10)], [num(8)]), x: 6, par: 2 };
  const B = makeBox(p, { stage: RUNG.R7.stage, level: 4, rng: makeRng(2) });
  const P = partsOf(B.line, addNum(10));
  const q = P.qs[0];
  const pm = q.choices.find((c) => c.tag === 'pm');
  B.partPick(false, q, pm);
  assert.deepEqual(B.arith, ['sign']);   // (algebra.js's word for "took away instead of adding")
  B.press(addNum(10)); B.press(divBy(3));
  const r = B.finish();
  assert.equal(r.clean, true);
  assert.equal(r.stars, 3);
  assert.equal(r.partSlips, 1);
  assert.deepEqual(r.arith, ['sign']);
});

// ---------- inequalities ----------

import * as Q from '../src/lockbox/ineq.js';
import { makeIneqBox } from '../src/lockbox/ineqbox.js';
import { makeAlgebra } from '../src/lockbox/algebra.js';
import { RUNG_IDS } from '../src/lockbox/generate.js';

const INEQ = ['I1', 'I2', 'I3', 'I4'];
const play = (c, moves) => moves.reduce((cur, m) => Q.applyChain(cur, m).out, c);

test('the inequality rungs come after the equations, and each one makes boxes of its kind', () => {
  assert.deepEqual(RUNG_IDS.slice(-5), ['R15', 'I1', 'I2', 'I3', 'I4']);
  const forms = { I1: 'one', I2: 'one', I3: 'three', I4: 'or' };
  for (const id of INEQ) {
    const rng = makeRng(17);
    for (let i = 0; i < 150; i++) {
      const p = generate(id, { rng, size: 1 + (i % 3) });
      const where = `${id} ${Q.stateText(p.start)}`;
      assert.ok(p && p.mode === 'ineq' && p.kind === 'ineq', where);
      assert.equal(p.start.form, forms[id], where);
      assert.equal(p.start.chains.length, id === 'I4' ? 2 : 1, where);
      assert.equal(p.start.chains[0].rooms.length, id === 'I3' ? 3 : 2, where);
      assertClean(Q.stateText(p.start), where);
      assert.ok(p.par >= 1 && p.par <= RUNG[id].maxPar, `${where}: par ${p.par}`);
      // whole-number ends within ±20
      for (const pc of p.set) for (const v of [pc.lo, pc.hi]) if (v !== null) assert.ok(Number.isInteger(v) && Math.abs(v) <= 20, `${where}: ${v}`);
      // the answer is exactly the numbers that make the beginning true (whole numbers and halves, −40 .. 40)
      for (let x = -40; x <= 40; x += 0.5) assert.equal(Q.inSet(p.set, x), Q.satisfies(p.start, x), `${where}: x = ${x}`);
      // some numbers work and some don't
      assert.ok([...Array(81)].some((_, k) => Q.inSet(p.set, k - 40)) && [...Array(81)].some((_, k) => !Q.inSet(p.set, k - 40)), where);
      // the steps card's order solves each part to the same answer
      const solved = p.start.chains.map((c) => play(c, Q.chainRoute(c, RUNG[id].stage).map((s) => s.move)));
      assert.ok(solved.every(Q.chainSolved), where);
      assert.equal(Q.setKey(Q.stateSet({ chains: solved })), Q.setKey(p.set), where);
      // I2 always turns a sign round on the way
      if (id === 'I2') assert.ok(Q.chainRoute(p.start.chains[0], RUNG[id].stage).some((s) => Q.movesFlip(s.move)), where);
    }
  }
});

test('the flip: × or ÷ by a negative turns every sign round, a positive keeps it', () => {
  const st = RUNG.I2.stage;
  const c = Q.chain([[xt(-3)], [num(12)]], ['≥']);
  const r = Q.applyChain(c, divBy(-3));
  assert.equal(r.flipped, true);
  assert.equal(Q.chainText(r.out), `x ≤ ${M}4`);
  assert.equal(Q.setText(Q.chainSet(r.out)), `x ≤ ${M}4`);
  assert.equal(Q.applyChain(Q.chain([[xt(3)], [num(12)]], ['<']), divBy(3)).out.rels[0], '<');
  assert.equal(Q.applyChain(Q.chain([[xt(-1)], [num(2)]], ['>']), FLIP).out.rels[0], '<');
  assert.equal(Q.applyChain(Q.chain([[xt(F(1, 2))], [num(2)]], ['≤']), mulBy(-2)).out.rels[0], '≥');
  assert.equal(Q.applyChain(c, addNum(5)).flipped, false);
  // the card divides by the negative itself (it never dodges the flip)
  assert.deepEqual(Q.chainRoute(Q.chain([[xt(-3), num(2)], [num(14)]], ['≥']), st).map((s) => E.moveLabel(s.move)), [`${M}2`, `÷(${M}3)`]);
  // three rooms: both signs turn: −6 < −2x ≤ 4, ÷(−2): 3 > x ≥ −2, which is −2 ≤ x < 3
  const three = Q.applyChain(Q.chain([[num(-6)], [xt(-2)], [num(4)]], ['<', '≤']), divBy(-2)).out;
  assert.equal(Q.chainText(three), `3 > x ≥ ${M}2`);
  assert.equal(Q.setText(Q.chainSet(three)), `${M}2 ≤ x < 3`);
  // the sign question: four signs, the right one is the turned sign; keeping it is the slip
  const q = Q.signQuestion(Q.chain([[xt(-3)], [num(12)]], ['≥']), divBy(-3), 0, makeRng(1).next);
  assert.equal(q.answer, '≤');
  assert.deepEqual(q.choices.map((x) => x.text).sort(), [...Q.RELS].sort());
  assert.equal(q.choices.find((x) => x.text === '≥').tag, 'kept');
  assert.match(Q.signNudge(q, q.choices.find((x) => x.text === '≥')), /negative turns the sign round/);
  const keep = Q.signQuestion(Q.chain([[xt(3)], [num(12)]], ['<']), divBy(3), 0);
  assert.equal(keep.answer, '<');
  assert.equal(keep.choices.find((x) => x.text === '>').tag, 'turned');
});

test('three rooms: 3x − 9 < 6x < 3x + 12, −3x in each, ÷3, gives −3 < x < 4', () => {
  const st = RUNG.I3.stage;
  const c = Q.chain([[xt(3), num(-9)], [xt(6)], [xt(3), num(12)]], ['<', '<']);
  assert.deepEqual(Q.chainRoute(c, st).map((s) => E.moveLabel(s.move)), [`${M}3x`, '÷3']);
  const a = Q.applyChain(c, addX(-3)).out;
  assert.equal(Q.chainText(a), `${M}9 < 3x < 12`);
  const b = Q.applyChain(a, divBy(3)).out;
  assert.equal(Q.chainText(b), `${M}3 < x < 4`);
  const p = Q.makeIneqProblem('I3', { form: 'three', chains: [c] }, st);
  assert.equal(p.par, 2);
  assert.equal(Q.setText(p.set), `${M}3 < x < 4`);
  // the parts: the 3x − 3x in the outer rooms cancel by themselves; the middle asks 6x − 3x
  const P = Q.chainParts({ form: 'three', chains: [c], active: 0 }, addX(-3), { rng: makeRng(1) });
  assert.deepEqual(P.autos.map((x) => [x.room, x.kind]), [['A0', 'zero'], ['A2', 'zero']]);
  assert.deepEqual(P.qs.map((q) => [q.room, q.prompt, q.answer]), [['A1', `6x ${M} 3x`, '3x']]);
  // ÷3 asks each room's number, then the sign
  const D = Q.chainParts({ form: 'three', chains: [a], active: 0 }, divBy(3), { rng: makeRng(1) });
  assert.deepEqual(D.qs.map((q) => [q.room, q.prompt, q.answer]), [['A0', `${M}9 ÷ 3`, `${M}3`], ['A2', '12 ÷ 3', '4'], ['Ar', '< after ÷3', '<']]);
  assert.deepEqual(D.autos.map((x) => x.kind), ['free']);
  // the tray offers −3x, and its sign trap +3x
  const bb = Q.chainButtons(c, st, { rng: makeRng(3) });
  const ids = bb.slots.filter(Boolean).map((x) => x.id);
  assert.ok(ids.includes('add:x:-3'), ids.join(' '));
  assert.equal(bb.slots.filter(Boolean).find((x) => x.id === 'add:x:-3').role, 'good');
});

test('"or": x + 2 < 0 or 2x > 8 is worked one part at a time and ends x < −2 or x > 4', () => {
  const st = RUNG.I4.stage;
  const start = { form: 'or', chains: [Q.chain([[xt(1), num(2)], [num(0)]], ['<']), Q.chain([[xt(2)], [num(8)]], ['>'])] };
  const p = Q.makeIneqProblem('I4', start, st, { maxPar: 4 });
  assert.equal(Q.setText(p.set), `x < ${M}2 or x > 4`);
  const B = makeIneqBox({ ...p }, { stage: st, level: 4, rng: makeRng(2) });
  assert.equal(B.line.active, 0);
  let r = B.press(addNum(-2));
  assert.ok(r.closer && r.chainDone && !r.solved);
  assert.equal(B.line.active, 1);
  assert.equal(B.steps().find((s) => s.id === 'first').state, 'done');
  r = B.press(divBy(2));
  assert.ok(r.solved && B.chainsSolved && !B.solved);
  assert.equal(Q.stateText(B.line), `x < ${M}2 or x > 4`);
  const { choices } = B.lineChoices();
  assert.equal(choices.length, 4);
  assert.ok(choices.some((c) => c.tag === 'between'));
  assert.equal(B.pickLine(choices.find((c) => !c.right)), false);
  assert.equal(B.pickLine(choices.find((c) => c.right)), true);
  const kt = B.keyTest();
  assert.ok(kt.ok && Q.inSet(p.set, kt.x));
  const res = B.finish();
  assert.equal(res.solved, true);
  assert.equal(res.stars, 3);
  assert.equal(res.clean, false);   // (a wrong number line: the ladder sees it)
  assert.equal(res.lineSlips, 1);
});

test('the number-line answer: four different pictures, one right, the slips that matter', () => {
  const sets = [
    [{ lo: null, loIn: false, hi: -4, hiIn: true }],                            // x ≤ −4
    [{ lo: 7, loIn: false, hi: null, hiIn: false }],                            // x > 7
    [{ lo: -3, loIn: false, hi: 4, hiIn: false }],                              // −3 < x < 4
    [{ lo: null, loIn: false, hi: -2, hiIn: false }, { lo: 4, loIn: true, hi: null, hiIn: false }],   // x < −2 or x ≥ 4
  ];
  for (const set of sets) {
    for (let seed = 1; seed < 40; seed++) {
      const { win, choices } = Q.lineChoices(set, { rng: makeRng(seed) });
      assert.equal(choices.length, 4, Q.setText(set));
      assert.equal(new Set(choices.map((c) => c.key)).size, 4);
      assert.equal(choices.filter((c) => c.right).length, 1);
      assert.equal(choices.find((c) => c.right).key, Q.setKey(set));
      const tags = choices.filter((c) => !c.right).map((c) => c.tag);
      if (set.length === 1 && set[0].lo === null || set[0].hi === null && set.length === 1) assert.ok(tags.includes('circle') && tags.includes('way'), tags.join(' '));
      if (set.length === 1 && set[0].lo !== null && set[0].hi !== null) assert.ok(tags.includes('circle') && tags.includes('outward'), tags.join(' '));
      if (set.length === 2) assert.ok(tags.includes('between'), tags.join(' '));
      for (const c of choices) {
        for (const pc of c.set) for (const v of [pc.lo, pc.hi]) if (v !== null) assert.ok(v > win.lo && v < win.hi, `${v} outside ${win.lo}..${win.hi}`);
        if (!c.right) assert.ok(Q.lineNudge(set, c).length > 10);
      }
    }
  }
});

test('a whole inequality box worked part by part: the answers rebuild every room, the review checks out', () => {
  for (const id of INEQ) {
    const rng = makeRng(23);
    const st = RUNG[id].stage;
    for (let i = 0; i < 30; i++) {
      const p = generate(id, { rng, size: 1 + (i % 3) });
      const B = makeIneqBox(p, { stage: st, level: 4, rng: makeRng(i) });
      let guard = 0;
      while (!B.chainsSolved && guard++ < 10) {
        // the card's move is on a button, marked good
        const card = Q.chainRoute(B.chain, st)[0].move;
        const shown = B.buttons.slots.filter(Boolean);
        const btn = shown.find((x) => x.id === E.moveId(card));
        assert.ok(btn && btn.role === 'good', `${id} ${Q.stateText(B.line)}: ${E.moveLabel(card)} not on the tray (${shown.map((x) => x.label).join(' ')})`);
        const P = Q.chainParts(B.line, card, { rng });
        for (const q of P.qs) {
          assert.equal(q.choices.length, 4, `${id}: ${q.prompt}`);
          assert.equal(q.choices.filter((c) => c.right).length, 1);
          assert.equal(new Set(q.choices.map((c) => c.text)).size, 4, `${id}: ${q.prompt} ${q.choices.map((c) => c.text)}`);
          q.choices.forEach((c) => assertClean(c.text, `${id} ${q.prompt}`));
        }
        const r = B.press(card);
        assert.ok(r.closer, `${id} ${Q.stateText(r.before)} ${E.moveLabel(card)}`);
        // every room the answers build is the room the move makes
        const ci = r.ci;
        for (let k = 0; k < P.rooms.length; k++) {
          const built = assemble({ ...P, shown: { [P.rooms[k]]: P.shown[P.rooms[k]] }, autos: P.autos, qs: P.qs.filter((q) => q.kind !== 'sign') }, [P.rooms[k]]);
          assert.equal(E.sideText(built[P.rooms[k]]), E.sideText(r.out.chains[ci].rooms[k]), `${id} room ${k}`);
        }
        const sq = P.qs.find((q) => q.kind === 'sign');
        if (sq) assert.deepEqual(sq.rels, r.out.chains[ci].rels);
        B.makeButtons();
      }
      assert.ok(B.chainsSolved, `${id} ${Q.stateText(p.start)}`);
      assert.equal(B.moves, p.par);
      const { choices } = B.lineChoices();
      assert.ok(B.pickLine(choices.find((c) => c.right)));
      const kt = B.keyTest();
      assert.ok(kt.ok && Q.inSet(p.set, kt.x), `${id}: test value ${kt.x}`);
      const res = B.finish();
      assert.ok(res.solved && res.clean && res.stars === 3, `${id} ${Q.stateText(p.start)}: ${JSON.stringify(res)}`);
      assert.ok(B.steps({ checked: true }).every((s) => s.state === 'done' || s.state === 'skip'));
    }
  }
});

test('the ladder opens the inequalities once the vault is stamped, like any other rung', () => {
  const s = { rung: 'R15', placing: false, levels: { R15: 4 }, hist: { R15: [1, 1, 1, 1] }, stamped: ['R13', 'R14'], streak: {} };
  const alg = makeAlgebra(s, { rng: makeRng(4) });
  alg.record({ rung: 'R15', clean: true, solved: true, stars: 3, moves: 3, par: 3 });
  assert.equal(s.rung, 'I1');
  assert.ok(s.stamped.includes('R15'));
  const p = alg.next('vault');
  assert.equal(p.mode, 'ineq');
  assert.equal(p.rung, 'I1');
  assert.match(alg.level().label, /Less or more/);
});
