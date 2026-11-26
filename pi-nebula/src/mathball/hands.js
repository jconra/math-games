// MATHBALL'S HANDS: a finger or the mouse on the court, read into the three things it can mean: a TAP (a ball run to
// and picked up, a goal thrown at), a DRAG that turns the view, or, with a ball in hand on a phone, an AIM (a finger
// rested on the court a moment and then moved: the arc follows it, lifting it throws). index.js feeds it the page's
// pointer events; it is plain numbers, so node tests it (tests/mathball-hands.test.mjs).
//
// THE GAME'S MAKER (2026-11-26): "It would be nice (especially for mobile) if when you clicked on a ball then you would
// run over to it and grab it" and "I think it would be better to have the camera just be manual movements (like
// swiping or dragging sideways to move the camera) and no automatic rotations."
//
// - A tap is a press that moves less than HANDS.slop and lifts within HANDS.tapMs. A real finger wanders a few pixels
//   while it taps (the shared input's 6 pixels made many a tap a little drag of the view: no pick at all).
// - A tap picks the ball nearest it on the screen within HANDS.reach of the ball's edge (a finger is wide), where the
//   ball is now or where it was when the finger came down (a rolling ball moves under a finger).
// - Only a drag turns the view: a press that moved past the slop, by the mouse or a finger on the right part of a
//   phone's screen (the left part is the walking stick's). A drag never picks anything; two fingers (a pinch) neither.
//   viewTurn is the one place the view's turn changes; its only other change is turnToward, a goal's button pressed
//   for a goal out of view (FRONT.buttonTurns in index.js: the game's maker's question).
export const HANDS = {
  slop: { touch: 12, mouse: 6 },        // px a press may move and still be a tap
  tapMs: { touch: 800, mouse: 1500 },   // ms: a press held longer than this is no tap
  reach: { touch: 44, mouse: 22 },      // px beyond a ball's edge on the screen that a tap still picks it
  hold: 280,                            // ms a finger rests still on the court, a ball in hand, before it aims
  stick: 0.42,                          // the left part of a phone's screen, where a thumb makes the walking stick
  turn: 0.0052, lift: 0.006,            // radians of the view's turn (and its tilt) for each pixel dragged
};

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the pointers on the court: down/move/up, each returning what it means
//   down(id, { x, y, t, touch, button, width, aimable })  aimable: a ball in hand (a finger may aim)
//   move(id, x, y, t) -> { turn: [dx, dy] } | { aim: [x, y] } | null
//   up(id, x, y, t)   -> { tap: { x, y, touch, from } } | { aimed: [x, y] } | null      (from: the press's start)
//   tick(t)           -> [{ aim: [x, y], id }] for fingers that have just rested long enough to aim
//   cancel(id)        a pointer gone (cancelled): nothing comes of it
export function makeHands(H = HANDS) {
  const P = new Map();
  let stickId = null;
  const others = (id) => [...P.entries()].filter(([k, p]) => k !== id && p.touch && p.mode !== 'stick' && p.mode !== 'walk');
  const api = {
    get pointers() { return P; },
    down(id, { x, y, t, touch = false, button = 0, width = 1000, aimable = false }) {
      let mode = 'press';
      if (touch && stickId == null && x < width * H.stick) { mode = 'stick'; stickId = id; }
      const p = { id, x0: x, y0: y, x, y, t0: t, touch, button, mode, moved: 0, aimable: touch && aimable && mode === 'press' };
      P.set(id, p);
      // (a second finger on the view: a pinch, never a tap or a turn)
      if (mode === 'press' && touch) { const o = others(id); if (o.length) { p.mode = 'pinch'; for (const [, q] of o) q.mode = 'pinch'; } }
      return p.mode;
    },
    move(id, x, y, t) {
      const p = P.get(id); if (!p) return null;
      const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y;
      p.moved = Math.max(p.moved, Math.hypot(x - p.x0, y - p.y0));
      const slop = p.touch ? H.slop.touch : H.slop.mouse;
      if (p.mode === 'stick') { if (p.moved > slop) p.mode = 'walk'; return null; }
      if (p.mode === 'press' && p.moved > slop) {
        // (a finger that rested before it moved aims; one that moved at once turns the view; the slop itself is not
        // turned by, so the view never jumps as the drag begins)
        p.mode = p.aimable && t - p.t0 >= H.hold ? 'aim' : 'drag';
        return p.mode === 'aim' ? { aim: [x, y] } : null;
      }
      if (p.mode === 'drag') return { turn: [dx, dy] };
      if (p.mode === 'aim') return { aim: [x, y] };
      return null;
    },
    tick(t) {
      const out = [];
      for (const p of P.values()) if (p.mode === 'press' && p.aimable && t - p.t0 >= H.hold) { p.mode = 'aim'; out.push({ id: p.id, aim: [p.x, p.y] }); }
      return out;
    },
    up(id, x, y, t) {
      const p = P.get(id); if (!p) return null;
      api.move(id, x, y, t); P.delete(id);
      if (id === stickId) stickId = null;
      const slop = p.touch ? H.slop.touch : H.slop.mouse, quick = t - p.t0 <= (p.touch ? H.tapMs.touch : H.tapMs.mouse);
      if (p.mode === 'aim') return { aimed: [x, y], still: p.moved <= slop };
      if ((p.mode === 'press' || p.mode === 'stick') && p.moved <= slop && quick && (p.touch || p.button === 0)) return { tap: { x, y, touch: p.touch, from: [p.x0, p.y0] } };
      return null;
    },
    cancel(id) { P.delete(id); if (id === stickId) stickId = null; },
    // true while a drag is turning the view (or a finger aims: the view holds still under it)
    get dragging() { for (const p of P.values()) if (p.mode === 'drag') return true; return false; },
  };
  return api;
}

// the ball a tap picks: the nearest on the screen, measured from its edge (r: its radius there, px), now or where it
// was as the press began (x0, y0), within reach. balls: [{ id, x, y, r, x0?, y0? }] (only balls free to pick)
export function nearestBall(x, y, balls, reach) {
  let best = null;
  for (const b of balls) {
    let d = Math.hypot(x - b.x, y - b.y);
    if (b.x0 != null) d = Math.min(d, Math.hypot(x - b.x0, y - b.y0));
    d -= b.r || 0;
    if (d <= reach && (!best || d < best.d)) best = { id: b.id, d: Math.max(0, d) };
  }
  return best;
}

// THE VIEW'S TURN. viewTurn: the player's own drag (dx, dy: pixels). turnToward: a goal button's one turn (index.js,
// FRONT.buttonTurns), at `rate` radians a second; true once it faces `want`. Nothing else changes cam.yaw.
export function viewTurn(cam, dx, dy = 0, H = HANDS) {
  cam.yaw = wrapA(cam.yaw - dx * H.turn);
  cam.lift = Math.max(-1, Math.min(1.6, (cam.lift || 0) + dy * H.lift));
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
