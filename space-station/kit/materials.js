// THE LOOK: the kit's materials. One draw per material per batch, so the painted parts all share ONE material and
// carry their own colour, roughness, metalness and wear in each vertex; the floors share one atlas; the labels one sheet.
//   solid   every painted or bare-metal part: off-white panels, black satin ribs, gunmetal, yellow, orange, red ...
//   floor   the floor tiles (tread plate, grating, vent, deck) from one atlas
//   decal   stencil labels and marks, tinted by the piece
//   screen  the glowing blue screens
//   glow    the light strips (bright enough for the bloom to catch)
//   glass   windows
// Light: each vertex carries a baked corner darkening (aAO, 0..1) and the strip light that reaches it (aBake, the
// light's irradiance, in the same units as a three.js point light), worked out once when a room is built (bake.js).
import * as THREE from 'three';
import { wearTexture, floorAtlas, decalAtlas, screenAtlas, starSky } from './tex.js';

// the surfaces: [colour (sRGB), roughness, metalness, wear]
export const SURF = {
  white: ['#b7b7b2', 0.6, 0.0, 1.0],     // the matte off-white panels: a neutral, faintly cool grey-white paint
  white2: ['#c4c4bf', 0.56, 0.0, 0.8],   // a lighter panel
  grey2: ['#9c9d9c', 0.55, 0.05, 0.85],   // a mid-grey panel (alternates with the off-white overhead)
  grey: ['#8e9298', 0.5, 0.1, 0.5],
  band: ['#474a4f', 0.48, 0.3, 1.0],     // the dark band across a wall, scuffed
  dark: ['#3f4247', 0.48, 0.3, 0.8],     // dark insets, the backing behind seams
  black: ['#4a4d53', 0.3, 0.45, 0.6],    // satin charcoal metal: ribs, rims, frames (never pure black: its bevels must catch light)
  gun: ['#4a4d53', 0.38, 0.7, 0.5],      // gunmetal
  rail: ['#8d9095', 0.32, 0.8, 0.4],     // bare light-grey metal: walkway rails, clamps
  yellow: ['#c9a032', 0.45, 0.0, 0.4],   // the safety stripe (a muted mustard)
  orange: ['#e3661c', 0.4, 0.0, 0.3],
  red: ['#c4391d', 0.32, 0.05, 0.3],    // (an orange-red)
  chrome: ['#babfc5', 0.16, 0.95, 0.1],
  cable: ['#17181a', 0.6, 0.0, 0.2],
  rubber: ['#0d0e0f', 0.85, 0.0, 0.2],
};
// the glows: linear colours, well over 1 so the bloom picks them out
export const GLOW = { white: [4.6, 4.6, 4.6], strip: [3.0, 3.0, 2.95], flare: [7, 7, 6.9], soft: [1.7, 1.75, 1.85], blue: [1.2, 3.2, 7.0], orange: [7.0, 2.6, 0.6], green: [0.8, 5.0, 1.6], red: [6.5, 0.5, 0.35], amber: [6.5, 4.2, 1.0] };

export const U = { aoDirect: { value: 0.6 }, bakeGain: { value: 1 }, aoStrength: { value: 1 } };

function patch(mat, { rmw = false, inst = false, wear = null } = {}) {
  mat.defines = { ...(mat.defines || {}), ...(rmw ? { KIT_RMW: '' } : {}), ...(inst ? { KIT_INST: '' } : {}) };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWear = { value: wear }; sh.uniforms.uAODirect = U.aoDirect; sh.uniforms.uBakeGain = U.bakeGain; sh.uniforms.uAOStrength = U.aoStrength;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aAO;
#ifdef KIT_RMW
attribute vec3 aRMW;
varying vec3 vRMW;
#endif
#ifdef KIT_INST
attribute vec3 iBake;
#else
attribute vec3 aBake;
#endif
varying float vAO; varying vec3 vBake; varying vec2 vWearUv;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
vAO = aAO; vWearUv = uv;
#ifdef KIT_RMW
vRMW = aRMW;
#endif
#ifdef KIT_INST
vBake = iBake;
#else
vBake = aBake;
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uWear; uniform float uAODirect; uniform float uBakeGain; uniform float uAOStrength;
varying float vAO; varying vec3 vBake; varying vec2 vWearUv;
#ifdef KIT_RMW
varying vec3 vRMW;
#endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
#ifdef KIT_RMW
  vec3 wearT = texture2D( uWear, vWearUv * 0.5 ).rgb;
  float wAmt = vRMW.z, lum0 = dot( diffuseColor.rgb, vec3( 0.3333 ) );
  diffuseColor.rgb *= 1.0 - wAmt * 0.28 * wearT.r;                                      // smudges and grime
  diffuseColor.rgb = mix( diffuseColor.rgb, lum0 < 0.1 ? vec3( 0.16 ) : diffuseColor.rgb * 0.88, wAmt * wearT.g * ( lum0 < 0.1 ? 0.6 : 0.4 ) );  // scuffs: pale on dark paint, faint on light
  diffuseColor.rgb *= 0.965 + 0.07 * wearT.b;                                           // grain
#endif`)
      .replace('#include <roughnessmap_fragment>', `#ifdef KIT_RMW
  float roughnessFactor = clamp( vRMW.x + ( wearT.r * 0.12 + wearT.g * 0.1 ) * vRMW.z, 0.04, 1.0 );
#else
  #include <roughnessmap_fragment>
#endif`)
      .replace('#include <metalnessmap_fragment>', `#ifdef KIT_RMW
  float metalnessFactor = vRMW.y;
#else
  #include <metalnessmap_fragment>
#endif`)
      .replace('#include <aomap_fragment>', `
  float ambientOcclusion = mix( 1.0, vAO, uAOStrength );
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  reflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, uAODirect );
  reflectedLight.directSpecular *= mix( 1.0, ambientOcclusion, uAODirect );
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNVao = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNVao, ambientOcclusion, material.roughness );
  #endif
  // the strips' light, baked into the vertex (its own shadows already in it), with a little of the corner darkening
  reflectedLight.indirectDiffuse += vBake * uBakeGain * BRDF_Lambert( material.diffuseColor ) * mix( 1.0, ambientOcclusion, 0.35 );`);
  };
  mat.customProgramCacheKey = () => 'kit' + (rmw ? 'r' : '') + (inst ? 'i' : '');
  return mat;
}

let SHARED = null;
// the textures are drawn once and shared by every material
export function kitTextures() {
  if (!SHARED) SHARED = { wear: wearTexture(), floor: floorAtlas(), decal: decalAtlas(), screen: screenAtlas(), stars: null };
  return SHARED;
}
export function stars() { const T = kitTextures(); if (!T.stars) T.stars = starSky(); return T.stars; }

export function makeMaterials() {
  const T = kitTextures(), M = {};
  const solid = (inst) => patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }), { rmw: true, inst, wear: T.wear });
  const floor = (inst) => patch(new THREE.MeshStandardMaterial({ map: T.floor.map, normalMap: T.floor.normalMap, roughnessMap: T.floor.roughnessMap, roughness: 1, metalness: 0.65, normalScale: new THREE.Vector2(0.9, 0.9) }), { inst, wear: T.wear });
  const decal = (inst) => patch(new THREE.MeshStandardMaterial({ map: T.decal.map, vertexColors: true, alphaTest: 0.45, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), { inst, wear: T.wear });
  M.solid = solid(false); M.solidInst = solid(true);
  M.floor = floor(false); M.floorInst = floor(true);
  M.decal = decal(false); M.decalInst = decal(true);
  M.screen = new THREE.MeshBasicMaterial({ map: T.screen.map, vertexColors: true });
  M.screenInst = M.screen;
  M.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  M.glowInst = M.glow;
  M.glass = new THREE.MeshStandardMaterial({ color: 0x0b141d, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 0.35 });
  M.glassInst = M.glass;
  for (const [k, m] of Object.entries(M)) m.name = k;
  return M;
}
// the materials a piece can draw with, in the order the batch draws them
export const MAT_KEYS = ['solid', 'floor', 'decal', 'screen', 'glow', 'glass'];
// which ones take the baked light (the rest glow on their own or are see-through)
export const BAKED = new Set(['solid', 'floor', 'decal']);
