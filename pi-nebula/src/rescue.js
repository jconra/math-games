// AT THE PLANET, ON A RESCUE RUN (src/missions.js 'rescue'; src/trip.js runs it as the run's far place, as the drill's
// view is the mining run's). Loaded only for a rescue, once the run is under way.
//
// THE GAME'S MAKER (2026-11-20): "For the medical and exploration missions I want to be able to visit the surface of
// some planets, so the destination can basically pop you out above the ground." His answers MED-1 to MED-3: you walk
// down the Medic's ramp to 3 to 6 stasis pods on the ground beside a crashed ship; the pilot sets the Medic down beside
// them, by hand or by autopilot. And (2026-11-22, RESC1-1 A): the rescued sit up, climb out, walk up the ramp
// themselves and take a bed or seat aboard.
//
// WHAT IS HERE, AND WHAT IS HALE'S CREW'S FOR NOW (the plan's piece 1: ~/pw/space-math/RESCUE_PLAN.md). Everything at
// the planet that is not made yet is done by her own crew while the crew member watches, or skips it (the mining run's
// crew does the same for the jobs nobody signed for):
//   - THE PLANET: made from the run's seed (kept with the contract), as the Planet Lab makes it, from the very same
//     files (src/planet/: the ground, its sky, its sun, its rocks, plants and trees; one of our ships broken beside the
//     landing ring in another crew's colours; 3 to 6 stasis pods on the ground beside it, someone asleep in each). It is
//     made while the jump is worked out and the wormhole's colours are round the ship, put in the scene unseen, and
//     shown as the colours are all round (the wormhole's far end opens on it when it is made: no dark screen).
//   - THE MEDIC THERE is the Medic itself: its own hull and cabin, the very rooms walked in the hangar, drawn where it
//     is by the one matrix (as it is drawn when it is flown about the station: its keeper's fly, boarding's fly). The
//     game's own flying is kept, with the ship drawn there (src/flying.js `body`, as at the rocks): the seat's view and
//     the view from behind (V), the dashboard, its controls put away.
//   - OUT OF THE WORMHOLE somewhere above the planet (ARRIVE: off from the landing place on the side away from the wreck,
//     high over the ground), its nose toward the wreck.
//   - SET DOWN BESIDE THE WRECK BY HER PILOT (or, with the pilot's seat theirs, the autopilot: flying over the planet and
//     setting down by hand are still to come): flown over to the landing place, a hover over its middle, down onto the
//     level ground, its nose toward the wreck.
//   - THE PODS OPENED BY HER MEDIC, one after another, and whoever was asleep in each brought aboard (they sit up,
//     climb out and walk up the ramp themselves: still to come; until then it is done out of sight: a pod's lid swings
//     open, and a moment later its sleeper is aboard). Sleepers are drawn only within 25 m of the eye (src/planet/
//     podsdraw.js), and the pods lie past the landing ring, so from the seat or from behind the ship none is seen to go.
//   - THEN UP: lifted clear of the ground, holding there for the jump home.
//   - THE SKIP (K, the trip's button): all of it at once: down beside the wreck, every pod open, everyone aboard, and up.
//   - NOTHING IS PAID FOR ANY OF IT: the rescue pays so much for each person brought home (src/missions.js RESCUE).
//
//   const site = makeSite(ctx, opts)   ctx: { W, boarding, keeper (the ship's hull keeper: src/mission.js keeperOf),
//       ship (boarding's record of it), cfg (src/fleet.js flightOf), lib (the crew kit, for the sleepers), startFlying }
//     opts: { seed, pilot (the crew member has the pilot's seat), flier (who flies), settings, onSettings, words, dash, run }
//   site.ready / site.failed          made (unseen), or it could not be
//   site.open(view)                   as the wormhole's colours are all round: the planet shown, the ship above it
//   site.go()                         her crew sets the Medic down, opens the pods, brings everyone aboard, lifts it
//   site.skip()                       all of that at once; site.canSkip
//   site.update(dt), site.aim(camera, dt), site.late()   each frame
//   site.phase    'made' | 'above' | 'fly' | 'hover' | 'down' | 'pods' | 'lift' | 'up'
//   site.count    { aboard, of }      the rescued aboard, of all asleep in the pods
//   site.who      [{ look, position }] who each of them is, in the order they came aboard (the look they slept in, their
//                 crew position's colour: the pods' plan), for the ward at home (src/people.js THE WARD)
//   site.matrix   the ship's kit frame in the world;  site.fl  the flying;  site.down  on the ground (the pods' part)
//   site.words    what is going on, for the strip along the top;  site.state();  site.close()
import * as THREE from 'three';
import { makePlanet, makeLandAsync } from './planet/planet.js';
import { clearUnder, wreckFor } from './planet/wreck.js';
import { makeWreck } from './planet/wreckship.js';
import { podsPlan, footprintTris } from './planet/pods.js';
import { makePods } from './planet/podsdraw.js';
import { SLEEPERS } from './sleeper.js';
import { loadPod } from '../kit/stasispod.js';
import { facing } from './flymodel.js';

// THE NUMBERS (m, s):
//   arrive   the wormhole's far end: how far from the landing place's middle (back the way from the wreck), how high
//            over it, and at least how high over the ground under it
//   cruise   how fast her pilot flies over to the landing place; clear: how high it keeps over the ground on the way;
//            over: how high over the landing place it slows to a hover; hover: how long it hovers there
//   down     how long it takes to come down onto the ground
//   pod      from one pod opened to the next; climb: from a lid opened to its sleeper aboard; rest: after the last is
//            aboard, before it lifts
//   up, lift how high it lifts, and how long it takes
//   far      the camera's far plane out there (the cloud sky is 9,000 m round)
export const SITE = { arrive: { out: 420, up: 140, clear: 90 }, cruise: 34, clear: 24, over: 26, hover: 1.6, down: 7, pod: 5.5, climb: 3, rest: 2, up: 52, lift: 7, far: 12000 };
// the ship's kit frame (x to port, y up, z to its nose) in the flight model's own [ahead, up, right]
const KIT = new THREE.Matrix4().makeRotationY(Math.PI / 2);
const ease = (k) => { const t = Math.max(0, Math.min(1, k)); return t * t * (3 - 2 * t); };
const smoother = (k) => { const t = Math.max(0, Math.min(1, k)); return t * t * t * (t * (t * 6 - 15) + 10); };

export function makeSite(ctx, opts = {}) {
  const { W, boarding, keeper, ship: S, cfg: shipCfg, lib = null, startFlying } = ctx;
  const seed = Math.max(1, Math.floor(+opts.seed || 1));
  // (the ship as the flying flies it out there: its own facts with nothing of its hangar, as the rocks' FIELD has the Miner's)
  const cfg = { ...shipCfg, pad: [0, 0, 0], bay: null, floor: null, others: null, field: true }; delete cfg.q0;
  const group = new THREE.Group(); group.name = 'rescue:planet'; group.visible = false; W.scene.add(group);
  const st = { phase: 'made', t: 0, ready: false, failed: false, closed: false, aboard: 0, of: 0, opened: 0, words: '', times: {}, who: [] };
  let planet = null, wreck = null, pods = null, land = null, fl = null, L = null;
  const at = { p: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), from: new THREE.Vector3(), hover: new THREE.Vector3(), ground: new THREE.Vector3(), up: new THREE.Vector3(), flyT: 1, lifted: 0 };
  const ground = (x, z) => (land ? land.heightAt(x, z) : 0);

  // ── MADE, unseen: the ground (in a worker), the wreck and the pods' places, the planet drawn, the wreck and the pods
  // on it, then someone asleep in each pod (the Planet Lab's own order) ──
  (async () => {
    const t0 = performance.now();
    land = await makeLandAsync(seed);
    if (st.closed) return;
    const pick = wreckFor(seed), podFile = loadPod().catch((e) => { console.error('rescue: the stasis pod did not come', e); return null; });
    const Wk = await makeWreck({ land, ship: pick.ship, pieces: pick.pieces });
    const all = Wk.world.map((w) => w.tris), n = all.reduce((s, a) => s + a.length, 0), tris = new Float32Array(n); let o = 0; for (const a of all) { tris.set(a, o); o += a.length; }
    const plan = podsPlan(land, seed, { site: Wk.site, tris });
    clearUnder(land, footprintTris(plan));
    if (st.closed) return;
    planet = await makePlanet({ renderer: W.renderer, scene: group, land, quality: W.quality });
    if (st.closed) { planet.dispose(); return; }
    wreck = Wk.draw({ scene: group, ground: planet.ground, sky: planet.dome, sunDir: planet.sunDir, paint: pick.paint });
    if (await podFile && !st.closed) pods = await makePods({ plan, scene: group, ground: planet.ground, sky: planet.dome, sunDir: planet.sunDir, paint: wreck.paintId });
    if (st.closed) return;
    st.of = pods ? pods.pods.length : 0;
    L = land.landing; plot();
    st.times.made = Math.round(performance.now() - t0);
    st.ready = true;
    // (someone asleep in each pod, one after another: the crew kit is the game's own)
    if (pods && lib) pods.fill(lib).catch((e) => console.error('rescue: the sleepers did not come', e));
  })().catch((e) => { console.error(e); if (window.oops) window.oops(e); st.failed = true; });

  // THE WAY THERE: out of the wormhole off from the landing place, on the side away from the wreck, high over the
  // ground; over to a hover above the landing place's middle; down onto it, the nose toward the wreck; then up
  function plot() {
    const wx = (wreck && wreck.site ? wreck.site.x : L.x + 40) - L.x, wz = (wreck && wreck.site ? wreck.site.z : L.z) - L.z, wl = Math.hypot(wx, wz) || 1;
    at.dir.set(wx / wl, 0, wz / wl);
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
  const _D = new THREE.Matrix4(), _i = new THREE.Matrix4(), _acc = new THREE.Vector3(), _v = new THREE.Vector3();
  function drawShip(M, dt = 0) {
    _D.multiplyMatrices(M, _i.copy(S.M0).invert());
    // (on the ground: its engine idling; in the air: held up and pushed along)
    const onGround = st.phase === 'pods';
    keeper.fly(_D, dt, { acc: _acc, spin: 0, hold: onGround ? 0 : 0.6, engine: onGround ? 0.15 : 0.45, heat: 1, x: 0, z: 0, height: null });
    boarding.fly(S.id, _D);
  }
  // WHAT IT BUMPS INTO OUT HERE, as the flying asks (the view from behind is kept clear of the ground: clear(a, b), how
  // much of the way from a to b is over the ground). Nobody flies it by hand here yet, so nothing else.
  const solid = {
    reach: 3, dist: () => 99, away: (x, y, z, out) => { out[0] = out[1] = out[2] = 0; return out; }, push: () => false,
    clear: (a, b, r = 0.6) => { for (let i = 1; i <= 16; i++) { const k = i / 16, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k, z = a[2] + (b[2] - a[2]) * k; if (y < ground(x, z) + r + 0.8) return (i - 1) / 16; } return 1; },
  };
  const qNow = () => facing([at.dir.x, 0, at.dir.z]);
  const put = () => { if (fl) fl.put([at.p.x, at.p.y, at.p.z], qNow()); };

  // ── AS THE COLOURS ARE ALL ROUND: the planet shown, the station's own sky and light put away, the ship above it ──
  const kept = { sky: null, fill: null, exposure: null };
  function open(view = 'cockpit') {
    if (!st.ready || fl || st.closed) return false;
    kept.sky = W.sky && W.sky.object ? W.sky.object.visible : null; if (W.sky && W.sky.object) W.sky.object.visible = false;
    kept.fill = W.fill ? W.fill.visible : null; if (W.fill) W.fill.visible = false;
    kept.exposure = W.renderer.toneMappingExposure; W.renderer.toneMappingExposure = planet.exposure;
    group.visible = true;
    fl = startFlying({ W, boarding: null, crane: null }, {
      cfg, goal: 'field', pilot: !!opts.pilot, flier: opts.flier || 'The pilot', view, settings: opts.settings || null, onSettings: opts.onSettings || null,
      words: () => {}, ...(opts.dash ? { dash: opts.dash, run: opts.run } : {}),
      body: { at: new THREE.Matrix4(), M0: KIT, p: at.p.toArray(), f: at.dir.toArray(), fly: (M, dt) => drawShip(M, dt), solid },
    });
    fl.lock(true);
    st.phase = 'above'; st.t = 0; put();
    planet.update(W.camera, 0); planet.relayNow(W.camera);
    return true;
  }
  const WORDS = { fly: (w) => `${w.flier} flies to the wreck`, hover: (w) => `${w.flier} sets the Medic down`, down: (w) => `${w.flier} sets the Medic down`, pods: (w) => `${w.medic} opens the stasis pods`, lift: (w) => `${w.flier} takes us up`, up: () => '' };
  const who = { flier: String(opts.flier || 'The pilot'), medic: String(opts.medic || 'The medic') };
  function setPhase(p) { st.phase = p; st.t = 0; st.words = WORDS[p] ? WORDS[p](who) : ''; }
  // (each pod as her medic opens it: its lid on its way open, and a moment later its sleeper aboard)
  function openPod(i) { if (pods && pods.pods[i]) pods.openOne(i, 1); st.opened = Math.max(st.opened, i + 1); }
  function aboardPod(i) {
    const p = pods && pods.pods[i]; if (!p) return;
    if (p.sleeper) { p.sleeper.dispose(); p.sleeper = null; }
    // (who they are, for the ward at home: the look they slept in and their position's colour, the pods' own plan)
    if (!st.who[i]) st.who[i] = { look: SLEEPERS[((p.plan && p.plan.look) || 0) % SLEEPERS.length], position: (p.plan && p.plan.position) || null };
    st.aboard = Math.max(st.aboard, i + 1);
  }

  const api = {
    get ready() { return st.ready; }, get failed() { return st.failed; }, get phase() { return st.phase; }, get words() { return st.words; },
    get count() { return { aboard: st.aboard, of: st.of }; }, get who() { return st.who.filter(Boolean).map((w) => ({ ...w })); }, get fl() { return fl; }, get down() { return st.phase === 'pods'; },
    get matrix() { return fl ? fl.matrix : S.M; }, get canSkip() { return !!fl && ['fly', 'hover', 'down', 'pods'].includes(st.phase); },
    open,
    go() { if (st.phase === 'above') setPhase('fly'); },
    // ALL AT ONCE: down beside the wreck, every pod open, everyone aboard; then the lift plays
    skip() {
      if (!api.canSkip) return false;
      at.p.copy(at.ground);
      for (let i = 0; i < st.of; i++) { openPod(i); aboardPod(i); }
      setPhase('lift'); put();
      return true;
    },
    update(dt) {
      if (!fl || st.closed) return;
      st.t += dt;
      if (st.phase === 'fly') {
        const k = smoother(st.t / at.flyT);
        at.p.lerpVectors(at.from, at.hover, k);
        // (kept over the ground on the way)
        at.p.y = Math.max(at.p.y, ground(at.p.x, at.p.z) + SITE.clear * (1 - ease((k - 0.85) / 0.15)));
        if (k >= 1) setPhase('hover');
      } else if (st.phase === 'hover') {
        at.p.copy(at.hover); at.p.y += Math.sin(st.t * 2.2) * 0.08;
        if (st.t >= SITE.hover) setPhase('down');
      } else if (st.phase === 'down') {
        const k = ease(st.t / SITE.down);
        at.p.lerpVectors(at.hover, at.ground, k);
        if (k >= 1) { at.p.copy(at.ground); setPhase('pods'); }
      } else if (st.phase === 'pods') {
        // (one pod after another; each sleeper aboard a moment after its lid opens; up once the last is aboard)
        const n = st.of, i = Math.floor(st.t / SITE.pod);
        if (i < n && i >= st.opened) openPod(i);
        for (let j = st.aboard; j < st.opened; j++) if (st.t >= j * SITE.pod + SITE.climb) aboardPod(j);
        if (st.aboard >= n && st.t >= (n - 1) * SITE.pod + SITE.climb + SITE.rest) setPhase('lift');
      } else if (st.phase === 'lift') {
        const k = ease(st.t / SITE.lift);
        at.p.lerpVectors(at.ground, at.up, k);
        if (k >= 1) { at.p.copy(at.up); setPhase('up'); }
      } else if (st.phase === 'up' || st.phase === 'above') {
        // (holding where it is: a slow bob)
        const base = st.phase === 'up' ? at.up : at.from; at.p.copy(base); at.p.y += Math.sin(st.t * 1.6) * 0.12;
      }
      put();
    },
    aim(camera, dt) {
      if (!fl || st.closed) return;
      fl.aim(camera, dt);
      if (camera.far !== SITE.far) { camera.far = SITE.far; camera.updateProjectionMatrix(); }
    },
    // just before the picture (after the trip's own camera, on foot aboard too): the planet laid out round the eye
    late(dt = 1 / 60) {
      if (!fl || st.closed) return;
      const c = W.camera; if (c.far !== SITE.far) { c.far = SITE.far; c.updateProjectionMatrix(); }
      planet.update(c, dt); if (pods) pods.update(c, dt);
    },
    state: () => ({ phase: st.phase, t: +st.t.toFixed(2), ready: st.ready, failed: st.failed, seed, kind: land ? land.kind.id : null, wreck: wreck ? wreck.ship : null, pods: st.of, opened: st.opened, aboard: st.aboard,
      p: at.p.toArray().map((v) => +v.toFixed(2)), up: land ? +(at.p.y - ground(at.p.x, at.p.z)).toFixed(2) : null, landing: L ? [L.x, L.y, L.z].map((v) => +v.toFixed(1)) : null, view: fl ? fl.view : null, times: st.times, words: st.words }),
    close() {
      if (st.closed) return; st.closed = true;
      if (fl) { fl.close(); fl = null; }
      keeper.fly(null); boarding.fly(S.id, null);
      if (kept.sky != null && W.sky && W.sky.object) W.sky.object.visible = kept.sky;
      if (kept.fill != null && W.fill) W.fill.visible = kept.fill;
      if (kept.exposure != null) W.renderer.toneMappingExposure = kept.exposure;
      if (pods) pods.dispose(); if (wreck) wreck.dispose(); if (planet) planet.dispose();
      group.removeFromParent(); pods = wreck = planet = null;
    },
  };
  return api;
}
