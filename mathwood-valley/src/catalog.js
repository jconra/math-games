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
  horse: { donkey: 40, chestnut: 120, palomino: 200, white: 300, midnight: 400 },   // the bay comes free; the donkey is the joke mount
  hat: { white: 40, straw: 60, bowler: 100, ranger: 160, cattleman: 240, sombrero: 400 },   // the old cowboy hat comes free
  dog: { shiba: 120, husky: 120, pug: 50 },          // the pug is the cheap joke pick
  // the farm animals for the yard behind the cabin (src/math/goods.js ANIMALS): a hen cheap, a milk cow dear
  animal: { hen: 30, pig: 70, sheep: 100, cow: 240 },
  // the cabin's furnishings (src/cabin/slots.js SLOTS), a ladder from a cheap rug to a costly stove
  furniture: { rug: 30, lanterns: 60, picture: 80, dogbeds: 90, table: 120, porch: 160, bed: 200, rifles: 240, stove: 440 },
  // the cabin itself: the big thing to save for. Until it is bought the rider camps by the creek (src/cabin/camp.js);
  // a rider who already had any cabin furniture gets it as bought (save.js fixRider)
  cabin: 600,
};
export const SADDLES = [
  { id: 'plain', name: 'Plain saddle', line: 'Plain brown leather. Any saddle lets you ride.' },
  { id: 'tooled', name: 'Tooled saddle', line: 'Black leather, tooled by hand.' },
  { id: 'silver', name: 'Silver saddle', line: 'Tooled, with silver and turquoise conchos.' },
];
export const HORSES = [
  { id: 'bay', name: 'Chester the bay', line: 'Your trusty bay. Gallops fast. Free.' },
  { id: 'donkey', name: 'Jasper the donkey', line: 'Slow as molasses and twice as stubborn, but he\'ll get you there.' },
  { id: 'chestnut', name: 'Copper the chestnut', line: 'A steady farm horse with a red-brown coat. Gallops a little slower.' },
  { id: 'palomino', name: 'Goldie the palomino', line: 'A golden coat that shines in the sun. Gallops fast.' },
  { id: 'white', name: 'Willow the white horse', line: 'A white horse, the talk of the valley. Gallops fast.' },
  { id: 'midnight', name: 'Midnight', line: 'A black horse, dark as a moonless night. Gallops fast.' },
];
export const DOGS = [
  { id: 'shiba', name: 'Shiba', line: 'Quick and clever. Keeps up on foot and on the trail.' },
  { id: 'husky', name: 'Husky', line: 'Strong and tireless. Keeps up with a galloping horse.' },
  { id: 'pug', name: 'Pug', line: 'He won\'t herd anything, but he\'s loyal.' },
];
export const DOG_NAMES = ['Biscuit', 'Dusty', 'Scout', 'Pepper', 'Rusty', 'Bandit', 'Maple', 'Boots'];
