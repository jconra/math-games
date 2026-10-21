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
// THE TRIP (A to B): the wagon sets off from one end of its road for the other (src/missions/wagonplan.js TRIP), the
// gangs riding in on the way. Safely past the far end's mark, with no gang about, it pulls up: the driver thanks the
// player (the job folk's thank-you: Hob's 'banditsDone') and pays a little, and the job rests there (a word with the
// driver, or riding off and coming back, starts the next trip, on round to the other end).
// HOLD-UPS on the long roads: out on the road through the valley, well away from the town, now and then a gang jumps a
// travelling wagon of the town's traffic (src/traffic.js T.holdUp): the riders ride in from out of sight, the wagon
// pulls up and its driver shouts "Help!" (a bubble, src/ui/howdy.js, with a place for a recorded clip: AMBUSH.helpClips),
// and the player rides over and ropes 3 to 5 of the gang, the same way as at the job's wagon (the same gang, numbers
// and help, at the rider's own level). Then the rest ride off, the driver thanks the player and pays a little (the coin
// jingle and a recorded thank-you), and the wagon drives on the way it was going. A player who doesn't come (or rides
// far off): after a while the driver makes a run for it, nothing lost. "Protect the wagon" turned off for the rider:
// no job and no hold-ups (main.js makes none of this).
//
// THE MATH HERE: ODDS AND EVENS, THEN THE TIMES TABLES, THEN MISSING FACTORS (src/levels/place/wagon.js is the
// ladder). The rider's level in this place (src/levels/model.js levelFor, asked before each gang) says which gang
// rides: "Rope the evens" (src/math/parity.js: the gang wears the even numbers, the townsfolk the odd ones), "The
// 7-Gang" (the times trainer the round-up's herds use, src/math/times.js, shared through `times`, told the table), or
// "7 × ? = 56" (the same trainer, told the fact: src/math/facts.js picks it, red facts first). Each gang level brings
// one new table; once placed, every third gang is an earlier table (the weak ones more), recorded at that table's own
// level. Every rope is an answer at its gang's level (save.js recordAnswer: a travel job, no time), and every times
// fact roped goes to the times chart (facts.js recordFact). The help: the times chart's Peek and the skip-count rail
// for a times gang; for odds and evens, the rail of evens (or odds) round the pick, the number dealt into two rows
// (src/ui/groups.js: pairs, one left over or not), and the rule of thumb when stuck. Two separate dials, never raised
// together: the math (the rider's level), and the wagon's speed (WAGONJOB.speeds): up a notch after a clean wave that
// didn't move the math, down after a rough one, and back to a walk whenever a new table opens.
//
//   const WJ = makeWagonJob({ W, folk, animals, P, I, camera, canvas, rider, hud, hob, audio, refresh, times, wagonLib, quiet, read,
//                             traffic, shouts })
//     traffic(): the town's traffic (src/traffic.js), whose wagons a gang holds up; shouts(): src/audio/shouts.js's
//     (a hold-up's coin jingle and the driver's recorded thank-you); either left out: no hold-ups / no sound
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
//   WJ.state()        for rigs: { on, near, wave, riders, wagon, speed, music, sound, trip }
//   WJ.music          the action music (or null)
//   WJ.dispose()
// WJ is the job's wagon's gang; while a hold-up is under way and the player is with it, near, wave, targets and music
// are the hold-up's (so main.js's "a question is up" and the cards standing aside cover it), where() is the held-up
// wagon while it calls for help, paused and update/dispose cover both.
//   WJ.ambush         the hold-up under way (a gang of the same shape as WJ: state(), targets, throwAt, ring ...), or null
//   WJ.ambushes       { state(), now() (dev and rigs: a hold-up at once on a wagon near enough, if one will do), hold
//                     (true: no new ones), cool (s till the next may come, out on the long roads) }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeAnimal, gaitFor } from '../actors/animals.js';
import { loadRiderKit, makeRider, makeCard, drawCard, RIDERS, TIE, tiePose } from '../actors/riders.js';
import { makeTimes } from '../math/times.js';
import { makeParity } from '../math/parity.js';
import { levelFor, stateOf } from '../levels/model.js';
import { PLACE } from '../levels/places.js';
import { recordFact } from '../math/facts.js';
import { readAloud } from '../math/skill.js';
import { sayLine } from '../audio/sayline.js';
import { playSlot } from '../audio/clipslots.js';
import { showGroups } from '../ui/groups.js';
import { watchHesitation as watchLine } from '../ui/numberline.js';
import { makeTargetRing } from '../targetring.js';
import { offerChart, closeChart, chartOptions, watchHesitation as watchChart, ensureChartCss } from '../ui/timeschart.js';
import { recordAnswer, earn, saveRider, countJob } from '../save.js';
import { PAY, boxTier } from '../shop.js';
import { TIER_NAME } from '../lockbox/index.js';
import { makeActionMusic } from '../audio/actionmusic.js';
import { loadWagons, makeWagon, inWagons, wagonAt, fadeAll, unfade } from '../wagon.js';
import { makeWagonSound } from '../audio/wagonsound.js';
import { clipExt } from '../audio/ambience.js';
import { howdy } from '../ui/howdy.js';
import { ROAD_POINTS, makeRoad, SLOTS, gangLine, sacksFor, nextSpeed, TRIP, tripLeft, makeOpenRoad, AMBUSH, gangSize, chooseGang, outOnRoad, ambushPick } from './wagonplan.js';
export { ROAD_POINTS, makeRoad, SLOTS, gangLine, sacksFor, nextSpeed };

export const WAGONJOB = {
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
  arriveBy: 30,           // seconds a rider riding in may take before, out of sight, it is brought in nearer
  arriveCheck: 6,         // ... and every this many seconds it must have closed 4 m on its spot, or it is brought in
  helpAfter: 8000,        // ms without a pick before the chart's Peek is offered
  hintFor: 12,            // seconds the "Not me, partner" line and the skip-count rail stay up
  hold: 1.1,              // seconds the rope stays on a roped bandit (he is pulled down meanwhile)
  fact: 6,                // seconds the fact card ("24 = 4 × 6") shows over a hogtied bandit
  leaveDown: 70,          // m behind the player a hogtied bandit's sacks are left (put away)
  // his sacks can be picked up: walk or ride over one (no stopping needed, a gallop does it) and it hops up into the
  // saddlebags with a clink, counting along over it (6, 12, 18, 24)
  sackGold: 1,            // gold for each sack picked up
  sackReach: 1.5,         // m from a sack that picks it up on foot ...
  sackReachHorse: 0.6,    // ... and this much further on a horse (it is a bigger animal than the rider)
  sackHop: 0.45,          // seconds a picked-up sack takes to hop up into the saddlebags
  sackTips: 2,            // times a ride the "he dropped his take" line is said (the first bandits roped)
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
  payEvery: 6,            // ... a bandit pays 1 gold more for every this many levels up the wagon's ladder
  // Old Hob's word after each gang seen off on the way (the driver's thank-you waits for the end of the trip)
  gangLines: ['That gang won\'t trouble this wagon again. Keep alongside, partner.', 'Fine riding. Eyes on the road.', 'More road ahead, and likely more trouble.'],
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

// A wagon of the town's traffic held up on the road (src/traffic.js): the job's wagon shape over it, read each frame.
// The traffic drives it (it stands while held up, then drives on); s is measured along the hold-up's own road, the
// way the wagon goes.
function makeHeldWagon({ t, road }) {
  const A = { s: 0, v: 0, pos: t.wg.pos.clone(), heading: t.wg.heading, wagon: t.wg };
  A.update = () => {
    const g = t.wg; if (!g) return;   // (put away once it has driven off far: where it was is kept)
    A.wagon = g; A.pos.copy(g.pos); A.heading = g.heading; A.v = g.pace;
    A.s = t.dir > 0 ? t.u : road.total - t.u;   // (road.total: the whole road's length; its points run the way t goes)
  };
  A.dispose = () => {};
  return A;
}

// ── SACKS: the bandit's take, dropped in a row by him, each painted with the table's number ───────────────────────────
let sackGeo = null;
const sackMats = new Map();
// the skip-count rail: metres ahead of the player (tried in turn: nearer only when it must, to sit low enough on a tall
// phone screen); where its bottom edge sits on the screen at the highest (a share of the screen's height down from the
// top; lower when the cards at the top reach further down); and how high off the ground it may hang (m)
let sackTipsSaid = 0;   // (the "he dropped his take" line: said the first WAGONJOB.sackTips times on a visit)
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
  // (a faint warm glow, pulsed each frame by the job, so they read as something to pick up)
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: 0xffc35a, emissiveMap: tex, emissiveIntensity: 0.2 });
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
/* (a card gang's card read aloud: its speaker at the row's right end, clear of the "Show me" button) */
.bmh-rule.is-gang.has-say { padding-right: 50px; }
.bmh-rule.is-gang .bmh-rule-say { top: 50%; transform: translateY(-50%); }
@media (pointer: coarse) { .bmh-rule.is-gang.has-say { padding-right: 56px; } }
@media (max-width: 480px) {
  /* (on a narrow phone the line goes on a row of its own under the card's question and "Show me": with a long question,
     "How many dots? ●●●●", it was squeezed into a column a word wide, and "Show me" was pushed under the speaker) */
  .bmh-rule.is-gang { gap: 2px 8px; padding: 4px 6px 4px 10px; flex-wrap: wrap; }
  .bmh-rule.is-gang .bmh-rule-sub { order: 3; flex: 1 0 100%; }
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

// ── ONE GANG ROUND ONE WAGON: the job's own wagon (kind 'job'), or a wagon of the traffic held up on the long roads
// (kind 'ambush'; hold: { T (the traffic), t (the traveller held up), road (makeOpenRoad, the way it goes), onEnd(how),
// howTo() (the first hold-up a ride: how it goes, from Old Hob), voice (the driver as a voice: shouts.js) })
function makeGang({ W, folk, animals, P, I, camera, canvas, rider, hud, hob, audio = null, refresh = () => {}, times = null, quiet = () => false, wagonLib = null, read = null, kind = 'job', hold = null }) {
  const ambush = kind === 'ambush';
  const scene = W.scene, road = ambush ? hold.road : makeRoad(ROAD_POINTS);
  const R = makeTargetRing({ scene, camera, canvas, W });
  ensureChartCss();
  const fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('700 84px Bitter').catch(() => null) : Promise.resolve();
  const WJ = { near: false, on: false, away: false, targets: [], tookTrainer: false, music: null };
  const recs = WJ.targets, downs = [];
  let kit = null, wagon = null, disposed = false;
  let s = 0, v = 0, time = 0, state = 'loading';   // state: 'loading' | 'waiting' | 'on' | 'stopped'
  let wave = null, waveN = 0, nextWaveT = -1, hintT = 0, offer = null, hes = null, sawLoop = false;
  const qw = {}, qs = {};
  // the job's trip (A to B): { left: m to the far end's mark, caught: bandits roped on the way }, or null; arrived:
  // pulled up at the end of one (the card says so till the next sets off)
  let trip = null, arrived = false;
  // a hold-up: met (the player has been with it), how it ended ('safe' | 'ran'), the "Help!" shouts' clock, the card's
  let met = false, ended = null, helpT = 0, doneT = 0, ownCard = null;

  // the shared times trainer (the round-up's), and the wagon's speed dial (saved with the rider)
  let ownT = null;
  const trainer = () => (times && times()) || ownT || (ownT = makeTimes(rider.topics.times || (rider.topics.times = {})));
  const dial = () => { rider.topics = rider.topics || {}; const d = rider.topics.wagon = rider.topics.wagon && typeof rider.topics.wagon === 'object' ? rider.topics.wagon : {}; d.speed = Math.max(0, Math.min(WAGONJOB.speeds.length - 1, d.speed | 0)); return d; };
  // the odds-and-evens gangs' trainer (the job's own: nothing in it is saved)
  let parityT = null;
  const parity = () => parityT || (parityT = makeParity());
  let lastTable = null, lastFact = null, gangN = 0;   // (the gang choice: wagonplan.js chooseGang)

  const wagons = ambush ? Promise.resolve(null) : Promise.resolve((wagonLib && wagonLib()) || loadWagons({ animals, folk })).catch((e) => { console.warn('wagon job: no wagon models, a stand-in rolls instead', e); return null; });
  Promise.all([loadRiderKit({ animals }), wagons]).then(([k, lib]) => {
    if (disposed) return;
    kit = k;
    if (ambush) {   // (the traffic's own wagon, held up: the gang rides in at once)
      if (!hold.t.wg) { state = 'stopped'; ended = 'ran'; return; }
      wagon = makeHeldWagon(hold); wagon.update();
      s = wagon.s; v = wagon.v;
      state = 'on'; WJ.on = true; nextWaveT = -1;
      newWave();
      return;
    }
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
  function addRider(t, { behind = WAGONJOB.spawnBehind, i = 0 } = {}) {
    const r = makeRider(kit, { W, folk, scene });
    const slot = freeSlot(), [side, lat] = SLOTS[slot];
    if (ambush) behind = outOfSight(side, lat, i);   // (a hold-up: they ride in along the road, from out of sight)
    road.at(s - behind, qs);
    r.place(qs.x + qs.nx * side * lat, qs.z + qs.nz * side * lat, behind < 0 ? qs.h + Math.PI : qs.h);
    r.speed = ambush ? 8 : WAGONJOB.speeds[dial().speed] + 3;
    const rs = s - behind;
    // (a hold-up's rider that has to come in where the player can see: he rides in out of the haze)
    let fade = null;
    if (ambush && inViewAt(r.x, r.z)) { fade = { a: 0, mem: {} }; fadeAll([r.horse.root, r.person.root], 0, fade.mem, [r.person]); }
    const rec = { r, rs, person: r.person, label: r.label, slot, state: 'arrive', n: null, text: '', good: false, trap: null, alpha: 0, lift: 0, fade,
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
  // a hold-up's rider rides in from along the road, behind the wagon or ahead of it (taking turns), the nearest place
  // out of the player's sight and on open ground; none: the farthest tried. Returns metres behind the wagon (ahead: below 0)
  function outOfSight(side, lat, i) {
    const way = i % 2 ? -1 : 1, [a, b] = AMBUSH.spawn;
    let last = way * b;
    for (let d = a + (i >> 1) * 6; d <= b; d += 12) for (const sg of [way, -way]) {
      road.at(s - sg * d, qs);
      const x = qs.x + qs.nx * side * lat, z = qs.z + qs.nz * side * lat;
      if (W.blocked(x, z)) continue;
      last = sg * d;
      if (!inViewAt(x, z) && Math.hypot(x - P.position.x, z - P.position.z) > 45) return sg * d;
    }
    return last;
  }
  function removeRec(rec) {
    const i = recs.indexOf(rec); if (i >= 0) recs.splice(i, 1);
    if (rec.fade) { unfade(rec.fade.mem); rec.fade = null; }
    rec.r.dispose();
  }
  // a rider dissolving in (to `to` 1) or out (to 0, then put away); false once it is gone
  function fadeStep(rec, dt) {
    const f = rec.fade; if (!f) return true;
    const to = f.out ? 0 : 1;
    f.a = to > f.a ? Math.min(1, f.a + dt / 1.2) : Math.max(0, f.a - dt / 1.2);
    fadeAll([rec.r.horse.root, rec.r.person.root], f.a, f.mem, [rec.r.person]);
    if (f.out && f.a <= 0) { removeRec(rec); return false; }
    if (!f.out && f.a >= 1) { unfade(f.mem); rec.fade = null; }
    return true;
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
  // a rider riding in that doesn't get there (caught on a bank or a tree out of sight, or lost the road): out of the
  // player's sight it is brought in again from the nearest place out of sight, so a question's answer never waits on a
  // rider nobody can see
  function arriveWatch(rec, gap, dt) {
    const w = rec.watch || (rec.watch = { t: 0, chk: 0, gap: Math.abs(gap) });
    w.t += dt; w.chk += dt;
    let stuck = false;
    if (w.chk >= WAGONJOB.arriveCheck) { stuck = Math.abs(gap) > 16 && w.gap - Math.abs(gap) < 4; w.gap = Math.abs(gap); w.chk = 0; }
    if (!(stuck || w.t > WAGONJOB.arriveBy) || rec.fade || inView(rec.r)) return;
    const [side, lat] = SLOTS[rec.slot];
    const behind = ambush ? outOfSight(side, lat, rec.slot) : WAGONJOB.spawnBehind * 0.6;
    road.at(s - behind, qs);
    rec.r.place(qs.x + qs.nx * side * lat, qs.z + qs.nz * side * lat, behind < 0 ? qs.h + Math.PI : qs.h);
    rec.rs = s - behind;
    if (inViewAt(rec.r.x, rec.r.z)) { rec.fade = { a: 0, mem: {} }; fadeAll([rec.r.horse.root, rec.r.person.root], 0, rec.fade.mem, [rec.r.person]); }
    rec.watch = null; WJ.broughtIn = (WJ.broughtIn || 0) + 1;
  }
  function riderStep(rec, dt) {
    const r = rec.r, vw = v;
    if (!fadeStep(rec, dt)) return;
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
        } else if (gap < -16) {
          // well ahead (riding in from up the road to a held-up wagon): back along it at a gallop, out at its own side
          road.at(rec.rs - 14, qs); goal.x = qs.x + qs.nx * goal.side * goal.lat; goal.z = qs.z + qs.nz * goal.side * goal.lat; goal.h = qs.h + Math.PI;
          want = vw + Math.min(7.5, 3 - gap * 0.15);
        } else want = vw + Math.max(-vw + 0.2, Math.min(7, gap * 0.7));
        // keep out of the player's way and off each other
        const px = P.position.x, pz = P.position.z, dp = Math.hypot(r.x - px, r.z - pz);
        if (dp < 4.5 && rec.state !== 'throw') { goal.x += (r.x - px) / (dp || 1) * 3; goal.z += (r.z - pz) / (dp || 1) * 3; }
        for (const o of recs) if (o !== rec && o.r.mode === 'ride') { const dd = Math.hypot(r.x - o.r.x, r.z - o.r.z); if (dd < 3.2) { goal.x += (r.x - o.r.x) / (dd || 1) * 2; goal.z += (r.z - o.r.z) / (dd || 1) * 2; } }
        const d = Math.hypot(goal.x - r.x, goal.z - r.z);
        if (ambush && Math.abs(gap) <= 16 && d > 4) want = Math.max(want, Math.min(7, d * 0.6));   // (round a standing wagon to its spot)
        if (vw < 0.2 && d < 2) want = 0;
        // aim a little ahead of the spot along the road, so a rider beside it doesn't turn in to it
        r.steer(goal.x + Math.sin(goal.h) * (want > 0.5 ? 5 : 0), goal.z + Math.cos(goal.h) * (want > 0.5 ? 5 : 0), Math.max(0, want), dt);
        if (rec.state === 'arrive' && d < 6) rec.state = 'ride';
        if (rec.state === 'arrive') arriveWatch(rec, gap, dt);
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
          rec.rs = s - WAGONJOB.spawnBehind; rec.state = 'arrive'; rec.watch = null;
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
        if (far > 70 && !inView(r)) { removeRec(rec); return; }
        if (far > 140 && !(rec.fade && rec.fade.out)) { rec.fade = rec.fade || { a: 1, mem: {} }; rec.fade.out = true; }   // (well off and still in sight: into the haze)
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
    const q = levelFor(rider, 'wagon');
    saveRider(rider);   // (the first ask meets the place)
    gangN++;
    const T0 = trainer();
    const c = chooseGang(rider, q, { n: gangN, lastTable, lastFact, met: (t) => (T0.state.tables && T0.state.tables[t] ? T0.state.tables[t].waves : 0) });
    const count = ambush ? gangSize() : c.count;   // (riders: wagonplan.js GANG; a hold-up's bunch: AMBUSH)
    let T, w;
    if (c.kind === 'parity') { T = parity(); w = T.wave({ count, want: c.want, top: c.top }); }
    else {
      T = T0;
      if (c.kind === 'missing') { lastFact = c.key; w = T.wave({ count, fact: c.fact, placing: q.placing }); }
      else { lastTable = c.table; w = T.wave({ count, table: c.table, reach: c.reach, placing: q.placing }); }
      WJ.tookTrainer = true;
    }
    const level = c.level;
    const goods = w.targets.filter((t) => t.good).length;
    wave = { T, w, q, level, startAt: q.id, iBefore: q.i, id: w.id, kind: w.kind, table: w.table, goods: ambush ? Math.min(goods, AMBUSH.most) : goods, caught: 0, misses: 0, down: [] };
    WJ.wave = wave;
    w.targets.forEach((t, i) => { const rec = addRider(t, { behind: WAGONJOB.spawnBehind + i * 4.5, i }); rec.wave = wave; });
    nextWaveT = -1;
    showCard();
    if (WJ.near) startHelp();
    if (music) music.action(true);
    // (a rider who can't read yet hears an odds-and-evens card: the recorded "Rope the evens" / "Rope the odds" once
    // their slots are recorded, src/audio/clipslots.js; else the browser's voice)
    if (w.kind === 'parity' && readAloud(rider) && !playSlot(audio, w.want === 'even' ? 'ropeEvens' : 'ropeOdds', { after: 600 })) sayLine(`Rope the ${w.want} numbers`, { now: true, after: 600 });
  }
  // the trainer's wave is still this job's (the round-up deals its own when the player goes back to the herd)
  const ownsTrainer = () => { const c = wave && wave.T.state && wave.T.state.cur; return !!(c && c.id === wave.id && !c.closed); };

  // (the card this gang put up last: a hold-up takes down its own when it is over, and nobody else's)
  // (a hold-up is a call for help, not a job the rider chose: every card it puts up, from "Help!" to the thanks, is
  // urgent, so the job the rider chose on the board never covers its question card: main.js THE JOB)
  const rule = (o) => { ownCard = o ? o.main : null; return hud.rule(ambush && o && !o.urgent ? { ...o, urgent: true } : o); };
  function showCard() {
    if (state === 'loading') return;
    if (!WJ.near) {
      if (state === 'on' && !quiet()) {
        const d = Math.round(Math.hypot(P.position.x - wagon.pos.x, P.position.z - wagon.pos.z));
        if (ambush) { if (wave && !wave.done) rule({ kind: 'travel', urgent: true, main: 'Help! Bandits on the road', sub: `A wagon's held up ${d} m away: ride over and rope the gang` }); }   // (urgent: over any other job's travel card, main.js)
        else rule({ kind: 'travel', main: 'Protect the wagon: it waits for you', sub: `${d} m away, on the road east of the pasture` });
      }
      return;
    }
    // (no "Done for now" button: riding away from the wagon stops the job, as the pause menu's "Let the wagon wait" does)
    if (state !== 'on') {
      if (ambush) { if (ended === 'safe' && doneT > 0) rule({ main: 'The wagon rolls on safe!', sub: 'The driver is much obliged to you' }); return; }
      if (arrived) { rule({ main: 'Safe at the end of the road!', sub: 'Ride along with the driver again when you\'re ready' }); return; }
      rule({ main: 'Protect the wagon', sub: state === 'stopped' ? 'The wagon waits here. Ride along with the driver when you\'re ready' : 'Ride up to the wagon to set off' }); return;
    }
    const togo = trip ? (trip.left > 2 ? `${Math.round(trip.left)} m to the end of the road` : 'Nearly there…') : 'More road ahead…';
    if (!wave) { rule({ main: 'Protect the wagon', sub: `Keep alongside. ${togo}` }); return; }
    if (wave.done) { rule({ main: 'The wagon rolls on safe!', sub: togo }); return; }
    const finding = wave.q && wave.q.placing ? ' · finding your level' : '';
    const left = wave.goods - wave.caught, togoLine = wave.caught ? `${wave.caught} roped · ${left} to go` : `${left} to rope`;
    if (wave.kind === 'parity') rule({ kind: 'gang', main: wave.w.rule, sub: `${parityLine(wave.w)} · ${togoLine}${finding}` });
    else if (wave.kind === 'missing') rule({ kind: 'gang', main: wave.w.rule, sub: `Rope the rider wearing the missing number${finding}` });
    else rule({ kind: 'gang', main: `The ${wave.table}-Gang`, sub: `Every bandit wears a multiple of ${wave.table} · ${togoLine}${finding}` });
  }

  // ── HELP WHEN STUCK: the times chart's Peek (as in the round-up); for odds and evens, the rule of thumb ────────────
  let nl = null;
  // what the odds-and-evens card says under it: the numbers themselves while they're small, then the last digit
  function parityLine(w) {
    if (w.top <= 10) return w.want === 'even' ? 'Even: 2, 4, 6, 8, 10' : 'Odd: 1, 3, 5, 7, 9';
    if (w.top <= 20) return w.want === 'even' ? 'Even numbers end in 0, 2, 4, 6 or 8' : 'Odd numbers end in 1, 3, 5, 7 or 9';
    return 'Look at the last digit';
  }
  function startHelp() {
    if (!wave || wave.done || WJ.paused || hes) return;
    if (wave.kind === 'parity') hes = watchLine({ after: WAGONJOB.helpAfter, onShow: () => { if (wave && wave.kind === 'parity') { hint({ say: 'A hint', line: wave.T.hint() }); hintT = WAGONJOB.hintFor; } } });
    else hes = watchChart({ after: WAGONJOB.helpAfter, onShow: () => chartHelp() });
  }
  // a number dealt into two rows (src/ui/groups.js): pairs, with one left over for an odd number
  function showPairs(n, reason) {
    hideLine();
    if (n > 30) return false;   // (too many dots to count: the line and the rail say it)
    nl = showGroups(hud.helpEl, { total: n, groups: 2, reveal: true, reason, theme: 'dark' });
    return true;
  }
  function hideLine() { if (nl) { nl.remove(); nl = null; } }
  function chartHelp(missed) {
    if (!wave || wave.kind === 'parity') return;
    const o = { ...chartOptions(wave.w, missed), anchor: hud.jobEl, avoid: hud.hintEl, side: 'right' };
    if (offer) offer.update(o); else offer = offerChart(document.body, o);
    placeOffer();
  }
  function hint(o) { hud.hint(o); placeOffer(); }
  function endHelp() {
    if (hes) { hes.cancel(); hes = null; }
    closeChart();
    if (offer) { offer.remove(); offer = null; }
    hideLine();
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
    // every rope is an answer at the gang's level; a times fact roped goes to the chart (a multiple roped: right; a
    // missing-number card: its fact, right or missed; a stray roped is no fact)
    const ra = recordAnswer(rider, right, answerAt(w));
    if (w.kind === 'rule' && right && w.table && rec.n % w.table === 0 && rec.n / w.table <= 12) recordFact(rider, w.table, rec.n / w.table, true);
    if (w.kind === 'missing') { const a = w.w.targets.find((x) => x.good); if (a) recordFact(rider, w.table, a.n, right); }
    if (ra && ra.badge) hud.toast(`You earned the ${ra.badge} badge!`, 'gold');
    upLevel(ra);
    if (right) {
      rec.state = 'caught'; w.caught++; rec.label.visible = false; if (trip) trip.caught++;
      const pay = WAGONJOB.pay.bandit + Math.floor(w.iBefore / WAGONJOB.payEvery);
      const e = earn(rider, pay);
      const ex = T.explain(rec.n);
      rec.fact = ex && ex.good ? ex.short || ex.line : `${rec.n}`;   // (the card over him: "24 = 4 × 6", "8 = 4 pairs")
      hint(null); hideRail(); hideLine();   // (the last miss's line, rail and picture go: this catch is the news now)
      hud.toast(`Roped the ${rec.text}! ${rec.fact}`, 'good');
      if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1600);
      hob.event('banditCatch', { at: () => ({ x: rec.r.x, z: rec.r.z }), male: /_m$/.test((rec.r.look && rec.r.look.outfit) || '') });   // (who he is and where: his "you got me", shouts.js)
      if (music) music.hit();
      refresh();
    } else {
      w.misses++;
      rec.state = 'tangled';
      rec.r.tipHat();
      rec.say = 2.6; drawCard(rec.label, 'Not me, partner', { font: '700 40px Bitter, Georgia, serif' });
      const ex = T.explain(rec.n);
      // (odds and evens: the line is written once, under the pairs' picture, where there is one)
      const pairs = w.kind === 'parity' && showPairs(rec.n, ex.line);
      hint({ say: 'Not me, partner', line: pairs ? '' : gangLine(ex.line), also: ex.also });
      showRail(ex.skip, ex.anchor);
      if (w.kind !== 'parity') chartHelp(rec.n);
      // (a rider who can't read yet hears the reason, in the browser's voice)
      if (readAloud(rider) && ex.line) sayLine(ex.line, { now: true, after: 600 });
      hintT = WAGONJOB.hintFor;
      hob.event('banditMiss', { at: () => ({ x: rec.r.x, z: rec.r.z }), male: /_m$/.test((rec.r.look && rec.r.look.outfit) || '') });   // (the rider roped by mistake has his say: shouts.js)
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

  // What a rope is an answer to: the gang's level (a review gang's: its own table's), while the rider is still on the
  // level they were on when the gang rode in. Once a rope has moved the rider to another level (up, or down after
  // misses; or a step of placement), the gang's other ropes are practice, counted in its kind of math only: the level
  // has its answer from this gang, and the next gang is dealt at the new level. (Otherwise a too-hard gang's ropes after
  // a drop would be "stretches" above the rider, whose rights count and misses don't: measured, struggling kids drifted
  // back up to 51% right.)
  function answerAt(w) {
    const st = stateOf(rider, 'wagon'), L = PLACE.wagon.levels.find((x) => x.id === w.level);
    if (st && st.id !== w.startAt && L) return { strands: [{ strand: L.strand, at: L.grade }] };
    return { place: 'wagon', level: w.level };
  }
  // "Up a level!" when the rider's level here moves up once placed (not while it is being found)
  function upLevel(ra) {
    const lv = ra && ra.level;
    if (!lv || !lv.placed || lv.justPlaced || lv.moved <= 0 || ambush) return;
    const L = PLACE.wagon.levels.find((x) => x.id === lv.id);
    setTimeout(() => hud.toast(L ? `Up a level! ${L.title}` : 'Up a level!', 'good'), 900);
  }
  // the bandit is down and tied: his sacks by him, and the fact over him for a few seconds
  function downed(rec, w) {
    rec.state = 'down';
    const { sacks, per } = sacksFor(rec.n, w.table, w.kind);
    const k = Math.min(12, sacks), p = rec.r.person.root.position;
    let mesh = null;
    const bags = [];   // each sack: where it lies { x, y, z, yaw }, and st: 0 lying, 1 hopping up, 2 picked up
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
        const yaw = heading + Math.PI / 2 * side + (Math.random() - 0.5) * 0.5;
        at.set(x, W.heightAt(x, z), z); q.setFromAxisAngle(_up, yaw);
        mesh.setMatrixAt(i, m.compose(at, q, sc));
        bags.push({ x, y: at.y, z, yaw, st: 0, t: 0, fx: 0, fy: 0, fz: 0 });
      }
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      if (sackTipsSaid < WAGONJOB.sackTips && hob.say) { sackTipsSaid++; hob.say(`He dropped his take: ${k} sack${k === 1 ? '' : 's'} of ${per}. Grab them!`, 4500); }
    }
    const fact = makeCard(); scene.add(fact);
    drawCard(fact, rec.fact || String(rec.n), { font: '700 54px Bitter, Georgia, serif' });
    downs.push({ rec, mesh, fact, factT: WAGONJOB.fact, at: p.clone(), wave: w, t: 0, bags, per, got: 0, count: null, countT: 0, countAt: new THREE.Vector3() });
  }

  // ── PICKING UP THE SACKS ─────────────────────────────────────────────────────────────────────────────────────
  // each frame, for a bandit's sacks near the player: a sack within reach hops up into the saddlebags (toward the
  // player, shrinking away), pays WAGONJOB.sackGold and clinks, and the count so far floats up over it ("6", "12",
  // "18", then "4 × 6 = 24" on the last). Lying sacks bob a little so they read as something to pick up.
  const _sm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _ss = new THREE.Vector3(), _sp = new THREE.Vector3();
  function sackStep(d, dt) {
    if (!d.mesh || !d.mesh.visible) return;
    const px = P.position.x, pz = P.position.z;
    if (Math.hypot(d.at.x - px, d.at.z - pz) > 50) return;   // (far off: left lying still, not worth the work)
    const reach = WAGONJOB.sackReach + (P.onHorse ? WAGONJOB.sackReachHorse : 0), bagY = P.position.y + (P.onHorse ? 1.3 : 0.9);
    let live = 0;
    for (let i = 0; i < d.bags.length; i++) {
      const b = d.bags[i];
      if (b.st === 0) {
        live++;
        if (!WJ.paused && Math.hypot(b.x - px, b.z - pz) < reach) { b.st = 1; b.t = 0; pickSack(d, b); }
        else {
          _sp.set(b.x, b.y + 0.04 + 0.04 * Math.sin(time * 2.6 + i * 0.9), b.z); _sq.setFromAxisAngle(_up, b.yaw + 0.15 * Math.sin(time * 1.3 + i)); _ss.set(1, 1, 1);
          d.mesh.setMatrixAt(i, _sm.compose(_sp, _sq, _ss));
          continue;
        }
      }
      if (b.st === 1) {
        live++;
        b.t += dt;
        const f = Math.min(1, b.t / WAGONJOB.sackHop), sc = Math.max(0.001, 1 - f * f);
        // (an arc from where it lay up to the player's saddlebags, wherever the player has got to)
        _sp.set(b.x + (px - b.x) * f, b.y + (bagY - b.y) * f + 0.9 * Math.sin(Math.PI * f), b.z + (pz - b.z) * f);
        _sq.setFromAxisAngle(_up, b.yaw + f * 4); _ss.set(sc, sc, sc);
        d.mesh.setMatrixAt(i, _sm.compose(_sp, _sq, _ss));
        if (f >= 1) b.st = 2;
      }
    }
    d.mesh.instanceMatrix.needsUpdate = true;
    if (!live) d.mesh.visible = false;   // (all picked up)
  }
  function pickSack(d, b) {
    d.got++;
    const k = d.bags.length, total = d.got * d.per;
    earn(rider, WAGONJOB.sackGold);
    refresh();
    clink(d.got === k);
    if (!d.count) { d.count = makeCard(); scene.add(d.count); }
    drawCard(d.count, d.got === k ? `${k} × ${d.per} = ${total}` : String(total), { font: '700 60px Bitter, Georgia, serif' });
    d.countAt.set(b.x, b.y + 0.8, b.z); d.countT = 1.4;
    if (d.got === k) hud.toast(`His take: ${k} × ${d.per} = ${total}. +${k * WAGONJOB.sackGold} gold`, 'gold');
  }
  // a soft clink of coins in the saddlebags: two short metal rings a moment apart (three on the last sack)
  function clink(last) {
    if (!audio || !audio.running || !audio.out) return;
    const ctx = audio.ctx, t0 = ctx.currentTime + 0.12;   // (as the sack lands in the bags)
    const hits = last ? [0, 0.07, 0.15] : [0, 0.06];
    for (const dt of hits) {
      const f = 2300 + Math.random() * 500, g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + dt); g.gain.linearRampToValueAtTime(0.07, t0 + dt + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dt + 0.18);
      g.connect(audio.out);
      for (const r of [1, 2.76]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * r;
        const og = r === 1 ? g : ctx.createGain(); if (og !== g) { og.gain.value = 0.35; og.connect(g); }
        o.connect(og); o.start(t0 + dt); o.stop(t0 + dt + 0.2);
        o.onended = () => { o.disconnect(); if (og !== g) og.disconnect(); };
      }
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, (0.12 + dt + 0.3) * 1000);
    }
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
    if (d.count) { d.count.removeFromParent(); d.count.material.dispose(); d.count.userData.tex.dispose(); }
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
    // (the math's move this wave: a level up, and whether it brought a new table)
    const q2 = levelFor(rider, 'wagon'), stepUp = q2.i > w.iBefore, newTable = stepUp && q2.level.gen.kind === 'gang';
    // the bandits are brought in (each roped one walks himself to the sheriff's office: see OFF TO THE SHERIFF)
    bankCaught(w, 2600);
    rider.lockboxes = rider.lockboxes || [];
    const tier = boxTier(rider);
    rider.lockboxes.push({ tier, from: 'loot' });
    const box = TIER_NAME[tier].toLowerCase().replace('lockbox', 'lock box'), them = `${w.caught} bandit${w.caught === 1 ? '' : 's'} brought in`;
    if (ambush) {
      // a hold-up seen off: the gang's pay and the driver's thanks together, the rest of the gang rides off, and the
      // wagon drives on (the manager lets it go: hold.onEnd)
      saveRider(rider);
      const pay = WAGONJOB.pay.wave + AMBUSH.bonus, e = earn(rider, pay);
      hud.toast(`The wagon's safe! ${them}. The driver pays you ${pay} gold, and the gang's ${box} is yours`, 'gold');
      if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 2400);
      refresh();
      hob.event('banditsDone', { n: w.caught, ambush: true });   // (the hold-up's own: the coins and the driver's thank-you)
      for (const rec of recs) if (rec.wave === w && free(rec)) { rec.state = 'leave'; setNumber(rec, null); }
      if (music) music.action(false);
      nextWaveT = -1; state = 'done'; WJ.on = false; ended = 'safe'; doneT = 6;
      hold.onEnd('safe');
      showCard();
      return;
    }
    // the wagon's speed dial: never raised together with the math
    const d = dial(), was = d.speed;
    d.speed = nextSpeed(d.speed, { misses: w.misses, stepUp, newTable, top: WAGONJOB.speeds.length - 1 });
    saveRider(rider);
    const e = earn(rider, WAGONJOB.pay.wave);
    hud.toast(`The wagon's safe! ${them}. +${WAGONJOB.pay.wave} gold and the gang's ${box}`, 'gold');
    if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 2400);
    if (d.speed !== was) setTimeout(() => hud.toast(d.speed > was ? 'The team picks up the pace' : 'The team slows to an easier pace'), 4200);
    refresh();
    // (a gang seen off on the way: Old Hob's word; the driver's thank-you waits for the end of the trip: arrive)
    hob.event('gangDone', { n: w.caught });
    if (hob.say) hob.say(WAGONJOB.gangLines[(waveN - 1) % WAGONJOB.gangLines.length], 3500);
    // the townsfolk ride on ahead
    for (const rec of recs) if (rec.wave === w && free(rec)) { rec.state = 'leave'; setNumber(rec, null); }
    if (music) music.action(false);
    nextWaveT = trip && trip.left < TRIP.quiet ? -1 : WAGONJOB.nextWave;   // (the last stretch of a trip is quiet)
    showCard();
  }
  // the job's wagon pulled up at the end of its trip, safe: the driver's thank-you (the job folk's, src/jobfolk.js, with
  // Old Hob's word and the coins: 'banditsDone'), a little pay, and the job rests there till the next trip
  function arrive() {
    const t = trip; trip = null; arrived = true;
    state = 'stopped'; WJ.on = false;
    endHelp(); hint(null); hideRail();
    for (const rec of recs) if (free(rec)) { rec.state = 'leave'; setNumber(rec, null); }
    if (wave && !wave.done) bankCaught(wave);
    wave = null; WJ.wave = null; nextWaveT = -1;
    if (music) music.action(false);
    const e = earn(rider, TRIP.pay);
    hud.toast(`Safe at the end of the road! The driver pays you ${TRIP.pay} gold`, 'gold');
    if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 2400);
    refresh();
    hob.event('banditsDone', { n: t ? t.caught : 0 });
    showCard();
  }
  // a hold-up the player didn't come to (or rode far off from): the driver makes a run for it, the gang rides off; nothing lost
  function giveUp() {
    if (state !== 'on') return;
    endHelp(); hint(null); hideRail(); unsee();
    if (P.lassoBusy && curTarget) P.cancelLasso();
    for (const rec of recs) if (free(rec)) { rec.state = 'leave'; setNumber(rec, null); }
    if (wave && !wave.done) bankCaught(wave);
    wave = null; WJ.wave = null; nextWaveT = -1;
    if (music) music.action(false);
    state = 'done'; WJ.on = false; ended = 'ran';
    if (ownCard && hud.ruleEl && !hud.ruleEl.hidden && (hud.ruleEl.textContent || '').includes(ownCard)) rule(null);
    if (met) hud.toast('The gang rode off, and the wagon got away safe');
    hold.onEnd('ran');
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
    if (!kit || state === 'on' || ambush) return false;
    state = 'on'; WJ.on = true; s = s || 0;
    trip = { left: tripLeft(s, road.length), caught: 0 }; arrived = false;   // (on to the far end's mark)
    nextWaveT = WAGONJOB.firstWave;
    hob.event('wagonArrive');
    showCard();
    return true;
  };
  // (away: the player rode off well clear of the wagon: a quiet toast, no word from Hob)
  WJ.stop = ({ away = false } = {}) => {
    if (ambush) { giveUp(); return; }
    if (state !== 'on') return;
    state = 'stopped'; WJ.on = false; trip = null; arrived = false;
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
    audio.need(ambush ? 'ambush' : 'action', want);   // (a hold-up's music is its own: the job's wagon may be far off, not wanting any)
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
    if (ambush) {
      // a hold-up: the first time the player comes, how it goes (once a ride); the driver shouting for help till the
      // player is close; a player who never comes, or rides far off: the driver makes a run for it
      if (WJ.near && !met) { met = true; if (hold.howTo) hold.howTo(); }
      if (state === 'on' && wave && !wave.done && dW > AMBUSH.helpNear && (helpT -= dt) <= 0) { helpT = AMBUSH.helpEvery; if (hold.help) hold.help(); }
      if (state === 'on' && (dW > AMBUSH.far || (!met && time > AMBUSH.wait))) giveUp();
      // (the "rolls on safe" card a few seconds, then down: the hold-up is over)
      if (doneT > 0 && (doneT -= dt) <= 0 && ownCard && hud.ruleEl && !hud.ruleEl.hidden && (hud.ruleEl.textContent || '').includes(ownCard)) rule(null);
    } else {
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
      if (state === 'stopped' && dW > WAGONJOB.near) { state = 'waiting'; arrived = false; showCard(); }
    }
    if (WJ.near !== wasNear) {
      wasNear = WJ.near;
      if (WJ.near) {
        // back with the wagon after the round-up dealt its own wave: a fresh gang
        if (state === 'on' && wave && !wave.done && !ownsTrainer()) newWave();
        startHelp();
      } else { endHelp(); unsee(); hud.hint(null); hud.rule(null); }
      showCard();
    } else if ((cardT -= dt) <= 0) {
      cardT = 1;
      if (!WJ.near && state === 'on' && !quiet()) showCard();
      else if (WJ.near && state === 'on' && trip && (!wave || wave.done)) showCard();   // (the metres to the end of the road)
    }
    if (hintT > 0 && (hintT -= dt) <= 0) hint(null);

    // the wagon: rolls on at its dial's speed, slowing to wait when the player falls well behind
    let want = 0;
    if (state === 'on' && !ambush) {
      const ahead = (wp.x - P.position.x) * Math.sin(wagon.heading) + (wp.z - P.position.z) * Math.cos(wagon.heading);
      want = dW < WAGONJOB.wait || ahead < 0 ? WAGONJOB.speeds[dial().speed] : 0;
      // the end of the trip: with no gang about it eases to a stop at the mark (a gang still riding with it: it rolls on
      // till they're seen off, then pulls up)
      if (trip && !(wave && !wave.done)) want = Math.min(want, Math.sqrt(2 * TRIP.ease * Math.max(0, trip.left)));
    }
    wagon.update(dt, want);
    s = wagon.s; v = wagon.v;
    if (trip) trip.left -= v * dt;
    if (state === 'on' && trip && trip.left <= 0.6 && !(wave && !wave.done) && v < 0.12) arrive();
    // its rumble, creaks and hooves, as the town's traffic wagons have (src/audio/wagonsound.js: quiet far off; a held-up
    // wagon of the traffic has its own already)
    if (!ambush && audio && wagon.wagon) { if (!rumble) rumble = makeWagonSound(audio, wagon.wagon); rumble.update(dt, camera.position); }

    if (state === 'on' && nextWaveT > 0 && (nextWaveT -= dt) <= 0) {
      if (trip && trip.left < TRIP.quiet) nextWaveT = -1;   // (the last stretch of the trip is quiet)
      else if (WJ.near) newWave(); else nextWaveT = 0.5;
    }

    if (I.enabled && P.enabled && WJ.near && state === 'on' && (I.tap('KeyF') || (!P.onHorse && I.tap('Space')))) WJ.throwAt(R.target);

    // (far off, the gang waits out of sight: nothing of it is drawn or moved until the player comes back)
    const away = dW > WAGONJOB.farOff;
    if (away !== WJ.away) { WJ.away = away; for (const rec of recs) rec.r.show(!away); }
    for (let i = recs.length - 1; i >= 0; i--) { const rec = recs[i]; if (away && !rec.dev) continue; if (rec.r.mode !== 'down' && rec.r.mode !== 'fall') riderStep(rec, dt); else rec.r.update(dt); }
    if (downs.length) { const g = 0.18 + 0.07 * (1 + Math.sin(time * 3)); for (const m of sackMats.values()) m.emissiveIntensity = g; }   // (the sacks' faint glow, pulsing)
    for (let i = downs.length - 1; i >= 0; i--) {
      const d = downs[i], far = Math.hypot(d.at.x - P.position.x, d.at.z - P.position.z);
      if (d.factT > 0) d.factT -= dt;
      d.t += dt;
      sackStep(d, dt);
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
      if (d.count) {   // (the count along the sacks picked up: floats up and fades)
        if (d.countT > 0) d.countT -= dt;
        const ca = Math.max(0, Math.min(1, d.countT / 0.5));
        d.count.visible = ca > 0.01;
        if (d.count.visible) { size(d.count, lp.set(d.countAt.x, d.countAt.y + (1.4 - d.countT) * 0.6, d.countAt.z).clone(), 0.75); d.count.material.opacity = ca; }
      }
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
      // (kept on the screen: a card that would run off its left or right edge slides in along it, over its rider still)
      const edge = 6, over = Math.max(0, it.x + it.cw / 2 - (w - edge)) - Math.max(0, edge - (it.x - it.cw / 2));
      it.rec.label.center.x = 0.5 + over / (px * (RIDERS.card[0] / RIDERS.card[1]));
      rects.push({ x0: it.x - it.cw / 2 - over, x1: it.x + it.cw / 2 - over, y0: bottom - px, y1: bottom, rec: it.rec });
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
    kind, state, on: WJ.on, near: WJ.near, loaded: !!kit, s: +s.toFixed(1), speed: +v.toFixed(2), notch: dial().speed,
    trip: trip ? { left: +trip.left.toFixed(1), caught: trip.caught } : null, arrived, met, ended, held: ambush ? !!hold.t.held : null,
    wagon: wagon ? { x: +wagon.pos.x.toFixed(1), z: +wagon.pos.z.toFixed(1), real: !wagon.root } : null,
    wave: wave && { n: waveN, table: wave.table, kind: wave.kind, level: wave.level, finding: !!(wave.q && wave.q.placing),
      rule: wave.kind === 'rule' ? `The ${wave.table}-Gang` : wave.w.rule, goods: wave.goods, caught: wave.caught, misses: wave.misses, done: !!wave.done },
    riders: recs.map((x) => ({ n: x.n, good: x.good, state: x.state, mode: x.r.mode, x: +x.r.x.toFixed(1), z: +x.r.z.toFixed(1), speed: +x.r.speed.toFixed(2), clip: x.r.horse.clip, label: x.label.visible })),
    downs: downs.length, sacks: downs.map((d) => ({ k: d.bags.length, got: d.got, per: d.per, x: +d.at.x.toFixed(1), z: +d.at.z.toFixed(1), at: d.bags.filter((b) => !b.st).map((b) => ({ x: +b.x.toFixed(2), z: +b.z.toFixed(2) })) })), walkers: walkers.map((k) => ({ phase: k.phase, x: +k.x.toFixed(1), z: +k.z.toFixed(1), fade: +k.fade.toFixed(2), path: k.path ? k.path.length : 0 })),
    music: music ? music.state() : null, rail: railT > 0, sound: rumble ? rumble.state() : null,
  });
  // a hold-up all over: seen off or run off, its riders gone, the roped ones walked off and their sacks left behind
  WJ.over = () => ambush && (state === 'done' || state === 'stopped') && !recs.length && !walkers.length && !downs.length;
  WJ.dispose = () => {
    disposed = true;
    if (wave && !wave.done) bankCaught(wave);   // (leaving the ride mid-gang: its roped bandits still count)
    offPick(); endHelp(); unsee(); if (WJ.near && (!ambush || state === 'on')) { hud.rule(null); hud.hint(null); }
    for (const rec of [...recs]) removeRec(rec);
    for (const d of [...downs]) removeDown(d);
    for (const k of [...walkers]) endWalk(k);
    if (ropeGeo) { ropeGeo.dispose(); ropeMat.dispose(); ropeGeo = ropeMat = null; }   // (the walkers' wrist ropes)
    if (rumble) { rumble.dispose(); rumble = null; }
    if (wagon) wagon.dispose();
    rail.dispose(); R.dispose();
    if (music) music.stop({ now: true });
    if (audio) audio.need(ambush ? 'ambush' : 'action', false);
    if (bus) { bus.ctx.removeEventListener('statechange', bus.onState); const g = bus.g; g.gain.setTargetAtTime(0, bus.ctx.currentTime, 0.05); setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 400); bus = null; }
  };
  return WJ;
}

// ── THE JOB AND THE HOLD-UPS TOGETHER: what main.js gets ─────────────────────────────────────────────────────────
// The job's wagon's gang (WJ itself: everything main.js, the job folk and the rigs read of it), and the hold-ups on the
// long roads: now and then (AMBUSH.every seconds out on the long roads, the first after AMBUSH.first), when the player
// is out on the road through the valley and not busy at another job, a travelling wagon near enough to see and with
// room round it for the riders (ambushPick) is held up, and a gang of the same shape as the job's (makeGang, kind
// 'ambush') rides in on it. One at a time; it is put away once it is all over (its riders gone, the roped ones walked
// off, the sacks left behind).
const HOWTO = {
  click: "Bandits! Rope the ones wearing the gang's number: the card up top says which. Folks riding along look just the same. Point at a rider and click, or press F.",
  touch: "Bandits! Rope the ones wearing the gang's number: the card up top says which. Folks riding along look just the same. Tap a rider, or the Rope button.",
};
const GAME = new URL('../../', import.meta.url).href;
const rndIn = ([a, b]) => a + Math.random() * (b - a);
export function makeWagonJob(opts) {
  const { W, P, I, camera, hob, audio = null, quiet = () => false, traffic = null, shouts = null } = opts;
  let A = null;   // the hold-up under way: { G (its gang), T (the traffic), t (the traveller held up), n, voice }
  const ambNear = () => !!(A && A.G.near);
  const job = makeGang({ ...opts, quiet: () => quiet() || ambNear() });
  const WJ = Object.create(job);
  const M = { cool: AMBUSH.first, hold: false, n: 0, why: '', out: false };   // the hold-ups: when the next may come
  let told = false, lookT = 0;

  // Old Hob for a hold-up's gang: its own ending (the coins and the driver's recorded thank-you, not the job's driver's
  // thanks), no "let's roll" from the job's driver, and the how-to once a ride as the player first rides up (howTo)
  const ambHob = Object.create(hob);
  ambHob.event = (n, d) => {
    if (n === 'wagonArrive' || n === 'wagonStop' || n === 'gangDone') return;
    if (n === 'banditsDone') { const S = shouts && shouts(); if (S) { S.jingle(); if (A && A.voice) S.talk('thanks', A.voice); } return; }
    hob.event(n, d);
  };
  const howTo = () => { if (told || !hob.say) return; told = true; hob.say(I && I.touch ? HOWTO.touch : HOWTO.click, 9000); };
  // the held-up wagon's driver: "Help!" over his head (and his recorded shout, once there is one), his thanks after
  const driverOf = () => (A && A.t.wg && A.t.wg.driver) || null;
  function help() { const d = driverOf(); if (!d) return; if (clearOfCard(d)) howdy(d, AMBUSH.words.help, { ms: 2600, key: 'holdup' + A.n }); helpVoice(); }
  // (far off, his head sits up by the horizon, where the card at the top is: no bubble over the card, which says
  // "Help!" itself; the shout goes up again once the wagon is lower in the view)
  const _h = new THREE.Vector3();
  function clearOfCard(d) {
    const el = opts.hud && opts.hud.ruleEl; if (!el || el.hidden || !d.bones || !d.bones.Head) return true;
    const r = el.getBoundingClientRect(); if (!r.width) return true;
    d.bones.Head.getWorldPosition(_h); _h.y += 0.62; _h.project(camera);
    if (_h.z > 1) return true;
    const x = (_h.x + 1) / 2 * innerWidth, y = (1 - _h.y) / 2 * innerHeight;
    return !(y - 48 < r.bottom + 6 && x > r.left - 70 && x < r.right + 70);
  }
  function thanks() { const d = driverOf(); if (d) { const L = AMBUSH.words.thanks; howdy(d, L[Math.floor(Math.random() * L.length)], { ms: 4500, key: 'holdup' + A.n }); } }
  const helpBufs = []; let helpLoading = false, helpNext = 0;
  function helpVoice() {
    if (!AMBUSH.helpClips.length || !audio || !audio.ctx || !audio.running) return;
    if (!helpLoading) {
      helpLoading = true;
      const ext = clipExt((n) => document.createElement('audio').canPlayType(n)), ctx = audio.ctx;
      for (const name of AMBUSH.helpClips) fetch(GAME + 'sounds/voice/' + name + ext).then((r) => { if (!r.ok) throw new Error(r.status + ''); return r.arrayBuffer(); })
        .then((ab) => ctx.decodeAudioData(ab)).then((b) => helpBufs.push(b)).catch((e) => console.warn('wagon job: a "Help!" clip could not load', name, e && e.message));
      return;
    }
    if (!helpBufs.length || !A || !A.t.wg) return;
    const ctx = audio.ctx, p = A.t.wg.pos, src = ctx.createBufferSource(), pan = ctx.createPanner();
    pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 8; pan.rolloffFactor = 1; pan.maxDistance = 10000;
    if (pan.positionX) { pan.positionX.value = p.x; pan.positionY.value = p.y + 2.2; pan.positionZ.value = p.z; } else pan.setPosition(p.x, p.y + 2.2, p.z);
    src.buffer = helpBufs[helpNext++ % helpBufs.length];
    src.connect(pan).connect(audio.out);
    src.onended = () => { try { src.disconnect(); pan.disconnect(); } catch (e) { /* gone */ } };
    src.start();
  }

  // where the player is along the traffic's road (the nearest of its points every 2 m) and how far off its middle
  const pts = [];
  function playerOnRoad(T) {
    if (!pts.length) { const L = T.road.getLength(), q = new THREE.Vector3(); for (let u = 0; u <= L; u += 2) { T.road.getPointAt(u / L, q); pts.push([u, q.x, q.z]); } }
    const x = P.position.x, z = P.position.z; let best = Infinity, pu = 0;
    for (const [u, px, pz] of pts) { const d = (px - x) ** 2 + (pz - z) ** 2; if (d < best) { best = d; pu = u; } }
    return { pu, off: Math.sqrt(best) };
  }
  // the share of the ground round a wagon that is clear (the riders need room to ride round it)
  function openRound(g) {
    const sn = Math.sin(g.heading), cs = Math.cos(g.heading); let n = 0, ok = 0;
    for (const a of [-24, -12, 0, 12, 24]) for (const l of [-10, -6, 6, 10]) { n++; if (!W.blocked(g.pos.x + sn * a + cs * l, g.pos.z + cs * a - sn * l)) ok++; }
    return ok / n;
  }
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _c = new THREE.Vector3();
  function choose(T) {
    camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    const list = T.wagons.map((t) => {
      const g = t.wg, made = !!g && !t.ghost && (t.fade == null || t.fade >= 1) && t.fadeTo !== 0, onRoad = !t.way && !t.park && t.stop == null;
      return { t, u: t.u, made, onRoad, held: !!t.held, ended: !!(t.ended || t.gone), plan: false,
        dist: g ? Math.hypot(g.pos.x - P.position.x, g.pos.z - P.position.z) : Infinity,
        seen: g ? _fr.containsPoint(_c.set(g.pos.x, W.heightAt(g.pos.x, g.pos.z) + 1.5, g.pos.z)) : false,
        open: made && onRoad ? openRound(g) : 0, mist: g && W.fogAt ? W.fogAt(g.pos.x, g.pos.z) : 0,
        atJob: !!g && ['pasture', 'corral'].some((k) => { const q = W.places[k]; return q && Math.hypot(g.pos.x - q.x, g.pos.z - q.z) < AMBUSH.jobs; }) };
    });
    const best = ambushPick(list, { square: T.square });
    return best ? best.t : null;
  }
  function begin(T, t) {
    if (!T.holdUp(t)) return false;
    // its own road: the traffic's, a metre at a time, the way it goes
    const L = T.road.getLength(), way = [], q = new THREE.Vector3();
    for (let i = 0; i <= Math.floor(L); i++) { T.road.getPointAt((t.dir > 0 ? i : L - i) / L, q); way.push([q.x, q.z]); }
    const road = makeOpenRoad(way); road.total = L;
    const d = t.wg.driver;
    A = { T, t, n: ++M.n, voice: d && /_m$/.test(d.outfit || '') ? { id: 'holdup-driver-' + t.number, male: true, at: () => (t.wg ? { x: t.wg.pos.x, z: t.wg.pos.z } : null) } : null };
    A.G = makeGang({ ...opts, hob: ambHob, quiet: () => quiet() || job.near, kind: 'ambush', hold: { T, t, road, onEnd: finished, howTo, help } });
    A.G.paused = job.paused;
    M.why = 'holding up wagon ' + t.number;
    return true;
  }
  function finished(how) {
    if (!A) return;
    if (how === 'safe') thanks();
    A.T.letGo(A.t);
    M.cool = rndIn(AMBUSH.every);
  }
  function end() {
    if (!A) return;
    A.G.dispose();
    if (A.t.held) A.T.letGo(A.t);
    A = null;
  }
  function ambushes(dt) {
    if (A) { A.G.update(dt); if (A.G.over()) end(); return; }
    const T = traffic && traffic();
    if (!T || !T.lib || !T.road || M.hold) return;
    // only time spent out on the long roads counts toward the next hold-up (where the player is: looked at twice a second)
    if ((lookT -= dt) <= 0) { lookT = 0.5; M.out = outOnRoad({ ...playerOnRoad(T), square: T.square }); }
    if (!M.out) return;
    if ((M.cool -= dt) > 0) return;
    M.cool = 2;   // (none will do just now: another look in a moment)
    if (quiet() || job.on || job.near || P.lassoBusy || !P.enabled) { M.why = 'busy'; return; }
    const t = choose(T);
    if (!t) { M.why = 'no wagon near enough'; return; }
    begin(T, t);
  }

  const both = [];
  Object.defineProperties(WJ, {
    near: { get: () => job.near || ambNear() },
    wave: { get: () => (ambNear() ? A.G.wave : job.wave) },
    targets: { get: () => (ambNear() ? A.G.targets : job.targets) },
    music: { get: () => (ambNear() && A.G.music) || job.music },
    walkers: { get: () => { both.length = 0; for (const k of job.walkers) both.push(k); if (A) for (const k of A.G.walkers) both.push(k); return both; } },
    tookTrainer: { get: () => job.tookTrainer || !!(A && A.G.tookTrainer), set: (v) => { job.tookTrainer = v; if (A) A.G.tookTrainer = v; } },
    paused: { get: () => job.paused, set: (v) => { job.paused = v; if (A) A.G.paused = v; } },
    ambush: { get: () => (A ? A.G : null) },
  });
  // (the trail and the compass lead to a wagon calling for help; else to the job's wagon)
  WJ.where = () => (A && A.G.on && !A.G.near ? A.G.where() : job.where());
  WJ.update = (dt) => { job.update(dt); ambushes(dt); };
  WJ.state = () => ({ ...job.state(), ambush: A ? A.G.state() : null, ambushes: { cool: +M.cool.toFixed(1), out: M.out, why: M.why, n: M.n, hold: M.hold } });
  WJ.ambushes = {
    state: () => ({ cool: +M.cool.toFixed(1), out: M.out, why: M.why, n: M.n, hold: M.hold, on: !!A, wagon: A ? A.t.number : null }),
    // (dev and rigs) a hold-up at once, on a wagon near enough (out of town, 45 to 175 m off, room round it), if one will do
    now: () => { const T = traffic && traffic(); if (!T || A) return false; const t = choose(T); return t ? begin(T, t) : false; },
    get hold() { return M.hold; }, set hold(v) { M.hold = !!v; },
    get cool() { return M.cool; }, set cool(v) { M.cool = +v || 0; },
  };
  WJ.dispose = () => { end(); job.dispose(); };
  return WJ;
}
