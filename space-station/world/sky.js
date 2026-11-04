// THE SKY outside every window: the game's one sky, for the station's rooms now and a ship's cockpit later.
// It sits at infinity, centred on whatever camera draws it and fixed to the world's directions, so the landmarks
// always hang in the same places and help you find your way (up is +y; "level" means the floor's plane):
//   +x           the ringed planet, large, a little above level; its moon up to its left (toward -z), half lit; a comet
//                to its right (toward +z)
//   -x           the Rose: a pink and violet nebula with a bright heart and a curved lane of dust
//   +z           the Blue Veil: a blue crescent of gas with bright threads along its edge
//   -z           the Amber Eye: a gold ring of gas round a dying star, at level
//   -x and -z    the sun, low (between the Rose and the Eye), behind you as you look at the planet
//   all round    stars of many sizes and colours, a faint band of the galaxy, a far galaxy (high, toward -z)
// How it is drawn, cheaply:
//   still sky  the nebulae, the galaxy band, the far galaxy and the comet are worked out ONCE on the GPU into a cube
//              map when the sky is made (and again only when the Graphics setting changes)
//   stars      a few thousand points at infinity, each a soft dot a few pixels across, so they stay crisp at any
//              screen size
//   live sky   one triangle over the whole screen at the far plane, drawn AFTER the rooms' walls, so the depth test
//              throws it away everywhere but the windows. Per pixel it reads the cube map and traces the sun, the
//              planet (bands, storms, lightning, auroras, air glow, rings and their shadows) and the moon
// Graphics: low / medium / high set the cube map's size, the number of stars, the layers of detail on the planet and
// the moon, and how the auroras are drawn (a flat glow on low, curtains that rise above the planet's edge on
// medium and high).
//   const sky = createSky(renderer, { quality: 'medium' }); scene.add(sky.object);
//   each frame: sky.update(dt)                      (the moving parts: lightning, auroras, the bands' drift)
//   sky.setQuality('high'); sky.setTurn(30)          (the planet's turn: 1 = its own slow pace)
//   sky.views (named looks for a lab), sky.DIR (the landmarks' world directions), sky.stats (sizes and times)
import * as THREE from 'three';

const D2R = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0);
// a world direction from a compass bearing (degrees from +x toward +z) and a height above the horizon (degrees)
export function skyDir(az, el) { const a = az * D2R, e = el * D2R; return new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)); }
// a frame round a direction f, as seen looking along it: r to the right, u up (turned by roll degrees)
function frameAt(f, roll = 0) {
  const r = new THREE.Vector3().crossVectors(f, UP).normalize(), u = new THREE.Vector3().crossVectors(r, f);
  const c = Math.cos(roll * D2R), s = Math.sin(roll * D2R), r2 = r.clone().multiplyScalar(c).addScaledVector(u, -s), u2 = u.clone().multiplyScalar(c).addScaledVector(r, s);
  return { f: f.clone(), r: r2, u: u2 };
}
const basis = (F) => new THREE.Matrix3().set(F.r.x, F.u.x, F.f.x, F.r.y, F.u.y, F.f.y, F.r.z, F.u.z, F.f.z); // columns r, u, f

// ── where everything is ──────────────────────────────────────────────────────────────────────────────────────────
export const DIR = {
  planet: skyDir(-22, 11), moon: skyDir(-46, 23), sun: skyDir(-145, 12),
  rose: skyDir(182, 9), veil: skyDir(95, 14), eye: skyDir(-68, -1),
  farGalaxy: skyDir(-95, 40), comet: skyDir(22, 9),
};
const SIZE = { planet: 12.5, moon: 2.7, sun: 0.55, rose: 21, veil: 20, eye: 5.2, farGalaxy: 1.7 }; // angular radii, degrees
// the planet: its spin axis tipped toward us (so the rings open out) and leaning, the sun a little behind us (so more
// than half the planet is lit and its day-night line curves round the ball) and about 23 degrees above the rings' plane,
// so the planet's shadow is a wedge that ends inside the rings and theirs lies in a soft stripe across the clouds
const PF = frameAt(DIR.planet), TILT = 21 * D2R, LEAN = 5 * D2R;
const AXIS = PF.u.clone().multiplyScalar(Math.cos(TILT)).addScaledVector(PF.f, -Math.sin(TILT)).normalize();
AXIS.applyAxisAngle(PF.f, LEAN);
const EQ1 = new THREE.Vector3().crossVectors(AXIS, PF.r).normalize(), EQ2 = new THREE.Vector3().crossVectors(AXIS, EQ1).normalize();
// the auroras circle the magnetic pole, a few degrees off the spin axis, toward the night side
const NIGHT = DIR.sun.clone().addScaledVector(AXIS, -DIR.sun.dot(AXIS)).normalize().negate();
const MAG = AXIS.clone().addScaledVector(NIGHT, 0.1).normalize();
const MAG1 = new THREE.Vector3().crossVectors(MAG, PF.f).normalize(), MAG2 = new THREE.Vector3().crossVectors(MAG, MAG1).normalize();
const RING = [1.28, 2.42];              // the rings' inner and outer edge, in planet radii
const AURORA_COLAT = 0.3;              // the auroras' ring, radians from the magnetic pole
// the galaxy band runs through the Rose and climbs high over the north; its bright middle lies between them
const GAL_UP = skyDir(110, 42), GAL_N = new THREE.Vector3().crossVectors(DIR.rose, GAL_UP).normalize(), GAL_C = DIR.rose.clone().add(GAL_UP).normalize();

// named looks (for the lab): a direction and a field of view
function onPlanet(n) { return DIR.planet.clone().addScaledVector(n, Math.sin(SIZE.planet * D2R)).normalize(); }
// the darkest point we can see on a ring of points round an axis (for the close looks at the storms and the auroras)
function darkestSeen(axis, colat, minFacing, nightK = 1.5) {
  const e1 = new THREE.Vector3().crossVectors(axis, PF.r).normalize(), e2 = new THREE.Vector3().crossVectors(axis, e1), n = new THREE.Vector3();
  let best = PF.f.clone().negate(), score = -9;
  for (let a = 0; a < 360; a += 2) {
    n.copy(axis).multiplyScalar(Math.cos(colat)).addScaledVector(e1, Math.sin(colat) * Math.cos(a * D2R)).addScaledVector(e2, Math.sin(colat) * Math.sin(a * D2R));
    const facing = -n.dot(PF.f), sc = facing - nightK * n.dot(DIR.sun);   // well round toward us, and well into the night
    if (facing > minFacing && sc > score) { score = sc; best = n.clone(); }
  }
  return best;
}
const STORM_N = darkestSeen(AXIS, Math.PI / 2 - 0.3, 0.2, 3);           // the northern stormy belt, on the night side
const AUR_N = darkestSeen(MAG, AURORA_COLAT, 0.12);                      // the auroras' ring, on the night side
export const SKY_VIEWS = {
  planet: { name: 'Planet', look: DIR.planet.clone().addScaledVector(PF.r, 0.02), fov: 50 },
  storms: { name: 'Storms', look: onPlanet(STORM_N), fov: 16 },
  auroras: { name: 'Auroras', look: onPlanet(AUR_N), fov: 18 },
  rings: { name: 'Rings', look: DIR.planet.clone().addScaledVector(PF.r, 0.3).addScaledVector(PF.u, -0.06).normalize(), fov: 22 },
  moon: { name: 'Moon', look: DIR.moon, fov: 11 },
  sun: { name: 'Sun', look: DIR.sun, fov: 40 },
  rose: { name: 'Rose nebula', look: DIR.rose, fov: 72 },
  veil: { name: 'Blue Veil', look: DIR.veil, fov: 64 },
  eye: { name: 'Amber Eye', look: DIR.eye, fov: 26 },
  galaxy: { name: 'Far galaxy', look: DIR.farGalaxy, fov: 12 },
  comet: { name: 'Comet', look: DIR.comet.clone().addScaledVector(frameAt(DIR.comet).r, 0.05), fov: 30 },
};

export const SKY_QUALITY = {
  low: { cube: 512, stars: 2600, detail: 0, aurora: 0 },
  medium: { cube: 1024, stars: 6000, detail: 1, aurora: 14 },
  high: { cube: 1536, stars: 10000, detail: 2, aurora: 24 },
};

// ── small helpers ────────────────────────────────────────────────────────────────────────────────────────────────
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const hexLin = (h) => [1, 3, 5].map((i) => srgbToLin(parseInt(h.slice(i, i + 2), 16) / 255));
// smooth 1D value noise, tiling every `cells`
function noise1(cells, seed) { const R = rng(seed), v = Array.from({ length: cells }, R); return (x) => { const f = ((x % cells) + cells) % cells, i = Math.floor(f), t = f - i, s = t * t * (3 - 2 * t); return v[i] + (v[(i + 1) % cells] - v[i]) * s; }; }

// a tiling 3D noise volume (64 cubed, four independent channels at different sizes), read with mipmaps, so the
// planet's fine detail fades out smoothly where it gets too small to draw instead of glittering
function noiseVolume(N = 64) {
  const data = new Uint8Array(N * N * N * 4), chans = [[4, 11], [8, 23], [16, 37], [16, 51]];
  for (let ch = 0; ch < 4; ch++) {
    const [L, seed] = chans[ch], R = rng(seed), lat = new Float32Array(L * L * L).map(() => R()), k = L / N;
    const idx = (x, y, z) => ((z % L) * L + (y % L)) * L + (x % L);
    for (let z = 0; z < N; z++) {
      const fz = z * k, iz = Math.floor(fz), tz = fz - iz, sz = tz * tz * (3 - 2 * tz);
      for (let y = 0; y < N; y++) {
        const fy = y * k, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
        for (let x = 0; x < N; x++) {
          const fx = x * k, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
          const a = lat[idx(ix, iy, iz)], b = lat[idx(ix + 1, iy, iz)], c = lat[idx(ix, iy + 1, iz)], d = lat[idx(ix + 1, iy + 1, iz)];
          const e = lat[idx(ix, iy, iz + 1)], f = lat[idx(ix + 1, iy, iz + 1)], g = lat[idx(ix, iy + 1, iz + 1)], h = lat[idx(ix + 1, iy + 1, iz + 1)];
          const l0 = a + (b - a) * sx, l1 = c + (d - c) * sx, l2 = e + (f - e) * sx, l3 = g + (h - g) * sx;
          const m0 = l0 + (l1 - l0) * sy, m1 = l2 + (l3 - l2) * sy;
          data[((z * N + y) * N + x) * 4 + ch] = Math.round((m0 + (m1 - m0) * sz) * 255);
        }
      }
    }
  }
  const t = new THREE.Data3DTexture(data, N, N, N);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}

// the planet's bands, from the south pole (left) to the north pole (right): pale aqua and cream zones, thinner
// sea-green and teal belts, a coral belt south of the equator, deep blue round the poles
function bandTexture(n = 512) {
  const stops = [[0, '#22365a'], [0.08, '#2c5677'], [0.14, '#4d8f99'], [0.18, '#8cc3b4'], [0.21, '#5f9fa0'], [0.25, '#b5d8c6'], [0.29, '#6aa9a6'],
    [0.33, '#cfe4d2'], [0.36, '#d39d82'], [0.385, '#b9806e'], [0.41, '#e7d4b5'], [0.45, '#f1e7cf'], [0.52, '#f4ecd8'], [0.56, '#dccdae'],
    [0.58, '#79aeaa'], [0.605, '#4f8d93'], [0.63, '#b9dccb'], [0.67, '#6ca6a4'], [0.7, '#a8d2c2'], [0.735, '#5b96a0'], [0.78, '#93c0b8'],
    [0.84, '#3f6f88'], [0.91, '#2b4a6b'], [1, '#1f3256']].map(([u, h]) => [u, hexLin(h)]);
  const fine = noise1(97, 5), fine2 = noise1(211, 9), d = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1); let k = 0; while (k < stops.length - 2 && stops[k + 1][0] < u) k++;
    const [u0, c0] = stops[k], [u1, c1] = stops[k + 1], t = smooth(0, 1, (u - u0) / (u1 - u0));
    const shade = 0.92 + 0.1 * fine(u * 97) + 0.06 * fine2(u * 211);   // thin bands inside the big ones
    for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = Math.round(linToSrgb(Math.min(1, (c0[ch] + (c1[ch] - c0[ch]) * t) * shade)) * 255);
    d[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(d, n, 1); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// the rings across their width (inner edge left): a faint grey inner ring, a broad bright one, a dark gap, a paler
// outer ring with a thin gap of its own, and a thread of a ring outside it. Colour and how much light each part stops.
function ringTexture(n = 2048) {
  const d = new Uint8Array(n * 4), w1 = noise1(61, 3), w2 = noise1(397, 7), w3 = noise1(1499, 13), wc = noise1(37, 29), R = rng(57);
  // thin ringlets scattered across: some dense and bright, some near-empty gaps
  const lets = Array.from({ length: 70 }, () => [RING[0] + R() * (RING[1] - RING[0]), 0.0015 + R() * R() * 0.012, R() < 0.55 ? 0.35 + R() * 0.5 : -(0.4 + R() * 0.5)]);
  const a = new Float32Array(n), col = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), rho = RING[0] + u * (RING[1] - RING[0]);
    const C = smooth(1.28, 1.34, rho) * (1 - smooth(1.5, 1.53, rho)), B = smooth(1.5, 1.54, rho) * (1 - smooth(1.935, 1.95, rho));
    const A = smooth(2.02, 2.035, rho) * (1 - smooth(2.255, 2.27, rho)) * (1 - 0.92 * Math.exp(-(((rho - 2.2) / 0.005) ** 2)));
    const F = Math.exp(-(((rho - 2.355) / 0.0045) ** 2));
    let t = 0.75 + 0.3 * w2(u * 397) + 0.22 * w3(u * 1499);
    for (const [c0, w, k] of lets) { const e = Math.exp(-(((rho - c0) / w) ** 2)); t *= 1 + k * e; }
    a[i] = Math.min(0.96, Math.max(0, (C * (0.1 + 0.12 * w1(u * 61)) + B * (0.5 + 0.38 * w1(u * 61 + 17)) + A * (0.36 + 0.2 * w1(u * 61 + 31)) + F * 0.42 + 0.01) * t));
    if (rho > 1.95 && rho < 2.02) a[i] = 0.03 + 0.05 * w2(u * 397) * w3(u * 1499);      // the dark gap (a few faint ringlets)
    // colour: blue-grey inside, ochre and gold through the broad ring, pale sand outside, drifting a little
    const warm = smooth(1.5, 1.75, rho) * (1 - smooth(1.9, 2.05, rho)), peach = wc(u * 37);
    const c = [0.4 + 0.36 * warm + 0.26 * A + 0.06 * peach, 0.42 + 0.22 * warm + 0.2 * A + 0.01 * peach, 0.47 + 0.02 * warm + 0.1 * A - 0.05 * peach];
    const sh = 0.86 + 0.2 * w2(u * 397 + 5); col.push(c.map((v) => v * sh));
  }
  for (let i = 0; i < n; i++) {
    const edge = smooth(0, 6, i) * smooth(0, 6, n - 1 - i);              // fade to nothing at both ends
    for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = Math.round(linToSrgb(Math.min(1, col[i][ch])) * 255);
    d[i * 4 + 3] = Math.round(a[i] * edge * 255);
  }
  const t = new THREE.DataTexture(d, n, 1); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// ── GLSL shared by the shaders ───────────────────────────────────────────────────────────────────────────────────
const HASH = /* glsl */`
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 hash32(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }`;
// simplex noise in 3D (Ashima Arts and Stefan Gustavson, MIT licence), for the still sky
const SIMPLEX = /* glsl */`
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)), x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz), l = 1.0 - g, i1 = min(g.xyz, l.zxy), i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx, x2 = x0 - i2 + C.yyy, x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec3 ns = 0.142857142857 * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z), x_ = floor(j * ns.z), y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy, y = y_ * ns.x + ns.yyyy, h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy), b1 = vec4(x.zw, y.zw), s0 = floor(b0) * 2.0 + 1.0, s1 = floor(b1) * 2.0 + 1.0, sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy, a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x), p1 = vec3(a0.zw, h.y), p2 = vec3(a1.xy, h.z), p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3))); p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0); m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
// layered noise, about 0..1 (most of it 0.3..0.7)
float fbm(vec3 p, int oct) { float s = 0.0, a = 0.5, t = 0.0; for (int i = 0; i < 9; i++) { if (i >= oct) break; s += a * snoise(p); t += a; p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s / t * 0.62 + 0.5; }
// sharp bright threads where the noise crosses its middle
float ridged(vec3 p, int oct) { float s = 0.0, a = 0.5, t = 0.0; for (int i = 0; i < 9; i++) { if (i >= oct) break; s += a * (1.0 - abs(snoise(p))); t += a; p = p * 2.07 + vec3(4.1, 1.3, 7.7); a *= 0.5; } return s / t; }`;

// ── the still sky, worked out once into a cube map ───────────────────────────────────────────────────────────────
const CUBE_FRAG = /* glsl */`
varying vec3 vPos;
uniform mat3 uRose, uVeil, uEye, uFar, uComet;      // each landmark's frame: columns right, up, centre
uniform vec4 uSizes;                                  // the Rose, the Veil, the Eye, the far galaxy: angular radius (radians)
uniform vec3 uGalN, uGalC, uSun;
uniform float uGrain, uOct;
${HASH}
${SIMPLEX}
float angTo(vec3 d, vec3 c) { return 2.0 * asin(clamp(length(d - c) * 0.5, 0.0, 1.0)); }
int OCT(int n) { return n + int(uOct); }

// three layered noises at once (for bending the others)
vec3 fbm3(vec3 p, int oct) { vec3 s = vec3(0.0); float a = 0.5, t = 0.0; for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * vec3(snoise(p), snoise(p + vec3(31.4, 7.7, 2.9)), snoise(p + vec3(5.3, 57.1, 13.7))); t += a; p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s / t * 0.62 + 0.5; }

void main() {
  vec3 d = normalize(vPos), col = vec3(0.0016, 0.0018, 0.0032);  // never quite black: a deep blue-black
  float dust = 0.0;

  // ── the galaxy: a faint band of light right round the sky, brighter and warmer in its middle, clumpy with star
  // clouds, a soft lane of dust along it, and a grain of stars too far to see one by one
  float gs = dot(d, uGalN);
  if (abs(gs) < 0.6) {
    float lat = asin(gs), core = exp(-pow(angTo(d, uGalC) / 0.5, 2.0));
    vec3 p = d * 2.2 + 11.0, g3 = fbm3(p * 0.8, 3);
    float wob = (g3.x - 0.5) * 0.12, width = 0.12 + 0.07 * core + 0.04 * (g3.y - 0.5);
    float band = exp(-pow((lat - wob) / width, 2.0));
    float clumps = smoothstep(0.35, 0.8, fbm(p * 3.0, OCT(4)));
    float glow = band * (0.007 + 0.02 * clumps + 0.03 * core) + core * exp(-pow(lat / 0.22, 2.0)) * 0.018;
    float grain = pow(clamp(snoise(d * uGrain) * 0.5 + 0.5, 0.0, 1.0), 9.0) * band * 0.18;
    float lane = exp(-pow((lat - wob + (g3.z - 0.5) * 0.07) / (0.03 + 0.025 * core), 2.0)) * smoothstep(0.4, 0.7, fbm(p * 2.6 + 7.0, OCT(3)));
    float absorb = clamp(lane * 0.9, 0.0, 0.7);
    vec3 c = mix(vec3(0.62, 0.72, 1.0), vec3(0.98, 0.92, 0.84), core * 0.7);
    col += c * (glow + grain) * (1.0 - absorb);
    dust = max(dust, absorb * 0.7);
  }

  // ── the three nebulae never overlap, so a direction works out one set of noise, scaled for the one it is near
  vec3 Lr = d * uRose, Lv = d * uVeil, Le = d * uEye, Lf = d * uFar, Lc = d * uComet, L = vec3(0.0);
  int which = 0; float R = 1.0, k = 1.0; vec3 off = vec3(0.0);
  if (Lr.z > cos(uSizes.x * 1.7)) { which = 1; L = Lr; R = uSizes.x; k = 2.2; off = vec3(1.7, 3.1, 5.3); }
  else if (Lv.z > cos(uSizes.y * 1.8)) { which = 2; L = Lv; R = uSizes.y; k = 2.4; off = vec3(7.3, 2.2, 9.1); }
  else if (Le.z > cos(uSizes.z * 2.6)) { which = 3; L = Le; R = uSizes.z; k = 34.0; off = vec3(3.3, 8.8, 1.1); }
  if (which > 0) {
    vec2 uv = L.xy / R;
    vec3 p = d * k + off, w = fbm3(p * 1.1, 3) - 0.5;
    float body = fbm(p * 1.4 + w * 1.4, OCT(4));          // big soft billows
    float gas = fbm(p * 2.6 + w * 2.0, OCT(5));           // finer texture
    float laneN = fbm(p * 1.7 + w * 1.4 + 11.0, OCT(4));  // where the dust lies
    // threads: along the Veil's arc (thicker in some places than others), rays streaking out of the Eye's ring, or
    // round the Rose's billows
    vec2 ac = uv - vec2(-1.1, -0.55); float arc = length(ac) - 1.25, along = atan(ac.y, ac.x), wav = 0.2 * w.x;
    vec2 eu = (uv + vec2(0.06, -0.04)) * vec2(0.86, 1.0); float er = length(eu), ea = atan(eu.y, eu.x);
    vec3 tq = which == 2 ? vec3(along * 1.3, (arc + wav) * 9.0, 0.3) + w * vec3(0.25, 0.1, 0.25)
            : which == 3 ? vec3(cos(ea) * 4.0, sin(ea) * 4.0, er * 1.3) + w * 0.4 : p * 2.4 + w * 1.6;
    float thr = ridged(tq, OCT(4));
    if (which == 1) {
      // the Rose: a bright heart fading out into separate pink wisps with black space between them, violet round the
      // outside, a pale blue-white middle, and a curved lane of dust sweeping across it
      float r = length(uv * vec2(1.0, 1.25)) + 0.85 * (body - 0.5) + 0.35 * w.y;
      float shape = smoothstep(1.45, 0.0, r);
      float heart = exp(-r * r * 3.0);
      float clouds = shape * pow(body, 2.6) * 2.4 * smoothstep(0.32, 0.6, body + heart * 0.3);   // (breaks up toward the edge)
      float em = (heart * (0.3 + 0.5 * body) + clouds) * (0.7 + 0.6 * gas) + pow(thr, 5.0) * 0.4 * shape * smoothstep(0.45, 0.7, body);
      vec3 c = mix(vec3(0.5, 0.2, 0.85), vec3(1.0, 0.3, 0.56), smoothstep(0.05, 0.5, shape));
      c = mix(c, vec3(1.0, 0.62, 0.74), smoothstep(0.55, 0.85, gas) * shape);
      c = mix(c, vec3(1.0, 0.55, 0.8), heart * 0.5);
      // dust lanes: two curving across at different angles, and a scatter of smaller ones, each ragged and uneven
      vec2 ua = mat2(0.94, 0.34, -0.34, 0.94) * uv, ub = mat2(0.71, -0.71, 0.71, 0.71) * uv;
      float la = exp(-pow((ua.y - 0.25 * sin(ua.x * 1.9 + 0.7) + 0.1 + 0.2 * (laneN - 0.5)) / (0.09 + 0.1 * body), 2.0)) * smoothstep(0.9, 0.1, abs(ua.x + 0.15)) * 0.75;
      float lb = exp(-pow((ub.y - 0.2 * sin(ub.x * 2.6) - 0.35 + 0.2 * (laneN - 0.5)) / (0.07 + 0.07 * body), 2.0)) * smoothstep(0.7, 0.0, abs(ub.x - 0.1)) * 0.6;
      float lanes = max(max(la, lb), smoothstep(0.6, 0.76, laneN)) * smoothstep(1.1, 0.2, r);
      em += shape * 0.35 * smoothstep(0.2, 0.5, lanes) * (1.0 - smoothstep(0.5, 0.9, lanes));   // a bright edge along each lane
      col *= 1.0 - lanes * 0.6;
      col += c * em * 0.62 * (1.0 - lanes * 0.75);
      dust = max(dust, lanes * 0.75);
    } else if (which == 2) {
      // the Blue Veil: a soft blue glowing crescent of gas, with a few bright braided threads along its outer edge
      // where it is pushing out into space
      float sweepB = exp(-pow((arc + wav) / 0.34, 2.0));
      float shape = smoothstep(1.6, 0.25, length(uv)) * sweepB;
      float haze = shape * (0.1 + 1.3 * pow(body, 2.0)) * (0.75 + 0.5 * gas);
      float rim = exp(-pow((arc + wav - 0.12) / 0.14, 2.0)) * smoothstep(1.6, 0.3, length(uv));
      float strands = pow(thr, 5.0) * rim * (0.25 + 1.1 * body * gas);
      vec3 c = mix(vec3(0.12, 0.26, 0.9), vec3(0.3, 0.8, 1.0), smoothstep(0.3, 0.9, body));
      col += c * haze * 0.36 + mix(vec3(0.35, 0.85, 1.0), vec3(0.85, 0.97, 1.0), smoothstep(0.5, 1.0, strands)) * strands * 0.75;
      float lanes = smoothstep(0.56, 0.72, laneN) * shape * 0.6;
      col *= 1.0 - lanes * 0.6; dust = max(dust, lanes * 0.6);
    } else if (which == 3) {
      // the Amber Eye: a ring of glowing gas round a dying star, a little off-round: a sharp bright gold inner rim
      // fading outward, rays streaking out from it, a pale teal middle, and a faint red rim far out
      float r = er * (1.0 + 0.08 * w.x) + 0.04 * (gas - 0.5);
      float ring = (smoothstep(0.66, 0.82, r) * exp(-max(r - 0.82, 0.0) / 0.13)) * (0.6 + 0.8 * gas);
      float rays = pow(thr, 3.0) * smoothstep(0.78, 0.95, r) * exp(-max(r - 0.95, 0.0) / 0.22);
      float inner = smoothstep(0.85, 0.55, r) * (0.12 + 0.5 * smoothstep(0.2, 0.75, r)) * (0.6 + 0.6 * gas);
      float halo = exp(-pow((r - 1.45) / 0.25, 2.0)) * (0.3 + 0.7 * body);
      col += (vec3(1.0, 0.6, 0.16) * ring * 1.1 + vec3(1.0, 0.45, 0.12) * rays * 0.45 + vec3(0.45, 0.9, 0.82) * inner * 0.6 + vec3(0.9, 0.25, 0.12) * halo * 0.16) * 0.62;
    }
  }
  // ── a far spiral galaxy seen at a slant: a warm middle and bluish arms
  if (Lf.z > cos(uSizes.w * 3.0)) {
    vec2 uv = Lf.xy / uSizes.w; uv = vec2(uv.x * 0.94 + uv.y * 0.34, -uv.x * 0.34 + uv.y * 0.94); uv.y /= 0.42;
    float r = length(uv), a = atan(uv.y, uv.x), arms = 0.5 + 0.5 * cos(2.0 * a - 5.2 * log(r + 0.06));
    float clumpy = 0.75 + 0.5 * hash12(floor(uv * 14.0)) * smoothstep(0.1, 0.5, r);
    float disk = exp(-r / 0.32) * (0.35 + 0.9 * arms * smoothstep(0.08, 0.35, r)) * clumpy;
    col += vec3(0.55, 0.68, 1.0) * disk * 0.22 + vec3(1.0, 0.85, 0.62) * exp(-pow(r / 0.12, 2.0)) * 0.7;
  }
  // ── a comet: a bright head, a straight blue gas tail and a broader curved white dust tail, away from the sun
  if (Lc.z > 0.8) {
    float u = Lc.x, v = Lc.y;
    float streaks = 0.75 + 0.25 * sin(v * 2400.0 + sin(u * 40.0) * 2.0) * sin(v * 900.0 + 1.0);
    float fade = smoothstep(0.55, 0.3, u);
    float gasT = u > 0.0 ? exp(-u / 0.2) * exp(-pow(v / (0.0025 + u * 0.035), 2.0)) * streaks * fade : 0.0;
    float vc = v - u * u * 2.6;
    float dustT = u > 0.0 ? exp(-u / 0.14) * exp(-pow(vc / (0.003 + u * 0.22), 2.0)) * (0.8 + 0.2 * sin(vc / (0.003 + u * 0.22) * 5.0)) * fade : 0.0;
    float coma = exp(-length(vec2(u, v)) / 0.004) + 0.3 * exp(-length(vec2(u, v)) / 0.012);
    col += vec3(0.35, 0.65, 1.0) * gasT * 0.3 + vec3(1.0, 0.93, 0.8) * dustT * 0.32 + vec3(0.75, 1.0, 0.92) * coma * 0.5;
  }
  // stored as a square root (more steps in the darks), with a little noise so no gradient shows steps
  vec3 e = sqrt(clamp(col * 0.5, 0.0, 1.0)) + (hash33(d * 4096.0) - 0.5) / 255.0;
  gl_FragColor = vec4(e, dust + (hash12(d.xy * 3011.0 + d.z) - 0.5) / 255.0);
}`;


// ── the stars: points at infinity ────────────────────────────────────────────────────────────────────────────────
const STAR_VERT = /* glsl */`
attribute vec3 color; attribute float aSize;
uniform float uPx;
varying vec3 vC; varying float vK;
void main() {
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position.z = gl_Position.w * 0.99999;               // at the far plane: only where nothing is nearer
  float want = aSize * uPx, S = max(want, 2.8);           // (never under about 3 pixels, so a star never flickers as it moves)
  gl_PointSize = S; vC = color * (want * want) / (S * S); vK = aSize;
}`;
const STAR_FRAG = /* glsl */`
varying vec3 vC; varying float vK;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0; float r2 = dot(c, c);
  float a = exp(-r2 * 3.2) + (vK > 3.0 ? 0.12 * exp(-r2 * 1.1) : 0.0);
  a *= 1.0 - smoothstep(0.75, 1.0, r2);
  gl_FragColor = vec4(vC * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// how many stars of each colour (blue-white to red), as linear colours of about equal brightness
const STAR_COL = [[0.12, [0.62, 0.74, 1.15]], [0.24, [0.82, 0.9, 1.08]], [0.25, [1, 1, 1]], [0.2, [1.08, 0.98, 0.84]], [0.13, [1.15, 0.86, 0.6]], [0.06, [1.2, 0.68, 0.45]]];
function starColour(R) { let x = R(); for (const [w, c] of STAR_COL) { if ((x -= w) <= 0) return c; } return STAR_COL[2][1]; }
function starGeometry(n) {
  const pos = [], col = [], size = [], v = new THREE.Vector3();
  const e1 = new THREE.Vector3().crossVectors(GAL_N, UP).normalize(), e2 = new THREE.Vector3().crossVectors(GAL_N, e1);
  const gauss = (R) => { let u = 0; for (let k = 0; k < 4; k++) u += R(); return (u - 2) / 0.58; };
  const inBand = (R, spread) => { const a = R() * Math.PI * 2, l = gauss(R) * spread; return v.copy(e1).multiplyScalar(Math.cos(a) * Math.cos(l)).addScaledVector(e2, Math.sin(a) * Math.cos(l)).addScaledVector(GAL_N, Math.sin(l)).normalize(); };
  const anywhere = (R) => { const z = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - z * z); return v.set(s * Math.cos(a), z, s * Math.sin(a)); };
  const near = (R, c, spread) => { const F = frameAt(c); return v.copy(c).addScaledVector(F.r, gauss(R) * spread).addScaledVector(F.u, gauss(R) * spread).normalize(); };
  // flux: how bright (1 = a clear, bright star); the brighter, the bigger the dot and the truer its colour
  const add = (d, flux, c) => {
    pos.push(d.x, d.y, d.z); const k = Math.min(flux, 9);
    size.push(1.5 + 1.05 * Math.log2(1 + k * 2.5));
    const sat = Math.min(1, 0.45 + k * 0.5); col.push(...c.map((x) => (1 + (x - 1) * sat) * k));
  };
  // the bright ones are the same at every Graphics setting (they are what you'd steer by)
  const B = rng(777);
  for (let i = 0; i < 90; i++) add(B() < 0.4 ? inBand(B, 0.12) : anywhere(B), 0.7 + 5.5 * Math.pow(B(), 3), starColour(B));
  // a tight cluster of young blue stars, and a few hot stars lighting the Rose
  const R = rng(4242);
  for (let i = 0; i < 28; i++) add(near(R, skyDir(60, 33), 0.011), 0.15 + 1.6 * Math.pow(R(), 3), [0.72, 0.82, 1.12]);
  for (let i = 0; i < 14; i++) add(near(R, DIR.rose, 0.06), 0.3 + 2.0 * Math.pow(R(), 2), [0.7, 0.8, 1.15]);
  add(DIR.eye, 1.6, [0.75, 0.85, 1.15]);                                  // the Eye's dying star, in its middle
  add(DIR.comet, 1.3, [0.85, 1.0, 0.95]);                                 // the comet's head
  // the faint many: nearly half of them crowded along the galaxy band
  for (let i = 0; i < n; i++) { const d = R() < 0.55 ? inBand(R, 0.13) : anywhere(R); add(d, 0.075 * Math.pow(R() * 0.97 + 0.03, -0.55), starColour(R)); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  return g;
}

// ── the live sky: one triangle at the far plane ──────────────────────────────────────────────────────────────────
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vec4 v = inverse(projectionMatrix) * vec4(position.xy, 1.0, 1.0);
  vDir = transpose(mat3(viewMatrix)) * (v.xyz / v.w);    // this pixel's direction in the world
  gl_Position = vec4(position.xy, 0.99999, 1.0);
}`;
const SKY_FRAG = /* glsl */`
precision highp sampler3D;
uniform samplerCube uNeb;
uniform sampler3D uNoise;
uniform sampler2D uBands, uRing;
uniform vec3 uSun, uSunCol, uP, uA, uE1, uE2, uMag, uMag1, uMag2, uM, uAtm;
uniform float uSunR, uPr, uMr, uRin, uRout, uClock, uSpin;
varying vec3 vDir;
${HASH}
const float PI = 3.14159265, TAU = 6.2831853, SUNK = 1.55, AUR_TH = ${AURORA_COLAT.toFixed(3)};
float gFoot;                                             // how much of the unit planet one pixel covers here
// the noise volume, blurred as much as the pixel's footprint needs (s = how many tiles the unit sphere spans)
vec4 Nz(vec3 p, float s) { return textureLod(uNoise, p, max(0.0, log2(64.0 * s * gFoot))); }

// a storm: a swirling oval in the bands at (lat, lon), size (across, down)
vec3 storm(vec3 alb, vec2 ll, float cl, vec2 at, vec2 sz, vec3 col, float spin) {
  float dl = ll.x - at.y; dl -= TAU * floor(dl / TAU + 0.5);
  vec2 e = vec2(dl * cl / sz.x, (ll.y - at.x) / sz.y);
  float r = length(e), sw = (1.0 - smoothstep(0.0, 1.3, r)) * 3.2 + spin;
  vec2 q = mat2(cos(sw), sin(sw), -sin(sw), cos(sw)) * e;
  float n = Nz(vec3(q * 0.16 + 0.3, 0.41), 0.16 / max(sz.y, 0.02)).g;
  float body = smoothstep(1.05, 0.7, r + (n - 0.5) * 0.5);
  float rim = (smoothstep(1.45, 1.0, r) - body) * 0.55;
  alb = mix(alb, alb * vec3(0.72, 0.78, 0.86), rim);
  return mix(alb, col * (0.78 + 0.45 * n), body);
}
// the cloud tops: colour, and how thick the clouds are (for the lightning)
vec3 surface(vec3 n, out float cloud, out vec2 ll, out float cl) {
  float y = clamp(dot(n, uA), -1.0, 1.0), lat = asin(y), lon = atan(dot(n, uE2), dot(n, uE1));
  // the planet turns; neighbouring bands sway back and forth against each other (a sway, not a steady slide, so the
  // clouds never smear out into streaks however long you watch)
  float jet = smoothstep(-0.5, 0.5, sin(lat * 10.0 + 0.7)) - 0.5;
  float lonR = lon - uSpin * 0.0045 - jet * 0.35 * sin(uSpin * 0.004);
  cl = sqrt(max(1.0 - y * y, 0.0));
  vec3 pn = vec3(cl * cos(lonR), y, cl * sin(lonR));
  // the bands stay bands: their edges ripple in long slow waves and churn in small eddies drawn out along them
  // (each layer bends the point it reads the next one at, so the edges curl in eddies instead of smearing)
  vec4 a = Nz(pn * vec3(0.7, 2.6, 0.7) + vec3(0.1, 0.2, 0.3), 2.6);
  vec3 q = pn + (a.rgb - 0.5) * vec3(0.12, 0.035, 0.12);
  vec4 b = Nz(q * vec3(2.4, 7.0, 2.4) + vec3(0.37, 0.11, 0.73), 7.0);
  q += (b.rgb - 0.5) * vec3(0.05, 0.014, 0.05);
  float warp = (a.r - 0.5) * 0.03 + (b.g - 0.5) * 0.02, mott = b.a;
#if DETAIL > 0
  vec4 c = Nz(q * vec3(6.0, 15.0, 6.0) + vec3(0.71, 0.53, 0.29), 15.0);
  warp += (c.b - 0.5) * 0.012; mott = mott * 0.6 + c.a * 0.4;
  q += (c.rgb - 0.5) * vec3(0.02, 0.006, 0.02);
#endif
#if DETAIL > 1
  vec4 e = Nz(q * vec3(14.0, 32.0, 14.0) + vec3(0.19, 0.83, 0.47), 32.0);
  warp += (e.r - 0.5) * 0.006; mott = mott * 0.72 + e.g * 0.28;
#endif
  float u = lat / PI + 0.5 + warp;
  vec3 alb = textureLod(uBands, vec2(u, 0.5), max(0.0, log2(512.0 * gFoot / PI))).rgb;
  alb *= 0.9 + 0.2 * mott;
  ll = vec2(lonR, lat);
  alb = storm(alb, ll, cl, vec2(-0.44, 1.1), vec2(0.2, 0.085), vec3(0.98, 0.8, 0.66), uSpin * 0.02);
  alb = storm(alb, ll, cl, vec2(0.53, -2.1), vec2(0.1, 0.05), vec3(0.66, 0.58, 0.9), -uSpin * 0.03);
  cloud = mott;
  return alb;
}
// lightning: storm cells along two stormy belts, each flashing on its own clock (a burst of two or three strokes
// every few seconds); seen through the clouds as a soft glow
float lightning(vec2 ll, float cl, float cloud) {
  const float KX = 24.0 / TAU, KY = 6.0;
  vec2 g = vec2(ll.x * KX, ll.y * KY), id = floor(g);
  float glow = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = id + vec2(float(i), float(j));
    float cx = mod(c.x, 24.0), latc = (c.y + 0.5) / KY;
    float belt = exp(-pow((latc - 0.36) / 0.15, 2.0)) + 0.8 * exp(-pow((latc + 0.22) / 0.12, 2.0));
    vec3 h = hash32(vec2(cx, c.y) + 17.0);
    if (h.x > belt * 1.25) continue;
    float per = 0.8 + 1.8 * h.y, tt = uClock + h.z * 40.0, k = floor(tt / per), ft = tt - k * per;
    vec3 hk = hash32(vec2(cx + k * 7.13, c.y - k * 3.71));
    if (hk.x > 0.9) continue;                                            // some bursts are skipped
    vec2 ctr = c + 0.5 + (hk.yz - 0.5) * 0.4;
    vec2 off = (g - ctr) / vec2(KX, KY); off.x *= cl;                     // radians across the planet
    // (a flash and its glow stay well inside the cells looked at, so none is ever clipped into a square)
    float sz = 0.02 + 0.006 * hk.y;
    float f = exp(-ft * 24.0) + 0.75 * step(0.11, ft) * exp(-(ft - 0.11) * 28.0) + 0.55 * step(0.29, ft) * exp(-(ft - 0.29) * 20.0) * step(0.3, hk.z) + 0.2 * exp(-ft * 5.0);
    float d2 = dot(off, off) / (sz * sz);
    // a short jagged bolt across the core
    vec2 o = off / sz; float ca = cos(hk.z * 6.28), sa = sin(hk.z * 6.28); vec2 ob = vec2(ca * o.x + sa * o.y, ca * o.y - sa * o.x);
    float bolt = exp(-pow((ob.y - 0.35 * sin(ob.x * 4.0 + hk.y * 9.0) - 0.15 * sin(ob.x * 11.0)) / 0.12, 2.0)) * smoothstep(1.3, 0.2, abs(ob.x));
    glow += f * (0.6 + 0.8 * hk.z) * (exp(-d2 * 1.2) + 0.5 * exp(-d2 / 4.0) + bolt * 0.25);
  }
  return glow * (0.6 + 0.6 * smoothstep(0.3, 0.75, cloud));            // the flash lights up the clouds round it
}
float auroraBand(vec3 n, float wide) {
  float th = acos(clamp(dot(n, uMag), -1.0, 1.0)), lo = atan(dot(n, uMag2), dot(n, uMag1));
  float wob = 0.035 * sin(lo * 3.0 + uClock * 0.11) + 0.02 * sin(lo * 7.0 - uClock * 0.23) + 0.01 * sin(lo * 13.0 + uClock * 0.37);
  float band = exp(-pow((th - AUR_TH - wob) / wide, 2.0));
  float folds = 0.5 + 0.5 * sin(lo * 46.0 + 4.0 * sin(lo * 5.0 + uClock * 0.3) + uClock * 0.55);
  float surge = 0.65 + 0.35 * sin(lo * 4.0 - uClock * 0.21);                // brighter stretches drift round the ring
  return band * mix(0.7, 1.0, folds) * surge;
}
#if AURORA > 0
// the auroras as curtains of light in a thin shell above the clouds: green at the foot, pink and violet higher up;
// they rise above the planet's edge where you look along them
vec3 aurora(vec3 d, float tEnd) {
  vec3 C = uP; float r = uPr;
  vec3 oc = C + uMag * (r * cos(AUR_TH)); float ob = r * (sin(AUR_TH) + 0.13);
  float bb = dot(d, oc), hh = bb * bb - dot(oc, oc) + ob * ob; if (hh <= 0.0) return vec3(0.0);
  float sq = sqrt(hh), t0 = bb - sq, t1 = min(bb + sq, tEnd);
  float b = dot(d, C), r2 = r * 1.09, h2 = b * b - 1.0 + r2 * r2; if (h2 <= 0.0) return vec3(0.0);
  float s2 = sqrt(h2); t0 = max(t0, b - s2); t1 = min(t1, b + s2); if (t1 <= t0) return vec3(0.0);
  float dt = (t1 - t0) / float(AURORA), jit = hash12(gl_FragCoord.xy);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < AURORA; i++) {
    vec3 x = d * (t0 + (float(i) + jit) * dt) - C; float xl = length(x), hgt = xl / r - 1.0;
    if (hgt < 0.0) continue;
    vec3 n = x / xl;
    float hp = smoothstep(0.003, 0.011, hgt) * exp(-max(hgt - 0.011, 0.0) / 0.013);
    vec3 c = mix(vec3(0.12, 1.0, 0.42), vec3(0.5, 0.45, 0.6), smoothstep(0.012, 0.04, hgt));
    acc += c * auroraBand(n, 0.055) * hp * (1.0 - 0.45 * smoothstep(-0.1, 0.35, dot(n, uSun)));
  }
  return acc * dt / r * 22.0 * (0.8 + 0.2 * sin(uClock * 0.5) * sin(uClock * 0.17 + 1.0));
}
#endif
// a crater field: the nearest crater in cells of one size; adds its slope to g and its shade to alb
void craters(vec3 n, float scale, float depth, float keep, inout vec3 g, inout float alb) {
  vec3 p = n * scale, id = floor(p); float best = 9.0; vec3 bc = p;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 c = id + vec3(float(i), float(j), float(k)), h = hash33(c + scale * 7.0), pt = c + 0.15 + 0.7 * h;
    if (abs(length(pt) - scale) > 0.6 || fract(h.z * 17.0) > keep) continue;
    vec3 ps = normalize(pt) * scale; float x = length(p - ps) / (0.08 + 0.48 * h.x * h.x * h.x);
    if (x < best) { best = x; bc = ps; }
  }
  if (best > 1.6) return;
  vec3 away = p - bc; away -= n * dot(away, n); away = normalize(away + 1e-6);
  float slope = (best < 1.0 ? 1.6 * best : 0.0) - 2.4 * (best - 1.0) / 0.03 * 0.05 * exp(-pow((best - 1.0) / 0.17, 2.0));
  g += away * slope * depth;
  alb *= best < 0.9 ? 0.9 : 1.0 + 0.12 * exp(-pow((best - 1.02) / 0.12, 2.0));
}
vec3 moonSurface(vec3 n) {
  vec3 g = vec3(0.0); float alb = 0.5;
  craters(n, 2.6, 0.3, 0.3, g, alb);
  craters(n, 7.5, 0.2, 0.25, g, alb);
#if DETAIL > 0
  craters(n, 21.0, 0.1, 0.7, g, alb);
#endif
  float mare = smoothstep(0.36, 0.56, Nz(n * 0.45 + 0.4, 0.45).r + 0.12 * (Nz(n * 1.1 + 0.2, 1.1).g - 0.5));
  alb *= mix(1.0, 0.45, mare) * (0.88 + 0.24 * Nz(n * 2.6, 2.6).b);
  // one young crater, its bright rays splashed out across the plains
  vec3 yc = normalize(vec3(0.3, 0.55, -0.78)); vec3 rel = n - yc * dot(n, yc); float dist = length(rel);
  vec3 t1 = normalize(cross(yc, vec3(0.0, 1.0, 0.0))), t2 = cross(yc, t1); float ra = atan(dot(rel, t2), dot(rel, t1));
  float rays = pow(smoothstep(0.5, 0.85, Nz(vec3(cos(ra) * 5.0, sin(ra) * 5.0, 0.5), 5.0).b), 2.0) * exp(-dist / 0.3) * step(0.0, dot(n, yc));
  alb = mix(alb, 0.85, rays * 0.5 + 0.6 * exp(-pow(dist / 0.03, 2.0)));
  vec3 nb = normalize(n - g);
  float lit = max(dot(nb, uSun), 0.0) * smoothstep(-0.06, 0.06, dot(n, uSun));
  vec3 c = vec3(1.0, 0.97, 0.92) * alb * lit * SUNK * 0.95;
  c += vec3(0.3, 0.62, 0.65) * alb * 0.012 * max(dot(n, normalize(uP - uM)) + 0.3, 0.0);   // light from the planet on its dark side
  return c * vec3(1.0, 0.97, 0.93);
}

void main() {
  vec3 d = normalize(vDir);
  float pix = max(length(dFdx(d)), length(dFdy(d)));
  vec4 nb = textureLod(uNeb, d, 0.0);
  vec3 bg = nb.rgb * nb.rgb * 2.0; float bgA = nb.a;
  vec3 C = uP; float r = uPr;

  // ── the rings (worked out everywhere, so the ring picture can choose its own blur) ──
  float dA = dot(d, uA), tr = dot(C, uA) / (abs(dA) > 1e-4 ? dA : 1e-4);
  vec3 xr = d * tr; float rho = length(xr - C) / r;
  vec4 rs = texture(uRing, vec2((rho - uRin) / (uRout - uRin), 0.5));
  float ringA = (tr > 0.0 && rho > uRin * 0.99 && rho < uRout * 1.01) ? rs.a : 0.0;
  vec3 ringC = vec3(0.0);
  if (ringA > 0.002) {
    float mu = max(abs(dA), 0.06);
    ringA = 1.0 - pow(1.0 - min(ringA, 0.985), 0.42 / mu);             // seen at a slant, a ring stops more light
    float sunSide = sign(dot(uSun, uA)), viewSide = -sign(dot(C, uA)), mu0 = abs(dot(uSun, uA));
    float lit = (sunSide == viewSide ? 0.3 + 0.55 * sqrt(mu0) : 1.2 * (1.0 - rs.a) + 0.05) * 0.72;
    vec3 v = C - xr; float s = dot(v, uSun), dd = length(v - uSun * s);
    float shade = s > 0.0 ? smoothstep(r * 0.95, r * 1.07, dd) : 1.0;  // the planet's shadow across the rings
    ringC = rs.rgb * (lit * shade * SUNK * uSunCol + 0.006);
  }

  // ── the planet ──
  float b = dot(d, C), q = length(C - d * b), fq = max(fwidth(q), 1e-6);
  float cov = b > 0.0 ? clamp((r - q) / fq + 0.5, 0.0, 1.0) : 0.0;
  float tP = 1e9; vec3 pc = vec3(0.0), glow = vec3(0.0);
  if (b > 0.0 && q < r * 1.15) {
    float h = r * r - q * q, t = b - sqrt(max(h, 0.0));
    vec3 n = normalize(d * t - C);
    float mu = max(dot(n, -d), 0.0), ndl = dot(n, uSun);
    if (cov > 0.0) {
      tP = t;
      gFoot = pix / (r * max(mu, 0.04));
      float cloud, cl; vec2 ll;
      vec3 alb = surface(n, cloud, ll, cl);
      // daylight with a soft edge between day and night, a pink-orange line of dusk along it, darker toward the rim
      float x = clamp((ndl + 0.12) / 1.12, 0.0, 1.0), day = x * x * (3.0 - 2.0 * x) * 0.4 + x * 0.6;
      vec3 H = d * t; float sr = dot(C - H, uA) / dot(uSun, uA);         // the rings' shadow on the clouds
      float ringSh = 0.0;
      if (sr > 0.0) { float rr = length(H + uSun * sr - C) / r; ringSh = textureLod(uRing, vec2((rr - uRin) / (uRout - uRin), 0.5), 5.5).a; }
      pc = alb * day * (1.0 - 0.62 * ringSh) * SUNK * uSunCol * mix(0.6, 1.0, pow(mu, 0.3));
      pc += alb * vec3(1.0, 0.42, 0.3) * exp(-pow((ndl - 0.01) / 0.09, 2.0)) * 0.16;
      pc += alb * vec3(0.016, 0.02, 0.026) * (1.0 - day);                 // faint light off the rings on the night side
      float night = 1.0 - smoothstep(-0.12, 0.06, ndl);
      pc += vec3(0.55, 0.7, 1.0) * lightning(ll, cl, cloud) * night * smoothstep(0.0, 0.12, mu) * 2.4;   // (faded at the edge, where a flash would smear)
      // the auroras' crown glowing on the clouds round the pole (on low, the whole of the auroras)
      pc += vec3(0.15, 1.0, 0.45) * auroraBand(n, 0.05) * (AURORA == 0 ? 0.9 : 0.75) * (1.0 - 0.45 * smoothstep(-0.1, 0.35, ndl));
    }
    // the air: a thin glowing rim inside the edge and a haze just outside it, bright on the day side
    vec3 nl = normalize(d * b - C);
    float limbLit = smoothstep(-0.32, 0.45, dot(nl, uSun));
    float rim = q < r ? pow(1.0 - sqrt(max(1.0 - (q * q) / (r * r), 0.0)), 5.0) : exp(-(q - r) / (r * 0.014));
    glow += uAtm * rim * (0.03 + limbLit * limbLit) * 0.85;
#if AURORA > 0
    glow += aurora(d, tP);
#endif
  }

  // ── front to back: rings in front of the planet, or behind it ──
  vec3 col; float alpha;
  if (tr < tP) { col = ringC * ringA + (1.0 - ringA) * (pc * cov + glow); alpha = ringA + (1.0 - ringA) * cov; }
  else { col = pc * cov + glow + (1.0 - cov) * ringC * ringA; alpha = cov + (1.0 - cov) * ringA; }

  // ── the moon ──
  {
    vec3 Mc = uM; float bm = dot(d, Mc), qm = length(Mc - d * bm), fm = max(fwidth(qm), 1e-6);
    float covM = bm > 0.0 ? clamp((uMr - qm) / fm + 0.5, 0.0, 1.0) : 0.0;
    if (covM > 0.0) {
      float tm = bm - sqrt(max(uMr * uMr - qm * qm, 0.0)); vec3 n = normalize(d * tm - Mc);
      gFoot = pix / (uMr * max(dot(n, -d), 0.04));
      col += moonSurface(n) * covM * (1.0 - alpha); alpha += covM * (1.0 - alpha);
    }
  }

  // ── the sun: a white-hot disc and a round glare ──
  float ds = length(d - uSun), fs = max(fwidth(ds), 1e-6);
  float disc = clamp((uSunR - ds) / fs + 0.5, 0.0, 1.0);
  vec3 sun = uSunCol * (disc * 12.0 + 1.6 * exp(-ds / (uSunR * 1.3)) + 0.5 * exp(-ds / 0.03) + 0.09 * exp(-ds / 0.14));

  vec3 rgb = col + bg * (1.0 - alpha) + sun * (1.0 - alpha * 0.9);
  alpha = alpha + bgA * (1.0 - alpha);
  // a whisper of noise, so the smooth dark gradients never show steps
  float dz = hash12(gl_FragCoord.xy) - 0.5;
  rgb = max(rgb * (1.0 + dz * 0.03) + dz * 0.0007, 0.0);
  gl_FragColor = vec4(rgb, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ── making it ────────────────────────────────────────────────────────────────────────────────────────────────────
const SHARED = { noise: null, bands: null, ring: null };
function sharedTextures() {
  if (!SHARED.noise) { const t0 = performance.now(); SHARED.noise = noiseVolume(); SHARED.bands = bandTexture(); SHARED.ring = ringTexture(); SHARED.ms = performance.now() - t0; }
  return SHARED;
}

export function createSky(renderer, opts = {}) {
  let Q = SKY_QUALITY[opts.quality] || SKY_QUALITY.medium, qName = opts.quality in SKY_QUALITY ? opts.quality : 'medium', turn = 1;
  const T = sharedTextures(), object = new THREE.Group(); object.name = 'sky';
  const stats = { quality: qName, textureMs: Math.round(T.ms), cube: 0, cubeMs: 0, starMs: 0, bytes: {} };

  // the still sky's cube map, drawn by the GPU
  const cubeScene = new THREE.Scene(), cubeMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: CUBE_FRAG, side: THREE.BackSide, depthTest: false, depthWrite: false,
    uniforms: {
      uRose: { value: basis(frameAt(DIR.rose, 18)) }, uVeil: { value: basis(frameAt(DIR.veil, -12)) }, uEye: { value: basis(frameAt(DIR.eye, 30)) },
      uFar: { value: basis(frameAt(DIR.farGalaxy, 0)) }, uComet: { value: null },
      uSizes: { value: new THREE.Vector4(SIZE.rose * D2R, SIZE.veil * D2R, SIZE.eye * D2R, SIZE.farGalaxy * D2R) },
      uGalN: { value: GAL_N }, uGalC: { value: GAL_C }, uSun: { value: DIR.sun }, uGrain: { value: 200 }, uOct: { value: 0 },
    },
  });
  { // the comet's frame: its tail points straight away from the sun
    const c = DIR.comet, away = DIR.sun.clone().negate(), tail = away.addScaledVector(c, -away.dot(c)).normalize(), across = new THREE.Vector3().crossVectors(c, tail);
    cubeMat.uniforms.uComet.value = new THREE.Matrix3().set(tail.x, across.x, c.x, tail.y, across.y, c.y, tail.z, across.z, c.z);
  }
  cubeScene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), cubeMat));
  let cubeRT = null;
  function bakeCube() {
    if (cubeRT) cubeRT.dispose();
    cubeRT = new THREE.WebGLCubeRenderTarget(Q.cube, { type: THREE.UnsignedByteType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    cubeMat.uniforms.uGrain.value = Q.cube / 5.5; cubeMat.uniforms.uOct.value = Q.detail;
    const cc = new THREE.CubeCamera(0.1, 10, cubeRT), t0 = performance.now();
    cc.update(renderer, cubeScene);
    renderer.readRenderTargetPixels(cubeRT, 0, 0, 1, 1, new Uint8Array(4), 0);   // (waits for the GPU to finish, for the timing)
    // (the time includes building the shader the first time, which is most of it)
    stats.cubeMs = Math.round(performance.now() - t0); stats.cube = Q.cube; stats.bytes.cube = Q.cube * Q.cube * 6 * 4;
    if (skyMat) skyMat.uniforms.uNeb.value = cubeRT.texture;
  }

  // the stars
  const starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: { uPx: { value: 1 } },
    depthTest: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  });
  let stars = null;
  function makeStars() {
    const t0 = performance.now();
    if (stars) { stars.geometry.dispose(); object.remove(stars); }
    stars = new THREE.Points(starGeometry(Q.stars), starMat); stars.frustumCulled = false; stars.renderOrder = 999; stars.name = 'sky:stars';
    object.add(stars); stats.starMs = Math.round(performance.now() - t0); stats.stars = stars.geometry.attributes.position.count; stats.bytes.stars = stats.stars * 7 * 4;
  }

  // the live sky
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, defines: { DETAIL: Q.detail, AURORA: Q.aurora },
    depthTest: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    uniforms: {
      uNeb: { value: null }, uNoise: { value: T.noise }, uBands: { value: T.bands }, uRing: { value: T.ring },
      uSun: { value: DIR.sun }, uSunCol: { value: new THREE.Vector3(1.0, 0.94, 0.85) }, uSunR: { value: Math.sin(SIZE.sun * D2R) },
      uP: { value: DIR.planet }, uPr: { value: Math.sin(SIZE.planet * D2R) }, uA: { value: AXIS }, uE1: { value: EQ1 }, uE2: { value: EQ2 },
      uMag: { value: MAG }, uMag1: { value: MAG1 }, uMag2: { value: MAG2 }, uAtm: { value: new THREE.Vector3(0.3, 0.72, 1.0) },
      uM: { value: DIR.moon }, uMr: { value: Math.sin(SIZE.moon * D2R) }, uRin: { value: RING[0] }, uRout: { value: RING[1] },
      uClock: { value: 0 }, uSpin: { value: 600 },
    },
  });
  const dome = new THREE.Mesh(tri, skyMat); dome.frustumCulled = false; dome.renderOrder = 1000; dome.name = 'sky:dome';
  object.add(dome);
  stats.bytes.noise = 64 * 64 * 64 * 4; stats.bytes.bands = 512 * 4; stats.bytes.ring = 2048 * 4;

  bakeCube(); makeStars();

  let clock = 0, spin = 600;
  return {
    object, stats, views: SKY_VIEWS, DIR,
    get quality() { return qName; },
    update(dt) {
      clock = (clock + dt) % 3600; spin += dt * turn;
      skyMat.uniforms.uClock.value = clock; skyMat.uniforms.uSpin.value = spin; starMat.uniforms.uPx.value = renderer.getPixelRatio();
    },
    setQuality(q) {
      if (!(q in SKY_QUALITY) || q === qName) return; qName = stats.quality = q; Q = SKY_QUALITY[q];
      skyMat.defines.DETAIL = Q.detail; skyMat.defines.AURORA = Q.aurora; skyMat.needsUpdate = true;
      bakeCube(); makeStars();
    },
    setTurn(k) { turn = k; },
    get turn() { return turn; },
    dispose() { cubeRT?.dispose(); stars?.geometry.dispose(); tri.dispose(); skyMat.dispose(); starMat.dispose(); cubeMat.dispose(); },
  };
}
