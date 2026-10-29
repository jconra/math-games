// THE BARKEEP IN NUMBERS (no three.js: the node tests and the Blender script that makes his clip,
// ~/pw/bandit-math/rigs/clips/build_crowd_clips.py, read these as the game does, src/barkeep.js): who he is, where he
// stands behind the saloon's bar, the glass he polishes and the cloth he polishes it with, and how each sits in a hand.
//
// The glass's own frame: y up its middle from its base, x and z across. HOLD.glass: the left wrist bone's frame
// (Wrist.L: its y from the wrist toward the fingers, z out of the back of the hand) written in the glass's frame, as
// src/fiddleplan.js HOLD does for the fiddle; CLOTH: the cloth in the right wrist bone's own frame (it rides the hand).
//   BARKEEP        who he is (a man: his clip is on the men's skeleton) and his dials
//   GLASS          the glass: a tumbler (a whiskey glass, thick based)
//   HOLD           { glass: { at, fingers, back } }
//   CLOTH          { at, size } in Wrist.R's frame
//   glassHold()    the glass's frame in Wrist.L's own (a 4 x 4, column after column, for three's Matrix4.fromArray)
//   barkeepData()  everything the clip script needs, as plain data
export const BARKEEP = {
  // (a dark brown coat over his white shirt, and a white apron: src/barkeep.js makeApron; a critic: all in white he read
  // as a modern waiter)
  name: 'Gus', look: { outfit: 'suit_m', palette: ['#3a2c22', '#2f2b27', '#2a2420', '#2e2a26'], skin: 3, hair: 1, hat: false },
  back: 0.3,        // m from the bar's back face to where he stands
  turn: 0.9,        // radians at most he turns from facing the bar toward the rider (his body; his head turns the rest)
  near: 4.0,        // m: a rider this near (in the hall, in front of the bar) and he turns to them
  head: 0.75,       // radians at most his head turns further
  ease: 2.2,        // how quickly he turns (1/s)
};
export const GLASS = { r0: 0.03, r1: 0.035, h: 0.1 };
export const HOLD = {
  // the glass in the left hand: standing on his palm and fingers (a critic: fingers curled up its side went through
  // the glass), the fingers out under its foot and a little up past it, the back of the hand down
  glass: { at: [0.0, -0.017, 0.065], fingers: [0, 0.12, -1], back: [0, -1, -0.12] },
};
export const CLOTH = { at: [0.0, 0.085, -0.02], size: [0.095, 0.075, 0.07] };   // (a white rag over his fingers)

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => scale(a, 1 / Math.hypot(...a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function wristFrame(H = HOLD.glass) {
  const y = norm(H.fingers), z = norm(sub(H.back, scale(y, dot(H.back, y)))), x = cross(y, z);
  return { x, y, z, at: H.at.slice() };
}
export function glassHold() {
  const { x, y, z, at } = wristFrame();
  const t = [-dot(x, at), -dot(y, at), -dot(z, at)];
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, t[0], t[1], t[2], 1];
}
export const barkeepData = () => ({ BARKEEP, GLASS, HOLD, CLOTH, wrist: { glass: wristFrame() } });
