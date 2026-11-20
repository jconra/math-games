// THE PLANET LAB: a planet's ground by itself, made by the game from a seed (src/planet/: land.js the ground, kinds.js
// the kinds, ground.js its picture, cover.js the rocks and plants, planet.js all of it with its sky). The game's maker
// chose it for the medical and the exploring runs (2026-11-20): "The planet's ground first for both", "A different one
// each run, made by the game", and "a few different planet surfaces, like a cratered moon, and maybe some that are more
// interesting with assets from the terrain lab, although we could change the colors to make exotic looking plants".
// Nothing here is a copy: the game will use the same files.
//
// What is the lab's own: New planet (a new seed, of the kind picked, or any kind), the seed shown and typed in (and
// kept in the address, so a planet can be kept by its link), three places to look from, the landing ring (a ring of
// light round the level landing place, only here), the graphics picker, and the flying camera:
//   W A S D fly along the ground the way the view faces, Space up, C down, Shift faster (and faster the higher you
//   are); drag to look, or click to steer with the mouse (never in a test browser), Esc lets go. On a touch screen: drag
//   to look, a stick to fly, two buttons up and down. The camera stays over the ground (never under it) and below a
//   kilometre up; past the ground's edge it carries on over its copy (the ground repeats).
//
// Address switches: ?seed=N the planet; ?kind=moon|meadow|canyon a new one of that kind; ?q=low|medium|high graphics;
// ?view=landing|above|low; ?rig keeps the picture readable for a screenshot; ?hold no clock of its own (LAB.step).
// window.LAB: { ready, planet, land, quality, timings, view(name), look(at, to), build(seed), bench(frames), step(dt) }
import * as THREE from 'three';
import { makePlanet, makeLandAsync } from '../../src/planet/planet.js';
import { KINDS, kindOf, newSeed, kindById } from '../../src/planet/kinds.js';
import { WIDTH } from '../../src/planet/land.js';
import { CURVE } from '../../src/planet/ground.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search), RIG = q.has('rig'), HOLD = q.has('hold');
const TOUCH = matchMedia('(pointer: coarse)').matches || q.has('touch');
const KEEP = 'pi-nebula.planetlab';
const kept = (() => { try { return JSON.parse(localStorage.getItem(KEEP)) || {}; } catch (e) { return {}; } })();
const keep = (o) => { try { localStorage.setItem(KEEP, JSON.stringify({ ...kept, ...o })); Object.assign(kept, o); } catch (e) { /* blocked: not kept */ } };

// THE GRAPHICS: the game's own three steps and its own rule for the first pick (src/station.js QUALITY and
// pickQuality: a touch screen medium, otherwise high); the screen's sharpness the station's own for each
const QUALITY = { low: { name: 'Low', ratio: 1, aa: false }, medium: { name: 'Medium', ratio: 1.5, aa: true }, high: { name: 'High', ratio: 2, aa: true } };
const pickQuality = (a) => (a in QUALITY ? a : (matchMedia('(pointer: coarse)').matches ? 'medium' : 'high'));
const quality = pickQuality(q.get('q') || kept.q);

const canvas = $('c'), hud = $('hud'), note = $('note'), loading = $('loading');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY[quality].aa, powerPreference: 'high-performance', preserveDrawingBuffer: RIG });
if (!renderer.capabilities.isWebGL2) throw new Error('The planets need WebGL2, which this browser does not have.');
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY[quality].ratio));
renderer.info.autoReset = false;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.25, 20000);
scene.background = new THREE.Color(0x000000);
function fit() {
  const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  document.body.style.setProperty('--bar', $('bar').offsetHeight + 'px');
}
addEventListener('resize', fit); fit();

const LAB = window.LAB = { ready: false, planet: null, land: null, quality, timings: {} };
let planet = null, building = null, want = kept.kind && (kept.kind === 'any' || kindById(kept.kind)) ? kept.kind : 'any', ringOn = kept.ring !== false;
if (q.get('kind') && kindById(q.get('kind'))) want = q.get('kind');

// ── the camera ───────────────────────────────────────────────────────────────────────────────────────────────────
const cam = { pos: new THREE.Vector3(0, 60, 80), yaw: 0, pitch: 0.2 };
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3(), _v = new THREE.Vector3();
function applyCam() {
  const cp = Math.cos(cam.pitch);
  camera.position.copy(cam.pos); camera.lookAt(_v.copy(cam.pos).add(_f.set(-Math.sin(cam.yaw) * cp, -Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp)));
  camera.updateMatrixWorld();
}
function look(at, to) {
  cam.pos.set(...at); const d = _v.set(...to).sub(cam.pos).normalize();
  cam.yaw = Math.atan2(-d.x, -d.z); cam.pitch = Math.asin(-d.y); applyCam();
}
const ground = (x, z) => (planet ? planet.land.heightAt(x, z) : 0);
// THE PLACES TO LOOK FROM, all round the landing place: from a ship's height a little way off, from high above it, and
// standing on the ground at its edge looking out (each turned toward the sky's big sights on the moon, toward the sun's
// side with air)
const VIEWS = {
  landing: { name: 'Landing place', at: (L, a) => { const x = L.x - Math.sin(a) * 95, z = L.z - Math.cos(a) * 95; return [[x, Math.max(ground(x, z), L.y) + 34, z], [L.x, L.y + 2, L.z]]; } },
  above: { name: 'From above', at: (L, a) => { const x = L.x - Math.sin(a) * 160, z = L.z - Math.cos(a) * 160; return [[x, L.y + 330, z], [L.x + Math.sin(a) * 60, L.y, L.z + Math.cos(a) * 60]]; } },
  low: { name: 'Low down', at: (L, a) => { const x = L.x + Math.sin(a) * (L.flat - 4), z = L.z + Math.cos(a) * (L.flat - 4); return [[x, ground(x, z) + 1.7, z], [x + Math.sin(a) * 200, ground(x, z) + 6, z + Math.cos(a) * 200]]; } },
};
let viewName = VIEWS[q.get('view')] ? q.get('view') : 'landing';
function facing() {
  // the way to look: on the moon toward the ringed planet (the game's sky, +z), with air toward the sun's side
  if (!planet) return 0;
  const d = planet.land.kind.air ? planet.sunDir.clone().negate() : new THREE.Vector3(0, 0, 1);
  if (planet.land.kind.air) d.applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.9);
  return Math.atan2(d.x, d.z);
}
function setView(name) {
  if (!VIEWS[name] || !planet) return; viewName = name;
  const [at, to] = VIEWS[name].at(planet.land.landing, facing()); look(at, to);
  paintChips();
}

// drag to look (a mouse, a pen or one finger); a click without dragging steers with the mouse (pointer lock), never in
// a test browser
const canLock = !navigator.webdriver && typeof canvas.requestPointerLock === 'function';
{
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { if (drag || document.pointerLockElement === canvas) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (document.pointerLockElement === canvas) { turn(e.movementX, e.movementY, 0.0022); return; }
    if (!drag || e.pointerId !== drag.id) return;
    drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
    turn(e.clientX - drag.x, e.clientY - drag.y, 0.0042); drag.x = e.clientX; drag.y = e.clientY;
  });
  const end = (e) => { if (!drag || e.pointerId !== drag.id) return; const click = drag.moved < 4 && e.type === 'pointerup' && e.pointerType === 'mouse'; drag = null; if (click && canLock) { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
}
function turn(dx, dy, k) { k *= camera.fov / 60; cam.yaw -= dx * k; cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * k, -1.5, 1.5); applyCam(); }
// flying: W A S D along the level the way the view faces, Space up, C down, Shift faster
const FLY = { KeyW: [0, 0, 1], KeyS: [0, 0, -1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], Space: [0, 1, 0], KeyC: [0, -1, 0] };
const keys = new Set(), vel = new THREE.Vector3(), stickV = { x: 0, y: 0 }, vert = { v: 0 }; let fast = false;
const typing = (t) => t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName);
addEventListener('keydown', (e) => { fast = e.shiftKey; if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return; keys.add(e.code); e.preventDefault(); });
addEventListener('keyup', (e) => { fast = e.shiftKey; keys.delete(e.code); if (e.code === 'Space' && e.target && e.target.tagName === 'BUTTON') e.preventDefault(); });
addEventListener('blur', () => keys.clear());
const MAX_UP = 1000;
function fly(dt) {
  let fx = stickV.x, fy = vert.v, fz = stickV.y; for (const k of keys) { fx += FLY[k][0]; fy += FLY[k][1]; fz += FLY[k][2]; }
  const up = cam.pos.y - ground(cam.pos.x, cam.pos.z);
  const speed = THREE.MathUtils.clamp(6 + up * 0.55, 6, 160) * (fast ? 3 : 1);
  camera.getWorldDirection(_f); _f.y = 0; if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); _f.normalize(); _r.crossVectors(_f, THREE.Object3D.DEFAULT_UP).normalize();
  _w.set(0, 0, 0).addScaledVector(_f, fz).addScaledVector(_r, fx); if (_w.lengthSq() > 1) _w.normalize(); _w.multiplyScalar(speed); _w.y = THREE.MathUtils.clamp(fy, -1, 1) * speed * 0.7;
  vel.lerp(_w, 1 - Math.exp(-6 * dt));
  if (vel.lengthSq() > 1e-6) cam.pos.addScaledVector(vel, dt);
  // over the ground, never in it, and below a kilometre; past the edge, over its copy (the same ground)
  const P = WIDTH; if (cam.pos.x > P / 2) cam.pos.x -= P; if (cam.pos.x < -P / 2) cam.pos.x += P; if (cam.pos.z > P / 2) cam.pos.z -= P; if (cam.pos.z < -P / 2) cam.pos.z += P;
  const g = ground(cam.pos.x, cam.pos.z); cam.pos.y = THREE.MathUtils.clamp(cam.pos.y, g + 1.2, g + MAX_UP);
  applyCam();
}
function touchControls() {
  document.body.classList.toggle('touch', TOUCH); if (!TOUCH) return;
  const S = $('stick'), K = $('knob'); let id = null;
  const set = (e) => { const r = S.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2; let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } stickV.x = dx; stickV.y = -dy; K.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`; };
  S.addEventListener('pointerdown', (e) => { id = e.pointerId; S.setPointerCapture(id); set(e); e.preventDefault(); });
  S.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
  const end = () => { id = null; stickV.x = stickV.y = 0; K.style.transform = ''; };
  S.addEventListener('pointerup', end); S.addEventListener('pointercancel', end);
  for (const [b, v] of [['up', 1], ['down', -1]]) { const B = $(b); B.addEventListener('pointerdown', (e) => { B.setPointerCapture(e.pointerId); vert.v = v; B.classList.add('on'); }); const off = () => { vert.v = 0; B.classList.remove('on'); }; B.addEventListener('pointerup', off); B.addEventListener('pointercancel', off); }
}

// ── THE LANDING RING (the lab's own): a thin ring of light round the level ground, on the planet's same curve ────
let ring = null;
function placeRing() {
  if (ring) { scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); ring = null; }
  if (!planet) return;
  const L = planet.land.landing, U = planet.ground.U;
  const geo = new THREE.RingGeometry(L.flat - 0.35, L.flat, 160, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCam: U.uCam, uCurve: U.uCurve, uCol: { value: new THREE.Color(0x9fdcff) } }, transparent: true, depthWrite: false,
    vertexShader: 'uniform vec3 uCam; uniform float uCurve; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vec2 d = w.xz - uCam.xz; w.y -= dot(d, d) * uCurve; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uCol; void main() { gl_FragColor = vec4(uCol, 0.85); }',
  });
  ring = new THREE.Mesh(geo, mat); ring.position.set(L.x, L.y + 0.12, L.z); ring.frustumCulled = false; ring.visible = ringOn; ring.renderOrder = 2;
  scene.add(ring);
}

// ── making a planet ──────────────────────────────────────────────────────────────────────────────────────────────
function say(words, why = '') { loading.hidden = false; loading.firstChild.textContent = words; $('loadingWhy').textContent = why; }
async function build(seed, { keepView = false } = {}) {
  if (building) return building;
  building = (async () => {
    const kind = kindOf(seed);
    say(`Making the ground…`, `${kind.name}, seed ${seed}`);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const t0 = performance.now();
    const land = await makeLandAsync(seed);
    const t1 = performance.now();
    if (planet) { planet.dispose(); planet = null; }
    renderer.info.reset();
    planet = LAB.planet = await makePlanet({ renderer, scene, land, quality });
    LAB.land = land;
    renderer.toneMappingExposure = planet.exposure;
    placeRing();
    if (!keepView) setView(viewName); else applyCam();
    planet.update(camera, 0); planet.cover.relayNow(camera);
    // the first picture, so the timing counts the shaders being made too
    renderer.render(scene, camera);
    const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const t2 = performance.now();
    LAB.timings = { ground: Math.round(t1 - t0), landInWorker: land.ms, planet: Math.round(t2 - t1), light: planet.stats.lightMs, cover: planet.stats.coverMs, total: Math.round(t2 - t0) };
    $('seed').value = String(seed);
    const u = new URL(location.href); u.searchParams.set('seed', seed); u.searchParams.delete('kind'); history.replaceState(null, '', u.href);
    keep({ seed });
    // (on a narrow screen only the first sentence, so the menu leaves room for the planet)
    note.innerHTML = `<b>${land.kind.name}</b>, seed ${seed}. <span class="pl-long">${land.kind.about} The ground is 2 km across (2,048 m) and repeats past its edges: flying straight across it at the Miner's top speed takes 51 seconds. The landing place is the level ground in the ring, ${2 * land.landing.flat} m across. </span>Made in ${(LAB.timings.total / 1000).toFixed(1)} s.`;
    loading.hidden = true; LAB.ready = true; paintChips();
  })();
  try { await building; } finally { building = null; }
}

// ── the menu ─────────────────────────────────────────────────────────────────────────────────────────────────────
function chip(label, on, click, sub = false) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (sub ? ' sub' : '') + (on ? ' on' : ''); b.textContent = label; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.addEventListener('click', (e) => { click(); e.currentTarget.blur(); }); return b; }
function paintChips() {
  $('kinds').replaceChildren(chip('Any kind', want === 'any', () => { want = 'any'; keep({ kind: want }); paintChips(); }, true),
    ...KINDS.map((k) => chip(k.name, want === k.id, () => { want = k.id; keep({ kind: want }); paintChips(); }, true)));
  $('views').replaceChildren(...Object.entries(VIEWS).map(([id, v]) => chip(v.name, viewName === id, () => setView(id), true)));
  $('quality').replaceChildren(...Object.entries(QUALITY).map(([id, v]) => chip(v.name, quality === id, () => { if (id === quality) return; keep({ q: id }); const u = new URL(location.href); u.searchParams.set('q', id); location.href = u.href; }, true)));
  const r = $('ring'); r.classList.toggle('on', ringOn); r.setAttribute('aria-pressed', ringOn ? 'true' : 'false');
  fit();
}
$('new').addEventListener('click', (e) => { e.currentTarget.blur(); build(newSeed(want === 'any' ? null : want)); });
const typed = () => { const s = Math.floor(Math.abs(+String($('seed').value).replace(/[^\d]/g, ''))); if (s > 0) build(s); };
$('make').addEventListener('click', (e) => { e.currentTarget.blur(); typed(); });
$('seed').addEventListener('keydown', (e) => { if (e.key === 'Enter') { typed(); e.target.blur(); } });
$('ring').addEventListener('click', (e) => { ringOn = !ringOn; keep({ ring: ringOn }); if (ring) ring.visible = ringOn; paintChips(); e.currentTarget.blur(); });

// ── each frame ───────────────────────────────────────────────────────────────────────────────────────────────────
const frameMs = []; let shown = 0;
function frame(dt) {
  if (!planet) return;
  fly(dt);
  planet.update(camera, dt);
  renderer.info.reset();
  renderer.render(scene, camera);
}
function readout() {
  if (!planet) return;
  const ms = frameMs.length ? frameMs.reduce((s, v) => s + v, 0) / frameMs.length : 0, i = renderer.info.render, up = cam.pos.y - ground(cam.pos.x, cam.pos.z);
  hud.textContent = `${planet.land.kind.name} · seed ${planet.land.seed} · ${ms ? (1000 / ms).toFixed(0) + ' fps' : ''} · ${(i.triangles / 1000).toFixed(0)}k triangles · ${i.calls} draws · ${up.toFixed(0)} m up`;
}
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  frameMs.push(dt * 1000); if (frameMs.length > 60) frameMs.shift();
  if (!HOLD) frame(dt);
  if (now - shown > 400) { shown = now; readout(); }
}
// for the rigs: one step of the clock, and the time a frame takes when the card is made to finish each one
LAB.step = (dt = 1 / 60, n = 1) => { for (let k = 0; k < n; k++) frame(dt); readout(); };
LAB.view = (name) => setView(name);
LAB.look = (at, to) => { look(at, to); if (planet) { planet.update(camera, 0); planet.cover.relayNow(camera); } };
LAB.build = (seed) => build(seed);
LAB.bench = (frames = 90) => {
  const gl = renderer.getContext(), px = new Uint8Array(4), times = [];
  for (let k = 0; k < frames + 10; k++) {
    const t = performance.now();
    planet.update(camera, 1 / 60); renderer.info.reset(); renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (k >= 10) times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return { median: +times[Math.floor(times.length / 2)].toFixed(2), p90: +times[Math.floor(times.length * 0.9)].toFixed(2), tris: renderer.info.render.triangles, calls: renderer.info.render.calls, patches: planet.ground.stats.patches, rocks: planet.cover.stats.rocks, plants: planet.cover.stats.plants, w: renderer.domElement.width, h: renderer.domElement.height };
};
LAB.curve = CURVE;
LAB.ring = (on) => { ringOn = !!on; if (ring) ring.visible = ringOn; paintChips(); };

touchControls(); paintChips();
const first = +q.get('seed') > 0 ? Math.floor(+q.get('seed')) : (q.get('kind') ? newSeed(want) : (kept.seed > 0 ? kept.seed : newSeed(want === 'any' ? null : want)));
await build(first);
requestAnimationFrame(loop);
