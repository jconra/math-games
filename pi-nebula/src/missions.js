// THE MISSIONS (a later plan: crewing a captain's ship on a trip out, medical, mining or exploring). For now, the one
// place the captains' offers end up (people.js asks; the player answers in the captain's question at the bottom of the
// screen), so the missions can be built here later without touching the people:
//   import { missions } from './missions.js'
//   missions.answer(captain, yes)    the player's answer to a captain's offer (captain: { id, name, ship, mission })
//   missions.state(id)               'new' (not asked yet) | 'asked' | 'interested' | 'declined'
//   missions.on(fn)                  fn(captain, yes) after each answer (where a mission will start: nothing yet)
//   missions.ready(id)               whether that captain's mission can start (none can yet: the captain says so)
// Kept for this visit only (nothing is saved yet).
function makeMissions() {
  const states = new Map(), fns = [];
  return {
    state: (id) => states.get(id) || 'new',
    asked(id) { if (!states.has(id)) states.set(id, 'asked'); },
    answer(captain, yes) { states.set(captain.id, yes ? 'interested' : 'declined'); for (const f of fns) { try { f(captain, yes); } catch (e) { console.error(e); } } },
    on(fn) { fns.push(fn); },
    ready: () => false,
  };
}
export const missions = makeMissions();
