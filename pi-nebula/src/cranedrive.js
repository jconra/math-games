// FREE CONTROL: the smelter's bridge crane by hand, from the operator's chair, for fun, no credits, never needed. It is
// the "Free control" switch on the crane operator's screen (src/jobs/crane.js: the crane game is the screen's own
// default). The game's maker, 2026-11-16: "I think it would be more fun if you could do whatever you wanted with it.
// If people are in the way then they should start to run away and it should post a notice saying you committed a
// safety violation (as a joke) ... let the crane do whatever and make it entertaining."
//
//   THE CONTROLS (the same on a computer and a phone):
//     move        the stick (a phone: wherever the left thumb lands) or WASD / the arrows: the load goes the way you
//                 push across the screen (a push within about 37 degrees of the hangar's x or y goes that way only)
//     up, down    the ▲ ▼ buttons (held), or R / F (Space / C as well)
//     turn        the ↺ ↻ buttons (held), or Q / E: the cradle turns the canister
//     view        the View button, or V: following the load, the camera on the crane looking down, the cameras on
//                 the hangar's walls
//     done        Done, or Esc: the crane works its way up and the round takes over from where things are
//   THERE IS NO GRAB BUTTON: lowered onto a canister the crane takes it; lowered into a free place (a socket, a ship's
//   tray, a rack bay) it lets go; in front of a free socket at its height it pushes the canister in. Near a place it
//   lines itself up and turns to it; the three lights (on the crane, and here) go green when each way is right.
//
//   const D = openDrive(root, { crane, input, W, walls, onClose, onGame })   D.update(dt) (before the camera),
//                                     D.aim(camera, dt), D.close(), D.state() (for rigs); onGame: the screen's switch
//                                     back to the crane game
//   followCam(W, site) -> { aim(camera, S, dt, opts), orbit, zoom }     the view that follows the load
//   viewCam(crane, name) / VIEWS                                        the crane's cameras by name
//   readout(r, crane) -> { x, y, h, load }                              the readouts as words
//   chairScreen(W, crane) -> { update(dt) }                             the chair's middle screen showing them
import * as THREE from 'three';
import { expand, zonesOf } from '../kit/layout.js';
import { PIECES } from '../kit/catalog.js';
import { placeMatrix } from '../kit/grid.js';

const CSS = new URL('./cranedrive.css', import.meta.url).href;
export function ensureCss() {
  if (document.querySelector('link[data-pcd]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.pcd = '1'; document.head.appendChild(l);
}
const m1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

// ── the readouts in words: where the crane is as the grid counts it ────────────────────────────────────────────────
export function readout(r, crane) {
  const [gx, gy] = crane.grid(r.x, r.z);
  return { x: m1(gx), y: m1(gy), h: m1(r.hook) + ' m', load: r.held >= 0 ? 'a canister' : 'nothing' };
}

// ── the cameras: following the load; on the crane looking down; on the hangar's walls ─────────────────────────────
export const VIEWS = ['follow', 'crane', 'miner-cam-sw', 'miner-cam-nw', 'miner-cam-ne', 'miner-cam-se'];
export const VIEW_NAMES = { follow: 'Following the load', crane: 'From the crane, looking down', 'miner-cam-sw': 'Wall camera 1', 'miner-cam-nw': 'Wall camera 2', 'miner-cam-ne': 'Wall camera 3', 'miner-cam-se': 'Wall camera 4' };
export function viewCam(crane, name) { return crane.cams().find((c) => c.name === name) || null; }
// the view that follows the load: from the hangar's middle side of it, above, looking at the hook; `orbit` (radians)
// swings it round, `zoom` (metres) nearer or further; kept inside the hangar
export function followCam(W, site) {
  const mid = new THREE.Vector3((site.rail.x[0] + site.rail.x[1]) / 2, 0, (site.rail.z[0] + site.rail.z[1]) / 2);
  const at = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3(), hook = new THREE.Vector3();
  let fresh = true, base = null;
  const F = { orbit: 0, zoom: 9, fresh() { fresh = true; base = null; },
    aim(camera, S, dt, { fixed = null, shift = null } = {}) {
      if (fixed) {
        want.copy(fixed.at); wantLook.copy(fixed.look);
        if (camera.fov !== fixed.fov) { camera.fov = fixed.fov; camera.updateProjectionMatrix(); }
        // (the camera on the crane rides with it: no easing behind)
        if (fixed.down) { at.copy(want); look.copy(wantLook); camera.position.copy(at); camera.up.set(0, 0, -1); camera.lookAt(look); camera.up.set(0, 1, 0); return; }
      } else {
        if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
        hook.set(S.x, S.hoist, S.z);
        // (from the hangar's middle side of the hook, settled once and then only swung by hand)
        if (base == null) base = Math.atan2(mid.x - hook.x, mid.z - hook.z) || 0;
        const a = base + F.orbit, d = F.zoom;
        want.set(hook.x + Math.sin(a) * d, Math.min(8.0, Math.max(2.2, hook.y + 3.2)), hook.z + Math.cos(a) * d);
        want.x = Math.max(site.rail.x[0] - 1, Math.min(site.rail.x[1] + 1, want.x)); want.z = Math.max(site.rail.z[0] - 0.6, Math.min(site.rail.z[1] + 0.6, want.z));
        wantLook.copy(hook); wantLook.y -= 0.9;
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

// a push on the stick (x right, y forward on the screen) as a push across the station's plane, from the camera (or
// from `ahead`, the screen's level forward as it was when the push began: see openDrive)
const _f = new THREE.Vector3(), _u = new THREE.Vector3();
export function screenAhead(camera) {
  camera.getWorldDirection(_f); _f.y = 0;
  if (_f.lengthSq() < 0.09) { _u.set(0, 1, 0).applyQuaternion(camera.quaternion); _u.y = 0; _f.copy(_u); }   // (looking straight down: the screen's up)
  return _f.lengthSq() < 1e-6 ? null : _f.clone().normalize();
}
export function pushFrom(camera, move, ahead = null) {
  if (!move || !move.mag) return [0, 0];
  const f = ahead ? ahead.clone() : screenAhead(camera); if (!f) return [0, 0];
  const rx = -f.z, rz = f.x;   // (the screen's right, level)
  const m = Math.min(1, move.mag || Math.hypot(move.x, move.y)), len = Math.hypot(move.x, move.y) || 1;
  const x = move.x / len * m, y = move.y / len * m;
  return [rx * x + f.x * y, rz * x + f.z * y];
}
// (a push mostly along one of the crane's two ways, the bridge's or the trolley's, goes that way only: the view is
// seldom square to the hangar, and a push meant along x should not creep along y)
const SQUARE = 0.75;
export function squarePush(push) {
  const [x, z] = push; if (!x && !z) return push;
  const m = Math.hypot(x, z);
  if (Math.abs(z) < Math.abs(x) * SQUARE) return [Math.sign(x) * m, 0];
  if (Math.abs(x) < Math.abs(z) * SQUARE) return [0, Math.sign(z) * m];
  return push;
}

// ── the light dots: the crane's three docking lights, here too ────────────────────────────────────────────────────
const dot = (look) => `<i class="pcd-dot is-${look}" aria-hidden="true"></i>`;

// ── the HUD ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function openDrive(root, { crane, input, W, walls, onClose = () => {}, onGame = null } = {}) {
  ensureCss();
  const el = document.createElement('div');
  el.className = 'pcd';
  el.innerHTML = `
    <header class="pcd-top">
      <div class="pcd-title"><b>Free control</b><small>The crane by hand: just for fun</small></div>
      ${onGame ? '<button type="button" class="pcd-swap" aria-label="Back to the crane game">Crane game</button>' : ''}
      <button type="button" class="pcd-done" aria-label="Done (Esc)">Done<kbd>Esc</kbd></button>
    </header>
    <dl class="pcd-reads" aria-live="off">
      <div><dt>X</dt><dd data-r="x"></dd><dd class="pcd-aid" data-a="x"></dd></div>
      <div><dt>Y</dt><dd data-r="y"></dd><dd class="pcd-aid" data-a="y"></dd></div>
      <div><dt>Height</dt><dd data-r="h"></dd><dd class="pcd-aid" data-a="h"></dd></div>
      <div><dt>Holding</dt><dd data-r="load"></dd><dd></dd></div>
    </dl>
    <p class="pcd-view-name" aria-live="polite"></p>
    <p class="pcd-hint" aria-live="polite"></p>
    <div class="pcd-pad" role="group" aria-label="The hoist and the turn">
      <button type="button" class="pcd-btn pcd-up" data-hold="up" aria-label="Up (R)">&#9650;<small>Up</small><kbd>R</kbd></button>
      <button type="button" class="pcd-btn pcd-down" data-hold="down" aria-label="Down (F)">&#9660;<small>Down</small><kbd>F</kbd></button>
      <button type="button" class="pcd-btn pcd-ccw" data-hold="ccw" aria-label="Turn the canister one way (Q)">&#8634;<small>Turn</small><kbd>Q</kbd></button>
      <button type="button" class="pcd-btn pcd-cw" data-hold="cw" aria-label="Turn the canister the other way (E)">&#8635;<small>Turn</small><kbd>E</kbd></button>
      <button type="button" class="pcd-btn pcd-view" data-act="view" aria-label="Change the view (V)">View<kbd>V</kbd></button>
    </div>
    <p class="pcd-stickhint">${'ontouchstart' in window || (input && input.touch) ? 'Drag on the left to move the crane' : 'WASD or the arrows move the crane'}</p>
    <div class="pcd-wait" hidden>The crane is finishing its move&hellip;</div>
    <div class="pcd-notice" hidden role="alert"></div>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const held = { up: false, down: false, ccw: false, cw: false };
  let closed = false, view = 0, noteText = '', noteT = 0, t = 0, lastViol = null, violations = 0, noticeT = -9;
  // (a push keeps the way it was given while it is held, though the view swings round: let go and push again)
  let ahead = null;
  const cam = followCam(W, crane.site);
  if (input) input.enabled = true;
  crane.take();

  // (the hold buttons: pressed while a finger or the mouse is down on them)
  el.querySelectorAll('[data-hold]').forEach((b) => {
    const k = b.dataset.hold, on = (e) => { e.preventDefault(); held[k] = true; b.classList.add('is-on'); }, off = () => { held[k] = false; b.classList.remove('is-on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });
  el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act)));
  $('.pcd-done').addEventListener('click', () => close());
  if (onGame) $('.pcd-swap').addEventListener('click', () => { if (!closed) onGame(); });
  function act(a) { if (a === 'view') { view = (view + 1) % VIEWS.length; cam.fresh(); showView(); } }
  function showView() { const n = $('.pcd-view-name'); n.textContent = VIEW_NAMES[VIEWS[view]] || ''; n.classList.remove('is-show'); void n.offsetWidth; n.classList.add('is-show'); }
  // (keys: the shared input reads the stick and WASD; these are the crane's own; Esc is ours while it is up)
  function onKey(e) {
    if (closed) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if (e.repeat) return;
    if (e.code === 'KeyV') act('view');
  }
  addEventListener('keydown', onKey, true);

  function update(dt) {
    if (closed) return;
    t += dt;
    const D = crane.live;
    $('.pcd-wait').hidden = !!D || crane.mode !== 'handover';
    // the look and the zoom are the crane camera's while it is up
    if (input) {
      const Lk = input.takeLook(); if (VIEWS[view] === 'follow') cam.orbit = Math.max(-2.6, Math.min(2.6, cam.orbit - Lk.dx * 0.006));
      const z = input.takeZoom(); if (z) cam.zoom = Math.max(4, Math.min(16, cam.zoom + z * 0.8));
    }
    if (!D) return;
    const kb = (c) => !!(input && input.enabled && input.held && input.held(c));
    const up = held.up || kb('KeyR') || kb('Space'), down = held.down || kb('KeyF') || kb('KeyC');
    const ccw = held.ccw || kb('KeyQ'), cw = held.cw || kb('KeyE');
    const mv = input && input.move;
    if (!(mv && mv.mag)) ahead = null;
    else if (!ahead) ahead = screenAhead(W.camera);
    crane.command({ move: squarePush(pushFrom(W.camera, mv, ahead)), hoist: (up ? 1 : 0) - (down ? 1 : 0), turn: (cw ? 1 : 0) - (ccw ? 1 : 0) });
    crane.places = placeLights(D);
    show(D, D.read());
  }
  // the place lights: the place it is lined up with, amber, green once it is right in all three ways
  function placeLights(D) {
    const P = D.place; if (!P || P.kind === 'socket') return [];
    const a = D.aid || {}, all = a.x === 'on' && a.y === 'on';
    return [{ kind: P.kind, i: P.i, look: all ? 'on' : 'near' }];
  }
  function show(D, r) {
    const w = readout(r, crane);
    for (const k of ['x', 'y', 'h', 'load']) { const dd = el.querySelector(`[data-r="${k}"]`); if (dd.textContent !== w[k]) dd.textContent = w[k]; }
    for (const k of ['x', 'y', 'h']) { const dd = el.querySelector(`[data-a="${k}"]`), look = (r.aids && r.aids[k]) || 'off', h = dot(look); if (dd.dataset.look !== look) { dd.dataset.look = look; dd.innerHTML = h; } }
    // the joke: a load brought low over someone, and they ran
    const v = crane.violation;
    if (v && v !== lastViol) { lastViol = v; violations++; noticeT = t; const n = $('.pcd-notice'); n.innerHTML = `<b>Safety violation!</b><span>${v.n === 1 ? `You swung a load over ${esc(v.who[0] || 'someone')}. They ran for it.` : `You swung a load over ${v.n} people. They ran for it.`}</span><small>Violations today: ${violations}</small>`; n.hidden = false; n.classList.remove('is-pop'); void n.offsetWidth; n.classList.add('is-pop'); }
    if (!$('.pcd-notice').hidden && t - noticeT > 4.5) $('.pcd-notice').hidden = true;
    // the hint: what it would not do just now, else what to do next
    const n = D.notes.find((q) => q.key !== 'people');
    if (n) { noteText = n.text; noteT = t; }
    let hint = '';
    const P = r.place;
    if (noteText && t - noteT < 2.2) hint = noteText;
    else if (D.busy && D.action === 'shut') hint = 'Grabbing it...';
    else if (D.busy && D.action === 'open') hint = 'Letting go...';
    else if (r.held < 0) hint = P ? 'Lower the grab onto the canister: it grabs it by itself.' : 'Bring the grab over a canister (on the ship, the rack or in a socket), then lower it.';
    else hint = P && P.kind === 'socket' ? `Socket ${crane.site.sockets[P.i].number}: lower it to the socket's height and it docks.` : P ? 'Lower it: it lets go by itself when it is down.' : 'Take it to a socket, a ship\'s tray or the rack.';
    const h = $('.pcd-hint'); if (h.textContent !== hint) { h.textContent = hint; h.classList.toggle('is-note', !!noteText && t - noteT < 2.2); }
  }
  function aim(camera, dt) {
    const S = crane.live ? crane.live.state : crane.L.state(crane.t), v = VIEWS[view];
    cam.aim(camera, S, dt, { fixed: v === 'follow' ? null : viewCam(crane, v) });
  }
  function close(silent = false) {
    if (closed) return;
    closed = true;
    removeEventListener('keydown', onKey, true);
    crane.places = [];
    if (!silent) crane.give();
    el.classList.add('is-going');
    setTimeout(() => el.remove(), 250);
    onClose();
  }
  requestAnimationFrame(() => el.classList.add('is-on'));
  showView();
  return { el, update, aim, close, cam, act, get view() { return VIEWS[view]; }, state: () => ({ mode: crane.mode, view: VIEWS[view], hint: $('.pcd-hint').textContent, reads: [...el.querySelectorAll('[data-r]')].map((d) => d.textContent), aids: crane.live ? crane.live.read().aids : null, live: crane.live ? crane.live.read() : null, notice: $('.pcd-notice').hidden ? null : $('.pcd-notice').textContent, violations }) };
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
  function draw(w, mode) {
    g.fillStyle = '#071419'; g.fillRect(0, 0, 512, 336);
    g.strokeStyle = 'rgba(120, 220, 255, 0.35)'; g.lineWidth = 3; g.strokeRect(8, 8, 496, 320);
    g.font = '700 30px "Segoe UI", system-ui, sans-serif'; g.fillStyle = '#7fd8ff'; g.textAlign = 'left';
    g.fillText('CRANE', 26, 52);
    const words = { round: 'BY ITSELF', live: 'BY HAND', leaving: 'BY HAND', handover: 'BY HAND', landing: 'MINER LANDING', away: 'MINER AWAY' };
    g.font = '600 22px "Segoe UI", system-ui, sans-serif'; g.fillStyle = mode === 'round' ? '#8fa3b0' : '#ffb46b'; g.textAlign = 'right';
    g.fillText(crane.done && mode === 'round' ? 'ALL DONE' : words[mode] || '', 486, 50);
    const rows = [['X', w.x], ['Y', w.y], ['HEIGHT', w.h], ['HOLDING', w.load]];
    rows.forEach(([k, v], i) => {
      const y = 112 + i * 60;
      g.textAlign = 'left'; g.font = '600 22px "Segoe UI", system-ui, sans-serif'; g.fillStyle = '#6b8a96'; g.fillText(k, 26, y);
      g.font = '700 34px "Segoe UI", system-ui, sans-serif'; g.fillStyle = '#e8f7ff'; g.fillText(v, 190, y);
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
      else { const S = crane.L.state(crane.t); r = { x: S.x, z: S.z, hook: S.hoist, held: S.cans.findIndex((q) => q.where === 'held') }; }
      const w = readout(r, crane), s = JSON.stringify(w) + crane.mode + crane.done;
      if (s !== shown) { shown = s; draw(w, crane.mode); }
    },
  };
}
