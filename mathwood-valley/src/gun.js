// THE GUNS FOR BANDITS: the opt-in six-shooter and two rifles, the rules in plain numbers (no page, no three.js), so the
// title screen, the general store, the cabin's rack, the checklist, the jobs and the node tests all read the same ones.
//
// THE SWITCH: "Lasso only / Lasso or guns", set by a grown-up on the new-rider form and in the Grown-ups corner
// (src/ui/title.js). It is the rider's saved mode (rider.mode, src/save.js): 'lasso' (the default) or 'shoot'.
// THE BUYING: the general store sells the six-shooter and, with the switch on, two rifles of the 1880s (src/catalog.js
// PRICES.revolver, GUNS below). Every rider sees the six-shooter there; a rider with the switch on lasso only sees it
// greyed, with a word that a grown-up can turn it on. Bought, each is kept in rider.owned (revolver: true; rifles: a
// list); turning the switch back to lasso only keeps them, put away. A rifle bought hangs on the cabin's rack.
// CHOOSING: buying never changes what the rider has in hand. The weapon buttons (src/ui/weapons.js) choose: the lasso
// or any gun owned, saved as rider.owned.weapon ('lasso' unless chosen).
// THE SHOOTING: with a gun chosen, the rider aims by hand with a crosshair at the bandits (the wagon job's gangs and
// hold-ups, src/missions/wagonjob.js; the gang's camp guards, src/missions/loot.js). The math stays: the bandit hit is
// the answer, as with the rope. A right one is knocked from the saddle, sits up with his hands raised and turns himself
// in (counted as a roped one); a wrong one ducks, the shot goes over his head, and the same "why" line shows. A shot
// that hits nobody is only a shot. Cattle stay roped. The range takes whichever gun is chosen too (src/missions/shooting.js).
//
//   BANDIT_MODES             the switch's two settings: [{ id, words, line }]
//   GUNS, GUN_ORDER          each gun's numbers: name, price, reach (m), aimPx (how near the crosshair a rider counts as
//                            hit), sway (px the crosshair drifts), every (s between shots), rounds, and its line
//   gunOn(rider)             the switch says lasso or guns
//   ownsGun(rider, id)       that gun has been bought (no id: the six-shooter)
//   gunsOwned(rider)         the ids of the guns bought, in order
//   weaponOf(rider)          what is in hand: 'lasso', or a gun's id (only one the switch allows and that is bought)
//   weapons(rider)           what the weapon buttons offer: ['lasso', ...guns] (just the lasso: no buttons wanted)
//   setWeapon(rider, id)     chooses it, if it can be; the caller saves
//   gunInHand(rider)         the numbers of the gun in hand, or null
//   canShoot(rider)          a gun is in hand: F shoots at bandits
//   setBandits(rider, mode)  sets the switch ('lasso' | 'shoot'); the caller saves
//   gunShop(rider, id)       how the store's row reads: { state: 'off' | 'owned' | 'buy' | 'short', price, need }
//   buyGun(rider, id)        buys it at the store (spends and saves): -> { ok, note }
//   nextGun(rider)           the next gun the store's counter offers, or null: the six-shooter, then the rifles
//   shotAt({ dist, good, reach })   a shot's outcome: 'far' (out of reach: ride closer first) | 'hit' | 'duck'
//   aimSway(t, gun)          where the crosshair has drifted to at time t: { x, y } px
//   GUNPLAY                  the reach, timings and sizes (metres, seconds)
import { spend, saveRider } from './save.js';
import { PRICES, REVOLVER } from './catalog.js';

// (the crosshair's catch is generous on purpose: it's a kid's game and the numbers are the hard part. Each gun up is
// steadier and reaches farther; a single-shot waits longest between shots)
export const GUNS = {
  revolver: { id: 'revolver', name: REVOLVER.name, price: PRICES.revolver, reach: 36, aimPx: 52, sway: 7, every: 0.55, rounds: 6, line: REVOLVER.line, where: 'In your holster' },
  lever: { id: 'lever', name: 'Lever-action rifle', price: PRICES.lever, reach: 60, aimPx: 62, sway: 3, every: 0.8, rounds: 12, where: 'On your rack',
    line: 'Twelve in the tube and a steady aim. Reaches 60 m, where the six-shooter reaches 36.' },
  single: { id: 'single', name: 'Long-range rifle', price: PRICES.single, reach: 100, aimPx: 72, sway: 1, every: 1.6, rounds: 1, where: 'On your rack',
    line: 'A heavy single-shot, as the buffalo hunters carry. The steadiest aim there is and 100 m of reach, one round at a time.' },
};
export const GUN_ORDER = ['revolver', 'lever', 'single'];

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
  { id: 'shoot', words: 'Lasso or guns', line: 'A six-shooter and rifles can be bought at the general store to bring bandits in from farther off. No blood: they tumble off and give up.' },
];

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const gunOn = (rider) => !!rider && rider.mode === 'shoot';
export const ownsGun = (rider, id = 'revolver') => {
  const o = obj(rider && rider.owned);
  if (id === 'revolver') return o.revolver === true;
  return Array.isArray(o.rifles) && o.rifles.includes(id);
};
export const gunsOwned = (rider) => GUN_ORDER.filter((id) => ownsGun(rider, id));
export const weaponOf = (rider) => {
  const w = obj(rider && rider.owned).weapon;
  return gunOn(rider) && GUNS[w] && ownsGun(rider, w) ? w : 'lasso';
};
export const weapons = (rider) => (gunOn(rider) ? ['lasso', ...gunsOwned(rider)] : ['lasso']);
export function setWeapon(rider, id) {
  if (!rider || !weapons(rider).includes(id)) return false;
  rider.owned = { ...obj(rider.owned), weapon: id };
  return true;
}
export const gunInHand = (rider) => GUNS[weaponOf(rider)] || null;
export const canShoot = (rider) => !!gunInHand(rider);
export function setBandits(rider, mode) {
  if (!rider) return false;
  rider.mode = mode === 'shoot' ? 'shoot' : 'lasso';
  return true;
}

export function gunShop(rider, id = 'revolver') {
  const price = GUNS[id].price, gold = Math.max(0, Math.round(Number(rider && rider.gold) || 0));
  if (ownsGun(rider, id)) return { state: 'owned', price, need: 0 };
  if (!gunOn(rider)) return { state: 'off', price, need: 0 };
  return gold >= price ? { state: 'buy', price, need: 0 } : { state: 'short', price, need: price - gold };
}
export const nextGun = (rider) => GUN_ORDER.find((id) => !ownsGun(rider, id)) || null;

export function buyGun(rider, id = 'revolver') {
  const s = gunShop(rider, id), G = GUNS[id];
  if (s.state === 'owned') return { ok: false, note: `The ${G.name.toLowerCase()} is already yours.` };
  if (s.state === 'off') return { ok: false, note: `The ${G.name.toLowerCase()} is off for this rider. A grown-up can turn it on in the rider's settings.` };
  if (!spend(rider, s.price)) return { ok: false, note: 'Not enough gold yet.' };
  const o = obj(rider.owned);
  rider.owned = id === 'revolver' ? { ...o, revolver: true } : { ...o, rifles: [...new Set([...(Array.isArray(o.rifles) ? o.rifles : []), id])] };
  saveRider(rider);
  return { ok: true, note: id === 'revolver'
    ? 'The six-shooter is yours! Near the bandits, choose it with the buttons on the right.'
    : `The ${G.name.toLowerCase()} is yours! It's on your cabin's rack if you have one. Near the bandits, or at the range, choose it with the buttons on the right.` };
}

// where the crosshair has drifted to at time t: a slow wander, smaller the steadier the gun
export function aimSway(t, gun) {
  const k = gun ? gun.sway : 0;
  return { x: Math.sin(t * 1.3) * k + Math.sin(t * 2.9 + 1) * k * 0.4, y: Math.sin(t * 1.7 + 2) * k * 0.8 };
}

// What a shot at a bandit does: out of reach, the rider rides closer first; in reach, the right one is hit and a wrong
// one ducks (the shot goes over his head), exactly as the rope's right and wrong picks.
export function shotAt({ dist, good, reach = GUNPLAY.reach } = {}) {
  if (!(Number(dist) <= reach)) return 'far';
  return good ? 'hit' : 'duck';
}
