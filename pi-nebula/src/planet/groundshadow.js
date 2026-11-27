// THE SHADOWS ON THE GROUND of everything that stands on a planet: the Medic set down, the people out there (the crew
// member, the rescued, her paramedic), the crashed ship's pieces, the stasis pods, the rocks, the plants and the near
// trees. The game's maker, 2026-11-24, of the rescue's picture: "it seems like the pod and ship have shadows, but [not]
// the player". Two blind critics (2026-11-26) then found the shadows did not belong together: the wreck's and the pods'
// pure black with stepped edges, the player's drawn with lines and see-through layers inside it (and from above
// standing up like a second person), and the plants and rocks casting none at all.
//
// ONE KIND OF SHADOW FOR ALL OF IT, worked out as the land's own long shadows are: a picture of the ground round the
// camera, seen from straight above (THE SHADOW PICTURE). Each frame every thing that casts is drawn into it once more,
// every point of it carried down the sun's rays to the ground (the ground's own heights) and marked there; the picture
// is then softened (blurred a little, so every edge is soft and the same), and the ground's picture reads it: where it
// is marked, the sun's own light is taken away from the ground there, just as behind a hill (src/planet/ground.js). So
// a shadow is as dark as the land's own shade on that planet (very dark on the moon, his "long, nearly black shadows";
// lit by the sky elsewhere), one whole shape however many parts fall on the same spot, never on what casts it, and the
// player's lies on the ground from her feet. The picture covers more ground the higher the camera is (from the ship's
// seat the wreck's shadow still shows), and fades out at its edge.
//
//   const S = makeShadowPicture({ renderer, ground, sunDir, quality })   (made by src/planet/ground.js: ground.shadows)
//   S.add(root, { curved, map, reach, test })   every mesh under root (test(mesh) says which) casts; its shadow follows it
//       as it moves, shows and hides; curved: its own place carries the planet's curve already (the pods', the Medic's);
//       map: its leaves are cut out of a picture (the plants', the trees'); reach: shrinks away as the cover's do
//       -> { count, show(on), dispose() }
//   S.update(camera)   each frame, before the picture is drawn (src/planet/ground.js update)
//   S.U                { uShadow, uShadowBox } for the ground's shader;  S.stats { casters, draws, size, half }
//
//   const P = makePeopleShadows({ ground })      the people: P.sync(people, hide) each frame (as before), P.stats(), P.dispose()
import * as THREE from 'three';
import { lookOff } from './kinds.js';

// the picture: its size (pixels across) per quality tier; how much ground it covers (half its width, metres): `near`
// standing on the ground, more the higher the camera is (`per` metres for each metre up), at most `far`; the softening
// (metres: about how far the edge of a shadow is spread); and how much of the sky's light a shadow takes as well as the sun's
export const SHADOW_PIC = { size: { low: 512, medium: 1024, high: 1024 }, near: 30, per: 1.6, far: 220, soft: 0.12, sky: 0.5 };
// (kept for the station's own marks: the stencil the ground and what casts once used, src/planet/ground.js)
export const GROUND_SHADOW = { lift: 0.06, people: 0.03, air: 0.5, bare: 0.7 };
const mark = (mat, ref) => { mat.stencilWrite = true; mat.stencilRef = ref; mat.stencilFunc = THREE.AlwaysStencilFunc; mat.stencilZPass = THREE.ReplaceStencilOp; mat.stencilFail = THREE.KeepStencilOp; mat.stencilZFail = THREE.KeepStencilOp; return mat; };
export const takesShadows = (mat) => mark(mat, 0);
export const castsShadow = (mat) => mark(mat, 1);

// the sun as the shadows use it (never lower than about 7 degrees: past that a shadow would reach for kilometres)
export function shadowSun(sunDir) { const s = sunDir.clone().normalize(); if (s.y < 0.12) { s.y = 0.12; s.normalize(); } return s; }

// where a point of a thing lands on the ground, down the sun's rays (plain numbers, the same as the shader: the tests)
export function castPoint(heightAt, sun, [x, y, z]) {
  let g = heightAt(x, z), px = x - sun[0] * Math.max(0, y - g) / sun[1], pz = z - sun[2] * Math.max(0, y - g) / sun[1];
  g = heightAt(px, pz); px = x - sun[0] * Math.max(0, y - g) / sun[1]; pz = z - sun[2] * Math.max(0, y - g) / sun[1];
  return [px, heightAt(px, pz), pz];
}

const CASTER_VERT = /* glsl */`
uniform highp sampler2D uH; uniform float uN, uT, uP, uCurve, uReach; uniform vec3 uCam, uSun; uniform vec4 uBox;
#include <skinning_pars_vertex>
#ifdef CUT
varying vec2 vUv;
#endif
float hAt(vec2 w) {
  vec2 q = (w + 0.5 * uP) / uT, f = floor(q), t = q - f; ivec2 i = ivec2(f), m = ivec2(int(uN) - 1);
  float a = texelFetch(uH, i & m, 0).r, b = texelFetch(uH, (i + ivec2(1, 0)) & m, 0).r, c = texelFetch(uH, (i + ivec2(0, 1)) & m, 0).r, d = texelFetch(uH, (i + ivec2(1, 1)) & m, 0).r;
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #ifdef CUT
  vUv = uv;
  #endif
  vec4 lp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    #ifdef REACH
    { vec2 dc = vec2(instanceMatrix[3][0], instanceMatrix[3][2]) - uCam.xz; lp.xyz *= 1.0 - smoothstep(uReach * 0.78, uReach, length(dc)); }
    #endif
    lp = instanceMatrix * lp;
  #endif
  vec3 w = (modelMatrix * lp).xyz;
  #ifdef CURVED
    vec2 d0 = w.xz - uCam.xz; w.y += dot(d0, d0) * uCurve;
  #endif
  float g = hAt(w.xz); vec3 p = w - uSun * max(0.0, w.y - g) / uSun.y;
  g = hAt(p.xz); p = w - uSun * max(0.0, w.y - g) / uSun.y;
  gl_Position = vec4((p.xz - uBox.xy) / uBox.z, 0.0, 1.0);
}`;
const CASTER_FRAG = /* glsl */`
#ifdef CUT
uniform sampler2D uMap; varying vec2 vUv;
#endif
void main() {
  #ifdef CUT
  if (texture2D(uMap, vUv).a < 0.5) discard;
  #endif
  gl_FragColor = vec4(1.0);
}`;
// the softening: nine taps one way, then the other
const BLUR_FRAG = /* glsl */`
uniform sampler2D uSrc; uniform vec2 uStep; varying vec2 vUv;
void main() {
  float s = texture2D(uSrc, vUv).r * 0.2270270270;
  s += (texture2D(uSrc, vUv + uStep * 1.3846153846).r + texture2D(uSrc, vUv - uStep * 1.3846153846).r) * 0.3162162162;
  s += (texture2D(uSrc, vUv + uStep * 3.2307692308).r + texture2D(uSrc, vUv - uStep * 3.2307692308).r) * 0.0702702703;
  gl_FragColor = vec4(s, s, s, 1.0);
}`;

export function makeShadowPicture({ renderer, ground, sunDir, quality = 'medium' }) {
  const N = SHADOW_PIC.size[quality] || SHADOW_PIC.size.medium, GU = ground.U, sun = shadowSun(sunDir);
  const rtOpts = { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
  const raw = new THREE.WebGLRenderTarget(N, N, rtOpts), half = new THREE.WebGLRenderTarget(N, N, rtOpts), done = new THREE.WebGLRenderTarget(N, N, rtOpts);
  const box = new THREE.Vector4(0, 0, SHADOW_PIC.near, 0);
  const U = { uShadow: { value: done.texture }, uShadowBox: { value: box } };
  const scene = new THREE.Scene(), cam = new THREE.Camera();
  scene.matrixWorldAutoUpdate = false;
  const mats = new Map();
  const matFor = ({ curved = false, map = null, reach = 0 }) => {
    const key = (curved ? 'c' : '') + (map ? 'm' + map.uuid : '') + (reach ? 'r' + reach : '');
    let m = mats.get(key);
    if (!m) {
      const defines = {}; if (curved) defines.CURVED = 1; if (map) defines.CUT = 1; if (reach) defines.REACH = 1;
      m = new THREE.ShaderMaterial({
        name: 'ground shadow picture', defines, side: THREE.DoubleSide, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
        uniforms: { uH: GU.uH, uN: GU.uN, uT: GU.uT, uP: GU.uP, uCam: GU.uCam, uCurve: GU.uCurve, uSun: { value: sun }, uBox: { value: box }, uReach: { value: reach }, uMap: { value: map } },
        vertexShader: CASTER_VERT, fragmentShader: CASTER_FRAG,
      });
      mats.set(key, m);
    }
    return m;
  };
  const quadMat = (src, step) => new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { uSrc: { value: src }, uStep: { value: step } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: BLUR_FRAG });
  const blurH = quadMat(raw.texture, new THREE.Vector2(1 / N, 0)), blurV = quadMat(half.texture, new THREE.Vector2(0, 1 / N));
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurH); quad.frustumCulled = false;
  const quadScene = new THREE.Scene(); quadScene.add(quad);

  // the casters: a twin of each mesh in the picture's own scene, sharing its triangles, put where it is each frame
  const casters = new Set();
  const seen = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  function twinOf(o, mat) {
    let t;
    if (o.isSkinnedMesh) { t = new THREE.SkinnedMesh(o.geometry, mat); t.bind(o.skeleton, o.bindMatrix); t.bindMatrixInverse.identity(); }   // (drawn where its bones are: the picture's scene never moves it)
    else if (o.isInstancedMesh) { t = new THREE.InstancedMesh(o.geometry, mat, o.count); t.instanceMatrix = o.instanceMatrix; }
    else t = new THREE.Mesh(o.geometry, mat);
    t.matrixAutoUpdate = false; t.frustumCulled = false; t.name = o.name + ':shadow';
    return t;
  }
  function add(root, { curved = false, map = null, reach = 0, test = null } = {}) {
    const pairs = [], mat = matFor({ curved, map, reach });
    root.traverse((o) => { if (o.isMesh && o.geometry && !o.userData.groundShadow && (!test || test(o))) { const t = twinOf(o, o.userData.shadowMap ? matFor({ curved, map: o.userData.shadowMap, reach }) : mat); scene.add(t); pairs.push({ from: o, twin: t }); } });
    const C = { root, pairs, on: true };
    casters.add(C);
    return { count: pairs.length, show(on) { C.on = !!on; }, dispose() { for (const p of pairs) p.twin.removeFromParent(); casters.delete(C); } };
  }
  const stats = { casters: 0, draws: 0, size: N, half: 0 };
  const _p = new THREE.Vector3();
  const off = lookOff('shadows');
  function update(camera) {
    if (off) { box.w = 0; return; }
    // where the picture is: round the camera's foot, wider the higher it is; its middle moved a whole pixel at a time
    const up = Math.max(0, GU.uCamUp ? GU.uCamUp.value : 0);
    const h = Math.min(SHADOW_PIC.far, SHADOW_PIC.near + up * SHADOW_PIC.per), px = (2 * h) / N;
    camera.getWorldPosition(_p);
    box.set(Math.round(_p.x / px) * px, Math.round(_p.z / px) * px, h, 1);
    stats.half = +h.toFixed(1);
    // each twin where its own is now, shown as it is
    let draws = 0, n = 0;
    for (const C of casters) {
      const rootOn = C.on && seen(C.root);
      if (rootOn) { C.root.updateMatrixWorld(true); n++; }
      for (const { from, twin } of C.pairs) {
        twin.visible = rootOn && seen(from) && (!from.isInstancedMesh || from.count > 0);
        if (!twin.visible) continue;
        if (twin.geometry !== from.geometry) twin.geometry = from.geometry;
        if (from.isInstancedMesh) twin.count = from.count;
        if (!from.isSkinnedMesh) twin.matrixWorld.copy(from.matrixWorld);
        draws++;
      }
    }
    stats.casters = n; stats.draws = draws;
    // the picture: marked, then softened (how many pixels the softening spreads, by how much ground a pixel is)
    const was = renderer.getRenderTarget(), ac = renderer.autoClear, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(), tm = renderer.toneMapping;
    renderer.autoClear = true; renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(raw); renderer.render(scene, cam);
    const k = Math.max(0.6, Math.min(4, SHADOW_PIC.soft / px / 2.2));
    blurH.uniforms.uStep.value.set(k / N, 0); blurV.uniforms.uStep.value.set(0, k / N);
    quad.material = blurH; renderer.setRenderTarget(half); renderer.render(quadScene, cam);
    quad.material = blurV; renderer.setRenderTarget(done); renderer.render(quadScene, cam);
    renderer.setRenderTarget(was); renderer.autoClear = ac; renderer.setClearColor(cc, ca); renderer.toneMapping = tm;
  }
  return {
    U, add, update, stats, sun,
    dispose() { for (const C of [...casters]) for (const p of C.pairs) p.twin.removeFromParent(); casters.clear(); for (const m of mats.values()) m.dispose(); blurH.dispose(); blurV.dispose(); quad.geometry.dispose(); raw.dispose(); half.dispose(); done.dispose(); },
  };
}

// THE PEOPLE'S: whoever is out there now casts (none of them, or no longer listed: their shadow is taken away); hide(p):
// a person standing there casts none (inside the Medic: its hull's shadow is theirs)
const SKIP = new Set(['eye', 'cornea']);
const _at = new THREE.Vector3();
export function makePeopleShadows({ ground }) {
  const S = ground.shadows, made = new Map();
  let draws = 0;
  function sync(people, hide = null) {
    if (!S) return;
    const now = new Set(people.filter(Boolean));
    for (const [c, H] of made) if (!now.has(c)) { H.dispose(); made.delete(c); }
    draws = 0;
    for (const c of now) {
      let H = made.get(c); if (!H) { H = S.add(c.root, { test: (o) => !SKIP.has(o.material && o.material.name) }); made.set(c, H); }
      const on = !(hide && hide(c.root.getWorldPosition(_at)));
      H.show(on); if (on) draws += H.count;
    }
  }
  return {
    sync,
    stats: () => ({ people: made.size, draws }),
    dispose() { for (const H of made.values()) H.dispose(); made.clear(); },
  };
}
