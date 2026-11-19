// THE DRILL OPERATOR'S GAME, the plain part: the rocks of the field, the metal inside each, what a hole takes, how many
// holes a rock stands, and the canisters filling. No page and no three.js, so node can test it
// (pi-nebula/tests/drill.test.mjs). src/drillview.js draws it and takes the taps; src/jobs/drill.js is the question
// asked when a rock is in the claw; src/trip.js runs it at the asteroid field for a crew member who signed for the
// drill (src/missions.js), and pi-nebula/labs/drill/ runs it by itself.
//
// THE GAME'S MAKER (2026-11-18, the game in his words): "The game should be you arrive at the asteroid field, and you
// find juicy asteroids that have metal that you want. You drill it, and it starts filling up your canisters. You
// answer questions, if you get it wrong it just teaches you." "the canister is sold for the value of each metal that
// it contains." "Let them see a rock with a bunch of what they want and let them get excited. Don't tell them to get
// excited." "I'd prefer it if you could fly around and find them, instead of being presented with 7 in the same way
// each time." And (2026-11-17): "We don't necessarily need to deform the asteroid. But we should reduce the amount of
// the glowing ore inside from that area. Small rocks should probably float away from the drilling point. And
// eventually the rock should crumble to pieces. So you want to try to drill it in a smart spot so you can get the most
// out of it before it crumbles."
//
// THE CANISTERS DO NOT MIX ORE (his words of 2026-11-18, later the same day; they replace that morning's "the canisters
// all fill as a collective ... Just treat the storage as one"): "we could make it so the canisters don't mix ore. So
// if you collect 3 metals then it will dedicate 3 canisters to that type. If one fills up, like iron, then it gets
// another canister. Once each canister is designated then you can't except any new types of ore. At that point the
// player would want to top off all the canisters to finish the mission. If they go back early (I think that should be
// an option) and the canisters aren't all the way full, then I think we should round the level to the nearest 1/8th to
// make the math easier. I feel like the math would be a lot more straightforward if we said each canister holds a
// tonne, so we could use them interchangeably." And his go-ahead: "Yeah it replaces "the canisters all fill as a
// collective". My main goal with that train of thought is that I want to be able to drill a rock that has 4 different
// ores in it and get them all. ... I think it might make it easier to do the math questions if each canister gets
// designated per metal. If there are no canisters empty then yes a new metal cannot be accepted, unless we add an
// option to purge a canister. But I'd say it should stay in the rock or float out as small derbies." (No purge is
// made: he only mentioned it.)
//
// THE RULES, IN NUMBERS (DRILL, SHAPES and KINDS below). There is nothing here but these: no answer to any question
// changes what a rock gives or what comes home.
//   - A ROCK has real numbers of its own, and they are the same wherever they are said (the scan's readout, the card
//     asked when it is in the claw, the canisters): the box that just holds it (so long, wide and high, in metres),
//     what a cubic metre of it weighs, its WEIGHT in tonnes (half its box, times that: a lumpy rock fills about half
//     the box round it), the PART OF IT THAT IS ORE (a half, a quarter, a fifth or a tenth), and so the tonnes of ore
//     in it, always a whole number of tonnes, of one, two, three or four metals, a whole number of tonnes of each.
//   - ITS ORE LIES IN VEINS: each vein is one metal's, a string of LUMPS (the same number in every vein of a rock),
//     each lump a point inside the rock holding so much of that metal. The glow is the lumps: a lump's colour is its
//     metal, and it is as big and bright as the metal left in it.
//   - A HOLE goes from the tapped spot straight in to the rock's middle. It finds metal in every lump near its line:
//     all of a lump within 0.1 of the line (the rock's radius is 1), less and less out to 0.34, nothing past that
//     (take()). So a hole down the thick of a vein finds a lot, and a hole in bare rock finds nothing. What it finds
//     of each metal is weighed in as whole hundredths of a tonne (ten kilograms); any less than that stays in the
//     rock. So the rock, the canisters and the payout all count the same exact amounts.
//   - A ROCK STANDS SO MANY HOLES: a flat one 4, a round one 5, a long one 6. After the last it crumbles and is gone.
//   - THE CANISTERS: the Miner carries 8, and a canister holds one tonne of ONE metal (stow()). A canister is given to
//     a metal the first time that metal comes aboard. A metal goes into its own part-full canister; when that one is
//     full and more of the metal comes, the next empty canister is given to it. With no empty canister left, a metal
//     with no room in a canister of its own is not taken: IT STAYS IN THE ROCK (the plainer of his two ways as the
//     code stood: the lumps near the hole keep it, and their glow stays). A hole that finds more of a metal than
//     there is room for takes exactly the room. When one hole finds two metals that both want the last empty canister,
//     the one it found more of gets it. THE ROW OF 8 on the screen is the canisters themselves, each its metal's
//     colour at its own level.
//   - THE RUN IS OVER BY ITSELF WHEN ALL EIGHT ARE FULL. Nothing is rounded then, or at any time during the run.
//   - HEADING HOME EARLY (home()): with what is aboard. Each part-full canister's level is rounded to the nearest 1/8
//     of a tonne, and that rounded load is what comes home: the payout, the hangar's canisters and the smelter's slips
//     all count it. A canister that rounds to nothing comes home empty.
//   - WHAT THE LOAD SELLS FOR: each metal's tonnes times what a tonne of it sells for, added up (src/jobs/smelter.js
//     sellsFor, the one price list).
//   - THE FIELD is a place: thirty rocks scattered through the planet's rings, each where it is (pos, metres from where
//     the ship comes out of its jump, at the field's near edge with the rocks ahead of it), a different field every trip. Which metals are in a rock is drawn by how common
//     each is (ODDS): iron most, gold least. So rocks differ by themselves, and now and then one holds a lot of a dear
//     metal; nothing says so but its glow. A rock worked is gone. Should the rocks ever run low, there are more further
//     out (the rings do not run out).
import { METALS, ORE, CARRIES, CAN_TONNES, HOLD, priceOf, sellsFor } from './jobs/smelter.js';

export const DRILL = {
  cans: CARRIES,            // canisters, each one metal's
  hold: HOLD,               // tonnes of metal they hold together
  can: CAN_TONNES,          // tonnes a canister holds: one
  eighths: 8,               // heading home early, a part-full canister's level is rounded to the nearest 1/8 of a tonne
  field: 30,                // rocks in a field
  four: 1 / 3,              // of the rocks with four tonnes of ore or more (about one rock in five), the part that holds four metals
  reach: 0.34,              // how far from a hole's line metal is taken (the rock's radius is 1)
  core: 0.1,                // within this of the line, all of a lump
  depth: 0.95,              // a hole goes this far in from the surface (nearly to the middle)
  wide: 200, ahead: 170, near: 34, thick: 46, apart: 16,   // the field: metres out from its middle, how far ahead of where the ship arrives its middle is, the nearest a rock lies to the ship's place, top to bottom, the least between two rocks
};
// A ROCK'S SHAPE: the box that just holds it (metres: long, wide, high), how it is drawn (its three half-lengths, of a
// round rock's), and the holes it stands. A long rock's long way is its own z, which is the way the claw's hand holds
// it (along the hand); a flat rock's thin way is its own x (across the hand, so the fingers shut on its two faces).
export const SHAPES = {
  flat: { box: [2, 2, 1], sq: [0.52, 1, 1], holes: 4, word: 'a flat rock' },
  round: { box: [2, 2, 2], sq: [1, 1, 1], holes: 5, word: 'a round rock' },
  long: { box: [3, 2, 2], sq: [1, 1, 1.5], holes: 6, word: 'a long rock' },
};
// THE KINDS OF ROCK there are: [shape, tonnes a cubic metre of it weighs, the part of it that is ore (one part in so
// many), how common]. Its weight is half its box times what a cubic metre weighs; its ore is that part of its weight.
// Only kinds whose ore is a whole number of tonnes, and whose part is as easy said as a fraction or as a percent.
//   flat (box 4 cubic metres)    4 t: 1 or 2 of ore; 6 t: 3; 8 t: 2; 10 t: 1 or 2
//   round (box 8)                8 t: 2 or 4; 12 t: 3; 16 t: 4; 20 t: 2, 4 or 5
//   long (box 12)                12 t: 3; 24 t: 6; 30 t: 3 or 6
export const KINDS = [
  ['flat', 2, 4, 5], ['flat', 5, 10, 5], ['flat', 2, 2, 2], ['flat', 4, 4, 4], ['flat', 5, 5, 4], ['flat', 3, 2, 1],
  ['round', 2, 4, 5], ['round', 5, 10, 5], ['round', 3, 4, 5], ['round', 4, 4, 3], ['round', 5, 5, 3], ['round', 2, 2, 1], ['round', 5, 4, 1],
  ['long', 2, 4, 4], ['long', 5, 10, 4], ['long', 4, 4, 1], ['long', 5, 5, 1],
];
// HOW COMMON EACH METAL IS in the field's rocks (of 100 tonnes of ore): the dearer, the rarer
export const ODDS = { iron: 48, nickel: 25, copper: 14, cobalt: 7, titanium: 4, gold: 2 };
export const NAMES = METALS.map((m) => m.name);
// each metal's glow (the game's maker's picture: gold amber, copper teal) and its symbol: kept with the one list of
// the metals (src/jobs/smelter.js ORE), handed on here
export { ORE };
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
const byWeight = (rand, list, w) => { let x = rand() * list.reduce((s, k) => s + w(k), 0); for (const k of list) { x -= w(k); if (x < 0) return k; } return list[list.length - 1]; };
const r2 = (x) => Math.round(x * 100) / 100;

let made = 0;
// A ROCK: { id, shape, box [long, wide, high], vol (its box, cubic metres), per (tonnes a cubic metre of it weighs),
// weight (tonnes), part (one part in so many of it is ore), ore0 (tonnes of ore at first), metals ({ iron: 2, gold: 1 }:
// tonnes of each at first), veins [{ metal, tonnes, lumps }], each (lumps in every vein), holes (it stands), left
// (holes left), lumps: [{ p: [x, y, z], ore, ore0, vein, metal }], made: [[x, y, z]] (its holes), broken, look (a
// number for its look), pos ([x, y, z]: where it lies in the field), scanned (the full scan has read it) }
//   kind: one of KINDS (else drawn by how common); metals: { name: whole tonnes } to put in it (else drawn by ODDS)
export function makeRock(rand = Math.random, { kind = null, metals = null } = {}) {
  const [shape, per, part] = kind || byWeight(rand, KINDS, (k) => k[3]), S = SHAPES[shape];
  const vol = S.box[0] * S.box[1] * S.box[2], weight = vol / 2 * per, total = weight / part;
  // its metals: one, two or three (never more metals than it has tonnes of ore); a rock with four tonnes of ore or
  // more holds FOUR one time in three (DRILL.four). A whole number of tonnes of each
  let M = metals ? { ...metals } : null;
  if (!M) {
    const x = rand(), k = total >= 4 && rand() < DRILL.four ? 4 : Math.min(total, x < 0.45 ? 1 : x < 0.85 ? 2 : 3), names = [];
    while (names.length < k) { const m = byWeight(rand, NAMES.filter((n) => !names.includes(n)), (n) => ODDS[n]); names.push(m); }
    const t = names.map(() => 1); for (let left = total - k; left > 0; left--) t[Math.floor(rand() * k)]++;
    // (the most of it first)
    M = Object.fromEntries(names.map((m, i) => [m, t[i]]).sort((a, b) => b[1] - a[1]));
  }
  // its veins: the first metal in two veins, the others in one each or two (five veins at the most), a vein's tonnes
  // in tenths; a metal in two veins lies in two unlike amounts, neither a whole number of tonnes
  const names = Object.keys(M), veins = [];
  names.forEach((m, i) => {
    const t10 = Math.round(M[m] * 10), room = 5 - veins.length - (names.length - 1 - i), two = room >= 2 && (i === 0 || rand() < 0.4);
    if (!two) { veins.push({ metal: m, tonnes: t10 / 10 }); return; }
    let a = 3; for (let tries = 0; tries < 30; tries++) { a = whole(rand, [3, t10 - 3]); if (a % 10 && (t10 - a) % 10 && a !== t10 - a) break; }
    veins.push({ metal: m, tonnes: Math.max(a, t10 - a) / 10 }, { metal: m, tonnes: Math.min(a, t10 - a) / 10 });
  });
  const each = whole(rand, [3, 5]), lumps = [];
  // a vein: a string of lumps from a point inside the rock, wandering, kept inside it
  veins.forEach((V, v) => {
    V.lumps = each;
    let d = unit(rand), p = d.map((x) => x * between(rand, [0.2, 0.62]));
    d = unit(rand);
    const mine = [];
    for (let i = 0; i < each; i++) {
      mine.push({ p: [...p], w: between(rand, [0.6, 1.4]), vein: v, metal: V.metal });
      const j = unit(rand); d = norm([d[0] + j[0] * 0.45, d[1] + j[1] * 0.45, d[2] + j[2] * 0.45]);
      let q = [p[0] + d[0] * 0.2, p[1] + d[1] * 0.2, p[2] + d[2] * 0.2];
      if (len(q) > 0.72) { const c = norm(q); d = norm([d[0] - 1.6 * c[0], d[1] - 1.6 * c[1], d[2] - 1.6 * c[2]]); q = [p[0] + d[0] * 0.2, p[1] + d[1] * 0.2, p[2] + d[2] * 0.2]; if (len(q) > 0.72) q = norm(q).map((x) => x * 0.72); }
      p = q;
    }
    const sum = mine.reduce((s, L) => s + L.w, 0);
    for (const L of mine) { L.ore = L.ore0 = V.tonnes * L.w / sum; delete L.w; lumps.push(L); }
  });
  return { id: ++made, shape, box: [...S.box], vol, per, weight, part, ore0: total, metals: M, veins, each, holes: S.holes, left: S.holes, lumps, made: [], broken: false, look: Math.floor(rand() * 1e6), pos: [0, 0, 0], scanned: false };
}
export const oreLeft = (rock) => rock.lumps.reduce((s, L) => s + L.ore, 0);
// the metal left in a rock, metal by metal, in tonnes: { copper: 1.2, gold: 0.4 }
export const oreBy = (rock) => { const by = {}; for (const L of rock.lumps) by[L.metal] = (by[L.metal] || 0) + L.ore; return by; };
// THE FULL SCAN'S READOUT: exactly how many tonnes of each metal the rock holds now, the most first (to the hundredth
// of a tonne: a rock nobody has drilled reads its whole tonnes)
export function scanOf(rock) {
  const by = oreBy(rock);
  return NAMES.filter((m) => r2(by[m] || 0) > 0).map((m) => ({ metal: m, tonnes: r2(by[m]) })).sort((a, b) => b.tonnes - a.tonnes || priceOf(b.metal) - priceOf(a.metal));
}
// what the metal in a rock would sell for, all of it (the one price list)
export const rockSells = (rock) => sellsFor(oreBy(rock)).pay;

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
// ── THE CANISTERS: [{ metal: null | 'iron' ..., t: tonnes in it, 0 .. 1 }], DRILL.cans of them. One metal to a canister.
// During a run a level is whole hundredths of a tonne; home early, whole eighths (roundCans) ──
const EPS = 1e-6, h100 = (t) => Math.round(t * 100);
export const emptyCans = (n = DRILL.cans) => Array.from({ length: n }, () => ({ metal: null, t: 0 }));
const isFull = (c) => c.t >= DRILL.can - EPS;
// WHAT THE CANISTERS TAKE of what a hole found (found: { iron: 0.4, gold: 0.2 }, whole hundredths of a tonne). Each
// metal into its own part-full canister; that one full, the next empty canister is given to it; no empty one left,
// the rest of it is not taken. The metal there is most of first (of two alike, the chart's order), so of two metals
// that both want the last empty canister the one the hole found more of gets it. The canisters are changed.
// -> { by: what came aboard ({ iron: 0.4 }), stays: what did not, for want of a canister ({ gold: 0.2 }) }
export function stow(cans, found) {
  const by = {}, stays = {};
  const order = Object.keys(found).filter((m) => h100(found[m]) > 0).sort((p, q) => h100(found[q]) - h100(found[p]) || NAMES.indexOf(p) - NAMES.indexOf(q));
  for (const m of order) {
    const all = h100(found[m]); let n = all;
    while (n > 0) {
      const c = cans.find((q) => q.metal === m && !isFull(q)) || cans.find((q) => !q.metal);
      if (!c) break;
      const k = Math.min(n, h100(DRILL.can) - h100(c.t));
      c.metal = m; c.t = (h100(c.t) + k) / 100; n -= k;
    }
    if (all - n > 0) by[m] = (all - n) / 100;
    if (n > 0) stays[m] = n / 100;
  }
  return { by, stays };
}
// how much of a metal the canisters could take now, in tonnes: the room in its own part-full canister, and every
// empty canister
export const roomFor = (cans, metal) => cans.reduce((s, c) => s + (!c.metal ? DRILL.can : c.metal === metal ? DRILL.can - c.t : 0), 0);
// THE TONNES OF EACH METAL ABOARD: its canisters added up, in the chart's order ({ iron: 2.4, gold: 0.6 })
export function storeOf(cans) {
  const by = {};
  for (const c of cans) if (c.metal && c.t > EPS) by[c.metal] = (by[c.metal] || 0) + c.t;
  return Object.fromEntries(NAMES.filter((m) => by[m]).map((m) => [m, Math.round(by[m] * 1000) / 1000]));
}
// HOME EARLY: each part-full canister's level rounded to the nearest 1/8 of a tonne (a full one stays full; one that
// rounds to nothing is empty, and no metal's). -> new canisters
export function roundCans(cans) {
  const n = DRILL.eighths;
  return cans.map((c) => { const t = c.metal ? Math.round(c.t * n + EPS) / n : 0; return t > 0 ? { metal: c.metal, t } : { metal: null, t: 0 }; });
}

// what a hole at `dir` finds near its line in the rock as it is now, metal by metal, in tonnes (nothing changes)
function holeFinds(rock, d) {
  const parts = rock.lumps.map((L) => L.ore * take(offLine(L.p, d))), near = {};
  rock.lumps.forEach((L, i) => { if (parts[i] > 0) near[L.metal] = (near[L.metal] || 0) + parts[i]; });
  return { parts, near };
}
// ... in whole hundredths of a tonne of each metal (any less of one stays in the rock)
const weighed = (near) => { const out = {}; for (const [m, t] of Object.entries(near)) { const n = Math.floor(t * 100 + 1e-7); if (n > 0) out[m] = n / 100; } return out; };
// what a hole at `dir` WOULD take from the rock as it is now, in tonnes (nothing changes). cans: the canisters as
// they are (then: what of it would come aboard); none: all that is near its line
export function holeWorth(rock, dir, cans = null) {
  const d = norm(dir);
  if (!cans) { let s = 0; for (const L of rock.lumps) s += L.ore * take(offLine(L.p, d)); return s; }
  return Object.values(stow(cans.map((c) => ({ ...c })), weighed(holeFinds(rock, d).near)).by).reduce((a, b) => a + b, 0);
}
// A HOLE DRILLED at `dir` (a direction from the rock's middle; any length). cans: the canisters (stow: what they
// take comes aboard, and they are changed; what they do not take stays in the rock); none: all of it is taken. What
// it takes of each metal is whole hundredths of a tonne; the rest of what lay near its line stays in the rock's
// lumps. -> { took (tonnes), by (metal by metal: { iron: 0.4, gold: 0.2 }), stays (found, and not taken for want of a
// canister: { cobalt: 0.3 }), bare (it found next to nothing), left (holes left), broke } or null (the rock stands no
// more holes)
export function drillHole(rock, dir, cans = null) {
  if (rock.broken || rock.left <= 0) return null;
  const d = norm(dir), { parts, near } = holeFinds(rock, d), found = weighed(near);
  const worth = Object.values(near).reduce((a, b) => a + b, 0), { by, stays } = cans ? stow(cans, found) : { by: found, stays: {} }, keep = {};
  let h = 0;      // (hundredths of a tonne taken, all metals)
  for (const [m, t] of Object.entries(near)) { keep[m] = (by[m] || 0) / t; h += h100(by[m] || 0); }
  rock.lumps.forEach((L, i) => { if (parts[i] > 0) L.ore -= parts[i] * keep[L.metal]; });
  rock.made.push(d); rock.left--;
  if (rock.left <= 0) rock.broken = true;
  return { took: h / 100, by, stays, bare: worth < 0.03, left: rock.left, broke: rock.broken };
}
// the best spot to drill now, of `n` tried all round the rock (the tests' careful driller, the rigs, the crew's own
// driller); worth(dir): how good a spot is (else the tonnes it would take)
export function bestHole(rock, n = 240, worth = (d) => holeWorth(rock, d)) {
  let best = null, top = -1;
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653, d = [r * Math.cos(a), y, r * Math.sin(a)], w = worth(d);
    if (w > top) { top = w; best = d; }
  }
  return { dir: best, worth: top };
}

// THE FIELD: its rocks, each in a place of its own (pos: metres from where the ship comes out of its jump, x across,
// y up out of the rings' plane, z ahead). A flat round slab of them, its middle DRILL.ahead in front of the ship's
// place, so the ship arrives at its near edge looking into it; none nearer than DRILL.near to the ship's place, no two
// closer than DRILL.apart. Drawn afresh each time: a different field every trip.
//   n: how many; from, to: how far out from the field's middle they lie (the first field: 0 to DRILL.wide); others:
//   rocks to keep clear of
export function makeField(rand = Math.random, { n = DRILL.field, from = 0, to = DRILL.wide, others = [] } = {}) {
  const rocks = [], far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (let i = 0; i < n; i++) {
    const rock = makeRock(rand);
    for (let tries = 0; tries < 80; tries++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(from * from + rand() * (to * to - from * from));
      rock.pos = [r2(Math.sin(a) * d), r2((rand() - 0.5) * DRILL.thick), r2(DRILL.ahead + Math.cos(a) * d)];
      if (far(rock.pos, [0, 0, 0]) >= DRILL.near && [...rocks, ...others].every((o) => far(o.pos, rock.pos) >= DRILL.apart)) break;
    }
    rocks.push(rock);
  }
  return rocks;
}

// A RUN OF THE GAME: the field, the rock in the claw, the canisters.
//   const R = makeRun({ rand })
//   R.stage    'look' (finding a rock) | 'ask' (a rock in the claw, its question up) | 'drill' | 'full' (all eight
//              canisters full: done) | 'home' (headed home early: done)
//   R.pick(id) -> the rock (look -> ask);  R.asked() (ask -> drill: the question is over, however it was answered)
//   R.drill(dir) -> what drillHole gives, with { aboard, full, done } (the rock crumbled or the canisters all full:
//                   on to 'look' or 'full' by itself);  R.letGo() the rock let go early (ask or drill -> look)
//   R.canHome() / R.home()   heading home early with what is aboard (there is something aboard to take): each
//                   part-full canister rounded to the nearest 1/8 of a tonne (-> 'home'; R.early says so)
//   R.cans (the canisters: [{ metal, t }]), R.aboard (tonnes in all, 0 .. 8), R.full (canisters full, 0 .. 8), R.given
//   (canisters given to a metal), R.ore and R.store() (the tonnes of each metal aboard), R.roomFor(metal), R.load()
//   (what comes home: { store, cans }), R.sells() (what it would sell for now), R.rocks (the field), R.held, R.stats
//   { rocks, holes, bare }
export function makeRun({ rand = Math.random } = {}) {
  const R = { stage: 'look', cans: emptyCans(), early: false, rocks: makeField(rand), held: null, stats: { rocks: 0, holes: 0, bare: 0 } };
  let rings = 0;
  Object.defineProperty(R, 'aboard', { get: () => Math.round(R.cans.reduce((s, c) => s + c.t, 0) * 1000) / 1000 });
  Object.defineProperty(R, 'full', { get: () => R.cans.filter(isFull).length });
  Object.defineProperty(R, 'given', { get: () => R.cans.filter((c) => c.metal).length });
  Object.defineProperty(R, 'ore', { get: () => storeOf(R.cans) });
  Object.defineProperty(R, 'done', { get: () => R.stage === 'full' || R.stage === 'home' });
  R.store = () => storeOf(R.cans);
  R.load = () => ({ store: storeOf(R.cans), cans: R.cans.map((c) => ({ ...c })) });
  R.sells = () => sellsFor(R.store()).pay;
  R.roomFor = (metal) => roomFor(R.cans, metal);
  function gone(rock) {
    const i = R.rocks.indexOf(rock); if (i >= 0) R.rocks.splice(i, 1);
    // (the rings do not run out: with few rocks left, there are more further out)
    if (R.rocks.length < 8) { rings++; R.rocks.push(...makeField(rand, { n: 12, from: DRILL.wide * (0.6 + 0.4 * rings), to: DRILL.wide * (1 + 0.4 * rings), others: R.rocks })); }
  }
  R.pick = (id) => { if (R.stage !== 'look') return null; const rock = R.rocks.find((r) => r.id === id); if (!rock) return null; R.held = rock; R.stage = 'ask'; R.stats.rocks++; return rock; };
  R.asked = () => { if (R.stage !== 'ask') return false; R.stage = 'drill'; return true; };
  R.letGo = () => { if (R.stage !== 'drill' && R.stage !== 'ask') return false; gone(R.held); R.held = null; R.stage = 'look'; return true; };
  R.drill = (dir) => {
    if (R.stage !== 'drill' || !R.held) return null;
    const rock = R.held, h = drillHole(rock, dir, R.cans); if (!h) return null;
    R.stats.holes++; if (h.bare) R.stats.bare++;
    const done = R.cans.every(isFull);
    if (done) R.stage = 'full'; else if (h.broke) { gone(rock); R.held = null; R.stage = 'look'; }
    return { ...h, aboard: R.aboard, full: R.full, done, rock };
  };
  // (home early: only with something aboard that comes home, an eighth of a tonne of some metal or more)
  R.canHome = () => !R.done && roundCans(R.cans).some((c) => c.metal);
  R.home = () => { if (!R.canHome()) return false; R.cans = roundCans(R.cans); R.early = true; R.stage = 'home'; return true; };
  return R;
}

// THE CREW'S OWN DRILLER (the captain's, when the player did not sign for the drill): the same game by the same
// rules, worked plainly: the nearest rock that holds a metal the canisters have room for (none in sight: the nearest
// of all, let go again, until the rings bring more), a hole each time where the most would come aboard, until all
// eight canisters are full. -> what comes home: { store (the tonnes of each metal), cans (the canisters) }
export function crewLoad(rand = Math.random) {
  const R = makeRun({ rand }); let at = [0, 0, 0];
  const far = (r) => len([r.pos[0] - at[0], r.pos[1] - at[1], r.pos[2] - at[2]]);
  const wanted = (r) => Object.entries(oreBy(r)).some(([m, t]) => t >= 0.03 && R.roomFor(m) > EPS);
  for (let guard = 0; guard < 20000 && R.stage !== 'full'; guard++) {
    if (R.stage === 'look') { const near = [...R.rocks].sort((a, b) => far(a) - far(b)), next = near.find(wanted) || near[0]; at = next.pos; R.pick(next.id); R.asked(); if (!wanted(next)) { R.letGo(); continue; } }
    const b = bestHole(R.held, 160, (d) => holeWorth(R.held, d, R.cans));
    if (b.worth < 0.005) R.letGo(); else R.drill(b.dir);
  }
  // (never met in the tests' thousands of fields; were the rings ever to give it nothing: home with what is aboard)
  if (R.stage !== 'full') R.home();
  return R.load();
}
