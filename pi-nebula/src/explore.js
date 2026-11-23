// A PLACE ON CAPTAIN VEGA'S EXPLORING RUN (src/missions.js 'explore'; what each run is about: src/exploreplan.js; src/trip.js
// runs it, one place for each jump out, as the planet is the rescue run's far place). Loaded only for an exploring run.
//
// THE GAME'S MAKER (2026-11-22, EXPL1-1): "I expect that finding something on the ground will be different from finding
// a valuable asteroid field in space. But it should all be the process of following a weak signal, a hunch, or looking
// in some yet unexplored area"; (RESC1-3, of the rescue's way to the wreck) "a big beam marking the target area, like a
// green column that goes into space"; (STA2-3 A) at the other station the Explorer flies round it and looks.
//
// EACH PLACE IS MADE WHILE THE JUMP TO IT IS WORKED OUT, unseen, and shown as the wormhole's colours are all round (no
// dark screen), as the rescue's planet is, from the same shared pieces:
//   - ABOVE LAND (a moon, a canyon world, a meadow world): the Planet Lab's own planet from the place's seed
//     (src/planet/planet.js: its ground, its sky, its sun, its rocks, plants and trees). The ship comes out high over
//     it, off from its level ground, nose toward it; the sensor operator's scan is of the land below.
//     At the last place, what was found there: A CRASHED SHIP with its crew asleep in their stasis pods (the rescue
//     run's own wreck and pods: src/planet/wreckship.js, podsdraw.js), or A THING NOBODY WE KNOW MADE, standing on the
//     level ground (makeArtifact below); its scan done, THE BEAM rises on it with the arrow over the view (the
//     rescue's way to the wreck: src/planet/guide.js) and the crew's pilot flies over toward it. A NEW WORLD is the
//     land itself.
//   - OUT IN SPACE (the game's own sky, as at the rocks): A RICH ASTEROID FIELD (rocks with their ore glowing, the
//     metals' own glow colours: src/jobs/smelter.js ORE), flown over to once scanned; or THE OTHER STATION, the old one
//     in distress (kit/oldstation.js, as the Other Station Lab builds it), which the crew's pilot flies round
//     (kit/oldstation-plan.js ROUND) while its people talk by radio.
//   - THE SHIP is the Explorer itself, flown there by the shared flying and drawn as itself (src/farship.js).
//
//   const P = makePlace(ctx, opts)   ctx: { W, boarding, keeper, ship, cfg, lib, startFlying }
//     opts: { place (src/exploreplan.js: a leg's place), leg, pilot, flier, settings, onSettings, dash, run }
//   P.ready / P.failed;  P.open(view)  as the colours are all round;  P.reveal()  the scan done: the finding lit
//   P.go()  the crew's pilot flies over to the finding (or round the station);  P.held  there, holding
//   P.skip() / P.canSkip;  P.update(dt), P.aim(camera, dt), P.late(dt);  P.fl, P.matrix, P.down (never), P.words
//   P.phase  'made' | 'above' | 'fly' | 'round' | 'held';  P.state();  P.close()
import * as THREE from 'three';
import { makePlanet, makeLandAsync } from './planet/planet.js';
import { clearUnder, wreckFor } from './planet/wreck.js';
import { makeWreck } from './planet/wreckship.js';
import { podsPlan, footprintTris } from './planet/pods.js';
import { makePods, onPlanet } from './planet/podsdraw.js';
import { loadPod } from '../kit/stasispod.js';
import { guideColour } from './planet/guideplan.js';
import { makeWreckGuide } from './planet/guide.js';
import { rng, subSeed } from './planet/noise.js';
import { ORE } from './jobs/smelter.js';
import { makeFarShip } from './farship.js';

// THE NUMBERS (m, s):
//   arrive   out of the wormhole: how far from what it comes to look at, how high over it, at least how high over the
//            ground under it (in space: how far from the field's middle)
//   cruise   how fast the crew's pilot flies over to the finding; stand: how far short of it it stops, and how high
//            over it; clear: how high it keeps over the ground on the way
//   far      the camera's far plane out there (the cloud sky is 9,000 m round)
export const PLACE = { arrive: { out: 430, up: 140, clear: 90, space: 720 }, cruise: 34, stand: { land: 150, up: 55, space: 400 }, clear: 26, far: 12000 };
// the field: how many rocks, how far round its middle they lie (flattened up and down), the biggest and the smallest;
// the spots of ore on each (more on a bigger rock), how big each is across the rock, and at most (m)
export const FIELD = { rocks: 46, r: 260, flat: 0.45, big: 34, small: 4, dots: [4, 14], dot: [0.035, 0.07], most: 1.6 };
const ease = (k) => { const t = Math.max(0, Math.min(1, k)); return t * t * (3 - 2 * t); };
const smoother = (k) => { const t = Math.max(0, Math.min(1, k)); return t * t * t * (t * (t * 6 - 15) + 10); };

export function makePlace(ctx, opts = {}) {
  const { W, lib = null } = ctx, place = opts.place || { where: 'land', kind: 'moon', seed: 1 }, seed = Math.max(1, Math.floor(+place.seed || 1));
  const LAND = place.where !== 'space';
  const group = new THREE.Group(); group.name = 'explore:place'; group.visible = false; W.scene.add(group);
  const st = { phase: 'made', t: 0, ready: false, failed: false, closed: false, lit: false, words: '', times: {}, lap: 0 };
  let planet = null, land = null, wreck = null, pods = null, guide = null, art = null, field = null, station = null;
  const at = { p: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), from: new THREE.Vector3(), to: new THREE.Vector3(), target: new THREE.Vector3(), flyT: 1, a0: 0 };
  const ground = (x, z) => (land ? land.heightAt(x, z) : -1e9);
  const ship = makeFarShip(ctx, { pilot: opts.pilot, flier: opts.flier, settings: opts.settings, onSettings: opts.onSettings, dash: opts.dash, run: opts.run, ground: LAND ? ground : null });
  const R = rng(subSeed(seed, 'explore place'));

  // ── MADE, unseen ──
  (async () => {
    const t0 = performance.now();
    if (LAND) {
      land = await makeLandAsync(seed, place.kind || null);
      if (st.closed) return;
      let Wk = null, plan = null, pick = null, podFile = null;
      if (place.show === 'wreck') {
        // (the rescue run's own crashed ship and stasis pods: the same pieces in the same order as src/rescue.js)
        pick = wreckFor(seed); podFile = loadPod().catch((e) => { console.error('explore: the stasis pod did not come', e); return null; });
        Wk = await makeWreck({ land, ship: pick.ship, pieces: pick.pieces });
        const all = Wk.world.map((w) => w.tris), n = all.reduce((s, a) => s + a.length, 0), tris = new Float32Array(n); let o = 0; for (const a of all) { tris.set(a, o); o += a.length; }
        plan = podsPlan(land, seed, { site: Wk.site, tris });
        clearUnder(land, footprintTris(plan));
      }
      if (st.closed) return;
      planet = await makePlanet({ renderer: W.renderer, scene: group, land, quality: W.quality });
      if (st.closed) { planet.dispose(); return; }
      const L = land.landing;
      at.target.set(L.x, L.y, L.z);
      if (Wk) {
        wreck = Wk.draw({ scene: group, ground: planet.ground, sky: planet.dome, sunDir: planet.sunDir, paint: pick.paint });
        if (await podFile && !st.closed) pods = await makePods({ plan, scene: group, ground: planet.ground, sky: planet.dome, sunDir: planet.sunDir, paint: wreck.paintId });
        if (st.closed) return;
        if (wreck.site) at.target.set(wreck.site.x, ground(wreck.site.x, wreck.site.z), wreck.site.z);
        if (pods && lib) pods.fill(lib).catch((e) => console.error('explore: the sleepers did not come', e));
      }
      if (place.show === 'artifact') { art = makeArtifact(seed, planet); art.group.position.set(L.x, L.y - 0.4, L.z); group.add(art.group); }
      // (the way to it: the beam and the arrow, in a colour unlike the ground; lit once the scan finds it)
      if (place.show === 'wreck' || place.show === 'artifact') {
        guide = makeWreckGuide({ scene: group, ground: planet.ground, colour: guideColour(land.palette), at: [at.target.x, at.target.y, at.target.z], root: document.body,
          // (the radar in the corner kept under the captain's words, which come up at the top: on the right on a wide
          // screen, on the left of a phone's and across most of it)
          bounds: () => ({ left: 0, top: innerWidth <= 640 ? 250 : 236, right: innerWidth, bottom: innerHeight }), label: place.show === 'wreck' ? 'Wreck' : 'Find' });
        guide.show(false);
      }
    } else if (place.show === 'station') {
      const [{ buildOldStation }, { OLD_LOOK, OLD_VIEWS }, { hullMaterials }, { shieldMaterial }] = await Promise.all([import('../kit/oldstation.js'), import('../kit/oldstation-plan.js'), import('../kit/hull.js'), import('../kit/materials.js')]);
      if (st.closed) return;
      const mats = hullMaterials(OLD_LOOK), shield = shieldMaterial();
      const S = buildOldStation(OLD_LOOK, mats, { shield, seed: 7 });
      group.add(S.group); station = { S, mats, shield, view: OLD_VIEWS.approach };
      at.target.set(0, 6, 0);
    } else {
      field = makeField(seed); group.add(field.group);
      at.target.set(0, 0, 0);
    }
    // (out in space, the station's own sun lights what is out there, as the Other Station Lab lights it)
    if (!LAND) {
      const sun = new THREE.DirectionalLight(0xfff0dc, 3.0), fill = new THREE.HemisphereLight(0xa9b8d6, 0x2a3038, 0.9);
      sun.position.set(300, 420, 160); sun.target.position.set(0, 0, 0); group.add(sun, sun.target, fill);
    }
    plot();
    st.times.made = Math.round(performance.now() - t0);
    st.ready = true;
  })().catch((e) => { console.error(e); if (window.oops) window.oops(e); st.failed = true; });

  // WHERE IT COMES OUT: off from what it came to look at, high over it, its nose toward it; and where the crew's pilot
  // stops short of it once it is found
  function plot() {
    if (station) {
      const v = station.view.at; at.from.set(v[0], v[1], v[2]); at.a0 = Math.atan2(v[2], v[0]);
      at.dir.set(at.target.x - v[0], 0, at.target.z - v[2]).normalize();
      at.p.copy(at.from); return;
    }
    const a = R() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    at.dir.set(dx, 0, dz);
    if (LAND) {
      const A = PLACE.arrive, ax = at.target.x - dx * A.out, az = at.target.z - dz * A.out;
      at.from.set(ax, Math.max(at.target.y + A.up, ground(ax, az) + A.clear), az);
      const S = PLACE.stand.land, hx = at.target.x - dx * S, hz = at.target.z - dz * S;
      at.to.set(hx, Math.max(at.target.y + PLACE.stand.up, ground(hx, hz) + PLACE.clear + 10), hz);
    } else {
      at.from.set(-dx * PLACE.arrive.space, 40, -dz * PLACE.arrive.space);
      at.to.set(-dx * PLACE.stand.space, 18, -dz * PLACE.stand.space);
    }
    at.flyT = at.from.distanceTo(at.to) / PLACE.cruise * 1.5 + 2;
    at.p.copy(at.from);
  }
  // (its nose a little down toward what it came to look at, so it is in sight from the seat: eased as it flies)
  let pitch = null;
  const put = (dt = 0) => {
    const h = Math.hypot(at.target.x - at.p.x, at.target.z - at.p.z) || 1, want = Math.max(-0.45, Math.min(0.15, (at.target.y - at.p.y) / h));
    pitch = pitch == null || !dt ? want : pitch + (want - pitch) * Math.min(1, dt * 1.5);
    ship.put([at.p.x, at.p.y, at.p.z], [at.dir.x, pitch, at.dir.z]);
  };

  // ── AS THE COLOURS ARE ALL ROUND: shown, the ship there ──
  const kept = { sky: null, fill: null, exposure: null };
  function open(view = 'cockpit') {
    if (!st.ready || ship.fl || st.closed) return false;
    if (LAND) {
      // (above land: the station's own sky and light put away, the planet's own)
      kept.sky = W.sky && W.sky.object ? W.sky.object.visible : null; if (W.sky && W.sky.object) W.sky.object.visible = false;
      kept.fill = W.fill ? W.fill.visible : null; if (W.fill) W.fill.visible = false;
      kept.exposure = W.renderer.toneMappingExposure; W.renderer.toneMappingExposure = planet.exposure;
    }
    group.visible = true;
    ship.open(view, at.p.toArray(), at.dir.toArray());
    st.phase = 'above'; st.t = 0; put();
    if (planet) { planet.update(W.camera, 0); planet.relayNow(W.camera); }
    return true;
  }
  const who = String(opts.flier || 'The pilot');
  const WORDS = { fly: () => `${who} flies closer`, round: () => `${who} flies round the station`, held: () => '' };
  function setPhase(p) { st.phase = p; st.t = 0; st.words = WORDS[p] ? WORDS[p]() : ''; }

  const api = {
    get ready() { return st.ready; }, get failed() { return st.failed; }, get phase() { return st.phase; }, get words() { return st.words; },
    get fl() { return ship.fl; }, get matrix() { return ship.matrix; }, get down() { return false; }, get held() { return st.phase === 'held'; },
    get canSkip() { return !!ship.fl && (st.phase === 'fly' || st.phase === 'round'); },
    leg: opts.leg ?? 0, place,
    open,
    // THE SCAN DONE: what it found is lit (the beam on a find on the ground)
    reveal() { if (st.lit) return; st.lit = true; if (guide) guide.light(true); },
    // OVER TO IT: the crew's pilot flies over toward the finding and holds there; round the station, once round
    go() {
      if (st.phase !== 'above') return false;
      if (station) { setPhase('round'); return true; }
      // (a new world, or a place on the way, is the land itself: it stays where it is)
      if (!guide && !field) { at.to.copy(at.from); setPhase('held'); return true; }
      setPhase('fly'); return true;
    },
    // ALL AT ONCE: there, holding
    skip() {
      if (!api.canSkip) return false;
      if (st.phase === 'round') { st.lap = 1; roundAt(1); } else at.p.copy(at.to);
      setPhase('held'); put();
      return true;
    },
    update(dt) {
      if (!ship.fl || st.closed) return;
      st.t += dt;
      if (st.phase === 'fly') {
        const k = smoother(st.t / at.flyT);
        at.p.lerpVectors(at.from, at.to, k);
        if (LAND) at.p.y = Math.max(at.p.y, ground(at.p.x, at.p.z) + PLACE.clear);
        if (k >= 1) { at.p.copy(at.to); setPhase('held'); }
      } else if (st.phase === 'round') {
        const lap = station ? 70 : 60; st.lap = Math.min(1, st.t / lap); roundAt(st.lap);
        if (st.lap >= 1) setPhase('held');
      } else {
        // (holding where it is: a slow bob)
        const base = st.phase === 'held' ? (station ? null : at.to) : at.from;
        if (base) { at.p.copy(base); at.p.y += Math.sin(st.t * 1.6) * 0.12; }
      }
      put(dt);
    },
    aim(camera, dt) {
      if (!ship.fl || st.closed) return;
      ship.fl.aim(camera, dt);
      if (camera.far !== PLACE.far) { camera.far = PLACE.far; camera.updateProjectionMatrix(); }
    },
    // just before the picture (after the trip's own camera, on foot aboard too): the planet laid out round the eye
    late(dt = 1 / 60) {
      if (!ship.fl || st.closed) return;
      const c = W.camera; if (c.far !== PLACE.far) { c.far = PLACE.far; c.updateProjectionMatrix(); }
      if (planet) planet.update(c, dt); if (pods) pods.update(c, dt);
      if (guide) guide.update(c, dt, {});
      if (art) art.update(dt); if (field) field.update(dt);
    },
    state: () => ({ phase: st.phase, t: +st.t.toFixed(2), ready: st.ready, failed: st.failed, seed, where: place.where, kind: land ? land.kind.id : place.show, show: place.show || null, lit: st.lit,
      wreck: wreck ? wreck.ship : null, pods: pods ? pods.pods.length : 0, artifact: !!art, field: field ? field.rocks : 0, station: !!station, lap: +st.lap.toFixed(3),
      p: at.p.toArray().map((v) => +v.toFixed(1)), up: land ? +(at.p.y - ground(at.p.x, at.p.z)).toFixed(1) : null, target: at.target.toArray().map((v) => +v.toFixed(1)),
      dist: +Math.hypot(at.p.x - at.target.x, at.p.z - at.target.z).toFixed(1), view: ship.fl ? ship.fl.view : null, guide: guide ? guide.state() : null, times: st.times, words: st.words }),
    close() {
      if (st.closed) return; st.closed = true;
      ship.close();
      if (kept.sky != null && W.sky && W.sky.object) W.sky.object.visible = kept.sky;
      if (kept.fill != null && W.fill) W.fill.visible = kept.fill;
      if (kept.exposure != null) W.renderer.toneMappingExposure = kept.exposure;
      if (guide) guide.dispose(); if (pods) pods.dispose(); if (wreck) wreck.dispose(); if (art) art.dispose(); if (field) field.dispose();
      if (station) { station.S.dispose(); for (const m of new Set(Object.values(station.mats))) if (m && m.dispose) m.dispose(); if (station.shield && station.shield.dispose) station.shield.dispose(); }
      if (planet) planet.dispose();
      group.removeFromParent(); guide = pods = wreck = planet = art = field = station = null;
    },
  };
  // ROUND THE STATION (kit/oldstation-plan.js ROUND): from where it came out, once round, nose toward its middle
  function roundAt(k) {
    const a = at.a0 + k * Math.PI * 2, r = Math.hypot(at.from.x, at.from.z), y = at.from.y + (55 - at.from.y) * ease(k * 4);
    at.p.set(Math.cos(a) * r, y, Math.sin(a) * r);
    at.dir.set(at.target.x - at.p.x, 0, at.target.z - at.p.z).normalize();
  }
  return api;
}

// A THING NOBODY WE KNOW MADE (the exploring run's alien artifact): a tall dark spire of eight faces, leaning a little,
// cut with glowing lines of writing that slowly pulse, a ring of the same light at its foot. Built here (nothing like
// it exists in the kit); lit by the planet's own sun and sky.
export function makeArtifact(seed = 1, planet = null) {
  const R = rng(subSeed(seed, 'artifact')), group = new THREE.Group(); group.name = 'explore: the artifact';
  const own = [];
  // the spire: eight faces, wider at its foot, its top cut at a slant
  const H = 15 + R() * 5, r0 = 2.6, r1 = 1.1, n = 8, pos = [];
  const ring = (y, r, tw) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + tw; return [Math.cos(a) * r, y, Math.sin(a) * r]; });
  const A = ring(0, r0, 0), B = ring(H * 0.62, (r0 + r1) / 2, 0.08), C = ring(H, r1, 0.16).map((p, i) => [p[0], p[1] - (i < n / 2 ? i : n - i) * 0.35, p[2]]);
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (const [L0, L1] of [[A, B], [B, C]]) for (let i = 0; i < n; i++) { const j = (i + 1) % n; quad(L0[i], L0[j], L1[j], L1[i]); }
  const top = C.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n, s[2] + p[2] / n], [0, 0, 0]);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; pos.push(...C[i], ...C[j], ...top); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.38, metalness: 0.65, flatShading: true });
  const spire = new THREE.Mesh(geo, mat); group.add(spire); own.push(geo, mat);
  // the writing: short glowing strokes on its faces, in rows, as lines of marks nobody can read
  const glow = new THREE.MeshBasicMaterial({ color: 0x6ff3ff, toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });
  const marks = [], up = new THREE.Vector3(), out = new THREE.Vector3();
  for (let f = 0; f < n; f++) {
    const a = ((f + 0.5) / n) * Math.PI * 2 + 0.04;
    for (let row = 0; row < 7; row++) {
      const y = 1.6 + row * 1.25; if (y > H * 0.6) break;
      const r = r0 + ((r0 + r1) / 2 - r0) * (y / (H * 0.62)) + 0.03, w = 0.25 + R() * 0.5;
      if (R() < 0.25) continue;
      out.set(Math.cos(a), 0, Math.sin(a)); up.set(-Math.sin(a), 0, Math.cos(a));
      const cx = out.x * r * Math.cos(Math.PI / n), cz = out.z * r * Math.cos(Math.PI / n), off = (R() - 0.5) * 0.6;
      const p = [[cx + up.x * (off - w), y, cz + up.z * (off - w)], [cx + up.x * (off + w), y, cz + up.z * (off + w)], [cx + up.x * (off + w), y + 0.12 + R() * 0.25, cz + up.z * (off + w)], [cx + up.x * (off - w), y + 0.12, cz + up.z * (off - w)]];
      marks.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]);
    }
  }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(marks, 3));
  const writing = new THREE.Mesh(mg, glow); writing.renderOrder = 3; group.add(writing); own.push(mg, glow);
  // the ring of light at its foot
  const rg = new THREE.RingGeometry(r0 + 1.2, r0 + 1.7, 48); rg.rotateX(-Math.PI / 2);
  const rm = new THREE.MeshBasicMaterial({ color: 0x6ff3ff, toneMapped: false, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const foot = new THREE.Mesh(rg, rm); foot.position.y = 0.45; foot.renderOrder = 3; group.add(foot); own.push(rg, rm);
  group.rotation.set((R() - 0.5) * 0.08, R() * Math.PI * 2, (R() - 0.5) * 0.08);
  // (lit as what stands on the planet is lit: its sun and sky where it stands, and the haze of its air)
  if (planet && planet.ground) onPlanet(mat, { ground: planet.ground, sky: planet.dome, kind: 'artifact' });
  let clock = 0;
  return {
    group, height: H,
    update(dt) { clock += dt; const k = 0.62 + 0.38 * Math.sin(clock * 1.3); glow.opacity = 0.55 + 0.4 * k; rm.opacity = 0.3 + 0.3 * k; },
    dispose() { for (const o of own) o.dispose(); group.removeFromParent(); },
  };
}

// A RICH ASTEROID FIELD, out in space: rocks of every size round a middle, flattened up and down a little, each with a
// few spots of ore glowing in its metal's own colour (src/jobs/smelter.js ORE: the mining run's glow), slowly turning
export function makeField(seed = 1) {
  const R = rng(subSeed(seed, 'field')), group = new THREE.Group(); group.name = 'explore: the field';
  const own = [], rocks = [], metals = Object.keys(ORE);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c5650, roughness: 0.92, metalness: 0.05, flatShading: true });
  own.push(rockMat);
  const dots = [];
  for (let i = 0; i < FIELD.rocks; i++) {
    const s = FIELD.small + Math.pow(R(), 2.6) * (FIELD.big - FIELD.small);
    const g = new THREE.IcosahedronGeometry(1, s > 14 ? 2 : 1), P = g.attributes.position, v = new THREE.Vector3();
    const a = R() * 9, b = R() * 9, sq = [0.8 + R() * 0.5, 0.65 + R() * 0.35, 0.8 + R() * 0.5];
    for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k).normalize(); const r = 1 + 0.16 * Math.sin(v.x * 3.1 + a) * Math.cos(v.y * 2.7 + b) + 0.1 * Math.sin(v.z * 5.3 + a); P.setXYZ(k, v.x * r * sq[0], v.y * r * sq[1], v.z * r * sq[2]); }
    g.computeVertexNormals(); own.push(g);
    const m = new THREE.Mesh(g, rockMat);
    const ang = R() * Math.PI * 2, d = Math.sqrt(R()) * FIELD.r;
    m.position.set(Math.cos(ang) * d, (R() - 0.5) * 2 * FIELD.r * FIELD.flat, Math.sin(ang) * d); m.scale.setScalar(s); m.rotation.set(R() * 6, R() * 6, R() * 6);
    group.add(m); rocks.push({ m, spin: new THREE.Vector3((R() - 0.5) * 0.06, (R() - 0.5) * 0.06, (R() - 0.5) * 0.06) });
    // (its ore: a few spots on its skin, all of one metal or two)
    const metal = metals[Math.floor(Math.pow(R(), 1.6) * metals.length)], n = Math.min(FIELD.dots[1], FIELD.dots[0] + Math.floor(R() * 4 + s / 4));
    for (let k = 0; k < n; k++) { v.set(R() - 0.5, R() - 0.5, R() - 0.5).normalize(); dots.push({ rock: m, at: v.clone().multiply(new THREE.Vector3(...sq)).multiplyScalar(0.98), size: Math.min(FIELD.most / s, FIELD.dot[0] + R() * (FIELD.dot[1] - FIELD.dot[0])), colour: new THREE.Color(ORE[k % 3 === 2 ? metals[Math.floor(R() * metals.length)] : metal].glow) }); }
  }
  // the ore: one glowing piece for each spot, all in one draw, riding their rocks
  const dg = new THREE.OctahedronGeometry(1, 0), dm = new THREE.MeshBasicMaterial({ toneMapped: false });
  const glow = new THREE.InstancedMesh(dg, dm, dots.length); glow.frustumCulled = false; own.push(dg, dm);
  dots.forEach((d, i) => glow.setColorAt(i, d.colour.clone().multiplyScalar(1.6)));
  group.add(glow);
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  function place() {
    dots.forEach((d, i) => { _p.copy(d.at).applyMatrix4(d.rock.matrixWorld); const sc = d.size * d.rock.scale.x; _s.setScalar(sc); _q.copy(d.rock.quaternion); _m.compose(_p, _q, _s); glow.setMatrixAt(i, _m); });
    glow.instanceMatrix.needsUpdate = true;
  }
  group.updateMatrixWorld(true); place();
  return {
    group, rocks: rocks.length,
    update(dt) { for (const r of rocks) { r.m.rotation.x += r.spin.x * dt; r.m.rotation.y += r.spin.y * dt; r.m.rotation.z += r.spin.z * dt; } group.updateMatrixWorld(true); place(); },
    dispose() { for (const o of own) o.dispose(); glow.dispose(); group.removeFromParent(); },
  };
}
