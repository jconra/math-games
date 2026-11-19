// FLYING BY HAND, the plain part: how a ship moves, what the keys do, where the station's area ends, what the
// autopilot does, the one setting. No page and no three.js, so node tests it (tests/flying.test.mjs). The view, the
// cameras, the buttons and the mouse are src/flying.js; what the ship bumps into is src/flysolid.js.
//
// THE GAME'S MAKER (2026-11-18): "I'd like the flight controls to be similar to other games that offer flying, with
// maybe a controls option in the settings to invert an axis or something. I like using the mouse to control the nose
// direction of the ship. W and S control forward and reverse. A and D allow strafing. I think we've been using space
// and C for up and down, so we can continue with that (even though I don't love it). Maybe Q and E can roll you. ...
// You press space bar and the ship lifts up, you press w and it goes forward and leaves the hanger. ... When you leave
// the area of the station then it gives you the option to jump." And: "We might need to use an interact key (F) to
// change mouse control to inside the cockpit."
// Told to him and not objected to: the ship steadies itself (let go of the keys and it slows to a stop; it never
// drifts off for ever); bumping the station or the door frame does no damage (it stops or slides along).
//
// NO RULES OF ITS OWN: no fuel, no damage, no timer, no score. Where something had to be decided, the plainest thing:
//   - THE POWER is a switch on the pad. It comes on by itself with the first key that flies, so it is never in the way.
//   - LOW AND SLOW OVER ITS PAD, the ship sets itself down: it turns its nose to the door and settles exactly where it
//     is parked (the cabin, the lift and the crane all know only that one place).
//   - THE AUTOPILOT presses the same controls a pilot would, so what it does is seen to happen, and it can be switched
//     on and off anywhere.
//
// A SHIP is S = makeShip(cfg): where it is (S.p: the point of it that stands on the pad's middle), how it is turned
// (S.q: a quaternion; none: parked, nose out of the bay door), its speed (S.v, the station's frame), its turning
// (S.w, its own frame). Its own frame here: [ahead, up, right]. cfg is the ship's own facts (MINER below): another
// ship is another cfg.
import { OUTSIDE_BOX, DOOR, HANGARS } from '../kit/outside-plan.js';
import { SKIN } from './flysolid.js';

// ── the keys, as he said them (KeyboardEvent.code -> what it does) ──
export const KEYS = {
  KeyW: 'forward', KeyS: 'reverse', KeyA: 'left', KeyD: 'right', Space: 'up', KeyC: 'down', KeyQ: 'rollLeft', KeyE: 'rollRight',
  KeyF: 'mouse', KeyV: 'view', KeyT: 'autopilot', KeyP: 'power', KeyJ: 'jump', KeyR: 'look', KeyH: 'help',
};
export const HELD = ['forward', 'reverse', 'left', 'right', 'up', 'down', 'rollLeft', 'rollRight', 'look'];   // (held down; the rest are one press)

// ── the feel: easy for a child, like other games that have flying ──
export const FEEL = {
  speed: { forward: 40, reverse: 14, side: 12, up: 8 },         // the most, metres a second
  push: { forward: 9, reverse: 7, side: 7, up: 5 },             // picking up speed, m/s each second
  stop: { ahead: 12, side: 9, up: 8 },                          // slowing by itself, keys let go
  turn: 1.1, roll: 1.2, ease: 7,                                // the most it turns and rolls (radians a second); how quickly its turning follows
  mouse: 0.0022,                                                // the mouse held by the game: radians a pixel
  stick: { dead: 0.07, curve: 1.6 },                            // the mouse not held, and the thumb sticks: the still middle, the curve
  nudge: 0.14,                                                  // the most the mouse turns the nose in one frame (radians)
};
// the station's area: this far from the station's own box the jump is offered (and withdrawn again a little nearer)
export const AREA = { out: 120, back: 105 };
// coming home: where the ship comes out of its jump, metres out from its own bay door, a little above its line, nose in
export const ARRIVE = { out: 300, up: 9 };
// low and slow over its pad it sets itself down: within `reach` of the pad's middle, its feet under `low`, moving across the floor slower than
// `slow`; it turns no faster than `turn` and comes down at `down`
export const SETTLE = { reach: 4.5, low: 1.2, slow: 3, level: 0.94, hold: 1.0, turn: 0.9, move: 2.2, down: 0.85 };

// ── THE MINER'S OWN FACTS ──
const box = (a0, a1, r, u1) => { const out = []; for (const u of [0, u1]) for (const s of [-r, r]) for (const a of [a0, a0 / 2, 0, a1 / 2, a1]) out.push([a, u, s]); out.push([a1, u1 / 2, 0], [a0, u1 / 2, 0], [0, 0, 0], [0, u1, 0]); return out; };
export const MINER = {
  id: 'miner', room: 'ship-miner', hangar: HANGARS[0].id,
  pad: [42.3, 0, HANGARS[0].z],      // where it is parked (the station file's places.ships.miner.at; a test holds them together)
  // its hull as points in its own frame [ahead, up, right] (it is 15.5 m long, 6.3 m wide and 5.1 m tall on its legs,
  // its middle 1.2 m ahead of the middle of its length)
  points: box(-9.0, 6.8, 3.3, 5.1),
  // how high the autopilot carries it through the bay (its top then 1.3 m under the door's lintel and 0.7 m under the
  // crane's rail), and over its pad before it comes down (the game's own landing is at 3 m and 2 m: src/crane.js LANDING)
  hover: 2.6, low: 2.0,
  // THE TWO VIEWS, in the ship's own kit frame (x to port, y up from its ground line, z to the nose:
  // ~/pw/space-math/SHIP_miner_arms.md). seat: the pilot's eyes and where they look, wide and on a phone, with the job
  // panel up (it covers the right of a wide screen and the bottom of a phone's) and without; the other seat is the same
  // across the ship. behind: how far back and up the camera follows, and the point of the ship it looks at.
  seat: { eye: [0.5, 3.71, 4.14], look: [0.1, 3.05, 12], lookPanel: [-1.7, 3.0, 12], lookTall: [0.2, 2.6, 12], lookTallPanel: [0.2, -1.6, 12], fov: 62, fovTall: 78 },
  // (ups: under a roof, in its bay, it follows lower: the first of these heights that is clear)
  behind: { back: 27, up: 8.5, ups: [8.5, 5.6, 3.4], look: [0, 3.2, 3], fov: 60, fovTall: 74 },
  // the speed's screen, on the sill in front of the pilot: its middle, its size (m), how far it leans back (radians)
  screen: { at: [0.5, 3.47, 5.36], size: [0.34, 0.15], lean: 0.45 },
};

// ── small sums ──
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const L = len(a); return L > 1e-9 ? mul(a, 1 / L) : [0, 0, 0]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qUnit = (q) => { const L = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / L, q[1] / L, q[2] / L, q[3] / L]; };
// a turn given as a vector (its way: the axis; its length: radians)
const qOf = (v) => { const a = len(v); if (a < 1e-9) return [0, 0, 0, 1]; const s = Math.sin(a / 2) / a; return [v[0] * s, v[1] * s, v[2] * s, Math.cos(a / 2)]; };
const vOf = (q) => { const w = q[3] < 0 ? -1 : 1, s = Math.hypot(q[0], q[1], q[2]); if (s < 1e-9) return [0, 0, 0]; const a = 2 * Math.atan2(s, q[3] * w); return [q[0] * w / s * a, q[1] * w / s * a, q[2] * w / s * a]; };
// a point of the ship's own frame turned into the station's, and back
export const turn = (q, v) => { const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx]; };
export const unturn = (q, v) => turn(qConj(q), v);
// the turn that points the ship's nose along `f` with its top up (level)
export function facing(f) {
  let F = unit(f); if (len(F) < 0.5) F = [1, 0, 0];
  let R = cross(F, [0, 1, 0]); if (len(R) < 1e-4) R = [0, 0, 1]; R = unit(R);
  const U = cross(R, F), m = [F[0], U[0], R[0], F[1], U[1], R[1], F[2], U[2], R[2]], tr = m[0] + m[4] + m[8];
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s, s / 4]; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; q = [s / 4, (m[1] + m[3]) / s, (m[2] + m[6]) / s, (m[7] - m[5]) / s]; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; q = [(m[1] + m[3]) / s, s / 4, (m[5] + m[7]) / s, (m[2] - m[6]) / s]; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; q = [(m[2] + m[6]) / s, (m[5] + m[7]) / s, s / 4, (m[3] - m[1]) / s]; }
  return qUnit(q);
}

// ── the keys held, as the controls ──
// held: a Set (or anything with has) of what is held: 'forward', 'reverse', 'left', 'right', 'up', 'down', 'rollLeft',
// 'rollRight' -> { move: [ahead, up, right], roll } each -1..1 (roll: to the right is +)
export function controlsOf(held) {
  const h = (k) => (held.has(k) ? 1 : 0);
  return { move: [h('forward') - h('reverse'), h('up') - h('down'), h('right') - h('left')], roll: h('rollRight') - h('rollLeft'), turn: [0, 0], nudge: [0, 0] };
}
export const noControls = () => ({ move: [0, 0, 0], roll: 0, turn: [0, 0], nudge: [0, 0] });
// the mouse, held by the game: so many pixels moved -> how far the nose turns [up, right] (radians). Up the screen is
// nose up; with "invert up and down" it is the other way (pull back to climb)
export function mouseTurn(dx, dy, set = {}, k = FEEL.mouse) { return [clamp((set.invertY ? dy : -dy) * k, -FEEL.nudge, FEEL.nudge), clamp(dx * k, -FEEL.nudge, FEEL.nudge)]; }
// the mouse not held, or a thumb stick: how far it is from its middle (x to the right, y down the screen, each -1..1)
// -> how hard the nose turns [up, right], each -1..1
export function stickTurn(x, y, set = {}) {
  const f = (v) => { const a = Math.abs(v); return a <= FEEL.stick.dead ? 0 : Math.sign(v) * Math.pow(Math.min(1, (a - FEEL.stick.dead) / (1 - FEEL.stick.dead)), FEEL.stick.curve); };
  return [f(set.invertY ? y : -y), f(x)];
}

// ── the one setting, kept with the crew member (save.js keeps any field): crew.flying = { invertY } ──
export const flyingOf = (crew) => ({ invertY: !!(crew && crew.flying && typeof crew.flying === 'object' && crew.flying.invertY) });
export function setFlying(crew, patch) { if (!crew) return flyingOf(null); crew.flying = { ...flyingOf(crew), invertY: !!patch.invertY }; return crew.flying; }

// ── the station's area ──
export function boxDist(p, B = OUTSIDE_BOX) { return Math.hypot(Math.max(B.min[0] - p[0], 0, p[0] - B.max[0]), Math.max(B.min[1] - p[1], 0, p[1] - B.max[1]), Math.max(B.min[2] - p[2], 0, p[2] - B.max[2])); }
// is the jump offered? (was: whether it was offered a moment ago: once out, it stays offered until the ship is well back in)
export const clearOf = (p, was = false) => boxDist(p) > (was ? AREA.back : AREA.out);
// where a ship comes out of its jump home: out from its own bay door, nose toward it
export function arrival(cfg = MINER) { return { p: [DOOR.face + ARRIVE.out, cfg.hover + ARRIVE.up, cfg.pad[2]], q: facing([-1, 0, 0]) }; }
// in its bay, or any of it still in the doorway (its tail is 9 m behind its middle; higher than this it would not fit under the lintel)
const inBay = (p, cfg) => p[0] < DOOR.face + 11 && p[0] > cfg.pad[0] - 22 && Math.abs(p[2] - cfg.pad[2]) < DOOR.w / 2 + 1 && p[1] > cfg.pad[1] - 1 && p[1] < cfg.pad[1] + 3.6;

// ── A SHIP ──
export function makeShip(cfg = MINER) {
  return { cfg, p: [...cfg.pad], q: [0, 0, 0, 1], v: [0, 0, 0], w: [0, 0, 0], power: false, landed: true, settle: null, engine: 0, acc: [0, 0, 0], spin: 0, bump: 0, t: 0 };
}
export const speedOf = (S) => len(S.v);
// "24 m/s": the speed as the cockpit's screen shows it (a plain number)
export const speedWords = (S) => `${Math.round(speedOf(S))} m/s`;
export function place(S, p, q = [0, 0, 0, 1]) { S.p = [...p]; S.q = [...q]; S.v = [0, 0, 0]; S.w = [0, 0, 0]; S.landed = false; S.settle = null; S.power = true; return S; }
export function park(S) { S.p = [...S.cfg.pad]; S.q = [0, 0, 0, 1]; S.v = [0, 0, 0]; S.w = [0, 0, 0]; S.landed = true; S.settle = null; S.acc = [0, 0, 0]; S.spin = 0; return S; }
// the power's switch: on the pad only (in flight it stays on: a ship never drifts off dead)
export function setPower(S, on) { if (S.landed) S.power = !!on; return S.power; }
// the ship's own points, in the station's frame
export const pointsOf = (S) => S.cfg.points.map((pt) => add(S.p, turn(S.q, pt)));

// one step of `dt` seconds with these controls; solid: what it bumps into (src/flysolid.js), or none
export function stepShip(S, input, dt, solid = null) {
  S.t += dt; S.bump = 0;
  const C0 = input || noControls(), C = { ...C0, move: C0.move.map((v) => clamp(v, -1, 1)) };
  if (S.landed) {
    S.v = [0, 0, 0]; S.w = [0, 0, 0]; S.acc = [0, 0, 0]; S.spin = 0;
    const flies = C.move[1] > 0.1;
    // (the first key that flies switches the power on by itself; it lifts once the power is up)
    if (flies && !S.power) S.power = true;
    S.engine += ((S.power ? 0.15 : 0) - S.engine) * Math.min(1, dt * 3);
    if (!(flies && S.power && S.engine > 0.1)) return S;
    S.landed = false;
  }
  if (S.settle) { settle(S, dt, solid); return S; }
  const vb0 = unturn(S.q, S.v), wy0 = S.w[1];
  // (the mouse held by the game turns the nose outright)
  if (C.nudge[0] || C.nudge[1]) S.q = qUnit(qMul(S.q, qMul(qOf([0, 0, clamp(C.nudge[0], -FEEL.nudge, FEEL.nudge)]), qOf([0, -clamp(C.nudge[1], -FEEL.nudge, FEEL.nudge), 0]))));
  const n = Math.max(1, Math.ceil(dt / 0.02), Math.ceil(len(S.v) * dt / 0.4)), h = dt / n;
  const F = FEEL, want = [C.move[0] * (C.move[0] >= 0 ? F.speed.forward : F.speed.reverse), C.move[1] * F.speed.up, C.move[2] * F.speed.side];
  const push = [C.move[0] >= 0 ? F.push.forward : F.push.reverse, F.push.up, F.push.side], stop = [F.stop.ahead, F.stop.up, F.stop.side];
  const wWant = [clamp(C.roll, -1, 1) * F.roll, -clamp(C.turn[1], -1, 1) * F.turn, clamp(C.turn[0], -1, 1) * F.turn];
  for (let s = 0; s < n; s++) {
    // its speed, in its own frame: toward what the keys ask, or toward none
    const vb = unturn(S.q, S.v);
    for (let i = 0; i < 3; i++) { const faster = want[i] !== 0 && Math.sign(want[i]) === Math.sign(vb[i] || want[i]) && Math.abs(want[i]) > Math.abs(vb[i]), a = (faster ? push[i] : stop[i]) * h; vb[i] += clamp(want[i] - vb[i], -a, a); }
    // its turning
    const k = Math.min(1, F.ease * h); for (let i = 0; i < 3; i++) S.w[i] += (wWant[i] - S.w[i]) * k;
    S.q = qUnit(qMul(S.q, qOf(mul(S.w, h))));
    S.v = turn(S.q, vb);
    S.p = add(S.p, mul(S.v, h));
    if (solid) bump(S, solid);
  }
  const vb1 = unturn(S.q, S.v);
  S.acc = mul(sub(vb1, vb0), 1 / dt); S.spin = (S.w[1] - wy0) / dt;
  S.engine += ((0.15 + 0.85 * Math.max(0, C.move[0])) - S.engine) * Math.min(1, dt * 2.5);
  // low and slow over its own pad: it sets itself down
  const P = S.cfg.pad, up = turn(S.q, [0, 1, 0])[1];
  if (C.move[1] <= 0 && Math.hypot(S.p[0] - P[0], S.p[2] - P[2]) < SETTLE.reach && S.p[1] - P[1] < SETTLE.low && Math.hypot(S.v[0], S.v[2]) < SETTLE.slow && up > SETTLE.level) S.settle = { t: 0 };
  return S;
}
// eased back out of whatever it has come too near, keeping the speed that runs along it
const _n = [0, 0, 0];
function bump(S, solid) {
  for (let it = 0; it < 3; it++) {
    let worst = 0, at = null;
    for (const pt of S.cfg.points) { const w = add(S.p, turn(S.q, pt)), d = solid.dist(w[0], w[1], w[2]); if (SKIN - d > worst) { worst = SKIN - d; at = w; } }
    if (!at || worst < 0.02) return;      // (the distances are kept to about a centimetre: resting on the floor is not a bump)
    solid.away(at[0], at[1], at[2], _n);
    if (!_n[0] && !_n[1] && !_n[2]) return;
    S.p = add(S.p, mul(_n, worst)); S.bump = Math.max(S.bump, worst);
    const into = dot(S.v, _n); if (into < 0) S.v = sub(S.v, mul(_n, into));
  }
}
// setting itself down: level and nose out over the pad's middle, then down onto it
function settle(S, dt, solid) {
  const T = S.settle, P = S.cfg.pad, G = SETTLE; T.t += dt;
  const e = vOf(S.q), ang = len(e), off = Math.hypot(S.p[0] - P[0], S.p[2] - P[2]);
  // (turning, it keeps its feet clear of the floor)
  // (S.padBusy: someone is standing on the pad (the view says so): it waits over it until they have gone)
  const lined = ang < 0.012 && off < 0.05 && !S.padBusy, wantY = lined ? P[1] : Math.max(P[1] + G.hold, Math.min(S.p[1], P[1] + G.low));
  const stepA = Math.min(ang, Math.max(0.05, Math.min(G.turn, ang * 3.5)) * dt);
  S.q = ang < 1e-6 ? [0, 0, 0, 1] : qUnit(qMul(qOf(mul(e, -stepA / ang)), S.q));
  const to = [P[0] - S.p[0], 0, P[2] - S.p[2]], stepM = Math.min(off, Math.max(0.05, Math.min(G.move, off * 2.2)) * dt);
  const was = [...S.p];
  if (off > 1e-6) { S.p[0] += to[0] / off * stepM; S.p[2] += to[2] / off * stepM; }
  const dy = wantY - S.p[1]; S.p[1] += clamp(dy, -G.down * dt, G.down * dt);
  if (solid && !lined) bump(S, solid);
  S.v = mul(sub(S.p, was), 1 / Math.max(dt, 1e-6)); S.w = [0, 0, 0]; S.acc = [0, 0, 0]; S.spin = 0;
  S.engine += (0.15 - S.engine) * Math.min(1, dt * 2.5);
  if (lined && S.p[1] - P[1] < 0.003) { park(S); S.settle = null; S.justLanded = true; }
}

// ── THE AUTOPILOT: a plan is a list of legs; fly(S, plan, dt) gives the controls it holds now ──
// a leg: { to: [x, y, z], face: [x, y, z] the way the nose points (none: along the way), speed, near, stop (it ends
// stopped) or then (it ends no faster than this) }
// the last leg of a landing is { down: true }: down onto the pad (the ship sets itself down there)
const KEEP = 30, BRAKE = 5;
const grown = (k = KEEP) => ({ min: OUTSIDE_BOX.min.map((v) => v - k), max: OUTSIDE_BOX.max.map((v) => v + k) });
// does the straight line a -> b pass through the box?
export function crosses(a, b, B) {
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-9) { if (a[i] <= B.min[i] || a[i] >= B.max[i]) return false; continue; }
    let u = (B.min[i] - a[i]) / d, v = (B.max[i] - a[i]) / d; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 >= t1) return false;
  }
  return true;
}
// a way from a to b that keeps out of the station's box grown by KEEP: straight if that is clear, else out to one of
// the box's six sides, along it, and in again (the shortest such way)
export function wayRound(a, b, B = grown()) {
  const inside = (p) => p.every((v, i) => v > B.min[i] && v < B.max[i]);
  const pts = [];
  let from = [...a];
  if (inside(from)) {      // (too near the station: out by the nearest side first)
    let best = null;
    for (let i = 0; i < 3; i++) for (const side of ['min', 'max']) { const d = Math.abs(B[side][i] - from[i]); if (!best || d < best.d) best = { d, i, side }; }
    from = [...from]; from[best.i] = B[best.side][best.i] + (best.side === 'max' ? 1 : -1); pts.push(from);
  }
  if (!crosses(from, b, B)) return [...pts, b];
  let best = null;
  for (let i = 0; i < 3; i++) for (const side of ['min', 'max']) {
    const lvl = B[side][i] + (side === 'max' ? 1 : -1), p1 = [...from], p2 = [...b]; p1[i] = lvl; p2[i] = lvl;
    if (crosses(from, p1, B) || crosses(p2, b, B)) continue;
    const L = len(sub(p1, from)) + len(sub(p2, p1)) + len(sub(b, p2));
    if (!best || L < best.L) best = { L, way: [p1, p2, b] };
  }
  return [...pts, ...(best ? best.way : [b])];
}
// started close against something (taken over beside a wall): first straight away from it, without turning, so the
// ship's ends do not swing into it
function backOff(S, solid) {
  if (!solid || S.landed || inBay(S.p, S.cfg)) return [];
  let least = 99, at = null;
  for (const pt of pointsOf(S)) { const d = solid.dist(pt[0], pt[1], pt[2]); if (d < least) { least = d; at = pt; } }
  if (least > Math.min(SKIN + 4, (solid.reach || 3) - 0.05)) return [];      // (nothing within the distances the solid keeps)
  const n = solid.away(at[0], at[1], at[2], [0, 0, 0]);
  return n[0] || n[1] || n[2] ? [{ to: add(S.p, mul(n, 14)), face: turn(S.q, [1, 0, 0]), speed: 5, near: 1.5, stop: true }] : [];
}
// out of the hangar and clear of the station (solid: what it bumps into, if a start beside a wall is to be looked after)
export function planLeave(S, solid = null) {
  const c = S.cfg, P = c.pad, clear = OUTSIDE_BOX.max[0] + AREA.out + 30;
  if (S.landed || inBay(S.p, c)) return [
    { to: [Math.max(S.p[0], P[0]), P[1] + c.hover, P[2]], face: [1, 0, 0], speed: 2.5, near: 0.25, stop: true },
    { to: [DOOR.face + 16, P[1] + c.hover, P[2]], face: [1, 0, 0], speed: 9, near: 3 },
    { to: [clear, P[1] + c.hover + 12, P[2]], speed: FEEL.speed.forward, near: 4, stop: true },
  ];
  // (already outside: straight away from the station's middle, as far as its area's edge and a little more)
  const mid = [(OUTSIDE_BOX.min[0] + OUTSIDE_BOX.max[0]) / 2, (OUTSIDE_BOX.min[1] + OUTSIDE_BOX.max[1]) / 2, (OUTSIDE_BOX.min[2] + OUTSIDE_BOX.max[2]) / 2];
  const off = backOff(S, solid), from = off.length ? off[0].to : S.p;
  const dir = unit(sub(from, mid)), need = Math.max(0, AREA.out + 30 - boxDist(from));
  return need > 0 ? [...off, { to: add(from, mul(dir, need + 20)), speed: FEEL.speed.forward, near: 4, stop: true }] : off;
}
// in through the bay door and down on the pad
export function planLand(S, solid = null) {
  const c = S.cfg, P = c.pad, y = P[1] + c.hover;
  const over = { to: [P[0], P[1] + c.low, P[2]], face: [1, 0, 0], speed: 3, near: 0.3, stop: true }, down = { down: true };
  if (S.landed) return [];
  if (inBay(S.p, c)) return [{ to: [S.p[0], Math.min(Math.max(S.p[1], P[1] + c.low), y), P[2]], face: unit([turn(S.q, [1, 0, 0])[0] || 1, 0, 0]), speed: 3, near: 0.4, stop: true }, over, down];
  const gate = [DOOR.face + 90, y, P[2]], legs = backOff(S, solid), from = legs.length ? legs[0].to : S.p;
  // (already on the door's own line, between the gate and the door: straight on in)
  const lined = !legs.length && S.p[0] > DOOR.face + 12 && S.p[0] < gate[0] + 5 && Math.abs(S.p[2] - P[2]) < 7 && Math.abs(S.p[1] - y) < 5;
  if (!lined) { for (const w of wayRound(from, gate)) legs.push({ to: w, speed: FEEL.speed.forward, near: 6, stop: true }); const last = legs[legs.length - 1]; last.stop = false; last.then = 14; }
  // (up to the door on its middle line, nose in; slow by then, not stopped)
  legs.push({ to: [DOOR.face + 18, y, P[2]], face: [-1, 0, 0], speed: 14, near: 2, then: 6 });
  legs.push({ to: [P[0], y, P[2]], face: [-1, 0, 0], speed: 6, near: 0.6, stop: true });
  legs.push(over, down);
  return legs;
}
// the controls the autopilot holds now, flying `plan` (its legs are taken off the front as each is done); null: done
export function fly(S, plan, dt = 1 / 60) {
  while (plan.length) {
    const L = plan[0];
    // (on its pad: a landing is done; a leaving starts by lifting off, as Space does)
    if (S.landed) { if (L.down || plan.every((l) => l.down)) { plan.length = 0; break; } const C = noControls(); C.move[1] = 0.3; return C; }
    if (L.down) {
      if (S.settle) return noControls();
      const C = noControls(), P = S.cfg.pad;
      // (over the pad and level: down; the ship sets itself down from there)
      const off = [P[0] - S.p[0], 0, P[2] - S.p[2]], b = unturn(S.q, mul(off, 1.2));
      C.move = [clamp(b[0] / 3, -1, 1), S.p[1] - P[1] > SETTLE.low - 0.25 ? -0.25 : 0, clamp(b[2] / 3, -1, 1)];
      level(S, C, turn(S.q, [1, 0, 0]));
      return C;
    }
    const err = sub(L.to, S.p), d = len(err), dir = unit(err), near = L.near ?? 1;
    const f = L.face || (d > 8 ? dir : turn(S.q, [1, 0, 0])), aErr = level(S, null, f);
    // (a leg ends stopped (stop), or no faster than the next one wants (then), or just flown through)
    const then = L.stop ? 0 : L.then ?? null;
    if (d < near && (then == null || len(S.v) < then + 1.2) && (!L.face || aErr < 0.06)) { plan.shift(); continue; }
    const C = noControls(); level(S, C, f);
    // (along the way: only as fast as it can still stop; turning to face a long way first, it crawls)
    const ahead = turn(S.q, [1, 0, 0]), aligned = L.face ? 1 : clamp((dot(ahead, dir) - 0.5) / 0.45, 0, 1);
    const top = (L.speed || 10) * (L.face ? 1 : 0.12 + 0.88 * aligned), slow = then == null && plan.length === 1 ? 0 : then, sp = slow == null ? top : Math.min(top, Math.sqrt(2 * BRAKE * Math.max(0, d - near * 0.3) + slow * slow) + 0.4);
    const vb = unturn(S.q, mul(dir, d < near ? 0 : sp)), F = FEEL.speed;
    C.move = [clamp(vb[0] / (vb[0] >= 0 ? F.forward : F.reverse), -1, 1), clamp(vb[1] / F.up, -1, 1), clamp(vb[2] / F.side, -1, 1)];
    return C;
  }
  return null;
}
// the controls that bring the nose round to `f`, the ship level; -> how far off it is (radians). C none: only the sum
function level(S, C, f) {
  const e = vOf(qMul(qConj(S.q), facing(f))), K = 2.4;
  if (C) { C.roll = clamp(e[0] * K / FEEL.roll, -1, 1); C.turn = [clamp(e[2] * K / FEEL.turn, -1, 1), clamp(-e[1] * K / FEEL.turn, -1, 1)]; }
  return len(e);
}

// ── the help corner: what the keys do, by mode ──
// mode: 'seat' (on the pad), 'fly' (the mouse flies), 'pointer' (the mouse is a pointer), 'watch' (the autopilot has
// it, or a crew member who is not the pilot). -> [[key, words], ...]
// touch: a phone has no keys: each line names the button or the stick on the screen instead
export function helpFor(mode, { pilot = true, auto = false, behind = false, canJump = false, touch = false } = {}) {
  const view = [touch ? 'View' : 'V', behind ? 'See from the cockpit' : 'See from behind'], look = behind && !touch ? [['R', 'Hold: look round the ship']] : [];
  if (!pilot) return [['', 'The crew\'s pilot is flying'], view, ...look];
  const autoLine = [touch ? 'Autopilot' : 'T', auto ? 'Autopilot off: fly it yourself' : 'Autopilot: it flies for you'], jump = canJump ? [[touch ? 'Jump' : 'J', 'Jump']] : [];
  if (auto) return [['', 'The autopilot is flying'], autoLine, view, ...look, ...jump];
  if (mode === 'seat') return touch ? [['Power', 'Switch the ship on or off'], ['Lift off', 'Hold it: up off the pad'], autoLine, view] : [['P', 'Power'], ['Space', 'Lift off'], autoLine, view];
  if (touch) return [['Fly', 'Left stick: forward, back, left, right'], ['Nose', 'Right stick: point the nose'], ['Up Down', 'Hold: up, down'], ['Roll', 'Hold: roll'], autoLine, view, ...jump];
  const keys = [['W S', 'Forward, back'], ['A D', 'Left, right'], ['Space C', 'Up, down'], ['Q E', 'Roll']];
  const mouse = mode === 'pointer' ? [['F', 'Fly with the mouse']] : [['Mouse', 'Point the nose'], ['F', 'Free the mouse for the buttons']];
  return [...mouse, ...keys, autoLine, view, ...look, ...jump];
}
