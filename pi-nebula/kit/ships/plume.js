// THE JET: adapted from the game's maker's own afterburner on jconra.com (jconra-site/src/objects/afterburner.js). The
// engines' models are always dark metal; the colour and the glow are this, an effect laid in each nozzle:
//   the plume   a tapered tube drawn additively, see-through (depthWrite off): a core inside a sheath, shock diamonds
//               as bright rings down the core that open out as the thrust rises, a flicker running down its length and
//               a slow throb; it lengthens and widens with the thrust, in proportion to its nozzle's radius
//   the disc    a glowing disc deep in each nozzle, for the view from straight behind (where the tube is edge-on)
// One thrust, 0 to 1, eased toward its target by update(dt). The colours follow the game's maker's throttle rule, not
// the portfolio's fixed orange and violet: off is NO plume and no disc (dark as the abyss); low, a dull orange core in a
// deeper orange-red sheath; then bright orange; then hot white-yellow; and at full afterburn a blue-white core in a
// blue-violet sheath.
//   makeJets(nozzles, { len }) -> { group, setThrust(t, now), update(dt), thrust, target, jets }
//     nozzles [{ at: [x, y, z] (where the jet starts: the nozzle's core), dir: [x, y, z] (the way it streams), r (the
//     nozzle's radius, metres), len (its length at full thrust, in radii; default opts.len) }]
//     jets[i].aim(at, dir) moves one (a swivelling thruster's), jets[i].on: its own on/off (a thruster firing or not)
// Cheap for a phone: 14 sides by 10 rings a plume, one draw each for the tube and the disc; additive, after the glass.
import * as THREE from 'three';

const VERT = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float len; uniform float time; uniform float thrust;
  varying float vT; varying vec3 vN; varying vec3 vView;
  void main() {
    // the tube's y runs 0 (the nozzle) to 1 (the tip); it tapers and wavers a little down its length
    vT = position.y;
    float radius = (1.0 - vT * 0.85) * (0.75 + 0.45 * thrust);
    vec2 xz = position.xz * radius;
    float waver = 0.05 * vT * sin(time * 9.0 + vT * 14.0) * (1.0 + thrust);
    vec3 p = vec3(xz.x + waver, vT * len * (0.25 + 0.75 * thrust), xz.y + waver * 0.6);
    vN = normalMatrix * vec3(position.x, 0.0, position.z);         // the tube's outward normal
    vec4 mv = modelViewMatrix * vec4(p, 1.0); vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;
const FRAG = `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float time; uniform float thrust; uniform float hot; uniform float gain; uniform vec3 coreColour; uniform vec3 outerColour;
  varying float vT; varying vec3 vN; varying vec3 vView;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(i), hash(i + 1.0), f); }
  void main() {
    #include <logdepthbuf_fragment>
    // "how far from the axis" as the eye sees it: the skin facing the eye is the plume's middle, the skin edge-on to the
    // eye its rim (the geometry's own radius is the rim everywhere)
    float facing = abs(dot(normalize(vN), normalize(-vView)));
    float t = vT, r = 1.0 - facing;
    // the core fades down the length, the sheath sooner at the rim
    float coreW = smoothstep(0.75, 0.15, r);
    float fadeLen = pow(1.0 - t, 1.3);
    // shock diamonds: bright rings down the core, their spacing opening with thrust, fading with distance
    float spacing = 0.09 + 0.09 * thrust;
    float diamonds = pow(0.5 + 0.5 * cos(t / spacing * 6.2831853), 6.0) * (1.0 - t) * coreW * smoothstep(0.2, 0.6, thrust);
    // flicker down the plume and a slow throb of the whole
    float flick = 0.85 + 0.3 * noise1(t * 18.0 - time * 26.0) + 0.1 * sin(time * 3.7);
    // (the white-hot middle only when it runs hot: at idle the core is its own dull colour)
    vec3 white = mix(coreColour, vec3(1.0, 0.98, 0.9), hot);
    vec3 core = mix(white, coreColour, smoothstep(0.0, 0.5, r + t * 0.4));
    vec3 col = mix(outerColour, core, coreW) * (0.55 + 0.45 * thrust);
    col += mix(coreColour, vec3(1.0, 0.92, 0.75), hot) * diamonds * 1.4;
    float alpha = (1.0 - r * r) * fadeLen * flick * (0.35 + 0.65 * thrust);
    gl_FragColor = vec4(col * alpha * gain, alpha);
  }`;
const CAP_VERT = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;
const CAP_FRAG = `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float time; uniform float thrust; uniform float hot; uniform float gain; uniform vec3 coreColour; uniform vec3 outerColour;
  varying vec2 vUv;
  void main() {
    #include <logdepthbuf_fragment>
    float r = length(vUv * 2.0 - 1.0);
    float pulse = 0.9 + 0.1 * sin(time * 23.0) + 0.05 * sin(time * 41.0);
    vec3 white = mix(coreColour, vec3(1.0, 0.98, 0.9), hot);
    vec3 col = mix(white, coreColour, smoothstep(0.0, 0.55, r)); col = mix(col, outerColour, smoothstep(0.55, 1.0, r));
    float alpha = (1.0 - smoothstep(0.6, 1.0, r)) * (0.25 + 0.75 * thrust) * pulse;
    gl_FragColor = vec4(col * alpha * gain, alpha);
  }`;

// THE COLOURS BY THRUST (linear): [thrust, core, sheath, hot (how white the middle runs)]. Off: nothing at all.
const RAMP = [
  [0.0, [0.25, 0.06, 0.01], [0.12, 0.02, 0.0], 0],
  [0.15, [0.9, 0.32, 0.06], [0.55, 0.1, 0.02], 0],        // idle: a dull orange core in a deep orange-red sheath
  [0.5, [1.6, 0.62, 0.12], [1.0, 0.26, 0.04], 0.25],      // half: bright orange
  [0.8, [2.0, 1.6, 0.8], [1.3, 0.62, 0.12], 0.85],        // full: hot white-yellow
  [0.92, [1.3, 1.4, 1.9], [0.7, 0.45, 1.3], 0.9],
  [1.0, [0.75, 1.15, 2.4], [0.38, 0.22, 1.6], 1],         // afterburn: a blue-white core in a blue-violet sheath
];
export function jetColours(t) {
  let i = 1; while (i < RAMP.length - 1 && RAMP[i][0] < t) i++;
  const [t0, c0, o0, h0] = RAMP[i - 1], [t1, c1, o1, h1] = RAMP[i], u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0 || 1)));
  const L = (a, b) => a.map((v, k) => v + (b[k] - v) * u);
  return { core: L(c0, c1), outer: L(o0, o1), hot: h0 + (h1 - h0) * u };
}

const TUBE = (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 14, 10, true); g.translate(0, 0.5, 0); return g; })();   // y 0..1
const DISC = new THREE.CircleGeometry(1, 20);
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);
export function makeJets(nozzles, { len = 5, gain = 1, capScale = 1.0 } = {}) {
  const uniforms = { len: { value: len }, time: { value: 0 }, thrust: { value: 0 }, hot: { value: 0 }, gain: { value: gain }, coreColour: { value: new THREE.Color() }, outerColour: { value: new THREE.Color() } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const capMat = new THREE.ShaderMaterial({ uniforms, vertexShader: CAP_VERT, fragmentShader: CAP_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  mat.name = capMat.name = 'jet';
  const group = new THREE.Group(); group.name = 'jets';
  const jets = nozzles.map((nz) => {
    const tube = new THREE.Mesh(TUBE, nz.len ? Object.assign(mat.clone(), { uniforms: { ...uniforms, len: { value: nz.len } } }) : mat);
    tube.scale.setScalar(nz.r); tube.frustumCulled = false; tube.renderOrder = 5; tube.name = 'jet';
    const cap = new THREE.Mesh(DISC, capMat); cap.scale.setScalar(nz.r * capScale); cap.frustumCulled = false; cap.renderOrder = 6; cap.name = 'jet disc';
    group.add(tube, cap);
    const J = { tube, cap, on: true, r: nz.r,
      // (the tube's +y along dir, from at; the disc facing along dir, a hair in front of the start)
      aim(at, dir) {
        const d = new THREE.Vector3(...(dir.toArray ? dir.toArray() : dir)).normalize(), p = new THREE.Vector3(...(at.toArray ? at.toArray() : at));
        tube.quaternion.copy(_q.setFromUnitVectors(_up, d)); tube.position.copy(p);
        cap.quaternion.copy(_q.setFromUnitVectors(_z, d)); cap.position.copy(p).addScaledVector(d, 0.01);
      } };
    J.aim(nz.at, nz.dir);
    return J;
  });
  const J = {
    group, jets, mat, capMat, uniforms, thrust: 0, target: 0,
    // the thrust asked for (now: at once, no easing)
    setThrust(t, now) { J.target = Math.max(0, Math.min(1, t)); if (now) { J.thrust = J.target; J.apply(); } },
    apply() {
      const t = J.thrust, c = jetColours(t);
      uniforms.thrust.value = t; uniforms.hot.value = c.hot; uniforms.coreColour.value.setRGB(...c.core); uniforms.outerColour.value.setRGB(...c.outer);
      for (const j of jets) { const vis = t > 0.01 && j.on; j.tube.visible = vis; j.cap.visible = vis; }
    },
    // eased toward the target (most of the way in about half a second), and the flicker's clock
    update(dt) { J.thrust += (J.target - J.thrust) * Math.min(1, dt * 4); if (Math.abs(J.target - J.thrust) < 1e-3) J.thrust = J.target; uniforms.time.value += dt; J.apply(); },
  };
  J.apply();
  return J;
}
