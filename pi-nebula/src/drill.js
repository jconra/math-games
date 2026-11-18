// THE DRILL OPERATOR'S GAME, the plain part: the rocks of the field, the ore inside each, what a hole takes, how many
// holes a rock stands, and the canisters filling. No page and no three.js, so node can test it
// (pi-nebula/tests/drill.test.mjs). src/drillview.js draws it and takes the taps; src/jobs/drill.js is the question
// asked as a rock is scanned; src/trip.js runs it at the asteroid field for a crew member who signed for the drill
// (src/missions.js), and pi-nebula/labs/drill/ runs it by itself.
//
// THE GAME'S MAKER (2026-11-17): "you get a holographic overlay of asteroids around you, you get to pick one ... The
// pilot approaches it. It asks a math question about the ore fraction or estimated weight as it scans it. Then you
// point at the spots on the asteroid and the claw grabs it and wherever you click on it the drill makes a hole and it
// starts filling up your canisters ... You press a button when done and then click another asteroid ... The process
// repeats until your canisters are full." And: "I think finding the right asteroid should be fun, like 'Oh, a lot of
// copper in that one' and not be a math question." "It would be cool to be able to rotate the asteroid with the claw
// and then point at the area to drill. We don't necessarily need to deform the asteroid. But we should reduce the
// amount of the glowing ore inside from that area. Small rocks should probably float away from the drilling point.
// And eventually the rock should crumble to pieces. So you want to try to drill it in a smart spot so you can get the
// most out of it before it crumbles." "sometimes finding really rich asteroids that pay out double, but only 20% of
// the time." And once it could be played: "It seems like it would be more interesting with more types of ore in the
// rocks." "It is exciting to think you might get lucky with that big titanium rock."
//
// THE RULES, IN NUMBERS (DRILL below):
//   - A ROCK is a ball one unit across its radius (the picture scales it). Its ore lies in VEINS: each a string of
//     LUMPS, each lump a point inside the rock holding so much ore, counted in CANISTERS (1 fills one canister).
//     A small rock holds 0.7 to 1.1 canisters of ore in 1 or 2 veins, a middling one 1.1 to 1.7 in 2 or 3, a big one
//     1.7 to 2.4 in 2 to 4; times how rich it is: thin 0.7, fair 1, thick 1.35. The glow says both: a lump's glow is
//     as big and bright as the ore left in it.
//   - A HOLE goes from the tapped spot straight in to the rock's middle. It takes ore from every lump near its line:
//     all of a lump within 0.1 of the line, less and less out to 0.34, nothing past that (take()). So a hole down
//     the thick of a vein fills a lot, and a hole in bare rock wastes one.
//   - A ROCK STANDS SO MANY HOLES: small 4, middling 5, big 6. After the last it breaks up and is gone.
//   - THE SCAN'S QUESTION (src/jobs/drill.js), right at the first try: the drill is set just right for this rock, and
//     every lump in it gives a quarter more (DRILL.bonus). A miss changes nothing.
//   - A FIELD IS A MIX OF METALS (FIELD): of every 100 usual rocks 32 are iron, 26 nickel, 21 copper, 14 cobalt and 7
//     gold. The dearer the metal, the rarer its rocks, and the smaller and thinner-veined they are: iron comes in any
//     size and is often big and thick, gold only in small rocks, thin or fair. So choosing is "a lot of iron in that
//     one" against "a little gold in that one". Each rock has its own glow colour and its tag. The seven in reach
//     always show three metals or more, never more than three rocks of one, and something dearer than nickel.
//   - A STREAK: one usual rock in four also carries one short vein of a DEARER metal than its own (a streak of gold in
//     an iron rock), a third to half a canister of it, glowing in its own colour: its tag names both ("Fe Iron + Au").
//     A hole takes whatever lies near its line, so where the hole goes decides which metal comes out.
//   - THE CANISTERS: 8 (the Miner's). The run is over when they are full; ore past that stays in the rock. THE DRILL
//     SORTS THE ORE BY METAL as it comes, the dearest first along the row of canisters, and A CANISTER IS SOLD AS THE
//     METAL THERE IS MOST OF IN IT (canistersOf). So half a canister or more of a metal makes a canister of it, and a
//     little of a metal that never comes to half a canister is lost in its neighbour. The row of canisters on the
//     screen is exactly this: each canister's colours are what is in it.
//   - WHAT THE LOAD SELLS FOR is what is in it (src/jobs/smelter.js ORE_PRICE: a tonne of iron ore 1,600 credits,
//     nickel 2,400, copper 3,200, cobalt 4,000, gold 8,000; the rich rock's titanium 6,000). How many tonnes of ore
//     a canister holds is the jump out's, as before (src/missions.js).
//   - THE RICH ROCK: one field in five has one (src/missions.js RICH; rolled once a trip), a big thick rock of
//     titanium, with its own glow. ITS OWN CANISTERS PAY DOUBLE: a canister of titanium sells for twice what a
//     canister of a usual haul's ore does (6,000 credits a tonne against 3,000), and only the canisters filled from
//     it; the rest of the load sells as what it is.
import { METALS, CARRIES, RICH_METAL, ORE_PRICE } from './jobs/smelter.js';

export const DRILL = {
  cans: CARRIES,            // canisters to fill
  field: 7,                 // rocks in reach to choose from, at a time
  reach: 0.34,              // how far from a hole's line ore is taken (the rock's radius is 1)
  core: 0.1,                // within this of the line, all of a lump
  depth: 0.95,              // a hole goes this far in from the surface (nearly to the middle)
  bonus: 1.25,              // the scan's question right at the first try: every lump gives this much
  sizes: {
    small: { r: 0.82, holes: 4, veins: [1, 2], ore: [0.7, 1.1] },
    medium: { r: 1.0, holes: 5, veins: [2, 3], ore: [1.1, 1.7] },
    big: { r: 1.24, holes: 6, veins: [2, 4], ore: [1.7, 2.4] },
  },
  grades: { thin: 0.7, fair: 1, thick: 1.35 },
  rich: { size: 'big', grade: 'thick', more: 1.15 },
  streak: { chance: 0.25, ore: [0.34, 0.5], lumps: [3, 4] },   // a short vein of a dearer metal in a usual rock
};
// THE FIELD'S USUAL METALS: how often each is a rock's metal (of 100), and the rocks it comes in (a size and a grade
// picked from each list). The dearer the metal, the rarer, the smaller and the thinner.
export const FIELD = {
  iron: { often: 32, sizes: ['small', 'medium', 'big', 'big'], grades: ['thin', 'fair', 'fair', 'thick'] },
  nickel: { often: 26, sizes: ['small', 'medium', 'medium', 'big'], grades: ['thin', 'fair', 'fair', 'thick'] },
  copper: { often: 21, sizes: ['small', 'medium', 'medium', 'big'], grades: ['thin', 'thin', 'fair', 'thick'] },
  cobalt: { often: 14, sizes: ['small', 'small', 'medium'], grades: ['thin', 'fair', 'fair'] },
  gold: { often: 7, sizes: ['small'], grades: ['thin', 'thin', 'fair'] },
};
export const USUAL = Object.keys(FIELD);
// (a metal's place in the row of canisters: the dearest ore first)
const dearFirst = (a, b) => ORE_PRICE[b] - ORE_PRICE[a] || USUAL.indexOf(b) - USUAL.indexOf(a);
const byOften = (rand, names) => { const all = names.reduce((sum, m) => sum + FIELD[m].often, 0); let x = rand() * all; for (const m of names) { x -= FIELD[m].often; if (x < 0) return m; } return names[names.length - 1]; };
// each metal's glow (the game's maker's picture: gold amber, platinum white, copper teal) and its symbol for the tag
export const ORE = {
  iron: { sym: 'Fe', glow: '#ff4a36' }, nickel: { sym: 'Ni', glow: '#a4f36a' }, copper: { sym: 'Cu', glow: '#2fe3cf' },
  cobalt: { sym: 'Co', glow: '#5a8cff' }, titanium: { sym: 'Ti', glow: '#d6ccff' }, gold: { sym: 'Au', glow: '#ffc233' },
};
export const metalOf = (name) => METALS.find((m) => m.name === name) || METALS[0];

// a random number maker from a seed (the same field again for the same seed: the tests, the lab's "the same field")
export function seeded(seed = 1) {
  let a = (Math.floor(seed) >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const between = (rand, [lo, hi]) => lo + rand() * (hi - lo);
const whole = (rand, [lo, hi]) => lo + Math.floor(rand() * (hi - lo + 1));
const unit = (rand) => { const z = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(Math.max(0, 1 - z * z)); return [s * Math.cos(a), z, s * Math.sin(a)]; };
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const norm = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

let made = 0;
// A ROCK: { id, size, grade, metal, also (the metal of its streak, or null), rich, r (its radius as drawn, of a
// middling rock's), holes (it stands), left (holes left), lumps: [{ p: [x, y, z], ore, ore0, vein, metal }], ore0
// (what it held at first, canisters, its streak with it), made: [[x, y, z]] (its holes), tuned (the scan's question
// was right at the first try), broken, shape (a number for its look) }
// also: the metal of a streak to put in it (one short vein more, of that metal)
export function makeRock(rand = Math.random, { metal = 'iron', size = null, grade = null, rich = false, also = null } = {}) {
  if (rich) { size = DRILL.rich.size; grade = DRILL.rich.grade; metal = RICH_METAL; also = null; }
  size = size || ['small', 'medium', 'medium', 'big'][Math.floor(rand() * 4)];
  grade = grade || ['thin', 'fair', 'fair', 'thick'][Math.floor(rand() * 4)];
  const S = DRILL.sizes[size], total = between(rand, S.ore) * DRILL.grades[grade] * (rich ? DRILL.rich.more : 1);
  const lumps = [], nv = whole(rand, S.veins);
  // a vein: a string of lumps from a point inside the rock, wandering, kept inside it
  const vein = (v, n, of) => {
    let d = unit(rand), p = d.map((x) => x * between(rand, [0.2, 0.62]));
    d = unit(rand);
    for (let i = 0; i < n; i++) {
      lumps.push({ p: [...p], w: between(rand, [0.6, 1.4]), vein: v, metal: of });
      const j = unit(rand); d = norm([d[0] + j[0] * 0.45, d[1] + j[1] * 0.45, d[2] + j[2] * 0.45]);
      let q = [p[0] + d[0] * 0.2, p[1] + d[1] * 0.2, p[2] + d[2] * 0.2];
      if (len(q) > 0.72) { const c = norm(q); d = norm([d[0] - 1.6 * c[0], d[1] - 1.6 * c[1], d[2] - 1.6 * c[2]]); q = [p[0] + d[0] * 0.2, p[1] + d[1] * 0.2, p[2] + d[2] * 0.2]; if (len(q) > 0.72) q = norm(q).map((x) => x * 0.72); }
      p = q;
    }
  };
  for (let v = 0; v < nv; v++) vein(v, whole(rand, [4, 6]), metal);
  const sum = lumps.reduce((s, L) => s + L.w, 0);
  for (const L of lumps) { L.ore = L.ore0 = total * L.w / sum; delete L.w; }
  // (its streak: one short vein more, of the dearer metal)
  let more = 0;
  if (also && also !== metal) {
    const at = lumps.length; more = between(rand, DRILL.streak.ore); vein(nv, whole(rand, DRILL.streak.lumps), also);
    const mine = lumps.slice(at), ws = mine.reduce((s, L) => s + L.w, 0);
    for (const L of mine) { L.ore = L.ore0 = more * L.w / ws; delete L.w; }
  } else also = null;
  return { id: ++made, size, grade, metal, also, rich: !!rich, r: S.r, holes: S.holes, left: S.holes, lumps, ore0: total + more, made: [], tuned: false, broken: false, shape: Math.floor(rand() * 1e6) };
}
export const oreLeft = (rock) => rock.lumps.reduce((s, L) => s + L.ore, 0);
// the ore left in a rock, metal by metal: { copper: 1.2, gold: 0.4 }
export const oreBy = (rock) => { const by = {}; for (const L of rock.lumps) { const m = L.metal || rock.metal; by[m] = (by[m] || 0) + L.ore; } return by; };
// A USUAL ROCK OF THE FIELD: its metal by how often each comes (or the one asked for), its size and grade from that
// metal's own, and one time in four a streak of a dearer metal
export function fieldRock(rand = Math.random, { metal = null, streak = true } = {}) {
  const m = metal || byOften(rand, USUAL), F = FIELD[m] || FIELD.iron, dearer = USUAL.filter((x) => ORE_PRICE[x] > ORE_PRICE[m]);
  const size = F.sizes[Math.floor(rand() * F.sizes.length)], grade = F.grades[Math.floor(rand() * F.grades.length)];
  const also = streak && dearer.length && rand() < DRILL.streak.chance ? byOften(rand, dearer) : null;
  return makeRock(rand, { metal: m, size, grade, also });
}

// how far a point is from a hole's line (the hole from the spot `dir` on the surface, a unit direction, straight in)
function offLine(p, dir) {
  const t = Math.max(1 - DRILL.depth, Math.min(1, p[0] * dir[0] + p[1] * dir[1] + p[2] * dir[2]));
  return Math.hypot(p[0] - dir[0] * t, p[1] - dir[1] * t, p[2] - dir[2] * t);
}
// the part of a lump a hole takes, by how far the lump is from the hole's line: 1 .. 0
export function take(dist) {
  const { reach, core } = DRILL;
  return dist <= core ? 1 : dist >= reach ? 0 : (reach - dist) / (reach - core);
}
// what a hole at `dir` WOULD take from the rock as it is now, in canisters (nothing changes)
export function holeWorth(rock, dir) {
  const d = norm(dir); let s = 0;
  for (const L of rock.lumps) s += L.ore * take(offLine(L.p, d));
  return s;
}
// A HOLE DRILLED at `dir` (a direction from the rock's middle; any length). room: the canisters' room left (ore past
// it stays in the rock). -> { took (canisters), wasted (it found next to nothing), left (holes left), broke } or null
// (the rock stands no more holes)
// (and `by`: what it took metal by metal, { iron: 0.4, gold: 0.2 })
export function drillHole(rock, dir, room = Infinity) {
  if (rock.broken || rock.left <= 0) return null;
  const d = norm(dir), worth = holeWorth(rock, d), k = worth > room ? room / worth : 1, by = {};
  let took = 0;
  for (const L of rock.lumps) { const t = L.ore * take(offLine(L.p, d)) * k; if (t <= 0) continue; L.ore -= t; took += t; const m = L.metal || rock.metal; by[m] = (by[m] || 0) + t; }
  rock.made.push(d); rock.left--;
  if (rock.left <= 0) rock.broken = true;
  return { took, by, wasted: worth < 0.05, left: rock.left, broke: rock.broken };
}
// the scan's question answered: right at the first try, every lump gives a quarter more
export function tune(rock, first) {
  if (rock.tuned || !first) return false;
  rock.tuned = true;
  for (const L of rock.lumps) L.ore *= DRILL.bonus;
  return true;
}
// what a canister of each metal's ore sells for, when each canister holds a/d of a tonne of ore
export const canPrice = (metal, [a, d] = [3, 4]) => (ORE_PRICE[metal] || 0) * a / d;
// what a load sells for (its canisters by metal's name, each a/d of a tonne of ore): the same sum as the smelter's
export const loadSells = (load, ore = [3, 4]) => load.reduce((sum, m) => sum + canPrice(m, ore), 0);
// the best spot to drill now, of `n` tried all round the rock (the tests' careful driller, the rigs, the lab's hint)
export function bestHole(rock, n = 240) {
  let best = null, top = -1;
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653, d = [r * Math.cos(a), y, r * Math.sin(a)], w = holeWorth(rock, d);
    if (w > top) { top = w; best = d; }
  }
  return { dir: best, worth: top };
}

// THE FIELD: the rocks in reach, each in a place of its own (slot 0 .. DRILL.field - 1: the picture knows where each
// is). A mix of metals (FIELD): three metals or more among the seven, never more than three rocks of one, and
// something dearer than nickel to tempt. rich: this field has the rich rock (it is among the first in reach, never
// in the nearest place). A rock worked is gone, and another drifts into its place (makeRun).
// metal: every usual rock of that one metal, no streaks (the Drill Lab's "only": the field as it was at first).
export function makeField(rand = Math.random, { metal = null, rich = false } = {}) {
  const rocks = [], richAt = rich ? 1 + Math.floor(rand() * (DRILL.field - 1)) : -1;
  if (metal) {
    // (a spread of sizes and grades, so there is always something to choose between)
    const SIZES = ['small', 'medium', 'big', 'medium', 'small', 'big', 'medium'], GRADES = ['fair', 'thin', 'fair', 'thick', 'fair', 'thin', 'thick'], turn = Math.floor(rand() * 7);
    for (let i = 0; i < DRILL.field; i++) rocks.push(i === richAt ? makeRock(rand, { rich: true }) : makeRock(rand, { metal, size: SIZES[(i + turn) % 7], grade: GRADES[(i * 3 + turn) % 7] }));
  } else {
    // (the metals first, drawn until the seven are a fair spread; then a rock of each)
    let names = [];
    for (let tries = 0; tries < 60; tries++) {
      names = Array.from({ length: DRILL.field }, () => byOften(rand, USUAL));
      const count = {}; for (const m of names) count[m] = (count[m] || 0) + 1;
      if (Object.keys(count).length >= 3 && Math.max(...Object.values(count)) <= 3 && names.some((m) => ORE_PRICE[m] > ORE_PRICE.nickel)) break;
      if (tries === 59) names = ['iron', 'nickel', 'copper', 'iron', 'cobalt', 'nickel', 'copper'];
    }
    for (let i = 0; i < DRILL.field; i++) rocks.push(i === richAt ? makeRock(rand, { rich: true }) : fieldRock(rand, { metal: names[i] }));
  }
  rocks.forEach((rock, i) => { rock.slot = i; });
  return rocks;
}

// THE CANISTERS, from the ore aboard metal by metal ({ copper: 2.6, gold: 0.7 }, in canisters): the drill sorts the
// ore by metal, the dearest first along the row, and each canister is sold as the metal there is most of in it (of
// two the same, the dearer). -> [{ fill (0 .. 1), parts: [[metal, how much], ...] (dearest first), metal (the most
// of it, or null: empty) }], DRILL.cans of them
export function canistersOf(ore, n = DRILL.cans) {
  const order = Object.keys(ore).filter((m) => ore[m] > 1e-9).sort(dearFirst), out = [];
  let k = 0, used = 0;      // (the metal being poured, and how much of it is in canisters already)
  for (let i = 0; i < n; i++) {
    const parts = []; let room = 1;
    while (room > 1e-9 && k < order.length) {
      const m = order[k], left = ore[m] - used, t = Math.min(room, left);
      if (t > 1e-9) { parts.push([m, t]); room -= t; used += t; }
      if (ore[m] - used <= 1e-9) { k++; used = 0; }
    }
    let top = null; for (const [m, t] of parts) if (!top || t > top[1] + 1e-9) top = [m, t];
    out.push({ fill: Math.min(1, 1 - room), parts, metal: top ? top[0] : null });
  }
  return out;
}

// A RUN OF THE GAME: the field, the rock in the claw, the canisters.
//   const R = makeRun({ rand, metal, rich })       metal: a field of that one metal only (else the mix)
//   R.stage    'look' (choosing a rock) | 'scan' (a rock in the claw, its question up) | 'drill' | 'full' (done)
//   R.pick(id) -> the rock (look -> scan);  R.scanned(first) -> tuned? (scan -> drill)
//   R.drill(dir) -> what drillHole gives, with { cans, full, done } (the rock broken or the canisters full: on to
//                   'look' or 'full' by itself);  R.letGo() the rock let go early (drill -> look)
//   R.cans (ore aboard, in canisters, 0 .. 8), R.full (whole canisters full), R.ore (the ore aboard metal by metal),
//   R.row() (the canisters as they are: canistersOf), R.load() (the metal each canister is sold as, by name: the
//   haul's facts once full), R.rich (ore of the rich rock is aboard), R.rocks (in reach), R.held,
//   R.stats { rocks, holes, wasted, tuned }
export function makeRun({ rand = Math.random, metal = null, rich = false } = {}) {
  const R = { stage: 'look', cans: 0, ore: {}, rich: false, richField: !!rich, metal, rocks: makeField(rand, { metal, rich }), held: null, stats: { rocks: 0, holes: 0, wasted: 0, tuned: 0 } };
  const EPS = 1e-6;
  Object.defineProperty(R, 'full', { get: () => Math.min(DRILL.cans, Math.floor(R.cans + EPS)) });
  R.row = () => canistersOf(R.ore);
  R.load = () => R.row().map((c) => c.metal);
  function gone(rock) {
    // (its place taken by another: one drifts in)
    const i = R.rocks.indexOf(rock); if (i < 0) return;
    const next = metal ? makeRock(rand, { metal }) : fieldRock(rand); next.slot = rock.slot; next.fresh = true; R.rocks[i] = next;
  }
  R.pick = (id) => { if (R.stage !== 'look') return null; const rock = R.rocks.find((r) => r.id === id); if (!rock) return null; R.held = rock; R.stage = 'scan'; R.stats.rocks++; return rock; };
  R.scanned = (first = false) => { if (R.stage !== 'scan') return false; const t = tune(R.held, !!first); if (t) R.stats.tuned++; R.stage = 'drill'; return t; };
  R.letGo = () => { if (R.stage !== 'drill' && R.stage !== 'scan') return false; gone(R.held); R.held = null; R.stage = 'look'; return true; };
  R.drill = (dir) => {
    if (R.stage !== 'drill' || !R.held) return null;
    const rock = R.held, h = drillHole(rock, dir, DRILL.cans - R.cans); if (!h) return null;
    R.cans = Math.min(DRILL.cans, R.cans + h.took); R.stats.holes++; if (h.wasted) R.stats.wasted++;
    for (const [m, t] of Object.entries(h.by)) R.ore[m] = (R.ore[m] || 0) + t;
    if (rock.rich && h.took > 0.01) R.rich = true;
    const done = R.cans >= DRILL.cans - EPS;
    if (done) {
      // (the last hair's breadth made up, so the canisters are exactly full)
      const sum = Object.values(R.ore).reduce((a, b) => a + b, 0); if (sum > 0) for (const m of Object.keys(R.ore)) R.ore[m] *= DRILL.cans / sum;
      R.cans = DRILL.cans; R.stage = 'full';
    } else if (h.broke) { gone(rock); R.held = null; R.stage = 'look'; }
    return { ...h, cans: R.cans, full: R.full, done, rock };
  };
  return R;
}
