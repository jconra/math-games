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
// The game's maker: "Its fine if the landing gear is kind of magic and folds into itself". So a leg is ONE joined thing
// all the way up and down: it rides a LINE from its hip (where it leaves the hull) to its ankle (over the pad), and
// going up both ends move straight to their places in the well (kit/leafaim.js), the line turning and shortening as
// they go; its stages ride the line (the cylinder its hip, the piston its ankle, a stage between a share of the way),
// so they slide into each other and never leave each other; the pad rides the ankle with the piston; each brace its own
// line from its mount on the hull (still, in the well's mouth) to the knuckle on the leg, its sleeve the mount, its rod
// the knuckle, so the rod never leaves its sleeve and the brace never leaves the leg. Nothing swings out: the foot goes
// straight up and in.
// LEG: the pad's height, the ankle pin's over it, how far into the well the cylinder's top stands when down (e), how
// far over the shut doors the stowed pad stays (clear), how much of each stage stays in the one it slides in (overlap),
// the knuckle's height and its reach beyond the piston, how far a stage's end keeps from what it must not run into, and
// how far a mount's carriage on a track stands beyond its brace (a still mount's block: 6 cm)
export const LEG = { pad: 0.1, ankle: 0.07, e: 0.12, clear: 0.07, overlap: 0.1, knuckle: { h: 0.28, out: 0.08 }, keep: 0.03, carriage: 0.03 };
// the stages that slide in each other along a line from its a end to its b end, which is `long` metres long at its
// longest and `short` at its shortest: the first rides the a end (from 0 to its length from there), the last the b end,
// those between each a share of the way along (so at the shortest they lie side by side in the free stretch, and at the
// longest spread out); `top` keeps the first `top` metres short of the b end at the shortest (the knuckle), `bot` the
// last `bot` short of the a end (the mount block). Each { ride, len, span(L): [s0, s1] (from the a end, when the line
// is L long) }. The fewest that keep `overlap` in each other at the longest.
export function stagesOf(long, short, { top = 0, bot = 0, overlap = LEG.overlap, keep = LEG.keep, most = 5 } = {}) {
  const f0 = bot + keep, f1 = short - top - keep, l0 = f1, ln = short - f0;
  if (l0 <= 0.05 || ln <= 0.05) return null;
  const first = { ride: { from: 'a', at: 0 }, len: l0, span: () => [0, l0] }, last = { ride: { from: 'b', at: 0 }, len: ln, span: (L) => [L - ln, L] };
  for (let n = 2; n <= most; n++) {
    const m = n - 2;
    for (let h = (f1 - f0) / 2; h > 0.05; h -= 0.01) {
      const mids = Array.from({ length: m }, (_, j) => {
        const c = m === 1 ? (f0 + f1) / 2 : f0 + h + (f1 - f0 - 2 * h) * j / (m - 1), f = c / short;
        return { ride: { frac: f }, len: 2 * h, span: (L) => [f * L - h, f * L + h] };
      });
      const st = [first, ...mids, last];
      if (st.every((x, j) => j === 0 || st[j - 1].span(long)[1] - x.span(long)[0] >= overlap - 1e-9)) return st;
      if (m === 0) break;
    }
  }
  return null;
}
// A leg's whole plan, from its LEGS entry and the floor (the ship's frame, port +x, nose +z):
//   foot     the pad's middle on the floor, `splay` out from under the hip; hip, ankle (where its line runs, down)
//   line     { a: hip, av, b: ankle, bv } (kit/leafaim.js): up, the hip goes to up.a and the ankle to up.b
//   dir      the unit axis down the leg, down; length (down), long and short (its longest and shortest on the way);
//            lean (degrees out)
//   stages   the cylinder [0] .. the piston [n - 1] (stagesOf), each with its radius r
//   knee     the knuckle's middle, `kneeAt` metres up the line from the ankle (`knee` over the floor); rk its reach
//   braces   each { name, from (its mount: still, on the hull; or on a track, `track`), r, line { a: from, av,
//            b: { on: line, at: kneeAt } }, stages, long, short, angle (degrees between it and the leg, down)
//   pad      the pad rides the ankle with the piston (level when down: it tilts as the leg does on the way up); or,
//            padLevel, a leaf of its own that slides with the ankle, level all the way (where the leg folds far over)
//   well     its box [[x0, y0, z0], [x1, y1, z1]] (the hull rigs cut it); step: where the hull's side comes in over it,
//            its ceiling lower outboard: { x (outboard of it), low (the ceiling there) }
export function legPlan(L, floor, P = LEG) {
  const side = Math.sign(L.at[0]) || 0, sx = (q) => (side < 0 ? [-q[0], q[1], q[2]] : q);
  const foot = [L.at[0] + side * (L.splay || 0), floor, L.at[1]];
  const hip = [L.at[0], L.belly + P.e, L.at[1]], ankle = [foot[0], floor + P.pad + P.ankle, foot[2]];
  const up = { a: sx(L.stow.a), b: sx(L.stow.b) };
  const line = { a: hip, av: sub(up.a, hip), b: ankle, bv: sub(up.b, ankle) };
  const dir = unit(sub(ankle, hip)), length = len3(sub(ankle, hip));
  // (both ends move straight, so the line may be at its longest or shortest part way: looked at all the way)
  const at = (e, q) => add(q === 'a' ? hip : ankle, mul(q === 'a' ? line.av : line.bv, e));
  let long = 0, short = Infinity;
  for (let i = 0; i <= 100; i++) { const l = len3(sub(at(i / 100, 'a'), at(i / 100, 'b'))); long = Math.max(long, l); short = Math.min(short, l); }
  const lean = Math.acos(Math.min(1, -dir[1])) * 180 / Math.PI;
  const kneeAt = (L.knee - P.pad - P.ankle) / -dir[1], knee = add(ankle, mul(dir, -kneeAt)), K = P.knuckle;
  const stages = stagesOf(long, short, { top: kneeAt + K.h / 2 });
  if (!stages) throw new Error(`landing leg: it cannot fold between ${long.toFixed(2)} m and ${short.toFixed(2)} m`);
  const n = stages.length;
  stages.forEach((s, k) => { s.r = L.r * (1 - 0.38 * k / (n - 1)); });
  const rk = stages[n - 1].r + K.out;
  const braces = (L.braces || []).map((B) => {
    // (a mount on a track, `slide`: its block rides up the well's side as the leg rises, so the brace keeps nearly its
    // length; where the hull leaves the mount no room to stand away from where the leg comes in)
    const from = sx(B.from), av = B.slide ? sx(B.slide) : null, bl = { a: from, ...(av ? { av } : {}), b: { on: line, at: kneeAt } };
    let long = 0, shortB = Infinity;
    for (let i = 0; i <= 100; i++) {
      const e = i / 100, kp = add(at(e, 'b'), mul(unit(sub(at(e, 'a'), at(e, 'b'))), kneeAt));
      const l = len3(sub(kp, av ? add(from, mul(av, e)) : from)); long = Math.max(long, l); shortB = Math.min(shortB, l);
    }
    const st = stagesOf(long, shortB, { top: rk + P.keep, bot: (B.r + 0.06) });
    if (!st) throw new Error(`landing leg: its ${B.name} brace cannot fold from ${long.toFixed(2)} m to ${shortB.toFixed(2)} m`);
    st.forEach((s, k) => { s.r = B.r * (1 - 0.38 * k / (st.length - 1)); });
    const d = unit(sub(knee, from)), angle = Math.acos(Math.min(1, Math.abs(dot(d, dir)))) * 180 / Math.PI;
    return { name: B.name, from, r: B.r, line: bl, stages: st, long, short: shortB, angle, track: !!av };
  });
  const [wi, wo, wa, wf] = L.well, xs = side ? [L.at[0] - side * wi, L.at[0] + side * wo].sort((p, q) => p - q) : [L.at[0] - wi, L.at[0] + wo];
  const well = [[xs[0], 0.5, L.at[1] - wa], [xs[1], L.top + 0.02, L.at[1] + wf]];
  const step = L.step ? { x: side < 0 ? -L.step.x : L.step.x, low: L.step.low } : null;
  return { side, foot, hip, ankle, line, dir, length, long, short, lean, stages, n, knee, kneeAt, rk, braces, well, step, padLevel: !!L.padLevel };
}
// THE LEAVES THE KIT IS HANDED (built-common.js strutLeg; the tests pose these same ones): the plan's lines lowered
// into the piece's own frame (`deck` metres down: the ships' pieces are drawn with their deck at 0), so every part
// turns about the point it is drawn at. part: 'stage k' (the last carries the knuckle, and the pad but where it has its
// own) | 'brace NAME k' | 'pad'; each { part, aim } or { part, slide }
const lower = (q, deck) => (Array.isArray(q) ? [q[0], q[1] - deck, q[2]] : q);
export function kitLeaves(G, deck) {
  const line = { a: lower(G.line.a, deck), av: G.line.av, b: lower(G.line.b, deck), bv: G.line.bv };
  const out = G.stages.map((s, k) => ({ part: `stage ${k}`, aim: { ...line, ...s.ride } }));
  for (const B of G.braces) {
    const bl = { a: lower(B.line.a, deck), ...(B.line.av ? { av: B.line.av } : {}), b: { on: line, at: B.line.b.at } };
    B.stages.forEach((s, k) => out.push({ part: `brace ${B.name} ${k}`, aim: { ...bl, ...s.ride } }));
  }
  if (G.padLevel) out.push({ part: 'pad', slide: G.line.bv });
  return out;
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
// Each leg (the ship's frame: port +x, nose +z; a port leg's numbers, its starboard twin mirrored, but for what its own
// `starboard` gives where the hull is not the same on that side):
//   at [x, z]   where it leaves the hull; belly: the skin's height there (its hip stands LEG.e over it)
//   splay       how much further out its foot stands than that; r: its cylinder's radius; pad [across, along]
//   knee        the knuckle's middle, over the floor
//   stow { a, b } where its hip and its ankle are, up (in its well)
//   braces      each { name, from (its mount: a block standing in the well's mouth, its bolt here), r, slide (where
//               its block rides up a track in the well, up: none, where it stands still) }
//   top, well [in, out, aft, fore]: its well's top and how far its mouth reaches from `at` each way; step { x, low }:
//               outboard of x its ceiling is low, where the hull's side comes in (legPlan)
//   split (the axis its doors part along: 2 fore and aft, the default; 0 port and starboard), sink, one, up (how its
//   doors slide: doorSlide)
// floor: the ground in the ship's frame (the Miner stands STAND higher on its legs than its hull's own ground line).
// The wells are cut in the hull data (WELLS, DOORS) by the rigs in ~/pw/space-math/rigs/gear-2/; the numbers were
// tried there against the hull as it was before (rigs/gear-2/tools/design.mjs).
const mirror = (L) => Object.fromEntries(Object.entries(L).flatMap(([k, v]) => {
  if (!k.includes('port')) return [[k, v]];
  const { starboard = {}, ...p } = v;
  return [[k, p], [k.replace('port', 'starboard'), { ...p, ...starboard, at: [-p.at[0], p.at[1]], ...(p.one && p.split === 0 ? { one: -p.one } : {}) }]];
}));
export const LEGS = {
  // the Explorer: the nose leg under the cockpit, where it stood before these legs (z 4.2), upright, braced from ahead
  // and behind, folding back flat into its well as it rises; the aft two under the hull's sides, 2.31 m out (where its
  // old legs stood), leaning out 25 degrees (their feet inside the ship's own shape for bumps there, its wings' box
  // 6.6 m out), each braced from ahead and from behind, both mounts inboard of it (so seen from behind they come in from
  // inboard), their wells in the hull's side beside the cabin's walls, long along the ship (their doors slide out
  // together under the wing: aft, they would run past the stern); the hull is not quite the same each side, so each
  // side's leg stows its own way
  explorer: { floor: 0, legs: mirror({
    nose: { at: [0, 4.2], belly: 1.17, splay: 0, r: 0.16, pad: [0.5, 0.62], knee: 0.32, padLevel: true,
      stow: { a: [0, 1.676, 5.23], b: [0, 1.759, 3.91] }, top: 1.96, well: [0.27, 0.27, 1.27, 1.17], split: 0, sink: 0.4,
      braces: [{ name: 'fore', from: [0, 1.431, 5.193], r: 0.1 }, { name: 'aft', from: [0, 1.272, 3.115], r: 0.1 }] },
    port: { at: [2.31, -3.72], belly: 1.98, splay: 0.92, r: 0.2, pad: [0.62, 0.9], knee: 0.62,
      stow: { a: [2.403, 3.45, -2.741], b: [2.554, 2.494, -4.302] }, padLevel: true, top: 3.7, well: [0.24, 0.64, 1.48, 1.15], split: 0, one: 1, sink: 0.16, cutBelow: 2.95, cutDown: true,
      braces: [{ name: 'fore', from: [2.294, 2.321, -2.78], r: 0.12 }, { name: 'aft', from: [2.323, 2.338, -4.98], r: 0.12 }],
      starboard: { stow: { a: [2.327, 3.58, -4.86], b: [2.5, 2.86, -3.403] }, padLevel: true, top: 3.83, well: [0.24, 0.72, 1.48, 1.15],
        braces: [{ name: 'fore', from: [2.29, 2.333, -2.78], r: 0.12 }, { name: 'aft', from: [2.29, 2.351, -4.98], r: 0.12 }] } },
  }) },
  // the Miner: a pair under the cockpit's sides, their wells between the cockpit's lining and the hull's sides, long
  // along the ship, braced from their ends (the starboard cheek is narrower: 48 cm at the well's top from the lining to
  // the hull's side, so these legs are no thicker than that leaves room for, and the wells' ceilings step down outboard
  // where the cheek comes in); and the aft pair under the stern's block, hung from its inboard side and leaning out 28
  // degrees, braced from its outboard lip beside and behind them (the block is 1 m wide and 1.2 m long: there is no
  // room on it for a mount half a leg's length away), the braces' mounts riding up tracks in the well as they fold;
  // every foot outside the hull's edge; 13 cm longer (STAND)
  miner: { floor: -0.13, legs: mirror({
    'nose port': { at: [1.32, 3.75], belly: 1.36, splay: 0.76, r: 0.13, pad: [0.3, 0.72], knee: 0.38,
      stow: { a: [1.318, 2.418, 4.627], b: [1.441, 2.045, 3.449] }, top: 2.6, step: { x: 1.6, low: 2.3 }, well: [0.24, 0.41, 1.15, 1.15], sink: 0.32, cutBelow: 2.9, cutDown: true,
      braces: [{ name: 'fore', from: [1.37, 2.14, 4.708], r: 0.09 }, { name: 'aft', from: [1.293, 1.757, 2.79], r: 0.09 }],
      starboard: { padLevel: true, stow: { a: [1.261, 2.41, 4.738], b: [1.415, 2.01, 3.494] }, step: { x: 1.56, low: 2.15 }, cutBelow: 2.6, well: [0.24, 0.33, 1.15, 1.21],
        braces: [{ name: 'fore', from: [1.278, 2.11, 4.75], r: 0.09 }, { name: 'aft', from: [1.233, 1.788, 2.753], r: 0.09 }] } },
    port: { at: [1.32, -6.42], belly: 1.8, splay: 1.02, r: 0.24, pad: [0.62, 0.74], knee: 0.5, padLevel: true,
      stow: { a: [1.71, 3.409, -6.515], b: [1.331, 2.018, -6.558] }, top: 3.97, step: { x: 1.63, low: 3.7 }, well: [0.3, 0.73, 0.54, 0.3], sink: 0.45, up: true,
      braces: [{ name: 'out', from: [1.7, 2.028, -6.466], r: 0.14, slide: [0, 1.32, 0] }, { name: 'out aft', from: [1.62, 2.293, -6.72], r: 0.14, slide: [0, 1.3, 0] }],
      starboard: { stow: { a: [1.453, 3.715, -6.453], b: [1.371, 2.156, -6.517] }, top: 3.95, step: { x: 1.5, low: 3.85 }, well: [0.28, 0.66, 0.5, 0.3],
        braces: [{ name: 'out', from: [1.63, 2.297, -6.463], r: 0.14, slide: [0, 1.3, 0] }, { name: 'out aft', from: [1.642, 2.221, -6.664], r: 0.14, slide: [0, 1.36, 0] }] } },
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
