// THE BANJO IN NUMBERS: its size, where it sits on the banjo player's lap and where his hands go on it. No three.js
// here, so the node tests and the Blender script that makes his clips (~/pw/bandit-math/rigs/clips/banjo_clips.py, by
// way of ~/pw/bandit-math/rigs/banjoplayer/dump_banjo.mjs) read the same numbers as the game's shapes (src/banjo.js).
//
// An open-back banjo of the 1880s: an 11 inch pot (28 cm across, 6.5 cm deep) with a calfskin head, a 26 inch scale
// (66 cm from the nut to the bridge), a slotted peghead, and the short fifth string's peg on the neck's side at the fifth
// fret. About 92 cm overall.
//
// The banjo's own frame (metres): the origin in the middle of the head's face; x along the neck toward the peghead; y out
// of the head (the strings' side); z across (x cross y: on the lap, -z is the neck's upper side, where the fifth peg is).
//
//   BANJO              the sizes
//   fret(n)            x of fret n (0: the nut)
//   PLACE              where it sits in the player's own frame (three's: x his left, y up, z the way he faces; the
//                      origin on the floor under the middle of his stool): the pot on his right thigh, the head turned
//                      out to the room and tipped a little up, the neck rising to his left
//   placeMatrix()      PLACE as a 4 x 4 (column after column, as three's Matrix4.fromArray takes it): the banjo's frame in
//                      the player's
//   HANDS              the wrist bones' frames in the banjo's (at, fingers, back: as src/fiddleplan.js HOLD has them),
//                      playing and resting: the right hand over the head picking, the left on the neck
//   PICK               the picking hand's stroke: how far it falls toward the strings on each beat
//   STOOL              the stool he sits on (as the drummer's crate: its top at the seat's height)
//   banjoData()        everything the clip script needs, as plain data
//   banjoPlaying(events, t, hold)   whether the banjo player picks at t: a banjo note of the music's (makeStageMusic's
//                      M.events, in time order) sounding then, or starting or ended within `hold` s of it
export const BANJO = {
  pot: { r: 0.14, depth: 0.065, rim: 0.012 },        // the pot's radius, depth, and its wooden rim's thickness
  head: 0.004,                                        // the head stands this far proud of the rim's top
  bridge: -0.06,                                      // x of the bridge on the head (toward the tailpiece)
  scale: 0.66,                                        // the strings' length, the nut to the bridge
  neck: { w0: 0.034, w1: 0.03, t: 0.024 },           // its width at the heel and at the nut, its thickness
  peghead: { long: 0.16, w: 0.055, t: 0.016 },
  peg5: 5,                                            // the fifth string's peg at the fifth fret
  tail: { long: 0.07, w: 0.03 },                      // the tailpiece on the head, from the rim toward the bridge
};
BANJO.nut = BANJO.bridge + BANJO.scale;
BANJO.length = BANJO.nut + BANJO.peghead.long + BANJO.pot.r;
export const fret = (n) => BANJO.nut - BANJO.scale * (1 - Math.pow(2, -n / 12));

// on his lap (the player's own frame): the pot's middle, the neck's way and the head's way
export const PLACE = { at: [-0.1, 0.7, 0.25], along: [0.87, 0.42, 0.27], out: [0, 0.3, 1] };
export const STOOL = { r: 0.17, h: 0.4 };

// the hands (in the banjo's frame). The right: a clawhammer hand, curled, its back turned out to the room, the wrist
// over the head toward the neck's upper side and the fingers dropping across the strings by the neck's end. The left:
// round the neck by the third fret from below, the thumb behind it, the fingers coming up over the fingerboard.
export const HANDS = {
  play: {
    R: { at: [0.03, 0.075, -0.06], fingers: [0.25, -0.45, 0.86], back: [0, 1, 0.3] },
    L: { at: [0.43, -0.045, 0.055], fingers: [-0.1, 0.55, -0.83], back: [0, -0.6, 0.8] },
  },
  rest: {
    R: { at: [-0.04, 0.06, -0.14], fingers: [0.3, -0.25, 0.92], back: [0, 1, 0.2] },
    L: { at: [0.37, -0.045, 0.06], fingers: [-0.1, 0.5, -0.86], back: [0, -0.6, 0.8] },
  },
};
export const PICK = { drop: 0.022, lift: 0.012 };   // (metres along the fingers: down onto the strings on the beat, up off)

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a) => scale(a, 1 / Math.hypot(...a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a frame from a point, a main way and a second way made square to it: { x, y, z, at }
function frameOf(at, main, second) { const x = norm(main), y = norm(sub(second, scale(x, dot(second, x)))); return { x, y, z: cross(x, y), at: at.slice() }; }
export function placeFrame() { return frameOf(PLACE.at, PLACE.along, PLACE.out); }
export function placeMatrix() {
  const { x, y, z, at } = placeFrame();
  return [...x, 0, ...y, 0, ...z, 0, ...at, 1];
}
// a hand's wrist frame in the banjo's (y the fingers' way, z the back's, x = y cross z), as src/fiddleplan.js wristFrame
export function handFrame(pose, side) {
  const H = HANDS[pose][side], y = norm(H.fingers), z = norm(sub(H.back, scale(y, dot(H.back, y))));
  return { x: cross(y, z), y, z, at: H.at.slice() };
}
export function banjoData() {
  return { BANJO, PLACE, STOOL, HANDS, PICK, place: placeFrame(),
    hands: Object.fromEntries(['play', 'rest'].map((p) => [p, { R: handFrame(p, 'R'), L: handFrame(p, 'L') }])) };
}
export function banjoPlaying(events, t, hold = 0.35) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]; if (e.what !== 'banjo') continue;
    if (e.at - hold <= t && t < e.at + e.len + hold) return true;
    if (e.at + e.len + hold < t - 2) break;   // (in time order: none further back still sounds)
  }
  return false;
}
