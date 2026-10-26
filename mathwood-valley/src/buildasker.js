// buildasker.js: the questions of a builder (the miller at the windmill, the engineer at the bridge) through the
// levels (src/levels/model.js): the windmill and the bridge are one place, 'building', with one ladder of geometry
// levels (src/levels/place/building.js: g1 kinds of angles ... g7 a mix, g8 a bridge panel's diagonal). A rider who
// built the windmill starts the bridge where they were. The builder's own climbing stops: the place's level decides.
//
//   const asker = levelAsker(rider, { most, place, save, timer })    -> an asker for labs/windmill/builder.js and
//                                                                       labs/bridge/builder.js
//     most     the hardest level id this builder can ask ('g7' for the windmill: its builder has no level 8)
//   asker.level()            the step (1-based, the level's gen.level) to ask at now (asked afresh for every question)
//   asker.asked(q)           a card is up: its timer starts (a "Try it" after a lesson starts it again)
//   asker.answered(q, right) recorded at the level the card was made at (q.level) and saved; -> the step to ask next
//   asker.state()            for rigs: { level, id, pct, placing, capped, place }
//
// The builders' cards are sit-down questions, so they are timed (answertimer), but the building place has no
// `fastFrom`, so a fast answer never counts double here (the levels foundation's rule). Pure apart from the timer:
// node tests can drive it.

import { levelFor } from './levels/model.js';
import { PLACE } from './levels/places.js';
import { recordAnswer, saveRider } from './save.js';
import { answerTimer } from './ui/answertimer.js';

export function levelAsker(rider, { most = null, place = 'building', save = () => saveRider(rider), timer = answerTimer } = {}) {
  const P = PLACE[place];
  let t = null;
  // the level to ask now (meets the place the first time: saved then)
  const now = () => {
    const met = !!(rider && rider.levels && rider.levels.places && rider.levels.places[place]);
    const q = levelFor(rider, place, { most });
    if (!met) save();
    return q;
  };
  const stepOf = (L) => Math.max(1, Math.round((L && L.gen && L.gen.level) || 1));
  // a card's step back to its level id (a "Try it" or a card about the board just nailed carries its own step)
  const idOf = (step) => { const L = P && P.levels.find((x) => stepOf(x) === step); return L ? L.id : null; };
  return {
    level: () => stepOf(now().level),
    asked() { if (t) t.cancel(); t = timer(); },
    answered(q, right) {
      const ms = t ? t.stop() : {}; t = null;
      const id = (q && q.level && idOf(Math.round(q.level))) || now().id;
      recordAnswer(rider, !!right, { place, level: id, sitDown: true, size: 1, ...ms });
      save();
      return stepOf(now().level);
    },
    state: () => { const q = now(); return { level: stepOf(q.level), id: q.id, pct: q.pct, placing: q.placing, capped: q.capped, place }; },
  };
}
