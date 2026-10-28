// NIGHT LIGHTS (Mathwood Valley): the town's windows glow and its lanterns burn as the night comes. Nothing is added to the
// scene for the windows: each building's own material (one copy a building) lights up the window panes painted in its
// picture (the dark glass glows, the lighter frames and bars much less), inside boxes laid over each window in the
// building's own frame. The lanterns are the ones the models already carry (the store's by its door, the sheriff's and the
// saloon's porch lanterns, the stable's): their glass glows the same way, a soft halo round each (one draw for all of
// them) and their light, and a little from every lit window, goes into the street lamps' picture (lampLight.js), so the
// porches, the walls, the people and the ground round them are lit warm. All of it comes up gradually with the night.
//
//   const NL = makeNightLights({ village, shade, heightAt })   village: objects/village.js's; shade(sh): the patch the
//                                    valley gives every building already (its hill shade and lamp light), kept on the copy
//   NL.update(dt, on)                each frame: on 0 (day) .. 1 (night); new buildings are fitted as they load
//   NL.set(id, v) / NL.get(id)       how lit a building's windows are at night (0..1; eased over a second): the layout
//                                    item's id ('saloon', 'home2', 'cabin'). The shops and the homes 1; the player's cabin 0
//                                    (dark until it is the player's: src/cabin decides)
//   NL.lamps()                       the lights for the lamp picture: [{ x, y, z, reach, strength }] (world metres)
//   NL.sig                           changes whenever that list does
//   NL.halo                          the halos' mesh (add it to the scene)
//
// The boxes: WINDOWS[kind] = { ref: the building's size (m) they were measured at, list: [[side, u0, u1, v0, v1, d], ...] },
// side the wall ('front' +z, 'back' -z, 'px' +x, 'nx' -x), u along the wall in the frame's own axis (x for front and back,
// z for the sides), v the height over the ground, d where the wall stands along its way out (wallDepth: rays from outside
// at five points of the window, the deepest first hit; left out, it is looked for at load). Measured from the buildings
// drawn flat (~/pw/bandit-math/rigs/town/D/elevations.cjs, windepth.cjs). LANTERNS[kind]: [x, y, z] of each lantern's glass.
import * as THREE from 'three';

export const WINDOWS = {
  cabin: { ref: 6.6, list: [['front', -1.13, -0.41, 1.52, 2.5, 1.2], ['px', -1.14, -0.37, 1.34, 2.46, 2.682], ['nx', -1.23, -0.51, 1.34, 2.46, 2.274]] },
  generalStore: { ref: 11, list: [['front', -3.68, -1.3, 2.38, 4.17, 0.454], ['front', -0.42, 0.42, 2.55, 3.8, 0.305], ['front', 1.85, 3.6, 2.24, 4.05, 0.603],
    ['px', -3.18, -2.35, 2.31, 3.05, 4.702], ['nx', -3.25, -2.34, 2.24, 3.08, 4.756]] },
  sheriff: { ref: 11.7, list: [['front', -3.05, -2.11, 2.28, 3.99, 2.842], ['front', -0.62, 0.21, 2.57, 3.7, 2.842], ['front', 1.95, 2.95, 2.28, 3.99, 2.842],
    ['px', -0.31, 0.76, 2.5, 4.38, 3.928], ['px', -3.49, -2.41, 2.5, 4.38, 3.928], ['nx', -3.66, -2.56, 2.5, 4.38, 3.928], ['nx', -0.47, 0.65, 2.5, 4.38, 3.928],
    ['back', 1.78, 2.7, 2.53, 4.41, 5.516], ['back', -2.58, -1.63, 2.53, 4.41, 5.516]] },
  saloon: { ref: 13.5, list: [['front', -3.56, -2.62, 6.2, 7.45, 3.576], ['front', -0.58, 0.58, 6.2, 7.45, 3.451], ['front', 2.6, 3.53, 6.2, 7.45, 3.583],
    ['front', -3.56, -2.62, 2.08, 3.68, 3.576], ['front', 2.6, 3.53, 2.08, 3.68, 3.576], ['front', -0.9, 0.9, 1.0, 3.9, 3.266],   // (the last: the doorway over the batwing doors)
    ['px', 0.2, 1.47, 5.9, 7.75, 5.059], ['px', -3.26, -1.83, 5.9, 7.75, 5.059], ['px', 0.2, 1.47, 2.03, 3.79, 5.059], ['px', -3.26, -1.83, 2.03, 3.79, 5.059],
    ['nx', -3.25, -1.93, 5.9, 7.75, 5.059], ['nx', 0.18, 1.53, 5.9, 7.75, 5.059], ['nx', -3.25, -1.93, 2.03, 3.79, 5.059], ['nx', 0.18, 1.53, 2.03, 3.79, 5.059]] },
  stable: { ref: 14, list: [['front', -0.25, 1.15, 1.92, 3.57, 2.526]] },   // (the open top half of the barn door)
};
WINDOWS.home = WINDOWS.cabin;                                         // (the homes are the cabin's model)
export const LANTERNS = {
  generalStore: { ref: 11, list: [[1.37, 3.46, 0.9]] },
  sheriff: { ref: 11.7, list: [[-2.51, 3.8, 4.2]] },
  saloon: { ref: 13.5, list: [[-1.57, 3.43, 5.0], [1.22, 3.43, 5.0]] },
  stable: { ref: 14, list: [[-6.23, 3.0, 4.3]] },
};
export const WIN_MAX = 16;                                            // (the most boxes a building has: the saloon's 14 and its 2 lanterns)
const AXIS = { front: [2, 1], back: [2, -1], px: [0, 1], nx: [0, -1] };   // (the wall's depth axis: 0 x, 2 z; and which way is out)
const LIT_DEFAULT = (it) => (it.id === 'cabin' ? 0 : 1);   // (the player's cabin is the layout's 'cabin'; a cabin put down for decor is somebody's house, lit)
const COLOUR = new THREE.Color(1.0, 0.42, 0.1).multiplyScalar(0.22);   // (the windows' warm light: a lamp's, linear; after the night's exposure about a bright orange, the panes' bars still dark)

// the patch on a building's own material copy: a box test over the frame's position (vWin), emissive by how dark the
// picture is there (a window's glass) or, for a lantern's box (w = 1), by how bright (its painted flame and glass)
const WIN_VS = ['uniform mat4 winM; varying vec3 vWin;', 'vWin = (winM * vec4(transformed, 1.0)).xyz;'];
const WIN_FS = `uniform vec4 winMin[${WIN_MAX}], winMax[${WIN_MAX}]; uniform float winN, winOn; uniform vec3 winCol; varying vec3 vWin;`;
const WIN_GLOW = `
  if (winOn > 0.0) { float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), g = 0.0;
    for (int i = 0; i < ${WIN_MAX}; i++) { if (float(i) >= winN) break;
      vec3 d = min(vWin - winMin[i].xyz, winMax[i].xyz - vWin); float m = smoothstep(0.0, 0.05, min(min(d.x, d.y), d.z));
      g = max(g, m * winMax[i].w * (winMin[i].w > 0.5 ? 1.0 + 6.0 * lum : 0.05 + 0.95 * (1.0 - smoothstep(0.012, 0.07, lum)))); }
    totalEmissiveRadiance += winCol * (g * winOn); }`;

// where a window's wall is: rays from outside at five points of it, the deepest first hit (a post in front is nearer), as
// a depth along the wall's way out in the building's frame (metres; null: nothing hit). group: the building's placed
// group (its frame), meshes: its model's meshes. For the table (rigs/town/D/windepth.cjs) and a window measured without one
const ray = new THREE.Raycaster();
export function wallDepth(group, meshes, side, a0, a1, b0, b1) {
  const [ax, out] = AXIS[side], V = new THREE.Vector3(), D = new THREE.Vector3();
  group.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  let deep = null;
  for (const [fu, fv] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
    const u = a0 + (a1 - a0) * fu, v = b0 + (b1 - b0) * fv, from = ax === 2 ? [u, v, out * 40] : [out * 40, v, u];
    V.set(...from).applyMatrix4(group.matrixWorld); D.set(ax === 0 ? -out : 0, 0, ax === 2 ? -out : 0).transformDirection(group.matrixWorld);
    ray.set(V, D); ray.far = 60; const hit = ray.intersectObjects(meshes, false)[0]; if (!hit) continue;
    const p = hit.point.clone().applyMatrix4(inv), dep = (ax === 2 ? p.z : p.x) * out;
    if (deep === null || dep < deep) deep = dep;
  }
  return deep;
}

export function makeNightLights({ village, shade = null, heightAt = () => 0 }) {
  const items = new Map();                                            // id -> { o, U, boxes, lanterns (frame points), lamps (frame) }
  const want = new Map(), shown = new Map();
  let on = 0, sig = '', frames = 0, lampList = [], halosDirty = true;
  // THE HALOS: one instanced quad a lantern, turned to the camera, added light (room for 32)
  const HMAX = 32, hg = new THREE.InstancedBufferGeometry(); const quad = new THREE.PlaneGeometry(1, 1);
  hg.index = quad.index; hg.setAttribute('position', quad.attributes.position); hg.setAttribute('uv', quad.attributes.uv);
  const hPos = new THREE.InstancedBufferAttribute(new Float32Array(HMAX * 3), 3), hAmt = new THREE.InstancedBufferAttribute(new Float32Array(HMAX), 1);
  hPos.setUsage(THREE.DynamicDrawUsage); hAmt.setUsage(THREE.DynamicDrawUsage); hg.setAttribute('hPos', hPos); hg.setAttribute('hAmt', hAmt); hg.instanceCount = 0;
  const hMat = new THREE.ShaderMaterial({ uniforms: { hOn: { value: 0 }, hSize: { value: 2.2 }, hCol: { value: new THREE.Color(1.0, 0.62, 0.3) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute vec3 hPos; attribute float hAmt; uniform float hSize; varying vec2 vUv; varying float vAmt;
      void main() { vUv = uv; vAmt = hAmt; vec4 c = viewMatrix * vec4(hPos, 1.0); c.xy += position.xy * hSize; c.z += 0.3; gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform float hOn; uniform vec3 hCol; varying vec2 vUv; varying float vAmt;
      void main() { float r = length(vUv - 0.5) * 2.0; float a = (pow(max(0.0, 1.0 - r), 3.0) * 0.55 + pow(max(0.0, 1.0 - r * 2.2), 2.0) * 0.6) * vAmt * hOn;
        if (a <= 0.002) discard; gl_FragColor = vec4(hCol * a, 1.0); }` });
  const halo = new THREE.Mesh(hg, hMat); halo.frustumCulled = false; halo.renderOrder = 3; halo.name = 'night-halos';
  const V = new THREE.Vector3(), M = new THREE.Matrix4();

  // a building fitted: its windows' boxes found, its material copied and patched
  function fit(o) {
    const it = o.it, W = WINDOWS[it.kind], LT = LANTERNS[it.kind];
    // (a building made in code lights itself: its own lanterns, glow and window panes (objects/codebuild.js lit); here
    // only how lit it is, and the light it throws on the street for the lamps' picture)
    if (o.code) {
      if (!want.has(it.id)) want.set(it.id, LIT_DEFAULT(it));
      shown.set(it.id, want.get(it.id)); o.lit = true;
      return { o, U: { winOn: { value: 0 } }, mats: [], lamps: o.code.nightLamps.map((L) => ({ at: L.at, reach: L.reach, strength: L.strength })), lanterns: [], at: o.group.matrixWorld.clone(), code: o.code };
    }
    if (!W && !LT) return null;
    const s = it.size / ((W || LT).ref || it.size), boxes = [], lamps = [], lanterns = [];
    o.group.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(o.group.matrixWorld).invert();
    const meshes = []; o.inner.traverse((m) => { if (m.isMesh) meshes.push(m); });
    for (const [side, u0, u1, v0, v1, d0] of (W ? W.list : [])) {
      const [ax, out] = AXIS[side], a0 = u0 * s, a1 = u1 * s, b0 = v0 * s, b1 = v1 * s;
      const deep = d0 != null ? d0 * s : wallDepth(o.group, meshes, side, a0, a1, b0, b1);   // (measured into the table; else looked for now: slow on a big model)
      if (deep === null) continue;
      const lo = out > 0 ? deep - 0.12 : -deep - 0.3, hi = out > 0 ? deep + 0.3 : -deep + 0.12;   // (a little more outward: the frames stand proud)
      boxes.push(ax === 2 ? [a0, b0, lo, a1, b1, hi, 0, 1] : [lo, b0, a0, hi, b1, a1, 0, 1]);
      // its light out in front: a weak lamp a metre out from its middle
      const mu = (a0 + a1) / 2, mv = Math.max(1.2, (b0 + b1) / 2 - 0.4), lamp = ax === 2 ? [mu, mv, (deep + 1.0) * out] : [(deep + 1.0) * out, mv, mu];
      lamps.push({ at: lamp, reach: 4.5 * Math.min(1.6, Math.max(0.8, (a1 - a0) / 1.0)), strength: 0.35 });
    }
    for (const [x, y, z] of (LT ? LT.list : [])) {
      const p = [x * s, y * s, z * s]; lanterns.push(p);
      boxes.push([p[0] - 0.28, p[1] - 0.4, p[2] - 0.28, p[0] + 0.28, p[1] + 0.4, p[2] + 0.28, 1, 1]);
      lamps.push({ at: p, reach: 8, strength: 1 });
    }
    const U = { winMin: { value: Array.from({ length: WIN_MAX }, () => new THREE.Vector4()) }, winMax: { value: Array.from({ length: WIN_MAX }, () => new THREE.Vector4()) },
      winN: { value: Math.min(WIN_MAX, boxes.length) }, winOn: { value: 0 }, winCol: { value: COLOUR }, winM: { value: new THREE.Matrix4() } };
    boxes.slice(0, WIN_MAX).forEach((b, i) => { U.winMin.value[i].set(b[0], b[1], b[2], b[6]); U.winMax.value[i].set(b[3], b[4], b[5], b[7]); });
    const mats = [];
    for (const m of meshes) {
      const src = m.material; if (!src || Array.isArray(src) || !src.isMeshStandardMaterial) continue;
      const mt = src.clone(), mU = { ...U, winM: { value: new THREE.Matrix4() } };   // (each mesh its own frame matrix, the rest shared)
      M.copy(inv).multiply(m.matrixWorld); mU.winM.value.copy(M);
      mt.userData.sunShade = true; mt.userData.nightWin = true;
      mt.onBeforeCompile = (sh, r) => {
        if (shade) shade(sh, r);
        Object.assign(sh.uniforms, mU);
        sh.vertexShader = WIN_VS[0] + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIN_VS[1]);
        sh.fragmentShader = WIN_FS + '\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + WIN_GLOW);
      };
      mt.customProgramCacheKey = () => 'bm-night-win-1' + (shade ? '-shade' : '');
      m.material = mt; mats.push({ m, U: mU });
    }
    if (!want.has(it.id)) want.set(it.id, LIT_DEFAULT(it));
    shown.set(it.id, want.get(it.id));
    return { o, U, mats, lamps, lanterns, at: o.group.matrixWorld.clone() };
  }

  const NL = {
    halo,
    get sig() { return sig; },
    set(id, v) { want.set(id, Math.max(0, Math.min(1, +v || 0))); },
    get(id) { return want.has(id) ? want.get(id) : null; },
    lamps: () => lampList,
    update(dt, night) {
      on = night;
      // newly loaded buildings fitted (and any that moved: their frame matrices again), every few frames
      if ((frames++ % 15) === 0 && village) for (const o of village.objs.values()) {
        if (o.it.type !== 'model' || !o.inner || !(WINDOWS[o.it.kind] || LANTERNS[o.it.kind])) continue;
        const had = items.get(o.it.id);
        if (had && had.o === o) {                                       // (moved, in the lab's editor: its frame matrices again)
          if (had.at.equals(o.group.matrixWorld)) continue;
          o.group.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(o.group.matrixWorld).invert();
          for (const q of had.mats) q.U.winM.value.copy(inv).multiply(q.m.matrixWorld);
          had.at.copy(o.group.matrixWorld); halosDirty = true; continue;
        }
        try { const f = fit(o); if (f) { items.set(o.it.id, f); halosDirty = true; } } catch (e) { console.warn('night lights: a building could not be fitted', o.it.id, e); }
      }
      // each building's windows eased toward what's wanted (a second for a light to come on or go out)
      let moved = false;
      for (const [id, f] of items) {
        const w = want.has(id) ? want.get(id) : 1, s0 = shown.has(id) ? shown.get(id) : w, s1 = s0 + Math.max(-dt, Math.min(dt, w - s0));
        if (Math.abs(s1 - s0) > 1e-4) { shown.set(id, s1); moved = true; }
        f.U.winOn.value = on * s1;
        for (const q of f.mats) q.U.winOn.value = on * s1;
        if (f.code) f.code.lit(on, s1);
      }
      // the halos (one each lantern, by its building's light) and the lamp list, again when anything changed
      if (moved || halosDirty) {
        halosDirty = false; let n = 0; const list = [];
        for (const [id, f] of items) {
          const s = shown.has(id) ? shown.get(id) : 1, mw = f.o.group.matrixWorld;
          for (const p of f.lanterns) if (n < HMAX) { V.set(...p).applyMatrix4(mw); hPos.setXYZ(n, V.x, V.y, V.z); hAmt.setX(n, s); n++; }
          if (s > 0.02) for (const L of f.lamps) { V.set(...L.at).applyMatrix4(mw); list.push({ x: V.x, y: V.y, z: V.z, reach: L.reach, strength: L.strength * s }); }
        }
        hg.instanceCount = n; hPos.needsUpdate = hAmt.needsUpdate = true;
        lampList = list; sig = list.map((l) => `${l.x.toFixed(1)},${l.z.toFixed(1)},${l.strength.toFixed(2)}`).join('|');
      }
      hMat.uniforms.hOn.value = on;
      halo.visible = frames < 6 || on > 0.001;                         // (drawn unseen at first, so its shader is built before the first dusk)
    },
  };
  return NL;
}
