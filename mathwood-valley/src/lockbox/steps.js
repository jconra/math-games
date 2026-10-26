// The steps card: the same six rules for every equation, with the golden rule on top.
//
//   Whatever you do to one side, do to the other.
//   1 Open the brackets   2 Clear the division   3 Tidy each side   4 x's on one side, numbers on the other
//   5 Free x (divide; flip the signs if it's −x)   6 Check it
//
// Nothing here touches the page, so the node tests can check it.
//
//   stepsPlan(start, stage, { verdict })  which steps this equation needs (the rest say "skip" from the start), and
//                                         whether it is a hard one (the card opens by itself on those)
//   stepsStatus(line, plan, { solved, checked, verdictShown })
//                                         each step: 'done' | 'skip' | 'now' | 'todo', read from the line itself,
//                                         so a step ticks off whichever move did it (a shortcut included), and undo
//                                         un-ticks it
//   stepsRoute(line, stage, goal)         the moves the card's order makes from here (null if that order can't
//                                         finish on this rung); stepsLeft = how many
//   stepsMoves(line, stage, goal)         the moves that follow the card from here (each brings stepsLeft down by
//                                         one); the first is the card's own next move
//   cardMode({ hard, stamped, level })    'open' | 'faded' | 'folded': how the card starts on this box
//
// "Following the card" always counts as getting closer, even where a shortcut is shorter: on 3(x + 2) = 18 the card
// opens the brackets (3 moves: open, −6, ÷3) while dividing first takes 2 (÷3, −2). Both are accepted, and the box's
// par is the card's count, so a kid who follows the rules still earns every star.

import { applyMove, hasBracket, hasOver, isOver, hasLike, isSolved, xSide, lineFits, lineKey, F, DIST, COMB, FLIP, mulBy, divBy } from './engine.js';

export const GOLDEN_RULE = 'Whatever you do to one side, do to the other.';

// The wording lives here so it is easy to change. skip = what a step that isn't needed says; short = the step's name
// on the folded "Steps" bar.
export const STEPS = [
  { n: 1, id: 'brackets', label: 'Open the brackets (distribute)', short: 'Open the brackets', skip: 'No brackets' },
  { n: 2, id: 'division', label: 'Clear the division', short: 'Clear the division', skip: 'No division' },
  { n: 3, id: 'tidy', label: 'Tidy each side', short: 'Tidy each side', skip: 'Already tidy' },
  { n: 4, id: 'sort', label: 'x’s on one side, numbers on the other', short: 'x’s on one side, numbers on the other', skip: 'Already sorted' },
  { n: 5, id: 'free', label: 'Free x (divide; flip the signs if it’s −x)', short: 'Free x', skip: 'x is already free' },
  { n: 6, id: 'check', label: 'Check it', short: 'Check it', skip: '' },
];
export const SKIP_WORD = 'skip';
// what step 5 says when it isn't needed because an earlier step leaves x on its own (x/2 = 6: clearing the division
// gives x = 12), so the card never calls an x that still looks tied up "already free"
export const FREED_BY = {
  brackets: 'Opening the brackets frees x', division: 'Clearing the division frees x', tidy: 'Tidying frees x',
  sort: 'Sorting frees x',
};
// what step 2 says while a whole group sits over a number: (5x − 10)/2 = 10
export const overNote = (l) => `multiply both sides by ${lcmOfBottoms(l)}`;
// what step 5 says on a vault box once x has gone from both sides (or both sides match)
export const VERDICT_NOTE = 'No x to free? Then every number is a solution, or there is no solution.';

// The card starts folded on easy boxes and on rungs the kid has stamped; it starts faded (still open, but quiet)
// once the kid is at this many buttons on the rung (3 clean boxes in a row at each level get there).
export const FADE_AT_LEVEL = 4;

// ---------- reading a line ----------

const eachX = (l, fn) => {
  const walk = (t) => { if (t.t === 'x') fn(t); else if (t.t === 'b') t.in.forEach(walk); };
  l.L.forEach(walk); l.R.forEach(walk);
};

// An x-term with a bottom (x/4, 2x/3), or a whole group over a number ((5x − 10)/2): "division" in the card's words.
export function hasDivision(l) {
  let yes = hasOver(l);
  eachX(l, (t) => { if (t.v.d > 1) yes = true; });
  return yes;
}
export function lcmOfBottoms(l) {
  let m = 1;
  const g = (a, b) => (b ? g(b, a % b) : a);
  const take = (d) => { if (d > 1) m = (m * d) / g(m, d); };
  eachX(l, (t) => take(t.v.d));
  for (const t of [...l.L, ...l.R]) if (isOver(t)) take(t.p.d);
  return m;
}
// Brackets to open (step 1): a group over a number is cleared by step 2 instead.
export function bracketsToOpen(l) { return [...l.L, ...l.R].some((t) => t.t === 'b' && !isOver(t)); }

// Which side x should end up on, and what is in the wrong place for that.
// A side's misplaced terms are the x-terms on the other side plus the (non-zero) numbers on its own side. The side
// with fewer wins; on a tie, the side whose x-number is bigger (so x stays positive), then the left.
// keepX: the rung has no button that moves an x-term, so on a tie x stays on the side it is already on (−x + 4 = 0
// takes away 4 and then flips, rather than moving −x across with a button that isn't there).
export function sortInfo(l, { keepX = false } = {}) {
  const xsum = (s) => s.reduce((a, t) => (t.t === 'x' ? a.add(t.v) : a), F(0));
  const wrong = (here, other) => {
    const out = [];
    l[here].forEach((t, i) => { if (t.t === 'n' && !t.v.isZero()) out.push({ side: here, index: i, term: t }); });
    l[other].forEach((t, i) => { if (t.t === 'x') out.push({ side: other, index: i, term: t }); });
    return out;
  };
  const a = wrong('L', 'R'), b = wrong('R', 'L');
  let side;
  const xs = keepX ? xSide(l) : 'both';
  if (a.length !== b.length) side = a.length < b.length ? 'L' : 'R';
  else if (xs === 'L' || xs === 'R') side = xs;
  else side = xsum(l.R).valueOf() > xsum(l.L).valueOf() ? 'R' : 'L';
  // x-terms first (they are the bigger step for a kid), then the numbers
  const misplaced = (side === 'L' ? a : b).sort((p, q) => (p.term.t === q.term.t ? 0 : p.term.t === 'x' ? -1 : 1));
  return { side, misplaced };
}

// x's on one side and numbers on the other (3x = 12, 12 = 3x, x = 4). A line with no x at all is not sorted.
export function isSorted(l) {
  if (hasBracket(l)) return false;
  const xs = xSide(l);
  if (xs === 'none' || xs === 'both') return false;
  return sortInfo(l).misplaced.length === 0;
}

// ---------- the card's own order ----------

// Can this stage make that move? (the card never uses a move the rung's buttons can't offer)
function stageAllows(m, st) {
  if (m.k === 'add') return m.term.t === 'x' ? st.addx : st.add;
  if (m.k === 'mul') return st.mul;
  if (m.k === 'div') return st.div;
  if (m.k === 'flip') return st.flip;
  if (m.k === 'dist') return st.dist;
  if (m.k === 'comb') return st.comb;
  return false;
}

// The card's next move from this line: { step, move }, or null when there is nothing for it to do (x is free, or x
// has gone from the line). st: the rung's stage, when known (a rung without x-moving buttons keeps x where it is).
export function nextStepMove(l, st = null) {
  if (xSide(l) === 'none') return null;
  if (bracketsToOpen(l)) return { step: 1, move: DIST };
  if (hasDivision(l)) return { step: 2, move: mulBy(lcmOfBottoms(l)) };
  if (hasLike(l)) return { step: 3, move: COMB };
  const si = sortInfo(l, { keepX: !!st && !st.addx });
  if (si.misplaced.length) {
    const t = si.misplaced[0].term;
    return { step: 4, move: { k: 'add', term: { t: t.t, v: t.v.neg() } } };
  }
  if (isSolved(l)) return null;
  // x stands alone on its side with a number stuck to it
  const xs = l[si.side].filter((t) => t.t === 'x');
  if (xs.length !== 1) return null;
  const a = xs[0].v;
  if (a.isOne()) return null;
  if (a.eq(F(-1))) return { step: 5, move: FLIP };
  return { step: 5, move: divBy(a) };
}

const isGoal = (goal) => goal || isSolved;

// The moves the card's order makes from this line to the goal (x = N, or a vault verdict). null when that order
// can't finish here (a move the rung doesn't have, or numbers past the rung's limit).
export function stepsRoute(l, st, goal = null) {
  const done = isGoal(goal);
  const route = [];
  let cur = l;
  for (let guard = 0; guard < 12; guard++) {
    if (done(cur)) return route;
    const nx = nextStepMove(cur, st);
    if (!nx || !stageAllows(nx.move, st)) return null;
    const r = applyMove(cur, nx.move);
    if (!r || !lineFits(r.out, st)) return null;
    route.push(nx);
    cur = r.out;
  }
  return null;
}
export function stepsLeft(l, st, goal = null) {
  const r = stepsRoute(l, st, goal);
  return r ? r.length : Infinity;
}

// Every move that follows the card from here: it brings the card's count down by one. The card's own next move comes
// first; the rest are the same step done another way (on 5x + 3 = 2x + 15 both −2x and −3 sort the line).
export function stepsMoves(l, st, goal = null) {
  const s0 = stepsLeft(l, st, goal);
  if (!Number.isFinite(s0) || s0 === 0) return [];
  const out = [];
  const seen = new Set();
  const tryMove = (m) => {
    if (!m || !stageAllows(m, st)) return;
    const r = applyMove(l, m);
    if (!r || !lineFits(r.out, st)) return;
    const key = lineKey(r.out);
    if (seen.has(key)) return;
    if (stepsLeft(r.out, st, goal) !== s0 - 1) return;
    seen.add(key);
    out.push(m);
  };
  tryMove(nextStepMove(l, st)?.move);
  // the rest of the card's own sorting next (the terms in the wrong place for the side x is going to), then the same
  // step done another way: cancelling any number or x-term on the line
  if (xSide(l) !== 'none' && !hasBracket(l)) {
    for (const w of sortInfo(l, { keepX: !st.addx }).misplaced) tryMove({ k: 'add', term: { t: w.term.t, v: w.term.v.neg() } });
  }
  for (const side of ['L', 'R']) {
    l[side].forEach((t) => {
      if ((t.t === 'n' && !t.v.isZero()) || t.t === 'x') tryMove({ k: 'add', term: { t: t.t, v: t.v.neg() } });
    });
  }
  return out;
}

// ---------- the plan for one box, and where the kid is on it ----------

// Which of the six steps this equation needs, worked out the card's way from the start line. It only looks at what
// is printed (brackets, bottoms, like terms, where x is), so on a vault box it never gives away whether x has one
// value, every value or none: step 5 always stays in.
export function stepsPlan(start, st, { verdict = false } = {}) {
  const applies = { brackets: false, division: false, tidy: false, sort: false, free: true, check: true };
  let l = start, moves = 0;
  const step = (m) => { const r = applyMove(l, m); if (r) { l = r.out; moves++; } };
  applies.brackets = bracketsToOpen(l);
  if (applies.brackets) step(DIST);
  applies.division = hasDivision(l);
  if (applies.division) step(mulBy(lcmOfBottoms(l)));
  applies.tidy = hasLike(l);
  if (applies.tidy) step(COMB);
  if (xSide(l) !== 'none') {
    const si = sortInfo(l, { keepX: !!st && !st.addx });
    applies.sort = si.misplaced.length > 0 || xSide(l) === 'both';
    for (const w of si.misplaced) step({ k: 'add', term: { t: w.term.t, v: w.term.v.neg() } });
  }
  applies.free = verdict ? true : !isSolved(l);
  // step 5 not needed: the last step that applies is the one that frees x (none: x stood alone from the start)
  const skips = {};
  if (!applies.free) {
    const by = ['sort', 'tidy', 'division', 'brackets'].find((id) => applies[id]);
    if (by) skips.free = FREED_BY[by];
  }
  // the card opens by itself on the harder equations: brackets, division, x on both sides, or like terms to tidy;
  // a box the card does in one move (x/2 = 6) isn't one of them, however it looks
  const hard = (applies.brackets || applies.division || applies.tidy || xSide(start) === 'both') && (verdict || moves + (applies.free ? 1 : 0) >= 2);
  return { applies, hard, skips };
}

// Each step's state on this line. A step the plan skipped comes back if the line needs it after all (a kid's move can
// make like terms, say). solved = the box is solved (x = N, or the right verdict); checked = the check has run;
// verdictShown = a vault line whose sides now show the verdict.
export function stepsStatus(l, plan, { solved = false, checked = false, verdictShown = false } = {}) {
  const past = [];
  past[0] = !bracketsToOpen(l);
  past[1] = past[0] && !hasDivision(l);
  past[2] = past[1] && !hasLike(l);
  past[3] = solved || verdictShown || (past[2] && isSorted(l));
  past[4] = solved;
  past[5] = checked;
  // what the line itself needs right now, whatever the plan said at the start
  const sorted = isSorted(l);
  // (x/2 = 6 is sorted but not free; clearing its division is step 2's job, and that frees it: step 5 isn't needed)
  const own = [bracketsToOpen(l), hasDivision(l), hasLike(l), !(solved || verdictShown || sorted), sorted && !solved && !hasDivision(l), !checked];
  let nowAt = -1;
  return STEPS.map((s, i) => {
    const needed = plan.applies[s.id] || own[i];
    let state;
    if (!needed) state = 'skip';
    else if (past[i]) state = 'done';
    else if (nowAt < 0) { state = 'now'; nowAt = i; }
    else state = 'todo';
    let note = s.id === 'free' && state === 'now' && verdictShown && !solved ? VERDICT_NOTE : '';
    // a whole group over a number: the card says how to clear it
    if (s.id === 'division' && state === 'now' && hasOver(l)) note = overNote(l);
    return { n: s.n, id: s.id, label: s.label, short: s.short, skip: (plan.skips && plan.skips[s.id]) || s.skip, state, note };
  });
}

// The step to work on now ({ n, id, label }), or null when every step is done.
export function currentStep(status) {
  return status.find((s) => s.state === 'now') || null;
}

// How the card starts on a box: open on hard equations, folded on easy ones and on rungs the kid has stamped, and
// faded (open but quiet) once the kid is near mastering the rung.
export function cardMode({ hard, stamped = false, level = 2 }) {
  if (!hard || stamped) return 'folded';
  if (level >= FADE_AT_LEVEL) return 'faded';
  return 'open';
}
