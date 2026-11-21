// HIS STASIS POD, DRAWN (his words, his file and its numbers: kit/stasispod-plan.js). His file as he made it: his pod's
// triangles sorted into parts that share his points and his picture (nothing of his file is changed, cut or moved): the
// base (with all that stays on it) and the lid's frame (with all that rides on it: the latches, the status strips, the
// struts); and his glass, his own piece, riding on the lid, drawn as tinted see-through glass (POD.glass). The lid and
// his glass turn together about the hinge (POD.hinge), shut (k 0) to open as he made it (k 1). Beside a wreck it takes
// the wreck's crew's colours (ITS COLOURS: podPaint). Fetched only when it is wanted (the Kit Lab, when the piece is
// shown; the Planet Lab, when a planet with a wreck is made), never at the game's start.
//
//   const P = await loadPod()       fetched once (a second call has the same answer); P.facts { tris, draws, texture
//                                   [w, h], textureMB (on the graphics card, with its smaller copies), size [long, tall
//                                   shut, wide] (m), scale, lidTris, glassTris }
//   const mats = podMaterials(P, { patch, paint })   the pod's two materials: 'solid' (his, in his colours or a crew's)
//                                   and 'glass' (his glass's, see-through); patch(material, kind) changes each before it
//                                   is first drawn (the planet's light, its curve, its haze); paint: as podPaint's
//   podPaint(mats, paint)           the pod's colours: null his own; a crew's (src/planet/wreck.js PAINTS: { skin,
//                                   accent (#rrggbb), dark ([r, g, b] times) }): his light paint to their skin, his
//                                   orange to their accent, the rest a shade toward theirs; at once, every pod drawn with
//                                   these materials
//   const p = makePod(P, mats)      p.group: the pod in metres, the middle of its foot at its origin, long along x, its
//                                   front (the screen's side) +z; p.body (his pod turned level, POD.level, its lowest
//                                   point on y 0: whoever sleeps in it lies in this frame); p.model (his units, scaled,
//                                   in p.body); p.lid (the lid's turn, his glass on it)
//     p.set(k)                      the lid at open k (0 shut, 1 as he made it); p.k
//     p.swing(want, dt)             the lid on its way to `want` (0 or 1), eased, POD.swing seconds for the whole way;
//                                   true while it moves
//     p.bed                         the bed in metres for src/onbed.js, and its frame in p.body (kit/stasispod-plan.js)
//     p.dispose()                   (the file's own geometry and picture are kept for the next pod)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { POD, podPieces, podScale, lidAngle, turnLid, bedFrame, levelY } from './stasispod-plan.js';

export const POD_FILE = new URL('../assets/rescue/stasispod2.glb', import.meta.url).href;

let fetched = null;
export function loadPod() {
  if (fetched) return fetched;
  fetched = new GLTFLoader().loadAsync(POD_FILE).then((g) => {
    // (his two meshes: the pod, the one with his picture; his glass, the other)
    const meshes = []; g.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const mesh = meshes.find((m) => m.material && m.material.map) || meshes[0], glassMesh = meshes.find((m) => m !== mesh);
    const geo = mesh.geometry, P = geo.attributes.position.array, I = geo.index.array;
    // his pod's triangles sorted: on the base, on the lid (its frame)
    const parts = podPieces(P, I);
    const lists = { base: [], lid: [] };
    for (const t of parts.base) lists.base.push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]);
    for (const t of parts.lid) lists.lid.push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]);
    const sub = (L) => { const q = new THREE.BufferGeometry(); for (const [n, a] of Object.entries(geo.attributes)) q.setAttribute(n, a); q.setIndex(L); q.computeBoundingSphere(); return q; };
    const geos = { base: sub(lists.base), lid: sub(lists.lid), glass: glassMesh ? glassMesh.geometry : null };
    const mat = mesh.material, map = mat.map, img = map && map.image;
    if (map) map.anisotropy = 4;
    // (turned level: how far down it comes, so its lowest point is on the floor; its size shut, the lid turned down, its
    // highest point)
    const s = podScale(); let low = Infinity, top = 0;
    for (const t of parts.base) for (let c = 0; c < 3; c++) { const v = I[t * 3 + c]; low = Math.min(low, levelY(P[v * 3], P[v * 3 + 1])); top = Math.max(top, levelY(P[v * 3], P[v * 3 + 1])); }
    const a = lidAngle(0); for (const t of parts.lid) for (let c = 0; c < 3; c++) { const v = I[t * 3 + c], q = turnLid([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], a); top = Math.max(top, levelY(q[0], q[1])); }
    const tw = img ? img.width : 0, th = img ? img.height : 0, glassTris = geos.glass ? geos.glass.index.count / 3 : 0;
    const facts = { tris: I.length / 3 + glassTris, draws: geos.glass ? 3 : 2, texture: [tw, th], textureMB: +(tw * th * 4 * 4 / 3 / 1048576).toFixed(1), size: [+(POD.his.long * s).toFixed(2), +((top - low) * s).toFixed(2), +(POD.his.wide * s).toFixed(2)], scale: +s.toFixed(4), lidTris: parts.lid.length, glassTris };
    return { geos, mat, glassMat: glassMesh ? glassMesh.material : null, map, facts, parts, low };
  }).catch((e) => { fetched = null; throw e; });
  return fetched;
}

// ITS COLOURS (kit/stasispod-plan.js; src/planet/wreck.js recolour, the wreck's own rule, here a pixel at a time on his
// picture as it is drawn): his paint read as the screen shows it, by its class, to a crew's colours
const K = POD.paint, f3 = (v) => v.toFixed(3);
const PAINT_GLSL = /* glsl */`
uniform float podPaintOn; uniform vec3 podSkin, podAccent, podDark;
vec3 podScreen(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 podLinear(vec3 c) { return mix(c / 12.92, pow((max(c, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 podRecolour(vec3 lin) {
  vec3 c = podScreen(lin);
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), l = 0.5 * (mx + mn), d = mx - mn;
  float s = d < 1e-6 ? 0.0 : d / max(1e-4, 1.0 - abs(2.0 * l - 1.0));
  float h = d < 1e-6 ? 0.0 : (mx == c.r ? mod((c.g - c.b) / d, 6.0) : mx == c.g ? (c.b - c.r) / d + 2.0 : (c.r - c.g) / d + 4.0) * 60.0;
  vec3 q = min(c * podDark, vec3(1.0));
  if (l > ${f3(K.skin.light)} && s < ${f3(K.skin.sat)}) q = min(podSkin * min(${f3(K.most)}, l / ${f3(K.skin.by)}), vec3(1.0));
  else if (s > ${f3(K.accent.sat)} && h >= ${f3(K.accent.hue[0])} && h <= ${f3(K.accent.hue[1])} && l > ${f3(K.accent.light)}) q = min(podAccent * min(${f3(K.most)}, l / ${f3(K.accent.by)}), vec3(1.0));
  return podLinear(q);
}`;
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export function podPaint(mats, paint) {
  const U = mats.solid.userData.podPaint; if (!U) return;
  U.podPaintOn.value = paint ? 1 : 0;
  if (paint) { U.podSkin.value.fromArray(hex3(paint.skin)); U.podAccent.value.fromArray(hex3(paint.accent)); U.podDark.value.fromArray(paint.dark || [1, 1, 1]); }
}

export function podMaterials(P, { patch = null, paint = null } = {}) {
  const solid = P.mat.clone();
  const U = { podPaintOn: { value: 0 }, podSkin: { value: new THREE.Vector3(1, 1, 1) }, podAccent: { value: new THREE.Vector3(1, 1, 1) }, podDark: { value: new THREE.Vector3(1, 1, 1) } };
  solid.userData.podPaint = U;
  solid.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', PAINT_GLSL + '\nvoid main() {')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  if (podPaintOn > 0.5) diffuseColor.rgb = podRecolour(diffuseColor.rgb);');
  };
  solid.customProgramCacheKey = () => 'pod-solid';
  // THE GLASS: his glass's own material (it carries no settings: as Blender wrote it), tinted, only so much of it over
  // what is behind, and shiny, so it catches the light as glass does
  const G = POD.glass, glass = P.glassMat ? P.glassMat.clone() : new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  glass.color.set(G.colour); glass.map = null; glass.metalness = 0; glass.roughness = G.roughness;
  glass.transparent = true; glass.opacity = G.opacity; glass.depthWrite = false;
  // (one pass for both its sides: three draws a see-through two-sided one twice otherwise)
  glass.forceSinglePass = true;
  const mats = { solid, glass };
  if (patch) for (const [k, m] of Object.entries(mats)) patch(m, k);
  podPaint(mats, paint);
  return mats;
}

const ease = (t) => t * t * (3 - 2 * t);
export function makePod(P, mats) {
  const s = podScale(), [hy, hz] = POD.hinge;
  const group = new THREE.Group(); group.name = 'stasispod';
  // (the body: turned level (POD.level) and down so its lowest point is on the floor; the model in it, his units)
  const body = new THREE.Group(); body.name = 'stasispod:body'; body.rotation.z = POD.level; body.position.y = -P.low * s; group.add(body);
  const model = new THREE.Group(); model.name = 'stasispod:model'; model.scale.setScalar(s); body.add(model);
  const base = new THREE.Mesh(P.geos.base, mats.solid); base.name = 'stasispod:base'; model.add(base);
  // the lid: turned about the hinge line (its pivot on the line, his lid and his glass set back from it)
  const lid = new THREE.Group(); lid.name = 'stasispod:lid'; lid.position.set(0, hy, hz); model.add(lid);
  const off = (m) => { m.position.set(0, -hy, -hz); lid.add(m); return m; };
  off(new THREE.Mesh(P.geos.lid, mats.solid)).name = 'stasispod:lidframe';
  if (P.geos.glass) { const gm = off(new THREE.Mesh(P.geos.glass, mats.glass)); gm.name = 'stasispod:glass'; gm.renderOrder = 3; }
  const p = {
    group, body, model, lid, k: 0, t: 0, bed: bedFrame(s),
    set(k) { p.k = Math.max(0, Math.min(1, k)); p.t = p.k; lid.rotation.x = lidAngle(p.k); },
    swing(want, dt) {
      if (p.t === want) return false;
      p.t = want > p.t ? Math.min(want, p.t + dt / POD.swing) : Math.max(want, p.t - dt / POD.swing);
      p.k = ease(p.t); lid.rotation.x = lidAngle(p.k); return true;
    },
    meshes: () => { const out = []; model.traverse((o) => { if (o.isMesh) out.push(o); }); return out; },
    dispose() { group.removeFromParent(); },
  };
  p.set(0);
  return p;
}
