// The space game's saved crew, kept in this browser. It is the shared store (shared/players.js) on this game's OWN
// key, so its saves never mix with Mathwood Valley's.
//
//   A crew member is { id, name, look: { id }, made, last, age }  (the same shape as a Mathwood rider's first fields,
//   so a family's players could be shared between the games one day; see ~/pw/space-math/GAME.md for what that takes).
//
// The key does not follow the game's name: the name can change, the saves must not be lost.
import { makeStore } from '../../shared/players.js';
import { GAME_NAME } from './name.js';
import { LOOKS, lookById } from './looks.js';

export const KEY = 'calc-station.crew';

// this game's tidy-up of one saved crew member: a look this build knows
function fix(p) {
  const id = p.look && typeof p.look.id === 'string' ? p.look.id : null;
  if (!id || !LOOKS.some((l) => l.id === id)) p.look = { ...p.look, id: lookById(id).id };
  return p;
}

const store = makeStore({ key: KEY, version: 1, fix, max: 6, game: GAME_NAME, anyName: 'Crew' });

export const max = store.max;
export const load = () => store.load();
export const save = (p) => store.save(p);
export const make = (name, look) => store.make(name, look);
export const remove = (id) => store.remove(id);
export const works = () => store.works();
export const useKey = (k) => store.useKey(k);
