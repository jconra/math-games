// THE SMELTER'S CRANE, in the game: the ceiling crane in the Miner hangar swaps the parked Miner's ore canisters by
// itself, round after round, while the player does the sums at the operator's chair (the game's maker, 2026-11-05: "it
// would be cool if a ceiling crane started grabbing the canisters off the ship and connecting them to the wall socket
// ... It might be slow if there are many canisters, but they could go over to the controls and start calculating").
// The round itself is the kit's (kit/crane.js finds the parts and moves them, kit/crane-plan.js is the timetable);
// this file is the game's part of it:
//   - THE CLOCK. The round runs only while the hangar is being drawn, or a room with a window onto it (the control
//     room). Otherwise nothing is worked out at all, and it goes on from where it was when someone looks again.
//   - DRAWN WITH ITS ROOM. The moving parts are the kit's door leaves, which are drawn wherever the eye is; here they
//     are hung on the hangar's own room, so they are drawn only when it is.
//   - NOBODY UNDER A LOAD. The crane knows the patch of floor it is about to work over (a canister coming down onto
//     the ship's tray, the rack, a socket; a tray sliding out at head height). While anyone stands on that patch, or
//     within RULES.margin of it, the crane slows to a stop and waits, its beacons flashing, and goes on once they
//     have stepped away. It never starts down over someone, and it stops if someone walks under it. The sockets' own
//     stretch of floor is railed off besides (the station file's guard rail): canisters stand docked there at shin
//     height.
//   - WHERE A PERSON CAN WALK. The canisters on the rack stop a person as furniture does; the parts overhead stop
//     nobody.
//
//   const crane = makeCrane({ W, walls })
//   crane.update(dt, { eyes })     once a frame, before the picture: eyes are where people are (the player, the crew)
//   crane.load()                   the load in plain numbers, and for how long each stays as it is, for the job's
//                                  pay slip (kit/crane-plan.js loadAt, steadyAt)
//   crane.t, crane.round, crane.waiting, crane.seek(t), crane.skip(seconds), crane.pose()     for the rigs
import { makeOreLine } from '../kit/crane.js';

export const RULES = {
  margin: 0.9,      // how far beyond the canister's own patch of floor a person stops it (metres)
  ahead: 1.5,       // it holds this long (seconds) before it would start over a patch someone is on
  ease: 2.5,        // how quickly it slows to a stop and picks up again (the larger the quicker)
  flash: 0.8,       // the beacons' flash (seconds on and off together)
  head: 2.4,        // people higher than this over the floor are not under it (the catwalk)
};

export function makeCrane({ W, walls }) {
  const L = makeOreLine(W.built);
  if (!L) { console.info('crane: the station has no ore line'); return { on: false, update() {}, load: () => null, pose() {} }; }
  // its room (the hangar the crane's own piece is in), and the rooms that look into it through a window (an opening
  // between two rooms that does not reach the floor)
  const room = W.room(L.doors[0].zone);
  const lookers = (W.R.portals || []).filter((P) => !P.door && P.box[0][1] > 0.5 && (P.a === room.id || P.b === room.id)).map((P) => W.room(P.a === room.id ? P.b : P.a)).filter(Boolean);
  for (const im of L.meshes) room.group.add(im);
  // the station's frame leaves these doors to the crane; where people walk, a part low enough to walk into stays in
  // the way for good (the rack's canisters: a bay is never somewhere to stand), a part overhead is no door at all
  for (const D of L.doors) { W.driven.add(D); W.keepShut.delete(D); }
  for (let i = walls.doors.length - 1; i >= 0; i--) { const d = walls.doors[i]; if (!L.doors.includes(d.D)) continue; if (d.box.min.y > 1.75) walls.doors.splice(i, 1); else d.locked = true; }

  let t = 0, rate = 1, flash = 0;
  const C = {
    on: true, L, waiting: false, RULES,
    get t() { return t; }, get round() { return L.round; }, get rate() { return rate; },
    update(dt, { eyes = [] } = {}) {
      if (!room.group.visible && !lookers.some((z) => z.group.visible)) return;
      // anyone on the patch it is working over, or is about to?
      const g = L.gate(t, RULES.ahead); let blocked = false;
      if (g) for (const e of eyes) if (e.y < RULES.head && Math.abs(e.x - g.x) < g.hx + RULES.margin && Math.abs(e.z - g.z) < g.hz + RULES.margin) { blocked = true; break; }
      C.waiting = blocked;
      const want = blocked ? 0 : 1; rate += (want - rate) * Math.min(1, dt * RULES.ease); if (Math.abs(want - rate) < 0.02) rate = want;
      if (blocked) { flash += dt; L.beacon(flash % RULES.flash < RULES.flash * 0.5); } else if (flash) { flash = 0; L.beacon(false); }
      if (rate > 0 && dt > 0) { t += dt * rate; while (t >= L.length) { t -= L.length; L.next(); } L.pose(t); }
    },
    load: () => ({ ...L.load(t), steady: L.steady(t), round: L.round, t, length: L.length }),
    // (for the rigs: the round as it is now, drawn again; a moment of this round; so many seconds on, with nobody about)
    pose() { L.pose(t); },
    seek(to) { t = Math.max(0, Math.min(L.length - 1e-3, to)); L.pose(t); return t; },
    skip(seconds) { t += seconds; while (t >= L.length) { t -= L.length; L.next(); } L.pose(t); return t; },
  };
  return C;
}
