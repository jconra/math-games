// WHAT A LINE PICKED ON A JOBS BOARD LEADS TO (plain facts and one small function, nothing drawn, so the tests can
// read it too; src/jobsboard.js shows the boards and src/guide.js lays the line). The game's maker (2026-11-18), of the
// boards' two lists, the station's jobs and the captains hiring: "I was thinking they should all be able to be picked.
// Although the missions should lead you to the captain." So a captain's line is picked as a station job's is, and the
// line it lays leads to that captain, wherever they are walking at the time; arriving, the captain makes their own
// offer, as they do to anyone who walks up to them (src/people.js).
//
//   CAPTAIN_ROWS       the captains' board, top to bottom (kit/tex.js HIRING draws it in this order): each row's crew
//                      (the board's own word for it), its captain (the roster's id, src/life.js), their name, and the
//                      colour word their line is called by; pick: false for a captain with no mission to pick (their
//                      ship down for repairs, src/lines.js `down`: Captain Adair's line is to read, as before)
//   targetOf(id, { spotOf, captainAt, rows, captains })   what the guide is given for a line picked:
//                      a station job: { kind: 'job', pos (its spot: it stays put), near, colour };
//                      a captain:     { kind: 'captain', pos (where they are now), near, colour, follow }, follow()
//                                     giving where they are at any later moment (they walk about: the line follows);
//                      null for a line that cannot be picked (no such job, a captain not hiring or not aboard)
//                      spotOf(id): a job's spot ({ pos, job }); captainAt(id): a captain's { pos } or null
import { CAPTAINS } from './lines.js';

// how near the captain the line is done with (m): inside the distance at which a captain speaks up (people.js
// FRIENDLY.offer, 3.6 m), so their offer is beginning as the line fades
export const CAPTAIN_NEAR = 3.0;
export const CAPTAIN_ROWS = [
  { crew: 'medic', id: 'hale', name: 'Captain Hale', hue: 'red' },
  { crew: 'mining', id: 'ruiz', name: 'Captain Ruiz', hue: 'orange' },
  { crew: 'explore', id: 'vega', name: 'Captain Vega', hue: 'green' },
  { crew: 'security', id: 'adair', name: 'Captain Adair', hue: 'blue' },
].map((r) => ({ ...r, pick: !!CAPTAINS[r.id] && !CAPTAINS[r.id].down }));

export function targetOf(id, { spotOf = () => null, captainAt = () => null, rows = [], captains = CAPTAIN_ROWS } = {}) {
  const c = captains.find((r) => r.id === id);
  if (c) {
    if (!c.pick) return null;
    const at = captainAt(id); if (!at || !at.pos) return null;
    return { kind: 'captain', id, pos: at.pos, near: CAPTAIN_NEAR, colour: c.colour || null, follow: () => { const a = captainAt(id); return a && a.pos ? a.pos : null; } };
  }
  const s = spotOf(id); if (!s) return null;
  return { kind: 'job', id, pos: s.pos, near: ((s.job && s.job.near) ?? 1.7) - 0.1, colour: (rows.find((r) => r.id === id) || {}).colour || null };
}
