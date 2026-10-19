// THE CATALOG: what the stable and the general store sell, and what each costs. Plain data only (no page, no three.js),
// so the counters (src/shop.js, which re-exports all of it), the completion checklist (src/completion.js) and the node
// tests can all read the same tables. The hats themselves are in src/hats.js, the cabin's furnishings in
// src/cabin/slots.js and the farm animals in src/math/goods.js; their prices are here (hats) or beside them (the rest).
//
// Every price is in the table right below, so they can be tuned in one place after watching the kids play. The gold
// the jobs pay is in src/shop.js PAY and each job's own dials.

// ── PRICES (gold) ────────────────────────────────────────────────────────────────────────────────────────────────────
export const PRICES = {
  saddle: { plain: 15, tooled: 60, silver: 150 },   // the first saddle is cheap and quick; fancier ones cost more
  horse: { donkey: 20, chestnut: 60, palomino: 100, white: 150, midnight: 200 },   // the bay comes free; the donkey is the joke mount
  hat: { white: 20, straw: 30, bowler: 50, ranger: 80, cattleman: 120, sombrero: 200 },   // the old cowboy hat comes free
  dog: { shiba: 60, husky: 60, pug: 25 },           // the pug is the cheap joke pick
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
