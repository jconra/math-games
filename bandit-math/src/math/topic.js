// The shape every herd math topic gives the game, so a mission can run any ticked topic the same way.
//
//   const T = makeTopic('times', rider.topics.times)   // the state object is filled in and changed in place
//   T.topic, T.name                 'times', 'Times tables'
//   T.wave({ count = 10 })          -> { kind, rule, targets: [{ n, good, trap }], step, hard, fresh, warmup, ... }
//                                      rule: the card's words ('Rope the 6-herd', '7 × ? = 56').
//                                      n: the number painted on the target. good: it is a right one.
//                                      Spawn one target per entry: a rule card holds `count` of them (the
//                                      2s up to x5 run out of sensible strays past about 13), a missing-
//                                      number card ('7 × ? = 56') holds up to 6 with exactly one right.
//                                      Numbers are never repeated within a wave.
//                                      hard: the ladder step the material comes from (use it to scale pay).
//                                      fresh: a new table or bigger numbers; slow the herd to a walk.
//   T.answer(n, good)               -> { right, step, moved, placed, comeback }   after every throw, before
//                                      the next wave() (the wave is over once every right one is roped)
//   T.explain(n)                    -> { line, skip }   one plain line and a counting line after a wrong pick
//   T.hint()                        -> a one-line rule of thumb for the current card
//   T.level()                       -> { step, of, label, detail, line }   for the parents' progress line
//   T.due()                         -> [{ n, good: false, trap, back: true }] after each answer: wrong
//                                      numbers due back now. Make the tangled target with that number
//                                      ropeable again, or bring in a new one if it has gone. Optional:
//                                      without it they ride in with the next wave of their table.
//
// Counting, Adding, Taking away and Dividing plug in here as they are built, using the same shape.
// Card topics (T.mode === 'cards': counting, adding and taking away in src/math/early.js's card trainer, and dividing)
// deal one card at a time, as positive & negative does: wave() -> { kind: 'card', rule, card, cards, targets, ... } with
// exactly one right target per card; answer(n, good, cardId) -> { right, card (the card to show now), waveDone, stale };
// explain(card, n) -> { line, numberLine } and help(card), the picture (its `helper` says which drawing: 'count' is
// src/ui/counthelp.js); T.payEvery: the steps per extra gold a steer.
// Solving for x lives in the lock boxes (src/lockbox/) and has its own shape there.

import { makeTimes } from './times.js';
import { makeDividing } from './dividing.js';
import { makeCounting } from './counting.js';
import { makeAdding } from './adding.js';
import { makeTaking } from './taking.js';

const MAKERS = { times: makeTimes, counting: makeCounting, adding: makeAdding, taking: makeTaking, dividing: makeDividing };

// The topics that can run a herd in this build (ids match TOPICS in save.js).
export const HERD_TOPICS = Object.keys(MAKERS);

export function hasTopic(id) { return Object.prototype.hasOwnProperty.call(MAKERS, id); }

// -> the topic's trainer, or null if that topic isn't built yet.
export function makeTopic(id, state, opts) {
  return hasTopic(id) ? MAKERS[id](state, opts) : null;
}
