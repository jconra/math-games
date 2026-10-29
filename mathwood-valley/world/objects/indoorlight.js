// INDOOR LIGHT: people and animals lit like the room round them. A code-built building's inside is lit by its own
// lanterns and a baked share of the sky through its doors and windows (labs/buildings/parts.js Light, lit); people and
// animals only had the open sky and the sun, so by lamplight they stood in a warm hall as dark shapes (the game's maker:
// "the light inside the saloon doesn't have any effect on the human models", "the horses don't respond to lantern
// light"). Here the insides that are loaded hand their rooms (each a box in its building's frame) and their lanterns to
// a few uniforms every material below shares; the shader works out, pixel by pixel, how far inside a room the pixel is
// (fading in over SOFT metres from the walls, so someone in a doorway is half lit by each), and there the sun is gone,
// the sky's light is turned down to the room's share of it, and the room's lanterns light it, with the same falloff and
// colour as they light the walls. No light per person or animal, nothing to track: whoever stands inside is lit.
//
//   IN_U                          the shared uniforms (each patched material takes these very objects)
//   indoorPre(sh), indoorPost(sh)  the shader patch, in two halves: before and after any other lights patch that
//                                 expands three's lights chunk (the valley's hill shade); a material with none calls
//                                 both in turn. Its program cache key wants INDOOR_KEY added
//   makeIndoorLight() -> { update(placed, camera) }   each frame: the loaded insides nearest the camera (up to ROOMS)
//                                 and their lanterns into IN_U. placed: the code buildings' objects ({ code })
//   INDOOR                        the dials
import * as THREE from 'three';
import { LU, LAMP_REACH } from '../../labs/buildings/parts.js';

export const INDOOR = {
  rooms: 4,          // insides at once (the nearest loaded ones)
  lamps: 12,         // their lanterns at once (the nearest)
  soft: 0.35,        // metres in from the walls over which the room's light comes in
  sky: 0.42,         // the room's share of the sky's light (the walls' own: the bake's, about this in a lit hall)
  scan: 0.25,        // metres between the points a room's box is measured at
  off: false,        // (rigs: true leaves every room out: the light as it was before, for a picture to compare)
};
export const INDOOR_KEY = '+indoor1';
export const IN_U = {
  uInN: { value: 0 },
  uInM: { value: Array.from({ length: INDOOR.rooms }, () => new THREE.Matrix4()) },   // the world to each room's box (its middle at 0)
  uInH: { value: Array.from({ length: INDOOR.rooms }, () => new THREE.Vector4()) },   // its half sizes (xyz), its sky share (w)
  uInP: { value: Array.from({ length: INDOOR.lamps }, () => new THREE.Vector4(0, -99, 0, 0)) },   // a lantern: where (xyz), how strong (w)
  uInD: { value: Array.from({ length: INDOOR.lamps }, () => new THREE.Vector4(0, -1, 0, 0)) },    // a shaded lamp's way down (w 1)
  uInCol: LU.uLampCol,                                                                            // their colour (the walls')
};
const R2 = (LAMP_REACH * LAMP_REACH).toFixed(2);
const PRE = `
// INDOOR LIGHT (world/objects/indoorlight.js): how far inside a room this pixel is
float inK = 0.0, inSky = 1.0; vec3 inW = cameraPosition + (-vViewPosition) * mat3(viewMatrix);
for (int i = 0; i < ${INDOOR.rooms}; i++) {
  if (i >= uInN) break;
  vec3 inQ = (uInM[i] * vec4(inW, 1.0)).xyz, inE = uInH[i].xyz - abs(inQ);
  float k = clamp(min(min(inE.x, inE.z), inE.y) / ${INDOOR.soft.toFixed(3)}, 0.0, 1.0);
  if (k > inK) { inK = k; inSky = uInH[i].w; }
}
`;
const POST = `
if (inK > 0.0) {
  float inS = mix(1.0, inSky, inK); reflectedLight.indirectDiffuse *= inS; reflectedLight.indirectSpecular *= inS;
  vec3 inN = inverseTransformDirection(normal, viewMatrix); float inL = 0.0;
  for (int i = 0; i < ${INDOOR.lamps}; i++) {
    vec3 L = uInP[i].xyz - inW; float d2 = dot(L, L);
    if (d2 > ${R2} || uInP[i].w <= 0.0) continue;
    float d = sqrt(d2) + 1e-4, f = 1.0 - d2 / ${R2}; f *= f;
    float spot = mix(1.0, smoothstep(0.5, 0.75, dot(-L / d, uInD[i].xyz)), uInD[i].w);
    inL += uInP[i].w * f / (1.0 + d2 * 1.1) * max(0.02, (dot(inN, L / d) + 0.1) / 1.1) * spot;
  }
  reflectedLight.directDiffuse += diffuseColor.rgb * uInCol * (inL * inK);
}
`;
const SUN = 'getDirectionalLightInfo( directionalLight, directLight );';
export function indoorPre(sh) {
  Object.assign(sh.uniforms, IN_U);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\nuniform int uInN; uniform mat4 uInM[${INDOOR.rooms}]; uniform vec4 uInH[${INDOOR.rooms}]; uniform vec4 uInP[${INDOOR.lamps}]; uniform vec4 uInD[${INDOOR.lamps}]; uniform vec3 uInCol;`)
    .replace('#include <lights_fragment_begin>', PRE + '#include <lights_fragment_begin>');
}
export function indoorPost(sh) {
  let fs = sh.fragmentShader;
  if (fs.includes('#include <lights_fragment_begin>')) fs = fs.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin);
  // (no sun indoors; the sky and the lanterns as the room has them)
  sh.fragmentShader = fs.replace(SUN, SUN + ' directLight.color *= 1.0 - inK;')
    .replace('vec3 totalDiffuse = reflectedLight.directDiffuse', POST + 'vec3 totalDiffuse = reflectedLight.directDiffuse');
}

// a building's rooms as one box in its own frame (the points its own bake calls indoors, at a person's height, and up
// to its ceilings), worked out the first time it is wanted; null: none (no inside test, nothing indoors)
function roomBox(o) {
  if (o.inBox !== undefined) return o.inBox;
  const C = o.code, B = C && C.B, inside = B && B.light && B.light.inside;
  o.inBox = null;
  if (!inside) return null;
  const OX = B.offset || 0, OZ = B.offsetZ || 0, fl = B.anchors && typeof B.anchors.floor === 'number' ? B.anchors.floor : 0.3;
  const F = B.anchors && B.anchors.footprint, half = F ? Math.max(F.w || 0, F.d || 0) / 2 + 1 : 12, s = INDOOR.scan;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, n = 0;
  const y = fl + 1.0;
  try {
    for (let x = -half; x <= half; x += s) for (let z = -half; z <= half; z += s) if (inside(x - OX, y, z - OZ)) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  } catch (e) { return null; }
  if (n < 4) return null;
  // (up to its ceilings, at the room's middle and a little either side: the highest still indoors)
  let top = y;
  for (const [cx, cz] of [[(x0 + x1) / 2, (z0 + z1) / 2], [x0 * 0.7 + x1 * 0.3, (z0 + z1) / 2], [x0 * 0.3 + x1 * 0.7, (z0 + z1) / 2]]) {
    for (let yy = y; yy < y + 12; yy += 0.25) { if (inside(cx - OX, yy, cz - OZ)) top = Math.max(top, yy); else if (yy > top + 1) break; }
  }
  // (the box reaches past the walls by a scan's half, and well under the floor, so feet stand fully inside)
  const pad = s / 2, bottom = fl - 1.5;
  o.inBox = { c: [(x0 + x1) / 2, (bottom + top + pad) / 2, (z0 + z1) / 2], h: [(x1 - x0) / 2 + pad, (top + pad - bottom) / 2, (z1 - z0) / 2 + pad] };
  return o.inBox;
}

export function makeIndoorLight() {
  const M = new THREE.Matrix4(), T = new THREE.Matrix4(), cands = [], lamps = [];
  return {
    update(placed, camera) {
      if (INDOOR.off) { IN_U.uInN.value = 0; return; }
      const cp = camera.position;
      cands.length = 0;
      for (const o of placed) {
        const C = o.code; if (!C || !C.loaded) continue;
        const box = roomBox(o); if (!box) continue;
        const q = o.q, d = q ? Math.hypot(cp.x - q.x, cp.z - q.z) : 0;
        cands.push({ o, box, d });
      }
      cands.sort((a, b) => a.d - b.d);
      const n = Math.min(INDOOR.rooms, cands.length);
      IN_U.uInN.value = n; lamps.length = 0;
      for (let i = 0; i < n; i++) {
        const { o, box } = cands[i], g = o.code.group, U = o.code.uni, L = o.code.lamps || [];
        g.updateMatrixWorld();
        M.multiplyMatrices(g.matrixWorld, T.makeTranslation(box.c[0], box.c[1], box.c[2])).invert();
        IN_U.uInM.value[i].copy(M); IN_U.uInH.value[i].set(box.h[0], box.h[1], box.h[2], INDOOR.sky);
        // its lanterns, as its walls have them now (lit or out, how bright), the outdoor ones left out
        const k = (U.uLamp.value || 0) * (U.uLampGain.value || 1);
        if (k > 0) for (let j = 0; j < Math.min(L.length, U.uLampP.value.length); j++) {
          if (L[j].outdoor || !(U.uLampS.value[j] > 0)) continue;
          const p = U.uLampP.value[j];
          lamps.push({ p, s: U.uLampS.value[j] * k, d: U.uLampD.value[j], dd: (p.x - cp.x) ** 2 + (p.y - cp.y) ** 2 + (p.z - cp.z) ** 2 });
        }
      }
      lamps.sort((a, b) => a.dd - b.dd);
      for (let j = 0; j < INDOOR.lamps; j++) {
        const L = lamps[j];
        if (L) { IN_U.uInP.value[j].set(L.p.x, L.p.y, L.p.z, L.s); IN_U.uInD.value[j].copy(L.d); } else IN_U.uInP.value[j].set(0, -99, 0, 0);
      }
    },
    state: () => ({ rooms: IN_U.uInN.value, lamps: IN_U.uInP.value.filter((v) => v.w > 0).length }),
  };
}
