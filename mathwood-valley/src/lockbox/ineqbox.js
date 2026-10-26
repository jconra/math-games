// One inequality box being worked (ineq.js): the same shape as an equation box (box.js makeBox), so the panel can
// play it the same way: moves on every room, undo, the jam guard, hints, stars and gold.
// What is different:
//   - the line is a state of one or two chains ("or"); a move is done to every room of the chain being worked, and
//     once that chain reads x < 4 the next one (if any) is worked;
//   - once every chain has x alone, the answer is picked from four number lines (lineChoices / pickLine): a wrong
//     picture is counted (the box is no longer clean) but, like every working-out pick, it costs no star;
//   - the check (keyTest) puts a number from the shaded part into the beginning inequality.

import { starsFor, goldFor } from './box.js';
import { moveLabel } from './engine.js';
import { trapTag } from './buttons.js';
import { ARITH_OF } from './parts.js';
import * as Q from './ineq.js';

export function makeIneqBox(problem, { stage, level = 4, rng, fav = null, tier = 'iron' } = {}) {
  const st = stage;
  const form = problem.start.form;
  const start = { ...Q.cloneState(problem.start), active: 0 };
  const dOf = (s) => s.chains.reduce((n, c) => n + Q.solveChain(c, st).d, 0);
  const sOf = (s) => s.chains.reduce((n, c) => n + Q.chainCardLeft(c, st), 0);
  const d0 = dOf(start), s0 = sOf(start);
  const par = problem.par;
  const ledger = [{ line: start, d: d0, s: s0, move: null, closer: null, struck: false, undone: false, parent: -1 }];
  let active = [0];
  // what the card needed at the start (a step the chain never needs is skipped)
  const firstRoute = start.chains.map((c) => Q.chainRoute(c, st) || []);
  const plan = { hard: true, needs: { sort: firstRoute.some((r) => r.some((s) => s.step === 'sort')), free: firstRoute.some((r) => r.some((s) => s.step === 'free')) } };
  let choices = null;

  const B = {
    problem, stage, tier, par, level, ineq: true, form,
    cardSteps: Q.INEQ_STEPS[form], goldenRule: Q.INEQ_RULE[form], plan,
    moves: 0, hintLevel: 0, notCloser: 0, jammed: false, jamFired: false, solved: false, chainsSolved: false, flipped: 0,
    keyOk: null, keyFailed: false, left: false, wrongPicks: 0, productSlips: 0, partSlips: 0, lineSlips: 0,
    traps: [], tools: [], arith: [], firstCloser: null, buttons: null,
    ledger,
    get index() { return active[active.length - 1]; },
    get entry() { return ledger[active[active.length - 1]]; },
    get line() { return this.entry.line; },
    get d() { return this.entry.d; },
    get trail() { return active.map((i) => ledger[i]); },
    get chain() { return this.line.chains[this.line.active]; },
    get togo() {
      if (this.chainsSolved) return 0;
      const e = this.entry;
      const viaSearch = Number.isFinite(e.d) ? e.d + (par - d0) : Infinity;
      const v = Math.min(Number.isFinite(e.s) ? e.s : Infinity, viaSearch);
      return Number.isFinite(v) ? Math.max(0, v) : par;
    },
  };

  B.makeButtons = function () {
    if (B.chainsSolved || B.solved) { B.buttons = null; return null; }
    B.buttons = Q.chainButtons(B.chain, st, { rng, fav });
    return B.buttons;
  };

  B.press = function (move) {
    const before = B.line, dBefore = B.d, sBefore = B.entry.s;
    const ci = before.active;
    const r = Q.applyChain(before.chains[ci], move, true);
    if (!r) return null;
    B.moves++;
    const out = { form, chains: before.chains.map((c, k) => (k === ci ? r.out : c)), active: ci };
    const chainDone = Q.chainSolved(r.out);
    if (chainDone) { const nx = out.chains.findIndex((c) => !Q.chainSolved(c)); if (nx >= 0) out.active = nx; }
    const all = Q.stateSolved(out);
    const dAfter = dOf(out), sAfter = sOf(out);
    const closer = dAfter < dBefore || (Number.isFinite(sBefore) && sAfter < sBefore);
    let tag = null;
    if (!closer) {
      const goods = B.buttons?.goods?.map((b) => b.move) ?? [];
      const c = before.chains[ci];
      tag = trapTag(move, goods, { L: [].concat(...c.rooms.slice(0, -1)), R: c.rooms[c.rooms.length - 1] });
      if (tag !== 'meh') B.traps.push(tag);
    }
    if (r.flipped) B.flipped++;
    const kind = move.k === 'add' ? `add${move.term.t}` : move.k;
    if (!B.tools.includes(kind)) B.tools.push(kind);
    ledger.push({ line: out, d: dAfter, s: sAfter, move, closer, struck: false, undone: false, flipped: r.flipped, parent: active[active.length - 1] });
    active.push(ledger.length - 1);
    if (closer && !B.firstCloser) B.firstCloser = { move };
    B.notCloser = closer ? 0 : B.notCloser + 1;
    const res = { move, label: moveLabel(move), before, out, mid: r.mid, ev: r.ev, closer, dBefore, dAfter, tag, jam: null,
      opposite: false, shortcut: false, flipped: r.flipped, chainDone, solved: false, ci };
    if (all) { B.chainsSolved = true; res.solved = true; return res; }
    const overPar = B.moves > par + 3 && !B.jamFired && !closer;
    if (B.notCloser >= 3 || overPar || !Number.isFinite(dAfter)) {
      if (overPar) B.jamFired = true;
      res.jam = B.rewind();
    }
    return res;
  };

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
    if (active.length < 2 || B.solved || B.chainsSolved) return false;
    const li = active.pop();
    ledger[li].undone = true;
    return true;
  };

  // ----- the answer on a number line -----
  B.answerSet = () => Q.stateSet(B.line);
  B.lineChoices = function () {
    if (!choices) choices = Q.lineChoices(B.answerSet(), { rng });
    return choices;
  };
  B.pickLine = function (choice) {
    if (choice.right) { B.solved = true; return true; }
    B.wrongPicks++;
    B.lineSlips++;
    return false;
  };

  // ----- hints -----
  const targetsOf = (state, m) => {
    const out = [];
    const ci = state.active;
    state.chains[ci].rooms.forEach((room, i) => room.forEach((t, j) => {
      const side = Q.roomId(ci, i);
      if (m.k === 'add' && t.t === m.term.t && t.v.eq(m.term.v.neg())) out.push({ side, index: j });
      else if (m.k === 'div' && t.t === 'x' && t.v.eq(m.f)) out.push({ side, index: j });
      else if (m.k === 'mul' && t.t === 'x' && t.v.d === Math.abs(m.f.n)) out.push({ side, index: j });
      else if (m.k === 'flip' && t.t === 'x' && t.v.n < 0) out.push({ side, index: j });
    }));
    return out;
  };
  B.hint = function () {
    B.hintLevel = Math.min(3, B.hintLevel + 1);
    return B.hintAt(B.hintLevel);
  };
  B.hintAt = function (lvl) {
    const goodsShown = B.buttons?.slots?.filter((b) => b && b.role === 'good') || [];
    const shown = goodsShown.find((b) => b.card) || goodsShown[0];
    const move = shown ? shown.move : null;
    const targets = move ? targetsOf(B.line, move) : [];
    const now = B.steps().find((s) => s.state === 'now');
    if (lvl === 1) return { level: 1, text: now ? `Step ${now.n}: ${now.label}.` : 'What is in x’s way?', targets: goodsShown.flatMap((g) => targetsOf(B.line, g.move)), step: now ? now.n : null };
    const rooms = B.chain.rooms.length === 3 ? 'every room' : 'both sides';
    let text = `Do the same to ${rooms}.`;
    if (move?.k === 'add') text = `Its opposite cancels it. Do it to ${rooms}.`;
    else if (move?.k === 'div') text = `x is being multiplied: divide ${rooms}.${move.f.n < 0 ? ' A negative turns the sign round.' : ''}`;
    else if (move?.k === 'mul') text = `x is being divided: multiply ${rooms}.${move.f.n < 0 ? ' A negative turns the sign round.' : ''}`;
    else if (move?.k === 'flip') text = 'That is the opposite of x. ·(−1) flips every chip, and the sign turns round.';
    if (lvl === 2) return { level: 2, text, targets, move, flip: move && move.k === 'add' ? move : null };
    return { level: 3, text: `Try ${move ? moveLabel(move) : 'this one'}.`, targets, move, key: shown?.key };
  };

  B.canLeave = (secondsOpen) => secondsOpen >= 60 || B.hintLevel >= 2;

  // ----- the steps card -----
  // each step: { n, id, label, short, skip, state: 'done' | 'skip' | 'now' | 'todo', note }
  B.steps = function ({ checked = false } = {}) {
    const s = B.line;
    const done = {};
    if (form === 'or') {
      done.first = Q.chainSolved(s.chains[0]);
      done.second = Q.chainSolved(s.chains[1]);
    } else {
      const step = Q.chainStep(s.chains[0], st);
      done.sort = step !== 'sort';
      done.free = step === 'done';
    }
    done.line = B.solved;
    done.check = checked;
    const skip = { sort: !plan.needs.sort, free: !plan.needs.free };
    let nowAt = false;
    return Q.INEQ_STEPS[form].map((x) => {
      let state;
      if (skip[x.id]) state = 'skip';
      else if (done[x.id]) state = 'done';
      else if (!nowAt) { state = 'now'; nowAt = true; } else state = 'todo';
      const skipText = x.id === 'free' && skip.free ? 'Sorting frees x' : x.skip;
      const note = x.id === 'free' && B.flipped && (state === 'done' || state === 'now') ? 'the sign turned round' : '';
      return { n: x.n, id: x.id, label: x.label, short: x.short, skip: skipText, state, note };
    });
  };

  B.starsNow = function () {
    const finish = B.chainsSolved ? B.moves : B.moves + (Number.isFinite(B.d) ? B.d : 0);
    return starsFor(finish, par, B.hintLevel);
  };

  // the check: a number from the shaded part, in the beginning inequality
  B.keyTest = function () {
    const set = B.answerSet();
    if (!set) return null;
    const x = Q.testValue(set);
    return { x, set, ...Q.checkRows(start, x) };
  };
  B.keyResult = function (ok) { if (!ok) B.keyFailed = true; B.keyOk = B.keyOk === false ? false : ok; };

  // the working-out picks are gentle (counted, no move, no star; the box stays clean), as box.js
  B.productPick = function (right) { if (!right) B.productSlips++; return right; };
  B.partPick = function (right, q = null, choice = null) {
    if (right) return true;
    B.partSlips++;
    const adding = q && (q.kind === 'sum' || q.kind === 'join') && q.a && q.a.t === 'n';
    if (adding && choice && ARITH_OF[choice.tag]) B.arith.push(ARITH_OF[choice.tag]);
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
      wrongPicks: B.wrongPicks, productSlips: B.productSlips, partSlips: B.partSlips, lineSlips: B.lineSlips };
  };

  B.lineText = () => Q.stateText(B.line);
  B.makeButtons();
  return B;
}
