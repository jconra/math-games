// THE SHIP LAB: the ships' outsides at true size. Each one is a model generated (Meshy, image to 3D) from the game's
// maker's picture of it, made light for the web (space-station/assets/ships/). Next here: the space inside each one and
// blueprints of the rooms drawn to fit it.
//   Drag to look round the ship, pinch or wheel to come closer; W A S D move (Space up, C down, Shift faster).
//   ?ship=<id> opens one ship.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// the ships: each model's file, the length it is drawn at (nose to nozzle, metres) and how it lies in its file
//   (the generated models lie along x with the nose toward -x and the ship's left toward +z: turned a quarter so the
//   nose is +z and the ship's left +x, as the kit's ships)
const SHIPS = [
  { id: 'explorer-b', name: 'Explorer C · Meshy B', file: 'explorer-meshy-b.glb', len: 17.3, turn: Math.PI / 2, note: 'from the 3/4 view' },
  { id: 'explorer-a', name: 'Explorer C · Meshy A', file: 'explorer-meshy-a.glb', len: 17.3, turn: Math.PI / 2, note: 'from four views' },
];

const canvas = document.getElementById('c'), hud = document.getElementById('hud'), loading = document.getElementById('loading');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1017);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x20262e, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(12, 20, 10); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.entries({ left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 }).forEach(([k, v]) => { sun.shadow.camera[k] = v; });
sun.shadow.bias = -0.0005;
scene.add(sun);

// the hangar floor: dark, a metre grid, a lighter line every 5 m
scene.fog = new THREE.Fog(0x0b1017, 45, 170);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x1a2129, roughness: 0.85, metalness: 0.1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(60, 60, 0x3a4a5c, 0x26313d); grid.position.y = 0.002; scene.add(grid);
const grid5 = new THREE.GridHelper(60, 12, 0x4f6a86, 0x4f6a86); grid5.position.y = 0.003; scene.add(grid5);

// a person 1.8 m tall, to show the ship's size
const person = new THREE.Group();
{
  const m = new THREE.MeshStandardMaterial({ color: 0xd7dde4, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.95, 6, 14), m); body.position.y = 0.2 + 0.475 + 0.15; body.scale.set(1, 1, 0.75);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), m); head.position.y = 1.68;
  for (const o of [body, head]) { o.castShadow = true; person.add(o); }
}
scene.add(person);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 1.5; controls.maxDistance = 80;

// ── the ships ──
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const loaded = new Map();
let ship = null, cur = null, xray = false;
async function loadShip(S) {
  if (loaded.has(S.id)) return loaded.get(S.id);
  const g = await loader.loadAsync(`../../assets/ships/${S.file}`);
  const model = g.scene, box0 = new THREE.Box3().setFromObject(model), size0 = box0.getSize(new THREE.Vector3());
  const holder = new THREE.Group(); holder.add(model);
  holder.rotation.y = S.turn; holder.scale.setScalar(S.len / size0.x);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder), c = box.getCenter(new THREE.Vector3());
  holder.position.set(-c.x, -box.min.y, -c.z);
  let tris = 0;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    o.userData.mat = o.material;                                     // (its own material, and a see-through copy)
    o.userData.xray = Object.assign(o.material.clone(), { transparent: true, opacity: 0.22, depthWrite: false });
  });
  holder.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  const rec = { holder, model, tris, size };
  loaded.set(S.id, rec);
  return rec;
}
function setXray(on) {
  xray = on;
  if (ship) ship.model.traverse((o) => { if (o.isMesh) { o.material = on ? o.userData.xray : o.userData.mat; o.castShadow = !on; } });
}
async function show(S) {
  loading.hidden = false; loading.classList.add('soft');
  const rec = await loadShip(S);
  if (ship) scene.remove(ship.holder);
  ship = rec; cur = S; scene.add(rec.holder); setXray(xray);
  person.position.set(rec.size.x / 2 + 0.9, 0, 1.0);                 // (beside the ship's left, about mid-ship)
  history.replaceState(null, '', `?ship=${S.id}`);
  view(curView);
  drawMenu();
  loading.hidden = true;
}

// ── the views (his picture's angles): the ship's nose is +z, its left +x ──
const VIEWS = {
  Hero: [1.0, 0.45, 1.0], Side: [1, 0.05, 0], Front: [0, 0.12, 1], Rear: [0, 0.12, -1], Top: [0.001, 1, 0],
};
let curView = 'Hero';
function view(name) {
  curView = name;
  if (!ship) return;
  const s = ship.size, R = Math.max(s.x, s.z, s.y * 2) * 0.5, d = new THREE.Vector3(...VIEWS[name]).normalize();
  const fit = R / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.aspect < 1 ? 1.35 / camera.aspect : 1.15);
  controls.target.set(0, s.y * 0.42, 0);
  camera.position.copy(controls.target).addScaledVector(d, fit);
  controls.update();
}

// ── the menu: the ships; then the views, see-through and the person ──
const items = document.getElementById('items'), tabs = document.getElementById('tabs');
const chip = (label, on, fn, sub) => { const b = document.createElement('button'); b.className = 'chip' + (sub ? ' sub' : '') + (on ? ' on' : ''); b.textContent = label; b.onclick = fn; return b; };
const label = (t) => { const s = document.createElement('span'); s.className = 'kl-label'; s.textContent = t; return s; };
function drawMenu() {
  items.replaceChildren(...SHIPS.map((S) => chip(S.name, S === cur, () => show(S))));
  tabs.replaceChildren(label('View'), ...Object.keys(VIEWS).map((v) => chip(v, v === curView, () => { view(v); drawMenu(); }, true)),
    Object.assign(document.createElement('span'), { className: 'kl-sep' }),
    chip('See-through', xray, () => { setXray(!xray); drawMenu(); }, true),
    chip('Person', person.visible, () => { person.visible = !person.visible; drawMenu(); }, true));
  document.documentElement.style.setProperty('--bar', document.getElementById('bar').offsetHeight + 'px');
}

// ── W A S D: move the view (Space up, C down, Shift faster) ──
const keys = new Set();
addEventListener('keydown', (e) => { if (e.target.tagName !== 'INPUT') { keys.add(e.code); if (e.code === 'Space') e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.code));
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Vector3();
function fly(dt) {
  if (!keys.size) return;
  camera.getWorldDirection(_f); _f.y = 0; _f.normalize(); _r.crossVectors(_f, camera.up).normalize();
  _m.set(0, 0, 0);
  if (keys.has('KeyW')) _m.add(_f); if (keys.has('KeyS')) _m.sub(_f);
  if (keys.has('KeyD')) _m.add(_r); if (keys.has('KeyA')) _m.sub(_r);
  if (keys.has('Space')) _m.y += 1; if (keys.has('KeyC')) _m.y -= 1;
  if (!_m.lengthSq()) return;
  _m.normalize().multiplyScalar(dt * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 14 : 5));
  camera.position.add(_m); controls.target.add(_m);
}

// ── the frame ──
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
let last = performance.now(), fpsT = 0, frames = 0, fps = 0;
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  fly(dt); controls.update(); renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  if (ship) hud.textContent = `${cur.name} — ${ship.size.z.toFixed(1)} × ${ship.size.x.toFixed(1)} × ${ship.size.y.toFixed(1)} m (long, wide, tall) · ${Math.round(ship.tris).toLocaleString()} tris · ${fps} fps`;
});

const want = new URLSearchParams(location.search).get('ship');
await show(SHIPS.find((S) => S.id === want) || SHIPS[0]);
window.SHIPLAB = { ready: true };
