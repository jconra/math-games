// A SAMPLE COCKPIT, put together from the cockpit parts with placeInto, to show they fit a person: the seats' height,
// the reach to the sticks, throttles and panels, the view over the dashboard to the windscreen. The ships (step 2)
// can build theirs the same way, or call cockpitSet with their own sizes.
// Its frame is a ship's: the nose toward +z, the deck at y = 0, the seats' middles on z = 0. With the frame's origin on
// a 0.5 m cell's middle (as the grids count cells), every seat stands on a cell's middle and its base fills that cell.
// Port is the left as you face the nose: +x. The pilot sits on the left (as in an airliner), the stick in the left hand
// on the outboard armrest, the throttles in the right; the co-pilot's is the same seat, its stick on the right.
//   cockpitSet(p, o)   o: seats (2: pilot and co-pilot on x = 0.5, -0.5, the throttle pedestal between them, the
//                      engineer behind on the port side facing aft to an engineer's station, as on Medic A |
//                      3: three abreast on x = 1, 0, -1, the engineer in the middle, as on Explorer C),
//                      gap (seat middles to the dashboard's near edge, 0.5), slide (how far the fliers' seats are slid
//                      forward to fly, 0.1), ceil (the room's ceiling, 2.5), canopy ({ y: the windscreen's foot above
//                      the deck, 1.2; z: how far ahead of the seats, 1.6; slope: radians from level, 0.79 }),
//                      look ('tan'), seat (more options for the fliers' seats), dash, overhead, side (more options for
//                      those parts), wallX (the side walls, where the side consoles stand: 1.25 for two, 1.75 for
//                      three), guides (true in the lab: a seated person in the pilot's seat, one standing behind, the
//                      windscreen's line in yellow and the ceiling's edges; false for a ship)
//   cockpitPlan(o)     what cockpitSet places, without drawing: { items: [{ name, build, opts, at, rot, scale }], pose,
//                      eye, shoulders, reach: [{ name, at, zone }], glass, ceil } (the checks read it)
import { part, placeInto } from '../place.js';
import { local, bar, glowBox, LIT } from './look.js';
import { flightSeat, crewSeat, seatPoints } from './seats.js';
import { flightStick, throttle, pedals, GRIP } from './controls.js';
import { overheadPanel, sidePanel, faceOf } from './panels.js';
import { dashboard, engineerStation, dashFace } from './consoles.js';
import { cockpitLocker, handhold } from './fittings.js';
import { seatedPose, seatedPerson, standingPerson } from './guide.js';

const PI = Math.PI;
export const BUILDS = { flightSeat, crewSeat, flightStick, throttle, pedals, overheadPanel, sidePanel, dashboard, engineerStation, cockpitLocker, handhold, seatedPerson, standingPerson };

export function cockpitPlan(o = {}) {
  const three = o.seats === 3, gap = o.gap ?? 0.5, slide = o.slide ?? 0.1, ceil = o.ceil ?? 2.5, look = o.look || 'tan';
  const canopy = { y: 1.2, z: 1.6, slope: PI / 4, ...(o.canopy || {}) };
  const xs = three ? [1, 0, -1] : [0.5, -0.5], items = [], reach = [];   // (the pilot first, on the left: +x)
  const add = (name, build, opts, at, rot = [0, 0, 0], scale = 1) => { items.push({ name, build, opts, at, rot, scale }); return items[items.length - 1]; };
  // the seats: the pilot's on the port side (its stick outboard, on the left armrest), the co-pilot's the same seat
  // mirrored; with three, each flier has a one-lever throttle on the inboard (right) armrest and the engineer sits between
  const flier = { look, slide, stick: 'left', throttle: three ? 'right' : null, ...(o.seat || {}) };
  const seatAt = (x) => [x, 0, 0];
  add('pilot', 'flightSeat', { ...flier, badge: 'pilot' }, seatAt(xs[0]));
  add('co-pilot', 'flightSeat', { ...flier, stick: 'right', throttle: three ? 'left' : null, badge: 'co-pilot' }, seatAt(xs[xs.length - 1]));   // (its own, not a mirror, so its badge reads)
  if (three) add('engineer', 'flightSeat', { look, slide, badge: 'engineer' }, seatAt(0));
  // the dashboard across the front, turned to face the seats; pedals under it before each flier
  const dashO = { seats: three ? 3 : 2, seatsAt: xs.map((x) => -x), depth: canopy.z - gap - 0.005, deckY: canopy.y - 0.01, ...(o.dash || {}) };   // (its top deck runs on to the windscreen's foot)
  add('dashboard', 'dashboard', dashO, [0, 0, gap], [0, PI, 0]);
  for (const [i, x] of [[0, xs[0]], [1, xs[xs.length - 1]]]) add('pedals' + i, 'pedals', {}, [x, 0, gap + 0.2], [0, PI, 0]);
  // between two seats, the throttle pedestal (its quadrant at the seats' end); over them, the overhead panel, behind the
  // windscreen's top; along each side, a side console
  if (!three) add('throttle', 'throttle', { mount: 'pedestal', levers: 2, d: gap - 0.05 }, [0, 0, gap / 2], [0, PI, 0]);
  const ovO = { ceil, ...(o.overhead || {}) }, ovD = ovO.d ?? 0.75, glassTopZ = canopy.z - (ceil - canopy.y) / Math.tan(canopy.slope);
  const ovZ = Math.min(-0.05, glassTopZ - ovD / 2 - 0.02);
  if (three) for (const s of [1, -1]) add(s > 0 ? 'overhead' : 'overhead starboard', 'overheadPanel', ovO, [s * 0.5, 0, ovZ], [0, PI, 0]);   // (one over each gap between the seats)
  else add('overhead', 'overheadPanel', ovO, [0, 0, ovZ], [0, PI, 0]);
  const sideO = { len: 1.0, ...(o.side || {}) }, wallX = o.wallX ?? (three ? 1.75 : 1.25), dashEndZ = gap - (dashO.bow ?? 0.17) - 0.03;   // (the dash's ends, less its lip)
  // (each with a screen pod at its forward end; the starboard one is the port one mirrored)
  for (const s of [1, -1]) add(s > 0 ? 'side port' : 'side starboard', 'sidePanel', { pod: true, ...sideO }, [s * wallX, 0, dashEndZ - sideO.len / 2 - 0.03], [0, -s * PI / 2, 0], s > 0 ? 1 : [-1, 1, 1]);
  // behind (two seats): the engineer's seat facing aft to the engineer's station on the aft wall, on the port side
  if (!three) { add('engineer', 'crewSeat', { look, badge: 'engineer' }, [0.5, 0, -1.0], [0, PI, 0]); add('engineer station', 'engineerStation', { w: 1.0 }, [0.5, 0, -2.0]); }
  // a locker and handholds on the walls
  add('locker', 'cockpitLocker', {}, [-wallX, 0, three ? -1.25 : -1.0], [0, PI / 2, 0]);   // (on the starboard wall)
  for (const s of [1, -1]) add('handhold ' + (s > 0 ? 'port' : 'starboard'), 'handhold', { len: 0.4, y: 1.4 }, [s * wallX, 0, dashEndZ - 0.55], [0, -s * PI / 2, 0]);

  // the pilot's reach: where the hands go and the panels are, measured through the same placements
  const pilot = items[0], P = seatPoints({ ...flier });
  const inPilot = (q) => local(pilot.at, pilot.rot, ...q);
  const grip = inPilot(local(P.arm.left, [0, 0, 0], ...GRIP.stick({ mount: 'arm' })));
  reach.push({ name: 'stick grip', at: grip, zone: 'easy' });
  if (three) reach.push({ name: 'arm throttle', at: inPilot(local(P.arm.right, [0, 0, 0], ...GRIP.throttle({ mount: 'arm' }))), zone: 'easy' });
  else { const t = items.find((i) => i.name === 'throttle'); reach.push({ name: 'throttle levers', at: local(t.at, t.rot, ...GRIP.throttle(t.opts)), zone: 'easy' }); }
  const D = dashFace(dashO), dash = items.find((i) => i.name === 'dashboard'), toSet = (q) => local(dash.at, dash.rot, ...q);
  const px = -xs[0];   // (the pilot's x in the dashboard's own frame, which is turned round)
  reach.push({ name: 'switches before the pilot', at: toSet(D.shelf(px, 0.065, 0.02).at), zone: 'easy' });
  reach.push({ name: 'screens before the pilot', at: toSet(D.screens(px - 0.13, undefined, 0.02).at), zone: 'stretch' });
  const sp = items.find((i) => i.name === 'side port'), SF = faceOf.side(sideO);
  reach.push({ name: 'side console switches', at: local(sp.at, sp.rot, -0.06, ...SF.at(0.12, 0.03).slice(1)), zone: 'easy' });
  const ov = items.find((i) => i.name === 'overhead'), OF = faceOf.overhead(ovO);
  reach.push({ name: 'overhead switches', at: local(ov.at, ov.rot, -0.12, ...OF.at(0.16, 0.03).slice(1)), zone: 'stretch' });   // (its outer switch, toward the pilot)
  // the pilot sitting: feet on the pedals, the left hand on the stick, the right on the throttle (or the armrest)
  const ped = items.find((i) => i.name === 'pedals0'), feet = [-1, 1].map((s) => local(ped.at, ped.rot, -s * 0.15, 0.11, 0.06));   // (the right foot first, at -x; the pedals are turned round)
  const toSeat = (q) => [q[0] - pilot.at[0], q[1], q[2]];
  const hands = { left: toSeat(grip), right: toSeat(reach[1].at) };
  const pose = seatedPose({ ...flier, feet: feet.map(toSeat), hands });
  for (const L of pose.limbs) { L.a = inPilot(L.a); L.b = inPilot(L.b); }
  const glass = { ...canopy, topZ: glassTopZ, halfW: wallX - 0.05 };
  return { items, pose, eye: inPilot(P.eye), shoulders: P.shoulders.map(inPilot), reach, glass, ceil, wallX, three };
}

export function cockpitSet(p, o = {}) {
  const plan = cockpitPlan(o);
  for (const it of plan.items) placeInto(p, part(BUILDS[it.build], it.opts), { at: it.at, rot: it.rot, scale: it.scale });
  if (o.guides) drawGuides(p, plan);
  return plan;
}

// the guides: the seated pilot, a person standing behind, the windscreen (glass in a plain frame) and the ceiling's edges
function drawGuides(p, plan) {
  const sp = { name: 'seated', limbs: plan.pose.limbs };
  for (const L of sp.limbs) bar(p, /head|hand|neck/.test(L.name) ? { c: '#7d95ad', r: 0.75, m: 0, w: 0 } : { c: '#5f7690', r: 0.8, m: 0, w: 0 }, L.a, L.b, L.t, { r: 0.02, seg: 1, cell: 9, loops: [] });
  placeInto(p, part(standingPerson, {}), { at: plan.three ? [-1.0, 0, -1.5] : [-0.5, 0, -1.75] });   // (behind the seats, out of the way)
  const G = plan.glass, c = Math.cos(G.slope), s = Math.sin(G.slope), len = (plan.ceil - G.y) / s, mid = [0, G.y + len * s / 2, G.z - len * c / 2];
  p.glass(G.halfW * 2, len, mid, [PI / 2 + G.slope, 0, 0]);
  const F = 0.05;
  bar(p, 'yellow', [-G.halfW, G.y, G.z], [G.halfW, G.y, G.z], [F, F]);   // (the windscreen's foot: the canopy line, in yellow)
  bar(p, 'black', [-G.halfW, plan.ceil, G.topZ], [G.halfW, plan.ceil, G.topZ], [F, F]);
  for (const x of plan.three ? [-G.halfW, -0.5, 0.5, G.halfW] : [-G.halfW, 0, G.halfW]) bar(p, 'black', [x, G.y, G.z], [x, plan.ceil, G.topZ], [F, F]);
  for (const x of [-G.halfW, G.halfW]) { bar(p, 'black', [x, plan.ceil, G.topZ], [x, plan.ceil, -2.2], [F, F]); glowBox(p, LIT.amber, [0.012, 0.012, G.topZ + 2.1], [x * 0.97, plan.ceil - 0.03, (G.topZ - 2.2) / 2], null); }
  // a dark deck plate under it all (the cockpit's floor, for the pictures)
  p.slab('dark', -G.halfW, G.halfW, -0.012, -0.002, -2.2, G.z, { r: 0, cell: 9 });
}
