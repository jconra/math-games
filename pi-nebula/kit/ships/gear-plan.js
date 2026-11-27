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
// LEG: the pad's height, how far into the well the cylinder's top stands when down (e), how far over the shut door's skin
// the stowed foot stays (clear), how much of each stage stays in the one over it (overlap), the knuckle's height and its
// radius beyond the piston's (knuckle)
export const LEG = { pad: 0.1, e: 0.06, clear: 0.07, overlap: 0.1, knuckle: { h: 0.26, out: 0.07 } };
// A leg's whole plan, from its LEGS entry and the floor (the ship's frame):
//   hip      where it joins the hull (its well's mouth, on the belly) and the turn that stands it upright going up
//            ({ at, axis, angle }: about the line along the ship through the hip; none for a leg that does not lean)
//   foot     the pad's middle on the floor, `splay` out from under the hip; dir, the unit axis down the leg; length
//   spin     where the pad is wider than the well, its turn about the leg's own axis going up (a quarter turn), so it
//            goes in long side along the well
//   knee     the knuckle's middle (`knee` up the leg from the floor), where the braces meet it
//   tubes    the cylinder [0], the piston [n - 1] (a stage between where the well is shallow): { u0, u1 (along the leg
//            from the floor, down), r, rise (how far it slides up, after the turn, going up) }; the foot, the piston's
//            lowest part and the knuckle rise with the last
//   braces   each: { name, from (where it mounts on the hull, a little inside its well's mouth), to (its lug on the
//            knuckle), r, length, hinge (its turn about where it mounts, going up, so that it swings up into the well,
//            its far end coming in under the belly), shrink, rodLength, slide (where the well is too small for it, its
//            rod's run into its sleeve going up), up (its far end, up) }
//   well     the box of its well, [[x0, y0, z0], [x1, y1, z1]] (the hull rigs cut it), and at(u), up(p, rise), move
export function legPlan(L, floor, P = LEG) {
  const side = Math.sign(L.at[0]) || 0, lean = side ? (L.splay || 0) : 0;
  const hip = [L.at[0], L.belly, L.at[1]], foot = [L.at[0] + side * lean, floor, L.at[1]];
  const dir = unit(sub(foot, hip)), length = len3(sub(foot, hip)), at = (u) => add(foot, mul(dir, -u));
  // (the turn upright is about a point `lift` over the hip, and each part slides back under it as it rises: so the leg,
  // turning and rising at once, keeps passing through the middle of its well's mouth instead of sweeping out across it)
  const angle = lean ? -side * Math.atan2(lean, L.belly - floor) : 0, lift = angle ? (L.lift || 0) : 0, pivot = add(hip, [0, lift, 0]);
  const hipTurn = angle ? { at: pivot, axis: [0, 0, 1], angle } : null;
  const slideOf = (rise) => [-Math.sin(angle) * lift, rise - lift * (1 - Math.cos(angle)), 0];
  const spin = L.spin ? { at: foot, axis: mul(dir, -1), angle: Math.PI / 2 } : null;
  const up = (p, rise) => add(angle ? turn(p, pivot, [0, 0, 1], angle) : p, slideOf(rise));
  // THE STAGES (along the leg, u from the floor): the cylinder's top e into the well when down; up, every stage inside
  // the well's depth D, the knuckle (the foot group's top) under the cylinder, the foot `clear` over the belly (and a
  // little more where the pad, turned upright, tilts)
  const D = L.top - L.belly, padX = (L.spin ? L.pad[1] : L.pad[0]) / 2, tilt = padX * Math.abs(Math.sin(angle));
  const fitTop = L.knee + P.knuckle.h / 2, lMax = D - fitTop - P.clear - tilt;
  if (lMax < 0.25) throw new Error(`landing leg: its well is too shallow (${lMax.toFixed(2)} m of cylinder)`);
  const Td = length + P.e, total = Td - fitTop;
  const n = Math.max(2, Math.ceil((total - lMax) / (lMax - P.overlap) - 1e-9) + 1), step = (total - lMax) / (n - 1);
  const rise = (k) => D - P.e + k * step, radius = (k) => (k ? L.r * (n > 2 ? 0.75 - 0.17 * (k - 1) : 0.6) : L.r);
  const tubes = Array.from({ length: n }, (_, k) => ({ u0: Td - k * step - lMax, u1: Td - k * step, r: radius(k), rise: rise(k) }));
  const footRise = rise(n - 1), knee = at(L.knee), rk = radius(n - 1) + P.knuckle.out;
  // THE WELL: its box (well [in, out, aft, fore]: how far it reaches from the hip inboard, outboard, aft and forward)
  const [wi, wo, wa, wf] = L.well, xs = side ? [L.at[0] - side * wi, L.at[0] + side * wo].sort((a, b) => a - b) : [L.at[0] - wi, L.at[0] + wo];
  const well = [[xs[0], 0.5, L.at[1] - wa], [xs[1], L.top + 0.02, L.at[1] + wf]];
  // THE BRACES: each a fat rod from its mount on the hull to a lug on the knuckle; going up it swings about its mount,
  // up and in, to lie in the well toward its far side (the point `stow`: the well's middle, high), its far end coming
  // in under the belly and up through the well's mouth
  const mid = [(well[0][0] + well[1][0]) / 2, L.top - 0.3, (well[0][2] + well[1][2]) / 2];
  const braces = (L.braces || []).map((B) => {
    const from = [side < 0 ? -B.from[0] : B.from[0], B.from[1], B.from[2]], h = sub(from, knee); h[1] = 0;
    const to = add(knee, mul(unit(h), rk + 0.02)), u0 = unit(sub(to, from)), length = len3(sub(to, from));
    const u1 = unit(sub(B.stow ? [side < 0 ? -B.stow[0] : B.stow[0], B.stow[1], B.stow[2]] : mid, from));
    const ax = cross(u0, u1), sa = len3(ax), ang = Math.atan2(sa, dot(u0, u1)), axis = sa > 1e-9 ? mul(ax, 1 / sa) : [1, 0, 0];
    // (where it is longer than the well has room for along that line, its rod slides into its sleeve as it swings, by
    // `shrink`, along the line it ends on: its slide)
    let room = Infinity; for (let k = 0; k < 3; k++) if (Math.abs(u1[k]) > 1e-9) room = Math.min(room, ((u1[k] > 0 ? well[1][k] - 0.04 : well[0][k] + 0.04) - from[k]) / u1[k]);
    const shrink = Math.max(0, length - room);
    const rodLength = shrink ? length / 2 + shrink / 2 + 0.1 : 0;
    return { name: B.name, from, to, r: B.r, length, shrink, rodLength, slide: mul(u1, -shrink), hinge: { at: from, axis, angle: ang }, up: add(from, mul(u1, length - shrink)) };
  });
  // WHERE A POINT OF A PART IS, t of the way up (as the kit's door leaves move: each hinge in turn, by the eased t, then
  // the slide): part 'tube k' | 'foot' | a brace's index (its sleeve, or the whole brace) | 'rod k' (a brace's rod)
  const ease = (t) => t * t * (3 - 2 * t);
  const move = (part, p, t) => {
    const e = ease(t);
    if (typeof part === 'number' || /^rod /.test(part)) {
      const B = braces[typeof part === 'number' ? part : +part.split(' ')[1]], q = turn(p, B.hinge.at, B.hinge.axis, B.hinge.angle * e);
      return typeof part === 'number' ? q : add(q, mul(B.slide, e));
    }
    let q = p;
    if (part === 'foot' && spin) q = turn(q, spin.at, spin.axis, spin.angle * e);
    if (angle) q = turn(q, pivot, [0, 0, 1], angle * e);
    const r = part === 'foot' ? footRise : tubes[+part.split(' ')[1]].rise;
    return add(q, mul(slideOf(r), e));
  };
  return { side, hip, hipTurn, slideOf, spin, foot, dir, length, at, up, tubes, footRise, knee, rk, braces, well, n, move, angle };
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
// its braces come from: each { name, from (its mount on the hull), r, stow (the point in the well it swings toward, up;
// chosen by a search, rigs/gear-2/tools/search.mjs, for the fewest points through the hull on the way) }), lift (how
// far over the hip its turn upright is centred: the search's too). floor: the ground in the ship's frame (the Miner stands STAND higher on its legs than its
// hull's own ground line). well [in, out, aft, fore] (how far its mouth reaches from the hip each way), split (the axis its doors part along: 2 fore and
// aft, the default; 0 port and starboard), braceMin (the least angle its braces meet it at, where the hull leaves no
// room for wider: 12 degrees if not), sink (how far its doors go into the hull as they open, where the skin round
// the well is not flat; DOOR.sink if not), one, up (how its doors slide: doorSlide). The wells are cut in the hull data
// (WELLS, DOORS) by the rigs in ~/pw/space-math/rigs/gear-2/.
const mirror = (L) => Object.fromEntries(Object.entries(L).flatMap(([k, v]) => (k.includes('port') ? [[k, v], [k.replace('port', 'starboard'), { ...v, at: [-v.at[0], v.at[1]], ...(v.one && v.split === 0 ? { one: -v.one } : {}) }]] : [[k, v]])));
export const LEGS = {
  // the Explorer: the nose leg under the cockpit (its well's top under the cockpit's floor), upright, braced from ahead
  // and behind; the aft two under the hull's sides, 2.31 m out (where its old legs stood), leaning out 23 degrees (their
  // feet 96 cm further out: inside the ship's own shape for bumps there, its wings' box 6.6 m out), their wells going up
  // beside the cabin's side walls and long along the ship, braced from the wells' fore and aft ends
  explorer: { floor: 0, legs: mirror({
    nose: { at: [0, 5.95], top: 1.99, belly: 1.08, r: 0.14, pad: [0.58, 0.5], knee: 0.3, well: [0.3, 0.3, 0.55, 0.75], split: 0, sink: 0.4,
      braces: [{ name: 'fore', from: [0, 1.22, 6.65], r: 0.07, stow: [-0.24, 1.25, 5.47] }, { name: 'aft', from: [0, 1.36, 5.45], r: 0.07, stow: [-0.24, 1.71, 6.05] }] },
    port: { at: [2.31, -3.72], top: 4.2, belly: 2.27, r: 0.19, splay: 0.96, pad: [0.8, 0.44], spin: true, knee: 0.66, well: [0.24, 0.45, 0.95, 0.95], sink: 0.16,
      braces: [{ name: 'fore', from: [2.12, 1.64, -2.84], r: 0.09, stow: [2.14, 2.36, -4.58] }, { name: 'aft', from: [2.12, 1.97, -4.6], r: 0.09, stow: [2.14, 2.36, -4.29] }] },
  }) },
  // the Miner: a pair under the cockpit's sides (their wells going up between the cockpit's walls and the hull's sides;
  // the hull there leaves room for no longer a well, so their braces come in steeply), and the aft pair under the
  // stern's block, beside the engine room (their wells reaching in under the engine room's side, braced from there and
  // from behind); each leaning out 20 degrees (further, a leg folding up would pass through the cheek beside the
  // cockpit, or the stern block's lower outer lip); 13 cm longer (STAND)
  miner: { floor: -0.13, legs: mirror({
    'nose port': { at: [1.38, 3.75], top: 2.72, belly: 1.54, r: 0.14, splay: 0.62, pad: [0.32, 0.56], knee: 0.36, well: [0.17, 0.3, 0.3, 0.3], sink: 0.32, braceMin: 6,
      braces: [{ name: 'fore', from: [1.25, 1.62, 4.0], r: 0.075, stow: [1.26, 2.63, 3.84] }, { name: 'aft', from: [1.25, 1.5, 3.5], r: 0.075, stow: [1.26, 1.96, 3.57] }] },
    port: { at: [1.38, -6.42], top: 3.9, belly: 1.88, r: 0.15, splay: 0.75, lift: 1.5, pad: [0.6, 0.5], knee: 0.59, well: [0.36, 0.4, 0.28, 0.28], sink: 0.45, up: true, braceMin: 6,
      braces: [{ name: 'in', from: [1.06, 1.73, -6.42], r: 0.09, stow: [1.25, 3.75, -6.17] }, { name: 'aft', from: [1.3, 1.9, -6.67], r: 0.09, stow: [1.1, 3.75, -6.59] }] },
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
