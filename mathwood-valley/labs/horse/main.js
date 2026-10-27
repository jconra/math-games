// THE HORSE LAB: the new sculpted horse (horse.glb: the game's horse skeleton and clips, a sculpted body, glossy eyes)
// with its coat worked out in the shader (coat.js) from a coat recipe (recipes.js), on grass under the Material Lab's
// light. A turntable, a line-up of every preset, the old horse beside the new, and two horses down the road at the
// distance a rider sees them.
// This file: the scene, the horses, the panel, the measuring.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { loadAnimals, makeAnimal } from '../../src/actors/animals.js';
import { prepareHorse, coatMaterial, noiseTexture } from './coat.js';
import { PRESETS, PRESET_ORDER, recipe, fill, FACES, LEGS, PINTOS } from './recipes.js';

const $ = (s, el = document) => el.querySelector(s);
const num = (n) => Math.round(n).toLocaleString('en-US');
const kb = (b) => (b >= 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.round(b / 1024) + ' KB');
const GAME = new URL('../../', import.meta.url).href;
const MODEL = 'horse.glb';
// the game's horses as the game dresses them (src/player.js HORSE_LOOKS: which animal, a coat tint over it)
const OLD_LOOKS = {
  bay: { kind: 'horse' }, white: { kind: 'horseWhite' }, palomino: { kind: 'horseWhite', tint: '#f3d394' },
  midnight: { kind: 'horse', tint: '#615753' }, chestnut: { kind: 'farmHorse' },
};
const CLIPS_NEW = ['LookLeft', 'LookRight', 'Nod', 'HeadShake', 'EarFlick'];

// ── renderer, scene, camera, light (the Material Lab's) ───────────────────────────────────────────────────────────────
const canvas = $('#c');
// (?webgl1: draw with WebGL 1, as on a computer without WebGL 2, to check the coat still compiles there)
const WEBGL1 = new URLSearchParams(location.search).has('webgl1');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', context: WEBGL1 ? canvas.getContext('webgl', { antialias: true }) : undefined });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 0.4; controls.maxDistance = 80;
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x5a4a34, 1.0);
scene.add(sun, sun.target, hemi);

const state = {
  preset: 'bay', r: recipe('bay'), view: 'turntable', old: false, mask: 'off',
  clip: 'Idle', playing: true, speed: 1, spin: false,
  az: 200, hour: 15.5, shadows: true,
};

const SKY_DAY = new THREE.Color(0x9cbbe0), SKY_DUSK = new THREE.Color(0xd99a72), SUN_DAY = new THREE.Color(0xfff3e2), SUN_LOW = new THREE.Color(0xffa060);
const sunDir = new THREE.Vector3();
const shadowAt = new THREE.Vector3();
let shadowSize = 6;
function applyLight() {
  const az = state.az * Math.PI / 180, day = Math.sin(Math.PI * (state.hour - 6) / 12);
  const el = Math.max(0.035, day) * 62 * Math.PI / 180;
  sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  const k = THREE.MathUtils.smoothstep(Math.sin(el), 0.04, 0.55);
  sun.color.copy(SUN_LOW).lerp(SUN_DAY, k); sun.intensity = 1.0 + 2.4 * k;
  const sky = SKY_DUSK.clone().lerp(SKY_DAY, k).multiplyScalar(0.55 + 0.45 * k);
  hemi.color.copy(sky).lerp(new THREE.Color(1, 1, 1), 0.25); hemi.intensity = 0.9 + 0.8 * k;
  scene.background = sky; scene.fog = new THREE.Fog(sky, 45, 140);
  sun.position.copy(shadowAt).addScaledVector(sunDir, 40); sun.target.position.copy(shadowAt); sun.target.updateMatrixWorld();
  Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: 90 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.castShadow = state.shadows;
}

// ── the ground: grass, and a dirt road for the riding view ───────────────────────────────────────────────────────────
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function smoothNoise(S, cells, seed) {   // a tiling soft noise (0..1), cells across
  const R = rand(seed), g = []; for (let i = 0; i < cells * cells; i++) g.push(R());
  const at = (x, y) => g[((y % cells) + cells) % cells * cells + ((x % cells) + cells) % cells];
  const out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S * cells, v = y / S * cells, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    out[y * S + x] = (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy;
  }
  return out;
}
function drawGrass() {
  const S = 256, c = canvasOf(S, S), g = c.getContext('2d'), R = rand(5), img = g.createImageData(S, S);
  const a = smoothNoise(S, 4, 11), b = smoothNoise(S, 16, 13);
  for (let i = 0; i < S * S; i++) { const n = a[i], m = b[i]; img.data[i * 4] = 62 + 40 * n + 14 * m; img.data[i * 4 + 1] = 78 + 36 * n + 12 * m; img.data[i * 4 + 2] = 34 + 16 * n; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 2600; k++) {   // blades, drawn over the seams so the tile wraps
    const x = R() * S, y = R() * S, len = 3 + R() * 6, an = -Math.PI / 2 + (R() - 0.5) * 1.1, l = R();
    g.strokeStyle = `rgb(${70 + 70 * l | 0},${90 + 70 * l | 0},${30 + 30 * l | 0})`; g.lineWidth = 0.8 + R() * 0.7;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(an) * len, y + oy + Math.sin(an) * len); g.stroke(); }
  }
  return c;
}
function drawDirt() {
  const S = 256, c = canvasOf(S, S), g = c.getContext('2d'), R = rand(9), img = g.createImageData(S, S);
  const a = smoothNoise(S, 6, 21), b = smoothNoise(S, 32, 23);
  for (let i = 0; i < S * S; i++) { const n = a[i] * 0.6 + b[i] * 0.4; img.data[i * 4] = 128 + 38 * n; img.data[i * 4 + 1] = 104 + 30 * n; img.data[i * 4 + 2] = 74 + 22 * n; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 900; k++) { const x = R() * S, y = R() * S, r = 0.6 + R() * 1.6, l = R(); g.fillStyle = `rgba(${90 + 80 * l | 0},${75 + 60 * l | 0},${55 + 40 * l | 0},0.8)`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  return c;
}
function tex(c, rx, ry) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex(drawGrass(), 64, 64), roughness: 0.97 }));
ground.receiveShadow = true; ground.name = 'grass'; scene.add(ground);
const ROAD_X = 14;   // the road for the riding view runs north-south here, out of the turntable's way
const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 160).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex(drawDirt(), 2, 50), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }));
road.position.set(ROAD_X, 0.003, 0); road.receiveShadow = true; road.name = 'road'; scene.add(road);

// ── the horses ────────────────────────────────────────────────────────────────────────────────────────────────────────
let newLib = null, oldLib = null, oldLoading = null, shape = null, info = null;
const PX = { value: 0.001 };          // metres across a pixel one metre off (the streaks fade out below a pixel)
const horses = [];                    // every horse in the scene: { a, mat, r, old, group }
const group = new THREE.Group(); scene.add(group);
const timing = { load: 0, prep: 0, compile: 0, firstFrame: 0 };

async function loadNew() {
  const t0 = performance.now();
  const [g, json] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL),
    fetch(GAME + 'models/animals/animals.json').then((r) => r.json()),
  ]);
  info = { ...json.kinds.horse };
  timing.load = performance.now() - t0;
  const t1 = performance.now();
  shape = prepareHorse(g.scene, info.scale);
  timing.prep = performance.now() - t1;
  newLib = { dir: '', info: { meshy: info }, kinds: { meshy: { scene: g.scene, clips: g.animations, info } } };
  state.clips = g.animations.map((c) => c.name);
}
function needOld() {
  if (!oldLoading) oldLoading = loadAnimals(GAME, { kinds: ['horse', 'horseWhite', 'farmHorse'] }).then((l) => { oldLib = l; return l; });
  return oldLoading;
}
// one horse: the new body with its own coat (and the eyes as they come), and the game's old one for the same horse
function makeHorse(r) {
  const a = makeAnimal(newLib, 'meshy', { shadows: true });
  let body = null, eye = null;
  a.model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (o.material && o.material.name === 'eye') eye = o;
    else if (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count) body = o;
  });
  const mat = coatMaterial(shape, r, { px: PX });
  body.material = mat;
  if (eye) { eye.frustumCulled = false; eye.castShadow = false; }
  if (a.mesh !== body) { body.computeBoundingSphere(); body.boundingSphere.radius *= 1.35; }
  const h = { a, body, eye, mat, r, old: null, root: new THREE.Group() };
  h.root.add(a.root);
  playOn(h);
  return h;
}
function oldOf(h) {
  if (!oldLib) return null;
  if (!h.old || h.old.look !== h.r.game) {
    if (h.old) h.old.a.dispose();
    const L = OLD_LOOKS[h.r.game] || OLD_LOOKS.bay;
    const a = makeAnimal(oldLib, L.kind, { shadows: true, tint: L.tint });
    h.old = { a, look: h.r.game };
    h.root.add(a.root);
    playOn(h);
  }
  return h.old;
}
function showOld(h, on) {
  if (on) oldOf(h);
  h.a.root.visible = !on || !h.old;
  if (h.old) h.old.a.root.visible = on;
}
function playOn(h) {
  for (const a of [h.a, h.old && h.old.a]) {
    if (!a) continue;
    const name = a.actions[state.clip] ? state.clip : 'Idle';
    a.play(name, { fade: 0, speed: state.speed });
  }
}
function setRecipe(h, r) { h.r = fill(r); h.mat.coat.set(h.r); if (h.old && h.old.look !== h.r.game) oldOf(h); }
function clearHorses() {
  for (const h of horses) { h.a.dispose(); if (h.old) h.old.a.dispose(); h.mat.dispose(); h.root.removeFromParent(); }
  horses.length = 0;
}

// ── the views ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// turntable: one horse, side on to the sun; side: the old and the new horse side by side; lineup: every preset in a row
// like a stable line-up; game: two horses 25 m down the road at a rider's eye height
const tagsEl = $('#tags');
let tags = [];
function setView(v, { keepCam = false } = {}) {
  state.view = v;
  clearHorses(); tagsEl.innerHTML = ''; tags = [];
  if (v === 'turntable' || v === 'gallop') {
    const h = makeHorse(state.r); h.root.rotation.y = -Math.PI / 2; horses.push(h);
    shadowAt.set(0, 0, 0); shadowSize = v === 'gallop' ? 4 : 3;
    if (!keepCam) cam(v === 'gallop' ? [0.6, 1.4, 10.5] : [0.3, 1.35, 5.4], [0, 1.0, 0]);
  } else if (v === 'side') {
    const hn = makeHorse(state.r), ho = makeHorse(state.r);
    hn.root.position.x = 1.7; ho.root.position.x = -1.7; hn.root.rotation.y = ho.root.rotation.y = -Math.PI / 2 + 0.25;
    horses.push(hn, ho); ho.isOld = true;
    needOld().then(() => { showOld(ho, true); });
    addTag(ho, 'Old'); addTag(hn, 'New');
    shadowAt.set(0, 0, 0); shadowSize = 5;
    if (!keepCam) cam([0.4, 1.6, 7.6], [0, 1.0, 0]);
  } else if (v === 'pair') {
    // the same coat from both sides: side on (its left side), and three-quarters from the front on its right side
    const a = makeHorse(state.r), b = makeHorse(state.r);
    a.root.position.set(-1.75, 0, 0); a.root.rotation.y = -Math.PI / 2;
    b.root.position.set(1.9, 0, -0.4); b.root.rotation.y = Math.PI / 2 - 1.3;
    horses.push(a, b);
    shadowAt.set(0, 0, 0); shadowSize = 5;
    if (!keepCam) cam([0.1, 2.0, 6.5], [0.1, 0.95, 0]);
  } else if (v === 'lineup') {
    const n = PRESET_ORDER.length, gap = 1.32;
    PRESET_ORDER.forEach((p, i) => {
      const r = p === 'random' ? recipe('random', state.r.seed || 1) : recipe(p);
      const h = makeHorse(r); h.root.position.set((i - (n - 1) / 2) * gap + 0.45, 0, (i % 2) * -0.7); h.root.rotation.y = -0.5;
      horses.push(h); addTag(h, p === 'random' ? 'Random' : PRESETS[p].label);
      h.a.mixer.update(i * 0.37);
    });
    shadowAt.set(0, 0, 0); shadowSize = 9;
    if (!keepCam) cam([-0.1, 2.3, 11.4], [-0.1, 1.05, -0.3]);
  } else if (v === 'game') {
    // the game's riding camera (src/camera.js CAM: 9 m behind the rider, looking at a point 2.35 m over the horse's
    // feet, tipped 0.26 radians down, a 55 degree view): two horses on the road about 25 m off
    const a = makeHorse(state.r), b = makeHorse(state.preset === 'tobiano' ? recipe('chestnut') : recipe('tobiano'));
    a.root.position.set(ROAD_X - 1.0, 0, -24); a.root.rotation.y = Math.PI - 0.2;
    b.root.position.set(ROAD_X + 1.2, 0, -27); b.root.rotation.y = -0.5;
    horses.push(a, b);
    shadowAt.set(ROAD_X, 0, -25); shadowSize = 6;
    if (!keepCam) { const d = 9, p = 0.26; cam([ROAD_X, 2.35 + d * Math.sin(p), 0], [ROAD_X, 2.35, -d * Math.cos(p)]); }
  }
  camera.fov = v === 'game' ? 55 : 40; camera.updateProjectionMatrix();
  for (const h of horses) group.add(h.root);
  if (state.old && v !== 'side') needOld().then(() => horses.forEach((h) => showOld(h, true)));
  applyMask(); applyLight(); fillStats();
}
function addTag(h, text) { const el = document.createElement('div'); el.className = 'tag'; el.textContent = text; tagsEl.appendChild(el); tags.push({ h, el }); }
const _v = new THREE.Vector3();
function placeTags() {
  const w = canvas.clientWidth, hgt = canvas.clientHeight;
  for (const t of tags) {
    t.h.root.getWorldPosition(_v); _v.y = 0.02; _v.project(camera);
    t.el.style.left = ((_v.x + 1) / 2 * w) + 'px'; t.el.style.top = ((1 - _v.y) / 2 * hgt + 6) + 'px';
    t.el.style.display = _v.z < 1 ? '' : 'none';
  }
}
function cam(pos, tgt) { camera.position.set(...pos); controls.target.set(...tgt); controls.update(); }

// ── the panel ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const R = (label, key, min, max, step, fmt = (v) => (+v).toFixed(2)) => ({ t: 'range', label, key, min, max, step, fmt });
const C = (label, key) => ({ t: 'color', label, key });
const S = (label, key, opts) => ({ t: 'select', label, key, opts });
const K = (label, key) => ({ t: 'check', label, key });
const pct = (v) => Math.round(v * 100) + '%';
const MASKS = [['off', 'Off'], ['parts', 'Parts (legs, neck, head, hindquarters)'], ['hair', 'Mane and tail (root to tip)'], ['white', 'White'], ['flow', 'Way the hair lies'], ['streaks', 'Streaks'], ['heights', 'Heights (10 cm lines)'], ['albedo', 'Colour only (no light)']];
const MASK_CODE = { off: 0, parts: 1, hair: 2, white: 3, flow: 4, streaks: 5, heights: 6, albedo: 7 };
const SECTIONS = [
  { id: 'coat', title: 'Coat', open: true, rows: [
      C('Body colour', 'base'), S('Points', 'points', [['none', 'None'], ['black', 'Black legs and ear tips']]), C('Mane and tail', 'mane'),
      R('Lighter belly', 'belly', 0, 1, 0.01, pct), R('Darker top line', 'sooty', 0, 1, 0.01, pct), R('Dark muzzle', 'muzzle', 0, 1, 0.01, pct),
      R('Greying', 'grey', 0, 1, 0.01, pct), R('Dapples', 'dapples', 0, 1, 0.01, pct), R('Dapple size', 'dappleSize', 0.05, 0.16, 0.005, (v) => Math.round(v * 100) + ' cm'), R('Grey legs', 'greyLegs', 0, 1, 0.01, pct)],
    how: `<p>Nothing is painted into a picture. Every pixel of the horse asks <b>where it sits on the horse standing at rest</b>: the model's own corner positions before the bones move them, in metres (feet on the ground, nose toward +Z). That spot rides along with the bones, so a marking stays put however the horse moves, from a nod to a gallop.</p>
<p>From that spot it works out its colour: the body colour with a big soft mottle (no coat is one flat colour), a <b>darker top line</b> where the surface faces up along the back, a <b>lighter belly</b> and inside of the legs where it faces down or inward, <b>points</b> (black from the hooves to just over the knees and hocks, black ear tips) for a bay or buckskin, a darker muzzle and dark skin round the eyes.</p>
<p><b>Greying</b> takes the colour out first, then lightens the grey toward white: lighter on the head, darker on the legs. <b>Dapples</b> are round lighter spots in a darker net: the distance to the nearest of a scatter of points ("cell noise"), about one spot per dapple size.</p>` },
  { id: 'marks', title: 'Face and legs', open: true, rows: [
      S('Face', 'face', FACES), K('A star too', 'star'), R('Marking size', 'faceSize', 0.5, 1.6, 0.01, (v) => (+v).toFixed(2) + 'x'), R('Ragged edges', 'ragged', 0, 1, 0.01, pct), { t: 'legs' }],
    how: `<p>The face has its own measuring stick: from the <b>poll</b> (the top of the head, between the ears) to the tip of the nose, 0 to 1, and across from the middle of the face in metres. A <b>star</b> is a blob on the forehead about level with the eyes; a <b>stripe</b> a narrow strip down the bridge of the nose; a <b>blaze</b> a wide one from the forehead over the nose to the lip; a <b>bald face</b> wraps out toward the eyes; a <b>snip</b> sits between the nostrils. Only the surface that faces out of the front of the face takes it, so it doesn't run under the jaw.</p>
<p>Each leg's white reaches a height: a <b>coronet</b> just round the top of the hoof, a <b>pastern</b> a little higher, a <b>sock</b> past the fetlock, a <b>stocking</b> to the knee or hock. Its top is roughened with noise and runs a touch higher at the front of the leg. Under a white leg the hoof is pale horn.</p>
<p>White hair edges are soft and a little ragged: the shape's edge is moved in and out by two sizes of noise, and white muzzle shows pink skin.</p>` },
  { id: 'pinto', title: 'Pinto', open: true, rows: [S('Pattern', 'pinto', PINTOS), R('How much white', 'white', 0, 1, 0.01, pct), R('Roaning', 'roan', 0, 1, 0.01, pct), R('Seed', 'seed', 1, 99, 1, (v) => String(Math.round(v))), { t: 'buttons', items: [['New seed', () => { setField('seed', 1 + Math.floor(Math.random() * 98)); }]] }],
    how: `<p>Each pattern is a few rules on top of smooth noise read at the pixel's rest spot. The <b>seed</b> slides the noise, so every pinto is different.</p>
<p><b>Tobiano</b>: big smooth-edged patches. The noise is stretched up and down and barely changes from one side to the other, so the white comes up from the legs and crosses the back; the head and the top of the neck stay dark. <b>Overo</b>: white on the sides of the barrel and neck and under the belly, with jagged edges from two finer noises, kept off the top line and the legs (so the colour frames it), often with a bald face. <b>Sabino</b>: white high up the legs with ragged tops, white along the belly, and <b>roaning</b> round it: single white hairs flecked into the coat, picked by the same hair-sized streak noise as the coat's texture (further off, where a hair is smaller than a pixel, their average).</p>` },
  { id: 'fur', title: 'Fur', open: false, rows: [
      R('Streak bump', 'bump', 0, 3, 0.01), R('Streak colour', 'streakColor', 0, 3, 0.01), R('Velvet sheen', 'sheen', 0, 3, 0.01), R('Coat shine', 'shine', 0, 3, 0.01),
      R('Mane shine', 'maneShine', 0, 2, 0.01), R('Dark roots', 'roots', 0, 0.8, 0.01, pct), R('Light tips', 'tips', 0, 1, 0.01, pct), R('Strand variation', 'strands', 0, 1.5, 0.01),
      { t: 'mask' }],
    how: `<p>Short hair lies one way: back and a little down along the barrel, down the legs and the hindquarters, from the poll down the neck, from the forehead down the face. Each corner of the model knows which part it belongs to (from the bones that move it) and so which way its hair lies.</p>
<p>The <b>streaks</b> are noise squeezed along that way: about 3 mm across and 7 times as long, plus a coarser 1.5 cm "lie" of the coat. The shader reads the streaks here and one step across the hairs, and tilts the light's normal by the difference: a fine bump across the hairs, no normal map needed. They fade out where a streak gets smaller than a pixel, so far-off horses don't shimmer.</p>
<pre>q = p - A * dot(p, A) * (1 - 1/stretch)   (squeeze along the hair A)
streak = noise(q * 300)
normal += across * (streak(p + across*e) - streak(p)) / e * height</pre>
<p>The light on the hair has two extra parts: a <b>velvet sheen</b>, a soft glow where light grazes the coat toward the outline (short hair scatters it toward you), and a <b>hair highlight</b> (Kajiya-Kay) that runs across the hairs instead of the round spot of a plastic. The barrel's short coat is a touch glossier than the legs; the mane and tail glossier still, each strand lighter or darker, darker at the roots and lighter at the tips.</p>
<p>All the noise comes from one 256 x 256 random picture, read so a single lookup gives smooth 3D noise.</p>` },
  { id: 'motion', title: 'Motion', open: true, rows: [{ t: 'clip' }, R('Speed', 'speed', 0, 2, 0.05, (v) => (+v).toFixed(2) + 'x'), K('Turntable (spin slowly)', 'spin')],
    how: `<p>The game's own horse clips (Idle, Walk, Gallop, Eating...) and five new ones for standing in a stall: LookLeft, LookRight, Nod, HeadShake, EarFlick. The coat is drawn from the rest pose, so nothing slides as the body bends.</p>` },
  { id: 'view', title: 'View', open: true, rows: [{ t: 'views' }, K('Show the old horse', 'old')],
    how: `<p><b>Turntable</b>: one horse. <b>Old and new</b>: the game's horse (the animal pack's, with its coat tint) beside the new one. <b>Line-up</b>: every preset in a row, like a stable line-up. <b>Riding view</b>: two horses 25 m down the road, at the height a rider's eye sits. <b>Gallop</b>: mid-gallop from 10 m.</p>` },
  { id: 'light', title: 'Light', open: false, rows: [R('Sun direction', 'az', 0, 359, 1, (v) => Math.round(v) + '°'), R('Time of day', 'hour', 5.5, 19.5, 0.25, (v) => { const h = Math.floor(v), m = Math.round((v - h) * 60); return `${h}:${String(m).padStart(2, '0')}`; }), K('Shadows', 'shadows')] },
  { id: 'cost', title: 'Cost', open: true, rows: [{ t: 'cost' }, { t: 'buttons', items: [['Measure', () => measure()]] }],
    how: `<p><b>ms per frame</b>: the horse alone, drawn 40 times at the current view and size, waiting for the graphics card after each, so it counts the card's work. The old horse is the game's animal-pack model with its one shared material.</p>` },
];
const RECIPE_KEYS = new Set(['base', 'points', 'mane', 'belly', 'sooty', 'muzzle', 'grey', 'dapples', 'dappleSize', 'greyLegs', 'face', 'star', 'faceSize', 'ragged', 'pinto', 'white', 'roan', 'seed', 'bump', 'streakColor', 'sheen', 'shine', 'maneShine', 'roots', 'tips', 'strands']);
const panel = $('#panel');
const getV = (k) => (RECIPE_KEYS.has(k) ? state.r[k] : state[k]);
function setField(k, v) {
  if (RECIPE_KEYS.has(k)) { state.r = { ...state.r, [k]: v }; state.preset = 'custom'; applyRecipe(); markPreset(); }
  else {
    state[k] = v;
    if (k === 'speed') horses.forEach(playOn);
    if (k === 'old') { if (v) needOld().then(() => { horses.forEach((h) => showOld(h, true)); fillStats(); }); else horses.forEach((h) => showOld(h, !!h.isOld)); }
    if (k === 'az' || k === 'hour' || k === 'shadows') applyLight();
  }
  syncPanel();
}
function applyRecipe() {
  if (state.view === 'lineup') return;   // (the line-up shows the presets as they are)
  if (state.view === 'game') { setRecipe(horses[0], state.r); return; }
  for (const h of horses) setRecipe(h, state.r);
}
function control(r, sec) {
  const el = document.createElement('div'); el.className = 'row';
  if (r.t === 'range') {
    const id = 'r-' + r.key;
    el.innerHTML = `<label for="${id}">${r.label}</label><input type="range" id="${id}" min="${r.min}" max="${r.max}" step="${r.step}"><output></output>`;
    $('input', el).addEventListener('input', (e) => setField(r.key, +e.target.value));
    el.dataset.key = r.key; el.dataset.kind = 'range';
  } else if (r.t === 'color') {
    el.classList.add('two'); const id = 'c-' + r.key;
    el.innerHTML = `<label for="${id}">${r.label}</label><input type="color" id="${id}">`;
    $('input', el).addEventListener('input', (e) => setField(r.key, e.target.value));
    el.dataset.key = r.key; el.dataset.kind = 'color';
  } else if (r.t === 'select') {
    el.classList.add('two'); const id = 's-' + r.key;
    el.innerHTML = `<label for="${id}">${r.label}</label><select id="${id}">${r.opts.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`;
    $('select', el).addEventListener('change', (e) => setField(r.key, e.target.value));
    el.dataset.key = r.key; el.dataset.kind = 'select';
  } else if (r.t === 'check') {
    el.classList.add('check');
    el.innerHTML = `<label><input type="checkbox"> ${r.label}</label>`;
    $('input', el).addEventListener('change', (e) => setField(r.key, e.target.checked));
    el.dataset.key = r.key; el.dataset.kind = 'check';
  } else if (r.t === 'legs') {
    el.className = 'legs4';
    el.innerHTML = [['FL', 'Front left'], ['FR', 'Front right'], ['HL', 'Hind left'], ['HR', 'Hind right']].map(([k, l]) => `<label>${l}<select data-leg="${k}">${LEGS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`).join('');
    el.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => { state.r = { ...state.r, legs: { ...state.r.legs, [s.dataset.leg]: s.value } }; state.preset = 'custom'; applyRecipe(); markPreset(); }));
  } else if (r.t === 'mask') {
    el.classList.add('two');
    el.innerHTML = `<label for="s-mask">Show mask</label><select id="s-mask">${MASKS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`;
    $('select', el).addEventListener('change', (e) => { state.mask = e.target.value; applyMask(); });
  } else if (r.t === 'clip') {
    el.classList.add('two');
    el.innerHTML = `<label for="s-clip">Clip</label><div class="btnrow" style="margin:0;flex-wrap:nowrap"><select id="s-clip" style="flex:1"></select><button class="btn" id="playBtn">Pause</button></div>`;
    $('select', el).addEventListener('change', (e) => { state.clip = e.target.value; horses.forEach(playOn); });
    $('#playBtn', el).addEventListener('click', () => { state.playing = !state.playing; $('#playBtn').textContent = state.playing ? 'Pause' : 'Play'; });
  } else if (r.t === 'views') {
    el.className = 'btnrow';
    el.innerHTML = [['turntable', 'Turntable'], ['pair', 'Both sides'], ['side', 'Old and new'], ['lineup', 'Line-up'], ['game', 'Riding view'], ['gallop', 'Gallop']].map(([k, l]) => `<button class="btn" data-view="${k}">${l}</button>`).join('');
  } else if (r.t === 'buttons') {
    el.className = 'btnrow';
    for (const [l, fn] of r.items) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = l; b.addEventListener('click', fn); el.appendChild(b); }
  } else if (r.t === 'cost') {
    el.className = ''; el.innerHTML = '<table class="cmp" id="cmp"></table><p class="note" id="cmpNote"></p>';
  }
  return el;
}
function buildPanel() {
  panel.innerHTML = `<h1>Horse Lab</h1><p class="sub">The sculpted horse with its coat worked out in the shader: hair streaks and sheen, markings, dapples and pintos from a recipe. <a href="../">All labs</a></p>
    <div class="presets">${PRESET_ORDER.map((p) => `<button class="btn" data-preset="${p}">${p === 'random' ? 'Random' : PRESETS[p].label}</button>`).join('')}</div>`;
  for (const sec of SECTIONS) {
    const d = document.createElement('details'); d.className = 'sec'; d.id = 'sec-' + sec.id;
    d.open = window.innerWidth < 760 ? sec.id === 'coat' : !!sec.open;
    d.innerHTML = `<summary>${sec.title}</summary><div class="body"></div>`;
    const body = $('.body', d);
    for (const r of sec.rows) body.appendChild(control(r, sec));
    if (sec.how) { const h = document.createElement('details'); h.className = 'how'; h.innerHTML = `<summary>How it works</summary>${sec.how}`; body.appendChild(h); }
    panel.appendChild(d);
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]'); if (b) usePreset(b.dataset.preset);
    const v = e.target.closest('[data-view]'); if (v) { setView(v.dataset.view); markView(); }
  });
  $('#panelToggle').addEventListener('click', () => { const c = panel.classList.toggle('closed'); $('#panelToggle').setAttribute('aria-expanded', String(!c)); });
}
function fillClips() {
  const s = $('#s-clip'); if (!s) return;
  const names = state.clips || ['Idle'];
  s.innerHTML = names.map((n) => `<option value="${n}">${n}${CLIPS_NEW.includes(n) ? ' (new)' : ''}</option>`).join('');
  s.value = state.clip;
}
function syncPanel() {
  panel.querySelectorAll('.row[data-key]').forEach((row) => {
    const k = row.dataset.key, v = getV(k), kind = row.dataset.kind;
    if (kind === 'range') { const inp = $('input', row), r = SECTIONS.flatMap((s) => s.rows).find((x) => x.key === k); inp.value = v; $('output', row).textContent = r.fmt(v); }
    else if (kind === 'color') $('input', row).value = v;
    else if (kind === 'select') $('select', row).value = v;
    else if (kind === 'check') $('input', row).checked = !!v;
  });
  panel.querySelectorAll('[data-leg]').forEach((s) => { s.value = state.r.legs[s.dataset.leg]; });
}
function markPreset() { panel.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === state.preset)); }
function markView() { panel.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view)); }
function usePreset(p) {
  state.preset = p;
  state.r = p === 'random' ? recipe('random', 1 + Math.floor(Math.random() * 9999)) : recipe(p);
  applyRecipe(); markPreset(); syncPanel(); fillStats();
}
function applyMask() {
  for (const h of horses) h.mat.coat.uniforms.uMask.value = MASK_CODE[state.mask] || 0;
  const L = $('#legend');
  const text = { parts: 'red: legs · green: neck and head · blue: hindquarters (mane, tail mixed in)', hair: 'red: mane · green: tail · blue: root (dark) to tip', white: 'white hair', flow: 'the way the hair lies, as a colour (x, y, z)', streaks: 'the hair streaks', heights: 'a line every 10 cm up from the ground; red: hoof, green: points', albedo: 'the coat\'s colour with no light on it' }[state.mask];
  if (text) { L.hidden = false; L.innerHTML = `<b>Showing:</b> ${text}`; } else L.hidden = true;
}

// ── measuring ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const bench = {};
function gpuMs(n = 40) {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t = performance.now();
  for (let i = 0; i < n; i++) { renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  return (performance.now() - t) / n;
}
async function measure() {
  await needOld();
  const keepVis = horses.map((h) => [h.a.root.visible, h.old && h.old.a.root.visible]);
  const keepG = [ground.visible, road.visible];
  const h = horses[0]; if (!h) return;
  oldOf(h);
  for (const x of horses) { x.a.root.visible = false; if (x.old) x.old.a.root.visible = false; }
  ground.visible = road.visible = false;
  bench.empty = gpuMs();
  h.a.root.visible = true; renderer.info.reset(); bench.newMs = gpuMs(); bench.newCalls = renderer.info.render.calls;
  h.a.root.visible = false; h.old.a.root.visible = true; bench.oldMs = gpuMs(); bench.oldCalls = renderer.info.render.calls;
  ground.visible = keepG[0]; road.visible = keepG[1];
  horses.forEach((x, i) => { x.a.root.visible = keepVis[i][0]; if (x.old) x.old.a.root.visible = !!keepVis[i][1]; });
  bench.size = `${renderer.domElement.width} x ${renderer.domElement.height}`;
  fillStats();
  return bench;
}
function oldTris() {
  const L = OLD_LOOKS[state.r.game] || OLD_LOOKS.bay; if (!oldLib) return null;
  let t = 0; oldLib.kinds[L.kind].scene.traverse((o) => { if (o.isMesh) t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return t;
}
function fillStats() {
  const t = $('#cmp'); if (!t || !shape) return;
  const row = (l, a, b) => `<tr><td>${l}</td><td>${a}</td><td>${b}</td></tr>`;
  const ot = oldTris();
  const eyeTris = shape.eye ? (shape.eye.geometry.index ? shape.eye.geometry.index.count / 3 : 0) : 0;
  t.innerHTML = `<thead><tr><th></th><th>New</th><th>Old</th></tr></thead><tbody>
    ${row('Triangles', num(shape.tris + eyeTris), ot ? num(ot) : '…')}
    ${row('Meshes (draw calls)', shape.eye ? '2 (body, eyes)' : '1', '1')}
    ${row('Extra per corner', '12 bytes (' + kb(shape.attrBytes) + ')', '–')}
    ${row('Pictures', '1 noise, 256 KB', 'none')}
    ${row('ms per frame', bench.newMs ? (bench.newMs - bench.empty).toFixed(2) : '…', bench.oldMs ? (bench.oldMs - bench.empty).toFixed(2) : '…')}
    </tbody>`;
  $('#cmpNote').textContent = `Loaded in ${Math.round(timing.load)} ms, coat set up (rest positions, parts, mane) in ${Math.round(timing.prep)} ms; shaders compiled and the first frame drawn in ${Math.round(timing.compile + timing.firstFrame)} ms (the coat's program, the old horse's and the ground's, all at once). One program for every horse: a stable of them is one compile.`
    + (bench.newMs ? ` Measured at ${bench.size} px, the horse alone (the empty frame, ${bench.empty.toFixed(2)} ms, taken off).` : '');
}
let frames = 0, fpsT = performance.now(), fps = 0, frameMs = 0;
function updateStats() {
  const I = renderer.info.render;
  $('#stats').innerHTML = `<div class="t">Horse Lab</div>
    fps <b>${fps}</b> · ${frameMs.toFixed(1)} ms<br>
    draw calls <b>${I.calls}</b> · triangles <b>${num(I.triangles)}</b><br>
    ${horses.length} horse${horses.length === 1 ? '' : 's'} · ${num(shape.tris)} triangles each<br>
    shaders ready in <b>${Math.round(timing.compile + timing.firstFrame)}</b> ms (first frame)`;
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; }
  const sheet = window.innerWidth <= 760 && !panel.classList.contains('closed');
  if (sheet) camera.setViewOffset(w, h, 0, h * 0.22, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  PX.value = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, renderer.domElement.height);
}
let last = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const t = performance.now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
  resize(); controls.update();
  if (state.playing) for (const h of horses) { h.a.update(dt); if (h.old) h.old.a.update(dt); }
  if (state.spin && (state.view === 'turntable' || state.view === 'gallop')) for (const h of horses) h.root.rotation.y += dt * 0.35;
  const t0 = performance.now(); renderer.render(scene, camera); frameMs = frameMs * 0.9 + (performance.now() - t0) * 0.1;
  placeTags();
  frames++;
  if (t - fpsT > 500) { fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; updateStats(); }
}

(async () => {
  try {
    buildPanel();
    noiseTexture();
    await loadNew();
    fillClips(); syncPanel(); markPreset();
    setView('turntable'); markView();
    resize(); applyLight();
    const t0 = performance.now(); renderer.compile(scene, camera); timing.compile = performance.now() - t0;
    const t1 = performance.now(); renderer.render(scene, camera); renderer.getContext().readPixels(0, 0, 1, 1, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, new Uint8Array(4)); timing.firstFrame = performance.now() - t1;
    $('#loading').classList.add('gone');
    fillStats();
    loop();
    needOld().then(() => fillStats());
    window.HL.ready = true;
  } catch (e) { console.error(e); if (window.oops) window.oops(e); }
})();

// for the test rigs (and the curious): drive the lab from the console
window.HL = {
  ready: false, state, PRESETS,
  preset(p, seed) { if (p === 'random' && seed) { state.preset = 'random'; state.r = recipe('random', seed); applyRecipe(); markPreset(); syncPanel(); } else usePreset(p); },
  set(o) { state.r = fill({ ...state.r, ...o, legs: { ...state.r.legs, ...(o.legs || {}) } }); state.preset = 'custom'; applyRecipe(); syncPanel(); },
  view(v) { setView(v); markView(); },
  cam,
  // a clip, at a time into it (seconds), paused or playing
  clip(name, t = null, { pause = t !== null, speed = state.speed } = {}) {
    state.clip = name; state.speed = speed; horses.forEach(playOn);
    if (t !== null) for (const h of horses) for (const a of [h.a, h.old && h.old.a]) if (a) a.mixer.setTime(t);
    state.playing = !pause; const pb = $('#playBtn'); if (pb) pb.textContent = state.playing ? 'Pause' : 'Play'; fillClips();
  },
  old(on) { setField('old', !!on); return needOld(); },
  mask(m) { state.mask = m; applyMask(); },
  light(az, hour) { if (az != null) state.az = az; if (hour != null) state.hour = hour; applyLight(); },
  turn(rad) { for (const h of horses) h.root.rotation.y = rad; },
  place(list) { list.forEach((p, i) => { const h = horses[i]; if (!h) return; if (p.pos) h.root.position.set(...p.pos); if (p.rot != null) h.root.rotation.y = p.rot; if (p.recipe) setRecipe(h, typeof p.recipe === 'string' ? recipe(p.recipe) : p.recipe); }); },
  measure,
  get horses() { return horses; },
  get info() { const I = renderer.info.render; return { webgl2: renderer.capabilities.isWebGL2, calls: I.calls, tris: I.triangles, timing, shape: shape && { mid: [shape.midX, shape.mid0, shape.mid1], msAO: shape.msAO, tris: shape.tris, verts: shape.verts, attrBytes: shape.attrBytes, hoofTop: shape.hoofTop, knee: shape.knee, hock: shape.hock, fetlock: shape.fetlock, poll: shape.poll.toArray(), nose: shape.nose.toArray(), eyeL: shape.eyeL.toArray(), legSplit: shape.legSplit }, bench, programs: renderer.info.programs.length }; },
  get renderer() { return renderer; },
};
