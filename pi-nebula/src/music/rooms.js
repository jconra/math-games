// THE MUSIC IN THE GAME, ITS PLAIN PART: how each place of the station sounds, and which song plays where. No sound
// here (the tests read it). The game's maker, 2026-11-24: "Yeah same sound everywhere. It might be cool if it was
// louder in some areas, or even had more reverb in the hangers so it feels more simulated correctly", "the ships should
// have access to the music too", and of Mathball: "some Skrillix sounding stuff for Mathball (with a control screen in
// there)".
//
//   SOUNDS                 each kind of place: { level (0..1.5), reverb (0..1: how much of the room's echo), size (0
//                          small .. 1 a hangar) }: the player's M.room() takes it as it is
//   STATION_ROOMS          every room of the station's file (kit/rooms/station.json) -> its kind; null for the pieces
//                          that are no place to stand in (a door, a hatch, a parked ship's outside: the room before is
//                          kept as they are walked through)
//   QUIET                  how far the music drops back under talking and while a math card is up (the two numbers)
//   SONGS                  the songs to begin with: the station's (one for the whole station) and the arena's
//   hearing({ zone, ship, ground, last }) -> { heard, kind, song }    where the music is heard as the crew member stands:
//       zone    the station room they are in (its id), or null; ship: aboard a ship (boarding's 'miner/cockpit'), or
//       null; ground: on foot off any ship and off the station (a planet, the old station), true; last: the kind
//       before (kept through a door). In the arena the arena's song; aboard any ship, parked or out on a run, a small
//       cabin; off any ship and off the station not heard.
//   quiet({ talking, card }) -> the music's level under them (1: none)
import { PRESETS } from './song.js';

export const SOUNDS = {
  quarters: { level: 0.7, reverb: 0.08, size: 0 },        // soft and nearly dry
  corridor: { level: 0.9, reverb: 0.22, size: 0.25 },     // plain
  room: { level: 0.9, reverb: 0.18, size: 0.15 },         // a plain small room (the control rooms, the lobby)
  terminal: { level: 1, reverb: 0.3, size: 0.35 },        // as the Music Lab's Terminal
  medical: { level: 0.8, reverb: 0.22, size: 0.2 },       // soft, as the Music Lab's Medical
  big: { level: 1, reverb: 0.45, size: 0.65 },            // Cargo and the smelter: big (the Music Lab's Cargo)
  hangar: { level: 1.15, reverb: 0.7, size: 1 },          // the biggest, the long echo (the Music Lab's Hangar)
  arena: { level: 1.1, reverb: 0.5, size: 0.75 },         // a big hall, its own song
  cabin: { level: 0.85, reverb: 0.1, size: 0.05 },        // aboard a ship, a small cabin; the lift too
};

export const STATION_ROOMS = {
  quarters: 'quarters',
  qc: 'corridor', c1: 'corridor', c2: 'corridor', loop: 'corridor', junction: 'corridor', 'spine-n': 'corridor', 'spine-s': 'corridor',
  'stub-miner': 'corridor', 'stub-explorer': 'corridor', 'stub-medic': 'corridor',
  terminal: 'terminal', airlock: 'cabin', lift: 'cabin',
  arena: 'arena',
  'hangar-miner': 'hangar', hangar: 'hangar', 'hangar-medic': 'hangar',
  'smelter-hall': 'big', 'smelter-store': 'big', store: 'big',
  'smelter-lobby': 'room', 'smelter-control': 'room', tower: 'room',
  medical: 'medical', 'med-ward': 'medical', 'med-scanner': 'medical', 'med-pharmacy': 'medical', 'med-lab': 'medical', 'med-booth': 'medical', 'med-equip': 'medical',
  // (no place to stand in: the room before is kept)
  'door-q': null, 'hatch-1': null, 'hatch-loop-w': null, 'hatch-loop-e': null, 'door-arena': null, 'hatch-jw': null, 'hatch-je': null,
  'hatch-jn': null, 'hatch-js': null, 'hatch-miner': null, 'hatch-medic': null, 'hatch-smelter': null, 'hatch-medical': null,
  'door-store': null, 'hatch-smelter-hall': null, 'door-control': null, 'door-med-ward': null, 'door-med-scanner': null,
  'door-pharmacy': null, 'door-lab': null, 'door-equip': null, 'door-booth': null, 'skin-n': null, 'skin-s': null,
  'ship-miner': null, 'ship-explorer': null, 'ship-medic': null, 'door-lift': null,
};

// THE MUSIC UNDER TALKING AND MATH (the game's maker was asked and has not said; the coordinator's call): while a voice
// clip or a station announcement plays, and while a math card is up, the music drops back a little (eased over about
// a second) and comes up again after. These two numbers are all of it: the music's level then (1 = no change).
export const QUIET = { talking: 0.55, card: 0.7 };

export const SONGS = {
  station: PRESETS.find((p) => p.id === 'nightshift').song,     // to begin with: the chill Night Shift
  arena: PRESETS.find((p) => p.id === 'mathballdrop').song,     // the heavy Mathball Drop
};

export function hearing({ zone = null, ship = null, ground = false, last = null } = {}) {
  if (ground) return { heard: false, kind: last, song: 'station' };
  if (ship) return { heard: true, kind: 'cabin', song: 'station' };
  const kind = zone && STATION_ROOMS[zone] !== undefined ? STATION_ROOMS[zone] : undefined;
  if (zone === 'arena') return { heard: true, kind: 'arena', song: 'arena' };
  if (kind) return { heard: true, kind, song: 'station' };
  // (a door, or between rooms: as before; nowhere known yet: the corridor's)
  const k = last || 'corridor';
  return { heard: true, kind: k, song: k === 'arena' ? 'arena' : 'station' };
}

export const quiet = ({ talking = false, card = false } = {}) => Math.min(talking ? QUIET.talking : 1, card ? QUIET.card : 1);
