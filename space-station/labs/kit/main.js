// THE KIT LAB: the station kit (space-station/kit/), built by the very code the game will use.
//   Parts: each piece alone on a stand, with its variants, to look round (drag turns round it).
//   Rooms: test rooms read from kit/rooms/*.json (drag turns the view where it stands).
//   Sky: the sky outside the windows (world/sky.js) with nothing in the way: named looks, and the planet's turn.
// ONE MENU along the bottom. W A S D fly (Space up, C down, Shift faster); on a touch screen, the stick and the
// up/down buttons. Doors slide open by themselves as the view comes near (or stay open or shut, from the menu).
// Graphics: low (no bloom; the strips' light baked without shadows; 1x resolution), medium (bloom, soft baked shadows,
// a shadow-mapped key light on the parts, 1.5x), high (a finer bake with more rays, a sharper room picture, 2x).
//   window.KL = { ready, part(id, variant), room(id), view(name), quality(q), doors(mode), stats(), bench(n), cam(...),
//                 sky(look), skyTurn(k), theSky }   (?sky=planet opens the Sky tab on a look)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeMaterials, U } from '../../kit/materials.js';
import { createSky, SKY_VIEWS } from '../../world/sky.js';
import { PIECES, GROUPS, SHIP_GROUPS, pieceList } from '../../kit/catalog.js';
import { buildRoom, updateDoors, setDoors, loadRoom, roomBounds, updateZones } from '../../kit/layout.js';
import { loadBake, packBake } from '../../kit/bakefile.js';
import { plane, put } from '../../kit/geo.js';
import { Piece } from '../../kit/piece.js';
import { makeDust } from '../../kit/dust.js';

const $ = (s) => document.querySelector(s), q = new URLSearchParams(location.search);
const ROOMS = [['corridor', 'Corridor'], ['junction', 'Junction + room'], ['station', 'The station']];
const QUALITY = {
  low: { ratio: 1, bloom: false, shadowMap: false, bake: { voxel: 0.09, rays: 20, shadows: false }, probe: 64 },
  medium: { ratio: 1.5, bloom: true, shadowMap: true, bake: { voxel: 0.07, rays: 28, shadows: true }, probe: 128 },
  high: { ratio: 2, bloom: true, shadowMap: true, bake: { voxel: 0.05, rays: 40, shadows: true }, probe: 256 },
};
// (shipPart: the part on show is a ship part, kit/shipparts; lastPart: the last one looked at on each tab)
const shipPart = () => SHIP_GROUPS.includes(PIECES[state.part]?.group), lastPart = { station: 'hatch', ship: null };
const state = { tab: 'parts', part: 'hatch', variant: 'arch', room: 'corridor', view: 'q', doors: 'auto', quality: q.get('q') in QUALITY ? q.get('q') : (matchMedia('(pointer: coarse)').matches ? 'medium' : 'high') };

// ── renderer, scene, camera ───────────────────────────────────────────────────────────────────────────────────────
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: q.has('rig') });
if (!renderer.capabilities.isWebGL2) throw new Error('This lab needs WebGL2');
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.info.autoReset = false;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.03, 120);
const mats = makeMaterials();
const pmrem = new THREE.PMREMGenerator(renderer);
const studioEnv = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
const key = new THREE.DirectionalLight(0xfff4e8, 2.2), fill = new THREE.HemisphereLight(0xbfd6ff, 0x30343a, 0.6);
key.position.set(4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
const kc = key.shadow.camera; kc.left = -4; kc.right = 4; kc.top = 4; kc.bottom = -4; kc.near = 0.5; kc.far = 25;
scene.add(key, key.target, fill);
const STAGE = new THREE.Group(); scene.add(STAGE);
const dust = makeDust(); dust.visible = false; scene.add(dust);
let built = null, roomData = {}, probeTex = null;

// ── the sky outside (world/sky.js): every room's windows show it; the Sky tab shows it alone ─────────────────────
const sky = createSky(renderer, { quality: state.quality }); sky.object.visible = false; scene.add(sky.object);
const TURNS = [[1, 'Slow'], [30, 'Fast']];
state.sky = SKY_VIEWS[q.get('sky')] ? q.get('sky') : 'planet';
function showSky(name = state.sky) {
  state.tab = 'sky'; if (SKY_VIEWS[name]) state.sky = name;
  clearStage(); key.visible = key.castShadow = false; dust.visible = false;
  scene.fog = null; scene.background = null; scene.environment = null; sky.object.visible = true; renderer.toneMappingExposure = 0.74;
  const V = SKY_VIEWS[state.sky], at = new THREE.Vector3(0, 1.6, 0);
  lookFrom(at.toArray(), at.clone().add(V.look).toArray(), V.fov);
  loading(''); menu(); readout();
}
function skyTurn(k) { sky.setTurn(k); chipsOn(); }

// ── post: bloom on the strips ─────────────────────────────────────────────────────────────────────────────────────
let composer = null, bloom = null;
function setupPost() {
  const Q = QUALITY[state.quality];
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.ratio));
  renderer.shadowMap.enabled = Q.shadowMap; renderer.shadowMap.needsUpdate = true;
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  if (composer) { composer.dispose(); composer = null; }
  if (Q.bloom) makeComposer();
  resize(true);
}
function makeComposer() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2()).max(new THREE.Vector2(2, 2));
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  // (the scene's own draws are counted inside its pass, before the bloom's passes add theirs)
  const rp = new RenderPass(scene, camera), rpRender = rp.render.bind(rp);
  rp.render = (...a) => { renderer.info.reset(); rpRender(...a); sceneCalls = renderer.info.render.calls; sceneTris = renderer.info.render.triangles; };
  composer.addPass(rp);
  bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.32, 2.2);
  composer.addPass(bloom); composer.addPass(new OutputPass());
}

// ── the camera: orbit round a part, or look about from where it stands in a room ───────────────────────────────────
const cam = { mode: 'orbit', target: new THREE.Vector3(0, 1, 0), yaw: 0.6, pitch: 0.25, dist: 5, pos: new THREE.Vector3(0, 1.6, 0) };
function applyCam() {
  const cp = Math.cos(cam.pitch), dir = new THREE.Vector3(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
  if (cam.mode === 'orbit') camera.position.copy(cam.target).addScaledVector(dir, cam.dist), camera.lookAt(cam.target);
  else { camera.position.copy(cam.pos); camera.lookAt(_v.copy(cam.pos).addScaledVector(dir, -1)); }
}
const _v = new THREE.Vector3();
function lookFrom(at, look, fov) {
  cam.mode = 'look'; cam.pos.set(...at); const d = new THREE.Vector3(...look).sub(cam.pos).normalize();
  cam.yaw = Math.atan2(-d.x, -d.z); cam.pitch = Math.asin(-d.y);
  if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  applyCam();
}
// drag to turn; two fingers (or the wheel) to come closer
const ptrs = new Map(); let pinch = 0;
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = 0; });
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    // (drag right: round to the right of a part, or turn the view right; drag down: from higher, or look down)
    const k = cam.mode === 'orbit' ? 0.008 : 0.0045 * (state.tab === 'sky' ? camera.fov / 60 : 1);
    cam.yaw -= dx * k; cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * k, -1.45, 1.45);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch) zoom((pinch - d) * 0.01); pinch = d;
  }
  applyCam();
});
const up = (e) => { ptrs.delete(e.pointerId); pinch = 0; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.sign(e.deltaY) * 0.25); applyCam(); }, { passive: false });
function zoom(k) {
  if (state.tab === 'sky') { camera.fov = THREE.MathUtils.clamp(camera.fov * (1 + k * 0.4), 4, 100); camera.updateProjectionMatrix(); return; }   // (the sky is at infinity: zoom it in)
  if (cam.mode === 'orbit') cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + k * 0.4), 0.4, 40);
  else { const cp = Math.cos(cam.pitch); cam.pos.addScaledVector(_v.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp), k * 1.2); }
}
// flying: W A S D along the floor the way the view faces, Space up, C down, Shift faster
const FLY = { KeyW: [0, 0, 1], KeyS: [0, 0, -1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], Space: [0, 1, 0], KeyC: [0, -1, 0] };
const keys = new Set(), vel = new THREE.Vector3(), stickV = { x: 0, y: 0 }, vert = { v: 0 }; let fast = false;
addEventListener('keydown', (e) => { fast = e.shiftKey; if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return; keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', (e) => { fast = e.shiftKey; keys.delete(e.code); });
addEventListener('blur', () => keys.clear());
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3();
function fly(dt) {
  let fx = stickV.x, fy = vert.v, fz = stickV.y; for (const k of keys) { fx += FLY[k][0]; fy += FLY[k][1]; fz += FLY[k][2]; }
  const speed = (state.tab === 'rooms' ? 2.4 : Math.max(1, cam.dist * 0.6)) * (fast ? 2.5 : 1);
  camera.getWorldDirection(_f); _f.y = 0; if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); _f.normalize(); _r.crossVectors(_f, THREE.Object3D.DEFAULT_UP).normalize();
  _w.set(0, 0, 0).addScaledVector(_f, fz).addScaledVector(_r, fx); if (_w.lengthSq() > 1) _w.normalize(); _w.multiplyScalar(speed); _w.y = THREE.MathUtils.clamp(fy, -1, 1) * speed * 0.7;
  vel.lerp(_w, 1 - Math.exp(-9 * dt)); if (vel.lengthSq() < 1e-6 && !keys.size && !stickV.x && !stickV.y && !vert.v) { vel.set(0, 0, 0); return; }
  const step = vel.clone().multiplyScalar(dt);
  if (cam.mode === 'orbit') cam.target.add(step); else cam.pos.add(step);
  applyCam();
}
// the touch stick and buttons
function touchControls() {
  const isTouch = matchMedia('(pointer: coarse)').matches || q.has('touch'); document.body.classList.toggle('touch', isTouch); if (!isTouch) return;
  const S = $('#stick'), K = $('#knob'); let id = null;
  const set = (e) => { const r = S.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2; let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } stickV.x = dx; stickV.y = -dy; K.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`; };
  S.addEventListener('pointerdown', (e) => { id = e.pointerId; S.setPointerCapture(id); set(e); e.preventDefault(); });
  S.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
  const end = () => { id = null; stickV.x = stickV.y = 0; K.style.transform = ''; };
  S.addEventListener('pointerup', end); S.addEventListener('pointercancel', end);
  for (const [b, v] of [['#up', 1], ['#down', -1]]) { const B = $(b); B.addEventListener('pointerdown', (e) => { B.setPointerCapture(e.pointerId); vert.v = v; B.classList.add('on'); }); const off = () => { vert.v = 0; B.classList.remove('on'); }; B.addEventListener('pointerup', off); B.addEventListener('pointercancel', off); }
}

// ── building what's shown ────────────────────────────────────────────────────────────────────────────────────────
function clearStage() { if (built) { built.dispose(); built = null; } STAGE.clear(); }
function loading(text, soft) { const L = $('#loading'); L.textContent = text; L.hidden = !text; L.classList.toggle('soft', !!soft); }
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
// a round dark stand for the parts, part of the bake (so a part darkens the floor under it)
function standGeo() {
  const sp = new Piece(), g = plane(14, 14, { cell: 0.35 }); put(g, [0, -0.02, 0], [-Math.PI / 2, 0, 0]);
  sp.add('solid', g, { c: '#23262b', r: 0.55, m: 0.3, w: 0.4 }); return sp.parts[0].geo;
}
let partBusy = 0;
async function showPart(id = state.part, variant) {
  const def = PIECES[id]; variant = variant ?? (id === state.part ? state.variant : def.variants[0]); if (!def.variants.includes(variant)) variant = def.variants[0];
  state.tab = 'parts'; state.part = id; state.variant = variant; lastPart[shipPart() ? 'ship' : 'station'] = id; const my = ++partBusy;
  loading('Cutting the ' + def.name.toLowerCase() + '…', true); await frame(); if (my !== partBusy) return;
  clearStage(); setEnv('studio'); dust.visible = false;
  // wall kit hangs at a metre; ceiling things come down to near eye height; everything else stands on the stand
  const lift = def.at === 'wall' || def.at === 'free' ? 1.0 : def.y ? 0.8 - def.y : 0;
  const room = { name: def.name, pieces: [{ piece: id, cell: [0, 0], turn: 0, variant, off: [0, lift, 0] }] };
  built = buildRoom(room, mats, { bake: { ...QUALITY[state.quality].bake, shadows: true }, extra: { solid: [standGeo()] } });
  STAGE.add(built.group); setDoors(built.doors, state.doors === 'open' ? 1 : 0);
  // frame it
  const box = roomBounds(room);
  framed.c = box.getCenter(new THREE.Vector3()); framed.r = Math.max(0.25, box.getSize(new THREE.Vector3()).length() / 2);
  cam.mode = 'orbit'; camera.fov = 45; camera.updateProjectionMatrix(); view(state.view in PVIEWS ? state.view : 'q');
  key.target.position.copy(framed.c); key.position.copy(framed.c).add(new THREE.Vector3(4, 7, 5)); renderer.shadowMap.needsUpdate = true;
  loading(''); menu(); readout();
}
const framed = { c: new THREE.Vector3(0, 1, 0), r: 1 };
const PVIEWS = { front: [0, 0.05, 1], side: [1, 0.05, 0], top: [0, 1, 0.0001], back: [0, 0.1, -1], q: [1, 0.55, 1.15] };
function view(name) {
  state.view = name;
  if (state.tab === 'parts') {
    if (!PVIEWS[name]) name = state.view = 'q';
    // (far enough back that the part's whole round fits the narrower of the two angles of view)
    const half = Math.min(camera.fov, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect))) / 2;
    const v = new THREE.Vector3(...PVIEWS[name]).normalize(); cam.target.copy(framed.c); cam.dist = framed.r / Math.sin(THREE.MathUtils.degToRad(half)) * 1.05 + 0.2;
    cam.yaw = Math.atan2(v.x, v.z); cam.pitch = Math.asin(v.y); cam.mode = 'orbit'; applyCam();
  } else {
    const V = roomData[state.room]?.views?.[name]; if (V) lookFrom(V.at, V.look, V.fov);
  }
  chipsOn();
}
async function showRoom(id = state.room) {
  state.tab = 'rooms'; state.room = id;
  loading('Lighting the ' + (ROOMS.find((r) => r[0] === id)?.[1] || id).toLowerCase() + '…', !!built); await frame();
  if (!roomData[id]) roomData[id] = await loadRoom(new URL(`../../kit/rooms/${id}.json`, import.meta.url));
  const R = roomData[id], more = await stationOpts(R);
  clearStage();
  built = buildRoom(R, mats, { bake: QUALITY[state.quality].bake, ...more });
  STAGE.add(built.group);
  if (built.stats.problems.length) console.warn('kit lab: the room has problems', built.stats.problems);
  setDoors(built.doors, state.doors === 'open' ? 1 : 0);
  dust.visible = false; if (R.rooms) updateZones(built, new THREE.Vector3(...(R.views?.start?.at || [0, 1.6, 0])), 0.01);
  setEnv('room', R.probe || R.views?.start?.at || [0, 1.6, 0]); if (R.rooms) zoneProbes(built); dust.visible = state.quality !== 'low';
  if (!(state.view in (R.views || {}))) state.view = 'start';
  view(state.view); loading(''); menu(); readout();
}
// the light round the scene: a studio for the parts; inside a room, the room itself seen from its middle (a picture
// taken all round, blurred: its reflections and its soft bounce)
function setEnv(kind, at) {
  const studio = kind === 'studio';
  key.visible = studio; key.castShadow = studio;
  // (a soft fill from all round: in a room it keeps the darks charcoal, never black; and a faint haze down a corridor)
  fill.color.set(studio ? 0xbfd6ff : 0xdde2e8); fill.groundColor.set(studio ? 0x30343a : 0x5d6065); fill.intensity = studio ? 0.6 : 0.75;
  scene.fog = studio ? null : new THREE.Fog(0x8a8e93, 7, 60);
  scene.background = studio ? new THREE.Color(0x141a22) : null; sky.object.visible = !studio;   // (the windows show the sky)
  U.aoDirect.value = studio ? 0.5 : 0.6; U.bakeGain.value = studio ? 0.6 : 1;
  renderer.toneMappingExposure = studio ? 1.0 : 0.74;
  for (const m of Object.values(mats)) if ('envMapIntensity' in m) m.envMapIntensity = m === mats.glass ? 0.35 : studio ? 0.9 : 1.25;
  if (studio) { scene.environment = studioEnv; return; }
  // the room's own picture: twice, so the second one sees the first's bounce
  const size = QUALITY[state.quality].probe, rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  const cc = new THREE.CubeCamera(0.05, 80, rt); cc.position.set(...at); scene.add(cc);
  scene.environment = null; const bg = scene.background; scene.background = null; sky.object.visible = false;
  for (let pass = 0; pass < 2; pass++) {
    cc.update(renderer, scene);
    const t = pmrem.fromCubemap(rt.texture).texture; if (probeTex) probeTex.dispose(); probeTex = t; scene.environment = t;
  }
  scene.background = bg; sky.object.visible = true; scene.remove(cc); rt.dispose();
}

// ── the menu ─────────────────────────────────────────────────────────────────────────────────────────────────────
const chips = {};
function chip(row, key, label, fn, cls = '') { const b = document.createElement('button'); b.className = 'chip ' + cls; b.textContent = label; b.onclick = fn; row.appendChild(b); chips[key] = b; return b; }
function sep(row, label) { const s = document.createElement('span'); s.className = 'kl-sep'; row.appendChild(s); if (label) { const l = document.createElement('span'); l.className = 'kl-label'; l.textContent = label; row.appendChild(l); } }
function menu() {
  const I = $('#items'), T = $('#tabs'); I.innerHTML = ''; T.innerHTML = ''; for (const k in chips) delete chips[k];
  if (state.tab === 'parts') {
    // (the station's kit, or the ship parts on their own tab: whichever the part on show belongs to; empty groups left out)
    for (const g of shipPart() ? SHIP_GROUPS : GROUPS) { const ids = pieceList(g); if (!ids.length) continue; sep(I, g); for (const id of ids) chip(I, 'p:' + id, PIECES[id].name, () => showPart(id, PIECES[id].variants[0])); }
  } else if (state.tab === 'sky') { sep(I, 'Look at'); for (const [id, V] of Object.entries(SKY_VIEWS)) chip(I, 's:' + id, V.name, () => showSky(id)); }
  else for (const [id, name] of ROOMS) chip(I, 'r:' + id, name, () => showRoom(id));
  chip(T, 't:parts', 'Parts', () => { if (state.tab !== 'parts' || shipPart()) { state.view = 'q'; showPart(shipPart() ? lastPart.station : state.part); } });
  // (the ship parts' tab, once there are any)
  if (SHIP_GROUPS.some((g) => pieceList(g).length)) chip(T, 't:ships', 'Ship parts', () => { if (state.tab !== 'parts' || !shipPart()) { state.view = 'q'; showPart(lastPart.ship || SHIP_GROUPS.map((g) => pieceList(g)[0]).find(Boolean)); } });
  chip(T, 't:rooms', 'Rooms', () => { if (state.tab !== 'rooms') { state.view = 'start'; showRoom(); } });
  chip(T, 't:sky', 'Sky', () => { if (state.tab !== 'sky') showSky(); });
  sep(T, 'Graphics');
  const sel = document.createElement('select'); sel.id = 'quality'; sel.setAttribute('aria-label', 'Graphics');
  sel.innerHTML = Object.keys(QUALITY).map((k) => `<option value="${k}"${k === state.quality ? ' selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('');
  sel.onchange = () => quality(sel.value); T.appendChild(sel);
  if (state.tab === 'parts') {
    const vs = PIECES[state.part].variants;
    if (vs.length > 1) { sep(T, 'Variant'); for (const v of vs) chip(T, 'v:' + v, v, () => showPart(state.part, v), 'sub'); }
    sep(T, 'View'); for (const [v, n] of [['front', 'Front'], ['side', 'Side'], ['top', 'Top'], ['q', '¾'], ['back', 'Back']]) chip(T, 'w:' + v, n, () => view(v), 'sub');
  } else if (state.tab === 'sky') {
    sep(T, 'Turn'); for (const [k, n] of TURNS) chip(T, 'u:' + k, n, () => skyTurn(k), 'sub');
  } else {
    sep(T, 'View'); for (const v of Object.keys(roomData[state.room]?.views || {})) chip(T, 'w:' + v, v[0].toUpperCase() + v.slice(1), () => view(v), 'sub');
  }
  if (state.tab !== 'sky') { sep(T, 'Doors'); for (const [m, n] of [['auto', 'By themselves'], ['open', 'Open'], ['shut', 'Shut']]) chip(T, 'd:' + m, n, () => doors(m), 'sub'); }
  chipsOn(); sizeBar();
}
function chipsOn() {
  for (const [k, b] of Object.entries(chips)) {
    const [t, v] = k.split(':');
    b.classList.toggle('on', (t === 't' && (v === 'ships' ? state.tab === 'parts' && shipPart() : v === state.tab && !(v === 'parts' && shipPart()))) || (t === 'p' && v === state.part) || (t === 'r' && v === state.room) || (t === 'v' && v === state.variant) || (t === 'w' && v === state.view) || (t === 'd' && v === state.doors) || (t === 's' && v === state.sky) || (t === 'u' && +v === sky.turn));
  }
  const on = document.querySelector('#items .chip.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function sizeBar() { document.body.style.setProperty('--bar', $('#bar').offsetHeight + 'px'); }
function doors(m) { state.doors = m; if (built) { if (m !== 'auto') setDoors(built.doors, m === 'open' ? 1 : 0); renderer.shadowMap.needsUpdate = true; } chipsOn(); }
async function quality(qq) { if (!(qq in QUALITY)) return; state.quality = qq; sky.setQuality(qq); setupPost(); if (state.tab === 'parts') await showPart(); else if (state.tab === 'sky') showSky(); else await showRoom(); }

// ── numbers ──────────────────────────────────────────────────────────────────────────────────────────────────────
const fps = { n: 0, t: performance.now(), v: 0, ms: 0, cpu: 0 };
let sceneCalls = 0, sceneTris = 0;
function stats() {
  const s = built?.stats || {};
  return { tab: state.tab, what: state.tab === 'parts' ? `${state.part}:${state.variant}` : state.tab === 'sky' ? state.sky : state.room, quality: state.quality, pieces: s.pieces, meshDraws: s.draws, tris: s.tris, sceneCalls, sceneTris, fps: Math.round(fps.v), frameMs: +fps.ms.toFixed(2), cpuMs: +fps.cpu.toFixed(2), buildMs: s.ms, bake: s.bake, lights: s.lights, doors: s.doors, problems: s.problems, ratio: renderer.getPixelRatio(), size: [canvas.width, canvas.height], sky: { ...sky.stats, shown: sky.object.visible } };
}
function readout() {
  const s = stats(), what = state.tab === 'parts' ? `${PIECES[state.part].name} · ${state.variant}` : state.tab === 'sky' ? 'Sky · ' + SKY_VIEWS[state.sky].name : (ROOMS.find((r) => r[0] === state.room)?.[1] || state.room);
  $('#hud').textContent = `${what} — ${(s.tris || 0).toLocaleString()} tris · ${s.sceneCalls} draws · ${s.fps} fps`;
}
// time n frames drawn back to back, waiting for the GPU at the end (a rough cost of one frame)
function bench(n = 60) {
  const gl = renderer.getContext(), px = new Uint8Array(4), t0 = performance.now();
  for (let i = 0; i < n; i++) draw();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return +((performance.now() - t0) / n).toFixed(2);
}

// ── the loop ─────────────────────────────────────────────────────────────────────────────────────────────────────
function resize(force) {
  const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();
  if (!force && canvas.width === Math.floor(w * pr) && canvas.height === Math.floor(h * pr)) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
  sizeBar();
}
function draw(dt = 1 / 60) {
  if (composer) composer.render(dt);
  else { renderer.info.reset(); renderer.render(scene, camera); sceneCalls = renderer.info.render.calls; sceneTris = renderer.info.render.triangles; }
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (stationTick(now)) return;
  resize(); fly(dt); if (dust.visible) dust.userData.update(dt, camera.position); sky.update(dt);
  if (built && built.doors.length && state.doors === 'auto' && updateDoors(built.doors, camera.position, dt, 'auto')) renderer.shadowMap.needsUpdate = true;
  if (renderer.shadowMap.enabled) renderer.shadowMap.autoUpdate = false;
  const c0 = performance.now();
  draw(dt);
  fps.cpu = fps.cpu * 0.95 + (performance.now() - c0) * 0.05;
  fps.n++; if (now - fps.t > 500) { fps.v = fps.n * 1000 / (now - fps.t); fps.ms = (now - fps.t) / fps.n; fps.n = 0; fps.t = now; readout(); }
}

// ── the station: one room file holding many rooms ────────────────────────────────────────────────────────────────
// Each room of it (a zone) is merged into its own meshes, with its own picture of itself for reflections and bounce
// (the lit materials are the room's own; glass, glows, screens and the shield are shared by all). A room is drawn when
// the eye is in it, or when an opening into it (the room file's portals) is on screen; the light probes, which look
// all round, use `range` instead. Its light comes from the saved bake beside the room file when that still matches
// the pieces (bake=live in the address works it all out instead).
const station = { range: 34, saved: false, bakeBytes: 0, times: { moduleAt: Math.round(performance.now()) } }, zoneSets = new Map();
let frozen = false;
async function stationOpts(R) {
  if (!R.rooms) return {};
  station.times.roomFetchedAt = Math.round(performance.now());
  const t0 = performance.now(), saved = R.bake && q.get('bake') !== 'live' ? await loadBake(new URL(`../../kit/rooms/${R.bake}`, import.meta.url)) : null;
  station.times.bakeFetch = Math.round(performance.now() - t0);
  station.saved = !!saved; station.bakeBytes = +(saved?.bytes || 0);
  return { saved, zoneMats: zoneMaterials, compact: q.get('compact') !== '0' };
}
function zoneMaterials(id) {
  if (!zoneSets.has(id)) { const m = makeMaterials(); zoneSets.set(id, { ...mats, solid: m.solid, floor: m.floor, decal: m.decal, solidInst: mats.solidInst, floorInst: mats.floorInst, decalInst: mats.decalInst }); }
  return zoneSets.get(id);
}
// each room's picture of itself, from its probe point (or its middle at eye height): twice, so the second sees the
// first's bounce
function zoneProbes(b) {
  const t0 = performance.now();
  const rt = new THREE.WebGLCubeRenderTarget(QUALITY[state.quality].probe, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(0.05, 90, rt);
  scene.add(cc); const bg = scene.background; scene.background = null;
  for (let pass = 0; pass < 2; pass++) {
    const envs = b.zones.map((z) => {
      if (z.with) return null;   // (a door's zone uses its room's picture)
      const c = z.box.getCenter(new THREE.Vector3()); cc.position.set(...(z.probe || [c.x, z.box.min.y + 1.6, c.z]));
      updateZones(b, cc.position, station.range); cc.update(renderer, scene); return pmrem.fromCubemap(rt.texture).texture;
    });
    b.zones.forEach((z, i) => {
      if (z.with) return;
      const set = zoneSets.get(z.id); if (set.env) set.env.dispose(); set.env = envs[i];
      // (a big room's own picture of itself is mostly its bright walls: a little less of it, so its lights make pools)
      for (const k of ['solid', 'floor', 'decal']) { set[k].envMap = envs[i]; set[k].envMapIntensity = mats[k].envMapIntensity * (z.sky ? 0.7 : 1); set[k].needsUpdate = true; }
    });
  }
  scene.background = bg; scene.remove(cc); rt.dispose();
  station.times.probes = Math.round(performance.now() - t0);
}
// every frame: the shield's time, which rooms are near enough to draw; true while a rig holds the picture still
function stationTick(now) {
  U.time.value = now / 1000;
  if (built?.zones?.length > 1 && !frozen) updateZones(built, camera.position, station.range, camera, roomData[state.room]?.portals);
  return frozen;
}
// a plan from above (x to the right, z down the page), everything above `y` cut away; returns the plan's edges in metres
const planCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
function plan({ y = 2.6, box = null } = {}) {
  frozen = true;
  const b = box ? new THREE.Box3(new THREE.Vector3(box[0], -1, box[1]), new THREE.Vector3(box[2], 10, box[3])) : roomBounds(roomData[state.room]);
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, aspect = canvas.width / canvas.height;
  let hw = (b.max.x - b.min.x) / 2 * 1.03, hh = (b.max.z - b.min.z) / 2 * 1.03; if (hw / hh > aspect) hh = hw / aspect; else hw = hh * aspect;
  planCam.left = -hw; planCam.right = hw; planCam.top = hh; planCam.bottom = -hh; planCam.updateProjectionMatrix();
  planCam.position.set(cx, 80, cz); planCam.up.set(0, 0, -1); planCam.lookAt(cx, 0, cz);
  for (const z of built?.zones || []) z.group.visible = true;
  const fog = scene.fog, bg = scene.background, dv = dust.visible; scene.fog = null; scene.background = new THREE.Color(0x0b0f14); dust.visible = false;
  renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), y)];
  renderer.setRenderTarget(null); renderer.render(scene, planCam);
  renderer.clippingPlanes = []; scene.fog = fog; scene.background = bg; dust.visible = dv;
  return { left: cx - hw, right: cx + hw, top: cz - hh, bottom: cz + hh };
}
// holes to outside: from each point, a look all round (six views) with the background bright magenta and the glass
// and shield painted solid (they are meant to show outside); every magenta pixel is somewhere the eye sees out
function leaks(points, res = 48) {
  frozen = true;
  const rt = new THREE.WebGLRenderTarget(res, res), cam = new THREE.PerspectiveCamera(90, 1, 0.05, 200), px = new Uint8Array(res * res * 4), swaps = [], solidPaint = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  scene.traverse((o) => { if (o.isMesh && (o.material === mats.glass || o.material === mats.shield)) { swaps.push([o, o.material]); o.material = solidPaint; } });
  const fog = scene.fog, bg = scene.background, dv = dust.visible; scene.fog = null; scene.background = new THREE.Color(1, 0, 1); dust.visible = false;
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], out = [];
  for (const at of points) {
    cam.position.set(...at);
    const per = dirs.map((d) => {
      cam.up.set(...(d[1] ? [0, 0, 1] : [0, 1, 0])); cam.lookAt(at[0] + d[0], at[1] + d[1], at[2] + d[2]);
      if (built?.zones?.length > 1) updateZones(built, cam.position, station.range, cam, roomData[state.room]?.portals);
      renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.readRenderTargetPixels(rt, 0, 0, res, res, px);
      let c = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i + 1] < 60 && px[i + 2] > 200) c++; return c;
    });
    out.push({ at, magenta: per.reduce((a, c) => a + c, 0), per });
  }
  renderer.setRenderTarget(null); for (const [o, m] of swaps) o.material = m; solidPaint.dispose(); rt.dispose();
  scene.fog = fog; scene.background = bg; dust.visible = dv; frozen = false;
  return out;
}
// walk a route (cells [x, z] on the grid) through the room's voxels (bake=live): under each step the floor; whether
// anything stands in a body's way (0.22 m round, from 0.35 m to 1.85 m over the floor); the clear width across
function walk(cells, { step = 0.2, r = 0.22 } = {}) {
  const V = built?.voxels; if (!V) return { error: 'no voxels: load with bake=live' };
  const pts = cells.map(([x, z]) => [x * 2, z * 2]), out = { samples: 0, blocked: [], minWidth: [], floors: [] };
  let floor = 0;
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / step)), dx = (bx - ax) / len, dz = (bz - az) / len;
    let minW = Infinity;
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
      // the floor: the first full voxel down from a step above the last floor
      let f = null; for (let y = floor + 1.0; y > floor - 1.2; y -= V.s * 0.5) if (V.full(x, y, z)) { f = y; break; }
      if (f !== null) floor = f;
      let hits = 0;
      for (let h = floor + 0.35; h <= floor + 1.85; h += 0.1) for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI * 2, rr = k === 8 ? 0 : r; if (V.full(x + Math.cos(a) * rr, h, z + Math.sin(a) * rr)) hits++; }
      if (hits) out.blocked.push({ seg: s, at: [+x.toFixed(2), +floor.toFixed(2), +z.toFixed(2)], hits });
      // the clear width across the way at hip and head height
      for (const h of [1.0, 1.6]) {
        let w = 0; for (const sg of [-1, 1]) { let t = 0; while (t < 8 && !V.full(x - dz * t * sg, floor + h, z + dx * t * sg)) t += V.s * 0.5; w += t; }
        minW = Math.min(minW, w);
      }
      out.samples++; if (i === 0) out.floors.push(+floor.toFixed(2));
    }
    out.minWidth.push(+minW.toFixed(2));
  }
  return out;
}
// (the same paint as leaks(), left on so a picture shows where the holes are)
let leakSwaps = null;
function leakPaint(on) {
  if (on && !leakSwaps) {
    const paint = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); leakSwaps = { list: [], fog: scene.fog, bg: scene.background, paint };
    scene.traverse((o) => { if (o.isMesh && (o.material === mats.glass || o.material === mats.shield)) { leakSwaps.list.push([o, o.material]); o.material = paint; } });
    scene.fog = null; scene.background = new THREE.Color(1, 0, 1);
  } else if (!on && leakSwaps) {
    for (const [o, m] of leakSwaps.list) o.material = m; scene.fog = leakSwaps.fog; scene.background = leakSwaps.bg; leakSwaps.paint.dispose(); leakSwaps = null;
  }
}
async function packBakeB64() {
  const zones = built.zones.map((z) => ({ id: z.id, meshes: Object.fromEntries(['solid', 'floor', 'decal'].filter((k) => z.merged[k]).map((k) => [k, z.merged[k]])) }));
  const bytes = await packBake(zones, { room: state.room, quality: state.quality });
  let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return { b64: btoa(s), bytes: bytes.length };
}

const KL = window.KL = {
  ready: false, part: (id, v) => showPart(id, v), room: (id) => showRoom(id), view, quality, doors, stats, bench,
  cam: (at, look, fov) => lookFrom(at, look, fov), orbit: (yaw, pitch, dist) => { cam.mode = 'orbit'; cam.yaw = yaw; cam.pitch = pitch; if (dist) cam.dist = dist; applyCam(); },
  list: () => Object.keys(PIECES), variants: (id) => PIECES[id].variants, rooms: () => ROOMS.map((r) => r[0]), get built() { return built; },
  get roomData() { return roomData; }, renderer, scene, camera, mats, state,
  sky: (name) => showSky(name), skyTurn, theSky: sky, skyViews: () => Object.keys(SKY_VIEWS),
};
// (the station's tools, for rigs: a plan, holes to outside, a walk along a route, the saved bake)
Object.assign(KL, { plan, leaks, leakPaint, walk, packBake: packBakeB64, station, unfreeze: () => { frozen = false; }, zones: () => (built?.zones || []).map((z) => ({ id: z.id, tris: Math.round(z.tris), visible: z.group.visible, from: z.bakedFrom })) });
(async () => {
  touchControls(); setupPost(); resize(true);
  if (q.get('sky')) showSky(q.get('sky'));
  else if (q.get('room')) { state.view = q.get('view') || 'start'; await showRoom(q.get('room')); }
  else await showPart(q.get('part') || state.part, q.get('variant') || undefined);
  KL.ready = true;
  renderer.setAnimationLoop(loop);
})().catch((e) => { console.error(e); loading(''); });
