// THE LANDING GEAR'S PLAN, every ship's (no three.js here: the kits draw it, the tests read it, the hull rigs use it).
// The game's maker, 2026-11-26, of the Explorer parked on the hangar floor: "these landing gear coverings.. are kind of
// hideous. The ship would look a lot better if none of this was here and you could just see the landing gear. We should
// just have doors that slide in place. Its fine if the landing gear is kind of magic and folds into itself"; of the
// Miner: "I don't see front landing gear on the miner ship"; and, of the first legs made for that (single columns):
// "The landing gear just looks so basic ... Can we have something that looks more sturdy with a few angled supports
// joining?", and 2026-11-27: "something like the F-16 landing gear. It goes out wider, and has a few cylinders that meet
// up". So, on the Explorer and the Miner:
//   - each LEG (legPlan) leaves its well in the belly and splays OUT and down, its foot wider than where it joins the
//     hull: a fat main cylinder, a short dark piston sliding out of it, ONE knuckle low on it over the foot, and fat
//     SUPPORTS coming in at angles to meet it there, each from a lug where it meets the hull. Every mount and angle is
//     chosen by how the leg looks from behind, where a player stands (a support from far inboard on the belly, so from
//     behind leg and support make a triangle); then made to fold by his "magic": going up (door 'gear', 0 down to 1 up)
//     the leg's two ends go up into its well, its cylinder sliding up over its piston and shortening into itself, each
//     support shortening into itself as one piece, its lug sliding along under the belly into the well, so the leg is
//     one joined thing all the way
//   - each well is shut by a DOOR cut from the hull's own skin, flush in it when shut; open, it has folded into its
//     frame at one edge of the well (by the same magic: it shrinks into the frame as it opens and grows back flush as it
//     shuts), so nothing of it stands in the air beside a parked ship (door 'doors', 0 open to 1 shut). Up: the legs
//     first, then the doors; down: the doors first, then the legs (gearOrder)
//   - every ship stands on legs fore and aft (FEET: where each ship's feet are, nose +z)
// The Medic and the Hauler keep their own legs (the game's maker, 2026-11-26: "As they are"); they are in FEET for the
// rule fore and aft.
import { lineAt } from '../leafaim.js';

// ── A LITTLE GEOMETRY (points [x, y, z]) ─────────────────────────────────────────────────────────────────────────────
const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len3 = (a) => Math.hypot(...a), unit = (a) => mul(a, 1 / (len3(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// p turned by angle about the line through o along unit axis k (Rodrigues)
export function turn(p, o, k, ang) {
  const v = sub(p, o), c = Math.cos(ang), s = Math.sin(ang);
  return add(o, add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c))));
}
// the angle (degrees) between two lines' directions as seen from BEHIND the ship (their x and y; z, along the ship, left out)
export const behindAngle = (u, v) => {
  const a = [u[0], u[1]], b = [v[0], v[1]], la = Math.hypot(...a), lb = Math.hypot(...b);
  return Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1]) / (la * lb || 1))) * 180 / Math.PI;
};

// ── THE LEG ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// The game's maker: "Its fine if the landing gear is kind of magic and folds into itself". So a leg is ONE joined thing
// all the way up and down: it rides a LINE from its hip (where it leaves the hull) to its ankle (over the pad), and
// going up both ends go to their places in the well (kit/leafaim.js: straight, or along a way of several straight
// legs), the line turning and shortening as they go. Its CYLINDER rides the hip and shortens into itself (its open end
// keeps over the piston); its FOOT (the piston, the knuckle, the ankle block, the pad but where it has its own) rides
// the ankle; each SUPPORT its own line from its lug on the hull to the knuckle, shortening into itself as one piece, so
// it never leaves the leg; a lug that stands on the belly outside the well slides along under the skin into the well as
// the leg folds (a way: under the skin first, then up).
// LEG: the pad's height, the ankle pin's over it, how far into the well the cylinder's top stands when down (e), the
// knuckle's height and its reach beyond the piston, how much of the piston stays in the cylinder (overlap), how much of
// the piston shows between the cylinder and the knuckle (show), how far a still mount's block stands round its pin
export const LEG = { pad: 0.1, ankle: 0.07, e: 0.12, knuckle: { h: 0.28, out: 0.08 }, overlap: 0.15, show: 0.25, block: 0.06 };
// the piston's radius against the cylinder's
export const PISTON = 0.62;
// A leg's whole plan, from its LEGS entry and the floor (the ship's frame, port +x, nose +z):
//   foot     the pad's middle on the floor, `splay` out from under the hip; hip, ankle (where its line runs, down)
//   line     { a: hip, av, b: ankle, bv } (kit/leafaim.js): up, the hip goes to stow.a and the ankle to stow.b (by the
//            ways stow.via gives, if any)
//   dir      the unit axis down the leg, down; length (down), long and short (its longest and shortest on the way);
//            lean (degrees out), out (how far its foot stands out beyond its hip, against its height)
//   knee     the knuckle's middle, `kneeAt` metres up the line from the ankle; rk its reach
//   cyl      { r, keep: how far over the ankle its open end stands (it keeps that as it shortens), top: how far over the
//            ankle the piston's top is } (the foot rides the ankle; the cylinder must stay longer than the piston)
//   braces   each { name, from (its lug: on the hull, or on a still block in the well), r, line { a: from, av, b: { on:
//            line, at: kneeAt } }, long, short, angle (degrees between it and the leg, down), behind (the same seen from
//            behind), slides (its lug moves) }
//   pad      the pad rides the foot (it turns as the leg turns going up); or, padLevel, a leaf of its own that goes
//            with the ankle, level all the way
//   well     its box [[x0, y0, z0], [x1, y1, z1]] (the hull rigs cut it); step: where the hull's side comes in over it,
//            its ceiling lower outboard: { x (outboard of it), low (the ceiling there) }
// (a way, from absolute points: [[e, point], ...] to [[e, the point less where it starts], ...])
const wayOf = (from, via, to) => (via && via.length ? [...via.map(([e, q]) => [e, sub(q, from)]), [1, sub(to, from)]] : sub(to, from));
export function legPlan(L, floor, P = LEG) {
  const side = Math.sign(L.at[0]) || 0, sx = (q) => (side < 0 ? [-q[0], q[1], q[2]] : q);
  const foot = [L.at[0] + side * (L.splay || 0), floor, L.at[1]];
  const hip = [L.at[0], L.belly + P.e, L.at[1]], ankle = [foot[0], floor + P.pad + P.ankle, foot[2]];
  const up = { a: sx(L.stow.a), b: sx(L.stow.b) }, via = L.stow.via || {};
  const line = { a: hip, av: wayOf(hip, (via.a || []).map(([e, q]) => [e, sx(q)]), up.a), b: ankle, bv: wayOf(ankle, (via.b || []).map(([e, q]) => [e, sx(q)]), up.b) };
  const dir = unit(sub(ankle, hip)), length = len3(sub(ankle, hip));
  // (the ends may go by several legs, so the line may be at its longest or shortest part way: looked at all the way)
  let long = 0, short = Infinity;
  for (let i = 0; i <= 200; i++) { const [a, b] = lineAt(line, i / 200), l = len3(sub(a, b)); long = Math.max(long, l); short = Math.min(short, l); }
  const lean = Math.acos(Math.min(1, -dir[1])) * 180 / Math.PI, out = Math.abs(foot[0] - hip[0]) / (hip[1] - floor);
  const kneeAt = (L.knee - P.pad - P.ankle) / -dir[1], knee = add(ankle, mul(dir, -kneeAt)), K = P.knuckle;
  const pr = L.r * PISTON, rk = pr + K.out, keep = kneeAt + K.h / 2 + 0.05 + (L.show ?? P.show), top = keep + P.overlap;
  if (short < top + 0.02) throw new Error(`landing leg: its piston (${top.toFixed(2)} m over the ankle) cannot fold into a line as short as ${short.toFixed(2)} m`);
  const cyl = { r: L.r, keep, top, least: (short - keep) / (length - keep) };
  const braces = (L.braces || []).map((B) => {
    const from = sx(B.from), to = B.to ? sx(B.to) : null, bl = { a: from, ...(to ? { av: wayOf(from, (B.via || []).map(([e, q]) => [e, sx(q)]), to) } : {}), b: { on: line, at: kneeAt } };
    let long = 0, shortB = Infinity;
    for (let i = 0; i <= 200; i++) { const [a, b] = lineAt(bl, i / 200), l = len3(sub(a, b)); long = Math.max(long, l); shortB = Math.min(shortB, l); }
    if (shortB < 0.15) throw new Error(`landing leg: its ${B.name} support folds to ${shortB.toFixed(2)} m`);
    const d = unit(sub(knee, from)), angle = Math.acos(Math.min(1, Math.abs(dot(d, dir)))) * 180 / Math.PI;
    return { name: B.name, from, r: B.r, face: B.face ? sx(B.face) : null, line: bl, long, short: shortB, angle, behind: behindAngle(d, dir), slides: !!to };
  });
  const [wi, wo, wa, wf] = L.well, xs = side ? [L.at[0] - side * wi, L.at[0] + side * wo].sort((p, q) => p - q) : [L.at[0] - wi, L.at[0] + wo];
  const well = [[xs[0], 0.5, L.at[1] - wa], [xs[1], L.top + 0.02, L.at[1] + wf]];
  const step = L.step ? { x: side < 0 ? -L.step.x : L.step.x, low: L.step.low } : null;
  return { side, foot, hip, ankle, line, dir, length, long, short, lean, out, cyl, pr, knee, kneeAt, rk, braces, well, step, padLevel: !!L.padLevel };
}
// THE LEAVES THE KIT IS HANDED (built-common.js strutLeg; the tests pose these same ones): the plan's lines lowered
// into the piece's own frame (`deck` metres down: the ships' pieces are drawn with their deck at 0), so every part
// turns about the point it is drawn at. part: 'cylinder' | 'foot' (the piston down to the pad) | 'brace NAME' | 'pad';
// each { part, aim }
const lower = (q, deck) => (Array.isArray(q) ? [q[0], q[1] - deck, q[2]] : q);
export function kitLeaves(G, deck) {
  const line = { a: lower(G.line.a, deck), av: G.line.av, b: lower(G.line.b, deck), bv: G.line.bv };
  const out = [{ part: 'cylinder', aim: { ...line, from: 'a', at: 0, stretch: G.cyl.keep } }, { part: 'foot', aim: { ...line, from: 'b', at: 0 } }];
  for (const B of G.braces) out.push({ part: `brace ${B.name}`, aim: { a: lower(B.line.a, deck), ...(B.line.av ? { av: B.line.av } : {}), b: { on: line, at: B.line.b.at }, from: 'a', at: 0, stretch: 0 } });
  // (a level pad: it goes as the ankle goes, turning not at all)
  if (G.padLevel) out.push({ part: 'pad', aim: { a: line.b, av: line.bv, b: add(line.b, [0, -1, 0]), bv: line.bv, from: 'a', at: 0 } });
  return out;
}

// ── THE DOORS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// A well's door, cut from the hull's skin (its halves, the hull rig's DOORS), flush in it when shut. The game's maker
// asked for "doors that slide in place"; open, a parked ship's doors must be nowhere in the air (no panel slid out
// beside the hull: there is no room inside the skin round a well for one), so by his "magic" the door folds into its
// frame: it shrinks across a line at one edge of the well (`toward`: [axis, -1 or +1], the edge it goes to: 0 across
// the ship, 2 along it), lifted `lift` into the well and `inset` in from its wall, to `keep` of its width, its free edge
// running across the mouth as a sliding door's does; and grows back flush as it shuts (the line level along the edge,
// over its highest point). Or, `apart`, each half to its
// own edge. Returns the leaves' folds: [{ halves (indices), fold { at, along, from, to } }] (kit/leafaim.js foldMatrix:
// t 0, open: from; t 1, shut: to).
export const DOOR = { keep: 0.03, lift: 0.05, inset: 0.03 };
// a well's door halves without the pieces of skin that stay in the hull (LEGS `door.stay`), and those pieces
export const doorHalves = (halves, how = {}) => halves.map((h, i) => ({ ...h, polys: h.polys.filter((_, j) => !(how.stay || []).some(([a, b]) => a === i && b === j)) }));
export const keptPieces = (halves, how = {}) => (how.stay || []).map(([a, b]) => halves[a].polys[b]);
export function doorFolds(halves, { toward = null, apart = false, lift = DOOR.lift, inset = DOOR.inset, keep = DOOR.keep } = {}) {
  const groups = apart ? halves.map((h, i) => [[i], h.axis, h.dir]) : [[halves.map((_, i) => i), toward[0], toward[1]]];
  return groups.map(([idx, axis, dir]) => {
    const pts = idx.flatMap((i) => halves[i].polys.flat()), ext = dir > 0 ? Math.max(...pts.map((p) => p[axis])) : Math.min(...pts.map((p) => p[axis]));
    const edge = pts.filter((p) => Math.abs(p[axis] - ext) < 0.005), o = axis === 0 ? 2 : 0;
    // (the line along the edge, level, through its middle, `lift` over its highest point (the edge may climb a cheek),
    // `inset` in from its wall)
    const lo = edge.reduce((m, p) => (p[o] < m[o] ? p : m)), hi = edge.reduce((m, p) => (p[o] > m[o] ? p : m));
    const along = axis === 0 ? [0, 0, 1] : [1, 0, 0], at = mul(add(lo, hi), 0.5);
    at[1] = Math.max(...edge.map((p) => p[1])) + lift; at[axis] -= dir * inset;
    return { halves: idx, fold: { at, along, from: keep, to: 1 } };
  });
}

// ── IN TURN ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// Up: the legs fold first, then the wells' doors shut; down: the doors open first, then the legs come down. legs, doors:
// the kit's doors (each with t: legs 0 down .. 1 up; doors 0 open .. 1 shut); move(list, mode): moves those a step
// toward 'open' (t 1) or 'shut' (t 0) and says whether any moved. Returns whether anything moved.
export function gearOrder(legs, doors, up, move) {
  if (up) { const m = move(legs, 'open'); return legs.every((D) => D.t >= 1) ? move(doors, 'open') || m : m; }
  const m = move(doors, 'shut'); return doors.every((D) => D.t <= 0) ? move(legs, 'shut') || m : m;
}


// ── WHERE THE LEGS ARE ────────────────────────────────────────────────────────────────────────────────────────────────
// Each leg (the ship's frame: port +x, nose +z; a port leg's numbers, its starboard twin mirrored, but for what its own
// `starboard` gives where the hull is not the same on that side):
//   at [x, z]   where it leaves the hull; belly: the skin's height there (its hip stands LEG.e over it)
//   splay       how much further out its foot stands than that; r: its cylinder's radius; pad [across, along]
//   knee        the knuckle's middle, over the floor; show: how much dark piston shows over the knuckle (LEG.show)
//   stow { a, b, via } where its hip and its ankle are, up (in its well); via { a, b }: [[e, point], ...] on the way
//   braces      each { name, from (its lug's pin), r, to (where its lug is, up: a lug on the hull that slides into the
//               well as the leg folds; none: a still block in the well's mouth), via [[e, point], ...] (its lug's way),
//               face (the skin's outward normal under a lug on the hull: the lug lies flat to it, just under it) }
//   top, well [in, out, aft, fore]: its well's top and how far its mouth reaches from `at` each way; step { x, low }:
//               outboard of x its ceiling is low, where the hull's side comes in (legPlan)
//   door        how its door folds into its frame (doorFolds): { toward: [axis, dir] } (the port side's: mirrored
//               across the ship for the starboard twin) or { apart: true }; stay: [[half, piece], ...] the pieces of
//               the cut skin that stay in the hull (an upper skin over the well, the wing's root over the
//               Explorer's, a cheek's top over the Miner's: with nothing of the hull over them, which the leg never
//               passes, and which would leave a hole in the hull's top with the door open)
// floor: the ground in the ship's frame (the Miner stands STAND higher on its legs than its hull's own ground line).
// The wells are cut in the hull data (WELLS, DOORS) by the rigs in ~/pw/space-math/rigs/gear-2/; the legs' numbers were
// tried in ~/pw/space-math/rigs/gear-3/ against the hull, by pictures from behind first.
const mirror = (L) => Object.fromEntries(Object.entries(L).flatMap(([k, v]) => {
  if (!k.includes('port')) return [[k, v]];
  const { starboard = {}, ...p } = v, door = p.door?.toward && p.door.toward[0] === 0 ? { ...p.door, toward: [0, -p.door.toward[1]] } : p.door;
  return [[k, p], [k.replace('port', 'starboard'), { ...p, door, ...starboard, at: [-p.at[0], p.at[1]] }]];
}));
export const LEGS = {
  // the Explorer: the nose leg under the cockpit, where it stood before these legs (z 4.2), upright, braced from ahead
  // and behind, folding back flat into its well as it rises; the aft two under the hull's sides, leaning out so each
  // foot stands under the wing's root (out by nearly half the leg's height), thick (the game's maker: "more sturdy"),
  // each with ONE long support from far inboard on the belly to the knuckle low on it, so from behind (where a player
  // stands) leg and support make a triangle, and one from well ahead (so the side view stays raked); both supports'
  // lugs slide along under the belly into the well as it folds; their wells in the hull's sides beside the cabin's
  // walls, long along the ship; the hull is not quite the same each side, so each side's leg stows its own way
  explorer: { floor: 0, legs: mirror({
    nose: { at: [0, 4.2], belly: 1.17, splay: 0, r: 0.16, pad: [0.5, 0.62], knee: 0.32, show: 0.16, padLevel: true,
      stow: { a: [0, 1.47, 5.23], b: [0, 1.47, 3.91] }, top: 1.68, well: [0.27, 0.27, 1.27, 1.17], door: { apart: true },
      braces: [{ name: 'fore', from: [0, 1.431, 5.193], r: 0.11 }, { name: 'aft', from: [0, 1.272, 3.115], r: 0.11 }] },
    port: { at: [2.42, -3.85], belly: 2.15, splay: 0.9, r: 0.3, pad: [0.8, 1.4], knee: 0.62, padLevel: true,
      stow: { a: [2.43, 3.55, -3.98], b: [2.48, 2.55, -4.5], via: { b: [[0.45, [2.48, 1.3, -4.2]]] } }, top: 3.7, well: [0.35, 0.53, 1.35, 1.28], door: { toward: [0, -1], stay: [[1, 2], [1, 4], [1, 6], [1, 7], [1, 8], [1, 10]] },
      braces: [{ name: 'in', from: [1.874, 1.419, -3.735], face: [0.6, -0.796, -0.078], r: 0.2, via: [[0.4, [2.27, 1.73, -3.735]]], to: [2.36, 2.9, -3.9] },
        { name: 'fore', from: [2.404, 1.592, -2.195], face: [0.647, -0.762, 0.029], r: 0.2, via: [[0.4, [2.3, 1.4, -2.8]], [0.7, [2.38, 1.6, -3.75]]], to: [2.38, 2.9, -3.75] }],
      starboard: { top: 3.83, well: [0.35, 0.61, 1.35, 1.28], door: { toward: [0, 1], stay: [[0, 3], [0, 4], [0, 6], [0, 8], [0, 9], [0, 11], [0, 12]] } } },
  }) },
  // the Miner: a pair under the cockpit's sides, their wells between the cockpit's lining and the hull's sides, long
  // along the ship, braced from their ends (the starboard cheek is narrower: 48 cm at the well's top from the lining to
  // the hull's side, so these legs are no thicker than that leaves room for, and the wells' ceilings step down outboard
  // where the cheek comes in); and the aft pair under the stern's block, hung from its inboard side and leaning out 28
  // degrees, each with a support from under the body inboard of the block and one from under the block's outboard
  // edge, meeting it at the boot's top band, so from behind each leg stands in an A of supports; their lugs slide
  // under the hull into the well as they fold; every foot outside the hull's edge; 13 cm longer (STAND). Its look (the
  // boot, the bands, the spiked skid) as the game's maker chose it ("steal theirs")
  miner: { floor: -0.13, legs: mirror({
    'nose port': { at: [1.32, 3.75], belly: 1.36, splay: 0.76, r: 0.13, pad: [0.3, 0.72], knee: 0.38, show: 0.18, padLevel: true,
      stow: { a: [1.318, 2.418, 4.627], b: [1.441, 2.045, 3.449] }, top: 2.6, step: { x: 1.6, low: 2.3 }, well: [0.24, 0.41, 1.15, 1.15], door: { toward: [0, -1], stay: [[0, 3]] },
      braces: [{ name: 'fore', from: [1.33, 2.12, 4.72], r: 0.09 }, { name: 'aft', from: [1.27, 1.77, 2.77], r: 0.09 }],
      starboard: { stow: { a: [1.29, 2.41, 4.738], b: [1.415, 2.01, 3.494] }, step: { x: 1.56, low: 2.15 }, well: [0.24, 0.33, 1.15, 1.21], door: { toward: [0, 1], stay: [[0, 2], [1, 7]] } } },
    port: { at: [1.32, -6.42], belly: 1.8, splay: 1.02, r: 0.24, pad: [0.62, 0.74], knee: 0.5, padLevel: true,
      stow: { a: [1.62, 3.1, -6.515], b: [1.331, 2.06, -6.558] }, top: 3.97, step: { x: 1.63, low: 3.7 }, well: [0.3, 0.73, 0.54, 0.3], door: { toward: [0, -1] },
      braces: [{ name: 'in', from: [0.6, 1.293, -6.507], face: [0, -0.725, -0.689], r: 0.145, via: [[0.45, [1.2, 1.293, -6.507]]], to: [1.2, 2.4, -6.507] },
        { name: 'out', from: [2.27, 2.079, -6.446], face: [0.744, -0.637, -0.201], r: 0.145, via: [[0.25, [2.42, 1.3, -6.446]], [0.5, [1.85, 1.2, -6.446]]], to: [1.85, 2.5, -6.446] }],
      starboard: { stow: { a: [1.453, 3.715, -6.453], b: [1.371, 2.156, -6.517] }, top: 3.95, step: { x: 1.5, low: 3.85 }, well: [0.28, 0.66, 0.5, 0.3] } },
  }) },
};
// EVERY SHIP'S FEET [x, z] (nose +z), for the rule that each stands on legs fore and aft: the two above from LEGS (where
// each foot stands, its splay out from its well), the Medic's from its legs' wells (medic-built.hull.js WELLS: front z
// 4.33 to 6.16, rear -4.43 to -2.66) and the Hauler's from its legs (hauler-built.js GEAR.at); the tests check these
// against the ships' own data
const feet = (S) => Object.values(S.legs).map((L) => [L.at[0] + Math.sign(L.at[0]) * (L.splay || 0), L.at[1]]);
export const FEET = {
  explorer: feet(LEGS.explorer),
  miner: feet(LEGS.miner),
  medic: [[1.81, 5.24], [-1.81, 5.24], [2.01, -3.55], [-2.01, -3.55]],
  hauler: [[0.32, 5.25], [-0.32, 5.25], [1.5, -4.4], [-1.5, -4.4]],
};
