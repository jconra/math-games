// THE SMELTER'S ORE LINE in the Miner hangar, as the game's maker picked it from the option sheets (2026-11-15):
//   the ceiling crane   "the second 'light box' is probably best": the station's white box rail with a light strip, a
//                       trolley, and a cradle whose arms close under the canister. His test for a crane is that it can
//                       dock a canister into the wall easily, so the docking move decided how it is made (below)
//   the canisters       "I like the level windows. The ring lights are cool for the canisters regardless": both are
//                       on the canister itself (kit/ships/miner-built.js canisterLeaves); here, the low rack of empties
//   the wall sockets    "the circular docks make the most sense. I like the little ring on the first and the digital
//                       display on the 3rd": a round collar with a lit ring and an iris shutter, a number and bars
//   the job console     "operator chair might be best": a chair with a curve of screens and two sticks
// These are the pieces; what makes them move is kit/crane.js (the cycle) and src/crane.js (the game's clock).
//
// HOW THE CRANE DOCKS A CANISTER (and why it is made as it is). A load hanging from a rail can only be set down where
// the rail passes, and a canister has to go into its socket END-ON. So:
//   - the rail is a T: one leg along the socket wall, one leg out over the ship, a TURNTABLE where they meet (a
//     round plate with a short piece of rail: the trolley drives on, the plate turns a quarter turn with trolley and
//     load, the trolley drives off along the other leg);
//   - the trolley carries a short BEAM across the rail, and the hoist's carriage runs along that beam: the "short
//     slide on the trolley". The canister always hangs along the beam. Over the ship the beam lies along the ship,
//     and the carriage runs out to whichever canister it wants; at the wall the beam points at the wall, and the
//     carriage's last half metre toward the wall is what pushes the canister into its collar;
//   - the cradle hangs on four cables. A frame sits down on the canister's crown and a latch takes the lug on its
//     top (the ship's own lifting point); then two pairs of curved arms slide round the canister from above, inside
//     their guides, until their tips meet under it. Nothing swings out sideways, so it can take a canister from
//     between its neighbours on the rack, and from a socket with one docked above or below.
//
//   craneRail   a FREE piece, its underside at y = 0: 'run <metres>' a straight run along x, its middle at the origin;
//               'hanger' one of its hangers up to the roof (CRANE.rail.roof above its underside); 'stop' a buffer at a
//               rail's end (the rail to its -x side)
//   craneTurn   a FREE piece: the turntable, its middle at the origin, the rails meeting it along x and from +z. Its
//               plate is a leaf (door 'turn': a quarter turn)
//   crane       a POINT piece, its point on the rail's underside: the trolley under a rail that runs along x, and all
//               it carries, as leaves (door 'crane'):
//               'crane:trolley' (with its beam, along z), 'crane:carriage', four 'crane:cable', 'crane:cradle', four
//               'crane:arc' (the arms), 'crane:beacon' (the trolley's warning lamps) and 'crane:lamp' (the cradle's).
//               As placed it is parked: cradle up, arms open
//   oreSocket   a WALL piece, its middle on the collar's middle: the collar (standing SOCKET.deep out of the wall),
//               the display to its right; leaves: 'sock:petal' x 12 (door 'iris': they fold back into the collar),
//               'sock:ring' (the lit ring), 'sock:dog' x 4 (the latch dogs that grip a seated canister) and
//               'sock:saddle' x 2 (the rests that slide in under it from a beam each side; all door 'lit'),
//               'sock:seg' x 21 and 'sock:bar' x 5 (the display's number and bars)
//   oreRack     a FREE piece: 'bays <n>' the low rack, its bays side by side along x, a canister lying along z in each
//   oreCan      a FREE piece: a canister lying along z, its middle RACK.y up ('empty' or 'full'): the rack's
//   guardRail   a FREE piece: 'run <metres>' a yellow rail along x (the dock apron's)
//   opChair     a FREE piece facing +z: 'crane' the operator's chair with its curve of screens
import * as THREE from 'three';
import { bevelBox, put, circle, bend, line, sweep, rrect } from './geo.js';
import { liveFace } from './shipparts/cabin/live.js';
import { canisterLeaves } from './ships/miner-built.js';
import { CANISTER_AT } from './ships/miner-built.hull.js';
import { DRIVE } from './crane-drive.js';

const PI = Math.PI;
const flat = { r: 0.012, cell: 9, loops: [] }, sharp = { r: 0, cell: 9, loops: [] };
const B = (p, surf, x0, x1, y0, y1, z0, z1, o = flat) => p.slab(surf, x0, x1, y0, y1, z0, z1, o);
const glowBox = (p, look, x0, x1, y0, y1, z0, z1) => p.add('glow', bevelBox([x1 - x0, y1 - y0, z1 - z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], { r: 0, cell: 9, loops: [] }), look);
// (a glow's own colour may be a name from the kit's list or a linear colour)
// (kept below where the picture's tone curve washes a colour out to white: green stays green, amber amber)
export const GLOWS = { ok: [0.14, 1.5, 0.42], off: [0.016, 0.03, 0.024], ringOff: [0.07, 0.085, 0.1], ringOn: [0.16, 1.9, 0.5], low: [2.0, 0.62, 0.04], beaconOff: [0.22, 0.1, 0.012], beaconOn: [7.5, 2.6, 0.12] };

// ── the numbers the pieces and the cycle share (metres; y from the rail's underside unless said) ──────────────────────
export const CRANE = {
  rail: { w: 0.44, h: 0.38, roof: 2.05 },                       // the box rail: wide, tall; the roof above its underside
  disc: 0.8,                                                    // the turntable's plate: its radius
  body: { half: 0.7, w: 0.4, y0: -0.57, y1: -0.04 },            // the trolley's body under the rail: half length, half width
  beam: { half: 1.62, w: 0.17, y0: -0.86, y1: -0.57, reach: 1.25 },  // the beam across the rail; how far the carriage runs each way
  car: { x: 0.32, z: 0.36, h: 0.3 },                            // the hoist's carriage under the beam: half sizes across and along the beam
  cable: { x: 0.26, z: 0.3, unit: 0.7, r: 0.014 },              // the four cables: where (across, along the beam); the leaf's own length
  grip: { top: 0.79, under: 0.67, w: 0.35, half: 0.65 },        // the cradle's frame, from the canister's middle line up: its top, its underside
  arc: { r: 0.54, tube: 0.03, z: 0.55, gap: 0.036, half: 72 * PI / 180, shut: 108 * PI / 180 },   // an arm: its radius; open it spans `half` each side of the top
};
// (where the cradle hangs when the crane is parked or carrying: the canister's middle line, from the rail's underside)
CRANE.carry = CRANE.beam.y0 - CRANE.car.h - CRANE.cable.unit - CRANE.grip.top;
// (seat: how far in a canister's end sits; clear: how far off the mouth it comes down, which keeps it and the cradle
// out from under the ledges and rib knees of the wall above; rise: how far the cradle lifts off a docked canister
// before it backs away)
export const SOCKET = { deep: 0.62, bore: 0.535, out: 0.68, seat: 0.4, clear: 0.45, rise: 0.9, mouth: 0.585, display: [1.24, 0] };
export const RACK = { pitch: 1.15, y: 0.65, end: 0.78 };   // (end: from the last canister's middle to the rack's end plate, clear of the crane's arms)
const CAN = { R: CANISTER_AT.R, half: CANISTER_AT.half };

// ── THE RAIL ────────────────────────────────────────────────────────────────────────────────────────────────────────
function railRun(p, L, x0 = -L / 2) {
  const { w, h } = CRANE.rail, x1 = x0 + L;
  p.slab('white', x0, x1, 0, h, -w / 2, w / 2, { r: 0.03, cell: 2, loops: [] });
  p.slab('black', x0, x1, -0.006, 0.004, -0.04, 0.04, sharp);                                   // (the slot the trolley hangs through)
  for (const s of [-1, 1]) p.glowSlab('strip', x0 + 0.04, x1 - 0.04, -0.008, -0.001, s * 0.13 - 0.02, s * 0.13 + 0.02, { r: 0 });
}
const RUN_RE = /^run \d+(\.\d+)?$/;
export function craneRail(p, v) {
  const { w, h, roof } = CRANE.rail;
  if (v === 'hanger') {
    // a saddle over the rail, a stout rod each side up to a plate on the roof, a brace between the rods. Pale, as the
    // rail is: black and thin they could not be seen against the roof, and the rail looked as if nothing held it up
    // (two blind critics said so)
    const zr = w / 2 + 0.07, mid = (h + roof) / 2;
    B(p, 'white', -0.07, 0.07, h - 0.01, h + 0.05, -zr, zr);
    for (const s of [-1, 1]) {
      B(p, 'white', -0.07, 0.07, h - 0.2, h + 0.05, s * zr - 0.035, s * zr + 0.035);
      p.cyl('white', 0.04, roof - h - 0.08, [0, (h + 0.05 + roof - 0.03) / 2, s * zr], null, 10);
      B(p, 'gun', -0.14, 0.14, roof - 0.03, roof, s * zr - 0.14, s * zr + 0.14);
    }
    B(p, 'white', -0.03, 0.03, mid - 0.035, mid + 0.035, -zr, zr);
    return;
  }
  if (v === 'stop') {
    B(p, 'yellow', 0, 0.12, -0.24, h + 0.02, -w / 2 - 0.04, w / 2 + 0.04, { r: 0.02, cell: 9, loops: [] });
    B(p, 'rubber', -0.035, 0, -0.2, -0.03, -0.14, 0.14);
    return;
  }
  const L = parseFloat(v.slice(4));
  railRun(p, L);
  for (let x = -L / 2 + 1; x < L / 2 - 0.5; x += 2) p.light([x, -0.25, 0], 1.3, [1, 0.98, 0.95], [0, -1, 0], 6);
}

// ── THE RAIL'S METRE MARKS: where the crane is, read off the rail itself (the crane operator job reads its numbers
// here: src/jobs/crane.js). Dark on the white rail, on both its sides: a tick every half metre (taller on the whole
// metres) and the metre's number above each whole one, in the sockets' display strokes. The wall rail's marks count
// from its west end, the ship rail's from the turntable. A FREE piece, its origin on the rail's underside where the
// count starts, the marks along +x: 'wall 27 gap 10.5 12.2' (no marks between those two, the turntable's).
export const MARKS = { digit: 0.19, w: 0.105, t: 0.026, pitch: 0.14, tick: [0.07, 0.13], end: 0.3 };
const MARKS_RE = /^(wall|ship) \d+(\.\d+)?( gap \d+(\.\d+)? \d+(\.\d+)?)?$/;
// a number in strokes on a face of the rail: centred at x, its middle at y, on the side `side` (the face at z = side *
// its depth), read the right way from that side
function strokes(p, text, x, y, side, z) {
  const D = MARKS, n = text.length, x0 = x - (n - 1) * D.pitch / 2;
  for (let i = 0; i < n; i++) {
    const on = DIGIT.on[text[i]] || '', cx = x + (x0 + i * D.pitch - x) * side;   // (left to right as seen from that side)
    for (const ch of on) {
      const [sx, sy, up] = SEGS[ch], mx = cx + sx * side * (D.w - D.t) / 2, my = y + sy * (D.digit - D.t) / 2;
      const hw = up ? D.t / 2 : (D.w - D.t) / 2 - 0.004, hh = up ? (D.digit - D.t) / 4 + 0.002 : D.t / 2;
      p.slab('black', mx - hw, mx + hw, my - hh, my + hh, Math.min(z, z + side * 0.004), Math.max(z, z + side * 0.004), sharp);
    }
  }
}
export function craneMarks(p, v) {
  const parts = v.split(' '), L = parseFloat(parts[1]), gap = parts[2] === 'gap' ? [parseFloat(parts[3]), parseFloat(parts[4])] : null;
  const { w, h } = CRANE.rail, D = MARKS;
  for (const side of [-1, 1]) {
    const z = side * (w / 2 + 0.001);
    for (let k = 0; k <= L * 2; k++) {
      const x = k / 2;
      if (x < D.end * 0.5 || x > L - 0.05 || (gap && x > gap[0] && x < gap[1])) continue;
      const whole = k % 2 === 0, th = whole ? D.tick[1] : D.tick[0];
      p.slab('black', x - 0.011, x + 0.011, 0.025, 0.025 + th, Math.min(z, z + side * 0.004), Math.max(z, z + side * 0.004), sharp);
      if (whole) strokes(p, String(x), x, h - 0.03 - D.digit / 2, side, z);
    }
  }
}

// ── THE TURNTABLE where the two legs meet ──────────────────────────────────────────────────────────────────────────
function turnPlate(lp) {
  const R = CRANE.disc, { h } = CRANE.rail;
  railRun(lp, R * 2);
  lp.cyl('grey2', R + 0.02, h - 0.2, [0, 0.2 + (h - 0.2) / 2, 0], null, 40);
  for (const s of [-1, 1]) B(lp, 'yellow', s * (R - 0.16), s * (R - 0.06), 0.14, 0.2, -0.3, 0.3);   // (marks on its underside, so its turning shows)
}
export function craneTurn(p) {
  const R = CRANE.disc, { h, roof } = CRANE.rail;
  // the ring round the plate, with a gap where each leg's rail comes in (along x both ways, and from +z)
  const gap = 0.3;
  // (angles from +x round toward -z: the wall's side, blind, is at a quarter turn; the ship's leg comes in at three)
  const arc = (a0, a1) => p.sweep('black', rrect(0.16, h, 0.012, 1, 0, 0.04 + h / 2), bend([0, 0, 0], R + 0.12, [1, 0, 0], [0, 0, -1], a0, a1, Math.max(4, Math.round((a1 - a0) * 8))));
  arc(gap, PI - gap); arc(PI + gap, 1.5 * PI - gap); arc(1.5 * PI + gap, 2 * PI - gap);
  // the deck it hangs from, its pivot, four rods to the roof; a buffer on the blind side (the wall's)
  p.cyl('gun', R + 0.2, 0.07, [0, h + 0.075, 0], null, 40);
  p.cyl('gun', 0.22, 0.34, [0, h + 0.28, 0], null, 20); p.cyl('black', 0.3, 0.06, [0, h + 0.14, 0], null, 20);
  for (const [x, z] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) { p.slab('black', x - 0.025, x + 0.025, h + 0.11, roof, z - 0.025, z + 0.025, { r: 0, cell: 3, loops: [] }); B(p, 'black', x - 0.1, x + 0.1, roof - 0.03, roof, z - 0.1, z + 0.1); }
  B(p, 'yellow', -0.26, 0.26, -0.2, h + 0.02, -R - 0.2, -R - 0.08, { r: 0.02, cell: 9, loops: [] });
  p.leaf('crane:turn', turnPlate, { hinge: { at: [0, 0, 0], axis: [0, 1, 0], angle: PI / 2 }, door: 'turn' });
  p.door('turn', [0, 0, 0], 0, 0.25, true);
}

// ── THE CRANE: trolley, beam, carriage, cables, cradle, arms ──────────────────────────────────────────────────────────
function trolleyLeaf(lp) {
  const { half, w, y0, y1 } = CRANE.body, M = CRANE.beam;
  B(lp, 'black', -0.5, 0.5, y1, 0.03, -0.03, 0.03);                                             // (its neck, up through the rail's slot)
  for (const s of [-1, 1]) B(lp, 'black', s * 0.45 - 0.14, s * 0.45 + 0.14, y1, 0, -0.2, 0.2);
  lp.slab('grey2', -half, half, y0, y1, -w, w, { r: 0.06, cell: 9, loops: [] });
  lp.slab('black', -half - 0.02, half + 0.02, y0 + 0.15, y0 + 0.25, -w - 0.02, w + 0.02, { r: 0.02, cell: 9, loops: [] });
  for (const s of [-1, 1]) glowBox(lp, GLOWS.ok, -0.5, 0.5, y0 + 0.185, y0 + 0.215, s * (w + 0.02) - 0.004, s * (w + 0.02) + 0.004);
  // the beam across the rail, the carriage's track under it, a buffer at each end
  lp.slab('white', -M.w, M.w, M.y0, M.y1, -M.half, M.half, { r: 0.03, cell: 9, loops: [] });
  lp.slab('black', -0.05, 0.05, M.y0 - 0.008, M.y0 + 0.002, -M.half + 0.08, M.half - 0.08, sharp);
  for (const s of [-1, 1]) { B(lp, 'yellow', -M.w - 0.02, M.w + 0.02, M.y0 - 0.05, M.y1 + 0.02, s * M.half - 0.03, s * M.half + 0.04, { r: 0.015, cell: 9, loops: [] }); glowBox(lp, 'strip', -M.w - 0.004, M.w + 0.004, M.y0 + 0.11, M.y0 + 0.14, s * 0.9 - 0.45, s * 0.9 + 0.45); }
  // (the beacons' housings, one at each corner of the body: the lamps themselves are 'crane:beacon')
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lp.cyl('black', 0.13, 0.05, [sx * (half - 0.18), y0 - 0.025, sz * (w - 0.14)], null, 14);
  // the rated-load plate on each side of the beam: what the crane may lift, "3 t" (PLATE.rated: kit/crane-drive.js
  // DRIVE.rated, the crane operator job's weights)
  const PL = PLATE, yc = (M.y0 + M.y1) / 2;
  for (const s of [-1, 1]) {
    const x = s * (M.w + 0.004);
    lp.slab('yellow', Math.min(x, x + s * 0.006), Math.max(x, x + s * 0.006), yc - PL.h / 2, yc + PL.h / 2, PL.z - PL.len / 2, PL.z + PL.len / 2, { r: 0.006, cell: 9, loops: [] });
    plateStrokes(lp, `${PL.rated}t`, PL.z, yc, s, x + s * 0.006);
  }
}
// THE PLATE on the beam: its size and where along the beam; its words in the display's strokes
export const PLATE = { rated: DRIVE.rated, z: 0.62, len: 0.42, h: 0.22, digit: 0.15, w: 0.085, t: 0.022, pitch: 0.12 };
const T_SEGS = 'defg';   // (a small t in strokes)
function plateStrokes(lp, text, zc, yc, side, x) {
  const D = PLATE, n = text.length;
  for (let i = 0; i < n; i++) {
    // (read the right way from that side: along -z seen from +x, along +z seen from -x)
    const cz = zc - side * ((i - (n - 1) / 2) * D.pitch), on = text[i] === 't' ? T_SEGS : DIGIT.on[text[i]] || '';
    const dh = text[i] === 't' ? D.digit * 0.8 : D.digit, cy = yc - (D.digit - dh) / 2;
    for (const ch of on) {
      const [sx, sy, up] = SEGS[ch], mz = cz - side * sx * (D.w - D.t) / 2, my = cy + sy * (dh - D.t) / 2;
      const hz = up ? D.t / 2 : (D.w - D.t) / 2 - 0.003, hy = up ? (dh - D.t) / 4 + 0.002 : D.t / 2;
      lp.slab('black', Math.min(x, x + side * 0.003), Math.max(x, x + side * 0.003), my - hy, my + hy, mz - hz, mz + hz, sharp);
    }
  }
}
function carriageLeaf(lp) {
  const C = CRANE.car, K = CRANE.cable, w = CRANE.beam.w;
  lp.slab('grey2', -C.x, C.x, -C.h, 0, -C.z, C.z, { r: 0.04, cell: 9, loops: [] });
  for (const s of [-1, 1]) B(lp, 'black', s * (w + 0.03) - 0.025, s * (w + 0.03) + 0.025, -0.02, 0.14, -C.z + 0.06, C.z - 0.06);   // (its shoes up the beam's sides)
  for (const s of [-1, 1]) { const g = bevelBox([0.2, 0.2, C.z * 2 + 0.06], [0, 0, 0], { r: 0.09, seg: 2, cell: 9, loops: [] }); put(g, [s * K.x, -C.h + 0.02, 0]); lp.add('solid', g, 'gun'); }   // (the two cable drums)
  B(lp, 'black', -C.x - 0.01, C.x + 0.01, -0.2, -0.12, -C.z - 0.01, C.z + 0.01, { r: 0.01, cell: 9, loops: [] });
}
function cableLeaf(lp) { const K = CRANE.cable; lp.cyl('rail', K.r, K.unit, [0, -K.unit / 2, 0], null, 6); }
const ARC_PROFILE = (t) => circle(t, 6);
// (an arc about the z axis through the origin: radius r, from angle a0 to a1 measured from straight up, toward +x)
const arcPath = (r, a0, a1, z = 0, seg = 14) => bend([0, 0, z], r, [0, 1, 0], [1, 0, 0], a0, a1, seg);
function cradleLeaf(lp) {
  const G = CRANE.grip, A = CRANE.arc, K = CRANE.cable;
  // the frame over the canister, a dark edge round it, an eye for each cable, a lit line along each side
  lp.slab('grey2', -G.w, G.w, G.under, G.top, -G.half, G.half, { r: 0.03, cell: 9, loops: [] });
  lp.slab('black', -G.w - 0.012, G.w + 0.012, G.under + 0.03, G.top - 0.03, -G.half - 0.012, G.half + 0.012, { r: 0.012, cell: 9, loops: [] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(lp, 'black', sx * K.x - 0.04, sx * K.x + 0.04, G.top, G.top + 0.05, sz * K.z - 0.04, sz * K.z + 0.04);
  for (const s of [-1, 1]) glowBox(lp, GLOWS.ok, s * (G.w + 0.012) - 0.004, s * (G.w + 0.012) + 0.004, G.under + 0.045, G.top - 0.045, -0.42, 0.42);
  // the latch over the lug: two jaws either side of its eye
  for (const s of [-1, 1]) B(lp, 'gun', s * 0.055 - 0.02, s * 0.055 + 0.02, CAN.R + 0.06, G.under, -0.13, 0.13);
  B(lp, 'rail', -0.09, 0.09, CAN.R + 0.115, CAN.R + 0.145, -0.02, 0.02, { r: 0.006, cell: 9, loops: [] });
  // at each end: the guide the arms run in (an arch over the canister's crown), its web up to the frame, and a pad
  // that sits on the crown
  for (const s of [-1, 1]) {
    lp.sweep('black', rrect(0.06, 0.15, 0.01, 1), arcPath(A.r + A.tube + 0.045, -0.7, 0.7, s * A.z, 10), { caps: true });
    B(lp, 'black', -0.2, 0.2, A.r + A.tube + 0.05, G.under, s * A.z - 0.06, s * A.z + 0.06);
    B(lp, 'rubber', -0.1, 0.1, CAN.R + 0.006, CAN.R + 0.05, s * 0.32 - 0.06, s * 0.32 + 0.06); B(lp, 'black', -0.07, 0.07, CAN.R + 0.05, G.under, s * 0.32 - 0.04, s * 0.32 + 0.04);
  }
}
function arcLeaf(lp) {
  const A = CRANE.arc;
  lp.add('solid', sweep(ARC_PROFILE(A.tube), arcPath(A.r, -A.half, A.half, 0, 16), { caps: true }), 'black');
  // (a yellow tip at each end, so the arms' closing reads from the floor)
  for (const s of [-1, 1]) lp.add('solid', sweep(ARC_PROFILE(A.tube + 0.004), arcPath(A.r, s * (A.half - 0.14), s * A.half, 0, 3), { caps: true }), 'yellow');
}
function beaconLeaf(lp) {
  const { half, w, y0 } = CRANE.body;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = new THREE.SphereGeometry(0.11, 12, 5, 0, PI * 2, PI / 2, PI / 2); g.translate(sx * (half - 0.18), y0 - 0.05, sz * (w - 0.14));
    lp.add('glow', g, GLOWS.beaconOff);
  }
}
// (the arms: two at each end of the cradle, side by side; one of each pair slides round one way, one the other)
// (the cradle's own warning lamps: a bar across each end of its frame, flashing with the trolley's)
function cradleLampLeaf(lp) { const G = CRANE.grip; for (const s of [-1, 1]) glowBox(lp, GLOWS.beaconOff, -0.22, 0.22, G.under + 0.03, G.top - 0.03, s * (G.half + 0.012) - 0.006, s * (G.half + 0.012) + 0.006); }
// (way: +1 round toward the cradle's +x, -1 toward -x. The cradle is the same turned half way round.)
export const ARMS = [-1, 1].flatMap((end) => [1, -1].map((s) => ({ z: end * (CRANE.arc.z + s * CRANE.arc.gap), way: end * s })));
export function crane(p) {
  const C = CRANE, yc = C.carry;
  p.leaf('crane:trolley', trolleyLeaf, { door: 'crane' });
  p.leaf('crane:carriage', carriageLeaf, { at: [0, C.beam.y0, 0], door: 'crane' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.leaf('crane:cable', cableLeaf, { at: [sx * C.cable.x, C.beam.y0 - C.car.h, sz * C.cable.z], door: 'crane' });
  p.leaf('crane:cradle', cradleLeaf, { at: [0, yc, 0], door: 'crane' });
  for (const a of ARMS) p.leaf('crane:arc', arcLeaf, { at: [0, yc, a.z], hinge: { at: [0, yc, a.z], axis: [0, 0, 1], angle: -a.way * C.arc.shut }, door: 'crane' });
  p.leaf('crane:beacon', beaconLeaf, { door: 'crane' });
  p.leaf('crane:lamp', cradleLampLeaf, { at: [0, yc, 0], door: 'crane' });
  p.door('crane', [0, yc, 0], 0, 0.5, true);
}

// ── THE WALL SOCKET: a round collar, its iris, its lit ring, its display ─────────────────────────────────────────────
const SEGS = { a: [0, 1, 0], b: [1, 0.5, 1], c: [1, -0.5, 1], d: [0, -1, 0], e: [-1, -0.5, 1], f: [-1, 0.5, 1], g: [0, 0, 0] };   // (where: across, up, upright?)
export const DIGIT = { h: 0.2, w: 0.1, t: 0.022, pitch: 0.14, order: 'abcdefg', on: { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' } };
export const GAUGE = { digits: 3, bars: 5 };
const PETALS = 12;
function petalLeaf(lp) {
  // a flat plate: its base along x at the origin (the hinge), its tip toward -y (the collar's middle when it is shut)
  const S = SOCKET, L = S.bore * Math.cos(PI / PETALS), hw = S.bore * Math.sin(PI / PETALS) + 0.012;
  // (its thickness behind the hinge's plane: folded back, it lies between the bore and whatever is plugged in)
  lp.extrude('gun', [[-hw, 0], [0, -L - 0.01], [hw, 0]], 0.014, 0.003).translate(0, 0, -0.014);
  lp.extrude('black', [[-hw * 0.5, -L * 0.14], [0, -L * 0.86], [hw * 0.5, -L * 0.14]], 0.004, 0.001);   // (a darker rib down its face)
}
function ringLeaf(lp) { const S = SOCKET; lp.add('glow', sweep(circle(0.022, 6), bend([0, 0, S.deep + 0.006], (S.mouth + S.out) / 2 - 0.004, [1, 0, 0], [0, 1, 0], 0, 2 * PI, 40), { closed: true }), GLOWS.ringOff); }
// A LATCH DOG: what holds a docked canister once the cradle has let go. Four of them stand on the collar's face. When
// a canister is seated they slide in onto it just outside the mouth, and only then does the ring light: the canister
// is borne at the back of the bore and gripped at the mouth, 0.4 m apart, which is what lets it stand out of the wall
// with nothing under it. (Its own frame: on the collar's face, +y out from the collar's middle, z out of the wall. It
// stays within DOG.deep of the face: the cradle's arms pass 0.11 m out.)
export const DOG = { n: 4, r: 0.66, travel: 0.092, w: 0.2, h: 0.1, deep: 0.085 };
function dogLeaf(lp) {
  const D = DOG;
  lp.slab('yellow', -D.w / 2, D.w / 2, -D.h / 2, D.h / 2, 0.004, D.deep, { r: 0.014, cell: 9, loops: [] });
  // (its nose: a narrower pad on the side that meets the canister)
  lp.slab('yellow', -D.w / 2 + 0.03, D.w / 2 - 0.03, -D.h / 2 - 0.05, -D.h / 2 + 0.01, 0.024, D.deep - 0.01, { r: 0.01, cell: 9, loops: [] });
}
// THE RESTS under a docked canister. Three blind critics in a row said a canister let go of in its collar looked held
// "only by its tip", latch dogs or not. So each socket has a beam standing out of the wall each side of its collar,
// and on each beam a saddle that slides in under the seated canister's flank as the dogs close (the same door:
// 'lit'), near the canister's middle. Why not a fixed shelf: a canister bound for the socket below comes straight
// down in front of this one, cradle arms round it (0.57 m out from its middle line), so nothing fixed may stand
// closer than that; the beams stand REST.x out and the saddles draw back onto them. And the cradle's arms pass round
// a seated canister only 0.11 to 1.02 m and 1.21 to 2.12 m out from the collar's face as it is pushed in: the
// saddles work in the gap between (REST.z0 to REST.z1).
// (All from the collar's middle, z from the wall.)
export const REST = { x: 0.73, w: 0.08, y: -0.34, h: 0.12, z0: SOCKET.deep + 1.05, z1: SOCKET.deep + 1.17, touch: 0.476, travel: 0.36, tail: 0.42 };
function saddleLeaf(side) {
  // (drawn parked, in the socket's own frame moved to the beam's middle line: the pad sits round the beam, its bar
  // through it and out the far side. Slid in by REST.travel, the pad's sloped face meets the canister REST.touch from
  // its middle line, 45 degrees under its side, and the bar's tail is still in the beam.)
  return (lp) => {
    const R = REST, zc = (R.z0 + R.z1) / 2, d = (R.z1 - R.z0) / 2, k = Math.SQRT1_2;
    // where the pad's middle is when it holds the canister, from the beam's middle line; parked, R.travel further out
    const ux = (R.touch + 0.05) * k - R.x + R.travel, uy = -(R.touch + 0.05) * k - R.y;
    const x0 = side * (ux - 0.06), x1 = side * R.tail;
    lp.slab('white', Math.min(x0, x1), Math.max(x0, x1), uy - 0.03, uy + 0.03, zc - d + 0.02, zc + d - 0.02, { r: 0.008, cell: 9, loops: [] });
    lp.add('solid', put(bevelBox([0.1, 0.2, 2 * d], [0, 0, 0], { r: 0.012, cell: 9, loops: [] }), [side * ux, uy, zc], [0, 0, -side * PI / 4]), 'yellow');
  };
}
function segLeaf(lp) { const D = DIGIT; lp.add('glow', bevelBox([D.w - 0.024, D.t, 0.004], [0, 0, 0], { r: 0, cell: 9, loops: [] }), GLOWS.off); }
function barLeaf(lp) { lp.add('glow', bevelBox([0.026, 0.18, 0.004], [0, 0, 0], { r: 0, cell: 9, loops: [] }), GLOWS.off); }
export function oreSocket(p) {
  const S = SOCKET, [dx, dy] = S.display;
  // a dark plate on the wall behind collar and display; the collar: its bore, the slope into it, its face and outside
  p.slab('grey2', -0.76, dx + 0.48, -0.72, 0.72, 0, 0.05, { r: 0.02, cell: 1.5, loops: [] });
  // (up its outside, across its face, in down the slope and back along the bore)
  p.lathe('black', [[S.out, 0.05], [S.out, S.deep - 0.025], [S.out - 0.025, S.deep], [S.mouth, S.deep], [S.bore, S.deep - 0.05], [S.bore, 0.09]], 40, [0, 0, 0], [PI / 2, 0, 0]);
  p.cyl('gun', S.out + 0.06, 0.05, [0, 0, 0.075], [PI / 2, 0, 0], 40);
  p.cyl('dark', S.bore + 0.01, 0.02, [0, 0, 0.085], [PI / 2, 0, 0], 32);
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) * PI / 4; p.cyl('rail', 0.026, 0.03, [Math.cos(a) * (S.out + 0.03), Math.sin(a) * (S.out + 0.03), 0.11], [PI / 2, 0, 0], 8); }   // (bolts round its foot)
  // the display: a housing and its dark pane
  p.slab('black', dx - 0.4, dx + 0.4, dy - 0.2, dy + 0.2, 0.05, 0.1, { r: 0.02, cell: 9, loops: [] });
  p.slab({ c: '#0e1013', r: 0.2, m: 0.3, w: 0 }, dx - 0.36, dx + 0.36, dy - 0.16, dy + 0.16, 0.1, 0.106, { r: 0.004, cell: 9, loops: [] });
  // the iris: twelve plates hinged round the collar's mouth, shut across it; open, each lies back along the bore
  const L = S.bore * Math.cos(PI / PETALS), zi = S.deep - 0.065;
  for (let k = 0; k < PETALS; k++) {
    const a = k * 2 * PI / PETALS, at = [-Math.sin(a) * L, Math.cos(a) * L, zi];
    p.leaf('sock:petal', petalLeaf, { at, rot: [0, 0, a], hinge: { at, axis: [Math.cos(a), Math.sin(a), 0], angle: 1.5 }, door: 'iris' });
  }
  p.door('iris', [0, 0, S.deep], 0, 0.7, false);
  // the ring, and the four latch dogs that slide in onto a seated canister as it lights (the same door: 'lit')
  p.leaf('sock:ring', ringLeaf, { door: 'lit' });
  for (let k = 0; k < DOG.n; k++) {
    const a = (k + 0.5) * 2 * PI / DOG.n, c = Math.cos(a), sn = Math.sin(a);
    p.leaf('sock:dog', dogLeaf, { at: [c * DOG.r, sn * DOG.r, S.deep], rot: [0, 0, a - PI / 2], slide: [-c * DOG.travel, -sn * DOG.travel, 0], door: 'lit' });
  }
  // the rests: a beam each side (it stands REST.x out, clear of a canister and cradle coming down past this socket),
  // and on it the saddle that slides in under a seated canister with the dogs
  for (const s of [-1, 1]) {
    // (pale, like the rail and its hangers: a dark beam could not be told from the wall behind it)
    B(p, 'white', s * REST.x - REST.w / 2, s * REST.x + REST.w / 2, REST.y - REST.h / 2, REST.y + REST.h / 2, 0.05, REST.z1 + 0.06, { r: 0.012, cell: 2, loops: [] });
    B(p, 'yellow', s * REST.x - REST.w / 2 - 0.006, s * REST.x + REST.w / 2 + 0.006, REST.y - REST.h / 2 - 0.006, REST.y + REST.h / 2 + 0.006, REST.z1 + 0.06, REST.z1 + 0.1);
    p.leaf('sock:saddle', saddleLeaf(s), { at: [s * REST.x, REST.y, 0], slide: [-s * REST.travel, 0, 0], door: 'lit' });
  }
  p.door('lit', [0, 0, S.deep], 0, 1, false);
  // the display's number (three places of seven strokes) and its five bars
  const D = DIGIT, x0 = dx - 0.27;
  for (let i = 0; i < GAUGE.digits; i++) for (const ch of D.order) {
    const [sx, sy, up] = SEGS[ch];
    p.leaf('sock:seg', segLeaf, { at: [x0 + i * D.pitch + sx * (D.w - D.t) / 2, dy + sy * (D.h - D.t) / 2, 0.11], rot: [0, 0, up ? PI / 2 : 0], door: 'gauge' });
  }
  for (let k = 0; k < GAUGE.bars; k++) p.leaf('sock:bar', barLeaf, { at: [dx + 0.16 + k * 0.04, dy, 0.11], door: 'gauge' });
  p.door('gauge', [dx, dy, 0.11], 0, 1, false);
}

// ── THE RACK OF EMPTIES: low, one high (so the control room's window sees over it) ───────────────────────────────────
const BAYS_RE = /^bays \d+$/;
export function oreRack(p, v) {
  const n = parseInt(v.slice(5), 10), P = RACK.pitch, x0 = -(n - 1) * P / 2, hw = (n - 1) * P / 2 + RACK.end, zs = 0.8;
  for (const s of [-1, 1]) {
    p.slab('gun', -hw, hw, 0, 0.06, s * zs - 0.09, s * zs + 0.09, { r: 0.01, cell: 3, loops: [] });
    p.slab('black', -hw, hw, 0.06, 0.2, s * (CAN.half + 0.1) - 0.03, s * (CAN.half + 0.1) + 0.03, { r: 0.01, cell: 3, loops: [] });   // (a stop bar past the canisters' ends)
  }
  for (let i = 0; i < n; i++) {
    const x = x0 + i * P;
    for (const s of [-1, 1]) { B(p, 'black', x - 0.26, x + 0.26, 0.06, 0.13, s * zs - 0.08, s * zs + 0.08); B(p, 'rubber', x - 0.24, x + 0.24, 0.13, RACK.y - CAN.R - 0.04, s * zs - 0.07, s * zs + 0.07); }
    if (i < n - 1) B(p, 'yellow', x + P / 2 - 0.05, x + P / 2 + 0.05, 0.06, 0.34, -zs - 0.1, zs + 0.1, { r: 0.015, cell: 9, loops: [] });
  }
  for (const s of [-1, 1]) { B(p, 'yellow', s * hw - 0.05, s * hw + 0.05, 0, 0.9, -zs - 0.12, zs + 0.12, { r: 0.015, cell: 9, loops: [] }); B(p, 'black', s * hw - 0.055, s * hw + 0.055, 0.42, 0.52, -zs - 0.125, zs + 0.125); }
}
export function oreCan(p, v) {
  const at = [0, RACK.y, 0];
  canisterLeaves(p, { at, door: 'canister', look: v === 'full' ? 'full' : 'empty' });
  p.door('canister', at, 0, 1, false);
}

// ── the dock apron's rail (nobody walks where the crane sets canisters down) ─────────────────────────────────────────
// Yellow posts and two rails along x, the rails at 0.6 m and 1.0 m: the heights the walking game feels walls at
// (src/walls.js BODY.heights), so the rail stops a person as surely as it looks it should.
export const GUARD = { rails: [0.6, 1.0], post: 1.04 };
export function guardRail(p, v) {
  const L = parseFloat(v.slice(4)), n = Math.max(1, Math.round(L / 2));
  for (const y of GUARD.rails) p.sweep('yellow', circle(0.03, 8), line([-L / 2, y, 0], [L / 2, y, 0], [0, 1, 0], 4));
  for (let i = 0; i <= n; i++) { const x = -L / 2 + L * i / n; p.cyl('yellow', 0.036, GUARD.post, [x, GUARD.post / 2, 0], null, 8); p.cyl('black', 0.05, 0.05, [x, 0.025, 0], null, 8); }
}

// ── THE OPERATOR'S CHAIR: a chair on a post, two sticks, a curve of live screens on a low desk before it ─────────────
const CUSHION = { c: '#2a2d31', r: 0.8, m: 0, w: 0.4 };
export const CHAIR = { eye: [0, 1.22, -0.02], screens: [['log', 0.15], ['scan', 0.4], ['furnace', 0.25], ['drive', 0.6], ['systems', 0.8]], R: 1.12, step: 0.44 };
export function opChair(p) {
  // the chair: a round foot, a post, a seat and a tall back with a headrest
  p.lathe('black', [[0.001, 0], [0.36, 0], [0.37, 0.03], [0.33, 0.06], [0.08, 0.085], [0.06, 0.38], [0.001, 0.38]], 28);
  p.cyl('chrome', 0.045, 0.1, [0, 0.36, 0], null, 14);
  B(p, 'black', -0.29, 0.29, 0.38, 0.44, -0.27, 0.29, { r: 0.02, cell: 9, loops: [] });
  p.slab(CUSHION, -0.27, 0.27, 0.44, 0.53, -0.25, 0.27, { r: 0.035, seg: 2, cell: 9, loops: [] });
  p.box(CUSHION, [0.5, 0.78, 0.1], [0, 0.93, -0.3], [-0.14, 0, 0], { r: 0.04, seg: 2, cell: 9, loops: [] });
  p.box('black', [0.54, 0.7, 0.04], [0, 0.9, -0.365], [-0.14, 0, 0], { r: 0.015, cell: 9, loops: [] });
  p.box(CUSHION, [0.3, 0.17, 0.09], [0, 1.4, -0.375], [-0.14, 0, 0], { r: 0.035, seg: 2, cell: 9, loops: [] });
  // its arms, a stick on each (yellow left, red right as you sit)
  for (const s of [-1, 1]) {
    B(p, 'black', s * 0.37 - 0.03, s * 0.37 + 0.03, 0.42, 0.63, -0.2, -0.12);
    p.slab('white', s * 0.37 - 0.065, s * 0.37 + 0.065, 0.63, 0.7, -0.25, 0.36, { r: 0.025, cell: 9, loops: [] });
    p.lathe('rubber', [[0.001, 0.7], [0.045, 0.7], [0.03, 0.74], [0.001, 0.745]], 12, [s * 0.37, 0, 0.26]);
    p.cyl('black', 0.016, 0.13, [s * 0.37, 0.795, 0.26], null, 8);
    const g = new THREE.SphereGeometry(0.032, 12, 8); g.translate(s * 0.37, 0.875, 0.26); p.add('solid', g, s > 0 ? 'yellow' : 'red');
  }
  // the screens: five in a curve, each on its own block of a low desk, leaning back toward the eye
  const { R, step } = CHAIR, tilt = 0.52;
  CHAIR.screens.forEach(([show, seed], i) => {
    const k = i - 2, a = k * step, q = new (p.constructor)();
    q.slab('white', -0.33, 0.33, 0, 0.6, -0.16, 0.16, { r: 0.03, cell: 9, loops: [] });
    q.slab('black', -0.335, 0.335, 0.06, 0.12, 0.16, 0.166, sharp);
    q.box('black', [0.64, 0.44, 0.045], [0, 0.83, -0.02], [-tilt, 0, 0], { r: 0.015, cell: 9, loops: [] });
    liveFace(q, { show, seed, w: 0.57, h: 0.37, c: 0.02 }, [0, 0.83 + 0.024 * Math.sin(tilt), -0.02 + 0.024 * Math.cos(tilt)], [-tilt, 0, 0]);
    // (stood on the curve, facing the chair: its own +z toward the chair's middle)
    const at = [Math.sin(a) * R, 0, Math.cos(a) * R], ry = a + PI;
    for (const part of q.parts) { put(part.geo, at, [0, ry, 0]); p.parts.push(part); }
  });
  p.light([0, 1.0, 0.55], 0.6, [0.35, 0.65, 1], [0, 0, 1], 3);
}

export const SMELTER_PIECES = {
  craneRail: { name: 'Crane rail', group: 'Smelter', at: 'free', variants: ['run 6', 'hanger', 'stop'], accepts: (v) => RUN_RE.test(v), foot: [6, 2.1, 0.6], build: craneRail },
  craneTurn: { name: 'Crane turntable', group: 'Smelter', at: 'free', variants: ['plate'], foot: [2.2, 2.1, 2.2], build: craneTurn },
  craneMarks: { name: 'Crane rail metre marks', group: 'Smelter', at: 'free', variants: ['wall 27 gap 10.5 12.2', 'ship 16 gap 0 0.9'], accepts: (v) => MARKS_RE.test(v), foot: [27, 0.4, 0.5], build: craneMarks },
  // (y: where its rail's underside is, for a lab that stands it on a floor: the cradle hangs well below it)
  crane: { name: 'Ceiling crane (trolley and cradle)', group: 'Smelter', at: 'point', variants: ['cradle'], foot: [1.6, 3.4, 3.4], build: crane, y: -2.6 },
  oreSocket: { name: 'Ore socket', group: 'Smelter', at: 'wall', variants: ['collar'], foot: [2.6, 1.5, 0.7], build: oreSocket },
  oreRack: { name: 'Rack of empty canisters', group: 'Smelter', at: 'free', variants: ['bays 8', 'bays 4'], accepts: (v) => BAYS_RE.test(v), foot: [9.4, 1, 2.6], build: oreRack },
  oreCan: { name: 'Ore canister (on the rack)', group: 'Smelter', at: 'free', variants: ['empty', 'full'], foot: [1.1, 1.3, 2.3], build: oreCan },
  guardRail: { name: 'Guard rail', group: 'Smelter', at: 'free', variants: ['run 4'], accepts: (v) => RUN_RE.test(v), foot: [4, 1.1, 0.1], build: guardRail },
  opChair: { name: "Operator's chair and screens", group: 'Smelter', at: 'free', variants: ['crane'], foot: [2.6, 1.5, 2], build: opChair },
};
