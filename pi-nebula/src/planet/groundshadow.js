// THE SHADOW ON THE GROUND OF WHAT ELSE STANDS ON A PLANET: the Medic set down and the people out there (the crew
// member, the rescued, her paramedic). The game's maker, 2026-11-24, of the rescue's picture: "it seems like the pod and
// ship have shadows, but [not] the player". The wreck and the pods each draw their own (src/planet/wreckship.js,
// src/planet/podsdraw.js shadowMaterial: their triangles drawn once more, every point carried down the sun's rays to
// the ground and drawn dark just over it, each spot of the ground darkened once: the stencil). This is the same shadow,
// the same mark in the stencil (so where two fall together the ground is darkened once), for what they left out:
//   - a thing built by the kit (the Medic's hull, its legs, its ramps): every mesh of it that casts (the kit's own
//     castShadow), its door leaves too (one drawing for all of a kind, as they are drawn);
//   - a person of the crew kit: every mesh of theirs, bent by their own bones as they are drawn.
// Nothing of the kit's or the person's is changed: a shadow is one more drawing of the same triangles.
//
//   const mat = groundShadowMaterial({ ground, sunDir, air, curved, lift })   ground: src/planet/ground.js's (its
//       heights' picture, its curve); sunDir: toward the sun; air: the planet has a sky (a softer shadow, as the
//       wreck's); curved: the thing's own place already carries the planet's curve (the pods', the Medic's)
//   const H = shadowUnder(root, mat)       every casting mesh under root gets its shadow, riding on it
//       H.show(on), H.count, H.dispose()
//   const P = makePeopleShadows({ scene, ground, sunDir, air })
//       P.sync(people, hide)   each frame, just before the picture: people: the crew kit's (makeCrew's c), whoever is
//                              out there now (none of them, or no longer listed: their shadow is taken away); hide(p):
//                              a person standing there casts none (inside the Medic: its hull's shadow is theirs)
//       P.stats() { people, draws }, P.dispose()
import * as THREE from 'three';

// how far over the ground a shadow is drawn (metres: a thing's, as the pods'; a person's, lower: their feet are in it),
// and how dark (with a sky, without one: the wreck's own)
export const GROUND_SHADOW = { lift: 0.06, people: 0.03, air: 0.5, bare: 0.7 };

export function groundShadowMaterial({ ground, sunDir, air = false, curved = false, lift = GROUND_SHADOW.lift }) {
  const U = ground.U, sun = sunDir.clone().normalize(); if (sun.y < 0.12) { sun.y = 0.12; sun.normalize(); }
  return new THREE.ShaderMaterial({
    name: 'ground shadow',
    uniforms: { uH: U.uH, uN: U.uN, uT: U.uT, uP: U.uP, uCam: U.uCam, uCurve: U.uCurve, uSun: { value: sun }, uAlpha: { value: air ? GROUND_SHADOW.air : GROUND_SHADOW.bare } },
    defines: curved ? { CURVED: 1 } : {},
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    vertexShader: /* glsl */`
      uniform highp sampler2D uH; uniform float uN, uT, uP, uCurve; uniform vec3 uCam, uSun;
      #include <skinning_pars_vertex>
      float hAt(vec2 w) {
        vec2 q = (w + 0.5 * uP) / uT, f = floor(q), t = q - f; ivec2 i = ivec2(f), m = ivec2(int(uN) - 1);
        float a = texelFetch(uH, i & m, 0).r, b = texelFetch(uH, (i + ivec2(1, 0)) & m, 0).r, c = texelFetch(uH, (i + ivec2(0, 1)) & m, 0).r, d = texelFetch(uH, (i + ivec2(1, 1)) & m, 0).r;
        return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
      }
      void main() {
        // (where the point is drawn: a person's by their bones, a door leaf's by its own place among its kind)
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 lp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp;
        #endif
        vec3 w = (modelMatrix * lp).xyz;
        #ifdef CURVED
          // (its own place carries the curve already: taken off to find the ground under it, put back after)
          vec2 d0 = w.xz - uCam.xz; w.y += dot(d0, d0) * uCurve;
        #endif
        // (down the sun's rays to the ground: twice, the second time to the ground where the first one landed)
        float g = hAt(w.xz); vec3 p = w - uSun * max(0.0, w.y - g) / uSun.y;
        g = hAt(p.xz); p = w - uSun * max(0.0, w.y - g) / uSun.y; p.y = hAt(p.xz) + ${lift.toFixed(3)};
        vec2 d = p.xz - uCam.xz; p.y -= dot(d, d) * uCurve;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'uniform float uAlpha; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha); }',
  });
}

const twinOf = (o, mat) => {
  let t;
  if (o.isInstancedMesh) { t = new THREE.InstancedMesh(o.geometry, mat, o.count); t.instanceMatrix = o.instanceMatrix; }
  else t = new THREE.Mesh(o.geometry, mat);
  t.name = o.name + ':shadow'; t.frustumCulled = false; t.renderOrder = 1; t.castShadow = false; t.userData.groundShadow = true;
  return t;
};

// A KIT BUILD'S: each casting mesh's shadow rides on it (moved, hidden and shown with it)
export function shadowUnder(root, mat) {
  const from = []; root.traverse((o) => { if (o.isMesh && o.castShadow && !o.userData.groundShadow && !o.isSkinnedMesh) from.push(o); });
  const twins = from.map((o) => { const t = twinOf(o, mat); o.add(t); return t; });
  return {
    twins, count: twins.length,
    show(on) { for (const t of twins) t.visible = !!on; },
    dispose() { for (const t of twins) t.removeFromParent(); },   // (a door leaf's shadow shares its leaf's places: nothing of its own to let go)
  };
}

// THE PEOPLE'S: each of a person's meshes drawn once more by the same bones (a skinned mesh is drawn where its bones
// are, wherever it is itself kept: so the shadows are kept here, and the person is left as made)
const SKIP = new Set(['eye', 'cornea']);
const _at = new THREE.Vector3(), _inv = new THREE.Matrix4();
export function makePeopleShadows({ scene, ground, sunDir, air = false }) {
  const mat = groundShadowMaterial({ ground, sunDir, air, lift: GROUND_SHADOW.people });
  const holder = new THREE.Group(); holder.name = 'planet:people shadows'; scene.add(holder);
  const made = new Map();     // a person (the crew kit's c) -> [{ from, twin }]
  let draws = 0;
  function make(c) {
    const pairs = [];
    c.root.traverse((o) => {
      if (!o.isMesh || !o.geometry || SKIP.has(o.material && o.material.name)) return;
      let twin;
      if (o.isSkinnedMesh) { twin = new THREE.SkinnedMesh(o.geometry, mat); twin.bind(o.skeleton, o.bindMatrix); }
      else { twin = new THREE.Mesh(o.geometry, mat); twin.matrixAutoUpdate = false; }
      twin.name = o.name + ':shadow'; twin.frustumCulled = false; twin.renderOrder = 1; twin.userData.groundShadow = true;
      holder.add(twin); pairs.push({ from: o, twin });
    });
    return pairs;
  }
  const drop = (pairs) => { for (const { twin } of pairs) twin.removeFromParent(); };
  const seen = (o, top) => { for (; o && o !== top; o = o.parent) if (!o.visible) return false; return true; };
  function sync(people, hide = null) {
    const now = new Set(people.filter(Boolean));
    for (const [c, pairs] of made) if (!now.has(c)) { drop(pairs); made.delete(c); }
    draws = 0; let inv = false;
    for (const c of now) {
      let pairs = made.get(c); if (!pairs) { pairs = make(c); made.set(c, pairs); }
      const on = seen(c.root, null) && !(hide && hide(c.root.getWorldPosition(_at)));
      for (const { from, twin } of pairs) {
        twin.visible = on && seen(from, c.root);
        if (!twin.visible) continue;
        // (as the person is drawn now: the far copy's triangles while they wear it, a hair's own fitted points)
        if (twin.geometry !== from.geometry) twin.geometry = from.geometry;
        if (!twin.isSkinnedMesh) { if (!inv) { holder.updateWorldMatrix(true, false); _inv.copy(holder.matrixWorld).invert(); inv = true; } twin.matrix.multiplyMatrices(_inv, from.matrixWorld); twin.matrixWorldNeedsUpdate = true; }
        draws++;
      }
    }
  }
  return {
    holder, sync,
    stats: () => ({ people: made.size, draws }),
    dispose() { for (const pairs of made.values()) drop(pairs); made.clear(); holder.removeFromParent(); mat.dispose(); },
  };
}
