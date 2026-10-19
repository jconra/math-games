// THE LAKE: sky, a lake in a bowl of low hills, reeds and cattails along its shallows, lily pads, a wooden dock running
// out from the near shore, trees round the far shores (the game's own) with darker forest behind, the game's cabin on
// the left bank, and the far hills in the haze. The water is a shader: the sky reflected (more at a low angle), the sun
// glinting, small waves always moving, rings spreading where the bobber lands or a fish splashes, see-through enough
// to show a fish just under it and green-brown in the shallows. Metres, y up, the water at y = 0; the angler stands at
// the end of the dock near the origin, facing -Z (out over the lake).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { boardTexture, softDot, rng } from '../windmill/wood.js';

const GAME = new URL('../../', import.meta.url).href;            // the game's folder (read only: models, textures)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export const DECK = 0.9;                       // the dock's top, above the water
export const DOCK_LEN = 14;                    // from the end (z = 0) back to the shore
export const ANGLER = new THREE.Vector3(0.25, DECK, 0.75);
export const STRINGER = new THREE.Vector3(1.86, DECK + 0.42, -0.02);   // the top of the corner post the kept fish hang from
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// the lake's shape: about how far (m) a spot is from the shore, less than 0 out on the water. The same sum is in the
// water shader (LAKE_GLSL), so the shallows tint follows the real shore.
export const LAKE = { cx: 18, cz: -40, rx: 34, rz: 56 };
export function lakeSDF(x, z) {
  const dx = (x - LAKE.cx) / LAKE.rx, dz = (z - LAKE.cz) / LAKE.rz, a = Math.atan2(dz, dx);
  const wob = 1 + 0.06 * Math.sin(a * 3 + 1.3) + 0.035 * Math.sin(a * 7 + 0.4);
  return (Math.hypot(dx, dz) / wob - 1) * 38;
}
const LAKE_GLSL = `float lakeSDF(vec2 p) { vec2 d = (p - vec2(${LAKE.cx.toFixed(1)}, ${LAKE.cz.toFixed(1)})) / vec2(${LAKE.rx.toFixed(1)}, ${LAKE.rz.toFixed(1)});
  float a = atan(d.y, d.x); float wob = 1.0 + 0.06 * sin(a * 3.0 + 1.3) + 0.035 * sin(a * 7.0 + 0.4); return (length(d) / wob - 1.0) * 38.0; }`;
// the ground's height: the lake bed sloping down from the shore, a low bank, then rolling hills further off
export function groundY(x, z) {
  const s = lakeSDF(x, z);
  if (s < 0) return Math.max(-4.5, 0.1 + s * 0.42);
  const hills = (Math.sin(x * 0.045 + 1) * Math.cos(z * 0.05) + Math.sin(x * 0.021 - z * 0.017)) * 2.4 * smooth(8, 60, s);
  return 0.1 + s * 0.07 + smooth(0, 40, s) * s * 0.06 + hills;
}
// open water the bobber can land in (clear of the reeds along the edge)
export const isWater = (x, z) => lakeSDF(x, z) < -2.5;

// the wind every swaying thing reads (reeds), and their shared clock
const swayU = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.35, 0.1) } };
// make a material sway: a push growing with height above the model's foot (h1: its height in its own units)
function swayable(mat, h1, amount) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = swayU.uTime; sh.uniforms.uWind = swayU.uWind;
    sh.vertexShader = 'uniform float uTime; uniform vec2 uWind;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelMatrix * mvPosition;
      float hN = clamp(position.y / ${h1.toFixed(3)}, 0.0, 1.0), bend = hN * hN;
      float beat = 0.6 + 0.4 * sin(uTime * 1.3 + mvPosition.x * 0.7 + mvPosition.z * 0.5) + 0.15 * sin(uTime * 3.1 + mvPosition.z * 1.7);
      mvPosition.xz += uWind * bend * beat * ${amount.toFixed(3)};
      mvPosition = viewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'lake-sway-' + h1 + '-' + amount;
  return mat;
}

export function makeLake({ low = false } = {}) {
  const scene = new THREE.Scene();
  const FOG = new THREE.Color(0xcfc9b2);
  scene.fog = new THREE.Fog(FOG, 90, 620);

  // ── sky: deep blue overhead to a warm hazy horizon, a glow round the low afternoon sun ─────────────────────────────
  const sunDir = new THREE.Vector3(-0.42, 0.42, -0.8).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vDir; uniform vec3 uSun;
      void main(){ float h = clamp(vDir.y, -0.2, 1.0);
        vec3 top = vec3(0.25, 0.46, 0.74), mid = vec3(0.58, 0.72, 0.86), low = vec3(0.93, 0.85, 0.7);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.2, h)); c = mix(c, top, smoothstep(0.2, 0.75, h));
        float s = max(dot(normalize(vDir), uSun), 0.0); c += vec3(1.0, 0.85, 0.6) * (pow(s, 64.0) * 0.8 + pow(s, 6.0) * 0.14);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  const cloudTex = softDot(128), cr = rng(5);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xfff8ec, transparent: true, opacity: 0.5 + cr() * 0.3, depthWrite: false, fog: false }));
    const a = -Math.PI / 2 + (cr() - 0.5) * 3.4, r = 380 + cr() * 250; m.position.set(Math.cos(a) * r, 80 + cr() * 110, Math.sin(a) * r);
    m.scale.set(140 + cr() * 160, 28 + cr() * 30, 1); scene.add(m);
  }

  // ── light: the sky's fill, and the sun with shadows round the dock ─────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xd2e2f2, 0x6a5a3a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.1);
  sun.position.set(0, 0, 3).addScaledVector(sunDir, 40); sun.target.position.set(0, 0, 3); sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 5; sc.far = 90;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ── the ground: a grid fine round the lake and coarse far off, grass blending to mud at the water ──────────────────
  const tl = new THREE.TextureLoader();
  const tex = (f, rep) => { const t = tl.load(GAME + 'textures/ground/' + f); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  const grassTex = tex('grassMed.jpg'), dirtTex = tex('dirt.jpg');
  const N = low ? 180 : 250, OX = 8, OZ = -22, SPAN = 460;
  const at = (u) => SPAN * (0.32 * u + 0.68 * u * u * u);      // u -1..1 -> metres: dense in the middle
  const gp = new Float32Array((N + 1) * (N + 1) * 3), guv = new Float32Array((N + 1) * (N + 1) * 2), gi = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * (N + 1) + i, x = OX + at(i / N * 2 - 1), z = OZ + at(j / N * 2 - 1);
    gp[k * 3] = x; gp[k * 3 + 1] = groundY(x, z); gp[k * 3 + 2] = z; guv[k * 2] = x / 7; guv[k * 2 + 1] = z / 7;
    if (i < N && j < N) gi.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2);
  }
  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3)); groundGeo.setAttribute('uv', new THREE.BufferAttribute(guv, 2)); groundGeo.setIndex(gi);
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshLambertMaterial({ map: grassTex, color: 0xe6e8c8 });
  groundMat.onBeforeCompile = (sh) => {
    sh.uniforms.uDirt = { value: dirtTex };
    sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = 'varying float vWY; uniform sampler2D uDirt;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec4 gC = texture2D(map, vMapUv), dC = texture2D(uDirt, vMapUv * 0.7) * vec4(0.86, 0.8, 0.7, 1.0);
      float wet = smoothstep(0.75, 0.12, vWY);
      vec4 cC = mix(gC, dC, wet);
      cC.rgb = mix(cC.rgb, vec3(0.2, 0.22, 0.15), smoothstep(0.05, -2.8, vWY) * 0.8);
      diffuseColor *= cC;`);
  };
  groundMat.customProgramCacheKey = () => 'lake-ground';
  const ground = new THREE.Mesh(groundGeo, groundMat); ground.receiveShadow = true; scene.add(ground);
  // far hills all round, pale in the haze
  const farGeo = new THREE.CylinderGeometry(560, 600, 60, 64, 3, true); const fp = farGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) { const a = Math.atan2(fp.getZ(i), fp.getX(i)); if (fp.getY(i) > 0) fp.setY(i, 12 + 34 * (0.5 + 0.5 * Math.sin(a * 5) * Math.cos(a * 3 + 1)) + 12 * Math.sin(a * 17)); }
  farGeo.computeVertexNormals();
  const far = new THREE.Mesh(farGeo, new THREE.MeshLambertMaterial({ color: 0x8c9472, side: THREE.BackSide }));
  far.position.y = -40; scene.add(far);

  // ── the water ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const RINGS = 8, rings = Array.from({ length: RINGS }, () => new THREE.Vector4(0, 0, 0, 0));
  const waterU = { uTime: { value: 0 }, uSun: { value: sunDir }, uRing: { value: rings }, uFog: { value: FOG }, uFogNear: { value: 90 }, uFogFar: { value: 620 } };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, uniforms: waterU,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uTime; uniform vec3 uSun; uniform vec4 uRing[${RINGS}]; uniform vec3 uFog; uniform float uFogNear, uFogFar;
      ${LAKE_GLSL}
      void main(){
        vec2 p = vW.xz; float t = uTime; vec2 g = vec2(0.0);
        g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 1.7 + t * 1.5) * 0.03;
        g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 2.9 + t * 2.0) * 0.022;
        g += vec2(0.2, -0.98) * cos(dot(p, vec2(0.2, -0.98)) * 5.3 + t * 2.8) * 0.014;
        g += vec2(0.96, 0.28) * cos(dot(p, vec2(0.96, 0.28)) * 9.7 - t * 3.6) * 0.009;
        g += vec2(-0.83, -0.55) * cos(dot(p, vec2(-0.83, -0.55)) * 15.1 + t * 4.4) * 0.006;
        float ringLight = 0.0;
        for (int i = 0; i < ${RINGS}; i++) {
          vec4 R = uRing[i]; if (R.w <= 0.0) continue;
          vec2 d = p - R.xy; float dist = length(d), front = 0.05 + R.z * 0.85;
          float k = exp(-pow((dist - front) * 3.2, 2.0)) * R.w * exp(-R.z * 0.9);
          g += d / max(dist, 0.001) * k * sin((dist - front) * 26.0) * 0.55; ringLight += k * 0.25;
        }
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 Rf = reflect(-V, n); float h = clamp(Rf.y, 0.0, 1.0);
        vec3 sky = mix(vec3(0.9, 0.84, 0.7), vec3(0.58, 0.72, 0.86), smoothstep(0.0, 0.2, h)); sky = mix(sky, vec3(0.3, 0.5, 0.76), smoothstep(0.2, 0.75, h));
        sky = mix(sky, vec3(0.2, 0.26, 0.17), smoothstep(0.1, 0.0, h) * 0.55);          // the far shore's trees, upside down
        float shore = lakeSDF(p);
        vec3 body = mix(vec3(0.27, 0.3, 0.19), vec3(0.06, 0.16, 0.19), smoothstep(-0.4, -10.0, shore));
        vec3 c = mix(body, sky, fres);
        float sd = max(dot(Rf, uSun), 0.0);
        c += vec3(1.0, 0.92, 0.74) * (pow(sd, 240.0) * 4.0 + pow(sd, 24.0) * 0.18) + vec3(ringLight);
        c = mix(c, vec3(0.86, 0.84, 0.74), smoothstep(-0.6, 0.0, shore) * 0.35);       // a pale edge where it laps the shore
        float a = mix(0.66, 0.97, fres);
        float f = smoothstep(uFogNear, uFogFar, length(cameraPosition - vW));
        gl_FragColor = vec4(mix(c, uFog, f), mix(a, 1.0, f));
      }`,
  }));
  water.renderOrder = 2; scene.add(water);
  // rings drawn on top too (pale, soft), so a plop far off is easy to see
  const ringTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 40, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); return t;
  })();
  const ringMeshes = Array.from({ length: RINGS }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0, fog: true }));
    m.position.y = 0.02; m.renderOrder = 3; m.visible = false; scene.add(m); return m;
  });
  let ringNext = 0;
  // a ring spreading from x, z (strength 0..1.5)
  function ripple(x, z, strength = 1) {
    const i = ringNext++ % RINGS; rings[i].set(x, z, 0, strength);
    const m = ringMeshes[i]; m.position.x = x; m.position.z = z; m.visible = true; m.userData.s = strength;
  }

  // ── reeds and cattails in the shallows, swaying ────────────────────────────────────────────────────────────────────
  const reedGeo = (() => {
    const pos = [], col = [], r = rng(31);
    const add = (p, c) => { pos.push(...p); col.push(...c, ...c, ...c); };
    for (let b = 0; b < 9; b++) {
      const a = r() * Math.PI * 2, d = r() * 0.28, x0 = Math.cos(a) * d, z0 = Math.sin(a) * d, h = 1.0 + r() * 0.9, lean = 0.08 + r() * 0.2, la = r() * Math.PI * 2;
      const w = 0.022 + r() * 0.012, px = -Math.sin(la) * w, pz = Math.cos(la) * w;
      const pts = [0, 0.4, 0.75, 1].map((t) => [x0 + Math.cos(la) * lean * t * t, h * t, z0 + Math.sin(la) * lean * t * t, w * (1 - t * 0.85)]);
      const cA = [0.28, 0.33, 0.16], cB = [0.52, 0.58, 0.27], cT = [0.74, 0.72, 0.4];
      const cAt = (t) => (t < 0.5 ? cA.map((v, i) => v + (cB[i] - v) * t * 2) : cB.map((v, i) => v + (cT[i] - v) * (t - 0.5) * 2));
      for (let s = 0; s < 3; s++) {
        const [ax, ay, az, aw] = pts[s], [bx, by, bz, bw] = pts[s + 1], ca = cAt(s / 3), cb = cAt((s + 1) / 3);
        const ux = -Math.sin(la), uz = Math.cos(la);
        const A1 = [ax - ux * aw, ay, az - uz * aw], A2 = [ax + ux * aw, ay, az + uz * aw], B1 = [bx - ux * bw, by, bz - uz * bw], B2 = [bx + ux * bw, by, bz + uz * bw];
        add([...A1, ...A2, ...B1], ca); add([...A2, ...B2, ...B1], cb);
      }
      void px; void pz;
    }
    // two cattails: a stalk and a brown head
    for (let c = 0; c < 2; c++) {
      const a = r() * 6.28, x0 = Math.cos(a) * 0.15, z0 = Math.sin(a) * 0.15, h = 1.3 + r() * 0.5, w = 0.012, head = 0.26, rad = 0.032;
      add([x0 - w, 0, z0, x0 + w, 0, z0, x0, h + 0.12, z0], [0.4, 0.44, 0.2]);
      add([x0, 0, z0 - w, x0, 0, z0 + w, x0, h + 0.12, z0], [0.4, 0.44, 0.2]);
      for (let k = 0; k < 6; k++) {
        const a0 = k / 6 * 6.283, a1 = (k + 1) / 6 * 6.283, y0 = h - head, y1 = h;
        const p0 = [x0 + Math.cos(a0) * rad, y0, z0 + Math.sin(a0) * rad], p1 = [x0 + Math.cos(a1) * rad, y0, z0 + Math.sin(a1) * rad];
        const q0 = [x0 + Math.cos(a0) * rad, y1, z0 + Math.sin(a0) * rad], q1 = [x0 + Math.cos(a1) * rad, y1, z0 + Math.sin(a1) * rad];
        const br = [0.32 + 0.04 * (k % 2), 0.2, 0.11];
        add([...p0, ...q0, ...p1], br); add([...p1, ...q0, ...q1], br);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  })();
  const reedSpots = [], rr = rng(47);
  for (let t = 0; t < 6000 && reedSpots.length < (low ? 170 : 300); t++) {
    const x = -40 + rr() * 110, z = -105 + rr() * 125, s = lakeSDF(x, z);
    if (s < -2.6 || s > 0.6) continue;
    if (Math.abs(x) < 3.2 && z > -1.5 && z < DOCK_LEN + 1) continue;          // (the dock itself)
    if (x > -9 && x < 10 && z < 0 && z > -30) continue;                       // (the water straight out from the dock)
    // in clumps: most spots near the last one
    reedSpots.push([x, z]);
    for (let k = 0; k < 3 && reedSpots.length < (low ? 170 : 300); k++) { const xx = x + (rr() - 0.5) * 2.4, zz = z + (rr() - 0.5) * 2.4, ss = lakeSDF(xx, zz); if (ss > -2.6 && ss < 0.6 && !(Math.abs(xx) < 3.2 && zz > -1.5 && zz < DOCK_LEN + 1) && !(xx > -9 && xx < 10 && zz < 0 && zz > -30)) reedSpots.push([xx, zz]); }
  }
  // a few clumps close by on the left of the dock's end, in view
  for (const [x, z] of [[-4.2, 1.5], [-5.6, 3.2], [-3.6, 4.6], [4.6, 5.2], [5.6, 7.5]]) reedSpots.push([x, z]);
  const reeds = new THREE.InstancedMesh(reedGeo, swayable(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 2, 0.5), reedSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  reedSpots.forEach(([x, z], i) => { e.set(0, rr() * 6.3, 0); q.setFromEuler(e); const s = 0.75 + rr() * 0.6; sv.set(s, s * (0.85 + rr() * 0.35), s); pv.set(x, Math.min(groundY(x, z), 0.15) - 0.05, z); m4.compose(pv, q, sv); reeds.setMatrixAt(i, m4); });
  reeds.castShadow = !low; reeds.receiveShadow = true; scene.add(reeds);

  // ── lily pads ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const padShape = new THREE.Shape(); padShape.moveTo(0, 0); padShape.absarc(0, 0, 0.3, 0.3, Math.PI * 2 - 0.05, false); padShape.lineTo(0, 0);
  const padGeo = new THREE.ShapeGeometry(padShape, 8).rotateX(-Math.PI / 2);
  const padSpots = [];
  for (let t = 0; t < 3000 && padSpots.length < 80; t++) { const x = -35 + rr() * 100, z = -100 + rr() * 115, s = lakeSDF(x, z); if (s > -2.5 || s < -8 || (x > -6 && x < 8 && z > -26 && z < 2)) continue; padSpots.push([x, z]); for (let k = 0; k < 4; k++) padSpots.push([x + (rr() - 0.5) * 3, z + (rr() - 0.5) * 3]); }
  const pads = new THREE.InstancedMesh(padGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), padSpots.length);
  const pc = new THREE.Color();
  padSpots.forEach(([x, z], i) => { e.set(0, rr() * 6.3, 0); q.setFromEuler(e); const s = 0.6 + rr() * 0.8; sv.set(s, 1, s); pv.set(x, 0.012 + i * 0.0001, z); m4.compose(pv, q, sv); pads.setMatrixAt(i, m4); pads.setColorAt(i, pc.setHSL(0.24 + rr() * 0.05, 0.45, 0.24 + rr() * 0.08)); });
  pads.receiveShadow = true; pads.renderOrder = 3; scene.add(pads);

  // ── the dock: pilings, two beams, planks across, a wider platform at the end ───────────────────────────────────────
  const dock = new THREE.Group(); scene.add(dock);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x5d4a38 });
  const post = (x, z, top) => {
    const bottom = groundY(x, z) - 0.3, h = top - bottom;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, h, 8), postMat); m.position.set(x, bottom + h / 2, z); m.castShadow = true; m.receiveShadow = true; dock.add(m);
    // a dark wet band where the water laps it
    const wet = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.3, 8), new THREE.MeshLambertMaterial({ color: 0x2f2a20 })); wet.position.set(x, 0.05, z); dock.add(wet);
  };
  for (let z = 2.4; z <= DOCK_LEN; z += 2.9) { post(-1.0, z, DECK - 0.05); post(1.0, z, DECK - 0.05); }
  post(-1.86, -0.02, DECK + 0.42); post(1.86, -0.02, DECK + 0.42); post(-1.86, 2.4, DECK - 0.05); post(1.86, 2.4, DECK - 0.05); post(-0.2, -0.02, DECK - 0.05);
  const beamMat = new THREE.MeshLambertMaterial({ color: 0x4f3d2c });
  for (const x of [-0.9, 0.9]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, DOCK_LEN + 0.5), beamMat); b.position.set(x, DECK - 0.15, DOCK_LEN / 2); b.castShadow = true; dock.add(b); }
  for (const z of [0.05, 2.35]) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.2, 0.12), beamMat); b.position.set(0, DECK - 0.15, z); b.castShadow = true; dock.add(b); }
  const plankTex = boardTexture(23, [150, 126, 98]); plankTex.repeat.set(1, 1);
  const planks = [], pr = rng(9);
  for (let z = -0.15; z < DOCK_LEN; z += 0.215) planks.push([z, z < 2.45 ? 3.9 : 2.2]);
  const plankMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.05, 0.195), new THREE.MeshLambertMaterial({ map: plankTex }), planks.length);
  planks.forEach(([z, w], i) => { e.set((pr() - 0.5) * 0.01, (pr() - 0.5) * 0.015, (pr() - 0.5) * 0.008); q.setFromEuler(e); sv.set(w + (pr() - 0.5) * 0.06, 1, 1); pv.set((pr() - 0.5) * 0.04, DECK - 0.025 + (pr() - 0.5) * 0.008, z); m4.compose(pv, q, sv); plankMesh.setMatrixAt(i, m4); });
  plankMesh.castShadow = true; plankMesh.receiveShadow = true; dock.add(plankMesh);

  // the keeper-limit board on the left corner post, written on by the page (setSign)
  const signCv = document.createElement('canvas'); signCv.width = 256; signCv.height = 160;
  const signTex = new THREE.CanvasTexture(signCv); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.03), [postMat, postMat, postMat, postMat, new THREE.MeshLambertMaterial({ map: signTex }), postMat]);
  sign.position.set(-1.86, DECK + 0.62, 0.08); sign.rotation.y = 0.35; sign.castShadow = true; dock.add(sign);
  const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.05), postMat); signPost.position.set(-1.86, DECK + 0.36, 0.03); dock.add(signPost);
  function setSign(top, big) {
    const g = signCv.getContext('2d');
    g.fillStyle = '#2d3a2e'; g.fillRect(0, 0, 256, 160);                 // a slate in a wooden frame
    g.strokeStyle = '#7a5a38'; g.lineWidth = 12; g.strokeRect(6, 6, 244, 148);
    g.fillStyle = '#e9e4d4'; g.textAlign = 'center';
    g.font = '700 26px Bitter, Georgia, serif'; g.fillText(top, 128, 52);
    g.font = '700 46px Bitter, Georgia, serif'; g.fillText(big, 128, 114);
    signTex.needsUpdate = true;
  }
  setSign('KEEPER LIMIT', '?');
  // the creel (a wicker basket with a lid and a strap) and the bait can
  const wickerTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = '#a07a44'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? '#c49a5a' : '#8a6634'; g.fillRect(x + 1, y + 1, 6, 6); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t;
  })();
  const creel = new THREE.Group(); creel.position.set(-1.3, DECK, 1.5); creel.rotation.y = 0.5; dock.add(creel);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.26), new THREE.MeshLambertMaterial({ map: wickerTex })); basket.position.y = 0.15; basket.castShadow = true; creel.add(basket);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.28), new THREE.MeshLambertMaterial({ map: wickerTex, color: 0xd8c8a8 })); lid.position.y = 0.32; lid.castShadow = true; creel.add(lid);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 4, 16, Math.PI), new THREE.MeshLambertMaterial({ color: 0x4a3020 })); strap.position.y = 0.33; creel.add(strap);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0x8e8a80 })); can.position.set(1.0, DECK + 0.06, 1.3); can.castShadow = true; dock.add(can);
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.01, 12), new THREE.MeshLambertMaterial({ color: 0x3a2a1a })); dirt.position.set(1.0, DECK + 0.115, 1.3); dock.add(dirt);
  // the stringer's rope, from the corner post's top down into the water (the kept fish hang on it)
  const ropeMat = new THREE.LineBasicMaterial({ color: 0x8a7a5a });
  const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([STRINGER.clone(), new THREE.Vector3(STRINGER.x + 0.15, -0.4, STRINGER.z - 0.25)]), ropeMat);
  dock.add(rope);
  dock.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  // ── trees round the far shores (the game's own), darker forest behind them ─────────────────────────────────────────
  const tr = rng(61), treeSpots = [];
  for (let t = 0; t < 4000 && treeSpots.length < (low ? 22 : 40); t++) {
    const x = -70 + tr() * 170, z = -130 + tr() * 140, s = lakeSDF(x, z);
    if (s < 5 || s > 32 || z > 4 || (x > -3 && z > -6)) continue;
    if (treeSpots.some(([a, b]) => Math.hypot(a - x, b - z) < 6)) continue;
    treeSpots.push([x, z, ['pine_sparse', 'oak_sparse', 'aspen_sparse', 'pine_sparse'][Math.floor(tr() * 4)], 8 + tr() * 6]);
  }
  for (let t = 0, n = 0; t < 2000 && n < (low ? 6 : 11); t++) {
    const x = -32 + tr() * 64, z = 13 + tr() * 30, s = lakeSDF(x, z);
    if (s < 4 || Math.abs(x) < 4 || treeSpots.some(([a, b]) => Math.hypot(a - x, b - z) < 6)) continue;
    treeSpots.push([x, z, ['oak_sparse', 'pine_sparse', 'aspen_sparse'][Math.floor(tr() * 3)], 8 + tr() * 5]); n++;
  }
  // (the second loop: a few on the near shore behind the dock, the background when a fish is held up to look at)
  const trees = new THREE.Group(); scene.add(trees);
  const treeLoad = Promise.all(['pine_sparse', 'oak_sparse', 'aspen_sparse'].map((f) => loader.loadAsync(GAME + 'models/trees/' + f + '.glb').then((g) => [f, g.scene]).catch(() => [f, null])))
    .then((list) => {
      const proto = Object.fromEntries(list);
      for (const [x, z, f, h] of treeSpots) {
        if (!proto[f]) continue;
        const m = proto[f].clone(); m.scale.setScalar(h / 66); m.position.set(x, groundY(x, z) - 0.2, z); m.rotation.y = x * 1.7 + z;
        m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
        trees.add(m);
      }
    });
  const coneGeo = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
  const forestSpots = [];
  for (let t = 0; t < 8000 && forestSpots.length < (low ? 240 : 460); t++) {
    const x = -160 + tr() * 340, z = -260 + tr() * 270, s = lakeSDF(x, z);
    // (far off only: behind the shore trees, never near the camera's side of the lake)
    if (s < 30 || s > 130 || Math.hypot(x - 2, z - 6) < 75 || z > -20) continue;
    forestSpots.push([x, z]);
  }
  const forest = new THREE.InstancedMesh(coneGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), forestSpots.length);
  const fc = new THREE.Color();
  forestSpots.forEach(([x, z], i) => { const h = 10 + tr() * 10, r = 2.0 + tr() * 1.4; e.set(0, tr() * 6, 0); q.setFromEuler(e); sv.set(r, h, r); pv.set(x, groundY(x, z) - 0.5, z); m4.compose(pv, q, sv); forest.setMatrixAt(i, m4); forest.setColorAt(i, fc.setHSL(0.27 + tr() * 0.06, 0.32, 0.17 + tr() * 0.07)); });
  scene.add(forest);

  // ── the cabin on the left bank, facing the water (the game's own, low-detail copy) ─────────────────────────────────
  const CABIN = { x: -23.5, z: -37, size: 9.5 };
  const cabinLoad = loader.loadAsync(GAME + 'models/town/lo/cabin.glb').then((g) => {
    const m = g.scene, box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = CABIN.size / Math.max(size.x, size.z);
    const holder = new THREE.Group(); m.position.set(-c.x, -box.min.y, -c.z); holder.add(m); holder.scale.setScalar(k);
    let y = -Infinity; for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, 0]]) y = Math.max(y, groundY(CABIN.x + dx, CABIN.z + dz));
    holder.position.set(CABIN.x, y - 0.1, CABIN.z); holder.rotation.y = Math.PI / 2 - 0.25;
    m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    scene.add(holder); return holder;
  }).catch((err) => { console.warn('fishing lab: the cabin did not load', err); return null; });

  // ── each frame ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function update(dt) {
    swayU.uTime.value += dt; waterU.uTime.value += dt;
    for (let i = 0; i < RINGS; i++) {
      const r = rings[i]; if (r.w <= 0) continue;
      r.z += dt; const m = ringMeshes[i], rad = 0.05 + r.z * 0.85;
      m.scale.set(rad * 2.3, 1, rad * 2.3); m.material.opacity = Math.max(0, 0.5 * m.userData.s * Math.exp(-r.z * 1.3));
      if (r.z > 4) { r.w = 0; m.visible = false; }
    }
  }
  return { scene, sun, sunDir, update, ripple, setSign, groundY, lakeSDF, isWater, treeLoad, cabinLoad, dock, creel, water };
}
