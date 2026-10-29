// INPUT: the keyboard, the mouse and touch, read into one plain shape that the player and the camera use each frame.
//
//   const I = makeInput(canvas, { camera })
//     I.move        { x, y, mag }: where the player is pushing, x to the right and y forward, each -1..1 (WASD or the
//                   arrows, or the thumb stick); mag: how hard, 0..1 (keys are always 1, the stick in between)
//     I.run         true while Shift is held, or the stick is pushed out to its edge (run on foot, gallop on a horse)
//     I.takeLook()  -> { dx, dy } pixels dragged to look around since last asked (the camera takes them each frame)
//     I.look        { dx, dy } dragged so far and not yet taken (a look only: it doesn't take them)
//     I.takeZoom()  -> wheel steps since last asked (+ out, - in); a pinch with two fingers on the view counts too
//                   (spread: in; closer: out)
//     I.lookedAt    when the view was last dragged (performance.now() ms): the camera swings back behind 1.5 s after
//     I.tap(code)   true once for each press of a key since it was last asked (KeyE, KeyH, Escape, ...): read it, it's used
//     I.held(code)  true while a key is down
//     I.press(code) a press made by a button on screen (a touch button for the horse calls I.press('KeyH'))
//     I.pick        the clicks and taps on the 3D view, oldest first: { x, y, hit, touch, time }; hit is the nearest
//                   registered target under the pointer ({ object, data, point, distance }) or null. Take them with
//                   I.pick.shift(); only the last 8 are kept
//     I.onPick(fn)  fn(pick) as each click lands, as well as the queue; returns a function that stops it
//     I.addTarget(object, data)  something a click can pick (a steer, a bandit): its meshes are tested exactly, and a
//                   click just beside it still counts (its outline on screen, padded a few pixels: more for a finger).
//                   Returns a function that takes it away again; I.removeTarget(object) does too
//     I.pickAt(x, y) the target under a point on the page (client pixels), or null
//     I.camera      the camera picks are worked out through (set it any time)
//     I.enabled     false while a panel is open over the game: everything held is let go, nothing is read
//     I.touch       true once the page has been touched (the game can show its touch buttons)
//     I.dispose()
//
// Touch: a thumb stick appears wherever the left thumb lands on the left part of the screen (push it out to its edge to
// run or gallop); dragging on the right part looks around; a quick tap anywhere picks what is under it. Keys are left
// alone while typing in a text box (a dog's name), and Ctrl/Cmd + a key is the browser's.
import * as THREE from 'three';

const MOVE_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const DRAG_PX = 6;            // a press that moves less than this is a click, not a drag (pixels)
const TAP_MS = 450;           // ... and a touch held longer than this isn't a tap
const STICK_R = 56;           // the thumb stick's reach in pixels; past 92% of it is "run"
const STICK_SIDE = 0.42;      // the left part of the screen (a fraction of its width) where a thumb makes a stick
const PAD_MOUSE = 10, PAD_TOUCH = 26;   // how far beside a target's outline a click still picks it (pixels)
const PINCH_PX = 40;          // pixels two fingers spread (or close) for one of the wheel's steps of zoom

export function makeInput(canvas, { camera = null } = {}) {
  const down = new Set();                 // keys held
  const taps = new Map();                 // key -> when it was pressed, until it is read
  const look = { dx: 0, dy: 0 };
  let zoom = 0;
  const targets = new Map();              // object -> data
  const listeners = new Set();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const I = {
    // (touch is also true from the start on a phone or tablet, so its buttons and words show before the first touch)
    move: { x: 0, y: 0, mag: 0 }, run: false, lookedAt: -1e9, pick: [], camera, dragging: false,
    touch: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints || 0) > 0,
    get look() { return { dx: look.dx, dy: look.dy }; },
    get enabled() { return enabled; },
    set enabled(on) { enabled = !!on; if (!enabled) letGo(); },
  };
  let enabled = true;

  // ── KEYS ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const typing = (e) => { const t = e.target; return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')); };
  function onKeyDown(e) {
    if (!enabled || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (MOVE_KEYS[e.code] || e.code === 'Space') e.preventDefault();            // (the arrows and space would scroll the page)
    if (!e.repeat) taps.set(e.code, performance.now());
    down.add(e.code); readKeys();
  }
  function onKeyUp(e) { down.delete(e.code); readKeys(); }
  function readKeys() {
    let x = 0, y = 0;
    for (const k of down) { const m = MOVE_KEYS[k]; if (m) { x += m[0]; y += m[1]; } }
    x = Math.max(-1, Math.min(1, x)); y = Math.max(-1, Math.min(1, y));
    if (!stick.id) { const L = Math.hypot(x, y); I.move.x = L ? x / L : 0; I.move.y = L ? y / L : 0; I.move.mag = L ? 1 : 0; }
    I.run = down.has('ShiftLeft') || down.has('ShiftRight') || (stick.id !== null && stick.run);
  }
  I.tap = (code) => {
    const t = taps.get(code); if (t === undefined) return false;
    taps.delete(code); return performance.now() - t < 1000;                     // (a press nobody read for a second is stale)
  };
  I.held = (code) => down.has(code);
  I.press = (code) => { if (enabled) taps.set(code, performance.now()); };
  I.takeLook = () => { const r = { dx: look.dx, dy: look.dy }; look.dx = look.dy = 0; return r; };
  I.takeZoom = () => { const z = zoom; zoom = 0; return z; };

  // ── POINTERS: the mouse, and each finger ─────────────────────────────────────────────────────────────────────
  // each pointer down on the canvas: what it is doing ('look' drags the view, 'stick' is the thumb stick), where it
  // started, how far it has moved, and when it went down
  const ptrs = new Map();
  let pinchD = null;   // (two fingers' distance apart while pinching)
  const stick = { id: null, x: 0, y: 0, run: false, el: null, knob: null };
  function showStick(on, x, y) {
    if (!stick.el) {
      const el = stick.el = document.createElement('div'), knob = stick.knob = document.createElement('div');
      el.style.cssText = `position:fixed;width:${STICK_R * 2}px;height:${STICK_R * 2}px;margin:-${STICK_R}px 0 0 -${STICK_R}px;border-radius:50%;`
        + 'border:2px solid rgba(255,240,215,.55);background:rgba(40,28,16,.22);pointer-events:none;z-index:20;display:none';
      knob.style.cssText = 'position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;'
        + 'background:rgba(255,240,215,.55);box-shadow:0 1px 6px rgba(0,0,0,.4)';
      el.appendChild(knob); document.body.appendChild(el);
    }
    stick.el.style.display = on ? 'block' : 'none';
    if (on) { stick.el.style.left = x + 'px'; stick.el.style.top = y + 'px'; stick.knob.style.transform = ''; }
  }
  function onDown(e) {
    if (!enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    const touch = e.pointerType !== 'mouse';
    if (touch) I.touch = true;
    let mode = 'look';
    if (touch && stick.id === null && e.clientX < innerWidth * STICK_SIDE) {
      mode = 'stick'; stick.id = e.pointerId; stick.x = e.clientX; stick.y = e.clientY; stick.run = false; showStick(true, e.clientX, e.clientY);
    }
    ptrs.set(e.pointerId, { mode, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: 0, t0: performance.now(), touch, button: e.button });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* (a pointer that already went away) */ }
    if (touch) e.preventDefault();
  }
  function onMove(e) {
    const p = ptrs.get(e.pointerId); if (!p || !enabled) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.x0, e.clientY - p.y0));
    if (p.mode === 'stick') {
      let sx = (e.clientX - stick.x) / STICK_R, sy = -(e.clientY - stick.y) / STICK_R; const L = Math.hypot(sx, sy);
      if (L > 1) { sx /= L; sy /= L; }
      I.move.x = sx; I.move.y = sy; I.move.mag = Math.min(1, L);
      stick.run = L > 0.92; I.run = stick.run || down.has('ShiftLeft') || down.has('ShiftRight');
      stick.knob.style.transform = `translate(${sx * STICK_R}px, ${-sy * STICK_R}px)`;
    } else {
      // (two fingers on the view: a pinch zooms the camera, in to first person and out again; it doesn't look about)
      const two = p.touch ? [...ptrs.values()].filter((q) => q.mode === 'look' && q.touch) : [];
      if (two.length >= 2) {
        const d = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
        if (pinchD != null) zoom += Math.max(-3, Math.min(3, -(d - pinchD) / PINCH_PX));
        pinchD = d; for (const q of two) q.pinch = true;
        return;
      }
      if (p.moved > DRAG_PX && !p.pinch) { look.dx += dx; look.dy += dy; I.lookedAt = performance.now(); I.dragging = true; }
    }
  }
  function onUp(e) {
    const p = ptrs.get(e.pointerId); if (!p) return;
    ptrs.delete(e.pointerId);
    if (p.pinch) pinchD = null;
    if (p.mode === 'stick') { stick.id = null; stick.run = false; showStick(false); readKeys(); }
    if (![...ptrs.values()].some((q) => q.mode === 'look' && q.moved > DRAG_PX)) I.dragging = false;
    // a click: pressed and let go without dragging (a tap: quickly, too); the left mouse button only
    const quick = !p.touch || performance.now() - p.t0 < TAP_MS;
    if (enabled && e.type === 'pointerup' && p.moved <= DRAG_PX && quick && !p.pinch && (p.touch || p.button === 0)) addPick(e.clientX, e.clientY, p.touch);
  }
  function onWheel(e) {
    if (!enabled) return; e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    zoom += Math.max(-3, Math.min(3, d / 100));
  }
  const noMenu = (e) => e.preventDefault();
  function letGo() {
    down.clear(); taps.clear(); readKeys(); I.move.x = I.move.y = I.move.mag = 0; I.run = false;
    look.dx = look.dy = 0; zoom = 0; ptrs.clear(); pinchD = null; stick.id = null; stick.run = false; showStick(false); I.dragging = false;
  }

  // ── PICKING ─────────────────────────────────────────────────────────────────────────────────────────────────
  I.addTarget = (object, data = object) => { targets.set(object, data); return () => targets.delete(object); };
  I.removeTarget = (object) => targets.delete(object);
  I.onPick = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const _box = new THREE.Box3(), _v = new THREE.Vector3(), _c = new THREE.Vector3();
  I.pickAt = (x, y, touch = false) => {
    const cam = I.camera; if (!cam || !targets.size) return null;
    const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return null;
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    cam.updateMatrixWorld(); ray.setFromCamera(ndc, cam);
    // first, exactly: the nearest target whose shape the ray passes through
    const objs = [...targets.keys()].filter((o) => o.visible !== false && o.parent);
    let best = null;
    for (const h of ray.intersectObjects(objs, true)) {
      let o = h.object; while (o && !targets.has(o)) o = o.parent;
      if (o) { best = { object: o, data: targets.get(o), point: h.point.clone(), distance: h.distance }; break; }
    }
    if (best) return best;
    // else the nearest target whose outline on screen (padded) the point is in: a near miss still counts
    const pad = touch ? PAD_TOUCH : PAD_MOUSE; let bestD = Infinity;
    for (const o of objs) {
      _box.setFromObject(o); if (_box.isEmpty()) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
      for (let i = 0; i < 8; i++) {
        _v.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).project(cam);
        if (_v.z > 1) { behind = true; break; }
        const sx = r.left + (_v.x + 1) / 2 * r.width, sy = r.top + (1 - _v.y) / 2 * r.height;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      if (behind || x < x0 - pad || x > x1 + pad || y < y0 - pad || y > y1 + pad) continue;
      const d = Math.hypot(x - (x0 + x1) / 2, y - (y0 + y1) / 2);
      if (d < bestD) { bestD = d; _box.getCenter(_c); best = { object: o, data: targets.get(o), point: _c.clone(), distance: _c.distanceTo(cam.position), near: true }; }
    }
    return best;
  };
  function addPick(x, y, touch) {
    const p = { x, y, touch, time: performance.now(), hit: I.pickAt(x, y, touch) };
    I.pick.push(p); while (I.pick.length > 8) I.pick.shift();
    for (const fn of listeners) { try { fn(p); } catch (err) { console.error(err); } }
  }

  // ── WIRING ──────────────────────────────────────────────────────────────────────────────────────────────────
  canvas.style.touchAction = 'none';
  addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp);
  const onBlur = () => letGo();
  addEventListener('blur', onBlur);
  const onHidden = () => { if (document.hidden) letGo(); };
  document.addEventListener('visibilitychange', onHidden);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', noMenu);
  I.dispose = () => {
    removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onHidden);
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('lostpointercapture', onUp); canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', noMenu);
    if (stick.el) stick.el.remove(); targets.clear(); listeners.clear();
  };
  return I;
}
