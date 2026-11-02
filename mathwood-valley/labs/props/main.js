// THE PROPS LAB: the props library (world/props/) on a plank floor, built by the very code the buildings and the game use,
// worn by the same materials. ONE MENU along the bottom: the category's props as pictures, the categories, the views; the
// recipe (built from the catalog's fields) opens just over it. W A S D fly the view (Space up, C down, Shift faster); drag
// turns it.
//   window.PL = { ready, list(cat), show(kind, recipe), lineup(cat), room(on), view(name), night(on), cost(), recipe() }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeTextures } from '../materials/textures.js';
import { U, weather } from '../materials/weather.js';
import { LU, lit, boardWear, glowMaterial, setLamps, lanternGlow } from '../buildings/parts.js';
import { makeArt, makeStoreArt } from '../buildings/art.js';
import { SIGN_LAYOUT } from '../buildings/store.js';
import { makeSaloonArt } from '../buildings/saloonprops.js';
import { buildProps } from '../buildings/props.js';
import { eraseNails } from '../buildings/woodlook.js';
import { makeProp } from '../../world/objects/townProps.js';
import { loadFolk, makePerson } from '../../src/actors/folk.js';
import { CATEGORIES, PROPS, propsIn, normaliseRecipe } from '../../world/props/catalog.js';
import { loadSheet } from '../../world/props/sheet.js';

const $ = (s) => document.querySelector(s), GAME = new URL('../../', import.meta.url).href;
const canvas = $('#c'), q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: q.has('rig') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = q.get('q') !== 'potato'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 0.03, 200);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.62;
const sun = new THREE.DirectionalLight(0xfff3e2, 2.6), hemi = new THREE.HemisphereLight(0x9cbbe0, 0x8a7558, 2.3);   // (a strong sky light: the game's shade sides have the hills' and walls' bounce, which this bare floor doesn't)
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 }); sun.position.set(-5, 9, 6); scene.add(sun, hemi);

const state = { kind: 'roundTable', cat: 'Furniture', recipe: {}, mode: 'one', night: false, room: false };
const mats = {}, GROUP = new THREE.Group(); scene.add(GROUP);
let SAA = null, STA = null, town = new Set(), folkP = null, person = null;

// ── the floor: planks of the kit's wood are plain here (a board's look is the prop's business), so the prop stands out ──
function makeFloor() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    const y = i * 64, l = 92 + (i * 37) % 22; g.fillStyle = `rgb(${l},${l * 0.72},${l * 0.5})`; g.fillRect(0, y, 512, 64); g.fillStyle = 'rgba(15,8,4,0.8)'; g.fillRect(0, y, 512, 2);
    for (let j = 0; j < 26; j++) { g.fillStyle = `rgba(30,16,8,${0.05 + (j % 5) * 0.015})`; g.fillRect(0, y + 3 + (j * 13 + i * 7) % 58, 512, 1); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 })); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m);
}
function makeMaterials(Tx, ART, PAPER) {
  // (the weathering as the Building Lab sets it)
  Object.assign(U.uMossAmt, { value: 0.05 }); U.uGrimeAmt.value = 0.5; U.uEdgeAmt.value = 0.6; U.uEdgeWidth.value = 0.02; U.uEdgeBreak.value = 0.75; U.uPaintChip.value = 0.4;
  U.uAOAmt.value = 1.0; U.uAOSun.value = 0.2; U.uEaveDark.value = 0; U.uBleach.value = 0; U.uDirtBand.value = 0.2; U.uSkyGrey.value = 0.6; U.uEdgeDark.value = 0.45; U.uEdgeDarkW.value = 0.03; U.uBevel.value = 0.55;
  U.uNoise.value = Tx.noise; LU.uPaintWear.value = 0.2;
  mats.wood = boardWear(lit(weather(new THREE.MeshStandardMaterial({ map: Tx.wood, normalMap: Tx.woodN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.94 }), { box: true, ao: true, bevel: true })));
  mats.iron = lit(weather(new THREE.MeshStandardMaterial({ color: 0x3a332e, roughness: 0.55, metalness: 0.65 }), { box: true, ao: true }));
  mats.hay = lit(new THREE.MeshStandardMaterial({ map: ART.hay, roughness: 1 }), { ao: true, tint: true });
  mats.goods = lit(new THREE.MeshStandardMaterial({ map: STA.store, roughness: 0.78 }), { ao: true, tint: true });
  mats.saloonGoods = lit(new THREE.MeshStandardMaterial({ map: SAA.saloon, roughness: 0.78 }), { ao: true, tint: true });
  mats.decal = lit(new THREE.MeshStandardMaterial({ map: STA.store, roughness: 0.9, transparent: true, depthWrite: false, alphaTest: 0.01, polygonOffset: true, polygonOffsetFactor: -2 }), { ao: true });
  mats.saloonDecal = lit(new THREE.MeshStandardMaterial({ map: SAA.saloon, roughness: 0.9, transparent: true, depthWrite: false, alphaTest: 0.01, polygonOffset: true, polygonOffsetFactor: -2 }), { ao: true });
  mats.paper = lit(new THREE.MeshStandardMaterial({ map: PAPER, roughness: 0.74 }), { ao: true, tint: true });
  mats.glow = glowMaterial();
}
// (out of a building there is no bake: the sky's whole light, and each lantern's light reaching everything)
function bake(geo) {
  const n = geo.attributes.position.count;
  // (always: the kit's meshes come with an aAO of zeros, waiting for a bake; left so, they get no sky light at all and
  // anything the sun doesn't reach is black)
  geo.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  if (!geo.attributes.aLamp) { const a = new Float32Array(n * 2).fill(1); geo.setAttribute('aLamp', new THREE.BufferAttribute(a, 2)); }
}

// ── build ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function clear() { for (const m of [...GROUP.children]) { m.removeFromParent(); if (m.userData.own) m.geometry.dispose(); } }
function addBuilt(list) {
  // (a saloon prop's goods are on the saloon's picture, the rest on the store's: one build for each)
  const out = { tris: 0, draws: 0, solids: 0, ms: 0 };
  for (const saloon of [false, true]) {
    const part = list.filter((p) => (PROPS[p.type] && PROPS[p.type].art === 'saloon') === saloon); if (!part.length) continue;
    const P = buildProps(part, { seed: part[0].seed ?? 5, bake, glow: true });
    out.tris += P.tris; out.ms += P.ms;
    for (const g of ['wood', 'iron', 'hay', 'goods', 'paper', 'decal', 'glow']) {
      const geo = P.geos[g]; if (!geo || (geo.index && !geo.index.count)) continue;
      const m = new THREE.Mesh(geo, g === 'goods' && saloon ? mats.saloonGoods : g === 'decal' && saloon ? mats.saloonDecal : mats[g]); m.userData.own = true; m.castShadow = !['decal', 'glow'].includes(g); m.receiveShadow = g !== 'glow'; m.name = g; GROUP.add(m); out.draws++;
    }
  }
  return out;
}
function addTown(kind, x, z) { const g = makeProp(kind); g.position.set(x, 0, z); GROUP.add(g); let tris = 0, draws = 0; g.traverse((o) => { if (o.isMesh) { tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; draws++; } }); return { tris, draws, ms: 0 }; }
function entry(kind, x, z, recipe, seed) {
  const p = PROPS[kind], o = { type: kind, x, y: p.wall ? p.wall : 0, z, ...recipe, seed };
  if (kind === 'hangingLantern') o.y = 1.9;
  return o;
}
let last = null;
function show(kind = state.kind, recipe = state.recipe) {
  state.kind = kind; state.recipe = recipe; state.mode = 'one'; clear(); tags([]);
  const p = PROPS[kind], seed = recipe.seed ?? 5;
  let C;
  if (p.town) C = addTown(kind, 0, 0);
  else if (state.room) { const list = []; for (let i = 0; i < 20; i++) list.push(entry(kind, (i % 5 - 2) * Math.max(1.1, p.foot[0] + 0.3), (Math.floor(i / 4) - 2) * Math.max(1.1, p.foot[1] + 0.4), { ...recipe, rot: i * 0.7 }, seed + i)); C = addBuilt(list); }
  else C = addBuilt([{ ...entry(kind, 0, 0, recipe, seed), ...(kind === 'framedPicture' ? { z: -0.5 } : {}) }]);
  if (kind === 'framedPicture' && !state.room) { const wall = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshStandardMaterial({ color: 0x6a4b33, roughness: 0.95 })); wall.position.set(0, 1.5, -0.51); wall.userData.own = true; GROUP.add(wall); }
  last = C; readout(); drawer(); thumbsOn(); chipsOn();
  frameOn(new THREE.Vector3(0, (p.wall || (kind === 'hangingLantern' ? 1.5 : p.h / 2)), 0), Math.max(p.h, p.foot[0], p.foot[1]) * (state.room ? 5 : 1));
}
async function lineup(cat = state.cat) {
  state.mode = 'lineup'; state.cat = cat; clear();
  const L = propsIn(cat), list = [], names = []; let x = 0, C = { tris: 0, draws: 0, ms: 0 };
  for (const p of L) {
    const w = Math.max(0.6, p.foot[0]) + 0.4; x += w / 2;
    if (p.town) { const c = addTown(p.kind, x, 0); C.tris += c.tris; C.draws += c.draws; } else { const e = entry(p.kind, x, 0, {}, 5); if (p.wall) e.y = 1.4; list.push(e); }
    names.push({ text: p.name, at: new THREE.Vector3(x, Math.max(p.h, p.wall || 0) + 0.12, 0) }); x += w / 2;
  }
  const c = addBuilt(list); C.tris += c.tris; C.draws += c.draws; C.ms = c.ms; last = C;
  const mid = x / 2; GROUP.position.x = 0; for (const n of names) n.at.x -= 0;
  // a person 1.8 m tall at the end of the row, for the size
  try {
    folkP = folkP || loadFolk(GAME); const lib = await folkP;
    if (state.mode === 'lineup') { person = person || makePerson(lib, { outfit: 'farmer_m', palette: 'drifter', skin: 2, hair: 2, shadows: true }); person.root.position.set(-0.6, 0, 0); person.root.rotation.y = 0.5; GROUP.add(person.root); person.play && person.play('Idle', { fade: 0 }); }
  } catch (e) { console.warn('props lab: no person for the line-up', e); }
  tags(names); readout(); chipsOn(); thumbs(); $('#drawer').hidden = true;
  frameOn(new THREE.Vector3(mid - 0.3, 0.9, 0), Math.max(2.4, x * 0.56));
}
const VIEWS = { front: [0.65, 0.32, 1], side: [1, 0.3, 0.05], top: [0.2, 1.4, 0.45], close: [0.5, 0.42, 0.62] };
let framed = { c: new THREE.Vector3(0, 0.5, 0), r: 1 };
function frameOn(c, r) { framed = { c, r }; view('front'); }
function view(name) {
  const v = new THREE.Vector3(...VIEWS[name]).normalize(), d = Math.max(0.9, framed.r * (name === 'close' ? 1.25 : 2.2) + 0.25);
  camera.position.copy(framed.c).addScaledVector(v, d); controls.target.copy(framed.c); controls.update();
}
function night(on) {
  state.night = on;
  hemi.intensity = on ? 0.5 : 2.3; hemi.color.set(on ? 0x2c3e66 : 0x9cbbe0); sun.intensity = on ? 0.5 : 2.6; sun.color.set(on ? 0x9bb2e6 : 0xfff3e2);
  scene.background = new THREE.Color(on ? 0x0d1526 : 0xa9c0d6); renderer.toneMappingExposure = on ? 1.2 : 1;
  LU.uNight.value = on ? 1 : 0; LU.uLamp.value = 1; LU.uLampGain.value = on ? 1.7 : 0; LU.uOutLamp.value = 1;
  setLamps([{ p: [0.9, 1.9, 0.9], strength: on ? 1.4 : 0.15 }]); chipsOn();
}

// ── the readout, the drawer, the menu ────────────────────────────────────────────────────────────────────────────────
const SHARED_MB = () => [mats.wood.map, mats.wood.normalMap, mats.goods.map, mats.paper.map, mats.hay.map].reduce((n, t) => n + (t && t.image ? t.image.width * t.image.height * 4 * 4 / 3 : 0), 0) / 1048576;
function cost() {
  const p = PROPS[state.kind], one = state.mode === 'one' && !state.room;
  return { kind: state.kind, tris: last ? Math.round(last.tris) : 0, budget: one ? p.tris : null, draws: last ? last.draws : 0, ms: last ? Math.round(last.ms * 10) / 10 : 0, sharedMB: +SHARED_MB().toFixed(1), calls: renderer.info.render.calls };
}
function readout() {
  const c = cost(), over = c.budget && c.tris > c.budget;
  $('#hud').innerHTML = `${state.mode === 'lineup' ? esc(state.cat) + ' line-up' : esc(PROPS[state.kind].name) + (state.room ? ' × 20' : '')}: <span class="${over ? 'over' : ''}">${c.tris} tris${c.budget ? ' / ' + c.budget : ''}</span> · ${c.draws} draws · ${c.sharedMB} MB shared, +0 · ${c.ms} ms`;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function drawer() {
  const p = PROPS[state.kind], D = $('#drawer'); D.hidden = false; D.innerHTML = `<h2>${esc(p.name)}</h2>`;
  for (const f of p.fields) {
    const row = document.createElement('div'); row.className = 'pl-row'; const id = 'f-' + f.key, v = state.recipe[f.key] ?? f.def;
    row.innerHTML = `<label for="${id}">${esc(f.label)}</label>`;
    let inp;
    if (f.options) { inp = document.createElement('select'); inp.innerHTML = f.options.map((o) => `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc(o || 'none')}</option>`).join(''); }
    else if (f.check) { inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!v; }
    else { inp = document.createElement('input'); inp.type = 'range'; inp.min = f.min; inp.max = f.max; inp.step = f.step; inp.value = v; }
    inp.id = id; inp.addEventListener('change', () => { const r = { ...state.recipe, [f.key]: f.check ? inp.checked : f.options ? inp.value : +inp.value }; const n = normaliseRecipe(state.kind, r); delete n.kind; show(state.kind, n); });
    row.appendChild(inp); D.appendChild(row);
  }
  const row = document.createElement('div'); row.className = 'pl-row';
  const shuffle = document.createElement('button'); shuffle.className = 'chip'; shuffle.textContent = 'Shuffle'; shuffle.onclick = () => show(state.kind, { ...state.recipe, seed: 1 + Math.floor(Math.random() * 99) });
  const copy = document.createElement('button'); copy.className = 'chip'; copy.textContent = 'Copy recipe'; copy.onclick = () => { const t = JSON.stringify(normaliseRecipe(state.kind, state.recipe)); if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy recipe'; }, 900); };
  row.append(shuffle, copy); D.appendChild(row);
}
const chips = {};
function menu() {
  const T = $('#tabs');
  const add = (key, label, fn, sep) => { const b = document.createElement('button'); b.className = 'chip' + (sep ? ' sep' : ''); b.textContent = label; b.onclick = fn; T.appendChild(b); chips[key] = b; };
  for (const c of CATEGORIES) add('cat:' + c, c, () => { state.cat = c; const first = propsIn(c)[0]; if (first) show(first.kind, {}); thumbs(); });
  add('lineup', 'Line-up', () => lineup(), true); add('room', 'Room of 20', () => { state.room = !state.room; show(); });
  add('night', 'Night', () => night(!state.night));
  for (const v of Object.keys(VIEWS)) add('v:' + v, v[0].toUpperCase() + v.slice(1), () => view(v));
}
function chipsOn() {
  for (const c of CATEGORIES) chips['cat:' + c].classList.toggle('on', state.cat === c);
  chips.lineup.classList.toggle('on', state.mode === 'lineup'); chips.room.classList.toggle('on', state.room); chips.night.classList.toggle('on', state.night);
}
// the pictures: each prop drawn once into its own little canvas, a few each frame, so the page stays alive
const THUMB = new Map(); const thumbQueue = [];
function thumbs() {
  const B = $('#thumbs'); B.innerHTML = '';
  for (const p of propsIn(state.cat)) {
    const b = document.createElement('button'); b.className = 'pl-thumb'; b.dataset.kind = p.kind; b.setAttribute('role', 'option');
    let c = THUMB.get(p.kind);
    if (!c) { c = document.createElement('canvas'); c.width = c.height = 112; THUMB.set(p.kind, c); thumbQueue.push(p.kind); }
    b.append(c, document.createTextNode(p.name)); b.onclick = () => show(p.kind, {}); B.appendChild(b);
  }
  thumbsOn();
}
function thumbsOn() { for (const b of document.querySelectorAll('.pl-thumb')) b.classList.toggle('on', state.mode === 'one' && b.dataset.kind === state.kind); }
function drawThumb(kind) {
  const p = PROPS[kind], keep = [...GROUP.children]; for (const m of keep) m.removeFromParent();
  const was = { p: camera.position.clone(), t: controls.target.clone(), asp: camera.aspect, sb: scene.background, vp: renderer.getSize(new THREE.Vector2()) };
  const C = p.town ? addTown(kind, 0, 0) : addBuilt([entry(kind, 0, 0, {}, 5)]);
  const mid = new THREE.Vector3(0, p.wall || (kind === 'hangingLantern' ? 1.5 : p.h / 2), 0), r = Math.max(p.h, p.foot[0], p.foot[1]);
  camera.position.copy(mid).addScaledVector(new THREE.Vector3(0.65, 0.42, 1).normalize(), r * 2.2 + 0.2); camera.aspect = 1; camera.updateProjectionMatrix(); camera.lookAt(mid);
  renderer.setPixelRatio(1); renderer.setSize(224, 224, false); renderer.render(scene, camera);
  THUMB.get(kind).getContext('2d').drawImage(canvas, 0, 0, 112, 112);
  for (const m of [...GROUP.children]) { m.removeFromParent(); if (m.userData.own) m.geometry.dispose(); }
  for (const m of keep) GROUP.add(m);
  camera.position.copy(was.p); controls.target.copy(was.t); camera.aspect = was.asp; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(was.vp.x, was.vp.y, false); return C;
}
const tagEls = [];
function tags(list) { const box = $('#tags'); box.innerHTML = ''; tagEls.length = 0; for (const n of list) { const d = document.createElement('div'); d.className = 'pl-tag'; d.textContent = n.text; box.appendChild(d); tagEls.push({ d, at: n.at }); } }
const _v = new THREE.Vector3();
function placeTags() { for (const t of tagEls) { _v.copy(t.at).project(camera); t.d.style.display = _v.z < 1 ? '' : 'none'; t.d.style.left = (_v.x + 1) / 2 * innerWidth + 'px'; t.d.style.top = (1 - _v.y) / 2 * innerHeight + 'px'; } }

// ── flying the view from the keyboard: W A S D along the ground the way it faces, Space up, C down, Shift faster ──
const FLY = { KeyW: [0, 0, 1], KeyS: [0, 0, -1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], Space: [0, 1, 0], KeyC: [0, -1, 0] };
const FLYING = { keys: new Set(), fast: false, vel: new THREE.Vector3(), slow: 1.0, perHeight: 0.9, most: 12, shift: 3, ease: 8, up: 0.7, floor: 0.08 };
const typingIn = (t) => !!t && (t.isContentEditable || (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) && !['range', 'checkbox', 'color', 'button'].includes(t.type)));
addEventListener('keydown', (e) => { FLYING.fast = e.shiftKey; if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey || typingIn(e.target)) return; FLYING.keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', (e) => { FLYING.fast = e.shiftKey; FLYING.keys.delete(e.code); });
addEventListener('blur', () => FLYING.keys.clear());
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _want = new THREE.Vector3(), _step = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function fly(dt) {
  const F = FLYING; let fx = 0, fy = 0, fz = 0; for (const k of F.keys) { const v = FLY[k]; fx += v[0]; fy += v[1]; fz += v[2]; }
  const p = camera.position, speed = Math.min(F.most, Math.max(F.slow, p.y * F.perHeight)) * (F.fast ? F.shift : 1);
  camera.getWorldDirection(_fwd); _fwd.y = 0; if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1); _fwd.normalize(); _right.crossVectors(_fwd, UP).normalize();
  _want.set(0, 0, 0).addScaledVector(_fwd, fz).addScaledVector(_right, fx); if (_want.lengthSq() > 1) _want.normalize(); _want.multiplyScalar(speed); _want.y = fy * speed * F.up;
  F.vel.lerp(_want, 1 - Math.exp(-F.ease * dt)); if (!F.keys.size && F.vel.lengthSq() < 1e-5) { F.vel.set(0, 0, 0); return; }
  _step.copy(F.vel).multiplyScalar(dt); p.add(_step); controls.target.add(_step); if (p.y < F.floor) { controls.target.y += F.floor - p.y; p.y = F.floor; if (F.vel.y < 0) F.vel.y = 0; }
}
function resize() { const w = innerWidth, h = innerHeight; if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } }

const PLapi = window.PL = { ready: false, list: (c) => (c ? propsIn(c) : CATEGORIES.flatMap(propsIn)).map((p) => p.kind), show, lineup, room: (on) => { state.room = !!on; show(); }, view, night, cost, recipe: () => normaliseRecipe(state.kind, state.recipe), get thumbsLeft() { return thumbQueue.length; }, fly: { keys: () => [...FLYING.keys] }, renderer, scene, camera };
(async () => {
  const [Tx, ART, PAPER] = await Promise.all([makeTextures({ wood: 'straight' }), makeArt(), loadSheet()]);
  eraseNails(Tx); STA = await makeStoreArt(SIGN_LAYOUT); SAA = await makeSaloonArt();
  makeMaterials(Tx, ART, PAPER); makeFloor(); menu(); night(false); thumbs(); show('roundTable', {});
  $('#loading').hidden = true; PLapi.ready = true;
  let t = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - t) / 1000); t = now; resize(); fly(dt); controls.update();
    if (thumbQueue.length) drawThumb(thumbQueue.shift());
    renderer.render(scene, camera); placeTags();
  });
})().catch((e) => { console.error(e); throw e; });
