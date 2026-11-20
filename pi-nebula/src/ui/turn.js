// THE PERSON TURNED ROUND in the character maker's window (2026-11-19; the game's maker, asked whether a still picture
// of the character was enough: "I would give it orbit controls with the real model"). The window shows the real 3D
// person (portraits.js liveShow); this is what a 3D viewer's orbit controls do, on that window:
//   a drag sideways, by the mouse or a finger: the person turns round (a finger's drag up or down still scrolls the page,
//     so on a phone the panel scrolls as ever with a thumb on the person); by the mouse up or down: seen from a little
//     above or below;
//   the mouse wheel, or two fingers apart and together: nearer, up to the face, and back;
//   from the keyboard, the window focused (Tab reaches it): Left and Right turn them round, Up and Down from above and
//     below, + and - nearer and back;
//   let go while turning and they turn on a little, slowing to a stop.
// A press that does not move is no drag. The arrows over the window are buttons of their own, beside it in the page, so
// a press on one never turns anyone.
//   const off = bindTurn(el, { get: () => view, set: (v) => ... })     (view: { yaw, pitch, zoom }, as portraits.js liveView)
export const TURN = { perPx: 0.011, pitchPerPx: 0.006, still: 4, wheel: 0.0015, pinch: 0.006, key: 0.4, keyPitch: 0.12, keyZoom: 0.25, slow: 0.9, spinMost: 0.4 };

export function bindTurn(el, { get, set, turned = null }) {
  const at = new Map();                       // the pointers down on the window: id -> { x, y }
  let drag = null, pinch = null, spin = 0, raf = 0, last = 0;
  const stopSpin = () => { if (raf) cancelAnimationFrame(raf); raf = 0; spin = 0; };
  const spinOn = (now) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
    spin *= Math.pow(TURN.slow, dt * 60);
    if (Math.abs(spin) < 0.002) { spin = 0; return; }
    set({ yaw: get().yaw + spin * dt * 60 });
    raf = requestAnimationFrame(spinOn);
  };
  const said = () => { if (turned) { const f = turned; turned = null; f(); } };
  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stopSpin();
    at.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (at.size === 2) {
      const [a, b] = [...at.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: get().zoom }; drag = null;
    } else if (at.size === 1) {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, mouse: e.pointerType === 'mouse', v: 0, t: performance.now() };
      if (drag.mouse) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* (a pointer already gone) */ } e.preventDefault(); }
    }
  };
  const move = (e) => {
    const p = at.get(e.pointerId); if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (pinch && at.size >= 2) {
      const [a, b] = [...at.values()];
      set({ zoom: pinch.zoom + (Math.hypot(a.x - b.x, a.y - b.y) - pinch.d) * TURN.pinch }); said();
      e.preventDefault(); return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < TURN.still) return;
    drag.moved = true;
    const now = performance.now(), dyaw = dx * TURN.perPx;
    drag.v = 0.6 * drag.v + 0.4 * (dyaw / Math.max(1, (now - drag.t) / (1000 / 60)));
    drag.t = now; drag.x = e.clientX; drag.y = e.clientY;
    const v = get(), next = { yaw: v.yaw + dyaw };
    if (drag.mouse) next.pitch = v.pitch + dy * TURN.pitchPerPx;
    set(next); said();
  };
  const up = (e) => {
    if (!at.has(e.pointerId)) return;
    at.delete(e.pointerId);
    if (at.size < 2) pinch = null;
    if (drag && drag.id === e.pointerId) {
      // (let go while turning: they turn on a little, unless the pointer had stopped before it let go)
      if (drag.moved && e.type === 'pointerup' && performance.now() - drag.t < 90 && Math.abs(drag.v) > 0.004) {
        spin = Math.max(-TURN.spinMost, Math.min(TURN.spinMost, drag.v)); last = 0; raf = requestAnimationFrame(spinOn);
      }
      drag = null;
    }
  };
  const wheel = (e) => {
    e.preventDefault(); stopSpin();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    set({ zoom: get().zoom - e.deltaY * k * TURN.wheel }); said();
  };
  const key = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const v = get(), K = e.key;
    let next = null;
    if (K === 'ArrowLeft') next = { yaw: v.yaw - TURN.key };
    else if (K === 'ArrowRight') next = { yaw: v.yaw + TURN.key };
    else if (K === 'ArrowUp') next = { pitch: v.pitch + TURN.keyPitch };
    else if (K === 'ArrowDown') next = { pitch: v.pitch - TURN.keyPitch };
    else if (K === '+' || K === '=') next = { zoom: v.zoom + TURN.keyZoom };
    else if (K === '-' || K === '_') next = { zoom: v.zoom - TURN.keyZoom };
    if (!next) return;
    // (the title's own arrow-key moves, between the buttons of a group, are not for here)
    e.preventDefault(); e.stopPropagation(); stopSpin();
    set(next); said();
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('wheel', wheel, { passive: false });
  el.addEventListener('keydown', key);
  // (a long press on a phone would otherwise bring up the page's own menu over the person)
  const menu = (e) => e.preventDefault();
  el.addEventListener('contextmenu', menu);
  return () => {
    stopSpin();
    for (const [n, f] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up], ['keydown', key], ['contextmenu', menu]]) el.removeEventListener(n, f);
    el.removeEventListener('wheel', wheel, { passive: false });
  };
}
