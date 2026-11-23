// THE RESCUED COME ABOARD (piece 4 of the rescue run, RESCUE_PLAN.md). The game's maker, RESC1-1 A: "the rescued sit
// up, climb out, walk up the ramp themselves and take a bed or seat aboard". MED-1: "some could sit in the medic ship and
// others could lay down."
//
// SO, ONCE A POD'S LID HAS OPENED (its lock solved: src/podlock.js), whoever sleeps in it (src/sleeper.js):
//   - WAKES: their eyes open (the crew kit's lids, kit/lids.js) and they lie still a moment, awake (rescueplan.js WAKE);
//   - GETS OUT: the scanner's patient's own moves for getting off a bed (src/onbed.js MOVES_OFF: the knees drawn up, sat
//     up, the legs swung out over the pod's front, a slide off onto their feet), on the pod's own bed;
//   - WALKS to the Medic and up its ramp: a way worked out by the player's own walls (src/walls.js plan: the ground, the
//     pods, the wreck, the rocks, the ramp's treads, the cabin's doors) and walked as the crew aboard walk (src/aboardplan.js
//     walkStep: round the player and each other, waiting or squeezing past where it is narrow);
//   - TAKES THEIR PLACE, in the game's maker's order (2026-11-22, RESC4-1 B: "after the patient beds, the crew room's
//     bunk and bed, then stools"; "They should be able to sit on the bench in the lab area too"; src/rescueplan.js
//     restOrder): the Medic's two patient beds (onbed.js MOVES_ON, the scanner's patient's own way onto a high bed, then
//     lying back on the stretcher's raised back); the crew room's bunk and its bed (lain on as the crew aboard lie on
//     them: walked to, and lying there); the lab's long bench (the hop up onto its edge, and perched there); then A SEAT
//     (the lab's stool, the crew room's stools; then a cockpit seat no job has: sitting as the crew aboard sit,
//     src/aboard.js). A place someone else aboard is in is passed over.
// Their bodies are posed by the shared people code (src/moves.js: M.bed and its bedPose), never a copy of it.
//
// HER PARAMEDIC (R.paramedic; the rescue's own job left to the captain's crew: the game's maker, RESC3-1, "For the
// paramedic the questions are to open the pods"): one of the crew aboard (their own figure, lent by src/aboard.js) walks
// down the ramp to the pods and opens each in turn: walked to its front as the rescued walk (the same way worked out,
// the same steps), a moment at its lock (RESCUED.lock), its lid opens (so its sleeper wakes and comes aboard, above),
// on to the nearest pod still shut; the last one open, back up the ramp to the seat kept for them. Seen if the crew
// member is outside or looking; off screen the very same walk at the same pace.
//
// THE FLIGHT HOME, AND HOME (R.ride, R.home, R.leave, R.take): everyone stays where they settled, the same people (their
// own figures), for the whole flight home: kept when the planet is put away, posed as ever in the frame the Medic stood
// in on the ground and drawn where the ship is now by the one matrix (R.late). Down in its hangar they are posed where
// the ship stands (R.home: the station's own walls from there), and get up one after another as the ward asks (R.leave:
// off a patient bed by onbed's moves, off the bench by its hop down; up from the bunk, the bed or a seat as the crew
// aboard get up, on their feet beside it), walk through the cabin and down the ramp to its foot on the hangar's floor,
// and there are the station's (R.take: the very figure handed over; src/people.js THE WARD walks them on to the ward).
//
//   const R = makeRescued({ pods, medic, walls, scene, busy, crew })   pods: src/planet/podsdraw.js's; medic:
//                                    src/planet/medicdown.js; walls: src/planet/onfoot.js's (the planet's own); busy(id):
//                                    a place the crew aboard are in; crew(): where they stand, [{ x, y, z, walking }];
//                                    env: the cabin's own picture of itself, for their shine inside it (or none)
//   R.update(dt, { player, camera })   each frame: a lid open enough wakes its sleeper; everyone's moves go on
//   R.settle()  everyone out of the pods and in their place at once (the run's skip); her paramedic aboard again
//   R.list    [{ i (the pod), name, phase, pos, heading, place }]   R.others: the people to walk round, for the player
//   R.placed  how many are in their place; R.out: how many awake are still outside the cabin
//   R.eyes()  where the awake ones' feet are (the cabin's doors open for them)
//   R.paramedic(fig, { open })   fig: src/aboard.js A.lend's { c, name, pos, heading (the world's, out here), home (the
//                                    seat kept for them, the ship's own frame), back() }; open(i): a pod's lid opened
//                                    -> { done, phase, pod } (done: aboard again), or null (no figure: nobody walks)
//   R.ride({ scene, order })     for the flight home: -> R itself, the planet's pods and Medic let go; order: the pods
//                                    in the order their sleepers took their places (R.list is then in that order)
//   R.late(M)                    while riding: drawn where the ship is now (M: its kit frame in the world)
//   R.home({ M, walls, foot, inside, open, crew })   down in the hangar: M the ship's frame where it stands, the
//                                    station's walls, foot: where its ramp comes down nearest the ward (a Vector3, or
//                                    null: nobody walks out), inside(p), open(): a way out is down
//   R.leave(i), R.take(i) -> { c, moves, pos, heading, setFar } | null, R.riders -> [{ i, look, position, state: 'in' |
//                                    'leaving' | 'out', pos }], R.leaving() -> the feet of those on their way out
//   R.state() (for the rigs)   R.dispose()
import * as THREE from 'three';
import { pose as onBed, SECS } from './onbed.js';
import { bedPose } from './moves.js';
import { walkStep, WALK, CLIP } from './aboardplan.js';
import { BODY } from './walls.js';
import { STAND } from './player.js';
import { OUT, ON, WAKE, POD_OUT, choose, restOrder, bedToShip, leanOn, bedFor, nextShut } from './rescueplan.js';
import { peopleLight } from './planet/inside.js';

// how far from the camera someone is drawn with the crew kit's far copy (m: src/planet/podsdraw.js PODS_DRAW.far); how
// long the way may be worked out each frame (ms), how long before a way not found is asked again (s), and how many tries
// before they are simply put in their place (an alarm, counted); how long the first move out of the pod is eased from
// the pose they slept in (s); and how long held up on the spot, walking, before the same (s: a loud alarm, never quietly);
// her paramedic at a pod: how long at its lock (s), and where they stand to work it, in the pod's own frame (m: toward
// its foot end from its middle, and out from its middle line past its front, clear of where its sleeper climbs out)
export const RESCUED = { far: 7, planMs: 3, retry: 1.2, tries: 4, blend: 0.9, stall: 8, lock: 2.4, at: [-0.85, 1.2] };
const ease = (t) => t * t * (3 - 2 * t);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const _e = new THREE.Euler(), _gi = new THREE.Matrix4(), _eye = new THREE.Vector3();
const SETTLED = ['lying', 'perched', 'sit', 'standing'];

// a pose of onbed's, blended toward another (each point and way, and each number, k of the way)
function blend(a, b, k) {
  const lerp = (p, q) => (Array.isArray(p) ? p.map((v, i) => v + (q[i] - v) * k) : p + (q - p) * k);
  const out = { ...b };
  for (const key of ['hips', 'pole', 'look']) if (a[key] && b[key]) out[key] = lerp(a[key], b[key]);
  for (const key of ['feet', 'hands', 'fingers', 'elbows']) if (a[key] && b[key]) out[key] = a[key].map((p, i) => lerp(p, b[key][i]));
  for (const key of ['lean', 'legs', 'flat', 'arms', 'chin', 'point', 'pitch', 'roll', 'curl']) out[key] = lerp(a[key] || 0, b[key] || 0);
  out.heading = a.heading + wrap(b.heading - a.heading) * k;
  return out;
}

export function makeRescued({ pods: pods0, medic, walls: walls0, scene, busy = () => false, crew: crew0 = () => [], env = null }) {
  // (the places, in the game's maker's order: the patient beds, the crew room's bunk and bed, the lab's bench, the stools;
  // busy(id): a place someone else aboard is in (the crew aboard, src/aboard.js), passed over; crew(): where the crew
  // aboard stand just now, in the world, walked round as the rescued walk round each other)
  const list = [], taken = new Set(), order = medic ? medic.order || restOrder(medic.bp, medic.space.deck, medic.places) : [];
  const alarms = { putThere: 0, stalled: 0 };
  let pods = pods0, walls = walls0, crew = crew0, group = scene, T = null;
  // THE SHIP THEY ARE POSED IN: its own frame in the world (x to port, y up from its ground line, z to the nose), its
  // nose's turn, its way in (just past its ramp's foot), what is inside it. The Medic set down on the planet; for the
  // flight home that frame kept (ride); home, the ship where it stands in its hangar (home)
  let ship = { M: medic.M, yaw: () => medic.stand.yaw, foot: () => medic.foot, inside: (p) => medic.inside(p) };
  const deck = medic.space.deck, inv = new THREE.Matrix4();
  let riding = false, atHome = false, wayOpen = () => true;
  // (inside the Medic everyone is lit as its cabin is, not by the planet's sun through its hull: src/planet/inside.js;
  // each sleeper's materials made ready now, unseen, while they are still in their pod)
  const lightOf = (S) => S.light || (S.light = peopleLight(S.c, env || medic.env || null));
  if (pods) for (const p of pods.pods) if (p.sleeper) lightOf(p.sleeper);
  // (a point of the ship's own frame, and a heading, in the world)
  const shipPoint = (p) => new THREE.Vector3(...p).applyMatrix4(ship.M), shipHeading = (h) => h + ship.yaw();
  // a patient bed's own frame in the world (onbed's frame, a turn and a move; its other side by `mirror`, bedPose)
  const bedFrame = (B) => {
    const F = B.frame, x = new THREE.Vector3(...F.x), z = new THREE.Vector3(...F.z), y = new THREE.Vector3(0, 1, 0);
    return new THREE.Matrix4().makeBasis(x, y, z).setPosition(...F.o).premultiply(ship.M);
  };

  // ── woken: out of the pod's frame and into the world, from the very pose they sleep in ─────────────────────────
  function wake(i, p) {
    const S = p.sleeper, c = S.c, M = S.moves, F = p.bed;
    // (the pod's bed in the world, as the pod is placed on the ground (without the curve its drawing has): the pod's
    // place, its body's level turn and drop, and the bed's frame in the body (kit/stasispod-plan.js bedFrame toPod))
    p.body.updateMatrix();
    const o = F.toPod(0, 0, 0), b2p = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).setPosition(o[0], o[1], o[2]);
    const frame = p.place.clone().multiply(p.body.matrix).multiply(b2p), toBed = b2p.clone().invert();
    // (the sleeper's pose, back in the bed's own frame: their hips where they really lie (the sleeper was slid along the
    // bed after the pose was laid), the rest moved with them)
    const D = M.bed, ul = c.bones.UpperLegL, ur = c.bones.UpperLegR;
    c.root.updateMatrixWorld(true);
    const hipsW = ul && ur ? ul.getWorldPosition(new THREE.Vector3()).add(ur.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5) : null;
    const hipsBody = hipsW ? p.body.worldToLocal(hipsW.clone()) : D.hips.clone(), shift = hipsBody.clone().sub(D.hips);
    const rq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(toBed));
    const P = (v) => v.clone().add(shift).applyMatrix4(toBed).toArray(), Wd = (v) => v.clone().applyQuaternion(rq).toArray();
    const ahead = Wd(D.ahead);
    const rest = { hips: P(D.hips), feet: D.feet.map(P), pole: Wd(D.pole), hands: D.hands.map(P), fingers: D.fingers.map(Wd), elbows: D.elbows.map(Wd), heading: Math.atan2(ahead[0], ahead[2]),
      lean: S.lean ?? Math.PI / 2, legs: D.legs, flat: D.flat, arms: D.arms, chin: D.chin, point: D.point, pitch: D.pitch, roll: D.roll, curl: D.curl, clip: 'stand' };
    // (out of the pod and into the world; the pod's drawing no longer shows or hides them)
    p.sleeper = null;
    c.root.removeFromParent(); group.add(c.root); c.root.visible = true; S.setFar(false);
    c.setEyes('blink');
    // (the pod's bed, as they get out of it: its front rim stands over its pad and out past it, POD_OUT)
    const bed = { ...F.bed, stand: [F.bed.edge + POD_OUT.stand, F.bed.z], rim: POD_OUT.rim };
    const R = { i, name: `Sleeper ${i + 1}`, S, c, M, light: lightOf(S), frame, bed, rest, phase: 'wake', t: 0, D: null, pos: new THREE.Vector3(), heading: 0, drawnY: 0, walking: false, clip: '', want: null, plan: null, tries: 0, wait: 0 };
    list.push(R);
    lay(R, rest, R.frame);
  }
  const play = (R, n, fade = 0.35, speed = 1) => { if (R.clip !== n) { R.c.play(n, { fade, speed }); R.clip = n; } else R.c.play(n, { speed }); };
  // a bed pose laid on (onbed's frame, stood in the world by `frame`), the root placed by it
  function lay(R, p, frame, mirror = false) {
    R.D = bedPose(R.M, p, frame, { mirror, D: R.D });
    R.M.bed = R.D;
    R.c.root.position.copy(R.D.root); R.c.root.quaternion.copy(R.D.q);
    R.pos.set(R.D.hips.x, R.D.hips.y - R.M.body.hs, R.D.hips.z); R.heading = R.D.heading;
    play(R, p.clip === 'sit' ? CLIP.sit : STAND, 0.45);
  }
  // standing on their feet (no bed pose): the root at the feet, turned their way
  function stand(R) {
    if (R.M) R.M.bed = null;
    R.c.root.position.set(R.pos.x, R.drawnY, R.pos.z); R.c.root.quaternion.setFromEuler(_e.set(0, R.heading + (R.side || 0), 0));
  }

  // ── on to their place: the first free one of the order (a bed while one is free, then the bench, then a seat) ──
  // (their place, picked now: the next free one; the bed's frame in the world, and the way they face, back to it)
  function pick(R) {
    if (R.place) return R.place;
    const ch = choose(order, new Set([...taken, ...order.map((c) => c.place.id).filter((id) => busy(id))]));
    if (!ch) return null;
    taken.add(ch.place.id); R.place = ch;
    frames(R);
    return ch;
  }
  // (where their place is in the world, as the ship stands now: a bed's frame, where one stands at its side and the way
  // one faces there, its own numbers for this person (a patient bed: their hips where their head comes onto its pillow,
  // rescueplan.js bedFor); a seat, where one stands by it, and sat on it)
  function frames(R) {
    const ch = R.place; if (!ch) return;
    if (ch.kind === 'bed' || ch.kind === 'perch') {
      const B = ch.place; R.own = bedFor(B, R.M.body);
      R.target = { kind: 'bed', lie: !!B.lie, perch: ch.kind === 'perch' }; R.bedWorld = bedFrame(B); R.goal = shipPoint(bedToShip(B, [R.own.stand[0], 0, R.own.stand[1]]));
      const o = bedToShip(B, [1, 0, 0]), z0 = bedToShip(B, [0, 0, 0]); R.out = Math.atan2(o[0] - z0[0], o[2] - z0[2]) + ship.yaw();
    } else {
      const p = ch.place; R.goal = shipPoint([p.stand[0], p.y, p.stand[1]]); R.seat = shipPoint([p.x, p.y, p.z]); R.target = { kind: 'sit' }; R.seatHeading = shipHeading(p.heading);
    }
  }
  function setOff(R) {
    const ch = pick(R);
    R.phase = 'walk'; R.t = 0;
    if (!ch) { R.target = null; R.goal = shipPoint([0, deck, 0.25]); }
    setWay(R, R.goal, R.target && R.target.kind === 'sit' ? R.seat : null);
  }

  // ── A WAY, WORKED OUT AND WALKED (the rescued to their places, her paramedic to the pods and back, everyone out
  // again at home): in two legs when it crosses the ramp (to the ramp's foot over the ground, then up it and through
  // the cabin, or the other way round: a way from far off into the cabin's narrow rooms, worked out at once on the
  // cabin's fine grid, ran out of steps); `seat`: a last step onto a seat ──
  function setWay(R, goal, seat = null) {
    Object.assign(R, { walking: true, leg: 0, wait: 0, side: 0, sideAim: 0, way: null, stopI: 0, wayAll: [], tries: 0, stall: 0, wayGoal: goal, waySeat: seat, retry: 0 });
    const f0 = ship.foot(), stops = [goal];
    if (f0 && ship.inside(R.pos) !== ship.inside(goal) && Math.hypot(f0.x - goal.x, f0.z - goal.z) > 0.5) { const foot = f0.clone(); foot.y = walls.floorAt(foot.x, foot.z, foot.y + 3, 6) ?? foot.y; stops.unshift(foot); }
    R.stops = stops;
    planNext(R);
    play(R, STAND, 0.3);
  }
  function planNext(R) { const from = R.wayAll.length ? R.wayAll[R.wayAll.length - 1] : R.pos; R.plan = walls.plan(from.clone(), R.stops[R.stopI].clone()); }
  // (everyone on their feet out here or aboard, as someone walking meets them: the rescued standing or walking (someone
  // sitting or lying is in their seat or bed, beside the way through, as the crew aboard have it; the crew room's stools
  // are 0.5 m apart, nearer than two bodies are ever let come), her paramedic, and the crew aboard standing or walking)
  const afoot = (Q) => (Q.para ? Q.phase !== 'done' : ['walk', 'back', 'standing', 'leave', 'out'].includes(Q.phase));
  const rank = (Q) => (Q.para ? -1 : list.indexOf(Q));
  function othersFor(R, crewNow) {
    const all = T ? [T, ...list] : list;
    const others = all.filter((Q) => Q !== R && afoot(Q)).map((Q) => ({ x: Q.pos.x, z: Q.pos.z, walking: !!Q.walking && !!Q.way, heading: Q.heading, held: Q.wait > 0.3, first: rank(Q) < rank(R) }));
    for (const q of crewNow) if (Math.abs(q.y - R.pos.y) < 1.2) others.push({ x: q.x, z: q.z, walking: !!q.walking, heading: q.heading || 0, held: false, first: true });
    return others;
  }
  // one frame of it -> 'there' (the way's end reached), 'put' (no way found in RESCUED.tries tries, or held up on the
  // spot RESCUED.stall s: a loud alarm, counted; whoever asked puts them where they were going), or null (on the way)
  function walkOn(R, dt, pl, crewNow) {
    // the way worked out a little at a time, then walked as the crew aboard walk
    if (R.plan && !R.plan.done) { R.plan.step(RESCUED.planMs); play(R, STAND); }
    else if (R.plan && R.plan.done && !R.way) {
      const w = R.plan.way;
      if (!w || w.short > 0.6) { R.tries++; R.plan = null; R.retry = RESCUED.retry; if (R.tries >= RESCUED.tries) { alarms.putThere++; console.warn('rescued: ' + R.name + ' found no way, put where they were going'); return 'put'; } }
      else {
        R.wayAll.push(...(R.wayAll.length ? w.slice(1) : w).map((v) => v.clone())); R.stopI++;
        if (R.stopI < R.stops.length) planNext(R);
        else { R.way = [...R.wayAll, ...(R.waySeat ? [R.waySeat.clone()] : [])]; R.leg = 0; R.getUp = false; }
      }
    } else if (!R.plan && !R.way) { R.retry -= dt; play(R, STAND); if (R.retry <= 0) planNext(R); }
    if (!R.way) { stand(R); return null; }
    const free = (x, z) => { const f = walls.floorAt(x, z, R.pos.y + BODY.stepUp, BODY.stepUp + BODY.stepDown); return f !== null && walls.free(x, f, z, undefined, true); };
    const wall = walls.radius ? walls.radius(R.pos.x, R.pos.y, R.pos.z) : 0.15;
    const x0 = R.pos.x, z0 = R.pos.z, r = walkStep(R, dt, pl, { others: othersFor(R, crewNow), free, wall });
    // (held up on the spot this long, walking (not waiting for the player): a loud alarm, and put in their place)
    R.stall = Math.hypot(R.pos.x - x0, R.pos.z - z0) > 0.004 || r === 'wait' || r === 'back' ? 0 : (R.stall || 0) + dt;
    if (R.stall > RESCUED.stall) { alarms.stalled++; console.warn('rescued: ' + R.name + ' held up on the way, put where they were going'); return 'put'; }
    if (r === 'wait' || r === 'back') { R.wait += dt; play(R, STAND); }
    else {
      if (r === 'aside') R.wait += dt; else R.wait = 0;
      if (Math.abs(R.side || 0) > 0.8) play(R, R.side > 0 ? CLIP.side[1] : CLIP.side[0], 0.2, CLIP.sideSpeed);
      else play(R, CLIP.walk, 0.3, Math.max(0.6, Math.min(1.4, WALK.speed / (R.c.stride && R.c.stride.Walk ? R.c.stride.Walk : 1))));
    }
    // (on the ground, the ramp's treads, the deck: the floor under them as the walls have it)
    const f = walls.floorAt(R.pos.x, R.pos.z, R.pos.y + BODY.stepUp, BODY.stepUp + BODY.stepDown); if (f !== null) R.pos.y = f;
    R.drawnY = Math.abs(R.pos.y - R.drawnY) > 0.6 ? R.pos.y : damp(R.drawnY, R.pos.y, 18, dt);
    stand(R);
    return r === 'there' ? 'there' : null;
  }
  const stopWay = (R) => { R.way = null; R.plan = null; R.walking = false; };

  // ── HER PARAMEDIC (the top of this file): one of the crew aboard, their own figure ─────────────────────────────
  // (where they stand to work a pod's lock: at its front, toward its foot end, on the ground a person can stand on)
  function lockSpot(i) {
    const p = pods.pods[i], at = new THREE.Vector3(RESCUED.at[0], 0, RESCUED.at[1]).applyMatrix4(p.place), mid = new THREE.Vector3().setFromMatrixPosition(p.place);
    const y = walls.floorAt(at.x, at.z, mid.y + 3, 6) ?? mid.y, s = walls.snap ? walls.snap(at.x, y + 0.4, at.z, 1.2) : null;
    return { at: s ? new THREE.Vector3(s.x, s.y, s.z) : at.setY(y), mid };
  }
  const shut = (i) => { const p = pods && pods.pods[i]; return !!p && (p.want ?? pods.want) !== 1; };
  // (on to the nearest pod still shut; none: back aboard, to the seat kept for them)
  function nextPod() {
    const best = pods ? nextShut(pods.pods.map((p, i) => ({ x: p.place.elements[12], z: p.place.elements[14], open: !shut(i) })), T.pos) : -1;
    T.t = 0; T.target = null;
    if (best >= 0) { T.pod = best; T.spot = lockSpot(best); T.phase = 'walk'; setWay(T, T.spot.at); return; }
    const h = T.fig.home; T.pod = null; T.phase = 'home';
    if (!h) { T.goal = shipPoint([0, deck, 0.25]); setWay(T, T.goal); return; }
    T.goal = shipPoint([h.stand[0], deck, h.stand[1]]);
    // (a seat on the cabin's own deck is stepped onto, as the rescued step onto theirs; one up on the flight deck is
    // sat on from where one stands by it)
    T.seat = h.kind === 'sit' && Math.abs(h.y - deck) < 0.2 ? shipPoint([h.x, h.y, h.z]) : null; T.target = T.seat ? { kind: 'sit' } : null;
    setWay(T, T.goal, T.seat);
  }
  function aboardAgain() {
    if (!T || T.phase === 'done') return;
    stopWay(T); T.phase = 'done'; T.c.lookAt(null); if (T.fig.light) T.fig.light.set(1);
    if (T.fig.back) T.fig.back();
  }
  function paramedic(fig, { open = () => {} } = {}) {
    if (T) return T.handle;
    if (!fig || !fig.c || !pods) return null;
    T = { para: true, name: fig.name || 'The paramedic', c: fig.c, M: null, fig, open, pos: fig.pos.clone(), heading: fig.heading || 0, drawnY: fig.pos.y, clip: '', phase: 'walk', t: 0, pod: null, walking: false, tries: 0, wait: 0 };
    T.handle = { get done() { return T.phase === 'done'; }, get phase() { return T.phase; }, get pod() { return T.pod; }, get pos() { return T.pos; } };
    stand(T); play(T, STAND, 0.3);
    nextPod();
    return T.handle;
  }
  function stepParamedic(dt, pl, crewNow) {
    T.t += dt;
    if (T.phase === 'walk') {
      // (opened meanwhile by someone else (the skip): on to the next)
      if (!shut(T.pod)) { nextPod(); return; }
      const r = walkOn(T, dt, pl, crewNow);
      if (r === 'put') { T.pos.copy(T.spot.at); T.drawnY = T.pos.y; }
      if (r) { stopWay(T); T.phase = 'lock'; T.t = 0; T.fromH = T.heading; }
    } else if (T.phase === 'lock') {
      // AT ITS LOCK: turned to the pod, looking down at it, a moment; then its lid opens
      const want = Math.atan2(T.spot.mid.x - T.pos.x, T.spot.mid.z - T.pos.z);
      T.heading = T.fromH + wrap(want - T.fromH) * ease(Math.min(1, T.t / 0.5));
      T.drawnY = damp(T.drawnY, T.pos.y, 18, dt); stand(T); play(T, STAND);
      T.c.lookAt(_eye.copy(T.spot.mid).setY(T.spot.mid.y + 0.6));
      if (T.t >= RESCUED.lock) { T.c.lookAt(null); T.open(T.pod); nextPod(); }
    } else if (T.phase === 'home') {
      const r = walkOn(T, dt, pl, crewNow);
      if (r) aboardAgain();
    }
    if (T.fig.light) T.fig.light.to(T.phase === 'done' || ship.inside(T.pos) ? 1 : 0, dt);
    if (T.phase !== 'done') T.c.update(dt);
  }

  // ── each frame ──────────────────────────────────────────────────────────────────────────────────────────────────
  let clock = 0, settling = false;
  // ALL AT ONCE (the run's skip, K): every pod's sleeper out of it and in their place at once, lying, perched or sitting
  // (a sleeper not in their pod yet is put in their place as soon as they are: settling); her paramedic aboard again
  function settle() {
    settling = true;
    aboardAgain();
    if (pods && medic) pods.pods.forEach((p, i) => { if (p.sleeper && !list.some((R) => R.i === i)) wake(i, p); });
    for (const R of list) {
      if (SETTLED.includes(R.phase)) continue;
      stopWay(R); R.t = 0;
      if (!pick(R)) { R.goal = shipPoint([0, deck, 0.25]); R.pos.copy(R.goal); R.drawnY = R.pos.y; R.phase = 'standing'; stand(R); play(R, STAND, 0); continue; }
      if (R.target.kind === 'sit') { R.pos.copy(R.seat); R.drawnY = R.seat.y; R.heading = R.seatHeading; R.side = 0; R.phase = 'sit'; stand(R); play(R, CLIP.sit, 0); }
      else { R.pos.copy(R.goal); R.drawnY = R.pos.y; R.phase = R.target.perch ? 'perched' : 'lying'; }
    }
  }
  // (on their feet beside a bed they have got off: where the hips are, on the floor)
  function onFeet(R) {
    R.pos.set(R.D.hips.x, 0, R.D.hips.z); const f = walls.floorAt(R.pos.x, R.pos.z, R.D.hips.y, 1.5); R.pos.y = f ?? (R.D.root.y); R.drawnY = R.D.root.y;
    R.heading = R.D.heading; stand(R);
  }
  function update(dt, { player = null, camera = null } = {}) {
    clock += dt;
    // (riding: posed where the Medic stood on the ground, as ever (the legs' and hands' places are worked out in the
    // world, src/moves.js M.bed, so nothing may stand between them and the world meanwhile); drawn where the ship is, late)
    if (riding) { group.matrix.identity(); group.updateMatrixWorld(true); }
    // (a lid open far enough: its sleeper wakes)
    if (pods && medic) pods.pods.forEach((p, i) => { if (p.sleeper && (p.want ?? pods.want) === 1 && p.k >= WAKE.lid && !list.some((R) => R.i === i)) wake(i, p); });
    if (settling && !riding && !atHome && list.some((R) => !SETTLED.includes(R.phase))) settle();
    // (and whoever else is about them: home, the station's people by the ramp's foot, api.around)
    const pl = player ? { x: player.pos.x, z: player.pos.z } : null, crewNow = list.length || T ? [...(crew() || []), ...(api.around ? api.around() : [])] : [];
    if (T && T.phase !== 'done') stepParamedic(dt, pl, crewNow);
    // (near or far as the eye is from them; riding, the eye brought back into the frame they are posed in)
    const eye = camera ? (riding ? _eye.copy(camera.position).applyMatrix4(_gi.copy(drawn).invert()) : camera.position) : null;
    for (const R of [...list]) {
      R.t += dt;
      if (R.phase === 'wake') { lay(R, R.rest, R.frame); if (R.t >= WAKE.still) { R.phase = OUT[0]; R.t = 0; } }
      else if (OUT.includes(R.phase)) {
        // GETTING OUT: onbed's moves off a bed, on the pod's; the first blended from the very pose they slept in
        let p = onBed(R.phase, R.t, R.bed, R.M.body);
        if (R.phase === OUT[0]) p = blend(R.rest, p, ease(Math.min(1, R.t / RESCUED.blend)));
        lay(R, p, R.frame);
        if (p.done) {
          const k = OUT.indexOf(R.phase);
          if (k < OUT.length - 1) { R.phase = OUT[k + 1]; R.t = 0; }
          // on their feet beside the pod; then off to the Medic
          else { onFeet(R); setOff(R); }
        }
      } else if (R.phase === 'walk') {
        const r = walkOn(R, dt, pl, crewNow);
        if (r) arrive(R, r === 'put');
      } else if (R.phase === 'back') {
        // at the bed's side: turned round where they stand, their back to it (as the scanner's patient: standing)
        const k = ease(Math.min(1, R.t / SECS.back));
        R.pos.lerpVectors(R.from, R.goal, k); R.drawnY = damp(R.drawnY, R.pos.y, 18, dt); R.heading = R.fromH + wrap(R.out - R.fromH) * k;
        stand(R); play(R, STAND);
        if (R.t >= SECS.back) { R.phase = ON[1]; R.t = 0; }
      } else if (ON.includes(R.phase)) {
        // ONTO THE BED: onbed's moves, and lying back on its stretcher's raised back; ONTO THE BENCH: the hop alone, and
        // there, perched on its edge
        const p = onBed(R.phase, R.t, R.own, R.M.body);
        if (R.phase === 'down' || R.phase === 'stretch') p.lean = leanOn(p.lean, R.place.place.back, R.place.place.prop);
        lay(R, p, R.bedWorld, R.place.place.mirror);
        if (p.done) { const k = ON.indexOf(R.phase); if (R.target.perch) { R.phase = 'perched'; R.t = 0; } else if (k < ON.length - 1) { R.phase = ON[k + 1]; R.t = 0; } else { R.phase = 'lying'; R.t = 0; } }
      } else if (R.phase === 'lying') {
        const p = onBed('lying', 0, R.own, R.M.body); p.lean = leanOn(p.lean, R.place.place.back, R.place.place.prop);
        lay(R, p, R.bedWorld, R.place.place.mirror);
      } else if (R.phase === 'perched') {
        lay(R, onBed(ON[1], SECS[ON[1]], R.own, R.M.body), R.bedWorld, R.place.place.mirror);
      } else if (R.phase === 'sit') { stand(R); }
      else if (R.phase.startsWith('off:')) {
        // HOME, OFF THEIR BED: onbed's moves off it (the back coming up from the stretcher's raised back); off the bench,
        // its hop down alone
        const m = R.phase.slice(4), p = onBed(m, R.t, R.own, R.M.body);
        if (m === 'bend' || m === 'up') p.lean = leanOn(p.lean, R.place.place.back, R.place.place.prop);
        lay(R, p, R.bedWorld, R.place.place.mirror);
        if (p.done) { const k = OUT.indexOf(m); if (!R.target.perch && k < OUT.length - 1) { R.phase = 'off:' + OUT[k + 1]; R.t = 0; } else { onFeet(R); R.phase = 'leave'; R.t = 0; } }
      } else if (R.phase === 'leave') {
        // ON THEIR FEET, OUT: once a way out is down, through the cabin and down the ramp to its foot on the floor
        const foot = ship.foot();
        if (!foot) { R.phase = 'out'; stand(R); play(R, STAND); }
        else if (!R.walking) { R.drawnY = damp(R.drawnY, R.pos.y, 18, dt); stand(R); play(R, STAND); if (wayOpen()) { R.target = null; setWay(R, foot.clone()); } }
        else {
          const r = walkOn(R, dt, pl, crewNow);
          if (r === 'put') { R.pos.copy(foot); R.drawnY = R.pos.y; stand(R); }
          if (r) { stopWay(R); R.phase = 'out'; play(R, STAND, 0.3); }
        }
      } else if (R.phase === 'out' || R.phase === 'standing') { R.drawnY = damp(R.drawnY, R.pos.y, 18, dt); stand(R); }
      if (R.light && !riding && !atHome) R.light.to(ship.inside(R.pos) ? 1 : 0, dt);
      // drawn near or far (the crew kit's far copy beyond RESCUED.far from the camera)
      if (eye) R.S.setFar(R.c.root.position.distanceTo(eye) > RESCUED.far);
      R.c.update(dt);
    }
  }
  // there: at a bed's side, turned and up onto it; at a seat, sat down (as the crew aboard sit: src/aboard.js)
  function arrive(R, put = false) {
    stopWay(R);
    if (R.target && R.target.kind === 'bed') {
      if (put) { R.pos.copy(R.goal); R.drawnY = R.pos.y; }
      // (the crew room's bunk and bed: lain on as the crew aboard lie on them, not climbed into; else turned round and up)
      if (R.target.lie) { R.phase = 'lying'; R.t = 0; return; }
      R.phase = 'back'; R.t = 0; R.from = R.pos.clone(); R.fromH = R.heading;
    } else if (R.target && R.target.kind === 'sit') {
      R.pos.copy(R.seat); R.drawnY = R.seat.y; R.heading = R.seatHeading; R.side = 0; R.phase = 'sit'; R.t = 0;
      stand(R); play(R, CLIP.sit, 0.35);
    } else { if (put) { R.pos.copy(R.goal); R.drawnY = R.pos.y; } R.phase = 'standing'; stand(R); play(R, STAND); }
  }

  // ── THE FLIGHT HOME, AND HOME (the top of this file) ─────────────────────────────────────────────────────────
  function ride({ scene: sc, order: came = null } = {}) {
    if (riding || atHome) return api;
    aboardAgain();
    // (the frame they are posed in, kept: the Medic set down goes with its planet; so do the pods)
    const M0 = ship.M.clone(), yaw0 = ship.yaw();
    ship = { M: M0, yaw: () => yaw0, foot: () => null, inside: () => true };
    inv.copy(M0).invert(); pods = null; settling = false;
    group = new THREE.Group(); group.name = 'the rescued aboard'; group.matrixAutoUpdate = false; (sc || scene).add(group);
    // (the station's light from here on, as the crew aboard have it)
    for (const R of list) { group.add(R.c.root); if (R.light) R.light.set(0); }
    if (came) list.sort((a, b) => came.indexOf(a.i) - came.indexOf(b.i));
    riding = true;
    return api;
  }
  const drawn = new THREE.Matrix4();
  function late(M) { if (!riding) return; group.matrix.copy(drawn.multiplyMatrices(M, inv)); group.matrixWorldNeedsUpdate = true; }
  function home({ M, walls: w2, foot = null, inside = () => true, open = () => true, crew: c2 = null }) {
    // (each where they are in the ship's own frame, now where the ship stands: their places' frames again, their feet)
    const was = inv.copy(ship.M).invert().clone(), yawWas = ship.yaw(), yaw = Math.atan2(M.elements[8], M.elements[10]), M1 = M.clone();
    ship = { M: M1, yaw: () => yaw, foot: () => foot, inside };
    walls = w2; if (c2) crew = c2; wayOpen = open; riding = false; atHome = true;
    group.matrix.identity(); group.matrixWorldNeedsUpdate = true;
    for (const R of list) {
      R.pos.applyMatrix4(was).applyMatrix4(M1); R.drawnY = R.pos.y; R.heading += yaw - yawWas; R.D = null;
      frames(R);
      if (R.phase === 'sit') { R.pos.copy(R.seat); R.drawnY = R.seat.y; R.heading = R.seatHeading; }
      if (R.phase === 'sit' || R.phase === 'standing') stand(R);
    }
  }
  const byPod = (i) => list.find((R) => R.i === i) || null;
  // UP, AND OUT (one of them, by their pod): off a patient bed or the bench by onbed's moves; from the bunk, the bed or a
  // seat on their feet where one stands beside it, as the crew aboard get up from them
  function leave(i) {
    const R = byPod(i); if (!R || !atHome || !SETTLED.includes(R.phase)) return false;
    R.t = 0; R.leaving = true;
    if (R.phase === 'lying' && R.target && !R.target.lie) R.phase = 'off:' + OUT[0];
    else if (R.phase === 'perched') R.phase = 'off:' + OUT[OUT.length - 1];
    else {
      if (R.phase !== 'standing' && R.goal) { R.pos.copy(R.goal); const f = walls.floorAt(R.pos.x, R.pos.z, R.pos.y + 0.5, 1.2); if (f !== null) R.pos.y = f; R.drawnY = R.pos.y; if (R.out != null && R.target && R.target.kind === 'bed') R.heading = R.out; }
      R.phase = 'leave'; stand(R); play(R, STAND, 0.3);
    }
    return true;
  }
  // THE STATION'S FROM HERE (src/people.js THE WARD): their very figure handed over, where they stand (or lie)
  function take(i) {
    const R = byPod(i); if (!R) return null;
    list.splice(list.indexOf(R), 1); stopWay(R);
    if (R.M) R.M.bed = null;
    R.c.root.removeFromParent();
    return { c: R.c, moves: R.M, pos: R.pos.clone(), heading: R.heading, look: R.S.look, position: R.S.position, setFar: R.S.setFar };
  }
  const stateOf = (R) => (R.phase === 'out' ? 'out' : SETTLED.includes(R.phase) && !R.leaving ? 'in' : 'leaving');

  const api = {
    list,
    // (for the player's walking: people to walk round, where they are just now)
    // (everyone awake: getting out of a pod, walking, on a bed or a seat; where their hips are, about their feet's height;
    // and her paramedic, out at the pods)
    get others() { return [...list, ...(T && T.phase !== 'done' ? [T] : [])].map((R) => ({ pos: R.pos, walking: !!R.walking && !!R.way, hidden: false, away: false })); },
    eyes: () => [...list.filter((R) => R.phase === 'walk' || R.phase === 'leave'), ...(T && T.phase !== 'done' ? [T] : [])].map((R) => R.pos),
    // (how many are in their place: lying, perched or sitting; and whether anyone awake is still on their way)
    get placed() { return list.filter((R) => SETTLED.includes(R.phase)).length; },
    get out() { return list.filter((R) => !ship.inside(R.pos)).length; },
    update, settle, paramedic, ride, late, home, leave, take,
    get riding() { return riding; }, get atHome() { return atHome; }, around: null,
    get riders() { return list.map((R) => ({ i: R.i, look: R.S.look, position: R.S.position, state: stateOf(R), phase: R.phase, pos: R.pos })); },
    leaving: () => list.filter((R) => R.leaving).map((R) => R.pos),
    alarms,
    state: () => ({ alarms, riding, atHome, paramedic: T ? { name: T.name, phase: T.phase, pod: T.pod, t: +T.t.toFixed(2), pos: T.pos.toArray().map((v) => +v.toFixed(2)), way: T.way ? T.way.length : null, tries: T.tries } : null,
      list: list.map((R) => ({ i: R.i, phase: R.phase, t: +R.t.toFixed(2), pos: R.pos.toArray().map((v) => +v.toFixed(2)), place: R.place ? R.place.kind + ':' + R.place.place.id : null, way: R.way ? R.way.length : null, leg: R.leg, tries: R.tries, eyes: R.c.lids ? +R.c.lids.shut.toFixed(2) : null })) }),
    dispose() { aboardAgain(); for (const R of list) R.S.dispose(); list.length = 0; if (group !== scene) group.removeFromParent(); },
  };
  return api;
}
