// THE FIDDLE AND ITS BOW IN NUMBERS: their sizes, where the strings run, and how each sits in the fiddler's hand. No
// three.js here, so the node tests and the Blender script that makes the fiddler's clips
// (~/pw/bandit-math/rigs/clips/build_stage_clips.py, through rigs/fiddler/dump_fiddle.cjs) read the same numbers as the
// game's shapes (src/fiddle.js).
//
// A full-size fiddle of the 1880s: the body 35.5 cm long (the lower bout 20.6 cm across, the upper 16.8, the waist
// 11), 59 cm overall; the strings 32.5 cm from the nut to the bridge. The bow 75 cm.
//
// The fiddle's own frame (metres): x along it from the end of the body (the end button) toward the scroll, y out of the
// top (the strings' side), z across toward the E string's side (the highest string; the G is at -z). The top's edge is
// at y = 0, the back's at y = -FIDDLE.ribs.
// The bow's own frame: x along the stick from its end (the screw's button) toward the tip, y from the hair up to the
// stick, z across (x cross y).
//
//   FIDDLE, BOW          the sizes
//   halfWidth(x)         the body's half width at x (0 off the body)
//   topY(x, u), backY(x, u)   the top's and the back's height at x, u across (-1 at the G side's edge .. 1 the E side's)
//   stringAt(k, x)       string k (0 G, 1 D, 2 A, 3 E) at x along the fiddle: [x, y (its top), z]
//   CONTACT              x where the bow crosses the strings (between the bridge and the fingerboard's end)
//   BOW_TILT             the bow's tilt about the fiddle's length to play each string alone (radians; + dips its tip
//                        toward the G side)
//   HOLD                 how each sits in the hand: the wrist bone's frame in the prop's own (at, fingers, back)
//   holdMatrix(which)    'fiddle' | 'bow': the prop's frame in its wrist bone's own (a 4 x 4 matrix, column after
//                        column, as three's Matrix4.fromArray takes it): the prop rides the bone with it
export const FIDDLE = {
  length: 0.59, body: 0.355, ribs: 0.031, arch: 0.0155, backArch: 0.013,
  // the outline: [x, half width] from the end button's edge to the neck's root (the lower bout, its corner, the waist
  // (the C bouts, where the bow crosses), the upper corner and bout)
  outline: [[0, 0.006], [0.005, 0.04], [0.016, 0.066], [0.038, 0.088], [0.07, 0.101], [0.105, 0.102], [0.13, 0.097], [0.147, 0.093],
    [0.153, 0.088], [0.157, 0.073], [0.175, 0.059], [0.196, 0.055], [0.215, 0.059], [0.231, 0.07], [0.236, 0.079], [0.243, 0.083],
    [0.275, 0.083], [0.312, 0.077], [0.336, 0.062], [0.35, 0.036], [0.355, 0.01]],
  bridge: { x: 0.16, w: 0.041, t: 0.0042 },                 // its middle along the body (between the f-holes' notches)
  nut: 0.485,                                                // the strings' far end (the fingerboard's top end)
  fingerboard: { from: 0.213, to: 0.487, w0: 0.042, w1: 0.024, t: 0.006 },   // its end over the body .. the nut; widths there
  // the strings' tops (y) and places (z): at the bridge, at the nut, at the tailpiece's end (G, D, A, E)
  strings: {
    bridge: { y: [0.0445, 0.0465, 0.0466, 0.044], z: [-0.017, -0.0057, 0.0057, 0.017] },
    nut: { y: [0.0262, 0.0266, 0.0266, 0.0262], z: [-0.0082, -0.0027, 0.0027, 0.0082] },
    tail: { x: 0.118, y: [0.0272, 0.0274, 0.0274, 0.0272], z: [-0.013, -0.0044, 0.0044, 0.013] },
  },
  tailpiece: { from: 0.01, to: 0.122, w0: 0.022, w1: 0.04, y0: 0.012, y1: 0.0255, t: 0.007 },
  pegbox: { from: 0.487, to: 0.543, w: 0.023, h: 0.024 },
  scroll: { x: 0.564, r: 0.0185, w: 0.022 },
  pegs: [0.496, 0.508, 0.52, 0.532],
};
export const BOW = {
  length: 0.75, camber: 0.0065,                    // the stick bends toward the hair this much in its middle
  r0: 0.0043, r1: 0.0028,                          // the stick's thickness (radius) at the frog and at the tip
  frog: { from: 0.022, to: 0.068, low: -0.0205 },  // the frog under the stick (its foot just below the hair)
  hair: { from: 0.068, to: 0.728, y: -0.0165, w: 0.0105, t: 0.002 },   // the ribbon's top (y), width and thickness
  head: { from: 0.722, to: 0.75 },
};
export const HAIR_LOW = BOW.hair.y - BOW.hair.t;   // the hair's face that lies on the strings (bow y)
export const CONTACT = 0.183;                      // 2.3 cm from the bridge toward the fingerboard
export const BOW_TILT = [0.38, 0.1, -0.1, -0.42];  // G, D, A, E (about 22, 6, -6, -24 degrees)

const clamp01 = (u) => Math.max(0, Math.min(1, u));
export function halfWidth(x) {
  const O = FIDDLE.outline;
  if (x < O[0][0] || x > O[O.length - 1][0]) return 0;
  for (let i = 1; i < O.length; i++) if (x <= O[i][0]) { const [x0, w0] = O[i - 1], [x1, w1] = O[i]; return w0 + (w1 - w0) * (x - x0) / (x1 - x0); }
  return 0;
}
// the arching: highest down the middle and along the body's middle, falling to the edges
const along = (x) => Math.pow(Math.sin(Math.PI * clamp01(x / FIDDLE.body)), 0.55);
const across = (u) => Math.pow(Math.max(0, 1 - u * u), 0.8);
export const topY = (x, u) => FIDDLE.arch * along(x) * across(u);
export const backY = (x, u) => -FIDDLE.ribs - FIDDLE.backArch * along(x) * across(u);

export function stringAt(k, x) {
  const S = FIDDLE.strings, b = FIDDLE.bridge.x, n = FIDDLE.nut;
  if (x >= b) { const u = (x - b) / (n - b); return [x, S.bridge.y[k] + (S.nut.y[k] - S.bridge.y[k]) * u, S.bridge.z[k] + (S.nut.z[k] - S.bridge.z[k]) * u]; }
  const u = (x - S.tail.x) / (b - S.tail.x);
  return [x, S.tail.y[k] + (S.bridge.y[k] - S.tail.y[k]) * u, S.tail.z[k] + (S.bridge.z[k] - S.tail.z[k]) * u];
}

// HOW THEY SIT IN THE HANDS: the wrist bone's frame (the skeleton's Wrist.L / Wrist.R: its y runs from the wrist toward
// the fingers, its z out of the back of the hand; on the left hand its x is the thumb's side) written in the prop's own
// frame: where the wrist is (at), the way its fingers point (fingers) and the way the back of the hand faces (back).
// - the fiddle in the left hand: the neck lies in the palm's crook 6 cm up from its heel, where it meets the body (a
//   fiddler's hand in a high position: these people's arms are short), the hand under the neck on the E
//   string's side with its back turned out that way, the fingers reaching up past the fingerboard to curl over the
//   strings, the thumb's side toward the scroll.
// - the bow in the right hand: held at the frog, the hand over the stick, its back up and toward the player, the
//   fingers draped over the stick's far side, the first finger's side toward the tip.
export const HOLD = {
  fiddle: { at: [0.41, -0.05, 0.048], fingers: [0.18, 1, -0.32], back: [0, 0.2, 1] },
  bow: { at: [0.012, 0.062, -0.066], fingers: [0.42, -0.5, 0.76], back: [-0.15, 0.85, -0.5] },
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a) => scale(a, 1 / Math.hypot(...a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// the wrist's frame in the prop's: its axes (x, y, z: y the fingers' way, z the back's, made square to it) and place
export function wristFrame(which) {
  const H = HOLD[which], y = norm(H.fingers), z = norm(sub(H.back, scale(y, dot(H.back, y)))), x = cross(y, z);
  return { x, y, z, at: H.at.slice() };
}
export function holdMatrix(which) {
  const { x, y, z, at } = wristFrame(which);
  // the inverse of [x y z | at]: its rows are the axes, and the place taken back through them
  const t = [-dot(x, at), -dot(y, at), -dot(z, at)];
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, t[0], t[1], t[2], 1];
}
// everything the clip script needs, as plain data
export function fiddleData() {
  return { FIDDLE, BOW, HAIR_LOW, CONTACT, BOW_TILT, HOLD, wrist: { fiddle: wristFrame('fiddle'), bow: wristFrame('bow') },
    contact: [0, 1, 2, 3].map((k) => stringAt(k, CONTACT)) };
}
