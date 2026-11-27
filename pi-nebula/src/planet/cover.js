// WHAT STANDS ON THE GROUND: rocks, and on the worlds with air, plants. Only near the camera (each kind out to its
// own distance, shrinking away to nothing at its edge, so nothing pops), laid out again as the camera moves on.
// Each patch of ground (8 m square) always gets the same things in the same places: they are worked out from the
// patch's own number, which repeats as the ground does.
//
// THE ROCKS are made here in code (no model needed): lumpy, flattened balls, four shapes, as the Terrain Lab's own
// rocks are made (jconra.com's src/valley.js stoneShapes). Small stones everywhere, more where the ground is rocky;
// on the moon, boulders thrown out round the young craters' rims.
//
// THE PLANTS are the Terrain Lab's sixteen ground plants (its sheet, assets/planet/groundPlants.glb, the game's maker's
// picks in his Plant Lab), cut apart the Terrain Lab's way (src/valley.js loadSheet), then grown to their own size
// for each planet (some far bigger than a person) and recoloured: each plant's hue turned round to one of the planet's
// leaf colours (kinds.js palette), more vivid, each one a little different. They sway a little in the wind.
//
// Everything here is lit the way the ground is: the sun and the sky's light (src/planet/planet.js), the ground's own
// shadows and hollows from its light picture where each thing stands, the same planet's curve, the same haze.
//
//   const cover = await makeCover({ land, look, ground, quality, sky })
//   cover.group; cover.update(camera, dt); cover.stats { rocks, plants, tris }; cover.dispose()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SKY_GLSL } from './cloudSky.js';
import { HAZE_GLSL } from './ground.js';
import { PLANTS, PLANT_SINK } from './kinds.js';
import { hash2 } from './noise.js';
import { wrapD } from './land.js';
import { lookOff } from './kinds.js';

const CELL = 8;
// no boulder stands on the landing place, nor within a few metres of its edge (the mark eases out over 52 m past its
// edge: src/planet/land.js; 0.92 is about 4 m past it)
const CLEAR = 0.92;
// THE LANDING PLACE NOT A BARE CLEARING (two critics: plants and rocks began 15 to 30 m away, a cleared stage): the
// small stones and the plants up to `tall` metres grow on it as anywhere, but for where the ship sets down (within `pad` metres of its
// middle) and what is kept clear under the wreck, the pods and the way to them (the full mark: src/planet/wreck.js)
export const CLEARING = { pad: 11, kept: 0.999, tall: 1.35, gaps: 0.45, least: 0.2, thin: 0.6 };
// per tier: how far out (times each kind's own reach) and how many (times its own number)
export const COVER_QUALITY = { low: { reach: 0.6, many: 0.3, detail: 0 }, medium: { reach: 0.8, many: 0.5, detail: 1 }, high: { reach: 1, many: 1, detail: 1 } };

// ── rocks, made in code ──────────────────────────────────────────────────────────────────────────────────────────
function rockShapes(detail) {
  const out = [];
  for (let v = 0; v < 4; v++) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, seen = new Map();
    for (let k = 0; k < p.count; k++) {
      const key = p.getX(k).toFixed(3) + ',' + p.getY(k).toFixed(3) + ',' + p.getZ(k).toFixed(3);   // (shared corners move together, so the rock stays closed)
      // (a lump: a slow swell over it and a little roughness, rather than every corner its own: those were plain facets)
      if (!seen.has(key)) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k); seen.set(key, 0.82 + 0.16 * Math.sin(x * 2.3 + v * 1.7) * Math.cos(z * 1.9 - y * 1.3 + v) + 0.1 * Math.sin((x + z) * 3.1 + v * 2.2) + 0.12 * (hash2(k * 7 + v * 131, seen.size * 13 + v, 5) - 0.5)); }
      const f = seen.get(key); p.setXYZ(k, p.getX(k) * f * (1 + 0.25 * v / 3), p.getY(k) * f * (0.5 + 0.08 * v), p.getZ(k) * f);
    }
    g.computeVertexNormals();
    // (a darker underside, where it meets the ground: the corners' colour by height)
    const c = new Float32Array(p.count * 3); for (let k = 0; k < p.count; k++) { const y = p.getY(k), s = 0.45 + 0.55 * Math.min(1, Math.max(0, (y + 0.25) / 0.6)); c[k * 3] = c[k * 3 + 1] = c[k * 3 + 2] = s; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    out.push(g);
  }
  return out;
}

// ── the Terrain Lab's plant sheet, cut into its sixteen plants ───────────────────────────────────────────────────
let sheetPromise = null;
// the sheet, fetched now if a kind of world has plants (while its ground is being made: src/planet/planet.js)
export function preloadPlants(kind) { if (kind && kind.cover.plants.length) loadSheet().catch(() => { sheetPromise = null; }); }
function loadSheet() {
  if (sheetPromise) return sheetPromise;
  sheetPromise = new Promise((ok, bad) => new GLTFLoader().load(new URL('../../assets/planet/groundPlants.glb', import.meta.url).href, ok, undefined, bad)).then((g) => {
    let src = null; g.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
    src.updateMatrixWorld(true);
    const geo0 = src.geometry.index ? src.geometry.toNonIndexed() : src.geometry.clone(); geo0.applyMatrix4(src.matrixWorld);
    geo0.computeBoundingBox();
    const grid = 4, cw = 0.5, ch = 1.0, bb = geo0.boundingBox, pos = geo0.attributes.position; bb.min.x = 0; bb.max.y = grid * ch;
    const buckets = Array.from({ length: grid * grid }, () => []);
    for (let t = 0; t < pos.count; t += 3) {
      const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3, cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
      buckets[Math.min(grid - 1, Math.floor((bb.max.y - cy) / ch)) * grid + Math.min(grid - 1, Math.floor((cx - bb.min.x) / cw))].push(t);
    }
    const attrs = Object.keys(geo0.attributes);
    const parts = buckets.map((tris, k) => {
      const gg = new THREE.BufferGeometry();
      for (const a of attrs) { const A = geo0.attributes[a], n = A.itemSize, arr = new Float32Array(tris.length * 3 * n); tris.forEach((t, q) => { for (let v = 0; v < 3; v++) for (let c = 0; c < n; c++) arr[(q * 3 + v) * n + c] = A.array[(t + v) * n + c]; }); gg.setAttribute(a, new THREE.BufferAttribute(arr, n)); }
      gg.computeBoundingBox(); const b = gg.boundingBox; gg.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      const h = b.max.y - b.min.y || 1; gg.scale(1 / h, 1 / h, 1 / h);     // (one metre tall: each is grown to its own size where it stands)
      // the grasses and flowers lit like the ground (every face as if up), the bigger plants by their own shape, softened
      const nr = gg.attributes.normal, lit = PLANTS[k].lit;
      for (let q = 0; q < nr.count; q++) { if (lit) { const x = nr.getX(q) * 0.65, y = nr.getY(q) * 0.65 + 0.35, z = nr.getZ(q) * 0.65, l = Math.hypot(x, y, z) || 1; nr.setXYZ(q, x / l, y / l, z / l); } else nr.setXYZ(q, 0, 1, 0); }
      return gg;
    });
    const map = src.material.map; if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
    return { parts, map };
  });
  return sheetPromise;
}

// ── THE RECOLOURING, shared by the plants and the trees (src/planet/trees.js, its near models and its far pictures) ─
// a colour's hue turned round to the planet's own (the turn round the grey axis that a picture's "hue rotate" is), then
// more vivid (sat), keeping how light each part of it was, then lighter or darker (light); hue in radians
export const TURN_GLSL = /* glsl */`
vec3 planetTurn(vec3 c, float hue, float sat, float light) {
  float cs = cos(hue), sn = sin(hue);
  mat3 turn = mat3(0.213 + 0.787 * cs - 0.213 * sn, 0.213 - 0.213 * cs + 0.143 * sn, 0.213 - 0.213 * cs - 0.787 * sn,
                   0.715 - 0.715 * cs - 0.715 * sn, 0.715 + 0.285 * cs + 0.140 * sn, 0.715 - 0.715 * cs + 0.715 * sn,
                   0.072 - 0.072 * cs + 0.928 * sn, 0.072 - 0.072 * cs - 0.283 * sn, 0.072 + 0.928 * cs + 0.072 * sn);
  c = max(turn * c, vec3(0.0)); float Y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return max(mix(vec3(Y), c, sat), vec3(0.0)) * light;
}`;
// the same on the page (linear r, g, b), for a colour worked out once (the far woods' colour on the ground)
export function planetTurn([r, g, b], hue, sat, light) {
  const cs = Math.cos(hue), sn = Math.sin(hue);
  const c = [
    Math.max(0, (0.213 + 0.787 * cs - 0.213 * sn) * r + (0.715 - 0.715 * cs - 0.715 * sn) * g + (0.072 - 0.072 * cs + 0.928 * sn) * b),
    Math.max(0, (0.213 - 0.213 * cs + 0.143 * sn) * r + (0.715 + 0.285 * cs + 0.140 * sn) * g + (0.072 - 0.072 * cs - 0.283 * sn) * b),
    Math.max(0, (0.213 - 0.213 * cs - 0.787 * sn) * r + (0.715 - 0.715 * cs + 0.715 * sn) * g + (0.072 + 0.928 * cs + 0.072 * sn) * b)];
  const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return c.map((v) => Math.max(0, Y + (v - Y) * sat) * light);
}
// the hue of a colour (degrees), for the plants' turn: green leaves (about 100) turned to the planet's leaf colour
export const LEAF_HUE = 95;
// a leaf colour of the palette as the turn's numbers
export const turnOf = (lf) => ({ hue: (lf.hue - LEAF_HUE) * Math.PI / 180, sat: lf.sat, light: lf.light });
// THE HAZE'S COLOUR in front of what stands on the ground: the sky's, looking that way but no higher than the horizon
// (the haze lies along the ground; the clouds are far above it). So the sky's clouds are never worked out for it: for a
// tree's crown above the horizon they were twenty noise readings for every leaf, and a wood is leaves over leaves.
export const HAZE_SKY_GLSL = /* glsl */`
vec3 hazeSky(vec3 p) { vec3 d = normalize(p - cameraPosition); return skyAt(cameraPosition, normalize(vec3(d.x, min(d.y, 0.0) - 0.001, d.z))); }`;

// THE ROCKS' LOOK (two critics: plain faceted lumps in the ground's own colour): a shade darker than the rock the ground
// is painted with, each its own, and a surface of their own
export const ROCK_LOOK = { dark: 0.35, shade: [0.62, 0.38] };
const STONE_GLSL = `{
  vec3 q = vPlace * 2.7; vec3 i = floor(q), t = fract(q); t = t * t * (3.0 - 2.0 * t);
  #define H3(o) fract(sin(dot(i + o, vec3(12.99, 78.23, 37.71))) * 43758.55)
  float a = mix(mix(mix(H3(vec3(0, 0, 0)), H3(vec3(1, 0, 0)), t.x), mix(H3(vec3(0, 1, 0)), H3(vec3(1, 1, 0)), t.x), t.y),
                mix(mix(H3(vec3(0, 0, 1)), H3(vec3(1, 0, 1)), t.x), mix(H3(vec3(0, 1, 1)), H3(vec3(1, 1, 1)), t.x), t.y), t.z);
  vec3 q2 = vPlace * 11.0; float b = fract(sin(dot(floor(q2), vec3(7.13, 157.1, 113.7))) * 4375.85);
  diffuseColor.rgb *= 0.72 + 0.45 * a + 0.16 * (b - 0.5);
  #undef H3
}`;

// ── the shared shader changes: where it stands on the light picture, the curve, the fade at its edge, the haze ───
// plant: recoloured ({ hue, sat, light, sway, clock } as uniforms); fade: a dithered fade by its own iFade (0..1), for
// the trees' crossfade with their far pictures; soften (0..1): its normals bent this far toward up (the Terrain Lab's
// trees' leaves, so the half of them facing away from the sun don't read as black)
export function onGround(material, { ground, sky, reach, plant = null, fade = false, soften = 0, stone = false }) {
  const U = ground.U;
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uL: U.uL, uP: U.uP, uN: U.uN, uCam: U.uCam, uCurve: U.uCurve, uHaze: U.uHaze, uHazeH: U.uHazeH, uHazeBase: U.uHazeBase, uReach: { value: reach }, uClock: plant ? plant.clock : { value: 0 } });
    if (sky) Object.assign(sh.uniforms, sky.uniforms);
    if (plant) Object.assign(sh.uniforms, { uHue: plant.hue, uSat: plant.sat, uLight: plant.light, uSway: plant.sway });
    sh.vertexShader = `uniform sampler2D uL; uniform float uP, uN, uCurve, uReach, uClock; uniform vec3 uCam;
      ${plant ? 'uniform float uSway;' : ''}${fade ? 'attribute float iFade; varying float vFade;' : ''}
      varying float vSun, vSky; varying vec3 vPlace;\n` + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 at = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        vec2 dc = at.xz - uCam.xz; float dd = length(dc);
        transformed *= 1.0 - smoothstep(uReach * 0.78, uReach, dd);          // shrinking away at its edge
        ${plant ? 'transformed.xz += vec2(sin(uClock * 1.3 + at.x * 0.21), cos(uClock * 1.1 + at.z * 0.19)) * uSway * position.y * position.y;' : ''}
        ${fade ? 'vFade = iFade;' : ''}
        vec4 ls = texture2D(uL, (at.xz + 0.5 * uP) / uP + 0.5 / uN); vSun = ls.r; vSky = ls.g;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0); vec2 d = wp.xz - uCam.xz; vPlace = wp.xyz;
          mvPosition.xyz -= (viewMatrix * vec4(0.0, dot(d, d) * uCurve, 0.0, 0.0)).xyz; gl_Position = projectionMatrix * mvPosition; }`);
    let f = 'varying float vSun, vSky; varying vec3 vPlace;\n' + (fade ? 'varying float vFade;\n' : '') + (plant ? 'uniform float uHue, uSat, uLight;\n' + TURN_GLSL + '\n' : '') + (sky ? SKY_GLSL + HAZE_GLSL : '') + sh.fragmentShader;
    f = f.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
      .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= vSun;')
      .replace(/irradiance \+= getHemisphereLightIrradiance/g, 'irradiance += vSky * getHemisphereLightIrradiance'));
    // (a leaf seen from behind is lit as from in front: the Terrain Lab's own way with these plants; softened: bent up)
    if (plant || soften) f = f.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0')
      + (soften ? `\nnormal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), ${soften.toFixed(2)}));` : ''));
    if (plant) f = f.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = planetTurn(diffuseColor.rgb, uHue, uSat, uLight);');
    // (a stone's own surface: mottled and pitted at two sizes, by where on it each point is)
    if (stone) f = f.replace('#include <color_fragment>', '#include <color_fragment>\n' + STONE_GLSL);
    // (the far one's complement: where this one is drawn the far picture isn't, so in the crossfade every pixel is one or the other)
    if (fade) f = f.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n{ float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (vFade < dither) discard; }');
    // the haze, mixed in as the ground and the sky mix theirs: before the colours are turned into the screen's
    if (sky) f = f.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeSky(vPlace), hazeAmt(cameraPosition, vPlace));\n#include <tonemapping_fragment>');
    if (sky) f = f.replace('void main() {', HAZE_SKY_GLSL + '\nvoid main() {');
    sh.fragmentShader = f;
  };
  material.customProgramCacheKey = () => 'planet-cover-2' + (plant ? '-plant' : '') + (sky ? '-air' : '') + (fade ? '-fade' : '') + (soften ? '-s' + soften : '') + (stone ? '-stone' : '');
  return material;
}

// the order to visit the patches round the camera: nearest first (so with too many, the furthest go)
function ringOrder(r) {
  const n = Math.ceil(r / CELL) + 1, out = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const d = Math.hypot(i, j) * CELL; if (d <= r + CELL) out.push([i, j, d]); }
  return out.sort((a, b) => a[2] - b[2]);
}

export async function makeCover({ land, look, ground, quality = 'medium', sky = null }) {
  const t0 = performance.now(), Q = COVER_QUALITY[quality] || COVER_QUALITY.medium, K = land.kind, C = K.cover, P = land.width, wrapN = P / CELL;
  const group = new THREE.Group(); group.name = 'planet:cover';
  const layers = [], dummy = new THREE.Object3D(), col = new THREE.Color();
  const L0 = land.landing, keptClear = lookOff('clearing') ? (x, z) => land.landingAt(x, z) > CLEAR : (x, z) => land.landingAt(x, z) > CLEARING.kept || Math.hypot(wrapD(x - L0.x, P), wrapD(z - L0.z, P)) < CLEARING.pad;
  const srgb = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  const stats = { rocks: 0, plants: 0, tris: 0, buildMs: 0, layers: 0 };
  // a layer: one InstancedMesh for each of its shapes, laid out round the camera out to `reach` metres
  function layer({ name, shapes, material, reach, most, lay }) {
    const meshes = shapes.map((g) => { const m = new THREE.InstancedMesh(g, material, most); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(m); return m; });
    for (const m of meshes) m.setColorAt(0, col.set(1, 1, 1));
    const L = { name, meshes, reach, most, lay, order: ringOrder(reach), tris: shapes.map((g) => (g.index ? g.index.count : g.attributes.position.count) / 3), count: 0 };
    layers.push(L); return L;
  }
  // put an instance in a layer's shape s
  // (the layer's own number is for all its shapes together: past it, the furthest are left out)
  const put = (L, s, x, y, z, scale, yaw, tilt, shade) => {
    const m = L.meshes[s]; if (L.placed >= L.most) return false;
    L.placed++;
    dummy.position.set(x, y, z); dummy.rotation.set(tilt * Math.cos(yaw * 3), yaw, tilt * Math.sin(yaw * 2)); dummy.scale.set(scale, scale, scale); dummy.updateMatrix();
    m.setMatrixAt(m.count, dummy.matrix); m.setColorAt(m.count, shade); m.count++; return true;
  };

  // ── the rocks ──────────────────────────────────────────────────────────────────────────────────────────────────
  // (the boulders rounder on the best quality: four times the triangles, a few hundred of them near the camera)
  const rockShapesG = rockShapes(Q.detail), boulderShapesG = Q.detail && quality === 'high' && !lookOff('rocks') ? rockShapes(2) : rockShapesG, rockCol = srgb(look.rock), dustCol = srgb(look.dust), darkCol = srgb(look.dark || look.rock);
  const stoneReach = 70 * Q.reach, boulderReach = 260 * Q.reach;
  const rockMat = onGround(new THREE.MeshLambertMaterial({ vertexColors: true }), { ground, sky, reach: stoneReach, stone: !lookOff('rocks') });
  const boulderMat = onGround(new THREE.MeshLambertMaterial({ vertexColors: true }), { ground, sky, reach: boulderReach, stone: !lookOff('rocks') });
  // small stones: everywhere a few, more where it is rocky
  const stones = layer({ name: 'stones', shapes: rockShapesG, material: rockMat, reach: stoneReach, most: Math.round(2200 * Q.many), lay: (L, cx, cz, ci, cj, wi, wj) => {
    const rock = land.rockAt(cx, cz), n = Math.floor((0.7 + rock * 4.5) * C.rocks.many * Q.many * 1.6 + hash2(wi, wj, 77));
    for (let q = 0; q < n; q++) {
      const x = cx + (hash2(wi, wj, 100 + q) - 0.5) * CELL, z = cz + (hash2(wi, wj, 200 + q) - 0.5) * CELL;
      if (keptClear(x, z)) continue;
      const s = 0.08 + 0.45 * Math.pow(hash2(wi, wj, 300 + q), 3), y = land.heightAt(x, z) - s * 0.18;
      col.copy(rockCol).lerp(darkCol, ROCK_LOOK.dark).lerp(dustCol, hash2(wi, wj, 400 + q) * 0.3).multiplyScalar(ROCK_LOOK.shade[0] + ROCK_LOOK.shade[1] * hash2(wi, wj, 500 + q));
      if (!put(L, q & 3, x, y, z, s, hash2(wi, wj, 600 + q) * 6.28, 0.3, col)) return;
    }
  } });
  // boulders: round the young craters' rims (the moon), on the rocky ground (anywhere)
  const boulderAt = new Map();
  for (const c of land.craters) {
    const n = Math.min(40, Math.round(c.r * 0.5));
    for (let q = 0; q < n; q++) {
      const a = hash2(Math.round(c.x), Math.round(c.z), q) * 6.283, d = c.r * (0.75 + 0.9 * Math.pow(hash2(Math.round(c.z), Math.round(c.x), q + 50), 0.6));
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, ii = Math.floor((x + P / 2) / CELL), jj = Math.floor((z + P / 2) / CELL);
      const key = ((ii % wrapN) + wrapN) % wrapN + ',' + ((jj % wrapN) + wrapN) % wrapN;
      const size = Math.max(0.3, c.r * (0.012 + 0.05 * Math.pow(hash2(q, Math.round(c.x), 9), 3)));
      if (!boulderAt.has(key)) boulderAt.set(key, []);
      // (kept as where in its patch it lies)
      boulderAt.get(key).push([x + P / 2 - ii * CELL, z + P / 2 - jj * CELL, Math.min(size, 3.2), q]);
    }
  }
  const boulders = layer({ name: 'boulders', shapes: boulderShapesG, material: boulderMat, reach: boulderReach, most: Math.round(1400 * Q.many), lay: (L, cx, cz, ci, cj, wi, wj) => {
    const x0 = cx - CELL / 2, z0 = cz - CELL / 2, list = (boulderAt.get(wi + ',' + wj) || []).slice();
    const rock = land.rockAt(cx, cz);
    // (the rocky ground's own, now and then)
    if (hash2(wi, wj, 901) < (0.015 + rock * (C.rocks.near === 'craters' ? 0.08 : 0.35)) * C.rocks.many) list.push([hash2(wi, wj, 902) * CELL, hash2(wi, wj, 903) * CELL, 0.5 + 2.2 * Math.pow(hash2(wi, wj, 904), 2), 7]);
    for (const [ox, oz, s, q] of list) {
      const x = x0 + ox, z = z0 + oz;
      if (land.landingAt(x, z) > CLEAR) continue;
      const y = land.heightAt(x, z) - s * 0.22;
      col.copy(rockCol).lerp(darkCol, ROCK_LOOK.dark).multiplyScalar(ROCK_LOOK.shade[0] + ROCK_LOOK.shade[1] * hash2(wi + q, wj, 31));
      if (!put(L, (q + wi) & 3, x, y, z, s, hash2(wi, wj + q, 32) * 6.28, 0.25, col)) return;
    }
  } });

  // ── the plants ─────────────────────────────────────────────────────────────────────────────────────────────────
  let sheet = null;
  const clock = { value: 0 }, plantMats = [];
  if (C.plants.length) {
    sheet = await loadSheet();
    const leaves = look.leaves || [{ hue: 300, sat: 1.3, light: 1 }];
    // a layer for the plants close by (grasses and flowers) and one for the big ones seen further off
    for (const far of [false, true]) {
      const list = C.plants.filter((p) => !!p.far === far); if (!list.length) continue;
      // (each plant is 300 to 900 triangles: a phone affords about a thousand near the camera, so the close ones are
      // kept to the nearest 40 m and the ground's own colour carries the meadow on beyond them)
      const reach = (far ? 240 : 40) * Q.reach, most = Math.round((far ? 600 : 900) * Q.many);
      // (each plant its own material: its own colour turned to, sharing one shader)
      const ms = list.map((p) => { const t = turnOf(leaves[p.leaf] || leaves[0]);
        return onGround(new THREE.MeshLambertMaterial({ map: sheet.map, side: THREE.DoubleSide }), { ground, sky, reach, plant: { hue: { value: t.hue }, sat: { value: t.sat }, light: { value: t.light }, sway: { value: sky ? 0.035 : 0 }, clock } }); });
      const L = layer({ name: far ? 'big plants' : 'plants', shapes: list.map((p) => sheet.parts[p.k]), material: ms[0], reach, most, lay: null });
      L.meshes.forEach((m, s) => { m.material = ms[s]; });
      plantMats.push(...ms);
      const total = list.reduce((s, p) => s + p.share, 0);
      L.lay = (L2, cx, cz, ci, cj, wi, wj) => {
        // ON THE LANDING PLACE (round 1's critics: white flowers crowding the walk, laid out almost in a grid, and the
        // canyons as bare as before): loose clumps with gaps (a patch in CLEARING.gaps has nothing), fewer than in the
        // wild, but some even where little grows, and no flowers
        const pad = land.landingAt(cx, cz) > CLEAR;
        if (pad && hash2(wi, wj, 77) < CLEARING.gaps) return;
        const g = pad ? Math.max(land.growthAt(cx, cz), CLEARING.least) * CLEARING.thin : land.growthAt(cx, cz); if (g < 0.04) return;
        // how many in this patch: the close ones thick where it grows; the big ones few
        const many = far ? g * 0.4 : g * 3.5, n = Math.floor(many * Q.many + hash2(wi, wj, 11));
        for (let q = 0; q < n; q++) {
          // which plant: by their shares
          let t = hash2(wi, wj, 20 + q) * total, s = 0; for (; s < list.length - 1; s++) { if ((t -= list[s].share) < 0) break; }
          const p = list[s], clumpR = p.how === 'clump' ? 2.5 : 0;
          const bx = cx + (hash2(wi, wj, 40 + q) - 0.5) * CELL, bz = cz + (hash2(wi, wj, 60 + q) - 0.5) * CELL;
          const k = p.how === 'clump' ? 3 + Math.floor(hash2(wi, wj, 80 + q) * 4) : 1;
          for (let e = 0; e < k; e++) {
            const a = hash2(wi + e, wj, 90 + q) * 6.283, d = clumpR * Math.sqrt(hash2(wi, wj + e, 95 + q));
            const x = bx + Math.cos(a) * d, z = bz + Math.sin(a) * d;
            if ((!pad && land.growthAt(x, z) < 0.05) || keptClear(x, z)) continue;
            if (pad && PLANTS[p.k].flower && land.landingAt(x, z) > CLEAR) continue;
            const hgt = PLANTS[p.k].height * p.size * (0.7 + 0.6 * hash2(wi + e, wj + q, 7)), y = land.heightAt(x, z) - PLANT_SINK[p.k] * hgt;
            // (the tall ones keep off the landing place, as before: a person walking there would have the camera in them)
            if (hgt > CLEARING.tall && land.landingAt(x, z) > CLEAR) continue;
            col.setRGB(1, 1, 1).multiplyScalar(0.85 + 0.3 * hash2(wi, wj + e, 13 + q));
            if (!put(L2, s, x, y, z, hgt, hash2(wi + e, wj, 17 + q) * 6.283, 0.06, col)) break;
          }
        }
      };
    }
  }

  // ── their shadows on the ground (src/planet/groundshadow.js): every rock, plant and flower casts, its leaves cut out
  // of their picture as they are drawn ──
  // (only those near enough to fall inside the near shadow picture, a short list of each mesh's made at every relay;
  // none at all on a level whose picture has none: src/planet/groundshadow.js)
  const shades = [], shadowCopies = [], shadowReach = ground.shadows && !lookOff('plantShadows') ? ground.shadows.nearReach() : 0;
  if (shadowReach > 0) for (const L of layers) for (const m of L.meshes) {
    const copy = new THREE.InstancedMesh(m.geometry, m.material, m.instanceMatrix.count); copy.count = 0; copy.frustumCulled = false; copy.name = m.name;
    shadowCopies.push({ m, copy });
    shades.push(ground.shadows.add(copy, { kind: /plant/.test(L.name) ? 'plant' : 'rock', reach: L.reach, map: /plant/.test(L.name) && sheet ? sheet.map : null }));
  }
  function shortList(cx, cz) {
    const R = shadowReach + CELL * 1.5 + 2, R2 = R * R;
    for (const { m, copy } of shadowCopies) {
      const a = m.instanceMatrix.array, b = copy.instanceMatrix.array; let k = 0;
      for (let i = 0; i < m.count; i++) { const dx = a[i * 16 + 12] - cx, dz = a[i * 16 + 14] - cz; if (dx * dx + dz * dz > R2) continue; for (let e = 0; e < 16; e++) b[k * 16 + e] = a[i * 16 + e]; k++; }
      copy.count = k; copy.instanceMatrix.needsUpdate = true;
    }
  }

  // ── laid out round the camera ──────────────────────────────────────────────────────────────────────────────────
  let lastX = Infinity, lastZ = Infinity;
  function relay(cx, cz) {
    const ci0 = Math.floor((cx + P / 2) / CELL), cj0 = Math.floor((cz + P / 2) / CELL);
    stats.rocks = stats.plants = stats.tris = 0;
    for (const L of layers) {
      for (const m of L.meshes) m.count = 0;
      L.placed = 0;
      for (const [di, dj] of L.order) {
        const ci = ci0 + di, cj = cj0 + dj, wi = ((ci % wrapN) + wrapN) % wrapN, wj = ((cj % wrapN) + wrapN) % wrapN;
        L.lay(L, -P / 2 + (ci + 0.5) * CELL, -P / 2 + (cj + 0.5) * CELL, ci, cj, wi, wj);
      }
      let n = 0; L.meshes.forEach((m, s) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; n += m.count; stats.tris += m.count * L.tris[s]; });
      L.count = n; if (/plant/.test(L.name)) stats.plants += n; else stats.rocks += n;
    }
    if (shadowCopies.length) shortList(cx, cz);
  }
  stats.layers = layers.length;
  stats.buildMs = Math.round(performance.now() - t0);
  return {
    group, stats, layers,
    update(camera, dt) {
      clock.value += dt;
      const x = camera.position.x, z = camera.position.z;
      if (Math.hypot(x - lastX, z - lastZ) > CELL * 1.5) { lastX = x; lastZ = z; relay(x, z); }
    },
    relayNow(camera) { lastX = camera.position.x; lastZ = camera.position.z; relay(lastX, lastZ); },
    dispose() { for (const s of shades) s.dispose(); for (const L of layers) for (const m of L.meshes) { m.dispose(); } for (const g of new Set([...rockShapesG, ...boulderShapesG])) g.dispose(); rockMat.dispose(); boulderMat.dispose(); for (const m of plantMats) m.dispose(); },
  };
}
