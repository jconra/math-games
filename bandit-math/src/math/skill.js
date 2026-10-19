// skill.js: what each rider can do in each kind of math, and how hard their next question should be.
//
// THE STRANDS AND THE MAPS live in src/math/strands.js (the registry; re-exported here). The game's math is split into
// strands (addition, multiplication, money, time, equations...), each a scale from 0 to 100 laid on one rough school
// guide (0 = starting kindergarten, 10 = first grade, ... 80 = eighth grade, 90 to 100 = algebra 1). Every question
// maker in the game (a ladder of steps, rungs or levels) sits on a strand: its map gives the point of each step. A job
// asks "how hard for this rider?" (pick or stepFor), turns that into a step of its own ladder (stepAt), makes the
// question there, and tells this module how it went (record, normally through save.js recordAnswer). A level in a
// stretch no maker covers yet gets the nearest material below it.
//
// WHAT A RIDER KEEPS (rider.skill, saved with the rider):
//   { v: 1, migrated: 1, strands: { add: Strand, mul: Strand, ... } }   a strand appears the first time it is met
//   Strand = {
//     level    0..100, where the rider is now (during the baseline: the best guess so far)
//     placed   false until the baseline (below) has found the level
//     base     the baseline in progress, or null once placed: { phase: 'climb' | 'down' | 'check', at (the point being
//              tried), lo (the highest point answered right), hi (the lowest point missed), n (answers so far), checks,
//              rights, flukes, got (a right on the way down, waiting to be asked again), zero (misses at 0), sure (lo
//              was asked twice), start (lo when the checks began), from (the seed) }
//     n, r, f  answers, right answers, fast right answers (all time, in this strand)
//     h        the last HIST_KEEP answers: [right 1/0, the point it was asked at, fast 1/0]
//     t        the last TIMED_KEEP timed right answers: [ms, size]   (sit-down questions only; for the median and the
//              average time on the stats page)
//     days     one entry a day the strand was practised: [day number, level at the end of that day] (the stats page's
//              small history; the last DAYS_KEEP days)
//     met, last    when it was first met and last answered (ms since 1970)
//     old      true when it came from the riders' progress before this model (migrate)
//   }
//
// SEEDING. The first time a strand is met it starts from the strands related to it (each STRANDS entry's `seed`: the
// related strands and a discount, e.g. subtraction starts at 0.9 x addition). With several related strands met, it
// starts at the average of them (each times its discount): a careful start, since starting too low costs only a
// question or two of the baseline's climb, and too high costs misses. With none met, it starts at the rider's
// optional age's head start (ageStart), or 0.
//
// THE BASELINE (placement), once per strand, the first time it comes up (no long test at the start):
//   climb   from the seed, every right answer moves the next question up JUMP (10) points: a school year at a time.
//           A miss on the very first, easiest question (at 0) is asked again before it counts.
//   check   after the first miss, CHECKS (3) questions to rule out a fluke: the first asks the highest right point
//           again (a guess among a few answers is right often enough to fool one question), the others halve the gap
//           between the highest right and the miss. All three right: the miss was a fluke, and the climb goes on (once
//           a baseline). The highest right asked again and missed: it was probably a guess, so the baseline goes down.
//           Right and miss closer than GAP_MIN (near 0 only): no checks, the miss counts as that one fluke.
//   down    (the first question missed, or a right that didn't hold) steps down JUMP at a time until a right answer,
//           which is asked once more before it counts; then the checks. A miss far above the point being tried never
//           moves the next question up.
//   settle  the level is set SETTLE_BELOW points below the highest point answered right (the 80% point sits a little
//           below where a kid starts to miss). After BASE_MOST answers it settles whatever happens.
// About 8 to 15 questions. Simulated learners land on average within a few points of their own 80% point, from starts
// up to 25 points above or anywhere below it (tests/skill.test.mjs; ~/pw/bandit-math/rigs/adaptive/foundation/sim.mjs).
// During the baseline pick() hands out the point being tried; the jobs say so in their own way ("finding your level"),
// so a too-easy or too-hard question for a minute is expected.
//
// THE 80% STAIRCASE, after the baseline: a right answer moves the level up UP (1) point, a wrong one down DOWN (4).
// Over many answers the ups and downs cancel where the rider gets 4 in 5 right, whatever the strand. Small steps: a
// level never jumps (at most FAST_UP after one answer). An answer moves the level only if it says something new: a
// right answer asked well below the level (a warm-up, a review) doesn't push it up, a miss well above it (a stretch)
// doesn't pull it down (NEAR).
//
// GAPS AND EDGES. A strand's material can have a gap no maker covers (Addition and Subtraction: two-digit sums end at
// 30, positive & negative starts at 60), and a strand can be placed under its maker's first step. Then:
//   - a start worked out from other strands never lands past a gap (runTop): crossing it takes the rider's own answers;
//   - a miss on the EASIEST material above a level in a gap (nextAbove: the "edge") counts in full, so a kid who misses
//     −3 + 7 comes back down to two-digit sums instead of waiting in the gap on cards they miss;
//   - CROSS rights running on material at or past the edge cross the gap: the baseline is re-opened from there, and the
//     level above the gap is looked for the usual way (the baseline itself crosses the same way, never on one answer);
//   - a strand placed under its maker's gate is tried again later (recheckDue: the next day, or after many answers
//     elsewhere, once a new rider with the same other levels would be offered it): a short baseline from its first step.
// A baseline moves only on whole answers (weight 1); an extra credit at part weight is practice, never a placement.
//
// TIME. For sit-down questions (lock boxes, the store's word problems and slips, worked long multiplication and
// division) a FAST right answer counts double (FAST_UP). Fast is the rider's own: time per unit of work (ms / size)
// under FAST x the median of their last right answers in that strand, once there are TIMED_MIN of them. Times left out:
// the tab was hidden, no input for a while (the jobs measure both with src/ui/answertimer.js), or slower than SLOW x
// the median. Travel jobs (roping, deer, sheep, pigs, the range, the wagon) pass no time: finding and reaching the
// right target is part of the game, not of the math.
//
// SEVERAL STRANDS AT ONCE. One answer can count in several strands (a word problem with a multiplication and a
// division in it): record(rider, [{ strand: 'words', at }, { strand: 'mul', at, weight: 0.5 }], ...). A weight below
// 1 moves that strand's staircase less (both ways, so its 80% point stays where it is).
//
// THE API (pure functions over the rider object; nothing here touches the page or storage: save.js saves):
//   pick(rider, strand)              -> the point (0..100) to make the next question at; starts the baseline on the
//                                       first meeting (so it changes rider.skill: save after)
//   stepFor(rider, mapId)            -> { map, strand, strands, at, step, i, frac, id } pick() turned into that maker's step
//   stepAt(anchors | mapId, pct)     -> { i (0-based), step (1-based), frac (0..1 toward the next step), id, below }
//   pctAt(anchors | mapId, step, frac = 0)  -> the point of a step (1-based; or a rung id for the lock box)
//   record(rider, strands, { right, at, ms, size, sitDown, hidden, idle, weight, now })
//                                    -> { [strand]: { level, before, moved, placed, justPlaced, fast, timed, outlier } }
//   levelOf(rider, strand)           -> 0..100: the level, or (not met yet) where it would start
//   isMet(rider, strand), isPlaced(rider, strand), seedOf(rider, strand), maxOf(strand)
//   stats(rider, { all })            -> [{ strand, name, short, pct, placed, finding, answered, right, recentPct, avgMs,
//                                       history: [{ day, pct }] }]   (met strands, in STRANDS order; all: every strand)
//   ageStart(age)                    -> the head start an optional age gives (0..AGE.most)
//   migrate(rider)                   -> rider.skill, filled in; the first time, today's topic progress is read into it
//   skillOf(rider)                   -> rider.skill, filled in (made if missing)
//   chooseMap(rider, mapIds, { rand, last, now })  -> which of a job's makers to ask next (or null): see its notes
//   fits(rider, mapId, mapIds)       -> true if that maker has material near the rider's level
//   readAloud(rider)                 -> true while the rider's best strand is low enough that questions are read out
//   meaning(strand, pct)             -> what that point means in words, from the strand's scale ('two-digit sums to 100')
//   oldLevels(rider)                 -> what migrate would read from the old topics: { strand: { level, placed } }
//   setLevel(rider, strand, pct, { placed })   dev/rig/test shortcut
//   STRANDS, STRAND, STRAND_IDS, MAPS, PROBLEMS   the registry (src/math/strands.js); SKILL the dials
//
// Plain JSON in, plain JSON kept: tests/skill.test.mjs checks all of it.

import { STRANDS, MAPS, STRAND, STRAND_IDS, PROBLEMS } from './strands.js';

// ---- the dials (defaults; change them here) --------------------------------------------------------------------

export const SKILL = {
  UP: 1,              // a right answer moves the level up this many points...
  DOWN: 4,            // ...a wrong one down this many: 4 x UP settles where about 4 answers in 5 are right
  FAST_UP: 2,         // a fast right sit-down answer counts double
  NEAR: 8,            // only answers asked within this many points of the level move it (see the notes on record)
  JUMP: 10,           // the baseline's climb: points up after each right answer (about a school year)
  CHECKS: 3,          // the baseline's questions near the first miss, to rule out a fluke
  GAP_MIN: 5,         // ...asked only when the right and the miss are at least this far apart (closer: nothing new between)
  SETTLE_BELOW: 5,    // the baseline settles this far below the highest point answered right
  FLUKES: 2,          // misses a baseline forgives (every check right, or the missed point right twice: the climb goes on)
  BASE_MOST: 20,      // a baseline settles after this many answers whatever happens (it is usually 6 to 12)
  TOP_MARGIN: 6,      // a level can rise this far past the hardest material the game has for the strand
  GATE: 6,            // a maker is offered once the level is within this many points below its first step
  FAST: 0.6,          // a sit-down answer is fast when its time per unit is under this share of the rider's median
  QUICK: 0.25,        // ...but one under this share is left out (more likely a tap before reading than a known answer)
  SLOW: 3,            // a time over this many times the median is left out (the kid looked away)
  TIMED_MIN: 5,       // timed right answers a strand needs before speed counts
  TIMED_KEEP: 15,     // timed right answers kept for the median
  HIST_KEEP: 20,      // answers kept in each strand's recent history
  DAYS_KEEP: 60,      // days kept in each strand's small history
  AGE: { from: 5, perYear: 3.3, most: 33 },   // an optional age's head start: 0 at 5, 33 (third-grade work) from 15 on
  READ_BELOW: 30,     // questions are read out while the rider's best PLACED strand is under this (second-grade work)
  READ_AGE: 7,        // ...and always for a rider whose age is set at this or under (unless a grown-up turns it off)
  CROSS: 3,           // right this many times running on the easiest material above a gap: the level crosses to it
  RECHECK: { hours: 20, answers: 150 },   // a strand placed under its maker's gate is tried again after this long (or
                                          // this many answers elsewhere) once the rider's other math says it is time
  SLOW_RESET: 5,      // this many slow answers running: the kid's usual time has changed, so the times kept start over
};

// ---- the strands and the maps (src/math/strands.js) -------------------------------------------------------------

export { STRANDS, MAPS, STRAND, STRAND_IDS, PROBLEMS };

// The highest a strand's level can go: the hardest material any in-game maker has for it, plus TOP_MARGIN (100 for a
// strand nothing in the game asks yet).
export function maxOf(strand) {
  let top = -1;
  for (const m of Object.values(MAPS)) if (m.inGame && m.strands.includes(strand)) top = Math.max(top, m.anchors[m.anchors.length - 1]);
  return top < 0 ? 100 : Math.min(100, top + SKILL.TOP_MARGIN);
}

// The hardest point a maker can really ask at: its top step's own point, or (a maker that grows its numbers within a
// step: strands.js `grows`) that step grown over TOP_MARGIN. A level above that still gets the top step, and the answer
// is recorded here, not at the level (stepFor caps its `at`).
export function capOf(map) {
  const m = typeof map === 'string' ? MAPS[map] : map;
  if (!m) return 100;
  return Math.min(100, m.anchors[m.anchors.length - 1] + (m.grows ? SKILL.TOP_MARGIN : 0));
}

// The hardest points the strand's makers can ask (capOf of each), as recorded (one decimal).
const CAPS = new Map();
function capsOf(strand) {
  if (!CAPS.has(strand)) CAPS.set(strand, new Set(Object.values(MAPS).filter((m) => m.inGame && m.strands.includes(strand)).map((m) => r1(capOf(m)))));
  return CAPS.get(strand);
}

// The strand's easiest material in the game: the lowest first step of its makers (0 when a maker starts at the bottom).
// A placed level isn't pushed under this minus GATE by misses on that first step while the rider gets most of it right,
// so the maker stays on offer (see the staircase in recordOne).
export function floorOf(strand) {
  let lo = Infinity;
  for (const m of Object.values(MAPS)) if (m.inGame && m.strands.includes(strand)) lo = Math.min(lo, m.anchors[0]);
  return Number.isFinite(lo) ? lo : 0;
}

// Where a maker's own questions for one of its strands start: its first step, or, for a maker on two strands whose
// questions of one strand start further up (positive & negative deals take-away cards from its third step), the point
// strands.js `starts` gives for that strand.
export function startOf(map, strand) {
  const m = typeof map === 'string' ? MAPS[map] : map;
  if (!m) return 100;
  const s = isObj(m.starts) && fin(m.starts[strand]) ? m.starts[strand] : null;
  return s != null ? Math.max(m.anchors[0], s) : m.anchors[0];
}

// Every point the strand has material at (each step of each in-game maker on it, from startOf), low to high.
const POINTS = new Map();
function pointsOf(strand) {
  if (!POINTS.has(strand)) {
    const set = new Set();
    for (const m of Object.values(MAPS)) {
      if (!m.inGame || !m.strands.includes(strand)) continue;
      const st = startOf(m, strand);
      for (const p of m.anchors) if (p >= st - 0.05) set.add(p);
    }
    POINTS.set(strand, [...set].sort((a, b) => a - b));
  }
  return POINTS.get(strand);
}
// The easiest material the strand has above a level (null: none). When that is more than NEAR above, the level sits
// in a gap: nothing nearer can be asked (Addition between two-digit sums at 30 and positive & negative at 60; a strand
// placed under its maker's first step).
export function nextAbove(strand, level) {
  // (a maker that grows its numbers within a step has material all the way from its first step to its hardest: a level
  // inside it is never in a gap)
  for (const m of Object.values(MAPS)) {
    if (m.inGame && m.grows && m.strands.includes(strand) && level >= startOf(m, strand) - 0.05 && level < capOf(m) - 0.05) return r1(level + 0.1);
  }
  for (const p of pointsOf(strand)) if (p > level + 0.05) return p;
  return null;
}
// The top of the material that runs on from the strand's easiest question without a gap no maker covers (each
// maker's questions fit from GATE under its first step to TOP_MARGIN over its last): Addition 30, since positive &
// negative starts at 60. A start worked out from other strands never lands past it (seedOf): crossing a gap takes the
// rider's own answers on the material above it.
const RUNS = new Map();
export function runTop(strand) {
  if (!RUNS.has(strand)) {
    const ms = Object.values(MAPS).filter((m) => m.inGame && m.strands.includes(strand)).sort((a, b) => startOf(a, strand) - startOf(b, strand));
    let top = ms.length ? capOf(ms[0]) : 100;
    for (const m of ms.slice(1)) { if (startOf(m, strand) - SKILL.GATE > top + SKILL.TOP_MARGIN) break; top = Math.max(top, capOf(m)); }
    RUNS.set(strand, Math.min(100, top));
  }
  return RUNS.get(strand);
}

// Where the middle of a strand's material is: the middle step of its maker that reaches highest. A starting level
// worked out from related strands (seedOf) never starts above it, so a strand first met isn't asked its hardest step
// first (Time from a teen's addition, say).
function middleOf(strand) {
  let best = null;
  for (const m of Object.values(MAPS)) if (m.inGame && m.strands.includes(strand) && (!best || m.anchors.at(-1) > best.anchors.at(-1))) best = m;
  return best ? best.anchors[Math.floor((best.anchors.length - 1) / 2)] : 100;
}

// ---- small helpers ---------------------------------------------------------------------------------------------

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v, d) => (fin(v) ? v : typeof v === 'string' && v.trim() !== '' && fin(+v) ? +v : d);
const atOf = (v) => (fin(v) ? v : null);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;
const DAY = 86400000;
// the calendar day (local time) of a moment, as a whole number
export function dayOf(ms) { const d = new Date(ms); return Math.floor((ms - d.getTimezoneOffset() * 60000) / DAY); }
function median(list) {
  if (!list.length) return null;
  const a = [...list].sort((x, y) => x - y), k = a.length >> 1;
  return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2;
}
const mapOf = (m) => (typeof m === 'string' ? MAPS[m] : isObj(m) ? m : Array.isArray(m) ? { anchors: m, base: 1 } : null);

// Which step of a maker's ladder a point falls on: the highest step at or below it (never material above the
// level), and how far along toward the next step it is (frac, 0..1: a maker can grow its numbers with it; on the top
// step frac grows over TOP_MARGIN). below: the point is under the first step (the first step is used).
//   stepAt('times', 35) -> { i: 12, step: 13, frac: 0.5, id: null, below: false }   (0-based i, 1-based step)
//   stepAt('lockbox', 52) -> { i: 6, step: 7, frac: 0.33, id: 'R5', ... }
//   For the range (base 0) `step` is counted from 0 like its own STEPS: step === i.
export function stepAt(map, pct) {
  const m = mapOf(map);
  if (!m) throw new Error('stepAt: no map ' + map);
  const a = m.anchors, p = num(pct, 0);
  let i = 0;
  while (i + 1 < a.length && a[i + 1] <= p) i++;
  const frac = i + 1 < a.length ? clamp((p - a[i]) / (a[i + 1] - a[i]), 0, 1) : clamp((p - a[i]) / SKILL.TOP_MARGIN, 0, 1);
  return { i, step: i + (m.base === 0 ? 0 : 1), frac: Math.round(frac * 100) / 100, id: m.ids ? m.ids[i] : null, below: p < a[0] };
}

// The point of a step (1-based, or counted from 0 for a base-0 map; or a step's id), plus frac of the way to the next.
export function pctAt(map, step, frac = 0) {
  const m = mapOf(map);
  if (!m) throw new Error('pctAt: no map ' + map);
  const a = m.anchors;
  let i = typeof step === 'string' && m.ids ? m.ids.indexOf(step) : Math.round(num(step, 1)) - (m.base === 0 ? 0 : 1);
  if (i < 0) i = typeof step === 'string' ? -1 : 0;
  if (i < 0) return null;
  i = Math.min(a.length - 1, i);
  const f = clamp(num(frac, 0), 0, 1);
  const next = i + 1 < a.length ? a[i + 1] : a[i] + SKILL.TOP_MARGIN;
  return r1(a[i] + (next - a[i]) * f);
}

// ---- the rider's skill object ----------------------------------------------------------------------------------

function cleanStrand(s) {
  if (!isObj(s)) return null;
  s.level = r1(clamp(num(s.level, 0), 0, 100));
  s.placed = s.placed === true;
  for (const k of ['n', 'r', 'f']) s[k] = Math.max(0, Math.floor(num(s[k], 0)));
  s.k = Math.max(0, Math.floor(num(s.k, s.n)));   // (answers of half weight or more: the ones that can place a level)
  s.h = (Array.isArray(s.h) ? s.h : []).filter((x) => Array.isArray(x) && x.length >= 2).slice(-SKILL.HIST_KEEP)
    .map((x) => [x[0] ? 1 : 0, r1(clamp(num(x[1], 0), 0, 100)), x[2] ? 1 : 0]);
  s.t = (Array.isArray(s.t) ? s.t : []).filter((x) => Array.isArray(x) && fin(+x[0]) && +x[0] > 0).slice(-SKILL.TIMED_KEEP)
    .map((x) => [Math.round(+x[0]), Math.max(1, num(x[1], 1))]);
  s.days = (Array.isArray(s.days) ? s.days : []).filter((x) => Array.isArray(x) && fin(+x[0])).slice(-SKILL.DAYS_KEEP)
    .map((x) => [Math.floor(+x[0]), r1(clamp(num(x[1], 0), 0, 100))]);
  s.met = num(s.met, 0); s.last = num(s.last, 0);
  s.ln = Math.max(0, Math.floor(num(s.ln, 0)));   // (the rider's answer count, skill.n, at this strand's last answer)
  s.so = Math.max(0, Math.floor(num(s.so, 0)));   // (slow answers running, see SLOW_RESET)
  if (s.placed) s.base = null;
  else if (!isObj(s.base) || !['climb', 'down', 'check'].includes(s.base.phase)) s.base = newBase(s.level);
  else {
    const b = s.base;
    b.at = r1(clamp(num(b.at, s.level), 0, 100));
    b.lo = b.lo == null || !fin(+b.lo) ? null : +b.lo;
    b.hi = b.hi == null || !fin(+b.hi) ? null : +b.hi;
    for (const k of ['checks', 'rights', 'flukes', 'n', 'got', 'zero', 'tops', 'capRights']) b[k] = Math.max(0, Math.floor(num(b[k], 0)));
    b.sure = b.sure === true;
    b.start = b.start == null || !fin(+b.start) ? b.lo : +b.start;
    b.from = num(b.from, b.at);
    b.cap = b.cap == null || !fin(+b.cap) ? null : +b.cap;
  }
  return s;
}
function newBase(at) { return { phase: 'climb', at: r1(at), lo: null, hi: null, checks: 0, rights: 0, flukes: 0, n: 0, got: 0, zero: 0, sure: false, start: null, from: r1(at), cap: null, capRights: 0, tops: 0 }; }

// rider.skill, filled in and repaired (made if missing). Unknown strands (a newer build's) are kept as they are.
export function skillOf(rider) {
  if (!isObj(rider)) return { v: 1, migrated: 0, strands: {} };
  const sk = isObj(rider.skill) ? rider.skill : (rider.skill = {});
  sk.v = 1;
  sk.migrated = sk.migrated ? 1 : 0;
  sk.n = Math.max(0, Math.floor(num(sk.n, 0)));   // (answers recorded in every strand: a strand's re-check counts them)
  if (!isObj(sk.strands)) sk.strands = {};
  for (const id of Object.keys(sk.strands)) {
    if (!STRAND[id]) continue;
    const s = cleanStrand(sk.strands[id]);
    if (s) { s.level = Math.min(s.level, maxOf(id)); sk.strands[id] = s; } else delete sk.strands[id];
  }
  return sk;
}
const stateOf = (rider, id) => (isObj(rider) && isObj(rider.skill) && isObj(rider.skill.strands) && isObj(rider.skill.strands[id]) ? rider.skill.strands[id] : null);

export function isMet(rider, strand) { return !!stateOf(rider, strand); }
export function isPlaced(rider, strand) { const s = stateOf(rider, strand); return !!(s && s.placed); }

// The head start an optional age gives (rider.age): a modest one, well under the age's school year, since the
// baseline climbs fast from there (a 15-year-old starts at 33, third-grade work; a 10-year-old at 17).
export function ageStart(age) {
  const a = num(age, NaN);
  if (!fin(a)) return 0;
  return Math.round(clamp((a - SKILL.AGE.from) * SKILL.AGE.perYear, 0, SKILL.AGE.most));
}

// Where a strand not met yet would start (see SEEDING above).
// A related strand still finding its level counts at no less than the age's head start (its guess can sit low for a
// moment: one easy question right says little), and a start worked out from related strands is never above the
// middle of the strand's own material.
export function seedOf(rider, strand) {
  const def = STRAND[strand];
  if (!def) return 0;
  const age = ageStart(rider && rider.age);
  const metOf = (list) => Object.entries(list || {}).map(([s, f]) => [stateOf(rider, s), f]).filter(([s]) => s);
  let known = metOf(def.seed);
  if (!known.length) known = metOf(def.fallback);   // (none of the close ones met: the fallback, e.g. equations)
  let v = known.length
    ? Math.min(middleOf(strand), known.reduce((sum, [s, f]) => sum + (s.placed ? s.level : Math.max(s.level, age)) * f, 0) / known.length)
    : age;
  if (known.length && !known.some(([s]) => s.placed)) v = Math.max(v, age);   // (nothing placed yet: no lower than the age's start)
  // (never past a gap in the strand's material: a teen sure of equations starts Addition at two-digit sums, and meets
  // the negatives as the rider's own answers carry the level across, not on a guess from the lock boxes)
  return r1(clamp(Math.min(v, runTop(strand)), 0, maxOf(strand)));
}

// A strand placed under its maker's gate (a few early misses on order of operations, a 6-year-old's clock) is never
// asked again by fits alone. Once the rider's other math says it is time (a new rider with those levels would be
// offered it: seedOf at the gate or more) and a while has passed since its last answer (RECHECK: the next day, or a
// good many answers elsewhere), it is tried again: a short baseline from its first step (pick re-opens it). A rider
// who still misses there is put back under the gate by the baseline's bottom rule, until the next re-check.
function recheckDue(rider, strand, s, now) {
  if (!s || !s.placed || !(s.n > 0)) return false;   // (only a level the rider's own answers put there)
  const fl = floorOf(strand), gate = fl - SKILL.GATE;
  if (!(gate > 0) || s.level >= gate - 0.05) return false;
  if (seedOf(rider, strand) < gate) return false;
  const sk = rider.skill, since = num(sk && sk.n, 0) - num(s.ln, 0);
  return now - num(s.last, 0) >= SKILL.RECHECK.hours * 3600000 || since >= SKILL.RECHECK.answers;
}

// The rider's level in a strand: where they are, or (not met yet) where they would start.
export function levelOf(rider, strand) {
  const s = stateOf(rider, strand);
  return s ? s.level : seedOf(rider, strand);
}

// The strand's state, made (seeded, with a baseline to run) the first time it is met.
function ensure(rider, strand, now) {
  if (!STRAND[strand]) throw new Error('skill: no strand ' + strand);
  const sk = skillOf(rider);
  if (sk.strands[strand]) return sk.strands[strand];
  const seed = seedOf(rider, strand);
  return (sk.strands[strand] = { level: seed, placed: false, base: newBase(seed), n: 0, r: 0, f: 0, k: 0, h: [], t: [], days: [], met: now, last: 0 });
}

// The point (0..100) to make the next question at. The first time a strand comes up this starts its baseline, so
// rider.skill changes (the caller's next save keeps it).
export function pick(rider, strand, { now = Date.now() } = {}) {
  const s = ensure(rider, strand, now);
  if (recheckDue(rider, strand, s, now)) { s.placed = false; s.base = newBase(floorOf(strand)); }   // (see recheckDue)
  return s.placed ? s.level : s.base.at;
}

// Where the rider's next question in a strand would be asked, without meeting it: the level once placed, the point the
// baseline is trying (or the job's hardest question, when that is lower: stepFor's cap) while it runs, the start if
// not met yet. For a job deciding how much an answer far from it says.
export function probeOf(rider, strand) {
  const s = stateOf(rider, strand);
  if (!s) return seedOf(rider, strand);
  if (s.placed || !isObj(s.base)) return s.level;
  return s.base.cap != null ? Math.min(s.base.at, s.base.cap) : s.base.at;
}

// A maker's level: its strand's (the average, for a maker on two strands).
function mapPick(rider, m, now) {
  const v = m.strands.map((s) => pick(rider, s, { now }));
  return r1(v.reduce((a, b) => a + b, 0) / v.length);
}
function mapLevel(rider, m) {
  const v = m.strands.map((s) => levelOf(rider, s));
  return v.reduce((a, b) => a + b, 0) / v.length;
}
// (the same with the point each strand would be asked at now: probeOf, without meeting it)
function mapProbe(rider, m) {
  const v = m.strands.map((s) => probeOf(rider, s));
  return v.reduce((a, b) => a + b, 0) / v.length;
}

// pick() turned into a step of a maker's ladder: what to make now.
//   stepFor(rider, 'times') -> { map: 'times', strand: 'mul', strands: ['mul'], at: 35, step: 13, i: 12, frac: 0.5, id: null, below }
// `at` is the point to pass back to record (it says how hard the question really was). It is never above the maker's
// hardest (capOf), nor above `most` when a job holds its questions lower (the lock box for a rider who can't read yet):
// a level past that gets the top step, recorded at the top step's point (capped: true). While a strand is finding its
// level, the cap is kept on its baseline: right twice at the job's hardest settles the baseline there (see baseline).
export function stepFor(rider, mapId, { now = Date.now(), most = null } = {}) {
  const m = MAPS[mapId];
  if (!m) throw new Error('stepFor: no map ' + mapId);
  const want = mapPick(rider, m, now);
  const cap = fin(most) ? Math.max(m.anchors[0], Math.min(capOf(m), most)) : capOf(m);
  const capped = want > cap + 0.05;
  for (const id of m.strands) holdAt(stateOf(rider, id), capped ? cap : null);
  const at = capped ? r1(cap) : want;
  return { map: mapId, strand: m.strand, strands: [...m.strands], at, capped, ...stepAt(m, at) };
}

// A baseline whose point being tried is above what the job can ask: remember where the job's questions stop.
function holdAt(s, cap) {
  if (!s || s.placed || !isObj(s.base)) return;
  const B = s.base;
  if (B.cap === cap) return;
  B.cap = cap;
  // (a right already at that point counts as the first of the two)
  B.capRights = cap != null && B.lo != null && B.lo >= cap - 0.05 ? 1 : 0;
}

// ---- recording an answer ---------------------------------------------------------------------------------------

// strands: 'mul' | ['mul', 'words'] | [{ strand, at, weight }, ...]   (opts.at and opts.weight are the defaults)
function listOf(strands, o) {
  const list = Array.isArray(strands) ? strands : [strands];
  return list.map((x) => (typeof x === 'string' ? { strand: x } : isObj(x) ? x : null))
    .filter((x) => x && STRAND[x.strand])
    .map((x) => ({ strand: x.strand, at: atOf(x.at) ?? atOf(o.at), weight: clamp(num(x.weight, num(o.weight, 1)), 0, 1) }));
}

// Records one answer. opts:
//   right     true / false
//   at        the point the question was made at (stepFor's at, or pctAt of the step it came from). Leave it out only
//             when the question was made at pick()'s point just now. A warm-up or review from lower down MUST say so:
//             its right answers don't move the level up.
//   ms        how long the answer took (sit-down questions), size: the units of work in it (1 for a one-step fact,
//             the number of parts or steps otherwise) so a long question isn't "slow"
//   sitDown   true for a question answered sitting down (its time counts); travel jobs leave it out
//   hidden, idle   the tab was hidden / no input for a long while (src/ui/answertimer.js): the time is left out
//   weight    0..1, how much this answer counts in this strand (default 1). A strand still in its baseline moves only
//             on answers of weight 0.5 or more (a light extra credit says too little to place anyone)
// -> { [strand]: { level, before, moved, placed, justPlaced, fast, timed, outlier, next (the point to ask next) } }
export function record(rider, strands, opts = {}) {
  const now = num(opts.now, Date.now());
  const out = {};
  const sk = skillOf(rider);
  if (opts.tally !== false) sk.n = (sk.n || 0) + 1;
  // (only the answer's own strand, the first in the list, is timed: a word problem's time says nothing about how fast
  // its times-table part was)
  listOf(strands, opts).forEach((x, i) => { out[x.strand] = recordOne(rider, x, i === 0 ? opts : { ...opts, sitDown: false, ms: null }, now); });
  return out;
}

function recordOne(rider, { strand, at, weight }, o, now) {
  const s = ensure(rider, strand, now);
  const top = maxOf(strand);
  const right = !!o.right;
  const before = s.level, wasPlaced = s.placed;
  const asked = r1(clamp(at == null ? (s.placed ? s.level : s.base.at) : at, 0, top));
  const tally = o.tally !== false;   // (false: a summary answer that moves the level but isn't counted again, see record)

  // time: sit-down questions only, and never a time from a hidden tab, an idle spell, a very slow answer or one so
  // quick it was more likely a tap before reading (QUICK). SLOW_RESET slow answers running mean the kid's usual time
  // has moved (harder material, a new way of working): the times kept start over, so the median follows the kid
  let timed = false, fast = false, outlier = false;
  const ms = num(o.ms, NaN), size = Math.max(1, num(o.size, 1));
  if (o.sitDown && fin(ms) && ms > 0) {
    if (o.hidden || o.idle) outlier = true;
    else {
      const per = ms / size;
      let med = s.t.length >= SKILL.TIMED_MIN ? median(s.t.map(([m, z]) => m / z)) : null;
      if (med && per > SKILL.SLOW * med && (s.so = (s.so || 0) + 1) >= SKILL.SLOW_RESET) { s.t = []; s.so = 0; med = null; }
      if (med && (per > SKILL.SLOW * med || per < SKILL.QUICK * med)) outlier = true;
      else {
        if (!med || per <= SKILL.SLOW * med) s.so = 0;
        timed = true;
        fast = right && !!med && per < SKILL.FAST * med;
        if (right) { s.t.push([Math.round(ms), size]); if (s.t.length > SKILL.TIMED_KEEP) s.t.splice(0, s.t.length - SKILL.TIMED_KEEP); }
      }
    }
  }

  if (tally) {
    s.n++; if (right) s.r++; if (fast) s.f++;
    s.h.push([right ? 1 : 0, asked, fast ? 1 : 0]);
    if (s.h.length > SKILL.HIST_KEEP) s.h.splice(0, s.h.length - SKILL.HIST_KEEP);
  }
  if (weight >= 1) s.k = (s.k || 0) + 1;
  s.ln = num(rider.skill && rider.skill.n, 0);

  // (only a whole answer moves a baseline, either way: an extra credit at part weight, a times part in a word problem,
  // says too little about that strand to place it, and a right one mustn't climb it where a missed one couldn't stop it)
  if (!s.placed) { if (weight >= 1) baseline(s, right, asked, top, weight, Math.max(floorOf(strand), num(o.floor, 0)), strand); }
  else if (weight > 0) {
    // the staircase: only answers that say something new move it (see NEAR). A miss far below the level is mostly a
    // slip (a right there says nothing, so a full step down for each slip would drag the level under the rider): it
    // counts half from NEAR below, a quarter from twice that.
    const d = s.level - asked;
    const up = (fast ? SKILL.FAST_UP : SKILL.UP) * weight;
    // A miss above the level counts only within NEAR, except on the EASIEST material the strand has above the level
    // when that is further up (the level sits in a gap: Addition past two-digit sums, the negatives at 60; a strand under
    // its maker's first step): nothing nearer can be asked, so that question is the level's own test, and a kid who
    // misses it comes back down to the material below instead of waiting there on cards they miss
    const nx = nextAbove(strand, s.level);
    const edge = nx != null && asked > s.level + SKILL.NEAR && asked <= nx + 0.05;
    // (a right at a job's hardest question, below the level, can't lift the level more than a step past that question:
    // the staircase can't find out more there, and a level can't climb on material it never asks)
    if (right && asked >= s.level - SKILL.NEAR) s.level = asked < s.level - 0.05 && capsOf(strand).has(asked) ? Math.max(s.level, Math.min(s.level + up, asked + up)) : s.level + up;
    else if (!right && (asked <= s.level + SKILL.NEAR || edge)) s.level -= SKILL.DOWN * weight * (d <= SKILL.NEAR ? 1 : d <= 2 * SKILL.NEAR ? 0.5 : 0.25);
    // ...and right CROSS times running on material at or past that point (no miss there between), the gap is crossed:
    // the level above it is not known yet, so the baseline goes on from there (the easiest of those rights is the
    // confirmed right, the climb asks JUMP above it; see THE BASELINE). +1 a right answer would take dozens of answers
    // on material the kid already has
    if (right && nx != null && nx > before + SKILL.NEAR && asked >= nx - 0.05 && tally && weight >= 1) {
      const run = s.h.filter((x) => x[1] >= nx - 0.05).slice(-SKILL.CROSS);
      if (run.length >= SKILL.CROSS && run.every((x) => x[0])) {
        const lo = Math.min(...run.map((x) => x[1]));
        s.placed = false; s.base = newBase(Math.min(top, lo + SKILL.JUMP));
        Object.assign(s.base, { lo, start: lo });   // (not `sure`: the first check asks it again, a run of lucky guesses happens)
        s.level = r1(clamp(Math.max(s.level, lo - SKILL.SETTLE_BELOW), 0, top));
      }
    }
    // a miss on the strand's easiest material doesn't take the level under its maker's gate while the rider gets most
    // of their recent answers in it right: below the gate nothing would ask the strand again (a random walk at the 80%
    // point ends there). A kid missing most of it goes under, and the maker stops asking
    const fl = floorOf(strand), gate = fl - SKILL.GATE;
    if (!right && gate > 0 && asked <= fl + 0.05 && before >= gate && s.level < gate
      && s.h.length >= 4 && s.h.reduce((a, x) => a + x[0], 0) >= s.h.length / 2) s.level = gate;
    s.level = r1(clamp(s.level, 0, top));
  }

  const day = dayOf(now), last = s.days[s.days.length - 1];
  if (last && last[0] === day) last[1] = s.level; else s.days.push([day, s.level]);
  if (s.days.length > SKILL.DAYS_KEEP) s.days.splice(0, s.days.length - SKILL.DAYS_KEEP);
  s.last = now;
  return { level: s.level, before, moved: r1(s.level - before), placed: s.placed, justPlaced: s.placed && !wasPlaced, fast, timed, outlier,
    next: s.placed ? s.level : s.base.at };
}

// One step of the baseline (see THE BASELINE at the top). `at` is where the question was asked; weight how much the
// answer counts (a whole answer: a lighter one never reaches here).
function baseline(s, right, at, top, weight = 1, floor = 0, strand = null) {
  const B = s.base, J = SKILL.JUMP, eps = 0.05;
  // Where the questions really are now: the point being tried, or the job's hardest question when that is lower
  // (stepFor's cap). An answer far below it (a lock box's number part, a picture box's sum) says nothing new: a right
  // there is already known, and a miss there under a point already answered right is a slip, not a reason to throw
  // that right away. A weaker kid shows it soon enough on the questions at the point being tried. (An extra credit at
  // part weight never gets here: recordOne.)
  const P = B.cap != null ? Math.min(B.at, B.cap) : B.at;
  if (at < P - SKILL.NEAR - eps && (right || B.lo == null || at < B.lo - eps)) return;
  if (weight < 1) return;
  // An answer across a gap in the strand's material from the point being tried (a lock-box part with negatives in it
  // while Addition is being tried at two-digit sums): a miss there says nothing about the material below the gap, and
  // a right climbs only after CROSS rights running there, as the staircase crosses (one lucky part is not the negatives)
  // (a gap: material at or below the point being tried, and none from there to NEAR above it; a point under the strand's
  // easiest material is no gap, its first step is simply the next question)
  const nxP = strand && pointsOf(strand)[0] <= P + eps ? nextAbove(strand, P) : null;
  if (nxP != null && nxP > P + SKILL.NEAR && at >= nxP - eps) {
    if (!right) return;
    const run = s.h.filter((x) => x[1] >= nxP - eps).slice(-SKILL.CROSS);
    if (!(run.length >= SKILL.CROSS && run.every((x) => x[0]))) return;
    at = Math.min(at, ...run.map((x) => x[1]));
  }
  B.n = (B.n || 0) + 1;
  // (a rider who got the strand's easiest material right settles no lower than its maker's gate: below it, nothing
  // would ask the strand again)
  const settle = (v) => { if (B.lo != null && B.lo >= floor - eps && floor - SKILL.GATE > 0) v = Math.max(v, floor - SKILL.GATE); s.level = r1(clamp(v, 0, top)); s.placed = true; s.base = null; };
  // the best guess so far (what levelOf says while the baseline runs): below the highest right, or the probe. While
  // climbing, a right answer never lowers it (a first right at the seed doesn't show a level 5 under the seed)
  const guess = () => {
    if (B.n >= SKILL.BASE_MOST) return settle(B.lo != null ? B.lo - SKILL.SETTLE_BELOW : B.at - J / 2);   // (a long, muddled baseline: stop here)
    const g = B.lo != null ? B.lo - SKILL.SETTLE_BELOW : Math.min(s.level, B.at);
    s.level = r1(clamp(B.phase === 'climb' && B.lo != null ? Math.max(s.level, g) : g, 0, top));
  };
  // the lowest point worth trying: 0, or for a strand whose material starts higher up (order of operations at 45) its
  // first maker's gate, so the strand's easiest question can still be asked (below it nothing would ask again)
  const low = floor - SKILL.GATE > 0 ? floor - SKILL.GATE : 0;
  const atBottom = (v) => v <= Math.max(floor, 0) + eps;
  // a miss on the easiest material there is: once may be a slip (ask again), twice means start at the bottom. (Never
  // above where the questions were being tried: a young rider whose division sits under the first step stays there.)
  const bottom = () => {
    B.zero = (B.zero || 0) + 1;
    if (B.zero >= 2) return settle(Math.min(low, s.level));
    B.phase = 'climb'; B.at = r1(Math.min(low, B.at)); B.hi = null; B.lo = null; return guess();
  };
  // step down from a point (missed, or a right that wasn't confirmed) until a right answer is confirmed. A miss far
  // above the question being tried (a job whose easiest question sits well above the rider) never moves the next
  // question up: it goes down from there, or stays
  const goDown = (from) => {
    B.phase = 'down'; B.got = 0; B.hi = r1(from); B.lo = null; B.sure = false;
    if (atBottom(from)) return bottom();
    B.at = r1(Math.min(B.at, Math.max(low, from - J)));
    return guess();
  };
  // the checks: the first asks the highest right point again (unless it was already confirmed), the others halve the
  // gap between the highest right and the lowest miss. A gap under GAP_MIN (only near 0: a confirmed right at 0 under a
  // miss at 3) has nothing new in it to ask, so no checks: the miss is taken as a fluke once (the climb goes on from
  // it), else the baseline settles
  const toCheck = () => {
    if (B.lo >= B.hi - eps) {
      // the missed point (or one above it) answered right twice since: the miss was a slip (a teen's first R0a box
      // missed, then right twice there). Climb on from it, once or twice a baseline (FLUKES)
      if (B.sure && B.flukes < SKILL.FLUKES) { B.flukes++; B.phase = 'climb'; B.at = r1(Math.min(top, B.lo + J)); B.hi = null; return guess(); }
      B.lo = Math.max(0, B.hi - J / 2);
    }
    if (B.sure && B.hi - B.lo < SKILL.GAP_MIN) {
      if (B.flukes < SKILL.FLUKES) { B.flukes++; B.phase = 'climb'; B.at = r1(B.hi); B.hi = null; return guess(); }
      return settle(B.lo - SKILL.SETTLE_BELOW);
    }
    B.phase = 'check'; B.checks = 0; B.rights = 0; B.start = B.lo;
    B.at = r1(B.sure ? (B.lo + B.hi) / 2 : B.lo);
    return guess();
  };

  if (B.phase === 'climb') {
    if (right) {
      if (at >= top - eps) {
        // right at the very top: nothing harder to find. Asked once more there before it counts (one lucky guess, or a
        // part credited at the top, never places a strand at its top, nor moves the guess shown meanwhile)
        if (B.tops >= 1 && B.at >= top - eps) return settle(top);
        B.tops = 1; B.at = top; B.hi = null;
        return guess();
      }
      B.lo = B.lo == null ? at : Math.max(B.lo, at);
      if (B.hi != null && at >= B.hi) B.hi = null;   // (right above an earlier miss: that miss was a slip)
      if (at >= B.at - eps) { B.at = r1(Math.min(top, at + J)); return guess(); }
      // (a right answer below the point being tried says nothing new: no climb.) But when it is the job's hardest
      // question (stepFor's cap) there is nothing harder to ask here: right twice there, the baseline settles AT it (no
      // limit was found, the material just ran out: the staircase takes it on from there)
      if (B.cap != null && B.cap < B.at - eps && at >= B.cap - eps && B.lo <= B.cap + eps) {
        B.capRights = (B.capRights || 0) + 1;
        if (B.capRights >= 2) return settle(B.lo);
      }
      return guess();
    }
    B.hi = B.hi == null ? at : Math.min(B.hi, at);
    if (B.lo == null) return atBottom(at) ? bottom() : goDown(at);
    return toCheck();
  }

  if (B.phase === 'down') {
    if (right && at >= P - eps) {
      // a right answer on the way down is asked once more before it counts (with a few answers to choose from, a
      // guess is right often enough to stop the descent much too high)
      if (!B.got) { B.got = 1; return guess(); }
      B.lo = at; B.sure = true;
      return toCheck();
    }
    if (right) return guess();   // (an older question's right answer: nothing new)
    if (atBottom(at)) return bottom();
    return goDown(Math.min(B.hi == null ? at : B.hi, at));
  }

  // check
  const reask = B.checks === 0 && !B.sure;
  B.checks++;
  if (right) { B.rights++; B.lo = Math.max(B.lo, at); if (reask) B.sure = true; }
  else {
    // the highest right point asked again and missed: it may have been a guess. Go down from it.
    if (reask) return goDown(B.lo);
    B.hi = Math.min(B.hi, at);
    if (B.hi <= B.lo) B.lo = Math.max(0, B.hi - J / 2);
  }
  B.at = r1((B.lo + B.hi) / 2);
  if (B.checks < SKILL.CHECKS) return guess();
  if (B.rights === SKILL.CHECKS && B.flukes < SKILL.FLUKES) {
    // every check right: the miss looks like a fluke. Ask the missed point again and climb on from there.
    B.flukes++; B.phase = 'climb'; B.at = r1(B.hi); B.hi = null;
    return guess();
  }
  settle(B.lo - SKILL.SETTLE_BELOW);
}

// ---- for the stats page ------------------------------------------------------------------------------------------

// -> [{ strand, name, short, pct, placed, finding, answered, right, recentPct, avgMs, fast, history: [{ day, pct }] }]
//    the strands met, in STRANDS order (all: every strand; the ones not met have pct null). pct is a whole number;
//    recentPct the share right of the last HIST_KEEP answers; avgMs the average time of the recent timed answers (or
//    null); history one point a day practised.
export function stats(rider, { all = false } = {}) {
  const out = [];
  for (const def of STRANDS) {
    const s = stateOf(rider, def.id);
    if (!s && !all) continue;
    if (!s) { out.push({ strand: def.id, name: def.name, short: def.short, pct: null, placed: false, finding: false, answered: 0, counted: 0, right: 0, recentPct: null, avgMs: null, fast: 0, history: [] }); continue; }
    const recent = s.h.length ? Math.round((100 * s.h.reduce((a, x) => a + x[0], 0)) / s.h.length) : null;
    const avg = s.t.length ? Math.round(s.t.reduce((a, x) => a + x[0], 0) / s.t.length) : null;
    // (counted: the answers that could place a level, half weight or more; a strand with only light extra credits so
    // far has had a little practice, but its level hasn't really been looked for yet)
    out.push({ strand: def.id, name: def.name, short: def.short, pct: Math.round(s.level), placed: s.placed, finding: !s.placed,
      answered: s.n, counted: Math.min(s.n, num(s.k, s.n)), right: s.r, recentPct: recent, avgMs: avg, fast: s.f, history: s.days.map(([d, l]) => ({ day: d, pct: Math.round(l) })) });
  }
  return out;
}

// What a point on a strand's scale means, in words: the nearest point at or below it in the strand's table.
export function meaning(strand, pct) {
  const def = STRAND[strand];
  if (!def) return '';
  let w = def.scale[0][1];
  for (const [p, t] of def.scale) if (pct >= p) w = t;
  return w;
}

// ---- choosing what a job asks ------------------------------------------------------------------------------------

// Does a maker have material near the rider's level? Its level must be at least GATE points below its first step
// (a kindergartner gets no times tables) and at most TOP_MARGIN past its last one (a teen gets no counting dots),
// except that a maker past its top still serves when the strand's next maker among `mapIds` starts higher up than the
// level (a gap in the material: the nearest material below is used).
// A maker with `opens` (positive & negative) is also on offer once one of its strands is PLACED at that level or more,
// whatever the average: a kid sure of two-digit sums meets the first negatives without waiting for both strands to climb
// through the gap where nothing else is asked.
// While a strand is still finding its level, the point being tried counts too: a maker with material there is on offer
// (the store's word problems for a rider whose picture-story guess is still low), and a maker whose hardest question is
// under that point gives way to one of the job's other makers of that strand that reaches it (the picture stories to the
// word problems, the kindergarten boxes to the lock box ladder). With no such maker it stays, and its hardest question
// settles the baseline (stepFor's cap).
export function fits(rider, mapId, mapIds = [mapId], now = Date.now()) {
  const m = MAPS[mapId];
  if (!m) return false;
  const lvl = mapLevel(rider, m), a = m.anchors;
  const findingS = (s) => { const st = stateOf(rider, s); return !!(st && !st.placed); };
  const finding = m.strands.some(findingS);
  const probe = finding ? mapProbe(rider, m) : lvl;
  const opened = fin(m.opens) && m.strands.some((s) => { const st = stateOf(rider, s); return st && st.placed && st.level >= m.opens; });
  // (a strand placed under this maker's gate whose re-check is due: see recheckDue)
  const recheck = m.strands.some((s) => a[0] <= floorOf(s) + 0.05 && recheckDue(rider, s, stateOf(rider, s), now));
  if (Math.max(lvl, probe) < a[0] - SKILL.GATE && !opened && !recheck) return false;
  // a strand finding its level above this maker's hardest question: the maker gives way to another of the job's makers
  // that can ask THAT strand at the point being tried (positive & negative takes over Subtraction only from its first
  // take-away cards: strands.js `starts`)
  if (finding && probe > capOf(m) + 0.05 && m.strands.some((s) => findingS(s) && probeOf(rider, s) > capOf(m) + 0.05 && mapIds.some((k) => {
    const o = MAPS[k];
    return k !== mapId && o && o.strands.includes(s) && capOf(o) > capOf(m) && probeOf(rider, s) >= startOf(o, s) - SKILL.GATE;
  }))) return false;
  // (a strand the rider hasn't been placed in yet is judged at no less than the optional age's head start, so a teen
  // isn't dealt counting cards or picture boxes before showing they need them)
  const old = m.strands.every((s) => isPlaced(rider, s)) ? lvl : Math.max(lvl, ageStart(rider && rider.age));
  if (old <= a[a.length - 1] + SKILL.TOP_MARGIN) return true;
  // past this maker's top: it still serves as the nearest material below a gap, until another maker of the strand can
  // ask the level (its first question for that strand within GATE)
  return mapIds.some((k) => k !== mapId && MAPS[k] && MAPS[k].strands.some((s) => m.strands.includes(s) && startOf(MAPS[k], s) > a[a.length - 1] && old < startOf(MAPS[k], s) - SKILL.GATE));
}

// How often a maker on offer only through `opens` (positive & negative for a kid sure of two-digit sums) is chosen,
// next to the makers with material at the level
const OPENED_SHARE = 0.5;

// Which of a job's makers to ask next: one that fits (above), weighted toward a strand still finding its level (so a
// baseline finishes) and toward strands not practised for a while, and away from the one just asked (last).
// -> a map id, or null if none fits. rand: a random source 0..1 (tests pass a seeded one).
export function chooseMap(rider, mapIds, { rand = Math.random, last = null, now = Date.now() } = {}) {
  const ok = mapIds.filter((k) => fits(rider, k, mapIds, now));
  if (!ok.length) return null;
  const w = ok.map((k) => {
    const m = MAPS[k];
    const states = m.strands.map((s) => stateOf(rider, s));
    // (leaning toward a strand still finding its level only where this maker can ask that strand at the point being
    // tried: positive & negative doesn't get the weight for a Subtraction baseline down at two-digit sums)
    const finding = m.strands.some((s, j) => states[j] && !states[j].placed && probeOf(rider, s) >= startOf(m, s) - SKILL.GATE);
    const lastAt = Math.max(0, ...states.map((s) => (s ? s.last : 0)));
    const days = lastAt ? (now - lastAt) / DAY : 2;
    // (a maker on offer only through `opens`, or for a re-check, its material still well above the level: now and
    // then, not as often; full share once one of its strands has reached its own first questions)
    const reached = m.strands.some((s, j) => states[j] && states[j].level >= startOf(m, s) - SKILL.GATE);
    const stretch = !reached && mapLevel(rider, m) < m.anchors[0] - SKILL.GATE ? OPENED_SHARE : 1;
    return (finding ? 3 : 1) * stretch * (1 + Math.min(2, Math.max(0, days))) * (k === last && ok.length > 1 ? 0.5 : 1);
  });
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ok.length; i++) { r -= w[i]; if (r < 0) return ok[i]; }
  return ok[ok.length - 1];
}

// Questions are read out loud (src/audio/readaloud.js) for a kid who can't read yet, so they can still play everything.
// The grown-ups' switch (rider.readAloud) has three settings: false = off; 'on' = always; anything else (true, the
// default) = by itself: on for a rider whose age is set at READ_AGE or under, else while both the rider's best PLACED
// strand (or a level brought over from an old save: real progress from earlier rides, placed there or not) and the
// age's head start are under READ_BELOW (a level still being found can climb fast for a moment and says little about
// reading; a 15-year-old's start, 33, keeps it off whatever the levels; an old algebra rider at equations 74 is a reader).
export function readAloud(rider) {
  if (!rider || rider.readAloud === false) return false;
  if (rider.readAloud === 'on') return true;
  const age = num(rider.age, NaN);
  if (fin(age) && age <= SKILL.READ_AGE) return true;
  const sk = rider.skill && isObj(rider.skill.strands) ? rider.skill.strands : {};
  const lv = Object.keys(sk).filter((k) => STRAND[k] && isObj(sk[k]) && (sk[k].placed === true || sk[k].old === true)).map((k) => num(sk[k].level, 0));
  const best = Math.max(ageStart(rider.age), ...lv);   // (an age given counts too: a teen whose levels sit low isn't read to)
  return best < SKILL.READ_BELOW;
}

// Dev, rigs and tests: put a strand at a level (placed unless placed: false, which starts a baseline from there).
export function setLevel(rider, strand, pct, { placed = true, now = Date.now() } = {}) {
  const s = ensure(rider, strand, now);
  s.level = r1(clamp(num(pct, 0), 0, maxOf(strand)));
  s.placed = !!placed;
  s.base = placed ? null : newBase(s.level);
  return s;
}

// ---- reading today's riders into the strands (once) --------------------------------------------------------------
// Each old topic's ladder step becomes its strand's starting level, so nothing is lost. A topic the rider had placed
// (finished its first-visit climb) gives a placed strand; one still climbing gives a baseline that starts there. Two
// topics on one strand (counting and the range; adding and positive & negative) give the higher. The topics'
// own objects (rider.topics.*) are left exactly as they are: the trainers still keep their missed facts in them.

// A topic still on its first-visit climb counts only once it was played a little (OLD_MIN waves, cards, orders or
// boxes): a wave or two says almost nothing, and its low step would only seed the other strands low (an algebra rider
// who once roped one adding steer was asked "what comes after 2"). A placed topic always counts.
const OLD_MIN = 3;
const played = {
  trainer: (S) => S.placed === true || num(S.clock, 0) >= OLD_MIN || num(S.waves, 0) >= OLD_MIN,   // times and the card trainers
  range: (S) => S.placed === true || num(S.cards, 0) >= OLD_MIN,
  ladder: (S) => S.placing === false || num(S.n, 0) >= OLD_MIN,                                    // the store, deliveries, loot
  algebra: (S) => S.placing === false || num(S.boxes, 0) >= OLD_MIN,
};
const OLD = [
  // [topic in rider.topics, map, how to tell it was played, placed?]
  ['counting', 'counting', played.trainer, (S) => S.placed === true],
  ['numbersense', 'range', played.range, (S) => S.placed === true],
  ['adding', 'adding', played.trainer, (S) => S.placed === true],
  ['taking', 'taking', played.trainer, (S) => S.placed === true],
  ['negatives', 'negatives', played.trainer, (S) => S.placed === true],
  ['times', 'times', played.trainer, (S) => S.placed === true],
  ['dividing', 'dividing', played.trainer, (S) => S.placed === true],
  ['store', 'store', played.ladder, (S) => S.placing === false],
  ['delivery', 'supplies', played.ladder, (S) => S.placing === false],
  ['loot', 'shares', played.ladder, (S) => S.placing === false],
];

// -> { strand: { level, placed } } from a rider's old topics (nothing is changed)
export function oldLevels(rider) {
  const T = isObj(rider && rider.topics) ? rider.topics : {};
  const got = {};
  // two topics on one strand: the higher level, with ITS placed flag (an unplaced climb above a placed topic starts a
  // baseline there; it is not taken as placed)
  const put = (strand, level, placed) => {
    if (!fin(level)) return;
    const g = got[strand];
    if (!g || level > g.level || (level === g.level && placed && !g.placed)) got[strand] = { level, placed };
  };
  for (const [topic, mapId, wasPlayed, wasPlaced] of OLD) {
    const S = T[topic];
    if (!isObj(S) || !wasPlayed(S)) continue;
    const m = MAPS[mapId];
    const lv = pctAt(m, num(S.step, m.base === 0 ? 0 : 1));
    for (const s of m.strands) put(s, lv, wasPlaced(S));
  }
  const A = T.algebra;
  if (isObj(A) && played.algebra(A) && typeof A.rung === 'string') {
    const placed = A.placing === false;
    const within = (rung) => { const l = num(isObj(A.levels) ? A.levels[rung] : null, 2); return (clamp(l, 2, 4) - 2) / 3; };
    if (MAPS.lockbox.ids.includes(A.rung)) put('eq', pctAt('lockbox', A.rung, placed ? within(A.rung) : 0), placed);
    else if (MAPS.lockboxIneq.ids.includes(A.rung)) {
      put('eq', pctAt('lockbox', 'R15'), true);   // past the vault: every equation rung is behind them
      put('ineq', pctAt('lockboxIneq', A.rung, placed ? within(A.rung) : 0), placed);
    }
  }
  return got;
}

// rider.skill, filled in. The first time (skill.migrated not set), the old topics' progress becomes the starting
// levels of their strands; a strand already in rider.skill is never overwritten. Safe to call on every load.
export function migrate(rider, { now = Date.now() } = {}) {
  const sk = skillOf(rider);
  if (sk.migrated) return sk;
  for (const [id, g] of Object.entries(oldLevels(rider))) {
    if (sk.strands[id]) continue;
    // (an old topic still on its first climb above a gap in the strand's material starts its baseline at the top of the
    // material below it: an unfinished first climb into positive & negative says too little to skip two-digit sums)
    const level = r1(clamp(g.placed ? g.level : Math.min(g.level, runTop(id)), 0, maxOf(id)));
    sk.strands[id] = { level, placed: g.placed, base: g.placed ? null : newBase(level), n: 0, r: 0, f: 0, k: 0, h: [], t: [], days: [], met: now, last: 0, old: true };
  }
  sk.migrated = 1;
  return sk;
}
