// THE WINDMILL TOWER BUILDER: build a windmill tower as high as a stack of lumber allows, then call the wind and see how
// much of it stands. Everything the builder is (the lumber panel, the board in hand and its arrows, the twins, the
// miller and his questions, the wind test) mounted on a page by its HOST, which owns the renderer, the camera's lens and
// the frame loop:
//   * the lab page (main.js): its own hilltop scene, the whole window, the lab's own question ladder in localStorage
//   * the game (src/windmilljob.js through src/buildsite.js): at the mill hill in the valley, the game's canvas and
//     camera, the questions through the skill model's geometry strand (src/math/skill.js), the tower saved per rider
// It changes nothing in the game's files; it reads the game's fonts, ground textures, trees and townsfolk.
//
//
// How a round goes: first set the four footing stones (drag one in or out: the base, half a foot to 8 feet each way,
// W across the front and D along the sides; it locks when the first board is nailed). Cut boards on the left, drag the
// pieces up onto the tower, nail them. There are no walls: every board is free. A piece dragged onto the view puts its
// first end in a SOCKET (a spot on the half foot: on the ground within the stones, or along a board at half-foot steps
// from its ends) and stands straight up; then drag its free end, or tap the four arrows (half a foot across or along
// the ground, its height following from its length), until it reaches another board: it connects there (its free end
// turns green). A board too long sticks out past the joint; after ✓ it can be sawn off there (the extra back on the
// pile, rounded down to the half foot). Each board nailed shows its twins glowing round the tower (the same board
// mirrored front to back and side to side, and on a square base turned round the corners): a tap builds one with wood
// from the stack, a double tap builds them all; tapping a nailed board shows its twins again (their clock stops while
// a question is open). Drag anywhere else to walk round the tower and up and down it, pinch or roll the wheel to come
// nearer or back off; the camera always looks at the tower's middle, 25 degrees down, and while building moves only
// when you move it. Now and then the miller asks a geometry question (questions.js: a ladder of steps from naming an
// angle up to right triangles, climbing after two right in a row, dropping a step after a wrong answer, remembered in
// localStorage); when the board just nailed fits the step he asks about it instead. He asks at a hand-nailed board
// once two hand nails and three boards in all (twins too) have gone up since the last question (questionDue: some 8
// over a whole tower). A right answer earns a spare board, at most BONUS_MAX (6) for a tower, never mentioned on the
// card: past it a right answer just gets praise. Start fresh resets the count, Keep building and Undo don't. Every
// card has "Teach me" (teach.js): the idea on a worked example, then "Try it", a fresh one of the same kind.
// Call the wind: the camera frames the whole tower (smoothly, once), then a breeze, then growing gusts from every side.
// A frame calculation of the whole tower in 3D (frame.js) decides what holds: every board tinted green to red by its
// strain as each wind rises, the frame bending. When something gives, only what it held up falls, and the rest carries
// on through every gust to the end (testrun.js plays it). The miller pays flour for the height left standing after the
// big gust; then keep building on what stands (the boards that came down whole go back on the pile) or start fresh
// (the stones stay where they were set).
//
// Files: tower.js (the tower as data: boards in the world, sockets, the free end, twins, words), touch.js (where boards
// touch), frame.js (the physics: the wind test in 3D), wind-worker.js (runs it off the page's thread), testrun.js (the
// wind test as shown: the gusts, the strain colours, the falls, the card), questions.js (the math), build.js (the
// panel, placing, and every touch on the view), tower3d.js (drawing the boards, the held board, the twins, the strain),
// fall.js (what falls), scene.js (the hilltop, wind, the stones, the miller), sound.js.
//
//
//   const B = mountWindmill(host)       puts MARKUP into host.root and starts; host:
//     root            the element the builder's page goes in (its #app: the lumber panel and the view)
//     scene           the THREE.Object3D its things are added to (the lab: the scene; the game: a group at the site)
//     origin          THREE.Vector3: where the tower's middle is in the scene's world (metres; the lab: 0, 0, 0). The
//                     site's frame is never turned: the front of the tower faces +Z wherever it stands
//     camera          the THREE.PerspectiveCamera the builder points (its position, where it looks, its fov)
//     fit(r)          the view's rectangle (page pixels) changed: the host sets the camera's aspect (and any view
//                     offset) so the picture fills it, and sizes its renderer if it owns one
//     canvasRect()    the page rectangle the camera's picture covers (the lab: the view itself; the game: its canvas)
//     yard            { setPile(n), setStones(W, D), update(dt, look, eye) } the lumber pile and the footing stones
//                     (scene.js makeScene or makeYard), and the per-frame wind dressing (look, eye: world metres)
//     groundY(x, z)   the ground's height in the site's frame (metres, x and z from the tower's middle)
//     asker           the miller's questions: { level() (the step to ask at now, 1 to LADDER_TOP), asked(q) (a card
//                     is up: start a timer), answered(q, right) -> the step after, state() (for rigs) }.
//                     ladderAsker() below is the lab's own (localStorage); the game passes the skill model's
//     best            { read() -> { height, W, D }, write({ height, W, D }) } the best tower that stood
//     start           optional { tower, lumber } to begin with instead of a fresh yard (a rider's tower saved earlier)
//     escape()        optional: Esc with nothing in hand and nothing picked out (the game: leave the site)
//     miller(scene), dropMiller(person)   optional: the host lends its own miller (a person already standing at the
//                     site, put in `scene` at his spot in the site's frame; he walks round from there) and takes him
//                     back when the builder goes (the lab's own: scene.js makeMiller, made here and removed)
//     changed(what)   optional: the tower or the lumber changed ('nail', 'take', 'test', ...): the game saves then
//     speak(text)     optional: read a question out loud (the game: for a rider who can't read yet)
//     sound           optional: { ready(fn) } the host's own sound: fn(ctx, out) once it is awake (sound.js attach: no
//                     context of the lab's own, the host's volume rules and the top bar's volume is hidden)
//     low             a phone or a low tier: smaller shadows, fewer specks
//   B.frame(dt)       each frame, before the host draws: the camera, the wind test, the miller, the board in hand
//   B.resize()        the view's size changed;  B.dispose() takes everything off the page and out of the scene
//   B.app, B.cam (the camera's state: az, y, dist, look, pos), B.handle (the WM handle below), B.snapshot() ->
//     { tower, lumber, best } to save, B.busy() (a question, the wind test or a board in hand is up), B.settle() (about
//     to be put away: a result card's own button done quietly, so the saved tower is what stood), B.phase
//   host.pay(h, { W, D, standing, newBest }) -> { sacks, line }   optional: the host pays the flour its own way (the
//     game's miller pays only for new height; the card says what was paid); else a sack for every foot left standing
//
// ?perf shows frames per second, ?askall asks at every chance.
// B.handle (window.WM on the lab page), a handle for test scripts (feet, the tower's middle at X = Z = 0, the front
// facing +Z):
//   WM.addWorld(a, b, len)             nail a board between two world points (len: its length, else from its ends),
//                                      as if put up by hand: same questions, same twins; its wood comes off the pile
//                                      like a twin's (sawn as needed); with none left the board goes up anyway
//   WM.setBase(W, D), WM.setWidth(w)   the stones (only while nothing is built); WM.footprint() -> { W, D }
//   WM.boards() -> [{ id, a, b, len }]; WM.question() -> the question on the card { answer, kind, topic, level, choices, teach }
//                or null; WM.ask(topic) asks a fresh question of a topic (questions.js TOPICS) now
//   WM.ghosts() -> the twins on show [{ a, b, len, ok, reason }]; WM.confirm(i), WM.confirmAll()
//   WM.held() -> the board in hand { A (its socket), B (its free end), len, con ({ s, P, past } or null), ends: [A, B]
//                on the screen (page pixels), handles: { socket, free } and arrows: [+X, -X, +Z, -Z] (page pixels of
//                their hit spots) } or null
//   WM.sockets() -> every socket [{ X, Y, Z, on }] and WM.socketScreen(p) its spot on the screen
//   WM.worldToScreen(X, Y, Z), WM.turnTo(face), WM.setAz(az), WM.state(), WM.resetAll(W, D), WM.startTest()
//   WM.load(tower)                     a whole tower { W, D, boards } put up at once on a fresh yard (its wood paid from
//                                      the pile, no questions; an older tower's n and t are dropped)
//   WM.test() -> the wind test as it plays: { phase, gust, of, stage, from, breaks: [...], height, ms (the sums),
//                wallMs (the worker's answer, call to reply), card, shown: [[id, strain now]] } or null
//   WM.result() -> the wind test's whole answer as the page got it (frame.js windTest, from the worker), or null: a rig
//                compares it with node's windTest on WM.boards()
import * as THREE from 'three';
import { START_W, MAX_W, BOARDS, BOARD_FT, newTower, cleanTower, FACE_NORMAL, towerHeight, boardCount, twinsOf, spotTaken, isPost, isCornerPost, makeBoard, spellUnits,
  placeWords, nounOf, sideOfBoard, atSide, isLevelB, isUprightB } from './tower.js';
import { touch3, touchesAny, grounded, pointGap, TOL } from './touch.js';
import { STAGES, boardShapes, faceOf } from './frame.js';
import { makeTestRun, flourFor } from './testrun.js';
import { trianglesOf, makeQuestion, bayQuestion, reachQuestion, ladderQuestion, questionOf, topicOf, questionDue, stepLadder, readLadder, LADDER_KEY, LADDER_TOP, BONUS_MAX, earnsBoard } from './questions.js';
import { showTeach } from './teach.js';
import { makeMiller, wind, FT } from './scene.js';
import { makeTowerView, HELD_OFF } from './tower3d.js';
import { makeFall } from './fall.js';
import { makeBuild, fmt, fmtWords, fmtBase, fmtStat, whereWords } from './build.js';
import * as sound from './sound.js';

// the builder's page: the lumber panel on the left, the view on the right (its canvas is the lab's own; in the game
// the canvas is hidden and the game's own shows through the view)
export const MARKUP = `
  <aside id="panel" aria-label="Lumber">
    <header class="pn-head">
      <h1>Lumber</h1>
      <div class="pn-count"><b id="count">28</b> <span id="count-word">full boards left</span></div>
    </header>
    <div class="bench-wrap">
      <div class="bench-label" id="bench-label">8 ft board ×28</div>
      <div class="bench" id="bench">
        <div class="tape" id="tape"></div>
        <div class="board-v" id="bench-board" title="Drag the whole board onto the tower, or pick a spot and cut it">
          <div class="saw" id="saw"><i></i><span id="saw-label">4 ft | 4 ft</span></div>
        </div>
      </div>
      <div class="bench-empty" id="bench-empty" hidden>No full boards left</div>
    </div>
    <button class="btn cut" id="cut">Cut</button>
    <button class="btn up-next" id="up-next" hidden title="The board on the bench goes up where you left off">Put it up</button>
    <div class="pieces-head">Cut pieces</div>
    <div class="pieces" id="pieces"></div>
    <div class="pieces-empty" id="pieces-empty">Cut pieces wait here. Drag one onto the tower.</div>
  </aside>
  <main id="view">
    <canvas id="c" aria-label="The hilltop and the tower"></canvas>
    <svg id="overlay"></svg>
    <div class="gz end sock" id="g-a" hidden title="Drag the foot to another spot"></div>
    <div class="gz end free" id="g-b" hidden title="Drag the free end onto a board"></div>
    <div class="gz arrow" id="g-xp" hidden title="Free end half a foot right (+X)"></div>
    <div class="gz arrow" id="g-xm" hidden title="Free end half a foot left (−X)"></div>
    <div class="gz arrow" id="g-zp" hidden title="Free end half a foot to the front (+Z)"></div>
    <div class="gz arrow" id="g-zm" hidden title="Free end half a foot to the back (−Z)"></div>
    <button class="nail-it" id="nail" hidden aria-label="Nail it" title="Nail it (Enter)"><svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 7"/></svg></button>
    <div class="gz stone" id="stone-0" hidden title="Drag the stone in or out"></div>
    <div class="gz stone" id="stone-1" hidden title="Drag the stone in or out"></div>
    <div class="gz stone" id="stone-2" hidden title="Drag the stone in or out"></div>
    <div class="gz stone" id="stone-3" hidden title="Drag the stone in or out"></div>

    <div class="bar top">
      <div class="stats">
        <div><small>Height</small><b id="height">0 ft</b></div>
        <div class="st-base"><small>Base</small><b id="base">6 × 6 ft</b></div>
        <div><small>Best</small><b id="best">0 ft</b><i id="best-base"></i></div>
        <div class="st-top" id="top-at-box" hidden><small id="top-at-label">Top end</small><b id="top-at"></b></div>
      </div>
      <div class="tools">
        <button class="btn" id="undo" title="Take down the last board (Ctrl+Z)">Undo</button>
        <div class="snd"><button class="btn icon" id="mute" aria-label="Sound on or off" title="Sound on/off"><svg viewBox="0 0 24 24"><path class="spk" d="M4 9h4l5-4v14l-5-4H4z"/><path class="wav" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M16 9l6 6M22 9l-6 6"/></svg></button><input type="range" id="vol" min="0" max="100" value="80" aria-label="Volume" title="Volume"></div>
      </div>
    </div>
    <div class="wall-name" id="face-name">Front</div>
    <div class="hint-line" id="hint"></div>
    <div class="bar sel" id="sel-bar" hidden>
      <div class="hint" id="sel-hint">This board</div>
      <div class="row"><button class="btn" id="pickup">Take it down</button></div>
    </div>
    <div class="bar sel trim" id="trim-bar" hidden>
      <div class="hint" id="trim-hint"></div>
      <div class="row"><button class="btn" id="trim-saw">✂ Saw off the extra</button><button class="btn" id="trim-keep">Keep it</button></div>
    </div>
    <button class="btn wind" id="wind"><svg viewBox="0 0 24 24"><path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/></svg>Call the wind</button>

    <div class="say" id="say" hidden><div class="who">The miller</div><div id="say-text"></div></div>
    <div class="stage" id="stage" hidden><b id="stage-name"></b><span id="stage-sub"></span><div class="gauge"><i id="stage-bar"></i></div>
      <div class="legend" id="legend" hidden><small>Strain</small><i></i><span><em>green easy</em><em>red breaking</em></span></div></div>
    <div class="card" id="question" hidden></div>
    <div class="card" id="result" hidden></div>
    <div class="flybonus" id="flybonus" hidden>+1 board</div>
    <div class="perf" id="perf" hidden></div>
  </main>
`;

// The lab's own question ladder: the step climbs after two right in a row and drops a step after a wrong answer
// (questions.js stepLadder), kept in localStorage (a private window: it lasts the visit)
export function ladderAsker() {
  let ladder = (() => { try { return readLadder(localStorage.getItem(LADDER_KEY)); } catch (e) { return readLadder(null); } })();
  return {
    level: () => ladder.level,
    asked() {},
    answered(q, right) { ladder = stepLadder(ladder, right); try { localStorage.setItem(LADDER_KEY, JSON.stringify(ladder)); } catch (e) { /* the step lasts the visit */ } return ladder.level; },
    state: () => ({ ...ladder }),
  };
}
// The lab's own record of the best tower that stood, in localStorage
export function localBest() {
  return {
    read() { try { const b = JSON.parse(localStorage.getItem('bm-windmill-best') || '{}'); return { height: +b.height || 0, W: +(b.W ?? b.width) || 0, D: +(b.D ?? b.width) || 0 }; } catch (e) { return { height: 0, W: 0, D: 0 }; } },
    write(b) { try { localStorage.setItem('bm-windmill-best', JSON.stringify({ ...b, at: Date.now() })); } catch (e) { /* storage blocked: the record lasts this visit */ } },
  };
}

const DEG = Math.PI / 180;
const $ = (id) => document.getElementById(id);

export function mountWindmill(host) {
const { root, scene, camera, yard, asker } = host;
const O = host.origin || new THREE.Vector3();
const groundY = host.groundY || (() => 0);
const params = new URLSearchParams(location.search);
const phone = matchMedia('(max-width: 700px)').matches || /Mobi|Android/i.test(navigator.userAgent);
if (!root.querySelector('#view')) root.innerHTML = MARKUP;   // (the lab page puts it in first, for its canvas)
let alive = true;
// (an element of the page by its id; once the builder is taken off the page, a loose stand-in, so a timer still
// running then changes nothing)
const $ = (id) => (alive && document.getElementById(id)) || document.createElement('div');
const changed = (what) => { if (alive && host.changed) host.changed(what); };
const offs = [];   // (every listener put on the window or the document, taken off again by dispose)
const listen = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); offs.push(() => target.removeEventListener(type, fn, opt)); };
// the sound: the lab's own (woken by the first tap, its volume in the top bar), or the host's lent (the game's context
// and master volume once it is awake: sound.js attach; the top bar's volume is hidden then)
if (host.sound) { root.classList.add('wm-hosted'); sound.lend(true); host.sound.ready((ctx, out) => { if (alive) sound.attach(ctx, out); }); }

const el = {
  view: $('view'), canvas: $('c'), overlay: $('overlay'), hint: $('hint'),
  count: $('count'), countWord: $('count-word'), bench: $('bench'), benchEmpty: $('bench-empty'), benchBoard: $('bench-board'), benchLabel: $('bench-label'),
  tape: $('tape'), saw: $('saw'), sawLabel: $('saw-label'), cutBtn: $('cut'), upNext: $('up-next'), pieces: $('pieces'), piecesEmpty: $('pieces-empty'),
  gA: $('g-a'), gB: $('g-b'), arrows: ['g-xp', 'g-xm', 'g-zp', 'g-zm'].map($), nailBtn: $('nail'), stoneHandles: [0, 1, 2, 3].map((c) => $('stone-' + c)),
  selBar: $('sel-bar'), selHint: $('sel-hint'), panel: $('panel'), trimBar: $('trim-bar'), trimHint: $('trim-hint'), trimSaw: $('trim-saw'), trimKeep: $('trim-keep'),
};

// ── the tower's drawing, what falls ───────────────────────────────────────────────────────────────────────────────
const towerView = makeTowerView(scene);
const fall = makeFall(scene, { ground: groundY });

const app = {
  el, tower: newTower(START_W), face: 0, phase: 'build', held: null, selected: null, dirty: true, autoScroll: 0,
  lumber: { stack: BOARDS, bench: null, pieces: [] }, placed: [],
};
let miller = null;
let best = host.best ? host.best.read() : { height: 0, W: 0, D: 0 };

// ── the camera: always looking at the tower's middle (X = Z = 0), tipped PITCH down ───────────────────────────────────
// While building it moves only when the player moves it: a sideways drag walks it round the tower (smoothly, any angle,
// no settling on a side), an up and down drag slides what it looks at up and down the tower's middle (from the ground
// to a little above the top), and a pinch or the mouse wheel sets how far back it stands. Nothing else moves it: not a
// board taken up, nailed or put up. Calling the wind frames the whole tower once, gliding there (frameTower); then it is
// left alone again.
// az: the angle round the tower (0 looks at the front wall), y / yT: the height it looks at (feet; yT where it is
// heading, for the arrow keys and the edge climb while dragging a board), dist / distT: how far back (metres)
const PITCH = 25 * DEG;
const DIST = [2.5, 40];
const cam = { az: 0, azV: 0, y: 3, yT: 3, dist: 9, distT: 9, mode: 'face', pos: new THREE.Vector3(0, 3, 14), look: new THREE.Vector3(0, 1, 0) };
const azOf = (k) => Math.atan2(FACE_NORMAL[k][0], FACE_NORMAL[k][1]);
const wide = () => Math.max(app.tower.W, app.tower.D);
// how far back to stand at the start so the stones and a wall's height fit the view
function fitDistance() {
  const aspect = viewAspect(), t = Math.tan(camera.fov / 2 * DEG), W = wide();
  const hw = (W / 2 + (aspect < 0.6 ? 1.7 : 2.6)) * FT, hh = 8 * FT;
  return Math.max(hw / (t * aspect), hh / t) + W / 2 * FT;
}
// the view's own shape (width over height): the host's camera may cover more than the view (the game's whole canvas)
const viewAspect = () => { const r = el.view.getBoundingClientRect(); return r.width / Math.max(1, r.height); };
// the lens for the view's shape: a tall narrow screen (a phone held upright) gets a wider lens, or the tower would be a
// speck
const lensFor = (aspect) => (aspect < 0.6 ? 46 : aspect < 1 ? 36 : 30);
function resize() {
  if (!alive) return;
  const r = el.view.getBoundingClientRect();
  camera.fov = lensFor(r.width / Math.max(1, r.height));
  host.fit(r);
  camera.updateProjectionMatrix();
  build && build.renderPanel(); fitStats(); placeFaceName(); app.dirty = true;
}
// the highest the view may look: a little above the top of the tower (or of the board in hand)
const topY = () => Math.max(towerHeight(app.tower), app.held ? Math.max(app.held.A.Y, app.held.B.Y) : 0) + 4;
// the look height moved by dy feet: never below the ground, never up past topY (but a view left higher than that, the
// tower having come down since, stays put until dragged down)
const climb = (y, dy) => { let v = y + dy; if (dy > 0) v = Math.min(v, Math.max(topY(), y)); return Math.max(0, v); };
let orbiting = false;
function updateCamera(dt) {
  if (app.autoScroll) cam.yT = climb(cam.yT, app.autoScroll * 10 * dt);
  // a flick keeps turning a moment
  if (!orbiting && Math.abs(cam.azV) > 0.01) { cam.az += cam.azV * dt; cam.azV *= Math.exp(-3.2 * dt); } else if (!orbiting) cam.azV = 0;
  // (a glide: the wind test framing the tower moves slower, so it reads as the camera stepping back)
  const glide = cam.glide > 0 ? 2.2 : 0;
  if (cam.glide > 0) cam.glide -= dt;
  cam.y += (cam.yT - cam.y) * Math.min(1, dt * (glide || 8));
  cam.dist += (cam.distT - cam.dist) * Math.min(1, dt * (glide || 12));
  updateFace();
  // (straight from the angle, the height and the distance: walking round never brings it nearer or further)
  const ly = cam.y * FT, D = cam.dist, c = Math.cos(PITCH);
  // (cam.look and cam.pos are in the site's own frame; the camera itself in the scene's world: + O)
  cam.look.set(0, ly, 0);
  cam.pos.set(Math.sin(cam.az) * c * D, ly + Math.sin(PITCH) * D, Math.cos(cam.az) * c * D);
  // keep the camera above the hill
  const gy = groundY(cam.pos.x, cam.pos.z) + 0.4; if (cam.pos.y < gy) cam.pos.y = gy;
  camera.position.copy(cam.pos).add(O); camera.lookAt(v3.copy(cam.look).add(O));
  // a big gust shoves the watcher too: a small shake
  if (wind.level > 0.5 && app.phase === 'test') { const k = (wind.level - 0.5) * 0.04, t = performance.now() / 1000; camera.position.x += Math.sin(t * 23) * k; camera.position.y += Math.sin(t * 31 + 1) * k * 0.6; }
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// the wall facing the camera most (it changes a little past the corner, so it doesn't flicker): a piece brought onto
// the tower lies in planes of its kind
function updateFace() {
  if (app.phase !== 'build') return;
  const k = ((Math.round(cam.az / (Math.PI / 2)) % 4) + 4) % 4;
  if (k === app.face || Math.abs(angDiff(cam.az, azOf(k))) > Math.PI / 4 - 0.07) return;
  app.face = k; showFaceName(); walkMiller(); app.dirty = true;
}
// a drag on the view: sideways walks round, up and down climbs (the tower follows the finger)
// (a whole view's width turns the view about 200 degrees; a narrow view, a phone held upright, turns as if it were
// TURN_W pixels wide, so a finger's width of drag there is not a big swing: its 274 px turn about 120 degrees)
const TURN_W = 450;
const turnWidth = (r) => Math.max(r.width, TURN_W);
const camOk = () => app.phase === 'build' || app.phase === 'test' || app.phase === 'result';
app.orbit = (dx, dy) => {
  if (!camOk()) return;
  const r = el.view.getBoundingClientRect();
  orbiting = true; cam.azV = 0; app.orbited = true;
  cam.az -= dx / turnWidth(r) * Math.PI * 1.1;
  // (feet per pixel at the look point, so the tower follows the finger)
  const ftPerPx = 2 * cam.dist * Math.tan(camera.fov / 2 * DEG) / FT / r.height;
  if (Math.abs(dy) > 0.5) { cam.yT = climb(cam.yT, dy * ftPerPx); cam.y = cam.yT; }
};
// A quick flick keeps turning a moment; a finger lifted while still moving slowly (under FLICK pixels a millisecond)
// just stops, so a slow drag turns the view by exactly what the finger did. It never settles on a wall.
const FLICK = 0.25;
app.orbitRelease = (vx) => {
  orbiting = false;
  if (!camOk()) return;
  const r = el.view.getBoundingClientRect();
  if (Math.abs(vx) < FLICK) vx = 0;
  cam.azV = Math.max(-4, Math.min(4, -vx * 1000 / turnWidth(r) * Math.PI * 1.1));
};
// the zoom is the distance itself (a pinch and the wheel scale it)
Object.defineProperty(app, 'zoom', { get: () => cam.distT });
app.setZoom = (z) => { cam.distT = Math.max(DIST[0], Math.min(DIST[1], z)); };
app.viewAz = () => cam.az;
// how far a point (feet) is from the camera (metres): the nearer end of a board is the one facing the builder
app.camDist = (p) => camera.position.distanceTo(atWorld(p.X, p.Y, p.Z));

// the world and the screen: a point (feet) -> the screen (pixels inside the view); a screen point -> the ray through it
// (feet: from the camera, a unit direction); which way the camera looks; what it looks at (feet)
// (the camera's picture covers host.canvasRect(): the view itself on the lab page, the game's whole canvas in the
// game, the view a part of it. Points on the screen are always said inside the view: its top left is 0, 0.)
const v3 = new THREE.Vector3();
// a point in the site's frame (feet) -> the scene's world (metres)
const atWorld = (X, Y, Z) => v3.set(X * FT + O.x, Y * FT + O.y, Z * FT + O.z);
// a point in the scene's world, already projected (v3: -1..1 across the camera's picture) -> pixels inside the view
const toView = (p) => { const c = host.canvasRect(), r = el.view.getBoundingClientRect(); return { x: c.left - r.left + (p.x + 1) / 2 * c.width, y: c.top - r.top + (1 - p.y) / 2 * c.height }; };
const project = (X, Y, Z) => { atWorld(X, Y, Z).project(camera); const s = toView(v3); s.behind = v3.z > 1; return s; };
app.worldToScreen = (X, Y, Z) => project(X, Y, Z);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const aim = (cx, cy) => { const r = host.canvasRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
app.rayAt = (cx, cy) => { aim(cx, cy); const o = ray.ray.origin, d = ray.ray.direction; return { O: { X: (o.x - O.x) / FT, Y: (o.y - O.y) / FT, Z: (o.z - O.z) / FT }, d: { X: d.x, Y: d.y, Z: d.z } }; };
app.viewDir = () => { camera.getWorldDirection(v3); return { X: v3.x, Y: v3.y, Z: v3.z }; };
app.lookAt = () => ({ X: cam.look.x / FT, Y: cam.look.y / FT, Z: cam.look.z / FT });
// the board in hand is drawn a layer out from its line, away from the tower's middle (tower3d.js HELD_OFF): how far
app.heldOut = (w) => { const o = faceOf(w, app.tower.W, app.tower.D).out; return { X: o.X * HELD_OFF, Y: o.Y * HELD_OFF, Z: o.Z * HELD_OFF }; };

// ── names ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// (the chip under the stats names the side of the tower facing you; while a board is held, where that board is: "Brace
// at the front right, 2 ft up")
const FACE_NAMES = ['Front', 'Right side', 'Back', 'Left side'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
let faceText = '';
function showFaceName() {
  const txt = app.held && app.phase === 'build' ? cap(placeWords(app.tower, build.worldOf(app.held)).replace(/^the /, '')) : FACE_NAMES[app.face];
  if (txt !== faceText) { faceText = txt; $('face-name').textContent = txt; $('face-name').classList.toggle('is-held', !!app.held); placeFaceName(); }
}
// the boards of the tower that are legs (posts that lean: frame.js), worked out again only when the tower changes
let legKey = '', legSet = new Set();
function legsOf(t = app.tower) {
  const k = t.boards.map((b) => b.id).join(',');
  if (k !== legKey || t !== app.tower) { const sh = boardShapes(t); legSet = new Set(t.boards.filter((b) => sh.get(b.id)?.column && !isPost(b)).map((b) => b.id)); legKey = t === app.tower ? k : ''; }
  return legSet;
}

// ── where a board's top end is: in the top bar, while it is in hand or picked out ──────────────────────────────────
// From the middle of the base, to the nearest inch: "1 ft left · 1 ft front · 7 ft 9 in. up" (the same numbers with the
// opposite words on the mirror-image leg). It takes the stats' place while it shows. The board in hand: its free end
// ("Free end"). A horizontal board picked out has no top: its end on the right as seen is shown ("Right end").
let topAtText = '';
function showTopAt() {
  const held = app.phase === 'build' && app.held, src = app.phase === 'build' ? (held ? build.worldOf(app.held) : app.selected) : null;
  let txt = '', label = 'Top end';
  if (src) {
    let p = src.a.Y >= src.b.Y ? src.a : src.b;
    // (a board in hand: where its free end is; a horizontal board picked out: its end on the right as seen)
    if (held) { p = src.b; label = 'Free end'; }
    else if (Math.abs(src.a.Y - src.b.Y) < 0.04) {
      const A = app.worldToScreen(src.a.X, src.a.Y, src.a.Z), B = app.worldToScreen(src.b.X, src.b.Y, src.b.Z);
      p = A.x >= B.x ? src.a : src.b; label = 'Right end';
    }
    txt = label + '|' + whereWords(p).join('|');
  }
  if (txt === topAtText) return;
  topAtText = txt;
  const box = $('top-at-box'), stats = document.querySelector('.bar.top .stats');
  box.hidden = !txt; stats.classList.toggle('is-coords', !!txt);
  // (the stats come back after the coordinates: whether three of them fit is measured again, not read from before)
  if (!txt) fitStats();
  if (txt) {
    const [lab, ...parts] = txt.split('|');
    $('top-at-label').textContent = lab;
    $('top-at').innerHTML = parts.map((w) => `<span class="c">${w.replace(/([\d½]) ?(ft|in\.)/g, '$1<span class="u">$2</span>')}</span>`).join('<span class="dot">·</span>');
  }
  placeFaceName();
}

// ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────────
const build = makeBuild(app);
app.onLumber = (n) => { yard.setPile(n); if (ghosts) refreshGhosts(); changed('lumber'); };
// (a nailed board sawn off says so on its own bar, below; the miller's line is for the board in hand)
app.onSawOff = (len, kept, nailed) => { if (!nailed) say(kept ? `An offcut ${fmtWords(len)} long. It's with your cut pieces.` : `That bit's too short to use. Kindling for my stove.`, { key: kept ? 'offcut' : 'kindling', times: 2, force: true, ms: 4000 }); };
app.onTowerChanged = (src, note) => {
  // (a board sawn shorter: its twins are worked out again from it, so they take the new length)
  if (src && ghosts && ghosts.src === src) { const keep = ghosts; makeGhosts(src); ghosts.born = keep.born; }
  rebuild();
  if (src && app.selected === src) app.select(src, note);
};

// ── the footing stones: the first step ──────────────────────────────────────────────────────────────────────────────
// They can be moved until the first board is nailed (and again once the tower is all taken down).
const stonesOpen = () => boardCount(app.tower) === 0;
app.stonesOpen = stonesOpen;
app.setBase = (W, D = W, dragging = false) => {
  if (!stonesOpen()) return false;
  app.tower.W = W; app.tower.D = D; yard.setStones(W, D); sound.stone(Math.min(W, D)); ghosts = null; rebuild();
  return true;
};
// the base said in a sentence: "6 feet by 4 feet"
const baseWords = (W, D) => `${fmtWords(W)} by ${fmtWords(D)}`;
app.onStonesSet = () => {
  const { W, D } = app.tower, n = Math.min(W, D), x = Math.max(W, D);
  if (n <= 2) say(`${baseWords(W, D)}: mighty narrow. Cheap on wood, but a tall narrow tower tips right over in a gust.`, { key: 'narrow', times: 3, force: true });
  else if (x >= 7) say(`${baseWords(W, D)}: she'll stand steady, but every horizontal board that way is a whole board, and corner to corner is longer than any board.`, { key: 'wide', times: 3, force: true });
  else if (Math.abs(W - D) > 0.01) say(`Stones ${baseWords(W, D)} apart. She's narrower one way than the other: the wind from the side finds that. They'll stay put once the first board is nailed.`, { key: 'rect', times: 2, force: true });
  else say(`Stones ${baseWords(W, D)} apart. They'll stay put once the first board is nailed.`, { key: 'stones', times: 4, force: true });
};

// ── nailing, picking up, undo ────────────────────────────────────────────────────────────────────────────────────────
let idN = 1;
let lastDown = null;      // [{ rec, entry }]: what the last "Take it down" brought down, while nothing else was nailed since
// put a board on the tower: { a, b, len } in the world. Returns the record.
function addBoard(spec) {
  const rec = makeBoard('b' + idN++, spec.a, spec.b, spec.len);
  app.tower.boards.push(rec); app.placed.push({ rec }); lastDown = null; boardsSince++; return rec;
}
// where the builder left off (build.js startSpot) after boards came off (taken down, undone, blown down): the latest
// board nailed by hand that still stands, or none
function lastHandLeft() {
  if (app.lastHand && app.tower.boards.includes(app.lastHand)) return;
  const p = [...app.placed].reverse().find((q) => q.hand && app.tower.boards.includes(q.rec));
  app.lastHand = p ? p.rec : null;
}
app.nail = () => {
  const h = app.held; if (!h) return null;
  const spec = build.worldOf(h);
  const first = stonesOpen();
  // a board touching at two places gets two nails (counted before it goes up, or it would find itself)
  const cs = build.contactsOf(h), nails = cs.length >= 2 ? 2 : 1;
  const rec = addBoard(spec); app.placed[app.placed.length - 1].hand = true;
  app.held = null; sound.hammer(nails); app.lastNails = nails; app.lastHand = rec;
  build.flash(cs);
  // its twins round the tower, glowing, a tap away
  makeGhosts(rec);
  rebuild();
  // (the view stays where the builder left it; twins hidden behind the board just nailed: the hint says to walk round)
  // The miller's question (or word) waits while the bar offers to saw off the extra (build.js opens it right after
  // this returns): it comes once the builder saws or keeps it, about the board as it then is.
  pendingNail = { rec, first };
  setTimeout(() => { if (pendingNail && pendingNail.rec === rec && !(build.trim && build.trim.rec === rec)) runPendingNail(); }, 0);
  return rec;
};
let pendingNail = null;
function runPendingNail() { const p = pendingNail; pendingNail = null; if (p && app.tower.boards.includes(p.rec)) afterNail(p.rec, p.first); }
// the saw offer closed: sawn or kept, the waiting question comes now. Closed any other way (Undo, another board picked
// up, a twin built, a board picked out, the wind called), the waiting question is dropped with it.
app.onTrimClosed = (rec, how) => {
  if (!pendingNail || pendingNail.rec !== rec) return;
  // (after the saw cut has been told and the twins worked out again from the shorter board)
  if (how === 'saw' || how === 'keep') setTimeout(runPendingNail, 0); else pendingNail = null;
};
// pick out a nailed board (or none): it lights up, its bar offers to take it down, and its twins that aren't built
// glow again. note: a word on the bar first (after a saw cut: how much came off, flashed so it is seen)
app.select = (src, note) => {
  const again = src && src === app.selected;
  app.selected = src; towerView.highlight(src);
  el.selBar.hidden = !src || app.phase !== 'build';
  if (!src) return;
  build.offerTrim(null);
  // what it is, how long, and where: "Brace, 8 ft, at the front right, 2 ft up"
  const noun = isCornerPost(app.tower, src) ? 'corner post' : nounOf(src, legsOf());
  const where = placeWords(app.tower, src, legsOf()).replace(/^the [a-z ]+?(?=( at | on | in |,|$))/, '');
  const what = cap(noun) + ', ' + fmt(src.len) + (where ? ',' + where.replace(/^,/, '') : '');
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
  const depth = camera.position.distanceTo(atWorld((g.a.X + g.b.X) / 2, (g.a.Y + g.b.Y) / 2, (g.a.Z + g.b.Z) / 2));
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
  const S = (v) => { v3.copy(v).add(O).project(camera); return toView(v3); };
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
    else say(gh.reason === 'no wood left' ? (bonusEarned < BONUS_MAX ? 'No wood left for that one. A right answer to my questions earns another board.' : 'No wood left for that one.') : 'That one would have nothing to nail to yet. Put up what it hangs on first.', { key: 'grey-' + gh.reason, times: 3, force: true, ms: 5000 });
    return;
  }
  if (!app.held) app.select(pick.board || null);
};
$('pickup').onclick = () => { if (app.phase === 'build' && app.selected) { const gone = pickUp(app.selected); lastDown = gone.length ? gone : null; } };
// Undo takes back the last thing done: with a board in hand, its last move (a slide, a swing, a lean, a turn), and once
// it is back as it was lifted, the board itself goes back on the pile; just after "Take it down", the boards that came
// down go back up (paid from the pile again); otherwise the last board nailed comes back off.
$('undo').onclick = () => {
  if (app.phase !== 'build') return;
  if (app.held) { if (!build.undoHeld()) build.putBack(); return; }
  if (lastDown) { putBackUp(lastDown); lastDown = null; return; }
  const last = app.placed[app.placed.length - 1]; if (last) pickUp(last.rec);
};
// the boards a take-down brought down, up again where they were (each paid for from the pile; one with no wood left
// for it stays down)
function putBackUp(gone) {
  for (const { rec, entry } of gone) {
    if (!build.woodFor(rec.len) || app.tower.boards.includes(rec)) continue;
    build.payFor(rec.len); app.tower.boards.push(rec); app.placed.push(entry);
  }
  lastHandLeft(); sound.hammer(1); app.select(null); rebuild();
}
// take a board down (it goes back to the pile); anything left with nothing holding it up comes down too. -> [{ rec,
// entry }] what came down
function pickUp(src) {
  const t = app.tower, back = [], gone = [];
  const drop = (rec) => {
    const i = t.boards.indexOf(rec); if (i >= 0) { t.boards.splice(i, 1); back.push(rec.len); gone.push({ rec, entry: app.placed.find((p) => p.rec === rec) || { rec } }); }
    app.placed = app.placed.filter((p) => p.rec !== rec);
  };
  drop(src);
  // what still reaches the ground through its joints
  const reach = grounded(t.boards);
  t.boards.filter((b) => !reach.has(b)).forEach(drop);
  for (const len of back) build.returnPiece(len);
  // (the twins of a board that came down go with it)
  if (ghosts && !t.boards.includes(ghosts.src)) ghosts = null;
  lastHandLeft(); lastDown = null;
  sound.clatter(back[0] || 4, 'set'); app.select(null); rebuild();
  return gone;
}

function rebuild() {
  changed('tower');
  towerView.rebuild(app.tower); towerView.nails.visible = true; towerView.highlight(app.selected); towerView.showHead(false);
  $('height').innerHTML = fmtStat(towerHeight(app.tower));
  $('base').textContent = fmtBase(app.tower.W, app.tower.D, true);
  showBest();
  refreshGhosts();
  app.dirty = true;
}
function showBest() { $('best').innerHTML = fmtStat(best.height); $('best-base').textContent = best.height && best.W ? 'on ' + fmtBase(best.W, best.D || best.W, true) : ''; placeFaceName(); }
// A phone's top bar: once legs lean, heights with inches are the rule ("15 ft 11 in" for the height and the best), and
// three stats may not fit beside the tools. Then the base gives way (it is locked once building starts, and the card
// shows it), so the height and the best are never cut off. Checked whenever a stat changes, and when the view resizes.
function fitStats() {
  const box = document.querySelector('.bar.top .stats'); if (!box) return;
  box.classList.remove('is-tight');
  if (box.scrollWidth > box.clientWidth + 0.5) box.classList.add('is-tight');
}
const statsWatch = new MutationObserver(fitStats); statsWatch.observe(document.querySelector('.bar.top .stats'), { subtree: true, childList: true, characterData: true });
// (and once the web fonts are in: the bar's words grow a little wider then)
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) fitStats(); });
// the wall's name sits just under the stats box, however tall the box has grown (a best height adds a line to it)
function placeFaceName() {
  const v = el.view.getBoundingClientRect(), b = document.querySelector('.bar.top .stats').getBoundingClientRect();
  if (b.height) $('face-name').style.top = Math.round(b.bottom - v.top + 6) + 'px';
  // (on a phone the hint sits at the top too: under the wall's name, however tall the bar and the name have grown)
  const hint = el.hint; hint.style.top = '';
  if (matchMedia('(max-width: 700px)').matches && b.height) {
    const n = $('face-name'), nb = n.hidden ? null : n.getBoundingClientRect(), under = nb && nb.height ? nb.bottom : b.bottom;
    hint.style.top = Math.max(80, Math.round(under - v.top + 5)) + 'px';
  }
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
  if (paid.cut && paid.from < BOARD_FT - 0.01) say(`Sawed a piece ${fmtWords(paid.from)} long down to ${fmtWords(g.len)} for that twin. The offcut, ${fmtWords(paid.from - g.len)}, is with your cut pieces.`, { key: 'twin-saw', times: 3, force: true, ms: 5000 });
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
  // (a sentence: any label's units in it spelled out, "1 ft 7 in." -> "1 foot 7 inches")
  $('say-text').textContent = spellUnits(text); $('say').hidden = false;
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
// a board's slope from horizontal, degrees (0 horizontal, 90 straight up)
const slopeDeg = (b) => Math.atan2(Math.abs(b.b.Y - b.a.Y), Math.hypot(b.b.X - b.a.X, b.b.Z - b.a.Z)) / DEG;
const isLevel = (b) => slopeDeg(b) < 3, isUpright = (b) => slopeDeg(b) > 87;
// the posts and legs a board is nailed to
const columnsAt = (rec) => app.tower.boards.filter((o) => o !== rec && (isPost(o) || legsOf().has(o.id)) && touch3(rec, o).length);
// a brace: slanting, not a leg
const isBrace = (b) => !isLevel(b) && !isUpright(b) && !legsOf().has(b.id);
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

// the miller's questions: boards built (by hand or as twins) since the last one, the spare boards earned for this tower
// (at most BONUS_MAX), and the step the host's asker says to ask at (the lab: its own ladder in localStorage; the
// game: the skill model's geometry strand)
let boardsSince = 0, handSince = 0, bonusEarned = 0, lastPrompt = null;
const stepNow = () => Math.max(1, Math.min(LADDER_TOP, Math.round(asker.level()) || 1));
// a question at the ladder's step; when the board just nailed fits the step (a whole right triangle at 5, a triangle's
// corners at 4), now and then one about that board instead
function questionFor(rec, { slant, leg, bay, tris }) {
  const L = stepNow();
  let q = null;
  if (Math.random() < 0.6) {
    if (L >= 5) {
      if (slant || leg) { const r = reachQuestion(rec.len, Math.hypot(rec.b.X - rec.a.X, rec.b.Z - rec.a.Z)); if (r && r.kind === 'slope') q = r; }
      if (!q && bay) q = bayQuestion(bay.w, bay.h, bay.y0);
      if (!q && tris.length) q = makeQuestion(tris, rec, Math.random, 'length');
    } else if (L === 4 && tris.length) q = makeQuestion(tris, rec, Math.random, 'angle');
    if (q && q.prompt === lastPrompt) q = null;
  }
  q = q || ladderQuestion(L);
  lastPrompt = q.prompt;
  return { ...q, level: L, topic: topicOf(q) };
}
// after a board is nailed by hand: maybe a question, maybe a word from the miller
function afterNail(rec, first) {
  const t = app.tower, post = isPost(rec), leg = legsOf().has(rec.id), level = isLevel(rec), slant = !post && !leg && isBrace(rec);
  const n = app.placed.length, H = towerHeight(t), side = sideOfBoard(rec, t);
  const bay = level ? bayUnder(rec) : null;
  const tris = !post ? trianglesOf(t, rec) : [];
  handSince++;
  if (params.has('askall') || questionDue(handSince, boardsSince)) { const q = questionFor(rec, { slant, leg, bay, tris }); setTimeout(() => ask(q), 450); boardsSince = 0; handSince = 0; return; }
  // otherwise, maybe a word from the miller
  if (first && !leg) {
    say(post && isCornerPost(t, rec) ? 'Good: a post on the corner, straight up. See the glowing ones? Tap one to put the same post on that corner.' : post ? 'A post, straight up. Corner posts on the stones make the best start.' : 'Start with the corner posts, standing straight up. A post wants to be plumb, 90 degrees.', { force: true, ms: 9000 });
    return;
  }
  if (leg) {
    // a leg (a post that leans): in, toward the middle as it climbs, or out
    const [f, tp] = rec.a.Y <= rec.b.Y ? [rec.a, rec.b] : [rec.b, rec.a], dir = Math.hypot(tp.X, tp.Z) < Math.hypot(f.X, f.Z) - 0.05 ? 1 : -1;
    if (first) {
      const Leg = Math.abs(Math.abs(f.X) - t.W / 2) < 1e-3 && Math.abs(Math.abs(f.Z) - t.D / 2) < 1e-3 ? 'A corner leg' : 'A leg';
      say(dir < 0 ? `${Leg} leaning out: she'll be wider up top than at her stones. See the glowing ones? Tap one to lean the next corner to match.`
        : `${Leg} leaning in. See the glowing ones? Tap one to lean the next corner to match, and she narrows as she climbs.`, { force: true, ms: 9000 });
    } else if (dir > 0) say('Legs leaning in narrow her as she climbs, so the top catches less wind. They still don\'t hold a side square: brace every side corner to corner.', { key: 'lean-leg', times: 1 });
    else say('Leaning out: wider up top than at her stones. A gust gets a longer lever on her that way.', { key: 'lean-out', times: 1 });
    return;
  }
  const lo = Math.min(rec.a.Y, rec.b.Y);
  if (post && !isCornerPost(t, rec) && !said.innerPost && lo > 0.5) { said.innerPost = 1; say(`A post standing ${fmtWords(Math.round(lo * 2) / 2)} up. Its foot is only toe-nailed: give it a brace or two.`, { key: 'innerpost', times: 1 }); return; }
  const a = slopeDeg(rec), cols = columnsAt(rec);
  if (slant) {
    // a slanting board nailed to two posts, or one closing a triangle, is a brace however steep it is (on a narrow
    // base the corner-to-corner brace can't be any flatter), not a post that leans
    const braced = cols.length >= 2 || tris.length > 0;
    if (a > 70 && !braced) { say('That one leans. A post wants to be plumb, 90 degrees, or the weight pushes it over.', { key: 'plumb' }); return; }
    // (the other sides with no brace yet, said a moment later)
    const others = () => {
      const sides = ['front', 'right', 'back', 'left'], mine = side.split(' ');
      const bare = sides.filter((sd) => !mine.includes(sd) && !t.boards.some((b) => isBrace(b) && sideOfBoard(b, t).split(' ').includes(sd)));
      if (bare.length) setTimeout(() => { if (app.phase === 'build') say('Wind blows from every side. Every side needs its own brace: tap the glowing twins.', { key: 'other' }); }, 5200);
    };
    const run = Math.hypot(rec.b.X - rec.a.X, rec.b.Z - rec.a.Z);
    if (rec.len <= 4 && cols.length < 2) { say('A knee brace helps some, but its nails take a beating in a big gust. A long brace corner to corner holds better.', { key: 'knee' }); return; }
    if (!tris.length) { say('That brace makes no triangle: an end stops short of the corner, so the square can still fold. Set its ends right on the corners.', { key: 'notri', times: 3, force: true }); return; }
    if (a > 60 && braced && run < 4) { say('Steep, but on a side this narrow that\'s as good as a brace gets.', { key: 'steepnarrow', times: 1 }); others(); return; }
    if (a < 30 || a > 60) { say(`That brace is at ${Math.round(a)} degrees. Brace it nearer 45 and she'll hold.`, { key: 'steep' }); return; }
    say('Brace it at 45 and she\'ll hold. A triangle can\'t fold.', { key: 'good45', times: 1 });
    others();
    return;
  }
  if (bay) {
    const diag = Math.hypot(bay.w, bay.h);
    if (diag > BOARD_FT + 0.01) { say(`Corner to corner, that square wants a brace ${fmtWords(diag)} long: longer than a board. Brace from a post up to the horizontal board, or make the square shorter.`, { key: 'longbay', times: 2 }); return; }
  }
  // a horizontal board laid across the middle of the tower: a beam for the level above
  if (level && side === 'middle' && !said.beam && lo > 0.5) { said.beam = 1; say(`A horizontal board across the middle, ${fmtWords(Math.round(lo * 2) / 2)} up. Stand the next level's posts on boards like that one, and brace them.`, { key: 'beam', times: 1 }); return; }
  if (level && cols.length >= 2 && !t.boards.some((b) => isBrace(b) && sideOfBoard(b, t) === side)) { say('A square with no brace folds over like a card table in the wind.', { key: 'card', times: 2 }); return; }
  if (H >= 16 && !said.h16) { said.h16 = 1; say('Sixteen feet! Taller than my mill roof.', { key: 'h16', force: true }); return; }
  if (n >= 3 && !app.orbited) { say('Drag the hillside to walk round the tower, and up and down to climb it.', { key: 'orbit', times: 1 }); return; }
  if (app.lumber.stack === 0 && !app.lumber.bench && app.lumber.pieces.length <= 1) say('That\'s the last of the lumber. Call the wind when you\'re ready.', { key: 'last', times: 1 });
}
// The opening a horizontal board closes: posts under both its ends, reaching down (each standing on the one below) to a
// floor (the ground, or a horizontal board nailed to both those posts lower down). -> { y0, h, w } or null
function bayUnder(me) {
  const t = app.tower, y = (me.a.Y + me.b.Y) / 2;
  // the post under an end, and how far down a chain of posts reaches from there
  const postAt = (p, top) => t.boards.find((o) => o !== me && isPost(o) && Math.abs(o.a.X - p.X) < 0.2 && Math.abs(o.a.Z - p.Z) < 0.2 && Math.min(o.a.Y, o.b.Y) < top - 0.05 && Math.max(o.a.Y, o.b.Y) >= top - 0.05);
  const down = (E) => {
    let b = y, first = null;
    for (let guard = 0; guard < 20; guard++) { const o = postAt(E, b); if (!o) break; first = first || o; b = Math.min(o.a.Y, o.b.Y); }
    return { b, post: first };
  };
  const L = down(me.a), R = down(me.b);
  if (!L.post || !R.post || L.b > y - 0.3 || R.b > y - 0.3) return null;
  let y0 = Math.max(L.b, R.b);
  for (const s of t.boards) {
    if (s === me || !isLevel(s)) continue;
    const sy = (s.a.Y + s.b.Y) / 2;
    if (sy < y - 0.3 && sy > y0 && touch3(s, L.post).length && touch3(s, R.post).length) y0 = sy;
  }
  return { y0, h: y - y0, w: Math.hypot(L.post.a.X - R.post.a.X, L.post.a.Z - R.post.a.Z) };
}

// ── a math question card ─────────────────────────────────────────────────────────────────────────────────────────────
let curQ = null;   // the question on the card (WM.question)
const PRAISE = ['Right! Nice work.', 'Right! Sharp eye.', 'Right! Well done.', 'Right! You have it.'];
// again: a question asked from the card itself (the "Try it" after a lesson), while the card is already up
// a question read out loud, for a rider who can't read yet (the game's host passes speak and decides when; the lab
// page has none): what is asked, then the choices
function sayQuestion(q) {
  if (!host.speak) return;
  const plain = (t) => spellUnits(String(t).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const choices = (q.labels || q.choices.map((c) => `${c}${q.unit || ''}`)).map(plain);
  try { host.speak(`${plain(q.prompt)} ${choices.slice(0, -1).join(', ')}${choices.length > 1 ? ', or ' : ''}${choices[choices.length - 1]}?`); } catch (e) { /* the voice is a help, never in the way */ }
}
function ask(q, again = false) {
  if (app.phase !== (again ? 'question' : 'build')) return;
  curQ = q;
  app.phase = 'question'; app.select(null);
  const card = $('question');
  // (the stars: the step the question was made at)
  const L = q.level || stepNow();
  const steps = `<div class="steps" aria-label="question step ${L} of ${LADDER_TOP}">${'★'.repeat(L)}${'☆'.repeat(LADDER_TOP - L)}</div>`;
  const sub = bonusEarned < BONUS_MAX ? '<div class="sub">Get it right and the miller adds a board to your stack.</div>' : '';
  card.innerHTML = `${steps}<h2>${q.title || (q.bay ? 'How long a brace?' : 'A triangle!')}</h2>${sub}
    ${q.svg || (q.kind === 'slope' ? slopePic(q.pic) : q.pts ? trianglePic(q) : '')}<p>${q.prompt}</p>
    <div class="choices${q.labels ? ' is-words' : ''}" style="grid-template-columns: repeat(${q.labels && q.choices.length === 4 ? 2 : q.choices.length}, 1fr)">${q.choices.map((c, i) => `<button data-v="${c}">${q.labels ? q.labels[i] : c + q.unit}</button>`).join('')}</div>
    <div class="why" hidden></div><div class="row"><button class="btn" id="q-teach">Teach me</button><button class="btn go" id="q-ok" hidden>Back to building</button></div>`;
  card.hidden = false; card.scrollTop = 0;
  if (asker.asked) asker.asked(q);
  sayQuestion(q);
  if (!again) gesture('Interact');
  const done = () => { card.hidden = true; app.phase = 'build'; if (ghosts) ghosts.born = performance.now(); };   // (the glowing twins get their full time again)
  card.querySelector('#q-ok').onclick = done;
  card.querySelector('#q-teach').onclick = () => teach(q.topic || topicOf(q), done);
  card.querySelectorAll('.choices button').forEach((b) => b.onclick = () => {
    const right = b.dataset.v === String(q.answer);
    card.querySelectorAll('.choices button').forEach((x) => { x.disabled = true; if (x.dataset.v === String(q.answer)) x.classList.add('is-right'); });
    const why = card.querySelector('.why'); why.hidden = false;
    const was = L, now = asker.answered(q, right);
    if (right) {
      sound.chime();
      const up = now > was ? ' Next one is a step harder.' : '';
      if (earnsBoard(bonusEarned, right)) {
        bonusEarned++;
        why.innerHTML = `<b>Right!</b> ${q.why} The miller adds a fresh board to your stack.${up}`;
        build.giveBoard();
        const f = $('flybonus'); f.hidden = false; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); setTimeout(() => { f.hidden = true; }, 1300);
      } else why.innerHTML = `<b>${PRAISE[Math.floor(Math.random() * PRAISE.length)]}</b> ${q.why}${up}`;
      card.querySelector('#q-teach').hidden = true;
    } else {
      b.classList.add('is-wrong'); sound.soft();
      why.innerHTML = `Not quite. ${q.why}${helperPic(q)}`;
    }
    card.querySelector('#q-ok').hidden = false;
  });
}
// "Teach me": the idea behind a kind of question, worked through on a fresh example (teach.js draws the card), then
// "Try it": a fresh question of the same kind, which counts like any other
function teach(topic, back) {
  const L = stepNow(), ex = questionOf(topic, L), card = $('question');
  showTeach(card, { title: 'How it works', rule: ex.rule, picture: lessonPic(ex), example: ex.prompt, steps: ex.steps,
    answer: ex.labels ? ex.labels[ex.choices.indexOf(ex.answer)] : ex.unit === '°' ? ex.answer + '°' : ex.kind === 'slope' ? fmt(ex.answer / 12) : ex.answer + ex.unit },
  { onTry: () => { const S = stepNow(); ask({ ...questionOf(topic, S), topic, level: S }, true); }, onBack: back });
}
// a worked example's picture, its answer filled in
function lessonPic(q) {
  if (q.svg) return q.helper && q.helper.kind === 'svg' ? q.helper.svg : q.svg;
  if (q.pts) {
    const fill = (l) => (l === '?' ? `${q.answer}${q.unit === '°' ? '°' : ' ft'}` : l);
    return trianglePic({ ...q, sideLabels: q.sideLabels.map(fill), angleLabels: q.angleLabels.map(fill) });
  }
  if (q.kind === 'slope') return slopePic(q.pic) + helperPic(q);
  return '';
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
// a number for a sum in a picture: whole, or with a half ("1½")
const num2 = (v) => { const f = Math.floor(v + 1e-9); return Math.abs(v - f - 0.5) < 1e-6 ? (f || '') + '½' : String(Math.round(v * 100) / 100); };
// A slanting board for a slope question: a right triangle, the board from its foot, its top r ft over, the plumb line
// from the top down, and the "?" for its height. pic: { kind: 'leg', L, r }
const PIC_FONT = 'font-family="Bitter, Georgia, serif" font-weight="700"';
function slopePic(pic) {
  const ink = '#2b2219', wood = '#8a5a32', red = '#b0401f';
  let out = '<svg class="pic" viewBox="0 0 320 186">';
  out += `<line x1="16" y1="166" x2="304" y2="166" stroke="${ink}" stroke-width="2"/>`;
  const s = Math.min(130 / pic.L, 22), h = Math.sqrt(pic.L * pic.L - pic.r * pic.r) * s, run = pic.r * s, x0 = 110, x1 = x0 + run;
  out += `<line x1="${x1}" y1="166" x2="${x1}" y2="${166 - h}" stroke="${ink}" stroke-width="2" stroke-dasharray="6 5"/>`;
  out += `<line x1="${x0}" y1="166" x2="${x1}" y2="${166 - h}" stroke="${wood}" stroke-width="9" stroke-linecap="round"/>`;
  out += `<path d="M${x1 - 12} 166 v-12 h12" fill="none" stroke="${ink}" stroke-width="2"/>`;
  out += `<text x="${(x0 + x1) / 2 - 26}" y="${166 - h / 2}" text-anchor="end" ${PIC_FONT} font-size="18" fill="${ink}">${fmt(pic.L)}</text>`;
  out += `<text x="${(x0 + x1) / 2}" y="184" text-anchor="middle" ${PIC_FONT} font-size="16" fill="${ink}">${fmt(pic.r)}</text>`;
  out += `<text x="${x1 + 12}" y="${166 - h / 2 + 6}" ${PIC_FONT} font-size="20" fill="${red}">?</text>`;
  return out + '</svg>';
}
// a small picture that shows WHY: the three corners laid side by side make a straight line (180), or the squares on
// the sides of a right triangle; for a leaning wall, the slope inch by inch
function helperPic(q) {
  if (!q.helper) return '';
  if (q.helper.kind === 'svg') return q.helper.svg;
  if (q.helper.kind === 'legsq') {
    const { L, r, h, exact } = q.helper;
    if (exact) return helperPic({ helper: { kind: 'squares', a: Math.min(r, Math.round(h)), b: Math.max(r, Math.round(h)), c: L } });
    // (the last words on two lines: one line ran past a phone's card)
    return `<svg class="pic" viewBox="0 0 320 128"><text x="160" y="30" text-anchor="middle" ${PIC_FONT} font-size="17" fill="#2b2219">${num2(L)}×${num2(L)} − ${num2(r)}×${num2(r)} = ${num2(L * L - r * r)}</text>
      <text x="160" y="58" text-anchor="middle" ${PIC_FONT} font-size="17" fill="#2b2219">${h.toFixed(2)} × ${h.toFixed(2)} ≈ ${(h * h).toFixed(1)}</text>
      <text x="160" y="88" text-anchor="middle" ${PIC_FONT} font-size="14" fill="#6d4b2b">so the top is about ${fmtWords(h)} up:</text>
      <text x="160" y="110" text-anchor="middle" ${PIC_FONT} font-size="14" fill="#6d4b2b">less than the board is long</text></svg>`;
  }
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
  app.phase = 'test'; cam.azV = 0; ghosts = null; refreshGhosts(); build.offerTrim(null);
  // (the camera frames the whole tower once, smoothly, from where it stands round it; from then on it is left alone:
  // walking round, climbing and zooming all still work during the test)
  frameTower();
  $('say').hidden = true; $('wind').hidden = true; el.selBar.hidden = true;
  testRun.start();
}
// The whole tower in view: the camera looks at its middle height and backs off until its height (and its width, as
// seen from where the camera stands) fits, gliding there over a second or so (updateCamera's glide).
function frameTower() {
  const t = app.tower, H = Math.max(6, towerHeight(t));
  let x0 = -t.W / 2, x1 = t.W / 2, z0 = -t.D / 2, z1 = t.D / 2;
  for (const b of t.boards) for (const p of [b.a, b.b]) { x0 = Math.min(x0, p.X); x1 = Math.max(x1, p.X); z0 = Math.min(z0, p.Z); z1 = Math.max(z1, p.Z); }
  const across = Math.abs(Math.cos(cam.az)) * (x1 - x0) + Math.abs(Math.sin(cam.az)) * (z1 - z0) + 2;
  const tv = Math.tan(camera.fov / 2 * DEG), th = tv * camera.aspect;
  const need = Math.max((H * 0.62 + 1) * FT / tv, across / 2 * FT / th) + Math.max(x1 - x0, z1 - z0) / 2 * FT;
  cam.glide = 1.6; cam.yT = H * 0.45; cam.distT = Math.max(DIST[0], Math.min(DIST[1], need));
}
const testRun = makeTestRun(app, {
  towerView, fall, say, gesture,
  viewAz: () => cam.az,
  // the miller's spot, upwind, out from under the tower (the camera stays where the builder left it)
  watch: ({ miller: m }) => { millerTarget = new THREE.Vector3(m.x, 0, m.z); },
  record: (h, W, D) => {
    const newBest = h > best.height;
    if (newBest) { best = { height: h, W, D }; if (host.best) host.best.write(best); }
    showBest();
    return { best, newBest };
  },
  // (the sails turned to face us)
  showHead: (standing) => towerView.showHead(true, standing, Math.atan2(cam.pos.x, cam.pos.z)),
  keep: keepBuilding,
  fresh: (line) => millerBeat(line),
  // (the builder put away with the card up and nothing left standing: the fresh yard at once, no words)
  reset: () => { resetDue = false; fall.clear(); resetAll(); backToBuild(); changed('fresh'); },
  // (the host's own pay for what stood, if it has one: the game's miller)
  pay: host.pay ? (h, o) => host.pay(h, o) : null,
});
// Keep building: what stood stays, the boards that came down whole go back on the pile (snapped ones are kindling)
function keepBuilding({ keep, back, kindling, quiet = false }) {
  const t = app.tower;
  t.boards = t.boards.filter((b) => keep.has(b.id));
  app.placed = app.placed.filter((p) => keep.has(p.rec.id));
  for (const len of back) build.returnPiece(len);
  lastHandLeft(); lastDown = null;
  backToBuild(); rebuild(); changed('keep');
  if ((back.length || kindling) && !quiet) say(`${back.length ? `${back.length === 1 ? 'The board' : `The ${back.length} boards`} that came down whole ${back.length === 1 ? 'is' : 'are'} back on your pile.` : ''}${kindling ? ` ${kindling === 1 ? 'The one' : kindling} that snapped went for kindling.` : ''} Build her up again!`.trim(), { force: true, times: 99, ms: 7000, key: 'keep' });
}

// after a crash (or for a fresh start): the miller has his say, the yard is cleared and a fresh stack of lumber waits
// (the camera stays where it is)
let resetDue = false;   // (the yard is to be cleared: the miller is still saying his piece)
function millerBeat(line) {
  app.phase = 'miller'; resetDue = true;
  $('say-text').textContent = line; $('say').hidden = false; clearTimeout(sayTimer);
  gesture('Wave', 2000) || gesture('Interact');
  setTimeout(() => { if (alive && resetDue) { resetDue = false; fall.clear(); resetAll(); changed('fresh'); } }, 700);
  setTimeout(() => { if (!alive) return; $('say').hidden = true; backToBuild(); }, 1900);
}
function backToBuild() {
  app.phase = 'build'; cam.azV = 0; towerView.showHead(false);
  towerView.setBend(null); towerView.setStrain(null); towerView.setSpots(null);
  $('wind').hidden = false; wind.level = 0.06; wind.dir.set(1, 0, 0.2).normalize(); app.dirty = true;
  walkMiller();
}
// a cleared yard and a fresh stack; the stones stay where they were set
function resetAll(W = app.tower.W, D = app.tower.D) {
  app.tower = newTower(W, D); app.placed = []; app.held = null; app.selected = null; ghosts = null; app.lastHand = null; lastDown = null;
  yard.setStones(W, D);
  build.freshStack(BOARDS);
  showFaceName(); rebuild(); walkMiller(); boardsSince = 0; handSince = 0; bonusEarned = 0;
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
    const want = Math.atan2(cam.pos.x - p.x, cam.pos.z - p.z) * 0.5 + Math.atan2(-p.x, -p.z) * 0.5;
    miller.root.rotation.y += angDiff(want, miller.root.rotation.y) * Math.min(1, dt * 3);
  }
  miller.update(dt);
}

// ── the loop ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// (the host calls frame(dt) every frame, then draws: the lab page with its own renderer, the game with the valley)
let fps = 0;
let ambient = 0, focusAt = 0;
function frame(dt) {
  if (!alive) return;
  dt = Math.min(0.05, dt);
  // the wind test plays its gusts (and what falls keeps falling, through the card too)
  testRun.frame(dt);
  // the boards the result card talks about (its focusIds) glow on the tower while the card is open
  focusAt -= dt;
  if (focusAt <= 0) {
    focusAt = 0.25;
    const card = app.phase === 'result' && !$('result').hidden ? (testRun.state() || {}).card : null;
    towerView.setFocus(card && card.focusIds && card.focusIds.length ? card.focusIds : null);
  }
  if (!testRun.running && app.phase !== 'result') {
    // a light breeze while building, puffing now and then
    ambient += dt; wind.level = 0.07 + 0.05 * Math.max(0, Math.sin(ambient * 0.4)) ** 3;
    sound.setWind(wind.level);
  }
  // the twins fade away if left alone (their clock stands still while a question is open, and while the view turns:
  // walking round to see them, on a phone, takes a while)
  const turning = orbiting || Math.abs(cam.azV) > 0.01;
  if (ghosts && (app.phase !== 'build' || turning)) { if (ghosts.paused === undefined) ghosts.paused = performance.now() - ghosts.born; ghosts.born = performance.now() - ghosts.paused; }
  else if (ghosts) ghosts.paused = undefined;
  if (ghosts) {
    const age = performance.now() - ghosts.born, f = age < GHOST_STAY ? 1 : 1 - (age - GHOST_STAY) / GHOST_FADE;
    if (f <= 0) { ghosts = null; refreshGhosts(); } else towerView.fadeGhosts(f);
  }
  yard.update(dt, cam.look, cam.pos);
  updateCamera(dt);
  updateMiller(dt);
  towerView.update(dt, wind.level);
  build.frame();
  // the board in hand (its ends glowing green where they touch)
  const h = app.held && app.phase === 'build' ? app.held : null, hi = build.heldInfo;
  if (h) towerView.showHeld({ ...build.worldOf(h), glowA: !!(hi && hi.glowA), glowB: !!(hi && hi.glowB) });
  else towerView.showHeld(null);
  showFaceName();
  showTopAt();
  $('face-name').hidden = app.phase !== 'build';
}

// ── keys ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
listen(window, 'keydown', (e) => {
  if (app.phase !== 'build') return;
  // (the arrow keys walk round by 10 degrees a press, and climb by 2 feet; a board in hand stays where it is)
  if (e.key === 'ArrowLeft') { cam.azV = 0; cam.az -= 10 * DEG; }
  else if (e.key === 'ArrowRight') { cam.azV = 0; cam.az += 10 * DEG; }
  else if (e.key === 'ArrowUp') cam.yT = climb(cam.yT, 2);
  else if (e.key === 'ArrowDown') cam.yT = climb(cam.yT, -2);
  else if (e.key === 'Escape') { if (app.held) build.putBack(); else if (app.selected) app.select(null); else if (host.escape) host.escape(); }
  else if (e.key === 'Enter' && app.held) el.nailBtn.click();
  else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) $('undo').click();
  // (with a board in hand, W A S D move its free end: A and D across, W and S along, as the arrows do)
  else if (app.held && /^[wasd]$/i.test(e.key)) { const k = e.key.toLowerCase(); build.arrow(k === 'a' || k === 'd' ? 'X' : 'Z', k === 'd' || k === 's' ? 1 : -1); }
});
listen(window, 'pointerdown', () => sound.audioOn(), { capture: true });
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
listen(window, 'resize', resize);
resize();
// a fresh yard, or the host's saved tower and lumber (start: { tower, lumber: { full, pieces: [len] }, bonus })
const start = host.start && host.start.tower ? host.start : null;
if (start) {
  const t = cleanTower(start.tower);
  app.tower = newTower(t.W, t.D);
  build.freshStack(Math.max(0, start.lumber && Number.isFinite(start.lumber.full) ? start.lumber.full : BOARDS));
  for (const len of (start.lumber && start.lumber.pieces) || []) if (len > 0) build.returnPiece(len);
  for (const b of t.boards) addBoard(b);
  boardsSince = 0; bonusEarned = Math.max(0, Math.min(BONUS_MAX, start.bonus | 0));
} else build.freshStack(BOARDS);
yard.setStones(app.tower.W, app.tower.D);
showFaceName(); rebuild();
cam.az = host.az || 0; cam.dist = cam.distT = Math.min(DIST[1], fitDistance() * 1.15);
if (start) { cam.y = cam.yT = Math.min(Math.max(3, towerHeight(app.tower) * 0.5), 12); }
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) placeFaceName(); });
// (the host may lend its own miller, already standing at the site: he walks over from where he is)
(host.miller ? Promise.resolve(host.miller(scene)) : makeMiller(scene)).then((m) => {
  if (!m) return;
  if (!alive) { if (host.dropMiller) host.dropMiller(m); else scene.remove(m.root); return; }
  miller = m; if (!host.miller) miller.root.position.copy(millerSpot(0)); walkMiller();
  setTimeout(() => {
    if (!alive || !stonesOpen()) return;
    say('Howdy! First, the footing stones: drag one in or out, either way. A wide base stands steadier once she\'s braced, but every horizontal board and brace costs more wood.', { force: true, ms: 10000 });
    setTimeout(() => { if (stonesOpen() && !app.held) say('When the stones suit you, cut a board on the left and drag it up onto a corner.', { key: 'start2', times: 1, force: true, ms: 9000 }); }, 10500);
  }, 900);
});

// ── a handle for test scripts (see the top of this file) ─────────────────────────────────────────────────────────────
const toPage = (p) => { const r = el.view.getBoundingClientRect(); return { x: p.x + r.left, y: p.y + r.top, behind: p.behind }; };
const handle = {
  app, camera, scene, wind, cam, test: () => testRun.state(), result: () => testRun.result || null, build, startTest, towerView, fall,
  // a board between two world points, nailed as if put up by hand (its wood comes off the pile, sawn as needed, as a
  // twin's does, so Undo puts back only what was taken; with no wood left for it the board is nailed anyway)
  addWorld(a, b, len) {
    const L = len ?? Math.hypot(b.X - a.X, b.Y - a.Y, b.Z - a.Z);
    build.payFor(L);
    app.held = { piece: { id: 'dev', len: L }, len: L, A: { ...a }, on: null, B: { ...b }, con: null };
    return app.nail();
  },
  // a whole tower at once, on a fresh yard: its wood comes off the pile (sawn as needed), no questions, no twins
  load(t0) {
    const t = cleanTower(t0);
    resetAll(t.W, t.D);
    for (const b of t.boards) { build.payFor(b.len); addBoard(b); }
    rebuild();
    return app.tower.boards.length;
  },
  setBase: (W, D) => app.setBase(W, D),
  setWidth: (w) => app.setBase(w, w),
  footprint: () => ({ W: app.tower.W, D: app.tower.D }),
  boards: () => JSON.parse(JSON.stringify(app.tower.boards)),
  ghosts: () => app.ghostList().map((g) => ({ a: g.a, b: g.b, len: g.len, ok: g.ok, reason: g.reason })),
  confirm: (i) => confirmGhost(app.ghostList()[i]),
  confirmAll,
  sockets: () => build.sockets().map((q) => ({ X: q.X, Y: q.Y, Z: q.Z, on: q.on ? q.on.id : null })),
  socketScreen: (q) => toPage(app.worldToScreen(q.X, q.Y, q.Z)),
  held: () => {
    const h = app.held; if (!h) return null;
    const spot = (n) => { if (!n || n.hidden) return null; const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    return { A: { ...h.A }, B: { ...h.B }, len: h.len, con: h.con ? { s: h.con.s, P: h.con.P, past: h.con.past, on: h.con.o.id } : null,
      ends: [toPage(app.worldToScreen(h.A.X, h.A.Y, h.A.Z)), toPage(app.worldToScreen(h.B.X, h.B.Y, h.B.Z))],
      handles: { socket: spot(el.gA), free: spot(el.gB) }, arrows: el.arrows.map(spot), canNail: build.canNail(h), place: placeWords(app.tower, build.worldOf(h)) };
  },
  ask: (topic) => ask({ ...questionOf(topic, stepNow()), topic, level: stepNow() }),
  question: () => (curQ && !$('question').hidden ? { answer: curQ.answer, kind: curQ.kind, topic: curQ.topic, level: curQ.level, choices: curQ.choices, teach: $('question').classList.contains('teach') } : null),
  trim: () => (build.trim ? { past: build.trim.past, id: build.trim.rec.id } : null),
  // (for rigs: stand square on to a side at once, or at az radians round the tower)
  turnTo: (face) => { cam.azV = 0; cam.az = azOf(face) + Math.round((cam.az - azOf(face)) / (Math.PI * 2)) * Math.PI * 2; },
  setAz: (az) => { cam.azV = 0; cam.az = az; },
  state: () => ({ phase: app.phase, face: app.face, W: app.tower.W, D: app.tower.D, height: towerHeight(app.tower), boards: boardCount(app.tower), az: cam.az, camY: cam.y, zoom: cam.distT, camDist: camera.position.distanceTo(cam.look), stonesOpen: stonesOpen(),
    full: build.fullCount(), lumber: { stack: app.lumber.stack, bench: app.lumber.bench && app.lumber.bench.len, pieces: app.lumber.pieces.map((p) => +p.len.toFixed(3)) },
    pile: build.groups().map((g) => [g.len, g.list.length]), panel: { bench: el.benchLabel.textContent, groups: [...el.pieces.children].map((d) => d.textContent) },
    held: app.held && { A: app.held.A, B: app.held.B, len: app.held.len, con: !!app.held.con }, ghosts: app.ghostList().length, best, fps: host.fps ? host.fps() : 0,
    question: !$('question').hidden ? $('question').innerText : null, result: !$('result').hidden ? $('result').innerText : null, falling: fall.sticks.length, hint: el.hint.textContent, nails: app.lastNails, say: $('say').hidden ? null : $('say-text').textContent,
    faceName: $('face-name').textContent, ladder: asker.state ? asker.state() : { level: stepNow() }, bonus: bonusEarned, boardsSince, handSince, trim: !el.trimBar.hidden ? el.trimHint.textContent : null }),
  worldToScreen: (X, Y, Z) => toPage(app.worldToScreen(X, Y, Z)),
  resetAll, flourFor, STAGES,
};

// ── what the host keeps ──────────────────────────────────────────────────────────────────────────────────────────────
// the tower and the lumber as they stand now, to save (a board in hand goes back on the pile in the saved copy)
function snapshot() {
  const pieces = app.lumber.pieces.map((q) => +q.len.toFixed(4));
  if (app.held && app.held.len) { if (app.held.len >= BOARD_FT - 1e-6) pieces.push(BOARD_FT); else pieces.push(+app.held.len.toFixed(4)); }
  const full = build.fullCount() + pieces.filter((l) => l >= BOARD_FT - 1e-6).length;
  return { tower: JSON.parse(JSON.stringify({ W: app.tower.W, D: app.tower.D, boards: app.tower.boards.map((b) => ({ id: b.id, a: b.a, b: b.b, len: b.len })) })),
    lumber: { full, pieces: pieces.filter((l) => l < BOARD_FT - 1e-6) }, bonus: bonusEarned, best: { ...best }, height: towerHeight(app.tower) };
}
// About to be put away (the host saves next): with the result card up, or while the miller clears the yard, what the
// card's button would leave is done now (what stood stays; nothing standing: a fresh yard); in the middle of the wind
// test the tower stays as it was before the wind. -> true when anything changed
function settle() {
  let did = false;
  if (app.phase === 'result') did = testRun.settle();
  if (resetDue) { resetDue = false; fall.clear(); resetAll(); did = true; }
  return did;
}
// everything off the page and out of the scene; the host's own things (its scene, camera, canvas) stay
function dispose() {
  if (!alive) return;
  alive = false;
  for (const off of offs.splice(0)) off();
  statsWatch.disconnect();
  testRun.dispose();
  clearTimeout(sayTimer); clearTimeout(gestureTimer);
  if (app.held) build.putBack();
  towerView.dispose();   // (out of the scene, its shapes let go on the graphics card)
  if (fall.dispose) fall.dispose();
  if (miller) { if (miller.walking) miller.play('Idle', { fade: 0.3 }); if (host.dropMiller) host.dropMiller(miller); else scene.remove(miller.root); }
  sound.setWind(0);
  if (host.sound) { sound.detach(); sound.lend(false); root.classList.remove('wm-hosted'); }
  root.innerHTML = '';
}
const busy = () => app.phase !== 'build' || !!app.held;
return { frame, resize, dispose, snapshot, settle, busy, handle, app, cam, towerView, get phase() { return app.phase; }, startTest, ask: handle.ask };
}
