// model.js: THE LEVELS. Each place in the game (the round-up, the lock boxes, fishing ...) has ONE kind of math and ONE
// ladder of levels (src/levels/places.js lists the places; each ladder lives in src/levels/place/<id>.js as plain data).
// This file keeps, for each rider and each place, which level the rider is on and how far into it, finds that level
// the first time the rider meets the place (placement), moves it so the rider gets about 4 in 5 right (the staircase),
// skips the levels a grown-up switched off, and honours "start here". Pure functions over the rider object: nothing
// here touches the page or storage (save.js saves; recordAnswer is every job's one call).
//
// WHAT A RIDER KEEPS (rider.levels, saved with the rider):
//   { v: 1, migrated: 1, places: { roundup: Place, lockbox: Place, ... } }    a place appears the first time it is met
//   Place = {
//     id       the level the rider is on (during placement: the level being tried)
//     into     right answers banked toward the next level (0 .. that level's count; a miss takes DOWN off it)
//     g, s     the grade and strand of that level (so a ladder a lane edits later still finds the nearest level)
//     placed   false while placement runs (the first meeting), true after
//     base     placement in progress, or null: { phase: 'climb' | 'check' | 'down', lo (the highest level answered
//              right), n (answers), flukes, got (rights in a row on the way down),
//              cap (the hardest level the job asking now can ask, or null) }
//     lo, hi   THE RANGE: the easiest and the hardest level this place may ask (ids), set with the two-handled slider
//              on the levels page; kept only while it isn't the ladder's own end (no lo: from the first level; no hi:
//              up to the top, so a level added at a ladder's top later is in it)
//     keep     true: KEEP TO THESE LEVELS (adaptive level changes off); left out otherwise
//     off      ['id', ...] single levels skipped inside the range (the old ticks: an older save, or setOn; never all of
//              them). Setting the range clears them
//     start    the level a grown-up picked with "Start here" (shown on the levels page), or null
//     n, r, f  answers, right answers, fast right answers here
//     h        the last HIST_KEEP answers: [right 1/0, level id, fast 1/0]
//     t        the last TIMED_KEEP timed right answers: [ms, size]   (sit-down places only)
//     days     [day number, % at the end of that day], the last DAYS_KEEP days played
//     met, last    first met / last answered (ms since 1970); old: true when it came from an old save (migration)
//   }
//
// A LEVEL'S SIZE. Each level has a `count`: how many right answers a rider who gets them all right gives there (the
// design's "5 questions", 10 for the lock boxes past x on both sides). The rider's place on the ladder is (level, into): a right
// answer adds UP to `into`, and at `count` the rider moves to the next level that is on; a miss takes DOWN (4) off,
// and below 0 the rider goes back to the level before, that many short of its end. 1 up and 4 down settle where about
// 4 answers in 5 are right (the design's 80%). A fast right sit-down answer adds FAST_UP (2), but only from the place's
// `fastFrom` level up (null: never; the lock boxes from x on both sides).
// Only answers at the rider's own level say something new: a right answer at a lower level (a warm-up, a review) does
// not move the rider up; a miss one level down counts in full, further down half or a quarter (mostly a slip); a miss
// above the rider's level (a stretch) doesn't pull them down, and a right there counts like one at their own level.
//
// PLACEMENT (the first time a place comes up; no long test at the start): the rider starts on a level worked out from
// their other math (THE SEED, below) and moves ONE level per right answer (never a jump of several). A miss is
// checked: the missed level is asked once more. Right then (a slip, once a placement: FLUKES): the climb goes on.
// Missed again: the rider settles on the highest level answered right (at its start, so they practise it before trying
// the missed one again). The very first level missed twice: down a level at a time, and the first level answered right
// twice running (DOWN_SURE) is where the rider settles (the lowest level is as low as it goes). At most placeMost(P)
// (PLACE_MOST, or a longer ladder's levels and PLACE_SPARE)
// answers. Measured with simulated kids (~/pw/bandit-math/rigs/levels/foundation/sim.mjs, 3 seed sets of 100 kids a
// place and ability): kids land on average -1.6 to +1.7 levels from their own 80% level (mostly about +1) and get 72
// to 82% of the next 20 right; a kid who gets everything right gives one answer a level.
//
// THE SEED (where placement starts). Every level says where it sits on the school guide of a strand (`grade` on
// `strand`: src/math/strands.js, 0 = starting kindergarten ... 90-100 = algebra 1), and the strands keep being recorded
// under the hood (save.js recordAnswer records each answer at its level's grade). A place first met starts on the
// highest level, counting up from its first, whose strand the rider has shown at least SEED_BELOW points above its
// grade; a level whose strand the rider hasn't met is passed over (it neither stops the count nor counts) unless the
// rider's head start covers its grade. The head start is the STARTING DIFFICULTY picked when the rider was made
// (skill.js STARTS: Easy 0, Medium 30, Hard 60), or an older save's age (skill.js ageStart). The starting difficulty
// covers levels from the first up, and stops at the first level it doesn't cover (a ladder that comes back down the
// school guide later, the round-up's fractions after its negatives, doesn't pull a Hard start past the levels in
// between); an age passes over as it always did. The first level whose strand the rider has shown is under it stops
// the count. A new rider on Easy, or with no age, starts on the first level.
//
// THE RANGE (the game's maker, 2026-11-16: "a range selector at the top that had a min and max value (kind of like a
// price filter on Amazon). So instead of having 30 check boxes to uncheck, a slider can easily be adjusted to get
// medium-range questions"). Each place keeps the easiest and the hardest level it may ask (lo, hi): placement and the
// staircase move only between them, a level outside is never asked, and the level tool's arrows stop at them. The
// whole ladder until someone sets it. (Single levels skipped inside it, `off`, are the old ticks' way: an older save
// keeps them until the range is set.)
//
// KEEP TO THESE LEVELS (his words: "a setting in the menu to disable adaptive level changes. So if someone wants to
// really practice for a test, they can set it to the type of math questions they want without it always going up to
// the next one"). With `keep` on, the game never moves the level by itself at that place: no placement, no staircase,
// no skip moving it down. The rider stays on their level (brought into the range if it was outside it), the answers
// are still counted, and only the arrows by the level move it, inside the range. A skip still deals one easier question
// from the level below, inside the range. Off (the default): the game moves the level as above.
//
// OLD SAVES (migrate): once per rider, every place whose strands the rider has a level in (from the strand model,
// which itself read the old topics) gets a level the same way with no margin: the highest level at or under the
// school year the rider had reached. Placed there when the strand was placed, else placement starts there.
//
// THE API
//   levelFor(rider, placeId, { now, most })   -> what to ask now: { place, level (the ladder entry), id, i, n (levels),
//                                    into, count, pct, placing, capped, eased, kept (KEEP TO THESE LEVELS is on) }
//                                    (meets the place the first time: save after)
//                                    most: the hardest level id the job asking can ask (the windmill stops at 7)
//                                    eased: true for the one easier question after a skip (the level below)
//   skipLevel(rider, placeId, { now })   the help menu's skip: a gentle miss, never recorded as an answer (see A SKIP)
//                                 -> { id, before, moved, into, placed, ease }
//   recordLevel(rider, placeId, { right, level, ms, size, sitDown, hidden, idle, now })
//                                 -> { id, i, before, moved (levels: +1, -1, 0), into, placed, justPlaced, fast, timed,
//                                      outlier, pct }      level: the id asked (default: the rider's level)
//   pctOf(rider, placeId)         -> 0..100 how far up its ladder the rider is, or null (not met)
//   isMet, isPlaced, stateOf(rider, placeId), seedLevel(rider, placeId) -> id, levelPct(placeId, id) -> 0..100
//   levelHere(rider, placeId)     -> the level id the next question comes from (the rider's, or where they'd start),
//                                    without meeting the place
//   rangeOf(rider, placeId)       -> { lo, hi (indexes), loId, hiId, n, full, holes: [ids skipped inside it], keep }
//   setRange(rider, placeId, loId, hiId) -> true if changed (single skipped levels inside it come on again)
//   setKeep(rider, placeId, on) -> true if changed;  isKept(rider, placeId)
//   isOn(rider, placeId, id), onIds(rider, placeId), setOn(rider, placeId, id, on) -> true if changed,
//   setAllOn(rider, placeId) (the whole ladder, nothing skipped), startHere(rider, placeId, id)
//   placeStats(rider, { all })    -> [{ place, name, short, math, pic, pct, id, title, placed, finding, answered, right,
//                                      recentPct, avgMs, off, lo, hi, keep, start, history: [{ day, pct }] }]
//   migrate(rider), levelsOf(rider) (rider.levels, filled in), setLevelAt(rider, placeId, id, { placed }) (dev, tests)
//   LEVELS (the dials)

import { PLACE, PLACES } from './places.js';
import { headStart, difficultyOf } from '../math/skill.js';

// ---- the dials -----------------------------------------------------------------------------------------------------

export const LEVELS = {
  UP: 1,            // a right answer adds this to `into`...
  DOWN: 4,          // ...a miss takes this off: 1 up, 4 down settles where about 4 in 5 are right (the design's)
  SKIP_DOWN: 2,     // a skipped question (the help menu's skip, skipLevel below): half a miss, and the next one easier
  FAST_UP: 2,       // a fast right sit-down answer, from the place's fastFrom level up
  COUNT: 5,         // a level's count when its ladder doesn't give one (the design's "5 questions")
  FLUKES: 1,        // placement: a missed level answered right on its check this many times, and the climb goes on
  DOWN_SURE: 2,     // placement: right this many times running on the way down, and the rider settles there
  PLACE_MOST: 30,   // placement settles after this many answers whatever happens, or (a longer ladder) its levels and
  PLACE_SPARE: 5,   //   this many more (the round-up's 41: a kid who gets everything right can still climb to the top)
  SEED_BELOW: 5,    // a start from the rider's other math sits this many school-guide points under what they've shown
  FAST: 0.6,        // a sit-down answer is fast when its time per unit is under this share of the rider's median here
  QUICK: 0.25,      // ...but one under this share is left out (a tap before reading, more likely than a known answer)
  SLOW: 3,          // a time over this many times the median is left out (the kid looked away)
  TIMED_MIN: 5,     // timed right answers a place needs before speed counts
  TIMED_KEEP: 15,
  HIST_KEEP: 20,
  DAYS_KEEP: 60,
};

// ---- small helpers -------------------------------------------------------------------------------------------------

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v, d) => (fin(v) ? v : typeof v === 'string' && v.trim() !== '' && fin(+v) ? +v : d);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const DAY = 86400000;
function dayOf(ms) { const d = new Date(ms); return Math.floor((ms - d.getTimezoneOffset() * 60000) / DAY); }
function median(list) {
  if (!list.length) return null;
  const a = [...list].sort((x, y) => x - y), k = a.length >> 1;
  return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2;
}
function placeOf(placeId) {
  const P = PLACE[placeId];
  if (!P) throw new Error('levels: no place ' + placeId);
  return P;
}
const countOf = (L) => Math.max(1, Math.round(num(L && L.count, LEVELS.COUNT)));
const idx = (P, id) => P.levels.findIndex((L) => L.id === id);

// The rider's strands (src/math/skill.js keeps rider.skill): what the rider has really shown in a strand, or null. A
// strand counts once it is placed, came from an old save, or has answers of its own (its guess is then the rider's).
function shown(rider, strand) {
  const st = rider && isObj(rider.skill) && isObj(rider.skill.strands) ? rider.skill.strands[strand] : null;
  if (!isObj(st)) return null;
  if (st.placed === true || st.old === true || num(st.n, 0) > 0) return num(st.level, 0);
  return null;
}
const strandPlaced = (rider, strand) => {
  const st = rider && isObj(rider.skill) && isObj(rider.skill.strands) ? rider.skill.strands[strand] : null;
  return !!(isObj(st) && st.placed === true);
};

// ---- rider.levels ----------------------------------------------------------------------------------------------------

function cleanPlace(P, s) {
  if (!isObj(s)) return null;
  // the level: by id; a ladder changed since (a lane renamed or removed it): the nearest level on the same strand at or
  // under the grade it was saved at, else the nearest by grade
  let i = idx(P, s.id);
  if (i < 0) i = nearestByGrade(P, num(s.g, 0), typeof s.s === 'string' ? s.s : null);
  const L = P.levels[i];
  s.id = L.id; s.g = L.grade; s.s = L.strand;
  s.into = clamp(num(s.into, 0), 0, countOf(L));
  s.placed = s.placed === true;
  for (const k of ['n', 'r', 'f']) s[k] = Math.max(0, Math.floor(num(s[k], 0)));
  // the range (kept only while an end isn't the ladder's own: an id this ladder no longer has opens that end)
  if ('lo' in s || 'hi' in s) {
    const a = typeof s.lo === 'string' ? idx(P, s.lo) : -1, b = typeof s.hi === 'string' ? idx(P, s.hi) : -1;
    setEnds(P, s, a < 0 ? 0 : a, b < 0 ? P.levels.length - 1 : b);
  }
  if ('keep' in s && s.keep !== true) delete s.keep;
  s.off = [...new Set((Array.isArray(s.off) ? s.off : []).filter((x) => typeof x === 'string' && idx(P, x) >= 0))];
  { const [lo, hi] = bounds(P, s); if (!P.levels.some((L, i) => i >= lo && i <= hi && !s.off.includes(L.id))) s.off = []; }   // (never every level off)
  s.start = typeof s.start === 'string' && idx(P, s.start) >= 0 ? s.start : null;
  s.h = (Array.isArray(s.h) ? s.h : []).filter((x) => Array.isArray(x) && x.length >= 2).slice(-LEVELS.HIST_KEEP)
    .map((x) => [x[0] ? 1 : 0, String(x[1]), x[2] ? 1 : 0]);
  s.t = (Array.isArray(s.t) ? s.t : []).filter((x) => Array.isArray(x) && fin(+x[0]) && +x[0] > 0).slice(-LEVELS.TIMED_KEEP)
    .map((x) => [Math.round(+x[0]), Math.max(1, num(x[1], 1))]);
  s.days = (Array.isArray(s.days) ? s.days : []).filter((x) => Array.isArray(x) && fin(+x[0])).slice(-LEVELS.DAYS_KEEP)
    .map((x) => [Math.floor(+x[0]), clamp(Math.round(num(x[1], 0)), 0, 100)]);
  s.met = num(s.met, 0); s.last = num(s.last, 0);
  // (a skip's two: only kept tidy where a skip has been, so a save that never skipped stays exactly as it was)
  if ('ease' in s) s.ease = s.ease === true && (s.placed || s.keep === true);
  if ('k' in s) s.k = Math.max(0, Math.floor(num(s.k, 0)));
  if (s.placed) s.base = null;
  else if (!isObj(s.base) || !['climb', 'check', 'down'].includes(s.base.phase)) s.base = newBase();
  else {
    const B = s.base;
    B.lo = typeof B.lo === 'string' && idx(P, B.lo) >= 0 ? B.lo : null;
    B.cap = typeof B.cap === 'string' && idx(P, B.cap) >= 0 ? B.cap : null;
    for (const k of ['n', 'flukes', 'got']) B[k] = Math.max(0, Math.floor(num(B[k], 0)));
  }
  return s;
}
const newBase = () => ({ phase: 'climb', lo: null, n: 0, flukes: 0, got: 0, cap: null });
function nearestByGrade(P, g, strand) {
  let best = -1;
  P.levels.forEach((L, i) => { if ((!strand || L.strand === strand) && L.grade <= g + 0.05) best = i; });
  if (best >= 0) return best;
  let d = Infinity;
  P.levels.forEach((L, i) => { const e = Math.abs(L.grade - g); if (e < d) { d = e; best = i; } });
  return Math.max(0, best);
}

// rider.levels, filled in and repaired (made if missing). A place this build doesn't know (a newer build's) is kept.
export function levelsOf(rider) {
  if (!isObj(rider)) return { v: 1, migrated: 0, places: {} };
  const lv = isObj(rider.levels) ? rider.levels : (rider.levels = {});
  lv.v = 1;
  lv.migrated = lv.migrated ? 1 : 0;
  if (!isObj(lv.places)) lv.places = {};
  for (const id of Object.keys(lv.places)) {
    if (!PLACE[id]) continue;
    const s = cleanPlace(PLACE[id], lv.places[id]);
    if (s) lv.places[id] = s; else delete lv.places[id];
  }
  return lv;
}
export function stateOf(rider, placeId) {
  const lv = rider && isObj(rider.levels) && isObj(rider.levels.places) ? rider.levels.places : null;
  return lv && isObj(lv[placeId]) ? lv[placeId] : null;
}
export const isMet = (rider, placeId) => !!stateOf(rider, placeId);
export const isPlaced = (rider, placeId) => { const s = stateOf(rider, placeId); return !!(s && s.placed); };

// ---- which levels are on --------------------------------------------------------------------------------------------

function offSet(s) { return new Set(s && Array.isArray(s.off) ? s.off : []); }
// THE RANGE's ends as indexes, [lo, hi]: the whole ladder when none is set
function bounds(P, s) {
  let lo = s && typeof s.lo === 'string' ? idx(P, s.lo) : -1, hi = s && typeof s.hi === 'string' ? idx(P, s.hi) : -1;
  if (lo < 0) lo = 0;
  if (hi < 0) hi = P.levels.length - 1;
  return lo <= hi ? [lo, hi] : [hi, lo];
}
// the range's ends written into the place's state (an end at the ladder's own end is left out)
function setEnds(P, s, lo, hi) {
  if (lo > hi) [lo, hi] = [hi, lo];
  if (lo > 0) s.lo = P.levels[lo].id; else delete s.lo;
  if (hi < P.levels.length - 1) s.hi = P.levels[hi].id; else delete s.hi;
}
// the levels that are on, as indexes: the range, less any single level skipped inside it (all of the range when every
// one of those is off, which setOn never allows)
function onIndexes(P, s) {
  const off = offSet(s), [lo, hi] = bounds(P, s), range = [];
  for (let i = lo; i <= hi; i++) range.push(i);
  const on = range.filter((i) => !off.has(P.levels[i].id));
  return on.length ? on : range;
}
function nextOn(P, s, i) { return onIndexes(P, s).find((j) => j > i) ?? null; }
function prevOn(P, s, i) { const on = onIndexes(P, s).filter((j) => j < i); return on.length ? on[on.length - 1] : null; }
// the nearest level that is on: i itself, else the nearest below, else the nearest above
function nearestOn(P, s, i) {
  const on = onIndexes(P, s);
  if (on.includes(i)) return i;
  const below = on.filter((j) => j < i);
  return below.length ? below[below.length - 1] : on[0];
}

export function isOn(rider, placeId, id) {
  const P = PLACE[placeId], s = stateOf(rider, placeId);
  if (!P) return !offSet(s).has(id);
  const i = idx(P, id), [lo, hi] = bounds(P, s);
  return i >= lo && i <= hi && !offSet(s).has(id);
}
export function onIds(rider, placeId) { const P = placeOf(placeId); return onIndexes(P, stateOf(rider, placeId)).map((i) => P.levels[i].id); }

// a level brought into the range by itself: the range reaches out to it, and the levels between it and the old end are
// put in `off`, so only that one level comes on (setOn, startHere: the old ticks' meaning)
function reach(P, s, i) {
  const [lo, hi] = bounds(P, s);
  if (i >= lo && i <= hi) return;
  const off = offSet(s);
  if (i < lo) { for (let j = i + 1; j < lo; j++) off.add(P.levels[j].id); setEnds(P, s, i, hi); }
  else { for (let j = hi + 1; j < i; j++) off.add(P.levels[j].id); setEnds(P, s, lo, i); }
  s.off = P.levels.map((L) => L.id).filter((x) => off.has(x));
}

// One level on or off (the old ticks; tests and older saves). The last level that is on can't be switched off (->
// false). Switching a level off doesn't move the rider at once: the next question comes from the nearest level that is
// on (levelFor). A level outside the range switched on: the range reaches out to it (that level alone comes on).
export function setOn(rider, placeId, id, on, { now = Date.now() } = {}) {
  const P = placeOf(placeId);
  const i = idx(P, id);
  if (i < 0) return false;
  const s = ensure(rider, placeId, now);
  const [lo, hi] = bounds(P, s);
  const off = offSet(s);
  if (on) {
    if (i < lo || i > hi) { reach(P, s, i); s.off = s.off.filter((x) => x !== id); return true; }
    if (!off.delete(id)) return false;
  } else {
    if (i < lo || i > hi || off.has(id)) return false;
    if (onIndexes(P, s).length <= 1) return false;
    off.add(id);
  }
  s.off = P.levels.map((L) => L.id).filter((x) => off.has(x));   // (ladder order)
  return true;
}
// Every level on: the whole ladder, nothing skipped. -> true if anything changed
export function setAllOn(rider, placeId, { now = Date.now() } = {}) {
  const P = placeOf(placeId);
  const s = ensure(rider, placeId, now);
  const [lo, hi] = bounds(P, s);
  const was = s.off.length > 0 || lo > 0 || hi < P.levels.length - 1;
  s.off = []; delete s.lo; delete s.hi;
  return was;
}

// THE RANGE: where it is now. lo, hi: indexes (0-based); holes: single levels skipped inside it (an older save's ticks)
export function rangeOf(rider, placeId) {
  const P = placeOf(placeId), s = stateOf(rider, placeId);
  const [lo, hi] = bounds(P, s), off = offSet(s), holes = [];
  for (let i = lo; i <= hi; i++) if (off.has(P.levels[i].id)) holes.push(P.levels[i].id);
  return { lo, hi, loId: P.levels[lo].id, hiId: P.levels[hi].id, n: P.levels.length, full: lo === 0 && hi === P.levels.length - 1,
    holes, keep: !!(s && s.keep === true) };
}
// The range set (the levels page's slider): the easiest and the hardest level this place may ask, by id (either order;
// the same id twice: that one level). Single levels skipped before come on again: the range is the whole setting now.
// The rider isn't moved at once: the next question comes from the nearest level in it (levelFor). -> true if changed
export function setRange(rider, placeId, loId, hiId, { now = Date.now() } = {}) {
  const P = placeOf(placeId);
  let a = idx(P, loId), b = idx(P, hiId);
  if (a < 0 || b < 0) return false;
  if (a > b) [a, b] = [b, a];
  const s = ensure(rider, placeId, now);
  const [lo, hi] = bounds(P, s), had = s.off.length;
  setEnds(P, s, a, b);
  s.off = [];
  return a !== lo || b !== hi || had > 0;
}
// KEEP TO THESE LEVELS on or off for a place. -> true if changed
export function setKeep(rider, placeId, on, { now = Date.now() } = {}) {
  placeOf(placeId);
  const s = ensure(rider, placeId, now);
  const was = s.keep === true;
  if (on) s.keep = true; else delete s.keep;
  if (s.ease && !s.placed && !on) s.ease = false;   // (a skip's easier question waits only where it can be dealt)
  return was !== !!on;
}
export const isKept = (rider, placeId) => { const s = stateOf(rider, placeId); return !!(s && s.keep === true); };
// The level the next question comes from (the rider's, brought into the range; or, not met yet, where they'd start),
// without meeting the place or moving anything: the level tool and the levels page show it.
export function levelHere(rider, placeId) {
  const P = placeOf(placeId), s = stateOf(rider, placeId);
  if (!s) return seedLevel(rider || {}, placeId);
  const i = idx(P, s.id);
  return P.levels[nearestOn(P, s, i < 0 ? 0 : i)].id;
}

// "Start here" (the level tool's arrows): the rider goes straight to that level (switched on if it was off; outside
// the range, the range reaches out to it), placed, at its start. Placement is over for the place (the rider or a
// grown-up has placed them).
export function startHere(rider, placeId, id, { now = Date.now() } = {}) {
  const P = placeOf(placeId);
  const i = idx(P, id);
  if (i < 0) return false;
  const s = ensure(rider, placeId, now);
  reach(P, s, i);
  s.off = s.off.filter((x) => x !== id);
  moveTo(P, s, i, 0);
  s.placed = true; s.base = null; s.start = id;
  if (s.ease) s.ease = false;   // (a level picked by hand: the next question is from it, not a skip's easier one)
  return true;
}

// ---- seeding and meeting a place -----------------------------------------------------------------------------------

// Where a place starts for a rider (see THE SEED and OLD SAVES at the top). margin: school-guide points the rider must
// have shown above a level's grade; useAge: let the head start (the starting difficulty's, or an older save's age's)
// cover strands not met.
// -> { i, by } (by: 'strand' when a level was passed on the rider's own strands, 'start' (the starting difficulty),
// 'age', or null)
function seedOf(rider, P, { margin = LEVELS.SEED_BELOW, useAge = true } = {}) {
  const head = useAge ? headStart(rider) : 0, picked = useAge && !!difficultyOf(rider);
  let at = 0, by = null, gap = false;
  for (let i = 0; i < P.levels.length; i++) {
    const L = P.levels[i];
    const v = shown(rider, L.strand);
    if (v == null) {
      if (L.grade <= 0.05) { at = i; continue; }   // (a level at the very bottom of the school guide needs nothing)
      // (a starting difficulty covers levels only up to the first it doesn't: see THE SEED; an age passes over)
      if (head > 0 && L.grade <= head + 0.05 && !(picked && gap)) { at = i; by = by || (picked ? 'start' : 'age'); continue; }
      gap = true;
      continue;
    }
    if (v - margin + 0.05 >= L.grade) { at = i; by = 'strand'; continue; }
    break;
  }
  return { i: at, by };
}
export function seedLevel(rider, placeId) { const P = placeOf(placeId); const s = stateOf(rider, placeId); return P.levels[nearestOn(P, s, seedOf(rider, P).i)].id; }

function moveTo(P, s, i, into) {
  const L = P.levels[i];
  s.id = L.id; s.g = L.grade; s.s = L.strand; s.into = clamp(into, 0, countOf(L));
}

function ensure(rider, placeId, now) {
  const P = placeOf(placeId);
  const lv = levelsOf(rider);
  if (lv.places[placeId]) return lv.places[placeId];
  const s = { id: P.levels[0].id, into: 0, g: 0, s: '', placed: false, base: newBase(), off: [], start: null, n: 0, r: 0, f: 0, h: [], t: [], days: [], met: now, last: 0 };
  moveTo(P, s, seedOf(rider, P).i, 0);
  lv.places[placeId] = s;
  return s;
}

// ---- what to ask now ------------------------------------------------------------------------------------------------

export function levelPct(placeId, id, into = 0) {
  const P = placeOf(placeId);
  const i = Math.max(0, idx(P, id));
  return Math.round(clamp((100 * (i + clamp(into / countOf(P.levels[i]), 0, 1))) / P.levels.length, 0, 100));
}
export function pctOf(rider, placeId) {
  const s = stateOf(rider, placeId);
  return s ? levelPct(placeId, s.id, s.into) : null;
}

// What to ask now. The first call for a place meets it (seeds it and starts placement: save the rider after).
// most: the hardest level the job asking can ask (a level id); above it the job asks that level (capped: true), and a
// placement trying higher settles there once that level is answered right.
export function levelFor(rider, placeId, { now = Date.now(), most = null } = {}) {
  const P = placeOf(placeId);
  const s = ensure(rider, placeId, now);
  const kept = s.keep === true;   // (KEEP TO THESE LEVELS: no placement; the level stays where it is)
  let i = idx(P, s.id);
  // a level switched off since, or outside the range set since: the nearest one that is on
  const j = nearestOn(P, s, i);
  if (j !== i) { moveTo(P, s, j, 0); i = j; }
  const mi = typeof most === 'string' && idx(P, most) >= 0 ? nearestOn(P, s, idx(P, most)) : -1;
  let capped = false;
  if (!s.placed && !kept) {
    // (placement: the job's hardest level is the top of this placement; it settles there once answered right)
    s.base.cap = mi >= 0 ? P.levels[mi].id : null;
    if (mi >= 0 && i > mi) { moveTo(P, s, mi, 0); i = mi; }
  } else if (mi >= 0 && i > mi) { capped = true; i = mi; }
  let into = i === idx(P, s.id) ? s.into : 0;
  // (a skip just now (skipLevel): the next question comes from the level below the one asked, near its end, until the
  // next answer here is recorded; at the lowest level that is on there is nothing easier)
  let eased = false;
  if ((s.placed || kept) && s.ease === true) { const e = prevOn(P, s, i); if (e != null) { i = e; into = countOf(P.levels[e]) - 1; eased = true; } }
  const L = P.levels[i];
  return { place: placeId, level: L, id: L.id, i, n: P.levels.length, into, count: countOf(L),
    pct: levelPct(placeId, L.id, into), placing: !s.placed && !kept, capped, eased, kept };
}

// ---- a skip -----------------------------------------------------------------------------------------------------------

// THE HELP MENU'S "SKIP TO A NEW QUESTION" (src/ui/helpmenu.js): a gentle miss. The skipped question is never recorded
// as an answer: the counts (n, r), the history, the stats, the accuracy and the badges never see it. Only the rider's
// place on the ladder moves, and the next question comes a little easier:
//   after placement   half a miss off the bar (LEVELS.SKIP_DOWN, 2 where a miss takes 4; below 0 the rider goes back a
//                     level, as with a miss), and the next question here comes from the level below, once (`ease`:
//                     levelFor gives that level until the next answer here is recorded; a right answer down there
//                     doesn't move the rider up, as with any answer below their level)
//   finding the level the climb stops there: the rider settles on the highest level answered right so far, or, with
//                     none yet, steps down a level and the way down goes on from there
//   kept              (KEEP TO THESE LEVELS) the level stays; only the one easier question, from inside the range
// -> { id, before, moved (-1, 0), into, placed, ease }
export function skipLevel(rider, placeId, { now = Date.now() } = {}) {
  const P = placeOf(placeId);
  const s = ensure(rider, placeId, now);
  const cur = idx(P, s.id), before = s.id;
  s.k = Math.max(0, Math.floor(num(s.k, 0))) + 1;
  if (s.keep === true) s.ease = true;
  else if (!s.placed) {
    const B = s.base;
    B.n++;
    if (B.lo != null) { moveTo(P, s, idx(P, B.lo), 0); s.placed = true; s.base = null; }
    else {
      B.phase = 'down'; B.got = 0;
      const pv = prevOn(P, s, cur);
      if (pv == null) { moveTo(P, s, cur, 0); s.placed = true; s.base = null; } else moveTo(P, s, pv, 0);
    }
    if (!s.placed && B.n >= placeMost(P)) { moveTo(P, s, idx(P, s.id), 0); s.placed = true; s.base = null; }
  } else {
    let c = cur, into = s.into - LEVELS.SKIP_DOWN;
    while (into < 0) {
      const pv = prevOn(P, s, c);
      if (pv == null) { into = 0; break; }
      c = pv; into += countOf(P.levels[c]);
    }
    moveTo(P, s, c, Math.max(0, Math.round(into * 100) / 100));
    s.ease = true;
  }
  const i = idx(P, s.id);
  return { id: s.id, before, moved: Math.sign(i - cur), into: s.into, placed: s.placed, ease: s.ease === true };
}

// ---- recording an answer --------------------------------------------------------------------------------------------

export function recordLevel(rider, placeId, opts = {}) {
  const P = placeOf(placeId);
  const now = num(opts.now, Date.now());
  const s = ensure(rider, placeId, now);
  const right = !!opts.right;
  const cur = idx(P, s.id);
  let at = typeof opts.level === 'string' ? idx(P, opts.level) : cur;
  if (at < 0) at = cur;
  const before = s.id, beforeI = cur, wasPlaced = s.placed;
  if (s.ease) s.ease = false;   // (a skip's one easier question: any answer here ends it)

  // time (sit-down answers only; see LEVELS FAST, QUICK, SLOW)
  let timed = false, fast = false, outlier = false;
  const ms = num(opts.ms, NaN), size = Math.max(1, num(opts.size, 1));
  if (opts.sitDown && fin(ms) && ms > 0) {
    if (opts.hidden || opts.idle) outlier = true;
    else {
      const per = ms / size;
      const med = s.t.length >= LEVELS.TIMED_MIN ? median(s.t.map(([m, z]) => m / z)) : null;
      if (med && (per > LEVELS.SLOW * med || per < LEVELS.QUICK * med)) outlier = true;
      else {
        timed = true;
        const ff = P.fastFrom ? idx(P, P.fastFrom) : -1;
        fast = right && !!med && per < LEVELS.FAST * med && ff >= 0 && at >= ff;
        if (right) { s.t.push([Math.round(ms), size]); if (s.t.length > LEVELS.TIMED_KEEP) s.t.splice(0, s.t.length - LEVELS.TIMED_KEEP); }
      }
    }
  }

  s.n++; if (right) s.r++; if (fast) s.f++;
  s.h.push([right ? 1 : 0, P.levels[at].id, fast ? 1 : 0]);
  if (s.h.length > LEVELS.HIST_KEEP) s.h.splice(0, s.h.length - LEVELS.HIST_KEEP);

  // (KEEP TO THESE LEVELS: the answer is counted, the level isn't moved)
  if (s.keep === true) { /* kept */ } else if (!s.placed) placement(P, s, at, right);
  else staircase(P, s, at, right, fast);

  const i = idx(P, s.id);
  const pct = levelPct(placeId, s.id, s.into);
  const day = dayOf(now), last = s.days[s.days.length - 1];
  if (last && last[0] === day) last[1] = pct; else s.days.push([day, pct]);
  if (s.days.length > LEVELS.DAYS_KEEP) s.days.splice(0, s.days.length - LEVELS.DAYS_KEEP);
  s.last = now;
  return { id: s.id, i, before, moved: Math.sign(i - beforeI), into: s.into, placed: s.placed, justPlaced: s.placed && !wasPlaced,
    fast, timed, outlier, pct };
}

// After placement: the 80% staircase in `into` steps (see A LEVEL'S SIZE at the top).
function staircase(P, s, at, right, fast) {
  let c = idx(P, s.id);
  if (right) {
    if (at < c) return;   // (a warm-up or review below the rider's level: already known)
    let into = s.into + (fast ? LEVELS.FAST_UP : LEVELS.UP);
    while (into >= countOf(P.levels[c])) {
      const nx = nextOn(P, s, c);
      if (nx == null) { into = countOf(P.levels[c]); break; }   // (the top: full, nothing above)
      into -= countOf(P.levels[c]); c = nx;
    }
    moveTo(P, s, c, into);
    return;
  }
  if (at > c) return;   // (a stretch above the rider's level: a miss there is expected)
  const d = c - at;
  let into = s.into - LEVELS.DOWN * (d <= 1 ? 1 : d === 2 ? 0.5 : 0.25);
  while (into < 0) {
    const pv = prevOn(P, s, c);
    if (pv == null) { into = 0; break; }
    c = pv; into += countOf(P.levels[c]);
  }
  moveTo(P, s, c, Math.max(0, Math.round(into * 100) / 100));
}

// Placement, one answer (see PLACEMENT at the top).
export const placeMost = (P) => Math.max(LEVELS.PLACE_MOST, P.levels.length + LEVELS.PLACE_SPARE);
function placement(P, s, at, right) {
  const B = s.base, most = placeMost(P);
  const cur = idx(P, s.id);
  B.n++;
  const settle = (i) => { moveTo(P, s, i, 0); s.placed = true; s.base = null; };
  if (at !== cur) {   // (an answer from another level, a warm-up the job chose: it doesn't place anyone)
    if (B.n >= most) settle(B.lo != null ? idx(P, B.lo) : cur);
    return;
  }
  const capI = B.cap ? idx(P, B.cap) : -1;
  const up = () => (capI >= 0 && cur >= capI ? null : nextOn(P, s, cur));
  if (B.phase === 'climb') {
    if (right) {
      B.lo = P.levels[cur].id;
      const nx = up();
      if (nx == null) settle(cur); else moveTo(P, s, nx, 0);
    } else B.phase = 'check';   // (the missed level is asked once more)
  } else if (B.phase === 'check') {
    if (right && B.flukes < LEVELS.FLUKES) {
      // right on the check: the miss was a slip. The climb goes on (FLUKES times a placement)
      B.flukes++; B.lo = P.levels[cur].id; B.phase = 'climb';
      const nx = up();
      if (nx == null) settle(cur); else moveTo(P, s, nx, 0);
    } else if (B.lo != null) settle(idx(P, B.lo));
    else {
      // the very first level tried, missed twice (or a miss, a right and no slips left): down a level at a time
      B.phase = 'down'; B.got = 0;
      const pv = prevOn(P, s, cur);
      if (pv == null) settle(cur); else moveTo(P, s, pv, 0);
    }
  } else {   // down
    if (right) {
      if (++B.got >= LEVELS.DOWN_SURE) { B.lo = P.levels[cur].id; settle(cur); }
    } else {
      B.got = 0;
      const pv = prevOn(P, s, cur);
      if (pv == null) settle(cur); else moveTo(P, s, pv, 0);
    }
  }
  if (!s.placed && B.n >= most) settle(B.lo != null ? idx(P, B.lo) : idx(P, s.id));
}

// ---- for the levels page and the stats page -----------------------------------------------------------------------

export function placeStats(rider, { all = false } = {}) {
  const out = [];
  for (const P of PLACES) {
    const s = stateOf(rider, P.id);
    if (!s && !all) continue;
    const base = { place: P.id, name: P.name, short: P.short, math: P.math, pic: P.pic };
    if (!s) { out.push({ ...base, pct: null, id: null, title: null, placed: false, finding: false, answered: 0, right: 0, recentPct: null, avgMs: null, off: [], lo: null, hi: null, keep: false, start: null, history: [] }); continue; }
    const L = P.levels[Math.max(0, idx(P, s.id))];
    out.push({ ...base, pct: levelPct(P.id, s.id, s.into), id: s.id, title: L.title, placed: s.placed, finding: !s.placed,
      answered: s.n, right: s.r, recentPct: s.h.length ? Math.round((100 * s.h.reduce((a, x) => a + x[0], 0)) / s.h.length) : null,
      avgMs: s.t.length ? Math.round(s.t.reduce((a, x) => a + x[0], 0) / s.t.length) : null,
      off: [...s.off], lo: s.lo || null, hi: s.hi || null, keep: s.keep === true, start: s.start, history: s.days.map(([d, p]) => ({ day: d, pct: p })) });
  }
  return out;
}

// ---- old saves --------------------------------------------------------------------------------------------------------

// Once per rider: each place whose strands the rider has really shown gets its level from them (OLD SAVES at the top).
// A place already in rider.levels is never overwritten. Safe to call on every load (save.js fixRider does).
export function migrate(rider, { now = Date.now() } = {}) {
  const lv = levelsOf(rider);
  if (lv.migrated) return lv;
  for (const P of PLACES) {
    if (lv.places[P.id]) continue;
    const { i, by } = seedOf(rider, P, { margin: 0, useAge: false });
    if (by !== 'strand') continue;   // (nothing shown on this ladder's strands: met fresh, seeded, the first time)
    const L = P.levels[i];
    const s = { id: L.id, into: 0, g: L.grade, s: L.strand, placed: strandPlaced(rider, L.strand), base: null, off: [], start: null,
      n: 0, r: 0, f: 0, h: [], t: [], days: [], met: now, last: 0, old: true };
    if (!s.placed) s.base = newBase();
    lv.places[P.id] = s;
  }
  lv.migrated = 1;
  return lv;
}

// Dev, rigs and tests: put the rider on a level (placed unless placed: false, which starts placement there).
export function setLevelAt(rider, placeId, id, { placed = true, into = 0, now = Date.now() } = {}) {
  const P = placeOf(placeId);
  const i = idx(P, id);
  if (i < 0) throw new Error(`levels: ${placeId} has no level ${id}`);
  const s = ensure(rider, placeId, now);
  moveTo(P, s, i, into);
  s.placed = !!placed; s.base = placed ? null : newBase();
  if (s.ease) s.ease = false;
  return s;
}

export { PLACES, PLACE };
