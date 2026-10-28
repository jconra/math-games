// THE RIDER'S HORSES: every horse a rider owns, what each one is, and which one is ridden, in one place, for everything
// that lets a rider pick a horse of their own: the stable's counter (src/shop.js), the player (src/player.js: which
// horse to ride, its coat, size and paces), and later a pasture by the cabin where pressing E by a horse rides it (it
// calls ownedHorses and rideHorse the same way). Plain data and plain functions: no page, no three.js.
//
// In the save (rider.owned, src/save.js; the key stays 'bandit-math.riders'):
//   owned.horse     the id of the horse ridden (null: none yet; every rider starts on foot)
//   owned.horses    the stable's horses bought (ids from src/catalog.js LADDER; a rider from before the bay cost money
//                   has 'bay' here: save.js fixRider)
//   owned.mounts    horses of the rider's own that aren't the stable's ladder (the pen's, later), by id ('pen-3'):
//                   { name, line, coat: { the whole recipe: src/actors/horsecoats.js }, size, gallop, price, from, at }.
//                   The whole coat is kept, not a seed, so a horse bought never changes. Cleaned by cleanMounts.
//   owned.penNext   the pen's next number (once the pen sells horses)
// Ids this build doesn't know (a newer build's) are kept as they are; a ridden id this build can't find rides another
// horse the rider has (the stable's, the cheapest first, then their own), or none.
//
//   horseLook(rider, id) -> { kind, coat, size, walk, trot, gallop, mph, name, line, id } | null
//   ownedHorses(rider) -> [{ id, name, line, look, ridden }]   the stable's ones owned in the order it sells them
//                   (src/catalog.js HORSES: the donkey first), then the rider's own (in the order they came)
//   ownsHorse(rider, id), ridden(rider) -> id | null (no horse: on foot)
//   rideHorse(rider, id) -> true if it is now the one ridden (the caller saves the rider and tells the player:
//                   P.refreshOwned())
//   cleanMounts(mounts) -> mounts   (save.js fixRider)
//   paceAt(size, gallop) -> { walk, trot, gallop }   a steed's paces at its size (walk 2 x size, trot 6 x size)
import { LADDER, HORSES, PRICES, mphOf } from './catalog.js';
import { cleanCoat } from './actors/horsecoats.js';

export const SIZES = [0.95, 1, 1.05, 1.1, 1.15];   // the stable's sizes (a horse of the rider's own snaps to one)
export const NAME_MOST = 16;                         // letters in a horse's name
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const ownedOf = (rider) => obj(rider && rider.owned);
export const paceAt = (size, gallop) => ({ walk: +(2 * size).toFixed(2), trot: +(6 * size).toFixed(2), gallop });
const snap = (s) => SIZES.reduce((b, x) => (Math.abs(x - s) < Math.abs(b - s) ? x : b), 1);
// a ladder horse's top speed at a size (between the rungs: the nearest rung's), for a horse of the rider's own
const gallopAt = (size) => { const L = Object.values(LADDER).find((x) => x.kind === 'steed' && x.size === snap(size)); return L ? L.gallop : 13; };

export function horseLook(rider, id) {
  if (typeof id !== 'string') return null;
  const L = LADDER[id];
  if (L) { const h = HORSES.find((x) => x.id === id) || {}; return { ...L, id, name: h.name || id, line: h.line || '' }; }
  const m = obj(ownedOf(rider).mounts)[id];
  if (!m || !m.coat) return null;
  const size = snap(+m.size || 1), gallop = +m.gallop > 0 ? +m.gallop : gallopAt(size);
  return { kind: 'steed', coat: m.coat, size, ...paceAt(size, gallop), mph: mphOf(gallop), id, name: m.name || 'Your horse', line: m.line || '' };
}
export function ownsHorse(rider, id) {
  if (typeof id !== 'string') return false;
  const o = ownedOf(rider);
  if (LADDER[id]) return (Array.isArray(o.horses) && o.horses.includes(id)) || o.horse === id;
  return !!horseLook(rider, id);
}
export const ridden = (rider) => {
  const id = ownedOf(rider).horse;
  if (horseLook(rider, id) && ownsHorse(rider, id)) return id;
  const other = ownedHorses0(rider); return other.length ? other[0] : null;
};
function ownedHorses0(rider) {
  const o = ownedOf(rider), out = [];
  for (const id of [...HORSES.map((h) => h.id), ...Object.keys(LADDER)]) if (LADDER[id] && !out.includes(id) && ownsHorse(rider, id)) out.push(id);
  for (const id of Object.keys(obj(o.mounts))) if (horseLook(rider, id)) out.push(id);
  return out;
}
export function ownedHorses(rider) {
  const now = ridden(rider);
  return ownedHorses0(rider).map((id) => { const look = horseLook(rider, id); return { id, name: look.name, line: look.line, look, ridden: id === now }; });
}
export function rideHorse(rider, id) {
  if (!ownsHorse(rider, id) || !horseLook(rider, id)) return false;
  const o = rider.owned || (rider.owned = {});
  if (LADDER[id]) o.horses = [...new Set([...(Array.isArray(o.horses) ? o.horses : []), id])].filter((h) => typeof h === 'string');
  o.horse = id;
  return true;
}

// the rider's own horses, made safe: an entry needs an id and a coat (the coat's fields filled and kept to their ranges);
// the size snaps to the stable's, the top speed is a believable number (else the ladder's at that size), the name is
// up to NAME_MOST letters; anything else in an entry is kept
export function cleanMounts(mounts) {
  const out = {};
  for (const [id, m0] of Object.entries(obj(mounts))) {
    const m = obj(m0); if (!id || !m.coat || typeof m.coat !== 'object') continue;
    const size = snap(Number.isFinite(+m.size) ? +m.size : 1), g = +m.gallop;
    out[id] = {
      ...m,
      name: String(m.name == null ? 'Your horse' : m.name).replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, NAME_MOST) || 'Your horse',
      line: typeof m.line === 'string' ? m.line.slice(0, 240) : '',
      coat: cleanCoat(m.coat),
      size,
      gallop: Number.isFinite(g) && g >= 6 && g <= 20 ? g : gallopAt(size),
      price: Math.max(0, Math.round(+m.price || 0)),
    };
  }
  return out;
}
