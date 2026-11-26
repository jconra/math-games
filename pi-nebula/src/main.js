// THE SPACE GAME'S PAGE. What happens, in order:
//   1. the title screen goes up at once (the shared engine with this game's theme: ui/title.js), over a dark page;
//   2. the looks' pictures, stored ready-made, appear all together (portraits.js); the station is built behind the
//      title (station.js: the kit's own room file and code) while the crew kit loads, the loading strip along the
//      bottom of the screen saying what is loading and how far (ui/loadbar.js);
//   3. the station fades in behind the title, the camera drifting slowly somewhere handsome; where a person can walk
//      is worked out from the station as built (walls.js);
//   4. the start button puts the chosen crew member in their quarters, walking (player.js, chase.js, the shared
//      input); the station's people (people.js, spots.js) come aboard as the player wakes.
//
// Address switches (for testing):
//   ?q=low|medium|high   the picture's quality (otherwise medium on a touch screen, high elsewhere)
//   ?view=name           the title's view (a view named in the station file)
//   ?hold                no clock of its own: nothing moves until GAME.step(dt) is called (for films and frame strips)
//   ?rig                 keeps the picture readable for a screenshot
//   ?nopeople            the station without its people
//   ?seed=N              which of the outside's windows are lit (otherwise a different half each time the game starts)
//   ?tune=arrive|leave   signed as a ship's engineer: its core needs tuning out at the rocks, on arrival there or
//                        before the jump home (otherwise one or the other, picked as the contract is signed:
//                        src/missions.js pickTune)
//   ?crowd=N             that many of the station's people about the player at once, whatever the quality (life.js NEAR:
//                        the cost rigs); ?far=N: people drawn with their far copy from N metres (people.js LIFE.far)
//   ?music=1|0           the station's music on or off, remembered in this browser (off at first: src/music/switch.js;
//                        on, src/music/game.js is loaded); ?notes=live with it: every note made live, not pre-rendered
import * as THREE from 'three';
import { GAME_NAME } from './name.js';
import * as save from './save.js';
import { showTitle } from './ui/title.js';
import { loadStation } from './station.js';
import { loadCrew } from '../kit/crew.js';
import { drawLooks, drawn, storedReady, storedInfo, useKit, restStudio, made } from './portraits.js';
import { showLoadBar } from './ui/loadbar.js';
import { recipeOf } from './looks.js';
import { makeWalls } from './walls.js';
import { makeBoarding, STANDS_ANYWHERE } from './boarding.js';
import { makeDockWalk } from './dockwalk.js';
import { makeVisit } from './visit.js';
import { makeCrane } from './crane.js';
import { makeChase, CAM } from './chase.js';
import { makePlayer, shine } from './player.js';
import { makePeople, resolve } from './people.js';
import { makeChallenges } from './mathball/challenge.js';
import { makeFriends } from './friends.js';
import { makeFriendCard } from './friendcard.js';
import { START } from './spots.js';
import { makeInput } from '../../shared/input.js';
import { startJobs } from './jobs/index.js';
import { cargoLink } from './jobs/cargolink.js';
import { credits } from './jobs/engine.js';
import { sound } from './sound.js';
import { soundButton } from './ui/soundbutton.js';
import { makeGuide } from './guide.js';
import { makeJobsBoard } from './jobsboard.js';
import { news } from './news.js';
import { makeMission } from './mission.js';
import { makeShipPaint } from './shippaint.js';
import { makeKiosk } from './kiosk.js';
import { addOutside } from './outside.js';
import { makeAnnounce } from './announce.js';
import { makeLift } from './lift.js';
import { makeCargoForklift } from './cargoforklift.js';
import { makeCargoDrive } from './cargodrive.js';
import { makeSupplyRun } from './supplyrun.js';
import { makeCargoLap } from './cargolap.js';
import { bridgeStands } from './jobs/dock.js';
import { pointGap } from '../kit/forkliftround.js';
import { STORE } from '../kit/places-plan.js';
import { musicWanted } from './music/switch.js';

const LOAD_BYTES = 'calc-station.load.bytes';   // (the bytes the last whole load came to, for the loading strip)
const BUILD = 5;                 // shown small on the title; goes up with index.html's ?v=
const q = new URLSearchParams(location.search);
const HOLD = q.has('hold'), RIG = HOLD || q.has('rig');

document.title = GAME_NAME;
const canvas = document.getElementById('game');
const GAME = window.GAME = { ready: false, mode: 'title', frames: 0, missing: [], drawn, made };
const fail = (e) => { console.error(e); if (window.oops) window.oops(e); };

async function boot() {
  const players = save.load();
  let chosen = null, canBuild = false;
  // (a look changed in the character maker, press after press: the character is built once the presses have stopped)
  let buildSoon = 0;
  const T = showTitle(document.getElementById('title-root'), { players, build: BUILD, onStart: start, onChange: (p) => { chosen = p; clearTimeout(buildSoon); if (canBuild) buildSoon = setTimeout(() => prebuild(chosen), 700); } });
  GAME.T = T; chosen = T.player();
  // the loading strip: the bytes expected are the last visit's whole load in this browser, or the stored pictures' rig's
  let expect = 0;
  try { expect = +localStorage.getItem(LOAD_BYTES) || 0; } catch (e) { /* blocked: the rig's figure */ }
  const bar = GAME.bar = showLoadBar(document.body, { expect });
  if (!expect) storedReady.then(() => bar.expect(storedInfo().bytes)).catch(() => {});
  const progress = (f, words) => { T.setProgress(f, words); bar.set(f, words); };
  progress(0.01, 'Waking the station');
  // each file that arrives moves the loading bar on a little
  try { new PerformanceObserver((list) => { for (let i = list.getEntries().length; i > 0; i--) T.nudge(); }).observe({ type: 'resource' }); } catch (e) { /* an old browser: the bar still moves */ }

  // the crew kit, for the looks' pictures, the player and the people (one copy for all three)
  const libP = loadCrew();
  // (the looks' pictures are stored ready-made and on their way already; a look with none is drawn here once the kit is in;
  // then the kit is the character maker's: its arrows' list of parts, and the pictures of the looks made with it)
  Promise.all([libP, storedReady]).then(([lib, missing]) => (missing.length ? drawLooks(lib, { only: missing }) : null)).catch(fail).then(() => libP).then(useKit).catch(fail);

  const W = await loadStation({ canvas, quality: q.get('q'), rig: RIG, say: (f, words) => progress(0.02 + f * 0.8, words) });
  GAME.W = W;
  // the station's outside, round the rooms: seen from the windows, out of the hangar doors, and from a ship flown out
  // (src/outside.js). Its lit windows are a different half each time the game starts (?seed=N: the same ones, for the rigs)
  const outside = GAME.outside = addOutside(W, { seed: q.has('seed') ? +q.get('seed') || 0 : Math.floor(Math.random() * 1e6) });

  // ── where a person can walk ──────────────────────────────────────────────────────────────────────────────────
  progress(0.84, 'Checking the doors');
  await new Promise((go) => setTimeout(go, 0));
  // (the parked Miner's own room is felt as a part of its own: flown in by hand it stands wherever it was set down,
  // and its hull and legs with it: walls.js `apart`, boarding.js stand. The Explorer's and the Medic's too: the Miner,
  // flown into their hangars, can shove them about: src/visit.js)
  const walls = makeWalls(W.built, { portals: W.R.portals, apart: STANDS_ANYWHERE });
  for (const d of walls.doors) if (d.locked) W.keepShut.add(d.D);   // (the doors to space stay shut)
  GAME.walls = walls;
  // (the big scanner glides only with someone on its bed: parked until the station's people put a patient there)
  for (const D of W.built.glides || []) D.use = null;
  // (the bridge to the Hauler at the dock, once the crew member playing has built it: walked across, dockwalk.js)
  const dockWalk = W.dockWalk = GAME.dockWalk = makeDockWalk({ W, walls, crew: () => GAME.player });
  // (the parked ships: their cabins loaded when someone is near, boarded up their stairs and ramps; the Hauler's across
  // its bridge: boarding.js)
  const boarding = GAME.boarding = makeBoarding({ W, walls, quality: W.quality, dock: dockWalk.boarding });
  // (the smelter's ore line: the Miner hangar's crane swapping the ship's canisters by itself, src/crane.js)
  const crane = GAME.crane = makeCrane({ W, walls, boarding });
  // (the other two hangars, for a Miner flown into them by hand: the alarm, the red lights, the people running, the
  // parked ship shoved and put back: src/visit.js. The crane is the Miner's keeper, should another ship ever be flown
  // into its hangar here: in the game only the Miner flies yet, so it is never shoved)
  const visit = GAME.visit = makeVisit({ W, boarding, outside, people: () => people, crane });
  // (each ship in the paint the crew member playing picked for it, if it is theirs; the ship shown from outside while
  // its paint is picked on the owner's card: src/shippaint.js)
  const shipPaint = W.shipPaint = GAME.shipPaint = makeShipPaint({ W, crew: () => GAME.player, save: (p) => save.save(p), boarding, hauler: () => outside.hauler });
  // (the station's announcements over the speakers, a chime first, about once a minute: src/announce.js)
  const announce = GAME.announce = makeAnnounce({ sound, W, visit, people: () => people, crew: () => GAME.player });
  // (the station's music, only when asked for: ?music=1; otherwise none of it is loaded, src/music/switch.js)
  // (and with it, its screens in the station's places and aboard the ships, and the hallways' lines: src/music/places.js;
  // with the music off they are there, dark, and none of this is loaded)
  let music = null, musicPlaces = null;
  { let want = { on: false }; try { want = musicWanted(location.search, localStorage); } catch (e) { /* blocked: off */ }
    if (want.on) import('./music/game.js').then((m) => { music = GAME.music = m.startGameMusic({ sound, notes: want.notes }); return import('./music/places.js'); })
      .then((m) => { musicPlaces = GAME.musicPlaces = m.startMusicPlaces({ W, walls, input, game: music, boarding, mission: { get busy() { return !!(GAME.mission && GAME.mission.busy); } },
        quiet: () => !!(GAME.jobs && (GAME.jobs.near || GAME.jobs.panel)) || !!(GAME.board && (GAME.board.near || GAME.board.isOpen)) || !!(GAME.kiosk && (GAME.kiosk.near || GAME.kiosk.isOpen)) || !!(people && people.bubbles.asking) }); }).catch(fail); }

  // ── the title's view: a named view in the station file, the camera swaying a little round it ──────────────────
  const TITLE_VIEWS = ['terminal', 'windows', 'hangar', 'overlook', 'start', 'spawn'];
  const titleView = W.view(q.get('view')) || TITLE_VIEWS.map(W.view).find(Boolean) || fromSpawn(W);
  const side = new THREE.Vector3(), fwd = new THREE.Vector3(), at = new THREE.Vector3(), look = new THREE.Vector3();
  function drift(t) {
    const v = titleView;
    fwd.subVectors(v.look, v.at).setY(0).normalize(); side.set(-fwd.z, 0, fwd.x);
    // (small: a view stands where its maker put it, and the walls are near)
    at.copy(v.at).addScaledVector(side, Math.sin(t * 0.11) * 0.55).addScaledVector(fwd, Math.sin(t * 0.07 + 1) * 0.35);
    at.y += Math.sin(t * 0.09 + 2) * 0.08;
    look.copy(v.look).addScaledVector(side, Math.sin(t * 0.06 + 0.5) * 1.4); look.y += Math.sin(t * 0.05) * 0.3;
    W.camera.position.copy(at); W.camera.lookAt(look); setFov(v.fov);
  }
  function setFov(fov) { if (W.camera.fov !== fov) { W.camera.fov = fov; W.camera.updateProjectionMatrix(); } }

  // ── the player: the keys and the thumb stick (shared with Mathwood), the camera, the character ─────────────────
  const input = makeInput(canvas, { camera: W.camera, stick: { ring: 'rgba(170, 215, 255, .6)', back: 'rgba(10, 16, 24, .3)', knob: 'rgba(240, 150, 60, .75)' } });
  input.enabled = false;
  const chase = makeChase(W.camera, walls);
  let player = null, building = null, people = null;
  // (FRIENDSHIP: everyone's meter, kept with the crew member's save, src/friends.js; a tap on a person, src/friendcard.js)
  const friends = GAME.friends = makeFriends({ crew: () => GAME.player, save: (p) => save.save(p) });
  const friendCard = GAME.friendCard = makeFriendCard({ input, camera: W.camera, people: () => people, friends, crew: () => GAME.player, game: GAME, save: (p) => save.save(p) });
  let walkFree = false;      // (on their feet and free to talk to someone: no job, run, lift or forklift)
  const auto = { way: null, i: 0 };       // (a rig walking the player somewhere: GAME.walkTo)
  const lib = await libP;
  progress(0.92, 'Waking the crew');
  // the chosen crew member's character, built ahead so the start button is quick
  // (a look changed or another crew member picked before this: built for the latest; one no longer wanted is let go)
  function prebuild(p) {
    if (!p || !p.look) return null;
    const key = p.id + ':' + JSON.stringify(p.look);
    if (building && building.key === key) return building.ready;
    const old = building;
    const ready = makePlayer({ lib, recipe: recipeOf(p.look, lib), walls, scene: W.scene }).then((P) => { P.c.root.visible = false; return P; });
    building = { key, ready };
    if (old) old.ready.then((P) => { if (!player || player.P !== P) P.dispose(); }).catch(() => {});
    return ready;
  }
  canBuild = true;
  prebuild(chosen);
  // the station's jobs: their spots, the prompt, the job panel (jobs/index.js); credits are saved with the crew member
  // (the smelter's pay slips count the canisters really in the hangar: the crane's load, as it is when a slip is made)
  // (the crane itself too: the operator area's two options, free control and the crane operator job, work it)
  const jobs = GAME.jobs = startJobs({ W, walls, input, crew: () => GAME.player, save: (p) => save.save(p), // (and at the smelter's controls a share of a captain's run may be waiting: its card comes first, src/mission.js)
    // (and a rescue's share at the triage desk: src/missions.js payAt)
    live: { smelter: { now: () => (crane.on ? crane.load() : null), card: () => (mission ? mission.payoutCard('smelter') : null) }, medical: { card: () => (mission ? mission.payoutCard('medical') : null), head: (o) => (mission ? mission.payoutHead(o) : null) } },
    // (and at the shipping computer the supply run: who has its contract, its load's state, its share waiting there:
    // src/mission.js; the contract itself is the Hauler's captain's, up on the main deck)
    hints: { smelter: () => (mission ? mission.hint('smelter') : null), medical: () => (mission ? mission.hint('medical') : null), cargo: () => (mission ? mission.deskHint('cargo') : null) }, crane, lib, people: () => people,
    // (and a Hauler that is the crew member's own there, where its own run is begun: src/mission.js)
    more: { cargo: () => (mission ? mission.deskMore('cargo') : null) },
    // (the shipping computer in Cargo: the supply run's five questions, src/jobs/cargolink.js; home from the run, its
    // share's pay slip first)
    links: { cargo: ({ crew, save: keep }) => (mission && mission.deskLive('cargo')) || cargoLink({ crew, save: keep, supply: GAME.supply, contract: !!(mission && mission.deskSigned('cargo')) }) } });
  // (the radio tower on the control tower's top, as the crew member playing has it, is solid to a ship flown by hand)
  outside.solids.push(() => (jobs.antenna ? jobs.antenna.solid(GAME.player) : null));
  // the station's own jobs board beside the captains', and the glowing line on the floor to the job (or the captain)
  // picked on either (jobsboard.js, guide.js)
  const guide = GAME.guide = makeGuide({ W, walls });
  // (a game of Mathball against anyone: src/mathball/challenge.js; the menu on a tapped person asks it)
  GAME.mathball = makeChallenges({ people: () => people, jobs, player: () => (player ? player.P : null) });
  const board = GAME.board = makeJobsBoard({ W, walls, input, jobs, guide, asking: () => !!(people && people.bubbles.asking), captains: () => (people ? people.captain : null) });
  // a captain's run: the contract, the pilot's seat, the trip, the share at the smelter (src/mission.js; the trip and
  // the contract's card are loaded only when one is wanted)
  const mission = GAME.mission = makeMission({ W, walls, input, boarding, crane, jobs, guide, outside, visit, people: () => people, crew: () => GAME.player, save: (p) => save.save(p),
    body: () => (player ? player.P : null), put: (pos, heading = 0) => { auto.way = null; player.P.place(pos, heading); player.P.zone = null; chase.snap(player.P.pos, heading); }, lib,
    // (the supply run: its cargo run in Cargo, src/supplyrun.js; the Hauler's bridge, src/dockwalk.js; is the crew member
    // down in Cargo just now)
    supply: () => GAME.supply, dock: dockWalk, inCargo: () => !!(player && player.P && GAME.lift && Math.abs(player.P.pos.y - STORE.floor) < 1 && GAME.lift.crewAt === 'store') });
  // the ship store's kiosk in the hallway, the one place a ship is bought (src/kiosk.js)
  const kiosk = GAME.kiosk = makeKiosk({ W, walls, input, mission, shipPaint, crane, crew: () => GAME.player, bridge: () => bridgeStands(GAME.player),
    quiet: () => !!(jobs.near || jobs.panel || board.near || board.isOpen || (people && people.bubbles.asking)) });
  // the lift by the junction: up to the control room at the top of the tower, down to Cargo (src/lift.js)
  const lift = GAME.lift = makeLift({ W, walls, outside, body: () => (player ? player.P : null), put: (pos, heading = 0) => { auto.way = null; player.P.place(pos, heading); player.P.zone = null; chase.snap(player.P.pos, heading); }, snap: (pos, heading) => chase.snap(pos, heading, true) });
  // the game's maker's forklift, parked in Cargo: fetched the first time the player steps into the lift; now and then
  // one of Cargo's people drives it, a pallet from the loading floor to the shelves (src/cargoforklift.js)
  // (and the player can drive it, parked: the supply run's pallets into the containers, src/cargodrive.js,
  // src/supplyrun.js; while a worked-out run waits for the player, Cargo's people leave it parked)
  let supply = null, lap = null;
  // (and Cargo's loader is called to it to load the rest of a run the player got off from: src/people.js send)
  const forklift = GAME.forklift = makeCargoForklift({ W, walls, hold: () => !!((supply && supply.hold()) || (lap && lap.hold())), open: () => (supply ? supply.open() : []),
    summon: (id) => { const O = people && people.list.find((q) => q.id === id); if (O) people.send(O, { do: 'drive:forklift', hurry: 1.4 }); }, dismiss: (O) => { if (people) people.send(O, null); } });
  supply = GAME.supply = makeSupplyRun({ crew: () => GAME.player, save: (p) => save.save(p), forklift, bridge: () => bridgeStands(GAME.player), people: () => people });
  const cargo = GAME.cargo = makeCargoDrive({ W, walls, input, forklift, run: supply, people: () => people });
  // (and a timed lap of Cargo on it: Cargo's loader says how fast they do one; the start box, the countdown, the four
  // waypoints, the clock: src/cargolap.js. Never while a supply run waits to be loaded)
  // (each crew member's best official lap kept with them; the best on this device on the board by the forklift's bay)
  lap = GAME.lap = makeCargoLap({ W, forklift, cargo, run: supply, people: () => people, crew: () => GAME.player, save: (p) => save.save(p), crews: () => save.load() });

  // ── the menu button while walking (a phone has no Escape key) ─────────────────────────────────────────────────
  const menu = document.createElement('button');
  menu.className = 'hud-menu'; menu.type = 'button'; menu.textContent = 'Crew'; menu.hidden = true;
  menu.setAttribute('aria-label', 'Back to the crew screen (Esc)');
  menu.addEventListener('click', toTitle);
  document.getElementById('hud-root').appendChild(menu);
  // (and beside it the sound's switch: the volume and a mute, kept in this browser)
  const soundSw = soundButton(document.getElementById('hud-root'), sound);
  // (a job shift that paid becomes the station's news: the people may talk about it, news.js 'player')
  const JOB_WORDS = { galley: 'galley', medical: 'medical centre', smelter: 'smelter', crane: 'crane cab', craneFree: 'crane cab', arena: 'Mathball arena', dock: 'dock', cargo: 'shipping desk', antenna: 'control room' };
  let shift = null, turnCam = null;
  const CAM_LIFT = 0.1;     // (radians: about 6 degrees more, while a line is followed)

  // ── the clock ─────────────────────────────────────────────────────────────────────────────────────────────────
  let now = 0;
  const eyes = [], shipEyes = [], _head = new THREE.Vector3();
  function tick(dt) {
    now += dt;
    const P = player && player.P;
    if (GAME.mode === 'title' || !P) drift(now);
    else {
      const atJob = jobs.update(dt, P, GAME.mode === 'play' && !cargo.on);   // (at a job: standing still, the camera on the job)
      const onTrip = mission.update(dt, P, GAME.mode === 'play' && !atJob);   // (on a captain's run: in the pilot's seat)
      board.update(dt, P, GAME.mode === 'play' && !atJob && !onTrip && !lift.here);      // (in the lift: its own panel, not the jobs board through its wall)
      guide.update(dt, GAME.mode === 'play' && !atJob && !onTrip ? P : null);
      if (atJob && guide.active) guide.clear();      // (at a job: there, the line done with)
      // (a job just picked on the board: the camera turned, over most of a second, to look along the way the line sets
      // off, so the line is in view and "forward" follows it)
      if (guide.turnTo != null) { turnCam = { to: guide.turnTo, t: 0 }; guide.turnTo = null; }
      if (turnCam) { turnCam.t += dt; const d = Math.atan2(Math.sin(turnCam.to - chase.yaw), Math.cos(turnCam.to - chase.yaw)); chase.yaw += d * Math.min(1, dt * 5); chase.idle = 0; if (turnCam.t > 0.9 || Math.abs(d) < 0.01) turnCam = null; }
      // (following a line: the camera a little higher, looking down a little more, so the line ahead shows over the
      // player's head rather than running up behind their back; eased off again as the line ends)
      chase.lift += ((guide.active ? CAM_LIFT : 0) - chase.lift) * Math.min(1, dt * 2);
      const ctl = atJob ? jobs.control(dt, P) : null;              // (a job that is a game walks the player itself: the arena's)
      const riding = lift.busy;      // (in the lift while it goes: held still)
      // (on Cargo's forklift: seated, the forklift driven by the keys and the stick: src/cargodrive.js)
      const driving = cargo.update(dt, P, GAME.mode === 'play' && !atJob && !onTrip && !riding, { inLift: !!lift.here });
      lap.update(dt, P, GAME.mode === 'play' && !atJob && !onTrip && !riding);
      kiosk.update(dt, P, GAME.mode === 'play' && !atJob && !onTrip && !riding && !driving && !lift.here);
      if (musicPlaces) musicPlaces.update(dt, P, GAME.mode === 'play' && !atJob && !onTrip && !riding && !driving && !lift.here);
      const move = ctl ? ctl.move : atJob || onTrip || riding || driving ? null : auto.way ? autoMove() : input.move;
      walkFree = GAME.mode === 'play' && !atJob && !onTrip && !riding && !driving && !lift.here && !cargo.on && !mission.seated && !visit.focus;
      // (aboard a ship on a run: its crew are people to walk round, and a seat aboard has its own clip: src/aboard.js)
      const aboardOthers = mission.others;
      P.update(dt, { move, run: ctl ? ctl.run : auto.way ? auto.run : input.run, yaw: ctl ? ctl.yaw : chase.yaw, others: ctl ? ctl.others : people ? (aboardOthers ? people.list.concat(aboardOthers) : people.list) : [], clip: ctl ? ctl.clip : driving ? cargo.clip : mission.clip, clipSpeed: ctl && ctl.clipSpeed, keepOff: offForklift });
      if (driving) cargo.seatBody(P);
      chase.update(dt, { feet: P.pos, heading: P.heading, speed: P.speed, look: input.takeLook(), zoom: input.takeZoom() });
      setFov(60);
      if (atJob) jobs.aim(W.camera, dt);
      if (driving) cargo.aim(W.camera, dt);
      lift.update(dt, P, GAME.mode === 'play' && !atJob && !onTrip && !driving);
      if (lift.busy || lift.viewing) lift.aim(W.camera);      // (the ride's own view, over the player's head at the shut doors)
      if (onTrip) mission.aim(W.camera, dt);
      // (how far the camera that is DRAWN is from the head: at a job that is the job's own camera, not the follow camera,
      // which still runs behind the player and may be pressed against a wall there: the player vanished for about a
      // second in the arena, standing near its wall with Mathball's camera metres away)
      const camNear = atJob || lift.busy || lift.viewing || driving ? W.camera.position.distanceTo(_head.set(P.pos.x, P.pos.y + chase.eye, P.pos.z)) : chase.near;
      P.c.root.visible = camNear > 0.4 && !(atJob && jobs.inEyes()) && !mission.seated;     // (closer than that, the camera would be inside the head; at a job, seen through their eyes)
      // (lit by the room they are in: a new room's light as they walk into it)
      if (GAME.frames % 10 === 0) { const z = W.zoneAt(P.pos); if (z && z !== P.zone) { P.zone = z; shine(P.c, W.envAt(P.pos)); } }
    }
    shipPaint.aim(W.camera);      // (a ship's paint being picked: the ship shown from outside, src/shippaint.js)
    if (GAME.cam) GAME.cam(W.camera, now, dt);      // (a rig's own camera, for films: GAME.cam = (camera, now, dt) => {...})
    // (the nearest people are counted from a ship flown about the station, while one is: src/visit.js)
    // (and the control room's and Cargo's people about only while the player is there: the lift says where, src/lift.js
    // crewAt; made the first time the player steps into the lift)
    if (people) people.update(dt, { player: GAME.mode === 'play' ? P : null, camera: W.camera, now, focus: visit.focus, place: GAME.mode === 'play' && P ? lift.crewAt : null, soon: GAME.mode === 'play' && !!lift.here });
    GAME.mathball.update(dt);   // (someone challenged to a game of Mathball: their walk to the arena, their wait)
    friendCard.update(dt, GAME.mode === 'play' && P && walkFree && people ? P : null);
    // (and Cargo's forklift, fetched at the same moment as Cargo's people are made; never put in on anyone's feet)
    forklift.update(GAME.mode === 'play' && !!lift.here, { camera: W.camera, dt, feet: () => [P && P.pos, ...(people ? people.list.filter((x) => x.home === 'store' && !x.hidden).map((x) => x.pos) : [])], wants: () => supply.wants(), player: GAME.mode === 'play' && P ? P.pos : null });
    // (the supply run: the doors, the pallets that load themselves, the Hauler loaded; in Cargo while the player stands
    // on its floor)
    supply.update(dt, { inCargo: GAME.mode === 'play' && !!P && Math.abs(P.pos.y - STORE.floor) < 1 && lift.crewAt === 'store', feet: [P && P.pos, ...(people ? people.list.filter((x) => x.home === 'store' && !x.hidden).map((x) => x.pos) : [])] });
    sound.ears(W.camera);
    if (GAME.player) {
      const busy = jobs.busy();
      if (busy && !shift) shift = { id: jobs.near, credits: credits(GAME.player) };
      else if (!busy && shift) { if (credits(GAME.player) > shift.credits) news.add({ kind: 'player', player: GAME.player.name, job: JOB_WORDS[shift.id] || 'galley' }); shift = null; }
    }
    eyes.length = 0; shipEyes.length = 0;
    if (GAME.mode === 'play' && P) { eyes.push(P.pos); shipEyes.push(P.pos); }
    if (people) { eyes.push(...people.eyes()); people.onWays(shipEyes); }
    // (a parked ship's ways in come down for the player, never for the station's people, who do not board yet; anyone
    // of them standing on a way's patch is counted, so it waits for them)
    dockWalk.update(dt);
    boarding.update(dt, { player: GAME.mode === 'play' ? P : null, eyes: shipEyes, camera: W.camera });
    crane.update(dt, { eyes, player: GAME.mode === 'play' && P ? P : null, people });
    mission.late();      // (out on a run: no haze between the cockpit and the rocks)
    visit.update(dt, W.camera);      // (a ship flown into another hangar: the alarm there, the parked ship where it has been shoved)
    announce.update(dt, GAME.mode === 'play' && !!P);
    // (the music: heard as the room the crew member is in, aboard a ship, or not at all off it out there; on the title,
    // as the camera's room)
    if (music) music.update(dt, () => (GAME.mode === 'play' && P ? { zone: (W.zoneAt(P.pos) || {}).id || null, ship: boarding.where(P.pos), ground: !!(mission.trip && mission.trip.ground) } : { zone: (W.zoneAt(W.camera.position) || {}).id || null }));
    outside.update(W.camera, dt);
    W.frame(dt, now, eyes);
    GAME.frames++;
  }
  let last = 0;
  if (!HOLD) W.renderer.setAnimationLoop((ms) => { const dt = last ? Math.min(0.05, (ms - last) / 1000) : 1 / 60; last = ms; tick(dt); });
  GAME.step = (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) tick(dt); };

  tick(1 / 60);
  canvas.classList.add('is-on');
  T.setProgress(1, 'Station ready');
  bar.done();
  GAME.loadBytes = bar.bytes();
  try { localStorage.setItem(LOAD_BYTES, String(GAME.loadBytes)); } catch (e) { /* blocked */ }
  GAME.ready = true;

  // the people come aboard after the station is ready (the player wakes in their quarters, behind a shut door)
  if (!q.has('nopeople')) {
    GAME.peopleReady = false;
    makePeople({ W, walls, lib, jobs, boarding, crane, crew: () => GAME.player, rides: { forklift: forklift.ride }, friends }).then((p) => { people = p; GAME.people = p; GAME.missing = p.missing; GAME.peopleReady = true; if (p.missing.length) console.info('people left out (the station has no such place): ' + p.missing.join(', ')); }).catch(fail);
  }

  // ── the start button: the chosen crew member, in their quarters ───────────────────────────────────────────────
  async function start(p) {
    GAME.player = p;
    clearTimeout(buildSoon);
    const key = p.id + ':' + JSON.stringify(p.look);
    if (!player || player.key !== key) {
      const P = await prebuild(p);
      if (player && player.P !== P) player.P.dispose();
      const s = resolve(W, walls, START) || resolve(W, walls, { room: 'quarters' });
      if (!s) throw new Error('The station has no spot to start in (its spawn, or a room called quarters).');
      P.place(s.pos, s.heading ?? 0);
      P.zone = W.zoneAt(P.pos); shine(P.c, W.envAt(P.pos));
      player = { key, id: p.id, P };
      // (the camera follows the head at this person's own height: their size, the title's Height row)
      chase.eye = CAM.eye * (P.c.size || 1);
      chase.snap(P.pos, P.heading);
    }
    GAME.mode = 'play';
    restStudio();      // (the character maker's drawing board is put away while the game is played)
    player.P.c.root.visible = true;
    input.enabled = true; menu.hidden = false; soundSw.show(true);
    T.hide();
  }
  function toTitle() {
    if (GAME.mode !== 'play') return;
    GAME.mode = 'title'; input.enabled = false; menu.hidden = true; soundSw.show(false); auto.way = null; mission.stop(); lift.stop(); cargo.stop(); lap.stop(); jobs.update(0, null, false); jobs.close();
    board.update(0, null, false); board.stop(); kiosk.update(0, null, false); if (musicPlaces) musicPlaces.update(0, null, false);
    if (people) { people.bubbles.clearAll(); if (people.bubbles.asking) people.bubbles.asking.close(); }
    T.show();
  }
  // back to the title (Escape)
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && GAME.mode === 'play' && !cargo.on) toTitle(); });

  // ── for the rigs: walk the player somewhere the way a player would (the stick pushed toward the next turn) ────
  // (the player's whole body off Cargo's forklift, as everyone's (src/people.js): never a step that ends with their middle
  // nearer its outline than 0.26 m, and nearer than it began; its forks lie too low for the walls to feel)
  function offForklift(x0, z0, x1, z1, y) {
    const O = Math.abs(y - STORE.floor) < 1 && forklift.ride.outline ? forklift.ride.outline() : null; if (!O) return false;
    for (const o of O) { const g = pointGap(o, x1, z1); if (g < 0.26 && g < pointGap(o, x0, z0) - 1e-9) return true; }
    return false;
  }
  const _w = new THREE.Vector3();
  function autoMove() {
    const P = player.P;
    // (held up a second, by someone in the way or pushed off the way round them: the way worked out again from here)
    auto.still = P.speed < 0.2 ? (auto.still || 0) + 1 : 0;
    // (and, held up against something beside the way (it walks a straight line at each next point of the way, so it
    // cuts a corner into whatever stands by it: in the Medic, a fitting on the bay's wall beside its door, 3 walks of 14
    // from the top of its ramps, rigs/rescue-8/door.cjs), a few steps to one side as it goes on, the other side the
    // next time: as a player caught on a corner steps round it)
    if (auto.still > 40 && auto.to) { auto.still = 0; auto.side = -(auto.side || -1); auto.sideT = 20; const w = walls.path(P.pos, auto.to); if (w) { auto.way = w; auto.i = 1; } }
    let goal = auto.way[auto.i];
    while (goal && Math.hypot(goal.x - P.pos.x, goal.z - P.pos.z) < 0.35) { auto.i++; goal = auto.way[auto.i]; }
    if (!goal) { auto.way = null; return { x: 0, y: 0, mag: 0 }; }
    _w.set(goal.x - P.pos.x, 0, goal.z - P.pos.z).normalize();
    if (auto.sideT > 0) { auto.sideT--; const sx = -_w.z * auto.side, sz = _w.x * auto.side; _w.x += sx * 0.9; _w.z += sz * 0.9; _w.normalize(); }
    const yaw = chase.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    return { y: _w.x * fx + _w.z * fz, x: _w.x * rx + _w.z * rz, mag: 1 };
  }
  GAME.walkTo = (spot, { run = false } = {}) => {
    // (a spot by name, or { at: [x, y, z] }: the nearest place to stand there)
    const s = spot.at ? { pos: walls.snap(spot.at[0], spot.at[1] + 0.15, spot.at[2], 1.5) } : resolve(W, walls, spot); if (!s || !s.pos || !player) return false;
    const way = walls.path(player.P.pos, s.pos); if (!way) return false;
    auto.way = way; auto.i = 1; auto.run = run; auto.to = s.pos; auto.still = 0; auto.sideT = 0; return way.length;
  };
  GAME.walking = () => !!auto.way;
  // (a rig looking at the player's own figure: the crew kit's character, as built from their look)
  GAME.body = () => (player ? player.P : null);
  // (a rig standing the player somewhere at once: { at: [x, y, z] } or a spot by name, facing `heading`)
  GAME.put = (spot, heading = 0) => {
    const s = spot.at ? { pos: walls.snap(spot.at[0], spot.at[1] + 0.15, spot.at[2], 1.5) } : resolve(W, walls, spot); if (!s || !s.pos || !player) return false;
    auto.way = null; player.P.place(s.pos, heading); player.P.zone = null; chase.snap(player.P.pos, heading); return true;
  };
  GAME.where = () => (player ? { x: +player.P.pos.x.toFixed(2), y: +player.P.pos.y.toFixed(2), z: +player.P.pos.z.toFixed(2), heading: +player.P.heading.toFixed(2), room: (W.zoneAt(player.P.pos) || {}).id || null, ship: boarding.where(player.P.pos), cam: chase.near, lift: lift.here } : null);
  // the cost test: n more people standing in a block in front of the camera (alone: the station's own people put away)
  GAME.crowd = async (n, { alone = false } = {}) => {
    if (!people) return 0;
    for (const P of people.list.filter((x) => x.id.startsWith('extra-'))) people.remove(P);
    for (const P of people.list) P.hidden = alone;
    const c = W.camera, f = new THREE.Vector3(); c.getWorldDirection(f); f.y = 0; f.normalize();
    const r = new THREE.Vector3(-f.z, 0, f.x), base = player ? player.P.pos : c.position;
    let made = 0;
    for (let i = 0; made < n && i < n * 6; i++) {
      const row = Math.floor(i / 5), col = (i % 5) - 2;
      const x = base.x + f.x * (3 + row * 1.2) + r.x * col * 1.0, z = base.z + f.z * (3 + row * 1.2) + r.z * col * 1.0;
      const s = walls.snap(x, base.y + 0.4, z, 0.7); if (!s) continue;
      await people.add('civilian', s, Math.atan2(-f.x, -f.z)); made++;
    }
    return made;
  };
}

// where a new arrival stands, as a view (when the station file names no view at all)
function fromSpawn(W) {
  const s = W.R.spawn || {};
  return { at: new THREE.Vector3(...(s.at || [0, 1.6, 0])), look: new THREE.Vector3(...(s.look || [0, 1.6, 1])), fov: 60 };
}

boot().catch(fail);
