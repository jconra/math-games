// AIMING A GUN BY HAND at the bandits (src/gun.js, the crosshair of src/sixgun.js makeSights): with a mouse, the crosshair
// follows the pointer (and drifts a little, less the steadier the gun), and the rider whose body or number card it is
// on is the one a shot goes to. The catch is generous (GUNS.aimPx): a kid's game, the numbers are the hard part. With a
// finger there is no crosshair till a tap: the tap is the aim.
//   const A = makeGunAim({ canvas, camera, W })
//   A.update(dt, { on, gun, targets, points, player, screen })   each frame: on: a gun is up here; gun: its numbers (GUNS);
//        targets: the riders that can be shot; points(t, out[]): where each shows, world positions (hat, body, horse, card)
//   A.target           the one under the crosshair now, or null        A.inReach    that one is within the gun's reach
//   A.at               where the crosshair is { x, y } in page pixels, or null (no mouse over the view)
//   A.pickAt(x, y, gun, targets, points, player)  the one at a page point, or null (a tap)
//   A.groundAt(x, y, reach, out)  where a shot aimed at a page point lands on the ground (a miss), within reach
//   A.dispose()
import * as THREE from 'three';
import { makeSights } from '../sixgun.js';
import { aimSway } from '../gun.js';

export function makeGunAim({ canvas, camera, W }) {
  let sights = null, mouse = null, time = 0;
  const A = { target: null, inReach: false, at: null, dist: 0 };
  const move = (e) => { if (e.pointerType && e.pointerType !== 'mouse') return; mouse = { x: e.clientX, y: e.clientY }; };
  const leave = () => { mouse = null; };
  addEventListener('pointermove', move, true);
  document.addEventListener('mouseleave', leave);
  const v = new THREE.Vector3(), pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const r = () => canvas.getBoundingClientRect();
  function find(x, y, gun, targets, points, player) {
    const c = r(); let best = null, bd = Infinity;
    const px = player.position || player;
    for (const t of targets) {
      const n = points(t, pts);
      for (let i = 0; i < n; i++) {
        v.copy(pts[i]).project(camera); if (v.z > 1) continue;
        const d = Math.hypot(c.left + (v.x + 1) / 2 * c.width - x, c.top + (1 - v.y) / 2 * c.height - y);
        if (d < bd) { bd = d; best = t; A.dist = Math.hypot(pts[i].x - px.x, pts[i].z - px.z); }
      }
    }
    return bd > gun.aimPx ? null : best;
  }
  A.pickAt = find;
  A.update = (dt, { on, gun, targets = [], points, player }) => {
    time += dt;
    if (!on || !gun || !mouse) {
      A.target = null; A.inReach = false; A.at = on ? mouse : null;
      if (sights) sights.place(null);
      canvas.style.cursor = '';
      return;
    }
    const s = aimSway(time, gun);
    A.at = { x: mouse.x + s.x, y: mouse.y + s.y };
    A.target = find(A.at.x, A.at.y, gun, targets, points, player);
    A.inReach = !!A.target && A.dist <= gun.reach;
    if (!sights) sights = makeSights();
    sights.place(A.at, A.inReach);
    canvas.style.cursor = 'none';
  };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  A.groundAt = (x, y, reach, out = new THREE.Vector3()) => {
    const c = r();
    ndc.set((x - c.left) / c.width * 2 - 1, 1 - (y - c.top) / c.height * 2);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    let last = 8;
    for (let k = 8; k < reach + 20; k += 2) { last = k; if (o.y + d.y * k <= W.heightAt(o.x + d.x * k, o.z + d.z * k)) break; }
    out.set(o.x + d.x * last, 0, o.z + d.z * last); out.y = W.heightAt(out.x, out.z);
    return out;
  };
  A.dispose = () => { removeEventListener('pointermove', move, true); document.removeEventListener('mouseleave', leave); if (sights) { sights.dispose(); sights = null; } canvas.style.cursor = ''; };
  return A;
}
