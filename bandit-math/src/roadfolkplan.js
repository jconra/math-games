// THE ROAD FOLK'S PLAN, in plain numbers (no three.js, so the tests can load it): how many travel the road through the
// valley, how fast, where on the road each keeps, where a new one sets off from, and who they are. Used by
// src/roadfolk.js; tested in tests/roadfolk.test.mjs.

export const ROADFOLK = {
  most: { gaming: 8, normal: 6, potato: 3 },          // travellers on the road at once (the far ones are only numbers)
  made: { gaming: 5, normal: 4, potato: 2 },          // ... at most this many made and drawn at once (the nearest)
  show: { gaming: 190, normal: 160, potato: 120 },    // m from the player within which one is made
  hide: 25,             // m further than `show` before one is put away again
  every: [12, 28],      // s between one setting off and the next (while there are fewer than `most`)
  riders: 0.45,         // the share of riders (the rest walk)
  nightWalk: 0.6,       // at night (W.night 1) this share of the walkers stay home: fewer set off
  walk: [1.15, 1.45],   // m/s: a walker's pace
  ride: [2.0, 3.6],     // m/s: a rider's (a walk or an easy trot)
  edge: { walker: 1.9, rider: 1.4 },   // m out past the middle of the wagons' lane each keeps to (the road's edge)
  least: 0.35,          // m: the nearest the road's middle one comes in (where the edge is blocked)
  inLane: 1.0,          // m: nearer the middle of the wagons' lane than this, a wagon stops for them
  look: { walker: 2.6, rider: 4.5 },   // m ahead each looks for something in the way
  wide: { walker: 0.85, rider: 1.15 }, // ... and how close to its path a thing is in its way
  pass: 1.15,           // m a rider steps in toward the middle to go round a walker ahead
  sideStep: 1.5,        // m one steps aside round the player (or a horse, the dog) ...
  stepAfter: 2.2,       // ... after this many seconds stopped for them
  reach: 360,           // m from the square: one also sets off from out here (out of sight of the town), as the wagons do
  apart: 30,            // m from another going the same way, at the least, where a new one sets off
  fade: { in: 1.2, out: 1.2, end: 1.8 },   // s: fading in (made in sight), out (put away in sight), at the road's end
  wave: 1.6,            // s a walker stops to wave, saying hello
  turn: 3,              // radians a second a traveller turns, at most
  accel: { walker: 0.9, rider: 1.6 },  // m/s each second, speeding up ...
  brake: { walker: 2.6, rider: 3.2 },  // ... and slowing down
  seed: 0.5,            // riding out, about this share of `most` are on the road already ...
  seedAway: 220,        // ... none of them nearer the player than this (m)
};

// what they look like: working clothes in drab period colours (never all black and charcoal: that reads as the gang)
export const TRAVELLER_LOOKS = {
  outfits: ['adventurer_m', 'adventurer_f', 'casual_m', 'casual_f', 'worker_m', 'farmer_m', 'casual_m', 'adventurer_m'],
  palettes: ['drifter', 'rancher', 'homestead', 'prairie', 'townsman', 'mustard', 'sage'],
};

// a rider or a walker: riders `riders` of the time; at night (0..1) fewer walkers
export function pickKind(rand = Math.random, night = 0) {
  const walk = (1 - ROADFOLK.riders) * (1 - ROADFOLK.nightWalk * Math.max(0, Math.min(1, night || 0)));
  return rand() * (ROADFOLK.riders + walk) < ROADFOLK.riders ? 'rider' : 'walker';
}
// the pace a new traveller keeps (m/s)
export function paceFor(kind, rand = Math.random) {
  const [a, b] = kind === 'rider' ? ROADFOLK.ride : ROADFOLK.walk;
  return a + rand() * (b - a);
}
// where on the road one keeps: `lane` (the wagons' lane there, m from the middle) plus its own edge
export const edgeOf = (kind, lane) => lane + (ROADFOLK.edge[kind] ?? ROADFOLK.edge.walker);

// where a new traveller going `dir` (+1 along the road, -1 back) sets off, metres along it, or null for nowhere just
// now: the road's own end it comes in from, else out of sight of the town (`reach` from the square, as the wagons),
// whichever is further than `far` from the player (dist(u): metres from the player to the road there) and at least
// `apart` from another traveller going the same way (others: [{ dir, u }])
export function startFor(dir, { L, square, dist, far, others = [] }) {
  const ends = [dir > 0 ? 0 : L, square - dir * ROADFOLK.reach];
  for (const s of ends) {
    const u = Math.min(L, Math.max(0, s));
    if (dist(u) <= far) continue;
    if (others.some((o) => o.dir === dir && Math.abs(o.u - u) < ROADFOLK.apart)) continue;
    return u;
  }
  return null;
}

// the spots of those already on the road when the player rides out: n of them spread along it, each at least
// `away` metres from the player (dist(u)) and `apart` from the others; [{ u, dir }]
export function seedSpots(n, { L, dist, away = ROADFOLK.seedAway, rand = Math.random }) {
  const out = [];
  for (let k = 0; k < n * 12 && out.length < n; k++) {
    const u = 4 + rand() * (L - 8), dir = rand() < 0.5 ? 1 : -1;
    if (dist(u) < away) continue;
    if (out.some((o) => Math.abs(o.u - u) < ROADFOLK.apart * 2)) continue;
    out.push({ u, dir });
  }
  return out;
}
