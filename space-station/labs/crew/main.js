// THE CREW LAB: the station's crew, each put together from a recipe (a suit, a head, hair and colours: kit/crew.js,
// the characters in assets/crew/crew.json), standing on the station's own floor (the kit's pieces), playing the
// Mathwood people's clips.
// ONE MENU along the bottom:
//   the characters (one entry a recipe) and every clip their suit's skeleton has (the men's or the women's), its speed;
//   the wardrobe: Head, Hair, Suit (each part a choice: any goes with any; the hair: the Blender styles from the game's
//     maker's grid, drawn as card hair, and the Mathwood hair), Job colours (the suit's marks, light lines and panels; a
//     suit that keeps its own colours, the captains', takes none), Uniform (the suit's whites: a few colours or any),
//     Skin tone, Hair colour; a visor's face (an android's helmet: Captain Vega's expressions), when the head has one;
//     Eyes (a head with real eyes: the Tripo heads): the iris's colour (its own as painted, or one of EYE_COLOURS) and
//     Look at camera (the eyes follow the camera, darting a little as eyes do; off: straight ahead);
//   the view: cameras (Face, Head and Nape follow the head: from the front-left, straight on, from behind), Plain (no
//     paint), Wireframe, the 1.8 m marker, the bones, Smooth hair (the Mathwood hair smooth-shaded, or off: its flat
//     facets as the pack has them);
//   FACE (folds away; a head with face bones: the Tripo heads): a slider for each of FACE's (jaw width, jaw length,
//     chin, cheekbones, nose length and width, nose bridge, brow, eye spacing and size, ears), -1 to 1, kept in the
//     recipe (st.recipe.face), and Reset;
//   FIT (folds away): judge every head and hair one by one and fit the hair shown (kit/crew.js, "a hair's fit"): the
//     head and the hair before and after (the arrow keys too: left and right the hair, up and down the head), nudges up,
//     forward and to their left in millimetres (Fine: smaller steps), Size, Tuck (0 to 500%, by its buttons or its
//     slider: draws the hair in toward the head's centre at every height, keeping its thickness; 100% puts its underside
//     2 mm off this head, past that it's pressed thinner too; never nearer than 2 mm) and where the tuck is full below
//     the top of the hair, Reset; a fit is the hair's on every head
//     unless "Just this head" is on (then it's that head's own adjustment, added to the hair's). Fits are kept in this
//     browser as they're made (over crew.json's own) and worn at once; Copy fits gives them all as JSON for crew.json
//     (shown in a box as well, to select by hand where copying fails); Clear my changes goes back to crew.json's.
// Drag to look round, wheel or pinch to come closer, W A S D move (Space up, C down, Shift faster), the arrow keys step.
//   ?who=<recipe id>  ?clip=<name>  ?cam=<name>  ?flathair (the Mathwood hair flat-shaded to start)  ?look (Look at camera on)
//   window.CREWLAB = { ready, clips, play(name), pose(name, t), cam(name), show(k, on), recipe(r), colours(c), state(),
//     expression(name) (a visor's face), smoothHair(on) (the Mathwood hair's shading; rebuilds the character),
//     look(on) (the eyes on the camera, a head with real eyes), face(values) (the face sliders: { slider: -1..1 }),
//     measure() (the body's lowest point and each boot's, in the pose shown), fit() (the Fit row's state: the fit worn,
//     this browser's fits, the text Copy fits gives), step(kind, d) (the head or hair d along; resolves when shown),
//     three, scene, camera, renderer }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadCrew, makeCrew, fitFor, TUCK_MAX, CLIPS, JOBS, UNIFORM_COLOURS, SKIN_TONES, HAIR_COLOURS, EYE_COLOURS, FACE, EXPRESSIONS } from '../../kit/crew.js';
import { makeMaterials } from '../../kit/materials.js';
import { buildRoom } from '../../kit/layout.js';

const $ = (s) => document.querySelector(s), q = new URLSearchParams(location.search);
const st = { who: null, crew: null, clip: q.get('clip') || 'Idle', speed: 1, paused: false, cam: q.get('cam') || 'Full', paint: 'paint', marker: true, bones: false, recipe: null, look: q.has('look') };
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

// the station's floor: a few of the kit's own plaza tiles, a wall behind with its ribs and trim (kit/layout.js). The
// wall is its own room (a room is merged into one mesh per material), so it can be hidden while the camera is behind
// it, as the Back camera is, and never stands between the camera and the person.
const ROOM = { name: 'Crew Lab floor', pieces: [] };
const WALL = { name: 'Crew Lab wall', pieces: [] };
for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) ROOM.pieces.push({ piece: 'floor', cell: [x, z], turn: 0, variant: x === 0 && z === 0 ? 'plaza2' : 'plaza' });
for (let x = -1; x <= 1; x++) for (const v of ['base', 'cornice']) WALL.pieces.push({ piece: 'trim', cell: [x, -1.5], turn: 0, variant: v });
for (let x = -1; x <= 1; x++) WALL.pieces.push({ piece: 'wall', cell: [x, -1.5], turn: 0, variant: x === 0 ? 'plain' : 'dark' });
for (const x of [-0.5, 0.5]) WALL.pieces.push({ piece: 'rib', cell: [x, -1.5], turn: 0, variant: 'strip' });
let floorGroup = null, wallGroup = null, wallZ = -Infinity;
try {
  const mats = makeMaterials(), bake = { bake: { voxel: 0.09, rays: 20, shadows: false } };
  floorGroup = buildRoom(ROOM, mats, bake).group; floorGroup.traverse((o) => { if (o.isMesh) o.receiveShadow = true; }); scene.add(floorGroup);
  wallGroup = buildRoom(WALL, mats, bake).group; scene.add(wallGroup);
  wallZ = new THREE.Box3().setFromObject(wallGroup).max.z;
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
const lib = await loadCrew({ smoothHair: !q.has('flathair') });
const RECIPES = lib.list.recipes;
// (one character shown: a choice made while the one before is still being put together wins, and the one before is
// dropped, so stepping fast through the heads never leaves two standing)
let showSeq = 0, shownSeq = 0;
async function show(recipe) {
  const seq = ++showSeq;
  st.recipe = JSON.parse(JSON.stringify(recipe));
  const c = await makeCrew(lib, st.recipe);
  // (a fit changed while it was being put together: the latest)
  const want = lib.fitOf(c.recipe.hair, c.recipe.head);
  if (seq === showSeq && JSON.stringify(fitFor(c.fit)) !== JSON.stringify(want)) await c.setFit(want);
  if (seq !== showSeq) { c.dispose(); return; }
  if (st.crew) st.crew.dispose();
  st.crew = c; scene.add(c.root); shownSeq = seq;
  for (const m of Object.values(c.meshes)) m.userData.paint = m.material;
  setPaint(st.paint); setBones(st.bones);
  c.play(st.clip in c.person.actions ? st.clip : 'Idle', { fade: 0 }); c.update(0);
  if (!st.look) c.lookAt(null);
  triCount(); menu();
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
  // (the list lets go of the keys once a choice is made, so the arrow keys step the heads and hair again)
  s.value = value || ''; s.onchange = () => { s.blur(); st.recipe[kind] = s.value || null; show(st.recipe); };
  return s;
}
function menu() {
  // (each row kept where it was scrolled to: on a phone the rows scroll sideways)
  const rows = [...document.querySelectorAll('#bar .kl-row')], keep = rows.map((r) => r.scrollLeft);
  menuRows();
  faceRows();
  fitRows();
  rows.forEach((r, i) => { r.scrollLeft = keep[i]; });
  requestAnimationFrame(layout);
}
function menuRows() {
  const R = st.recipe || {}, C = R.colours || {};
  $('#who').replaceChildren(lab('Crew'), ...Object.entries(RECIPES).map(([id, r]) => chip(r.name, id === st.who, () => { st.who = id; show(r); })),
    // (each skeleton's own clips: the women's have no polishing, hammering or forge clips)
    ...CLIP_GROUPS.flatMap(([g, list]) => [sep(), lab(g), ...list.filter((n) => st.crew?.person.actions[n]).map((n) => chip(LABEL[n] || n, n === st.clip, () => play(n), true))]),
    sep(), lab('Speed'), ...[[0.25, '¼'], [0.5, '½'], [1, '1×']].map(([v, t]) => chip(t, v === st.speed && !st.paused, () => { st.speed = v; st.paused = false; if (st.crew?.person.cur) st.crew.person.cur.setEffectiveTimeScale(v); menu(); }, true)),
    chip(st.paused ? 'Play' : 'Pause', st.paused, () => { st.paused = !st.paused; menu(); }, true));
  // (a visor's face: only when the head has a visor)
  const face = st.crew?.meshes.visor ? [sep(), lab('Visor'), ...Object.entries(EXPRESSIONS).map(([k, t]) => chip(t, st.crew.expression === k, () => expression(k), true))] : [];
  // (a suit that keeps its own colours: the job chips do nothing on it, and say so)
  const sm = st.crew?.meshes.suit, own = !!(sm && (sm.userData.paint || sm.material).userData.crewOwnColours);
  const jobLab = lab(own ? 'Job (own colours)' : 'Job'); if (own) jobLab.title = 'This suit keeps its own colours: a job changes nothing on it (its whites still take the Uniform colour)';
  // (any uniform colour: previewed as it's picked, kept when the picker closes)
  const any = document.createElement('input'); any.type = 'color'; any.className = 'kl-colour'; any.value = C.uniform || '#8a96a3';
  any.title = 'Any uniform colour'; any.setAttribute('aria-label', 'Any uniform colour');
  if (C.uniform && !UNIFORM_COLOURS.includes(C.uniform)) any.classList.add('on');
  any.oninput = () => st.crew?.setColours({ ...(st.recipe.colours || {}), uniform: any.value });
  any.onchange = () => colours({ uniform: any.value });
  // (real eyes: the iris's colour and where they look)
  const ownIris = st.crew?.meshes.eyes?.material.userData.eye?.crIrisOwn.value.getStyle();
  const eyes = st.crew?.gaze ? [sep(), lab('Eyes'), swatch(ownIris || '#4a2e18', !C.eyes, () => colours({ eyes: null }), 'Their own eyes'), ...EYE_COLOURS.map((s) => swatch(s, C.eyes === s, () => colours({ eyes: s }), 'Eyes ' + s)),
    chip('Look at camera', st.look, () => look(!st.look), true, 'The eyes follow the camera (off: straight ahead)')] : [];
  $('#wear').replaceChildren(lab('Head'), pick('Head', 'head', R.head), lab('Hair'), pick('Hair', 'hair', R.hair, true), lab('Suit'), pick('Suit', 'suit', R.suit), ...face,
    sep(), jobLab, ...Object.entries(JOBS).map(([k, J]) => chip(J.name, (C.job || 'explorer') === k, () => colours({ job: k }), true)),
    sep(), lab('Uniform'), swatch('linear-gradient(135deg,#f4f5f6,#9aa3ad)', !C.uniform, () => colours({ uniform: null }), 'The uniform as made'),
    ...UNIFORM_COLOURS.map((s) => swatch(s, C.uniform === s, () => colours({ uniform: s }), 'Uniform ' + s)), any,
    sep(), lab('Skin'), swatch('linear-gradient(135deg,#d9a37f,#86522f)', !C.skin, () => colours({ skin: null }), 'His own skin'), ...SKIN_TONES.map((s) => swatch(s, C.skin === s, () => colours({ skin: s }), 'Skin ' + s)),
    sep(), lab('Hair colour'), swatch('linear-gradient(135deg,#6b4127,#2e1f15)', !C.hair, () => colours({ hair: null }), 'His own hair'), ...HAIR_COLOURS.map((s) => swatch(s, C.hair === s, () => colours({ hair: s }), 'Hair ' + s)), ...eyes);
  $('#view').replaceChildren(lab('Camera'), ...Object.keys(CAMS).map((k) => chip(k, k === st.cam, () => { setCam(k); menu(); }, true)),
    sep(), lab('Show'), ...[['paint', 'Painted'], ['plain', 'Plain'], ['wire', 'Wireframe']].map(([k, t]) => chip(t, st.paint === k, () => { setPaint(k); menu(); }, true)),
    chip('1.8 m', st.marker, () => { st.marker = !st.marker; marker.visible = st.marker; menu(); }, true, 'A 1.8 m post beside them'),
    chip('Bones', st.bones, () => { setBones(!st.bones); menu(); }, true, 'The skeleton'),
    chip('Smooth hair', lib.smoothHair, () => smoothHair(!lib.smoothHair), true, 'The Mathwood hair smooth-shaded (off: its flat facets, as the pack has them)'));
}
async function smoothHair(on) { lib.smoothHair = !!on; if (st.recipe) await show(st.recipe); triCount(); menu(); }
function expression(k) { st.recipe.expression = k; st.crew?.setExpression(k); menu(); }
function look(on) { st.look = !!on; if (!st.look) st.crew?.lookAt(null); menu(); }
// (a colour set back to the part's own (null) is left out of the recipe, but passed on as null: the person merges what it's
// given into its own colours, so a key left out would keep the colour it had)
function colours(c) { st.recipe.colours = { ...(st.recipe.colours || {}), ...c }; for (const k of Object.keys(c)) if (c[k] == null) delete st.recipe.colours[k]; st.crew?.setColours({ ...st.recipe.colours, ...c }); menu(); }

// ── FACE: the face bones' sliders (kit/crew.js FACE), kept in the recipe ─────────────────────────────────────────────
const FACE_OPEN = 'crewlab.faceOpen';
const faceSt = { open: (() => { try { return localStorage.getItem(FACE_OPEN) !== '0'; } catch (_) { return true; } })() };
function face(values) { st.recipe.face = { ...(values || {}) }; for (const k of Object.keys(st.recipe.face)) if (!st.recipe.face[k]) delete st.recipe.face[k]; st.crew?.setFace(st.recipe.face); }
function faceRows() {
  const row = $('#face'), sl = st.crew?.faceSliders || [];
  row.hidden = !sl.length; if (!sl.length) { row.replaceChildren(); return; }
  const F = st.recipe.face || {}, open = faceSt.open, n = Object.keys(F).length;
  const fold = chip(open ? 'Face ▾' : 'Face ▸', open, () => { faceSt.open = !faceSt.open; try { localStorage.setItem(FACE_OPEN, faceSt.open ? '1' : '0'); } catch (_) {} menu(); }, false, 'The face\'s shape: show or fold the sliders');
  fold.setAttribute('aria-expanded', String(open));
  if (!open) { row.replaceChildren(fold, val(n ? `${n} changed` : 'as made')); row.lastChild.classList.add('wide'); return; }
  const items = [fold];
  for (const k of sl) {
    const r = document.createElement('input'); r.type = 'range'; r.min = -100; r.max = 100; r.step = 1; r.value = Math.round((F[k] || 0) * 100);
    r.setAttribute('aria-label', FACE[k].name); r.title = FACE[k].name + ' (less to more)';
    const v = val(((F[k] || 0) * 100 > 0 ? '+' : '') + Math.round((F[k] || 0) * 100));
    r.oninput = () => { const f = { ...(st.recipe.face || {}), [k]: +r.value / 100 }; face(f); v.textContent = (+r.value > 0 ? '+' : '') + r.value; };
    items.push(sep(), lab(FACE[k].name), r, v);
  }
  items.push(sep(), chip('Reset', false, () => { face({}); menu(); }, true, 'Every slider back to the face as made'));
  row.replaceChildren(...items);
}

// ── FIT: the heads and hair one by one, and the hair fitted (kit/crew.js, "a hair's fit") ─────────────────────────────
// This browser's fits (lib.fits: a hair's entry replaces crew.json's fit for that hair) are kept in localStorage as
// they're made; the first change to a hair starts from crew.json's fit for it.
const FIT_KEY = 'crewlab.fits.v1', FIT_OPEN = 'crewlab.fitOpen';
const STEPS = { move: [0.002, 0.0005], size: [0.01, 0.0025], tuck: [0.1, 0.025], start: [0.01, 0.0025] };   // (each: [step, fine step])
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const copy = (o) => JSON.parse(JSON.stringify(o == null ? {} : o));
const rnd = (v, p) => Math.round(v / p) * p;
function hairFit(id) { return own(lib.fits, id) ? lib.fits[id] : (lib.entry('hair', id) || {}).fit; }
// (a fit with nothing in it left out: offsets of zero, a size of 1, no tuck, empty head entries; numbers rounded)
function tidy(f, base) {
  const o = {};
  if (!f) return o;
  if (f.offset && f.offset.some((v) => Math.abs(v) >= 0.00005)) o.offset = f.offset.map((v) => +rnd(v || 0, 0.0001).toFixed(4));
  if (f.scale != null && Math.abs(f.scale - 1) >= 0.00005) o.scale = +(+f.scale).toFixed(4);
  if (f.tuck && Math.abs(f.tuck) >= 0.0005) o.tuck = +(+f.tuck).toFixed(3);
  if (f.tuckStart && Math.abs(f.tuckStart) >= 0.00005) o.tuckStart = +(+f.tuckStart).toFixed(4);
  if (base == null && f.heads) {
    const H = {}; for (const [h, d] of Object.entries(f.heads)) { const t = tidy(d, f); if (Object.keys(t).length) H[h] = t; }
    if (Object.keys(H).length) o.heads = H;
  }
  return o;
}
function readMine() {
  try { const j = JSON.parse(localStorage.getItem(FIT_KEY) || '{}'); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (_) { return {}; }
}
function saveMine() {
  // (a hair whose fit is back to crew.json's own is no longer a change)
  for (const id of Object.keys(lib.fits)) if (JSON.stringify(tidy(lib.fits[id])) === JSON.stringify(tidy((lib.entry('hair', id) || {}).fit))) delete lib.fits[id];
  try { if (Object.keys(lib.fits).length) localStorage.setItem(FIT_KEY, JSON.stringify(lib.fits)); else localStorage.removeItem(FIT_KEY); return true; }
  catch (_) { fitSt.note = 'This browser would not keep the fits: Copy fits before you leave.'; return false; }
}
lib.fits = readMine();
const fitSt = { open: (() => { try { return localStorage.getItem(FIT_OPEN) !== '0'; } catch (_) { return true; } })(), scope: 'all', fine: false, out: null, note: '' };
// a change to the hair shown: to its fit on every head, or (Just this head) to that head's own adjustment
async function fitEdit(change, quiet) {
  const hair = st.recipe?.hair, head = st.recipe?.head; if (!hair) return;
  if (!own(lib.fits, hair)) lib.fits[hair] = copy((lib.entry('hair', hair) || {}).fit);
  const F = lib.fits[hair];
  if (fitSt.scope === 'head' && head) { F.heads = F.heads || {}; change(F.heads[head] = F.heads[head] || {}, F); }
  else change(F, null);
  lib.fits[hair] = tidy(F);
  fitSt.note = '';
  saveMine(); await wearFit(quiet);
}
// (quiet: the rows left as they are, while the tuck's slider is dragged)
async function wearFit(quiet) { if (st.crew) await st.crew.setFit(lib.fitOf(st.crew.recipe.hair, st.crew.recipe.head)); if (!quiet) fitRowsKeep(); }
const fine = (k) => STEPS[k][fitSt.fine ? 1 : 0];
// (each change keeps the fit worn within its limits: the tuck 0 to 500%, the size 80 to 125%, the start 0 to 30 cm)
function nudge(axis, dir) { fitEdit((t) => { t.offset = t.offset || [0, 0, 0]; t.offset[axis] = rnd((t.offset[axis] || 0) + dir * fine('move'), 0.0001); }); }
function resize(dir) {
  fitEdit((t, base) => {
    const b = base ? (base.scale == null ? 1 : base.scale) : 1, now = (t.scale == null ? 1 : t.scale) * b;
    const next = Math.min(1.25, Math.max(0.8, now + dir * fine('size')));
    t.scale = +(next / b).toFixed(5);
  });
}
function retuck(key, dir, max) {
  fitEdit((t, base) => {
    const b = base ? base[key] || 0 : 0, next = Math.min(max, Math.max(0, b + (t[key] || 0) + dir * fine(key === 'tuck' ? 'tuck' : 'start')));
    t[key] = +(next - b).toFixed(5);
  });
}
// (the tuck set to a value (the slider), on every head or this head's own: what the hair's own fit doesn't give)
function setTuck(v, quiet) {
  return fitEdit((t, base) => { const b = base ? base.tuck || 0 : 0; t.tuck = +(Math.min(TUCK_MAX, Math.max(0, v)) - b).toFixed(5); }, quiet);
}
function fitReset() {
  const hair = st.recipe?.hair, head = st.recipe?.head; if (!hair) return;
  fitEdit((t, base) => {
    if (base) { delete base.heads[head]; return; }
    for (const k of ['offset', 'scale', 'tuck', 'tuckStart']) delete t[k];
  });
}
function clearMine() {
  if (!Object.keys(lib.fits).length) { fitSt.note = 'No changes of yours to clear.'; fitRowsKeep(); return; }
  if (!confirm('Clear your fits in this browser and go back to crew.json\'s? (Copy fits first to keep them.)')) return;
  lib.fits = {}; saveMine(); fitSt.note = 'Back to crew.json\'s fits.'; wearFit();
}
// every hair's fit (this browser's over crew.json's), for crew.json: one hair a line
function fitsText() {
  const lines = [];
  for (const P of lib.list.parts.hair) { const t = tidy(hairFit(P.id)); if (Object.keys(t).length) lines.push('  ' + JSON.stringify(P.id) + ': ' + JSON.stringify(t)); }
  return lines.length ? '{\n' + lines.join(',\n') + '\n}' : '{}';
}
async function copyFits() {
  const text = fitsText(); fitSt.out = text;
  let ok = false;
  try { await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 1500))]); ok = true; } catch (_) { ok = false; }
  fitRowsKeep();
  let box = $('#fitout textarea');
  if (box && !ok) { box.focus(); box.select(); try { ok = document.execCommand('copy'); } catch (_) { ok = false; } }
  fitSt.note = ok ? 'Copied. The text is in the box below too.' : 'Copying did not work here: the text is in the box below, selected; copy it from there.';
  fitRowsKeep(); requestAnimationFrame(layout);
  box = $('#fitout textarea');
  if (box) { box.focus({ preventScroll: true }); box.select(); }
}
// the head or the hair before or after (the hair's list starts with none), wrapping round
async function step(kind, d) {
  if (!st.recipe) return;
  const ids = [...(kind === 'hair' ? [null] : []), ...lib.list.parts[kind].map((p) => p.id)];
  const i = Math.max(0, ids.indexOf(st.recipe[kind] || null));
  await show({ ...st.recipe, [kind]: ids[(i + d + ids.length) % ids.length] });
}
// (a fit's few words: "up 2.0 mm, tuck 30%")
function fitWords(f) {
  if (!f) return 'as made';
  const mm = (v) => (Math.abs(v) * 1000).toFixed(1), w = [];
  const [x, y, z] = f.offset;
  if (Math.abs(y) >= 0.00005) w.push((y > 0 ? 'up ' : 'down ') + mm(y));
  if (Math.abs(z) >= 0.00005) w.push((z > 0 ? 'fwd ' : 'back ') + mm(z));
  if (Math.abs(x) >= 0.00005) w.push((x > 0 ? 'their left ' : 'their right ') + mm(x));
  const s = w.length ? [w.join(', ') + ' mm'] : [];
  if (Math.abs(f.scale - 1) >= 0.00005) s.push('size ' + +(f.scale * 100).toFixed(2) + '%');
  if (f.tuck > 0) s.push('tuck ' + Math.round(f.tuck * 100) + '%' + (f.tuckStart > 0 ? ' from ' + +(f.tuckStart * 100).toFixed(2) + ' cm down' : ''));
  return s.length ? s.join(', ') : 'as made';
}
const val = (t, title) => { const s = document.createElement('span'); s.className = 'kl-val'; s.textContent = t; if (title) s.title = title; return s; };
// (a value with a button either side: what it does goes in each button's title)
const knob = (label, value, less, more, tl, tm, title) => [lab(label), chip(less[0], false, less[1], true, tl), val(value, title), chip(more[0], false, more[1], true, tm)];
function fitRowsKeep() { const rows = ['#fit', '#fit2', '#fitout'].map((s) => $(s)), keep = rows.map((r) => r.scrollLeft); fitRows(); rows.forEach((r, i) => { r.scrollLeft = keep[i]; }); }
function fitRows() {
  const R = st.recipe || {}, hair = R.hair, head = R.head, open = fitSt.open;
  const F = hair ? hairFit(hair) : null, f = hair ? fitFor(F, head) : null, ownHead = !!(F && F.heads && F.heads[head] && Object.keys(F.heads[head]).length);
  const P = hair && lib.entry('hair', hair), H = lib.entry('head', head);
  const mine = Object.keys(lib.fits).length;
  const fold = chip(open ? 'Fit ▾' : 'Fit ▸', open, () => { fitSt.open = !fitSt.open; try { localStorage.setItem(FIT_OPEN, fitSt.open ? '1' : '0'); } catch (_) {} menu(); }, false, 'Fit the hair: show or fold these rows');
  fold.setAttribute('aria-expanded', String(open));
  const what = val(`${P ? P.name : 'No hair'} on ${H ? H.name : 'no head'}: ${hair ? fitWords(f) : '-'}`);
  what.classList.add('wide');
  if (!open) {
    $('#fit').replaceChildren(fold, what); $('#fit2').hidden = true; $('#fitout').hidden = true; return;
  }
  const scope = chip('Just this head' + (ownHead ? ' •' : ''), fitSt.scope === 'head', () => { fitSt.scope = fitSt.scope === 'head' ? 'all' : 'head'; fitRowsKeep(); }, true,
    'On: changes are this head\'s own, added to the hair\'s fit on every head (• this head has some). Off: the hair\'s fit on every head.');
  $('#fit').replaceChildren(fold,
    lab('Head'), chip('‹', false, () => step('head', -1), true, 'The head before (up arrow)'), chip('›', false, () => step('head', 1), true, 'The next head (down arrow)'),
    lab('Hair'), chip('‹', false, () => step('hair', -1), true, 'The hair before (left arrow)'), chip('›', false, () => step('hair', 1), true, 'The next hair (right arrow)'),
    sep(), scope,
    chip('Fine', fitSt.fine, () => { fitSt.fine = !fitSt.fine; fitRowsKeep(); }, true, 'Small steps: 0.5 mm, 0.25%, tuck 2.5%, 2.5 mm (off: 2 mm, 1%, 10%, 1 cm)'),
    chip('Reset', false, fitReset, true, fitSt.scope === 'head' ? 'This head back to the hair\'s fit on every head' : 'This hair back to as made (each head\'s own adjustments stay)'),
    sep(), chip('Copy fits', false, copyFits, true, 'Every hair\'s fit as JSON, for crew.json'),
    chip('Clear my changes' + (mine ? ` (${mine})` : ''), false, clearMine, true, 'Forget this browser\'s fits: back to crew.json\'s'),
    what, ...(fitSt.note && fitSt.out == null ? [val(fitSt.note)] : []));
  $('#fit').lastChild.classList.add('wide');
  const row2 = $('#fit2'); row2.hidden = false;
  if (!hair) row2.replaceChildren(val('No hair on: step to one (‹ › or the left and right arrows)'));
  else if (P && P.paint) row2.replaceChildren(val('A painted cut (stubble on the skin itself): nothing to fit'));
  else {
    const mm = (v) => (v >= 0.00005 ? '+' : v <= -0.00005 ? '−' : '') + (Math.abs(v) * 1000).toFixed(1) + ' mm', st2 = st.crew?.fitStats;
    row2.replaceChildren(
      ...knob('Up', mm(f.offset[1]), ['▼', () => nudge(1, -1)], ['▲', () => nudge(1, 1)], 'Down', 'Up'), sep(),
      ...knob('Forward', mm(f.offset[2]), ['−', () => nudge(2, -1)], ['+', () => nudge(2, 1)], 'Back (toward the nape)', 'Forward (toward the face)'), sep(),
      ...knob('Their left', mm(f.offset[0]), ['−', () => nudge(0, -1)], ['+', () => nudge(0, 1)], 'To their right (your left as you face them)', 'To their left (your right as you face them)'), sep(),
      ...knob('Size', +(f.scale * 100).toFixed(2) + '%', ['−', () => resize(-1)], ['+', () => resize(1)], 'A touch smaller', 'A touch bigger'), sep(),
      ...knob('Tuck', Math.round(f.tuck * 100) + '%', ['−', () => retuck('tuck', -1, TUCK_MAX)], ['+', () => retuck('tuck', 1, TUCK_MAX)], 'Less', 'More: drawn in toward the head\'s centre',
        st2 && f.tuck > 0 ? `${st2.tucked} points drawn in, ${st2.held} of them stopped 2 mm off the head` : 'The hair drawn in toward the head\'s centre, its thickness kept: 100% puts its underside 2 mm off this head; past 100% it\'s pressed thinner too'),
      tuckSlider(f.tuck), sep(),
      ...knob('Full from', +(f.tuckStart * 100).toFixed(2) + ' cm', ['−', () => retuck('tuckStart', -1, 0.3)], ['+', () => retuck('tuckStart', 1, 0.3)], 'Higher (nearer the crown)', 'Lower',
        'How far below the top of the hair the tuck is full (above it, it fades out over 2 cm; 0: full all over)'));
  }
  const out = $('#fitout');
  out.hidden = fitSt.out == null;
  if (fitSt.out != null) {
    const box = document.createElement('textarea'); box.readOnly = true; box.spellcheck = false; box.value = fitSt.out; box.setAttribute('aria-label', 'Every hair\'s fit, as JSON');
    box.rows = Math.min(6, fitSt.out.split('\n').length);
    // (what copying did, on its own line above the box: on a phone the Fit row's far end is out of sight)
    const said = fitSt.note ? [Object.assign(val(fitSt.note), { className: 'kl-val wide said' })] : [];
    out.replaceChildren(...said, box, chip('Close', false, () => { fitSt.out = null; fitSt.note = ''; menu(); }, true, 'Hide the box'));
  }
}
// (the tuck's slider, 0 to 500%: the fit worn as it's dragged, the rows remade when it's let go)
function tuckSlider(v) {
  const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = Math.round(TUCK_MAX * 100); r.step = 5; r.value = Math.round(v * 100);
  r.setAttribute('aria-label', 'Tuck'); r.title = 'Tuck: 0 to ' + Math.round(TUCK_MAX * 100) + '% (100%: the underside 2 mm off this head; past it, pressed thinner)';
  r.oninput = () => { const k = r.previousElementSibling && r.previousElementSibling.previousElementSibling; if (k) k.textContent = r.value + '%'; setTuck(+r.value / 100, true); };
  r.onchange = () => { r.blur(); setTuck(+r.value / 100); };
  return r;
}
function layout() {
  const bar = $('#bar').offsetHeight, W = innerWidth, H = Math.max(80, innerHeight - bar);
  document.documentElement.style.setProperty('--bar', bar + 'px');
  canvas.style.height = H + 'px'; canvas.style.width = W + 'px';
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
}

// ── W A S D: move the view (Space up, C down, Shift faster); the arrow keys step the hair (left, right) and the head
// (up, down), the Fit row's own keys ────────────────────────────────────────────────────────────────────────────
const keys = new Set();
const ARROWS = { ArrowLeft: ['hair', -1], ArrowRight: ['hair', 1], ArrowUp: ['head', -1], ArrowDown: ['head', 1] };
const typing = (t) => t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA';   // (a face slider too)
addEventListener('keydown', (e) => {
  if (typing(e.target)) return;
  if (ARROWS[e.code] && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); step(...ARROWS[e.code]); return; }
  keys.add(e.code); if (e.code === 'Space') e.preventDefault();
});
// (Space flies up; it doesn't also press the menu button last pressed)
addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Space' && e.target.tagName === 'BUTTON') e.preventDefault(); });
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
  if (c && st.look && c.gaze) c.lookAt(camera.position);
  if (c && !st.paused) {
    if (HEAD_CAMS[st.cam]) headAt(_prev);
    c.update(dt);
    // (the head cameras keep the head in frame as the clip moves it)
    if (HEAD_CAMS[st.cam]) { headAt(_h); _h.sub(_prev); controls.target.add(_h); camera.position.add(_h); }
  }
  fly(dt); controls.update();
  if (wallGroup) wallGroup.visible = camera.position.z > wallZ;
  renderer.render(scene, camera); frames++;
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
  recipe: async (r) => { await show(r); return st.recipe; }, who: async (id) => { st.who = id; await show(RECIPES[id]); },
  colours: (c) => colours(c), expression: (k) => expression(k), smoothHair: (on) => smoothHair(on), look: (on) => look(on), face: (v) => { face(v); menu(); },
  state: () => ({ who: st.who, clip: st.clip, recipe: st.recipe, tris, fps, parts: Object.keys(st.crew?.meshes || {}), body: st.crew?.body, expression: st.crew?.expression, rig: st.crew?.rig && { turnDiffMaxDeg: st.crew.rig.turnDiffMaxDeg }, smoothHair: lib.smoothHair,
    look: st.look, eyes: !!st.crew?.gaze, faceSliders: st.crew?.faceSliders || [], face: st.recipe?.face || {}, gaze: st.crew?.gaze ? { target: st.crew.gaze.target && st.crew.gaze.target.toArray(), eye: st.crew.gaze.eye } : null,
    shown: shownSeq === showSeq }),
  fit: () => ({ open: fitSt.open, scope: fitSt.scope, fine: fitSt.fine, hair: st.recipe?.hair, head: st.recipe?.head, wearing: st.crew?.fit || null, stats: st.crew?.fitStats,
    wearingFor: st.crew && { hair: st.crew.recipe.hair, head: st.crew.recipe.head }, mine: copy(lib.fits), text: fitsText(), box: fitSt.out, note: fitSt.note }),
  step: (kind, d) => step(kind, d),
  measure, crew: () => st.crew, three: THREE, scene, camera, renderer, controls,
};
