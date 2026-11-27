// MATHBALL'S HANDS: a finger or the mouse on the court, read into what it means: a TAP (a ball run to and picked up, a
// goal thrown at), or a DRAG that turns the view. index.js feeds it the page's pointer events and asks it what a tap
// picks (chooseTap); it is plain numbers, so node tests it (tests/mathball-hands.test.mjs).
//
// THE GAME'S MAKER (2026-11-26): "It would be nice (especially for mobile) if when you clicked on a ball then you would
// run over to it and grab it" and "I think it would be better to have the camera just be manual movements (like
// swiping or dragging sideways to move the camera) and no automatic rotations." And the brief: a tap never turns into
// a drag of the view or a throw by mistake, and a drag never grabs.
//
// - A TAP is a press that moves no more than HANDS.slop and, for a finger, lifts within HANDS.tapMs (a real finger
//   wanders a few pixels as it taps: the shared input's 6 pixels made many a tap a little drag of the view). A tap that
//   was held a while is still a tap: on a ball it grabs, on a goal it throws, on empty floor it does nothing.
// - What a tap picks: chooseTap, below (the ball under the finger as it came down first; with a ball in hand, a goal
//   on or just beside the tap throws, and the wide reach for a ball is for empty hands only).
// - Only a DRAG turns the view: a press that moved past the slop, by the mouse or a finger on the right part of a
//   phone's screen (the left part is the walking stick's). A drag never picks anything; two fingers (a pinch) neither.
//   viewTurn is the one place the view's turn changes; its only other change is turnToward, a goal's button pressed
//   for a goal out of view (FRONT.buttonTurns in index.js: the game's maker's question 1).
// - AIMING BY A RESTED FINGER (HANDS.aimByRest, off: the game's maker's question 2): with it on, a ball in hand, a
//   finger held truly still (within HANDS.restSlop) for HANDS.hold and then moved aims: the arc follows it and lifting
//   it throws. Off, a drag always turns the view, and a ball is thrown by a tap on a goal or a goal's button.
export const HANDS = {
  slop: { touch: 12, mouse: 6 },        // px a press may move and still be a tap
  tapMs: { touch: 800, mouse: Infinity },   // ms: a finger held longer than this is no tap (a mouse click has no limit)
  reach: { touch: 44, mouse: 22 },      // px beyond a ball's edge on the screen that a tap still picks it (empty hands)
  onIt: { touch: 16, mouse: 6 },        // px beyond a ball's edge, where the finger came down, that still picks it (empty hands)
  aimByRest: false,                     // the game's maker's question 2 (B: true)
  hold: 280, restSlop: 4,               // with aimByRest: ms a finger rests, within this many px, before it aims
  past: 0.35,                           // s of where each ball was that a tap still counts
  stick: 0.42,                          // the left part of a phone's screen, where a thumb makes the walking stick
  turn: 0.0052, lift: 0.006,            // radians of the view's turn (and its tilt) for each pixel dragged
};

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the pointers on the court: down/move/up, each returning what it means (t: the event's own time stamp, ms)
//   down(id, { x, y, t, touch, button, width, aimable })  aimable: a ball in hand (a finger may aim, with aimByRest)
//   move(id, x, y, t) -> { turn: [dx, dy] } | { aim: [x, y] } | null
//   up(id, x, y, t)   -> { tap: { x, y, touch, from } } | { aimed: [x, y] } | null      (from: where the press began)
//   tick(t)           -> [{ aim: [x, y], id }] for fingers that have just rested long enough to aim
//   cancel(id), reset()   a pointer gone (cancelled), or all of them (the page lost the focus): nothing comes of it
//   aiming, dragging  true while a finger aims / a drag turns the view
export function makeHands(H = HANDS) {
  const P = new Map();
  let stickId = null;
  const others = (id) => [...P.entries()].filter(([k, p]) => k !== id && p.touch && p.mode !== 'stick' && p.mode !== 'walk');
  const api = {
    get pointers() { return P; },
    down(id, { x, y, t, touch = false, button = 0, width = 1000, aimable = false }) {
      let mode = 'press';
      if (touch && stickId == null && x < width * H.stick) { mode = 'stick'; stickId = id; }
      const p = { id, x0: x, y0: y, x, y, t0: t, touch, button, mode, moved: 0, restEnd: null, aimable: H.aimByRest && touch && aimable && mode === 'press' };
      P.set(id, p);
      // (a second finger on the view: a pinch, never a tap, a turn or an aim)
      if (mode === 'press' && touch) { const o = others(id); if (o.length) { p.mode = 'pinch'; for (const [, q] of o) q.mode = 'pinch'; } }
      return p.mode;
    },
    move(id, x, y, t) {
      const p = P.get(id); if (!p) return null;
      const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y;
      p.moved = Math.max(p.moved, Math.hypot(x - p.x0, y - p.y0));
      if (p.restEnd == null && p.moved > H.restSlop) p.restEnd = t;   // (when the finger stopped being still)
      const slop = p.touch ? H.slop.touch : H.slop.mouse;
      if (p.mode === 'stick') { if (p.moved > slop) p.mode = 'walk'; return null; }
      if (p.mode === 'press' && p.moved > slop) {
        // (a finger that rested truly still before it moved aims, with aimByRest; else it turns the view; the slop
        // itself is not turned by, so the view never jumps as the drag begins)
        p.mode = p.aimable && (p.restEnd ?? t) - p.t0 >= H.hold ? 'aim' : 'drag';
        return p.mode === 'aim' ? { aim: [x, y] } : null;
      }
      if (p.mode === 'drag') return { turn: [dx, dy] };
      if (p.mode === 'aim') return { aim: [x, y] };
      return null;
    },
    tick(t) {
      const out = [];
      for (const p of P.values()) if (p.mode === 'press' && p.aimable && p.moved <= H.restSlop && t - p.t0 >= H.hold) { p.mode = 'aim'; out.push({ id: p.id, aim: [p.x, p.y] }); }
      return out;
    },
    up(id, x, y, t) {
      const p = P.get(id); if (!p) return null;
      api.move(id, x, y, t); P.delete(id);
      if (id === stickId) stickId = null;
      const slop = p.touch ? H.slop.touch : H.slop.mouse, quick = t - p.t0 <= (p.touch ? H.tapMs.touch : H.tapMs.mouse);
      // (a press that never moved past the slop is a tap, however long, up to the tap's limit: never an aim's throw)
      if ((p.mode === 'press' || p.mode === 'stick' || p.mode === 'aim') && p.moved <= slop) return quick && (p.touch || p.button === 0) ? { tap: { x, y, touch: p.touch, from: [p.x0, p.y0] } } : null;
      if (p.mode === 'aim') return { aimed: [x, y] };
      return null;
    },
    cancel(id) { P.delete(id); if (id === stickId) stickId = null; },
    reset() { P.clear(); stickId = null; },
    get aiming() { for (const p of P.values()) if (p.mode === 'aim') return true; return false; },
    get dragging() { for (const p of P.values()) if (p.mode === 'drag') return true; return false; },
  };
  return api;
}

// the ball nearest a tap on the screen, measured from its edge (r: its radius there, px), where it is now, where it was
// as the press began (x0, y0) or a moment before (past: [[x, y], ...]: the last HANDS.past seconds, put through the
// camera AS IT IS NOW: pastOnScreen), within reach. balls: [{ id, x, y, r, x0?, y0?, past? }] (balls free to pick)
export function nearestBall(x, y, balls, reach) {
  let best = null;
  for (const b of balls) {
    let d = Math.hypot(x - b.x, y - b.y);
    if (b.x0 != null) d = Math.min(d, Math.hypot(x - b.x0, y - b.y0));
    if (b.past) for (const p of b.past) d = Math.min(d, Math.hypot(x - p[0], y - p[1]));
    d -= b.r || 0;
    if (d <= reach && (!best || d < best.d)) best = { id: b.id, d: Math.max(0, d) };
  }
  return best;
}

// the ball under a point (as the balls were then), or within `pad` px of its edge: a point inside a ball's disc beats
// any point in a margin; inside more than one disc, the NEARER ball (depth: its distance from the camera), the one
// drawn on top there (with no depth given, the disc the point is most nearly in the middle of); in the margins, the
// ball whose edge is nearest. An id or null
export function underAt(x, y, balls, pad = 0) {
  let best = null, inside = false, bk = Infinity, bz = Infinity;
  for (const b of balls) {
    const d = Math.hypot(x - b.x, y - b.y), r = Math.max(1, b.r || 0), z = b.depth ?? Infinity;
    if (d <= r) { if (!inside || z < bz || (z === bz && d / r < bk)) { inside = true; bz = z; bk = d / r; best = b.id; } }
    else if (!inside && d - r <= pad && d - r < bk) { bk = d - r; best = b.id; }
  }
  return best;
}

// WHERE EACH BALL WAS a moment ago, kept in the court (world) and put through the camera as it is at the tap: a turn
// of the view, or the camera following the player, never moves where a ball was.
//   remember(hist, t, balls, keep)   balls: [{ id, p: [x, y, z] }] this frame; hist trimmed to the last `keep` s
//   pastOnScreen(hist, toScreen) -> Map id -> [[x, y], ...]   toScreen(p) -> [x, y] or null (behind the camera)
export function remember(hist, t, balls, keep = HANDS.past) {
  hist.push({ t, balls: balls.map((b) => ({ id: b.id, p: b.p.slice() })) });
  while (hist.length && t - hist[0].t > keep) hist.shift();
  return hist;
}
export function pastOnScreen(hist, toScreen) {
  const out = new Map();
  for (const f of hist) for (const b of f.balls) { const s = toScreen(b.p); if (!s) continue; if (!out.has(b.id)) out.set(b.id, []); out.get(b.id).push(s); }
  return out;
}

// WHAT A TAP DOES, in order (the rules, as one plain function):
//   held      a ball in hand
//   underIn   the ball the finger came down INSIDE (its disc on the screen, as the balls were then), or null
//   under     the ball under the finger as it came down, inside or within onIt of its edge (underAt), or null
//   hitBall   the ball the tap is inside now (exactly under it, or inside its disc), not the one in hand, or null
//   near      nearestBall over reach: { id, d } (d: from its edge, now or a moment ago) or null (empty hands only)
//   hitGoal   the goal whose box the tap is on exactly, or null
//   goalBy    the goal just beside the tap (the floor at its mouth, or its box padded; no ball can hide it), or null
//   spot      a spot on the floor or a wall in front that a throw could go to (the mouse throws there)
// -> { pick: id } | { throw: goal } | { toss: true } | { say: 'ball first' } | null
// Empty hands: a ball under it, on it, or the nearest within reach; a goal says "a ball first". A ball in hand: only
// a ball the finger is INSIDE, now or as it came down, is swapped for (never one that lies near, or rolled past a
// moment ago); else a goal on or just beside the tap is thrown at; else (the mouse) the spot; a finger's tap on empty
// floor does nothing.
export function chooseTap({ held = false, touch = true, underIn = null, under = null, hitBall = null, near = null, hitGoal = null, goalBy = null, spot = false }, H = HANDS) {
  const reach = touch ? H.reach.touch : H.reach.mouse;
  if (held) {
    const inside = underIn ?? hitBall;
    if (inside != null) return { pick: inside };
    const g = hitGoal ?? goalBy; if (g != null) return { throw: g };
    if (!touch && spot) return { toss: true };
    return null;
  }
  if (under != null) return { pick: under };
  if (hitBall != null) return { pick: hitBall };
  if (near && near.d <= reach) return { pick: near.id };
  if (hitGoal != null || goalBy != null) return { say: 'ball first' };
  return null;
}

// THE VIEW'S TURN. viewTurn: the player's own drag (dx, dy: pixels). turnToward: a goal button's one turn (index.js,
// FRONT.buttonTurns), at `rate` radians a second; true once it faces `want`. Nothing else changes cam.yaw.
export function viewTurn(cam, dx, dy = 0, H = HANDS) {
  cam.yaw = wrapA(cam.yaw - dx * H.turn);
  cam.lift = Math.max(-1, Math.min(1, (cam.lift || 0) + dy * H.lift));
}
export function turnToward(cam, want, rate, dt) {
  const d = wrapA(want - cam.yaw);
  cam.yaw = wrapA(cam.yaw + Math.sign(d) * Math.min(Math.abs(d), rate * dt));
  return Math.abs(wrapA(want - cam.yaw)) < 1e-3;
}

// walking by the keys or the thumb stick, or running to a ball: a way on the court (dx, dz) as the stick's push for a
// view looking along `yaw` (forward up the screen), so the player goes that way and the view does not turn
export function pushFor(dx, dz, yaw) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
  return { x: dx * rx + dz * rz, y: dx * fx + dz * fz };
}
