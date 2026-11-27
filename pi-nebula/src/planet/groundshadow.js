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
//   S.update(camera)   each frame, after everything that casts has moved (src/planet/planet.js drawShadows)
//   S.U                the three pictures and their boxes for the ground's shader (SHADOW_READ_GLSL reads one)
//   S.wants(kind)      whether this level draws that kind at all;  S.nearReach() the near picture's half (0: no cover)
//   S.stats { near, site, people, siteHalf, nearDraws, siteDraws, siteDrawn, peopleDrawn, fill }
//
//   const P = makePeopleShadows({ ground })      the people: P.sync(people, hide) each frame (as before), P.stats(), P.dispose()
import * as THREE from 'three';
import { lookOff } from './kinds.js';

// THE THREE PICTURES, and what each quality level pays (the game's maker's standing rule: a costly feature is gated by
// the quality tier). NEAR: round the camera, a fixed width (so its pixels never change size and its edges never crawl),
// drawn every frame while someone is on foot (the camera within `foot` metres of the ground; none from the ship, however
// low): the people always; the rocks and plants (and on the best quality the near trees) only from medium up, and only
// those whose shadow can fall inside it (the cover hands it a short list: src/planet/cover.js). SITE: the big things (the
// wreck, the pods, the Medic set down), over the whole site at once, whatever the distance from the camera, drawn again
// whenever any of them has moved by any measure (its place, its height, its turn, a door leaf or a lid) and its box then
// set round where they really stand. PEOPLE: a person's shadow at any distance, as on main (round 3's review: they ended
// at the near picture's edge): the people alone over the site's box, coarser, one pass, drawn only while someone is out
// past the near picture's middle (or the near picture is off); the ground takes the near one's where it reaches.
// Per level: size (pixels across), half (metres), softened (two passes) or not.
//   low:    near 256, 10 m, not softened, the people only   (fill 65 k pixels a frame on foot)
//   medium: near 512, 16 m, softened, people, rocks, plants (fill 786 k pixels a frame on foot: three passes)
//   high:   near 1024, 24 m, softened, and the near trees    (fill 3.1 M pixels a frame on foot)
//   site:   512 on low, 1024 above, round the site's things plus `siteMargin` metres; only when something there moves
//   people: 256 on low, 512 above, over the site's box; only while someone is out beyond the near picture
// A SHAPE, NOT A STAIN (round 3's critics: the landed ship's shadow a smudge, hers a lump): each picture keeps what is
// covered (red) apart from how dark (green); the softening smooths the pixels' steps, and the ground then cuts the edge
// sharp again where the covered part crosses `edge`, so a shadow keeps its caster's outline, soft by a few centimetres.
// CONTACT: under a person's feet and along a big thing's foot, what is lower than `contact` metres over the ground is
// marked once more straight down (a soft dark patch under the shoes, a dark line where a pod meets the ground: the
// critics' "floating" shadow on a phone), `contactDark` as dark.
// soft: about how far a shadow's edge is spread (metres); sky: how much of the sky's light a shadow takes as well as the
// sun's (where the sun reaches; in the land's own shade a shadow takes nothing: there is no second shadow); shade: on a
// world with no air, how much of the shade's own faint light a shadow takes there (round 3's critics: her shadow gone on
// the moon's shaded ground, the pods and rocks there ghosts; main's shadow darkened it); dark: how
// dark each kind of caster's shadow is (a pebble's or a tuft's lighter than a ship's or a person's)
export const SHADOW_PIC = {
  near: { low: { size: 256, half: 10, soft: false, cover: false, trees: false }, medium: { size: 512, half: 16, soft: true, cover: true, trees: false }, high: { size: 1024, half: 24, soft: true, cover: true, trees: true } },
  site: { low: 512, medium: 1024, high: 1024 }, siteMargin: 60, siteMost: 150, people: { low: 256, medium: 512, high: 512 }, foot: 8,
  edge: [0.12, 0.62], contact: { big: 0.45, person: 0.3 }, contactDark: 0.6,
  soft: 0.05, sky: 0.5, shade: 0.75, dark: { big: 1, person: 1, rock: 0.5, plant: 0.45, tree: 0.6 },
};
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
#ifdef CONTACT
varying float vAbove;
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
  #ifdef CONTACT
  // (straight down: what is low over the ground marks the ground just under it)
  vAbove = w.y - hAt(w.xz); vec3 p = w;
  #else
  float g = hAt(w.xz); vec3 p = w - uSun * max(0.0, w.y - g) / uSun.y;
  g = hAt(p.xz); p = w - uSun * max(0.0, w.y - g) / uSun.y;
  #endif
  gl_Position = vec4((p.xz - uBox.xy) / uBox.z, 0.0, 1.0);
}`;
const CASTER_FRAG = /* glsl */`
#ifdef CUT
uniform sampler2D uMap; varying vec2 vUv;
#endif
#ifdef CONTACT
uniform float uContact; varying float vAbove;
#endif
uniform float uStrength;
void main() {
  #ifdef CUT
  if (texture2D(uMap, vUv).a < 0.5) discard;
  #endif
  #ifdef CONTACT
  if (vAbove > uContact) discard;
  #endif
  // (covered, how dark)
  gl_FragColor = vec4(1.0, uStrength, 0.0, 1.0);
}`;
// the softening: nine taps one way, then the other (both the covered and the how-dark)
const BLUR_FRAG = /* glsl */`
uniform sampler2D uSrc; uniform vec2 uStep; varying vec2 vUv;
void main() {
  vec2 s = texture2D(uSrc, vUv).rg * 0.2270270270;
  s += (texture2D(uSrc, vUv + uStep * 1.3846153846).rg + texture2D(uSrc, vUv - uStep * 1.3846153846).rg) * 0.3162162162;
  s += (texture2D(uSrc, vUv + uStep * 3.2307692308).rg + texture2D(uSrc, vUv - uStep * 3.2307692308).rg) * 0.0702702703;
  gl_FragColor = vec4(s, 0.0, 1.0);
}`;
// how the ground reads one picture (src/planet/ground.js): the covered part cut sharp at `edge`, times how dark
export const SHADOW_READ_GLSL = /* glsl */`
float shadowRead(sampler2D t, vec2 uv) {
  vec2 v = texture2D(t, uv).rg;
  return smoothstep(${SHADOW_PIC.edge[0].toFixed(2)}, ${SHADOW_PIC.edge[1].toFixed(2)}, v.r) * min(1.0, v.g / max(v.r, 0.004));
}`;

export function makeShadowPicture({ renderer, ground, sunDir, quality = 'medium' }) {
  const NQ = SHADOW_PIC.near[quality] || SHADOW_PIC.near.medium, GU = ground.U, sun = shadowSun(sunDir);
  const rtOpts = { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
  const cam = new THREE.Camera();
  // one picture: its own scene of twins, its box (x, z, half, on), its targets (one, or three when softened)
  function picture(N, soft) {
    const raw = new THREE.WebGLRenderTarget(N, N, rtOpts), half = soft ? new THREE.WebGLRenderTarget(N, N, rtOpts) : null, done = soft ? new THREE.WebGLRenderTarget(N, N, rtOpts) : raw;
    const scene = new THREE.Scene(); scene.matrixWorldAutoUpdate = false;
    return { N, soft, raw, half, done, scene, box: new THREE.Vector4(0, 0, 1, 0), mats: new Map(), casters: new Set(), draws: 0, stale: true };
  }
  const near = picture(NQ.size, NQ.soft), site = picture(SHADOW_PIC.site[quality] || 1024, true), people = picture(SHADOW_PIC.people[quality] || 512, false);
  const U = { uShadow: { value: near.done.texture }, uShadowBox: { value: near.box }, uShadowSite: { value: site.done.texture }, uShadowSiteBox: { value: site.box }, uShadowPeople: { value: people.done.texture }, uShadowPeopleBox: { value: people.box } };
  const matFor = (P, { curved = false, map = null, reach = 0, dark = 1, contact = 0 }) => {
    const key = (curved ? 'c' : '') + (map ? 'm' + map.uuid : '') + (reach ? 'r' + reach : '') + 'd' + dark + (contact ? 'k' + contact : '');
    let m = P.mats.get(key);
    if (!m) {
      const defines = {}; if (curved) defines.CURVED = 1; if (map) defines.CUT = 1; if (reach) defines.REACH = 1; if (contact) defines.CONTACT = 1;
      // (each spot keeps the most of what falls on it: one whole shape however many parts overlap)
      m = new THREE.ShaderMaterial({
        name: 'ground shadow picture', defines, side: THREE.DoubleSide, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        uniforms: { uH: GU.uH, uN: GU.uN, uT: GU.uT, uP: GU.uP, uCam: GU.uCam, uCurve: GU.uCurve, uSun: { value: sun }, uBox: { value: P.box }, uReach: { value: reach }, uMap: { value: map }, uStrength: { value: contact ? dark * SHADOW_PIC.contactDark : dark }, uContact: { value: contact } },
        vertexShader: CASTER_VERT, fragmentShader: CASTER_FRAG,
      });
      P.mats.set(key, m);
    }
    return m;
  };
  const blur = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { uSrc: { value: null }, uStep: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: BLUR_FRAG });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blur); quad.frustumCulled = false;
  const quadScene = new THREE.Scene(); quadScene.add(quad);

  const seen = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  function twinOf(o, mat) {
    let t;
    if (o.isSkinnedMesh) { t = new THREE.SkinnedMesh(o.geometry, mat); t.bind(o.skeleton, o.bindMatrix); t.bindMatrixInverse.identity(); }   // (drawn where its bones are: the picture's scene never moves it)
    else if (o.isInstancedMesh) { t = new THREE.InstancedMesh(o.geometry, mat, o.count); t.instanceMatrix = o.instanceMatrix; }
    else t = new THREE.Mesh(o.geometry, mat);
    t.matrixAutoUpdate = false; t.frustumCulled = false; t.name = o.name + ':shadow';
    return t;
  }
  const none = { count: 0, show() {}, dispose() {} };
  // kind: 'big' (the site picture), 'person' (the near one and the people's), 'rock', 'plant', 'tree' (the near one;
  // rocks, plants and trees only on a level that draws them)
  const wants = (kind) => (kind === 'rock' || kind === 'plant' ? NQ.cover : kind === 'tree' ? NQ.trees : true);
  function add(root, { kind = 'big', curved = false, map = null, reach = 0, test = null } = {}) {
    if (!wants(kind)) return none;
    const dark = SHADOW_PIC.dark[kind] ?? 1, contact = SHADOW_PIC.contact[kind] || 0;
    const Cs = (kind === 'big' ? [site] : kind === 'person' ? [near, people] : [near]).map((P) => {
      const C = { P, root, pairs: [], on: true, curved };
      root.traverse((o) => {
        if (!o.isMesh || !o.geometry || o.userData.groundShadow || (test && !test(o))) return;
        const twins = [twinOf(o, matFor(P, { curved, map, reach, dark }))];
        if (contact) twins.push(twinOf(o, matFor(P, { curved, map, reach, dark, contact })));
        for (const t of twins) P.scene.add(t);
        C.pairs.push({ from: o, twins, last: P === site ? new Float32Array(16) : null, was: false, ver: -1, n: -1 });
      });
      P.casters.add(C); P.stale = true;
      return C;
    });
    return {
      count: Cs[0].pairs.length,
      show(on) { for (const C of Cs) { if (C.on !== !!on) C.P.stale = true; C.on = !!on; } },
      dispose() { for (const C of Cs) { for (const p of C.pairs) for (const t of p.twins) t.removeFromParent(); C.P.casters.delete(C); C.P.stale = true; } },
    };
  }
  // each twin where its own is now, shown as it is. For the site: has anything moved since it was last drawn, by any
  // measure (every number of its place; a lid's or a door leaf's own places; shown or hidden)? Numbers compared, nothing
  // made: the curve's lowering, which follows the camera, taken back out of a curved thing's height first
  const MOVED = 0.002;
  function follow(P) {
    let draws = 0, moved = false;
    const cx = GU.uCam.value.x, cz = GU.uCam.value.z, curve = GU.uCurve.value;
    for (const C of P.casters) {
      const rootOn = C.on && seen(C.root);
      if (rootOn) C.root.updateMatrixWorld(true);
      for (const p of C.pairs) {
        const { from, twins } = p, on = rootOn && seen(from) && (!from.isInstancedMesh || from.count > 0);
        for (const t of twins) t.visible = on;
        if (p.last) {
          if (on !== p.was) { p.was = on; moved = true; }
          if (on && from.isInstancedMesh && (from.instanceMatrix.version !== p.ver || from.count !== p.n)) { p.ver = from.instanceMatrix.version; p.n = from.count; moved = true; }
        }
        if (!on) continue;
        for (const t of twins) {
          if (t.geometry !== from.geometry) { t.geometry = from.geometry; moved = true; }
          if (from.isInstancedMesh) t.count = from.count;
          if (!from.isSkinnedMesh) t.matrixWorld.copy(from.matrixWorld);
        }
        if (p.last) {
          const e = from.matrixWorld.elements, l = p.last, dx = e[12] - cx, dz = e[14] - cz, y = C.curved ? e[13] + (dx * dx + dz * dz) * curve : e[13];
          for (let i = 0; i < 16; i++) { const v = i === 13 ? y : e[i]; if (Math.abs(v - l[i]) > MOVED) { moved = true; l[i] = v; } }
        }
        draws++;
      }
    }
    P.draws = draws;
    return moved;
  }
  const clear = new THREE.Color();
  function draw(P) {
    const was = renderer.getRenderTarget(), ac = renderer.autoClear, ca = renderer.getClearAlpha(), tm = renderer.toneMapping;
    renderer.getClearColor(clear);
    renderer.autoClear = true; renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(P.raw); renderer.render(P.scene, cam);
    if (P.soft) {
      const px = (2 * P.box.z) / P.N, k = Math.max(0.6, Math.min(3, SHADOW_PIC.soft / px / 2.2)) / P.N;
      blur.uniforms.uSrc.value = P.raw.texture; blur.uniforms.uStep.value.set(k, 0); renderer.setRenderTarget(P.half); renderer.render(quadScene, cam);
      blur.uniforms.uSrc.value = P.half.texture; blur.uniforms.uStep.value.set(0, k); renderer.setRenderTarget(P.done); renderer.render(quadScene, cam);
    }
    renderer.setRenderTarget(was); renderer.autoClear = ac; renderer.setClearColor(clear, ca); renderer.toneMapping = tm;
  }
  const stats = { quality, near: NQ.size, nearHalf: NQ.half, site: site.N, siteHalf: 0, people: people.N, nearDraws: 0, siteDraws: 0, siteDrawn: 0, peopleDrawn: 0, fill: 0 };
  const _p = new THREE.Vector3(), _q = new THREE.Vector3();
  const off = lookOff('shadows');
  // the site's box: round where its things stand now (each shown piece's own place)
  function siteBox() {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const C of site.casters) for (const { from, was } of C.pairs) { if (!was) continue; const e = from.matrixWorld.elements; x0 = Math.min(x0, e[12]); x1 = Math.max(x1, e[12]); z0 = Math.min(z0, e[14]); z1 = Math.max(z1, e[14]); }
    if (x0 === Infinity) { site.box.w = 0; return false; }
    const h = Math.min(SHADOW_PIC.siteMost, Math.max(x1 - x0, z1 - z0) / 2 + SHADOW_PIC.siteMargin);
    site.box.set((x0 + x1) / 2, (z0 + z1) / 2, h, 1); stats.siteHalf = Math.round(h); return true;
  }
  // EACH FRAME, after everything that casts has moved (src/rescue.js late(): last of all; src/planet/planet.js otherwise)
  function update(camera) {
    stats.fill = 0;
    if (off) { near.box.w = 0; site.box.w = 0; people.box.w = 0; return; }
    // the site: drawn again whenever anything in it has moved
    if (site.casters.size) {
      const moved = follow(site);
      if (moved || site.stale) { site.stale = false; if (siteBox()) { draw(site); stats.siteDrawn++; stats.fill += site.N * site.N * 3; } }
      stats.siteDraws = site.draws;
    } else site.box.w = 0;
    // near the camera: a fixed width, its middle moved a whole pixel at a time; only while someone is on foot (the
    // camera near the ground)
    const up = GU.uCamUp ? GU.uCamUp.value : 0, nearOn = up <= SHADOW_PIC.foot && near.casters.size > 0;
    camera.getWorldPosition(_p);
    if (nearOn) {
      const px = (2 * NQ.half) / near.N;
      near.box.set(Math.round(_p.x / px) * px, Math.round(_p.z / px) * px, NQ.half, 1);
      follow(near); stats.nearDraws = near.draws;
      draw(near); stats.fill += near.N * near.N * (near.soft ? 3 : 1);
    } else { near.box.w = 0; stats.nearDraws = 0; }
    // the people at any distance: only while one of them is out past the near picture's middle
    let out = false;
    for (const C of people.casters) {
      if (!C.on || !seen(C.root)) continue;
      C.root.getWorldPosition(_q);
      if (!nearOn || Math.max(Math.abs(_q.x - near.box.x), Math.abs(_q.z - near.box.y)) > NQ.half * 0.6) { out = true; break; }
    }
    if (out) {
      if (site.box.w > 0) people.box.copy(site.box);
      else people.box.set(_p.x, _p.z, SHADOW_PIC.siteMargin * 1.5, 1);
      follow(people); draw(people); stats.peopleDrawn++; stats.fill += people.N * people.N;
    } else people.box.w = 0;
  }
  // how far from the camera the near picture reaches (the cover's short list of what casts into it; 0: none drawn)
  const nearReach = () => (NQ.cover ? NQ.half : 0);
  return {
    U, add, update, stats, sun, nearReach, wants, quality,
    dispose() { for (const P of [near, site, people]) { for (const C of [...P.casters]) for (const p of C.pairs) for (const t of p.twins) t.removeFromParent(); P.casters.clear(); for (const m of P.mats.values()) m.dispose(); P.raw.dispose(); if (P.half) P.half.dispose(); if (P.done !== P.raw) P.done.dispose(); } blur.dispose(); quad.geometry.dispose(); },
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
      let H = made.get(c); if (!H) { H = S.add(c.root, { kind: 'person', test: (o) => !SKIP.has(o.material && o.material.name) }); made.set(c, H); }
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
