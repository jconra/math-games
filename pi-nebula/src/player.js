// THE PLAYER on foot in the station: their chosen look (looks.js) built with the crew kit, walked by the shared input
// (shared/input.js: the same keys and thumb stick as Mathwood Valley) the way Mathwood's rider walks: forward is where
// the camera looks, a brisk walk, Shift (or the stick pushed to its edge) to run, turning smoothly to the way walked.
//
//   const P = await makePlayer({ lib, recipe, walls, scene })
//   P.place(feet, heading)          stand them somewhere (a spot walls.snap gave)
//   P.update(dt, { move, run, yaw, others, clip, keepOff })   move: { x, y, mag } from the input; yaw: the camera's; others: the
//                                   people ({ pos } each, and `away` or `hidden`: not there), whom the player does not
//                                   walk through (never nearer than MOVE.near: slid round them; where the walls leave
//                                   no room to slide round, squeezed past, never nearer than PASS.squeeze, at half
//                                   speed while overlapping, turned side-on to someone walking); clip: one to play
//                                   this frame whatever the legs are doing (a throw in the arena's game), at clipSpeed
//   P.pos, P.heading, P.speed (the ground really covered, m/s), P.c (the crew kit's character)
import * as THREE from 'three';
import { makeCrew } from '../kit/crew.js';
import { PASS, roomAt, roomFor, sideOn } from './passing.js';
import { addMoves } from './moves.js';

// m/s; m/s each second; radians a second; m kept off another person, middle to middle (passing.js PASS.apart: the one
// size of a body against another, everyone's, so the player gets by people where they get by each other; it was 0.6)
export const MOVE = { walk: 1.6, run: 4.6, accel: 9, turn: 10, near: PASS.apart };
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
  // (the station people's own small moves, moves.js: standing at rest, THE STANCE, the weight on one leg and over to
  // the other now and then; a hold of the hands, on Cargo's forklift its wheel: src/cargodrive.js)
  c.play(STAND, { fade: 0 }); c.update(0);
  const P = { c, pos: new THREE.Vector3(), heading: 0, speed: 0, want: 0, drawnY: 0, clip: STAND, side: 0, sideAim: 0, moves: addMoves(c) };
  const play = (name, speed = 1) => { if (P.clip !== name) { c.play(name, { fade: 0.25, speed }); P.clip = name; } else c.play(name, { speed }); };

  P.place = (feet, heading = 0) => {
    P.pos.copy(feet); P.drawnY = feet.y; P.heading = heading; P.speed = 0; P.want = 0; P.side = 0; P.sideAim = 0;
    c.root.position.copy(feet); c.root.rotation.set(0, heading, 0);
    play(STAND); c.update(0);
  };

  const before = new THREE.Vector3();
  P.update = (dt, { move = null, run = false, yaw = 0, others = [], clip = null, clipSpeed = 1, keepOff = null } = {}) => {
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
    // (the player's body overlapping someone's, squeezing past them: at half speed, PASS.slow, as they are; the game's
    // maker, 2026-11-21: "it should slow them down to half speed")
    let near = null, nd = PASS.turnAt;
    for (const o of others) {
      if (o.hidden || o.away || Math.abs(P.pos.y - o.pos.y) > 1.5) continue;
      const d = Math.hypot(P.pos.x - o.pos.x, P.pos.z - o.pos.z);
      if (d < nd) { nd = d; near = o; }
    }
    const slowed = !!near && nd < PASS.apart - 1e-9, v = (v0 + P.want) / 2 * (slowed ? PASS.slow : 1);
    let got = 0;
    if (v > 0.01) {
      before.copy(P.pos);
      got = walls.move(P.pos, Math.sin(P.heading) * v * dt, Math.cos(P.heading) * v * dt);
      // (a machine the walls do not feel all of, Cargo's forklift's forks: a step onto it is not taken, keepOff)
      if (keepOff && keepOff(before.x, before.z, P.pos.x, P.pos.z, P.pos.y)) { P.pos.copy(before); got = 0; }
      // not through another person: walked into, they are slid round (pushed out to MOVE.near from them, where the walls
      // allow; where they do not, the step is not taken)
      // SQUEEZED PAST, where the walls leave no room to slide round them at MOVE.near (a ship's narrow mess, its bunks'
      // aisle, a door: the game's maker, 2026-11-21, "In the narrow places too, he turns side-on and you squeeze past
      // each other"): the step as the walls let it, the middles never nearer than PASS.squeeze (each body's outer half
      // in the other's at most); slid round to no further off than they were before the step (no jump out of a squeeze)
      for (const o of others) {
        // (someone away, out of sight with their day going on out of the way (people.js), is not there for the player)
        if (o.hidden || o.away || Math.abs(P.pos.y - o.pos.y) > 1.5) continue;
        const dx = P.pos.x - o.pos.x, dz = P.pos.z - o.pos.z, d1 = Math.hypot(dx, dz), d0 = Math.hypot(before.x - o.pos.x, before.z - o.pos.z);
        const R = Math.min(MOVE.near, Math.max(d0, PASS.squeeze));
        if (d1 >= R - 1e-9) continue;
        const nx = d1 > 1e-4 ? dx / d1 : Math.sin(P.heading + Math.PI / 2), nz = d1 > 1e-4 ? dz / d1 : Math.cos(P.heading + Math.PI / 2);
        const out = (k) => { const x = o.pos.x + nx * k, z = o.pos.z + nz * k, f = walls.floorAt(x, z, P.pos.y + 0.32, 0.8); if (f !== null && walls.free(x, f, z)) { P.pos.set(x, f, z); return true; } return false; };
        if (!out(R) && d1 < PASS.squeeze && !out(PASS.squeeze)) P.pos.copy(before);
        got = Math.hypot(P.pos.x - before.x, P.pos.z - before.z);
      }
      // (overlapping, the slide round them is part of the half-speed step: no further in all than v * dt, where that
      // point is free and keeps PASS.squeeze off everyone)
      if (slowed && got > v * dt + 1e-6) {
        const k = v * dt / got, x = before.x + (P.pos.x - before.x) * k, z = before.z + (P.pos.z - before.z) * k, f = walls.floorAt(x, z, P.pos.y + 0.32, 0.8);
        if (f !== null && walls.free(x, f, z) && !others.some((o) => !o.hidden && !o.away && Math.abs(P.pos.y - o.pos.y) <= 1.5 && Math.hypot(x - o.pos.x, z - o.pos.z) < PASS.squeeze)) { P.pos.set(x, f, z); got = v * dt; }
      }
      if (got < v * dt * 0.3) P.want = Math.min(P.want, got / Math.max(dt, 1e-4) + 0.3);   // (held up: ready to set off again)
    }
    // the ground really covered: the legs are played from it, so pushing into a wall stands still
    P.speed = damp(P.speed, got / Math.max(dt, 1e-4), 25, dt);
    // the body: stairs eased (the feet's height steps a riser at a time)
    P.drawnY = Math.abs(P.pos.y - P.drawnY) > 0.6 ? P.pos.y : damp(P.drawnY, P.pos.y, 18, dt);
    // TURNED SIDE-ON squeezing past someone walking, where the floor across is too narrow for two to pass forward
    // (passing.js roomFor, the walls' own half width there): facing them from PASS.turnAt off, till PASS.turnOff apart
    // again; P.side, the turn from the way walked (+ to the left), eased round; the way walked and the camera are as ever
    if (near && near.walking && !P.sideAim) {
      const rx = -Math.cos(P.heading), rz = Math.sin(P.heading), lat = (near.pos.x - P.pos.x) * rx + (near.pos.z - P.pos.z) * rz;
      const need = roomFor(walls.radius ? walls.radius(P.pos.x, P.pos.y, P.pos.z) : 0.28), [l, r] = roomAt(P.pos.x, P.pos.z, rx, rz, (x, z) => walls.free(x, P.pos.y, z), need, 0.03);
      if (l + r < need - 0.03) P.sideAim = sideOn(lat);
    } else if (P.sideAim && !(near && near.walking && nd < PASS.turnOff)) P.sideAim = 0;
    const sd = (P.sideAim || 0) - P.side; P.side += Math.sign(sd) * Math.min(Math.abs(sd), 5 * dt);
    c.root.position.set(P.pos.x, P.drawnY, P.pos.z); c.root.rotation.set(0, P.heading + P.side, 0);
    if (clip) play(clip, clipSpeed);
    else if (Math.abs(P.side) > 0.8 && P.speed > 0.15) play(P.side > 0 ? 'Run_Right' : 'Run_Left', Math.max(0.3, Math.min(0.8, P.speed / 2)));
    else if (P.speed > 2.6) play('Run', Math.max(0.6, Math.min(1.6, P.speed / c.stride.Run)));
    else if (P.speed > 0.15) play('Walk', Math.max(0.5, Math.min(1.8, P.speed / c.stride.Walk)));
    else play(STAND);
    P.moves.stand = !clip && P.clip === STAND ? 1 : 0;
    c.update(dt);
  };
  P.dispose = () => { scene.remove(c.root); c.dispose(); };
  return P;
}
