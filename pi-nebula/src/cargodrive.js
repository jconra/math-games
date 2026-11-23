// THE PLAYER DRIVES CARGO'S FORKLIFT (2026-11-22, the game's maker, STA2-5: "Then you go get in the forklift and load
// some pallets onto the containers. If someone is really bad at driving, Id say they can get off the forklift and the
// ship will automatically be loaded once they leave. So then they can go up the elevator and board the hauler and
// everything will be ready for takeoff."). His forklift is driven by Cargo's people on their rounds; parked in its bay
// with nobody on it, the player can take it: walking up beside it, a prompt (Drive, E), on into its seat, and drive.
// How it drives, what stops it and how pallets go on and off its forks: kit/forkliftdrive.js; the forklift itself:
// src/cargoforklift.js (forklift.hand).
//
//   THE CONTROLS (the same keys and stick as walking; a computer and a phone alike):
//     drive        the stick (a phone: wherever the left thumb lands) or WASD / the arrows: up drives forward, down
//                  backs, left and right steer (backing, the back end swings the way it is pushed)
//     forks        the ▲ ▼ buttons (held), or R / F (Space / C as well): up and down
//     get off      the Get off button, or E (Esc too): it stays where it is left, and goes back to its bay where nobody
//                  sees; a pallet left on its forks is set down where it was going
//     look         a drag on the right of the screen (the mouse on a computer) swings the view round it; the wheel or
//                  a pinch nearer or further
//   THE VIEW: behind it and a little to its left, high, looking down past its mast at its forks (from straight behind
//   the mast hides them, as a driver leans out to see them), swinging round behind it as it turns; never through a wall.
//
//   const C = makeCargoDrive({ W, walls, input, forklift, run, people })
//   C.update(dt, P, playing, { inLift }) -> true while the player is on it (main.js holds the player still and plays them
//                                seated); inLift: the player stands in a lift box (the line waits till they step out)
//   C.aim(camera, dt)            its camera, while on it
//   C.seatBody(P)                the player's figure on its seat (after the player's own update)
//   C.clip                       the player's clip while on it (seated), or null
//   C.stop()                     off at once (the crew screen)
//   C.state()                    for the rigs: { on, phase, near, hint, read, ... }; C.pilot: a rig's own hand
import * as THREE from 'three';
import { ensureCss as craneCss } from './cranedrive.js';
import { STORE } from '../kit/places-plan.js';
import { RIDE } from './cargoforklift.js';
import { HAND } from '../kit/forkliftdrive.js';

const CSS = new URL('./cargodrive.css', import.meta.url).href;
function ensureCss() {
  craneCss();
  if (document.querySelector('link[data-pcf]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.pcf = '1'; document.head.appendChild(l);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ease = (t) => t * t * (3 - 2 * t);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// WALKING UP TO IT: the prompt comes up within `near` (m) of the spot beside its seat (either side), on Cargo's floor.
// THE VIEW: how far behind it (m), how high over the floor, how far round to its left (radians), how far ahead of its
// foot it looks (m) and how low; how quickly it follows; how far a drag swings it (radians a pixel), and the wheel
// AN UPRIGHT PHONE: further back, and the picture shifted up (`shift` of the screen's height: the look point above
// its middle), so the forklift stands above the forks' buttons and the words along the bottom
export const VIEW = { dist: 4.4, up: 3.1, side: 0.62, ahead: 2.2, look: 0.45, follow: 3.2, turn: 0.006, zoom: [0.6, 1.5], swingAfter: 1.6, ceiling: 3.5, tall: { dist: 5.6, shift: 0.2, fov: 66, side: 0.3, ahead: 1.3 } };
export const ON = { near: 1.9, on: 1.2, off: 1.0 };
export const SIT = 'Sit_Listen';

export function makeCargoDrive({ W, walls, input, forklift, run = null, people = () => null }) {
  ensureCss();
  // ── the prompt (the jobs' own look) ──────────────────────────────────────────────────────────────────────────
  const prompt = document.createElement('div');
  prompt.className = 'pnj-prompt pcf-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b>Forklift</b><small></small></div><button type="button" class="pnj-go">Drive<kbd>E</kbd></button>';
  document.body.appendChild(prompt);
  prompt.querySelector('.pnj-go').addEventListener('click', () => { if (near && !C.on) getOn(); });

  // ── the driving screen (free control's look: src/cranedrive.css) ─────────────────────────────────────────────
  const el = document.createElement('div');
  el.className = 'pcd pcf'; el.hidden = true;
  el.innerHTML = `
    <header class="pcd-top">
      <div class="pcd-title"><b>Forklift</b><small class="pcf-sub"></small></div>
      <button type="button" class="pcd-done pcf-off" aria-label="Get off (E)">Get off<kbd>E</kbd></button>
    </header>
    <p class="pcf-load" hidden></p>
    <p class="pcd-hint pcf-hint" aria-live="polite"></p>
    <div class="pcd-pad pcf-pad" role="group" aria-label="The forks">
      <button type="button" class="pcd-btn pcd-up" data-hold="up" aria-label="Forks up (R)">&#9650;<small>Forks up</small><kbd>R</kbd></button>
      <button type="button" class="pcd-btn pcd-down" data-hold="down" aria-label="Forks down (F)">&#9660;<small>Forks down</small><kbd>F</kbd></button>
      <button type="button" class="pcd-btn pcf-offbtn" data-act="off" aria-label="Get off (E)">Get off<kbd>E</kbd></button>
    </div>
    <p class="pcd-stickhint"></p>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const held = { up: false, down: false };
  // the line once the Hauler is loaded (src/supplyrun.js line()), for a while
  const ready = document.createElement('div');
  ready.className = 'pcf-ready'; ready.hidden = true; ready.setAttribute('role', 'status');
  ready.innerHTML = '<b>The Hauler is loaded</b><span></span>';
  document.body.appendChild(ready);
  let readyShown = null, readyT = 0;
  el.querySelectorAll('[data-hold]').forEach((b) => {
    const k = b.dataset.hold, on = (e) => { e.preventDefault(); held[k] = true; b.classList.add('is-on'); }, off = () => { held[k] = false; b.classList.remove('is-on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });
  el.querySelector('[data-act="off"]').addEventListener('click', () => getOff());
  $('.pcf-off').addEventListener('click', () => getOff());

  // ── on and off ────────────────────────────────────────────────────────────────────────────────────────────────
  // phase: null (walking), 'on' (getting on), 'drive', 'off' (getting off); from: where they stood
  let phase = null, t = 0, from = null, to = null, near = false, playing = false, hint = '', noteT = -9, note = '', P0 = null;
  const C = { get on() { return !!phase; }, get clip() { return phase ? (phase === 'on' && t < ON.on * 0.35) || (phase === 'off' && t > ON.off * 0.6) ? 'Stand_Listen' : SIT : null; }, pilot: null };
  function getOn() {
    if (phase || !P0 || !forklift.hand.take()) return false;
    phase = 'on'; t = 0; from = { pos: P0.pos.clone(), heading: P0.heading };
    prompt.hidden = true; el.hidden = false; requestAnimationFrame(() => el.classList.add('is-on'));
    document.body.classList.add('pcf-driving');
    cam.fresh = true; cam.orbit = 0; cam.zoom = 1;
    return true;
  }
  function getOff(now = false) {
    if (phase !== 'drive' && !now) return false;
    // (beside its seat, its left side first; neither free: not here)
    const b = forklift.hand.beside(-1) || forklift.hand.beside(1);
    if (!b && !now) { say('No room to get off here: drive it out a little first.'); return false; }
    forklift.hand.give();
    if (now || !b) { phase = null; done(b); return true; }
    phase = 'off'; t = 0; to = b;
    return true;
  }
  function done(b) {
    if (P0 && b) { P0.place(b.pos, b.heading); P0.zone = null; }
    el.classList.remove('is-on'); el.hidden = true; held.up = held.down = false;
    if (W.camera.view && W.camera.view.enabled) W.camera.clearViewOffset();
    document.body.classList.remove('pcf-driving');
    phase = null;
    if (run && run.gotOff) run.gotOff();
  }
  const say = (s) => { note = s; noteT = performance.now(); };
  addEventListener('keydown', (e) => {
    if (!playing || e.repeat) return;
    if (!phase && near && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); getOn(); return; }
    if (phase === 'drive' && (e.key === 'e' || e.key === 'E' || e.key === 'Escape')) { e.preventDefault(); e.stopImmediatePropagation(); getOff(); }
  }, true);

  // ── the view ────────────────────────────────────────────────────────────────────────────────────────────────
  const cam = { yaw: 0, orbit: 0, zoom: 1, fresh: true, idle: 99, at: new THREE.Vector3(), look: new THREE.Vector3() };
  const _f = new THREE.Vector3(), _d = new THREE.Vector3(), _w = new THREE.Vector3(), _l = new THREE.Vector3();
  function aim(camera, dt) {
    if (!phase) return;
    const s = forklift.hand.drive() ? forklift.hand.drive().s : null; if (!s) return;
    const f = [Math.cos(s.h), -Math.sin(s.h)];
    // behind it: the way it faces turned round, a little to its left, eased round after it as it turns
    const tall = innerHeight > innerWidth * 1.05;
    const back = Math.atan2(-f[0], -f[1]) - (tall ? VIEW.tall.side : VIEW.side);      // (as a heading: the camera sits along (sin, cos) of it from the focus)
    if (cam.fresh) cam.yaw = back;
    if (cam.idle > VIEW.swingAfter) cam.orbit *= Math.exp(-1.5 * dt);
    cam.yaw += wrap(back - cam.yaw) * (1 - Math.exp(-VIEW.follow * dt));
    const a = cam.yaw + cam.orbit, d = (tall ? VIEW.tall.dist : VIEW.dist) * cam.zoom, ahead = tall ? VIEW.tall.ahead : VIEW.ahead;
    // (the focus: over its seat; the camera kept inside the walls along the line from it)
    _f.set(s.x + f[0] * 0.2, STORE.floor + 2.25, s.z + f[1] * 0.2);
    _d.set(Math.sin(a) * d, Math.min(VIEW.ceiling, VIEW.up * (0.8 + 0.2 * cam.zoom)) + STORE.floor - _f.y, Math.cos(a) * d);
    const L = _d.length(); _d.normalize();
    const reach = Math.max(0.6, Math.min(L, walls.reach(_f, _d, L + 0.3) - 0.3));
    _w.copy(_f).addScaledVector(_d, reach);
    _l.set(s.x + f[0] * ahead, STORE.floor + VIEW.look + Math.min(1.2, s.lift), s.z + f[1] * ahead);
    const k = cam.fresh ? 1 : 1 - Math.exp(-6 * dt);
    cam.at.lerp(_w, k); cam.look.lerp(_l, cam.fresh ? 1 : 1 - Math.exp(-8 * dt)); cam.fresh = false;
    const fov = tall ? VIEW.tall.fov : 62, oy = tall ? Math.round(innerHeight * VIEW.tall.shift) : 0, vo = camera.view;
    if (oy && (!vo || !vo.enabled || vo.offsetY !== oy || vo.fullWidth !== innerWidth || vo.fullHeight !== innerHeight)) camera.setViewOffset(innerWidth, innerHeight, 0, oy, innerWidth, innerHeight);
    else if (!oy && vo && vo.enabled) camera.clearViewOffset();
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.position.copy(cam.at); camera.lookAt(cam.look);
  }

  // ── the player's figure on its seat ───────────────────────────────────────────────────────────────────────────
  const UP = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
  function seatBody(P) {
    if (!phase) return;
    const S = forklift.hand.seat();
    let x = S.x, y = S.y, z = S.z, h = S.heading;
    // getting on: turned to face the way it faces beside it, then up and across into the seat; getting off, back
    const k = phase === 'on' ? Math.min(1, t / ON.on) : phase === 'off' ? 1 - Math.min(1, t / ON.off) : 1;
    const A = phase === 'on' ? from : phase === 'off' ? to : null;
    if (A && k < 1) {
      const turn = ease(Math.min(1, k / RIDE.turn)), u = ease(Math.max(0, (k - RIDE.turn) / (1 - RIDE.turn))), lift = ease(Math.min(1, u * 1.5));
      x = A.pos.x + (S.x - A.pos.x) * u; z = A.pos.z + (S.z - A.pos.z) * u; y = A.pos.y + (S.y - A.pos.y) * lift;
      h = A.heading + wrap(S.heading - A.heading) * turn;
    }
    P.pos.set(x, STORE.floor, z); P.heading = h;
    P.c.root.position.set(x, y, z); P.c.root.quaternion.copy(_q.setFromAxisAngle(UP, h));
  }

  // ── each frame ───────────────────────────────────────────────────────────────────────────────────────────────
  // (everyone else on Cargo's floor: its people, for it to stop for)
  const feet = () => { const pp = people(); return pp ? pp.list.filter((q) => q.home === 'store' && !q.hidden && !q.away).map((q) => q.pos) : []; };
  function update(dt, P, isPlaying, { inLift = false } = {}) {
    playing = isPlaying; P0 = P;
    // (shown once the player is free to look about: never in a lift box, it waits for them to step out of it)
    const line = run && run.line ? run.line() : null;
    if (line && line !== readyShown && isPlaying && !inLift) { readyShown = line; readyT = 0; ready.querySelector('b').textContent = line.title || 'The Hauler is loaded'; ready.querySelector('span').textContent = line.words; ready.hidden = false; }
    if (!ready.hidden) { readyT += dt; if (readyT > 9 || (line && line !== readyShown)) ready.hidden = true; }
    if (!P) { prompt.hidden = true; return false; }
    if (!phase) {
      // walking: the prompt beside its seat, when it can be taken
      const inCargo = isPlaying && Math.abs(P.pos.y - STORE.floor) < 0.6 && forklift.hand.can();
      let n = false;
      if (inCargo) for (const side of [-1, 1]) { const b = forklift.hand.beside(side); if (b && Math.hypot(b.pos.x - P.pos.x, b.pos.z - P.pos.z) < ON.near) n = true; }
      if (n !== near) { near = n; prompt.hidden = !near; }
      if (near) { const w = run && run.forkliftWords ? run.forkliftWords() : null, sm = prompt.querySelector('small'), s = w || 'Drive it'; if (sm.textContent !== s) sm.textContent = s; }
      return false;
    }
    near = false; prompt.hidden = true;
    t += dt;
    if (input) { const lk = input.takeLook(); if (lk.dx) { cam.orbit = Math.max(-2.8, Math.min(2.8, cam.orbit - lk.dx * VIEW.turn)); cam.idle = 0; } else cam.idle += dt; const z = input.takeZoom(); if (z) cam.zoom = Math.max(VIEW.zoom[0], Math.min(VIEW.zoom[1], cam.zoom * Math.pow(1.1, z))); }
    if (phase === 'on') { if (t >= ON.on) { phase = 'drive'; t = 0; } return true; }
    if (phase === 'off') { if (t >= ON.off) done(to); return true; }
    // driving: the stick or the keys, the forks' buttons or keys
    const kb = (c) => !!(input && input.enabled && input.held && input.held(c));
    const mv = input && input.enabled ? input.move : null;
    // (the keys: full ahead or back, the wheel turned its whole way; the stick: as far as it is pushed, a little dead
    // in the middle)
    const keyGo = (kb('KeyW') || kb('ArrowUp') ? 1 : 0) - (kb('KeyS') || kb('ArrowDown') ? 1 : 0), keyTurn = (kb('KeyD') || kb('ArrowRight') ? 1 : 0) - (kb('KeyA') || kb('ArrowLeft') ? 1 : 0);
    const dead = (v, k) => (Math.abs(v) < 0.1 ? 0 : Math.max(-1, Math.min(1, v * k)));
    let cmd = { go: keyGo || keyTurn ? keyGo : mv ? dead(mv.y, 1.25) : 0, turn: keyGo || keyTurn ? keyTurn : mv ? dead(mv.x, 1.4) : 0,
      forks: (held.up || kb('KeyR') || kb('Space') ? 1 : 0) - (held.down || kb('KeyF') || kb('KeyC') ? 1 : 0) };
    if (C.pilot) cmd = C.pilot(forklift.hand.read()) || cmd;
    forklift.hand.step(cmd, dt, feet());
    show(cmd);
    return true;
  }
  // ── the words: what to do next, what it would not do and why ───────────────────────────────────────────────────
  let carried = null, lastSet = null;   // (the pallet on the forks, and the one just set down: the words after it)
  const WHY = { deeper: 'Drive the forks all the way in first.', line: 'Line it up with the place to set it down.', place: 'Set it down just inside a container\'s doors, or back on the loading floor.' };
  function show(cmd) {
    const r = forklift.hand.read(); if (!r) return;
    if (r.carry != null) carried = r.carry; else if (carried != null) { lastSet = carried; carried = null; }
    if (r.under == null && lastSet != null && !(r.front && r.front.i === lastSet)) lastSet = null;
    const R = run && run.status ? run.status() : null;
    let h = '';
    if (r.why && WHY[r.why]) say(WHY[r.why]);
    // (stopped against the pallet its forks are in under is all the way in, not in the way)
    else if (r.blocked && Math.abs(cmd.go) > 0.1 && !(r.under != null && cmd.go > 0) && !(r.place && r.place.d < HAND.reach && cmd.go > 0)) say(r.blocked === 'someone' ? 'Someone is in the way: it waits for them.' : r.blocked === 'the wall' ? 'The wall is in the way.' : 'Something is in the way.');
    if (note && performance.now() - noteT < 2200) h = note;
    else if (r.carry != null) h = r.place ? (r.place.d < 0.4 ? 'Lower the forks to set it down.' : r.place.box ? 'Drive it in through the container\'s doors.' : 'Drive it onto its place.') : R && R.open ? 'Take it to a container: its doors are open.' : 'Set it down on the loading floor.';
    // (just set down: in a container, it is loaded; back out from under it)
    else if (r.under != null && lastSet === r.under) h = /^b/.test(r.underAt || '') ? 'Loaded! Back out from under it.' : 'Set down. Back out from under it.';
    else if (r.under != null) h = 'All the way in, then the forks up to lift it.';
    else if (r.front && /^b/.test(r.front.place || '')) h = R && R.left > 0 && R.open ? `Pick up a pallet from the loading floor: ${R.left} to load.` : 'Loaded: back away from it.';
    else if (r.front) h = 'Lined up: drive the forks in under it.';
    else h = R && R.left > 0 && R.open ? `Pick up a pallet from the loading floor: ${R.left} to load.` : 'Line the forks up with a pallet\'s end to pick it up.';
    const e = $('.pcf-hint'); if (e.textContent !== h) { e.textContent = h; e.classList.toggle('is-note', !!note && performance.now() - noteT < 2200); }
    const sub = R && R.open ? `Supply run: ${R.loaded} of ${R.pallets} loaded` : 'Cargo\'s forklift';
    if ($('.pcf-sub').textContent !== sub) $('.pcf-sub').textContent = sub;
    const st = $('.pcd-stickhint'), sw = input && input.touch ? 'Drag on the left to drive' : 'WASD or the arrows drive';
    if (st.textContent !== sw) st.textContent = sw;
  }
  function stop() { if (phase) { if (phase === 'drive' || phase === 'on') forklift.hand.give(); done(phase === 'off' ? to : forklift.hand.beside(-1) || forklift.hand.beside(1)); } prompt.hidden = true; near = false; }
  Object.assign(C, { update, aim, seatBody, stop, getOn, getOff, say,
    state: () => ({ on: !!phase, phase, near, prompt: !prompt.hidden, ready: ready.hidden ? null : ready.textContent, hint: $('.pcf-hint').textContent, sub: $('.pcf-sub').textContent, read: forklift.hand.read(), cam: { at: cam.at.toArray().map((v) => +v.toFixed(2)), orbit: +cam.orbit.toFixed(2) } }) });
  return C;
}
