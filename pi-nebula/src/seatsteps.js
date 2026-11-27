// SITTING DOWN AND GETTING UP, as a person does (four blind critics, 2026-11-26: sitting down began in mid-air beside
// the seat, the legs passing through the stool, then a snap onto it; getting up went straight upward). A person steps
// to the seat, turns their back to it, and lowers themselves onto it leaning forward; to get up they lean forward over
// their feet, rise, and step away the way they came. The big scanner's bed (src/onbed.js) shows the care wanted.
//
//   seatSteps(seat) -> { down: [step, ...], up: [step, ...] }
//     seat: { seat: [x, y, z] (where they sit), heading (the way they face sitting), pos: [x, y, z] (where they stand
//            to sit down: in front of a bench, beside a desk chair, behind a stool) }
//     step: { move, to: [x, y, z], heading, secs }   move: 'walk' (forward), 'back' (stepping backward), 'side' (a
//            step sideways: dir -1 to their left, 1 to their right), 'turn' (on the spot, stepping round), 'lower' (onto
//            the seat), 'rise' (up off it)
//   Sitting down: (a stool's, from behind it: round to its side first, walking) turned to face the way the seat faces,
//   stepped back or across to just in front of it (SIT.pre), then lowered onto it, leaning forward. Getting up: the
//   same backward: up off it, leaning forward, then back to where they stood the way they came.
//   leanOf(step, u) -> radians the body leans forward at `u` (0 to 1) through a step (moves.js M.lean)
export const SIT = {
  pre: 0.24,          // (m in front of the seat's middle: where they stand, their back to it, before they sit: their
                      // shins just clear of a chair's cushion, 0.14 put them through it)
  round: 0.46,        // (m out to a stool's side, walked to first when they come from behind it)
  speed: 0.55,        // (m/s stepping back or across)
  turn: 3.2,          // (radians a second turning on the spot)
  lower: 1.05, rise: 0.95,     // (s: lowering onto the seat, rising off it)
  lean: [0.42, 0.55], // (radians leaning forward at the middle of lowering, of rising)
  least: 0.3,         // (s: no step shorter)
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dist = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);
const A = (v) => (Array.isArray(v) ? v : [v.x, v.y, v.z]);

export function seatSteps(S) {
  const seat = A(S.seat), stand = A(S.pos), h = S.heading;
  const f = [Math.sin(h), 0, Math.cos(h)], left = [Math.cos(h), 0, -Math.sin(h)];
  const pre = [seat[0] + f[0] * SIT.pre, stand[1], seat[2] + f[2] * SIT.pre];
  const v = sub(stand, seat), along = v[0] * f[0] + v[2] * f[2], across = v[0] * left[0] + v[2] * left[2];
  const down = [];
  let at = stand, hd = null;
  // (from behind the seat (a stool, its table in front of it): round to its side first, walking)
  if (along < -0.1) {
    const s = across >= 0 ? 1 : -1, side = [seat[0] + left[0] * s * SIT.round + f[0] * 0.1, stand[1], seat[2] + left[2] * s * SIT.round + f[2] * 0.1];
    const hw = Math.atan2(side[0] - at[0], side[2] - at[2]);
    down.push({ move: 'walk', to: side, heading: hw, secs: Math.max(SIT.least, dist(at, side) / SIT.speed) });
    at = side; hd = hw;
  }
  // (turned to face the way the seat faces, stepping round)
  down.push({ move: 'turn', to: at, heading: h, secs: Math.max(SIT.least, hd == null ? 0.5 : Math.abs(wrap(h - hd)) / SIT.turn) });
  // (to just in front of it, their back to it: back, or across)
  const d = sub(pre, at), fa = d[0] * f[0] + d[2] * f[2], la = d[0] * left[0] + d[2] * left[2];
  const move = Math.abs(fa) >= Math.abs(la) ? (fa < 0 ? 'back' : 'walk') : 'side';
  const step = { move, to: pre, heading: h, secs: Math.max(SIT.least, dist(at, pre) / SIT.speed) };
  if (move === 'side') step.dir = la > 0 ? -1 : 1;
  down.push(step);
  down.push({ move: 'lower', to: [seat[0], seat[1], seat[2]], heading: h, secs: SIT.lower });
  // getting up: the same backward
  const up = [{ move: 'rise', to: pre, heading: h, secs: SIT.rise }];
  for (let i = down.length - 2; i >= 0; i--) {
    const s = down[i], from = i ? down[i - 1].to : stand;
    if (s.move === 'turn') continue;
    const back = { ...s, to: from };
    if (s.move === 'back') back.move = 'walk';
    else if (s.move === 'side') back.dir = -s.dir;
    else if (s.move === 'walk' && i === 0 && down[0] !== step) { back.heading = Math.atan2(from[0] - s.to[0], from[2] - s.to[2]); up.push({ move: 'turn', to: s.to, heading: back.heading, secs: Math.max(SIT.least, Math.abs(wrap(back.heading - h)) / SIT.turn) }); }
    up.push(back);
  }
  return { down, up };
}

// how far forward the body leans at u (0 to 1) through a step: lowering, most just before the seat is reached; rising,
// most as the weight comes off it
export function leanOf(step, u) {
  if (step.move === 'lower') return SIT.lean[0] * Math.sin(Math.min(1, u * 1.15) * Math.PI);
  if (step.move === 'rise') return SIT.lean[1] * Math.sin(Math.min(1, u * 1.25 + 0.1) * Math.PI) * (u < 0.85 ? 1 : (1 - u) / 0.15);
  return 0;
}

// GETTING ON AND OFF A RIDE-ON (Cargo's forklift: its seat on a box about a metre up, its deck in front of the seat
// nearly as high: the game's maker's own model). Beside it they turn to face the way it faces (MOUNT.turn of the
// whole), climb up and across onto it, standing on it over the seat (to MOUNT.climb), then sit down onto the seat
// leaning forward; getting off, the very same the other way round (up off the seat leaning forward, across and down,
// turned to face the way they will walk). They used to rise up and across already sitting, their legs through its side.
//   mountAt(k, on, floorY, seatY) -> { turn, across (0 to 1 of the way from beside it to the seat), y (their root's
//   height), clip ('stand' | 'walk' | 'sit'), lean (radians) }   k: 0 to 1 through getting on (on) or off (!on)
export const MOUNT = { turn: 0.25, climb: 0.68, deck: 0.37, lean: [0.38, 0.5] };
const ease2 = (u) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };
export function mountAt(k, on, floorY, seatY) {
  const q = on ? k : 1 - k, top = seatY + MOUNT.deck;
  if (q < MOUNT.turn) return { turn: ease2(q / MOUNT.turn), across: 0, y: floorY, clip: 'stand', lean: 0 };
  if (q < MOUNT.climb) { const a = ease2((q - MOUNT.turn) / (MOUNT.climb - MOUNT.turn)); return { turn: 1, across: a, y: floorY + (top - floorY) * a, clip: 'walk', lean: 0.1 * Math.sin(a * Math.PI) }; }
  const u = ease2((q - MOUNT.climb) / (1 - MOUNT.climb));
  return { turn: 1, across: 1, y: top - MOUNT.deck * u, clip: on ? 'sit' : 'stand', lean: MOUNT.lean[on ? 0 : 1] * Math.sin(u * Math.PI) };
}
