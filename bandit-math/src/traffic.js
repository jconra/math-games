// TRAFFIC: wagons travelling the road through the valley now and then, as town life (src/wagon.js makes each one). A
// wagon sets off from one end of the road (the foot of the western hills, or of the eastern ones), drives in along it
// on its right-hand side, often pulls up in the town square for a while, then drives on out the other way and is gone;
// later another comes back. One to three are on the road at a time.
// They keep a safe distance: each driver looks along the road ahead of the team, and slows and stops for the player (on
// foot or riding), the player's horse, the dog, the cattle of the round-up, townsfolk walking across the square (the
// general store's customers) and the wagon in front, and moves on again once the way is clear. (Nobody has to pull off
// the road for them.) The town's chickens get out of a wagon's way themselves (src/townlife.js).
// They cost nothing far away: a wagon is only made (its model, its team, its driver) while it is within TRAFFIC.show
// metres of the player; beyond that it is just a number moving along the road.
//
//   const T = makeTraffic({ W, scene, animals, folk, audio, obstacles })
//        audio: src/audio/audio.js's (each wagon near enough rumbles, creaks and clops: src/audio/wagonsound.js);
//        obstacles(): the things to stop for this frame: a list of Vector3s (or objects with a .position, or { x, z }); called once
//        a frame while a wagon is near
//   T.update(dt, at, ears)   each frame while riding: at = the player's position, ears = the camera's
//   T.wagons           the travellers: { kind, dir, u (m along the road), wg (the wagon while it is made, else null), ... }
//   T.road             the road (a CatmullRomCurve3; roadCurve in src/wagon.js)    T.ready  a promise (the files)
//   T.send(dir, kind)  start one now (dev): dir +1 from the west end, -1 from the east; returns the traveller
//   T.sendNear(at, { dir, back, kind, stop })   (dev and rigs) one starting `back` metres (default 70) up the road
//                      from the spot on it nearest to `at`, coming toward it (stop: false, it won't pull up in town)
//   T.hold = true      no new wagons set off (the ones on the road drive on and leave); false lets them come again
//   T.state()          for rigs: { loaded, wagons: [{ kind, dir, u, pace, made, why }] }
//   T.dispose()
import * as THREE from 'three';
import { loadWagons, makeWagon, roadCurve, WAGON_KINDS } from './wagon.js';
import { makeWagonSound } from './audio/wagonsound.js';

export const TRAFFIC = {
  most: 3,                  // wagons on the road at once (2 on potato)
  first: [8, 25],           // s after riding out before the first one sets off
  every: [70, 160],         // s between one setting off and the next
  speed: [1.5, 2.1],        // m/s: an easy walk for a loaded team
  lane: 1.3,                // m right of the road's middle each wagon keeps to (so two can pass)
  show: 230,                // m from the player within which a wagon is made and drawn
  hide: 260,                // ... and past which it is put away again
  look: 4,                  // m beyond its stopping distance a driver looks ahead of the team
  wide: 1.7,                // m either side of its lane it looks
  gap: 3,                   // m it stops short of what is in its way (from the lead horses' noses)
  wait: 1.2,                // s the way must be clear before it moves off again
  oncoming: 70,             // m ahead a driver looks for a wagon coming the other way, where the road narrows to one lane
  stop: { chance: 0.6, time: [15, 35], at: 14 },   // how often one pulls up in the square, for how long (s), and how far
                            // past the square's middle it stops (m)
};
const rnd = (a, b) => a + Math.random() * (b - a);

export function makeTraffic({ W, scene = W.scene, animals, folk, audio = null, obstacles = () => [] }) {
  const road = roadCurve(W, 'through'), L = road.getLength();
  // where the square is along the road (m)
  let square = 0;
  { const sq = W.places.square, P = new THREE.Vector3(); let best = Infinity;
    for (let s = 0; s <= L; s += 2) { road.getPointAt(s / L, P); const d = Math.hypot(P.x - sq.x, P.z - sq.z); if (d < best) { best = d; square = s; } } }
  const most = W.tier === 'potato' ? Math.min(2, TRAFFIC.most) : TRAFFIC.most;
  const T = { road, wagons: [], lib: null, ready: null, square, hold: false };
  let disposed = false, timer = rnd(...TRAFFIC.first), nextDir = Math.random() < 0.5 ? 1 : -1, sent = 0;
  T.ready = loadWagons({ animals, folk }).then((lib) => { if (!disposed) T.lib = lib; return lib; })
    .catch((e) => { console.error('traffic: the wagons could not load', e); });

  // a point on the road s metres along, out to the right of the way it is going by the lane
  const _p = new THREE.Vector3(), _t = new THREE.Vector3();
  // (in toward the middle, or out, where the road is tight: road.laneAt in src/wagon.js)
  const laneAt = (s, dir) => (road.laneAt ? road.laneAt(s, dir, TRAFFIC.lane) : TRAFFIC.lane);
  function spot(s, dir, out) {
    const u = Math.min(1, Math.max(0, s / L)), k = laneAt(s, dir); road.getPointAt(u, out); road.getTangentAt(u, _t);
    out.x += -_t.z * dir * k; out.z += _t.x * dir * k;
    return out;
  }

  T.send = (dir = nextDir, kind = null) => {
    nextDir = -dir;
    const t = {
      kind: kind || WAGON_KINDS[sent % WAGON_KINDS.length], dir, u: dir > 0 ? 0 : L, speed: rnd(...TRAFFIC.speed), pace: 0,
      stop: Math.random() < TRAFFIC.stop.chance ? square + dir * TRAFFIC.stop.at : null, until: 0, clearFor: 0,
      wg: null, why: '', number: sent++,
    };
    t.pace = t.speed;
    T.wagons.push(t);
    return t;
  };
  function make(t) {
    const wg = makeWagon(T.lib, { kind: t.kind, W, look: null });
    wg.lane = TRAFFIC.lane;
    wg.setPath(road, { at: t.u / L, dir: t.dir }); wg.pace = t.pace; wg.speed = t.pace;
    scene.add(wg.root); t.wg = wg;
    t.sound = audio ? makeWagonSound(audio, wg) : null;
  }
  function unmake(t) {
    if (t.sound) { t.sound.dispose(); t.sound = null; }
    if (t.wg) { t.wg.dispose(); t.wg = null; }
  }
  T.sendNear = (at, { dir = Math.random() < 0.5 ? 1 : -1, back = 70, kind = null, stop = true } = {}) => {
    const P = new THREE.Vector3(); let best = Infinity, s0 = 0;
    for (let s = 0; s <= L; s += 2) { road.getPointAt(s / L, P); const d = Math.hypot(P.x - at.x, P.z - at.z); if (d < best) { best = d; s0 = s; } }
    const t = T.send(dir, kind);
    t.u = Math.min(L - 1, Math.max(1, s0 - dir * back));
    if (!stop || (t.stop != null && (t.stop - t.u) * dir < 0)) t.stop = null;   // (no stop in the square, or already past it)
    return t;
  };

  // a wagon giving way at a one-way stretch: how far its middle is from the stretch it must wait outside (m), or Infinity
  const narrows = road.narrows || [];
  function giveWay(t) {
    let S = null, d = Infinity;
    for (const n of narrows) {
      if (t.u >= n[0] && t.u <= n[1]) return Infinity;   // (in one already)
      const e = ((t.dir > 0 ? n[0] : n[1]) - t.u) * t.dir;
      if (e > 0 && e < d) { d = e; S = n; }
    }
    if (!S || d > TRAFFIC.oncoming) return Infinity;
    for (const o of T.wagons) {
      if (o === t || o.dir === t.dir || o.ended) continue;
      if (o.u >= S[0] && o.u <= S[1]) return d;
      const e = ((o.dir > 0 ? S[0] : S[1]) - o.u) * o.dir;
      if (e > 0 && (e < d || (e === d && o.number < t.number))) return d;
    }
    return Infinity;
  }
  // what the driver of t wants to do this frame: its wanted speed (0 to stop) and why
  const _a = new THREE.Vector3(), _f = new THREE.Vector3();
  function want(t, now, things, dt) {
    // a stop in the square: drive up to it, wait, drive on
    if (t.stop != null && (t.dir > 0 ? t.u >= t.stop - 0.5 : t.u <= t.stop + 0.5)) {
      if (!t.until) t.until = now + rnd(...TRAFFIC.stop.time);
      if (now < t.until) { t.why = 'stopped in town'; return 0; }
      t.stop = null;
    }
    let v = t.speed; t.why = '';
    if (t.stop != null) {   // easing in to the stop
      const left = Math.abs(t.stop - t.u); v = Math.min(v, Math.max(0.35, Math.sqrt(2 * 0.6 * left)));
    }
    // a one-way stretch ahead (src/wagon.js road.narrows: too narrow for two to pass): it waits short of it while a wagon
    // coming the other way is in it, or will get to it first (nearer its own end of it; just as near: the one that set
    // off first goes). A wagon already in one carries on.
    const way = giveWay(t);
    if (!t.wg) { if (way < 8) { t.why = 'giving way'; return 0; } return v; }
    let block = way < Infinity ? Math.max(0, way - t.wg.nose) : Infinity;
    if (block < Infinity) t.giveWay = true;
    // the way ahead of the team, along its lane: anything in it within the stopping distance (and a bit) stops it
    const wg = t.wg, reach = (wg.pace * wg.pace) / (2 * 1.2) + TRAFFIC.look + TRAFFIC.gap;
    const front = wg.u + t.dir * wg.nose;
    for (const q of things) {
      const p = q.isVector3 ? q : q.position || q; if (p.x === undefined) continue;
      // (quick: only things within reach of the team's noses)
      if (Math.abs(p.x - wg.front.x) > reach + 6 || Math.abs(p.z - wg.front.z) > reach + 6) continue;
      for (let d = 0; d <= reach + 0.01; d += 1) {
        spot(front + t.dir * d, t.dir, _a);
        if (Math.hypot(p.x - _a.x, p.z - _a.z) < TRAFFIC.wide) { block = Math.min(block, d); break; }
      }
    }
    // the wagon in front, going the same way
    for (const o of T.wagons) {
      if (o === t || o.dir !== t.dir) continue;
      const gap = (o.u - t.u) * t.dir - (o.wg ? o.wg.tail + wg.nose : 7);
      if (gap > 0 && gap < reach + 2) block = Math.min(block, gap - 2);
    }
    if (block < Infinity) { t.clearFor = 0; t.why = t.giveWay ? 'giving way' : 'waiting'; t.giveWay = false; return block < TRAFFIC.gap ? 0 : Math.min(v, Math.sqrt(2 * 1.2 * (block - TRAFFIC.gap))); }
    if (wg.pace < 0.05 && t.clearFor < TRAFFIC.wait) { t.clearFor += dt; t.why = 'moving off'; return t.clearFor >= TRAFFIC.wait ? v : 0; }
    return v;
  }

  let clock = 0;
  T.update = (dt, at, ears = at) => {
    if (disposed || !at) return;
    clock += dt;
    // a new one now and then
    timer -= dt;
    if (timer <= 0 && T.lib) {
      timer = rnd(...TRAFFIC.every);
      // (from an end the player isn't near, so it never appears in front of them)
      let dir = nextDir;
      for (let k = 0; k < 2; k++) { spot(dir > 0 ? 0 : L, dir, _f); if (Math.hypot(_f.x - at.x, _f.z - at.z) > TRAFFIC.hide) break; dir = -dir; }
      spot(dir > 0 ? 0 : L, dir, _f);
      if (!T.hold && T.wagons.length < most && Math.hypot(_f.x - at.x, _f.z - at.z) > TRAFFIC.hide) T.send(dir);
    }
    let things = null;
    for (let i = T.wagons.length - 1; i >= 0; i--) {
      const t = T.wagons[i];
      if (t.wg) t.u = t.wg.u;
      spot(t.u, t.dir, _f);
      const d = Math.hypot(_f.x - at.x, _f.z - at.z);
      if (!t.wg && d < TRAFFIC.show && T.lib) make(t);
      else if (t.wg && d > TRAFFIC.hide) unmake(t);
      if (t.wg && !things) things = obstacles() || [];
      const v = want(t, clock, things || [], dt);
      if (t.wg) {
        t.wg.speed = v; t.wg.update(dt); t.u = t.wg.u; t.pace = t.wg.pace;
        if (t.sound) t.sound.update(dt, ears);
        if (t.wg.ended) { t.ended = true; }
      } else {
        // far away: just a number moving along the road at its pace (easing as a wagon does)
        t.pace = t.pace < v ? Math.min(v, t.pace + 0.8 * dt) : Math.max(v, t.pace - 1.8 * dt);
        t.u += t.dir * t.pace * dt;
        if (t.u <= 0 || t.u >= L) t.ended = true;
      }
      // gone out of the valley: put away (if the player is right there watching, it waits at the end until they go)
      if (t.ended && d > TRAFFIC.show * 0.5) { unmake(t); T.wagons.splice(i, 1); }
    }
  };
  T.state = () => ({ loaded: !!T.lib, length: L, square, timer, wagons: T.wagons.map((t) => ({ kind: t.kind, dir: t.dir, u: +t.u.toFixed(1), pace: +t.pace.toFixed(2), made: !!t.wg, why: t.why, stop: t.stop })) });
  T.dispose = () => { disposed = true; for (const t of T.wagons) unmake(t); T.wagons.length = 0; };
  return T;
}
