// THE SHIP LAB: a ship's outside at true size, the space inside it, and blueprints of its rooms drawn on that space.
//   The outside: a model generated (Meshy, image to 3D) from the game's maker's picture, made light for the web and
//     placed in the files at true size, nose +z, its left (port) +x, its feet on y 0 (space-station/assets/ships/).
//   The space inside: measured from the model as a solid, next to it (<shell>.space.json): the floor at the door's
//     sill, the clear height over every 0.1 m, the outlines at the floor, head height and the ceiling.
//   The blueprints: rooms, doors and furniture as data (space-station/kit/ships/<id>.blueprint.json; blueprint.js
//     says what is in one and holds the checks), drawn on the plan and the side section and as boxes in 3D, checked
//     live as they are edited.
// ONE MENU along the bottom. In 3D: drag to look round, wheel or pinch to come closer, W A S D move (Space up, C down,
// Shift faster). On the plan: drag walls, furniture and doors; tap to select; drag elsewhere to move it, wheel or pinch
// to zoom, double-click to fit. Edits are kept in this browser; Download saves the blueprint as a file.
//   BUILT SHIPS: made from smart meshes as the kit's own parts (kit/ships/<ship>-built.js, sharing built-common.js),
//     each loaded as a layout file (kit/rooms/ship-<ship>-built.json) through the kit's layout code, so its doors and
//     movers work. Each ship's module says which controls it has (its LAB: controls, close views, materials, jets, how
//     its parts follow the menu). Explorer C ("Built"): Gear up / down folds the landing legs into their wells (then
//     shuts the wells' doors), Door open / shut swings the airstair door down to the ground; Show "Meshy B" lays Meshy
//     B over it, see-through. The Miner ("Miner (built)"): Arms stowed / reaching (the cutter heads spin when
//     reaching), Thrusters (the corner pods swivel and fire), Canisters on / off (the eight ore canisters on their
//     mounts), Door (the belly lift's door), Gear. The Medic ("Medic (built)"): Ramps down / up (each ramp unfolds as it
//     comes down), Ramp: both sides or one (port; the starboard opening sealed, cabinets along it inside), Door (the
//     crew doors' airstairs), Gear. All: Dirt sets the grime over the clean paint; Throttle runs the
//     engines up (plume.js, the jet: Off nothing, the nozzles dark; Idle a dull orange, up through bright orange and
//     white-yellow to blue at Afterburn), easing to the new setting.
//   ?ship=built|miner|medic|explorer-b|explorer-a  ?bp=<blueprint id>  ?view=3d|split|plan|both
//   ?look=light|warm  ?level=asnow|darker|darkest (the Light look's light level; the menu's Light chips)
//   window.SHIPLAB = { ready, options, option(id), ship(id), view(v), cam(c), hull(h), show(k, on), result(), bp(),
//     gear(up), door(open), dirt(amount), throttle(v, now) (v a setting's name or 0 to 1; now: no easing), arms(reach),
//     thrusters(on), canisters(on), ramps(down), rampCount('one' | 'both'), moving(), jets(), shipFor(shell) (the ship whose shell that is: a blueprint's own),
//     bloom(on) (the light strips' glow: ?bloom=1 or 0; off by default on a phone), pools(on) (their pools of real-time
//     light in the room the eye is in: ?pools=1 or 0, else as the glow), fps(), draw() (one frame, as the loop draws it) }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { checkBlueprint, ROOM_KINDS, ITEM_KINDS, doorWall, wallsAt, snap, hangs, HEAD, CEIL } from './blueprint.js';
import { Plan } from './plan.js';
import { buildRoom, updateDoors, setDoors, loadRoom, forgetPiece } from '../../kit/layout.js';
import { PIECES } from '../../kit/catalog.js';
import { buildCabin, LOOKS, cabinMaterials } from '../../kit/ships/cabin-built.js';
import { makeMaterials } from '../../kit/materials.js';
import { setThrottle, THROTTLE, ENGINE } from '../../kit/ships/built-common.js';
import { makeJets } from '../../kit/ships/plume.js';
import { makeBeams } from '../../kit/beams.js';
import * as EB from '../../kit/ships/explorer-built.js';
import * as MB from '../../kit/ships/miner-built.js';
import * as MD from '../../kit/ships/medic-built.js';

const $ = (s) => document.querySelector(s), q = new URLSearchParams(location.search);
// the ships: each a prepared shell (its .glb and .space.json in assets/ships), or a layout built by the kit (its
// .space.json measured from it)
// (a built ship: lab, its module's LAB; and each ship's blueprints, bps)
const EXPLORER_BPS = ['explorer-c-plan', 'explorer-c-row', 'explorer-c-side'], MINER_BPS = ['miner-mess-forward', 'miner-bunks-forward', 'miner-ore-cockpit'];
const MEDIC_BPS = ['medic-bunks-across', 'medic-side-by-side', 'medic-one-ramp'];
const SHIPS = [
  { id: 'built', name: 'Built', layout: 'ship-explorer-built', shell: 'explorer-built', lab: EB.LAB, bps: EXPLORER_BPS, note: 'Explorer C built from the 3k smart mesh: flat paint, a glass canopy, the airstair door, gear that folds away' },
  { id: 'miner', name: 'Miner (built)', layout: 'ship-miner-built', shell: 'miner-built', lab: MB.LAB, bps: MINER_BPS, note: 'The Miner built from the 3k smart mesh with the 8k\'s engine, canisters, arms and thruster pods: arms that fold, pods that swivel, eight canisters on their mounts, the belly lift' },
  { id: 'medic', name: 'Medic (built)', layout: 'ship-medic-built', shell: 'medic-built', lab: MD.LAB, bps: MEDIC_BPS, note: 'The Medic built from the 3k smart mesh with its own ring engines and the 8k\'s legs: a ramp in each side opening into the med bay (or one, the other sealed), a crew door each side, legs that rise into the belly' },
  { id: 'explorer-b', name: 'Meshy B', shell: 'explorer-meshy-b', bps: EXPLORER_BPS, note: 'Explorer C from his 3/4 view' },
  { id: 'explorer-a', name: 'Meshy A', shell: 'explorer-meshy-a', bps: EXPLORER_BPS, note: 'Explorer C from his four views' },
];
const OPTIONS = [...new Set(SHIPS.flatMap((S) => S.bps))];
// (the dirt's settings: the ship's own, or the Explorer's)
const dirtOf = () => st.ship?.lab?.dirt || EB.LAB.dirt;
const VIEWS = { '3d': '3D', split: '3D + plan', plan: 'Plan', both: 'Plan + side' };
const CAMS = { Hero: [1, 0.45, 1], Side: [1, 0.05, 0], Front: [0, 0.12, 1], Rear: [0, 0.12, -1], Top: [0.001, 1, 0], Above: [0.55, 1.15, 0.7] };
const HULLS = { solid: 'Solid', plain: 'Plain', wire: 'Wireframe', xray: 'See-through', hidden: 'Hidden' };
// (Plain: the shape alone, no paint; Wireframe: every triangle, to judge where the model spends them)
const PLAIN = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.55, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const WIRE = new THREE.LineBasicMaterial({ color: 0x14202c, transparent: true, opacity: 0.55 });
const WIREFILL = new THREE.MeshBasicMaterial({ color: 0x14202c, wireframe: true, transparent: true, opacity: 0.55 });
const st = {
  ship: null, shell: null, space: null, opt: null, bp: null, stock: {}, edits: {}, result: null, sel: null,
  view: VIEWS[q.get('view')] ? q.get('view') : 'split', cam: 'Hero', hull: 'xray', show: { space: true, rooms: true, checks: true, person: true, meshy: false }, undo: [], pending: false,
  gear: 'down', door: 'shut', dirt: 'Some', throttle: 'Off', throttleT: 0, arms: 'reaching', thrusters: false, canisters: true, ramps: 'up', rampCount: 'both',
  // (the cabin built inside from the blueprint: shown, its look, its ceilings, its doors (auto: they open as the eye or
  // the person comes near), a pose holding them part open)
  inside: q.get('inside') !== '0', look: LOOKS[q.get('look')] ? q.get('look') : 'light', roof: true, beams: q.get('beams') !== '0', cabinDoors: 'auto', doorsAt: null,
  // (the look's light level, where it has levels (the Light look: kit/ships/cabin-built.js LEVELS); null: the look's own)
  level: q.get('level') || null,
  // (the light strips' glow: a bloom pass over the picture; on by default but on a phone (?bloom=1 or 0 to choose))
  bloom: q.has('bloom') ? q.get('bloom') === '1' : !matchMedia('(pointer: coarse)').matches,
  // (the pools of light by the strips of the room the eye is in: a few real-time lights, kit/ships/cabin-built.js POOLS;
  // with the glow unless ?pools=1 or 0)
  pools: q.has('pools') ? q.get('pools') === '1' : q.has('bloom') ? q.get('bloom') === '1' : !matchMedia('(pointer: coarse)').matches,
};

// ── renderer, scene, camera ───────────────────────────────────────────────────────────────────────────────────────
const canvas = $('#c'), hud = $('#hud'), loading = $('#loading');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: q.has('rig') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1017);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x20262e, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(12, 20, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
Object.entries({ left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 }).forEach(([k, v]) => { sun.shadow.camera[k] = v; });
scene.add(sun);
// the hangar floor: dark, a metre grid, a lighter line every 5 m
scene.fog = new THREE.Fog(0x0b1017, 45, 170);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x1a2129, roughness: 0.85, metalness: 0.1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(60, 60, 0x3a4a5c, 0x26313d); grid.position.y = 0.002; scene.add(grid);
const grid5 = new THREE.GridHelper(60, 12, 0x4f6a86, 0x4f6a86); grid5.position.y = 0.003; scene.add(grid5);
// a person 1.8 m tall, to show the ship's size (by the ship's door)
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
// ── the glow: a bloom pass (the Kit Lab's) catching the light strips, when st.bloom ──
let composer = null;
function setBloom(on) {
  st.bloom = !!on;
  if (st.bloom && !composer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2()).max(new THREE.Vector2(2, 2));
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.38, 2.0)); composer.addPass(new OutputPass());
    composer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight);
  } else if (!st.bloom && composer) { composer.dispose(); composer = null; }
}
// ── the pools: POOL_N real-time lights, set where the cabin's pools are in the room the eye is in (none outside the
// cabin); in the scene only while st.pools, as every lit surface pays for them ──
const POOL_N = 10, poolLights = Array.from({ length: POOL_N }, () => new THREE.PointLight(0xffffff, 0, 2, 2));
let poolKey = null;
function setPools(on) { st.pools = !!on; for (const L of poolLights) { if (st.pools) scene.add(L); else scene.remove(L); } poolKey = null; }
function updatePools() {
  if (!st.pools) return;
  const P = st.cabin?.parts?.pools, deck = st.space?.deck ?? 0, c = camera.position;
  const r = P && st.bp ? st.bp.rooms.find((R) => c.x >= R.rect[0] && c.x <= R.rect[2] && c.z >= R.rect[1] && c.z <= R.rect[3] && c.y > deck - 0.3 && c.y < deck + 3.2) : null;
  const key = (r?.id ?? '-') + '|' + (st.cabin?.key ?? ''); if (key === poolKey) return; poolKey = key;
  const mine = r ? P.filter((p) => p.room === r.id).sort((a, b) => b.i - a.i).slice(0, POOL_N) : [];
  poolLights.forEach((L, i) => { const p = mine[i]; L.intensity = p ? p.i : 0; if (!p) return; L.position.set(p.at[0], p.at[1] + deck, p.at[2]); L.color.setRGB(...p.color); L.distance = p.reach; });
}
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 1.5; controls.maxDistance = 80;
const BP3 = new THREE.Group(); scene.add(BP3);

// ── loading a ship: its shell and the space measured inside it ───────────────────────────────────────────────────
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const shells = new Map();
const spaceOf = (S) => fetch(`../../assets/ships/${S.shell}.space.json`).then((r) => { if (!r.ok) throw new Error('Ship Lab: no space file for ' + S.shell); return r.json(); });
// a ship that is a layout: built by the kit's own layout code (its doors and movers with it), in its grime materials
async function loadBuilt(S, inside) {
  const [room, space] = await Promise.all([loadRoom(`../../kit/rooms/${S.layout}.json`), spaceOf(S)]);
  // (with the cabin inside: the pieces it changes, swapped for their cabin variants)
  const swap = inside && S.lab.cabin?.swap;
  if (swap) room.pieces = room.pieces.map((pl) => (swap[pl.piece]?.[pl.variant] ? { ...pl, variant: swap[pl.piece][pl.variant] } : pl));
  const built = buildRoom(room, S.lab.materials(makeMaterials(), (S.lab.dirt || EB.LAB.dirt)[st.dirt]), { bake: { voxel: 0.08, rays: 24 } });
  const holder = new THREE.Group(), model = built.group; holder.add(model);
  // (its jets: plume.js, laid in its nozzles, the throttle's; and its thrusters' own, if it has them)
  const jets = (S.lab.jets?.() || []).map((J) => ({ role: J.role, set: makeJets(J.nozzles, J.opts) }));
  for (const J of jets) holder.add(J.set.group);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.mat = o.material;
    o.userData.xray = o.material.name === 'glass' ? o.material : new THREE.MeshStandardMaterial({ vertexColors: !o.isInstancedMesh && !/glow/.test(o.name), color: /glow/.test(o.name) ? 0x6fc8ff : 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, roughness: 0.6 });
    o.userData.plain = o.material.name === 'glass' ? o.material : PLAIN;
  });
  holder.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  return { holder, model, tris: built.stats.tris, size, space, built, jets };
}
const hasCabin = (S) => !!S?.lab?.cabin;
async function loadShell(S) {
  const inside = hasCabin(S) && st.inside, key = S.id + (inside ? ':inside' : '');
  if (shells.has(key)) return shells.get(key);
  if (S.layout) { const rec = await loadBuilt(S, inside); shells.set(key, rec); return rec; }
  const [g, space] = await Promise.all([loader.loadAsync(`../../assets/ships/${S.shell}.glb`), spaceOf(S)]);
  const model = g.scene, holder = new THREE.Group(); holder.add(model);
  // (a prepared shell is placed in its file; an older one lies along x, nose -x: turned, scaled to 17.3 m, stood up)
  if (!model.userData.shipPrep) {
    const b0 = new THREE.Box3().setFromObject(model), s0 = b0.getSize(new THREE.Vector3());
    holder.rotation.y = Math.PI / 2; holder.scale.setScalar(17.3 / s0.x); holder.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(holder), c = b.getCenter(new THREE.Vector3()); holder.position.set(-c.x, -b.min.y, -c.z);
  }
  let tris = 0;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    o.userData.mat = o.material;                                     // (its own material, and a see-through copy)
    o.userData.xray = Object.assign(o.material.clone(), { transparent: true, opacity: 0.2, depthWrite: false });
    o.userData.plain = PLAIN;
  });
  holder.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  const rec = { holder, model, tris, size, space };
  shells.set(key, rec); return rec;
}
function setHull(mode) {
  st.hull = mode;
  if (!st.shell) return;
  st.shell.holder.visible = mode !== 'hidden';
  st.shell.model.traverse((o) => {
    if (!o.isMesh || !o.userData.mat) return;   // (not a wireframe's own mesh: it keeps its wire material)
    o.material = mode === 'xray' ? o.userData.xray : mode === 'plain' || mode === 'wire' ? o.userData.plain : o.userData.mat;
    o.castShadow = (mode === 'solid' || mode === 'plain' || mode === 'wire') && o.material.name !== 'glass'; o.renderOrder = mode === 'xray' ? 10 : o.material.name === 'glass' ? 2 : 0;
    // (the wireframe: every triangle's edges, made the first time it's asked for, lifted a hair so it shows over the faces;
    // a moving part's (an instanced mesh) is a wireframe copy of it that moves with it)
    if (mode === 'wire' && !o.userData.wire) {
      if (o.isInstancedMesh) { const w = new THREE.InstancedMesh(o.geometry, WIREFILL, o.count); w.instanceMatrix = o.instanceMatrix; w.frustumCulled = false; o.userData.wire = w; o.parent.add(w); }
      else { o.userData.wire = new THREE.LineSegments(new THREE.WireframeGeometry(o.geometry), WIRE); o.add(o.userData.wire); }
    }
    if (o.userData.wire) o.userData.wire.visible = mode === 'wire';
  });
}
async function showShip(S) {
  loading.hidden = false; loading.classList.add('soft');
  const rec = await loadShell(S);
  if (st.shell) scene.remove(st.shell.holder);
  st.ship = S; st.shell = rec; st.space = rec.space; scene.add(rec.holder); setHull(st.hull);
  const d = st.space.doors?.port, bd = st.space.doors?.belly;
  person.position.set(bd ? bd.x[1] + 0.9 : d ? d.face + 1.2 : rec.size.x / 2 + 0.9, 0, bd ? (bd.z[0] + bd.z[1]) / 2 + 1.6 : d ? (d.z[0] + d.z[1]) / 2 - (S.layout ? 2.4 : 1.6) : 1);
  if (!S.lab?.overlay && st.show.meshy) { st.show.meshy = false; }
  if (S.lab) S.lab.setDirt((S.lab.dirt || EB.LAB.dirt)[st.dirt]);
  // (its own blueprints: the one shown stays if it is one of them)
  if (S.bps && !S.bps.includes(st.opt) && st.opt !== 'uploaded') showOption(S.bps[0]);
  await showMeshy();
  plan.hFor = null; recheck(true); await showCabin(); setCam(st.cam); url(); menu();
  loading.hidden = true;
}
// Meshy B laid over the built ship, see-through, to compare (its own shell, a see-through copy of its paint)
let meshyOver = null;
async function showMeshy() {
  const on = st.show.meshy && st.ship?.lab?.overlay;
  if (on && !meshyOver) {
    const rec = await loadShell(SHIPS.find((S) => S.id === 'explorer-b')), holder = new THREE.Group();
    rec.holder.updateMatrixWorld(true);
    rec.model.traverse((o) => {
      if (!o.isMesh) return;
      const m = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ map: o.userData.mat?.map || null, transparent: true, opacity: 0.3, depthWrite: false }));
      m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); m.renderOrder = 12; holder.add(m);
    });
    meshyOver = holder;
  }
  if (meshyOver) { if (on) scene.add(meshyOver); else scene.remove(meshyOver); }
}

// ── the cabin: the rooms built inside the ship from the blueprint shown (kit/ships/cabin-built.js), with the kit's
// layout code like the ship (its own materials: no grime inside); its ceilings a zone of their own, so Ceilings off
// lifts them away to look in from above. One built cabin per blueprint and look is kept (the last few).
let cabinSeq = 0, cabinMats = {};
const cabins = new Map();
const cabinOn = () => hasCabin(st.ship) && st.inside && st.bp && (!st.bp.shell || st.bp.shell === st.ship.shell);
const levelOf = (look) => (LOOKS[look].levels ? (LOOKS[look].levels[st.level] ? st.level : LOOKS[look].level) : null);
function cabinFor(S, bp, look) {
  const level = levelOf(look), lk = look + (level ? ':' + level : ''), key = S.id + '|' + lk + '|' + JSON.stringify(bp);
  if (cabins.has(key)) return cabins.get(key);
  const id = 'cabin' + (++cabinSeq), space = st.space, L = LOOKS[look], parts = {};
  PIECES[id] = { name: 'Cabin: ' + (bp.name || bp.id), group: 'Ships', at: 'free', variants: ['walls', 'ceilings'], foot: [5, 2.5, 10], build: (p, v) => { buildCabin(p, bp, { space, which: v, outer: S.lab.cabin.outer, look, level }); Object.assign(parts, p.stats); if (p.runs?.length) parts.runs = p.runs; parts.seesOutside = p.seesOutside; parts.pools = [...(parts.pools || []), ...(p.pools || [])]; parts.beams = [...(parts.beams || []), ...(p.beams || [])]; parts.lightList = [...(parts.lightList || []), ...(p.lightList || [])]; } };
  // (the cabin's own materials: lit by its strips, little of the lab's sky light let in, the floor tinted for the look,
  // less of a mirror than the station's)
  if (!cabinMats[lk]) cabinMats[lk] = cabinMaterials(look, level);
  const room = { name: 'cabin', grid: { cell: 0.5, step: 0.5, deck: space.deck }, rooms: ['walls', 'ceilings'].map((v) => ({ id: v, pieces: [{ piece: id, cell: [0, 0], turn: 0, level: 0, variant: v }] })) };
  // (baked without shadows: on the bake's 8 cm grid a 45-degree slope fills its cells in steps thick enough that its own
  // points start inside them, so it shadows itself from every light; the corner darkening stays)
  const built = buildRoom(room, cabinMats[lk], { bake: { voxel: 0.08, rays: 24, shadows: false } });
  delete PIECES[id]; forgetPiece(id);
  const rec = { key, built, group: built.group, tris: built.stats.tris, perZone: built.stats.perZone, parts };
  // (the beams of light with dust in them, under the ceilings' discs: kit/beams.js, two draws for the whole cabin; the
  // list is in the cabin's own frame, deck at 0)
  rec.beams = makeBeams(parts.beams); rec.beams.object.position.y = space.deck - built.group.position.y; built.group.add(rec.beams.object); rec.beams.set(st.beams);
  cabins.set(key, rec);
  // (keep the last four)
  while (cabins.size > 4) { const [k, old] = cabins.entries().next().value; if (old === st.cabin) break; scene.remove(old.group); old.built.dispose(); old.beams.dispose(); cabins.delete(k); }
  return rec;
}
async function showCabin() {
  const want = cabinOn() ? cabinFor(st.ship, st.bp, st.look) : null;
  if (st.cabin && st.cabin !== want) scene.remove(st.cabin.group);
  st.cabin = want;
  if (want) { scene.add(want.group); want.beams.set(st.beams); for (const z of want.built.zones) z.group.visible = z.id !== 'ceilings' || st.roof; if (st.doorsAt != null) setDoors(want.built.doors, st.doorsAt); }
  build3d();
}
let cabinTimer = 0;
// (after an edit: the cabin again, a moment later, so a run of edits builds it once)
function cabinSoon() { clearTimeout(cabinTimer); cabinTimer = setTimeout(() => { showCabin(); menu(); }, 350); }
// THE CAMERAS IN THE ROOMS: one at eye height (1.6 m over its floor) in each room the cabin builds; and Row: from
// engineering's back wall along the middle line, through every door to the cockpit (with the doors open)
const EYE = 1.6, EYE_FOV = 72;
// (each room's: the blueprint's own spot for it (its `eyes`), or standing on the free spot farthest from the middle of
// its furniture, looking across at it, a little down)
function roomSpots() {
  if (!cabinOn()) return {};
  const out = {}, deck = st.space.deck, bp = st.bp;
  for (const r of bp.rooms) {
    if (r.ceiling === 'canopy') continue;
    const [x0, z0, x1, z1] = r.rect, f = deck + (r.floor || 0) + EYE, name = (r.name || r.id).split(/[ /]/)[0];
    const own = bp.eyes?.[r.id];
    if (own) { out[name] = { at: [own.at[0], f, own.at[1]], look: [own.look[0], f - 0.35, own.look[1]], fov: EYE_FOV, room: r.id }; continue; }
    const its = (bp.items || []).filter((it) => it.room === r.id), stands = its.filter((it) => !+(it.y || 0));
    const mid = its.length ? its.reduce((m, it) => [m[0] + (it.rect[0] + it.rect[2]) / 2 / its.length, m[1] + (it.rect[1] + it.rect[3]) / 2 / its.length], [0, 0]) : [(x0 + x1) / 2, z0];
    let best = null;
    for (let x = x0 + 0.3; x <= x1 - 0.3 + 1e-6; x += 0.25) for (let z = z0 + 0.3; z <= z1 - 0.3 + 1e-6; z += 0.25) {
      if (stands.some((it) => x > it.rect[0] - 0.25 && x < it.rect[2] + 0.25 && z > it.rect[1] - 0.25 && z < it.rect[3] + 0.25)) continue;
      const d = Math.hypot(mid[0] - x, mid[1] - z); if (!best || d > best.d) best = { d, e: [x, z] };
    }
    if (!best || best.d < 0.3) continue;
    const k = Math.max(2.2, best.d) / best.d, look = [best.e[0] + (mid[0] - best.e[0]) * k, f - 0.55, best.e[1] + (mid[1] - best.e[1]) * k];
    out[name] = { at: [best.e[0], f, best.e[1]], look, fov: EYE_FOV, room: r.id };
  }
  const zs = bp.rooms.filter((r) => r.ceiling !== 'canopy').map((r) => r.rect[1]);
  out.Row = { at: [0, deck + EYE, Math.min(...zs) + 0.3], look: [0, deck + EYE - 0.1, 6.0], fov: 50, row: true };
  return out;
}

// ── the blueprints: the three options (and edits kept in this browser) ───────────────────────────────────────────
const clone = (o) => JSON.parse(JSON.stringify(o));
async function loadOptions() {
  await Promise.all(OPTIONS.map(async (id) => { const r = await fetch(`../../kit/ships/${id}.blueprint.json`); if (!r.ok) throw new Error('Ship Lab: no blueprint ' + id); st.stock[id] = await r.json(); }));
  try { const saved = JSON.parse(localStorage.getItem('shiplab.edits') || '{}'); for (const [k, v] of Object.entries(saved)) if (v?.rooms) st.edits[k] = v; } catch (e) { /* (no storage here: edits last until the page closes) */ }
}
function saveEdits() { try { localStorage.setItem('shiplab.edits', JSON.stringify(st.edits)); } catch (e) { /* (as above) */ } }
const isEdited = (id) => !!st.edits[id];
function showOption(id) {
  st.opt = id; st.bp = st.edits[id] || clone(st.stock[id]); st.sel = null; st.undo = [];
  if (st.bp?.ramps) st.rampCount = st.bp.ramps;   // (a blueprint drawn for one ramp, or both: the ship's ramps follow it)
  recheck(true); url(); menu();
}
function recheck(rebuild) {
  if (!st.bp || !st.space) return;
  st.result = checkBlueprint(st.bp, st.space);
  plan.draw(); panel(); if (rebuild) { build3d(); if (hasCabin(st.ship)) cabinSoon(); }
}
// an edit: a copy kept for Undo first (once per drag), then the change, the checks again
function edit(fn, live) {
  if (!st.pending) { st.undo.push(JSON.stringify(st.bp)); if (st.undo.length > 60) st.undo.shift(); }
  st.pending = !!live;
  fn(st.bp);
  st.edits[st.opt] = st.bp;
  recheck(!live); if (!live) { saveEdits(); menu(); }
}
function commit() { st.pending = false; recheck(true); saveEdits(); menu(); }
function undo() { const s = st.undo.pop(); if (!s) return; st.bp = JSON.parse(s); st.edits[st.opt] = st.bp; saveEdits(); recheck(true); menu(); }
function resetOption() { if (!st.stock[st.opt]) return; delete st.edits[st.opt]; saveEdits(); showOption(st.opt); }
function select(sel) { st.sel = sel; plan.draw(); panel(); menu(); }

// ── the blueprint in 3D: room floors and walls as see-through boxes, furniture as solid boxes, the doors' frames ─────
const matCache = new Map();
const mat = (key, make) => { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); };
function build3d() {
  for (const o of [...BP3.children]) { BP3.remove(o); o.geometry?.dispose(); if (o.isGroup) o.traverse((c) => c.geometry?.dispose()); }
  if (!st.bp || !st.space) return;
  const deck = st.space.deck, bp = st.bp, built = !!st.cabin;   // (the cabin built: its own walls and furniture boxes)
  if (st.show.rooms) {
    for (const r of bp.rooms) {
      const K = ROOM_KINDS[r.kind] || { color: '#888888' }, [x0, z0, x1, z1] = r.rect, f = deck + (r.floor || 0), top = typeof r.ceiling === 'number' ? r.ceiling : r.ceiling === 'canopy' ? HEAD : CEIL;
      const fl = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.04, z1 - z0), mat('rf' + K.color, () => new THREE.MeshBasicMaterial({ color: K.color, transparent: true, opacity: 0.55, depthWrite: false })));
      fl.position.set((x0 + x1) / 2, f + 0.02, (z0 + z1) / 2); BP3.add(fl);
      const box = new THREE.BoxGeometry(x1 - x0, top, z1 - z0);
      const walls = new THREE.Mesh(box, mat('rw' + K.color, () => new THREE.MeshBasicMaterial({ color: K.color, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide })));
      walls.position.set((x0 + x1) / 2, f + top / 2, (z0 + z1) / 2); if (!built) BP3.add(walls);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), mat('re' + K.color, () => new THREE.LineBasicMaterial({ color: K.color })));
      edges.position.copy(walls.position); BP3.add(edges);
    }
    for (const it of built ? [] : bp.items || []) {
      const K = ITEM_KINDS[it.kind] || { color: '#999999' }, r = bp.rooms.find((q) => q.id === it.room), f = deck + (r?.floor || 0) + +(it.y || 0), [x0, z0, x1, z1] = it.rect;
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 0.02, it.h, z1 - z0 - 0.02), mat('it' + K.color, () => new THREE.MeshStandardMaterial({ color: K.color, roughness: 0.7 })));
      m.position.set((x0 + x1) / 2, f + it.h / 2, (z0 + z1) / 2); m.castShadow = true; BP3.add(m);
    }
    for (const d of bp.doors || []) {
      const w = doorWall(bp, d); if (!w) continue;
      // (a hatch: a square in its room's floor)
      if (w.hatch) { const r = bp.rooms.find((q) => q.id === d.rooms[0]), f = deck + (r?.floor || 0), m = new THREE.Mesh(new THREE.BoxGeometry(d.width, 0.06, d.width), mat('do', () => new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.8 }))); m.position.set(w.x, f + 0.03, w.z); BP3.add(m); continue; }
      const r = bp.rooms.find((q) => q.id === d.rooms[0]), f = deck + (r?.floor || 0), outer = d.rooms[1] === 'outside', hgt = outer ? Math.min(2, st.space.doors?.port?.height || 2) : 2;
      const g = new THREE.Mesh(new THREE.BoxGeometry(w.along === 'z' ? 0.08 : d.width, hgt, w.along === 'z' ? d.width : 0.08), mat(outer ? 'do' : 'di', () => new THREE.MeshBasicMaterial({ color: outer ? 0xffb347 : 0xffe08a, transparent: true, opacity: 0.8 })));
      g.position.set(w.along === 'z' ? w.x : d.at[0], f + hgt / 2, w.along === 'z' ? d.at[1] : w.z); BP3.add(g);
    }
  }
  // the marks of the checks that fail, red on the floor
  if (st.show.checks && st.result) for (const m of st.result.marks) {
    if (!m.rect || !['floor', 'head', 'ceiling', 'headroom', 'corridor'].includes(m.check)) continue;
    const [x0, z0, x1, z1] = m.rect, red = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0), mat('bad', () => new THREE.MeshBasicMaterial({ color: 0xff3030 })));
    red.position.set((x0 + x1) / 2, deck + 0.05, (z0 + z1) / 2); BP3.add(red);
  }
  // the space's outlines: at the floor, head height and the ceiling
  if (st.show.space) {
    for (const [k, h, col] of [['floor', 0.03, 0xe8eef5], ['head', HEAD, 0xf2b547], ['ceiling', CEIL, 0x4fd6ff]]) {
      for (const p of st.space.outlines[k]) {
        const pts = p.map(([x, z]) => new THREE.Vector3(x, deck + h, z));
        BP3.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat('ol' + k, () => new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.85 }))));
      }
    }
  }
}

// ── the views: 3D, 3D over the plan, the plan, the plan over the side section ──────────────────────────────────────
const plan = new Plan($('#p'), { data: () => st, select, edit, commit });
function layout() {
  const bar = $('#bar').offsetHeight, top = $('#top').offsetHeight, W = innerWidth, A = Math.max(80, innerHeight - bar);
  document.documentElement.style.setProperty('--bar', bar + 'px'); document.documentElement.style.setProperty('--top', top + 'px');
  $('#panel').style.top = top + 'px';
  const show3d = st.view === '3d' || st.view === 'split', h3 = st.view === 'split' ? Math.round(A * 0.5) : A;
  canvas.style.display = show3d ? 'block' : 'none'; canvas.style.height = h3 + 'px'; canvas.style.width = W + 'px';
  if (show3d) { renderer.setSize(W, h3, false); camera.aspect = W / h3; camera.updateProjectionMatrix(); composer?.setSize(W, h3); }
  if (st.view === '3d') plan.place(0, 0, 0, 0, 'plan');
  else if (st.view === 'split') plan.place(0, h3, W, A - h3, 'plan');
  else plan.place(0, 0, W, A, st.view === 'both' ? 'both' : 'plan');
  plan.draw();
}
function setView(v) { st.view = v; url(); layout(); setCam(st.cam); menu(); }
function setCam(name) {
  st.cam = name; if (!st.shell) return;
  const spot = st.ship.lab?.spots?.[name] || roomSpots()[name], fov = spot?.fov || 40;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (!CAMS[name]) { if (!spot) { setCam('Hero'); return; } camera.position.set(...spot.at); controls.target.set(...spot.look); controls.update(); return; }
  // (how far back: the ship's half-size across the screen and up it, from this side, fitted to the view's shape)
  const s = st.shell.size, d = new THREE.Vector3(...CAMS[name]).normalize(), t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // (and the part of it nearer the eye than its middle: half its depth from this side)
  const [across, up, near] = { Hero: [0.32 * (s.x + s.z), 0.5 * s.y + 2, 0.15 * (s.x + s.z)], Side: [s.z / 2, s.y / 2, s.x * 0.3], Front: [s.x / 2, s.y / 2, s.z / 2], Rear: [s.x / 2, s.y / 2, s.z / 2], Top: [s.z / 2, s.x / 2, s.y / 2], Above: [0.2 * (s.x + s.z), 0.2 * (s.x + s.z), 0] }[name];
  const fit = Math.max(across / (t * camera.aspect), up / t) * 1.1 + near;
  controls.target.set(0, name === 'Above' || name === 'Top' ? st.space.deck + 1 : s.y * 0.42, 0);
  camera.position.copy(controls.target).addScaledVector(d, fit); controls.update();
}
function url() { if (st.ship && st.opt) history.replaceState(null, '', `?ship=${st.ship.id}&bp=${st.opt}&view=${st.view}` + (hasCabin(st.ship) ? (st.inside ? `&look=${st.look}` + (st.level && LOOKS[st.look].levels?.[st.level] && st.level !== LOOKS[st.look].level ? `&level=${st.level}` : '') : '&inside=0') : '')); }

// ── the checks panel ─────────────────────────────────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function panel() {
  const R = st.result; if (!R) return;
  const fails = R.checks.filter((k) => !k.pass).length;
  $('#sum').innerHTML = fails ? `<span class="no">✗ ${fails} of ${R.checks.length} checks fail</span><span>· ${esc(st.bp.name)}</span>` : `<span class="ok">✓ All ${R.checks.length} checks pass</span><span>· ${esc(st.bp.name)}</span>`;
  let h = `<div class="idea">${esc(st.bp.idea || '')}</div>`;
  if (st.bp.shell && st.bp.shell !== st.ship.shell) h += `<div class="idea no">Drawn for ${esc(st.bp.shell)}; checked here against ${esc(st.ship.shell)}.</div>`;
  h += '<ul>' + R.checks.map((k) => `<li><b class="${k.pass ? 'ok' : 'no'}">${k.pass ? '✓' : '✗'} ${esc(k.name)}</b><br><span>${esc(k.detail)}</span></li>`).join('') + '</ul>';
  h += '<h3>Rooms</h3><table>' + R.sizes.map((s) => `<tr><td><span class="sl-swatch" style="background:${ROOM_KINDS[s.kind]?.color || '#888'}"></span>${esc(s.name)}</td><td>${s.l} × ${s.w} m</td><td>${s.area} m²</td><td>${s.ceiling === 'canopy' ? 'canopy' : s.ceiling + ' m'}${s.floor ? ' (+' + s.floor + ')' : ''}</td><td class="${s.ok ? 'ok' : 'no'}">${s.ok ? '' : 'small'}</td></tr>`).join('') + '</table>';
  const kinds = [...new Set((st.bp.items || []).map((i) => i.kind))].filter((k) => ITEM_KINDS[k]);
  h += '<h3>Furniture key</h3><div class="sel">' + kinds.map((k) => `<span class="sl-swatch" style="background:${ITEM_KINDS[k].color}"></span><b>${esc(ITEM_KINDS[k].tag)}</b> ${esc(ITEM_KINDS[k].label)} (${ITEM_KINDS[k].hang ? 'hangs, dashed on the plan' : ITEM_KINDS[k].h + ' m'})`).join(' · ') + '</div>';
  const S = st.sel, o = S && (S.type === 'room' ? st.bp.rooms.find((r) => r.id === S.id) : S.type === 'item' ? st.bp.items.find((i) => i.id === S.id) : st.bp.doors.find((d) => d.id === S.id));
  if (o) {
    h += '<h3>Selected</h3><div class="sel">';
    if (S.type === 'room') h += `${esc(o.name)}: ${o.rect[3] - o.rect[1]} m long, ${o.rect[2] - o.rect[0]} m wide, ceiling ${o.ceiling ?? CEIL}${typeof o.ceiling === 'number' || o.ceiling === undefined ? ' m' : ''}. Drag its walls on the grid.`;
    if (S.type === 'item') h += `${esc(o.name || ITEM_KINDS[o.kind]?.label)} (${esc(ITEM_KINDS[o.kind]?.label || o.kind)}): ${o.rect[3] - o.rect[1]} × ${o.rect[2] - o.rect[0]} m, ${hangs(o) ? `hanging from ${o.y} to ${+o.y + +o.h} m` : o.h + ' m tall'}, in ${esc(st.bp.rooms.find((r) => r.id === o.room)?.name || o.room)}. Drag it; Turn turns it.`;
    if (S.type === 'door') h += `Door ${esc(o.id)}: ${o.width} m wide, between ${esc(o.rooms.join(' and '))}${o.rooms[1] === 'outside' ? '' : (o.leaves ?? 2) === 2 ? ', two leaves parting into the wall' : ', one leaf sliding into the wall'}. Drag it along a wall, or onto another.`;
    h += '</div>';
  }
  $('#panelBody').innerHTML = h;
}

// ── the menu: blueprints and ships; views and what to show; editing ──────────────────────────────────────────────
const chip = (label, on, fn, sub, title) => { const b = document.createElement('button'); b.className = 'chip' + (sub ? ' sub' : '') + (on ? ' on' : ''); b.textContent = label; b.onclick = fn; if (title) b.title = title; return b; };
const lab = (t) => { const s = document.createElement('span'); s.className = 'kl-label'; s.textContent = t; return s; };
const sep = () => Object.assign(document.createElement('span'), { className: 'kl-sep' });
function menu() {
  const opts = (st.ship?.bps || OPTIONS).filter((id) => st.stock[id]).concat(st.edits.uploaded ? ['uploaded'] : []);
  $('#items').replaceChildren(lab('Blueprint'), ...opts.map((id) => chip(((st.edits[id] || st.stock[id])?.name || id) + (isEdited(id) && id !== 'uploaded' ? ' •' : ''), id === st.opt, () => showOption(id))),
    sep(), lab('Ship'), ...SHIPS.map((S) => chip(S.name, S === st.ship, () => showShip(S), false, S.note)));
  const L = st.ship?.lab, has = (k) => !!L?.controls.includes(k), spots = L?.spots || {};
  $('#tabs').replaceChildren(lab('View'), ...Object.entries(VIEWS).map(([k, t]) => chip(t, k === st.view, () => setView(k), true)),
    sep(), lab('Camera'), ...[...Object.keys(CAMS), ...Object.keys(spots), ...Object.keys(roomSpots())].map((k) => chip(k, k === st.cam, () => { setCam(k); if (st.view !== '3d' && st.view !== 'split') setView('split'); menu(); }, true)),
    sep(), lab('Hull'), ...Object.entries(HULLS).map(([k, t]) => chip(t, k === st.hull, () => { setHull(k); menu(); }, true)),
    sep(), lab('Show'), ...[['space', 'Space'], ['rooms', 'Rooms'], ['checks', 'Checks'], ['person', 'Person'], ...(L?.overlay ? [['meshy', 'Meshy B']] : [])].map(([k, t]) => chip(t, st.show[k], () => { show(k, !st.show[k]); menu(); }, true, k === 'meshy' ? 'Meshy B laid over the built ship, see-through' : '')),
    // (the cabin built inside from the blueprint: its look, its ceilings, its doors; and shown or not, last)
    ...(hasCabin(st.ship) ? [sep(), lab('Inside'),
      ...(st.inside ? [...Object.entries(LOOKS).map(([k, L]) => chip(L.name, k === st.look, () => setLook(k), true, k === 'light' ? 'His bunk, mess and science pictures: one light grey, a charcoal floor; warm light in the mess, cool in the lab and bunks' : 'His concept sheet\'s insets: grey steel panels, amber light strips, blue leather')),
        ...(LOOKS[st.look].levels ? [lab('Light'), ...Object.entries(LOOKS[st.look].levels).map(([k, V]) => chip(V.name, k === levelOf(st.look), () => setLevel(k), true, 'How dim the rooms are between their pools of light and glowing strips' + (k === LOOKS[st.look].level ? ' (this one is the game\'s)' : '')))] : []),
        chip('Light beams', st.beams, () => setBeams(!st.beams), true, 'The beams of light under the ceilings\' discs, with dust drifting through them'),
        chip('Ceilings', st.roof, () => setRoof(!st.roof), true, 'Lift the cabin\'s ceilings off to look in from above (with the hull see-through or hidden)'),
        chip('Glow', st.bloom || st.pools, () => { const on = !(st.bloom || st.pools); setBloom(on); setPools(on); menu(); }, true, 'The light strips\' glow and their pools of light (a bloom pass and a few real-time lights in the room you are in; off by default on a phone)'),
        lab('Doors'), ...[['auto', 'Auto'], ['open', 'Open'], ['shut', 'Shut']].map(([k, t]) => chip(t, st.cabinDoors === k && st.doorsAt == null, () => { st.cabinDoors = k; st.doorsAt = null; menu(); }, true, k === 'auto' ? 'The sliding doors open as the eye (or the person) comes near' : k === 'open' ? 'Every sliding door open' : 'Every sliding door shut'))] : []),
      chip(st.inside ? 'Inside off' : 'Inside on', false, () => setInside(!st.inside), true, 'The rooms built inside the ship from the blueprint shown, with the cabin kit\'s walls and sliding doors (furniture as the plan\'s boxes)')] : []),
    // (the built ship's moving parts and its grime: the controls its module names)
    ...(has('arms') ? [sep(), lab('Arms'), chip(st.arms === 'stowed' ? 'Arms reaching' : 'Arms stowed', false, () => { st.arms = st.arms === 'stowed' ? 'reaching' : 'stowed'; menu(); }, true, 'Fold the mining arms in for flight, or reach them out to dig (the cutter heads spin)')] : []),
    ...(has('thrusters') ? [sep(), lab('Thrusters'), chip(st.thrusters ? 'Thrusters off' : 'Thrusters', st.thrusters, () => { st.thrusters = !st.thrusters; menu(); }, true, 'The corner pods swivel and fire')] : []),
    ...(has('canisters') ? [sep(), lab('Canisters'), chip(st.canisters ? 'Canisters off' : 'Canisters on', false, () => { st.canisters = !st.canisters; menu(); }, true, 'The eight ore canisters on their mounts, or the mounts empty')] : []),
    ...(has('ramps') ? [sep(), lab('Ramps'), chip(st.ramps === 'down' ? 'Ramps up' : 'Ramps down', false, () => { st.ramps = st.ramps === 'down' ? 'up' : 'down'; menu(); }, true, 'Lower the ramps to the ground (each unfolds as it comes down), or raise them to close the bay')] : []),
    ...(has('rampCount') ? [lab('Ramp'), ...[['both', 'Both sides'], ['one', 'One (port)']].map(([k, t]) => chip(t, st.rampCount === k, () => { st.rampCount = k; menu(); }, true, k === 'one' ? 'Only the port ramp opens; the starboard opening is sealed, with medical cabinets along it inside' : 'A ramp in each side opening'))] : []),
    ...(has('gear') ? [sep(), lab('Gear'), chip(st.gear === 'up' ? 'Gear down' : 'Gear up', false, () => { st.gear = st.gear === 'up' ? 'down' : 'up'; menu(); }, true, L.gearTip || 'Fold the landing legs into their wells, or let them down')] : []),
    ...(has('door') ? [sep(), lab('Door'), chip(st.door === 'open' ? 'Door shut' : 'Door open', false, () => { st.door = st.door === 'open' ? 'shut' : 'open'; menu(); }, true, L.doorTip || 'Swing the airstair door down to the ground, or up shut')] : []),
    ...(has('dirt') ? [sep(), lab('Dirt'), ...Object.keys(dirtOf()).map((k) => chip(k, k === st.dirt, () => { st.dirt = k; L.setDirt(dirtOf()[k]); menu(); }, true))] : []),
    ...(has('throttle') ? [sep(), lab('Throttle'), ...Object.keys(THROTTLE).map((k) => chip(k, k === st.throttle, () => { st.throttle = k; st.throttleT = THROTTLE[k]; menu(); }, true, k === 'Off' ? 'Engines off: no jet, the nozzles dark' : 'Run the engines up or down to ' + k))] : []));
  const add = document.createElement('select'); add.className = 'sl-add'; add.setAttribute('aria-label', 'Add');
  add.append(new Option('Add…', ''));
  const og = (label, entries) => { const g = document.createElement('optgroup'); g.label = label; for (const [v, t] of entries) g.append(new Option(t, v)); add.append(g); };
  og('Rooms', Object.entries(ROOM_KINDS).map(([k, K]) => ['room:' + k, K.label]));
  og('Furniture', Object.entries(ITEM_KINDS).map(([k, K]) => ['item:' + k, K.label]));
  og('Doors', [['door', 'Door']]);
  add.onchange = () => { if (add.value) addThing(add.value); add.value = ''; };
  const S = st.sel;
  $('#edit').replaceChildren(lab('Edit'), add,
    chip('Turn', false, turnSel, true, 'Turn the selected furniture a quarter'), chip('Name', false, renameSel, true, 'Rename the selected room or furniture'),
    chip('Remove', false, removeSel, true, 'Remove the selected room, furniture or door'), chip('Undo', false, undo, true),
    chip('Reset', false, resetOption, true, 'Back to the blueprint as it came'),
    sep(), chip('Download', false, download, true, 'Save this blueprint as a file'), chip('Upload', false, () => $('#file').click(), true, 'Open a blueprint file'));
  for (const b of $('#edit').querySelectorAll('button')) if (['Turn', 'Name', 'Remove'].includes(b.textContent)) b.disabled = !S || (b.textContent === 'Turn' && S.type !== 'item') || (b.textContent === 'Name' && S.type === 'door');
  requestAnimationFrame(layout);
}
async function setInside(on) { st.inside = !!on; await showShip(st.ship); }
async function setLook(k) { if (!LOOKS[k]) return; st.look = k; loading.hidden = false; await new Promise((r) => setTimeout(r, 30)); await showCabin(); loading.hidden = true; url(); menu(); }
async function setLevel(k) { st.level = k || null; loading.hidden = false; await new Promise((r) => setTimeout(r, 30)); await showCabin(); loading.hidden = true; url(); menu(); }
function setBeams(on) { st.beams = !!on; if (st.cabin) st.cabin.beams.set(st.beams); menu(); }
function setRoof(on) { st.roof = !!on; if (st.cabin) for (const z of st.cabin.built.zones) if (z.id === 'ceilings') z.group.visible = st.roof; menu(); }
function show(k, on) { st.show[k] = on; plan.show.space = st.show.space; plan.show.checks = st.show.checks; person.visible = st.show.person; build3d(); plan.draw(); if (k === 'meshy') showMeshy(); }

// ── editing: add, turn, rename, remove, download, upload ─────────────────────────────────────────────────────────
const uid = (bp, base) => { let n = 1; const ids = new Set([...bp.rooms, ...(bp.items || []), ...(bp.doors || [])].map((o) => o.id)); while (ids.has(base + '-' + n)) n++; return base + '-' + n; };
function viewCentre() { const P = plan.P; return P ? plan.world(P.x + P.w / 2, P.y + P.h / 2) : { x: 0, z: 0 }; }
function addThing(what) {
  const c = viewCentre(); let sel = null;
  edit((bp) => {
    if (what.startsWith('room:')) {
      const kind = what.slice(5), x = snap(c.x, 0.5), z = snap(c.z, 0.5), id = uid(bp, kind);
      bp.rooms.push({ id, name: ROOM_KINDS[kind].label, kind, rect: [x - 1, z - 1, x + 1, z + 1], ceiling: kind === 'cockpit' ? 'canopy' : CEIL }); sel = { type: 'room', id };
    } else if (what.startsWith('item:')) {
      const kind = what.slice(5), K = ITEM_KINDS[kind], id = uid(bp, kind);
      const inRoom = st.sel?.type === 'room' ? bp.rooms.find((r) => r.id === st.sel.id) : bp.rooms.find((r) => c.x > r.rect[0] && c.x < r.rect[2] && c.z > r.rect[1] && c.z < r.rect[3]);
      const cx = inRoom ? (inRoom.rect[0] + inRoom.rect[2]) / 2 : c.x, cz = inRoom ? (inRoom.rect[1] + inRoom.rect[3]) / 2 : c.z;
      let x0 = snap(cx - K.w / 2, 0.25); const z0 = snap(cz - K.d / 2, 0.25);
      // (a hanging item: against the nearer side wall of its room, at its kind's height)
      if (K.hang && inRoom) x0 = c.x > cx ? inRoom.rect[2] - K.w : inRoom.rect[0];
      (bp.items ||= []).push({ id, kind, room: inRoom?.id || bp.rooms[0]?.id, rect: [x0, z0, x0 + K.w, z0 + K.d], h: K.h, ...(K.hang ? { y: K.y } : {}), name: K.label }); sel = { type: 'item', id };
    } else if (what === 'door') {
      const hits = wallsAt(bp, c.x, c.z, 6); if (!hits.length) return;
      const b = hits[0], id = uid(bp, 'door'), at = b.along === 'z' ? [b.x, snap(c.z, 0.25)] : [snap(c.x, 0.25), b.z];
      const on = hits.filter((h) => h.along === b.along && Math.abs((h.x ?? h.z) - (b.x ?? b.z)) < 1e-6).map((h) => h.room);
      (bp.doors ||= []).push({ id, rooms: [on[0], on[1] || on[0]], at, width: 0.8 }); sel = { type: 'door', id };
    }
  });
  if (sel) select(sel);
}
function turnSel() {
  if (st.sel?.type !== 'item') return;
  edit((bp) => { const it = bp.items.find((i) => i.id === st.sel.id); if (!it) return; const [x0, z0, x1, z1] = it.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = z1 - z0, L = x1 - x0, nx = snap(cx - W / 2, 0.25), nz = snap(cz - L / 2, 0.25); it.rect = [nx, nz, nx + W, nz + L]; });
}
function renameSel() {
  const S = st.sel; if (!S || S.type === 'door') return;
  const o = S.type === 'room' ? st.bp.rooms.find((r) => r.id === S.id) : st.bp.items.find((i) => i.id === S.id); if (!o) return;
  const name = prompt('Name', o.name || ''); if (name == null || !name.trim()) return;
  edit((bp) => { const t = S.type === 'room' ? bp.rooms.find((r) => r.id === S.id) : bp.items.find((i) => i.id === S.id); t.name = name.trim(); });
}
function removeSel() {
  const S = st.sel; if (!S) return;
  edit((bp) => {
    if (S.type === 'room') { bp.rooms = bp.rooms.filter((r) => r.id !== S.id); bp.items = (bp.items || []).filter((i) => i.room !== S.id); bp.doors = (bp.doors || []).filter((d) => !d.rooms.includes(S.id)); }
    if (S.type === 'item') bp.items = bp.items.filter((i) => i.id !== S.id);
    if (S.type === 'door') bp.doors = bp.doors.filter((d) => d.id !== S.id);
  });
  select(null);
}
function download() {
  const blob = new Blob([JSON.stringify(st.bp, null, 2) + '\n'], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${st.bp.id || 'blueprint'}.blueprint.json`; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('#file').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
  try {
    const bp = JSON.parse(await f.text());
    if (!Array.isArray(bp.rooms) || bp.rooms.some((r) => !Array.isArray(r.rect) || r.rect.length !== 4)) throw new Error('not a blueprint: it needs "rooms", each with a "rect" [x0, z0, x1, z1]');
    bp.items ||= []; bp.doors ||= []; bp.name = bp.name || f.name;
    st.edits.uploaded = bp; saveEdits(); showOption('uploaded');
  } catch (err) { console.error('Ship Lab: could not open ' + f.name + ': ' + err.message); }
});

// ── W A S D: move the view (Space up, C down, Shift faster) ──────────────────────────────────────────────────────
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { undo(); e.preventDefault(); return; }
  if ((e.code === 'Delete' || e.code === 'Backspace') && st.sel) { removeSel(); e.preventDefault(); return; }
  keys.add(e.code); if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
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

// ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────────
addEventListener('resize', layout);
let last = performance.now(), fpsT = 0, frames = 0, fps = 0;
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  const on = canvas.style.display !== 'none';
  // (the built ship's gear and airstair door, moving to where the menu asks)
  const B = st.shell?.built, L = st.ship?.lab;
  if (B && L && !st.hold) L.step(B, st, dt, { updateDoors, person, jets: st.shell.jets, time: t / 1000 });
  // (the cabin's sliding doors: open as the eye comes near when it is in the ship, else the person; or all open or shut)
  if (st.cabin && st.doorsAt == null) { const c = camera.position, inShip = Math.abs(c.x) < 2.6 && c.z > -5.6 && c.z < 7 && c.y > st.space.deck - 0.3 && c.y < st.space.deck + 3; updateDoors(st.cabin.built.doors, inShip ? c : person.position, dt, st.cabinDoors); }
  // (the engines easing to the throttle asked for: the whole range in about a second and a half; the jets follow it)
  if (ENGINE.throttle !== st.throttleT) { const d = st.throttleT - ENGINE.throttle, step = dt * 0.7; setThrottle(Math.abs(d) <= step ? st.throttleT : ENGINE.throttle + Math.sign(d) * step); }
  for (const J of st.shell?.jets || []) { if (J.role === 'main') J.set.setThrust(ENGINE.throttle, true); J.set.update(dt); }
  if (on) { fly(dt); controls.update(); updatePools(); if (composer) composer.render(); else renderer.render(scene, camera); frames++; }
  fpsT += dt; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  if (st.shell) hud.textContent = `${st.ship.name}: ${st.shell.size.z.toFixed(1)} × ${st.shell.size.x.toFixed(1)} × ${st.shell.size.y.toFixed(1)} m · deck ${st.space.deck} m up · ${Math.round(st.shell.tris + (st.cabin?.tris || 0)).toLocaleString()} tris` + (st.cabin ? ` (inside ${Math.round(st.cabin.tris).toLocaleString()})` : '') + (on ? ` · ${fps} fps` : '');
});

await loadOptions();
const S0 = SHIPS.find((S) => S.id === q.get('ship')) || SHIPS[0];
st.opt = S0.bps.includes(q.get('bp')) || (q.get('bp') === 'uploaded' && st.edits.uploaded) ? q.get('bp') : S0.bps[0];
st.bp = st.edits[st.opt] || clone(st.stock[st.opt]);
setBloom(st.bloom); setPools(st.pools);
layout();
await showShip(S0);
if (q.has('rig')) $('#panel').open = true;
window.SHIPLAB = {
  ready: true, options: () => OPTIONS.slice(), ships: SHIPS.map((S) => S.id), shipFor: (shell) => SHIPS.find((S) => S.shell === shell)?.id || null,
  option: (id) => showOption(id), ship: (id) => showShip(SHIPS.find((S) => S.id === id)), view: setView, cam: (c) => { setCam(c); menu(); },
  hull: (h) => { setHull(h); menu(); }, show: (k, on) => { show(k, on); menu(); }, result: () => st.result, bp: () => st.bp, select,
  panel: (open) => { $('#panel').open = open; }, fit: () => { plan.fit(); plan.draw(); },
  gear: (up) => { st.gear = up ? 'up' : 'down'; menu(); }, door: (open) => { st.door = open ? 'open' : 'shut'; menu(); },
  dirt: (k) => { st.dirt = k; st.ship?.lab?.setDirt(dirtOf()[k]); menu(); },
  throttle: (v, now) => { const t = typeof v === 'string' ? THROTTLE[v] : Math.max(0, Math.min(1, +v)); st.throttleT = t; st.throttle = Object.keys(THROTTLE).find((k) => THROTTLE[k] === t) || null; if (now) { setThrottle(t); for (const J of st.shell?.jets || []) if (J.role === 'main') J.set.setThrust(t, true); } menu(); return t; },
  arms: (reach) => { st.arms = reach ? 'reaching' : 'stowed'; menu(); }, thrusters: (on) => { st.thrusters = !!on; menu(); }, canisters: (on) => { st.canisters = !!on; menu(); },
  ramps: (down) => { st.ramps = down ? 'down' : 'up'; menu(); }, rampCount: (k) => { st.rampCount = k === 'one' ? 'one' : 'both'; menu(); },
  jets: () => (st.shell?.jets || []).map((J) => ({ role: J.role, thrust: +J.set.thrust.toFixed(3), on: J.set.jets.map((j) => j.tube.visible) })),
  // (how far each of the built ship's doors is open, 0 to 1: the gear legs, the wells' doors, the airstair)
  moving: () => (st.shell?.built ? st.shell.built.doors.map((D) => ({ piece: D.piece, t: +D.t.toFixed(3) })) : []),
  // (for pictures part way: hold the built ship's moving parts where `at` says, { gear, doors, stair } each 0 to 1; null
  // lets them go on to where the menu asks)
  // (for pictures part way: the built ship's moving parts held where `at` says (its module's pose: the Explorer's
  // { gear, doors, stair } each 0 to 1); null lets them go on to where the menu asks)
  pose: (at) => {
    const B = st.shell?.built; st.hold = !!at; if (!B || !at || !st.ship?.lab) return;
    st.ship.lab.pose(B, at, { updateDoors, person, jets: st.shell.jets });
  },
  built: () => st.shell?.built || null, three: THREE, scene, camera, renderer, controls,
  // (the cabin: shown or not, its look, its ceilings; its doors 'auto' | 'open' | 'shut', or held part open (0 to 1),
  // null lets them go; what it is: its triangles, by zone, its doors and how open each is; the cameras in its rooms)
  inside: (on) => setInside(on), look: (k) => setLook(k), roof: (on) => setRoof(on),
  // (the beams of light: beams(false) hides them; beams() says what there is: { on, beams, motes, draws, triangles, list:
  // each beam's room and place in the cabin's own frame, deck at 0 })
  beams: (on) => (on === undefined ? { on: st.beams, ...(st.cabin?.beams.stats || {}), list: (st.cabin?.parts.beams || []).map((b) => ({ room: b.room, at: b.at.map((v) => +v.toFixed(3)), length: b.length })) } : setBeams(on)),
  // (the look's light level: level('darker') sets it, level() says which is shown)
  level: (k) => (k === undefined ? levelOf(st.look) : setLevel(k)),
  cabinDoors: (v) => { if (typeof v === 'number') { st.doorsAt = Math.max(0, Math.min(1, v)); if (st.cabin) setDoors(st.cabin.built.doors, st.doorsAt); } else { st.doorsAt = null; st.cabinDoors = v || 'auto'; } menu(); },
  cabin: () => (st.cabin ? { tris: st.cabin.tris, perZone: st.cabin.perZone, parts: st.cabin.parts, draws: st.cabin.built.stats.draws, doors: st.cabin.built.doors.map((D) => +D.t.toFixed(3)), bakeMs: st.cabin.built.stats.bake.ms, ms: st.cabin.built.stats.ms } : null),
  roomSpots: () => roomSpots(), ship3: () => ({ tris: st.shell?.tris, stats: st.shell?.built?.stats || null }),
  bloom: (on) => { setBloom(on); menu(); }, pools: (on) => { setPools(on); menu(); }, fps: () => fps,
  // (one frame drawn as the loop draws it, for a rig timing frames)
  draw: () => { updatePools(); if (composer) composer.render(); else renderer.render(scene, camera); },
};
