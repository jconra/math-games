// The lock box on the levels (src/levels/model.js): which box comes next for this rider, and where its answer goes.
//
// WHICH BOX. The rider's level on the lock boxes' ladder (src/levels/place/lockbox.js), asked again for every box
// (levelFor), made by that level's maker (levelbox.js) with the numbers a little bigger the further into the level the
// rider is. A new sitting (2 hours away: algebra.js sets `warm`) opens with ONE box from the level below, once the
// rider's level is found (a warm-up: a right one there doesn't move them up). Placement (the first meeting) moves one
// level a box (the model's rule). The times facts in "3x = 12" and "x/4 = 3" are picked for the rider (src/math/
// facts.js pickFact: red facts due first, weak tables more often).
//
// WHERE THE ANSWER GOES. One box = one answer at its level (recordLevel; timed: a sit-down answer, so a fast right box
// counts double from x on both sides, the ladder's fastFrom). The same answer goes to the level's strand at its grade
// (the stats page's kinds of math; save.js recordAnswer does the same for other places), and a picture or find-x box
// also counts in adding or taking away at half weight, as before (strand.js missingCredit). A times fact asked goes to
// the times chart (recordFact). The parts of a move still go to their own strands (strand.js recordPart, unchanged).
// A box made some other way (the store's equation, a rung picked on the test page) has no place in its plan and is
// recorded the old way (strand.js recordBox).
//
// "YOU'VE REACHED ALGEBRA!" The first box past finding x (ALGEBRA_FROM, x on both sides, and anything above it) opens
// with the introduction once per rider; rider.topics.algebra.metAlgebra keeps when (the panel sets it). Below it the
// box is found, never moved.
//
//   planLevelBox(rider, alg, { rng, now, tier }) -> { plan, problem }
//     plan = { place: 'lockbox', id, title, i (its place on the ladder), strand, at (its grade), placing, kind: 'level'
//              | 'warm', review, algebra (true from x on both sides up), map, rung, level, frac, placed }
//   recordPlan(rider, plan, problem, { right, ms, size, hidden, idle, now }) -> the level's result (recordLevel), or the
//     skill model's (a plan with no place)
//   isAlgebra(levelId) -> true from x on both sides up;  ALGEBRA_FROM, PLACE_ID

import { levelFor, recordLevel, onIds } from '../levels/model.js';
import { PLACE } from '../levels/places.js';
import { pickFact, recordFact } from '../math/facts.js';
import { record as recordSkill } from '../math/skill.js';
import { levelBox, factTables } from './levelbox.js';
import { recordBox, missingCredit } from './strand.js';

export const PLACE_ID = 'lockbox';
export const ALGEBRA_FROM = 'both';

const ladder = () => PLACE[PLACE_ID].levels;
const indexOf = (id) => ladder().findIndex((L) => L.id === id);
export const isAlgebra = (id) => { const i = indexOf(id), a = indexOf(ALGEBRA_FROM); return i >= 0 && a >= 0 && i >= a; };

export function planLevelBox(rider, alg, { rng, now = Date.now(), tier = 'iron' } = {}) {
  const s = alg.state;
  const q = levelFor(rider, PLACE_ID, { now });
  let L = q.level, into = q.into, count = q.count, kind = 'level';
  // a new sitting: one warm-up box from the nearest level below that is on (once the level is found)
  if (s.warm > 0 && !q.placing) {
    const on = onIds(rider, PLACE_ID).map(indexOf).filter((j) => j >= 0 && j < q.i);
    if (on.length) { L = ladder()[on[on.length - 1]]; into = Math.max(0, (L.count || 5) - 1); count = L.count || 5; kind = 'warm'; }
    s.warm = 0;
  }
  const fact = L.gen && L.gen.facts ? pickFact(rider, { tables: factTables(into, count), upTo: 10, from: 2, rand: rng.next }) : null;
  const problem = levelBox(L.gen, { rng, into, count, recent: s.recent || [], fact });
  if (Array.isArray(s.recent)) { s.recent.push(problem.key); if (s.recent.length > 20) s.recent.splice(0, s.recent.length - 20); }
  problem.tier = tier;
  const plan = { place: PLACE_ID, id: L.id, title: L.title, i: indexOf(L.id), strand: L.strand, at: L.grade, placing: q.placing,
    kind, review: kind !== 'level', algebra: isAlgebra(L.id), map: 'lockbox', rung: problem.rung, level: problem.level,
    frac: 0, placed: !q.placing };
  return { plan, problem };
}

export function recordPlan(rider, plan, problem, { right, ms, size = 1, hidden = false, idle = false, now } = {}) {
  if (!plan || !plan.place) return recordBox(rider, plan, problem, { right, ms, size, hidden, idle, now });
  const t = now ?? Date.now();
  const lv = recordLevel(rider, plan.place, { right: !!right, level: plan.id, ms, size: Math.max(1, size), sitDown: true, hidden, idle, now: t });
  const strands = [{ strand: plan.strand, at: plan.at }];
  const extra = missingCredit(problem);
  if (extra) strands.push({ ...extra, weight: 0.5 });
  try { recordSkill(rider, strands, { right: !!right, sitDown: true, ms, size: Math.max(1, size), hidden, idle, now: t }); } catch (e) { console.error(e); }
  if (problem && problem.fact) { try { recordFact(rider, problem.fact.a, problem.fact.b, !!right, { now: t }); } catch (e) { console.error(e); } }
  return lv;
}
