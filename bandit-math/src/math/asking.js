// asking.js: how the field jobs (the round-up, the wagon's gang, the sick sheep, the loose pigs, the deer photographs,
// the bottle range, the gang's loot) ask the rider's skill model (src/math/skill.js) what to ask, and tell it how the
// answer went. The model keeps one level per kind of math (a strand); each job has a few question makers (maps) that
// fit it, and asks the one that fits the rider now, at the rider's own level:
//
//   chooseFor(rider, maps, { last, rand })   -> a map id: skill.js chooseMap (a maker with material near the rider's
//                                             level, leaning toward a strand still finding its level and away from the
//                                             one just asked); when none fits, the one nearest the rider's level
//   askFor(rider, map, { most })  -> q = skill.js stepFor(rider, map, { most }) (q.at: the point to ask at; q.step: the maker's step;
//                               q.id: a lock-box rung), plus q.placing (a strand of it still finding its level) and
//                               q.lead (the strand the step was chosen for). Positive & negative is on two strands
//                               (Addition and Subtraction), and each card counts in the strand of its own sign: while
//                               one of them is still finding its level, that one leads (the step is its own, and a step
//                               that deals no card of its sign gives way to the nearest one that does); with both
//                               placed, their average, as the map says
//   steer(T, q)              -> the trainer's step set to q's (T.steer: its own climb stops; see src/math/early.js)
//   atFor(q, step, strand)   -> the point a question really sits at: q.at when it was made at q's step for the strand
//                               that chose it (never below that step's own point: a level under a maker's first step
//                               gets the first step, which is harder than the level), else that step's own point (a
//                               warm-up, a review card, a comeback from another step, a positive & negative card of
//                               the other sign)
//   strandOf(map, card)      -> the strand an answer counts in: the map's, or for positive & negative the card's sign
//   travel(q, { step, card, strand })   -> recordAnswer's skill part for a travel job's answer (no time):
//                               { strands: [{ strand, at }] }
//   isFinding(rider, map)    -> true while a strand of that maker is still finding its level ("Finding your level")
//   newBest(rider, q)        -> true when q's step is past the highest the rider has reached on that maker ("Up a step!")
//   lightly(rider, strand, at, weight)   -> the weight an answer counts with in a strand: as given, or 0.25 when the
//                               question sits more than NEAR above where that strand's questions are asked now (skill.js
//                               probeOf: the level, or the point a baseline is trying). A share story far above a young
//                               rider says little; one at the point being tried counts in full, so a baseline moves; and
//                               after LIGHT_RUN rights in a row at that point the next one counts in full too
//   HERD_MAPS                the round-up's makers: counting, adding, taking away, times tables, dividing, positive &
//                            negative (each a trainer in src/math/; their map ids are their topic ids)
//
// Plain functions over the rider object; nothing here touches the page (tests/asking.test.mjs).

import { chooseMap, stepFor, stepAt, pctAt, isPlaced, pick, levelOf, probeOf, capOf, MAPS, SKILL } from './skill.js';
import { signsAt } from './negatives.js';

export const HERD_MAPS = ['counting', 'adding', 'taking', 'times', 'dividing', 'negatives'];

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const mapLevel = (rider, id) => { const m = MAPS[id]; const v = m.strands.map((s) => levelOf(rider, s)); return v.reduce((a, b) => a + b, 0) / v.length; };

export function chooseFor(rider, maps, { last = null, rand = Math.random, now = Date.now() } = {}) {
  const ok = maps.filter((k) => MAPS[k]);
  if (!ok.length) return null;
  const id = chooseMap(rider, ok, { last, rand, now });
  if (id) return id;
  // nothing fits: the maker whose material is nearest the rider's level
  let best = ok[0], bd = Infinity;
  for (const k of ok) {
    const a = MAPS[k].anchors, lv = mapLevel(rider, k);
    const d = lv < a[0] ? a[0] - lv : lv > a[a.length - 1] ? lv - a[a.length - 1] : 0;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

export function isFinding(rider, map) {
  const m = MAPS[map];
  return !!m && m.strands.some((s) => !isPlaced(rider, s));
}

// the positive & negative cards a strand has had lately (its recent answers at the map's points: to take turns leading,
// so Subtraction's many two-digit take-away cards don't keep Addition in the lead)
const answered = (rider, s) => { const st = isObj(rider && rider.skill) && isObj(rider.skill.strands) ? rider.skill.strands[s] : null; return isObj(st) && Array.isArray(st.h) ? st.h.filter((x) => x[1] >= MAPS.negatives.anchors[0] - 0.05).length : 0; };

export function askFor(rider, map, { now = Date.now(), most = null } = {}) {
  const q = stepFor(rider, map, { now, most });   // (most: a job holding its questions lower, see skill.js stepFor)   // (the first time a strand comes up, this starts its baseline: save after)
  q.placing = isFinding(rider, map);
  q.lead = q.strand;
  if (map !== 'negatives') return q;
  // a strand still finding its level leads only when the point it is trying is near a step that deals its own sign
  // (a Subtraction baseline down at two-digit sums isn't tried on "−4 − 5": the job came in because Addition is sure)
  const first = (s) => { const sign = s === 'add' ? '+' : '-'; for (let j = 1; j <= MAPS[map].anchors.length; j++) if (signsAt(j).includes(sign)) return pctAt(map, j); return Infinity; };
  const finding = ['add', 'sub'].filter((s) => !isPlaced(rider, s) && probeOf(rider, s) >= first(s) - SKILL.GATE);
  // both placed: their average, as the map says, unless the job came in for a strand still short of its sign's cards
  // (MAPS.negatives.opens: sure of two-digit sums, say): then each placed strand from `opens` up takes turns leading on
  // its own sign's easiest cards, so Subtraction meets "3 − 8" too and not only Addition "−3 + 7"
  const opens = MAPS[map].opens;
  const placed = ['add', 'sub'].filter((s) => isPlaced(rider, s) && Number.isFinite(opens) && levelOf(rider, s) >= opens);
  const short = placed.filter((s) => levelOf(rider, s) < first(s) - SKILL.GATE);
  // (only one of them that far: it leads, at its own level; the average with a strand still at two-digit sums would deal
  // that strand cards it can't do, and none of its own)
  const leaders = finding.length ? finding : short.length || placed.length === 1 ? placed : [];
  if (!leaders.length) { q.lead = null; return q; }   // none can lead: the average, and every card at q.at
  const lead = leaders.length === 1 ? leaders[0] : answered(rider, 'add') <= answered(rider, 'sub') ? 'add' : 'sub';
  const sign = lead === 'add' ? '+' : '-';
  const at = Math.min(pick(rider, lead, { now }), capOf(map));
  let st = stepAt(map, at), made = at;
  if (!signsAt(st.step).includes(sign)) {
    // no card of the lead's sign on that step: the nearest step above that has some (else below)
    const n = MAPS[map].anchors.length;
    let k = -1;
    for (let j = st.step + 1; j <= n && k < 0; j++) if (signsAt(j).includes(sign)) k = j;
    for (let j = st.step - 1; j >= 1 && k < 0; j--) if (signsAt(j).includes(sign)) k = j;
    if (k > 0) { made = pctAt(map, k); st = stepAt(map, made); }
  }
  return { ...q, at: made, ...st, lead };
}

// "Up a step!" only when a maker's step passes the highest the rider has reached on it once placed (kept with the
// rider's skill: rider.skill.best = { [map]: step }), not on each up and down of the 80% staircase around the same
// steps. The first placed step is the start (no toast). -> true when it is a new best
export function newBest(rider, q) {
  if (!q || q.placing || !MAPS[q.map] || !isObj(rider && rider.skill)) return false;
  const best = isObj(rider.skill.best) ? rider.skill.best : (rider.skill.best = {});
  const was = Number.isFinite(best[q.map]) ? best[q.map] : null;
  if (was == null || q.step > was) best[q.map] = q.step;
  return was != null && q.step > was;
}

export function lightly(rider, strand, at, weight = 1) {
  if (!(at - probeOf(rider, strand) > SKILL.NEAR)) return weight;
  // ...unless the last LIGHT_RUN answers in that strand at this point or above were all right: that is no lucky guess
  // (1 time in 243 for a kid guessing among 3), so the next one counts in full and the baseline can climb to it
  const st = isObj(rider && rider.skill) && isObj(rider.skill.strands) ? rider.skill.strands[strand] : null;
  const h = isObj(st) && Array.isArray(st.h) ? st.h.slice(-LIGHT_RUN) : [];
  if (h.length === LIGHT_RUN && h.every((x) => x[0] && x[1] >= at - 0.05)) return weight;
  return Math.min(weight, 0.25);
}
export const LIGHT_RUN = 5;

export function steer(T, q) {
  if (T && typeof T.steer === 'function' && q) T.steer(q.step, { placing: !!q.placing });
  return T;
}

export function strandOf(map, card) {
  if (map === 'negatives') {
    const op = card && card.parts ? card.parts.op : card && card.op;
    return op === '-' ? 'sub' : 'add';
  }
  return MAPS[map] ? MAPS[map].strand : null;
}

export function atFor(q, step, strand = null) {
  if (!q) return null;
  const k = step == null ? q.step : step, own = pctAt(q.map, k);
  if (k === q.step && (!q.lead || !strand || strand === q.lead)) return Math.max(q.at, own);
  return own;
}

export function travel(q, { step = null, card = null, strand = null } = {}) {
  if (!q || !MAPS[q.map]) return null;
  const s = strand || (card ? strandOf(q.map, card) : q.lead || q.strand);
  const k = step != null ? step : card && card.rung != null ? card.rung : q.step;
  const plain = q.map === 'negatives' ? plainAt(card) : null;
  return { strands: [{ strand: s, at: plain != null ? plain : atFor(q, k, s) }] };
}

// A positive & negative card that is plain taking away above zero (8 − 3, the contrast card on steps 3 and 4) counts
// where the taking-away ladder has that sum (src/math/taking.js: to 10, from 10, 11 to 20, past 10), not at the
// negatives' point: it says nothing about going past zero. -> the point, or null for any other card
export function plainAt(card) {
  const p = card && card.parts;
  if (!p || card.shape !== 'short') return null;
  const a = p.start, b = p.term;
  if (!(Number.isFinite(a) && Number.isFinite(b) && a >= b && b >= 0)) return null;
  return a <= 10 ? (b <= 2 ? 0 : a === 10 ? 9 : 5) : a % 10 >= b ? 15 : 19;
}
