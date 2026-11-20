// THE PLANET LAB: a planet's ground by itself, made by the game from a seed (src/planet/: land.js the ground, kinds.js
// the kinds, ground.js its picture, cover.js the rocks and plants, trees.js the trees, planet.js all of it with its sky). The game's maker
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
// THE WRECK (an options round for the rescue runs, the game's maker 2026-11-20: "can we take one of our ships and break
// it into parts for a rescue situation? Like the people in need broke their ship in half. Maybe we could color it
// differently."): one of our four ships broken apart beside the landing ring (src/planet/wreck.js, wreckship.js), or
// none; its colours, one of three crews' that aren't ours; in two pieces or three. "Each rescue" (the lab's first
// pick, so a new planet comes with its wreck) has the planet's seed pick all three, a different wreck each rescue (his
// answers WRECK1-1 C, WRECK1-2 D, WRECK1-3 C: "Randomness is good"); the colour and pieces chips then show what the
// seed picked. A ship, colours or pieces picked by hand (for looking) take the place of the seed's, the rest kept as it
// was, so only what was picked changes. A view of it. Only here for now: nothing in the game has it yet.
//
// Address switches: ?seed=N the planet; ?kind=moon|meadow|canyon a new one of that kind; ?q=low|medium|high graphics;
// ?view=landing|above|low|wreck; ?wreck=none|any|miner|explorer|medic|hauler (any: each rescue, the first pick);
// ?paint=rust|olive|slate and ?pieces=2|3 (with a ship by hand);
// ?rig keeps the picture readable for a screenshot; ?hold no clock of its own (LAB.step).
// window.LAB: { ready, planet, land, wreck, quality, timings, view(name), look(at, to), build(seed), bench(frames),
//   step(dt), setWreck({ ship, paint, pieces }) }
import * as THREE from 'three';
import { makePlanet, makeLandAsync } from '../../src/planet/planet.js';
import { KINDS, kindOf, newSeed, kindById } from '../../src/planet/kinds.js';
import { WIDTH } from '../../src/planet/land.js';
import { CURVE } from '../../src/planet/ground.js';
import { WRECK_SHIPS, PAINTS, wreckFor } from '../../src/planet/wreck.js';
import { makeWreck } from '../../src/planet/wreckship.js';

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
// the wreck: which ship ('none', 'any' each rescue's: the seed picks the ship, its colours and its pieces; or one of
// the four), and the colours and pieces picked by hand (for a ship picked by hand)
const SHIP_NAMES = { miner: 'Miner', explorer: 'Explorer', medic: 'Medic', hauler: 'Hauler' };
const wreckOk = (w) => w === 'none' || w === 'any' || WRECK_SHIPS.includes(w);
let wreck = null, wreckWant = wreckOk(q.get('wreck')) ? q.get('wreck') : wreckOk(kept.wreck) ? kept.wreck : 'any';
let paint = PAINTS[q.get('paint')] ? q.get('paint') : PAINTS[kept.paint] ? kept.paint : 'rust';
let breaks = [2, 3].includes(+q.get('pieces')) ? +q.get('pieces') : [2, 3].includes(kept.pieces) ? kept.pieces : 2;
// the wreck a seed gets: none, the seed's own (each rescue), or the one picked by hand
const wreckPick = (seed) => (wreckWant === 'none' ? null : wreckWant === 'any' ? wreckFor(seed) : { ship: wreckWant, paint, pieces: breaks });
// (a pick by hand while each rescue is on: the wreck shown becomes the one by hand, so only what is picked changes)
const byHand = () => { if (wreckWant !== 'any' || !planet) return false; const s = wreckFor(planet.land.seed); wreckWant = s.ship; paint = s.paint; breaks = s.pieces; return true; };
// the address keeps it: wreck=none, wreck=any, or the ship with its colours and pieces
function wreckAddress(u) {
  u.searchParams.set('wreck', wreckWant);
  if (wreckWant === 'none' || wreckWant === 'any') for (const k of ['paint', 'pieces']) u.searchParams.delete(k);
  else { u.searchParams.set('paint', paint); u.searchParams.set('pieces', breaks); }
  return u;
}
// the menu's line about it: the wreck as it is shown (said again when its colours are changed where it lies)
const wreckSay = () => (wreck ? ` A crashed ${SHIP_NAMES[wreck.ship]} lies beside the ring, broken in ${wreck.stats.pieces === 2 ? 'two' : 'three'}, in ${PAINTS[wreck.paintId].name.toLowerCase()}.` : '');
function repaint(id) { wreck.paint(id); const s = document.getElementById('wreckSay'); if (s) s.textContent = wreckSay(); history.replaceState(null, '', wreckAddress(new URL(location.href)).href); }

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
  // (the wreck, from a little along it and from its side the sun lights: the landing place's side, or the other; far
  // enough off that about 34 m of ground across fits the screen's width, an upright phone's too)
  wreck: { name: 'Wreck', at: (L, a) => {
    const S = wreck && wreck.site; if (!S) return VIEWS.landing.at(L, a);
    let tx = L.x - S.x, tz = L.z - S.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    if (planet && tx * planet.sunDir.x + tz * planet.sunDir.z < 0) { tx = -tx; tz = -tz; }
    const d = Math.max(27, 17 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect)), k = d / 27;
    const x = S.x + tx * d + Math.sin(S.yaw) * 7 * k, z = S.z + tz * d + Math.cos(S.yaw) * 7 * k;
    return [[x, Math.max(ground(x, z), S.y) + 10 * k, z], [S.x, S.y + 0.8, S.z]];
  } },
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
    // the wreck, before the planet is drawn: built, broken and placed, and the ground under it cleared (its trees and
    // plants: they are laid when the planet is made)
    let W = null; const pick = wreckPick(seed);
    if (pick) {
      say('Breaking the ship…', `${kind.name}, seed ${seed}`);
      try { W = await makeWreck({ land, ship: pick.ship, pieces: pick.pieces }); } catch (e) { console.error(e); if (window.oops) window.oops(e); W = null; }
    }
    const tw = performance.now();
    if (wreck) { wreck.dispose(); wreck = LAB.wreck = null; }
    if (planet) { planet.dispose(); planet = null; }
    renderer.info.reset();
    planet = LAB.planet = await makePlanet({ renderer, scene, land, quality });
    LAB.land = land;
    if (W) wreck = LAB.wreck = W.draw({ scene, ground: planet.ground, sky: planet.dome, sunDir: planet.sunDir, paint: pick.paint });
    renderer.toneMappingExposure = planet.exposure;
    placeRing();
    if (!keepView) setView(viewName); else applyCam();
    planet.update(camera, 0); planet.relayNow(camera);
    // the first picture, so the timing counts the shaders being made too
    renderer.render(scene, camera);
    const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const t2 = performance.now();
    const T = planet.trees && planet.trees.stats;
    LAB.timings = { ground: Math.round(t1 - t0), landInWorker: land.ms, wreck: W ? W.stats.ms : 0, planet: Math.round(t2 - tw), light: planet.stats.lightMs, cover: planet.stats.coverMs, trees: T ? T.buildMs : 0, treesLoad: T ? T.loadMs : 0, treesBake: T ? T.bakeMs : 0, total: Math.round(t2 - t0) };
    $('seed').value = String(seed);
    const u = new URL(location.href); u.searchParams.set('seed', seed); u.searchParams.delete('kind');
    history.replaceState(null, '', wreckAddress(u).href);
    keep({ seed });
    // (on a narrow screen only the first sentence, so the menu leaves room for the planet)
    note.innerHTML = `<b>${land.kind.name}</b>, seed ${seed}${land.familiar ? ', in Earth\'s colours' : ''}.<span id="wreckSay">${wreckSay()}</span> <span class="pl-long">${land.familiar ? land.kind.aboutEarth : land.kind.about}${T ? ` ${T.trees.toLocaleString()} trees.` : ''} The ground is 2 km across (2,048 m) and repeats past its edges: flying straight across it at the Miner's top speed takes 51 seconds. The landing place is the level ground in the ring, ${2 * land.landing.flat} m across. </span>Made in ${(LAB.timings.total / 1000).toFixed(1)} s.`;
    loading.hidden = true; LAB.ready = true; paintChips();
  })();
  try { await building; } finally { building = null; }
}

// ── the menu ─────────────────────────────────────────────────────────────────────────────────────────────────────
function chip(label, on, click, sub = false) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (sub ? ' sub' : '') + (on ? ' on' : ''); b.textContent = label; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.addEventListener('click', (e) => { click(); e.currentTarget.blur(); }); return b; }
function paintChips() {
  $('kinds').replaceChildren(chip('Any kind', want === 'any', () => { want = 'any'; keep({ kind: want }); paintChips(); }, true),
    ...KINDS.map((k) => chip(k.name, want === k.id, () => { want = k.id; keep({ kind: want }); paintChips(); }, true)));
  $('views').replaceChildren(...Object.entries(VIEWS).filter(([id]) => id !== 'wreck' || wreck).map(([id, v]) => chip(v.name, viewName === id, () => setView(id), true)));
  // the wreck: which ship (or none, or a different one each rescue), its colours, in how many pieces (with each rescue
  // on, the colour and pieces chips show what the seed picked)
  const reWreck = () => { keep({ wreck: wreckWant, paint, pieces: breaks }); paintChips(); if (planet) build(planet.land.seed, { keepView: true }).then(() => { if (wreck && viewName !== 'wreck') setView('wreck'); else paintChips(); }); };
  const shown = wreckWant === 'any' ? (planet ? wreckFor(planet.land.seed) : {}) : { paint, pieces: breaks };
  $('wrecks').replaceChildren(chip('None', wreckWant === 'none', () => { if (wreckWant === 'none') return; wreckWant = 'none'; if (viewName === 'wreck') viewName = 'landing'; reWreck(); }, true),
    chip('Each rescue', wreckWant === 'any', () => { if (wreckWant === 'any') return; wreckWant = 'any'; reWreck(); }, true),
    ...WRECK_SHIPS.map((s) => chip(SHIP_NAMES[s], wreckWant === s, () => { if (wreckWant === s) return; byHand(); wreckWant = s; reWreck(); }, true)));
  $('paints').replaceChildren(...Object.entries(PAINTS).map(([id, P]) => { const b = chip(P.name, shown.paint === id, () => { if (shown.paint === id) return; const was = byHand(); paint = id; keep(was ? { wreck: wreckWant, paint, pieces: breaks } : { paint }); if (wreck) repaint(id); paintChips(); }, true); b.title = P.about; return b; }));
  $('breaks').replaceChildren(...[[2, 'In two'], [3, 'In three']].map(([n, t]) => chip(t, shown.pieces === n, () => { if (shown.pieces === n) return; byHand(); breaks = n; reWreck(); }, true)));
  for (const id of ['paints', 'breaks']) { const el = $(id); for (const c of el.children) c.hidden = wreckWant === 'none'; if (el.previousElementSibling) el.previousElementSibling.hidden = wreckWant === 'none'; }
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
LAB.look = (at, to) => { look(at, to); if (planet) { planet.update(camera, 0); planet.relayNow(camera); } };
LAB.build = (seed) => build(seed);
LAB.bench = (frames = 90) => {
  const gl = renderer.getContext(), px = new Uint8Array(4), times = [];
  for (let k = 0; k < frames + 10; k++) {
    const t = performance.now();
    planet.update(camera, 1 / 60); renderer.info.reset(); renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (k >= 10) times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return { median: +times[Math.floor(times.length / 2)].toFixed(2), p90: +times[Math.floor(times.length * 0.9)].toFixed(2), tris: renderer.info.render.triangles, calls: renderer.info.render.calls, patches: planet.ground.stats.patches, rocks: planet.cover.stats.rocks, plants: planet.cover.stats.plants, trees: planet.trees ? planet.trees.stats.trees : 0, treeModels: planet.trees ? planet.trees.stats.models : 0, w: renderer.domElement.width, h: renderer.domElement.height };
};
LAB.curve = CURVE;
LAB.ring = (on) => { ringOn = !!on; if (ring) ring.visible = ringOn; paintChips(); };
// (for the rigs: the wreck chosen as the chips choose it (ship 'none', 'any', or any of ship, paint, pieces by hand)
// and the planet made again with it; the colours alone change it where it lies)
LAB.setWreck = async ({ ship, paint: p, pieces } = {}) => {
  const had = wreck ? `${wreck.ship} ${wreck.stats.pieces}` : 'none';
  if (ship === 'none' || ship === 'any') wreckWant = ship;
  else { byHand(); if (WRECK_SHIPS.includes(ship)) wreckWant = ship; if (PAINTS[p]) paint = p; if (pieces === 2 || pieces === 3) breaks = pieces; }
  const w = planet ? wreckPick(planet.land.seed) : null;
  if (planet && (w ? `${w.ship} ${w.pieces}` : 'none') !== had) await build(planet.land.seed, { keepView: true });
  else if (wreck && w) repaint(w.paint);
  paintChips(); return wreck ? wreck.stats : null;
};

touchControls(); paintChips();
const first = +q.get('seed') > 0 ? Math.floor(+q.get('seed')) : (q.get('kind') ? newSeed(want) : (kept.seed > 0 ? kept.seed : newSeed(want === 'any' ? null : want)));
await build(first);
requestAnimationFrame(loop);
