// TRAFFIC: wagons on the road through the valley, as town life (src/wagon.js makes each one). The town is never long
// without one: riding out, there is already a wagon rolling in toward the square (it gets there in about half a
// minute), often another standing in town, and more on their way in from both ends of the valley. A wagon drives in
// along the road on its right-hand side; many pull off and stand a while at a spot (beside the general store or across
// the street from it, in front of the stable, across from the stage, out by the cow camp) with the team shifting about
// and the driver down on the ground; then they drive on out the other way and are gone.
// A few more wagons stand about for good, with no driver (beside the stable, behind the store and the saloon, at the
// camps): see STANDING below.
// They keep a safe distance: each driver looks along the way ahead of the team, and slows and stops for the player (on
// foot or riding), the player's horse, the dog, the cattle of the round-up, townsfolk walking across the square (the
// general store's customers) and the wagon in front, and moves on again once the way is clear. (Nobody has to pull off
// the road for them: a driver held up a few seconds by someone standing still in the road steers round them.) The town's chickens get out of a wagon's way themselves (src/townlife.js).
// They cost little far away: a wagon is only made (its model, its team, its driver) while it is within TRAFFIC.show
// metres of the player, the nearest few at most (TRAFFIC.made); beyond that it is just a number moving along the road.
//
//   const T = makeTraffic({ W, scene, animals, folk, audio, obstacles, camps })
//        audio: src/audio/audio.js's (each wagon near enough rumbles, creaks and clops: src/audio/wagonsound.js);
//        obstacles(): the things to stop for this frame: a list of Vector3s (or objects with a .position, or { x, z }); called once
//        a frame while a wagon is near; camps(): the camps (src/camps.js), for the stops and standing wagons out there
//   T.update(dt, at, ears)   each frame while riding: at = the player's position, ears = the camera's
//   T.wagons           the travellers: { kind, dir, u (m along the road), wg (the wagon while it is made, else null), ... }
//   T.standing         the wagons standing about for good: { kind, x, z, heading, wg }
//   T.road             the road (a CatmullRomCurve3; roadCurve in src/wagon.js)    T.ready  a promise (the files)
//   T.send(dir, kind)  start one now (dev): dir +1 from the west, -1 from the east; returns the traveller
//   T.sendNear(at, { dir, back, kind, stop, park })   (dev and rigs) one starting `back` metres (default 70) up the
//                      road from the spot on it nearest to `at`, coming toward it (stop: false, it won't pull up in
//                      town; park: a spot's name, it pulls off there)
//   T.standAt(name, time)   (dev and rigs) a wagon standing at that spot now, for `time` seconds (or null: taken)
//   T.hold = true      no new wagons set off (the ones on the road drive on and leave); false lets them come again
//   T.keepView = camera   (the general store's counter, while it is worked) no wagon drives through that camera's
//                      picture: they hold short of the stretch of road it sees, and one already in it when the counter
//                      opens is hidden until it is out of it again; null lets them through
//   T.state()          for rigs: { loaded, wagons: [{ kind, dir, u, pace, made, why, park }], spots, standing }
//   T.dispose()
import * as THREE from 'three';
import { loadWagons, makeWagon, standWagon, roadCurve, wagonAt, WAGON_KINDS } from './wagon.js';
import { makeWagonSound } from './audio/wagonsound.js';

export const TRAFFIC = {
  most: { gaming: 12, normal: 12, potato: 7 },  // wagons on the road at once (the far ones are only numbers)
  made: { gaming: 6, normal: 4, potato: 3 },     // ... and at most this many made and drawn at once (the nearest:
                                                 // about 0.6 ms a frame each on gaming, measured with
                                                 // ~/pw/bandit-math/rigs/wagonlife/fps.cjs)
  first: [20, 32],          // s: the first wagon reaches the square this long after riding out (in sight from the start)
  every: [20, 45],          // s between one setting off and the next
  reach: 360,               // m along the road either side of the square: wagons come in from about there (out of sight
                            // of the town) and are gone once past it on the far side, unseen. (Near there, the player
                            // sees them come from the road's ends and go off to them, as before)
  speed: [1.5, 2.1],        // m/s: an easy walk for a loaded team
  lane: 1.3,                // m right of the road's middle each wagon keeps to (so two can pass)
  show: 230,                // m from the player within which a wagon is made and drawn
  hide: 260,                // ... and past which it is put away again
  look: 4,                  // m beyond its stopping distance a driver looks ahead of the team
  wide: 1.7,                // m either side of its lane it looks
  gap: 3,                   // m it stops short of what is in its way (from the lead horses' noses)
  wait: 1.2,                // s the way must be clear before it moves off again
  oncoming: 70,             // m ahead a driver looks for a wagon coming the other way, where the road narrows to one lane
  // how often one pulls up in the square, for how long (s), and how far past the square's middle it stops (m), by the way
  // it is going (east = +1, west = -1). An eastbound wagon pulls up just short of the middle instead: further on it
  // would stand in the street in front of the general store (about 20 m east of the middle), right in the picture of
  // the store counter's camera (src/missions/store.js STORE.cam) for the whole stop. Measured with
  // ~/pw/bandit-math/rigs/fixer-r2/stopview.cjs: a wagon is out of that picture west of about 6 m past the middle.
  // (none now: a wagon standing in the middle of the square was in the way of every walk between the buildings; the
  // SPOTS below are where they stand a while instead)
  stop: { chance: 0, time: [15, 35], at: { 1: -8, '-1': 14 } },
  // pulling off to stand a while at one of the SPOTS: how often (when one on its way is free), how long it stands (s);
  // the swing off the road and back on takes `pull` metres of road each way (more for a spot further off it), along
  // `run` metres of its lane before and after (so the team is on its lane when it turns off and when it is back)
  park: { chance: 0.6, time: [40, 100], pull: 16, run: 14, clear: 45 },
  choose: 120,              // m before the square a wagon picks where it stops (a spot free then, or the square)
  // the store counter's picture (T.keepView): the stretch of road its camera sees nearer than `far` metres, or that
  // passes within `near` metres of it, and `pad` metres more each end (a wagon's half length and a little)
  view: { far: 45, near: 9, pad: 7 },
  swap: 20,                 // m: with the drawn ones at their most, a wagon this much nearer than the farthest drawn one
                            // takes its place (that one is put away)
  // going round something that stands in its way (the player stood in the road, a horse, a customer): after `after`
  // seconds stopped for it the driver steers the team round it, on whichever side is open, keeping `clear` metres from
  // it (at most `most` metres off its lane; over the road's middle only with nobody coming the other way within `oncoming`),
  // the turn out taking at least `ease` metres and the turn back `back` metres, `past` metres beyond it
  around: { after: 3, clear: 2.6, most: 5, ease: 3.5, back: 8, past: 2.5, oncoming: 60 },
};
// where a wagon pulls off to stand a while: the middle of the wagon when it stands there (x, z: metres), facing along
// the road the way it came, always on its own right-hand side of the road (so it never crosses the other lane); look:
// where the driver, down on the ground, faces (a door). Each was picked off a map of the town (blocked ground, doors,
// paths; ~/pw/bandit-math/rigs/wagonlife/map.cjs) and is checked when the road is made: a spot whose way off and on
// isn't clear is left out. None is in the picture of the store counter's camera (it looks from the street west of the
// store's door, toward the sheriff's office) or in front of a door.
export const SPOTS = [
  { name: 'store', x: 27, z: -200.6, look: 'store' },            // just east of the general store, on its side of the street
  { name: 'stable', x: -56, z: -199.6, look: 'stable' },         // in front of the stable, west of its door
  { name: 'stage', x: -38, z: -214.4, look: 'saloon' },          // across the street from the stage and the saloon
  { name: 'across', x: 23, z: -212.4, look: 'store' },           // across the street from the general store
  { name: 'cowcamp', camp: 'cow', lx: -13, lz: 5, look: 'camp' }, // beside the cow camp, on the road's side of it
];
// wagons standing about for good, with no driver: where (x, z: their middle) and the way they face (radians, as three's
// rotation.y), or at a camp: in its own frame (lx across, lz toward its front, which faces the town; turn: from the
// camp's way). team: still hitched, the horses standing (moved only while the player is near). Each is checked when
// it is made (clear of buildings, fences, trees and the road; on fairly flat ground) and nudged a little if it must be.
export const STANDING = [
  { kind: 'farm', x: -51.5, z: -185.2, heading: 2.88 },          // beside the stable, its tongue toward the road
  { kind: 'freight', x: 16.5, z: -187, heading: 2.36 },          // behind the general store
  { kind: 'covered', x: -6, z: -162, heading: -0.785 },          // behind the saloon
  { kind: 'chuck', camp: 'cow', lx: -6.5, lz: -3, turn: Math.PI / 2 },
  { kind: 'covered', camp: 'hollis', lx: 7, lz: -2, turn: -Math.PI / 2, team: true },
  { kind: 'freight', camp: 'survey', lx: -6.5, lz: -1, turn: Math.PI / 2 },
];
const rnd = (a, b) => a + Math.random() * (b - a);
const NOWHERE = { x: 1e6, y: 0, z: 1e6 };   // (ears too far off to hear a wagon)

export function makeTraffic({ W, scene = W.scene, animals, folk, audio = null, obstacles = () => [], camps = () => null }) {
  const road = roadCurve(W, 'through'), L = road.getLength();
  // where the square is along the road (m), and the road's points every 2 m (for "the nearest place on the road")
  const along = [];
  let square = 0;
  { const sq = W.places.square, P = new THREE.Vector3(); let best = Infinity;
    for (let s = 0; s <= L; s += 2) { road.getPointAt(s / L, P); along.push([s, P.x, P.z]); const d = Math.hypot(P.x - sq.x, P.z - sq.z); if (d < best) { best = d; square = s; } } }
  const nearestU = (x, z) => { let best = Infinity, u = 0; for (const [s, px, pz] of along) { const d = (px - x) ** 2 + (pz - z) ** 2; if (d < best) { best = d; u = s; } } return { u, d: Math.sqrt(best) }; };
  const tier = W.tier in TRAFFIC.most ? W.tier : 'normal';
  const most = TRAFFIC.most[tier], madeMost = TRAFFIC.made[tier];
  const T = { road, wagons: [], standing: [], lib: null, ready: null, square, hold: false };
  const spots = SPOTS.map((S) => ({ ...S }));   // (this ride's own: which wagon has each, and the way to it)
  let disposed = false, timer = rnd(...TRAFFIC.every) * 0.6, nextDir = Math.random() < 0.5 ? 1 : -1, sent = 0, clock = 0;
  T.ready = loadWagons({ animals, folk }).then((lib) => { if (!disposed) { T.lib = lib; standAbout(); } return lib; })
    .catch((e) => { console.error('traffic: the wagons could not load', e); });

  // a point on the road s metres along, out to the right of the way it is going by the lane
  const _p = new THREE.Vector3(), _t = new THREE.Vector3();
  // (in toward the middle, or out, where the road is tight: road.laneAt in src/wagon.js)
  const laneAt = (s, dir) => (road.laneAt ? road.laneAt(s, dir, TRAFFIC.lane) : TRAFFIC.lane);
  // (extra: metres more to the right, e.g. a wagon's step round something: wagon.offsetAt)
  function spot(s, dir, out, extra = 0) {
    const u = Math.min(1, Math.max(0, s / L)), k = laneAt(s, dir) + extra; road.getPointAt(u, out); road.getTangentAt(u, _t);
    out.x += -_t.z * dir * k; out.z += _t.x * dir * k;
    return out;
  }

  // ── THE SPOTS: the way off the road to each, and back on ────────────────────────────────────────────────────────
  // A spot's way (made the first time it is wanted): a curve that runs along the lane for `run` metres, swings off to
  // the spot over `pull` metres of road, runs straight through it, swings back and runs along the lane again. Driving
  // it, the wagon's distance along it (du) says where it is: before `off` it is still on its lane, between `off` and
  // `on` it is off the road (the wagons behind pass it), at `park` it stands, at `join` it is back on the road.
  function wayTo(S, dir) {
    if (S.ways && S.ways[dir] !== undefined) return S.ways[dir];
    S.ways = S.ways || {};
    let x = S.x, z = S.z;
    if (S.camp) { const C = camps && camps(), c = C && C.byId && C.byId(S.camp); if (!c) return null; const p = c.at(S.lx, S.lz); x = p.x; z = p.z; S.x = x; S.z = z; }
    const { u: us, d: off } = nearestU(x, z);
    // (only on the right-hand side of the way it is going)
    road.getTangentAt(us / L, _t);
    road.getPointAt(us / L, _p);
    const right = ((x - _p.x) * -_t.z + (z - _p.z) * _t.x) * dir;
    if (right <= 0) return (S.ways[dir] = null);
    const pull = Math.max(TRAFFIC.park.pull, off * 1.6), run = TRAFFIC.park.run;
    const fx = _t.x * dir, fz = _t.z * dir;   // (the way it faces standing there: along the road the way it came)
    const pts = [], P = new THREE.Vector3();
    const lane = (s) => { spot(s, dir, P); pts.push(new THREE.Vector3(P.x, W.heightAt(P.x, P.z), P.z)); };
    const u0 = us - dir * (pull + run), uA = us - dir * pull, uB = us + dir * pull, u1 = us + dir * (pull + run);
    if (Math.min(u0, u1) < 2 || Math.max(u0, u1) > L - 2) return (S.ways[dir] = null);
    for (let s = u0; (s - uA) * dir <= 0.01; s += dir * 2) lane(s);
    for (const k of [-6, 0, 6]) { const px = x + fx * k, pz = z + fz * k; pts.push(new THREE.Vector3(px, W.heightAt(px, pz), pz)); }
    for (let s = uB; (s - u1) * dir <= 0.01; s += dir * 2) lane(s);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); curve.arcLengthDivisions = pts.length * 12;
    const Ld = curve.getLength();
    // the distances along it: where it leaves the lane, stands, comes back on, and joins the road again
    const at = (q) => { let best = Infinity, b = 0; for (let k = 0; k <= Ld; k += 0.25) { curve.getPointAt(k / Ld, P); const d = (P.x - q.x) ** 2 + (P.z - q.z) ** 2; if (d < best) { best = d; b = k; } } return b; };
    const way = { curve, L: Ld, dir, us, uIn: u0, uOut: u1 - dir * run / 2, x, z, face: Math.atan2(fx, fz), S };
    way.off = run; way.park = at({ x, z }); way.on = Ld - run; way.join = Ld - run / 2;
    // (it must be clear the whole way, a wagon's width and a little more)
    for (let k = run - 2; k <= way.on + 2; k += 0.5) {
      curve.getPointAt(k / Ld, P); curve.getTangentAt(k / Ld, _t); const n = Math.hypot(_t.x, _t.z) || 1;
      for (const w of [-1.3, -0.65, 0, 0.65, 1.3]) if (W.blocked(P.x + (_t.z / n) * w, P.z - (_t.x / n) * w)) return (S.ways[dir] = null);
    }
    // the road's metres for each metre along it (for keeping the wagons in order)
    way.roadU = (du) => (du <= run ? u0 + dir * du : du >= Ld - run ? u1 - dir * (Ld - du) : uA + (uB - uA) * ((du - run) / Math.max(1, Ld - 2 * run)));
    return (S.ways[dir] = way);
  }
  // a free spot ahead for a wagon going `dir` from u (not one it has passed), or null
  function freeSpot(dir, u) {
    const ok = [];
    for (const S of spots) {
      if (S.by) continue;
      const w = wayTo(S, dir); if (!w) continue;
      if ((w.uIn - u) * dir > 4) ok.push(w);
    }
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
  }

  // what a new wagon will do on its way through: pull off at a spot, pull up in the square, or drive straight on. (The
  // spot itself is picked once it nears town, from those free then: see choose)
  function plan(t) {
    t.stop = null; t.park = null;
    const r = Math.random();
    t.wants = r < TRAFFIC.park.chance ? 'park' : r < TRAFFIC.park.chance + TRAFFIC.stop.chance ? 'stop' : null;
  }
  function choose(t) {
    const want = t.wants; t.wants = null;
    if (want === 'park') { const w = freeSpot(t.dir, t.u); if (w) { t.park = w; w.S.by = t; return; } }
    if (want === 'stop') {
      const at = square + t.dir * TRAFFIC.stop.at[t.dir];
      if ((at - t.u) * t.dir > 2) t.stop = at;
    }
  }
  T.send = (dir = nextDir, kind = null, u = null) => {
    nextDir = -dir;
    const t = {
      kind: kind || WAGON_KINDS[sent % WAGON_KINDS.length], dir, u: u != null ? u : dir > 0 ? 0 : L, speed: rnd(...TRAFFIC.speed), pace: 0,
      stop: null, park: null, way: null, du: 0, until: 0, clearFor: 0, wg: null, why: '', number: sent++,
    };
    t.pace = t.speed;
    plan(t);
    T.wagons.push(t);
    return t;
  };
  function make(t) {
    const wg = makeWagon(T.lib, { kind: t.kind, W, look: null });
    if (t.way) { wg.lane = 0; wg.setPath(t.way.curve, { at: t.du / t.way.L, dir: 1 }); }
    else { wg.lane = TRAFFIC.lane; wg.setPath(road, { at: t.u / L, dir: t.dir }); }
    wg.pace = t.pace; wg.speed = t.pace;
    scene.add(wg.root); t.wg = wg;
    if (view && inStretch(t)) { t.ghost = true; wg.root.visible = false; }   // (made inside the counter's picture: unseen there)
    if (t.way && !t.left && t.du >= t.way.park - 0.4) t.stoodAt = -1e9;   // (made standing: the driver is down already)
    t.sound = audio ? makeWagonSound(audio, wg) : null;
  }
  function unmake(t) {
    if (t.sound) { t.sound.dispose(); t.sound = null; }
    if (t.wg) { t.wg.dispose(); t.wg = null; }
    t.ghost = false;
  }

  // ── THE STORE COUNTER'S PICTURE ─────────────────────────────────────────────────────────────────────────────────
  // While the general store's counter is worked its camera stands out in the street, looking across at the rider and
  // the customer (src/missions/store.js STORE.cam), so a wagon driving by passed right in front of the lens. Then
  // (T.keepView set to that camera) the wagons hold short of the stretch of road the camera sees, and drive on once the
  // counter is closed. One already in that stretch when the counter opens (the picture cuts to the counter, so nobody
  // sees it go) is hidden until it is out of it again; one parked by the road waits there rather than pull out into it.
  let view = null;
  const _vf = new THREE.Frustum(), _vm = new THREE.Matrix4(), _vp = new THREE.Vector3();
  function viewStretch(cam) {
    cam.updateMatrixWorld(); _vm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _vf.setFromProjectionMatrix(_vm);
    const V = TRAFFIC.view; let a = Infinity, b = -Infinity;
    for (const [s0] of along) for (const dir of [1, -1]) for (const up of [0.3, 1.5, 2.8]) {
      spot(s0, dir, _vp); _vp.y = W.heightAt(_vp.x, _vp.z) + up;
      const d = _vp.distanceTo(cam.position);
      if (d < V.near || (d < V.far && _vf.containsPoint(_vp))) { a = Math.min(a, s0); b = Math.max(b, s0); }
    }
    return a <= b ? { a: a - V.pad, b: b + V.pad } : null;
  }
  const inStretch = (t) => !!view && t.u > view.a && t.u < view.b;
  function setView(cam) {
    if (cam && !view) {
      view = viewStretch(cam);
      if (view) for (const t of T.wagons) if (t.wg && inStretch(t)) { t.ghost = true; t.wg.root.visible = false; }
    } else if (!cam && view) {
      view = null;
      for (const t of T.wagons) if (t.ghost) { t.ghost = false; if (t.wg) t.wg.root.visible = true; }   // (the picture cuts back: shown again)
    }
  }
  function release(t) { if (t.park && t.park.S.by === t) t.park.S.by = null; t.park = null; }
  T.sendNear = (at, { dir = Math.random() < 0.5 ? 1 : -1, back = 70, kind = null, stop = true, park = null } = {}) => {
    const s0 = nearestU(at.x, at.z).u;
    const t = T.send(dir, kind, Math.min(L - 1, Math.max(1, s0 - dir * back)));
    release(t); t.stop = null;
    t.wants = null;
    if (park) {
      const S = spots.find((q) => q.name === park), w = S && !S.by && wayTo(S, dir);
      if (w && (w.uIn - t.u) * dir > 0) { t.park = w; S.by = t; }
    } else if (stop) { plan(t); choose(t); }
    return t;
  };

  // a wagon standing at a spot's way w now, for `time` seconds more
  function standAt(w, time = rnd(...TRAFFIC.park.time)) {
    const t = T.send(w.dir);
    release(t); t.stop = null; t.wants = null;
    t.park = w; w.S.by = t; t.way = w; t.du = w.park; t.u = w.roadU(w.park); t.pace = 0; t.until = clock + time;
    return t;
  }
  T.standAt = (name, time) => {
    const S = spots.find((q) => q.name === name); if (!S || S.by) return null;
    const w = wayTo(S, 1) || wayTo(S, -1);
    return w ? standAt(w, time) : null;
  };

  // ── RIDING OUT: the road already busy ───────────────────────────────────────────────────────────────────────────
  // one rolling in toward the square (it gets there in TRAFFIC.first seconds), often one standing at a spot in town,
  // and the rest out along the road both ways (the near ones made at once, with the town)
  (function busyRoad() {
    const d0 = Math.random() < 0.5 ? 1 : -1, first = T.send(d0, null, square - d0 * rnd(...TRAFFIC.first) * 1.8);
    first.speed = 1.8; first.pace = 1.8;
    if (Math.random() < 0.75) {
      const d = -d0, list = spots.filter((S) => !S.by && !S.camp).map((S) => wayTo(S, d)).filter(Boolean);
      if (list.length) standAt(list[Math.floor(Math.random() * list.length)], rnd(12, 45));
    }
    // the rest spaced out along the road, as if they had set off one after another: some coming in (one about every
    // minute to the square, from either side in turn), some on their way out
    // (dir: the way it goes; m: how far from the square, coming in, or gone past it when `out`)
    const away = Math.random() < 0.5 ? 1 : -1;
    const seeds = [{ dir: -d0, m: [90, 130] }, { dir: d0, m: [160, 200] }, { dir: -d0, m: [230, 280] }, { dir: d0, m: [300, TRAFFIC.reach] },
      { dir: away, m: [70, 150], out: true }, { dir: -away, m: [200, 300], out: true }];
    for (const { dir, m, out } of seeds) {
      if (T.wagons.length >= most - 1) break;
      const u = Math.min(L - 2, Math.max(2, square + (out ? dir : -dir) * rnd(...m)));
      if (T.wagons.some((o) => o.dir === dir && Math.abs(o.u - u) < 40)) continue;
      T.send(dir, null, u);
    }
  })();

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
  // off the road at a spot (pulling in, standing, pulling out): the wagons on the road don't wait behind it
  const offRoad = (t) => !!t.way && t.du > t.way.off && t.du < t.way.on;
  // where the way ahead of a wagon is, s metres along whatever it is driving (the road at its lane, or a spot's way)
  function ahead(t, s, out) {
    if (!t.way) return spot(s, t.dir, out, t.wg && t.wg.bend ? t.wg.offsetAt(s) : 0);
    t.way.curve.getPointAt(Math.min(1, Math.max(0, s / t.way.L)), out); return out;
  }
  // what the driver of t wants to do this frame: its wanted speed (0 to stop) and why
  const _a = new THREE.Vector3(), _f = new THREE.Vector3();
  function want(t, now, things, dt) {
    let v = t.speed; t.why = '';
    if (t.way) {
      // standing at its spot: wait, then (when the road behind the place it joins is clear) drive on
      const w = t.way;
      if (t.du >= w.park - 0.4 && !t.left) {
        if (!t.until) t.until = now + rnd(...TRAFFIC.park.time);
        if (now < t.until) { t.why = 'standing at ' + w.S.name; return 0; }
        for (const o of T.wagons) if (o !== t && o.dir === t.dir && !offRoad(o) && ((w.uOut - o.u) * t.dir) > -10 && ((w.uOut - o.u) * t.dir) < TRAFFIC.park.clear) { t.why = 'waiting to pull out'; return 0; }
        if (view && !t.ghost && ((t.dir > 0 ? view.b : view.a) - w.uOut) * t.dir > 0) { t.why = 'waiting: the store counter'; return 0; }
        t.left = true; t.until = 0;
      }
      if (!t.left) { const left = Math.max(0, w.park - t.du); v = Math.min(v, Math.max(0.35, Math.sqrt(2 * 0.6 * left))); }
    } else if (t.stop != null && (t.dir > 0 ? t.u >= t.stop - 0.5 : t.u <= t.stop + 0.5)) {
      // a stop in the square: drive up to it, wait, drive on
      if (!t.until) t.until = now + rnd(...TRAFFIC.stop.time);
      if (now < t.until) { t.why = 'stopped in town'; return 0; }
      t.stop = null; t.until = 0;
    }
    if (!t.way && t.stop != null) {   // easing in to the stop
      const left = Math.abs(t.stop - t.u); v = Math.min(v, Math.max(0.35, Math.sqrt(2 * 0.6 * left)));
    }
    // a one-way stretch ahead (src/wagon.js road.narrows: too narrow for two to pass): it waits short of it while a wagon
    // coming the other way is in it, or will get to it first (nearer its own end of it; just as near: the one that set
    // off first goes). A wagon already in one carries on.
    const way = t.way ? Infinity : giveWay(t);
    if (!t.wg) { if (way < 8) { t.why = 'giving way'; return 0; } return v; }
    let block = way < Infinity ? Math.max(0, way - t.wg.nose) : Infinity;
    if (block < Infinity) t.giveWay = true;
    // the store counter's picture ahead: it holds short of it (not one already inside, hidden: that drives on out)
    if (view && !t.ghost && !(t.way && !t.left)) {
      const e = ((t.dir > 0 ? view.a : view.b) - t.u) * t.dir;
      if (e > -2) { block = Math.min(block, Math.max(0, e - t.wg.nose + TRAFFIC.gap)); t.forView = true; }
    }
    // the way ahead of the team, along its lane: anything in it within the stopping distance (and a bit) stops it
    const wg = t.wg, reach = (wg.pace * wg.pace) / (2 * 1.2) + TRAFFIC.look + TRAFFIC.gap;
    const pd = t.way ? 1 : t.dir, front = wg.u + pd * wg.nose;
    let by = null, byD = Infinity;   // (the nearest thing in the way, and how far ahead)
    for (const q of things) {
      const p = q.isVector3 ? q : q.position || q; if (p.x === undefined) continue;
      // (quick: only things within reach of the team's noses)
      if (Math.abs(p.x - wg.front.x) > reach + 6 || Math.abs(p.z - wg.front.z) > reach + 6) continue;
      for (let d = 0; d <= reach + 0.01; d += 1) {
        ahead(t, front + pd * d, _a);
        if (Math.hypot(p.x - _a.x, p.z - _a.z) < TRAFFIC.wide) { block = Math.min(block, d); if (d < byD) { byD = d; by = p; } break; }
      }
    }
    // the wagon in front, going the same way (not one standing off the road; and none while this one is off it)
    if (!offRoad(t)) for (const o of T.wagons) {
      if (o === t || o.dir !== t.dir || offRoad(o)) continue;
      const gap = (o.u - t.u) * t.dir - (o.wg ? o.wg.tail + wg.nose : 7);
      if (gap > 0 && gap < reach + 2) block = Math.min(block, gap - 2);
    }
    // stopped a while for something standing in the road (nothing else holding it up): steer round it
    if (by && byD <= block && wg.pace < 0.05 && !t.way) {
      t.heldBy = (t.heldBy || 0) + dt;
      if (t.heldBy >= TRAFFIC.around.after && !wg.bend && (t.noRound = '', goRound(t, by, byD, things))) { t.heldBy = 0; t.why = 'going round'; return 0; }
    } else t.heldBy = 0;
    if (block < Infinity) { t.clearFor = 0; t.why = t.giveWay ? 'giving way' : t.forView ? 'held for the store counter' : 'waiting'; t.giveWay = false; t.forView = false; return block < TRAFFIC.gap ? 0 : Math.min(v, Math.sqrt(2 * 1.2 * (block - TRAFFIC.gap))); }
    if (wg.pace < 0.05 && t.clearFor < TRAFFIC.wait) { t.clearFor += dt; t.why = 'moving off'; return t.clearFor >= TRAFFIC.wait ? v : 0; }
    return v;
  }
  // the driver of t steers round p (a thing standing byD metres ahead of the team's noses): a step sideways off its lane
  // on the open side (wagon.bend), if the ground that way is clear (no wall, fence, other wagon or other thing, and
  // nobody coming the other way when it crosses the road's middle). False: no way round (it waits as before)
  const _g = new THREE.Vector3();
  function goRound(t, p, byD, things) {
    const A = TRAFFIC.around, wg = t.wg, dir = t.dir;
    // where along the road the thing is, and how far to the right of the road's middle
    let sb = 0, best = Infinity;
    for (let k = -2; k <= byD + 3; k += 0.5) {
      const sq = wg.u + dir * (wg.nose + k); road.getPointAt(Math.min(1, Math.max(0, sq / L)), _g);
      const d = (p.x - _g.x) ** 2 + (p.z - _g.z) ** 2; if (d < best) { best = d; sb = sq; }
    }
    road.getPointAt(Math.min(1, Math.max(0, sb / L)), _g); road.getTangentAt(Math.min(1, Math.max(0, sb / L)), _t);
    // (with whatever stands close by it, e.g. the player beside his horse: gone round together)
    const group = [];
    let lo = Infinity, hi = -Infinity;
    for (const q of things) {
      const qp = q.isVector3 ? q : q.position || q; if (qp.x === undefined || Math.hypot(qp.x - p.x, qp.z - p.z) > 4) continue;
      group.push(qp);
      const sd = ((qp.x - _g.x) * -_t.z + (qp.z - _g.z) * _t.x) * dir; lo = Math.min(lo, sd); hi = Math.max(hi, sd);
    }
    if (!group.includes(p)) { group.push(p); const sd = ((p.x - _g.x) * -_t.z + (p.z - _g.z) * _t.x) * dir; lo = Math.min(lo, sd); hi = Math.max(hi, sd); }
    const k0 = laneAt(sb, dir);
    const s0 = wg.u + dir * wg.teamAhead, toIt = (sb - s0) * dir;
    if (toIt < 1) return false;
    const r1 = Math.max(A.ease, toIt - 1.5), hold = Math.max(0, toIt + A.past - r1), r2 = A.back, all = r1 + hold + r2;
    if (Math.min(s0, s0 + dir * all) < 2 || Math.max(s0, s0 + dir * all) > L - 2) return false;
    const tries = [hi + A.clear - k0, lo - A.clear - k0].filter((b) => Math.abs(b) <= A.most).sort((a, b) => Math.abs(a) - Math.abs(b));
    const noseX = wg.nose - wg.teamAhead;
    for (const by of tries) {
      const B = { s0, r1, hold, r2, by };
      wg.bend = B;   // (tried: offsetAt reads it)
      let ok = true, crosses = false, no = '';
      for (let x = 0; x <= all && ok; x += 0.5) {
        const s = s0 + dir * x, o = wg.offsetAt(s);
        spot(s, dir, _g, o);
        if (laneAt(s, dir) + o < 0.6) crosses = true;
        const nx = -_t.z * dir, nz = _t.x * dir;
        for (const w of [-1.25, 0, 1.25]) {
          const px = _g.x + nx * w, pz = _g.z + nz * w;
          if (W.blocked(px, pz)) { ok = false; no = 'blocked ground'; break; }
          if (x > noseX + 0.5) { const G = wagonAt(px, pz, 0.3); if (G && G !== wg) { ok = false; no = 'a wagon'; break; } }
        }
        if (ok) for (const q of things) {
          const qp = q.isVector3 ? q : q.position || q; if (qp.x === undefined || group.includes(qp)) continue;
          if (Math.abs(qp.x - _g.x) < A.clear && Math.abs(qp.z - _g.z) < A.clear && Math.hypot(qp.x - _g.x, qp.z - _g.z) < A.clear - 0.2) { ok = false; no = 'something else'; break; }
        }
      }
      if (ok && crosses) for (const o of T.wagons) {
        if (o === t || o.dir === dir || offRoad(o)) continue;
        const e = (o.u - s0) * dir; if (e > -10 && e < A.oncoming + all) { ok = false; no = 'one coming'; break; }
      }
      if (ok) { t.bendEnd = s0 + dir * all; t.noRound = ''; return true; }
      t.noRound = (t.noRound ? t.noRound + ', ' : '') + `${by.toFixed(1)} m: ${no}`;
    }
    wg.bend = null;
    if (!tries.length) t.noRound = 'too far off its lane';
    return false;
  }
  // onto a spot's way (from its lane), and back onto the road
  function turnOff(t) {
    const w = t.park; t.way = w; t.du = Math.max(0, (t.u - w.uIn) * t.dir); t.left = false; t.until = 0;
    if (t.wg) { t.wg.bend = null; }
    if (t.wg) { t.wg.lane = 0; t.wg.setPath(w.curve, { at: t.du / w.L, dir: 1 }); t.wg.pace = t.pace; }
  }
  function backOn(t) {
    const w = t.way; t.u = w.roadU(t.du); t.way = null; release(t); t.left = false;
    if (t.wg) { if (t.wg.driverDown) t.wg.climbUp(); t.wg.idle = false; t.wg.lane = TRAFFIC.lane; t.wg.setPath(road, { at: t.u / L, dir: t.dir }); t.wg.pace = t.pace; }
  }
  // the driver of a standing wagon gets down (beside the front wheel on the side away from the road, facing the spot's
  // door), and back up a little before it moves off
  const _dp = new THREE.Vector3();
  function driverAt(t, now) {
    const wg = t.wg, w = t.way;
    const standing = w && !t.left && t.du >= w.park - 0.4 && wg.pace < 0.05 && t.until && t.until - now > 2.5;
    wg.idle = !!(standing || (t.why === 'stopped in town'));
    if (standing && !wg.driverDown && now - (t.stoodAt || (t.stoodAt = now)) > 1.5) {
      const s = Math.sin(wg.heading), c = Math.cos(wg.heading);
      spot(w.us, t.dir, _dp);
      const sideX = w.x - _dp.x, sideZ = w.z - _dp.z, n = Math.hypot(sideX, sideZ) || 1;
      const out = wg.width / 2 + 0.8, x = wg.pos.x + (sideX / n) * out + s * 1.6, z = wg.pos.z + (sideZ / n) * out + c * 1.6;
      const lk = w.S.look === 'camp' ? (camps && camps() && camps().byId(w.S.camp)) : W.places[w.S.look];
      const face = lk ? Math.atan2(lk.x - x, lk.z - z) : wg.heading;
      if (!W.blocked(x, z)) wg.climbDown(x, z, face);
    }
    if (!standing) { t.stoodAt = 0; if (wg.driverDown) wg.climbUp(); }
  }

  // ── THE STANDING WAGONS ─────────────────────────────────────────────────────────────────────────────────────────
  // each one where STANDING says, if it fits there (else nudged up to 4 m, or turned a little; else left out)
  const roadNear = (x, z, r) => { for (const [, px, pz] of along) if (Math.abs(px - x) < r && Math.abs(pz - z) < r && Math.hypot(px - x, pz - z) < r) return true; return false; };
  function fits(x, z, h, len, team) {
    const s = Math.sin(h), c = Math.cos(h), front = team ? 7.5 : 4.4, hs = [];
    for (let a = -2; a <= front; a += 0.5) for (const w of [-1.2, 0, 1.2]) {
      const px = x + s * a + c * w, pz = z + c * a - s * w;
      if (W.blocked(px, pz) || roadNear(px, pz, 4.5)) return false;
      hs.push(W.heightAt(px, pz));
    }
    for (const p of W.places.buildings || []) if (p.door && Math.hypot(p.door.x - x, p.door.z - z) < 7) return false;
    return Math.max(...hs) - Math.min(...hs) < 0.8;
  }
  function standAbout() {
    const C = camps && camps();
    for (const D of STANDING) {
      let x = D.x, z = D.z, h = D.heading || 0;
      if (D.camp) {
        const c = C && C.byId && C.byId(D.camp); if (!c) continue;
        const p = c.at(D.lx, D.lz); x = p.x; z = p.z; h = c.rot + (D.turn || 0);
        // (clear of the camp's foreman, its people and where crates are unloaded)
      }
      let ok = null;
      search: for (const r of [0, 1, 2, 3, 4]) for (let k = 0; k < (r ? 8 : 1); k++) for (const dh of [0, 0.2, -0.2]) {
        const px = x + r * Math.cos(k * Math.PI / 4), pz = z + r * Math.sin(k * Math.PI / 4);
        if (D.camp && C) { const c = C.byId(D.camp), keep = [c.foreman, c.drop, c.unload].filter(Boolean); if (keep.some((q) => Math.hypot(q.x - px, q.z - pz) < 5)) continue; }
        if (fits(px, pz, h + dh, 0, !!D.team)) { ok = { x: px, z: pz, heading: h + dh }; break search; }
      }
      if (!ok) { T.standing.push({ kind: D.kind, at: D.camp || `${x},${z}`, wg: null, fit: false }); continue; }
      const wg = standWagon(T.lib, { kind: D.kind, W, ...ok, team: !!D.team, shadows: tier !== 'potato' });
      scene.add(wg.root);
      T.standing.push({ kind: D.kind, at: D.camp || 'town', ...ok, team: !!D.team, wg, fit: true });
    }
  }

  T.update = (dt, at, ears = at) => {
    if (disposed || !at) return;
    clock += dt;
    // a new one now and then: from out of sight of the town (or, when the player is out there, from the road's end)
    timer -= dt;
    if (timer <= 0 && T.lib) {
      timer = rnd(...TRAFFIC.every);
      let dir = nextDir, u = null;
      for (let k = 0; k < 2 && u == null; k++, dir = -dir) {
        for (const s of [square - dir * TRAFFIC.reach, dir > 0 ? 0 : L]) {
          const q = Math.min(L, Math.max(0, s)); spot(q, dir, _f);
          if (Math.hypot(_f.x - at.x, _f.z - at.z) > TRAFFIC.hide && !T.wagons.some((o) => o.dir === dir && Math.abs(o.u - q) < 30)) { u = q; break; }
        }
        if (u != null) break;
      }
      if (!T.hold && u != null && T.wagons.length < most) T.send(dir, null, u);
    }
    setView(T.keepView || null);
    // which are made: the nearest few within TRAFFIC.show. At most one is made a frame (making one is the costly
    // part); with the most made already, a wagon well nearer than the farthest made one takes its place
    let made = 0;
    for (const t of T.wagons) {
      if (t.way) t.u = t.way.roadU(t.du);
      spot(t.u, t.dir, _f); t.dist = Math.hypot(_f.x - at.x, _f.z - at.z);
      if (t.wg) { if (t.dist > TRAFFIC.hide) unmake(t); else made++; }
      if (t.ghost && !inStretch(t)) { t.ghost = false; if (t.wg) t.wg.root.visible = true; }   // (out of the counter's picture)
    }
    if (T.lib) {
      let next = null;
      for (const t of T.wagons) if (!t.wg && !t.ended && t.dist < TRAFFIC.show && (!next || t.dist < next.dist)) next = t;
      if (next && made >= madeMost) {
        let far = null;
        for (const t of T.wagons) if (t.wg && (!far || t.dist > far.dist)) far = t;
        if (far && far.dist > next.dist + TRAFFIC.swap) { unmake(far); made--; }
      }
      if (next && made < madeMost) make(next);
    }
    let things = null;
    for (let i = T.wagons.length - 1; i >= 0; i--) {
      const t = T.wagons[i];
      // nearing town: where it will stop, if it stops (TRAFFIC.choose metres before the square)
      if (t.wants && (square - t.u) * t.dir < TRAFFIC.choose) choose(t);
      // a spot ahead: onto its way once at the lane's end of it
      if (!t.way && t.park && (t.u - t.park.uIn) * t.dir >= 0) turnOff(t);
      if (t.wg && !things) things = obstacles() || [];
      const v = want(t, clock, things || [], dt);
      if (t.wg) {
        t.wg.speed = v; t.wg.update(dt); t.pace = t.wg.pace;
        if (t.way) t.du = t.wg.u; else t.u = t.wg.u;
        if (t.wg.bend && (t.wg.u - t.dir * t.wg.tail - t.bendEnd) * t.dir > 0) t.wg.bend = null;   // (round it and back on its lane)
        driverAt(t, clock);
        if (t.sound) t.sound.update(dt, t.ghost ? NOWHERE : ears);   // (a hidden one makes no sound either)
        if (!t.way && t.wg.ended) t.ended = true;
      } else {
        // far away: just a number moving along the road (or a spot's way) at its pace (easing as a wagon does)
        t.pace = t.pace < v ? Math.min(v, t.pace + 0.8 * dt) : Math.max(v, t.pace - 1.8 * dt);
        if (t.way) t.du += t.pace * dt; else t.u += t.dir * t.pace * dt;
        if (!t.way && (t.u <= 0 || t.u >= L)) t.ended = true;
        // (past the far side of town, unseen: gone)
        if (!t.way && (t.u - square) * t.dir > TRAFFIC.reach && t.dist > TRAFFIC.hide) t.ended = true;
      }
      if (t.way && t.du >= t.way.join) backOn(t);
      // gone out of the valley: put away (if the player is right there watching, it waits at the end until they go)
      if (t.ended && (!t.wg || t.dist > TRAFFIC.show * 0.5)) { release(t); unmake(t); T.wagons.splice(i, 1); }
    }
    // the standing wagons with a team: the horses shift about while the player is near enough to see
    for (const S of T.standing) if (S.wg && S.team) {
      const near = Math.hypot(S.x - at.x, S.z - at.z) < 120;
      if (near) S.wg.update(dt);
    }
  };
  T.state = () => ({ loaded: !!T.lib, length: L, square, timer, most, madeMost, view: view ? { a: +view.a.toFixed(1), b: +view.b.toFixed(1) } : null,
    wagons: T.wagons.map((t) => ({ kind: t.kind, dir: t.dir, u: +t.u.toFixed(1), pace: +t.pace.toFixed(2), n: t.number, made: !!t.wg, why: t.why, round: !!(t.wg && t.wg.bend), noRound: t.noRound || '', ghost: !!t.ghost, dist: t.dist != null ? +t.dist.toFixed(1) : null, stop: t.stop, park: t.park ? t.park.S.name : null, off: offRoad(t), down: !!(t.wg && t.wg.driverDown), x: t.wg ? +t.wg.pos.x.toFixed(1) : null, z: t.wg ? +t.wg.pos.z.toFixed(1) : null })),
    spots: spots.map((S) => ({ name: S.name, x: +(+S.x || 0).toFixed(1), z: +(+S.z || 0).toFixed(1), by: S.by ? S.by.number : null, ways: S.ways ? Object.fromEntries(Object.entries(S.ways).map(([d, w]) => [d, !!w])) : null })),
    standing: T.standing.map((S) => ({ kind: S.kind, at: S.at, fit: S.fit, x: S.x != null ? +S.x.toFixed(1) : null, z: S.z != null ? +S.z.toFixed(1) : null, heading: S.heading != null ? +S.heading.toFixed(2) : null, team: !!S.team })) });
  T.dispose = () => {
    disposed = true;
    for (const t of T.wagons) { release(t); unmake(t); }
    T.wagons.length = 0;
    for (const S of T.standing) if (S.wg) S.wg.dispose();
    T.standing.length = 0;
  };
  return T;
}
