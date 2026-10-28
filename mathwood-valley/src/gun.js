// THE SIX-SHOOTER FOR BANDITS: an opt-in revolver for bringing in bandits, the rules in plain numbers (no page, no
// three.js), so the title screen, the general store, the checklist, the jobs and the node tests all read the same ones.
//
// THE SWITCH: "Bandits: lasso only / lasso or revolver", set by a grown-up on the new-rider form and in the Grown-ups
// corner (src/ui/title.js). It is the rider's saved mode (rider.mode, src/save.js): 'lasso' (the default) or 'shoot'.
// THE BUYING: the general store sells the six-shooter (src/catalog.js PRICES.revolver, REVOLVER). Every rider sees it
// there; a rider with the switch on lasso only sees it greyed, with a word that a grown-up can turn it on. Bought, it
// is kept in rider.owned.revolver (true); turning the switch back to lasso only keeps it, put away.
// THE SHOOTING: with it bought and the switch on, F (or the touch Shoot button, or a click or tap on a bandit) fires
// instead of throwing the rope at the bandits (the wagon job's gangs and hold-ups, src/missions/wagonjob.js; the
// gang's camp guards, src/missions/loot.js). The math stays: the bandit picked is the answer, as with the rope. A right
// one is knocked from the saddle, sits up with his hands raised and turns himself in (counted as a roped one); a wrong
// one ducks, the shot goes over his head, and the same "why" line shows. Cattle and the bottle range are as they were.
//
//   BANDIT_MODES             the switch's two settings: [{ id, words, line }]
//   gunOn(rider)             the switch says lasso or revolver
//   ownsGun(rider)           the six-shooter has been bought
//   canShoot(rider)          both: F shoots at bandits
//   setBandits(rider, mode)  sets the switch ('lasso' | 'shoot'); the caller saves
//   gunShop(rider)           how the store's row reads: { state: 'off' | 'owned' | 'buy' | 'short', price, need }
//   buyGun(rider)            buys it at the store (spends and saves): -> { ok, note }
//   shotAt({ dist, good, reach })   a shot's outcome: 'far' (out of reach: ride closer first) | 'hit' | 'duck'
//   GUNPLAY                  the reach, timings and sizes (metres, seconds)
import { spend, saveRider } from './save.js';
import { PRICES, REVOLVER } from './catalog.js';

export const GUNPLAY = {
  reach: 36,          // m: the six-shooter reaches this far (the rope: 15). Farther off, the rider rides closer first
  from: 30,           // ... riding up to within this before firing
  draw: 0.28,         // s from the call to the shot: the hand comes up and the body turns to him
  hold: 1.3,          // s the gun stays up after the shot before it is put away
  bullet: 340,        // m/s: the shot lands a little after the flash, farther off a little later
  duck: 1.2,          // s a wrong bandit takes to duck down and come back up
};

export const BANDIT_MODES = [
  { id: 'lasso', words: 'Lasso only', line: 'Bandits are roped, as cattle are.' },
  { id: 'shoot', words: 'Lasso or revolver', line: 'A six-shooter can be bought at the general store to bring bandits in from farther off. No blood: they tumble off and give up.' },
];

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const gunOn = (rider) => !!rider && rider.mode === 'shoot';
export const ownsGun = (rider) => !!rider && obj(rider.owned).revolver === true;
export const canShoot = (rider) => gunOn(rider) && ownsGun(rider);
export function setBandits(rider, mode) {
  if (!rider) return false;
  rider.mode = mode === 'shoot' ? 'shoot' : 'lasso';
  return true;
}

export function gunShop(rider) {
  const price = PRICES.revolver, gold = Math.max(0, Math.round(Number(rider && rider.gold) || 0));
  if (ownsGun(rider)) return { state: 'owned', price, need: 0 };
  if (!gunOn(rider)) return { state: 'off', price, need: 0 };
  return gold >= price ? { state: 'buy', price, need: 0 } : { state: 'short', price, need: price - gold };
}

export function buyGun(rider) {
  const s = gunShop(rider);
  if (s.state === 'owned') return { ok: false, note: `The ${REVOLVER.name.toLowerCase()} is already yours.` };
  if (s.state === 'off') return { ok: false, note: 'The six-shooter is off for this rider. A grown-up can turn it on in the rider\'s settings.' };
  if (!spend(rider, s.price)) return { ok: false, note: 'Not enough gold yet.' };
  rider.owned = { ...obj(rider.owned), revolver: true };
  saveRider(rider);
  return { ok: true, note: 'The six-shooter is yours! Near the bandits, F (or Shoot) fires instead of the rope.' };
}

// What a shot at a bandit does: out of reach, the rider rides closer first; in reach, the right one is hit and a wrong
// one ducks (the shot goes over his head), exactly as the rope's right and wrong picks.
export function shotAt({ dist, good, reach = GUNPLAY.reach } = {}) {
  if (!(Number(dist) <= reach)) return 'far';
  return good ? 'hit' : 'duck';
}
