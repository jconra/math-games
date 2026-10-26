// WILD DEER: a few small herds (a stag and his does) living out in the valley, away from the town, the roads and the
// trails, to make the world feel alive. They graze, look about and amble a few steps; when the player comes close (on
// foot, or sooner on a horse, at once when galloping at them) they lift their heads, and if the player keeps coming they
// bound away, settle again further off and go back to grazing. A herd that has been chased far from home drifts back.
//
// The homes were picked from a survey of the land (~/pw/bandit-math/rigs/deer/survey.cjs: dry, gentle ground, no tree
// within 12 m, at least 45 m from every trail and road, far from the town, the pasture, the farm and the camps).
//
// They are cheap: a herd past DEER.far from the camera is hidden and left alone (nothing worked out, not even its
// bones); past DEER.mid its clips step every third frame; only a herd inside DEER.shadow casts shadows. The legs keep to
// the ground with the animals' own gaits (animal.pace in src/actors/animals.js: Walk, sped up for a trot, and Gallop).
//
// The deer photographs job (src/missions/deerjob.js) has one herd for its own (the creek herd, the nearest to town, with
// Miss Wren standing by it): it makes it less shy while the kid creeps up with the camera, poses it side-on for the
// pictures, and sends it off when the pictures are taken. The other herds are only wildlife, to come across exploring.
//
//   const D = makeDeer({ W, animals, scene })     animals: the loaded animal library (the deer and stag are loaded here)
//   D.ready             a promise: the herds are in
//   D.update(dt, { at, onHorse, speed, eye })   each frame: at = the player's feet; speed m/s; eye = the camera's place
//   D.herds             the herds: { id, home, mid: { x, z } (where it is now), state, deer: [deer], shy, ... }
//                       state: 'calm' | 'alert' (heads up) | 'flee' | 'pose' (for the camera) | 'leave' (walking off)
//                       deer: { a (the animal), kind: 'deer' | 'stag', x, z, h (heading), v (m/s), arrived }
//   D.herd(id), D.nearest(at, { except })   one herd; the nearest to a spot (except: a herd to leave out)
//   herd.shy = { alert, flee, calm } | null    metres (on foot) at which it looks up and bolts; null: the usual DEER
//                       ones. calm (the photographs job's herd): it bolts only from a player who keeps coming inside the
//                       flee distance, never from one standing still (a deer that grazes up close just looks), nor from
//                       a gallop further off, nor from the slow creep the usual herds run from; it never drifts toward
//                       the player either
//   herd.keepNear = { x, z, min, max } | null    while grazing, the herd only drifts to where its middle stays between
//                       min and max metres of this spot (the naturalist's: her herd stays in reach but never on top of her);
//                       out of that band (walked off after its pictures, or bolted) it drifts back into it
//   herd.pose(spots)    each deer walks to its spot { x, z, h } and stands there (grazing, looking about) till released
//   herd.release()      back to grazing where they stand
//   herd.leave(x, z)    the herd walks off away from (x, z) and settles further on
//   herd.scare(x, z)    the herd bolts away from (x, z) now (for rigs)
//   D.state()           for rigs
//   D.dispose()
import * as THREE from 'three';
import { makeAnimal } from './actors/animals.js';

export const DEER = {
  herds: [
    { id: 'creek', x: 168, z: -256, does: 3 },   // south of the pasture, about 190 m from the square: the nearest
    { id: 'north', x: 72, z: 56, does: 4 },      // a woods edge north, across the creek
    { id: 'west', x: -336, z: -196, does: 3 },   // beyond the cow camp, at the foot of the western woods
    { id: 'east', x: 276, z: 32, does: 3 },      // the open meadow north-east
    // the back woods (~/pw/bandit-math/rigs/town/E/survey.cjs: a clearing at a woods edge 330 to 510 m out, reachable,
    // clear of the roads and trails, the camps, the western river where the bridge is to go, and 50 m or more from the
    // gang's back-woods camp spots (src/missions/loot.js BACKWOODS))
    { id: 'backwest', x: -410, z: -315, does: 4 },   // deep in the woods out west, north of the road
    { id: 'southwest', x: -360, z: 155, does: 3 },   // the woods south-west of town, past the lake's river
    { id: 'backeast', x: 495, z: -245, does: 3 },    // the woods' edge out east, beyond the wagon road's loop
  ],
  spread: 6,             // m: how far from the herd's middle a deer grazes
  roam: 20,              // m: the herd's middle wanders this far round where it settled
  leash: 120,            // m: a herd further than this from home heads back that way when it next moves
  alert: 40,             // m from a player on foot where heads come up ...
  flee: 26,              // ... and where they bolt
  horse: 1.35,           // a rider on a horse is noticed this much further off
  gallop: 9,             // m/s: a player coming faster than this spooks them from the alert distance at once
  look: 1.2,             // s heads up before bolting, if the player keeps coming
  bolt: [7, 8.5],        // m/s a fleeing deer bounds (a gallop played at the speed that keeps the hooves planted)
  run: [55, 80],         // m a fright carries them
  keepFrom: 150,         // m: a fleeing herd never ends nearer the town square than this
  calmAfter: [4, 7],     // s standing alert after a run before grazing again
  walk: [0.45, 0.85],    // m/s an ambling deer
  stroll: 1.5,           // m/s a deer walking to a spot (posing, leaving: a brisk walk)
  task: [4, 11],         // s a deer keeps at one thing (grazing, looking about) before the next
  giveUp: 12,            // s: a deer that hasn't reached its spot by then stops where it is
  posePace: 2.4,         // m/s a deer trots to its spot for the camera (the photographer is waiting)
  poseGiveUp: 7,         // s: ... and gives up on that spot by then
  far: 260,              // m from the camera: past this a herd is hidden and left alone
  mid: 80,               // ... past this its clips step every `midEvery` frames
  midEvery: 3,
  shadow: 45,            // ... inside this it casts shadows
};
// what a calm deer does with itself (the clip, and how often it's picked); 'walk' ambles a few metres
const TASKS = [['Eating', 4], ['Idle_Headlow', 2], ['Idle', 2], ['Idle_2', 1.5], ['walk', 2]];
// does are tinted a little apart so a herd isn't all one deer (colours laid over the file's own, as COATS in animals.js)
const DOE_TINTS = [null, '#f0e2d0', '#d8c6b2', '#fff2e2', '#e4d2bc'];

// the ways a deer tries, in turn, when the way ahead is blocked (radians off its heading)
const VEER = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0];
const rand = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function pickTask() {
  let r = Math.random() * TASKS.reduce((s, t) => s + t[1], 0);
  for (const t of TASKS) if ((r -= t[1]) <= 0) return t[0];
  return 'Idle';
}

export function makeDeer({ W, animals, scene = W.scene }) {
  const D = { herds: [] };
  let disposed = false, frame = 0;
  const sq = W.places.square || W.places.spawn;

  // the places folk work (the pasture, the corral, the farm): a herd doesn't settle there
  const P0 = W.places, BUSY = [P0.pasture && [P0.pasture.x, P0.pasture.z, P0.pasture.r + 30], P0.corral && [P0.corral.x, P0.corral.z, 35],
    P0.farm && [P0.farm.x, P0.farm.z, (P0.farm.r || 34) + 30]].filter(Boolean);
  const busy = (x, z) => BUSY.some(([bx, bz, r]) => Math.hypot(x - bx, z - bz) < r);
  // can a deer stand here? (dry, open, not inside anything)
  const free = (x, z) => !W.blocked(x, z) && W.waterAt(x, z) < 0.3;
  // ...and get here from (x0, z0) in a straight line (checked every 4 m)
  function clear(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 4));
    for (let i = 1; i <= n; i++) { const t = i / n; if (!free(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false; }
    return true;
  }

  function makeHerd(def, lib) {
    const group = new THREE.Group(); group.name = 'deer-' + def.id;
    scene.add(group);
    const H = { id: def.id, home: { x: def.x, z: def.z }, mid: { x: def.x, z: def.z }, state: 'calm', t: 0, deer: [], group,
      shy: null, dist: 1e9, shown: true, shadows: true, alertFrom: 0, moveT: rand(20, 40), acc: 0, fleeFrom: null, faceT: 0 };
    const kinds = ['stag', ...Array.from({ length: def.does }, () => 'deer')];
    kinds.forEach((kind, i) => {
      const a = makeAnimal(lib, kind, { shadows: true, tint: kind === 'deer' ? DOE_TINTS[i % DOE_TINTS.length] : null });
      const ang = (i / kinds.length) * Math.PI * 2 + rand(-0.4, 0.4), r = i === 0 ? rand(0, 2) : rand(2, DEER.spread);
      const off = { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
      let x = def.x + off.x, z = def.z + off.z;
      if (!free(x, z)) { x = def.x; z = def.z; }
      const d = { a, kind, x, z, h: rand(-Math.PI, Math.PI), v: 0, want: 0, goal: null, off, task: 'Eating', taskT: rand(0, 6),
        face: null, arrived: true, clip: 'Eating' };
      a.root.position.set(x, W.heightAt(x, z), z); a.root.rotation.y = d.h;
      a.play('Eating', { fade: 0 }); a.mixer.update(Math.random() * 5);
      group.add(a.root);
      H.deer.push(d);
    });

    H.pose = (spots) => {
      H.state = 'pose';
      H.deer.forEach((d, i) => { const s = spots[i]; if (!s) return; d.goal = { x: s.x, z: s.z }; d.goalT = 0; d.giveUp = DEER.poseGiveUp; d.want = DEER.posePace; d.face = s.h; d.arrived = false; d.task = 'Idle'; d.taskT = rand(2, 5); });
    };
    H.release = () => {
      H.state = 'calm'; H.t = 0;
      let x = 0, z = 0; for (const d of H.deer) { x += d.x; z += d.z; d.goal = null; d.want = 0; d.face = null; d.arrived = true; d.giveUp = 0; }
      H.mid = { x: x / H.deer.length, z: z / H.deer.length };
    };
    H.leave = (fx, fz) => run(H, fx, fz, false);
    H.scare = (fx, fz) => run(H, fx, fz, true);
    H.posed = () => H.state === 'pose' && H.deer.every((d) => d.arrived);
    return H;
  }

  // a fright (bolt) or a calm walk off (leave): the herd heads away from (fx, fz), toward home if it has strayed far
  function run(H, fx, fz, bolt) {
    let ax = H.mid.x - fx, az = H.mid.z - fz; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
    const hx = H.home.x - H.mid.x, hz = H.home.z - H.mid.z, hl = Math.hypot(hx, hz);
    if (hl > DEER.leash) { ax = ax * 0.4 + (hx / hl) * 0.6; az = az * 0.4 + (hz / hl) * 0.6; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l; }
    const base = Math.atan2(ax, az), far = bolt ? rand(DEER.run[0], DEER.run[1]) : rand(40, 60);
    let dest = null;
    for (const turn of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.5, -1.5]) {
      for (const k of [1, 0.7, 0.45]) {
        const a = base + turn, x = H.mid.x + Math.sin(a) * far * k, z = H.mid.z + Math.cos(a) * far * k;
        if (Math.hypot(x - sq.x, z - sq.z) < DEER.keepFrom || busy(x, z)) continue;
        if (free(x, z) && clear(H.mid.x, H.mid.z, x, z)) { dest = { x, z }; break; }
      }
      if (dest) break;
    }
    if (!dest) dest = { x: H.mid.x + ax * 20, z: H.mid.z + az * 20 };   // (boxed in: a short dash)
    H.state = bolt ? 'flee' : 'leave'; H.t = 0; H.fleeFrom = { x: fx, z: fz };
    H.mid = dest;
    for (const d of H.deer) {
      let x = dest.x + d.off.x, z = dest.z + d.off.z;
      if (!free(x, z)) { x = dest.x; z = dest.z; }
      d.goal = { x, z }; d.goalT = 0; d.giveUp = 0; d.want = bolt ? rand(DEER.bolt[0], DEER.bolt[1]) : DEER.stroll * rand(0.85, 1.1); d.face = null; d.arrived = false;
    }
  }

  // ── EACH DEER ──────────────────────────────────────────────────────────────────────────────────────────────────
  function stepDeer(H, d, dt, animate) {
    if (d.goal) {
      const dx = d.goal.x - d.x, dz = d.goal.z - d.z, dist = Math.hypot(dx, dz);
      d.goalT = (d.goalT || 0) + dt;
      // (there, or as near as it can get: a spot it can't reach after a good try is given up where it stands)
      // (and one still going round and round after twice that, unable to get in, stops too)
      const gu = d.giveUp || DEER.giveUp;
      if ((dist < 0.5 && d.v < 1) || (d.goalT > gu && d.v < 2.6) || d.goalT > gu * 2) { d.goal = null; d.arrived = true; d.want = 0; d.goalT = 0; d.giveUp = 0; }
      else {
        const turn = d.v > 3 ? 2.6 : 3.4;
        const dh = wrap(Math.atan2(dx, dz) - d.h); d.h = wrap(d.h + Math.sign(dh) * Math.min(Math.abs(dh), turn * dt));
        // (slows into its spot: a bounding deer eases down over the last few metres)
        const want = Math.min(d.want, Math.max(0.5, dist * (d.want > 3 ? 0.9 : 1.2))) * (Math.abs(dh) > 1.2 ? 0.4 : 1);
        d.v += Math.sign(want - d.v) * Math.min(Math.abs(want - d.v), (want > d.v ? 7 : 9) * dt);
      }
    } else {
      d.v = Math.max(0, d.v - 9 * dt);
      if (d.face != null) { const dh = wrap(d.face - d.h); d.h = wrap(d.h + Math.sign(dh) * Math.min(Math.abs(dh), 1.8 * dt)); }
    }
    if (d.v > 0.01) {
      // (a tree or the creek ahead: the nearest way round it, a little to one side or the other, looking a few metres on)
      const look = Math.max(1.5, d.v * 0.5);
      let moved = false;
      for (const turn of VEER) {
        const h = d.h + turn;
        if (turn && !free(d.x + Math.sin(h) * look, d.z + Math.cos(h) * look)) continue;
        const nx = d.x + Math.sin(h) * d.v * dt, nz = d.z + Math.cos(h) * d.v * dt;
        if (!free(nx, nz)) continue;
        d.x = nx; d.z = nz; if (turn) d.h = wrap(d.h + turn * Math.min(1, dt * 6));
        moved = true;
        break;
      }
      // (boxed in every way: it stops, so its try at the spot runs out and it gives up there; kept at full speed
      // against a fence it would never give up, and a bolting herd would stay bolted for good)
      if (!moved) d.v = 0;
    }
    if (animate) {
      d.a.root.position.set(d.x, W.heightAt(d.x, d.z), d.z);
      d.a.root.rotation.y = d.h;
      d.a.pace(d.v, d.task === 'walk' ? 'Idle' : d.task);
    }
  }

  // calm deer: graze, look about, amble a few metres round the herd's middle
  function calmDeer(H, d, dt) {
    if (d.goal) return;
    if ((d.taskT -= dt) > 0) return;
    d.task = pickTask(); d.taskT = rand(DEER.task[0], DEER.task[1]);
    if (d.task === 'walk') {
      const a = rand(-Math.PI, Math.PI), r = rand(0, DEER.spread);
      const x = H.mid.x + Math.sin(a) * r, z = H.mid.z + Math.cos(a) * r;
      if (free(x, z)) { d.goal = { x, z }; d.goalT = 0; d.want = rand(DEER.walk[0], DEER.walk[1]); d.taskT = rand(2, 5); }
    }
  }

  function stepHerd(H, dt, o, animate) {
    const at = o.at, dist = at ? Math.hypot(at.x - H.mid.x, at.z - H.mid.z) : 1e9;
    const shy = H.shy || DEER, k = o.onHorse ? DEER.horse : 1;
    const alertR = shy.alert * k, fleeR = shy.flee * k;
    const moving = (o.speed || 0) > 0.4;   // (the player walking or riding, not standing still)
    // (the nearest deer, not the herd's middle: a deer at the edge sees you first)
    let near = dist; if (at) for (const d of H.deer) near = Math.min(near, Math.hypot(at.x - d.x, at.z - d.z));
    H.t += dt;
    switch (H.state) {
      case 'calm':
        if (H.faceT > 0 && (H.faceT -= dt) <= 0) for (const d of H.deer) d.face = null;
        for (const d of H.deer) calmDeer(H, d, dt);
        if ((H.moveT -= dt) <= 0) {   // (now and then the whole herd drifts on a little)
          H.moveT = rand(25, 50);
          const kn = H.keepNear, out = kn ? Math.hypot(H.mid.x - kn.x, H.mid.z - kn.z) : 0;
          const back = kn && (out < kn.min - 2 || out > kn.max + 2);
          let x, z;
          if (back) {
            // (out of its band round the spot (walked off after its pictures, or bolted): back toward it, a stretch at a
            // time and sooner than a drift, to the side of the spot its home is on)
            const hx = H.home.x - kn.x, hz = H.home.z - kn.z, hl = Math.hypot(hx, hz) || 1, rr = Math.min(kn.max, Math.max(kn.min, hl));
            const tx = kn.x + hx / hl * rr, tz = kn.z + hz / hl * rr, tl = Math.hypot(tx - H.mid.x, tz - H.mid.z) || 1, st = Math.min(tl, DEER.roam);
            x = H.mid.x + (tx - H.mid.x) / tl * st; z = H.mid.z + (tz - H.mid.z) / tl * st;
            H.moveT = rand(8, 14);
          } else {
            const a = rand(-Math.PI, Math.PI), r = rand(4, DEER.roam);
            x = H.mid.x + Math.sin(a) * r; z = H.mid.z + Math.cos(a) * r;
          }
          const kd = kn ? Math.hypot(x - kn.x, z - kn.z) : 0;
          // (a calm herd never drifts toward the player; but on its way back to its band it may, so long as it stays
          // well clear of them: the player is often standing by the spot it is coming back to)
          const pd = at ? Math.hypot(x - at.x, z - at.z) : Infinity;
          const towardPlayer = shy.calm && at && (back ? pd < alertR + DEER.spread + 6 : pd < Math.max(dist, alertR + DEER.spread));
          if (free(x, z) && Math.hypot(x - sq.x, z - sq.z) > DEER.keepFrom && !busy(x, z) && (!kn || back || (kd >= kn.min && kd <= kn.max)) && !towardPlayer) H.mid = { x, z };
        }
        if (at && (shy.calm ? near < fleeR && moving : near < fleeR || (o.speed > DEER.gallop && near < alertR))) run(H, at.x, at.z, true);
        else if (at && near < alertR) { H.state = 'alert'; H.t = 0; H.alertFrom = near; }
        break;
      case 'alert':
        for (const d of H.deer) { d.goal = null; d.task = 'Idle'; if (at) d.face = Math.atan2(at.x - d.x, at.z - d.z); }
        if (at && (shy.calm ? near < fleeR && moving : near < fleeR || o.speed > DEER.gallop || (H.t > DEER.look && near < H.alertFrom - 4))) run(H, at.x, at.z, true);
        else if (!at || near > alertR + 8) { H.state = 'calm'; for (const d of H.deer) { d.face = null; d.taskT = rand(1, 4); } }
        break;
      case 'flee': case 'leave':
        if (H.deer.every((d) => !d.goal)) {
          H.state = 'calm'; H.moveT = rand(25, 50);
          for (const d of H.deer) { d.task = 'Idle'; d.taskT = rand(DEER.calmAfter[0], DEER.calmAfter[1]); if (H.fleeFrom) d.face = Math.atan2(H.fleeFrom.x - d.x, H.fleeFrom.z - d.z); }
          H.faceT = DEER.calmAfter[0];   // (they look back the way they came for a few seconds)
        }
        break;
      case 'pose':
        // (standing for the camera: no walking off, just a change of clip now and then)
        for (const d of H.deer) if (!d.goal && (d.taskT -= dt) <= 0) { d.task = ['Idle', 'Idle_2', 'Idle_Headlow', 'Idle'][Math.floor(Math.random() * 4)]; d.taskT = rand(4, 9); }
        break;
    }
    // (two deer never stand in one another)
    for (let i = 0; i < H.deer.length; i++) for (let j = i + 1; j < H.deer.length; j++) {
      const p = H.deer[i], q = H.deer[j], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz);
      if (l < 1.3 && l > 1e-3) { const push = (1.3 - l) * 0.5 * Math.min(1, dt * 6); p.x -= dx / l * push; p.z -= dz / l * push; q.x += dx / l * push; q.z += dz / l * push; }
    }
    for (const d of H.deer) stepDeer(H, d, dt, animate);
  }

  D.update = (dt, o = {}) => {
    if (disposed || !D.herds.length) return;
    frame++;
    const eye = o.eye || o.at;
    for (const H of D.herds) {
      const dist = eye ? Math.hypot(eye.x - H.mid.x, eye.z - H.mid.z) : 0;
      H.dist = dist;
      // (a herd running or posing is never left alone: it has somewhere to be)
      const show = dist < DEER.far || H.state === 'pose';
      if (show !== H.shown) { H.shown = show; H.group.visible = show; H.group.matrixWorldAutoUpdate = show; if (show) H.acc = 0; }
      if (!show && H.state !== 'flee' && H.state !== 'leave') continue;
      const shadows = dist < DEER.shadow;
      if (shadows !== H.shadows) { H.shadows = shadows; for (const d of H.deer) d.a.mesh.castShadow = shadows; }
      stepHerd(H, dt, o, show);
      // the clips: every frame near, every third frame further off (with the time saved up)
      H.acc += dt;
      if (show && (dist < DEER.mid || frame % DEER.midEvery === 0)) { for (const d of H.deer) d.a.update(H.acc); H.acc = 0; }
    }
  };

  D.herd = (id) => D.herds.find((h) => h.id === id) || null;
  D.nearest = (at, { except = null } = {}) => {
    let best = null, bd = Infinity;
    for (const H of D.herds) { if (H === except) continue; const d = Math.hypot(at.x - H.mid.x, at.z - H.mid.z); if (d < bd) { bd = d; best = H; } }
    return best;
  };
  D.state = () => D.herds.map((H) => ({ id: H.id, state: H.state, mid: { x: +H.mid.x.toFixed(1), z: +H.mid.z.toFixed(1) }, dist: Math.round(H.dist), shown: H.shown,
    deer: H.deer.map((d) => ({ kind: d.kind, x: +d.x.toFixed(1), z: +d.z.toFixed(1), v: +d.v.toFixed(2), clip: d.a.clip })) }));
  D.dispose = () => {
    disposed = true;
    for (const H of D.herds) { for (const d of H.deer) d.a.dispose(); H.group.removeFromParent(); }
    D.herds.length = 0;
  };

  D.ready = Promise.all([animals.need('deer'), animals.need('stag')]).then(() => {
    if (disposed) return D;
    for (const def of DEER.herds) D.herds.push(makeHerd(def, animals));
    return D;
  }).catch((e) => { console.warn('the deer could not load', e); return D; });
  return D;
}
