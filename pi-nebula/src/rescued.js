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
//   const R = makeRescued({ pods, medic, walls, scene, busy, crew })   pods: src/planet/podsdraw.js's; medic:
//                                    src/planet/medicdown.js; walls: src/planet/onfoot.js's (the planet's own); busy(id):
//                                    a place the crew aboard are in; crew(): where they stand, [{ x, y, z, walking }]
//   R.update(dt, { player, camera })   each frame: a lid open enough wakes its sleeper; everyone's moves go on
//   R.settle()  everyone out of the pods and in their place at once (the run's skip)
//   R.list    [{ i (the pod), name, phase, pos, heading, place }]   R.others: the people to walk round, for the player
//   R.placed  how many are in their place; R.out: how many awake are still outside the cabin
//   R.eyes()  where the awake ones' feet are (the cabin's doors open for them)
//   R.state() (for the rigs)   R.dispose()
import * as THREE from 'three';
import { pose as onBed, SECS } from './onbed.js';
import { bedPose } from './moves.js';
import { walkStep, WALK, CLIP } from './aboardplan.js';
import { BODY } from './walls.js';
import { STAND } from './player.js';
import { OUT, ON, WAKE, POD_OUT, choose, restOrder, bedToShip, leanOn } from './rescueplan.js';

// how far from the camera someone is drawn with the crew kit's far copy (m: src/planet/podsdraw.js PODS_DRAW.far); how
// long the way may be worked out each frame (ms), how long before a way not found is asked again (s), and how many tries
// before they are simply put in their place (an alarm, counted); how long the first move out of the pod is eased from
// the pose they slept in (s); and how long held up on the spot, walking, before the same (s: a loud alarm, never quietly)
export const RESCUED = { far: 7, planMs: 3, retry: 1.2, tries: 4, blend: 0.9, stall: 8 };
const ease = (t) => t * t * (3 - 2 * t);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const _e = new THREE.Euler();

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

export function makeRescued({ pods, medic, walls, scene, busy = () => false, crew = () => [] }) {
  // (the places, in the game's maker's order: the patient beds, the crew room's bunk and bed, the lab's bench, the stools;
  // busy(id): a place someone else aboard is in (the crew aboard, src/aboard.js), passed over; crew(): where the crew
  // aboard stand just now, in the world, walked round as the rescued walk round each other)
  const list = [], taken = new Set(), order = medic ? medic.order || restOrder(medic.bp, medic.space.deck, medic.places) : [];
  const alarms = { putThere: 0, stalled: 0 };
  // (a point of the ship's own frame, and a heading, in the world)
  const shipPoint = (p) => new THREE.Vector3(...p).applyMatrix4(medic.M), shipHeading = (h) => h + medic.stand.yaw;
  // a patient bed's own frame in the world (onbed's frame, a turn and a move; its other side by `mirror`, bedPose)
  const bedFrame = (B) => {
    const F = B.frame, x = new THREE.Vector3(...F.x), z = new THREE.Vector3(...F.z), y = new THREE.Vector3(0, 1, 0);
    return new THREE.Matrix4().makeBasis(x, y, z).setPosition(...F.o).premultiply(medic.M);
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
    c.root.removeFromParent(); scene.add(c.root); c.root.visible = true; S.setFar(false);
    c.setEyes('blink');
    const bed = { ...F.bed, stand: [F.bed.edge + POD_OUT.stand, F.bed.z] };
    const R = { i, name: `Sleeper ${i + 1}`, S, c, M, frame, bed, rest, phase: 'wake', t: 0, D: null, pos: new THREE.Vector3(), heading: 0, drawnY: 0, walking: false, clip: '', want: null, plan: null, tries: 0, wait: 0 };
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
    R.M.bed = null;
    R.c.root.position.set(R.pos.x, R.drawnY, R.pos.z); R.c.root.quaternion.setFromEuler(_e.set(0, R.heading + (R.side || 0), 0));
  }

  // ── on to their place: the first free one of the order (a bed while one is free, then the bench, then a seat) ──
  // (their place, picked now: the next free one; the bed's frame in the world, and the way they face, back to it)
  function pick(R) {
    if (R.place) return R.place;
    const ch = choose(order, new Set([...taken, ...order.map((c) => c.place.id).filter((id) => busy(id))]));
    if (!ch) return null;
    taken.add(ch.place.id); R.place = ch;
    if (ch.kind === 'bed' || ch.kind === 'perch') {
      const B = ch.place;
      R.target = { kind: 'bed', lie: !!B.lie, perch: ch.kind === 'perch' }; R.bedWorld = bedFrame(B); R.goal = shipPoint(bedToShip(B, [B.bed.stand[0], 0, B.bed.stand[1]]));
      const o = bedToShip(B, [1, 0, 0]), z0 = bedToShip(B, [0, 0, 0]); R.out = Math.atan2(o[0] - z0[0], o[2] - z0[2]) + medic.stand.yaw;
    } else {
      const p = ch.place; R.goal = shipPoint([p.stand[0], p.y, p.stand[1]]); R.seat = shipPoint([p.x, p.y, p.z]); R.target = { kind: 'sit' }; R.seatHeading = shipHeading(p.heading);
    }
    return ch;
  }
  function setOff(R) {
    const ch = pick(R);
    R.walking = true; R.phase = 'walk'; R.t = 0; R.leg = 0; R.wait = 0; R.side = 0; R.sideAim = 0;
    if (!ch) { R.target = null; R.goal = shipPoint([0, medic.space.deck, 0.25]); }
    // (the way in two legs: to the ramp's foot over the ground, then up it and through the cabin to the place: a way
    // from far off into the cabin's narrow rooms, worked out at once on the cabin's fine grid, ran out of steps)
    const foot = medic.foot.clone(); foot.y = walls.floorAt(foot.x, foot.z, foot.y + 3, 6) ?? foot.y;
    R.stops = medic.inside(R.pos) ? [R.goal] : [foot, R.goal]; R.stopI = 0; R.wayAll = [];
    planNext(R);
    play(R, STAND, 0.3);
  }
  function planNext(R) { const from = R.wayAll.length ? R.wayAll[R.wayAll.length - 1] : R.pos; R.plan = walls.plan(from.clone(), R.stops[R.stopI].clone()); }

  // ── each frame ──────────────────────────────────────────────────────────────────────────────────────────────────
  let clock = 0, settling = false;
  // ALL AT ONCE (the run's skip, K): every pod's sleeper out of it and in their place at once, lying, perched or sitting
  // (a sleeper not in their pod yet is put in their place as soon as they are: settling)
  function settle() {
    settling = true;
    if (pods && medic) pods.pods.forEach((p, i) => { if (p.sleeper && !list.some((R) => R.i === i)) wake(i, p); });
    for (const R of list) {
      if (['lying', 'perched', 'sit', 'standing'].includes(R.phase)) continue;
      R.way = null; R.plan = null; R.walking = false; R.t = 0;
      if (!pick(R)) { R.goal = shipPoint([0, medic.space.deck, 0.25]); R.pos.copy(R.goal); R.drawnY = R.pos.y; R.phase = 'standing'; stand(R); play(R, STAND, 0); continue; }
      if (R.target.kind === 'sit') { R.pos.copy(R.seat); R.drawnY = R.seat.y; R.heading = R.seatHeading; R.side = 0; R.phase = 'sit'; stand(R); play(R, CLIP.sit, 0); }
      else { R.pos.copy(R.goal); R.drawnY = R.pos.y; R.phase = R.target.perch ? 'perched' : 'lying'; }
    }
  }
  function update(dt, { player = null, camera = null } = {}) {
    clock += dt;
    // (a lid open far enough: its sleeper wakes)
    if (pods && medic) pods.pods.forEach((p, i) => { if (p.sleeper && (p.want ?? pods.want) === 1 && p.k >= WAKE.lid && !list.some((R) => R.i === i)) wake(i, p); });
    if (settling && list.some((R) => !['lying', 'perched', 'sit', 'standing'].includes(R.phase))) settle();
    const pl = player ? { x: player.pos.x, z: player.pos.z } : null, crewNow = list.length ? crew() || [] : [];
    for (const R of list) {
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
          else {
            // on their feet beside the pod: where the hips are, on the floor; then off to the Medic
            R.pos.set(R.D.hips.x, 0, R.D.hips.z); const f = walls.floorAt(R.pos.x, R.pos.z, R.D.hips.y, 1.5); R.pos.y = f ?? (R.D.root.y); R.drawnY = R.D.root.y;
            R.heading = R.D.heading; stand(R); setOff(R);
          }
        }
      } else if (R.phase === 'walk') {
        // the way worked out a little at a time, then walked as the crew aboard walk
        if (R.plan && !R.plan.done) { R.plan.step(RESCUED.planMs); play(R, STAND); }
        else if (R.plan && R.plan.done && !R.way) {
          const w = R.plan.way;
          if (!w || w.short > 0.6) { R.tries++; R.plan = null; R.retry = RESCUED.retry; if (R.tries >= RESCUED.tries) { alarms.putThere++; arrive(R, true); } }
          else {
            R.wayAll.push(...(R.wayAll.length ? w.slice(1) : w).map((v) => v.clone())); R.stopI++;
            if (R.stopI < R.stops.length) planNext(R);
            else { R.way = [...R.wayAll, ...(R.seat ? [R.seat.clone()] : [])]; R.leg = 0; R.getUp = false; }
          }
        } else if (!R.plan && !R.way) { R.retry -= dt; play(R, STAND); if (R.retry <= 0) planNext(R); }
        if (R.way) {
          const free = (x, z) => { const f = walls.floorAt(x, z, R.pos.y + BODY.stepUp, BODY.stepUp + BODY.stepDown); return f !== null && walls.free(x, f, z, undefined, true); };
          const wall = walls.radius ? walls.radius(R.pos.x, R.pos.y, R.pos.z) : 0.15;
          // (the others standing or walking: someone sitting or lying is in their seat or bed, beside the way through, as the
          // crew aboard have it; the crew room's stools are 0.5 m apart, nearer than two bodies are ever let come)
          const others = list.filter((Q) => Q !== R && !['wake', 'sit', 'lying', 'perched', ...OUT, ...ON].includes(Q.phase)).map((Q) => ({ x: Q.pos.x, z: Q.pos.z, walking: Q.phase === 'walk' && !!Q.way, heading: Q.heading, held: Q.wait > 0.3, first: list.indexOf(Q) < list.indexOf(R) }));
          // (and the crew aboard standing or walking (in the cabin, on its deck): walked round as each other is)
          for (const q of crewNow) if (Math.abs(q.y - R.pos.y) < 1.2) others.push({ x: q.x, z: q.z, walking: !!q.walking, heading: q.heading || 0, held: false, first: true });
          const x0 = R.pos.x, z0 = R.pos.z, r = walkStep(R, dt, pl, { others, free, wall });
          // (held up on the spot this long, walking (not waiting for the player): a loud alarm, and put in their place)
          R.stall = Math.hypot(R.pos.x - x0, R.pos.z - z0) > 0.004 || r === 'wait' || r === 'back' ? 0 : (R.stall || 0) + dt;
          if (R.stall > RESCUED.stall) { alarms.stalled++; console.warn('rescued: ' + R.name + ' held up on the way, put in their place'); arrive(R, true); continue; }
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
          if (r === 'there') arrive(R);
        }
      } else if (R.phase === 'back') {
        // at the bed's side: turned round where they stand, their back to it (as the scanner's patient: standing)
        const k = ease(Math.min(1, R.t / SECS.back));
        R.pos.lerpVectors(R.from, R.goal, k); R.drawnY = damp(R.drawnY, R.pos.y, 18, dt); R.heading = R.fromH + wrap(R.out - R.fromH) * k;
        stand(R); play(R, STAND);
        if (R.t >= SECS.back) { R.phase = ON[1]; R.t = 0; }
      } else if (ON.includes(R.phase)) {
        // ONTO THE BED: onbed's moves, and lying back on its stretcher's raised back; ONTO THE BENCH: the hop alone, and
        // there, perched on its edge
        const p = onBed(R.phase, R.t, R.place.place.bed, R.M.body);
        if (R.phase === 'down' || R.phase === 'stretch') p.lean = leanOn(p.lean, R.place.place.back);
        lay(R, p, R.bedWorld, R.place.place.mirror);
        if (p.done) { const k = ON.indexOf(R.phase); if (R.target.perch) { R.phase = 'perched'; R.t = 0; } else if (k < ON.length - 1) { R.phase = ON[k + 1]; R.t = 0; } else { R.phase = 'lying'; R.t = 0; } }
      } else if (R.phase === 'lying') {
        const p = onBed('lying', 0, R.place.place.bed, R.M.body); p.lean = leanOn(p.lean, R.place.place.back);
        lay(R, p, R.bedWorld, R.place.place.mirror);
      } else if (R.phase === 'perched') {
        lay(R, onBed(ON[1], SECS[ON[1]], R.place.place.bed, R.M.body), R.bedWorld, R.place.place.mirror);
      } else if (R.phase === 'sit') { stand(R); }
      // drawn near or far (the crew kit's far copy beyond RESCUED.far from the camera)
      if (camera) R.S.setFar(R.c.root.position.distanceTo(camera.position) > RESCUED.far);
      R.c.update(dt);
    }
  }
  // there: at a bed's side, turned and up onto it; at a seat, sat down (as the crew aboard sit: src/aboard.js)
  function arrive(R, put = false) {
    R.way = null; R.plan = null; R.walking = false;
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
  return {
    list,
    // (for the player's walking: people to walk round, where they are just now)
    // (everyone awake: getting out of a pod, walking, on a bed or a seat; where their hips are, about their feet's height)
    get others() { return list.map((R) => ({ pos: R.pos, walking: R.phase === 'walk' && !!R.way, hidden: false, away: false })); },
    eyes: () => list.filter((R) => R.phase === 'walk').map((R) => R.pos),
    // (how many are in their place: lying, perched or sitting; and whether anyone awake is still on their way)
    get placed() { return list.filter((R) => ['lying', 'perched', 'sit', 'standing'].includes(R.phase)).length; },
    get out() { return list.filter((R) => !medic.inside(R.pos)).length; },
    update, settle,
    alarms,
    state: () => ({ alarms, list: list.map((R) => ({ i: R.i, phase: R.phase, t: +R.t.toFixed(2), pos: R.pos.toArray().map((v) => +v.toFixed(2)), place: R.place ? R.place.kind + ':' + R.place.place.id : null, way: R.way ? R.way.length : null, leg: R.leg, tries: R.tries, eyes: R.c.lids ? +R.c.lids.shut.toFixed(2) : null })) }),
    dispose() { for (const R of list) R.S.dispose(); list.length = 0; },
  };
}
