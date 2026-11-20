// A SHIP'S HULL, FLOWN: the part of the one shared ship piece that draws a ship where it is flown, turns and fires its
// thruster pods if it has any, lights its engine's glow and blows the dust about under it (the plain part, and the
// list of what each ship is: src/fleet.js). The same for every ship, from how its kit says it is flown (its nozzles and
// their jets' look, its pods: src/boarding.js SHIPS `flight`) and its room of the station.
//
// THE GAME'S MAKER (2026-11-19): "Yeah I was hoping that the ships will basically all fly the same and share the same
// class so that we don't have a lot of repetitive work and code." And of the Miner's landing (2026-11-17): "It should
// use the maneuvering thrusters (just like flight should). Those 6 little dodads that we built on the corners. They
// should turn and shoot out flames. ... Also, I'd expect the main engine to be glowing, even if it is only just idling
// (It should still be hot I'd expect) ... I'm not sure if there's a good way to make it look like there's some wind and
// blasts of air shooting down, but it would be cool." (kit/ships/flight.js does the jets and the air.)
//
// THE PARKED SHIP IS A ROOM OF THE STATION (drawn with its hangar) with moving parts of its own (its doors: its ways
// in, its legs, its pods). Flown, all of it is drawn moved by one matrix, from where it is parked to where it is now;
// its cabin is boarding's (src/boarding.js fly). A ship with pods has them drawn with its hangar, as the crane's parts
// are, rather than wherever anyone is. A ship without pods flies the same: its main engine's glow, and the air under
// it in its bay.
//
//   const H = makeHull({ W, id, kit, skip, hangar })
//     kit      how its kit is flown (src/boarding.js flight): { nozzles(), jet, pods: { piece, half, jet } | null, deck }
//     skip     a pattern of mesh names that are not the hull's to move (the Miner's canisters: the crane puts each
//              where it is, src/crane.js)
//     hangar   the hangar's room the pods and the air are drawn with (default: the one the ship is drawn with)
//   H.move(M)          the hull drawn where M has it (a Matrix4 from where it is parked; null: parked)
//   H.fx()             its thrusters, engine and air, made the first time they are wanted: the flight (kit/ships/
//                      flight.js makeFlight) or false (its pods are not live doors in this station)
//   H.thrust(dt, how)  while it is flown: { acc, spin, hold, engine, heat } and { x, z, height } over its hangar's floor
//   H.rest()           its pods back along it, its jets out, the air gone (the nozzle's heat goes with the rest)
//   H.zone, H.meshes, H.pods, H.flight, H.air
// AS ITS OWN KEEPER, for a ship that has no crane of its own (the Explorer, the Medic: what src/flying.js asks of the
// Miner's crane, ctx.hull):
//   H.fly(D, dt, how)  flown (D: from where it is parked to where it is now; null: standing again)
//   H.stand(D)         set down somewhere else than it is parked (null: its proper parking place): its cabin, its ways
//                      in and the walls follow (boarding.stand); H.standing: the Matrix4 it stands by, or null
//   H.padBusy()        is anyone standing on its pad (not those aboard)
import * as THREE from 'three';
import { makeFlight, makeDownwash } from '../kit/ships/flight.js';

// THE THRUSTERS IN A HANGAR: how far the pods may turn (a little further down than the ship lab's swing, so the jets
// blow down at the floor), the pods' jets' length against the lab's, the main engine idling, how long its nozzle takes
// to cool after it is down (s), how long the dust takes to settle (s), the pods' flames dying away as it settles (s)
// (first made for the Miner's landing: src/crane.js LANDING)
export const FLIGHT = { swing: { yaw: 1.2, pitch: 0.62 }, podLen: 1.1, idle: 0.15, cool: 30, settle: 2.6, wind: 0.7 };

export function makeHull({ W, id, kit, skip = null, hangar = null, boarding = null, eyes = () => [] }) {
  const room = 'ship-' + id, zone = W.room(room); if (!zone) return null;
  const home = hangar || W.room((zone.with || [])[0]) || null;
  // the moving parts that are its alone (not shared with another room), but those it is told to leave alone
  const mine = new Set(), others = new Set();
  for (const D of W.built.doors) for (const leaf of D.leaves) for (const im of leaf.meshes || []) (D.zone === room ? mine : others).add(im);
  const meshes = [...mine].filter((im) => !others.has(im) && !(skip && skip.test(im.name)));
  // (its thruster pods, live doors so they can be turned, drawn with the hangar)
  const P = kit && kit.pods;
  if (P && home) for (const D of W.built.doors) if (D.zone === room && D.piece === P.piece) for (const leaf of D.leaves) for (const im of leaf.meshes || []) if (meshes.includes(im)) home.group.add(im);

  const H = {
    id, zone, meshes, pods: [], flight: null, air: null,
    move(M) {
      if (!M) { zone.group.matrix.identity(); zone.group.matrixWorldNeedsUpdate = true; for (const im of meshes) { im.matrix.identity(); im.matrixWorldNeedsUpdate = true; } return; }
      zone.group.matrixAutoUpdate = false; zone.group.matrix.copy(M); zone.group.matrixWorldNeedsUpdate = true;
      for (const im of meshes) { im.matrixAutoUpdate = false; im.matrix.copy(M); im.matrixWorldNeedsUpdate = true; }
    },
    // the thrusters, the engine and the air it blows down (the pods, if it has them, must be live doors: a station
    // file's parked ship may hold none of them)
    fx() {
      if (H.flight !== null) return H.flight;
      const pods = P ? W.built.doors.filter((D) => D.zone === room && D.piece === P.piece && D.hold == null && D.leaves.length && D.leaves[0].hinge) : [];
      if (P && !pods.length) { H.flight = false; return H.flight; }
      // (the ship's own frame where it is parked: its first moving part's placement, less its deck)
      const D0 = pods[0] || W.built.doors.find((D) => D.zone === room && D.leaves.length && D.leaves[0].M);
      if (!D0) { H.flight = false; return H.flight; }
      const frame = new THREE.Matrix4().copy(D0.leaves[0].M).multiply(new THREE.Matrix4().makeTranslation(0, -kit.deck, 0));
      H.flight = makeFlight({ pods, podHalf: P ? P.half : 0, swing: FLIGHT.swing, nozzles: kit.nozzles(), jet: kit.jet, podJet: P ? { len: P.jet.len * FLIGHT.podLen, gain: P.jet.gain, r: P.jet.r } : undefined, frame, parent: zone.group, quality: W.quality });
      H.air = makeDownwash({ parent: (home || zone).group, quality: W.quality });
      H.pods = pods;
      return H.flight;
    },
    // (its pods are the flying's to turn from now on, not the station's frame's)
    lift() { if (H.fx()) for (const D of H.pods) W.driven.add(D); },
    thrust(dt, how) {
      if (!H.flight || !how) return;
      H.flight.update(dt, how);
      if (how.height != null && how.hold > 0.01) H.air.update(dt, { x: how.x, z: how.z, height: how.height, strength: how.hold * (how.height < 4 ? 0.8 : 0.4), spread: 1 }); else H.air.hide();
    },
    rest() {
      if (H.flight) { H.flight.rest(); for (const D of H.pods) W.driven.delete(D); }
      if (H.air) H.air.hide();
    },
    // ── as its own keeper ──
    fly(D, dt = 0, how = null) {
      if (!D) { if (aloft) { aloft = false; H.move(standM); H.rest(); } return true; }
      if (!aloft) { aloft = true; H.lift(); }
      H.move(D); H.thrust(dt, how);
      return true;
    },
    stand(D = null) {
      standM = D ? (standM || new THREE.Matrix4()).copy(D) : null;
      if (boarding && boarding.stand) boarding.stand(id, standM);
      if (!aloft) H.move(standM);
      return true;
    },
    get standing() { return standM; }, get aloft() { return aloft; },
    padBusy: () => { const at = padAt(); return !!at && eyes().some((e) => e.y < 2 && Math.hypot(e.x - at.x, e.z - at.z) < 7 && !(boarding && boarding.inside && boarding.inside(e))); },
  };
  let aloft = false, standM = null, pad = null;
  const padAt = () => pad || (pad = W.R?.places?.ships?.[id]?.at ? new THREE.Vector3(...W.R.places.ships[id].at) : null);
  return H;
}
