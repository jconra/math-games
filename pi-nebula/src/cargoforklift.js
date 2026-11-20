// HIS FORKLIFT IN CARGO, IN THE GAME (kit/places-plan.js FORKLIFT and CARGO have the game's maker's words and its
// place; the drawing is kit/forklift.js, its round kit/forkliftround.js, its pallets kit/cargopallets.js). Parked in its
// painted place by the shipping desk, it stands in the walls as the room's other furniture does: the player and Cargo's
// people walk round it (src/walls.js, a part added later), wherever it is.
//   const forklift = makeCargoForklift({ W, walls })
//   forklift.update(soon, { camera, feet, dt })   once a frame (feet: () => [Vector3], the player's and Cargo's
//                         people's). soon: the player is in the lift. The file is fetched, and its pallets made, the
//                         first time that is so (as Cargo's people are made then: src/people.js THE PLACES ONLY THE
//                         LIFT GOES TO), never at the game's start; the ride down hides the wait.
//   forklift.ride         FOR CARGO'S PEOPLE (src/people.js, a day's 'drive:forklift'): claim(P) -> the spot beside
//                         its seat to walk to, or null (it is out, or has nothing to carry); step(P, a, dt, H) their
//                         part once there (on, the ride, off); release(P) they are taken away (its round finished at
//                         once, where nobody sees it: the player has left Cargo)
//   forklift.state()      { asked, fetched, standing, warmed, ms, facts, wallsKB, error, round, rounds, waits, ... }
// PUT IN where nobody sees it come: while Cargo is not drawn (the lift's doors are shut on the way down), or else
// while its place is out of the camera's view; and never onto someone standing there (a slow phone's player could be
// down there before the file is). Once in, it stays.
// THE ROUND (2026-11-20, the game's maker, FORK1-1, C: "Now and then one of Cargo's people drives it to carry a pallet:
// from the loading floor by the containers to the shelves, then parks it again"): one of them walks to it, gets on and
// sits in its seat, drives it along the round's ways (kit/forkliftround.js) to a pallet waiting, slides the forks in
// under it and lifts it, carries it to its place on the shelf and sets it down, backs off, drives back, backs into its
// place, gets off and goes on with their day. Its wheels turn as it goes (its back wheels steer); its forks go up and
// down. Carefully: slow, and it stops for anyone (the player too) in its way, or about to be, and waits till they
// have gone. A PALLET ARRIVING: a pallet set on the shelf comes back to the loading floor now and then, so the loading
// floor never runs out: moved where nobody sees it (both places out of the camera's view, nobody near the place it
// comes to), while the forklift is parked.
import * as THREE from 'three';
import { loadForklift, standForklift } from '../kit/forklift.js';
import { STORE, forkliftBox, CARGO, PALLET } from '../kit/places-plan.js';
import { TRUCK, FORKS, DRIVE, PARKED, PLACES, placeById, round, outline, pointGap, palletFoot, ON_FORKS } from '../kit/forkliftround.js';
import { makePallets, warmLoad } from '../kit/cargopallets.js';

const KEY = 'cargo:forklift';
// its shine: the room's own picture of itself, this much (the kit's painted parts have 1.25: kit/materials.js, as the
// station sets them)
const SHINE = 1.25;
// CAREFUL: anyone this near its outline (m, to their middle) where it is or along the next stretch of its way (a metre
// and its stopping distance) stops it; it goes on once nobody has been there for `clear` seconds
const CARE = { near: 0.5, ahead: 1.1, clear: 0.8 };
// GETTING ON AND OFF (s); where its driver stands to get on (m out from its left side, beside the seat); a desk chair's
// cushion over the floor (kit/furniture.js): a person sits on its seat as on a chair, lifted by the difference
// NOW AND THEN: after a round, this long before another (s); how often a pallet may arrive (s), and nobody nearer the
// place it comes to than `clear` (m)
const RIDE = { on: 1.4, off: 1.2, out: 0.42, chair: 0.53, rest: 25, arrive: 3, clear: 1.6 };

export function makeCargoForklift({ W, walls }) {
  const zone = W.room('store');
  const [x0, x1, z0, z1] = forkliftBox();
  const box = new THREE.Box3(new THREE.Vector3(x0, STORE.floor, z0), new THREE.Vector3(x1, STORE.floor + 2.3, z1));
  const _f = new THREE.Frustum(), _m = new THREE.Matrix4();
  const S = { asked: false, fetched: false, standing: false, warmed: false, ms: {}, facts: null, wallsKB: 0, error: null,
    pallets: null, round: null, rounds: 0, waits: 0, waitS: 0, arrivals: 0, snapped: 0, snappedSeen: 0, claims: 0 };
  let F = null, made = null, t0 = 0, cam = null;
  function frustum(camera) { camera.updateMatrixWorld(); _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_m); }
  const seenBox = (b) => !!(zone && zone.group.visible && cam && _f.intersectsBox(b));
  function seen(camera) {
    if (!zone.group.visible || !camera) return false;
    frustum(camera); return _f.intersectsBox(box);
  }
  const inTheWay = (feet) => feet.some((p) => p && p.y > STORE.floor - 1 && p.y < STORE.floor + 1 && p.x > x0 - 0.4 && p.x < x1 + 0.4 && p.z > z0 - 0.4 && p.z < z1 + 0.4);
  function put() {
    const t = performance.now();
    made = standForklift(F);
    zone.group.add(made.group); made.group.updateMatrixWorld(true);
    made.light(W.envAt(new THREE.Vector3((x0 + x1) / 2, STORE.floor + 1, (z0 + z1) / 2)), SHINE);
    const L = walls.add(KEY, { solid: made.solid });
    S.standing = true; S.ms.put = Math.round(performance.now() - t); S.ms.walls = L.ms; S.ms.fromAsked = Math.round(performance.now() - t0);
    S.wallsKB = L.V ? Math.round(L.V.bytes / 1024) : 0;
    // (a pallet on its forks stands in the walls with it, only while it carries one)
    const lb = new THREE.BoxGeometry(PALLET.long, PALLET.top, PALLET.wide).translate(ON_FORKS.x, palletFoot(FORKS.carry) + PALLET.top / 2, 0).applyMatrix4(poseMatrix(PARKED, new THREE.Matrix4()));
    walls.add(KEY + ':load', { solid: [lb], when: () => !!(job && job.carrying) });
  }
  // ITS FIRST DRAWING, where nobody sees it: the first frame Cargo is drawn after it stands (on the ride down, the
  // doors shut, the view still), it is drawn whether in front of the camera or not, so its program is made and its
  // picture sent to the graphics card then, not in the frame the player first turns to it (that frame took 46 ms on
  // the desktop where the frames round it took 6). (warm: 0 not yet, 1 drawn this frame, 2 done)
  let warm = 0;
  const culled = (on) => made.group.traverse((o) => { if (o.isMesh) o.frustumCulled = on; });
  function warmUp() {
    if (warm === 1) { culled(true); warm = 2; S.warmed = true; } else if (zone.group.visible) { culled(false); warm = 1; }
  }

  // ── ITS PALLETS: made the first time the player steps into a lift, a load's piece at a time ─────────────────────
  let pallets = null, building = null;
  const here = new Map();          // place id -> pallet index
  const since = new Map();         // place id -> when a pallet was set there (for which one arrives back first)
  function buildPallets() {
    if (pallets || building === 'done') return;
    if (!building) { building = { loads: [...new Set(CARGO.pallets.map((p) => p.load))], t: 0 }; }
    const t = performance.now();
    if (building.loads.length) { warmLoad(building.loads.shift()); building.t += performance.now() - t; return; }
    const room = (W.R.rooms || []).find((r) => r.id === 'store');
    pallets = makePallets({ zone, lights: W.built.lights || [], sky: room && room.sky });
    zone.group.add(pallets.group);
    CARGO.pallets.forEach((d, i) => { here.set(d.at, i); since.set(d.at, 0); });
    // (each place in the walls while a pallet stands in it)
    for (const q of PLACES) {
      const g = new THREE.BoxGeometry(PALLET.wide, PALLET.top, PALLET.long).translate(q.at[0], STORE.floor + PALLET.top / 2, q.at[1]);
      walls.add('cargo:pallet:' + q.id, { solid: [g], when: () => here.has(q.id) });
    }
    building.t += performance.now() - t;
    S.pallets = { ...pallets.facts, allMs: Math.round(building.t) }; building = 'done';
  }

  // ── WHERE IT IS, AND ITS PARTS ───────────────────────────────────────────────────────────────────────────────────
  const pose = { x: PARKED.x, z: PARKED.z, h: PARKED.h }, parts = { lift: FORKS.rest, front: 0, back: 0, steer: 0 };
  function poseMatrix(p, out) { return out.makeRotationY(p.h).setPosition(p.x, STORE.floor, p.z); }
  const _M = new THREE.Matrix4(), _P0i = poseMatrix(PARKED, new THREE.Matrix4()).invert(), _mv = new THREE.Matrix4();
  function show() {
    made.group.position.set(pose.x, STORE.floor, pose.z); made.group.rotation.set(0, pose.h, 0); made.group.updateMatrixWorld(true);
    made.set(parts);
    // (in the walls where it now stands: its part, made where it parks, stood here)
    const still = Math.abs(pose.x - PARKED.x) < 1e-6 && Math.abs(pose.z - PARKED.z) < 1e-6 && Math.abs(pose.h - PARKED.h) < 1e-9;
    if (still) { walls.place(KEY, null); walls.place(KEY + ':load', null); } else { _mv.multiplyMatrices(poseMatrix(pose, _M), _P0i); walls.place(KEY, _mv); walls.place(KEY + ':load', _mv); }
    // (the pallet on its forks)
    if (job && job.carrying) {
      const f = [Math.cos(pose.h), -Math.sin(pose.h)];
      pallets.move(job.pallet, pose.x + f[0] * ON_FORKS.x, STORE.floor + palletFoot(parts.lift), pose.z + f[1] * ON_FORKS.x, pose.h);   // (its skids along the forks)
    }
    if (driver) seatDriver(driver);
  }

  // ── A ROUND ──────────────────────────────────────────────────────────────────────────────────────────────────
  // job: { from, to, pallet, R (the round), li (its leg), s (m along it), v (m/s), carrying, wait, clear, pause }
  let job = null, driver = null, state = 'parked', rest = 0;
  function pickJob() {
    const full = PLACES.filter((q) => !q.shelf && here.has(q.id)), empty = PLACES.filter((q) => q.shelf && !here.has(q.id));
    if (!full.length || !empty.length) return null;
    const A = full[Math.floor(Math.random() * full.length)], B = empty[Math.floor(Math.random() * empty.length)];
    const R = round(A.id, B.id); if (!R) return null;
    return { from: A.id, to: B.id, pallet: here.get(A.id), R, li: 0, s: 0, v: 0, carrying: false, wait: 0, clear: 0, pause: 0, waiting: false };
  }
  // the pose a way gives at s metres along it
  function wayAt(way, s) {
    let lo = 0, hi = way.length - 1;
    if (s <= 0) return way[0]; if (s >= way[hi].s) return way[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (way[m].s <= s) lo = m; else hi = m; }
    const a = way[lo], b = way[hi], t = (s - a.s) / Math.max(1e-6, b.s - a.s);
    let dh = b.h - a.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, h: a.h + dh * t, turn: t < 0.5 ? a.turn : b.turn, arc: a.arc || b.arc };
  }
  // anyone in its way: where it is and along the next stretch of its way (feet: their positions, the driver's left out)
  function inWay(L, feet) {
    const ahead = L.way ? Math.min(L.way[L.way.length - 1].s, job.s + CARE.ahead + (job.v * job.v) / (2 * DRIVE.slowDown)) : job.s;
    for (let s = job.s; ; s += 0.25) {
      const p = L.way ? wayAt(L.way, Math.min(s, ahead)) : pose;
      for (const o of outline(p, job.carrying)) for (const q of feet) if (q && Math.abs(q.y - STORE.floor) < 1.2 && pointGap(o, q.x, q.z) < CARE.near) return true;
      if (!L.way || s >= ahead) return false;
    }
  }
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function drive(dt, feet) {
    const R = job.R, L = R.legs[job.li];
    if (!L) { home(); return; }
    if (job.pause > 0) { job.pause -= dt; return; }
    if (L.kind === 'forks') {
      // the forks to their height; a pallet taken up rides on them from the start, one set down is let go at the end
      if (L.take && !job.carrying) job.carrying = true;
      const d = L.to - parts.lift, sp = d > 0 ? FORKS.up : FORKS.down;
      parts.lift += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
      if (Math.abs(L.to - parts.lift) < 1e-4) {
        parts.lift = L.to;
        if (L.take) { here.delete(L.take); }
        if (L.leave) { job.carrying = false; here.set(L.leave, job.pallet); since.set(L.leave, clock); pallets.at(job.pallet, L.leave); }
        job.li++; job.s = 0; job.v = 0; job.pause = DRIVE.pause;
      }
      show(); return;
    }
    // driving: carefully, slower round the turns and backing, slowing to a stop at the leg's end; stopped for anyone
    // in its way, till they have been gone a moment
    const end = L.way[L.way.length - 1].s;
    const blocked = inWay(L, feet);
    if (blocked) { if (!job.waiting) { job.waiting = true; S.waits++; } job.clear = 0; } else if (job.waiting) { job.clear += dt; if (job.clear > CARE.clear && job.v < 0.05) job.waiting = false; }
    if (job.waiting) S.waitS += dt;
    const here0 = wayAt(L.way, job.s);
    let want = job.waiting ? 0 : here0.arc ? Math.min(L.speed, DRIVE.turn) : L.speed;
    // (a turn coming: slowed for it before it)
    const soon = wayAt(L.way, Math.min(end, job.s + 0.8)); if (soon.arc) want = Math.min(want, DRIVE.turn);
    want = Math.min(want, Math.sqrt(2 * DRIVE.slowDown * Math.max(0, end - job.s)) + 0.03);
    const acc = want > job.v ? DRIVE.speedUp : job.waiting ? DRIVE.slowDown * 2 : DRIVE.slowDown;
    job.v += Math.sign(want - job.v) * Math.min(Math.abs(want - job.v), acc * dt);
    const ds = Math.min(job.v * dt, end - job.s);
    job.s += ds;
    const p = wayAt(L.way, job.s);
    pose.x = p.x; pose.z = p.z; pose.h = p.h;
    // its wheels: rolling with the way (the back ones further round a turn), the back ones steered for it, eased
    parts.front -= ds * L.dir / TRUCK.front.r;
    const b = TRUCK.base * (wayAt(L.way, Math.min(end, job.s + 0.35)).turn || 0);
    parts.back -= ds * L.dir * Math.sqrt(1 + (TRUCK.base * (p.turn || 0)) ** 2) / TRUCK.back.r;
    const steer = -Math.atan(b); parts.steer += Math.sign(steer - parts.steer) * Math.min(Math.abs(steer - parts.steer), 1.6 * dt);
    // (its forks on their way to where they ride on this leg)
    const fd = L.forks - parts.lift; parts.lift += Math.sign(fd) * Math.min(Math.abs(fd), (fd > 0 ? FORKS.up : FORKS.down) * dt);
    if (end - job.s < 1e-4 && job.v < 0.08) { job.li++; job.s = 0; job.v = 0; job.pause = DRIVE.pause; }
    show();
  }
  // back in its place: exactly as it parks
  function home() {
    Object.assign(pose, PARKED); parts.lift = FORKS.rest; parts.steer = 0;
    state = 'home'; show(); S.rounds++; S.round = null;
  }
  // FINISHED AT ONCE (its driver taken away mid-round: the player has left Cargo, so nobody sees it): the pallet where
  // it was going (or where it was, not yet taken up), the forklift parked
  function finishNow() {
    if (job) {
      const L = job.R.legs, taken = job.carrying || L.slice(0, job.li).some((x) => x.take);
      const left = L.slice(0, job.li).some((x) => x.leave);
      if (taken && !left) { here.delete(job.from); here.set(job.to, job.pallet); since.set(job.to, clock); pallets.at(job.pallet, job.to); }
      if (state === 'round' || state === 'boarding') { S.snapped++; if (zone.group.visible && seenBox(box)) S.snappedSeen++; }
    }
    job = null; Object.assign(pose, PARKED); parts.lift = FORKS.rest; parts.steer = 0;
    if (made) show();
    state = 'parked'; S.round = null;
  }

  // ── ITS DRIVER (src/people.js: a day's 'drive:forklift') ──────────────────────────────────────────────────────────
  const UP = new THREE.Vector3(0, 1, 0);
  // where they stand to get on (beside its seat, on its left), as it is parked
  function boardSpot() {
    const r = [Math.sin(PARKED.h), Math.cos(PARKED.h)], f = [Math.cos(PARKED.h), -Math.sin(PARKED.h)], o = -(TRUCK.half + RIDE.out);
    const x = PARKED.x + f[0] * TRUCK.seat.x + r[0] * o, z = PARKED.z + f[1] * TRUCK.seat.x + r[1] * o;
    return walls.snap(x, STORE.floor + 0.35, z, 0.4) || new THREE.Vector3(x, STORE.floor, z);
  }
  let spot = null;
  // a person on its seat, as on a chair (`k` of the way from standing beside it to sitting on it)
  function seatPose(P, k) {
    const f = [Math.cos(pose.h), -Math.sin(pose.h)];
    const sx = pose.x + f[0] * TRUCK.seat.x, sz = pose.z + f[1] * TRUCK.seat.x, sy = STORE.floor + TRUCK.seat.y - RIDE.chair;
    const b = spot.pos, u = k * k * (3 - 2 * k), lift = Math.min(1, k * 1.6);
    const pp = P.pose || (P.pose = { root: new THREE.Vector3(), q: new THREE.Quaternion() });
    pp.root.set(b.x + (sx - b.x) * u, b.y + (sy - b.y) * (lift * lift * (3 - 2 * lift)), b.z + (sz - b.z) * u);
    // (from facing its side to facing ahead, with it)
    const h0 = spot.heading, h1 = pose.h + Math.PI / 2, h = h0 + wrap(h1 - h0) * u;
    pp.q.setFromAxisAngle(UP, h);
    P.pos.set(pp.root.x, STORE.floor, pp.root.z); P.heading = h;
    return pp;
  }
  function seatDriver(P) {
    if (!P.act || P.act.kind !== 'drive' || P.act.phase !== 'ride') return;
    const pp = seatPose(P, 1);
    if (P.inScene) { P.c.root.position.copy(pp.root); P.c.root.quaternion.copy(pp.q); }
  }
  let clock = 0;
  const ride = {
    claim(P) {
      if (!made || !pallets || state !== 'parked' || rest > 0 || driver || P.home !== 'store') return null;
      const J = pickJob(); if (!J) return null;
      job = J; driver = P; state = 'called'; S.claims++;
      spot = { name: 'forklift', pos: boardSpot(), heading: PARKED.h, who: null };
      S.round = { from: J.from, to: J.to, driver: P.id };
      return spot;
    },
    step(P, a, dt, H) {
      if (driver !== P || !job) { H.next(P); return; }
      if (a.phase === 'do') {
        // (beside its seat: on)
        if (state === 'called') { state = 'boarding'; a.phase = 'on'; a.t = 0; P.scripted = true; }
        else H.next(P);
        return;
      }
      if (a.phase === 'on') {
        const k = Math.min(1, a.t / RIDE.on); seatPose(P, k);
        H.play(P, k > 0.3 ? H.clips.sit : H.clips.stand, { fade: 0.45 });
        if (k >= 1) { a.phase = 'ride'; a.t = 0; state = 'round'; job.li = 0; job.s = 0; job.v = 0; job.pause = 0.5; }
        return;
      }
      if (a.phase === 'ride') {
        H.play(P, H.clips.sit); seatPose(P, 1);
        if (state === 'home') { a.phase = 'off'; a.t = 0; }
        return;
      }
      if (a.phase === 'off') {
        const k = Math.min(1, a.t / RIDE.off); seatPose(P, 1 - k);
        H.play(P, k < 0.6 ? H.clips.sit : H.clips.stand, { fade: 0.4 });
        if (k >= 1) {
          P.pose = null; P.scripted = false; P.pos.copy(spot.pos); P.heading = spot.heading;
          driver = null; job = null; state = 'parked'; rest = RIDE.rest; spot = null;
          H.next(P);
        }
      }
    },
    release(P) {
      if (driver !== P) return;
      finishNow(); driver = null; spot = null; rest = RIDE.rest * 0.5;
      if (P.pose) P.pose = null; P.scripted = false;
    },
  };

  // ── A PALLET ARRIVING on the loading floor: one set on the shelf longest ago, where nobody sees it go or come ──
  let arriveClock = RIDE.arrive;
  const _b = new THREE.Box3(), placeBox = (q) => _b.set(new THREE.Vector3(q.at[0] - 0.7, STORE.floor, q.at[1] - 0.8), new THREE.Vector3(q.at[0] + 0.7, STORE.floor + 1.3, q.at[1] + 0.8));
  function arrive(feet) {
    if (state !== 'parked' || !pallets) return;
    const empty = PLACES.filter((q) => !q.shelf && !here.has(q.id));
    const onShelf = PLACES.filter((q) => q.shelf && here.has(q.id)).sort((a, b) => since.get(a.id) - since.get(b.id));
    if (!empty.length || !onShelf.length) return;
    const from = onShelf[0];
    if (seenBox(placeBox(from))) return;
    for (const q of empty) {
      if (seenBox(placeBox(q))) continue;
      if (feet.some((p) => p && Math.abs(p.y - STORE.floor) < 1.2 && Math.max(Math.abs(p.x - q.at[0]) - PALLET.wide / 2, Math.abs(p.z - q.at[1]) - PALLET.long / 2) < RIDE.clear)) continue;
      const i = here.get(from.id); here.delete(from.id); here.set(q.id, i); pallets.at(i, q.id); S.arrivals++;
      return;
    }
  }

  return {
    ride,
    update(soon, { camera = null, feet = () => [], dt = 1 / 60 } = {}) {
      if (!zone) return;
      clock += dt; cam = camera; if (camera) frustum(camera);
      if (soon || pallets || building) buildPallets();
      if (made) {
        if (warm < 2) warmUp();
        if (rest > 0 && state === 'parked') rest -= dt;
        const all = driver ? feet().filter((p) => p !== driver.pos) : feet();
        if (state === 'round' && job) drive(dt, all);
        else if (state === 'home' && !driver) state = 'parked';
        if ((arriveClock -= dt) <= 0) { arriveClock = RIDE.arrive; arrive(all); }
        return;
      }
      if (soon && !S.asked) {
        S.asked = true; t0 = performance.now();
        loadForklift().then((f) => { F = f; S.fetched = true; S.facts = f.facts; S.ms.fetched = Math.round(performance.now() - t0); })
          .catch((e) => { S.error = (e && e.message) || String(e); console.warn('cargo: the forklift did not come: ' + S.error); });
      }
      if (F && !seen(camera) && !inTheWay(feet())) put();
    },
    state: () => ({ ...S, ms: { ...S.ms }, now: state, pose: { x: +pose.x.toFixed(2), z: +pose.z.toFixed(2), h: +pose.h.toFixed(3) }, lift: +parts.lift.toFixed(3), steer: +parts.steer.toFixed(3),
      leg: job ? job.li : null, legs: job ? job.R.legs.length : null, waiting: !!(job && job.waiting), carrying: !!(job && job.carrying), driver: driver ? driver.id : null, rest: +rest.toFixed(1),
      places: Object.fromEntries(PLACES.map((q) => [q.id, here.has(q.id) ? here.get(q.id) : null])) }),
    // (for the rigs: the round's ways, and a round started now with whoever of Cargo's people is asked)
    plan: () => (job ? job.R : null),
    pallets: () => pallets,
  };
}
