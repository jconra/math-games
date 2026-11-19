// THE WORMHOLE, drawn: the jump's picture (src/wormplan.js is the plain part: what happens when). Used by a captain's
// run (src/trip.js), out to the rocks and home, and by the Flight Lab and the Drill Lab.
//
// THE GAME'S MAKER (2026-11-18): "Hopefully we can have some cool colorful plasma effect that looks like it rips open a
// wormhole in front of you and you see pretty colors until the destination scene is loaded and then appears in front
// of you." And of dark screens: "I defiantly don't want a dark screen with words", "I want as little of black screen,
// magically appear in the game as possible."
//
// HOW IT IS DONE, plainly:
//   - ONE BALL ROUND THE EYE, drawn from inside (80 triangles, one draw), with the colours worked out for each dot of
//     the screen from the way that dot looks out from the eye: a tunnel of slow coloured waves streaming by from ahead
//     to behind, bright threads along it, white light far ahead. No picture is loaded and no lamp is added.
//   - IT IS A REAL THING IN THE SCENE, so it is right from the cockpit and from behind alike: the ship is inside the
//     ball and is drawn in front of the colours; whatever is further off than the ball (the station, the sky) is
//     behind them.
//   - THE EDGE OF THE COLOURS is where the wormhole's mouth is, as the eye sees it, round the way the ship's nose
//     points: going in, the colours are inside the edge (a tear that opens to a round mouth and comes over the ship);
//     coming out, they are outside it (the far end opens ahead and the place there is seen through it).
//   - WHAT IS NEARER THAN THE BALL at the place ahead (the rocks of the field can be) is hidden by the same edge:
//     their own shaders ask `veiled()` (VEIL_GLSL, VEIL below) and leave out every dot the colours cover. So the place
//     ahead is seen only through the mouth, and nothing of it pops in.
//   - THE PLACE IS CHANGED WHILE THE COLOURS ARE ALL ROUND (onShut), and they go on until it is ready (ready()).
//   - EACH JUMP HAS ITS OWN COLOURS, swirl and slant (wormplan.js lookOf): three numbers handed to the one shader.
//   - CHEAP: a weak phone works a few sines for each dot of the screen for the three or four seconds a jump takes; at
//     the lowest quality one of the waves and the threads are left out (LOW).
//
//   const H = makeWormhole({ scene, quality, rand })
//   H.begin({ onShut, ready, onOpen, onDone })   a jump begins (the tear opens); H.arrive({ ... }) begins in the tunnel
//   H.update(dt)             each frame;  H.place(camera, M)   just before the picture: M, the ship's own frame in the
//                            world (x to port, y up, z to its nose), is which way "ahead" is
//   H.on, H.jump (the plain state), H.state(), H.dispose()
import * as THREE from 'three';
import { makeJump, stepJump, edgeOf } from './wormplan.js';

export const HOLE = { r: 70, flow: 1.9, gain: 1.0 };      // the ball's size (m), how fast the walls stream by, how bright

// THE EDGE, shared by the wormhole and by whatever must not be seen through its colours: one set of numbers
//   uVeilA, uVeilU, uVeilR   dead ahead, up and right (the world's frame)
//   uVeil    x: +1 the colours are inside the edge, -1 outside it, 0 no wormhole; y: how far round the edge is (half
//            turns); z: how wide the tear is beside its length; w: how ragged
//   uVeilK   x: the tear's slant; y: the clock; z: this jump's own number
export const VEIL = {
  uVeilA: { value: new THREE.Vector3(0, 0, 1) }, uVeilU: { value: new THREE.Vector3(0, 1, 0) }, uVeilR: { value: new THREE.Vector3(1, 0, 0) },
  uVeil: { value: new THREE.Vector4(0, 0, 1, 0) }, uVeilK: { value: new THREE.Vector3(0, 0, 0) },
};
export const VEIL_GLSL = `
uniform vec3 uVeilA; uniform vec3 uVeilU; uniform vec3 uVeilR; uniform vec4 uVeil; uniform vec3 uVeilK;
// how far inside the edge a way out from the eye is (+: inside), in half turns of the view
float veilEdge(vec3 d) {
  float rho = acos(clamp(dot(d, uVeilA), -1.0, 1.0)) / 3.14159265;
  float phi = atan(dot(d, uVeilU), dot(d, uVeilR) + 1e-6) - uVeilK.x, c = cos(phi), s = sin(phi);
  float shape = 1.0 / sqrt(c * c / (uVeil.z * uVeil.z) + s * s);
  float n = sin(phi * 3.0 + uVeilK.y * 2.3 + uVeilK.z) * 0.5 + sin(phi * 7.0 - uVeilK.y * 3.1 + uVeilK.z * 1.7) * 0.3 + sin(phi * 13.0 + uVeilK.y * 5.3) * 0.2;
  return uVeil.y * shape * (1.0 + uVeil.w * n) - rho;
}
// is this place covered by the wormhole's colours?
bool veiled(vec3 at) {
  if (uVeil.x == 0.0) return false;
  float e = veilEdge(normalize(at - cameraPosition));
  return uVeil.x > 0.0 ? e > 0.0 : e < 0.0;
}`;

const VERT = 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const FRAG = `
${VEIL_GLSL}
uniform float uHue; uniform float uSwirl; uniform float uFlow; uniform float uGain;
varying vec3 vW;
vec3 tint(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + uHue + vec3(0.0, 0.33, 0.67))); }
void main() {
  if (uVeil.x == 0.0) discard;
  vec3 d = normalize(vW - cameraPosition);
  float e = veilEdge(d), inside = uVeil.x > 0.0 ? e : -e;
  if (inside < 0.0) discard;
  float ca = clamp(dot(d, uVeilA), -1.0, 1.0), sa = sqrt(max(1.0 - ca * ca, 1e-5));
  float phi = atan(dot(d, uVeilU), dot(d, uVeilR) + 1e-6), t = uVeilK.y;
  // z: how far along the tunnel this bit of its wall is, ahead (+) or behind (-), in tunnel widths; the walls stream by
  float z = clamp(ca / sa, -14.0, 14.0), s = z * 0.6 + t * uFlow;
  float w = sin(phi * 2.0 + uSwirl * s * 0.9 + sin(s * 1.3 + t * 0.7) * 1.2) + 0.6 * sin(phi * 3.0 - uSwirl * s * 1.7 + t * 1.1) + 0.5 * sin(s * 2.1 + cos(phi * 2.0 + t * 0.5) * 1.5);
  #ifndef LOW
  w += 0.35 * sin(phi * 5.0 + s * 3.3 - t * 1.7 + sin(phi + s) * 2.0);
  #endif
  vec3 col = tint(w * 0.2 + z * 0.012) * (0.22 + 0.78 * smoothstep(-1.5, 1.5, w));
  #ifndef LOW
  col += tint(w * 0.2 + 0.18) * pow(abs(sin(phi * 4.0 + uSwirl * s * 0.6 + w * 1.4)), 16.0) * 1.3;      // bright threads along it
  #endif
  // far ahead the tunnel runs into light; behind, it dims
  float far = smoothstep(5.5, 14.0, z);
  col = mix(col, vec3(1.0, 0.96, 0.9) * 2.0, far * far);
  col *= 1.0 - 0.6 * smoothstep(-1.0, -9.0, z);
  // the edge of the mouth, white hot, in this jump's own colour just inside it
  float rim = exp(-inside * 170.0), halo = exp(-inside * 26.0);
  col += vec3(1.0, 0.95, 0.88) * rim * 3.2 + tint(0.1) * halo * 0.8;
  gl_FragColor = vec4(col * uGain, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeWormhole({ scene, quality = 'high', rand = Math.random } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...VEIL, uHue: { value: 0 }, uSwirl: { value: 1 }, uFlow: { value: HOLE.flow }, uGain: { value: HOLE.gain } },
    defines: quality === 'low' ? { LOW: '' } : {}, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, fog: false,
  });
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(HOLE.r, 1), mat);
  ball.name = 'the wormhole'; ball.frustumCulled = false; ball.visible = false; ball.matrixAutoUpdate = false; scene.add(ball);
  let J = null, on = null, clock = 0;
  const none = () => { VEIL.uVeil.value.set(0, 0, 1, 0); ball.visible = false; };
  function start(cb, tunnel) {
    J = makeJump(rand); on = cb || {}; clock = 0;
    if (tunnel) { J.phase = 'tunnel'; J.shut = true; }
    mat.uniforms.uHue.value = J.look.hue; mat.uniforms.uSwirl.value = J.look.swirl;
    ball.visible = true; edge();
  }
  function edge() {
    const e = edgeOf(J); VEIL.uVeil.value.set(e.mode, e.E, e.slit, e.jag); VEIL.uVeilK.value.set(J.look.slant, clock, J.look.seed);
    if (!e.mode) none();
  }
  const api = {
    get on() { return !!J && J.phase !== 'done'; }, get jump() { return J; }, ball, tris: ball.geometry.attributes.position.count / 3,
    // a jump: the tear opens in front of the ship. onShut(): the colours are all round, change the place now;
    // ready(): is the place ahead made?; onOpen(): the far end begins to open; onDone(): the colours are gone
    begin(cb) { start(cb, false); },
    // (only the far end: begun in the tunnel, the place already changed. The Drill Lab's new field arrives so)
    arrive(cb) { start(cb, true); },
    update(dt) {
      if (!J || J.phase === 'done') return;
      clock += dt;
      for (const ev of stepJump(J, dt, on.ready ? !!on.ready() : true)) {
        if (ev === 'shut' && on.onShut) on.onShut(); else if (ev === 'open' && on.onOpen) on.onOpen(); else if (ev === 'done' && on.onDone) on.onDone();
        if (!J) return;
      }
      edge();
    },
    // just before the picture: the ball round the eye; ahead is the way the ship's nose points
    place(camera, M) {
      if (!ball.visible) return;
      ball.matrix.makeTranslation(camera.position.x, camera.position.y, camera.position.z); ball.matrixWorldNeedsUpdate = true;
      if (M) { const e = M.elements; VEIL.uVeilR.value.set(-e[0], -e[1], -e[2]).normalize(); VEIL.uVeilU.value.set(e[4], e[5], e[6]).normalize(); VEIL.uVeilA.value.set(e[8], e[9], e[10]).normalize(); }
    },
    // (put away at once: a run given up in the middle of a jump)
    stop() { J = null; none(); },
    state: () => (J ? { phase: J.phase, t: +J.t.toFixed(2), clock: +J.clock.toFixed(2), shut: J.shut, edge: edgeOf(J), look: { ...J.look } } : null),
    dispose() { none(); scene.remove(ball); ball.geometry.dispose(); mat.dispose(); },
  };
  return api;
}
