// One lock box being worked: the lines so far, undo, the jam guard, hints, stars and gold.
// The panel draws it; nothing here touches the page, so the node tests can play a whole box.
//
// The rules:
//   - A press is "closer" when the fewest moves left drops, or when it follows the steps card (steps.js): the card's
//     own order can be longer than the shortest route (opening the brackets on 3(x + 2) = 18 before dividing), and a
//     kid who follows the rules is never told "not closer". A legal press that isn't closer plays out honestly; it
//     just costs a step against par.
//   - Par is the fewest moves, or the card's count when that is longer, so following the card earns every star and a
//     shortcut still counts.
//   - Undo is free, but the undone press still counts as a move (so tapping and undoing to probe doesn't pay).
//   - Jam guard: after 3 not-closer presses in a row, or once the moves go past par + 3, the lock jams and
//     rewinds to the last line that was still on a good path (the line with the most progress), keeping what was
//     earned; hint 1 opens on its own.
//   - Hints: 1 Look (free), 2 Rule (caps the box at 2 stars), 3 Show (caps it at 1 star).
//   - −x = 7 is not solved.
//   - Stars: 3 at par, 2 at par + 1 or + 2, 1 for any finish; a finish never earns 0.
//   - Gold by box tier: tin 10, iron 20, brass 35, vault 60; 3 stars pays in full, 2 stars 80%, 1 star 60%.
//   - Clean (for the ladder): solved within par + 1, no hint past the first, the check passed, no jam, and no wrong
//     pick (a warm-up coin, or a tidied line on the do-the-arithmetic level). Working out the parts of a move
//     (parts.js) and the products of brackets is gentle: a wrong answer there is counted but costs nothing.
//   - B.togo: moves still to go on par's scale (the tumblers); B.steps(): the steps card's state on the current line;
//     a press result's shortcut flag: not one of the card's moves, and fewer moves to go than the card's own route
//     (dividing first in 3(x + 2) = 18).

import {
  applyMove, solve, lineText, isSolved, solvedValue, isOppositeOfX, moveLabel, moveId,
  F, evalSide, keySteps, lineKey,
} from './engine.js';
import { buildButtons, trapTag } from './buttons.js';
import { verdictOf, RUNG, VERDICT } from './generate.js';
import { stepsLeft, stepsMoves, stepsPlan, stepsStatus, currentStep } from './steps.js';
import { ARITH_OF } from './parts.js';
import { kHint } from './kbox.js';
import { findHint } from './findx.js';

export const TIER_GOLD = { tin: 10, iron: 20, brass: 35, vault: 60 };
export const TIER_NAME = { tin: 'Tin lockbox', iron: 'Iron strongbox', brass: 'Brass express safe', vault: 'Vault car' };
const STAR_PAY = { 3: 1, 2: 0.8, 1: 0.6 };

export function starsFor(moves, par, hintLevel = 0) {
  let s = moves <= par ? 3 : moves <= par + 2 ? 2 : 1;
  if (hintLevel >= 2) s = Math.min(s, 2);
  if (hintLevel >= 3) s = Math.min(s, 1);
  return s;
}

export function goldFor(tier, stars) { return Math.round((TIER_GOLD[tier] ?? TIER_GOLD.iron) * (STAR_PAY[stars] ?? 0)); }

// makeBox(problem, { stage, level, rng, fav, tier }) -> B
export function makeBox(problem, { stage, level = 4, rng, fav = null, tier = 'iron' } = {}) {
  const pick = problem.mode !== 'moves';
  const start = problem.start;
  // the vault rung's "infinitely many / no solution" boxes are finished by a verdict, not by x = N
  const verdictGoal = VERDICT;
  const distOf = (l) => (problem.kind === 'one' ? solve(l, stage) : solve(l, stage, verdictGoal)).d;
  const d0 = pick ? 1 : distOf(start);
  // the steps card: its goal is x = N, or the verdict on an "infinitely many / no solution" box
  const verdictRung = !pick && !!RUNG[problem.rung]?.verdicts;
  const cardGoal = problem.kind === 'one' ? null : (l) => verdictOf(l);
  const cardLeft = (l) => (pick ? 0 : stepsLeft(l, stage, cardGoal));
  const s0 = cardLeft(start);
  const par = pick ? problem.par : Math.max(problem.par, Number.isFinite(s0) ? s0 : 0);
  // every line ever written, in order (the ledger); "active" is the current trail from the start (undo pops it)
  // parent = the ledger index of the line this one was made from (the start line has none)
  const ledger = [{ line: start, d: d0, s: s0, move: null, closer: null, struck: false, undone: false, parent: -1 }];
  let active = [0];
  const B = {
    problem, stage, tier, par, level,
    moves: 0, hintLevel: 0, notCloser: 0, jammed: false, jamFired: false, solved: false,
    keyOk: null, keyFailed: false, left: false, wrongPicks: 0, productSlips: 0, partSlips: 0,
    traps: [], tools: [], arith: [], firstCloser: null, buttons: null,
    ledger,
    get index() { return active[active.length - 1]; },
    get entry() { return ledger[active[active.length - 1]]; },
    get line() { return this.entry.line; },
    get d() { return this.entry.d; },
    get trail() { return active.map((i) => ledger[i]); },
    // moves still to go, on par's scale (for the tumblers): the card's count, or the shortest route plus however
    // much longer the card's route was at the start, whichever is less
    get togo() {
      if (this.solved) return 0;
      const e = this.entry;
      const viaSearch = Number.isFinite(e.d) ? e.d + (par - d0) : Infinity;
      const v = Math.min(Number.isFinite(e.s) ? e.s : Infinity, viaSearch);
      return Number.isFinite(v) ? Math.max(0, v) : par;
    },
    plan: pick ? null : stepsPlan(start, stage, { verdict: verdictRung }),
  };

  // Is this result line one the card's own moves reach from that line? (the card's next move, or the same step done
  // another way: steps.js stepsMoves)
  const onCard = (from, out) => {
    const k = lineKey(out);
    return stepsMoves(from, stage, cardGoal).some((m) => { const r = applyMove(from, m); return r && lineKey(r.out) === k; });
  };

  B.makeButtons = function () {
    if (pick || B.solved) { B.buttons = null; return null; }
    // the moves that follow the steps card always show (one of them) and count as productive
    const steps = stepsMoves(B.line, stage, cardGoal);
    if (problem.kind !== 'one') {
      // vault boxes: closer means the verdict shows sooner (the panel adds the two verdict buttons)
      B.buttons = buildButtons(B.line, stage, { count: 4, rng, fav, steps, ...verdictGoal });
      return B.buttons;
    }
    B.buttons = buildButtons(B.line, stage, { count: 4, rng, fav, steps });
    return B.buttons;
  };

  // Press a move. Returns what happened, for the panel to animate:
  // { move, label, before, mid, out, ev, closer, dBefore, dAfter, tag, jam: null|{ to, struck: [...] },
  //   opposite: bool (−x = N reached), solved: bool }
  B.press = function (move) {
    const before = B.line, dBefore = B.d, sBefore = B.entry.s;
    const r = applyMove(before, move, true);
    if (!r) return null;
    B.moves++;
    const dAfter = distOf(r.out);
    const sAfter = cardLeft(r.out);
    // closer: the shortest route got shorter, or the card's count came down (only from a count the card can finish:
    // from a line its order can't solve, any press that lands on one it can would look like progress)
    const cardStep = Number.isFinite(sBefore) && sAfter < sBefore;
    const closer = dAfter < dBefore || cardStep;
    let tag = null;
    if (!closer) {
      const goods = B.buttons?.goods?.map((b) => b.move) ?? solve(before, stage).goodMoves;
      tag = trapTag(move, goods, before);
      if (tag !== 'meh') B.traps.push(tag);
    }
    if (!B.tools.includes(move.k === 'add' ? `add${move.term.t}` : move.k)) B.tools.push(move.k === 'add' ? `add${move.term.t}` : move.k);
    ledger.push({ line: r.out, d: dAfter, s: sAfter, move, closer, struck: false, undone: false, mid: r.mid || null, ev: r.ev,
      parent: active[active.length - 1] });
    active.push(ledger.length - 1);
    if (closer && !B.firstCloser) B.firstCloser = { move, ev: r.ev };
    B.notCloser = closer ? 0 : B.notCloser + 1;
    const res = { move, label: moveLabel(move), before, mid: r.mid || null, out: r.out, ev: r.ev, closer, dBefore, dAfter,
      tag, jam: null, opposite: isOppositeOfX(r.out), solved: false,
      // a shortcut: a move the card doesn't make from here that gets there in fewer moves than the card would
      // (÷3 first on 3(x + 2) = 18: 2 moves against the card's 3). Only from a line the card can finish.
      shortcut: Number.isFinite(sBefore) && dAfter < dBefore && 1 + dAfter < sBefore && !onCard(before, r.out) };
    if (problem.kind === 'one' && isSolved(r.out)) { B.solved = true; res.solved = true; return res; }
    // the jam guard (the past-par rule only fires on a not-closer press, so a kid finishing strong isn't rewound)
    const overPar = B.moves > par + 3 && !B.jamFired && !closer;
    if (B.notCloser >= 3 || overPar || !Number.isFinite(dAfter)) {
      if (overPar) B.jamFired = true;
      res.jam = B.rewind();
    }
    return res;
  };

  // Rewind to the last good line: the line just before the current run of not-closer presses on the trail,
  // so whatever progress came before the slip is kept.
  B.rewind = function () {
    let best = active.length - 1;
    while (best > 0 && ledger[active[best]].closer === false) best--;
    const struck = active.slice(best + 1);
    struck.forEach((li) => { ledger[li].struck = true; });
    active = active.slice(0, best + 1);
    B.jammed = true;
    B.notCloser = 0;
    if (B.hintLevel < 1) B.hintLevel = 1;
    return { to: active[active.length - 1], struck };
  };

  B.undo = function () {
    if (active.length < 2 || B.solved) return false;
    const li = active.pop();
    ledger[li].undone = true;
    return true;
  };

  // R15: the kid says "infinitely many solutions" ('all') or "no solution" ('none').
  // Saying the right verdict once it shows is free; a wrong or early verdict costs a move.
  B.verdict = function (v) {
    const shown = verdictOf(B.line);
    if (shown && shown === v && problem.kind === v) { B.solved = true; return { ok: true }; }
    B.moves++;
    B.notCloser++;
    return { ok: false, shown, wanted: problem.kind };
  };

  // Warm-up rungs: the kid picks a coin or a key.
  B.choose = function (value) {
    B.moves++;
    if (value === problem.answer) { B.solved = true; return { ok: true }; }
    B.wrongPicks++;
    return { ok: false };
  };

  // Ask Hob. Returns the hint for the next level: { level, text, targets: [{ side, index }], move, flip }
  B.hint = function () {
    const lvl = Math.min(3, B.hintLevel + 1);
    B.hintLevel = lvl;
    return B.hintAt(lvl);
  };
  B.hintAt = function (lvl) {
    if (pick && problem.mode === 'count') return { level: lvl, text: kHint(problem, lvl), targets: [] };   // (kbox.js)
    if (pick && problem.find) return { level: lvl, text: findHint(problem, lvl), targets: [] };   // (findx.js)
    if (pick) {
      const texts = problem.mode === 'balance'
        ? ['Both sides are equal.', 'Work out the full side first.', `It's ${problem.answer}.`]
        : ['Try a number for x.', 'Which number plus the rest makes the other side?', `x = ${problem.answer} makes it true.`];
      return { level: lvl, text: texts[lvl - 1], targets: [] };
    }
    const sol = solve(B.line, stage);
    const goods = B.buttons?.goods?.length ? B.buttons.goods.map((b) => b.move) : sol.goodMoves;
    // (when two productive buttons show, the hints point at the card's own move, not the shortcut)
    const goodsShown = B.buttons?.slots?.filter((b) => b && b.role === 'good') || [];
    const shown = goodsShown.find((b) => b.card) || goodsShown[0];
    const move = shown ? shown.move : goods[0];
    const targets = move ? targetsOf(B.line, move) : [];
    // on the vault rung the kid doesn't know yet whether x has one value, every value or none
    const look = RUNG[problem.rung]?.verdicts ? 'Tidy both sides, then compare them.' : "What's in x's way?";
    // hint 1 points at the step on the card the kid is on (the panel lights that step)
    const now = currentStep(B.steps());
    const lookText = !now ? look : now.id === 'division' && now.note ? `Step ${now.n}: ${now.label}: ${now.note}.`
      : (now.note || `Step ${now.n}: ${now.label}.`);
    if (lvl === 1) return { level: 1, text: lookText, targets: goods.flatMap((g) => targetsOf(B.line, g)), step: now ? now.n : null };
    if (lvl === 2) return { level: 2, text: ruleText(move, B.line), targets, move, flip: move && move.k === 'add' ? move : null };
    return { level: 3, text: `Try ${move ? moveLabel(move) : 'this one'}.`, targets, move, key: shown?.key };
  };

  B.canLeave = (secondsOpen) => secondsOpen >= 60 || B.hintLevel >= 2;

  // The steps card's state on the current line (null on the warm-up rungs). checked = the check has run.
  B.steps = function ({ checked = false } = {}) {
    if (pick) return null;
    return stepsStatus(B.line, B.plan, { solved: B.solved, checked, verdictShown: verdictRung && !!verdictOf(B.line) });
  };

  B.starsNow = function () {
    const finish = B.solved ? B.moves : B.moves + (Number.isFinite(B.d) ? B.d : 0);
    return starsFor(finish, par, B.hintLevel);
  };

  // The check: put x into the ORIGINAL line, side by side (the panel plays it as an animation).
  B.keyTest = function () {
    const x = problem.kind === 'one' ? (problem.mode === 'moves' ? solvedValue(B.line) : F(problem.answer)) : null;
    if (x === null) return null;
    return { x, left: keySteps(start.L, x), right: keySteps(start.R, x), value: evalSide(start.L, x) };
  };
  B.keyResult = function (ok) { if (!ok) B.keyFailed = true; B.keyOk = B.keyOk === false ? false : ok; };

  // Opening the brackets by hand (products.js): a wrong product costs no move, no star and doesn't spoil a clean box;
  // it is only counted, so a grown-up can see it.
  B.productPick = function (right) { if (!right) B.productSlips++; return right; };

  // Working out each part of a move (parts.js), gentle in the same way: a wrong answer costs no move and no star and
  // keeps the box clean. It is counted (partSlips), and a slip adding two numbers is also counted by its kind for the
  // ladder (algebra.js ARITH_TAGS: the Grown-ups corner names the adding slip a kid makes most).
  B.partPick = function (right, q = null, choice = null) {
    if (right) return true;
    B.partSlips++;
    const adding = q && (q.kind === 'sum' || q.kind === 'join') && q.a && q.a.t === 'n';
    if (adding && choice && ARITH_OF[choice.tag]) B.arith.push(ARITH_OF[choice.tag]);
    return false;
  };

  // Do the arithmetic (level 5): the kid picked a tidied line. A wrong one is counted by its slip (tidy.js tags);
  // it costs no move, but the box is no longer clean.
  B.tidyPick = function (card) {
    if (card.right) return true;
    B.wrongPicks++;
    if (card.tag) B.arith.push(card.tag);
    return false;
  };

  B.finish = function ({ left = false } = {}) {
    B.left = left;
    const solved = B.solved && !left;
    const stars = solved ? starsFor(B.moves, par, B.hintLevel) : 0;
    const gold = solved ? goldFor(tier, stars) : 0;
    const clean = solved && B.moves <= par + 1 && B.hintLevel <= 1 && !B.keyFailed && !B.jammed && B.wrongPicks === 0;
    return { solved, stars, gold, moves: B.moves, par, rung: problem.rung, clean, hints: B.hintLevel,
      jammed: B.jammed, keyFailed: B.keyFailed, left, traps: [...B.traps], tools: [...B.tools], arith: [...B.arith],
      wrongPicks: B.wrongPicks, productSlips: B.productSlips, partSlips: B.partSlips };
  };

  B.lineText = () => lineText(B.line);
  B.makeButtons();
  return B;
}

// Which chips a move works on: for "+6" the −6 coins it cancels, for "÷12" the 12x card, and so on.
export function targetsOf(l, m) {
  const out = [];
  const each = (fn) => { l.L.forEach((t, i) => { if (fn(t)) out.push({ side: 'L', index: i }); }); l.R.forEach((t, i) => { if (fn(t)) out.push({ side: 'R', index: i }); }); };
  if (m.k === 'add') {
    each((t) => t.t === m.term.t && t.v.eq(m.term.v.neg()));
    if (!out.length) each((t) => t.t === m.term.t);
  } else if (m.k === 'div') each((t) => (t.t === 'x' && t.v.eq(m.f)) || (t.t === 'b' && t.p.eq(m.f)));
  else if (m.k === 'mul') each((t) => (t.t === 'x' && t.v.d === Math.abs(m.f.n)) || (t.t === 'b' && t.p.d === Math.abs(m.f.n)));
  else if (m.k === 'flip') each((t) => t.t === 'x' && t.v.n < 0);
  else if (m.k === 'dist') each((t) => t.t === 'b');
  else if (m.k === 'comb') {
    for (const side of ['L', 'R']) {
      const s = l[side];
      for (const k of ['n', 'x']) {
        const idx = s.map((t, i) => (t.t === k ? i : -1)).filter((i) => i >= 0);
        if (idx.length > 1) idx.forEach((i) => out.push({ side, index: i }));
      }
    }
  }
  if (!out.length && m.k === 'div') each((t) => t.t === 'x');
  return out;
}

function ruleText(m, l) {
  if (!m) return 'Do the same to both sides.';
  if (m.k === 'add') return 'Its opposite cancels it.';
  if (m.k === 'div' && l && [...l.L, ...l.R].some((t) => t.t === 'b' && t.p.eq(m.f))) return 'The whole bracket is multiplied. Divide to undo it.';
  if (m.k === 'div') return 'x is being multiplied. Divide to undo it.';
  if (m.k === 'mul' && l && [...l.L, ...l.R].some((t) => t.t === 'b' && t.p.d > 1)) return `The whole top is divided by ${m.f.n}. Multiply both sides by ${m.f.n}.`;
  if (m.k === 'mul') return 'x is being divided. Multiply to undo it.';
  if (m.k === 'flip') return 'That is the opposite of x. Flip every chip.';
  if (m.k === 'dist') return 'Open the brackets first.';
  if (m.k === 'comb') return 'Put like terms together.';
  return 'Do the same to both sides.';
}

export { moveId };
