// THE RESCUE ON FOOT, THE PLAIN PART (no three.js, so the tests run it in Node: tests/rescue.test.mjs). The Medic set down
// beside the wreck (src/planet/medicdown.js draws it), the player walking down its ramp to the stasis pods (src/planet/
// onfoot.js), and whoever was asleep in an opened pod getting out and coming aboard by themselves (src/rescued.js).
//
// THE GAME'S MAKER: "you walk down the Medic's ramp to the pods on the ground" (MED-1), and of the rescued (RESC1-1 A):
// they "sit up, climb out, walk up the ramp themselves and take a bed or seat aboard". MED-1: "some could sit in the medic
// ship and others could lay down".
//
//   medicStand(landing, pods) -> { x, y, z, yaw, side }   where the Medic stands in the landing ring as landed (its
//            middle at the ring's middle, on the level ground), turned so the side its ramp comes down on faces the
//            pods' middle (`side`: 'port'); yaw: the turn of its nose (+z of its own frame) about straight up
//   toWorld(stand, [x, y, z]) / toShip(stand, [x, y, z])   a point of the ship's own frame (x to port, y up from its ground
//            line, z to the nose) in the world, and back
//   patientBeds(bp, deck) -> [{ id, name, side, frame: { o, x, z }, mirror, bed }]   the Medic's patient beds (its
//            blueprint's 'patient' items) as src/onbed.js beds: `bed` in onbed's own frame (its top, its edge, where the
//            hips lie, where one stands at its side), `frame` the bed's frame in the ship's (its origin on the deck at the
//            head's wall, x across toward its open side, z along toward its foot), `mirror` when that frame is got onto
//            from its other side (onbed's moves turned the other way round: src/moves.js bedPose)
//   seatsFor(places) -> the seats a rescued person may take, best first (aboardplan.js placesOf's: not the cockpit's
//            first, then the cockpit's that no job of the crew has)
//   choose(beds, seats, taken) -> { kind: 'bed' | 'seat', place } | null   the next free one: a patient bed while there is
//            one, else a seat (the brief: "if the beds are full, a seat")
//   GETTING OUT of a pod and ONTO a bed: onbed.js's own moves, in order (OUT, ON); WAKE: the eyes opening and a moment
//            before sitting up (s)
import { MOVES_ON, MOVES_OFF } from './onbed.js';

// the Medic's blueprint (src/boarding.js SHIPS: 'medic-open-bench', his pick; a test holds the two together) and how a
// person is felt in its cabin (boarding.js CABIN_WALLS), and when a person may walk through a way in (WAY_OPEN)
export const MEDIC = { bp: 'medic-open-bench', cabin: { voxel: 0.05, r: 0.15 }, wayOpen: 0.97 };
// THE PATIENT BED (kit/shipparts/cabin/medbay.js patientBed, as kit/ships/medic-furnish.js puts it in: its head at the
// hull's wall, running in along the bed's item; the stretcher on its base, its pads' top the item's height): for onbed,
// its pads' half width (the stretcher's 0.72 m), where the hips lie along it from the wall (at the back section's hinge,
// 0.78 m along the stretcher from its head), where the hands keep off (the pillow), where one stands at its side (the
// base is 0.9 m across: the hip joints 0.17 m out past it, the back just clear), the seat's height over the pad when
// sitting on its edge, and the back section's raise (its stretcher's `back`, radians: lying, the back lies on it)
export const PATIENT = { pad: 0.36, hips: 0.88, rest: [0, 0.5], stand: 0.62, hipUp: 0.095, back: 0.3 };
// THE POD'S BED (kit/stasispod-plan.js bedFrame) as the rescued get out of it: one stands up at its front, the side its
// screen is on, a little further out than the bed frame's own stand (0.3 past the pad's edge), so the back is clear of
// the pod's front, which bulges out past the pad's edge (m past the pad's edge)
export const POD_OUT = { stand: 0.45 };
// THE WAKE: the eyes open (the crew kit's lids open over 0.35 s, kit/lids.js), and a moment lying still, awake, before
// sitting up (s); the lid must be this far open first (0..1)
export const WAKE = { lid: 0.85, still: 1.4 };
// THE MOVES, onbed.js's own (getting off the scanner's bed is getting out of a pod: bend the knees, sit up, swing the
// legs out, slide off; getting onto a patient bed is getting onto the scanner's: back up to it, hop up, swing round, lie
// back, stretch out)
export const OUT = MOVES_OFF.map((m) => m[0]), ON = MOVES_ON.map((m) => m[0]);

const r3 = (v) => +v.toFixed(3);
// WHERE THE MEDIC STANDS, as landed (piece 3 of the plan: another piece flies it down; this one places it so)
export function medicStand(landing, pods = []) {
  const L = landing, n = pods.length;
  // (the pods' middle: the way the ramp faces; none, toward +x)
  let dx = 1, dz = 0;
  if (n) { const cx = pods.reduce((s, p) => s + p.x, 0) / n, cz = pods.reduce((s, p) => s + p.z, 0) / n, l = Math.hypot(cx - L.x, cz - L.z); if (l > 1e-6) { dx = (cx - L.x) / l; dz = (cz - L.z) / l; } }
  // (port, the ship's +x, is (cos yaw, -sin yaw) in the world: turned so it points at the pods)
  const yaw = Math.atan2(-dz, dx);
  return { x: L.x, y: L.y, z: L.z, yaw: r3(yaw), side: 'port' };
}
export function toWorld(S, [x, y, z]) { const c = Math.cos(S.yaw), s = Math.sin(S.yaw); return [S.x + c * x + s * z, S.y + y, S.z - s * x + c * z]; }
export function toShip(S, [x, y, z]) { const c = Math.cos(S.yaw), s = Math.sin(S.yaw), dx = x - S.x, dz = z - S.z; return [c * dx - s * dz, y - S.y, s * dx + c * dz]; }

// THE PATIENT BEDS, as onbed beds. A bed's item runs from the hull's wall inward (its long way across the ship); its open
// side is the bay's floor toward the nose (the aisle between the ramps: a bed's aft side is against the bay's aft wall).
// The bed's frame: its origin on the deck at the head's wall, on the bed's middle line; z along it (away from the wall),
// x across toward the open side. On the port side that frame is a turn of the ship's; on the starboard side, as a turn,
// its x points aft: the bed is got onto from its -x (mirror)
export function patientBeds(bp, deck) {
  const out = [];
  for (const it of (bp.items || []).filter((x) => x.kind === 'patient')) {
    const [x0, z0, x1, z1] = it.rect, alongX = x1 - x0 >= z1 - z0;
    if (!alongX) continue;                          // (the Medic's run across the ship; one along it would be the other way)
    const port = (x0 + x1) / 2 > 0, wall = port ? x1 : x0, zm = (z0 + z1) / 2, top = +it.h || 0.8;
    // (along: away from the wall; across, as a turn of the ship's frame: port, along -x so across +z; starboard, along
    // +x so across -z, and the open side, the nose's, is then its -x)
    const along = [port ? -1 : 1, 0, 0], across = [0, 0, port ? 1 : -1];
    const bed = { top, edge: PATIENT.pad, pad: PATIENT.pad, z: PATIENT.hips, stand: [PATIENT.stand, PATIENT.hips], hipUp: PATIENT.hipUp, rest: PATIENT.rest };
    out.push({ id: it.id, name: it.name || 'Patient bed', side: port ? 'port' : 'starboard', frame: { o: [wall, deck, zm], x: across, z: along }, mirror: !port, bed, back: PATIENT.back });
  }
  return out;
}
// a point of a patient bed's own frame (onbed's, mirrored as the bed is) in the ship's
export function bedToShip(B, [x, y, z]) {
  const s = B.mirror ? -1 : 1, F = B.frame;
  return [F.o[0] + F.x[0] * x * s + F.z[0] * z, F.o[1] + y, F.o[2] + F.x[2] * x * s + F.z[2] * z];
}
// THE SEATS, best first: off the flight deck first (the lab's stool, the crew room's stools), then the cockpit's seats no
// job has (the pilot's is the pilot's); benches as aboardplan.js counts them (a place each 0.6 m)
export function seatsFor(places) {
  const sit = places.filter((p) => p.kind === 'sit');
  return [...sit.filter((p) => !p.cockpit), ...sit.filter((p) => p.cockpit && p.job !== 'pilot')];
}
// THE NEXT ONE'S PLACE: a patient bed while one is free, else a seat; taken: a Set of the ids taken
export function choose(beds, seats, taken) {
  const b = beds.find((x) => !taken.has(x.id)); if (b) return { kind: 'bed', place: b };
  const s = seats.find((x) => !taken.has(x.id)); if (s) return { kind: 'seat', place: s };
  return null;
}
// LYING ON A PATIENT BED: its stretcher's back section is raised (PATIENT.back), so the lean back stops that far short of
// flat, the back on it (onbed's own moves lie flat, as on the scanner's bed)
export const leanOn = (lean, back = PATIENT.back) => Math.min(lean, Math.PI / 2 - back);
