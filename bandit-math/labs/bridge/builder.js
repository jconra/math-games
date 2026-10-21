// THE BRIDGE BUILDER: build a bridge across the western river from a stack of lumber, lay its deck, then send loads
// across it, lighter to heavier, and see what it carries. Everything the builder is (the lumber panel, the board in hand
// and its arrows, the twins, the deck, the engineer and his questions, the crossing test and its card), mounted on a
// page by its HOST, which owns the renderer, the camera's lens and the frame loop:
//   * the lab page (main.js): its own river crossing scene (scene.js makeScene), the whole window, the lab's own
//     question ladder and best rating in localStorage
//   * the game (src/bridgejob.js through src/buildsite.js): at the ravine on the western river in the valley, the
//     game's canvas and camera, the engineer's questions through the skill model's geometry strand, the bridge saved
//     per rider, the engineer's pay in the game's gold
// It follows the windmill lab's builder (labs/windmill/builder.js), and imports its modules wherever they fit: the
// drawing of boards (tower3d.js), the wood and the nails and the solver (frame.js, through this lab's frame.js), the
// geometry ladder and its lessons (questions.js, teach.js), lengths in words and the free end (tower.js, through
// bridge.js), touching (touch.js), sounds, wood textures.
//
// How a round goes: first set the gap (drag a bank's stone edge in or out: 6 to 24 feet; it locks when the first board
// is nailed; a host may fix it: the game's ravine is 16 feet). Cut boards from the lumber panel, drag the pieces onto
// the view, nail them, exactly as the windmill's free boards: a piece's first end goes in a SOCKET (a spot on the half
// foot on a bank's stone top or its stone wall, or along a board), it stands straight up; then drag its free end, or
// tap the arrows (the two pairs across the board: green east and west, red up and down, blue south and north), until
// it reaches another board: it connects there (its free end turns green); ✓ nails it, and a board too long can be
// sawn off at the joint. Each board nailed shows its twins glowing: the same board on the other side of the bridge
// (front to back), at the other end (mirrored across the middle of the gap), and both; a tap builds one, a double tap
// builds them all. Once both sides have horizontal boards reaching from bank to bank at one height, "Lay the deck" lays
// deck planks across them (from their own pile). The camera moves only when you move it (drag to walk round, up and
// down; pinch or the wheel to come nearer), until the test, when it frames the whole bridge once. Now and then the
// engineer asks a geometry question (questions.js: the windmill's ladder with the bridge's own step at the top), a
// right answer earns a spare board (at most 6 a bridge, never said). "Send it across": a person, horse and rider, the
// covered wagon, the freight wagon and the cattle drive cross in turn (frame.js works out every half foot of each in
// 3D: crossing.js plays it), until one can't; the engineer pays by the heaviest load carried. Then keep building on
// what stands, or start fresh.
//
// THE BRIDGE'S OWN FRAME (feet: the middle of the gap at X = Z = 0, the bank tops at Y = 0, X from the west bank to the
// east, Z from the north side to the south): on the lab page that is the scene's own. A host may stand it anywhere and
// turn it (host.origin, host.turn): the camera, the rays and every word that names a way (host.words) follow.
//
//   const B = mountBridge(host)        puts MARKUP into host.root and starts; host:
//     root            the element the builder's page goes in (its #app: the lumber panel and the view)
//     scene           the THREE.Object3D its things are added to, in the bridge's own frame turned and placed as
//                     host.turn and host.origin say (the lab: the scene; the game: a group at the ravine)
//     origin          THREE.Vector3: the bridge's middle (on the bank tops) in the scene's world, metres
//     turn            radians about the up axis the bridge's frame is turned in the world (three's rotation.y; 0: the
//                     lab's, +X east); the host turns `scene` the same way
//     camera          the THREE.PerspectiveCamera the builder points (its position, where it looks, its fov)
//     fit(r)          the view's rectangle (page pixels) changed: the host sets the camera's aspect (and any view
//                     offset) so the picture fills it, and sizes its renderer if it owns one
//     canvasRect()    the page rectangle the camera's picture covers (the lab: the view itself; the game: its canvas)
//     yard            { setPile(n), setPlankPile(n), setSpan(S), update(dt, look, eye) } the stone abutments and the
//                     lumber and plank piles (scene.js makeScene or makeYard), look and eye in the bridge's frame (m)
//     groundY(x, z)   the ground's height in the bridge's frame (metres, x and z from the middle; abutment tops at 0)
//     waterY          the river's surface in the bridge's frame (metres; the camera keeps above it)
//     asker           the engineer's questions: { level(), asked(q), answered(q, right) -> the step after, state() }
//                     (ladderAsker() below is the lab's own; the game passes the skill model's)
//     best            { read() -> { rating, S }, write({ rating, S }) } the best rating carried
//     pay(rating)     optional: the engineer pays for this rating (index into frame.js LOADS, -1 none) ->
//                     { gold, line, sub } for the card (the lab: frame.js LOADS gold, nothing kept)
//     span            optional: the gap fixed at this many feet (the banks can't be dragged)
//     start           optional { bridge, lumber, planks, bonus } to begin with (a rider's bridge saved earlier)
//     words(text)     optional: every word naming a way (north, east, ...) as the host's world has it (the lab: as is)
//     marks           optional: the letters painted on the two stone tops [west, east] (the lab: W, E)
//     engineer(scene), dropEngineer(person)   optional: the host lends its own engineer (already standing at his spot
//                     on the west abutment, put in `scene`) and takes him back when the builder goes
//     escape()        optional: Esc with nothing in hand and nothing picked out (the game: leave the site)
//     changed(what)   optional: the bridge or the lumber changed ('nail', 'take', 'deck', 'test', ...): the game saves
//     tested(card)    optional: a crossing test finished (its card: rating, gold, ...)
//     az              optional: the angle round the bridge the camera starts at (radians, in the bridge's frame)
//     zoom            optional: how far back it starts, over the distance that just fits the gap (the lab: 1.3)
//     loadsWait       optional: ms before the loads' people, animals and wagons start loading (the lab: at once)
//     libs            optional: { animals, folk, wagons } the host's own libraries, loaded already (the game's: nothing is
//                     loaded twice); the lab loads its own
//     span, engineerSide, speak(text)   optional: the gap fixed (feet); the engineer's side of the road (-1 the north
//                     side, as on the lab page; +1 the south); a question's words read out (a rider who can't read yet)
//     sound           optional: { ready(fn) } the host's own sound (as the windmill's: no context of the lab's own)
//     low             a phone or a low tier: fewer specks
//   B.frame(dt)       each frame, before the host draws: the camera, the test, the engineer, the board in hand
//   B.resize(), B.dispose() (everything off the page and out of the scene), B.snapshot() -> what to save,
//   B.busy() (a question, the test or a board in hand), B.cam (az, y, dist, look, pos: the bridge's frame, metres),
//   B.handle (window.BR on the lab page)
//
// ?perf shows frames per second, ?askall asks at every chance.
// B.handle (window.BR on the lab page), for test scripts (feet, in the bridge's frame):
//   BR.addWorld(a, b, len)   nail a board between two points as if put up by hand (same questions, same twins)
//   BR.load(bridge)          a whole bridge { S, D, boards } put up at once on a fresh yard (no questions)
//   BR.setSpan(S)            the gap (only while nothing is built); BR.layDeck() lays the deck if it can; BR.deck()
//   BR.boards(), BR.ghosts(), BR.confirm(i), BR.confirmAll(), BR.sockets(), BR.socketScreen(p), BR.held(), BR.question(),
//   BR.ask(topic), BR.trim(), BR.turnTo(az), BR.setAz(az), BR.state(), BR.test() (the test as it plays: crossing.js
//   state()), BR.result(), BR.startTest(), BR.worldToScreen(X, Y, Z)
import * as THREE from 'three';
import { SPAN0, WIDTH, BOARDS, PLANKS, BOARD_FT, newBridge, cleanBridge, boardCount, bridgeHeight, twinsOf, spotTaken, isPost, makeBoard, spellUnits,
  placeWords, roleOf, nounOf, deckLine, pointWords, encodeBridge, decodeBridge, touchesAny, grounded, contactsOf as contactsBr, asTower, lenLabel, lenWords, isLevelB, isUprightB, supportsOf } from './bridge.js';
import { touch3 } from '../windmill/touch.js';
import { faceOf } from '../windmill/frame.js';
import { LOADS, inTheWay } from './frame.js';
import { makeCrossing } from './crossing.js';
import { trianglesOf, makeQuestion, bayQuestion, reachQuestion, ladderQuestion, questionOf, topicOf, questionDue, stepLadder, readLadder, LADDER_KEY, LADDER_TOP, BONUS_MAX, earnsBoard, WINDMILL_KEY } from './questions.js';
import { showTeach } from '../windmill/teach.js';
import { makeEngineer, FT, wind } from './scene.js';
import { makeTowerView, HELD_OFF } from '../windmill/tower3d.js';
import { makeDeckView } from './deck3d.js';
import { makeLoads } from './loads3d.js';
import { makeFall } from './fall.js';
import { makeBuild, fmt, fmtWords, fmtStat } from './build.js';
import * as sound from '../windmill/sound.js';


// the builder's page: the lumber panel on the left, the view on the right (its canvas is the lab's own; in the game
// the canvas is hidden and the game's own shows through the view)
export const MARKUP = `
  <aside id="panel" aria-label="Lumber">
    <header class="pn-head">
      <h1>Lumber</h1>
      <div class="pn-count"><b id="count">60</b> <span id="count-word">full boards left</span></div>
    </header>
    <div class="bench-wrap">
      <div class="bench-label" id="bench-label">8 ft board ×60</div>
      <div class="bench" id="bench">
        <div class="tape" id="tape"></div>
        <div class="board-v" id="bench-board" title="Drag the whole board onto the bridge, or pick a spot and cut it">
          <div class="saw" id="saw"><i></i><span id="saw-label">4 ft | 4 ft</span></div>
        </div>
      </div>
      <div class="bench-empty" id="bench-empty" hidden>No full boards left</div>
    </div>
    <button class="btn cut" id="cut">Cut</button>
    <button class="btn up-next" id="up-next" hidden title="The board on the bench goes up where you left off">Put it up</button>
    <div class="pieces-head">Cut pieces</div>
    <div class="pieces" id="pieces"></div>
    <div class="pieces-empty" id="pieces-empty">Cut pieces wait here. Drag one onto the bridge.</div>
    <div class="planks-head">Deck planks <b id="plank-count">36</b></div>
    <div class="planks-note">2 by 8 inch planks, laid across when both sides reach from bank to bank.</div>
  </aside>
  <main id="view">
    <canvas id="c" aria-label="The river crossing and the bridge"></canvas>
    <svg id="overlay"></svg>
    <div class="gz end sock" id="g-a" hidden title="Drag the foot to another spot"></div>
    <div class="gz end free" id="g-b" hidden title="Drag the free end onto a board"></div>
    <div class="gz arrow" id="g-xp" hidden title="Free end half a foot east (+X)"></div>
    <div class="gz arrow" id="g-xm" hidden title="Free end half a foot west (−X)"></div>
    <div class="gz arrow" id="g-zp" hidden title="Free end half a foot south (+Z)"></div>
    <div class="gz arrow" id="g-zm" hidden title="Free end half a foot north (−Z)"></div>
    <div class="gz arrow" id="g-yp" hidden title="Free end half a foot up (+Y)"></div>
    <div class="gz arrow" id="g-ym" hidden title="Free end half a foot down (−Y)"></div>
    <button class="nail-it" id="nail" hidden aria-label="Nail it" title="Nail it (Enter)"><svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 7"/></svg></button>
    <div class="gz stone" id="bank-w" hidden title="Drag the bank's edge in or out"></div>
    <div class="gz stone" id="bank-e" hidden title="Drag the bank's edge in or out"></div>

    <div class="bar top">
      <div class="stats">
        <div><small>Gap</small><b id="span">16 ft</b></div>
        <div class="st-base"><small>Boards</small><b id="nboards">0</b></div>
        <div><small>Best</small><b id="best">–</b></div>
        <div class="st-top" id="top-at-box" hidden><small id="top-at-label">Top end</small><b id="top-at"></b></div>
      </div>
      <div class="tools">
        <button class="btn" id="undo" title="Take down the last board (Ctrl+Z)">Undo</button>
        <div class="snd"><button class="btn icon" id="mute" aria-label="Sound on or off" title="Sound on/off"><svg viewBox="0 0 24 24"><path class="spk" d="M4 9h4l5-4v14l-5-4H4z"/><path class="wav" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M16 9l6 6M22 9l-6 6"/></svg></button><input type="range" id="vol" min="0" max="100" value="80" aria-label="Volume" title="Volume"></div>
      </div>
    </div>
    <div class="wall-name" id="face-name">Looking north</div>
    <div class="compass" id="compass" aria-label="Compass" title="Which way is north"><svg viewBox="-30 -30 60 60"><circle r="27" class="ring"/><g id="compass-rose"><path d="M0 -21 L5 0 L0 3 L-5 0 Z" class="north"/><path d="M0 21 L5 0 L0 -3 L-5 0 Z" class="south"/><text y="-22" class="n">N</text><text y="27" class="o">S</text><text x="25" y="3" class="o">E</text><text x="-25" y="3" class="o">W</text></g></svg></div>
    <div class="hint-line" id="hint"></div>
    <div class="bar sel" id="sel-bar" hidden>
      <div class="hint" id="sel-hint">This board</div>
      <div class="row"><button class="btn" id="pickup">Take it down</button></div>
    </div>
    <div class="bar sel trim" id="trim-bar" hidden>
      <div class="hint" id="trim-hint"></div>
      <div class="row"><button class="btn" id="trim-saw">✂ Saw off the extra</button><button class="btn" id="trim-keep">Keep it</button></div>
    </div>
    <button class="btn go lay-deck" id="lay-deck" hidden>Lay the deck</button>
    <button class="btn wind cross" id="cross"><svg viewBox="0 0 24 24"><path d="M3 15h18M5 15l3-6h8l3 6M8 9V6M16 9V6"/></svg>Send it across</button>

    <div class="say" id="say" hidden><div class="who">The engineer</div><div id="say-text"></div></div>
    <div class="stage" id="stage" hidden><b id="stage-name"></b><span id="stage-sub"></span><div class="gauge"><i id="stage-bar"></i></div>
      <div class="legend" id="legend" hidden><small>Strain</small><i></i><span><em>green easy</em><em>red breaking</em></span></div></div>
    <div class="card" id="question" hidden></div>
    <div class="card" id="result" hidden></div>
    <div class="flybonus" id="flybonus" hidden>+1 board</div>
    <div class="perf" id="perf" hidden></div>
  </main>
`;

// The lab's own question ladder (questions.js stepLadder: climbing after two right in a row, a step down after a wrong
// answer), kept in localStorage; a first visit starts from the windmill lab's step (readLadder)
export function ladderAsker() {
  let ladder = (() => { try { return readLadder(localStorage.getItem(LADDER_KEY), localStorage.getItem(WINDMILL_KEY)); } catch (e) { return readLadder(null); } })();
  return {
    level: () => ladder.level,
    asked() {},
    answered(q, right) { ladder = stepLadder(ladder, right); try { localStorage.setItem(LADDER_KEY, JSON.stringify(ladder)); } catch (e) { /* the step lasts the visit */ } return ladder.level; },
    state: () => ({ ...ladder }),
  };
}
// The lab's own record of the best rating carried, in localStorage
export function localBest() {
  return {
    read() { try { const b = JSON.parse(localStorage.getItem('bm-bridge-best') || '{}'); return { rating: Number.isInteger(b.rating) ? b.rating : -1, S: +b.S || 0 }; } catch (e) { return { rating: -1, S: 0 }; } },
    write(b) { try { localStorage.setItem('bm-bridge-best', JSON.stringify({ ...b, at: Date.now() })); } catch (e) { /* storage blocked: the record lasts this visit */ } },
  };
}

const DEG = Math.PI / 180;

export function mountBridge(host) {
const { root, scene, camera, yard, asker } = host;
const O = host.origin || new THREE.Vector3();
// (the bridge's frame turned in the world: Q takes a direction in the bridge's frame into the world, QI back)
const Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), host.turn || 0), QI = Q.clone().invert();
const groundY = host.groundY || (() => 0);
const waterY = host.waterY ?? -1e9;
const cw = host.words || ((s) => s);
const params = new URLSearchParams(location.search);
const phone = matchMedia('(max-width: 700px)').matches || /Mobi|Android/i.test(navigator.userAgent);
if (!root.querySelector('#view')) root.innerHTML = cw(MARKUP);   // (the lab page puts it in first, for its canvas)
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
const later = (fn, ms) => setTimeout(() => { if (alive) fn(); }, ms);

const el = {
  view: $('view'), canvas: $('c'), overlay: $('overlay'), hint: $('hint'),
  count: $('count'), countWord: $('count-word'), bench: $('bench'), benchEmpty: $('bench-empty'), benchBoard: $('bench-board'), benchLabel: $('bench-label'),
  tape: $('tape'), saw: $('saw'), sawLabel: $('saw-label'), cutBtn: $('cut'), upNext: $('up-next'), pieces: $('pieces'), piecesEmpty: $('pieces-empty'),
  gA: $('g-a'), gB: $('g-b'), arrows: ['g-xp', 'g-xm', 'g-zp', 'g-zm', 'g-yp', 'g-ym'].map($), nailBtn: $('nail'), bankHandles: [$('bank-w'), $('bank-e')],
  selBar: $('sel-bar'), selHint: $('sel-hint'), panel: $('panel'), trimBar: $('trim-bar'), trimHint: $('trim-hint'), trimSaw: $('trim-saw'), trimKeep: $('trim-keep'),
};

// ── the bridge's drawing, the loads, what falls (in the host's scene, the bridge's own frame) ─────────────────────
const world = yard;
const towerView = makeTowerView(scene);
const deckView = makeDeckView(scene, towerView.strainColor);
const loads = makeLoads(scene, { wait: host.loadsWait || 0, libs: host.libs || null });   // (the game: after the camera's glide in, so loading the people and the wagons doesn't stutter it)
const fall = makeFall(scene, { ground: groundY, water: host.waterY });

const app = {
  el, tower: newBridge(SPAN0, WIDTH), face: 0, phase: 'build', held: null, selected: null, dirty: true, autoScroll: 0,
  lumber: { stack: BOARDS, bench: null, pieces: [] }, placed: [], planks: PLANKS,
};
let engineer = null;
let best = (() => { const b = host.best ? host.best.read() : null; return { rating: b && Number.isInteger(b.rating) ? b.rating : -1, S: (b && +b.S) || 0 }; })();

// ── the camera: always looking at the middle of the gap (X = Z = 0), tipped PITCH down ──────────────────────────────
// While building it moves only when the player moves it (the windmill's rules): a sideways drag walks round, an up and
// down drag slides what it looks at up and down, a pinch or the wheel sets how far back it stands. "Send it across"
// frames the whole bridge once, gliding there.
const PITCH = 24 * DEG;
const DIST = [2.5, 45];
const cam = { az: -0.38, azV: 0, y: 2, yT: 2, dist: 12, distT: 12, pos: new THREE.Vector3(), look: new THREE.Vector3() };
function fitDistance() {
  const aspect = viewAspect(), t = Math.tan(camera.fov / 2 * DEG);
  const hw = (app.tower.S / 2 + (aspect < 0.6 ? 2 : 4)) * FT, hh = 7 * FT;
  return Math.max(hw / (t * aspect), hh / t) + 3 * FT;
}
// the view's own shape (width over height): the host's camera may cover more than the view (the game's whole canvas)
const viewAspect = () => { const r = el.view.getBoundingClientRect(); return r.width / Math.max(1, r.height); };
function resize() {
  if (!alive) return;
  const r = el.view.getBoundingClientRect(), aspect = r.width / Math.max(1, r.height);
  camera.fov = aspect < 0.6 ? 46 : aspect < 1 ? 36 : 30;
  host.fit(r);
  camera.updateProjectionMatrix();
  build && build.renderPanel(); fitStats(); placeFaceName(); app.dirty = true;
}
const topY = () => Math.max(bridgeHeight(app.tower), app.held ? Math.max(app.held.A.Y, app.held.B.Y) : 0) + 4;
const LOW_Y = -5;
const climb = (y, dy) => { let v = y + dy; if (dy > 0) v = Math.min(v, Math.max(topY(), y)); return Math.max(LOW_Y, v); };
let orbiting = false;
function updateCamera(dt) {
  if (app.autoScroll) cam.yT = climb(cam.yT, app.autoScroll * 10 * dt);
  if (!orbiting && Math.abs(cam.azV) > 0.01) { cam.az += cam.azV * dt; cam.azV *= Math.exp(-3.2 * dt); } else if (!orbiting) cam.azV = 0;
  const glide = cam.glide > 0 ? 2.2 : 0;
  // (a glide may swing the camera round too: to azT)
  if (cam.glide > 0 && cam.azT !== undefined) cam.az += angDiff(cam.azT, cam.az) * Math.min(1, dt * 2.2);
  if (cam.glide > 0) cam.glide -= dt; else cam.azT = undefined;
  cam.y += (cam.yT - cam.y) * Math.min(1, dt * (glide || 8));
  cam.dist += (cam.distT - cam.dist) * Math.min(1, dt * (glide || 12));
  updateFace();
  const ly = cam.y * FT, D = cam.dist, c = Math.cos(PITCH);
  // (cam.look and cam.pos are in the bridge's own frame; the camera itself in the scene's world: turned and + O)
  cam.look.set(0, ly, 0);
  cam.pos.set(Math.sin(cam.az) * c * D, ly + Math.sin(PITCH) * D, Math.cos(cam.az) * c * D);
  // (above the land and the water)
  const gy = Math.max(groundY(cam.pos.x, cam.pos.z), waterY) + 0.4; if (cam.pos.y < gy) cam.pos.y = gy;
  camera.position.copy(cam.pos).applyQuaternion(Q).add(O); camera.lookAt(v3.copy(cam.look).applyQuaternion(Q).add(O));
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// which way the view looks at the bridge: from the front, the east end, the back or the west end
const FACE_AZ = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
function updateFace() {
  if (app.phase !== 'build') return;
  const k = ((Math.round(cam.az / (Math.PI / 2)) % 4) + 4) % 4;
  if (k === app.face || Math.abs(angDiff(cam.az, FACE_AZ[k])) > Math.PI / 4 - 0.07) return;
  app.face = k; showFaceName(); app.dirty = true;
}
const TURN_W = 450;
const turnWidth = (r) => Math.max(r.width, TURN_W);
const camOk = () => app.phase === 'build' || app.phase === 'test' || app.phase === 'result';
app.orbit = (dx, dy) => {
  if (!camOk()) return;
  const r = el.view.getBoundingClientRect();
  orbiting = true; cam.azV = 0; app.orbited = true;
  cam.az -= dx / turnWidth(r) * Math.PI * 1.1;
  const ftPerPx = 2 * cam.dist * Math.tan(camera.fov / 2 * DEG) / FT / r.height;
  if (Math.abs(dy) > 0.5) { cam.yT = climb(cam.yT, dy * ftPerPx); cam.y = cam.yT; }
};
const FLICK = 0.25;
app.orbitRelease = (vx) => {
  orbiting = false;
  if (!camOk()) return;
  const r = el.view.getBoundingClientRect();
  if (Math.abs(vx) < FLICK) vx = 0;
  cam.azV = Math.max(-4, Math.min(4, -vx * 1000 / turnWidth(r) * Math.PI * 1.1));
};
Object.defineProperty(app, 'zoom', { get: () => cam.distT });
app.setZoom = (z) => { cam.distT = Math.max(DIST[0], Math.min(DIST[1], z)); };
app.viewAz = () => cam.az;
// a point in the bridge's frame (feet) -> the scene's world (metres); a point in the world (metres) -> the frame (feet)
const v3 = new THREE.Vector3(), w3 = new THREE.Vector3();
const atWorld = (X, Y, Z) => v3.set(X * FT, Y * FT, Z * FT).applyQuaternion(Q).add(O);
const toFrame = (p) => { w3.copy(p).sub(O).applyQuaternion(QI); return { X: w3.x / FT, Y: w3.y / FT, Z: w3.z / FT }; };
app.camDist = (p) => camera.position.distanceTo(atWorld(p.X, p.Y, p.Z));
app.eye = () => toFrame(camera.position);
// (the camera's picture covers host.canvasRect(): the view itself on the lab page, the game's whole canvas in the
// game, the view a part of it. Points on the screen are always said inside the view: its top left is 0, 0.)
const toView = (p) => { const c = host.canvasRect(), r = el.view.getBoundingClientRect(); return { x: c.left - r.left + (p.x + 1) / 2 * c.width, y: c.top - r.top + (1 - p.y) / 2 * c.height }; };
const project = (X, Y, Z) => { atWorld(X, Y, Z).project(camera); const s = toView(v3); s.behind = v3.z > 1; return s; };
app.worldToScreen = (X, Y, Z) => project(X, Y, Z);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const aim = (cx, cy) => { const r = host.canvasRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
app.rayAt = (cx, cy) => { aim(cx, cy); const o = toFrame(ray.ray.origin), d = w3.copy(ray.ray.direction).applyQuaternion(QI); return { O: o, d: { X: d.x, Y: d.y, Z: d.z } }; };
app.viewDir = () => { camera.getWorldDirection(v3).applyQuaternion(QI); return { X: v3.x, Y: v3.y, Z: v3.z }; };
app.lookAt = () => ({ X: cam.look.x / FT, Y: cam.look.y / FT, Z: cam.look.z / FT });
const faceW = asTower(app.tower).W;
app.heldOut = (w) => { const o = faceOf(w, faceW, app.tower.D).out; return { X: o.X * HELD_OFF, Y: o.Y * HELD_OFF, Z: o.Z * HELD_OFF }; };

// ── names ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// (which way the view looks, by the compass: the camera starts on the south side, looking north)
const FACE_NAMES = ['Looking north', 'Looking west', 'Looking south', 'Looking east'].map(cw);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
let faceText = '';
function showFaceName() {
  const txt = app.held && app.phase === 'build' ? cap(cw(placeWords(app.tower, build.worldOf(app.held))).replace(/^the /, '')) : FACE_NAMES[app.face];
  if (txt !== faceText) { faceText = txt; $('face-name').textContent = txt; $('face-name').classList.toggle('is-held', !!app.held); placeFaceName(); }
}
// where the free end of the board in hand is (or a nailed board's top end), from the middle of the gap, to the inch
let topAtText = '';
function showTopAt() {
  const held = app.phase === 'build' && app.held, src = app.phase === 'build' ? (held ? build.worldOf(app.held) : app.selected) : null;
  let txt = '', label = 'Top end';
  if (src) {
    let p = src.a.Y >= src.b.Y ? src.a : src.b;
    if (held) { p = src.b; label = 'Free end'; }
    // (a horizontal board picked out: its east end, or its south end if it runs across the bridge)
    else if (Math.abs(src.a.Y - src.b.Y) < 0.04) { const ew = Math.abs(src.b.X - src.a.X) >= Math.abs(src.b.Z - src.a.Z); p = ew ? (src.a.X >= src.b.X ? src.a : src.b) : (src.a.Z >= src.b.Z ? src.a : src.b); label = ew ? 'East end' : 'South end'; }
    const w = pointWords(p);
    // (the board in hand lying level: said plainly, in place of its height when that is the road's)
    if (held && Math.abs(src.a.Y - src.b.Y) < 1e-6) { if (Math.abs(p.Y) < 1e-6) w[2] = 'level'; else w.push('level'); }
    txt = cw(label + '|' + w.join('|'));
  }
  if (txt === topAtText) return;
  topAtText = txt;
  const box = $('top-at-box'), stats = document.querySelector('.bar.top .stats');
  box.hidden = !txt; stats.classList.toggle('is-coords', !!txt);
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
app.onLumber = (n) => { world.setPile(n); if (ghosts) refreshGhosts(); changed('lumber'); };
app.onSawOff = (len, kept, nailed) => { if (!nailed) say(kept ? `An offcut ${fmtWords(len)} long. It's with your cut pieces.` : 'That bit\'s too short to use. Kindling for the campfire.', { key: kept ? 'offcut' : 'kindling', times: 2, force: true, ms: 4000 }); };
app.onTowerChanged = (src, note) => {
  // (a board sawn shorter: its twins worked out again from it; also when it had none before the saw, sticking out past
  // the water or the bounds, as an end diagonal does until it is sawn off at its joint)
  if (src && ghosts && ghosts.src === src) { const keep = ghosts; makeGhosts(src); ghosts.born = keep.born; }
  else if (src && !ghosts && src === app.lastHand) makeGhosts(src);
  rebuild();
  if (src && app.selected === src) app.select(src, note);
};

// ── the banks: the first step ───────────────────────────────────────────────────────────────────────────────────────
const banksOpen = () => boardCount(app.tower) === 0;
// (the banks' handles: only while nothing is built, and never where the host has fixed the gap)
app.banksOpen = () => !host.span && banksOpen();
// the engineer stands on the west abutment's stone, toward the back: clear of the road the loads come down (a host
// lending its own engineer has him standing there already: ENGINEER_AT)
function placeEngineer() { if (engineer) { const p = engineerAt(app.tower.S, host.engineerSide || -1); engineer.root.position.set(p.x, p.y, p.z); } }
app.setSpan = (S) => {
  if (!banksOpen() || (host.span && S !== host.span)) return false;
  app.tower.S = S; world.setSpan(S); placeEngineer(); sound.stone(4); ghosts = null; rebuild();
  return true;
};
app.onSpanSet = () => {
  changed('span');
  const S = app.tower.S;
  if (S <= 8) say(`${lenWords(S)} across: a board reaches from bank to bank. Easy on wood, but a narrow crossing.`, { key: 'narrow', times: 2, force: true });
  else if (S > 16) say(`${lenWords(S)} across: longer than two boards end to end. Every foot more needs more wood and a stouter frame.`, { key: 'wide', times: 2, force: true });
  else say(`${lenWords(S)} between the stone walls. They'll stay put once the first board is nailed.`, { key: 'span', times: 3, force: true });
};

// ── nailing, picking up, undo ────────────────────────────────────────────────────────────────────────────────────────
let idN = 1;
let lastDown = null;
function addBoard(spec) {
  const rec = makeBoard('b' + idN++, spec.a, spec.b, spec.len);
  // (Undo now takes down this board, not a deck laid before it)
  app.tower.boards.push(rec); app.placed.push({ rec }); lastDown = null; deckJustLaid = false; boardsSince++; return rec;
}
function lastHandLeft() {
  if (app.lastHand && app.tower.boards.includes(app.lastHand)) return;
  const p = [...app.placed].reverse().find((q) => q.hand && app.tower.boards.includes(q.rec));
  app.lastHand = p ? p.rec : null;
}
app.nail = () => {
  const h = app.held; if (!h) return null;
  const spec = build.worldOf(h), first = banksOpen();
  const cs = build.contactsOf(h), nails = cs.length >= 2 ? 2 : 1;
  const rec = addBoard(spec); app.placed[app.placed.length - 1].hand = true;
  app.held = null; sound.hammer(nails); app.lastNails = nails; app.lastHand = rec;
  build.flash(cs);
  makeGhosts(rec);
  rebuild();
  pendingNail = { rec, first };
  later(() => { if (pendingNail && pendingNail.rec === rec && !(build.trim && build.trim.rec === rec)) runPendingNail(); }, 0);
  return rec;
};
let pendingNail = null;
function runPendingNail() { const p = pendingNail; pendingNail = null; if (p && app.tower.boards.includes(p.rec)) afterNail(p.rec, p.first); }
app.onTrimClosed = (rec, how) => {
  if (!pendingNail || pendingNail.rec !== rec) return;
  if (how === 'saw' || how === 'keep') later(runPendingNail, 0); else pendingNail = null;
};
app.select = (src, note) => {
  const again = src && src === app.selected;
  app.selected = src; towerView.highlight(src); markRoad();
  el.selBar.hidden = !src || app.phase !== 'build';
  if (!src) return;
  build.offerTrim(null);
  const noun = roleOf(app.tower, src), where = placeWords(app.tower, src).replace(/^the [a-z ]+?(?=(,|$))/, '');
  const what = cw(cap(noun) + ', ' + fmt(src.len) + (where ? where : ''));
  el.selHint.textContent = note ? `${note} · ${what}` : what; $('say').hidden = true;
  if (note) { el.selHint.classList.remove('is-sawn'); void el.selHint.offsetWidth; el.selHint.classList.add('is-sawn'); }
  if (!again && app.phase === 'build') showTwinsOf(src);
};
function showTwinsOf(src) {
  if (ghosts && ghosts.src === src) { ghosts.born = performance.now(); return; }
  if (!app.tower.boards.includes(src)) return;
  const keep = ghosts; makeGhosts(src); refreshGhosts();
  if (!ghosts || !ghosts.list.length) { ghosts = keep; refreshGhosts(); }
}
app.twinDoubleTap = (cx, cy) => performance.now() - lastTwinTap.t < 450 && Math.hypot(cx - lastTwinTap.x, cy - lastTwinTap.y) < 40 && !!lastTwinTap.g;
function specOnScreen(g) {
  const A = app.worldToScreen(g.a.X, g.a.Y, g.a.Z), B = app.worldToScreen(g.b.X, g.b.Y, g.b.Z);
  const depth = camera.position.distanceTo(atWorld((g.a.X + g.b.X) / 2, (g.a.Y + g.b.Y) / 2, (g.a.Z + g.b.Z) / 2));
  return { A, B, depth, behind: A.behind || B.behind };
}
const distToSeg = (p, A, B) => { const vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((p.x - A.x) * vx + (p.y - A.y) * vy) / L2)); return Math.hypot(A.x + vx * t - p.x, A.y + vy * t - p.y); };
const TWIN_REACH = 22;
// the nailed board under the pointer (not a deck plank): straight under it, else within `slop` pixels round it (a finger
// covers more than a pixel). -> { b (the board's record), P (the spot hit, feet) } or null
app.boardUnder = (cx, cy, slop = 0) => {
  const ms = towerView.meshes();
  const at = (x, y) => { aim(x, y); const h = ray.intersectObjects(ms, false).find((q) => app.tower.boards.includes(q.object.userData.src)); return h ? { b: h.object.userData.src, P: toFrame(h.point) } : null; };
  let b = at(cx, cy); if (b || !slop) return b;
  for (const f of [0.5, 1]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; b = at(cx + Math.cos(a) * slop * f, cy + Math.sin(a) * slop * f); if (b) return b; }
  return null;
};
// the twin a tap means (the windmill's rule), or a nailed board under it (deck planks count: a tap on one offers to
// take up the deck)
function pickAt(cx, cy) {
  aim(cx, cy);
  const hitG = ray.intersectObjects(towerView.ghostMeshes(), false)[0];
  const b = app.held ? null : ray.intersectObjects([...towerView.meshes(), ...deckView.meshes()], false)[0];
  if (hitG && ghosts && (!b || hitG.distance < b.distance + 0.02)) return { g: ghosts.list[hitG.object.userData.ghost] };
  if (ghosts && towerView.ghostMeshes().length) {
    const r = el.view.getBoundingClientRect(), p = { x: cx - r.left, y: cy - r.top };
    let near = null, bd = TWIN_REACH;
    for (const g of ghosts.list) { const o = specOnScreen(g); if (o.behind) continue; const d = distToSeg(p, o.A, o.B); if (d < bd) { bd = d; near = { g, depth: o.depth }; } }
    if (near && b) {
      const src = b.object.userData.src, o = specOnScreen(near.g), M = { x: (o.A.x + o.B.x) / 2, y: (o.A.y + o.B.y) / 2 };
      const spot = near.g.ok && Math.min(Math.hypot(p.x - o.A.x, p.y - o.A.y), Math.hypot(p.x - o.B.x, p.y - o.B.y), Math.hypot(p.x - M.x, p.y - M.y)) < TWIN_REACH;
      if (spot || near.depth < b.distance + 0.05 || src === ghosts.src) return { g: near.g };
    } else if (near) return { g: near.g };
  }
  return b ? { board: b.object.userData.src, plank: !!b.object.userData.plank } : {};
}
let lastTwinTap = { t: 0, x: 0, y: 0, g: null };
app.tapAt = (cx, cy) => {
  if (app.phase !== 'build') return;
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
  if (pick.plank) { app.select(null); offerDeckUp(); return; }
  if (!app.held) app.select(pick.board || null);
};
$('pickup').onclick = () => {
  if (app.phase !== 'build') return;
  if (deckUpOffered) { takeUpDeck(); return; }
  if (app.selected) { const gone = pickUp(app.selected); lastDown = gone.length ? gone : null; }
};
$('undo').onclick = () => {
  if (app.phase !== 'build') return;
  if (app.held) { if (!build.undoHeld()) build.putBack(); return; }
  if (lastDown) { putBackUp(lastDown); lastDown = null; return; }
  if (deckJustLaid) { takeUpDeck(); return; }
  const last = app.placed[app.placed.length - 1]; if (last) pickUp(last.rec);
};
function putBackUp(gone) {
  for (const { rec, entry } of gone) {
    if (!build.woodFor(rec.len) || app.tower.boards.includes(rec)) continue;
    build.payFor(rec.len); app.tower.boards.push(rec); app.placed.push(entry);
  }
  lastHandLeft(); sound.hammer(1); app.select(null); rebuild();
}
// take a board down (back to the pile); anything left holding to nothing that reaches a bank comes down too
function pickUp(src) {
  const t = app.tower, back = [], gone = [];
  const drop = (rec) => {
    const i = t.boards.indexOf(rec); if (i >= 0) { t.boards.splice(i, 1); back.push(rec.len); gone.push({ rec, entry: app.placed.find((p) => p.rec === rec) || { rec } }); }
    app.placed = app.placed.filter((p) => p.rec !== rec);
  };
  drop(src);
  const reach = grounded(t);
  t.boards.filter((b) => !reach.has(b)).forEach(drop);
  for (const len of back) build.returnPiece(len);
  if (ghosts && !t.boards.includes(ghosts.src)) ghosts = null;
  lastHandLeft(); lastDown = null;
  sound.clatter(back[0] || 4, 'set'); app.select(null); rebuild();
  return gone;
}

// ── the deck ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// "Lay the deck" shows once both sides have a horizontal-board line reaching from bank to bank at one height (bridge.js
// deckLine): planks from their own pile, one every 8 inches across the gap. When the boards under it change, the deck
// follows (a new middle board at its height: the planks rest on it too); when its line is broken, it comes up (the
// planks go back on their pile).
let deckJustLaid = false, deckUpOffered = false;
function layDeck() {
  const t = app.tower; if (t.deck || app.phase !== 'build') return false;
  const d = deckLine(t);
  // (not ready: the engineer says what is missing, and ghost lines show where the road-height boards go)
  if (!d.planks) { app.roadGhost = { until: performance.now() + 9000, missing: d.missing }; say(d.why, { key: 'nodeck', times: 99, force: true, ms: 9000 }); return false; }
  if (d.planks.length > app.planks) { say(`That takes ${d.planks.length} planks and the pile has ${app.planks}.`, { force: true, times: 3, key: 'fewplanks' }); return false; }
  app.planks -= d.planks.length; t.deck = d; deckJustLaid = true; world.setPlankPile(app.planks);
  sound.hammer(2); later(() => sound.hammer(2), 300); later(() => sound.hammer(1), 600);
  rebuild();
  say(`${d.planks.length} planks laid, one every 8 inches. Now send something across, or keep building.`, { key: 'decked', times: 2, force: true });
  return true;
}
function takeUpDeck(why = '') {
  const t = app.tower; if (!t.deck) return;
  app.planks += t.deck.planks.length; t.deck = null; deckJustLaid = false; deckUpOffered = false; world.setPlankPile(app.planks);
  el.selBar.hidden = true; sound.clatter(7, 'set'); rebuild();
  if (why) say(why, { force: true, times: 3, key: 'deckup' });
}
function offerDeckUp() {
  deckUpOffered = true; el.selBar.hidden = false; el.selHint.textContent = `The deck: ${app.tower.deck.planks.length} planks`; $('pickup').textContent = 'Take up the deck';
}
// (the one button: "Lay the deck" with no deck down, "Take up the deck" with one: every plank back on its pile, the boards as they were)
$('lay-deck').onclick = () => { sound.audioOn(); if (app.tower.deck) takeUpDeck(); else layDeck(); };
function deckFollows() {
  const t = app.tower; if (!t.deck) return;
  const d = deckLine(t);
  if (!d.planks || Math.abs(d.y - t.deck.y) > 0.06) { takeUpDeck('The deck had nothing to rest on there any more, so I took it up.'); return; }
  t.deck.on = d.on;
}

function rebuild() {
  deckFollows();
  const t = app.tower;
  towerView.rebuild(asTower(t)); towerView.nails.visible = true; towerView.highlight(app.selected); towerView.showHead(false);
  deckView.rebuild(t.deck);
  $('span').innerHTML = fmtStat(t.S);
  $('nboards').textContent = String(boardCount(t)); $('plank-count').textContent = String(app.planks);
  showBest();
  refreshGhosts();
  // ("Lay the deck" shows as soon as anything is built; it is ready once both sides reach bank to bank at road height)
  const dl = !t.deck && boardCount(t) > 0 ? deckLine(t) : null;
  $('lay-deck').hidden = (!dl && !t.deck) || app.phase !== 'build';
  $('lay-deck').textContent = t.deck ? 'Take up the deck' : 'Lay the deck';
  $('lay-deck').classList.toggle('is-not-ready', !!dl && !dl.planks);
  if (dl && dl.planks) app.roadGhost = null;
  markRoad();
  el.view.classList.toggle('has-deck-btn', !$('lay-deck').hidden);
  if (!deckUpOffered) $('pickup').textContent = 'Take it down';
  app.dirty = true;
  changed('build');
}
// THE ROAD: with the deck laid, a board passing through the roadway (between the two sides, from the deck up to the
// tallest load) is in the loads' way: tinted red, with a tag (build.js draws it) and a word from the engineer the first
// time. The test stops a load on the bank for such a board; this says so sooner.
const ROADWAY = { wide: Math.max(...LOADS.map((L) => L.wide)), tall: Math.max(...LOADS.map((L) => L.tall)) };
const roadMats = new Map();
let roadWas = '';
function markRoad() {
  const t = app.tower;
  app.inRoad = t.deck ? inTheWay(t, ROADWAY) : [];
  for (const id of app.inRoad) {
    const b = towerView.boards.get(id); if (!b) continue;
    let m = roadMats.get(b.mat); if (!m) { m = new THREE.MeshLambertMaterial({ map: b.mat.map, color: 0xff9a8c, emissive: 0x8a1a0c, emissiveIntensity: 0.45 }); roadMats.set(b.mat, m); }
    b.mesh.material = m;
  }
  const key = app.inRoad.join(',');
  if (key && key !== roadWas && app.phase === 'build') say(`${app.inRoad.length === 1 ? 'That board is' : 'Those boards are'} in the road: the loads would run into ${app.inRoad.length === 1 ? 'it' : 'them'}. A wagon needs the deck clear ${lenWords(ROADWAY.wide)} wide and ${lenWords(ROADWAY.tall)} up.`, { key: 'inroad', times: 3, force: true, ms: 8000 });
  roadWas = key;
}
function showBest() { $('best').textContent = best.rating >= 0 ? LOADS[best.rating].short : '–'; placeFaceName(); }
function fitStats() {
  const box = document.querySelector('.bar.top .stats'); if (!box) return;
  box.classList.remove('is-tight');
  if (box.scrollWidth > box.clientWidth + 0.5) box.classList.add('is-tight');
}
const statsWatch = new MutationObserver(() => { if (alive) fitStats(); });
statsWatch.observe(root.querySelector('.bar.top .stats'), { subtree: true, childList: true, characterData: true });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) fitStats(); });
function placeFaceName() {
  const v = el.view.getBoundingClientRect(), b = document.querySelector('.bar.top .stats').getBoundingClientRect();
  if (b.height) $('face-name').style.top = Math.round(b.bottom - v.top + 6) + 'px';
  const hint = el.hint; hint.style.top = '';
  if (matchMedia('(max-width: 700px)').matches && b.height) {
    const n = $('face-name'), nb = n.hidden ? null : n.getBoundingClientRect(), under = nb && nb.height ? nb.bottom : b.bottom;
    hint.style.top = Math.max(80, Math.round(under - v.top + 5)) + 'px';
  }
}

// ── the twins: the same board on the other side, at the other end, and both ──────────────────────────────────────
let ghosts = null;
const GHOST_STAY = 16000, GHOST_FADE = 5000;
function makeGhosts(rec) {
  ghosts = { src: rec, list: twinsOf(app.tower, rec), born: performance.now() };
  // (more twins than wood: say how many there are and how many boards are left; building them all builds the nearest)
  const n = ghosts.list.length, left = build.boardsLeft ? build.boardsLeft(rec.len) : n;
  if (n > 3 && left < n) say(`${n} twins, ${left} board${left === 1 ? '' : 's'} left: building them all builds the ${left} nearest.`, { key: 'twins-wood', times: 3, force: true, ms: 6000 });
}
function refreshGhosts() {
  if (!ghosts) { towerView.setGhosts([]); return; }
  const t = app.tower;
  ghosts.list = ghosts.list.filter((g) => !spotTaken(t, g));
  for (const g of ghosts.list) {
    const holds = touchesAny(t, g), wood = build.woodFor(g.len);
    g.ok = holds && !!wood; g.reason = !holds ? 'nothing to nail to' : !wood ? 'no wood left' : '';
  }
  if (!ghosts.list.length) ghosts = null;
  towerView.setGhosts(ghosts ? ghosts.list : []);
}
app.ghostList = () => (ghosts ? ghosts.list : []);
function confirmGhost(g, delay = 0) {
  if (!g || !g.ok || !ghosts) return false;
  const paid = build.payFor(g.len); if (!paid) { refreshGhosts(); return false; }
  if (paid.cut && paid.from < BOARD_FT - 0.01) say(`Sawed a piece ${fmtWords(paid.from)} long down to ${fmtWords(g.len)} for that twin. The offcut, ${fmtWords(paid.from - g.len)}, is with your cut pieces.`, { key: 'twin-saw', times: 3, force: true, ms: 5000 });
  const rec = addBoard(g);
  later(() => sound.hammer(isPost(g) ? 1 : 2), delay + (paid.cut ? 900 : 0));
  build.flash([rec.a, rec.b]);
  ghosts.born = performance.now(); said.twinsBuilt = (said.twinsBuilt || 0) + 1;
  rebuild();
  if (!said.twinTip && app.placed.length >= 2) { said.twinTip = 1; later(() => say('Every board comes off your stack, twins too. Count your wood before you build them all.', { key: 'twin-wood', times: 1 }), 1500); }
  return true;
}
function confirmAll() {
  let n = 0;
  for (let guard = 0; guard < 60 && ghosts; guard++) { const g = ghosts.list.find((q) => q.ok); if (!g) break; confirmGhost(g, Math.min(n, 8) * 450); n++; }
  return n;
}

// ── the engineer's word: friendly, now and then, never twice in a row the same ──────────────────────────────────────
const said = {}; let sayTimer = null, lastSay = 0;
function say(text, { key = text, times = 2, force = false, ms = 7000 } = {}) {
  const now = performance.now();
  if ((said[key] || 0) >= times || (!force && now - lastSay < 5000)) return false;
  said[key] = (said[key] || 0) + 1; lastSay = now;
  $('say-text').textContent = cw(spellUnits(text)); $('say').hidden = false;
  clearTimeout(sayTimer); sayTimer = later(() => { $('say').hidden = true; }, ms);
  gesture('Interact');
  return true;
}
let gestureTimer = null;
function gesture(name, ms = 1700) {
  if (!engineer || !engineer.play) return false;
  const ok = engineer.play(name, { once: true, fade: 0.2 });
  clearTimeout(gestureTimer); gestureTimer = later(() => { if (engineer) engineer.play('Idle', { fade: 0.4 }); }, ms);
  return ok;
}
const slopeDeg = (b) => Math.atan2(Math.abs(b.b.Y - b.a.Y), Math.hypot(b.b.X - b.a.X, b.b.Z - b.a.Z)) / DEG;
const isBrace = (b) => !isLevelB(b) && !isUprightB(b);
app.idleHint = () => {
  const ok = ghosts ? ghosts.list.filter((g) => g.ok) : [];
  if (ok.length) {
    const r = el.view.getBoundingClientRect(), src = specOnScreen(ghosts.src);
    const seen = ok.some((g) => { const o = specOnScreen(g), mx = (o.A.x + o.B.x) / 2, my = (o.A.y + o.B.y) / 2; if (o.behind || mx < 0 || mx > r.width || my < 50 || my > r.height) return false; return !(distToSeg(o.A, src.A, src.B) < 8 && distToSeg(o.B, src.A, src.B) < 8); });
    if (!seen) return `${ok.length === 1 ? 'Its twin glows' : `${ok.length} twins glow`} round the bridge: drag sideways to walk round and tap them`;
    if ((said.twinsBuilt || 0) < 3) return 'Tap a glowing twin to build it · double-tap builds them all';
  }
  if (app.inRoad && app.inRoad.length) return 'A board is in the road: the loads would run into it';
  if (!app.tower.deck && !$('lay-deck').hidden && !$('lay-deck').classList.contains('is-not-ready')) return 'Both sides reach bank to bank at road height: lay the deck';
  if (!app.orbited && boardCount(app.tower) > 0) return 'Drag to walk round the bridge, and up and down';
  return '';
};

// the engineer's questions (the windmill's rules: one at a hand-nailed board once two hand nails and three boards in all
// have gone up since the last; a right answer earns a spare board, at most BONUS_MAX, never said)
let boardsSince = 0, handSince = 0, bonusEarned = 0, lastPrompt = null;
// (the step to ask at: the host's asker says, afresh for every question)
const stepNow = () => Math.max(1, Math.min(LADDER_TOP, Math.round(asker.level()) || 1));
function questionFor(rec, { slant, bay, tris }) {
  const L = stepNow();
  let q = null;
  if (Math.random() < 0.6) {
    if (L >= 6) {
      if (slant) { const r = reachQuestion(rec.len, Math.hypot(rec.b.X - rec.a.X, rec.b.Z - rec.a.Z)); if (r && r.kind === 'slope') q = r; }
      if (!q && bay) q = bayQuestion(bay.w, bay.h, bay.y0);
      if (!q && tris.length) q = makeQuestion(tris, rec, Math.random, 'length');
    } else if (L === 5 && tris.length) q = makeQuestion(tris, rec, Math.random, 'angle');
    if (q && q.prompt === lastPrompt) q = null;
  }
  q = q || ladderQuestion(L);
  lastPrompt = q.prompt;
  return { ...q, level: L, topic: topicOf(q) };
}
function afterNail(rec, first) {
  const t = app.tower, post = isPost(rec), level = isLevelB(rec), slant = !post && isBrace(rec);
  const bay = level ? bayUnder(rec) : null, tris = !post ? trianglesOf(asTower(t), rec) : [];
  handSince++;
  if (params.has('askall') || questionDue(handSince, boardsSince)) { const q = questionFor(rec, { slant, bay, tris }); later(() => ask(q), 450); boardsSince = 0; handSince = 0; return; }
  const sup = supportsOf(t, rec);
  if (first) {
    say(sup.length && level ? 'A board resting on the bank. Run horizontal boards from bank to bank on both sides, north and south, at road height: the deck rests on those.'
      : sup.some((s) => s.kind === 'face') ? 'A foot set in a notch in the stone wall: it can push hard into the stone, and the stone pushes back.'
        : 'Good start. The deck rests on horizontal boards reaching from bank to bank, on both sides.', { force: true, ms: 9000 });
    return;
  }
  if (slant && tris.length) { say('A diagonal makes a triangle, and a triangle can\'t fold. That\'s what holds a bridge up.', { key: 'tri', times: 1 }); return; }
  if (slant && !tris.length) { say('That diagonal makes no triangle yet: nail its ends where two boards meet.', { key: 'notri', times: 2 }); return; }
  if (level && Math.abs(rec.a.Z - rec.b.Z) > 1) { say('A board across the bridge ties the two sides together. Mind the height: a wagon is 9½ feet tall.', { key: 'across', times: 2 }); return; }
  if (post) { say('A post, straight up. On its own it holds the boards apart; with a diagonal it makes triangles.', { key: 'post', times: 1 }); return; }
  if (app.lumber.stack === 0 && !app.lumber.bench && app.lumber.pieces.length <= 1) say('That\'s the last of the lumber. Send something across when you\'re ready.', { key: 'last', times: 1 });
}
// the opening a horizontal board closes (posts under both its ends, down to a horizontal board or a bank): the
// windmill's, for the panel question
function bayUnder(me) {
  const t = app.tower, y = (me.a.Y + me.b.Y) / 2;
  const postAt = (p, top) => t.boards.find((o) => o !== me && isPost(o) && Math.abs(o.a.X - p.X) < 0.2 && Math.abs(o.a.Z - p.Z) < 0.2 && Math.min(o.a.Y, o.b.Y) < top - 0.05 && Math.max(o.a.Y, o.b.Y) >= top - 0.05);
  const down = (E) => { let b = y, firstP = null; for (let g = 0; g < 20; g++) { const o = postAt(E, b); if (!o) break; firstP = firstP || o; b = Math.min(o.a.Y, o.b.Y); } return { b, post: firstP }; };
  const L = down(me.a), R = down(me.b);
  if (!L.post || !R.post || L.b > y - 0.3 || R.b > y - 0.3) return null;
  let y0 = Math.max(L.b, R.b);
  for (const s of t.boards) { if (s === me || !isLevelB(s)) continue; const sy = (s.a.Y + s.b.Y) / 2; if (sy < y - 0.3 && sy > y0 && touch3(s, L.post).length && touch3(s, R.post).length) y0 = sy; }
  return { y0, h: y - y0, w: Math.hypot(L.post.a.X - R.post.a.X, L.post.a.Z - R.post.a.Z) };
}

// ── a math question card (the windmill's, with the bridge's panel pictures) ───────────────────────────────────────
let curQ = null;
const PRAISE = ['Right! Nice work.', 'Right! Sharp eye.', 'Right! Well done.', 'Right! You have it.'];
function ask(q, again = false) {
  if (app.phase !== (again ? 'question' : 'build')) return;
  curQ = q;
  app.phase = 'question'; app.select(null);
  const card = $('question');
  // (the stars: the step the question was made at)
  const L = q.level || stepNow();
  const steps = `<div class="steps" aria-label="question step ${L} of ${LADDER_TOP}">${'★'.repeat(L)}${'☆'.repeat(LADDER_TOP - L)}</div>`;
  const sub = bonusEarned < BONUS_MAX ? '<div class="sub">Get it right and the engineer adds a board to your stack.</div>' : '';
  card.innerHTML = `${steps}<h2>${q.title || (q.bay ? 'How long a diagonal?' : 'A triangle!')}</h2>${sub}
    ${q.svg || (q.kind === 'slope' ? slopePic(q.pic) : q.pts ? trianglePic(q) : '')}<p>${q.prompt}</p>
    <div class="choices${q.labels ? ' is-words' : ''}" style="grid-template-columns: repeat(${q.labels && q.choices.length === 4 ? 2 : q.choices.length}, 1fr)">${q.choices.map((c, i) => `<button data-v="${c}">${q.labels ? q.labels[i] : c + q.unit}</button>`).join('')}</div>
    <div class="why" hidden></div><div class="row"><button class="btn" id="q-teach">Teach me</button><button class="btn go" id="q-ok" hidden>Back to building</button></div>`;
  card.hidden = false; card.scrollTop = 0;
  if (asker.asked) asker.asked(q);
  if (host.speak) host.speak(q.prompt);
  if (!again) gesture('Interact');
  const done = () => { card.hidden = true; app.phase = 'build'; if (ghosts) ghosts.born = performance.now(); };
  card.querySelector('#q-ok').onclick = done;
  card.querySelector('#q-teach').onclick = () => teach(q.topic || topicOf(q), done);
  card.querySelectorAll('.choices button').forEach((b) => b.onclick = () => {
    const right = b.dataset.v === String(q.answer);
    card.querySelectorAll('.choices button').forEach((x) => { x.disabled = true; if (x.dataset.v === String(q.answer)) x.classList.add('is-right'); });
    const why = card.querySelector('.why'); why.hidden = false;
    const was = L, now = asker.answered(q, right);
    changed('answer');
    if (right) {
      sound.chime();
      const up = now > was ? ' Next one is a step harder.' : '';
      if (earnsBoard(bonusEarned, right)) {
        bonusEarned++;
        why.innerHTML = `<b>Right!</b> ${q.why} The engineer adds a fresh board to your stack.${up}`;
        build.giveBoard();
        const f = $('flybonus'); f.hidden = false; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); later(() => { f.hidden = true; }, 1300);
      } else why.innerHTML = `<b>${PRAISE[Math.floor(Math.random() * PRAISE.length)]}</b> ${q.why}${up}`;
      card.querySelector('#q-teach').hidden = true;
    } else { b.classList.add('is-wrong'); sound.soft(); why.innerHTML = `Not quite. ${q.why}${helperPic(q)}`; }
    card.querySelector('#q-ok').hidden = false;
  });
}
function teach(topic, back) {
  const S = stepNow(), ex = questionOf(topic, S), card = $('question');
  showTeach(card, { title: 'How it works', rule: ex.rule, picture: lessonPic(ex), example: ex.prompt, steps: ex.steps,
    answer: ex.labels ? ex.labels[ex.choices.indexOf(ex.answer)] : ex.unit === '°' ? ex.answer + '°' : ex.kind === 'slope' ? fmt(ex.answer / 12) : ex.answer + ex.unit },
  { onTry: () => { const T = stepNow(); ask({ ...questionOf(topic, T), topic, level: T }, true); }, onBack: back });
}
function lessonPic(q) {
  if (q.lessonPic) return q.lessonPic;
  if (q.svg) return q.helper && q.helper.kind === 'svg' ? q.helper.svg : q.svg;
  if (q.pts) { const fill = (l) => (l === '?' ? `${q.answer}${q.unit === '°' ? '°' : ' ft'}` : l); return trianglePic({ ...q, sideLabels: q.sideLabels.map(fill), angleLabels: q.angleLabels.map(fill) }); }
  if (q.kind === 'slope') return slopePic(q.pic) + helperPic(q);
  return '';
}
function trianglePic(q) {
  const pts = q.pts, xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min(240 / Math.max(0.1, maxX - minX), 118 / Math.max(0.1, maxY - minY));
  const P = pts.map((p) => ({ x: 40 + (p.x - minX) * s + (240 - (maxX - minX) * s) / 2, y: 154 - (p.y - minY) * s - (118 - (maxY - minY) * s) / 2 }));
  const cx = (P[0].x + P[1].x + P[2].x) / 3, cy = (P[0].y + P[1].y + P[2].y) / 3;
  let out = `<svg class="pic" viewBox="0 0 320 186"><polygon points="${P.map((p) => p.x + ',' + p.y).join(' ')}" fill="rgba(210,165,113,.35)" stroke="#6d4b2b" stroke-width="5" stroke-linejoin="round"/>`;
  q.sideLabels.forEach((l, i) => { if (!l) return; const a = P[i], b = P[(i + 1) % 3], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1;
    out += `<text x="${mx + dx / d * 20}" y="${my + dy / d * 20 + 6}" text-anchor="middle" font-family="Bitter, Georgia, serif" font-weight="700" font-size="18" fill="${l === '?' ? '#b0401f' : '#2b2219'}">${l}</text>`; });
  q.angleLabels.forEach((l, i) => { if (!l) return; const p = P[i], dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy) || 1;
    out += `<text x="${p.x + dx / d * 30}" y="${p.y + dy / d * 30 + 6}" text-anchor="middle" font-family="Bitter, Georgia, serif" font-weight="700" font-size="17" fill="${l === '?' ? '#b0401f' : '#2b2219'}">${l}</text>`; });
  if (q.square !== undefined) { const p = P[q.square], a = P[(q.square + 1) % 3], b = P[(q.square + 2) % 3], ua = norm(a.x - p.x, a.y - p.y), ub = norm(b.x - p.x, b.y - p.y), r = 13;
    out += `<path d="M${p.x + ua.x * r} ${p.y + ua.y * r} L${p.x + ua.x * r + ub.x * r} ${p.y + ua.y * r + ub.y * r} L${p.x + ub.x * r} ${p.y + ub.y * r}" fill="none" stroke="#2b2219" stroke-width="2"/>`; }
  return out + '</svg>';
}
const norm = (x, y) => { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; };
const num2 = (v) => { const f = Math.floor(v + 1e-9); return Math.abs(v - f - 0.5) < 1e-6 ? (f || '') + '½' : String(Math.round(v * 100) / 100); };
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
function helperPic(q) {
  if (!q.helper) return '';
  if (q.helper.kind === 'svg') return q.helper.svg;
  if (q.helper.kind === 'legsq') {
    const { L, r, h, exact } = q.helper;
    if (exact) return helperPic({ helper: { kind: 'squares', a: Math.min(r, Math.round(h)), b: Math.max(r, Math.round(h)), c: L } });
    return `<svg class="pic" viewBox="0 0 320 128"><text x="160" y="30" text-anchor="middle" ${PIC_FONT} font-size="17" fill="#2b2219">${num2(L)}×${num2(L)} − ${num2(r)}×${num2(r)} = ${num2(L * L - r * r)}</text>
      <text x="160" y="58" text-anchor="middle" ${PIC_FONT} font-size="17" fill="#2b2219">${h.toFixed(2)} × ${h.toFixed(2)} ≈ ${(h * h).toFixed(1)}</text>
      <text x="160" y="88" text-anchor="middle" ${PIC_FONT} font-size="14" fill="#6d4b2b">so the top is about ${fmtWords(h)} up:</text>
      <text x="160" y="110" text-anchor="middle" ${PIC_FONT} font-size="14" fill="#6d4b2b">less than the board is long</text></svg>`;
  }
  if (q.helper.kind === 'angles') {
    const [a, b] = q.helper.shown, c = q.helper.answer, cx = 160, cy = 120, r = 90;
    const wedge = (from, to, col, label) => { const f = Math.PI - from * DEG, t = Math.PI - to * DEG, x1 = cx + Math.cos(f) * r, y1 = cy - Math.sin(f) * r, x2 = cx + Math.cos(t) * r, y2 = cy - Math.sin(t) * r;
      const m = (f + t) / 2, lx = cx + Math.cos(m) * r * 0.62, ly = cy - Math.sin(m) * r * 0.62 + 6;
      return `<path d="M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${col}" stroke="#2b2219" stroke-width="1.5"/><text x="${lx}" y="${ly}" text-anchor="middle" font-weight="700" font-size="15" font-family="Bitter, Georgia, serif">${label}°</text>`; };
    return `<svg class="pic" viewBox="0 0 320 140">${wedge(0, a, '#e9c98f', a)}${wedge(a, a + b, '#cfe0b0', b)}${wedge(a + b, 180, '#f0b9a3', c)}
      <line x1="40" y1="${cy}" x2="280" y2="${cy}" stroke="#2b2219" stroke-width="3"/><text x="160" y="138" text-anchor="middle" font-size="13" font-family="Bitter, Georgia, serif">the three corners together make a straight line: 180°</text></svg>`;
  }
  const { a, b, c } = q.helper, u = Math.min(20, 100 / c), mid = 120 - c * u / 2 + 6;
  const sq = (n, x, col) => { let g = `<rect x="${x}" y="${120 - n * u}" width="${n * u}" height="${n * u}" fill="${col}" stroke="#2b2219" stroke-width="1.5"/>`; for (let i = 1; i < n; i++) g += `<line x1="${x + i * u}" y1="${120 - n * u}" x2="${x + i * u}" y2="120" stroke="rgba(0,0,0,.15)"/><line x1="${x}" y1="${120 - i * u}" x2="${x + n * u}" y2="${120 - i * u}" stroke="rgba(0,0,0,.15)"/>`; return g + `<text x="${x + n * u / 2}" y="136" text-anchor="middle" font-weight="700" font-size="13" font-family="Bitter, Georgia, serif">${n}×${n}=${n * n}</text>`; };
  const x2 = 20 + a * u + 22, x3 = x2 + b * u + 34;
  return `<svg class="pic" viewBox="0 0 ${Math.max(320, x3 + c * u + 10)} 142">${sq(a, 20, '#e9c98f')}<text x="${20 + a * u + 11}" y="${mid}" text-anchor="middle" font-size="20" font-weight="700">+</text>${sq(b, x2, '#cfe0b0')}<text x="${x2 + b * u + 17}" y="${mid}" text-anchor="middle" font-size="20" font-weight="700">=</text>${sq(c, x3, '#f0b9a3')}</svg>`;
}

// ── the test: "Send it across" ───────────────────────────────────────────────────────────────────────────────────────
$('cross').onclick = () => startTest();
function startTest() {
  if (app.phase !== 'build') return;
  sound.audioOn();
  if (!boardCount(app.tower)) { say('Build something first! Horizontal boards from bank to bank make a start.', { force: true, times: 99 }); return; }
  if (!app.tower.deck) { say(deckLine(app.tower).planks ? 'Lay the deck first: there\'s nothing to walk on yet.' : `${deckLine(app.tower).why}.`, { force: true, times: 99, ms: 6000 }); return; }
  if (app.held) build.putBack();
  app.select(null); deckUpOffered = false;
  app.phase = 'test'; cam.azV = 0; ghosts = null; refreshGhosts(); build.offerTrim(null);
  frameBridge();
  $('say').hidden = true; $('cross').hidden = true; $('lay-deck').hidden = true; el.view.classList.remove('has-deck-btn'); el.selBar.hidden = true;
  crossing.start();
}
// the whole bridge in view, and the bank the loads come from: gliding there over a second or so
// (the gap and a good stretch of both banks, where the loads come and go, and from the bridge's lowest board up to the
// covered wagon's top)
// (on a narrow upright screen the camera also swings round toward the west end (0.8 of a quarter turn), so more of the bridge runs into
// the view instead of across a strip it would barely fit)
function frameBridge() {
  const t = app.tower, H = Math.max(9.5, bridgeHeight(t)), lo = Math.min(0, ...t.boards.flatMap((b) => [b.a.Y, b.b.Y]));
  let az = cam.az;
  const aspect = viewAspect();
  if (aspect < 0.7) { const k = Math.round((cam.az + 0.8) / (2 * Math.PI)); az = -0.8 + k * 2 * Math.PI; cam.azT = az; }
  // (the gap and a stretch of both banks; on a phone, the bridge itself and a little more)
  const narrow = aspect < 0.7, along = t.S + (narrow ? 4 : 22), wide = t.D + (narrow ? 2 : 6);
  const across = Math.abs(Math.cos(az)) * along + Math.abs(Math.sin(az)) * wide;
  const tv = Math.tan(camera.fov / 2 * DEG), th = tv * aspect;
  const need = Math.max(((H - lo) * 0.55 + 1) * FT / tv, across / 2 * FT / th) + 2 * FT;
  cam.glide = 1.6; cam.yT = lo + (H - lo) * 0.3; cam.distT = Math.max(DIST[0], Math.min(DIST[1], need));
}
const fallView = { boards: { get: (k) => towerView.boards.get(k) || deckView.boards.get(k) }, drawnNow: (k) => towerView.drawnNow(k) || deckView.drawnNow(k) };
const crossing = makeCrossing(app, {
  towerView, deckView, loads, fall, say, gesture, view: () => fallView, words: cw,
  record: (rating, S) => {
    const newBest = rating > best.rating;
    if (newBest) { best = { rating, S }; if (host.best) host.best.write(best); }
    showBest();
    return { best, newBest };
  },
  pay: host.pay || null,
  done: (card) => { changed('test'); if (host.tested) host.tested(card); },
  keep: keepBuilding,
  fresh: (line) => engineerBeat(line),
});
function keepBuilding({ keep, back, planksBack, kindling }) {
  const t = app.tower;
  t.boards = t.boards.filter((b) => keep.has(b.id));
  app.placed = app.placed.filter((p) => keep.has(p.rec.id));
  // (the planks that fell whole go back on their pile; snapped ones are gone)
  if (t.deck) { const left = t.deck.planks.filter((p) => keep.has(p.id)); t.deck.planks = left; if (!left.length) t.deck = null; }
  app.planks += planksBack || 0; world.setPlankPile(app.planks);
  for (const len of back) build.returnPiece(len);
  lastHandLeft(); lastDown = null;
  backToBuild();
  // a deck with gaps in it: taken up and laid again whole, if the boards under it still reach (its planks back on the
  // pile, then laid: one rebuild, layDeck's, or one here if it can't be laid again)
  if (t.deck && t.deck.planks.length < (deckLine(t).planks || []).length) {
    app.planks += t.deck.planks.length; t.deck = null; deckJustLaid = false; deckUpOffered = false; el.selBar.hidden = true; world.setPlankPile(app.planks);
    if (!layDeck()) rebuild();
  }
  if (back.length || kindling) say(`${back.length ? `${back.length === 1 ? 'The board' : `The ${back.length} boards`} that fell whole ${back.length === 1 ? 'is' : 'are'} back on your pile.` : ''}${kindling ? ` ${kindling === 1 ? 'The one' : kindling} that snapped went for kindling.` : ''} Build her up again!`.trim(), { force: true, times: 99, ms: 7000, key: 'keep' });
}
function engineerBeat(line) {
  app.phase = 'engineer';
  $('say-text').textContent = cw(spellUnits(line)); $('say').hidden = false; clearTimeout(sayTimer);
  gesture('Wave', 2000) || gesture('Interact');
  later(() => { fall.clear(); resetAll(); changed('fresh'); }, 700);
  later(() => { $('say').hidden = true; backToBuild(); }, 1900);
}
function backToBuild() {
  app.phase = 'build'; cam.azV = 0;
  towerView.setBend(null); towerView.setStrain(null); towerView.setSpots(null); deckView.setBend(null); deckView.setStrain(null);
  $('cross').hidden = false; app.dirty = true; rebuild();
}
function resetAll(S = app.tower.S) {
  app.tower = newBridge(S, WIDTH); app.placed = []; app.held = null; app.selected = null; ghosts = null; app.lastHand = null; lastDown = null;
  app.planks = PLANKS; deckJustLaid = false; deckUpOffered = false;
  world.setSpan(S); world.setPlankPile(app.planks); placeEngineer();
  build.freshStack(BOARDS);
  showFaceName(); rebuild(); boardsSince = 0; handSince = 0; bonusEarned = 0;
}
// a bridge already begun (the host's saved one): its boards, its deck, the lumber and planks left, the boards earned
function restore(st) {
  const t = cleanBridge(st.bridge);
  app.tower = newBridge(host.span || t.S, WIDTH); app.placed = []; app.held = null; app.selected = null; ghosts = null; app.lastHand = null; lastDown = null;
  build.freshStack(Math.max(0, st.lumber && Number.isFinite(st.lumber.full) ? st.lumber.full : BOARDS));
  for (const len of (st.lumber && st.lumber.pieces) || []) if (len > 0) build.returnPiece(len);
  for (const b of t.boards) addBoard(b);
  app.planks = Number.isFinite(st.planks) ? Math.max(0, st.planks) : PLANKS;
  world.setSpan(app.tower.S); world.setPlankPile(app.planks); placeEngineer();
  rebuild();
  // (the deck laid again where it was, its planks already paid for)
  if (st.deck) { const d = deckLine(app.tower); if (d.planks) { app.tower.deck = d; rebuild(); } else app.planks += st.deck; world.setPlankPile(app.planks); }
  boardsSince = 0; handSince = 0; deckJustLaid = false; lastDown = null; bonusEarned = Math.max(0, Math.min(BONUS_MAX, st.bonus | 0));
}

// ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (the host calls frame(dt) every frame, then draws: the lab page with its own renderer, the game with the valley)
let focusAt = 0;
// (a narrow upright view with the test's card up over its lower half: the camera looks a little lower, so the bridge
// slides up into the part of the view above the card; folded or gone, it looks back up)
let cardLift = 0;
function liftForCard() {
  if (app.phase !== 'result' && !cardLift) return;
  const r = $('result'), want = app.phase === 'result' && !r.hidden && !r.classList.contains('is-folded') && viewAspect() < 0.7;
  const lift = want ? 0.34 * cam.distT * Math.tan(camera.fov / 2 * DEG) / Math.cos(PITCH) / FT : 0;
  if (Math.abs(lift - cardLift) < 0.01) return;
  cam.yT -= lift - cardLift; cardLift = lift;
}
function frame(dt) {
  if (!alive) return;
  dt = Math.min(0.05, dt);
  crossing.frame(dt);
  liftForCard();
  focusAt -= dt;
  if (focusAt <= 0) {
    focusAt = 0.25;
    const card = app.phase === 'result' && !$('result').hidden ? crossing.card : null;
    towerView.setFocus(card && card.focusIds && card.focusIds.length ? card.focusIds : null);
  }
  const turning = orbiting || Math.abs(cam.azV) > 0.01;
  if (ghosts && (app.phase !== 'build' || turning)) { if (ghosts.paused === undefined) ghosts.paused = performance.now() - ghosts.born; ghosts.born = performance.now() - ghosts.paused; }
  else if (ghosts) ghosts.paused = undefined;
  if (ghosts) { const age = performance.now() - ghosts.born, f = age < GHOST_STAY ? 1 : 1 - (age - GHOST_STAY) / GHOST_FADE; if (f <= 0) { ghosts = null; refreshGhosts(); } else towerView.fadeGhosts(f); }
  world.update(dt, cam.look, cam.pos);
  updateCamera(dt);
  if (engineer) {
    engineer.update(dt);
    // (he turns half toward the camera, half toward the middle of the gap)
    const p = engineer.root.position, want = Math.atan2(cam.pos.x - p.x, cam.pos.z - p.z) * 0.5 + Math.atan2(-p.x, -p.z) * 0.5;
    engineer.root.rotation.y += angDiff(want, engineer.root.rotation.y) * Math.min(1, dt * 3);
  }
  towerView.update(dt, wind.level);
  build.frame();
  const h = app.held && app.phase === 'build' ? app.held : null, hi = build.heldInfo;
  if (h) towerView.showHeld({ ...build.worldOf(h), glowA: !!(hi && hi.glowA), glowB: !!(hi && hi.glowB) });
  else towerView.showHeld(null);
  showFaceName();
  showTopAt();
  turnCompass();
  $('face-name').hidden = app.phase !== 'build';
}

// ── the compass: its N turned toward north as the view shows it ─────────────────────────────────────────────────────
// (north in the bridge's frame: -Z on the lab page; where the host's world has it when the frame is turned)
const NORTH = new THREE.Vector3(0, 0, -1).applyQuaternion(QI);
const rose = $('compass-rose');
let roseDeg = null;
function turnCompass() {
  const L = cam.look, X = L.x / FT, Y = L.y / FT, Z = L.z / FT, O2 = project(X, Y, Z), N = project(X + NORTH.x * 4, Y, Z + NORTH.z * 4);
  const deg = Math.round(Math.atan2(N.x - O2.x, -(N.y - O2.y)) * 180 / Math.PI);
  if (deg !== roseDeg) { roseDeg = deg; rose.setAttribute('transform', `rotate(${deg})`); }
}

// ── keys ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
listen(window, 'keydown', (e) => {
  if (app.phase !== 'build') return;
  if (e.key === 'ArrowLeft') { cam.azV = 0; cam.az -= 10 * DEG; }
  else if (e.key === 'ArrowRight') { cam.azV = 0; cam.az += 10 * DEG; }
  else if (e.key === 'ArrowUp') cam.yT = climb(cam.yT, 2);
  else if (e.key === 'ArrowDown') cam.yT = climb(cam.yT, -2);
  else if (e.key === 'Escape') { if (app.held) build.putBack(); else if (app.selected) app.select(null); else if (host.escape) host.escape(); }
  else if (e.key === 'Enter' && app.held) el.nailBtn.click();
  else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) $('undo').click();
  // (with a board in hand: A and D move its free end west and east, W and S north and south, R and F up and down, as the
  // arrows do, the ones showing)
  else if (app.held && /^[wasdrf]$/i.test(e.key)) { const k = e.key.toLowerCase(); build.arrow(k === 'a' || k === 'd' ? 'X' : k === 'r' || k === 'f' ? 'Y' : 'Z', k === 'd' || k === 's' || k === 'r' ? 1 : -1); }
});
listen(window, 'pointerdown', () => sound.audioOn(), { capture: true });
{
  const btn = $('mute'), vol = $('vol');
  const show = () => { const v = sound.getVolume(); btn.classList.toggle('is-muted', v.muted || v.volume === 0); btn.setAttribute('aria-pressed', String(v.muted)); vol.value = Math.round(v.volume * 100); };
  btn.onclick = () => { const v = sound.getVolume(); sound.setVolume(v.volume || 0.8, !v.muted); show(); };
  vol.oninput = () => { sound.setVolume(vol.value / 100, false); show(); };
  vol.addEventListener('keydown', (e) => e.stopPropagation());
  show();
}

// ── start ────────────────────────────────────────────────────────────────────────────────────────────────────────────
listen(window, 'resize', resize);
resize();
if (host.span) app.tower.S = host.span;
const start = host.start && host.start.bridge ? host.start : null;
if (start) restore(start);
else { build.freshStack(BOARDS); world.setSpan(app.tower.S); world.setPlankPile(app.planks); }
showFaceName(); rebuild();
cam.az = host.az ?? cam.az;
// (a little further back where the host says: the game's ravine is deep, and its near wall stands in the picture)
cam.dist = cam.distT = Math.min(DIST[1], fitDistance() * (host.zoom || 1.3));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) placeFaceName(); });
sound.setWind(0.06);
// (the host may lend its own engineer, already standing at his spot on the west abutment)
(host.engineer ? Promise.resolve(host.engineer(scene)) : makeEngineer(scene)).then((m) => {
  if (!m) return;
  if (!alive) { if (host.dropEngineer) host.dropEngineer(m); else scene.remove(m.root); return; }
  engineer = m; placeEngineer();
  later(() => {
    if (!banksOpen()) return;
    say(host.span ? `Howdy! I'm the engineer at this crossing. The river's ${lenWords(app.tower.S)} across here, stone wall to stone wall. Build me a bridge.`
      : 'Howdy! I\'m the engineer at this crossing. The river\'s 16 feet across here; drag a bank\'s stone edge in or out to change the gap. Then build me a bridge.', { force: true, ms: 10000 });
    later(() => { if (banksOpen() && !app.held) say('Cut a board from the lumber pile and drag it onto a bank\'s stone. Both sides need boards reaching from bank to bank.', { key: 'start2', times: 1, force: true, ms: 9000 }); }, 10500);
  }, 900);
});

// ── a handle for test scripts (see the top of this file) ─────────────────────────────────────────────────────────────
const toPage = (p) => { const r = el.view.getBoundingClientRect(); return { x: p.x + r.left, y: p.y + r.top, behind: p.behind }; };
const handle = {
  app, camera, scene, cam, build, towerView, deckView, loads, fall, startTest, layDeck, LOADS,
  test: () => crossing.state(), result: () => crossing.result,
  addWorld(a, b, len) {
    const L = len ?? Math.hypot(b.X - a.X, b.Y - a.Y, b.Z - a.Z);
    build.payFor(L);
    app.held = { piece: { id: 'dev', len: L }, len: L, A: { ...a }, on: null, B: { ...b }, con: null };
    return app.nail();
  },
  load(br0) {
    const t = cleanBridge(br0);
    resetAll(host.span || t.S);
    for (const b of t.boards) { build.payFor(b.len); addBoard(b); }
    rebuild(); changed('load');
    return app.tower.boards.length;
  },
  setSpan: (S) => app.setSpan(S),
  deck: () => (app.tower.deck ? { y: app.tower.deck.y, planks: app.tower.deck.planks.length, on: [...app.tower.deck.on] } : null),
  boards: () => JSON.parse(JSON.stringify(app.tower.boards)),
  bridge: () => JSON.parse(JSON.stringify(app.tower)),
  ghosts: () => app.ghostList().map((g) => ({ a: g.a, b: g.b, len: g.len, ok: g.ok, reason: g.reason })),
  confirm: (i) => confirmGhost(app.ghostList()[i]),
  confirmAll,
  sockets: () => build.sockets().map((q) => ({ X: q.X, Y: q.Y, Z: q.Z, on: q.on ? q.on.id : null, kind: q.kind || null })),
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
  turnTo: (az) => { cam.azV = 0; cam.az = az; }, setAz: (az) => { cam.azV = 0; cam.az = az; },
  setLook: (y, dist) => { cam.y = cam.yT = y; if (dist) cam.dist = cam.distT = dist; },
  state: () => ({ phase: app.phase, S: app.tower.S, D: app.tower.D, boards: boardCount(app.tower), deck: !!app.tower.deck, planks: app.planks, az: cam.az, camY: cam.y, zoom: cam.distT, banksOpen: banksOpen(),
    full: build.fullCount(), lumber: { stack: app.lumber.stack, bench: app.lumber.bench && app.lumber.bench.len, pieces: app.lumber.pieces.map((p) => +p.len.toFixed(3)) },
    held: app.held && { A: app.held.A, B: app.held.B, len: app.held.len, con: !!app.held.con }, ghosts: app.ghostList().length, best, fps: host.fps ? host.fps() : 0,
    question: !$('question').hidden ? $('question').innerText : null, result: !$('result').hidden ? $('result').innerText : null, falling: fall.sticks.length, hint: el.hint.textContent,
    say: $('say').hidden ? null : $('say-text').textContent, faceName: $('face-name').textContent, inRoad: [...(app.inRoad || [])], deckReady: !app.tower.deck && !$('lay-deck').hidden && !$('lay-deck').classList.contains('is-not-ready'), ladder: asker.state ? asker.state() : { level: stepNow() }, bonus: bonusEarned, layDeck: !$('lay-deck').hidden,
    trim: !el.trimBar.hidden ? el.trimHint.textContent : null }),
  worldToScreen: (X, Y, Z) => toPage(app.worldToScreen(X, Y, Z)),
  resetAll,
};

// ── what the host keeps ──────────────────────────────────────────────────────────────────────────────────────────────
// the bridge (its boards; the deck by how many planks it took, laid again on the same boards when it comes back), the
// lumber left (a board in hand goes back on the pile in the saved copy), the planks left, the boards earned, the best
function snapshot() {
  const pieces = app.lumber.pieces.map((q) => +q.len.toFixed(4));
  if (app.held && app.held.len) { if (app.held.len >= BOARD_FT - 1e-6) pieces.push(BOARD_FT); else pieces.push(+app.held.len.toFixed(4)); }
  const full = build.fullCount() + pieces.filter((l) => l >= BOARD_FT - 1e-6).length;
  const t = app.tower;
  return { bridge: JSON.parse(JSON.stringify({ S: t.S, D: t.D, boards: t.boards.map((b) => ({ id: b.id, a: b.a, b: b.b, len: b.len })) })),
    deck: t.deck ? t.deck.planks.length : 0, planks: app.planks,
    lumber: { full, pieces: pieces.filter((l) => l < BOARD_FT - 1e-6) }, bonus: bonusEarned, best: { ...best } };
}
// everything off the page and out of the scene; the host's own things (its scene, camera, canvas) stay
function dispose() {
  if (!alive) return;
  if (app.held) build.putBack();
  alive = false;
  for (const off of offs.splice(0)) off();
  statsWatch.disconnect();
  clearTimeout(sayTimer); clearTimeout(gestureTimer);
  if (crossing.dispose) crossing.dispose();
  towerView.dispose(); deckView.dispose();   // (out of the scene, their shapes let go on the graphics card)
  if (loads.dispose) loads.dispose(); else if (loads.root) scene.remove(loads.root);
  if (fall.dispose) fall.dispose();
  if (engineer) { engineer.play('Idle', { fade: 0.3 }); if (host.dropEngineer) host.dropEngineer(engineer); else scene.remove(engineer.root); }
  sound.setWind(0);
  if (host.sound) { sound.detach(); sound.lend(false); root.classList.remove('wm-hosted'); }
  root.innerHTML = '';
}
const busy = () => app.phase !== 'build' || !!app.held;
// put away with a test's card up: as its main button would (keep building on what stands, or a fresh start when
// nothing does), so what is saved is what stands
function settle() {
  if (app.phase !== 'result') return;
  const a = crossing.settle(); if (!a) return;
  if (a.keep) keepBuilding(a.keep);
  else { fall.clear(); resetAll(); backToBuild(); }
}
return { frame, resize, dispose, snapshot, settle, busy, handle, app, cam, towerView, deckView, get phase() { return app.phase; }, startTest, ask: handle.ask };
}

// where the engineer stands: on the west abutment's stone, toward the back (side -1: the north side, as on the lab
// page; +1 the south), clear of the road the loads come down (metres, the bridge's frame). Six feet back from the
// gap's edge: nearer, he stood in front of the stone's edge where the first boards go (on a phone's start view, right
// over it)
export function engineerAt(S, side = -1) { return { x: -(S / 2 + 6) * FT, y: 0, z: side * (WIDTH / 2 + 1.4) * FT }; }
