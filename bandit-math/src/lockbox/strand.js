// strand.js: the lock box on the strands. Which box comes next for this rider, and what each answer in it says about
// their math (the skill model, src/math/skill.js).
//
// WHICH BOX. The lock box asks the skill model like every job does: chooseMap over its three makers (the kindergarten
// boxes K1..K3, the equations R0a..R15, the inequalities I1..I4: src/math/strands.js MAPS lockboxK, lockbox,
// lockboxIneq), then stepFor gives a rung and how far the level is toward the next rung (frac). Within a rung the
// box's level is 2, 3 or 4 by thirds of that (level 2 has the small numbers): a rider at equations 52 gets "One step
// with negatives" at level 2, one at 59 "Two steps" at level 3. The kindergarten boxes grow their numbers with frac
// itself. The inequalities come in once the equations level is about 75 (their strand starts at 0.85 of it, and I1
// sits at 70), mixed with the equations from then on. They stay on offer from then on (INEQ): a miss or two on the
// first ones can take the inequalities strand below I1's gate (skill.js fits), where nothing would ask it again, so
// while the equations level is INEQ.fromEq or more about one box in three is an inequality at I1 regardless.
// Once a strand's level is found (placed):
//   - a new sitting (2 hours away) starts with two easy boxes from rungs well below the level (warm-ups);
//   - a box type missed comes back 2 to 4 boxes later (a comeback), unless the level is now below it;
//   - about one box in four (never two running) is a review of one of the nearest rungs below the level, at least
//     REVIEW.below points under it, so a right one says nothing new (skill.js NEAR) and the 80% staircase is set by
//     the boxes at the level.
// Each box is recorded at the point it was really made at: the plan's point for a box at the level (during the
// baseline that is the point being tried), the rung's own point for a review, a warm-up or a comeback.
// THE "WORK IT OUT" BOXES (workout.js: order of operations O1..O5, exponents P1..P5, maps order and pow): once one of
// them fits the rider (skill.js fits: its strand's level within reach of its first rung), about one box in four is one
// of them (WORK.share; one in three while its strand is still finding its level), never two running. The equations
// stay the lock box's main work. They come at the rider's level on their own strand, with no reviews or warm-ups.
//
// WHAT AN ANSWER SAYS (the credits).
//   - The box: one answer in its strand (equations, or inequalities). Right when it was clean (solved within par + 1,
//     no hint past the first, the check passed, no jam, no wrong pick) and every part with x in it (5x − 4x, 5 · x,
//     which way the sign points after × or ÷ by a negative) was right the first time: working those IS solving the
//     equation. A box set aside ("Skip this box") is a miss; "Done for now" in the middle of one counts nothing.
//     Timed (a sit-down question): size = the moves and the parts it took.
//   - Each part with only numbers in it ("27 ÷ 9", "−10 + 18", "5 · 8") is one answer in ITS strand, at the point that
//     arithmetic sits on that strand's scale (partCredit): sums in addition, taking away in subtraction (the
//     negatives' points when it starts below zero or crosses it), products in multiplication, quotients in division
//     (with a negative in it: at the plain fact's own point, sign aside: −3 · 5 is the 3s at ×5; the sign rule is the
//     box's own work, and a times strand can't be placed by it). The flip (× −1, the opposite) counts in the box.
//     Right = right the first time. Timed on its own, size 1.
//   - A "Work it out" box: one answer in order of operations (or exponents), right when every "which part first?" and
//     every part that is the strand's own skill (what a power means, a root, a power rule) was right the first time
//     and no hint went past the first. Its arithmetic parts count in their own strands as above (workCredit; a power
//     worked out, 3², in exponents at 58, a cube at 62).
//   - The kindergarten boxes and "Which key fits" are missing numbers: they count in addition or subtraction too, at
//     half weight.
// Everything goes through record() here (skill.js record). The lock box never fed the old last-50 accuracy list
// (save.js recordAnswer's tallies, which the Top Hand badge reads), and it still doesn't; the caller saves the rider.
//
// READ ALOUD. While skill.js readAloud(rider) is on (the rider's best strand under 30, and the read-aloud switch on), the
// low boxes' questions are read out from the maker's clips (boxSay: the kindergarten boxes "2 and what make 4", the
// balance "2 and what make 4 plus 3", "Which key fits" and the add-on x + 4 = 9 "4 and what make 9"), and so is a
// part that is a plain sum or difference ("9 minus 4": partSay). A line the clips can't say is not read.
//
// Nothing here touches the page; tests/lockbox.strand.test.mjs plays it.
//   planBox(rider, alg, { rng, now })   -> { map, strand, rung, level, frac, at, kind: 'level' | 'warm' | 'due' |
//                                          'review', review, placed }   (starts a strand's baseline the first time)
//   planOf(problem)                     -> the same for a box made some other way (the store's equation, a chosen rung)
//   partCredit(q), productCredit(q), workCredit(step)   -> { strand, at } | { x: true } (a part of the box's own skill:
//                                          it counts in the box) | null
//   sumCredit(a, b), timesCredit(a, b), quotientCredit(n, d)   the points of plain arithmetic
//   recordBox(rider, plan, problem, { right, ms, size, hidden, idle, now }), recordPart(rider, credit, { right, ms,
//     hidden, idle, now })   -> skill.js record's result
//   syncLadder(rider, alg)              the strand's level mirrored into rider.topics.algebra (algebra.js follow)
//   boxSay(problem), partSay(q)         the lines read out loud, or null
//   youngMost(rider)                    -> the highest point a box is made at while read-aloud is on (YOUNG), or null
//   levelOfFrac(frac), mapOfRung(rung), BOX_MAPS, REVIEW, INEQ, WORK, YOUNG

import { chooseMap, fits, stepFor, stepAt, pctAt, isPlaced, isMet, levelOf, record, readAloud, ageStart, MAPS, SKILL } from '../math/skill.js';
import { RUNG } from './generate.js';
import { K_RUNG } from './kbox.js';
import { WORK_RUNG } from './workout.js';
import { ARITH_LEVEL, ARITH_FROM, ARITH_REVIEW_SHARE } from './algebra.js';

export const BOX_MAPS = ['lockboxK', 'lockbox', 'lockboxIneq'];
export const REVIEW = {
  share: 0.25,             // about one box in four is a review, once the level is found (never two running)
  below: SKILL.NEAR + 1,   // ...of a rung at least this many points below the level
  nearest: 3,              // ...mostly one of the nearest few such rungs
  stamped: 4,              // a rung this many points or more below the level counts as behind the kid (algebra.js
                           // stamped: its animations run quicker and its steps card starts folded)
};

export const INEQ = {
  fromEq: 76,      // the inequalities stay on offer once the equations level is this high (I1 70 / 0.85 + a little)
  share: 1 / 3,    // ...this share of the boxes, while their own strand is below I1's gate
};

// A young rider whose questions are read out (youngMost: an age of 7 or under, or read-aloud set to "always"): only boxes
// the clips can say (the picture boxes, the balance, x + 4 = 9: up to YOUNG.top at its level 4), and no further up the
// equations than their adding and taking away reach (the lower of the two placed levels plus YOUNG.arith): a 6-year-old
// at adding 1 stays on picture boxes instead of meeting x − 2 = 1 with its dark negative coin. The equations baseline
// settles at that point (skill.js stepFor `most`). The deer and the sheep's algebra flock hold the same way.
export const YOUNG = { top: 'R1', arith: 10 };

// A teen (an age whose head start is TEEN.fromStart or more: 13 and up) isn't dealt the coin-picture warm-up boxes made
// for the youngest (R0a "Balance the wagon", R0b "Which key fits"): the add-on box (TEEN.least, R1) is their easiest.
// Their equations level can still sit lower; the baseline's bottom is that box (skill.js record's floor), so two early
// slips don't drop a teen onto the youngest boxes.
export const TEEN = { fromStart: 30, least: 'R1' };

export const WORK = {
  maps: ['order', 'pow'],   // the "Work it out" boxes (workout.js)
  share: 0.25,              // about one box in four, once one of them fits the rider...
  finding: 1 / 3,           // ...one in three while its strand is still finding its level (so the baseline finishes)
};

// a rung's level within it, from how far the level is toward the next rung: thirds (0.33 counts as a third)
export const levelOfFrac = (frac) => 2 + Math.max(0, Math.min(2, Math.floor((Number(frac) || 0) * 3 + 0.02)));
const fracOfLevel = (level) => (Math.max(2, Math.min(4, level)) - 2) / 3;
export const mapOfRung = (rung) => (K_RUNG[rung] ? 'lockboxK' : WORK_RUNG[rung] ? WORK_RUNG[rung].map : RUNG[rung] && RUNG[rung].ineq ? 'lockboxIneq' : 'lockbox');

// ---------- which box ----------

export function planBox(rider, alg, { rng, now = Date.now() } = {}) {
  const s = alg.state;
  // a "Work it out" box now and then, once one fits (never two running)
  const work = s.lastWork ? null : chooseMap(rider, WORK.maps, { rand: rng.next, last: s.lastWorkMap || null, now });
  if (work && rng.chance(isPlaced(rider, MAPS[work].strand) ? WORK.share : WORK.finding)) {
    const m = MAPS[work], q = stepFor(rider, work, { now });
    s.lastWork = true; s.lastWorkMap = work;
    return { map: work, strand: m.strand, rung: q.id, level: levelOfFrac(q.frac), frac: q.frac, at: q.below ? m.anchors[0] : q.at,
      kind: 'level', review: false, placed: isPlaced(rider, m.strand) };
  }
  s.lastWork = false;
  const most = youngMost(rider);
  const least = most == null && ageStart(rider && rider.age) >= TEEN.fromStart ? pctAt('lockbox', TEEN.least) : null;
  // (the picture boxes are for riders who are read to; an older one gets the balance and the key boxes at that level,
  // unless even those don't fit yet)
  const kOk = readAloud(rider) || !fits(rider, 'lockbox', BOX_MAPS);
  const maps = (most == null ? BOX_MAPS : ['lockboxK', 'lockbox']).filter((k) => k !== 'lockboxK' || kOk);
  let map = chooseMap(rider, maps, { rand: rng.next, last: s.lastMap || null, now }) || 'lockbox';
  if (most == null && map !== 'lockboxIneq' && isMet(rider, 'ineq') && !fits(rider, 'lockboxIneq', BOX_MAPS)
    && levelOf(rider, 'eq') >= INEQ.fromEq && rng.chance(INEQ.share)) map = 'lockboxIneq';
  const m = MAPS[map];
  const q = stepFor(rider, map, { now, most });
  const placed = isPlaced(rider, m.strand);
  let plan = { map, strand: m.strand, rung: q.id, level: levelOfFrac(q.frac), frac: q.frac,
    at: q.below ? m.anchors[0] : q.at, kind: 'level', review: false, placed };
  if (map === 'lockbox' && least != null) {
    plan.floor = least;
    if (plan.at < least - 0.05) plan = { ...plan, rung: TEEN.least, level: 2, frac: 0, at: least };
  }
  if (placed) {
    const lvl = levelOf(rider, m.strand);
    // comebacks above the level are dropped: the staircase brings that rung back when the kid is ready for it
    s.due = (s.due || []).filter((d) => { const mm = mapOfRung(d.rung); return pctAt(mm, d.rung) <= levelOf(rider, MAPS[mm].strand) && (most == null || pctAt(mm, d.rung) <= most); });
    // the rungs a review can come from: their point at a review's level (4, the highest) is REVIEW.below under the level
    const below = m.ids.map((id) => ({ id, p: pctAt(map, id, fracOfLevel(4)) }))
      .filter((r) => RUNG[r.id] && RUNG[r.id].stage && r.p <= lvl - REVIEW.below && (most == null || r.p <= most) && (least == null || r.p >= least - 0.05)).reverse();   // (nearest first; read aloud: none past YOUNG; a teen: none under TEEN)
    const near = () => (rng.chance(0.75) ? rng.pick(below.slice(0, REVIEW.nearest)) : rng.pick(below)).id;
    const due = s.due.find((d) => d.at <= s.boxes && m.ids.includes(d.rung) && d.rung !== plan.rung);
    let rung = null, kind = null, level = 3;
    if (s.warm > 0 && below.length) { rung = near(); kind = 'warm'; }
    else if (due) { rung = due.rung; kind = 'due'; }
    else if (below.length >= 2 && !s.lastReview && rng.chance(REVIEW.share)) {
      rung = near(); kind = 'review'; level = 4;
      // (the old ladder's "do the arithmetic" level, earned in review: every box works its parts out now, so it plays
      // as level 4; it is kept for the Grown-ups corner's count of adding slips)
      const order = m.ids.indexOf(rung) >= m.ids.indexOf(ARITH_FROM) && m.ids.includes(ARITH_FROM);
      if (order && rng.chance(ARITH_REVIEW_SHARE)) level = ARITH_LEVEL;
    }
    if (rung) {
      const frac = fracOfLevel(level);
      plan = { ...plan, rung, level, frac, at: pctAt(map, rung, frac), kind, review: true };
    }
  }
  s.lastMap = map;
  s.lastReview = plan.review;
  return plan;
}

// The highest point a box can be made at for a rider whose questions are read out for a sure reason (an age set at
// skill.js READ_AGE or under, or the grown-ups' "always"), or null for everyone else. A rider with no age is read to by
// default too, but that alone can't tell a 6-year-old from a teen who skipped the age: holding the boxes back for
// them would hold the teen's equations down with it (the boxes are what would show the level), so they are not held.
export function youngMost(rider) {
  if (!rider || !readAloud(rider)) return null;
  const age = Number(rider.age);
  if (!(rider.readAloud === 'on' || (age > 0 && age <= SKILL.READ_AGE))) return null;
  // (adding and taking away: only levels already placed say how far their arithmetic reaches)
  const placed = ['add', 'sub'].filter((s) => isPlaced(rider, s)).map((s) => levelOf(rider, s));
  const arith = placed.length ? Math.min(...placed) + YOUNG.arith : Infinity;
  return Math.min(pctAt('lockbox', YOUNG.top, fracOfLevel(4)), Math.max(MAPS.lockboxK.anchors[MAPS.lockboxK.anchors.length - 1], arith));
}

// A box made some other way (the store's equation, a rung chosen on the test page): recorded at its rung's point.
export function planOf(problem, { frac = null } = {}) {
  const map = mapOfRung(problem.rung);
  const level = Math.max(2, Math.min(4, problem.level ?? 3));
  const f = frac ?? (K_RUNG[problem.rung] || WORK_RUNG[problem.rung] ? 0 : fracOfLevel(level));
  return { map, strand: MAPS[map].strand, rung: problem.rung, level, frac: f, at: pctAt(map, problem.rung, f), kind: 'set',
    review: false, placed: false };
}

// ---------- where plain arithmetic sits on its strand ----------
// (the points are the field lane's ladders' own: src/math/strands.js MAPS adding, taking, negatives, times, dividing)

const whole = (v) => Number.isInteger(v);
const bigness = (m, cuts) => (m <= cuts[0] ? 0 : m <= cuts[1] ? 1 : 2);

// a + b with whole numbers; b < 0 is taking away |b|  -> { strand: 'add' | 'sub', at }
// A sum with a negative in it sits at its own shape's step on the positive & negative ladder (−3 + 7 at 60, −7 + 3 at
// 64, −4 − 5 at 68, 3 − 8 at 72), a little higher for numbers past 10 or 20 (+4, +8): one shape is not the ladder's
// mixed steps 6 and 7 (82, 90), where every shape comes up together.
export function sumCredit(a, b) {
  if (!whole(a) || !whole(b)) return null;
  const c = a + b, m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
  const bigger = (p, cuts) => p + 4 * bigness(m, cuts);
  if (a < 0 && b > 0) return { strand: 'add', at: bigger(c > 0 ? 60 : 64, [10, 20]) };   // −3 + 7, −7 + 3
  if (a < 0 && b <= 0) return { strand: 'sub', at: bigger(68, [10, 20]) };                // −4 − 5
  if (b < 0 && c < 0) return { strand: 'sub', at: bigger(72, [12, 20]) };                  // 3 − 8
  if (b >= 0) {                                                                                            // 0 .. 30
    const lo = Math.min(a, b), hi = Math.max(a, b);
    let at;
    if (c <= 10) at = lo <= 2 ? 0 : c === 10 ? 9 : 5;
    else if (a === b && c <= 20) at = 12;
    else if (hi <= 9) at = 15;
    else if (c > 100) at = 30;
    else if (lo <= 9) at = (hi % 10) + lo >= 10 ? 24 : 19;
    else at = (a % 10) + (b % 10) >= 10 ? 30 : 24;
    return { strand: 'add', at };
  }
  const t = -b;                                                                                            // 0 .. 30
  let at;
  if (a <= 10) at = t <= 2 ? 0 : a === 10 ? 9 : 5;
  else if (a > 100) at = 30;
  else if (a <= 20 && t <= 9) at = a % 10 >= t ? 15 : 19;
  else if (t <= 9 || t % 10 === 0) at = 24;
  else at = 30;
  return { strand: 'sub', at };
}

// the times tables by how hard they are: 2s 5s 10s, 3s 4s, 9s 11s, 6s 8s, 7s 12s (times.js's order). A fact belongs
// to the easier of its two tables (2 · 8 is the 2s at ×8, not the 8s at ×2); past ×10 it is at least the 11s' point.
const TABLE = { 0: 0, 1: 0, 2: 0, 5: 0, 10: 0, 3: 1, 4: 1, 9: 2, 11: 2, 6: 3, 8: 3, 7: 4, 12: 4 };
export function timesCredit(a, b) {
  if (!whole(a) || !whole(b)) return null;
  const p = Math.abs(a), q = Math.abs(b);
  if (a < 0 || b < 0) return timesCredit(p, q);   // (the plain fact's own point: the sign rule isn't a times table)
  if (p > 12 || q > 12) return { strand: 'mul', at: 52 };
  if (p <= 1 || q <= 1) return { strand: 'mul', at: 14 };
  const k = Math.min(TABLE[p], TABLE[q]);
  const times = TABLE[p] === TABLE[q] ? Math.max(p, q) : TABLE[p] < TABLE[q] ? q : p;   // (the other factor)
  const at = k === 0 ? (times <= 5 ? 15 : 19) : [0, 26, 33, 39, 45][k];
  return { strand: 'mul', at: times > 10 ? Math.max(at, 33) : at };
}
// n ÷ d with a whole answer
export function quotientCredit(n, d) {
  if (!whole(n) || !whole(d) || d === 0 || n % d !== 0) return null;
  const N = Math.abs(n), D = Math.abs(d), Q = N / D;
  if (n < 0 || d < 0) return quotientCredit(N, D);   // (the plain fact's own point, sign aside)
  if (D === 1) return { strand: 'div', at: 16 };
  if (D > 12 || Q > 12) return { strand: 'div', at: 45 };
  return { strand: 'div', at: { 2: 25, 5: 25, 10: 25, 3: 29, 4: 29, 6: 33, 9: 33, 11: 33, 7: 37, 8: 37, 12: 37 }[D] };
}

const intOf = (f) => (f && f.d === 1 ? f.n : NaN);
const X = { x: true };   // an algebra part: it counts in the box itself

// A part from parts.js (the sums, the ÷ and ×, the flip; the inequalities' sign question)
export function partCredit(q) {
  if (!q) return null;
  if (q.kind === 'sign') return X;
  if (q.kind === 'sum' || q.kind === 'join') {
    const terms = q.terms || [q.a, q.b];
    if (terms.some((t) => !t || t.t !== 'n')) return X;
    const vals = terms.map((t) => intOf(t.v));
    if (vals.some((v) => !whole(v))) return null;   // (fractions: no fractions strand point for these yet)
    const last = vals.pop();
    return sumCredit(vals.reduce((s, v) => s + v, 0), last);
  }
  if (q.kind === 'scale') {
    if (!q.a || q.a.t !== 'n') return X;
    const v = intOf(q.a.v);
    if (q.op === 'flip') return X;   // times −1, the opposite: solving the equation, so it counts in the box
    const f = intOf(q.f);
    if (q.op === 'div') return quotientCredit(v, f);
    if (q.op === 'mul') return timesCredit(v, f);
  }
  return null;
}
// A product when brackets open (products.js): 5 · 8 in multiplication; 5 · x is algebra
export function productCredit(q) {
  if (!q || !q.term) return null;
  if (q.term.t !== 'n') return X;
  return timesCredit(intOf(q.p), intOf(q.term.v));
}

// A step of a "Work it out" box (workout.js): a "which part first?" pick or a part of the strand's own skill counts in
// the box; a part that is plain arithmetic counts in its own strand (a power worked out in exponents)
export function workCredit(step) {
  if (!step) return null;
  if (step.kind === 'pick' || step.x) return X;
  const { op, a, b } = step;
  if (op === '+') return sumCredit(a, b);
  if (op === '−') return sumCredit(a, -b);
  if (op === '×') return timesCredit(a, b);
  if (op === '÷') return quotientCredit(a, b);
  if (op === '^') return { strand: 'pow', at: b === 2 && a >= 0 ? 58 : 62 };   // (b: the power) 3² in squares, 2³ and (−2)² past them
  return null;
}

// The missing-number boxes count in addition or subtraction too (half weight): the kindergarten boxes and
// "Which key fits" (x + 4 = 9).
function missingCredit(problem) {
  if (!problem) return null;
  if (problem.mode === 'count') {
    return problem.op === '+' ? { strand: 'add', at: problem.b <= 5 ? 5 : 9 } : { strand: 'sub', at: problem.a <= 5 ? 5 : 12 };
  }
  if (problem.mode === 'key') {
    const b = problem.x + (intOf(problem.start.L[1] && problem.start.L[1].v) || 0);
    return { strand: 'add', at: b <= 10 ? 9 : b <= 20 ? 15 : 19 };
  }
  return null;
}

// ---------- recording ----------

export function recordBox(rider, plan, problem, { right, ms, size = 1, hidden = false, idle = false, now } = {}) {
  const strands = [{ strand: plan.strand, at: plan.at }];
  const extra = missingCredit(problem);
  if (extra) strands.push({ ...extra, weight: 0.5 });
  return record(rider, strands, { right: !!right, sitDown: true, ms, size: Math.max(1, size), hidden, idle, ...(now ? { now } : {}),
    ...(Number.isFinite(plan.floor) ? { floor: plan.floor } : {}) });
}
export function recordPart(rider, credit, { right, ms, hidden = false, idle = false, now } = {}) {
  if (!credit || !credit.strand) return null;
  return record(rider, [{ strand: credit.strand, at: credit.at }], { right: !!right, sitDown: true, ms, size: 1, hidden, idle, ...(now ? { now } : {}) });
}

// The strand's level mirrored into the old ladder's fields (algebra.js follow): the deer and the sheep ask for an
// equation at rider.topics.algebra.rung, the sheriff's box tier and the Grown-ups corner read it too. The rung is the
// equations rung the level sits on (R0a under it: never a kindergarten rung), or the inequalities rung once that
// strand is past I1.
export function syncLadder(rider, alg) {
  const eq = levelOf(rider, 'eq');
  const ineq = isMet(rider, 'ineq') ? levelOf(rider, 'ineq') : -1;
  const onIneq = ineq >= MAPS.lockboxIneq.anchors[0];
  const map = onIneq ? 'lockboxIneq' : 'lockbox';
  const st = stepAt(map, onIneq ? ineq : eq);
  const stamped = [];
  for (const [mm, l] of [['lockbox', eq], ['lockboxIneq', ineq]]) {
    if (l < 0) continue;
    MAPS[mm].ids.forEach((id, i) => { if (MAPS[mm].anchors[i] <= l - REVIEW.stamped) stamped.push(id); });
  }
  alg.follow({ rung: st.id, level: levelOfFrac(st.frac), placed: isPlaced(rider, onIneq ? 'ineq' : 'eq'), stamped });
  return st.id;
}

// Does a number part work with negative numbers? A sum or a taking away that starts below zero or crosses it (where it
// sits on the strands: the negatives' points; "9 − 4" is made as 9 + (−4) but is plain taking away), or a product or
// quotient with a negative factor or number. -> true | false
// (panel.js: a slip on one of these, while the equations level is being found, makes the box a miss)
export function hasNegative(q) {
  if (!q) return false;
  if (q.kind === 'sum' || q.kind === 'join') { const c = partCredit(q); return !!(c && c.strand && c.at >= MAPS.negatives.anchors[0]); }
  const vals = [];
  const add = (f) => { const v = intOf(f); if (Number.isFinite(v)) vals.push(v); };
  for (const t of q.terms || [q.a, q.b]) if (t && t.t === 'n') add(t.v);
  if (q.f) add(q.f);
  if (q.p) add(q.p);
  if (q.term && q.term.t === 'n') add(q.term.v);
  if (q.answer && typeof q.answer === 'object' && 'n' in q.answer) add(q.answer);
  return vals.some((v) => v < 0);
}

// ---------- read aloud ----------

export function boxSay(problem) { return problem && typeof problem.say === 'string' ? problem.say : null; }
// a part that is a plain sum or difference of numbers the clips can say ("9 minus 4", "5 plus 3")
export function partSay(q) {
  if (!q || (q.kind !== 'sum' && q.kind !== 'join') || (q.terms && q.terms.length > 2)) return null;
  if (!q.a || !q.b || q.a.t !== 'n' || q.b.t !== 'n') return null;
  const a = intOf(q.a.v), b = intOf(q.b.v);
  if (!whole(a) || !whole(b) || a < 0 || Math.abs(b) > 109 || a > 109) return null;
  return b < 0 ? `${a} minus ${-b}` : `${a} plus ${b}`;
}
