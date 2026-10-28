// THE BUILDING LAB: the town's buildings built from parts in code, one module each (the stable: stable.js; the sheriff's
// office and jail: sheriff.js; the general store: store.js; the farm's barn and wind pump: barn.js, windpump.js), with their props (props.js) and, for the stable, the game's own horses standing in its
// stalls. The wood is the Material Lab's trim sheet and weathering, the stone the Stone Lab's wall maker; this lab adds
// the light baked through the doors and windows and from the lanterns (parts.js), and its own pictures (art.js: the
// signs, the stall boards, straw, the wanted posters). This file: the scene, the light and the time of day, the horses,
// the panel (one panel for every building: a picker at its top), the stats, and the rigs' handle (window.BL).
// ?b=stable, ?b=sheriff, ?b=store, ?b=barn ... picks the building it opens on.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeTextures, setWood, WOOD_LOOKS, gpuBytes } from '../materials/textures.js';
import { makeRubbleTexture } from '../stone/stonetex.js';
import { U, weather } from '../materials/weather.js';
import { stoneEdges, PALETTES } from '../stone/stonewall.js';
import { loadAnimals, makeAnimal } from '../../src/actors/animals.js';
import { PRICES, HORSES, LADDER } from '../../src/catalog.js';
import { makeHorse, HORSE_KIND } from '../../src/actors/horses.js';
import { buildStable, stableRecipe, PAINTS, RECIPE_DEFAULTS, STABLE } from './stable.js';
import { buildSheriff, sheriffRecipe, PAINTS as SHERIFF_PAINTS, RECIPE_DEFAULTS as SHERIFF_DEFAULTS } from './sheriff.js';
import { MORTARS } from '../stone/stonewall.js';
import { buildProps } from './props.js';
import { makeArt, makeSheriffArt, makeStoreArt } from './art.js';
import { softenGrain, eraseNails } from './woodlook.js';
import { buildStore, storeRecipe, PAINTS as STORE_PAINTS, RECIPE_DEFAULTS as STORE_DEFAULTS, SIGN_LAYOUT } from './store.js';
import { buildSaloon, saloonRecipe, PAINTS as SALOON_PAINTS, TRIMS as SALOON_TRIMS, RECIPE_DEFAULTS as SALOON_DEFAULTS, makeSaloonArt } from './saloon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCabin, cabinRecipe, CABIN_PAINTS, CABIN_DEFAULTS, CABIN_VIEW_NAMES, cabinControls, wireCabin } from './cabins.js';
import { buildBlacksmith, blacksmithRecipe, BS_PAINTS, BS_DEFAULTS } from './blacksmith.js';
import { buildBarn, barnRecipe, BARN_PAINTS, BARN_DEFAULTS } from './barn.js';
import { buildWindpump, windpumpRecipe, WINDPUMP_DEFAULTS } from './windpump.js';
import { LU, lit, boardWear, glowMaterial, animalLamps, setLamps, lanternGlow, ropeTexture } from './parts.js';

const $ = (s, el = document) => el.querySelector(s);
const num = (n) => Math.round(n).toLocaleString('en-US');
const MB = (b) => (b / 1048576).toFixed(1) + ' MB';
const GAME = new URL('../../', import.meta.url).href;

// THE HORSES, as the game's stable shows them (src/stablelife.js): the stable's ladder (src/catalog.js LADDER), each its
// coat and size on the new horse (src/actors/horses.js), the donkey as he is. Their names and prices are the game's own.
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
  doors: true, doorsOpen: true, lamps: true, time: 'day', props: true, showHorses: true, quality: 'gaming', az: 200,
  owned: { bay: true, donkey: false, chestnut: false, palomino: false, white: false, midnight: false },
  building: ({ stable: 'stable', sheriff: 'sheriff', store: 'store', saloon: 'saloon', cabin: 'cabin', blacksmith: 'blacksmith', barn: 'barn', windpump: 'windpump' })[new URLSearchParams(location.search).get('b')] || 'saloon',   // (the saloon first: the town's showpiece)
  sh: { ...SHERIFF_DEFAULTS }, st: { ...STORE_DEFAULTS }, sa: { ...SALOON_DEFAULTS }, ca: { ...CABIN_DEFAULTS }, bs: { ...BS_DEFAULTS }, bn: { ...BARN_DEFAULTS }, wp: { ...WINDPUMP_DEFAULTS }, jailDoor: false,
};
// THE BUILDINGS: what the panel and the rebuild need of each
const BUILDINGS = {
  stable: { label: 'Stable', paints: PAINTS, recipe: () => stableRecipe(state), r: () => state, loading: 'Raising the barn…' },
  // (the sheriff's office: the sun a little lower by day, so it reaches in under the porch roof as in its concept
  // picture; its paint sheltered there)
  // (its grain calmed, its boards' bumps flatter; its outdoor lantern out by day)
  sheriff: { label: "Sheriff's office", paints: SHERIFF_PAINTS, recipe: () => sheriffRecipe(state.sh), r: () => state.sh, loading: 'Building the jail…', sun: { day: 30 }, shelter: 0.45, calmGrain: true, woodBump: 0.45, outLampsByDay: false },
  // (the general store: its storeroom's sliding door stands open to begin with, as in its concept picture; its porch
  // lantern out by day; the sun a little lower, so it lays stripes through the windows onto the floor; its grain calmed
  // (its walls inside are upright planks, seen close); the wood under its peeling whitewash weathered grey)
  store: { label: 'General store', paints: STORE_PAINTS, recipe: () => storeRecipe(state.st), r: () => state.st, loading: 'Stocking the shelves…', sun: { day: 26 }, shelter: 0.4, woodBump: 0.6, outLampsByDay: false, door2: true, calmGrain: { straight: true }, bareTint: [0.86, 0.76, 0.66],
    // (its whitewash thin and chalky, the grain through it, peeling softly, more along the boards' edges; a dark lap line
    // under each board, small faint nails; its sign holding on where the wash has gone; by night its white front lit only a
    // little by the moon, the lanterns and the windows doing the rest)
    paintLook: { uPaintGrain: 0.85, uPeelSoft: 0.3, uEdgePeel: 0.08, uLapShadow: 0.48, uLapLip: 0.4, uNail: 0.35, uSignKeep: 0.6, uStreakW: 0.5, uFlake: 1, uLapUnder: 0.3 },
    // (less grime streaked down its pale front: close up it read as soot)
    grimeLook: { uGrimeAmt: 0.45, uDirtBand: 0.45 }, light: { night: { sunI: 0.32, hemiI: 0.55 } } },
  // (the saloon, on its corner: its batwings hang shut to begin with (door1: the doors' switch holds them hooked open),
  // its two door lanterns out by day; the wood under its oxblood paint weathered grey; its own trim colour)
  saloon: { label: 'Saloon', paints: SALOON_PAINTS, trims: SALOON_TRIMS, recipe: () => saloonRecipe(state.sa), r: () => state.sa, loading: 'Polishing the bar…', sun: { day: 30 }, shelter: 0.35, woodBump: 0.6, outLampsByDay: false, door1: false, calmGrain: { straight: true }, bareTint: [1.0, 1.0, 1.04] },
  // (the cabins: a recipe each, cabins.js; the back door is the second door switch, open to begin with)
  cabin: { label: 'Cabins', paints: CABIN_PAINTS, recipe: () => cabinRecipe(state.ca), r: () => state.ca, loading: 'Raising the cabin…', sun: { day: 34 }, shelter: 0.4, woodBump: 0.75, outLampsByDay: false, door2: true, calmGrain: { weathered: true } },
  blacksmith: { label: 'Blacksmith', paints: BS_PAINTS, recipe: () => blacksmithRecipe(state.bs), r: () => state.bs, loading: 'Lighting the forge…', sun: { day: 34 }, shelter: 0.3, woodBump: 0.75, outLampsByDay: false, door2: true, calmGrain: { weathered: true } },
  // (the farm's barn and wind pump: the old boards gone silver, as the game shows them: objects/codebuild.js LOOKS)
  barn: { label: 'Barn', paints: BARN_PAINTS, recipe: () => barnRecipe(state.bn), r: () => state.bn, loading: 'Raising the barn…', sun: { day: 34 }, woodBump: 0.8, calmGrain: { weathered: true } },
  windpump: { label: 'Wind pump', paints: { none: { label: 'None (bare wood)' } }, recipe: () => windpumpRecipe(state.wp), r: () => state.wp, loading: 'Raising the tower…', sun: { day: 34 }, woodBump: 0.75, calmGrain: { weathered: true } },
};
// the buildings in the order the panel lists them and Next steps through them: the showpieces first, the cabins (eleven
// designs, Next steps through each) and the wind pump last
const ORDER = ['saloon', 'store', 'stable', 'sheriff', 'blacksmith', 'barn', 'cabin', 'windpump'];
const BLD = () => BUILDINGS[state.building];
// how paint wears, for a building that doesn't say (parts.js LU: the stable's and the sheriff's look)
const PAINT_LOOK = { uPaintGrain: 0, uPeelSoft: 0.08, uEdgePeel: 0, uLapShadow: 0.42, uLapLip: 0, uNail: 1, uSignKeep: 0.25, uStreakW: 1, uFlake: 0, uLapUnder: 1 };
// the weathering's grime for a building that doesn't say (weather.js U: as makeMaterials sets it)
const GRIME_LOOK = { uGrimeAmt: 0.8, uDirtBand: 0.8 };
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
  const NL = (BLD().light || {})[state.time] || {};   // (a building may dim the moon on a pale front)
  sun.color.set(L.sun); sun.intensity = NL.sunI ?? L.sunI;
  hemi.color.set(L.sky).lerp(new THREE.Color(1, 1, 1), state.time === 'night' ? 0.1 : 0.25); hemi.groundColor.set(L.ground); hemi.intensity = NL.hemiI ?? L.hemiI;
  const sky = new THREE.Color(L.bg ?? L.sky);
  scene.background = sky; scene.fog = new THREE.Fog(sky, 50, 150);
  sun.position.copy(viewCentre).addScaledVector(dir, 40); sun.target.position.copy(viewCentre); sun.target.updateMatrixWorld();
  renderer.toneMappingExposure = L.exp;
  LU.uNight.value = L.night; LU.uLamp.value = state.lamps ? 1 : 0; LU.uLampGain.value = L.lampGain;
  // (a building may put its outdoor lanterns out by day: their light, their glass and flame, their glow)
  const outOn = state.time !== 'day' || BLD().outLampsByDay !== false;
  LU.uOutLamp.value = outOn ? 1 : 0;
  if (B && B.lamps) B.lamps.forEach((Lp, i) => { if (i < LU.uLampS.value.length) LU.uLampS.value[i] = Lp.outdoor && !outOn ? 0 : Lp.strength; });
  if (B && B.glow) { B.glow.visible = state.lamps; B.glow.material.opacity = L.glow; }
  if (B && B.glowOut) { B.glowOut.visible = state.lamps && outOn; B.glowOut.material.opacity = L.glow; }
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
let T, RT, ART, SART, STA, SAA;
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
  // (the jail's whitewashed walls: the rubble picture under a lime wash; glass seen from inside: faintly tinted)
  mats.plaster = lit(new THREE.MeshStandardMaterial({ map: RT.map, normalMap: RT.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.97 }), { ao: true, tint: true });
  mats.pane = new THREE.MeshBasicMaterial({ color: 0x8fa4b4, transparent: true, opacity: 0.12, depthWrite: false });
  mats.decal = lit(new THREE.MeshStandardMaterial({ map: SART.sheriff, roughness: 0.9, transparent: true, depthWrite: false, alphaTest: 0.01, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), { ao: true });
  mats.glow = glowMaterial(); mats.glass = glowMaterial({ panes: true });
  mats.rope = lit(new THREE.MeshStandardMaterial({ map: ropeTexture(), roughness: 0.92 }), { ao: true, tint: true });
  // (the general store's goods: one picture of labels, prints, cloth and heaps, each corner its own tint; glass jars)
  mats.goods = lit(new THREE.MeshStandardMaterial({ map: STA.store, roughness: 0.78 }), { ao: true, tint: true });
  mats.jar = lit(new THREE.MeshStandardMaterial({ color: 0xdfeceb, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false }), { ao: true });
  T.ground.repeat.set(15, 15);
  mats.ground = lit(weather(new THREE.MeshStandardMaterial({ map: T.ground, roughness: 0.97 }), { ground: true, tint: true, ao: true }));
}

// THE TRIM SHEET'S NAILS PAINTED OUT: the Material Lab's board strips carry a nail (and its rust run) a third of the way
// across each strip, once every 1.2 m along it: on upright boards side by side they came out as rows of big dark ovals
// right across a wall. A band of each strip either side of them is copied over from just beside it (colour and bumps
// both), in the lab's copy of the pictures; the stable's nails are drawn by its shader instead (parts.js boardWear)
// the lab's copy of the wood sheet for the building shown: the Material Lab's look, its nails painted out, and for a
// building that asks for it (the sheriff's office) its grain calmed (softenGrain)
function woodFor(T) { setWood(T, cur().wood); eraseNails(T); if (BLD().calmGrain) softenGrain(T, typeof BLD().calmGrain === 'object' ? BLD().calmGrain : {}); }
// (softenGrain and eraseNails: woodlook.js, shared with the game)

// ── the building, its props, its horses ──────────────────────────────────────────────────────────────────────────────
let B = null, P = null, ground = null, groundGeo = null, lib = null;
const group = new THREE.Group(), propGroup = new THREE.Group(), horseGroup = new THREE.Group();
scene.add(group, propGroup, horseGroup);
const horses = [];
const stats = { buildMs: 0, bakeMs: 0, propMs: 0, texMs: 0 };
function rebuild() {
  for (const m of [...group.children]) { group.remove(m); m.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); if (m.isPoints) m.material.dispose(); }
  for (const m of [...propGroup.children]) { propGroup.remove(m); m.geometry.dispose(); }
  const t0 = performance.now(), sheriff = state.building === 'sheriff', store = state.building === 'store', saloon = state.building === 'saloon';
  B = state.building === 'barn' ? buildBarn(barnRecipe(state.bn), { texMean: RT.mean }) : state.building === 'windpump' ? buildWindpump(windpumpRecipe(state.wp), { texMean: RT.mean }) : state.building === 'blacksmith' ? buildBlacksmith(blacksmithRecipe(state.bs), { texMean: RT.mean }) : state.building === 'cabin' ? buildCabin(cabinRecipe(state.ca), { texMean: RT.mean }) : saloon ? buildSaloon(saloonRecipe(state.sa), { texMean: RT.mean }) : store ? buildStore(storeRecipe(state.st), { texMean: RT.mean }) : sheriff ? buildSheriff(sheriffRecipe(state.sh), { texMean: RT.mean }) : buildStable(stableRecipe(state), { texMean: RT.mean });
  LU.uPaintWear.value = cur().wear; LU.uPaintShelter.value = BLD().shelter || 0; mats.wood.normalScale.setScalar(BLD().woodBump ?? 0.9); LU.uBareTint.value.setRGB(...(BLD().bareTint || [0.9, 0.82, 0.74]));
  for (const [u, v] of Object.entries({ ...PAINT_LOOK, ...(BLD().paintLook || {}) })) LU[u].value = v;
  for (const [u, v] of Object.entries({ ...GRIME_LOOK, ...(BLD().grimeLook || {}) })) U[u].value = v;
  applyLight();
  // (a sign painted straight onto the boards: the board shader lays it on, from its picture and its place on the wall)
  const SP = B.anchors.signPaint;
  LU.uSignOn.value = SP ? 1 : 0; LU.uSignMap.value = store ? STA.signPaint : SART.signPaint;
  // (the decals' picture: the store's own, or the sheriff's)
  const decalMap = saloon ? SAA.saloon : store ? STA.store : SART.sheriff; if (mats.decal.map !== decalMap) { mats.decal.map = decalMap; mats.decal.needsUpdate = true; }
  // (the goods' picture: the saloon's own, or the store's)
  const goodsMap = saloon ? SAA.saloon : STA.store; if (mats.goods.map !== goodsMap) { mats.goods.map = goodsMap; mats.goods.needsUpdate = true; }
  if (SP) { LU.uSignRect.value.set(SP.x0, SP.y0, 1 / SP.w, 1 / SP.h); LU.uSignZ.value = SP.z; }
  for (const g of ['wood', 'iron', 'stone', 'plaster', 'hay', 'floor', 'spill', 'boards', 'decal', 'glow', 'glass', 'pane', 'rope', 'goods', 'jar']) {
    const geo = B.geos[g]; if (!geo) continue;
    const m = new THREE.Mesh(geo, mats[g]); m.name = g; m.castShadow = !['glow', 'glass', 'spill', 'floor', 'boards', 'decal', 'pane', 'jar'].includes(g); m.receiveShadow = g !== 'glow' && g !== 'glass' && g !== 'pane';
    if (g === 'glass' || g === 'pane' || g === 'jar') m.renderOrder = 1;
    if (g === 'decal') m.renderOrder = 0.5;
    group.add(m);
  }
  // (a building's meshes kept apart, named 'part:material' (the saloon's upstairs, its roof): the material after the colon)
  for (const g in B.geos) {
    const mat = g.includes(':') && mats[g.split(':')[1]]; if (!mat) continue;
    const m = new THREE.Mesh(B.geos[g], mat); m.name = g; m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  // the front doors: each its own mesh, turned on its hinge (a door with a window carries its glass with it)
  B.doorMeshes = B.doors.map((L, i) => {
    const m = new THREE.Mesh(L.geo, mats.wood); m.name = 'door ' + (L.group || (i ? 'right' : 'left')); m.castShadow = m.receiveShadow = true;
    m.position.set(...L.hinge); group.add(m);
    if (L.glass) { const gm = new THREE.Mesh(L.glass, mats.glass); gm.renderOrder = 1; gm.name = 'door glass'; m.add(gm); }
    // (its knob, plates and hangers: iron, swinging or sliding with it)
    if (L.iron) { const im = new THREE.Mesh(L.iron, mats.iron); im.castShadow = im.receiveShadow = true; im.name = 'door iron'; m.add(im); }
    // (its harness collar: a leather tube, swinging with the door; lit evenly)
    if (L.rope) { const n = L.rope.attributes.position.count; L.rope.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(0.8), 1)); L.rope.setAttribute('aLamp', new THREE.BufferAttribute(Float32Array.from({ length: n * 2 }, (_, i) => (i % 2 ? 0 : 0.6)), 2)); const c = new THREE.Mesh(L.rope, mats.rope); c.castShadow = true; c.name = 'collar'; m.add(c); }
    return m;
  });
  // (anything else the building brings that moves on its own: the saloon's walker; the wind pump's wheel, turning)
  if (B.extra) group.add(B.extra);
  B.spinning = (B.spins || []).map((S) => {
    const pivot = new THREE.Group(); pivot.position.set(...S.at); pivot.name = 'spin';
    for (const [k, g] of Object.entries(S.geos)) { const m = new THREE.Mesh(g, mats[k]); m.name = k; m.castShadow = m.receiveShadow = true; pivot.add(m); }
    group.add(pivot); return { pivot, axis: new THREE.Vector3(...(S.axis || [0, 0, 1])).normalize(), speed: S.speed || 0 };
  });
  // the props, baked in the building's light
  const off = B.offset, offZ = B.offsetZ || 0;
  P = buildProps(B.props, { seed: cur().seed * 7 + 1, bake: (geo) => { geo.translate(-off, 0, -offZ); B.light.bake(geo); B.light.apply(geo, state.doors, 'main', state.jailDoor); geo.translate(off, 0, offZ); } });
  for (const g of ['wood', 'iron', 'hay', 'goods', 'decal']) { if (!P.geos[g]) continue; const m = new THREE.Mesh(P.geos[g], mats[g]); m.castShadow = g !== 'decal'; m.receiveShadow = true; if (g === 'decal') m.renderOrder = 0.5; propGroup.add(m); }
  // the lanterns: where they are, for the shaders' light, and a soft glow round each (one draw for all of them)
  setLamps(B.lamps);
  // (outdoor lanterns' glow apart, so it can go out by day)
  // (a light with no lantern, L.noGlow: a lit window's warmth thrown out onto a porch; no glow sprite)
  B.glow = lanternGlow(B.lamps.filter((L) => !L.outdoor && !L.noGlow)); group.add(B.glow);
  const outs = B.lamps.filter((L) => L.outdoor && !L.noGlow); B.glowOut = outs.length ? lanternGlow(outs) : null; if (B.glowOut) group.add(B.glowOut);
  applyLight();
  stats.buildMs = B.msBuild; stats.bakeMs = B.msBake; stats.propMs = P.ms; stats.totalMs = performance.now() - t0;
  setDoors(state.doors);
  bakeGround();
  if (state.building === 'stable') drawBoards();
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
  // (the jail's door and the store's storeroom door go with open2; a sliding door slides along its track instead)
  B.doorMeshes.forEach((m, i) => {
    const L = B.doors[i], o = L.group === 'jail' || L.group === 'loading' || L.group === 'back' ? open2 : open;
    if (L.slide) m.position.set(L.hinge[0] + (o ? L.slide[0] : 0), L.hinge[1] + (o ? L.slide[1] : 0), L.hinge[2] + (o ? L.slide[2] : 0)); else m.rotation.y = o ? L.open : 0;
  });
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
    // (a corner building has a street along each of its fronts)
    const dYard = Math.min(...(B.anchors.streets || [Y]).map((Q) => rect(x, z, Q[0], Q[1], Q[2], Q[3]))) + Math.sin(x * 0.7 + z * 0.3) * 0.4;
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
  const key = a.kind + ':' + a.tall.toFixed(3);   // (by size too: the ladder's horses are five sizes of the one kind)
  if (SHAPE[key]) return SHAPE[key];
  a.root.position.set(0, 0, 0); a.root.rotation.set(0, 0, 0); a.root.updateMatrixWorld(true);
  const m = a.mesh, v = new THREE.Vector3();
  let chest = -Infinity, nose = -Infinity, top = 0;
  for (let i = 0; i < m.geometry.attributes.position.count; i++) {
    m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
    nose = Math.max(nose, v.z); top = Math.max(top, v.y);
    if (v.y > 0.45 * a.tall && v.y < 0.62 * a.tall) chest = Math.max(chest, v.z);
  }
  return (SHAPE[key] = { chest, nose, top, halter: halterFor(a) });
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
  for (const h of horses) { if (h.halter) h.halter.removeFromParent(); if (h.horse) h.horse.dispose(); else h.a.dispose(); }
  horses.length = 0;
  if (!lib || !B || !B.stalls) return;
  for (const S of B.stalls) {
    // (each the game's own: the stable's ladder's coat and size on the new horse, the donkey as he is: src/stablelife.js)
    const id = S.horse, L = LADDER[id] || LADDER.bay, look = { kind: L.kind };
    const horse = L.kind === HORSE_KIND ? makeHorse(lib, { recipe: L.coat, size: L.size, tier: state.quality, renderer }) : null;
    const a = horse ? horse.a : makeAnimal(lib, L.kind, { size: L.size });
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
    horses.push({ a, horse, id, stall: S.id, next: 4 + Math.random() * 8, shape: sh, pose, still: pose !== 'look' && pose !== 'door', speed, halter, turn, nod, across: new THREE.Vector3(Math.cos(face), 0, -Math.sin(face)), head: a.bones.Head || a.bones[a.info.head] });
  }
  horseGroup.visible = state.showHorses;
}
// now and then a horse shifts to its other idle (a toss of the head) and back; each frame its head is turned its own way
// (about the upright, at the head's own joint, on top of the clip)
const _pq = new THREE.Quaternion(), _yq = new THREE.Quaternion(), _nq = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
// (the head put back as the clip last left it before the mixer runs: the mixer only writes a bone whose value has
// changed, so a head held still by the clip kept last frame's turn and the next went on top: the heads spun round)
function tickHorses(dt) {
  for (const h of horses) {
    if (h.head && h.headClip) h.head.quaternion.copy(h.headClip);
    h.a.update(dt);
    if (h.horse) h.horse.look(camera.position);
    if (h.head) (h.headClip || (h.headClip = new THREE.Quaternion())).copy(h.head.quaternion);
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
  // (the cabins: each cabin works out its own views from its footprint, cabins.js cabinViews)
  get blacksmith() { return state.building === 'blacksmith' && B && B.views ? B.views : { front34: [[-11.5, 3.6, 12.5], [0.6, 2.2, 0]] }; },
  get barn() { return state.building === 'barn' && B && B.views ? B.views : { front: [[-9.5, 4.2, 17.5], [0.3, 3.2, 0]] }; },
  get windpump() { return state.building === 'windpump' && B && B.views ? B.views : { front: [[-6, 5, 16], [0, 6, 0]] }; },
  get cabin() { return state.building === 'cabin' && B && B.views ? B.views : Object.fromEntries(CABIN_VIEW_NAMES.map((n) => [n, [[-12, 4, 14], [0, 2, 0]]])); },
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
    cells: [[2.3, 1.55, 1.25], [4.0, 0.9, -1.6]],
    back: [[10.5, 4.6, -12.5], [0.0, 2.6, -1.0]],
    roof: [[-3.0, 11.5, -12.0], [-1.6, 4.6, 1.0]],
  },
  store: {
    front: [[-8.6, 3.0, 13.4], [0.2, 3.9, 0.0]],
    door: [[1.4, 2.4, 9.6], [1.6, 3.0, 1.7]],
    porch: [[-1.2, 1.95, 3.15], [5.0, 2.1, 2.3]],
    leanto: [[-11.0, 2.7, 5.0], [-3.6, 2.6, -0.8]],
    counter: [[1.75, 1.62, 1.5], [2.1, 1.2, -2.9]],
    shelves: [[1.9, 1.75, 0.6], [4.9, 2.2, -1.4]],
    stove: [[2.6, 1.6, -1.9], [-0.9, 1.1, 0.3]],
    back: [[10.0, 4.6, -12.6], [0.6, 3.6, -1.0]],
    roof: [[-4.8, 13.5, -11.0], [0.6, 6.8, 0.6]],
  },
  // (the saloon: its own frame as built, moved by its footprint's centring: x + 1.41, z - 1.425)
  saloon: {
    front: [[-14.09, 2.6, 18.375], [0.21, 5.0, -0.225]],
    door_a: [[2.01, 2.4, 13.075], [1.71, 3.2, 4.575]],
    door_b: [[-12.09, 2.4, -2.225], [-3.39, 3.0, -2.625]],
    balcony: [[5.21, 2.1, 5.975], [-4.09, 3.6, 6.175]],
    bar: [[1.21, 2.15, 4.025], [0.61, 2.6, -4.425]],
    stage: [[1.11, 2.2, 0.175], [1.71, 2.0, -5.925]],
    stairs: [[-1.59, 2.3, 2.775], [4.41, 3.8, -3.625]],
    chalkboard: [[2.41, 2.1, 3.775], [4.31, 1.9, 1.475]],
    back: [[15.41, 6.0, -17.425], [1.41, 4.0, -2.425]],
    roof: [[9.41, 18.0, -16.425], [0.41, 8.5, 0.575]],
  },
};
const SHOW = {
  barn: `<div class="row check"><label><input type="checkbox" id="doors"> Big doors open</label></div>
    <div class="row check"><label><input type="checkbox" id="lamps"> Lantern lit</label></div>
    <div class="row check"><label><input type="checkbox" id="props"> Props (loose hay, bales, the pitchfork, buckets)</label></div>`,
  // (the wind pump has no doors, lanterns or props: the switches the panel wires are there, out of sight)
  windpump: `<p class="note">Its wheel turns.</p><div hidden><input type="checkbox" id="doors"><input type="checkbox" id="lamps"><input type="checkbox" id="props"></div>`,
  blacksmith: `<div class="row check"><label><input type="checkbox" id="doors"> Big doors open</label></div>
    <div class="row check"><label><input type="checkbox" id="jailDoor"> Shed door open</label></div>
    <div class="row check"><label><input type="checkbox" id="lamps"> Lanterns and the forge lit</label></div>
    <div class="row check"><label><input type="checkbox" id="props"> Props (anvil, quench tub, coal, wheel, trough, hitching rail)</label></div>`,
  cabin: `<div class="row check"><label><input type="checkbox" id="doors"> Front doors open</label></div>
    <div class="row check"><label><input type="checkbox" id="jailDoor"> Back door open</label></div>
    <div class="row check"><label><input type="checkbox" id="lamps"> Lanterns and fires lit</label></div>
    <div class="row check"><label><input type="checkbox" id="props"> Props (woodpile, barrel, bench, bucket, washtub)</label></div>`,
  stable: `<div class="row check"><label><input type="checkbox" id="doors"> Front doors open</label></div>
    <div class="row check"><label><input type="checkbox" id="lamps"> Lanterns lit</label></div>
    <div class="row check"><label><input type="checkbox" id="props"> Props (barrels, trough, crates, bales, wagon)</label></div>
    <div class="row check"><label><input type="checkbox" id="showHorses"> Horses</label></div>`,
  sheriff: `<div class="row check"><label><input type="checkbox" id="doors"> Office door open</label></div>
    <div class="row check"><label><input type="checkbox" id="jailDoor"> Jail door open</label></div>
    <div class="row check"><label><input type="checkbox" id="lamps"> Lanterns lit</label></div>
    <div class="row check"><label><input type="checkbox" id="props"> Props (bench, barrels, crates, trough, hitching rail, woodpile)</label></div>`,
  store: `<div class="row check"><label><input type="checkbox" id="doors"> Front doors open</label></div>
    <div class="row check"><label><input type="checkbox" id="jailDoor"> Storeroom door open</label></div>
    <div class="row check"><label><input type="checkbox" id="lamps"> Lanterns lit</label></div>
    <div class="row check"><label><input type="checkbox" id="props"> Props (barrels of apples and crackers, crates, flour sacks, pails, the bench, shovels, the washtub)</label></div>`,
  get saloon() {
    return `<div class="row two"><label for="s-trim">Trim</label><select id="s-trim">${Object.entries(SALOON_TRIMS).map(([k, L]) => `<option value="${k}"${k === state.sa.trim ? ' selected' : ''}>${L.label}</option>`).join('')}</select></div>
    <div class="row check"><label><input type="checkbox" id="walker"> Someone walking through (the batwings swing)</label></div>
    <div class="row check"><label><input type="checkbox" id="doors"> Batwings hooked open</label></div>
    <div class="row check"><label><input type="checkbox" id="lamps"> Lamps lit</label></div>
    <div class="row check"><label><input type="checkbox" id="props"> Props (tables, chairs, stools, the piano, barrels, benches, the hitching rail and trough)</label></div>`;
  },
};
const HOW = {
  barn: `<p><b>The barn</b> (barn.js): the farm's barn, 12 by 9 m, board and batten in a faded red ochre (iron-oxide paint, worn back to grey wood) on a fieldstone footing, a gable roof of split shakes. Big X-braced double doors in the front gable swing out (in the game E opens them); over them the hay-loft door under a hoist beam, its pulley and rope. Small four-pane windows down the sides, a louvred vent in the back gable.</p>
    <p><b>Inside</b>: a dirt floor, posts and beams, a hayloft over both sides with the drive floor open to the roof between them, three stalls with plank fronts, half doors and mangers under the right loft, a feed bin, a ladder up to the left loft, a lantern on a post. The loose hay, the bales, the pitchfork and the buckets are props: in the game they are clutter, the last of the inside to load.</p>`,
  windpump: `<p><b>The wind pump</b> (windpump.js): a farm windmill as the 1880s built them, all wood: four legs leaning in, girts and X braces (none on the ladder's side), a platform at the top with the head, a wheel of eighteen slats on two rings, a board tail vane. The pump rod runs down the middle to an iron pump at its foot, its pipe running out past the legs to the stock tank (in the game the town's own trough, put down there). The wheel turns.</p>`,
  blacksmith: `<p><b>The blacksmith</b> (blacksmith.js): a board-and-batten smithy with big double doors in its gable end, open inside to the rafters, a packed-earth floor; a stone forge against the back wall with a sheet-iron hood and a stone chimney through the roof, leather bellows on a frame, a workbench with a vise, tongs and hammers on a rack, horseshoes over the doors; an open shoeing shed on its right. The forge glows and lights the shop at night. Props (the anvil on its stump, the quench tub, the coal, a wagon wheel, the trough, the hitching rail) are separate pieces.</p>`,
  cabin: `<p><b>Cabins</b> are made from a recipe (cabins.js): hewn or round logs, board and batten or lap siding; a single pen, a double pen, a dogtrot (two pens and an open breezeway under one roof) or an L with a kitchen wing; a lean-to room on the back or an end; a back door; a front, shed or wrap-around porch; a stone, stick-and-mud or stovepipe chimney; a gable or shed roof of split shakes or boards; shuttered or six-pane windows; stone piers, a stone footing or log sills. The presets cover the range; Random makes one up from the seed.</p>
    <p><b>Logs</b> are boxes (hewn, with clay chinking set back between them on both faces) or eight-sided poles (round, scribed tight), their ends running past the corners. Openings take out the courses they cross. Stone chimneys and footings are the Stone Lab's wall maker; piers and hearths are flat stones.</p>
    <p><b>Inside</b>: plank floors, plank ceilings on peeled-pole joists, a fireplace with a mantel or a box stove, doorways between the rooms, a lantern in each room. The furniture comes from the props library: each room lists where its bed, table, stove and shelves go.</p>
    <p><b>Far look</b>: no inside, the chinking one sheet per wall, wide shakes, two meshes. <b>All presets in a row</b> merges every preset into one set of meshes, as the town would.</p>`,
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
  store: `<p><b>The store</b> is two storeys of <b>lap siding</b> behind a tall <b>false front</b> that steps up in three, each step with a cornice of a cap, mouldings, a frieze, dentils and paired brackets. Upstairs, six-pane windows with their blinds part drawn. The <b>porch roof</b> is corrugated tin (sheets of narrow facets tilted either way, some rustier than others) on purlins and rafters, carried by a beam on five <b>turned posts</b> (a square foot and head, a lathe-turned shaft of beads, a vase and a long taper) over a raised boardwalk on short posts and pads.</p>
    <p><b>Paint</b> is whitewash in the recipe, peeled back to grey wood in streaks and patches board by board, more by the corners, the doors and low down. The sign is painted straight onto the boards: "GENERAL STORE", "DRY GOODS · GROCERIES · HARDWARE" under it, and the ghost of an older sign in faded red above and below, plainer where the whitewash has gone.</p>
    <p><b>The lean-to storeroom</b> is boards and battens, with a big Z-braced door that slides along an iron track over its doorway (the second door switch), its own loading dock, and a freestanding hoist: a post, an arm, a brace, a pulley block and chain.</p>
    <p><b>Inside</b>, upright plank walls, a beamed ceiling, a floor worn pale along the paths people walk. The counter runs down the right side (a brass till, a coffee grinder, candy jars, a balance scale) with shelves to the ceiling behind it over a bank of labelled drawers, a rolling ladder, pictures and a flag on top. The goods (tins, jars, packets, bolts of cloth, boots, books, sacks) are drawn from one picture of labels and prints, so the whole stock is one draw. The open floor in front of the counter is kept clear for the store's job.</p>
    <p><b>Props</b> (barrels of apples and crackers, kegs, crates of apples and of pails, flour and coffee sacks, the bench, the shovels, the washtub, the coal bucket, a broom) are separate pieces for the Town Lab.</p>`,
  saloon: `<p><b>The saloon</b> stands on a corner, both street faces finished: two storeys of <b>lap siding</b> in oxblood red peeling to grey wood, cream pilasters and trim, a tall <b>false front</b> on each street face (the main one taller, the side one stepping down) with a bracketed cornice and "SALOON" painted on it in cream, laid board by board so the letters follow the laps. A stone chimney stands behind the side front.</p>
    <p><b>The boardwalk</b> wraps the corner on blocks, steps up to each door. Over it, <b>one balcony</b> on turned posts with curved knee brackets: its deck is the porch's ceiling (boards and joists seen from under it), a railing of turned balusters between ball-topped newels. Each street face has a wide doorway with a pair of <b>louvred batwing doors</b> (they swing when someone walks through, both ways, on their springs) and a lantern over it, display windows with SALOON in gold on the glass, six-pane windows upstairs with lace and lamplight.</p>
    <p><b>Inside</b>, a double-height hall: the bar down the left with a brass foot rail, tap towers and lamps, a back-bar with an arched mirror and shelves of sarsaparilla and root beer; a gallery across the back with closed doors, a wide stair up the right wall; under the gallery the band's <b>stage</b> (velvet drapes, a fringed valance, footlights, the piano); round tables, a wagon-wheel chandelier, red wallpaper over a dark wainscot; at the front right a <b>chalkboard</b> on an easel for the graph teacher. Pictures, wallpaper, velvet, lace and bottles all come from one picture drawn in code.</p>
    <p><b>Props</b> (tables, chairs, stools, the piano and its stool, barrels, benches, the hitching rail and trough) are separate pieces for the Town Lab.</p>`,
};
let panelWired = false;
function buildPanel() {
  const opt = (obj, cur) => Object.entries(obj).map(([k, L]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${L.label || L}</option>`).join('');
  const forSale = Object.keys(PRICES.horse), R = cur(), kind = state.building, sheriff = kind === 'sheriff', mortar = kind !== 'stable';
  panel.innerHTML = `<h1>Building Lab</h1><p class="sub">The town's buildings built from parts in code: walls, roof, doors and all, ready to walk into. <a href="../">All labs</a></p>
  <details class="sec" open><summary>Building</summary><div class="body">
    <div class="picks">${ORDER.map((k) => `<button class="btn${kind === k ? ' on' : ''}" data-bld="${k}">${BUILDINGS[k].label}</button>`).join('')}</div>
    ${kind === 'cabin' ? cabinControls(R) : ''}
    <div class="row two"><label for="s-paint">Paint</label><select id="s-paint">${opt(BLD().paints, R.paint)}</select></div>
    <div class="row" data-key="wear"><label for="r-wear">Paint worn off</label><input type="range" id="r-wear" min="0" max="1" step="0.01" value="${R.wear}"><output>${R.wear.toFixed(2)}</output></div>
    <div class="row two"><label for="s-wood">Wood</label><select id="s-wood">${opt(WOOD_LOOKS, R.wood)}</select></div>
    <div class="row two"><label for="s-stone">Stone colours</label><select id="s-stone">${opt(PALETTES, R.stone)}</select></div>
    ${mortar ? `<div class="row two"><label for="s-mortar">Mortar</label><select id="s-mortar">${opt(MORTARS, R.mortar)}</select></div>` : ''}
    <div class="seedrow"><label for="seed">Seed</label><input id="seed" type="number" min="1" step="1" value="${R.seed}"><button class="btn" id="newSeed">New seed</button></div>
    <div class="lbl">This building's recipe</div><pre class="recipe" id="recipe">${JSON.stringify(BLD().recipe())}</pre>
    <p class="note">Everything that makes this ${({ stable: 'stable', sheriff: "sheriff's office", store: 'store', saloon: 'saloon', cabin: 'cabin', blacksmith: 'blacksmith', barn: 'barn', windpump: 'wind pump' })[kind]} its own, small enough for the town to keep one per building.</p>
  </div></details>
  <details class="sec" open><summary>Show</summary><div class="body">
    <div class="picks" id="times">${['day', 'dusk', 'night'].map((t) => `<button class="btn" data-time="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
    ${SHOW[kind]}
    ${kind !== 'stable' ? '' : `<div class="lbl">Bought (its board turns into a name plate)</div>
    ${forSale.map((id) => `<div class="row check"><label><input type="checkbox" data-owned="${id}"> ${FULL[id] || id} (${PRICES.horse[id]} gold)</label></div>`).join('')}`}
    <div class="lbl">Look from</div>
    <div class="picks">${Object.keys(VIEWS[kind]).map((v) => `<button class="btn" data-view="${v}">${v}</button>`).join('')}</div>
    <div class="row two"><label for="s-q">Quality</label><select id="s-q">${opt({ potato: 'Potato', normal: 'Normal', gaming: 'Gaming' }, state.quality)}</select></div>
  </div></details>
  <details class="sec"><summary>How it's made</summary><div class="body"><div class="how" style="border:0;margin:0;padding:0">${HOW[kind]}</div></div></details>
  <details class="sec" open><summary>Performance</summary><div class="body"><div class="stats" id="stats" aria-live="polite"></div></div></details>`;
  const recipeText = () => { const rb = $('#recipe'); if (rb) rb.textContent = JSON.stringify(BLD().recipe()); };
  $('#s-paint').addEventListener('change', (e) => { cur().paint = e.target.value; rebuild(); });
  $('#r-wear').addEventListener('input', (e) => { cur().wear = +e.target.value; LU.uPaintWear.value = cur().wear; e.target.nextElementSibling.textContent = cur().wear.toFixed(2); recipeText(); });
  $('#s-wood').addEventListener('change', (e) => { cur().wood = e.target.value; woodFor(T); recipeText(); });
  $('#s-stone').addEventListener('change', (e) => { cur().stone = e.target.value; rebuild(); });
  if (mortar) $('#s-mortar').addEventListener('change', (e) => { cur().mortar = e.target.value; rebuild(); });
  $('#seed').addEventListener('change', (e) => { cur().seed = Math.max(1, Math.round(+e.target.value) || 1); rebuild(); });
  $('#newSeed').addEventListener('click', () => { cur().seed = 1 + Math.floor(Math.random() * 9999); $('#seed').value = cur().seed; rebuild(); });
  $('#doors').addEventListener('change', (e) => setDoors(e.target.checked));
  if ($('#jailDoor')) $('#jailDoor').addEventListener('change', (e) => setDoors(state.doors, e.target.checked));
  // (the saloon: its walker, its trim colour)
  if ($('#walker')) $('#walker').addEventListener('change', (e) => { if (B && B.walker) B.walker.on = e.target.checked; });
  if ($('#s-trim')) $('#s-trim').addEventListener('change', (e) => { cur().trim = e.target.value; rebuild(); });
  $('#lamps').addEventListener('change', (e) => { state.lamps = e.target.checked; applyLight(); });
  $('#props').addEventListener('change', (e) => { state.props = e.target.checked; propGroup.visible = state.props; });
  if (kind === 'stable') {
    $('#showHorses').addEventListener('change', (e) => { state.showHorses = e.target.checked; horseGroup.visible = state.showHorses; });
    panel.querySelectorAll('[data-owned]').forEach((c) => c.addEventListener('change', () => { state.owned[c.dataset.owned] = c.checked; drawBoards(); }));
  }
  $('#s-q').addEventListener('change', (e) => { state.quality = e.target.value; applyQuality(); });
  // (the cabins: their recipe controls; a choice that shows or hides others draws the panel again)
  if (kind === 'cabin') wireCabin(panel, R, (full) => { rebuild(); if (full) buildPanel(); syncPanel(); if (full) view(R.lineup ? 'row0' : 'front34'); });
  if (panelWired) return;
  // (once: the panel's clicks, and the phone's panel toggle)
  panelWired = true;
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('[data-time]'); if (t) { state.time = t.dataset.time; applyLight(); syncPanel(); }
    const v = e.target.closest('[data-view]'); if (v) view(v.dataset.view);
    const b = e.target.closest('[data-bld]'); if (b && !b.disabled && b.dataset.bld !== state.building) setBuilding(b.dataset.bld);
  });
  $('#panelToggle').addEventListener('click', () => { const c = panel.classList.toggle('closed'); $('#panelToggle').setAttribute('aria-expanded', String(!c)); });
  $('#doorsBtn').addEventListener('click', () => { state.doorsOpen = !state.doorsOpen; setDoors(state.doorsOpen, state.doorsOpen); syncPanel(); });
  $('#nextBtn').addEventListener('click', nextModel);
}
// the next building in the panel's order, round and round; on the cabins, each design in turn before moving on
function nextModel() {
  const sel = state.building === 'cabin' && $('#c-preset');
  if (sel) {
    const names = [...sel.options].map((o) => o.value).filter((v) => v !== 'random' && v !== 'custom'), i = names.indexOf(sel.value);
    if (i >= 0 && i < names.length - 1) { sel.value = names[i + 1]; sel.dispatchEvent(new Event('change')); return; }
  }
  const next = ORDER[(ORDER.indexOf(state.building) + 1) % ORDER.length];
  setBuilding(next);
  if (next === 'cabin') {   // (the cabins from their first design)
    const s2 = $('#c-preset'), first = s2 && [...s2.options].map((o) => o.value).find((v) => v !== 'random' && v !== 'custom');
    if (first && s2.value !== first) { s2.value = first; s2.dispatchEvent(new Event('change')); }
  }
}
function syncPanel() {
  const R = cur();
  panel.querySelectorAll('[data-time]').forEach((b) => b.classList.toggle('on', b.dataset.time === state.time));
  for (const k of ['doors', 'jailDoor', 'lamps', 'props', 'showHorses']) { const c = $('#' + k); if (c) c.checked = !!state[k]; }
  const db = $('#doorsBtn'); if (db) { const o = state.doors || state.jailDoor; db.textContent = o ? 'Doors: open' : 'Doors: shut'; db.setAttribute('aria-pressed', String(o)); }
  panel.querySelectorAll('[data-owned]').forEach((c) => { c.checked = !!state.owned[c.dataset.owned]; });
  $('#s-paint').value = R.paint; $('#s-wood').value = R.wood; $('#s-stone').value = R.stone; $('#seed').value = R.seed; $('#s-q').value = state.quality;
  if ($('#s-mortar')) $('#s-mortar').value = R.mortar;
  $('#r-wear').value = R.wear; $('#r-wear').nextElementSibling.textContent = R.wear.toFixed(2);
  const rb = $('#recipe'); if (rb) rb.textContent = JSON.stringify(BLD().recipe());
}
// switch the building: its own wood look, its own panel, built, looked at from the front
let horsesLoading = null;
function loadHorses() {
  if (!horsesLoading) horsesLoading = loadAnimals(GAME, { kinds: [HORSE_KIND, 'donkey'] }).then((l) => { lib = l; placeHorses(); });
  return horsesLoading;
}
function setBuilding(kind) {
  if (!BUILDINGS[kind]) return;
  state.building = kind;
  state.doors = state.jailDoor = state.doorsOpen;   // (every door as the view's Doors button says: open to begin with)
  woodFor(T);
  horseGroup.visible = kind === 'stable' && state.showHorses;
  buildPanel(); rebuild(); syncPanel(); view('front');
  if (kind === 'stable') loadHorses();
  try { history.replaceState(null, '', '?b=' + kind); } catch (e) { /* (a file: page can't) */ }
}
function view(name) {
  const V = VIEWS[state.building][name]; if (!V) return;
  // (a tall, narrow screen, a phone held upright, sees less across: stand further back)
  const back = ['aisle', 'stall', 'office', 'cells', 'porch', 'counter', 'shelves', 'stove', 'bar', 'stage', 'stairs', 'chalkboard', 'balcony', 'room', 'room2', 'inside', 'forge'].includes(name) ? 1 : Math.min(2.4, Math.max(1, 1.2 / camera.aspect)), t = new THREE.Vector3(...V[1]);
  camera.position.copy(t).add(new THREE.Vector3(...V[0]).sub(t).multiplyScalar(back)); controls.target.copy(t); controls.update();
}

// ── the stats box ────────────────────────────────────────────────────────────────────────────────────────────────────
const texBytes = () => [T.wood, T.woodN, RT.map, RT.normalMap, T.noise, T.ground].reduce((s, t) => s + gpuBytes(t.image.width, t.image.height), 0) + ART.bytes + (SART ? SART.bytes : 0) + (STA ? STA.bytes : 0) + (SAA ? SAA.bytes : 0);
const trisOf = (g) => (g ? g.index.count / 3 : 0);
function info() {
  if (!B) return null;
  const doorTris = B.doors.reduce((s, L) => s + trisOf(L.geo) + trisOf(L.glass) + trisOf(L.iron), 0);
  const bt = Object.values(B.geos).reduce((s, g) => s + trisOf(g), 0) + doorTris;
  const ht = horses.reduce((s, h) => s + trisOf(h.a.mesh.geometry), 0);
  const per = {}; for (const g in B.geos) per[g] = trisOf(B.geos[g]); per.doors = doorTris;
  return { building: state.building, recipe: BLD().recipe(), tris: { building: bt, props: P.tris, horses: ht, per }, meshes: { building: group.children.length, props: propGroup.children.length, horses: horses.length },
    parts: B.parts, counts: B.counts, ms: { build: B.msBuild, bake: B.msBake, props: P.ms, total: stats.totalMs, textures: stats.texMs }, texMB: texBytes() / 1048576,
    calls: renderer.info.render.calls, frameTris: renderer.info.render.triangles, footprint: B.anchors.footprint, offset: B.offset, jail: B.jail, lamps: B.lamps.length, fps };
}
let frames = 0, fpsT = performance.now(), fps = 0;
function updateStats() {
  const I = info(), el = $('#stats'); if (!I || !el) return;
  el.innerHTML = `<div class="t">${BLD().label}</div>
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
  resize(); controls.update(); tickHorses(dt); if (B && B.tick) B.tick(dt);
  if (B && B.spinning) for (const S of B.spinning) S.pivot.rotateOnAxis(S.axis, -S.speed * dt);
  renderer.render(scene, camera);
  frames++;
  if (t - fpsT > 500) { fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; updateStats(); }
}

(async () => {
  try {
    buildPanel();
    const t0 = performance.now();
    $('#loading').textContent = BLD().loading;
    T = await makeTextures({ wood: cur().wood }); woodFor(T); RT = makeRubbleTexture(); ART = await makeArt(); SART = await makeSheriffArt(); STA = await makeStoreArt(SIGN_LAYOUT); SAA = await makeSaloonArt();
    state.doors = state.jailDoor = state.doorsOpen;   // (every door as the view's Doors button says: open to begin with)
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
  get stable() { return B; }, get building() { return B; }, get heads() { return horses.map((h) => h.head || null); },   // (heads: the stall horses' head bones, for a rig) get horses() { return horses.map((h) => ({ id: h.id, stall: h.stall, at: h.a.root.position.toArray().map((x) => +x.toFixed(2)), chest: +h.shape.chest.toFixed(2), halter: !!h.halter, clip: h.a.clip, pose: h.pose })); },
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
    Object.assign(cur(), rest); if (rest.wood) woodFor(T); if (rest.wear !== undefined) LU.uPaintWear.value = cur().wear;
    rebuild(); syncPanel(); return info();
  },
  quality(q) { state.quality = q; applyQuality(); syncPanel(); },
  walker(on) { if (B && B.walker) B.walker.on = on; const c = $('#walker'); if (c) c.checked = !!on; return B && B.walker ? B.walker.on : null; },
  show(o) { for (const k in o) state[k] = o[k]; propGroup.visible = state.props; horseGroup.visible = state.showHorses; syncPanel(); },
  render() { renderer.render(scene, camera); },
  get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; }, get controls() { return controls; },
};
