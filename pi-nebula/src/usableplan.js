// WHAT CAN BE USED, WITH THE MOUSE: THE PLAIN RULES (src/usable.js draws them in; nothing of three.js here, so they are
// tested in Node: tests/usable.test.mjs). The game's maker, 2026-11-26: "It should also either say "E" above it or
// change the cursor to a pointer when moused over (which should be the default for interactivity for the game)", and
// of everything that can be used: "I think having interactivity with the mouse cursor or E button makes sense and would
// be nice to have."
//
// Every thing a player can use (the ship store's kiosk, the jobs board, a job's desk, a person, a seat aboard, ...)
// hands itself over once: its shape (or shapes), when it is in reach (the same rule that brings its prompt up), and
// what its E key does. While it is in reach, the mouse over its shape is a hand, and a click there does what E does.
// Away from it, or over nothing that can be used, the cursor is left as it is. The prompt and the E key stay as they
// are; a finger never comes here (a phone keeps its own buttons).
//
//   const U = makeUsableCore({ hit, cursor })
//     hit(shape, x, y) -> how far off along the view the shape is under the page point (x, y), or null if it is not
//     cursor(on)       the hand on or off (called only when it changes)
//   U.add({ name, ready, shape, use }) -> a function that takes it away again
//     ready()   true while it is in reach and could be used now (its prompt is up): only these are ever tested
//     shape     what the mouse must be over: a shape hit() knows, a list of them, or a function giving one or a list
//               (asked only while ready)
//     held      true: it can be used while the player is held still (sitting or lying aboard: the walking keys and
//               the view's own clicks are off then, frame(.., .., true) and click(.., { held: true }) ask only these)
//     use(x, y) what its E key does (x, y: where it was clicked); left out: the thing takes its own clicks (a hand is shown, the click is its own)
//   U.move(x, y) / U.leave()   the mouse moved over the view, or went off it (onto a panel, out of the window)
//   U.frame(viewChanged, blocked)   once a frame: tested again only if the mouse moved, the view changed or what is in
//               reach changed; blocked: nothing is used just now (a panel up, the view being dragged, the pointer locked)
//   U.click(x, y, { touch, moved, blocked }) -> the thing used, or null: a mouse click that was no drag, on the view
//   U.which(x, y) the thing in reach under a point (nothing used)
//   U.over      the thing the mouse is over now (in reach), or null;  U.stats: how many tests, how long they took
//
// THE OTHER WAY (out of reach: the game's maker's to decide, QUESTIONS.md): a thing could also be shown from afar, its
// click walking the player up to it and using it there. That would be a second "ready" (far) and a walk before use();
// the rest of this stays as it is.

// a press that moves less than this is a click, not a drag (pixels): the game's own line (shared/input.js DRAG_PX)
export const USE = { dragPx: 6 };

// a press let go: a click (true) or a drag or a finger (false)
export const isClick = ({ touch = false, moved = 0, button = 0 } = {}, dragPx = USE.dragPx) => !touch && button === 0 && moved <= dragPx;

// the nearest of the things under the point, among those in reach: { thing, d } or null
export function nearestUnder(things, x, y, hit) {
  let best = null;
  for (const T of things) {
    let s = typeof T.shape === 'function' ? T.shape() : T.shape;
    if (s == null) continue;
    if (!Array.isArray(s)) s = [s];
    for (const one of s) {
      if (one == null) continue;
      const d = hit(one, x, y);
      if (d != null && Number.isFinite(d) && (!best || d < best.d)) best = { thing: T, d };
    }
  }
  return best;
}

export function makeUsableCore({ hit, cursor = () => {}, clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) }) {
  const things = [];
  let mouse = null, dirty = false, over = null, hand = false, readyKey = '';
  const stats = { tests: 0, ms: 0, frames: 0, used: 0, last: null };
  const setHand = (on) => { if (on === hand) return; hand = on; cursor(on); };
  // (the things in reach now: their names joined, so a change is seen without a test)
  const readyNow = (held = false) => things.filter((T) => { if (held && !T.held) return false; try { return !!T.ready(); } catch (e) { return false; } });
  function test(list, x, y) {
    const t0 = clock(); stats.tests++;
    const r = nearestUnder(list, x, y, hit);
    stats.ms += clock() - t0;
    return r ? r.thing : null;
  }
  const U = {
    stats,
    get over() { return over; },
    get hand() { return hand; },
    get count() { return things.length; },
    add(T) {
      const it = { name: T.name || 'thing', ready: T.ready || (() => false), shape: T.shape, use: T.use || null, held: !!T.held };
      things.push(it); dirty = true;
      return () => { const i = things.indexOf(it); if (i >= 0) things.splice(i, 1); if (over === it) over = null; dirty = true; };
    },
    move(x, y) { mouse = { x, y }; dirty = true; },
    leave() { mouse = null; dirty = true; },
    frame(viewChanged = false, blocked = false, held = false) {
      stats.frames++;
      if (blocked || !mouse) { over = null; setHand(false); readyKey = ''; return null; }
      const list = readyNow(held), key = list.map((T) => T.name).join('|');
      if (!list.length) { over = null; setHand(false); readyKey = ''; dirty = false; return null; }
      if (dirty || viewChanged || key !== readyKey) { readyKey = key; dirty = false; over = test(list, mouse.x, mouse.y); }
      setHand(!!over);
      return over;
    },
    click(x, y, { touch = false, moved = 0, button = 0, blocked = false, held = false } = {}) {
      if (blocked || !isClick({ touch, moved, button })) return null;
      const list = readyNow(held); if (!list.length) return null;
      const T = test(list, x, y);
      if (!T) return null;
      stats.last = T.name; if (T.use) { stats.used++; over = null; setHand(false); dirty = true; T.use(x, y); }
      return T;
    },
    // (the thing in reach under a point, nothing used: for the rigs)
    which(x, y) { const list = readyNow(); return list.length ? test(list, x, y) : null; },
    names: () => things.map((T) => T.name),
    readyNames: () => readyNow().map((T) => T.name),
  };
  return U;
}
