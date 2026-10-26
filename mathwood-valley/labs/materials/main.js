// THE MATERIAL LAB: a cabin built from parts in code (two of them: the neat one, cabin.js, and the frontier one,
// frontier.js, from the same parts kit), textures drawn in code (textures.js), weathering worked out in the shader
// (weather.js), decals stamped on (decals.js), and the game's Tripo cabin beside it to compare.
// This file: the scene, the light, the panel of sliders, and the measuring.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeTextures } from './textures.js';
import { buildCabin, CABIN, topAt } from './cabin.js';
import { buildFrontier, LOOK as FRONTIER_LOOK } from './frontier.js';
import { U, MASKS, weather } from './weather.js';
import { Decals } from './decals.js';

const TRIPO_X = 12.5;                         // where the Tripo cabin stands (east of the built one)
const TRIPO_URL = '../../models/town/cabin.glb', TRIPO_LO_URL = '../../models/town/lo/cabin.glb';
const CODE_FILES = ['cabin.js', 'frontier.js', 'textures.js', 'weather.js', 'decals.js'];
const $ = (s, el = document) => el.querySelector(s);
const kb = (b) => (b >= 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.round(b / 1024) + ' KB');
const num = (n) => Math.round(n).toLocaleString('en-US');

// ── renderer, scene, camera ───────────────────────────────────────────────────────────────────────────────────────────
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 1.2; controls.maxDistance = 60;
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 80 });
const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x5a4a34, 1.0);
scene.add(sun, sun.target, hemi);

const state = {
  az: 200, hour: 15.5, shadows: true,
  moss: false, grime: false, wear: false, decals: false,
  mossAmt: 0.5, patch: 1.4, mossSharp: 0.6, shadeMode: 'north',
  grimeAmt: 0.85, streaks: 5, grimeSharp: 0.6, edgeAmt: 0.7, edgeCm: 1.2,
  view: 'built', tripoWeather: false, decalSize: 1,
  mask: 'off', cabin: 'frontier',
};
// each built cabin starts with its own weathering: the neat one with the lab's first settings (all off), the frontier
// one with everything on and turned up (frontier.js). Switching cabins puts that cabin's settings back.
const NEAT_LOOK = { state: {}, uniforms: {} };
for (const k in FRONTIER_LOOK.state) NEAT_LOOK.state[k] = state[k];
for (const k in FRONTIER_LOOK.uniforms) NEAT_LOOK.uniforms[k] = U[k].value.isColor ? '#' + U[k].value.getHexString() : U[k].value;
const CABIN_NAME = { neat: 'Neat', frontier: 'Frontier' };

// ── the light: sun direction (compass) and time of day ───────────────────────────────────────────────────────────────
const SKY_DAY = new THREE.Color(0x9cbbe0), SKY_DUSK = new THREE.Color(0xd99a72), SUN_DAY = new THREE.Color(0xfff3e2), SUN_LOW = new THREE.Color(0xffa060);
const sunDir = new THREE.Vector3();
let viewCentre = new THREE.Vector3(0, 1.8, 0.6);
function applyLight() {
  const az = state.az * Math.PI / 180, day = Math.sin(Math.PI * (state.hour - 6) / 12);
  const el = Math.max(0.035, day) * 62 * Math.PI / 180;            // the sun's height: up to 62 degrees at noon
  sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();   // +x east, -z north
  const k = THREE.MathUtils.smoothstep(Math.sin(el), 0.04, 0.55);  // 0 at sunrise/sunset, 1 high in the sky
  sun.color.copy(SUN_LOW).lerp(SUN_DAY, k); sun.intensity = 1.0 + 2.4 * k;
  const sky = SKY_DUSK.clone().lerp(SKY_DAY, k).multiplyScalar(0.55 + 0.45 * k);
  hemi.color.copy(sky).lerp(new THREE.Color(1, 1, 1), 0.25); hemi.intensity = 0.9 + 0.8 * k;
  scene.background = sky; scene.fog = new THREE.Fog(sky, 45, 140);
  sun.position.copy(viewCentre).addScaledVector(sunDir, 40); sun.target.position.copy(viewCentre); sun.target.updateMatrixWorld();
  sun.castShadow = state.shadows;
  // the moss's shady side: north, or (as an option) straight away from wherever the slider puts the sun
  if (state.shadeMode === 'sun') U.uShadeDir.value.set(-sunDir.x, 0, -sunDir.z).normalize(); else U.uShadeDir.value.set(0, 0, -1);
}

// ── the uniforms from the panel's state ──────────────────────────────────────────────────────────────────────────────
function applyWeather() {
  U.uMossAmt.value = state.moss ? state.mossAmt : 0;
  U.uPatchScale.value = 1 / (4 * state.patch);
  U.uMossSoft.value = 0.02 + 0.3 * (1 - state.mossSharp);
  U.uGrimeAmt.value = state.grime ? state.grimeAmt : 0;
  U.uStreakScale.value = state.streaks / 8;
  U.uGrimeSoft.value = 0.02 + 0.3 * (1 - state.grimeSharp);
  U.uEdgeAmt.value = state.wear ? state.edgeAmt : 0;
  U.uEdgeWidth.value = state.edgeCm / 100;
  U.uMask.value = MASKS[state.mask] || 0;
  if (decals) decals.group.visible = state.decals;
  applyLight(); showLegend();
}

// ── build ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
let T, cabin, cabinGroup, ground, groundGeo, tripo = null, decals = null;
const mats = {};
// the two built cabins, each made the first time it's chosen (and kept, so switching back is instant)
const NEAT_SPOTS = [['sign', [CABIN.W / 2, 3.5, 0], [1, 0, 0]], ['poster', [-2.35, 1.75, CABIN.D / 2], [0, 0, 1]], ['horseshoe', [-0.9, 2.42, CABIN.D / 2 + 0.05], [0, 0, 1]], ['stain', [CABIN.W / 2, 1.05, -1.3], [1, 0, 0]]];
const BUILDERS = { neat: () => ({ ...buildCabin(), topAt, spots: NEAT_SPOTS }), frontier: () => buildFrontier() };
const built = {};
function getCabin(kind) {
  if (!built[kind]) {
    const c = BUILDERS[kind](); c.meshes = {};
    for (const g in c.geos) { const m = new THREE.Mesh(c.geos[g], mats[g]); m.name = g; m.castShadow = g !== 'glass'; m.receiveShadow = true; c.meshes[g] = m; }
    built[kind] = c;
  }
  return built[kind];
}
const tripoInfo = { bytes: 0, loBytes: 0, tex: 0, tris: 0, meshes: 0 }, codeInfo = { bytes: 0, gz: 0 };
const bench = {};

async function build() {
  T = await makeTextures();
  U.uNoise.value = T.noise;
  mats.wood = weather(new THREE.MeshStandardMaterial({ map: T.wood, normalMap: T.woodN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.86 }), { box: true, ao: true });
  mats.stone = weather(new THREE.MeshStandardMaterial({ map: T.stone, normalMap: T.stoneN, roughness: 0.92 }), { box: true, ao: true });
  mats.iron = weather(new THREE.MeshStandardMaterial({ color: 0x3a332e, roughness: 0.55, metalness: 0.65 }), { box: true, ao: true });
  mats.glass = weather(new THREE.MeshStandardMaterial({ color: 0x0d1418, roughness: 0.06, metalness: 0.1 }), { box: true, ao: true });
  cabin = getCabin(state.cabin);
  cabinGroup = new THREE.Group(); cabinGroup.name = 'built cabin';
  scene.add(cabinGroup);

  // the ground: a patch of grass, worn to dirt round the cabin and on the path, darkened where it's tucked in
  const G = groundGeo = new THREE.PlaneGeometry(60, 60, 120, 120); G.rotateX(-Math.PI / 2);
  const P = G.attributes.position, n = P.count, ao = new Float32Array(n), tp = new Float32Array(n * 4);
  const rect = (x, z, x0, x1, z0, z1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  const { W, D, PD } = CABIN;
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), z = P.getZ(i);
    const dCab = rect(x, z, -W / 2 - 0.9, W / 2 + 0.7, -D / 2 - 0.8, D / 2 + PD + 0.6);
    const dPath = Math.abs(x + 0.9 + Math.sin(z * 0.35) * 0.5) - 0.55 + (z < D / 2 + PD ? 9 : 0);
    const dTri = rect(x, z, TRIPO_X - 5, TRIPO_X + 5, -4.6, 5.2);
    tp[i * 4] = Math.max(1 - THREE.MathUtils.smoothstep(dCab, 0, 1.3), 0.85 * (1 - THREE.MathUtils.smoothstep(dPath, 0, 0.6)) * (1 - THREE.MathUtils.smoothstep(z, 9, 16)), 0.9 - THREE.MathUtils.smoothstep(dTri, 0, 1.5));
  }
  G.setAttribute('aAO', new THREE.BufferAttribute(ao, 1)); G.setAttribute('aTintPaint', new THREE.BufferAttribute(tp, 4));
  T.ground.repeat.set(15, 15);
  mats.ground = weather(new THREE.MeshStandardMaterial({ map: T.ground, roughness: 0.97 }), { ground: true, tint: true, ao: true });
  ground = new THREE.Mesh(G, mats.ground); ground.receiveShadow = true; ground.name = 'ground';
  scene.add(ground);

  decals = new Decals({ scene, camera, canvas, targets: [cabin.meshes.wood, cabin.meshes.stone], controls, stamps: T.decals, topAt: cabin.topAt, onChange: () => { updateHint(); updateStats(true); } });
  cabinGroup.add(decals.group);
  useCabin(state.cabin);

  loadTripo();
  measureCode();
}
function placeStartingDecals() {
  for (const [key, p, n] of cabin.spots) decals.stampAt(key, new THREE.Vector3(...p), new THREE.Vector3(...n));
}
// the ground's ambient occlusion, from whichever cabin stands there (the dark band where it meets the footing)
function bakeGround() {
  const P = groundGeo.attributes.position, A = groundGeo.attributes.aAO;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); A.array[i] = Math.abs(x) < 9 && Math.abs(z) < 8 ? cabin.occ.at(x, 0, z, 0, 1, 0, 0.03) : 1; }
  A.needsUpdate = true;
}
// stand one of the built cabins on the patch: its meshes, the ground's shading, the decals cut from its walls, and its
// own weathering settings
function useCabin(kind) {
  state.cabin = kind; cabin = getCabin(kind);
  for (const m of [...cabinGroup.children]) if (m !== decals.group) cabinGroup.remove(m);
  for (const g in cabin.meshes) cabinGroup.add(cabin.meshes[g]);
  bakeGround();
  decals.targets = [cabin.meshes.wood, cabin.meshes.stone]; decals.topAt = cabin.topAt;
  decals.clear(); placeStartingDecals();
  const L = kind === 'frontier' ? FRONTIER_LOOK : NEAT_LOOK;
  Object.assign(state, L.state);
  for (const k in L.uniforms) { if (U[k].value.isColor) U[k].value.set(L.uniforms[k]); else U[k].value = L.uniforms[k]; }
  state.mask = 'off';
  syncPanel(); applyWeather();
  panel.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('on'));
  if (kind === 'neat') panel.querySelector('[data-preset="clean"]')?.classList.add('on');
  panel.querySelectorAll('[data-cabin]').forEach((b) => b.classList.toggle('on', b.dataset.cabin === kind));
  fillCabinInfo(); updateStats(); fillCompare();
  if (tripo && window.ML.ready) measure();
}

async function loadTripo() {
  try {
    const buf = await (await fetch(TRIPO_URL)).arrayBuffer();
    tripoInfo.bytes = buf.byteLength;
    fetch(TRIPO_LO_URL, { method: 'HEAD' }).then((r) => { tripoInfo.loBytes = +r.headers.get('content-length') || 0; fillCompare(); }).catch(() => {});
    const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '../../models/town/', res, rej));
    const root = gltf.scene, box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
    const s = 9.5 / Math.max(size.x, size.z);   // the game's size for it: 9.5 m along its longest side
    root.scale.setScalar(s);
    root.position.set(TRIPO_X - (box.min.x + box.max.x) / 2 * s, -box.min.y * s - 0.006 * s, -(box.min.z + box.max.z) / 2 * s);
    tripo = new THREE.Group(); tripo.name = 'tripo cabin'; tripo.add(root);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true; tripoInfo.meshes++;
      tripoInfo.tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      const m = o.material, img = m.map && m.map.image;
      if (img) tripoInfo.tex += img.width * img.height * 4 * 4 / 3, tripoInfo.texSize = img.width + ' x ' + img.height;
      o.userData.plain = m;
      o.userData.weathered = weather(m.clone(), { top: size.y * s * 0.55 });
    });
    scene.add(tripo);
    applyView(false); applyTripoWeather(); fillCompare();
  } catch (e) { console.warn('Tripo cabin did not load', e); }
}
function applyTripoWeather() {
  if (!tripo) return;
  tripo.traverse((o) => { if (o.isMesh) o.material = state.tripoWeather ? o.userData.weathered : o.userData.plain; });
}
async function measureCode() {
  let bytes = 0, gz = 0;
  for (const f of CODE_FILES) {
    try {
      const b = await (await fetch(f)).blob(); bytes += b.size;
      if (window.CompressionStream) gz += (await new Response(b.stream().pipeThrough(new CompressionStream('gzip'))).blob()).size;
    } catch (e) { /* no size then */ }
  }
  codeInfo.bytes = bytes; codeInfo.gz = gz; fillCompare(); updateStats(true);
}

// ── views: the built cabin, the Tripo cabin, side by side ───────────────────────────────────────────────────────────
const VIEWS = {
  built: { c: [0, 1.8, 0.6], off: [9.4, 3.2, 10.6] },
  tripo: { c: [TRIPO_X, 2.6, 0.5], off: [11.5, 4.2, 13.5] },
  side: { c: [TRIPO_X / 2 + 0.4, 2.4, 0.5], off: [3, 8, 27] },
};
function applyView(moveCamera = true) {
  const V = VIEWS[state.view];
  cabinGroup.visible = state.view !== 'tripo';
  if (tripo) tripo.visible = state.view !== 'built';
  viewCentre = new THREE.Vector3(...V.c);
  const ext = state.view === 'side' ? 17 : 11;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); sun.shadow.camera.updateProjectionMatrix();
  // a tall, narrow screen (a phone held upright) sees less across: stand further back
  const back = Math.min(2.6, Math.max(1, 1.15 / camera.aspect));
  if (moveCamera) { controls.target.copy(viewCentre); camera.position.copy(viewCentre).add(new THREE.Vector3(...V.off).multiplyScalar(back)); controls.update(); }
  applyLight();
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view));
}

// ── measuring: each cabin alone, 30 frames, waiting for the graphics card after each ──────────────────────────────────
function measure() {
  if (!tripo) return;
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const keep = { cab: cabinGroup.visible, tri: tripo.visible, gr: ground.visible, pos: camera.position.clone(), tgt: controls.target.clone() };
  ground.visible = false;
  for (const arm of ['built', 'tripo']) {
    cabinGroup.visible = arm === 'built'; tripo.visible = arm === 'tripo';
    const V = VIEWS[arm]; camera.position.set(...V.c).add(new THREE.Vector3(...V.off)); camera.lookAt(...V.c); camera.updateMatrixWorld();
    for (let i = 0; i < 4; i++) { renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
    const t0 = performance.now(), N = 30;
    for (let i = 0; i < N; i++) { renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    bench[arm] = { ms: (performance.now() - t0) / N, calls, tris };
  }
  cabinGroup.visible = keep.cab; tripo.visible = keep.tri; ground.visible = keep.gr; camera.position.copy(keep.pos); controls.target.copy(keep.tgt); controls.update();
  fillCompare();
}

// ── the panel ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// a control: [type, label, key, ...]. Keys starting with "u" are uniforms in U; others live in `state`.
const R = (label, key, min, max, step, fmt = (v) => (+v).toFixed(2)) => ({ t: 'range', label, key, min, max, step, fmt });
const C = (label, key) => ({ t: 'color', label, key });
const S = (label, key, opts) => ({ t: 'select', label, key, opts });
const K = (label, key) => ({ t: 'check', label, key });
const M = (opts) => ({ t: 'mask', opts });
const cm = (v) => (+v).toFixed(1) + ' cm', m = (v) => (+v).toFixed(1) + ' m';
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const fmtAz = (v) => Math.round(v) + '° ' + COMPASS[Math.round(v / 45) % 8];
const fmtHour = (v) => { const h = Math.floor(v), mm = Math.round((v - h) * 60); return (h % 12 || 12) + ':' + String(mm).padStart(2, '0') + (h < 12 ? 'am' : 'pm'); };

const MASK_INFO = {
  moss: ['Moss', 'where the shader put moss (all its rules and noise together)'],
  mossUp: ['Moss: facing up', 'how much each surface faces the sky (its normal\'s height)'],
  mossLow: ['Moss: near the ground', '1 at the ground, fading to 0 at the "ground height" slider'],
  mossShade: ['Moss: shady side', 'how much each surface faces the shady side'],
  mossRain: ['Moss: open to rain', 'baked at load: can rain falling from the sky (straight, or leaning in the wind) reach this spot? The porch floor stays dry'],
  mossTuck: ['Moss: tucked in', 'from the baked ambient occlusion: corners, under eaves, behind things'],
  mossNoise: ['Moss: patch noise', 'the big world-space noise that breaks the moss into patches'],
  grime: ['Grime', 'streaks, splash and corner dirt together'],
  streaks: ['Grime: streaks', 'water running down from the roof edge above each wall'],
  splash: ['Grime: splash', 'mud splashed up from the ground'],
  dirt: ['Grime: corner dirt', 'dirt settled where the air is still (low ambient occlusion)'],
  wear: ['Edge wear', 'worn wood and chipped paint at board edges'],
  edgeDist: ['Distance to the nearest edge', 'what edge wear starts from: 1 on an edge, 0 four "widths" in'],
  ao: ['Ambient occlusion', 'how much sky each spot sees: dark = tucked in, bright = open'],
};

const SECTIONS = [
  { id: 'cabin', title: 'Built cabin', open: true, rows: [{ t: 'cabins' }, { t: 'cabininfo' }],
    how: `<p>Two cabins from the same <b>parts kit</b>: every log, board, shake and stone is a box (a few round things are prisms), and the boxes are merged into one mesh per material, so either cabin is four draw calls.</p>
<p><b>Neat</b>: lap siding, small shingles, painted trim. <b>Frontier</b>: an 1880s homestead. Hewn logs with pale chinking in the gaps, their ends crossing at the corners at ragged lengths; big split shakes, each its own width, a little crooked, the odd gap or missing one, every course resting on the one below so its butt lifts and throws a dark line; a ridge sagged in the middle; dark weathered wood instead of white trim; board shutters (one hanging off a hinge); a pole rail; a fieldstone chimney.</p>
<p>The frontier cabin costs about as many triangles as the Tripo model: fewer, bigger parts, and faces nobody can ever see left out (a shake's underside and the end hidden under the next course, a shutter's back). Its wood is tinted corner by corner: bleached grey up high, darker and dirtier low down.</p>
<p>Switching puts that cabin's own weathering settings back (the frontier starts with it all on and turned up).</p>` },
  { id: 'light', title: 'Light', open: true, rows: [R('Sun direction', 'az', 0, 359, 1, fmtAz), R('Time of day', 'hour', 5.5, 19.5, 0.25, fmtHour), K('Shadows', 'shadows')],
    how: `<p>The sun is a <b>directional light</b> (parallel rays, like a sun that is very far away) with a <b>shadow map</b>: the scene is drawn once from the sun's side into a depth picture, and each pixel checks it to see whether something is between it and the sun.</p>
<p>The sky is a <b>hemisphere light</b>: blue from above, earth-brown from below. Time of day lowers the sun and warms its colour; the sky dims and goes orange with it.</p>` },
  { id: 'moss', title: 'Moss', enable: 'moss', rows: [
      R('Amount', 'mossAmt', 0, 1, 0.01), R('Facing up', 'uMossUp', 0, 1, 0.01), R('Near ground', 'uMossLow', 0, 1, 0.01), R('Shady side', 'uMossShade', 0, 1, 0.01), R('Tucked in', 'uMossTuck', 0, 1, 0.01),
      R('Ground height', 'uMossHeight', 0.2, 3, 0.05, m), R('Patch size', 'patch', 0.4, 5, 0.1, m), R('Breakup', 'uMossBreak', 0, 1, 0.01), R('Sharpness', 'mossSharp', 0, 1, 0.01), R('Bump', 'uMossBump', 0, 1.5, 0.01),
      C('Colour', 'uMossColor'), S('Shady side is', 'shadeMode', [['north', 'North'], ['sun', 'Away from the sun']]),
      M([['moss', 'Moss'], ['mossUp', 'Facing up'], ['mossLow', 'Near the ground'], ['mossShade', 'Shady side'], ['mossTuck', 'Tucked in'], ['mossRain', 'Open to rain'], ['mossNoise', 'Patch noise']])],
    how: `<p>Every pixel gets four scores, each 0 to 1: <b>facing up</b> (the height of its normal: rain and dew sit there; only counted where the rain can reach, baked at load, so the porch floor under its roof stays clean), <b>near the ground</b> (its height), <b>shady side</b> (its normal against north: it stays damp) and <b>tucked in</b> (the baked ambient occlusion, and the cracks between boards: the edge distance from Edge wear). The four sliders weight them; together they are a "moss likes it here" score.</p>
<p>On its own that score is smooth, and moss would look like green paint sprayed by height. Two noise reads fix it: <b>big world-space noise</b> breaks the score into patches, and a <b>height blend</b> lets the little moss cushions in a noise texture poke through first, so a patch ends in clumps instead of a fade. Amount slides the threshold; sharpness is how hard the patch edge is.</p>
<pre>score = (up*wUp + low*wLow + shade*wShade + tuck*wTuck) / (wUp+wLow+wShade+wTuck)
cover = smoothstep(1-amount-soft, 1-amount+soft, score + patchNoise)
moss  = clamp((cover*1.35 - (1.0-cushion)) * 3.5, 0.0, 1.0)</pre>
<p>The colour comes from the same cushion height: dark in the gaps, light on the tops, yellower in patches, browner at thin edges, a dark film of algae round each patch. A bump from the cushion height tilts the normal so the light catches the lumps, and moss is fully matte.</p>
<p>The noise is read in <b>world space</b> (triplanar: three reads, along x, y and z, blended by facing), so it needs no UVs and runs straight across every board. Tick "Weather the Tripo cabin too" below: the same code puts moss on a model it has never seen.</p>` },
  { id: 'grime', title: 'Grime', enable: 'grime', rows: [
      R('Amount', 'grimeAmt', 0, 1, 0.01), R('Streak length', 'uStreakLen', 0.2, 3, 0.05, m), R('Streaks per m', 'streaks', 1, 14, 0.5, (v) => (+v).toFixed(1)), R('Splash height', 'uSplashH', 0, 1.4, 0.01, m),
      R('Corner dirt', 'uCornerDirt', 0, 1, 0.01), R('Sharpness', 'grimeSharp', 0, 1, 0.01), C('Streak colour', 'uGrimeColor'), C('Mud colour', 'uMudColor'),
      M([['grime', 'All grime'], ['streaks', 'Streaks'], ['splash', 'Splash'], ['dirt', 'Corner dirt']])],
    how: `<p><b>Streaks:</b> every corner of every board knows the height of the drip edge above it: the roof edge, or a window sill (the boards under a window are cut at the sill's ends so they can carry it; worked out when the cabin is built and stored with the corner). How far a pixel is below that edge fades the streak out; a noise read stretched twenty times taller than it is wide turns the fade into columns, and a second read gives each column its own length.</p>
<pre>below = roofEdge - height
fade  = 1 - below / (length * columnNoise)
streak = smoothstep(.., .., tallNoise*0.75 + fade*0.6 - 0.2)</pre>
<p><b>Splash:</b> height above the ground plus grit noise: mud thrown up by rain landing at the foot of the wall. <b>Corner dirt:</b> the baked ambient occlusion again: dirt settles where the air is still. Streaks darken what's under them (multiply), so the grain still shows through; mud replaces it.</p>` },
  { id: 'wear', title: 'Edge wear', enable: 'wear', rows: [
      R('Amount', 'edgeAmt', 0, 1, 0.01), R('Width', 'edgeCm', 0.2, 6, 0.1, cm), R('Breakup', 'uEdgeBreak', 0, 1, 0.01), R('Paint flecks', 'uPaintChip', 0, 1, 0.01),
      M([['wear', 'Edge wear'], ['edgeDist', 'Distance to edge']])],
    how: `<p>Each corner of a box carries <b>where it sits inside its box</b>. The graphics card blends that between corners exactly, so every pixel knows how far it is from each pair of sides. Of the three distances, one is about zero (the face we're on); the <b>second smallest is the distance to the nearest edge</b>.</p>
<pre>d    = halfSize - abs(localPos)
edge = d.x + d.y + d.z - min(d) - max(d)
wear = smoothstep(.35, .65, 1 - edge/width + noise)</pre>
<p>Near an edge, bare wood rubs lighter and smoother. <b>Paint</b> (the door, the window trim) chips back to wood in a wider band and in random flecks. A scanned model has no box numbers, so it would need a baked "curvature" map for the same effect.</p>` },
  { id: 'ao', title: 'Ambient occlusion', open: false, rows: [R('Strength', 'uAOAmt', 0, 2.5, 0.01), R('Darkens sunlight', 'uAOSun', 0, 1, 0.01), M([['ao', 'Ambient occlusion']])],
    how: `<p>"How much sky can this spot see?" worked out <b>once, at load</b>, in JavaScript (<span id="aoTime"></span>). The solid parts (the walls' core, roof slabs, footing, chimney, porch) are stamped into a grid of 8 cm cubes. From each corner, 20 rays go out over the half of the sky its face looks at; a ray that runs into a filled cube or the ground counts as blocked, a nearer hit more. The share that got out is stored with the corner.</p>
<p>The frontier cabin bakes harder: its rays reach 2.4 m instead of 1.4 (so the porch ceiling sees the deck under it), and a second, close-range pass shoots a dozen 35 cm rays from each corner at the real boxes nearby. The cubes are too coarse to see the 4 cm gap between two logs or the lip of a shake over the course below; the boxes aren't.</p>
<p>The shader darkens the <b>sky light</b> with it, and moss and dirt read it as "tucked in". <b>Strength</b> past 1 works as a power (ao<sup>strength</sup>), so the dark corners darken faster than the open walls. <b>Darkens sunlight</b> lets it shade the sun's light too, the way a scanned model's shadows are painted into its colour and stay dark in full sun. The ground got it too: see the dark band where it meets the footing.</p>` },
  { id: 'decals', title: 'Decals', enable: 'decals', rows: [{ t: 'stamps' }, R('Size', 'decalSize', 0.4, 2.2, 0.05, (v) => (+v).toFixed(2) + 'x'), { t: 'buttons', items: [['Clear decals', () => decals.clear()], ['Put back the four', () => { decals.clear(); placeStartingDecals(); }]] }],
    how: `<p>Drag a stamp onto a wall (or tap it, then tap a wall). Drag a decal to move it; drag it off the cabin to throw it away.</p>
<p>A decal is a picture stamped onto a surface that's already there. three.js's <b>DecalGeometry</b> takes a box (where, which way, how big), cuts out the triangles of the wall that fall inside it, clips them to the box's sides and gives them new UVs across the box. The result is a thin new mesh that hugs the boards exactly, into the laps between them, drawn a hair in front (polygon offset).</p>
<p>The decals use the weathering shader too: switch on grime and watch the poster under the porch roof get dirty along with the wall. One decal is one more draw call.</p>` },
  { id: 'compare', title: 'Against the Tripo cabin', open: true, rows: [{ t: 'views' }, K('Weather the Tripo cabin too', 'tripoWeather'), { t: 'buttons', items: [['Measure again', () => measure()]] }, { t: 'compare' }],
    how: `<p>The game's cabin is a <b>Tripo</b> model: one mesh and one 2048 x 2048 picture with all its colour, and any dirt, painted in. The built cabin is thousands of boxes merged into <b>four meshes</b> (one per material), with small tiling textures drawn in code, and its weathering worked out live.</p>
<p><b>ms per frame</b>: each cabin alone, drawn 30 times, waiting for the graphics card after each (a one-pixel readPixels), so it counts the card's work and isn't capped at the screen's 60 fps. Draw calls are the main pass (the shadow pass adds its own). Download: the Tripo file vs the code that builds the cabin and draws its textures (three.js itself is shared).</p>` },
  { id: 'textures', title: 'Textures', open: false, rows: [{ t: 'texlist' }],
    how: `<p>A <b>trim sheet</b> is one picture holding many strips that each tile along their length. Every board points its UVs at one strip: <code>u</code> runs along the board in metres (1.2 m to a repeat, so the nails line up on the same "studs" row after row), <code>v</code> stays inside the strip, and its bevelled edges are painted into the strip's normal map. Board ends point at the end-grain squares.</p>
<p>Twelve strips and a <b>tint per board</b> (a colour stored with its corners) make thousands of parts look different with one texture and one draw call. The same idea makes spaceship hulls: a sheet of panel strips, seams and bolts, with grime and decals on top.</p>
<p>Memory on the card: width x height x 4 bytes, plus a third for the mipmaps (the smaller copies used far away).</p>` },
];

const panel = $('#panel');
function buildPanel() {
  panel.innerHTML = `<h1>Material Lab</h1><p class="sub">A cabin built from parts, textures drawn in code, and weathering the shader works out for itself. <a href="../">All labs</a></p>
    <div class="presets">${['clean:Clean', 'moss:Moss', 'grime:Grime', 'wear:Worn edges', 'all:All on'].map((p) => { const [k, l] = p.split(':'); return `<button class="btn" data-preset="${k}">${l}</button>`; }).join('')}</div>`;
  for (const sec of SECTIONS) {
    const d = document.createElement('details'); d.className = 'sec'; d.id = 'sec-' + sec.id;
    d.open = sec.open ?? (sec.enable ? true : false);
    if (window.innerWidth < 760 && sec.id !== 'moss') d.open = false;
    d.innerHTML = `<summary>${sec.enable ? `<input type="checkbox" class="en" data-key="${sec.enable}" aria-label="${sec.title} on">` : ''}${sec.title}</summary><div class="body"></div>`;
    const body = $('.body', d);
    for (const r of sec.rows) body.appendChild(control(r, sec));
    if (sec.how) { const h = document.createElement('details'); h.className = 'how'; h.innerHTML = `<summary>How it works</summary>${sec.how}`; body.appendChild(h); }
    panel.appendChild(d);
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]'); if (b) preset(b.dataset.preset);
    const v = e.target.closest('[data-view]'); if (v) { state.view = v.dataset.view; applyView(); }
    const cb = e.target.closest('[data-cabin]'); if (cb && cabin && cb.dataset.cabin !== state.cabin) useCabin(cb.dataset.cabin);
  });
  panel.querySelectorAll('summary .en').forEach((cb) => {
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', () => { state[cb.dataset.key] = cb.checked; applyWeather(); });
  });
  $('#panelToggle').addEventListener('click', () => { const c = panel.classList.toggle('closed'); $('#panelToggle').setAttribute('aria-expanded', String(!c)); });
}
const getV = (key) => (key[0] === 'u' && U[key] ? U[key].value : state[key]);
function setV(key, v) {
  if (key[0] === 'u' && U[key]) { if (U[key].value.isColor) U[key].value.set(v); else U[key].value = v; } else state[key] = v;
  if (key === 'decalSize' && decals) decals.scale = v;
  if (key === 'tripoWeather') applyTripoWeather();
  applyWeather();
}
function control(r, sec) {
  const el = document.createElement('div'); el.className = 'row';
  if (r.t === 'range') {
    const id = 'r-' + r.key, v = getV(r.key);
    el.innerHTML = `<label for="${id}">${r.label}</label><input type="range" id="${id}" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}"><output>${r.fmt(v)}</output>`;
    const inp = $('input', el), out = $('output', el);
    inp.addEventListener('input', () => { setV(r.key, +inp.value); out.textContent = r.fmt(inp.value); });
    el.dataset.key = r.key;
  } else if (r.t === 'color') {
    const id = 'c-' + r.key; el.classList.add('two');
    el.innerHTML = `<label for="${id}">${r.label}</label><input type="color" id="${id}" data-color="${r.key}" value="#${U[r.key].value.getHexString()}">`;
    $('input', el).addEventListener('input', (e) => setV(r.key, e.target.value));
  } else if (r.t === 'select' || r.t === 'mask') {
    el.classList.add('two');
    const opts = r.t === 'mask' ? [['off', 'Off'], ...r.opts] : r.opts, id = 's-' + sec.id + (r.key || 'mask');
    el.innerHTML = `<label for="${id}">${r.t === 'mask' ? 'Show mask' : r.label}</label><select id="${id}" ${r.t === 'mask' ? 'data-mask' : ''}>${opts.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`;
    const s = $('select', el); s.value = r.t === 'mask' ? 'off' : state[r.key];
    s.addEventListener('change', () => {
      if (r.t === 'mask') { state.mask = s.value; panel.querySelectorAll('select[data-mask]').forEach((o) => { if (o !== s) o.value = 'off'; }); applyWeather(); }
      else setV(r.key, s.value);
    });
  } else if (r.t === 'check') {
    el.classList.add('check');
    el.innerHTML = `<label><input type="checkbox" data-key="${r.key}" ${state[r.key] ? 'checked' : ''}> ${r.label}</label>`;
    $('input', el).addEventListener('change', (e) => setV(r.key, e.target.checked));
  } else if (r.t === 'buttons') {
    el.className = 'btnrow';
    for (const [l, fn] of r.items) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = l; b.addEventListener('click', fn); el.appendChild(b); }
  } else if (r.t === 'views') {
    el.className = 'btnrow';
    el.innerHTML = [['built', 'Built'], ['tripo', 'Tripo'], ['side', 'Side by side']].map(([k, l]) => `<button class="btn" data-view="${k}">${l}</button>`).join('');
  } else if (r.t === 'cabins') {
    el.className = 'btnrow';
    el.innerHTML = [['neat', 'Neat'], ['frontier', 'Frontier']].map(([k, l]) => `<button class="btn${k === state.cabin ? ' on' : ''}" data-cabin="${k}">${l}</button>`).join('');
  } else if (r.t === 'cabininfo') {
    el.className = ''; el.innerHTML = '<p class="note" id="cabinInfo"></p>';
  } else if (r.t === 'compare') {
    el.className = ''; el.innerHTML = '<table class="cmp" id="cmp"></table><p class="note" id="cmpNote"></p>';
  } else if (r.t === 'stamps') {
    el.className = 'stamps'; el.id = 'stamps';
  } else if (r.t === 'texlist') {
    el.className = 'texlist'; el.id = 'texlist';
  }
  return el;
}
function syncPanel() {
  panel.querySelectorAll('summary .en').forEach((cb) => { cb.checked = !!state[cb.dataset.key]; });
  panel.querySelectorAll('.row[data-key]').forEach((row) => {
    const key = row.dataset.key, inp = $('input', row), r = SECTIONS.flatMap((s) => s.rows).find((x) => x.key === key);
    inp.value = getV(key); $('output', row).textContent = r.fmt(getV(key));
  });
  panel.querySelectorAll('.row.check input').forEach((c) => { const k = c.dataset.key; if (k) c.checked = !!state[k]; });
  panel.querySelectorAll('input[data-color]').forEach((c) => { c.value = '#' + U[c.dataset.color].value.getHexString(); });
  panel.querySelectorAll('select[data-mask]').forEach((s) => { if (![...s.options].some((o) => o.value === state.mask)) s.value = 'off'; else s.value = state.mask; });
}
function preset(p) {
  const on = { clean: [], moss: ['moss'], grime: ['grime'], wear: ['wear'], all: ['moss', 'grime', 'wear', 'decals'] }[p];
  for (const k of ['moss', 'grime', 'wear', 'decals']) state[k] = on.includes(k);
  state.mask = 'off';
  syncPanel(); applyWeather();
  panel.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === p));
}
function fillStamps() {
  const box = $('#stamps');
  for (const [key, S] of Object.entries(T.decals)) {
    const b = document.createElement('button'); b.className = 'stamp'; b.title = S.label + ': drag onto a wall'; b.setAttribute('aria-label', S.label);
    const c = document.createElement('canvas'); c.width = S.canvas.width; c.height = S.canvas.height; c.getContext('2d').drawImage(S.canvas, 0, 0);
    b.appendChild(c); box.appendChild(b);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!state.decals) { state.decals = true; syncPanel(); applyWeather(); } decals.beginStamp(key, e); });
    b.dataset.key = key;
  }
}
function fillTextures() {
  const box = $('#texlist');
  const rows = T.list.map((L) => `<div class="tex"><canvas width="52" height="52"></canvas><div><b>${L.name}</b><small>${L.w} x ${L.h}${L.note ? ' · ' + L.note : ''}</small></div><span class="mem">${kb(L.bytes)}</span></div>`);
  box.innerHTML = rows.join('') + `<div class="tex"><span></span><div><b>Total on the card</b><small>drawn in code in ${Math.round(T.ms)} ms · downloaded: 0 bytes</small></div><span class="mem">${kb(T.totalBytes)}</span></div>`;
  box.querySelectorAll('canvas').forEach((c, i) => {
    const src = T.list[i].canvas, g = c.getContext('2d'), s = Math.min(52 / src.width, 52 / src.height);
    g.drawImage(src, (52 - src.width * s) / 2, (52 - src.height * s) / 2, src.width * s, src.height * s);
  });
  fillCabinInfo();
}
const cabinTris = () => Object.values(cabin.geos).reduce((s, g) => s + g.index.count / 3, 0);
function fillCabinInfo() {
  const corners = num(Object.values(cabin.geos).reduce((s, g) => s + g.attributes.position.count, 0));
  const ao = $('#aoTime'); if (ao) ao.textContent = `${CABIN_NAME[state.cabin]} cabin: ${Math.round(cabin.msAO)} ms for ${corners} corners`;
  const info = $('#cabinInfo');
  if (info) info.textContent = `${CABIN_NAME[state.cabin]}: ${num(cabin.parts)} parts, ${num(cabinTris())} triangles (the Tripo cabin: ${tripoInfo.tris ? num(tripoInfo.tris) : '…'}). Built in ${Math.round(cabin.msBuild)} ms, shadows baked in ${Math.round(cabin.msAO)} ms.`;
}
function builtTextureBytes() { return T.list.filter((L) => L.name !== 'Grass').reduce((s, L) => s + L.bytes, 0); }
function builtTris() { return Object.values(cabin.geos).reduce((s, g) => s + g.index.count / 3, 0) + (decals ? decals.list.reduce((s, m) => s + m.geometry.attributes.position.count / 3, 0) : 0); }
function fillCompare() {
  const t = $('#cmp'); if (!t || !cabin) return;
  const b = bench.built, q = bench.tripo, row = (l, a, c) => `<tr><td>${l}</td><td>${a}</td><td>${c}</td></tr>`;
  fillCabinInfo();
  t.innerHTML = `<thead><tr><th></th><th>${CABIN_NAME[state.cabin]}</th><th>Tripo</th></tr></thead><tbody>
    ${row('Download', codeInfo.bytes ? kb(codeInfo.bytes) + ' code' : '…', tripoInfo.bytes ? kb(tripoInfo.bytes) : '…')}
    ${row('&nbsp; gzipped / 1K version', codeInfo.gz ? kb(codeInfo.gz) : '–', tripoInfo.loBytes ? kb(tripoInfo.loBytes) + ' (1K)' : '–')}
    ${row('Texture memory', kb(builtTextureBytes()), tripoInfo.tex ? kb(tripoInfo.tex) : '…')}
    ${row('Pictures', T.list.length - 1 + ' small', tripoInfo.texSize ? '1 at ' + tripoInfo.texSize : '…')}
    ${row('Triangles', num(builtTris()), tripoInfo.tris ? num(tripoInfo.tris) : '…')}
    ${row('Parts → meshes', num(cabin.parts) + ' → ' + Object.keys(cabin.geos).length, tripoInfo.meshes ? '1 scan → ' + tripoInfo.meshes : '…')}
    ${row('Draw calls', b ? b.calls : '…', q ? q.calls : '…')}
    ${row('ms per frame', b ? b.ms.toFixed(2) : '…', q ? q.ms.toFixed(2) : '…')}
    ${row('&nbsp; as fps', b ? num(1000 / b.ms) : '…', q ? num(1000 / q.ms) : '…')}
    </tbody>`;
  $('#cmpNote').textContent = b ? `Measured at ${renderer.domElement.width} x ${renderer.domElement.height} px, each cabin alone, shadows ${state.shadows ? 'on' : 'off'}, weathering as set now.` : '';
}
function showLegend() {
  const L = $('#legend'), info = MASK_INFO[state.mask];
  if (!info) { L.hidden = true; return; }
  L.hidden = false; L.innerHTML = `<b>Showing: ${info[0]}</b> · ${info[1]}<div class="bar"></div><div class="ends"><span>0</span><span>1</span></div>`;
}
function updateHint() {
  const h = $('#hint'); if (decals && decals.armed) { h.hidden = false; h.textContent = `Tap a wall to put the ${T.decals[decals.armed].label.toLowerCase()} there`; } else h.hidden = true;
  document.querySelectorAll('.stamp').forEach((b) => b.classList.toggle('on', decals && b.dataset.key === decals.armed));
}

// ── the stats box ─────────────────────────────────────────────────────────────────────────────────────────────────────
let frames = 0, fpsT = performance.now(), fps = 0, frameMs = 0;
function updateStats() {
  if (!cabin) return;
  const I = renderer.info.render;
  $('#stats').innerHTML = `<div class="t">Material Lab</div>
    fps <b>${fps}</b> · ${frameMs.toFixed(1)} ms<br>
    draw calls <b>${I.calls}</b> · triangles <b>${num(I.triangles)}</b><br>
    textures <b>${kb(T.totalBytes)}</b> on the card · <b>0</b> downloaded<br>
    ${CABIN_NAME[state.cabin]} cabin: ${num(cabinTris())} triangles (ground ${num(groundGeo.index.count / 3)})<br>
    ${num(cabin.parts)} parts → ${Object.keys(cabin.geos).length} meshes${decals && decals.list.length && state.decals ? ' + ' + decals.list.length + ' decals' : ''}`;
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; }
  // on a phone the panel covers the bottom of the view: shift the picture up so the cabin sits in the part you can see
  const sheet = window.innerWidth <= 760 && !panel.classList.contains('closed');
  if (sheet) camera.setViewOffset(w, h, 0, h * 0.22, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
let last = performance.now();
function loop() {
  requestAnimationFrame(loop);
  resize(); controls.update();
  const t = performance.now(); renderer.render(scene, camera); frameMs = frameMs * 0.9 + (performance.now() - t) * 0.1;
  frames++;
  if (t - fpsT > 500) { fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; updateStats(); }
  last = t;
}

(async () => {
  try {
    buildPanel();
    await build();
    resize(); fillStamps(); fillTextures(); syncPanel(); applyView(); applyWeather();
    renderer.compile(scene, camera);
    $('#loading').classList.add('gone');
    loop();
    // measure once the Tripo cabin is in (and the shaders are warm)
    const wait = setInterval(() => { if (tripo) { clearInterval(wait); setTimeout(() => { measure(); window.ML.ready = true; }, 600); } }, 200);
  } catch (e) { console.error(e); if (window.oops) window.oops(e); }
})();

// for the test rigs (and the curious): drive the lab from the console
window.ML = {
  ready: false, state, U, preset, measure,
  set(k, v) { setV(k, v); syncPanel(); },
  mask(name) { state.mask = name; syncPanel(); applyWeather(); },
  view(v) { state.view = v; applyView(); },
  cabin(kind) { useCabin(kind); },
  cam(pos, tgt) { camera.position.set(...pos); controls.target.set(...tgt); controls.update(); },
  get renderer() { return renderer; }, get bench() { return bench; }, get cabin() { return cabin; }, get info() { return { cabin: cabin && { kind: state.cabin, parts: cabin.parts, counts: cabin.counts, tris: cabinTris(), msBuild: cabin.msBuild, msAO: cabin.msAO }, tex: T && T.totalBytes, texMs: T && T.ms, tripo: tripoInfo, code: codeInfo }; },
};
