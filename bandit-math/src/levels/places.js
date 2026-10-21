// places.js: THE PLACES, each with its one kind of math and its one ladder of levels (the agreed design,
// 2026-10-21: "one kind of math per place, each running from kindergarten to hard"). The levels page lists these tabs
// in this order; src/levels/model.js keeps each rider's level in each place.
//
// Each ladder lives in its own file, src/levels/place/<id>.js, owned by the lane that builds that place's questions
// (PROGRESSION.md, "CONTRACT (levels foundation)"). A file exports PLACE:
//   {
//     id, name ('The round-up'), short ('Round-up'), math ('Series': its kind of math in a word or two),
//     line  (one plain line about the place, for the levels page), pic (a picture key the levels page draws),
//     job   (the MISSIONS id that turns the job on and off in save.js, a list of them, or null: always on),
//     fastFrom (the level id from which a fast right sit-down answer counts double, or null: never),
//     levels: [ Level, ... ]   easiest first, every step a small one from the last
//     example(level, rand) -> { q, a }   ONE example made by the place's own question maker at that level: q is the
//                                         question as the game shows it, a the right answer (plain text)
//   }
//   Level = {
//     id      short and stable (a rider's save keeps it; never reuse an id for different math)
//     title   what's asked, a few plain words ('Count by 5s')
//     line    one plain line more ('5, 10, ?, 20: the blank can be anywhere')
//     grade   where it sits on the school guide of `strand` (src/math/strands.js: 0 starting kindergarten, 10 first
//             grade ... 80 eighth grade, 90-100 algebra 1). Answers are also recorded there in the strand (the stats'
//             kinds of math), and old saves and a place first met are seeded from it, so put it honestly.
//     strand  a strand id from src/math/strands.js
//     count   right answers a rider who gets them all right gives on this level (default 5)
//     gen     the question maker's settings for this level (whatever the place's maker reads; plain data)
//     also    optional [{ strand, grade, weight }]: other strands the answer counts in (weight 0.5 usually)
//     read    optional true: questions here are read out loud to a rider who is read to
//   }
// A bad place (no levels, a repeated id, a grade off the scale, a strand that doesn't exist) is left out with a console
// error and listed in PROBLEMS, which tests/levels.ladders.test.mjs checks is empty: a slip shows in the tests and never
// stops the game loading.
//
//   PLACES, PLACE (by id), PLACE_IDS, PROBLEMS, examplesOf(placeId, levelId, { n, seed }) -> [{ q, a }]

import { STRAND } from '../math/strands.js';
import { seeded } from './kit.js';
import { PLACE as roundup } from './place/roundup.js';
import { PLACE as wagon } from './place/wagon.js';
import { PLACE as lockbox } from './place/lockbox.js';
import { PLACE as deer } from './place/deer.js';
import { PLACE as fishing } from './place/fishing.js';
import { PLACE as sheep } from './place/sheep.js';
import { PLACE as pigs } from './place/pigs.js';
import { PLACE as range } from './place/range.js';
import { PLACE as loot } from './place/loot.js';
import { PLACE as store } from './place/store.js';
import { PLACE as deliveries } from './place/deliveries.js';
import { PLACE as building } from './place/building.js';

export const PROBLEMS = [];
const bad = (why) => { PROBLEMS.push(why); try { console.error('Bandit Math levels: ' + why); } catch (e) { /* */ } };

function check(P) {
  if (!P || typeof P.id !== 'string' || !P.id) return 'a place with no id';
  if (!P.name || !Array.isArray(P.levels) || !P.levels.length) return `${P.id}: needs a name and levels`;
  if (typeof P.example !== 'function') return `${P.id}: needs example(level, rand)`;
  const ids = new Set();
  for (const L of P.levels) {
    if (!L || typeof L.id !== 'string' || !L.id) return `${P.id}: a level with no id`;
    if (ids.has(L.id)) return `${P.id}: level id ${L.id} is used twice`;
    ids.add(L.id);
    if (!L.title || !L.line) return `${P.id}/${L.id}: needs a title and a line`;
    if (!(typeof L.grade === 'number' && L.grade >= 0 && L.grade <= 100)) return `${P.id}/${L.id}: grade must be 0..100`;
    if (!STRAND[L.strand]) return `${P.id}/${L.id}: no strand ${L.strand}`;
    if (L.count != null && !(Number.isInteger(L.count) && L.count >= 1)) return `${P.id}/${L.id}: count must be a whole number, 1 or more`;
    for (const a of L.also || []) if (!a || !STRAND[a.strand] || !(a.grade >= 0 && a.grade <= 100)) return `${P.id}/${L.id}: a bad also entry`;
  }
  if (P.fastFrom != null && !ids.has(P.fastFrom)) return `${P.id}: fastFrom ${P.fastFrom} is not one of its levels`;
  return null;
}

export const PLACES = [];
for (const P of [roundup, wagon, lockbox, deer, fishing, sheep, pigs, range, loot, store, deliveries, building]) {
  const why = check(P);
  if (why) { bad(`place left out: ${why}`); continue; }
  if (PLACES.some((x) => x.id === P.id)) { bad(`place ${P.id} is listed twice`); continue; }
  P.short = P.short || P.name;
  P.fastFrom = P.fastFrom || null;
  P.job = P.job === undefined ? null : P.job;
  PLACES.push(P);
}
export const PLACE = Object.fromEntries(PLACES.map((P) => [P.id, P]));
export const PLACE_IDS = PLACES.map((P) => P.id);

// Examples for the levels page, made by the place's own maker: n of them, different where the maker allows (the same
// seed gives the same examples, so the page doesn't change under a reader's eyes).
export function examplesOf(placeId, levelId, { n = 3, seed = 1 } = {}) {
  const P = PLACE[placeId];
  const L = P && P.levels.find((x) => x.id === levelId);
  if (!L) return [];
  const rand = seeded(seed * 7919 + levelId.length * 31 + levelId.charCodeAt(0));
  const out = [], seen = new Set();
  for (let tries = 0; out.length < n && tries < n * 12; tries++) {
    let ex = null;
    try { ex = P.example(L, rand); } catch (e) { bad(`${placeId}/${levelId}: example failed: ${e && e.message}`); return out; }
    if (!ex || ex.q == null) continue;
    const k = `${ex.q}`;
    if (seen.has(k) && tries < n * 8) continue;
    seen.add(k); out.push({ q: String(ex.q), a: String(ex.a) });
  }
  return out;
}
