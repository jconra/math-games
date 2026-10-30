// MATHWOOD VALLEY: the boot, the title screen, the ride, and the frame loop.
//
// The valley loads behind the title screen (its progress goes to the title's loading bar). RIDE OUT drops the rider in
// the little western town: Old Hob points the way, glowing hoofprints lead out to the pasture, and the round-up runs
// there (src/missions/roundup.js). The stable keeper opens its counter (src/shop.js); the general store and the sheriff's
// office are walked into, and each spot inside does its own thing as it is faced (src/townrooms.js, src/usespots.js:
// the store's food, hats and animals, its counter's job; the sheriff's lock boxes); walking into a building the camera
// goes to first person (src/camera.js FIRST); the cabin's door lets you in to your own cabin, in first person (src/cabin/cabin.js). "Just lock
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
//   ?dof                      depth of field in the close-ups (a builder up, the dock, the cabin), gaming tier only: src/fx/dof.js
// For rigs: window.BM = { world, player, rider, state, dev: { gold(n), goto(place), mission(name), lockbox(), tier,
//   skill(strand, pct, { placed }), skills(), level(place, id, { placed }), levels(), ... }, skills (the src/math/skill.js
//   module), levels (src/levels/model.js), facts (src/math/facts.js), feedback (src/feedback.js),
//   roundup, hud, shops, title, input, camera, renderer, fps(s), frameMs(n), screenOf(steer or object), checklist, ready }
import * as THREE from 'three';
import { watchGraphics, openGfxCheck, gfxReport } from './gfxcheck.js';   // (first: its load retries and counts go on before anything loads)
import { FB } from './feedback.js';
import { flagCard, rateJob, menuRows } from './ui/flag.js';   // (first: its key guard for the note boxes goes on before any of the game's key listeners)
import './curvetangent.js';   // (the roads' per-frame curve sums without the garbage)
import { makeWorld } from './world.js';
import { chooseTier, wantAntialias } from '../world/quality.js';
import { loadFolk, checkFades } from './actors/folk.js';
import { loadAnimals } from './actors/animals.js';
import { FUR_TIER } from './actors/dogfur.js';
import { warmHorses, horseRenderer } from './actors/horses.js';
import { makeHorsePen } from './horsepen.js';
import { makeStableLife } from './stablelife.js';
import { makeInput } from './input.js';
import { makePlayer, MOVE } from './player.js';
import { makeDog, dogKind } from './dog.js';
import { townLife, townLifeNow, preloadChickens } from './townlife.js';
import { showTitle, faceSVG } from './ui/title.js';
import { openStats } from './ui/stats.js';
import { openLevels, placeOfJob } from './ui/levels.js';
import { makeHud } from './ui/hud.js';
import { makeTools } from './ui/tools.js';
import { waveSum, buildSum } from './math/jobsums.js';
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
import { makeHob, HOB } from './hob.js';
import { makeJobFolk } from './jobfolk.js';
import { howdyCamera, hideHowdies } from './ui/howdy.js';
import { makeTownPeople, addHomes } from './townpeople.js';
import { makeStage } from './stage.js';
import { makeSaloonFolk } from './saloonfolk.js';
import { makeGraphTeacher } from './graphteacher.js';
import { makeBandCard } from './ui/bandcard.js';
import { makeJobsBoard } from './jobsboard.js';
import { makeTraffic } from './traffic.js';
import { roadCurve } from './wagon.js';
import { makeCabin } from './cabin/cabin.js';
import { makeHomestead } from './homestead.js';
import { makeAudio, volumeRow } from './audio/audio.js';
import { makeAmbience } from './audio/ambience.js';
import { makeDoorSound } from './audio/doorsound.js';
import { makeShouts } from './audio/shouts.js';
import { makeReadAloud } from './audio/readaloud.js';
import { sayLine, talking, hush as hushVoice } from './audio/sayline.js';
import { openLockbox, TIER_NAME } from './lockbox/index.js';
import { loadRiders, saveRider, earn, recordLockbox, titleOf, nextTitle, badgesOf, cleanBoxes, BOX_TIERS, jobOn, readMode, nextReadMode, readModeWords } from './save.js';
import { canShoot } from './gun.js';
import * as SKILLS from './math/skill.js';
import * as LEVELS from './levels/model.js';
import * as FACTS from './math/facts.js';
import { makeChecklist, openWhatsLeft } from './ui/completion.js';
import { makeBuildSites } from './buildsite.js';
import { makeWindmillJob } from './windmilljob.js';
import { makeBridgeJob } from './bridgejob.js';
import { makeFishingJob, DOCK } from './fishingjob.js';
import { makeDof } from './fx/dof.js';
import { completion, goalsOf } from './completion.js';
import { graphicsRow } from './ui/graphics.js';
import { makeShiftKeeper } from './shiftkeeper.js';
import { makeUnstick } from './unstick.js';
import { makeFeeding } from './feeding.js';
import { makeUseSpots } from './usespots.js';
import { makeTownRooms } from './townrooms.js';
import { pickAction } from './usespotsplan.js';

export const BUILD = '1 (2026-10-09)';
const Q = new URLSearchParams(location.search);
const DEV = Q.has('dev'), PERF = Q.has('perf');
const LOOK = Q.get('look') === 'summer' ? 'summer' : 'green';
const $ = (id) => document.getElementById(id);
const BM = window.BM = { ready: false, state: 'loading', errors: [], build: BUILD };
addEventListener('error', (e) => BM.errors.push(String(e.message)));

// ── THE RENDERER, THE CAMERA, THE TIER ───────────────────────────────────────────────────────────────────────────
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: wantAntialias(), powerPreference: 'high-performance' });   // (off where the tier will be potato: forced, chosen, remembered for this card, or detected: world/quality.js)
renderer.setSize(innerWidth, innerHeight);
watchGraphics(renderer, { scenes: () => [W && W.scene] });   // (context lost and restored, shader errors: the menu's Graphics check, src/gfxcheck.js)
BM.gfxReport = () => gfxReport({ renderer, quality, scenes: [W && W.scene], errors: BM.errors });   // (the Copy text, for rigs)
// (?perf counts every pass of a frame: the valley, then the six-shooter over it. Left to itself each render() would wipe
// the count, and the readout would show only the gun's pass)
if (PERF) renderer.info.autoReset = false;
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 5000);
howdyCamera(camera);   // (the Howdy bubbles over the townsfolk and the wagon drivers are placed with it: src/ui/howdy.js)
const quality = chooseTier(renderer);
FUR_TIER.on = quality.tier !== 'potato';   // (the dogs' fur shader: off on the lowest tier, src/actors/dogfur.js; set before any dog is made)

// ── THE TITLE SCREEN (shown at once; the valley loads behind it) ───────────────────────────────────────────────────
const T = showTitle($('title-root'), { riders: loadRiders(), build: BUILD, onRide: (r) => ride(r), onLockboxes: (r) => justBoxes(r) });
T.setProgress(0.01, 'Riding into the valley');
// the game's sound (src/audio/audio.js): it wakes on the first click or key press, and is quiet on the title and while paused
const AUD = makeAudio(); AUD.hold('title', true);
Object.defineProperty(BM, 'stage', { get: () => stage }); Object.defineProperty(BM, 'bandCard', { get: () => bandCard }); BM.audio = AUD;
Object.defineProperty(BM, 'saloonFolk', { get: () => saloonFolk });
Object.defineProperty(BM, 'graphs', { get: () => GT });
const hud = makeHud($('hud-root'), {
  onMenu: () => openMenu(),
  onPrompt: () => { if (paused) return; if (door) openCounter(door.id); else if (I) I.press('KeyE'); },
  onTouch: (code) => { if (I) I.press(code); },
});
// "Confusing?" on the field jobs' question card (the round-up, the farm jobs, the wagon's gang): only while a question
// is up there (not on a travel card, nor on "Wave done!")
flagCard(hud.ruleEl, () => fieldQuestion(), { show: () => !hud.ruleEl.hidden && !/\bis-(travel|job)\b/.test(hud.ruleEl.className) && !!askingJob() && askingJob() !== 'panel' });
// THE TOOLS (src/ui/tools.js): a strip along the bottom, from any job: Work it out (the sum on screen in columns: each
// job hands over the sum of the part it is on, src/math/jobsums.js; the store's and the deliveries' own order sum; the
// lock box's part being asked, from the box's own Work it out button; a builder's card, from the button by its "Done
// for now"; nothing to read: the entry to type a sum by hand), the times chart (the rider's facts, green and red) and the
// level tool for the place the rider is at (its arrows step the level by hand, unless the rider was made with "Let the
// rider pick levels" off). The game waits while a tool is open.
const workJob = () => (BOX ? 'boxes' : SJ && SJ.active ? 'store' : DL && DL.active ? 'delivery' : askingJob());
// a builder's card (the windmill's or the bridge's: their handles give its kind and answer, the card's line on the page
// gives its numbers; the fishing's: its own sum)
function builderSum() {
  if (FJ && FJ.builder) return FJ.workSum();
  const B = (WMJ && WMJ.builder) || (BRJ && BRJ.builder), q = B && B.handle && B.handle.question ? B.handle.question() : null;
  const line = q && document.querySelector('.bsite #question:not([hidden]) > p');
  return q && !q.teach ? buildSum(q, line ? line.textContent : '') : null;
}
// (the round-up's sum is worked out here from its wave, as the wagon's own is: src/missions/roundup.js is left as it is)
const JOB_SUM = { store: () => SJ && SJ.workSum(), delivery: () => DL && DL.workSum(), range: () => SR && SR.workSum(),
  roundup: () => RU && RU.near ? waveSum(RU.wave) : null, sheep: () => SH && SH.workSum(), pigs: () => PG && PG.workSum(),
  deer: () => DJ && DJ.workSum(), wagon: () => WJ && WJ.workSum(), loot: () => LJ && LJ.workSum(),
  build: () => builderSum(), boxes: () => (BOX ? BOX.workSum() : null) };
// the levels place the rider is at, for the level tool: the job asking (or the one the rider chose), the lock boxes' place
const toolsPlace = () => { const j = jobNow(); return j === 'boxes' ? 'lockbox' : placeOfJob(j); };
// HELP on the tools strip (src/ui/askhelp.js: a helper is always one press away and never opens by itself): the job
// asking's own help for the question the rider is on. Only these jobs have a helper to show; elsewhere the button hides.
const JOB_HELP = { sheep: () => SH, pigs: () => PG, roundup: () => RU, range: () => SR, deer: () => DJ };
const helpJob = () => { const f = JOB_HELP[workJob()]; const J = f && f(); return J && J.help && (!J.canHelp || J.canHelp()) ? J : null; };
// THE LEVEL MOVED BY HAND (the level tool's arrows): the questions out at that place now, not yet answered, are made
// again at the new level straight away (the healed sheep, the penned steers, an answered part stay as they are). Each
// job's relevel() does its own; the lock box's place is its own panel's (src/lockbox/), not changed from here.
const RELEVEL = { sheep: () => SH, pigs: () => PG, roundup: () => RU, store: () => SJ, deliveries: () => DL, graphs: () => GT };
function relevel(placeId) {
  const f = RELEVEL[placeId], J = f && f();
  if (!J || !J.relevel) return false;
  try { return !!J.relevel(); } catch (e) { console.error(e); return false; }
}
const TOOLS = makeTools({ hud, rider: () => rider,
  sum: () => { const f = JOB_SUM[workJob()]; return f ? f() || null : null; },
  place: () => (state === 'play' ? toolsPlace() : null),
  onLevel: (placeId) => { if (rider) saveRider(rider); relevel(placeId); },
  help: () => { const J = helpJob(); return J ? J.help() : false; },
  canHelp: () => state === 'play' && !!helpJob(),
  own: () => (SJ && SJ.active ? !!SJ.openLong() : DL && DL.active ? !!DL.openLong() : false),   // (false: already up: the entry instead)
  // (from the lock box too: its own button, the HUD being under the box; "Just lock boxes" from the title as well)
  canOpen: () => (state === 'play' || (state === 'boxes' && !!BOX)) && [...pausedBy].every((w) => w === 'tools' || (w === 'box' && !!BOX)),
  speak: (text) => { if (rider && SKILLS.readAloud(rider)) sayLine(text); },
  onOpen: () => pause('tools'), onClose: () => resume('tools'),
  onTreat: () => { if (FEEDER && state === 'play' && !paused) FEEDER.feed(); } });   // (the apple button: a treat to the horse in reach, src/feeding.js)
BM.tools = TOOLS;

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
  addHomes(W);   // (the townsfolk's homes as W.places.homes, among the buildings the camera keeps out of: before the player is made)
  I = makeInput(canvas, { camera }); I.enabled = false;
  if (state === 'loading') state = 'title';
  titleCam(0);
  W.update(0.016); W.render();
  if (state !== 'boxes') canvas.classList.add('is-on');   // ("Just lock boxes" keeps its plain dark backdrop)
  T.setProgress(1, 'Ready to ride');
  // (the governor's curtains, world/governor.js: the scenery changes only where the change is hidden)
  if (W.governor) W.governor.scene = () => (state === 'title' ? 'title' : state !== 'play' ? 'away' : paused ? 'paused' : cabin && cabin.inside ? 'cabin' : 'play');
  BM.ready = true;
  setTimeout(() => { try { roadCurve(W); } catch (e) { console.warn('the road could not be laid', e); } }, 300);   // (the wagons' road, worked out once while the title shows, so riding out doesn't wait on it)
  // (the new horse loaded and its shaders built for the valley's lights while the title shows: src/actors/horses.js)
  horseRenderer(renderer);
  setTimeout(() => { BM.horsesWarm = warmHorses({ W, lib: animals, renderer, camera }); }, 600);
}).catch((e) => { console.error('Mathwood Valley could not load the valley', e); T.setProgress(0, 'The valley could not load: please reload the page'); });

// ── THE GAME'S STATE ─────────────────────────────────────────────────────────────────────────────────────────────
// state: 'loading' | 'title' | 'play' | 'boxes' (just lock boxes, from the title)
let state = 'loading', paused = false, pausedBy = new Set();
let rider = null, P = null, D = null, RU = null, hob = null, shops = null, door = null, menu = null, boxOpen = false;
let BOX = null;   // the lock box open (its handle: src/lockbox/panel.js), for the tools' Work it out on its part being asked
let stage = null;   // the band on the saloon's stage and its music (src/stage.js)
let saloonFolk = null;   // the townsfolk in the saloon's hall, listening and clapping (src/saloonfolk.js)
let GT = null;   // the graph teacher at the saloon's chalkboard and his card (src/graphteacher.js)
let bandCard = null;   // the band's card: its songs and a break, asked for at the front of the stage (src/ui/bandcard.js)
let traffic = null;   // wagons travelling the road through the valley now and then (src/traffic.js)
let AMBI = null;   // the town's sounds: animals, birds, work out back, the creek, the horse's hooves (src/audio/ambience.js)
let SHOUT = null;   // the player's own voice: hyah, whoa, yeehaw, howdy (src/audio/shouts.js)
let READ = null;    // the young topics' cards read aloud, and a word after an answer (src/audio/readaloud.js)
let cabin = null;   // the player's cabin: walk in through its door (src/cabin/cabin.js)
let farm = null, SH = null;   // the farm north of town (src/farm.js) and its sick-sheep job (src/missions/sheep.js)
let PG = null;   // the farm's loose-pigs job (src/missions/pigs.js)
let SJ = null;   // the general store's counter: word problems on order slips (src/missions/store.js)
let WJ = null;   // protect the wagon: the hold-ups on the road, sent by the jobs board or met on the way (src/missions/wagonjob.js), unless a grown-up turned it off
let HS = null;   // the rider's own farm animals in a yard behind the cabin, and their goods (src/homestead.js)
let PEN = null;  // the pen of horses for sale behind the stable, new ones after each trip out of town (src/horsepen.js)
let STABLE = null;  // the stable's stall horses and its saddle racks (src/stablelife.js: the code-built stable)
let camps = null, DL = null;   // the camps out in the valley (src/camps.js) and their deliveries (src/missions/delivery.js)
let deer = null;   // the wild deer herds out in the valley (src/deer.js)
let DJ = null;   // deer photographs with Miss Wren's box camera (src/missions/deerjob.js), unless a grown-up turned it off
let SR = null;   // target shooting at the range on the east edge of town (src/missions/shooting.js), for every rider
let UNST = null;   // the menu's "I'm stuck: move me": a short trail of good spots the rider stood at (src/unstick.js)
let JF = null;   // a person at each job who says what's going on, and thanks you after (src/jobfolk.js)
let TP = null;   // the townsfolk going about the town, in and out of doors; the jobs borrow them (src/townpeople.js)
let LJ = null;   // loot the gang: the gang's cache out in the valley, handed back at the sheriff's office (src/missions/loot.js), unless a grown-up turned it off
let JB = null;   // the jobs board in the town square: pick a job, the hoofprints lead there (src/jobsboard.js)
let BS = null;   // the build sites: a lab's builder opened in place at its site in the valley (src/buildsite.js)
let WMJ = null;  // the windmill: the miller on the mill hill and the tower built there (src/windmilljob.js)
let FJ = null;   // fishing: the old fisherman and the dock at the lake south of the saloon, fish sold at the store (src/fishingjob.js)
let BRJ = null;  // the bridge: the engineer at the ravine on the west river and the bridge built there (src/bridgejob.js)
let CM = null;   // the checklist: a toast when an item is checked off, the pinned goals in the corner (src/ui/completion.js)
let SK = null;   // the shifts: each job ends after a shift of rounds, with a thank-you, till the next sunrise (src/shiftkeeper.js)
let FEEDER = null;   // the horses' treats: the wild apple trees' apples, the apple button by a horse's head, the hearts (src/feeding.js)
let US = null;   // the look-to-use spots inside the buildings: the prompt over the spot in front (src/usespots.js)
let TR = null;   // the general store and the sheriff's office, worked from inside: their spots, the store's dog (src/townrooms.js)
// may a job deal another round (its day's shift not done); the rounds left today; the job person's polite no
const shiftOpen = (id) => !SK || SK.open(id);
const shiftLeft = (id) => (SK ? SK.left(id) : Infinity);
const shiftNo = (id, o) => { if (SK) SK.decline(id, o); };
const atCounter = () => !!(SJ && SJ.active) || !!(DL && DL.active) || !!(DJ && DJ.active) || !!(SR && SR.active) || !!(BS && BS.active);   // (a builder up at its site, too)   // (or making up a camp's order on the slip)   // (working the counter: the rider stands still, the store's camera)
// a question is up (the checklist's toast waits till it's answered): a panel or a lock box, a counter or a slip, the
// camera or the six-shooter up, the loot's slip, or a wave of a job under way where the player is
const asking = () => state !== 'play' || paused || boxOpen || atCounter() || !!(cabin && cabin.busy) || !!(LJ && LJ.active)
  || !!(RU && RU.near && RU.wave && !RU.wave.done) || !!(SH && SH.near && SH.flock && !SH.flock.done)
  || !!(PG && PG.near && PG.batch && !PG.batch.done) || !!(WJ && WJ.near && WJ.wave && !WJ.wave.done);
// ...and which job is asking (Old Hob says only that job's lines meanwhile: src/hob.js), or 'panel' for a lock box, a
// menu or the cabin, or null when nothing is asked
function askingJob() {
  if (state !== 'play' || paused || boxOpen || !!(cabin && cabin.busy)) return 'panel';
  if (BS && BS.active) return 'build';   // (a builder up at its site: its own questions)
  if (SJ && SJ.active) return 'store';
  if (DL && DL.active) return 'delivery';
  if (DJ && DJ.active) return 'deer';
  if (LJ && LJ.active) return 'loot';
  if (SR && SR.active) return 'range';
  if (RU && RU.near && RU.wave && !RU.wave.done) return 'roundup';
  if (SH && SH.near && SH.flock && !SH.flock.done) return 'sheep';
  if (PG && PG.near && PG.batch && !PG.batch.done) return 'pigs';
  if (WJ && WJ.near && WJ.wave && !WJ.wave.done) return 'wagon';
  return null;
}
// a hold-up met on the way is a call for help, never the wagon's shift: its counter stays off the purse meanwhile
const notOnTheWay = (id) => (id === 'wagon' && WJ && WJ.ambush && !WJ.ambush.board ? null : id);
// how near (m) a camp's middle or a gang hideout counts as found for the checklist
const FOUND_NEAR = { camp: 28, hideout: 30 };

function pause(why) {
  pausedBy.add(why);
  AUD.hold('pause', pausedBy.has('menu'));   // (only the menu silences the game: the band plays on behind a lock box or any other card, the game's maker's wish)
  if (bandCard) bandCard.close();   // (the band's card never stays up under a panel)
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
}
function resume(why) {
  pausedBy.delete(why);
  AUD.hold('pause', pausedBy.has('menu'));
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
  last = performance.now();
}

// ── RIDING OUT ───────────────────────────────────────────────────────────────────────────────────────────────────
async function ride(r) {
  await loading;
  if (!W) return;
  rider = r;
  state = 'play'; pausedBy.clear(); paused = false;
  W.timeRuns = true;   // (the sun moves while riding: a day in 24 minutes of play, src/world.js)
  T.hide();
  canvas.classList.add('is-on');
  I.enabled = true;
  P = makePlayer({ W, folk, animals, rider, input: I, camera, say: (t) => hud.toast(t) });
  UNST = makeUnstick({ blocked: W.blocked, wet: (x, z) => W.waterAt(x, z) > 0.3 });
  if (W.V && W.V.FENCE) W.V.FENCE.near = trafficThings;   // (the town's gates swing open for the rider, the horse, the dog, the cattle, the townsfolk)
  makeDogIfOwned();
  cardBy = null; theJob = null; shownCard = null; jobCardObj = null; jobCardKey = ''; worked = false; for (const k in lastCard) delete lastCard[k];
  // (no babble voice: reading works better; src/audio/voice.js is kept for the Sound Lab. A rider who can't read yet
  // hears Hob's lines in the browser's voice, each in turn: src/audio/sayline.js)
  hob = makeHob({ W, hud, rider, I, roads: roadLines, voice: { speak: (text) => { if (rider && SKILLS.readAloud(rider)) sayLine(text); }, stop: () => {} } });
  { const heard = hob.event; hob.event = (n, d) => { const own = !!(SK && SK.heard(n, d)); heard(n, d); if (JF) JF.heard(n, own ? { ...(d || {}), shiftEnd: true } : d); if (SHOUT) SHOUT.heard(n, d); if (JB) JB.heard(n); jobHeard(n, d); if (JOB_ENDS[n]) jobOver(JOB_ENDS[n]); }; }   // (the job folk hear the jobs too: their thank-yous; and the player's yeehaw at a job's end; the jobs board: at work at a job, its tracks give way; the shifts first: a round counted, and at a shift's end its own thank-you in place of the job's usual one)
  stage = makeStage({ W, folk, audio: AUD, camera, speak: (text) => { if (rider && SKILLS.readAloud(rider)) sayLine(text); } });   // (camera: the ears; speak: the band's answer read out to a rider who can't read yet)
  traffic = makeTraffic({ W, animals, folk, audio: AUD, obstacles: trafficThings, camps: () => camps, camera, riding: () => !!(P && P.onHorse) });   // (camera: wagons and travellers dissolve in and out of sight)
  { let ends = null; W.roadEnds = () => {   // (the road's two ends: riding on past one into the mist comes out by the other, src/world.js W.wrap)
    const c = traffic && traffic.road; if (!c) return null;
    if (!ends || ends.c !== c) {
      const a = c.getPoint(0), b = c.getPoint(1), ta = c.getTangent(0), tb = c.getTangent(1);
      const A = { x: a.x, z: a.z, dx: -ta.x, dz: -ta.z }, B = { x: b.x, z: b.z, dx: tb.x, dz: tb.z };   // (dx, dz: out past the end)
      ends = a.x < b.x ? { c, west: A, east: B } : { c, west: B, east: A };
    }
    return ends; }; }
  AMBI = makeAmbience({ audio: AUD, W }); BM.ambience = AMBI;
  if (W.V && W.V.CODE) W.V.CODE.onDoor = makeDoorSound({ audio: AUD }).play;   // (the town's doors' creak, thunk and flap: src/audio/doorsound.js)
  // (one voice at a time: a shout waits while a card is read, and a card waits for a shout to finish)
  SHOUT = makeShouts({ audio: AUD, hush: () => !!(READ && READ.speaking) }); BM.shouts = SHOUT;
  // (a card's clips wait while the browser's voice says a line: Hob's directions, a why)
  READ = makeReadAloud({ audio: AUD, on: () => !!(rider && rider.readAloud !== false), busy: () => !!(SHOUT && SHOUT.speaking) || talking() }); BM.read = READ;
  AUD.hold('pause', false); AUD.hold('title', false);
  HS = makeHomestead({ W, animals, rider, hud, hob, refresh });
  PEN = makeHorsePen({ W, animals, rider, camera, player: () => P, shadows: !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true) });
  shops = makeShops({ W, rider, say: (t, k) => hud.toast(t, k), extra: { ...HS.shop, stable: PEN.shop },
    // (the store and the sheriff's desk worked from inside, the stable's by its keeper beside its doors: no counter at
    // their doors, so E there opens the door)
    indoors: (id) => (id === 'stable' ? !!(JF && JF.people && JF.people.some((r) => r.id === 'keeper')) : !!(TR && TR.frame(id === 'store' ? 'generalStore' : id))),
    onOpen: () => pause('counter'), onClose: () => resume('counter'),
    onBuy: (what) => { refresh(); if (what === 'saddle' || what === 'horse') P.refreshOwned(); if (what === 'dog') { makeDogIfOwned(); if (cabin) cabin.dogsChanged(); } if (what === 'hat' && P && P.person) { if (!P.person.hat) P.person.hatOn(); P.person.setHat(rider.look.hatStyle); } hob.event(what); },
    onLockbox: (box, o) => openBox(box, o), onStoreJob: jobOn(rider, 'store') ? () => { if (!SJ) return; if (!shiftOpen('store')) { shiftNo('store'); return; } SJ.start(); } : null });   // (the day's shift done: the storekeeper's polite no)   // (no "Mind the counter" when a grown-up turned the store job off)
  STABLE = makeStableLife({ W, animals, rider, camera, player: () => P, shops, say: (t) => hud.toast(t), shadows: !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true) }); BM.stable = STABLE;
  FEEDER = makeFeeding({ W, rider, player: () => P, hud, tools: TOOLS, audio: AUD, pen: () => PEN, stable: () => STABLE, refresh });
  cabin = makeCabin({ W, renderer, camera, animals, rider, hud, input: I, audio: AUD, player: () => P, follower: () => D,
    onBuy: () => refresh(), onLockbox: (box, o) => openBox(box, o) });
  // (the round-up's Hob also hears a whole wave roped: now and then a thank-you calf from the rancher)
  const herdHob = Object.create(hob); herdHob.event = (n, d) => { hob.event(n, d); if (HS && n === 'waveDone') HS.jobDone(n); };
  RU = makeRoundup({ W, animals, P, I, camera, canvas, rider, hud: roundupHud(), hob: herdHob, refresh, read: READ, open: () => shiftOpen('roundup') });
  farm = makeFarm({ W, animals });
  // (the farm jobs' Hob also hears a whole flock healed or a batch penned: now and then a thank-you lamb or piglet)
  const farmHob = Object.create(hob); farmHob.event = (n, d) => { hob.event(n, d); if (HS && (n === 'flockDone' || n === 'pigsDone')) HS.jobDone(n); };
  // (every job is on unless a grown-up turned it off on the title: save.js jobOn; the round-up and the lock boxes always are)
  SH = !jobOn(rider, 'sheep') ? null : makeSheepJob({ W, animals, farm, P, I, camera, canvas, rider, hud: tagHud('sheep'), hob: farmHob, refresh, defer: (at) => !!(PG && PG.wants(at)),
    open: () => shiftOpen('sheep'), left: () => shiftLeft('sheep') });
  PG = !jobOn(rider, 'pigs') ? null : makePigJob({ W, animals, farm, P, camera, canvas, rider, hud: tagHud('pigs'), hob: farmHob, refresh, open: () => shiftOpen('pigs'), left: () => shiftLeft('pigs') });
  SJ = !jobOn(rider, 'store') ? null : makeStoreJob({ W, folk, P, I, camera, rider, hud: tagHud('store'), hob, refresh, pay: PAY, goods: HS, fish: () => FJ, voice: (k, who) => { if (SHOUT) SHOUT.say(k, who); }, town: () => TP, work: () => TOOLS.work(),
    openBox: (problem, after) => !paused && openBox({ tier: problem.tier, from: 'store' }, { problem, after }),   // (false: not now, the store tries again)
    onStart: () => { I.enabled = false; if (RU) RU.paused = true; hud.prompt(null); hud.rule(null); hud.hint(null); },
    onStop: () => { I.enabled = !paused; if (RU) RU.paused = paused; }, open: () => shiftOpen('store'),
    room: () => (TR && TR.rooms.generalStore) || null });   // (the counter inside the store, once it is built)
  // THE INSIDES: the spots E uses in the store and the sheriff's office (src/usespots.js, src/townrooms.js): the store's
  // food, hats and animals cards, its six-shooter, its counter (the store's job); the sheriff's pile of lock boxes, and
  // the safe where the rider's own boxes are opened
  US = makeUseSpots({ W, camera, player: () => P }); BM.uses = US;
  TR = makeTownRooms({ W, animals, rider, uses: US, camera, shadows: !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true),
    words: { counter: () => (SJ ? 'Work the counter' : null) },   // (a grown-up turned the store job off: the counter has nothing to do)
    act: {
      card: (id) => { if (shops && !shops.isOpen && !paused) shops.open(id); },
      gun: () => { if (!shops) return; const r = shops.buyGun(); if (r && r.note) hud.toast(r.note, r.ok ? 'gold' : ''); },
      counter: () => { if (!SJ || paused) return; if (!shiftOpen('store')) { shiftNo('store'); return; } SJ.start(); },   // (the day's shift done: the storekeeper's polite no)
      boxes: () => { if (paused) return; if (openBox({ tier: boxTier(rider), from: 'sheriff' }, { own: false })) chooseJob('boxes'); },
      own: () => { if (paused) return; const bx = (rider.lockboxes || [])[0]; if (bx) openBox({ tier: bx.tier, from: 'loot' }, { own: true }); },
    } }); BM.rooms = TR;
  // the graph teacher at the saloon's chalkboard: E at the board opens his card (the keys let go while it is up)
  GT = makeGraphTeacher({ W, folk, rider, uses: US, hud, canOpen: () => !paused,
    onOpen: () => { I.enabled = false; hud.prompt(null); chooseJob('graphs'); }, onClose: () => { I.enabled = !paused; } });
  camps = makeCamps({ W, folk, camera, audio: AUD });
  // the build sites: a lab's builder opened right there in the valley (the windmill's at the mill hill); while one is up
  // the rider stands by, the keys and the HUD are the builder's, and the valley goes on round it
  let siteJob = null;   // (the build site open: its job, for the thumbs up or down as it is put away)
  BS = makeBuildSites({ W, camera, canvas, player: () => P, onWork: () => TOOLS.work(),
    obstacles: () => [P && P.person && !(BS && BS.active && BS.active.id === 'fishing') && P.person.root, P && P.horse && P.horse.root, D && D.dog && D.dog.root],   // (at the dock the rider fades away by itself: src/fishingjob.js)
    onStart: () => { siteJob = BS && BS.active ? BS.active.id : null; P.enabled = false; I.enabled = false; if (RU) RU.paused = true; hud.prompt(null); hud.rule(null); hud.hint(null); hud.show(false); },
    onStop: () => { P.enabled = !paused; I.enabled = !paused; if (RU) RU.paused = paused; hud.show(true); jobOver(siteJob, { sat: true }); } });
  WMJ = makeWindmillJob({ W, folk, rider, sites: BS, player: () => P, hud, refresh, audio: AUD, on: jobOn(rider, 'windmill'),   // (off: the miller has no prompt; what was built still stands)
    speak: (text) => { if (rider && SKILLS.readAloud(rider)) sayLine(text); } });   // (the miller's questions read out to a rider who can't read yet)
  BRJ = makeBridgeJob({ W, folk, rider, sites: BS, hud, refresh, camera, audio: AUD, traffic, animals, obstacles: () => [P && P.position, P && P.horse && P.horse.root, D && D.dog && D.dog.root], player: () => P, dog: () => D, speak: (text) => { if (rider && SKILLS.readAloud(rider)) sayLine(text); } });   // (off: the engineer has no prompt; what was built still stands and is used)
  FJ = makeFishingJob({ W, folk, rider, sites: BS, player: () => P, audio: AUD, hud, refresh, renderer, camera, on: jobOn(rider, 'fishing'), speak: (text) => sayLine(text),
    onLanded: () => hob.event('fishLanded') });   // (a round of the fishing's shift)   // (off: the fisherman has no prompt; the dock still stands)
  deer = makeDeer({ W, animals });
  DJ = jobOn(rider, 'hunt') ? makeDeerJob({ W, deer, P, I, camera, canvas, rider, hud: tagHud('deer'), hob, audio: AUD, refresh, read: READ,
    onStart: () => { P.enabled = false; I.enabled = false; if (RU) RU.paused = true; hud.prompt(null); },
    onStop: () => { P.enabled = !paused; I.enabled = !paused; if (RU) RU.paused = paused; },
    busy: () => !!((WJ && (WJ.on || WJ.near)) || (RU && RU.near) || (SH && SH.near) || (PG && PG.near) || (DL && (DL.active || DL.card))),   // (another job has the player: the deer card stands aside)
    open: () => shiftOpen('deer'), decline: () => shiftNo('deer') }) : null;
  // the bottle range, for every rider: bottles and tin cans, never anything alive (cattle and bandits are roped)
  SR = jobOn(rider, 'range') ? makeShootingJob({ W, folk, P, I, camera, canvas, renderer, rider, hud: tagHud('range'), hob, audio: AUD, refresh, read: READ,
    onStart: () => { P.enabled = false; I.enabled = false; if (RU) RU.paused = true; hud.prompt(null); },
    onStop: () => { P.enabled = !paused; I.enabled = !paused; if (RU) RU.paused = paused; jobOver('range', { sat: true }); },
    busy: () => !!((WJ && WJ.on) || (DL && DL.active) || (DJ && DJ.active)), open: () => shiftOpen('range'), decline: () => shiftNo('range') }) : null;
  DL = !jobOn(rider, 'deliveries') ? null : makeDeliveryJob({ W, camps, P, camera, rider, hud: tagHud('delivery'), hob, refresh, work: () => TOOLS.work(),
    onStart: () => { P.enabled = false; I.enabled = false; if (RU) RU.paused = true; hud.prompt(null); },
    onStop: () => { P.enabled = !paused; I.enabled = !paused; if (RU) RU.paused = paused; },
    quiet: () => !!((RU && RU.near) || (SH && SH.near) || (PG && PG.near) || (SJ && SJ.active) || (WJ && WJ.near)),
    say: (id, t) => !!(JF && JF.say(id, t)),   // (the foremen's words in the job folk's speech card)
    open: () => shiftOpen('delivery'), decline: (c) => shiftNo('delivery', { who: c && c.id }) });
  WJ = jobOn(rider, 'wagon') ? makeWagonJob({ W, folk, animals, P, I, camera, canvas, rider, hud: tagHud('wagon'), hob, audio: AUD, refresh, read: READ,
    times: () => RU && RU.trainer('times'),   // (one times trainer for both jobs)
    traffic: () => traffic, shouts: () => SHOUT,   // (hold-ups on the long roads: a gang jumps one of the traffic's wagons; the driver's thanks)
    quiet: () => !!((RU && RU.near) || (SH && SH.near) || (PG && PG.near) || atCounter() || (DL && DL.card)),
    // (picked on the jobs board, its shift open: a hold-up sent for it, its waves the shift's rounds left, fixed then)
    wanted: () => !!(JB && JB.picked === 'wagon'), open: () => shiftOpen('wagon'), left: () => { if (SK) SK.start('wagon'); return shiftLeft('wagon'); } }) : null;
  LJ = jobOn(rider, 'loot') ? makeLootJob({ W, folk, animals, P, I, camera, canvas, rider, hud: tagHud('loot'), hob, refresh, audio: AUD, town: () => TP,   // (audio: a gang camp's fire crackles; town: the townsfolk come for their goods)
    voice: (k, who) => { if (SHOUT) SHOUT.say(k, who); },   // (a townsman's recorded lines: "Is that my stuff?", a thank-you)
    quiet: () => !!((RU && RU.near) || (SH && SH.near) || (PG && PG.near) || atCounter() || (WJ && WJ.near) || (DL && DL.card) || (DJ && DJ.card)),
    open: () => shiftOpen('loot'), decline: () => shiftNo('loot', { far: true }),
    picked: () => theJob === 'loot' || !!(JB && JB.picked === 'loot') }) : null;   // (the compass leads to a cache only for the job picked)
  JF = makeJobFolk({ W, folk, P, camera, hud,
    jobs: { roundup: () => RU, sheep: () => SH, pigs: () => PG, wagon: () => WJ, deer: () => DJ, camps: () => camps, farm: () => farm, delivery: () => DL, loot: () => LJ, windmill: () => (WMJ && WMJ.on ? WMJ : null), fishing: () => (FJ && FJ.on ? FJ : null), bridge: () => (BRJ && jobOn(rider, 'bridge') ? BRJ : null), rooms: () => TR },   // (rooms: the storekeeper behind his counter, the sheriff at his desk)
    actions: { sheriff: () => openCounter('sheriff'), stable: () => openCounter('stable') }, onTalk: (what, id, who) => { if (SHOUT) SHOUT.talk(what, who && { id, ...who }); },
    // (the trail boss, the vet and the others: their speech card read out, in the browser's voice, to a rider who can't read yet)
    onSay: (name, lines) => { if (rider && SKILLS.readAloud(rider)) sayLine(lines.join(' ')); },
    helloFor: (id) => (SK ? SK.helloFor(id) : null),   // (a job done for today: its person's polite no in place of the hello)
    onRing: (at) => { if (AMBI) AMBI.anvil(at); } });   // (the blacksmith's hammer on his anvil: src/smithy.js)
  TP = makeTownPeople({ W, folk, camera, player: () => P, jobs: { store: () => SJ, loot: () => LJ, stage: () => stage } });
  saloonFolk = makeSaloonFolk({ W, folk, TP, stage, camera });   // (the townsfolk in the saloon: listening, clapping)
  if (stage) stage.crowd = saloonFolk;
  JB = makeJobsBoard({ W, camera, I, hud, rider, player: () => P, onOpen: () => pause('board'), onClose: () => resume('board'),
    jobs: { roundup: () => RU, sheep: () => SH, pigs: () => PG, store: () => SJ, delivery: () => DL, wagon: () => WJ, deer: () => DJ, range: () => SR, loot: () => LJ, farm: () => farm, camps: () => camps, jobfolk: () => JF, windmill: () => (WMJ && WMJ.on ? WMJ : null), bridge: () => (BRJ && jobOn(rider, 'bridge') ? BRJ : null), fishing: () => (FJ && FJ.on ? FJ : null), graphs: () => GT },
    speak: (text) => { if (rider && SKILLS.readAloud(rider)) sayLine(text); },   // (a job picked there is read out to a rider who can't read yet)
    shift: { done: (id) => !!(SK && SK.done(id)), ask: (id) => !!(SK && SK.ask(id)) } });   // (a job done for today: stamped on the board; picked there, more work)
  // (made before anything can be bought or done: its first look takes what an old save already has as announced)
  CM = makeChecklist({ hud, audio: AUD, rider, busy: asking, save: () => saveRider(rider), world: {
    place: () => { const c = camps && P && camps.near(P.position, FOUND_NEAR.camp); return c ? c.id : null; },
    hideout: () => { const c = LJ && LJ.cache; return c && P && Math.hypot(c.x - P.position.x, c.z - P.position.z) < FOUND_NEAR.hideout ? c.def.id : null; },
    home: () => !!(cabin && cabin.inside) } });
  // the shifts (before the round-up deals its first bunch: a shift already done today keeps it waiting)
  SK = makeShiftKeeper({ W, rider, hud, hob, audio: AUD, folk: () => JF, board: () => JB, range: () => SR, player: () => P,
    busy: () => paused || boxOpen || atCounter() || !!(LJ && LJ.active) || !!(cabin && cabin.busy),
    current: () => notOnTheWay(jobNow()), working: () => notOnTheWay(askingJob()), jobOn: (id) => !!(JOB_NOW[id] && JOB_NOW[id]()), refresh,
    store: () => (W.places.store && W.places.store.door) || null, foreman: (id) => !!(camps && camps.byId && camps.byId(id)),
    ends: { fishing: () => { if (BS && BS.active && BS.active.id === 'fishing') BS.close('done'); } } });   // (the rod put down once the day's fish are landed)
  RU.start();
  hob.trail(true);
  hud.show(true); hud.touch(I.touch);
  refresh();
  hob.event('ride', { range: !!SR, wagon: !!WJ, deer: !!DJ, loot: !!LJ, sheep: !!SH, pigs: !!PG, deliveries: !!DL, store: !!SJ });   // (a job turned off: Hob doesn't send the rider there)
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
  if (TP) for (const c of TP.walkers) thingsNear.push(c);   // (the townsfolk going about)
  return thingsNear;
}
function makeDogIfOwned() {
  const dog = rider && rider.owned && rider.owned.dog;
  if (!dog || !P) return;
  if (D && D.kind === dog.kind) { D.setName(dog.name); return; }
  if (D) D.dispose();
  D = makeDog({ W, scene: W.scene, animals, kind: dogKind(dog.kind), name: dog.name, follow: () => (cabin && cabin.dogWait) || P.position });   // (it waits by the porch steps while you're in the cabin)
  D.kind = dog.kind;
}
function endRide() {
  if (state !== 'play') return;
  hushVoice();   // (a line still being said in the browser's voice stops with the ride)
  FB.jobEnd(undefined, 'left'); FB.flush();
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
  if (saloonFolk) { saloonFolk.dispose(); saloonFolk = null; }
  if (GT) { GT.dispose(); GT = null; }
  if (TP) { TP.dispose(); TP = null; }
  if (JB) { JB.dispose(); JB = null; }
  if (deer) { deer.dispose(); deer = null; }
  if (BS) { BS.dispose(); BS = null; }
  if (WMJ) { WMJ.dispose(); WMJ = null; }
  if (BRJ) { BRJ.dispose(); BRJ = null; }
  if (FJ) { FJ.dispose(); FJ = null; }
  DL = camps = null;
  if (farm) farm.dispose();
  if (HS) { HS.dispose(); HS = null; }
  if (PEN) { PEN.dispose(); PEN = null; }
  if (FEEDER) { FEEDER.dispose(); FEEDER = null; }
  if (TR) { TR.dispose(); TR = null; }
  if (US) { US.dispose(); US = null; }
  if (hob) hob.dispose();
  if (D) D.dispose();
  if (P) P.dispose();
  if (stage) stage.dispose();
  if (bandCard) bandCard.close();
  if (traffic) { traffic.dispose(); traffic = null; }
  if (AMBI) { AMBI.dispose(); AMBI = BM.ambience = null; }
  if (SHOUT) { SHOUT.dispose(); SHOUT = BM.shouts = null; }
  if (READ) { READ.dispose(); READ = BM.read = null; }
  if (CM) { CM.dispose(); CM = null; }
  if (SK) { SK.dispose(); SK = null; }
  RU = hob = shops = D = P = stage = SH = PG = SJ = farm = null; door = null;
  AUD.hold('title', true);
  pausedBy.clear(); paused = false;
  I.enabled = false;
  hud.show(false);
  if (rider) saveRider(rider);
  W.timeRuns = false; W.setHour(W.dayStart);   // (the title's town in the morning again, the next ride starting from it)
  state = 'title';
  titleCam(0);
  T.show();
}

// The round-up and the farm's sheep job share the HUD's job card and the line under it: at the farm the sheep job has
// them, so the round-up's own (its travel card, counting the metres to the pasture) is held back there
function roundupHud() {
  const base = tagHud('roundup'), h = Object.create(base);
  const atFarm = () => !!((SH && SH.near) || (PG && PG.near) || (DL && DL.card && !(RU && RU.near)) || (WJ && (WJ.near || (WJ.on && !(RU && RU.near)))) || (DJ && DJ.card && !(RU && RU.near)) || (LJ && LJ.card && !(RU && RU.near)));   // (and a delivery's card)   // (the sheep pasture or the pig yard)
  // (nor at the store's counter; a card held back is still its latest, for THE JOB to put up: arriving at the herd
  // straight from the range, the six-shooter is put away only later that frame)
  h.rule = (o) => { if (!atFarm() && !atCounter()) return base.rule(o); lastCard.roundup = o || null; return hud.ruleEl; };
  h.hint = (o) => { if (!atFarm() && !atCounter()) hud.hint(o); };
  return h;
}

// ── WHICH JOB THE CARD UP TOP IS ABOUT: Old Hob's hoofprints lead there ───────────────────────────────────────────
// Each job is handed a HUD that marks the rule card it puts up as its own (tagHud), so the trail follows the very job the
// card names: the round-up's "the herd is in the pasture", or a delivery's, the wagon's or the gang's loot when one of
// those has the card. A card that is not a travel card means the job is under way right there: no trail then.
let ruleBy = null, cardBy = null;   // (the job putting a card up just now; the job whose card is up: { id, kind })
let shownCard = null;   // (the very card object up just now: THE JOB's plain card knows it's its own)
// Only the nearest job's travel card goes up, and only within NOTICE.near metres of where its trail leads (the whole
// town is in range of the pasture's); farther off, the card comes down and nothing takes its place. A job already under
// way (crates or loot on the horse, the deer camera lent) keeps its card at any distance.
const NOTICE = { near: 220 };
function noticeGoal(id) { const was = cardBy; cardBy = { id, kind: 'travel' }; try { return trailGoal(); } finally { cardBy = was; } }
const underWay = (id) => id === 'delivery' || (id === 'loot' && !!LJ && LJ.phase === 'carrying') || (id === 'deer' && !!DJ && DJ.lent());
function noticeFar(id) {
  if (!P || !id || underWay(id)) return null;
  const g = noticeGoal(id); if (!g) return null;
  return Math.hypot(g.x - P.position.x, g.z - P.position.z);
}
{ const rule = hud.rule; hud.rule = (o) => {
  if (ruleBy && !jobCardNow) lastCard[ruleBy] = o || null;   // (each job's latest card, shown or not: THE JOB below)
  if (o && o.kind === 'travel' && !o.urgent && cardBy && cardBy.urgent && cardBy.id !== ruleBy) return hud.ruleEl;   // (a call for help, a hold-up on the road: no other job's travel card over it, the chosen job's neither)
  // (with the gang (its question card is up, not the far-off "Help!"), no other job's card over it at all, and no other job's
  // null takes it down: only the hold-up itself ends it)
  if (cardBy && cardBy.urgent && ruleBy && cardBy.id !== ruleBy && (!o || (!o.urgent && cardBy.kind !== 'travel'))) return hud.ruleEl;
  // a job chosen (THE JOB below): another job's card stays down, and its null leaves the chosen job's card alone; a call
  // for help on the road still comes up
  if (theJob && ruleBy && ruleBy !== theJob && !(o && o.urgent) && !(cardBy && cardBy.id === ruleBy && cardBy.urgent)) {   // (a hold-up's card, once up, carries on to its end)
    if (!o && cardBy && cardBy.id === ruleBy) { cardBy = null; return rule(null); }
    return hud.ruleEl;
  }
  if (o && o.kind === 'travel' && ruleBy && ruleBy !== theJob) {
    // (the screen stays clear between jobs: a travel card only for the job picked on the jobs board (THE JOB then), a
    // job under way, or a call for help. The game's maker: the round-up's card was "always saying "Round-up" at the
    // top ... It should only put that up there if I select it on the board": no nearest job's card leading the way)
    if (!o.urgent && !underWay(ruleBy)) { if (cardBy && cardBy.id === ruleBy) { cardBy = null; shownCard = null; return rule(null); } return hud.ruleEl; }
    const d = noticeFar(ruleBy);
    if (d != null && d > NOTICE.near) { if (cardBy && cardBy.id === ruleBy) { cardBy = null; return rule(null); } return hud.ruleEl; }   // (too far: its own card comes down)
    if (cardBy && cardBy.urgent && cardBy.id !== ruleBy) return hud.ruleEl;   // (a call for help, a hold-up on the road: no other job's travel card over it)
    if (!o.urgent && d != null && cardBy && cardBy.kind === 'travel' && cardBy.id !== ruleBy) { const e = noticeFar(cardBy.id); if (e != null && e <= NOTICE.near && e < d) return hud.ruleEl; }   // (another job's, nearer, stays up)
  }
  cardBy = o ? { id: ruleBy, kind: o.kind || null, urgent: !!o.urgent } : null; shownCard = o || null; return rule(o);
}; }
function tagHud(id) {
  const h = Object.create(hud);
  h.rule = (o) => { const was = ruleBy; ruleBy = id; try { return hud.rule(o); } finally { ruleBy = was; } };
  return h;
}
function trailGoal() {
  if (!cardBy || cardBy.kind !== 'travel') return null;
  const mark = (ms) => (ms && ms[0] ? { id: cardBy.id + ':' + ms[0].label, x: ms[0].x, z: ms[0].z } : null);
  switch (cardBy.id) {
    case 'roundup': {
      // (as on the first day: out to the corral at the end of the town's dirt trail; none once in the pasture)
      const pa = W.places.pasture, t = W.places.trail; if (!pa) return null;
      const e = t && t.length ? t[t.length - 1] : [pa.x, pa.z];
      return { id: 'roundup', x: e[0], z: e[1], hide: { x: pa.x, z: pa.z, r: HOB.hideNear } };
    }
    case 'wagon': { const w = WJ && WJ.where(); return w ? { id: 'wagon', x: w.x, z: w.z } : null; }
    case 'delivery': return DL ? mark(DL.marks()) : null;
    case 'loot': return LJ ? mark(LJ.marks()) : null;
    case 'deer': {
      if (!DJ) return null;
      // (her camera not lent yet: to Miss Wren first, then on to the herd)
      const n = !DJ.lent() && JF && JF.people.find((r) => r.id === 'naturalist' && r.placed);
      if (n) return { id: 'deer:naturalist', x: n.x, z: n.z };
      return mark(DJ.marks());
    }
    case 'range': return SR ? mark(SR.marks()) : null;
    default: {   // (the sheep, the pigs, the store, the sheriff's lock boxes: where the jobs board says the job is)
      const g = JB && JB.where ? JB.where(cardBy.id) : null;
      return g ? { id: 'job:' + cardBy.id + (g.stable ? ':stable' : ''), x: g.x, z: g.z, hide: g.hide } : null;
    }
  }
}
// ── THE JOB THE RIDER CHOSE ──────────────────────────────────────────────────────────────────────────────────────
// A job picked on the jobs board, taken up with its person (Miss Wren's camera borrowed, an order from a camp's foreman)
// or worked at (a steer roped, a sheep dosed, a slip filled) becomes THE job: its card stays up
// and Old Hob's hoofprints keep leading to it wherever the rider goes, until another job is chosen the same way, it is
// turned off, or Miss Wren has her camera back. Meanwhile no other job's card takes its place (riding past the pasture,
// the round-up's card stays down; roping a steer there chooses the round-up), though a call for help on the road still
// comes up over it. While the chosen job has no card of its own up (its people are far off), a plain one says where it
// is. With no job chosen, the nearest job's card is up, as before.
let theJob = null, jobCardNow = false, jobCardKey = '', jobCardObj = null, worked = false;
// how far (m) from where a job is (the jobs board's place for it) the rider has left it: its card comes down
const JOB_LEAVE = 60;
const lastCard = {};
// what the jobs tell Old Hob that means the rider is at work at one (the hold-ups on the road are not chosen this way:
// one on the way is a call for help; the jobs board's is chosen there)
const JOB_OF_EVENT = {
  catch: 'roundup', miss: 'roundup', waveDone: 'roundup',
  sheepHealed: 'sheep', sheepWrong: 'sheep', sheepFine: 'sheep', sheepDose: 'sheep', flockDone: 'sheep',
  pigPenned: 'pigs', pigWrong: 'pigs', pigsDone: 'pigs',
  storeStart: 'store', storeMiss: 'store', storeRight: 'store', storeDone: 'store',
  deliveryOrder: 'delivery', deliveryWork: 'delivery', deliveryMiss: 'delivery', deliveryRight: 'delivery', deliveryLoaded: 'delivery',
  banditCatch: 'wagon', banditMiss: 'wagon', gangDone: 'wagon',
  deerSetup: 'deer', deerRight: 'deer', deerWrong: 'deer',
  lootGuard: 'loot', lootLoaded: 'loot', lootMiss: 'loot', lootRight: 'loot', lootShare: 'loot',
};
const JOB_NOW = { roundup: () => RU, sheep: () => SH, pigs: () => PG, store: () => SJ, delivery: () => DL, wagon: () => WJ, deer: () => DJ, range: () => SR, loot: () => LJ, boxes: () => true, windmill: () => !!(WMJ && WMJ.on), bridge: () => !!(BRJ && jobOn(rider, 'bridge')), fishing: () => !!(FJ && FJ.on), graphs: () => !!GT };
function chooseJob(id) {
  if (!id || id === theJob || !JOB_NOW[id] || !JOB_NOW[id]()) return;
  theJob = id; jobCardKey = ''; worked = true;
}
// the rider has left the chosen job's place: its own latest card is a travel card, or the rider is JOB_LEAVE off
function leftJob(id) {
  const own = lastCard[id]; if (own && own.kind === 'travel') return true;
  const g = JB && JB.where ? JB.where(id) : null;
  return !!(g && P && Math.hypot(g.x - P.position.x, g.z - P.position.z) > JOB_LEAVE);
}
function jobHeard(name, data) {
  const id = JOB_OF_EVENT[name];
  if (!id || (id === 'wagon' && ((data && data.ambush) || (WJ && WJ.ambush)))) return;
  chooseJob(id);
}
function jobStep() {
  // (a question up where the rider is (a sit-down job begun, a wave of the herd or the flock come up to): that job is THE
  // job, over one picked on the jobs board and over the one left behind, so its card comes up and the other's goes)
  const a = askingJob(), atWork = !!a && a !== 'panel' && a !== 'build';
  if (JB && JB.picked && !atWork) chooseJob(JB.picked);
  // (a hold-up's card left up after the hold-up has gone: taken down, so it can't hold the card for good)
  if (cardBy && cardBy.urgent && cardBy.id === 'wagon' && !(WJ && WJ.ambush)) { const was = ruleBy; ruleBy = 'wagon'; try { hud.rule(null); } finally { ruleBy = was; } }
  if (atWork && !(a === 'wagon' && WJ && WJ.ambush)) chooseJob(a);
  if (a === 'build' && BS && BS.active) chooseJob(BS.active.id);   // (a builder opened at its site: that site's job)
  if (!theJob) return;
  if (!JOB_NOW[theJob]() || (theJob === 'deer' && DJ && DJ.resting && DJ.resting() && !(JB && JB.picked === 'deer'))) { theJob = null; return; }   // (turned off; or Miss Wren has her camera back, unless the board's pick sends the rider to her again)
  // (left behind, unless it is the jobs board's pick or under way (crates on the horse, the camera lent): no longer the
  // job, and its card comes down; it is THE job again on coming back to it)
  if (theJob !== (JB && JB.picked) && !underWay(theJob) && a !== theJob && leftJob(theJob)) {
    const id = theJob; theJob = null; jobCardKey = '';
    if (cardBy && cardBy.id === id && !cardBy.urgent) { const was = ruleBy; ruleBy = id; jobCardNow = true; try { hud.rule(null); } finally { ruleBy = was; jobCardNow = false; } }
    return;
  }
  // (the plain where-it-is card this function put up is not 'its own card': it goes on below, so its distance and
  // direction follow the rider)
  const plainUp = !!jobCardObj && shownCard === jobCardObj && !!cardBy && cardBy.id === theJob;
  const own = lastCard[theJob], ownUp = !!cardBy && cardBy.id === theJob && (!own || shownCard === own);   // (its own latest card: not an older one of its own, its travel card left up while the wave's was held back)
  if (cardBy && !plainUp && (ownUp || cardBy.urgent || (cardBy.id === 'wagon' && WJ && WJ.ambush))) return;   // (its own card is up, or a call for help and its end)
  if (atCounter() || (cabin && cabin.inside)) return;
  const now = askingJob(); if (now === 'panel') return;
  if (now === theJob && !own) return;   // (a question of its own is up, the camera's: its card is its own to put up)
  if (own) { const was = ruleBy; ruleBy = theJob; try { hud.rule(own); } finally { ruleBy = was; } return; }   // (its own card, put back up)
  // (the Professor's graph practice: its card only within 5 m of his chalkboard, the game's maker's wish; the hoofprints
  // still lead there from the board)
  if (theJob === 'graphs') {
    const gd = GT && GT.distance ? GT.distance(P.position.x, P.position.z) : null;
    if (gd == null || gd > 5) {
      if (cardBy && cardBy.id === 'graphs' && !cardBy.urgent) { const was = ruleBy; ruleBy = 'graphs'; jobCardNow = true; try { hud.rule(null); } finally { ruleBy = was; jobCardNow = false; } }
      jobCardKey = ''; return;
    }
  }
  // its own card isn't up: a plain one, where it is and which way
  const g = JB && JB.where ? JB.where(theJob) : null, name = JB && JB.nameOf ? JB.nameOf(theJob) : null;
  if (!name) return;
  const d = g ? Math.hypot(g.x - P.position.x, g.z - P.position.z) : null;
  const here = d != null && d < HOB.goalNear;
  const sub = d == null ? (JB.whatOf(theJob) || '')
    : g.stable ? `It needs a saddled horse: the stable first, ${Math.round(d)} m ${JB.wayTo(P.position, g)}`
    : here ? ((JB.hereOf && !(US && US.inside()) ? JB.hereOf(theJob) : JB.whatOf(theJob)) || '') : `${d > 100 ? Math.round(d / 10) * 10 : Math.round(d / 5) * 5} m ${JB.wayTo(P.position, g)}: follow the hoofprints`;
  const key = theJob + '|' + sub;
  if (key === jobCardKey && cardBy && cardBy.id === theJob) return;
  jobCardKey = key;
  const was = ruleBy; ruleBy = theJob; jobCardNow = true;
  jobCardObj = { kind: here ? 'job' : 'travel', main: name, sub };
  try { hud.rule(jobCardObj); } finally { ruleBy = was; jobCardNow = false; }
}
// where Old Hob's last line just sent the rider (the stable, once the first wave's pay buys a saddle), for a while: the
// trail leads there, so his words and the hoofprints agree; a job under way where the rider is keeps its own trail
function hobGoal() {
  const w = hob && hob.wants ? hob.wants() : null;
  const p = w && W.places[w];
  if (!p || (cardBy && cardBy.kind === 'travel' && underWay(cardBy.id))) return null;
  const d = p.door || p;
  return Number.isFinite(d.x) && Number.isFinite(d.z) ? { id: 'hob:' + w, x: d.x, z: d.z } : null;
}
// the wagon road, as points, for the trail to keep to (it is no longer way round)
let roadPts = null;
function roadLines() {
  if (!roadPts && traffic && traffic.road) { const c = traffic.road; roadPts = c.getSpacedPoints(Math.max(2, Math.ceil(c.getLength() / 2))).map((v) => [v.x, v.z]); }
  return roadPts ? [roadPts] : null;
}

// the saddlebags' goods for the HUD: the farm's ('30 eggs · 4 lb wool to sell') and the fish kept at the dock
function goodsLine() {
  const g = HS ? HS.goodsLine() : '', f = FJ ? FJ.fishLine() : '';
  return !f ? g : g ? g.replace(/ to sell$/, ` · ${f} to sell`) : `${f} to sell`;
}
// the purse on the HUD, from the rider
function refresh() {
  if (!rider) return;
  const tr = rider.treats || {};   // (the horses' treats, by the gold: src/treats.js)
  hud.purse({ gold: rider.gold, bounty: rider.bounty, title: titleOf(rider), next: nextTitle(rider), badges: badgesOf(rider), boxes: (rider.lockboxes || []).length, goods: goodsLine(), treats: { apple: tr.apple || 0, carrot: tr.carrot || 0 } });
  if (shops && shops.isOpen) shops.redraw();
  if (CM) CM.check();   // (anything bought or done: a checklist item may be checked off)
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
  // (audio: the box's read-aloud follows the game's volume; the parts a box asked count in the skill model at once,
  // so the rider is saved as the panel closes even when no box was finished)
  BOX = openLockbox(document.body, { rider, box, debug: DEV, problem, audio: AUD, ...boxTools(),
    next: own ? null : problem ? () => null : () => ({ tier: boxTier(rider), from: 'sheriff' }),   // the sheriff's pile never runs out
    onBox: (res) => payBox(res, own),
    onDone: (res) => {
      boxOpen = false; BOX = null; TOOLS.close();
      if (box.from === 'store') FB.jobEnd('boxes', 'back to the counter'); else jobOver('boxes', { sat: true });   // (the store's own equation: no thumbs chip for it)
      try {
        saveRider(rider);
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
  BOX = openLockbox(document.body, { rider, box: { tier: boxTier(rider), from: 'practice' }, debug: DEV, audio: AUD, ...boxTools(),
    next: () => ({ tier: boxTier(rider), from: 'practice' }),
    onBox: (res) => payBox(res, false),
    onDone: () => { BOX = null; TOOLS.close(); jobOver('boxes', { sat: true }); saveRider(rider); state = W ? 'title' : 'loading'; if (W) canvas.classList.add('is-on'); T.show(); } });
}
// the lock box's own Work it out (the tools' sheet goes over the box; the box hears no keys while a tool is up)
function boxTools() { return { workOut: () => TOOLS.work(), toolsOpen: () => TOOLS.busy() }; }

// the menu's read-aloud switch, in words (always in the menu: a tap steps through off, by itself, always; save.js)
function readWords() {
  const m = readMode(rider);
  return `Read aloud: ${readModeWords(rider)}<small>${m === 'on' ? 'The basic math cards, always (a recorded voice)' : m === false ? 'Nothing is read out loud'
    : 'The basic math cards while the math is new (a recorded voice)'}</small>`;
}
// the menu's "What's left" line: the checklist's percent and the first goal's progress
function leftWords() {
  const c = completion(rider), g = goalsOf(rider).find((x) => !x.done);
  return `${c.pct}% of the checklist done${g ? ` · goal: ${g.name}` : ''}`;
}
// ── MARK THIS SPOT (the menu): where the player is, as one line to paste in a message ─────────────────────────────
// x and z in metres (north is −z), the way the view faces (a compass point and degrees, north 0°, east 90°), and how far
// and which way from the nearest named place. Worked out only when asked: nothing runs per frame.
const SPOT_NAMES = { cabin: 'your cabin', stable: 'the stable', store: 'the general store', sheriff: "the sheriff's office", saloon: 'the saloon',
  stage: 'the stage', square: 'the town square', pasture: 'the pasture', corral: 'the corral', farm: 'the farm' };
const POINT8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const degOf = (dx, dz) => ((Math.atan2(dx, -dz) * 180 / Math.PI) % 360 + 360) % 360;   // (0 north, 90 east)
function spotNote() {
  if (!P || !W) return '';
  const at = P.position, face = ((180 - P.cam.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const named = [];
  for (const [k, name] of Object.entries(SPOT_NAMES)) { const q = W.places[k]; if (q && Number.isFinite(q.x) && Number.isFinite(q.z)) named.push({ name, x: q.x, z: q.z }); }
  if (camps && camps.list) for (const c of camps.list) named.push({ name: c.short, x: c.x, z: c.z });
  if (SR && SR.layout) named.push({ name: 'the bottle range', x: SR.layout.x, z: SR.layout.z });
  let near = null, nd = Infinity;
  for (const n of named) { const d = Math.hypot(n.x - at.x, n.z - at.z); if (d < nd) { nd = d; near = n; } }
  const from = !near ? '' : nd < 8 ? `, at ${near.name}` : `, ${Math.round(nd)} m ${POINT8[Math.round(degOf(at.x - near.x, at.z - near.z) / 45) % 8]} of ${near.name}`;
  const how = cabin && cabin.inside ? 'inside the cabin' : P.onHorse ? 'on horseback' : 'on foot';
  return `Mathwood Valley spot: x ${at.x.toFixed(1)}, z ${at.z.toFixed(1)}, facing ${POINT8[Math.round(face / 45) % 8]} (${Math.round(face) % 360}°)${from}, ${how}` + townReport(at);
}
// (Mark this spot, for a bug report: who is about within 30 m, what each is doing and how faded, the store's customers
// and the wagons near, with why one is stopped: a stuck townsperson, a ghost or a jam can be read from the pasted line)
function townReport(at) {
  const near = (x, z, r = 30) => Math.hypot(x - at.x, z - at.z) < r, f = (v) => (+v).toFixed(1), out = [];
  try {
    const tp = TP && TP.state ? TP.state().people.filter((r) => r.out && near(r.x, r.z)) : [];
    if (tp.length) out.push('folk: ' + tp.map((r) => `${r.name} ${r.state}${r.lent ? ' lent' : ''}${r.fade < 1 ? ` fade ${r.fade}` : ''}${r.drawn ? '' : ' hidden'} @${f(r.x)},${f(r.z)}${r.clip ? ' ' + r.clip : ''}`).join('; '));
    const cs = SJ && SJ.people ? SJ.people.filter((c) => near(c.x, c.z)) : [];
    if (cs.length) out.push('store: ' + cs.map((c) => `${c.who && c.who.name} ${c.state}${c.walking ? ' walking' : ''}${c.p && c.p.fade != null && c.p.fade < 1 ? ` fade ${c.p.fade.toFixed(2)}` : ''} @${f(c.x)},${f(c.z)}`).join('; '));
    const ws = traffic && traffic.state ? traffic.state().wagons.filter((w) => w.made && w.dist != null && w.dist < 45) : [];
    if (ws.length) out.push('wagons: ' + ws.map((w) => `${w.kind} ${w.pace} ${w.why || 'rolling'}${w.noRound ? ` (no way round: ${w.noRound})` : ''}`).join('; '));
  } catch (e) { out.push('report: ' + e.message); }
  return out.length ? '\n' + out.join('\n') : '';
}
// copies a line to the clipboard (the clipboard API, else the old select-and-copy); -> true if it was copied
async function copyLine(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* (refused: try the old way) */ }
  try {
    const a = document.createElement('textarea');
    a.value = text; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(a); a.select(); a.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); a.remove(); return !!ok;
  } catch (e) { return false; }
}
// ── FEEDBACK (src/feedback.js; the pieces on screen: src/ui/flag.js) ─────────────────────────────────────────────
// which job the rider is at just now: the play events, a flagged question and the thumbs up or down say it
function jobNow() {
  if (state === 'boxes' || boxOpen) return 'boxes';
  if (state !== 'play') return null;
  if (BS && BS.active) return BS.active.id;
  const a = askingJob();
  return a && a !== 'panel' && a !== 'build' ? a : theJob || null;
}
// riders go by their number on the title, never by name (worked out once a ride)
let riderNoOf = null, riderNoIs = null;
function riderNo() {
  if (!rider) return null;
  if (riderNoOf !== rider.id) { riderNoOf = rider.id; try { const i = loadRiders().findIndex((r) => r.id === rider.id); riderNoIs = i >= 0 ? i + 1 : null; } catch (e) { riderNoIs = null; } }
  return riderNoIs;
}
// the nearest named place, in words (no coordinates: the Tell us report has the whole Mark-this-spot line for those)
function placeNow() {
  if (state === 'boxes') return 'lock boxes from the title';
  if (!P || !W) return null;
  if (cabin && cabin.inside) return 'inside the cabin';
  let best = null, bd = Infinity;
  for (const [k, name] of Object.entries(SPOT_NAMES)) { const q = W.places[k]; if (q && Number.isFinite(q.x) && Number.isFinite(q.z)) { const d = Math.hypot(q.x - P.position.x, q.z - P.position.z); if (d < bd) { bd = d; best = name; } } }
  return !best ? null : bd < 25 ? best : `${Math.round(bd / 5) * 5} m from ${best}`;
}
const deviceType = () => { try { const m = Math.min(screen.width, screen.height); return matchMedia('(pointer: coarse)').matches ? (m < 600 ? 'phone' : 'tablet') : 'computer'; } catch (e) { return 'unknown'; } };
FB.context = () => ({ job: jobNow(), rider: riderNo(), tier: W ? W.tier : quality.tier, place: placeNow(), state });
// every answer as the skill model records it (src/math/skill.js onRecord: the one place all the jobs' answers land)
SKILLS.onRecord((list, out, opts) => {
  list.forEach((x, i) => { const r = out[x.strand] || {}; FB.answered({ strand: x.strand, at: x.at ?? r.before, right: !!opts.right, ms: i === 0 && opts.sitDown ? opts.ms : null,
    level: r.level, before: r.before, placed: r.placed, justPlaced: r.justPlaced, also: i > 0 }); });
});
FB.event('session', { device: deviceType(), tier: quality.tier, w: innerWidth, h: innerHeight, maker: FB.maker() });
// the frame rate once a minute while riding (the paused menu's frames say nothing about the game)
setInterval(() => { if (state === 'play' && !paused && !document.hidden && fpsNow) FB.event('fps', { fps: Math.round(fpsNow), tier: W ? W.tier : quality.tier, job: jobNow() }); }, 60000);
// a job finished: the events hear it, and a thumbs up or down chip comes up for a moment. sat: a sit-down job (the
// range, a builder, the lock boxes), rated only when something was answered in it
const JOB_ENDS = { waveDone: 'roundup', flockDone: 'sheep', pigsDone: 'pigs', banditsDone: 'wagon', boxGrabbed: 'wagon', deerDone: 'deer',
  deliveryDone: 'delivery', lootDone: 'loot', storeDone: 'store' };
function jobOver(id, { sat = false } = {}) {
  if (!id) return;
  try { const r = FB.jobEnd(id); if (sat ? r && r.answers > 0 : !r || r.answers > 0) rateJob(id); } catch (e) { /* (feedback never gets in the way) */ }
}
// the field jobs' question card: its job, the herd's numbers and which are right (the round-up, the wagon's gang),
// and the line under it after a wrong pick
function fieldQuestion() {
  const id = (cardBy && cardBy.id) || jobNow();
  const line = (q) => { const e = hud.ruleEl.querySelector(q); return e ? e.textContent : ''; };
  const out = { job: id, text: [line('.bmh-rule-main'), line('.bmh-rule-sub')].filter(Boolean).join(' · '), hint: hud.hintEl && !hud.hintEl.hidden ? hud.hintEl.innerText : null };
  const J = id === 'roundup' ? RU : id === 'wagon' ? WJ : null;
  const herd = J && Array.isArray(J.targets) ? J.targets.filter((t) => t.n != null) : [];
  if (herd.length) {
    const say = (t) => String(t.text ?? t.n);
    out.choices = herd.map(say);
    const card = J.wave && J.wave.card;
    out.right = card && card.answer != null ? String(card.answer) : herd.filter((t) => t.good).map(say).join(', ');
  }
  return out;
}
// the Tell us report: the rider's levels by strand, where, the job, the tier, the frame rate, and the Mark-this-spot line
function tellReport() {
  const levels = {};
  try { for (const s of SKILLS.stats(rider)) levels[s.strand] = { pct: s.pct, placed: s.placed, answered: s.answered }; } catch (e) { /* */ }
  return { levels, place: placeNow(), job: theJob || jobNow(), tier: W ? W.tier : quality.tier, fps: Math.round(fpsNow), device: deviceType(), w: innerWidth, h: innerHeight, spot: spotNote() };
}

// the levels page reads a place's name and line out when its tab is picked, for a rider who is read to
const levelsSpeak = (text) => { if (rider && SKILLS.readAloud(rider)) sayLine(text); };
// "I'm stuck: move me" (the menu): the rider, and the horse if ridden, to the last good spot they stood at, else the
// nearest building's door, else the town square (src/unstick.js). No penalty. In the cabin: out at its door
function unstick() {
  if (!P || !W) return null;
  if (SJ && SJ.active) SJ.stop();   // (behind the counter: round to the customers' side, which is all it takes)
  if (cabin && cabin.inside) { const c = W.places.cabin, to = c && c.door ? { x: c.door.x, z: c.door.z, rot: c.rot } : W.places.spawn; cabin.leave({ to }); return { from: 'cabin' }; }
  const doors = [], sq = W.places.spawn;
  for (const k in W.places) { const q = W.places[k]; if (q && q.door && Number.isFinite(q.door.x)) doors.push({ x: q.door.x, z: q.door.z, rot: q.rot }); }
  const s = UNST ? UNST.pick(P.position, { doors, square: sq, room: P.onHorse ? 1.6 : 0.8 }) : { x: sq.x, z: sq.z, rot: sq.rot, from: 'square' };
  if (!s) return null;
  P.teleport(s.x, s.z, s.rot ?? P.heading);
  return s;
}
// the storekeeper behind the general store's counter lets the rider by: the way behind it is too narrow to step round
// him, so he doesn't block (only the rider goes back there; the customers stay out front)
let keeperRec = null;
function passKeeper() {
  if (!JF || !JF.people) return;
  if (!keeperRec || !JF.people.includes(keeperRec)) keeperRec = JF.people.find((r) => r.id === 'storekeeper') || null;
  if (keeperRec && keeperRec.block) keeperRec.block = false;
}
// ── THE MENU (Esc) ───────────────────────────────────────────────────────────────────────────────────────────────
function openMenu() {
  if (state !== 'play' || menu || boxOpen || (shops && shops.isOpen) || (BS && BS.active)) return;   // (a builder's own Esc puts it away)
  let jobWas = null; try { jobWas = placeOfJob(jobNow()); } catch (e) { /* */ }   // (the levels page opens on the job being played)
  pause('menu');
  const boxes = (rider.lockboxes || []).length;
  const body = document.createElement('div');
  body.innerHTML = `<div class="bms-menu">
      <button type="button" class="is-main" data-do="resume">Keep riding<small>${I && I.touch ? 'Back to the game' : 'Esc'}</small></button>
      ${boxes ? `<button type="button" data-do="box">Open a lock box<small>${boxes} in your saddlebags</small></button>` : ''}
      ${prints(rider).length ? `<button type="button" data-do="album">Photo album<small>${prints(rider).length} deer photographs</small></button>` : ''}
      <button type="button" data-do="left">What's left<small>${leftWords()}</small></button>
      <button type="button" data-do="levels">Levels<small>Each place's levels, and where you are</small></button>
      <button type="button" data-do="stats">Your stats<small>Each place and kind of math, and how it's going</small></button>
      <button type="button" data-do="read" aria-pressed="${readMode(rider) !== false}">${readWords()}</button>
      <button type="button" data-do="unstick">I'm stuck: move me<small>Back to the last open spot you stood at</small></button>
      <button type="button" data-do="home">Go back to town<small>Straight to the town square</small></button>
      <button type="button" data-do="mark">Mark this spot<small>Copies where you are, to paste in a message</small></button>
      <button type="button" data-do="gfx">Graphics check<small>What this screen can do, and anything that didn't load</small></button>
      <button type="button" data-do="title">Back to the title<small>Your gold is already saved</small></button></div>
    <div class="bms-keys">${I && I.touch
      ? 'thumb stick on the left to move (push it to the edge to gallop) · drag to look · tap a steer or a rider, or press Rope · Horse calls your horse · On / off gets on and off · tap the prompt at a door · by a horse\'s head, tap the apple to give a treat'
      : `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · drag to look · <kbd>Shift</kbd> run or gallop ·
      click a steer (or <kbd>F</kbd>) to rope it · <kbd>H</kbd> call your horse · <kbd>E</kbd> on and off, or talk at a door · <kbd>G</kbd> give your horse a treat`}</div>`;
  body.querySelector('.bms-menu').after(volumeRow(AUD), graphicsRow(W && W.governor));   // (Auto, or a tier chosen by hand: src/ui/graphics.js)
  { const m = body.querySelector('.bms-menu'), last = m.querySelector('[data-do="title"]'); for (const x of menuRows({ report: tellReport })) m.insertBefore(x, last); }   // (Tell us, and the share switch)
  let then = null;
  menu = makePanel({ title: 'Taking a breather', sub: `${rider.name} · ${titleOf(rider)}`, body,
    onClose: () => { menu = null; resume('menu'); if (then) then(); } });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-do]'); if (!b) return;
    const what = b.dataset.do;
    if (what === 'read') {   // (the switch flips here and the menu stays open)
      rider.readAloud = nextReadMode(rider); saveRider(rider);
      b.setAttribute('aria-pressed', String(readMode(rider) !== false)); b.innerHTML = readWords();
      if (rider.readAloud === false) { if (READ) READ.stop(); hushVoice(); }
      return;
    }
    if (what === 'mark') {   // (the menu stays open: the line shows on the button, and a "Copied" toast over the menu)
      const line = spotNote(), m = menu;
      b.innerHTML = `Mark this spot<small class="bms-spot">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</small>`;
      copyLine(line).then((ok) => {
        BM.spot = { line, copied: ok };
        if (!m || menu !== m) return;
        const t = document.createElement('div');
        t.className = 'bms-copied'; t.setAttribute('role', 'status');
        t.textContent = ok ? 'Copied! Paste it in a message' : 'Copy it from the menu';
        m.el.appendChild(t); requestAnimationFrame(() => t.classList.add('is-on'));
        setTimeout(() => { t.classList.remove('is-on'); setTimeout(() => t.remove(), 400); }, 2400);
      });
      return;
    }
    if (what === 'home') then = () => { if (SJ) SJ.stop(); const s = W.places.spawn; if (cabin && cabin.inside) cabin.leave({ to: s }); else P.teleport(s.x, s.z, s.rot); };
    if (what === 'unstick') then = () => unstick();
    if (what === 'title') then = () => endRide();
    if (what === 'gfx') then = () => { pause('gfx'); openGfxCheck({ renderer, quality, scenes: [W && W.scene], errors: BM.errors, panel: makePanel, copy: copyLine, onClose: () => resume('gfx') }); };
    if (what === 'box') then = () => { const bx = rider.lockboxes[0]; if (bx) openBox({ tier: bx.tier, from: 'loot' }, { own: true }); };
    if (what === 'left') then = () => { pause('left'); openWhatsLeft(document.body, rider, { onClose: () => resume('left') }); };
    if (what === 'stats') then = () => { pause('stats'); openStats(document.body, rider, { face: faceSVG(rider.look), speak: levelsSpeak, onClose: () => resume('stats') }); };
    if (what === 'levels') then = () => { pause('levels'); openLevels(document.body, rider, { place: jobWas, speak: levelsSpeak, onClose: () => resume('levels') }); };
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
const NEAR_REMARK = 4;   // metres from the saloon's door where Hob remarks on it
let actWas = null;   // (the E action chosen last frame: kept against a near tie, src/usespotsplan.js pickAction)
const _face = new THREE.Vector3();
function doors() {
  door = null;
  if (!P || paused || (P.mode !== 'foot' && P.mode !== 'horse')) { hud.prompt(null); actWas = null; return; }
  // the rider's own saddled horse close by: E gets on it
  const h = P.mode === 'foot' && P.canRide && P.horse ? P.horse.root.position : null;
  const hd = h ? Math.hypot(h.x - P.position.x, h.z - P.position.z) : Infinity;
  // (inside a building the horse outside its wall is no horse to get on: src/player.js P.mount says so too)
  const indoorsNow = !!(W.codeIndoors && P.mode === 'foot' && W.codeIndoors(P.position.x, P.position.y + 1, P.position.z));
  const mount = hd < MOVE.mountNear && !indoorsNow;
  const called = mount && P.horseCameAt && performance.now() - P.horseCameAt < 6000;   // (just whistled over: E gets on, even by a door)
  // (a horse on its way after a whistle, or one just bought or picked at the stable and waiting a few steps off: E gets
  // on it too, rather than opening the door again; the horse walks up if it isn't close enough yet)
  const fresh = h && hd < 14 && (P.horseComing || (P.horsePickedAt && performance.now() - P.horsePickedAt < 8000));
  // THE ONE E (the game maker: "the E action should be to whatever is the closest to the spot right in front of the
  // player"): every E action in reach this frame, each with where its thing is, and the one nearest the spot right in front
  // of the player along the view (src/usespotsplan.js pickAction) gets the prompt; turning to another moves it. Only a
  // horse just whistled over or just picked at the stable comes first (the rider asked for it). Outdoors the prompt sits at
  // the bottom; a spot inside a building has it floating over the spot. (One prompt a frame, hud.prompt called once at the
  // end: it never flickers off and on within a frame, which kept restarting its fade-in on a phone)
  if (US) US.update();
  const cands = [];
  const add = (key, say, act, at, more = null) => { if (say) cands.push({ key, say, act, at: at || null, ...(more || {}) }); };
  // a counter at a building's door (src/shop.js: the cabin's for sale; a building with no one or no inside to work it)
  const d = shops.door(P.position);
  if (d && !(d.id === 'cabin' && cabin && cabin.owned)) add('counter:' + d.id, d.id === 'cabin' ? cabin && cabin.prompt() : d.prompt, () => openCounter(d.id), d.at, { door: d });   // (the cabin's: buy it, or nothing short of gold; bought, its door's own E)
  // the horse (act null: the player's own E gets on it, src/player.js)
  if (mount || fresh) add('horse', 'Get on your horse', null, h ? { x: h.x, z: h.z } : null);
  // a camp's foreman close by (src/missions/delivery.js): E talks to him about an order
  if (DL && DL.prompt) add('foreman', DL.prompt, () => DL.talk(), DL.promptAt);
  // in sight of the deer job's herd (src/missions/deerjob.js): E sets the camera up, where the rider stands
  if (DJ && DJ.prompt) add('deercam', DJ.prompt, () => DJ.setUp(), null);
  // at the front of the saloon's stage (src/stage.js): E opens the band's card (its songs, a break); none while it is up
  if (stage && stage.prompt && !(bandCard && bandCard.isOpen)) add('stage', stage.prompt, () => openBand(), W.places.stage && (W.places.stage.door || W.places.stage));
  // at the jobs board in the square (src/jobsboard.js): E opens it
  if (JB && JB.prompt) add('board', JB.prompt, () => JB.open(), JB.promptAt);
  // a job's person close by (src/jobfolk.js): E does what they ask (the camera lent or given back, the stable's counter,
  // the loot shared out); taking a job up with its person chooses it: THE JOB
  if (JF && JF.prompt) add('folk', JF.prompt, () => { const was = JF.prompt; JF.talk(); if (/camera/.test(was || '') && DJ && DJ.lent()) chooseJob('deer'); else if (/lock boxes/.test(was || '')) chooseJob('boxes'); }, JF.promptAt);
  // by a build site's person (src/buildsite.js: the miller on the mill hill): E opens the builder there (the old
  // fisherman, his day's fishing done: a word with him, his polite no)
  if (BS && BS.prompt) {
    if (SK && SK.done('fishing') && BS.state().near === 'fishing') add('site', 'Talk to the old fisherman', () => shiftNo('fishing'), BS.promptAt);
    else add('site', BS.prompt, () => BS.talk(), BS.promptAt);
  }
  // by a wild apple tree with apples on it, on foot (src/feeding.js): E picks them
  if (FEEDER && FEEDER.prompt) add('apples', FEEDER.prompt, () => FEEDER.pick(), FEEDER.tree);
  // at the target range (src/missions/shooting.js): E by Miss Opal takes up her six-shooter
  if (SR && SR.prompt) add('range', SR.prompt, () => SR.start(), SR.promptAt);
  // by a saddle rack in the stable's lean-to (src/stablelife.js): E buys it, or puts it on your horse
  if (STABLE && STABLE.prompt) add('rack', STABLE.prompt, () => STABLE.act(), STABLE.promptAt);
  // inside a building, on foot: the spot most directly in front of the view (src/usespots.js), its prompt floating over it
  if (US && US.prompt) add('spot:' + (US.spot && US.spot.id), US.prompt, () => US.act(), US.at, { over: true });
  // at a code-built building's doorway, on foot (world/objects/doorkeeper.js): E opens or shuts its door
  const DK = W && W.V && W.V.CODE && W.V.CODE.doors, kd = DK && P.mode === 'foot' ? DK.near(P.position.x, P.position.z) : null;
  if (kd) add('door', kd.open ? 'Close the door' : 'Open the door', () => DK.use(kd.door, !kd.open), kd.door);
  // the way the view looks (the camera's, along the ground), from the player
  camera.getWorldDirection(_face); const fl = Math.hypot(_face.x, _face.z) || 1, face = { x: _face.x / fl, z: _face.z / fl };
  const horseFirst = (called || fresh) && cands.find((c) => c.key === 'horse');
  const pick = horseFirst || pickAction(cands, P.position, face, { current: actWas });
  actWas = pick ? pick.key : null;
  const say = pick ? pick.say : null, act = pick ? pick.act : null, over = pick && pick.over ? US.screen() : null;
  if (pick && pick.door) door = pick.door;   // (a tap on the prompt opens that counter: hud onPrompt)
  hud.prompt(say, say ? over : null);
  if (act && I.enabled && I.tap('KeyE')) act();
  // walking up to the saloon's doors, Old Hob tells of the band inside (src/hob.js LINES.saloon); at the store's and the
  // sheriff's, of who is inside and what to do there (LINES.store, LINES.sheriff)
  if (hob) for (const k of ['saloon', ...(TR && TR.frame('generalStore') ? ['store'] : []), ...(TR && TR.frame('sheriff') ? ['sheriff'] : [])]) {
    const pl = W.places[k];
    if (pl && pl.door && Math.hypot(P.position.x - pl.door.x, P.position.z - pl.door.z) < NEAR_REMARK) hob.event('near', { place: k });
  }
}

// ── THE BAND'S CARD ──────────────────────────────────────────────────────────────────────────────────────────────
// at the front of the saloon's stage: the songs by name and "Take a break" (src/ui/bandcard.js); one tap asks the band
// (src/stage.js) and the card goes. The game carries on behind it; a panel opening over the game closes it
function openBand() {
  if (!stage || paused) return;
  if (!bandCard) bandCard = makeBandCard({ onPick: (id) => { if (!stage) return; if (id === 'break') stage.rest(); else if (id === 'again') stage.again(); else stage.request(id); } });
  bandCard.open(stage.choices());
}

// ── THE COMPASS: the cabin, the job and your horse ─────────────────────────────────────────────────────────────────
// the "call your horse" button (H): while the player's horse is far off, or out of view and not close by; never while
// riding, before a saddle is bought, while it is already coming, or while a job has the player (src/ui/hud.js)
const CALL = { far: 25, near: 8, after: 0.5 };   // m: shown past far; never inside near; s it must be wanted first
const _hp = new THREE.Vector3();
let callT = 0;
function horseButton(dt) {
  let want = false;
  if (P && P.horse && P.horse.root && P.canRide && !P.onHorse && P.mode === 'foot' && P.enabled !== false && !P.horseComing) {
    const h = P.horse.root.position, d = Math.hypot(h.x - P.position.x, h.z - P.position.z);
    if (d > CALL.far) want = true;
    else if (d > CALL.near) { _hp.set(h.x, h.y + 1, h.z).project(camera); want = _hp.z > 1 || Math.abs(_hp.x) > 1 || Math.abs(_hp.y) > 1; }
  }
  callT = want ? callT + dt : 0;
  hud.callHorse(callT >= CALL.after);
}
function compass() {
  const at = P.position, marks = [];
  const add = (id, icon, x, z, label) => marks.push({ id, icon, label, bearing: Math.atan2(x - at.x, z - at.z), dist: Math.hypot(x - at.x, z - at.z) });
  const c = W.places.cabin; if (c) add('cabin', 'cabin', c.door.x, c.door.z, (cabin && cabin.markLabel) || 'Your cabin');
  const pa = W.places.pasture; if (RU && pa) add('job', 'job', pa.x, pa.z, 'The round-up');
  const sp = farm && farm.layout.sheep; if (SH && sp) add('farm', 'job', sp.x, sp.z, 'The farm: sick sheep');
  const py = farm && farm.layout.yard; if (PG && py) add('pigs', 'job', py.x, py.z, 'The farm: loose pigs');
  if (DL) for (const m of DL.marks()) add(m.id, m.icon, m.x, m.z, m.label);   // (the store or the camp for a delivery)
  { const w = WJ && WJ.where(); if (w) add('wagon', 'job', w.x, w.z, 'A wagon held up'); }   // (a hold-up under way)
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
  r: 58, up: 30,          // metres from the square's middle, and above it (high enough to look over the trees' crowns:
                          // at 20 a tree stood right in front of the camera through the middle of the sweep)
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

// the traffic's teams on the move, for the player's "easy now" by a moving horse (src/audio/shouts.js)
const teamsNear = [];
function teamHorses() {
  teamsNear.length = 0;
  if (traffic) for (const t of traffic.wagons) { const h = t.wg && !t.ghost && t.wg.team && t.wg.team[0]; if (h && h.root) teamsNear.push({ x: h.root.position.x, z: h.root.position.z, speed: t.wg.pace || 0 }); }
  return teamsNear;
}
// the town's sounds each frame of play (quieter and muffled inside the cabin; dipped under the action music and Hob)
function townSounds(dt, indoor) {
  if (!AMBI || !P) return;
  const m = WJ && WJ.music ? WJ.music.state() : null;
  if (READ) READ.update(dt);   // (a card's line waiting on its clips or on a shout)
  if (SHOUT && !indoor) SHOUT.update(dt, { P, I, horses: teamHorses });   // (the player's shouts: a spur, a pull-up, a hello, a long gallop)
  AMBI.update(dt, { at: P.position, flock: townLifeNow(), P, D, HS, farm, RU, SH, PG, traffic, indoor, music: m ? Math.min(1, m.action + (m.trail > 0.05 ? 0.4 : 0)) : 0, voice: !!((SHOUT && SHOUT.speaking) || (READ && READ.speaking)) });
}

// ── DEPTH OF FIELD in the close-ups (src/fx/dof.js): ?dof or BM.dev.dof(true), gaming tier only ───────────────────────
// What each close-up keeps sharp: a builder's site (the tower, the bridge), the end of the dock (the angler) or the fish
// held up for its card, the cabin's room in first person (the view out of its windows goes soft). Riding: nothing (the
// pass is skipped altogether once its blur has eased out)
let DOFX = Q.has('dof') ? makeDof({ renderer, camera, on: true }) : null;
const DOF_CABIN = { dist: 2.5, sharp: 3.5, ramp: 10 }, _dofAt = new THREE.Vector3();
function dofWant() {
  if (!W || W.tier !== 'gaming' || state !== 'play') return null;
  if (cabin && cabin.inside) return DOF_CABIN;
  const s = BS && BS.active; if (!s) return null;
  if (s.id === 'fishing') {
    const B = FJ && FJ.builder, ph = B && B.handle ? B.handle.state().phase : '';
    const v = /^(lift|card|stash|release)$/.test(ph) && B.cardView ? B.cardView() : null;   // (a fish held up: on the fish)
    if (v) { _dofAt.copy(v.look); return { at: _dofAt, sharp: 1.2, ramp: 8 }; }
    const z = DOCK.foot + DOCK.len; _dofAt.set(DOCK.x, W.heightAt(DOCK.x, z) + DOCK.deck + 1, z);   // (the angler at the end of the dock)
    return { at: _dofAt, sharp: 5, ramp: 30 };
  }
  _dofAt.copy(s.origin); _dofAt.y += 3;   // (the middle of what is built, a little up)
  const d = camera.position.distanceTo(_dofAt);
  return { at: _dofAt, sharp: 3 + d * 0.3, ramp: 8 + d * 0.9 };
}

// ── EACH FRAME ───────────────────────────────────────────────────────────────────────────────────────────────────
let last = performance.now(), frames = 0, fpsT = last, fpsNow = 0, needDraw = false, drawn = { calls: 0, triangles: 0 };
let toolsT = 0, fadesT = 1;
function step(dt) {
  if (!W) return;
  // (the cabin has the player: walking in or out, or inside. It stands in the valley, so the valley goes on round it:
  // the townsfolk, the wagons and the band are seen through its windows; only the player is the cabin's to move)
  const home = !!(cabin && cabin.inside);
  hideHowdies(state !== 'play' || paused || home || atCounter());   // (no Howdy bubbles over a panel, the cabin or a counter)
  if (state === 'play' && JF) JF.update(paused ? 0 : dt, { hidden: paused || home || atCounter() });   // (the job folk: before the doors, which show their prompt)
  townLife(W, state === 'play' && paused ? 0 : dt, P, D);   // the chickens about the town (made on the first call)
  if (state === 'play' && TP) TP.update(paused ? 0 : dt, { hidden: paused });   // the townsfolk going about
  if (state === 'play') {
    // (a horse picked at the stable stays "just picked" while the stable's panel is open: E after closing it gets on)
    if (paused && P && P.horsePickedAt > performance.now() - 8000) P.horsePickedAt = performance.now();
    if (paused) {
      hud.callHorse(false);
      if (!pausedBy.has('menu')) { if (stage) stage.update(dt, P.position); if (saloonFolk) saloonFolk.update(dt, P.position); }   // (the band plays on behind a card)
      if (needDraw) { needDraw = false; if (home) cabin.render(); else W.render(); }
      return;
    }
    if (home) { hud.callHorse(false); door = null; cabin.update(dt); }   // (no town door while inside: E and the prompt are the cabin's; it moves the player)
    else { if (atCounter()) hud.prompt(null); else doors(); P.update(dt); }
    if (!home && W.wrap) { const w = W.wrap(P.position, camera.position); if (w) { P.shift(w); if (D) D.shift(w); if (UNST) UNST.clear(); } }
    if (UNST) UNST.update(dt, P.position, !home && !atCounter() && (P.mode === 'foot' || P.mode === 'horse'));   // (a good spot to go back to)
    passKeeper();   // (rode on into the mist at an end of the valley: out of the other end's, src/world.js)
    if (D) D.update(dt);
    if (cabin) cabin.town(dt);
    // (the wagon's gang took the shared times trainer's wave: back at the herd, the round-up deals its own afresh, but
    // never while the gang's wave is still open beside the wagon, or the two jobs take the trainer from each other; only
    // a herd uses the trainer: a series card wave carries on)
    if (WJ && WJ.tookTrainer && RU.near && !(WJ.near && WJ.wave && !WJ.wave.done)) { WJ.tookTrainer = false; if ((!RU.wave || RU.wave.topic === 'times') && shiftOpen('roundup')) RU.newWave(); }   // (none while the round-up's day's shift is done)
    RU.update(dt);
    if (farm) farm.update(dt, P.position);
    if (HS) HS.update(dt, P.position);   // (the farm animals behind the cabin; their goods are laid up over play time)
    if (PEN) PEN.update(dt);             // (the horses for sale behind the stable)
    if (STABLE) STABLE.update(dt);       // (the stall horses and the saddle racks in the stable)
    if (TR) TR.update(dt);               // (the store's dog asleep on its bed, its six-shooter while it is for sale)
    if (FEEDER) {                        // (the apple trees' apples, a horse's head in reach, the hearts floating up)
      FEEDER.update(dt, { busy: home || atCounter() });
      if (I.enabled && I.tap('KeyG')) FEEDER.feed();   // (G: give a treat; E stays on and off)
    }
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
    // the big touch button says Shoot near the bandits once the six-shooter is the rider's tool (src/gun.js)
    hud.fireWord(canShoot(rider) && ((WJ && WJ.near) || (LJ && LJ.guardUp)) ? 'Shoot' : 'Rope');
    if (WMJ) WMJ.update(dt);
    if (BRJ) BRJ.update(dt, P.position);
    if (FJ) FJ.update(dt);   // (the rider and the double at the end of the dock fading)
    if (BS) BS.update(dt);   // (after the player: it places the camera while a builder is up)
    if (JB) JB.update(dt, P.position, { busy: askingJob() });   // (a job picked on the jobs board: its tracks lead first, till the rider is there or busy at a job)
    jobStep();   // (the job the rider chose keeps the card: THE JOB)
    if (SK) SK.update(dt);   // (the shifts: the sunrise, a shift's ending, the counter on the HUD)
    if ((toolsT -= dt) <= 0) { toolsT = 0.25; TOOLS.update(); }   // (the tools strip: the sum on Work it out, the place's level)
    if ((fadesT -= dt) <= 0) { fadesT = 1; checkFades(W.scene); }   // (anyone left part-faded walking about made solid: src/actors/folk.js)
    hob.trailTo((JB && JB.goal()) || hobGoal() || trailGoal());
    hob.update(dt, P.position, { hold: !!((JF && JF.speaking()) || (SR && SR.speaking()) || home), asking: askingJob() });   // (on a phone, Hob waits while a job person is talking or you're in the cabin; while a question is up, only its job's lines come)
    if (stage) stage.update(dt, P.position);
    if (saloonFolk) saloonFolk.update(dt, P.position);   // (after the band: its beat, its song's end)
    if (GT) GT.update(dt, P.position);   // (the Professor at the chalkboard)
    if (bandCard && bandCard.isOpen && !(stage && stage.inReach)) bandCard.close();   // (walked away from the stage)
    if (traffic) { traffic.keepView = SJ && SJ.active && !P.cam.enabled ? camera : null; traffic.update(dt, P.position, camera.position); }   // (no wagon through the store counter's picture)
    townSounds(dt, !!(cabin && cabin.indoor));   // (muffled inside the cabin with its door shut)
    W.update(dt);
    if (DOFX && DOFX.frame(dt, dofWant())) { DOFX.begin(); W.render(DOFX.end); } else W.render();   // (the close-ups' depth of field, when switched on: below)
    if (SR) SR.draw();   // (the six-shooter, drawn over the valley)
    AUD.listen(camera);
    compass();
    horseButton(dt);
    if (I.touch && !home) hud.touch(true);
  } else if (state === 'title') {
    titleCam(dt); W.update(dt); W.render();
  }
}
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (PERF) renderer.info.reset();   // (the frame's count starts here: see autoReset above)
  step(dt);
  if (W && W.governor) W.governor.work(now);   // (the frame's own work, for the governor's spare-time test)
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
for (const k of ['cabin', 'stable', 'store', 'sheriff', 'saloon']) {
  SPOTS[k] = () => { const b = W.places[k]; if (!b) return W.places.spawn; return { x: b.door.x + Math.sin(b.rot) * 1.2, z: b.door.z + Math.cos(b.rot) * 1.2, rot: b.rot + Math.PI }; };
}
// the camps (src/camps.js): out front, where a horse with crates is unloaded, facing the camp
for (const id of ['cow', 'hollis', 'survey']) SPOTS['camp-' + id] = () => { const c = camps && camps.byId(id); if (!c) return W.places.spawn; return { x: c.drop.x, z: c.drop.z, rot: Math.atan2(c.x - c.drop.x, c.z - c.drop.z) }; };
// beside the held-up wagon, facing the way it was going; with none, out on the long road west of town (where hold-ups
// happen), by the road and facing along it
SPOTS.wagon = () => {
  const s = WJ && WJ.spot(); if (s) return s;
  if (!traffic || !traffic.road) return W.places.spawn;
  const c = traffic.road, L = c.getLength(), u = Math.max(4, traffic.square - 250) / L, p = c.getPointAt(u), t = c.getTangentAt(u);
  return { x: p.x + t.z * 4, z: p.z - t.x * 4, rot: Math.atan2(t.x, t.z) };
};
// at the target range, a couple of steps behind the firing line, facing downrange
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
  dof(on = true) { if (!DOFX) DOFX = makeDof({ renderer, camera }); DOFX.on = !!on; return DOFX.state(); },   // (the close-ups' depth of field: src/fx/dof.js)
  lockbox(tier) { if (!rider) return false; if (state === 'play') openBox({ tier: tier || boxTier(rider), from: 'sheriff' }); return true; },
  spot() { return spotNote(); },
  unstick() { return unstick(); },   // (the menu's "I'm stuck: move me"; BM.dev.unstickTrail() its trail)
  unstickTrail() { return UNST ? UNST.trail.map((q) => ({ ...q })) : []; },   // (the menu's "Mark this spot" line, for rigs)
  saddle(kind = 'plain') { if (!rider) return; const o = rider.owned; o.saddles = [...new Set([...(o.saddles || []), kind])]; o.saddle = kind; saveRider(rider); if (P) P.refreshOwned(); refresh(); },
  // a wagon on the road coming toward the player (from about 70 m up the road)
  wagon(dir, kind, o = {}) { if (!traffic || !P) return null; return traffic.sendNear(P.position, { dir, kind, ...o }); },
  dog(kind = 'shiba', name = 'Biscuit') { if (!rider) return; rider.owned.dog = { kind, name }; saveRider(rider); makeDogIfOwned(); },
  box(tier) { if (!rider) return; (rider.lockboxes = rider.lockboxes || []).push({ tier: tier || boxTier(rider), from: 'loot' }); saveRider(rider); refresh(); },
  // the title's backdrop camera: where round the square it is now, and (for a rig trying views) its settings
  orbit(at = null, o = {}) { fixedAt = at; Object.assign(TITLE_CAM, o); titleCam(0); },
};
{ const m = dev.mission; dev.mission = (name, ...a) => (name === 'delivery' ? !!(DL && DL.orderFrom(a[0] || 'cow')) : m(name, ...a)); }   // (an order from a camp, without riding out to it)
{ const m = dev.mission; dev.mission = (name, ...a) => { if (name !== 'wagon') return m(name, ...a); if (!WJ) return false; if (!WJ.ambush && !WJ.dev.holdUp(a[0] || {})) return false; dev.goto('wagon'); return true; }; }   // (a hold-up at once on a wagon up the road, as the jobs board's, and the player beside it)
{ const m = dev.mission; dev.mission = (name, ...a) => { if (name !== 'deer') return m(name, ...a); const H = DJ && DJ.herd(); if (!H) return false; const sq = W.places.square, l = Math.hypot(sq.x - H.mid.x, sq.z - H.mid.z) || 1, x = H.mid.x + (sq.x - H.mid.x) / l * 32, z = H.mid.z + (sq.z - H.mid.z) / l * 32; P.teleport(x, z, Math.atan2(H.mid.x - x, H.mid.z - z)); return true; }; }   // (32 m from the deer job's herd, on the town's side)
{ const m = dev.mission; dev.mission = (name, ...a) => { if (name !== 'range') return m(name, ...a); if (!SR) return false; dev.goto('range'); setTimeout(() => { if (SR && SR.prompt) SR.start(); }, 400); return true; }; }   // (the six-shooter up at the range)
// the homestead behind the cabin: between the cabin's back wall and the animals' homes, looking out at them; an animal
// of a kind (hen, pig, sheep, cow) or goods in the saddlebags without buying
SPOTS.mill = () => ({ x: -93.3 + 9, z: -171.9 + 2, rot: -Math.PI / 2 });   // (on the mill hill, a few steps east of the miller, facing him)
SPOTS.dock = () => ({ x: -4.4 + 2.4, z: -100.5, rot: Math.atan2(-6.6 - (-4.4 + 2.4), -96.5 - (-100.5)) });   // (on the path down to the lake, a few steps from the fisherman, facing him)
SPOTS.bridge = () => ({ x: -339.2, z: -52, rot: 0 });   // (on the road on the north bank, a few steps up from the engineer, facing the ravine)
SPOTS.homes = () => (TP && TP.laneSpot()) || W.places.spawn;   // (the townsfolk's homes: the middle of their lane)
SPOTS.yard = () => { if (!HS) return W.places.spawn; const L = HS.layout, p = L.at(0, 5.6); return { x: p.x, z: p.z, rot: L.rot }; };
Object.assign(dev, { animal: (kind = 'hen', name = '', young = false) => !!(HS && HS.dev.give(kind, name, young)), goods: (n = 30) => { if (HS) HS.dev.goods(n); } });
// loot the gang: beside the gang's cache, or at the sheriff's office where it's handed back; mission('loot') rides to the cache
SPOTS.cache = () => (LJ && LJ.dev.at()) || W.places.spawn;
SPOTS['loot-town'] = () => (LJ ? LJ.dev.town() : W.places.spawn);
{ const m = dev.mission; dev.mission = (name, ...a) => { if (name !== 'loot') return m(name, ...a); if (!LJ) return false; return dev.goto('cache'); }; }
dev.lootLoad = () => !!(LJ && LJ.dev.load());   // (straight to the cache with the horse, to load it)
// the skill model (src/math/skill.js): put a strand at a level (placed, or placed: false to run its baseline from
// there), and read the rider's strands back (the stats page's rows)
dev.skill = (strand, pct, { placed = true } = {}) => { if (!rider) return null; SKILLS.setLevel(rider, strand, pct, { placed }); saveRider(rider); return SKILLS.levelOf(rider, strand); };
dev.skills = () => (rider ? SKILLS.stats(rider) : []);
// the levels (src/levels/model.js): put the rider on a place's level (placed, or placed: false to run its placement
// from there), and read every place's level back
dev.level = (place, id, { placed = true, into = 0 } = {}) => { if (!rider) return null; LEVELS.setLevelAt(rider, place, id, { placed, into }); saveRider(rider); return LEVELS.levelFor(rider, place); };
dev.levels = () => (rider ? LEVELS.placeStats(rider) : []);
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
  door: { get: () => door }, store: { get: () => SJ }, paused: { get: () => paused }, cabin: { get: () => cabin },
});
Object.defineProperties(BM, { deer: { get: () => deer }, deerjob: { get: () => DJ }, jobfolk: { get: () => JF } });
Object.defineProperties(BM, { board: { get: () => JB }, job: { get: () => theJob } });   // (the jobs board; the job the rider chose: THE JOB)
Object.defineProperties(BM, { townpeople: { get: () => TP } });   // (the townsfolk: TP.state(), TP.log)
Object.defineProperties(BM, { range: { get: () => SR } });   // (the target range)
Object.defineProperties(BM, { pen: { get: () => PEN } });   // (the horse pen: BM.pen.dev.state(), .roll(seed), .visit())
Object.defineProperties(BM, { sites: { get: () => BS }, windmill: { get: () => WMJ } });   // (the build sites; the windmill job: .builder.handle is the lab's WM handle)
Object.defineProperties(BM, { bridge: { get: () => BRJ } });   // (the bridge job: .builder.handle is the lab's BR handle; .state(), .rating())
Object.defineProperties(BM, { fishing: { get: () => FJ } });   // (the fishing job: .builder.handle is the lab's FI handle; .state())
Object.defineProperties(BM, { checklist: { get: () => CM } });   // (the checklist's toasts and goals corner, while riding)
Object.defineProperties(BM, { shifts: { get: () => SK } });
Object.defineProperties(BM, { feeding: { get: () => FEEDER } });   // (the horses' treats: BM.feeding.state(), .feed(), .pick())   // (the shifts: BM.shifts.state(), .dev.end(id), .dev.day(): src/shiftkeeper.js)
Object.defineProperties(BM, { camps: { get: () => camps }, delivery: { get: () => DL }, homestead: { get: () => HS }, loot: { get: () => LJ } });   // (the camps and their deliveries; DL.rob() is the bandits' hook)
Object.assign(BM, {
  dev, hud, title: T, camera, renderer, screenOf, prices: PRICES, loading, skills: SKILLS,
  levels: LEVELS, facts: FACTS,   // (src/levels/model.js: each place's ladder and the rider's level there; src/math/facts.js: the times facts)
  feedback: FB,   // (src/feedback.js: FB.state() says the device id, the switch and what was sent)
  fps: (seconds = 3) => new Promise((res) => { let n = 0; const a = performance.now(); const f = () => { n++; if (performance.now() - a < seconds * 1000) requestAnimationFrame(f); else res(n * 1000 / (performance.now() - a)); }; requestAnimationFrame(f); }),
  // a frame's real cost, not held to the screen's refresh: n frames drawn back to back, each waited for
  frameMs: (n = 60) => { const gl = renderer.getContext(), px = new Uint8Array(4); let worst = 0; const a = performance.now();
    for (let i = 0; i < n; i++) { const f0 = performance.now(); step(1 / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); worst = Math.max(worst, performance.now() - f0); }
    last = performance.now(); return { avg: (performance.now() - a) / n, worst }; },
});
