// THE COAT: a horse's hair worked out in the shader, on the plain sculpted body (horse.glb: one skinned mesh for the
// body and a small glossy mesh for the eyes). Nothing is painted into a picture: every pixel asks where it sits on the
// horse standing at rest (its "rest position", which rides along with the bones however the horse moves, so a marking
// never slides) and works out its own colour, its hair streaks and its shine from a coat recipe. The mane and tail are
// hair cards (hair.js) that use the same recipe and the same pattern code (COMMON below).
//
//   prepareHorse(scene, scale) -> shape     once per loaded model: finds the body and the eyes, the landmarks (the poll,
//                                           the nose, the eyes, the knees and hocks, the hoof tops), bakes how much sky
//                                           each corner sees, and stores three small numbers per corner on the body
//                                           (which part it is, the mane's crest and the tail's dock, the hair's lie)
//   coatMaterial(shape, recipe) -> material a MeshStandardMaterial with the coat added (one per horse; the program is
//                                           shared, so a whole stable costs one shader compile)
//   material.coat.set(recipe)               a new coat, live (just uniforms: nothing recompiles)
//   eyeMaterial(shape, material)            the eyes' own glossy material with a deep brown iris and a dark pupil
//   COMMON, LIGHT_HOOK, applyRecipe          shared with the hair cards
//
// The recipe (recipes.js): base colour, black points, mane and tail colour and length, a face marking, a marking per
// leg, greying and dapples, a pinto pattern, a seed.
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
const sstep = THREE.MathUtils.smoothstep;
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
  const B = {};
  for (const b of sk.bones) B[b.name] = b.getWorldPosition(new THREE.Vector3());
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
  // the hoof's top (the coronet): about half the fetlock joint's height
  const hoofTop = fetlock * 0.5;

  // the hair's lie, the way real hair grows: back and down along the barrel, down the hindquarters and the legs, down
  // the neck, from the forehead to the nose down the face
  const neckO = B.Neck1.clone(), neckA = poll.clone().sub(neckO), neckL = neckA.length(); neckA.normalize();
  const AX = {
    body: V(0, -0.5, -1).normalize(), body2: V(0, -0.22, -1).normalize(), hq: V(0, -1, -0.35).normalize(), legs: V(0, -1, 0.04).normalize(),
    neck: V(0, -1, -0.3).normalize(), head: faceA.clone(),
    mane: new THREE.Vector3().crossVectors(neckA, V(1, 0, 0)).normalize(), tail: V(0, -1, -0.18).normalize(),
  };
  if (AX.mane.y > 0) AX.mane.negate();          // (down from the crest)

  // was the mane and tail sculpted into the body (the first sculpt), or is there just a crest and a dock for the hair
  // cards to grow from? A sculpted tail hangs well below the hocks' height.
  let tailLow = 9; for (let i = 0; i < n; i++) if (W.tail[i] > 0.5) tailLow = Math.min(tailLow, rest[i * 3 + 1]);
  const sculptedHair = tailLow < 0.6;
  // THE MANE'S ROOTS: a band down from the crest of the neck, from the withers to the poll, and the forelock's roots
  // between the ears (hair-coloured skin under the cards). The crest is the highest the neck reaches (across the neck's
  // line) at each place along it.
  const up = new THREE.Vector3().crossVectors(V(1, 0, 0), neckA).normalize(); if (up.y < 0) up.negate();
  const mane = new Float32Array(n), along = new Float32Array(n), tailH = new Float32Array(n);
  const tA = new Float32Array(n), hA = new Float32Array(n), crest = new Map(), bin = (t) => Math.round(t / 0.04);
  const withersT = -0.12, BAND = sculptedHair ? 0.17 : 0.06;
  for (let i = 0; i < n; i++) {
    v.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]).sub(neckO);
    const t = v.dot(neckA), h = v.dot(up); tA[i] = t; hA[i] = h;
    const ok = W.legs[i] + W.tail[i] < 0.3 && W.ear[i] < 0.2 && t > withersT - 0.1 && t < neckL + 0.06 && rest[i * 3 + 2] > legSplit;
    if (ok) { const k = bin(t); if (!crest.has(k) || h > crest.get(k)) crest.set(k, h); }
  }
  const crestAt = (t) => { const k = t / 0.04, a = Math.floor(k), f = k - a; const c0 = crest.get(a), c1 = crest.get(a + 1); return c0 === undefined ? c1 ?? -9 : c1 === undefined ? c0 : c0 + (c1 - c0) * f; };
  for (let i = 0; i < n; i++) {
    const t = tA[i], h = hA[i];
    if (W.legs[i] + W.tail[i] > 0.3 || W.ear[i] > 0.2 || t < withersT - 0.08 || t > neckL + 0.05 || rest[i * 3 + 2] < legSplit) continue;
    // (hair cards: a band of hair colour under the mane, wider down the near side where it falls, so a gap between the
    // cards shows hair, not coat)
    const side = sculptedHair ? 1 : 0.85 + 1.15 * sstep(rest[i * 3] - midX, -0.02, 0.03);
    const band = BAND * side * sstep(t, withersT - 0.06, withersT + 0.22) * (1 - (sculptedHair ? 0.35 : 0.2) * sstep(t, neckL - 0.25, neckL)) * (sculptedHair ? 1 : 1 - sstep(t, neckL - 0.05, neckL - 0.01));
    if (band < 0.005) continue;
    const c = crestAt(t), d = c - h;                 // how far below the crest
    const m = 1 - sstep(d, band - 0.015, band + 0.015);
    if (m > mane[i]) { mane[i] = m; along[i] = THREE.MathUtils.clamp(d / band, 0, 1); }
  }
  // the forelock's roots: on the head, in front of the poll, between the ears (only where the hair is sculpted: hair
  // cards sink their own roots)
  for (let i = 0; i < n && sculptedHair; i++) {
    const x = rest[i * 3] - midX, y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    if (W.head[i] < 0.5 || W.ear[i] > 0.3) continue;
    const f = (1 - sstep(Math.abs(x), 0.02, 0.04)) * sstep(z, poll.z, poll.z + 0.03) * sstep(nrm[i * 3 + 1], 0.3, 0.6)
      * sstep(y, eyeC[0].y + 0.07, eyeC[0].y + 0.1) * (1 - sstep(z, poll.z + 0.06, poll.z + 0.09)) * (sculptedHair ? 1 : 0.7);
    if (f > mane[i]) { mane[i] = f; along[i] = 0; }
  }
  // THE TAIL: the hair (or the dock it grows from), not the skin at its root
  const tailTop = B.Tail2.y;
  for (let i = 0; i < n; i++) {
    const z = rest[i * 3 + 2], y = rest[i * 3 + 1];
    const t = sstep(W.tail[i], 0.3, 0.7) * sstep(-z, -B.Tail1.z + 0.03, -B.Tail1.z + 0.1);
    tailH[i] = t;
    if (t > 0) along[i] = Math.max(along[i] * (1 - t), THREE.MathUtils.clamp((tailTop - y) / Math.max(0.05, tailTop - tailLow), 0, 1) * t * (sculptedHair ? 1 : 0.2));
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
  // and the fine hollows the shade's grid is too coarse for (the nostrils, the mouth line, round the eyes, the ear's cup,
  // the grooves down the cannons): how far a corner's neighbours rise above the plane it faces, smoothed once
  const cav = cavity(rest, nrm, g.index ? g.index.array : null, n);
  for (let i = 0; i < n; i++) ao[i] *= 1 - 0.55 * cav[i];
  for (let i = 0; i < n; i++) aFlow[i * 4 + 3] = Math.round(127 * ao[i]);
  const msAO = performance.now() - tAO;
  g.setAttribute('aRegion', new THREE.BufferAttribute(aRegion, 4, true));
  g.setAttribute('aMark', new THREE.BufferAttribute(aMark, 4, true));
  g.setAttribute('aFlow', new THREE.BufferAttribute(aFlow, 4, true));

  const shape = {
    body, eye, M, poll, nose, faceA, faceF, faceL, eyeL: eyeC[0], eyeR: eyeC[1], eyeR0: eyeC.r, midX, mid0, mid1,
    knee, hock, fetlock, hoofTop, legSplit, neckO, neckA, neckL, up, AX, verts: n, tris: (g.index ? g.index.count : n) / 3,
    attrBytes: n * 12, msAO, sculptedHair, crestAt, withersT,
    // (for the hair cards: the body at rest, its parts and its bones)
    rest, nrm, W, bones: B, boneNames: names, skinIndex: SI, skinWeight: SW,
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
const vec3 AX_BODY2 = ${v3(S.AX.body2)};
const vec3 AX_HQ = ${v3(S.AX.hq)};
const vec3 AX_LEG = ${v3(S.AX.legs)};
const vec3 AX_NECK = ${v3(S.AX.neck)};
const vec3 AX_HEAD = ${v3(S.AX.head)};
const vec3 AX_MANE = ${v3(S.AX.mane)};
const vec3 AX_TAIL = ${v3(S.AX.tail)};
const vec3 TAIL_ROOT = ${v3(S.bones.Tail2 || S.bones.Tail1 || S.poll)};
`;
}

// ── the shader ────────────────────────────────────────────────────────────────────────────────────────────────────────
const VERT_PARS = /* glsl */`
attribute vec4 aRegion;   // legs, neck, head, hindquarters (the body is what's left)
attribute vec4 aMark;     // tail hair, mane hair, root-to-tip along the long hair, ears
attribute vec4 aFlow;     // the way the hair lies, at rest; (w) how much sky the corner sees
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

// what the coat and the hair cards share: the recipe's uniforms, the noise, the white (markings and patterns), and the
// light on hair
export const COMMON = /* glsl */`
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
uniform vec4 uPinto;       // pattern (0 none, 1 tobiano, 2 overo, 3 sabino), how much white, roaning, dapple bloom
uniform vec3 uSeed;
uniform vec4 uFur;         // streak bump, streak colour, velvet sheen, coat shine
uniform vec4 uHair;        // dark roots, light tips, strand variation, mane shine
uniform float uPx;         // metres across one pixel, one metre away
uniform float uMask;       // a debug view (0: the coat)
uniform float uAO;         // how strongly the baked shade darkens
// (set in main, read by the light function below)
vec3 furT = vec3( 0.0, 1.0, 0.0 );
float furSheen = 0.0;
float furShine = 0.0;
float furShinePow = 24.0;
float furSpec = 1.0;         // how much of the plain (plastic) highlight is kept
vec3 furCool = vec3( 0.0 );  // a cool blue-grey added to the sheen of a dark coat
float furSlope = 0.0;
vec3 furAcrossR = vec3( 1.0, 0.0, 0.0 );
float furRough = 0.6;
float furFineFade = 1.0;
float furMedFade = 1.0;
float furHairN = 0.5;        // the fine streak noise here (white edges break up hair by hair)
float furEdge = 0.0;         // 1: the hair highlight sits toward the outline (the short coat), 0: everywhere (long hair)
float furBroad = 0.0;        // a soft, broad band of sheen along the hair over the whole coat
SHAPE_CONSTANTS
const float FINE_F = 380.0;   // fine hair streaks: about 2.6 mm across ...
const float FINE_S = 4.5;     // ... and 4.5 times as long
const float MED_F = 55.0;     // the coat's lie: about 2 cm across
const float MED_S = 3.0;

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
// the distance to the nearest of a scatter of points (cells about 1 apart), and (y) that point's own random 0..1
vec2 cells( vec3 x ) {
  vec3 i = floor( x ); vec3 f = fract( x ); float d = 8.0; float id = 0.0;
  for ( int a = -1; a <= 1; a ++ ) for ( int b = -1; b <= 1; b ++ ) for ( int c = -1; c <= 1; c ++ ) {
    vec3 o = vec3( float( a ), float( b ), float( c ) );
    vec3 h = hash33( i + o );
    vec3 r = o + h * 0.8 + 0.1 - f;
    float dd = dot( r, r );
    if ( dd < d ) { d = dd; id = h.z; }
  }
  return vec2( sqrt( d ), id );
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
  if ( uFace.x < 0.5 && uFace.w < 0.5 ) return 0.0;
  vec3 d = p - POLL;
  float t = dot( d, FACE_A ) / FACE_L;            // 0 at the poll .. 1 at the nose
  float s = abs( p.x - ( MID0 + MID1 * t ) );     // across the face from its middle (m)
  float front = max( dot( n, FACE_F ), dot( n, FACE_A ) * smoothstep( 0.72, 0.95, t ) );   // facing out of the front of the face
  float rag = ( vnoise( p * 36.0 + uSeed * 3.1 ) - 0.5 ) * uFace.z;   // (soft, low ragged edges: no islands)
  float hairy = ( furHairN - 0.5 ) * 0.012;                             // (and hair by hair along the coat)
  float sz = uFace.y;
  float facing = smoothstep( -0.05, 0.3, front );
  // the star: a round or diamond spot on the forehead, about level with the eyes
  float star = 0.0;
  if ( uFace.w > 0.5 || ( uFace.x > 0.5 && uFace.x < 2.5 ) ) {
    vec2 q = vec2( s, ( t - 0.4 ) * FACE_L ) / ( 0.04 * sz );
    float r = mix( length( q ), ( abs( q.x ) + abs( q.y ) ) * 0.82, 0.45 );
    star = ( 1.0 - smoothstep( 0.72, 1.02, r + rag * 0.45 + hairy * 0.35 / ( 0.04 * sz ) ) ) * facing;   // (a solid centre, a soft, slightly ragged edge)
  }
  float w = 0.0, t0 = 0.0, t1 = 0.0, edge = 0.008;
  if ( uFace.x > 1.5 && uFace.x < 2.5 ) { w = 0.015 * sz; t0 = 0.42; t1 = 0.84; edge = 0.005; }       // stripe
  else if ( uFace.x > 2.5 && uFace.x < 3.5 ) { w = sz * mix( mix( 0.04, 0.026, smoothstep( 0.25, 0.55, t ) ), 0.04, smoothstep( 0.72, 0.92, t ) ); t0 = 0.2; t1 = 1.12; }   // blaze
  else if ( uFace.x > 3.5 && uFace.x < 4.5 ) {   // bald face: out past the eyes, and the whole muzzle (no islands of colour round the nostrils)
    w = sz * mix( 0.15, 0.115, smoothstep( 0.3, 0.9, t ) ); t0 = 0.05; t1 = 1.2;
    facing = mix( smoothstep( -0.55, -0.4, front ), 1.0, smoothstep( 0.76, 0.86, t ) ); edge = 0.008; rag *= 0.6;   // (the muzzle all round, nostrils and chin too; dents in the face too)
  }
  else if ( uFace.x > 4.5 ) { w = 0.018 * sz; t0 = 0.88; t1 = 1.0; edge = 0.006; }                    // snip
  float band = 0.0;
  if ( w > 0.0 ) {
    float small = clamp( w / 0.04, 0.3, 1.0 );                              // (a narrow stripe or a snip: less raggedness, so it stays whole)
    band = ( 1.0 - smoothstep( w - edge, w + edge, s + rag * w * 0.8 * small + hairy * small ) )
         * smoothstep( t0 - 0.03, t0 + 0.03, t + rag * 0.05 ) * ( 1.0 - smoothstep( t1 - 0.03, t1 + 0.02, t ) ) * facing;
  }
  return max( star, band );
}
float legWhite( vec3 p, vec3 n ) {
  float front = smoothstep( LEGSPLIT_Z - 0.05, LEGSPLIT_Z + 0.05, p.z );
  float left = smoothstep( MIDX - 0.02, MIDX + 0.02, p.x );
  float H = mix( mix( uLegs.w, uLegs.z, left ), mix( uLegs.y, uLegs.x, left ), front );
  if ( H < 0.001 ) return 0.0;
  // an irregular top: wavy round the leg, rising to a point at the back, the hairs at its edge
  float rag = ( vnoise( p * vec3( 22.0, 5.0, 22.0 ) + uSeed ) - 0.5 ) * 0.05 * ( 0.5 + uFace.z ) + ( vnoiseB( p * 55.0 ) - 0.5 ) * 0.012;
  float h = p.y + rag - 0.045 * smoothstep( 0.1, 0.9, -n.z ) * smoothstep( 0.1, 0.25, H ) + ( furHairN - 0.5 ) * 0.03;
  return ( 1.0 - smoothstep( H - 0.012, H + 0.012, h ) ) * ( 1.0 - smoothstep( 0.95, 1.05, p.y ) );
}
// returns the white, and (in .y) the field it was cut from
vec2 pintoWhite( vec3 p, vec3 n, float tail, float head, float hairN ) {
  float amt = uPinto.y;
  vec3 sp = p + uSeed;
  float neckT = clamp( dot( p - NECK_O, NECK_A ) / NECK_L, 0.0, 1.5 );
  if ( uPinto.x < 1.5 ) {
    // TOBIANO: big smooth patches, white that comes up from the legs and crosses the back, a dark head and chest.
    // Everything here changes slowly (no fine noise, no terms from the surface's facing), so the threshold cuts
    // rounded patches with no slivers
    vec3 q = vec3( ( p.x - MIDX ) * 0.45, p.y * 0.5, p.z * 1.15 ) * 1.35 + uSeed;
    float nz = vnoise( q ) * 0.75 + vnoiseB( q * 1.9 + 3.0 ) * 0.25;
    float w = ( nz - 0.5 ) * 2.4 + ( amt - 0.5 ) * 1.8;
    w += 1.5 * ( 1.0 - smoothstep( 0.35, 0.95, p.y ) ) * ( 1.0 - tail );        // the legs
    w -= 3.0 * head + 1.5 * smoothstep( 0.45, 1.0, neckT );                     // the head and the top of the neck
    w -= 0.9 * smoothstep( 0.3, 0.75, p.z ) * ( 1.0 - smoothstep( 0.95, 1.35, p.y ) );   // the chest
    w += 0.35 * smoothstep( 1.15, 1.6, p.y ) * ( 1.0 - head );                  // white crosses the top line
    return vec2( smoothstep( -0.04, 0.04, w ), w );
  }
  if ( uPinto.x < 2.5 ) {
    // OVERO: jagged white on the sides and belly, framed in colour: never across the back, the legs dark. The side patch
    // is a rounded blob with scalloped, jagged edges; the head is left to the face marking
    float side = smoothstep( 0.1, 0.55, abs( n.x ) );
    vec2 e = vec2( ( p.z + 0.08 ) / 0.62, ( p.y - 1.06 ) / 0.26 );
    float barrel = 1.0 - smoothstep( 0.55, 1.15, length( e ) );
    float neck = smoothstep( 0.12, 0.35, neckT ) * ( 1.0 - smoothstep( 0.65, 0.9, neckT ) ) * ( 1.0 - head );
    float under = smoothstep( -0.3, -0.8, n.y ) * smoothstep( 0.7, 0.85, p.y ) * ( 1.0 - smoothstep( 1.1, 1.25, p.y ) );
    float core = max( side * max( barrel, neck * 0.8 ), under * 0.85 );
    float nz = vnoise( sp * 1.6 ) - 0.5;
    float scallop = vnoise( sp * 4.2 ) - 0.5;
    float jag = vnoiseB( sp * 11.0 ) - 0.5;
    float w = core * 1.3 - 0.62 + nz * 0.8 + scallop * 0.55 + jag * 0.3 + ( amt - 0.5 ) * 0.9;
    w -= 2.0 * smoothstep( 0.55, 0.85, n.y ) * ( 1.0 - head );                  // the top line keeps its colour
    w -= 2.0 * ( 1.0 - smoothstep( 0.62, 0.85, p.y ) ) + 2.0 * tail + 3.0 * head;
    // (the edge broken hair by hair, like a sock's top)
    float hairy = ( furHairN - 0.5 ) * 0.09 + ( vnoiseB( sp * 38.0 ) - 0.5 ) * 0.05;
    return vec2( smoothstep( -0.025, 0.025, w + hairy ), w );
  }
  // SABINO: white high up the legs with ragged tops, white along the belly, and roaning: single white hairs ticked
  // into the coat near the white and low on the barrel (picked hair by hair from the fine streak noise)
  float nz = vnoise( sp * 2.3 ) - 0.5;
  float jag = vnoise( sp * 12.0 ) - 0.5 + 0.6 * ( vnoiseB( sp * 34.0 ) - 0.5 );
  float legs = ( 0.5 + amt * 0.35 + nz * 0.3 + jag * 0.22 - p.y ) * 6.0 - 12.0 * tail;
  float under = smoothstep( -0.15, -0.8, n.y ) * smoothstep( 0.65, 0.85, p.y ) * ( 1.0 - smoothstep( 1.15, 1.3, p.y ) ) * ( 1.0 - head );
  float belly = under * 1.5 - 0.6 + nz * 1.0 + jag * 0.6 + ( amt - 0.5 ) * 0.8;
  float w = max( legs, belly );
  float zone = 1.0 - smoothstep( 0.0, 0.35, -w );
  zone = max( zone, 0.3 * smoothstep( 0.2, 0.6, abs( n.x ) ) * smoothstep( 0.8, 0.95, p.y ) * ( 1.0 - smoothstep( 1.05, 1.2, p.y ) )
                   * smoothstep( -0.65, -0.45, p.z ) * ( 1.0 - smoothstep( 0.2, 0.4, p.z ) ) );   // (the flanks and lower barrel, not the shoulder)
  zone *= uPinto.z * ( 1.0 - head ) * ( 1.0 - tail ) * ( 1.0 - smoothstep( 0.5, 0.8, n.y ) );
  // (close up: the hairs themselves; from further off, where a hair is smaller than a pixel, their average: a light
  // frosting, never a grey smudge)
  float tick = smoothstep( 1.0 - zone * 0.55, 1.03 - zone * 0.55, hairN );
  float roan = mix( zone * 0.2, tick, furFineFade );
  return vec2( max( smoothstep( -0.03, 0.03, w ), roan ), w );
}
float whiteAt( vec3 p, vec3 n, float tail, float head, float hairN, float mane ) {
  float w = max( faceWhite( p, n ) * smoothstep( 0.3, 0.7, head ), legWhite( p, n ) * ( 1.0 - tail ) );
  if ( uPinto.x > 0.5 ) w = max( w, pintoWhite( p, n, tail, head, hairN ).x * ( uPinto.x > 2.5 ? 1.0 - mane : 1.0 ) );
  return w;
}

// the light on hair: a narrow velvet glow where the light grazes the coat, and a hair highlight that runs across the
// hairs (Kajiya-Kay), both the coat's own colour (a dark coat's: a cool blue-grey), instead of a plastic's white spot
vec3 furDirect( vec3 L, vec3 V, vec3 N, vec3 color, vec3 albedo ) {
  float nl = dot( N, L ), nv = saturate( dot( N, V ) );
  float wrap = saturate( ( nl + 0.3 ) / 1.3 );
  float rim = pow( 1.0 - nv, 5.0 );
  vec3 tint = albedo * 1.5 + furCool;
  vec3 sheen = color * wrap * rim * furSheen * tint;
  vec3 H = normalize( L + V );
  float th = dot( furT, H );
  float kk = pow( sqrt( max( 0.0, 1.0 - th * th ) ), furShinePow );
  float edge = mix( 1.0, 0.2 + 1.6 * pow( 1.0 - nv, 1.5 ), furEdge );
  vec3 shine = color * saturate( nl ) * kk * furShine * edge * tint;
  // and a soft, broad band of it across the whole coat (so the muscles catch the light), not just toward the outline
  float broad = pow( sqrt( max( 0.0, 1.0 - th * th ) ), 9.0 );
  shine += color * saturate( nl ) * broad * furBroad * tint;
  return sheen + shine;
}
`;

export const LIGHT_HOOK = /* glsl */`
#include <lights_physical_pars_fragment>
vec3 coatAlbedo = vec3( 0.5 );
void RE_Direct_Coat( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  ReflectedLight plain = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
  RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, plain );
  reflectedLight.directDiffuse += plain.directDiffuse;
  reflectedLight.directSpecular += plain.directSpecular * furSpec + furDirect( directLight.direction, geometryViewDir, geometryNormal, directLight.color, coatAlbedo );
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
float cLow = fbm2( cP * 2.3 + uSeed );
// ── the streaks: hair-sized noise squeezed along the way the hair lies, per part, blended where the parts meet (the
// barrel's lie swings between two angles over the body, so it isn't one brushed direction)
float fineFade = 1.0 - smoothstep( 0.3 / FINE_F, 0.9 / FINE_F, cPx );
float medFade = 1.0 - smoothstep( 0.3 / MED_F, 0.9 / MED_F, cPx );
float cSwing = smoothstep( 0.3, 0.7, cLow );
vec3 cAxB = normalize( mix( AX_BODY, AX_BODY2, cSwing ) );
vec3 cFlow = cBodyW * cAxB + cHQ * AX_HQ + cLegs * AX_LEG + cNeck * AX_NECK + cHead * AX_HEAD;
cFlow = mix( cFlow, AX_MANE * cMane + AX_TAIL * cTail + 1e-4, cHair );
vec3 cFr = cFlow - cN * dot( cFlow, cN );
cFr = dot( cFr, cFr ) > 1e-6 ? normalize( cFr ) : normalize( cross( cN, vec3( 1.0, 0.0, 0.0 ) ) + 1e-4 );
furAcrossR = cross( cN, cFr );
float cE = 0.25 / FINE_F;
vec4 S = vec4( 0.5 );
if ( medFade > 0.0 ) {
  vec3 dd = furAcrossR * cE;
  vec4 acc = vec4( 0.0 ); float wsum = 0.0, w;
  w = cBodyW; if ( w > 0.04 ) {
    vec4 s1 = cSwing < 0.98 ? streaks( cP, dd, AX_BODY, FINE_F, FINE_S, MED_F, MED_S ) : vec4( 0.5 );
    vec4 s2 = cSwing > 0.02 ? streaks( cP, dd, AX_BODY2, FINE_F, FINE_S, MED_F, MED_S ) : vec4( 0.5 );
    acc += w * mix( s1, s2, cSwing ); wsum += w;
  }
  w = cHQ;    if ( w > 0.04 ) { acc += w * streaks( cP, dd, AX_HQ, FINE_F, FINE_S, MED_F, MED_S ); wsum += w; }
  w = cLegs;  if ( w > 0.04 ) { acc += w * streaks( cP, dd, AX_LEG, FINE_F, FINE_S, MED_F, MED_S ); wsum += w; }
  w = cNeck;  if ( w > 0.04 ) { acc += w * streaks( cP, dd, AX_NECK, FINE_F, FINE_S, MED_F, MED_S ); wsum += w; }
  w = cHead;  if ( w > 0.04 ) { acc += w * streaks( cP, dd, AX_HEAD, FINE_F * 1.3, FINE_S, MED_F * 1.4, MED_S ); wsum += w; }
  if ( wsum > 0.0 ) S = mix( vec4( 0.5 ), acc / wsum, clamp( wsum * 4.0, 0.0, 1.0 ) );
}
float sFine = mix( 0.5, S.x, fineFade ), sMed = mix( 0.5, S.z, medFade );
// the bump across the hairs (a slope, in metres per metre); the coarse lie a little lumpy, as hair lies in tufts
furSlope = ( ( S.y - S.x ) * 0.00033 * fineFade * ( 0.6 + 0.8 * S.z ) + ( S.w - S.z ) * 0.0005 * medFade ) / cE * uFur.x * ( 1.0 - 0.55 * cHead );

// ── the colour
vec3 col = uBase * ( 0.9 + 0.2 * cLow );
// a darker top line, a lighter underside and inside of the legs
float cUp = smoothstep( 0.35, 0.95, cN.y ) * smoothstep( 1.1, 1.4, cP.y ) * ( 1.0 - cHead );
col *= 1.0 - uCoat.z * cUp * ( 0.55 + 0.45 * cLow );
float cUnder = smoothstep( -0.1, -0.75, cN.y ) * smoothstep( 0.6, 0.85, cP.y ) * ( 1.0 - smoothstep( 1.25, 1.45, cP.y ) ) * ( 1.0 - cHead );
float cInner = smoothstep( 0.1, 0.65, -sign( cP.x - MIDX ) * cN.x ) * smoothstep( 0.55, 0.85, cP.y ) * ( 1.0 - smoothstep( 1.05, 1.25, cP.y ) ) * ( 1.0 - cHead );
float cLight = max( cUnder, cInner * 0.75 ) * uCoat.y;
vec3 cPale = mix( col, vec3( dot( col, vec3( 0.3333 ) ) ), 0.3 ) * 1.55 + 0.02;
col = mix( col, cPale, cLight );
// greying: the colour goes first, then the grey lightens to white; dapples are round lighter spots with mid-grey gaps
if ( uGrey.x > 0.001 ) {
  float lum = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 dark = vec3( lum ) * vec3( 0.97, 0.97, 1.0 );
  float lowLeg = 1.0 - smoothstep( 0.32, 0.72, cP.y + ( cLow - 0.5 ) * 0.12 );
  float g = uGrey.x + 0.22 * cHead - 1.0 * uGrey.w * lowLeg * ( 1.0 - cHair ) + 0.25 * ( cLow - 0.5 ) - 0.12 * smoothstep( 0.0, 1.0, cEar );
  if ( uGrey.y > 0.001 ) {
    // (over the whole body and neck, thinning out down the legs; none on the head)
    float body = ( 1.0 - cHead ) * ( 1.0 - 0.9 * lowLeg ) * ( 1.0 - cHair ) * ( 1.0 - 0.35 * cLegs );
    vec3 warp = vec3( vnoise( cP * 6.0 ), vnoiseB( cP * 6.0 + 4.0 ), vnoise( cP * 6.0 + 9.0 ) ) - 0.5;
    vec2 c = cells( cP / uGrey.z + uSeed + warp * 0.5 );
    float rad = 0.44 + 0.16 * c.y + ( vnoise( cP * 9.0 ) - 0.5 ) * 0.12;    // each dapple its own size, not quite round,
    float spot = 1.0 - smoothstep( rad - 0.16, rad + 0.06, c.x + ( vnoise( cP * 45.0 ) - 0.5 ) * 0.06 );   // close packed
    g += ( spot - 0.68 ) * uGrey.y * body * 0.5;
  }
  g = clamp( g, 0.0, 1.0 );
  col = mix( mix( col, dark, smoothstep( 0.0, 0.25, uGrey.x ) ), uWhiteCol, pow( smoothstep( 0.0, 1.0, g ), 2.2 ) );
}
// a faint dapple bloom on the hip and the shoulder (a well-fed bay or chestnut): rounded lighter spots in a slightly
// darker net, a few per cent either way
if ( uPinto.w > 0.001 && uGrey.x < 0.001 ) {
  float hip = smoothstep( -0.25, -0.5, cP.z ) * smoothstep( 0.95, 1.2, cP.y );
  float sho = smoothstep( 0.18, 0.32, cP.z ) * ( 1.0 - smoothstep( 0.55, 0.7, cP.z ) ) * smoothstep( 0.95, 1.12, cP.y ) * ( 1.0 - smoothstep( 1.38, 1.5, cP.y ) );
  float region = max( hip, sho ) * ( 1.0 - cLegs ) * ( 1.0 - cNeck * 0.7 ) * ( 1.0 - cHead ) * smoothstep( 0.15, 0.55, abs( cN.x ) );
  if ( region > 0.01 ) {
    vec3 warp = vec3( vnoise( cP * 6.0 ), vnoiseB( cP * 6.0 + 4.0 ), vnoise( cP * 6.0 + 9.0 ) ) - 0.5;
    vec2 c = cells( cP / 0.1 + uSeed + warp * 0.5 );
    float spot = 1.0 - smoothstep( 0.32 + 0.12 * c.y, 0.55 + 0.12 * c.y, c.x );
    col *= 1.0 + ( spot - 0.5 ) * 0.17 * uPinto.w * region;
  }
}
// points: black legs up to the knees and hocks, black ear tips
float cFront = smoothstep( LEGSPLIT_Z - 0.05, LEGSPLIT_Z + 0.05, cP.z );
float cPointTop = mix( HOCK_Y + 0.05, KNEE_Y + 0.06, cFront );
float cPoints = ( 1.0 - smoothstep( cPointTop - 0.07, cPointTop + 0.09, cP.y + ( cLow - 0.5 ) * 0.14 + 0.03 * cN.z ) ) * ( 1.0 - cTail );
cPoints = max( cPoints, smoothstep( 0.55, 0.9, cEar ) * smoothstep( POLL.y + 0.1, POLL.y + 0.16, cP.y ) );   // (the tips, not the base)
col = mix( col, uPointsCol * ( 0.85 + 0.3 * cLow ), cPoints * uCoat.x );
// the ears: darker inside the cup on their front face, with pale hairs growing out of it
float cEarIn = smoothstep( 0.45, 0.8, cEar ) * smoothstep( 0.15, 0.55, cN.z + 0.25 * abs( cN.x ) ) * smoothstep( POLL.y + 0.02, POLL.y + 0.08, cP.y );
if ( cEarIn > 0.001 ) {
  float tufts = smoothstep( 0.55, 0.8, vnoise( vec3( cP.x * 260.0, cP.y * 40.0, cP.z * 260.0 ) ) );
  col = mix( col, uSkinCol * 0.55, cEarIn * 0.75 );
  col = mix( col, vec3( 0.62, 0.57, 0.5 ), cEarIn * tufts * 0.55 );
}
// the face: a darker muzzle (bare skin under thin hair); dark skin round the eyes, an almond-shaped dark lid
float cT = dot( cP - POLL, FACE_A ) / FACE_L;
float cMuz = smoothstep( 0.74, 0.92, cT ) * smoothstep( 0.4, 0.8, cHead );
vec3 cEd = cP - ( cP.x > MIDX ? EYE_L : EYE_R );
float cEa = length( vec2( cEd.z / 1.5, cEd.y / ( 0.95 - 0.35 * smoothstep( 0.0, 1.5 * EYE_R0, abs( cEd.z ) ) ) ) ) / EYE_R0;
float cEyeRing = ( 1.0 - smoothstep( 1.0, 2.2, cEa ) ) * smoothstep( 0.4, 0.8, cHead );
float cLid = smoothstep( 0.75, 0.95, cEa ) * ( 1.0 - smoothstep( 1.15, 1.45, cEa ) ) * smoothstep( 0.4, 0.8, cHead );
col = mix( col, uSkinCol * ( 0.85 + 0.3 * cLow ), cMuz * uCoat.w );
col = mix( col, uSkinCol, cEyeRing * 0.3 );
// the crest: hair-coloured roots under the mane (the tail's dock keeps the coat's colour: the tail's strips grow from
// inside it)
if ( cMane > 0.01 ) {
  vec3 hc = uManeCol * ( 1.0 + uHair.z * ( sMed - 0.5 ) ) * mix( 1.0 - uHair.x, 1.0 + uHair.y, smoothstep( 0.05, 0.95, cAlong ) );
  col = mix( col, hc, cMane );
}
// white hair: markings and patterns (pink skin shows through, softly, on a white muzzle)
furFineFade = fineFade; furMedFade = medFade;
furHairN = mix( 0.5, S.x * 0.7 + S.z * 0.3, fineFade );
float cW = whiteAt( cP, cN, cTail, cHead, mix( S.z, S.x * 0.75 + S.z * 0.25, fineFade ), cMane );
vec3 cWhite = uWhiteCol * ( 0.94 + 0.08 * cLow );
col = mix( col, cWhite, cW );
col = mix( col, uPinkCol, cW * smoothstep( 0.8, 0.97, cT ) * smoothstep( 0.4, 0.8, cHead ) * 0.4 );
col = mix( col, uSkinCol * 0.7, cLid * 0.3 );
// the hooves: matte dark horn, or pale under a white leg, with faint vertical growth stripes
float cHoof = 1.0 - smoothstep( HOOF_Y - 0.006, HOOF_Y + 0.006, cP.y - 0.022 * cN.z );
if ( cHoof > 0.0 ) {
  float pale = whiteAt( vec3( cP.x, HOOF_Y + 0.015, cP.z ), cN, 0.0, 0.0, 0.5, 0.0 );
  float lines = vnoise( vec3( cP.x * 180.0, cP.y * 4.0, cP.z * 180.0 ) ) * 0.7 + vnoiseB( vec3( cP.x * 60.0, cP.y * 2.0, cP.z * 60.0 ) ) * 0.3;
  vec3 hoof = mix( uHoofDark, uHoofPale, smoothstep( 0.3, 0.7, pale + ( lines - 0.5 ) * 0.5 * pale * ( 1.0 - pale ) * 4.0 ) );
  col = mix( col, hoof * ( 0.9 + 0.2 * lines ), cHoof );
}
// the hair-by-hair colour: lighter and darker hairs, a slightly uneven lie
col *= 1.0 + uFur.y * ( ( sFine - 0.5 ) * 0.22 + ( sMed - 0.5 ) * 0.16 ) * ( 1.0 - cHoof );
diffuseColor.rgb = col;
coatAlbedo = col;
float cLum = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
float cDark = 1.0 - smoothstep( 0.02, 0.1, cLum );
furCool = vec3( 0.05, 0.062, 0.085 ) * cDark;
// roughness: the barrel's short coat a little glossier than the legs; moist muzzle; matte hooves
furRough = mix( 0.52, 0.66, cLegs ) + 0.05 * cHead;
furRough = mix( furRough, 0.45, cMuz * 0.6 );
furRough = mix( furRough, 0.8, cHoof );
furRough = clamp( furRough + ( sFine - 0.5 ) * 0.1 + 0.05 * cW, 0.05, 1.0 );
furSpec = mix( 0.16, 1.0, max( cHoof * 0.6, cMuz * 0.5 ) );
furSheen = 0.6 * uFur.z * ( 1.0 - cHoof ) * ( 1.0 - 0.6 * cMuz );
furShine = uFur.w * 0.36 * ( 1.0 - cHoof ) * ( 1.0 - cMuz * 0.7 ) * ( 0.7 + 0.6 * sFine );
furShinePow = 40.0;
furEdge = 1.0;
furBroad = uFur.w * 0.11 * ( 1.0 - cHoof ) * ( 1.0 - cMuz * 0.6 ) * ( 0.8 + 0.4 * sMed );
vec4 cDebug = vec4( 0.0 );
if ( uMask > 0.5 ) {
  if ( uMask < 1.5 ) cDebug = vec4( cLegs + cHair * 0.8, cNeck + cHead + cTail * 0.6, cHQ + cMane * 0.9 + cHead, 1.0 );
  else if ( uMask < 2.5 ) cDebug = vec4( cMane, cTail, cAlong, 1.0 );
  else if ( uMask < 3.5 ) cDebug = vec4( vec3( cW ), 1.0 );
  else if ( uMask < 4.5 ) cDebug = vec4( cFr * 0.5 + 0.5, 1.0 );
  else if ( uMask < 5.5 ) cDebug = vec4( vec3( sFine * 0.5 + sMed * 0.5 ), 1.0 );
  else if ( uMask < 6.5 ) cDebug = vec4( vec3( fract( cP.y * 10.0 ) < 0.08 ? 1.0 : 0.25 ), 1.0 ) + vec4( cHoof, cPoints * 0.5, 0.0, 0.0 );
  else if ( uMask < 7.5 ) cDebug = vec4( col * 1.25, 1.0 );   // the colour alone, no light
  else cDebug = vec4( vec3( vRestN.w ), 1.0 );                 // the baked shade
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
  furT = normalize( T + normal * ( sFine - 0.5 ) * 0.35 );  // (each hair's highlight shifted a little: a sheen broken by the fur)
}
`;

// the baked shade: the sky light (and some of the sun) dimmed where the body hides the sky: under the belly, between
// the legs, in the creases behind the elbow, at the girth, the stifle and the throat
const FRAG_AO = /* glsl */`
{
  float ao = mix( 1.0, vRestN.w, uAO );
  reflectedLight.indirectDiffuse *= ao;
  reflectedLight.indirectSpecular *= ao * ao * furSpec;
  reflectedLight.directDiffuse *= mix( 1.0, ao, 0.5 * uAO );
  reflectedLight.directSpecular *= mix( 1.0, ao, 0.7 * uAO );
}
`;
// a fuzzy outline: short hair standing off the skin catches light at the edge, so the outline is a touch lighter (and a
// dark coat's has a cool blue-grey to it)
const FRAG_RIM = /* glsl */`
{
  float rimNV = saturate( dot( normal, geometryViewDir ) );
  float rim = pow( 1.0 - rimNV, 2.5 ) * ( 1.0 - cHoof ) * uFur.z;
  outgoingLight *= 1.0 + 0.14 * rim;
  outgoingLight += vec3( 0.5, 0.58, 0.72 ) * 0.03 * rim * cDark * mix( 1.0, vRestN.w, uAO );
}
if ( uMask > 0.5 ) outgoingLight = cDebug.rgb * 0.8;
`;

// HOLLOWS: for each corner, the mean height of its neighbours above the plane it faces, over the mean edge length (so
// it doesn't depend on how finely the model is cut), clamped to 0..1 and smoothed once over the neighbours
function cavity(rest, nrm, index, n) {
  const sum = new Float32Array(n), len = new Float32Array(n), cnt = new Float32Array(n), nb = Array.from({ length: n }, () => []);
  const tri = index ? index.length / 3 : n / 3, vi = (t, c) => (index ? index[t * 3 + c] : t * 3 + c);
  const edge = (a, b) => {
    const dx = rest[b * 3] - rest[a * 3], dy = rest[b * 3 + 1] - rest[a * 3 + 1], dz = rest[b * 3 + 2] - rest[a * 3 + 2];
    sum[a] += dx * nrm[a * 3] + dy * nrm[a * 3 + 1] + dz * nrm[a * 3 + 2]; len[a] += Math.hypot(dx, dy, dz); cnt[a]++; nb[a].push(b);
  };
  for (let t = 0; t < tri; t++) { const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2); edge(a, b); edge(b, a); edge(a, c); edge(c, a); edge(b, c); edge(c, b); }
  const raw = new Float32Array(n), out = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = cnt[i] ? Math.min(1, Math.max(0, (sum[i] / cnt[i]) / (len[i] / cnt[i]) * 2.2)) : 0;
  for (let i = 0; i < n; i++) { let s = raw[i] * 2, c = 2; for (const j of nb[i]) { s += raw[j]; c++; } out[i] = s / c; }
  return out;
}

// HOW MUCH SKY each corner sees (ambient occlusion), baked once at load from the horse at rest: the body's surface is
// stamped into a grid of 2.5 cm cells, and from each corner rays go out over the half of the sky it faces. A ray that
// meets body within 45 cm counts as blocked (less the further away it hits); one that meets body within 12 cm is a
// crease (the elbow, the girth, the stifle, the throat) and darkens it more.
function bakeAO(rest, nrm, index, n) {
  const C = 0.025, R = 0.45, STEP = 0.02, NEAR = 0.12;
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
    const ox = rest[i * 3] + nx * 0.04, oy = rest[i * 3 + 1] + ny * 0.04, oz = rest[i * 3 + 2] + nz * 0.04;
    let occ = 0, near = 0, wsum = 0;
    for (const d of D) {
      const cs = d[0] * nx + d[1] * ny + d[2] * nz; if (cs <= 0.05) continue;
      let hit = 0;
      for (let t = 0; t < R; t += STEP) {
        const ii = Math.floor((ox + d[0] * t - x0) / C), jj = Math.floor((oy + d[1] * t - y0) / C), kk = Math.floor((oz + d[2] * t - z0) / C);
        if (ii < 0 || jj < 0 || kk < 0 || ii >= NX || jj >= NY || kk >= NZ) break;
        if (grid[(kk * NY + jj) * NX + ii]) { hit = 1 - 0.6 * t / R; if (t < NEAR) near += cs; break; }
      }
      // (the ground hides the sky below the belly too)
      if (!hit && d[1] < 0) { const tg = -oy / d[1]; if (tg < R * 2.5) hit = 0.6 * (1 - tg / (R * 2.5)); }
      occ += hit * cs; wsum += cs;
    }
    out[i] = (1 - occ / Math.max(wsum, 1e-6)) * (1 - 0.55 * near / Math.max(wsum, 1e-6));
  }
  return out;
}

export function coatUniforms(shape, px) {
  return {
    uNoise: { value: noiseTexture() }, uRestM: { value: shape.M.clone() },
    uBase: { value: new THREE.Color() }, uPointsCol: { value: new THREE.Color() }, uManeCol: { value: new THREE.Color() },
    uWhiteCol: { value: new THREE.Color() }, uSkinCol: { value: new THREE.Color() }, uPinkCol: { value: new THREE.Color() },
    uHoofDark: { value: new THREE.Color() }, uHoofPale: { value: new THREE.Color() },
    uCoat: { value: new THREE.Vector4() }, uGrey: { value: new THREE.Vector4() }, uFace: { value: new THREE.Vector4() },
    uLegs: { value: new THREE.Vector4() }, uPinto: { value: new THREE.Vector4() }, uSeed: { value: new THREE.Vector3() },
    uFur: { value: new THREE.Vector4(1, 1, 1, 1) }, uHair: { value: new THREE.Vector4() },
    uPx: px || { value: 0.001 }, uMask: { value: 0 }, uAO: { value: 1 },
    uHairLen: { value: new THREE.Vector2(1, 1) },
  };
}
export function coatMaterial(shape, recipe, { px = null } = {}) {
  const u = coatUniforms(shape, px);
  const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 });
  m.name = 'coat';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <skinnormal_vertex>', '#include <skinnormal_vertex>\n' + VERT_MAIN);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS.replace(/attribute[^\n]*\n/g, '').replace('uniform mat4 uRestM;\n', '') + COMMON.replace('SHAPE_CONSTANTS', shape.glsl))
      .replace('#include <lights_physical_pars_fragment>', LIGHT_HOOK)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = furRough;')
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + FRAG_AO)
      .replace('#include <opaque_fragment>', FRAG_RIM + '#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => shape.key;
  m.coat = { uniforms: u, set: (r) => applyRecipe(u, r) };
  if (recipe) applyRecipe(u, recipe);
  return m;
}

// ── the eyes: the model's own glossy material, its own colours if it has them, or else a deep brown iris and a dark,
// wider-than-tall pupil looking out to the side and a little forward ──────────────────────────────────────────────────
export function eyeMaterial(shape, base) {
  const m = base.clone();
  m.name = 'eye';
  // (a model whose eyes carry their own colours, a darker pupil in a deep brown eyeball: those, as made)
  if (shape.eye && shape.eye.geometry.attributes.color) { m.vertexColors = true; return m; }
  const u = { uRestM: { value: shape.M.clone() } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uRestM;\nvarying vec3 vEyeRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEyeRest = ( uRestM * vec4( position, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEyeRest;\n' + shape.glsl)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float side = vEyeRest.x > MIDX ? 1.0 : -1.0;
  vec3 d = normalize( vEyeRest - ( side > 0.0 ? EYE_L : EYE_R ) );
  vec3 look = normalize( vec3( side, 0.06, 0.5 ) );
  float c = dot( d, look );
  float upc = d.y - look.y * c;
  float iris = smoothstep( 0.5, 0.62, c );
  float ring = smoothstep( 0.62, 0.8, c );
  float pupil = smoothstep( 0.76, 0.81, c - upc * upc * 2.0 );
  vec3 col = mix( vec3( 0.01, 0.007, 0.005 ), vec3( 0.03, 0.012, 0.005 ), iris );
  col = mix( col, vec3( 0.045, 0.02, 0.007 ), ring * ( 1.0 - pupil ) * 0.6 );
  col = mix( col, vec3( 0.004, 0.003, 0.003 ), pupil );
  diffuseColor.rgb = col;
}`);
  };
  m.customProgramCacheKey = () => 'horseeye:' + shape.key;
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
  u.uWhiteCol.value.set(r.whiteColor || '#dcd6cc');
  u.uSkinCol.value.set(r.skin || '#2c2523');
  u.uPinkCol.value.set('#b8948a');
  u.uHoofDark.value.set('#3a3430'); u.uHoofPale.value.set('#b5a283');
  u.uCoat.value.set(r.points === 'black' ? 1 : 0, r.belly ?? 0.5, r.sooty ?? 0.2, r.muzzle ?? 0.7);
  u.uGrey.value.set(r.grey || 0, r.dapples || 0, r.dappleSize || 0.1, r.greyLegs ?? 0.6);
  u.uFace.value.set(FACE_CODES[r.face] || 0, r.faceSize ?? 1, r.ragged ?? 0.5, r.face === 'stripe' || r.star ? 1 : 0);
  const L = r.legs || {};
  u.uLegs.value.set(legH(L.FL, false), legH(L.FR, false), legH(L.HL, true), legH(L.HR, true));
  u.uPinto.value.set(PINTO_CODES[r.pinto] || 0, r.white ?? 0.5, r.roan ?? 0.6, r.bloom ?? 0);
  const s = (r.seed ?? 1) * 1.0;
  u.uSeed.value.set((s * 17.31) % 97, (s * 7.77) % 53, (s * 3.19) % 71);
  u.uFur.value.set(r.bump ?? 1, r.streakColor ?? 1, r.sheen ?? 1, r.shine ?? 1);
  u.uHair.value.set(r.roots ?? 0.35, r.tips ?? 0.3, r.strands ?? 0.5, r.maneShine ?? 0.6);
  u.uHairLen.value.set(r.maneLength ?? 0.85, r.tailLength ?? 0.9);
}
