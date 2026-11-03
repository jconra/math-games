// THE KIT LAB: the station kit (space-station/kit/), built by the very code the game will use.
//   Parts: each piece alone on a stand, with its variants, to look round (drag turns round it).
//   Rooms: test rooms read from kit/rooms/*.json (drag turns the view where it stands).
// ONE MENU along the bottom. W A S D fly (Space up, C down, Shift faster); on a touch screen, the stick and the
// up/down buttons. Doors slide open by themselves as the view comes near (or stay open or shut, from the menu).
// Graphics: low (no bloom; the strips' light baked without shadows; 1x resolution), medium (bloom, soft baked shadows,
// a shadow-mapped key light on the parts, 1.5x), high (a finer bake with more rays, a sharper room picture, 2x).
//   window.KL = { ready, part(id, variant), room(id), view(name), quality(q), doors(mode), stats(), bench(n), cam(...) }
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeMaterials, stars, U } from '../../kit/materials.js';
import { PIECES, GROUPS, pieceList } from '../../kit/catalog.js';
import { buildRoom, updateDoors, setDoors, loadRoom, roomBounds } from '../../kit/layout.js';
import { plane, put } from '../../kit/geo.js';
import { Piece } from '../../kit/piece.js';
import { makeDust } from '../../kit/dust.js';

const $ = (s) => document.querySelector(s), q = new URLSearchParams(location.search);
const ROOMS = [['corridor', 'Corridor'], ['junction', 'Junction + room']];
const QUALITY = {
  low: { ratio: 1, bloom: false, shadowMap: false, bake: { voxel: 0.09, rays: 20, shadows: false }, probe: 64 },
  medium: { ratio: 1.5, bloom: true, shadowMap: true, bake: { voxel: 0.07, rays: 28, shadows: true }, probe: 128 },
  high: { ratio: 2, bloom: true, shadowMap: true, bake: { voxel: 0.05, rays: 40, shadows: true }, probe: 256 },
};
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
    const k = cam.mode === 'orbit' ? 0.008 : 0.0045;
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
  state.tab = 'parts'; state.part = id; state.variant = variant; const my = ++partBusy;
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
  const R = roomData[id];
  clearStage();
  built = buildRoom(R, mats, { bake: QUALITY[state.quality].bake });
  STAGE.add(built.group);
  if (built.stats.problems.length) console.warn('kit lab: the room has problems', built.stats.problems);
  setDoors(built.doors, state.doors === 'open' ? 1 : 0);
  dust.visible = false; setEnv('room', R.probe || R.views?.start?.at || [0, 1.6, 0]); dust.visible = state.quality !== 'low';
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
  scene.background = studio ? new THREE.Color(0x141a22) : stars();
  U.aoDirect.value = studio ? 0.5 : 0.6; U.bakeGain.value = studio ? 0.6 : 1;
  renderer.toneMappingExposure = studio ? 1.0 : 0.74;
  for (const m of Object.values(mats)) if ('envMapIntensity' in m) m.envMapIntensity = m === mats.glass ? 0.35 : studio ? 0.9 : 1.25;
  if (studio) { scene.environment = studioEnv; return; }
  // the room's own picture: twice, so the second one sees the first's bounce
  const size = QUALITY[state.quality].probe, rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  const cc = new THREE.CubeCamera(0.05, 80, rt); cc.position.set(...at); scene.add(cc);
  scene.environment = null; const bg = scene.background; scene.background = null;
  for (let pass = 0; pass < 2; pass++) {
    cc.update(renderer, scene);
    const t = pmrem.fromCubemap(rt.texture).texture; if (probeTex) probeTex.dispose(); probeTex = t; scene.environment = t;
  }
  scene.background = bg; scene.remove(cc); rt.dispose();
}

// ── the menu ─────────────────────────────────────────────────────────────────────────────────────────────────────
const chips = {};
function chip(row, key, label, fn, cls = '') { const b = document.createElement('button'); b.className = 'chip ' + cls; b.textContent = label; b.onclick = fn; row.appendChild(b); chips[key] = b; return b; }
function sep(row, label) { const s = document.createElement('span'); s.className = 'kl-sep'; row.appendChild(s); if (label) { const l = document.createElement('span'); l.className = 'kl-label'; l.textContent = label; row.appendChild(l); } }
function menu() {
  const I = $('#items'), T = $('#tabs'); I.innerHTML = ''; T.innerHTML = ''; for (const k in chips) delete chips[k];
  if (state.tab === 'parts') {
    for (const g of GROUPS) { sep(I, g); for (const id of pieceList(g)) chip(I, 'p:' + id, PIECES[id].name, () => showPart(id, PIECES[id].variants[0])); }
  } else for (const [id, name] of ROOMS) chip(I, 'r:' + id, name, () => showRoom(id));
  chip(T, 't:parts', 'Parts', () => { if (state.tab !== 'parts') { state.view = 'q'; showPart(); } });
  chip(T, 't:rooms', 'Rooms', () => { if (state.tab !== 'rooms') { state.view = 'start'; showRoom(); } });
  sep(T, 'Graphics');
  const sel = document.createElement('select'); sel.id = 'quality'; sel.setAttribute('aria-label', 'Graphics');
  sel.innerHTML = Object.keys(QUALITY).map((k) => `<option value="${k}"${k === state.quality ? ' selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('');
  sel.onchange = () => quality(sel.value); T.appendChild(sel);
  if (state.tab === 'parts') {
    const vs = PIECES[state.part].variants;
    if (vs.length > 1) { sep(T, 'Variant'); for (const v of vs) chip(T, 'v:' + v, v, () => showPart(state.part, v), 'sub'); }
    sep(T, 'View'); for (const [v, n] of [['front', 'Front'], ['side', 'Side'], ['top', 'Top'], ['q', '¾'], ['back', 'Back']]) chip(T, 'w:' + v, n, () => view(v), 'sub');
  } else {
    sep(T, 'View'); for (const v of Object.keys(roomData[state.room]?.views || {})) chip(T, 'w:' + v, v[0].toUpperCase() + v.slice(1), () => view(v), 'sub');
  }
  sep(T, 'Doors'); for (const [m, n] of [['auto', 'By themselves'], ['open', 'Open'], ['shut', 'Shut']]) chip(T, 'd:' + m, n, () => doors(m), 'sub');
  chipsOn(); sizeBar();
}
function chipsOn() {
  for (const [k, b] of Object.entries(chips)) {
    const [t, v] = k.split(':');
    b.classList.toggle('on', (t === 't' && v === state.tab) || (t === 'p' && v === state.part) || (t === 'r' && v === state.room) || (t === 'v' && v === state.variant) || (t === 'w' && v === state.view) || (t === 'd' && v === state.doors));
  }
  const on = document.querySelector('#items .chip.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function sizeBar() { document.body.style.setProperty('--bar', $('#bar').offsetHeight + 'px'); }
function doors(m) { state.doors = m; if (built) { if (m !== 'auto') setDoors(built.doors, m === 'open' ? 1 : 0); renderer.shadowMap.needsUpdate = true; } chipsOn(); }
async function quality(qq) { if (!(qq in QUALITY)) return; state.quality = qq; setupPost(); if (state.tab === 'parts') await showPart(); else await showRoom(); }

// ── numbers ──────────────────────────────────────────────────────────────────────────────────────────────────────
const fps = { n: 0, t: performance.now(), v: 0, ms: 0, cpu: 0 };
let sceneCalls = 0, sceneTris = 0;
function stats() {
  const s = built?.stats || {};
  return { tab: state.tab, what: state.tab === 'parts' ? `${state.part}:${state.variant}` : state.room, quality: state.quality, pieces: s.pieces, meshDraws: s.draws, tris: s.tris, sceneCalls, sceneTris, fps: Math.round(fps.v), frameMs: +fps.ms.toFixed(2), cpuMs: +fps.cpu.toFixed(2), buildMs: s.ms, bake: s.bake, lights: s.lights, doors: s.doors, problems: s.problems, ratio: renderer.getPixelRatio(), size: [canvas.width, canvas.height] };
}
function readout() {
  const s = stats(), what = state.tab === 'parts' ? `${PIECES[state.part].name} · ${state.variant}` : (ROOMS.find((r) => r[0] === state.room)?.[1] || state.room);
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
  resize(); fly(dt); if (dust.visible) dust.userData.update(dt, camera.position);
  if (built && built.doors.length && state.doors === 'auto' && updateDoors(built.doors, camera.position, dt, 'auto')) renderer.shadowMap.needsUpdate = true;
  if (renderer.shadowMap.enabled) renderer.shadowMap.autoUpdate = false;
  const c0 = performance.now();
  draw(dt);
  fps.cpu = fps.cpu * 0.95 + (performance.now() - c0) * 0.05;
  fps.n++; if (now - fps.t > 500) { fps.v = fps.n * 1000 / (now - fps.t); fps.ms = (now - fps.t) / fps.n; fps.n = 0; fps.t = now; readout(); }
}

const KL = window.KL = {
  ready: false, part: (id, v) => showPart(id, v), room: (id) => showRoom(id), view, quality, doors, stats, bench,
  cam: (at, look, fov) => lookFrom(at, look, fov), orbit: (yaw, pitch, dist) => { cam.mode = 'orbit'; cam.yaw = yaw; cam.pitch = pitch; if (dist) cam.dist = dist; applyCam(); },
  list: () => Object.keys(PIECES), variants: (id) => PIECES[id].variants, rooms: () => ROOMS.map((r) => r[0]), get built() { return built; },
  get roomData() { return roomData; }, renderer, scene, camera, mats, state,
};
(async () => {
  touchControls(); setupPost(); resize(true);
  if (q.get('room')) { state.view = q.get('view') || 'start'; await showRoom(q.get('room')); }
  else await showPart(q.get('part') || state.part, q.get('variant') || undefined);
  KL.ready = true;
  renderer.setAnimationLoop(loop);
})().catch((e) => { console.error(e); loading(''); });
