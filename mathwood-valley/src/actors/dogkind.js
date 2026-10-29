// DOG BREEDS IN THE GAME: a breed (dogbreeds.js) made into a kind of the animal library, so the game's own makeAnimal,
// makeDog and the cabin's dogs make it as they make a shiba: lib.need('boston') loads the base dog, reshapes it
// (morph.js), paints its coat (dogcoat.js), adds what the base hasn't got (a collar; on the pug: eyes and bat ears),
// and keeps it as lib.kinds.boston. One mesh, one material, one draw a dog, as the base.
//
//   needBreed(lib, id) -> Promise<kind>       (animals.js lib.need calls this for an id animals.json hasn't got)
//   makeBreedKind(K, breed) -> kind           K: the base kind, loaded; breed: breedOf(id) (dogbreeds.js)
//                                             kind: { scene, clips, info, breed, report }
//   savedBreeds(dir, { fresh }) -> Promise<{ v: 1, breeds }>   models/animals/dogbreeds.json (the Dog Lab's saves),
//                                             read once ({} if it isn't there); fresh: read it again
//   setSavedBreeds(file)                      (the lab, after saving: the file as it now is)
//   paintBreed(geometry, shape, coat, ...)    the coat onto a morphed geometry (for the lab: a coat change without
//                                             a new morph)
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { morphKind, analyseKind } from './morph.js';
import { paintFace, patternPixels, hexToLinear, rng } from './dogcoat.js';
import { breedOf } from './dogbreeds.js';

let SAVED = null, SAVING = null;
export function savedBreeds(dir, { fresh = false } = {}) {
  if (SAVED && !fresh) return Promise.resolve(SAVED);
  if (SAVING && !fresh) return SAVING;
  return (SAVING = fetch(dir + 'dogbreeds.json', { cache: fresh ? 'no-cache' : 'default' })
    .then((r) => (r.ok ? r.json() : { v: 1, breeds: {} })).catch(() => ({ v: 1, breeds: {} }))
    .then((j) => (SAVED = j && typeof j === 'object' && j.breeds ? j : { v: 1, breeds: {} })));
}
export function setSavedBreeds(file) { SAVED = file; SAVING = null; }

export async function needBreed(lib, id) {
  const saved = await savedBreeds(lib.dir);
  const b = breedOf(id, saved);
  if (!b) throw new Error('no such animal: ' + id);
  await lib.need(b.base);
  const kind = makeBreedKind(lib.kinds[b.base], b);
  lib.kinds[id] = kind;   // (not in lib.info: that stays animals.json's own list)
  return kind;
}

// ── the faces, measured on the dog at rest ────────────────────────────────────────────────────────────────────────
// each bone's part of the dog, by the rig
function partsOf(shape) {
  const { rig, names, bones } = shape, part = names.map(() => 'body'), set = (n, p) => { const i = names.indexOf(n); if (i >= 0) part[i] = p; };
  rig.neck.forEach((n) => set(n, 'neck')); rig.chest.forEach((n) => set(n, 'chest')); set(rig.head, 'head');
  if (rig.ears) Object.values(rig.ears).flat().forEach((n) => set(n, 'ear'));
  if (rig.tail) rig.tail.forEach((n) => set(n, 'tail'));
  for (const l of Object.values(rig.legs)) {
    // (the shoulder and the hip are inside the body: the shiba's chest between its front legs hangs on its shoulders)
    const tops = new Set(rig.legTop || []);
    l.chain.forEach((n) => set(n, tops.has(n) ? (l.front ? 'chest' : 'body') : l.front ? 'legF' : 'legB'));
    // (the paw's bone and everything under it)
    const pi = names.indexOf(l.paw);
    bones.forEach((b, i) => { for (let p = b; p; p = p.parent) if (p === bones[pi]) { part[i] = l.front ? 'pawF' : 'pawB'; break; } });
  }
  return part;
}
// how far along a chain of bones (0 at its root .. 1 at its far end) each corner is: for the neck, the tail, the ears
function chains(shape) {
  const { rig, idx, W, X, dom, n } = shape, along = new Float32Array(n);
  const list = [rig.neck, rig.tail, ...(rig.ears ? Object.values(rig.ears) : [])].filter(Boolean);
  for (const chain of list) {
    const ids = new Set(chain.map((c) => idx[c])), r = new THREE.Vector3().setFromMatrixPosition(W[idx[chain[0]]]);
    let far = 1e-6; for (let i = 0; i < n; i++) if (ids.has(dom[i])) far = Math.max(far, Math.hypot(X[i * 3] - r.x, X[i * 3 + 1] - r.y, X[i * 3 + 2] - r.z));
    // (the neck runs from the chest to the head: its far end is where the head starts, not the far side of the throat)
    for (let i = 0; i < n; i++) if (ids.has(dom[i])) along[i] = Math.min(1, Math.hypot(X[i * 3] - r.x, X[i * 3 + 1] - r.y, X[i * 3 + 2] - r.z) / far);
  }
  return along;
}
// smooth 3D value noise (0..1) for the patches
function noise3(seed) {
  const R = rng(seed), P = new Float32Array(512); for (let i = 0; i < 512; i++) P[i] = R();
  const h = (x, y, z) => P[(((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % 512];
  const s = (t) => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = s(x - i), fy = s(y - j), fz = s(z - k);
    return lerp(lerp(lerp(h(i, j, k), h(i + 1, j, k), fx), lerp(h(i, j + 1, k), h(i + 1, j + 1, k), fx), fy),
      lerp(lerp(h(i, j, k + 1), h(i + 1, j, k + 1), fx), lerp(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), fx), fy), fz);
  };
}
// the faces of the base at rest, as paintFace reads them (worked out once per base: the coat's numbers aren't in it)
function facesOf(shape) {
  if (shape.faces) return shape.faces;
  const { X, dom, feat, L, mesh, rig, idx } = shape, g = mesh.geometry, index = g.index, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const part = partsOf(shape), along = chains(shape), nf = (index ? index.count : X.length / 3) / 3;
  const H = L.withers - L.ground, hb = L.head, rumpZ = Math.min(...rig.rump.map((r) => {
    let z = Infinity; for (let i = 0; i < shape.n; i++) if (dom[i] === idx[r]) z = Math.min(z, X[i * 3 + 2]); return z; }));
  const chestZ = L.chest.z1, half = Math.max(-L.chest.x0, L.chest.x1);
  const hu = (z) => (z - hb.z0) / (hb.z1 - hb.z0), hv = (y) => (y - hb.y0) / (hb.y1 - hb.y0), hx = (x) => x / ((hb.x1 - hb.x0) / 2);
  const eye = L.eyeL || { x: (hb.x1 - hb.x0) * 0.22, y: hb.y0 + (hb.y1 - hb.y0) * 0.62, z: hb.z0 + (hb.z1 - hb.z0) * 0.62 };
  const headN = { eyeU: hu(eye.z), eyeV: hv(eye.y), eyeX: Math.abs(hx(eye.x)), stopU: hu(L.zStop) };
  const faces = new Array(nf), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  const w = new Map();
  for (let f = 0; f < nf; f++) {
    const v = [0, 1, 2].map((k) => (index ? index.getX(f * 3 + k) : f * 3 + k));
    a.fromArray(X, v[0] * 3); b.fromArray(X, v[1] * 3); c.fromArray(X, v[2] * 3);
    nn.subVectors(b, a).cross(c.clone().sub(a)); const area = nn.length(); nn.normalize();
    const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
    // its bone: the one with the most weight over its three corners
    w.clear(); for (const q of v) for (let k = 0; k < 4; k++) { const bw = sw.getComponent ? sw.getComponent(q, k) : [sw.getX(q), sw.getY(q), sw.getZ(q), sw.getW(q)][k]; if (bw > 0) { const bi = si.getComponent ? si.getComponent(q, k) : [si.getX(q), si.getY(q), si.getZ(q), si.getW(q)][k]; w.set(bi, (w.get(bi) || 0) + bw); } }
    let bone = dom[v[0]], bw = -1; for (const [bi, s] of w) if (s > bw) { bw = s; bone = bi; }
    const fe = [0, 0, 0]; for (const q of v) fe[feat[q]]++;
    const P = part[bone];
    faces[f] = {
      v, part: P, bone, area, centre: [cx, cy, cz], n: [nn.x, nn.y, nn.z], side: Math.sign(cx) || 1,
      feature: fe[1] >= 2 ? 1 : fe[2] >= 2 ? 2 : 0,
      h: (cy - L.ground) / H, u: (cz - rumpZ) / (chestZ - rumpZ), s: Math.abs(cx) / half,
      along: (along[v[0]] + along[v[1]] + along[v[2]]) / 3,
      // (the back of the skull is the top of the neck's on these dogs: the neck's faces near the head get the head's
      // measures too, so a blaze can run back between the ears)
      head: P === 'head' || P === 'ear' || (P === 'neck' && cz > hb.z0 - (hb.z1 - hb.z0) * 0.7 && cy > hb.y0) ? { u: hu(cz), v: hv(cy), x: hx(cx), ...headN, nose: hu(cz) } : null, noseRule: !L.eyeL,
    };
  }
  shape.faces = faces; shape.H = H;
  return faces;
}

// ── the coat on the geometry ──────────────────────────────────────────────────────────────────────────────────────
const PATTERN_TEX = new Map();
function patternTexture(coat) {
  const key = [coat.pattern, coat.patternColour, coat.patternAmount.toFixed(2), coat.seed].join('|');
  if (PATTERN_TEX.has(key)) return PATTERN_TEX.get(key);
  const p = patternPixels(coat.pattern, { colour: coat.patternColour, amount: coat.patternAmount, seed: coat.seed });
  const tex = new THREE.DataTexture(p.data, p.size, p.size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true; tex.userData.white = p.white; tex.userData.pixels = p;
  PATTERN_TEX.set(key, tex);
  return tex;
}
// the morphed geometry (one corner a vertex, shared by faces) painted face by face: every face its own three corners
// (so a colour stops at its edge), then corners that agree in everything shared again
export function paintBreed(geometry, shape, coat, { seed = coat.seed, parts = [] } = {}) {
  const faces = facesOf(shape), H = shape.H, nz = noise3(seed * 7 + 3), R = rng(seed * 13 + 1);
  const pos = geometry.attributes.position, nor = geometry.attributes.normal, si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight, col0 = shape.mesh.geometry.attributes.color;
  const nc = faces.length * 3 + parts.reduce((s, p) => s + p.count, 0);
  const P = new Float32Array(nc * 3), N = new Float32Array(nc * 3), C = new Float32Array(nc * 3), UV = new Float32Array(nc * 2);
  const SI = new si.array.constructor(nc * 4), SW = new sw.array.constructor(nc * 4);
  const tex = coat.pattern !== 'none' ? patternTexture(coat) : null, white = tex ? tex.userData.white : [0, 0];
  const tile = H * (0.35 + 1.3 * coat.patternScale), psz = 1 / tile;
  const ps = (0.22 + 0.6 * coat.patchSize) * H;   // (a patch's size: from a hand's width to most of a flank)
  const layers = {};
  let k = 0;
  // (the patches' noise, made even: each face's rank among them all, 0..1, so a number of patches covers that share)
  const raw = faces.map((f) => nz(f.centre[0] / ps * 1.4 + 11, f.centre[1] / ps, f.centre[2] / ps) * 0.7 + nz(f.centre[0] / ps * 2.8 + 3, f.centre[1] / ps * 2, f.centre[2] / ps * 2) * 0.3);
  const rank = raw.map((v, i) => i).sort((a, b) => raw[a] - raw[b]); rank.forEach((fi, r) => { faces[fi].noise = r / Math.max(1, faces.length - 1); });
  for (const f of faces) {
    f.rand = R();
    const paint = paintFace(f, coat);
    layers[paint.layer] = (layers[paint.layer] || 0) + 1;
    // (which way the pattern's picture is laid on this face: along the face's most nearly facing axis)
    const ax = Math.abs(f.n[0]) >= Math.abs(f.n[1]) && Math.abs(f.n[0]) >= Math.abs(f.n[2]) ? 0 : Math.abs(f.n[1]) >= Math.abs(f.n[2]) ? 1 : 2;
    for (const q of f.v) {
      P[k * 3] = pos.getX(q); P[k * 3 + 1] = pos.getY(q); P[k * 3 + 2] = pos.getZ(q);
      N[k * 3] = nor.getX(q); N[k * 3 + 1] = nor.getY(q); N[k * 3 + 2] = nor.getZ(q);
      if (paint.rgb) { C[k * 3] = paint.rgb[0]; C[k * 3 + 1] = paint.rgb[1]; C[k * 3 + 2] = paint.rgb[2]; }
      else { C[k * 3] = col0.getX(q); C[k * 3 + 1] = col0.getY(q); C[k * 3 + 2] = col0.getZ(q); }
      if (tex && paint.pattern) {
        const x = shape.X[q * 3], y = shape.X[q * 3 + 1], z = shape.X[q * 3 + 2];
        UV[k * 2] = (ax === 0 ? z : x) * psz; UV[k * 2 + 1] = (ax === 1 ? z : y) * psz;
      } else { UV[k * 2] = white[0]; UV[k * 2 + 1] = white[1]; }
      for (let j = 0; j < 4; j++) { SI[k * 4 + j] = si.array[q * 4 + j]; SW[k * 4 + j] = sw.array[q * 4 + j]; }
      k++;
    }
  }
  // the parts added (a collar, eyes, ears): already in the new rest pose, their own colours
  for (const p of parts) {
    P.set(p.position, k * 3); N.set(p.normal, k * 3); C.set(p.color, k * 3);
    for (let i = 0; i < p.count; i++) { UV[(k + i) * 2] = white[0]; UV[(k + i) * 2 + 1] = white[1]; }
    SI.set(p.skinIndex, k * 4); SW.set(p.skinWeight, k * 4);
    k += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  if (tex) g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4, sw.normalized && false));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4, sw.normalized));
  const merged = mergeVertices(g, 1e-5);
  merged.computeBoundingBox(); merged.computeBoundingSphere();
  return { geometry: merged, map: tex, layers };
}

// ── parts the base hasn't got ─────────────────────────────────────────────────────────────────────────────────────
// Each is made in the base's rest space, takes the bone weights of the nearest corner of the body (so it bends with
// the skin under it), and is carried into the breed's rest pose by the same move as that corner.
function nearestCorner(shape, p, test = () => true) {
  let best = -1, bd = Infinity; const X = shape.X;
  for (let i = 0; i < shape.n; i++) { if (!test(i)) continue; const d = (X[i * 3] - p[0]) ** 2 + (X[i * 3 + 1] - p[1]) ** 2 + (X[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
// a part from triangles in the base's rest space: [[x,y,z] x3, colour] -> attributes in the breed's rest pose
function partFrom(shape, morphed, tris, test, rigid = -1) {
  const n = tris.length * 3, position = new Float32Array(n * 3), normal = new Float32Array(n * 3), color = new Float32Array(n * 3);
  const g0 = shape.mesh.geometry, si0 = g0.attributes.skinIndex, sw0 = g0.attributes.skinWeight;
  const skinIndex = new si0.array.constructor(n * 4), skinWeight = new sw0.array.constructor(n * 4);
  const A = new THREE.Matrix4(), v = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  const cache = new Map();
  let k = 0;
  for (const [pts, rgb] of tris) {
    const moved = pts.map((p) => {
      const key = p.join(',');
      let q = cache.get(key);
      if (!q) {
        const c = nearestCorner(shape, p, test);
        A.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        if (rigid >= 0) A.copy(morphed.T[rigid]);
        else for (let j = 0; j < 4; j++) { const w = sw0.getComponent ? sw0.getComponent(c, j) : [sw0.getX(c), sw0.getY(c), sw0.getZ(c), sw0.getW(c)][j]; const b = si0.array[c * 4 + j]; if (w > 0) for (let e = 0; e < 16; e++) A.elements[e] += morphed.T[b].elements[e] * w; }
        q = { p: v.fromArray(p).applyMatrix4(A).toArray(), c };
        cache.set(key, q);
      }
      return q;
    });
    e1.fromArray(moved[1].p).sub(v.fromArray(moved[0].p)); e2.fromArray(moved[2].p).sub(v.fromArray(moved[0].p)); nn.crossVectors(e1, e2).normalize();
    for (const q of moved) {
      position.set(q.p, k * 3); normal.set([nn.x, nn.y, nn.z], k * 3); color.set(rgb, k * 3);
      // (rigid: held by one bone alone, the head's eyes and ears; else bent with the skin under it, a collar)
      if (rigid >= 0) for (let j = 0; j < 4; j++) { skinIndex[k * 4 + j] = j ? 0 : rigid; skinWeight[k * 4 + j] = j ? 0 : (sw0.normalized ? (sw0.array.constructor === Uint8Array ? 255 : 65535) : 1); }
      else for (let j = 0; j < 4; j++) { skinIndex[k * 4 + j] = si0.array[q.c * 4 + j]; skinWeight[k * 4 + j] = sw0.array[q.c * 4 + j]; }
      k++;
    }
  }
  return { count: n, position, normal, color, skinIndex, skinWeight };
}
// a ring of quads (a band) round an axis: centre c, axes u (across) and w (up), radii ru and rw, its own direction a
// (half-height hh): outer face, top and bottom edges; studs: little pyramids on the outer face every other step
function collarTris(c, a, u, w, ru, rw, hh, th, rgb, studRgb) {
  const T = [], seg = 20, P = (ang, r, h) => { const x = Math.cos(ang), y = Math.sin(ang); return [0, 1, 2].map((i) => c[i] + u[i] * x * (ru + r) + w[i] * y * (rw + r) + a[i] * h); };
  for (let s = 0; s < seg; s++) {
    const a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2;
    const o00 = P(a0, th, -hh), o01 = P(a0, th, hh), o10 = P(a1, th, -hh), o11 = P(a1, th, hh), i00 = P(a0, 0, -hh), i01 = P(a0, 0, hh), i10 = P(a1, 0, -hh), i11 = P(a1, 0, hh);
    T.push([[o00, o10, o11], rgb], [[o00, o11, o01], rgb]);                 // (outside)
    T.push([[i01, o01, o11], rgb], [[i01, o11, i11], rgb]);                 // (top edge)
    T.push([[i00, o10, o00], rgb], [[i00, i10, o10], rgb]);                 // (bottom edge)
    if (studRgb && s % 2 === 0) {
      const am = (a0 + a1) / 2, tip = P(am, th + hh * 0.55, 0), b0 = P(am - 0.09, th, -hh * 0.4), b1 = P(am + 0.09, th, -hh * 0.4), b2 = P(am + 0.09, th, hh * 0.4), b3 = P(am - 0.09, th, hh * 0.4);
      T.push([[b0, b1, tip], studRgb], [[b1, b2, tip], studRgb], [[b2, b3, tip], studRgb], [[b3, b0, tip], studRgb]);
    }
  }
  return T;
}
function collarPart(shape, morphed, breed) {
  const { rig, idx, W, X, dom, n, L } = shape;
  const neck = new Set(rig.neck.map((b) => idx[b])), r0 = new THREE.Vector3().setFromMatrixPosition(W[idx[rig.neck[0]]]), r1 = new THREE.Vector3().setFromMatrixPosition(W[idx[rig.head]]);
  // where it sits: a third of the way up the neck, round the corners near that point
  const at = r0.clone().lerp(r1, rig.neck.length > 1 ? 0.2 : 0.3), axis = r1.clone().sub(r0).normalize();
  const side = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3().crossVectors(axis, side).normalize().negate();
  if (up.y < 0) up.negate();
  const slab = r1.distanceTo(r0) * 0.12; let ru = 0, rw0 = 0, rw1 = 0, cy = 0, cn = 0;
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    if (!neck.has(dom[i]) && dom[i] !== idx[rig.chest[rig.chest.length - 1]]) continue;
    v.fromArray(X, i * 3).sub(at); if (Math.abs(v.dot(axis)) > slab) continue;
    ru = Math.max(ru, Math.abs(v.dot(side))); const wv = v.dot(up); rw0 = Math.max(rw0, wv); rw1 = Math.min(rw1, wv); cy += wv; cn++;
  }
  if (!cn) return null;
  const mid = (rw0 + rw1) / 2, c = at.clone().addScaledVector(up, mid), rw = (rw0 - rw1) / 2;
  const H = L.withers - L.ground, hh = H * 0.045, th = H * 0.018;
  const rgb = hexToLinear(breed.collar.colour), stud = breed.collar.studs ? hexToLinear(breed.collar.studs) : null;
  const tris = collarTris(c.toArray(), axis.toArray(), side.toArray(), up.toArray(), ru * 1.0 + th * 0.2, rw * 1.0 + th * 0.2, hh, th, rgb, stud);
  return partFrom(shape, morphed, tris, (i) => neck.has(dom[i]));
}
// the pug's missing eyes: a round dark eye on each side of the face, set into the head where it faces forward and out
function sphereTris(c, r, rgb, front, frontRgb, shineRgb) {
  const T = [], seg = 8, ring = 5, P = (i, j) => { const th = j / ring * Math.PI, ph = i / seg * Math.PI * 2; return [c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.cos(th), c[2] + r * Math.sin(th) * Math.sin(ph)]; };
  for (let j = 0; j < ring; j++) for (let i = 0; i < seg; i++) {
    const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1);
    const mid = [0, 1, 2].map((k) => (a[k] + cc[k]) / 2 - c[k]), facing = (mid[0] * front[0] + mid[1] * front[1] + mid[2] * front[2]) / r;
    const col = facing > 0.75 ? frontRgb : rgb;
    if (j > 0) T.push([[a, cc, b], col]); if (j < ring - 1) T.push([[a, d, cc], col]);
  }
  // a shine: a small light triangle up and to the side of the pupil
  const s = [0, 1, 2].map((k) => c[k] + front[k] * r * 1.01), up = [0, r * 0.32, 0], sd = [r * 0.25 * Math.sign(front[0] || 1), 0, 0];
  const s0 = [s[0] + up[0] + sd[0], s[1] + up[1], s[2]], s1 = [s0[0] + r * 0.18, s0[1] + r * 0.05, s0[2]], s2 = [s0[0] + r * 0.05, s0[1] + r * 0.2, s0[2]];
  T.push([[s0, s1, s2], shineRgb]);
  return T;
}
function headExtreme(shape, dir) {
  const { X, dom, idx, rig, n } = shape, h = idx[rig.head]; let best = -1, bd = -Infinity;
  for (let i = 0; i < n; i++) if (dom[i] === h) { const d = X[i * 3] * dir[0] + X[i * 3 + 1] * dir[1] + X[i * 3 + 2] * dir[2]; if (d > bd) { bd = d; best = i; } }
  return [X[best * 3], X[best * 3 + 1], X[best * 3 + 2]];
}
// (the front of the face at a spot across and up it: the head's corners near that line, the one furthest forward)
function faceAt(shape, fx, fy) {
  const { X, dom, idx, rig, n, L } = shape, h = idx[rig.head], hb = L.head, hw = (hb.x1 - hb.x0) / 2, hh = hb.y1 - hb.y0;
  const x = fx * hw, y = hb.y0 + fy * hh; let best = null, bz = -Infinity;
  for (let i = 0; i < n; i++) {
    if (dom[i] !== h) continue;
    const dx = X[i * 3] - x, dy = X[i * 3 + 1] - y;
    if (Math.abs(dx) < hw * 0.22 && Math.abs(dy) < hh * 0.16 && X[i * 3 + 2] > bz) { bz = X[i * 3 + 2]; best = [x, y, bz]; }
  }
  return best || [x, y, hb.z1];
}
function eyeParts(shape, morphed, size = 1) {
  const { L, idx, rig, dom } = shape, hb = L.head, hh = hb.y1 - hb.y0, r = hh * 0.085 * size, tris = [];
  for (const s of [1, -1]) {
    // (on the face above the muzzle, looking forward and a little out)
    const p = faceAt(shape, 0.42 * s, 0.68), dir = new THREE.Vector3(0.28 * s, 0.1, 1).normalize();
    const c = [p[0] - dir.x * r * 0.3, p[1], p[2] - dir.z * r * 0.3];
    tris.push(...sphereTris(c, r, hexToLinear('#3a2214'), [dir.x, dir.y, dir.z], hexToLinear('#0a0807'), [0.9, 0.9, 0.9]));
  }
  return partFrom(shape, morphed, tris, (i) => dom[i] === idx[rig.head], idx[rig.head]);
}
// bat ears for a base without ear bones: a broad cupped triangle each side of the top of the head, its hollow facing
// forward and a little out, its base running across the head
function earParts(shape, morphed, m, outRgb, inRgb) {
  const { L, idx, rig, dom } = shape, hb = L.head, hh = hb.y1 - hb.y0, hw = (hb.x1 - hb.x0) / 2, tris = [];
  const tall = hh * 0.5 * m.ears * m.earLength, wide = tall * 0.7 * m.earWidth, th = hh * 0.035;
  const add = (a, b, c, col, s) => tris.push([s > 0 ? [a, b, c] : [a, c, b], col]);
  for (const s of [1, -1]) {
    const root = headExtreme(shape, [0.5 * s, 0.86, -0.1]);
    const splay = 0.35 + 0.35 * Math.min(1.5, Math.max(-0.5, m.earSplay));
    const up = [Math.sin(splay) * s, Math.cos(splay), 0.12 * m.earTilt];
    const across = [Math.cos(splay) * s, -Math.sin(splay), -0.3 * s * 0];
    const at = (u, v, back = 0) => [0, 1, 2].map((k) => root[k] - up[k] * hh * 0.06 + across[k] * u + up[k] * v + (k === 2 ? -back : 0));
    // the front (the hollow): a fan of five round its middle, pushed back at the middle
    const b0 = at(-wide * 0.5, 0), b1 = at(wide * 0.5, 0), tip = at(wide * 0.06, tall), lf = at(-wide * 0.3, tall * 0.55), rf = at(wide * 0.36, tall * 0.5), mid = at(0, tall * 0.38, th * 1.2);
    add(b0, mid, lf, inRgb, s); add(lf, mid, tip, inRgb, s); add(tip, mid, rf, inRgb, s); add(rf, mid, b1, inRgb, s); add(b1, mid, b0, inRgb, s);
    // the back, a thickness behind
    const B = (p) => [p[0], p[1], p[2] - th * 2.2];
    const B0 = B(b0), B1 = B(b1), T = B(tip), LF = B(lf), RF = B(rf);
    add(B0, LF, T, outRgb, s); add(B0, T, RF, outRgb, s); add(B0, RF, B1, outRgb, s);
    // the rim
    for (const [p, q, P_, Q] of [[b0, lf, B0, LF], [lf, tip, LF, T], [tip, rf, T, RF], [rf, b1, RF, B1]]) { add(p, P_, Q, outRgb, s); add(p, Q, q, outRgb, s); }
  }
  return partFrom(shape, morphed, tris, (i) => dom[i] === idx[rig.head], idx[rig.head]);
}
// the base's own ear flaps (a base without ear bones that has been given new ears) pressed into the side of the head
function tuckFlaps(shape, geometry) {
  const { X, dom, idx, rig, n, L } = shape, h = idx[rig.head], hb = L.head, hw = (hb.x1 - hb.x0) / 2, ym = (hb.y0 + hb.y1) / 2;
  const pos = geometry.attributes.position; let moved = 0;
  for (let i = 0; i < n; i++) {
    if (dom[i] !== h || Math.abs(X[i * 3]) < hw * 0.72 || X[i * 3 + 1] < ym - (hb.y1 - hb.y0) * 0.25) continue;
    pos.setX(i, pos.getX(i) * 0.74); pos.setY(i, pos.getY(i) - (hb.y1 - hb.y0) * 0.05); moved++;
  }
  pos.needsUpdate = true;
  return moved;
}

// ── a breed made ──────────────────────────────────────────────────────────────────────────────────────────────────
export function makeBreedKind(K, breed) {
  const t0 = performance.now();
  const shape = analyseKind(K);
  const morphed = morphKind(K, breed.morphFull);
  const coat = breed.coatFull, parts = [];
  if (breed.collar) { const c = collarPart(shape, morphed, breed); if (c) parts.push(c); }
  if (!shape.L.eyeL) parts.push(eyeParts(shape, morphed, breed.morphFull.eyes));
  if (!shape.rig.ears && (breed.ears === 'bat' || breed.ears === 'pricked' || breed.ears === 'tipped')) {
    tuckFlaps(shape, morphed.geometry);
    const out = hexToLinear(coat.ears === 'dark' ? coat.dark : coat.ears === 'tan' ? coat.tan : coat.base);
    parts.push(earParts(shape, morphed, breed.morphFull, out, out.map((x, i) => x * 0.4 + [0.55, 0.36, 0.33][i] * 0.6)));
  }
  const t1 = performance.now();
  const painted = paintBreed(morphed.geometry, shape, coat, { parts });
  // the base's own floppy ear flaps hidden on a base without ear bones that's been given new ears (pressed into the head)
  const mesh = morphed.mesh;
  mesh.geometry = painted.geometry;
  const src = K.scene.getObjectByProperty('isSkinnedMesh', true) || mesh;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, map: painted.map || null });
  mat.name = 'animal'; mat.userData.indoorLit = true; mat.userData.breed = breed.id;
  mesh.material = mat;
  mesh.name = breed.id || mesh.name;
  morphed.scene.name = breed.id || morphed.scene.name;
  const info = { ...morphed.info, from: K.info.file, breed: breed.id, base: breed.base, label: breed.label, tris: painted.geometry.index ? painted.geometry.index.count / 3 : 0 };
  const report = { ...morphed.report, coat: painted.layers, coatMs: Math.round(performance.now() - t1), ms: Math.round(performance.now() - t0), verts: painted.geometry.attributes.position.count, parts: parts.length, src: src.name };
  return { scene: morphed.scene, clips: morphed.clips, info, breed, report, map: painted.map, geometry: painted.geometry };
}
