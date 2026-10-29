// THE CAMERA: a third-person camera that follows the player from behind, about 6 m back on foot and 9 m on the horse.
// Dragging turns it round the player (and tilts it); the wheel moves it in and out. A second and a half after the last
// drag, once the player is moving, it eases back round behind them. It never goes below the ground (it rises over a hill
// between it and the player) and never into a building (it comes in closer instead). Everything eases with a damp
// that is worked out from the frame's time, so it moves the same at 30 or 144 frames a second.
//
//   const C = makeCamera({ camera, W, input })
//   C.update(dt, { at, heading, onHorse, speed, seat })   each frame, after the player has moved: at: the player's feet
//                (a Vector3); heading: the way they face (radians, as three's rotation.y: facing (sin, cos)); speed: m/s;
//                seat: on a horse, how high its saddle sits over its feet (m; the bay's 1.505 if not given): a bigger
//                horse lifts the view by as much as its seat is higher.
//                It also keeps W.camTarget on the player (the valley's plant and tree circles follow it).
//   C.swing(dt, { heading, onHorse, speed })   optional: the swing back round behind, on its own, for a player that
//                moves in short steps within a frame (the push is read the way the camera looks, so the two are best
//                stepped together); update() then leaves the swing out for that frame
//   C.yaw, C.pitch     where it looks from (yaw as heading: yaw = heading is straight behind); pitch: radians down
//   C.zoom             the wheel's zoom (1: the usual distance)
//   C.first            first person wanted (the wheel or a pinch on in past the nearest distance; or walking into a
//                      building of FIRST.rooms); C.fp how far in it is, 0 (the chase camera) .. 1 (the rider's eyes):
//                      src/player.js hides the rider's own body as it goes in
//   C.setFirst(on)     first person on or off by hand (as the wheel does)
//
// FIRST PERSON (the game maker: "Scrolling moves the camera in and out, Just let it zoom in to 1st person"; "the camera
// should go to first person any time the player goes into the building"): the wheel, or a pinch on a phone, on in past
// the chase camera's nearest point eases the view into the rider's own eyes (on foot, or over the saddle on a horse:
// the horse's neck and ears ahead), looking where a drag looks, with a little wider view, as the player's cabin's first
// person does (src/cabin/cabin.js FP: the same numbers, FIRST); out again comes back to the chase camera. Walking in
// through the door of a building (FIRST.rooms: the store, the sheriff's, the saloon ...) goes into first person by itself, and
// walking out comes back (unless the player zoomed in by hand: then it stays; zooming out inside keeps the chase camera
// there until the next time in). In first person the view never swings round by itself: it stays where it is looked.
//   C.snap()           behind the player at once (after a jump to another place; off to the side if a building is behind)
//   C.shift(dx, dy, dz)   moved with the player as it stands (the way round at the valley's ends: nothing jumps)
//   C.enabled          false: the game moves the camera itself (a close-up); update() then only keeps W.camTarget
import * as THREE from 'three';

// the first person's numbers (the player's cabin uses the same: src/cabin/cabin.js FP)
export const FIRST = {
  eye: 1.62, fov: 68, ease: 0.38,     // m over the feet; degrees (the chase camera's is 55); s to ease all the way in or out
  pitch: 1.3,                         // how far a drag tilts the view up and down (the chase camera's tilt, scaled)
  horseEye: 0.84,                     // m over the saddle, on a horse
  rise: 12,                           // how fast the eyes follow up and down (a step up the porch: no jolt)
  // walked into: first person by itself (the game maker: "any time the player goes into the building"): the store, the
  // sheriff's, the saloon and its band, the smithy, the stable and its horses, the farm's barn, the townsfolk's homes (the
  // player's own cabin has its own first person: src/cabin/cabin.js)
  rooms: ['generalStore', 'sheriff', 'saloon', 'blacksmith', 'stable', 'barn', 'home'],
  // in there, in first person, with none of its doorways or windows in view, the valley beyond its walls is left
  // undrawn (the far plane brought in to `far` m), as in the player's cabin (src/cabin/cabin.js INDOOR): the room is all
  // there is to see. margin: how far past the screen's edge an opening still counts as in view (1: the edge); doorway:
  // the eyes this near a doorway see out through it whichever way they look
  indoor: { far: 26, margin: 1.25, doorway: 1.4 },
};
export const CAM = {
  dist: 6, horseDist: 9,            // metres behind
  eye: 1.55, horseEye: 2.35,        // the point it looks at: this high over the player's feet (the horse's back + a head)
  horseSeat: 1.505,                 // (the bay's seat height, which horseEye was set for)
  pitch: 0.3, horsePitch: 0.26,     // how far it looks down (radians)
  pitchMin: -0.35, pitchMax: 1.2,
  turn: 0.0052, tilt: 0.0042,       // radians per pixel dragged
  zoomMin: 0.45, zoomMax: 2.2,      // the wheel's range (times the distance)
  swingAfter: 1.5,                  // seconds after the last drag before it swings back behind
  swing: 2.4, swingHorse: 1.8,      // how fast it swings back (a damp rate: about 1/rate seconds to close most of the gap)
  follow: 14,                       // how tightly it follows the player (damp rate)
  rise: 7,                          // how fast it follows up and down (gentler: a step up shouldn't jolt)
  clear: 0.45,                      // the least room between the ground and the camera, or the line it looks along
};

const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// eased toward a target that moved steadily from `from` to `to` during the frame: worked out exactly, so a moving player
// is followed equally closely at any frame rate (a plain damp toward where they ended up trails further behind at a high
// frame rate than at a low one)
const chase = (a, from, to, k, dt) => {
  if (dt <= 0) return a;
  const e = Math.exp(-k * dt), lag = (to - from) / (k * dt);       // (lag: how far behind it would settle at this pace)
  return to - lag + (a - from + lag) * e;
};

export function makeCamera({ camera, W, input = null }) {
  const focus = new THREE.Vector3(), want = new THREE.Vector3(), pos = new THREE.Vector3();
  // every building in the town (W.places.buildings: the cabin, stable, store, sheriff's office, saloon and stage)
  const B = ((W.places && W.places.buildings) || []).filter((b) => b && b.w)
    .map((b) => ({ x: b.x, z: b.z, c: Math.cos(b.rot), s: Math.sin(b.rot), hw: b.w / 2 + 0.3, hd: b.d / 2 + 0.3, h: b.h || 8 }));
  // inside a building's box (its footprint up to its roof)?
  // (in a code-built building, under its roof: its own walls and ceilings stop the camera, not its whole box: W.codeRoom)
  let room = null;
  const inBuilding = (x, y, z) => (room ? room.solid(x, y, z) : B.some((b) => { const dx = x - b.x, dz = z - b.z;
    return Math.abs(b.c * dx - b.s * dz) < b.hw && Math.abs(b.s * dx + b.c * dz) < b.hd && y < W.heightAt(b.x, b.z) + b.h; }));
  const C = {
    yaw: 0, pitch: CAM.pitch, zoom: 1, enabled: true, dist: CAM.dist, eye: CAM.eye, reach: 1,
    started: false, first: false, fp: 0,
  };
  // first person: by hand (the wheel, a pinch) or by the room walked into; the eyes' height eased; the view's width
  let fpHand = false, fpRoom = false, roomWas = null, fpEye = FIRST.eye, fpY = null, fovBase = null, farBase = null;
  const _o = new THREE.Vector3();
  // (any doorway or see-through window of building o in view, or the eyes in a doorway: world/objects/codebuildings.js o.q)
  function openingSeen(o) {
    const q = o && o.q, I = FIRST.indoor; if (!q) return true;
    camera.updateMatrixWorld();
    for (let i = 0; i < q.doors.length; i += 2) {
      if (Math.hypot(camera.position.x - q.doors[i], camera.position.z - q.doors[i + 1]) < I.doorway) return true;
      _o.set(q.doors[i], q.y + 1.2, q.doors[i + 1]).project(camera); if (_o.z < 1 && Math.abs(_o.x) < I.margin && Math.abs(_o.y) < I.margin) return true;
    }
    for (const w of q.wins) { _o.set(w.x, w.y, w.z).project(camera); if (_o.z < 1 && Math.abs(_o.x) < I.margin && Math.abs(_o.y) < I.margin) return true; }
    return false;
  }
  function farTo(f) { if (Math.abs(camera.far - f) > 1e-3) { camera.far = f; camera.updateProjectionMatrix(); } }
  const eyeP = new THREE.Vector3(), eyeQ = new THREE.Quaternion(), chaseQ = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
  const smooth = (t) => t * t * (3 - 2 * t);
  C.setFirst = (on) => { fpHand = !!on; if (!on) fpRoom = false; C.first = fpHand || fpRoom; if (!on) C.zoom = Math.max(C.zoom, CAM.zoomMin); };
  function fovTo(f) { if (Math.abs(camera.fov - f) > 1e-3) { camera.fov = f; camera.updateProjectionMatrix(); } }
  let lastDragAt = -1e9, lastHeading = 0;
  const lastAim = new THREE.Vector3();                               // (where the focus was making for last frame)
  C.snap = () => { C.started = false; };
  // moved with the player, as it stands (the way round at the valley's ends): every point it keeps, by the same
  C.shift = (dx, dy, dz) => { for (const v of [focus, want, pos, lastAim]) { v.x += dx; v.y += dy; v.z += dz; } camera.position.x += dx; camera.position.y += dy; camera.position.z += dz; camera.updateMatrixWorld(); };
  // how much of the way back the view would get at this yaw before a building's wall (1: all of it)
  function clearFor(yaw) {
    const d = C.dist * C.zoom, cp = Math.cos(C.pitch), sp = Math.sin(C.pitch);
    const wx = focus.x - Math.sin(yaw) * cp * d, wy = focus.y + sp * d, wz = focus.z - Math.cos(yaw) * cp * d;
    for (let i = 1; i <= 10; i++) {
      const f = i / 10;
      if (inBuilding(focus.x + (wx - focus.x) * f, focus.y + (wy - focus.y) * f, focus.z + (wz - focus.z) * f)) return f - 0.1;
    }
    return 1;
  }
  let swung = false;
  // back round behind the player once they are moving and the view has been left alone for a moment
  function swingBack(dt, heading, onHorse, speed) {
    const turned = lastHeading + wrap(heading - lastHeading);        // (the heading carried on past a half turn: no jump)
    const idle = (performance.now() - lastDragAt) / 1000 > CAM.swingAfter;
    if (idle && speed > 0.6) {
      const k = (onHorse ? CAM.swingHorse : CAM.swing) * Math.min(1, speed / 3);
      C.yaw = chase(lastHeading + wrap(C.yaw - lastHeading), lastHeading, turned, k, dt);   // (all three on one side of the half turn)
      C.pitch = damp(C.pitch, onHorse ? CAM.horsePitch : CAM.pitch, k * 0.5, dt);
    }
    C.yaw = wrap(C.yaw); lastHeading = heading;
  }
  C.swing = (dt, { heading = 0, onHorse = false, speed = 0 }) => {
    if (!C.enabled || !C.started || C.first) return;
    swingBack(Math.min(dt, 0.1), heading, onHorse, speed); swung = true;
  };
  C.update = (dt, { at, heading = 0, onHorse = false, speed = 0, seat = null }) => {
    dt = Math.min(dt, 0.1);
    W.camTarget.copy(at);
    // (a close-up has the camera: out of first person at once, the view's width as it was)
    if (!C.enabled) { if (C.fp > 0 || fovBase != null) { C.fp = 0; if (fovBase != null) fovTo(fovBase); fovBase = null; } if (farBase != null) { farTo(farBase); farBase = null; } return; }
    room = W.codeRoom ? W.codeRoom(at.x, at.y + 1, at.z) : null;
    // (walked in through the door of one of FIRST.rooms: first person; walked out: back, unless zoomed in by hand)
    const ins = !onHorse && W.codeIndoors ? W.codeIndoors(at.x, at.y + 1, at.z) : null, here = ins && ins.it && FIRST.rooms.includes(ins.it.kind) ? ins : null;
    if (here !== roomWas) { fpRoom = !!here; roomWas = here; }
    // what the player did: dragged to look, or the wheel (on in past the nearest point: first person; out: back)
    if (input && input.enabled) {
      const l = input.takeLook();
      if (l.dx || l.dy) { C.yaw -= l.dx * CAM.turn; C.pitch = Math.max(CAM.pitchMin, Math.min(CAM.pitchMax, C.pitch + l.dy * CAM.tilt)); lastDragAt = performance.now(); }
      const z = input.takeZoom();
      if (z < 0 && (C.first || C.zoom <= CAM.zoomMin * 1.001)) fpHand = true;
      else if (z > 0 && C.first) { fpHand = false; fpRoom = false; C.zoom = CAM.zoomMin; }
      else if (z) C.zoom = Math.max(CAM.zoomMin, Math.min(CAM.zoomMax, C.zoom * Math.pow(1.12, z)));
      if (input.lookedAt > lastDragAt) lastDragAt = input.lookedAt;
    }
    C.first = fpHand || fpRoom;
    const baseDist = onHorse ? CAM.horseDist : CAM.dist, eye = onHorse ? CAM.horseEye + (seat > 0 ? seat - CAM.horseSeat : 0) : CAM.eye;
    if (!C.started) {                                                // (the first frame, or after snap(): straight behind)
      C.started = true; C.yaw = heading; C.pitch = onHorse ? CAM.horsePitch : CAM.pitch; C.dist = baseDist; C.eye = eye; C.reach = 1;
      focus.set(at.x, at.y + eye, at.z); lastAim.copy(focus); lastHeading = heading;
      // straight behind runs into a building (stepping out of a door, or away from the store's counter): stand off to
      // the side instead, the nearest way round that is clear, so the view starts at its usual distance and not tight
      // on the player's back. It swings round behind once they walk on.
      if (clearFor(C.yaw) < 0.8) {
        for (const off of [0.6, -0.6, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
          if (clearFor(heading + off) >= 0.8) { C.yaw = wrap(heading + off); lastDragAt = performance.now(); break; }
        }
      }
    }
    if (!swung && !C.first) swingBack(dt, heading, onHorse, speed);   // (first person: it stays where it is looked)
    if (C.first) lastHeading = heading;
    swung = false;
    C.dist = damp(C.dist, baseDist, 3, dt); C.eye = damp(C.eye, eye, 4, dt);
    // the point it looks at: the player's head, followed closely sideways and more gently up and down
    const aimY = at.y + C.eye;
    if (focus.distanceToSquared(at) > 400) { focus.set(at.x, aimY, at.z); lastAim.copy(focus); }   // (a jump: no long glide across the valley)
    focus.x = chase(focus.x, lastAim.x, at.x, CAM.follow, dt); focus.z = chase(focus.z, lastAim.z, at.z, CAM.follow, dt);
    focus.y = chase(focus.y, lastAim.y, aimY, CAM.rise, dt);
    lastAim.set(at.x, aimY, at.z);
    // where it would stand: back along the yaw, up by the pitch
    const d = C.dist * C.zoom, cp = Math.cos(C.pitch), sp = Math.sin(C.pitch);
    want.set(focus.x - Math.sin(C.yaw) * cp * d, focus.y + sp * d, focus.z - Math.cos(C.yaw) * cp * d);
    // not inside a building: in closer, to just before the first wall along the way (comes in at once, eases out)
    let reach = 1;
    for (let i = 1; i <= 10; i++) {
      const f = i / 10, x = focus.x + (want.x - focus.x) * f, y = focus.y + (want.y - focus.y) * f, z = focus.z + (want.z - focus.z) * f;
      if (inBuilding(x, y, z)) { reach = Math.max(0.12, f - 0.12); break; }
    }
    C.reach = reach < C.reach ? reach : damp(C.reach, reach, 2.5, dt);
    want.lerpVectors(focus, want, C.reach);
    // never under the ground, nor looking through a hill: high enough that the line to the player clears the ground
    let y = Math.max(want.y, W.heightAt(want.x, want.z) + CAM.clear);
    for (const f of [0.25, 0.5, 0.75]) {
      const gx = focus.x + (want.x - focus.x) * f, gz = focus.z + (want.z - focus.z) * f, g = W.heightAt(gx, gz) + CAM.clear * 0.6;
      const lineY = focus.y + (y - focus.y) * f;
      if (lineY < g) y = focus.y + (g - focus.y) / f;
    }
    want.y = y;
    pos.copy(want);
    camera.position.copy(pos);
    camera.lookAt(focus);
    // FIRST PERSON: from the chase camera's pose to the rider's eyes (and its wider view), eased in and out
    C.fp = Math.max(0, Math.min(1, C.fp + (C.first ? 1 : -1) * dt / FIRST.ease));
    const eyeH = onHorse ? (seat > 0 ? seat : CAM.horseSeat) + FIRST.horseEye : FIRST.eye;
    fpEye = damp(fpEye, eyeH, 4, dt);
    fpY = fpY == null || Math.abs(fpY - (at.y + fpEye)) > 3 ? at.y + fpEye : damp(fpY, at.y + fpEye, FIRST.rise, dt);
    if (C.fp > 0) {
      if (fovBase == null) fovBase = camera.fov;
      const k = smooth(C.fp), base = onHorse ? CAM.horsePitch : CAM.pitch;
      chaseQ.copy(camera.quaternion);
      eyeP.set(at.x, fpY, at.z);
      eul.set(Math.max(-1.25, Math.min(1.25, (base - C.pitch) * FIRST.pitch)), C.yaw + Math.PI, 0, 'YXZ'); eyeQ.setFromEuler(eul);
      camera.position.lerpVectors(pos, eyeP, k); camera.quaternion.slerpQuaternions(chaseQ, eyeQ, k);
      fovTo(fovBase + (FIRST.fov - fovBase) * k);
    } else if (fovBase != null) { fovTo(fovBase); fovBase = null; }
    camera.updateMatrixWorld();
    // (in first person inside a building, no way out of it in view: the valley beyond its walls left undrawn)
    const shut = C.fp > 0.95 && ins && !(ins.it && ins.it.kind === 'cabin') && !openingSeen(ins);   // (the player's cabin does its own)
    if (shut) { if (farBase == null) farBase = camera.far; farTo(Math.min(farBase, FIRST.indoor.far)); }
    else if (farBase != null) { farTo(farBase); farBase = null; }
  };
  return C;
}
