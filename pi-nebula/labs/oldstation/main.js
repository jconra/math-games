// THE OTHER STATION LAB: the outside of the other station, the old one in distress the story sends you to, built by
// the kit (kit/oldstation.js, kit/oldstation-plan.js) from our station's own hull builder and pieces. Nothing in the
// game uses it yet. The game's maker, 2026-11-22, of the shapes drawn for him: B, "Can we rotate the ring 90 degrees on
// the x axis so that the ring goes above and below the station. The tower may have to be shorter to not interfere with
// the rings."; red; and when the Explorer first gets there, "you fly round it and look" (STA2-3).
//
// WHAT IS SHOWN: the station under the game's own sky and sun, drawn as the Hull Lab draws our station's outside (the
// same lights, the game's exposure), from a ship coming in. "Fly round it" takes the camera round it the way the
// Explorer will go; the other buttons are places to look from.
// THE CONTROLS: W A S D fly (Space up, C down, Shift faster), drag to look; on a touch screen, drag to look, a stick to
// fly, two buttons for up and down. Flying or dragging stops the way round.
//
// FOR THE PICTURE RIGS: ?rig keeps the drawing for a screenshot, ?ui=0 hides the strip and the bar, ?view=<name>,
// ?round (start going round), ?seed=<n> (which windows are lit); window.OLD (view, from, round, at, stats, size).
import * as THREE from 'three';
import { createSky, DIR } from '../../world/sky.js';
import { shieldMaterial, U } from '../../kit/materials.js';
import { hullMaterials } from '../../kit/hull.js';
import { buildOldStation } from '../../kit/oldstation.js';
import { OLD_LOOK, OLD_BOX, OLD_VIEWS, ROUND } from '../../kit/oldstation-plan.js';

const $ = (s) => document.querySelector(s), q = new URLSearchParams(location.search);
const canvas = $('#c'), hud = $('#hud'), bar = $('#bar'), loading = $('#loading');
const RIG = q.has('rig'), TOUCH = matchMedia('(pointer: coarse)').matches || q.has('touch');

// ── renderer, scene, light: as the Hull Lab draws our station's outside ──────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: RIG });
renderer.setPixelRatio(RIG ? 1 : Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.74;
renderer.info.autoReset = false;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, 0.5, 8000);
const stage = new THREE.Group(); scene.add(stage);
const sun = new THREE.DirectionalLight(0xfff0dc, 3.3), shine = new THREE.DirectionalLight(0xb9cfd8, 0.3), fill = new THREE.HemisphereLight(0xa9b8d6, 0x2a3038, 1.05);
shine.position.copy(DIR.planet).multiplyScalar(600); sun.position.copy(DIR.sun).multiplyScalar(500); sun.target.position.set(0, 0, 0);
scene.add(sun, sun.target, shine, fill);
const sky = createSky(renderer, { quality: TOUCH ? 'medium' : 'high' }); scene.add(sky.object);
// what the metal mirrors: the sky, pictured from the middle without its sun's disc (as the Hull Lab does)
const pmrem = new THREE.PMREMGenerator(renderer);
function mirrorSky() {
  const skyU = (() => { const dome = sky.object.getObjectByName('sky:dome'); return (dome && dome.material && dome.material.uniforms) || {}; })();
  const rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(1, 8000, rt);
  const disc = skyU.uSunR ? skyU.uSunR.value : 0; if (skyU.uSunR) skyU.uSunR.value = 1e-5;
  stage.visible = false; scene.environment = null; cc.update(renderer, scene);
  if (skyU.uSunR) skyU.uSunR.value = disc;
  scene.environment = pmrem.fromCubemap(rt.texture).texture; stage.visible = true; rt.dispose();
}

// ── the station ─────────────────────────────────────────────────────────────────────────────────────────────────
const mats = hullMaterials(OLD_LOOK), shield = shieldMaterial();
const t0 = performance.now();
const station = buildOldStation(OLD_LOOK, mats, { shield, seed: q.has('seed') ? +q.get('seed') : 7 });
const buildMs = performance.now() - t0;
stage.add(station.group);

// ── the camera: fly it, drag to look ───────────────────────────────────────────────────────────────────────────
const cam = { pos: new THREE.Vector3(), yaw: 0, pitch: 0 };
const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3();
function applyCam() {
  const cp = Math.cos(cam.pitch);
  camera.position.copy(cam.pos); camera.lookAt(_v.copy(cam.pos).add(_f.set(-Math.sin(cam.yaw) * cp, -Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp)));
}
function lookFrom(at, to) {
  cam.pos.set(...at); const d = _v.set(...to).sub(cam.pos).normalize();
  cam.yaw = Math.atan2(-d.x, -d.z); cam.pitch = Math.asin(-d.y); applyCam();
}
// (on a tall, narrow screen the same place is taken from further back, so the station still fits across)
const back = () => Math.max(1, 0.9 / camera.aspect);
let viewName = OLD_VIEWS[q.get('view')] ? q.get('view') : 'approach';
function setView(name) {
  if (!OLD_VIEWS[name]) return; viewName = name; round.on = false;
  const { at, to } = OLD_VIEWS[name], k = back();
  lookFrom(at.map((v, i) => to[i] + (v - to[i]) * k), to); chips();
}
// THE WAY ROUND (STA2-3: the Explorer flies round it and looks): a circle round the station, a little above it,
// looking in at it all the way; it starts from wherever the camera is
const round = { on: false, a: 0 };
function startRound() {
  round.on = true; round.a = Math.atan2(cam.pos.z, cam.pos.x); viewName = null; chips();
}
function goRound(dt) {
  if (!round.on) return;
  round.a += dt * Math.PI * 2 / ROUND.lap;
  const r = ROUND.r * back();
  lookFrom([Math.cos(round.a) * r, ROUND.y, Math.sin(round.a) * r], ROUND.to);
}
// drag to look (a mouse, a pen or one finger); it stops the way round
{
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { if (drag) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (round.on) { round.on = false; chips(); }
    const k = 0.0042 * camera.fov / 50; cam.yaw -= (e.clientX - drag.x) * k; cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - drag.y) * k, -1.5, 1.5);
    drag.x = e.clientX; drag.y = e.clientY; applyCam();
  });
  const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
}
// flying: W A S D along the level the way the view faces, Space up, C down, Shift faster; slower close to the hull
const FLY = { KeyW: [0, 0, 1], KeyS: [0, 0, -1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], Space: [0, 1, 0], KeyC: [0, -1, 0] };
const keys = new Set(), vel = new THREE.Vector3(), stickV = { x: 0, y: 0 }, vert = { v: 0 }; let fast = false;
addEventListener('keydown', (e) => { fast = e.shiftKey; if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey) return; keys.add(e.code); e.preventDefault(); });
// (Space flies up; it does not also press the button last pressed)
addEventListener('keyup', (e) => { fast = e.shiftKey; keys.delete(e.code); if (e.code === 'Space' && e.target && e.target.tagName === 'BUTTON') e.preventDefault(); });
addEventListener('blur', () => keys.clear());
function fly(dt) {
  let fx = stickV.x, fy = vert.v, fz = stickV.y; for (const k of keys) { fx += FLY[k][0]; fy += FLY[k][1]; fz += FLY[k][2]; }
  if ((fx || fy || fz) && round.on) { round.on = false; chips(); }
  const p = cam.pos, B = OLD_BOX, off = Math.hypot(Math.max(B.min[0] - p.x, 0, p.x - B.max[0]), Math.max(B.min[1] - p.y, 0, p.y - B.max[1]), Math.max(B.min[2] - p.z, 0, p.z - B.max[2]));
  const speed = THREE.MathUtils.clamp(off * 0.7, 9, 80) * (fast ? 3 : 1);
  camera.getWorldDirection(_f); _f.y = 0; if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); _f.normalize(); _r.crossVectors(_f, THREE.Object3D.DEFAULT_UP).normalize();
  _w.set(0, 0, 0).addScaledVector(_f, fz).addScaledVector(_r, fx); if (_w.lengthSq() > 1) _w.normalize(); _w.multiplyScalar(speed); _w.y = THREE.MathUtils.clamp(fy, -1, 1) * speed * 0.7;
  vel.lerp(_w, 1 - Math.exp(-9 * dt)); if (vel.lengthSq() < 1e-6) { vel.set(0, 0, 0); return; }
  cam.pos.addScaledVector(vel, dt); applyCam();
}
// the touch stick and the up and down buttons
function touchControls() {
  document.body.classList.toggle('touch', TOUCH); if (!TOUCH) return;
  const S = $('#stick'), K = $('#knob'); let id = null;
  const set = (e) => { const r = S.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2; let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } stickV.x = dx; stickV.y = -dy; K.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`; };
  S.addEventListener('pointerdown', (e) => { id = e.pointerId; S.setPointerCapture(id); set(e); e.preventDefault(); });
  S.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
  const end = () => { id = null; stickV.x = stickV.y = 0; K.style.transform = ''; };
  S.addEventListener('pointerup', end); S.addEventListener('pointercancel', end);
  for (const [b, v] of [['#up', 1], ['#down', -1]]) { const B = $(b); B.addEventListener('pointerdown', (e) => { B.setPointerCapture(e.pointerId); vert.v = v; B.classList.add('on'); }); const off = () => { vert.v = 0; B.classList.remove('on'); }; B.addEventListener('pointerup', off); B.addEventListener('pointercancel', off); }
}

// ── the bar: the way round, and the places to look from ────────────────────────────────────────────────────────
function chips() {
  const btn = (label, on, fn, cls, title) => { const b = document.createElement('button'); b.className = 'chip' + (cls ? ' ' + cls : '') + (on ? ' on' : ''); b.textContent = label; b.title = title || ''; b.setAttribute('aria-pressed', String(!!on)); b.onclick = fn; return b; };
  bar.replaceChildren(btn('Fly round it', round.on, () => (round.on ? (round.on = false, chips()) : startRound()), 'os-round', 'Round the station the way the Explorer will go, looking in at it'),
    ...Object.entries(OLD_VIEWS).map(([k, v]) => btn(v.name, k === viewName && !round.on, () => setView(k), 'sub')));
  document.body.style.setProperty('--barH', bar.getBoundingClientRect().height + 'px');
}

// ── the numbers in the corner ──────────────────────────────────────────────────────────────────────────────────
const N = (x) => Math.round(x).toLocaleString('en-US');
const frame = { ms: 16.7, tris: 0, calls: 0 };
function numbers() {
  const s = station.stats;
  hud.textContent = `${N(s.triangles.all)} triangles · ${s.draws} draws · ${frame.ms.toFixed(1)} ms a frame`;
  hud.title = `The station alone: ${N(s.triangles.hull)} triangles of plated hull in ${s.draws - 4} draws, ${N(s.extra.gear)} of ring, girders and masts, ${N(s.extra.glow)} of lights, ${N(s.extra.bridge)} of the old bridge; ${s.windows} windows, ${s.lit} of them lit. The whole view now, with the sky: ${N(frame.tris)} triangles in ${frame.calls} draws.`;
}

function layout() {
  const W = innerWidth, H = innerHeight;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
}
addEventListener('resize', () => { layout(); if (viewName) setView(viewName); chips(); });

// ── the frame ───────────────────────────────────────────────────────────────────────────────────────────────────
let last = performance.now(), acc = 0, count = 0, hudT = 0, frames = 0;
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.1, (t - last) / 1000); acc += t - last; count++; last = t;
  fly(dt); goRound(dt); U.time.value += dt; sky.update(dt);
  renderer.info.reset(); renderer.render(scene, camera); frames++;
  frame.tris = renderer.info.render.triangles; frame.calls = renderer.info.render.calls;
  hudT += dt; if (hudT > 0.5) { frame.ms = acc / count; acc = 0; count = 0; hudT = 0; numbers(); }
});

// ── start ───────────────────────────────────────────────────────────────────────────────────────────────────────
layout(); touchControls(); chips(); setView(viewName); mirrorSky(); numbers();
if (q.has('round')) startRound();
if (q.get('ui') === '0') for (const id of ['#top', '#bar', '#stick', '#updown']) $(id).style.display = 'none';
loading.hidden = true;

// for the picture rigs and the checks
window.OLD = {
  ready: true, renderer, VIEWS: OLD_VIEWS,
  view: (name) => setView(name), from: (at, to) => { round.on = false; viewName = null; lookFrom(at, to); chips(); },
  // (round(true, a): going round, from angle a in radians)
  round(on, a) { if (on) { startRound(); if (a != null) { round.a = a; goRound(0); } } else { round.on = false; chips(); } return round.on; },
  at: () => ({ at: cam.pos.toArray(), yaw: cam.yaw, pitch: cam.pitch, a: round.a }),
  size(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
  // (for looking at one part on its own: the meshes whose names have this in them shown or not; their names)
  part(text, on) { station.group.traverse((o) => { if (o.isMesh && o.name.includes(text)) o.visible = !!on; }); },
  parts: () => { const n = []; station.group.traverse((o) => { if (o.isMesh) n.push(o.name); }); return n; },
  stats: () => ({ ...station.stats, buildMs, frames, frame: { ...frame }, pictures: mats.pictures, pictureBytes: mats.bytes, info: { tris: renderer.info.render.triangles, calls: renderer.info.render.calls, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries } }),
};
