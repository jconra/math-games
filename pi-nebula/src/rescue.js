// AT THE PLANET, ON A RESCUE RUN (src/missions.js 'rescue'; src/trip.js runs it as the run's far place, as the drill's
// view is the mining run's). Loaded only for a rescue, once the run is under way.
//
// THE GAME'S MAKER (2026-11-20): "For the medical and exploration missions I want to be able to visit the surface of
// some planets, so the destination can basically pop you out above the ground." His answers MED-1 to MED-3: you walk
// down the Medic's ramp to 3 to 6 stasis pods on the ground beside a crashed ship; the pilot sets the Medic down beside
// them, by hand or by autopilot. RESC1-1 A: the rescued sit up, climb out, walk up the ramp themselves and take a bed or
// seat aboard. And (2026-11-22, RESC3-1): "I think all the missions should have basically 3 jobs you can select on the
// contract. ... I think all the missions should have pilot and engineer. The medical one can be the paramedic. The pilot
// knows where to go, so once they jump, then the crash site is right in front of them and it's the pilots job to go to
// it (a question there is good and appropriate). For the paramedic the questions are to open the pods." RESC4-1 B: after
// the patient beds, the crew room's bunk and its bed, then (his words) "They should be able to sit on the bench in the
// lab area too", then the stools.
//
// SO, THE RUN'S PLANET PART, each piece the Planet Lab's own, shared (src/planet/):
//   - THE PLANET: made from the run's seed (kept with the contract), as the Planet Lab makes it, from the very same
//     files (the ground, its sky, its sun, its rocks, plants and trees; one of our ships broken beside the landing ring in
//     another crew's colours; 3 to 6 stasis pods on the ground beside it, someone asleep in each). It is made while the
//     jump is worked out and the wormhole's colours are round the ship, put in the scene unseen, and shown as the colours
//     are all round (the wormhole's far end opens on it when it is made: no dark screen). Then, still unseen, the ground
//     to walk on: the Medic set down (src/planet/medicdown.js: its own hull and cabin, the very builds), where a person
//     can walk (src/planet/onfoot.js: the ground, the wreck, the pods, the rocks, the Medic), the crew member's own figure
//     for out there (their own look), and the rescued (src/rescued.js).
//   - THE MEDIC IN THE AIR is the Medic itself: its own hull and cabin, the very rooms walked in the hangar, drawn where
//     it is by the one matrix (as it is drawn when it is flown about the station: its keeper's fly, boarding's fly). The
//     game's own flying is kept, with the ship drawn there (src/flying.js `body`, as at the rocks): the seat's view and
//     the view from behind (V), the dashboard.
//   - SIGNED AS THE PILOT (RESC3-1: "once they jump, then the crash site is right in front of them and it's the pilots
//     job to go to it (a question there is good and appropriate)"): out of the wormhole over the planet, the sensors'
//     card (src/jobs/sensors.js, src/planet/search.js: dealt as the colours are all round, so the ship is already where
//     the card says when the far end opens; up once the run gets there). Answered, the way to the wreck lights up (the
//     beam into the sky, the arrow, the radar, the blue ship beside the wreck: src/planet/guide.js) and the Medic is the
//     pilot's: flown down by hand onto the level ground beside the wreck, or by the autopilot (T) onto the blue ship
//     (src/flying.js over a planet: src/planet/landing.js planetPad, groundSolid, planDown). Down, the seat's prompt:
//     "Pilot's seat · Down beside the wreck", Get up. Card put away unanswered: the way stays dark and the sensors can be
//     asked again (findAgain).
//   - NOT THE PILOT: her pilot flies over to the landing ring and sets the Medic down (as before), turned side on to the
//     pods as the autopilot sets it down; the beam rises as her pilot finds the wreck (the arrow and the radar are the
//     pilot's own sight, not shown).
//   - DOWN: the Medic drawn from there by its own build set down (medicdown.js), put exactly where it came down and
//     whichever way round, its ramp on the pods' side coming down. Anyone on foot aboard walks its rooms, down the ramp
//     and out on the ground (src/trip.js: on foot out here, the game's own walking on the planet's walls).
//   - SIGNED AS THE PARAMEDIC ("For the paramedic the questions are to open the pods"): down the ramp to the pods; a pod
//     looked at (or tapped) offers its lock (src/podreach.js), Mathwood's lock box in this game's look (src/podlock.js);
//     solved, its lid opens. NOT THE PARAMEDIC: her paramedic opens them, one after another, once the ramp is down.
//   - THE RESCUED, as each lid opens (src/rescued.js): they wake, get out, walk to the Medic and up its ramp by
//     themselves, and take a place in the game's maker's order (the patient beds, the crew room's bunk and bed, the
//     lab's bench, then the stools). Seen if the crew member is outside (on foot, or the view from behind); off screen
//     if not: either way they walk.
//   - EVERYONE ABOARD (the crew member too, back up the ramp: asked if they are still outside): the ramp comes up and it
//     lifts clear of the ground for the jump home (as before), the Medic set down still the one drawn (the station's
//     Medic, drawn out here, has nothing in its ramps' openings), carried with the ship, and the rescued where they lie
//     or sit in it (the same one matrix), until the jump home's colours.
//   - THE SKIP (K, the trip's button), of what is not theirs: not the pilot, her pilot's flying down (down at once);
//     not the paramedic, the pods (every lid open, everyone in their place at once); neither, both at once.
//   - NOTHING IS PAID FOR ANY OF IT: the rescue pays so much for each person brought home (src/missions.js RESCUE).
//
//   const site = makeSite(ctx, opts)   ctx: { W, boarding, keeper (the ship's hull keeper: src/mission.js keeperOf),
//       ship (boarding's record of it), cfg (src/fleet.js flightOf), lib (the crew kit, for the sleepers and the crew
//       member's figure), startFlying }
//     opts: { seed, pilot (the crew member has the pilot's seat), medic (the paramedic's job is theirs), flier (who flies),
//       medicName, crew, save (the crew member and saving them: their levels for the sensors' card and the locks),
//       recipe (the crew member's own look, src/looks.js recipeOf), settings, onSettings, dash, run, onLock(up) (a pod's
//       lock up or put away), busy(id) (a place the crew aboard are in), crewAt() (the crew aboard: where they stand, in
//       the world, [{ x, y, z, walking }]), walking() (the crew member is on foot out here), outside() (and outside the
//       cabin), eyes() (people on foot in the rooms as the ship is parked, where they are there: the cabin's doors open
//       for them) }
//   site.ready / site.failed          made (unseen), or it could not be
//   site.open(view)                   as the wormhole's colours are all round: the planet shown, the ship above it
//   site.go()                         the rescue begins: the sensors' card (the pilot), or her pilot flies down
//   site.skip(), site.canSkip, site.skipWords    the trip's skip button
//   site.findAgain()                  the sensors' card again (put away unanswered); site.sensors { up, found }
//   site.update(dt), site.aim(camera, dt), site.late()   each frame
//   site.walk(dt, { move, run, look, zoom, others })      on foot out here: the crew member walks (the trip's input)
//   site.putFoot(pos, heading), site.foot (the figure on foot: src/player.js), site.footIn (inside the cabin)
//   site.toPlanet(v), site.toStation(v)   a point where the ship is parked in its hangar, and where it is now
//   site.phase    'made' | 'above' | 'find' | 'fly' | 'hover' | 'down' | 'pods' | 'wait' | 'board' | 'lift' | 'up'
//   site.ground   the Medic stands on the ground, its rooms and the ground walkable (the trip's on foot out here)
//   site.count    { aboard, of }      the rescued in their places, of all asleep in the pods
//   site.who      [{ look, position }] who each of them is, in the order they took their places (the look they slept
//                 in, their crew position's colour: the pods' plan), for the ward at home (src/people.js THE WARD)
//   site.matrix   the ship's kit frame in the world;  site.fl  the flying;  site.down  on the ground
//   site.atControls   the crew member at the controls (the card up, flying by hand, or down with the seat's own prompt)
//   site.lock     a pod's lock, while it is up;  site.order  the places the rescued take
//   site.words    what is going on, for the strip along the top;  site.state();  site.close()
import * as THREE from 'three';
import { makePlanet, makeLandAsync } from './planet/planet.js';
import { clearUnder, wreckFor } from './planet/wreck.js';
import { makeWreck } from './planet/wreckship.js';
import { podsPlan, footprintTris } from './planet/pods.js';
import { makePods } from './planet/podsdraw.js';
import { SLEEPERS } from './sleeper.js';
import { loadPod } from '../kit/stasispod.js';
import { facing, gearOverGround } from './flymodel.js';
import { planetPad, groundSolid, planDown, padNose } from './planet/landing.js';
import { makeSearch } from './planet/search.js';
import { makeMedicDown } from './planet/medicdown.js';
import { makeOnFoot, ONFOOT } from './planet/onfoot.js';
import { makePeopleShadows } from './planet/groundshadow.js';
import { makeRescued } from './rescued.js';
import { medicStand } from './rescueplan.js';
import { makePodReach } from './podreach.js';

// THE NUMBERS (m, s):
//   arrive   the wormhole's far end, her pilot flying: how far from the landing place's middle (back the way from the
//            wreck), how high over it, and at least how high over the ground under it
//   cruise   how fast her pilot flies over to the landing place; clear: how high it keeps over the ground on the way;
//            over: how high over the landing place it slows to a hover; hover: how long it hovers there (turning side on
//            to the pods meanwhile, as the autopilot sets it down)
//   down     how long it takes to come down onto the ground
//   pod      from one pod opened by her paramedic to the next, once the ramp is down; ramp: how far down the ramp is
//            to be walked (src/rescueplan.js MEDIC.wayOpen)
//   up, lift how high it lifts, and how long it takes
//   far      the camera's far plane out there (the cloud sky is 9,000 m round)
export const SITE = { arrive: { out: 420, up: 140, clear: 90 }, cruise: 34, clear: 24, over: 26, hover: 2.4, down: 7, pod: 5.5, ramp: 0.97, up: 52, lift: 7, far: 12000 };
// the ship's kit frame (x to port, y up, z to its nose) in the flight model's own [ahead, up, right]
const KIT = new THREE.Matrix4().makeRotationY(Math.PI / 2);
const ease = (k) => { const t = Math.max(0, Math.min(1, k)); return t * t * (3 - 2 * t); };
const smoother = (k) => { const t = Math.max(0, Math.min(1, k)); return t * t * t * (t * (t * 6 - 15) + 10); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const GROUND_PHASES = ['pods', 'wait', 'board'];

export function makeSite(ctx, opts = {}) {
  const { W, boarding, keeper, ship: S, cfg: shipCfg, lib = null, startFlying } = ctx;
  const seed = Math.max(1, Math.floor(+opts.seed || 1)), iPilot = !!opts.pilot, iMedic = !!opts.medic;
  const group = new THREE.Group(); group.name = 'rescue:planet'; group.visible = false; W.scene.add(group);
  // (the rescued, carried: their figures are posed where the Medic stands on the ground, and drawn by the one matrix from
  // there to where the ship is now (identity while it stands there), late)
  const carrier = new THREE.Group(); carrier.name = 'rescue:the rescued'; carrier.matrixAutoUpdate = false; group.add(carrier);
  const st = { phase: 'made', t: 0, ready: false, failed: false, closed: false, of: 0, opened: 0, words: '', times: {}, groundReady: false, groundFailed: false, swapped: false, ground: false, all: false, skipAll: false, podT: 0, said: {}, came: [] };
  let planet = null, wreck = null, pods = null, land = null, fl = null, L = null, podPlan = null, podsMid = null;
  let medic = null, F = null, rescued = null, shades = null, search = null, reach = null, lock = null, lockMod = null, cfg = null;
  const at = { p: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), from: new THREE.Vector3(), hover: new THREE.Vector3(), ground: new THREE.Vector3(), up: new THREE.Vector3(), flyT: 1, dir0: new THREE.Vector3(), pad: new THREE.Vector3(1, 0, 0) };
  const ground = (x, z) => (land ? land.heightAt(x, z) : 0);
  const who = { flier: String(opts.flier || 'The pilot'), medic: String(opts.medicName || 'The paramedic') };
  const fail = (e) => { console.error(e); if (window.oops) window.oops(e); };

  // ── MADE, unseen: the ground (in a worker), the wreck and the pods' places, the planet drawn, the wreck and the pods
  // on it, then someone asleep in each pod (the Planet Lab's own order); then the ground to walk on ──
  (async () => {
    const t0 = performance.now();
    land = await makeLandAsync(seed);
    if (st.closed) return;
    const pick = wreckFor(seed), podFile = loadPod().catch((e) => { console.error('rescue: the stasis pod did not come', e); return null; });
    const Wk = await makeWreck({ land, ship: pick.ship, pieces: pick.pieces });
    const all = Wk.world.map((w) => w.tris), n = all.reduce((s, a) => s + a.length, 0), tris = new Float32Array(n); let o = 0; for (const a of all) { tris.set(a, o); o += a.length; }
    podPlan = podsPlan(land, seed, { site: Wk.site, tris });
    clearUnder(land, footprintTris(podPlan));
    if (st.closed) return;
    planet = await makePlanet({ renderer: W.renderer, scene: group, land, quality: W.quality });
    if (st.closed) { planet.dispose(); return; }
    wreck = Wk.draw({ scene: group, ground: planet.ground, sky: planet.dome, sunDir: planet.sunDir, paint: pick.paint });
    if (await podFile && !st.closed) pods = await makePods({ plan: podPlan, scene: group, ground: planet.ground, sky: planet.dome, sunDir: planet.sunDir, paint: wreck.paintId });
    if (st.closed) return;
    st.of = pods ? pods.pods.length : 0;
    L = land.landing; podsMid = podPlan.pods.length ? [podPlan.pods.reduce((a, p) => a + p.x, 0) / podPlan.pods.length, podPlan.pods.reduce((a, p) => a + p.z, 0) / podPlan.pods.length] : null;
    plot();
    // (the way to the wreck: the sensors' card and what it lights; for a rider, her pilot's: the beam alone)
    search = makeSearch({ scene: group, ground: planet.ground, land, wreck: wreck.site, pods: podsMid, cfg: iPilot ? shipCfg : null, root: iPilot ? document.body : riderRoot(), crew: opts.crew ? { crew: opts.crew, save: () => opts.save && opts.save() } : null,
      bounds: () => ({ left: 0, top: innerWidth <= 640 ? 104 : 60, right: innerWidth, bottom: innerHeight }),
      place: (p, look) => { at.p.set(p[0], p[1], p[2]); at.dir.set(look[0] - p[0], 0, look[2] - p[2]).normalize(); put(); } });
    st.times.made = Math.round(performance.now() - t0);
    st.ready = true;
    // (someone asleep in each pod, one after another: the crew kit is the game's own; then the ground to walk on)
    const filled = pods && lib ? pods.fill(lib).catch((e) => console.error('rescue: the sleepers did not come', e)) : Promise.resolve();
    await filled;
    if (!st.closed && pods) await makeGround();
  })().catch((e) => { fail(e); st.failed = true; });
  // (for a rider the arrow and the radar are drawn nowhere: her pilot's own sight)
  let rider = null;
  function riderRoot() { rider = document.createElement('div'); rider.hidden = true; rider.style.display = 'none'; document.body.appendChild(rider); return rider; }

  // THE GROUND TO WALK ON, made ahead and unseen: the Medic set down (its own build; put where it really comes down later),
  // where a person can walk out here, the crew member's own figure for it, and the rescued
  async function makeGround() {
    const t0 = performance.now();
    try {
      medic = await makeMedicDown({ scene: group, renderer: W.renderer, camera: W.camera, ground: planet.ground, sky: planet.dome, sunDir: planet.sunDir, stand: medicStand(L, podPlan.pods), quality: W.quality });
      if (st.closed) { medic.dispose(); medic = null; return; }
      medic.group.visible = false;
      const near0 = W.camera.near;
      F = await makeOnFoot({ planet, scene: group, camera: W.camera, lib, recipe: opts.recipe, wreck, pods, medic });
      W.camera.near = near0; W.camera.updateProjectionMatrix();
      if (st.closed) { F.dispose(); F = null; return; }
      F.player.c.root.visible = false;
      // (the people's shadows on the ground out here, as the wreck's and the pods': src/planet/groundshadow.js)
      shades = makePeopleShadows({ scene: group, ground: planet.ground, sunDir: planet.sunDir, air: !!planet.dome });
      rescued = makeRescued({ pods, medic, walls: F.walls, scene: carrier, busy: (id) => !!(opts.busy && opts.busy(id)), crew: () => (opts.crewAt ? opts.crewAt() : []) });
      st.times.ground = Math.round(performance.now() - t0);
      st.groundReady = true;
    } catch (e) { console.error('rescue: the ground to walk on could not be made', e); st.groundFailed = true; }
  }

  // THE WAY THERE, HER PILOT FLYING: out of the wormhole off from the landing place, on the side away from the wreck, high
  // over the ground; over to a hover above the landing place's middle, turning there side on to the pods as the autopilot
  // sets it down; down onto it; then up
  function plot() {
    const wx = (wreck && wreck.site ? wreck.site.x : L.x + 40) - L.x, wz = (wreck && wreck.site ? wreck.site.z : L.z) - L.z, wl = Math.hypot(wx, wz) || 1;
    at.dir.set(wx / wl, 0, wz / wl); at.dir0.copy(at.dir);
    const n = padNose(land, podsMid); at.pad.set(n[0], 0, n[1]);
    const A = SITE.arrive, ax = L.x - at.dir.x * A.out, az = L.z - at.dir.z * A.out;
    at.from.set(ax, Math.max(L.y + A.up, ground(ax, az) + A.clear), az);
    at.hover.set(L.x, L.y + SITE.over, L.z);
    at.ground.set(L.x, ground(L.x, L.z), L.z);
    at.up.set(L.x, at.ground.y + SITE.up, L.z);
    at.flyT = at.from.distanceTo(at.hover) / SITE.cruise * 1.5 + 2;
    at.p.copy(at.from);
  }

  // ── THE SHIP DRAWN WHERE IT IS: its hull by its keeper and its cabin by boarding, the one matrix from where it is
  // parked to where it is now (M: its kit frame out here) ──
  const _D = new THREE.Matrix4(), _i = new THREE.Matrix4(), _acc = new THREE.Vector3(), _v = new THREE.Vector3(), _X = new THREE.Matrix4(), _q = new THREE.Quaternion(), eye = { position: new THREE.Vector3() };
  function drawShip(M, dt = 0) {
    _D.multiplyMatrices(M, _i.copy(S.M0).invert());
    // (on the ground: its engine idling; in the air: held up and pushed along)
    const onGround = GROUND_PHASES.includes(st.phase);
    keeper.fly(_D, dt, { acc: _acc, spin: 0, hold: onGround ? 0 : 0.6, engine: onGround ? 0.15 : 0.45, heat: 1, x: 0, z: 0, height: null });
    boarding.fly(S.id, _D);
    // ITS LANDING GEAR over the planet (src/flymodel.js GEAR): down near the ground, up above it (how high its feet are:
    // its kit frame's own ground line over the ground under it); on the ground, down
    if (keeper.gear) {
      const h = M.elements[13] - ground(M.elements[12], M.elements[14]);
      gearUp = !onGround && gearOverGround(h, gearUp);
      keeper.gear(gearUp, dt);
    }
  }
  let gearUp = false;
  // WHAT IT BUMPS INTO OUT HERE, her pilot flying (the view from behind is kept clear of the ground: clear(a, b), how
  // much of the way from a to b is over the ground). The pilot's own flying: the ground itself (landing.js groundSolid)
  const solid = {
    reach: 3, dist: () => 99, away: (x, y, z, out) => { out[0] = out[1] = out[2] = 0; return out; }, push: () => false,
    clear: (a, b, r = 0.6) => { for (let i = 1; i <= 16; i++) { const k = i / 16, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k, z = a[2] + (b[2] - a[2]) * k; if (y < ground(x, z) + r + 0.8) return (i - 1) / 16; } return 1; },
  };
  const qNow = () => facing([at.dir.x, 0, at.dir.z]);
  const put = () => { if (fl) fl.put([at.p.x, at.p.y, at.p.z], qNow()); };

  // ── AS THE COLOURS ARE ALL ROUND: the planet shown, the station's own sky and light put away, the ship above it (the
  // pilot's: where the sensors' first card says, dealt now) ──
  const kept = { sky: null, fill: null, exposure: null, alone: null };
  function open(view = 'cockpit') {
    if (!st.ready || fl || st.closed) return false;
    kept.sky = W.sky && W.sky.object ? W.sky.object.visible : null; if (W.sky && W.sky.object) W.sky.object.visible = false;
    kept.fill = W.fill ? W.fill.visible : null; if (W.fill) W.fill.visible = false;
    kept.exposure = W.renderer.toneMappingExposure; W.renderer.toneMappingExposure = planet.exposure;
    group.visible = true;
    // (the pilot's flying over the planet: its pad the level ground beside the wreck, the ground what it bumps into, the
    // autopilot's way down; her pilot's: the ship held where she flies it)
    cfg = iPilot ? planetPad(shipCfg, land, { toward: podsMid }) : (() => { const c = { ...shipCfg, pad: [0, 0, 0], bay: null, floor: null, others: null, field: true }; delete c.q0; return c; })();
    fl = startFlying({ W, boarding: null, crane: null }, {
      cfg, goal: iPilot ? 'land' : 'field', pilot: iPilot, flier: opts.flier || 'The pilot', view, settings: opts.settings || null, onSettings: opts.onSettings || null,
      words: () => {}, ...(opts.dash ? { dash: opts.dash, run: opts.run } : {}),
      ...(iPilot ? { onLanded: () => { if (st.phase === 'fly') touchdown(); } } : {}),
      body: { at: new THREE.Matrix4(), M0: KIT, p: at.p.toArray(), f: at.dir.toArray(), fly: (M, dt) => drawShip(M, dt), gearDown: () => !keeper.gear || keeper.gearDown, solid: iPilot ? groundSolid(land, cfg) : solid, ...(iPilot ? { plan: (s) => planDown(s, land), far: SITE.far } : {}) },
    });
    fl.lock(true);
    st.phase = 'above'; st.t = 0;
    // (the pilot: the sensors' first card dealt now, unseen, and the ship put where it says)
    if (iPilot && search) search.deal({ ahead: [at.dir.x, at.dir.z] }); else put();
    planet.update(W.camera, 0); planet.relayNow(W.camera);
    return true;
  }
  const WORDS = {
    find: () => 'Find the wreck with the sensors',
    fly: (w) => (iPilot ? (fl && fl.auto ? 'The autopilot sets the Medic down beside the wreck' : 'Set the Medic down beside the wreck, on the blue ship') : `${w.flier} flies to the wreck`),
    hover: (w) => `${w.flier} sets the Medic down`, down: (w) => `${w.flier} sets the Medic down`,
    pods: (w) => (st.all ? 'Everyone is aboard' : st.opened >= st.of ? 'Every pod open: the rescued come aboard' : iMedic ? (st.opened ? `${st.opened} of ${st.of} pods open: open each lock` : 'Down the ramp to the stasis pods: open each lock') : `${w.medic} opens the stasis pods`),
    wait: () => 'Everyone is aboard: back up the ramp', board: () => 'The ramp comes up',
    lift: (w) => `${iPilot ? 'The autopilot' : w.flier} takes us up`, up: () => '',
  };
  function setPhase(p) { st.phase = p; st.t = 0; }
  // (each pod as her paramedic opens it: its lid on its way open; the sleeper wakes as it opens: src/rescued.js)
  function openPod(i) { if (pods && pods.pods[i] && (pods.pods[i].want ?? pods.want) !== 1) { pods.openOne(i, 1); st.opened++; } }

  // DOWN BESIDE THE WRECK: where it came down, and which way round (the pilot's, wherever and however; her pilot's, on the
  // landing place side on to the pods); the Medic drawn from now on by its own build set down there, once that is made
  const _n = new THREE.Vector3(), _x = new THREE.Vector3();
  function touchdown() {
    const M = fl ? fl.matrix : null;
    if (M) { at.ground.setFromMatrixPosition(M); _n.setFromMatrixColumn(M, 2); _n.y = 0; if (_n.lengthSq() > 1e-6) at.dir.copy(_n.normalize()); }
    at.p.copy(at.ground); at.up.copy(at.ground); at.up.y += SITE.up;
    // (its ramp's side: the one toward the pods' middle; port is the kit's +x)
    _x.set(at.dir.z, 0, -at.dir.x);
    const side = podsMid && (podsMid[0] - at.ground.x) * _x.x + (podsMid[1] - at.ground.z) * _x.z < 0 ? 'starboard' : 'port';
    st.stand = { x: at.ground.x, y: at.ground.y, z: at.ground.z, yaw: Math.atan2(at.dir.x, at.dir.z), side };
    if (search) search.dispose(), search = null;
    // (down: the flying put away until it lifts off again (it holds where it came down); the seat's prompt is the trip's)
    if (fl) fl.lock(true);
    setPhase('pods');
  }
  // THE SWAP: the Medic in the air (the station's, its hull a room of it, its cabin boarding's) put away; the Medic set
  // down drawn in its very place, its ramp up, then coming down; its rooms and the ground walkable (`ground`)
  function swap() {
    medic.place(st.stand, { down: false }); medic.group.visible = true;
    if (!st.skipAll) medic.ramp(1);
    kept.alone = W.alone; W.alone = []; boarding.hold(S.id, true);
    st.swapped = true; st.ground = true;
    if (!reach && iMedic) makeReach();
  }
  // AND UP, the ramp up: no longer to be walked out from (`ground`, the walls); still the Medic drawn, carried with the
  // ship as it lifts, its ramp shut, until the jump home (the station's Medic drawn out here has nothing in its ramps'
  // openings), and the rescued carried with it
  function unswap() {
    st.swapped = false; st.drawn = true;
    if (reach) { reach.dispose(); reach = null; }
  }

  // ── EACH POD'S LOCK, the paramedic's (src/podreach.js, src/podlock.js): looked at from where they stand on foot, or
  // tapped; solved, its lid opens ──
  function makeReach() {
    reach = makePodReach({ camera: W.camera, canvas: W.renderer.domElement, onPick: (p) => openLock(p.i),
      pods: () => (pods ? pods.pods.map((p, i) => ({ group: p.group, name: `Stasis pod ${i + 1}`, open: (p.want ?? pods.want) === 1, i })) : []) });
    const head = new THREE.Vector3(); reach.eye = () => head.copy(F.player.pos).setY(F.player.pos.y + 1.6);
    reach.busy(true);
    // (a mouse: over the pod whose lock is offered, the hand (src/usable.js); the click on a pod is the reach's own)
    if (ctx.usable) { const R = reach, off = ctx.usable.add({ name: 'pod lock', ready: () => !!R.now, shape: () => (R.now ? R.now.group : null) }), was = R.dispose; R.dispose = () => { off(); was(); }; }
  }
  // (A POD WITH TWO LOCKS, on a run of the crew member's own in a Medic they bought: opts.locksFor(i), how many pod i has
  // (src/missions.js rockCards: two on the first pod, one on the second, two on the third ...). Each is one of the lock
  // box's equations at their level; the first solved, its button reads "Next lock" and the second comes up at once;
  // the pod opens with its last. Put away between the two, the first stays solved)
  const locksOn = (i) => Math.max(1, Math.floor(opts.locksFor ? opts.locksFor(i) : 1) || 1), locksDone = {};
  async function openLock(i) {
    if (lock || !pods || !pods.pods[i] || st.closed) return null;
    lock = 'loading'; if (reach) reach.busy(true); if (opts.onLock) opts.onLock(true);
    try { lockMod = lockMod || await import('./podlock.js'); } catch (e) { fail(e); lock = null; if (opts.onLock) opts.onLock(false); return null; }
    if (st.closed) { lock = null; return null; }
    const save = () => { if (opts.save) opts.save(); };
    // (debug: under the game's own rig switches, the lock box shows its workings to the rigs, as in the labs)
    const need = locksOn(i), got = Math.min(need - 1, locksDone[i] || 0), last = got + 1 >= need; let solved = false;
    lock = lockMod.openPodLock(document.body, { rider: opts.crew || null, saveRider: save, debug: /[?&](rig|hold)(&|=|$)/.test(location.search),
      finish: last ? null : 'Next lock',
      pod: { name: `Stasis pod ${i + 1}`, where: `${i + 1} of ${st.of} beside the wreck · ${need > 1 ? `lock ${got + 1} of ${need}` : 'its lock'}` },
      onOpen: () => { solved = true; locksDone[i] = got + 1; if (last) openPod(i); save(); },
      onClose: () => { lock = null; save(); if (opts.onLock) opts.onLock(false); if (solved && !last && !st.closed) openLock(i); } });
    return lock;
  }

  // WHERE A POINT OF THE SHIP AS IT IS PARKED IS NOW, and back: the one matrix (the ship's frame where it is now, over its
  // frame where it stands in its hangar), the Medic set down's own frame while it stands here
  const frameNow = () => (st.swapped && medic ? medic.M : fl ? fl.matrix : S.M);
  const toPlanet = (v) => v.applyMatrix4(_X.multiplyMatrices(frameNow(), _i.copy(S.M).invert()));
  const toStation = (v) => v.applyMatrix4(_X.multiplyMatrices(S.M, _i.copy(frameNow()).invert()));

  const api = {
    get ready() { return st.ready; }, get failed() { return st.failed; }, get phase() { return st.phase; }, get words() { return st.words; },
    get count() { return { aboard: st.fallback ? st.of : rescued ? Math.min(st.of, rescued.placed) : 0, of: st.of }; },
    // (who they are, for the ward at home: the look each slept in and their position's colour, the pods' own plan; in the
    // order they took their places, and with no ground to walk on, the pods' order)
    get who() {
      const of = (i) => { const p = pods && pods.pods[i], plan = (p && p.plan) || (podPlan && podPlan.pods[i]) || {}; return { look: SLEEPERS[(plan.look || 0) % SLEEPERS.length], position: plan.position || null }; };
      return (st.fallback ? Array.from({ length: st.of }, (_, i) => i) : st.came).map(of);
    }, get fl() { return fl; }, get down() { return GROUND_PHASES.includes(st.phase); },
    get ground() { return st.ground && !!F; }, get foot() { return F ? F.player : null; }, get footIn() { return !!(F && medic && medic.inside(F.player.pos)); },
    // (for the rigs: on foot out here, the pods and where they lie, a pod's lock opened as a tap opens it)
    get onfoot() { return F; }, get pods() { return pods; }, get plan() { return podPlan; }, lockPod: (i) => openLock(i),
    get matrix() { return frameNow(); }, get lock() { return lock; }, get locks() { return { done: { ...locksDone }, need: pods ? pods.pods.map((_, i) => locksOn(i)) : [] }; }, get lockOffered() { return !!(reach && reach.now); }, get order() { return medic ? medic.order : []; }, get medic() { return medic; },
    get sensors() { return { up: !!(search && search.panel), found: !!(search && search.found) }; },
    // (the crew member at the controls: the card up, flying by hand, down in the seat with its own prompt)
    get atControls() { if (!iPilot || !fl) return false; if (st.phase === 'find') return true; if (st.phase === 'fly') return !fl.auto; return false; },
    // (what the skip button skips, for this crew member: not theirs, her pilot's flying down and her paramedic's pods)
    get skipWords() {
      if (!fl || st.closed) return null;
      const flying = ['fly', 'hover', 'down'].includes(st.phase) && !iPilot, podsTheirs = st.phase === 'pods' && !iMedic && !st.all;
      return flying && !iMedic ? 'Skip the rescue' : flying ? 'Skip the flying' : podsTheirs ? 'Skip the rescue' : null;
    },
    get canSkip() { return !!api.skipWords; },
    open, toPlanet, toStation,
    go() {
      if (st.phase !== 'above') return;
      if (iPilot && search) { setPhase('find'); search.start({ ahead: [at.dir.x, at.dir.z] }); }
      else { setPhase('fly'); if (search) search.light(true); }
    },
    findAgain() { if (st.phase === 'find' && search && !search.panel && !search.found) search.start({ ahead: [at.dir.x, at.dir.z] }); },
    // WHAT IS NOT THEIRS, AT ONCE: her pilot's flying down (down on the landing place, side on to the pods); her
    // paramedic's pods (every lid open, everyone in their place)
    skip() {
      if (!api.canSkip) return false;
      if (['fly', 'hover', 'down'].includes(st.phase)) { at.dir.copy(at.pad); at.p.copy(at.ground); put(); touchdown(); }
      // (everyone in their place once the Medic set down stands where it came down: the 'pods' part, below)
      if (!iMedic) { st.skipAll = true; for (let i = 0; i < st.of; i++) openPod(i); }
      return true;
    },
    update(dt) {
      if (!fl || st.closed) return;
      st.t += dt;
      // (the rescued posed where the Medic stood on the ground, as ever; drawn where the ship is now, late)
      carrier.matrix.identity(); carrier.updateMatrixWorld(true);
      const P = st.phase;
      if (P === 'find') {
        // (the card answered and gone: the Medic is the pilot's to fly down)
        if (search && search.found && !search.panel) { setPhase('fly'); fl.lock(false); }
        else put();
      } else if (P === 'fly' && iPilot) {
        // (the pilot's own flying, by hand or the autopilot: the flight model steps; down, onLanded: touchdown)
        fl.update(dt);
        if (st.phase === 'fly') at.p.fromArray(fl.S.p);
      } else if (P === 'fly') {
        const k = smoother(st.t / at.flyT);
        at.p.lerpVectors(at.from, at.hover, k);
        // (kept over the ground on the way)
        at.p.y = Math.max(at.p.y, ground(at.p.x, at.p.z) + SITE.clear * (1 - ease((k - 0.85) / 0.15)));
        if (k >= 1) setPhase('hover');
        put();
      } else if (P === 'hover') {
        // (turned side on to the pods as it hovers: its ramps' side toward them)
        at.p.copy(at.hover); at.p.y += Math.sin(st.t * 2.2) * 0.08;
        const k = ease(st.t / SITE.hover), a0 = Math.atan2(at.dir0.x, at.dir0.z), a1 = a0 + wrap(Math.atan2(at.pad.x, at.pad.z) - a0) * k;
        at.dir.set(Math.sin(a1), 0, Math.cos(a1));
        if (st.t >= SITE.hover) setPhase('down');
        put();
      } else if (P === 'down') {
        const k = ease(st.t / SITE.down);
        at.p.lerpVectors(at.hover, at.ground, k);
        // (down: put where it comes down, then that is where it stands)
        if (k >= 1) at.p.copy(at.ground);
        put();
        if (k >= 1) touchdown();
      } else if (P === 'pods' || P === 'wait' || P === 'board') {
        // ON THE GROUND: the Medic set down drawn in its place as soon as it is made; the ramp comes down; the pods
        // opened (the paramedic's locks, or hers one after another once the ramp is down); the rescued come aboard
        if (!st.swapped && st.groundReady && P !== 'board') swap();
        if (st.groundFailed && !st.swapped) { if (!st.fallback) { st.fallback = true; console.error('rescue: no ground to walk on: her crew brings everyone aboard'); } for (let i = 0; i < st.of; i++) openPod(i); st.all = true; }
        if (st.swapped && rescued && st.skipAll) rescued.settle();
        const rampDown = medic && medic.rampT >= SITE.ramp;
        // (HER PARAMEDIC, the pods not the crew member's: one of the crew aboard walks down the ramp to them and opens each
        // in turn, then back aboard: src/rescued.js paramedic, the figure lent by the trip. Nobody to walk (no crew aboard
        // made): the pods open one after another by themselves, SITE.pod apart, as before)
        if (P === 'pods' && st.swapped && !iMedic && rampDown && !st.skipAll) {
          if (st.para === undefined) { const fig = rescued && opts.paramedic ? opts.paramedic() : null; st.para = (fig && rescued.paramedic(fig, { open: openPod })) || null; st.paraC = st.para && fig.c ? fig.c : null; }
          if (!st.para) { st.podT += dt; const i = Math.floor(st.podT / SITE.pod); if (i < st.of && st.opened <= i) openPod(st.opened); }
        }
        if (P === 'pods' && st.swapped && rescued && rescued.placed >= st.of && st.opened >= st.of && (!st.para || st.para.done)) st.all = true;
        if (P === 'pods' && st.all) setPhase(opts.outside && opts.outside() ? 'wait' : 'board');
        if (P === 'wait' && !(opts.outside && opts.outside())) setPhase('board');
        if (P === 'board') {
          // (on foot out here no longer: the trip has them in the rooms where the ship is parked, as in the air)
          st.ground = false;
          if (medic && st.swapped) medic.ramp(0);
          if (!st.swapped || !medic || medic.rampT <= 0.001) {
            if (st.swapped) unswap();
            setPhase('lift');
          }
        }
        if (reach) { const walking = !!(opts.walking && opts.walking()) && P === 'pods' && !lock; reach.busy(!walking); if (walking) reach.update(); }
        put();
      } else if (P === 'lift') {
        const k = ease(st.t / SITE.lift);
        at.p.lerpVectors(at.ground, at.up, k);
        if (k >= 1) { at.p.copy(at.up); setPhase('up'); }
        put();
      } else if (P === 'up' || P === 'above') {
        // (holding where it is: a slow bob)
        const base = P === 'up' ? at.up : at.from; if (P === 'up' || !iPilot) { at.p.copy(base); at.p.y += Math.sin(st.t * 1.6) * 0.12; }
        put();
      }
      st.words = WORDS[st.phase] ? WORDS[st.phase](who) : '';
      // (the order they take their places in: the ward's at home)
      if (rescued && rescued.placed > st.came.length) for (const R of rescued.list) if (['lying', 'perched', 'sit', 'standing'].includes(R.phase) && !st.came.includes(R.i)) st.came.push(R.i);
      // (the rescued: their moves, round the crew member on foot out here)
      if (rescued && (st.swapped || rescued.list.length)) {
        // (near or far as the eye is from them: the eye where it is now, brought back to where the Medic stood)
        if (!st.swapped && medic) eye.position.copy(W.camera.position).applyMatrix4(_i.multiplyMatrices(frameNow(), medic.inv).invert()); else eye.position.copy(W.camera.position);
        rescued.update(dt, { player: opts.walking && opts.walking() && F ? F.player : null, camera: eye });
      }
    },
    // ON FOOT OUT HERE (the trip, its input): the crew member's own figure walked on the planet's walls, the camera behind
    walk(dt, { move = null, run = false, look = null, zoom = 0, others = [] } = {}) {
      if (!F || st.closed) return;
      F.update(dt, { move: lock ? null : move, run, look, zoom, others: rescued ? rescued.others.concat(others) : others });
      const c = W.camera; if (c.near !== ONFOOT.nearPlane || c.far !== SITE.far) { c.near = ONFOOT.nearPlane; c.far = SITE.far; c.updateProjectionMatrix(); }
    },
    putFoot(pos, heading = 0) { if (!F) return false; F.put(pos, heading); F.player.c.root.visible = true; return true; },
    hideFoot() { if (F) F.player.c.root.visible = false; },
    aim(camera, dt) {
      if (!fl || st.closed) return;
      fl.aim(camera, dt);
      if (camera.far !== SITE.far) { camera.far = SITE.far; camera.updateProjectionMatrix(); }
    },
    // just before the picture (after the trip's own camera, on foot aboard too): the planet laid out round the eye, the
    // Medic set down and its doors, the rescued drawn where the ship is
    late(dt = 1 / 60) {
      if (!fl || st.closed) return;
      const c = W.camera; if (c.far !== SITE.far) { c.far = SITE.far; c.updateProjectionMatrix(); }
      planet.update(c, dt); if (pods) pods.update(c, dt);
      if (search) { _v.set(1, 0, 0).applyQuaternion(_q.fromArray(fl.S.q)); search.update(c, dt, { ahead: [_v.x, _v.z] }); }
      if (medic && (st.swapped || st.drawn)) {
        // (its cabin's doors open for whoever is nearest each: on foot out here, the rescued, and anyone on foot in the
        // rooms as the ship is parked (where the Medic set down has them))
        _X.multiplyMatrices(medic.M, _i.copy(S.M).invert());
        const eyes = [...(opts.walking && opts.walking() && F ? [F.player.pos] : []), ...(rescued ? rescued.eyes() : []), ...(opts.eyes ? opts.eyes().map((v) => v.clone().applyMatrix4(_X)) : [])];
        medic.update(dt, c, eyes);
        // (lifted: drawn where the ship is now)
        if (st.drawn) { medic.group.matrix.copy(frameNow()); medic.group.matrixWorldNeedsUpdate = true; }
      }
      // (the rescued drawn where the ship is now: the one matrix from where the Medic stood on the ground)
      if (medic && !st.swapped && rescued && rescued.list.length) { carrier.matrix.multiplyMatrices(frameNow(), medic.inv); } else carrier.matrix.identity();
      carrier.matrixWorldNeedsUpdate = true;
      // (whoever is out on the ground casts a shadow there: the crew member, the rescued, her paramedic; inside the
      // Medic its hull's shadow is theirs)
      if (shades) shades.sync(st.swapped ? [F ? F.player.c : null, ...(pods ? pods.pods.map((p) => p.sleeper && p.sleeper.c) : []), st.para && !st.para.done ? st.paraC : null] : [], medic ? medic.inside : null);
    },
    // THE FLIGHT HOME: the rescued kept as they are, where they settled (src/rescued.js ride: theirs from here on, drawn
    // where the ship is by whoever takes them: src/trip.js); the planet and the Medic set down are put away without them
    ride(scene) { if (!rescued || st.rode || !rescued.list.length) return null; st.rode = true; const R = rescued.ride({ scene, order: st.came }); rescued = null; return R; },
    state: () => ({ phase: st.phase, t: +st.t.toFixed(2), ready: st.ready, failed: st.failed, seed, kind: land ? land.kind.id : null, wreck: wreck ? wreck.ship : null, pods: st.of, opened: st.opened, aboard: api.count.aboard,
      p: at.p.toArray().map((v) => +v.toFixed(2)), up: land ? +(at.p.y - ground(at.p.x, at.p.z)).toFixed(2) : null, landing: L ? [L.x, L.y, L.z].map((v) => +v.toFixed(1)) : null, view: fl ? fl.view : null, times: st.times, words: st.words,
      groundReady: st.groundReady, swapped: st.swapped, ground: api.ground, ramp: medic ? +medic.rampT.toFixed(2) : null, stand: st.stand ? { ...st.stand, x: +st.stand.x.toFixed(2), z: +st.stand.z.toFixed(2), yaw: +st.stand.yaw.toFixed(3) } : null,
      sensors: search ? search.state() : null, lock: !!lock, offered: reach && reach.now ? reach.now.name : null, rescued: rescued ? rescued.state() : null, skip: api.skipWords }),
    close() {
      if (st.closed) return; st.closed = true;
      if (lock && lock.close) { try { lock.close(); } catch (e) { /* gone */ } } lock = null;
      if (reach) { reach.dispose(); reach = null; }
      if (search) { search.dispose(); search = null; }
      if (rider) rider.remove();
      if (st.swapped || st.drawn) { W.alone = kept.alone; boarding.hold(S.id, false); st.swapped = st.drawn = false; }
      if (fl) { fl.close(); fl = null; }
      keeper.fly(null); boarding.fly(S.id, null);
      if (kept.sky != null && W.sky && W.sky.object) W.sky.object.visible = kept.sky;
      if (kept.fill != null && W.fill) W.fill.visible = kept.fill;
      if (kept.exposure != null) W.renderer.toneMappingExposure = kept.exposure;
      if (shades) { shades.dispose(); shades = null; }
      if (rescued) rescued.dispose(); if (F) F.dispose(); if (medic) medic.dispose();
      if (pods) pods.dispose(); if (wreck) wreck.dispose(); if (planet) planet.dispose();
      group.removeFromParent(); pods = wreck = planet = medic = F = rescued = null;
    },
  };
  return api;
}
