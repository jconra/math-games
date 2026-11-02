// THE UPRIGHT BASS IN NUMBERS (no three.js: the model, the player's hands, the lab, the music and the tests read the same ones).
// A three-quarter double bass of the 1880s, sloped shoulders, about 1.9 m to the top of its scroll on its endpin; strings
// E A D G, 1.06 m from the nut to the bridge.
// Its own frame (metres): x along it from the body's bottom edge toward the scroll, y out of the top (the strings' side), z across
// toward the G string (the E is at -z). The top's edge is at y = 0, the back's at y = -BASS.ribs.
//   BASS            the sizes
//   stringAt(k, x)  string k (0 E, 1 A, 2 D, 3 G) at x along it: [x, y (its top), z]
//   stopX(n)        x of stop n on the fingerboard (0: the nut)
//   PLUCK           x where the fingers pull the strings (over the fingerboard's end, as refs/hands/bass.png)
//   PLACE           where it stands in the player's own frame (x his left, y up, z the way he faces): on its endpin, leaning back on him
//   bassNote(ev) -> midi or null   the note his hands follow in a music event: he adds no sound; the low notes the piano's left hand already sounds, at their pitch
import { fretDistance } from './fretplan.js';

export const BASS = {
  body: 1.1, ribs: 0.2, ribsTop: 0.13, endpin: 0.14,
  outline: [[0, 0.04], [0.02, 0.17], [0.07, 0.27], [0.15, 0.325], [0.25, 0.335], [0.34, 0.31], [0.4, 0.27], [0.43, 0.205], [0.49, 0.175], [0.57, 0.17], [0.65, 0.185], [0.69, 0.235], [0.74, 0.25], [0.84, 0.235], [0.94, 0.19], [1.03, 0.125], [1.1, 0.07]],
  bridge: { x: 0.46, h: 0.135, w: 0.095 },
  nut: 1.52, scale: 1.06, scroll: 0.24,
  fingerboard: { from: 0.76, to: 1.52, w0: 0.095, w1: 0.046, t: 0.012, y0: 0.083, y1: 0.074 },
  neck: { w0: 0.06, w1: 0.046, t: 0.036 },
  tail: { from: 0.1, to: 0.34, w0: 0.03, w1: 0.075 },
  strings: { bridge: { z: [-0.036, -0.012, 0.012, 0.036] }, nut: { z: [-0.015, -0.005, 0.005, 0.015] } },
};
export const stopX = (n) => BASS.nut - fretDistance(n, BASS.scale);
export const PLUCK = 0.88;
export function stringAt(k, x) {
  const B = BASS, u = (x - B.bridge.x) / (B.nut - B.bridge.x), fb = B.fingerboard, ub = Math.max(0, Math.min(1, (x - fb.from) / (fb.to - fb.from)));
  const yNut = fb.y1 + fb.t + 0.004, y = B.bridge.h + (yNut - B.bridge.h) * Math.min(1, u);
  void ub;
  return [x, y, B.strings.bridge.z[k] + (B.strings.nut.z[k] - B.strings.bridge.z[k]) * Math.min(1, Math.max(0, u))];
}
export const PLACE = { at: [0.14, 0.14, 0.44], along: [0.0, 0.97, -0.24], out: [-0.35, 0.2, 0.92] };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
export function placeMatrix() {
  const x = norm(PLACE.along), o = PLACE.out, y = norm(sub(o, x.map((v) => v * dot(o, x)))), z = cross(x, y);
  return [...x, 0, ...y, 0, ...z, 0, ...PLACE.at, 1];
}
// (below this the piano's left hand has it, as src/pianohands.js splits them)
export const LEFT_HAND = 55;
export function bassNote(ev) {
  if (ev.what !== 'piano') return null;
  const low = Math.min(...[].concat(ev.midi));
  return low < LEFT_HAND ? low : null;
}
