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
//   HALLWAYS              the hallways with lines (one wall of each)
//   alongOf(points) -> { axis, lo, hi, u(x, z) }   a hallway's line: along x or z, whichever its stretches run; low
//                         notes at its north end (the smaller z) on a hallway running north and south, at its west end
//                         (the smaller x) on one running east and west: the same end in every hallway that way
import { VISUALS, visualOf } from './visuals.js';

export const SCREEN_ROOMS = {
  store: 'Cargo', terminal: 'the terminal', medical: 'medical', tower: 'the control room', quarters: 'your quarters',
  'hangar-miner': 'the Miner\'s hangar', hangar: 'the Explorer\'s hangar', 'hangar-medic': 'the Medic\'s hangar', arena: 'the arena',
};
export const songOf = (room) => (room === 'arena' ? 'arena' : 'station');

export const KEEP = { picture: 'pi-nebula.music.picture', hallway: 'pi-nebula.music.hallway' };
export function keptPicture(store) {
  try { const v = store && store.getItem(KEEP.picture); if (v && VISUALS.some((x) => x.id === v)) return v; } catch (e) { /* blocked */ }
  return VISUALS[0].id;
}
export function keepPicture(store, id) { try { if (store) store.setItem(KEEP.picture, visualOf(id).id); } catch (e) { /* not kept */ } }
export function hallwayOn(store) { try { return !store || store.getItem(KEEP.hallway) !== '0'; } catch (e) { return true; } }
export function keepHallway(store, on) { try { if (store) store.setItem(KEEP.hallway, on ? '1' : '0'); } catch (e) { /* not kept */ } }

export const HALLWAYS = ['c1', 'loop', 'spine-n', 'spine-s'];

export function alongOf(points) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of points) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const axis = x1 - x0 > z1 - z0 ? 'x' : 'z', lo = axis === 'x' ? x0 : z0, hi = axis === 'x' ? x1 : z1, span = Math.max(1e-6, hi - lo);
  return { axis, lo, hi, u: (x, z) => Math.max(0, Math.min(1, ((axis === 'x' ? x : z) - lo) / span)) };
}
