// THE OUTSIDE OF THE STATION, AS A PLAN: plain numbers (no three.js, so the tests read it), built round the REAL rooms
// of kit/rooms/station.json at their real size. kit/outside.js turns it into a few meshes.
//
// The game's maker, in his own words (this is the brief; nothing here goes beyond it):
//   2026-11-17  "it would look better with a thicker hull. Like several tiers of heavily beveled shapes so we don't
//               have any large flat surfaces. ... like overlapping armor that can deflect meteoroid impacts. I think
//               there should be an area on the opposite side (where the hauler would attach) where some cargo
//               containers have slots where they can connect into the station. ... I hope there can be upper and
//               lower levels that have windows (although we don't need to build them all out)."
//   2026-11-18  "I think it would be good to have a big plate sitting on-top of a flat wall section that is more than
//               10 meters or so. but I don't want everything to look like a pyramid. Some plate bulges should look
//               like shoulders and some flat surfaces should have a recessed beveled area in the middle of them. I
//               don't want the tiers to all be the same step, because that is boring."
//   2026-11-18  "When I say shoulders I am talking about the shape of the station, not the layout of panels on a flat
//               wall. ... It has bulky sections sticking up on either side that remind me of shoulders. Im trying
//               encourage shapes that don't look boring, like evenly spaced terraces. I like the C panel design"
//   2026-11-18  "Also, I didn't mean for all the terrace to be ripped out. It didnt look bad, just a bit boring. It
//               might look great with a layer of terrace above and below with some other unique bulky areas above
//               and below that. Maybe U shaped areas."
//   2026-11-18  (with a drawing over the roof seen from above: one red outline, two green squares, two yellow crossed
//               squares) "Can we make the roof look like this? With the red being the raised level and the green
//               being 2 landing pads. The yellow is just some pyramid type structure" and "I meant to draw it
//               symmetrical btw, just using the mouse to draw"; then "Can you put down a dark square with yellow
//               boundary and a circle inside on those exterior landing pads" and "It would be good to have some
//               doorways going to the landing pads also", with a door sketched on the middle arm's side wall
//               beside a pad, toward the back ("Maybe a door like this"); and of the circle: "maybe it can be a
//               bit smaller and have the lines between the lights"; "The doors look a bit small, are they human
//               size?"; "Can you slap some mottling texture on that landing pad? It looks way to clean and basic.It
//               also looks a bit too raised. Can you just remove the hull plates it sits on and lower it?"
//   2026-11-18  (the windows) "it would be cool if there was some randomness ... It makes it feel more lived in if
//               things change."
//
// THE SHAPE  (metres; x east, out of the hangar doors; y up from the hangars' floor; z south, toward the planet)
//   the body       ONE hull round the three hangars, the smelter (north end) and the medical centre (south end): the
//                  hangars' band in the middle with the three doors, ONE terrace above it and ONE below it with a band
//                  of windows each (their steps and heights differ), a flat plated roof and underside
//   the roof       as his drawing, the same on each side of its middle: ONE raised level, a strip along the back (the
//                  dock side) with three arms coming forward to the hangars' side: one at each end and one in the
//                  middle, which the spire stands on. In the two bays between the arms, down on the roof itself, a
//                  landing pad each. On each end arm a pyramid with its top cut off
//   the masses     below the lower terrace, two bulky bevelled masses, unlike each other: a block under the north end
//                  that runs out over it, and a long thick slab under the south half, on the dock side
//   the spire      above the middle hangar: a tower, the control centre with its windows, a mast and the beacon
//   the keel       below the middle hangar: the radiators round it, the reactor ball under it
//   the girders    out of the smelter end and out of the medical end, two pairs of solar wings on each
//   the west side  the lower hull round the terminal, the arena, the corridors, the quarters, the spine and the
//                  airlock (walls where the rooms' own walls are, so every real window stays where it is), a deck
//                  under them, and the cargo slots low on the dock side with three containers plugged in
// The plates are the lab's shape C (labs/hull/sample-plan.js): a big raised plate with a sunk bevelled panel on a flat
// stretch of 10 m or more, plain plates elsewhere. Laid with the station's own look (kit/hull-look.js STATION_LOOK).
import { offsetPath, SEAM, INSIDE } from './hull-plates.js';

const plates = (group, shapes) => ({ group, kind: 'plates', ...shapes }), ROW = { group: 'trim', kind: 'windows' };
// shape C: a big raised plate with a sunk panel wherever the stretch is big enough (the builder decides)
const BIG = { slab: { recess: true } };
// (on the hangars' band the big plate stands 0.67 m off the wall, just short of the game's own door frames at 0.68 m, so
// nothing beside a door hides more of the view out of it than its frame already does)
const BIG_BAND = { slab: { proud: 0.22, recess: true } };
// (a lower face: the panel is brought in less, so it still fits a plate 4 to 7 m tall)
const BIG_LOW = { slab: { inset: 1, recess: { inset: 0.8, depth: 0.4, cut: 0.4 } } };

// ── THE REAL ROOMS (checked against kit/rooms/station.json by the tests) ───────────────────────────────────────
export const HANGARS = [{ id: 'hangar-miner', z: -5 }, { id: 'hangar', z: 25 }, { id: 'hangar-medic', z: 55 }];
export const DOOR = { x: 59, w: 22, h: 9, jamb: 1, head: 2, face: 59.7 };       // (kit/station2.js bayDoor2: 24 m by 11 m in all, its outer face 0.7 m out)
// every opening the hull leaves for something real: the box that must stay clear of plates, and which way it looks
//   at: the middle of its foot; w along the wall, h up; out: the way it faces
export const OPENINGS = [
  ...HANGARS.map((h) => ({ name: 'door of ' + h.id, at: [59.02, 0, h.z], w: 22, h: 9, out: [1, 0, 0] })),
  { name: 'the terminal\'s long window', at: [1, 0.35, 37.03], w: 19.4, h: 6.4, out: [0, 0, 1] },
  { name: 'the quarters\' window', at: [-5.03, 1.45, 2], w: 1.5, h: 1.05, out: [-1, 0, 0] },
  { name: 'the quarters corridor\'s window (west)', at: [0, 1.45, -1.03], w: 1.5, h: 1.05, out: [0, 0, -1] },
  { name: 'the quarters corridor\'s window (east)', at: [2, 1.45, -1.03], w: 1.5, h: 1.05, out: [0, 0, -1] },
  { name: 'the smelter\'s high window', at: [33, 4.8, -31.02], w: 7.6, h: 1.65, out: [0, 0, -1] },
  { name: 'the airlock\'s outer door', at: [-15.03, 0, 31], w: 3.6, h: 2.9, out: [-1, 0, 0] },
];

// ── SIZES ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const SPIRE = { x: 40, z: 25 };                 // the spire and the keel stand over and under the middle hangar
const ROOF = 18.2, BELLY = -8.4;                       // the body's flat roof and underside
// the body's levels, as the tests read them: how far in each terrace's wall stands from the band's, and how tall it is
export const LEVELS = { band: { foot: -1.4, top: 12 }, upper: { in: 3.8, wall: 3.2, slope: 2 }, lower: { in: 2.6, wall: 3.6, slope: 2.4 }, roof: ROOF, belly: BELLY };

// an outline walked with the outside on the right: a box with its corners cut ([north-east, north-west, south-west, south-east])
function boxPath(x0, x1, z0, z1, c = 0) {
  const [ne, nw, sw, se] = Array.isArray(c) ? c : [c, c, c, c], P = [[x1, z1 - se], [x1, z0 + ne], [x1 - ne, z0], [x0 + nw, z0], [x0, z0 + nw], [x0, z1 - sw], [x0 + sw, z1], [x1 - se, z1]];
  return P.filter((p, i) => { const q = P[(i + 1) % P.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
}

// ── A FLAT REGION OF ANY OUTLINE, with holes in it, cut into bands across x and laid as flats ────────────────────
// (the kit's builder lays strips; a roof is cut into strips here: one between every two z values where the outline or
// a hole has a corner, or where a hole's side crosses the outline's)
//   up: true, a roof (seen from above); false, an underside.  part(w, h): the band's part, by its size
export function flatsOf(outer, holes, y, up, part) {
  const rings = [outer, ...holes], edges = [], zs = [];
  rings.forEach((r, ri) => r.forEach((a, i) => { const b = r[(i + 1) % r.length]; zs.push(a[1]); if (Math.abs(a[1] - b[1]) > 1e-9) edges.push({ a, b, ring: ri }); }));
  const xAt = (e, z) => e.a[0] + (e.b[0] - e.a[0]) * (z - e.a[1]) / (e.b[1] - e.a[1]);
  for (const e of edges) for (const f of edges) {
    if (e.ring >= f.ring) continue;
    const se = (e.b[0] - e.a[0]) / (e.b[1] - e.a[1]), sf = (f.b[0] - f.a[0]) / (f.b[1] - f.a[1]); if (Math.abs(se - sf) < 1e-9) continue;
    const z = (f.a[0] - sf * f.a[1] - e.a[0] + se * e.a[1]) / (se - sf);
    if (z > Math.min(e.a[1], e.b[1]) + 1e-6 && z < Math.max(e.a[1], e.b[1]) - 1e-6 && z > Math.min(f.a[1], f.b[1]) + 1e-6 && z < Math.max(f.a[1], f.b[1]) - 1e-6) zs.push(z);
  }
  zs.sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k + 1 < zs.length; k++) {
    const za = zs[k], zb = zs[k + 1], H = zb - za; if (H < 0.02) continue;
    const zm = (za + zb) / 2, cross = edges.filter((e) => Math.min(e.a[1], e.b[1]) < zm && Math.max(e.a[1], e.b[1]) > zm).sort((e, f) => xAt(e, zm) - xAt(f, zm));
    let inOuter = false, left = null; const open = new Set();
    for (const e of cross) {
      const was = inOuter && !open.size;
      if (e.ring === 0) inOuter = !inOuter; else if (open.has(e.ring)) open.delete(e.ring); else open.add(e.ring);
      const now = inOuter && !open.size;
      if (!was && now) left = e;
      else if (was && !now) {
        const l0 = xAt(left, up ? zb : za), r0 = xAt(e, up ? zb : za), l1 = xAt(left, up ? za : zb), r1 = xAt(e, up ? za : zb);
        if (Math.max(r0 - l0, r1 - l1) < 0.05) continue;
        // (a side against a hole is an inside corner: something stands up out of the hole)
        out.push({ ...part(Math.min(r0, r1) - Math.max(l0, l1), H), O: [0, y, up ? zb : za], U: [1, 0, 0], V: [0, 0, up ? -1 : 1], quad: [[l0, 0], [r0, 0], [r1, H], [l1, H]],
          kinds: [SEAM, e.ring ? INSIDE : SEAM, SEAM, left.ring ? INSIDE : SEAM] });
      }
    }
  }
  return out;
}
// (a band gets its big plate if its narrow way is at least `least` m, and no more than `most`: one plate 28 m by 30 m is not armour)
const plain = () => plates('tiers'), bigIf = (least, most = 16) => (w, h) => plates('tiers', Math.min(w, h) >= least && Math.min(w, h) <= most ? BIG : {});

// ── THE BODY ────────────────────────────────────────────────────────────────────────────────────────────────────
// its outline at the band's wall: the east face is the hangars' own door wall, the ends are the smelter's and the
// medical centre's own end walls, the west face the hangars' own west wall; the four corners are cut
export const BODY_PATH = [[59.02, 71], [59.02, -21], [53.5, -31.02], [26.5, -31.02], [18.93, -20.5], [18.93, 70.5], [32.5, 85.02], [51.5, 85.02]];
const WIN = { w: 2.6, h: 1.05, pitch: 4.2, lip: 0.3, sink: 0.14, panes: 2, bar: 0.09, cut: 0.3, lit: 0.5 };
const spirePath = boxPath(SPIRE.x - 5, SPIRE.x + 5, SPIRE.z - 5, SPIRE.z + 5, 2.2);

// THE ROOF, AS HIS DRAWING. Everything on it is the same on each side of the line z = MID (the roof's own middle is
// z = 27 and the spire stands at z = 25: MID is between the two, so neither is seen to be off).
//   the raised level   its outline seen from above: the east faces of the three arms at x = 51.4, the two bays cut back
//                      to x = 31.5 (so the strip along the back is 5 m wide), every outer corner cut; 4.8 m tall
//   the pads           one in each bay, lying on the roof itself with no plates under it: a dark mottled square 20 m
//                      across (the game's ships are 16 to 20 m long), a yellow boundary, a yellow circle inside, a
//                      small light at each corner (all in the gear, below)
//   the doorways       one to each pad, where he sketched it: in the middle arm's side wall (the spire's side),
//                      toward the back; a framed two-leaf door 3 m wide and 2.6 m tall with a small light over it
//   the pyramids       one on each end arm: 7 m across at the foot, 4.3 m tall, its top cut off 1.6 m across
export const MID = 26, RAISED = { to: 4.8, bevel: 1.6, front: 51.4, back: 26.5, bay: 31.5, bays: [[41, 63], [-11, 11]], ends: [-24, 76] };
const mirror = (path) => path.map(([x, z]) => [x, 2 * MID - z]).reverse();     // (the same outline on the other side of MID, walked the same way round)
const RAISED_PATH = (() => {
  const R = RAISED, [n, s] = R.ends, f = R.front, b = R.back, [[s0, s1], [n0, n1]] = R.bays;
  return [[f, s - 6], [f, s1], [R.bay, s1], [R.bay, s0], [f, s0], [f, n1], [R.bay, n1], [R.bay, n0], [f, n0], [f, n + 6], [f - 6, n], [b + 9, n], [b, n + 9], [b, s - 9], [b + 9, s], [f - 6, s]];
})();
const padSouth = boxPath(32.5, 52.5, 42, 62), pyramidSouth = boxPath(38.5, 45.5, 66, 73);
export const PADS = [{ name: 'south landing pad', path: padSouth, at: [42.5, 52] }, { name: 'north landing pad', path: mirror(padSouth), at: [42.5, 2 * MID - 52] }].map((p) => ({ ...p, tall: 0.36, square: 10, ring: 5 }));   // (tall: its top above the roof, 4 cm over the plates round it)
export const PYRAMIDS = [{ name: 'south pyramid', path: pyramidSouth }, { name: 'north pyramid', path: mirror(pyramidSouth) }].map((p) => ({ ...p, foot: 0.5, tall: 4.3, slope: 2.7 }));

// THE MASSES (each its own closed outline; `to`: how far above the roof or below the underside it reaches)
// (a doorway in a wall 3.2 m tall under its bevel, framed; its foot is at the top of the roof's plates; `at` is its middle
// along its wall; x, z: the same place in the world, and `out` the way it faces along z; its leaves and light are in the gear)
export const PAD_DOOR = { w: 3, h: 2.6, x: 37, foot: 0.3 };
const padDoor = (d) => ({ tier: 0, step: 0, run: d.run, at: d.at, w: PAD_DOOR.w, h: PAD_DOOR.h, y: ROOF + PAD_DOOR.foot, sill: 0, head: 0.25, jamb: 0.25, proud: 0.12, shield: false });
export const PAD_DOORS = [{ run: 3, at: PAD_DOOR.x - RAISED.bay, pad: 0, x: PAD_DOOR.x, z: RAISED.bays[0][0], out: 1 }, { run: 5, at: RAISED.front - PAD_DOOR.x, pad: 1, x: PAD_DOOR.x, z: RAISED.bays[1][1], out: -1 }];
export const MASSES = [
  { name: 'raised level', side: 'above', path: RAISED_PATH, to: RAISED.to, bevel: RAISED.bevel, doors: PAD_DOORS.map(padDoor), holes: () => [offsetPath(spirePath, 3.2, true), ...PYRAMIDS.map((p) => p.path)] },
  { name: 'north belly block', side: 'below', path: boxPath(35, 48, -31.62, -4, [3, 3, 2, 2]), to: 3.8, bevel: 1.5, over: 'north' },
  { name: 'south belly slab', side: 'below', path: boxPath(27, 42, 36, 70, 4), to: 5.2, bevel: 2 },
];
function massPlan(m, seed) {
  const up = m.side === 'above', L = LEVELS, end = up ? ROOF + m.to : BELLY - m.to, tiers = [];
  if (up) {
    // (a mass that runs out over the station's end comes down over the terrace to the band's top, 0.6 m proud of it)
    const profile = m.over ? [[-0.6, L.band.top], [0, L.band.top + 0.6], [0, ROOF, 'in'], [0, end - m.bevel], [-m.bevel, end]] : [[0, ROOF, 'in'], [0, end - m.bevel], [-m.bevel, end]];
    tiers.push({ name: m.name, profile, parts: m.over ? [plates('tiers'), plates('band', BIG_LOW), plates('band', BIG_LOW), plates('tiers')] : [plates('band', BIG_LOW), plates('tiers')] });
  } else {
    const profile = m.over ? [[-m.bevel, end], [0, end + m.bevel], [0, BELLY, 'in'], [0, L.band.foot - 0.6], [-0.6, L.band.foot]] : [[-m.bevel, end], [0, end + m.bevel], [0, BELLY, 'in']];
    tiers.push({ name: m.name, profile, parts: m.over ? [plates('tiers'), plates('band', BIG_LOW), plates('band', BIG_LOW), plates('tiers')] : [plates('tiers'), plates('band', BIG_LOW)] });
  }
  return { name: m.name, closed: true, path: m.path, tiers, ...(m.doors ? { doors: m.doors } : {}), windows: { ...WIN, seed }, flats: flatsOf(offsetPath(m.path, -m.bevel, true), m.holes ? m.holes() : [], end, up, bigIf(4)) };
}
// a pyramid with its top cut off, standing on the raised level
function pyramidPlan(p) {
  const y0 = ROOF + RAISED.to, top = y0 + p.tall;
  return { name: p.name, closed: true, path: p.path, tiers: [{ name: p.name, profile: [[0, y0, 'in'], [0, y0 + p.foot], [-p.slope, top]], parts: [plates('band'), plates('tiers')] }], flats: flatsOf(offsetPath(p.path, -p.slope, true), [], top, true, plain) };
}

function bodyPlan(o) {
  const L = LEVELS, up = L.upper, lo = L.lower, f = L.band.foot, t = L.band.top, real = o.inside ? { frame: false, shield: false } : {};
  const tiers = [
    { name: 'lower terrace', profile: [[-lo.in - 3, BELLY], [-lo.in, f - 1 - lo.wall], [-lo.in, f - 1, 'in']], parts: [plates('tiers'), ROW] },
    { name: 'hangar band', profile: [[-lo.in, f - 1, 'in'], [-1, f - 1], [0, f], [0, t], [-1, t + 1], [-up.in, t + 1, 'in']], parts: [plates('tiers'), plates('band'), plates('band', BIG_BAND), plates('band'), plates('tiers')] },
    { name: 'upper terrace', profile: [[-up.in, t + 1, 'in'], [-up.in, t + 1 + up.wall], [-up.in - 2.2, ROOF]], parts: [ROW, plates('tiers')] },
  ];
  const doors = [
    // the three hangar doors (the east wall is run 0, walked north from z = 71): the kit's frame stands where the
    // game's own door frame does; inside the game the frame and the shield are the game's own
    ...HANGARS.map((h) => ({ tier: 1, step: 2, run: 0, at: 71 - h.z, w: DOOR.w, h: DOOR.h, y: 0, sill: 0, head: DOOR.head, jamb: DOOR.jamb, proud: DOOR.face - 59.02, ...real })),
    // the ways from the spine into the hangars go through the west wall (run 4, walked south from z = -20.5)
    ...HANGARS.map((h) => ({ tier: 1, step: 2, run: 4, at: h.z + 20.5, w: 4.3, h: 3.6, y: -0.2, sill: 0, head: 0, jamb: 0, frame: false, shield: false })),
    // the smelter's high window in the north end (run 2, walked west from x = 53.5)
    { tier: 1, step: 2, run: 2, at: 53.5 - 33, w: 7.6, h: 1.65, y: 4.8, sill: 0, head: 0, jamb: 0, frame: false, shield: false, ...(o.inside ? {} : { glass: 0.85 }) },
  ];
  const holesUp = [...MASSES.filter((m) => m.side === 'above').map((m) => m.path), ...PADS.map((p) => p.path)];   // (the spire stands on the raised level; a pad lies in a hole in the roof's plates)
  const holesDown = [...MASSES.filter((m) => m.side === 'below').map((m) => m.path), offsetPath(spirePath, 1.6, true)];
  const flats = [...flatsOf(offsetPath(BODY_PATH, -up.in - 2.2, true), holesUp, ROOF, true, bigIf(7)), ...flatsOf(offsetPath(BODY_PATH, -lo.in - 3, true), holesDown, BELLY, false, bigIf(7))];
  return { name: 'body', closed: true, path: BODY_PATH, tiers, doors, flats, windows: { ...WIN, seed: o.seed } };
}

// ── THE SPIRE AND THE KEEL ──────────────────────────────────────────────────────────────────────────────────────
export const SPIRE_TOP = 63, KEEL_FOOT = -40;
function spirePlan(o) {
  const R = ROOF + RAISED.to;                            // (its foot stands on the raised level)
  const profile = [[3.2, R, 'in'], [3.2, R + 2], [1.4, R + 3.4], [0, R + 3.4, 'in'], [0, 33], [-0.6, 33.6], [-0.6, 40], [3.4, 44.6], [3.4, 48], [2.2, 49.2], [-1.6, 49.2, 'in'], [-1.6, 62], [-2.6, SPIRE_TOP]];
  const parts = [plates('band'), plates('tiers'), plates('tiers'), plates('band', BIG), plates('tiers'), plates('band'), plates('tiers'), ROW, plates('tiers'), plates('tiers'), plates('band', BIG), plates('tiers')];
  // (the control centre is one room: all its windows are lit, and they are bigger than the hull's)
  return { name: 'spire', closed: true, path: spirePath, tiers: [{ name: 'spire', profile, parts }], windows: { ...WIN, w: 2.2, h: 1.8, pitch: 2.9, lip: 0.4, sink: 0.15, cut: 0.4, lit: 1, bar: 0.1, seed: o.seed },
    flats: flatsOf(offsetPath(spirePath, -2.6, true), [], SPIRE_TOP, true, plain) };
}
function keelPlan(o) {
  const profile = [[-1.4, KEEL_FOOT], [0, KEEL_FOOT + 1.4], [0, -24], [0.8, -23.2], [0.8, -13.4], [1.6, -12.4], [1.6, BELLY, 'in']];
  const parts = [plates('tiers'), plates('band', BIG), plates('tiers'), plates('band'), plates('tiers'), plates('band')];
  return { name: 'keel', closed: true, path: spirePath, tiers: [{ name: 'keel', profile, parts }], windows: { ...WIN, seed: o.seed }, flats: flatsOf(offsetPath(spirePath, -1.4, true), [], KEEL_FOOT, false, plain) };
}

// ── THE WEST SIDE: the hull round the rooms west of the hangars, as walls and roofs given outright ───────────────
// (walls 3 cm outside the rooms' own, walked with the outside on the right; they stop at the body's own west wall; the low rooms' roof at 3.1 m, the terminal's
// and the arena's at 8 m; everything stands on the deck below, whose top is 0.7 m under the floors)
const FOOT = -0.7, LOW = 3.1, TALL = 8;
function westFlats(o) {
  const S = SEAM, I = INSIDE, flats = [];
  const wall = (ax, az, bx, bz, y0, y1, kinds, doors) => { const l = Math.hypot(bx - ax, bz - az); flats.push({ group: 'band', kind: 'plates', O: [ax, y0, az], U: [(bx - ax) / l, 0, (bz - az) / l], V: [0, 1, 0], w: l, h: y1 - y0, kinds, doors, ...BIG }); };
  const roof = (x0, x1, z0, z1, y, shapes) => flats.push({ group: 'tiers', kind: 'plates', O: [x0, y, z1], U: [1, 0, 0], V: [0, 0, -1], w: x1 - x0, h: z1 - z0, ...shapes });
  // an opening for something real: in the lab a pane of glass across it; inside the game nothing (the room's own is there)
  const hole = (at, w, y, h, glass) => ({ at, w, y, h, sill: 0, head: 0, jamb: 0, frame: false, shield: false, ...(o.inside || glass == null ? {} : { glass }) });
  wall(18.93, -7.03, 12.93, -7.03, FOOT, LOW);                                                     // the spine's north end
  wall(12.93, -7.03, 12.93, -1.03, FOOT, LOW, [S, I, S, S]);
  wall(12.93, -1.03, -1.03, -1.03, FOOT, LOW, [S, S, S, I], [hole(10.93, 1.5, 1.45, 1.05, 0.8), hole(12.93, 1.5, 1.45, 1.05, 0.04)]);   // the loop hallway and the quarters corridor: its two windows
  wall(-1.03, -1.03, -1.03, 0.97, FOOT, LOW, [S, I, S, S]);
  wall(-1.03, 0.97, -5.03, 0.97, FOOT, LOW, [S, S, S, I]);                                        // the quarters
  wall(-5.03, 0.97, -5.03, 5.03, FOOT, LOW, undefined, [hole(1.03, 1.5, 1.45, 1.05, 0.8)]);       // ... and their window
  wall(-5.03, 5.03, -1.03, 5.03, FOOT, LOW, [S, I, S, S]);
  wall(-1.03, 5.03, -1.03, 20.97, FOOT, LOW, [S, I, S, I]);                                       // the corridor
  wall(-1.03, 20.97, -9.03, 20.97, FOOT, TALL);                                                   // the terminal's north wall
  wall(-9.03, 20.97, -9.03, 37.03, FOOT, TALL, undefined, [hole(10.03, 4.8, FOOT, LOW + 0.37 - FOOT)]);   // its west wall (the airlock comes through it)
  wall(-9.03, 28.97, -15.03, 28.97, FOOT, LOW, [S, S, S, I]);                                     // the airlock
  wall(-15.03, 28.97, -15.03, 33.03, FOOT, LOW, undefined, [hole(2.03, 3.6, 0, 2.9, 0.04)]);      // ... and its outer door
  wall(-15.03, 33.03, -9.03, 33.03, FOOT, LOW, [S, I, S, S]);
  wall(-9.03, 37.03, 12.93, 37.03, FOOT, TALL, undefined, [hole(10.03, 19.4, 0.35, 6.4, 0.3)]);   // the terminal's south wall: the long window, toward the planet
  wall(12.93, 37.03, 12.93, 57.03, FOOT, LOW, [S, S, S, I]);                                      // the spine, south of the terminal
  wall(12.93, 57.03, 18.93, 57.03, FOOT, LOW);
  // the terminal's and the arena's walls above the low roofs
  // (the arena's east wall is the spine's west wall, x = 13: above the spine's roof the tall wall stands just east of it)
  wall(12.93, 37.03, 13.03, 37.03, LOW, TALL, [I, S, S, S]); wall(13.03, 37.03, 13.03, 2.97, LOW, TALL, [I, S, S, S]); wall(13.03, 2.97, 2.97, 2.97, LOW, TALL, [I, S, S, S]);
  wall(2.97, 2.97, 2.97, 20.97, LOW, TALL, [I, S, S, S]); wall(2.97, 20.97, -1.03, 20.97, LOW, TALL, [I, S, S, S]);
  // the roofs
  roof(12.93, 18.93, -7.03, 2.97, LOW); roof(13.03, 18.93, 2.97, 37.03, LOW); roof(12.93, 18.93, 37.03, 57.03, LOW); roof(-1.03, 12.93, -1.03, 2.97, LOW); roof(-1.03, 2.97, 2.97, 20.97, LOW); roof(-5.03, -1.03, 0.97, 5.03, LOW); roof(-15.03, -9.03, 28.97, 33.03, LOW);
  roof(2.97, 13.03, 2.97, 20.97, TALL, BIG); roof(-9.03, 13.03, 20.97, 37.03, TALL, BIG);
  return flats;
}
// THE DECK under the west rooms (their lower level), and the cargo slots in its dock face
export const SLOTS = { x: -7, z: [3.5, 8, 12.5, 17], w: 2.9, h: 2.9, foot: -4.75, full: [0, 1, 2] };   // (the fourth slot is empty)
export const DECK_PATH = [[25.5, -9.6], [9, -9.6], [-7, -3.5], [-7, 22], [-21, 22], [-21, 38], [-6, 42.5], [25.5, 62]];
const SLOT_DECK = -5.02;                                // (the cargo deck's top; its plates stand a bevel higher)
function deckPlans(o) {
  const tiers = [{ name: 'west deck', profile: [[-2.6, -7.8], [0, -5.2], [0, FOOT - 0.6], [-0.6, FOOT]], parts: [plates('tiers'), plates('band', BIG), plates('tiers')] }];
  // the cargo slots: framed sockets in the dock face (run 2, walked south from z = -3.5), lit where nothing is plugged in
  const doors = SLOTS.z.map((z) => ({ tier: 0, step: 1, run: 2, at: z + 3.5, w: SLOTS.w, h: SLOTS.h, y: SLOTS.foot - 0.25, sill: 0.25, head: 0.4, jamb: 0.45, proud: 0.4, glass: 0.55 }));
  const flats = [...flatsOf(offsetPath(DECK_PATH, -0.6, true), [], FOOT, true, plain), ...flatsOf(offsetPath(DECK_PATH, -2.6, true), [], -7.8, false, plain)];
  const pad = boxPath(-23.5, -5, 0.8, 22.4);
  return [{ name: 'west deck', closed: true, path: DECK_PATH, tiers, doors, flats, windows: { ...WIN, seed: o.seed } },
    { name: 'cargo deck', closed: true, path: pad, tiers: [{ name: 'cargo deck', profile: [[-1, -6.3], [0, -5.5], [0, SLOT_DECK]], parts: [plates('tiers'), plates('tiers')] }],
      flats: [...flatsOf(pad, [], SLOT_DECK, true, plain), ...flatsOf(offsetPath(pad, -1, true), [], -6.3, false, plain)] }];
}

// THE WHOLE OUTSIDE as plans for kit/hull.js buildHull.
//   inside   true: for the game, where the real rooms stand inside it: no frame, shield or glass of the hull's own
//            in any real opening (the rooms bring theirs)
//   seed     which half of the hull's windows are lit (the game gives a fresh number each time it starts)
export function outsidePlans(opts = {}) {
  const o = { inside: !!opts.inside, seed: opts.seed ?? 11 };
  return [bodyPlan(o), ...MASSES.map((m) => massPlan(m, o.seed)), ...PYRAMIDS.map(pyramidPlan), spirePlan(o), keelPlan(o), { name: 'west rooms', flats: westFlats(o), windows: { ...WIN, seed: o.seed } }, ...deckPlans(o)];
}

// ── THE GEAR: what is not plated hull (girders, solar wings, radiators, the reactor, masts, containers, lights) ──
// plain boxes, rods, balls and rings in one list of triangles, each corner carrying its colour; and a second list of
// the things that glow by themselves
export const GIRDER = { x: 40, y: 4.4, half: 2.5, runs: [[-31.2, -105], [85.8, 159.6]], wings: [30, 58], wingW: 22, wingFrom: 6, wingTo: 40 };
// (the paint on the containers and the cargo deck: made-up marks, the station's own sign and a number, no company's name)
export const MARKS = [
  { text: '01', slot: 0 }, { text: '02', slot: 1 }, { text: '03', slot: 2 }, { text: '04', slot: 3 },
  { text: 'π 04·117', box: 0 }, { text: 'π 22·908', box: 1 }, { text: 'π 31·455', box: 2 },
];
const BOX_COLOURS = ['#2f62b8', '#a8392f', '#2c8a57'], BOX = { len: 12.2, w: 2.44, h: 2.6 };
const lin = (hex, k = 1) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2) * k); };
class Tris {
  constructor() { this.position = []; this.color = []; this.index = []; }
  get count() { return this.position.length / 3; }
  vert(p, c) { this.position.push(p[0], p[1], p[2]); this.color.push(c[0], c[1], c[2]); return this.count - 1; }
  // a box: its middle, its three half-sizes along the axes ax, ay, az (unit vectors; the world's, if not given)
  box(c, h, col, ax = [1, 0, 0], ay = [0, 1, 0], az = [0, 0, 1]) {
    const b = this.count;
    for (let i = 0; i < 8; i++) { const s = [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]; this.vert([0, 1, 2].map((k) => c[k] + ax[k] * h[0] * s[0] + ay[k] * h[1] * s[1] + az[k] * h[2] * s[2]), col); }
    for (const q of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) this.index.push(b + q[0], b + q[1], b + q[2], b + q[0], b + q[2], b + q[3]);
  }
  // a square rod from a to b, t thick
  rod(a, b, t, col) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d), az = d.map((v) => v / l), up = Math.abs(az[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let ax = [up[1] * az[2] - up[2] * az[1], up[2] * az[0] - up[0] * az[2], up[0] * az[1] - up[1] * az[0]]; const n = Math.hypot(...ax); ax = ax.map((v) => v / n);
    const ay = [az[1] * ax[2] - az[2] * ax[1], az[2] * ax[0] - az[0] * ax[2], az[0] * ax[1] - az[1] * ax[0]];
    this.box([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [t / 2, t / 2, l / 2], col, ax, ay, az);
  }
  // an upright drum
  drum(c, r, h, col, seg = 10) {
    const b = this.count;
    for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; for (const y of [-h / 2, h / 2]) this.vert([c[0] + Math.cos(a) * r, c[1] + y, c[2] + Math.sin(a) * r], col); }
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; this.index.push(b + i * 2, b + i * 2 + 1, b + j * 2 + 1, b + i * 2, b + j * 2 + 1, b + j * 2); if (i > 0 && i < seg - 1) this.index.push(b + 1, b + j * 2 + 1, b + i * 2 + 1, b, b + i * 2, b + j * 2); }
  }
  ball(c, r, col, seg = 12) {
    const b = this.count, rows = Math.max(3, Math.round(seg * 0.6));
    for (let j = 0; j <= rows; j++) for (let i = 0; i < seg; i++) { const v = j / rows * Math.PI, a = i / seg * Math.PI * 2; this.vert([c[0] + Math.sin(v) * Math.cos(a) * r, c[1] + Math.cos(v) * r, c[2] + Math.sin(v) * Math.sin(a) * r], col); }
    for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) { const k = (i + 1) % seg, p = b + j * seg, q = p + seg; if (j > 0) this.index.push(p + i, p + k, q + k); if (j < rows - 1) this.index.push(p + i, q + k, q + i); }
  }
  // a level ring
  ring(c, R, r, col, seg = 28, tube = 6) {
    const b = this.count;
    for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) { const a = i / seg * Math.PI * 2, t = j / tube * Math.PI * 2, d = R + Math.cos(t) * r; this.vert([c[0] + Math.cos(a) * d, c[1] + Math.sin(t) * r, c[2] + Math.sin(a) * d], col); }
    for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) { const i2 = (i + 1) % seg, j2 = (j + 1) % tube, p = b + i * tube + j, q = b + i2 * tube + j, p2 = b + i * tube + j2, q2 = b + i2 * tube + j2; this.index.push(p, p2, q2, p, q2, q); }
  }
  // a flat four-cornered face
  quad(p, col) { const b = this.count; for (const q of p) this.vert(q, col); this.index.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  arrays() { return { position: new Float32Array(this.position), color: new Float32Array(this.color), index: new Uint32Array(this.index), triangles: this.index.length / 3 }; }
}
//   inside   true: for the game (the real rooms are there). Otherwise a plain dim room is put behind each hangar door,
//            so that the door's shield has something behind it where the hangars are not built
export function outsideGear(opts = {}) {
  const G = new Tris(), L = new Tris(), X = SPIRE.x, Z = SPIRE.z;
  const steel = lin('#59606b'), dark = lin('#2c3038'), gold = lin('#a8843a'), cell = lin('#16234f'), frame = lin('#3a3320'), pale = lin('#8f96a0'), yellow = lin('#c9a232');
  const red = lin('#ff3a24', 2.2), white = lin('#f2f5ff', 1.6), hot = lin('#ff7a1c', 1.5), teal = lin('#58e0d0', 1.5);
  // the spire's mast and beacon
  G.drum([X, SPIRE_TOP + 6.5, Z], 0.45, 13, steel, 8); L.ball([X, SPIRE_TOP + 15, Z], 2.2, white, 14); L.ball([X, SPIRE_TOP + 17.9, Z], 0.6, red, 8);
  // the keel: four radiators round it, each with its hot face; the reactor ball under it in its ring, four struts, a mast
  for (const a of [45, 135, 225, 315]) {
    const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180), out = [c, 0, s], side = [-s, 0, c];
    G.box([X + c * 14.5, -27, Z + s * 14.5], [9.5, 10.5, 0.3], dark, out, [0, 1, 0], side);
    L.box([X + c * 10.6, -27, Z + s * 10.6], [4.6, 9.4, 0.38], hot, out, [0, 1, 0], side);
    G.rod([X + c * 4.6, KEEL_FOOT + 0.6, Z + s * 4.6], [X + c * 9.2, -49.5, Z + s * 9.2], 0.7, steel);
  }
  G.ball([X, -49.5, Z], 7.5, pale, 16); L.ring([X, -49.5, Z], 9.2, 0.45, teal);
  G.drum([X, -61.5, Z], 0.4, 9, steel, 8); L.ball([X, -66.6, Z], 0.6, red, 8);
  // the two girders, and the solar wings standing above and below each to face the low sun
  const g = GIRDER, h = g.half;
  for (const [z0, z1] of g.runs) {
    const dir = Math.sign(z1 - z0), len = Math.abs(z1 - z0), bays = Math.round(len / 7.4), bay = len / bays;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) G.rod([g.x + sx * h, g.y + sy * h, z0], [g.x + sx * h, g.y + sy * h, z1], 0.45, steel);
    for (let k = 0; k <= bays; k++) {
      const z = z0 + dir * k * bay, zn = z + dir * bay, c = [[-h, -h], [h, -h], [h, h], [-h, h]];
      for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; G.rod([g.x + a[0], g.y + a[1], z], [g.x + b[0], g.y + b[1], z], 0.32, steel); if (k < bays) { const [p, q] = (k + i) % 2 ? [a, b] : [b, a]; G.rod([g.x + p[0], g.y + p[1], z], [g.x + q[0], g.y + q[1], zn], 0.28, steel); } }
    }
    L.ball([g.x, g.y, z1 + dir * 1.2], 0.8, red, 8);
    for (const d of g.wings) for (const up of [-1, 1]) {
      const zc = z0 + dir * d, y0 = g.y + up * g.wingFrom, y1 = g.y + up * g.wingTo, ym = (y0 + y1) / 2, hh = Math.abs(y1 - y0) / 2, hw = g.wingW / 2;
      G.drum([g.x, g.y + up * 4.2, zc], 1, 3.6, gold, 10);
      G.box([g.x, ym, zc], [0.18, hh, hw], frame);
      // (each wing: two columns of four dark cells, the frame showing between them)
      for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) G.box([g.x, y0 + up * (hh * 2) * (j + 0.5) / 4, zc - hw + hw * (i + 0.5)], [0.26, hh / 4 - 0.22, hw / 2 - 0.22], cell);
    }
  }
  // the landing pads, as he asked: "a dark square with yellow boundary and a circle inside", lying on the roof with no
  // plates under it, and mottled ("It looks way to clean and basic"): the square's top is a grid of small faces whose
  // corners carry a blotchy dark grey (the same blotches every time); the boundary and the circle are low yellow kerbs
  // in short lengths, each worn a little differently; a small light at each corner
  const hash2 = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  const soft = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v); return (hash2(i, j) * (1 - a) + hash2(i + 1, j) * a) * (1 - b) + (hash2(i, j + 1) * (1 - a) + hash2(i + 1, j + 1) * a) * b; };
  const blotch = (x, z) => 0.5 * soft(x * 0.33, z * 0.33) + 0.3 * soft(x * 0.95 + 7, z * 0.95 + 3) + 0.2 * soft(x * 2.6 + 11, z * 2.6 + 5);
  const padDark = lin('#0b0c10'), padPale = lin('#626a78'), worn = (c, x, z) => { const k = 0.5 + 0.75 * blotch(x * 1.7 + 31, z * 1.7 + 17); return c.map((v) => v * k); };
  for (const p of PADS) {
    const [px, pz] = p.at, q = p.square, top = ROOF + p.tall, k = top + 0.05, N = 36, first = G.count;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = px - q + 2 * q * i / N, z = pz - q + 2 * q * j / N, t = Math.min(1, Math.max(0, (blotch(x, z) - 0.3) / 0.42));
      G.vert([x, top, z], padDark.map((v, c) => v + (padPale[c] - v) * t * (0.35 + 0.65 * t)));
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = first + j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; G.index.push(a, c, b, b, c, d); }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) G.quad([[px + dx * q - dz * q, ROOF, pz + dz * q - dx * q], [px + dx * q + dz * q, ROOF, pz + dz * q + dx * q], [px + dx * q + dz * q, top, pz + dz * q + dx * q], [px + dx * q - dz * q, top, pz + dz * q - dx * q]], padDark);
    // the boundary: sixteen lengths a side
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 0; i < 16; i++) {
      const along = -q + 2 * q * (i + 0.5) / 16, x = px + dx * (q - 0.18) + (dx ? 0 : along), z = pz + dz * (q - 0.18) + (dz ? 0 : along);
      G.box([x, (top + k) / 2, z], [dx ? 0.18 : q / 16, (k - top) / 2, dz ? 0.18 : q / 16], worn(yellow, x, z));
    }
    const seg = 40, r0 = p.ring - 0.18, r1 = p.ring + 0.18;
    for (let i = 0; i < seg; i++) {
      const a = i / seg * Math.PI * 2, b = (i + 1) / seg * Math.PI * 2, at = (r, t, yy) => [px + Math.cos(t) * r, yy, pz + Math.sin(t) * r], col = worn(yellow, px + Math.cos(a) * p.ring, pz + Math.sin(a) * p.ring);
      G.quad([at(r0, a, k), at(r1, a, k), at(r1, b, k), at(r0, b, k)], col);
      G.quad([at(r1, a, top), at(r1, b, top), at(r1, b, k), at(r1, a, k)], col); G.quad([at(r0, a, top), at(r0, b, top), at(r0, b, k), at(r0, a, k)], col);
    }
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.ball([px + dx * (q - 0.18), k + 0.2, pz + dz * (q - 0.18)], 0.26, white, 6);
  }
  // the doors to the pads: two steel leaves set back in each doorway with a small dark window each, a dark seam between
  // them, a small light over the doorway
  for (const d of PAD_DOORS) {
    const y0 = ROOF + PAD_DOOR.foot, hw = PAD_DOOR.w / 2, hh = PAD_DOOR.h / 2, zi = d.z - d.out * 0.08, leaf = lin('#4a5160');
    for (const sx of [-1, 1]) G.box([d.x + sx * (hw / 2 + 0.02), y0 + hh, zi], [hw / 2 - 0.02, hh, 0.06], leaf);
    G.box([d.x, y0 + hh, zi - d.out * 0.03], [0.04, hh, 0.04], dark);
    for (const sx of [-1, 1]) G.box([d.x + sx * hw * 0.5, y0 + hh * 1.3, zi + d.out * 0.07], [hw * 0.28, 0.22, 0.02], dark);
    L.box([d.x, y0 + PAD_DOOR.h + 0.37, d.z + d.out * 0.42], [0.8, 0.05, 0.05], white);
  }
  // the cargo slots: three containers plugged end-on into their sockets, a rail each side of every slot
  const S = SLOTS, y0 = SLOT_DECK + 0.32;
  S.full.forEach((k) => {
    const z = S.z[k], col = lin(BOX_COLOURS[k]), rib = col.map((v) => v * 0.6), x1 = S.x - 0.45, xm = x1 - BOX.len / 2;
    G.box([xm, y0 + BOX.h / 2, z], [BOX.len / 2, BOX.h / 2, BOX.w / 2], col);
    for (let i = 0; i < 9; i++) G.box([x1 - 0.7 - i * 1.35, y0 + BOX.h / 2, z], [0.07, BOX.h / 2 - 0.12, BOX.w / 2 + 0.04], rib);
  });
  for (let k = 0; k <= S.z.length; k++) { const z = k < S.z.length ? S.z[k] - 2.25 : S.z[k - 1] + 2.25; G.box([-14.6, y0 + 0.12, z], [7.2, 0.12, 0.12], yellow); }
  if (!opts.inside) for (const hg of HANGARS) {
    const x0 = 19.4, x1 = 58.9, z0 = hg.z - 13.8, z1 = hg.z + 13.8, y1 = 10.9, wallC = lin('#39424f'), floorC = lin('#586273');
    G.quad([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], floorC); G.quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], wallC);
    G.quad([[x0, 0, z0], [x0, y1, z0], [x0, y1, z1], [x0, 0, z1]], wallC); G.quad([[x0, 0, z0], [x1, 0, z0], [x1, y1, z0], [x0, y1, z0]], wallC); G.quad([[x0, 0, z1], [x1, 0, z1], [x1, y1, z1], [x0, y1, z1]], wallC);
  }
  return { lit: G.arrays(), glow: L.arrays() };
}
// where each painted mark goes: its lower left corner, the way it reads (U) and its top (V), its width and height
export function outsideMarks() {
  const S = SLOTS, y0 = SLOT_DECK + 0.32, out = [];
  for (const m of MARKS) {
    if (m.slot != null) out.push({ text: m.text, O: [-22.6, y0 + 0.02, S.z[m.slot] - 1.2], U: [0, 0, 1], V: [1, 0, 0], w: 2.4, h: 1.5 });          // on the deck, read from the dock
    else {
      const z = S.z[m.box], x1 = S.x - 0.45, y = y0 + 1.05;
      out.push({ text: m.text, O: [x1 - 1.2, y, z - BOX.w / 2 - 0.06], U: [-1, 0, 0], V: [0, 1, 0], w: 4.6, h: 0.75 });                          // its north side
      out.push({ text: m.text, O: [x1 - 5.8, y, z + BOX.w / 2 + 0.06], U: [1, 0, 0], V: [0, 1, 0], w: 4.6, h: 0.75 });                           // its south side
      out.push({ text: m.text.slice(0, 1), O: [x1 - BOX.len - 0.02, y - 0.1, z - 0.5], U: [0, 0, 1], V: [0, 1, 0], w: 1, h: 1 });                // its outer end: the sign alone
    }
  }
  return out;
}

// the whole outside's size, and the places to look at it from (the lab's named views)
export const OUTSIDE_BOX = { min: [-24, -68, -107], max: [61, 82, 161] };
export const OUTSIDE_VIEWS = {
  hangar: { name: 'The hangar side', at: [216, 44, 68], to: [40, 8, 29] },
  above: { name: 'From above', at: [114, 134, -6], to: [36, 6, 27] },
  below: { name: 'From below', at: [140, -105, 80], to: [38, -8, 26] },
  dock: { name: 'The dock side', at: [-92, 30, -34], to: [10, 0, 20] },
  window: { name: 'The terminal\'s window side', at: [-46, 20, 104], to: [6, 3, 36] },
};
