// INSIDE THE MEDIC SET DOWN ON A PLANET, THE STATION'S LIGHT (src/planet/medicdown.js): its cabin is lit by its own strips
// (its baked light) and, as in the station's hangar, the station's soft fill (src/station.js: 0xdde2e8 over 0x5d6065,
// 0.75); the planet's sun is kept off it (nothing casts a shadow here: it would light the cabin through the hull).
// AND THE PEOPLE IN IT (the crew kit's people: the rescued, the crew aboard, the crew member's own figure) are lit as the
// cabin is while they are inside: the planet's sun off them and its sky's light the station's fill, by how far inside
// they are (0 out on the ground .. 1 in the cabin), and the cabin's own picture of itself for their shine, as in the
// hangar (src/player.js shine). They were lit by the planet's sun through the hull: bright sunlit people in a dim cabin.
//
//   insideLight(mat, U)         a material of the cabin's: always inside (U: FILL_UNIFORMS())
//   const L = peopleLight(c, env)   a crew kit person's materials made to take it (once; made again on their next
//                                   drawing); env: the cabin's picture of itself (boarding's s.cabin.env), or none
//   L.set(k)                    k: 0 outside .. 1 inside (a step at a time: L.to(k, dt) eases there)
import * as THREE from 'three';
import { shine } from '../player.js';

export const INSIDE_FILL = { sky: 0xdde2e8, ground: 0x5d6065, power: 0.75 };
export const FILL_UNIFORMS = () => ({ uFillSky: { value: new THREE.Color(INSIDE_FILL.sky).multiplyScalar(INSIDE_FILL.power) }, uFillGround: { value: new THREE.Color(INSIDE_FILL.ground).multiplyScalar(INSIDE_FILL.power) } });

// the planet's sun off by `sun` (a GLSL float: how much of it is kept off), its sky's light toward the station's fill
function patch(mat, U, key, { pars, sun, fill }) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <lights_pars_begin>', `#include <lights_pars_begin>\nuniform vec3 uFillSky, uFillGround;${pars}\n#if NUM_HEMI_LIGHTS > 0\nHemisphereLight fillOf( HemisphereLight h ) { ${fill} return h; }\n#endif`)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
        .replace('getDirectionalLightInfo( directionalLight, directLight );', `getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= ${sun};`)
        .replace(/getHemisphereLightIrradiance\( hemisphereLights\[ i \], /g, 'getHemisphereLightIrradiance( fillOf( hemisphereLights[ i ] ), '));
  };
  mat.customProgramCacheKey = () => prevKey() + key;
  return mat;
}
export const insideLight = (mat, U) => patch(mat, U, '|medic-inside', { pars: '', sun: '0.0', fill: 'h.skyColor = uFillSky; h.groundColor = uFillGround;' });

export function peopleLight(c, env = null) {
  const U = { ...FILL_UNIFORMS(), uInside: { value: 0 } }, mats = [];
  c.root.traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m && m.isMeshStandardMaterial && !mats.includes(m)) mats.push(m); });
  for (const m of mats) {
    patch(m, U, '|in-a-cabin', { pars: ' uniform float uInside;', sun: '( 1.0 - uInside )', fill: 'h.skyColor = mix( h.skyColor, uFillSky, uInside ); h.groundColor = mix( h.groundColor, uFillGround, uInside );' });
    m.userData.outside = { envMap: m.envMap, shine: m.envMapIntensity };
    m.needsUpdate = true;
  }
  let on = null, k0 = 0;
  const L = {
    set(k) {
      k0 = Math.max(0, Math.min(1, k)); U.uInside.value = k0;
      const inn = k0 > 0.5; if (inn === on) return; on = inn;
      // (their shine: inside, the cabin's picture of itself, as in the hangar; outside, as they were made)
      if (inn && env) shine(c, env);
      else for (const m of mats) { m.envMap = m.userData.outside.envMap || null; m.envMapIntensity = m.userData.baseShine !== undefined ? m.userData.baseShine : m.userData.outside.shine; }
    },
    to(k, dt) { L.set(k + (k0 - k) * Math.exp(-8 * dt)); },
    get k() { return k0; },
  };
  return L;
}
