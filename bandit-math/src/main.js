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
import { townLife, townLifeNow, preloadChickens } from './townlife.js';
import { showTitle } from './ui/title.js';
import { makeHud } from './ui/hud.js';
import { makeRoundup } from './missions/roundup.js';
import { makeFarm } from './farm.js';
import { makeSheepJob } from './missions/sheep.js';
import { makePigJob } from './missions/pigs.js';
import { makeStoreJob } from './missions/store.js';
import { makeCamps } from './camps.js';
import { makeDeer } from './deer.js';
import { makeDeerJob } from './missions/deerjob.js';
import { makeShootingJob } from './missions/shooting.js';
import { albumBody, prints } from './ui/album.js';
import { makeDeliveryJob } from './missions/delivery.js';
import { makeWagonJob } from './missions/wagonjob.js';
import { makeLootJob } from './missions/loot.js';
import { makeShops, makePanel, boxTier, PRICES, PAY } from './shop.js';
import { makeHob } from './hob.js';
import { makeJobFolk } from './jobfolk.js';
import { makeStage } from './stage.js';
import { makeTraffic } from './traffic.js';
import { roadCurve } from './wagon.js';
import { makeCabin } from './cabin/cabin.js';
import { makeHomestead } from './homestead.js';
import { makeAudio, volumeRow } from './audio/audio.js';
import { makeAmbience } from './audio/ambience.js';
import { makeShouts } from './audio/shouts.js';
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
// (?perf counts every pass of a frame: the valley, then the six-shooter over it. Left to itself each render() would wipe
// the count, and the readout would show only the gun's pass)
if (PERF) renderer.info.autoReset = false;
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
  preloadChickens().catch(() => null),   // (the town's chickens: in before "ready"; town life says if they can't load)
]).then(([w, f, a]) => {
  W = w; folk = f; animals = a;
  I = makeInput(canvas, { camera }); I.enabled = false;
  if (state === 'loading') state = 'title';
  titleCam(0);
  W.update(0.016); W.render();
  if (state !== 'boxes') canvas.classList.add('is-on');   // ("Just lock boxes" keeps its plain dark backdrop)
  T.setProgress(1, 'Ready to ride');
  BM.ready = true;
  setTimeout(() => { try { roadCurve(W); } catch (e) { console.warn('the road could not be laid', e); } }, 300);   // (the wagons' road, worked out once while the title shows, so riding out doesn't wait on it)
}).catch((e) => { console.error('Bandit Math could not load the valley', e); T.setProgress(0, 'The valley could not load: please reload the page'); });

// ── THE GAME'S STATE ─────────────────────────────────────────────────────────────────────────────────────────────
// state: 'loading' | 'title' | 'play' | 'boxes' (just lock boxes, from the title)
let state = 'loading', paused = false, pausedBy = new Set();
let rider = null, mode = 'lasso', P = null, D = null, RU = null, hob = null, shops = null, door = null, menu = null, boxOpen = false;
let stage = null;   // the band on the town's stage and its music (src/stage.js)
let traffic = null;   // wagons travelling the road through the valley now and then (src/traffic.js)
let AMBI = null;   // the town's sounds: animals, birds, work out back, the creek, the horse's hooves (src/audio/ambience.js)
let SHOUT = null;   // the player's own voice: hyah, whoa, yeehaw, howdy (src/audio/shouts.js)
let cabin = null;   // the player's cabin: walk in through its door (src/cabin/cabin.js)
let farm = null, SH = null;   // the farm north of town (src/farm.js) and its sick-sheep job (src/missions/sheep.js)
let PG = null;   // the farm's loose-pigs job (src/missions/pigs.js)
let SJ = null;   // the general store's counter: word problems on order slips (src/missions/store.js)
let WJ = null;   // protect the wagon: the gang on the road east of the pasture (src/missions/wagonjob.js), when ticked
let HS = null;   // the rider's own farm animals in a yard behind the cabin, and their goods (src/homestead.js)
let camps = null, DL = null;   // the camps out in the valley (src/camps.js) and their deliveries (src/missions/delivery.js)
let deer = null;   // the wild deer herds out in the valley (src/deer.js)
let DJ = null;   // deer photographs with Miss Wren's box camera (src/missions/deerjob.js), when ticked
let SR = null;   // target shooting at the range on the east edge of town (src/missions/shooting.js), for a rider in Shooting mode
let JF = null;   // a person at each job who says what's going on, and thanks you after (src/jobfolk.js)
let LJ = null;   // loot the gang: the gang's cache out in the valley, handed back at the sheriff's office (src/missions/loot.js), when ticked
const atCounter = () => !!(SJ && SJ.active) || !!(DL && DL.active) || !!(DJ && DJ.active) || !!(SR && SR.active);   // (or making up a camp's order on the slip)   // (working the counter: the rider stands still, the store's camera)

function pause(why) {
  pausedBy.add(why);
  if (paused) return;
  paused = true;
  if (P) P.enabled = false;
  if (I) I.enabled = false;
  if (RU) RU.paused = true;
  if (SH) SH.paused = true;
  if (PG) PG.paused = true;
  if (WJ) WJ.paused = true;
  if (DJ) DJ.paused = true;
  if (SR) SR.paused = true;
  if (LJ) LJ.paused = true;
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
  if (WJ) WJ.paused = false;
  if (DJ) DJ.paused = false;
  if (SR) SR.paused = false;
  if (LJ) LJ.paused = false;
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
  hob = makeHob({ W, hud, rider, I });   // (no babble voice: the owner found reading works better; src/audio/voice.js is kept for the Sound Lab)
  { const heard = hob.event; hob.event = (n, d) => { heard(n, d); if (JF) JF.heard(n, d); if (SHOUT) SHOUT.heard(n, d); }; }   // (the job folk hear the jobs too: their thank-yous; and the player's yeehaw at a job's end)
  stage = makeStage({ W, folk, audio: AUD });
  traffic = makeTraffic({ W, animals, folk, audio: AUD, obstacles: trafficThings, camps: () => camps });
  AMBI = makeAmbience({ audio: AUD, W }); BM.ambience = AMBI;
  SHOUT = makeShouts({ audio: AUD }); BM.shouts = SHOUT;
  AUD.hold('pause', false); AUD.hold('title', false);
  HS = makeHomestead({ W, animals, rider, hud, hob, refresh });
  shops = makeShops({ W, rider, say: (t, k) => hud.toast(t, k), extra: HS.shop,
    onOpen: () => pause('counter'), onClose: () => resume('counter'),
    onBuy: (what) => { refresh(); if (what === 'saddle' || what === 'horse') P.refreshOwned(); if (what === 'dog') { makeDogIfOwned(); if (cabin) cabin.dogsChanged(); } if (what === 'hat' && P && P.person) { if (!P.person.hat) P.person.hatOn(); P.person.setHat(rider.look.hatStyle); } hob.event(what); },
    onLockbox: (box, o) => openBox(box, o), onStoreJob: () => { if (SJ) SJ.start(); } });
  cabin = makeCabin({ W, renderer, camera, animals, rider, hud, input: I, audio: AUD, player: () => P, follower: () => D,
    onBuy: () => refresh(), onLockbox: (box, o) => openBox(box, o) });
  // (the round-up's Hob also hears a whole wave roped: now and then a thank-you calf from the rancher)
  const herdHob = Object.create(hob); herdHob.event = (n, d) => { hob.event(n, d); if (HS && n === 'waveDone') HS.jobDone(n); };
  RU = makeRoundup({ W, animals, P, I, camera, canvas, rider, hud: roundupHud(), hob: herdHob, refresh });
  farm = makeFarm({ W, animals });
  // (the farm jobs' Hob also hears a whole flock healed or a batch penned: now and then a thank-you lamb or piglet)
  const farmHob = Object.create(hob); farmHob.event = (n, d) => { hob.event(n, d); if (HS && (n === 'flockDone' || n === 'pigsDone')) HS.jobDone(n); };
  SH = makeSheepJob({ W, animals, farm, P, I, camera, canvas, rider, hud, hob: farmHob, refresh, defer: (at) => !!(PG && PG.wants(at)) });
  PG = makePigJob({ W, animals, farm, P, camera, canvas, rider, hud, hob: farmHob, refresh });
  SJ = makeStoreJob({ W, folk, P, I, camera, rider, hud, hob, refresh, pay: PAY, goods: HS, voice: (k, who) => { if (SHOUT) SHOUT.say(k, who); },
    openBox: (problem, after) => !paused && openBox({ tier: problem.tier, from: 'store' }, { problem, after }),   // (false: not now, the store tries again)
    onStart: () => { I.enabled = false; if (RU) RU.paused = true; hud.prompt(null); hud.rule(null); hud.hint(null); },
    onStop: () => { I.enabled = !paused; if (RU) RU.paused = paused; } });
  camps = makeCamps({ W, folk, camera, audio: AUD });
  deer = makeDeer({ W, animals });
  DJ = rider.missions && rider.missions.hunt ? makeDeerJob({ W, deer, P, I, camera, canvas, rider, hud, hob, audio: AUD, refresh,
    onStart: () => { P.enabled = false; I.enabled = false; if (RU) RU.paused = true; hud.prompt(null); },
    onStop: () => { P.enabled = !paused; I.enabled = !paused; if (RU) RU.paused = paused; },
    busy: () => !!((WJ && (WJ.on || WJ.near)) || (RU && RU.near) || (SH && SH.near) || (PG && PG.near) || (DL && (DL.active || DL.card))) }) : null;   // (another job has the player: the deer card stands aside)
  // Shooting mode: bottles and tin cans at the range, never anything alive (cattle and bandits are still roped)
  SR = mode === 'shoot' ? makeShootingJob({ W, folk, P, I, camera, canvas, renderer, rider, hud, hob, audio: AUD, refresh,
    onStart: () => { P.enabled = false; I.enabled = false; if (RU) RU.paused = true; hud.prompt(null); },
    onStop: () => { P.enabled = !paused; I.enabled = !paused; if (RU) RU.paused = paused; },
    busy: () => !!((WJ && WJ.on) || (DL && DL.active) || (DJ && DJ.active)) }) : null;
  DL = makeDeliveryJob({ W, camps, P, camera, rider, hud, hob, refresh,
    onStart: () => { P.enabled = false; I.enabled = false; if (RU) RU.paused = true; hud.prompt(null); },
    onStop: () => { P.enabled = !paused; I.enabled = !paused; if (RU) RU.paused = paused; },
    quiet: () => !!((RU && RU.near) || (SH && SH.near) || (PG && PG.near) || (SJ && SJ.active) || (WJ && WJ.near)),
    say: (id, t) => !!(JF && JF.say(id, t)) });   // (the foremen's words in the job folk's speech card)
  WJ = rider.missions && rider.missions.wagon ? makeWagonJob({ W, folk, animals, P, I, camera, canvas, rider, hud, hob, audio: AUD, refresh,
    times: () => RU && RU.trainer('times'),   // (one times trainer for both jobs)
    wagonLib: () => traffic && traffic.ready,   // (the wagon models the traffic loads, shared)
    quiet: () => !!((RU && RU.near) || (SH && SH.near) || (PG && PG.near) || atCounter() || (DL && DL.card)) }) : null;
  LJ = rider.missions && rider.missions.loot ? makeLootJob({ W, folk, animals, P, I, camera, canvas, rider, hud, hob, refresh,
    voice: (k, who) => { if (SHOUT) SHOUT.say(k, who); },   // (a townsman's recorded lines: "Is that my stuff?", a thank-you)
    quiet: () => !!((RU && RU.near) || (SH && SH.near) || (PG && PG.near) || atCounter() || (WJ && WJ.near) || (DL && DL.card) || (DJ && DJ.card)) }) : null;
  JF = makeJobFolk({ W, folk, P, camera, hud,
    jobs: { roundup: () => RU, sheep: () => SH, pigs: () => PG, wagon: () => WJ, deer: () => DJ, camps: () => camps, farm: () => farm, delivery: () => DL, loot: () => LJ },
    actions: { sheriff: () => openCounter('sheriff') }, onTalk: (what, id, who) => { if (SHOUT) SHOUT.talk(what, who && { id, ...who }); } });
  RU.start();
  hob.trail(true);
  hud.show(true); hud.touch(I.touch);
  refresh();
  hob.event('ride', { mode, wagon: !!WJ, deer: !!DJ, loot: !!LJ });
  P.cam.snap();
  last = performance.now();
}
// what a wagon on the road slows and stops for: the player, the player's horse, the dog, the round-up's cattle, the
// general store's customers walking to and from the square, the roped bandits walking to the sheriff's office
const thingsNear = [], horseEnds = [new THREE.Vector3(), new THREE.Vector3()];
function trafficThings() {
  thingsNear.length = 0;
  if (!P) return thingsNear;
  thingsNear.push(P.position);
  if (P.horse && P.horse.root) {
    // the horse's middle, and its nose and tail (side on to the road it reaches more than a metre past its middle)
    const r = P.horse.root, hp = r.position, h = r.rotation.y;
    thingsNear.push(hp, horseEnds[0].set(hp.x + Math.sin(h) * 1.1, hp.y, hp.z + Math.cos(h) * 1.1), horseEnds[1].set(hp.x - Math.sin(h) * 1.1, hp.y, hp.z - Math.cos(h) * 1.1));
  }
  if (D && D.position) thingsNear.push(D.position);
  if (RU && RU.targets) for (const t of RU.targets) if (t.root) thingsNear.push(t.root.position);
  if (SJ && SJ.people) for (const c of SJ.people) thingsNear.push(c);
  if (WJ && WJ.walkers) for (const k of WJ.walkers) thingsNear.push(k);   // (the roped bandits walking to the sheriff's)
  if (LJ && LJ.people) for (const c of LJ.people) thingsNear.push(c);   // (the folks come for their stolen goods)
  return thingsNear;
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
  if (DL) DL.dispose();
  if (WJ) { WJ.dispose(); WJ = null; }
  if (camps) camps.dispose();
  if (DJ) { DJ.dispose(); DJ = null; }
  if (SR) { SR.dispose(); SR = null; }
  if (LJ) { LJ.dispose(); LJ = null; }
  if (JF) { JF.dispose(); JF = null; }
  if (deer) { deer.dispose(); deer = null; }
  DL = camps = null;
  if (farm) farm.dispose();
  if (HS) { HS.dispose(); HS = null; }
  if (hob) hob.dispose();
  if (D) D.dispose();
  if (P) P.dispose();
  if (stage) stage.dispose();
  if (traffic) { traffic.dispose(); traffic = null; }
  if (AMBI) { AMBI.dispose(); AMBI = BM.ambience = null; }
  if (SHOUT) { SHOUT.dispose(); SHOUT = BM.shouts = null; }
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
  const atFarm = () => !!((SH && SH.near) || (PG && PG.near) || (DL && DL.card && !(RU && RU.near)) || (WJ && (WJ.near || (WJ.on && !(RU && RU.near)))) || (DJ && DJ.card) || (LJ && LJ.card && !(RU && RU.near)));   // (and a delivery's card)   // (the sheep pasture or the pig yard)
  h.rule = (o) => (atFarm() || atCounter() ? hud.ruleEl : hud.rule(o));   // (nor at the store's counter)
  h.hint = (o) => { if (!atFarm() && !atCounter()) hud.hint(o); };
  return h;
}

// the purse on the HUD, from the rider
function refresh() {
  if (!rider) return;
  hud.purse({ gold: rider.gold, bounty: rider.bounty, title: titleOf(rider), next: nextTitle(rider), badges: badgesOf(rider), boxes: (rider.lockboxes || []).length, goods: HS ? HS.goodsLine() : '' });
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
        if (JF && res.solved && box.from === 'sheriff') JF.heard('sheriffDone');   // (the sheriff's thank-you, once back in the street)
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
      <button type="button" class="is-main" data-do="resume">Keep riding<small>${I && I.touch ? 'Back to the game' : 'Esc'}</small></button>
      ${boxes ? `<button type="button" data-do="box">Open a lock box<small>${boxes} in your saddlebags</small></button>` : ''}
      ${prints(rider).length ? `<button type="button" data-do="album">Photo album<small>${prints(rider).length} deer photographs</small></button>` : ''}
      ${WJ && WJ.on ? '<button type="button" data-do="wagon">Let the wagon wait<small>Stop riding along for now</small></button>' : ''}
      <button type="button" data-do="home">Go back to town<small>Straight to the town square</small></button>
      <button type="button" data-do="title">Back to the title<small>Your gold is already saved</small></button></div>
    <div class="bms-keys">${I && I.touch
      ? 'thumb stick on the left to move (push it to the edge to gallop) · drag to look · tap a steer or a rider, or press Rope · Horse calls your horse · On / off gets on and off · tap the prompt at a door'
      : `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · drag to look · <kbd>Shift</kbd> run or gallop ·
      click a steer (or <kbd>F</kbd>) to rope it · <kbd>H</kbd> call your horse · <kbd>E</kbd> on and off, or talk at a door`}</div>`;
  body.querySelector('.bms-menu').after(volumeRow(AUD));
  let then = null;
  menu = makePanel({ title: 'Taking a breather', sub: `${rider.name} · ${titleOf(rider)}${mode === 'shoot' ? ' · Shooting: bottles and cans at the range' : ''}`, body,
    onClose: () => { menu = null; resume('menu'); if (then) then(); } });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-do]'); if (!b) return;
    const what = b.dataset.do;
    if (what === 'wagon') then = () => { if (WJ) WJ.stop(); };
    if (what === 'home') then = () => { if (SJ) SJ.stop(); const s = W.places.spawn; if (cabin && cabin.inside) cabin.leave({ to: s }); else P.teleport(s.x, s.z, s.rot); };
    if (what === 'title') then = () => endRide();
    if (what === 'box') then = () => { const bx = rider.lockboxes[0]; if (bx) openBox({ tier: bx.tier, from: 'loot' }, { own: true }); };
    if (what === 'album') then = () => { pause('album'); makePanel({ title: 'Photo album', sub: rider.name, body: albumBody(rider), wide: true, onClose: () => resume('album') }); };
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
  const called = mount && P.horseCameAt && performance.now() - P.horseCameAt < 6000;   // (just whistled over: E gets on, even by a door)
  // (a horse on its way after a whistle, or one just bought or picked at the stable and waiting a few steps off: E gets
  // on it too, rather than opening the door again; the horse walks up if it isn't close enough yet)
  const fresh = h && hd < 14 && (P.horseComing || (P.horsePickedAt && performance.now() - P.horsePickedAt < 8000));
  if (d && !(mount && (hd < d.dist || called)) && !fresh) door = d;
  // (one prompt a frame: the later ones below take over from the earlier, and hud.prompt is called once at the end, so the
  // prompt never flickers off and on within a frame, which kept restarting its fade-in on a phone)
  let say = door ? (door.id === 'cabin' ? 'Go into your cabin' : door.prompt) : mount || fresh ? 'Get on your horse' : null;
  let act = door ? () => openCounter(door.id) : null;
  // a camp's foreman close by (src/missions/delivery.js): E talks to him about an order
  // (just got down beside a foreman, the horse still at his elbow: E talks rather than getting straight back on)
  const talkFirst = mount && P.downAt && performance.now() - P.downAt < 6000;
  if (!door && (!mount || talkFirst) && !fresh && DL && DL.prompt) { say = DL.prompt; act = () => DL.talk(); }
  // in sight of the deer job's herd (src/missions/deerjob.js): E sets the camera up (before getting on the horse)
  if (!door && !fresh && DJ && DJ.prompt) { say = DJ.prompt; act = () => DJ.setUp(); }
  // a job's person close by (src/jobfolk.js): E does what they ask (the wagon rolls, the camera goes up, the sheriff's desk)
  if (!door && (!mount || talkFirst) && !fresh && JF && JF.prompt) { say = JF.prompt; act = () => JF.talk(); }
  // at the target range (src/missions/shooting.js): E by Miss Opal takes up her six-shooter
  if (!door && !fresh && SR && SR.prompt) { say = SR.prompt; act = () => SR.start(); }
  hud.prompt(say);
  if (act && I.enabled && I.tap('KeyE')) act();
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
  if (DL) for (const m of DL.marks()) add(m.id, m.icon, m.x, m.z, m.label);   // (the store or the camp for a delivery)
  if (WJ) { const w = WJ.where(); add('wagon', 'job', w.x, w.z, 'Protect the wagon'); }
  if (DJ) for (const m of DJ.marks()) add(m.id, m.icon, m.x, m.z, m.label);   // (the deer job's herd)
  if (SR) for (const m of SR.marks()) add(m.id, m.icon, m.x, m.z, m.label);   // (the target range)
  if (LJ) for (const m of LJ.marks()) add(m.id, m.icon, m.x, m.z, m.label);   // (the gang's cache, or the sheriff's office with the loot)
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

// the town's sounds each frame of play (quieter and muffled inside the cabin; dipped under the action music and Hob)
function townSounds(dt, indoor) {
  if (!AMBI || !P) return;
  const m = WJ && WJ.music ? WJ.music.state() : null;
  if (SHOUT && !indoor) SHOUT.update(dt, { P, I });   // (the player's shouts: a spur, a pull-up, a hello, a job done)
  AMBI.update(dt, { at: P.position, flock: townLifeNow(), P, D, HS, farm, RU, SH, PG, traffic, indoor, music: m ? Math.min(1, m.action + (m.trail > 0.05 ? 0.4 : 0)) : 0, voice: !!(SHOUT && SHOUT.speaking) });
}

// ── EACH FRAME ───────────────────────────────────────────────────────────────────────────────────────────────────
let last = performance.now(), frames = 0, fpsT = last, fpsNow = 0, needDraw = false, drawn = { calls: 0, triangles: 0 };
function step(dt) {
  if (!W) return;
  const home = !!(cabin && cabin.inside);   // (in the cabin only it is drawn: the town waits)
  if (state === 'play' && JF) JF.update(paused || home ? 0 : dt, { hidden: paused || home || atCounter() });   // (the job folk: before the doors, which show their prompt)
  townLife(W, state === 'play' && (paused || home) ? 0 : dt, P, D);   // the chickens about the town (made on the first call)
  if (state === 'play') {
    // (a horse picked at the stable stays "just picked" while the stable's panel is open: E after closing it gets on)
    if (paused && P && P.horsePickedAt > performance.now() - 8000) P.horsePickedAt = performance.now();
    if (paused) { if (needDraw) { needDraw = false; if (home) cabin.render(); else W.render(); } return; }
    if (home) { door = null; townSounds(dt, true); cabin.update(dt); cabin.render(); return; }   // (no town door while inside: E and the prompt are the cabin's)
    if (atCounter()) hud.prompt(null); else if (!(cabin && cabin.busy)) doors();
    P.update(dt);
    if (D) D.update(dt);
    if (cabin) cabin.town(dt);
    // (the wagon's gang took the shared times trainer's wave: back at the herd, the round-up deals its own afresh, but
    // never while the gang's wave is still open beside the wagon, or the two jobs take the trainer from each other)
    if (WJ && WJ.tookTrainer && RU.near && !(WJ.near && WJ.wave && !WJ.wave.done)) { WJ.tookTrainer = false; RU.newWave(); }
    RU.update(dt);
    if (farm) farm.update(dt, P.position);
    if (HS) HS.update(dt, P.position);   // (the farm animals behind the cabin; their goods are laid up over play time)
    if (SH) SH.update(dt);
    if (PG) PG.update(dt);
    if (SJ) SJ.update(dt);   // (after the player: it places the camera while the counter is open)
    if (camps) camps.update(dt, P.position);   // (the camps' people and campfires)
    if (deer) deer.update(dt, { at: P.position, onHorse: P.onHorse, speed: P.speed, eye: camera.position });   // (the wild deer)
    if (DL) DL.update(dt);
    if (WJ) WJ.update(dt);
    if (DJ) DJ.update(dt);   // (after the player: it places the camera while the viewfinder is up)
    if (SR) SR.update(dt);   // (after the player: it places the camera while the six-shooter is up)
    if (LJ) LJ.update(dt);
    hob.update(dt, P.position, { hold: !!((JF && JF.speaking()) || (SR && SR.speaking())) });   // (on a phone, Hob waits while a job person is talking)
    if (stage) stage.update(dt, P.position);
    if (traffic) { traffic.keepView = SJ && SJ.active && !P.cam.enabled ? camera : null; traffic.update(dt, P.position, camera.position); }   // (no wagon through the store counter's picture)
    townSounds(dt, false);
    W.update(dt); W.render();
    if (SR) SR.draw();   // (the six-shooter, drawn over the valley)
    AUD.listen(camera);
    compass();
    if (I.touch) hud.touch(true);
  } else if (state === 'title') {
    titleCam(dt); W.update(dt); W.render();
  }
}
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (PERF) renderer.info.reset();   // (the frame's count starts here: see autoReset above)
  step(dt);
  if (PERF && renderer.info.render.calls) drawn = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };   // (the last frame that drew: a paused game draws only now and then)
  frames++;
  if (now - fpsT > 500) {
    fpsNow = frames * 1000 / (now - fpsT); frames = 0; fpsT = now;
    if (PERF && W) {
      const info = drawn;
      // (the third line: the animals or folk of the job in view; none in the cabin or away from every job)
      const job = cabin && cabin.inside ? '' : SJ && SJ.active ? `${SJ.state().people.length} customers` : PG && PG.near ? `${PG.pigs.length} pigs`
        : SH && SH.near ? `${SH.sheep.length} sheep` : RU && RU.near ? `${RU.targets.length} cattle` : WJ && WJ.near ? `${WJ.targets.length} riders` : '';
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
// the camps (src/camps.js): out front, where a horse with crates is unloaded, facing the camp
for (const id of ['cow', 'hollis', 'survey']) SPOTS['camp-' + id] = () => { const c = camps && camps.byId(id); if (!c) return W.places.spawn; return { x: c.drop.x, z: c.drop.z, rot: Math.atan2(c.x - c.drop.x, c.z - c.drop.z) }; };
// beside the wagon, facing the way it rolls
SPOTS.wagon = () => { if (!WJ) return W.places.spawn; const w = WJ.where(), q = WJ.road.at(WJ.state().s); return { x: w.x - q.nx * 5, z: w.z - q.nz * 5, rot: q.h }; };
// at the target range, a couple of steps behind the firing line, facing downrange (Shooting mode)
SPOTS.range = () => { if (!SR) return W.places.spawn; const L = SR.layout, p = L.at(0.6, -2.4); return { x: p.x, z: p.z, rot: L.rot }; };
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
  // a wagon on the road coming toward the player (from about 70 m up the road)
  wagon(dir, kind, o = {}) { if (!traffic || !P) return null; return traffic.sendNear(P.position, { dir, kind, ...o }); },
  dog(kind = 'shiba', name = 'Biscuit') { if (!rider) return; rider.owned.dog = { kind, name }; saveRider(rider); makeDogIfOwned(); },
  box(tier) { if (!rider) return; (rider.lockboxes = rider.lockboxes || []).push({ tier: tier || boxTier(rider), from: 'loot' }); saveRider(rider); refresh(); },
  // the title's backdrop camera: where round the square it is now, and (for a rig trying views) its settings
  orbit(at = null, o = {}) { fixedAt = at; Object.assign(TITLE_CAM, o); titleCam(0); },
};
{ const m = dev.mission; dev.mission = (name, ...a) => (name === 'delivery' ? !!(DL && DL.orderFrom(a[0] || 'cow')) : m(name, ...a)); }   // (an order from a camp, without riding out to it)
{ const m = dev.mission; dev.mission = (name, ...a) => { if (name !== 'wagon') return m(name, ...a); if (!WJ) return false; dev.goto('wagon'); WJ.newWave(); return true; }; }   // (a gang at once, beside the wagon)
{ const m = dev.mission; dev.mission = (name, ...a) => { if (name !== 'deer') return m(name, ...a); const H = DJ && DJ.herd(); if (!H) return false; const sq = W.places.square, l = Math.hypot(sq.x - H.mid.x, sq.z - H.mid.z) || 1, x = H.mid.x + (sq.x - H.mid.x) / l * 32, z = H.mid.z + (sq.z - H.mid.z) / l * 32; P.teleport(x, z, Math.atan2(H.mid.x - x, H.mid.z - z)); return true; }; }   // (32 m from the deer job's herd, on the town's side)
{ const m = dev.mission; dev.mission = (name, ...a) => { if (name !== 'range') return m(name, ...a); if (!SR) return false; dev.goto('range'); setTimeout(() => { if (SR && SR.prompt) SR.start(); }, 400); return true; }; }   // (the six-shooter up at the range, in Shooting mode)
// the homestead behind the cabin: between the cabin's back wall and the animals' homes, looking out at them; an animal
// of a kind (hen, pig, sheep, cow) or goods in the saddlebags without buying
SPOTS.yard = () => { if (!HS) return W.places.spawn; const L = HS.layout, p = L.at(0, 5.6); return { x: p.x, z: p.z, rot: L.rot }; };
Object.assign(dev, { animal: (kind = 'hen', name = '', young = false) => !!(HS && HS.dev.give(kind, name, young)), goods: (n = 30) => { if (HS) HS.dev.goods(n); } });
// loot the gang: beside the gang's cache, or at the sheriff's office where it's handed back; mission('loot') rides to the cache
SPOTS.cache = () => (LJ && LJ.dev.at()) || W.places.spawn;
SPOTS['loot-town'] = () => (LJ ? LJ.dev.town() : W.places.spawn);
{ const m = dev.mission; dev.mission = (name, ...a) => { if (name !== 'loot') return m(name, ...a); if (!LJ) return false; return dev.goto('cache'); }; }
dev.lootLoad = () => !!(LJ && LJ.dev.load());   // (straight to the cache with the horse, to load it)
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
  add('take a delivery order', () => dev.mission('delivery'));
  add('protect the wagon', () => dev.mission('wagon'));
  add('deer photographs', () => dev.mission('deer'));
  add('the shooting range', () => dev.mission('range'));
  add('loot: the cache', () => dev.mission('loot'));
  add('loot: load it', () => dev.lootLoad());
  add('open a lock box', () => dev.lockbox());
  add('give a lock box', () => dev.box());
  add('give saddle', () => dev.saddle('plain'));
  add('give dog', () => dev.dog('shiba', 'Biscuit'));
  add('give farm animals + goods', () => { for (const k of ['hen', 'hen', 'pig', 'sheep', 'cow']) dev.animal(k); dev.goods(30); });
  add('send a wagon', () => dev.wagon());
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
  roundup: { get: () => RU }, traffic: { get: () => traffic }, sheep: { get: () => SH }, pigs: { get: () => PG }, wagon: { get: () => WJ }, farm: { get: () => farm }, shops: { get: () => shops }, dog: { get: () => D }, input: { get: () => I }, hob: { get: () => hob },
  door: { get: () => door }, store: { get: () => SJ }, paused: { get: () => paused }, mode: { get: () => mode }, cabin: { get: () => cabin },
});
Object.defineProperties(BM, { deer: { get: () => deer }, deerjob: { get: () => DJ }, jobfolk: { get: () => JF } });
Object.defineProperties(BM, { range: { get: () => SR } });   // (the target range, in Shooting mode)
Object.defineProperties(BM, { camps: { get: () => camps }, delivery: { get: () => DL }, homestead: { get: () => HS }, loot: { get: () => LJ } });   // (the camps and their deliveries; DL.rob() is the bandits' hook)
Object.assign(BM, {
  dev, hud, title: T, camera, renderer, screenOf, prices: PRICES, loading,
  fps: (seconds = 3) => new Promise((res) => { let n = 0; const a = performance.now(); const f = () => { n++; if (performance.now() - a < seconds * 1000) requestAnimationFrame(f); else res(n * 1000 / (performance.now() - a)); }; requestAnimationFrame(f); }),
  // a frame's real cost, not held to the screen's refresh: n frames drawn back to back, each waited for
  frameMs: (n = 60) => { const gl = renderer.getContext(), px = new Uint8Array(4); let worst = 0; const a = performance.now();
    for (let i = 0; i < n; i++) { const f0 = performance.now(); step(1 / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); worst = Math.max(worst, performance.now() - f0); }
    last = performance.now(); return { avg: (performance.now() - a) / n, worst }; },
});
