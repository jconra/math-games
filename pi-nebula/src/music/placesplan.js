// THE MUSIC IN THE STATION'S PLACES, ITS PLAIN PART (MUSIC 3): which song each screen changes, what this browser keeps,
// and how a hallway's lines run from their low end to their high end. No three.js here (the tests read it); the screens
// and lines themselves are src/music/places.js.
// The game's maker, 2026-11-24: "Since the screens would all be copies, Id say put one in each place (storage, terminal,
// medical, control, quarters, hangers)", "some Skrillix sounding stuff for Mathball (with a control screen in there)",
// "the ships should have access to the music too"; 2026-11-26, of the hallway lines: "One long line for each
// instrument, from one end of the hallway to the other. Low notes light up near one end and high notes near the other."
//
//   SCREEN_ROOMS          the station's rooms with a music screen (kit/rooms/station.json: a 'screen' piece, variant
//                         'music'), each with the place's plain name
//   songOf(room)          which song a screen there changes: the arena's own in the arena, else the station's (aboard
//                         a ship too: the same song everywhere)
//   KEEP                  what this browser keeps: the picture picked (one for every screen) and the hallway lights'
//                         switch (on to begin with); the songs are kept by src/music/game.js
//   keptPicture(store), keepPicture(store, id), hallwayOn(store), keepHallway(store, on)
//   HALLWAYS              the hallways with lines: every one with slanted panels along its sides (MUSIC 4: a set of
//                         the five lines on each side of each section; the junction has none, its walls are hatches)
//   alongOf(points, way?) -> { axis, lo, hi, u(x, z) }   a hallway's way along: x or z (`way`, or whichever the points
//                         spread along most); low
//                         notes at its north end (the smaller z) on a hallway running north and south, at its west end
//                         (the smaller x) on one running east and west: the same end in every hallway that way
//   SPREAD                the two readings of "it repeated for each section" (the game's maker's to choose): 0, each
//                         section shows the whole thing (in every set the low notes at its north or west end, the high
//                         at its other); 1, the notes spread over the whole hallway as first asked ("from one end of
//                         the hallway to the other"), each set showing its own stretch of it
//   setPlaces(sets, spread) -> [[u0, u1], ...]   for a hallway's sets, each [[x, z], [x, z]] (its two ends), where on
//                         the notes' range (0 low .. 1 high) each set's two ends are, in the same order
import { VISUALS, visualOf } from './visuals.js';

export const SCREEN_ROOMS = {
  store: 'Cargo', terminal: 'the terminal', medical: 'medical', tower: 'the control room', quarters: 'your quarters',
  'hangar-miner': 'the Miner\'s hangar', hangar: 'the Explorer\'s hangar', 'hangar-medic': 'the Medic\'s hangar', arena: 'the arena',
};
export const songOf = (room) => (room === 'arena' ? 'arena' : 'station');

export const KEEP = { picture: 'pi-nebula.music.picture', hallway: 'pi-nebula.music.hallway' };
export function keptPicture(store) {
  try { const v = store && store.getItem(KEEP.picture); if (v) return visualOf(v).id; } catch (e) { /* blocked */ }
  return VISUALS[0].id;
}
export function keepPicture(store, id) { try { if (store) store.setItem(KEEP.picture, visualOf(id).id); } catch (e) { /* not kept */ } }
export function hallwayOn(store) { try { return !store || store.getItem(KEEP.hallway) !== '0'; } catch (e) { return true; } }
export function keepHallway(store, on) { try { if (store) store.setItem(KEEP.hallway, on ? '1' : '0'); } catch (e) { /* not kept */ } }

export const HALLWAYS = ['qc', 'c1', 'loop', 'c2', 'spine-n', 'spine-s', 'stub-miner', 'stub-explorer', 'stub-medic'];
export const SPREAD = 0;

export function alongOf(points, way = null) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of points) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const axis = way || (x1 - x0 > z1 - z0 ? 'x' : 'z'), lo = axis === 'x' ? x0 : z0, hi = axis === 'x' ? x1 : z1, span = Math.max(1e-6, hi - lo);
  return { axis, lo, hi, u: (x, z) => Math.max(0, Math.min(1, ((axis === 'x' ? x : z) - lo) / span)) };
}
export function setPlaces(sets, spread = SPREAD) {
  // (the way the sets run: a hallway one section long is wider than it is long, so not by its extents)
  const [[ax, az], [bx, bz]] = sets[0], A = alongOf(sets.flat(), Math.abs(bx - ax) > Math.abs(bz - az) ? 'x' : 'z');
  return sets.map(([e0, e1]) => {
    // (over the whole hallway: where each end is along it; in each section: its own low end at the hallway's low end)
    const a = A.u(e0[0], e0[1]), b = A.u(e1[0], e1[1]), s0 = a <= b ? 0 : 1, s1 = 1 - s0;
    return [s0 + (a - s0) * spread, s1 + (b - s1) * spread];
  });
}
