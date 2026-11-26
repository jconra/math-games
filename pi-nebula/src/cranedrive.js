// FREE CONTROL: the smelter's bridge crane by hand, from the operator's chair, for fun, never needed. It is the "Free
// control" switch on the crane operator's screen (src/jobs/crane.js: the crane game is the screen's own default). The
// game's maker, 2026-11-16: "I think it would be more fun if you could do whatever you wanted with it. If people are in
// the way then they should start to run away and it should post a notice saying you committed a safety violation (as a
// joke) ... let the crane do whatever and make it entertaining." 2026-11-17 (CR2-3): docking a canister by hand pays
// "a little for each canister docked" (FREE below), and the notice threatens you too (CR2-2, THREATS below).
//
//   THE CONTROLS (the same on a computer and a phone):
//     move        the stick (a phone: wherever the left thumb lands) or WASD / the arrows: the load goes the way you
//                 push across the screen (a push within about 37 degrees of the hangar's x or y goes that way only)
//     up, down    the ▲ ▼ buttons (held), or R / F (Space / C as well)
//     turn        the ↺ ↻ buttons (held), or Q / E: the cradle turns the canister
//     view        the View button, or V: following the load (dragged round, all the way round), the crane's own
//                 looking straight down from the grab (a crosshair and a box to line up by), one wall camera
//                 (src/craneview.js: the game's maker, 2026-11-26)
//     done        Done, or Esc: the crane works its way up and the round takes over from where things are
//   THERE IS NO GRAB BUTTON: lowered onto a canister the crane takes it; lowered into a free place (a socket, a ship's
//   tray, a rack bay) it lets go; in front of a free socket at its height it pushes the canister in. Near a place it
//   lines itself up and turns to it; the three lights (on the crane, and here) go green when each way is right.
//
//   const D = openDrive(root, { crane, input, W, walls, onClose, onGame, onDock })   D.update(dt) (before the camera),
//                                     D.aim(camera, dt), D.close(), D.state() (for rigs); onGame: the screen's switch
//                                     back to the crane game; onDock(c, socket) -> the credits it paid (src/jobs/index.js)
//   followCam(W, site, solid) -> { aim(camera, S, dt, opts), orbit, zoom }   the view that follows the load
//   viewCam(crane, name) / VIEWS                                        the crane's cameras by name
//   readout(r, crane) -> { x, y, h, load }                              the readouts as words
//   chairScreen(W, crane) -> { update(dt) }                             the chair's middle screen showing them
import * as THREE from 'three';
import { expand, zonesOf } from '../kit/layout.js';
import { PIECES } from '../kit/catalog.js';
import { placeMatrix } from '../kit/grid.js';
import { VIEWS, VIEW_NAMES, WALL_CAM, orbitBy, orbitEye, clearAlong, hangarClear, fitFov, markOf, markCorners } from './craneview.js';
export { VIEWS, VIEW_NAMES };

const CSS = new URL('./cranedrive.css', import.meta.url).href;
export function ensureCss() {
  if (document.querySelector('link[data-pcd]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.pcd = '1'; document.head.appendChild(l);
}
const m1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

// THE PAY BY HAND (the game's maker, CR2-3, "A little for each canister docked"): a canister of ore docked in a socket
// by hand pays FREE.dock, once for each canister in a haul (taking it out and docking it again pays nothing more). 20
// credits, a tenth or less of a crane game answer (50 to 190): a docking by hand takes a minute or so of driving, where
// an answer takes a few seconds of sums, so the math stays the way to earn and free control stays the fun extra; a
// whole haul by hand (8 canisters) pays 160, about one answer's worth.
export const FREE = { dock: 20 };
// THE JOKE NOTICE'S SECOND LINE (the game's maker, CR2-2: "it might be funny if it threatened you in some way too. Like
// 'Any more violations and your rations will be limited to broccoli.' or 'Any more violations and Nickelback will be
// playing in your quarters 24/7'"): his two and more in the same spirit, a different one each time (all of them before
// any comes round again)
export const THREATS = [
  'Any more violations and your rations will be limited to broccoli.',
  'Any more violations and Nickelback will be playing in your quarters 24/7.',
  'Any more violations and you will count every rivet in this hangar. Twice.',
  'Any more violations and you will teach the next safety class. In a chicken suit.',
  'Any more violations and all your socks will be one size too small.',
  'Any more violations and you will sing the safety song at breakfast. All twelve verses.',
  'Any more violations and the cleaning robot will follow you everywhere, beeping.',
  'Any more violations and your hot chocolate comes without marshmallows. For a week.',
];
let threatDeck = [], threatLast = null;
export function nextThreat(rand = Math.random) {
  if (!threatDeck.length) {
    threatDeck = THREATS.slice();
    for (let i = threatDeck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [threatDeck[i], threatDeck[j]] = [threatDeck[j], threatDeck[i]]; }
    // (never the same one twice running, from one deck to the next)
    if (threatDeck[threatDeck.length - 1] === threatLast) [threatDeck[0], threatDeck[threatDeck.length - 1]] = [threatDeck[threatDeck.length - 1], threatDeck[0]];
  }
  threatLast = threatDeck.pop();
  return threatLast;
}
// (the grid's name for each of the drive's docking lights: the drive's x is the bridge's, along the station's X, the
// grid's y in the Miner hangar; its y the trolley's)
const gridNames = (crane) => { const [ax] = crane.grid(1, 0), [ox] = crane.grid(0, 0), bridge = Math.abs(ax - ox) > 0.5 ? 'x' : 'y'; return { x: bridge, y: bridge === 'x' ? 'y' : 'x', h: 'h' }; };
// ── the readouts in words: where the crane is as the grid counts it ────────────────────────────────────────────────
export function readout(r, crane) {
  const [gx, gy] = crane.grid(r.x, r.z);
  return { x: m1(gx), y: m1(gy), h: m1(r.hook) + ' m', load: r.held >= 0 ? 'a canister' : 'nothing' };
}

// ── the cameras: following the load; on the grab looking straight down; one on the hangar's wall ────────────────
// (src/craneview.js: VIEWS, the orbit's sums, the crane's own camera, the mark)
export function viewCam(crane, name) { return crane.cams().find((c) => c.name === name) || null; }
const NEAR = 0.03;   // (the game's own near plane: src/station.js)
// the view that follows the load: from the hangar's middle side of it, above, looking at the hook; `orbit` (radians)
// swings it round, all the way round; `zoom` (metres) nearer or further. Where it would be behind a wall or inside
// something (solid: the crane's own look-up of what stands still), it is brought in along its line to the hook as far
// as is clear
export function followCam(W, site, solid = null) {
  const mid = new THREE.Vector3((site.rail.x[0] + site.rail.x[1]) / 2, 0, (site.rail.z[0] + site.rail.z[1]) / 2);
  const at = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3(), hook = new THREE.Vector3(), drawn = new THREE.Vector3();
  const clear = hangarClear(site, solid), tight = hangarClear(site, solid, { r: 0.15 }), _a = [0, 0, 0], _b = [0, 0, 0];
  // (from the look toward p, as far as is clear: p brought in along that line)
  const bringIn = (p, from, ok = clear) => { _a[0] = from.x; _a[1] = from.y; _a[2] = from.z; _b[0] = p.x; _b[1] = p.y; _b[2] = p.z; const L = p.distanceTo(from), t = clearAlong(_a, _b, ok); if (t < 1) p.lerpVectors(from, p, Math.max(Math.min(1, 1.2 / Math.max(L, 1e-6)), t)); return p; };
  // (the load as a ball round the hook: a held canister, or the empty grab)
  const loadR = Math.hypot(site.can.half, site.dims.R) + 0.2, grabR = site.dims.grip.half + 0.3;
  let fresh = true, base = null, fov = 62, share = 1;
  const F = { orbit: 0, zoom: 9, fresh() { fresh = true; base = null; },
    aim(camera, S, dt, { fixed = null, shift = null } = {}) {
      // (the crane's own camera puts its near plane past a held canister: back to the game's own otherwise)
      const near = (fixed && fixed.near) || NEAR;
      if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
      if (fixed) {
        want.copy(fixed.at); wantLook.copy(fixed.look);
        if (camera.fov !== fixed.fov) { camera.fov = fixed.fov; camera.updateProjectionMatrix(); }
        // (the camera on the crane rides with it: no easing behind)
        if (fixed.down) { at.copy(want); look.copy(wantLook); camera.position.copy(at); camera.up.set(0, 0, -1); camera.lookAt(look); camera.up.set(0, 1, 0); return; }
      } else {
        hook.set(S.x, S.hoist, S.z);
        // (from the hangar's middle side of the hook, settled once and then only swung by hand)
        if (base == null) base = Math.atan2(mid.x - hook.x, mid.z - hook.z) || 0;
        const d = F.zoom;
        want.fromArray(orbitEye([hook.x, hook.y, hook.z], base, F.orbit, d));
        wantLook.copy(hook); wantLook.y -= 0.9;
        // (behind a wall, or inside the ship or the rack: brought in along its line to the hook)
        bringIn(want, wantLook);
        // (brought in close, it looks at the load itself rather than under it, so the load stays in the middle)
        const near = Math.min(1, Math.max(0, (Math.hypot(want.x - hook.x, want.z - hook.z) - 2.5) / 4));
        wantLook.y = hook.y - 0.9 * near;
        if (shift) { const fx = wantLook.x - want.x, fz = wantLook.z - want.z, L = Math.hypot(fx, fz) || 1; wantLook.x += (-fz / L) * shift[0] * d; wantLook.z += (fx / L) * shift[0] * d; wantLook.y += shift[1] * d; }
      }
      // (it starts where it belongs, not swooping there through the walls)
      const fresh0 = fresh;
      if (fresh) { at.copy(want); look.copy(wantLook); fresh = false; }
      const k = 1 - Math.exp(-4.5 * dt), kl = 1 - Math.exp(-7 * dt);
      at.lerp(want, k); look.lerp(wantLook, kl);
      // (the place it has eased to is clear as a rule, the place it wants having been: brought in only if not, and on a
      // tighter rule than the one it wants, so it never flickers to and fro at the edge)
      drawn.copy(at);
      if (!fixed) {
        // (in at once where it must be, so never inside anything; back out easing, so never a jump)
        let want1 = 1;
        if (!tight(drawn.x, drawn.y, drawn.z)) { _a[0] = look.x; _a[1] = look.y; _a[2] = look.z; _b[0] = drawn.x; _b[1] = drawn.y; _b[2] = drawn.z; want1 = Math.max(Math.min(1, 1.2 / Math.max(drawn.distanceTo(look), 1e-6)), clearAlong(_a, _b, tight)); }
        share = fresh0 || want1 < share ? want1 : share + (want1 - share) * (1 - Math.exp(-6 * dt));
        if (share < 1) drawn.lerpVectors(look, at, share);
        // (brought in close on a wall's side: the lens a little wider, easing, so the load stays wholly in the picture)
        const held = S.cans && S.cans.some((q) => q.where === 'held'), d = drawn.distanceTo(hook);
        const wantFov = fitFov(62, camera.aspect || 1, d, held ? loadR : grabR);
        fov = fresh0 ? wantFov : fov + (wantFov - fov) * (1 - Math.exp(-5 * dt));
        if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
      }
      camera.position.copy(drawn); camera.lookAt(look);
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
export function openDrive(root, { crane, input, W, walls, onClose = () => {}, onGame = null, onDock = null } = {}) {
  ensureCss();
  // (the grid's axes as the drive's lights: aidOf.x is the light for the grid's x row)
  const named = gridNames(crane), aidOf = { [named.x]: 'x', [named.y]: 'y', h: 'h' }, gridOfAid = named;
  const el = document.createElement('div');
  el.className = 'pcd';
  el.innerHTML = `
    <svg class="pcd-mark" hidden aria-hidden="true"><polygon class="pcd-box"/><path class="pcd-cross"/></svg>
    <header class="pcd-top">
      <div class="pcd-title"><b>Free control</b><small>The crane by hand: ${FREE.dock} credits for each canister docked</small></div>
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
    <div class="pcd-notice" hidden role="alert"></div>
    <div class="pcd-paid" hidden aria-live="polite"></div>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const held = { up: false, down: false, ccw: false, cw: false };
  let closed = false, view = 0, noteText = '', noteT = 0, t = 0, lastViol = null, violations = 0, noticeT = -9;
  let lastHeld = null, lastPlace = null, done = null;   // (the hint line's memory: a grab or a let-go just now)
  let paidT = -9, earned = 0;                            // (the credits a docking by hand just paid, and in all this time)
  // (a push keeps the way it was given while it is held, though the view swings round: let go and push again)
  let ahead = null;
  const cam = followCam(W, crane.site, crane.world && crane.world.solid);
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
    // (sat down while the Miner was landing: the crane is taken once it is down)
    if (crane.mode === 'round') crane.take();
    const D = crane.live;
    $('.pcd-wait').hidden = !!D || (crane.mode !== 'handover' && crane.mode !== 'landing');
    if (crane.mode === 'landing') $('.pcd-wait').textContent = 'The Miner is landing: the crane waits.';
    // the look and the zoom are the crane camera's while it is up
    if (input) {
      // (the orbit has no stop: round and round, as often as you like; src/craneview.js)
      const Lk = input.takeLook(); if (VIEWS[view] === 'follow') cam.orbit = orbitBy(cam.orbit, Lk.dx);
      const z = input.takeZoom(); if (z) cam.zoom = Math.max(4, Math.min(16, cam.zoom + z * 0.8));
    }
    if (!D) return;
    const kb = (c) => !!(input && input.enabled && input.held && input.held(c));
    const up = held.up || kb('KeyR') || kb('Space'), down = held.down || kb('KeyF') || kb('KeyC');
    const ccw = held.ccw || kb('KeyQ'), cw = held.cw || kb('KeyE');
    const mv = input && input.move;
    if (!(mv && mv.mag)) ahead = null;
    else if (!ahead) ahead = screenAhead(W.camera);
    // (a rig's own hand on the stick: a station-plane command each frame, in place of the keys and the stick)
    if (api.pilot) crane.command(api.pilot(D) || {});
    else crane.command({ move: squarePush(pushFrom(W.camera, mv, ahead)), hoist: (up ? 1 : 0) - (down ? 1 : 0), turn: (cw ? 1 : 0) - (ccw ? 1 : 0) });
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
    for (const k of ['x', 'y', 'h']) { const dd = el.querySelector(`[data-a="${k}"]`), look = (r.aids && r.aids[aidOf[k]]) || 'off', h = dot(look); if (dd.dataset.look !== look) { dd.dataset.look = look; dd.innerHTML = h; } }
    // the joke: a load brought low over someone, and they ran
    const v = crane.violation;
    if (v && v !== lastViol) { lastViol = v; violations++; noticeT = t; const n = $('.pcd-notice'); n.innerHTML = `<b>Safety violation!</b><span>${v.n === 1 ? `You swung a load over ${esc((v.who[0] || 'someone').replace(/^(A|An|The) /, (m) => m.toLowerCase()))}. They ran for it.` : `You swung a load over ${v.n} people. They ran for it.`}</span><em>${esc(nextThreat())}</em><small>Violations today: ${violations}</small>`; n.hidden = false; n.classList.remove('is-pop'); void n.offsetWidth; n.classList.add('is-pop'); }
    if (!$('.pcd-notice').hidden && t - noticeT > 6.5) $('.pcd-notice').hidden = true;
    // the hint: what it would not do just now, else what to do next
    const n = D.notes.find((q) => q.key !== 'people');
    if (n) { noteText = n.text; noteT = t; }
    let hint = '';
    const P = r.place, A = r.aids || {}, site = crane.site;
    // (just after a grab or a let-go, what comes next, until the grab has moved on from there)
    if (r.held !== lastHeld) {
      if (lastHeld != null) done = { kind: r.held >= 0 ? 'got' : 'let', t, x: r.x, z: r.z, hook: r.hook, socket: lastPlace && lastPlace.kind === 'socket' ? site.sockets[lastPlace.i].number : null, paid: 0 };
      // (a canister of ore let go in a socket: docked by hand, and paid for, once a haul: onDock says how much)
      const was = lastHeld != null && lastHeld >= 0 ? D.state.cans[lastHeld] : null;
      if (done && done.kind === 'let' && was && was.where === 'socket' && was.fill > 0.5 && onDock) {
        let pay = 0; try { pay = onDock(lastHeld, done.socket) || 0; } catch (e) { console.warn('Pi Nebula: free control could not pay', e); }
        if (pay > 0) { done.paid = pay; earned += pay; paidT = t; const c = $('.pcd-paid'); c.textContent = `+${pay} credits`; c.hidden = false; c.classList.remove('is-pop'); void c.offsetWidth; c.classList.add('is-pop'); }
      }
      lastHeld = r.held;
    }
    if (!$('.pcd-paid').hidden && t - paidT > 2.4) $('.pcd-paid').hidden = true;
    lastPlace = P;
    // (a let-go is remembered until the grab has gone from over it, a grab until the load is lifted well clear)
    if (done && (t - done.t > 12 || Math.hypot(r.x - done.x, r.z - done.z) > 1.5 || (done.kind === 'got' && Math.abs(r.hook - done.hook) > 1.2))) done = null;
    // (lined up on a place: the light that is not green yet, by name)
    const notGreen = (ways) => ways.filter((w) => A[w] !== 'on');
    // (the lights by the grid's names: the readouts' X and Y rows)
    const AX = { x: gridOfAid.x.toUpperCase(), y: gridOfAid.y.toUpperCase(), h: 'height' };
    if (noteText && t - noteT < 2.2) hint = noteText;
    else if (D.busy && D.action === 'shut') hint = 'Grabbing it...';
    else if (D.busy && D.action === 'open') hint = 'Letting go...';
    else if (done && done.kind === 'let') hint = done.socket != null ? `Docked in socket ${done.socket}${done.paid ? `: +${done.paid} credits` : ''}. Take the grab up and away for the next canister.` : 'Set down. Take the grab up and away for the next canister.';
    else if (done && done.kind === 'got') hint = 'Got it! Lift it up, then take it to a socket, a ship\'s tray or the rack.';
    else if (r.held < 0 && P && P.kind === 'socket' && P.c >= 0 && D.state.cans[P.c] && D.state.cans[P.c].fill > 0.01) {
      // (over a canister that is still draining into the smelter: it may be taken back out, but that is not the job)
      hint = `Socket ${site.sockets[P.i].number}'s canister is draining into the smelter. Bring the next one from the ship.`;
    } else if (r.held < 0) {
      const off = P ? notGreen(['x', 'y']) : [];
      hint = !P ? 'Bring the grab over a canister (on the ship, the rack or in a socket), then lower it.'
        : off.length ? `Move until the ${off.map((w) => AX[w]).join(' and ')} light${off.length > 1 ? 's are' : ' is'} green over the canister.`
        : 'Lower the grab onto the canister: it grabs it by itself.';
    } else if (P && P.kind === 'socket') {
      const s = site.sockets[P.i], across = Math.abs(s.n[1]) > 0.5 ? 'x' : 'y';
      hint = A[across] !== 'on' ? `Socket ${s.number}: move until the ${AX[across]} light is green.`
        : A.h !== 'on' ? `Socket ${s.number}: ${r.hook > s.at[1] ? 'lower' : 'raise'} it until the height light is green.`
        : `Socket ${s.number}: lined up. It goes in by itself.`;
    } else if (P) {
      const off = notGreen(['x', 'y']);
      hint = off.length ? `Move until the ${off.map((w) => AX[w]).join(' and ')} light${off.length > 1 ? 's are' : ' is'} green.` : 'Lower it: it lets go by itself when it is down.';
    } else hint = 'Take it to a socket, a ship\'s tray or the rack.';
    const h = $('.pcd-hint'); if (h.textContent !== hint) { h.textContent = hint; h.classList.toggle('is-note', !!noteText && t - noteT < 2.2); }
  }
  function aim(camera, dt) {
    const S = crane.live ? crane.live.state : crane.L.state(crane.t), v = VIEWS[view];
    cam.aim(camera, S, dt, { fixed: v === 'follow' ? null : viewCam(crane, v) });
    drawMark(camera, v === 'crane' ? crane.live : null);
  }
  // THE MARK in the crane's own view (src/craneview.js markOf): a crosshair straight under the grab, and a box the size
  // of a canister where it (or the one it holds) will come down; amber and green as the docking lights
  const mark = $('.pcd-mark'), box = $('.pcd-box'), cross = $('.pcd-cross'), _p = new THREE.Vector3();
  let markLook = '', markAt = null;   // (markAt: where it is on the screen, for the rigs)
  function drawMark(camera, D) {
    if (!D) { if (!mark.hasAttribute('hidden')) mark.setAttribute('hidden', ''); markAt = null; return; }
    const w = innerWidth, h = innerHeight, r = D.read(), m = markOf(r, D.state, crane.site, crane.world && crane.world.solid);
    camera.updateMatrixWorld();
    const px = (p) => { _p.set(p[0], p[1], p[2]).project(camera); return [(_p.x + 1) / 2 * w, (1 - _p.y) / 2 * h, _p.z]; };
    const pts = markCorners(m).map(px);
    mark.setAttribute('viewBox', `0 0 ${w} ${h}`);
    // (a place at the grab's own height, nearer than the picture's near plane: no box, the crosshair alone)
    box.setAttribute('points', pts.every((q) => q[2] > -1 && q[2] < 1) ? pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ') : '');
    // (the crosshair: straight under the grab, on what it will come down on; a gap in its middle to see through)
    const [cx, cy] = px([r.x, m.at[1], r.z]), s = Math.max(22, Math.min(w, h) * 0.06), g = s * 0.35;
    cross.setAttribute('d', `M${cx - s},${cy}H${cx - g}M${cx + g},${cy}H${cx + s}M${cx},${cy - s}V${cy - g}M${cx},${cy + g}V${cy + s}`);
    if (m.look !== markLook) { markLook = m.look; mark.dataset.look = m.look; }
    markAt = { y: m.at[1], cross: [cx, cy], box: [pts.reduce((a, q) => a + q[0], 0) / 4, pts.reduce((a, q) => a + q[1], 0) / 4], look: m.look, place: m.place };
    if (mark.hasAttribute('hidden')) mark.removeAttribute('hidden');   // (an svg has no .hidden of its own)
  }
  function close(silent = false) {
    if (closed) return;
    closed = true;
    removeEventListener('keydown', onKey, true);
    crane.places = [];
    // (the crane's own camera may have left the near plane past a held canister)
    if (W.camera && W.camera.near !== NEAR) { W.camera.near = NEAR; W.camera.updateProjectionMatrix(); }
    el.classList.add('is-going');
    setTimeout(() => el.remove(), 250);
    // (silent: the crane game takes over, the crane still live)
    if (!silent) { crane.give(); onClose(); }
  }
  requestAnimationFrame(() => el.classList.add('is-on'));
  showView();
  const api = { el, update, aim, close, cam, act, pilot: null, get view() { return VIEWS[view]; }, setView(n) { const i = VIEWS.indexOf(n); if (i >= 0) { view = i; cam.fresh(); showView(); } }, state: () => ({ mode: crane.mode, view: VIEWS[view], hint: $('.pcd-hint').textContent, reads: [...el.querySelectorAll('[data-r]')].map((d) => d.textContent), dots: [...el.querySelectorAll('[data-a]')].map((d) => d.dataset.look || 'off'), aids: crane.live ? crane.live.read().aids : null, live: crane.live ? crane.live.read() : null, notice: $('.pcd-notice').hidden ? null : $('.pcd-notice').textContent, violations, earned, mark: markAt }) };
  return api;
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
const CHAIR_R = 1.12, CHAIR_STEP = 0.44;   // (kit/smelter.js CHAIR: the curve of screens' radius, the turn between two)
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
    const words = { round: 'BY ITSELF', live: 'BY HAND', leaving: 'BY HAND', handover: 'BY HAND', landing: 'MINER LANDING', away: 'MINER AWAY', out: 'MINER AWAY' };
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
  // THE CAMERAS ON THE CHAIR'S SCREENS (the game's maker: "It would be awesome if those camera views could be on that
  // display if you were just sitting there"): the screens either side of the middle one show a wall camera and the
  // crane's own looking down, live: small pictures, one of them drawn again every few frames, and only while the
  // chair is in view close by (nothing at all otherwise)
  const views = [-1, 1].map((k, n) => {
    const rt = new THREE.WebGLRenderTarget(320, 208, { type: THREE.HalfFloatType });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.365), new THREE.MeshBasicMaterial({ map: rt.texture }));
    const a = k * CHAIR_STEP, R = CHAIR_R;
    const block = new THREE.Matrix4().makeRotationY(a + Math.PI).setPosition(Math.sin(a) * R, 0, Math.cos(a) * R);
    const local = new THREE.Matrix4().makeRotationX(-tilt).setPosition(0, 0.83 + 0.024 * Math.sin(tilt) + 0.006 * nx, -0.02 + 0.024 * Math.cos(tilt) + 0.006 * -nz);
    m.matrixAutoUpdate = false; m.matrix.copy(block).multiply(local); holder.add(m);
    return { rt, mesh: m, cam: new THREE.PerspectiveCamera(70, 320 / 208, 0.05, 90), name: n ? 'crane' : WALL_CAM };
  });
  let turn = 0, frame = 0;
  const _cp = new THREE.Vector3();
  function drawViews() {
    const C = W.camera; holder.updateMatrixWorld(); _cp.setFromMatrixPosition(holder.matrixWorld);
    if (!holder.parent || C.position.distanceTo(_cp) > 7 || (C.view && C.view.enabled)) return;
    if (++frame % 6) return;
    const v = views[turn = (turn + 1) % views.length], c = crane.cams().find((q) => q.name === v.name); if (!c) return;
    v.cam.position.copy(c.at); if (c.down) v.cam.up.set(0, 0, -1); else v.cam.up.set(0, 1, 0); v.cam.lookAt(c.look); v.cam.fov = c.fov || 70; v.cam.near = c.near || 0.05; v.cam.updateProjectionMatrix();
    const R2 = W.renderer, was = R2.getRenderTarget(), fog = W.scene.fog;
    // (the screens themselves hidden while a picture is drawn: a wall camera can see them through the window, and a
    // screen drawn into its own picture is a feedback loop the GPU refuses)
    for (const q of views) q.mesh.visible = false;
    R2.setRenderTarget(v.rt); R2.render(W.scene, v.cam); R2.setRenderTarget(was);
    for (const q of views) q.mesh.visible = true;
    W.scene.fog = fog;
  }
  return {
    mesh, views,
    update(dt) {
      if (crane && crane.on) drawViews();
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
