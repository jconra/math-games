// PROTECT THE WAGON: a gang has hit a supply wagon on the road east of the pasture. The rule card names the gang ("The
// 6-Gang"): every bandit wears a multiple of 6, on a card over his hat and painted on his saddlebags. Townsfolk riding
// along with the wagon wear wrong numbers, and they look just like the gang (same outfits, horses and neckerchiefs:
// the number is the only tell). The kid rides alongside and ropes riders with the lasso and the green target ring;
// choosing the rider IS the answer.
//   right: the bandit is pulled from the saddle, lands face down and is hogtied; he drops sacks that show the fact
//          (24 drops 4 sacks of 6: "24 = 4 × 6", written a few ways); his horse gallops off; gold. A little later he
//          gets up, his hands still tied behind him, and walks off to the sheriff's office (OFF TO THE SHERIFF below)
//   wrong: the rope tangles (about a second and a half), the townsman tips his hat ("Not me, partner"), a skip-count
//          rail shows over the road ahead (6 · 12 · 18 · 24 · (27) · 30) with one plain line why, the times chart
//          offers a peek, and that number comes back 2 to 4 answers later (the same rider shows it again, or a new one
//          rides in wearing it)
// Riders weave about the wagon in a loose bunch; now and then one gallops off ahead and is gone round the bend, then
// comes back in from behind: a missed bandit never escapes. There is no timer and no way to lose.
// Wave done: the wagon rolls on safe, gold and bounty are paid, a strongbox from the gang goes in the saddlebags, the
// roped bandits are "brought in" (stats.jobs.bandits and its belt buckle), the townsfolk ride on ahead, and the next
// stretch of road brings the next gang. Nothing to click. Riding well away from the wagon stops it (as "Let the wagon
// wait" in the pause menu does); the wagon waits.
//
// The math is the times-table trainer the round-up uses (src/math/times.js, the same trainer and the kid's own step,
// shared through `times`). Two separate dials, never raised together: the math step (the trainer's own climb), and the
// wagon's speed (WAGONJOB.speeds): up a notch after a clean wave that didn't move the math, down after a rough one, and
// back to a walk whenever a new table opens.
//
//   const WJ = makeWagonJob({ W, folk, animals, P, I, camera, canvas, rider, hud, hob, audio, refresh, times, wagonLib, quiet })
//     times(): the round-up's times trainer (RU.trainer('times')), so both jobs share one; left out, one is made here
//     audio: src/audio/audio.js's (the action music plays while the job runs; see src/audio/actionmusic.js; the wagon
//     rumbles, creaks and clops as the traffic's wagons do: src/audio/wagonsound.js)
//     wagonLib(): the wagons' library already loading for the town's traffic (src/wagon.js loadWagons: a promise), so
//     it isn't loaded twice; left out, it is loaded here
//     quiet(): true while another job has the card (at the herd, the farm, a counter): the wagon's "it waits for you"
//     card stays down then
//   WJ.update(dt)     each frame after P.update
//   WJ.paused = true  a panel is open (help put away, ring hidden)
//   WJ.near           the player is with the wagon (the job's card is up: the round-up's card stands aside)
//   WJ.on             the job is running (started and not stopped)
//   WJ.where()        the wagon's place { x, z } (for the compass)
//   WJ.targets        the riders' records { r (actors/riders.js), n, text, good, state, label, person }
//   WJ.throwAt(rec)   rope this one (as a click on it does)
//   WJ.start(), WJ.stop({ away })   start now (dev, or E by the driver) / stop (the pause menu; away: rode off)
//   WJ.rig, WJ.phase  the wagon (src/wagon.js's, or null) and the job's state ('loading' | 'waiting' | 'on' | 'stopped')
//   WJ.newWave()      a new gang now (dev)
//   WJ.tieAt(x, z)    (dev and rigs) a bandit pulled down and tied there now: he gets up and walks off to the sheriff's
//   WJ.walkers        the roped bandits walking off ({ x, z }: the town's wagons stop for them)
//   WJ.tookTrainer    true once a wave here has taken the shared trainer's current wave (the round-up deals afresh)
//   WJ.state()        for rigs: { on, near, wave, riders, wagon, speed, music, sound }
//   WJ.music          the action music (or null)
//   WJ.dispose()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeAnimal, gaitFor } from '../actors/animals.js';
import { loadRiderKit, makeRider, makeCard, drawCard, RIDERS, TIE, tiePose } from '../actors/riders.js';
import { makeTimes } from '../math/times.js';
import { makeTargetRing } from '../targetring.js';
import { offerChart, closeChart, chartOptions, watchHesitation as watchChart, ensureChartCss } from '../ui/timeschart.js';
import { recordAnswer, earn, saveRider, countJob } from '../save.js';
import { PAY, boxTier } from '../shop.js';
import { TIER_NAME } from '../lockbox/index.js';
import { makeActionMusic } from '../audio/actionmusic.js';
import { loadWagons, makeWagon, inWagons, wagonAt } from '../wagon.js';
import { makeWagonSound } from '../audio/wagonsound.js';
import { ROAD_POINTS, makeRoad, SLOTS, gangLine, sacksFor, nextSpeed } from './wagonplan.js';
export { ROAD_POINTS, makeRoad, SLOTS, gangLine, sacksFor, nextSpeed };

export const WAGONJOB = {
  riders: 8,              // riders in a gang's wave (the trainer deals this many numbers: about half are the gang)
  speeds: [2.0, 2.6, 3.3, 4.0],   // the wagon's speed (m/s) at each notch of its dial: the team walks up to 2.6, then runs
  startNear: 26,          // m from the wagon: riding up this close starts the job
  near: 60,               // ... the job's card shows within this (and the round-up's card stands aside)
  leave: 90,              // ... and riding off further than this from the wagon ends the job ("The wagon will wait for you")
  leaveAhead: 200,        // ... but up the road ahead of it (chasing a rider who galloped on, or scouting), this far:
                          // straight ahead off the road, or along the road itself (the road loops round, so along it
                          // the room runs out about half way round, some 187 m on, where ahead turns into behind)
  roadNear: 30,           // m from the road's middle that still counts as riding up the road
  wait: 34,               // the wagon slows and waits when the player is farther than this behind it
  firstWave: 4,           // seconds after the start before the first gang rides in
  nextWave: 9,            // seconds of quiet road after a wave before the next gang
  spawnBehind: 70,        // m behind the wagon a rider rides in from (out past where the numbers show)
  labelPx: [44, 64],      // the number card's height on screen (pixels), as the cattle's
  labelFull: 40, labelGone: 58,   // the numbers show in full within this many metres, and are gone by this far
  stackGap: 6,
  restless: [22, 40],     // seconds a rider rides along before, now and then, galloping off round the bend
  away: 14,               // ... seconds at most it is gone before it comes back in from behind
  helpAfter: 8000,        // ms without a pick before the chart's Peek is offered
  hintFor: 12,            // seconds the "Not me, partner" line and the skip-count rail stay up
  hold: 1.1,              // seconds the rope stays on a roped bandit (he is pulled down meanwhile)
  fact: 6,                // seconds the fact card ("24 = 4 × 6") shows over a hogtied bandit
  leaveDown: 70,          // m behind the player a hogtied bandit's sacks are left (put away)
  // a roped bandit, a while after he is tied, gets up (his hands still tied behind him) and walks to the sheriff's office
  getUp: 8,               // seconds after he is down (the fact card gone, his horse gone)
  rise: 1.2,              // seconds getting to his feet
  walk: 1.15,             // m/s: a slow, sulky walk
  townNear: 150,          // m from the sheriff's door: nearer than this he walks all the way there (round the buildings)
  goneFar: 60,            // ... further, he heads for town and is gone once this far from the player and out of view
  goneAnyway: 120,        // ... or this far, in view or not (fading out)
  fadeIn: 2,              // m from the foot of the steps up and in at the door, fading out
  lineUp: 2.2,            // m straight out in front of the door where his way there ends (he walks the rest square on)
  stuckRetry: 4,          // s held up in town before he looks for a fresh way round
  stuckGone: 12,          // s held up in town before he simply fades away
  // his hands tied behind him: the way each upper arm points (down, back a little, out a little) and each forearm
  // (across his back toward the other, a little back and up), in his own frame
  hands: { arm: { back: 0.25, out: 0.12 }, fore: { across: 0.6, back: 0.75, up: 0 } },
  farOff: 180,            // m from the wagon past which the riders wait out of sight (not drawn, not moved)
  pay: { bandit: 3, wave: 6 },   // gold for each bandit roped (+ a little for harder tables, as the round-up), and a wave
};

const rand = (a, b) => a + Math.random() * (b - a);

// ── THE WAGON ──────────────────────────────────────────────────────────────────────────────────────────────────────
// The job drives a wagon round the road through a small common shape, whichever wagon it is:
//   wagon.update(dt, want)   go at `want` m/s (it eases there itself); afterwards wagon.s (metres along the road) and
//                            wagon.v (its speed now) say where it got to
//   wagon.pos, wagon.heading where it is (its middle on the ground) and the way it faces; wagon.dispose()
// The real one is the wagons' own (src/wagon.js: a freight wagon with its team and a driver), driven along a closed curve
// laid through the road's own points. Its road starts on the middle of the loop's straight north side (a curve's start
// and end meet there, where the road is nearly straight, so the team stepping over the join doesn't show). If the
// wagons can't load, a stand-in made of plain shapes takes its place.
function makeRealWagon({ lib, W, road, kind = 'freight' }) {
  const wg = makeWagon(lib, { kind, W, team: true, driver: true });
  W.scene.add(wg.root);
  const seam = road.nearest(ROAD_POINTS[Math.round(ROAD_POINTS.length / 4)][0], ROAD_POINTS[Math.round(ROAD_POINTS.length / 4)][1]);
  const pts = [], q = {};
  for (let d = 0; d < road.length - 2; d += 4) { road.at(seam + d, q); pts.push(new THREE.Vector3(q.x, 0, q.z)); }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal'); curve.arcLengthDivisions = 3000;
  const L = curve.getLength();
  wg.setPath(curve, { at: (((0 - seam) % L) + L) % L / L });   // (starting where the job's road starts: its west end)
  const A = { s: 0, v: 0, pos: wg.pos, get heading() { return wg.heading; }, wagon: wg };
  A.update = (dt, want) => {
    if (wg.u > L - 9) wg.u -= L;              // (round the loop: back to the start before the curve's end stops it)
    wg.speed = want; wg.update(dt);
    A.s = seam + wg.u; A.v = wg.pace;
  };
  A.update(0, 0);
  A.dispose = () => { if (wg.dispose) wg.dispose(); else wg.root.removeFromParent(); };
  return A;
}
function makeStandInWagon({ scene, animals, W, road }) {
  const root = new THREE.Group(); root.name = 'supply-wagon';
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 });
  const canvasM = new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.95, side: THREE.DoubleSide });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.7 });
  const parts = [];
  const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g); };
  box(1.7, 0.18, 3.6, 0, 0.95, 0);                 // the bed
  box(0.08, 0.5, 3.6, 0.85, 1.25, 0); box(0.08, 0.5, 3.6, -0.85, 1.25, 0);   // the sides
  box(1.7, 0.5, 0.08, 0, 1.25, 1.78); box(1.7, 0.5, 0.08, 0, 1.25, -1.78);   // the ends
  box(0.12, 0.1, 2.2, 0, 0.75, 2.8);               // the tongue out to the team
  box(1.9, 0.12, 0.12, 0, 0.9, 1.25); box(1.9, 0.12, 0.12, 0, 0.9, -1.25);   // the axles
  const body = new THREE.Mesh(mergeGeometries(parts), wood); body.castShadow = body.receiveShadow = true;
  const top = new THREE.CylinderGeometry(0.92, 0.92, 3.0, 14, 1, true, Math.PI / 2, Math.PI);   // (the half that ends up on top)
  top.rotateX(Math.PI / 2); top.translate(0, 1.45, 0);
  const cover = new THREE.Mesh(top, canvasM); cover.castShadow = true;
  root.add(body, cover);
  // the wheels: one shape for a pair on an axle (they turn together); spokes as thin boxes
  const wheelPair = (r, x) => {
    const g = [];
    for (const sx of [-1, 1]) {
      const rim = new THREE.TorusGeometry(r, 0.05, 6, 16); rim.rotateY(Math.PI / 2); rim.translate(sx * x, 0, 0); g.push(rim);
      for (let k = 0; k < 6; k++) { const sp = new THREE.BoxGeometry(0.04, r * 2, 0.05); sp.rotateX(k * Math.PI / 6); sp.translate(sx * x, 0, 0); g.push(sp); }
    }
    const m = new THREE.Mesh(mergeGeometries(g), iron); m.castShadow = true; return m;
  };
  const front = wheelPair(0.5, 0.98), back = wheelPair(0.62, 0.98);
  front.position.set(0, 0.5, 1.25); back.position.set(0, 0.62, -1.25);
  root.add(front, back);
  scene.add(root);
  const team = [makeAnimal(animals, 'horse', { tint: '#c9b6a0' }), makeAnimal(animals, 'horse', { tint: '#8f7f72' })];
  for (const t of team) scene.add(t.root);
  let spin = 0, gait = ['Idle', 'Idle'];
  const q = {}, qt = {};
  const A = {
    root, s: 0, v: 0, pos: root.position, get heading() { return root.rotation.y; },
    update(dt, want) {
      A.v += (want - A.v) * (1 - Math.exp(-(want > A.v ? 0.8 : 1.6) * dt));
      if (A.v < 0.02 && want === 0) A.v = 0;
      A.s += A.v * dt;
      A.place(W, road, A.s, A.v, dt);
    },
    // the wagon at road place q (its middle) with the team ahead of it, going v m/s
    place(W, road, s, v, dt) {
      road.at(s, q);
      const yf = W.heightAt(q.x + Math.sin(q.h) * 1.25, q.z + Math.cos(q.h) * 1.25), yb = W.heightAt(q.x - Math.sin(q.h) * 1.25, q.z - Math.cos(q.h) * 1.25);
      root.position.set(q.x, (yf + yb) / 2, q.z);
      root.rotation.set(-Math.atan2(yf - yb, 2.5), q.h, 0, 'YXZ');
      spin += v * dt; front.rotation.x = spin / 0.5; back.rotation.x = spin / 0.62;
      team.forEach((t, i) => {
        road.at(s + 4.2, qt);
        const side = i ? -0.62 : 0.62, x = qt.x + qt.nx * side, z = qt.z + qt.nz * side;
        t.root.position.set(x, W.heightAt(x, z), z); t.root.rotation.set(0, qt.h, 0);
        if (v < 0.15) { if (gait[i] !== 'Idle') { t.play('Idle', { fade: 0.4 }); gait[i] = 'Idle'; } }
        else { const [c, sp] = gaitFor(t, v, gait[i]); gait[i] = c; t.play(c, { fade: 0.3, speed: sp }); }
        t.update(dt);
      });
    },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      wood.dispose(); canvasM.dispose(); iron.dispose();
      for (const t of team) t.dispose();
    },
  };
  A.place(W, road, 0, 0, 0);
  return A;
}

// ── SACKS: the bandit's take, dropped in a row by him, each painted with the table's number ───────────────────────────
let sackGeo = null;
const sackMats = new Map();
// the skip-count rail: metres ahead of the player (tried in turn: nearer only when it must, to sit low enough on a tall
// phone screen); where its bottom edge sits on the screen at the highest (a share of the screen's height down from the
// top; lower when the cards at the top reach further down); and how high off the ground it may hang (m)
const RAIL = { ahead: [11, 8, 6, 4.5], screenY: 0.72, low: 0.3, high: 5, see: 0.85 };   // (screenY: where its foot sits, a share of the screen's height down: low, under the riders; see: at most this solid)
function sackGeometry() {
  if (sackGeo) return sackGeo;
  const body = new THREE.SphereGeometry(0.19, 12, 8); body.scale(1, 1.1, 0.85); body.translate(0, 0.2, 0);
  const neck = new THREE.ConeGeometry(0.07, 0.14, 8); neck.rotateX(Math.PI); neck.translate(0, 0.44, 0);
  const tie = new THREE.ConeGeometry(0.06, 0.08, 8); tie.translate(0, 0.38, 0);
  return (sackGeo = mergeGeometries([body, neck, tie]));
}
function sackMaterial(per) {
  if (sackMats.has(per)) return sackMats.get(per);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#b28c5a'; c.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 900; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(90,60,30,0.18)' : 'rgba(240,220,180,0.16)'; c.fillRect(Math.random() * 256, Math.random() * 128, 2, 2); }
  c.fillStyle = '#3b2615'; c.font = '700 54px Bitter, Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const x of [64, 192]) c.fillText(String(per), x, 68);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  sackMats.set(per, m);
  return m;
}

// the job's own looks for the cards at the top: the gang's rule card on one short row (the gang's name and the count
// side by side), a card faded nearly away while a rider's number is behind it, and the chart's Peek
// button as just its picture on a phone
let wagonCss = false;
function ensureWagonCss() {
  if (wagonCss || typeof document === 'undefined') return; wagonCss = true;
  const st = document.createElement('style'); st.dataset.for = 'wagonjob';
  st.textContent = `
.bmh-rule.is-gang { display: flex; align-items: center; gap: 14px; padding: 5px 8px 5px 16px; text-align: left; }
.bmh-rule.is-gang .bmh-rule-main { font-size: 22px; white-space: nowrap; }
.bmh-rule.is-gang .bmh-rule-sub { margin-top: 0; }
.bmh-rule.is-gang .bmh-rule-btns { margin: 0 0 0 auto; flex: none; }
@media (max-width: 480px) {
  .bmh-rule.is-gang { gap: 8px; padding: 4px 6px 4px 10px; }
  .bmh-rule.is-gang .bmh-rule-main { font-size: 16px; }
  .bmh-rule.is-gang .bmh-rule-sub { font-size: 11.5px; line-height: 1.2; }
  .bmh-rule.is-gang .bmh-rule-btns button { font-size: 12px; padding: 3px 8px; }
}
.bmh-rule, .bmh-hint { transition: opacity 0.18s ease-out; }
.bmh-rule.wj-see, .bmh-hint.wj-see, .tch-offer.in.wj-see { opacity: 0.18 !important; }
.wj-see, .wj-see * { pointer-events: none !important; }
.tch-offer.wj-small { padding: 7px; gap: 0; }
.tch-offer.wj-small .tch-offer-words { display: none; }
`;
  document.head.appendChild(st);
}

// ── THE SKIP-COUNT RAIL over the road ahead after a wrong catch: 6 · 12 · 18 · 24 · (27) · 30 ────────────────────────
function makeRail() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 150;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false, opacity: 0 });
  const s = new THREE.Sprite(mat); s.center.set(0.5, 0); s.renderOrder = 1002; s.name = 'skip-rail'; s.visible = false;
  const draw = (skip, anchor) => {
    const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    const items = skip.map((v) => ({ text: String(v), miss: typeof v === 'string' }));
    let font = 64; c.font = `700 ${font}px Bitter, Georgia, serif`;
    const dot = '  ·  ';
    const width = () => items.reduce((w, it) => w + c.measureText(it.text).width, 0) + c.measureText(dot).width * (items.length - 1) + (anchor ? c.measureText(anchor + '   ').width * 0.6 : 0);
    while (width() > cv.width - 70 && font > 30) { font -= 4; c.font = `700 ${font}px Bitter, Georgia, serif`; }
    const w = width() + 50, x0 = (cv.width - w) / 2;
    // a weathered plank with posts at the ends
    c.fillStyle = 'rgba(86, 58, 34, 0.94)'; c.strokeStyle = 'rgba(48, 30, 16, 0.95)'; c.lineWidth = 6;
    c.beginPath(); c.roundRect(x0, 22, w, 106, 16); c.fill(); c.stroke();
    let x = x0 + 25; c.textBaseline = 'middle';
    if (anchor) { c.font = `600 ${Math.round(font * 0.6)}px Bitter, Georgia, serif`; c.fillStyle = '#d9c39a'; c.fillText(anchor + '   ', x, 76); x += c.measureText(anchor + '   ').width; c.font = `700 ${font}px Bitter, Georgia, serif`; }
    items.forEach((it, i) => {
      if (i) { c.fillStyle = '#c9a46a'; c.fillText(dot, x, 76); x += c.measureText(dot).width; }
      const tw = c.measureText(it.text).width;
      if (it.miss) { c.fillStyle = 'rgba(200, 70, 40, 0.9)'; c.beginPath(); c.roundRect(x - 8, 36, tw + 16, 80, 12); c.fill(); c.fillStyle = '#fff3df'; }
      else c.fillStyle = '#f6edd6';
      c.fillText(it.text, x, 76); x += tw;
    });
    s.userData.wide = w / cv.width;
    tex.needsUpdate = true;
  };
  return { sprite: s, draw, dispose() { s.removeFromParent(); mat.dispose(); tex.dispose(); } };
}

export function makeWagonJob({ W, folk, animals, P, I, camera, canvas, rider, hud, hob, audio = null, refresh = () => {}, times = null, quiet = () => false, wagonLib = null }) {
  const scene = W.scene, road = makeRoad(ROAD_POINTS);
  const R = makeTargetRing({ scene, camera, canvas, W });
  ensureChartCss();
  const fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('700 84px Bitter').catch(() => null) : Promise.resolve();
  const WJ = { near: false, on: false, away: false, targets: [], tookTrainer: false, music: null };
  const recs = WJ.targets, downs = [];
  let kit = null, wagon = null, disposed = false;
  let s = 0, v = 0, time = 0, state = 'loading';   // state: 'loading' | 'waiting' | 'on' | 'stopped'
  let wave = null, waveN = 0, nextWaveT = -1, hintT = 0, offer = null, hes = null, sawLoop = false;
  const qw = {}, qs = {};

  // the shared times trainer (the round-up's), and the wagon's speed dial (saved with the rider)
  let ownT = null;
  const trainer = () => (times && times()) || ownT || (ownT = makeTimes(rider.topics.times || (rider.topics.times = {})));
  const dial = () => { rider.topics = rider.topics || {}; const d = rider.topics.wagon = rider.topics.wagon && typeof rider.topics.wagon === 'object' ? rider.topics.wagon : {}; d.speed = Math.max(0, Math.min(WAGONJOB.speeds.length - 1, d.speed | 0)); return d; };

  const wagons = Promise.resolve((wagonLib && wagonLib()) || loadWagons({ animals, folk })).catch((e) => { console.warn('wagon job: no wagon models, a stand-in rolls instead', e); return null; });
  Promise.all([loadRiderKit({ animals }), wagons]).then(([k, lib]) => {
    if (disposed) return;
    kit = k;
    try { if (lib) wagon = makeRealWagon({ lib, W, road }); } catch (e) { console.warn('wagon job: the wagon could not be made, a stand-in rolls instead', e); }
    if (!wagon) wagon = makeStandInWagon({ scene, animals, W, road });
    state = 'waiting';
  }).catch((e) => console.error('wagon job: the riders could not load', e));

  // ── THE RIDERS ─────────────────────────────────────────────────────────────────────────────────────────────────
  let slotN = 0;
  function freeSlot() {
    const used = new Set(recs.filter((x) => x.state !== 'leave').map((x) => x.slot));
    for (let i = 0; i < SLOTS.length; i++) { const k = (slotN + i) % SLOTS.length; if (!used.has(k)) { slotN = k + 1; return k; } }
    return (slotN++) % SLOTS.length;
  }
  function addRider(t, { behind = WAGONJOB.spawnBehind } = {}) {
    const r = makeRider(kit, { W, folk, scene });
    const slot = freeSlot(), [side, lat] = SLOTS[slot];
    road.at(s - behind, qs);
    r.place(qs.x + qs.nx * side * lat, qs.z + qs.nz * side * lat, qs.h);
    r.speed = WAGONJOB.speeds[dial().speed] + 3;
    const rs = s - behind;
    const rec = { r, rs, person: r.person, label: r.label, slot, state: 'arrive', n: null, text: '', good: false, trap: null, alpha: 0, lift: 0,
      phase: Math.random() * 10, restless: rand(...WAGONJOB.restless), say: 0,
      also: [r.horse.root],   // (a tap or click on his horse counts as on him: the target ring reads it)
      tgt: { root: r.person.root, neck: (o) => r.neck(o), neckRadius: 0.13, height: 2.4 } };
    setNumber(rec, t);
    recs.push(rec);
    return rec;
  }
  function setNumber(rec, t) {
    rec.n = t ? t.n : null; rec.good = !!(t && t.good); rec.trap = t ? t.trap || null : null;
    rec.text = t ? String(t.n) : '';
    rec.r.setNumber(rec.text || null);
    if (t) fontReady.then(() => { if (rec.text && !rec.say) { rec.r.label.userData.text = null; rec.r.setNumber(rec.text); } });
  }
  function removeRec(rec) {
    const i = recs.indexOf(rec); if (i >= 0) recs.splice(i, 1);
    rec.r.dispose();
  }
  const ropeable = (rec) => (rec.state === 'ride' || rec.state === 'arrive') && rec.n != null && !!wave && !wave.done && rec.wave === wave;
  // riding free (not roped, not falling, not tied on the ground): these are the ones that ride on when a wave ends
  const free = (rec) => rec.r.mode === 'ride' && (rec.state === 'ride' || rec.state === 'arrive' || rec.state === 'tangled' || rec.state === 'away');

  // where a rider wants to be: its slot beside the wagon, weaving a little; out of the player's way
  const slotAt = (rec, out) => {
    const [side, lat, along] = SLOTS[rec.slot];
    const l = lat + Math.sin(time * 0.45 + rec.phase) * 1.3, a = along + Math.sin(time * 0.23 + rec.phase * 1.7) * 2.5;
    road.at(s + a, qs);
    out.x = qs.x + qs.nx * side * l; out.z = qs.z + qs.nz * side * l; out.h = qs.h; out.s = s + a; out.side = side; out.lat = l;
    return out;
  };
  const goal = {};
  function riderStep(rec, dt) {
    const r = rec.r, vw = v;
    switch (rec.state) {
      case 'arrive': case 'ride': case 'throw': case 'tangled': {
        slotAt(rec, goal);
        rec.rs = road.track(r.x, r.z, rec.rs);
        const gap = road.gap(rec.rs, goal.s);   // (metres along the road from the rider to its spot: + it is behind)
        let want;
        if (gap > 16) {
          // well behind (riding in, or back from round the bend): along the road at a gallop, out at its own side
          road.at(rec.rs + 14, qs); goal.x = qs.x + qs.nx * goal.side * goal.lat; goal.z = qs.z + qs.nz * goal.side * goal.lat; goal.h = qs.h;
          want = vw + Math.min(7.5, 3 + gap * 0.15);
        } else want = vw + Math.max(-vw + 0.2, Math.min(7, gap * 0.7));
        // keep out of the player's way and off each other
        const px = P.position.x, pz = P.position.z, dp = Math.hypot(r.x - px, r.z - pz);
        if (dp < 4.5 && rec.state !== 'throw') { goal.x += (r.x - px) / (dp || 1) * 3; goal.z += (r.z - pz) / (dp || 1) * 3; }
        for (const o of recs) if (o !== rec && o.r.mode === 'ride') { const dd = Math.hypot(r.x - o.r.x, r.z - o.r.z); if (dd < 3.2) { goal.x += (r.x - o.r.x) / (dd || 1) * 2; goal.z += (r.z - o.r.z) / (dd || 1) * 2; } }
        const d = Math.hypot(goal.x - r.x, goal.z - r.z);
        if (vw < 0.2 && d < 2) want = 0;
        // aim a little ahead of the spot along the road, so a rider beside it doesn't turn in to it
        r.steer(goal.x + Math.sin(goal.h) * (want > 0.5 ? 5 : 0), goal.z + Math.cos(goal.h) * (want > 0.5 ? 5 : 0), Math.max(0, want), dt);
        if (rec.state === 'arrive' && d < 6) rec.state = 'ride';
        // now and then a rider gallops off round the bend (never the one being aimed at or roped)
        if (rec.state === 'ride' && vw > 0.5 && R.target !== rec && !(P.lassoBusy && P.lasso && rec.tgt === curTarget)) {
          if ((rec.restless -= dt) <= 0) { rec.state = 'away'; rec.awayT = WAGONJOB.away; rec.restless = rand(...WAGONJOB.restless); }
        }
        break;
      }
      case 'away': {
        // gallops on ahead along the road, out round the bend; once well out of sight it comes back in from behind
        rec.rs = road.track(r.x, r.z, rec.rs);
        road.at(rec.rs + 20, qs); const [side, lat] = SLOTS[rec.slot];
        r.steer(qs.x + qs.nx * side * (lat + 6), qs.z + qs.nz * side * (lat + 6), vw + 6.5, dt);
        rec.awayT -= dt;
        const far = Math.hypot(r.x - P.position.x, r.z - P.position.z);
        if (far > 62 && (rec.awayT <= 0 || far > 80) && !inView(r)) {
          road.at(s - WAGONJOB.spawnBehind, qs);
          r.place(qs.x + qs.nx * side * lat, qs.z + qs.nz * side * lat, qs.h); r.speed = vw + 4;
          rec.rs = s - WAGONJOB.spawnBehind; rec.state = 'arrive';
          if (!sawLoop && wave && !wave.done) { sawLoop = true; hob.event('banditLoop'); }
        }
        break;
      }
      case 'leave': {
        // ride on ahead and away; put away once out of sight
        rec.rs = road.track(r.x, r.z, rec.rs);
        road.at(rec.rs + 20, qs); const [side, lat] = SLOTS[rec.slot];
        r.steer(qs.x + qs.nx * side * (lat + 12), qs.z + qs.nz * side * (lat + 12), vw + 5, dt);
        const far = Math.hypot(r.x - P.position.x, r.z - P.position.z);
        if ((far > 70 && !inView(r)) || far > 140) { removeRec(rec); return; }
        break;
      }
      default: break;
    }
    r.update(dt);
  }
  const _iv = new THREE.Vector3(), _fr = new THREE.Frustum(), _pm = new THREE.Matrix4();
  function inView(r) {
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    return _fr.containsPoint(_iv.set(r.x, W.heightAt(r.x, r.z) + 1.4, r.z));
  }

  // ── THE WAVE ───────────────────────────────────────────────────────────────────────────────────────────────────
  function newWave() {
    if (!kit) return;
    endHelp();
    // townsfolk still about from the last gang ride on
    for (const rec of recs) if (free(rec)) { rec.state = 'leave'; setNumber(rec, null); }
    if (wave && !wave.done) bankCaught(wave);   // (a gang cut short: its roped bandits still count)
    waveN++;
    const T = trainer(), before = T.level();
    const w = T.wave({ count: WAGONJOB.riders });
    WJ.tookTrainer = true;
    wave = { T, w, id: w.id, kind: w.kind, table: w.table, goods: w.targets.filter((t) => t.good).length, caught: 0, misses: 0,
      stepBefore: before.step, tablesBefore: before.tables.length, down: [] };
    WJ.wave = wave;
    w.targets.forEach((t, i) => { const rec = addRider(t, { behind: WAGONJOB.spawnBehind + i * 4.5 }); rec.wave = wave; });
    nextWaveT = -1;
    showCard();
    if (WJ.near) startHelp();
    if (music) music.action(true);
  }
  // the trainer's wave is still this job's (the round-up deals its own when the player goes back to the herd)
  const ownsTrainer = () => { const c = wave && wave.T.state && wave.T.state.cur; return !!(c && c.id === wave.id && !c.closed); };

  function showCard() {
    if (state === 'loading') return;
    if (!WJ.near) {
      if (state === 'on' && !quiet()) {
        const d = Math.round(Math.hypot(P.position.x - wagon.pos.x, P.position.z - wagon.pos.z));
        hud.rule({ kind: 'travel', main: 'Protect the wagon: it waits for you', sub: `${d} m away, on the road east of the pasture` });
      }
      return;
    }
    // (no "Done for now" button: riding away from the wagon stops the job, as the pause menu's "Let the wagon wait" does)
    if (state !== 'on') { hud.rule({ main: 'Protect the wagon', sub: state === 'stopped' ? 'The wagon waits here. Ride along with the driver when you\'re ready' : 'Ride up to the wagon to set off' }); return; }
    if (!wave) { hud.rule({ main: 'Protect the wagon', sub: 'Keep alongside. The gang rides in soon…' }); return; }
    if (wave.done) { hud.rule({ main: 'The wagon rolls on safe!', sub: 'More road ahead…' }); return; }
    const left = wave.goods - wave.caught;
    if (wave.kind === 'missing') hud.rule({ kind: 'gang', main: wave.w.rule, sub: 'Rope the rider wearing the missing number' });
    else hud.rule({ kind: 'gang', main: `The ${wave.table}-Gang`, sub: `Every bandit wears a multiple of ${wave.table} · ${wave.caught ? `${wave.caught} roped · ${left} to go` : `${left} to rope`}` });
  }

  // ── HELP WHEN STUCK: the times chart's Peek (as in the round-up) ───────────────────────────────────────────────
  function startHelp() {
    if (!wave || wave.done || WJ.paused || hes) return;
    hes = watchChart({ after: WAGONJOB.helpAfter, onShow: () => chartHelp() });
  }
  function chartHelp(missed) {
    if (!wave) return;
    const o = { ...chartOptions(wave.w, missed), anchor: hud.jobEl, avoid: hud.hintEl, side: 'right' };
    if (offer) offer.update(o); else offer = offerChart(document.body, o);
    placeOffer();
  }
  function hint(o) { hud.hint(o); placeOffer(); }
  function endHelp() {
    if (hes) { hes.cancel(); hes = null; }
    closeChart();
    if (offer) { offer.remove(); offer = null; }
  }
  let offerT = 0;
  function placeOffer() {
    const b = offer && offer.el; if (!b || !b.isConnected) return;
    b.classList.toggle('wj-small', innerWidth < 600);   // (a phone: just the chart's picture, beside the card)
    const c = hud.ruleEl.getBoundingClientRect(); if (!c.width) return;
    const bw = b.offsetWidth, bh = b.offsetHeight;
    let x = c.right + 14 + bw / 2, y = c.top + (c.height - bh) / 2;
    if (x + bw / 2 > innerWidth - 10) { const j = hud.jobEl.getBoundingClientRect(); x = j.left + j.width / 2; y = j.bottom + 10; }
    b.style.left = Math.round(x) + 'px'; b.style.top = Math.round(y) + 'px';
  }

  // ── THROWING ───────────────────────────────────────────────────────────────────────────────────────────────────
  let curTarget = null;
  WJ.throwAt = (rec) => {
    if (!rec || !ropeable(rec) || WJ.paused || state !== 'on') return false;
    if (!ownsTrainer()) { newWave(); return false; }   // (the round-up dealt in between: a fresh gang)
    const w = wave;
    const ok = P.throwLasso(rec.tgt, {
      good: rec.good, hold: WAGONJOB.hold, lead: false,
      onLand: (good) => { if (good) curTarget = null; landed(rec, w, good); },   // (a settled catch: stopping lets it finish)
      onCaught: (h) => { curTarget = null; rec.handle = h; rec.r.fall(P.position, { onDown: () => downed(rec, w) }); },
      onMissed: () => { curTarget = null; },
      onCancel: () => {
        curTarget = null;
        if (rec.state === 'throw') rec.state = 'ride';
        // already counted and paid (the rope was tightening): he still comes down, never left frozen in the saddle
        else if (rec.state === 'caught' && rec.r.mode === 'ride') rec.r.fall(P.position, { onDown: () => downed(rec, w) });
        if (hes && wave === w && !w.done) hes.restart();
      },
    });
    if (ok) { rec.state = 'throw'; curTarget = rec.tgt; if (hes) hes.answered(); }
    return ok;
  };

  function landed(rec, w, good) {
    if (w !== wave || !wave) { rec.state = 'ride'; return; }
    // (another job dealt on the shared trainer while the rope flew: no answer is counted against its wave)
    if (!ownsTrainer()) { rec.state = 'ride'; curTarget = null; setTimeout(() => P.cancelLasso(), 0); return; }   // (the rope just reels in)
    closeChart();
    if (hes) hes.answered();
    const T = w.T, r = T.answer(rec.n, good), right = r.right;
    const ra = recordAnswer(rider, right);
    if (ra && ra.badge) hud.toast(`You earned the ${ra.badge} badge!`, 'gold');
    if (right) {
      rec.state = 'caught'; w.caught++; rec.label.visible = false;
      const pay = WAGONJOB.pay.bandit + Math.floor(((w.w.hard || 1) - 1) / PAY.hardEvery);
      const e = earn(rider, pay);
      const ex = T.explain(rec.n);
      rec.fact = ex && ex.good ? ex.line : `${rec.n}`;
      hint(null); hideRail();   // (the last miss's line and rail go: this catch is the news now)
      hud.toast(`Roped the ${rec.text}! ${rec.fact}`, 'good');
      if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1600);
      if (r.moved > 0) setTimeout(() => hud.toast('Up a step!', 'good'), 900);
      hob.event('banditCatch');
      if (music) music.hit();
      refresh();
    } else {
      w.misses++;
      rec.state = 'tangled';
      rec.r.tipHat();
      rec.say = 2.6; drawCard(rec.label, 'Not me, partner', { font: '700 40px Bitter, Georgia, serif' });
      const ex = T.explain(rec.n);
      hint({ say: 'Not me, partner', line: gangLine(ex.line), also: ex.also });
      showRail(ex.skip, ex.anchor);
      chartHelp(rec.n);
      hintT = WAGONJOB.hintFor;
      hob.event('banditMiss');
      refresh();
    }
    // numbers due back now (2 to 4 answers after a miss): the townsman wearing it shows it again, or one rides in
    for (const d of T.due()) {
      const back = recs.find((x) => x.wave === w && x.n === d.n && x.state === 'tangled');
      if (back) { back.state = 'ride'; back.say = 0; setNumber(back, d); }
      else { const nr = addRider(d); nr.wave = w; }
    }
    if (w.caught >= w.goods) waveDone();
    else if (hes) hes.restart();
    showCard();
  }

  // the bandit is down and tied: his sacks by him, and the fact over him for a few seconds
  function downed(rec, w) {
    rec.state = 'down';
    const { sacks, per } = sacksFor(rec.n, w.table, w.kind);
    const k = Math.min(12, sacks), p = rec.r.person.root.position;
    let mesh = null;
    if (k > 0) {
      mesh = new THREE.InstancedMesh(sackGeometry(), sackMaterial(per), k); mesh.castShadow = true; mesh.name = 'sacks';
      // in a row (two rows past six) along his side, clear of him, so they can be counted from the saddle: measured from
      // where he actually lies (his head, hands and feet), on the side toward the road's middle where the player rides
      const body = bodyPoints(rec.r.person), pts = body.all, head = body.head;
      let ax = 0, az = 0;
      if (head) { ax = head.x - p.x; az = head.z - p.z; }
      let al = Math.hypot(ax, az);
      if (al < 0.3) { road.at(road.nearest(p.x, p.z), qs); ax = Math.sin(qs.h); az = Math.cos(qs.h); al = 1; }
      ax /= al; az /= al;
      const lx = az, lz = -ax;   // (square to his body, flat on the ground)
      let lo = 0, hi = 0, wide = 0;
      for (const b of pts) {
        const a = (b.x - p.x) * ax + (b.z - p.z) * az, l = (b.x - p.x) * lx + (b.z - p.z) * lz;
        lo = Math.min(lo, a); hi = Math.max(hi, a); wide = Math.max(wide, Math.abs(l));
      }
      const mid = (lo + hi) / 2, cx = p.x + ax * mid, cz = p.z + az * mid;
      road.at(road.nearest(cx, cz), qs);
      let side = Math.sign((qs.x - cx) * lx + (qs.z - cz) * lz);
      if (Math.hypot(qs.x - cx, qs.z - cz) < 0.5 || !side) side = Math.sign((P.position.x - cx) * lx + (P.position.z - cz) * lz) || 1;
      const heading = Math.atan2(ax, az);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), at = new THREE.Vector3();
      const perRow = k > 6 ? Math.ceil(k / 2) : k;
      for (let i = 0; i < k; i++) {
        const row = Math.floor(i / perRow), col = i % perRow, along = (col - (perRow - 1) / 2) * 0.5, out = wide + 0.55 + row * 0.55;
        const x = cx + ax * along + lx * side * out, z = cz + az * along + lz * side * out;
        at.set(x, W.heightAt(x, z), z); q.setFromAxisAngle(_up, heading + Math.PI / 2 * side + (Math.random() - 0.5) * 0.5);
        mesh.setMatrixAt(i, m.compose(at, q, sc));
      }
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
    }
    const fact = makeCard(); scene.add(fact);
    drawCard(fact, rec.fact || String(rec.n), { font: '700 54px Bitter, Georgia, serif' });
    downs.push({ rec, mesh, fact, factT: WAGONJOB.fact, at: p.clone(), wave: w, t: 0 });
  }
  const _up = new THREE.Vector3(0, 1, 0);
  // where a tied rider's head, hands and feet are on the ground
  function bodyPoints(person) {
    const out = { head: null, all: [] }, b = person.bones || {};
    person.root.updateMatrixWorld(true);
    for (const n of ['Head', 'WristL', 'WristR', 'FootL', 'FootR']) if (b[n]) out.all.push(b[n].getWorldPosition(new THREE.Vector3()));
    if (b.Head) out.head = out.all[0];
    return out;
  }
  function removeDown(d) {
    const i = downs.indexOf(d); if (i >= 0) downs.splice(i, 1);
    if (d.mesh) { d.mesh.removeFromParent(); d.mesh.dispose(); }
    d.fact.removeFromParent(); d.fact.material.dispose(); d.fact.userData.tex.dispose();
    if (d.rec) removeRec(d.rec);   // (one who got up and walked off is the walker's to put away)
  }

  // ── OFF TO THE SHERIFF ─────────────────────────────────────────────────────────────────────────────────────────
  // A while after he is tied (the fact card gone, his horse gone), a roped bandit gets up, his hands still tied behind
  // him, and walks off to the sheriff's office. Near town he walks all the way, by a way round the buildings, up to its
  // door and in, and is gone. Out on the job's road (well east of town) he sets off toward town and is gone once well
  // out of the player's sight, rather than walking the whole way. His sacks stay where he lay.
  const walkers = WJ.walkers = [];
  const _wq = new THREE.Quaternion(), _we = new THREE.Euler(), _wv = new THREE.Vector3(), _wv2 = new THREE.Vector3();
  const LEGS = { thigh: TIE.thigh, knee: TIE.knee, arm: [0, 0, 0], fore: [0, 0, 0] };
  let ropeGeo = null, ropeMat = null;
  function getUp(d) {
    const rec = d.rec; d.rec = null;
    const i = recs.indexOf(rec); if (i >= 0) recs.splice(i, 1);
    const r = rec.r, person = r.person;
    if (!person.root.visible) { r.dispose(); return; }   // (out of sight with the gang: nobody sees him go)
    // the rope from his wrists to his ankles comes off (a short one stays round his wrists)
    person.root.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.radiusTop === 0.018) o.visible = false; });
    person.play('Idle', { fade: 0.3 });
    if (!ropeGeo) { ropeGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 6, 1).translate(0, 0.5, 0); ropeMat = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.9 }); }
    const wrists = new THREE.Mesh(ropeGeo, ropeMat); wrists.castShadow = false; scene.add(wrists);
    const p = person.root.position, door = W.places.sheriff ? W.places.sheriff.door : null;
    const k = { r, person, wrists, phase: 'rise', t: 0, x: p.x, z: p.z, h: 0, path: null, at: 0, fade: 1, q0: person.root.quaternion.clone(), y0: p.y };
    // the way: near town, round the buildings to the sheriff's door; else just toward town
    if (door && Math.hypot(door.x - p.x, door.z - p.z) < WAGONJOB.townNear) k.path = toDoor(p.x, p.z);
    const first = k.path && k.path.length > 1 ? k.path[1] : door || { x: p.x - 1, z: p.z };
    k.h = Math.atan2(first.x - p.x, first.z - p.z);
    walkers.push(k);
  }
  // the way to the sheriff's door: round the buildings to a spot a couple of metres straight out in front of it, then
  // square on to the foot of the steps (so he goes in at the door, not into the porch beside it)
  function toDoor(x, z) {
    const o = W.places.sheriff, door = o.door, dx = door.x - o.x, dz = door.z - o.z, n = Math.hypot(dx, dz) || 1;
    const fx = door.x + (dx / n) * WAGONJOB.lineUp, fz = door.z + (dz / n) * WAGONJOB.lineUp;
    const path = W.blocked(fx, fz) ? null : wayRound(x, z, fx, fz);
    if (!path) return wayRound(x, z, door.x, door.z);
    path.push({ x: door.x, z: door.z });
    return path;
  }
  // a way on foot from (ax, az) to (bx, bz) that keeps out of the buildings, fences and trees (W.blocked): the
  // shortest on a 1 m grid round them, then straightened wherever a straight line is clear. null if there is none
  function wayRound(ax, az, bx, bz) {
    const pad = 30, x0 = Math.min(ax, bx) - pad, z0 = Math.min(az, bz) - pad, nx = Math.ceil(Math.abs(ax - bx) + 2 * pad), nz = Math.ceil(Math.abs(az - bz) + 2 * pad);
    if (nx * nz > 250000) return null;
    const idx = (i, j) => j * nx + i, cx = (i) => x0 + i + 0.5, cz = (j) => z0 + j + 0.5;
    const free = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) free[idx(i, j)] = W.blocked(cx(i), cz(j)) || inWagons(cx(i), cz(j), 0.4) ? 0 : 1;
    const si = Math.floor(ax - x0), sj = Math.floor(az - z0), gi = Math.floor(bx - x0), gj = Math.floor(bz - z0);
    free[idx(si, sj)] = 1; free[idx(gi, gj)] = 1;
    const g = new Float32Array(nx * nz).fill(Infinity), from = new Int32Array(nx * nz).fill(-1), shut = new Uint8Array(nx * nz);
    const open = [[0, idx(si, sj)]]; g[idx(si, sj)] = 0;
    const hz = (n) => Math.hypot((n % nx) - gi, Math.floor(n / nx) - gj);
    const push = (f, n) => { open.push([f, n]); let c = open.length - 1; while (c > 0) { const pa = (c - 1) >> 1; if (open[pa][0] <= open[c][0]) break; [open[pa], open[c]] = [open[c], open[pa]]; c = pa; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, rr = l + 1; let m = c; if (l < open.length && open[l][0] < open[m][0]) m = l; if (rr < open.length && open[rr][0] < open[m][0]) m = rr; if (m === c) break; [open[m], open[c]] = [open[c], open[m]]; c = m; } } return top; };
    const goal = idx(gi, gj);
    let found = false;
    while (open.length) {
      const [, n] = pop(); if (shut[n]) continue; shut[n] = 1;
      if (n === goal) { found = true; break; }
      const i = n % nx, j = Math.floor(n / nx);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const m = idx(a, b); if (!free[m] || shut[m]) continue;
        if (di && dj && (!free[idx(i + di, j)] || !free[idx(i, j + dj)])) continue;   // (no cutting a corner)
        const ng = g[n] + (di && dj ? 1.4142 : 1); if (ng >= g[m]) continue;
        g[m] = ng; from[m] = n; push(ng + hz(m), m);
      }
    }
    if (!found) return null;
    const cells = []; for (let n = goal; n >= 0; n = from[n]) cells.push(n);
    cells.reverse();
    const pts = cells.map((n) => ({ x: cx(n % nx), z: cz(Math.floor(n / nx)) }));
    pts[0] = { x: ax, z: az }; pts[pts.length - 1] = { x: bx, z: bz };
    const clear = (p, q) => { const L = Math.hypot(q.x - p.x, q.z - p.z); for (let t = 0; t <= L; t += 0.4) { const f = t / (L || 1), x = p.x + (q.x - p.x) * f, z = p.z + (q.z - p.z) * f; if (W.blocked(x, z) || inWagons(x, z, 0.4)) return false; } return true; };
    const out = [pts[0]];
    for (let a = 0; a < pts.length - 1;) {
      let b = pts.length - 1; while (b > a + 1 && !clear(pts[a], pts[b])) b--;
      out.push(pts[b]); a = b;
    }
    return out;
  }
  // each frame: getting up, walking his way, in at the door (false: he is gone)
  function walkStep(k, dt) {
    const { person, r } = k;
    k.t += dt;
    const door = W.places.sheriff && W.places.sheriff.door, office = W.places.sheriff;
    let v = 0;
    if (k.phase === 'rise') {
      // up onto his feet, turning to face the way he will go (pivoting on his feet, where the lying body's root is)
      const f = Math.min(1, k.t / WAGONJOB.rise), e = f * f * (3 - 2 * f);
      _wq.setFromEuler(_we.set(0, k.h, 0));
      person.root.quaternion.slerpQuaternions(k.q0, _wq, e);
      person.root.position.set(k.x, k.y0 + (W.heightAt(k.x, k.z) - k.y0) * e, k.z);
      person.update(dt);
      tiePose(person, 1 - e, LEGS);
      if (f >= 1) { k.phase = k.path ? 'town' : 'away'; k.at = 1; person.play('Walk', { fade: 0.3, speed: WAGONJOB.walk / ((person.stride && person.stride.Walk) || 1.4) }); }
    } else {
      let goal = null;
      if (k.phase === 'town') {
        goal = k.path[k.at];
        if (Math.hypot(goal.x - k.x, goal.z - k.z) < 0.6) { k.at++; if (k.at >= k.path.length) { k.phase = 'in'; k.inFrom = { x: k.x, z: k.z }; } goal = k.path[Math.min(k.at, k.path.length - 1)]; }
      }
      if (k.phase === 'in') {
        // up the steps and in at the door, fading out
        goal = { x: door.x + (office.x - door.x) * 0.5, z: door.z + (office.z - door.z) * 0.5 };
        const gone = Math.hypot(k.x - k.inFrom.x, k.z - k.inFrom.z) / WAGONJOB.fadeIn;
        k.fade = Math.max(0, 1 - gone);
        if (k.fade <= 0) return false;
      }
      if (k.phase === 'away') {
        // toward town (the sheriff's door), round anything in the way; gone once well out of the player's sight
        goal = door || { x: 0, z: 0 };
        const far = Math.hypot(k.x - P.position.x, k.z - P.position.z);
        if (far > WAGONJOB.goneFar && !inViewAt(k.x, k.z)) return false;
        if (far > WAGONJOB.goneAnyway) { k.fade -= dt; if (k.fade <= 0) return false; }
        if (door && k.t >= (k.retry || 0) && Math.hypot(door.x - k.x, door.z - k.z) < WAGONJOB.townNear * 0.8) {   // (walked near enough: the way round to the door)
          const path = toDoor(k.x, k.z); if (path) { k.path = path; k.at = 1; k.phase = 'town'; k.stall = 0; }
          else k.retry = k.t + 3;   // (no way round just now: walk on and look again in a while, not every frame)
        }
      }
      // turn toward the goal (stepping round what blocks the way straight there) and walk; stop for the player
      let want = Math.atan2(goal.x - k.x, goal.z - k.z);
      if (k.phase === 'away') for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) { const a = want + off; if (!W.blocked(k.x + Math.sin(a) * 1.5, k.z + Math.cos(a) * 1.5)) { want = a; break; } }
      const turn = Math.atan2(Math.sin(want - k.h), Math.cos(want - k.h));
      k.h += Math.max(-3 * dt, Math.min(3 * dt, turn));
      v = Math.abs(turn) > 1.2 ? WAGONJOB.walk * 0.3 : WAGONJOB.walk;
      const ahead = Math.hypot(P.position.x - (k.x + Math.sin(k.h) * 0.9), P.position.z - (k.z + Math.cos(k.h) * 0.9));
      // a wagon in his way: one rolling by, he waits for; one standing still (parked, or standing for good) he goes
      // round, sidestepping it out here, or by a fresh way round it in town
      const G = wagonAt(k.x + Math.sin(k.h) * 0.8, k.z + Math.cos(k.h) * 0.8, 0.3);
      const still = G && (G.standing || G.pace < 0.05);
      if (still && k.phase === 'away') {
        for (const off of [0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) { const a = k.h + off; if (!W.blocked(k.x + Math.sin(a) * 1.5, k.z + Math.cos(a) * 1.5) && !inWagons(k.x + Math.sin(a) * 1.5, k.z + Math.cos(a) * 1.5, 0.3)) { k.h += Math.max(-3 * dt, Math.min(3 * dt, off)); break; } }
      }
      if (ahead < (P.onHorse ? 1.6 : 0.9) || G) v = 0;
      // in town, stuck a while (a wagon parked across his way, or the player): a fresh way round from here; stuck
      // much longer, he slips off out of the way and is gone (he never stands about for good)
      if (k.phase === 'town') {
        k.stall = v > 0 ? Math.max(0, (k.stall || 0) - dt) : (k.stall || 0) + dt;
        if (k.stall > WAGONJOB.stuckRetry && !k.retried && door) {
          k.retried = true;
          const path = toDoor(k.x, k.z); if (path) { k.path = path; k.at = 1; }
        }
        if (k.stall > WAGONJOB.stuckGone) k.leaving = true;
        if (k.leaving) { k.fade -= dt; if (k.fade <= 0) return false; }
        if (v > 0 && k.stall < 0.5) k.retried = false;
      }
      k.x += Math.sin(k.h) * v * dt; k.z += Math.cos(k.h) * v * dt;
      person.root.position.set(k.x, W.heightAt(k.x, k.z), k.z);
      person.root.rotation.set(0, k.h, 0);
      if (person.person && person.person.cur) person.person.cur.setEffectiveTimeScale(v > 0 ? v / ((person.stride && person.stride.Walk) || 1.4) : 0.3);
      person.update(dt);
    }
    // the hands tied behind him: each arm pointed where WAGONJOB.hands says, in his own frame (whatever the clip did)
    person.root.updateMatrixWorld(true);
    person.root.getWorldQuaternion(_wq);
    _fw.set(0, 0, 1).applyQuaternion(_wq); _lf.set(1, 0, 0).applyQuaternion(_wq); _upw.set(0, 1, 0).applyQuaternion(_wq);
    const A = WAGONJOB.hands.arm, F = WAGONJOB.hands.fore;
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      const ua = person.bones['UpperArm' + s], la = person.bones['LowerArm' + s];
      if (!ua || !la) continue;
      pointBone(ua, _dir.copy(_upw).negate().addScaledVector(_fw, -A.back).addScaledVector(_lf, sg * A.out));
      pointBone(la, _dir.copy(_lf).multiplyScalar(-sg * F.across).addScaledVector(_fw, -F.back).addScaledVector(_upw, F.up));
    }
    // the short rope round his wrists
    const b = person.bones;
    if (b.WristL && b.WristR) {
      person.root.updateMatrixWorld(true);
      b.WristL.getWorldPosition(_wv); b.WristR.getWorldPosition(_wv2);
      const len = _wv.distanceTo(_wv2);
      k.wrists.position.copy(_wv); k.wrists.scale.set(1, Math.max(0.05, len), 1);
      k.wrists.quaternion.setFromUnitVectors(_up, _wv2.sub(_wv).normalize());
    }
    if (k.fade < 1) fadeTo(k, k.fade);
    return true;
  }
  // a bone turned so that it points (its +y, along it to its child) along the world direction `dir`
  const _fw = new THREE.Vector3(), _lf = new THREE.Vector3(), _upw = new THREE.Vector3(), _dir = new THREE.Vector3(), _by = new THREE.Vector3();
  const _bq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _tq = new THREE.Quaternion();
  function pointBone(bone, dir) {
    dir.normalize();
    bone.getWorldQuaternion(_bq);
    _by.set(0, 1, 0).applyQuaternion(_bq);
    _tq.setFromUnitVectors(_by, dir).multiply(_bq);   // (its turn in the world, then into its parent's)
    bone.parent.getWorldQuaternion(_pq);
    bone.quaternion.copy(_pq.invert().multiply(_tq));
    bone.updateMatrixWorld(true);
  }
  // fading out: every part of him see-through by the same amount
  function fadeTo(k, a) {
    if (!k.mats) { k.mats = []; k.person.root.traverse((o) => { if (o.isMesh && o.material) for (const m of [].concat(o.material)) if (!k.mats.includes(m)) { m.transparent = true; m.needsUpdate = true; k.mats.push(m); } }); }
    for (const m of k.mats) m.opacity = a;
    k.wrists.visible = a > 0.5;
  }
  const _ivp = new THREE.Vector3();
  function inViewAt(x, z) {
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    return _fr.containsPoint(_ivp.set(x, W.heightAt(x, z) + 1, z));
  }
  function endWalk(k) {
    const i = walkers.indexOf(k); if (i >= 0) walkers.splice(i, 1);
    k.wrists.removeFromParent();
    k.r.dispose();
  }

  // the bandits roped in a wave go on the rider's count once, whether the wave finished or was cut short
  function bankCaught(w, delay = 0) {
    const n = w ? w.caught - (w.counted || 0) : 0; if (n <= 0) return null;
    w.counted = w.caught;
    const cj = countJob(rider, 'bandits', n);
    hud.buckle(cj.buckle, { delay });
    return cj;
  }

  function waveDone() {
    const w = wave; if (!w || w.done) return;
    w.done = true;
    endHelp(); hint(null); hideRail();
    const T = w.T, lv = T.level();
    // the bandits are brought in (each roped one walks himself to the sheriff's office: see OFF TO THE SHERIFF)
    bankCaught(w, 2600);
    rider.lockboxes = rider.lockboxes || [];
    const tier = boxTier(rider);
    rider.lockboxes.push({ tier, from: 'loot' });
    // the wagon's speed dial: never raised together with the math
    const d = dial(), was = d.speed;
    d.speed = nextSpeed(d.speed, { misses: w.misses, stepUp: lv.step > w.stepBefore, newTable: lv.tables.length > w.tablesBefore, top: WAGONJOB.speeds.length - 1 });
    saveRider(rider);
    const e = earn(rider, WAGONJOB.pay.wave);
    hud.toast(`The wagon's safe! ${w.caught} bandit${w.caught === 1 ? '' : 's'} brought in. +${WAGONJOB.pay.wave} gold and the gang's ${TIER_NAME[tier].toLowerCase().replace('lockbox', 'lock box')}`, 'gold');
    if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 2400);
    if (d.speed !== was) setTimeout(() => hud.toast(d.speed > was ? 'The team picks up the pace' : 'The team slows to an easier pace'), 4200);
    refresh();
    hob.event('banditsDone', { n: w.caught });
    // the townsfolk ride on ahead
    for (const rec of recs) if (rec.wave === w && free(rec)) { rec.state = 'leave'; setNumber(rec, null); }
    if (music) music.action(false);
    nextWaveT = WAGONJOB.nextWave;
    showCard();
  }

  // ── THE RAIL ───────────────────────────────────────────────────────────────────────────────────────────────────
  const rail = makeRail(); scene.add(rail.sprite);
  let railT = 0; const railAt = new THREE.Vector3();
  function showRail(skip, anchor) {
    if (!skip || !skip.length) return;
    rail.draw(skip, anchor);
    railT = WAGONJOB.hintFor; rail.sprite.visible = true;
  }
  // the rail hangs over the ground a little ahead of the player, straight ahead of the camera (so it is in the middle of
  // the view even on a narrow phone screen), at the height that puts it just under the cards at the top (the rule card,
  // the line under it, the chart's Peek button): so it is read straight after them
  const _rv = new THREE.Vector3(), _cf = new THREE.Vector3();
  function placeRail(pxTall) {
    camera.getWorldDirection(_cf); _cf.y = 0; if (_cf.lengthSq() < 1e-6) _cf.set(0, 0, 1); _cf.normalize();
    const h = canvas.clientHeight || innerHeight;
    let below = 0;
    for (const el of [hud.jobEl, offer && offer.el]) { if (!el || !el.isConnected) continue; const r = el.getBoundingClientRect(); if (r.height) below = Math.max(below, r.bottom); }
    const bottomPx = Math.min(h * 0.8, Math.max(h * RAIL.screenY, below + 12 + pxTall));   // (low on the screen, clear of the cards at the top)
    // in the camera's own space, a point's height on the screen is y / -z (times the lens): both change in a straight
    // line with the world height, so the height that lands it there is one division. When that would be under the
    // ground (a tall phone screen looking down), the rail comes nearer until it can hang there
    camera.updateMatrixWorld();
    const e = camera.matrixWorldInverse.elements, want = (1 - 2 * bottomPx / h) / camera.projectionMatrix.elements[5];
    const dy = e[5], dz = e[6], k = dy + want * dz;   // (how view y and view z change per metre of world height)
    for (const ahead of RAIL.ahead) {
      const x = P.position.x + _cf.x * ahead, z = P.position.z + _cf.z * ahead, g = W.heightAt(x, z);
      _rv.set(x, g, z).applyMatrix4(camera.matrixWorldInverse);
      const up = Math.abs(k) > 1e-6 ? (-want * _rv.z - _rv.y) / k : 2;
      railAt.set(x, g + Math.max(RAIL.low, Math.min(RAIL.high, up)), z);
      if (up >= RAIL.low) break;
    }
  }
  function hideRail() { railT = Math.min(railT, 0.4); }

  // ── STARTING AND STOPPING ──────────────────────────────────────────────────────────────────────────────────────
  WJ.start = () => {
    if (!kit || state === 'on') return false;
    state = 'on'; WJ.on = true; s = s || 0;
    nextWaveT = WAGONJOB.firstWave;
    hob.event('wagonArrive');
    showCard();
    return true;
  };
  // (away: the player rode off well clear of the wagon: a quiet toast, no word from Hob)
  WJ.stop = ({ away = false } = {}) => {
    if (state !== 'on') return;
    state = 'stopped'; WJ.on = false;
    endHelp(); hint(null); hideRail(); unsee();
    if (P.lassoBusy && curTarget) P.cancelLasso();
    for (const rec of recs) if (free(rec)) { rec.state = 'leave'; setNumber(rec, null); }
    bankCaught(wave);   // (bandits roped before stopping still count)
    wave = null; WJ.wave = null; nextWaveT = -1;
    if (music) music.action(false);
    if (away) { hud.toast('The wagon will wait for you'); if (!quiet()) hud.rule(null); }
    else { hud.toast('The wagon will wait here for you.'); hob.event('wagonStop'); }
    showCard();
  };
  WJ.newWave = () => { if (state !== 'on') WJ.start(); newWave(); };
  // (dev and rigs) a bandit pulled down and tied at (x, z) now, as if roped there: he gets up and walks off as any does
  WJ.tieAt = (x, z) => {
    if (!kit) return false;
    const r = makeRider(kit, { W, folk, scene });
    r.place(x, z, 0);
    const rec = { r, person: r.person, label: r.label, slot: 0, state: 'caught', n: 12, text: '12', good: true, trap: null, alpha: 0, lift: 0, say: 0,
      fact: '12 = 2 × 6', dev: true, also: [r.horse.root], tgt: { root: r.person.root, neck: (o) => r.neck(o), neckRadius: 0.13, height: 2.4 } };
    recs.push(rec);
    r.fall({ x: x + 3, z }, { onDown: () => downed(rec, { table: 6, kind: 'rule', done: true }) });
    return true;
  };
  WJ.where = () => (wagon ? { x: wagon.pos.x, z: wagon.pos.z } : (road.at(0, qw), { x: qw.x, z: qw.z }));

  // ── PICKS ──────────────────────────────────────────────────────────────────────────────────────────────────────
  let hintAt = -1e9;
  const offPick = I.onPick((p) => {
    if (WJ.paused || !WJ.near || !wave || wave.done || state !== 'on') return;
    const t = p.touch ? R.pick(p.x, p.y) : R.click(p.x, p.y);
    if (t) { WJ.throwAt(t); return; }
    // a tap on no rider still answers: a ripple where the finger was, and now and then a word on what to tap
    if (p.touch) tapRipple(p.x, p.y);
    if (R.target && !P.lassoBusy && performance.now() - hintAt > 5000) { hintAt = performance.now(); hud.toast(p.touch ? 'Tap a rider or his number to rope him (or press Rope)' : 'Point at a rider to rope them (or press F)'); }
  });

  // ── THE CARDS AT THE TOP OVER THE RIDERS' NUMBERS ─────────────────────────────────────────────────────────────
  // riders round the wagon sit high in the view, where the rule card, the line under it and the Peek button are: any of
  // those over a rider's number card fades nearly away (and lets clicks and taps through to the rider), so the number
  // can always be read and roped. The line under the card (why that pick was wrong) fades only for the ringed rider's
  // number: it is the lesson, and the rail and Old Hob say it again
  ensureWagonCss();
  let seeT = 0;
  const seen = new Set(), cr = canvas.getBoundingClientRect();
  function seeThrough() {
    const els = [hud.ruleEl, hud.hintEl, offer && offer.el];
    const on = WJ.near && state === 'on' && wave && !wave.done && !WJ.paused;
    const c = on ? canvas.getBoundingClientRect() : cr;
    for (const el of els) {
      if (!el) continue;
      let over = false;
      if (on && !el.hidden && el.isConnected) {
        const b = el.getBoundingClientRect();
        if (b.width) for (const q of rects) {
          if (el === hud.hintEl && q.rec !== R.target) continue;
          if (q.x1 + c.left > b.left - 4 && q.x0 + c.left < b.right + 4 && q.y1 + c.top > b.top - 4 && q.y0 + c.top < b.bottom + 4) { over = true; break; }
        }
      }
      el.classList.toggle('wj-see', over);
      if (over) seen.add(el); else seen.delete(el);
    }
  }
  function unsee() { for (const el of seen) el.classList.remove('wj-see'); seen.clear(); }

  function tapRipple(x, y) {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;border:3px solid rgba(255,248,225,.9);` +
      'box-shadow:0 0 6px rgba(0,0,0,.45);pointer-events:none;z-index:40;transition:transform .35s ease-out,opacity .35s ease-out;transform:scale(.4);opacity:1';
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = 'scale(1.15)'; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 420);
  }

  // ── THE SOUND ──────────────────────────────────────────────────────────────────────────────────────────────────
  // the action music: made the first time it is needed; it stops (letting its notes go) when the sound sleeps (a
  // pause, a panel, a hidden tab) and starts afresh on the next bar when it wakes
  let music = null, bus = null;
  function sound() {
    if (!audio) return;
    const want = state === 'on' && WJ.near;
    audio.need('action', want);
    if (!want) { if (music) { music.stop(); music = WJ.music = null; } return; }
    if (!audio.ctx) return;
    if (!bus) {
      const ctx = audio.ctx, g = ctx.createGain(); g.gain.value = 1; g.connect(audio.out);
      bus = { ctx, g, onState: () => { if (ctx.state !== 'running' && music) { music.stop({ now: true }); music = WJ.music = null; } } };
      ctx.addEventListener('statechange', bus.onState);
    }
    if (!music && audio.running) {
      music = WJ.music = makeActionMusic(bus.ctx, { out: bus.g, seed: 1 + Math.floor(Math.random() * 1e6) });
      music.start(bus.ctx.currentTime + 0.15, { action: !!(wave && !wave.done) });
    }
  }

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  const camFwd = new THREE.Vector3(), lp = new THREE.Vector3();
  let wasNear = false, cardT = 0, rumble = null;
  const qUp = {};
  WJ.update = (dt) => {
    time += dt;
    if (!kit || !wagon) return;
    const wp = wagon.pos, dW = Math.hypot(P.position.x - wp.x, P.position.z - wp.z);
    WJ.near = dW < WAGONJOB.near;
    if (state === 'waiting' && dW < WAGONJOB.startNear) WJ.start();
    // (rode away: the job ends, nothing lost; riding on up the road ahead of the wagon is still riding with it, so that
    // is given much more room)
    let up = (P.position.x - wp.x) * Math.sin(wagon.heading) + (P.position.z - wp.z) * Math.cos(wagon.heading) > 0;
    if (state === 'on' && !up && dW > WAGONJOB.leave) {
      // (straight ahead soon isn't ahead on a road that bends round: up the road counts by the road's own measure)
      const ps = road.nearest(P.position.x, P.position.z), g = road.gap(s, ps); road.at(ps, qUp);
      up = g > 0 && g < WAGONJOB.leaveAhead && Math.hypot(P.position.x - qUp.x, P.position.z - qUp.z) < WAGONJOB.roadNear;
    }
    if (state === 'on' && dW > (up ? WAGONJOB.leaveAhead : WAGONJOB.leave)) WJ.stop({ away: true });
    if (state === 'stopped' && dW > WAGONJOB.near) { state = 'waiting'; showCard(); }
    if (WJ.near !== wasNear) {
      wasNear = WJ.near;
      if (WJ.near) {
        // back with the wagon after the round-up dealt its own wave: a fresh gang
        if (state === 'on' && wave && !wave.done && !ownsTrainer()) newWave();
        startHelp();
      } else { endHelp(); unsee(); hud.hint(null); hud.rule(null); }
      showCard();
    } else if ((cardT -= dt) <= 0) { cardT = 1; if (!WJ.near && state === 'on' && !quiet()) showCard(); }
    if (hintT > 0 && (hintT -= dt) <= 0) hint(null);

    // the wagon: rolls on at its dial's speed, slowing to wait when the player falls well behind
    let want = 0;
    if (state === 'on') {
      const ahead = (wp.x - P.position.x) * Math.sin(wagon.heading) + (wp.z - P.position.z) * Math.cos(wagon.heading);
      want = dW < WAGONJOB.wait || ahead < 0 ? WAGONJOB.speeds[dial().speed] : 0;
    }
    wagon.update(dt, want);
    s = wagon.s; v = wagon.v;
    // its rumble, creaks and hooves, as the town's traffic wagons have (src/audio/wagonsound.js: quiet far off)
    if (audio && wagon.wagon) { if (!rumble) rumble = makeWagonSound(audio, wagon.wagon); rumble.update(dt, camera.position); }

    if (state === 'on' && nextWaveT > 0 && (nextWaveT -= dt) <= 0) { if (WJ.near) newWave(); else nextWaveT = 0.5; }

    if (I.enabled && P.enabled && WJ.near && state === 'on' && (I.tap('KeyF') || (!P.onHorse && I.tap('Space')))) WJ.throwAt(R.target);

    // (far off, the gang waits out of sight: nothing of it is drawn or moved until the player comes back)
    const away = dW > WAGONJOB.farOff;
    if (away !== WJ.away) { WJ.away = away; for (const rec of recs) rec.r.show(!away); }
    for (let i = recs.length - 1; i >= 0; i--) { const rec = recs[i]; if (away && !rec.dev) continue; if (rec.r.mode !== 'down' && rec.r.mode !== 'fall') riderStep(rec, dt); else rec.r.update(dt); }
    for (let i = downs.length - 1; i >= 0; i--) {
      const d = downs[i], far = Math.hypot(d.at.x - P.position.x, d.at.z - P.position.z);
      if (d.factT > 0) d.factT -= dt;
      d.t += dt;
      if (d.rec && d.t >= WAGONJOB.getUp && d.factT <= 0 && d.rec.r.horseGone()) getUp(d);
      if (far > WAGONJOB.leaveDown && (d.wave.done || d.wave !== wave)) removeDown(d);
    }
    for (let i = walkers.length - 1; i >= 0; i--) if (!walkStep(walkers[i], dt)) endWalk(walkers[i]);
    labels(dt);
    // the rail
    if (railT > 0) {
      railT -= dt;
      const S = rail.sprite, a = Math.min(1, railT / 0.6, (WAGONJOB.hintFor - railT) / 0.3);
      S.material.opacity = Math.max(0, a) * RAIL.see; S.visible = a > 0.01;
      const h = canvas.clientHeight || innerHeight, w = canvas.clientWidth || innerWidth;
      const tall = Math.min(120, Math.min(w * 0.86, 820) * 150 / 1024 / Math.max(0.3, S.userData.wide || 1));   // (the plank at most 86% of a narrow screen wide)
      placeRail(tall); S.position.copy(railAt);
      camera.getWorldDirection(camFwd);
      const depth = Math.max(1, lp.copy(railAt).sub(camera.position).dot(camFwd));
      const hw = tall * depth / (camera.projectionMatrix.elements[5] * h) * 2;
      S.scale.set(hw * 1024 / 150, hw, 1);
      if (railT <= 0) S.visible = false;
    }
    if (offer && (offerT -= dt) <= 0) { offerT = 0.25; placeOffer(); }
    if ((seeT -= dt) <= 0) { seeT = 0.1; seeThrough(); }
    R.update(dt, { targets: WJ.near && state === 'on' ? recs : [], player: P, can: ropeable, hold: P.lassoBusy, busy: P.lasso.busy });
    sound();
  };

  // the number cards over the riders (and the fact cards over the hogtied), the same size on screen near or far
  function labels(dt) {
    const h = canvas.clientHeight || innerHeight, px = Math.max(WAGONJOB.labelPx[0], Math.min(WAGONJOB.labelPx[1], h * 0.06));
    const p5 = camera.projectionMatrix.elements[5];
    camera.getWorldDirection(camFwd);
    const size = (L, at, k = 1) => {
      L.position.copy(at);
      const depth = Math.max(0.5, lp.copy(at).sub(camera.position).dot(camFwd)), hw = px * k * 2 * depth / (p5 * h);
      L.scale.set(hw * RIDERS.card[0] / RIDERS.card[1], hw, 1);
      L.userData.depth = depth; L.userData.perPx = hw / (px * k);
    };
    for (const rec of recs) {
      const L = rec.label, r = rec.r;
      if (rec.say > 0 && (rec.say -= dt) <= 0) { rec.say = 0; setNumber(rec, rec.n != null ? { n: rec.n, good: rec.good, trap: rec.trap } : null); }
      const shown = rec.say > 0 || (rec.n != null && (rec.state === 'ride' || rec.state === 'arrive' || rec.state === 'throw' || rec.state === 'away') && r.mode === 'ride' && wave && !wave.done && rec.wave === wave);
      const dist = Math.hypot(r.x - P.position.x, r.z - P.position.z);
      const fadeK = 1 - Math.max(0, Math.min(1, (dist - WAGONJOB.labelFull) / (WAGONJOB.labelGone - WAGONJOB.labelFull)));
      rec.alpha += ((shown && WJ.near ? fadeK : 0) - rec.alpha) * Math.min(1, dt * 6);
      L.visible = rec.alpha > 0.02;
      if (!L.visible) continue;
      size(L, lp.set(r.x, r.top(), r.z).clone());
      L.material.opacity = rec.alpha;
    }
    for (const d of downs) {
      const a = Math.max(0, Math.min(1, d.factT / 0.6));
      d.fact.visible = a > 0.01; if (!d.fact.visible) continue;
      size(d.fact, lp.set(d.at.x, d.at.y + 1.3, d.at.z).clone(), 0.85); d.fact.material.opacity = a;
    }
    unstack(px, h, dt);
  }
  const stackV = new THREE.Vector3(), rects = [];
  function unstack(px, h, dt) {
    const w = canvas.clientWidth || innerWidth, list = [];
    camera.updateMatrixWorld();
    for (const rec of recs) {
      const L = rec.label;
      if (!L.visible) { rec.lift = 0; continue; }
      stackV.copy(L.position).project(camera);
      if (stackV.z > 1) continue;
      list.push({ rec, x: (stackV.x + 1) / 2 * w, y: (1 - stackV.y) / 2 * h, cw: px * (RIDERS.card[0] / RIDERS.card[1]) * (L.userData.wide || 1), d: L.userData.depth });
    }
    list.sort((a, b) => a.d - b.d);
    rects.length = 0;
    const g = WAGONJOB.stackGap;
    for (const it of list) {
      let bottom = it.y, moved = true, n = 0;
      while (moved && n++ < 12) {
        moved = false;
        for (const r of rects) {
          if (it.x + it.cw / 2 + g <= r.x0 || it.x - it.cw / 2 - g >= r.x1) continue;
          if (bottom - px - g >= r.y1 || bottom + g <= r.y0) continue;
          bottom = r.y0 - g; moved = true;
        }
      }
      rects.push({ x0: it.x - it.cw / 2, x1: it.x + it.cw / 2, y0: bottom - px, y1: bottom, rec: it.rec });
      const want = (it.y - bottom) * it.rec.label.userData.perPx;
      it.rec.lift = (it.rec.lift || 0) + (want - (it.rec.lift || 0)) * Math.min(1, dt * 10);
      it.rec.label.position.y += it.rec.lift;
    }
  }

  let paused = false;
  Object.defineProperty(WJ, 'paused', {
    get() { return paused; },
    set(on) { paused = !!on; R.visible = !paused; if (paused) endHelp(); else if (WJ.near) startHelp(); },
  });
  WJ.ring = R;
  WJ.road = road;
  // the wagon itself (src/wagon.js's: its driver gets down while it waits, src/jobfolk.js), or null for the stand-in;
  // and the job's state: 'loading' | 'waiting' | 'on' | 'stopped'
  Object.defineProperty(WJ, 'rig', { get: () => (wagon && wagon.wagon) || null });
  Object.defineProperty(WJ, 'phase', { get: () => state });
  WJ.state = () => ({
    state, on: WJ.on, near: WJ.near, loaded: !!kit, s: +s.toFixed(1), speed: +v.toFixed(2), notch: dial().speed,
    wagon: wagon ? { x: +wagon.pos.x.toFixed(1), z: +wagon.pos.z.toFixed(1), real: !wagon.root } : null,
    wave: wave && { n: waveN, table: wave.table, kind: wave.kind, rule: wave.kind === 'missing' ? wave.w.rule : `The ${wave.table}-Gang`, goods: wave.goods, caught: wave.caught, misses: wave.misses, done: !!wave.done },
    riders: recs.map((x) => ({ n: x.n, good: x.good, state: x.state, mode: x.r.mode, x: +x.r.x.toFixed(1), z: +x.r.z.toFixed(1), speed: +x.r.speed.toFixed(2), clip: x.r.horse.clip, label: x.label.visible })),
    downs: downs.length, walkers: walkers.map((k) => ({ phase: k.phase, x: +k.x.toFixed(1), z: +k.z.toFixed(1), fade: +k.fade.toFixed(2), path: k.path ? k.path.length : 0 })),
    music: music ? music.state() : null, rail: railT > 0, sound: rumble ? rumble.state() : null,
  });
  WJ.dispose = () => {
    disposed = true;
    if (wave && !wave.done) bankCaught(wave);   // (leaving the ride mid-gang: its roped bandits still count)
    offPick(); endHelp(); unsee(); if (WJ.near) { hud.rule(null); hud.hint(null); }
    for (const rec of [...recs]) removeRec(rec);
    for (const d of [...downs]) removeDown(d);
    for (const k of [...walkers]) endWalk(k);
    if (ropeGeo) { ropeGeo.dispose(); ropeMat.dispose(); ropeGeo = ropeMat = null; }   // (the walkers' wrist ropes)
    if (rumble) { rumble.dispose(); rumble = null; }
    if (wagon) wagon.dispose();
    rail.dispose(); R.dispose();
    if (music) music.stop({ now: true });
    if (audio) audio.need('action', false);
    if (bus) { bus.ctx.removeEventListener('statechange', bus.onState); const g = bus.g; g.gain.setTargetAtTime(0, bus.ctx.currentTime, 0.05); setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 400); bus = null; }
  };
  return WJ;
}
