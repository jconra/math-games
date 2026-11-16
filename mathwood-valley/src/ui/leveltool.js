// THE LEVEL TOOL's sums (pure, node-testable; the strip along the bottom that shows it is src/ui/tools.js): the place
// the rider is at, the level they are on there ("27: Odd steps going down"), how close the game's own climb is to
// moving them, and the arrows that step the level down or up by hand. A step by hand is the levels page's old "Start
// here": the rider goes straight onto that level, placed, switched on if a grown-up had it skipped (src/levels/model.js
// startHere). The next question the job asks comes from it (each job asks levelFor for every question).
//
// THE RANGE (the levels page's slider, model.js setRange): the arrows stop at its ends, so stepping by hand never leaves
// the levels chosen there. KEEP TO THESE LEVELS (model.js setKeep): the game doesn't move the level by itself, so the
// bar toward the next level is put away and the note says so; the arrows still step it, inside the range.
//
// A rider setting picked when the rider is made, "Let the rider pick levels" (rider.pickLevels, on unless false), hides
// the arrows: the title and the bar still show, and only the game moves the level.
//
//   canPick(rider)                 -> true unless the rider's pickLevels is false
//   levelTool(rider, placeId)      -> null (no such place) | { place, name, i (0-based), n, id, title, into, count,
//                                     fill (0..1: right answers toward the next level), placing (finding your level), met,
//                                     kept (keep to these levels), lo, hi (the range's ends, 0-based), pick (the arrows
//                                     show), canDown, canUp, words (the title line: "27: Odd steps going down"), note (the
//                                     bar in words) }
//   stepLevel(rider, placeId, dir) -> the new levelTool view, or null (no arrows for this rider, or no level that way
//                                     inside the range). Changes the rider: save after.

import { PLACE } from '../levels/places.js';
import { stateOf, levelHere, rangeOf, startHere, LEVELS } from '../levels/model.js';

export const canPick = (rider) => !(rider && rider.pickLevels === false);

export function levelTool(rider, placeId) {
  const P = PLACE[placeId];
  if (!P || !P.levels.length) return null;
  const s = stateOf(rider, placeId);
  const id = levelHere(rider || {}, placeId);
  const i = Math.max(0, P.levels.findIndex((L) => L.id === id)), L = P.levels[i], n = P.levels.length;
  const count = Math.max(1, Number(L.count) || LEVELS.COUNT);
  const into = s && s.id === L.id ? Math.max(0, Math.min(count, Number(s.into) || 0)) : 0;
  const R = rangeOf(rider || {}, placeId), kept = R.keep;
  const placing = (!s || !s.placed) && !kept, pick = canPick(rider);
  const span = R.lo === R.hi ? `level ${R.lo + 1}` : `levels ${R.lo + 1} to ${R.hi + 1}`;
  const note = kept ? `Kept to ${span}: the game doesn't move you up or down${pick && R.lo < R.hi ? '; the arrows do' : ''}`
    : !s ? 'Not played here yet: the game finds your level'
    : placing ? 'Finding your level: each right answer climbs a level'
    : i === R.hi && into >= count ? (R.full ? 'The top level here' : `The top of the levels chosen (${span})`)
    : `${into} of ${count} right answers toward level ${Math.min(n, i + 2)}. A miss takes some back; missed with the bar empty, back a level`;
  return { place: placeId, name: P.short || P.name, i, n, id: L.id, title: L.title, into, count, fill: placing || kept ? 0 : into / count,
    placing, met: !!s, kept, lo: R.lo, hi: R.hi, pick, canDown: pick && i > R.lo, canUp: pick && i < R.hi, words: `${i + 1}: ${L.title}`, note };
}

export function stepLevel(rider, placeId, dir) {
  const v = levelTool(rider, placeId);
  if (!v || !v.pick) return null;
  const j = v.i + (dir < 0 ? -1 : 1);
  if (j < v.lo || j > v.hi) return null;
  if (!startHere(rider, placeId, PLACE[placeId].levels[j].id)) return null;
  return levelTool(rider, placeId);
}
