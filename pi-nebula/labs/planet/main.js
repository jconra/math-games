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
// THE STASIS PODS (the game's maker's own model, kit/stasispod.js; his answers MED-1, MED-2: you walk down the Medic's
// ramp to 3 to 6 pods on the ground beside a crashed ship; nobody is hurt, they are asleep in the pods, safe until
// opened): with a wreck, as many pods as the planet's seed says (3 to 6) lie on the ground beside it (src/planet/pods.js:
// near it but clear of it, near each other with room to walk between, never on the landing place, each on the ground
// and sunk a little into it), someone of our crew asleep in each (src/sleeper.js). The pods in the wreck's crew's colours
// (repainted with it), each sleeper's uniform in their position's colour (his answer STAS1-3 C). The Pods row opens and
// shuts their lids together, for looking; the Look row gets a Pods view. Only here for now: nothing in the game has them
// yet.
//
// Address switches: ?seed=N the planet; ?kind=moon|meadow|canyon a new one of that kind; ?q=low|medium|high graphics;
// EACH POD'S LOCK (src/podlock.js; his words: "opening the statis pods on medical missions can be equation solving, like
// lockboxes"): fly up to a pod and look at it (the prompt over the menu, or E), or tap the pod: its lock is Mathwood's
// lock box in this game's look; solved, that pod's lid opens (the Pods row shuts them all again). The lab's own medic's
// level on the ladder is kept in this browser.
// THE WAY TO THE WRECK (src/planet/search.js, guide.js; the sensors' card src/jobs/sensors.js; his answers RESC1-3 C and
// RESC1-4 C): "Find the wreck" in the Rescue row comes out of the jump over the planet with the sensors' card up, the
// ship (the camera) where the card's grid has it; answered, the beam rises from the wreck, the arrow and the radar's dot
// show, and the blue ship stands on the landing place to set down on. Over a planet with a wreck there is no edge: the
// camera no longer jumps to the ground's copy past its edge, so the wreck is always the one the arrow points back to.
// ?find opens the card as the planet is made. "Fly the Medic" flies it from where the camera is, with the game's own
// flying (src/planet/flyover.js): set down on the blue ship by hand, or the autopilot (T) sets it down there; down,
// Get up (E) gives the camera back. The menu is put away while it is flown.
// ?view=landing|above|low|wreck|pods; ?wreck=none|any|miner|explorer|medic|hauler (any: each rescue, the first pick);
// ?paint=rust|olive|slate and ?pieces=2|3 (with a ship by hand); ?pods=shut|open (their lids);
// ?rig keeps the picture readable for a screenshot; ?hold no clock of its own (LAB.step).
// window.LAB: { ready, planet, land, wreck, pods, podsPlan, quality, timings, view(name), look(at, to), build(seed),
//   bench(frames), step(dt), setWreck({ ship, paint, pieces }), setPods(open 0|1), podsFilled() }
import * as THREE from 'three';
import { makePlanet, makeLandAsync } from '../../src/planet/planet.js';
import { KINDS, kindOf, newSeed, kindById } from '../../src/planet/kinds.js';
import { WIDTH } from '../../src/planet/land.js';
import { CURVE } from '../../src/planet/ground.js';
import { WRECK_SHIPS, PAINTS, wreckFor, clearUnder, clearWay } from '../../src/planet/wreck.js';
import { makeWreck } from '../../src/planet/wreckship.js';
import { podsPlan, footprintTris } from '../../src/planet/pods.js';
import { makePods } from '../../src/planet/podsdraw.js';
import { loadPod } from '../../kit/stasispod.js';
import { openPodLock, labMedic } from '../../src/podlock.js';
import { makePodReach } from '../../src/podreach.js';
import { makeSearch } from '../../src/planet/search.js';
import { flyOver } from '../../src/planet/flyover.js';
import { flightOf } from '../../src/fleet.js';
import { makeWalkLab } from './walk.js';

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
  // (the pods' lids: open kept in the address, shut as they start)
  if (podsWant) u.searchParams.set('pods', 'open'); else u.searchParams.delete('pods');
  return u;
}
// THE PODS: the plan for this planet's (where they lie), the pods drawn, their lids wanted open (1) or shut (0); the crew
// kit for their sleepers, fetched the first time
let podPlan = null, pods = null, podsWant = q.get('pods') === 'open' ? 1 : 0, crewLib = null;
// (each pod's lock: the one open now, and the lab's medic)
let lock = null; const medic = labMedic();
const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
// the menu's line about it: the wreck as it is shown (said again when its colours are changed where it lies), and its pods
const wreckSay = () => (wreck ? ` A crashed ${SHIP_NAMES[wreck.ship]} lies beside the ring, broken in ${wreck.stats.pieces === 2 ? 'two' : 'three'}, in ${PAINTS[wreck.paintId].name.toLowerCase()}${podPlan ? `, ${NUMBERS[podPlan.pods.length] || podPlan.pods.length} stasis pods beside it in the same colours, someone of its crew asleep in each` : ''}.` : '');
function repaint(id) { wreck.paint(id); if (pods) pods.paint(wreck.paintId); const s = document.getElementById('wreckSay'); if (s) s.textContent = wreckSay(); history.replaceState(null, '', wreckAddress(new URL(location.href)).href); }
// the pods' lids on their way open (1) or shut (0)
function setPods(k) { podsWant = k ? 1 : 0; if (pods) pods.open(podsWant); history.replaceState(null, '', wreckAddress(new URL(location.href)).href); paintChips(); }

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
  // (the pods, from the landing place's side, a little over a person's height: far enough off that all of them fit
  // across the screen, an upright phone's too; looked at a little from above their middle, so they stand in the middle
  // of what the menu leaves showing)
  pods: { name: 'Pods', at: (L, a) => {
    const P = podPlan && podPlan.pods; if (!P || !P.length) return VIEWS.landing.at(L, a);
    const cx = P.reduce((s, p) => s + p.x, 0) / P.length, cz = P.reduce((s, p) => s + p.z, 0) / P.length;
    const spread = Math.max(...P.map((p) => Math.hypot(p.x - cx, p.z - cz))) + 2.5;
    let rx = cx - L.x, rz = cz - L.z; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    const half = Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.min(1, camera.aspect)), d = Math.max(8, spread / Math.tan(half) * 0.9);
    const x = cx - rx * d, z = cz - rz * d, y = ground(x, z) + 3.2, ty = ground(cx, cz) + 0.3;
    // (the menu's share of the screen's height: the pods' middle put halfway down what is above it)
    const bar = Math.min(0.6, ($('bar').offsetHeight || 0) / Math.max(1, innerHeight)), down = Math.atan(bar * Math.tan(camera.fov * Math.PI / 360));
    const pitch = Math.atan2(y - ty, d) + down;
    return [[x, y, z], [cx, y - Math.tan(pitch) * d, cz]];
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
  canvas.addEventListener('pointerdown', (e) => { if (drag || document.pointerLockElement === canvas || walk.on) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (document.pointerLockElement === canvas) { turn(e.movementX, e.movementY, 0.0022); return; }
    if (!drag || e.pointerId !== drag.id) return;
    drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
    turn(e.clientX - drag.x, e.clientY - drag.y, 0.0042); drag.x = e.clientX; drag.y = e.clientY;
  });
  const end = (e) => { if (!drag || e.pointerId !== drag.id) return; const click = drag.moved < 4 && e.type === 'pointerup' && e.pointerType === 'mouse'; drag = null; if (click && canLock && !lock && !(reach && reach.tapped())) { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
}
function turn(dx, dy, k) { k *= camera.fov / 60; cam.yaw -= dx * k; cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * k, -1.5, 1.5); applyCam(); }
// flying: W A S D along the level the way the view faces, Space up, C down, Shift faster
const FLY = { KeyW: [0, 0, 1], KeyS: [0, 0, -1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], Space: [0, 1, 0], KeyC: [0, -1, 0] };
const keys = new Set(), vel = new THREE.Vector3(), stickV = { x: 0, y: 0 }, vert = { v: 0 }; let fast = false;
const typing = (t) => t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName);
addEventListener('keydown', (e) => { fast = e.shiftKey; if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || walk.on) return; keys.add(e.code); e.preventDefault(); });
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
  // (not over a planet with a wreck: no edge, the wreck stays the one the arrow points back to)
  const P = WIDTH; if (!search) { if (cam.pos.x > P / 2) cam.pos.x -= P; if (cam.pos.x < -P / 2) cam.pos.x += P; if (cam.pos.z > P / 2) cam.pos.z -= P; if (cam.pos.z < -P / 2) cam.pos.z += P; }
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
    // (the pods' file fetched now, while the ship is broken: only for a planet with a wreck)
    const podFile = pick ? loadPod().catch((e) => { console.error('planet lab: the stasis pod did not come', e); return null; }) : null;
    if (pick) {
      say('Breaking the ship…', `${kind.name}, seed ${seed}`);
      try { W = await makeWreck({ land, ship: pick.ship, pieces: pick.pieces }); } catch (e) { console.error(e); if (window.oops) window.oops(e); W = null; }
    }
    // the pods beside it: where they lie, and the ground under them cleared (before the planet is drawn, as the wreck's)
    let plan = null; const tp = performance.now();
    if (W) {
      const all = W.world.map((w) => w.tris), n = all.reduce((s, a) => s + a.length, 0), tris = new Float32Array(n); let o = 0; for (const a of all) { tris.set(a, o); o += a.length; }
      plan = podsPlan(land, seed, { site: W.site, tris });
      clearUnder(land, footprintTris(plan));
      // (and the way from where the Medic sets down to the pods, as the game keeps it: src/planet/cover.js CLEARING)
      for (const p of plan.pods) clearWay(land, [land.landing.x, land.landing.z], [p.x, p.z]);
    }
    const tpd = performance.now();
    const tw = performance.now();
    if (pods) { pods.dispose(); pods = LAB.pods = null; }
    if (wreck) { wreck.dispose(); wreck = LAB.wreck = null; }
    if (planet) { planet.dispose(); planet = null; }
    podPlan = LAB.podsPlan = plan;
    renderer.info.reset();
    planet = LAB.planet = await makePlanet({ renderer, scene, land, quality });
    LAB.land = land;
    if (W) wreck = LAB.wreck = W.draw({ scene, ground: planet.ground, sky: planet.dome, sunDir: planet.sunDir, paint: pick.paint });
    // the pods drawn (shut or open as the Pods row says); someone asleep in each once the planet is up (below)
    // (in the wreck's crew's colours: his answer STAS1-3 C)
    if (plan && await podFile) { pods = LAB.pods = await makePods({ plan, scene, ground: planet.ground, sky: planet.dome, sunDir: planet.sunDir, paint: wreck ? wreck.paintId : pick.paint }); pods.open(podsWant); for (const p of pods.pods) p.set(podsWant); }
    renderer.toneMappingExposure = planet.exposure;
    placeRing();
    if (!keepView) setView(viewName); else applyCam();
    planet.update(camera, 0); planet.relayNow(camera); if (pods) pods.update(camera, 0);
    // the first picture, so the timing counts the shaders being made too
    renderer.render(scene, camera);
    const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const t2 = performance.now();
    const T = planet.trees && planet.trees.stats;
    LAB.timings = { ground: Math.round(t1 - t0), landInWorker: land.ms, wreck: W ? W.stats.ms : 0, podsPlan: plan ? Math.round(tpd - tp) : 0, pods: pods ? pods.times : null, planet: Math.round(t2 - tw), light: planet.stats.lightMs, cover: planet.stats.coverMs, trees: T ? T.buildMs : 0, treesLoad: T ? T.loadMs : 0, treesBake: T ? T.bakeMs : 0, total: Math.round(t2 - t0) };
    $('seed').value = String(seed);
    const u = new URL(location.href); u.searchParams.set('seed', seed); u.searchParams.delete('kind');
    history.replaceState(null, '', wreckAddress(u).href);
    keep({ seed });
    // (on a narrow screen only the first sentence, so the menu leaves room for the planet)
    note.innerHTML = `<b>${land.kind.name}</b>, seed ${seed}${land.familiar ? ', in Earth\'s colours' : ''}.<span id="wreckSay">${wreckSay()}</span> <span class="pl-long">${land.familiar ? land.kind.aboutEarth : land.kind.about}${T ? ` ${T.trees.toLocaleString()} trees.` : ''} The ground is 2 km across (2,048 m) and repeats past its edges: flying straight across it at the Miner's top speed takes 51 seconds. The landing place is the level ground in the ring, ${2 * land.landing.flat} m across. </span>Made in ${(LAB.timings.total / 1000).toFixed(1)} s.`;
    searchFor();
    loading.hidden = true; LAB.ready = true; paintChips();
    if (pods) fillPods(pods);
  })();
  try { await building; } finally { building = null; }
}
// SOMEONE ASLEEP IN EACH POD, once the planet is up: the crew kit fetched the first time (only for a planet with pods),
// then each pod's sleeper (they come one by one; a planet made again meanwhile leaves the old pods' unmade)
async function fillPods(P) {
  const t0 = performance.now();
  try {
    if (!crewLib) crewLib = import('../../kit/crew.js').then((m) => m.loadCrew());
    const lib = await crewLib; if (P !== pods) return;
    await P.fill(lib);
    if (P === pods) LAB.timings.sleepers = { ...P.times, total: Math.round(performance.now() - t0) };
  } catch (e) { console.error('planet lab: the sleepers did not come', e); crewLib = null; }
}

// ── the menu ─────────────────────────────────────────────────────────────────────────────────────────────────────
function chip(label, on, click, sub = false) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (sub ? ' sub' : '') + (on ? ' on' : ''); b.textContent = label; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.addEventListener('click', (e) => { click(); e.currentTarget.blur(); }); return b; }
function paintChips() {
  $('kinds').replaceChildren(chip('Any kind', want === 'any', () => { want = 'any'; keep({ kind: want }); paintChips(); }, true),
    ...KINDS.map((k) => chip(k.name, want === k.id, () => { want = k.id; keep({ kind: want }); paintChips(); }, true)));
  $('views').replaceChildren(...Object.entries(VIEWS).filter(([id]) => (id !== 'wreck' || wreck) && (id !== 'pods' || podPlan)).map(([id, v]) => chip(v.name, viewName === id, () => setView(id), true)));
  // the pods' lids: shut or open, all together, swinging (only with a wreck: the pods are its crew's)
  $('pods').replaceChildren(...[[0, 'Shut'], [1, 'Open']].map(([k, t]) => chip(t, podsWant === k, () => { if (podsWant === k) return; setPods(k); }, true)));
  $('podsRow').style.display = podPlan ? '' : 'none';
  // the wreck: which ship (or none, or a different one each rescue), its colours, in how many pieces (with each rescue
  // on, the colour and pieces chips show what the seed picked)
  const reWreck = () => { keep({ wreck: wreckWant, paint, pieces: breaks }); paintChips(); if (planet) build(planet.land.seed, { keepView: true }).then(() => { if (wreck && viewName !== 'wreck') setView('wreck'); else paintChips(); }); };
  const shown = wreckWant === 'any' ? (planet ? wreckFor(planet.land.seed) : {}) : { paint, pieces: breaks };
  $('wrecks').replaceChildren(chip('None', wreckWant === 'none', () => { if (wreckWant === 'none') return; wreckWant = 'none'; if (viewName === 'wreck' || viewName === 'pods') viewName = 'landing'; reWreck(); }, true),
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
  // (on foot, the camera is the walk's: ./walk.js; the Medic set down and the rescued go on whichever)
  if (flown) { flown.update(dt); flown.aim(camera, dt); walk.frame(dt); } else if (!walk.frame(dt)) fly(dt);
  planet.update(camera, dt, { shadows: false });
  if (pods) pods.update(camera, dt);
  planet.drawShadows(camera);
  if (reach) reach.update();
  if (search) search.update(camera, dt, flown ? { ahead: flown.nose() } : {});
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
    planet.update(camera, 1 / 60, { shadows: false }); if (pods) pods.update(camera, 1 / 60); planet.drawShadows(camera); renderer.info.reset(); renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (k >= 10) times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return { median: +times[Math.floor(times.length / 2)].toFixed(2), p90: +times[Math.floor(times.length * 0.9)].toFixed(2), tris: renderer.info.render.triangles, calls: renderer.info.render.calls, patches: planet.ground.stats.patches, rocks: planet.cover.stats.rocks, plants: planet.cover.stats.plants, trees: planet.trees ? planet.trees.stats.trees : 0, treeModels: planet.trees ? planet.trees.stats.models : 0, w: renderer.domElement.width, h: renderer.domElement.height };
};
LAB.curve = CURVE;
// (for the rigs: the pods' lids, as the Pods row sets them; whether everyone is asleep in them yet; the pods drawn and
// their sleepers (their numbers))
LAB.setPods = (k) => setPods(k);
LAB.podsFilled = () => !!(pods && pods.filled);
LAB.podsStats = () => (pods ? pods.stats() : null);
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

// ── EACH POD'S LOCK ──────────────────────────────────────────────────────────────────────────────────────────────
// a pod counts as open once its lid is on its way open (by its lock, or the Pods row's Open)
const podOpen = (p) => (p.want ?? pods.want) === 1;
const reach = makePodReach({ camera, canvas, onPick: (p) => openLock(p.i),
  aim: () => Math.min(0.6, ($('bar').offsetHeight || 0) / Math.max(1, innerHeight)),   // (the middle of what the menu leaves showing)
  pods: () => (pods ? pods.pods.map((p, i) => ({ group: p.group, name: `Stasis pod ${i + 1}`, open: podOpen(p), i })) : []) });
function openLock(i) {
  if (lock || !pods || !pods.pods[i]) return null;
  const P = pods; reach.busy(true); keys.clear();
  lock = openPodLock(document.body, { rider: medic.rider, saveRider: medic.save, debug: RIG, ...(LAB.lockRung ? { rung: LAB.lockRung, size: LAB.lockSize } : {}),
    pod: { name: `Stasis pod ${i + 1}`, where: `${i + 1} of ${P.pods.length} beside the wreck · its lock` },
    onOpen: () => { medic.save(medic.rider); if (P === pods) { P.openOne(i, 1); paintChips(); } },
    onClose: () => { lock = null; reach.busy(false); medic.save(medic.rider); } });
  return lock;
}
// (for the rigs: a pod's lock opened as a tap opens it; the one open now; the pod offered now; a rung to deal)
LAB.lock = (i) => openLock(i);
Object.defineProperties(LAB, { lockNow: { get: () => lock }, reach: { get: () => reach } });

// ── THE WAY TO THE WRECK: found by the sensors' card on arrival, then the beam, the arrow, the radar, the blue ship ──
let search = null;
const searchBox = () => { const t = $('top'), b = $('bar'); return { left: 0, top: t.offsetTop + t.offsetHeight, right: innerWidth, bottom: innerHeight - (b.offsetHeight || 0) }; };
// (each planet with a wreck has its own: made with it, gone with it)
function searchFor() {
  if (flown) stopFlying();
  if (search) { search.dispose(); search = LAB.search = null; }
  const row = $('searchRow'); if (row) row.style.display = wreck ? '' : 'none';
  if (!wreck || !planet) return;
  const P = podPlan && podPlan.pods.length ? podPlan.pods : null;
  search = LAB.search = makeSearch({ scene, ground: planet.ground, land: planet.land, wreck: wreck.site, cfg: flightOf('medic'), bounds: searchBox,
    pods: P ? [P.reduce((a, p) => a + p.x, 0) / P.length, P.reduce((a, p) => a + p.z, 0) / P.length] : null,
    // (the ship's view looking a little lower by the menu's share of the screen, as the Pods view does: what it looks at
    // stands in the middle of what the menu leaves showing)
    place: (at, to) => {
      vel.set(0, 0, 0); look(at, to);
      const bar = Math.min(0.6, ($('bar').offsetHeight || 0) / Math.max(1, innerHeight)); cam.pitch += Math.atan(bar * Math.tan(camera.fov * Math.PI / 360)); applyCam();
      planet.update(camera, 0); planet.relayNow(camera); if (pods) pods.update(camera, 0);
    } });
  if (q.has('find') && !LAB.found0) { LAB.found0 = true; findWreck(); }
}
function findWreck() { if (!search || flown) return; keys.clear(); search.start({ ahead: [-Math.sin(cam.yaw), -Math.cos(cam.yaw)] }); }
// THE MEDIC FLOWN from where the camera is (a little up off the ground), its nose the camera's way; the menu put away
let flown = null, flying = false;
async function flyMedic() {
  if (flown || flying || !planet || !wreck) return null;
  flying = true; keys.clear(); vel.set(0, 0, 0);
  const g = ground(cam.pos.x, cam.pos.z), P = podPlan && podPlan.pods.length ? podPlan.pods : null;
  try {
    flown = LAB.flown = await flyOver({ renderer, scene, camera, land: planet.land, at: [cam.pos.x, Math.max(cam.pos.y, g + 25), cam.pos.z], ahead: [-Math.sin(cam.yaw), -Math.cos(cam.yaw)],
      toward: P ? [P.reduce((a, p) => a + p.x, 0) / P.length, P.reduce((a, p) => a + p.z, 0) / P.length] : null, onGetUp: () => stopFlying() });
  } catch (e) { console.error('planet lab: the Medic did not come', e); if (window.oops) window.oops(e); flying = false; return null; }
  // (the menu and the lab's own stick and up and down put away: the flying has its own)
  flying = false; for (const id of ['bar', 'stick', 'updown']) $(id).style.display = 'none';
  return flown;
}
// (the camera given back where the flying's view left it)
function stopFlying() {
  if (!flown) return;
  flown.close(); flown = LAB.flown = null;
  camera.getWorldDirection(_v); cam.pos.copy(camera.position); cam.yaw = Math.atan2(-_v.x, -_v.z); cam.pitch = Math.asin(THREE.MathUtils.clamp(-_v.y, -1, 1));
  camera.up.set(0, 1, 0); camera.fov = 60; camera.near = 0.25; camera.far = 20000; camera.updateProjectionMatrix(); applyCam();
  for (const id of ['bar', 'stick', 'updown']) $(id).style.display = ''; fit();
}
{
  const row = document.createElement('div'); row.className = 'kl-row'; row.id = 'searchRow'; row.style.display = 'none';
  row.innerHTML = '<span class="kl-label pl-keep">Rescue</span>';
  row.append(chip('Find the wreck', false, findWreck, true), chip('Fly the Medic', false, flyMedic, true));
  $('bar').insertBefore(row, $('note').parentElement);
}
// (for the rigs: the card as a tap on Find the wreck opens it; the way lit at once)
LAB.find = () => findWreck();
LAB.fly = () => flyMedic(); LAB.unfly = () => stopFlying();
LAB.cam = () => ({ x: cam.pos.x, y: cam.pos.y, z: cam.pos.z, dx: -Math.sin(cam.yaw), dz: -Math.cos(cam.yaw) });

// ── ON FOOT (./walk.js: the Medic set down beside the wreck, the player walking down its ramp to the pods, the rescued
// coming aboard by themselves; the game's own pieces, src/planet/medicdown.js, onfoot.js, src/rescued.js): its own row
// of the menu; while on foot the flying above rests (walk.on)
const walk = makeWalkLab({ LAB, scene, camera, canvas, renderer, quality,
  lab: () => ({ planet, wreck, pods, podPlan, crewLib: () => (crewLib || (crewLib = import('../../kit/crew.js').then((m) => m.loadCrew()))) }) });

touchControls(); paintChips();
const first = +q.get('seed') > 0 ? Math.floor(+q.get('seed')) : (q.get('kind') ? newSeed(want) : (kept.seed > 0 ? kept.seed : newSeed(want === 'any' ? null : want)));
await build(first);
requestAnimationFrame(loop);
