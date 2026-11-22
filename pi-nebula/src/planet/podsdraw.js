// THE STASIS PODS, DRAWN ON A PLANET (where they lie: src/planet/pods.js; the pod, the game's maker's own model:
// kit/stasispod.js; who sleeps in each: src/sleeper.js). Each pod is his model as it is, lit as the planet's own things
// are (the sun and the sky's light from the ground's light picture where it lies, the haze: as src/planet/wreckship.js
// draws the wreck), lowered by the planet's curve where it lies as seen from the camera (the ground's own rule: d^2 /
// (2 CURVE)), with whoever sleeps in it riding in it. The lids swing open or shut together (open(k)). In the crashed
// crew's colours (his answer STAS1-3 C: "the pods and the uniforms both in the crashed crew's colours"): the wreck's
// (src/planet/wreck.js PAINTS), and each sleeper's uniform in their position's colour (the plan's, by the seed). Fetched
// only when a planet with a wreck is made: the pod's file, then (once the planet is up) the crew kit for the sleepers.
//
//   const pods = await makePods({ plan, scene, ground, sky, sunDir, paint })   plan: src/planet/pods.js podsPlan;
//                                                    ground, sky and sunDir: the planet's (its light picture, its haze,
//                                                    its sun: each pod's shadow); paint: the wreck's colours (a PAINTS
//                                                    id; none: his own); the pods are shown at once, shut, empty
//   pods.paint(id)                                   the pods in another of the colours (the wreck repainted)
//   await pods.fill(lib)                             someone asleep in each (lib: the crew kit's, loadCrew), in their
//                                                    position's colour, the far copies made ready; pods.filled
//   pods.open(k)                                     every lid on its way to open (1) or shut (0)
//   pods.openOne(i, k)                               one pod's lid on its way (its lock solved: src/podlock.js); the
//                                                    others as they were; pods.open(k) sets them all together again
//   pods.update(camera, dt)                          each frame: the curve, the lids, the sleepers near or far
//   pods.stats() -> { pods, draws, tris, sleepers }  (what is drawn: the pods and the sleepers shown)
//   pods.dispose()
import * as THREE from 'three';
import { SKY_GLSL } from './cloudSky.js';
import { HAZE_GLSL } from './ground.js';
import { HAZE_SKY_GLSL } from './cover.js';
import { PAINTS } from './wreck.js';
import { loadPod, podMaterials, podPaint, makePod } from '../../kit/stasispod.js';

// the sleepers: drawn with the crew kit's far copy beyond `far` metres from the camera, not drawn beyond `seen` (they are
// behind his tinted glass: from further than this they are hardly made out, and each costs about a millisecond a frame
// on a small graphics chip: STASIS_1.md)
export const PODS_DRAW = { far: 7, seen: 25 };

// THE PLANET'S LIGHT on a pod's material (as wreckship.js onGround does it for the wreck, the curve left to the pod's own
// place): how much of the sun and the sky reach the ground where it lies, and the haze between it and the camera
function onPlanet(mat, { ground, sky, kind }) {
  const U = ground.U, prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, { uL: U.uL, uP: U.uP, uN: U.uN, uHaze: U.uHaze, uHazeH: U.uHazeH, uHazeBase: U.uHazeBase });
    if (sky) Object.assign(sh.uniforms, sky.uniforms);
    sh.vertexShader = 'uniform sampler2D uL; uniform float uP, uN;\nvarying float vSun, vSky; varying vec3 vPlace;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec2 at = vec2(modelMatrix[3][0], modelMatrix[3][2]); vec4 ls = texture2D(uL, (at + 0.5 * uP) / uP + 0.5 / uN); vSun = ls.r; vSky = ls.g; }`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vPlace = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    let f = 'varying float vSun, vSky; varying vec3 vPlace;\n' + (sky ? SKY_GLSL + HAZE_GLSL : '') + sh.fragmentShader;
    f = f.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
      .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= vSun;')
      .replace(/irradiance \+= getHemisphereLightIrradiance/g, 'irradiance += vSky * getHemisphereLightIrradiance'));
    if (sky) f = f.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeSky(vPlace), hazeAmt(cameraPosition, vPlace));\n#include <tonemapping_fragment>').replace('void main() {', HAZE_SKY_GLSL + '\nvoid main() {');
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => prevKey() + '|planet-pod-' + kind + (sky ? '-air' : '');
  return mat;
}

// ITS SHADOW on the ground, as the wreck's (src/planet/wreckship.js shadowMaterial, its own copy here): the pod's base
// and its lid drawn once more, every point carried down the sun's rays to the ground and drawn dark just over it, each
// spot of the ground darkened once however many triangles fall on it (the stencil, the same mark as the wreck's, so where
// the two fall together it is darkened once). Without it a pod looks set on the ground rather than in it.
const SHADOW = { lift: 0.06 };
function shadowMaterial({ ground, sunDir, air }) {
  const U = ground.U, sun = sunDir.clone().normalize(); if (sun.y < 0.12) { sun.y = 0.12; sun.normalize(); }
  return new THREE.ShaderMaterial({
    uniforms: { uH: U.uH, uN: U.uN, uT: U.uT, uP: U.uP, uCam: U.uCam, uCurve: U.uCurve, uSun: { value: sun }, uAlpha: { value: air ? 0.5 : 0.7 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    vertexShader: /* glsl */`
      uniform highp sampler2D uH; uniform float uN, uT, uP, uCurve; uniform vec3 uCam, uSun;
      float hAt(vec2 w) {
        vec2 q = (w + 0.5 * uP) / uT, f = floor(q), t = q - f; ivec2 i = ivec2(f), m = ivec2(int(uN) - 1);
        float a = texelFetch(uH, i & m, 0).r, b = texelFetch(uH, (i + ivec2(1, 0)) & m, 0).r, c = texelFetch(uH, (i + ivec2(0, 1)) & m, 0).r, d = texelFetch(uH, (i + ivec2(1, 1)) & m, 0).r;
        return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
      }
      void main() {
        // (the pod's own place carries the curve already: taken off to find the ground under it, put back after)
        vec3 w = (modelMatrix * vec4(position, 1.0)).xyz; vec2 d0 = w.xz - uCam.xz; w.y += dot(d0, d0) * uCurve;
        float g = hAt(w.xz); vec3 p = w - uSun * max(0.0, w.y - g) / uSun.y;
        g = hAt(p.xz); p = w - uSun * max(0.0, w.y - g) / uSun.y; p.y = hAt(p.xz) + ${SHADOW.lift.toFixed(3)};
        vec2 d = p.xz - uCam.xz; p.y -= dot(d, d) * uCurve;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'uniform float uAlpha; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha); }',
  });
}

export async function makePods({ plan, scene, ground, sky = null, sunDir = null, paint = null }) {
  const t0 = performance.now(), P = await loadPod(), tLoad = performance.now();
  const mats = podMaterials(P, { patch: (m, kind) => onPlanet(m, { ground, sky, kind }), paint: PAINTS[paint] || null });
  const shadow = sunDir ? shadowMaterial({ ground, sunDir, air: !!sky }) : null;
  const group = new THREE.Group(); group.name = 'planet:pods'; scene.add(group);
  const pods = plan.pods.map((pp) => {
    const p = makePod(P, mats); p.plan = pp; p.place = new THREE.Matrix4().fromArray(pp.mat);
    p.group.matrixAutoUpdate = false; p.group.matrix.copy(p.place); p.group.matrixWorldNeedsUpdate = true;
    // (its shadow: its base's and its lid frame's own triangles once more, riding with each)
    if (shadow) for (const m of p.meshes()) if (/base|lidframe/.test(m.name)) { const s = new THREE.Mesh(m.geometry, shadow); s.name = m.name + ':shadow'; s.position.copy(m.position); s.frustumCulled = false; s.renderOrder = 1; m.parent.add(s); }
    group.add(p.group); return p;
  });
  let want = 0, filled = false, disposed = false;
  const api = {
    group, pods, facts: P.facts, times: { load: Math.round(tLoad - t0), made: Math.round(performance.now() - t0) },
    sleepersShown: true,     // (for the rigs: the sleepers left out, to measure them)
    paintId: PAINTS[paint] ? paint : null,
    get filled() { return filled; }, get want() { return want; },
    open(k) { want = k ? 1 : 0; for (const p of pods) p.want = null; },
    openOne(i, k) { if (pods[i]) pods[i].want = k ? 1 : 0; },
    paint(id) { api.paintId = PAINTS[id] ? id : null; podPaint(mats, PAINTS[id] || null); },
    // someone asleep in each pod, one after another (each pod's own look and position from the plan)
    async fill(lib) {
      const t = performance.now(), { makeSleeper, SLEEPERS } = await import('../sleeper.js');
      for (const p of pods) {
        if (disposed) return;
        p.sleeper = await makeSleeper(lib, SLEEPERS[p.plan.look % SLEEPERS.length], p, { far: true, position: p.plan.position });
        // (the crew kit's people are lit by the scene's lights as they are; the planet's sun and sky are among them)
        p.sleeper.root.visible = false;
      }
      filled = true; api.times.fill = Math.round(performance.now() - t);
    },
    update(camera, dt) {
      const k = ground.U.uCurve.value, cx = camera.position.x, cz = camera.position.z;
      for (const p of pods) {
        p.swing(p.want ?? want, dt);
        const e = p.place.elements, dx = e[12] - cx, dz = e[14] - cz, d2 = dx * dx + dz * dz;
        p.group.matrix.copy(p.place); p.group.matrix.elements[13] -= d2 * k; p.group.matrixWorldNeedsUpdate = true;
        if (p.sleeper) { const d = Math.sqrt(d2), on = api.sleepersShown && d < PODS_DRAW.seen; p.sleeper.root.visible = on; if (on) p.sleeper.setFar(d > PODS_DRAW.far); }
      }
    },
    stats() {
      let draws = 0, tris = 0, sleepers = 0;
      const sh = shadow ? 2 : 0, shTris = shadow ? P.facts.tris - P.facts.glassTris : 0;
      for (const p of pods) { draws += P.facts.draws + sh; tris += P.facts.tris + shTris; if (p.sleeper && p.sleeper.root.visible) { const c = p.sleeper.count(); draws += c.draws; tris += c.tris; sleepers++; } }
      return { pods: pods.length, draws, tris, sleepers };
    },
    dispose() { disposed = true; for (const p of pods) { if (p.sleeper) p.sleeper.dispose(); p.dispose(); } group.removeFromParent(); for (const m of Object.values(mats)) m.dispose(); if (shadow) shadow.dispose(); },
  };
  return api;
}
