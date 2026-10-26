// Tests for the lock box's steps card (src/lockbox/steps.js) and how the box follows it.
// Run with  node --test tests/lockbox.steps.test.mjs  (from mathwood-valley/).

import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lockbox/engine.js';
import { generate, makeRng, RUNGS, RUNG, verdictOf } from '../src/lockbox/generate.js';
import { makeBox } from '../src/lockbox/box.js';
import {
  GOLDEN_RULE, STEPS, stepsPlan, stepsStatus, stepsRoute, stepsLeft, stepsMoves, currentStep, cardMode, isSorted,
} from '../src/lockbox/steps.js';

const { F, num, xt, br, line, lineText, applyMove, addNum, addX, divBy, DIST, isSolved } = E;
// the equation rungs (the inequalities after them have their own card: lockbox.v3.test.mjs)
const MOVE_RUNGS = RUNGS.filter((r) => r.stage && !r.ineq);
const ids = (status, state) => status.filter((s) => s.state === state).map((s) => s.n);
const nowOf = (status) => currentStep(status)?.n ?? null;

test('the card says what the brief wrote, in its order', () => {
  assert.equal(GOLDEN_RULE, 'Whatever you do to one side, do to the other.');
  assert.deepEqual(STEPS.map((s) => s.n), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(STEPS.map((s) => s.id), ['brackets', 'division', 'tidy', 'sort', 'free', 'check']);
  assert.equal(STEPS[0].label, 'Open the brackets (distribute)');
  assert.equal(STEPS[1].label, 'Clear the division');
  assert.equal(STEPS[2].label, 'Tidy each side');
  assert.match(STEPS[3].label, /^x’s on one side, numbers on the other$/);
  assert.match(STEPS[4].label, /^Free x \(divide; flip the signs if it’s −x\)$/);
  assert.equal(STEPS[5].label, 'Check it');
  assert.equal(STEPS[0].skip, 'No brackets');
});

test('the plan skips the steps an equation does not need, and opens on the hard ones', () => {
  const plan = (L, R, rung = 'R14') => stepsPlan(line(L, R), RUNG[rung].stage);
  const on = (p) => Object.entries(p.applies).filter(([, v]) => v).map(([k]) => k);
  let p = plan([br(3, [xt(1), num(2)])], [num(18)], 'R10');             // 3(x + 2) = 18
  assert.deepEqual(on(p), ['brackets', 'sort', 'free', 'check']);
  assert.equal(p.hard, true);
  p = plan([xt(1), num(4)], [num(9)], 'R1');                               // x + 4 = 9
  assert.deepEqual(on(p), ['sort', 'check']);
  assert.equal(p.hard, false);
  p = plan([xt(3)], [num(12)], 'R3');                                       // 3x = 12
  assert.deepEqual(on(p), ['free', 'check']);
  assert.equal(p.hard, false);
  p = plan([xt(F(1, 4))], [num(3)], 'R4');                                  // x/4 = 3
  assert.deepEqual(on(p), ['division', 'check']);
  assert.equal(p.hard, false);                                              // (one move: it starts folded, like 3x = 12)
  // step 5 says what frees x, not that an x/4 still on the paper is "already free"
  const free = stepsStatus(line([xt(F(1, 4))], [num(3)]), p).find((s) => s.id === 'free');
  assert.equal(free.state, 'skip');
  assert.equal(free.skip, 'Clearing the division frees x');
  p = plan([xt(F(1, 3)), num(4)], [num(11)], 'R9');                         // x/3 + 4 = 11 (two moves: opens)
  assert.equal(p.hard, true);
  p = plan([xt(F(1, 3)), num(4)], [num(11)], 'R9');                         // x/3 + 4 = 11
  assert.deepEqual(on(p), ['division', 'sort', 'check']);
  p = plan([xt(3), num(2), xt(2)], [num(17)], 'R11');                        // 3x + 2 + 2x = 17
  assert.deepEqual(on(p), ['tidy', 'sort', 'free', 'check']);
  assert.equal(p.hard, true);
  p = plan([xt(5), num(3)], [xt(2), num(15)], 'R12');                        // 5x + 3 = 2x + 15
  assert.deepEqual(on(p), ['sort', 'free', 'check']);
  assert.equal(p.hard, true);
  p = plan([num(5), xt(-1)], [num(12)], 'R8');                               // 5 − x = 12
  assert.deepEqual(on(p), ['sort', 'free', 'check']);
  assert.equal(p.hard, false);
  p = plan([br(2, [xt(1), num(3)]), num(4)], [num(18)]);                     // 2(x + 3) + 4 = 18
  assert.deepEqual(on(p), ['brackets', 'tidy', 'sort', 'free', 'check']);
});

test('following the card on 3(x + 2) = 18: each step ticks off as the moves do it', () => {
  const p = { rung: 'R10', mode: 'moves', kind: 'one', start: line([br(3, [xt(1), num(2)])], [num(18)]), x: 4, par: 2 };
  const B = makeBox(p, { stage: RUNG.R10.stage, level: 4, rng: makeRng(1) });
  assert.equal(B.par, 3, 'par is the card’s count (open, −6, ÷3), not the shortcut’s 2');
  assert.equal(B.togo, 3, 'all three tumblers up at the start');
  let st = B.steps();
  assert.equal(nowOf(st), 1);
  assert.deepEqual(ids(st, 'skip'), [2, 3]);
  assert.equal(st[1].skip, 'No division');
  // the card's move is on a button
  assert.ok(B.buttons.slots.some((b) => b && b.move.k === 'dist'), 'Open brackets is offered');
  let r = B.press(DIST);
  assert.ok(r.closer, 'opening the brackets counts as closer');
  B.makeButtons();
  st = B.steps();
  assert.deepEqual(ids(st, 'done'), [1]);
  assert.equal(nowOf(st), 4);
  r = B.press(addNum(-6)); B.makeButtons();
  assert.ok(r.closer);
  assert.equal(nowOf(B.steps()), 5);
  r = B.press(divBy(3));
  assert.ok(r.closer && B.solved);
  st = B.steps();
  assert.equal(nowOf(st), 6, 'solved: Check it is next');
  st = B.steps({ checked: true });
  assert.equal(nowOf(st), null);
  assert.deepEqual(ids(st, 'done'), [1, 4, 5, 6]);
  B.keyResult(true);
  const f = B.finish();
  assert.equal(f.moves, 3);
  assert.equal(f.stars, 3, 'following the rules earns every star');
  assert.ok(f.clean);
});

test('the shortcut (divide first in 3(x + 2) = 18) is still accepted, and ticks the steps it did', () => {
  const p = { rung: 'R10', mode: 'moves', kind: 'one', start: line([br(3, [xt(1), num(2)])], [num(18)]), x: 4, par: 2 };
  const B = makeBox(p, { stage: RUNG.R10.stage, level: 4, rng: makeRng(2) });
  const r = B.press(divBy(3));
  assert.ok(r.closer, 'dividing first is closer');
  assert.ok(r.shortcut, 'and is marked a shortcut');
  assert.equal(lineText(B.line), 'x + 2 = 6');
  assert.equal(B.togo, 1, 'two tumblers drop at once');
  B.makeButtons();
  let st = B.steps();
  assert.deepEqual(ids(st, 'done'), [1], 'dividing opened the brackets');
  assert.equal(nowOf(st), 4);
  B.press(addNum(-2));
  assert.ok(B.solved);
  st = B.steps();
  assert.deepEqual(ids(st, 'done'), [1, 4, 5]);
  assert.equal(B.finish().stars, 3);
});

test('a skipped step comes back when a move makes the line need it; undo un-ticks', () => {
  const start = line([xt(3), num(4)], [num(10)]);
  const plan = stepsPlan(start, RUNG.R14.stage);
  assert.equal(plan.applies.tidy, false);
  const messy = line([xt(3), num(4), num(2)], [num(10)]);
  const st = stepsStatus(messy, plan);
  assert.equal(st[2].state, 'now', 'tidy is back');
  const p = { rung: 'R6', mode: 'moves', kind: 'one', start: line([xt(2), num(5)], [num(17)]), x: 6, par: 2 };
  const B = makeBox(p, { stage: RUNG.R6.stage, level: 4, rng: makeRng(3) });
  B.press(addNum(-5));
  assert.equal(nowOf(B.steps()), 5);
  B.undo();
  assert.equal(nowOf(B.steps()), 4);
});

test('5 − x = 12: step 5 flips the signs; −x = 7 is not free yet', () => {
  const p = { rung: 'R8', mode: 'moves', kind: 'one', start: line([num(5), xt(-1)], [num(12)]), x: -7, par: 2 };
  const B = makeBox(p, { stage: RUNG.R8.stage, level: 4, rng: makeRng(4) });
  B.press(addNum(-5));
  assert.equal(lineText(B.line), '−x = 7');
  assert.ok(isSorted(B.line));
  assert.equal(nowOf(B.steps()), 5);
  B.makeButtons();
  assert.deepEqual(stepsMoves(B.line, RUNG.R8.stage).map((m) => m.k), ['flip']);
});

test('hint 1 names the step the kid is on', () => {
  const p = { rung: 'R10', mode: 'moves', kind: 'one', start: line([br(3, [xt(1), num(2)])], [num(18)]), x: 4, par: 2 };
  const B = makeBox(p, { stage: RUNG.R10.stage, level: 4, rng: makeRng(5) });
  const h = B.hint();
  assert.equal(h.level, 1);
  assert.equal(h.step, 1);
  assert.equal(h.text, 'Step 1: Open the brackets (distribute).');
});

test('the card never gives a vault box away: step 5 stays in, and a verdict line says so plainly', () => {
  const rng = makeRng(15);
  const st = RUNG.R15.stage;
  for (let i = 0; i < 200; i++) {
    const p = generate('R15', { rng, size: 2, verdict: i % 2 === 0 });
    const B = makeBox(p, { stage: st, level: 4, rng });
    assert.equal(B.plan.applies.free, true, lineText(p.start));
    let guard = 0;
    while (!B.solved && guard++ < 8) {
      if (p.kind !== 'one' && verdictOf(B.line)) {
        const s5 = B.steps()[4];
        assert.equal(s5.state, 'now');
        assert.ok(s5.note, 'step 5 explains the verdict buttons');
        assert.ok(B.verdict(p.kind).ok);
        break;
      }
      const g = B.buttons.slots.find((b) => b && b.role === 'good');
      B.press(g.move);
      B.makeButtons();
    }
    assert.ok(B.solved, lineText(p.start));
    assert.equal(B.finish().stars, 3, `${lineText(p.start)} (${p.kind}) took ${B.moves} for par ${B.par}`);
  }
});

for (const rung of MOVE_RUNGS) {
  test(`${rung.id}: following the card always works, every card press is closer, and a card move is always on a button`, () => {
    const rng = makeRng(100 + MOVE_RUNGS.indexOf(rung));
    let routed = 0;
    for (let i = 0; i < 120; i++) {
      const p = generate(rung.id, { rng, size: 1 + (i % 3) });
      for (const level of [2, 4]) {
        const B = makeBox(p, { stage: rung.stage, level, rng, tier: 'iron' });
        const goal = p.kind === 'one' ? null : (l) => verdictOf(l);
        const route = stepsRoute(p.start, rung.stage, goal);
        if (!route) continue;   // a rare line where the card's order would pass 99 (the box falls back to the shortest route)
        routed++;
        assert.equal(B.par, Math.max(p.par, route.length));
        assert.equal(B.togo, B.par);
        let guard = 0;
        while (!B.solved && guard++ < 10) {
          if (p.kind !== 'one' && verdictOf(B.line)) { assert.ok(B.verdict(p.kind).ok); break; }
          const cards = B.buttons.slots.filter((b) => b && b.card);
          assert.ok(cards.length, `no card move on a button: ${lineText(B.line)} (${rung.id} level ${level})`);
          // the step the card is on is always offered: its own move, or a cancelling move while it sorts
          const canon = stepsMoves(B.line, rung.stage, goal)[0];
          const canonKey = E.lineKey(applyMove(B.line, canon).out);
          assert.ok(cards.some((b) => (canon.k === 'add' ? b.move.k === 'add' : b.key === canonKey)),
            `the card's step (${E.moveLabel(canon)}) is not on a button: ${lineText(B.line)} (${rung.id} level ${level})`);
          const before = stepsLeft(B.line, rung.stage, goal);
          const r = B.press(cards[0].move);
          assert.ok(r.closer, `${cards[0].label} on ${lineText(r.before)} not closer`);
          assert.equal(r.jam, null);
          if (!B.solved) assert.equal(stepsLeft(B.line, rung.stage, goal), before - 1);
          B.makeButtons();
        }
        assert.ok(B.solved, `${lineText(p.start)} by the card`);
        assert.equal(B.moves, route.length);
        const f = B.finish();
        assert.equal(f.stars, 3);
        // the card is in step: nothing left but the check
        const st = B.steps();
        assert.ok(st.every((s) => s.state !== 'todo'), `${lineText(p.start)}: ${JSON.stringify(st.map((s) => s.state))}`);
        assert.equal(nowOf(st), 6);
      }
    }
    assert.ok(routed > 200, `${rung.id}: the card's order finished only ${routed} boxes`);
  });
}

test('how the card starts: open on hard boxes, faded near mastery, folded on easy or stamped rungs', () => {
  assert.equal(cardMode({ hard: true, stamped: false, level: 2 }), 'open');
  assert.equal(cardMode({ hard: true, stamped: false, level: 3 }), 'open');
  assert.equal(cardMode({ hard: true, stamped: false, level: 4 }), 'faded');
  assert.equal(cardMode({ hard: true, stamped: true, level: 4 }), 'folded');
  assert.equal(cardMode({ hard: false, stamped: false, level: 2 }), 'folded');
});

test('the card count is never shorter than the fewest moves', () => {
  const rng = makeRng(77);
  for (const rung of MOVE_RUNGS) {
    for (let i = 0; i < 60; i++) {
      const p = generate(rung.id, { rng, size: 1 + (i % 3) });
      const s = stepsLeft(p.start, rung.stage, p.kind === 'one' ? null : (l) => verdictOf(l));
      if (Number.isFinite(s)) assert.ok(s >= p.par, `${lineText(p.start)}: card ${s} < par ${p.par}`);
      if (p.kind === 'one') assert.ok(isSolved(line([xt(1)], [num(p.x)])));
    }
  }
});

test('a press that makes no progress is never praised as a shortcut, even where the card can\'t finish', () => {
  // R8 has no button that moves an x-term: on −x + 4 = 0 the card takes away 4 and then flips (it doesn't move −x across)
  const st = RUNG.R8.stage;
  assert.equal(stepsLeft(line([xt(-1), num(4)], [num(0)]), st), 2);
  const p = { start: line([xt(-1), num(8)], [num(4)]), answer: 4, par: 2, kind: 'one', rung: 'R8', mode: 'moves' };
  const B = makeBox(p, { stage: st, level: 4, rng: makeRng(5) });
  B.makeButtons();
  let r = B.press(addNum(-4));                                  // −x + 4 = 0: no closer
  assert.equal(r.closer, false);
  r = B.press(addNum(1));                                       // −x + 5 = 1: still no closer, and no praise
  assert.equal(r.closer, false);
  assert.equal(r.shortcut, false);
  // every press from −x + 4 = 0 that leaves the shortest route as long is neither closer nor a shortcut
  for (const c of E.legalMoves(line([xt(-1), num(4)], [num(0)]), st)) {
    const b = makeBox({ ...p, start: line([xt(-1), num(4)], [num(0)]) }, { stage: st, level: 4, rng: makeRng(6) });
    const res = b.press(c.move);
    if (!res || res.solved) continue;
    if (res.dAfter >= res.dBefore) { assert.equal(res.shortcut, false, lineText(res.out)); }
  }
});

test('at 4 buttons a brackets box offers the shortcut, and pressing it is praised', () => {
  // R10 (3(x + 2) = 18): ÷3 is the shortcut past the card's "open the brackets"; it must reach the tray now and then
  let boxes = 0, offered = 0, praised = 0;
  for (let i = 0; i < 200; i++) {
    const rng = makeRng(4000 + i);
    const p = generate('R10', { rng });
    if (!p || p.kind !== 'one') continue;
    const B = makeBox(p, { stage: RUNG.R10.stage, level: 4, rng, tier: 'iron' });
    boxes++;
    const shown = B.buttons.slots.filter(Boolean);
    assert.ok(shown.some((b) => b.move.k === 'dist'), `Open brackets is always offered on ${lineText(p.start)}`);
    const sc = shown.find((b) => b.move.k === 'div' && b.role === 'good');
    if (!sc) continue;
    offered++;
    // the hints still point at the card's own move
    const H = makeBox(p, { stage: RUNG.R10.stage, level: 4, rng: makeRng(1), tier: 'iron' });
    H.buttons = B.buttons;
    assert.equal(H.hintAt(3).move.k, 'dist', `hint 3 on ${lineText(p.start)}`);
    if (B.press(sc.move).shortcut) praised++;
  }
  // (with a second right way always shown at 4 buttons, ÷n is there on nearly every box where it works)
  assert.ok(offered / boxes > 0.6, `÷n offered on ${offered} of ${boxes} first lines`);
  assert.equal(praised, offered, 'every ÷n press is praised as a shortcut');
  // brackets on both sides: dividing first is praised too, though it also brings the card's count down
  const st = RUNG.R14.stage;
  const p = { rung: 'R14', mode: 'moves', kind: 'one', start: line([br(2, [xt(1), num(7)])], [xt(4), num(8)]), x: 3, par: 3 };
  const B = makeBox(p, { stage: st, level: 4, rng: makeRng(8) });
  assert.equal(stepsLeft(p.start, st), 4);
  assert.ok(B.press(divBy(2)).shortcut, '÷2 first on 2(x + 7) = 4x + 8 is a shortcut');
  // the card's own move is never called a shortcut
  const C = makeBox(p, { stage: st, level: 4, rng: makeRng(9) });
  const r = C.press(DIST);
  assert.ok(r.closer && !r.shortcut);
});
