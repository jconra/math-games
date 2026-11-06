// THE CREW LAB: the station's crew, each put together from a recipe (a suit, a head, hair and colours: kit/crew.js,
// the characters in assets/crew/crew.json), standing on the station's own floor (the kit's pieces), playing the
// Mathwood people's clips.
// ONE MENU along the bottom:
//   the characters (one entry a recipe) and every clip their suit's skeleton has (the men's or the women's), its speed;
//   the wardrobe: Head, Hair, Suit (each part a choice: any goes with any, the Mathwood hair among them), Job colours
//     (the suit's marks, light lines and panels), Skin tone, Hair colour;
//   the view: cameras (Face, Head and Nape follow the head: from the front-left, straight on, from behind), Plain (no
//     paint), Wireframe, the 1.8 m marker, the bones.
// Drag to look round, wheel or pinch to come closer, W A S D move (Space up, C down, Shift faster).
//   ?who=<recipe id>  ?clip=<name>  ?cam=<name>
//   window.CREWLAB = { ready, clips, play(name), pose(name, t), cam(name), show(k, on), recipe(r), colours(c), state(),
//     measure() (the body's lowest point and each boot's, in the pose shown), three, scene, camera, renderer }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadCrew, makeCrew, CLIPS, JOBS, SKIN_TONES, HAIR_COLOURS } from '../../kit/crew.js';
import { makeMaterials } from '../../kit/materials.js';
import { buildRoom } from '../../kit/layout.js';

const $ = (s) => document.querySelector(s), q = new URLSearchParams(location.search);
const st = { who: null, crew: null, clip: q.get('clip') || 'Idle', speed: 1, paused: false, cam: q.get('cam') || 'Full', paint: 'paint', marker: true, bones: false, recipe: null };
// (the clips in the menu, grouped as the people use them)
const CLIP_GROUPS = [
  ['Stand', ['Idle', 'Idle_Neutral', 'Wave', 'Interact', 'Stand_Listen', 'Stand_Clap']],
  ['Move', ['Walk', 'Run', 'Run_Back', 'Run_Left', 'Run_Right', 'Roll']],
  ['Sit', ['Sit_Listen', 'Sit_Clap', 'Stool_Bar', 'Stool_Clap', 'Drive']],
  ['Work', ['Bar_Polish', 'Hammer', 'Tend_Forge']],
  ['Hit', ['HitRecieve', 'Death']],
];
const LABEL = { Idle_Neutral: 'Idle 2', HitRecieve: 'Hit', Run_Back: 'Run back', Run_Left: 'Run left', Run_Right: 'Run right', Stand_Listen: 'Listen', Stand_Clap: 'Clap', Sit_Listen: 'Sit', Sit_Clap: 'Sit clap', Stool_Bar: 'Stool', Stool_Clap: 'Stool clap', Bar_Polish: 'Polish', Tend_Forge: 'Tend' };
const CAMS = { Full: [1.15, 1.25, 3.5, 0.93], Front: [0, 1.1, 3.8, 0.93], Side: [3.8, 1.1, 0, 0.93], Back: [0, 1.1, -3.8, 0.93], Face: null, Head: null, Nape: null, Hands: null };
// (the close cameras on the head, following it: from the front-left, straight in front, from behind; offsets in metres)
const HEAD_CAMS = { Face: [0.22, 0.04, 0.62], Head: [0, 0.03, 0.7], Nape: [-0.25, 0.08, -0.65] };

// ── renderer, scene, camera ───────────────────────────────────────────────────────────────────────────────────────
const canvas = $('#c'), hud = $('#hud'), loading = $('#loading');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: q.has('rig') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1017);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xdfeaff, 0x2a3038, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(2.5, 5, 3.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
Object.entries({ left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 }).forEach(([k, v]) => { sun.shadow.camera[k] = v; });
scene.add(sun);
const fill = new THREE.DirectionalLight(0xbfd8ff, 0.7); fill.position.set(-3, 2.5, 2); scene.add(fill);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 120);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 0.25; controls.maxDistance = 25;

// the station's floor: a few of the kit's own plaza tiles, a wall behind with its ribs and trim (kit/layout.js)
const ROOM = { name: 'Crew Lab floor', pieces: [] };
for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) ROOM.pieces.push({ piece: 'floor', cell: [x, z], turn: 0, variant: x === 0 && z === 0 ? 'plaza2' : 'plaza' });
for (let x = -1; x <= 1; x++) for (const v of ['base', 'cornice']) ROOM.pieces.push({ piece: 'trim', cell: [x, -1.5], turn: 0, variant: v });
for (let x = -1; x <= 1; x++) ROOM.pieces.push({ piece: 'wall', cell: [x, -1.5], turn: 0, variant: x === 0 ? 'plain' : 'dark' });
for (const x of [-0.5, 0.5]) ROOM.pieces.push({ piece: 'rib', cell: [x, -1.5], turn: 0, variant: 'strip' });
let floorGroup = null;
try {
  const built = buildRoom(ROOM, makeMaterials(), { bake: { voxel: 0.09, rays: 20, shadows: false } });
  floorGroup = built.group; floorGroup.traverse((o) => { if (o.isMesh) o.receiveShadow = true; }); scene.add(floorGroup);
} catch (e) { console.warn('Crew Lab: the kit floor could not be built (' + e.message + '); a plain floor instead'); }
if (!floorGroup) { const f = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.8 })); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f); }

// the 1.8 m marker: a thin post beside them, a tick every half metre, its height written at the top
const marker = new THREE.Group();
{
  const m = new THREE.MeshBasicMaterial({ color: 0xf2b547 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.8, 0.012), m); post.position.y = 0.9; marker.add(post);
  for (const y of [0.5, 1, 1.5, 1.8]) { const t = new THREE.Mesh(new THREE.BoxGeometry(y === 1.8 ? 0.16 : 0.08, 0.008, 0.012), m); t.position.y = y; marker.add(t); }
  const c = document.createElement('canvas'); c.width = 128; c.height = 48; const g = c.getContext('2d');
  g.fillStyle = '#f2b547'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1.8 m', 64, 25);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false })); s.scale.set(0.3, 0.11, 1); s.position.y = 1.93; marker.add(s);
  marker.position.set(0.65, 0, -0.1);
}
scene.add(marker);
const PLAIN = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.6, metalness: 0.05 });
const WIRE = new THREE.MeshBasicMaterial({ color: 0x9fdcff, wireframe: true, transparent: true, opacity: 0.55 });
let skel = null;

// ── the crew ───────────────────────────────────────────────────────────────────────────────────────────────────────
loading.textContent = 'Waking the crew…';
const lib = await loadCrew();
const RECIPES = lib.list.recipes;
async function show(recipe) {
  st.recipe = JSON.parse(JSON.stringify(recipe));
  const old = st.crew;
  const c = await makeCrew(lib, st.recipe);
  if (old) { old.dispose(); }
  st.crew = c; scene.add(c.root);
  for (const m of Object.values(c.meshes)) m.userData.paint = m.material;
  setPaint(st.paint); setBones(st.bones);
  c.play(st.clip in c.person.actions ? st.clip : 'Idle', { fade: 0 }); c.update(0);
  menu();
}
function setPaint(p) {
  st.paint = p; if (!st.crew) return;
  for (const m of Object.values(st.crew.meshes)) m.material = p === 'plain' ? PLAIN : p === 'wire' ? WIRE : m.userData.paint;
}
function setBones(on) {
  st.bones = on; if (skel) { scene.remove(skel); skel.dispose(); skel = null; }
  if (on && st.crew) { skel = new THREE.SkeletonHelper(st.crew.root); skel.material.depthTest = false; skel.material.linewidth = 2; scene.add(skel); }
}
function play(name, o = {}) { st.clip = name; st.paused = false; if (st.crew) st.crew.play(name, { speed: st.speed, ...o }); menu(); }
// (for pictures and checks: the clip held at time t seconds)
function pose(name, t) {
  const c = st.crew; if (!c) return null;
  const a = c.person.actions[name]; if (!a) return null;
  c.person.mixer.stopAllAction(); c.person.cur = null; st.clip = name;
  a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.setEffectiveWeight(1).setEffectiveTimeScale(1).play();
  // (a jump with no fade: three's mixer writes a bone only when its value differs from the frame before, and the
  // Mathwood person puts its bent bones back as the mixer last left them, so a clip's held foot could keep the last
  // clip's turn. Its memory of the frame before is cleared, so every bone is written now)
  for (const pm of a._propertyBindings) if (pm) pm.buffer.fill(NaN, pm.valueSize, pm.valueSize * 3);
  c.person.cur = a; c.person.curName = name; a.time = t; st.paused = true;
  c.update(0); menu(); return a.getClip().duration;
}

// ── the view ──────────────────────────────────────────────────────────────────────────────────────────────────────
const _h = new THREE.Vector3(), _f = new THREE.Vector3();
function headAt(v) { const B = st.crew?.bones; if (!B) return v.set(0, 1.7, 0); return B.Head.getWorldPosition(v).add(_f.set(0, 0.09, 0.03)); }
function setCam(name) {
  st.cam = name;
  if (HEAD_CAMS[name]) { const o = HEAD_CAMS[name]; headAt(_h); controls.target.copy(_h); camera.position.set(_h.x + o[0], _h.y + o[1], _h.z + o[2]); }
  else if (name === 'Hands') { controls.target.set(0, 1.0, 0.1); camera.position.set(0.7, 1.35, 1.4); }
  else { const [x, y, z, ty] = CAMS[name]; controls.target.set(0, ty, 0); camera.position.set(x, y, z); }
  controls.update();
}

// ── the menu ──────────────────────────────────────────────────────────────────────────────────────────────────────
const chip = (label, on, fn, sub, title) => { const b = document.createElement('button'); b.className = 'chip' + (sub ? ' sub' : '') + (on ? ' on' : ''); b.textContent = label; b.onclick = fn; if (title) b.title = title; return b; };
const swatch = (col, on, fn, title) => { const b = chip('', on, fn, true, title); b.classList.add('sw'); b.style.background = col; b.setAttribute('aria-label', title); return b; };
const lab = (t) => { const s = document.createElement('span'); s.className = 'kl-label'; s.textContent = t; return s; };
const sep = () => Object.assign(document.createElement('span'), { className: 'kl-sep' });
function pick(label, kind, value, none) {
  const s = document.createElement('select'); s.setAttribute('aria-label', label);
  if (none) s.append(new Option('None', ''));
  for (const p of lib.list.parts[kind] || []) s.append(new Option(p.name, p.id));
  s.value = value || ''; s.onchange = () => { st.recipe[kind] = s.value || null; show(st.recipe); };
  return s;
}
function menu() {
  const R = st.recipe || {}, C = R.colours || {};
  $('#who').replaceChildren(lab('Crew'), ...Object.entries(RECIPES).map(([id, r]) => chip(r.name, id === st.who, () => { st.who = id; show(r); })),
    // (each skeleton's own clips: the women's have no polishing, hammering or forge clips)
    ...CLIP_GROUPS.flatMap(([g, list]) => [sep(), lab(g), ...list.filter((n) => st.crew?.person.actions[n]).map((n) => chip(LABEL[n] || n, n === st.clip, () => play(n), true))]),
    sep(), lab('Speed'), ...[[0.25, '¼'], [0.5, '½'], [1, '1×']].map(([v, t]) => chip(t, v === st.speed && !st.paused, () => { st.speed = v; st.paused = false; if (st.crew?.person.cur) st.crew.person.cur.setEffectiveTimeScale(v); menu(); }, true)),
    chip(st.paused ? 'Play' : 'Pause', st.paused, () => { st.paused = !st.paused; menu(); }, true));
  $('#wear').replaceChildren(lab('Head'), pick('Head', 'head', R.head), lab('Hair'), pick('Hair', 'hair', R.hair, true), lab('Suit'), pick('Suit', 'suit', R.suit),
    sep(), lab('Job'), ...Object.entries(JOBS).map(([k, J]) => chip(J.name, (C.job || 'explorer') === k, () => colours({ job: k }), true)),
    sep(), lab('Skin'), swatch('linear-gradient(135deg,#d9a37f,#86522f)', !C.skin, () => colours({ skin: null }), 'His own skin'), ...SKIN_TONES.map((s) => swatch(s, C.skin === s, () => colours({ skin: s }), 'Skin ' + s)),
    sep(), lab('Hair colour'), swatch('linear-gradient(135deg,#6b4127,#2e1f15)', !C.hair, () => colours({ hair: null }), 'His own hair'), ...HAIR_COLOURS.map((s) => swatch(s, C.hair === s, () => colours({ hair: s }), 'Hair ' + s)));
  $('#view').replaceChildren(lab('Camera'), ...Object.keys(CAMS).map((k) => chip(k, k === st.cam, () => { setCam(k); menu(); }, true)),
    sep(), lab('Show'), ...[['paint', 'Painted'], ['plain', 'Plain'], ['wire', 'Wireframe']].map(([k, t]) => chip(t, st.paint === k, () => { setPaint(k); menu(); }, true)),
    chip('1.8 m', st.marker, () => { st.marker = !st.marker; marker.visible = st.marker; menu(); }, true, 'A 1.8 m post beside them'),
    chip('Bones', st.bones, () => { setBones(!st.bones); menu(); }, true, 'The skeleton'));
  requestAnimationFrame(layout);
}
function colours(c) { st.recipe.colours = { ...(st.recipe.colours || {}), ...c }; for (const k of Object.keys(c)) if (c[k] == null) delete st.recipe.colours[k]; st.crew?.setColours(st.recipe.colours); menu(); }
function layout() {
  const bar = $('#bar').offsetHeight, W = innerWidth, H = Math.max(80, innerHeight - bar);
  document.documentElement.style.setProperty('--bar', bar + 'px');
  canvas.style.height = H + 'px'; canvas.style.width = W + 'px';
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
}

// ── W A S D: move the view (Space up, C down, Shift faster) ──────────────────────────────────────────────────────
const keys = new Set();
addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const _r = new THREE.Vector3(), _m = new THREE.Vector3(), _w = new THREE.Vector3();
function fly(dt) {
  if (!keys.size) return;
  camera.getWorldDirection(_w); _w.y = 0; _w.normalize(); _r.crossVectors(_w, camera.up).normalize(); _m.set(0, 0, 0);
  if (keys.has('KeyW')) _m.add(_w); if (keys.has('KeyS')) _m.sub(_w); if (keys.has('KeyD')) _m.add(_r); if (keys.has('KeyA')) _m.sub(_r);
  if (keys.has('Space')) _m.y += 1; if (keys.has('KeyC')) _m.y -= 1;
  if (!_m.lengthSq()) return;
  _m.normalize().multiplyScalar(dt * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4 : 1.5));
  camera.position.add(_m); controls.target.add(_m);
}

// ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────────
addEventListener('resize', layout);
let last = performance.now(), fpsT = 0, frames = 0, fps = 0;
const _prev = new THREE.Vector3();
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  const c = st.crew;
  if (c && !st.paused) {
    if (HEAD_CAMS[st.cam]) headAt(_prev);
    c.update(dt);
    // (the head cameras keep the head in frame as the clip moves it)
    if (HEAD_CAMS[st.cam]) { headAt(_h); _h.sub(_prev); controls.target.add(_h); camera.position.add(_h); }
  }
  fly(dt); controls.update(); renderer.render(scene, camera); frames++;
  fpsT += dt; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  if (c) hud.textContent = `${RECIPES[st.who]?.name || ''} · ${LABEL[st.clip] || st.clip} · ${tris.toLocaleString()} tris · ${fps} fps`;
});
let tris = 0;
const triCount = () => { tris = 0; st.crew?.root.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); };

st.who = RECIPES[q.get('who')] ? q.get('who') : Object.keys(RECIPES)[0];
await show(RECIPES[st.who]); triCount();
layout(); setCam(CAMS[st.cam] !== undefined ? st.cam : 'Full'); menu();
loading.hidden = true;

// the body's lowest point and each boot's lowest, in the pose shown (the skinned vertices themselves)
const _v = new THREE.Vector3();
function measure() {
  const c = st.crew; if (!c) return null; c.root.updateMatrixWorld(true);
  const res = { minY: Infinity, boots: { L: Infinity, R: Infinity } };
  for (const [kind, m] of Object.entries(c.meshes)) {
    const p = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    const fl = m.skeleton.bones.findIndex((b) => b.name === 'FootL'), fr = m.skeleton.bones.findIndex((b) => b.name === 'FootR');
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i); m.applyBoneTransform(i, _v); _v.applyMatrix4(m.matrixWorld);
      res.minY = Math.min(res.minY, _v.y);
      let wl = 0, wr = 0; for (let k = 0; k < 4; k++) { const b = si.getComponent(i, k), w = sw.getComponent(i, k); if (b === fl) wl += w; if (b === fr) wr += w; }
      if (wl > 0.5) res.boots.L = Math.min(res.boots.L, _v.y); if (wr > 0.5) res.boots.R = Math.min(res.boots.R, _v.y);
    }
  }
  return res;
}
window.CREWLAB = {
  ready: true, clips: () => CLIPS.filter((n) => st.crew?.person.actions[n]), play: (n) => play(n), pose, cam: (c) => { setCam(c); menu(); },
  show: (k, on) => { if (k === 'paint' || k === 'plain' || k === 'wire') setPaint(k); if (k === 'marker') { st.marker = on; marker.visible = on; } if (k === 'bones') setBones(on); if (k === 'floor' && floorGroup) floorGroup.visible = on; menu(); },
  recipe: async (r) => { await show(r); triCount(); return st.recipe; }, who: async (id) => { st.who = id; await show(RECIPES[id]); triCount(); },
  colours: (c) => colours(c), state: () => ({ who: st.who, clip: st.clip, recipe: st.recipe, tris, fps, parts: Object.keys(st.crew?.meshes || {}), body: st.crew?.body, rig: st.crew?.rig && { turnDiffMaxDeg: st.crew.rig.turnDiffMaxDeg } }),
  measure, crew: () => st.crew, three: THREE, scene, camera, renderer, controls,
};
