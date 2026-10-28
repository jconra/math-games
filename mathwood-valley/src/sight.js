// IN SIGHT? The test the governor's people dials keep to (world/governor.js; Dad: "things taken away should only be
// behind the player or occluded, and things added should be from a node like a door or the road out of sight"), in the
// style of the townsfolk's own (src/townpeople.js seen): a spot is SEEN when it is inside the camera's view (with a
// margin round it), not hidden behind a building or a rise of the land on the way from the camera, and nearer than
// `far` metres (TOWN.seenFar: past that a person is a few pixels tall, which counts as out of sight).
//
//   const S = makeSight({ W, camera, far, pad })
//   S.view()                  once a frame (the camera's view as it is now)
//   S.seen(x, z, y?, r?, reach?)   true when a thing standing there (y: its feet, the ground by default; r: its margin, m)
//                             can be seen (reach: how far counts, instead of `far`: the far figures' own reach, for
//                             what comes onto or leaves the road among them); deep in the end mist nothing is seen
//   S.unseen(x, z, y?, r?)    the opposite
import * as THREE from 'three';
import { TOWN } from './townpeopleplan.js';

export function makeSight({ W, camera, far = TOWN.seenFar, pad = TOWN.seenPad }) {
  const fr = new THREE.Frustum(), M = new THREE.Matrix4(), S = new THREE.Sphere();
  let B = null;
  const boxes = () => B || (B = ((W.places && W.places.buildings) || []).filter((b) => b && b.w).map((b) => ({ x: b.x, z: b.z, c: Math.cos(b.rot), s: Math.sin(b.rot), hw: b.w / 2 - 0.3, hd: b.d / 2 - 0.3, y: W.heightAt(b.x, b.z) + (b.h || 6) * 0.8 })));
  let frame = -1;
  const view = () => { camera.updateMatrixWorld(); M.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(M); frame = performance.now(); };
  // the line from the camera to (x, y, z) through a building's box (most of its height)
  function building(x, y, z) {
    const c = camera.position;
    for (const b of boxes()) {
      const ax = b.c * (c.x - b.x) - b.s * (c.z - b.z), az = b.s * (c.x - b.x) + b.c * (c.z - b.z), bx = b.c * (x - b.x) - b.s * (z - b.z), bz = b.s * (x - b.x) + b.c * (z - b.z);
      let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
      for (const [p, d, h] of [[ax, dx, b.hw], [az, dz, b.hd]]) { if (Math.abs(d) < 1e-9) { if (Math.abs(p) > h) { t0 = 2; break; } continue; } let u = (-h - p) / d, v = (h - p) / d; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); }
      if (t0 < t1) { const ym = c.y + (y - c.y) * (t0 + t1) / 2; if (ym < b.y) return true; }
    }
    return false;
  }
  // ... or through the land (a rise between): the ground looked at every few metres along the way
  function land(x, y, z) {
    const c = camera.position, d = Math.hypot(x - c.x, z - c.z), n = Math.min(24, Math.max(3, Math.ceil(d / 8)));
    for (let i = 1; i < n; i++) { const t = i / n, px = c.x + (x - c.x) * t, pz = c.z + (z - c.z) * t; if (W.heightAt(px, pz) > c.y + (y - c.y) * t + 0.2) return true; }
    return false;
  }
  function seen(x, z, y = W.heightAt(x, z), r = pad, reach = far) {
    if (performance.now() - frame > 8) view();   // (not looked at yet this frame)
    const c = camera.position, d = Math.hypot(x - c.x, z - c.z);
    if (d > reach) return false;
    if (W.fogAt && W.fogAt(x, z) > 0.92) return false;   // (deep in the mist at the valley's ends)
    S.center.set(x, y + 0.9, z); S.radius = r;
    if (!fr.intersectsSphere(S)) return false;
    if (d > 6 && (building(x, y + 1.85, z) && building(x, y + 0.2, z))) return false;
    if (d > 12 && land(x, y + 1.6, z)) return false;
    return true;
  }
  return { view, seen, unseen: (x, z, y, r, reach) => !seen(x, z, y, r, reach), far };
}
