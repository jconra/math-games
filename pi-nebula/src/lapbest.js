// THE FORKLIFT LAP'S BEST TIMES, AS PLAIN RULES (no three.js, nothing of the page: the tests read this; the game keeps
// and shows them: src/cargolap.js). The game's maker, 2026-11-23:
//   LAP1-1, B  "Each crew member's own best official lap is kept and shown on the clock and on the card ('Your best:
//              56.8 s')."
//   LAP1-2, B  "Something to show for it in Cargo: a small board by the forklift's bay with the best lap on it and whose
//              it is."
// A crew member's best is kept with them, in Cargo's own tally in their save (crew.jobs.cargo.lap: { best (s, to a
// tenth), laps (official laps driven), at (when the best was set) }), as the arena's best is (src/mathball/best.js).
// ONLY OFFICIAL LAPS COUNT (every waypoint hit: kit/forkliftlap.js). It pays nothing.
// THE BOARD shows the best official lap of the crew members on this device and whose it is; until one of them beats
// Cargo's loader (LAP.time: under it, not the same), the loader's.
//
//   bestOf(crew)             -> their best official lap (s), or null
//   keepLap(crew, result)    a lap just driven (kit/forkliftlap.js resultOf): kept if it is official and their best so far
//                            -> { best (their best now, or null), isNew (this lap is it), was (their best before) }
//   boardOf(crews, loader)   crews: every crew member saved on this device; loader: { name, time }
//                            -> { name, time, crew (true: one of the crew members; false: the loader's still stands) }
//   seconds(t)               a time as it is written: to a tenth of a second ('56.8'; a whole number as '65.0' on the
//                            board, '65' in a sentence: plain())
const tenth = (t) => Math.round(t * 10) / 10;
const ok = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function bestOf(crew) {
  const l = crew && crew.jobs && crew.jobs.cargo && crew.jobs.cargo.lap;
  return l && ok(l.best) ? tenth(l.best) : null;
}
export function keepLap(crew, result, now = Date.now()) {
  const was = bestOf(crew);
  if (!crew || !result || !result.official || !ok(result.time)) return { best: was, isNew: false, was };
  if (!crew.jobs || typeof crew.jobs !== 'object') crew.jobs = {};
  const tally = (crew.jobs.cargo = crew.jobs.cargo && typeof crew.jobs.cargo === 'object' ? crew.jobs.cargo : {});
  const l = (tally.lap = tally.lap && typeof tally.lap === 'object' ? tally.lap : {});
  l.laps = (Number.isInteger(l.laps) ? l.laps : 0) + 1;
  const time = tenth(result.time), isNew = was == null || time < was;
  if (isNew) { l.best = time; l.at = now; }
  return { best: isNew ? time : was, isNew, was };
}
export function boardOf(crews, loader) {
  let top = null;
  for (const c of crews || []) {
    const b = bestOf(c); if (b == null) continue;
    const at = (c.jobs.cargo.lap.at) || 0;
    // (the same time to the tenth: whoever drove it first keeps the board)
    if (!top || b < top.time || (b === top.time && at < top.at)) top = { name: String(c.name || 'Crew'), time: b, at };
  }
  return top && top.time < loader.time ? { name: top.name, time: top.time, crew: true } : { name: loader.name, time: tenth(loader.time), crew: false };
}
export const seconds = (t) => tenth(t).toFixed(1);
export const plain = (t) => (Math.abs(t - Math.round(t)) < 0.05 ? String(Math.round(t)) : tenth(t).toFixed(1));
