// THE CATALOG: what the stable, the general store and the cabin sell, and what each costs. Plain data only (no page,
// no three.js), so the counters (src/shop.js, which re-exports all of it), the completion checklist (src/completion.js),
// the cabin (src/cabin/slots.js), the farm animals (src/math/goods.js) and the node tests all read the same tables. The
// hats themselves are in src/hats.js, the cabin's furnishings in src/cabin/slots.js and the farm animals in
// src/math/goods.js; every price is here.
//
// Every price is in the table right below, so they can be tuned in one place after watching the kids play. The gold
// the jobs pay is in src/shop.js PAY and each job's own dials.
//
// 2026-10-19: every price was doubled (the jobs' pay was left as it was), so gold stays worth saving up for: about
// 5,260 gold buys everything on the checklist, the cabin itself (600) the biggest single thing. Measured with the
// economy model (hours to 100%, gold earned by then): see save.js JOBS.

// ── PRICES (gold) ────────────────────────────────────────────────────────────────────────────────────────────────────
export const PRICES = {
  saddle: { plain: 30, tooled: 120, silver: 300 },   // the first saddle is cheap and quick; fancier ones cost more
  // every rider starts on foot; the price always goes up with the speed (Dad, 2026-10-27: "I dont think we need any at
  // free, but have a progression"), so the first ride is the donkey and a plain saddle, 60 in all
  horse: { donkey: 30, chestnut: 45, bay: 60, palomino: 200, white: 300, midnight: 400 },
  hat: { white: 40, straw: 60, bowler: 100, ranger: 160, cattleman: 240, sombrero: 400 },   // the old cowboy hat comes free
  dog: { shiba: 120, husky: 120, pug: 50 },          // the pug is the cheap joke pick
  // the farm animals for the yard behind the cabin (src/math/goods.js ANIMALS): a hen cheap, a milk cow dear
  animal: { hen: 30, pig: 70, sheep: 100, cow: 240 },
  // the cabin's furnishings (src/cabin/slots.js SLOTS), a ladder from a cheap rug to a costly stove
  furniture: { rug: 30, lanterns: 60, picture: 80, dogbeds: 90, table: 120, porch: 160, bed: 200, rifles: 240, stove: 440 },
  // the cabin itself: the big thing to save for. Until it is bought the rider camps by the creek (src/cabin/camp.js);
  // a rider who already had any cabin furniture gets it as bought (save.js fixRider)
  cabin: 600,
  // the six-shooter for bringing in bandits (src/gun.js): sold at the general store, only to a rider whose grown-up
  // set "Bandits: lasso or revolver" (rider.mode 'shoot'); above the first saddle and horse, so it is a goal
  revolver: 150,
};
// the six-shooter as the general store shows it (src/shop.js; src/gun.js has its rules)
export const REVOLVER = { id: 'revolver', name: 'Six-shooter', line: 'Bring in bandits from thirty paces. F (or Shoot) fires instead of the rope; cattle are still roped.' };
export const SADDLES = [
  { id: 'plain', name: 'Plain saddle', line: 'Plain brown leather. Any saddle lets you ride.' },
  { id: 'tooled', name: 'Tooled saddle', line: 'Black leather, tooled by hand.' },
  { id: 'silver', name: 'Silver saddle', line: 'Tooled, with silver and turquoise conchos.' },
];
// THE LADDER: what each of the stable's horses is and how it goes. The price buys size and speed: a bigger horse takes
// longer strides with the same gallop, so it goes faster with its hooves still planted (src/player.js); the rider stays
// the same size. kind: the animal (the steed: the new horse, its coat the preset of that name in
// src/actors/horsecoats.js; the donkey as it is); size: against the bay (the steed's own size: 1); walk, trot, gallop:
// m/s (a steed's walk is 2 x its size and its trot 6 x its size: the same clip speeds as the bay's); mph: its top speed
// as the stable shows it, a whole number of miles an hour (its gallop, mphOf): "even little kids know bigger number is
// better"
export const LADDER = {
  donkey: { kind: 'donkey', size: 1, walk: 1.6, trot: 4, gallop: 8, mph: 18 },
  chestnut: { kind: 'steed', coat: 'chestnut', size: 0.95, walk: 1.9, trot: 5.7, gallop: 12, mph: 27 },
  bay: { kind: 'steed', coat: 'bay', size: 1, walk: 2, trot: 6, gallop: 13, mph: 29 },
  palomino: { kind: 'steed', coat: 'palomino', size: 1.05, walk: 2.1, trot: 6.3, gallop: 14, mph: 31 },
  white: { kind: 'steed', coat: 'white', size: 1.1, walk: 2.2, trot: 6.6, gallop: 15, mph: 34 },
  midnight: { kind: 'steed', coat: 'midnight', size: 1.15, walk: 2.3, trot: 6.9, gallop: 16.5, mph: 37 },
};
// THE PEN behind the stable (src/horsepen.js, src/horsepenplan.js): horses of every coat, a new few each time the rider
// comes back to town. A pen horse costs what the stable's horse of its size does (Dad: "similar to the ones in the
// stables"), and a little more for a coat that is seldom seen
export const PEN = {
  bySize: { 0.95: 45, 1: 60, 1.05: 200, 1.1: 300, 1.15: 400 },
  extra: { common: 0, less: 5, uncommon: 10, rare: 20 },   // (less common: palomino, buckskin, dun; uncommon: grey, black; rare: the paints)
};
export const MPH = 2.23694;   // miles an hour in a metre a second
export const mphOf = (mps) => Math.round(mps * MPH);
// The stable's horses, cheapest and slowest first. (Each horse's top speed shows beside its line as a number, LADDER
// mph: the lines say how big it is and nothing the numbers don't bear out.)
export const HORSES = [
  { id: 'donkey', name: 'Jasper the donkey', line: 'Slow as molasses and twice as stubborn, but he\'ll get you there. The cheapest ride in the valley.' },
  { id: 'chestnut', name: 'Copper the chestnut', line: 'A steady chestnut, the smallest of the horses, and a big step up from a donkey.' },
  { id: 'bay', name: 'Chester the bay', line: 'A handsome bay with a white star, a step bigger and faster than Copper.' },
  { id: 'palomino', name: 'Goldie the palomino', line: 'A golden coat that shines in the sun. Bigger and faster than Chester.' },
  { id: 'white', name: 'Willow the white horse', line: 'A big white horse, the talk of the valley. Bigger and faster again.' },
  { id: 'midnight', name: 'Midnight', line: 'The biggest horse in the valley, dark as a moonless night. The fastest of them all.' },
];
export const DOGS = [
  { id: 'shiba', name: 'Shiba', line: 'Quick and clever. Keeps up on foot and on the trail.' },
  { id: 'husky', name: 'Husky', line: 'Strong and tireless. Keeps up with a galloping horse.' },
  { id: 'pug', name: 'Pug', line: 'He won\'t herd anything, but he\'s loyal.' },
];
export const DOG_NAMES = ['Biscuit', 'Dusty', 'Scout', 'Pepper', 'Rusty', 'Bandit', 'Maple', 'Boots'];
