// HIS STASIS POD, DRAWN (his words, his file and its numbers: kit/stasispod-plan.js). His mesh as he made it, its
// triangles sorted into parts that share his points and his picture (nothing of his file is changed, cut or moved): the
// base (with all that stays on it), the lid's frame (with all that rides on it: the latches, the status strips, the
// struts), and the lid's window, drawn twice: once in his paint wherever his paint is not glass, and once see-through
// where it is (THE GLASS, below). The lid turns about its hinge (POD.hinge), shut (k 0) to open as he made it (k 1).
// Fetched only when it is wanted (the Kit Lab, when the piece is shown; the Planet Lab, when a planet with a wreck is
// made), never at the game's start.
//
//   const P = await loadPod()       fetched once (a second call has the same answer); P.facts { tris, draws, texture
//                                   [w, h], textureMB (on the graphics card, with its smaller copies), size [long, tall
//                                   shut, wide] (m), scale }
//   const mats = podMaterials(P, { patch })   the pod's three materials: 'solid' (his), 'window' (his where his paint is
//                                   not glass), 'glass' (see-through where it is); patch(material, kind) changes each
//                                   before it is first drawn (the planet's light, its curve, its haze)
//   const p = makePod(P, mats)      p.group: the pod in metres, the middle of its foot at its origin, long along x, its
//                                   front (the screen's side) +z; p.body (his pod turned level, POD.level, its lowest
//                                   point on y 0: whoever sleeps in it lies in this frame); p.model (his units, scaled,
//                                   in p.body); p.lid (the lid's turn)
//     p.set(k)                      the lid at open k (0 shut, 1 as he made it); p.k
//     p.swing(want, dt)             the lid on its way to `want` (0 or 1), eased, POD.swing seconds for the whole way;
//                                   true while it moves
//     p.bed                         the bed in metres for src/onbed.js, and its frame in p.body (kit/stasispod-plan.js)
//     p.dispose()                   (the file's own geometry and picture are kept for the next pod)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { POD, podPieces, podScale, lidAngle, turnLid, bedFrame, levelY } from './stasispod-plan.js';

export const POD_FILE = new URL('../assets/rescue/stasispod.glb', import.meta.url).href;

let fetched = null;
export function loadPod() {
  if (fetched) return fetched;
  fetched = new GLTFLoader().loadAsync(POD_FILE).then((g) => {
    let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    const geo = mesh.geometry, P = geo.attributes.position.array, I = geo.index.array;
    // his triangles sorted: on the base, on the lid (its frame), its window
    const parts = podPieces(P, I), win = new Set(POD.window);
    const lists = { base: [], lid: [], window: [] };
    for (const t of parts.base) lists.base.push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]);
    for (const t of parts.lid) lists[win.has(t) ? 'window' : 'lid'].push(I[t * 3], I[t * 3 + 1], I[t * 3 + 2]);
    const sub = (L) => { const q = new THREE.BufferGeometry(); for (const [n, a] of Object.entries(geo.attributes)) q.setAttribute(n, a); q.setIndex(L); q.computeBoundingSphere(); return q; };
    const geos = { base: sub(lists.base), lid: sub(lists.lid), window: sub(lists.window) };
    const mat = mesh.material, map = mat.map, img = map && map.image;
    if (map) map.anisotropy = 4;
    // (turned level: how far down it comes, so its lowest point is on the floor; its size shut, the lid turned down, its
    // highest point)
    const s = podScale(); let low = Infinity, top = 0;
    for (const t of parts.base) for (let c = 0; c < 3; c++) { const v = I[t * 3 + c]; low = Math.min(low, levelY(P[v * 3], P[v * 3 + 1])); top = Math.max(top, levelY(P[v * 3], P[v * 3 + 1])); }
    const a = lidAngle(0); for (const t of parts.lid) for (let c = 0; c < 3; c++) { const v = I[t * 3 + c], q = turnLid([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], a); top = Math.max(top, levelY(q[0], q[1])); }
    const tw = img ? img.width : 0, th = img ? img.height : 0;
    const facts = { tris: I.length / 3, draws: 4, texture: [tw, th], textureMB: +(tw * th * 4 * 4 / 3 / 1048576).toFixed(1), size: [+(POD.his.long * s).toFixed(2), +((top - low) * s).toFixed(2), +(POD.his.wide * s).toFixed(2)], scale: +s.toFixed(4), lidTris: parts.lid.length, windowTris: lists.window.length / 3 };
    return { geos, mat, map, facts, parts, low };
  }).catch((e) => { fetched = null; throw e; });
  return fetched;
}

// THE GLASS (POD.glass): his paint read where it is drawn (as the screen's numbers, 0..1), glass where it is light and
// hardly coloured. The window's faces are drawn twice: in his paint where this is under a half, see-through where over.
const GLASS_GLSL = /* glsl */`
float podGlass(vec3 c) {
  vec3 s = mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  float mx = max(s.r, max(s.g, s.b)), mn = min(s.r, min(s.g, s.b)), l = 0.5 * (mx + mn), sat = (mx - mn) / max(1e-4, 1.0 - abs(2.0 * l - 1.0));
  return smoothstep(${(POD.glass.light - POD.glass.soft / 2).toFixed(3)}, ${(POD.glass.light + POD.glass.soft / 2).toFixed(3)}, l) * step(sat, ${POD.glass.sat.toFixed(3)});
}`;
export function podMaterials(P, { patch = null } = {}) {
  const solid = P.mat.clone(), window = P.mat.clone();
  window.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', GLASS_GLSL + '\nvoid main() {')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  if (podGlass(sampledDiffuseColor.rgb) > 0.5) discard;');
  };
  window.customProgramCacheKey = () => 'pod-window';
  // the glass: his own paint, darker (a tinted window), and only so much of it over what is behind; shinier than his
  // paint, so it catches the light as glass does
  const G = POD.glass, glass = P.mat.clone();
  // (one pass for both its sides: his window is a single sheet, and three draws a see-through two-sided one twice)
  Object.assign(glass, { transparent: true, depthWrite: false, roughness: 0.18, metalness: 0, forceSinglePass: true });
  glass.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', GLASS_GLSL + '\nvoid main() {')
      .replace('#include <map_fragment>', `#include <map_fragment>
  if (podGlass(sampledDiffuseColor.rgb) <= 0.5) discard;
  diffuseColor = vec4(sampledDiffuseColor.rgb * ${G.paint.toFixed(3)}, ${G.opacity.toFixed(3)});`);
  };
  glass.customProgramCacheKey = () => 'pod-glass';
  const mats = { solid, window, glass };
  if (patch) for (const [k, m] of Object.entries(mats)) patch(m, k);
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
  // the lid: turned about the hinge line (its pivot on the line, his lid set back from it)
  const lid = new THREE.Group(); lid.name = 'stasispod:lid'; lid.position.set(0, hy, hz); model.add(lid);
  const off = (m) => { m.position.set(0, -hy, -hz); lid.add(m); return m; };
  off(new THREE.Mesh(P.geos.lid, mats.solid)).name = 'stasispod:lidframe';
  off(new THREE.Mesh(P.geos.window, mats.window)).name = 'stasispod:window';
  const gm = off(new THREE.Mesh(P.geos.window, mats.glass)); gm.name = 'stasispod:glass'; gm.renderOrder = 3;
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
