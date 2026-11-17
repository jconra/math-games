// THE DOCK'S BRIDGE, LIVE: what joins the dock's questions (src/jobs/dock.js) to the bridge outside the docking port
// (kit/dockbridge.js). While the job is up:
//   - the camera is outside, beside the port, the bridge's plan faint from the station out to the crew module waiting at
//     the far end (the station's own outside round the port, the sky behind);
//   - a ring slides out of the last one, wobbling: its squares can fold. The card asks its question;
//   - THE YOUNGEST BRACE IT THEMSELVES: each wobbly square tapped (on the card, or on the ring itself) gets its brace,
//     two triangles, and stops wobbling (its twin on the far side of the tube too); every square braced is the answer;
//   - at the other levels a right answer puts the ring's braces in, one after another; a wrong one jolts the ring;
//   - braced, the ring locks: its hoop flashes, its glass goes on, its deck lights come on, and the next slides out;
//   - THE RINGS STAY BUILT (the game's maker, DT-6: "Keep them, but build a new bridge for each ship that docks"): the
//     crew member's bridge for the ship at the port now (src/jobs/dock.js bridgeOf) is kept between visits; the job
//     opens with the rings built so far in place, locked and lit, and the next slides out;
//   - its ninth ring reaches the ship: a wave of light out along the bridge, the ship's docking lights turn green, the
//     port opens, and the end card (src/jobs/panel.js over): "Next ship" (the next ship comes: a new bridge from ring 1)
//     or "Done" (the next visit starts the next ship's bridge). One ship waits at a time.
// The panel's `live` (src/jobs/panel.js): ready(), right(q, coin), wrong(q, coin), and the dock's own: head(o) (the
// card's top: the bridge plan, which ring), play(o, ui) (the squares to tap), over() (the try's end), update(dt),
// aim(camera, dt), close(); state() for the rigs.
import * as THREE from 'three';
import { DOCK, ring as ringParts, collar, hull, crewModule, plan, meshesOf, FLOODS, MODULE_LIGHT } from '../../kit/dockbridge.js';
import { AIRLOCK } from '../../kit/hangar.js';
import { expand, zonesOf } from '../../kit/layout.js';
import { placeMatrix } from '../../kit/grid.js';
import { makeMaterials } from '../../kit/materials.js';
import { DIR as SKY } from '../../world/sky.js';
import { BRIDGE, squareSvg, bridgeOf, built, nextShip } from './dock.js';

const CSS = new URL('./dock.css', import.meta.url).href;
function ensureCss() {
  if (document.querySelector('link[data-dkb]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.dkb = '1'; document.head.appendChild(l);
}
// (loaded with the jobs, not when the job opens: its Start prompt's look on a phone is in it too)
if (typeof document !== 'undefined') ensureCss();
// how long things take (seconds), and the wobble (metres the far hoop bobs, how fast)
export const TIMES = { out: 1.0, brace: 0.13, pop: 0.32, lock: 0.75, glass: 0.9, jolt: 0.7, fade: 0.4, intro: 1.0 };
// the bridge's glass: a pale blue sheen to see against space (full: once on; flash: going in after a question about it)
export const GLASS = { color: 0x9ccff5, full: 0.2, flash: 0.55 };
export const WOBBLE = { amp: 0.3, side: 0.12, hz: 1.1, jolt: 0.3 };
const SHIP_RED = [1.6, 0.14, 0.1], SHIP_GREEN = [0.25, 2.2, 0.6];
// the squares a young player braces, as the card shows them: the panels on the camera's side (the near side, the one
// above it, the top), each with its twin across the tube (kit/dockbridge.js PANELS: 0 the +x side ... 4 the -x side)
const SQUARES = [4, 3, 2], TWIN = { 4: 0, 3: 1 };
// THE VIEW: the camera stands `from` the middle of the ring being built (metres, in the bridge's frame: to its side,
// above it, back toward the station), looking out along the bridge to the ship, and turns so that ring lands at the
// screen point `on` (-1..1 across, -1..1 up): on a wide screen left of the panel, on a phone in the band above it,
// whatever the screen's shape. It moves on with each ring. The end of the try: back a little, wider; and the job opens
// on the end's view for a moment (aim). (On a wide screen the camera stands just out from the port's face: from behind
// it the airlock module hid half of the first ring, which a young player taps.)
export const VIEW = {
  wide: { from: [-6.2, 3.6, -0.6], on: [-0.68, -0.1], fov: 54 },
  tall: { from: [-4.6, 6.4, -2.0], on: [0, 0.46], fov: 62 },
  // (the end: aimed further out, at the plan's fifth ring, so the rings built and the ship both show: on a wide screen
  // a little wider; on a phone up and back, the bridge's line running up the band to the ship)
  end: { wide: { from: [-7.6, 4.6, -2.6], on: [-0.35, -0.1], fov: 60, ring: 4 }, tall: { from: [-6.0, 12.0, -7.0], on: [0, 0.5], fov: 64, ring: 4 } },
  // (never further back toward the station than this, metres from the port's face: past it the camera would be in the
  // station's rooms, the terminal behind the airlock)
  back: -4.5,
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
  // (outside: no haze)
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
  // the station's outside round the port: plating over the room the port is in (its box, from the station as built)
  const zone = W.zoneAt(new THREE.Vector3(0, DOCK.c, -1.6).applyMatrix4(frame));
  if (zone) {
    const B = zone.box, P = [];
    for (const x of [B.min.x, B.max.x]) for (const y of [B.min.y, B.max.y]) for (const z of [B.min.z, B.max.z]) P.push(new THREE.Vector3(x, y, z).applyMatrix4(inv));
    const lo = (k) => Math.min(...P.map((p) => p[k])), hi = (k) => Math.max(...P.map((p) => p[k]));
    add(root, meshesOf(hull({ x0: lo('x'), x1: hi('x'), y0: lo('y'), y1: hi('y'), z0: lo('z'), z1: Math.min(hi('z'), -0.02) }), mats, light));
  }
  const CM = crewModule(); add(root, [...meshesOf(CM.solid, mats, light), ...meshesOf(CM.glow, mats, light)]);
  // (the ship's docking lights: red while the bridge has not reached it; green as the try's end reaches it)
  const shipLights = mats.glow.clone(); shipLights.color.setRGB(...SHIP_RED); add(root, meshesOf(CM.lights, { glow: shipLights }, light));
  // the plan: faint hoops where the rings will go (each its own, to light up at the try's end), three lines along
  const planMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.75, 1.3), transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false, fog: false });
  const P = plan(), ghosts = P.hoops.map((g) => new THREE.Mesh(g, planMat.clone()));
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
    // (its own glass, not the kit's: the kit's window glass is dark, made for looking out of a lit room, and out here
    // against space it could not be seen at all)
    const glassMat = new THREE.MeshBasicMaterial({ color: GLASS.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    glassMat.userData.full = GLASS.full;
    const glass = new THREE.Mesh(parts.glass, glassMat); glass.visible = false; g.add(glass);
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false, fog: false });
    const glow = new THREE.Mesh(parts.glow, glowMat); g.add(glow);
    const stripMat = mats.glow.clone(); stripMat.color.setRGB(0.08, 0.08, 0.08);
    const strips = meshesOf(parts.strips, { glow: stripMat }, lit); add(g, strips);
    const outlines = parts.outlines.map((o) => { const m = new THREE.Mesh(o, outlineMat); m.visible = false; m.renderOrder = 3; g.add(m); return m; });
    const targets = parts.targets.map((t, j) => { const m = new THREE.Mesh(t, hitMat); m.visible = false; m.userData.panel = j; g.add(m); return m; });
    // (a square's flash as its brace goes in: the panel lit for a moment, so a tap on the card shows on the ring)
    const flashes = parts.targets.map((t) => { const m = new THREE.Mesh(t, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 2.6), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); m.visible = false; m.renderOrder = 4; g.add(m); return m; });
    root.add(g);
    rings.push({ i, g, braces, glass, glassMat, glow, glowMat, stripMat, outlines, targets, flashes });
  }
  MADE = { root, rings, ghosts, outlineMat, planMat, shipLights, ms: Math.round(performance.now() - t0) };
  return MADE;
}

// crew: the crew member building (their bridge is kept with them, src/jobs/dock.js bridgeOf); save(): saves them
export function dockLink({ W, walls = null, job, spot = null, crew = null, save = () => {} } = {}) {
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
  // (a bridge whose ship has docked, at the job's opening: the next ship has come, a new bridge for it)
  const kept = crew ? bridgeOf(crew) : { ship: 1, rings: 0, docked: false };
  if (crew && kept.docked) { nextShip(crew); save(); }
  let cur = 0, answered = 0, finished = false, closed = false, clock = 0, order = null, ui = null, endT = -1;
  const S = M.rings.map(() => ({ state: 'off', t: 0, ext: 0, braced: new Set(), pop: new Map(), fl: new Map(), jolt: 0, loose: 1, pane: false }));
  // the rings as the crew member's bridge has them: those built, in place, locked and lit; the next one sliding out
  function reset() {
    const b = crew ? bridgeOf(crew) : { rings: 0 };
    cur = b.rings; answered = 0; finished = b.rings >= BRIDGE.rings;
    S.forEach((s, i) => {
      Object.assign(s, { state: 'off', t: 0, ext: 0, jolt: 0, loose: 1, pane: false }); s.braced.clear(); s.pop.clear(); s.fl.clear();
      const R = M.rings[i]; R.g.visible = false; R.braces.forEach((x) => { x.visible = false; }); R.outlines.forEach((o) => { o.visible = false; }); R.flashes.forEach((f) => { f.visible = false; });
      R.glass.visible = false; R.glassMat.opacity = 0; R.glowMat.color.setRGB(0, 0, 0); R.stripMat.color.setRGB(0.08, 0.08, 0.08);
      if (i < cur) {
        // (built on an earlier visit: all its braces in, locked, its glass on and its lights lit)
        Object.assign(s, { state: 'done', ext: 1, loose: 0 });
        for (let j = 0; j < R.braces.length; j++) { s.braced.add(j); s.pop.set(j, 9); }
        R.g.visible = true; R.glass.visible = true; R.glassMat.opacity = R.glassMat.userData.full; R.glowMat.color.setRGB(0.35 * 0.9, 0.85 * 0.9, 1.4 * 0.9); R.stripMat.color.setRGB(1, 1, 1);
      }
    });
    M.ghosts.forEach((g, i) => { g.visible = i >= cur; g.material.color.copy(M.planMat.color); g.material.opacity = M.planMat.opacity; });
    M.shipLights.color.setRGB(...SHIP_RED);
    slideOut(cur);
  }
  function slideOut(i) { if (i >= S.length || i >= BRIDGE.rings) return; const s = S[i]; s.state = 'out'; s.t = 0; s.ext = 0; M.rings[i].g.visible = true; M.ghosts[i].visible = false; }
  const isBrace = () => !!(order && order.play === 'brace');

  // ── the squares a young player braces ─────────────────────────────────────────────────────────────────────────
  function brace(k) {
    const s = S[cur]; if (!s || s.state !== 'wait' || !isBrace() || order.played) return false;
    const j = SQUARES[k]; if (j == null || s.braced.has(j)) return false;
    for (const p of [j, TWIN[j]]) if (p != null && !s.braced.has(p)) { s.braced.add(p); s.pop.set(p, 0); s.fl.set(p, 0); }
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
  // (not while a sheet is over the panel, as the panel's own keys: the levels sheet, ui/levels.js, or the worked sheet)
  function onKey(e) { if (closed || !isBrace() || !/^[1-9]$/.test(e.key) || document.querySelector('.pnl, .bml:not(.is-out)')) return; brace(+e.key - 1); }
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
    s.pane = !!(order && /^(fit|area)/.test(order.key || ''));   // (a question about the glass: the glass goes in brightly)
    // (the card's picture answered too: "which pane fits" shows the pane in its gap, no "?" left)
    const lead = order && order.leadDone && ui && ui.card ? ui.card.querySelector('.pnj-pic.is-lead') : null;
    if (lead) lead.innerHTML = order.leadDone;
    answered++;
    // (kept with the crew member at once: the ring stays built however the visit ends)
    if (crew) { const b = built(crew); save(); if (b.rings >= BRIDGE.rings) finished = true; } else if (cur + 1 >= BRIDGE.rings) finished = true;
  }
  function wrong() { const s = S[cur]; if (s && s.state === 'wait') s.jolt = 1; }
  // the card's top: the bridge's plan, and a dot for each ring of the try (lit when built, amber the one being built:
  // dots, not a second "n of m" beside the panel's level)
  const ICON = '<svg class="dkb-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 6.5 L15.5 13.5 M4.5 13.5 L15.5 6.5 M10 2.8 V17.2" stroke="currentColor" stroke-width="1.6"/></svg>';
  function head(o, end = false) {
    const n = Math.min(cur + 1, BRIDGE.rings);
    const dots = Array.from({ length: BRIDGE.rings }, (x, i) => `<i class="${i < cur || end ? 'is-built' : i === cur ? 'is-now' : ''}"></i>`).join('');
    const said = end ? `All ${BRIDGE.rings} rings built` : `Ring ${n} of ${BRIDGE.rings}`;
    return `<header class="pnj-cardtop is-plan">${ICON}<b>Bridge plan</b><small class="dkb-rings" role="img" aria-label="${said}" title="${said}">${dots}</small></header>`;
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
  // the bridge's end, once its last ring is answered: the card in place of a question. "Next ship": the next ship comes
  // to the port and its bridge starts at ring 1; "Done": the next visit starts it
  function over() {
    if (!finished) return null;
    return {
      html: `${head(null, true)}
        <p class="pnj-story dkb-end"><b>The bridge is built!</b></p>
        <p class="pnj-story dkb-end2">All ${BRIDGE.rings} rings reach the ship: the docking port opens and the ship docks. The next ship to come will need a new bridge.</p>`,
      buttons: [{ label: 'Next ship', again: () => { if (crew) { nextShip(crew); save(); } endT = -1; reset(); intro = TIMES.intro; } }, { label: 'Done' }],
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
        if (!left.length && s.t >= s.last + TIMES.pop * 0.7) { s.state = 'lock'; s.t = 0; }
      }
      if (s.state === 'lock') {
        const k = clamp01(s.t / TIMES.lock);
        // the hoop's flash, settling to a soft line of light; the deck's strips come on; the glass goes on
        const f = Math.exp(-4 * s.t) * 9 + 0.9 * ease(k);
        R.glowMat.color.setRGB(0.35 * f, 0.85 * f, 1.4 * f);
        R.stripMat.color.setRGB(0.08 + 0.92 * ease(k), 0.08 + 0.92 * ease(k), 0.08 + 0.92 * ease(k));
        // (after a question about the glass, the glass goes in bright and settles; else it fades in)
        const full = R.glassMat.userData.full, gk = clamp01(s.t / TIMES.glass);
        R.glass.visible = true; R.glassMat.opacity = s.pane ? full + (GLASS.flash - full) * Math.sin(Math.PI * Math.min(1, gk * 1.15)) : full * ease(gk);
        if (s.t >= Math.max(TIMES.lock, TIMES.glass)) { s.state = 'done'; s.t = 0; cur = i + 1; slideOut(i + 1); }
      }
      // the braces popping in (the ones braced, each from nothing to a little past full and back)
      R.braces.forEach((b, j) => {
        const on = s.braced.has(j); b.visible = on; if (!on) return;
        const t = (s.pop.get(j) || 0) + dt; s.pop.set(j, t);
        const k = t >= TIMES.pop ? 1 : back(clamp01(t / TIMES.pop)), mid = b.userData.mid;
        b.scale.setScalar(Math.max(0.001, k)); b.position.copy(mid).multiplyScalar(1 - k);
      });
      // a square just braced flashes on the ring (the card's tap shown where it builds)
      R.flashes.forEach((f, j) => { const t = s.fl.get(j); if (t == null) { f.visible = false; return; } const u = t + dt; s.fl.set(j, u); f.visible = u < 0.55; f.material.opacity = 0.75 * Math.max(0, 1 - u / 0.55); if (u >= 0.55) s.fl.delete(j); });
      // the squares still to brace marked (a young player's), pulsing
      R.outlines.forEach((o, j) => { o.visible = s.state === 'wait' && isBrace() && SQUARES.includes(j) && !s.braced.has(j); });
      // the wobble: the far hoop bobbing up and down (the squares folding), less as it is braced; a jolt for a wrong answer
      s.jolt = Math.max(0, s.jolt - dt / TIMES.jolt);
      const ph = clock * WOBBLE.hz * 2 * Math.PI + i, amp = WOBBLE.amp * s.loose, k = amp * Math.sin(ph) + (s.jolt > 0 ? WOBBLE.jolt * s.jolt * Math.sin(clock * 19) : 0), kx = WOBBLE.side * s.loose * Math.sin(ph * 0.5 + 1);
      _sh.set(1, 0, kx / DOCK.L, 0, 0, 1, k / DOCK.L, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      _sc.makeScale(1, 1, Math.max(0.02, s.ext));
      R.g.matrix.makeTranslation(0, 0, DOCK.z0 + i * DOCK.L).multiply(_sh).multiply(_sc); R.g.matrixWorldNeedsUpdate = true;
    });
    M.outlineMat.opacity = 0.55 + 0.4 * Math.sin(clock * 5);
    // the try done (its last ring locked): the rings' hoops light up one after another, out along the bridge, again
    // and again, while the end card is up, and on along the plan's hoops to the ship (the way to come), whose docking
    // lights turn from red to green when the first wave gets there and stay green, brighter as each wave arrives
    if (finished && S.every((s, i) => i >= BRIDGE.rings || s.state === 'done')) {
      if (endT < 0) endT = clock;
      const n = DOCK.rings, t = (clock - endT) * 4 % (n + 6), near = (i) => Math.max(0, 1 - Math.abs(t - i - 0.5) * 0.9);
      for (let i = 0; i < BRIDGE.rings; i++) { const f = 0.9 + 5 * near(i); M.rings[i].glowMat.color.setRGB(0.35 * f, 0.85 * f, 1.4 * f); }
      for (let i = BRIDGE.rings; i < n; i++) { const g = M.ghosts[i].material, f = near(i); g.opacity = 0.4 + 0.6 * f; g.color.setRGB(0.25 + 1.6 * f, 0.75 + 1.6 * f, 1.3 + 1.4 * f); }
      const reached = (clock - endT) * 4 >= n, glow = 1 + (t >= n ? Math.max(0, 1 - (t - n) / 2.5) : 0);
      if (reached) M.shipLights.color.setRGB(SHIP_GREEN[0] * glow, SHIP_GREEN[1] * glow, SHIP_GREEN[2] * glow);
      else M.shipLights.color.setRGB(...SHIP_RED);
    } else endT = -1;
  }

  // ── the camera: outside, beside the port ──────────────────────────────────────────────────────────────────────
  const want = new THREE.Vector3(), ringAt = new THREE.Vector3(), probe = new THREE.PerspectiveCamera();
  const camPos = new THREE.Vector3(), camQ = new THREE.Quaternion();   // (the view's own, eased: the walking camera has it each frame first)
  let fresh = true, forced = null, intro = TIMES.intro;   // (forced: a ring to look at, for the rigs; intro: see aim)
  // where the camera wants to be, and which way it wants to face, for ring i (into `want` and probe.quaternion)
  function poseFor(V, i, aspect) {
    ringAt.set(0, DOCK.c, DOCK.z0 + (i + 0.5) * DOCK.L).applyMatrix4(frame);
    want.set(V.from[0], V.from[1] + DOCK.c, Math.max(VIEW.back, V.from[2] + DOCK.z0 + (i + 0.5) * DOCK.L)).applyMatrix4(frame);
    probe.position.copy(want); probe.up.set(0, 1, 0); probe.lookAt(ringAt);
    // (turned so the ring sits at V.on: right to put it left, down to put it high)
    const tv = Math.tan(V.fov * Math.PI / 360), th = tv * aspect;
    probe.rotateY(Math.atan(V.on[0] * th)); probe.rotateX(-Math.atan(V.on[1] * tv));
  }
  function aim(camera, dt = 1 / 60) {
    const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640;
    const end = finished && S.every((s, i) => i >= BRIDGE.rings || s.state === 'done');
    // (the first moment: the end's view, along the bridge's plan to the ship waiting at the far end, then over to the
    // ring being built: where it is all going first)
    const first = intro > 0 && forced == null; intro -= dt;
    const V = end || first ? VIEW.end[tall ? 'tall' : 'wide'] : VIEW[tall ? 'tall' : 'wide'];
    poseFor(V, forced != null ? forced : end || first ? V.ring : Math.min(cur, BRIDGE.rings - 1), camera.aspect || innerWidth / innerHeight);
    if (fresh) { camPos.copy(want); camQ.copy(probe.quaternion); camera.fov = V.fov; camera.updateProjectionMatrix(); fresh = false; }
    const k = 1 - Math.exp(-2.5 * dt);
    camPos.lerp(want, k); camQ.slerp(probe.quaternion, k);
    camera.position.copy(camPos); camera.quaternion.copy(camQ);
    // (the lens eased too, from one view's to the other's)
    if (Math.abs(camera.fov - V.fov) > 0.01) { camera.fov += (V.fov - camera.fov) * k; camera.updateProjectionMatrix(); }
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
    state: () => ({ cur, answered, finished, ship: crew ? bridgeOf(crew).ship : 1, built: crew ? bridgeOf(crew).rings : cur, rings: S.slice(0, BRIDGE.rings).map((s) => ({ state: s.state, braced: [...s.braced].sort(), loose: +s.loose.toFixed(2) })), made: M.ms }),
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
