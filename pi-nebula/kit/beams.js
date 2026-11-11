// BEAMS WITH DUST: a soft cone of light in the air under each spot light, and small motes of dust drifting slowly through
// it, lit only while they are inside the light. (The game's maker, 2026-11-09: "if there are point/spotlights Id hope
// there is a physical glowing disc nearby, and it would be super cool if it made a sunbeam like effect. Like lit up
// particles of dust that traveled through the area.")
//
//   const beams = makeBeams(list, o)   list: [{ at, dir, spread, length, color, strength, r }, ...]
//       at        where the light comes out (the middle of its disc), dir: the way it shines
//       r         the disc's radius (0.09), spread: the beam's half angle in radians (0.16)
//       length    how far the beam goes (to the deck, or to the table under it): it fades out before it gets there
//       color     [r, g, b] (white), strength (1)
//     o.motes     motes of dust for each beam (320), o.gain (the cones' brightness, 1), o.dust (the motes', 1)
//   beams.object            a group to add where the lights are (the cabin's own group: the list is in its frame)
//   beams.update(seconds)   once a frame (if it is never called the effect keeps its own time)
//   beams.set(on)           shown or not;  beams.dispose()
//   beams.stats             { beams, motes, draws: 2, triangles }
//   beamsOf(lights)         the list from a piece's or a built room's lights: each light that carries `beam`
//                           ({ r, spread, length, strength }: kit/shipparts/cabin/lights.js downlight)
//
// TWO DRAW CALLS however many beams: every cone in one mesh, every mote in one set of points. Both add their light to
// the picture, neither writes depth, and nothing is worked out per mote on the CPU: a mote's place is worked out from
// the time in the vertex shader.
//
// THE CONE is not a painted surface. Each pixel of it adds up the light in the air along the line of sight through the
// cone (eight samples between where the line enters the cone and where it leaves), so it looks right from outside, from
// inside looking up at the disc, and while walking through: there is no surface to cross. The light in the air is
// strongest on the beam's axis and fades to nothing at its edge and before its far end, so there is no hard line where
// it meets the deck. Only the back of the cone's hull is drawn, with the depth test on: what stands in front of the
// beam hides it. (What stands INSIDE the beam shows with no veil of light over it: its outline reads against the beam.)
import * as THREE from 'three';

const SIDES = 16, START = 0.03, END = 0.02;

export const beamsOf = (lights) => (lights || []).filter((l) => l.beam && l.dir).map((l) => ({
  at: l.at.map((v, k) => +(v - l.dir[k] * (l.beam.back ?? 0.05)).toFixed(4)), dir: l.dir.map((v) => +v.toFixed(4)), color: l.color || [1, 1, 1], ...l.beam,
}));

const DENSITY = /* glsl */`
  // how much lit air there is at a point: most on the axis, none at the cone's edge, none before the far end
  float lit(vec3 X, vec3 O, vec3 D, vec4 P) {
    vec3 w = X - O; float s = dot(w, D), R = P.x + max(s, 0.) * P.y;
    float rad = clamp(1. - (dot(w, w) - s * s) / (R * R), 0., 1.);
    return rad * rad * smoothstep(0., 0.14, s) * (1. - smoothstep(P.z * 0.62, P.z, s));
  }`;

const CONE_VERT = /* glsl */`
  attribute vec3 aO; attribute vec3 aD; attribute vec4 aPar; attribute vec3 aC;
  varying vec3 vP; varying vec3 vO; varying vec3 vD; varying vec4 vPar; varying vec3 vC;
  void main() { vP = position; vO = aO; vD = aD; vPar = aPar; vC = aC; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const CONE_FRAG = /* glsl */`
  uniform vec3 uEye; uniform float uGain;
  varying vec3 vP; varying vec3 vO; varying vec3 vD; varying vec4 vPar; varying vec3 vC;
  ${DENSITY}
  void main() {
    float r0 = vPar.x, k = vPar.y, L = vPar.z, s0 = r0 / k;
    vec3 rd = vP - uEye; float t1 = length(rd); rd /= t1;
    // where the line of sight enters the cone: through its ends' planes, or through its side (a quadratic), or at the eye
    vec3 co = uEye - (vO - vD * s0);
    float a = dot(rd, vD), b = dot(co, vD), m = 1. + k * k;
    float c2 = 1. - m * a * a, c1 = dot(co, rd) - m * a * b, c0 = dot(co, co) - m * b * b, t0 = 0.;
    if (abs(a) > 1e-5) t0 = max(t0, min((s0 - b) / a, (s0 + L - b) / a));
    float h = c1 * c1 - c2 * c0;
    if (h > 0. && abs(c2) > 1e-5) {
      float q = sqrt(h), lo = (-c1 - q) / c2, hi = (-c1 + q) / c2; if (lo > hi) { float x = lo; lo = hi; hi = x; }
      if (c2 > 0.) t0 = max(t0, lo); else if (a > 0.) t0 = max(t0, hi);
    }
    float len = max(0., t1 - t0), sum = 0.;
    // (each pixel starts its samples a different share of a step along: steps would show as bands otherwise)
    float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    for (int i = 0; i < 8; i++) {
      float tt = t0 + len * (float(i) + j) / 8.; vec3 X = uEye + rd * tt;
      // (the light thins as the beam widens: 0.7 m down it is half as strong in the air; and the air just before the
      // eye counts for less, so that stepping into a beam brings no sudden veil over the whole view)
      sum += lit(X, vO, vD, vPar) * 0.7 / (dot(X - vO, vD) + 0.7) * smoothstep(0.05, 0.9, tt);
    }
    gl_FragColor = vec4(vC * (sum * len / 8. * vPar.w * uGain), 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const MOTE_VERT = /* glsl */`
  attribute vec3 aD; attribute vec4 aPar; attribute vec3 aC; attribute vec4 aSeed;
  uniform float uTime; uniform float uScale; uniform float uGain;
  varying vec3 vCol;
  ${DENSITY}
  void main() {
    vec3 d = aD, u = normalize(abs(d.y) < 0.99 ? cross(d, vec3(0., 1., 0.)) : cross(d, vec3(1., 0., 0.))), v = cross(d, u);
    float L = aPar.z, Rm = (aPar.x + L * aPar.y) * 1.08;
    // where it is now: sinking a centimetre or two a second, drifting across more slowly, swaying a little. It goes
    // round: off the far end and back at the disc, off one side and back at the other, each where there is no light
    float s = fract(aSeed.x + uTime * (0.010 + 0.014 * aSeed.w) / L) * L;
    vec2 c = fract(aSeed.yz + uTime * 0.011 * (vec2(fract(aSeed.w * 7.3), fract(aSeed.w * 13.7)) - 0.5) / Rm) * 2. - 1.;
    c = c * Rm + 0.03 * vec2(sin(uTime * 0.23 + aSeed.x * 40.), sin(uTime * 0.19 + aSeed.y * 40.));
    vec3 X = position + d * s + u * c.x + v * c.y;
    vec4 mv = modelViewMatrix * vec4(X, 1.);
    float dist = -mv.z, px = (0.005 + 0.007 * fract(aSeed.x * 17.)) * uScale / max(dist, 0.05);
    // lit only inside the light; it glints as it turns; one right in front of the eye fades out instead of being a blur
    float lum = lit(X, position, d, aPar) * (0.5 + 0.5 * sin(uTime * (0.5 + aSeed.w * 1.2) + aSeed.z * 50.)) * aPar.w * smoothstep(0.25, 0.7, dist);
    if (px < 1.5) { lum *= px * px / 2.25; px = 1.5; }
    gl_PointSize = min(px, 7.);
    gl_Position = lum < 0.004 ? vec4(2., 2., 2., 1.) : projectionMatrix * mv;
    vCol = aC * lum * uGain;
  }`;

const MOTE_FRAG = /* glsl */`
  varying vec3 vCol;
  void main() {
    vec2 p = gl_PointCoord * 2. - 1.; float a = 1. - dot(p, p); if (a <= 0.) discard;
    gl_FragColor = vec4(vCol * a * a, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// a number from 0 to 1 that is the same every time for the same i (the motes are where they were last time)
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function makeBeams(list, o = {}) {
  const B = (list || []).map((b) => {
    const d = new THREE.Vector3(...(b.dir || [0, -1, 0])).normalize(), spread = b.spread ?? 0.16;
    return { at: new THREE.Vector3(...b.at), d, r: b.r ?? 0.09, k: Math.tan(spread), L: b.length ?? 2.3, color: b.color || [1, 1, 1], strength: b.strength ?? 1 };
  }).filter((b) => b.L > 0.3 && b.strength > 0);
  const perBeam = o.motes ?? 320, group = new THREE.Group(); group.name = 'beams';
  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true };

  // ── the cones: each one's hull (a little bigger than the cone itself), all in one mesh ──
  const pos = [], aO = [], aD = [], aP = [], aC = [], idx = [];
  const u = new THREE.Vector3(), v = new THREE.Vector3(), p = new THREE.Vector3(), grow = 1.03 / Math.cos(Math.PI / SIDES);
  for (const b of B) {
    u.crossVectors(b.d, Math.abs(b.d.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(); v.crossVectors(b.d, u);
    const base = pos.length / 3, sA = START, sB = b.L - END;
    const vert = (s, R, a) => { p.copy(b.at).addScaledVector(b.d, s).addScaledVector(u, R * Math.cos(a)).addScaledVector(v, R * Math.sin(a)); pos.push(p.x, p.y, p.z); aO.push(b.at.x, b.at.y, b.at.z); aD.push(b.d.x, b.d.y, b.d.z); aP.push(b.r, b.k, b.L, b.strength); aC.push(...b.color); };
    for (let i = 0; i < SIDES; i++) { const a = i / SIDES * Math.PI * 2; vert(sA, (b.r + sA * b.k) * grow, a); vert(sB, (b.r + sB * b.k) * grow, a); }
    vert(sA, 0, 0); vert(sB, 0, 0);
    const cA = base + SIDES * 2, cB = cA + 1;
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES, Ai = base + i * 2, Bi = Ai + 1, Aj = base + j * 2, Bj = Aj + 1;
      idx.push(Ai, Aj, Bi, Aj, Bj, Bi, cA, Aj, Ai, cB, Bi, Bj);   // (side, side, the end at the disc, the far end: all facing out)
    }
  }
  const eye = new THREE.Vector3(), inv = new THREE.Matrix4(), size = new THREE.Vector2();
  const coneMat = new THREE.ShaderMaterial({ ...additive, side: THREE.BackSide, vertexShader: CONE_VERT, fragmentShader: CONE_FRAG, uniforms: { uEye: { value: eye }, uGain: { value: 1.05 * (o.gain ?? 1) } } });
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setAttribute('aO', new THREE.Float32BufferAttribute(aO, 3)); cg.setAttribute('aD', new THREE.Float32BufferAttribute(aD, 3));
  cg.setAttribute('aPar', new THREE.Float32BufferAttribute(aP, 4)); cg.setAttribute('aC', new THREE.Float32BufferAttribute(aC, 3)); cg.setIndex(idx);
  const cones = new THREE.Mesh(cg, coneMat); cones.name = 'beams: cones'; cones.renderOrder = 20;
  // (the eye in the cones' own frame, whatever group they are put in; and the time, if nobody gives it)
  let own = true, time = 0;
  cones.onBeforeRender = (renderer, scene, camera) => { eye.copy(camera.position).applyMatrix4(inv.copy(cones.matrixWorld).invert()); };

  // ── the motes: every beam's, in one set of points ──
  const mO = [], mD = [], mP = [], mC = [], mS = [];
  B.forEach((b, bi) => { for (let i = 0; i < perBeam; i++) { const n = bi * 1000 + i * 4; mO.push(b.at.x, b.at.y, b.at.z); mD.push(b.d.x, b.d.y, b.d.z); mP.push(b.r, b.k, b.L, b.strength); mC.push(...b.color); mS.push(rnd(n), rnd(n + 1), rnd(n + 2), rnd(n + 3)); } });
  const moteMat = new THREE.ShaderMaterial({ ...additive, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uGain: { value: 2.2 * (o.dust ?? 1) } } });
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.Float32BufferAttribute(mO, 3)); mg.setAttribute('aD', new THREE.Float32BufferAttribute(mD, 3)); mg.setAttribute('aPar', new THREE.Float32BufferAttribute(mP, 4));
  mg.setAttribute('aC', new THREE.Float32BufferAttribute(mC, 3)); mg.setAttribute('aSeed', new THREE.Float32BufferAttribute(mS, 4));
  const motes = new THREE.Points(mg, moteMat); motes.name = 'beams: dust'; motes.frustumCulled = false; motes.renderOrder = 21;
  motes.onBeforeRender = (renderer, scene, camera) => {
    const rt = renderer.getRenderTarget(), hgt = rt ? rt.height : renderer.getDrawingBufferSize(size).y;
    moteMat.uniforms.uScale.value = hgt * 0.5 * camera.projectionMatrix.elements[5];
    moteMat.uniforms.uTime.value = own ? performance.now() / 1000 : time;
  };
  if (B.length) group.add(cones, motes);

  return {
    object: group, stats: { beams: B.length, motes: B.length * perBeam, draws: B.length ? 2 : 0, triangles: idx.length / 3 },
    update(seconds) { own = false; time = seconds; },
    set(on) { group.visible = !!on; },
    dispose() { cg.dispose(); mg.dispose(); coneMat.dispose(); moteMat.dispose(); },
  };
}
