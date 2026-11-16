// THE SMELTER'S CRANE, in the game: the ceiling crane in the Miner hangar swaps the parked Miner's ore canisters by
// itself, round after round, while the player does the sums at the operator's chair (the game's maker, 2026-11-05: "it
// would be cool if a ceiling crane started grabbing the canisters off the ship and connecting them to the wall socket
// ... It might be slow if there are many canisters, but they could go over to the controls and start calculating").
// And it can be worked by hand (2026-11-16: "It might be a good idea to let people free move the crane, or even pick
// up canisters and load them. But if they want to make credits then math will be involved"): FREE CONTROL at the
// chair (src/cranedrive.js), and the CRANE OPERATOR JOB, whose right answers are its moves (src/jobs/crane.js).
// The round itself is the kit's (kit/crane.js finds the parts and moves them, kit/crane-plan.js is the timetable);
// working it by hand is the kit's too (kit/crane-drive.js); this file is the game's part of it:
//   - THE CLOCK. The round runs only while the hangar is being drawn, or a room with a window onto it (the control
//     room). Otherwise nothing is worked out at all, and it goes on from where it was when someone looks again.
//   - DRAWN WITH ITS ROOM. The moving parts are the kit's door leaves, which are drawn wherever the eye is; here they
//     are hung on the hangar's own room, so they are drawn only when it is.
//   - NOBODY UNDER A LOAD. The crane knows the patch of floor it is about to work over (a canister coming down onto
//     the ship's tray, the rack, a socket; a tray sliding out at head height). While anyone stands on that patch, or
//     within RULES.margin of it, the crane slows to a stop and waits, its beacons flashing, and goes on once they
//     have stepped away. It never starts down over someone, and it stops if someone walks under it. The sockets' own
//     stretch of floor is railed off besides (the station file's guard rail): canisters stand docked there at shin
//     height. Worked by hand it keeps the same rule (kit/crane-drive.js).
//   - WHERE A PERSON CAN WALK. The canisters on the rack stop a person as furniture does; the parts overhead stop
//     nobody.
//   - TAKING THE CONTROLS AND GIVING THEM BACK. take(): the round runs on to its next moment with nothing half done
//     (a few seconds at most: kit/crane-plan.js cleanAt), and from there the crane is live, worked by whoever took it
//     (crane.live: kit/crane-drive.js). give(): the live crane lets go of a canister that is resting, works its way
//     up out of wherever it is, and the round takes over from where everything is (kit/crane-plan.js planFrom):
//     whatever it holds goes where it belongs, and on it goes.
//   - WHAT STANDS STILL, for the crane worked by hand: the hangar, the ship and the control room's window wall,
//     chopped into REACH.voxel cubes, only within the crane's reach, made once (the first time someone takes the
//     controls, about a quarter of a second).
//
//   const crane = makeCrane({ W, walls })
//   crane.update(dt, { eyes })     once a frame, before the picture: eyes are where people are (the player, the crew)
//   crane.take() / crane.give()    the controls (crane.mode: 'round' | 'handover' | 'live' | 'leaving'); while live,
//                                  crane.live is the crane worked by hand and crane.command(cmd) this frame's stick
//   crane.load()                   the load in plain numbers, and for how long each stays as it is, for the job's
//                                  pay slip (kit/crane-plan.js loadAt, steadyAt; while worked by hand, nothing stays)
//   crane.t, crane.round, crane.waiting, crane.seek(t), crane.skip(seconds), crane.pose()     for the rigs
import { makeOreLine } from '../kit/crane.js';
import { makeDrive } from '../kit/crane-drive.js';
import { Voxels } from '../kit/bake.js';
import * as THREE from 'three';
import { LOADS } from './jobs/smelter.js';

export const RULES = {
  margin: 0.9,      // how far beyond the canister's own patch of floor a person stops it (metres)
  ahead: 1.5,       // it holds this long (seconds) before it would start over a patch someone is on
  ease: 2.5,        // how quickly it slows to a stop and picks up again (the larger the quicker)
  flash: 0.8,       // the beacons' flash (seconds on and off together)
  travel: 1.6,      // ... their slower flash while the crane is worked by hand and moving
  head: 2.4,        // people higher than this over the floor are not under it (the catwalk)
};
export const REACH = { voxel: 0.05, pad: 0.8 };

export function makeCrane({ W, walls }) {
  const L = makeOreLine(W.built, { rail: W.R?.places?.crane || null });
  if (!L) { console.info('crane: the station has no ore line'); return { on: false, mode: 'none', update() {}, load: () => null, pose() {}, take: () => false, give() {}, command() {} }; }
  // its room (the hangar the crane's own piece is in), and the rooms that look into it through a window (an opening
  // between two rooms that does not reach the floor)
  const room = W.room(L.doors[0].zone);
  const lookers = (W.R.portals || []).filter((P) => !P.door && P.box[0][1] > 0.5 && (P.a === room.id || P.b === room.id)).map((P) => W.room(P.a === room.id ? P.b : P.a)).filter(Boolean);
  for (const im of L.meshes) room.group.add(im);
  // the station's frame leaves these doors to the crane; where people walk, a part low enough to walk into stays in
  // the way for good (the rack's canisters: a bay is never somewhere to stand), a part overhead is no door at all
  for (const D of L.doors) { W.driven.add(D); W.keepShut.delete(D); }
  for (let i = walls.doors.length - 1; i >= 0; i--) { const d = walls.doors[i]; if (!L.doors.includes(d.D)) continue; if (d.box.min.y > 1.75) walls.doors.splice(i, 1); else d.locked = true; }

  let t = 0, rate = 1, flash = 0, mode = 'round', handAt = null, live = null, cmd = {}, voxels = null, eyesNow = [];
  const world = { solid: (x, y, z) => voxels.full(x, y, z), get eyes() { return eyesNow; } };
  const oreOf = () => LOADS[L.round % LOADS.length] / 10;   // (tonnes of ore in a full canister of this round's load)
  const seen = () => room.group.visible || lookers.some((z) => z.group.visible);
  const C = {
    on: true, L, waiting: false, RULES, world,
    get t() { return t; }, get round() { return L.round; }, get rate() { return rate; }, get mode() { return mode; }, get live() { return mode === 'live' ? live : null; }, get drive() { return live; },
    update(dt, { eyes = [] } = {}) {
      eyesNow = eyes;
      if (!seen()) return;
      if (mode === 'live' || mode === 'leaving') {
        live.step(dt, mode === 'live' ? cmd : {}); cmd = {};
        // (its beacons: quick, as the round's, while someone is under the load; slow while it moves, as a working
        // crane's do; dark when it is still)
        const people = live.notes.some((n) => n.key === 'people'), period = people ? RULES.flash : live.moving ? RULES.travel : 0;
        if (period) { flash += dt; L.beacon(flash % period < period * 0.5); } else if (flash) { flash = 0; L.beacon(false); }
        C.waiting = people;
        L.poseState(live.state);
        if (mode === 'leaving' && live.left) { L.resume(live.state); t = 0; mode = 'round'; live = null; C.waiting = false; L.beacon(false); flash = 0; }
        return;
      }
      // anyone on the patch it is working over, or is about to?
      const g = L.gate(t, RULES.ahead); let blocked = false;
      if (g) for (const e of eyes) if (e.y < RULES.head && Math.abs(e.x - g.x) < g.hx + RULES.margin && Math.abs(e.z - g.z) < g.hz + RULES.margin) { blocked = true; break; }
      C.waiting = blocked;
      const want = blocked ? 0 : 1; rate += (want - rate) * Math.min(1, dt * RULES.ease); if (Math.abs(want - rate) < 0.02) rate = want;
      if (blocked) { flash += dt; L.beacon(flash % RULES.flash < RULES.flash * 0.5); } else if (flash) { flash = 0; L.beacon(false); }
      if (rate > 0 && dt > 0) {
        let to = t + dt * rate;
        // (being handed over: up to the moment nothing is half done, and from there it is live)
        if (mode === 'handover' && to >= handAt) { t = handAt; L.pose(t); goLive(); return; }
        t = to; while (t >= L.length) { t -= L.length; L.next(); if (mode === 'handover') handAt = null; }
        if (mode === 'handover' && handAt == null) handAt = L.clean(t) ?? t;
        L.pose(t);
      }
    },
    // ── the controls ──
    take() {
      if (mode === 'live') return true;
      if (mode === 'leaving') { live = makeDrive(L.site, live.state, world, { ore: oreOf }); mode = 'live'; return true; }
      if (!voxels) voxels = reachVoxels(W, L.site);
      handAt = L.clean(t);
      if (handAt == null) handAt = t;
      mode = 'handover';
      if (handAt <= t + 1e-9) goLive();
      return true;
    },
    give() { if (mode === 'handover') { mode = 'round'; handAt = null; return; } if (mode !== 'live') return; live.leave(); mode = 'leaving'; },
    command(c) { cmd = c || {}; },
    load: () => (mode === 'round' || mode === 'handover' ? { ...L.load(t), steady: L.steady(t), round: L.round, t, length: L.length } : { ...loadOfState(live.state, L.site), steady: { onShip: 0, fullOnShip: 0, docked: 0, drained: 0, onRack: 0 }, round: L.round, t, length: L.length }),
    // (for the rigs: the round as it is now, drawn again; a moment of this round; so many seconds on, with nobody about)
    pose() { if (live) L.poseState(live.state); else L.pose(t); },
    seek(to) { if (mode !== 'round') return t; t = Math.max(0, Math.min(L.length - 1e-3, to)); L.pose(t); return t; },
    skip(seconds) { if (mode !== 'round') return t; t += seconds; while (t >= L.length) { t -= L.length; L.next(); } L.pose(t); return t; },
    voxels: () => voxels || (voxels = reachVoxels(W, L.site)),
    oreOf,
  };
  function goLive() {
    live = makeDrive(L.site, L.state(t), world, { ore: oreOf });
    mode = 'live'; handAt = null; rate = 1; C.waiting = false; L.beacon(false); flash = 0;
    L.poseState(live.state);
  }
  return C;
}

// the load in plain numbers from a state (the crane worked by hand: kit/crane-plan.js loadAt's shape)
function loadOfState(S, site) {
  const out = { canisters: site.mounts.length, phase: 'by hand', onShip: 0, fullOnShip: 0, docked: [], drained: 0, onRack: 0, carried: 0 };
  for (const q of S.cans) {
    if (q.where === 'mount') { out.onShip++; if (q.fill > 0.5) out.fullOnShip++; }
    else if (q.where === 'socket') { out.docked.push({ socket: q.i, percent: Math.round(q.fill * 100) }); if (q.fill <= 0) out.drained++; }
    else if (q.where === 'bay') out.onRack++; else out.carried++;
  }
  out.docked.sort((a, b) => a.socket - b.socket);
  return out;
}

// WHAT STANDS STILL WITHIN THE CRANE'S REACH: every room's walls, floors, windows and furniture (the station's merged
// meshes: the hangar, the parked Miner, the control room's window wall), only the triangles that come within reach
// of the two legs (the rail's run, the beam's reach and a canister's length either side, the floor to the cradle's
// top), each marked into REACH.voxel cubes (the kit's own voxels, kit/bake.js)
export function reachVoxels(W, site, size = REACH.voxel) {
  const t0 = performance.now(), pad = site.dims.reach + site.can.half + REACH.pad, top = site.carry + site.dims.grip.top + 0.4;
  const boxes = [
    new THREE.Box3(new THREE.Vector3(site.rail.wall[0] - REACH.pad, -0.1, site.wallZ - pad), new THREE.Vector3(site.rail.wall[1] + REACH.pad, top, site.wallZ + pad)),
    new THREE.Box3(new THREE.Vector3(site.shipX - pad, -0.1, site.rail.ship[0] - REACH.pad), new THREE.Vector3(site.shipX + pad, top, site.rail.ship[1] + REACH.pad)),
  ];
  const all = boxes[0].clone().union(boxes[1]);
  const V = new Voxels(all, size);
  let tris = 0, kept = 0;
  const tb = new THREE.Box3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const st = size * 0.5, inv = 1 / size, mx = V.min.x, my = V.min.y, mz = V.min.z;
  for (const z of W.built.zones) for (const k of ['solid', 'floor', 'glass', 'shield']) {
    const g = z.merged && z.merged[k]; if (!g) continue;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!boxes.some((B) => B.intersectsBox(g.boundingBox))) continue;
    const p = g.attributes.position.array, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.length / 3;
    for (let t = 0; t < n; t += 3) {
      tris++;
      const ia = (ix ? ix[t] : t) * 3, ib = (ix ? ix[t + 1] : t + 1) * 3, ic = (ix ? ix[t + 2] : t + 2) * 3;
      a.set(p[ia], p[ia + 1], p[ia + 2]); b.set(p[ib], p[ib + 1], p[ib + 2]); c.set(p[ic], p[ic + 1], p[ic + 2]);
      tb.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c);
      if (!boxes.some((B) => B.intersectsBox(tb))) continue;
      kept++;
      // (as the kit marks them: the triangle sampled finer than a voxel)
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
      const nu = Math.max(1, Math.ceil(Math.hypot(ux, uy, uz) / st)), nv = Math.max(1, Math.ceil(Math.hypot(vx, vy, vz) / st));
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
        const fu = i / nu, fv = j / nv; if (fu + fv > 1.0001) continue;
        const x = a.x + ux * fu + vx * fv, y = a.y + uy * fu + vy * fv, zz = a.z + uz * fu + vz * fv;
        if (x < all.min.x || x > all.max.x || y < all.min.y || y > all.max.y || zz < all.min.z || zz > all.max.z) continue;
        V.set(Math.floor((x - mx) * inv), Math.floor((y - my) * inv), Math.floor((zz - mz) * inv));
      }
    }
  }
  V.ms = performance.now() - t0; V.tris = tris; V.kept = kept;
  console.info(`crane: what stands within its reach, ${kept} of ${tris} triangles, in ${V.bricks} bricks of ${size} m cubes, ${V.ms.toFixed(0)} ms`);
  return V;
}
