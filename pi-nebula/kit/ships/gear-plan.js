// THE LANDING GEAR'S PLAN, every ship's (no three.js here: the kits draw it, the tests read it, the hull rigs use it).
// The game's maker, 2026-11-26, of the Explorer parked on the hangar floor: "these landing gear coverings.. are kind of
// hideous. The ship would look a lot better if none of this was here and you could just see the landing gear. We should
// just have doors that slide in place. Its fine if the landing gear is kind of magic and folds into itself"; of the
// Miner: "I don't see front landing gear on the miner ship"; and, of the first legs made for that (single columns):
// "The landing gear just looks so basic ... Can we have something that looks more sturdy with a few angled supports
// joining?", and 2026-11-27: "something like the F-16 landing gear. It goes out wider, and has a few cylinders that meet
// up". So, on the Explorer and the Miner:
//   - each LEG (legPlan) leaves its well in the belly and splays OUT and down, its foot wider than where it joins the
//     hull: a fat main cylinder, a slimmer bright piston sliding out of it (a collar where they meet), a fitting just
//     over the foot, and two or three slimmer cylinders (BRACES) coming in at angles from the well's edges to meet it
//     there. Going up (door 'gear', 0 down to 1 up) it turns upright about its hip, the piston slides up into the
//     cylinder, the braces' rods into their sleeves, and the whole leg rises into its well, folding into itself
//   - each well is closed by two DOORS cut from the hull's own skin, flush in it when shut; they slide apart, along the
//     ship or across it and a little into the hull (so they pass behind the skin round the well), to open (door 'doors',
//     0 open to 1 shut). Up: the legs first, then the doors; down: the doors first, then the legs (gearOrder)
//   - every ship stands on legs fore and aft (FEET: where each ship's feet are, nose +z)
// The Medic and the Hauler keep their own legs (the game's maker, 2026-11-26: "As they are"); they are in FEET for the
// rule fore and aft.

// ── A LITTLE GEOMETRY (points [x, y, z]) ─────────────────────────────────────────────────────────────────────────────
const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len3 = (a) => Math.hypot(...a), unit = (a) => mul(a, 1 / (len3(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// p turned by angle about the line through o along unit axis k (Rodrigues)
export function turn(p, o, k, ang) {
  const v = sub(p, o), c = Math.cos(ang), s = Math.sin(ang);
  return add(o, add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c))));
}

// ── THE LEG ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// LEG: the foot's pad (its height), the fitting over it (its middle and top, along the leg from the floor), how far into
// the well the cylinder's top stands when down (e), how far over the shut door's skin the stowed foot stays (clear), how
// much piston stays in the cylinder (overlap), how much a brace's rod stays in its sleeve, at least (braceOverlap)
export const LEG = { pad: 0.08, fit: 0.24, fitTop: 0.34, e: 0.15, clear: 0.07, overlap: 0.12, braceOverlap: 0.08 };
// A leg's whole plan, from its LEGS entry and the floor (the ship's frame):
//   hip     where it joins the hull (the well's mouth's middle, on the belly), and the turn that stands it upright going
//           up ({ at, axis, angle }: about the line along the ship through the hip; none for a leg that does not splay)
//   foot    the foot's middle on the floor (s out from under the hip), the axis down the leg (dir, unit), its length
//   tubes   the cylinder [0] and the piston [1] (and, where the well is shallow, more): { u0, u1 (along the leg from the
//           floor, down), r, rise (how far it slides up, after the turn, going up) }; the foot and fitting rise with the
//           last
//   braces  each: { name, anchor (on the well's edge, just inside the mouth), fit (the fitting over the foot), dDown,
//           dUp (the brace's length down and up), sleeve and rod: { length, rise, hinge (its own turn, about its end) } }
//   at(u)   the point u up the leg from the floor, down
export function legPlan(L, floor, P = LEG) {
  const side = Math.sign(L.at[0]) * (L.splay ? 1 : 0), s = L.splay || 0;
  const hip = [L.at[0], L.belly, L.at[1]], foot = [L.at[0] + side * s, floor, L.at[1]];
  const dir = unit(sub(foot, hip)), length = len3(sub(foot, hip)), at = (u) => add(foot, mul(dir, -u));
  // (the turn upright: the leg's axis onto straight down, about the line along the ship through the hip)
  const angle = side ? -side * Math.atan2(s, L.belly - floor) : 0, hipTurn = { at: hip, axis: [0, 0, 1], angle };
  const up = (p, rise) => add(angle ? turn(p, hip, [0, 0, 1], angle) : p, [0, rise, 0]);
  // THE TUBES (along the leg, u from the floor): the cylinder's top e into the well when down; up, every tube inside the
  // well's depth D, the foot `clear` over the belly (and a little more where the pad, turned upright, tilts)
  const D = L.top - L.belly, tilt = (L.pad[0] / 2) * Math.abs(Math.sin(angle)), lMax = D - P.fitTop - P.clear - tilt;
  if (lMax < 0.25) throw new Error(`landing leg: its well is too shallow (${lMax.toFixed(2)} m of cylinder)`);
  const Td = length + P.e, total = Td - P.fitTop;
  const n = Math.max(2, Math.ceil((total - lMax) / (lMax - P.overlap) - 1e-9) + 1), step = (total - lMax) / (n - 1);
  const rise = (k) => D - P.e + k * step, radius = (k) => (k ? L.r * 0.55 - 0.02 * (k - 1) : L.r);
  const tubes = Array.from({ length: n }, (_, k) => ({ u0: Td - k * step - lMax, u1: Td - k * step, r: radius(k), rise: rise(k) }));
  const footRise = rise(n - 1), fit = at(P.fit);
  // THE BRACES: from the well's edges (fore, aft, the inboard side, port, starboard) down to the fitting over the foot,
  // each a sleeve from its anchor and a rod from the fitting, sliding in it. Going up the anchor rides with the cylinder
  // and the fitting with the foot; each part turns about its own end, from the brace's line down to its line up (as
  // seen before the leg's own turn upright), so up the two lie on one line again, the rod run into the sleeve. The
  // parts' lengths: together more than the brace's length down, each no more than its length up
  const [hx, hz] = L.well, edge = { fore: [0, 0, hz - 0.07], aft: [0, 0, -(hz - 0.07)], in: [-side * (hx - 0.06), 0, 0], port: [hx - 0.07, 0, 0], starboard: [-(hx - 0.07), 0, 0] };
  const braces = (L.braces || []).map((name) => {
    const anchor = add(hip, add(edge[name], [0, 0.04, 0])), u0 = unit(sub(fit, anchor)), aUp = up(anchor, tubes[0].rise), fUp = up(fit, footRise);
    let u1 = unit(sub(fUp, aUp)); if (angle) u1 = turn(u1, [0, 0, 0], [0, 0, 1], -angle);
    const ax = cross(u0, u1), sa = len3(ax), ang = Math.atan2(sa, dot(u0, u1)), axis = sa > 1e-9 ? mul(ax, 1 / sa) : [1, 0, 0];
    const dDown = len3(sub(fit, anchor)), dUp = len3(sub(fUp, aUp)), part = Math.min(dUp, dDown / 2 + P.braceOverlap);
    return { name, anchor, fit, dDown, dUp, sleeve: { length: part, rise: tubes[0].rise, hinge: { at: anchor, axis, angle: ang } }, rod: { length: part, rise: footRise, hinge: { at: fit, axis, angle: ang } }, up: { anchor: aUp, fit: fUp } };
  });
  return { side, hip, hipTurn: angle ? hipTurn : null, foot, dir, length, at, up, tubes, footRise, fit, braces, n };
}

// ── THE SLIDING DOORS ─────────────────────────────────────────────────────────────────────────────────────────────────
// How far a well's door half moves to open: along the line the well is split across (axis 2, along the ship: fore and
// aft halves; or 0, across it: port and starboard halves, where the skin fore and aft of the well is not flat), away
// from the well's middle by half the well's size that way and a little more, and `sink` into the hull along its skin's
// inward normal (square to that line). A half: { axis, dir (-1 or +1 along that axis), len (the well's size along it),
// n (the half's skin's outward normal, averaged; [x, y, z]), sink (how far into the hull: DOOR.sink if not given), up
// (sink straight up instead), one (if given, -1 or +1: both halves slide that way together, the well's whole size, as
// one door: where the skin on one side of the well ends too soon) }.
export const DOOR = { sink: 0.09, past: 0.05 };
export function doorSlide({ axis = 2, dir, len, n, sink = DOOR.sink, one = 0, up = false }) {
  // (the sink is across the line it slides along, so however the skin leans it slides its whole way along that line;
  // or, `up`, straight up, where the skin round the well leans every way)
  const m = up ? [0, -1, 0] : n.map((v, k) => (k === axis ? 0 : v)), l = Math.hypot(...m) || 1, S = m.map((v) => -sink * v / l);
  S[axis] += one ? one * (len + DOOR.past) : dir * (len / 2 + DOOR.past);
  return S;
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
// Each leg: at [x, z] (the ship's frame: port +x, nose +z; its well's middle, where it joins the hull), splay (how much
// further out its foot stands than that), top (its well's top), belly (the skin's highest point over its well's mouth:
// the hull rigs measure it), r (the cylinder's radius), pad [across, along] (the foot's size), braces (the well's edges
// its braces come from). floor: the ground in the ship's frame (the Miner stands STAND higher on its legs than its
// hull's own ground line). well [half across, half along] (its mouth), split (the axis its doors part along: 2 fore and
// aft, the default; 0 port and starboard), sink (how far its doors go into the hull as they open, where the skin round
// the well is not flat; DOOR.sink if not), one, up (how its doors slide: doorSlide). The wells are cut in the hull data
// (WELLS, DOORS) by the rigs in ~/pw/space-math/rigs/gear-2/.
const mirror = (L) => Object.fromEntries(Object.entries(L).flatMap(([k, v]) => (k.includes('port') ? [[k, v], [k.replace('port', 'starboard'), { ...v, at: [-v.at[0], v.at[1]], ...(v.one && v.split === 0 ? { one: -v.one } : {}) }]] : [[k, v]])));
export const LEGS = {
  // the Explorer: the nose leg under the cockpit (its well's top under the cockpit's floor), braced from both sides and
  // ahead; the aft two under the hull's sides, 2.31 m out (where its old legs stood), their feet 35 cm further out, their
  // wells going up beside the cabin's side walls
  explorer: { floor: 0, legs: mirror({
    nose: { at: [0, 5.95], top: 1.99, belly: 1.08, r: 0.15, pad: [0.5, 0.56], well: [0.3, 0.32], split: 0, braces: ['port', 'starboard', 'fore'] },
    port: { at: [2.31, -3.72], top: 4.2, belly: 2.27, r: 0.19, splay: 0.35, pad: [0.44, 0.62], well: [0.24, 0.55], braces: ['fore', 'aft'] },
  }) },
  // the Miner: a pair under the cockpit's sides (their wells going up between the cockpit's walls and the hull's
  // sides), and the aft pair under the stern's block, beside the engine room; each foot 30 cm further out; 13 cm
  // longer (STAND)
  miner: { floor: -0.13, legs: mirror({
    'nose port': { at: [1.38, 3.75], top: 2.72, belly: 1.54, r: 0.14, splay: 0.3, pad: [0.32, 0.5], well: [0.17, 0.3], sink: 0.32, braces: ['fore', 'aft'] },
    port: { at: [1.38, -6.42], top: 3.9, belly: 1.88, r: 0.14, splay: 0.3, pad: [0.32, 0.48], well: [0.17, 0.28], sink: 0.45, up: true, braces: ['fore', 'aft'] },
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
