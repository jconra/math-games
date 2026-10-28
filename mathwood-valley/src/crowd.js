// THE FAR FIGURES (Mathwood Valley): the travellers and wagons on the road past the few drawn as real models, drawn as
// cheap figures, so a busy road reads as busy all the way out: a walker (with a pack and a bedroll, or not), a rider on
// a horse, a wagon with its team, each a handful of boxes (60 to 600 triangles), all of a kind in one draw (three draws
// for the whole road), lit by the valley's sun and sky and lost in its haze like everything else. Their legs swing at
// their pace (in the vertex shader), and each dissolves in or out (the folk's 4 x 4 pattern) as its real model takes
// over or hands back: the real one fading in while its figure fades out.
// A figure at 200 m is 8 pixels tall: past the drawn ones (ROADFOLK.show, TRAFFIC.show) no one can tell. Costs nothing
// to speak of: three draws and a matrix each a frame (a road of 120 travellers: ~30,000 triangles).
//
//   const C = makeCrowd({ W, scene })
//   C.begin()                                       each frame, then one call per figure:
//   C.walker(x, z, heading, pace, look, fade)       look: { shirt, pants, hat (colours), kit: 0 | 1 pack | 2 pack and bedroll, seed }
//   C.rider(x, z, heading, pace, look, fade)        look: { coat (the horse), shirt, hat, seed }
//                                                   (seed: a number of the traveller's own: its step's timing)
//   C.wagon(x, z, heading, pace, look, fade)        look: { cover: true (a canvas top), coat (the team) }
//   C.end()                                         (fade 1 solid .. 0 gone; y is the ground's)
//   C.count  { walker, rider, wagon }    C.far  m (the governor's 'crowd' dial: whoever drives it sets it)    C.dispose()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// part ids: 0 skin, 1 colour A (shirt; the horse's coat; the canvas), 2 colour B (trousers; the rider's shirt), 3 dark
// (boots, hooves, mane, wheels), 4 colour C (the hat), 5 leather and wood (the pack, the saddle, the wagon's bed), 6 the
// rider's trousers, 7 cream (the bedroll, a cover)
const FIXED = { 0: '#c08a64', 3: '#2c231b', 5: '#6b5038', 6: '#43464d', 7: '#d8cfb6' };
// one box of a figure: w x h x d about (x, y, z), part, swing (+1 / -1 swings with the left / right legs, 0 still),
// pivot (the height it swings round), opt (shown only with that much kit), turn (tipped forward, radians)
function box(w, h, d, x, y, z, part, { swing = 0, pivot = 0, opt = 0, turn = 0 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (turn) g.rotateX(turn);
  g.translate(x, y, z);
  return tag(g, part, swing, pivot, opt);
}
function tag(g, part, swing, pivot, opt) {
  const n = g.attributes.position.count, f = (v) => new THREE.BufferAttribute(new Float32Array(n).fill(v), 1);
  g.setAttribute('part', f(part)); g.setAttribute('swing', f(swing)); g.setAttribute('pivot', f(pivot)); g.setAttribute('opt', f(opt));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'part', 'swing', 'pivot', 'opt'].includes(k)) g.deleteAttribute(k);
  return g;
}
function cyl(r, len, x, y, z, part, { along = 'x', opt = 0, seg = 8, half = false } = {}) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false, 0, half ? Math.PI : Math.PI * 2);
  if (along === 'x') g.rotateZ(Math.PI / 2); else if (along === 'z') { g.rotateX(Math.PI / 2); if (half) g.rotateZ(Math.PI / 2); }
  g.translate(x, y, z);
  return tag(g, part, 0, 0, opt);
}
function personAt(x, y0, z, { arms = true } = {}) {
  const P = [];
  for (const s of [1, -1]) {
    P.push(box(0.13, 0.82, 0.15, 0.09 * s, y0 + 0.41, z, 2, { swing: s, pivot: y0 + 0.82 }));
    P.push(box(0.14, 0.1, 0.22, 0.09 * s, y0 + 0.05, z + 0.03, 3, { swing: s, pivot: y0 + 0.82 }));
    if (arms) { P.push(box(0.1, 0.56, 0.12, 0.26 * s, y0 + 1.1, z, 1, { swing: -s, pivot: y0 + 1.36 })); P.push(box(0.08, 0.08, 0.08, 0.26 * s, y0 + 0.79, z, 0, { swing: -s, pivot: y0 + 1.36 })); }
  }
  P.push(box(0.4, 0.58, 0.24, 0, y0 + 1.11, z, 1));
  P.push(box(0.2, 0.24, 0.22, 0, y0 + 1.53, z, 0));
  P.push(box(0.44, 0.03, 0.44, 0, y0 + 1.66, z, 4), box(0.24, 0.12, 0.24, 0, y0 + 1.73, z, 4));
  return P;
}
// a horse facing +z, its middle at (x, z), legs swinging in diagonal pairs (a walk or trot reads the same that far off)
function horseAt(x, z, coat = 1) {
  const H = [];
  H.push(box(0.55, 0.6, 1.5, x, 1.22, z, coat));
  H.push(box(0.3, 0.75, 0.36, x, 1.62, z + 0.82, coat, { turn: 0.6 }));
  H.push(box(0.24, 0.26, 0.58, x, 1.9, z + 1.15, coat, { turn: 0.35 }));
  H.push(box(0.08, 0.7, 0.3, x, 1.7, z + 0.72, 3, { turn: 0.6 }));
  H.push(box(0.12, 0.62, 0.12, x, 1.1, z - 0.82, 3, { turn: -0.35 }));
  for (const [sx, sz, sw] of [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]]) {
    H.push(box(0.13, 0.94, 0.15, x + 0.16 * sx, 0.47, z + 0.58 * sz, coat, { swing: sw, pivot: 0.94 }));
    H.push(box(0.15, 0.1, 0.17, x + 0.16 * sx, 0.05, z + 0.58 * sz + 0.01, 3, { swing: sw, pivot: 0.94 }));
  }
  return H;
}
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false);
const KINDS = {
  walker: () => merge([...personAt(0, 0, 0), box(0.32, 0.42, 0.18, 0, 1.13, -0.22, 5, { opt: 1 }), cyl(0.08, 0.44, 0, 1.43, -0.22, 7, { opt: 2 })]),
  rider: () => {
    const R = horseAt(0, 0, 1);
    R.push(box(0.6, 0.08, 0.5, 0, 1.56, 0.05, 5));
    R.push(box(0.38, 0.55, 0.22, 0, 1.88, -0.02, 2));
    for (const s of [1, -1]) { R.push(box(0.12, 0.5, 0.16, 0.31 * s, 1.42, 0.08, 6)); R.push(box(0.1, 0.42, 0.12, 0.24 * s, 1.86, 0.12, 2, { turn: -0.5 })); }
    R.push(box(0.2, 0.23, 0.21, 0, 2.28, 0, 0));
    R.push(box(0.44, 0.03, 0.44, 0, 2.41, 0, 4), box(0.24, 0.12, 0.24, 0, 2.48, 0, 4));
    return merge(R);
  },
  wagon: () => {
    const G = [box(1.45, 0.45, 3.3, 0, 1.02, -0.7, 5), box(1.5, 0.08, 3.3, 0, 0.78, -0.7, 5)];
    for (const [sx, sz] of [[1, 0.4], [-1, 0.4], [1, -1.85], [-1, -1.85]]) G.push(cyl(sz > 0 ? 0.4 : 0.5, 0.09, 0.8 * sx, sz > 0 ? 0.4 : 0.5, sz, 3, { seg: 10 }));
    G.push(cyl(0.82, 3.1, 0, 1.25, -0.7, 7, { along: 'z', half: true, opt: 1, seg: 10 }));
    G.push(box(1.0, 0.1, 0.4, 0, 1.45, 0.75, 5));
    G.push(...personAt(0, 0.95, 0.75));
    G.push(box(0.06, 0.06, 2.0, 0, 0.9, 1.9, 5));
    G.push(...horseAt(0.58, 3.1, 1), ...horseAt(-0.58, 3.1, 1));
    return merge(G);
  },
};
const CAP = { walker: 256, rider: 160, wagon: 32 };

const VERT_HEAD = `attribute float part; attribute float swing; attribute float pivot; attribute float opt;
attribute vec3 iColA; attribute vec3 iColB; attribute vec3 iColC; attribute vec4 iGait;
uniform float uTime; uniform vec3 cFix0, cFix3, cFix5, cFix6, cFix7;
varying vec3 vPartCol; varying float vFade;
`;
// iGait: x the legs' swing rate (radians a second; 0 standing), y its phase, z the fade, w the kit shown (0, 1, 2)
const VERT_BODY = `vec3 transformed = vec3(position);
  float gAng = iGait.x > 0.01 ? sin(uTime * iGait.x + iGait.y) * 0.5 * swing : 0.0;
  float gc = cos(gAng), gs = sin(gAng); vec3 gq = transformed - vec3(0.0, pivot, 0.0);
  transformed = vec3(gq.x, gq.y * gc - gq.z * gs, gq.y * gs + gq.z * gc) + vec3(0.0, pivot, 0.0);
  if (opt > iGait.w + 0.5) transformed = vec3(0.0);
  vPartCol = part < 0.5 ? cFix0 : part < 1.5 ? iColA : part < 2.5 ? iColB : part < 3.5 ? cFix3 : part < 4.5 ? iColC : part < 5.5 ? cFix5 : part < 6.5 ? cFix6 : cFix7;
  vFade = iGait.z;`;
const FRAG_HEAD = `varying vec3 vPartCol; varying float vFade;
float crowdBayer(vec2 p) { vec2 q = mod(floor(p), 4.0); float a = mod(q.x, 2.0), b = mod(q.y, 2.0), c = floor(q.x / 2.0), d = floor(q.y / 2.0);
  return (8.0 * mod(a + b, 2.0) + 4.0 * b + 2.0 * mod(c + d, 2.0) + d + 0.5) / 16.0; }
`;

export function makeCrowd({ W, scene = W.scene }) {
  const U = { uTime: { value: 0 } };
  for (const k of Object.keys(FIXED)) U['cFix' + k] = { value: new THREE.Color(FIXED[k]) };
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', VERT_BODY);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vPartCol;\n  if (vFade < 0.999 && vFade <= crowdBayer(gl_FragCoord.xy)) discard;');
  };
  mat.customProgramCacheKey = () => 'mv-crowd-1';
  const C = { count: { walker: 0, rider: 0, wagon: 0 }, far: 320, meshes: {} };
  const M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), P = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  function make(kind, cap) {
    const geo = KINDS[kind]();
    const m = new THREE.InstancedMesh(geo, mat, cap);
    for (const [name, n] of [['iColA', 3], ['iColB', 3], ['iColC', 3], ['iGait', 4]]) { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, a); }
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.name = 'crowd:' + kind;
    m.raycast = () => {};
    scene.add(m);
    return m;
  }
  for (const k of Object.keys(CAP)) C.meshes[k] = make(k, CAP[k]);
  const setCol = (attr, i, c) => { col.set(c); attr.array[i * 3] = col.r; attr.array[i * 3 + 1] = col.g; attr.array[i * 3 + 2] = col.b; };
  function put(kind, x, z, h, pace, cycle, a, b, c, kit, fade, seed) {
    let m = C.meshes[kind], i = C.count[kind];
    if (i >= m.instanceMatrix.count) {   // (more than it has room for: a bigger one, once)
      const cap = m.instanceMatrix.count * 2; scene.remove(m); m.geometry.dispose(); m = C.meshes[kind] = make(kind, cap);
      C.count[kind] = 0; return;   // (drawn from the next frame)
    }
    P.set(x, W.heightAt(x, z), z); Qn.setFromAxisAngle(Y, h); M.compose(P, Qn, S1); m.setMatrixAt(i, M);
    const g = m.geometry.attributes;
    setCol(g.iColA, i, a); setCol(g.iColB, i, b); setCol(g.iColC, i, c);
    const G = g.iGait.array; G[i * 4] = pace > 0.08 ? 2 * Math.PI * pace / cycle : 0; G[i * 4 + 1] = (seed * 2.399) % 6.283; G[i * 4 + 2] = fade; G[i * 4 + 3] = kit;   // (the step's phase: fixed by the traveller, not by where it is)
    C.count[kind] = i + 1;
  }
  C.begin = () => { for (const k of Object.keys(C.count)) C.count[k] = 0; };
  C.walker = (x, z, h, pace, look = {}, fade = 1) => put('walker', x, z, h, pace, 1.35, look.shirt || '#8b5a3a', look.pants || '#5a4632', look.hat || '#5b4630', look.kit || 0, fade, look.seed || 0);
  C.rider = (x, z, h, pace, look = {}, fade = 1) => put('rider', x, z, h, pace, 2.4, look.coat || '#5a3b26', look.shirt || '#d6c9a8', look.hat || '#9a8263', 0, fade, look.seed || 0);
  C.wagon = (x, z, h, pace, look = {}, fade = 1) => put('wagon', x, z, h, pace, 2.4, look.coat || '#6a4a30', look.shirt || '#5c5a50', look.hat || '#3a332c', look.cover ? 1 : 0, fade, look.seed || 0);
  C.end = (dt = 0) => {
    U.uTime.value = (U.uTime.value + dt) % 10000;
    for (const k of Object.keys(C.meshes)) {
      const m = C.meshes[k], n = C.count[k]; m.count = n;
      if (!n) continue;
      m.instanceMatrix.needsUpdate = true;
      for (const a of ['iColA', 'iColB', 'iColC', 'iGait']) m.geometry.attributes[a].needsUpdate = true;
    }
  };
  C.dispose = () => { for (const m of Object.values(C.meshes)) { scene.remove(m); m.geometry.dispose(); } mat.dispose(); };
  C.tris = () => Object.fromEntries(Object.entries(C.meshes).map(([k, m]) => [k, m.geometry.attributes.position.count / 3]));
  return C;
}
// a horse's coat for a far rider or a team, from a number (the same one each time for the same traveller)
export const COATS = ['#5a3b26', '#3b2a1e', '#7a5634', '#8c6a46', '#2a2420', '#a08060', '#6b4a2e', '#d8d0c0'];
