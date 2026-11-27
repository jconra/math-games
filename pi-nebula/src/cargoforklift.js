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
//                         once, where nobody sees it: the player has left Cargo); outline() where it is just now (its
//                         boxes, for everyone walking by to keep their whole body off: src/people.js), or null
//                         while it is not in; driver() who is on it, or null
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
// have gone. THE FIRST SHELF (2026-11-20, the game's maker, FORK2-1, B: "It lifts them onto the first shelf, the forks'
// frame rising past the top of the mast as in the right picture"): it sets a pallet on the first shelf while there is
// room there, close to the rack lifting it a little over the shelf's beam, slowly in, down onto the shelf, slowly back
// out and the forks down (kit/forkliftround.js); on the racks' floor level only when the first shelf has no room. A
// pallet brought back from the shelf comes down from the first shelf the same way, while there is one there. A PALLET
// ARRIVING: a pallet set on the shelf comes back to the loading floor now and then, so the loading floor never runs
// out: moved where nobody sees it (both places out of the camera's view, nobody near the place it comes to), while the
// forklift is parked; one from the first shelf first, so the first shelf has room for the next round.
// THE PLAYER DRIVES IT (2026-11-22, the game's maker, STA2-5: "Then you go get in the forklift and load some pallets onto
// the containers. If someone is really bad at driving, Id say they can get off the forklift and the ship will
// automatically be loaded once they leave"): parked, with nobody on it, the player can take it (src/cargodrive.js: the
// prompt, the keys, the camera). forklift.hand: can(), take(), step(cmd, dt, feet) (kit/forkliftdrive.js: it never goes
// through anything; pallets on and off its forks at the places a pallet can stand in, the loading floor's and, while
// their doors are open, just inside the containers'), give() (got off: it stands where it was left, and goes back to its
// bay where nobody sees, a pallet left on its forks set down first), seat() (where the player sits), board() (where they
// stand to get on and off). While the supply run waits for the player (hold()), Cargo's people leave it parked.
// CARGO'S LOADER LOADS THE REST (2026-11-23, the game's maker, CARGO1-1, B, of a player who gets off before the run is
// loaded: "Cargo's loader walks over, gets on the forklift and drives the rest into the containers while you watch
// (when you leave Cargo, whatever is left is loaded at once)."): asked by the supply run (forklift.loader.ask(n), each
// frame it wants it), the loader (CARGO.loader) is called over (`summon`), walks to its seat where the player left it,
// climbs on, and drives each pallet still wanted from the loading floor into the open containers, one after another:
// the same forklift, driven by the same stick, wheel and forks' buttons as the player's (kit/forkliftloader.js gives
// them; kit/forkliftway.js finds its way), so a pallet goes on and off its forks exactly as it does for the player, in
// sight. A pallet the player left on its forks goes in first. Then it is driven to its bay, backed in and parked, and
// the loader gets off and goes on with their day. The loader is called a moment (RIDE.grace) after the player gets off.
// UNTIL THE LOADER HAS CLIMBED ON, the player can get back on (the prompt beside its seat) and the loader turns back
// to their day; once the loader is driving, it is theirs till it is
// parked. The player gone from Cargo (the loader taken away with Cargo's people): finished at once, as a round is.
// Should the loader not come, or not find a way (forklift.loader.state().gaveUp), the run loads the rest as it did
// before, where nobody sees.
import * as THREE from 'three';
import { loadForklift, standForklift } from '../kit/forklift.js';
import { STORE, forkliftBox, CARGO, PALLET, palletBox } from '../kit/places-plan.js';
import { TRUCK, FORKS, DRIVE, PARKED, PLACES, placeById, round, outline, pointGap, gapTo, palletFoot, ON_FORKS } from '../kit/forkliftround.js';
import { makePallets, warmLoad } from '../kit/cargopallets.js';
import { makeDoors } from '../kit/containerdoors.js';
import { makeDrive, worldOf, BOX_PLACES, boxPlace, HAND } from '../kit/forkliftdrive.js';
import { SLOT, LOAD } from '../kit/places-plan.js';
import { makeLoader } from '../kit/forkliftloader.js';
import { mountAt } from './seatsteps.js';
import { wheelHold, FORKLIFT_WHEEL } from './atwork.js';
import { setHold } from './moves.js';

// (the hands round the wheel for moves.js: src/atwork.js wheelHold, in the person's own frame)
const holdOf = (M, H) => setHold(M, H), wheelOut = {};
// (each hand's share of the hold: both seated; climbing, the right one as it reaches (kept, not made each frame))
const BOTH = [1, 1], ONE = [0, 0];
const KEY = 'cargo:forklift';
// its shine: the room's own picture of itself, this much (the kit's painted parts have 1.25: kit/materials.js, as the
// station sets them)
const SHINE = 1.25;
// CAREFUL: anyone this near its outline (m, to their middle) where it is or along the next stretch of its way (a metre
// and its stopping distance) stops it; it goes on once nobody has been there for `clear` seconds
const CARE = { near: 0.5, ahead: 1.1, clear: 0.8 };
// GETTING ON AND OFF (s), the first part of it turning to face ahead (of the whole); where its driver stands to get on
// (m out from its left side, beside the seat); a desk chair's cushion over the floor (kit/furniture.js): a person sits
// on its seat as on a chair, lifted by the difference
// NOW AND THEN: after a round, this long before another (s); how often a pallet may arrive (s), and nobody nearer the
// place it comes to than `clear` (m)
// THE LOADER CALLED to load the rest: `grace` seconds after the run first asks (the player just off it may get straight
// back on); called again every `call` seconds till they come; not come in `come` seconds, or
// their loading given up: not asked again for `again` seconds (the run loads the rest where nobody sees meanwhile)
export const RIDE = { on: 1.8, off: 1.5, turn: 0.35, out: 0.42, chair: 0.53, rest: 25, arrive: 3, clear: 1.6, grace: 3, call: 2, come: 75, again: 40 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeCargoForklift({ W, walls, hold = () => false, open = () => [], summon = null, dismiss = null }) {
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
    walls.add(KEY + ':load', { solid: [lb], when: () => carrying() });
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
  let pallets = null, building = null, doors = null;
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
    // (and the doors of the containers the supply run loads, kit/containerdoors.js: shut, as the other containers')
    doors = makeDoors({ zone, lights: W.built.lights || [], sky: room && room.sky, walls });
    zone.group.add(doors.group);
    CARGO.pallets.forEach((d, i) => { here.set(d.at, i); since.set(d.at, 0); });
    // (each place in the walls while a pallet stands in it)
    for (const q of PLACES) {
      const g = new THREE.BoxGeometry(PALLET.wide, PALLET.top, PALLET.long).translate(q.at[0], STORE.floor + q.y + PALLET.top / 2, q.at[1]);
      walls.add('cargo:pallet:' + q.id, { solid: [g], when: () => here.has(q.id) });
    }
    // (and inside the containers, their skids east to west)
    for (const q of BOX_PLACES) {
      const g = new THREE.BoxGeometry(PALLET.long, PALLET.top, PALLET.wide).translate(q.at[0], STORE.floor + q.y + PALLET.top / 2, q.at[1]);
      walls.add('cargo:pallet:' + q.id, { solid: [g], when: () => here.has(q.id) });
    }
    building.t += performance.now() - t;
    S.pallets = { ...pallets.facts, allMs: Math.round(building.t) }; S.doors = doors.facts; building = 'done';
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
    // (the pallet on its forks; in the rack's shade as far as it is in under the shelf, its light between the shelf
    // place's and the loading floor's. Taken up or set down, it stands on its place, the floor or the first shelf,
    // while the forks are under it lower than its deck)
    if (hand && hand.D.s.carry != null) showCarried();
    else if (job && job.carrying) {
      const f = [Math.cos(pose.h), -Math.sin(pose.h)], px = pose.x + f[0] * ON_FORKS.x, pz = pose.z + f[1] * ON_FORKS.x;
      const L = job.R.legs[job.li], Q = L && L.kind === 'forks' ? placeById(L.take || L.leave || '') : null;
      pallets.move(job.pallet, px, STORE.floor + palletFoot(parts.lift, Q ? Q.y : 0), pz, pose.h);   // (its skids along the forks)
      const sh = placeById(job.R.back ? job.from : job.to), op = placeById(job.R.back ? job.to : job.from);
      const d = Math.max(0, Math.min(1, (sh.at[1] + PALLET.long - 0.05 - pz) / (PALLET.long - 0.05)));
      if (job.shade == null || Math.abs(d - job.shade) > 0.01 || (d !== job.shade && (d === 0 || d === 1))) { job.shade = d; pallets.blend(job.pallet, op.id, sh.id, d); }
    }
    if (driver) seatDriver(driver);
  }

  const carrying = () => !!((job && job.carrying) || (hand && hand.D.s.carry != null));

  // ── A ROUND ──────────────────────────────────────────────────────────────────────────────────────────────────
  // job: { from, to, pallet, R (the round), li (its leg), s (m along it), v (m/s), carrying, wait, clear, pause }
  let job = null, driver = null, state = 'parked', rest = 0;
  // (a pallet waiting to a place free on the shelf, as his words have it: on the first shelf while it has room, on the
  // racks' floor level when it has none; or, when there is none to take or nowhere to put it (nothing has arrived back
  // unseen: the player has been watching), one from the shelf back to the loading floor, from the first shelf first)
  const any = (L) => L[Math.floor(Math.random() * L.length)];
  const upFirst = (L) => (L.some((q) => q.up) ? L.filter((q) => q.up) : L);
  function pickJob() {
    let full = PLACES.filter((q) => !q.shelf && here.has(q.id)), empty = upFirst(PLACES.filter((q) => q.shelf && !here.has(q.id)));
    if (!full.length || !empty.length) { full = upFirst(PLACES.filter((q) => q.shelf && here.has(q.id))); empty = PLACES.filter((q) => !q.shelf && !here.has(q.id)); }
    if (!full.length || !empty.length) return null;
    const A = any(full), B = any(empty);
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
  // a person on its seat, as on a chair (`k` of the way through getting on, or off: on false): src/seatsteps.js
  // mountAt, as a person climbs onto a ride-on (turned to face the way it faces beside it, up and across onto it, down
  // onto the seat leaning forward; off, the same the other way round); pp.clip ('stand', 'walk', 'sit') to play, and on
  // it, the hands on its wheel (src/atwork.js wheelLocal: moves.js M.hold, in their own frame)
  function seatPose(P, k, on = true) {
    const f = [Math.cos(pose.h), -Math.sin(pose.h)];
    const sx = pose.x + f[0] * TRUCK.seat.x, sz = pose.z + f[1] * TRUCK.seat.x, sy = STORE.floor + TRUCK.seat.y - RIDE.chair;
    const b = spot.pos, m = mountAt(k, on, b.y, sy), u = m.across;
    const pp = P.pose || (P.pose = { root: new THREE.Vector3(), q: new THREE.Quaternion() });
    pp.root.set(b.x + (sx - b.x) * u, m.y, b.z + (sz - b.z) * u);
    const h0 = spot.heading, h1 = pose.h + Math.PI / 2, h = h0 + wrap(h1 - h0) * m.turn;
    pp.q.setFromAxisAngle(UP, h);
    P.pos.set(pp.root.x, STORE.floor, pp.root.z); P.heading = h;
    pp.clip = m.clip;
    if (P.moves) {
      const seated = on && k >= 1;
      P.moves.lean = seated ? 0 : m.lean; P.moves.bow = seated ? FORKLIFT_WHEEL.bow : 0;      // (seated: bowed to the wheel, low in the back)
      // (seated, both hands round its wheel; climbing on or off, the right hand on it as they go)
      if (seated || m.hand > 0) holdOf(P.moves, wheelHold(RIDE.chair, clock, P.id.length, seated ? BOTH : (ONE[1] = m.hand, ONE), wheelOut)); else P.moves.hold = null;
    }
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
      // (Cargo's loader, called to load the rest of a supply run: to its seat where it stands)
      if (load.asked() && P.id === CARGO.loader && made && pallets && !driver && (state === 'parked' || state === 'left') && load.can()) {
        const b = (playerBy(-1) ? null : besideAt(-1)) || (playerBy(1) ? null : besideAt(1)); if (!b) return null;
        driver = P; load.from = state; state = 'loadcall'; load.calls++;
        spot = { name: 'forklift', pos: b.pos, heading: pose.h, who: null };
        return spot;
      }
      if (!made || !pallets || state !== 'parked' || rest > 0 || driver || P.home !== 'store' || hold()) return null;
      const J = pickJob(); if (!J) return null;
      job = J; driver = P; state = 'called'; S.claims++;
      spot = { name: 'forklift', pos: boardSpot(), heading: PARKED.h, who: null };
      S.round = { from: J.from, to: J.to, driver: P.id };
      return spot;
    },
    step(P, a, dt, H) {
      if (driver === P && load.states.includes(state)) { load.step(P, a, dt, H); return; }
      if (driver !== P || !job) { H.next(P); return; }
      if (a.phase === 'do') {
        // (beside its seat: on)
        if (state === 'called') { state = 'boarding'; a.phase = 'on'; a.t = 0; P.scripted = true; }
        else H.next(P);
        return;
      }
      if (a.phase === 'on') {
        const k = Math.min(1, a.t / RIDE.on), pp = seatPose(P, k);
        H.play(P, H.clips[pp.clip], { fade: 0.4, speed: pp.clip === 'walk' ? 0.6 : 1 });
        if (k >= 1) { a.phase = 'ride'; a.t = 0; state = 'round'; job.li = 0; job.s = 0; job.v = 0; job.pause = 0.5; }
        return;
      }
      if (a.phase === 'ride') {
        H.play(P, H.clips.sit); seatPose(P, 1);
        if (state === 'home') { a.phase = 'off'; a.t = 0; }
        return;
      }
      if (a.phase === 'off') {
        const k = Math.min(1, a.t / RIDE.off), pp = seatPose(P, k, false);
        H.play(P, H.clips[pp.clip], { fade: 0.4, speed: pp.clip === 'walk' ? 0.6 : 1 });
        if (k >= 1) {
          P.pose = null; P.scripted = false; P.pos.copy(spot.pos); P.heading = spot.heading; if (P.moves) { P.moves.hold = null; P.moves.lean = 0; P.moves.bow = 0; }
          driver = null; job = null; state = 'parked'; rest = RIDE.rest; spot = null;
          H.next(P);
        }
      }
    },
    release(P) {
      if (driver !== P) return;
      if (load.states.includes(state)) { load.release(P); return; }
      finishNow(); driver = null; spot = null; rest = RIDE.rest * 0.5;
      if (P.pose) P.pose = null; P.scripted = false; if (P.moves) { P.moves.hold = null; P.moves.lean = 0; P.moves.bow = 0; }
    },
    // (where it is just now, for everyone walking by: its outline (kit/forkliftround.js), or null while it is not in;
    // the driver is driver())
    outline: () => (made ? outline(pose, carrying()) : null),
    driver: () => driver,
  };

  // ── THE PLAYER'S HAND ON IT (src/cargodrive.js) ───────────────────────────────────────────────────────────────────
  // hand: { D (kit/forkliftdrive.js: where it is, its speed, its wheel, its forks, the pallet on them), from, fromH (the
  // place the pallet on its forks was taken from, and its turn there: its light), shade, left (got off: it stands where it
  // was left), last (what happened on the last step) }
  let hand = null;
  const placeAt = (id) => placeById(id) || boxPlace(id);
  const fwdOf = (h) => [Math.cos(h), -Math.sin(h)], rightOf = (h) => [Math.sin(h), Math.cos(h)];
  // every pallet standing where its forks can reach: on the loading floor, inside a container (not on the racks)
  function standingNow() {
    const out = [];
    for (const [id, i] of here) {
      const q = placeAt(id); if (!q || q.shelf) continue;
      out.push({ i, at: q.at, y: q.y, h: pallets.list[i].turn ?? q.h, place: id, box: !!q.box });
    }
    return out;
  }
  const worldNow = (feet = []) => worldOf({ open: open(), pallets: standingNow(), people: feet.filter((q) => q && Math.abs(q.y - STORE.floor) < 1.2).map((q) => [q.x, q.z]) });
  // the pallet on its forks, and its light: where it was taken from; going in through a container's doorway, the
  // container's, by how far in it is
  function showCarried() {
    const i = hand.D.s.carry, f = fwdOf(pose.h), px = pose.x + f[0] * ON_FORKS.x, pz = pose.z + f[1] * ON_FORKS.x;
    pallets.move(i, px, STORE.floor + palletFoot(parts.lift), pz, pose.h);
    const b = BOX_PLACES.find((q) => open().includes(q.slot) && Math.abs(pz - q.at[1]) < 0.6 && px < SLOT.end + PALLET.long);
    const d = b ? Math.max(0, Math.min(1, (SLOT.end + PALLET.long / 2 - px) / PALLET.long)) : 0, to = b ? b.id : hand.from;
    if (hand.shade == null || hand.shadeTo !== to || Math.abs(d - hand.shade) > 0.02) { hand.shade = d; hand.shadeTo = to; pallets.blend(i, hand.from, to, d, hand.fromH, b ? b.h : hand.fromH); }
  }
  // where a person sits on it, and where they stand beside its seat (side: -1 its left, 1 its right), as it stands now
  function seatAt() {
    const f = fwdOf(pose.h);
    return { x: pose.x + f[0] * TRUCK.seat.x, y: STORE.floor + TRUCK.seat.y - RIDE.chair, z: pose.z + f[1] * TRUCK.seat.x, heading: pose.h + Math.PI / 2 };
  }
  function besideAt(side = -1) {
    const f = fwdOf(pose.h), r = rightOf(pose.h), o = side * (TRUCK.half + RIDE.out);
    const x = pose.x + f[0] * TRUCK.seat.x + r[0] * o, z = pose.z + f[1] * TRUCK.seat.x + r[1] * o;
    const p = walls.snap(x, STORE.floor + 0.35, z, 0.3);
    if (!p || Math.abs(p.y - STORE.floor) > 0.2 || Math.hypot(p.x - x, p.z - z) > 0.3) return null;
    // (never inside it, its forks or the pallet on them)
    if (outline(pose, carrying()).some((o) => pointGap(o, p.x, p.z) < 0.3)) return null;
    return { pos: p, heading: pose.h + Math.PI / 2 };
  }
  // BACK IN ITS BAY, where nobody sees: left standing somewhere by the player; a pallet left on its forks set down
  // first, where nobody sees either (in a container while the run wants it loaded: wants(), else on the loading floor)
  const _lb = new THREE.Box3();
  function leftBack(feet, wants) {
    if (!hand || !hand.left || !made) return;
    const O = outline(pose, carrying());
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const o of O) for (const a of [-1, 1]) for (const b of [-1, 1]) { const x = o.c[0] + o.f[0] * o.hx * a + o.r[0] * o.hz * b, z = o.c[1] + o.f[1] * o.hx * a + o.r[1] * o.hz * b; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    _lb.set(new THREE.Vector3(x0, STORE.floor, z0), new THREE.Vector3(x1, STORE.floor + 2.6, z1));
    if (seenBox(_lb) || seenBox(box) || inTheWay(feet)) return;
    const s = hand.D.s;
    if (s.carry != null) {
      const free = (q) => !here.has(q.id) && !seenBox(placeBox(q));
      const to = (wants() ? BOX_PLACES.filter((q) => open().includes(q.slot) && free(q)) : [])[0] || PLACES.filter((q) => !q.shelf && free(q))[0] || PLACES.filter((q) => q.shelf && free(q))[0];
      if (!to) return;
      here.set(to.id, s.carry); since.set(to.id, clock); pallets.at(s.carry, to.id); S.leftPallets = (S.leftPallets || 0) + 1;
    }
    hand = null; Object.assign(pose, PARKED); parts.lift = FORKS.rest; parts.steer = 0; show();
    state = 'parked'; rest = Math.max(rest, RIDE.rest * 0.5); S.leftBack = (S.leftBack || 0) + 1;
  }
  // A FRAME OF A HAND ON IT, the player's or the loader's: cmd { go, turn, forks }; feet: everyone else on Cargo's floor
  // -> what happened
  function stepHand(cmd, dt, feet = [], W2 = null) {
    const s = hand.D.s, x0 = s.x, z0 = s.z;
    const ev = hand.D.step(cmd, dt, W2 || worldNow(feet));
    if (ev.took) { here.delete(ev.took.place); hand.from = ev.took.place; hand.fromH = ev.took.h; hand.shade = null; S.took = (S.took || 0) + 1; }
    if (ev.set) { here.set(ev.set, ev.placed.i); since.set(ev.set, clock); pallets.at(ev.placed.i, ev.set, ev.placed.h); hand.from = null; S.put = (S.put || 0) + 1; }
    // its wheels rolling with the ground covered (the back ones further round a turn), the back ones steered
    const f = fwdOf(s.h), ds = (s.x - x0) * f[0] + (s.z - z0) * f[1];
    pose.x = s.x; pose.z = s.z; pose.h = s.h; parts.lift = s.lift;
    parts.front -= ds / TRUCK.front.r;
    parts.back -= ds * Math.sqrt(1 + (TRUCK.base * s.curv) ** 2) / TRUCK.back.r;
    parts.steer = -Math.atan(TRUCK.base * s.curv);
    show();
    hand.last = ev;
    return ev;
  }
  const handApi = {
    // (the player may take it: in Cargo, parked, nobody on it)
    // (and, while a supply run's rest is the loader's to load, where the player left it, until the loader has climbed on)
    can: () => !!(made && pallets && ((state === 'parked' && !driver) || (load.asked() && (state === 'left' || state === 'loadcall')))),
    get on() { return !!(hand && !hand.left && !hand.by); },
    take() {
      if (!handApi.can()) return false;
      // (the loader on their way to it: back to their day)
      if (state === 'loadcall') { const P = driver; driver = null; spot = null; if (dismiss && P) dismiss(P); }
      state = 'hand'; S.hands = (S.hands || 0) + 1;
      // (left where the player got off: as it was, a pallet on its forks still on them)
      if (hand && hand.left) { hand.left = false; hand.by = null; hand.last = null; hand.D.s.v = 0; }
      else hand = { D: makeDrive({ x: pose.x, z: pose.z, h: pose.h, lift: parts.lift }), from: null, fromH: null, shade: null, left: false, last: null };
      return true;
    },
    // a frame of the player's driving: cmd { go, turn, forks }; feet: everyone else on Cargo's floor -> what happened
    step(cmd, dt, feet = []) {
      if (!hand || hand.left || hand.by) return null;
      return stepHand(cmd, dt, feet);
    },
    // got off: it stands where it was left (in its bay with nothing on its forks: parked exactly as it parks)
    give() {
      if (!hand || hand.left) return;
      const s = hand.D.s, inBay = Math.abs(s.x - PARKED.x) < 0.25 && Math.abs(s.z - PARKED.z) < 0.25 && Math.abs(wrap(s.h - PARKED.h)) < 0.12;
      if (inBay && s.carry == null && s.under == null) { hand = null; Object.assign(pose, PARKED); parts.lift = FORKS.rest; parts.steer = 0; show(); state = 'parked'; return; }
      hand.left = true; s.v = 0; state = 'left';
    },
    seat: seatAt, beside: besideAt,
    drive: () => (hand ? hand.D : null),
    world: worldNow,
    // (the places a pallet stands in just now, on the loading floor and in the containers: for the run, src/supplyrun.js)
    places: () => Object.fromEntries([...here].filter(([id]) => !placeAt(id).shelf)),
    // what is on it and in front of it, for the hints: { carry, under, lift, v, front (a pallet lined up), place (a
    // place lined up to set one down in), blocked, why }
    read() {
      if (!hand) return null;
      const s = hand.D.s, W2 = worldNow([]), F = hand.D.inFront(W2), P = hand.D.placeNear(W2);
      const underAt = s.under != null ? ([...here].find(([, i]) => i === s.under) || [null])[0] : null;
      return { carry: s.carry, under: s.under, underAt, lift: s.lift, v: s.v, front: F ? { i: F.q.i, along: F.L.along, place: F.q.place } : null,
        place: P ? { id: P.q.id, d: P.d, side: P.side, ahead: P.ahead, box: !!P.q.box } : null, blocked: hand.last && hand.last.blocked, why: hand.last && hand.last.why };
    },
  };

  // ── CARGO'S LOADER LOADS THE REST (the top of this file; kit/forkliftloader.js) ────────────────────────────────────
  // load: asked() the run wants it just now; can() there is something to do (a pallet on its forks, or one waiting on
  // the loading floor, and a place free in an open container); states: the forklift's states while it is the loader's
  // ('loadcall' called and on their way, 'loadon' getting on, 'load' driving, 'loadoff' getting off)
  let playerAt = null;
  const playerBy = (side) => { const b = besideAt(side); return !!(b && playerAt && Math.hypot(playerAt.x - b.pos.x, playerAt.z - b.pos.z) < 0.9); };
  const load = {
    states: ['loadcall', 'loadon', 'load', 'loadoff'], want: 0, at: -9, since: null, next: 0, failed: -1e9, why: null, from: 'parked', L: null, calls: 0, done: 0, loaded: 0, gaveUp: 0, ms: null,
    asked: () => clock - load.at < 0.6 && load.want > 0 && clock - load.failed > RIDE.again,
    can() {
      if (hand && hand.left && hand.D.s.carry != null) return true;
      return PLACES.some((q) => !q.shelf && here.has(q.id)) && BOX_PLACES.some((q) => open().includes(q.slot) && !here.has(q.id));
    },
    fail(why) { load.failed = clock; load.why = why; load.gaveUp++; console.info('cargo: the loader does not load the rest (' + why + '): it loads where nobody sees'); },
    // THEIR PART at the forklift (src/people.js RIDES): on, the drive, off
    step(P, a, dt, H) {
      if (a.phase === 'do') {
        if (state !== 'loadcall') { H.next(P); return; }
        // (beside its seat: on; its hand theirs, as the player left it, a pallet on its forks still on them)
        state = 'loadon'; a.phase = 'on'; a.t = 0; P.scripted = true;
        if (hand && hand.left) { hand.left = false; hand.by = P; hand.last = null; hand.D.s.v = 0; }
        else hand = { D: makeDrive({ x: pose.x, z: pose.z, h: pose.h, lift: parts.lift }), from: null, fromH: null, shade: null, left: false, last: null, by: P };
        return;
      }
      if (a.phase === 'on') {
        const k = Math.min(1, a.t / RIDE.on), pp = seatPose(P, k);
        H.play(P, H.clips[pp.clip], { fade: 0.4, speed: pp.clip === 'walk' ? 0.6 : 1 });
        if (k >= 1) { a.phase = 'ride'; a.t = 0; state = 'load'; load.L = makeLoader(); load.ms = { n: 0, sum: 0, most: 0 }; }
        return;
      }
      if (a.phase === 'ride') {
        H.play(P, H.clips.sit); seatPose(P, 1);
        const L = load.L;
        if (!L || !(L.done || L.failed)) return;
        // parked in its bay (exactly as it parks), or given up where it stands: off
        if (L.done) { hand = null; Object.assign(pose, PARKED); parts.lift = FORKS.rest; parts.steer = 0; show(); load.done++; }
        else { hand.D.s.v = 0; load.fail(String(L.failed)); }
        const b = besideAt(-1) || besideAt(1), p = b ? b.pos : walls.snap(pose.x, STORE.floor + 0.35, pose.z + 1.2, 1.5) || new THREE.Vector3(pose.x, STORE.floor, pose.z + 1.2);
        spot = { name: 'forklift', pos: p, heading: pose.h, who: null };
        a.phase = 'off'; a.t = 0; state = 'loadoff';
        return;
      }
      if (a.phase === 'off') {
        const k = Math.min(1, a.t / RIDE.off), pp = seatPose(P, k, false);
        H.play(P, H.clips[pp.clip], { fade: 0.4, speed: pp.clip === 'walk' ? 0.6 : 1 });
        if (k >= 1) {
          P.pose = null; P.scripted = false; P.pos.copy(spot.pos); P.heading = spot.heading; if (P.moves) { P.moves.hold = null; P.moves.lean = 0; P.moves.bow = 0; }
          driver = null; spot = null; load.L = null;
          // (given up where it stands: left there, as a player leaves it, and back to its bay where nobody sees)
          if (hand) { hand.left = true; hand.by = null; state = 'left'; } else { state = 'parked'; rest = RIDE.rest; }
          H.next(P);
        }
      }
    },
    // A FRAME OF THEIR DRIVING: the loader's hand on the stick, the wheel and the forks' buttons
    drive(dt, feet) {
      const L = load.L; if (!L || !hand || L.done || L.failed) return;
      const t1 = performance.now(), W2 = worldNow(feet);
      const cmd = L.cmd(hand.D, W2, dt, { want: load.asked() ? load.want : 0 });
      const ev = stepHand(cmd, dt, feet, W2); L.after(ev);
      if (ev.set && /^b/.test(ev.set)) load.loaded++;
      const u = performance.now() - t1; load.ms.n++; load.ms.sum += u; load.ms.most = Math.max(load.ms.most, u);
    },
    // TAKEN AWAY (the player has left Cargo, or the crew screen): on their way to it, it stays as it was; on it,
    // finished at once where nobody sees: a pallet on its forks set down (in a container while the run wants it), the
    // forklift parked
    release(P) {
      if (state === 'loadcall') { driver = null; spot = null; state = load.from; if (P.pose) P.pose = null; P.scripted = false; return; }
      if (hand && hand.D.s.carry != null) {
        const i = hand.D.s.carry, to = (load.want > 0 ? BOX_PLACES.filter((q) => open().includes(q.slot) && !here.has(q.id)) : [])[0] || PLACES.filter((q) => !q.shelf && !here.has(q.id))[0] || PLACES.filter((q) => q.shelf && !here.has(q.id))[0];
        if (to) { here.set(to.id, i); since.set(to.id, clock); pallets.at(i, to.id); }
      }
      hand = null; load.L = null; Object.assign(pose, PARKED); parts.lift = FORKS.rest; parts.steer = 0; if (made) show();
      driver = null; spot = null; state = 'parked'; rest = RIDE.rest * 0.5;
      if (P.pose) P.pose = null; P.scripted = false;
      S.snapped++; if (zone.group.visible && seenBox(box)) S.snappedSeen++;
    },
  };
  const loaderApi = {
    // THE SUPPLY RUN WANTS THE REST LOADED (src/supplyrun.js, each frame it does: n more) -> true while the loader has
    // it in hand, or is being called to it; false: the run loads the rest as before (where nobody sees)
    ask(n) {
      if (!made || !pallets) return false;
      // (asked afresh after a while not asked, the player back on it meanwhile: its moment and its waiting begin again)
      if (clock - load.at > 1) load.since = null;
      load.want = n; load.at = clock;
      if (clock - load.failed <= RIDE.again) return false;
      if (state === 'loadon' || state === 'load' || state === 'loadoff') { load.since = null; return true; }
      if (!(state === 'parked' || state === 'left' || state === 'loadcall') || (driver && state !== 'loadcall') || (state !== 'loadcall' && !load.can())) { load.since = null; return false; }
      // (a moment first, RIDE.grace: someone who got off by mistake is back on before anyone is called; then called, and
      // again every little while till they are on their way; not on it in all this time: given up for now)
      if (load.since == null) load.since = clock;
      if (clock - load.since < RIDE.grace) return true;
      if (clock - load.since > RIDE.come) { load.since = null; load.fail('the loader did not come'); if (state === 'loadcall') { const P = driver; driver = null; spot = null; state = load.from; if (dismiss && P) dismiss(P); } return false; }
      if (state !== 'loadcall' && clock >= load.next) { load.next = clock + RIDE.call; if (summon) summon(CARGO.loader); }
      return true;
    },
    get on() { return state === 'load' || state === 'loadon' || state === 'loadoff'; },
    get coming() { return state === 'loadcall'; },
    state: () => ({ now: state, asked: load.asked(), want: load.want, calls: load.calls, done: load.done, loaded: load.loaded, gaveUp: load.gaveUp, why: load.why, failedAgo: +(clock - load.failed).toFixed(1),
      phase: load.L ? load.L.phase : null, goal: load.L ? load.L.goal : null, fails: load.L ? load.L.fails : 0, log: load.L ? load.L.log.slice(-4) : [], plans: load.L ? load.L.plans : 0, planMs: load.L ? load.L.planMs : 0, waits: load.L ? load.L.waits : 0,
      way: load.L && load.L.way ? { length: +load.L.way.length.toFixed(1), cusps: load.L.way.cusps, tried: load.L.way.tried } : null,
      ms: load.ms && load.ms.n ? { frames: load.ms.n, avg: +(load.ms.sum / load.ms.n).toFixed(3), most: +load.ms.most.toFixed(2) } : null }),
  };

  // ── THE SUPPLY RUN'S PALLETS (src/supplyrun.js): loaded by the player's hand, or by themselves where nobody sees ──
  // (the box of a place, for "is it seen": a container's place is its pallet inside the doorway)
  const stock = {
    // how many stand in the containers' places
    count: () => BOX_PLACES.filter((q) => here.has(q.id)).length,
    // ONE MORE LOADED BY ITSELF (the game's maker: "the ship will automatically be loaded once they leave"): a pallet
    // waiting on the loading floor into a free place inside an open container, both where nobody sees and nobody near
    // (force: Cargo is not drawn at all, the player has left it); not while it is on the forklift's forks or under them
    loadOne(feet = [], force = false) {
      if (!pallets) return false;
      const busy = new Set([hand && hand.D.s.carry, hand && hand.D.s.under, job && job.pallet].filter((x) => x != null));
      const to = BOX_PLACES.filter((q) => open().includes(q.slot) && !here.has(q.id) && (force || (!seenBox(placeBox(q)) && !nearFeet(q, feet))))[0];
      if (!to) return false;
      const from = PLACES.filter((q) => !q.shelf && here.has(q.id) && !busy.has(here.get(q.id)) && (force || (!seenBox(placeBox(q)) && !nearFeet(q, feet))))[0]
        || (force ? PLACES.filter((q) => q.shelf && here.has(q.id) && !busy.has(here.get(q.id)))[0] : null);
      if (!from) return false;
      const i = here.get(from.id); here.delete(from.id); here.set(to.id, i); since.set(to.id, clock); pallets.at(i, to.id); S.loadedBy = (S.loadedBy || 0) + 1;
      return true;
    },
    // THE CONTAINERS GONE OUT TO THE HAULER: what was loaded in them is no longer there; Cargo's pallets back where
    // its rounds keep them (the shelf first, then the loading floor), where nobody sees (force: Cargo is not drawn)
    ship(force = false) {
      if (!pallets) return 0;
      let n = 0;
      for (const q of BOX_PLACES) {
        if (!here.has(q.id) || (!force && seenBox(placeBox(q)))) continue;
        const to = PLACES.filter((x) => x.shelf && !here.has(x.id) && (force || !seenBox(placeBox(x))))[0] || PLACES.filter((x) => !x.shelf && !here.has(x.id) && (force || !seenBox(placeBox(x))))[0];
        if (!to) continue;
        const i = here.get(q.id); here.delete(q.id); here.set(to.id, i); since.set(to.id, 0); pallets.at(i, to.id); n++;
      }
      S.shipped = (S.shipped || 0) + n;
      return n;
    },
    // (a run kept from before the page was loaded again: so many already standing in the containers)
    putLoaded(n) { let k = 0; while (stock.count() < n && stock.loadOne([], true)) k++; return k; },
    // is the forklift (and anything on its forks) clear of a container's doorway: its doors may shut
    clearOf(slot) {
      if (!made) return true;
      const z = SLOT.z[slot], x1 = SLOT.end + 0.02, door = { c: [x1 + 0.9, z], f: [1, 0], r: [0, 1], hx: 1.2, hz: SLOT.box[0] / 2 + 0.1 };
      return outline(pose, carrying()).every((o) => gapTo(o, [door.c[0] - door.hx, door.c[0] + door.hx, z - door.hz, z + door.hz]) > 0.05);
    },
  };
  const nearFeet = (q, feet) => feet.some((p) => p && Math.abs(p.y - STORE.floor) < 1.2 && Math.max(Math.abs(p.x - q.at[0]) - 0.6, Math.abs(p.z - q.at[1]) - 0.6) < RIDE.clear);

  // ── A PALLET ARRIVING on the loading floor: one set on the shelf longest ago (the first shelf's first), where nobody
  // sees it go or come ──
  let arriveClock = RIDE.arrive;
  const _b = new THREE.Box3(), placeBox = (q) => _b.set(new THREE.Vector3(q.at[0] - 0.7, STORE.floor + q.y, q.at[1] - 0.8), new THREE.Vector3(q.at[0] + 0.7, STORE.floor + q.y + 1.3, q.at[1] + 0.8));
  function arrive(feet) {
    if (!(state === 'parked' || state === 'hand' || state === 'left') || !pallets) return;
    const empty = PLACES.filter((q) => !q.shelf && !here.has(q.id));
    const onShelf = PLACES.filter((q) => q.shelf && here.has(q.id)).sort((a, b) => (b.up - a.up) || since.get(a.id) - since.get(b.id));
    if (!empty.length || !onShelf.length) return;
    const from = onShelf[0];
    if (seenBox(placeBox(from))) return;
    for (const q of empty) {
      if (seenBox(placeBox(q))) continue;
      if (feet.some((p) => p && Math.abs(p.y - STORE.floor) < 1.2 && Math.max(Math.abs(p.x - q.at[0]) - PALLET.wide / 2, Math.abs(p.z - q.at[1]) - PALLET.long / 2) < RIDE.clear)) continue;
      // (never where the forklift stands just now, its forks or a pallet on them)
      if (state !== 'parked' && outline(pose, carrying()).some((o) => gapTo(o, palletBox(q.at)) < 0.3)) continue;
      const i = here.get(from.id); here.delete(from.id); here.set(q.id, i); pallets.at(i, q.id); S.arrivals++;
      return;
    }
  }

  return {
    ride, hand: handApi, stock, loader: loaderApi, get doors() { return doors; },
    // (the forklift as drawn, once it is in: for the mouse over it, src/cargodrive.js)
    get group() { return made ? made.group : null; },
    update(soon, { camera = null, feet = () => [], dt = 1 / 60, wants = () => false, player = null } = {}) {
      if (!zone) return;
      clock += dt; cam = camera; if (camera) frustum(camera); playerAt = player;
      if (soon || pallets || building) buildPallets();
      if (doors) doors.update(dt);
      if (made) {
        if (warm < 2) warmUp();
        if (rest > 0 && state === 'parked') rest -= dt;
        const all = driver ? feet().filter((p) => p !== driver.pos) : feet();
        if (state === 'round' && job) {
          // (what a frame of driving costs: for the rigs)
          const t1 = performance.now(); drive(dt, all); const u = performance.now() - t1;
          S.ms.drive = S.ms.drive || { n: 0, sum: 0, most: 0 }; S.ms.drive.n++; S.ms.drive.sum += u; S.ms.drive.most = Math.max(S.ms.drive.most, u);
        }
        else if (state === 'home' && !driver) state = 'parked';
        else if (state === 'load') load.drive(dt, all);
        // (left by the player: back to its bay where nobody sees; not while Cargo's loader is asked to come and load with it)
        else if (state === 'left' && !load.asked()) leftBack(all, wants);
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
    state: () => ({ ...S, ms: { ...S.ms, drive: S.ms.drive ? { frames: S.ms.drive.n, avg: +(S.ms.drive.sum / S.ms.drive.n).toFixed(3), most: +S.ms.drive.most.toFixed(2) } : null }, now: state, pose: { x: +pose.x.toFixed(2), z: +pose.z.toFixed(2), h: +pose.h.toFixed(3) }, lift: +parts.lift.toFixed(3), steer: +parts.steer.toFixed(3),
      leg: job ? job.li : null, legs: job ? job.R.legs.length : null, waiting: !!(job && job.waiting), carrying: !!(job && job.carrying), driver: driver ? driver.id : null, onForks: hand ? hand.D.s.carry : null, rest: +rest.toFixed(1),
      places: Object.fromEntries(PLACES.map((q) => [q.id, here.has(q.id) ? here.get(q.id) : null])) }),
    // (for the rigs: the round's ways, and a round started now with whoever of Cargo's people is asked)
    plan: () => (job ? job.R : null),
    pallets: () => pallets,
  };
}
