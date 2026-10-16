// THE WINDMILL TOWER LAB: build a windmill tower as high as a stack of lumber allows, then call the wind and see how
// much of it stands. A Bandit Math prototype page, standing on its own (it changes nothing in the game; it reads the
// game's fonts, ground textures, trees and townsfolk).
//
// How a round goes: first set the four footing stones (drag one in or out: the base, half a foot to 8 feet each way,
// W across the front and D along the sides; it locks when the first board is nailed). Cut boards on the left, drag the
// pieces up onto the tower, nail them. A piece lies on an upright plane over the stones: the kind facing you (parallel
// to the front wall from the front or back, to the sides from a side), on the nearest plane that already has a board
// within its reach, else on the outer wall facing you. Turn the view a quarter, so you see the board end on, and grab
// it again: now it moves in and out over the stones. That is how a tower narrows as it rises: a 6 × 4 base, beams laid
// across its top, a 2 × 3 tier standing on the beams, a 1 × 1 on top. While a board is held, green circles show every
// spot it will be nailed (a red ring: an end close to a board but not touching). Each board nailed shows its twins
// glowing round the tower (the same board mirrored on the opposite wall, and on a square base round the corners too;
// a post's twins on the other corners of its rectangle): a tap builds one with wood from the stack, a double tap builds
// them all; tapping a nailed board shows its twins again (their clock stops while a question is open). Drag anywhere
// else to walk round the tower and up and down it; the camera is yours whether or not a board is in hand. Now and then
// the miller asks about a triangle you just made, or how long a brace a bay needs; a right answer earns an extra board.
// Call the wind: a breeze, then growing gusts from every side. A frame calculation of the whole tower in 3D (frame.js)
// decides what holds: every board tinted green to red by its strain as each wind rises, the frame bending. When
// something gives, only what it held up falls, and the rest carries on through every gust to the end (testrun.js plays
// it). The miller pays flour for the height left standing after the big gust; then keep building on what stands (the
// boards that came down whole go back on the pile) or start fresh (the stones stay where they were set).
//
// Files: tower.js (the tower as data: boards in the world, planes), touch.js (where boards touch), frame.js (the
// physics: the wind test in 3D), wind-worker.js (runs it off the page's thread), testrun.js (the wind test as shown:
// the gusts, the strain colours, the falls, the card), questions.js (the math), build.js (the panel, placing, and every
// touch on the view), tower3d.js (drawing the boards, the held board and its plane, the twins, the strain), fall.js (what
// falls), scene.js (the hilltop, wind, the stones, the miller), sound.js.
//
// ?perf shows frames per second, ?askall asks at every chance.
// window.WM, a handle for test scripts (feet, the tower's middle at X = Z = 0, the front wall facing +Z):
//   WM.add(face, x, y, angDeg, len)    nail a board on an outer wall the v2 way (x from that wall's left corner seen from
//                                      outside), as if dragged there: same questions, same twins
//   WM.addOn(key, u, y, angDeg, len)   nail a board on any plane ('Z:1.5', 'X:-1'), its a end at (u, y) on it
//   WM.addWorld(a, b, n)               nail a board between two world points (on the plane they share; a post faces n,
//                                      or the plane kind facing the view). add, addOn and addWorld take their wood off
//                                      the pile like a twin (sawn as needed); with none left the board goes up anyway
//   WM.setBase(W, D), WM.setWidth(w)   the stones (only while nothing is built); WM.footprint() -> { W, D }
//   WM.boards() -> [{ id, a, b, len, n }], WM.planes() -> [{ key, name, boards }]
//   WM.ghosts() -> the twins on show [{ a, b, len, n, ok, reason }]; WM.confirm(i), WM.confirmAll()
//   WM.held() -> the board in hand { key, x, y, ang, len, endOn, a, b } and its spots on the screen (page pixels):
//                { ends: [A, B], mid, plane (its name) }
//   WM.planeToScreen(key, u, y), WM.worldToScreen(X, Y, Z), WM.toScreen(face, x, y) (v2 wall coordinates)
//   WM.turnTo(face), WM.state(), WM.resetAll(W, D), WM.startTest()
//   WM.load(tower)                     a whole tower { W, D, boards } put up at once on a fresh yard (its wood paid from
//                                      the pile, no questions)
//   WM.test() -> the wind test as it plays: { phase, gust, of, stage, from, breaks: [...], height, ms (the sums),
//                wallMs (the worker's answer, call to reply), card, shown: [[id, strain now]] } or null
import * as THREE from 'three';
import { START_W, MAX_W, BOARDS, BOARD_FT, newTower, FACE_NORMAL, towerHeight, boardCount, twinsOf, spotTaken, isPost, isCornerPost, planesOf, planeKey, parseKey,
  planeSegments, planeNormal, planeHalf, planeName, facePlane, faceOfPlane, fromPlane, toPlane, makeBoard, planesInUse, wallSpan, floorsAcross } from './tower.js';
import { isKnee, touch, touchesAny, grounded } from './touch.js';
import { STAGES } from './frame.js';
import { makeTestRun, flourFor } from './testrun.js';
import { trianglesOf, makeQuestion, bayQuestion } from './questions.js';
import { makeScene, makeMiller, wind, FT, groundY } from './scene.js';
import { makeTowerView, HELD_OFF } from './tower3d.js';
import { makeFall } from './fall.js';
import { makeBuild, fmt, fmtBase, fmtStat } from './build.js';
import * as sound from './sound.js';

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
let best = { height: 0, W: 0, D: 0 };
try { const b = JSON.parse(localStorage.getItem('bm-windmill-best') || '{}'); best = { height: +b.height || 0, W: +(b.W ?? b.width) || 0, D: +(b.D ?? b.width) || 0 }; } catch (e) { /* no storage: no record yet */ }

// ── the camera: walks round the tower (any angle), up and down it, zooms a little; round the side for the wind test ─
// az: the angle round the tower (0 looks at the front wall), y: the height it looks at (feet), pitch: how far it looks
// down (steeper while the stones are being set), zoom: 1 is the distance that fits the wall
// fit: how much further back the camera stands so a long held board fits a narrow view (1: not at all)
// (A board in hand never moves the camera: walking round, climbing and zooming all work while one is held.)
const cam = { az: 0, azV: 0, squareT: null, y: 4, yT: 4, stones: 1, zoom: 1, fit: 1, follow: true, mode: 'face', pos: new THREE.Vector3(0, 3, 14), look: new THREE.Vector3(0, 2, 0), d: 10 };
const azOf = (k) => Math.atan2(FACE_NORMAL[k][0], FACE_NORMAL[k][1]);
const ZOOM = [0.55, 1.6];
const wide = () => Math.max(app.tower.W, app.tower.D);
function fitDistance() {
  const r = el.view.getBoundingClientRect(), aspect = r.width / Math.max(1, r.height), t = Math.tan(camera.fov / 2 * DEG), W = wide();
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
const topY = () => Math.max(towerHeight(app.tower), app.held ? Math.max(app.held.y, app.held.y + Math.sin(app.held.ang) * app.held.len) : 0) + 12;
let orbiting = false;
function updateCamera(dt) {
  if (app.autoScroll) cam.yT = Math.max(3, Math.min(topY(), cam.yT + app.autoScroll * 10 * dt));
  // a flick keeps turning a moment
  if (!orbiting && Math.abs(cam.azV) > 0.01) { cam.az += cam.azV * dt; cam.azV *= Math.exp(-3.2 * dt); } else if (!orbiting) cam.azV = 0;
  if (cam.squareT !== null) { const d = angDiff(cam.squareT, cam.az); cam.az += d * Math.min(1, dt * 5); if (Math.abs(d) < 0.002) { cam.az = cam.squareT; cam.squareT = null; } }
  cam.y += (cam.yT - cam.y) * Math.min(1, dt * 6);
  // setting the stones: look down on the stones from higher up; building: level with the wall
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
    // the wind test: the tower fitted into the part of the view nothing covers (below the stage's name; beside the card
    // on a wide screen, above it on a phone), its foot at the bottom of that part and its top just under the top of it.
    // (testrun.js says what to frame: the tower as built while it stands; at the end, what is left and the boards round
    // it.) The camera stands about level with the tower's middle, never lower than a person's eyes; from there, the
    // distance at which the tower's height fills the band (the angle it covers shrinks as the camera backs off), or
    // further if its width needs it, then the view tipped down until the tower's foot sits at the band's foot.
    const fr = testRun.framing(camera.aspect < 0.6), H = fr.H * FT * 1.1, t = Math.tan(camera.fov / 2 * DEG), aspect = camera.aspect, f0 = freeBand();
    // (boards lying on the ground reach out toward the camera, below where the tower's foot is: the foot sits higher in
    // the band when there are boards down, more so when it is all down)
    const f = { ...f0, bot: f0.bot - (f0.bot - f0.top) * (fr.pile ? (fr.down ? 0.3 : 0.08) : 0) };
    const across = fr.across * FT + (aspect < 0.6 ? 1.2 : 3);
    const below = (s) => Math.atan((s - 0.5) * 2 * t);     // how far below the view's middle a spot on the screen is
    const want0 = below(f.bot) - below(f.top);
    const fit = (cy) => {
      const covers = (m) => Math.atan(cy / m) - Math.atan((cy - H) / m);
      let near = cy > H ? Math.sqrt(cy * (cy - H)) : 0.3, far = 400;
      for (let i = 0; i < 40; i++) { const m = (near + far) / 2; if (covers(m) > want0) near = m; else far = m; }
      return Math.max(far, across / (2 * t * aspect * (f.right - f.left)), 3);
    };
    // (boards lying flat all over the ground are seen from higher up, looking down on them, not edge on from the grass)
    let cy = Math.max(1.7, H * 0.5 + 1), d0 = fit(cy);
    if (fr.down) { cy = Math.max(cy, d0 * 0.45); d0 = fit(cy); }
    const d = d0 * Math.min(1.25, cam.zoom);
    const ly = cy - d * Math.tan(Math.atan(cy / d) - below(f.bot));
    // (and aside, so the tower sits in the band's middle: the camera's right is (cos a, 0, -sin a))
    const side = ((f.left + f.right) / 2 - 0.5) * 2 * d * t * aspect, a = cam.testAz, rx = Math.cos(a), rz = -Math.sin(a);
    const cx = fr.X * FT - rx * side, cz = fr.Z * FT - rz * side;
    look.set(cx, ly, cz); want.set(cx + Math.sin(a) * d, cy, cz + Math.cos(a) * d); rate = orbiting ? 12 : 2.2;
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
// the part of the view the wind test can use, as fractions of it (0 at the top or left): under the stats bar and the
// stage's name, and clear of the result card (beside it on a wide screen, above it on a phone). Measured a few times a
// second, not every frame.
let band = { top: 0.2, bot: 0.93, left: 0.04, right: 0.96 }, bandAt = 0;
function freeBand() {
  const now = performance.now(); if (now - bandAt < 200) return band;
  bandAt = now;
  const v = el.view.getBoundingClientRect(), H = v.height || 1, W = v.width || 1, b = { top: 0.06, bot: 0.93, left: 0.04, right: 0.96 };
  const below = (e) => { if (!e || e.hidden) return; const r = e.getBoundingClientRect(); if (r.height) b.top = Math.max(b.top, (r.bottom - v.top + 10) / H); };
  below(document.querySelector('.bar.top')); below($('stage'));
  const card = $('result');
  if (!card.hidden) {
    const c = card.getBoundingClientRect();
    // (a card across most of the view sits at the foot of it, on a phone; a narrower one stands at the side)
    if (c.width > W * 0.6) b.bot = Math.min(b.bot, (c.top - v.top - 8) / H);
    else b.right = Math.min(b.right, (c.left - v.left - 12) / W);
  }
  if (b.bot - b.top < 0.2) b.top = b.bot - 0.2;
  band = b;
  return b;
}
// the wall facing the camera most (it changes a little past the corner, so it doesn't flicker): a piece brought onto
// the tower lies in planes of its kind
function updateFace() {
  if (cam.mode !== 'face') return;
  const k = ((Math.round(cam.az / (Math.PI / 2)) % 4) + 4) % 4;
  if (k === app.face || Math.abs(angDiff(cam.az, azOf(k))) > Math.PI / 4 - 0.07) return;
  app.face = k; showFaceName(); walkMiller(); app.dirty = true;
}
// a drag on the view: sideways walks round, up and down climbs (the tower follows the finger)
// (a whole view's width turns the view about 200 degrees; a narrow view, a phone held upright, turns as if it were
// TURN_W pixels wide, so a finger's width of drag there is not a big swing: its 274 px turn about 120 degrees)
const TURN_W = 450;
const turnWidth = (r) => Math.max(r.width, TURN_W);
app.orbit = (dx, dy) => {
  const r = el.view.getBoundingClientRect();
  if (app.phase === 'build') {
    orbiting = true; cam.squareT = null; cam.azV = 0; app.orbited = true;
    cam.az -= dx / turnWidth(r) * Math.PI * 1.1;
    const ftPerPx = 2 * cam.d * cam.zoom * cam.fit * Math.tan(camera.fov / 2 * DEG) / FT / r.height;
    if (Math.abs(dy) > 0.5) { cam.yT = Math.max(3, Math.min(topY(), cam.yT + dy * ftPerPx)); cam.y = cam.yT; cam.follow = false; }
  } else if (cam.mode === 'test') { orbiting = true; cam.testAz -= dx / turnWidth(r) * Math.PI; }
};
// A flick keeps turning a moment. With a board in hand the builder turns the view a quarter to push it in and out, so a
// flick settles on the nearest quarter instead (the board seen face on or end on): the drag's own turn, plus at most
// about 35 degrees for the flick, rounded to the quarter. (A slow drag, held still before lifting, stays exactly where
// it was left.)
// (With nothing in hand, only a quick flick keeps turning: a finger lifted while still moving slowly, under FLICK pixels
// a millisecond, just stops, so a slow drag turns the view by exactly what the finger did.)
const FLICK = 0.25;
app.orbitRelease = (vx) => {
  orbiting = false;
  const r = el.view.getBoundingClientRect();
  if (app.phase !== 'build') return;
  if (Math.abs(vx) < FLICK && !app.held) vx = 0;
  const v = Math.max(-4, Math.min(4, -vx * 1000 / turnWidth(r) * Math.PI * 1.1));
  if (app.held && Math.abs(v) > 0.3) {
    const q = Math.PI / 2, aim = cam.az + Math.max(-0.6, Math.min(0.6, v / 3.2));
    cam.squareT = Math.round(aim / q) * q; cam.azV = 0;
  } else cam.azV = v;
};
Object.defineProperty(app, 'zoom', { get: () => cam.zoom });
app.viewAz = () => cam.az;
// a held board running off the sides of a narrow view (a phone): the camera backs off a little each frame until both
// ends are in sight (called only while no finger is moving it, so it never slides out from under one)
app.fitHeld = (A, B, r) => {
  const most = ZOOM[1] * 1.15 / cam.zoom, room = Math.min(A.x, B.x, r.width - A.x, r.width - B.x);
  if (room < 30 && cam.fit < most) cam.fit = Math.min(most, cam.fit * 1.025);
  else if (room > 60 && cam.fit > 1) cam.fit = Math.max(1, cam.fit / 1.01);     // (and closes in again once there is room)
};
app.setZoom = (z) => { cam.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], z)); };
app.onDragStart = () => {};
app.onTakeUp = () => { cam.follow = true; };

// planes and the screen: a point on a plane (feet) <-> the screen (pixels inside the view). The held board is drawn a
// layer out from its plane (HELD_OFF, tower3d.js), so its spots on the screen are too.
const v3 = new THREE.Vector3();
const project = (X, Y, Z) => { v3.set(X * FT, Y * FT, Z * FT).project(camera); const r = el.view.getBoundingClientRect(); return { x: (v3.x + 1) / 2 * r.width, y: (1 - v3.y) / 2 * r.height, behind: v3.z > 1 }; };
app.worldToScreen = (X, Y, Z) => project(X, Y, Z);
app.planeToScreen = (key, u, y, lifted = true) => {
  const p = fromPlane(key, u, y), [nx, nz] = planeNormal(key), o = lifted ? HELD_OFF : 0;
  return project(p.X + nx * o, p.Y, p.Z + nz * o);
};
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const aim = (cx, cy) => { const r = el.view.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
// the point on a plane under the pointer: in the world (feet), or in the plane's own (x = u, y)
app.toWorld = (key, cx, cy) => {
  aim(cx, cy);
  const { axis, off } = parseKey(key), N = axis === 'Z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(N, -off * FT), hit)) return null;
  return { X: hit.x / FT, Y: hit.y / FT, Z: hit.z / FT };
};
app.toPlane = (key, cx, cy) => { const w = app.toWorld(key, cx, cy); if (!w) return null; const q = toPlane(key, w); return { x: q.u, y: q.y }; };
// a point on the ground under the pointer (feet, the tower's middle at 0)
app.toGround = (cx, cy) => {
  aim(cx, cy); const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
  return { X: hit.x / FT, Z: hit.z / FT };
};
// the outer wall facing the view, and the plane a piece carried onto the tower lands on: of the kind facing the view
// (from the outer wall facing you in to the middle), the one whose boards come nearest the pointer (a board right under
// it: nearest of all; on a near tie, the plane nearer you), so long as one is within the piece's reach from where the
// pointer holds it; else the outer wall facing you
app.facingPlane = () => facePlane(app.tower, app.face);
app.pickPlane = (cx, cy, len) => {
  const t = app.tower, kind = app.face % 2 ? 'X' : 'Z', reach = Math.max(1.2, len / 2 + 0.3);
  const s = kind === 'Z' ? (Math.cos(cam.az) >= 0 ? 1 : -1) : (Math.sin(cam.az) >= 0 ? 1 : -1);
  const keys = planesInUse(t).filter((k) => k[0] === kind && parseKey(k).off * s >= -1e-6).sort((a, b) => parseKey(b).off * s - parseKey(a).off * s);
  aim(cx, cy);
  const under = new Set(); for (const hit of ray.intersectObjects(towerView.meshes(), false)) for (const k of planesOf(hit.object.userData.src)) under.add(k);
  let best = null;
  for (const k of keys) {
    const p = app.toPlane(k, cx, cy); if (!p) continue;
    const d = under.has(k) ? 0 : Math.min(...planeSegments(t, k).map((sg) => segDist(p, sg)));
    if (d <= reach && (!best || d < best.d - 0.3)) best = { k, d };
  }
  return best ? best.k : facePlane(t, app.face);
};
const segDist = (p, s) => { const vx = s.bx - s.ax, vy = s.by - s.ay, L2 = vx * vx + vy * vy || 1, u = Math.max(0, Math.min(1, ((p.x - s.ax) * vx + (p.y - s.ay) * vy) / L2)); return Math.hypot(s.ax + vx * u - p.x, s.ay + vy * u - p.y); };

// ── the walls: names ─────────────────────────────────────────────────────────────────────────────────────────────────
// (the chip under the stats names the wall facing you; while a board is held, the plane it is on)
const FACE_NAMES = ['Front wall', 'Right side', 'Back wall', 'Left side'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
let faceText = '';
function showFaceName() {
  const txt = app.held && app.phase === 'build' ? cap(planeName(app.tower, app.held.key, true)) : FACE_NAMES[app.face];
  if (txt !== faceText) { faceText = txt; $('face-name').textContent = txt; $('face-name').classList.toggle('is-held', !!app.held); }
}

// ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────────
const build = makeBuild(app);
app.onLumber = (n) => { world.setPile(n); if (ghosts) refreshGhosts(); };
// (a nailed board sawn off says so on its own bar, below; the miller's line is for the board in hand)
app.onSawOff = (len, kept, nailed) => { if (!nailed) say(kept ? `${fmt(len)} offcut. It's with your cut pieces.` : `That bit's too short to use. Kindling for my stove.`, { key: kept ? 'offcut' : 'kindling', times: 2, force: true, ms: 4000 }); };
app.onTowerChanged = (src, note) => {
  // (a board sawn shorter: its twins are worked out again from it, so they take the new length)
  if (src && ghosts && ghosts.src === src) ghosts.list = twinsOf(app.tower, src);
  rebuild();
  if (src && app.selected === src) app.select(src, note);
};

// ── the footing stones: the first step ──────────────────────────────────────────────────────────────────────────────
// They can be moved until the first board is nailed (and again once the tower is all taken down).
const stonesOpen = () => boardCount(app.tower) === 0;
app.stonesOpen = stonesOpen;
// (while a stone is being dragged the camera holds still, so the stone stays under the finger; it refits after)
app.setBase = (W, D = W, dragging = false) => {
  if (!stonesOpen()) return false;
  app.tower.W = W; app.tower.D = D; world.setStones(W, D); if (!dragging) cam.d = fitDistance(); sound.stone(Math.min(W, D)); ghosts = null; rebuild();
  return true;
};
app.onStonesSet = () => {
  const { W, D } = app.tower, n = Math.min(W, D), x = Math.max(W, D);
  cam.d = fitDistance();
  if (n <= 2) say(`${fmtBase(W, D)}: mighty narrow. Cheap on wood, but a tall narrow tower tips right over in a gust.`, { key: 'narrow', times: 3, force: true });
  else if (x >= 7) say(`${fmtBase(W, D)}: she'll stand steady, but every crossbar that way is a whole board, and corner to corner is longer than any board.`, { key: 'wide', times: 3, force: true });
  else if (Math.abs(W - D) > 0.01) say(`Stones ${fmtBase(W, D)}. She's narrower one way than the other: the wind from the side finds that. They'll stay put once the first board is nailed.`, { key: 'rect', times: 2, force: true });
  else say(`Stones ${fmtBase(W, D)}. They'll stay put once the first board is nailed.`, { key: 'stones', times: 4, force: true });
};

// ── nailing, picking up, undo ────────────────────────────────────────────────────────────────────────────────────────
let idN = 1;
// put a board on the tower: { a, b, len, n } in the world. Returns the record.
function addBoard(spec) {
  const rec = makeBoard('b' + idN++, spec.a, spec.b, spec.n, spec.len);
  app.tower.boards.push(rec); app.placed.push({ rec }); return rec;
}
app.nail = () => {
  const h = app.held; if (!h) return;
  const spec = build.worldOf(h), key = h.key;
  const first = stonesOpen();
  // a board touching at two places gets two nails (counted before it goes up, or it would find itself)
  const cs = build.contactsOf(h), nails = cs.length >= 2 ? 2 : 1;
  const rec = addBoard(spec);
  app.held = null; sound.hammer(nails); app.lastNails = nails;
  build.flash(cs);
  // its twins round the tower, glowing, a tap away
  makeGhosts(rec);
  rebuild();
  // keep the top of the work in view
  const top = Math.max(rec.a.Y, rec.b.Y);
  if (cam.follow && top > cam.yT + 4) cam.yT = top - 2;
  // square on to a wall, the twins on the other walls hide behind it or show only their edges: the very first time
  // twins glow, the view eases round a little toward a three-quarter look so they show (only when it was square on).
  // After that the view never moves by itself: the builder turns it a quarter at a time and has to know where it is.
  if (ghosts && ghosts.list.some((g) => g.ok) && !said.twinTurn) {
    const base = azOf(app.face) + Math.round((cam.az - azOf(app.face)) / (Math.PI * 2)) * Math.PI * 2, off = cam.az - base;
    if (Math.abs(off) < 0.12) { said.twinTurn = 1; cam.squareT = base + (off < -0.02 ? -1 : 1) * 0.46; cam.azV = 0; }
  }
  afterNail(rec, key, first);
};
// pick out a nailed board (or none): it lights up, its bar offers to take it down, and its twins that aren't built
// glow again. note: a word on the bar first (after a saw cut: how much came off, flashed so it is seen)
app.select = (src, note) => {
  const again = src && src === app.selected;
  app.selected = src; towerView.highlight(src);
  el.selBar.hidden = !src || app.phase !== 'build';
  if (!src) return;
  const inner = faceOfPlane(app.tower, planesOf(src)[0]) < 0 && !isCornerPost(app.tower, src);
  const what = (isCornerPost(app.tower, src) ? 'Corner post' : isPost(src) ? 'Post' : 'Board') + ', ' + fmt(src.len) + (inner ? ', ' + planeName(app.tower, planesOf(src)[0], true) : '');
  el.selHint.textContent = note ? `${note} · ${what}` : what; $('say').hidden = true;
  if (note) { el.selHint.classList.remove('is-sawn'); void el.selHint.offsetWidth; el.selHint.classList.add('is-sawn'); }
  if (!again && app.phase === 'build') showTwinsOf(src);
};
// the twins of a nailed board, shown again (when it is picked out), unless they are all built
function showTwinsOf(src) {
  if (ghosts && ghosts.src === src) { ghosts.born = performance.now(); return; }
  if (!app.tower.boards.includes(src)) return;
  const keep = ghosts;
  makeGhosts(src);
  refreshGhosts();
  if (!ghosts || !ghosts.list.length) { ghosts = keep; refreshGhosts(); }
}
// is this tap the second of a quick double tap on a twin just built? (then it builds all the rest, never a saw cut)
app.twinDoubleTap = (cx, cy) => performance.now() - lastTwinTap.t < 450 && Math.hypot(cx - lastTwinTap.x, cy - lastTwinTap.y) < 40 && !!lastTwinTap.g;
// a board (or twin) on the screen: its two ends in view pixels, and how far it is from the camera (metres)
function specOnScreen(g) {
  const A = app.worldToScreen(g.a.X, g.a.Y, g.a.Z), B = app.worldToScreen(g.b.X, g.b.Y, g.b.Z);
  const depth = camera.position.distanceTo(v3.set((g.a.X + g.b.X) / 2 * FT, (g.a.Y + g.b.Y) / 2 * FT, (g.a.Z + g.b.Z) / 2 * FT));
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
    let near = null, bd = TWIN_REACH;
    for (const g of ghosts.list) { const o = specOnScreen(g); if (o.behind) continue; const d = distToSeg(p, o.A, o.B); if (d < bd) { bd = d; near = { g, depth: o.depth }; } }
    // (with a nailed board under the finger as well, the twin wins when it stands in front of that board, or when the
    // tap is nearer the twin's line on screen than the board's own, or when that board is the one whose twins glow
    // (tapping it again would only pick it out), or when the tap is not squarely on the board's middle: on a 1 × 1 top
    // the short twins sit among the post tops, and a tap on a twin there lands on a post's end. So the board can still
    // be picked by tapping its middle squarely, and a twin peeking out beside it can still be built.)
    // (and a lit twin's own spots, its ends and its middle: a tap within a fingertip of one of them is for the twin,
    // whatever nailed board is under the finger. A twin seen end on is only a spot on the screen, sitting on whatever
    // stands in front of it, so this is the only way to reach it there.)
    if (near && b) {
      const on = screenOnBoard(b.object, p), src = b.object.userData.src;
      const squarely = on.d < 8 && on.t > 0.25 && on.t < 0.75;
      const o = specOnScreen(near.g), M = { x: (o.A.x + o.B.x) / 2, y: (o.A.y + o.B.y) / 2 };
      const spot = near.g.ok && Math.min(Math.hypot(p.x - o.A.x, p.y - o.A.y), Math.hypot(p.x - o.B.x, p.y - o.B.y), Math.hypot(p.x - M.x, p.y - M.y)) < TWIN_REACH;
      if (spot || near.depth < b.distance + 0.05 || bd < on.d - 1 || src === ghosts.src || !squarely) return { g: near.g };
    } else if (near) return { g: near.g };
  }
  return b ? { board: b.object.userData.src } : {};
}
// where a point on the screen is against a nailed board as drawn: { d (pixels from its line), t (0..1 along it) }
function screenOnBoard(mesh, p) {
  const rec = towerView.boards.get(mesh.userData.key); if (!rec) return { d: 0, t: 0.5 };
  const r = el.view.getBoundingClientRect(), S = (v) => { v3.copy(v).project(camera); return { x: (v3.x + 1) / 2 * r.width, y: (1 - v3.y) / 2 * r.height }; };
  const A = S(rec.a), B = S(rec.b), vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy || 1;
  return { d: distToSeg(p, A, B), t: Math.max(0, Math.min(1, ((p.x - A.x) * vx + (p.y - A.y) * vy) / L2)) };
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
    else say(gh.reason === 'no wood left' ? 'No wood left for that one. A right answer to my questions earns another board.' : 'That one would have nothing to nail to yet. Put up what it hangs on first.', { key: 'grey-' + gh.reason, times: 3, force: true, ms: 5000 });
    return;
  }
  if (!app.held) app.select(pick.board || null);
};
$('pickup').onclick = () => { if (app.phase === 'build' && app.selected) pickUp(app.selected); };
$('undo').onclick = () => { if (app.phase !== 'build') return; if (app.held) { build.putBack(); return; } const last = app.placed[app.placed.length - 1]; if (last) pickUp(last.rec); };
// take a board down (it goes back to the pile); anything left with nothing holding it up comes down too
function pickUp(src) {
  const t = app.tower, back = [];
  const drop = (rec) => {
    const i = t.boards.indexOf(rec); if (i >= 0) { t.boards.splice(i, 1); back.push(rec.len); }
    app.placed = app.placed.filter((p) => p.rec !== rec);
  };
  drop(src);
  // what still reaches the ground through its joints
  const reach = grounded(t.boards);
  t.boards.filter((b) => !reach.has(b)).forEach(drop);
  for (const len of back) build.returnPiece(len);
  // (the twins of a board that came down go with it)
  if (ghosts && !t.boards.includes(ghosts.src)) ghosts = null;
  sound.clatter(back[0] || 4, 'set'); app.select(null); rebuild();
}

function rebuild() {
  towerView.rebuild(app.tower); towerView.nails.visible = true; towerView.highlight(app.selected); towerView.showHead(false);
  $('height').innerHTML = fmtStat(towerHeight(app.tower));
  $('base').textContent = fmtBase(app.tower.W, app.tower.D, true);
  showBest();
  refreshGhosts();
  app.dirty = true;
}
function showBest() { $('best').innerHTML = fmtStat(best.height); $('best-base').textContent = best.height && best.W ? 'on ' + fmtBase(best.W, best.D || best.W, true) : ''; placeFaceName(); }
// the wall's name sits just under the stats box, however tall the box has grown (a best height adds a line to it)
function placeFaceName() {
  const v = el.view.getBoundingClientRect(), b = document.querySelector('.bar.top .stats').getBoundingClientRect();
  if (b.height) $('face-name').style.top = Math.round(b.bottom - v.top + 6) + 'px';
}

// ── the twins: glowing boards in the matching spots round the tower ────────────────────────────────────────────────
// Made when a board is nailed by hand (a new board's twins replace the last one's): its images under the base's own
// mirrors (tower.js twinsOf). Each is checked again whenever the tower or the lumber changes: built already (gone),
// nothing to nail it to any more or no wood for it (grey, with the reason). They fade away if left alone a while.
let ghosts = null;     // { src (the board nailed), list, born }
const GHOST_STAY = 16000, GHOST_FADE = 5000;
function makeGhosts(rec) { ghosts = { src: rec, list: twinsOf(app.tower, rec), born: performance.now() }; }
function refreshGhosts() {
  if (!ghosts) { towerView.setGhosts([]); return; }
  const t = app.tower;
  ghosts.list = ghosts.list.filter((g) => !spotTaken(t, g));
  for (const g of ghosts.list) {
    const holds = touchesAny(g, t.boards), wood = build.woodFor(g.len);
    g.ok = holds && !!wood; g.reason = !holds ? 'nothing to nail to' : !wood ? 'no wood left' : '';
  }
  if (!ghosts.list.length) ghosts = null;
  towerView.setGhosts(ghosts ? ghosts.list : []);
}
app.ghostList = () => (ghosts ? ghosts.list : []);
// build one twin: wood from the stack (a matching cut piece, else a fresh board sawn to length), hammered in
function confirmGhost(g, delay = 0) {
  if (!g || !g.ok || !ghosts) return false;
  const paid = build.payFor(g.len); if (!paid) { refreshGhosts(); return false; }
  // (wood for a twin comes from the cut piece that wastes least, which may be one sawn for something else: say so)
  if (paid.cut && paid.from < BOARD_FT - 0.01) say(`Sawed your ${fmt(paid.from)} piece down to ${fmt(g.len)} for that twin. The ${fmt(paid.from - g.len)} offcut is with your pieces.`, { key: 'twin-saw', times: 3, force: true, ms: 5000 });
  const rec = addBoard(g);
  const nails = isPost(g) ? 1 : 2;
  setTimeout(() => sound.hammer(nails), delay + (paid.cut ? 900 : 0));
  build.flash([rec.a, rec.b]);
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
    // can any of them be seen? (square on to a wall, the twin behind the board just nailed hides behind it. One seen
    // end on is only a dot, but it gets a bold ring (build.js), so it counts as seen.)
    const r = el.view.getBoundingClientRect(), src = specOnScreen(ghosts.src);
    const seen = ok.some((g) => {
      const o = specOnScreen(g), mx = (o.A.x + o.B.x) / 2, my = (o.A.y + o.B.y) / 2;
      if (o.behind || mx < 0 || mx > r.width || my < 50 || my > r.height) return false;
      return !(distToSeg(o.A, src.A, src.B) < 8 && distToSeg(o.B, src.A, src.B) < 8);
    });
    if (!seen) return `${ok.length === 1 ? 'Its twin glows' : `${ok.length} twins glow`} round the tower: drag sideways to walk round and tap them`;
    if ((said.twinsBuilt || 0) < 3) return 'Tap a glowing twin to build it · double-tap builds them all';
  }
  if (!app.orbited && boardCount(app.tower) > 0) return 'Drag to walk round the tower and climb it';
  return '';
};

let sinceQuestion = 3, questionsAsked = 0;
// after a board is nailed by hand: maybe a question about the plane it went on, maybe a word from the miller
function afterNail(rec, key, first) {
  const t = app.tower, post = isPost(rec), segs = planeSegments(t, key), me = segs.find((s) => s.src === rec);
  const n = app.placed.length, H = towerHeight(t), k = faceOfPlane(t, key);
  const forced = params.has('askall');
  sinceQuestion++;
  const chance = questionsAsked === 0 ? 0.7 : sinceQuestion >= 5 ? 0.9 : 0.35;
  const askNow = () => forced || (sinceQuestion >= 2 && Math.random() < chance);
  // a crosspiece that closes a bay: how long a brace would reach corner to corner?
  const bay = me && !post && isLevel(me) ? bayUnder(segs, me) : null;
  if (bay && askNow()) {
    const q = bayQuestion(bay.w, bay.h, bay.y0);
    if (q) { setTimeout(() => ask(q), 450); sinceQuestion = 0; questionsAsked++; return; }
  }
  // a question about a triangle this board just made on its plane?
  if (me && !post) {
    const tris = trianglesOf(segs, me.id);
    if (tris.length && askNow()) {
      const q = makeQuestion(tris, me);
      if (q) { setTimeout(() => ask(q), 450); sinceQuestion = 0; questionsAsked++; return; }
    }
  }
  // otherwise, maybe a word from the miller
  if (first) {
    say(post && isCornerPost(t, rec) ? 'Good: a post on the corner, straight up. See the glowing ones? Tap one to put the same post on that corner.' : post ? 'A post, straight up. Corner posts on the stones make the best start.' : 'Start with the corner posts, standing straight up. A post wants to be plumb, 90 degrees.', { force: true, ms: 9000 });
    return;
  }
  if (!me) return;
  if (post && k < 0 && !said.innerPost && Math.min(rec.a.Y, rec.b.Y) > 0.5) { said.innerPost = 1; say(`A post standing on ${planeName(t, key)}. Its foot is only toe-nailed: give it a brace or two.`, { key: 'innerpost', times: 1 }); return; }
  const a = angDeg(me), slant = !post && !isLevel(me) && !isUpright(me);
  // (a tier's floor is the beams crossing its walls: they close a triangle too)
  const tris = slant ? trianglesOf([...segs, ...floorsAcross(t, key)], me.id) : [];
  // a slanting board nailed to two posts, or one closing a triangle, is a brace however steep it is (on a narrow base
  // the corner-to-corner brace can't be any flatter), not a post that leans
  const posts = new Set(segs.filter((s) => s.post && touch(me, s).length).map((s) => s.ax));
  const isBrace = slant && (posts.size >= 2 || tris.length > 0);
  if (slant && a > 70 && a < 87 && !isBrace) { say('That one leans. A post wants to be plumb, 90 degrees, or the weight pushes it over.', { key: 'plumb' }); return; }
  if (bay) {
    const diag = Math.hypot(bay.w, bay.h);
    if (diag > BOARD_FT + 0.01) { say(`Corner to corner, that bay wants ${an(fmt(diag))} brace: longer than a board. Brace from a post up to the crosspiece, or make the bay shorter.`, { key: 'longbay', times: 2 }); return; }
  }
  if (slant) {
    // (the other outer walls with no brace yet, said a moment later)
    // (the other walls with no brace yet, said a moment later: the other outer walls, or for a brace in a tier, the
    // other walls of that tier: the planes round the posts standing at the same height as the ones it is nailed to)
    const others = () => {
      let bare;
      if (k >= 0) bare = [1, 2, 3].map((d) => (k + d) % 4).filter((f) => !hasDiagonal(planeSegments(app.tower, facePlane(app.tower, f))));
      else {
        const mine = segs.filter((sg) => sg.post && touch(me, sg).length).map((sg) => sg.src), foot = Math.min(...mine.map((p) => Math.min(p.a.Y, p.b.Y)));
        const tier = app.tower.boards.filter((p) => isPost(p) && Math.abs(Math.min(p.a.Y, p.b.Y) - foot) < 0.3);
        if (!mine.length || tier.length < 3) return;
        const xs = tier.map((p) => p.a.X), zs = tier.map((p) => p.a.Z);
        const walls = [planeKey('Z', Math.max(...zs)), planeKey('Z', Math.min(...zs)), planeKey('X', Math.max(...xs)), planeKey('X', Math.min(...xs))].filter((w, i, all) => w !== key && all.indexOf(w) === i);
        bare = walls.filter((w) => !hasDiagonal(planeSegments(app.tower, w).filter((sg) => Math.max(sg.ay, sg.by) > foot + 0.3)));
      }
      if (bare.length) setTimeout(() => { if (app.phase === 'build') say(k >= 0 ? 'Wind blows from every side. Every wall needs its own brace: tap the glowing twins.' : 'Wind blows from every side. Every wall of a tier needs its own brace too: tap the glowing twins.', { key: k >= 0 ? 'other' : 'other-tier' }); }, 5200);
    };
    // (the wall it braces: as wide as the posts either side of it at its height, so a tier's wall, not the whole plane)
    const WW = wallSpan(t, key, me);
    if (isKnee(me, WW)) { say('A knee brace helps some, but its nails take a beating in a big gust. A long brace corner to corner holds better.', { key: 'knee' }); return; }
    if (!tris.length) { say('That brace makes no triangle: an end stops short of the corner, so the square can still fold. Set its ends right on the corners.', { key: 'notri', times: 3, force: true }); return; }
    if (a > 60 && isBrace && WW < 4) { say('Steep, but on a wall this narrow that\'s as good as a brace gets.', { key: 'steepnarrow', times: 1 }); others(); return; }
    if (a < 30 || a > 60) { say(`That brace is at ${Math.round(a)} degrees. Brace it nearer 45 and she'll hold.`, { key: 'steep' }); return; }
    say('Brace it at 45 and she\'ll hold. A triangle can\'t fold.', { key: 'good45', times: 1 });
    others();
    return;
  }
  // a level board laid across the tower on an inner plane: a beam for the tier above
  if (!post && isLevel(me) && k < 0 && !said.beam) { said.beam = 1; say(`A beam across ${planeName(t, key)}. Stand the next tier's posts on beams like that one, and brace them.`, { key: 'beam', times: 1 }); return; }
  if (isLevel(me) && !hasDiagonal(segs) && segs.filter((s) => s.post).length >= 2) { say('A square with no brace folds over like a card table in the wind.', { key: 'card', times: 2 }); return; }
  if (H >= 16 && !said.h16) { said.h16 = 1; say('Sixteen feet! Taller than my mill roof.', { key: 'h16', force: true }); return; }
  if (n >= 3 && !app.orbited) { say('Drag the hillside to walk round the tower, and up and down to climb it.', { key: 'orbit', times: 1 }); return; }
  if (app.lumber.stack === 0 && !app.lumber.bench && app.lumber.pieces.length <= 1) say('That\'s the last of the lumber. Call the wind when you\'re ready.', { key: 'last', times: 1 });
}
// the bay a level board closes on its plane: posts at both its ends reaching down from it to a floor (the ground, a
// level board right across under it, or the beams the posts stand on). -> { y0, h, w } or null
function bayUnder(segs, me) {
  const y = (me.ay + me.by) / 2, lo = Math.min(me.ax, me.bx), hi = Math.max(me.ax, me.bx);
  // how far down a chain of posts at u reaches from y (each standing on the one below)
  const down = (u) => {
    let b = y;
    for (let guard = 0; guard < 20; guard++) {
      const p = segs.find((s) => s.post && Math.abs(s.ax - u) < 0.05 && Math.min(s.ay, s.by) < b - 0.05 && Math.max(s.ay, s.by) >= b - 0.05);
      if (!p) break; b = Math.min(p.ay, p.by);
    }
    return b;
  };
  const bl = down(lo), bh = down(hi);
  if (bl > y - 0.3 || bh > y - 0.3) return null;
  let y0 = Math.max(bl, bh);
  for (const s of segs) if (s !== me && !s.post && isLevel(s) && Math.min(s.ax, s.bx) < lo + 0.05 && Math.max(s.ax, s.bx) > hi - 0.05) { const sy = (s.ay + s.by) / 2; if (sy < y - 0.3 && sy > y0) y0 = sy; }
  return { y0, h: y - y0, w: hi - lo };
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

// ── the wind test (testrun.js plays it; frame.js, in wind-worker.js, works it out) ─────────────────────────────────
$('wind').onclick = () => startTest();
function startTest() {
  if (app.phase !== 'build') return;
  sound.audioOn();
  if (!towerHeight(app.tower)) { say('Put some boards up first! Corner posts make a good start.', { force: true, times: 99 }); return; }
  if (app.held) build.putBack();
  app.select(null);
  app.phase = 'test'; cam.azV = 0; ghosts = null; refreshGhosts();
  // (the test frames the whole tower: a zoom the builder pinched in to work on the top would cut the top off, so the
  // test starts from no zoom, a pinch during it still works, and the builder's zoom comes back with Keep building)
  cam.buildZoom = cam.zoom; cam.zoom = 1;
  $('say').hidden = true; $('wind').hidden = true; el.selBar.hidden = true;
  testRun.start();
}
const testRun = makeTestRun(app, {
  towerView, fall, say, gesture,
  viewAz: () => cam.az,
  // the watching spot: round the side, square on to the wind that decides it; the miller upwind, out from under it
  watch: ({ az, miller: m }) => { cam.mode = 'test'; cam.testAz = az; millerTarget = new THREE.Vector3(m.x, 0, m.z); },
  record: (h, W, D) => {
    const newBest = h > best.height;
    if (newBest) { best = { height: h, W, D }; try { localStorage.setItem('bm-windmill-best', JSON.stringify({ height: h, W, D, at: Date.now() })); } catch (e) { /* storage blocked: the record lasts this visit */ } }
    showBest();
    return { best, newBest };
  },
  // (the sails turned to face us)
  showHead: (standing) => towerView.showHead(true, standing, Math.atan2(camera.position.x, camera.position.z)),
  keep: keepBuilding,
  fresh: (line) => millerBeat(line),
});
// Keep building: what stood stays, the boards that came down whole go back on the pile (snapped ones are kindling)
function keepBuilding({ keep, back, kindling }) {
  const t = app.tower;
  t.boards = t.boards.filter((b) => keep.has(b.id));
  app.placed = app.placed.filter((p) => keep.has(p.rec.id));
  for (const len of back) build.returnPiece(len);
  backToBuild(); rebuild();
  if (back.length || kindling) say(`${back.length ? `${back.length === 1 ? 'The board' : `The ${back.length} boards`} that came down whole ${back.length === 1 ? 'is' : 'are'} back on your pile.` : ''}${kindling ? ` ${kindling === 1 ? 'The one' : kindling} that snapped went for kindling.` : ''} Build her up again!`.trim(), { force: true, times: 99, ms: 7000, key: 'keep' });
}

// after a crash (or for a fresh start): the camera turns to the miller for a moment, the yard is cleared behind the
// camera's back, and a fresh stack of lumber waits
function millerBeat(line) {
  app.phase = 'miller'; cam.mode = 'miller';
  $('say-text').textContent = line; $('say').hidden = false; clearTimeout(sayTimer);
  gesture('Wave', 2000) || gesture('Interact');
  setTimeout(() => {
    fall.clear();
    resetAll();
  }, 700);
  setTimeout(() => { $('say').hidden = true; backToBuild(); }, 1900);
}
function backToBuild() {
  app.phase = 'build'; cam.mode = 'face'; cam.az = Math.atan2(cam.pos.x, cam.pos.z); cam.azV = 0; towerView.showHead(false);
  if (cam.buildZoom) { cam.zoom = cam.buildZoom; cam.buildZoom = null; }
  towerView.setBend(null); towerView.setStrain(null); towerView.setSpots(null);
  $('wind').hidden = false; wind.level = 0.06; wind.dir.set(1, 0, 0.2).normalize(); app.dirty = true;
  walkMiller();
}
// a cleared yard and a fresh stack; the stones stay where they were set
function resetAll(W = app.tower.W, D = app.tower.D) {
  app.tower = newTower(W, D); app.placed = []; app.held = null; app.selected = null; ghosts = null;
  world.setStones(W, D); cam.d = fitDistance();
  build.freshStack(BOARDS);
  cam.squareT = azOf(app.face) + Math.round((cam.az - azOf(app.face)) / (Math.PI * 2)) * Math.PI * 2; cam.yT = 4; cam.follow = true;
  cam.zoom = 1; cam.buildZoom = null;     // (a fresh yard, a fresh look: the stones all in view again, even on a phone zoomed in earlier)
  showFaceName(); rebuild(); walkMiller(); sinceQuestion = 3;
}

// ── the miller walks round to stand by whichever wall you are building ──────────────────────────────────────────────
let millerTarget = null;
function millerSpot(k) {
  const n = FACE_NORMAL[k], t = [[1, 0], [0, -1], [-1, 0], [0, 1]][k], side = (k % 2 ? app.tower.D : app.tower.W) / 2 * FT + 1.4;
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
  // the wind test plays its gusts (and what falls keeps falling, through the card too)
  testRun.frame(dt);
  if (!testRun.running && app.phase !== 'result') {
    // a light breeze while building, puffing now and then
    ambient += dt; wind.level = 0.07 + 0.05 * Math.max(0, Math.sin(ambient * 0.4)) ** 3;
    sound.setWind(wind.level);
  }
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
  build.frame();
  // the board in hand (its ends glowing green where they touch) and its plane, drawn faintly over the stones
  const h = app.held && app.phase === 'build' ? app.held : null, hi = build.heldInfo;
  if (h) {
    const w = build.worldOf(h);
    towerView.showHeld({ ...w, key: h.key, glowA: !!(hi && hi.glowA), glowB: !!(hi && hi.glowB) });
    towerView.showPlane({ key: h.key, half: planeHalf(app.tower, h.key), top: Math.max(towerHeight(app.tower), w.a.Y, w.b.Y) + 1, endOn: !!h.endOn });
  } else { towerView.showHeld(null); towerView.showPlane(null); }
  showFaceName();
  $('face-name').hidden = app.phase !== 'build';
  // the sun's shadow box follows the camera's target
  world.sun.position.set(cam.look.x - 0.55 * 40, 0.62 * 40, cam.look.z + 0.56 * 40); world.sun.target.position.copy(cam.look); world.sun.target.position.y = 0;
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; if (perf) { $('perf').hidden = false; $('perf').textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} draws`; } }
}

// ── keys ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
addEventListener('keydown', (e) => {
  if (app.phase !== 'build') return;
  // (a quarter turn by the keys turns the view; a board in hand stays where it is)
  const quarter = (d) => { const base = cam.squareT ?? (azOf(app.face) + Math.round((cam.az - azOf(app.face)) / (Math.PI * 2)) * Math.PI * 2); cam.squareT = base + d * Math.PI / 2; cam.azV = 0; };
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
world.setStones(app.tower.W, app.tower.D);
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
    say('Howdy! First, the footing stones: drag one in or out, either way. A wide base stands steadier once she\'s braced, but every crossbar and brace costs more wood.', { force: true, ms: 10000 });
    setTimeout(() => { if (stonesOpen() && !app.held) say('When the stones suit you, cut a board on the left and drag it up onto a corner.', { key: 'start2', times: 1, force: true, ms: 9000 }); }, 10500);
  }, 900);
});

// ── a handle for test scripts (see the top of this file) ─────────────────────────────────────────────────────────────
const toPage = (p) => { const r = el.view.getBoundingClientRect(); return { x: p.x + r.left, y: p.y + r.top, behind: p.behind }; };
// (the wood comes off the pile, sawn as needed, as a twin's does, so Undo puts back only what was taken; with no wood
// left for it the board is nailed anyway: a rig's board)
function nailOn(key, u, y, ang, len) {
  build.payFor(len);
  app.held = { piece: { id: 'dev', len }, len, key, x: u, y, ang, endOn: false }; app.nail();
}
window.WM = {
  app, camera, renderer, scene, wind, cam, test: () => testRun.state(), build, startTest, towerView, fall,
  // a board on an outer wall in the v2 wall coordinates (x from the wall's left corner seen from outside)
  add(face, x, y, angDeg, len) {
    if (app.face !== face) { app.face = face; cam.az = azOf(face) + Math.round((cam.az - azOf(face)) / (Math.PI * 2)) * Math.PI * 2; cam.squareT = null; showFaceName(); }
    const half = face % 2 ? app.tower.D / 2 : app.tower.W / 2, back = face >= 2;
    nailOn(facePlane(app.tower, face), back ? half - x : x - half, y, (back ? 180 - angDeg : angDeg) * DEG, len);
  },
  addOn: (key, u, y, angDeg, len) => nailOn(key, u, y, angDeg * DEG, len),
  addWorld(a, b, n) {
    const post = Math.abs(a.X - b.X) < 1e-6 && Math.abs(a.Z - b.Z) < 1e-6, kind = n || (app.face % 2 ? 'X' : 'Z');
    const key = post ? planeKey(kind, kind === 'X' ? a.X : a.Z) : Math.abs(a.Z - b.Z) < 1e-6 ? planeKey('Z', a.Z) : planeKey('X', a.X);
    const A = toPlane(key, a), B = toPlane(key, b);
    nailOn(key, A.u, A.y, Math.atan2(B.y - A.y, B.u - A.u), Math.hypot(B.u - A.u, B.y - A.y));
  },
  // a whole tower at once, on a fresh yard: its wood comes off the pile (sawn as needed), no questions, no twins
  load(t) {
    resetAll(t.W, t.D ?? t.W);
    for (const b of t.boards) { build.payFor(b.len); addBoard({ a: b.a, b: b.b, n: b.n, len: b.len }); }
    rebuild();
    return app.tower.boards.length;
  },
  setBase: (W, D) => app.setBase(W, D),
  setWidth: (w) => app.setBase(w, w),
  footprint: () => ({ W: app.tower.W, D: app.tower.D }),
  boards: () => JSON.parse(JSON.stringify(app.tower.boards)),
  planes: () => planesInUse(app.tower).map((key) => ({ key, name: planeName(app.tower, key), boards: planeSegments(app.tower, key).length })),
  ghosts: () => app.ghostList().map((g) => ({ a: g.a, b: g.b, len: g.len, n: g.n, ok: g.ok, reason: g.reason })),
  confirm: (i) => confirmGhost(app.ghostList()[i]),
  confirmAll,
  held: () => {
    const h = app.held; if (!h) return null;
    const w = build.worldOf(h), e = { ax: h.x, ay: h.y, bx: h.x + Math.cos(h.ang) * h.len, by: h.y + Math.sin(h.ang) * h.len }, post = Math.abs(Math.cos(h.ang)) < 1e-6;
    return { key: h.key, x: h.x, y: h.y, ang: h.ang / DEG, len: h.len, endOn: !!h.endOn, a: w.a, b: w.b, plane: planeName(app.tower, h.key),
      ends: [toPage(app.planeToScreen(h.key, e.ax, e.ay, !post)), toPage(app.planeToScreen(h.key, e.bx, e.by, !post))],
      mid: toPage(app.planeToScreen(h.key, (e.ax + e.bx) / 2, (e.ay + e.by) / 2, !post)) };
  },
  turnTo: (face) => { cam.squareT = azOf(face) + Math.round((cam.az - azOf(face)) / (Math.PI * 2)) * Math.PI * 2; },
  state: () => ({ phase: app.phase, face: app.face, W: app.tower.W, D: app.tower.D, height: towerHeight(app.tower), boards: boardCount(app.tower), az: cam.az, camY: cam.y, zoom: cam.zoom, stonesOpen: stonesOpen(),
    full: build.fullCount(), lumber: { stack: app.lumber.stack, bench: app.lumber.bench && app.lumber.bench.len, pieces: app.lumber.pieces.map((p) => +p.len.toFixed(3)) },
    pile: build.groups().map((g) => [g.len, g.list.length]), panel: { bench: el.benchLabel.textContent, groups: [...el.pieces.children].map((d) => d.textContent) },
    held: app.held && { key: app.held.key, x: app.held.x, y: app.held.y, ang: app.held.ang / DEG, len: app.held.len, endOn: !!app.held.endOn }, plane: build.planeText, ghosts: app.ghostList().length, best, fps,
    question: !$('question').hidden ? $('question').innerText : null, result: !$('result').hidden ? $('result').innerText : null, falling: fall.sticks.length, hint: el.hint.textContent, nails: app.lastNails, say: $('say').hidden ? null : $('say-text').textContent,
    faceName: $('face-name').textContent }),
  toScreen: (k, x, y) => { const half = k % 2 ? app.tower.D / 2 : app.tower.W / 2; return toPage(app.planeToScreen(facePlane(app.tower, k), k >= 2 ? half - x : x - half, y, false)); },
  planeToScreen: (key, u, y) => toPage(app.planeToScreen(key, u, y, false)),
  worldToScreen: (X, Y, Z) => toPage(app.worldToScreen(X, Y, Z)),
  resetAll, flourFor, STAGES,
};
