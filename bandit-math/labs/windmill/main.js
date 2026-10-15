// THE WINDMILL TOWER LAB: build a windmill tower as high as a stack of lumber allows, then call the wind and see how
// much of it stands. A Bandit Math prototype page, standing on its own (it changes nothing in the game; it reads the
// game's fonts, ground textures, trees and townsfolk).
//
// How a round goes: first set the four footing stones (drag one in or out: how wide the tower stands, half a foot to
// 8 feet; it locks when the first board is nailed). Cut boards on the left, drag the pieces up onto the tower, nail
// them. Each board nailed shows its twins glowing on the other walls (the same post on the other corners, the same
// crosspiece or brace on the other walls), and the view eases round a little so they show: a tap builds one with wood
// from the stack, a double tap builds them all; tapping a nailed board shows its twins again (their clock stops while
// a question is open). Drag anywhere else to walk round the tower and up and down it; you build on whichever wall
// faces you (lifting a piece off the panel squares the view up on it again; a board in hand stays on its wall while
// you walk round to look, and the view comes back to it when you let go). Now and then
// the miller asks about a triangle you just made, or how long a brace a bay needs; a right answer earns an extra board.
// Call the wind: a breeze, then growing gusts from every side. A real (simple) frame calculation decides what holds
// (frame.js), and whether the whole tower tips over on its stones. If something gives, the tower comes down; the miller
// pays flour for the height left standing, the yard is cleared and a fresh stack of lumber waits (the stones stay
// where they were set).
//
// Files: tower.js (the tower as data), frame.js (the physics), wind-worker.js (runs the wind test off the page's
// thread, so a big tower doesn't freeze the page), questions.js (the math), build.js (the panel, placing, and every
// touch on the view), tower3d.js (drawing the boards and the twins), fall.js (the crash), scene.js (the hilltop, wind,
// the stones, the miller), sound.js.
// window.WM is a handle for test scripts. ?perf shows frames per second, ?askall asks at every chance.
import * as THREE from 'three';
import { START_W, MAX_W, BOARDS, BOARD_FT, newTower, faceSegments, faceToWorld, FACE_NORMAL, cornerXZ, towerHeight, worldBoards, postSide, ends, boardCount, twinsOf, spotTaken } from './tower.js';
import { windTest, whatStands, STAGES, findJoints, isKnee, touch, TOL } from './frame.js';
import { trianglesOf, makeQuestion, bayQuestion } from './questions.js';
import { makeScene, makeMiller, wind, FT, groundY } from './scene.js';
import { makeTowerView } from './tower3d.js';
import { makeFall } from './fall.js';
import { makeBuild, fmt } from './build.js';
import * as sound from './sound.js';

const TARGET_FT = 16;          // a tower standing this tall after the wind earns the windmill head and its sails
const DEG = Math.PI / 180;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const phone = matchMedia('(max-width: 700px)').matches || /Mobi|Android/i.test(navigator.userAgent);

const el = {
  view: $('view'), canvas: $('c'), overlay: $('overlay'), hint: $('hint'),
  count: $('count'), countWord: $('count-word'), bench: $('bench'), benchEmpty: $('bench-empty'), benchBoard: $('bench-board'), benchLabel: $('bench-label'),
  tape: $('tape'), saw: $('saw'), sawLabel: $('saw-label'), cutBtn: $('cut'), pieces: $('pieces'), piecesEmpty: $('pieces-empty'),
  gMove: $('g-move'), gA: $('g-a'), gB: $('g-b'), nailBtn: $('nail'), stoneHandles: [0, 1, 2, 3].map((c) => $('stone-' + c)),
  selBar: $('sel-bar'), selHint: $('sel-hint'), panel: $('panel'),
};

// ── the renderer, camera, world ─────────────────────────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: el.canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);   // (narrow, so the wall in front reads flat and square)
const world = makeScene({ low: phone });
const { scene } = world;
const towerView = makeTowerView(scene);
const fall = makeFall(scene);

const app = {
  el, tower: newTower(START_W), face: 0, phase: 'build', held: null, selected: null, dirty: true, autoScroll: 0,
  lumber: { stack: BOARDS, bench: null, pieces: [] }, placed: [],
};
let miller = null;
let best = { height: 0, width: 0 };
try { const b = JSON.parse(localStorage.getItem('bm-windmill-best') || '{}'); best = { height: +b.height || 0, width: +b.width || 0 }; } catch (e) { /* no storage: no record yet */ }

// ── the camera: walks round the tower (any angle), up and down it, zooms a little; round the side for the wind test ─
// az: the angle round the tower (0 looks at the front wall), y: the height it looks at (feet), pitch: how far it looks
// down (steeper while the stones are being set), zoom: 1 is the distance that fits the wall
// fit: how much further back the camera stands so a long held board fits a narrow view (1: not at all)
const cam = { az: 0, azV: 0, squareT: null, y: 4, yT: 4, stones: 1, zoom: 1, fit: 1, follow: true, mode: 'face', pos: new THREE.Vector3(0, 3, 14), look: new THREE.Vector3(0, 2, 0), d: 10 };
const azOf = (k) => Math.atan2(FACE_NORMAL[k][0], FACE_NORMAL[k][1]);
const ZOOM = [0.55, 1.6];
function fitDistance() {
  const r = el.view.getBoundingClientRect(), aspect = r.width / Math.max(1, r.height), t = Math.tan(camera.fov / 2 * DEG), W = app.tower.W;
  const hw = (W / 2 + (aspect < 0.6 ? 1.7 : 2.6)) * FT, hh = 8 * FT;
  return Math.max(hw / (t * aspect), hh / t) + W / 2 * FT;
}
function resize() {
  const r = el.view.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height);
  // a tall narrow screen (a phone held upright) gets a wider lens, or the tower would be a speck
  camera.fov = camera.aspect < 0.6 ? 46 : camera.aspect < 1 ? 36 : 30; camera.updateProjectionMatrix();
  cam.d = fitDistance(); build && build.renderPanel(); placeFaceName(); app.dirty = true;
}
const topY = () => towerHeight(app.tower) + 12;
let orbiting = false;
function updateCamera(dt) {
  if (app.autoScroll) cam.yT = Math.max(3, Math.min(topY(), cam.yT + app.autoScroll * 10 * dt));
  // a flick keeps turning a moment; taking up a board settles the view square on the wall
  if (!orbiting && Math.abs(cam.azV) > 0.01) { cam.az += cam.azV * dt; cam.azV *= Math.exp(-3.2 * dt); } else if (!orbiting) cam.azV = 0;
  if (cam.squareT !== null) { const d = angDiff(cam.squareT, cam.az); cam.az += d * Math.min(1, dt * 5); if (Math.abs(d) < 0.002) { cam.az = cam.squareT; cam.squareT = null; } }
  cam.y += (cam.yT - cam.y) * Math.min(1, dt * 6);
  // setting the stones: look down on the square of stones from higher up; building: level with the wall
  const stonesT = app.phase === 'build' && stonesOpen() && !app.held ? 1 : 0;
  cam.stones += (stonesT - cam.stones) * Math.min(1, dt * 3);
  const pitch = 0.035 + cam.stones * 0.43;
  if (!app.held) cam.fit += (1 - cam.fit) * Math.min(1, dt * 2.5);
  updateFace();
  const want = new THREE.Vector3(), look = new THREE.Vector3();
  let rate = 9;
  if (cam.mode === 'face') {
    const ly = (cam.y + (0.5 - cam.y) * cam.stones) * FT, D = cam.d * cam.zoom * cam.fit * (1 + cam.stones * 0.12); look.set(0, ly, 0);
    want.set(Math.sin(cam.az) * Math.cos(pitch) * D, ly + Math.sin(pitch) * D, Math.cos(cam.az) * Math.cos(pitch) * D);
    rate = orbiting ? 30 : 9;
  } else if (cam.mode === 'test') {
    // (once it is coming down, closer in, on the pile)
    const H = (test && test.crashing && fall.time > 0.8 ? 9 : Math.max(8, towerHeight(app.tower) || 8)) * FT, t = Math.tan(camera.fov / 2 * DEG), aspect = camera.aspect;
    const narrow = aspect < 0.6;
    const d = (Math.max((H / 2 + 1.5) / t, (app.tower.W * FT + (narrow ? 1.2 : 5)) / (t * aspect)) * (narrow ? 1 : 1.1) + 2) * Math.min(1.25, cam.zoom);
    // (on a phone the result card covers the lower half: look lower so the tower sits up top)
    const ly = H * 0.45 - (narrow && app.phase === 'result' ? d * t * 0.45 : 0);
    const a = cam.testAz; look.set(0, ly, 0); want.set(Math.sin(a) * d, H * 0.45 + 1.5, Math.cos(a) * d); rate = orbiting ? 12 : 2.2;
  } else if (cam.mode === 'miller' && miller) {
    const p = miller.root.position, f = new THREE.Vector3(Math.sin(miller.root.rotation.y), 0, Math.cos(miller.root.rotation.y));
    look.set(p.x, p.y + 1.35, p.z); want.copy(look).addScaledVector(f, 4.2).add(new THREE.Vector3(0, 0.25, 0)); rate = 3;
  }
  cam.pos.lerp(want, Math.min(1, dt * rate)); cam.look.lerp(look, Math.min(1, dt * rate));
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  // a big gust shoves the watcher too: a small shake
  if (wind.level > 0.5 && cam.mode === 'test') { const k = (wind.level - 0.5) * 0.04, t = performance.now() / 1000; camera.position.x += Math.sin(t * 23) * k; camera.position.y += Math.sin(t * 31 + 1) * k * 0.6; }
  // keep the camera above the hill
  const gy = groundY(camera.position.x, camera.position.z) + 0.4; if (camera.position.y < gy) camera.position.y = gy;
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// the wall you build on is the one facing the camera most (it changes a little past the corner, so it doesn't flicker).
// A board in hand stays on its wall while you walk round to look (the view eases back to it when you let go).
function updateFace() {
  if (cam.mode !== 'face' || app.held) return;
  const k = ((Math.round(cam.az / (Math.PI / 2)) % 4) + 4) % 4;
  if (k === app.face || Math.abs(angDiff(cam.az, azOf(k))) > Math.PI / 4 - 0.07) return;
  app.face = k; showFaceName(); walkMiller(); app.dirty = true;
}
// a drag on the view: sideways walks round, up and down climbs (the tower follows the finger)
app.orbit = (dx, dy) => {
  const r = el.view.getBoundingClientRect();
  if (app.phase === 'build') {
    orbiting = true; cam.squareT = null; cam.azV = 0; app.orbited = true;
    cam.az -= dx / r.width * Math.PI * 1.1;
    const ftPerPx = 2 * cam.d * cam.zoom * cam.fit * Math.tan(camera.fov / 2 * DEG) / FT / r.height;
    if (Math.abs(dy) > 0.5) { cam.yT = Math.max(3, Math.min(topY(), cam.yT + dy * ftPerPx)); cam.y = cam.yT; cam.follow = false; }
  } else if (cam.mode === 'test') { orbiting = true; cam.testAz -= dx / r.width * Math.PI; }
};
app.orbitRelease = (vx) => {
  orbiting = false;
  const r = el.view.getBoundingClientRect();
  if (app.phase === 'build' && app.held) squareUp();
  else if (app.phase === 'build') cam.azV = Math.max(-4, Math.min(4, -vx * 1000 / r.width * Math.PI * 1.1));
};
Object.defineProperty(app, 'zoom', { get: () => cam.zoom });
// is the view turned to the wall you build on? (walked well round to look, a board in hand is seen edge on: its handles
// and labels wait until the view comes back)
app.facingWall = () => cam.mode !== 'face' || Math.abs(angDiff(cam.az, azOf(app.face))) < 0.85;
// a held board running off the sides of a narrow view (a phone): the camera backs off a little each frame until both
// ends are in sight (called only while no finger is moving it, so it never slides out from under one)
app.fitHeld = (A, B, r) => {
  const most = ZOOM[1] * 1.15 / cam.zoom, room = Math.min(A.x, B.x, r.width - A.x, r.width - B.x);
  if (room < 30 && cam.fit < most) cam.fit = Math.min(most, cam.fit * 1.025);
  else if (room > 60 && cam.fit > 1) cam.fit = Math.max(1, cam.fit / 1.01);     // (and closes in again once there is room)
};
app.setZoom = (z) => { cam.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], z)); };
// lifting a piece off the panel: the view starts to square up on the wall facing you while the piece is carried over
// (so it has mostly settled by the time the piece reaches the tower); taking it up: square, and follow the work again
const squareUp = () => { cam.azV = 0; cam.squareT = azOf(app.face) + Math.round((cam.az - azOf(app.face)) / (Math.PI * 2)) * Math.PI * 2; };
app.onDragStart = () => { if (app.phase === 'build') squareUp(); };
app.onTakeUp = () => { cam.follow = true; squareUp(); };

// wall coordinates (feet on face k) <-> the screen (pixels inside the view)
const v3 = new THREE.Vector3();
app.toScreen = (k, x, y) => {
  const w = faceToWorld(app.tower.W, k, x, y), n = FACE_NORMAL[k];
  v3.set(w.X * FT + n[0] * 0.06, w.Y * FT, w.Z * FT + n[1] * 0.06).project(camera);
  const r = el.view.getBoundingClientRect();
  return { x: (v3.x + 1) / 2 * r.width, y: (1 - v3.y) / 2 * r.height };
};
app.worldToScreen = (X, Y, Z) => {
  v3.set(X * FT, Y * FT, Z * FT).project(camera);
  const r = el.view.getBoundingClientRect();
  return { x: (v3.x + 1) / 2 * r.width, y: (1 - v3.y) / 2 * r.height, behind: v3.z > 1 };
};
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const aim = (cx, cy) => { const r = el.view.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
app.toWall = (cx, cy) => {
  aim(cx, cy);
  const k = app.face, n = FACE_NORMAL[k], N = new THREE.Vector3(n[0], 0, n[1]), W = app.tower.W;
  const plane = new THREE.Plane(N, -(W / 2 * FT + 0.06)), hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  const o = faceToWorld(W, k, 0, 0), t = [[1, 0], [0, -1], [-1, 0], [0, 1]][k];
  return { x: ((hit.x - o.X * FT) * t[0] + (hit.z - o.Z * FT) * t[1]) / FT, y: hit.y / FT };
};
// a point on the ground under the pointer (feet, the tower's middle at 0)
app.toGround = (cx, cy) => {
  aim(cx, cy); const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
  return { X: hit.x / FT, Z: hit.z / FT };
};
app.pxToFt = (px) => { const r = el.view.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, a = app.toWall(cx, cy), b = app.toWall(cx + px, cy); return a && b ? Math.abs(b.x - a.x) : 0.5; };

// ── the walls: names ─────────────────────────────────────────────────────────────────────────────────────────────────
const FACE_NAMES = ['Front wall', 'Right side', 'Back wall', 'Left side'];
function showFaceName() { $('face-name').textContent = FACE_NAMES[app.face]; }

// ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────────
const build = makeBuild(app);
app.onLumber = (n) => { world.setPile(n); if (ghosts) refreshGhosts(); };
// (a nailed board sawn off says so on its own bar, below; the miller's line is for the board in hand)
app.onSawOff = (len, kept, nailed) => { if (!nailed) say(kept ? `${fmt(len)} offcut. It's with your cut pieces.` : `That bit's too short to use. Kindling for my stove.`, { key: kept ? 'offcut' : 'kindling', times: 2, force: true, ms: 4000 }); };
app.onTowerChanged = (src, note) => {
  // (a board sawn shorter: its twins are worked out again from it, so they take the new length)
  if (src && ghosts && ghosts.src === src) ghosts.list = twinsOf(app.tower, src, ghosts.where);
  rebuild();
  if (src && app.selected === src) app.select(src, note);
};

// ── the footing stones: the first step ──────────────────────────────────────────────────────────────────────────────
// They can be moved until the first board is nailed (and again once the tower is all taken down).
const stonesOpen = () => boardCount(app.tower) === 0;
app.stonesOpen = stonesOpen;
// (while a stone is being dragged the camera holds still, so the stone stays under the finger; it refits after)
app.setWidth = (w, dragging = false) => {
  if (!stonesOpen()) return false;
  app.tower.W = w; world.setStones(w); if (!dragging) cam.d = fitDistance(); sound.stone(w); ghosts = null; rebuild();
  return true;
};
app.onStonesSet = () => {
  const W = app.tower.W;
  cam.d = fitDistance();
  if (W <= 2) say(`${fmt(W)} apart: mighty narrow. Cheap on wood, but a tall narrow tower tips right over in a gust.`, { key: 'narrow', times: 3, force: true });
  else if (W >= 7) say(`${fmt(W)} apart: she'll stand steady, but every crossbar is a whole board, and corner to corner is longer than any board.`, { key: 'wide', times: 3, force: true });
  else say(`Stones ${fmt(W)} apart. They'll stay put once the first board is nailed.`, { key: 'stones', times: 4, force: true });
};

// ── nailing, picking up, undo ────────────────────────────────────────────────────────────────────────────────────────
let idN = 1;
// put a board on the tower: a corner post (on corner c) or a wall board (on face k). Returns the record.
function addBoard(spec) {
  const t = app.tower;
  if (spec.kind === 'post') { const rec = { id: 'p' + idN++, y: spec.y, len: spec.len }; t.corners[spec.corner].push(rec); app.placed.push({ rec, corner: spec.corner }); return rec; }
  const rec = { id: 'b' + idN++, x: spec.x, y: spec.y, ang: Math.atan2(Math.sin(spec.ang), Math.cos(spec.ang)), len: spec.len };
  t.walls[spec.face].push(rec); app.placed.push({ rec, face: spec.face }); return rec;
}
app.nail = () => {
  const h = app.held; if (!h) return;
  const k = app.face, side = postSide(h, app.tower.W), e = ends(h);
  const spec = side !== null ? { kind: 'post', corner: side === 0 ? k : (k + 1) % 4, y: Math.min(e.ay, e.by), len: h.len } : { kind: 'wall', face: k, x: h.x, y: h.y, ang: h.ang, len: h.len };
  const first = stonesOpen();
  // a board touching at two places gets two nails (counted before it goes up, or it would find itself)
  const nails = build.contactsOf(h).length >= 2 ? 2 : 1;
  const rec = addBoard(spec);
  app.held = null; sound.hammer(nails); app.lastNails = nails;
  // its twins on the other walls, glowing, a tap away
  makeGhosts(rec, spec);
  rebuild();
  // keep the top of the work in view
  const top = Math.max(e.ay, e.by);
  if (cam.follow && top > cam.yT + 4) cam.yT = top - 2;
  // square on to a wall, the twins on the other walls hide behind it or show only their edges: the view eases round a
  // little toward a three-quarter look so they show (taking up the next board squares it again)
  if (ghosts && ghosts.list.some((g) => g.ok)) {
    const base = azOf(app.face) + Math.round((cam.az - azOf(app.face)) / (Math.PI * 2)) * Math.PI * 2, off = cam.az - base;
    if (Math.abs(off) < 0.3) { cam.squareT = base + (off < -0.02 ? -1 : 1) * 0.46; cam.azV = 0; }
  }
  afterNail(rec, spec, first);
};
// pick out a nailed board (or none): it lights up, its bar offers to take it down, and its twins that aren't built
// glow again. note: a word on the bar first (after a saw cut: how much came off, flashed so it is seen)
app.select = (src, note) => {
  const again = src && src === app.selected;
  app.selected = src; towerView.highlight(src);
  el.selBar.hidden = !src || app.phase !== 'build';
  if (!src) return;
  const what = (src.ang === undefined ? 'Corner post' : 'Board') + ', ' + fmt(src.len);
  el.selHint.textContent = note ? `${note} · ${what}` : what; $('say').hidden = true;
  if (note) { el.selHint.classList.remove('is-sawn'); void el.selHint.offsetWidth; el.selHint.classList.add('is-sawn'); }
  if (!again && app.phase === 'build') showTwinsOf(src);
};
// the twins of a nailed board, shown again (when it is picked out), unless they are all built
function showTwinsOf(src) {
  if (ghosts && ghosts.src === src) { ghosts.born = performance.now(); return; }
  const k = app.tower.walls.findIndex((w) => w.includes(src)), c = app.tower.corners.findIndex((cl) => cl.includes(src));
  if (k < 0 && c < 0) return;
  const keep = ghosts;
  makeGhosts(src, k >= 0 ? { kind: 'wall', face: k } : { kind: 'post', corner: c });
  refreshGhosts();
  if (!ghosts || !ghosts.list.length) { ghosts = keep; refreshGhosts(); }
}
// is this tap the second of a quick double tap on a twin just built? (then it builds all the rest, never a saw cut)
app.twinDoubleTap = (cx, cy) => performance.now() - lastTwinTap.t < 450 && Math.hypot(cx - lastTwinTap.x, cy - lastTwinTap.y) < 40 && !!lastTwinTap.g;
// a twin (or any board spec) on the screen: its two ends in view pixels, and how far it is from the camera (metres)
function specOnScreen(g) {
  const W = app.tower.W;
  let a, b;
  if (g.kind === 'post') { const [X, Z] = cornerXZ(W, g.corner); a = { X, Y: g.y, Z }; b = { X, Y: g.y + g.len, Z }; }
  else { const e = ends(g); a = faceToWorld(W, g.face, e.ax, e.ay); b = faceToWorld(W, g.face, e.bx, e.by); }
  const A = app.worldToScreen(a.X, a.Y, a.Z), B = app.worldToScreen(b.X, b.Y, b.Z);
  const depth = camera.position.distanceTo(v3.set((a.X + b.X) / 2 * FT, (a.Y + b.Y) / 2 * FT, (a.Z + b.Z) / 2 * FT));
  return { A, B, depth, behind: A.behind || B.behind };
}
const distToSeg = (p, A, B) => { const vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((p.x - A.x) * vx + (p.y - A.y) * vy) / L2)); return Math.hypot(A.x + vx * t - p.x, A.y + vy * t - p.y); };
const TWIN_REACH = 22;    // CSS pixels: a tap this close to a twin builds it
// the twin a tap at (cx, cy) means: one the tap lands right on, else the nearest within a fingertip of it, unless a
// nailed board under the finger stands in front of that twin. -> { g } or { board } or {}
function pickAt(cx, cy) {
  aim(cx, cy);
  const hitG = ray.intersectObjects(towerView.ghostMeshes(), false)[0], b = app.held ? null : ray.intersectObjects(towerView.meshes(), false)[0];
  if (hitG && ghosts && (!b || hitG.distance < b.distance + 0.02)) return { g: ghosts.list[hitG.object.userData.ghost] };
  if (ghosts && towerView.ghostMeshes().length) {
    const r = el.view.getBoundingClientRect(), p = { x: cx - r.left, y: cy - r.top };
    let best = null, bd = TWIN_REACH;
    for (const g of ghosts.list) { const o = specOnScreen(g); if (o.behind) continue; const d = distToSeg(p, o.A, o.B); if (d < bd) { bd = d; best = { g, depth: o.depth }; } }
    // (with a nailed board under the finger as well, the twin wins when it stands in front of that board, or when the
    // tap is nearer the twin's line on screen than the board's own: so the board can still be picked by tapping it
    // squarely, and a twin peeking out just beside it can still be built)
    if (best && (!b || best.depth < b.distance + 0.05 || bd < screenDistToBoard(b.object, p) - 1)) return { g: best.g };
  }
  return b ? { board: b.object.userData.src } : {};
}
function screenDistToBoard(mesh, p) {
  const rec = towerView.boards.get(mesh.userData.key); if (!rec) return 0;
  const r = el.view.getBoundingClientRect(), S = (v) => { v3.copy(v).project(camera); return { x: (v3.x + 1) / 2 * r.width, y: (1 - v3.y) / 2 * r.height }; };
  return distToSeg(p, S(rec.a), S(rec.b));
}
// what a tap with nothing in hand lands on: a glowing twin (built), a grey one (the miller says why), or a nailed
// board (picked out)
let lastTwinTap = { t: 0, x: 0, y: 0, g: null };
app.tapAt = (cx, cy) => {
  if (app.phase !== 'build') return;
  // a quick second tap on the twin just built (the spot it filled): build all the rest
  if (performance.now() - lastTwinTap.t < 450 && Math.hypot(cx - lastTwinTap.x, cy - lastTwinTap.y) < 40 && lastTwinTap.g) {
    const r = el.view.getBoundingClientRect(), o = specOnScreen(lastTwinTap.g);
    if (!o.behind && distToSeg({ x: cx - r.left, y: cy - r.top }, o.A, o.B) < TWIN_REACH) { lastTwinTap.t = 0; confirmAll(); return; }
  }
  const pick = pickAt(cx, cy), gh = pick.g;
  if (gh) {
    if (gh.ok) { if (confirmGhost(gh)) lastTwinTap = { t: performance.now(), x: cx, y: cy, g: gh }; }
    else say(gh.reason === 'no wood left' ? 'No wood left for that one. A right answer to my questions earns another board.' : 'That one would have nothing to nail to yet. Put up the posts it hangs on first.', { key: 'grey-' + gh.reason, times: 3, force: true, ms: 5000 });
    return;
  }
  if (!app.held) app.select(pick.board || null);
};
$('pickup').onclick = () => { if (app.phase === 'build' && app.selected) pickUp(app.selected); };
$('undo').onclick = () => { if (app.phase !== 'build') return; if (app.held) { build.putBack(); return; } const last = app.placed[app.placed.length - 1]; if (last) pickUp(last.rec); };
// take a board down (it goes back to the cut pieces); anything left with nothing holding it up comes down too
function pickUp(src) {
  const t = app.tower, back = [];
  const drop = (rec) => {
    for (const w of t.walls) { const i = w.indexOf(rec); if (i >= 0) { w.splice(i, 1); back.push(rec.len); } }
    for (const c of t.corners) { const i = c.indexOf(rec); if (i >= 0) { c.splice(i, 1); back.push(rec.len); } }
    app.placed = app.placed.filter((p) => p.rec !== rec);
  };
  drop(src);
  // what still reaches the ground through its joints
  for (let guard = 0; guard < 50; guard++) {
    const held = new Set(), links = new Map(), link = (a, b) => { (links.get(a) || links.set(a, new Set()).get(a)).add(b); (links.get(b) || links.set(b, new Set()).get(b)).add(a); };
    for (let k = 0; k < 4; k++) {
      const segs = faceSegments(t, k);
      for (const h of findJoints(segs)) { const ids = h.items.map((it) => segs[it.s].src); if (h.ground) ids.forEach((s) => held.add(s)); for (let i = 1; i < ids.length; i++) link(ids[0], ids[i]); }
    }
    const reach = new Set(held), stack = [...held];
    while (stack.length) { const s = stack.pop(); for (const o of links.get(s) || []) if (!reach.has(o)) { reach.add(o); stack.push(o); } }
    const loose = [...t.walls.flat(), ...t.corners.flat()].filter((r) => !reach.has(r));
    if (!loose.length) break;
    loose.forEach(drop);
  }
  for (const len of back) build.returnPiece(len);
  // (the twins of a board that came down go with it)
  if (ghosts && ![...t.walls.flat(), ...t.corners.flat()].includes(ghosts.src)) ghosts = null;
  sound.clatter(back[0] || 4, 'set'); app.select(null); rebuild();
}

function rebuild() {
  towerView.rebuild(app.tower); towerView.nails.visible = true; towerView.highlight(app.selected); towerView.showHead(false);
  $('height').textContent = fmt(towerHeight(app.tower));
  $('base').textContent = fmt(app.tower.W);
  showBest();
  refreshGhosts();
  app.dirty = true;
}
function showBest() { $('best').textContent = fmt(best.height); $('best-base').textContent = best.height && best.width ? 'on ' + fmt(best.width) : ''; placeFaceName(); }
// the wall's name sits just under the stats box, however tall the box has grown (a best height adds a line to it)
function placeFaceName() {
  const v = el.view.getBoundingClientRect(), b = document.querySelector('.bar.top .stats').getBoundingClientRect();
  if (b.height) $('face-name').style.top = Math.round(b.bottom - v.top + 6) + 'px';
}

// ── the twins: glowing boards in the matching spots on the other walls ─────────────────────────────────────────────
// Made when a board is nailed by hand (a new board's twins replace the last one's). Each is checked again whenever the
// tower or the lumber changes: built already (gone), nothing to nail it to yet or no wood for it (grey, with the
// reason). They fade away if left alone a while.
let ghosts = null;     // { src (the board nailed), where (its corner or wall), list, born }
const GHOST_STAY = 16000, GHOST_FADE = 5000;
function makeGhosts(rec, spec) {
  const where = spec.kind === 'post' ? { corner: spec.corner } : { face: spec.face };
  ghosts = { src: rec, where, list: twinsOf(app.tower, rec, where), born: performance.now() };
}
function twinHolds(t, g) {
  const segs = [];
  let me;
  if (g.kind === 'post') {
    if (g.y < TOL) return true;
    me = { ax: 0, ay: g.y, bx: 0, by: g.y + g.len, len: g.len };
    for (const f of [g.corner, (g.corner + 3) % 4]) for (const s of faceSegments(t, f)) segs.push(f === g.corner ? s : { ...s, ax: s.ax - t.W, bx: s.bx - t.W });
  } else {
    me = { ...ends(g), len: g.len };
    if (Math.min(me.ay, me.by) < TOL) return true;
    segs.push(...faceSegments(t, g.face));
  }
  return segs.some((s) => touch(me, s).length > 0);
}
function refreshGhosts() {
  if (!ghosts) { towerView.setGhosts([], app.tower.W); return; }
  const t = app.tower;
  ghosts.list = ghosts.list.filter((g) => !spotTaken(t, g));
  for (const g of ghosts.list) {
    const holds = twinHolds(t, g), wood = build.woodFor(g.len);
    g.ok = holds && !!wood; g.reason = !holds ? 'nothing to nail to' : !wood ? 'no wood left' : '';
  }
  if (!ghosts.list.length) ghosts = null;
  towerView.setGhosts(ghosts ? ghosts.list : [], t.W);
}
app.ghostList = () => (ghosts ? ghosts.list : []);
// build one twin: wood from the stack (a matching cut piece, else a fresh board sawn to length), hammered in
function confirmGhost(g, delay = 0) {
  if (!g || !g.ok || !ghosts) return false;
  const paid = build.payFor(g.len); if (!paid) { refreshGhosts(); return false; }
  addBoard(g);
  const nails = g.kind === 'wall' ? 2 : 1;
  setTimeout(() => sound.hammer(nails), delay + (paid.cut ? 900 : 0));
  ghosts.born = performance.now(); said.twinsBuilt = (said.twinsBuilt || 0) + 1;
  rebuild();
  if (!said.twinTip && app.placed.length >= 2) { said.twinTip = 1; setTimeout(() => say('Every board comes off your stack, twins too. Count your wood before you build them all.', { key: 'twin-wood', times: 1 }), 1500); }
  return true;
}
function confirmAll() {
  let n = 0;
  for (let guard = 0; guard < 8 && ghosts; guard++) {
    const g = ghosts.list.find((q) => q.ok); if (!g) break;
    confirmGhost(g, n * 450); n++;
  }
  return n;
}

// ── the miller's advice: friendly, now and then, never twice in a row the same ───────────────────────────────────
const said = {}; let sayTimer = null, lastSay = 0;
function say(text, { key = text, times = 2, force = false, ms = 7000 } = {}) {
  // (each line at most `times` times; force: say it now, even if the miller spoke a moment ago)
  const now = performance.now();
  if ((said[key] || 0) >= times || (!force && now - lastSay < 5000)) return false;
  said[key] = (said[key] || 0) + 1; lastSay = now;
  $('say-text').textContent = text; $('say').hidden = false;
  clearTimeout(sayTimer); sayTimer = setTimeout(() => { $('say').hidden = true; }, ms);
  gesture('Interact');
  return true;
}
// a one-off move (a wave, a point), then back to standing easy
let gestureTimer = null;
function gesture(name, ms = 1700) {
  if (!miller || miller.walking) return false;
  const ok = miller.play(name, { once: true, fade: 0.2 });
  clearTimeout(gestureTimer); gestureTimer = setTimeout(() => { if (miller && !miller.walking) miller.play('Idle', { fade: 0.4 }); }, ms);
  return ok;
}
// "a" or "an" before a length said aloud ("an 8½ ft brace", "an 11 ft board")
const an = (s) => (/^(8|11|18)(\D|$)/.test(s) ? 'an ' : 'a ') + s;
const angDeg = (s) => { let a = Math.abs(Math.atan2(s.by - s.ay, s.bx - s.ax)) / DEG; if (a > 90) a = 180 - a; return a; };
const isLevel = (s) => angDeg(s) < 3, isUpright = (s) => angDeg(s) > 87;
const hasDiagonal = (segs) => segs.some((s) => !s.post && !isLevel(s) && !isUpright(s));
// a bubble of help at the foot of the view when nothing else is going on
app.idleHint = () => {
  const ok = ghosts ? ghosts.list.filter((g) => g.ok) : [];
  if (ok.length) {
    // can any of them be seen? (square on to a wall, the twin behind the board just nailed and the ones on the side
    // walls, seen edge on, hardly show)
    const r = el.view.getBoundingClientRect(), w = ghosts.where;
    const src = specOnScreen(w.corner !== undefined ? { kind: 'post', corner: w.corner, y: ghosts.src.y, len: ghosts.src.len } : { kind: 'wall', face: w.face, x: ghosts.src.x, y: ghosts.src.y, ang: ghosts.src.ang, len: ghosts.src.len });
    const seen = ok.some((g) => {
      const o = specOnScreen(g), mx = (o.A.x + o.B.x) / 2, my = (o.A.y + o.B.y) / 2;
      if (o.behind || mx < 0 || mx > r.width || my < 50 || my > r.height) return false;
      if (Math.hypot(o.B.x - o.A.x, o.B.y - o.A.y) < 18) return false;
      return !(distToSeg(o.A, src.A, src.B) < 8 && distToSeg(o.B, src.A, src.B) < 8);
    });
    if (!seen) return `${ok.length === 1 ? 'Its twin glows' : `${ok.length} twins glow`} on the other walls: drag sideways to walk round and tap them`;
    if ((said.twinsBuilt || 0) < 3) return 'Tap a glowing twin to build it · double-tap builds them all';
  }
  if (!app.orbited && boardCount(app.tower) > 0) return 'Drag to walk round the tower and climb it';
  return '';
};

let sinceQuestion = 3, questionsAsked = 0;
function afterNail(rec, spec, first) {
  const k = spec.kind === 'wall' ? spec.face : app.face, isPost = spec.kind === 'post';
  const segs = faceSegments(app.tower, k), me = segs.find((s) => s.src === rec);
  const n = app.placed.length, H = towerHeight(app.tower), W = app.tower.W;
  const forced = params.has('askall');
  sinceQuestion++;
  const chance = questionsAsked === 0 ? 0.7 : sinceQuestion >= 5 ? 0.9 : 0.35;
  const askNow = () => forced || (sinceQuestion >= 2 && Math.random() < chance);
  // a crosspiece that closes a bay: how long a brace would reach corner to corner?
  const bay = me && !isPost && isLevel(me) ? bayUnder(segs, me, W) : null;
  if (bay && askNow()) {
    const q = bayQuestion(W, bay.h, bay.y0);
    if (q) { setTimeout(() => ask(q), 450); sinceQuestion = 0; questionsAsked++; return; }
  }
  // a question about a triangle this board just made?
  if (me && !isPost) {
    const tris = trianglesOf(segs, me.id);
    if (tris.length && askNow()) {
      const q = makeQuestion(tris, me);
      if (q) { setTimeout(() => ask(q), 450); sinceQuestion = 0; questionsAsked++; return; }
    }
  }
  // otherwise, maybe a word from the miller
  if (first) {
    say(isPost ? 'Good: a post on the corner, straight up. See the glowing ones? Tap one to put the same post on that corner.' : 'Start with the corner posts, standing straight up. A post wants to be plumb, 90 degrees.', { force: true, ms: 9000 });
    return;
  }
  if (!me) return;
  const a = angDeg(me), slant = !isPost && !isLevel(me) && !isUpright(me);
  const tris = slant ? trianglesOf(segs, me.id) : [];
  // a slanting board nailed to both posts, or one closing a triangle, is a brace however steep it is (on a narrow base
  // the corner-to-corner brace can't be any flatter), not a post that leans
  const posts = new Set(segs.filter((s) => s.post && touch(me, s).length).map((s) => (s.ax < W / 2 ? 0 : 1)));
  const isBrace = slant && (posts.size === 2 || tris.length > 0);
  if (slant && a > 70 && a < 87 && !isBrace) { say('That one leans. A post wants to be plumb, 90 degrees, or the weight pushes it over.', { key: 'plumb' }); return; }
  if (bay) {
    const diag = Math.hypot(W, bay.h);
    if (diag > BOARD_FT + 0.01) { say(`Corner to corner, that bay wants ${an(fmt(diag))} brace: longer than a board. Brace from a post up to the crosspiece, or make the bay shorter.`, { key: 'longbay', times: 2 }); return; }
  }
  if (slant) {
    const others = () => { const bare = [1, 2, 3].map((d) => (k + d) % 4).filter((f) => !hasDiagonal(faceSegments(app.tower, f))); if (bare.length) setTimeout(() => { if (app.phase === 'build') say('Wind blows from every side. Every wall needs its own brace: tap the glowing twins.', { key: 'other' }); }, 5200); };
    if (isKnee(me, W)) { say('A knee brace helps some, but its nails take a beating in a big gust. A long brace corner to corner holds better.', { key: 'knee' }); return; }
    if (!tris.length) { say('That brace makes no triangle: an end stops short of the corner, so the square can still fold. Set its ends right on the corners.', { key: 'notri', times: 3, force: true }); return; }
    if (a > 60 && isBrace && W < 4) { say('Steep, but on a base this narrow that\'s as good as a brace gets.', { key: 'steepnarrow', times: 1 }); others(); return; }
    if (a < 30 || a > 60) { say(`That brace is at ${Math.round(a)} degrees. Brace it nearer 45 and she'll hold.`, { key: 'steep' }); return; }
    say('Brace it at 45 and she\'ll hold. A triangle can\'t fold.', { key: 'good45', times: 1 });
    others();
    return;
  }
  if (isLevel(me) && !hasDiagonal(segs) && segs.filter((s) => s.post).length >= 2) { say('A square with no brace folds over like a card table in the wind.', { key: 'card', times: 2 }); return; }
  if (H >= 16 && !said.h16) { said.h16 = 1; say('Sixteen feet! Taller than my mill roof.', { key: 'h16', force: true }); return; }
  if (n >= 3 && !app.orbited) { say('Drag the hillside to walk round the tower, and up and down to climb it.', { key: 'orbit', times: 1 }); return; }
  if (app.lumber.stack === 0 && !app.lumber.bench && app.lumber.pieces.length <= 1) say('That\'s the last of the lumber. Call the wind when you\'re ready.', { key: 'last', times: 1 });
}
// the bay a level board closes: posts on both edges reaching from the floor below (the ground or a crosspiece the
// full width) up to it. -> { y0, h } or null
function bayUnder(segs, me, W) {
  const y = (me.ay + me.by) / 2, lo = Math.min(me.ax, me.bx), hi = Math.max(me.ax, me.bx);
  if (lo > 0.05 || hi < W - 0.05) return null;
  let y0 = 0;
  for (const s of segs) if (s !== me && !s.post && isLevel(s) && Math.min(s.ax, s.bx) < 0.05 && Math.max(s.ax, s.bx) > W - 0.05) { const sy = (s.ay + s.by) / 2; if (sy < y - 0.3 && sy > y0) y0 = sy; }
  // posts on both edges covering y0..y
  const covered = (x) => { let top = y0; const ps = segs.filter((s) => s.post && Math.abs(s.ax - x) < 0.05).sort((a, b) => a.ay - b.ay); for (const p of ps) if (p.ay <= top + 0.05 && p.by > top) top = p.by; return top >= y - 0.05; };
  if (!covered(0) || !covered(W)) return null;
  return { y0, h: y - y0 };
}

// ── a math question card ─────────────────────────────────────────────────────────────────────────────────────────────
function ask(q) {
  if (app.phase !== 'build') return;
  app.phase = 'question'; app.select(null);
  const card = $('question');
  card.innerHTML = `<h2>${q.bay ? 'How long a brace?' : 'A triangle!'}</h2><div class="sub">Get it right and the miller adds a board to your stack.</div>
    ${trianglePic(q)}<p>${q.prompt}</p>
    <div class="choices">${q.choices.map((c) => `<button data-v="${c}">${c}${q.unit}</button>`).join('')}</div>
    <div class="why" hidden></div><div class="row" hidden><button class="btn go" id="q-ok">Back to building</button></div>`;
  card.hidden = false;
  gesture('Interact');
  card.querySelectorAll('.choices button').forEach((b) => b.onclick = () => {
    const v = +b.dataset.v, right = v === q.answer;
    card.querySelectorAll('.choices button').forEach((x) => { x.disabled = true; if (+x.dataset.v === q.answer) x.classList.add('is-right'); });
    const why = card.querySelector('.why'); why.hidden = false;
    if (right) {
      sound.chime(); why.innerHTML = `<b>Right!</b> ${q.why} The miller adds a fresh board to your stack.`;
      build.giveBoard();
      const f = $('flybonus'); f.hidden = false; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); setTimeout(() => { f.hidden = true; }, 1300);
    } else {
      b.classList.add('is-wrong'); sound.soft();
      why.innerHTML = `Not quite. ${q.why}${helperPic(q)}`;
    }
    card.querySelector('.row').hidden = false;
    // (back to building: the twins that were glowing get their full time again)
    card.querySelector('#q-ok').onclick = () => { card.hidden = true; app.phase = 'build'; if (ghosts) ghosts.born = performance.now(); };
  });
}
// the triangle itself, drawn from the wall, with what is known and the "?"
function trianglePic(q) {
  const pts = q.pts, xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  // (room all round for the labels pushed out from the sides)
  const s = Math.min(240 / Math.max(0.1, maxX - minX), 118 / Math.max(0.1, maxY - minY));
  const P = pts.map((p) => ({ x: 40 + (p.x - minX) * s + (240 - (maxX - minX) * s) / 2, y: 154 - (p.y - minY) * s - (118 - (maxY - minY) * s) / 2 }));
  const cx = (P[0].x + P[1].x + P[2].x) / 3, cy = (P[0].y + P[1].y + P[2].y) / 3;
  let out = `<svg class="pic" viewBox="0 0 320 186"><polygon points="${P.map((p) => p.x + ',' + p.y).join(' ')}" fill="rgba(210,165,113,.35)" stroke="#6d4b2b" stroke-width="5" stroke-linejoin="round"/>`;
  // the sides' labels (side i runs from point i to point i+1), pushed outward from the middle
  q.sideLabels.forEach((l, i) => {
    if (!l) return; const a = P[i], b = P[(i + 1) % 3], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1;
    out += `<text x="${mx + dx / d * 20}" y="${my + dy / d * 20 + 6}" text-anchor="middle" font-family="Bitter, Georgia, serif" font-weight="700" font-size="18" fill="${l === '?' ? '#b0401f' : '#2b2219'}">${l}</text>`;
  });
  q.angleLabels.forEach((l, i) => {
    if (!l) return; const p = P[i], dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy) || 1;
    out += `<text x="${p.x + dx / d * 30}" y="${p.y + dy / d * 30 + 6}" text-anchor="middle" font-family="Bitter, Georgia, serif" font-weight="700" font-size="17" fill="${l === '?' ? '#b0401f' : '#2b2219'}">${l}</text>`;
  });
  if (q.square !== undefined) {
    const p = P[q.square], a = P[(q.square + 1) % 3], b = P[(q.square + 2) % 3], ua = norm(a.x - p.x, a.y - p.y), ub = norm(b.x - p.x, b.y - p.y), r = 13;
    out += `<path d="M${p.x + ua.x * r} ${p.y + ua.y * r} L${p.x + ua.x * r + ub.x * r} ${p.y + ua.y * r + ub.y * r} L${p.x + ub.x * r} ${p.y + ub.y * r}" fill="none" stroke="#2b2219" stroke-width="2"/>`;
  }
  return out + '</svg>';
}
const norm = (x, y) => { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; };
// a small picture that shows WHY: the three corners laid side by side make a straight line (180), or the squares on
// the sides of a right triangle
function helperPic(q) {
  if (q.helper.kind === 'angles') {
    const [a, b] = q.helper.shown, c = q.helper.answer, cx = 160, cy = 120, r = 90;
    const wedge = (from, to, col, label) => {
      const f = Math.PI - from * DEG, t = Math.PI - to * DEG, x1 = cx + Math.cos(f) * r, y1 = cy - Math.sin(f) * r, x2 = cx + Math.cos(t) * r, y2 = cy - Math.sin(t) * r;
      const m = (f + t) / 2, lx = cx + Math.cos(m) * r * 0.62, ly = cy - Math.sin(m) * r * 0.62 + 6;
      return `<path d="M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${col}" stroke="#2b2219" stroke-width="1.5"/><text x="${lx}" y="${ly}" text-anchor="middle" font-weight="700" font-size="15" font-family="Bitter, Georgia, serif">${label}°</text>`;
    };
    return `<svg class="pic" viewBox="0 0 320 140">${wedge(0, a, '#e9c98f', a)}${wedge(a, a + b, '#cfe0b0', b)}${wedge(a + b, 180, '#f0b9a3', c)}
      <line x1="40" y1="${cy}" x2="280" y2="${cy}" stroke="#2b2219" stroke-width="3"/><text x="160" y="138" text-anchor="middle" font-size="13" font-family="Bitter, Georgia, serif">the three corners together make a straight line: 180°</text></svg>`;
  }
  const { a, b, c } = q.helper, u = Math.min(20, 100 / c), mid = 120 - c * u / 2 + 6;
  const sq = (n, x, col) => { let g = `<rect x="${x}" y="${120 - n * u}" width="${n * u}" height="${n * u}" fill="${col}" stroke="#2b2219" stroke-width="1.5"/>`; for (let i = 1; i < n; i++) g += `<line x1="${x + i * u}" y1="${120 - n * u}" x2="${x + i * u}" y2="120" stroke="rgba(0,0,0,.15)"/><line x1="${x}" y1="${120 - i * u}" x2="${x + n * u}" y2="${120 - i * u}" stroke="rgba(0,0,0,.15)"/>`; return g + `<text x="${x + n * u / 2}" y="136" text-anchor="middle" font-weight="700" font-size="13" font-family="Bitter, Georgia, serif">${n}×${n}=${n * n}</text>`; };
  const x2 = 20 + a * u + 22, x3 = x2 + b * u + 34;
  return `<svg class="pic" viewBox="0 0 ${Math.max(320, x3 + c * u + 10)} 142">${sq(a, 20, '#e9c98f')}<text x="${20 + a * u + 11}" y="${mid}" text-anchor="middle" font-size="20" font-weight="700">+</text>${sq(b, x2, '#cfe0b0')}<text x="${x2 + b * u + 17}" y="${mid}" text-anchor="middle" font-size="20" font-weight="700">=</text>${sq(c, x3, '#f0b9a3')}</svg>`;
}

// ── the wind test ────────────────────────────────────────────────────────────────────────────────────────────────────
const COMPASS = { 'X1': 'from the west', 'X-1': 'from the east', 'Z1': 'from the north', 'Z-1': 'from the south' };
let test = null;      // { result, stands, i, t, case, sway, ... }
$('wind').onclick = () => startTest();
function startTest() {
  if (app.phase !== 'build') return;
  sound.audioOn();
  if (!towerHeight(app.tower)) { say('Put some boards up first! Corner posts make a good start.', { force: true, times: 99 }); return; }
  if (app.held) build.putBack();
  app.select(null);
  app.phase = 'test'; cam.azV = 0; ghosts = null; refreshGhosts();
  $('say').hidden = true; $('wind').hidden = true; el.selBar.hidden = true;
  $('stage-name').textContent = 'Here comes the wind'; $('stage-sub').textContent = 'from every side'; $('stage-bar').style.width = '0%'; $('stage').hidden = false;
  // (the calculation runs off the page's thread; the wind starts when it is done)
  const tower = app.tower;
  windWorker(tower, (result, stands) => { if (app.phase === 'test' && app.tower === tower && !test) runTest(result, stands); });
}
function runTest(result, stands) {
  test = { result, stands, i: 0, t: 0, crashing: false };
  cam.mode = 'test';
  // the watching spot: along one of the clear lines between the trees, as square on to the wind of the stage that
  // decides it as the lines allow (a tower that tips falls away downwind: side on, its fall shows long, not end on
  // as a heap), and of those the nearest to round the corner from the wall you were on
  // (and from the side where downwind is to the left of the screen, so a fall lands clear of the result card, which
  // sits on the right)
  const decide = result.failedAt >= 0 ? result.fail : result.stages[result.stages.length - 1].worst;
  const dX = decide && decide.axis === 'X' ? decide.sign : 0, dZ = decide && decide.axis === 'Z' ? decide.sign : 0;
  const side = dZ ? Math.PI / 2 : 0;      // (side on to wind along X: looking along Z)
  const wantAz = cam.az + 0.65, clear = [0.62, -0.55, 1.58, 2.78, -1.85, -0.2];
  const near = (a) => a + Math.round((wantAz - a) / (Math.PI * 2)) * Math.PI * 2;
  const score = (a) => (1 - Math.abs(Math.cos(a - side))) * 3 + Math.abs(near(a) - wantAz) * 0.15 + (dX * Math.cos(a) - dZ * Math.sin(a) > 0.3 ? 0.6 : 0);
  cam.testAz = near(clear.slice().sort((a, b) => score(a) - score(b))[0]);
  // the miller steps back upwind of the tower, out from under it, on the side nearer the watcher
  if (decide) {
    const r = app.tower.W / 2 * FT + 2.4, px = -dZ, pz = dX, toCam = Math.sign(px * Math.sin(cam.testAz) + pz * Math.cos(cam.testAz)) || 1;
    millerTarget = new THREE.Vector3(-dX * r + px * toCam * 1.6, 0, -dZ * r + pz * toCam * 1.6);
  }
  beginStage(0);
}
// the wind test's numbers, worked out by wind-worker.js (or right here if a worker can't start): done(result, stands)
let worker = null, workerBad = false, jobs = 0;
const waiting = new Map();
function windWorker(tower, done) {
  const here = () => { const result = windTest(tower); done(result, whatStands(tower, result)); };
  if (workerBad || typeof Worker === 'undefined') { setTimeout(here, 30); return; }
  try {
    if (!worker) {
      worker = new Worker(new URL('./wind-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => { const f = waiting.get(e.data.id); waiting.delete(e.data.id); if (f) f(e.data.result, e.data.stands); };
      worker.onerror = (e) => { if (e.preventDefault) e.preventDefault(); workerBad = true; const fs = [...waiting.values()]; waiting.clear(); fs.forEach((f) => f(null)); };
    }
    const id = ++jobs;
    waiting.set(id, (result, stands) => (result ? done(result, stands) : here()));
    worker.postMessage({ id, tower: JSON.parse(JSON.stringify(tower)) });
  } catch (err) { workerBad = true; setTimeout(here, 30); }
}
function caseOf(i) { const r = test.result; return i === r.failedAt ? r.fail : r.stages[i].worst; }
function beginStage(i) {
  test.i = i; test.t = 0;
  const st = STAGES[i], c = caseOf(i);
  test.case = c;
  wind.dir.set(c.axis === 'X' ? c.sign : 0, 0, c.axis === 'Z' ? c.sign : 0);
  $('stage-name').textContent = st.name; $('stage-sub').textContent = `${st.mph} mph ${COMPASS[c.axis + c.sign]}`;
  $('stage-bar').style.width = ((i + 1) / STAGES.length * 100) + '%';
  // the sway of each floor (feet, from the calculation), drawn larger so the eye can see it; and the top of a post
  // that stands with nothing holding it, which leans on its own
  const levels = (c.levels || [{ y: 0, ux: 0 }]).map((l) => ({ y: l.y, d: Math.abs(l.ux) }));
  for (const tp of c.tops || []) { const o = levels.find((l) => Math.abs(l.y - tp.y) < 0.4); if (o) o.d = Math.max(o.d, Math.abs(tp.ux)); else levels.push({ y: tp.y, d: Math.abs(tp.ux) }); }
  levels.sort((a, b) => a.y - b.y);
  test.profile = levels; test.topFt = Math.max(8, towerHeight(app.tower));
  // (a tower going over on its stones leans as one piece, more the higher up)
  test.tipping = i === test.result.failedAt && c.worst && c.worst.type === 'tip';
}
function swayAt(y, gain) {
  const L = test.profile; let d = 0;
  if (L.length) {
    if (y <= L[0].y) d = L[0].d * (L[0].y > 0 ? y / L[0].y : 1);
    else if (y >= L[L.length - 1].y) d = L[L.length - 1].d;
    else for (let i = 1; i < L.length; i++) if (y <= L[i].y) { const u = (y - L[i - 1].y) / Math.max(0.01, L[i].y - L[i - 1].y); d = L[i - 1].d + (L[i].d - L[i - 1].d) * u; break; }
  }
  if (test.tipping) d = Math.max(d, y * 0.004);
  // (however hard it is giving way, the lean drawn stays under about a metre at the top: more, and the frame would
  // be torn off its stones before it falls)
  const most = 1.0 * Math.max(0, y) / test.topFt;
  return new THREE.Vector3().copy(wind.dir).multiplyScalar(Math.min(most, Math.min(0.9, d * 7 * FT) * gain));
}
function stepTest(dt) {
  test.t += dt;
  const st = STAGES[test.i], failing = test.i === test.result.failedAt;
  const D = 2.6, t = test.t;
  // the gust's shape: rising, a few surges, easing off (a failing stage keeps rising)
  const env = failing ? Math.min(1, t / 0.9) : Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (D - t) / 0.6));
  const surge = 0.8 + 0.2 * Math.sin(t * 5.3) * Math.sin(t * 1.7 + 0.5);
  wind.level = (st.mph / 60) * env * surge;
  sound.setWind(wind.level);
  if (!test.crashing) {
    // past what it can hold: the lean grows until it lets go
    const extra = failing ? 1 + Math.max(0, t - 1.0) * Math.max(0, t - 1.0) * 14 : 1;
    const gain = env * surge * extra;
    towerView.setSway((y) => swayAt(y, gain));
    if (failing && t > 2.0) crash(gain);
    else if (!failing && t > D) {
      if (test.i + 1 < STAGES.length) beginStage(test.i + 1);
      else finishTest();
    }
  } else {
    const ev = fall.update(dt, wind.dir);
    soundEvents(ev);
    if (fall.settled() && !test.done) { test.done = true; setTimeout(finishTest, 400); }
  }
}
let lastCrack = 0, lastThud = 0;
function soundEvents(ev) {
  const now = performance.now();
  if (ev.pops && now - lastCrack > 70) { sound.crack(); lastCrack = now; }
  if (ev.hits && now - lastThud > 90) { sound.thud(ev.bigHit); lastThud = now; }
}
function crash(gain) {
  test.crashing = true;
  const fallen = new Set(worldBoards(app.tower).map((b) => b.key)), standing = new Set(worldBoards(test.stands.tower).map((b) => b.key));
  for (const k of standing) fallen.delete(k);
  const w = test.result.fail.worst, k = test.result.fail.face ?? 0;
  const breakAt = faceToWorld(app.tower.W, k, w.x ?? app.tower.W / 2, w.y || 0);
  const sway = (y) => swayAt(y, gain);
  towerView.setSway(null); towerView.nails.visible = false;
  fall.start({ tower: app.tower, view: towerView, falling: fallen, windDir: wind.dir.clone(), sway, breakAt });
  // the boards that stay up go back to standing straight
  sound.crash();
  gesture('HitRecieve', 1200);
}
function finishTest() {
  app.phase = 'result'; wind.level = 0.1; sound.setWind(0.1);
  $('stage').hidden = true;
  const r = test.result, h = test.stands.height, stood = r.failedAt < 0, W = app.tower.W;
  if (stood) towerView.setSway(null);
  const sacks = flourFor(h);
  const newBest = h > best.height;
  if (newBest) { best = { height: h, width: W }; try { localStorage.setItem('bm-windmill-best', JSON.stringify({ height: h, width: W, at: Date.now() })); } catch (e) { /* storage blocked: the record lasts this visit */ } }
  showBest();
  if (stood && h >= TARGET_FT) towerView.showHead(true, h, Math.atan2(camera.position.x, camera.position.z), W);   // (sails turned to face us)
  const st = r.failedAt >= 0 ? STAGES[r.failedAt] : null, c = r.fail;
  const title = stood ? (h >= TARGET_FT ? 'She stood! Sails up!' : 'She stood!') : h > 0 ? 'The top came down' : 'Down she came!';
  // (where it gave: the wall, and for a storey that folded, which storey of it)
  const fold = !stood && c.worst.type === 'sway' && !c.worst.free, place = stood ? '' : placeOf(c);
  const why = stood ? 'Through the breeze and every gust, from all four sides.'
    : `In the ${st.name.toLowerCase()} (${st.mph} mph ${COMPASS[c.axis + c.sign]}), ${fold ? `${place} ${/knee/.test(c.worst.text) ? 'leaned over: its knee braces could not hold it square' : 'racked: it folded over sideways'}`
      : c.worst.type === 'tip' || c.worst.free ? c.worst.text : `${c.worst.text}, on ${place}`}.`;
  const braced = fold ? bracesWhereItFolded(c) : null;
  const Place = place.charAt(0).toUpperCase() + place.slice(1);
  // a storey with no brace whose wall across was braced there: the crosspieces tied the two together, so that wall held
  // it up for a while
  const across = fold && !(braced && braced.length) ? ((c.face ?? 0) + 2) % 4 : -1;
  const heldUp = across >= 0 && bracesWhereItFolded({ ...c, face: across }).some((b) => b.closes);
  const Across = across >= 0 ? WALLS[across].charAt(0).toUpperCase() + WALLS[across].slice(1) : '';
  const advice = stood ? (h >= TARGET_FT ? 'Now that\'s a windmill. She\'ll grind flour all summer.' : `Good and stout. Reach ${TARGET_FT} feet and I'll put the sails on her.`)
    : c.worst.type === 'tip' ? (W >= MAX_W - 1e-6 ? 'She went over in one piece. The stones can\'t go any wider than 8 feet, so build her lower.'
      : 'Too narrow a base for her height: she went over in one piece. Set the stones wider, or build her lower.')
    : c.worst.free ? 'A post standing on its own just bends over in the wind. Tie the posts\' tops together with crosspieces, and brace every wall.'
    : braced && braced.length && !braced.some((b) => b.closes) ? `${Place} had a brace, but its end stopped short of the corner, so the square could still fold. Set a brace's ends right on the corners.`
    : braced && braced.length && !/knee/.test(c.worst.text) ? `${Place} had a brace, but still leaned too far. A second brace crossing the first, or a shorter bay, stiffens her.`
    : fold && !/knee/.test(c.worst.text) && heldUp ? `${Place} had no brace, so it folded. ${Across} held it up a while through the crosspieces, but every wall needs its own long brace corner to corner, near 45 degrees.`
    : fold && !/knee/.test(c.worst.text) ? `${Place} had no brace, so it folded. Every wall needs a long brace corner to corner in every storey, near 45 degrees.`
    : /knee/.test(c.worst.text) ? 'Knee braces help, but a long brace corner to corner holds better.'
    : /butt/.test(c.worst.text) ? 'Two boards end to end hardly hold. Nail a crosspiece or a brace over the joint.'
    : 'Something gave. Braces near 45 degrees spread the load best.';
  const card = $('result'); card.classList.add('is-side');
  card.innerHTML = `<h2>${title}</h2><p class="sub">${why}</p>
    <div class="stat"><div><small>Left standing</small><div class="big">${fmt(h)}</div></div><div><small>Base</small><div class="big">${fmt(W)}</div></div><div><small>Best</small><div class="big">${fmt(best.height)}</div></div></div>
    <div class="sacks">${SACK}<div><b>The miller pays ${sacks} sack${sacks === 1 ? '' : 's'} of flour</b><br><small>${newBest && h > 0 ? `A new best height, with the stones ${fmt(W)} apart!` : 'A sack for every foot left standing' + (h >= TARGET_FT ? ', and five more for the sails' : '')}</small></div></div>
    <p class="miller">"${advice}"</p>
    <div class="row">${stood ? '<button class="btn" id="r-fresh">Start fresh</button><button class="btn go" id="r-keep">Keep building</button>' : '<button class="btn go" id="r-again">Try again</button>'}</div>`;
  card.hidden = false;
  const again = $('r-again'), keep = $('r-keep'), fresh = $('r-fresh');
  if (again) again.onclick = () => { card.hidden = true; millerBeat(advice); };
  if (fresh) fresh.onclick = () => { card.hidden = true; millerBeat('Fresh lumber\'s on the sawhorses.'); };
  if (keep) keep.onclick = () => { card.hidden = true; backToBuild(); };
}
// the long braces (not knee braces) in the storey of the wall that leaned too far (between the full crosspieces below
// and above where it leaned: a brace whose top stops short of the crosspiece leaves the bit above it to fold), and
// whether each closes a triangle
function bracesWhereItFolded(c) {
  const segs = faceSegments(app.tower, c.face ?? 0), { lo, hi } = storeyOf(c), W = app.tower.W;
  return segs.filter((s) => !s.post && !isLevel(s) && !isUpright(s) && !isKnee(s, W) && Math.min(s.ay, s.by) < hi - 0.3 && Math.max(s.ay, s.by) > lo + 0.3)
    .map((s) => ({ s, closes: trianglesOf(segs, s.id).length > 0 }));
}
// the storeys of the wall that gave (floors: the ground and every crosspiece right across it) and the one where it
// leaned: { lo, hi, i, n }
function storeyOf(c) {
  const W = app.tower.W, segs = faceSegments(app.tower, c.face ?? 0), top = towerHeight(app.tower), y = c.worst.y || 0;
  const floors = [0];
  for (const s of segs) if (!s.post && isLevel(s) && Math.min(s.ax, s.bx) < 0.2 && Math.max(s.ax, s.bx) > W - 0.2) { const fy = (s.ay + s.by) / 2; if (!floors.some((f) => Math.abs(f - fy) < 0.3)) floors.push(fy); }
  floors.sort((a, b) => a - b);
  const under = floors.filter((f) => f < top - 0.5), i = Math.max(0, under.filter((f) => f <= y + 0.3).length - 1);
  return { lo: under[i] ?? 0, hi: floors.find((f) => f > (under[i] ?? 0) + 0.3) ?? top, i, n: under.length };
}
// where a failure was, in words: "the front wall", or "the top storey of the front wall"
const WALLS = ['the front wall', 'the right side', 'the back wall', 'the left side'];
function placeOf(c) {
  const wall = WALLS[c.face ?? 0];
  if (c.worst.type !== 'sway' || c.worst.free) return wall;
  const { i, n } = storeyOf(c);
  if (n < 2) return wall;
  const name = i === n - 1 ? 'top' : i === 0 ? 'bottom' : n === 3 ? 'middle' : ['second', 'third', 'fourth', 'fifth', 'sixth'][i - 1] || 'middle';
  return `the ${name} storey of ${wall}`;
}
function flourFor(h) { return Math.floor(h + 1e-6) + (h >= TARGET_FT ? 5 : 0); }
const SACK = '<svg viewBox="0 0 32 32"><path d="M9 6c2 2 12 2 14 0l-1 4c4 3 6 9 5 15-1 4-5 5-11 5S6 29 5 25c-1-6 1-12 5-15z" fill="#efe6d0" stroke="#7a5530" stroke-width="1.5"/><path d="M10 10c3 1 9 1 12 0" stroke="#7a5530" stroke-width="1.5" fill="none"/><text x="16" y="23" text-anchor="middle" font-size="7" font-family="Smokum, Georgia, serif" fill="#7a5530">FLOUR</text></svg>';

// after a crash (or for a fresh start): the camera turns to the miller for a moment, the yard is cleared behind the
// camera's back, and a fresh stack of lumber waits
function millerBeat(line) {
  app.phase = 'miller'; cam.mode = 'miller';
  $('say-text').textContent = line; $('say').hidden = false; clearTimeout(sayTimer);
  gesture('Wave', 2000) || gesture('Interact');
  setTimeout(() => {
    fall.clear(towerView);
    resetAll();
  }, 700);
  setTimeout(() => { $('say').hidden = true; backToBuild(); }, 1900);
}
function backToBuild() {
  app.phase = 'build'; cam.mode = 'face'; cam.az = Math.atan2(cam.pos.x, cam.pos.z); cam.azV = 0; towerView.showHead(false); towerView.setSway(null);
  $('wind').hidden = false; wind.level = 0.06; wind.dir.set(1, 0, 0.2).normalize(); test = null; app.dirty = true;
  walkMiller();
}
// a cleared yard and a fresh stack; the stones stay where they were set
function resetAll(w = app.tower.W) {
  app.tower = newTower(w); app.placed = []; app.held = null; app.selected = null; ghosts = null;
  world.setStones(w); cam.d = fitDistance();
  build.freshStack(BOARDS);
  cam.squareT = azOf(app.face) + Math.round((cam.az - azOf(app.face)) / (Math.PI * 2)) * Math.PI * 2; cam.yT = 4; cam.follow = true;
  showFaceName(); rebuild(); walkMiller(); sinceQuestion = 3;
}

// ── the miller walks round to stand by whichever wall you are building ──────────────────────────────────────────────
let millerTarget = null;
function millerSpot(k) {
  const n = FACE_NORMAL[k], t = [[1, 0], [0, -1], [-1, 0], [0, 1]][k], side = app.tower.W / 2 * FT + 1.4;
  return new THREE.Vector3(n[0] * 0.9 + t[0] * side, 0, n[1] * 0.9 + t[1] * side);
}
function walkMiller() { millerTarget = millerSpot(app.face); }
function updateMiller(dt) {
  if (!miller) return;
  const p = miller.root.position;
  if (millerTarget && p.distanceTo(millerTarget) > 0.08 && app.phase !== 'miller') {
    // round the tower (never through it): step along the circle toward the spot's angle
    const a0 = Math.atan2(p.x, p.z), a1 = Math.atan2(millerTarget.x, millerTarget.z), r0 = Math.hypot(p.x, p.z), r1 = Math.hypot(millerTarget.x, millerTarget.z);
    const da = angDiff(a1, a0), step = 1.4 * dt / Math.max(1, r0);
    const a = Math.abs(da) < step ? a1 : a0 + Math.sign(da) * step, r = r0 + Math.sign(r1 - r0) * Math.min(Math.abs(r1 - r0), 1.4 * dt);
    const nx = Math.sin(a) * r, nz = Math.cos(a) * r;
    miller.root.rotation.y = Math.atan2(nx - p.x, nz - p.z);
    p.set(nx, groundY(nx, nz), nz);
    if (!miller.walking) { miller.play('Walk', { fade: 0.2 }); miller.walking = true; }
    if (Math.abs(da) < 0.01 && Math.abs(r1 - r0) < 0.05) p.copy(millerTarget);
  } else {
    if (miller.walking) { miller.play('Idle', { fade: 0.3 }); miller.walking = false; }
    // face half toward the camera and half toward the tower
    const want = Math.atan2(camera.position.x - p.x, camera.position.z - p.z) * 0.5 + Math.atan2(-p.x, -p.z) * 0.5;
    miller.root.rotation.y += angDiff(want, miller.root.rotation.y) * Math.min(1, dt * 3);
  }
  miller.update(dt);
}

// ── the loop ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let frames = 0, fpsT = 0, fps = 0;
const perf = params.has('perf');
let ambient = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  if (app.phase === 'test' && test) stepTest(dt);
  else if (app.phase !== 'result') {
    // a light breeze while building, puffing now and then
    ambient += dt; wind.level = 0.07 + 0.05 * Math.max(0, Math.sin(ambient * 0.4)) ** 3;
    sound.setWind(wind.level);
  }
  if (app.phase === 'result' && fall.running) { const ev = fall.update(dt, wind.dir); soundEvents(ev); }
  // the twins fade away if left alone (their clock stands still while a question is open)
  if (ghosts && app.phase !== 'build') { if (ghosts.paused === undefined) ghosts.paused = performance.now() - ghosts.born; ghosts.born = performance.now() - ghosts.paused; }
  else if (ghosts) ghosts.paused = undefined;
  if (ghosts) {
    const age = performance.now() - ghosts.born, f = age < GHOST_STAY ? 1 : 1 - (age - GHOST_STAY) / GHOST_FADE;
    if (f <= 0) { ghosts = null; refreshGhosts(); } else towerView.fadeGhosts(f);
  }
  world.update(dt, cam.look, camera.position);
  updateCamera(dt);
  updateMiller(dt);
  towerView.update(dt, wind.level);
  if (app.held && app.phase === 'build') towerView.showHeld(app.tower.W, app.face, app.held.x, app.held.y, app.held.ang, app.held.len, postSide(app.held, app.tower.W) !== null);
  else towerView.showHeld(null);
  build.frame();
  $('face-name').hidden = app.phase !== 'build';
  // the sun's shadow box follows the camera's target
  world.sun.position.set(cam.look.x - 0.55 * 40, 0.62 * 40, cam.look.z + 0.56 * 40); world.sun.target.position.copy(cam.look); world.sun.target.position.y = 0;
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; if (perf) { $('perf').hidden = false; $('perf').textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} draws`; } }
}

// ── keys ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
addEventListener('keydown', (e) => {
  if (app.phase !== 'build') return;
  // (a quarter turn by the keys takes a board in hand round to the next wall with it)
  const quarter = (d) => {
    const base = cam.squareT ?? (azOf(app.face) + Math.round((cam.az - azOf(app.face)) / (Math.PI * 2)) * Math.PI * 2); cam.squareT = base + d * Math.PI / 2; cam.azV = 0;
    if (app.held) { app.face = ((Math.round(cam.squareT / (Math.PI / 2)) % 4) + 4) % 4; showFaceName(); walkMiller(); }
  };
  if (e.key === 'ArrowLeft') quarter(-1);
  else if (e.key === 'ArrowRight') quarter(1);
  else if (e.key === 'ArrowUp') { cam.yT = Math.min(topY(), cam.yT + 2); cam.follow = false; }
  else if (e.key === 'ArrowDown') { cam.yT = Math.max(3, cam.yT - 2); cam.follow = false; }
  else if (e.key === 'Escape') { if (app.held) build.putBack(); else app.select(null); }
  else if (e.key === 'Enter' && app.held) el.nailBtn.click();
  else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) $('undo').click();
  else if (e.key === 'r' || e.key === 'R') build.turnHeld();
});
addEventListener('pointerdown', () => sound.audioOn(), { capture: true });
// the sound control in the top bar: tap the speaker to mute, slide for volume
{
  const btn = $('mute'), vol = $('vol');
  const show = () => { const v = sound.getVolume(); btn.classList.toggle('is-muted', v.muted || v.volume === 0); btn.setAttribute('aria-pressed', String(v.muted)); vol.value = Math.round(v.volume * 100); };
  btn.onclick = () => { const v = sound.getVolume(); sound.setVolume(v.volume || 0.8, !v.muted); show(); };
  vol.oninput = () => { sound.setVolume(vol.value / 100, false); show(); };
  vol.addEventListener('keydown', (e) => e.stopPropagation());   // (arrow keys move the slider, not the camera)
  show();
}

// ── start ────────────────────────────────────────────────────────────────────────────────────────────────────────────
addEventListener('resize', resize);
resize();
build.freshStack(BOARDS);
world.setStones(app.tower.W);
showFaceName(); rebuild();
cam.az = 0; cam.pos.set(0, 4, cam.d + 6);
loop();
world.treeLoad.then(() => { $('loading').classList.add('is-done'); });
if (document.fonts) document.fonts.ready.then(placeFaceName);
setTimeout(() => $('loading').classList.add('is-done'), 6000);
makeMiller(scene).then((m) => {
  miller = m; miller.root.position.copy(millerSpot(0)); walkMiller();
  setTimeout(() => {
    if (!stonesOpen()) return;
    say('Howdy! First, the footing stones: drag one in or out. A wide base stands steadier once she\'s braced, but every crossbar and brace costs more wood.', { force: true, ms: 10000 });
    setTimeout(() => { if (stonesOpen() && !app.held) say('When the stones suit you, cut a board on the left and drag it up onto a corner.', { key: 'start2', times: 1, force: true, ms: 9000 }); }, 10500);
  }, 900);
});

// ── a handle for test scripts ────────────────────────────────────────────────────────────────────────────────────────
// WM.add(face, x, y, angleDegrees, length) nails a board as if dragged there (same snapping, same questions, same
// twins); WM.setWidth(w) sets the stones (only while nothing is built); WM.ghosts() lists the twins on show;
// WM.confirm(i) builds twin i as a tap would.
window.WM = {
  app, camera, renderer, scene, wind, cam, test: () => test, build, startTest, towerView, fall,
  add(face, x, y, angDeg, len) {
    if (app.face !== face) { app.face = face; cam.az = azOf(face) + Math.round((cam.az - azOf(face)) / (Math.PI * 2)) * Math.PI * 2; cam.squareT = null; showFaceName(); }
    app.held = { piece: { id: 'dev', len }, len, x, y, ang: angDeg * DEG }; app.nail();
  },
  setWidth: (w) => app.setWidth(w),
  ghosts: () => app.ghostList().map((g) => ({ kind: g.kind, face: g.face, corner: g.corner, x: g.x, y: g.y, ang: g.ang, len: g.len, ok: g.ok, reason: g.reason })),
  confirm: (i) => confirmGhost(app.ghostList()[i]),
  confirmAll,
  turnTo: (face) => { cam.squareT = azOf(face) + Math.round((cam.az - azOf(face)) / (Math.PI * 2)) * Math.PI * 2; },
  state: () => ({ phase: app.phase, face: app.face, W: app.tower.W, height: towerHeight(app.tower), boards: boardCount(app.tower), az: cam.az, camY: cam.y, zoom: cam.zoom, stonesOpen: stonesOpen(),
    full: build.fullCount(), lumber: { stack: app.lumber.stack, bench: app.lumber.bench && app.lumber.bench.len, pieces: app.lumber.pieces.map((p) => +p.len.toFixed(3)) },
    held: app.held && { x: app.held.x, y: app.held.y, ang: app.held.ang / DEG, len: app.held.len }, ghosts: app.ghostList().length, best, fps,
    question: !$('question').hidden ? $('question').innerText : null, result: !$('result').hidden ? $('result').innerText : null, falling: fall.sticks.length, hint: el.hint.textContent, nails: app.lastNails, say: $('say').hidden ? null : $('say-text').textContent }),
  toScreen: (k, x, y) => { const p = app.toScreen(k, x, y), r = el.view.getBoundingClientRect(); return { x: p.x + r.left, y: p.y + r.top }; },
  worldToScreen: (X, Y, Z) => { const p = app.worldToScreen(X, Y, Z), r = el.view.getBoundingClientRect(); return { x: p.x + r.left, y: p.y + r.top }; },
  resetAll, flourFor, STAGES,
};
