// THE TOWN'S PEOPLE'S PLAN: who lives where, the places they go, and how they choose where next. No three.js here (the
// people themselves are made and moved in src/townpeople.js), so the tests can run it as it is.
//
// The townsfolk are the store's customers (src/math/wordproblems.js FOLK): the same faces bring order slips to the
// counter, come to the sheriff's office for the loot the gang took (src/math/shares.js FAMILIES: one of each family) and
// walk about the town between times. Each has a home: one of the homes behind the main row, the rooms over the saloon
// or the store, or a place out of town up the road.
//
//   TOWN                    the dials (how many are out at once, how fast they walk, how long they stay ...)
//   HOME_OF                 name -> where they live ('home1'..'home4', 'saloon', 'store', 'west', 'east': up the road)
//   residents()             [{ name, she, look, home }] every townsperson, with a hat and a colour of their own
//   LIKES                   how much a person likes each kind of spot (porch, square, stage, yard, lake, lane, home)
//   STAY                    [clip, from, to] seconds at each kind of spot
//   outCap(tier, night)     how many may be out at once (tier: a tier's name, or the most by day itself)
//   pick(weights, rand)     an index chosen in proportion to the weights (-1 when they are all 0)
//   nextFor(person, spots, { night, rand, at, playing, here, fresh })   where a person goes next: { go: 'spot', spot } |
//                           { go: 'home' } | { go: 'door', door } (a visit indoors) | { go: 'road' } (out of town)
//   lendCost({ out, d, door })   how good a person is to lend a job: the lower the better
//   hash(text) -> 0..1      a steady number from a name (their skin and hair, and a hat)
import { FOLK } from './math/wordproblems.js';

export const TOWN = {
  out: { gaming: 10, normal: 7, potato: 4 },   // the most townsfolk out at once, by the quality tier
  nightOut: 0.25,      // ... at full night only this share of that (the rest go home)
  walk: [1.15, 1.45],  // m/s a person strolls
  hurry: 2.4,          // m/s a person hurrying to a job (the Run clip, slowed)
  apart: 0.7,          // m two people standing about keep between them (closer, at a door or a spot: they ease apart)
  inside: [30, 120],   // s a person stays indoors before coming out again (by day)
  insideNight: [240, 600],   // ... by night
  door: 0.6,           // s to step through a door: dissolving in or out
  doorStep: 0.9,       // m walked while dissolving (from the foot of the steps out to the door's spot, or back in)
  start: 0.7,          // the share of the most-out-at-once already about when the ride starts
  shadowNear: 45,      // m from the camera's target within which they cast shadows
  near: 40, far: 110,  // m: animated every frame within near, every other frame to far, every fourth beyond
  seenFar: 260,        // m: further than this from the camera a person counts as out of sight (a few pixels tall)
  seenPad: 1.2,        // m round a person's middle that the camera's view must miss for them to count as unseen
  routesPerFrame: 2,   // routes worked out a frame at most
  wait: { player: 1.1, person: 0.8, wagon: 3 },   // m ahead in which someone stops for the player, a person, a wagon
  expect: 45,          // s a person sent toward a job's place waits there before going about their day again
  road: 4.5,           // m from the middle of the wagons' road that the places people stand about keep (its lanes, a
                       // wagon's width, and the step to one side a second person takes at a spot): a spot in the street
                       // had wagons waiting the best part of a minute behind two people talking there
  porchRoad: 3.6,      // m: the same for a porch's places, along a building's front (its second person steps along the
                       // front, not out into the street): the wagons' lane edge is 2.5 m out from the road's middle
  wagonWait: 1.5,      // s someone standing about lets a wagon wait on them, stopped close in front of its team, before
                       // they move on out of its way
  aside: [2.8, 3.6, 4.5],   // m straight out to one side of a waiting wagon's way that they step (the first with room)
  lootNear: 420,       // m: carrying the gang's loot this near the sheriff's office, the folks it's for gather there
  lootFar: 650,        // ... or this near and riding toward it (a gallop covers ~400 m in the ~40 s a walk across town takes)
};

// where each townsperson lives
export const HOME_OF = {
  'Mr. Pike': 'home1', 'Miss Lottie': 'home1',
  'Widow Collins': 'home2', 'Hattie Bell': 'home2', 'Matron Hale': 'home2',
  'Sam Ortega': 'home3', 'Rosa Vega': 'home3',
  'Jed Turner': 'home4', 'Clara Dunn': 'home4',
  Cookie: 'saloon', 'Old Silas': 'saloon', 'Ike Malone': 'saloon',
  'Mr. Okafor': 'store', 'Mrs. Lindqvist': 'store',
  'Doc Harlan': 'west', 'Mrs. Abernathy': 'east',
};
// hats by outfit (src/hats.js ids; null: the cowboy hat; the formal dress goes bare)
const HAT_BY = { suit_m: ['bowler', 'bowler', null], suit_f: ['straw', null], casual_f: ['straw', 'straw', null], adventurer_f: ['ranger', null], adventurer_m: [null, 'cattleman'], casual_m: [null, 'straw'], worker_m: ['straw', null], formal_f: [null] };

export function hash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }

export function residents() {
  return FOLK.map((f) => {
    const h = hash(f.name), hats = HAT_BY[f.look.outfit] || [null];
    return { name: f.name, she: !!f.she, who: f, home: HOME_OF[f.name] || 'saloon',
      look: { ...f.look, skin: Math.floor(h * 8) % 8, hair: Math.floor(hash(f.name + 'hair') * 11) % 11, hatStyle: hats[Math.floor(hash(f.name + 'hat') * hats.length) % hats.length] } };
  });
}

// how much each kind of spot is liked (a spot with someone already there counts more: people gather and talk)
export const LIKES = { porch: 3, square: 2, stage: 2.5, yard: 1.6, lake: 1.1, lane: 1, home: 0.8, ownHome: 2.5 };
export const COMPANY = 2.5;
export const ROAM = 70;        // m: a spot this much further off is a third as likely
// at each kind of spot: the clip and how long they stay (s)
export const STAY = { porch: ['Idle', 20, 55], square: ['Idle_Neutral', 15, 40], stage: ['Idle', 40, 110], yard: ['Interact', 12, 35],
  lake: ['Idle_Neutral', 25, 70], lane: ['Idle', 10, 25], home: ['Idle', 12, 35] };

// (tier: a tier's name, or the most itself: the governor's 'townsfolk' dial, world/governor.js)
export const outCap = (tier, night = 0) => Math.max(1, Math.round((typeof tier === 'number' ? tier : TOWN.out[tier] || TOWN.out.normal) * (1 - (1 - TOWN.nightOut) * Math.max(0, Math.min(1, night)))));

export function pick(w, rand = Math.random) {
  let sum = 0; for (const v of w) sum += v;
  if (!(sum > 0)) return -1;
  let r = rand() * sum; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0 && w[i] > 0) return i; }
  for (let i = w.length - 1; i >= 0; i--) if (w[i] > 0) return i;
  return -1;
}

// where next, for a person standing at `at` ({ x, z }): a spot (by what they like, nearer more likely, never the one they
// are at, never a full one), their home (more likely the later it is), a building to go into, or out of town by the road
// spots: [{ kind, x, z, cap, used, home (for a home's yard), crowd (people there now) }]; playing: the band is playing
// fresh: just out of a door (never straight back in through one: a spot, or off up the road)
export function nextFor(person, spots, { night = 0, rand = Math.random, at = person, playing = true, here = null, fresh = false } = {}) {
  const w = [], n = Math.max(0, Math.min(1, night));
  for (const s of spots) {
    let v = s.kind === 'home' && s.home === person.home ? LIKES.ownHome : LIKES[s.kind] || 0;
    if (s === here || s.used >= s.cap || (s.kind === 'stage' && !playing)) { w.push(0); continue; }
    if (n > 0.5 && s.kind !== 'porch' && !(s.kind === 'home' && s.home === person.home)) v *= 0.15;   // (at night: indoors, or the saloon's porch)
    v *= Math.exp(-Math.hypot(s.x - at.x, s.z - at.z) / ROAM);
    if (s.crowd > 0 && s.crowd < s.cap) v *= COMPANY;
    w.push(v);
  }
  const spotSum = w.reduce((a, b) => a + b, 0);
  // indoors: home (by day now and then; by night most likely), or a visit into the store or the saloon
  const outOfTown = person.home === 'west' || person.home === 'east';
  const homeW = fresh ? 0 : (0.35 + 6 * n) * Math.max(0.6, spotSum), visitW = fresh ? 0 : 0.25 * (1 - n) * Math.max(0.6, spotSum);
  const all = [...w, outOfTown ? 0 : homeW, visitW, outOfTown ? homeW : 0.05 * (1 - n) * spotSum];
  const i = pick(all, rand);
  if (i < 0) return { go: outOfTown ? 'road' : 'home' };
  if (i < spots.length) return { go: 'spot', spot: spots[i] };
  if (i === spots.length) return { go: 'home' };
  if (i === spots.length + 1) return { go: 'door', door: rand() < 0.5 ? 'store' : 'saloon' };
  return { go: 'road' };
}

// a job wants someone: those already out and close are best, then someone indoors near the job's place (out of the
// nearest door); a person on their way somewhere is as good as one standing
export const lendCost = ({ out, d, door = 0 }) => (out ? d : d + door + 6);
