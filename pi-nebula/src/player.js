// THE PLAYER on foot in the station: their chosen look (looks.js) built with the crew kit, walked by the shared input
// (shared/input.js: the same keys and thumb stick as Mathwood Valley) the way Mathwood's rider walks: forward is where
// the camera looks, a brisk walk, Shift (or the stick pushed to its edge) to run, turning smoothly to the way walked.
//
//   const P = await makePlayer({ lib, recipe, walls, scene })
//   P.place(feet, heading)          stand them somewhere (a spot walls.snap gave)
//   P.update(dt, { move, run, yaw, others })   move: { x, y, mag } from the input; yaw: the camera's; others: the
//                                   people about ({ pos } each), whom the player does not walk through
//   P.pos, P.heading, P.speed (the ground really covered, m/s), P.c (the crew kit's character)
import * as THREE from 'three';
import { makeCrew } from '../kit/crew.js';

export const MOVE = { walk: 1.6, run: 4.6, accel: 9, turn: 10, near: 0.6 };   // m/s; m/s each second; radians a second; m kept off another person
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the standing clip (the listening stance: the arms by the sides; the plain Idle holds them out from the body)
export const STAND = 'Stand_Listen';

// LIT BY THE ROOM THEY ARE IN: the station's light is painted into its walls (its saved light), so there are no lamps
// for a character to catch; a character takes its light from the room's own picture of itself (station.js W.envAt),
// more strongly than the kit's default, and is given the next room's as it walks into it.
export const SHINE = 3;
export function shine(c, env) {
  c.root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m || !('envMapIntensity' in m)) continue;
      if (m.userData.baseShine === undefined) m.userData.baseShine = m.envMapIntensity;
      m.envMapIntensity = m.userData.baseShine * SHINE;
      if (env && m.envMap !== env) m.envMap = env;
    }
  });
}

export async function makePlayer({ lib, recipe, walls, scene }) {
  const c = await makeCrew(lib, recipe);
  scene.add(c.root);
  const P = { c, pos: new THREE.Vector3(), heading: 0, speed: 0, want: 0, drawnY: 0, clip: '' };
  const play = (name, speed = 1) => { if (P.clip !== name) { c.play(name, { fade: 0.25, speed }); P.clip = name; } else c.play(name, { speed }); };

  P.place = (feet, heading = 0) => {
    P.pos.copy(feet); P.drawnY = feet.y; P.heading = heading; P.speed = 0; P.want = 0;
    c.root.position.copy(feet); c.root.rotation.set(0, heading, 0);
    play(STAND); c.update(0);
  };

  const before = new THREE.Vector3();
  P.update = (dt, { move = null, run = false, yaw = 0, others = [] } = {}) => {
    let target = 0;
    if (move && move.mag >= 0.08) {
      // the push, turned by the camera's yaw: forward is the way the camera looks
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
      const dir = Math.atan2(fx * move.y + rx * move.x, fz * move.y + rz * move.x), diff = wrap(dir - P.heading);
      P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), MOVE.turn * dt));
      target = (run ? MOVE.run : MOVE.walk) * Math.min(1, move.mag * 1.25) * (Math.abs(diff) > 1.8 ? 0.3 : 1);
    }
    const v0 = P.want;
    P.want = target > P.want ? Math.min(target, P.want + MOVE.accel * dt) : Math.max(target, P.want - MOVE.accel * 1.5 * dt);
    const v = (v0 + P.want) / 2;
    let got = 0;
    if (v > 0.01) {
      before.copy(P.pos);
      got = walls.move(P.pos, Math.sin(P.heading) * v * dt, Math.cos(P.heading) * v * dt);
      // not through another person: walked into, they are slid round (pushed out to MOVE.near from them, where the walls
      // allow; where they do not, the step is not taken)
      for (const o of others) {
        if (o.hidden || Math.abs(P.pos.y - o.pos.y) > 1.5) continue;
        const dx = P.pos.x - o.pos.x, dz = P.pos.z - o.pos.z, d1 = Math.hypot(dx, dz);
        if (d1 >= MOVE.near) continue;
        const nx = d1 > 1e-4 ? dx / d1 : Math.sin(P.heading + Math.PI / 2), nz = d1 > 1e-4 ? dz / d1 : Math.cos(P.heading + Math.PI / 2);
        const x = o.pos.x + nx * MOVE.near, z = o.pos.z + nz * MOVE.near, f = walls.floorAt(x, z, P.pos.y + 0.32, 0.8);
        if (f !== null && walls.free(x, f, z)) { P.pos.set(x, f, z); } else { P.pos.copy(before); }
        got = Math.hypot(P.pos.x - before.x, P.pos.z - before.z);
      }
      if (got < v * dt * 0.3) P.want = Math.min(P.want, got / Math.max(dt, 1e-4) + 0.3);   // (held up: ready to set off again)
    }
    // the ground really covered: the legs are played from it, so pushing into a wall stands still
    P.speed = damp(P.speed, got / Math.max(dt, 1e-4), 25, dt);
    // the body: stairs eased (the feet's height steps a riser at a time)
    P.drawnY = Math.abs(P.pos.y - P.drawnY) > 0.6 ? P.pos.y : damp(P.drawnY, P.pos.y, 18, dt);
    c.root.position.set(P.pos.x, P.drawnY, P.pos.z); c.root.rotation.set(0, P.heading, 0);
    if (P.speed > 2.6) play('Run', Math.max(0.6, Math.min(1.6, P.speed / c.stride.Run)));
    else if (P.speed > 0.15) play('Walk', Math.max(0.5, Math.min(1.8, P.speed / c.stride.Walk)));
    else play(STAND);
    c.update(dt);
  };
  P.dispose = () => { scene.remove(c.root); c.dispose(); };
  return P;
}
