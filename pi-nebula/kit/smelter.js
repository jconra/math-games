// THE SMELTER'S ORE LINE in the Miner hangar, as the game's maker picked it from the option sheets (2026-11-15) and
// then reshaped it (2026-11-16):
//   the crane          a BRIDGE CRANE over the whole hangar: "the beam that goes out over the ship should go all the way
//                      across the hanger. The beam that goes across the whole hanger should be able to move back and
//                      forth ... it can start moving it in 3 different axis at once" and "the actual crane box should be
//                      able to rotate the canister, so it doesn't depend on going to a 'turntable'". It keeps the
//                      first pick's look: a cradle whose arms close under the canister, warning lamps, light strips
//   the canisters       "I like the level windows. The ring lights are cool for the canisters regardless": both are
//                       on the canister itself (kit/ships/miner-built.js canisterLeaves); here, the low rack of empties
//   the wall sockets    "the circular docks make the most sense. I like the little ring on the first and the digital
//                       display on the 3rd": a round collar with a lit ring and an iris shutter, a number and bars;
//                       numbered 1 to 8 on the wall ("I feel like the Docks should be named 1-8")
//   the job console     "operator chair might be best": a chair with a curve of screens and two sticks
// These are the pieces; what makes them move is kit/crane.js (where everything is) and src/crane.js (the game's clock).
//
// HOW THE BRIDGE CRANE IS MADE (as the hangar cranes a person works under are). Two RUNWAY beams run the length of the
// hangar, high on its two long walls, each on a bracket at every rib, a rail along its top. The BRIDGE spans the hangar
// between them: one deep box girder, its ends fixed to the side of an END TRUCK on each runway, whose wheels run on the
// rail, so the whole bridge rolls along the hangar (the x axis). The TROLLEY hangs under the girder, its wheels on the
// girder's bottom flange, and runs along it (the y axis, across the hangar); in it the hoist's drum, and from it four
// cables down to the BOTTOM BLOCK (up and down: the height). Under the block a ROTATOR turns the CRADLE, so the cradle
// turns a canister itself: no turntable. The cradle is the first pick's: a frame that sits on the canister's crown, a
// latch for its lug, two pairs of curved arms that slide round it from above until their tips meet under it (nothing
// swings out sideways, so it takes a canister from between its neighbours on the rack or beside a docked one).
// Every axis has its numbers: metre marks along the runways (x, counted from the hangar's west wall) and along both
// sides of the girder (y, counted from the south wall), and a screen on the trolley (src/crane.js) with all three.
// Docking aids (the game's maker: "Close enough on the x-axis? A light on that beam turns green. Close enough on the
// y-axis? a light on the crane turns green"): a light strip along each side of the girder (x), a ring of light round
// the trolley (y), the cradle's own lamps (the height); kit/crane.js tints them.
//
//   craneRunway  a FREE piece, its origin on the rail's top on the beam's middle line: 'run <metres>' a runway along x
//                (its middle at the origin); 'bracket' one of its brackets, back to a rib's fin (toward -z); 'stop' an
//                end stop on the rail (the bridge comes from its +x side)
//   craneMarks   a FREE piece: 'x <metres>' a runway's metre marks along +x from the origin (the count's 0), on the
//                beam's +z face (the side the hangar is on); 'x <metres> back' counting down from <metres>
//   crane        a POINT piece, its point on the runways' rail tops, midway between them: the bridge (girder along z, its
//                span in the variant: 'bridge <span> y <mark at the middle> <+1 or -1 a metre along +z>') and all it
//                carries, as leaves (door 'crane'): 'crane:bridge', 'crane:xlight', 'crane:trolley', 'crane:ylight',
//                'crane:beacon', four 'crane:cable', 'crane:block', 'crane:cradle', four 'crane:arc', 'crane:lamp'. As
//                placed it is parked: cradle up, arms open, the trolley at the bridge's middle
//   oreSocket    a WALL piece, its middle on the collar's middle: the collar (standing SOCKET.deep out of the wall),
//                the display to its right and the socket's number over it ('collar 3'); leaves: 'sock:petal' x 12 (door
//                'iris': they fold back into the collar), 'sock:ring' (the lit ring), 'sock:dog' x 4 (the latch dogs
//                that grip a seated canister) and 'sock:saddle' x 2 (the rests that slide in under it; all door 'lit'),
//                'sock:seg' x 21 and 'sock:bar' x 5 (the display's number and bars)
//   oreRack      a FREE piece: 'bays <n>' the low rack, its bays side by side along x, a canister lying along z in each
//   oreCan       a FREE piece: a canister lying along z, its middle RACK.y up ('empty' or 'full'): the rack's
//   guardRail    a FREE piece: 'run <metres>' a yellow rail along x (the dock apron's)
//   opChair      a FREE piece facing +z: 'crane' the operator's chair with its curve of screens
import * as THREE from 'three';
import { bevelBox, put, circle, bend, line, sweep, rrect } from './geo.js';
import { liveFace } from './shipparts/cabin/live.js';
import { canisterLeaves } from './ships/miner-built.js';
import { CANISTER_AT } from './ships/miner-built.hull.js';

const PI = Math.PI;
const flat = { r: 0.012, cell: 9, loops: [] }, sharp = { r: 0, cell: 9, loops: [] };
const B = (p, surf, x0, x1, y0, y1, z0, z1, o = flat) => p.slab(surf, x0, x1, y0, y1, z0, z1, o);
const glowBox = (p, look, x0, x1, y0, y1, z0, z1) => p.add('glow', bevelBox([x1 - x0, y1 - y0, z1 - z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], { r: 0, cell: 9, loops: [] }), look);
// (a glow's own colour may be a name from the kit's list or a linear colour)
// (kept below where the picture's tone curve washes a colour out to white: green stays green, amber amber)
export const GLOWS = { ok: [0.14, 1.5, 0.42], off: [0.016, 0.03, 0.024], ringOff: [0.07, 0.085, 0.1], ringOn: [0.16, 1.9, 0.5], low: [2.0, 0.62, 0.04], beaconOff: [0.22, 0.1, 0.012], beaconOn: [7.5, 2.6, 0.12],
  aidOff: [0.05, 0.06, 0.07], aidNear: [1.6, 0.75, 0.05], aidOn: [0.12, 1.8, 0.4], target: [2.6, 2.0, 0.12] };

// ── the numbers the pieces and the crane share (metres; heights from the runway rails' top unless said) ─────────────
export const CRANE = {
  runway: { w: 0.17, h: 0.45, rail: 0.07, railW: 0.035 },            // a runway beam: half its width, its depth; its rail: height, half width
  bracket: { back: 0.28, knee: 0.42 },                               // a bracket: from the beam's middle line back to the rib's fin; its knee under the beam
  truck: { half: 1.3, w: 0.21, h: 0.66, wheel: 0.17, buffer: 0.16 },  // an end truck on the rail: half its length (x), half its width (z), its height; its wheels; its buffers
  girder: { w: 0.27, y0: -0.22, y1: 0.78, flange: 0.36, ft: 0.05, gap: 0.06 },   // the bridge's girder: half its width, its underside and top; its bottom flange's half width and thickness; its end's gap to the end truck
  trolley: { x: 0.5, z: 0.36, y0: -0.8, y1: -0.3 },                  // the trolley under the girder: half sizes across (x) and along (z) it; its body's underside and top
  cable: { x: 0.24, z: 0.24, unit: 0.7, r: 0.016, least: 0.35 },     // the four cables: where (half spacing); the leaf's own length; its thickness; the shortest they get
  block: { half: 0.32, h: 0.22, rot: 0.3, rotH: 0.08 },              // the bottom block on the cables (it does not turn); the rotator under it
  grip: { top: 0.79, under: 0.67, w: 0.35, half: 0.65 },             // the cradle's frame, from the canister's middle line up: its top, its underside
  arc: { r: 0.54, tube: 0.03, z: 0.55, gap: 0.036, half: 72 * PI / 180, shut: 108 * PI / 180 },   // an arm: its radius; open it spans `half` each side of the top
};
// (the hook: a held canister's middle line. Its highest, from the rail's top: the cables as short as they get)
CRANE.hookTop = CRANE.grip.top + CRANE.block.rotH + CRANE.block.h;   // (the block's top over the hook)
CRANE.carry = CRANE.trolley.y0 - CRANE.cable.least - CRANE.hookTop;
// (seat: how far in a canister's end sits; clear: how far off the mouth it comes down, which keeps it and the cradle
// out from under the ledges and rib knees of the wall above; rise: how far the cradle lifts off a docked canister
// before it backs away)
export const SOCKET = { deep: 0.62, bore: 0.535, out: 0.68, seat: 0.4, clear: 0.45, rise: 0.9, mouth: 0.585, display: [1.24, 0] };
export const RACK = { pitch: 1.15, y: 0.65, end: 0.78 };   // (end: from the last canister's middle to the rack's end plate, clear of the crane's arms)
const CAN = { R: CANISTER_AT.R, half: CANISTER_AT.half };

// ── numbers in strokes (the sockets' display's seven strokes, painted) ─────────────────────────────────────────────
const SEGS = { a: [0, 1, 0], b: [1, 0.5, 1], c: [1, -0.5, 1], d: [0, -1, 0], e: [-1, -0.5, 1], f: [-1, 0.5, 1], g: [0, 0, 0] };   // (where: across, up, upright?)
export const DIGIT = { h: 0.2, w: 0.1, t: 0.022, pitch: 0.14, order: 'abcdefg', on: { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' } };
// a number painted on a flat face: `text` centred at (u, v) on the face, digits `D.h` tall; the face is the plane
// through `at` along the unit `across` (left to right as read) and up; `out` is the face's outward normal (the paint
// stands a hair off it). Into piece p, in `surf`
function paint(p, surf, text, at, across, out, D) {
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const cu = (i - (n - 1) / 2) * D.pitch, on = DIGIT.on[text[i]] || '';
    for (const ch of on) {
      const [sx, sy, up] = SEGS[ch], mu = cu + sx * (D.w - D.t) / 2, mv = sy * (D.h - D.t) / 2;
      const hu = up ? D.t / 2 : (D.w - D.t) / 2 - 0.004, hv = up ? (D.h - D.t) / 4 + 0.003 : D.t / 2;
      const c = [at[0] + across[0] * mu + out[0] * 0.004, at[1] + mv, at[2] + across[2] * mu + out[2] * 0.004];
      const sxz = [Math.abs(across[0]) * 2 * hu + Math.abs(out[0]) * 0.006, 2 * hv, Math.abs(across[2]) * 2 * hu + Math.abs(out[2]) * 0.006];
      p.slab(surf, c[0] - sxz[0] / 2, c[0] + sxz[0] / 2, c[1] - sxz[1] / 2, c[1] + sxz[1] / 2, c[2] - sxz[2] / 2, c[2] + sxz[2] / 2, sharp);
    }
  }
}

// ── THE RUNWAYS ─────────────────────────────────────────────────────────────────────────────────────────────────────
const RUN_RE = /^run \d+(\.\d+)?$/, BRACKET_RE = /^bracket( \d+(\.\d+)?)?$/;
export function craneRunway(p, v) {
  const R = CRANE.runway, K = CRANE.bracket, y0 = -R.rail - R.h, y1 = -R.rail;
  if (v.startsWith('bracket')) {
    // a plate on the rib's fin (or the wall: 'bracket 0.46', how far back it reaches), a shelf under the beam, a knee
    // from the plate out under the shelf
    const back = parseFloat(v.split(' ')[1]) || K.back;
    B(p, 'gun', -0.16, 0.16, y0 - K.knee - 0.1, y1 + 0.02, -back - 0.03, -back + 0.02);
    B(p, 'gun', -0.14, 0.14, y0 - 0.06, y0, -back, R.w + 0.03);
    const len = Math.hypot(K.knee, back + R.w), ang = Math.atan2(K.knee, back + R.w);
    p.box('gun', [0.08, 0.1, len], [0, y0 - K.knee / 2 - 0.04, (R.w - back) / 2], [-ang, 0, 0], flat);
    for (const s of [-1, 1]) p.cyl('rail', 0.022, 0.025, [s * 0.09, y0 - K.knee + 0.02, -back + 0.03], [PI / 2, 0, 0], 8);
    return;
  }
  if (v === 'stop') {
    // a yellow end stop on the rail, its rubber buffer toward +x
    B(p, 'yellow', -0.22, 0.02, 0, 0.34, -R.w - 0.03, R.w + 0.03, { r: 0.02, cell: 9, loops: [] });
    B(p, 'rubber', 0.02, 0.12, 0.08, 0.26, -0.11, 0.11);
    for (let k = 0; k < 2; k++) B(p, 'black', -0.2, 0, 0.06 + k * 0.14, 0.12 + k * 0.14, -R.w - 0.032, R.w + 0.032, sharp);
    return;
  }
  const L = parseFloat(v.slice(4));
  // the beam: a white box with a dark band along its foot, the rail on its top (on a dark pad)
  p.slab('white', -L / 2, L / 2, y0, y1, -R.w, R.w, { r: 0.02, cell: 2, loops: [] });
  p.slab('black', -L / 2, L / 2, y0, y0 + 0.05, -R.w - 0.004, R.w + 0.004, { r: 0.006, cell: 2, loops: [] });
  p.slab('black', -L / 2, L / 2, y1, y1 + 0.012, -R.railW - 0.03, R.railW + 0.03, { r: 0, cell: 2, loops: [] });
  p.slab('rail', -L / 2, L / 2, y1 + 0.012, 0, -R.railW, R.railW, { r: 0.008, cell: 2, loops: [] });
}

// ── THE METRE MARKS: where the crane is, read off the crane itself (the crane operator job reads them too) ──────────
// Dark on the white runway: a tick every half metre (taller on the whole metres) and the metre's number over each
// whole one. Along the girder (kit's crane piece, below) the same, both sides. A FREE piece on the runway's face.
export const MARKS = { h: 0.24, w: 0.12, t: 0.03, pitch: 0.165, tick: [0.06, 0.1] };
const MARKS_RE = /^x \d+(\.\d+)?( back)?$/;
export function craneMarks(p, v) {
  const parts = v.split(' '), L = parseFloat(parts[1]), back = parts[2] === 'back', R = CRANE.runway, D = MARKS;
  const z = R.w + 0.001, yb = -R.rail - R.h + 0.05;
  for (let k = 0; k <= L * 2; k++) {
    const x = k / 2, whole = k % 2 === 0, th = whole ? D.tick[1] : D.tick[0];
    if (x < 0.3 || x > L - 0.3) continue;
    p.slab('black', x - 0.012, x + 0.012, yb + 0.01, yb + 0.01 + th, z, z + 0.005, sharp);
    if (whole) paint(p, 'black', String(back ? L - x : x), [x, yb + th + 0.03 + D.h / 2, z], [1, 0, 0], [0, 0, 1], D);
  }
}

// ── THE CRANE: the bridge, the trolley, cables, block, cradle, arms ─────────────────────────────────────────────────
const BRIDGE_RE = /^bridge \d+(\.\d+)? y -?\d+(\.\d+)? -?1$/;
// (the parts' sizes as the variant gives them: the span between the runways' middle lines, and the girder's marks)
export function craneSpan(v) {
  const m = /^bridge (\d+(?:\.\d+)?)(?: y (-?\d+(?:\.\d+)?) (-?1))?$/.exec(v || '');
  const span = m ? parseFloat(m[1]) : 26.64;
  return { span, mid: m && m[2] != null ? parseFloat(m[2]) : null, way: m && m[3] ? parseInt(m[3], 10) : -1 };
}
function bridgeLeaf(span, mid, way) {
  return (lp) => {
    const T = CRANE.truck, G = CRANE.girder, h = span / 2, ze = h - T.w - G.gap;   // (the girder's ends)
    // the end trucks: a long box on the rail at each end, its wheels, its buffers; yellow and black
    for (const s of [-1, 1]) {
      const zc = s * h;
      lp.slab('yellow', -T.half, T.half, T.wheel * 0.7, T.h, zc - T.w, zc + T.w, { r: 0.03, cell: 9, loops: [] });
      lp.slab('black', -T.half + 0.06, T.half - 0.06, T.h - 0.07, T.h - 0.02, zc - T.w - 0.004, zc + T.w + 0.004, sharp);
      for (const x of [-T.half + 0.3, T.half - 0.3]) for (const sz of [-1, 1]) lp.cyl('gun', T.wheel, 0.05, [x, T.wheel, zc + sz * 0.06], [PI / 2, 0, 0], 16);
      for (const sx of [-1, 1]) { B(lp, 'black', sx * T.half - 0.02, sx * T.half + 0.02, 0.18, 0.5, zc - 0.12, zc + 0.12); lp.cyl('rubber', 0.08, T.buffer, [sx * (T.half + T.buffer / 2), 0.34, zc], [0, 0, PI / 2], 12); }
      // (the girder's end plate, bolted to the truck's inner side)
      B(lp, 'black', -G.w - 0.1, G.w + 0.1, G.y0, G.y1, Math.min(s * ze, s * (h - T.w)), Math.max(s * ze, s * (h - T.w)));
    }
    // the girder: a deep yellow box (yellow on top too: the plan from above shows the bridge), a black band along the
    // top of each side, the bottom flange the trolley runs on
    lp.slab('yellow', -G.w, G.w, G.y0 + G.ft, G.y1, -ze, ze, { r: 0.025, cell: 3, loops: [] });
    for (const s of [-1, 1]) lp.slab('black', s * (G.w + 0.002) - 0.004, s * (G.w + 0.002) + 0.004, G.y1 - 0.07, G.y1 - 0.01, -ze, ze, { r: 0, cell: 3, loops: [] });
    lp.slab('gun', -G.flange, G.flange, G.y0, G.y0 + G.ft, -ze, ze, { r: 0.008, cell: 3, loops: [] });
    // the metre marks along both its sides (the y axis: the number at z is mid + way * z), every half metre a tick,
    // every metre its number, read the right way from each side
    if (mid != null) {
      const D = { ...MARKS, h: 0.3, w: 0.15, t: 0.035, pitch: 0.2 }, yb = G.y0 + G.ft + 0.04;
      const lo = Math.min(mid - ze, mid + ze), hi = Math.max(mid - ze, mid + ze);
      for (let n = Math.ceil(lo * 2) / 2; n <= hi + 1e-6; n += 0.5) {
        const z = (n - mid) * way; if (Math.abs(z) > ze - 0.3) continue;
        const whole = Math.abs(n - Math.round(n)) < 1e-6, th = whole ? 0.16 : 0.09;
        for (const s of [-1, 1]) {
          const x = s * (G.w + 0.002);
          B(lp, 'black', x - 0.003, x + 0.003, yb, yb + th, z - 0.014, z + 0.014, sharp);
          if (whole && n >= 0) paint(lp, 'black', String(Math.round(n)), [x, yb + th + 0.06 + D.h / 2, z], [0, 0, -s], [s, 0, 0], D);
        }
      }
    }
  };
}
// the x axis's light: a strip along each side of the girder's foot, the whole length (kit/crane.js tints it)
function xLightLeaf(span) {
  return (lp) => {
    const T = CRANE.truck, G = CRANE.girder, ze = span / 2 - T.w - G.gap - 0.1;
    for (const s of [-1, 1]) glowBox(lp, GLOWS.aidOff, s * (G.w + 0.004) - 0.006, s * (G.w + 0.004) + 0.006, G.y0 + G.ft + 0.006, G.y0 + G.ft + 0.034, -ze, ze);
  };
}
function trolleyLeaf(lp) {
  const T = CRANE.trolley, G = CRANE.girder, yf = G.y0 + G.ft;
  // its side plates up past the flange to the wheels on it, the wheels, a cross tie over the flange
  for (const s of [-1, 1]) {
    B(lp, 'grey2', s * (G.flange + 0.05) - 0.03, s * (G.flange + 0.05) + 0.03, T.y1, yf + 0.16, -T.z + 0.04, T.z - 0.04);
    for (const z of [-T.z + 0.13, T.z - 0.13]) lp.cyl('black', 0.07, 0.05, [s * (G.flange - 0.05), yf + 0.07, z], [0, 0, PI / 2], 14);
  }
  // the body: the hoist and its drum, a dark band, the motor's box on one end
  lp.slab('grey2', -T.x, T.x, T.y0, T.y1, -T.z, T.z, { r: 0.05, cell: 9, loops: [] });
  lp.slab('black', -T.x - 0.01, T.x + 0.01, T.y0 + 0.16, T.y0 + 0.24, -T.z - 0.01, T.z + 0.01, { r: 0.015, cell: 9, loops: [] });
  B(lp, 'gun', -0.3, 0.3, T.y0 + 0.06, T.y1 - 0.06, T.z, T.z + 0.18);
  // (the beacons' housings, one at each end under the body, and the screens' frames on its two sides: src/crane.js
  // lays the screens with the crane's numbers on them)
  for (const sz of [-1, 1]) lp.cyl('black', 0.12, 0.05, [0, T.y0 - 0.025, sz * (T.z - 0.12)], null, 14);
  for (const s of [-1, 1]) B(lp, 'black', s * T.x - 0.02, s * T.x + 0.02, T.y0 + 0.03, T.y1 - 0.03, -T.z + 0.03, T.z - 0.03);
}
// the y axis's light: a ring of light round the trolley's foot (kit/crane.js tints it)
function yLightLeaf(lp) {
  const T = CRANE.trolley, y = T.y0 + 0.015;
  for (const s of [-1, 1]) { glowBox(lp, GLOWS.aidOff, s * (T.x + 0.012) - 0.006, s * (T.x + 0.012) + 0.006, y, y + 0.03, -T.z, T.z); glowBox(lp, GLOWS.aidOff, -T.x, T.x, y, y + 0.03, s * (T.z + 0.012) - 0.006, s * (T.z + 0.012) + 0.006); }
}
function beaconLeaf(lp) {
  const T = CRANE.trolley;
  for (const sz of [-1, 1]) {
    const g = new THREE.SphereGeometry(0.1, 12, 5, 0, PI * 2, PI / 2, PI / 2); g.translate(0, T.y0 - 0.05, sz * (T.z - 0.12));
    lp.add('glow', g, GLOWS.beaconOff);
  }
}
function cableLeaf(lp) { const K = CRANE.cable; lp.cyl('rail', K.r, K.unit, [0, -K.unit / 2, 0], null, 6); }
// the bottom block, in the hook's frame (it rides on the cables and never turns): its sheaves' box, the rotator's
// ring under it (yellow and black: its turning shows on the cradle under it)
function blockLeaf(lp) {
  const K = CRANE.block, y0 = CRANE.grip.top + K.rotH;
  lp.slab('gun', -K.half, K.half, y0, y0 + K.h, -K.half, K.half, { r: 0.04, cell: 9, loops: [] });
  for (const s of [-1, 1]) lp.cyl('black', 0.12, 0.05, [s * (K.half - 0.04), y0 + K.h / 2, 0], [0, 0, PI / 2], 14);
  lp.cyl('yellow', K.rot, K.rotH - 0.012, [0, CRANE.grip.top + K.rotH / 2, 0], null, 28);
  for (let k = 0; k < 6; k++) { const a = k * PI / 3; B(lp, 'black', Math.cos(a) * (K.rot - 0.02) - 0.03, Math.cos(a) * (K.rot - 0.02) + 0.03, CRANE.grip.top + 0.01, CRANE.grip.top + K.rotH - 0.01, Math.sin(a) * (K.rot - 0.02) - 0.03, Math.sin(a) * (K.rot - 0.02) + 0.03, sharp); }
}
const ARC_PROFILE = (t) => circle(t, 6);
// (an arc about the z axis through the origin: radius r, from angle a0 to a1 measured from straight up, toward +x)
const arcPath = (r, a0, a1, z = 0, seg = 14) => bend([0, 0, z], r, [0, 1, 0], [1, 0, 0], a0, a1, seg);
function cradleLeaf(lp) {
  const G = CRANE.grip, A = CRANE.arc;
  // the frame over the canister, a dark edge round it, a lit line along each side, a yellow arrow on its top (which
  // way it is turned: the rotator over it turns it)
  lp.slab('grey2', -G.w, G.w, G.under, G.top, -G.half, G.half, { r: 0.03, cell: 9, loops: [] });
  lp.slab('black', -G.w - 0.012, G.w + 0.012, G.under + 0.03, G.top - 0.03, -G.half - 0.012, G.half + 0.012, { r: 0.012, cell: 9, loops: [] });
  for (const s of [-1, 1]) glowBox(lp, GLOWS.ok, s * (G.w + 0.012) - 0.004, s * (G.w + 0.012) + 0.004, G.under + 0.045, G.top - 0.045, -0.42, 0.42);
  lp.extrude('yellow', [[-0.12, 0.2], [0, 0.42], [0.12, 0.2], [0.05, 0.2], [0.05, -0.36], [-0.05, -0.36], [-0.05, 0.2]], 0.01, 0.002).rotateX(-PI / 2).translate(0, G.top, 0);
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
// (the cradle's own lamps: a bar across each end of its frame. Amber flashing with the beacons as a warning; green
// when the height is right to grab a canister or set one down: kit/crane.js tints them)
function cradleLampLeaf(lp) { const G = CRANE.grip; for (const s of [-1, 1]) glowBox(lp, GLOWS.beaconOff, -0.22, 0.22, G.under + 0.03, G.top - 0.03, s * (G.half + 0.012) - 0.006, s * (G.half + 0.012) + 0.006); }
// (the arms: two at each end of the cradle, side by side; one of each pair slides round one way, one the other)
// (way: +1 round toward the cradle's +x, -1 toward -x. The cradle is the same turned half way round.)
export const ARMS = [-1, 1].flatMap((end) => [1, -1].map((s) => ({ z: end * (CRANE.arc.z + s * CRANE.arc.gap), way: end * s })));
export function crane(p, v) {
  const C = CRANE, { span, mid, way } = craneSpan(v), yc = C.carry, top = C.trolley.y0;
  p.leaf('crane:bridge', bridgeLeaf(span, mid, way), { door: 'crane' });
  p.leaf('crane:xlight', xLightLeaf(span), { door: 'crane' });
  p.leaf('crane:trolley', trolleyLeaf, { door: 'crane' });
  p.leaf('crane:ylight', yLightLeaf, { door: 'crane' });
  p.leaf('crane:beacon', beaconLeaf, { door: 'crane' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.leaf('crane:cable', cableLeaf, { at: [sx * C.cable.x, top, sz * C.cable.z], door: 'crane' });
  p.leaf('crane:block', blockLeaf, { at: [0, yc, 0], door: 'crane' });
  p.leaf('crane:cradle', cradleLeaf, { at: [0, yc, 0], door: 'crane' });
  for (const a of ARMS) p.leaf('crane:arc', arcLeaf, { at: [0, yc, a.z], hinge: { at: [0, yc, a.z], axis: [0, 0, 1], angle: -a.way * C.arc.shut }, door: 'crane' });
  p.leaf('crane:lamp', cradleLampLeaf, { at: [0, yc, 0], door: 'crane' });
  p.door('crane', [0, yc, 0], 0, 0.5, true);
}

// ── THE WALL SOCKET: a round collar, its iris, its lit ring, its display ─────────────────────────────────────────────
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
const SOCKET_RE = /^collar( \d+)?$/;
export const SOCKET_NUMBER = { h: 0.3, w: 0.16, t: 0.04, pitch: 0.21, y: 0.43 };   // (painted white over the display)
export function oreSocket(p, v = 'collar') {
  const S = SOCKET, [dx, dy] = S.display;
  // its number, painted on the plate over the display ('collar 3': socket 3)
  const num = (v || '').split(' ')[1];
  if (num) paint(p, 'white', num, [dx, dy + SOCKET_NUMBER.y, 0.05], [1, 0, 0], [0, 0, 1], SOCKET_NUMBER);
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
  craneRunway: { name: 'Crane runway', group: 'Smelter', at: 'free', variants: ['run 6', 'bracket', 'stop'], accepts: (v) => RUN_RE.test(v) || BRACKET_RE.test(v), foot: [6, 1, 0.8], build: craneRunway },
  craneMarks: { name: 'Crane runway metre marks', group: 'Smelter', at: 'free', variants: ['x 12', 'x 12 back'], accepts: (v) => MARKS_RE.test(v), foot: [12, 0.5, 0.4], build: craneMarks },
  // (y: the lowest it hangs under its point, for a lab that stands it on a floor: the cradle hangs well below the rails)
  crane: { name: 'Bridge crane (bridge, trolley and cradle)', group: 'Smelter', at: 'point', variants: ['bridge 12 y 6 -1'], accepts: (v) => BRIDGE_RE.test(v), foot: [3.2, 3.6, 12], build: crane, y: -2.85 },
  oreSocket: { name: 'Ore socket', group: 'Smelter', at: 'wall', variants: ['collar', 'collar 1'], accepts: (v) => SOCKET_RE.test(v), foot: [2.6, 1.5, 0.7], build: oreSocket },
  oreRack: { name: 'Rack of empty canisters', group: 'Smelter', at: 'free', variants: ['bays 8', 'bays 4'], accepts: (v) => BAYS_RE.test(v), foot: [9.4, 1, 2.6], build: oreRack },
  oreCan: { name: 'Ore canister (on the rack)', group: 'Smelter', at: 'free', variants: ['empty', 'full'], foot: [1.1, 1.3, 2.3], build: oreCan },
  guardRail: { name: 'Guard rail', group: 'Smelter', at: 'free', variants: ['run 4'], accepts: (v) => RUN_RE.test(v), foot: [4, 1.1, 0.1], build: guardRail },
  opChair: { name: "Operator's chair and screens", group: 'Smelter', at: 'free', variants: ['crane'], foot: [2.6, 1.5, 2], build: opChair },
};
