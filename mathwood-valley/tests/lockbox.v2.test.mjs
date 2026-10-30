// Lock box v2: opening the brackets by hand (products.js), a full tray with other right ways, rare "infinitely many /
// no solution" boxes, and the whole-side-over-a-number rung (R9b).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lockbox/engine.js';
import { generate, makeRng, RUNG, VERDICT_SHARE } from '../src/lockbox/generate.js';
import { buildButtons } from '../src/lockbox/buttons.js';
import { makeBox } from '../src/lockbox/box.js';
import { makeAlgebra } from '../src/lockbox/algebra.js';
import { stepsMoves, stepsRoute } from '../src/lockbox/steps.js';
import { bracketProducts, productNudge, productHelp } from '../src/lockbox/products.js';

const { line, br, xt, num, F, lineText, applyMove, DIST, isSolved, sideText } = E;
const M = '−';

// ---------- opening the brackets by hand ----------

const ask = (l) => bracketProducts(l, { rng: makeRng(1) }).map((q) => ({ prompt: q.prompt, answer: q.answer, choices: q.choices }));

test('brackets: each product is asked with four different answers, one right', () => {
  const cases = [
    [line([br(5, [xt(1), num(8)])], [xt(7), num(34)]), [['5 · x', '5x'], ['5 · 8', '40']]],
    [line([br(-3, [xt(1), num(-4)])], [num(6)]), [[`${M}3 · x`, `${M}3x`], [`${M}3 · (${M}4)`, '+12']]],
    [line([num(2)], [br(4, [xt(1), num(3)])]), [['4 · x', '4x'], ['4 · 3', '12']]],
    [line([br(-1, [xt(1), num(5)])], [num(2)]), [[`${M}1 · x`, `${M}x`], [`${M}1 · 5`, `${M}5`]]],
    [line([br(2, [xt(1), num(-6)])], [num(8)]), [['2 · x', '2x'], [`2 · (${M}6)`, `${M}12`]]],
  ];
  for (const [l, want] of cases) {
    const got = ask(l);
    assert.deepEqual(got.map((q) => [q.prompt, q.answer]), want, lineText(l));
    for (const q of got) {
      assert.ok(q.choices.length >= 3 && q.choices.length <= 4, `${q.prompt}: ${q.choices.length} choices`);
      assert.equal(q.choices.filter((c) => c.right).length, 1);
      assert.equal(new Set(q.choices.map((c) => c.text.replace(/^\+/, ''))).size, q.choices.length, `twins in ${q.prompt}`);
      assert.equal(q.choices.find((c) => c.right).text, q.answer);
    }
  }
  // the classic slips are there: 5 + x and 6x for 5 · x; 13 (added) for 5 · 8; the sign slip whenever a minus is in it
  const [px, pn] = ask(cases[0][0]);
  assert.ok(px.choices.some((c) => c.text === '5 + x') && px.choices.some((c) => c.text === '6x'));
  assert.ok(pn.choices.some((c) => c.text === '13'));
  const [nx, nn] = ask(cases[1][0]);
  assert.ok(nx.choices.some((c) => c.text === '3x' && c.tag === 'sign'));
  assert.ok(nn.choices.some((c) => c.text === `${M}12` && c.tag === 'sign'));
});

test('brackets: the products fill in to exactly the line the move makes, on every brackets box', () => {
  for (const rung of ['R10', 'R14']) {
    const rng = makeRng(77);
    for (let i = 0; i < 120; i++) {
      const p = generate(rung, { rng, size: 1 + (i % 3), verdict: false });
      const qs = bracketProducts(p.start, { rng });
      assert.ok(qs.length >= 2, lineText(p.start));
      const out = applyMove(p.start, DIST).out;
      for (const side of ['L', 'R']) {
        const mine = qs.filter((q) => q.side === side).map((q) => q.product);
        const made = out[side].filter((t, k) => !p.start[side].some((s, j) => s.t !== 'b' && j === k && s === t));
        // every product is one of the terms the move writes, with the same value
        for (const t of mine) assert.ok(out[side].some((u) => u.t === t.t && u.v.eq(t.v)), `${lineText(p.start)}: ${sideText([t])}`);
        assert.ok(made.length >= mine.length);
      }
      for (const q of qs) {
        for (const c of q.choices.filter((x) => !x.right)) {
          const n = productNudge(q, c);
          assert.ok(n && !n.includes(`is ${q.answer.replace(/^\+/, '')}`) && !n.includes(`= ${q.answer}`), `the nudge gives it away: ${n} (${q.answer})`);
        }
        assert.ok(productHelp(q).length > 5);
      }
    }
  }
});

test('brackets: a wrong product costs no move, no star and keeps the box clean', () => {
  const p = { rung: 'R10', mode: 'moves', kind: 'one', start: line([br(5, [xt(1), num(8)])], [num(55)]), x: 3, par: 3 };
  const B = makeBox(p, { stage: RUNG.R10.stage, level: 4, rng: makeRng(2) });
  B.productPick(false); B.productPick(false); B.productPick(true);
  for (const m of [DIST, E.addNum(-40), E.divBy(5)]) B.press(m);
  assert.ok(B.solved);
  const r = B.finish();
  assert.equal(r.moves, 3);
  assert.ok(r.moves <= r.par);
  assert.equal(r.clean, true);
  assert.equal(r.productSlips, 2);
});

test('brackets: a group over a number is never "opened" by products', () => {
  assert.equal(bracketProducts(line([br(F(1, 2), [xt(5), num(-10)])], [num(10)])).length, 0);
});

// ---------- a full tray, with other right ways ----------

test('4x + 12 = −3x + 82: four buttons, both −12 and +3x among them, and wrong ones to steer past', () => {
  const l = line([xt(4), num(12)], [xt(-3), num(82)]);
  const st = RUNG.R13.stage;
  for (let seed = 1; seed < 30; seed++) {
    const bb = buildButtons(l, st, { count: 4, rng: makeRng(seed), steps: stepsMoves(l, st) });
    const shown = bb.slots.filter(Boolean);
    assert.equal(shown.length, 4);
    const ids = shown.map((b) => b.id);
    assert.ok(ids.includes('add:n:-12') && ids.includes('add:x:3'), ids.join(' '));
    assert.equal(shown.filter((b) => b.role !== 'good').length, 2);
  }
});

test('every slot is filled when the line allows it, with 2 right ways whenever there are 2', () => {
  for (const rung of ['R6', 'R7', 'R9b', 'R10', 'R11', 'R12', 'R13', 'R14']) {
    const rng = makeRng(300);
    const st = RUNG[rung].stage;
    let two = 0;
    for (let i = 0; i < 40; i++) {
      const p = generate(rung, { rng, size: 1 + (i % 3) });
      const B = makeBox(p, { stage: st, level: 2, rng, tier: 'iron' });   // (level 2 too: the tray is always full now)
      let guard = 0;
      while (!B.solved && guard++ < 8) {
        const bb = B.buttons;
        const shown = bb.slots.filter(Boolean);
        assert.equal(shown.length, Math.min(4, bb.all.length), `${rung} ${lineText(B.line)}: ${shown.length} of ${bb.all.length}`);
        const goods = bb.all.filter((b) => b.role === 'good');
        if (goods.length >= 2) { assert.ok(shown.filter((b) => b.role === 'good').length >= 2, `${rung} ${lineText(B.line)}`); two++; }
        B.press(shown.find((b) => b.role === 'good').move);
        B.makeButtons();
      }
      assert.ok(B.solved, lineText(p.start));
    }
    if (['R12', 'R13', 'R14'].includes(rung)) assert.ok(two > 10, `${rung}: only ${two} lines with two right ways`);
  }
});

test('another right way solves at par: always pressing the right button that is NOT the card’s next move', () => {
  for (const rung of ['R10', 'R12', 'R13', 'R14']) {
    const rng = makeRng(901);
    const st = RUNG[rung].stage;
    let alt = 0;
    for (let i = 0; i < 60; i++) {
      const p = generate(rung, { rng, size: 1 + (i % 3) });
      const B = makeBox(p, { stage: st, level: 4, rng, tier: 'iron' });
      let guard = 0;
      while (!B.solved && guard++ < 10) {
        const goods = B.buttons.slots.filter((b) => b && b.role === 'good');
        const canon = stepsRoute(B.line, st)?.[0]?.move;
        const other = goods.find((b) => !canon || E.moveId(b.move) !== E.moveId(canon));
        if (other) alt++;
        const r = B.press((other || goods[0]).move);
        assert.ok(r.closer, `${lineText(B.line)}: ${E.moveLabel((other || goods[0]).move)} not closer`);
        B.makeButtons();
        // the steps card and the hints still make sense on the new line
        if (!B.solved) { assert.ok(B.steps().some((s) => s.state === 'now')); assert.ok(B.hintAt(1).text); assert.ok(B.hintAt(3).move); }
      }
      assert.ok(B.solved, lineText(p.start));
      assert.ok(B.moves <= B.par, `${lineText(p.start)}: ${B.moves} moves for par ${B.par}`);
    }
    assert.ok(alt > 20, `${rung}: an alternative was pressed only ${alt} times`);
  }
});

// ---------- "infinitely many / no solution" boxes are rare ----------

test('the vault rung: about 1 box in 10 is a verdict box, never two in a row, never right after a level-up', () => {
  for (let run = 0; run < 3; run++) {
    const state = { v: 1, rung: 'R15', placing: false, levels: { R15: 2 }, stamped: [] };
    const alg = makeAlgebra(state, { rng: makeRng(500 + run) });
    let n = 0, verdicts = 0, prevVerdict = false;
    const rng = makeRng(7 + run);
    for (let i = 0; i < 1500; i++) {
      const before = state.levels.R15;
      const p = alg.next('iron');
      if (p.rung !== 'R15') { prevVerdict = false; alg.record({ rung: p.rung, solved: true, clean: true }); continue; }
      n++;
      const v = p.kind !== 'one';
      if (v) { verdicts++; assert.ok(!prevVerdict, `two verdict boxes in a row at box ${i}`); }
      prevVerdict = v;
      // a clean box most of the time, so the level climbs (and drops) now and then
      const clean = rng.chance(0.8);
      alg.record({ rung: 'R15', solved: true, clean, moves: 3, par: 3 });
      // (the inequalities come after the vault now: stamping it would move this kid on, so they stay on the vault)
      if (state.rung !== 'R15') { state.rung = 'R15'; state.stamped = state.stamped.filter((r) => r !== 'R15'); }
      if (state.levels.R15 > before) {
        const q = alg.next('iron');
        if (q.rung === 'R15') { assert.equal(q.kind, 'one', 'a verdict box right after a level-up'); n++; prevVerdict = false; }
        alg.record({ rung: q.rung, solved: true, clean: true, moves: 3, par: 3 });
      }
    }
    const share = verdicts / n;
    assert.ok(n > 300, `only ${n} vault-rung boxes`);
    assert.ok(share > 0.03 && share <= 0.12, `verdict share ${share.toFixed(3)} (${verdicts} of ${n})`);
  }
  // and generate on its own (the test page, a chosen rung) keeps them rare too
  for (let s = 0; s < 3; s++) {
    const rng = makeRng(40 + s);
    let v = 0;
    for (let i = 0; i < 400; i++) if (generate('R15', { rng }).kind !== 'one') v++;
    assert.ok(v / 400 <= VERDICT_SHARE + 0.05, `generate alone: ${v} of 400`);
  }
});

test('every rung but the vault never makes a verdict box', () => {
  for (const r of ['R12', 'R13', 'R14', 'R9b']) {
    const rng = makeRng(3);
    for (let i = 0; i < 50; i++) assert.equal(generate(r, { rng }).kind, 'one');
  }
});

// ---------- (5x − 10)/2 = 10: a whole side over a number ----------

const R9 = RUNG.R9b.stage;
const over = (d, a, b) => br(F(1, d), [xt(a), num(b)]);

test('R9b: written with the whole top over the number, and generated with whole answers inside ±99', () => {
  assert.equal(lineText(line([over(2, 5, -10)], [num(10)])), `(5x ${M} 10)/2 = 10`);
  const rng = makeRng(99);
  let right = 0;
  for (let i = 0; i < 300; i++) {
    const p = generate('R9b', { rng, size: 1 + (i % 3) });
    assert.ok(p, 'generated');
    assert.ok(Number.isInteger(p.x), `x = ${p.x}`);
    const t = E.trueAnswer(p.start);
    assert.equal(t.kind, 'one');
    assert.ok(t.x.eq(F(p.x)));
    assert.ok([...p.start.L, ...p.start.R].some(E.isOver), lineText(p.start));
    if (p.start.R.some(E.isOver)) right++;
    // along the card's route every number stays within ±99 and whole
    let cur = p.start;
    const route = stepsRoute(cur, R9);
    assert.ok(route && route[0].step === 2 && route[0].move.k === 'mul', `${lineText(p.start)} starts by clearing the division`);
    for (const s of route) {
      cur = applyMove(cur, s.move).out;
      for (const v of E.allValues(cur)) assert.ok(Math.abs(v.n) <= 99, lineText(cur));
    }
    assert.ok(isSolved(cur) && E.solvedValue(cur).eq(F(p.x)), lineText(cur));
    assert.ok(p.par <= 3);
  }
  assert.ok(right > 20, `over a number on the right side: ${right}`);
});

test('R9b: (5x − 10)/2 = 10 and its variants solve by the card, with the right words and traps', () => {
  const cases = [
    [line([over(2, 5, -10)], [num(10)]), 6],
    [line([over(5, 3, 4)], [num(2)]), 2],
    [line([over(4, 2, -6)], [num(-3)]), -3],
    [line([num(4)], [over(3, 2, 6)]), 3],
  ];
  for (const [start, x] of cases) {
    const d = (start.L.find(E.isOver) || start.R.find(E.isOver)).p.d;
    const s = E.solve(start, R9);
    const p = { rung: 'R9b', mode: 'moves', kind: 'one', start, x, par: s.d };
    const B = makeBox(p, { stage: R9, level: 4, rng: makeRng(4) });
    assert.equal(B.hintAt(1).text, `Step 2: Clear the division: multiply both sides by ${d}.`);
    assert.equal(B.hintAt(2).text, `The whole top is divided by ${d}. Multiply both sides by ${d}.`);
    assert.equal(B.steps()[1].note, `multiply both sides by ${d}`);
    assert.equal(B.steps()[0].state, 'skip', 'no brackets to open');
    // the traps: dividing by the number (the wrong undo), a number stuck over the bar
    const all = B.buttons.all;
    // (÷d is only a legal move when the other side divides evenly: (5x − 10)/2 = 10 yes, (3x + 4)/5 = 2 no)
    const divd = all.find((b) => b.id === `div:${d}`);
    if (x === 6) assert.ok(divd, '÷2 is offered on (5x − 10)/2 = 10');
    if (divd) assert.equal(divd.tag, 'undo', `÷${d} is an undo trap on ${lineText(start)}`);
    assert.ok(all.some((b) => b.tag === 'inside'), `a number over the bar is a trap on ${lineText(start)}`);
    const r0 = B.press(E.mulBy(d));
    assert.ok(r0.closer);
    assert.ok(!r0.out.L.some(E.isOver) && !r0.out.R.some(E.isOver), `·${d} clears the bar: ${lineText(r0.out)}`);
    B.makeButtons();
    let guard = 0;
    while (!B.solved && guard++ < 6) { B.press(B.buttons.slots.find((b) => b && b.card)?.move || B.buttons.goods[0].move); B.makeButtons(); }
    assert.ok(B.solved && E.solvedValue(B.line).eq(F(x)), lineText(B.line));
    assert.ok(B.moves <= B.par);
    // the check puts x into the whole top
    const k = E.keySteps(start.L.some(E.isOver) ? start.L : start.R, x);
    assert.match(k[0], /^\(.*\)\/\d+$/);
  }
});

test('R9b sits on the ladder right after the division rungs, before brackets', () => {
  const ids = Object.keys(RUNG);
  assert.equal(ids.indexOf('R9b'), ids.indexOf('R9') + 1);
  assert.equal(ids.indexOf('R10'), ids.indexOf('R9b') + 1);
});
