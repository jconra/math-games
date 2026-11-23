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
// ITS PADS' TOP IS LOWER THAN THE ITEM'S HEIGHT (`under`, m: medbay.js patientBed puts the base's top 0.12 under the
// item's height, the stretcher's frame 0.02 under that, and stretcher.js its pads from 0.02 over the frame, 0.075 thick:
// 0.045 under). Taken for the item's height, everyone lay that much over the pads: the hips just touching, the legs and
// the heels 4 to 10 cm in the air (measured, rigs/rescue-8/lab.cjs: RESCUE_8.md). AND THE HEAD ON ITS PILLOW (`head`: how
// far from the head's wall the head's own bone lies, m: over the pillow's middle; the pillow lies 0.15 to 0.43 m from
// the wall on the raised back): each person's hips are placed by their own trunk's length (patientBedFor, as the ward's
// bed places them by their legs': src/wardplan.js bedFor), no nearer the wall than the back section's hinge (`hips`)
// and no further than `most`. With everyone's hips at the hinge the longer trunks had their shoulders on the pillow and
// the head past it, against the wall. THE PILLOW PROPS THE HEAD AND SHOULDERS (`prop`, radians): lying, the trunk is
// raised that much more than the back section it lies on, so the back rests on the pad and the shoulders and the head
// on the pillow (7 cm thick) instead of in it (measured: the head's back was 10 cm under the pillow's top).
export const PATIENT = { pad: 0.36, hips: 0.88, rest: [0, 0.5], stand: 0.62, hipUp: 0.095, back: 0.3, under: 0.045, head: 0.3, most: 1.12, prop: 0.06 };
// THE POD'S BED (kit/stasispod-plan.js bedFrame) as the rescued get out of it: one stands up at its front, the side its
// screen is on, a little further out than the bed frame's own stand (0.3 past the pad's edge), so the back is clear of
// the pod's front, which bulges out past the pad's edge (m past the pad's edge)
// ITS FRONT RIM stands over its pad's own height toward its foot end, by up to 7 cm (measured, rigs/rescue-8/lab.cjs: the
// feet, carried round 6 cm over the pad, went through it there): `rim`, the feet carried that much higher (onbed.js)
export const POD_OUT = { stand: 0.45, rim: 0.08 };
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
    const port = (x0 + x1) / 2 > 0, wall = port ? x1 : x0, zm = (z0 + z1) / 2, top = r3((+it.h || 0.8) - PATIENT.under);
    // (along: away from the wall; across, as a turn of the ship's frame: port, along -x so across +z; starboard, along
    // +x so across -z, and the open side, the nose's, is then its -x)
    const along = [port ? -1 : 1, 0, 0], across = [0, 0, port ? 1 : -1];
    const bed = { top, edge: PATIENT.pad, pad: PATIENT.pad, z: PATIENT.hips, stand: [PATIENT.stand, PATIENT.hips], hipUp: PATIENT.hipUp, rest: PATIENT.rest };
    out.push({ id: it.id, name: it.name || 'Patient bed', side: port ? 'port' : 'starboard', frame: { o: [wall, deck, zm], x: across, z: along }, mirror: !port, bed, back: PATIENT.back, prop: PATIENT.prop });
  }
  return out;
}
// A PATIENT BED FOR ONE PERSON, as onbed takes it (who: their measures, src/moves.js M.body: `t` their trunk, the hip
// joints' middle to the head's bone): their hips as far from the head's wall as puts their head on the pillow, the back
// lying on the raised back section (its raise shortens the trunk's reach along the bed). Any other bed: as it is
export function bedFor(B, who) {
  if (!B || !B.back || B.lie || B.perch || !(who && who.t > 0)) return B ? B.bed : null;
  const z = r3(Math.min(PATIENT.most, Math.max(PATIENT.hips, PATIENT.head + who.t * Math.cos(B.back))));
  return { ...B.bed, z, stand: [B.bed.stand[0], z] };
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
// THE CREW ROOM'S BUNK AND BED, as onbed beds as the patient beds are (the game's maker, 2026-11-22, RESC4-1 B: after the
// patient beds, "the crew room's bunk and its bed"). The bunk's lower berth (the one lain on without a ladder: its pad
// BED_PAD over the floor, as src/aboardplan.js BED has it) and the bed across the stern (its pad at its item's height).
// Each lies along its item's long way; its head where the cabin's furnishing puts the pillow (kit/ships/medic-furnish.js:
// the bed's head away from the kitchen counter; the bunk's at its cubby's end, as src/aboardplan.js placesOf has it);
// got onto from its open side, the room's floor (away from the hull it stands against). Numbers as the patient bed's,
// for a mattress a metre wide: its half width, where the hips lie from the head, where one stands at its side. LAIN ON
// AS THE CREW ABOARD LIE ON THEM (`lie`: src/aboard.js, "not climbed into: it is there"): walked to its side, then lying
// on it (onbed's lying, on its pad). The scanner's hop is for a high bed: the bunk is low, under its upper berth, with a
// step along it
export const BED_PAD = 0.42;
export const CREW_BED = { pad: 0.42, hips: 0.9, stand: 0.68, hipUp: 0.095, rest: [0, 0.5] };
export function crewBeds(bp, deck) {
  const out = [], rooms = new Map((bp.rooms || []).map((r) => [r.id, r])), items = bp.items || [];
  for (const it of items.filter((x) => x.kind === 'bunk' || x.kind === 'bed')) {
    const r = rooms.get(it.room); if (!r || r.kind !== 'bunks') continue;
    const [x0, z0, x1, z1] = it.rect, alongX = x1 - x0 >= z1 - z0, [rx0, rz0, rx1, rz1] = r.rect;
    // (the wall it stands against: the room's nearest its long side; its open side the other way)
    const lo = alongX ? z0 - rz0 : x0 - rx0, hi = alongX ? rz1 - z1 : rx1 - x1, open = lo <= hi ? 1 : -1;
    // (its head: the bed's away from the kitchen counter; the bunk's at its cubby (a locker at one of its ends), else
    // the higher end of its long way, as placesOf has it)
    const mid = alongX ? (x0 + x1) / 2 : (z0 + z1) / 2, endOf = (o) => (alongX ? (o.rect[0] + o.rect[2]) / 2 : (o.rect[1] + o.rect[3]) / 2);
    const counter = items.find((o) => o.room === it.room && o.kind === 'counter');
    const cubby = items.find((o) => o.room === it.room && o.kind === 'locker' && (alongX ? o.rect[1] < z1 && o.rect[3] > z0 : o.rect[0] < x1 && o.rect[2] > x0) && Math.abs(endOf(o) - mid) > (alongX ? x1 - x0 : z1 - z0) / 2 - 0.01);
    const head = it.kind === 'bed' && counter ? (endOf(counter) > mid ? -1 : 1) : cubby ? (endOf(cubby) > mid ? 1 : -1) : it.head === 'low' ? -1 : 1;
    // (the bed's frame: its origin on the deck at the head's end, on its middle line; z along it, away from the head; x
    // across, as a turn of the ship's frame (x = y cross z); got onto from +x, or from -x: mirror)
    const along = alongX ? [-head, 0, 0] : [0, 0, -head], across = [along[2], 0, -along[0]];
    const o = alongX ? [head > 0 ? x1 : x0, deck, (z0 + z1) / 2] : [(x0 + x1) / 2, deck, head > 0 ? z1 : z0];
    const openDir = alongX ? [0, 0, open] : [open, 0, 0], mirror = across[0] * openDir[0] + across[2] * openDir[2] < 0;
    const top = it.kind === 'bunk' ? BED_PAD : +it.h || 0.6;
    // (where one stands at its side: past a step along its open side (the bunk's step up), on the room's floor)
    const half = (alongX ? z1 - z0 : x1 - x0) / 2, step = items.find((o) => o.room === it.room && o.kind === 'bench' && (+o.h || 0.45) <= 0.35 && (o.rect[2] - o.rect[0] >= o.rect[3] - o.rect[1]) === alongX && (alongX ? o.rect[0] < x1 && o.rect[2] > x0 && (open > 0 ? o.rect[1] >= z1 - 0.01 && o.rect[1] < z1 + 0.3 : o.rect[3] <= z0 + 0.01 && o.rect[3] > z0 - 0.3) : o.rect[1] < z1 && o.rect[3] > z0 && (open > 0 ? o.rect[0] >= x1 - 0.01 && o.rect[0] < x1 + 0.3 : o.rect[2] <= x0 + 0.01 && o.rect[2] > x0 - 0.3)));
    const past = step ? (alongX ? step.rect[3] - step.rect[1] : step.rect[2] - step.rect[0]) : 0;
    const bed = { top, edge: CREW_BED.pad, pad: CREW_BED.pad, z: CREW_BED.hips, stand: [Math.max(CREW_BED.stand, half + past + 0.3), CREW_BED.hips], hipUp: CREW_BED.hipUp, rest: CREW_BED.rest };
    out.push({ id: it.id, name: it.kind === 'bunk' ? 'Bunk' : 'Bed', side: it.kind, frame: { o, x: across, z: along }, mirror, bed, back: 0, lie: true });
  }
  // (the bunk first, then the bed: his words' order)
  return out.sort((a, b) => (a.side === 'bunk' ? 0 : 1) - (b.side === 'bunk' ? 0 : 1));
}
// THE LAB'S LONG BENCH (the game's maker, 2026-11-22: "They should be able to sit on the bench in the lab area too. If I
// remember right there is a long bench there."): the lab's bench along the hull (its counter on a wall, named a bench:
// kit/ships/medic-furnish.js furnishLab; a worktop at table height, 0.9 m, with its drawers, its fridge and its sink),
// sat up on along its front edge, facing out from the hull, as on the scanner's high bed (onbed.js: backed up to it, the
// hop up onto its edge, and there, perched, the feet off the floor). Its places: one each BENCH.gap along its clear
// stretch (nothing hung over it (the shelves over its aft end), clear of its sink (the column at its end away from the
// stool's knee space)). As onbed beds: the frame's origin on the deck at the wall, on the place; x out from the wall
// (the side got onto from), z along the bench; its edge its depth. -> [{ id, name, frame, mirror, bed, back, perch }]
export const BENCH = { gap: 0.5, end: 0.05, stand: 0.26 };
export function benchPerches(bp, deck) {
  return benchSeats(bp, deck).map((p) => {
    const it = (bp.items || []).find((o) => o.id === p.item), alongZ = it.rect[3] - it.rect[1] >= it.rect[2] - it.rect[0];
    const s = p.out, x = alongZ ? [s, 0, 0] : [0, 0, s], z = [x[1] * 0 - x[2], 0, x[0]];
    const o = alongZ ? [p.wall, p.y - p.perch, p.z] : [p.x, p.y - p.perch, p.wall], depth = alongZ ? it.rect[2] - it.rect[0] : it.rect[3] - it.rect[1];
    const bed = { top: p.perch, edge: depth, pad: depth / 2, z: 0, stand: [depth + BENCH.stand, 0], hipUp: CREW_BED.hipUp, rest: [depth / 2, 0] };
    return { id: p.id, name: p.name, side: 'bench', frame: { o, x, z }, mirror: false, bed, back: 0, perch: true };
  });
}
// (the bench's places, as seats on its front edge: where, its height over the deck, and the wall behind)
export function benchSeats(bp, deck) {
  const out = [], items = bp.items || [];
  for (const r of (bp.rooms || []).filter((q) => q.kind === 'lab')) {
    const it = items.find((o) => o.room === r.id && o.kind === 'counter' && /bench/i.test(o.name || '')); if (!it) continue;
    const [x0, z0, x1, z1] = it.rect, [rx0, rz0, rx1, rz1] = r.rect, alongZ = z1 - z0 >= x1 - x0, h = +it.h || 0.9;
    // (the way out from the wall it stands on)
    const out1 = alongZ ? (x0 - rx0 <= rx1 - x1 ? 1 : -1) : (z0 - rz0 <= rz1 - z1 ? 1 : -1);
    const lo = alongZ ? z0 : x0, hi = alongZ ? z1 : x1, len = hi - lo, n = Math.max(1, Math.round(len / 0.5)), cw = len / n;
    // (the stool's knee space, and the sink in the column at the far end from it: medic-furnish.js's own rule)
    const stool = items.find((o) => o.room === r.id && o.kind === 'bench'), sc = stool ? (alongZ ? (stool.rect[1] + stool.rect[3]) / 2 : (stool.rect[0] + stool.rect[2]) / 2) : null;
    const knee = sc == null ? (n >= 3 ? Math.floor(n / 2) : -1) : Math.max(0, Math.min(n - 1, Math.floor((sc - lo) / cw)));
    const sinkLow = knee >= n / 2;
    let a = lo + BENCH.end, b = hi - BENCH.end;
    if (sinkLow) a = Math.max(a, lo + cw); else b = Math.min(b, hi - cw);
    for (const o of items.filter((q) => q.room === r.id && q.kind === 'overhead')) {
      const oa = alongZ ? o.rect[1] : o.rect[0], ob = alongZ ? o.rect[3] : o.rect[2], over = alongZ ? o.rect[0] < x1 && o.rect[2] > x0 : o.rect[1] < z1 && o.rect[3] > z0;
      if (!over || ob <= a || oa >= b) continue;
      if (oa - a < b - ob) a = Math.max(a, ob); else b = Math.min(b, oa);
    }
    const k = Math.max(0, Math.floor((b - a) / BENCH.gap + 1e-6)); if (!k) continue;
    const front = alongZ ? (out1 > 0 ? x1 : x0) : (out1 > 0 ? z1 : z0), wall = alongZ ? (out1 > 0 ? x0 : x1) : (out1 > 0 ? z0 : z1), at = front - out1 * 0.13;
    const heading = alongZ ? (out1 > 0 ? Math.PI / 2 : -Math.PI / 2) : (out1 > 0 ? 0 : Math.PI);
    for (let i = 0; i < k; i++) {
      const v = a + (b - a) * (i + 0.5) / k, x = alongZ ? at : v, z = alongZ ? v : at;
      const sx = alongZ ? front + out1 * BENCH.stand : v, sz = alongZ ? v : front + out1 * BENCH.stand;
      out.push({ id: it.id + '.' + i, item: it.id, name: 'Lab bench', kind: 'sit', perch: h, out: out1, wall, room: r.id, x: +x.toFixed(3), y: +(deck + (r.floor || 0) + h).toFixed(3), z: +z.toFixed(3), heading, job: null, cockpit: false, stand: [+sx.toFixed(3), +sz.toFixed(3)] });
    }
  }
  return out;
}
// THE PLACES THE RESCUED TAKE, IN THE GAME'S MAKER'S ORDER (2026-11-22, RESC4-1 B, and the lab's bench): the med bay's
// two patient beds, the crew room's bunk and its bed, the lab's long bench, then the stools (the lab's, the crew room's),
// then a cockpit seat no job has. -> [{ kind: 'bed' (lain on, onbed's moves) | 'perch' (sat up on, onbed's hop) | 'seat',
// place }]
export function restOrder(bp, deck, places) {
  return [...patientBeds(bp, deck).map((p) => ({ kind: 'bed', place: p })), ...crewBeds(bp, deck).map((p) => ({ kind: 'bed', place: p })),
    ...benchPerches(bp, deck).map((p) => ({ kind: 'perch', place: p })), ...seatsFor(places).map((p) => ({ kind: 'seat', place: p }))];
}
// THE NEXT ONE'S PLACE: the first of the order not taken (taken: a Set of place ids, the rescued's own and any the crew
// aboard are in). (Given beds and seats apart, as before: a patient bed while one is free, else a seat)
export function choose(order, taken, seats = null) {
  const list = seats ? [...order.map((p) => ({ kind: 'bed', place: p })), ...seats.map((p) => ({ kind: 'seat', place: p }))] : order;
  return list.find((c) => !taken.has(c.place.id)) || null;
}
// HER PARAMEDIC'S NEXT POD (the pods left to the captain's crew: src/rescued.js walks one of them from pod to pod): the
// nearest one still shut to where they stand (pods: [{ x, z, open }], from: { x, z }) -> its index, or -1 (every pod open:
// back aboard). So they go down the row as it lies, never back and forth across it
export function nextShut(pods, from) {
  let best = -1, bd = Infinity;
  pods.forEach((p, i) => { if (p.open) return; const d = Math.hypot(p.x - from.x, p.z - from.z); if (d < bd) { bd = d; best = i; } });
  return best;
}
// LYING ON A PATIENT BED: its stretcher's back section is raised (PATIENT.back), so the lean back stops that far short of
// flat, the back on it (onbed's own moves lie flat, as on the scanner's bed)
// (and `prop` more, where a pillow props the head and shoulders: PATIENT.prop)
export const leanOn = (lean, back = PATIENT.back, prop = 0) => Math.min(lean, Math.PI / 2 - back - prop);
