// BANDIT MATH: the boot, the title screen, the ride, and the frame loop.
//
// The valley loads behind the title screen (its progress goes to the title's loading bar). RIDE OUT drops the rider in
// the little western town: Old Hob points the way, glowing hoofprints lead out to the pasture, and the round-up runs
// there (src/missions/roundup.js). The town's doors open the counters (src/shop.js): the stable, the general store and
// the sheriff's desk; the cabin's door lets you in to your own cabin, in first person (src/cabin/cabin.js). "Just lock
// boxes" on the title opens the lock-box panel straight away, with no valley needed, and pays like the sheriff. Esc
// (or the Menu button) pauses; the menu can go back to the title.
//
// While a panel is open (a counter, the menu, a lock box) the game is paused: nothing moves, the keys are let go, and
// the last frame stays on screen (nothing is drawn again until the panel closes, or the window is resized).
//
// The address can carry:
//   ?q=potato|normal|gaming   the quality tier (else the machine's own, or the one saved)
//   ?look=summer              the drier, golden meadows (the default is 'green', as the Terrain Lab)
//   ?dev                      shortcut buttons: +100 gold, jump to each place, start the round-up, a lock box, a saddle, a dog
//   ?perf                     frames a second, draw calls and the tier, top right
// For rigs: window.BM = { world, player, rider, state, dev: { gold(n), goto(place), mission(name), lockbox(), tier, ... },
//   roundup, hud, shops, title, input, camera, renderer, fps(s), frameMs(n), screenOf(steer or object), ready }
import * as THREE from 'three';
import { makeWorld } from './world.js';
import { chooseTier } from '../world/quality.js';
import { loadFolk } from './actors/folk.js';
import { loadAnimals } from './actors/animals.js';
import { makeInput } from './input.js';
import { makePlayer, MOVE } from './player.js';
import { makeDog, dogKind } from './dog.js';
import { townLife } from './townlife.js';
import { showTitle } from './ui/title.js';
import { makeHud } from './ui/hud.js';
import { makeRoundup } from './missions/roundup.js';
import { makeFarm } from './farm.js';
import { makeSheepJob } from './missions/sheep.js';
import { makePigJob } from './missions/pigs.js';
import { makeStoreJob } from './missions/store.js';
import { makeShops, makePanel, boxTier, PRICES, PAY } from './shop.js';
import { makeHob } from './hob.js';
import { makeStage } from './stage.js';
import { makeCabin } from './cabin/cabin.js';
import { makeAudio, volumeRow } from './audio/audio.js';
import { openLockbox, TIER_NAME } from './lockbox/index.js';
import { loadRiders, saveRider, earn, recordLockbox, titleOf, nextTitle, badgesOf, cleanBoxes, BOX_TIERS } from './save.js';

export const BUILD = '1 (2026-10-09)';
const Q = new URLSearchParams(location.search);
const DEV = Q.has('dev'), PERF = Q.has('perf');
const LOOK = Q.get('look') === 'summer' ? 'summer' : 'green';
const $ = (id) => document.getElementById(id);
const BM = window.BM = { ready: false, state: 'loading', errors: [], build: BUILD };
addEventListener('error', (e) => BM.errors.push(String(e.message)));

// ── THE RENDERER, THE CAMERA, THE TIER ───────────────────────────────────────────────────────────────────────────
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.get('q') !== 'potato', powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 5000);
const quality = chooseTier(renderer);

// ── THE TITLE SCREEN (shown at once; the valley loads behind it) ───────────────────────────────────────────────────
const T = showTitle($('title-root'), { riders: loadRiders(), build: BUILD, onRide: (r) => ride(r), onLockboxes: (r) => justBoxes(r) });
T.setProgress(0.01, 'Riding into the valley');
// the game's sound (src/audio/audio.js): it wakes on the first click or key press, and is quiet on the title and while paused
const AUD = makeAudio(); AUD.hold('title', true);
Object.defineProperty(BM, 'stage', { get: () => stage }); BM.audio = AUD;
const hud = makeHud($('hud-root'), {
  onMenu: () => openMenu(),
  onPrompt: () => { if (paused) return; if (door) openCounter(door.id); else if (I) I.press('KeyE'); },
  onTouch: (code) => { if (I) I.press(code); },
});

// ── LOADING: the world, the people and the cattle, all at once ─────────────────────────────────────────────────────
let W = null, folk = null, animals = null, I = null;
let worldP = 0, libsDone = 0;
const progress = (text) => T.setProgress(Math.min(0.97, worldP * 0.9 + libsDone * 0.035), text);
const loading = Promise.all([
  makeWorld({ renderer, camera, quality, look: LOOK, onProgress: (p, text) => { worldP = p; progress(text); } }),
  loadFolk().then((f) => { libsDone++; progress(); return f; }),
  loadAnimals(undefined, { kinds: ['cow', 'bull'] }).then((a) => { libsDone++; progress(); return a; }),
]).then(([w, f, a]) => {
  W = w; folk = f; animals = a;
  I = makeInput(canvas, { camera }); I.enabled = false;
  if (state === 'loading') state = 'title';
  titleCam(0);
  W.update(0.016); W.render();
  if (state !== 'boxes') canvas.classList.add('is-on');   // ("Just lock boxes" keeps its plain dark backdrop)
  T.setProgress(1, 'Ready to ride');
  BM.ready = true;
}).catch((e) => { console.error('Bandit Math could not load the valley', e); T.setProgress(0, 'The valley could not load: please reload the page'); });

// ── THE GAME'S STATE ─────────────────────────────────────────────────────────────────────────────────────────────
// state: 'loading' | 'title' | 'play' | 'boxes' (just lock boxes, from the title)
let state = 'loading', paused = false, pausedBy = new Set();
let rider = null, mode = 'lasso', P = null, D = null, RU = null, hob = null, shops = null, door = null, menu = null, boxOpen = false;
let stage = null;   // the band on the town's stage and its music (src/stage.js)
let cabin = null;   // the player's cabin: walk in through its door (src/cabin/cabin.js)
let farm = null, SH = null;   // the farm north of town (src/farm.js) and its sick-sheep job (src/missions/sheep.js)
let PG = null;   // the farm's loose-pigs job (src/missions/pigs.js)
let SJ = null;   // the general store's counter: word problems on order slips (src/missions/store.js)
const atCounter = () => !!(SJ && SJ.active);   // (working the counter: the rider stands still, the store's camera)

function pause(why) {
  pausedBy.add(why);
  if (paused) return;
  paused = true;
  if (P) P.enabled = false;
  if (I) I.enabled = false;
  if (RU) RU.paused = true;
  if (SH) SH.paused = true;
  if (PG) PG.paused = true;
  hud.prompt(null);
  AUD.hold('pause', true);
}
function resume(why) {
  pausedBy.delete(why);
  if (pausedBy.size || !paused) return;
  paused = false;
  if (P) P.enabled = !atCounter();
  if (I) I.enabled = state === 'play' && !atCounter();
  if (RU) RU.paused = atCounter();
  if (SH) SH.paused = false;
  if (PG) PG.paused = false;
  AUD.hold('pause', false);
  last = performance.now();
}

// ── RIDING OUT ───────────────────────────────────────────────────────────────────────────────────────────────────
async function ride(r) {
  await loading;
  if (!W) return;
  rider = r; mode = r.mode === 'shoot' ? 'shoot' : 'lasso';   // (picked on the title; it holds for the whole ride)
  state = 'play'; pausedBy.clear(); paused = false;
  T.hide();
  canvas.classList.add('is-on');
  I.enabled = true;
  P = makePlayer({ W, folk, animals, rider, input: I, camera, say: (t) => hud.toast(t) });
  makeDogIfOwned();
  hob = makeHob({ W, hud, rider, I });
  stage = makeStage({ W, folk, audio: AUD });
  AUD.hold('pause', false); AUD.hold('title', false);
  shops = makeShops({ W, rider, say: (t, k) => hud.toast(t, k),
    onOpen: () => pause('counter'), onClose: () => resume('counter'),
    onBuy: (what) => { refresh(); if (what === 'saddle' || what === 'horse') P.refreshOwned(); if (what === 'dog') { makeDogIfOwned(); if (cabin) cabin.dogsChanged(); } hob.event(what); },
    onLockbox: (box, o) => openBox(box, o), onStoreJob: () => { if (SJ) SJ.start(); } });
  cabin = makeCabin({ W, renderer, camera, animals, rider, hud, input: I, audio: AUD, player: () => P, follower: () => D,
    onBuy: () => refresh(), onLockbox: (box, o) => openBox(box, o) });
  RU = makeRoundup({ W, animals, P, I, camera, canvas, rider, hud: roundupHud(), hob, refresh });
  farm = makeFarm({ W, animals });
  SH = makeSheepJob({ W, animals, farm, P, I, camera, canvas, rider, hud, hob, refresh, defer: (at) => !!(PG && PG.wants(at)) });
  PG = makePigJob({ W, animals, farm, P, camera, canvas, rider, hud, hob, refresh });
  SJ = makeStoreJob({ W, folk, P, I, camera, rider, hud, hob, refresh, pay: PAY,
    openBox: (problem, after) => !paused && openBox({ tier: problem.tier, from: 'store' }, { problem, after }),   // (false: not now, the store tries again)
    onStart: () => { I.enabled = false; if (RU) RU.paused = true; hud.prompt(null); hud.rule(null); hud.hint(null); },
    onStop: () => { I.enabled = !paused; if (RU) RU.paused = paused; } });
  RU.start();
  hob.trail(true);
  hud.show(true); hud.touch(I.touch);
  refresh();
  hob.event('ride', { mode });
  P.cam.snap();
  last = performance.now();
}
function makeDogIfOwned() {
  const dog = rider && rider.owned && rider.owned.dog;
  if (!dog || !P) return;
  if (D && D.kind === dog.kind) { D.setName(dog.name); return; }
  if (D) D.dispose();
  D = makeDog({ W, scene: W.scene, animals, kind: dogKind(dog.kind), name: dog.name, follow: () => P.position });
  D.kind = dog.kind;
}
function endRide() {
  if (state !== 'play') return;
  if (menu) { const m = menu; menu = null; m.close(); }
  if (shops) shops.dispose();
  if (cabin) { cabin.dispose(); cabin = null; }
  if (RU) RU.dispose();
  if (SH) SH.dispose();
  if (PG) PG.dispose();
  if (SJ) SJ.dispose();
  if (farm) farm.dispose();
  if (hob) hob.dispose();
  if (D) D.dispose();
  if (P) P.dispose();
  if (stage) stage.dispose();
  RU = hob = shops = D = P = stage = SH = PG = SJ = farm = null; door = null;
  AUD.hold('title', true);
  pausedBy.clear(); paused = false;
  I.enabled = false;
  hud.show(false);
  if (rider) saveRider(rider);
  state = 'title';
  titleCam(0);
  T.show();
}

// The round-up and the farm's sheep job share the HUD's job card and the line under it: at the farm the sheep job has
// them, so the round-up's own (its travel card, counting the metres to the pasture) is held back there
function roundupHud() {
  const h = Object.create(hud);
  const atFarm = () => !!((SH && SH.near) || (PG && PG.near));   // (the sheep pasture or the pig yard)
  h.rule = (o) => (atFarm() || atCounter() ? hud.ruleEl : hud.rule(o));   // (nor at the store's counter)
  h.hint = (o) => { if (!atFarm() && !atCounter()) hud.hint(o); };
  return h;
}

// the purse on the HUD, from the rider
function refresh() {
  if (!rider) return;
  hud.purse({ gold: rider.gold, bounty: rider.bounty, title: titleOf(rider), next: nextTitle(rider), badges: badgesOf(rider), boxes: (rider.lockboxes || []).length });
  if (shops && shops.isOpen) shops.redraw();
}

// ── LOCK BOXES ───────────────────────────────────────────────────────────────────────────────────────────────────
// box = { tier, from }; own: from the saddlebags (each one solved is used up); after(totals): what to do when the panel
// closes. Boxes come one after another until "Done for now" (see lockbox/index.js); each is paid and recorded the
// moment it finishes (payBox), and the panel shows any new title or badge on its coin animation.
function payBox(res, own) {
  const note = {};
  if (res.solved && res.gold > 0) {
    const e = earn(rider, res.gold);
    if (e.newTitle) note.newTitle = e.newTitle;
  }
  const rec = recordLockbox(rider, res);
  if (rec.badge) note.badge = rec.badge;
  hud.buckle(rec.buckle, { delay: 500 });   // (a belt buckle for boxes cracked: its note shows over the panel)
  if (own && res.solved) {
    const i = (rider.lockboxes || []).findIndex((b) => b.tier === res.tier);
    if (i >= 0) rider.lockboxes.splice(i, 1);
    saveRider(rider);
  }
  refresh();
  return note;
}
// (returns false when a box is already open and nothing happened)
function openBox(box, { own = false, after = null, problem = null } = {}) {
  if (boxOpen) return false;
  boxOpen = true; pause('box');
  if (own) {   // (a box of a tier the panel doesn't know is opened, paid and used up as an iron one)
    rider.lockboxes = cleanBoxes(rider.lockboxes);
    if (!BOX_TIERS.includes(box.tier)) box = { ...box, tier: 'iron' };
  }
  // (problem: one set equation, from the store's word problems; the panel closes after it)
  openLockbox(document.body, { rider, box, debug: DEV, problem,
    next: own ? null : problem ? () => null : () => ({ tier: boxTier(rider), from: 'sheriff' }),   // the sheriff's pile never runs out
    onBox: (res) => payBox(res, own),
    onDone: (res) => {
      boxOpen = false;
      try {
        refresh();
        // (a counter the panel closes back onto says it in its own note: no toast on top of it)
        if (res.solved && !after) hud.toast(`Cracked ${res.boxes > 1 ? `${res.boxes} boxes` : `the ${TIER_NAME[box.tier] ? TIER_NAME[box.tier].toLowerCase() : 'box'}`}! +${res.gold} gold`, 'gold');
      } finally {
        resume('box');
        if (after) after(res);
      }
    } });
  return true;
}

// "Just lock boxes" from the title: seized boxes back to back over a plain dark backdrop, paid like the sheriff pays;
// "Done for now" goes straight back to the title (the rider's card there shows the new gold)
async function justBoxes(r) {
  rider = r; state = 'boxes';
  T.hide();
  canvas.classList.remove('is-on');
  nextJustBox();
}
function nextJustBox() {
  openLockbox(document.body, { rider, box: { tier: boxTier(rider), from: 'practice' }, debug: DEV,
    next: () => ({ tier: boxTier(rider), from: 'practice' }),
    onBox: (res) => payBox(res, false),
    onDone: () => { state = W ? 'title' : 'loading'; if (W) canvas.classList.add('is-on'); T.show(); } });
}

// ── THE MENU (Esc) ───────────────────────────────────────────────────────────────────────────────────────────────
function openMenu() {
  if (state !== 'play' || menu || boxOpen || (shops && shops.isOpen)) return;
  pause('menu');
  const boxes = (rider.lockboxes || []).length;
  const body = document.createElement('div');
  body.innerHTML = `<div class="bms-menu">
      <button type="button" class="is-main" data-do="resume">Keep riding<small>Esc</small></button>
      ${boxes ? `<button type="button" data-do="box">Open a lock box<small>${boxes} in your saddlebags</small></button>` : ''}
      <button type="button" data-do="home">Go back to town<small>Straight to the town square</small></button>
      <button type="button" data-do="title">Back to the title<small>Your gold is already saved</small></button></div>
    <div class="bms-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · drag to look · <kbd>Shift</kbd> run or gallop ·
      click a steer (or <kbd>F</kbd>) to rope it · <kbd>H</kbd> call your horse · <kbd>E</kbd> on and off, or talk at a door</div>`;
  body.querySelector('.bms-menu').after(volumeRow(AUD));
  let then = null;
  menu = makePanel({ title: 'Taking a breather', sub: `${rider.name} · ${titleOf(rider)}${mode === 'shoot' ? ' · shooting comes soon' : ''}`, body,
    onClose: () => { menu = null; resume('menu'); if (then) then(); } });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-do]'); if (!b) return;
    const what = b.dataset.do;
    if (what === 'home') then = () => { if (SJ) SJ.stop(); const s = W.places.spawn; if (cabin && cabin.inside) cabin.leave({ to: s }); else P.teleport(s.x, s.z, s.rot); };
    if (what === 'title') then = () => endRide();
    if (what === 'box') then = () => { const bx = rider.lockboxes[0]; if (bx) openBox({ tier: bx.tier, from: 'loot' }, { own: true }); };
    menu.close();
  });
}
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented || e.repeat) return;
  if (state === 'play' && !paused) { e.preventDefault(); openMenu(); }
});

// ── A COUNTER AT A DOOR ──────────────────────────────────────────────────────────────────────────────────────────
function openCounter(id) {
  if (id === 'cabin' && cabin) {   // (the cabin's door: in you go, no counter; on horseback, off the horse first)
    if (paused) return;
    if (P.onHorse) { if (P.dismount()) { const t = setInterval(() => { if (P && P.mode === 'foot') { clearInterval(t); if (!paused && cabin && state === 'play') cabin.enter(); } else if (!P || P.mode !== 'dismounting') clearInterval(t); }, 100); } return; }
    cabin.enter(); return;
  }
  if (shops && !shops.isOpen && !paused) shops.open(id);
}
const NEAR_REMARK = 4;   // metres from the saloon's door or the front of the stage where Hob remarks on it
function doors() {
  door = null;
  if (!P || paused || (P.mode !== 'foot' && P.mode !== 'horse')) { hud.prompt(null); return; }
  // standing by your own saddled horse, E gets on it (rather than opening a counter, unless the door is nearer)
  const h = P.mode === 'foot' && P.canRide && P.horse ? P.horse.root.position : null;
  const hd = h ? Math.hypot(h.x - P.position.x, h.z - P.position.z) : Infinity;
  const mount = hd < MOVE.mountNear;
  const d = shops.door(P.position);
  if (d && !(mount && hd < d.dist)) door = d;
  hud.prompt(door ? (door.id === 'cabin' ? 'Go into your cabin' : door.prompt) : mount ? 'Get on your horse' : null);
  if (door && I.enabled && I.tap('KeyE')) openCounter(door.id);
  // the saloon's doors and the stage have no counter yet: walking up to them, Old Hob says so
  if (hob) for (const k of ['saloon', 'stage']) {
    const pl = W.places[k];
    if (pl && pl.door && Math.hypot(P.position.x - pl.door.x, P.position.z - pl.door.z) < NEAR_REMARK) hob.event('near', { place: k });
  }
}

// ── THE COMPASS: the cabin, the job and your horse ─────────────────────────────────────────────────────────────────
function compass() {
  const at = P.position, marks = [];
  const add = (id, icon, x, z, label) => marks.push({ id, icon, label, bearing: Math.atan2(x - at.x, z - at.z), dist: Math.hypot(x - at.x, z - at.z) });
  const c = W.places.cabin; if (c) add('cabin', 'cabin', c.door.x, c.door.z, 'Your cabin');
  const pa = W.places.pasture; if (RU && pa) add('job', 'job', pa.x, pa.z, 'The round-up');
  const sp = farm && farm.layout.sheep; if (SH && sp) add('farm', 'job', sp.x, sp.z, 'The farm: sick sheep');
  const py = farm && farm.layout.yard; if (PG && py) add('pigs', 'job', py.x, py.z, 'The farm: loose pigs');
  if (P.horse && !P.onHorse) { const h = P.horse.root.position; add('horse', 'horse', h.x, h.z, 'Your horse'); }
  hud.compass(P.cam.yaw, marks);
}

// ── THE TITLE'S BACKDROP: the camera drifts slowly to and fro round the town square ─────────────────────────────────
// It circles wide and high enough to see the whole town over the rooftops, and looks a little to the right of the square,
// so the town sits in the left part of the screen (the settings panel covers the right half). It sweeps back and forth
// over the open side of the town rather than right round: from the other side the view is through the trees.
export const TITLE_CAM = {
  r: 58, up: 20,          // metres from the square's middle, and above it
  aside: 18,              // metres to the right of the square the camera looks
  from: 3.2, to: 4.6,     // the arc it sweeps (radians round the square, as three's rotation.y: 0 is +z); past about
                          // 4.8 the stable's roof and the back of the stage fill the view
  period: 240,            // seconds there and back
};
let sweep = 0, fixedAt = null;
function titleCam(dt) {
  if (!W) return;
  sweep += dt;
  const C = TITLE_CAM, mid = (C.from + C.to) / 2, half = (C.to - C.from) / 2;
  const at = fixedAt != null ? fixedAt : mid + half * Math.sin(2 * Math.PI * sweep / C.period);   // (starts in the middle)
  const c = W.places.square, y0 = W.heightAt(c.x, c.z);
  const x = c.x + Math.sin(at) * C.r, z = c.z + Math.cos(at) * C.r;
  camera.position.set(x, Math.max(W.heightAt(x, z) + 6, y0 + C.up), z);
  // (the camera looks back along -(sin, cos): its right is then (cos, -sin))
  camera.lookAt(c.x + Math.cos(at) * C.aside, y0 + 2.5, c.z - Math.sin(at) * C.aside);
  W.camTarget.set(c.x, y0, c.z);
}

// ── EACH FRAME ───────────────────────────────────────────────────────────────────────────────────────────────────
let last = performance.now(), frames = 0, fpsT = last, fpsNow = 0, needDraw = false;
function step(dt) {
  if (!W) return;
  const home = !!(cabin && cabin.inside);   // (in the cabin only it is drawn: the town waits)
  townLife(W, state === 'play' && (paused || home) ? 0 : dt, P, D);   // the chickens about the town (made on the first call)
  if (state === 'play') {
    if (paused) { if (needDraw) { needDraw = false; if (home) cabin.render(); else W.render(); } return; }
    if (home) { door = null; cabin.update(dt); cabin.render(); return; }   // (no town door while inside: E and the prompt are the cabin's)
    if (atCounter()) hud.prompt(null); else if (!(cabin && cabin.busy)) doors();
    P.update(dt);
    if (D) D.update(dt);
    if (cabin) cabin.town(dt);
    RU.update(dt);
    if (farm) farm.update(dt, P.position);
    if (SH) SH.update(dt);
    if (PG) PG.update(dt);
    if (SJ) SJ.update(dt);   // (after the player: it places the camera while the counter is open)
    hob.update(dt, P.position);
    if (stage) stage.update(dt, P.position);
    W.update(dt); W.render();
    AUD.listen(camera);
    compass();
    if (I.touch) hud.touch(true);
  } else if (state === 'title') {
    titleCam(dt); W.update(dt); W.render();
  }
}
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  step(dt);
  frames++;
  if (now - fpsT > 500) {
    fpsNow = frames * 1000 / (now - fpsT); frames = 0; fpsT = now;
    if (PERF && W) {
      const info = renderer.info.render;
      // (the third line: the animals or folk of the job in view; none in the cabin or away from every job)
      const job = cabin && cabin.inside ? '' : SJ && SJ.active ? `${SJ.state().people.length} customers` : PG && PG.near ? `${PG.pigs.length} pigs`
        : SH && SH.near ? `${SH.sheep.length} sheep` : RU && RU.near ? `${RU.targets.length} cattle` : '';
      hud.perf(`${W.tier} · ${fpsNow.toFixed(0)} fps\n${info.calls} draws · ${(info.triangles / 1e6).toFixed(2)} M tris${job || paused ? '\n' : ''}${job}${paused ? (job ? ' · ' : '') + 'paused' : ''}`);
      const pb = perfEl();   // (hidden while riding: the HUD has its own)
      if (state !== 'play') pb.textContent = `${W.tier} · ${fpsNow.toFixed(0)} fps · ${info.calls} draws`;
    }
  }
});
// (on the title the HUD is hidden, so ?perf has its own small readout there)
let perfBox = null;
function perfEl() {
  if (!perfBox) { perfBox = document.createElement('div'); perfBox.style.cssText = 'position:fixed;right:10px;top:6px;z-index:25;font:12px ui-monospace,monospace;color:#e9f2d9;background:rgba(0,0,0,.5);padding:4px 7px;border-radius:5px;pointer-events:none'; document.body.appendChild(perfBox); }
  perfBox.hidden = state === 'play';
  return perfBox;
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  needDraw = true;
});

// ── DEV SHORTCUTS (?dev) AND THE RIG HANDLE ─────────────────────────────────────────────────────────────────────────
const SPOTS = {
  square: () => W.places.spawn,
  pasture: () => ({ x: W.places.pasture.x - 20, z: W.places.pasture.z - 6, rot: 1.3 }),
  corral: () => { const g = W.places.corral.gate.out; return { x: g.x + 4, z: g.z, rot: -Math.PI / 2 }; },
  // just outside the sheep pasture's gate, looking in at the flock
  farm: () => { if (!farm) return W.places.spawn; const g = farm.layout.sheep.gate; return { x: g.out.x, z: g.out.z, rot: g.rot + Math.PI }; },
  // just inside the pig yard's gate, looking at the pens
  pigs: () => { if (!farm) return W.places.spawn; const g = farm.layout.yard.gate; return { x: g.in.x, z: g.in.z + 1, rot: g.rot + Math.PI }; },
};
for (const k of ['cabin', 'stable', 'store', 'sheriff', 'saloon', 'stage']) {
  SPOTS[k] = () => { const b = W.places[k]; if (!b) return W.places.spawn; return { x: b.door.x + Math.sin(b.rot) * 1.2, z: b.door.z + Math.cos(b.rot) * 1.2, rot: b.rot + Math.PI }; };
}
const dev = {
  get tier() { return W ? W.tier : quality.tier; },
  gold(n = 100) { if (!rider) return; earn(rider, n); refresh(); },
  goto(place) { if (!P || !SPOTS[place]) return false; const s = SPOTS[place](); P.teleport(s.x, s.z, s.rot ?? 0); return true; },
  mission(name = 'roundup') {
    if (name === 'store') { if (!SJ) return false; dev.goto('store'); SJ.start(); return true; }
    if (name === 'sheep') { if (!SH) return false; dev.goto('farm'); SH.newFlock(); return true; }
    if (name === 'pigs') { if (!PG) return false; dev.goto('pigs'); PG.newBatch(); return true; }
    if (name !== 'roundup' || !RU) return false; dev.goto('pasture'); RU.newWave(); return true;
  },
  lockbox(tier) { if (!rider) return false; if (state === 'play') openBox({ tier: tier || boxTier(rider), from: 'sheriff' }); return true; },
  saddle(kind = 'plain') { if (!rider) return; const o = rider.owned; o.saddles = [...new Set([...(o.saddles || []), kind])]; o.saddle = kind; saveRider(rider); if (P) P.refreshOwned(); refresh(); },
  dog(kind = 'shiba', name = 'Biscuit') { if (!rider) return; rider.owned.dog = { kind, name }; saveRider(rider); makeDogIfOwned(); },
  box(tier) { if (!rider) return; (rider.lockboxes = rider.lockboxes || []).push({ tier: tier || boxTier(rider), from: 'loot' }); saveRider(rider); refresh(); },
  // the title's backdrop camera: where round the square it is now, and (for a rig trying views) its settings
  orbit(at = null, o = {}) { fixedAt = at; Object.assign(TITLE_CAM, o); titleCam(0); },
};
if (DEV) {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:12px;top:50%;transform:translateY(-50%);z-index:26;display:flex;flex-direction:column;gap:4px;max-height:70vh;overflow:auto';
  const add = (label, fn) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.style.cssText = 'font:600 11px ui-monospace,monospace;background:rgba(40,28,16,.85);color:#f0d9a8;border:1px solid #7a5a3a;border-radius:4px;padding:4px 8px;cursor:pointer;text-align:left';
    b.onclick = (e) => { e.currentTarget.blur(); fn(); };
    bar.appendChild(b);
  };
  add('+100 gold', () => dev.gold(100));
  for (const k of Object.keys(SPOTS)) add('go: ' + k, () => dev.goto(k));
  add('start the round-up', () => dev.mission('roundup'));
  add('new sick sheep', () => dev.mission('sheep'));
  add('new loose pigs', () => dev.mission('pigs'));
  add('mind the store', () => dev.mission('store'));
  add('open a lock box', () => dev.lockbox());
  add('give a lock box', () => dev.box());
  add('give saddle', () => dev.saddle('plain'));
  add('give dog', () => dev.dog('shiba', 'Biscuit'));
  add('into the cabin', () => { dev.goto('cabin'); if (cabin) cabin.enter(); });
  document.body.appendChild(bar);
  const sync = () => { bar.style.display = state === 'play' ? 'flex' : 'none'; };
  setInterval(sync, 300); sync();
}
// where a steer (or any object) is on the page, for a rig's clicks
const _v = new THREE.Vector3();
function screenOf(o) {
  const obj = o.root || o; obj.getWorldPosition(_v); _v.y += o.a ? o.a.height * 0.75 : 0.8;
  _v.project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (_v.x + 1) / 2 * r.width, y: r.top + (1 - _v.y) / 2 * r.height, on: _v.z < 1 && Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1 };
}
Object.defineProperties(BM, {
  world: { get: () => W }, player: { get: () => P }, rider: { get: () => rider }, state: { get: () => (state === 'play' && paused ? 'paused' : state) },
  roundup: { get: () => RU }, sheep: { get: () => SH }, pigs: { get: () => PG }, farm: { get: () => farm }, shops: { get: () => shops }, dog: { get: () => D }, input: { get: () => I }, hob: { get: () => hob },
  door: { get: () => door }, store: { get: () => SJ }, paused: { get: () => paused }, mode: { get: () => mode }, cabin: { get: () => cabin },
});
Object.assign(BM, {
  dev, hud, title: T, camera, renderer, screenOf, prices: PRICES, loading,
  fps: (seconds = 3) => new Promise((res) => { let n = 0; const a = performance.now(); const f = () => { n++; if (performance.now() - a < seconds * 1000) requestAnimationFrame(f); else res(n * 1000 / (performance.now() - a)); }; requestAnimationFrame(f); }),
  // a frame's real cost, not held to the screen's refresh: n frames drawn back to back, each waited for
  frameMs: (n = 60) => { const gl = renderer.getContext(), px = new Uint8Array(4); let worst = 0; const a = performance.now();
    for (let i = 0; i < n; i++) { const f0 = performance.now(); step(1 / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); worst = Math.max(worst, performance.now() - f0); }
    last = performance.now(); return { avg: (performance.now() - a) / n, worst }; },
});
