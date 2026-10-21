// DEPTH OF FIELD for the close-up moments (a builder up at its site, the rod out on the dock, the cabin in first
// person): what the camera is looking at stays sharp and the land far behind it goes soft, as a camera's lens would.
// Gaming tier only, off unless asked for (?dof in the address, or BM.dev.dof(true)).
//
// How it is drawn, cheaply: while a moment is on, the valley is drawn once into a target of its own (multisampled, so
// the edges are as smooth as on screen, with its depth kept); a half-size copy is made with each pixel's blur
// (how far it is from the focus, past the sharp band round it), blurred across and then down at half size (a pixel
// only takes from neighbours that are blurred themselves, so a sharp tower never smears a halo into the sky behind
// it), and the full-size picture is laid over the screen with the blurred one mixed in by the full-size depth (sharp
// edges stay sharp). Tone mapping and the screen's colour space are applied in that last pass, as the screen would.
// No moment on (and the blur eased all the way out): nothing of this runs at all, the valley draws straight to the screen.
//
//   const D = makeDof({ renderer, camera, on })   on: start switched on (the switch: D.on)
//   D.frame(dt, want)   each frame before the valley is drawn; want: null (no close-up now) or { at: THREE.Vector3 (what
//                       to focus on) | dist (m), sharp (m each side of the focus kept sharp), ramp (m from sharp to the
//                       most blur) }. Returns true when this frame is drawn through the blur: then call D.begin(),
//                       draw the valley, and D.end() straight after its scene (before anything drawn over the screen)
//   D.state()           { on, amount, focus, sharp, ramp }
import * as THREE from 'three';

export const DOF = {
  ease: 1.1,       // s the blur takes to come in or go out (about the build sites' camera glide)
  follow: 6,       // how fast the focus follows its subject (1/s: a glide's moving camera keeps it in focus)
  maxBlur: 0.011,  // the most blur: its radius as a share of the screen's height (12 px at 1080 lines)
  nearShare: 0.5,  // the near side's sharp band and ramp, as a share of the far side's (things close in front blur sooner)
  taps: 6,         // taps each side of a pixel, in each of the two blur passes (13 a pass)
  samples: 4,      // the multisampling of the full-size target (the screen's own edge smoothing)
};

const VERT = `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// how blurred a pixel is (0..1) from its depth: past the sharp band each side of the focus, over the ramp
const COC = `uniform float cNear, cFar, focus, sharp, ramp, nearK, amount;
float viewDist(float d) { float z = d * 2.0 - 1.0; return 2.0 * cNear * cFar / (cFar + cNear - z * (cFar - cNear)); }
float cocOf(float d) {
  float z = viewDist(d);
  float far = clamp((z - focus - sharp) / ramp, 0.0, 1.0);
  float near = clamp((focus - sharp * nearK - z) / (ramp * nearK), 0.0, 1.0);
  return max(far, near) * amount;
}`;
// the half-size copy: a filtered tap of the picture (four pixels), its blur in alpha
const PREP = `uniform sampler2D tColor, tDepth; varying vec2 vUv; ${COC}
void main() { gl_FragColor = vec4(texture2D(tColor, vUv).rgb, cocOf(texture2D(tDepth, vUv).x)); }`;
// one blur pass, along dir: each tap as far out as this pixel's blur reaches, kept only as far as the tap is blurred
// itself (the sharp subject's pixels never spread into what is behind them)
const BLUR = `uniform sampler2D src; uniform vec2 dir; uniform float radius; varying vec2 vUv;
#define TAPS ${DOF.taps}
void main() {
  vec4 c0 = texture2D(src, vUv); float r = c0.a * radius;
  vec3 sum = c0.rgb; float wsum = 1.0;
  for (int i = 1; i <= TAPS; i++) {
    float t = float(i) / float(TAPS), g = exp(-2.5 * t * t);
    for (int s = -1; s <= 1; s += 2) {
      vec4 c = texture2D(src, vUv + dir * (float(s) * t * r));
      float w = g * smoothstep(0.0, 0.3, c.a);
      sum += c.rgb * w; wsum += w;
    }
  }
  gl_FragColor = vec4(sum / wsum, c0.a);
}`;
// onto the screen: the sharp picture, the blurred one mixed in by the full-size depth; the half-size taps are weighed
// by their own blur, so a sharp subject's texels don't creep past its edge into the soft background
const COMP = `uniform sampler2D tColor, tDepth, tBlur; uniform vec2 halfPx; varying vec2 vUv; ${COC}
void main() {
  vec4 sharpC = texture2D(tColor, vUv);
  float k = smoothstep(0.0, 0.35, cocOf(texture2D(tDepth, vUv).x));
  vec3 col = sharpC.rgb;
  if (k > 0.0) {
    vec2 p = vUv / halfPx - 0.5, f = fract(p), b = (floor(p) + 0.5) * halfPx;
    vec4 a = texture2D(tBlur, b), bb = texture2D(tBlur, b + vec2(halfPx.x, 0.0)), c = texture2D(tBlur, b + vec2(0.0, halfPx.y)), d = texture2D(tBlur, b + halfPx);
    vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y) * (vec4(a.a, bb.a, c.a, d.a) + 0.02);
    vec3 blur = (a.rgb * w.x + bb.rgb * w.y + c.rgb * w.z + d.rgb * w.w) / max(1e-5, w.x + w.y + w.z + w.w);
    col = mix(sharpC.rgb, blur, k);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeDof({ renderer, camera, on = false }) {
  const D = { on: !!on };
  let amount = 0, focus = 10, sharp = 4, ramp = 20, want = null, rt = null, rtA = null, rtB = null;
  const size = new THREE.Vector2(), _v = new THREE.Vector3();
  const common = () => ({ cNear: { value: 0.1 }, cFar: { value: 5000 }, focus: { value: 10 }, sharp: { value: 4 }, ramp: { value: 20 }, nearK: { value: DOF.nearShare }, amount: { value: 0 } });
  const U = common();   // (shared by the copy and the last pass: one set of focus uniforms)
  const mat = (frag, extra) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: extra, depthTest: false, depthWrite: false });
  const prep = mat(PREP, { ...U, tColor: { value: null }, tDepth: { value: null } });
  const blur = mat(BLUR, { src: { value: null }, dir: { value: new THREE.Vector2() }, radius: { value: 0 } });
  const comp = mat(COMP, { ...U, tColor: { value: null }, tDepth: { value: null }, tBlur: { value: null }, halfPx: { value: new THREE.Vector2() } });
  prep.toneMapped = false; blur.toneMapped = false;   // (the half-size pictures stay linear; only the last pass is the screen's)
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(geo, prep); quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad); const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function targets() {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, size.x), h = Math.max(1, size.y), hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
    if (rt && rt.width === w && rt.height === h) return;
    if (!rt) {
      const dt = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
      rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: DOF.samples, depthTexture: dt, depthBuffer: true });
      const half = () => new THREE.WebGLRenderTarget(hw, hh, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      rtA = half(); rtB = half();
    } else { rt.setSize(w, h); rtA.setSize(hw, hh); rtB.setSize(hw, hh); }
  }
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(qScene, qCam); };

  D.frame = (dt, w) => {
    want = D.on ? w : null;
    const goal = want ? 1 : 0;
    amount += Math.sign(goal - amount) * Math.min(Math.abs(goal - amount), dt / DOF.ease);
    if (want) {
      let dist = want.dist;
      if (want.at) { camera.updateMatrixWorld(); _v.copy(want.at).applyMatrix4(camera.matrixWorldInverse); dist = Math.max(0.2, -_v.z); }   // (along the view: the depth's own measure)
      const k = 1 - Math.exp(-dt * DOF.follow), first = amount <= dt / DOF.ease + 1e-6;
      focus = first ? dist : focus + (dist - focus) * k;
      sharp = first ? want.sharp : sharp + (want.sharp - sharp) * k;
      ramp = first ? want.ramp : ramp + (want.ramp - ramp) * k;
    }
    return amount > 0.001;
  };
  D.begin = () => { targets(); renderer.setRenderTarget(rt); };
  D.end = () => {
    const e = amount * amount * (3 - 2 * amount);
    U.cNear.value = camera.near; U.cFar.value = camera.far; U.focus.value = focus; U.sharp.value = sharp; U.ramp.value = Math.max(0.1, ramp); U.amount.value = e;
    prep.uniforms.tColor.value = comp.uniforms.tColor.value = rt.texture;
    prep.uniforms.tDepth.value = comp.uniforms.tDepth.value = rt.depthTexture;
    const was = renderer.autoClear; renderer.autoClear = false;
    pass(prep, rtA);
    const r = DOF.maxBlur * rtA.height;   // (in half-size pixels)
    blur.uniforms.radius.value = r;
    blur.uniforms.src.value = rtA.texture; blur.uniforms.dir.value.set(1 / rtA.width, 0); pass(blur, rtB);
    blur.uniforms.src.value = rtB.texture; blur.uniforms.dir.value.set(0, 1 / rtA.height); pass(blur, rtA);
    comp.uniforms.tBlur.value = rtA.texture; comp.uniforms.halfPx.value.set(1 / rtA.width, 1 / rtA.height);
    pass(comp, null);
    renderer.autoClear = was;
  };
  D.state = () => ({ on: D.on, amount: +amount.toFixed(3), focus: +focus.toFixed(2), sharp: +sharp.toFixed(2), ramp: +ramp.toFixed(2), drawing: amount > 0.001 });
  D.dispose = () => { for (const t of [rt, rtA, rtB]) if (t) { if (t.depthTexture) t.depthTexture.dispose(); t.dispose(); } rt = rtA = rtB = null; for (const m of [prep, blur, comp]) m.dispose(); geo.dispose(); };
  return D;
}
