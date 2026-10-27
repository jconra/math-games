// THE BUILDING LAB: the town's buildings built from parts in code, one module each (the stable first: stable.js), with
// their props (props.js) and, for the stable, the game's own horses standing in its stalls. The wood is the Material
// Lab's trim sheet and weathering, the stone the Stone Lab's wall maker; this lab adds the light baked through the
// doors and windows and from the lanterns (parts.js), and its own pictures (art.js: the sign, the stall boards, straw).
// This file: the scene, the light and the time of day, the horses, the panel, the stats, and the rigs' handle (window.BL).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeTextures, setWood, WOOD_LOOKS, gpuBytes } from '../materials/textures.js';
import { makeRubbleTexture } from '../stone/stonetex.js';
import { U, weather } from '../materials/weather.js';
import { stoneEdges, PALETTES } from '../stone/stonewall.js';
import { loadAnimals, makeAnimal } from '../../src/actors/animals.js';
import { PRICES, HORSES } from '../../src/catalog.js';
import { buildStable, stableRecipe, PAINTS, RECIPE_DEFAULTS, STABLE } from './stable.js';
import { buildProps } from './props.js';
import { makeArt } from './art.js';
import { LU, lit, paintWear, glowMaterial, animalLamps } from './parts.js';

const $ = (s, el = document) => el.querySelector(s);
const num = (n) => Math.round(n).toLocaleString('en-US');
const MB = (b) => (b / 1048576).toFixed(1) + ' MB';
const GAME = new URL('../../', import.meta.url).href;

// THE HORSES, as the game dresses them (src/player.js HORSE_LOOKS: which animal, a coat tint over it). Their names and
// prices are the game's own (src/catalog.js); the bay comes free, so it is always "owned".
const LOOKS = {
  bay: { kind: 'horse' }, white: { kind: 'horseWhite' }, palomino: { kind: 'horseWhite', tint: '#f3d394' },
  midnight: { kind: 'horse', tint: '#615753' }, chestnut: { kind: 'farmHorse' }, donkey: { kind: 'donkey' },
};
const NAME = Object.fromEntries(HORSES.map((h) => [h.id, h.name.split(' ')[0].toUpperCase()]));
const FULL = Object.fromEntries(HORSES.map((h) => [h.id, h.name]));

// ── renderer, scene, camera, light ───────────────────────────────────────────────────────────────────────────────────
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 0.5; controls.maxDistance = 70;
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x5a4a34, 1.0);
scene.add(sun, sun.target, hemi);

const state = {
  ...RECIPE_DEFAULTS, horses: [...RECIPE_DEFAULTS.horses],
  doors: true, lamps: true, time: 'day', props: true, showHorses: true, quality: 'gaming', az: 200,
  owned: { bay: true, donkey: false, chestnut: false, palomino: false, white: false, midnight: false },
};

// ── the time of day ──────────────────────────────────────────────────────────────────────────────────────────────────
// day: the afternoon sun from the front left (as in the concept picture); dusk: low and orange, the sky going; night: a
// little blue moonlight, the lanterns doing the rest
const TIMES = {
  day: { el: 38, sun: 0xfff3e2, sunI: 3.3, sky: 0x9cbbe0, hemiI: 1.85, ground: 0x5a4a34, exp: 1.0, night: 0, lampGain: 1.35 },
  dusk: { el: 7, sun: 0xffa060, sunI: 1.4, sky: 0xc98a6c, hemiI: 0.75, ground: 0x3c3024, exp: 1.05, night: 0.55, lampGain: 1.2 },
  night: { el: 40, sun: 0x9bb2e6, sunI: 0.6, sky: 0x24345a, hemiI: 0.8, ground: 0x141210, exp: 1.2, night: 1, lampGain: 1.7, bg: 0x0d1526 },
};
const viewCentre = new THREE.Vector3(0, 2.5, 0);
function applyLight() {
  const L = TIMES[state.time], az = (state.time === 'night' ? 140 : state.az) * Math.PI / 180, el = L.el * Math.PI / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  sun.color.set(L.sun); sun.intensity = L.sunI;
  hemi.color.set(L.sky).lerp(new THREE.Color(1, 1, 1), state.time === 'night' ? 0.1 : 0.25); hemi.groundColor.set(L.ground); hemi.intensity = L.hemiI;
  const sky = new THREE.Color(L.bg ?? L.sky);
  scene.background = sky; scene.fog = new THREE.Fog(sky, 50, 150);
  sun.position.copy(viewCentre).addScaledVector(dir, 40); sun.target.position.copy(viewCentre); sun.target.updateMatrixWorld();
  renderer.toneMappingExposure = L.exp;
  LU.uNight.value = L.night; LU.uLamp.value = state.lamps ? 1 : 0; LU.uLampGain.value = L.lampGain;
  U.uShadeDir.value.set(0, 0, -1);
}
// the game's quality tiers: how many pixels, how fine the shadows
const QUALITY = { potato: { ratio: 0.5, shadow: 0 }, normal: { ratio: 1.5, shadow: 1024 }, gaming: { ratio: 2, shadow: 2048 } };
function applyQuality() {
  const Q = QUALITY[state.quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.ratio));
  sun.castShadow = Q.shadow > 0;
  if (Q.shadow && sun.shadow.mapSize.x !== Q.shadow) { sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 90 }); sun.shadow.camera.updateProjectionMatrix();
  resize(true);
}

// ── materials ────────────────────────────────────────────────────────────────────────────────────────────────────────
let T, RT, ART;
const mats = {};
function makeMaterials() {
  // (the Material Lab's frontier-cabin weathering, a little softer: moss mostly on what faces up and on the shady side,
  // grime streaks and a dirt band, the baked shade under the eaves, the sky's blue fill mostly greyed)
  Object.assign(U.uMossAmt, { value: 0.2 }); U.uMossUp.value = 0.9; U.uMossLow.value = 0.25; U.uMossShade.value = 1.0; U.uMossTuck.value = 0.2; U.uMossCrack.value = 0;
  U.uMossHeight.value = 0.9; U.uMossBreak.value = 1.0; U.uMossColor.value.set('#3d4428'); U.uMossSoft.value = 0.02 + 0.3 * 0.55; U.uPatchScale.value = 1 / 4;
  U.uGrimeAmt.value = 0.8; U.uStreakLen.value = 0.7; U.uStreakScale.value = 14 / 8; U.uSplashH.value = 0.5; U.uCornerDirt.value = 0.8; U.uGrimeSoft.value = 0.02 + 0.3 * 0.6;
  U.uGrimeColor.value.set('#5e574d'); U.uEdgeAmt.value = 0.6; U.uEdgeWidth.value = 0.02; U.uEdgeBreak.value = 0.75; U.uPaintChip.value = 0.4;
  U.uAOAmt.value = 1.0; U.uAOSun.value = 0.2; U.uEaveDark.value = 0.3; U.uBleach.value = 0; U.uDirtBand.value = 0.8; U.uSkyGrey.value = 0.6;
  U.uEdgeDark.value = 0.45; U.uEdgeDarkW.value = 0.03; U.uBevel.value = 0.55;
  mats.wood = paintWear(lit(weather(new THREE.MeshStandardMaterial({ map: T.wood, normalMap: T.woodN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.94 }), { box: true, ao: true, bevel: true })));
  mats.iron = lit(weather(new THREE.MeshStandardMaterial({ color: 0x3a332e, roughness: 0.55, metalness: 0.65 }), { box: true, ao: true }));
  mats.stone = lit(stoneEdges(weather(new THREE.MeshStandardMaterial({ map: RT.map, normalMap: RT.normalMap, roughness: 0.93 }), { tint: true, ao: true })));
  mats.stone.shadowSide = THREE.FrontSide;
  mats.hay = lit(new THREE.MeshStandardMaterial({ map: ART.hay, roughness: 1 }), { ao: true, tint: true });
  mats.floor = lit(new THREE.MeshStandardMaterial({ map: ART.floor, roughness: 0.97 }), { ao: true });
  mats.spill = lit(new THREE.MeshStandardMaterial({ map: ART.spill, roughness: 1, alphaTest: 0.5 }), { ao: true });
  mats.boards = lit(new THREE.MeshStandardMaterial({ map: ART.boards, roughness: 0.82 }), { ao: true });
  mats.glow = glowMaterial();
  T.ground.repeat.set(15, 15);
  mats.ground = lit(weather(new THREE.MeshStandardMaterial({ map: T.ground, roughness: 0.97 }), { ground: true, tint: true, ao: true }));
}

// ── the building, its props, its horses ──────────────────────────────────────────────────────────────────────────────
let B = null, P = null, ground = null, groundGeo = null, lib = null;
const group = new THREE.Group(), propGroup = new THREE.Group(), horseGroup = new THREE.Group();
scene.add(group, propGroup, horseGroup);
const horses = [];
const stats = { buildMs: 0, bakeMs: 0, propMs: 0, texMs: 0 };
function rebuild() {
  for (const m of [...group.children]) { group.remove(m); m.geometry.dispose(); }
  for (const m of [...propGroup.children]) { propGroup.remove(m); m.geometry.dispose(); }
  const t0 = performance.now();
  B = buildStable(stableRecipe(state), { texMean: RT.mean });
  for (const g of ['wood', 'iron', 'stone', 'hay', 'floor', 'spill', 'boards', 'glow']) {
    const geo = B.geos[g]; if (!geo) continue;
    const m = new THREE.Mesh(geo, mats[g]); m.name = g; m.castShadow = !['glow', 'spill', 'floor', 'boards'].includes(g); m.receiveShadow = g !== 'glow';
    group.add(m);
  }
  // the front doors: each its own mesh, turned on its hinge
  B.doorMeshes = B.doors.map((L, i) => {
    const m = new THREE.Mesh(L.geo, mats.wood); m.name = 'door ' + (i ? 'right' : 'left'); m.castShadow = m.receiveShadow = true;
    m.position.set(...L.hinge); group.add(m); return m;
  });
  // the props, baked in the building's light
  const off = B.offset;
  P = buildProps(B.props, { seed: state.seed * 7 + 1, bake: (geo) => { geo.translate(-off, 0, 0); B.light.bake(geo); B.light.apply(geo, state.doors); geo.translate(off, 0, 0); } });
  for (const g of ['wood', 'iron', 'hay']) { const m = new THREE.Mesh(P.geos[g], mats[g]); m.castShadow = m.receiveShadow = true; propGroup.add(m); }
  stats.buildMs = B.msBuild; stats.bakeMs = B.msBake; stats.propMs = P.ms; stats.totalMs = performance.now() - t0;
  setDoors(state.doors);
  bakeGround();
  drawBoards();
  placeHorses();
  propGroup.visible = state.props;
  const rb = $('#recipe'); if (rb) rb.textContent = JSON.stringify(stableRecipe(state));
  updateStats();
}
function setDoors(open) {
  state.doors = open;
  if (!B) return;
  B.light.setDoors(open);
  B.doorMeshes.forEach((m, i) => { m.rotation.y = open ? B.doors[i].open : 0; });
  for (const g of Object.values(P.geos)) { g.translate(-B.offset, 0, 0); B.light.apply(g, open); g.translate(B.offset, 0, 0); }
}
// the ground: grass worn to dirt round the building and in the yard before the doors, shaded where it meets the walls
function makeGround() {
  const G = groundGeo = new THREE.PlaneGeometry(70, 70, 140, 140); G.rotateX(-Math.PI / 2);
  G.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(G.attributes.position.count).fill(1), 1));
  G.setAttribute('aTintPaint', new THREE.BufferAttribute(new Float32Array(G.attributes.position.count * 4), 4));
  G.setAttribute('aLamp', new THREE.BufferAttribute(new Float32Array(G.attributes.position.count), 1));
  ground = new THREE.Mesh(G, mats.ground); ground.receiveShadow = true; ground.name = 'ground'; scene.add(ground);
  // (and plain grass out to the horizon, a hair under it)
  const O = new THREE.PlaneGeometry(400, 400, 4, 4); O.rotateX(-Math.PI / 2); O.translate(0, -0.03, 0);
  const n = O.attributes.position.count;
  O.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1)); O.setAttribute('aTintPaint', new THREE.BufferAttribute(new Float32Array(n * 4), 4)); O.setAttribute('aLamp', new THREE.BufferAttribute(new Float32Array(n), 1));
  const far = new THREE.Mesh(O, mats.ground); far.receiveShadow = true; far.name = 'far ground'; scene.add(far);
}
function bakeGround() {
  const P0 = groundGeo.attributes.position, A = groundGeo.attributes.aTintPaint, O = groundGeo.attributes.aAO, Lm = groundGeo.attributes.aLamp, F = B.anchors.footprint;
  const rect = (x, z, x0, x1, z0, z1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  for (let i = 0; i < P0.count; i++) {
    const x = P0.getX(i), z = P0.getZ(i);
    const dB = rect(x, z, -F.w / 2 - 0.4, F.w / 2 + 0.3, -F.d / 2 - 0.5, F.d / 2 + 0.6);
    const dYard = rect(x, z, B.offset - 3.2, B.offset + 3.2, F.d / 2, F.d / 2 + 6.5) + Math.sin(x * 0.7 + z * 0.3) * 0.4;
    A.array[i * 4] = Math.max(1 - THREE.MathUtils.smoothstep(dB, 0, 1.6), 0.9 * (1 - THREE.MathUtils.smoothstep(dYard, 0, 1.8)) * (1 - THREE.MathUtils.smoothstep(z, F.d / 2 + 6, F.d / 2 + 11)));
    // (the ground's shade where it meets the walls, and the lanterns' light on it: the building's bake, at the ground)
    const near = Math.abs(x) < 12 && Math.abs(z) < 11, b = near ? B.light.at(x - B.offset, 0.01, z, 0, 1, 0) : null;
    O.array[i] = b ? 0.45 + 0.55 * b[0] : 1; Lm.array[i] = b ? b[4] : 0;
  }
  A.needsUpdate = O.needsUpdate = Lm.needsUpdate = true;
}
// each stall's board: a chalkboard with the price, or once the horse is yours its name on a brass plate
function drawBoards() {
  for (const S of B.stalls) {
    const id = S.horse, owned = id === 'bay' || !!state.owned[id];
    ART.boards.slotFor(S.board.slot, { owned, label: id.toUpperCase(), price: PRICES.horse[id] ?? 0, plate: NAME[id] || id.toUpperCase() });
  }
}

// THE HORSES: the game's own models (src/actors/animals.js), loaded as the game loads them, one in each stall, its chest
// just behind the stall door so its head comes out over it into the aisle, idling (head and tail moving)
const SHAPE = {};   // per kind: how far its chest and nose reach forward of its middle (measured once, in the Idle pose)
function measure(a) {
  if (SHAPE[a.kind]) return SHAPE[a.kind];
  a.root.position.set(0, 0, 0); a.root.rotation.set(0, 0, 0); a.root.updateMatrixWorld(true);
  const m = a.mesh, v = new THREE.Vector3();
  let chest = -Infinity, nose = -Infinity, top = 0;
  for (let i = 0; i < m.geometry.attributes.position.count; i++) {
    m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
    nose = Math.max(nose, v.z); top = Math.max(top, v.y);
    if (v.y > 0.45 * a.tall && v.y < 0.62 * a.tall) chest = Math.max(chest, v.z);
  }
  return (SHAPE[a.kind] = { chest, nose, top });
}
function placeHorses() {
  for (const h of horses) h.a.dispose();
  horses.length = 0;
  if (!lib || !B) return;
  for (const S of B.stalls) {
    const id = S.horse, look = LOOKS[id] || LOOKS.bay;
    const a = makeAnimal(lib, look.kind, { tint: look.tint || '#ffffff' });
    const sh = measure(a);
    // facing the aisle; its chest 14 cm inside the stall's front
    const x = S.frontX + S.side * (0.14 + sh.chest);
    a.root.position.set(x, 0.015, S.z); a.root.rotation.y = S.face;
    animalLamps(a.mesh.material, B.lamps, B.light.skyAt(x, 1.5, S.z));
    a.mesh.material.needsUpdate = true;
    horseGroup.add(a.root);
    horses.push({ a, id, stall: S.id, next: 4 + Math.random() * 8, shape: sh });
  }
  horseGroup.visible = state.showHorses;
}
// now and then a horse shifts to its other idle (a toss of the head) and back
function tickHorses(dt) {
  for (const h of horses) {
    h.a.update(dt);
    h.next -= dt;
    if (h.next < 0) {
      const opts = h.a.clips.filter((c) => c === 'Idle' || c === 'Idle_2');
      const pick = h.a.clip === 'Idle' && opts.length > 1 ? 'Idle_2' : 'Idle';
      h.a.play(pick, { fade: 0.6 }); h.next = pick === 'Idle' ? 6 + Math.random() * 10 : 3.3;
    }
  }
}

// ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────────
const panel = $('#panel');
const VIEWS = {
  front: [[-9.5, 4.2, 17.5], [0.3, 3.2, 0]],
  doors: [[0.9, 2.6, 10.6], [1.2, 2.9, 3]],
  aisle: [[1.65, 1.62, 5.6], [1.65, 1.55, -3]],
  stall: [[0.5, 1.9, 3.3], [3.6, 1.7, 1.25]],
  leanto: [[-12.5, 2.6, 6.5], [-4.6, 1.6, 0]],
  back: [[9.5, 4.0, -13.5], [0.5, 3.0, 0]],
  roof: [[-6.5, 13, 9], [1.2, 7.4, -0.6]],
};
function buildPanel() {
  const opt = (obj, cur) => Object.entries(obj).map(([k, L]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${L.label || L}</option>`).join('');
  const forSale = Object.keys(PRICES.horse);
  panel.innerHTML = `<h1>Building Lab</h1><p class="sub">The town's buildings built from parts in code: walls, roof, doors and all, ready to walk into. <a href="../">All labs</a></p>
  <details class="sec" open><summary>Building</summary><div class="body">
    <div class="picks"><button class="btn on" data-bld="stable">Stable</button><button class="btn" disabled title="next">General store</button><button class="btn" disabled title="after that">Sheriff's office</button></div>
    <div class="row two"><label for="s-paint">Paint</label><select id="s-paint">${opt(PAINTS, state.paint)}</select></div>
    <div class="row" data-key="wear"><label for="r-wear">Paint worn off</label><input type="range" id="r-wear" min="0" max="1" step="0.01" value="${state.wear}"><output>${state.wear.toFixed(2)}</output></div>
    <div class="row two"><label for="s-wood">Wood</label><select id="s-wood">${opt(WOOD_LOOKS, state.wood)}</select></div>
    <div class="row two"><label for="s-stone">Stone colours</label><select id="s-stone">${opt(PALETTES, state.stone)}</select></div>
    <div class="seedrow"><label for="seed">Seed</label><input id="seed" type="number" min="1" step="1" value="${state.seed}"><button class="btn" id="newSeed">New seed</button></div>
    <div class="lbl">This building's recipe</div><pre class="recipe" id="recipe"></pre>
    <p class="note">Everything that makes this stable its own, small enough for the town to keep one per building.</p>
  </div></details>
  <details class="sec" open><summary>Show</summary><div class="body">
    <div class="picks" id="times">${['day', 'dusk', 'night'].map((t) => `<button class="btn" data-time="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
    <div class="row check"><label><input type="checkbox" id="doors"> Front doors open</label></div>
    <div class="row check"><label><input type="checkbox" id="lamps"> Lanterns lit</label></div>
    <div class="row check"><label><input type="checkbox" id="props"> Props (barrels, trough, crates, bales, wagon)</label></div>
    <div class="row check"><label><input type="checkbox" id="showHorses"> Horses</label></div>
    <div class="lbl">Bought (its board turns into a name plate)</div>
    ${forSale.map((id) => `<div class="row check"><label><input type="checkbox" data-owned="${id}"> ${FULL[id] || id} (${PRICES.horse[id]} gold)</label></div>`).join('')}
    <div class="lbl">Look from</div>
    <div class="picks">${Object.keys(VIEWS).map((v) => `<button class="btn" data-view="${v}">${v}</button>`).join('')}</div>
    <div class="row two"><label for="s-q">Quality</label><select id="s-q">${opt({ potato: 'Potato', normal: 'Normal', gaming: 'Gaming' }, state.quality)}</select></div>
  </div></details>
  <details class="sec"><summary>How it's made</summary><div class="body"><div class="how" style="border:0;margin:0;padding:0">
    <p><b>Parts</b>: every board, batten, post, rafter and shake is a box from the Material Lab's parts kit, merged into one mesh per material (wood, iron), so the whole barn is a handful of draw calls. The walls are <b>board and batten</b>: upright boards 22 to 32 cm wide with a narrow batten over each joint, cut round the doors and windows. Each board is two skins: the outside one painted, the inside one bare (barns are painted outside only).</p>
    <p><b>Paint</b> is a colour in the recipe. The weathering shader chips it at the edges, and this lab wears it away in streaks down the boards and big soft patches, more of it low down and on the sunny side, less under the eaves; the slider says how much has gone.</p>
    <p><b>Inside light</b> is baked once: for every corner indoors, how much of the outdoors it sees through the doorways and windows (each opening's share of its view, with a few rays through a grid of the solid parts so a partition shades the stall behind it), kept in two parts so shutting the front doors darkens it. The lanterns' warm light is baked the same way: what faces a lantern and isn't behind a wall is lit, falling off with the distance squared.</p>
    <p><b>Horses</b> are the game's own (src/actors/animals.js), each in its stall with its chest just behind the door so its head comes over it. Lantern light on them is worked out in their shader (they move), from the same lantern list.</p>
    <p><b>Props</b> (barrels, the trough, crates, bales, buckets, the wagon) are separate pieces the building lists with their places, for the Town Lab to move.</p>
  </div></div></details>`;
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('[data-time]'); if (t) { state.time = t.dataset.time; applyLight(); syncPanel(); }
    const v = e.target.closest('[data-view]'); if (v) view(v.dataset.view);
  });
  $('#s-paint').addEventListener('change', (e) => { state.paint = e.target.value; rebuild(); });
  $('#r-wear').addEventListener('input', (e) => { state.wear = +e.target.value; LU.uPaintWear.value = state.wear; e.target.nextElementSibling.textContent = state.wear.toFixed(2); const rb = $('#recipe'); if (rb) rb.textContent = JSON.stringify(stableRecipe(state)); });
  $('#s-wood').addEventListener('change', (e) => { state.wood = e.target.value; setWood(T, state.wood); const rb = $('#recipe'); if (rb) rb.textContent = JSON.stringify(stableRecipe(state)); });
  $('#s-stone').addEventListener('change', (e) => { state.stone = e.target.value; rebuild(); });
  $('#seed').addEventListener('change', (e) => { state.seed = Math.max(1, Math.round(+e.target.value) || 1); rebuild(); });
  $('#newSeed').addEventListener('click', () => { state.seed = 1 + Math.floor(Math.random() * 9999); $('#seed').value = state.seed; rebuild(); });
  $('#doors').addEventListener('change', (e) => setDoors(e.target.checked));
  $('#lamps').addEventListener('change', (e) => { state.lamps = e.target.checked; applyLight(); });
  $('#props').addEventListener('change', (e) => { state.props = e.target.checked; propGroup.visible = state.props; });
  $('#showHorses').addEventListener('change', (e) => { state.showHorses = e.target.checked; horseGroup.visible = state.showHorses; });
  panel.querySelectorAll('[data-owned]').forEach((c) => c.addEventListener('change', () => { state.owned[c.dataset.owned] = c.checked; drawBoards(); }));
  $('#s-q').addEventListener('change', (e) => { state.quality = e.target.value; applyQuality(); });
  $('#panelToggle').addEventListener('click', () => { const c = panel.classList.toggle('closed'); $('#panelToggle').setAttribute('aria-expanded', String(!c)); });
}
function syncPanel() {
  panel.querySelectorAll('[data-time]').forEach((b) => b.classList.toggle('on', b.dataset.time === state.time));
  for (const k of ['doors', 'lamps', 'props', 'showHorses']) $('#' + k).checked = !!state[k];
  panel.querySelectorAll('[data-owned]').forEach((c) => { c.checked = !!state.owned[c.dataset.owned]; });
  $('#s-paint').value = state.paint; $('#s-wood').value = state.wood; $('#s-stone').value = state.stone; $('#seed').value = state.seed; $('#s-q').value = state.quality;
  $('#r-wear').value = state.wear; $('#r-wear').nextElementSibling.textContent = state.wear.toFixed(2);
}
function view(name) {
  const V = VIEWS[name]; if (!V) return;
  // (a tall, narrow screen, a phone held upright, sees less across: stand further back)
  const back = ['aisle', 'stall'].includes(name) ? 1 : Math.min(2.4, Math.max(1, 1.2 / camera.aspect)), t = new THREE.Vector3(...V[1]);
  camera.position.copy(t).add(new THREE.Vector3(...V[0]).sub(t).multiplyScalar(back)); controls.target.copy(t); controls.update();
}

// ── the stats box ────────────────────────────────────────────────────────────────────────────────────────────────────
const texBytes = () => [T.wood, T.woodN, RT.map, RT.normalMap, T.noise, T.ground].reduce((s, t) => s + gpuBytes(t.image.width, t.image.height), 0) + ART.bytes;
const trisOf = (g) => (g ? g.index.count / 3 : 0);
function info() {
  if (!B) return null;
  const bt = Object.values(B.geos).reduce((s, g) => s + trisOf(g), 0) + B.doors.reduce((s, L) => s + trisOf(L.geo), 0);
  const ht = horses.reduce((s, h) => s + trisOf(h.a.mesh.geometry), 0);
  const per = {}; for (const g in B.geos) per[g] = trisOf(B.geos[g]); per.doors = B.doors.reduce((s, L) => s + trisOf(L.geo), 0);
  return { recipe: stableRecipe(state), tris: { building: bt, props: P.tris, horses: ht, per }, meshes: { building: group.children.length, props: propGroup.children.length, horses: horses.length },
    parts: B.parts, counts: B.counts, ms: { build: B.msBuild, bake: B.msBake, props: P.ms, total: stats.totalMs, textures: stats.texMs }, texMB: texBytes() / 1048576,
    calls: renderer.info.render.calls, frameTris: renderer.info.render.triangles, footprint: B.anchors.footprint, offset: B.offset, fps };
}
let frames = 0, fpsT = performance.now(), fps = 0;
function updateStats() {
  const I = info(); if (!I) return;
  $('#stats').innerHTML = `<div class="t">Stable</div>
    triangles <b>${num(I.tris.building)}</b> building · <b>${num(I.tris.props)}</b> props · ${num(I.tris.horses)} horses<br>
    meshes <b>${I.meshes.building}</b> building + <b>${I.meshes.props}</b> props · draw calls <b>${I.calls}</b> in the frame<br>
    built in <b>${Math.round(I.ms.build)}</b> ms, light baked in <b>${Math.round(I.ms.bake)}</b> ms, props ${Math.round(I.ms.props)} ms<br>
    textures <b>${MB(texBytes())}</b> on the card · <b>0</b> downloaded · fps <b>${fps}</b>`;
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
function resize(force) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (force || canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; }
  const sheet = window.innerWidth <= 760 && !panel.classList.contains('closed');
  if (sheet) camera.setViewOffset(w, h, 0, h * 0.22, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
let last = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const t = performance.now(), dt = Math.min(0.1, (t - last) / 1000); last = t;
  resize(); controls.update(); tickHorses(dt);
  renderer.render(scene, camera);
  frames++;
  if (t - fpsT > 500) { fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; updateStats(); }
}

(async () => {
  try {
    buildPanel();
    const t0 = performance.now();
    T = await makeTextures({ wood: state.wood }); RT = makeRubbleTexture(); ART = await makeArt();
    stats.texMs = performance.now() - t0;
    U.uNoise.value = T.noise; LU.uPaintWear.value = state.wear;
    makeMaterials(); makeGround();
    applyQuality(); applyLight();
    rebuild(); syncPanel(); view('front');
    renderer.compile(scene, camera);
    $('#loading').classList.add('gone');
    loop();
    // the horses come in when they've loaded (the barn is there without them)
    lib = await loadAnimals(GAME, { kinds: ['horse', 'horseWhite', 'donkey', 'farmHorse'] });
    placeHorses();
    setTimeout(() => { BL.ready = true; }, 400);
  } catch (e) { console.error(e); if (window.oops) window.oops(e); }
})();

// for the test rigs (and the curious): drive the lab from the console
const BL = window.BL = {
  ready: false, state, U, LU,
  get info() { return info(); },
  get stable() { return B; }, get horses() { return horses.map((h) => ({ id: h.id, stall: h.stall, at: h.a.root.position.toArray().map((x) => +x.toFixed(2)), shape: h.shape })); },
  cam(pos, tgt) { camera.position.set(...pos); controls.target.set(...tgt); controls.update(); },
  view, time(t) { state.time = t; applyLight(); syncPanel(); }, doors(o) { setDoors(o); syncPanel(); }, lamps(o) { state.lamps = o; applyLight(); syncPanel(); },
  owned(id, v) { state.owned[id] = v; drawBoards(); syncPanel(); },
  recipe(o) { Object.assign(state, o); if (o.wood) setWood(T, state.wood); if (o.wear !== undefined) LU.uPaintWear.value = state.wear; rebuild(); syncPanel(); return info(); },
  quality(q) { state.quality = q; applyQuality(); syncPanel(); },
  show(o) { for (const k in o) state[k] = o[k]; propGroup.visible = state.props; horseGroup.visible = state.showHorses; syncPanel(); },
  render() { renderer.render(scene, camera); },
  get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; },
};
