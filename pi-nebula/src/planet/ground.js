// THE GROUND'S PICTURE: the land of src/planet/land.js drawn cheaply enough for a phone, however far it is seen.
//
// THE MESH is one small square grid drawn many times over in one draw (instanced), each copy a square patch of
// the ground: small patches close to the camera and bigger ones further off, every size twice the last (a patch
// is split in four when the camera is near enough). The grid's corners are lifted to the land's height on the
// graphics card, from the heights themselves (a float picture of them, with smaller copies for the far patches).
// Where one size of patch meets the next, every other corner of the smaller ones slides over onto its neighbour,
// so the two meet without a gap and nothing jumps as you fly (the "continuous distance-dependent level of detail"
// way, after Strugar 2010). The ground is curved down out of sight with distance (a planet's curve, drawn: the heights
// the game reads, land.heightAt, are not curved), so it ends at a horizon instead of an edge.
//
// THE LIGHT is worked out once, on the graphics card, into a picture laid over the whole ground (the light pass):
// how much of the sun each spot sees past the land toward the sun (the long shadows of a low sun), and how much of
// the sky it sees (darker in hollows and crater bowls). The sun does not move.
//
// THE COLOUR per pixel: the ground's own picture (which way it faces, how rocky and bright: land.NM), what grows on
// it, a fine grain so close up it is not smooth, the sun and the sky's light, and with air the haze, the colour of
// the sky behind (src/planet/cloudSky.js skyAt), so far hills melt into it.
//
//   const g = makeGround({ renderer, land, look, quality })    look: from src/planet/planet.js (colours, sun, air)
//   g.mesh (add it to the scene); g.update(camera) each frame (which patches, and where the camera is)
//   g.U (the shader's settings, shared with the cover's), g.stats { patches, tris, lightMs, bytes }
import * as THREE from 'three';
import { SKY_GLSL } from './cloudSky.js';
import { GRIT, gritData } from './grit.js';
import { lookOff } from './kinds.js';
import { takesShadows, makeShadowPicture, SHADOW_PIC } from './groundshadow.js';

// the patches: the smallest is SIZE0 metres across; a patch of level L is SIZE0 * 2^L and is drawn while the camera is
// within RANGE times its size (a bigger one beyond). RANGE and MORPH keep every meeting of two sizes gap-free (see the
// note in select()); LEVELS is how many sizes, the biggest 8 km across.
const SIZE0 = 32, RANGE = 3.6, MORPH = 0.85, LEVELS = 9;
// a planet's curve: how far the ground drops below level at a distance d is d^2 / (2 * CURVE) (metres)
export const CURVE = 18000;

// the heights as a float picture, with its smaller copies (each sample of the next the mean of four), read exactly
function heightTexture(land) {
  const { N, H } = land, mips = [];
  let src = H, n = N;
  for (;;) {
    mips.push({ data: src, width: n, height: n });
    if (n === 1) break;
    const m = n / 2, dst = new Float32Array(m * m);
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) { const a = 2 * j * n + 2 * i; dst[j * m + i] = (src[a] + src[a + 1] + src[a + n] + src[a + n + 1]) * 0.25; }
    src = dst; n = m;
  }
  const t = new THREE.DataTexture(H, N, N, THREE.RedFormat, THREE.FloatType);
  t.mipmaps = mips; t.generateMipmaps = false;
  t.minFilter = THREE.NearestMipmapNearestFilter; t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
function byteTexture(data, N, aniso) {
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = aniso; t.needsUpdate = true;
  return t;
}
// a small picture of fine grain that repeats: x and z of a bumpy surface's facing (R, G), and two speckles (B, A)
function detailTexture(aniso) {
  const S = 256, data = new Uint8Array(S * S * 4), h = new Float32Array(S * S);
  // (gradient noise, made here so this file needs nothing else: three layers, repeating across the picture)
  const layer = (cells, seed) => {
    let s = seed; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const g = Array.from({ length: cells * cells }, () => { const a = R() * 6.2832; return [Math.cos(a), Math.sin(a)]; });
    return (u, v) => {
      const x = u * cells, y = v * cells, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, w = (a) => ((a % cells) + cells) % cells;
      const d = (a, b, ox, oy) => { const q = g[w(j + b) * cells + w(i + a)]; return q[0] * (fx - ox) + q[1] * (fy - oy); };
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const top = d(0, 0, 0, 0) + (d(1, 0, 1, 0) - d(0, 0, 0, 0)) * sx, bot = d(0, 1, 0, 1) + (d(1, 1, 1, 1) - d(0, 1, 0, 1)) * sx;
      return top + (bot - top) * sy;
    };
  };
  const a = layer(8, 11), b = layer(16, 23), c = layer(32, 37), e = layer(64, 51), f = layer(24, 61);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = i / S, v = j / S; h[j * S + i] = a(u, v) * 0.5 + b(u, v) * 0.3 + c(u, v) * 0.2 + e(u, v) * 0.1; }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const k = j * S + i, dx = h[j * S + ((i + 1) % S)] - h[j * S + ((i + S - 1) % S)], dz = h[((j + 1) % S) * S + i] - h[((j + S - 1) % S) * S + i];
    const u = i / S, v = j / S;
    data[k * 4] = Math.max(0, Math.min(255, 128 - dx * 900)); data[k * 4 + 1] = Math.max(0, Math.min(255, 128 - dz * 900));
    data[k * 4 + 2] = Math.max(0, Math.min(255, 128 + h[k] * 300)); data[k * 4 + 3] = Math.max(0, Math.min(255, 128 + f(u, v) * 170 + e(u, v) * 90));
  }
  return byteTexture(data, S, aniso);
}

// the ground underfoot's picture: made once, kept for every planet after
let gritKept = null;
// each world's turn and size of the grain: [cos, sin, size of the bigger layer, size of the finer], from its seed
const gritTurn = (seed) => { const a = ((seed * 2654435761) >>> 0) / 4294967296 * Math.PI * 2, b = ((seed * 40503 + 17) % 1000) / 1000; return new THREE.Vector4(Math.cos(a), Math.sin(a), 0.75 + 0.6 * b, 0.8 + 0.5 * ((seed * 7919) % 1000) / 1000); };
const gritPicture = () => gritKept || (gritKept = gritData(GRIT.size));

// ── THE HAZE, shared with what stands on the ground (src/planet/cover.js) ───────────────────────────────────────
// thick near the ground and thinning with height (halving every uHazeH * 0.69 metres up), so far hills fade into the
// sky but the ground below stays clear from high up: how much of the sky's colour is between a point and the camera.
// Below the landing place's height it is no thicker than there (it grew without end downhill, and lay in the valleys as
// flat pools of the sky's colour that two critics read as spilled paint)
// how much bare rock (and on the meadows, bare earth: uBare) is mottled at every distance
const ROCK_MOTTLE = 0.8;
// how much of the sky's colour the farthest ground takes (with air: the moon has none)
export const HORIZON_HAZE = 0.75;
export const HAZE_GLSL = /* glsl */`
uniform float uHaze, uHazeH, uHazeBase;
float hazeAmt(vec3 eye, vec3 p) {
  float d = distance(eye, p), k = 1.0 / uHazeH, h0 = max(eye.y - uHazeBase, 0.0), dh = max(p.y - uHazeBase, 0.0) - h0;
  float od = abs(dh) < 1.0 ? exp(-k * h0) : (exp(-k * h0) - exp(-k * (h0 + dh))) / (k * dh);
  // (and where the land meets the sky over the planet's curve, it melts into the sky rather than ending in a ruled
  // line: toward the farthest ground the eye can see from its height over the landing place, more haze)
  float edge = sqrt(2.0 * ${CURVE.toFixed(1)} * (h0 + 1.5));
  return max(1.0 - exp(-uHaze * d * od), ${HORIZON_HAZE.toFixed(2)} * smoothstep(0.3, 1.0, d / edge));
}
`;

// ── the heights, as both the mesh and the light pass read them ───────────────────────────────────────────────────
const HEIGHT_GLSL = /* glsl */`
uniform highp sampler2D uH;
uniform float uN, uT, uP;
// the height at world (x, z), from the copy of the heights halved lod times, between its four nearest samples
float heightAt(vec2 w, float lod) {
  float s = exp2(lod);
  int n = int(uN) >> int(lod);
  vec2 q = ((w + 0.5 * uP) / uT - (s - 1.0) * 0.5) / s;
  vec2 f = floor(q); vec2 t = q - f; ivec2 i = ivec2(f), m = ivec2(n - 1); int l = int(lod);
  float a = texelFetch(uH, i & m, l).r, b = texelFetch(uH, (i + ivec2(1, 0)) & m, l).r;
  float c = texelFetch(uH, (i + ivec2(0, 1)) & m, l).r, d = texelFetch(uH, (i + ivec2(1, 1)) & m, l).r;
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}`;

// ── THE LIGHT PASS ───────────────────────────────────────────────────────────────────────────────────────────────
const LIGHT_FRAG = /* glsl */`
${HEIGHT_GLSL}
uniform sampler2D uEX; uniform vec3 uSun; uniform float uLN, uMaxLod;
varying vec2 vUv;
void main() {
  // this texel's place on the ground
  vec2 w = (vUv * uLN - 0.5) * (uP / uLN) - 0.5 * uP + 0.5 * uT * (uN / uLN - 1.0);
  float h0 = heightAt(w, 0.0) + 0.25;
  // THE SUN: along the ground toward it, ever longer steps, the steepest rise of the land seen so far against the
  // sun's own height (its tangent): past it, in shadow; a soft edge either side
  vec2 dir = normalize(uSun.xz + vec2(1e-6)); float tanSun = uSun.y / max(length(uSun.xz), 1e-4), steepest = -1e9, d = uT * 0.75;
  for (int k = 0; k < 60; k++) {
    float lod = clamp(floor(log2(d / (uT * 6.0))), 0.0, uMaxLod);
    steepest = max(steepest, (heightAt(w + dir * d, lod) - h0) / d);
    d *= 1.13;
    if (d > 2200.0) break;
  }
  float sun = smoothstep(-0.06, 0.06, tanSun - steepest);
  // THE SKY: the land's horizon in eight directions, near and far; the more of the sky it hides, the darker
  float sky = 0.0;
  for (int a = 0; a < 8; a++) {
    float an = float(a) * 0.7854 + 0.39; vec2 r = vec2(cos(an), sin(an)); float st = 0.0, dd = 2.0;
    for (int k = 0; k < 7; k++) { st = max(st, (heightAt(w + r * dd, clamp(floor(log2(dd / (uT * 4.0))), 0.0, uMaxLod)) - h0 + 0.2) / dd); dd *= 2.1; }
    sky += 1.0 - st / sqrt(1.0 + st * st);
  }
  vec4 ex = texture2D(uEX, vUv);
  // (what grows, and how much the trees' crowns cover: land.EX)
  gl_FragColor = vec4(sun, sky / 8.0, ex.r, ex.b);
}`;
function lightPass(renderer, land, hTex, sunDir, size) {
  const t0 = performance.now(), { N } = land;
  const ex = byteTexture(land.EX, N, 1); ex.generateMipmaps = false; ex.minFilter = THREE.LinearFilter;
  const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: LIGHT_FRAG, depthTest: false, depthWrite: false,
    uniforms: { uH: { value: hTex }, uN: { value: N }, uT: { value: land.gap }, uP: { value: land.width }, uEX: { value: ex }, uSun: { value: sunDir.clone().normalize() }, uLN: { value: size }, uMaxLod: { value: Math.log2(N) - 1 } },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), scene = new THREE.Scene(), cam = new THREE.Camera(); quad.frustumCulled = false; scene.add(quad);
  const was = renderer.getRenderTarget(), wasTone = renderer.toneMapping;
  renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(was);
  renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, new Uint8Array(4));   // (waits for the card, for the timing)
  renderer.toneMapping = wasTone;
  mat.dispose(); quad.geometry.dispose(); ex.dispose();
  rt.texture.anisotropy = 4;
  return { tex: rt.texture, rt, ms: Math.round(performance.now() - t0) };
}

// ── THE GROUND'S SHADER ──────────────────────────────────────────────────────────────────────────────────────────
const GROUND_VERT = /* glsl */`
${HEIGHT_GLSL}
attribute vec4 aNode;                       // a patch: its corner (x, z), its size, its level
uniform vec3 uCam; uniform float uCamUp, uGrid, uRange0, uMorph, uMip0, uCurve;
varying vec2 vXZ; varying vec3 vWorld; varying float vDist;
void main() {
  vec2 g = position.xz;                     // this corner on the grid: 0 .. uGrid each way
  float cell = aNode.z / uGrid, lod = aNode.w;
  vec2 w0 = aNode.xy + g * cell, dc = w0 - uCam.xz;
  // how far toward the next size this corner has slid, by its distance (the camera's height above the ground counts)
  float range = uRange0 * exp2(lod), start = range * (0.5 + 0.5 * uMorph);
  float k = clamp((sqrt(dot(dc, dc) + uCamUp * uCamUp) - start) / (range - start), 0.0, 1.0);
  vec2 w = aNode.xy + (g - fract(g * 0.5) * 2.0 * k) * cell;
  float m0 = max(0.0, lod + uMip0), m1 = max(0.0, lod + 1.0 + uMip0);
  float h = heightAt(w, m0);
  if (m1 > m0) h = mix(h, heightAt(w, m1), k);
  vec2 dw = w - uCam.xz; float d2 = dot(dw, dw);
  vXZ = w; vWorld = vec3(w.x, h, w.y); vDist = sqrt(d2 + (uCam.y - h) * (uCam.y - h));
  gl_Position = projectionMatrix * viewMatrix * vec4(w.x, h - d2 * uCurve, w.y, 1.0);
}`;
const GROUND_FRAG = /* glsl */`
uniform sampler2D uNM, uL, uDetail, uShadow, uShadowSite, uGrit;
uniform vec4 uGritK, uGritTurn;
const float SHADOW_SKY = ${SHADOW_PIC.sky.toFixed(2)};
uniform vec4 uShadowBox, uShadowSiteBox;
uniform float uN, uP;
uniform vec3 uSunDir, uSunCol, uAmbSky, uAmbGround, uDust, uRock, uBright, uDark, uGrass, uGrass2, uCanopy;
uniform float uAmbPow, uAir, uFine, uBands, uTreeFar, uBare;
varying vec2 vXZ; varying vec3 vWorld; varying float vDist;
#ifdef AIR
${SKY_GLSL}
${HAZE_GLSL}
#endif
void main() {
  vec2 uv = (vXZ + 0.5 * uP) / uP + 0.5 / uN;
  vec4 nm = texture2D(uNM, uv), L = texture2D(uL, uv);
  vec3 n = vec3(nm.r * 2.0 - 1.0, 0.0, nm.g * 2.0 - 1.0); n.y = sqrt(max(0.02, 1.0 - n.x * n.x - n.z * n.z));
  // the fine grain: bumps a few metres across fading out with distance, and finer ones close by
  vec4 d1 = texture2D(uDetail, vXZ / 23.0), d2 = texture2D(uDetail, vXZ / 4.3);
  // (laid on from above, so on steep faces it would smear downward: there it fades out)
  float flatK = smoothstep(0.45, 0.8, n.y);
  float nearA = (1.0 - smoothstep(40.0, 420.0, vDist)) * flatK, nearB = (1.0 - smoothstep(6.0, 70.0, vDist)) * uFine * flatK;
  float rock = smoothstep(0.15, 0.85, nm.b), tone = nm.a * 2.0 - 1.0, grow = L.b, wood = L.a;
  // THE CLIFFS' BANDS (a kind with bands: the canyons): layers of rock by this point's own height, about 25 m from one
  // to the next, a little wavy (a slow wave from the grain's picture, read once across the whole ground), the finer
  // ones fading with distance
  if (uBands > 0.0) {
    float wave = (texture2D(uDetail, vXZ / uP).b - 0.5) * 5.1;
    tone = clamp(tone + uBands * rock * (sin(vWorld.y * 0.25 + wave) * 0.45 + sin(vWorld.y * 0.9) * 0.15 * (1.0 - smoothstep(250.0, 700.0, vDist))), -1.0, 1.0);
  }
  n = normalize(n + vec3(d1.r - 0.5, 0.0, d1.g - 0.5) * (0.22 + 0.5 * rock) * nearA + vec3(d2.r - 0.5, 0.0, d2.g - 0.5) * (0.18 + 0.4 * rock) * nearB);
  vec3 base = mix(uDust, uRock, rock);
  base = tone > 0.0 ? mix(base, uBright, tone) : mix(base, uDark, -tone);
  base = mix(base, mix(uGrass, uGrass2, smoothstep(0.3, 0.7, d1.b)), grow * (1.0 - rock));
  base *= 0.9 + 0.2 * mix(0.5, d2.a, nearA) * (0.6 + 0.4 * rock);
  // (bare earth and rock mottled at every distance, in patches a few tens of metres across: plain, the meadows' bare
  // earth lay in the land seen from the ship as flat pools of one colour, D's lilac pools, two critics: "spilled paint")
  base *= mix(1.0, (0.7 + 0.55 * d1.b) * (0.85 + 0.3 * d1.a), max(rock, uBare * (1.0 - grow)) * ${ROCK_MOTTLE.toFixed(2)});
  #ifdef GRIT
  // THE GROUND UNDERFOOT (src/planet/grit.js): small stones, cracks, tufts and ripples, each kind its own, near the eye
  // only; two sizes of it turned against each other, and how much of each comes and goes over the ground (d1, d2)
  float nearG = (1.0 - smoothstep(${(GRIT.far * 0.45).toFixed(1)}, ${GRIT.far.toFixed(1)}, vDist)) * flatK;
  #ifndef AIR
  nearG *= 0.1 + 0.9 * L.r;      // (the moon's shade stays nearly black: no grain picked out in it)
  #endif
  if (nearG > 0.001) {
    // (each world its own: the grain turned and sized by the seed, so no two worlds' ripples lie alike)
    mat2 t1 = mat2(uGritTurn.x, uGritTurn.y, -uGritTurn.y, uGritTurn.x), t2 = mat2(uGritTurn.y, -uGritTurn.x, uGritTurn.x, uGritTurn.y);
    vec4 g1 = texture2D(uGrit, t1 * vXZ / (${GRIT.scales[0].toFixed(2)} * uGritTurn.z));
    vec4 g2 = texture2D(uGrit, t2 * vXZ / (${GRIT.scales[1].toFixed(2)} * uGritTurn.w) + 0.37);
    float loose = (1.0 - rock) * (1.0 - grow), patchA = smoothstep(0.3, 0.7, d2.b), patchB = smoothstep(0.35, 0.65, d1.a);
    // the stones: a shade apart from the ground, lit from one side, more on the rocky ground
    float st = max(g1.r * (0.35 + 0.65 * patchA), g2.r * (0.5 + 0.5 * patchB)), stK = uGritK.x * min(1.0, 0.45 + rock + 0.4 * patchB) * nearG;
    vec3 stone = mix(uRock, uDust, 0.35) * (0.6 + 0.8 * st);
    base = mix(base, stone, stK * smoothstep(0.0, 0.08, st));
    // the cracks: on the hard ground, thin and dark
    base *= 1.0 - 0.45 * g1.g * uGritK.y * (0.3 + 0.7 * rock) * (1.0 - grow) * patchB * nearG;
    // the tufts: where something grows, blades lighter and darker than the grass round them
    float tf = max(g1.b, g2.b * 0.8) * uGritK.z * (0.25 + 0.75 * grow) * nearG;
    base = mix(base, mix(uGrass2 * 0.55, uGrass * 1.45, g2.a), tf * 0.8);
    // the ripples: in loose sand and dust, a long gentle side and a short steep one, darker in the trough
    base *= 1.0 + 0.22 * (g1.a - 0.5) * uGritK.w * loose * (0.5 + 0.5 * patchA) * nearG;
  }
  #endif
  // THE WOODS (src/planet/trees.js): the ground under the trees in their shade; and past where the trees are drawn,
  // their crowns' colour, so a far wood is still a wood
  base *= 1.0 - 0.3 * wood;
  // (mottled about as finely as the crowns are: their colour measured from above matched the trees' own within 5%)
  base = mix(base, uCanopy * (0.75 + 0.5 * d1.b), wood * smoothstep(uTreeFar * 0.8, uTreeFar, length(vXZ - cameraPosition.xz)));
  float ndl = max(dot(n, uSunDir), 0.0);
  // THE SHADOWS of what stands on the ground (src/planet/groundshadow.js): the sun's light taken away there, as behind a
  // hill, and some of the sky's too where the sun reaches (in the land's own shade there is no second shadow)
  // (two pictures: the near one round the camera, the site's for the big things at any distance; each spot the darker;
  // read as drawn, so a shadow is no wider than what casts it, its edge soft by a few centimetres)
  float sh = 0.0;
  { vec2 su = (vXZ - uShadowBox.xy) / uShadowBox.z; float e = max(abs(su.x), abs(su.y));
    if (e < 1.0) sh = texture2D(uShadow, su * 0.5 + 0.5).r * (1.0 - smoothstep(0.85, 1.0, e)) * uShadowBox.w; }
  { vec2 su = (vXZ - uShadowSiteBox.xy) / uShadowSiteBox.z; float e = max(abs(su.x), abs(su.y));
    if (e < 1.0) sh = max(sh, texture2D(uShadowSite, su * 0.5 + 0.5).r * (1.0 - smoothstep(0.9, 1.0, e)) * uShadowSiteBox.w); }
  sh = min(1.0, sh * 1.15);
  // (the sky's part only where the sun reaches: in the land's own shade a shadow takes nothing, no second shadow)
  vec3 col = base * (uSunCol * ndl * L.r * (1.0 - sh) + mix(uAmbGround, uAmbSky, n.y * 0.5 + 0.5) * uAmbPow * L.g * (1.0 - SHADOW_SKY * sh * L.r));
  #ifdef AIR
  // the haze: the sky behind, more of it the further off and the lower down
  col = mix(col, skyAt(cameraPosition, normalize(vWorld - cameraPosition)), max(hazeAmt(cameraPosition, vWorld), horizonAmt(cameraPosition, vWorld)));
  #endif
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the planet's ground tiers, by the game's own quality names (src/station.js QUALITY: low, medium, high; the same three
// steps the other games call potato, normal and gaming):
//   grid: corners along a patch's side; light: the light picture's size; fine: the closest grain
export const GROUND_QUALITY = {
  low: { grid: 16, light: 512, fine: 0, aniso: 1 },
  medium: { grid: 24, light: 1024, fine: 1, aniso: 4 },
  high: { grid: 32, light: 1024, fine: 1, aniso: 8 },
};

export function makeGround({ renderer, land, look, quality = 'medium', sky = null }) {
  const Q = GROUND_QUALITY[quality] || GROUND_QUALITY.medium, G = Q.grid, t0 = performance.now();
  const aniso = Math.min(Q.aniso, renderer.capabilities.getMaxAnisotropy());
  const hTex = heightTexture(land), nmTex = byteTexture(land.NM, land.N, aniso), detail = detailTexture(aniso);
  // (the ground underfoot: made only on the level that draws it)
  const gritOn = !!(Q.fine && quality === 'high' && !lookOff('grit')), grit = gritOn ? byteTexture(gritPicture(), GRIT.size, aniso) : null;
  const sunDir = new THREE.Vector3(...look.sun).normalize();
  const light = lightPass(renderer, land, hTex, sunDir, Math.min(Q.light, land.N));
  const col = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  const U = {
    uH: { value: hTex }, uN: { value: land.N }, uT: { value: land.gap }, uP: { value: land.width },
    uNM: { value: nmTex }, uL: { value: light.tex }, uDetail: { value: detail },
    uCam: { value: new THREE.Vector3() }, uCamUp: { value: 0 }, uGrid: { value: G }, uRange0: { value: SIZE0 * RANGE }, uMorph: { value: MORPH },
    // (which copy of the heights a level reads: its corners' gap against the samples' gap)
    uMip0: { value: Math.round(Math.log2(SIZE0 / G / land.gap)) }, uCurve: { value: 0.5 / CURVE },
    uSunDir: { value: sunDir }, uSunCol: { value: col(look.sunColor).multiplyScalar(look.sunPower) },
    uAmbSky: { value: col(look.ambient.sky) }, uAmbGround: { value: col(look.ambient.ground) }, uAmbPow: { value: look.ambient.power },
    uDust: { value: col(look.dust) }, uRock: { value: col(look.rock) }, uBright: { value: col(look.bright) }, uDark: { value: col(look.dark) },
    uGrass: { value: col(look.grass || look.dust) }, uGrass2: { value: col(look.grass2 || look.dust) },
    uAir: { value: look.air ? 1 : 0 }, uBare: { value: land.kind.id === 'meadow' ? 1 : 0 }, uFine: { value: Q.fine }, uBands: { value: land.kind.bands ? 1 : 0 },
    // (the woods' colour from afar and how far the trees themselves are drawn: set by src/planet/trees.js)
    uCanopy: { value: new THREE.Color(0, 0, 0) }, uTreeFar: { value: 1e9 },
    // (the ground underfoot, src/planet/grit.js: the kind's own stones, cracks, tufts and ripples)
    uGrit: { value: grit }, uGritK: { value: new THREE.Vector4(...(GRIT.kinds[land.kind.id] || GRIT.kinds.moon)) }, uGritTurn: { value: gritTurn(land.seed) },
    // (the haze as thick as the air says at the landing place's height, thinning above it)
    uHaze: { value: look.air ? look.air.haze : 0 }, uHazeH: { value: look.air ? look.air.thin || 450 : 450 }, uHazeBase: { value: land.landing.y },
  };
  // THE SHADOW PICTURE of what stands on the ground (src/planet/groundshadow.js)
  const shadows = makeShadowPicture({ renderer, ground: { U }, sunDir, quality });
  // (the light picture's sun read back once, for the people on foot: in the land's shade the sun is off them too)
  const LN = light.rt.width, sunPx = new Uint8Array(LN * LN * 4);
  try { renderer.readRenderTargetPixels(light.rt, 0, 0, LN, LN, sunPx); } catch (e) { sunPx.fill(255); }
  const sunAt = (x, z) => { const P = land.width, u = (x + 0.5 * P) / P + 0.5 / land.N, v = (z + 0.5 * P) / P + 0.5 / land.N, i = ((Math.floor(u * LN) % LN) + LN) % LN, j = ((Math.floor(v * LN) % LN) + LN) % LN; return sunPx[(j * LN + i) * 4] / 255; };
  Object.assign(U, shadows.U);
  // (with air, the sky's own settings are shared, so the haze is the sky's colour exactly)
  if (look.air && sky && sky.uniforms) Object.assign(U, sky.uniforms);
  // (its spots of the picture marked as ground: the shadows are drawn there and only there, src/planet/groundshadow.js)
  const material = takesShadows(new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, uniforms: U, defines: { ...(look.air ? { AIR: 1 } : {}), ...(gritOn ? { GRIT: 1 } : {}) } }));

  // the grid: (G + 1)^2 corners, x and z in grid steps
  const pos = new Float32Array((G + 1) * (G + 1) * 3), idx = [];
  for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) { const k = (j * (G + 1) + i) * 3; pos[k] = i; pos[k + 2] = j; }
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const a = j * (G + 1) + i, b = a + 1, c = a + G + 1, d = c + 1;
    // (the square's diagonal alternates, so the slid corners fold the same way the bigger patch's do)
    if ((i + j) % 2 === 0) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
  const MAX = 1200, nodes = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); nodes.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aNode', nodes); geo.instanceCount = 0;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  const mesh = new THREE.Mesh(geo, material); mesh.frustumCulled = false; mesh.name = 'planet:ground';

  const stats = { patches: 0, tris: 0, lightMs: light.ms, buildMs: 0, grid: G, light: light.rt.width,
    bytes: { heights: land.N * land.N * 4 * 4 / 3, ground: land.N * land.N * 4 * 4 / 3, light: light.rt.width ** 2 * 4 * 4 / 3, grain: 256 * 256 * 4 * 4 / 3 } };

  // ── which patches to draw, each frame ──────────────────────────────────────────────────────────────────────────
  // A patch of level L is split in four while the camera is within RANGE times its size of it (distance counting the
  // camera's height above the ground); every corner slides fully onto the bigger patch's grid by RANGE times its size,
  // beginning at MORPH of the way out from the last size's reach. With RANGE 3.6 a patch is never beside one more
  // than one size bigger, and a bigger patch's corners along the line where it meets a smaller one never slide (they
  // are nearer than its own sliding begins), so the meeting has no gaps.
  const frustum = new THREE.Frustum(), M4 = new THREE.Matrix4(), box = new THREE.Box3();
  const span = land.maxH - land.minH;
  function select(camera, camUp) {
    const cx = camera.position.x, cz = camera.position.z, up2 = camUp * camUp, arr = nodes.array;
    M4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(M4);
    // how far the ground can be seen: to the horizon over the curve, and the highest land beyond it
    const seeFar = Math.min(16000, Math.sqrt(2 * CURVE * (Math.max(camUp, 2) + span)) + Math.sqrt(2 * CURVE * span) + 400);
    let n = 0, tris = 0;
    const dist = (x0, z0, s) => { const dx = Math.max(x0 - cx, 0, cx - x0 - s), dz = Math.max(z0 - cz, 0, cz - z0 - s); return Math.sqrt(dx * dx + dz * dz + up2); };
    const visit = (x0, z0, L) => {
      const s = SIZE0 * 2 ** L, d = dist(x0, z0, s);
      if (d > seeFar) return;
      // (its box, dropped by the curve as far as its far side)
      const far = Math.hypot(Math.max(Math.abs(x0 - cx), Math.abs(x0 + s - cx)), Math.max(Math.abs(z0 - cz), Math.abs(z0 + s - cz)));
      box.min.set(x0, land.minH - far * far * 0.5 / CURVE - 1, z0); box.max.set(x0 + s, land.maxH + 1, z0 + s);
      if (!frustum.intersectsBox(box)) return;
      if (L > 0 && d < SIZE0 * 2 ** (L - 1) * RANGE) { const h = s / 2; visit(x0, z0, L - 1); visit(x0 + h, z0, L - 1); visit(x0, z0 + h, L - 1); visit(x0 + h, z0 + h, L - 1); return; }
      if (n >= MAX) return;
      arr[n * 4] = x0; arr[n * 4 + 1] = z0; arr[n * 4 + 2] = s; arr[n * 4 + 3] = L; n++;
    };
    const top = LEVELS - 1, S = SIZE0 * 2 ** top, r = Math.ceil(seeFar / S);
    const bx = Math.floor(cx / S) * S, bz = Math.floor(cz / S) * S;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) visit(bx + i * S, bz + j * S, top);
    geo.instanceCount = n; nodes.updateRange.offset = 0; nodes.updateRange.count = n * 4; nodes.needsUpdate = true;
    tris = n * G * G * 2;
    stats.patches = n; stats.tris = tris;
  }

  const update = (camera) => {
    const up = Math.max(0.5, camera.position.y - land.heightAt(camera.position.x, camera.position.z));
    U.uCam.value.copy(camera.position); U.uCamUp.value = up;
    select(camera, up);
  };
  stats.buildMs = Math.round(performance.now() - t0);
  return {
    mesh, U, stats, update, light, shadows, sunAt,
    dispose() { shadows.dispose(); if (grit) grit.dispose(); geo.dispose(); material.dispose(); hTex.dispose(); nmTex.dispose(); detail.dispose(); light.rt.dispose(); },
  };
}
