// FREE CONTROL: the smelter's crane by hand, at the operator's chair, for fun, no credits, never needed (the game's
// maker, 2026-11-16: "It might be a good idea to let people free move the crane, or even pick up canisters and load
// them. But if they want to make credits then math will be involved. So they have 2 options pop up"). This is the
// first option; the crane operator job (src/jobs/crane.js) is the second, and works the crane through the same
// pieces below: the view that follows the load, the readouts, the live crane (kit/crane-drive.js).
//
//   THE CONTROLS (the same on a computer and a phone):
//     move        the stick (a phone: wherever the left thumb lands) or WASD / the arrows: the load goes the way you
//                 push across the screen, as far as the rail and the beam let it (the rail's way and the beam's way)
//     up, down    the ▲ ▼ buttons (held), or R / F (Space / C as well)
//     grab        the Grab button, or G: shuts the grab on a canister it is sitting on, or lets go of one where it
//                 can rest (seated in a socket, on the ship's tray, on the rack); anywhere else it says why not
//     turn        the Turn button, or T, near the turntable: up, onto it, a quarter turn onto the other rail
//     view        the View button, or V: following the load, or from the chair through the window
//     done        Done, or Esc: the crane works its way up and the round takes over from where things are
//   THE VIEW (my call: following the load): a camera out in the hangar that keeps the hook in view from the open side
//   (from the hangar floor's side at the wall, from above and aft of the ship over it), pulled in where a wall or the
//   ship is in the way; dragging on the view swings it round the load, the wheel or a pinch brings it nearer.
//   THE READOUTS: where the trolley is on the rail's metre marks, the hook's height, what it holds and weighs, the
//   crane's rated load; the same numbers on the chair's middle screen in the control room (chairScreen).
//
//   const D = openDrive(root, { crane, input, W, walls, onClose })   D.update(dt) (before the camera), D.aim(camera, dt),
//                                                                    D.close(), D.state() (for rigs)
//   followCam(W, walls) -> { aim(camera, S, dt, look), orbit, zoom }  the view that follows the load (the job uses it)
//   readout(r) -> { rail, hook, load }                               the readouts as words
//   chairScreen(W, crane) -> { update(dt) }                          the chair's middle screen showing them
import * as THREE from 'three';
import { DRIVE } from '../kit/crane-drive.js';
import { expand, zonesOf } from '../kit/layout.js';
import { PIECES } from '../kit/catalog.js';
import { placeMatrix } from '../kit/grid.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = new URL('./cranedrive.css', import.meta.url).href;
export function ensureCss() {
  if (document.querySelector('link[data-pcd]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.pcd = '1'; document.head.appendChild(l);
}
const m1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

// ── the readouts in words ──────────────────────────────────────────────────────────────────────────────────────────
export function readout(r) {
  return {
    rail: `${r.leg === 'wall' ? 'Wall rail' : 'Ship rail'} ${m1(Math.max(0, r.mark))} m`,
    hook: `${m1(r.hook)} m up`,
    load: r.held >= 0 ? `canister, ${m1(r.tonnes)} t` : 'none',
  };
}

// ── the view that follows the load ────────────────────────────────────────────────────────────────────────────────
// From the hook, out into the open: at the wall's leg toward the hangar floor (a little toward the ship); at the
// ship's leg off the side of the ship the load is on (where its trays slide out to), and up; the lower the load, the
// higher it looks down from (so the guard rail or the hull does not pull it in close). `orbit` (radians) swings it
// round, `zoom` (metres) brings it nearer or further. site: kit/crane.js's (for the ship's middle)
export function followCam(W, walls, site = null) {
  const shipMid = site && site.mounts.length ? site.mounts.reduce((q, m) => q + m.at[2], 0) / site.mounts.length : null;
  const from = new THREE.Vector3();
  const at = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3(), dir = new THREE.Vector3(), hook = new THREE.Vector3();
  let fresh = true;
  const F = { orbit: 0, zoom: 7.5, fresh() { fresh = true; },
    aim(camera, S, dt, { chair = null, shift = null, below = 0 } = {}) {
      if (chair) { want.copy(chair.at); wantLook.copy(chair.look); if (camera.fov !== chair.fov) { camera.fov = chair.fov; camera.updateProjectionMatrix(); } }
      else {
        if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
        hook.set(S.x + Math.sin(S.yaw) * S.slide, S.hoist, S.z + Math.cos(S.yaw) * S.slide);
        const ship = Math.abs(Math.sin(S.yaw)) > 0.5;
        // (the wall's leg: from the hangar floor's side; the ship's leg: off the side of the ship the load is on)
        const side = ship && shipMid != null ? (hook.z < shipMid ? -1 : 1) : 1;
        const base = ship ? Math.atan2(0.35, side) : Math.atan2(0.38, 1), a = base + F.orbit;
        const up = (ship ? 0.6 : 0.34) + Math.max(0, 2.8 - hook.y) * 0.22;
        dir.set(Math.sin(a), up, Math.cos(a)).normalize();
        let d = F.zoom;
        from.copy(hook); from.y += 0.4;
        const r = walls && walls.reach ? walls.reach(from, dir, d) : d; d = Math.max(3.2, Math.min(d, r - 0.35));
        want.copy(hook).addScaledVector(dir, d);
        want.y = Math.min(Math.max(want.y, 1.5), 8.1);
        // (looking a little past the load toward the wall it is going to, or down at the ship)
        wantLook.copy(hook); wantLook.y -= ship ? 0.6 : 0.25;
        if (!ship) wantLook.z -= 0.55;
        // (`below`: down toward the floor under the load, to see who is there)
        if (below) wantLook.y += (0.9 - wantLook.y) * 0.55 * below;
        // (kept clear of a panel: the load left of a panel on the right, above one along the bottom)
        if (shift) { const fx = wantLook.x - want.x, fz = wantLook.z - want.z, L = Math.hypot(fx, fz) || 1; wantLook.x += (-fz / L) * shift[0] * d; wantLook.z += (fx / L) * shift[0] * d; wantLook.y += shift[1] * d; }
      }
      // (it starts where it belongs, not swooping there through the walls)
      if (fresh) { at.copy(want); look.copy(wantLook); fresh = false; }
      const k = 1 - Math.exp(-4.5 * dt), kl = 1 - Math.exp(-7 * dt);
      at.lerp(want, k); look.lerp(wantLook, kl);
      camera.position.copy(at); camera.lookAt(look);
    },
  };
  return F;
}

// a push on the stick (x right, y forward on the screen) as a push across the station's plane, from the camera
export function pushFrom(camera, move) {
  if (!move || !move.mag) return [0, 0];
  const f = camera.getWorldDirection(new THREE.Vector3()); f.y = 0;
  if (f.lengthSq() < 1e-6) return [0, 0];
  f.normalize();
  const rx = -f.z, rz = f.x;   // (the camera's right, level)
  const m = Math.min(1, move.mag || Math.hypot(move.x, move.y));
  const len = Math.hypot(move.x, move.y) || 1;
  const x = move.x / len * m, y = move.y / len * m;
  return [rx * x + f.x * y, rz * x + f.z * y];
}
// (a push mostly along one of the crane's two ways, the rail's or the beam's, goes that way only: the view is seldom
// square to the rail, and a push meant along the rail should not creep across)
export function squarePush(push, yaw) {
  const [x, z] = push; if (!x && !z) return push;
  const ship = Math.abs(Math.sin(yaw)) > 0.5, rail = ship ? z : x, beam = ship ? x : z;
  if (Math.abs(beam) < Math.abs(rail) * 0.45) return ship ? [0, z] : [x, 0];
  if (Math.abs(rail) < Math.abs(beam) * 0.45) return ship ? [x, 0] : [0, z];
  return push;
}

// ── the HUD ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function openDrive(root, { crane, input, W, walls, onClose = () => {} } = {}) {
  ensureCss();
  const el = document.createElement('div');
  el.className = 'pcd';
  el.innerHTML = `
    <header class="pcd-top">
      <div class="pcd-title"><b>Free control</b><small>The crane by hand: no credits, just for fun</small></div>
      <button type="button" class="pcd-done" aria-label="Done (Esc)">Done<kbd>Esc</kbd></button>
    </header>
    <dl class="pcd-reads" aria-live="off">
      <div><dt>Rail</dt><dd data-r="rail"></dd></div>
      <div><dt>Hook</dt><dd data-r="hook"></dd></div>
      <div><dt>Load</dt><dd data-r="load"></dd></div>
      <div class="pcd-plate"><dt>Rated</dt><dd>${DRIVE.rated} t</dd></div>
    </dl>
    <p class="pcd-hint" aria-live="polite"></p>
    <div class="pcd-pad" role="group" aria-label="The hoist and the grab">
      <button type="button" class="pcd-btn pcd-up" data-hold="up" aria-label="Up (R)">&#9650;<small>Up</small><kbd>R</kbd></button>
      <button type="button" class="pcd-btn pcd-grab" data-act="grab" aria-label="Grab (G)"><span>Grab</span><kbd>G</kbd></button>
      <button type="button" class="pcd-btn pcd-down" data-hold="down" aria-label="Down (F)">&#9660;<small>Down</small><kbd>F</kbd></button>
      <button type="button" class="pcd-btn pcd-turn" data-act="turn" aria-label="Turn on the turntable (T)" hidden>Turn<kbd>T</kbd></button>
      <button type="button" class="pcd-btn pcd-view" data-act="view" aria-label="Change the view (V)">View<kbd>V</kbd></button>
    </div>
    <p class="pcd-stickhint">${'ontouchstart' in window || (input && input.touch) ? 'Drag on the left to move the crane' : 'WASD or the arrows move the crane'}</p>
    <div class="pcd-wait" hidden>The crane is finishing its move&hellip;</div>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const held = { up: false, down: false };
  let closed = false, view = 'follow', taps = { grab: false, turn: false }, noteText = '', noteT = 0, t = 0, peopleT = -9;
  const cam = followCam(W, walls, crane.L && crane.L.site);
  if (input) input.enabled = true;
  crane.take();

  // (the hold buttons: pressed while a finger or the mouse is down on them)
  el.querySelectorAll('[data-hold]').forEach((b) => {
    const k = b.dataset.hold, on = (e) => { e.preventDefault(); held[k] = true; b.classList.add('is-on'); }, off = () => { held[k] = false; b.classList.remove('is-on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });
  el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act)));
  $('.pcd-done').addEventListener('click', () => close());
  function act(a) { if (a === 'view') { view = view === 'follow' ? 'chair' : 'follow'; cam.fresh(); } else taps[a] = true; }
  // (keys: the shared input reads the stick and WASD; these are the crane's own; Esc is ours while it is up)
  function onKey(e) {
    if (closed) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if (e.repeat) return;
    if (e.code === 'KeyG' || e.code === 'Enter') { e.preventDefault(); act('grab'); }
    else if (e.code === 'KeyT') act('turn');
    else if (e.code === 'KeyV') act('view');
  }
  addEventListener('keydown', onKey, true);

  function update(dt) {
    if (closed) return;
    t += dt;
    const D = crane.live;
    $('.pcd-wait').hidden = !!D || crane.mode !== 'handover';
    // the look and the zoom are the crane camera's while it is up
    if (input) {
      const L = input.takeLook(); if (view === 'follow') cam.orbit = Math.max(-1.4, Math.min(1.4, cam.orbit - L.dx * 0.006));
      const z = input.takeZoom(); if (z) cam.zoom = Math.max(4, Math.min(12, cam.zoom + z * 0.8));
    }
    if (!D) return;
    const kb = (c) => !!(input && input.enabled && input.held && input.held(c));
    const up = held.up || kb('KeyR') || kb('Space'), down = held.down || kb('KeyF') || kb('KeyC');
    const r0 = D.read();
    const cmd = { move: squarePush(pushFrom(W.camera, input && input.move), D.state.yaw), hoist: (up ? 1 : 0) - (down ? 1 : 0) };
    if (taps.grab) cmd.grab = r0.shut || D.state.arms > 0.5 ? 'open' : 'shut';
    if (taps.turn) cmd.turn = true;
    taps = { grab: false, turn: false };
    crane.command(cmd);
    show(D, r0);
  }
  function show(D, r) {
    const w = readout(r);
    for (const k of ['rail', 'hook', 'load']) { const dd = el.querySelector(`[data-r="${k}"]`); if (dd.textContent !== w[k]) dd.textContent = w[k]; }
    const grab = $('.pcd-grab span'), shutNow = D.state.arms > 0.5;
    grab.textContent = shutNow ? 'Let go' : 'Grab';
    $('.pcd-grab').classList.toggle('is-ready', (!shutNow && r.seated) || (shutNow && r.resting));
    $('.pcd-turn').hidden = !(r.nearTurn && !D.busy);
    $('.pcd-turn').classList.toggle('is-ready', r.onTurntable);
    // the hint: what it would not do just now, else what to do next
    const n = D.notes[0];
    if (n) { noteText = n.text; noteT = t; }
    if (D.notes.some((q) => q.key === 'people')) peopleT = t;
    let hint = '';
    if (noteText && t - noteT < 2.6) hint = noteText;
    else if (D.busy && D.action === 'turn') hint = 'Turning on the turntable...';
    else if (D.busy) hint = '';
    else if (r.held < 0) hint = r.seated ? 'On a canister: Grab it (G).' : r.place ? 'Lined up: lower the grab onto it.' : r.nearTurn && !r.onTurntable ? 'Near the turntable: Turn (T) to go along the other rail.' : 'Bring the grab over a canister (on the rack, the ship or at the wall), then lower it.';
    else hint = r.resting ? 'It can rest here: Let go (G).' : r.place && r.place.kind === 'socket' ? 'Lined up with a socket: lower it to the socket, then push it in toward the wall.' : r.place ? 'Lined up: lower it down.' : 'Take it to a socket, the rack or the ship\'s tray.';
    const h = $('.pcd-hint'); if (h.textContent !== hint) { h.textContent = hint; h.classList.toggle('is-note', !!noteText && t - noteT < 2.6); }
  }
  function aim(camera, dt) {
    const S = crane.live ? crane.live.state : crane.L.state(crane.t);
    // (held up by someone under the load: the view looks down at the floor under it a while, so they can be seen)
    cam.aim(camera, S, dt, { chair: view === 'chair' ? W.view('smelter-console') : null, below: t - peopleT < 2.6 ? 1 : 0 });
  }
  function close() {
    if (closed) return;
    closed = true;
    removeEventListener('keydown', onKey, true);
    crane.give();
    el.classList.add('is-going');
    setTimeout(() => el.remove(), 250);
    onClose();
  }
  requestAnimationFrame(() => el.classList.add('is-on'));
  return { el, update, aim, close, cam, act, state: () => ({ mode: crane.mode, view, hint: $('.pcd-hint').textContent, reads: [...el.querySelectorAll('[data-r]')].map((d) => d.textContent), live: crane.live ? crane.live.read() : null }) };
}

// ── the chair's middle screen: the crane's numbers, live ──────────────────────────────────────────────────────────
// A small lit pane laid on the operator chair's middle screen (its own frame from the station: the chair piece), drawn
// again only when a number changes (at most a few times a second).
// the operator's chair as placed in the station (its world frame), found as the people find a piece: by name
export function chairFrame(W) {
  for (const zd of zonesOf(W.R)) for (const pl of expand(zd.pieces || [])) {
    if (pl.piece !== 'opChair') continue;
    const def = PIECES[pl.piece]; if (!def) continue;
    return placeMatrix({ ...pl, off: [...(pl.off || [0, 0, 0])] }, new THREE.Matrix4(), zd.grid || W.R.grid || null).clone();
  }
  return null;
}
export function chairScreen(W, crane, chair = chairFrame(W)) {
  if (!chair) return { update() {} };
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 336;
  const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.365), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  // (the chair's middle screen, kit/smelter.js opChair: 1.12 m in front of the seat, its face leaning back by `tilt`
  // and facing the chair; this pane just in front of it)
  const tilt = 0.52, nx = Math.sin(tilt), nz = -Math.cos(tilt);
  mesh.position.set(0, 0.83 + 0.024 * Math.sin(tilt) + 0.006 * nx, 1.12 - (-0.02 + 0.024 * Math.cos(tilt)) + 0.006 * nz);
  mesh.rotation.set(-tilt, Math.PI, 0, 'YXZ');
  const holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.matrix.copy(chair); holder.add(mesh);
  W.scene.add(holder);
  let shown = '', wait = 0;
  function draw(r, mode) {
    const w = readout(r);
    g.fillStyle = '#071419'; g.fillRect(0, 0, 512, 336);
    g.strokeStyle = 'rgba(120, 220, 255, 0.35)'; g.lineWidth = 3; g.strokeRect(8, 8, 496, 320);
    g.font = '700 30px "Segoe UI", system-ui, sans-serif'; g.fillStyle = '#7fd8ff'; g.textAlign = 'left';
    g.fillText('CRANE', 26, 52);
    g.font = '600 22px "Segoe UI", system-ui, sans-serif'; g.fillStyle = mode === 'round' ? '#8fa3b0' : '#ffb46b'; g.textAlign = 'right';
    g.fillText(mode === 'round' ? 'BY ITSELF' : 'BY HAND', 486, 50);
    const rows = [['RAIL', w.rail], ['HOOK', w.hook], ['LOAD', w.load], ['RATED', `${DRIVE.rated} t`]];
    rows.forEach(([k, v], i) => {
      const y = 112 + i * 60;
      g.textAlign = 'left'; g.font = '600 22px "Segoe UI", system-ui, sans-serif'; g.fillStyle = '#6b8a96'; g.fillText(k, 26, y);
      g.font = '700 34px "Segoe UI", system-ui, sans-serif'; g.fillStyle = '#e8f7ff'; g.fillText(v, 150, y);
    });
    tex.needsUpdate = true;
  }
  return {
    mesh,
    update(dt) {
      wait -= dt; if (wait > 0) return; wait = 0.25;
      if (!crane || !crane.on) return;
      let r;
      if (crane.drive) r = crane.drive.read();
      else { const S = crane.L.state(crane.t), held = S.cans.findIndex((q) => q.where === 'held'); r = { leg: Math.abs(Math.sin(S.yaw)) > 0.5 ? 'ship' : 'wall', mark: Math.abs(Math.sin(S.yaw)) > 0.5 ? S.z - crane.L.site.turn[1] : S.x - crane.L.site.rail.wall[0], hook: S.hoist, held, tonnes: held >= 0 ? DRIVE.canister + crane.oreOf() * S.cans[held].fill : 0 }; }
      const key = readout(r); const s = JSON.stringify(key) + crane.mode;
      if (s !== shown) { shown = s; draw(r, crane.mode); }
    },
  };
}
