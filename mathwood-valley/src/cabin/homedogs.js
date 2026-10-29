// THE DOGS AT HOME: a rider's dogs that aren't out with them wait at the cabin, inside on their beds once there are dog
// beds, else on the porch. Coming home they greet you: inside they get up off their beds, trot over, sit in front of you
// a while and go back to bed; on the porch they get up when you come near and sit watching you. The dog that follows you
// comes in with you, keeps beside you and sits when you stop. Each has its name tag, as the dog that follows you does.
//
//   const H = makeHomeDog({ animals, kind, name, scene, spot: { x, y, z, rot }, mode, floor, push, lit, others })
//     mode: 'bed' (inside, on its bed), 'porch' (out on the town cabin's porch: it never walks off it), 'follow'
//     floor(x, z) -> the floor's height there; push(body) keeps a walker { x, y, z } out of the walls (inside only)
//     lit(material): gives the dog's coat the inside light (its own copy of the coat, so the town's dogs don't change)
//     others() -> the other dogs in the room (each { x, z }): a dog keeps its distance from them, so none walk into each other
//     seen(x, z) -> its name tag shows (inside: only with the player in the same room; tags are drawn through walls)
//   H.update(dt, at)   at: where the player stands { x, z, heading } (or null)
//   H.greet(k, n)      comes over to say hello (inside): dog k of n greeting, each sitting in its own spot in a row in front
//                      of you, where you can see it
//   H.goTo(spot, via)  (inside) gets up and trots to a new spot (by the points in `via` first: a doorway), and lies
//                      down there: a fire lit in the hearth (cabin.js), and back to its bed when it has burnt down
//   H.state(), H.dispose()
import * as THREE from 'three';
import { makeAnimal } from '../actors/animals.js';
import { makeTag, dogSettings } from '../dog.js';

export const HOME = {
  greetFrom: 9,       // the porch dogs get up when you come this close (m)
  greetFor: 6,        // seconds a dog sits in front of you before going back to bed
  greetAhead: 2.1,    // greeting, it sits this far in front of you (nearer is under the bottom of the view) ...
  greetGap: 0.62,     // ... and this far sideways from the next greeting dog
  gap: 0.05,          // two dogs' middles stay at least half of each one's length (nose to tail) apart, and this:
                      // lying side by side or nose to tail, a husky never overlaps another (H.r: half its length)
  trot: 1.7,          // m/s it crosses the room at
  followSide: 0.75,   // the dog that follows you: this far to your side and a little behind
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeHomeDog({ animals, kind, name, scene, spot, mode = 'bed', floor = () => spot.y, push = null, lit = null, others = () => [], seen = () => true }) {
  const H = { kind, name, mode, dog: null, x: spot.x, z: spot.z, r: 0.5 };   // (r: half its length once loaded; till then a husky's)
  const C = dogSettings(kind);
  let heading = spot.rot || 0, speed = 0, pose = 'lie', poseT = 99, task = mode === 'follow' ? 'follow' : 'rest', taskT = 0, stillT = 0, headUp = 0;
  let disposed = false, greeted = false, side = 0, going = false, stuckT = 0;
  const tag = makeTag(name); tag.visible = false; scene.add(tag);
  const head = new THREE.Vector3(), body = { x: spot.x, y: spot.y, z: spot.z }, goal = new THREE.Vector3();
  H.ready = animals.need(kind).then(() => {
    if (disposed) return;
    const a = H.dog = makeAnimal(animals, kind, { tint: lit ? '#ffffff' : null });   // (a tint gives it its own coat to light)
    if (a.length > 0) H.r = a.length / 2;
    if (lit) lit(a.mesh.material);
    scene.add(a.root);
    a.root.updateMatrixWorld(true); headUp = a.tall - a.root.worldToLocal(a.bones.Head.getWorldPosition(head)).y;   // (in its own frame: the scene may be the cabin's, turned and raised in the valley)
    if (mode === 'follow') { pose = 'stand'; a.play('Idle', { fade: 0 }); } else { pose = 'lie'; a.play(a.actions.Lie ? 'Lie' : 'Idle', { fade: 0 }); }
  }).catch((e) => console.warn('home dog: no', kind, e));

  function settle(a, to, dt) {
    if (pose !== to) {
      pose = to; poseT = 0;
      if (!a.play(to === 'sit' ? 'Sit_Down' : 'Lie_Down', { fade: 0.2, once: true })) a.play(to === 'sit' ? 'Sit' : 'Lie', { fade: 0.4 });
      return;
    }
    poseT += dt;
    const down = a.actions[to === 'sit' ? 'Sit_Down' : 'Lie_Down'];
    if (down && poseT > down.getClip().duration - 0.1) a.play(to === 'sit' ? 'Sit' : 'Lie', { fade: 0.15 });
  }
  // steps a walker { x, z } out of the other dogs (true when it moved it)
  function keepApart(b) {
    let moved = false;
    for (const o of others()) {
      if (o === H) continue;
      const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz);
      const space = H.r + (o.r ?? 0.5) + HOME.gap;
      if (d >= space) continue;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, by = space - d;
      b.x += nx * by; b.z += nz * by; moved = true;
    }
    return moved;
  }
  const turnTo = (h, k, dt) => { heading += wrap(h - heading) * (1 - Math.exp(-k * dt)); };

  let route = [];   // (the points it trots by on its way to a new spot)
  H.goTo = (to, via = []) => { if (mode !== 'bed') return; spot = { ...spot, ...to }; route = via.map(([x, z]) => ({ x, z })); task = 'home'; taskT = 0; stuckT = 0; };
  H.greet = (k = 0, n = 1) => { if (mode === 'bed') { task = 'greet'; taskT = 0; side = (k - (n - 1) / 2) * HOME.greetGap; going = true; stuckT = 0; } };
  H.update = (dt, at) => {
    const a = H.dog; if (!a) return;
    dt = Math.min(Math.max(dt, 0), 0.1); taskT += dt;
    let target = null, face = null, want = 'lie';
    if (mode === 'porch') {
      // on the porch: up and watching you while you're near, back down when you go
      const d = at ? Math.hypot(at.x - H.x, at.z - H.z) : Infinity;
      if (d < HOME.greetFrom) { if (!greeted) { greeted = true; taskT = 0; } want = taskT < 0.9 ? 'stand' : 'sit'; face = Math.atan2(at.x - H.x, at.z - H.z); }
      else { greeted = false; want = 'lie'; }
    } else if (task === 'greet' && at) {
      // over to its own spot in front of you, sit there a while looking at you, then back to bed. It sets off again only
      // when you've moved a fair way (not at every step), and if a wall or a piece of furniture keeps it from its spot it
      // sits where it got to.
      const h = at.heading || 0, fx = Math.sin(h), fz = Math.cos(h);
      goal.set(at.x + fx * HOME.greetAhead + fz * side, 0, at.z + fz * HOME.greetAhead - fx * side);
      const gd = Math.hypot(goal.x - H.x, goal.z - H.z);
      if (gd > 0.5) going = true; else if (gd < 0.15) going = false;
      if (going && stuckT > 1.2 && gd < 1.6) going = false;
      if (going) { target = goal; taskT = Math.min(taskT, 0.5); }
      else { want = 'sit'; face = Math.atan2(at.x - H.x, at.z - H.z); stuckT = 0; }
      if (taskT > HOME.greetFor) task = 'home';
    } else if (task === 'home') {
      while (route.length && Math.hypot(route[0].x - H.x, route[0].z - H.z) < 0.3) route.shift();
      if (route.length) target = goal.set(route[0].x, 0, route[0].z);
      // (kept from its spot by another dog or the furniture a while: it lies down where it got to)
      else if (Math.hypot(spot.x - H.x, spot.z - H.z) > 0.12 && stuckT < 1.5) target = goal.set(spot.x, 0, spot.z); else { task = 'rest'; face = spot.rot || 0; }
    } else if (task === 'follow' && at) {
      // beside you (on your left, a little behind), sitting when you stop
      const h = at.heading || 0, s = Math.sin(h), c = Math.cos(h);
      goal.set(at.x + c * HOME.followSide - s * 0.35, 0, at.z - s * HOME.followSide - c * 0.35);
      if (Math.hypot(goal.x - H.x, goal.z - H.z) > 0.45) target = goal; else { face = Math.atan2(at.x - H.x, at.z - H.z); want = stillT > 1.2 ? 'sit' : 'stand'; }
    } else face = spot.rot || 0;
    // moving: trot toward the target (faster if far), turned the way it goes; the walls push it round
    const tv = target ? Math.min(HOME.trot * 1.6, HOME.trot * Math.max(0.5, Math.hypot(target.x - H.x, target.z - H.z))) : 0;
    speed = tv > speed ? Math.min(tv, speed + 6 * dt) : Math.max(tv, speed - 8 * dt);
    if (target && speed > 0.05) {
      const h = Math.atan2(target.x - H.x, target.z - H.z); turnTo(h, 8, dt);
      const step = Math.min(speed * dt, Math.hypot(target.x - H.x, target.z - H.z));
      body.x = H.x + Math.sin(heading) * step; body.z = H.z + Math.cos(heading) * step; body.y = floor(H.x, H.z);
      if (push) push(body);
      if (keepApart(body) && push) push(body);
      const moved = Math.hypot(body.x - H.x, body.z - H.z);
      stuckT = moved < step * 0.3 ? stuckT + dt : Math.max(0, stuckT - dt);
      H.x = body.x; H.z = body.z; pose = 'stand'; stillT = 0;
      a.pace(speed);
    } else {
      stillT += dt;
      if (face !== null) turnTo(face, 4, dt);
      if (want === 'stand') { if (pose !== 'stand') { pose = 'stand'; a.play('Idle', { fade: 0.3 }); } else a.pace(0); }
      else if (want === 'sit' && a.actions.Sit) settle(a, 'sit', dt);
      else if (want === 'lie' && a.actions.Lie) settle(a, 'lie', dt);
      else a.pace(0);
    }
    a.root.position.set(H.x, floor(H.x, H.z), H.z);
    a.root.rotation.set(0, heading, 0);
    a.update(dt);
    a.root.updateMatrixWorld(true);
    scene.worldToLocal(a.bones.Head.getWorldPosition(head));   // (the tag hangs in the same scene as the dog: the cabin's frame or the valley's)
    tag.position.set(head.x, head.y + headUp + C.tagUp, head.z); tag.visible = seen(H.x, H.z);   // (its name drawn through walls: only where it can be seen)
  };
  H.state = () => ({ kind, name, mode, task, pose, x: +H.x.toFixed(2), z: +H.z.toFixed(2), loaded: !!H.dog });
  H.dispose = () => { disposed = true; if (H.dog) H.dog.dispose(); tag.removeFromParent(); tag.material.map.dispose(); tag.material.dispose(); };
  return H;
}
