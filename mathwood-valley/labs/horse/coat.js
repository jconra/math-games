// THE COAT: a horse's hair worked out in the shader, on the plain sculpted body (horse.glb: one skinned mesh for the
// body, mane and tail, and a small glossy mesh for the eyes). Nothing is painted into a picture: every pixel asks where
// it sits on the horse standing at rest (its "rest position", which rides along with the bones however the horse moves,
// so a marking never slides) and works out its own colour, its hair streaks and its shine from a coat recipe.
//
//   prepareHorse(scene, scale) -> shape     once per loaded model: finds the body and the eyes, the landmarks (the poll,
//                                           the nose, the eyes, the knees and hocks, the hoof tops), and stores three
//                                           small numbers per corner on the body (which part it is, the mane and tail,
//                                           the way the hair lies)
//   coatMaterial(shape, recipe) -> material a MeshStandardMaterial with the coat added (one per horse; the program is
//                                           shared, so a whole stable costs one shader compile)
//   material.coat.set(recipe)               a new coat, live (just uniforms: nothing recompiles)
//   material.coat.uniforms                  the knobs (see COAT_UNIFORMS below)
//
// The recipe (recipes.js): base colour, black points, mane and tail colour, a face marking, a marking per leg, greying
// and dapples, a pinto pattern, a seed. See recipes.js for the presets.
import * as THREE from 'three';

// ── the noise: one small random picture, read so it gives smooth 3D noise in a single lookup ─────────────────────────
// Red is random; green is red moved 37 across and 17 down, so one read gives two neighbouring "layers" of noise and the
// shader blends between them (blue and alpha: a second, independent pair). 256 x 256, 256 KB on the card.
let NOISE = null;
export function noiseTexture() {
  if (NOISE) return NOISE;
  const S = 256, d = new Uint8Array(S * S * 4), R = new Uint8Array(S * S), B = new Uint8Array(S * S);
  let s = 20261026;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < S * S; i++) { R[i] = rnd() * 255; B[i] = rnd() * 255; }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, j = ((y + 17) & 255) * S + ((x + 37) & 255);
    d[i * 4] = R[i]; d[i * 4 + 1] = R[j]; d[i * 4 + 2] = B[i]; d[i * 4 + 3] = B[j];
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.needsUpdate = true; t.name = 'coat noise';
  NOISE = t; return t;
}

// ── the model's shape ──────────────────────────────────────────────────────────────────────────────────────────────────
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const GROUPS = {   // bone names as three.js gives them (the dots dropped: FrontUpperLeg.L is FrontUpperLegL)
  legs: /^(FrontUpperLeg|FrontLowerLeg|IKFrontLeg|FF[LR]$|BackUpperLeg|BackLowerLeg|IKBackLeg|FFB[LR]$)/,
  hq: /^(BackShoulder|BackLeg[LR]$)/,
  neck: /^Neck/,
  head: /^(Head|Ear)/,
  ear: /^Ear/,
  tail: /^Tail/,
};

export function prepareHorse(scene, scale) {
  let body = null, eye = null;
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (o.material && o.material.name === 'eye') eye = o;
    else if (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count) body = o;
  });
  if (!body) throw new Error('no skinned body in the horse model');
  // the rest transform: the file's positions are packed into -1..1; at rest every bone carries them to the same place,
  // so one bone's (bone x its bind inverse) turns a packed position into metres, standing on y = 0, facing +Z
  const keep = scene.scale.x; scene.scale.setScalar(scale); scene.updateMatrixWorld(true);
  const sk = body.skeleton, bi = Math.max(0, sk.bones.findIndex((b) => b.name === 'Body'));
  const M = new THREE.Matrix4().multiplyMatrices(sk.bones[bi].matrixWorld, sk.boneInverses[bi]);
  const bone = (n) => { const b = sk.bones.find((x) => x.name === n); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  const B = {};
  for (const n of ['Head', 'Neck1', 'Neck3', 'Torso3', 'Tail1', 'Tail2', 'FrontLowerLegL', 'BackLowerLegL', 'IKFrontLegL', 'IKBackLegL', 'BackUpperLegL', 'FrontUpperLegL']) B[n] = bone(n);
  scene.scale.setScalar(keep); scene.updateMatrixWorld(true);

  const g = body.geometry, P = g.attributes.position, N = g.attributes.normal, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const n = P.count, names = sk.bones.map((b) => b.name);
  const rest = new Float32Array(n * 3), nrm = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(M); rest[i * 3] = v.x; rest[i * 3 + 1] = v.y; rest[i * 3 + 2] = v.z;
    v.fromBufferAttribute(N, i).transformDirection(M); nrm[i * 3] = v.x; nrm[i * 3 + 1] = v.y; nrm[i * 3 + 2] = v.z;
  }
  // each corner's share in each group of bones
  const W = {}; for (const k in GROUPS) W[k] = new Float32Array(n);
  const inGroup = names.map((nm) => Object.keys(GROUPS).filter((k) => GROUPS[k].test(nm)));
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) {
    const j = SI.getComponent(i, c), w = SW.getComponent(i, c);
    if (w > 0) for (const k of inGroup[j]) W[k][i] += w;
  }

  // landmarks (metres)
  const eyeC = [];
  if (eye) {
    const EP = eye.geometry.attributes.position, L = [], R = [];
    for (let i = 0; i < EP.count; i++) { v.fromBufferAttribute(EP, i).applyMatrix4(M); (v.x > 0 ? L : R).push(v.clone()); }
    for (const A of [L, R]) eyeC.push(A.reduce((s, p) => s.add(p), V(0, 0, 0)).divideScalar(Math.max(1, A.length)));
    eyeC.r = Math.max(...L.map((p) => p.distanceTo(eyeC[0])), 0.02);
  }
  const poll = B.Head.clone();
  let nose = null;
  for (let i = 0; i < n; i++) if (W.head[i] > 0.5 && (!nose || rest[i * 3 + 2] > nose.z)) nose = V(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
  if (!eyeC.length) { const e = poll.clone().lerp(nose, 0.25); eyeC.push(e.clone().setX(0.12), e.clone().setX(-0.12)); eyeC.r = 0.03; }
  const midX = (eyeC[0].x + eyeC[1].x) / 2;
  nose.x = midX; poll.x = midX;
  const faceA = nose.clone().sub(poll), faceL = faceA.length(); faceA.normalize();
  const faceF = new THREE.Vector3().crossVectors(faceA, V(1, 0, 0)).normalize();
  if (faceF.y < 0) faceF.negate();
  // the middle of the face, which drifts a little sideways down the sculpted face: fitted as a line along it, from the
  // corners on the front of the face (facing out of the forehead or the nose)
  let sw = 0, st = 0, sx = 0, stt = 0, stx = 0;
  for (let i = 0; i < n; i++) {
    if (W.head[i] < 0.6 || W.ear[i] > 0.2) continue;
    v.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]).sub(poll);
    const t = v.dot(faceA) / faceL; if (t < 0.15 || t > 1.02) continue;
    const nn = V(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
    const fr = Math.max(nn.dot(faceF), t > 0.8 ? nn.dot(faceA) : 0); if (fr < 0.6) continue;
    const x = rest[i * 3], w = fr;
    sw += w; st += w * t; sx += w * x; stt += w * t * t; stx += w * t * x;
  }
  const den = sw * stt - st * st, mid1 = den > 1e-9 ? (sw * stx - st * sx) / den : 0, mid0 = sw > 0 ? (sx - mid1 * st) / sw : midX;
  const knee = B.FrontLowerLegL.y, hock = B.BackLowerLegL.y, fetlock = (B.IKFrontLegL.y + B.IKBackLegL.y) / 2;
  const legSplit = (B.FrontUpperLegL.z + B.BackUpperLegL.z) / 2;
  // the hoof's top (the coronet): the lowest height where the leg is no wider than the pastern above it. In practice the
  // hoof is about 40% of the way from the ground to the fetlock joint
  const hoofTop = fetlock * 0.5;

  // the hair's lie, one way per part (in rest space): along the barrel back and a little down, straight down the legs,
  // down the hindquarters, from the poll to the withers down the neck, from the forehead to the nose down the face
  const neckO = B.Neck1.clone(), neckA = poll.clone().sub(neckO), neckL = neckA.length(); neckA.normalize();
  const AX = {
    body: V(0, -0.32, -1).normalize(), hq: V(0, -1, -0.45).normalize(), legs: V(0, -1, 0.04).normalize(),
    neck: neckA.clone().negate().add(V(0, -0.25, 0)).normalize(), head: faceA.clone(),
    mane: new THREE.Vector3().crossVectors(neckA, V(1, 0, 0)).normalize(), tail: V(0, -1, -0.18).normalize(),
  };
  if (AX.mane.y > 0) AX.mane.negate();          // (down from the crest)

  // THE MANE: a band down from the crest of the neck, from the withers to the poll, and the forelock between the ears.
  // The crest is the highest the neck reaches (across the neck's line) at each place along it.
  const up = new THREE.Vector3().crossVectors(V(1, 0, 0), neckA).normalize(); if (up.y < 0) up.negate();
  const mane = new Float32Array(n), along = new Float32Array(n), tailH = new Float32Array(n);
  const tA = new Float32Array(n), hA = new Float32Array(n), crest = new Map(), bin = (t) => Math.round(t / 0.04);
  const withersT = -0.12;
  for (let i = 0; i < n; i++) {
    v.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]).sub(neckO);
    const t = v.dot(neckA), h = v.dot(up); tA[i] = t; hA[i] = h;
    const ok = W.legs[i] + W.tail[i] < 0.3 && t > withersT - 0.1 && t < neckL + 0.06 && rest[i * 3 + 2] > legSplit;
    if (ok) { const k = bin(t); if (!crest.has(k) || h > crest.get(k)) crest.set(k, h); }
  }
  const crestAt = (t) => { const k = t / 0.04, a = Math.floor(k), f = k - a; const c0 = crest.get(a), c1 = crest.get(a + 1); return c0 === undefined ? c1 ?? -9 : c1 === undefined ? c0 : c0 + (c1 - c0) * f; };
  for (let i = 0; i < n; i++) {
    const t = tA[i], h = hA[i];
    if (W.legs[i] + W.tail[i] > 0.3 || t < withersT - 0.08 || t > neckL + 0.05 || rest[i * 3 + 2] < legSplit) continue;
    const band = 0.17 * THREE.MathUtils.smoothstep(t, withersT - 0.06, withersT + 0.22) * (1 - 0.35 * THREE.MathUtils.smoothstep(t, neckL - 0.25, neckL));
    if (band < 0.005) continue;
    const c = crestAt(t), d = c - h;                 // how far below the crest
    const m = 1 - THREE.MathUtils.smoothstep(d, band - 0.02, band + 0.02);
    if (m > mane[i]) { mane[i] = m; along[i] = THREE.MathUtils.clamp(d / band, 0, 1); }
  }
  // the forelock: on the head, in front of the poll, between the ears, above the eyes
  for (let i = 0; i < n; i++) {
    const x = rest[i * 3] - midX, y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    if (W.head[i] < 0.5 || W.ear[i] > 0.3) continue;
    const f = (1 - THREE.MathUtils.smoothstep(Math.abs(x), 0.05, 0.085)) * THREE.MathUtils.smoothstep(z, poll.z - 0.02, poll.z + 0.04)
      * THREE.MathUtils.smoothstep(y, eyeC[0].y + 0.03, eyeC[0].y + 0.08) * (1 - THREE.MathUtils.smoothstep(z, poll.z + 0.13, poll.z + 0.17));
    if (f > mane[i]) { mane[i] = f; along[i] = THREE.MathUtils.clamp((poll.y + 0.08 - y) / 0.12, 0, 1); }
  }
  // THE TAIL: the hair, not the dock's skin at its root
  let tailLow = 9; for (let i = 0; i < n; i++) if (W.tail[i] > 0.5) tailLow = Math.min(tailLow, rest[i * 3 + 1]);
  const tailTop = B.Tail2.y;
  for (let i = 0; i < n; i++) {
    const z = rest[i * 3 + 2], y = rest[i * 3 + 1];
    const t = THREE.MathUtils.smoothstep(W.tail[i], 0.3, 0.7) * THREE.MathUtils.smoothstep(-z, -B.Tail1.z + 0.03, -B.Tail1.z + 0.1);
    tailH[i] = t;
    if (t > 0) along[i] = Math.max(along[i] * (1 - t), THREE.MathUtils.clamp((tailTop - y) / (tailTop - tailLow), 0, 1) * t);
  }

  // into three small attributes (bytes, so the three of them cost 12 bytes a corner)
  const aRegion = new Uint8Array(n * 4), aMark = new Uint8Array(n * 4), aFlow = new Int8Array(n * 4), f = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const legs = W.legs[i], neck = W.neck[i], head = W.head[i], hq = W.hq[i], body = Math.max(0, 1 - legs - neck - head - hq - W.tail[i]);
    aRegion[i * 4] = 255 * Math.min(1, legs); aRegion[i * 4 + 1] = 255 * Math.min(1, neck); aRegion[i * 4 + 2] = 255 * Math.min(1, head); aRegion[i * 4 + 3] = 255 * Math.min(1, hq);
    aMark[i * 4] = 255 * tailH[i]; aMark[i * 4 + 1] = 255 * mane[i]; aMark[i * 4 + 2] = 255 * along[i]; aMark[i * 4 + 3] = 255 * Math.min(1, W.ear[i]);
    f.set(0, 0, 0).addScaledVector(AX.body, body).addScaledVector(AX.hq, hq).addScaledVector(AX.legs, legs).addScaledVector(AX.neck, neck).addScaledVector(AX.head, head).addScaledVector(AX.tail, W.tail[i]);
    const hair = Math.min(1, mane[i] + tailH[i]);
    if (hair > 0) f.lerp(V(0, 0, 0).addScaledVector(AX.mane, mane[i]).addScaledVector(AX.tail, tailH[i]).normalize(), hair);
    f.normalize(); aFlow[i * 4] = 127 * f.x; aFlow[i * 4 + 1] = 127 * f.y; aFlow[i * 4 + 2] = 127 * f.z;
  }
  const tAO = performance.now();
  const ao = bakeAO(rest, nrm, g.index ? g.index.array : null, n);
  for (let i = 0; i < n; i++) aFlow[i * 4 + 3] = Math.round(127 * ao[i]);
  const msAO = performance.now() - tAO;
  g.setAttribute('aRegion', new THREE.BufferAttribute(aRegion, 4, true));
  g.setAttribute('aMark', new THREE.BufferAttribute(aMark, 4, true));
  g.setAttribute('aFlow', new THREE.BufferAttribute(aFlow, 4, true));

  const shape = {
    body, eye, M, poll, nose, faceA, faceF, faceL, eyeL: eyeC[0], eyeR: eyeC[1], eyeR0: eyeC.r, midX, mid0, mid1,
    knee, hock, fetlock, hoofTop, legSplit, neckO, neckA, neckL, AX, verts: n, tris: (g.index ? g.index.count : n) / 3,
    attrBytes: n * 12, msAO,
  };
  shape.glsl = shapeGLSL(shape);
  shape.key = 'horsecoat:' + hashStr(shape.glsl);
  return shape;
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); }
const fl = (x) => (Math.abs(x) < 1e-6 ? '0.0' : x.toFixed(5));
const v3 = (p) => `vec3(${fl(p.x)}, ${fl(p.y)}, ${fl(p.z)})`;
function shapeGLSL(S) {
  return `
const vec3 POLL = ${v3(S.poll)};
const vec3 FACE_A = ${v3(S.faceA)};
const vec3 FACE_F = ${v3(S.faceF)};
const float FACE_L = ${fl(S.faceL)};
const vec3 EYE_L = ${v3(S.eyeL)};
const vec3 EYE_R = ${v3(S.eyeR)};
const float EYE_R0 = ${fl(S.eyeR0)};
const float MIDX = ${fl(S.midX)};
const float MID0 = ${fl(S.mid0)};   // the face's middle: x = MID0 + MID1 * (0 at the poll .. 1 at the nose)
const float MID1 = ${fl(S.mid1)};
const float KNEE_Y = ${fl(S.knee)};
const float HOCK_Y = ${fl(S.hock)};
const float FETLOCK_Y = ${fl(S.fetlock)};
const float HOOF_Y = ${fl(S.hoofTop)};
const float LEGSPLIT_Z = ${fl(S.legSplit)};
const vec3 NECK_O = ${v3(S.neckO)};
const vec3 NECK_A = ${v3(S.neckA)};
const float NECK_L = ${fl(S.neckL)};
const vec3 AX_BODY = ${v3(S.AX.body)};
const vec3 AX_HQ = ${v3(S.AX.hq)};
const vec3 AX_LEG = ${v3(S.AX.legs)};
const vec3 AX_NECK = ${v3(S.AX.neck)};
const vec3 AX_HEAD = ${v3(S.AX.head)};
const vec3 AX_MANE = ${v3(S.AX.mane)};
const vec3 AX_TAIL = ${v3(S.AX.tail)};
`;
}

// ── the shader ────────────────────────────────────────────────────────────────────────────────────────────────────────
const VERT_PARS = /* glsl */`
attribute vec4 aRegion;   // legs, neck, head, hindquarters (the body is what's left)
attribute vec4 aMark;     // tail hair, mane hair, root-to-tip along the long hair, ears
attribute vec4 aFlow;     // the way the hair lies, at rest
uniform mat4 uRestM;
varying vec3 vRest;
varying vec4 vRestN;     // the rest normal, and (w) how much sky the spot sees
varying vec3 vFlowV;
varying vec4 vRegion;
varying vec4 vMark;
`;
const VERT_MAIN = /* glsl */`
{
  vec3 coatFlow = aFlow.xyz;
  #ifdef USE_SKINNING
    coatFlow = ( skinMatrix * vec4( coatFlow, 0.0 ) ).xyz;
  #endif
  vFlowV = normalize( ( modelViewMatrix * vec4( coatFlow, 0.0 ) ).xyz );
  vRest = ( uRestM * vec4( position, 1.0 ) ).xyz;
  vRestN = vec4( normalize( ( uRestM * vec4( normal, 0.0 ) ).xyz ), aFlow.w );
  vRegion = aRegion;
  vMark = aMark;
}
`;

const FRAG_PARS = /* glsl */`
uniform sampler2D uNoise;
uniform vec3 uBase;        // the body colour
uniform vec3 uPointsCol;   // the points (legs, ear tips) when there are points
uniform vec3 uManeCol;     // the mane and tail
uniform vec3 uWhiteCol;    // white hair
uniform vec3 uSkinCol;     // bare dark skin: the muzzle, round the eyes
uniform vec3 uPinkCol;     // pink skin under white hair on the muzzle
uniform vec3 uHoofDark;
uniform vec3 uHoofPale;
uniform vec4 uCoat;        // points, lighter underside, darker top line, dark muzzle
uniform vec4 uGrey;        // greying (0 none .. 1 white), dapples, dapple size (m), darker grey legs
uniform vec4 uFace;        // marking (0 none, 1 star, 2 stripe, 3 blaze, 4 bald face, 5 snip), size, raggedness, star too
uniform vec4 uLegs;        // white up to this height (m) on each leg: front left, front right, hind left, hind right
uniform vec4 uPinto;       // pattern (0 none, 1 tobiano, 2 overo, 3 sabino), how much white, roaning, -
uniform vec3 uSeed;
uniform vec4 uFur;         // streak bump, streak colour, velvet sheen, coat shine
uniform vec4 uHair;        // dark roots, light tips, strand variation, mane shine
uniform float uPx;         // metres across one pixel, one metre away
uniform float uMask;       // a debug view (0: the coat)
uniform float uAO;         // how strongly the baked shade darkens
varying vec3 vRest;
varying vec4 vRestN;
varying vec3 vFlowV;
varying vec4 vRegion;
varying vec4 vMark;
// (set in main, read by the light function below)
vec3 furT = vec3( 0.0, 1.0, 0.0 );
float furSheen = 0.0;
float furShine = 0.0;
float furShinePow = 24.0;
float furSlope = 0.0;
vec3 furAcrossR = vec3( 1.0, 0.0, 0.0 );
float furRough = 0.6;
float furFineFade = 1.0;
float furMedFade = 1.0;
float furHairN = 0.5;        // the fine streak noise here (white edges break up hair by hair)
SHAPE_CONSTANTS
const float FINE_F = 300.0;   // fine hair streaks: about 3 mm across ...
const float FINE_S = 7.0;     // ... and 7 times as long
const float MED_F = 70.0;     // the coat's lie: about 1.5 cm across
const float MED_S = 5.0;
const float HAIR_F = 120.0;   // mane and tail strands
const float HAIR_S = 16.0;
const float HAIRC_F = 30.0;   // and their locks
const float HAIRC_S = 8.0;

// smooth 3D value noise from one texture read (0..1)
float vnoise( vec3 x ) {
  x = mod( x, 256.0 );
  vec3 p = floor( x ); vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  vec2 uv = ( p.xy + vec2( 37.0, 17.0 ) * p.z ) + f.xy;
  vec2 rg = texture2D( uNoise, ( uv + 0.5 ) / 256.0 ).xy;
  return mix( rg.x, rg.y, f.z );
}
float vnoiseB( vec3 x ) {
  x = mod( x, 256.0 );
  vec3 p = floor( x ); vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  vec2 uv = ( p.xy + vec2( 37.0, 17.0 ) * p.z ) + f.xy;
  vec2 ba = texture2D( uNoise, ( uv + 0.5 ) / 256.0 ).zw;
  return mix( ba.x, ba.y, f.z );
}
float fbm2( vec3 x ) { return vnoise( x ) * 0.65 + vnoiseB( x * 2.07 + 7.3 ) * 0.35; }
vec3 hash33( vec3 p ) {
  p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) );
  p += dot( p, p.yxz + 33.33 );
  return fract( ( p.xxy + p.yxx ) * p.zyx );
}
// distance to the nearest of a scatter of points (cells about 1 apart): round dapples
float cells( vec3 x ) {
  vec3 i = floor( x ); vec3 f = fract( x ); float d = 8.0;
  for ( int a = -1; a <= 1; a ++ ) for ( int b = -1; b <= 1; b ++ ) for ( int c = -1; c <= 1; c ++ ) {
    vec3 o = vec3( float( a ), float( b ), float( c ) );
    vec3 r = o + hash33( i + o ) * 0.8 + 0.1 - f;
    d = min( d, dot( r, r ) );
  }
  return sqrt( d );
}
// fine and coarse streaks along the hair: noise squeezed along axis A. Returns (fine here, fine one step across,
// coarse here, coarse one step across)
vec4 streaks( vec3 p, vec3 d, vec3 A, float ff, float fs, float cf, float cs ) {
  float k1 = 1.0 - 1.0 / fs, k2 = 1.0 - 1.0 / cs;
  vec3 pd = p + d;
  return vec4( vnoise( ( p - A * ( dot( p, A ) * k1 ) ) * ff ), vnoise( ( pd - A * ( dot( pd, A ) * k1 ) ) * ff ),
               vnoiseB( ( p - A * ( dot( p, A ) * k2 ) ) * cf ), vnoiseB( ( pd - A * ( dot( pd, A ) * k2 ) ) * cf ) );
}

// ── the white: face markings, leg markings, pinto patterns ──
float faceWhite( vec3 p, vec3 n ) {
  if ( uFace.x < 0.5 ) return 0.0;
  vec3 d = p - POLL;
  float t = dot( d, FACE_A ) / FACE_L;            // 0 at the poll .. 1 at the nose
  float s = abs( p.x - ( MID0 + MID1 * t ) );     // across the face from its middle (m)
  float front = max( dot( n, FACE_F ), dot( n, FACE_A ) * smoothstep( 0.72, 0.95, t ) );   // facing out of the front of the face
  float rag = ( vnoise( p * 42.0 + uSeed * 3.1 ) - 0.5 + 0.5 * ( vnoiseB( p * 110.0 + uSeed ) - 0.5 ) ) * uFace.z;
  float sz = uFace.y;
  float facing = smoothstep( -0.05, 0.3, front );
  // the star: a blob on the forehead, about level with the eyes
  float star = 0.0;
  if ( uFace.w > 0.5 || ( uFace.x > 0.5 && uFace.x < 2.5 ) ) {
    vec2 q = vec2( s / ( 0.042 * sz ), ( t - 0.4 ) * FACE_L / ( 0.055 * sz ) );
    q.y += 0.25 * q.x * q.x;                                                 // (a little diamond-shaped, points down)
    star = ( 1.0 - smoothstep( 0.62, 1.12, length( q ) + rag * 1.5 + ( furHairN - 0.5 ) * 0.7 ) ) * facing;
  }
  float w = 0.0, t0 = 0.0, t1 = 0.0;
  if ( uFace.x > 1.5 && uFace.x < 2.5 ) { w = 0.015 * sz; t0 = 0.42; t1 = 0.84; }                     // stripe
  else if ( uFace.x > 2.5 && uFace.x < 3.5 ) { w = sz * mix( mix( 0.04, 0.026, smoothstep( 0.25, 0.55, t ) ), 0.04, smoothstep( 0.72, 0.92, t ) ); t0 = 0.2; t1 = 1.12; }   // blaze
  else if ( uFace.x > 3.5 && uFace.x < 4.5 ) { w = sz * mix( 0.15, 0.085, smoothstep( 0.3, 0.75, t ) ); t0 = 0.05; t1 = 1.15; facing = smoothstep( -0.25, 0.12, front ); }   // bald face
  else if ( uFace.x > 4.5 ) { w = 0.018 * sz; t0 = 0.88; t1 = 1.0; }                                // snip
  float band = 0.0;
  if ( w > 0.0 ) {
    band = ( 1.0 - smoothstep( w * 0.86, w * 1.14, s + rag * w * 0.9 + ( furHairN - 0.5 ) * w * 0.35 ) )
         * smoothstep( t0 - 0.02, t0 + 0.03, t + rag * 0.06 ) * ( 1.0 - smoothstep( t1 - 0.03, t1 + 0.02, t ) ) * facing;
  }
  return max( star, band );
}
float legWhite( vec3 p, vec3 n ) {
  float front = smoothstep( LEGSPLIT_Z - 0.05, LEGSPLIT_Z + 0.05, p.z );
  float left = smoothstep( MIDX - 0.02, MIDX + 0.02, p.x );
  float H = mix( mix( uLegs.w, uLegs.z, left ), mix( uLegs.y, uLegs.x, left ), front );
  if ( H < 0.001 ) return 0.0;
  float rag = ( vnoise( p * vec3( 16.0, 7.0, 16.0 ) + uSeed ) - 0.5 ) * 0.07 * ( 0.4 + uFace.z ) + ( vnoiseB( p * 60.0 ) - 0.5 ) * 0.012;
  float h = p.y + rag - 0.02 * n.z + ( furHairN - 0.5 ) * 0.02;   // (a touch higher at the front of the leg; hairy edge)
  return ( 1.0 - smoothstep( H - 0.008, H + 0.008, h ) ) * ( 1.0 - smoothstep( 0.95, 1.05, p.y ) );
}
// returns the white, and (in .y) how close a pixel is to white (for the sabino's roaning)
vec2 pintoWhite( vec3 p, vec3 n, float tail, float head, float hairN ) {
  float amt = uPinto.y;
  vec3 sp = p + uSeed;
  float neckT = clamp( dot( p - NECK_O, NECK_A ) / NECK_L, 0.0, 1.5 );
  if ( uPinto.x < 1.5 ) {
    // TOBIANO: big smooth patches, white that comes up from the legs and crosses the back, a dark head
    vec3 q = vec3( ( p.x - MIDX ) * 0.5, p.y * 0.55, p.z * 1.25 ) * 1.5 + uSeed;
    float nz = vnoise( q ) * 0.7 + vnoiseB( q * 2.1 + 3.0 ) * 0.3;
    float w = ( nz - 0.5 ) * 2.4 + ( amt - 0.5 ) * 1.8;
    w += 1.6 * ( 1.0 - smoothstep( 0.45, 0.75, p.y ) ) * ( 1.0 - tail );
    w -= 3.0 * head + 1.4 * smoothstep( 0.55, 0.95, neckT );                  // the head and the top of the neck stay dark
    w -= 0.8 * smoothstep( 0.6, 0.95, n.z ) * smoothstep( 0.2, 0.5, p.z );   // the chest stays dark
    w += 0.35 * smoothstep( 1.35, 1.55, p.y ) * ( 1.0 - head );                // white crosses the top line
    return vec2( smoothstep( -0.03, 0.03, w + ( furHairN - 0.5 ) * 0.05 ), w );
  }
  if ( uPinto.x < 2.5 ) {
    // OVERO: jagged white on the sides and belly, framed in colour: never across the back, the legs dark
    float side = smoothstep( 0.15, 0.6, abs( n.x ) );
    float barrel = smoothstep( 0.8, 1.0, p.y ) * ( 1.0 - smoothstep( 1.3, 1.48, p.y ) ) * smoothstep( -0.7, -0.4, p.z ) * ( 1.0 - smoothstep( 0.45, 0.7, p.z ) );
    float neck = smoothstep( 0.15, 0.35, neckT ) * ( 1.0 - smoothstep( 0.7, 0.95, neckT ) ) * ( 1.0 - head );
    float under = smoothstep( -0.3, -0.8, n.y ) * smoothstep( 0.7, 0.85, p.y ) * ( 1.0 - smoothstep( 1.1, 1.25, p.y ) );
    float core = max( side * max( barrel, neck * 0.85 ), under * 0.9 );
    float nz = vnoise( sp * 1.9 ) - 0.5;
    float jag = ( vnoise( sp * 7.5 ) - 0.5 ) + 0.55 * ( vnoiseB( sp * 21.0 ) - 0.5 );
    float w = core * 1.25 - 0.62 + nz * 1.1 + jag * 0.6 + ( amt - 0.5 ) * 0.9;
    w -= 2.0 * smoothstep( 0.55, 0.85, n.y );                                   // the top line keeps its colour
    w -= 2.0 * ( 1.0 - smoothstep( 0.62, 0.85, p.y ) ) + 2.0 * tail;
    return vec2( smoothstep( -0.012, 0.012, w + ( furHairN - 0.5 ) * 0.03 ), w );
  }
  // SABINO: white high up the legs with ragged tops, white along the belly, roaning (white hairs flecked in) round it
  float nz = vnoise( sp * 2.3 ) - 0.5;
  float jag = vnoise( sp * 12.0 ) - 0.5 + 0.6 * ( vnoiseB( sp * 34.0 ) - 0.5 );
  float legs = ( 0.5 + amt * 0.35 + nz * 0.3 + jag * 0.22 - p.y ) * 6.0 - 12.0 * tail;
  float under = smoothstep( -0.15, -0.8, n.y ) * smoothstep( 0.65, 0.85, p.y ) * ( 1.0 - smoothstep( 1.15, 1.3, p.y ) ) * ( 1.0 - head );
  float belly = under * 1.5 - 0.6 + nz * 1.0 + jag * 0.6 + ( amt - 0.5 ) * 0.8;
  float w = max( legs, belly );
  // the roan: thickest at the white's edge, and a lighter frosting low on the barrel and flanks; never on the head, the
  // top line, the mane or the tail
  float zone = ( 1.0 - smoothstep( 0.0, 0.6, -w ) );
  zone = max( zone, 0.3 * smoothstep( 0.2, 0.6, abs( n.x ) ) * smoothstep( 0.85, 1.0, p.y ) * ( 1.0 - smoothstep( 1.2, 1.38, p.y ) ) );
  zone *= uPinto.z * ( 1.0 - head ) * ( 1.0 - tail ) * ( 1.0 - smoothstep( 0.5, 0.8, n.y ) );
  // (hair by hair close up, picked by the streak noise; from far off, where even the coarse streaks are smaller than a
  // pixel, their average)
  float roan = mix( zone * 0.35 * ( 0.7 + 0.6 * hairN ), smoothstep( 1.0 - zone * 0.7, 1.06 - zone * 0.7, hairN ), furFineFade );
  return vec2( max( smoothstep( -0.03, 0.03, w ), roan ), w );
}
float whiteAt( vec3 p, vec3 n, float tail, float head, float hairN, float mane ) {
  float w = max( faceWhite( p, n ) * smoothstep( 0.3, 0.7, head ), legWhite( p, n ) * ( 1.0 - tail ) );
  if ( uPinto.x > 0.5 ) w = max( w, pintoWhite( p, n, tail, head, hairN ).x * ( uPinto.x > 2.5 ? 1.0 - mane : 1.0 ) );
  return w;
}

// the light on the hair: a velvet glow where the light grazes the coat (short hair scatters it toward you at the
// outline), and a hair highlight that runs across the hairs (Kajiya-Kay) instead of the round spot of a plastic
vec3 furDirect( vec3 L, vec3 V, vec3 N, vec3 color, vec3 albedo ) {
  float nl = dot( N, L ), nv = saturate( dot( N, V ) );
  float wrap = saturate( ( nl + 0.35 ) / 1.35 );
  float rim = pow( 1.0 - nv, 3.0 );
  vec3 sheen = color * wrap * rim * furSheen * ( albedo * 0.7 + 0.06 );
  vec3 H = normalize( L + V );
  float th = dot( furT, H );
  float kk = pow( sqrt( max( 0.0, 1.0 - th * th ) ), furShinePow );
  vec3 shine = color * saturate( nl ) * kk * furShine * ( albedo * 0.6 + 0.035 );
  return sheen + shine;
}
`;

const LIGHT_HOOK = /* glsl */`
#include <lights_physical_pars_fragment>
vec3 coatAlbedo = vec3( 0.5 );
void RE_Direct_Coat( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  reflectedLight.directSpecular += furDirect( directLight.direction, geometryViewDir, geometryNormal, directLight.color, coatAlbedo );
}
#undef RE_Direct
#define RE_Direct RE_Direct_Coat
`;

// the colour, worked out where the material's own colour is read
const FRAG_COLOR = /* glsl */`
vec3 cP = vRest;
vec3 cN = normalize( vRestN.xyz );
float cLegs = vRegion.x, cNeck = vRegion.y, cHead = vRegion.z, cHQ = vRegion.w;
float cTail = vMark.x, cMane = vMark.y, cAlong = vMark.z, cEar = vMark.w;
float cHair = clamp( cTail + cMane, 0.0, 1.0 );
float cBodyW = clamp( 1.0 - cLegs - cNeck - cHead - cHQ, 0.0, 1.0 );
float cPx = length( vViewPosition ) * uPx;
// ── the streaks: hair-sized noise squeezed along the way the hair lies, per part, blended where the parts meet
float fineFade = 1.0 - smoothstep( 0.3 / FINE_F, 0.9 / FINE_F, cPx );
float medFade = 1.0 - smoothstep( 0.3 / MED_F, 0.9 / MED_F, cPx );
float hairFade = 1.0 - smoothstep( 0.3 / HAIR_F, 0.9 / HAIR_F, cPx );
vec3 cFlow = cBodyW * AX_BODY + cHQ * AX_HQ + cLegs * AX_LEG + cNeck * AX_NECK + cHead * AX_HEAD;
cFlow = mix( cFlow, AX_MANE * cMane + AX_TAIL * cTail + 1e-4, cHair );
vec3 cFr = cFlow - cN * dot( cFlow, cN );
cFr = dot( cFr, cFr ) > 1e-6 ? normalize( cFr ) : normalize( cross( cN, vec3( 1.0, 0.0, 0.0 ) ) + 1e-4 );
furAcrossR = cross( cN, cFr );
float cE = 0.25 / FINE_F;
vec4 S = vec4( 0.5 );
vec4 SH = vec4( 0.5 );
if ( medFade > 0.0 || hairFade > 0.0 ) {
  vec3 dd = furAcrossR * cE;
  vec4 acc = vec4( 0.0 ); float wsum = 0.0, w;
  w = cBodyW * ( 1.0 - cHair ); if ( w > 0.04 ) { acc += w * streaks( cP, dd, AX_BODY, FINE_F, FINE_S, MED_F, MED_S ); wsum += w; }
  w = cHQ * ( 1.0 - cHair );    if ( w > 0.04 ) { acc += w * streaks( cP, dd, AX_HQ, FINE_F, FINE_S, MED_F, MED_S ); wsum += w; }
  w = cLegs * ( 1.0 - cHair );  if ( w > 0.04 ) { acc += w * streaks( cP, dd, AX_LEG, FINE_F, FINE_S, MED_F, MED_S ); wsum += w; }
  w = cNeck * ( 1.0 - cHair );  if ( w > 0.04 ) { acc += w * streaks( cP, dd, AX_NECK, FINE_F, FINE_S, MED_F, MED_S ); wsum += w; }
  w = cHead * ( 1.0 - cHair );  if ( w > 0.04 ) { acc += w * streaks( cP, dd, AX_HEAD, FINE_F * 1.3, FINE_S, MED_F * 1.4, MED_S ); wsum += w; }
  if ( wsum > 0.0 ) S = mix( vec4( 0.5 ), acc / wsum, clamp( wsum * 4.0, 0.0, 1.0 ) );
  if ( cHair > 0.04 ) {
    vec4 h = cMane * streaks( cP, dd * 2.0, AX_MANE, HAIR_F, HAIR_S, HAIRC_F, HAIRC_S ) + cTail * streaks( cP, dd * 2.0, AX_TAIL, HAIR_F, HAIR_S, HAIRC_F, HAIRC_S );
    SH = h / max( cHair, 1e-3 );
  }
}
float sFine = mix( 0.5, S.x, fineFade ), sMed = mix( 0.5, S.z, medFade );
float hFine = mix( 0.5, SH.x, hairFade ), hClump = SH.z;
// the bump across the hairs (a slope, in metres per metre)
furSlope = ( ( S.y - S.x ) * 0.0004 * fineFade + ( S.w - S.z ) * 0.0006 * medFade ) / cE * ( 1.0 - cHair ) * uFur.x;
furSlope += ( ( SH.y - SH.x ) * 0.0016 * hairFade + ( SH.w - SH.z ) * 0.004 ) / ( cE * 2.0 ) * cHair * uFur.x;

// ── the colour
float cLow = fbm2( cP * 2.3 + uSeed );
vec3 col = uBase * ( 0.9 + 0.2 * cLow );
// a darker top line, a lighter underside and inside of the legs
float cUp = smoothstep( 0.35, 0.95, cN.y ) * smoothstep( 1.1, 1.4, cP.y ) * ( 1.0 - cHead );
col *= 1.0 - uCoat.z * cUp * ( 0.55 + 0.45 * cLow );
float cUnder = smoothstep( -0.1, -0.75, cN.y ) * smoothstep( 0.6, 0.85, cP.y ) * ( 1.0 - smoothstep( 1.25, 1.45, cP.y ) ) * ( 1.0 - cHead );
float cInner = smoothstep( 0.1, 0.65, -sign( cP.x - MIDX ) * cN.x ) * smoothstep( 0.55, 0.85, cP.y ) * ( 1.0 - smoothstep( 1.05, 1.25, cP.y ) ) * ( 1.0 - cHead );
float cLight = max( cUnder, cInner * 0.75 ) * uCoat.y;
vec3 cPale = mix( col, vec3( dot( col, vec3( 0.3333 ) ) ), 0.3 ) * 1.55 + 0.02;
col = mix( col, cPale, cLight );
// greying: the colour goes first, then the grey lightens to white; dapples are rounder lighter spots in a darker net
if ( uGrey.x > 0.001 ) {
  float lum = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 dark = vec3( lum ) * vec3( 0.97, 0.97, 1.0 );
  float lowLeg = 1.0 - smoothstep( 0.32, 0.72, cP.y + ( cLow - 0.5 ) * 0.12 );
  float g = uGrey.x + 0.22 * cHead - 1.0 * uGrey.w * lowLeg * ( 1.0 - cHair ) + 0.25 * ( cLow - 0.5 ) - 0.12 * smoothstep( 0.0, 1.0, cEar );
  if ( uGrey.y > 0.001 ) {
    // (dapples sit mostly on the barrel and the hindquarters: fewer on the shoulder and neck, none on the head)
    float body = ( 1.0 - cHead ) * ( 1.0 - 0.9 * lowLeg ) * ( 1.0 - cNeck * 0.75 ) * ( 1.0 - cLegs * 0.6 ) * ( 1.0 - cHair )
               * ( 0.35 + 0.65 * ( 1.0 - smoothstep( -0.1, 0.5, cP.z ) ) );
    float c = cells( cP / uGrey.z + uSeed );
    float spot = 1.0 - smoothstep( 0.42, 0.78, c + ( vnoise( cP * 40.0 ) - 0.5 ) * 0.25 + ( cLow - 0.5 ) * 0.3 );
    g += ( spot - 0.7 ) * uGrey.y * body * 0.6;
  }
  g = clamp( g, 0.0, 1.0 );
  col = mix( mix( col, dark, smoothstep( 0.0, 0.25, uGrey.x ) ), uWhiteCol, pow( smoothstep( 0.0, 1.0, g ), 2.2 ) );
}
// points: black legs up to the knees and hocks, black ear tips
float cFront = smoothstep( LEGSPLIT_Z - 0.05, LEGSPLIT_Z + 0.05, cP.z );
float cPointTop = mix( HOCK_Y + 0.05, KNEE_Y + 0.06, cFront );
float cPoints = ( 1.0 - smoothstep( cPointTop - 0.07, cPointTop + 0.09, cP.y + ( cLow - 0.5 ) * 0.14 + 0.03 * cN.z ) ) * ( 1.0 - cTail );
cPoints = max( cPoints, smoothstep( 0.2, 0.6, cEar ) * smoothstep( POLL.y + 0.07, POLL.y + 0.15, cP.y ) );
col = mix( col, uPointsCol * ( 0.85 + 0.3 * cLow ), cPoints * uCoat.x );
// the face: a darker muzzle (bare skin under thin hair) and dark skin round the eyes
float cT = dot( cP - POLL, FACE_A ) / FACE_L;
float cMuz = smoothstep( 0.74, 0.92, cT ) * smoothstep( 0.4, 0.8, cHead );
float cEyeD = min( distance( cP, EYE_L ), distance( cP, EYE_R ) );
float cEyeRing = ( 1.0 - smoothstep( EYE_R0 * 1.0, EYE_R0 * 2.4, cEyeD ) ) * smoothstep( 0.4, 0.8, cHead );
col = mix( col, uSkinCol * ( 0.85 + 0.3 * cLow ), cMuz * uCoat.w );
col = mix( col, uSkinCol, cEyeRing * 0.75 );
// the mane and tail: their own colour, strand by strand, darker at the roots and lighter at the tips
if ( cHair > 0.01 ) {
  float strand = ( hFine - 0.5 ) * 0.9 + ( hClump - 0.5 ) * 1.1;
  vec3 hc = uManeCol * ( 1.0 + uHair.z * strand );
  hc *= mix( 1.0 - uHair.x, 1.0 + uHair.y, smoothstep( 0.05, 0.95, cAlong ) );
  col = mix( col, hc, cHair );
}
// white hair: markings and patterns (pink skin shows through on a white muzzle)
furFineFade = fineFade; furMedFade = medFade;
furHairN = mix( 0.5, S.x * 0.7 + S.z * 0.3, fineFade );
float cW = whiteAt( cP, cN, cTail, cHead, mix( S.z, S.x * 0.75 + S.z * 0.25, fineFade ), cMane );
vec3 cWhite = uWhiteCol * ( 0.93 + 0.1 * cLow ) * ( 1.0 - 0.18 * cHair * ( 1.0 - cAlong ) );
col = mix( col, cWhite, cW );
col = mix( col, uPinkCol, cW * cMuz * 0.55 );
col = mix( col, uPinkCol * 0.8, cW * cEyeRing * 0.5 );
// the hooves: dark horn, or pale under a white leg, with a few vertical growth lines
float cHoof = 1.0 - smoothstep( HOOF_Y - 0.006, HOOF_Y + 0.006, cP.y - 0.022 * cN.z );
if ( cHoof > 0.0 ) {
  float pale = whiteAt( vec3( cP.x, HOOF_Y + 0.015, cP.z ), cN, 0.0, 0.0, 0.5, 0.0 );
  float lines = vnoise( vec3( cP.x * 140.0, cP.y * 6.0, cP.z * 140.0 ) );
  vec3 hoof = mix( uHoofDark, uHoofPale, smoothstep( 0.3, 0.7, pale + ( lines - 0.5 ) * 0.5 * pale * ( 1.0 - pale ) * 4.0 ) );
  col = mix( col, hoof * ( 0.85 + 0.3 * lines ), cHoof );
}
// the hair-by-hair colour: lighter and darker hairs, a slightly uneven lie
col *= 1.0 + uFur.y * ( ( sFine - 0.5 ) * 0.3 + ( sMed - 0.5 ) * 0.2 ) * ( 1.0 - cHoof ) * ( 1.0 - cHair );
diffuseColor.rgb = col;
coatAlbedo = col;
// roughness: the barrel's short coat a little glossier than the legs; moist muzzle; the long hair glossier still
furRough = mix( 0.5, 0.64, cLegs ) + 0.05 * cHead;
furRough = mix( furRough, 0.42, cMuz * 0.6 );
furRough = mix( furRough, 0.5, cHair );
furRough = mix( furRough, 0.48, cHoof );
furRough = clamp( furRough + ( sFine - 0.5 ) * 0.12 + 0.06 * cW, 0.05, 1.0 );
furSheen = 0.45 * uFur.z * ( 1.0 - cHoof ) * ( 1.0 - 0.8 * cHair ) * ( 1.0 - 0.6 * cMuz );
furShine = mix( uFur.w * 0.2, uHair.w * 0.45, cHair ) * ( 1.0 - cHoof ) * ( 1.0 - cMuz * 0.7 );
furShinePow = mix( 22.0, 70.0, cHair );
vec4 cDebug = vec4( 0.0 );
if ( uMask > 0.5 ) {
  if ( uMask < 1.5 ) cDebug = vec4( cLegs + cHair * 0.8, cNeck + cHead + cTail * 0.6, cHQ + cMane * 0.9 + cHead, 1.0 );
  else if ( uMask < 2.5 ) cDebug = vec4( cMane, cTail, cAlong, 1.0 );
  else if ( uMask < 3.5 ) cDebug = vec4( vec3( cW ), 1.0 );
  else if ( uMask < 4.5 ) cDebug = vec4( cFr * 0.5 + 0.5, 1.0 );
  else if ( uMask < 5.5 ) cDebug = vec4( vec3( sFine * 0.5 + sMed * 0.5 ), 1.0 );
  else if ( uMask < 6.5 ) cDebug = vec4( vec3( fract( cP.y * 10.0 ) < 0.08 ? 1.0 : 0.25 ), 1.0 ) + vec4( cHoof, cPoints * 0.5, 0.0, 0.0 );
  else cDebug = vec4( col * 1.25, 1.0 );   // the colour alone, no light
}
`;

const FRAG_NORMAL = /* glsl */`
#include <normal_fragment_maps>
{
  // the hair's way in view space, along the surface; tilt the normal across the hairs by the streaks' slope
  vec3 T = vFlowV - normal * dot( vFlowV, normal );
  T = dot( T, T ) > 1e-6 ? normalize( T ) : vec3( 0.0, 1.0, 0.0 );
  vec3 Bv = cross( normal, T );
  normal = normalize( normal - Bv * clamp( furSlope, -1.5, 1.5 ) );
  furT = T;
}
`;

// the baked shade: the sky light (and a little of the sun) dimmed where the body hides the sky: under the belly,
// between the legs, behind the elbow, in the mane's roots
const FRAG_AO = /* glsl */`
{
  float ao = mix( 1.0, vRestN.w, uAO );
  reflectedLight.indirectDiffuse *= ao;
  reflectedLight.indirectSpecular *= ao * ao;
  reflectedLight.directDiffuse *= mix( 1.0, ao, 0.3 * uAO );
  reflectedLight.directSpecular *= mix( 1.0, ao, 0.6 * uAO );
}
`;

// HOW MUCH SKY each corner sees (ambient occlusion), baked once at load from the horse at rest: the body's surface is
// stamped into a grid of 2.5 cm cells, and from each corner 24 rays go out over the half of the sky it faces; a ray
// that meets a cell of body within 45 cm counts as blocked (less the further away it hits).
function bakeAO(rest, nrm, index, n) {
  const C = 0.025, R = 0.45, STEP = 0.02;
  let x0 = 9, y0 = 9, z0 = 9, x1 = -9, y1 = -9, z1 = -9;
  for (let i = 0; i < n; i++) { const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2]; x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z); x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z); }
  x0 -= 0.1; y0 -= 0.1; z0 -= 0.1;
  const NX = Math.ceil((x1 - x0 + 0.2) / C), NY = Math.ceil((y1 - y0 + 0.2) / C), NZ = Math.ceil((z1 - z0 + 0.2) / C);
  const grid = new Uint8Array(NX * NY * NZ);
  const mark = (x, y, z) => { const i = Math.floor((x - x0) / C), j = Math.floor((y - y0) / C), k = Math.floor((z - z0) / C); if (i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ) grid[(k * NY + j) * NX + i] = 1; };
  const tri = index ? index.length / 3 : n / 3, vi = (t, c) => (index ? index[t * 3 + c] : t * 3 + c);
  for (let t = 0; t < tri; t++) {
    const a = vi(t, 0) * 3, b = vi(t, 1) * 3, c = vi(t, 2) * 3;
    const e = Math.max(Math.hypot(rest[a] - rest[b], rest[a + 1] - rest[b + 1], rest[a + 2] - rest[b + 2]), Math.hypot(rest[a] - rest[c], rest[a + 1] - rest[c + 1], rest[a + 2] - rest[c + 2]), Math.hypot(rest[b] - rest[c], rest[b + 1] - rest[c + 1], rest[b + 2] - rest[c + 2]));
    const m = Math.max(1, Math.ceil(e / (C * 0.5)));
    for (let u = 0; u <= m; u++) for (let v = 0; v <= m - u; v++) {
      const s = u / m, r = v / m, q = 1 - s - r;
      mark(rest[a] * q + rest[b] * s + rest[c] * r, rest[a + 1] * q + rest[b + 1] * s + rest[c + 1] * r, rest[a + 2] * q + rest[b + 2] * s + rest[c + 2] * r);
    }
  }
  // 48 directions spread evenly over a sphere; each corner uses the 24 or so on its own side
  const D = []; const K = 48;
  for (let k = 0; k < K; k++) { const y = 1 - (k + 0.5) / K * 2, r = Math.sqrt(1 - y * y), a = k * 2.399963; D.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
    const ox = rest[i * 3] + nx * 0.045, oy = rest[i * 3 + 1] + ny * 0.045, oz = rest[i * 3 + 2] + nz * 0.045;
    let occ = 0, wsum = 0;
    for (const d of D) {
      const cs = d[0] * nx + d[1] * ny + d[2] * nz; if (cs <= 0.05) continue;
      let hit = 0;
      for (let t = 0; t < R; t += STEP) {
        const ii = Math.floor((ox + d[0] * t - x0) / C), jj = Math.floor((oy + d[1] * t - y0) / C), kk = Math.floor((oz + d[2] * t - z0) / C);
        if (ii < 0 || jj < 0 || kk < 0 || ii >= NX || jj >= NY || kk >= NZ) break;
        if (grid[(kk * NY + jj) * NX + ii]) { hit = 1 - 0.6 * t / R; break; }
      }
      // (the ground hides the sky below the belly too)
      if (!hit && d[1] < 0) { const tg = -oy / d[1]; if (tg < R * 2.5) hit = 0.6 * (1 - tg / (R * 2.5)); }
      occ += hit * cs; wsum += cs;
    }
    out[i] = 1 - occ / Math.max(wsum, 1e-6);
  }
  return out;
}

export function coatMaterial(shape, recipe, { px = null } = {}) {
  const u = {
    uNoise: { value: noiseTexture() }, uRestM: { value: shape.M.clone() },
    uBase: { value: new THREE.Color() }, uPointsCol: { value: new THREE.Color() }, uManeCol: { value: new THREE.Color() },
    uWhiteCol: { value: new THREE.Color() }, uSkinCol: { value: new THREE.Color() }, uPinkCol: { value: new THREE.Color() },
    uHoofDark: { value: new THREE.Color() }, uHoofPale: { value: new THREE.Color() },
    uCoat: { value: new THREE.Vector4() }, uGrey: { value: new THREE.Vector4() }, uFace: { value: new THREE.Vector4() },
    uLegs: { value: new THREE.Vector4() }, uPinto: { value: new THREE.Vector4() }, uSeed: { value: new THREE.Vector3() },
    uFur: { value: new THREE.Vector4(1, 1, 1, 1) }, uHair: { value: new THREE.Vector4() },
    uPx: px || { value: 0.001 }, uMask: { value: 0 }, uAO: { value: 1 },
  };
  const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 });
  m.name = 'coat';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <skinnormal_vertex>', '#include <skinnormal_vertex>\n' + VERT_MAIN);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS.replace('SHAPE_CONSTANTS', shape.glsl))
      .replace('#include <lights_physical_pars_fragment>', LIGHT_HOOK)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = furRough;')
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + FRAG_AO)
      .replace('#include <opaque_fragment>', 'if ( uMask > 0.5 ) outgoingLight = cDebug.rgb * 0.8;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => shape.key;
  m.coat = { uniforms: u, set: (r) => applyRecipe(u, r) };
  if (recipe) applyRecipe(u, recipe);
  return m;
}

// ── a recipe into the uniforms ─────────────────────────────────────────────────────────────────────────────────────────
export const FACE_CODES = { none: 0, star: 1, stripe: 2, blaze: 3, bald: 4, snip: 5 };
// how high each leg marking reaches (m): just round the top of the hoof, up past the fetlock, to the knee or hock
export const LEG_HEIGHTS = { none: 0, coronet: 0.125, pastern: 0.175, sock: 0.29, stocking: [0.5, 0.56] };
export const PINTO_CODES = { none: 0, tobiano: 1, overo: 2, sabino: 3 };
function legH(kind, hind) { const h = LEG_HEIGHTS[kind] || 0; return Array.isArray(h) ? h[hind ? 1 : 0] : h; }
export function applyRecipe(u, r) {
  u.uBase.value.set(r.base);
  u.uPointsCol.value.set(r.pointsColor || '#141110');
  u.uManeCol.value.set(r.mane);
  u.uWhiteCol.value.set(r.whiteColor || '#e6e1d8');
  u.uSkinCol.value.set(r.skin || '#2c2523');
  u.uPinkCol.value.set('#c99a8e');
  u.uHoofDark.value.set('#2b2622'); u.uHoofPale.value.set('#b8a586');
  u.uCoat.value.set(r.points === 'black' ? 1 : 0, r.belly ?? 0.5, r.sooty ?? 0.2, r.muzzle ?? 0.7);
  u.uGrey.value.set(r.grey || 0, r.dapples || 0, r.dappleSize || 0.1, r.greyLegs ?? 0.6);
  u.uFace.value.set(FACE_CODES[r.face] || 0, r.faceSize ?? 1, r.ragged ?? 0.5, r.face === 'stripe' || r.star ? 1 : 0);
  const L = r.legs || {};
  u.uLegs.value.set(legH(L.FL, false), legH(L.FR, false), legH(L.HL, true), legH(L.HR, true));
  u.uPinto.value.set(PINTO_CODES[r.pinto] || 0, r.white ?? 0.5, r.roan ?? 0.6, 0);
  const s = (r.seed ?? 1) * 1.0;
  u.uSeed.value.set((s * 17.31) % 97, (s * 7.77) % 53, (s * 3.19) % 71);
  u.uFur.value.set(r.bump ?? 1, r.streakColor ?? 1, r.sheen ?? 1, r.shine ?? 1);
  u.uHair.value.set(r.roots ?? 0.35, r.tips ?? 0.3, r.strands ?? 0.5, r.maneShine ?? 0.6);
}
