// The space game's saved crew, kept in this browser. It is the shared store (shared/players.js) on this game's OWN
// key, so its saves never mix with Mathwood Valley's.
//
//   A crew member is { id, name, look: { id, size }, made, last, age }  (size: their height, left out for Medium;
//   and what the character maker changed, laid over the look: suit, head, hair, colours: maker.js;
//   the same shape as a Mathwood rider's first fields,
//   so a family's players could be shared between the games one day; see ~/pw/space-math/GAME.md for what that takes).
//
// The key does not follow the game's name: the name can change, the saves must not be lost.
import { makeStore } from '../../shared/players.js';
import { GAME_NAME } from './name.js';
import { LOOKS, lookById } from './looks.js';
import { tidy } from './maker.js';
import { SIZES, HAIR_COLOURS, SKIN_TONES, BAND_COLOURS, EYE_COLOURS } from '../kit/crew.js';

export const KEY = 'calc-station.crew';

// THE MAKER'S COLOURS (the title's swatches, and the only colours a saved look may name): the crew kit's own lists
export const SWATCHES = { hair: HAIR_COLOURS, skin: SKIN_TONES, uniform: Object.values(BAND_COLOURS), eyes: EYE_COLOURS };

// this game's tidy-up of one saved crew member: a look this build knows, a height (look.size, the title's Height
// row: one of the crew kit's SIZES; Medium, or anything else, is left out), and what the character maker laid over the
// look (maker.js tidy: parts by name, colours from the swatches)
const HEIGHTS = Object.values(SIZES).filter((v) => v !== 1);
function fix(p) {
  const id = p.look && typeof p.look.id === 'string' ? p.look.id : null;
  if (!id || !LOOKS.some((l) => l.id === id)) p.look = { ...p.look, id: lookById(id).id };
  if (p.look && 'size' in p.look && !HEIGHTS.includes(p.look.size)) { p.look = { ...p.look }; delete p.look.size; }
  p.look = tidy(p.look, SWATCHES);
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
