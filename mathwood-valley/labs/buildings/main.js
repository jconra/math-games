// THE BUILDING LAB: the town's buildings built from parts in code, one module each (the stable: stable.js; the sheriff's
// office and jail: sheriff.js), with their props (props.js) and, for the stable, the game's own horses standing in its
// stalls. The wood is the Material Lab's trim sheet and weathering, the stone the Stone Lab's wall maker; this lab adds
// the light baked through the doors and windows and from the lanterns (parts.js), and its own pictures (art.js: the
// signs, the stall boards, straw, the wanted posters). This file: the scene, the light and the time of day, the horses,
// the panel (one panel for every building: a picker at its top), the stats, and the rigs' handle (window.BL).
// ?b=stable or ?b=sheriff picks the building it opens on.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeTextures, setWood, WOOD_LOOKS, gpuBytes } from '../materials/textures.js';
import { makeRubbleTexture } from '../stone/stonetex.js';
import { U, weather } from '../materials/weather.js';
import { stoneEdges, PALETTES } from '../stone/stonewall.js';
import { loadAnimals, makeAnimal } from '../../src/actors/animals.js';
import { PRICES, HORSES } from '../../src/catalog.js';
import { buildStable, stableRecipe, PAINTS, RECIPE_DEFAULTS, STABLE } from './stable.js';
import { buildSheriff, sheriffRecipe, PAINTS as SHERIFF_PAINTS, RECIPE_DEFAULTS as SHERIFF_DEFAULTS } from './sheriff.js';
import { MORTARS } from '../stone/stonewall.js';
import { buildProps } from './props.js';
import { makeArt, makeSheriffArt } from './art.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LU, lit, boardWear, glowMaterial, animalLamps, setLamps, lanternGlow, ropeTexture } from './parts.js';

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

// (the stable's recipe sits on the state itself, as it always has; the sheriff's office keeps its own in state.sh)
const state = {
  ...RECIPE_DEFAULTS, horses: [...RECIPE_DEFAULTS.horses],
  doors: true, lamps: true, time: 'day', props: true, showHorses: true, quality: 'gaming', az: 200,
  owned: { bay: true, donkey: false, chestnut: false, palomino: false, white: false, midnight: false },
  building: new URLSearchParams(location.search).get('b') === 'stable' ? 'stable' : 'sheriff',
  sh: { ...SHERIFF_DEFAULTS }, jailDoor: false,
};
// THE BUILDINGS: what the panel and the rebuild need of each
const BUILDINGS = {
  stable: { label: 'Stable', paints: PAINTS, recipe: () => stableRecipe(state), r: () => state, loading: 'Raising the barn…' },
  // (the sheriff's office: the sun a little lower by day, so it reaches in under the porch roof as in its concept
  // picture; its paint sheltered there)
  sheriff: { label: "Sheriff's office", paints: SHERIFF_PAINTS, recipe: () => sheriffRecipe(state.sh), r: () => state.sh, loading: 'Building the jail…', sun: { day: 30 }, shelter: 0.45 },
};
const BLD = () => BUILDINGS[state.building];
const cur = () => BLD().r();

// ── the time of day ──────────────────────────────────────────────────────────────────────────────────────────────────
// day: the afternoon sun from the front left (as in the concept picture); dusk: low and orange, the sky going; night: a
// little blue moonlight, the lanterns doing the rest
const TIMES = {
  day: { el: 38, sun: 0xfff3e2, sunI: 3.3, sky: 0x9cbbe0, hemiI: 1.85, ground: 0x6a563c, exp: 1.0, night: 0, lampGain: 1.6, glow: 0.5 },
  dusk: { el: 7, sun: 0xffa060, sunI: 1.4, sky: 0xc98a6c, hemiI: 0.75, ground: 0x3c3024, exp: 1.05, night: 0.55, lampGain: 1.6, glow: 0.8 },
  night: { el: 40, sun: 0x9bb2e6, sunI: 0.75, sky: 0x2c3e66, hemiI: 1.0, ground: 0x18140f, exp: 1.2, night: 1, lampGain: 1.7, bg: 0x0d1526, glow: 1 },
};
const viewCentre = new THREE.Vector3(0, 2.5, 0);
function applyLight() {
  const L = TIMES[state.time], az = (state.time === 'night' ? 140 : state.az) * Math.PI / 180, el = ((BLD().sun || {})[state.time] ?? L.el) * Math.PI / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  sun.color.set(L.sun); sun.intensity = L.sunI;
  hemi.color.set(L.sky).lerp(new THREE.Color(1, 1, 1), state.time === 'night' ? 0.1 : 0.25); hemi.groundColor.set(L.ground); hemi.intensity = L.hemiI;
  const sky = new THREE.Color(L.bg ?? L.sky);
  scene.background = sky; scene.fog = new THREE.Fog(sky, 50, 150);
  sun.position.copy(viewCentre).addScaledVector(dir, 40); sun.target.position.copy(viewCentre); sun.target.updateMatrixWorld();
  renderer.toneMappingExposure = L.exp;
  LU.uNight.value = L.night; LU.uLamp.value = state.lamps ? 1 : 0; LU.uLampGain.value = L.lampGain;
  if (B && B.glow) { B.glow.visible = state.lamps; B.glow.material.opacity = L.glow; }
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
let T, RT, ART, SART;
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
  mats.wood = boardWear(lit(weather(new THREE.MeshStandardMaterial({ map: T.wood, normalMap: T.woodN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.94 }), { box: true, ao: true, bevel: true })));
  mats.iron = lit(weather(new THREE.MeshStandardMaterial({ color: 0x3a332e, roughness: 0.55, metalness: 0.65 }), { box: true, ao: true }));
  mats.stone = lit(stoneEdges(weather(new THREE.MeshStandardMaterial({ map: RT.map, normalMap: RT.normalMap, roughness: 0.93 }), { tint: true, ao: true })));
  mats.stone.shadowSide = THREE.FrontSide;
  mats.hay = lit(new THREE.MeshStandardMaterial({ map: ART.hay, roughness: 1 }), { ao: true, tint: true });
  mats.floor = lit(new THREE.MeshStandardMaterial({ map: ART.floor, roughness: 0.97 }), { ao: true });
  mats.spill = lit(new THREE.MeshStandardMaterial({ map: ART.spill, roughness: 1, alphaTest: 0.5 }), { ao: true });
  mats.boards = lit(new THREE.MeshStandardMaterial({ map: ART.boards, roughness: 0.82 }), { ao: true });
  // (the sheriff's office: everything painted, pasted or pinned on it, laid a few mm over its boards, see-through round
  // its edges; drawn after the boards and pulled toward the camera a hair so it never fights them)
  mats.decal = lit(new THREE.MeshStandardMaterial({ map: SART.sheriff, roughness: 0.9, transparent: true, depthWrite: false, alphaTest: 0.01, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), { ao: true });
  mats.glow = glowMaterial(); mats.glass = glowMaterial({ panes: true });
  mats.rope = lit(new THREE.MeshStandardMaterial({ map: ropeTexture(), roughness: 0.92 }), { ao: true, tint: true });
  T.ground.repeat.set(15, 15);
  mats.ground = lit(weather(new THREE.MeshStandardMaterial({ map: T.ground, roughness: 0.97 }), { ground: true, tint: true, ao: true }));
}

// THE TRIM SHEET'S NAILS PAINTED OUT: the Material Lab's board strips carry a nail (and its rust run) a third of the way
// across each strip, once every 1.2 m along it: on upright boards side by side they came out as rows of big dark ovals
// right across a wall. A band of each strip either side of them is copied over from just beside it (colour and bumps
// both), in the lab's copy of the pictures; the stable's nails are drawn by its shader instead (parts.js boardWear)
function eraseNails(T) {
  for (const tex of [T.wood, T.woodN]) {
    const g = tex.image.getContext('2d'), band = g.getImageData(212, 0, 26, 768);
    g.putImageData(band, 243, 0);
    tex.needsUpdate = true;
  }
}

// ── the building, its props, its horses ──────────────────────────────────────────────────────────────────────────────
let B = null, P = null, ground = null, groundGeo = null, lib = null;
const group = new THREE.Group(), propGroup = new THREE.Group(), horseGroup = new THREE.Group();
scene.add(group, propGroup, horseGroup);
const horses = [];
const stats = { buildMs: 0, bakeMs: 0, propMs: 0, texMs: 0 };
function rebuild() {
  for (const m of [...group.children]) { group.remove(m); m.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); if (m.isPoints) m.material.dispose(); }
  for (const m of [...propGroup.children]) { propGroup.remove(m); m.geometry.dispose(); }
  const t0 = performance.now(), sheriff = state.building === 'sheriff';
  B = sheriff ? buildSheriff(sheriffRecipe(state.sh), { texMean: RT.mean }) : buildStable(stableRecipe(state), { texMean: RT.mean });
  LU.uPaintWear.value = cur().wear; LU.uPaintShelter.value = BLD().shelter || 0; applyLight();
  for (const g of ['wood', 'iron', 'stone', 'hay', 'floor', 'spill', 'boards', 'decal', 'glow', 'glass', 'rope']) {
    const geo = B.geos[g]; if (!geo) continue;
    const m = new THREE.Mesh(geo, mats[g]); m.name = g; m.castShadow = !['glow', 'glass', 'spill', 'floor', 'boards', 'decal'].includes(g); m.receiveShadow = g !== 'glow' && g !== 'glass';
    if (g === 'glass') m.renderOrder = 1;
    if (g === 'decal') m.renderOrder = 0.5;
    group.add(m);
  }
  // the front doors: each its own mesh, turned on its hinge (a door with a window carries its glass with it)
  B.doorMeshes = B.doors.map((L, i) => {
    const m = new THREE.Mesh(L.geo, mats.wood); m.name = 'door ' + (L.group || (i ? 'right' : 'left')); m.castShadow = m.receiveShadow = true;
    m.position.set(...L.hinge); group.add(m);
    if (L.glass) { const gm = new THREE.Mesh(L.glass, mats.glass); gm.renderOrder = 1; gm.name = 'door glass'; m.add(gm); }
    // (its harness collar: a leather tube, swinging with the door; lit evenly)
    if (L.rope) { const n = L.rope.attributes.position.count; L.rope.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(0.8), 1)); L.rope.setAttribute('aLamp', new THREE.BufferAttribute(Float32Array.from({ length: n * 2 }, (_, i) => (i % 2 ? 0 : 0.6)), 2)); const c = new THREE.Mesh(L.rope, mats.rope); c.castShadow = true; c.name = 'collar'; m.add(c); }
    return m;
  });
  // the props, baked in the building's light
  const off = B.offset, offZ = B.offsetZ || 0;
  P = buildProps(B.props, { seed: cur().seed * 7 + 1, bake: (geo) => { geo.translate(-off, 0, -offZ); B.light.bake(geo); B.light.apply(geo, state.doors, 'main', state.jailDoor); geo.translate(off, 0, offZ); } });
  for (const g of ['wood', 'iron', 'hay']) { const m = new THREE.Mesh(P.geos[g], mats[g]); m.castShadow = m.receiveShadow = true; propGroup.add(m); }
  // the lanterns: where they are, for the shaders' light, and a soft glow round each (one draw for all of them)
  setLamps(B.lamps);
  B.glow = lanternGlow(B.lamps); group.add(B.glow); applyLight();
  stats.buildMs = B.msBuild; stats.bakeMs = B.msBake; stats.propMs = P.ms; stats.totalMs = performance.now() - t0;
  setDoors(state.doors);
  bakeGround();
  if (!sheriff) drawBoards();
  placeHorses();
  propGroup.visible = state.props;
  const rb = $('#recipe'); if (rb) rb.textContent = JSON.stringify(BLD().recipe());
  updateStats();
}
// the doors: the stable's front pair; the sheriff's office door (open) and the jail's (open2)
function setDoors(open, open2 = state.jailDoor) {
  state.doors = open; state.jailDoor = open2;
  if (!B) return;
  B.light.setDoors(open, open2);
  B.doorMeshes.forEach((m, i) => { const L = B.doors[i], o = L.group === 'jail' ? open2 : open; m.rotation.y = o ? L.open : 0; });
  const oz = B.offsetZ || 0;
  for (const g of Object.values(P.geos)) { g.translate(-B.offset, 0, -oz); B.light.apply(g, open, 'main', open2); g.translate(B.offset, 0, oz); }
}
// the ground: grass worn to dirt round the building and in the yard before the doors, shaded where it meets the walls
function makeGround() {
  const G = groundGeo = new THREE.PlaneGeometry(70, 70, 140, 140); G.rotateX(-Math.PI / 2);
  G.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(G.attributes.position.count).fill(1), 1));
  G.setAttribute('aTintPaint', new THREE.BufferAttribute(new Float32Array(G.attributes.position.count * 4), 4));
  G.setAttribute('aLamp', new THREE.BufferAttribute(new Float32Array(G.attributes.position.count * 2), 2));
  ground = new THREE.Mesh(G, mats.ground); ground.receiveShadow = true; ground.name = 'ground'; scene.add(ground);
  // (and plain grass out to the horizon, a hair under it)
  const O = new THREE.PlaneGeometry(400, 400, 4, 4); O.rotateX(-Math.PI / 2); O.translate(0, -0.03, 0);
  const n = O.attributes.position.count;
  O.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1)); O.setAttribute('aTintPaint', new THREE.BufferAttribute(new Float32Array(n * 4), 4)); O.setAttribute('aLamp', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const far = new THREE.Mesh(O, mats.ground); far.receiveShadow = true; far.name = 'far ground'; scene.add(far);
}
function bakeGround() {
  const P0 = groundGeo.attributes.position, A = groundGeo.attributes.aTintPaint, O = groundGeo.attributes.aAO, Lm = groundGeo.attributes.aLamp, F = B.anchors.footprint;
  const rect = (x, z, x0, x1, z0, z1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  // (the yard worn to dirt: before the stable's doors; the street in front of the sheriff's boardwalk)
  const Y = B.anchors.street || [B.offset - 3.2, B.offset + 3.2, F.d / 2, F.d / 2 + 6.5], oz = B.offsetZ || 0;
  for (let i = 0; i < P0.count; i++) {
    const x = P0.getX(i), z = P0.getZ(i);
    const dB = rect(x, z, -F.w / 2 - 0.4, F.w / 2 + 0.3, -F.d / 2 - 0.5, F.d / 2 + 0.6);
    const dYard = rect(x, z, Y[0], Y[1], Y[2], Y[3]) + Math.sin(x * 0.7 + z * 0.3) * 0.4;
    A.array[i * 4] = Math.max(1 - THREE.MathUtils.smoothstep(dB, 0, 1.6), 0.9 * (1 - THREE.MathUtils.smoothstep(dYard, 0, 1.8)) * (1 - THREE.MathUtils.smoothstep(z, F.d / 2 + 6, F.d / 2 + 11)));
    // (the ground's shade where it meets the walls, and the lanterns' light on it: the building's bake, at the ground)
    const near = Math.abs(x) < 12 && Math.abs(z) < 11, b = near ? B.light.at(x - B.offset, 0.01, z - oz, 0, 1, 0) : null;
    O.array[i] = b ? 0.45 + 0.55 * b[0] : 1; Lm.array[i * 2] = b ? b[6] : 1; Lm.array[i * 2 + 1] = 0;
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
// just behind the stall's gate so its head comes out over it into the aisle, idling (head and tail moving). The models
// are left as they are (the same horses as everywhere else in the game); what's added here: each its own pose (its head
// turned a little one way or the other, one with its head down at the hay inside its gate), its own clip speed and
// place in the clip, a halter (a few straps hung on its head bone), and the lanterns' light (parts.js animalLamps)
const SHAPE = {};   // per kind: how far its chest and nose reach forward of its middle, and its halter (measured once)
const HALTER = animalLamps(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 }), 0.45);
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
  return (SHAPE[a.kind] = { chest, nose, top, halter: halterFor(a) });
}
// A HALTER fitted to a kind's head, in the head bone's own frame (so it rides the head through every clip): the head's
// corners (the ones mostly bound to its head bone) as it stands, its long axis from the bone to the nose; across that
// axis near the muzzle a noseband, behind the ears a crown strap (each a ring of short straps a centimetre off the head,
// the size of the head there), a cheek strap down each side between them, and a brass ring under the jaw
function halterFor(a) {
  const m = a.mesh, head = a.bones.Head || a.bones[a.info.head]; if (!head) return null;
  const bi = m.skeleton.bones.indexOf(head), SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight;
  const P0 = head.getWorldPosition(new THREE.Vector3()), pts = [], v = new THREE.Vector3();
  for (let i = 0; i < SI.count; i++) {
    let w = 0; for (let c = 0; c < 4; c++) if (SI.getComponent(i, c) === bi) w += SW.getComponent(i, c);
    if (w < 0.5) continue;
    m.getVertexPosition(i, v); pts.push(v.clone().applyMatrix4(m.matrixWorld));
  }
  if (pts.length < 20) return null;
  const N = pts.reduce((b, p) => (p.z > b.z ? p : b), pts[0]), axis = N.clone().sub(P0), len = axis.length(); axis.normalize();
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize(), side = new THREE.Vector3().crossVectors(axis, up);
  // the head's cross-section at a share t of the way to the nose: middle and half-sizes (across, up)
  // (a low-poly head may have few corners in a thin slice: the slice widens until it has enough)
  const section = (t, band, topQ = 1) => {
    let S = [], Uu = [];
    for (; band < 0.3; band *= 1.4) {
      S = []; Uu = [];
      for (const p of pts) { const d = p.clone().sub(P0), tt = d.dot(axis) / len; if (Math.abs(tt - t) < band) { S.push(d.dot(side)); Uu.push(d.dot(up)); } }
      if (S.length >= 8) break;
    }
    if (S.length < 4) return null;
    S.sort((x, y) => x - y); Uu.sort((x, y) => x - y);
    const q = (A, f) => A[Math.min(A.length - 1, Math.floor(f * (A.length - 1)))];
    const s0 = q(S, 0.02), s1 = q(S, 0.98), u0 = q(Uu, 0.02), u1 = q(Uu, topQ);
    return { c: P0.clone().addScaledVector(axis, t * len).addScaledVector(side, (s0 + s1) / 2).addScaledVector(up, (u0 + u1) / 2), a: (s1 - s0) / 2 + 0.012, b: (u1 - u0) / 2 + 0.012 };
  };
  // (the crown strap goes round just behind the ears: low on the head's own corners there, the ears left out)
  const nose = section(0.7, 0.06), crown = section(0.04, 0.06, 0.45); if (!nose || !crown) return null;
  const parts = [], LEATHER = [0.075, 0.032, 0.016], BRASS = [0.55, 0.33, 0.08];   // (linear colours: dark oiled leather, brass)
  const strap = (A, B, w, t, col, normal) => {   // a strap from A to B, w wide, t thick, lying flat on `normal`
    const X = B.clone().sub(A), L = X.length(); X.normalize();
    const Z = normal.clone().addScaledVector(X, -normal.dot(X)).normalize(), Y = new THREE.Vector3().crossVectors(Z, X);
    const g = new THREE.BoxGeometry(L + 0.01, w, t); g.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(A.clone().add(B).multiplyScalar(0.5)));
    const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) c.set(col, i); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.deleteAttribute('uv'); parts.push(g);
  };
  const ring = (R, n = 10) => {
    const at = (k) => R.c.clone().addScaledVector(side, R.a * Math.cos(k / n * Math.PI * 2)).addScaledVector(up, R.b * Math.sin(k / n * Math.PI * 2));
    for (let k = 0; k < n; k++) { const A = at(k), B = at(k + 1), out = A.clone().add(B).multiplyScalar(0.5).sub(R.c); strap(A, B, 0.03, 0.01, LEATHER, out); }
    return at;
  };
  const nAt = ring(nose), cAt = ring(crown);
  for (const k of [0, 5]) strap(nAt(k), cAt(k), 0.028, 0.01, LEATHER, k ? side.clone().negate() : side);
  const jaw = nAt(7.5); strap(jaw.clone().addScaledVector(axis, -0.03), jaw.clone().addScaledVector(axis, 0.03), 0.05, 0.016, BRASS, up.clone().negate());
  const geo = mergeGeometries(parts); for (const g of parts) g.dispose();
  head.updateMatrixWorld(true); geo.applyMatrix4(head.matrixWorld.clone().invert());
  return { geo, bone: head.name };
}
// EACH STALL'S POSE (stable.js POSES, from the recipe): look (out over the gate, its head a little to one side), door (the
// same, turned toward the doorway), rack (standing back, its head down in the hay rack inside the gate), side (standing
// back in its stall at an angle, its side to the aisle), eat (its head down at the hay on the floor). A pose whose clip a
// kind hasn't got (the farm horse has only Idle) falls back to look.
// each stall's head: turned (radians about the upright; on the right, more is toward the doorway, on the left less is)
// and nodded (about the horse's own across, + down)
const TURN = { R1: 0.5, R2: 0.3, R3: -0.6, L1: -0.48, L2: 0.4, L3: 0 }, NOD = { R1: -0.04, R2: -0.14, R3: 0.28, L1: 0.05, L2: -0.06, L3: 0 };
// a black coat needs a halter that shows against it: a light tan-red one
const HALTER_RED = animalLamps(new THREE.MeshStandardMaterial({ color: 0xb4532e, roughness: 0.7 }), 0.6);
function placeHorses() {
  for (const h of horses) { if (h.halter) h.halter.removeFromParent(); h.a.dispose(); }
  horses.length = 0;
  if (!lib || !B || !B.stalls) return;
  for (const S of B.stalls) {
    const id = S.horse, look = LOOKS[id] || LOOKS.bay;
    const a = makeAnimal(lib, look.kind, { tint: look.tint || '#ffffff' });
    const sh = measure(a);
    let pose = S.pose;
    if ((pose === 'eat' && !a.clips.includes('Eating')) || (pose === 'rack' && !a.clips.includes('Idle_Headlow'))) pose = 'look';
    // (a donkey reaches out a little less: its nose about 30 cm past its gate, the horses' about 45)
    let x = S.frontX + S.side * ({ look: 0.14, door: 0.14, rack: 1.0, eat: 0.9 }[pose] + (look.kind === 'donkey' ? 0.12 : 0) + sh.chest), z = S.z, face = S.face;
    if (pose === 'side') {
      // (turned 60 degrees toward the barn's front; its middle in the middle of the stall)
      face = S.face + S.side * 1.05; const dx = Math.sin(face), dz = Math.cos(face);
      x = S.frontX + S.side * 1.55 - dx * 0.3; z = S.z - dz * 0.3;
    }
    a.root.position.set(x, 0.015, z); a.root.rotation.y = face;
    animalLamps(a.mesh.material, B.light.skyAt(x, 1.5, z) * 1.15, B.light.fillAt(x, 1.3, z) * 1.3);
    a.mesh.material.needsUpdate = true;
    const speed = 0.82 + 0.36 * ((S.z * 7.3 + S.side * 3.1) % 1 + 1) % 1;
    a.play({ eat: 'Eating', rack: 'Idle_Headlow' }[pose] || 'Idle', { fade: 0, speed }); a.update(Math.abs(S.z * 1.7 + S.side) % 3);
    let halter = null;
    if (sh.halter) { halter = new THREE.Mesh(sh.halter.geo, id === 'midnight' ? HALTER_RED : HALTER); halter.castShadow = true; a.bones[sh.halter.bone].add(halter); }
    horseGroup.add(a.root);
    const turn = pose === 'door' || pose === 'look' ? TURN[S.id] || 0 : pose === 'side' ? -S.side * 0.25 : 0, nod = pose === 'door' || pose === 'look' ? NOD[S.id] || 0 : 0;
    horses.push({ a, id, stall: S.id, next: 4 + Math.random() * 8, shape: sh, pose, still: pose !== 'look' && pose !== 'door', speed, halter, turn, nod, across: new THREE.Vector3(Math.cos(face), 0, -Math.sin(face)), head: a.bones.Head || a.bones[a.info.head] });
  }
  horseGroup.visible = state.showHorses;
}
// now and then a horse shifts to its other idle (a toss of the head) and back; each frame its head is turned its own way
// (about the upright, at the head's own joint, on top of the clip)
const _pq = new THREE.Quaternion(), _yq = new THREE.Quaternion(), _nq = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function tickHorses(dt) {
  for (const h of horses) {
    h.a.update(dt);
    h.next -= dt;
    if (h.next < 0 && !h.still) {
      const pick = h.a.clip === 'Idle' && h.a.clips.includes('Idle_2') ? 'Idle_2' : 'Idle';
      h.a.play(pick, { fade: 0.6, speed: h.speed }); h.next = pick === 'Idle' ? 6 + Math.random() * 10 : 3.3;
    }
    if ((h.turn || h.nod) && h.head && h.head.parent) {
      h.head.parent.updateWorldMatrix(true, false); h.head.parent.getWorldQuaternion(_pq);
      _yq.setFromAxisAngle(_up, h.turn).multiply(_nq.setFromAxisAngle(h.across, h.nod)); h.head.quaternion.premultiply(_pq.clone().invert().multiply(_yq).multiply(_pq));
    }
  }
}

// ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────────
const panel = $('#panel');
// where to look from, per building: [camera, target]
const VIEWS = {
  stable: {
    front: [[-9.5, 4.2, 17.5], [0.3, 3.2, 0]],
    doors: [[0.9, 2.6, 10.6], [1.2, 2.9, 3]],
    aisle: [[1.65, 1.62, 5.6], [1.65, 1.55, -3]],
    stall: [[0.5, 1.9, 3.3], [3.6, 1.7, 1.25]],
    leanto: [[-12.5, 2.6, 6.5], [-4.6, 1.6, 0]],
    back: [[9.5, 4.0, -13.5], [0.5, 3.0, 0]],
    roof: [[-6.5, 13, 9], [1.2, 7.4, -0.6]],
  },
  sheriff: {
    front: [[-2.2, 4.4, 17.0], [0.6, 2.6, 0.8]],
    door: [[-0.3, 2.3, 9.5], [-0.8, 2.4, 2.6]],
    jail: [[9.5, 2.6, 9.0], [3.0, 1.9, 1.5]],
    porch: [[-4.6, 1.9, 4.6], [1.0, 1.6, 3.6]],
    office: [[0.2, 1.75, 1.9], [-3.2, 1.2, -1.2]],
    cells: [[1.6, 1.75, 1.45], [3.6, 1.1, -1.4]],
    back: [[10.5, 4.6, -12.5], [0.0, 2.6, -1.0]],
    roof: [[-3.0, 11.5, -12.0], [-1.6, 4.6, 1.0]],
  },
};
const SHOW = {
  stable: `<div class="row check"><label><input type="checkbox" id="doors"> Front doors open</label></div>
    <div class="row check"><label><input type="checkbox" id="lamps"> Lanterns lit</label></div>
    <div class="row check"><label><input type="checkbox" id="props"> Props (barrels, trough, crates, bales, wagon)</label></div>
    <div class="row check"><label><input type="checkbox" id="showHorses"> Horses</label></div>`,
  sheriff: `<div class="row check"><label><input type="checkbox" id="doors"> Office door open</label></div>
    <div class="row check"><label><input type="checkbox" id="jailDoor"> Jail door open</label></div>
    <div class="row check"><label><input type="checkbox" id="lamps"> Lanterns lit</label></div>
    <div class="row check"><label><input type="checkbox" id="props"> Props (bench, barrels, crates, trough, hitching rail, woodpile)</label></div>`,
};
const HOW = {
  stable: `<p><b>Parts</b>: every board, batten, post, rafter and shake is a box from the Material Lab's parts kit, merged into one mesh per material (wood, iron), so the whole barn is a handful of draw calls. The walls are <b>board and batten</b>: upright boards 22 to 32 cm wide with a narrow batten over each joint, cut round the doors and windows. Each board is two skins: the outside one painted, the inside one bare (barns are painted outside only).</p>
    <p><b>Paint</b> is a colour in the recipe. The weathering shader chips it at the edges, and this lab wears it away in streaks down the boards and big soft patches, more of it low down, on the sunny side, by the corners and the doorways, less under the eaves, and board by board; the slider says how much has gone. Small nail heads sit where each board crosses a girt inside.</p>
    <p><b>Inside light</b> is baked once: for every corner indoors, how much of the outdoors it sees through the doorways and windows (each opening's share of its view, with a few rays through a grid of the solid parts so a partition shades the stall behind it), kept in two parts so shutting the front doors darkens it. The lanterns' warm light is worked out per pixel (round pools on the floor and the gates, falling off with the distance squared), times the bake's share of it that gets past the walls. A soft glow sprite hangs round each lantern; two gooseneck lamps light the sign.</p>
    <p><b>Horses</b> are the game's own (src/actors/animals.js), each in its stall with its chest just behind the gate so its head comes over it (the donkey's gate is a plank lower). Each stall has its own pose (looking out, turned toward the doorway, head down at a hay rack, standing back side-on, eating from the floor), its own clip speed and place in the clip; each wears a halter fitted to its head and hung on its head bone. The lanterns light them the same way, per pixel, and each stall has a warm baked fill so it isn't a black box.</p>
    <p><b>Props</b> (barrels, the trough, crates, bales, buckets, the wagon) are separate pieces the building lists with their places, for the Town Lab to move.</p>`,
  sheriff: `<p><b>The office</b> is <b>lap siding</b>: horizontal boards, each lapped over the one below (tilted a board's thickness, so each throws a thin shadow line), in pieces 1.3 to 3.2 m long with the joints staggered, nailed where they cross the studs every 0.6 m. The <b>false front</b> steps up in three, each step capped, with a frieze and brackets; behind it, over the roof, its studs, plates and two braces show. Inside, the walls are lined with plain boards, a plank floor and ceiling.</p>
    <p><b>Paint</b> is a colour in the recipe, worn away in streaks and patches as on the stable, board by board, more by the corners, the door and low down; one board by the door is a newer patch, never painted. The sign is painted straight onto the boards (a picture laid a few millimetres over them), with the ghost of an older sign and the old cream coat where the ochre has peeled.</p>
    <p><b>The jail</b> is the Stone Lab's wall maker: a U of mortared fieldstone whose arms end against the office's wall, a slab roof, a door through its front on a stone step, a tiny barred window, slots high in the back; inside, the office's wall is lined with heavy planks bound in strap iron, and two cells sit behind woven strap-iron bars.</p>
    <p><b>Light</b> is baked as for the stable (the doorways and windows, the lanterns), with the office door and the jail door each kept apart so either can shut; the cells and the back room get a warm fill so they're dim rooms, not black boxes.</p>
    <p><b>Props</b> (the bench, barrels, crates, the trough, the hitching rail, the woodpile, a leaning plank, the cells' buckets) are separate pieces the building lists with their places, for the Town Lab to move.</p>`,
};
let panelWired = false;
function buildPanel() {
  const opt = (obj, cur) => Object.entries(obj).map(([k, L]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${L.label || L}</option>`).join('');
  const forSale = Object.keys(PRICES.horse), R = cur(), kind = state.building, sheriff = kind === 'sheriff';
  panel.innerHTML = `<h1>Building Lab</h1><p class="sub">The town's buildings built from parts in code: walls, roof, doors and all, ready to walk into. <a href="../">All labs</a></p>
  <details class="sec" open><summary>Building</summary><div class="body">
    <div class="picks"><button class="btn${kind === 'stable' ? ' on' : ''}" data-bld="stable">Stable</button><button class="btn${sheriff ? ' on' : ''}" data-bld="sheriff">Sheriff's office</button><button class="btn" disabled title="next">General store</button></div>
    <div class="row two"><label for="s-paint">Paint</label><select id="s-paint">${opt(BLD().paints, R.paint)}</select></div>
    <div class="row" data-key="wear"><label for="r-wear">Paint worn off</label><input type="range" id="r-wear" min="0" max="1" step="0.01" value="${R.wear}"><output>${R.wear.toFixed(2)}</output></div>
    <div class="row two"><label for="s-wood">Wood</label><select id="s-wood">${opt(WOOD_LOOKS, R.wood)}</select></div>
    <div class="row two"><label for="s-stone">Stone colours</label><select id="s-stone">${opt(PALETTES, R.stone)}</select></div>
    ${sheriff ? `<div class="row two"><label for="s-mortar">Mortar</label><select id="s-mortar">${opt(MORTARS, R.mortar)}</select></div>` : ''}
    <div class="seedrow"><label for="seed">Seed</label><input id="seed" type="number" min="1" step="1" value="${R.seed}"><button class="btn" id="newSeed">New seed</button></div>
    <div class="lbl">This building's recipe</div><pre class="recipe" id="recipe">${JSON.stringify(BLD().recipe())}</pre>
    <p class="note">Everything that makes this ${sheriff ? "sheriff's office" : 'stable'} its own, small enough for the town to keep one per building.</p>
  </div></details>
  <details class="sec" open><summary>Show</summary><div class="body">
    <div class="picks" id="times">${['day', 'dusk', 'night'].map((t) => `<button class="btn" data-time="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
    ${SHOW[kind]}
    ${sheriff ? '' : `<div class="lbl">Bought (its board turns into a name plate)</div>
    ${forSale.map((id) => `<div class="row check"><label><input type="checkbox" data-owned="${id}"> ${FULL[id] || id} (${PRICES.horse[id]} gold)</label></div>`).join('')}`}
    <div class="lbl">Look from</div>
    <div class="picks">${Object.keys(VIEWS[kind]).map((v) => `<button class="btn" data-view="${v}">${v}</button>`).join('')}</div>
    <div class="row two"><label for="s-q">Quality</label><select id="s-q">${opt({ potato: 'Potato', normal: 'Normal', gaming: 'Gaming' }, state.quality)}</select></div>
  </div></details>
  <details class="sec"><summary>How it's made</summary><div class="body"><div class="how" style="border:0;margin:0;padding:0">${HOW[kind]}</div></div></details>`;
  const recipeText = () => { const rb = $('#recipe'); if (rb) rb.textContent = JSON.stringify(BLD().recipe()); };
  $('#s-paint').addEventListener('change', (e) => { cur().paint = e.target.value; rebuild(); });
  $('#r-wear').addEventListener('input', (e) => { cur().wear = +e.target.value; LU.uPaintWear.value = cur().wear; e.target.nextElementSibling.textContent = cur().wear.toFixed(2); recipeText(); });
  $('#s-wood').addEventListener('change', (e) => { cur().wood = e.target.value; setWood(T, cur().wood); eraseNails(T); recipeText(); });
  $('#s-stone').addEventListener('change', (e) => { cur().stone = e.target.value; rebuild(); });
  if (sheriff) $('#s-mortar').addEventListener('change', (e) => { cur().mortar = e.target.value; rebuild(); });
  $('#seed').addEventListener('change', (e) => { cur().seed = Math.max(1, Math.round(+e.target.value) || 1); rebuild(); });
  $('#newSeed').addEventListener('click', () => { cur().seed = 1 + Math.floor(Math.random() * 9999); $('#seed').value = cur().seed; rebuild(); });
  $('#doors').addEventListener('change', (e) => setDoors(e.target.checked));
  if (sheriff) $('#jailDoor').addEventListener('change', (e) => setDoors(state.doors, e.target.checked));
  $('#lamps').addEventListener('change', (e) => { state.lamps = e.target.checked; applyLight(); });
  $('#props').addEventListener('change', (e) => { state.props = e.target.checked; propGroup.visible = state.props; });
  if (!sheriff) {
    $('#showHorses').addEventListener('change', (e) => { state.showHorses = e.target.checked; horseGroup.visible = state.showHorses; });
    panel.querySelectorAll('[data-owned]').forEach((c) => c.addEventListener('change', () => { state.owned[c.dataset.owned] = c.checked; drawBoards(); }));
  }
  $('#s-q').addEventListener('change', (e) => { state.quality = e.target.value; applyQuality(); });
  if (panelWired) return;
  // (once: the panel's clicks, and the phone's panel toggle)
  panelWired = true;
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('[data-time]'); if (t) { state.time = t.dataset.time; applyLight(); syncPanel(); }
    const v = e.target.closest('[data-view]'); if (v) view(v.dataset.view);
    const b = e.target.closest('[data-bld]'); if (b && !b.disabled && b.dataset.bld !== state.building) setBuilding(b.dataset.bld);
  });
  $('#panelToggle').addEventListener('click', () => { const c = panel.classList.toggle('closed'); $('#panelToggle').setAttribute('aria-expanded', String(!c)); });
}
function syncPanel() {
  const R = cur();
  panel.querySelectorAll('[data-time]').forEach((b) => b.classList.toggle('on', b.dataset.time === state.time));
  for (const k of ['doors', 'jailDoor', 'lamps', 'props', 'showHorses']) { const c = $('#' + k); if (c) c.checked = !!state[k]; }
  panel.querySelectorAll('[data-owned]').forEach((c) => { c.checked = !!state.owned[c.dataset.owned]; });
  $('#s-paint').value = R.paint; $('#s-wood').value = R.wood; $('#s-stone').value = R.stone; $('#seed').value = R.seed; $('#s-q').value = state.quality;
  if ($('#s-mortar')) $('#s-mortar').value = R.mortar;
  $('#r-wear').value = R.wear; $('#r-wear').nextElementSibling.textContent = R.wear.toFixed(2);
  const rb = $('#recipe'); if (rb) rb.textContent = JSON.stringify(BLD().recipe());
}
// switch the building: its own wood look, its own panel, built, looked at from the front
let horsesLoading = null;
function loadHorses() {
  if (!horsesLoading) horsesLoading = loadAnimals(GAME, { kinds: ['horse', 'horseWhite', 'donkey', 'farmHorse'] }).then((l) => { lib = l; placeHorses(); });
  return horsesLoading;
}
function setBuilding(kind) {
  if (!BUILDINGS[kind]) return;
  state.building = kind;
  setWood(T, cur().wood); eraseNails(T);
  horseGroup.visible = kind === 'stable' && state.showHorses;
  buildPanel(); rebuild(); syncPanel(); view('front');
  if (kind === 'stable') loadHorses();
  try { history.replaceState(null, '', '?b=' + kind); } catch (e) { /* (a file: page can't) */ }
}
function view(name) {
  const V = VIEWS[state.building][name]; if (!V) return;
  // (a tall, narrow screen, a phone held upright, sees less across: stand further back)
  const back = ['aisle', 'stall', 'office', 'cells', 'porch'].includes(name) ? 1 : Math.min(2.4, Math.max(1, 1.2 / camera.aspect)), t = new THREE.Vector3(...V[1]);
  camera.position.copy(t).add(new THREE.Vector3(...V[0]).sub(t).multiplyScalar(back)); controls.target.copy(t); controls.update();
}

// ── the stats box ────────────────────────────────────────────────────────────────────────────────────────────────────
const texBytes = () => [T.wood, T.woodN, RT.map, RT.normalMap, T.noise, T.ground].reduce((s, t) => s + gpuBytes(t.image.width, t.image.height), 0) + ART.bytes + (SART ? SART.bytes : 0);
const trisOf = (g) => (g ? g.index.count / 3 : 0);
function info() {
  if (!B) return null;
  const doorTris = B.doors.reduce((s, L) => s + trisOf(L.geo) + trisOf(L.glass), 0);
  const bt = Object.values(B.geos).reduce((s, g) => s + trisOf(g), 0) + doorTris;
  const ht = horses.reduce((s, h) => s + trisOf(h.a.mesh.geometry), 0);
  const per = {}; for (const g in B.geos) per[g] = trisOf(B.geos[g]); per.doors = doorTris;
  return { building: state.building, recipe: BLD().recipe(), tris: { building: bt, props: P.tris, horses: ht, per }, meshes: { building: group.children.length, props: propGroup.children.length, horses: horses.length },
    parts: B.parts, counts: B.counts, ms: { build: B.msBuild, bake: B.msBake, props: P.ms, total: stats.totalMs, textures: stats.texMs }, texMB: texBytes() / 1048576,
    calls: renderer.info.render.calls, frameTris: renderer.info.render.triangles, footprint: B.anchors.footprint, offset: B.offset, jail: B.jail, lamps: B.lamps.length, fps };
}
let frames = 0, fpsT = performance.now(), fps = 0;
function updateStats() {
  const I = info(); if (!I) return;
  $('#stats').innerHTML = `<div class="t">${BLD().label}</div>
    triangles <b>${num(I.tris.building)}</b> building · <b>${num(I.tris.props)}</b> props${state.building === 'stable' ? ` · ${num(I.tris.horses)} horses` : ''}<br>
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
    $('#loading').textContent = BLD().loading;
    T = await makeTextures({ wood: cur().wood }); eraseNails(T); RT = makeRubbleTexture(); ART = await makeArt(); SART = await makeSheriffArt();
    stats.texMs = performance.now() - t0;
    U.uNoise.value = T.noise; LU.uPaintWear.value = cur().wear;
    makeMaterials(); makeGround();
    applyQuality(); applyLight();
    rebuild(); syncPanel(); view('front');
    renderer.compile(scene, camera);
    $('#loading').classList.add('gone');
    loop();
    // the horses come in when they've loaded (the barn is there without them; loaded only when the stable is shown)
    if (state.building === 'stable') await loadHorses();
    setTimeout(() => { BL.ready = true; }, 400);
  } catch (e) { console.error(e); if (window.oops) window.oops(e); }
})();

// for the test rigs (and the curious): drive the lab from the console
const BL = window.BL = {
  ready: false, state, U, LU,
  get info() { return info(); },
  get stable() { return B; }, get building() { return B; }, get horses() { return horses.map((h) => ({ id: h.id, stall: h.stall, at: h.a.root.position.toArray().map((x) => +x.toFixed(2)), chest: +h.shape.chest.toFixed(2), halter: !!h.halter, clip: h.a.clip, pose: h.pose })); },
  // (a rig's camera may look up from below its target: under an eave, under the porch roof; the orbit's own limit, which
  // keeps a hand-held camera above the ground, would otherwise pull it up level with the target)
  cam(pos, tgt) { controls.maxPolarAngle = Math.PI; camera.position.set(...pos); controls.target.set(...tgt); controls.update(); },
  view, time(t) { state.time = t; applyLight(); syncPanel(); }, doors(o, o2) { setDoors(o, o2 ?? state.jailDoor); syncPanel(); }, lamps(o) { state.lamps = o; applyLight(); syncPanel(); },
  owned(id, v) { state.owned[id] = v; drawBoards(); syncPanel(); },
  // (kind: 'stable' or 'sheriff' switches the building first; the rest goes into that building's recipe)
  setBuilding(kind) { setBuilding(kind); return info(); },
  recipe(o) {
    const { kind, ...rest } = o;
    if (kind && kind !== state.building) setBuilding(kind);
    Object.assign(cur(), rest); if (rest.wood) { setWood(T, cur().wood); eraseNails(T); } if (rest.wear !== undefined) LU.uPaintWear.value = cur().wear;
    rebuild(); syncPanel(); return info();
  },
  quality(q) { state.quality = q; applyQuality(); syncPanel(); },
  show(o) { for (const k in o) state[k] = o[k]; propGroup.visible = state.props; horseGroup.visible = state.showHorses; syncPanel(); },
  render() { renderer.render(scene, camera); },
  get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; }, get controls() { return controls; },
};
