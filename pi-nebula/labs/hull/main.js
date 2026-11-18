// THE HULL LAB: a place to try out how the outside of the station's hull looks. The game's maker, 2026-11-17: "I would
// prefer to have darker grey on the outside. I hope we can add some overlapping wearing and other metal textures like
// tempered, brushed, cross-hatches. The texture you put on the floor of the hanger is really nice. It would be great to
// have extra darkness around lines and edges to make the flat area really pop. It could even be cool to have a lab to
// experiment."
//
// WHAT IS SHOWN: a real-size piece of the hull (sample-plan.js): the wide middle band with one hangar door and its
// shield, two tiers stepping in above it and two below with rows of windows, one bevelled end; a person 1.8 m tall
// on the door's sill and a ship-sized block 17 m long in the hangar for scale. It hangs under the game's own sky and sun
// (world/sky.js), and the sun can be turned round it, because a metal finish changes with the light.
//
// THE SHAPE OF THE ARMOUR IS ONE OF FOUR OPTIONS, A TO D (sample-plan.js shapePlan; the game's maker, 2026-11-18: "I
// would prefer to see options, like A, B, C or D"): stacked plates, shoulders, big raised plates with sunk panels, a
// mix; each with tiers of different steps. The Shape window switches between them at once; the look stays as it is.
//
// THE LOOK IS THE GAME'S, NOT THE LAB'S: the settings, the ready-made looks, the station's own look (the one the
// game's maker made here: the lab opens on it) and the text that Copy makes are kit/hull-look.js; the materials and the
// plated tiers are kit/hull.js (hullMaterials, buildHull); the shapes are kit/hull-plates.js. This file only shows
// them and puts sliders on them.
//
// THE CONTROLS: W A S D fly (Space up, C down, Shift faster; the closer to the hull, the slower), drag to look. On a
// touch screen: drag to look, a stick to fly, two buttons for up and down. THE MENUS are the Crew Lab's own
// (../crew/windows.js, used as it is): a small master menu of categories, each opening a window that is dragged by its
// top bar and closed by its X; everything inside a window wraps.
//   Shape    the four shape options, A to D
//   Looks    the station's own look and three ready-made ones; Copy settings, Paste settings, Reset; the look as text
//            (the shape's letter rides in it)
//   Colours  the two greys, the trim, how much one plate differs from the next, the window light
//   Plates   width, height, the bevel, the cut corners, the seam's gap, the rows' shift, uneven widths and heights.
//            (Rows lapping over one another like roof tiles are not offered any more: "I don't want them to look like
//            shingles". The look still has its `lap` number, so old copied text still pastes; the lab lays every
//            shape with it at 0.)
//   Finish   for the middle band, the tiers and the trim, each its own: plain, brushed, tempered, cross-hatched,
//            mottled, with that finish's own sliders; shine and roughness
//   Wear     five layers, each its own amount: scratches, worn edges, dark streaks, meteoroid pits, grime
//   Edges    how dark and how wide the shading along every seam, plate edge and inside corner is
//   Light    turn the sun, raise it, its shadows on or off
//   View     places to look from; the scale markers on or off
//   Cost     the numbers in full (the strip at the top left has the short version)
// What he changes is kept in this browser (localStorage) between visits; where the windows are, for this tab.
//
// FOR THE PICTURE RIGS: ?rig keeps the drawing for a screenshot, ?ui=0 hides the menus, ?fresh forgets what was kept,
// ?shape=<A to D>&look=<name>&view=<name>&sun=<degrees>; and window.HULL (shape, set, useLook, view, from, sun, shadows,
// markers, stats, text; for measuring: bare, size, repeat).
import * as THREE from 'three';
import { createSky, DIR, skyDir } from '../../world/sky.js';
import { shieldMaterial, U } from '../../kit/materials.js';
import { hullMaterials, buildHull } from '../../kit/hull.js';
import { STATION_LOOK, SETTINGS, SETTING, HULL_LOOKS, LOOK_NAMES, GROUPS, GROUP_NAMES, FINISHES, FINISH_NAMES, FINISH_USES, readLook, writeLook, readShape, isLookText, sameLook, lookName, showValue } from '../../kit/hull-look.js';
import { makeMenus } from '../crew/windows.js';
import { SAMPLE_BOX, SHAPES, SHAPE_NAMES, SHAPE_SAYS, shapePlan } from './sample-plan.js';
import { inside, markers } from './dressing.js';

const $ = (s) => document.querySelector(s), q = new URLSearchParams(location.search);
const canvas = $('#c'), hud = $('#hud'), loading = $('#loading');
const RIG = q.has('rig'), TOUCH = matchMedia('(pointer: coarse)').matches || q.has('touch');
const KEY = 'hulllab.look.v1', VIEW_KEY = 'hulllab.view.v1';
const D2R = Math.PI / 180;

// ── what is kept between visits: the look, and how the piece is lit and shown ─────────────────────────────────
// (the sun: `turn` degrees round from where the game's sky has it, `high` degrees above level)
const SUN0 = { turn: Math.atan2(DIR.sun.z, DIR.sun.x) / D2R, high: Math.asin(DIR.sun.y) / D2R };
// (the sun's shadows start off, as nothing in the game casts one: with the game's low sun they change the picture
// very little, and they cost drawing the hull a second time)
const view = { turn: 0, high: Math.round(SUN0.high), shadows: false, markers: true, shape: SHAPES[0] };
// (the lab opens on the station's own look: the one the game's maker made here)
let look = readLook(STATION_LOOK);
if (!q.has('fresh')) {
  try { const t = localStorage.getItem(KEY); if (t && isLookText(t)) look = readLook(t); } catch (_) { /* nothing kept */ }
  try { const v = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null'); if (v && typeof v === 'object') { if (Number.isFinite(+v.turn)) view.turn = ((+v.turn % 360) + 360) % 360; if (Number.isFinite(+v.high)) view.high = Math.max(-30, Math.min(85, +v.high)); view.shadows = v.shadows === true; view.markers = v.markers !== false; if (SHAPES.includes(v.shape)) view.shape = v.shape; } } catch (_) { /* nothing kept */ }
}
if (HULL_LOOKS[q.get('look')]) look = readLook(HULL_LOOKS[q.get('look')]);
if (q.get('look') === 'station') look = readLook(STATION_LOOK);
if (SHAPES.includes((q.get('shape') || '').toUpperCase())) view.shape = q.get('shape').toUpperCase();
if (q.has('sun')) view.turn = ((+q.get('sun') % 360) + 360) % 360 || 0;
let saveT = 0;
const save = () => { try { localStorage.setItem(KEY, writeLook(look)); localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch (_) { /* this visit only */ } };
const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 300); };

// ── renderer, scene, light ──────────────────────────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: RIG });
if (!renderer.capabilities.isWebGL2) throw new Error('This lab needs WebGL2');
// (as sharp as the game draws: its medium setting on a phone, its high one on a desktop)
renderer.setPixelRatio(RIG ? 1 : Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 2));
// (as bright as the game draws: its own exposure, which its sky is made for)
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.74;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.info.autoReset = false;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, 0.15, 6000);
const stage = new THREE.Group(); scene.add(stage);
// the sun (the game's, where its sky has it until it is turned), the planet's shine, a soft light from all round
const sun = new THREE.DirectionalLight(0xfff0dc, 3.3), shine = new THREE.DirectionalLight(0xb9cfd8, 0.3), fill = new THREE.HemisphereLight(0xa9b8d6, 0x2a3038, 1.05);
shine.position.copy(DIR.planet).multiplyScalar(600);
sun.target.position.set(-10, 4, -8); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 100, far: 700 });
scene.add(sun, sun.target, shine, fill);

// the game's sky. Its own sun is drawn where this lab's sun is: the sky's picture is told the lab's direction (only
// this copy of the sky; the game's stays where it is)
const sky = createSky(renderer, { quality: TOUCH ? 'medium' : 'high' }); scene.add(sky.object);
const sunDir = DIR.sun.clone();
const skyU = (() => { const dome = sky.object.getObjectByName('sky:dome'); return (dome && dome.material && dome.material.uniforms) || {}; })();
if (skyU.uSun) skyU.uSun.value = sunDir;
// what the metal mirrors: the sky itself, pictured from the middle of the piece (again when the sun has moved)
const pmrem = new THREE.PMREMGenerator(renderer); let mirror = null, mirrorT = 0;
function mirrorSky() {
  const rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(1, 6000, rt);
  // (the sun's own disc is left out of what the metal mirrors: the sun's light already gives the metal its glint, and
  // mirrored as well it would glint twice over and turn dark plates pale)
  const disc = skyU.uSunR ? skyU.uSunR.value : 0; if (skyU.uSunR) skyU.uSunR.value = 1e-5;
  stage.visible = false; scene.environment = null;
  cc.update(renderer, scene);
  if (skyU.uSunR) skyU.uSunR.value = disc;
  const t = pmrem.fromCubemap(rt.texture); if (mirror) mirror.dispose(); mirror = t; scene.environment = t.texture;
  stage.visible = true; rt.dispose(); clearTimeout(mirrorT);
}
function placeSun() {
  sunDir.copy(skyDir(SUN0.turn + view.turn, view.high));
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 400); sun.castShadow = view.shadows;
  clearTimeout(mirrorT); mirrorT = setTimeout(mirrorSky, 120);
}

// ── the hull ────────────────────────────────────────────────────────────────────────────────────────────────────
const mats = hullMaterials(look), shield = shieldMaterial();
let hull = null, buildMs = 0, paintMs = 0;
function rebuild() {
  const t0 = performance.now();
  if (hull) hull.dispose();
  // (every shape is laid flush: rows lapping like roof tiles are not offered any more)
  hull = buildHull(shapePlan(view.shape), { ...look, lap: 0 }, mats, { shield }); stage.add(hull.group);
  buildMs = performance.now() - t0;
}
const room = inside(), marks = markers(); stage.add(room, marks);

// ── the camera: fly it, drag to look ───────────────────────────────────────────────────────────────────────────
const cam = { pos: new THREE.Vector3(58, 14, 34), yaw: 0, pitch: 0 };
const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3();
function applyCam() {
  const cp = Math.cos(cam.pitch);
  camera.position.copy(cam.pos); camera.lookAt(_v.copy(cam.pos).add(_f.set(-Math.sin(cam.yaw) * cp, -Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp)));
}
function lookFrom(at, to) {
  cam.pos.set(...at); const d = _v.set(...to).sub(cam.pos).normalize();
  cam.yaw = Math.atan2(-d.x, -d.z); cam.pitch = Math.asin(-d.y); applyCam();
}
const VIEWS = {
  whole: { name: 'Whole piece', at: [27, 8.6, -35], to: [-9, 4, -5] },
  wall: { name: 'The wall by the door', at: [23, 4.4, -29], to: [-2.6, 4.3, -18] },
  door: { name: 'The door', at: [35, 6, 7], to: [0, 4.6, -1] },
  plates: { name: 'Plates close up', at: [7.2, 5.4, -28.5], to: [-3.6, 4.4, -22.4] },
  end: { name: 'The bevelled end', at: [18, 13, -62], to: [-10, 4, -24] },
  tiers: { name: 'Tiers and windows', at: [16, 22, 0], to: [-6, 14.5, -9] },
  windows: { name: 'Windows close up', at: [8.3, 15.6, -1.5], to: [-3.2, 13.6, -1.7] },
  below: { name: 'From below', at: [26, -25, 14], to: [-6, -5, -8] },
  person: { name: 'Beside the person', at: [4.4, 2.5, -4.6], to: [0.2, 1.75, -8.2] },
};
let viewName = VIEWS[q.get('view')] ? q.get('view') : 'whole';
// (on a tall, narrow screen the same view is taken from further back, so the piece still fits across)
function setView(name) {
  if (!VIEWS[name]) return; viewName = name;
  const { at, to } = VIEWS[name], k = Math.max(1, 0.82 / camera.aspect);
  lookFrom(at.map((v, i) => to[i] + (v - to[i]) * k), to); paint('view');
}
// drag to look (a mouse, a pen or one finger)
{
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { if (drag) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const k = 0.0042 * camera.fov / 50; cam.yaw -= (e.clientX - drag.x) * k; cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - drag.y) * k, -1.5, 1.5);
    drag.x = e.clientX; drag.y = e.clientY; applyCam();
  });
  const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
}
// flying: W A S D along the level the way the view faces, Space up, C down, Shift faster; slower close to the hull
const FLY = { KeyW: [0, 0, 1], KeyS: [0, 0, -1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], Space: [0, 1, 0], KeyC: [0, -1, 0] };
const keys = new Set(), vel = new THREE.Vector3(), stickV = { x: 0, y: 0 }, vert = { v: 0 }; let fast = false;
const typing = (t) => t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) && t.type !== 'range' && t.type !== 'color';
addEventListener('keydown', (e) => { fast = e.shiftKey; if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return; keys.add(e.code); e.preventDefault(); });
// (Space flies up; it does not also press the button last pressed)
addEventListener('keyup', (e) => { fast = e.shiftKey; keys.delete(e.code); if (e.code === 'Space' && e.target && e.target.tagName === 'BUTTON') e.preventDefault(); });
addEventListener('blur', () => keys.clear());
function fly(dt) {
  let fx = stickV.x, fy = vert.v, fz = stickV.y; for (const k of keys) { fx += FLY[k][0]; fy += FLY[k][1]; fz += FLY[k][2]; }
  const p = cam.pos, B = SAMPLE_BOX, off = Math.hypot(Math.max(B.min[0] - p.x, 0, p.x - B.max[0]), Math.max(B.min[1] - p.y, 0, p.y - B.max[1]), Math.max(B.min[2] - p.z, 0, p.z - B.max[2]));
  const speed = THREE.MathUtils.clamp(off * 0.7, 2.5, 60) * (fast ? 3 : 1);
  camera.getWorldDirection(_f); _f.y = 0; if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); _f.normalize(); _r.crossVectors(_f, THREE.Object3D.DEFAULT_UP).normalize();
  _w.set(0, 0, 0).addScaledVector(_f, fz).addScaledVector(_r, fx); if (_w.lengthSq() > 1) _w.normalize(); _w.multiplyScalar(speed); _w.y = THREE.MathUtils.clamp(fy, -1, 1) * speed * 0.7;
  vel.lerp(_w, 1 - Math.exp(-9 * dt)); if (vel.lengthSq() < 1e-6) { vel.set(0, 0, 0); return; }
  cam.pos.addScaledVector(vel, dt); applyCam();
}
// the touch stick and the up and down buttons
function touchControls() {
  document.body.classList.toggle('touch', TOUCH); if (!TOUCH) return;
  const S = $('#stick'), K = $('#knob'); let id = null;
  const set = (e) => { const r = S.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2; let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } stickV.x = dx; stickV.y = -dy; K.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`; };
  S.addEventListener('pointerdown', (e) => { id = e.pointerId; S.setPointerCapture(id); set(e); e.preventDefault(); });
  S.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
  const end = () => { id = null; stickV.x = stickV.y = 0; K.style.transform = ''; };
  S.addEventListener('pointerup', end); S.addEventListener('pointercancel', end);
  for (const [b, v] of [['#up', 1], ['#down', -1]]) { const B = $(b); B.addEventListener('pointerdown', (e) => { B.setPointerCapture(e.pointerId); vert.v = v; B.classList.add('on'); }); const off = () => { vert.v = 0; B.classList.remove('on'); }; B.addEventListener('pointerup', off); B.addEventListener('pointercancel', off); }
}

// ── a change to the look: shown on the next frame, kept a moment later ─────────────────────────────────────────
let dirtyLook = true, dirtyPlates = true;
function changed(key) {
  dirtyLook = true; if (!key || SETTING[key].win === 'plates') dirtyPlates = true;
  saveSoon(); syncText();
}
// a whole look taken up (a ready-made one, pasted text, Reset): every window drawn again. Text that names a shape
// ("shape":"B") brings its shape with it
function take(next) { look = readLook(next); const s = readShape(next); if (s) view.shape = s; changed(); menu(); }
// one of the four shapes: the plates are laid again, the look stays
function setShape(letter) {
  if (!SHAPES.includes(letter) || letter === view.shape) return;
  view.shape = letter; dirtyPlates = true; saveSoon(); syncText(); paint('shape'); paint('cost');
}

// ── small pieces the windows are made of (the Crew Lab's styles) ───────────────────────────────────────────────
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const chip = (label, on, fn, sub, title) => { const b = el('button', 'chip' + (sub ? ' sub' : '') + (on ? ' on' : ''), label); b.onclick = fn; if (title) b.title = title; b.setAttribute('aria-pressed', String(!!on)); return b; };
const lab = (t) => el('span', 'kl-label', t);
const sec = (title, ...kids) => { const s = el('div', 'cw-sec'); if (title) s.append(el('div', 'cw-h', title)); s.append(...kids.flat().filter(Boolean)); return s; };
const row = (...kids) => { const r = el('div', 'cw-row'); r.append(...kids.flat().filter(Boolean)); return r; };
const note = (t) => el('div', 'cw-note', t);
const sum = (...lines) => { const s = el('div', 'cw-sum'); for (const l of lines) s.append(el('div', null, l)); return s; };
// a slider between its name and its value. s: { label, min, max, step, title }, show(v) the value as text
function slide(s, value, show, onInput) {
  const r = el('input'); r.type = 'range'; r.min = s.min; r.max = s.max; r.step = s.step; r.value = value; r.setAttribute('aria-label', s.label);
  const v = el('span', 'kl-val', show(value)), w = el('div', 'cw-slider');
  r.oninput = () => { const x = +r.value; v.textContent = show(x); onInput(x); };
  // (on a small screen the window is over the hull: while a slider is held, the window fades so the change shows)
  const hold = (on) => { const win = w.closest('.cw'); if (!win || !(TOUCH || innerWidth < 720)) return; win.classList.toggle('hl-held', on); w.classList.toggle('hl-live', on); };
  r.addEventListener('pointerdown', () => hold(true)); for (const e of ['pointerup', 'pointercancel', 'blur']) r.addEventListener(e, () => hold(false));
  if (s.title) w.title = s.title;
  w.append(lab(s.label), r, v); return w;
}
// one of the look's own numbers, by its name (a different label for this place, if given)
const setting = (key, label) => { const s = SETTING[key]; return slide(label ? { ...s, label } : s, look[key], (x) => showValue(s, x), (x) => { look[key] = x; changed(key); }); };
// one of the look's colours: a round swatch that opens the browser's own colour picker
function colour(key) {
  const s = SETTING[key], w = el('label', 'hl-colour'), i = el('input', 'kl-colour'), v = el('span', 'kl-val', look[key]);
  i.type = 'color'; i.value = look[key]; i.setAttribute('aria-label', s.label); if (s.title) w.title = s.title;
  i.oninput = () => { look[key] = i.value; v.textContent = i.value; changed(key); };
  w.append(i, lab(s.label), v); return w;
}

// ── THE MENUS ───────────────────────────────────────────────────────────────────────────────────────────────────
const WINDOWS = [
  { id: 'shape', label: 'Shape', title: 'Four ways to shape the armour, A to D' },
  { id: 'looks', label: 'Looks', title: 'The station\'s own look and three ready-made ones; copy, paste or reset your settings' },
  { id: 'colours', label: 'Colours', title: 'The greys, the trim and the window light' },
  { id: 'plates', label: 'Plates', title: 'The plates\' size, their bevel and their seams' },
  { id: 'finish', label: 'Finish', title: 'Plain, brushed, tempered, cross-hatched or mottled, for each group of plates' },
  { id: 'wear', label: 'Wear', title: 'Scratches, worn edges, streaks, pits and grime, each its own amount' },
  { id: 'edges', label: 'Edges', title: 'The darkness along seams, plate edges and inside corners' },
  { id: 'light', label: 'Light', title: 'Turn the sun round the hull' },
  { id: 'view', label: 'View', title: 'Places to look from, and the scale markers' },
  { id: 'cost', label: 'Cost', title: 'What this look costs to draw, in plain numbers' },
];
let M = null;
const st = { group: 'band', said: '', saidOk: true, textOpen: false };
const LOOK_SAYS = { 'dark armour': 'Dark greys, heavy bevelled plates with cut corners, dark seams, a soft brushed sheen', 'pale plates, dark seams': 'Pale painted plates between dark seams, closer to the station\'s insides', 'old and worn': 'Heat-stained, pitted and streaked: the older station' };
const FINISH_SAYS = { plain: 'Bare plate with only a fine grain.', brushed: 'Fine strokes all one way, lighter and darker, shinier and duller. At 0° they run along the hull, at 90° up and down.', tempered: 'The colours steel takes when it is heated: straw, bronze, purple, blue, in patches and toward the edges.',
  hatched: 'Two sets of cut lines at right angles. The angle turns them both.', mottled: 'Soft blotches, like the hangar\'s floor.' };
const FINISH_LABELS = { brushed: { Angle: 'Direction' }, hatched: { Angle: 'Angle' }, tempered: { Strength: 'Heat colour' } };

// THE FOUR SHAPES: one press changes the whole piece; the look (greys, finish, wear) stays as it is. (Four small
// buttons in a row and one line on the one that is showing, so the window stays small and the hull shows beside it.)
function shapeWin() {
  const k = view.shape, says = el('div', 'cw-sum'); says.append(el('b', null, k + ': ' + SHAPE_NAMES[k]), el('div', null, SHAPE_SAYS[k]));
  const pick = row(SHAPES.map((x) => chip(x, x === k, () => setShape(x), false, SHAPE_NAMES[x] + ': ' + SHAPE_SAYS[x]))); pick.classList.add('hl-shapes');
  return [sec('The shape of the armour', pick, says),
    note('All four have eight-sided windows, about half of them lit, and tiers that step in by different amounts. Your look stays as you change the shape.')];
}
const nameNow = () => (sameLook(look, STATION_LOOK) ? 'station' : lookName(look));
function looksWin() {
  const now = nameNow(), list = el('div', 'hl-looks');
  const one = (n, title, says, to) => {
    const b = el('button', 'hl-look' + (n === now ? ' on' : '')); b.append(el('b', null, title), el('span', null, says));
    b.setAttribute('aria-pressed', String(n === now)); b.onclick = () => { say(''); take(to); };
    list.append(b);
  };
  one('station', 'The station\'s own', 'The look made in this lab for the station: the one it is to be built with', STATION_LOOK);
  for (const n of LOOK_NAMES) one(n, n[0].toUpperCase() + n.slice(1), LOOK_SAYS[n] || '', HULL_LOOKS[n]);
  const box = el('textarea'); box.id = 'looktext'; box.rows = 9; box.spellcheck = false; box.value = textNow(); box.setAttribute('aria-label', 'The look as text');
  // (text typed or pasted into the box is taken up as soon as it reads as a look)
  box.oninput = () => { if (isLookText(box.value)) { const kept = box.value; look = readLook(kept); const s = readShape(kept); if (s) view.shape = s; dirtyLook = dirtyPlates = true; saveSoon(); say('Read from the box.', true); for (const id of M.ids()) if (id !== 'looks') paint(id); } else say('That text is not a look yet.', false); };
  const said = el('div', 'cw-note ' + (st.saidOk ? 'hl-ok' : 'hl-bad'), st.said); said.id = 'said';
  // (the text itself is folded away until it is wanted: Copy and Paste open it only when the browser will not do it for them)
  const fold = el('details', 'hl-fold'); fold.id = 'lookfold'; fold.open = st.textOpen; fold.ontoggle = () => { st.textOpen = fold.open; if (fold.open && M && !(M.state().size.looks || [])[2]) M.refit('looks'); };
  fold.append(el('summary', null, 'The look as text'), box, note('The whole look as text: copy from it, or paste a look into it.'));
  return [sec('Looks to start from', list),
    sec('Your settings', row(chip('Copy settings', false, copyLook, false, 'Copy the whole look and the shape\'s letter as text, to paste to someone'), chip('Paste settings', false, pasteLook, false, 'Take a look from text you have copied'),
      chip('Reset', false, () => { say('Back to the station\'s own look.', true); take(STATION_LOOK); }, true, 'Back to the station\'s own look')), said,
    note('Your changes are kept in this browser between visits.'), fold)];
}
function say(text, ok = true) { st.said = text; st.saidOk = ok; const s = $('#said'); if (s) { s.textContent = text; s.className = 'cw-note ' + (ok ? 'hl-ok' : 'hl-bad'); } }
function showText() { const f = $('#lookfold'); if (f && !f.open) f.open = true; }
// (the box shows the look as it is now, unless he is typing in it)
function syncText() { const b = $('#looktext'); if (b && document.activeElement !== b) b.value = textNow(); }
// (the look as text, with the shape's letter in it)
function textNow() { return writeLook(look, view.shape); }
async function copyLook() {
  const text = textNow(); let ok = false;
  try { await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 1500))]); ok = true; } catch (_) { ok = false; }
  const b = $('#looktext');
  if (ok) say('Copied: the whole look, ' + SETTINGS.length + ' settings, and shape ' + view.shape + '.', true);
  else { say('This browser would not copy for you: the text is picked out in the box, copy it from there.', false); showText(); if (b) { b.value = text; b.focus(); b.select(); } }
}
async function pasteLook() {
  let text = null;
  try { text = await Promise.race([navigator.clipboard.readText(), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 1500))]); } catch (_) { text = null; }
  if (text != null && isLookText(text)) { say('Pasted.', true); take(text); return; }
  const b = $('#looktext');
  say(text == null ? 'This browser would not paste for you: paste the text into the box.' : 'What you copied is not a look: paste a look\'s text into the box.', false);
  showText(); if (b) { b.focus(); b.select(); }
}
function coloursWin() {
  return [sec('The plates', row(colour('grey'), colour('grey2')), setting('vary')), sec('The trim', row(colour('trim'))),
    sec('The windows', row(colour('windowColour')), setting('windowBright'), setting('windowGlass'), setting('windowStars'))];
}
function platesWin() {
  const n = hull ? hull.stats.plates : null;
  return [sec('Size', setting('plateW'), setting('plateH')), sec('How they meet', setting('bevel'), setting('cut'), setting('gap')), sec('How they are laid', setting('shift'), setting('uneven'), setting('unevenRows')),
    el('div', 'cw-sum', n ? `${n.all} plates on this piece: ${n.band} on the middle band, ${n.tiers} on the tiers, ${n.trim} of trim.` : '')];
}
function finishWin() {
  const g = st.group, kind = look[g + 'Finish'], labels = FINISH_LABELS[kind] || {};
  return [sec('Which plates', row(GROUPS.map((k) => chip(GROUP_NAMES[k], k === g, () => { st.group = k; flash(k); paint('finish', true); }, false, k === 'trim' ? 'Frames, lips and window surrounds' : k === 'band' ? 'The wide middle band the hangars are in' : 'The stepped tiers above and below')))),
    sec('Finish', row(FINISHES.map((k) => chip(FINISH_NAMES[k], k === kind, () => { look[g + 'Finish'] = k; changed(g + 'Finish'); paint('finish', true); }, true, FINISH_SAYS[k]))), note(FINISH_SAYS[kind]),
      FINISH_USES[kind].map((k) => setting(g + k, labels[k]))),
    sec('How it shines', setting(g + 'Shine'), setting(g + 'Rough'))];
}
// the plates of a group lit up on the hull for a moment, so it is plain which plates the group is
const FLASH = new THREE.MeshBasicMaterial({ color: 0xffb347 }); let flashT = 0;
function flash(g) {
  const m = hull && hull.group.getObjectByName('hull:' + g); if (!m) return;
  clearTimeout(flashT); for (const k of GROUPS) { const o = hull.group.getObjectByName('hull:' + k); if (o) o.material = mats[k]; }
  m.material = FLASH; flashT = setTimeout(() => { const o = hull && hull.group.getObjectByName('hull:' + g); if (o) o.material = mats[g]; }, 420);
}
function wearWin() {
  return [sec('Layers, each its own amount', setting('scratches'), setting('edgeWear'), setting('streaks'), setting('pits'), setting('grime')),
    note('The layers stack: each is added over the ones above it.')];
}
function edgesWin() {
  return [sec('Edge darkness', setting('edgeDark'), setting('edgeWide')), note('A dark line in every seam, and each plate\'s flat shaded in from its edge so its middle stands out; three times as wide in the inside corners where one tier meets the next.')];
}
function lightWin() {
  const deg = (x) => Math.round(x) + '°';
  return [sec('The sun', slide({ label: 'Turn the sun', min: 0, max: 360, step: 1, title: 'Round the hull, from where the game\'s sky has it' }, view.turn, deg, (x) => { view.turn = x; placeSun(); saveSoon(); }),
    slide({ label: 'Sun height', min: -30, max: 85, step: 1, title: 'How far above level the sun stands' }, view.high, deg, (x) => { view.high = x; placeSun(); saveSoon(); }),
    row(chip('The sun\'s shadows', view.shadows, () => { view.shadows = !view.shadows; placeSun(); saveSoon(); paint('light'); }, false, 'The shadows the tiers cast on one another. They show most with the sun high; they cost drawing the hull a second time (see Cost)'),
      chip('The game\'s sun', false, () => { view.turn = 0; view.high = Math.round(SUN0.high); placeSun(); saveSoon(); paint('light'); }, true, 'Back to where the game\'s sky has its sun'))),
    note('At 0° the sun is where the game\'s sky has it: low, shining on the hangar doors from one side.')];
}
function viewWin() {
  return [sec('Look from', row(Object.entries(VIEWS).map(([k, v]) => chip(v.name, k === viewName, () => setView(k), true)))),
    sec('For scale', row(chip('Person and ship', view.markers, () => { view.markers = !view.markers; marks.visible = view.markers; saveSoon(); paint('view'); }, false, 'A person 1.8 m tall on the door\'s sill; a ship-sized block 17 m long in the hangar'))),
    note(TOUCH ? 'Drag to look. The stick flies; the two buttons go up and down.' : 'W A S D fly, Space up, C down, Shift faster; drag to look. Flying slows down close to the hull.')];
}
const N = (x) => Math.round(x).toLocaleString('en-US'), MB = (b) => (b / 1048576).toFixed(1) + ' MB';
function costWin() {
  if (!hull) return [];
  const s = hull.stats, f = frame;
  return [sum(`The hull alone: ${N(s.triangles.all)} triangles in ${s.draws} draws (a draw is one batch of triangles handed to the graphics card).`,
    `Plates: ${s.plates.band} middle band, ${s.plates.tiers} tiers, ${s.plates.trim} trim; ${s.windows} windows, ${s.lit} of them lit.`,
    `Shape ${view.shape}: ${s.shapes.stacked} stacked plates, ${s.shapes.slabs} big raised plates, ${s.shapes.recesses} sunk panels, ${s.shapes.shoulders} shoulders.`,
    `Memory: ${mats.pictures} pictures (each ${512} pixels square), ${MB(mats.bytes)}; the plates' shapes, ${MB(s.meshBytes)}.`),
    sum(`The whole view now, with the sky, the hangar's inside and the markers: ${N(f.tris)} triangles in ${f.calls} draws${view.shadows ? ' (the sun\'s shadows draw the hull a second time)' : ''}.`,
      `A frame: ${f.ms.toFixed(1)} ms (${Math.round(1000 / f.ms)} a second)` + (f.gpu != null ? `; the drawing itself: ${f.gpu.toFixed(2)} ms.` : '.'),
      `Plates rebuilt in ${buildMs.toFixed(0)} ms; pictures and settings applied in ${paintMs.toFixed(0)} ms.`),
    note('The hull is ' + s.draws + ' draws however big it is: one for each group of plates, one for the windows, one for the shields.')];
}
const RENDER = { shape: shapeWin, looks: looksWin, colours: coloursWin, plates: platesWin, finish: finishWin, wear: wearWin, edges: edgesWin, light: lightWin, view: viewWin, cost: costWin };
function paint(id, grow) {
  if (!M || !M.isOpen(id)) return;
  const body = M.body(id), keep = body.scrollTop;
  body.replaceChildren(...RENDER[id]()); body.scrollTop = keep;
  // (a window whose contents have grown is sized to fit them again, unless he has set its size himself)
  if (grow && body.scrollHeight > body.clientHeight + 1) { const z = M.state().size[id]; if (!z || !z[2]) M.refit(id); }
}
function menu() { if (M) for (const id of M.ids()) paint(id); }

// ── the numbers in the corner ──────────────────────────────────────────────────────────────────────────────────
const frame = { ms: 16.7, gpu: null, tris: 0, calls: 0 };
// (how long the graphics card takes over a frame, where the browser will say)
const gl = renderer.getContext(), tq = gl.getExtension('EXT_disjoint_timer_query_webgl2'); let query = null, timing = false;
function timeBegin() { if (!tq || query) return; query = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, query); timing = true; }
function timeEnd() {
  if (timing) { gl.endQuery(tq.TIME_ELAPSED_EXT); timing = false; return; }
  if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
    if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6; frame.gpu = frame.gpu == null ? ms : frame.gpu * 0.8 + ms * 0.2; }
    gl.deleteQuery(query); query = null;
  }
}
function numbers() {
  if (!hull) return;
  const s = hull.stats;
  hud.textContent = `${N(s.triangles.all)} triangles · ${s.draws} draws · pictures' memory ${MB(mats.bytes)} · ${frame.ms.toFixed(1)} ms a frame`;
  hud.title = 'The hull alone: its triangles, its draws, its pictures\' memory; and how long a whole frame takes. More in Cost.';
  if (M && M.isOpen('cost')) paint('cost');
}

function layout() {
  const W = innerWidth, H = innerHeight;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
}
addEventListener('resize', layout);

// ── the frame ───────────────────────────────────────────────────────────────────────────────────────────────────
let last = performance.now(), acc = 0, count = 0, hudT = 0, repeat = 1;
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.1, (t - last) / 1000); acc += t - last; count++; last = t;
  if (dirtyLook) { const t0 = performance.now(); mats.set(look); paintMs = performance.now() - t0; dirtyLook = false; }
  if (dirtyPlates) { rebuild(); dirtyPlates = false; paint('plates'); }
  fly(dt); U.time.value += dt; sky.update(dt);
  // (for measuring, the frame can be drawn several times over, so the graphics card is kept busy while it is timed)
  renderer.info.reset(); timeBegin(); for (let i = 0; i < repeat; i++) renderer.render(scene, camera); timeEnd();
  frame.tris = renderer.info.render.triangles; frame.calls = renderer.info.render.calls;
  hudT += dt; if (hudT > 0.5) { frame.ms = acc / count; acc = 0; count = 0; hudT = 0; numbers(); }
});

// ── start ───────────────────────────────────────────────────────────────────────────────────────────────────────
layout(); touchControls(); placeSun(); marks.visible = view.markers; setView(viewName);
mats.set(look); rebuild(); dirtyLook = dirtyPlates = false; mirrorSky();
const topPx = () => $('#top').getBoundingClientRect().bottom;
numbers();                                // (the strip at the top is its full height before the menu is put under it)
if (q.get('ui') !== '0') {
  let fresh = true; try { fresh = !sessionStorage.getItem('hulllab.windows.v1'); } catch (_) { /* as a first visit */ }
  M = makeMenus({ items: WINDOWS, store: 'hulllab.windows.v1', top: topPx, onOpen: (id, on) => { if (on) paint(id); } });
  M.master.setAttribute('aria-label', 'Hull Lab menu');
  // (a first visit on a wide screen starts with the four shapes open)
  if (fresh && innerWidth >= 900) requestAnimationFrame(() => requestAnimationFrame(() => M.open('shape', true)));
} else for (const id of ['#top', '#stick', '#updown']) $(id).style.display = 'none';    // (a picture rig's view: the hull alone)
loading.hidden = true;

// for the picture rigs and the checks
window.HULL = {
  ready: true, VIEWS, renderer,
  set(o) { take({ ...look, ...o }); }, useLook(name) { if (name === 'station') take(STATION_LOOK); else if (HULL_LOOKS[name]) take(HULL_LOOKS[name]); },
  shape(letter) { if (letter) setShape(String(letter).toUpperCase()); return view.shape; },
  look: () => ({ ...look }), text: () => textNow(),
  view: (name) => setView(name), from: (at, to) => lookFrom(at, to),
  sun(turn, high) { view.turn = turn; if (high != null) view.high = high; placeSun(); clearTimeout(mirrorT); mirrorSky(); paint('light'); },
  shadows(on) { view.shadows = !!on; placeSun(); }, markers(on) { view.markers = !!on; marks.visible = view.markers; },
  // (for measuring what the look costs: the plates drawn with a plain lit material in place of the hull's own)
  bare(on) { const plain = this._plain || (this._plain = new THREE.MeshStandardMaterial({ color: 0x4d525a, roughness: 0.55, metalness: 0.4 })); hull.group.traverse((o) => { if (o.isMesh && GROUPS.includes(o.name.slice(5))) o.material = on ? plain : mats[o.name.slice(5)]; }); },
  size(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }, retime() { frame.gpu = null; }, repeat(n) { repeat = Math.max(1, n | 0); frame.gpu = null; },
  win: (id, on) => M && M.open(id, on), menus: () => M && M.state(), where: () => ({ at: cam.pos.toArray(), yaw: cam.yaw, pitch: cam.pitch }), name: () => nameNow(),
  stats: () => ({ ...hull.stats, pictures: mats.pictures, pictureBytes: mats.bytes, frame: { ...frame }, buildMs, paintMs, info: { tris: renderer.info.render.triangles, calls: renderer.info.render.calls, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries } }),
};
