// THE DOCK'S BRIDGE, LIVE: what joins the dock's questions (src/jobs/dock.js) to the bridge outside the docking port
// (kit/dockbridge.js). While the job is up:
//   - the camera is outside, beside the port, the bridge's plan faint from the station out to the crew module waiting at
//     the far end (the station's own outside round the port, the sky behind);
//   - a ring slides out of the last one, wobbling: its squares can fold. The card asks its question;
//   - THE YOUNGEST BRACE IT THEMSELVES: each wobbly square tapped (on the card, or on the ring itself) gets its brace,
//     two triangles, and stops wobbling (its twin on the far side of the tube too); every square braced is the answer;
//   - at the other levels a right answer puts the ring's braces in, one after another; a wrong one jolts the ring;
//   - braced, the ring locks: its hoop flashes, its glass goes on, its deck lights come on, and the next slides out;
//   - after TRY.rings rings, the try's end: a short card (src/jobs/panel.js over), "Build it again" or "Done".
// The panel's `live` (src/jobs/panel.js): ready(), right(q, coin), wrong(q, coin), and the dock's own: head(o) (the
// card's top: the bridge plan, which ring), play(o, ui) (the squares to tap), over() (the try's end), update(dt),
// aim(camera, dt), close(); state() for the rigs.
import * as THREE from 'three';
import { DOCK, STRUTS, PANELS, ring as ringParts, collar, crewModule, plan, meshesOf, FLOODS, MODULE_LIGHT, moduleAt } from '../../kit/dockbridge.js';
import { AIRLOCK } from '../../kit/hangar.js';
import { expand, zonesOf } from '../../kit/layout.js';
import { placeMatrix } from '../../kit/grid.js';
import { makeMaterials } from '../../kit/materials.js';
import { DIR as SKY } from '../../world/sky.js';
import { TRY, squareSvg } from './dock.js';

const CSS = new URL('./dock.css', import.meta.url).href;
function ensureCss() {
  if (document.querySelector('link[data-dkb]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.dkb = '1'; document.head.appendChild(l);
}
// how long things take (seconds), and the wobble (metres the far hoop bobs, how fast)
export const TIMES = { out: 1.0, brace: 0.13, pop: 0.32, lock: 0.75, glass: 0.9, jolt: 0.7, fade: 0.4 };
export const WOBBLE = { amp: 0.13, hz: 1.25, jolt: 0.22 };
// the squares a young player braces, as the card shows them: the panels on the camera's side (the near side, the one
// above it, the top), each with its twin across the tube (kit/dockbridge.js PANELS: 0 the +x side ... 4 the -x side)
const SQUARES = [4, 3, 2], TWIN = { 4: 0, 3: 1 };
// THE VIEW: the camera stands `from` the middle of the ring being built (metres, in the bridge's frame: to its side,
// above it, back toward the station), looking out along the bridge to the ship, and turns so that ring lands at the
// screen point `on` (-1..1 across, -1..1 up): on a wide screen left of the panel, on a phone in the band above it,
// whatever the screen's shape. It moves on with each ring. The end of the try: back a little, on the middle ring.
export const VIEW = {
  wide: { from: [-6.2, 3.6, -5.2], on: [-0.42, -0.05], fov: 50 },
  tall: { from: [-5.0, 5.6, -5.6], on: [0, 0.52], fov: 58 },
  end: { wide: { from: [-7.6, 4.6, -6.6], on: [-0.45, -0.1], fov: 50 }, tall: { from: [-6.2, 7.0, -6.8], on: [0, 0.5], fov: 60 } },
};
// the light outside (the kit's saved-light units): the sun, the planet's glow, the port's floodlights
const SUN = { i: 2.2, c: [1, 0.95, 0.88] }, SHINE = { i: 0.45, c: [0.55, 0.75, 1.0] }, FLOOD = { i: 7, c: [1, 0.97, 0.92], cone: [Math.cos(52 * Math.PI / 180), Math.cos(24 * Math.PI / 180)] };

const ease = (t) => t * t * (3 - 2 * t);
const back = (t) => { const s = 1.4; t -= 1; return t * t * ((s + 1) * t + s) + 1; };   // (out past its end, and back)
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// the outer port in the world: the station file's outer airlock piece (by name), its face away from `from` (the job's
// spot, on the station's side) -> the bridge's frame: on the floor at the port's outer face, +z out, y up
export function portFrame(W, from) {
  const m = new THREE.Matrix4();
  for (const zd of zonesOf(W.R)) for (const pl of expand(zd.pieces || [])) {
    if (pl.piece !== 'airlock' || pl.variant !== 'outer') continue;
    const M = placeMatrix(pl, m, zd.grid || W.R.grid || null);
    const c = new THREE.Vector3().setFromMatrixPosition(M), z = new THREE.Vector3(0, 0, 1).transformDirection(M);
    if ((from.x - c.x) * z.x + (from.z - c.z) * z.z > 0) z.negate();
    const o = c.clone().addScaledVector(z, AIRLOCK.skin), up = new THREE.Vector3(0, 1, 0), x = up.clone().cross(z).normalize();
    return new THREE.Matrix4().makeBasis(x, up, z).setPosition(o);
  }
  return null;
}

// ── the meshes: made once, the first time the job opens (kept for the next) ────────────────────────────────────────
let MADE = null;
function make(W, frame) {
  const t0 = performance.now(), mats = makeMaterials();
  // (outside: no haze; the glass faint)
  for (const m of Object.values(mats)) { m.fog = false; }
  // the light: the sun and the planet's glow (their world directions into the bridge's frame), the floodlights
  const inv = new THREE.Matrix4().copy(frame).invert(), sun = SKY.sun.clone().transformDirection(inv), shine = SKY.planet.clone().transformDirection(inv);
  const ML = MODULE_LIGHT(), _d = new THREE.Vector3(), _m = new THREE.Vector3(...ML.at);
  const light = (p, n) => {
    const out = [0, 0, 0], add = (k, c) => { out[0] += k * c[0]; out[1] += k * c[1]; out[2] += k * c[2]; };
    add(Math.max(0, n.dot(sun)) * SUN.i, SUN.c);
    add((0.35 + 0.65 * Math.max(0, n.dot(shine))) * SHINE.i, SHINE.c);
    for (const F of FLOODS) {
      _d.set(F.at[0] - p.x, F.at[1] - p.y, F.at[2] - p.z); const d2 = _d.lengthSq(), d = Math.sqrt(d2); _d.divideScalar(d || 1);
      const lam = Math.max(0, n.dot(_d)), cone = clamp01((-_d.dot(F.dir) - FLOOD.cone[0]) / (FLOOD.cone[1] - FLOOD.cone[0]));
      add(FLOOD.i * lam * ease(cone) / (d2 + 1.5), FLOOD.c);
    }
    _d.copy(_m).sub(p); const md2 = _d.lengthSq(); _d.normalize();
    add(ML.i * Math.max(0, n.dot(_d)) * clamp01(1 - Math.sqrt(md2) / ML.reach) / (md2 * 0.3 + 1), ML.color);
    return out;
  };
  const root = new THREE.Group(); root.name = 'dock: the bridge'; root.matrixAutoUpdate = false;
  const add = (to, list) => { for (const x of list) to.add(x); return list; };
  add(root, meshesOf(collar(), mats, light));
  const CM = crewModule(); add(root, [...meshesOf(CM.solid, mats, light), ...meshesOf(CM.glow, mats, light)]);
  // the plan: faint hoops where the rings will go, three lines along to the ship
  const planMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.75, 1.3), transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false, fog: false });
  const P = plan(), ghosts = P.hoops.map((g) => new THREE.Mesh(g, planMat));
  add(root, ghosts); root.add(new THREE.Mesh(P.lines, planMat));
  // the rings
  const outlineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.15, 0.25), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, fog: false });
  const hitMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const rings = [];
  for (let i = 0; i < DOCK.rings; i++) {
    const parts = ringParts(i), g = new THREE.Group(); g.name = 'dock: ring ' + (i + 1); g.matrixAutoUpdate = false; g.visible = false;
    // (the light as it falls where the ring will stand: its frame is the ring's own, moved along to its place)
    const z = DOCK.z0 + i * DOCK.L, lit = (p, n) => light(p.clone().setZ(p.z + z), n);
    add(g, meshesOf(parts.solid, mats, lit));
    const braces = parts.braces.map((b) => { const m = meshesOf(b, mats, lit)[0]; m.geometry.computeBoundingSphere(); m.userData.mid = m.geometry.boundingSphere.center.clone(); m.visible = false; g.add(m); return m; });
    const glassMat = mats.glass.clone(); glassMat.userData.full = mats.glass.opacity; glassMat.opacity = 0; glassMat.fog = false;
    const glass = new THREE.Mesh(parts.glass, glassMat); glass.visible = false; g.add(glass);
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false, fog: false });
    const glow = new THREE.Mesh(parts.glow, glowMat); g.add(glow);
    const stripMat = mats.glow.clone(); stripMat.color.setRGB(0.08, 0.08, 0.08);
    const strips = meshesOf(parts.strips, { glow: stripMat }, lit); add(g, strips);
    const outlines = parts.outlines.map((o) => { const m = new THREE.Mesh(o, outlineMat); m.visible = false; m.renderOrder = 3; g.add(m); return m; });
    const targets = parts.targets.map((t, j) => { const m = new THREE.Mesh(t, hitMat); m.visible = false; m.userData.panel = j; g.add(m); return m; });
    root.add(g);
    rings.push({ i, g, braces, glass, glassMat, glow, glowMat, stripMat, outlines, targets });
  }
  MADE = { root, rings, ghosts, outlineMat, planMat, ms: Math.round(performance.now() - t0) };
  return MADE;
}

export function dockLink({ W, walls = null, job, spot = null } = {}) {
  ensureCss();
  const from = spot || (W.place('airlock') || new THREE.Vector3());
  const frame = portFrame(W, from);
  if (!frame) { console.warn('dock: the station has no outer docking port: the bridge has nowhere to go'); return null; }
  const M = MADE || make(W, frame);
  M.root.matrix.copy(frame); M.root.matrixWorldNeedsUpdate = true;
  W.scene.add(M.root);
  const dustWas = W.dust ? W.dust.visible : false; if (W.dust) W.dust.visible = false;
  // (the camera is out in space: the station's rooms drawn are the ones seen from inside the port, the airlock)
  W.seenFrom = new THREE.Vector3(0, DOCK.c, -1.6).applyMatrix4(frame);

  // ── the rings' states: off, out (sliding out of the last), wait (asking: wobbling), brace (its braces going in),
  // lock (its glow, glass and lights), done ──────────────────────────────────────────────────────────────────────
  let cur = 0, answered = 0, finished = false, closed = false, clock = 0, order = null, ui = null, endT = -1;
  const S = M.rings.map(() => ({ state: 'off', t: 0, ext: 0, braced: new Set(), pop: new Map(), jolt: 0, loose: 1, flash: 0 }));
  function reset() {
    cur = 0; answered = 0; finished = false;
    S.forEach((s, i) => { Object.assign(s, { state: 'off', t: 0, ext: 0, jolt: 0, loose: 1, flash: 0 }); s.braced.clear(); s.pop.clear(); const R = M.rings[i]; R.g.visible = false; R.braces.forEach((b) => { b.visible = false; }); R.outlines.forEach((o) => { o.visible = false; }); R.glass.visible = false; R.glassMat.opacity = 0; R.glowMat.color.setRGB(0, 0, 0); R.stripMat.color.setRGB(0.08, 0.08, 0.08); });
    M.ghosts.forEach((g) => { g.visible = true; });
    slideOut(0);
  }
  function slideOut(i) { if (i >= S.length || i >= TRY.rings) return; const s = S[i]; s.state = 'out'; s.t = 0; s.ext = 0; M.rings[i].g.visible = true; M.ghosts[i].visible = false; }
  const isBrace = () => !!(order && order.play === 'brace');

  // ── the squares a young player braces ─────────────────────────────────────────────────────────────────────────
  function brace(k) {
    const s = S[cur]; if (!s || s.state !== 'wait' || !isBrace() || order.played) return false;
    const j = SQUARES[k]; if (j == null || s.braced.has(j)) return false;
    for (const p of [j, TWIN[j]]) if (p != null && !s.braced.has(p)) { s.braced.add(p); s.pop.set(p, 0); }
    const done = SQUARES.every((x) => s.braced.has(x));
    if (ui) {
      const b = ui.answers.querySelector(`.dkb-sq[data-k="${k}"]`); if (b) { b.classList.add('is-braced'); b.setAttribute('aria-pressed', 'true'); b.disabled = true; }
      markNext(ui.answers);
      const n = SQUARES.filter((x) => s.braced.has(x)).length, c = ui.answers.querySelector('.dkb-count');
      if (c) c.textContent = done ? 'All braced!' : `${n} of ${SQUARES.length} braced`;
    }
    // (a moment to see the last brace go in; then it is the answer, if the card is still this one)
    if (done) { order.played = true; const u = ui, o = order; setTimeout(() => { if (!closed && u && order === o) u.pick(0); }, 380); }
    return true;
  }
  // (the first square still to brace calls for a tap: a soft amber pulse)
  function markNext(root) { let first = true; root.querySelectorAll('.dkb-sq').forEach((b) => { const next = first && !b.classList.contains('is-braced'); if (next) first = false; b.classList.toggle('is-next', next); }); }
  // a tap on the ring itself: the panel found under it (only the squares on the camera's side count)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function onTap(e) {
    if (closed || !isBrace()) return;
    const s = S[cur]; if (!s || s.state !== 'wait') return;
    const r = W.renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, W.camera);
    const hits = ray.intersectObjects(M.rings[cur].targets.filter((t) => SQUARES.includes(t.userData.panel)), false);
    if (!hits.length) return;
    const k = SQUARES.indexOf(hits[0].object.userData.panel);
    if (k >= 0 && brace(k)) e.preventDefault();
  }
  W.renderer.domElement.addEventListener('pointerdown', onTap);
  // (on a keyboard, keys 1 to 3 brace the squares, as they pick the answers at the other levels)
  function onKey(e) { if (closed || !isBrace() || !/^[1-9]$/.test(e.key)) return; brace(+e.key - 1); }
  addEventListener('keydown', onKey);

  // ── the panel's live ──────────────────────────────────────────────────────────────────────────────────────────
  // (a card can be answered once its ring has slid out)
  function ready() {
    if (finished) return true;
    const s = S[cur]; if (!s) return true;
    if (s.state === 'wait') return true;
    return { ok: false, why: s.state === 'out' ? 'The next ring is sliding out...' : 'The ring is locking in...' };
  }
  function right() {
    const s = S[cur]; if (!s || s.state !== 'wait') return;
    s.state = 'brace'; s.t = 0; s.next = 0.1; s.last = -1;
    answered++;
    if (answered >= TRY.rings) finished = true;
  }
  function wrong() { const s = S[cur]; if (s && s.state === 'wait') s.jolt = 1; }
  // the card's top: the bridge's plan, which ring
  const ICON = '<svg class="dkb-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 6.5 L15.5 13.5 M4.5 13.5 L15.5 6.5 M10 2.8 V17.2" stroke="currentColor" stroke-width="1.6"/></svg>';
  function head() {
    const n = Math.min(cur + 1, TRY.rings);
    return `<header class="pnj-cardtop is-plan">${ICON}<b>Bridge plan</b><small>Ring ${n} of ${TRY.rings}</small></header>`;
  }
  // the squares to tap, in place of the answers (the order's one coin is "every square braced")
  function play(o, u) {
    order = o; ui = u;
    if (!o || o.play !== 'brace') return false;
    const s = S[cur], braced = (k) => !!(s && s.braced.has(SQUARES[k]));
    const strip = document.createElement('div');
    strip.className = 'dkb-strip'; strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', 'The wobbly squares of the new ring');
    strip.innerHTML = `<div class="dkb-sqs">${SQUARES.map((j, k) => `<button type="button" class="dkb-sq${braced(k) ? ' is-braced' : ''}" data-k="${k}" aria-label="Brace square ${k + 1}" aria-pressed="${braced(k)}"${braced(k) ? ' disabled' : ''}>${squareSvg(k)}</button>`).join('')}</div>`
      + `<p class="dkb-count">${SQUARES.filter((x, k) => braced(k)).length} of ${SQUARES.length} braced</p>`;
    u.answers.innerHTML = ''; u.answers.appendChild(strip);
    strip.querySelectorAll('.dkb-sq').forEach((b) => b.addEventListener('click', () => brace(+b.dataset.k)));
    markNext(strip);
    return true;
  }
  // the try's end, once its last ring is answered: the card in place of a question
  function over() {
    if (!finished) return null;
    return {
      html: `${head().replace(`Ring ${TRY.rings} of ${TRY.rings}`, 'The try')}
        <p class="pnj-story dkb-end"><b>That's the try!</b> ${TRY.rings} rings braced and locked.</p>
        <p class="pnj-story dkb-end2">The whole bridge is ${DOCK.rings} rings, all the way to the ship. Then the docking port opens.</p>`,
      buttons: [{ label: 'Build it again', again: () => reset() }, { label: 'Done' }],
    };
  }

  // ── each frame ────────────────────────────────────────────────────────────────────────────────────────────────
  const _sh = new THREE.Matrix4(), _sc = new THREE.Matrix4();
  function update(dt) {
    if (closed) return;
    clock += dt;
    S.forEach((s, i) => {
      const R = M.rings[i];
      if (s.state === 'off') return;
      s.t += dt;
      if (s.state === 'out') { s.ext = back(clamp01(s.t / TIMES.out)); if (s.t >= TIMES.out) { s.state = 'wait'; s.t = 0; s.ext = 1; } }
      // how loose the ring is: 1 with nothing braced, 0 braced all round (the young player's squares count one by one)
      const goal = s.state === 'wait' || s.state === 'out' ? 1 - SQUARES.filter((x) => s.braced.has(x)).length / SQUARES.length : 0;
      s.loose += (goal - s.loose) * (1 - Math.exp(-6 * dt));
      if (s.state === 'brace') {
        // (a right answer: the braces still out go in one after another, the camera's side first; then it locks, as
        // soon as the last is in: at once when a young player braced them all)
        const left = [...SQUARES, 0, 1].filter((p) => !s.braced.has(p));
        if (left.length && s.t >= s.next) { s.braced.add(left[0]); s.pop.set(left[0], 0); s.next = s.t + TIMES.brace; s.last = s.t; }
        if (!left.length && s.t >= s.last + TIMES.pop * 0.7) { s.state = 'lock'; s.t = 0; s.flash = 1; }
      }
      if (s.state === 'lock') {
        const k = clamp01(s.t / TIMES.lock);
        // the hoop's flash, settling to a soft line of light; the deck's strips come on; the glass goes on
        const f = Math.exp(-4 * s.t) * 9 + 0.9 * ease(k);
        R.glowMat.color.setRGB(0.35 * f, 0.85 * f, 1.4 * f);
        R.stripMat.color.setRGB(0.08 + 0.92 * ease(k), 0.08 + 0.92 * ease(k), 0.08 + 0.92 * ease(k));
        R.glass.visible = true; R.glassMat.opacity = R.glassMat.userData.full * ease(clamp01(s.t / TIMES.glass));
        if (s.t >= Math.max(TIMES.lock, TIMES.glass)) { s.state = 'done'; s.t = 0; cur = i + 1; slideOut(i + 1); }
      }
      // the braces popping in (the ones braced, each from nothing to a little past full and back)
      R.braces.forEach((b, j) => {
        const on = s.braced.has(j); b.visible = on; if (!on) return;
        const t = (s.pop.get(j) || 0) + dt; s.pop.set(j, t);
        const k = t >= TIMES.pop ? 1 : back(clamp01(t / TIMES.pop)), mid = b.userData.mid;
        b.scale.setScalar(Math.max(0.001, k)); b.position.copy(mid).multiplyScalar(1 - k);
      });
      // the squares still to brace marked (a young player's), pulsing
      R.outlines.forEach((o, j) => { o.visible = s.state === 'wait' && isBrace() && SQUARES.includes(j) && !s.braced.has(j); });
      // the wobble: the far hoop bobbing up and down (the squares folding), less as it is braced; a jolt for a wrong answer
      s.jolt = Math.max(0, s.jolt - dt / TIMES.jolt);
      const amp = WOBBLE.amp * s.loose + WOBBLE.jolt * s.jolt * s.jolt, k = amp * Math.sin(clock * WOBBLE.hz * 2 * Math.PI + i) + (s.jolt > 0 ? WOBBLE.jolt * s.jolt * Math.sin(clock * 19) : 0);
      _sh.set(1, 0, 0, 0, 0, 1, k / DOCK.L, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      _sc.makeScale(1, 1, Math.max(0.02, s.ext));
      R.g.matrix.makeTranslation(0, 0, DOCK.z0 + i * DOCK.L).multiply(_sh).multiply(_sc); R.g.matrixWorldNeedsUpdate = true;
    });
    M.outlineMat.opacity = 0.55 + 0.4 * Math.sin(clock * 5);
    // the try done (its last ring locked): the rings' hoops light up one after another, out along the bridge, again
    // and again, while the end card is up
    if (finished && S.every((s, i) => i >= TRY.rings || s.state === 'done')) {
      if (endT < 0) endT = clock;
      const t = (clock - endT) * 2.2 % (TRY.rings + 2.5);
      for (let i = 0; i < TRY.rings; i++) { const f = 0.9 + 5 * Math.max(0, 1 - Math.abs(t - i - 0.5) * 1.4); M.rings[i].glowMat.color.setRGB(0.35 * f, 0.85 * f, 1.4 * f); }
    } else endT = -1;
  }

  // ── the camera: outside, beside the port ──────────────────────────────────────────────────────────────────────
  const want = new THREE.Vector3(), ringAt = new THREE.Vector3(), probe = new THREE.PerspectiveCamera();
  const camPos = new THREE.Vector3(), camQ = new THREE.Quaternion();   // (the view's own, eased: the walking camera has it each frame first)
  let fresh = true, forced = null;   // (forced: a ring to look at, for the rigs)
  // where the camera wants to be, and which way it wants to face, for ring i (into `want` and probe.quaternion)
  function poseFor(V, i, aspect) {
    ringAt.set(0, DOCK.c, DOCK.z0 + (i + 0.5) * DOCK.L).applyMatrix4(frame);
    want.set(V.from[0], V.from[1] + DOCK.c, V.from[2] + DOCK.z0 + (i + 0.5) * DOCK.L).applyMatrix4(frame);
    probe.position.copy(want); probe.up.set(0, 1, 0); probe.lookAt(ringAt);
    // (turned so the ring sits at V.on: right to put it left, down to put it high)
    const tv = Math.tan(V.fov * Math.PI / 360), th = tv * aspect;
    probe.rotateY(Math.atan(V.on[0] * th)); probe.rotateX(-Math.atan(V.on[1] * tv));
  }
  function aim(camera, dt = 1 / 60) {
    const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640;
    const end = finished && S.every((s, i) => i >= TRY.rings || s.state === 'done');
    const V = end ? VIEW.end[tall ? 'tall' : 'wide'] : VIEW[tall ? 'tall' : 'wide'];
    poseFor(V, forced != null ? forced : end ? (TRY.rings - 1) / 2 : Math.min(cur, TRY.rings - 1), camera.aspect || innerWidth / innerHeight);
    if (fresh) { camPos.copy(want); camQ.copy(probe.quaternion); fresh = false; }
    const k = 1 - Math.exp(-2.5 * dt);
    camPos.lerp(want, k); camQ.slerp(probe.quaternion, k);
    camera.position.copy(camPos); camera.quaternion.copy(camQ);
    if (camera.fov !== V.fov) { camera.fov = V.fov; camera.updateProjectionMatrix(); }
  }
  // (a short fade from black as the view goes outside, and again as it comes back in)
  function fade() {
    const f = document.createElement('div'); f.className = 'dkb-fade'; document.body.appendChild(f);
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add('is-gone')));
    setTimeout(() => f.remove(), TIMES.fade * 1000 + 300);
  }
  fade();

  function close() {
    if (closed) return;
    closed = true;
    W.renderer.domElement.removeEventListener('pointerdown', onTap);
    removeEventListener('keydown', onKey);
    W.scene.remove(M.root);
    W.seenFrom = null;
    if (W.dust) W.dust.visible = dustWas;
    fade();
  }
  reset();
  return {
    ready, right, wrong, head, play, over, update, aim, close,
    // (for the rigs: the rings' states, the squares to tap on screen, a tap on one of them)
    state: () => ({ cur, answered, finished, rings: S.slice(0, TRY.rings).map((s) => ({ state: s.state, braced: [...s.braced].sort(), loose: +s.loose.toFixed(2) })), made: M.ms }),
    lookAtRing: (i = null) => { forced = i; },
    // (where ring i's squares are on the screen, as the camera is now: its squares' middles, standing still)
    squaresOnScreen: (i = cur) => {
      const r = W.renderer.domElement.getBoundingClientRect(), out = [], v = new THREE.Vector3();
      if (!M.rings[i]) return out;
      W.camera.updateMatrixWorld();
      for (const t of M.rings[i].targets) {
        const j = t.userData.panel; if (!SQUARES.includes(j)) continue;
        t.geometry.computeBoundingSphere(); v.copy(t.geometry.boundingSphere.center); v.z += DOCK.z0 + i * DOCK.L;
        v.applyMatrix4(frame).project(W.camera);
        out.push({ k: SQUARES.indexOf(j), x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height });
      }
      return out;
    },
    brace,
  };
}
