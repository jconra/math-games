// THE DOG LAB: dog breeds made from the game's own dogs. Each breed is the shiba, the husky or the pug reshaped (every
// bone's length and girth, the head, snout, eyes, ears and tail: src/actors/morph.js, morphplan.js) and given a coat
// painted in code (src/actors/dogcoat.js), made by the very code the game makes them with (src/actors/dogkind.js,
// through the animal library) from the breeds in src/actors/dogbreeds.js and the saved tuning in
// models/animals/dogbreeds.json. Nothing here is a copy of the game's: tune a breed, Save, and the game's dog is it.
//   Save: served from this machine, sent to the little save script (~/pw/bandit-math/rigs/town/save_server.cjs, port
//   8998, POST /dogbreeds), which writes models/animals/dogbreeds.json; anywhere else (or with the script not running)
//   downloaded, to hand over. Only breeds that differ from dogbreeds.js are written.
// ONE MENU: the bar along the bottom: the breeds, then the tabs (Breed, Body, Head, Ears and tail, Coat, Motion, View,
// Save); a tab's controls open in a drawer just over the bar. FLYING THE VIEW: W A S D along the ground the way the
// view faces, Space up, C down, Shift faster; the mouse (or a finger) turns and zooms round the dog (OrbitControls).
// For rigs: window.DL = { ready, state, breeds, pick(id), set(morph), coat(c), collar(c|null), view(name), cam(name),
//   camAt(pos, target), clip(name, t, { pause, speed }), run(v), measure(), kindOf(id), dogs, info, renderer, scene,
//   camera, save(), text() }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAnimals, makeAnimal } from '../../src/actors/animals.js';
import { makeBreedKind, savedBreeds, setSavedBreeds } from '../../src/actors/dogkind.js';
import { BREEDS, BREED_ORDER, BASES, LATER, breedOf, cleanBreed } from '../../src/actors/dogbreeds.js';
import { MORPH, MORPH_GROUPS, EAR_SETS, fillMorph } from '../../src/actors/morphplan.js';
import { COAT, COAT_GROUPS, PATTERNS, PATTERN_ON, EAR_COLOURS, fillCoat } from '../../src/actors/dogcoat.js';

const $ = (id) => document.getElementById(id);
const GAME = new URL('../../', import.meta.url).href;
const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname);
const SAVE_URL = 'http://127.0.0.1:8998/dogbreeds';
const Q = new URLSearchParams(location.search);
const DL = window.DL = { ready: false };
const num = (n) => Math.round(n).toLocaleString('en-US');

// ── renderer, scene, light ────────────────────────────────────────────────────────────────────────────────────────
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9cbbe0); scene.fog = new THREE.Fog(0x9cbbe0, 30, 90);
const camera = new THREE.PerspectiveCamera(35, 1, 0.03, 300);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 0.25; controls.maxDistance = 40;
const sun = new THREE.DirectionalLight(0xfff3e2, 3.1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
const hemi = new THREE.HemisphereLight(0xc6dbff, 0x5a4a34, 1.15);
scene.add(sun, sun.target, hemi);
const SUN_DIR = new THREE.Vector3(-0.45, 0.8, 0.55).normalize();
function lightAt(x, z, size) {
  sun.position.set(x, 0, z).addScaledVector(SUN_DIR, 20); sun.target.position.set(x, 0, z); sun.target.updateMatrixWorld();
  Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 50 }); sun.shadow.camera.updateProjectionMatrix();
}
// the grass, and a dirt track for the running view
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function patchy(S, base, spread, blades, bladeCol, seed) {
  const c = canvasOf(S, S), g = c.getContext('2d'), R = rand(seed);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let k = 0; k < 220; k++) { const x = R() * S, y = R() * S, r = 6 + R() * 24, l = R(); g.fillStyle = `rgba(${spread[0] + 40 * l | 0},${spread[1] + 36 * l | 0},${spread[2] + 16 * l | 0},0.35)`; for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); } }
  for (let k = 0; k < blades; k++) { const x = R() * S, y = R() * S, len = 3 + R() * 6, an = -Math.PI / 2 + (R() - 0.5) * 1.1, l = R();
    g.strokeStyle = bladeCol(l); g.lineWidth = 0.8 + R() * 0.7;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(an) * len, y + oy + Math.sin(an) * len); g.stroke(); } }
  return c;
}
function tex(c, rx, ry) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; }
const grass = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
  map: tex(patchy(256, '#56682f', [70, 88, 36], 2600, (l) => `rgb(${70 + 70 * l | 0},${92 + 70 * l | 0},${32 + 30 * l | 0})`, 5), 100, 100), roughness: 0.97 }));
grass.receiveShadow = true; scene.add(grass);
const TRACK_Z = -14;   // the running view's track: along x, out of the way
const track = new THREE.Mesh(new THREE.PlaneGeometry(200, 3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
  map: tex(patchy(256, '#8a6f50', [120, 96, 70], 500, (l) => `rgba(${80 + 60 * l | 0},${66 + 50 * l | 0},${48 + 30 * l | 0},0.7)`, 9), 66, 1), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }));
track.position.set(0, 0.003, TRACK_Z); track.receiveShadow = true; scene.add(track);

// ── the breeds: working copies, as the game would make them ──────────────────────────────────────────────────────
let lib = null, SAVED = { v: 1, breeds: {} };
const work = {};                    // id -> { label, base, ears, morph (full), coat (full), collar, note }
let ORDER = [...BREED_ORDER];
function fromBreed(b) { return { label: b.label, base: b.base, ears: b.ears, morph: { ...b.morphFull }, coat: { ...b.coatFull }, collar: b.collar ? { ...b.collar } : null, note: b.note }; }
function asBreed(id) { const w = work[id]; return { id, label: w.label, base: w.base, ears: w.ears, collar: w.collar, note: w.note, morphFull: fillMorph(w.morph), coatFull: fillCoat(w.coat) }; }
// a breed as dogbreeds.js keeps it (only what differs from its ear set and the defaults), to compare and to save
const stored = (id) => cleanBreed({ label: work[id].label, base: work[id].base, ears: work[id].ears, morph: work[id].morph, coat: work[id].coat, collar: work[id].collar, note: work[id].note });
const sameAsCode = (id) => BREEDS[id] && JSON.stringify(stored(id)) === JSON.stringify(cleanBreed(BREEDS[id]));
const savedText = { now: '' };
function fileOf() {
  const breeds = {};
  for (const id of ORDER) if (!sameAsCode(id)) breeds[id] = stored(id);
  return { v: 1, note: "The Dog Lab's saved breeds (labs/dogs): each one here is used over src/actors/dogbreeds.js's own; a breed not here is as written there.", breeds };
}
const fileText = () => JSON.stringify(fileOf(), null, 1).replace(/\n {2,}/g, ' ').replace(/\n \}/g, ' }') + '\n';
const edited = () => fileText() !== savedText.now;

// the kinds made from them (kept while a breed is unchanged)
const made = new Map();             // id -> { sig, kind }
const plain = (id) => BASES.includes(id);
function kindOf(id) {
  if (plain(id)) return lib.kinds[id];
  const sig = JSON.stringify(asBreed(id)), m = made.get(id);
  if (m && m.sig === sig) return m.kind;
  const kind = makeBreedKind(lib.kinds[work[id].base], asBreed(id));
  made.set(id, { sig, kind });
  lib.kinds['lab:' + id] = kind;
  return kind;
}
function makeDog(id) {
  const kind = kindOf(id), key = plain(id) ? id : 'lab:' + id;
  lib.kinds[key] = kind;
  const a = makeAnimal(lib, key, { shadows: true });
  a.breedId = id; a.label = plain(id) ? id[0].toUpperCase() + id.slice(1) + ' (as the game has it)' : work[id].label;
  return a;
}

// ── the dogs in the scene, by view ───────────────────────────────────────────────────────────────────────────────
const state = { id: 'bostonFamily', view: 'one', clip: 'Idle', speed: 1, playing: true, spin: false, pace: 3, shadows: true, tab: null };
const dogs = [];                    // { a, id, x, z, rot }
const group = new THREE.Group(); scene.add(group);
let tags = [];
function clearDogs() { for (const d of dogs) d.a.dispose(); dogs.length = 0; $('tags').innerHTML = ''; tags = []; }
function addTag(d, text) { const el = document.createElement('div'); el.className = 'dl-tag'; el.textContent = text; $('tags').appendChild(el); tags.push({ d, el }); }
function place(d) { d.a.root.position.set(d.x, 0, d.z); d.a.root.rotation.y = d.rot; }
function playOn(d, name = state.clip) {
  const a = d.a, clip = a.actions[name] ? name : 'Idle';
  a.play(clip, { fade: 0, speed: state.speed, once: /_Down$|Death|Jump_toIdle/.test(clip) });
}
const BASE_ROW = ['shiba', 'boston', 'bostonFamily', 'bostonPug', 'pug'];
function setView(v, { keepCam = false } = {}) {
  state.view = v;
  const t0 = performance.now();
  clearDogs();
  if (v === 'one' || v === 'run') {
    const d = { a: makeDog(state.id), id: state.id, x: 0, z: v === 'run' ? TRACK_Z : 0, rot: Math.PI / 2 };
    dogs.push(d); place(d); group.add(d.a.root); playOn(d);
    lightAt(0, d.z, 2.5);
    if (!keepCam) camTo(v === 'run' ? 'run' : 'q34');
  } else {
    // a line-up: every breed (compare: two rows, the second behind), or the Boston on both bases beside the plain dogs
    // (bases: one row); a narrow screen gets more rows
    const ids = v === 'bases' ? BASE_ROW : [...ORDER], aspect = innerWidth / innerHeight;
    const rows = v === 'bases' ? (aspect < 0.8 ? 2 : 1) : aspect < 0.8 ? 4 : 2, per = Math.ceil(ids.length / rows);
    let width = 0;
    for (let r = 0; r < rows; r++) {
      let x = 0; const row = [];
      ids.slice(r * per, (r + 1) * per).forEach((id, i) => {
        const a = makeDog(id), len = Math.max(0.5, a.length);
        const d = { a, id, x: 0, z: -r * (rows > 2 ? 1.6 : 1.25), rot: -0.5 };
        if (i) x += len * 0.62 + 0.18; d.x = x; x += len * 0.38;
        dogs.push(d); row.push(d); group.add(a.root); playOn(d); a.mixer.update(dogs.length * 0.37);
        addTag(d, a.label.replace(' (as the game has it)', ''));
      });
      for (const d of row) { d.x -= x / 2; place(d); }
      width = Math.max(width, x);
    }
    lightAt(0, -0.6 * (rows - 1), Math.max(3, width * 0.6 + rows));
    if (!keepCam) camTo('row');
  }
  DL.lastBuildMs = Math.round(performance.now() - t0);
  markTabs(); fillHead();
}
// the camera, round the dog in view (or the row)
function camAt(pos, tgt) { camera.position.set(...pos); controls.target.set(...tgt); controls.update(); }
function camTo(name) {
  const d = dogs[0]; if (!d) return;
  // (further off on a narrow screen, so the dog fits across it)
  const fit = Math.max(1, 1.25 / (innerWidth / innerHeight));
  if (state.view === 'compare' || state.view === 'bases' || name === 'row') {
    const xs = dogs.map((q) => q.x), zs = dogs.map((q) => q.z), w = (Math.max(...xs) - Math.min(...xs) + 1.2) * fit, h = Math.max(...dogs.map((q) => q.a.tall)), zc = (Math.min(...zs) + Math.max(...zs)) / 2;
    const steep = dogs.length && Math.min(...zs) < -2.5 ? 0.45 : 0.2;   // (four rows on a phone: from higher up, so they don't stand in front of each other)
    const views = { row: [[0, h * 1.6 + w * steep, zc + w * 0.95], [0, h * 0.35, zc]], side: [[0, h * 0.7, zc + w * 1.05], [0, h * 0.45, zc]], front: [[w * 0.7, h * 0.8, zc + w * 0.5], [0, h * 0.45, zc]], top: [[0, w * 1.1, zc + 0.01], [0, 0, zc]], q34: [[w * 0.35, h * 1.4 + w * 0.2, zc + w * 0.9], [0, h * 0.45, zc]] };
    const v = views[name] || views.row; camAt(v[0], v[1]); return;
  }
  const a = d.a, H = a.height, L = a.length * fit, cx = a.root.position.x, cz = a.root.position.z, mid = H * 0.62;   // (where it is now: running, it moves)
  // (the dog faces +x: side views from +z, its front from +x)
  const views = {
    side: [[cx, mid, cz + L * 2.25], [cx, mid * 0.9, cz]], front: [[cx + L * 2.0, mid * 1.05, cz], [cx, mid * 0.95, cz]],
    top: [[cx + 0.01, L * 2.5, cz], [cx, 0, cz]], q34: [[cx + L * 1.45, H * 1.25, cz + L * 1.7], [cx, mid * 0.9, cz]],
    head: [[cx + L * 1.25, a.tall * 0.95, cz + L * 0.65], [cx + L * 0.38, a.tall * 0.72, cz]], back: [[cx - L * 2.6, mid * 1.1, cz + L * 0.4], [cx, mid, cz]],
    run: [[cx, H * 1.0, cz + L * 3.6 + 1.2], [cx, H * 0.55, cz]],
  };
  const v = views[name] || views.q34; camAt(v[0], v[1]);
}

// ── flying the view from the keyboard: W A S D along the ground the way it faces, Space up, C down, Shift faster ──
// (the camera and the point it turns round move together; slow near the ground, quicker higher up; not while typing)
const FLY = { KeyW: [0, 0, 1], KeyS: [0, 0, -1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], Space: [0, 1, 0], KeyC: [0, -1, 0] };
const FLYING = { keys: new Set(), fast: false, vel: new THREE.Vector3(), slow: 1.2, perHeight: 0.9, most: 30, shift: 3, ease: 8, up: 0.7, floor: 0.08 };
const typingIn = (t) => !!t && (t.isContentEditable || (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) && !['range', 'checkbox', 'color', 'button'].includes(t.type)));
addEventListener('keydown', (e) => {
  FLYING.fast = e.shiftKey;
  if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey || typingIn(e.target)) return;
  FLYING.keys.add(e.code); if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { FLYING.fast = e.shiftKey; FLYING.keys.delete(e.code); });
addEventListener('blur', () => FLYING.keys.clear());
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _want = new THREE.Vector3(), _step = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function fly(dt) {
  const F = FLYING; let fx = 0, fy = 0, fz = 0;
  for (const k of F.keys) { const v = FLY[k]; fx += v[0]; fy += v[1]; fz += v[2]; }
  const p = camera.position, speed = Math.min(F.most, Math.max(F.slow, p.y * F.perHeight)) * (F.fast ? F.shift : 1);
  camera.getWorldDirection(_fwd); _fwd.y = 0; if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1); _fwd.normalize();
  _right.crossVectors(_fwd, UP).normalize();
  _want.set(0, 0, 0).addScaledVector(_fwd, fz).addScaledVector(_right, fx); if (_want.lengthSq() > 1) _want.normalize();
  _want.multiplyScalar(speed); _want.y = fy * speed * F.up;
  F.vel.lerp(_want, 1 - Math.exp(-F.ease * dt));
  if (!F.keys.size && F.vel.lengthSq() < 1e-5) { F.vel.set(0, 0, 0); return; }
  _step.copy(F.vel).multiplyScalar(dt); p.add(_step); controls.target.add(_step);
  if (p.y < F.floor) { controls.target.y += F.floor - p.y; p.y = F.floor; if (F.vel.y < 0) F.vel.y = 0; }
}

// ── the menu: breeds along the bar, tabs under them, a drawer over the bar ────────────────────────────────────────
const TABS = [['breed', 'Breed'], ['body', 'Body'], ['head', 'Head'], ['ears', 'Ears & tail'], ['coat', 'Coat'], ['motion', 'Motion'], ['view', 'View'], ['save', 'Save']];
function fillBreeds() {
  $('breeds').innerHTML = ORDER.map((id) => { const w = work[id];
    return `<button class="chip${id === state.id ? ' on' : ''}${sameAsCode(id) ? '' : ' edited'}" role="option" aria-selected="${id === state.id}" data-breed="${id}"><i style="background:${w.coat.base}"></i>${w.label}</button>`; }).join('');
}
function markTabs() { $('tabs').querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab))); }
$('tabs').innerHTML = TABS.map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="false">${l}</button>`).join('');
$('tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; openTab(state.tab === b.dataset.tab ? null : b.dataset.tab); });
$('breeds').addEventListener('click', (e) => { const b = e.target.closest('[data-breed]'); if (b) pick(b.dataset.breed); });
function openTab(t) {
  state.tab = t; markTabs();
  const d = $('drawer');
  if (!t) { d.hidden = true; d.innerHTML = ''; return; }
  d.hidden = false; d.innerHTML = drawerHTML(t); wire(d); fillHead(); syncDrawer();
}
const R = (key, src) => { const [lo, hi, step, , label] = src === 'morph' ? MORPH[key] : [COAT[key][2], COAT[key][3], COAT[key][4], 0, COAT[key][5]];
  return `<div class="row" data-key="${key}" data-src="${src}"><label for="r-${key}">${label}</label><input type="range" id="r-${key}" min="${lo}" max="${hi}" step="${step}"><output></output></div>`; };
const C = (key, label = COAT[key][5]) => `<div class="row two" data-key="${key}" data-src="coat"><label for="c-${key}">${label}</label><input type="color" id="c-${key}"></div>`;
const S = (key, label, opts, src = 'coat') => `<div class="row two" data-key="${key}" data-src="${src}"><label for="s-${key}">${label}</label><select id="s-${key}">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>`;
const morphRows = (group) => Object.entries(MORPH).filter(([, v]) => v[5] === group).map(([k]) => R(k, 'morph')).join('');
const coatRows = (group) => Object.entries(COAT).filter(([, v]) => v[6] === group).map(([k, v]) => (v[0] === 'color' ? C(k) : v[0] === 'range' ? R(k, 'coat') : '')).join('');
function drawerHTML(t) {
  const head = `<h2>${TABS.find((x) => x[0] === t)[1]} <small id="dhead"></small></h2>`;
  if (t === 'breed') return head + `<div class="grid">
      <div class="row two"><label for="t-label">Name</label><input id="t-label" type="text" style="background:#24170d;border:1px solid #5a4024;border-radius:5px;padding:3px 6px;min-width:0"></div>
      ${S('base', 'Made from', BASES.map((b) => [b, b[0].toUpperCase() + b.slice(1)]), 'breed')}
      <p class="note" id="t-note"></p>
      <div class="btnrow"><button class="btn" data-act="reset">Back to as written</button><button class="btn" data-act="resetSaved">Back to saved</button><button class="btn" data-act="copy">Copy as a new breed</button></div>
      <p class="note">Every breed is one of the game's three dogs (the shiba, the husky, the pug) reshaped and painted. The Boston terrier is shown on two of them: on the shiba (its snout pulled in) and on the pug (already short-faced; the farm pack's pug has no eyes or ear bones, so those are added).</p>
      <p class="note"><b>Later:</b> ${LATER.join(' · ')}</p></div>`;
  if (t === 'body') return head + `<div class="grid">${morphRows('body')}</div>${HOW.body}`;
  if (t === 'head') return head + `<div class="grid">${morphRows('head')}</div>${HOW.head}`;
  if (t === 'ears') return head + `<div class="grid">${S('ears', 'Ear set', Object.entries(EAR_SETS).map(([k, v]) => [k, v.label]), 'breed')}${morphRows('ears')}<div class="sub">Tail</div>${morphRows('tail')}</div>${HOW.ears}`;
  if (t === 'coat') return head + `<div class="grid">${Object.entries(COAT_GROUPS).map(([g, l]) => `<div class="sub">${l}</div>${coatRows(g)}${g === 'marks' ? S('ears', 'Ears', EAR_COLOURS) : ''}${g === 'pattern' ? S('pattern', 'Pattern', PATTERNS) + S('patternOn', 'Pattern over', PATTERN_ON) : ''}`).join('')}
      <div class="sub">Collar</div><div class="row check"><label><input type="checkbox" id="k-collar"> A collar</label></div>
      <div class="row two"><label for="c-collar">Collar colour</label><input type="color" id="c-collar"></div><div class="row two"><label for="c-studs">Studs</label><input type="color" id="c-studs"></div>
      <div class="row check"><label><input type="checkbox" id="k-studs"> Studs on it</label></div></div>${HOW.coat}`;
  if (t === 'motion') return head + `<div class="grid">
      <div class="row two"><label for="s-clip">Clip</label><select id="s-clip"></select></div>
      <div class="row" data-key="speed" data-src="state"><label for="r-speed">Speed</label><input type="range" id="r-speed" min="0" max="2" step="0.05"><output></output></div>
      <div class="btnrow"><button class="btn" data-act="play">Pause</button><button class="btn" data-clip="Idle">Idle</button><button class="btn" data-clip="Trot">Trot</button><button class="btn" data-clip="Gallop">Gallop</button><button class="btn" data-clip="Sit">Sit</button><button class="btn" data-clip="Lie">Lie</button></div>
      <div class="sub">Running (the paws on the ground)</div>
      <div class="row" data-key="pace" data-src="state"><label for="r-pace">Pace (m/s)</label><input type="range" id="r-pace" min="0.3" max="12" step="0.1"><output></output></div>
      <div class="btnrow"><button class="btn" data-act="run">Run along the track</button></div>
      <p class="note" id="m-gait"></p></div>${HOW.motion}`;
  if (t === 'view') return head + `<div class="grid">
      <div class="btnrow"><button class="btn" data-view="one">One dog</button><button class="btn" data-view="compare">All the breeds</button><button class="btn" data-view="bases">The Boston, both ways</button><button class="btn" data-view="run">Running</button></div>
      <div class="btnrow"><button class="btn" data-cam="side">Side</button><button class="btn" data-cam="front">Front</button><button class="btn" data-cam="q34">Three-quarter</button><button class="btn" data-cam="top">Top</button><button class="btn" data-cam="head">Head</button><button class="btn" data-cam="back">Back</button></div>
      <div class="row check"><label><input type="checkbox" id="k-spin"> Turntable (spin slowly)</label></div>
      <div class="row check"><label><input type="checkbox" id="k-shadows" checked> Shadows</label></div>
      <div class="sub">Cost</div><div class="btnrow"><button class="btn" data-act="measure">Measure: this breed against its plain dog</button></div>
      <table class="cmp" id="cost"></table><p class="note" id="costNote"></p></div>`;
  if (t === 'save') return head + `<div class="grid">
      <p class="note">Saving writes the breeds that differ from <code>src/actors/dogbreeds.js</code> into <code>models/animals/dogbreeds.json</code>, which the game reads over them. ${LOCAL ? 'This machine: straight into the game\'s folder (the save script on port 8998).' : 'Here it downloads the file, to hand over.'}</p>
      <div class="btnrow"><button class="btn go" data-act="save">Save to the game</button><button class="btn" data-act="download">Download</button><button class="btn" data-act="reload">Reload the saved file</button></div>
      <p class="note" id="saveSay"></p>
      <details class="how"><summary>The file</summary><pre id="fileText" style="white-space:pre-wrap;font:11px/1.3 ui-monospace,Consolas,monospace;color:#f0d9a8;max-height:200px;overflow:auto"></pre></details></div>`;
  return head;
}
const HOW = {
  body: `<details class="how"><summary>How it works</summary><p>Each slider stretches some of the dog's bones: its own stretch of the body grows along the dog (side, up, forward) or along the bone, and the bones hanging off it sit that much further away. That gives a new standing pose; the mesh is laid out again in it and bound to it afresh, so each bone carries its reshaped piece of the dog.</p><p>The clips are copied for the breed and changed to match, once: the paws hang on bones of their own that the clips place, so every frame (30 a second) each paw is moved to where its new leg now ends; and the body is lowered or raised, and tipped, so whatever touched the ground in the original frame (the paws standing, the rump sitting, the belly lying) touches it again. Nothing is worked out while it plays: a breed costs what its plain dog costs.</p></details>`,
  head: `<details class="how"><summary>How it works</summary><p>The head is one bone, so the snout is reshaped corner by corner: everything in front of the stop (just in front of the eyes) is pulled in or pushed out, made wider and deeper, eased in over the muzzle's first third so there's no crease. The eyes (the model's own dark faces) grow round their middles and stand out a touch. The neck can be carried further forward; the head turns back to keep the nose level, and can be tipped up or down after.</p></details>`,
  ears: `<details class="how"><summary>How it works</summary><p>The ears are four bones each: grown all over, longer or wider; turned out (all the way out and down, a drop ear) and forward at the root; the tips folded over at the second, third and fourth bones. The turns ride on every key of the clips, so an ear flick still flicks the folded ear. An ear set (pricked, bat, tipped, rose, drop) is a starting point for the sliders. The tail's three bones: length, thickness, carried up or down at the root, curled along the rest.</p></details>`,
  coat: `<details class="how"><summary>How it works</summary><p>The coat is painted into the corners' colours, face by face, from where each face sits on the dog standing at rest (before any reshaping, so a marking stays put on the same faces), which part of the dog it is (from the bones that move it) and which way it faces. In order: the base colour, tan points, a dark saddle, patches, the white markings, a dark mask; the model's own eyes and nose are kept.</p><p>Spots, ticking, brindle and merle are smaller than the faces (a dalmatian's spot is 2 to 3 cm, a face 4 to 8), so they come from a small pattern picture laid over the faces, which only darkens; a face it mustn't touch points at a plain white spot of it. Still one draw a dog.</p></details>`,
  motion: `<details class="how"><summary>How it works</summary><p>Running, the dog moves along the track at the pace and plays the clip the game picks for it (walk, trot, gallop) at the speed that keeps its paws still on the ground: the breed's strides are measured again from how far its paws now swing.</p></details>`,
};
function wire(d) {
  d.querySelectorAll('.row[data-key]').forEach((row) => {
    const k = row.dataset.key, src = row.dataset.src, inp = row.querySelector('input,select');
    inp.addEventListener('input', () => {
      const v = inp.type === 'range' ? +inp.value : inp.value;
      if (src === 'morph') { work[state.id].morph[k] = v; changed(); }
      else if (src === 'coat') { work[state.id].coat[k] = v; changed(); }
      else if (src === 'breed') {
        if (k === 'ears') { const set = EAR_SETS[v] || {}; work[state.id].ears = v; for (const [mk, mv] of Object.entries(set)) if (mk in MORPH) work[state.id].morph[mk] = mv; changed(); syncDrawer(); }
        else if (k === 'base') { work[state.id].base = v; lib.need(v).then(() => changed()); }
      } else if (src === 'state') { state[k] = v; if (k === 'speed') dogs.forEach((q) => q.a.play(q.a.clip || 'Idle', { speed: v })); syncDrawer(); }
      if (row.querySelector('output')) row.querySelector('output').textContent = fmt(k, v);
    });
  });
  const on = (id, ev, fn) => { const el = d.querySelector('#' + id); if (el) el.addEventListener(ev, fn); };
  on('t-label', 'input', (e) => { work[state.id].label = e.target.value || 'Dog'; fillBreeds(); });
  on('k-collar', 'change', (e) => { work[state.id].collar = e.target.checked ? { colour: '#c4302b', studs: '#d8d2c4' } : null; changed(); syncDrawer(); });
  on('c-collar', 'input', (e) => { if (work[state.id].collar) { work[state.id].collar.colour = e.target.value; changed(); } });
  on('c-studs', 'input', (e) => { if (work[state.id].collar) { work[state.id].collar.studs = e.target.value; changed(); } });
  on('k-studs', 'change', (e) => { const c = work[state.id].collar; if (c) { c.studs = e.target.checked ? (c.studs || '#d8d2c4') : null; changed(); } });
  on('k-spin', 'change', (e) => { state.spin = e.target.checked; });
  on('k-shadows', 'change', (e) => { state.shadows = e.target.checked; sun.castShadow = state.shadows; });
  on('s-clip', 'change', (e) => clip(e.target.value));
  d.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.view) setView(b.dataset.view);
    if (b.dataset.cam) camTo(b.dataset.cam);
    if (b.dataset.clip) clip(b.dataset.clip);
    const act = b.dataset.act;
    if (act === 'play') { state.playing = !state.playing; b.textContent = state.playing ? 'Pause' : 'Play'; }
    if (act === 'run') run(state.pace);
    if (act === 'measure') measure();
    if (act === 'reset') { if (BREEDS[state.id]) { work[state.id] = fromBreed(breedOf(state.id)); changed(); syncDrawer(); } }
    if (act === 'resetSaved') { const b2 = breedOf(state.id, SAVED); if (b2) { work[state.id] = fromBreed(b2); changed(); syncDrawer(); } }
    if (act === 'copy') copyBreed();
    if (act === 'save') save();
    if (act === 'download') download();
    if (act === 'reload') reload();
  });
}
const fmt = (k, v) => (k === 'speed' ? (+v).toFixed(2) + 'x' : k === 'pace' ? (+v).toFixed(1) : k === 'seed' ? String(Math.round(v)) : (+v).toFixed(2));
function syncDrawer() {
  const d = $('drawer'); if (d.hidden) return;
  const w = work[state.id];
  d.querySelectorAll('.row[data-key]').forEach((row) => {
    const k = row.dataset.key, src = row.dataset.src, inp = row.querySelector('input,select');
    const v = src === 'morph' ? w.morph[k] : src === 'coat' ? w.coat[k] : src === 'breed' ? w[k] : state[k];
    if (v === undefined) return;
    inp.value = v; const o = row.querySelector('output'); if (o) o.textContent = fmt(k, v);
  });
  const set = (id, fn) => { const el = d.querySelector('#' + id); if (el) fn(el); };
  set('t-label', (el) => { el.value = w.label; });
  set('t-note', (el) => { el.textContent = w.note || ''; });
  set('k-collar', (el) => { el.checked = !!w.collar; });
  set('c-collar', (el) => { el.value = w.collar ? w.collar.colour : '#c4302b'; el.disabled = !w.collar; });
  set('c-studs', (el) => { el.value = w.collar && w.collar.studs ? w.collar.studs : '#d8d2c4'; el.disabled = !w.collar; });
  set('k-studs', (el) => { el.checked = !!(w.collar && w.collar.studs); el.disabled = !w.collar; });
  set('k-spin', (el) => { el.checked = state.spin; });
  set('s-clip', (el) => { const a = dogs[0] && dogs[0].a; const names = a ? Object.keys(a.actions) : ['Idle']; el.innerHTML = names.map((n) => `<option>${n}</option>`).join(''); el.value = state.clip; });
  set('fileText', (el) => { el.textContent = fileText(); });
  const pb = d.querySelector('[data-act="play"]'); if (pb) pb.textContent = state.playing ? 'Pause' : 'Play';
  d.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view));
}
// a line about the breed in view: its size and what making it cost
function fillHead() {
  const el = $('dhead'); if (!el || !lib) return;
  const id = state.id, k = plain(id) ? lib.kinds[id] : (made.get(id) || {}).kind;
  if (!k) { el.textContent = ''; return; }
  const r = k.report || {};
  el.textContent = `${work[id] ? work[id].label : id}: ${Math.round(k.info.height * 100)} cm at the shoulder, ${Math.round(k.info.length * 100)} cm long${r.ms ? ` · made in ${r.ms} ms` : ''}${r.verts ? ` · ${num(r.verts)} corners` : ''}`;
}

// a change: the breed made again (soon after the last slider move, not at every one)
let rebuildT = 0;
function changed() {
  fillBreeds();
  clearTimeout(rebuildT);
  rebuildT = setTimeout(() => { setView(state.view, { keepCam: true }); syncSaveSay(); }, 90);
}
function pick(id) {
  if (!work[id]) return;
  state.id = id; fillBreeds();
  setView(state.view === 'compare' || state.view === 'bases' ? 'one' : state.view);
  syncDrawer();
}
function copyBreed() {
  let n = 2, id; const stem = state.id.replace(/\d+$/, ''); do id = stem + n++; while (work[id]);
  work[id] = JSON.parse(JSON.stringify(work[state.id])); work[id].label = work[state.id].label + ' (copy)';
  ORDER.push(id); pick(id); openTab('breed');
}
function clip(name, t = null, { pause = t !== null, speed = state.speed } = {}) {
  state.clip = name; state.speed = speed;
  for (const d of dogs) { playOn(d, name); if (t !== null) d.a.mixer.setTime(t); }
  state.playing = !pause; syncDrawer();
}
// running along the track: the game's own pace -> clip and speed (actors/animals.js gaitFor, through a.pace)
const running = { on: false, v: 0, x: 0 };
function run(v) {
  if (state.view !== 'run') setView('run');
  running.on = v > 0; running.v = v; running.x = -6; state.playing = true;
}

// ── saving ────────────────────────────────────────────────────────────────────────────────────────────────────────
function syncSaveSay(text, cls) {
  const el = $('saveSay'); if (el) { el.textContent = text || (edited() ? 'Changed since the last save.' : 'As saved.'); el.className = 'note ' + (cls || (edited() ? 'warn' : 'ok')); }
  const ft = $('fileText'); if (ft) ft.textContent = fileText();
}
async function save() {
  const text = fileText();
  if (!LOCAL) { download(); return; }
  try {
    const r = await fetch(SAVE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text });
    if (!r.ok) throw new Error(await r.text());
    savedText.now = text; SAVED = JSON.parse(text); setSavedBreeds(SAVED);
    syncSaveSay('Saved into the game: models/animals/dogbreeds.json.', 'ok'); fillBreeds();
    return true;
  } catch (e) { syncSaveSay('The save script isn\'t answering (node ~/pw/bandit-math/rigs/town/save_server.cjs): downloaded instead.', 'warn'); download(); return false; }
}
function download() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([fileText()], { type: 'application/json' })); a.download = 'dogbreeds.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
async function reload() {
  SAVED = await savedBreeds(lib.dir, { fresh: true });
  loadWork(); savedText.now = fileText(); fillBreeds(); setView(state.view, { keepCam: true }); syncDrawer(); syncSaveSay('Read the saved file again.', 'ok');
}
function loadWork() {
  ORDER = [...BREED_ORDER, ...Object.keys(SAVED.breeds || {}).filter((id) => !BREED_ORDER.includes(id))];
  for (const id of ORDER) work[id] = fromBreed(breedOf(id, SAVED));
}

// ── measuring: the breed against its plain dog, one and twenty-four of each ─────────────────────────────────────
const TQ = renderer.capabilities.isWebGL2 ? renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2') : null;
async function timedMs(n = 60) {
  const gl = renderer.getContext();
  if (!TQ) { const px = new Uint8Array(4); renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t = performance.now(); for (let i = 0; i < n; i++) { renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return (performance.now() - t) / n; }
  const qs = [], out = [];
  renderer.render(scene, camera);
  for (let i = 0; i < n; i++) { const q = gl.createQuery(); gl.beginQuery(TQ.TIME_ELAPSED_EXT, q); renderer.render(scene, camera); gl.endQuery(TQ.TIME_ELAPSED_EXT); qs.push(q); }
  for (const q of qs) {
    for (let k = 0; k < 400 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); k++) await new Promise((r) => setTimeout(r, 5));
    if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(TQ.GPU_DISJOINT_EXT)) out.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
    gl.deleteQuery(q);
  }
  out.sort((a, b) => a - b); return out.length ? out[Math.floor(out.length / 2)] : 0;
}
async function measure() {
  const id = state.id, base = plain(id) ? id : work[id].base, keep = state.view;
  setView('one', { keepCam: true });
  grass.visible = track.visible = false; group.visible = false;
  const bench = { id, base };
  { const gl = renderer.getContext(), px = new Uint8Array(4); for (let i = 0; i < 90; i++) { renderer.render(scene, camera); if (i % 10 === 9) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } }
  const empty = await timedMs();
  const herd = async (who, n) => {
    const list = [];
    for (let i = 0; i < n; i++) { const a = who === 'breed' ? makeDog(id) : makeAnimal(lib, base); a.root.position.set((i % 6 - 2.5) * 0.9, 0, Math.floor(i / 6) * -1.1); a.root.rotation.y = Math.PI / 2; scene.add(a.root); a.play('Trot', { fade: 0 }); a.mixer.update(i * 0.1); list.push(a); }
    renderer.info.reset(); renderer.render(scene, camera);
    const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
    // (the CPU side too: the clips stepped and the skeletons sent, per frame)
    const t0 = performance.now(); for (let f = 0; f < 60; f++) { for (const a of list) a.update(1 / 60); scene.updateMatrixWorld(); } const cpu = (performance.now() - t0) / 60;
    // (the card warmed up first: a run of frames drawn and waited for, so a herd isn't timed while the card is still
    // waking from the light frames before it)
    const gl = renderer.getContext(), px = new Uint8Array(4); for (let i = 0; i < 90; i++) { renderer.render(scene, camera); if (i % 10 === 9) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    const ms = (await timedMs()) - empty;
    for (const a of list) a.dispose();
    return { ms, calls, tris, cpu };
  };
  camAt([0, 2.4, 5.5], [0, 0.3, -1.5]);
  // (each herd twice, turn about, the second kept: the first of anything pays for its first upload)
  for (let r = 0; r < 2; r++) {
    if (r === 0) { bench.plain1 = await herd('plain', 1); bench.breed1 = await herd('breed', 1); bench.plain24 = await herd('plain', 24); bench.breed24 = await herd('breed', 24); }
    else { bench.breed24 = await herd('breed', 24); bench.plain24 = await herd('plain', 24); bench.breed1 = await herd('breed', 1); bench.plain1 = await herd('plain', 1); }   // (the other way round)
  }
  grass.visible = track.visible = true; group.visible = true;
  bench.timer = TQ ? "the graphics card's own timer" : 'the clock'; bench.size = `${renderer.domElement.width} x ${renderer.domElement.height}`;
  DL.bench = bench;
  setView(keep);
  const t = $('cost');
  if (t) {
    const row = (l, a, b) => `<tr><td>${l}</td><td>${a}</td><td>${b}</td></tr>`, f = (x) => x.toFixed(3);
    t.innerHTML = `<thead><tr><th></th><th>${base} (plain)</th><th>${work[id] ? work[id].label : id}</th></tr></thead><tbody>
      ${row('Draws, one dog', bench.plain1.calls, bench.breed1.calls)}${row('Triangles, one dog', num(bench.plain1.tris), num(bench.breed1.tris))}
      ${row('ms, one dog (GPU)', f(bench.plain1.ms), f(bench.breed1.ms))}${row('ms, 24 dogs (GPU)', f(bench.plain24.ms), f(bench.breed24.ms))}
      ${row('ms, 24 dogs (clips, CPU)', f(bench.plain24.cpu), f(bench.breed24.cpu))}</tbody>`;
    $('costNote').textContent = `Measured at ${bench.size} px with ${bench.timer}, the empty frame taken off; dogs trotting.`;
  }
  return bench;
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────────────────────────
let sized = '';
function resize() {
  // (the bar and drawer cover the bottom: the view's middle moved up over them)
  const w = innerWidth, h = innerHeight, bar = $('bar').offsetHeight || 88, cover = bar + ($('drawer').hidden ? 0 : $('drawer').offsetHeight * 0.85);
  const key = [w, h, bar, Math.round(cover)].join(); if (key === sized) return; sized = key;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  document.documentElement.style.setProperty('--bar-h', bar + 'px');
  if (cover > 0) camera.setViewOffset(w, h, 0, cover * 0.5, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
const _v = new THREE.Vector3();
function placeTags() {
  const w = innerWidth, h = innerHeight;
  for (const t of tags) { t.d.a.root.getWorldPosition(_v); _v.y = 0.02; _v.project(camera); t.el.style.left = ((_v.x + 1) / 2 * w) + 'px'; t.el.style.top = ((1 - _v.y) / 2 * h + 4) + 'px'; t.el.style.display = _v.z < 1 ? '' : 'none'; }
}
let last = performance.now(), frames = 0, fpsT = last;
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; frames++;
  resize(); fly(dt); controls.update();
  if (state.playing) {
    for (const d of dogs) {
      if (state.view === 'run' && running.on) {
        running.x += running.v * dt; if (running.x > 12) running.x = -12;
        d.a.pace(running.v); d.a.root.position.x = running.x;
        const c = camera.position, dx = running.x - controls.target.x; c.x += dx; controls.target.x += dx;
      }
      d.a.update(dt);
    }
  }
  if (state.spin && state.view === 'one') for (const d of dogs) d.a.root.rotation.y += dt * 0.4;
  renderer.render(scene, camera);
  placeTags();
  if (now - fpsT > 500) {
    const fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; const I = renderer.info.render;
    $('hud').textContent = `${fps} fps · ${I.calls} draws · ${num(I.triangles)} triangles`;
    if (state.view === 'run' && dogs[0]) { const g = $('m-gait'); if (g) g.textContent = `${dogs[0].a.clip} at ${(dogs[0].a.actions[dogs[0].a.clip] ? dogs[0].a.actions[dogs[0].a.clip].getEffectiveTimeScale() : 1).toFixed(2)}x for ${running.v.toFixed(1)} m/s (stride ${Object.entries(dogs[0].a.stride).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', ')} m)`; }
  }
}

(async () => {
  try {
    lib = await loadAnimals(GAME, { kinds: BASES });
    SAVED = await savedBreeds(lib.dir, { fresh: true });
    loadWork(); savedText.now = fileText();
    if (Q.get('breed') && work[Q.get('breed')]) state.id = Q.get('breed');
    fillBreeds();
    setView(Q.get('view') || 'one');
    if (Q.get('tab')) openTab(Q.get('tab'));
    $('loading').classList.add('gone');
    renderer.setAnimationLoop(frame);
    DL.ready = true;
  } catch (e) { console.error(e); if (window.oops) window.oops(e); }
})();

// (getters kept as getters: Object.assign would read each one once, now)
Object.defineProperties(DL, Object.getOwnPropertyDescriptors({
  state, get breeds() { return work; }, get order() { return ORDER; }, pick, view: setView, cam: camTo, camAt, clip, run, measure, kindOf, tab: openTab,
  set(m) { Object.assign(work[state.id].morph, m); changed(); syncDrawer(); },
  coat(c) { Object.assign(work[state.id].coat, c); changed(); syncDrawer(); },
  collar(c) { work[state.id].collar = c; changed(); syncDrawer(); },
  // the breed made now (not after the short wait a slider has)
  now() { clearTimeout(rebuildT); setView(state.view, { keepCam: true }); },
  get dogs() { return dogs; }, get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; }, get lib() { return lib; },
  get info() { const I = renderer.info.render; return { calls: I.calls, tris: I.triangles, webgl2: renderer.capabilities.isWebGL2, programs: renderer.info.programs.length }; },
  save, text: fileText, edited, fly: { keys: () => [...FLYING.keys] },
  // (for picture rigs: the menu and the strip hidden, or shown again)
  ui(on) { for (const el of document.querySelectorAll('.dl-top, .dl-bar, .dl-drawer, .dl-tags')) el.style.visibility = on ? '' : 'hidden'; sized = ''; },
  // (for picture rigs: a plain background of one colour, no ground, to cut the dog out and set it beside a photo)
  studio(on, colour = 0xff00ff) {
    grass.visible = track.visible = !on; scene.background = new THREE.Color(on ? colour : 0x9cbbe0); scene.fog = on ? null : new THREE.Fog(0x9cbbe0, 30, 90);
    for (const el of document.querySelectorAll('.dl-top, .dl-bar, .dl-drawer, .dl-tags')) el.style.visibility = on ? 'hidden' : '';
    for (const d of dogs) d.a.root.traverse((o) => { if (o.isMesh) o.castShadow = !on; });
  },
  // (the lowest point of each paw and of the body over the ground, now, in cm: for the running pictures)
  feet() {
    const d = dogs[0]; if (!d) return null; const a = d.a, m = a.mesh, g = m.geometry, names = m.skeleton.bones.map((b) => b.name), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, v = new THREE.Vector3(), low = {};
    a.root.updateMatrixWorld(true);
    for (let i = 0; i < g.attributes.position.count; i++) {
      let b = 0, bw = -1; for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; b = si.getComponent(i, c); } }
      const n = names[b], k = /FrontLegL|FFL$|FrontFootL/.test(n) ? 'FL' : /FrontLegR|FFR$|FrontFootR/.test(n) ? 'FR' : /BackLegL|FFBL|BackFootL/.test(n) ? 'BL' : /BackLegR|FFBR|BackFootR/.test(n) ? 'BR' : 'body';
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld); if (!(k in low) || v.y < low[k]) low[k] = v.y;
    }
    for (const k in low) low[k] = +(low[k] * 100).toFixed(1);
    return { ...low, clip: a.clip, x: +a.root.position.x.toFixed(2) };
  },
}));
