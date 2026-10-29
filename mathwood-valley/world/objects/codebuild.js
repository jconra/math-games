// THE CODE-BUILT BUILDINGS, MADE FOR A SCENE: the Building Lab's stable, sheriff's office, general store, saloon, cabins,
// blacksmith, and the farm's barn and wind pump (built from parts in code, labs/buildings/) turned into ready-to-place
// three.js groups, each with its own materials, so several can stand in one scene. Each is built from its lab file as
// that file is now (a builder still working on one changes it here too). Everything the game takes from labs/buildings/,
// labs/materials/ and labs/stone/ comes through this one module (a later step moves the shared kit to world/kit/: then
// only these imports change).
//
//   const kit = await makeBuildKit({ step, small, oneSheet })   the shared pictures (the wood sheet in each building's
//                                              look, the rubble, the signs, the store's goods, the stable's boards), made
//                                              once; step() is awaited between the slow parts, so a caller can let frames
//                                              through. small: the signs' and the decals' and goods' sheets at half size;
//                                              oneSheet: one wood sheet for every building (no calmed copies). The potato
//                                              tier asks for both (objects/codebuildings.js)
//   await kit.art(kind)                        a kind's own pictures, made the first time one is wanted (the saloon's)
//   const b = buildCodeBuilding(kit, kind, { shade, look, ground })   kind: one of CODE_KINDS ('home' is a cabin); ground:
//                                              the land under it, for one that sits on it as it is (SITS, below); shade(sh): a
//                                              patch to add after the building's own (the valley's hill shade and
//                                              street-lamp light); look: the layout item's { id, preset, seed } (a cabin's
//                                              design: lookOf). Returns {
//     group      the building at its own origin (its footprint centred on x = z = 0, its front toward +z), in four parts:
//                group.shell (always drawn: its outside), group.inside (seen only from near: the rooms, the furniture,
//                the goods), group.props (its props: barrels, sacks ...), group.cards (the far look, drawn instead of the
//                inside when that is hidden: the dark cards in its doorways and see-through windows, merged with its
//                small outside pieces in plain colours, see FAR TRIM below)
//     B          the build (anchors: doorways, footprint, the store's counter; stalls; lamps; recipe)
//     grid       where a walker can stand, in its own frame (cells of 0.1 m): blocked (walls, counters, furniture, the
//                props, a porch's edge where there are no steps), floor (the height stood at: a floor, a porch, steps),
//                ceil (the underside of what is overhead, for the camera); at(x, z) -> the cell's index or -1
//     sync()     after it is moved (its group's world matrix): its lanterns' light and its painted sign follow
//     near(on)   the inside and the props drawn (true), or the dark cards (false)
//     lit(night, on)   night 0 (day) .. 1; on 0..1, how lit it is (its lanterns, its windows at night)
//     nightLamps the light it throws outside at night, for the street lamps' picture: [{ at: [x, y, z], reach, strength }]
//     dispose()
//   }
//
// Kept as the lab keeps them: the light baked into every corner (the doorways, the windows, the lanterns), the
// weathering in the shaders, each building's look (the paint's wear, the calmer grain, the sign painted on the boards).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTextures } from '../../labs/materials/textures.js';
import { U, weather } from '../../labs/materials/weather.js';
import { makeRubbleTexture } from '../../labs/stone/stonetex.js';
import { stoneEdges } from '../../labs/stone/stonewall.js';
import { buildStable, stableRecipe } from '../../labs/buildings/stable.js';
import { buildSheriff, sheriffRecipe } from '../../labs/buildings/sheriff.js';
import { buildStore, storeRecipe, SIGN_LAYOUT } from '../../labs/buildings/store.js';
import { buildSaloon, saloonRecipe, makeSaloonArt } from '../../labs/buildings/saloon.js';
import { buildCabin, cabinRecipe, PRESETS as CABIN_PRESETS } from '../../labs/buildings/cabins.js';
import { buildBlacksmith, blacksmithRecipe } from '../../labs/buildings/blacksmith.js';
import { buildBarn, barnRecipe } from '../../labs/buildings/barn.js';
import { buildWindpump, windpumpRecipe } from '../../labs/buildings/windpump.js';
import { buildProps } from '../../labs/buildings/props.js';
import { makeArt, makeSheriffArt, makeStoreArt } from '../../labs/buildings/art.js';
import { LAMP_MAX, lit, boardWear, glowMaterial, lanternGlow, ropeTexture } from '../../labs/buildings/parts.js';
import { softenGrain, eraseNails } from '../../labs/buildings/woodlook.js';

// each building's look, as the Building Lab shows it (labs/buildings/main.js BUILDINGS): the wood sheet's grain (calm:
// calmed; straight: the store's straight streaks), how bumpy, how much less paint goes under a porch roof, the wood under
// peeled paint, how the paint wears, the weathering's grime
// (sheet: which copy of the wood sheet: raw, calm (the sheriff's) or straight (the store's and the saloon's))
const LOOKS = {
  stable: { sheet: 'raw', bump: 0.9, shelter: 0, bare: [0.9, 0.82, 0.74], paint: {}, grime: {} },
  sheriff: { sheet: 'calm', bump: 0.45, shelter: 0.45, bare: [0.9, 0.82, 0.74], paint: {}, grime: {} },
  generalStore: { sheet: 'straight', bump: 0.6, shelter: 0.4, bare: [0.86, 0.76, 0.66],
    paint: { uPaintGrain: 0.85, uPeelSoft: 0.3, uEdgePeel: 0.08, uLapShadow: 0.48, uLapLip: 0.4, uNail: 0.35, uSignKeep: 0.6, uStreakW: 0.5, uFlake: 1, uLapUnder: 0.3 },
    grime: { uGrimeAmt: 0.45, uDirtBand: 0.45 } },
  saloon: { sheet: 'straight', bump: 0.6, shelter: 0.35, bare: [1.0, 1.0, 1.04], paint: {}, grime: {} },
  cabin: { sheet: 'weathered', bump: 0.75, shelter: 0.4, bare: [0.9, 0.82, 0.74], paint: {}, grime: {} },
  blacksmith: { sheet: 'weathered', bump: 0.75, shelter: 0.3, bare: [0.9, 0.82, 0.74], paint: {}, grime: {} },
  // (the farm's: the old boards gone silver where the red ochre has worn off; the wind pump all bare wood)
  barn: { sheet: 'weathered', bump: 0.8, shelter: 0, bare: [0.9, 0.82, 0.74], paint: {}, grime: {} },
  windpump: { sheet: 'weathered', bump: 0.75, shelter: 0, bare: [0.9, 0.82, 0.74], paint: {}, grime: {} },
};
LOOKS.home = LOOKS.cabin;
// (weathered: the cabins' and the smithy's old boards gone silver, labs/buildings/woodlook.js weatherGrain)
const SHEETS = { calm: {}, straight: { straight: true }, weathered: { weathered: true } };
const PAINT_DEFAULT = { uPaintGrain: 0, uPeelSoft: 0.08, uEdgePeel: 0, uLapShadow: 0.42, uLapLip: 0, uNail: 1, uSignKeep: 0.25, uStreakW: 1, uFlake: 0, uLapUnder: 1 };
export const CODE_KINDS = ['stable', 'sheriff', 'generalStore', 'saloon', 'home', 'cabin', 'blacksmith', 'barn', 'windpump'];

// ── a cabin's design: the layout item's preset (any of cabins.js PRESETS) and seed, or, with none saved, one picked from
// its id, so each house in town differs and keeps its look from one visit to the next. The picks leave out the designs
// too big for a home's spot (the dogtrot is 11.6 m across, the L and the lean-to kitchen over 10 m deep) ──────────────
export const CABIN_LOOKS = Object.keys(CABIN_PRESETS);
export const CABIN_LABELS = Object.fromEntries(Object.entries(CABIN_PRESETS).map(([k, P]) => [k, P.label || k]));
export const TOWN_PICKS = CABIN_LOOKS.filter((k) => !['dogtrot', 'ell', 'kitchen'].includes(k));
const hashOf = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function lookOf(kind, it = {}) {
  if (kind !== 'cabin' && kind !== 'home') return { seed: Number.isFinite(+it.seed) && it.seed != null ? Math.round(+it.seed) : undefined };
  const h = hashOf(it.id || 'cabin'), preset = CABIN_PRESETS[it.preset] ? it.preset : TOWN_PICKS[h % TOWN_PICKS.length];
  const seed = Number.isFinite(+it.seed) && it.seed != null && +it.seed > 0 ? Math.round(+it.seed) : 1 + (h >>> 8) % 9973;
  return { preset, seed };
}

// ── the shared pictures ──────────────────────────────────────────────────────────────────────────────────────────────
// a picture at half its size (k = 4: a quarter), in place (once: a picture shared between kits is made small only the
// first time). from: draw it again from this full-size canvas (one drawn on again later: the stable's boards)
function halve(t, k = 2, from = null) {
  if (!t || !t.image || (t.userData.halved && !from) || !(t.image.width > 64)) return;
  const src = from || t.image, w = Math.max(1, Math.round(src.width / k)), h = Math.max(1, Math.round(src.height / k));
  if (t.isDataTexture) {   // (the painted signs: four channels of bytes, each texel the average of the four under it)
    if (k !== 2) return;   // (the painted signs: halved only)
    const S = t.image.data, W = t.image.width, D = new S.constructor(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) {
      const a = ((2 * y) * W + 2 * x) * 4 + k, b = a + W * 4;
      D[(y * w + x) * 4 + k] = (S[a] + S[a + 4] + S[b] + S[b + 4]) / 4;
    }
    t.image = { data: D, width: w, height: h };
  } else {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
    t.image = c;
  }
  t.userData.halved = true; t.needsUpdate = true;
}
// a picture's average colour (linear, for vertex colours), from its canvas drawn down to one pixel
const MEANS = new WeakMap();
function meanOf(t) {
  if (!t || !t.image) return new THREE.Color(0.5, 0.5, 0.5);
  if (MEANS.has(t)) return MEANS.get(t);
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const g = c.getContext('2d', { willReadFrequently: true }); let col;
  try { g.drawImage(t.image, 0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; col = new THREE.Color().setRGB(d[0] / 255, d[1] / 255, d[2] / 255, t.colorSpace === THREE.SRGBColorSpace ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace); }
  catch (e) { col = new THREE.Color(0.5, 0.5, 0.5); }
  MEANS.set(t, col); return col;
}
// the stand-ins' sheet: n x n cells of `cell` px, filled with the dark of an unlit room; alloc() -> the next cell (or 0)
const DARK = [0x15, 0x0e, 0x09];
function makeAtlas(cell, n) {
  const size = cell * n, data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { data[i * 4] = DARK[0]; data[i * 4 + 1] = DARK[1]; data[i * 4 + 2] = DARK[2]; data[i * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  let next = 1;
  return {
    tex, data, size, cell, n,
    alloc: () => (next < n * n ? next++ : 0),
    // a cell's corner in pixels, and its picture's place in the sheet (u0, v0, u1, v1; half a texel in from its edges)
    at: (i) => ({ x: (i % n) * cell, y: Math.floor(i / n) * cell }),
    uv: (i) => { const x = (i % n) * cell, y = Math.floor(i / n) * cell, e = 0.5; return [(x + e) / size, (y + e) / size, (x + cell - e) / size, (y + cell - e) / size]; },
  };
}
function copyTex(t) {
  const c = document.createElement('canvas'); c.width = t.image.width; c.height = t.image.height; c.getContext('2d').drawImage(t.image, 0, 0);
  const n = new THREE.CanvasTexture(c);
  for (const k of ['colorSpace', 'wrapS', 'wrapT', 'anisotropy', 'minFilter', 'magFilter']) n[k] = t[k];
  return n;
}
export async function makeBuildKit({ step = async () => {}, small = false, oneSheet = false } = {}) {
  const t0 = performance.now(), ms = {};
  let t = performance.now(); const lap = (k) => { ms[k] = Math.round(performance.now() - t); t = performance.now(); };
  const T = await makeTextures({ wood: 'straight' }); eraseNails(T); lap('wood'); await step('wood');
  // (the sheriff's and the store's own copies of the sheet, their grain calmed each their way)
  const woods = { raw: { wood: T.wood, woodN: T.woodN } };
  // (the potato tier: every building on the one sheet; the calmed copies would be four more pictures of 2.7 MB each)
  if (oneSheet) for (const name of Object.keys(SHEETS)) woods[name] = woods.raw;
  else for (const [name, calm] of Object.entries(SHEETS)) { const W = { wood: copyTex(T.wood), woodN: copyTex(T.woodN) }; softenGrain(W, calm); woods[name] = W; lap('grain ' + name); await step('grain'); }
  const RT = makeRubbleTexture(); lap('rubble'); await step('rubble');
  const ART = await makeArt(); const SART = await makeSheriffArt(); lap('signs'); await step('signs');
  const STA = await makeStoreArt(SIGN_LAYOUT); lap('goods'); await step('goods');
  // (small, the potato tier, drawn at half the screen's resolution anyway: the painted signs at half size; the decals' and
  // goods' sheets at a quarter (posters and labels); the wood sheet at half, without its bump picture (the boards'
  // bevels and grain are lost at that resolution, and the shader is cheaper for a machine short of fill rate); the
  // stable's boards at half, drawn again from their full-size canvas each time a slot is chalked up)
  if (small) {
    for (const t of [SART.signPaint, STA.signPaint]) halve(t);
    for (const t of [SART.sheriff, STA.store]) halve(t, 4);
    halve(T.wood); woods.raw.woodN = null;
    const full = ART.boards.image, slot = ART.boards.slotFor;
    halve(ART.boards); ART.boards.slotFor = (i, o) => { slot(i, o); halve(ART.boards, 2, full); };
  }
  // (the weathering as the Building Lab sets it: moss mostly on what faces up and in the shade, grime streaks and a dirt
  // band, the baked shade under the eaves, the sky's blue fill mostly greyed. Nothing else in the game uses it)
  U.uNoise.value = T.noise;
  Object.assign(U.uMossAmt, { value: 0.2 }); U.uMossUp.value = 0.9; U.uMossLow.value = 0.25; U.uMossShade.value = 1.0; U.uMossTuck.value = 0.2; U.uMossCrack.value = 0;
  U.uMossHeight.value = 0.9; U.uMossBreak.value = 1.0; U.uMossColor.value.set('#3d4428'); U.uMossSoft.value = 0.02 + 0.3 * 0.55; U.uPatchScale.value = 1 / 4;
  U.uGrimeAmt.value = 0.8; U.uStreakLen.value = 0.7; U.uStreakScale.value = 14 / 8; U.uSplashH.value = 0.5; U.uCornerDirt.value = 0.8; U.uGrimeSoft.value = 0.02 + 0.3 * 0.6;
  U.uGrimeColor.value.set('#5e574d'); U.uEdgeAmt.value = 0.6; U.uEdgeWidth.value = 0.02; U.uEdgeBreak.value = 0.75; U.uPaintChip.value = 0.4;
  U.uAOAmt.value = 1.0; U.uAOSun.value = 0.2; U.uEaveDark.value = 0.3; U.uBleach.value = 0; U.uDirtBand.value = 0.8; U.uSkyGrey.value = 0.6;
  U.uEdgeDark.value = 0.45; U.uEdgeDarkW.value = 0.03; U.uBevel.value = 0.55;
  U.uShadeDir.value.set(0, 0, -1);
  const kit = { T, woods, RT, ART, SART, STA, SAA: null, rope: ropeTexture(), small, ms: { ...ms, total: Math.round(performance.now() - t0) } };
  // (a kind's own pictures, made the first time one is built: the saloon's sign, its gold lettering, its bar's goods)
  kit.art = async (kind) => { if (kind === 'saloon' && !kit.SAA) { kit.SAA = await makeSaloonArt(); if (small) halve(kit.SAA.saloon, 4); } };
  // (the far look's material: plain colours per corner, shared by every building, so nothing of its own to set between
  // two buildings' far trims; the valley gives it the hill shade like any plain lit material)
  kit.trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }); kit.trimMat.name = 'code far trim'; kit.trimMat.shadowSide = THREE.DoubleSide;   // (both sides cast: see materialsFor)
  // THE STAND-INS' PICTURES: one shared sheet of square cells, each a picture of a building's inside taken from just
  // outside one of its see-through windows (or the saloon's open doorways) when the building is made
  // (objects/codebuildings.js); cell 0 is plain dark, what a window shows before its picture is taken. 4 x 4 cells:
  // 128 px each on the small pictures (512 x 512, 1 MB), else 256 (1024 x 1024, 4 MB). Shown as they were taken: not lit
  // again, not tone-mapped twice (the picture is the screen's own colours), darkened and warmed at night (codebuildings)
  kit.atlas = makeAtlas(small ? 128 : 256, 4);
  kit.standMat = new THREE.MeshBasicMaterial({ map: kit.atlas.tex, toneMapped: false }); kit.standMat.name = 'code stand-ins';
  return kit;
}

// ── one building's materials, each with the building's own uniforms (its paint, its sign, its lanterns, how lit) ─────
function materialsFor(kit, kind, B, shade) {
  const L = LOOKS[kind], W = kit.woods[L.sheet], { RT, ART, SART, STA } = kit, r = B.recipe, SP = B.anchors.signPaint;
  const saloon = kind === 'saloon' && kit.SAA;   // (the saloon's decals and its bar's goods are drawn on its own picture)
  const uni = {
    uPaintWear: { value: r.wear }, uPaintShelter: { value: L.shelter }, uBareTint: { value: new THREE.Color(...L.bare) },
    uSignOn: { value: SP ? 1 : 0 }, uSignMap: { value: kind === 'generalStore' ? STA.signPaint : SART.signPaint },
    uSignRect: { value: SP ? new THREE.Vector4(SP.x0, SP.y0, 1 / SP.w, 1 / SP.h) : new THREE.Vector4(0, 0, 1, 1) }, uSignZ: { value: SP ? SP.z : 0 },
    uSignInv: { value: new THREE.Matrix4() },
    uLampP: { value: Array.from({ length: LAMP_MAX }, () => new THREE.Vector3(0, -99, 0)) }, uLampS: { value: new Array(LAMP_MAX).fill(0) },
    uLampD: { value: Array.from({ length: LAMP_MAX }, () => new THREE.Vector4(0, -1, 0, 0)) },
    uLamp: { value: 1 }, uNight: { value: 0 }, uOutLamp: { value: 0 }, uLampGain: { value: 1.6 }, uBaseY: { value: 0 },
    uGrimeAmt: { value: L.grime.uGrimeAmt ?? 0.8 }, uDirtBand: { value: L.grime.uDirtBand ?? 0.8 },
  };
  for (const [k, v] of Object.entries({ ...PAINT_DEFAULT, ...L.paint })) uni[k] = { value: v };
  // (its own uniforms; heights in the weathering (the dirt band, the splash, the paint's wear low down, the eaves) from
  // the ground it stands on, not from the world's zero (uBaseY); and the valley's shade added after its own patches)
  const own = (m, shaded = true) => {
    m.userData.uni = uni; m.userData.sunShade = true;
    // (patched once only, however often it is handed here; the valley's lamp patch is never added to a shader that has
    // it already, so its lampLight() is never written twice)
    if (shaded && !m.userData.codeBuilt) {
      m.userData.codeBuilt = true;
      const prev = m.onBeforeCompile, key = m.customProgramCacheKey.bind(m);
      m.onBeforeCompile = (sh, rr) => {
        prev.call(m, sh, rr);
        sh.fragmentShader = 'uniform float uBaseY;\n' + sh.fragmentShader.replace('vec3 wP = vWPosAO.xyz;', 'vec3 wP = vWPosAO.xyz - vec3(0.0, uBaseY, 0.0);');
        if (shade && !/\bvec3 lampLight\(/.test(sh.fragmentShader)) shade(sh);
      };
      m.customProgramCacheKey = () => key() + '+codebuilt' + (shade ? '+valleyshade' : '');
    }
    return m;
  };
  const mats = {
    wood: own(boardWear(lit(weather(new THREE.MeshStandardMaterial({ map: W.wood, normalMap: W.woodN, normalScale: new THREE.Vector2(L.bump, L.bump), roughness: 0.94 }), { box: true, ao: true, bevel: true })))),
    iron: own(lit(weather(new THREE.MeshStandardMaterial({ color: 0x3a332e, roughness: 0.55, metalness: 0.65 }), { box: true, ao: true }))),
    stone: own(lit(stoneEdges(weather(new THREE.MeshStandardMaterial({ map: RT.map, normalMap: RT.normalMap, roughness: 0.93 }), { tint: true, ao: true })))),
    hay: own(lit(new THREE.MeshStandardMaterial({ map: ART.hay, roughness: 1 }), { ao: true, tint: true })),
    floor: own(lit(new THREE.MeshStandardMaterial({ map: ART.floor, roughness: 0.97 }), { ao: true })),
    spill: own(lit(new THREE.MeshStandardMaterial({ map: ART.spill, roughness: 1, alphaTest: 0.5 }), { ao: true })),
    boards: own(lit(new THREE.MeshStandardMaterial({ map: ART.boards, roughness: 0.82 }), { ao: true })),
    plaster: own(lit(new THREE.MeshStandardMaterial({ map: RT.map, normalMap: RT.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.97 }), { ao: true, tint: true })),
    pane: new THREE.MeshBasicMaterial({ color: 0x8fa4b4, transparent: true, opacity: 0.12, depthWrite: false }),
    decal: own(lit(new THREE.MeshStandardMaterial({ map: saloon ? kit.SAA.saloon : kind === 'generalStore' ? STA.store : SART.sheriff, roughness: 0.9, transparent: true, depthWrite: false, alphaTest: 0.01, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), { ao: true })),
    glow: own(glowMaterial(), false), glass: own(glowMaterial({ panes: true }), false),
    rope: own(lit(new THREE.MeshStandardMaterial({ map: kit.rope, roughness: 0.92 }), { ao: true, tint: true })),
    goods: own(lit(new THREE.MeshStandardMaterial({ map: saloon ? kit.SAA.saloon : STA.store, roughness: 0.78 }), { ao: true, tint: true })),
    jar: own(lit(new THREE.MeshStandardMaterial({ color: 0xdfeceb, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false }), { ao: true })),
  };
  mats.stone.shadowSide = THREE.FrontSide;
  // (the sun's shadow from both sides of every face: a wall's outside faces are the shell's and its inside faces the
  // inside's, which casts nothing; with three's default (only the faces turned away from the sun) the walls threw no
  // shadow, only the roofs did: the ground at a wall's foot lay in full sun)
  for (const k of ['wood', 'iron', 'plaster', 'hay', 'rope']) mats[k].shadowSide = THREE.DoubleSide;
  return { mats, uni };
}

// ── inside or outside: each triangle of a mesh sorted by whether it faces into the building's rooms ─────────────────
// (two geometries sharing the corners, each with its own triangles: the shell drawn always, the inside only near)
function splitByInside(geo, inside, ox, oz) {
  const P = geo.attributes.position, N = geo.attributes.normal, I = geo.index.array, a = [], b = [];
  const c = new THREE.Vector3(), n = new THREE.Vector3(), v = new THREE.Vector3();
  for (let t = 0; t < I.length; t += 3) {
    c.set(0, 0, 0); n.set(0, 0, 0);
    for (let j = 0; j < 3; j++) { c.add(v.fromBufferAttribute(P, I[t + j])); n.add(v.fromBufferAttribute(N, I[t + j])); }
    c.multiplyScalar(1 / 3); n.normalize();
    const ins = inside(c.x + n.x * 0.06 - ox, c.y + n.y * 0.06, c.z + n.z * 0.06 - oz) && inside(c.x - ox, c.y, c.z - oz);
    (ins ? b : a).push(I[t], I[t + 1], I[t + 2]);
  }
  return [compact(geo, a), compact(geo, b)];
}

// a geometry of only the corners some triangles use (list: their corners' indices into geo): its own small arrays
function compact(geo, list) {
  if (!list.length) return null;
  const map = new Int32Array(geo.attributes.position.count).fill(-1); let n = 0;
  for (const i of list) if (map[i] < 0) map[i] = n++;
  const g = new THREE.BufferGeometry();
  for (const k in geo.attributes) {
    const A = geo.attributes[k], sz = A.itemSize, src = A.array, dst = new src.constructor(n * sz);
    for (let i = 0; i < map.length; i++) if (map[i] >= 0) for (let c = 0; c < sz; c++) dst[map[i] * sz + c] = src[i * sz + c];
    g.setAttribute(k, new THREE.BufferAttribute(dst, sz, A.normalized));
  }
  g.setIndex(new THREE.BufferAttribute(n > 65535 ? Uint32Array.from(list, (i) => map[i]) : Uint16Array.from(list, (i) => map[i]), 1));
  g.computeBoundingSphere(); g.userData = geo.userData;
  return g;
}
// the doors (always standing open in a town) merged into the shell's own meshes: each leaf moved to where it stands open,
// with the attributes the shell's mesh has (a board's wear numbers: none)
function withDoors(base, extra) {
  if (!extra.length) return base;
  const list = [base, ...extra].filter(Boolean); if (list.length < 2) return list[0] || null;
  const names = Object.keys(list[0].attributes);
  for (const g of list) for (const k of names) if (!g.attributes[k]) { const ref = list[0].attributes[k]; g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * ref.itemSize), ref.itemSize)); }
  for (const g of list) for (const k of Object.keys(g.attributes)) if (!names.includes(k)) g.deleteAttribute(k);
  const out = mergeGeometries(list.map((g) => (g.index ? g : g.toNonIndexed()))); if (out) out.computeBoundingSphere();
  return out || base;
}

// ── where a walker can stand: the building's solids laid on a grid ──────────────────────────────────────────────────
// For each cell (0.1 m), a vertical line through its middle against every solid box (the bake's: walls, floors, the
// porch, the steps, the counter, the stalls; and the props' own): what it meets low down is the floor stood on (its top,
// under 1.05 m), what it meets at a walker's height blocks it, the lowest thing over 2 m is the ceiling. Then a porch's
// edge with no steps (a rise of more than 0.42 m to the cell beside it) blocked, and every block widened by a walker's
// half-width (0.18 m), so nobody stands in a wall.
const CELL = 0.1, WALK = [0.62, 1.75], PAD = 0.18, LEDGE = 0.42;
// (base: the building's own floor's height, a cabin's raised on its footing: its floor's boards are stood on, not a
// counter's top, though they are up off the ground)
function walkGrid(solids, foot, ox, oz, base = 0) {
  const x0 = -foot.w / 2 - 1.2, z0 = -foot.d / 2 - 1.2, nx = Math.ceil((foot.w + 2.4) / CELL), nz = Math.ceil((foot.d + 2.4) / CELL), n = nx * nz;
  const blocked = new Uint8Array(n), floor = new Float32Array(n), ceil = new Float32Array(n).fill(99);
  const inv = new THREE.Matrix4(), o = new THREE.Vector3(), d = new THREE.Vector3(), bb = new THREE.Box3(), h = new THREE.Vector3();
  for (const S of solids) {
    bb.setFromCenterAndSize(new THREE.Vector3(), h.set(...S.size)).applyMatrix4(S.m);
    if (bb.max.y < 0.02) continue;
    inv.copy(S.m).invert(); const hx = S.size[0] / 2, hy = S.size[1] / 2, hz = S.size[2] / 2;
    const i0 = Math.max(0, Math.floor((bb.min.x + ox - x0) / CELL)), i1 = Math.min(nx - 1, Math.floor((bb.max.x + ox - x0) / CELL));
    const j0 = Math.max(0, Math.floor((bb.min.z + oz - z0) / CELL)), j1 = Math.min(nz - 1, Math.floor((bb.max.z + oz - z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      // (the line x, z = the cell's middle, in the building's own frame before it was centred; into the box's frame)
      const wx = x0 + (i + 0.5) * CELL - ox, wz = z0 + (j + 0.5) * CELL - oz;
      o.set(wx, 0, wz).applyMatrix4(inv); d.set(wx, 1, wz).applyMatrix4(inv).sub(o);
      // slab test along the line: t is the height y (the direction is one metre a metre up)
      let tmin = -Infinity, tmax = Infinity, miss = false;
      for (const [oo, dd, hh] of [[o.x, d.x, hx], [o.y, d.y, hy], [o.z, d.z, hz]]) {
        if (Math.abs(dd) < 1e-9) { if (oo < -hh || oo > hh) { miss = true; break; } continue; }
        let t1 = (-hh - oo) / dd, t2 = (hh - oo) / dd; if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) { miss = true; break; }
      }
      if (miss) continue;
      const k = j * nx + i;
      if (tmax <= 1.05 && tmax > floor[k]) floor[k] = tmax;
      if (tmin < WALK[1] && tmax > WALK[0] && tmax > 1.05) blocked[k] = 1;
      else if (tmin < WALK[1] && tmax > WALK[0] && tmin > 0.3 && tmax > base + 0.1) blocked[k] = 1;   // (a counter, a table: up off the floor)
      if (tmin >= 1.9 && tmin < ceil[k]) ceil[k] = tmin;
    }
  }
  // (a low thing that reaches a walker's height counts: a chair's seat, a barrel; stood on only if it is the floor)
  for (let k = 0; k < n; k++) if (!blocked[k] && floor[k] > WALK[0] + 0.25) blocked[k] = 1;
  // a doorway's sill: the gap between a porch's boards and the floor inside (the wall's thickness, nothing solid under it
  // there) bridged at the lower of the two, up to 0.5 m across (a log wall is thicker than a framed one)
  const span = 5, f0 = floor.slice();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (blocked[k]) continue;
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      let a = -1, b = -1;
      for (let t = 1; t <= span && a < 0; t++) { const ii = i - di * t, jj = j - dj * t; if (ii < 0 || jj < 0) break; const q = jj * nx + ii; if (!blocked[q] && f0[q] > f0[k] + 0.2) a = f0[q]; }
      for (let t = 1; t <= span && b < 0; t++) { const ii = i + di * t, jj = j + dj * t; if (ii >= nx || jj >= nz) break; const q = jj * nx + ii; if (!blocked[q] && f0[q] > f0[k] + 0.2) b = f0[q]; }
      if (a > 0 && b > 0) floor[k] = Math.max(floor[k], Math.min(a, b));
    }
  }
  // a porch's edge with no steps: higher than the cell beside it by more than a step
  const ledge = new Uint8Array(n);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (blocked[k]) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj, f = a < 0 || b < 0 || a >= nx || b >= nz ? 0 : blocked[b * nx + a] ? floor[k] : floor[b * nx + a];
      if (floor[k] - f > LEDGE) { ledge[k] = 1; break; }
    }
  }
  // widened by a walker's half-width
  const r = Math.round(PAD / CELL), wide = new Uint8Array(n);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!blocked[j * nx + i] && !ledge[j * nx + i]) continue;
    for (let b = Math.max(0, j - r); b <= Math.min(nz - 1, j + r); b++) for (let a = Math.max(0, i - r); a <= Math.min(nx - 1, i + r); a++) if ((a - i) ** 2 + (b - j) ** 2 <= r * r + 0.5) wide[b * nx + a] = 1;
  }
  return {
    x0, z0, nx, nz, cell: CELL, blocked: wide, wall: blocked, floor, ceil,
    at: (x, z) => { const i = Math.floor((x - x0) / CELL), j = Math.floor((z - z0) / CELL); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; },
  };
}

// ── build one ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (look: the item's design, lookOf; a seed saved for a building that isn't a cabin changes its weathering's draw)
const seedOf = (look) => (look.seed ? { seed: look.seed } : {});
const BUILDERS = {
  stable: (env, look) => buildStable(stableRecipe(seedOf(look)), env),
  sheriff: (env, look) => buildSheriff(sheriffRecipe(seedOf(look)), { ...env, inTown: true }),
  generalStore: (env, look) => buildStore(storeRecipe(seedOf(look)), env),
  saloon: (env, look) => buildSaloon(saloonRecipe(seedOf(look)), env),
  cabin: (env, look) => buildCabin(cabinRecipe({ preset: look.preset, seed: look.seed }), env),
  blacksmith: (env, look) => buildBlacksmith(blacksmithRecipe(seedOf(look)), env),
  barn: (env, look) => buildBarn(barnRecipe(seedOf(look)), env),
  windpump: (env, look) => buildWindpump(windpumpRecipe(seedOf(look)), env),
};
BUILDERS.home = BUILDERS.cabin;
// (the kinds that sit on the land as it is when it isn't levelled: their foundations and steps reach down to it)
export const SITS = new Set(['blacksmith', 'cabin', 'home']);
// (meshes seen only from inside, whole: the goods, the jars, the glass seen from inside, the rope; the stable's floor,
// straw and hay are split like the rest: its doors stand open on the street. Not the plaster: the cabins' chinking
// between the logs, a stick chimney's daub, the piers and the stones at the steps are plaster too, outdoors; whole
// inside, the walls were slit and the chimneys and porches hollow from outside till the inside was loaded)
const ALL_INSIDE = new Set(['goods', 'jar', 'pane', 'rope']);
const NO_SHADOW = new Set(['glow', 'glass', 'spill', 'floor', 'boards', 'decal', 'pane', 'jar']);

// ── THE FAR TRIM: a building's small outside pieces in plain colours, one mesh ─────────────────────────────────────────
// Past the insides' reach a building was its outside drawn material by material: the wood, the ironwork, the stone, the
// window panes and lanterns, the dark cards in its doorways (five or six draws for something across the street). Far,
// everything of those but the wood (its own shader: the boards, the paint, the sign painted on them) is one mesh, each
// corner the colour its material shows (a picture's average colour, the paint's tint, the corner's baked shade), with one
// material shared by every building: a far building is two draws. The panes and lanterns as they look by day; at night
// their own glowing mesh is drawn again and the trim leaves its copy of them out (they come last in it: its draw range)
const TRIM = new Set(['iron', 'stone', 'plaster', 'hay', 'spill', 'floor', 'rope', 'glow']);
const TINTED = new Set(['stone', 'plaster', 'hay', 'rope', 'wood']);   // (their pictures take the tint each corner carries)
const GLOW_NIGHT = 0.08;                                         // (night past this: the windows begin to glow)
const CARD = new THREE.Color(0x150e09);
function farTrim(mats, meshes, cardGeos) {
  const parts = [];
  for (const m of meshes) if (m.name !== 'glow') parts.push({ geo: m.geometry, name: m.name });
  for (const g of cardGeos) parts.push({ geo: g, name: 'cards' });
  const glows = meshes.filter((m) => m.name === 'glow').map((m) => ({ geo: m.geometry, name: 'glow' }));
  const all = [...parts, ...glows];
  let nv = 0, ni = 0;
  for (const P of all) { const n = P.geo.attributes.position.count; nv += n; ni += P.geo.index ? P.geo.index.count : n; }
  if (!nv) return null;
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v0 = 0, i0 = 0, solid = 0;
  const c = new THREE.Color(), paint = new THREE.Color();
  // (a painted board as the wood's shader lays its paint on: the paint itself, a little brighter on lighter grain, worn
  // back toward the bare wood by the building's wear; not the paint times the wood's picture, which came out near black)
  const U = mats.wood && mats.wood.userData.uni, wear = U ? U.uPaintWear.value : 0.5, bare = U ? U.uBareTint.value : new THREE.Color(0.9, 0.82, 0.74);
  for (const P of all) {
    if (P.name === 'glow' && !solid) solid = i0;
    const A = P.geo.attributes, n = A.position.count, M = mats[P.name];
    const base = P.name === 'cards' ? CARD : M && M.map ? meanOf(M.map) : M && M.color ? M.color : CARD;
    const ao = A.aAO || null, tint = TINTED.has(P.name) ? A.aTintPaint || null : null, glow = P.name === 'glow' ? A.aGlow || null : null;
    for (let i = 0; i < n; i++) {
      const k = (v0 + i) * 3;
      pos[k] = A.position.getX(i); pos[k + 1] = A.position.getY(i); pos[k + 2] = A.position.getZ(i);
      if (A.normal) { nrm[k] = A.normal.getX(i); nrm[k + 1] = A.normal.getY(i); nrm[k + 2] = A.normal.getZ(i); } else nrm[k + 1] = 1;
      if (glow) {   // (as glowMaterial shows it by day: a window dark, an outdoor lantern out, a lantern inside lit)
        const kind = glow.getW(i), out = kind > 9.5, gK = kind - (out ? 10 : 0);
        if (gK <= 1.5) c.setRGB(0.035, 0.042, 0.05); else if (out) { if (gK < 2.5) c.setRGB(0.04, 0.035, 0.03); else c.setRGB(0.16, 0.14, 0.11); } else c.setRGB(glow.getX(i), glow.getY(i), glow.getZ(i));
      } else {
        c.copy(base);
        if (tint && P.name === 'wood' && Math.abs(tint.getW(i) - 1) < 0.01) {
          const lum = base.r * 0.3 + base.g * 0.59 + base.b * 0.11;
          paint.setRGB(tint.getX(i), tint.getY(i), tint.getZ(i)).multiplyScalar(0.9 + 0.45 * lum);
          c.multiply(bare).lerp(paint, 1 - 0.55 * wear);
        } else if (tint) c.multiply({ r: tint.getX(i), g: tint.getY(i), b: tint.getZ(i) });
        if (ao) c.multiplyScalar(0.45 + 0.55 * ao.getX(i));
      }
      col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
    if (P.geo.index) { const I = P.geo.index; for (let j = 0; j < I.count; j++) idx[i0 + j] = I.getX(j) + v0; i0 += I.count; }
    else { for (let j = 0; j < n; j++) idx[i0 + j] = v0 + j; i0 += n; }
    v0 += n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  return { geo, solid: glows.length ? solid : i0 };
}

// ── THE INSIDES' PRIORITIES (the governor's Inside detail dial loads up to one of them: world/governor.js) ──────────────
// 1 needed: the rooms themselves (walls, floors, the counter, the shelves, the stalls, the bar) and the furniture a
//   walker goes round (beds, tables, chairs, benches, the piano, the anvil)
// 2 normal: the goods on the shelves, the jars, the barrels, crates and sacks
// 3 clutter: buckets, brooms, tools, rugs, the posters and pictures on the walls
const PROP_PRI = { bed: 1, roundTable: 1, spindleChair: 1, bench: 1, piano: 1, pianoStool: 1, barStool: 1, washstand: 1, anvil: 1, quench: 1, hearth: 1, stone: 1, wagon: 1,
  bucket: 3, coalBucket: 3, broom: 3, shovel: 3, spade: 3, fork: 3, plank: 3, pipe: 3, coal: 3, ragRug: 3 };   // (any other: 2)
const partPri = (g) => (g === 'goods' || g === 'jar' ? 2 : g === 'decal' ? 3 : 1);
// a geometry's triangles split by whether their middle stands in one of the rooms (rectangles in the building's frame,
// above y0): the saloon's rooms upstairs, apart from its galleries
function splitRooms(geo, rooms, y0) {
  const P = geo.attributes.position, I = geo.index.array, a = [], b = [];
  for (let t = 0; t < I.length; t += 3) {
    let x = 0, y = 0, z = 0; for (let j = 0; j < 3; j++) { x += P.getX(I[t + j]); y += P.getY(I[t + j]); z += P.getZ(I[t + j]); }
    x /= 3; y /= 3; z /= 3;
    (y > y0 && rooms.some((R) => x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1) ? b : a).push(I[t], I[t + 1], I[t + 2]);
  }
  return [compact(geo, a), compact(geo, b)];
}
// a door leaf's own copy, with the attributes its material's shell mesh has (as withDoors gives the merged ones)
function fitAttrs(g, ref) {
  if (!ref) return g;
  for (const k of Object.keys(ref.attributes)) if (!g.attributes[k]) { const r = ref.attributes[k]; g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * r.itemSize), r.itemSize)); }
  for (const k of Object.keys(g.attributes)) if (!ref.attributes[k]) g.deleteAttribute(k);
  return g;
}
const ease = (t) => t * t * (3 - 2 * t);
export const DOOR = { time: 0.55, flap: 1.1 };
const CARD_FADE = 0.3;   // (s: the stand-in pictures fading out once the room behind them is in)   // (s: a door swinging all the way open or shut; the batwings' flap)

export function buildCodeBuilding(kit, kind, o = {}) {
  const t0 = performance.now();
  const look = lookOf(kind, o.look || {}), env = { texMean: kit.RT.mean };
  let B = BUILDERS[kind](env, look);
  // ON THE LAND AS IT IS (o.ground(x, z): the ground's height at a point of its centred frame, against the ground at its
  // middle; given for a building that doesn't level its ground): a kind that can sit on it (SITS: it sits as low as it
  // can, its foundation and steps down to the ground, B.sit how far up from the ground at its middle) is built again
  // with the ground in its own frame (its centring known from the first build)
  if (o.ground && SITS.has(kind)) {
    const ox = B.offset || 0, oz = B.offsetZ || 0;
    for (const g of Object.values(B.geos)) g.dispose(); for (const L of B.doors) for (const g of [L.geo, L.glass, L.iron, L.rope]) if (g) g.dispose();
    if (B.extra) B.extra.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } });
    B = BUILDERS[kind]({ ...env, ground: (x, z) => o.ground(x + ox, z + oz) }, look);
  }
  const { mats, uni } = materialsFor(kit, kind, B, o.shade);
  const OX = B.offset || 0, OZ = B.offsetZ || 0, inside = B.light.inside;
  // the parts: shell (its outside, always drawn), far (the far look's trim), cards (the stand-ins in its see-through
  // windows), props (its outdoor props), doors (the leaves, while they can swing). The insides (a group for each
  // priority, and the saloon's rooms upstairs) are made now and kept OUT of the scene until loaded (load below)
  const group = new THREE.Group(); group.name = 'code ' + kind;
  const shell = new THREE.Group(), far = new THREE.Group(), cards = new THREE.Group(), props = new THREE.Group(), doorsG = new THREE.Group(), up = new THREE.Group();
  const ins = [null, new THREE.Group(), new THREE.Group(), new THREE.Group()];
  shell.name = 'shell'; far.name = 'far'; cards.name = 'cards'; props.name = 'props'; doorsG.name = 'doors'; up.name = 'upstairs';
  ins.forEach((g, i) => { if (g) g.name = 'inside ' + i; });
  group.add(shell, far, cards, props, doorsG); Object.assign(group, { shell, far, cards, props, doors: doorsG, insides: [ins[1], ins[2], ins[3], up] });
  const add = (to, geo, mat, name) => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = !NO_SHADOW.has(name); m.receiveShadow = !['glow', 'glass', 'pane'].includes(name);
    if (name === 'glass' || name === 'pane' || name === 'jar') m.renderOrder = 1;
    if (name === 'decal') m.renderOrder = 0.5;
    to.add(m); return m;
  };
  // THE DOORS shut in town: each leaf merged at rest into the shell's mesh of its material, at its end (a building drawn
  // from the street costs nothing more for its doors); while one swings, or stands open, the leaves are their own
  // meshes on their hinges and the shell's meshes stop short of their copies (the draw range). The saloon's batwings
  // rest open as built (half doors: the hall is seen over them, its doorways show stand-ins, like windows) and flap
  // when somebody passes through
  const batwings = kind === 'saloon', rest = batwings ? 1 : 0;
  B.light.setDoors(true, true);
  const leafParts = { wood: [], glass: [], iron: [], rope: [] };
  for (const L of B.doors) {
    const M = new THREE.Matrix4().makeTranslation(L.hinge[0] + (batwings && L.slide ? L.slide[0] : 0), L.hinge[1], L.hinge[2]);
    if (batwings && !L.slide) M.multiply(new THREE.Matrix4().makeRotationY(L.open));
    if (L.rope) {   // (the collar: lit evenly, as the lab does)
      const n = L.rope.attributes.position.count;
      L.rope.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(0.8), 1)); L.rope.setAttribute('aLamp', new THREE.BufferAttribute(Float32Array.from({ length: n * 2 }, (_, i) => (i % 2 ? 0 : 0.6)), 2));
    }
    for (const [k, g] of [['wood', L.geo], ['glass', L.glass], ['iron', L.iron], ['rope', L.rope]]) if (g) leafParts[k].push(g.clone().applyMatrix4(M));
  }
  const rooms = (B.anchors.upstairs && B.anchors.upstairs.rooms) || null, upY = B.anchors.upstairs ? B.anchors.upstairs.floor - 0.3 : 0;
  // (a building's meshes kept apart in the lab, named 'part:material' (the saloon's upstairs, its roof): their material
  // after the colon, split and drawn like the rest)
  const doorBase = (m, base, leaves) => { if (leaves.length) m.userData.base = base ? base.index.count : 0; };
  const inPart = (geo, mat, g, name) => {   // (an inside part: into its priority's group, or the rooms upstairs)
    let rest = geo, roomsGeo = null;
    if (rooms && name.startsWith('up:')) [rest, roomsGeo] = splitRooms(geo, rooms, upY);
    if (roomsGeo) { const m = add(up, roomsGeo, mat, g); m.castShadow = false; }
    if (rest) { const m = add(ins[partPri(g)], rest, mat, g); m.castShadow = false; }   // (inside: lit by the bake, no sun shadow cast in there)
  };
  for (const name of new Set([...Object.keys(B.geos), ...Object.keys(leafParts).filter((k) => leafParts[k].length)])) {
    const g = name.includes(':') ? name.split(':')[1] : name, geo = B.geos[name], mat = mats[g]; if (!mat) continue;
    const leaves = name === g ? leafParts[g] || [] : [];
    if (geo && ALL_INSIDE.has(g)) { inPart(geo, mat, g, name); if (leaves.length) doorBase(add(shell, withDoors(null, leaves), mat, g), null, leaves); continue; }
    const [out, inn] = geo ? splitByInside(geo, inside, OX, OZ) : [null, null];
    const sh = withDoors(out, leaves);
    if (sh) doorBase(add(shell, sh, mat, g), out, leaves);
    if (inn) inPart(inn, mat, g, name);
    if (geo && geo !== inn) geo.dispose();
  }
  // the leaves that swing: each its own pivot at its hinge, its parts with the shell's materials; each belongs to the
  // doorway nearest it
  const doorways = (B.anchors.doorways || []).filter((D) => !D.inner);   // (a cabin's doorways between its rooms: indoors)
  const doors = [];
  for (const L of B.doors) {
    const pivot = new THREE.Group(); pivot.position.set(...L.hinge); pivot.name = 'door';
    for (const [k, g] of [['wood', L.geo], ['glass', L.glass], ['iron', L.iron], ['rope', L.rope]]) if (g) {
      const ref = shell.children.find((m) => m.isMesh && m.name === k);
      add(pivot, fitAttrs(g.clone(), ref && ref.geometry), mats[k], k);
    }
    let way = 0, best = Infinity;
    doorways.forEach((D, i) => { const d = Math.hypot(D.centre[0] - L.hinge[0], D.centre[2] - L.hinge[2]); if (d < best) { best = d; way = i; } });
    doorsG.add(pivot); doors.push({ pivot, L, way, t: rest, want: rest, rest, flap: 0 });
  }
  // THE SPINNING PARTS (the wind pump's wheel, B.spins): each its own pivot on the shell at its axle, its meshes with the
  // shell's materials, turned about its axis (tick) while the outside is drawn
  const spins = (B.spins || []).map((S) => {
    const pivot = new THREE.Group(); pivot.position.set(...S.at); pivot.name = 'spin';
    for (const [k, g] of Object.entries(S.geos)) if (g && mats[k]) { const ref = shell.children.find((m) => m.isMesh && m.name === k); add(pivot, fitAttrs(g, ref && ref.geometry), mats[k], k); }
    shell.add(pivot);
    return { pivot, axis: new THREE.Vector3(...(S.axis || [0, 0, 1])).normalize(), speed: S.speed || 0 };
  });
  // the props, baked in the building's light: its outdoor ones (the Decorations dial's), and the inside ones by their
  // priority (PROP_PRI), the saloon's rooms' own upstairs
  const bake = (geo) => { geo.translate(-OX, 0, -OZ); B.light.bake(geo); B.light.apply(geo, true, 'main', true); geo.translate(OX, 0, OZ); };
  const lists = { out: [], up: [], 1: [], 2: [], 3: [] };
  // (the player's cabin: none of the design's own room furniture (marked low): the player buys their own, src/cabin/)
  // (and none of its outdoor props in the way of a door: a partial porch's bench stood across the front door)
  const ways = (B.anchors.doorways || []).filter((D) => !D.inner);
  const atDoor = (p) => ways.some((D) => Math.hypot(p.x - D.centre[0], p.z - D.centre[2]) < 1.2);
  for (const p of B.props) { if (o.player && (p.low || (!p.inside && atDoor(p)))) continue; lists[p.upstairs && rooms ? 'up' : !p.inside ? 'out' : Math.max(1, Math.min(3, p.pri ?? PROP_PRI[p.type] ?? 2))].push(p); }   // (a prop can say its own: the cabins' furniture, pri 3)
  const propSolidsRaw = []; let propTris = 0;
  for (const [key, list] of Object.entries(lists)) {
    if (!list.length) continue;
    const P = buildProps(list, { seed: B.recipe.seed * 7 + 1, bake });
    const to = key === 'out' ? props : key === 'up' ? up : ins[key];
    for (const g of ['wood', 'iron', 'hay', 'goods', 'decal']) { if (!P.geos[g]) continue; const m = add(to, P.geos[g], mats[g], g); m.castShadow = key === 'out' && g !== 'decal'; }
    propSolidsRaw.push(...(P.solids || [])); propTris += P.tris;
  }
  // the lanterns' glow sprites (the inside ones with the inside; the outdoor ones on the shell, out by day)
  const inLamps = B.lamps.filter((L) => !L.outdoor && !L.noGlow), outLamps = B.lamps.filter((L) => L.outdoor && !L.noGlow);
  const glowIn = inLamps.length ? lanternGlow(inLamps) : null, glowOut = outLamps.length ? lanternGlow(outLamps) : null;
  if (glowIn) ins[1].add(glowIn); if (glowOut) shell.add(glowOut);
  // what else a building brings for the town, moving on its own (B.tick): the smithy's painted sign letters and its
  // chimney smoke. (The saloon's B.extra is the Building Lab's walker: not for the town)
  const extra = kind === 'blacksmith' && B.extra ? B.extra : null;
  if (extra) {
    shell.add(extra);
    extra.traverse((m) => {
      if (!m.material) return;
      if (kit.small && m.material.map && m.material.map.image && m.material.map.image.width > 256) halve(m.material.map);
      // (a lit one takes the valley's hill shade now, as the building's own do, so its shader is built once, in the
      // warm-up: left to the valley's later sweep for plain materials, it was built again the first time it was seen,
      // a 50 ms frame on the potato tier)
      const M = m.material;
      if (o.shade && M.isMeshStandardMaterial && !M.userData.sunShade) { M.userData.sunShade = true; M.onBeforeCompile = (sh) => o.shade(sh); M.customProgramCacheKey = () => 'codebuilt-extra+valleyshade'; }
    });
  }
  // THE STAND-INS: a card a little behind each see-through window (and the saloon's open doorways) showing a picture
  // of the inside taken from outside it (objects/codebuildings.js takes them, into the kit's shared sheet), while the
  // inside isn't loaded. Dark until its picture is taken. (With the inside not drawn the far walls' inner faces aren't
  // either: without a card the sky would show through.) A doorway with a door has a plain dark card: seen only while
  // somebody holds its door open with the inside not loaded (a townsperson going in)
  const cardGeos = [], windows = [], o3 = new THREE.Object3D();
  const card = (w, h, c, n, back) => { o3.position.set(c[0] - n.x * back, c[1], c[2] - n.z * back); o3.lookAt(o3.position.clone().add(n)); o3.updateMatrix(); cardGeos.push(new THREE.PlaneGeometry(w, h).applyMatrix4(o3.matrix)); };
  for (const W of B.anchors.seeThrough || []) { const n = new THREE.Vector3(...W.n).normalize(); card(W.w, W.h, W.c, n, 0.25); windows.push({ w: W.w, h: W.h, c: W.c, n: [n.x, n.y, n.z] }); }
  // (the batwings' doorways, and a doorway open for good, with no door to swing (anchors' open: the stable's back doors
  // stand open, part of its walls): seen into as the windows are, a picture of the inside and a view arc of their own;
  // a door's doorway its plain dark card, and one shut for good (the sheriff's back door) too)
  const openWay = (i) => batwings || (!!doorways[i].open && !doors.some((d) => d.way === i));
  doorways.forEach((D, i) => { if (!openWay(i)) return; const n = new THREE.Vector3(...D.out).normalize(); card(D.w * 0.98, D.h * 0.98, D.centre, n, 0.6); windows.push({ w: D.w, h: D.h, c: D.centre, n: [n.x, n.y, n.z], door: true }); });
  doorways.forEach((D, i) => { if (openWay(i)) return; const n = new THREE.Vector3(...D.out).normalize(); card(D.w * 0.98, D.h * 0.98, D.centre, n, 0.6); });   // (after the pictures' cards: they keep cell 0, the dark)
  let cardMesh = null, cardUV = null; const nCards = cardGeos.length;
  const cardMat = kit.standMat.clone(); cardMat.transparent = true; cardMat.depthWrite = false;
  let cardA = 1, cardWait = 0;   // (the pictures' opacity; frames the room has been in, to be sure it is on the card first)
  if (cardGeos.length) {
    const cg = mergeGeometries(cardGeos); for (const g of cardGeos) g.dispose();
    cardUV = cg.attributes.uv.array.slice();   // (each card's own 0..1, to place its picture in the sheet)
    // (its own copy of the stand-ins' material, the sheet shared: its pictures fade out on their own when the room
    // behind them comes in)
    cardMesh = new THREE.Mesh(cg, cardMat); cardMesh.name = 'stand-ins'; cards.add(cardMesh);
  }
  const picture = (i, cell) => {   // (card i shows the sheet's cell: kit.atlas.uv)
    if (!cardMesh) return;
    const [u0, v0, u1, v1] = kit.atlas.uv(cell), uv = cardMesh.geometry.attributes.uv;
    for (let j = i * 4; j < i * 4 + 4; j++) uv.setXY(j, u0 + cardUV[j * 2] * (u1 - u0), v0 + cardUV[j * 2 + 1] * (v1 - v0));
    uv.needsUpdate = true;
  };
  for (let i = 0; i < nCards; i++) picture(i, 0);
  // THE FAR LOOK: the small outside pieces merged (FAR TRIM above); those pieces themselves hide while it shows
  const trimmed = shell.children.filter((m) => m.isMesh && TRIM.has(m.name)), glowMesh = trimmed.find((m) => m.name === 'glow') || null;
  const T = farTrim(mats, trimmed, []);
  let trimMesh = null;
  if (T) { trimMesh = new THREE.Mesh(T.geo, kit.trimMat); trimMesh.name = 'far trim'; trimMesh.castShadow = trimMesh.receiveShadow = true; far.add(trimMesh); }
  // where a walker can stand
  // (the props' solids stand where the props do, in the centred frame: moved back to the build's own)
  const back = new THREE.Matrix4().makeTranslation(-OX, 0, -OZ), propSolids = propSolidsRaw.map((S) => ({ size: S.size, m: back.clone().multiply(S.m) }));
  const foot = B.anchors.footprint, grid = walkGrid([...B.kit.occ, ...propSolids], foot, OX, OZ, B.anchors.floor || 0);
  // every way in can be walked through: a doorway's own width, from just inside to just outside, cleared and its floor
  // eased from the room's down to what is outside (a back door with only stair stones under it read as a ledge)
  for (const D of (B.anchors.doorways || []).filter((q) => !q.inner)) {
    const ox = D.out[0], oz = D.out[2], sx = oz, sz = -ox, half = D.w / 2 - 0.14;
    const fAt = (o2) => { const k = grid.at(D.centre[0] + ox * o2, D.centre[2] + oz * o2); return k < 0 ? 0 : grid.floor[k]; };
    const fin = fAt(-0.6), fout = Math.max(fAt(1.0), 0);
    for (let o2 = -0.6; o2 <= 1.0; o2 += 0.05) for (let a2 = -half; a2 <= half; a2 += 0.05) {
      const k = grid.at(D.centre[0] + ox * o2 + sx * a2, D.centre[2] + oz * o2 + sz * a2); if (k < 0) continue;
      const t = (o2 + 0.6) / 1.6, e = t * t * (3 - 2 * t);
      grid.blocked[k] = 0; grid.wall[k] = 0; grid.floor[k] = fin + (fout - fin) * e;
    }
  }
  // the light it throws out at night: its outdoor lanterns, and a warm pool before each doorway and each window
  const nightLamps = [...outLamps.map((L) => ({ at: L.p, reach: 8, strength: 1 })),
    ...doorways.map((D) => ({ at: [D.centre[0] + D.out[0] * 1.2, 1.4, D.centre[2] + D.out[2] * 1.2], reach: 5.5, strength: 0.45 }))];
  // (the stable's stalls: how much sky and lantern fill each horse gets, from the bake, now: the bake's grid goes after)
  for (const S of B.stalls || []) { const x = S.frontX + S.side * 0.9; S.shade = B.light.skyAt(x, 1.5, S.z) * 1.15; S.fill = B.light.fillAt(x, 1.3, S.z) * 1.3; }
  B.occ = null; B.light.occ = null; B.kit = null;   // (the voxels of the bake, a few MB, no longer wanted)
  const tris = (o3) => { let t = 0; o3.traverse((m) => { if (m.isMesh && m.geometry.index) t += m.geometry.index.count / 3; }); return t; };

  // ── what is drawn: the far look or the whole outside; the inside loaded or not (its stand-ins then); the doors ──────
  let nightNow = 0, flat = null;
  // (the leaves swing as their own meshes only while one is open or opening; shut, they are the shell's again)
  const swinging = () => doors.some((d) => d.t !== d.rest || d.want !== d.rest || d.flap > 0);
  let liveNow = false;
  const show = () => {
    // (far: past the outsides' reach, and its inside not to be seen: not loaded, or loaded behind shut doors)
    const isFar = !out.full && !(out.loaded && out.seen), glowOn = nightNow > GLOW_NIGHT && !!glowMesh;
    liveNow = swinging();
    for (const m of shell.children) {
      if (!m.isMesh) continue;
      let v = true;
      if (TRIM.has(m.name)) v = !isFar || (m === glowMesh && glowOn);
      else if (m.name === 'glass') v = !isFar || nightNow > GLOW_NIGHT;   // (added over what's behind: a few hundredths by day)
      const b = m.userData.base;
      if (b != null) { if (liveNow && b === 0) v = false; m.geometry.setDrawRange(0, liveNow && b > 0 ? b : Infinity); }
      m.visible = v;
    }
    far.visible = isFar;
    if (trimMesh) trimMesh.geometry.setDrawRange(0, glowOn ? T.solid : Infinity);
    if (!(out.loaded && out.seen)) { cardA = 1; cardWait = 0; cardMat.opacity = 1; }
    cards.visible = cardA > 0;
    doorsG.visible = liveNow;
    // (loaded: in the scene, its shaders and buffers ready; drawn only while it can be seen: a door open, the camera
    // inside, or windows to see it through)
    for (let p = 1; p <= 3; p++) { const want = out.loaded && p <= out.level; if (want !== !!ins[p].parent) { if (want) group.add(ins[p]); else group.remove(ins[p]); } ins[p].visible = out.seen; }
    const wantUp = out.loaded && out.upstairs;
    if (wantUp !== !!up.parent) { if (wantUp) group.add(up); else group.remove(up); }
    up.visible = out.seen;
  };
  const out = {
    kind, look, group, B, grid, lamps: B.lamps, uni, mats, nightLamps, sit: B.sit || 0,   // (sit: its zero over the ground at its middle, m)
    full: true, loaded: false, seen: true, level: 3, upstairs: false, hasUpstairs: !!(rooms && up.children.length),
    doors, doorways, windows,
    tris: { shell: tris(shell), inside: ins.reduce((a, g) => a + (g ? tris(g) : 0), 0) + tris(up), props: propTris }, meshes: { shell: 0, inside: 0, props: 0 },
    ms: Math.round(performance.now() - t0), msBake: Math.round(B.msBake),
    // after it is moved: its lanterns' light (worked out in world space) and its painted sign follow
    sync() {
      group.updateMatrixWorld(true);
      // (the shaders' heights are from its ground: the sign's frame without the height)
      uni.uBaseY.value = group.matrixWorld.elements[13];
      uni.uSignInv.value.copy(group.matrixWorld); uni.uSignInv.value.elements[13] = 0; uni.uSignInv.value.invert();
      const v = new THREE.Vector3(), q = new THREE.Quaternion().setFromRotationMatrix(group.matrixWorld);
      B.lamps.forEach((L, i) => {
        if (i >= LAMP_MAX) return;
        uni.uLampP.value[i].copy(v.set(...L.p).applyMatrix4(group.matrixWorld)); uni.uLampS.value[i] = L.strength;
        if (L.dir) { const dd = new THREE.Vector3(...L.dir).applyQuaternion(q); uni.uLampD.value[i].set(dd.x, dd.y, dd.z, 1); }
      });
    },
    // the whole outside (true) or the far look (false: not while the inside is loaded and to be seen)
    setFull(on) { if (out.full !== on) { out.full = on; show(); } },
    // the inside into the scene (true) or out of it: its doors shut first (codebuildings.js sees to that)
    load(on) { if (out.loaded !== on) { out.loaded = on; show(); } },
    setLevel(n) { n = Math.max(1, Math.min(3, Math.round(+n) || 1)); if (out.level !== n) { out.level = n; show(); } },
    setUpstairs(on) { if (out.upstairs !== on) { out.upstairs = on; show(); } },
    // the loaded inside drawn (true) or only kept ready (a building with its doors shut and no windows into it)
    setSeen(on) { if (out.seen !== on) { out.seen = on; show(); } },
    // (a door open, or opening: the batwings, resting open, never count)
    anyOpen: () => doors.some((d) => !d.rest && (d.t > 0 || d.want > 0)),
    batwings,
    // a doorway's leaves to swing open (true) or shut; tick(dt) swings them: true while any door (not the batwings)
    // stands open at all
    openDoor(way, on) { let ch = false; for (const d of doors) if (d.way === way && !d.rest && d.want !== (on ? 1 : 0)) { d.want = on ? 1 : 0; ch = true; } if (ch && swinging() !== liveNow) show(); return ch; },
    doorOpen: (way) => doors.some((d) => d.way === way && !d.rest && d.t > 0),
    // how far a doorway's door stands open, 0 shut .. 1 open (what blocks a walker: objects/codebuildings.js)
    doorAjar: (way) => { let t = 1, n = 0; for (const d of doors) if (d.way === way && !d.rest) { t = Math.min(t, d.t); n++; } return n ? t : 1; },
    hasDoor: (way) => doors.some((d) => d.way === way && !d.rest),
    // the batwings pushed through: they swing in and out and settle open again
    flapDoor(way) { let ch = false; for (const d of doors) if (d.way === way && d.rest) { d.flap = DOOR.flap; ch = true; } if (ch && swinging() !== liveNow) show(); return ch; },
    tick(dt) {
      if (extra && B.tick && shell.visible && group.visible) B.tick(dt);   // (the smithy's smoke rising)
      if (group.visible) for (const S of spins) S.pivot.rotateOnAxis(S.axis, -S.speed * dt);   // (the wind pump's wheel)
      // the stand-ins once the real room is in and drawn: a couple of frames on (its buffers sent, the first frame
      // drawn), then a crossfade out over CARD_FADE s, so the swap reads as the room coming into focus
      if (out.loaded && out.seen && cardA > 0) {
        if (cardWait < 2) cardWait++;
        else { cardA = Math.max(0, cardA - dt / CARD_FADE); cardMat.opacity = cardA; if (cardA <= 0) cards.visible = false; }
      }
      let open = false;
      for (const d of doors) {
        let moved = false;
        if (d.t !== d.want) { d.t = d.want > d.t ? Math.min(1, d.t + dt / DOOR.time) : Math.max(0, d.t - dt / DOOR.time); moved = true; }
        if (d.flap > 0) { d.flap = Math.max(0, d.flap - dt); moved = true; }
        if (moved) place(d);
        if (!d.rest && d.t > 0) open = true;
      }
      if (swinging() !== liveNow) show();
      return open;
    },
    // the stand-in pictures: card i shows the sheet's cell; their tint (the night's: objects/codebuildings.js)
    picture,
    cardTint: (c) => cardMat.color.copy(c),
    cardsShowing: () => cards.visible && cardA > 0,
    // THE FLAT LOOK (the potato tier's far homes, objects/codebuildings.js): the whole outside, the wood too, in plain
    // colours, as one geometry in the building's own frame (made the first time it is asked for)
    flatGeo: () => flat || (flat = (farTrim(mats, shell.children.filter((m) => m.isMesh && (m.name === 'wood' || TRIM.has(m.name)) && m.name !== 'glow'), []) || {}).geo || null),
    // every part of the inside, loaded or not (the shaders built and the pictures taken: objects/codebuildings.js)
    insideRoots: () => [ins[1], ins[2], ins[3], up],
    // night 0 (day) .. 1; on: how lit (0 shut up, 1 open): the lanterns inside lit by day and night while it's open, the
    // outdoor ones and the window panes' glow with the night
    lit(night, on = 1) {
      uni.uNight.value = night; uni.uLamp.value = on > 0.02 ? on : 0; uni.uOutLamp.value = night > 0.3 ? 1 : 0;
      { const was = nightNow > GLOW_NIGHT; nightNow = night; if (was !== night > GLOW_NIGHT) show(); }   // (the far look's windows: FAR TRIM)
      B.lamps.forEach((L, i) => { if (i < LAMP_MAX) uni.uLampS.value[i] = L.outdoor && night <= 0.3 ? 0 : L.strength; });
      if (glowIn) { glowIn.visible = on > 0.02; glowIn.material.opacity = 0.5 + 0.5 * night; }
      if (glowOut) { glowOut.visible = on > 0.02 && night > 0.3; glowOut.material.opacity = 0.5 + 0.5 * night; }
    },
    // the stable's stall boards: [{ slot, owned, label, price, plate }] (a price in chalk, or the brass name plate of a
    // horse that's yours), drawn again in place
    boards(list) { for (const o of list) kit.ART.boards.slotFor(o.slot, o); },
    dispose() {
      const gone = new Set(); if (flat) flat.dispose();
      for (const r of [group, ...out.insideRoots()]) r.traverse((m) => { if (m.geometry && !gone.has(m.geometry)) { gone.add(m.geometry); m.geometry.dispose(); } });
      for (const k in mats) mats[k].dispose(); cardMat.dispose();   // (the far trim's material and the sheet are the kit's, shared: not this building's to drop)
    },
  };
  function place(d) {   // (a leaf where its swing has got to; a batwing's flap swings it in and out, dying away)
    const e = ease(d.t), L = d.L;
    let k = e;
    if (d.flap > 0) { const u = DOOR.flap - d.flap; k = e * (1 - 0.45 * Math.sin(u * Math.PI * 2 * 2.2) * Math.exp(-u * 3.5)); }
    if (L.slide) d.pivot.position.x = L.hinge[0] + L.slide[0] * k; else d.pivot.rotation.y = L.open * k;
  }
  for (const [k, g] of [['shell', shell], ['props', props]]) { let n = 0; g.traverse((m) => { if (m.isMesh || m.isPoints) n++; }); out.meshes[k] = n; }
  for (const r of out.insideRoots()) r.traverse((m) => { if (m.isMesh || m.isPoints) out.meshes.inside++; });
  out.lit(0, 1); show();
  return out;
}
