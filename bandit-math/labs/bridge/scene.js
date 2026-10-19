// THE RIVER CROSSING: sky, the two grassy banks with the river running between them (along Z), the water, the stone
// abutments the bridge stands on (they move when the builder sets the gap), the road coming down to them, the
// engineer's camp with its wagon on the west bank, the lumber pile on its sawhorses, trees along the banks, grass, and
// the engineer. Metres here (the bridge's feet become metres where they are drawn: FT). The sky, the light and the
// lumber pile are drawn as the windmill lab's scene.js draws them (copied: that module draws its own hilltop).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { boardTexture, plankTexture, softDot, rng } from '../windmill/wood.js';
import { WATER_Y, BED_Y, ABUT_HALF, SPAN0 } from './bridge.js';

export const FT = 0.3048;
const GAME = new URL('../../', import.meta.url).href;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// the natural banks: the river's channel runs between X = -BANK and X = BANK (feet), its floor BED_Y, the banks above
// flat at Y = 0 out to the hills. The abutments are stone built out from the banks into the channel to the gap's edges.
export const BANK = 14;
const SLOPE = 4;              // feet: how far the bank slopes from its top down to the channel's floor

// the land's height (metres) at (x, z) metres, without the abutments
function landY(x, z) {
  const xf = x / FT, zf = z / FT, ax = Math.abs(xf - Math.sin(zf * 0.012) * 6 * Math.min(1, Math.abs(zf) / 60));
  let y;
  if (ax < BANK - SLOPE) y = BED_Y + 0.5 * Math.sin(xf * 0.7 + zf * 0.3) * 0.3;
  else if (ax < BANK) { const t = (ax - (BANK - SLOPE)) / SLOPE; y = BED_Y + (0 - BED_Y) * (t * t * (3 - 2 * t)); }
  else y = 0;
  // far away the land rises into gentle hills
  const r = Math.hypot(xf, zf), far = Math.max(0, r - 120);
  y += (far * 0.04) * (0.6 + 0.4 * Math.sin(xf * 0.01 + zf * 0.013)) + (ax > BANK ? 0.15 * Math.sin(xf * 0.05) * Math.cos(zf * 0.07) * Math.min(1, (ax - BANK) / 10) : 0);
  return y * FT;
}
// the ground a falling board lands on (metres): the land, or the top of an abutment
let span = SPAN0;
export function groundY(x, z) {
  const xf = Math.abs(x / FT), zf = Math.abs(z / FT);
  if (zf <= ABUT_HALF && xf >= span / 2 && xf <= BANK + 2) return 0;
  return landY(x, z);
}
export const waterY = WATER_Y * FT;
// the breeze the trees and grass sway in (the bridge test has no wind: weight only)
export const wind = { level: 0.08, time: 0 };

export function makeScene({ low = false } = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd8c8a6, 70, 520);
  // ── sky (the windmill's) ─────────────────────────────────────────────────────────────────────────────────────────
  const sunDir = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vDir; uniform vec3 uSun;
      void main(){ float h = clamp(vDir.y, -0.2, 1.0);
        vec3 top = vec3(0.24, 0.45, 0.74), mid = vec3(0.56, 0.71, 0.86), low = vec3(0.93, 0.84, 0.68);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
        float s = max(dot(normalize(vDir), uSun), 0.0); c += vec3(1.0, 0.85, 0.6) * (pow(s, 64.0) * 0.8 + pow(s, 6.0) * 0.12);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  const cloudTex = softDot(128), cr = rng(5);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xfff8ec, transparent: true, opacity: 0.55 + cr() * 0.3, depthWrite: false, fog: false }));
    const a = cr() * Math.PI * 2, r = 380 + cr() * 250; m.position.set(Math.cos(a) * r, 90 + cr() * 110, Math.sin(a) * r);
    m.scale.set(140 + cr() * 160, 30 + cr() * 30, 1); scene.add(m);
  }
  // ── light ──────────────────────────────────────────────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x7a6040, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.copy(sunDir).multiplyScalar(40); sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -10; sc.near = 5; sc.far = 90;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);

  // ── the land: grass on the banks, earth down the slopes, stones on the river's floor (by height, in the vertices) ──
  const tl = new THREE.TextureLoader();
  const grassTex = tl.load(GAME + 'textures/ground/grassDry.jpg'); grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(70, 70); grassTex.anisotropy = 4;
  const seg = low ? 160 : 240, landGeo = new THREE.PlaneGeometry(600, 600, seg, seg); landGeo.rotateX(-Math.PI / 2);
  // (rows packed near the river, where the banks slope: x of a vertex pushed toward the middle)
  const lp = landGeo.attributes.position, cols = new Float32Array(lp.count * 3);
  for (let i = 0; i < lp.count; i++) {
    let x = lp.getX(i); const z = lp.getZ(i), u = x / 300; x = Math.sign(u) * Math.pow(Math.abs(u), 2.2) * 300; lp.setX(i, x);
    let zz = z; { const v = z / 300; zz = Math.sign(v) * Math.pow(Math.abs(v), 1.6) * 300; lp.setZ(i, zz); }
    const y = landY(x, zz); lp.setY(i, y);
    const d = y / FT, t = Math.max(0, Math.min(1, -d / 1.5)), w = Math.max(0, Math.min(1, (-d - 4) / 2));
    cols[i * 3] = 1 - 0.32 * t - 0.2 * w; cols[i * 3 + 1] = 1 - 0.42 * t - 0.15 * w; cols[i * 3 + 2] = 1 - 0.5 * t - 0.05 * w;
  }
  landGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  landGeo.computeVertexNormals();
  const land = new THREE.Mesh(landGeo, new THREE.MeshLambertMaterial({ map: grassTex, color: 0xfff2d0, vertexColors: true }));
  land.receiveShadow = true; scene.add(land);
  // stones on the river's floor and down the slopes
  const rockTex = tl.load(GAME + 'textures/rock/granite.jpg'); rockTex.colorSpace = THREE.SRGBColorSpace; rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;
  const rockMat = new THREE.MeshLambertMaterial({ map: rockTex, color: 0xb8b0a2 });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 70), rr = rng(31), rm = new THREE.Matrix4(), rq = new THREE.Quaternion(), re = new THREE.Euler();
  let nRocks = 0;
  for (let i = 0; i < 70; i++) {
    const side = rr() < 0.5 ? -1 : 1, xf = side * (BANK - SLOPE - 1 + rr() * (SLOPE + 1)), zf = (rr() - 0.5) * 120;
    if (Math.abs(zf) < ABUT_HALF + 3) continue;
    const s = (0.4 + rr() * 1.2) * FT; re.set(rr() * 6, rr() * 6, rr() * 6); rq.setFromEuler(re);
    rm.compose(new THREE.Vector3(xf * FT, landY(xf * FT, zf * FT) + s * 0.2, zf * FT), rq, new THREE.Vector3(s * 1.4, s * 0.7, s)); rocks.setMatrixAt(nRocks++, rm);
  }
  rocks.count = nRocks;
  rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);
  // far hills all round
  const farGeo = new THREE.CylinderGeometry(560, 600, 60, 64, 3, true); const fp = farGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) { const a = Math.atan2(fp.getZ(i), fp.getX(i)); if (fp.getY(i) > 0) fp.setY(i, 10 + 30 * (0.5 + 0.5 * Math.sin(a * 5) * Math.cos(a * 3 + 1)) + 12 * Math.sin(a * 17)); }
  farGeo.computeVertexNormals();
  const far = new THREE.Mesh(farGeo, new THREE.MeshLambertMaterial({ color: 0x9a9070, side: THREE.BackSide }));
  far.position.y = -40; scene.add(far);

  // ── the water: a sheet over the channel, ripples drifting downstream (its texture moving along Z) ────────────────
  const wcv = document.createElement('canvas'); wcv.width = wcv.height = 256;
  { const g = wcv.getContext('2d'), r = rng(9); g.fillStyle = '#5f8789'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 120; i++) { const x = r() * 256, y = r() * 256, l = 4 + r() * 14; g.strokeStyle = `rgba(${r() < 0.5 ? '220,240,236' : '30,60,70'},${0.05 + r() * 0.09})`; g.lineWidth = 1 + r() * 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y + l / 2, x, y + l); g.stroke(); } }
  const waterTex = new THREE.CanvasTexture(wcv); waterTex.colorSpace = THREE.SRGBColorSpace; waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(2, 30);
  const water = new THREE.Mesh(new THREE.PlaneGeometry((BANK * 2 + 2) * FT, 600), new THREE.MeshLambertMaterial({ map: waterTex, color: 0x9fc4c4, transparent: true, opacity: 0.86, depthWrite: false }));
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y * FT; water.renderOrder = 2; scene.add(water);

  // ── the abutments: stone, from the gap's edge back into the bank, from the river's floor to the top ───────────────
  const stoneTex = tl.load(GAME + 'textures/rock/granite.jpg'); stoneTex.colorSpace = THREE.SRGBColorSpace; stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex, color: 0xc9bfae });
  // (the stone is laid in courses: a canvas of joints over the granite)
  const jcv = document.createElement('canvas'); jcv.width = 256; jcv.height = 256;
  { const g = jcv.getContext('2d'), r = rng(13); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(70,58,46,0.75)'; g.lineWidth = 3;
    for (let row = 0; row < 4; row++) { const y = row * 64; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); let x = (row % 2) * 40 + r() * 20; while (x < 256) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); x += 60 + r() * 50; } } }
  const jointTex = new THREE.CanvasTexture(jcv); jointTex.wrapS = jointTex.wrapT = THREE.RepeatWrapping;
  const wallMat = new THREE.MeshLambertMaterial({ map: stoneTex, color: 0xd2c8b6, aoMap: null });
  wallMat.onBeforeCompile = (sh) => {
    sh.uniforms.jMap = { value: jointTex };
    sh.fragmentShader = 'uniform sampler2D jMap;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= texture2D(jMap, vMapUv * 0.5).rgb;');
  };
  const abuts = [-1, 1].map((side) => {
    const g = new THREE.Group(), box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMat), cap = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), stoneMat);
    box.castShadow = box.receiveShadow = true; cap.castShadow = cap.receiveShadow = true;
    g.add(box, cap); scene.add(g); return { side, g, box, cap };
  });
  let setSpan = function (S) {
    span = S;
    const top = 0, bot = (BED_Y - 1) * FT, half = ABUT_HALF * FT;
    for (const a of abuts) {
      const x0 = S / 2, x1 = BANK + 2.5, len = (x1 - x0) * FT;
      a.box.scale.set(len, top - bot, half * 2); a.box.position.set(a.side * (x0 * FT + len / 2), (top + bot) / 2 - 0.02, 0);
      // (the stone's courses at their true size: each face's texture spread over its own metres, 1.2 m a repeat)
      a.box.geometry.dispose(); a.box.geometry = new THREE.BoxGeometry(1, 1, 1);
      const u = a.box.geometry.attributes.uv, size = [[half * 2, top - bot], [half * 2, top - bot], [len, half * 2], [len, half * 2], [len, top - bot], [len, top - bot]];
      for (let i = 0; i < u.count; i++) { const [su, sv] = size[Math.floor(i / 4)]; u.setXY(i, u.getX(i) * su / 1.2, u.getY(i) * sv / 1.2); }
      a.cap.scale.set(len + 0.06, 0.12, half * 2 + 0.12); a.cap.position.set(a.side * (x0 * FT + len / 2) - a.side * 0.03, -0.04, 0);
    }
  }
  // the banks' compass letters, painted on the stone tops in the middle of the road: W on the west, E on the east
  const letter = (ch) => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.font = '700 96px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(244, 232, 207, 0.85)'; g.strokeStyle = 'rgba(40, 28, 16, 0.6)'; g.lineWidth = 6;
    g.strokeText(ch, 64, 70); g.fillText(ch, 64, 70); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const marks = [['W', -1], ['E', 1]].map(([ch, side]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: letter(ch), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 3; scene.add(m); return { m, side };
  });
  const placeMarks = (S) => { for (const { m, side } of marks) m.position.set(side * (S / 2 + 2.2) * FT, 0.02, 0); };
  const setSpan0 = setSpan;
  setSpan = (S) => { setSpan0(S); placeMarks(S); };
  setSpan(SPAN0);

  // ── the road down to the banks, both sides ────────────────────────────────────────────────────────────────────
  const dirtTex = tl.load(GAME + 'textures/ground/dirt.jpg'); dirtTex.colorSpace = THREE.SRGBColorSpace; dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping; dirtTex.repeat.set(1, 12);
  const fadeCv = document.createElement('canvas'); fadeCv.width = 64; fadeCv.height = 4;
  { const g = fadeCv.getContext('2d'), grd = g.createLinearGradient(0, 0, 64, 0); grd.addColorStop(0, '#000'); grd.addColorStop(0.25, '#fff'); grd.addColorStop(0.75, '#fff'); grd.addColorStop(1, '#000'); g.fillStyle = grd; g.fillRect(0, 0, 64, 4); }
  for (const side of [-1, 1]) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(9 * FT, 160 * FT), new THREE.MeshLambertMaterial({ map: dirtTex, alphaMap: new THREE.CanvasTexture(fadeCv), transparent: true, depthWrite: false, color: 0xe8d6b8 }));
    road.rotation.x = -Math.PI / 2; road.rotation.z = Math.PI / 2; road.position.set(side * (BANK + 80) * FT, 0.012, 0); road.renderOrder = 1; road.receiveShadow = true; scene.add(road);
  }

  // ── the lumber pile on two sawhorses (the windmill's): one board drawn for every full board left ────────────────
  const pile = new THREE.Group(); pile.position.set(-(BANK + 5) * FT, 0, -9 * FT); pile.rotation.y = 0.2; pile.userData.crown = 1.4; scene.add(pile);
  const horseMat = new THREE.MeshLambertMaterial({ color: 0x5e4630 });
  for (const x of [-0.8, 0.8]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), horseMat); top.position.set(x, 0.62, 0); pile.add(top);
    for (const s of [-1, 1]) for (const z of [-0.28, 0.28]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.68, 0.05), horseMat); leg.position.set(x + s * 0.09, 0.31, z); leg.rotation.z = s * 0.25; pile.add(leg); }
  }
  const pileTex = boardTexture(41, [182, 136, 88]);
  const pileMat = new THREE.MeshLambertMaterial({ map: pileTex });
  const pileBoards = [];
  function setPile(n) {
    for (const b of pileBoards) pile.remove(b); pileBoards.length = 0;
    for (let i = 0; i < Math.min(n, 42); i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(8 * FT, 1.5 / 12 * FT, 3.5 / 12 * FT), pileMat);
      const row = Math.floor(i / 6), col = i % 6;
      b.position.set((row % 2 ? 0.03 : -0.03), 0.68 + row * 0.04, -0.25 + col * 0.095); b.castShadow = true; b.receiveShadow = true;
      pile.add(b); pileBoards.push(b);
    }
  }
  // the deck planks, stacked on the ground beside the lumber
  const plankPile = new THREE.Group(); plankPile.position.set(-(BANK + 5) * FT, 0, -4.5 * FT); plankPile.rotation.y = 0.2; plankPile.userData.crown = 1.2; scene.add(plankPile);
  const plankMat = new THREE.MeshLambertMaterial({ map: boardTexture(57, [170, 128, 84]) });
  const plankBoards = [];
  function setPlankPile(n) {
    for (const b of plankBoards) plankPile.remove(b); plankBoards.length = 0;
    for (let i = 0; i < Math.min(n, 36); i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(7.2 * FT, 1.5 / 12 * FT, 7.25 / 12 * FT), plankMat);
      const row = Math.floor(i / 4), col = i % 4; b.position.set(0, 0.05 + row * 0.04, -0.28 + col * 0.19); b.rotation.y = (row % 2) * 0.02; b.castShadow = true; b.receiveShadow = true;
      plankPile.add(b); plankBoards.push(b);
    }
  }

  // ── the engineer's camp on the west bank, with its wagon; trees along the banks ──────────────────────────────────
  const props = new THREE.Group(); scene.add(props);
  const campLoad = loader.loadAsync(GAME + 'models/camps/camp1.glb').then((g) => {
    const m = g.scene; m.position.set(-(BANK + 26) * FT, 0, -16 * FT); m.rotation.y = 0.9; m.userData.crown = 3.4;
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); props.add(m);
  }).catch(() => null);
  const wagonLoad = loader.loadAsync(GAME + 'models/wagons/farm.glb').then((g) => {
    const m = g.scene; m.position.set(-(BANK + 22) * FT, 0, 12 * FT); m.rotation.y = 2.3; m.userData.crown = 2.4;
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); props.add(m);
    return loader.loadAsync(GAME + 'models/wagons/wheel.glb').then((w) => {
      const info = { FL: [0.8, 0.5, 1.03], FR: [-0.77, 0.5, 1.03], BL: [0.78, 0.55, -1.03], BR: [-0.82, 0.55, -1.02] };
      for (const [k, p] of Object.entries(info)) { const wh = w.scene.clone(); const r = k[0] === 'F' ? 0.5 : 0.55; wh.scale.setScalar(r / 0.6); wh.position.set(...p); if (p[0] < 0) wh.rotation.y = Math.PI; m.add(wh); }
    });
  }).catch(() => null);
  const treeSpots = [
    { file: 'oak_sparse', x: -(BANK + 9), z: 26, h: 8.5 }, { file: 'pine_sparse', x: -(BANK + 30), z: -36, h: 10 }, { file: 'ash_sparse', x: BANK + 10, z: -24, h: 9 },
    { file: 'oak_sparse', x: BANK + 18, z: 30, h: 8 }, { file: 'pine_sparse', x: BANK + 40, z: 6, h: 11 }, { file: 'aspen_sparse', x: -(BANK + 6), z: -34, h: 9 },
    { file: 'ash_sparse', x: BANK + 6, z: 44, h: 8 }, { file: 'pine_sparse', x: -(BANK + 46), z: 18, h: 12 }, { file: 'oak_sparse', x: -(BANK + 8), z: 62, h: 9 },
    { file: 'aspen_sparse', x: BANK + 9, z: -60, h: 9 },
  ];
  const trees = new THREE.Group(); scene.add(trees);
  const kinds = [...new Set(treeSpots.map((t) => t.file))];
  const treeLoad = Promise.all(kinds.map((f) => loader.loadAsync(GAME + 'models/trees/' + f + '.glb').then((g) => [f, g.scene]).catch(() => [f, null])))
    .then((list) => {
      const proto = Object.fromEntries(list);
      for (const t of treeSpots) {
        const m = proto[t.file] ? proto[t.file].clone() : codeTree();
        // (t.x, t.z: feet; t.h: the tree's height in metres; the game's trees are about 66 units tall)
        if (proto[t.file]) m.scale.setScalar(t.h / 66);
        m.position.set(t.x * FT, groundY(t.x * FT, t.z * FT) - 0.1, t.z * FT); m.rotation.y = t.x * 1.7 + t.z; m.userData.crown = t.h * 0.36;
        m.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = !low; } });
        trees.add(m);
      }
    });
  function codeTree() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 3, 7).translate(0, 1.5, 0), new THREE.MeshLambertMaterial({ color: 0x5b4330 })));
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1).translate(0, 4, 0), new THREE.MeshLambertMaterial({ color: 0x6f7a3a, flatShading: true })));
    return g;
  }
  // grass tufts on the banks
  const blade = (() => {
    const pos = [], col = [], r = rng(11);
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2, lean = 0.04 + r() * 0.1, hgt = 0.18 + r() * 0.22, w = 0.02, cx = Math.cos(a), cz = Math.sin(a), px = -cz * w, pz = cx * w;
      pos.push(px, 0, pz, -px, 0, -pz, cx * lean, hgt, cz * lean); col.push(0.55, 0.47, 0.26, 0.55, 0.47, 0.26, 1.0, 0.9, 0.6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  })();
  const tufts = low ? 500 : 1300;
  const grass = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), tufts);
  { const gm = new THREE.Matrix4(), gr = rng(17), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    for (let i = 0; i < tufts; i++) {
      let x, z; do { x = (gr() < 0.5 ? -1 : 1) * (BANK + 1 + Math.pow(gr(), 0.8) * 40) * FT; z = (gr() - 0.5) * 90 * FT; } while (Math.abs(z / FT) < ABUT_HALF + 1.5 || (Math.abs(z / FT) < 6 && Math.abs(x / FT) > BANK));
      e.set(0, gr() * 6.3, 0); q.setFromEuler(e); const s = 0.7 + gr() * 0.9; sv.set(s, s, s); pv.set(x, groundY(x, z), z); gm.compose(pv, q, sv); grass.setMatrixAt(i, gm);
    } }
  grass.receiveShadow = true; scene.add(grass);

  // anything standing between the eye and the bridge (a tree, the camp, the pile) is left out while it is in the way
  // (in the way: nearer the eye than the bridge is, and inside a wide cone round the line from the eye to the bridge's
  // middle, its crown counted; or right round the eye itself)
  function clearView(eye) {
    const ex = eye.x, ez = eye.z, L = Math.hypot(ex, ez) || 1, ux = -ex / L, uz = -ez / L;
    for (const m of [...trees.children, ...props.children, pile, plankPile]) {
      const r = m.userData.crown || 3, tx = m.position.x - ex, tz = m.position.z - ez;
      const along = tx * ux + tz * uz, off = Math.abs(tx * uz - tz * ux);
      // (a crown hangs out round its trunk: one whose crown reaches over the eye, trunk behind or not, is in the way)
      const inWay = (along > -r && along < L * 0.8 && off < r + Math.max(0, along) * 0.75) || Math.hypot(tx, tz) < r * 1.5 + 2;
      m.visible = !inWay;
    }
  }
  function update(dt, centre, eye = null) {
    wind.time += dt;
    waterTex.offset.y -= dt * 0.035;
    if (eye) clearView(eye);
  }
  return { scene, sun, sky, setPile, setPlankPile, setSpan, update, treeLoad: Promise.all([treeLoad, campLoad, wagonLoad]), pile, water };
}

// ── the engineer: one of the game's townsfolk in work clothes. If the game's people can't load, a plain figure ───────
export async function makeEngineer(scene) {
  let person = null;
  try {
    const { loadFolk, makePerson } = await import('../../src/actors/folk.js');
    const lib = await loadFolk(GAME);
    person = makePerson(lib, { outfit: 'worker_m', palette: ['#5c6b7a', '#4a3f33', '#2e241c', '#3e3328'], skin: 2, hair: 3, hat: true });
    person.play('Idle', { fade: 0 });
  } catch (err) {
    console.warn('bridge lab: the game\'s people did not load, using a plain engineer', err);
    const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0x5c6b7a });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 4, 8), mat); body.position.y = 0.95; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshLambertMaterial({ color: 0xc68d62 })); head.position.y = 1.62; g.add(head);
    person = { root: g, play() { return false; }, update() {} };
  }
  person.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  scene.add(person.root);
  return person;
}
