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
// AND OF LANDING (2026-11-18, later, when asked whether the ship should turn itself round as it sets down): "I don't wan
// the ship taking over. That will annoy me. ... There should be some kind of guidance that appears on the hanger floor
// or just in midair that should request you to find the correct heading and shows you how far forward/back/left/right
// you are from being centered. ... it could be a small model and a hologram as the goal in the same space, so you try
// to make both of them match. That could also help for being centered when coming in the hanger. Anyway, if the pilot
// sets down and is still crooked then I would hope the crane can just compensate for it. ... Even if they just come
// straight in and land it nose-in, that should be okay (as long as the ship is not upside down). ... If they do have
// the ship rolled over to much for a landing (like upside down) then it shouldn't allow them out of the seat until they
// have corrected it. One thing that could be helpful is to show the keys that would correct the ship to a preferred
// landing position. There could be a qweasad grid in the corner and arrows for the mouse that could light up keys to
// orient the ship correctly. The could glow brightly when a lot of input is needed and dim once they are close."
//
// AND OF THE OTHER TWO HANGARS (2026-11-18, later still; asked "Should the Miner be able to fly in through the other two
// hangar doors?" he chose "Let it fly in and look round (the ships parked in there would need to be things it bumps
// into)"): "Lol, I'm sure kids will try to do this and it will make them laugh, so why not. I think it would be good if
// people can go in and then you would hear an alarm and red lights started spinning around in the hanger and people
// started running around and it started saying "Safety Violation" over and over in your cockpit. It would even be
// appropriate for the other ship to get moved around if they rammed it. But it would be reset the next time they
// entered into the other hanger. No need for damage or anything like that. By the way, since I am thinking about
// sounds, we should get sounds for the ships too. Like a welcome message from the ship to the pilot when it gets turned
// on (a robotic "Welcome aboard pilot, Systems Ready") and a "Warning, pull up" message, and a "Reactor imbalance" voice
// for when you need to do the engineering questions. It would also be cool if the different ships had different sound
// clips."
// SO (OTHERS, visiting, pushOthers, stepOther, voiceStep below; the alarm itself is src/visit.js):
//   - THE OTHER TWO BAYS are open to the ship as its own is, by hand. THE AUTOPILOT never plans a way into them, and
//     switched on in one it first goes straight out through that hangar's own door.
//   - THE SHIP PARKED IN EACH is something it bumps into, and a bump shoves it: it slides across the floor and turns,
//     slows by itself and stops; its hangar's walls and its door's shield keep it in. It waits for nobody: whoever it
//     comes over on that floor is pushed out of its way (pushedTo; see stepOther). Nothing tips, nothing breaks.
//   - IN ANOTHER SHIP'S HANGAR (visiting: any of the ship past that door's line) the alarm is on, and off the moment
//     all of it is out again. It can rest on that floor but is never down there: its legs take only its own hangar's
//     floor, so the seat never lets the pilot out there.
//   - THE SHIP'S OWN VOICE: "Welcome aboard, pilot. Systems ready." once each time someone sits down and its power comes
//     on (not at every lift-off); "Safety violation." again and again, with a short gap, while it is in another hangar.
//
// NO RULES OF ITS OWN: no fuel, no damage, no timer, no score. Where something had to be decided, the plainest thing:
//   - THE POWER is a switch on the pad. It comes on by itself with the first key that flies, so it is never in the way.
//   - NOTHING SETS THE SHIP DOWN FOR A PILOT FLYING BY HAND. Brought down onto its own hangar's floor, wherever and
//     whichever way round, it stands there on its legs (LAND): its legs take the floor, so it stops sliding and whatever
//     lean is left goes as its weight comes onto them; leaning further than LAND.tilt ("like upside down") its legs do
//     not take the floor and it is not down. Where it stands is where it stays: the cabin, the lift and the crane are
//     told (standOf), and the next lift-off is from there.
//   - THE AUTOPILOT presses the same controls a pilot would, so what it does is seen to happen, and it can be switched
//     on and off anywhere. It alone asks the ship to set itself down (SETTLE: over its own pad the ship turns its nose
//     to the door and settles exactly where it is parked); switched off, that stops at once.
//   - THE GUIDE (guideOf) only asks: the goal is the ship in its proper parking place, nose out; how far the ship is
//     from it, and which keys would bring it there, brightly when a lot is needed and dimly when it is close. Nothing
//     is scored and nothing is required but the hangar's floor and its legs under it.
//
// A SHIP is S = makeShip(cfg): where it is (S.p: the point of it that stands on the pad's middle), how it is turned
// (S.q: a quaternion; none: parked, nose out of the bay door), its speed (S.v, the station's frame), its turning
// (S.w, its own frame). Its own frame here: [ahead, up, right]. cfg is the ship's own facts (MINER below): another
// ship is another cfg. makeShip(cfg, at): standing where it was last set down ({ p, q }: standOf), not on its pad.
import { OUTSIDE_BOX, DOOR, HANGARS } from '../kit/outside-plan.js';
import { SKIN } from './flysolid.js';
import { flightOf } from './fleet.js';
import { standElements, frameOf, outOf, yawOf } from './standing.js';

// ── the keys, as he said them (KeyboardEvent.code -> what it does) ──
export const KEYS = {
  KeyW: 'forward', KeyS: 'reverse', KeyA: 'left', KeyD: 'right', Space: 'up', KeyC: 'down', KeyQ: 'rollLeft', KeyE: 'rollRight',
  KeyF: 'mouse', KeyV: 'view', KeyT: 'autopilot', KeyP: 'power', KeyJ: 'jump', KeyR: 'look', KeyH: 'help', KeyM: 'task',
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
// THE AUTOPILOT'S OWN WAY DOWN (never a hand pilot's): low and slow over its pad the ship sets itself down while the
// autopilot asks it to: within `reach` of the pad's middle, its feet under `low`, moving across the floor slower than
// `slow`; it turns no faster than `turn` and comes down at `down`
export const SETTLE = { reach: 4.5, low: 1.2, slow: 3, level: 0.94, hold: 1.0, turn: 0.9, move: 2.2, down: 0.85 };
// SET DOWN BY HAND, on its own hangar's floor:
//   tilt    degrees. Leaning further than this (rolled, or its nose up or down) is "rolled over too much for a landing":
//           its legs do not take the floor, and the seat does not let the pilot out until it is corrected
//   touch   its lowest point this near the floor is on it (m)
//   grip    on its legs it stops sliding, at this many m/s each second
//   level   ... and its legs bring it level, at up to this many radians a second (a lean of 30 degrees in a third of a second)
//   still   slower than this (m/s), and level: it is down
export const LAND = { tilt: 30, touch: 0.08, grip: 9, level: 1.6, still: 0.05 };
// THE LANDING GEAR (the game's maker, 2026-11-26, watching the trailer's Miner fly out: "it would be terrific if it's
// landing gear could be raising up ... I'd just build it so that it is automatically lowered when you go in the hanger
// or near the surface of a planet, and up otherwise"). Nothing is asked of the pilot; the legs fold and come down with
// their own move (src/shiphull.js gear). gearWanted(S): true while they should be up. Down:
//   - on a floor, and in a hangar's bay, its own or another's: inside the door's line, within `side` of the bay's middle
//     across it and lower than the door's top and `over` more;
//   - coming in: outside a bay door, lined up with it, within `lead` metres of it and closing on it faster than
//     `toward` m/s (so most of the way down before it is in: the legs take about 4.4 s to come down);
//   - over a planet, near its ground (src/rescue.js: gearOverGround, how high its feet are): down under `near` metres,
//     up again only over `clear` (so it never flutters at one height). The autopilot carries the Medic 26 m over the
//     landing place before it comes down (src/rescue.js SITE.over): there its legs are up, and they come down as it
//     sets down.
// AND IT NEVER STANDS ON A FLOOR WITHOUT THEM: however fast it comes in, it is not down (S.landed) until every leg is
// fully down (S.gearDown, told by whoever moves the legs). Until then it rests on its feet's line over the floor, as
// it always has (what it bumps by is the same with its legs up or down), while they come down under it.
export const GEAR = { side: 13.8, over: 3, lead: 30, toward: 0.5, near: 25, clear: 30 };
export function gearWanted(S) {
  if (S.landed) return false;
  for (const H of HANGARS) {
    if (Math.abs(S.p[2] - H.z) > GEAR.side || S.p[1] > DOOR.h + GEAR.over) continue;
    const out = S.p[0] - DOOR.face;
    if (out <= 0) return false;
    if (out < GEAR.lead && S.v[0] < -GEAR.toward) return false;
  }
  return true;
}
// over a planet: h, how high its feet are over the ground (m); up, whether they are up now
export const gearOverGround = (h, up) => (up ? h > GEAR.near : h > GEAR.clear);
// THE GUIDE: `near`: within this of the pad's middle (m, across the floor) the heading asked for is the parking one,
// nose out; further off it is simply the way to the pad. Each hint is dark inside its first number and at its
// brightest from its second: across the floor (m), up and down (m), the nose's turn (degrees), the roll (degrees).
// `space`: the small model and its hologram share one small space, drawn smaller the further apart they are: so many
// metres apart is half way to its edge (src/flying.js draws it).
export const GUIDE = { near: 12, move: [0.3, 8], rise: [0.2, 4], turn: [4, 50], roll: [3, 30], dim: 0.25, lift: 0.6, space: 16 };

// ── A SHIP'S OWN FACTS: cfg (src/fleet.js flightOf: every ship's are its data there, in the same shape) ──
//   id, room, hangar, name   the ship, the station file's room of it, its hangar
//   pad      where it is parked (the station file's places.ships.<id>.at; a test holds them together)
//   q0       which way round it is parked, as a turn (none: nose out of its bay door; the Medic is parked nose in)
//   points   its hull as points in its own frame [ahead, up, right] (src/fleet.js boxPoints)
//   hover, low   how high the autopilot carries it through the bay, and over its pad before it comes down
//   seat, behind   THE TWO VIEWS, in the ship's own kit frame (x to port, y up from its ground line, z to the nose:
//            ~/pw/space-math/SHIP_miner_arms.md). seat: the pilot's eyes and where they look, wide and on a phone, with
//            the job panel up (it covers the right of a wide screen and the bottom of a phone's) and without; the other
//            seat is the same across the ship. behind: how far back and up the camera follows, and the point of the
//            ship it looks at (ups: under a roof, in its bay, it follows lower: the first of these heights that is clear)
//   dash     the dashboard's display in front of the pilot (src/dash.js; src/fleet.js has the words)
//   bay      ITS BAY (src/flysolid.js: what it bumps into in there; its floor is the hangar's floor)
//   floor    THE FLOOR IT CAN BE SET DOWN ON AND GOT OUT OF (none: anywhere on its hangar's floor). The Miner's is where
//            it can be unloaded: the part of its hangar's floor where the crane can get at every canister of a ship
//            standing any way round (all of the ship must stand inside it). Toward the door the crane's rails end 2.1 m
//            short of the door's line (the hook goes no further than x = 56.9: the station file's place `crane`, less
//            its end stops); by the wall of sockets and the rack of empties (z = -15.7, the rack's front) a tray slid
//            out needs 0.8 m clear; on the other side a cart stands in the bay's edge (from z = 5.0 on, about x 32.3 to
//            34.3: felt out in the game's own walls), and a canister in the cradle beside the ship there reaches 0.5 m
//            past the ship's side. A test holds these to the crane's own places (tests/flying.test.mjs).
//   others   THE OTHER TWO HANGARS it can fly into by hand, and the ship parked in each (src/fleet.js othersOf)
//   voice    ITS VOICE: its clips are named by it (src/voices.js SHIP_CLIPS: 'ship-miner-welcome', 'ship-miner-safety')
//   claw     (the Miner) ITS CLAW: where its hand holds a rock, in its own frame [ahead, up, right] (src/drillview.js
//            reads the same place off the arm itself: 1.7 m ahead of its nose, a little under its middle)
//   model    the small model of it in the landing guide (src/flying.js)
export const MINER = flightOf('miner');

// ── THE OTHER TWO HANGARS, AND THE SHIP PARKED IN EACH (as the Miner meets them: src/fleet.js othersOf) ──
// Each: its hangar and its bay (as wide as its door, like the Miner's own: src/flysolid.js), where its ship is parked
// (the station file's places.ships) and which way its nose points there (1: out of the bay door; -1: in), and the
// ship's shape as a few boxes in its own frame: `a` from and to along it (metres ahead of the point of it that stands
// on its pad's middle), `r` its half width there, `h` how tall (from the floor: nothing fits under a wing). Measured
// from the game's own walls (~/pw/space-math/rigs/flying-3/shapes.cjs); a test holds them to the ships' own files.
// mass: how heavy it is beside the flown ship (which is 1; Infinity: a bump does not move it); gyr: how hard it is to
// turn (a radius, m).
export const OTHERS = MINER.others;
// A SHOVED SHIP: the most it slides and turns (m/s, radians a second), how quickly it slows by itself (m/s and radians
// a second, each second), how far in from its bay door's line it is kept (m: the shield holds it in), how far clear of
// it anyone it comes over is pushed (m), and the Miner's crane's grab come down over it (grabbed): how near its shape
// (m: over one of its trays slid out, the cradle round a canister there) and how far down from carrying height (m)
export const SHOVE = { most: 6, spin: 1.1, grip: 2.4, gripTurn: 0.6, door: 0.5, person: 0.5, grab: { near: 1.0, down: 0.05 } };
// THE SHIP'S VOICE: how long each clip is (s), and the gap between one "Safety violation." and the next
// (2026-11-19: the Miner's clips are the low-buzz voice the game's maker chose, with the longer pause he asked for
// between "pilot." and "Systems ready.": 3.4 s and 1.9 s)
export const VOICE = { welcome: 3.4, safety: 1.9, gap: 1.4 };

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
// (the autopilot's: marked as its own, so a ship it flies low is never taken for one being landed by hand)
const autoControls = () => ({ ...noControls(), auto: true });
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
// (a ship that docks, cfg.dock: out from its dock the way it backs off from it, nose toward the station)
export function arrival(cfg = MINER) {
  if (cfg.dock) { const A = cfg.dock.away, P = cfg.pad; return { p: [P[0] + A[0] * ARRIVE.out, P[1] + ARRIVE.up, P[2] + A[2] * ARRIVE.out], q: facing([-A[0], 0, -A[2]]) }; }
  return { p: [DOOR.face + ARRIVE.out, cfg.hover + ARRIVE.up, cfg.pad[2]], q: facing([-1, 0, 0]) };
}
// in its bay, or any of it still in the doorway (its tail is 9 m behind its middle; higher than this it would not fit under the lintel)
const inBay = (p, cfg) => !cfg.dock && p[0] < DOOR.face + 11 && p[0] > cfg.pad[0] - 22 && Math.abs(p[2] - cfg.pad[2]) < DOOR.w / 2 + 1 && p[1] > cfg.pad[1] - 1 && p[1] < cfg.pad[1] + 3.6;

// ── A SHIP ──
export function makeShip(cfg = MINER, at = null) {
  return park({ cfg, p: [...cfg.pad], q: [0, 0, 0, 1], v: [0, 0, 0], w: [0, 0, 0], power: false, landed: true, settle: null, engine: 0, acc: [0, 0, 0], spin: 0, bump: 0, t: 0, on: false, tilt: 0 }, at);
}
// exactly where it is parked, nose out?
// (which way round it is parked: cfg.q0, none for nose out; and is it turned exactly so?)
export const parkedTurn = (cfg) => cfg.q0 || [0, 0, 0, 1];
const turnedAsParked = (S) => (S.cfg.q0 ? S.q.every((v, i) => v === S.cfg.q0[i]) : S.q[3] === 1);
// the way its nose points as it is parked (the station's frame)
export const parkedNose = (cfg) => turn(parkedTurn(cfg), [1, 0, 0]);
export const onPad = (S) => S.landed && turnedAsParked(S) && S.p[0] === S.cfg.pad[0] && S.p[1] === S.cfg.pad[1] && S.p[2] === S.cfg.pad[2];
// where it stands, to be kept ({ p, q }); none: on its pad as parked, or not down at all
export const standOf = (S) => (S.landed && !onPad(S) ? { p: [...S.p], q: [...S.q] } : null);
export const speedOf = (S) => len(S.v);
// "24 m/s": the speed as the cockpit's screen shows it (a plain number)
export const speedWords = (S) => `${Math.round(speedOf(S))} m/s`;
export function place(S, p, q = [0, 0, 0, 1]) { S.p = [...p]; S.q = [...q]; S.v = [0, 0, 0]; S.w = [0, 0, 0]; S.landed = false; S.settle = null; S.power = true; return S; }
// down and still: on its pad as it is parked, or (at: { p, q }, standOf) standing where it was last set down, level on
// its legs, turned whichever way it was left
export function park(S, at = null) {
  S.p = [...S.cfg.pad]; S.q = [...parkedTurn(S.cfg)];
  if (at) { const f = turn(qUnit(at.q), [1, 0, 0]); S.p = [at.p[0], floorAt(S.cfg, at.p) ?? at.p[1], at.p[2]]; S.q = facing([f[0], 0, f[2]]); }
  S.v = [0, 0, 0]; S.w = [0, 0, 0]; S.landed = true; S.settle = null; S.acc = [0, 0, 0]; S.spin = 0; S.on = false; S.tilt = 0; return S;
}
// the power's switch: on the pad only (in flight it stays on: a ship never drifts off dead)
export function setPower(S, on) { if (S.landed) S.power = !!on; return S.power; }
// the ship's own points, in the station's frame
export const pointsOf = (S) => S.cfg.points.map((pt) => add(S.p, turn(S.q, pt)));
// ── its own hangar's floor ──
// the floor's height under a point of its bay (none: not over it)
function floorAt(cfg, p) { const B = cfg.bay; return B && p[0] > B.x0 && p[0] < B.x1 && p[2] > B.z0 && p[2] < B.z1 ? B.y0 : null; }
export const floorUnder = (S) => floorAt(S.cfg, S.p);
// how high its lowest point is (the station's frame), and how far it leans from upright (degrees)
const lowest = (S) => { let low = Infinity; for (const pt of S.cfg.points) { const y = S.p[1] + turn(S.q, pt)[1]; if (y < low) low = y; } return low; };
export const tiltOf = (S) => Math.acos(clamp(turn(S.q, [0, 1, 0])[1], -1, 1)) * 180 / Math.PI;
// WHERE A SHIP THAT IS DOWN STANDS: 'pad' (exactly as it is parked), 'floor' (anywhere else on its hangar's floor that
// its crane can unload it: every foot of it inside cfg.floor), 'edge' (on the hangar's floor, but too near the door or
// a wall for the crane); null: not down
export function standing(S) {
  if (!S.landed) return null;
  if (onPad(S)) return 'pad';
  const F = S.cfg.floor; if (!F) return 'floor';
  for (const pt of S.cfg.points) { if (pt[1] > 0.01) continue; const w = add(S.p, turn(S.q, pt)); if (w[0] < F.x[0] || w[0] > F.x[1] || w[2] < F.z[0] || w[2] > F.z[1]) return 'edge'; }
  return 'floor';
}
// may the pilot get out of the seat? Down on its hangar's floor where the crane can unload it. Why not, when not:
// 'over' (on the floor but rolled over too much: its legs are not under it), 'edge' (down, but too near the door or a
// wall), or null (simply not down)
export const canGetUp = (S) => { const w = standing(S); return w === 'pad' || w === 'floor'; };
export const whyNot = (S) => (S.landed ? (standing(S) === 'edge' ? 'edge' : null) : S.on && S.tilt > LAND.tilt ? 'over' : null);
// which edge a ship down at the edge is over: 'door' (toward the bay door: the crane's rails end short of it) or 'wall'
export function edgeOf(S) { const F = S.cfg.floor; return F && S.cfg.points.some((pt) => pt[1] <= 0.01 && S.p[0] + turn(S.q, pt)[0] > F.x[1]) ? 'door' : 'wall'; }

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
    S.landed = false; if (S.cfg.dock) S.undocked = true;
  }
  // (the autopilot's own way down goes on only while the autopilot asks for it: switched off, the pilot has the ship)
  // (a ship that docks, taken by its dock's clamps: they bring it in whoever was flying)
  if (S.settle && !C.settle && !(S.cfg.dock && S.settle.hand)) S.settle = null;
  if (S.settle) { if (S.cfg.dock) settleDock(S, dt); else settle(S, dt, solid); return S; }
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
    // (and the ships parked in the other hangars, which give way: solid.push, pushOthers below; the station has the
    // last word, so a ship pressed between one of them and a wall is never left in the wall)
    if (solid && solid.push && solid.push(S)) bump(S, solid);
  }
  const vb1 = unturn(S.q, S.v);
  S.acc = mul(sub(vb1, vb0), 1 / dt); S.spin = (S.w[1] - wy0) / dt;
  S.engine += ((0.15 + 0.85 * Math.max(0, C.move[0])) - S.engine) * Math.min(1, dt * 2.5);
  // its own hangar's floor: its lowest point never under it (with or without a solid to bump into)
  const fy = floorUnder(S); S.on = false; S.tilt = tiltOf(S);
  if (fy != null) { const low = lowest(S); if (low < fy) { S.p[1] += fy - low; if (S.v[1] < 0) S.v[1] = 0; } S.on = low - fy <= LAND.touch; }
  const P = S.cfg.pad, up = turn(S.q, [0, 1, 0])[1];
  // A SHIP THAT DOCKS (cfg.dock: no floor under it anywhere): close beside its dock, slow and turned as it lies there,
  // the dock's clamps take it (dockStep)
  if (S.cfg.dock) { dockStep(S, C); return S; }
  // THE AUTOPILOT, low and slow over the ship's own pad, asks it to set itself down
  if (C.settle) { if (C.move[1] <= 0 && Math.hypot(S.p[0] - P[0], S.p[2] - P[2]) < SETTLE.reach && S.p[1] - P[1] < SETTLE.low && Math.hypot(S.v[0], S.v[2]) < SETTLE.slow && up > SETTLE.level) S.settle = { t: 0 }; }
  // A PILOT'S OWN LANDING: on the floor, not held up off it, and not rolled over too much: its legs take the floor
  else if (S.on && C.move[1] <= 0 && S.tilt <= LAND.tilt && !C.auto) legs(S, dt, fy);
  return S;
}
// on its legs on the floor: it stops sliding, what lean is left goes, and once it is still and level it is down, where
// and whichever way round the pilot put it (nothing is moved or turned for them)
function legs(S, dt, fy) {
  const sp = Math.hypot(S.v[0], S.v[2]), k = sp > 1e-9 ? Math.max(0, sp - LAND.grip * dt) / sp : 0;
  S.v = [S.v[0] * k, 0, S.v[2] * k]; S.w = [0, 0, 0];
  const f = turn(S.q, [1, 0, 0]), flat = facing([f[0], 0, f[2]]), e = vOf(qMul(flat, qConj(S.q))), ang = len(e), step = LAND.level * dt;
  if (ang > step) { S.q = qUnit(qMul(qOf(mul(e, step / ang)), S.q)); S.p[1] += fy - lowest(S); return; }
  S.q = flat; S.p[1] = fy;
  if (sp * k >= LAND.still) return;
  // (its legs not yet fully down: it waits on its feet's line until they are)
  if (S.gearDown === false) return;
  S.v = [0, 0, 0]; S.acc = [0, 0, 0]; S.spin = 0; S.settle = null; S.landed = true; S.justLanded = true; S.tilt = 0;
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

// ── IN ANOTHER SHIP'S HANGAR ──
// the other hangar a ship is in (its facts: OTHERS), or null: any of its hull past that hangar's door line. A ship
// that is down is in its own hangar.
export function visiting(S) {
  const L = S.cfg.others; if (!L || S.landed || S.p[0] > DOOR.x + 12) return null;
  for (const o of L) {
    if (Math.abs(S.p[2] - o.at[2]) > DOOR.w / 2 + 12) continue;
    for (const pt of S.cfg.points) { const w = add(S.p, turn(S.q, pt)); if (w[0] < DOOR.x && w[0] > o.bay.x0 - 2 && w[2] > o.bay.z0 - 1 && w[2] < o.bay.z1 + 1) return o; }
  }
  return null;
}
// the floor under a ship's middle, its own hangar's or another's (none: not over one): for whoever is under it
export const floorBelow = (S) => floorAt(S.cfg, S.p) ?? ((S.cfg.others || []).some((o) => floorAt(o, S.p) != null) ? 0 : null);

// A SHIP PARKED IN ANOTHER HANGAR, as something that can be shoved: O = makeOther(cfg). Where it is: O.p [x, z] (the
// point of it that stands on its pad's middle) and O.yaw (how far it is turned from the way it is parked, radians about
// straight up, as three.js turns: x' = c x + s z, z' = -s x + c z); how it is sliding and turning: O.v [x, z], O.w.
// Its boxes are kept in its own parked frame (x and z as the station's, from O.p). O.held: something has hold of it
// for now (the Miner's crane, its grab down at it: grabbed below, src/visit.js), and a bump does not move it.
export function makeOther(cfg) {
  const boxes = cfg.boxes.map((b) => ({ x0: cfg.nose > 0 ? b.a[0] : -b.a[1], x1: cfg.nose > 0 ? b.a[1] : -b.a[0], r: b.r, h: b.h }));
  // (the points of it that a flown ship's own hull is tried against: round each box, low down and near its top)
  const pts = [];
  for (const b of boxes) {
    const nx = Math.max(1, Math.ceil((b.x1 - b.x0) / 1.8)), nz = Math.max(1, Math.ceil(2 * b.r / 1.8));
    for (const y of [0.5, b.h - 0.15]) {
      for (let i = 0; i <= nx; i++) for (const z of [-b.r, b.r]) pts.push([b.x0 + (b.x1 - b.x0) * i / nx, y, z]);
      for (let k = 1; k < nz; k++) for (const x of [b.x0, b.x1]) pts.push([x, y, -b.r + 2 * b.r * k / nz]);
    }
  }
  return { cfg, boxes, pts, p: [cfg.at[0], cfg.at[2]], yaw: 0, v: [0, 0], w: 0, moved: false, held: false, hit: 0, hits: 0 };
}
// back where it is parked, still
export function resetOther(O) { O.p = [O.cfg.at[0], O.cfg.at[2]]; O.yaw = 0; O.v = [0, 0]; O.w = 0; O.moved = false; O.hit = 0; return O; }
// standing, still, where a move from where it is parked has it (e: 16 numbers, src/standing.js; null: parked): what
// otherElements gives, taken back (a ship that stands somewhere else already, the Miner set down crooked)
export function otherAt(O, e) {
  if (!e) return resetOther(O);
  const at = outOf(frameOf(e), O.cfg.at[0], O.cfg.at[2]);
  O.p = [at[0], at[1]]; O.yaw = yawOf(e); O.v = [0, 0]; O.w = 0; O.moved = true;
  return O;
}
export const otherStill = (O) => !O.v[0] && !O.v[1] && !O.w;
// where it stands, as the flight model says where a ship stands ({ p, q }; null: exactly as it is parked), and as the
// one move from where it is parked that everything of it follows (src/standing.js: 16 numbers; null: no move at all)
export const otherStand = (O) => (O.yaw === 0 && O.p[0] === O.cfg.at[0] && O.p[1] === O.cfg.at[2] ? null : { p: [O.p[0], O.cfg.at[1], O.p[1]], q: [0, Math.sin(O.yaw / 2), 0, Math.cos(O.yaw / 2)] });
export const otherElements = (O) => standElements(otherStand(O), O.cfg.at);
// a point of the station in its frame [x, y, z], and a way of its frame in the station's
const intoOther = (O, w) => { const c = Math.cos(O.yaw), s = Math.sin(O.yaw), dx = w[0] - O.p[0], dz = w[2] - O.p[1]; return [c * dx - s * dz, w[1], s * dx + c * dz]; };
const outOfOther = (O, v) => { const c = Math.cos(O.yaw), s = Math.sin(O.yaw); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; };
const inBox = (b, l, k) => l[0] > b.x0 - k && l[0] < b.x1 + k && Math.abs(l[2]) < b.r + k && l[1] < b.h + k;
// is a point of the station inside the ship (within k of it)?
export function insideOther(O, w, k = 0) { const l = intoOther(O, w); return O.boxes.some((b) => inBox(b, l, k)); }
// THE MINER'S CRANE HAS HOLD OF IT (src/crane.js grab: { x, z, h, carry }, the hook over the floor, how high, how high
// it is carried): its grab come down from carrying height over it or over one of its trays (within SHOVE.grab.near of
// its shape, where it now stands), taking a canister off it or putting one on. A bump does not move it then (O.held)
export const grabbed = (O, grab, G = SHOVE.grab) => !!grab && grab.h < grab.carry - G.down && insideOther(O, [grab.x, 1, grab.z], G.near);
// the shortest way out of the ship for a point inside it (within k of it), in its own frame: { d, n } or null (not
// inside). A way out that only leads into another of its boxes is no way out.
function wayOut(O, l, k) {
  let best = null, any = null;
  for (const b of O.boxes) {
    if (!inBox(b, l, k)) continue;
    for (const [d, n] of [[l[0] - b.x0 + k, [-1, 0, 0]], [b.x1 + k - l[0], [1, 0, 0]], [l[2] + b.r + k, [0, 0, -1]], [b.r + k - l[2], [0, 0, 1]], [b.h + k - l[1], [0, 1, 0]]]) {
      if (!any || d < any.d) any = { d, n };
      if (best && d >= best.d) continue;
      const e = [l[0] + n[0] * (d + 0.01), l[1] + n[1] * (d + 0.01), l[2] + n[2] * (d + 0.01)];
      if (!O.boxes.some((q) => q !== b && inBox(q, e, k))) best = { d, n };
    }
  }
  return best || any;
}
// the flown ship's own hull as one box in its own frame [ahead, up, right]
const hullOf = (cfg) => cfg.hull || (cfg.hull = cfg.points.reduce((B, p) => ({ a0: Math.min(B.a0, p[0]), a1: Math.max(B.a1, p[0]), u1: Math.max(B.u1, p[1]), r: Math.max(B.r, Math.abs(p[2])) }), { a0: 0, a1: 0, u1: 0, r: 0 }));
// where the flown ship and a parked one are deepest into each other: { d (m), n (the way the flown ship is eased back
// out, a unit), at (the point, the station's frame) } or null. Tried both ways, so neither's corner slips between the
// other's points: the flown ship's points against the parked one's boxes, the parked one's points against its hull.
function touch(S, O) {
  let best = null;
  for (const pt of S.cfg.points) {
    const w = add(S.p, turn(S.q, pt)), out = wayOut(O, intoOther(O, w), SKIN);
    if (out && (!best || out.d > best.d)) best = { d: out.d, n: outOfOther(O, out.n), at: w };
  }
  const H = hullOf(S.cfg);
  for (const pt of O.pts) {
    const lw = outOfOther(O, pt), w = [lw[0] + O.p[0], pt[1], lw[2] + O.p[1]], l = unturn(S.q, sub(w, S.p));
    if (l[0] <= H.a0 - SKIN || l[0] >= H.a1 + SKIN || l[1] <= -SKIN || l[1] >= H.u1 + SKIN || Math.abs(l[2]) >= H.r + SKIN) continue;
    let d = Infinity, n = null;
    for (const [e, m] of [[l[0] - H.a0 + SKIN, [-1, 0, 0]], [H.a1 + SKIN - l[0], [1, 0, 0]], [l[1] + SKIN, [0, -1, 0]], [H.u1 + SKIN - l[1], [0, 1, 0]], [l[2] + H.r + SKIN, [0, 0, -1]], [H.r + SKIN - l[2], [0, 0, 1]]]) if (e < d) { d = e; n = m; }
    // (the way the parked ship's point would leave the hull; the flown ship is eased the other way)
    if (!best || d > best.d) best = { d, n: mul(turn(S.q, n), -1), at: w };
  }
  return best;
}
// THE FLOWN SHIP AGAINST THE SHIPS PARKED IN THE OTHER HANGARS (each step of its motion, after the station itself): it
// is eased back out of whichever it has come into, as out of a wall; and across the floor the two share the bump, so
// the parked one is shoved along and turned by where it was hit (it is the heavier: cfg.mass), with no bounce.
export function pushOthers(S, others) {
  let touched = false;
  for (const O of others) {
    if (Math.abs(S.p[0] - O.p[0]) > 34 || Math.abs(S.p[2] - O.p[1]) > 34) continue;
    for (let it = 0; it < 3; it++) {
      const T = touch(S, O); if (!T || T.d < 0.02) break;
      touched = true;
      const n = T.n, L = Math.hypot(n[0], n[2]);
      if (L > 0.3) {
        const ux = n[0] / L, uz = n[2] / L, rx = T.at[0] - O.p[0], rz = T.at[2] - O.p[1];
        // (how fast they are closing at the point, across the floor; the parked one's point moves as it slides and turns)
        const rel = (S.v[0] - (O.v[0] + O.w * rz)) * ux + (S.v[2] - (O.v[1] - O.w * rx)) * uz;
        if (rel < 0) {
          const m = O.held ? Infinity : O.cfg.mass, I = m * O.cfg.gyr * O.cfg.gyr, tau = rz * ux - rx * uz, j = -rel / (1 + 1 / m + tau * tau / I);
          S.v = [S.v[0] + j * ux, S.v[1], S.v[2] + j * uz];
          // (one no bump moves, mass Infinity or held for now, is felt as a wall)
          if (Number.isFinite(m)) { O.v = [O.v[0] - j / m * ux, O.v[1] - j / m * uz]; O.w -= j * tau / I; O.moved = true; }
          O.hit = Math.max(O.hit, -rel); O.hits++;
        }
      } else { const into = dot(S.v, n); if (into < 0) S.v = sub(S.v, mul(n, into)); }
      S.p = add(S.p, mul(n, T.d)); S.bump = Math.max(S.bump, T.d);
    }
  }
  return touched;
}
// a shoved ship slides on and slows by itself; its hangar's walls and its door's shield keep it in.
// IT WAITS FOR NOBODY. (It used to: it did not move while anyone stood within half a metre of it, a rule nobody had
// asked for. The game's maker, 2026-11-19, asked what should happen when someone stands right beside the parked ship
// as it is rammed: "Aren't they supposed to be running away? If they are just standing there then then maybe they
// deserve to be hit.") The people do run (src/visit.js, src/people.js runAbout); whoever it still comes over is pushed
// out of its way: pushedTo below says where to.
export function stepOther(O, dt) {
  if (otherStill(O)) return O;
  if (O.held) { O.v = [0, 0]; O.w = 0; return O; }
  const G = SHOVE, sp = Math.hypot(O.v[0], O.v[1]), cap = sp > G.most ? G.most / sp : 1;
  O.v = [O.v[0] * cap, O.v[1] * cap]; O.w = clamp(O.w, -G.spin, G.spin);
  O.p = [O.p[0] + O.v[0] * dt, O.p[1] + O.v[1] * dt]; O.yaw += O.w * dt;
  const s1 = Math.hypot(O.v[0], O.v[1]), k = s1 > 1e-9 ? Math.max(0, s1 - G.grip * dt) / s1 : 0;
  O.v = [O.v[0] * k, O.v[1] * k]; O.w = Math.sign(O.w) * Math.max(0, Math.abs(O.w) - G.gripTurn * dt);
  keepIn(O);
  if (Math.hypot(O.v[0], O.v[1]) < 0.02) O.v = [0, 0];
  if (Math.abs(O.w) < 0.004) O.w = 0;
  return O;
}
// where the ship pushes someone standing at [x, z] on its floor: the shortest way out from under it sideways, k clear
// of every part of it (under a wing too: a wing's tip is lower than a head) -> [x, z], or null where it is not over them
export function pushedTo(O, at, k = SHOVE.person) {
  const l = intoOther(O, [at[0], 1, at[1]]);
  let best = null, any = null;
  for (const b of O.boxes) {
    if (!inBox(b, l, k)) continue;
    for (const [d, n] of [[l[0] - b.x0 + k, [-1, 0, 0]], [b.x1 + k - l[0], [1, 0, 0]], [l[2] + b.r + k, [0, 0, -1]], [b.r + k - l[2], [0, 0, 1]]]) {
      if (!any || d < any.d) any = { d, n };
      if (best && d >= best.d) continue;
      const e = [l[0] + n[0] * (d + 0.01), l[1], l[2] + n[2] * (d + 0.01)];
      if (!O.boxes.some((q) => q !== b && inBox(q, e, k))) best = { d, n };
    }
  }
  const out = best || any; if (!out) return null;
  const w = outOfOther(O, [out.n[0] * (out.d + 0.01), 0, out.n[2] * (out.d + 0.01)]);
  return [at[0] + w[0], at[1] + w[2]];
}
// every corner of it inside its own bay, in from the door's line (or inside what it is kept in: cfg.keep, src/fleet.js
// othersOf, the Miner's floor)
function keepIn(O) {
  const B = O.cfg.keep || O.cfg.bay, x1 = O.cfg.keep ? B.x1 : DOOR.x - SHOVE.door;
  let lo = 0, hi = 0, near = 0, far = 0;
  for (const b of O.boxes) for (const lx of [b.x0, b.x1]) for (const lz of [-b.r, b.r]) {
    const w = outOfOther(O, [lx, 0, lz]), x = w[0] + O.p[0], z = w[2] + O.p[1];
    lo = Math.max(lo, B.x0 - x); hi = Math.max(hi, x - x1); near = Math.max(near, B.z0 - z); far = Math.max(far, z - B.z1);
  }
  if (lo > 0 || hi > 0) { O.p[0] += lo - hi; if ((lo > hi) === (O.v[0] < 0)) O.v[0] = 0; }
  if (near > 0 || far > 0) { O.p[1] += near - far; if ((near > far) === (O.v[1] < 0)) O.v[1] = 0; }
}
// how far along the straight line from a to b stays r clear of the parked ships (0..1): for a camera that follows
export function clearOfOthers(a, b, r, others) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), steps = Math.max(1, Math.ceil(L / 0.5));
  for (const O of others) {
    if (Math.min(Math.hypot(a[0] - O.p[0], a[2] - O.p[1]), Math.hypot(b[0] - O.p[0], b[2] - O.p[1])) > L + 14) continue;
    for (let s = 0; s <= steps; s++) { const t = s / steps; if (insideOther(O, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], r)) return Math.max(0, (s - 1) / steps); }
  }
  return 1;
}

// ── THE SHIP'S OWN VOICE ── V = makeVoice() each time someone sits down. voiceStep -> the clip to say now, by what it
// is ('welcome', 'safety'), or null. The welcome: once, as the power first comes on. "Safety violation.": while the
// ship is in another hangar (there: visiting), again and again, a gap after each; it waits for the welcome to end.
// secs: how long this ship's own clips are ({ welcome, safety, gap }: each ship speaks in its own voice; VOICE is the
// Miner's)
export const makeVoice = () => ({ welcomed: false, busy: 0, said: { welcome: 0, safety: 0 } });
export function voiceStep(V, S, dt, there = null, secs = VOICE) {
  V.busy = Math.max(0, V.busy - dt);
  let say = null;
  if (S.power && !V.welcomed) { V.welcomed = true; say = 'welcome'; V.busy = secs.welcome; }
  else if (there && V.busy <= 0) { say = 'safety'; V.busy = secs.safety + secs.gap; }
  if (say) V.said[say]++;
  return say;
}

// ── AT THE ROCKS ──
// THE GAME'S MAKER (2026-11-18, of who flies at the rocks): "Yeah the pilot flies if you are operating the drill. If you
// signed up for both there can be a button that lets you switch tasks. Either way, you should be able to click on an
// asteroid to travel over to it (If you want to fly and you signed up to be a pilot, you can click a button to fly
// manually if you want). If you are the drill operator and you click on an asteroid that is you telling the pilot where
// you would like they to fly. If you are autopilot it is the same control."
// SO, FLOWN BY HAND OUT THERE, it is the same ship with the same keys and the same feel. What is different:
//   - THERE IS NOTHING TO LAND ON (FIELD: the Miner's own facts with no pad, no bay and no floor), so it is never down;
//   - THE ROCKS are what it bumps into, with no damage, as at the station: it stops, or slides round them (pushRocks).
//     A rock is small beside the ship, so it is the ship's whole hull, as one box, that is tried against each rock
//     (the hull's few points alone would let a rock slip in between them). On a run where the claw takes one rock
//     only, every other rock gives way to the ship instead (pushRocks `takes`, below);
//   - ITS CLAW TAKES A ROCK THE SHIP HAS BEEN BROUGHT UP TO (rockNear): the rock's middle within TAKE.reach of where
//     the claw's hand holds a rock, and the ship moving slower than TAKE.slow. The claw then takes it as it does after
//     a tapped trip (src/drillview.js). Nothing is asked of how the ship is turned. The reach is the whole of the
//     nose: a rock met nose on, anywhere across it, is taken; one met by the ship's side or tail is not.
// A rock here is a ball: { p: [x, y, z] its middle, r its size (m) }, in whatever frame the ship is flown in.
// (the flight's screen is the drill's own Miner's dashboard's: that ship's whole cockpit stands 13 cm higher in its
// frame than the cabin's in the hangar, and nowhere else apart (~/pw/space-math/rigs/dashboard-2/deckprobe.cjs), its
// screens set into its dashboard as the hangar's are: so the screen is the hangar's, 13 cm higher)
// (and so are the seat's eyes and where they look: left at the hangar's height they sat 13 cm low in this cockpit, and
// the view from the seat was seen to jump inside the wormhole, the moment the place changed)
export const FIELD_UP = 0.13;
const raised = (d) => (d ? { ...d, at: [d.at[0], +(d.at[1] + FIELD_UP).toFixed(5), d.at[2]] } : d);
const up13 = (v) => [v[0], +(v[1] + FIELD_UP).toFixed(5), v[2]];
const raisedSeat = (s) => ({ ...s, eye: up13(s.eye), look: up13(s.look), lookPanel: up13(s.lookPanel), eyeTall: up13(s.eyeTall), lookTall: up13(s.lookTall), lookTallPanel: up13(s.lookTallPanel) });
// THE DRILL'S OWN MINER AS IT IS DRAWN AT THE ROCKS, its legs up and its two arms reaching ahead of its nose (for a
// rock that gives way to it: pushRocks, below). Every drawn point of it was measured in the game
// (~/pw/space-math/rigs/fieldstop-1/shape.cjs, which also holds these two parts to it: no point of the ship is further
// outside them than the 0.8 m a rock is kept off). Its hull: 15.8 m long, 5.5 m wide over the canisters at its sides,
// from 1.0 m to 5.2 m up. Its arms, from its shoulders to the open claw's fingertips 2.8 m ahead of its nose: 8.2 m
// wide (a metre more to port, where the open claw's fingers spread) and low (0.35 m to 3.35 m up), round in front
// like a roller, so a rock dead ahead goes over or under them. The place its claw's hand holds a rock (MINER.claw) is
// inside them: no rock that gives way is ever left there.
// A part: a box in the ship's own frame { a0, a1 (along it), u0, u1 (up), r0, r1 (to its right) }, rounded by k (the
// box drawn in by k all round, and everything within k of that); given here by the box it fills, all of it.
const drawnIn = (lo, hi, k) => (hi - lo > 2 * k ? [lo + k, hi - k] : [(lo + hi) / 2, (lo + hi) / 2]);
const rounded = ({ part, a, u, r, k }) => { const A = drawnIn(a[0], a[1], k), U = drawnIn(u[0], u[1], k), R = drawnIn(r[0], r[1], k); return { part, a0: A[0], a1: A[1], u0: U[0], u1: U[1], r0: R[0], r1: R[1], k }; };
export const FIELD_SHAPE = [
  { part: 'hull', a: [-9, 6.8], u: [1.0, 5.2], r: [-2.75, 2.75], k: 1.0 },
  { part: 'arms', a: [3.5, 9.6], u: [0.35, 3.35], r: [-4.6, 3.6], k: 1.5 },
].map(rounded);
export const FIELD = { ...MINER, pad: [0, 0, 0], bay: null, floor: null, others: null, field: true, dash: raised(MINER.dash), seat: raisedSeat(MINER.seat), shape: FIELD_SHAPE };
export const TAKE = { reach: 4.5, slow: 3 };
// where the claw's hand is now
export const clawOf = (S) => add(S.p, turn(S.q, S.cfg.claw || MINER.claw));
// A ROCK THE CLAW WILL NOT TAKE GIVES WAY TO THE SHIP. The hull's one box has a broad flat front (6.6 m by 5.1 m: the
// nose, and the two arms reaching ahead beside it), and a rock met anywhere on it stops the ship dead for as long as
// "forward" is held: nothing of its speed runs round a flat face. That is as it should be for a rock the claw takes,
// which is then in its reach and taken at once. But on a run where the claw takes one rock only (the crew's driller's
// marked one: src/fieldfly.js), any other rock that lay on the straight way to the mark stopped the ship for good:
// not taken, not moving, and out of sight under the nose as often as not (about once in fifty such runs:
// ~/pw/space-math/FIELDSTOP_1.md). THE GAME'S MAKER (2026-11-19, asked what a rock should do when the ship bumps into
// it): "I would like the rock to move away so it is more realistic. But I feel like that would involve more coding and
// could be frustrating for someone trying to grab the rock. Shouldn't the claw grab the rock if it is heading towards
// it?" So a rock the claw takes is as it was (it stops the ship, and the claw takes it); a rock the claw will not
// take moves away: it is the rock that is eased out of the ship's way, and the ship goes on as if it were not there.
// (The autopilot's own trip to a tapped or marked rock has always eased the other rocks out of its way:
// src/drillview.js.) It is eased out of THE SHIP AS IT IS DRAWN OUT THERE (shapeOf: cfg.shape, FIELD_SHAPE above),
// parts with no flat front, so a rock met nose on slides off over, under or round the ship and is never carried along
// in front of it. A ship with no such shape of its own: its one box.
const boxOf = (cfg) => { const H = hullOf(cfg); return H.box || (H.box = [{ a0: H.a0, a1: H.a1, u0: 0, u1: H.u1, r0: -H.r, r1: H.r, k: 0 }]); };
export const shapeOf = (cfg) => cfg.shape || boxOf(cfg);
// rock R and part B of the ship, where they have come within `far` of each other (the rock's middle from the part),
// eased apart: the ship back out of the rock, keeping the speed that runs round it; or (give) the rock out of the
// ship's way, the ship left as it is -> touched?
function easeOut(S, R, B, far, give = false) {
  const l = unturn(S.q, sub(R.p, S.p)), c = [clamp(l[0], B.a0, B.a1), clamp(l[1], B.u0, B.u1), clamp(l[2], B.r0, B.r1)];
  let n = sub(c, l), d = len(n);
  if (d >= far) return false;
  let deep = far - d;
  if (d < 1e-6) {
    // (the rock's middle is inside the part: out by the nearest side of it)
    let best = Infinity; n = [0, 1, 0];
    for (const [e, m] of [[l[0] - B.a0, [1, 0, 0]], [B.a1 - l[0], [-1, 0, 0]], [l[1] - B.u0, [0, 1, 0]], [B.u1 - l[1], [0, -1, 0]], [l[2] - B.r0, [0, 0, 1]], [B.r1 - l[2], [0, 0, -1]]]) if (e < best) { best = e; n = m; }
    deep = far + best;
  } else n = mul(n, 1 / d);
  // (n: from the rock to the hull, the ship's own frame; the ship goes that way, or the rock the other way)
  const nw = turn(S.q, n);
  if (give) { R.p = sub(R.p, mul(nw, deep)); return true; }
  S.p = add(S.p, mul(nw, deep)); S.bump = Math.max(S.bump, deep);
  const into = dot(S.v, nw); if (into < 0) S.v = sub(S.v, mul(nw, into));
  return true;
}
// eased back out of any rock its hull has come into (within SKIN of), keeping the speed that runs round it -> touched?
// takes(R): is this a rock the claw takes? (none given: every rock is). A rock it will not take gives way instead
// (above): its place R.p is changed, and moved(R) is told, for whoever keeps the rocks (src/drillview.js rockTo).
export function pushRocks(S, rocks, takes = null, moved = null) {
  let touched = false;
  for (const R of rocks) {
    const far = R.r + SKIN, w = sub(R.p, S.p);
    if (Math.abs(w[0]) > 14 + far || Math.abs(w[1]) > 14 + far || Math.abs(w[2]) > 14 + far) continue;
    if (takes && !takes(R)) { let went = false; for (const B of shapeOf(S.cfg)) if (easeOut(S, R, B, far + B.k, true)) went = true; if (went && moved) moved(R); }
    else for (const B of boxOf(S.cfg)) if (easeOut(S, R, B, far)) touched = true;
  }
  return touched;
}
// the rock nearest the ship now, for whoever asks why it does not move (src/flying.js: the ship stuck): which, how far
// its surface is from the hull's one box (m; SKIN: it is against it), where its middle is in the ship's own frame
// [ahead, up, right], and whether the claw takes it (clawTakes); null: no rock
export function rockBy(S, rocks, takes = null) {
  const H = hullOf(S.cfg); let best = null;
  for (const R of rocks) {
    const l = unturn(S.q, sub(R.p, S.p)), gap = len(sub([clamp(l[0], H.a0, H.a1), clamp(l[1], 0, H.u1), clamp(l[2], -H.r, H.r)], l)) - R.r;
    if (!best || gap < best.gap) best = { id: R.id, r: +R.r.toFixed(2), gap: +gap.toFixed(3), at: l.map((v) => +v.toFixed(2)), clawTakes: !takes || !!takes(R) };
  }
  return best;
}
// what a ship bumps into at the rocks, as the flying takes it (stepShip's `solid`): rocks() gives the rocks now;
// takes(R): is this a rock the claw takes? (none: every rock is); moved(R): a rock that gave way (pushRocks)
export function rockSolid(rocks, takes = null, moved = null) {
  return { reach: 3, dist: () => 99, away: (x, y, z, out) => { out[0] = out[1] = out[2] = 0; return out; }, push: (S) => pushRocks(S, rocks(), takes, moved), clear: () => 1, by: (S) => rockBy(S, rocks(), takes) };
}
// THE ROCK THE CLAW CAN TAKE NOW: the nearest to the claw's hand within TAKE.reach, the ship slow enough; or null
export function rockNear(S, rocks) {
  if (S.landed || speedOf(S) > TAKE.slow) return null;
  const c = clawOf(S); let best = null, bd = TAKE.reach;
  for (const R of rocks) { const d = len(sub(R.p, c)); if (d <= bd) { bd = d; best = R; } }
  return best;
}
// ── THE SHIP STUCK: "forward" held by the pilot and the ship going nowhere ──
// (So that it says so itself the next time: a ship that stopped dead out at the rocks with "forward" held was seen
// three times in some 150 runs before anyone knew why, since nothing on the page said a word.) K = makeStuck();
// stuckStep(K, S, forward, dt) each frame after the ship's step, forward: the pilot is holding "forward" and the
// controls are theirs -> true once, the moment the ship has not moved STUCK.moved metres in STUCK.secs seconds of it
// (again only after it has moved or "forward" was let go). A ship that is down, on its legs or being set down is not
// stuck: it is where it should be. K.bumped: it was eased back out of something meanwhile (a wall, a parked ship, a
// rock): then it is simply pressed against that, and src/flying.js says nothing at the station, where that is all
// it can be.
export const STUCK = { secs: 3, moved: 0.5 };
export const makeStuck = () => ({ t: 0, from: null, bumped: false, told: false });
export function stuckStep(K, S, forward, dt) {
  if (!forward || S.landed || S.settle || S.on) { K.t = 0; K.from = null; K.bumped = false; K.told = false; return false; }
  if (!K.from || len(sub(S.p, K.from)) > STUCK.moved) { K.from = [...S.p]; K.t = 0; K.bumped = false; K.told = false; return false; }
  K.t += dt; if (S.bump > 0) K.bumped = true;
  if (K.t < STUCK.secs || K.told) return false;
  K.told = true; return true;
}
// a ship out at the rocks, in flight: at `p`, its nose along `f`
export function makeFieldShip(p = [0, 0, 0], f = [0, 0, 1], cfg = FIELD) { const S = makeShip(cfg); place(S, p, facing(f)); S.engine = 0.15; return S; }

// setting itself down: level and nose out over the pad's middle, then down onto it
function settle(S, dt, solid) {
  const T = S.settle, P = S.cfg.pad, G = SETTLE; T.t += dt;
  const q0 = parkedTurn(S.cfg), e = S.cfg.q0 ? vOf(qMul(S.q, qConj(q0))) : vOf(S.q), ang = len(e), off = Math.hypot(S.p[0] - P[0], S.p[2] - P[2]);
  // (turning, it keeps its feet clear of the floor)
  // (S.padBusy: someone is standing on the pad (the view says so): it waits over it until they have gone)
  const lined = ang < 0.012 && off < 0.05 && !S.padBusy, wantY = lined ? P[1] : Math.max(P[1] + G.hold, Math.min(S.p[1], P[1] + G.low));
  const stepA = Math.min(ang, Math.max(0.05, Math.min(G.turn, ang * 3.5)) * dt);
  S.q = ang < 1e-6 ? [...q0] : qUnit(qMul(qOf(mul(e, -stepA / ang)), S.q));
  const to = [P[0] - S.p[0], 0, P[2] - S.p[2]], stepM = Math.min(off, Math.max(0.05, Math.min(G.move, off * 2.2)) * dt);
  const was = [...S.p];
  if (off > 1e-6) { S.p[0] += to[0] / off * stepM; S.p[2] += to[2] / off * stepM; }
  const dy = wantY - S.p[1]; S.p[1] += clamp(dy, -G.down * dt, G.down * dt);
  if (solid && !lined) bump(S, solid);
  S.v = mul(sub(S.p, was), 1 / Math.max(dt, 1e-6)); S.w = [0, 0, 0]; S.acc = [0, 0, 0]; S.spin = 0;
  S.engine += (0.15 - S.engine) * Math.min(1, dt * 2.5);
  if (lined && S.p[1] - P[1] < 0.003 && S.gearDown !== false) { park(S); S.settle = null; S.justLanded = true; }
}

// ── A SHIP THAT DOCKS (cfg.dock: { away, nose }, src/fleet.js DOCKED; the Hauler at the bridge's end, and at the old
// station's own bridge). Its pad is where it lies docked, out in space: nothing is under it, so it is never "down" on a
// floor. Docked is the same `landed` as a ship on its pad (the power's switch, the seat's Get up, the lift-off that
// leaves it: here the undocking). It comes in from its side, along `away`:
//   - THE AUTOPILOT brings it to just off its dock and asks it in (its `down` leg, as over a pad);
//   - A PILOT'S OWN DOCKING: brought close beside the dock, slow, level and turned nearly as it lies there (DOCKING), the
//     dock's clamps take it: it is lined up and drawn in the last of the way, exactly onto its place (its crew door has
//     to meet the tunnel's end, so docked is never crooked: unlike a hangar's floor, where it stands as it was put).
//     A ship that has just undocked is not taken again until it has been DOCKING.free away. ──
export const DOCKING = { free: 6, grab: 2.6, side: 1.4, slow: 1.6, turn: 14, tilt: 10, hold: SETTLE.hold + 0.6 };
// how far out from its dock along the way it backs off, and how far off that line (m)
export function dockOff(S) { const A = S.cfg.dock.away, rel = sub(S.p, S.cfg.pad), out = dot(rel, A); return { out, side: len(sub(rel, mul(A, out))), dist: len(rel) }; }
function dockStep(S, C) {
  const O = dockOff(S), sp = len(S.v), up = turn(S.q, [0, 1, 0])[1];
  if (S.undocked && O.dist > DOCKING.free) S.undocked = false;
  // (the autopilot, stopped just off the dock: in)
  if (C.settle) { if (O.dist < SETTLE.reach && sp < SETTLE.slow && up > SETTLE.level) S.settle = { t: 0 }; return; }
  if (C.auto || S.undocked) return;
  const e = vOf(qMul(S.q, qConj(parkedTurn(S.cfg)))), deg = len(e) * 180 / Math.PI;
  if (O.out > -0.4 && O.out < DOCKING.grab && O.side < DOCKING.side && sp < DOCKING.slow && deg < DOCKING.turn && tiltOf(S) < DOCKING.tilt) S.settle = { t: 0, hand: true };
}
// drawn in by the dock: turned as it lies there and brought onto its line while it is held SETTLE.hold off, then
// straight in (the same sums and speeds as setting down over a pad, sideways)
function settleDock(S, dt) {
  const T = S.settle, P = S.cfg.pad, A = S.cfg.dock.away, G = SETTLE; T.t += dt;
  const q0 = parkedTurn(S.cfg), e = vOf(qMul(S.q, qConj(q0))), ang = len(e);
  const rel = sub(S.p, P), out = dot(rel, A), sideV = sub(rel, mul(A, out)), off = len(sideV);
  const lined = ang < 0.012 && off < 0.05 && !S.padBusy, wantOut = lined ? 0 : Math.max(G.hold, Math.min(out, DOCKING.grab));
  const stepA = Math.min(ang, Math.max(0.05, Math.min(G.turn, ang * 3.5)) * dt);
  S.q = ang < 1e-6 ? [...q0] : qUnit(qMul(qOf(mul(e, -stepA / ang)), S.q));
  const was = [...S.p], stepM = Math.min(off, Math.max(0.05, Math.min(G.move, off * 2.2)) * dt);
  if (off > 1e-6) S.p = sub(S.p, mul(sideV, stepM / off));
  S.p = add(S.p, mul(A, clamp(wantOut - out, -G.down * dt, G.down * dt)));
  S.v = mul(sub(S.p, was), 1 / Math.max(dt, 1e-6)); S.w = [0, 0, 0]; S.acc = [0, 0, 0]; S.spin = 0;
  S.engine += (0.15 - S.engine) * Math.min(1, dt * 2.5);
  if (lined && Math.abs(dot(sub(S.p, P), A)) < 0.003) { park(S); S.settle = null; S.undocked = false; S.justLanded = true; }
}
// the autopilot's way out from a dock and clear of the station: docked or still beside the bridge, straight out from the
// station's side first, turned as it lies; then away from the station's middle, as any ship outside
function planLeaveDock(S, solid) {
  const c = S.cfg, P = c.pad, A = c.dock.away, legs = [];
  let from = S.p;
  if (S.landed || len(sub(S.p, P)) < 30) { from = [P[0] + A[0] * 34, S.landed ? P[1] : S.p[1], P[2] + A[2] * 34]; legs.push({ to: from, face: S.landed ? parkedNose(c) : unit([turn(S.q, [1, 0, 0])[0], 0, turn(S.q, [1, 0, 0])[2]]), speed: 5, near: 2, stop: true }); }
  else { const off = backOff(S, solid); if (off.length) { legs.push(...off); from = off[0].to; } }
  // (a dock with no station of ours round it, the old station's: clear is simply well out from the dock)
  if (c.far) { const d = len(sub(from, P)); if (d < c.far) legs.push({ to: add(from, mul(unit(sub(from, P)), c.far - d + 10)), speed: FEEL.speed.forward, near: 4, stop: true }); return legs; }
  const mid = [(OUTSIDE_BOX.min[0] + OUTSIDE_BOX.max[0]) / 2, (OUTSIDE_BOX.min[1] + OUTSIDE_BOX.max[1]) / 2, (OUTSIDE_BOX.min[2] + OUTSIDE_BOX.max[2]) / 2];
  const dir = unit(sub(from, mid)), need = Math.max(0, AREA.out + 30 - boxDist(from));
  if (need > 0) legs.push({ to: add(from, mul(dir, need + 20)), speed: FEEL.speed.forward, near: 4, stop: true });
  return legs;
}
// the autopilot's way in to a dock: round the station to a gate straight out from the dock, in along that line turned
// as it will lie, stopped just off the dock, and in (its `down` leg: the dock takes it)
function planLandDock(S, solid) {
  const c = S.cfg, P = c.pad, A = c.dock.away, nose = parkedNose(c);
  if (onPad(S)) return [];
  const at = (k) => [P[0] + A[0] * k, P[1] + A[1] * k, P[2] + A[2] * k], gate = at(70), legs = S.landed || c.far ? [] : backOff(S, solid), from = legs.length ? legs[0].to : S.p;
  const O = dockOff(S), lined = !legs.length && O.out > 8 && O.out < 76 && O.side < 7;
  if (!lined) { for (const w of c.far ? [gate] : wayRound(from, gate)) legs.push({ to: w, speed: FEEL.speed.forward, near: 6, stop: true }); const last = legs[legs.length - 1]; last.stop = false; last.then = 10; }
  legs.push({ to: at(14), face: nose, speed: 10, near: 1.5, then: 3 });
  legs.push({ to: at(DOCKING.hold), face: nose, speed: 2.5, near: 0.4, stop: true }, { down: true });
  return legs;
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
// THE AUTOPILOT NEVER GOES INTO ANOTHER SHIP'S HANGAR: none of its ways leads there. Switched on in one (flown in by
// hand), it first goes straight out through that hangar's own door: levelled and at the height it is carried at, along
// the line it is on (kept clear of the door's jambs), without turning, since its ends would swing into what is parked
// there. Then as from outside. -> { other, at (where that leaves it), legs } or null (not in one)
export function outOfOtherBay(S) {
  const o = S.landed ? null : (S.cfg.others || []).find((q) => S.p[0] < DOOR.face + 11 && S.p[0] > q.bay.x0 - 2 && Math.abs(S.p[2] - q.at[2]) < DOOR.w / 2 + 1 && S.p[1] > -1 && S.p[1] < 12);
  if (!o) return null;
  const f0 = turn(S.q, [1, 0, 0]), f = Math.hypot(f0[0], f0[2]) > 0.2 ? unit([f0[0], 0, f0[2]]) : [1, 0, 0], q = facing(f);
  // (how wide it is across the door, turned as it is)
  let half = 0; for (const pt of S.cfg.points) half = Math.max(half, Math.abs(turn(q, pt)[2]));
  const k = Math.max(0, DOOR.w / 2 - half - SKIN - 0.5), z = clamp(S.p[2], o.at[2] - k, o.at[2] + k), y = S.cfg.pad[1] + S.cfg.hover, at = [DOOR.face + 24, y, z];
  return { other: o, at, legs: [{ to: [S.p[0], y, z], face: f, speed: 2.5, near: 0.3, stop: true }, { to: at, face: f, speed: 7, near: 2, stop: true }] };
}
// out of the hangar and clear of the station (solid: what it bumps into, if a start beside a wall is to be looked after)
export function planLeave(S, solid = null) {
  if (S.cfg.dock) return planLeaveDock(S, solid);
  const out = outOfOtherBay(S); if (out) return [...out.legs, ...planLeave({ ...S, p: out.at, landed: false }, solid)];
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
  if (S.cfg.dock) return planLandDock(S, solid);
  const c = S.cfg, P = c.pad, y = P[1] + c.hover;
  const over = { to: [P[0], P[1] + c.low, P[2]], face: parkedNose(c), speed: 3, near: 0.3, stop: true }, down = { down: true };
  if (onPad(S)) return [];
  const out = outOfOtherBay(S); if (out) return [...out.legs, ...planLand({ ...S, p: out.at, landed: false }, solid)];
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
    // (on its pad: a landing is done; a leaving starts by lifting off, as Space does, and so does a landing begun from
    // where the ship was set down by hand, anywhere else on the floor)
    if (S.landed) { if (onPad(S) && (L.down || plan.every((l) => l.down))) { plan.length = 0; break; } const C = autoControls(); C.move[1] = 0.3; return C; }
    if (L.down) {
      // (settle: the autopilot asks the ship to set itself down; a hand pilot's controls never do)
      if (S.settle) return { ...autoControls(), settle: true };
      const C = { ...autoControls(), settle: true }, P = S.cfg.pad;
      // (a ship that docks: held just off its dock, turned as it is; the dock takes it from there)
      if (S.cfg.dock) { const A = S.cfg.dock.away, b = unturn(S.q, mul(sub([P[0] + A[0] * DOCKING.hold, P[1] + A[1] * DOCKING.hold, P[2] + A[2] * DOCKING.hold], S.p), 1.2)); C.move = [clamp(b[0] / 3, -1, 1), clamp(b[1] / 3, -1, 1), clamp(b[2] / 3, -1, 1)]; level(S, C, turn(S.q, [1, 0, 0])); return C; }
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
    const C = autoControls(); level(S, C, f);
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

// ── THE GUIDE: the goal, how far the ship is from it, and the keys that would bring it there ──
// The goal is the ship in its proper parking place, nose out. -> {
//   to      the goal from the ship, in the ship's own frame [ahead, up, right], metres (what W S, Space C and A D move it along)
//   turn    how far the nose is from the heading asked for [up, right] and the roll from level (to the right +), radians
//   near    within GUIDE.near of the pad's middle: the heading asked for is the parking one, nose out (further off it
//           is simply the way to the pad, so that a pilot far out is never told to turn their back on the door)
//   keys    how brightly each control is lit, 0 (dark: nothing needed) .. 1, by the control's own name: forward, reverse,
//           left, right, up, down, rollLeft, rollRight (the keys), noseUp, noseDown, noseLeft, noseRight
//   mouse   the same four turns as the mouse (or the right stick) makes them: up, down, left, right (with "flip up and
//           down" on, pulling back raises the nose, so the arrows swap)
//   stick   the left stick's push that would do what W S A D would: [x to the right, y down the screen], and how brightly
//   done    nothing is lit: the ship is on its goal }
// A ship that is down where the seat cannot let the pilot out lights Space as well: it has to lift off first.
const glow = (err, [off, full]) => (err <= off ? 0 : Math.min(1, GUIDE.dim + (1 - GUIDE.dim) * (err - off) / (full - off)));
export function guideOf(S, set = {}) {
  const P = S.cfg.pad, G = GUIDE, deg = 180 / Math.PI, to = unturn(S.q, sub(P, S.p));
  const flat = Math.hypot(P[0] - S.p[0], P[2] - S.p[2]), near = flat < G.near;
  // each asked for by itself, so that a ship rolled over and facing the wrong way is not told three things at once:
  //   the roll that would bring its top up, its nose staying where it points;
  //   the nose up or down to level;
  //   the nose round to the heading asked for, across the floor, toward its own right or left.
  // Rolled more than half way onto its side, only the roll is asked for, of all the keys: until it is the right way
  // up, "right" and "up" would mean something else to the pilot than to the ship.
  const F = turn(S.q, [1, 0, 0]), U = turn(S.q, [0, 1, 0]), R = turn(S.q, [0, 0, 1]), want = unit(near ? parkedNose(S.cfg) : [P[0] - S.p[0], 0, P[2] - S.p[2]]);
  const roll = Math.atan2(R[1], U[1]), upright = Math.cos(roll) > 0.7;
  const fh = unit([F[0], 0, F[2]]), rh = cross(fh, [0, 1, 0]);
  let up = upright ? -Math.asin(clamp(F[1], -1, 1)) : 0, right = upright && len(fh) > 0.5 && len(want) > 0.5 ? Math.atan2(dot(want, rh), dot(want, fh)) : 0;
  // (straight behind it, either way round is as near: to the right, so the arrow does not flicker)
  if (Math.abs(Math.abs(right) - Math.PI) < 0.05) right = Math.PI;
  const k = { forward: glow(to[0], G.move), reverse: glow(-to[0], G.move), right: glow(to[2], G.move), left: glow(-to[2], G.move), up: glow(to[1], G.rise), down: glow(-to[1], G.rise),
    rollRight: glow(roll * deg, G.roll), rollLeft: glow(-roll * deg, G.roll), noseUp: glow(up * deg, G.turn), noseDown: glow(-up * deg, G.turn), noseRight: glow(right * deg, G.turn), noseLeft: glow(-right * deg, G.turn) };
  // (not the right way up: the roll alone, by its own key)
  if (!upright) for (const n in k) if (n !== 'rollLeft' && n !== 'rollRight') k[n] = 0;
  if (S.landed) { for (const n in k) k[n] = 0; if (!canGetUp(S)) { const w = guideOf({ ...S, landed: false }, set).keys; for (const n of ['forward', 'reverse', 'left', 'right']) k[n] = w[n]; k.up = G.lift; } }
  const mouse = { up: set.invertY ? k.noseDown : k.noseUp, down: set.invertY ? k.noseUp : k.noseDown, left: k.noseLeft, right: k.noseRight };
  const sx = k.right - k.left, sy = k.reverse - k.forward, sl = Math.hypot(sx, sy);
  return { to, turn: [up, right], roll, flat, near, keys: k, mouse, stick: { x: sl > 1e-6 ? sx / sl : 0, y: sl > 1e-6 ? sy / sl : 0, k: Math.min(1, Math.max(k.right, k.left, k.reverse, k.forward)) }, done: Object.values(k).every((v) => v === 0) };
}
// IS IT LANDING? (src/flying.js: the guide's goal life size is shown from behind only then: the game's maker, 2026-11-20,
// DASH2-2, "It's only for landing, so it should only be there when in the process of landing."): coming in to set down
// in its hangar, until it is down. goal: the flying's ('leave' | 'land' | 'free': the lab, landing once it has been
// clear of the station, everClear); field: at the rocks (no pad: never)
export function isLanding(S, { goal, everClear = false, field = false }) {
  return !field && !S.landed && (goal === 'land' || (goal === 'free' && everClear));
}
// where a point of the station is drawn in the guide's small space: the ship's own frame [ahead, up, right], shrunk the
// more the further off it is (1: the edge of the space, never reached); close by, true to the small model's own size
export function guideAt(S, p) { const r = unturn(S.q, sub(p, S.p)), d = len(r), g = d > 1e-9 ? 1 / (d + GUIDE.space) : 0; return [r[0] * g, r[1] * g, r[2] * g]; }
// how the goal is turned as the ship sees it: its nose, its top and its right, each in the ship's own frame
export function guideTurn(S) { const q0 = parkedTurn(S.cfg); return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v) => unturn(S.q, S.cfg.q0 ? turn(q0, v) : v)); }

// ── the help corner: what the keys do, by mode ──
// mode: 'seat' (on the pad), 'fly' (the mouse flies), 'pointer' (the mouse is a pointer), 'watch' (the autopilot has
// it, or a crew member who is not the pilot). -> [[key, words], ...]
// touch: a phone has no keys: each line names the button or the stick on the screen instead
// getUp: the ship is down where the seat lets them out (the seat's own prompt says so too)
// field: out at the rocks: nothing to land on and no autopilot of its own there (a tapped rock is where the autopilot
// flies, in the drill's view); task: the words of the button that switches back to the drill, for whoever has it
export function helpFor(mode, { pilot = true, auto = false, behind = false, canJump = false, touch = false, getUp = false, field = false, task = '', dock = false } = {}) {
  const view = [touch ? 'View' : 'V', behind ? 'See from the cockpit' : 'See from behind'], look = behind && !touch ? [['R', 'Hold: look round the ship']] : [];
  if (field && pilot && !auto) {
    const back = task ? [[touch ? task : 'M', touch ? 'Stop flying: back to the drill' : task]] : [], claw = [['', 'Fly up to a rock: the claw takes it']];
    if (touch) return [...claw, ['Fly', 'Left stick: forward, back, left, right'], ['Nose', 'Right stick: point the nose'], ['Up Down', 'Hold: up, down'], ['Roll', 'Hold: roll'], view, ...back];
    return [...claw, ...(mode === 'pointer' ? [['F', 'Fly with the mouse']] : [['Mouse', 'Point the nose'], ['F', 'Free the mouse for the buttons']]), ['W S', 'Forward, back'], ['A D', 'Left, right'], ['Space C', 'Up, down'], ['Q E', 'Roll'], view, ...look, ...back];
  }
  const out = getUp ? [[touch ? 'Get up' : 'E', 'Get up out of the seat']] : [];
  if (!pilot) return [['', 'The crew\'s pilot is flying'], ...out, view, ...look];
  const autoLine = [touch ? 'Autopilot' : 'T', auto ? 'Autopilot off: fly it yourself' : 'Autopilot: it flies for you'], jump = canJump ? [[touch ? 'Jump' : 'J', 'Jump']] : [];
  if (auto) return [['', 'The autopilot is flying'], autoLine, view, ...look, ...jump];
  // (dock: a ship that is docked, not standing on a floor: the same key undocks it)
  if (mode === 'seat' && dock) return touch ? [...out, ['Power', 'Switch the ship on or off'], ['Undock', 'Hold it: off the bridge'], autoLine, view] : [...out, ['P', 'Power'], ['Space', 'Undock'], autoLine, view];
  if (mode === 'seat') return touch ? [...out, ['Power', 'Switch the ship on or off'], ['Lift off', 'Hold it: up off the floor'], autoLine, view] : [...out, ['P', 'Power'], ['Space', 'Lift off'], autoLine, view];
  if (touch) return [['Fly', 'Left stick: forward, back, left, right'], ['Nose', 'Right stick: point the nose'], ['Up Down', 'Hold: up, down'], ['Roll', 'Hold: roll'], autoLine, view, ...jump];
  const keys = [['W S', 'Forward, back'], ['A D', 'Left, right'], ['Space C', 'Up, down'], ['Q E', 'Roll']];
  const mouse = mode === 'pointer' ? [['F', 'Fly with the mouse']] : [['Mouse', 'Point the nose'], ['F', 'Free the mouse for the buttons']];
  return [...mouse, ...keys, autoLine, view, ...look, ...jump];
}
