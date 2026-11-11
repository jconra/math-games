// THE CREW LAB: the station's crew, each put together from a recipe (a suit, a head, hair and colours: kit/crew.js,
// the characters in assets/crew/crew.json), standing on the station's own floor (the kit's pieces), playing the
// Mathwood people's clips.
// THE MENUS (2026-11-11, windows.js; the game's maker: "I just feel kind of overwhelmed with all the controls on the
// bottom and it's hard to find what I am looking for. Also, some things are in 2 places"): a small MASTER MENU of
// category buttons, dragged anywhere by its top bar and never closed; each button opens its category's WINDOW (about
// square, dragged by its top bar, closed by its X or Esc; several open at once, the one touched in front). Inside a
// window everything wraps onto new lines (nothing scrolls sideways); a long window scrolls up and down inside itself.
// Where the windows are and which are open are kept for this browser tab only. EVERY CONTROL IS IN ONE PLACE ONLY:
//   CREW     the ready-made crew members (crew.json recipes), each a whole recipe
//   BODIES   a grid of picture buttons, one an outfit (thumbs.js: drawn from the kit as the window opens; the one worn
//            outlined), and under it Hands (by outfit: the man's on a men's-skeleton outfit, the woman's on a women's;
//            either; none) and Height (the recipe's size, kit/crew.js SIZES: Shorter, Medium, Taller)
//   HEADS    a grid of picture buttons, one a head, and under it how the head sits on the outfit: Seat (kit/crew.js THE
//            SEAT: how much lower this head sits in this outfit's collar, in 2 mm steps)
//   HAIR     a grid of picture buttons ("No hair" first), and under it its FIT (kit/crew.js "a hair's fit"): what the
//            changes apply to, one of three (This hair, every head: the hair's own fit; This hair on this head only: the
//            pair's own, added to the hair's; Every hair on this head: the head's own setting, crew.json's head entry
//            hairFit, under every hair worn on it), and a line adding the levels up ("Width: every hair on this head
//            −8% + this hair +2% = −6%"); Up, Forward, Their left (millimetres), Size, Tuck (0 to 500%, its buttons or
//            its slider: drawn in toward the head's centre at every height, thickness kept; 100% puts its underside
//            2 mm off this head) and Full from (where the tuck is full below the top of the hair), Width, Height,
//            Depth (each its own scale), Turn (round the upright line), Tilt (round the line from ear to ear, + the
//            front down), Lean (round the line from nape to face, + the top to their left), Hug on or off, Hug and its
//            Gap (kit/crew.js THE HUG); Fine (smaller steps); Reset (the level chosen back to as made). A pair placed by
//            hand in Blender (fit.heads[<head>].placed) is worn exactly as he placed it, and says so. Then its BUZZ
//            (kit/crew.js THE PAINT FIELD): Sideburns (how far below the top of the ear, or none), Nape (the taper), Front
//            (the hairline along the forehead), Reset; and Show: Stubble, Scalp shade, Ears (tinted), Smooth Mathwood hair
//   POSE     the clips their outfit's skeleton has (the men's or the women's), grouped; the speed; Pause
//   CAMERA   Full, Front, Side, Back, Face, Head, Nape (these three follow the head), Hands, Down the collar (2026-11-11:
//            from above the shoulder, down between the collar and the neck, following it); Painted, Plain, Wireframe;
//            the 1.8 m post; Bones
//   COLORS   Job colours (the outfit's marks, light lines and panels; an outfit keeping its own colours takes none),
//            Bands (the outfit's whites: as made, BAND_COLOURS by name, then More: the older uniform colours, or any),
//            Skin tone, Hair colour, Eyes (a head with real eyes: the iris's colour, Look at camera)
//   FACE     a slider for each of FACE's (kit/crew.js; a head with face bones: the Tripo heads), -1 to 1, kept in the
//            recipe, Reset; a visor's face (Captain Vega's helmet: its expressions)
//   CHANGES  what this browser has changed from crew.json (kept in this browser as made, worn at once), whether it has
//            been saved since; Save fits (a file, crewFits-<yyyy-mm-dd-hhmm>.json, to Downloads, for the hair rig's
//            merge_fits.mjs), Copy fits (the same text, also shown in a box to copy by hand), Clear my changes
//   Saved and copied text: { "hairs": { <hair id>: its fit (pairs in fit.heads) }, "heads": { <head id>: its hairFit },
//     "buzzes": { <hair id>: its buzz | null }, "seats": { <head id>: { <suit id>: metres } } }
// Drag to look round, wheel or pinch to come closer, W A S D move (Space up, C down, Shift faster); the arrow keys step
// the hair (left, right) and the head (up, down); Esc closes the window in front.
//   ?who=<recipe id>  ?clip=<name>  ?cam=<name>  ?flathair (the Mathwood hair flat-shaded to start)  ?look (Look at camera on)
//   window.CREWLAB = { ready, clips, play(name), pose(name, t), cam(name), show(k, on), recipe(r), colours(c), state(),
//     expression(name) (a visor's face), smoothHair(on) (the Mathwood hair's shading; rebuilds the character),
//     look(on) (the eyes on the camera, a head with real eyes), face(values) (the face sliders: { slider: -1..1 }),
//     measure() (the body's lowest point and each boot's, in the pose shown), fit() (the Hair window's fit: the fit worn,
//     this browser's fits, the text Copy fits gives), buzz() (the buzz's state), buzzView({ buzz, under, ears }),
//     step(kind, d) (the head or hair d along; resolves when shown), win(id, on) (a window opened or closed),
//     menus() (the menus' state: { master, open, at }), thumbs (the picture buttons' drawer),
//     crew() (the person shown), lib (kit/crew.js's loadCrew), three, scene, camera, renderer }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadCrew, makeCrew, fitFor, TUCK_MAX, HUG_GAP, HUG_MAX, HUG_DEFAULT, CLIPS, JOBS, UNIFORM_COLOURS, BAND_COLOURS, SIZES, SKIN_TONES, HAIR_COLOURS, EYE_COLOURS, FACE, EXPRESSIONS } from '../../kit/crew.js';
import { makeMaterials } from '../../kit/materials.js';
import { buildRoom } from '../../kit/layout.js';
import { makeMenus } from './windows.js';
import { makeThumbs } from './thumbs.js';

const $ = (s) => document.querySelector(s), q = new URLSearchParams(location.search);
const st = { who: null, crew: null, clip: q.get('clip') || 'Idle', speed: 1, paused: false, cam: q.get('cam') || 'Full', paint: 'paint', marker: true, bones: false, recipe: null, look: q.has('look'), dirty: false };
// (the clips in the Pose window, grouped as the people use them)
const CLIP_GROUPS = [
  ['Stand', ['Idle', 'Idle_Neutral', 'Wave', 'Interact', 'Stand_Listen', 'Stand_Clap']],
  ['Move', ['Walk', 'Run', 'Run_Back', 'Run_Left', 'Run_Right', 'Roll']],
  ['Sit', ['Sit_Listen', 'Sit_Clap', 'Stool_Bar', 'Stool_Clap', 'Drive']],
  ['Work', ['Bar_Polish', 'Hammer', 'Tend_Forge']],
  ['Hit', ['HitRecieve', 'Death']],
];
const LABEL = { Idle_Neutral: 'Idle 2', HitRecieve: 'Hit', Run_Back: 'Run back', Run_Left: 'Run left', Run_Right: 'Run right', Stand_Listen: 'Listen', Stand_Clap: 'Clap', Sit_Listen: 'Sit', Sit_Clap: 'Sit clap', Stool_Bar: 'Stool', Stool_Clap: 'Stool clap', Bar_Polish: 'Polish', Tend_Forge: 'Tend' };
const CAMS = { Full: [1.15, 1.25, 3.5, 0.93], Front: [0, 1.1, 3.8, 0.93], Side: [3.8, 1.1, 0, 0.93], Back: [0, 1.1, -3.8, 0.93], Face: null, Head: null, Nape: null, Hands: null, Collar: null };
const CAM_LABEL = { Collar: 'Down the collar' };
// (the close cameras, following the head or the neck as the clip moves them: from the front-left, straight in front,
// from behind; and down the collar, from above their left shoulder and a little behind, onto the gap between the
// collar and the neck. Offsets in metres from the anchor)
const FOLLOW = { Face: ['head', [0.22, 0.04, 0.62]], Head: ['head', [0, 0.03, 0.7]], Nape: ['head', [-0.25, 0.08, -0.65]], Collar: ['neck', [0.15, 0.3, -0.17]] };

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
const thumbs = makeThumbs(lib);
let M = null;     // (the menus, once the first person is in)
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
  setPaint(st.paint); setBones(st.bones); c.paintView(buzzSt.view);
  c.play(st.clip in c.person.actions ? st.clip : 'Idle', { fade: 0 }); c.update(0);
  if (!st.look) c.lookAt(null);
  triCount(); menu();
}
// (a part picked from a grid: the recipe with it, the rest kept)
const wear = (kind, id) => { if (!st.recipe) return; show({ ...st.recipe, [kind]: id || null }); };
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
// (what a following camera keeps in view: the middle of the head, or the neck at the collar)
function anchorAt(kind, v) {
  const B = st.crew?.bones; if (!B) return v.set(0, kind === 'neck' ? 1.5 : 1.7, 0);
  if (kind === 'neck') return B.Neck.getWorldPosition(v).add(_f.set(0, 0.03, 0));
  return B.Head.getWorldPosition(v).add(_f.set(0, 0.09, 0.03));
}
function setCam(name) {
  st.cam = name;
  if (FOLLOW[name]) { const [k, o] = FOLLOW[name]; anchorAt(k, _h); controls.target.copy(_h); camera.position.set(_h.x + o[0], _h.y + o[1], _h.z + o[2]); }
  else if (name === 'Hands') { controls.target.set(0, 1.0, 0.1); camera.position.set(0.7, 1.35, 1.4); }
  else { const [x, y, z, ty] = CAMS[name]; controls.target.set(0, ty, 0); camera.position.set(x, y, z); }
  controls.update();
}

// ── small pieces the windows are made of ───────────────────────────────────────────────────────────────────────
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const chip = (label, on, fn, sub, title) => { const b = el('button', 'chip' + (sub ? ' sub' : '') + (on ? ' on' : ''), label); b.onclick = fn; if (title) b.title = title; return b; };
const swatch = (col, on, fn, title) => { const b = chip('', on, fn, true, title); b.classList.add('sw'); b.style.background = col; b.setAttribute('aria-label', title); return b; };
const lab = (t) => el('span', 'kl-label', t);
const val = (t, title) => { const s = el('span', 'kl-val', t); if (title) s.title = title; return s; };
const sec = (title, ...kids) => { const s = el('div', 'cw-sec'); if (title) s.append(el('div', 'cw-h', title)); s.append(...kids.flat().filter(Boolean)); return s; };
const row = (...kids) => { const r = el('div', 'cw-row'); r.append(...kids.flat().filter(Boolean)); return r; };
const note = (t) => el('div', 'cw-note', t);
// (a value with a button either side, kept together as one piece: what each does goes in its title)
const knob = (label, value, less, more, tl, tm, title) => { const k = el('span', 'cw-knob'); k.append(lab(label), chip(less[0], false, less[1], true, tl), val(value, title), chip(more[0], false, more[1], true, tm)); if (title) k.title = title; return k; };
// (one of a few, as chips: the one chosen lit)
const choice = (opts, cur, pick, aria) => { const r = el('div', 'cw-levels'); r.setAttribute('role', 'radiogroup'); if (aria) r.setAttribute('aria-label', aria); for (const [k, t, title] of opts) { const b = chip(t, k === cur, () => pick(k), true, title); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(k === cur)); r.append(b); } return r; };
// a grid of picture buttons, one a part (thumbs.js draws the pictures as the window opens); the one worn outlined
function grid(kind, items, worn, aria) {
  const g = el('div', 'cw-grid'); g.setAttribute('role', 'listbox'); g.setAttribute('aria-label', aria);
  for (const it of items) {
    const b = el('button', 'pic'), src = thumbs.get(kind, it.id), on = (it.id || null) === (worn || null);
    b.dataset.kind = kind; b.dataset.id = it.id || ''; b.title = it.name; b.setAttribute('aria-pressed', String(on));
    if (src) { const img = el('img'); img.src = src; img.alt = ''; b.append(img); } else b.append(el('span', 'ph'));
    b.append(el('span', null, it.name));
    b.onclick = () => wear(kind === 'suit' ? 'suit' : kind, it.id);
    g.append(b);
  }
  thumbs.want(kind, items.map((i) => i.id));
  return g;
}
thumbs.onPicture((kind, id, url) => {
  for (const b of document.querySelectorAll(`.pic[data-kind="${kind}"][data-id="${id || ''}"]`)) {
    const ph = b.querySelector('.ph'); if (!ph) continue;
    if (url) { const img = el('img'); img.src = url; img.alt = ''; ph.replaceWith(img); } else ph.style.animation = 'none';
  }
});

// ── THE MENUS: the master menu and a window a category ─────────────────────────────────────────────────────────
const WINDOWS = [
  { id: 'crew', label: 'Crew', title: 'The ready-made crew members' },
  { id: 'bodies', label: 'Bodies', title: 'The outfits (pictures), hands and height' },
  { id: 'heads', label: 'Heads', title: 'The heads (pictures) and how a head sits on the outfit' },
  { id: 'hair', label: 'Hair', title: 'The hair (pictures), its fit and its buzz' },
  { id: 'pose', label: 'Pose', title: 'What they do: the clips and their speed' },
  { id: 'camera', label: 'Camera', title: 'Where you look from, and what shows' },
  { id: 'colors', label: 'Colors', title: 'Job colours, bands, skin, hair and eyes' },
  { id: 'face', label: 'Face', title: 'The face\'s shape (sliders) and a visor\'s face' },
  { id: 'changes', label: 'Changes', title: 'What you have changed, and saving it' },
];
const RENDER = { crew: crewWin, bodies: bodiesWin, heads: headsWin, hair: hairWin, pose: poseWin, camera: cameraWin, colors: coloursWin, face: faceWin, changes: changesWin };
// (a window's inside made again: where it and its grid were scrolled kept; a window just opened shows the part worn)
function paint(id, opened) {
  if (!M || !M.isOpen(id)) return;
  const body = M.body(id), g0 = body.querySelector('.cw-grid'), keep = [body.scrollTop, g0 ? g0.scrollTop : 0];
  body.replaceChildren(...RENDER[id]());
  const g = body.querySelector('.cw-grid');
  if (opened) { const on = g && g.querySelector('.pic[aria-pressed="true"]'); if (on) g.scrollTop = Math.max(0, on.offsetTop - g.offsetTop - 6); }
  else { body.scrollTop = keep[0]; if (g) g.scrollTop = keep[1]; }
}
function menu() { if (!M) return; for (const id of M.ids()) paint(id); }

// CREW: the ready-made crew members
function crewWin() {
  return [sec('Crew members', row(Object.entries(RECIPES).map(([id, r]) => chip(r.name, id === st.who, () => { st.who = id; show(r); }, true, 'Wear this crew member\'s whole recipe: outfit, head, hair and colours')))),
    note('Each is a whole recipe from crew.json. Change any part in Bodies, Heads, Hair or Colors.')];
}
// BODIES: the outfits, the hands, the height
function bodiesWin() {
  const R = st.recipe || {};
  const dflt = lib.handFor(R.suit), dn = dflt ? (lib.entry('hand', dflt) || {}).name : 'its own';
  const handNow = R.hand === undefined ? '' : R.hand === null ? 'none' : R.hand;
  const hands = [['', `By outfit (${dn})`, 'The hands this outfit\'s skeleton has (an outfit made with hands of its own wears none)'], ...(lib.list.parts.hand || []).map((p) => [p.id, p.name, p.name]), ['none', 'None', 'No hands']];
  const setHand = (v) => { if (v === '') delete st.recipe.hand; else st.recipe.hand = v === 'none' ? null : v; show(st.recipe); };
  return [grid('suit', lib.list.parts.suit, R.suit, 'Outfits'),
    sec('Hands', choice(hands, handNow, setHand, 'Hands')),
    sec('Height', row(Object.entries(SIZES).map(([k, v]) => chip(k[0].toUpperCase() + k.slice(1), (+R.size || 1) === v, () => resize2(v), true, `${k[0].toUpperCase() + k.slice(1)}: ${Math.round(v * 100)}% of the body as made`))))];
}
// HEADS: the heads, and how this one sits on this outfit
function headsWin() {
  const R = st.recipe || {};
  return [grid('head', lib.list.parts.head, R.head, 'Heads'), sec('How this head sits in this outfit', ...seatBits(R))];
}
// POSE: the clips and their speed
function poseWin() {
  return [...CLIP_GROUPS.map(([g, list]) => { const L = list.filter((n) => st.crew?.person.actions[n]); return L.length ? sec(g, row(L.map((n) => chip(LABEL[n] || n, n === st.clip, () => play(n), true)))) : null; }).filter(Boolean),
    sec('Speed', row(...[[0.25, '¼'], [0.5, '½'], [1, '1×']].map(([v, t]) => chip(t, v === st.speed && !st.paused, () => { st.speed = v; st.paused = false; if (st.crew?.person.cur) st.crew.person.cur.setEffectiveTimeScale(v); menu(); }, true)),
      chip(st.paused ? 'Play' : 'Pause', st.paused, () => { st.paused = !st.paused; menu(); }, true)))];
}
// CAMERA: where from, and what shows
function cameraWin() {
  return [sec('Look from', row(Object.keys(CAMS).map((k) => chip(CAM_LABEL[k] || k, k === st.cam, () => { setCam(k); menu(); }, true, k === 'Collar' ? 'From above the shoulder, down between the collar and the neck (follows the neck)' : FOLLOW[k] ? 'Close on the head (follows it)' : '')))),
    sec('Show', row(...[['paint', 'Painted'], ['plain', 'Plain'], ['wire', 'Wireframe']].map(([k, t]) => chip(t, st.paint === k, () => { setPaint(k); menu(); }, true)),
      chip('1.8 m', st.marker, () => { st.marker = !st.marker; marker.visible = st.marker; menu(); }, true, 'A 1.8 m post beside them'),
      chip('Bones', st.bones, () => { setBones(!st.bones); menu(); }, true, 'The skeleton')))];
}
// COLORS: job, bands, skin, hair colour, eyes
function coloursWin() {
  const C = (st.recipe || {}).colours || {};
  // (an outfit that keeps its own colours: the job chips do nothing on it, and say so)
  const sm = st.crew?.meshes.suit, own0 = !!(sm && (sm.userData.paint || sm.material).userData.crewOwnColours);
  // (any uniform colour: previewed as it's picked, kept when the picker closes)
  const any = document.createElement('input'); any.type = 'color'; any.className = 'kl-colour'; any.value = C.uniform || '#8a96a3';
  any.title = 'Any colour for the bands'; any.setAttribute('aria-label', 'Any colour for the bands');
  if (C.uniform && !UNIFORM_COLOURS.includes(C.uniform) && !Object.values(BAND_COLOURS).includes(C.uniform)) any.classList.add('on');
  any.oninput = () => st.crew?.setColours({ ...(st.recipe.colours || {}), uniform: any.value });
  any.onchange = () => colours({ uniform: any.value });
  const ownIris = st.crew?.meshes.eyes?.material.userData.eye?.crIrisOwn.value.getStyle();
  const bands = Object.values(BAND_COLOURS);
  return [sec(own0 ? 'Job colours (this outfit keeps its own)' : 'Job colours', row(Object.entries(JOBS).map(([k, J]) => chip(J.name, (C.job || 'explorer') === k, () => colours({ job: k }), true, own0 ? 'This outfit keeps its own colours: a job changes nothing on it' : '')))),
    sec('Bands (the outfit\'s whites)', row(swatch('linear-gradient(135deg,#f4f5f6,#9aa3ad)', !C.uniform, () => colours({ uniform: null }), 'The bands as made (white)'),
      ...Object.entries(BAND_COLOURS).map(([n, s]) => swatch(s, C.uniform === s, () => colours({ uniform: s }), 'Bands: ' + n))),
    row(lab('More'), ...UNIFORM_COLOURS.filter((s) => !bands.includes(s)).map((s) => swatch(s, C.uniform === s, () => colours({ uniform: s }), 'Bands ' + s)), any)),
    sec('Skin', row(swatch('linear-gradient(135deg,#d9a37f,#86522f)', !C.skin, () => colours({ skin: null }), 'Their own skin'), ...SKIN_TONES.map((s) => swatch(s, C.skin === s, () => colours({ skin: s }), 'Skin ' + s)))),
    sec('Hair colour', row(swatch('linear-gradient(135deg,#6b4127,#2e1f15)', !C.hair, () => colours({ hair: null }), 'The hair\'s own colour'), ...HAIR_COLOURS.map((s) => swatch(s, C.hair === s, () => colours({ hair: s }), 'Hair ' + s)))),
    st.crew?.gaze ? sec('Eyes', row(swatch(ownIris || '#4a2e18', !C.eyes, () => colours({ eyes: null }), 'Their own eyes'), ...EYE_COLOURS.map((s) => swatch(s, C.eyes === s, () => colours({ eyes: s }), 'Eyes ' + s)),
      chip('Look at camera', st.look, () => look(!st.look), true, 'The eyes follow the camera (off: straight ahead)'))) : sec('Eyes', note('This head has no eyes of its own to colour.'))];
}
// (a height picked: the person put together again at that size)
async function resize2(v) { if (!st.recipe) return; if (v === 1) delete st.recipe.size; else st.recipe.size = v; await show(st.recipe); }
async function smoothHair(on) { lib.smoothHair = !!on; if (st.recipe) await show(st.recipe); triCount(); menu(); }
function expression(k) { st.recipe.expression = k; st.crew?.setExpression(k); menu(); }
function look(on) { st.look = !!on; if (!st.look) st.crew?.lookAt(null); menu(); }
// (a colour set back to the part's own (null) is left out of the recipe, but passed on as null: the person merges what it's
// given into its own colours, so a key left out would keep the colour it had)
function colours(c) { st.recipe.colours = { ...(st.recipe.colours || {}), ...c }; for (const k of Object.keys(c)) if (c[k] == null) delete st.recipe.colours[k]; st.crew?.setColours({ ...st.recipe.colours, ...c }); menu(); }

// ── THE SEAT (kit/crew.js): how much lower this head sits in this outfit's collar, in 2 mm steps (+ lower, - higher),
// tried at once and kept in this browser over crew.json's (lib.seats); Save fits and Copy fits carry them ─────────────
const SEAT_KEY = 'crewlab.seats.v1';
try { const j = JSON.parse(localStorage.getItem(SEAT_KEY) || '{}'); if (j && typeof j === 'object' && !Array.isArray(j)) lib.seats = j; } catch (_) { /* none kept */ }
const seatMap = (s) => (s == null ? {} : typeof s === 'number' ? { all: s } : { ...s });
function seatBits(R) {
  if (!R.head || !R.suit) return [note('Pick a head and an outfit.')];
  const mm = Math.round(lib.seatOf(R.head, R.suit) * 1000);
  return [row(knob('Seat', `${mm} mm`, ['▲', () => reseat(-2)], ['▼', () => reseat(2)], 'Seat this head 2 mm higher in this outfit', 'Seat this head 2 mm lower in this outfit (deeper in the collar)',
    'How much lower this head sits in this outfit\'s collar (its neck goes deeper in; nothing is cut)'))];
}
async function reseat(dmm) {
  const R = st.recipe; if (!R?.head || !R.suit) return;
  const m = seatMap(own(lib.seats, R.head) ? lib.seats[R.head] : (lib.entry('head', R.head) || {}).seat);
  m[R.suit] = Math.min(0.04, Math.max(-0.02, Math.round((lib.seatOf(R.head, R.suit) * 1000 + dmm)) / 1000));
  lib.seats[R.head] = m; st.dirty = true;
  try { localStorage.setItem(SEAT_KEY, JSON.stringify(lib.seats)); } catch (_) { /* not kept: Save fits before leaving */ }
  await show(R);
}

// ── FACE: the face bones' sliders (kit/crew.js FACE), kept in the recipe; a visor's face ──────────────────────────────
// (a slider at its default (FACE[k].default, else 0) is left out of the recipe: the smile's 0 is kept, a straight face)
const faceDefault = (k) => (FACE[k] && FACE[k].default) || 0;
function face(values) { st.recipe.face = { ...(values || {}) }; for (const k of Object.keys(st.recipe.face)) if ((+st.recipe.face[k] || 0) === faceDefault(k)) delete st.recipe.face[k]; st.crew?.setFace(st.recipe.face); }
function faceWin() {
  const out = [];
  if (st.crew?.meshes.visor) out.push(sec('Visor face', row(Object.entries(EXPRESSIONS).map(([k, t]) => chip(t, st.crew.expression === k, () => expression(k), true)))));
  const sl = st.crew?.faceSliders || [];
  if (!sl.length) { out.push(note(st.crew?.meshes.visor ? 'A helmet: its face is the visor\'s, above.' : 'This head has no face sliders (the Tripo heads have them).')); return out; }
  const F = st.recipe.face || {}, items = [];
  for (const k of sl) {
    const f = F[k] != null ? +F[k] : faceDefault(k);
    const r = document.createElement('input'); r.type = 'range'; r.min = -100; r.max = 100; r.step = 1; r.value = Math.round(f * 100);
    r.setAttribute('aria-label', FACE[k].name); r.title = FACE[k].name + ' (less to more)' + (faceDefault(k) ? `; worn at ${Math.round(faceDefault(k) * 100)} unless set` : '');
    const v = val((f * 100 > 0 ? '+' : '') + Math.round(f * 100));
    r.oninput = () => { face({ ...(st.recipe.face || {}), [k]: +r.value / 100 }); v.textContent = (+r.value > 0 ? '+' : '') + r.value; };
    const s = el('div', 'cw-slider'); s.append(lab(FACE[k].name), r, v); items.push(s);
  }
  out.push(sec('Face shape', ...items, row(chip('Reset', false, () => { face({}); menu(); }, true, sl.some(faceDefault) ? 'Every slider back to its default (the face as made, with its little smile)' : 'Every slider back to the face as made'))));
  return out;
}

// ── FIT: the hair fitted (kit/crew.js, "a hair's fit") ──────────────────────────────────────────────────────────────
// This browser's fits (lib.fits: a hair's entry replaces crew.json's fit for that hair) are kept in localStorage as
// they're made; the first change to a hair starts from crew.json's fit for it.
const FIT_KEY = 'crewlab.fits.v1', HEAD_KEY = 'crewlab.headfits.v1';
const STEPS = { move: [0.002, 0.0005], size: [0.01, 0.0025], tuck: [0.1, 0.025], start: [0.01, 0.0025], dim: [0.01, 0.0025], turn: [1, 0.25], tilt: [1, 0.25], lean: [1, 0.25], hug: [0.1, 0.025], gap: [0.0005, 0.00025] };   // (each: [step, fine step])
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const copy = (o) => JSON.parse(JSON.stringify(o == null ? {} : o));
const rnd = (v, p) => Math.round(v / p) * p;
function hairFit(id) { return own(lib.fits, id) ? lib.fits[id] : (lib.entry('hair', id) || {}).fit; }
// (a fit with nothing in it left out: offsets of zero, a size of 1, no tuck, empty head entries; numbers rounded)
function tidy(f, base, hid) {
  const o = {};
  if (!f) return o;
  if (f.placed) o.placed = true;
  if (f.offset && f.offset.some((v) => Math.abs(v) >= 0.00005)) o.offset = f.offset.map((v) => +rnd(v || 0, 0.0001).toFixed(4));
  if (f.scale != null && Math.abs(f.scale - 1) >= 0.00005) o.scale = +(+f.scale).toFixed(4);
  if (f.dims && f.dims.some((v) => Math.abs((v == null ? 1 : v) - 1) >= 0.00005)) o.dims = f.dims.map((v) => +(v == null ? 1 : +v).toFixed(4));
  for (const k of ['turn', 'tilt', 'lean']) if (f[k] && Math.abs(f[k]) >= 0.005) o[k] = +(+f[k]).toFixed(2);
  if (f.tuck && Math.abs(f.tuck) >= 0.0005) o.tuck = +(+f.tuck).toFixed(3);
  if (f.tuckStart && Math.abs(f.tuckStart) >= 0.00005) o.tuckStart = +(+f.tuckStart).toFixed(4);
  // (the hug and its gap: the hair's own against their defaults, a pair's as what it adds)
  if (f.hug != null && Math.abs(f.hug - (base == null ? (hid ? lib.hugDefaultOf(hid) : HUG_DEFAULT) : 0)) >= 0.0005) o.hug = +(+f.hug).toFixed(3);
  if (f.hugGap != null && Math.abs(f.hugGap - (base == null ? HUG_GAP : 0)) >= 0.00005) o.hugGap = +(+f.hugGap).toFixed(5);
  if (base == null && f.heads) {
    const H = {}; for (const [h, d] of Object.entries(f.heads)) { const t = tidy(d, f); if (Object.keys(t).length) H[h] = t; }
    if (Object.keys(H).length) o.heads = H;
  }
  return o;
}
function readMine(key = FIT_KEY) {
  try { const j = JSON.parse(localStorage.getItem(key) || '{}'); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (_) { return {}; }
}
// (a head's own setting under every hair, as written: crew.json's head entry hairFit, or this browser's)
const headTidy = (h) => { const t = tidy(h || {}, {}); delete t.hug; delete t.hugGap; delete t.tuck; delete t.tuckStart; delete t.scale; delete t.placed; return t; };
function saveMine() {
  // (a hair whose fit is back to crew.json's own is no longer a change; nor a head's own setting)
  for (const id of Object.keys(lib.fits)) if (JSON.stringify(tidy(lib.fits[id], null, id)) === JSON.stringify(tidy((lib.entry('hair', id) || {}).fit, null, id))) delete lib.fits[id];
  for (const id of Object.keys(lib.headFits)) if (JSON.stringify(headTidy(lib.headFits[id])) === JSON.stringify(headTidy((lib.entry('head', id) || {}).hairFit))) delete lib.headFits[id];
  st.dirty = true;
  try {
    if (Object.keys(lib.fits).length) localStorage.setItem(FIT_KEY, JSON.stringify(lib.fits)); else localStorage.removeItem(FIT_KEY);
    if (Object.keys(lib.headFits).length) localStorage.setItem(HEAD_KEY, JSON.stringify(lib.headFits)); else localStorage.removeItem(HEAD_KEY);
    return true;
  } catch (_) { fitSt.note = 'This browser would not keep the fits: Save fits before you leave.'; return false; }
}
// (hairs renamed to their files' names (2026-11-08): this browser's fits and buzzes kept under the old ids follow them)
const RENAMED = { pinkside: 'pinkSide', bumpy: 'coil', greybob: 'mediumFull' };
function renamed(o) { for (const [a, b] of Object.entries(RENAMED)) if (own(o, a)) { if (!own(o, b)) o[b] = o[a]; delete o[a]; } return o; }
lib.fits = renamed(readMine()); lib.headFits = readMine(HEAD_KEY);
const fitSt = { scope: 'all', fine: false, out: null, note: '' };
// a change to the hair shown: to its fit on every head, to this pair's own adjustment, or to the head's own setting
async function fitEdit(change, quiet) {
  const hair = st.recipe?.hair, head = st.recipe?.head;
  // ("Every hair on this head": the head's own setting, under every hair worn on it)
  if (fitSt.scope === 'headAll' && head) {
    if (!own(lib.headFits, head)) lib.headFits[head] = copy((lib.entry('head', head) || {}).hairFit);
    change(lib.headFits[head], 'headAll'); lib.headFits[head] = headTidy(lib.headFits[head]);
    fitSt.note = ''; saveMine(); await wearFit(quiet); return;
  }
  if (!hair) return;
  if (!own(lib.fits, hair)) lib.fits[hair] = copy((lib.entry('hair', hair) || {}).fit);
  const F = lib.fits[hair];
  if (fitSt.scope === 'head' && head) { F.heads = F.heads || {}; change(F.heads[head] = F.heads[head] || {}, F); }
  else change(F, null);
  lib.fits[hair] = tidy(F, null, hair);
  fitSt.note = '';
  saveMine(); await wearFit(quiet);
}
// (quiet: the window left as it is, while the tuck's slider is dragged)
async function wearFit(quiet) { if (st.crew) await st.crew.setFit(lib.fitOf(st.crew.recipe.hair, st.crew.recipe.head)); if (!quiet) { paint('hair'); paint('changes'); } }
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
// (the tuck set to a value (the slider), on every head or this pair's own: what the hair's own fit doesn't give)
function setTuck(v, quiet) {
  return fitEdit((t, base) => { const b = base ? base.tuck || 0 : 0; t.tuck = +(Math.min(TUCK_MAX, Math.max(0, v)) - b).toFixed(5); }, quiet);
}
// (the level being set's own width, height or depth (axis 0, 1, 2), turn, hug and gap: kept within 70 to 130%, 45
// degrees, 0 to 100% and 0 to 15 mm worn)
function redim(axis, dir) {
  fitEdit((t) => { t.dims = [0, 1, 2].map((i) => (t.dims && t.dims[i] != null ? +t.dims[i] : 1)); t.dims[axis] = +Math.min(1.3, Math.max(0.7, t.dims[axis] + dir * fine('dim'))).toFixed(5); });
}
function returnTo(dir, k = 'turn') { fitEdit((t) => { t[k] = +Math.min(45, Math.max(-45, (+t[k] || 0) + dir * fine(k))).toFixed(3); }); }
function rehug(dir, to) {
  fitEdit((t, base) => {
    const d0 = lib.hugDefaultOf(st.recipe?.hair), own0 = base == null ? (t.hug == null ? d0 : +t.hug) : +t.hug || 0, under = base == null ? 0 : (base.hug == null ? d0 : +base.hug);
    const worn = to != null ? to : Math.min(HUG_MAX, Math.max(0, under + own0 + dir * fine('hug')));
    t.hug = +(worn - under).toFixed(4);
  });
}
function regap(dir) {
  fitEdit((t, base) => {
    const own0 = base == null ? (t.hugGap == null ? HUG_GAP : +t.hugGap) : +t.hugGap || 0, under = base == null ? 0 : (base.hugGap == null ? HUG_GAP : +base.hugGap);
    t.hugGap = +(Math.min(0.015, Math.max(0, under + own0 + dir * fine('gap'))) - under).toFixed(5);
  });
}
function fitReset() {
  const hair = st.recipe?.hair, head = st.recipe?.head;
  if (fitSt.scope === 'headAll') { if (head) fitEdit((t) => { for (const k of Object.keys(t)) delete t[k]; }); return; }
  if (!hair) return;
  fitEdit((t, base) => {
    if (base) { delete base.heads[head]; return; }
    for (const k of ['offset', 'scale', 'dims', 'turn', 'tilt', 'lean', 'tuck', 'tuckStart', 'hug', 'hugGap']) delete t[k];
  });
}
// every change of this browser forgotten: back to crew.json's
async function clearMine() {
  const n = changeList().length;
  if (!n) { fitSt.note = 'No changes of yours to clear.'; paint('changes'); return; }
  if (!confirm('Clear all your changes in this browser (hair fits, buzzes, seats) and go back to crew.json\'s? (Save fits first to keep them.)')) return;
  lib.fits = {}; lib.headFits = {}; lib.buzzes = {}; lib.seats = {};
  saveMine(); saveBuzzes(); try { localStorage.removeItem(SEAT_KEY); } catch (_) { /* none */ }
  st.dirty = false; fitSt.note = 'Back to crew.json\'s.'; fitSt.out = null;
  if (st.recipe) await show(st.recipe); else menu();
}
// everything this browser sets, over crew.json's, as one JSON object for crew.json (merge_fits.mjs)
function fitsText() {
  const hairs = [], heads = [], buzzes = [];
  for (const P of lib.list.parts.hair) { const t = tidy(hairFit(P.id), null, P.id); if (Object.keys(t).length) hairs.push('    ' + JSON.stringify(P.id) + ': ' + JSON.stringify(t)); }
  for (const P of lib.list.parts.head) { const t = headTidy(lib.headFitOf(P.id)); if (Object.keys(t).length) heads.push('    ' + JSON.stringify(P.id) + ': ' + JSON.stringify(t)); }
  // (and every painted hair's buzz: null for none)
  for (const P of lib.list.parts.hair) { const h = hairPaints(P); if (h.cut || h.marks || h.under) buzzes.push('    ' + JSON.stringify(P.id) + ': ' + JSON.stringify(tidyBuzz(lib.buzzOf(P.id)))); }
  const seats = Object.entries(lib.seats).map(([h, s]) => '    ' + JSON.stringify(h) + ': ' + JSON.stringify(s));
  const block = (L) => (L.length ? '{\n' + L.join(',\n') + '\n  }' : '{}');
  return '{\n  "hairs": ' + block(hairs) + ',\n  "heads": ' + block(heads) + ',\n  "buzzes": ' + block(buzzes) + ',\n  "seats": ' + block(seats) + '\n}';
}
// (Save fits: the same text as a file, crewFits-<yyyy-mm-dd-hhmm>.json, to the browser's downloads)
function saveFits() {
  const d = new Date(), z = (v) => String(v).padStart(2, '0');
  const name = `crewFits-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.json`;
  try {
    const url = URL.createObjectURL(new Blob([fitsText() + '\n'], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    fitSt.note = `Saved ${name} (your Downloads), for merging into crew.json.`; fitSt.saved = name; st.dirty = false;
  } catch (e) { fitSt.note = 'Saving did not work here (' + e.message + '): use Copy fits.'; }
  paint('changes');
}
async function copyFits() {
  const text = fitsText(); fitSt.out = text;
  let ok = false;
  try { await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 1500))]); ok = true; } catch (_) { ok = false; }
  paint('changes');
  let box = M && M.body('changes').querySelector('textarea');
  if (box && !ok) { box.focus(); box.select(); try { ok = document.execCommand('copy'); } catch (_) { ok = false; } }
  fitSt.note = ok ? 'Copied. The text is in the box below too.' : 'Copying did not work here: the text is in the box below, selected; copy it from there.';
  if (ok) st.dirty = false;
  paint('changes');
  box = M && M.body('changes').querySelector('textarea');
  if (box) { box.focus({ preventScroll: true }); box.select(); }
}
// the head or the hair before or after (the hair's list starts with none), wrapping round (the arrow keys)
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
  if (Math.abs(z) >= 0.00005) w.push((z > 0 ? 'forward ' : 'back ') + mm(z));
  if (Math.abs(x) >= 0.00005) w.push((x > 0 ? 'their left ' : 'their right ') + mm(x));
  const s = w.length ? [w.join(', ') + ' mm'] : [];
  if (Math.abs(f.scale - 1) >= 0.00005) s.push('size ' + +(f.scale * 100).toFixed(2) + '%');
  if (f.tuck > 0) s.push('tuck ' + Math.round(f.tuck * 100) + '%' + (f.tuckStart > 0 ? ' from ' + +(f.tuckStart * 100).toFixed(2) + ' cm down' : ''));
  const dw = dimsWords(f.dims, f); if (dw) s.push(dw);
  if (f.placed) s.unshift('placed by hand');
  else s.push(f.hug > 0 ? 'hug ' + Math.round(f.hug * 100) + '% to ' + +(f.hugGap * 1000).toFixed(2) + ' mm' : 'no hug');
  return s.length ? s.join(', ') : 'as made';
}
// (width, height, depth as percentages more or less, and a turn, tilt and lean: "width -8%, turn 1.2°, tilt 3.0°")
const pc = (v) => { const d = (v - 1) * 100; return (d >= 0.05 ? '+' : d <= -0.05 ? '−' : '') + Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0) + '%'; };
function dimsWords(d, A) {
  const w = []; if (d) ['width', 'height', 'depth'].forEach((k, i) => { if (Math.abs((d[i] == null ? 1 : d[i]) - 1) >= 0.0005) w.push(k + ' ' + pc(d[i])); });
  for (const k of ['turn', 'tilt', 'lean']) if (A && A[k] && Math.abs(A[k]) >= 0.005) w.push(k + ' ' + (+A[k]).toFixed(2) + '°');
  return w.join(', ');
}
// the three levels a hair's fit is set at, in plain words
const HAIR_LEVELS = [
  ['all', 'This hair, every head', 'Your changes are this hair\'s own fit: it wears them on every head'],
  ['head', 'This hair on this head only', 'Your changes are this pair\'s own: added to the hair\'s fit, only when this hair is on this head'],
  ['headAll', 'Every hair on this head', 'Your changes are this head\'s own setting: added under every hair worn on this head (crew.json: the head\'s hairFit)'],
];
const sgn = (v, f) => (v >= 0.0000005 ? '+' : v <= -0.0000005 ? '−' : '') + f(Math.abs(v));
const mmS = (v) => sgn(v, (a) => (a * 1000).toFixed(1)) + ' mm', degS = (v) => sgn(v, (a) => a.toFixed(2)) + '°', pcS = (v) => pc(v), pctS = (v) => sgn(v, (a) => Math.round(a * 100)) + '%';
// (the levels added up, a line for each setting any level changes: "Width: every hair on this head −8%, this hair +2%
// = −6%". The head's own (every hair), the hair's own (every head), the pair's own; offsets, turns, tucks and hugs
// added, sizes multiplied)
function hairSum(hair, head, f) {
  const H = lib.headFitOf(head) || {}, F = (hair && hairFit(hair)) || {}, D = (F.heads && F.heads[head]) || {}, placed = !!D.placed, A = placed ? {} : F;
  const names = { H: 'every hair on this head', A: 'this hair', D: 'this pair' }, lines = [];
  const add = (label, get, fmt, def, total) => {
    const parts = [['H', get(H)], ['A', get(A)], ['D', get(D)]].filter(([, v]) => v != null && Math.abs(v - def) > 1e-9);
    if (!parts.length) return;
    lines.push(`${label}: ${parts.map(([k, v]) => `${names[k]} ${fmt(v)}`).join(', ')}${parts.length > 1 ? ' = ' + fmt(total) : ''}`);
  };
  const off = (i) => (L) => (L.offset ? +L.offset[i] || 0 : null), dim = (i) => (L) => (L.dims && L.dims[i] != null ? +L.dims[i] : null), num = (k) => (L) => (L[k] != null ? +L[k] : null);
  add('Up', off(1), mmS, 0, f.offset[1]); add('Forward', off(2), mmS, 0, f.offset[2]); add('Their left', off(0), mmS, 0, f.offset[0]);
  add('Size', (L) => (L === H ? null : num('scale')(L)), pcS, 1, f.scale);
  add('Width', dim(0), pcS, 1, f.dims[0]); add('Height', dim(1), pcS, 1, f.dims[1]); add('Depth', dim(2), pcS, 1, f.dims[2]);
  add('Turn', num('turn'), degS, 0, f.turn); add('Tilt', num('tilt'), degS, 0, f.tilt); add('Lean', num('lean'), degS, 0, f.lean);
  add('Tuck', (L) => (L === H ? null : num('tuck')(L)), pctS, 0, f.tuck);
  return { lines, placed };
}
// the Hair window: the grid, the fit and the buzz
function hairWin() {
  const R = st.recipe || {}, hair = R.hair, head = R.head;
  const F = hair ? hairFit(hair) : null, f = hair ? fitFor(F, head, lib.headFitOf(head), lib.hugDefaultOf(hair)) : null;
  const P = hair && lib.entry('hair', hair), H = lib.entry('head', head);
  const items = [{ id: null, name: 'No hair' }, ...lib.list.parts.hair.map((p) => ({ id: p.id, name: p.name }))];
  const out = [grid('hair', items, hair, 'Hair')];
  // (the level, the fit in words, the levels added up)
  const ownPair = !!(F && F.heads && F.heads[head] && Object.keys(F.heads[head]).length), HL = lib.headFitOf(head), hasHL = !!(HL && Object.keys(headTidy(HL)).length);
  const lv = HAIR_LEVELS.map(([k, t, ti]) => [k, t + ((k === 'head' && ownPair) || (k === 'headAll' && hasHL) ? ' •' : ''), ti + ((k === 'head' && ownPair) || (k === 'headAll' && hasHL) ? ' (• it has some)' : '')]);
  const sum = hair ? hairSum(hair, head, f) : { lines: [], placed: false }, sumEl = el('div', 'cw-sum');
  sumEl.append(el('div', null, `${P ? P.name : 'No hair'} on ${H ? H.name : 'no head'}: ${hair ? fitWords(f) : '-'}`));
  if (sum.placed) sumEl.append(el('div', null, 'Placed by hand in Blender: worn exactly as he placed it (the hair\'s own fit left out; no tuck, no hug). Nudges, sizes and turns here still tune it.'));
  for (const l of sum.lines) sumEl.append(el('div', null, l));
  out.push(sec('Fit: your changes apply to', choice(lv, fitSt.scope, (k) => { fitSt.scope = k; paint('hair'); }, 'What the fit changes apply to'), sumEl));
  if (!hair) out.push(note('No hair on: pick one above (or the left and right arrow keys).'));
  // (a painted cut alone has nothing to fit; a hair with a mesh and a paint (the pink side-swept) fits its mesh, the paint
  // staying on the skin)
  else if (P && P.paint && !P.file) out.push(note('A painted cut (stubble on the skin itself): nothing to fit. Its buzz is below.'));
  else {
    const st2 = st.crew?.fitStats, L = fitSt.scope === 'headAll' ? (lib.headFitOf(head) || {}) : fitSt.scope === 'head' ? ((F && F.heads && F.heads[head]) || {}) : (F || {});
    const o = fitSt.scope === 'headAll' ? (L.offset || [0, 0, 0]) : f.offset;
    const knobs = [
      knob('Up', mmS(o[1]), ['▼', () => nudge(1, -1)], ['▲', () => nudge(1, 1)], 'Down', 'Up'),
      knob('Forward', mmS(o[2]), ['−', () => nudge(2, -1)], ['+', () => nudge(2, 1)], 'Back (toward the nape)', 'Forward (toward the face)'),
      knob('Their left', mmS(o[0]), ['−', () => nudge(0, -1)], ['+', () => nudge(0, 1)], 'To their right (your left as you face them)', 'To their left (your right as you face them)')];
    if (fitSt.scope !== 'headAll') knobs.push(knob('Size', +(f.scale * 100).toFixed(2) + '%', ['−', () => resize(-1)], ['+', () => resize(1)], 'A touch smaller', 'A touch bigger'));
    knobs.push(...dimKnobs(L));
    const fineChip = chip('Fine', fitSt.fine, () => { fitSt.fine = !fitSt.fine; paint('hair'); }, true, 'Small steps: 0.5 mm, 0.25%, tuck 2.5%, 2.5 mm (off: 2 mm, 1%, 10%, 1 cm)');
    const reset = chip('Reset', false, fitReset, true, fitSt.scope === 'head' ? 'This pair\'s own back to nothing: the hair\'s fit on every head' : fitSt.scope === 'headAll' ? 'This head\'s own setting back to nothing' : 'This hair back to as made (each pair\'s own stays)');
    out.push(sec(fitSt.scope === 'headAll' ? 'Every hair on this head' : fitSt.scope === 'head' ? 'This hair on this head only' : 'This hair, every head', row(knobs), row(fineChip, reset)));
    if (fitSt.scope !== 'headAll') {
      const tuckVal = val(Math.round(f.tuck * 100) + '%', st2 && f.tuck > 0 ? `${st2.tucked} points drawn in, ${st2.held} of them stopped 2 mm off the head` : 'The hair drawn in toward the head\'s centre, its thickness kept: 100% puts its underside 2 mm off this head; past 100% it\'s pressed thinner too');
      const tk = el('span', 'cw-knob'); tk.append(lab('Tuck'), chip('−', false, () => retuck('tuck', -1, TUCK_MAX), true, 'Less'), tuckVal, chip('+', false, () => retuck('tuck', 1, TUCK_MAX), true, 'More: drawn in toward the head\'s centre'));
      const sl = el('div', 'cw-slider'); sl.append(lab('Tuck 0 to 500%'), tuckSlider(f.tuck, tuckVal));
      out.push(sec('Tuck and hug', row(tk, knob('Full from', +(f.tuckStart * 100).toFixed(2) + ' cm', ['−', () => retuck('tuckStart', -1, 0.3)], ['+', () => retuck('tuckStart', 1, 0.3)], 'Higher (nearer the crown)', 'Lower',
        'How far below the top of the hair the tuck is full (above it, it fades out over 2 cm; 0: full all over)')), sl, row(hugKnobs(f, st2))));
    }
  }
  out.push(...buzzBits());
  out.push(sec('Show', row(...buzzView0(), chip('Smooth Mathwood hair', lib.smoothHair, () => smoothHair(!lib.smoothHair), true, 'The Mathwood hair smooth-shaded (off: its flat facets, as the pack has them)'))));
  return out;
}
// (width, height, depth, turn, tilt and lean: the level being set's own, as percentages and degrees)
function dimKnobs(L) {
  const d = [0, 1, 2].map((i) => (L.dims && L.dims[i] != null ? +L.dims[i] : 1)), lvl = HAIR_LEVELS.find((x) => x[0] === fitSt.scope)[1].toLowerCase();
  return [knob('Width', pc(d[0]), ['−', () => redim(0, -1)], ['+', () => redim(0, 1)], 'Narrower', 'Wider', 'Width, ' + lvl),
    knob('Height', pc(d[1]), ['−', () => redim(1, -1)], ['+', () => redim(1, 1)], 'Lower', 'Taller', 'Height, ' + lvl),
    knob('Depth', pc(d[2]), ['−', () => redim(2, -1)], ['+', () => redim(2, 1)], 'Shallower', 'Deeper', 'Depth (front to back), ' + lvl),
    knob('Turn', (+L.turn || 0).toFixed(2) + '°', ['↻', () => returnTo(-1)], ['↺', () => returnTo(1)], 'Its front to their right', 'Its front to their left', 'Turn round the upright line, ' + lvl),
    knob('Tilt', (+L.tilt || 0).toFixed(2) + '°', ['▲', () => returnTo(-1, 'tilt')], ['▼', () => returnTo(1, 'tilt')], 'Its front up (the back down)', 'Its front down (the back up)', 'Tilt round the line from ear to ear, ' + lvl),
    knob('Lean', (+L.lean || 0).toFixed(2) + '°', ['◀', () => returnTo(-1, 'lean')], ['▶', () => returnTo(1, 'lean')], 'Its top to their right', 'Its top to their left', 'Lean round the line from the nape to the face, ' + lvl)];
}
// (the hug, worn: on or off, how much, and how far off the scalp it leaves the hair's inner layer)
function hugKnobs(f, st2) {
  const on = f.hug > 0, words = st2 && on ? `${st2.hugged} points moved (${st2.under} of the dragged-down edge tucked under, ${st2.cleared} held clear of the head), the most ${st2.hugMostMm} mm` : 'The hair\'s inner layer drawn to the gap off this head; the dragged-down edge tucked under with it';
  if (f.placed) return [note('Placed by hand in Blender: worn as he placed it (no tuck, no hug)')];
  return [chip(on ? 'Hug on' : 'Hug off', on, () => rehug(0, on ? 0 : HUG_MAX), true, 'The hug on or off (' + (fitSt.scope === 'head' ? 'this pair' : 'every head') + ')'),
    knob('Hug', Math.round(f.hug * 100) + '%', ['−', () => rehug(-1)], ['+', () => rehug(1)], 'Less', 'More', words),
    knob('Gap', (f.hugGap * 1000).toFixed(2) + ' mm', ['−', () => regap(-1)], ['+', () => regap(1)], 'Nearer the skin', 'Further off', 'How far off the scalp the hug leaves the inner layer')];
}
// (the tuck's slider, 0 to 500%: the fit worn as it's dragged, the window remade when it's let go)
function tuckSlider(v, shown) {
  const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = Math.round(TUCK_MAX * 100); r.step = 5; r.value = Math.round(v * 100);
  r.setAttribute('aria-label', 'Tuck'); r.title = 'Tuck: 0 to ' + Math.round(TUCK_MAX * 100) + '% (100%: the underside 2 mm off this head; past it, pressed thinner)';
  r.oninput = () => { shown.textContent = r.value + '%'; setTuck(+r.value / 100, true); };
  r.onchange = () => { r.blur(); setTuck(+r.value / 100); };
  return r;
}
// ── BUZZ: each haircut's own buzz (kit/crew.js THE PAINT FIELD): the short hair a barber leaves outside the cut ──────
// Shown and changed for the hair worn: its sideburns (how far below the top of the ear, or none), its nape taper (how
// far below the hair's edge at the back, 0 none) and its front (the hairline along the forehead, how far below the
// hair's front edge, 0 none), on every head. Kept in this browser as they're made (lib.buzzes over crew.json's own,
// null: none) and worn at once; Save fits and Copy fits carry them. The view: the stubble and the scalp's shade under the
// hair each on or off, and the ears found (tinted: no paint ever goes there).
const BUZZ_KEY = 'crewlab.buzz.v1';
const BUZZ_STEP = { sideburns: [2, 0.5], nape: [2, 0.5], front: [1, 0.5] }, BUZZ_SB0 = 10;
const buzzSt = { view: { buzz: true, under: true, ears: false } };
// (a buzz with nothing in it left out: no sideburns (null), a nape of 0; numbers rounded; null when nothing is left)
function tidyBuzz(b) {
  if (!b) return null;
  const o = {};
  if (b.sideburns != null && Number.isFinite(+b.sideburns)) o.sideburns = +(+b.sideburns).toFixed(1);
  if (+b.nape > 0) o.nape = +(+b.nape).toFixed(1);
  if (+b.front > 0) o.front = +(+b.front).toFixed(1);
  if (b.look && Object.keys(b.look).length) o.look = b.look;
  return Object.keys(o).length ? o : null;
}
function readBuzzes() { try { const j = JSON.parse(localStorage.getItem(BUZZ_KEY) || '{}'); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (_) { return {}; } }
function saveBuzzes() {
  for (const id of Object.keys(lib.buzzes)) if (JSON.stringify(tidyBuzz(lib.buzzes[id])) === JSON.stringify(tidyBuzz((lib.entry('hair', id) || {}).buzz))) delete lib.buzzes[id];
  try { if (Object.keys(lib.buzzes).length) localStorage.setItem(BUZZ_KEY, JSON.stringify(lib.buzzes)); else localStorage.removeItem(BUZZ_KEY); }
  catch (_) { fitSt.note = 'This browser would not keep the buzzes: Save fits before you leave.'; }
}
lib.buzzes = renamed(readBuzzes());
// (what paints a hair has: a painted cut (the buzz cut), its bust's own marks, its scalp's shade)
const hairPaints = (P) => ({ cut: !!(P && P.paint && !P.file), marks: !!(P && P.paint && P.marks), under: !!(P && P.scalp && P.scalp.line) });
function buzzEdit(change) {
  const hair = st.recipe?.hair; if (!hair) return;
  const b = { ...(lib.buzzOf(hair) || {}) }; change(b);
  lib.buzzes[hair] = tidyBuzz(b); st.dirty = true;
  saveBuzzes(); st.crew?.setBuzz(lib.buzzOf(hair)); paint('hair'); paint('changes');
}
function buzzReset() { const hair = st.recipe?.hair; if (!hair) return; delete lib.buzzes[hair]; saveBuzzes(); st.crew?.setBuzz(lib.buzzOf(hair)); paint('hair'); paint('changes'); }
function buzzView(v) { Object.assign(buzzSt.view, v); st.crew?.paintView(buzzSt.view); paint('hair'); }
// (a buzz's few words: "sideburns 12 mm below the ear's top, nape taper 16 mm")
function buzzWords(P, b) {
  const h = hairPaints(P), w = [];
  if (h.cut) w.push('the cut itself');
  if (h.marks) w.push('its bust\'s own fade');
  if (b && b.sideburns != null) w.push(b.sideburns === 0 ? 'sideburns to the ear\'s top' : `sideburns ${Math.abs(b.sideburns)} mm ${b.sideburns > 0 ? 'below' : 'above'} the ear's top`);
  if (b && b.nape > 0) w.push(`nape taper ${b.nape} mm`);
  if (b && b.front > 0) w.push(`hairline ${b.front} mm along the forehead`);
  return w.length ? w.join(', ') : 'none: skin outside the hair';
}
function buzzView0() {
  const V = buzzSt.view;
  return [chip('Stubble', V.buzz, () => buzzView({ buzz: !V.buzz }), true, 'The buzz: the stubble outside the hair (and the buzz cut itself)'),
    chip('Scalp shade', V.under, () => buzzView({ under: !V.under }), true, 'The dark shade under the hair, which stops 4 mm inside its edge'),
    chip('Ears', V.ears, () => buzzView({ ears: !V.ears }), true, 'The ears found on this head, tinted: no paint ever goes there')];
}
function buzzBits() {
  const hair = st.recipe?.hair, P = hair && lib.entry('hair', hair), h = hairPaints(P), painted = h.cut || h.marks || h.under;
  const b = hair ? lib.buzzOf(hair) : null, isMine = !!(hair && own(lib.buzzes, hair)), fineB = (k) => BUZZ_STEP[k][fitSt.fine ? 1 : 0];
  const words = note(!hair ? 'No hair.' : !painted ? `${P ? P.name : hair} paints nothing on the skin.` : `${P.name}: ${buzzWords(P, b)}` + (isMine ? ' (yours)' : ''));
  if (!hair || !painted) return [sec('Buzz (short hair outside the cut)', words)];
  const sb = b && b.sideburns != null;
  return [sec('Buzz (short hair outside the cut, every head)', words,
    row(chip(sb ? 'Sideburns on' : 'Sideburns: none', sb, () => buzzEdit((t) => { t.sideburns = t.sideburns != null ? null : BUZZ_SB0; }), true, 'Sideburns in front of each ear, or none'),
      sb ? knob('Sideburns', (b.sideburns > 0 ? '' : b.sideburns < 0 ? '−' : '') + Math.abs(b.sideburns) + ' mm', ['▲', () => buzzEdit((t) => { t.sideburns -= fineB('sideburns'); })], ['▼', () => buzzEdit((t) => { t.sideburns += fineB('sideburns'); })], 'Shorter (their foot higher)', 'Longer (their foot lower)', 'How far below the top of the ear they reach (− above it)') : null,
      knob('Nape', (b && b.nape > 0 ? b.nape : 0) + ' mm', ['−', () => buzzEdit((t) => { t.nape = Math.max(0, (+t.nape || 0) - fineB('nape')); })], ['+', () => buzzEdit((t) => { t.nape = (+t.nape || 0) + fineB('nape'); })], 'A shorter taper at the back (0: none)', 'A longer taper at the back', 'How far below the hair\'s edge at the back the taper reaches'),
      knob('Front', (b && b.front > 0 ? b.front : 0) + ' mm', ['−', () => buzzEdit((t) => { t.front = Math.max(0, (+t.front || 0) - fineB('front')); })], ['+', () => buzzEdit((t) => { t.front = (+t.front || 0) + fineB('front'); })], 'A narrower hairline along the forehead (0: none)', 'A wider hairline along the forehead', 'How far below the hair\'s front edge the short hair reaches, thinning out'),
      chip('Reset', false, buzzReset, true, 'This hair\'s buzz back to crew.json\'s')))];
}

// ── CHANGES: what this browser has changed, and saving it ──────────────────────────────────────────────────────────
const nameOf = (kind, id) => (lib.entry(kind, id) || {}).name || id;
function changeList() {
  const L = [];
  for (const id of Object.keys(lib.fits)) L.push(['Hair fit', nameOf('hair', id)]);
  for (const id of Object.keys(lib.headFits)) L.push(['Every hair on a head', nameOf('head', id)]);
  for (const id of Object.keys(lib.buzzes)) L.push(['Buzz', nameOf('hair', id)]);
  for (const [h, s] of Object.entries(lib.seats)) for (const [suit, v] of Object.entries(seatMap(s))) L.push(['Seat', `${nameOf('head', h)} in ${suit === 'all' ? 'every outfit' : nameOf('suit', suit)}: ${Math.round(v * 1000)} mm`]);
  return L;
}
function changesWin() {
  const L = changeList(), out = [];
  const what = el('div', 'cw-sum');
  if (!L.length) what.append(el('div', null, 'Nothing changed: the crew as crew.json has them.'));
  else for (const [k, t] of L) { const d = el('div'); d.append(Object.assign(el('b', null, k + ': ')), t); what.append(d); }
  out.push(sec('Your changes (kept in this browser, worn at once)', what,
    note(L.length ? (st.dirty ? 'Changed since you last saved or copied them.' : fitSt.saved ? `Saved in ${fitSt.saved}.` : 'Kept in this browser. Save fits to send them.') : '')));
  out.push(sec('Save and send', row(chip('Save fits', false, saveFits, true, 'Everything you changed (hair fits, buzzes, seats) as a file, crewFits-<date>.json, to your Downloads, for merging into crew.json (merge_fits.mjs)'),
    chip('Copy fits', false, copyFits, true, 'The same text, copied (and shown in a box below)'),
    chip('Clear my changes' + (L.length ? ` (${L.length})` : ''), false, clearMine, true, 'Forget this browser\'s changes: back to crew.json\'s')),
  fitSt.note ? note(fitSt.note) : null));
  if (fitSt.out != null) {
    const box = document.createElement('textarea'); box.readOnly = true; box.spellcheck = false; box.value = fitSt.out; box.setAttribute('aria-label', 'Everything you changed, as JSON');
    box.rows = Math.min(10, fitSt.out.split('\n').length);
    out.push(sec('The text', box, row(chip('Close the box', false, () => { fitSt.out = null; fitSt.note = ''; paint('changes'); }, true, 'Hide the box'))));
  }
  return out;
}

function layout() {
  const W = innerWidth, H = innerHeight;
  canvas.style.height = H + 'px'; canvas.style.width = W + 'px';
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
}

// ── W A S D: move the view (Space up, C down, Shift faster); the arrow keys step the hair (left, right) and the head
// (up, down) ────────────────────────────────────────────────────────────────────────────────────────────────────
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
  const c = st.crew, fo = FOLLOW[st.cam];
  if (c && st.look && c.gaze) c.lookAt(camera.position);
  if (c && !st.paused) {
    if (fo) anchorAt(fo[0], _prev);
    c.update(dt);
    // (the following cameras keep the head or the neck in frame as the clip moves it)
    if (fo) { anchorAt(fo[0], _h); _h.sub(_prev); controls.target.add(_h); camera.position.add(_h); }
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
layout(); setCam(CAMS[st.cam] !== undefined ? st.cam : 'Full');
M = makeMenus({ items: WINDOWS, top: () => $('#top').getBoundingClientRect().bottom, onOpen: (id, on) => { if (on) paint(id, true); } });
menu();
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
  state: () => ({ who: st.who, clip: st.clip, recipe: st.recipe, tris, fps, parts: Object.keys(st.crew?.meshes || {}), body: st.crew?.body, hand: st.crew?.hand, expression: st.crew?.expression, rig: st.crew?.rig && { turnDiffMaxDeg: st.crew.rig.turnDiffMaxDeg }, smoothHair: lib.smoothHair,
    look: st.look, eyes: !!st.crew?.gaze, faceSliders: st.crew?.faceSliders || [], face: st.recipe?.face || {}, gaze: st.crew?.gaze ? { target: st.crew.gaze.target && st.crew.gaze.target.toArray(), eye: st.crew.gaze.eye } : null,
    cam: st.cam, shown: shownSeq === showSeq }),
  buzz: () => ({ open: M.isOpen('hair'), view: { ...buzzSt.view }, hair: st.recipe?.hair, wearing: st.crew?.buzz ?? null, shown: st.crew ? { ...st.crew.paintShown } : null, mine: copy(lib.buzzes), text: fitsText(), note: fitSt.note }),
  buzzView: (v) => buzzView(v),
  fit: () => ({ open: M.isOpen('hair'), scope: fitSt.scope, fine: fitSt.fine, hair: st.recipe?.hair, head: st.recipe?.head, wearing: st.crew?.fit || null, stats: st.crew?.fitStats,
    wearingFor: st.crew && { hair: st.crew.recipe.hair, head: st.crew.recipe.head }, mine: copy(lib.fits), mineHeads: copy(lib.headFits), text: fitsText(), box: fitSt.out, note: fitSt.note, saved: fitSt.saved || null, changes: changeList() }),
  step: (kind, d) => step(kind, d), win: (id, on) => M.open(id, on), menus: () => M.state(), thumbs,
  measure, crew: () => st.crew, lib, three: THREE, scene, camera, renderer, controls,
};
