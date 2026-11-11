// THE CAMERA that follows the player: behind and a little above, as Mathwood Valley's on foot (its src/camera.js: the
// same turn and tilt for a drag, the same swing back behind after a moment of walking), made for a station: 4 m
// corridors and small rooms, so it is nearer, and it never looks through a wall.
//
//   const chase = makeChase(camera, walls)
//   chase.snap(feet, heading)     straight behind at once (the start); turned to a clear side if a wall is too close
//   chase.update(dt, { feet, heading, speed, look: { dx, dy }, zoom })
//   chase.near                    how far the camera is from the player's head (m): the game hides the body when close
//   chase.yaw                     where the camera looks (radians, as a heading): "forward" for the keys and stick
//   chase.eye                     the head's height over the feet it follows (m; CAM.eye times the person's size)
//
// NEVER THROUGH A WALL: each frame five lines go from the player's head toward where the camera wants to be (the
// middle one, one either side and one above and below); the camera stops short of the first wall any of them meets,
// at once, and eases back out when the way clears.
import * as THREE from 'three';

export const CAM = {
  dist: 2.6, eye: 1.5,                   // how far behind (m, at zoom 1); the head's height over the feet (m)
  pitch: 0.26, pitchMin: -0.45, pitchMax: 1.1,
  turn: 0.0052, tilt: 0.0042,            // radians a dragged pixel (Mathwood's)
  zoomMin: 0.45, zoomMax: 1.7,           // the wheel or a pinch, times dist
  swingAfter: 1.5, swing: 2.4,           // seconds left alone while walking before it swings back behind; how fast
  follow: 14, rise: 6,                   // how quickly the head is followed, along and up (stairs: a little slower)
  // kept off a wall (m); the side lines' spread round the middle one (m): wide enough that a door's frame or a pillar
  // just beside the camera brings it in through the doorway, rather than filling half the picture
  // (0.16 left door frames filling half the picture; 0.34 pulled the camera right in at every narrow door)
  margin: 0.24, spread: 0.26,
};
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeChase(camera, walls) {
  const C = { yaw: 0, pitch: CAM.pitch, zoom: 1, reach: CAM.dist, idle: 99, near: CAM.dist, eye: CAM.eye };
  const focus = new THREE.Vector3(), dir = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), o = new THREE.Vector3();

  function dirOf(yaw, pitch) { return dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize(); }
  // how far the camera can go from the head along dir (up to len)
  function clearFor(len) {
    side.set(-dir.z, 0, dir.x).normalize(); up.crossVectors(side, dir).normalize();
    let t = walls.reach(focus, dir, len);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      o.copy(focus).addScaledVector(side, a * CAM.spread).addScaledVector(up, b * 0.14);
      // (a side line that starts inside a wall is the head brushing it: not counted)
      if (walls.solidAt(o.x, o.y, o.z)) continue;
      t = Math.min(t, walls.reach(o, dir, len));
    }
    return t;
  }
  function place() {
    camera.position.copy(focus).addScaledVector(dirOf(C.yaw, C.pitch), C.reach);
    camera.lookAt(focus);
    C.near = C.reach;
  }

  C.snap = (feet, heading) => {
    focus.set(feet.x, feet.y + C.eye, feet.z);
    C.pitch = CAM.pitch; C.zoom = 1; C.idle = 99;
    // straight behind, or the nearest clear way round to it
    let best = heading, bestT = -1;
    for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.1, -2.1, Math.PI]) {
      dirOf(heading + off, C.pitch); const t = clearFor(CAM.dist);
      if (t > bestT + 0.25) { best = heading + off; bestT = t; }
      if (t >= CAM.dist - 0.01) break;
    }
    C.yaw = wrap(best); dirOf(C.yaw, C.pitch);
    C.reach = Math.max(0.15, Math.min(CAM.dist, clearFor(CAM.dist) - CAM.margin));
    place();
  };

  C.update = (dt, { feet, heading, speed = 0, look = null, zoom = 0 }) => {
    // the head, followed smoothly (up and down more slowly: a stair is a little lift, not a jolt)
    focus.x = damp(focus.x, feet.x, CAM.follow, dt); focus.z = damp(focus.z, feet.z, CAM.follow, dt);
    focus.y = damp(focus.y, feet.y + C.eye, CAM.rise, dt);
    if (look && (look.dx || look.dy)) {
      C.yaw = wrap(C.yaw - look.dx * CAM.turn);
      C.pitch = Math.max(CAM.pitchMin, Math.min(CAM.pitchMax, C.pitch + look.dy * CAM.tilt));
      C.idle = 0;
    } else C.idle += dt;
    if (zoom) C.zoom = Math.max(CAM.zoomMin, Math.min(CAM.zoomMax, C.zoom * Math.pow(1.12, zoom)));
    // walking, and the view left alone a moment: swing round behind
    if (C.idle > CAM.swingAfter && speed > 0.6) {
      const diff = wrap(heading - C.yaw), rate = CAM.swing * Math.min(1, speed / 3) * dt;
      C.yaw = wrap(C.yaw + Math.sign(diff) * Math.min(Math.abs(diff), rate));
    }
    const want = CAM.dist * C.zoom;
    dirOf(C.yaw, C.pitch);
    const t = Math.max(0.15, Math.min(want, clearFor(want + CAM.margin) - CAM.margin));
    C.reach = t < C.reach ? t : damp(C.reach, t, 2.5, dt);
    place();
  };
  return C;
}
