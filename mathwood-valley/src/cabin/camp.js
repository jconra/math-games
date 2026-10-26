// THE RIDER'S CAMP BY THE CREEK, before the cabin is bought: a bedroll laid out on the grass, a small fire in a ring of
// stones (the camps' flame: src/fire/campfire.js), a log to sit on and a saddlebag, on the open bank between the cabin
// and the creek behind it. The rider's dogs that aren't out with them wait here (cabin.js puts them by the fire). Once
// the cabin is bought the camp is packed up the next time it is out of sight (cabin.js), so it never vanishes in view.
//
// Where: the first spot, looking out from the cabin's back toward the creek, that is open ground (nothing blocks a
// walker within a couple of metres, no water under it, not steep) with the creek's water a few metres off. Worked out
// from the land each ride, the same every time (CAMP.look is the order the spots are tried in).
//
//   const K = makeCamp({ W, camera, audio, frame })   frame: the cabin's frame { x, z, rot } (W.places.cabin)
//   K.spot           { x, z, rot } the fire's middle in the valley (rot: the way the bedroll's head points)
//   K.dogSpots(n)    where n dogs lie by the fire: [{ x, y, z, rot }]
//   K.update(dt, t)  the flame
//   K.dispose()
import * as THREE from 'three';
import { makeCampfire } from '../fire/campfire.js';

export const CAMP = {
  // the spots tried, in the cabin's own frame (x across, z out of its front: the creek is behind it, off to the right
  // as you face the door from inside), nearest the cabin first
  look: { x: [13, 44], z: [-12, -44], step: 2 },   // (x from 13: clear of the yard's pig pen, homestead.js YARD)
  clear: 2.4,          // m round the fire with nothing that blocks a walker
  creek: [3.5, 10],    // m to the creek's water: at least, at most
  dry: 0.05,           // waterAt under the camp and round it must be under this
  fire: { width: 0.55, ring: 0.48 },
  mow: 3.2, mowFade: 1.6, // m: the meadow round the camp is mown this far (fading back in over mowFade), as round the camps
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// the spot: open ground with the creek close by (the cabin's frame -> the valley's)
export function campSpot(W, frame) {
  const c = Math.cos(frame.rot), s = Math.sin(frame.rot);
  const at = (lx, lz) => ({ x: frame.x + c * lx + s * lz, z: frame.z - s * lx + c * lz });
  const L = CAMP.look, cands = [];
  for (let lz = L.z[0]; lz >= L.z[1]; lz -= L.step) for (let lx = L.x[0]; lx <= L.x[1]; lx += L.step) cands.push([lx, lz]);
  cands.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  const ring = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]];
  for (const [lx, lz] of cands) {
    const p = at(lx, lz);
    if (W.blocked(p.x, p.z) || W.waterAt(p.x, p.z) > CAMP.dry) continue;
    let ok = true;
    for (const [dx, dz] of ring) for (const r of [1.2, CAMP.clear]) { const x = p.x + dx * r, z = p.z + dz * r; if (W.blocked(x, z) || W.waterAt(x, z) > CAMP.dry) ok = false; }
    if (!ok) continue;
    // the creek a few metres off, and the ground about level
    let wet = null;
    for (let r = CAMP.creek[0]; r <= CAMP.creek[1] && !wet; r += 0.5) for (const [dx, dz] of ring) { const x = p.x + dx * r, z = p.z + dz * r; if (W.waterAt(x, z) > 0.3) { wet = { x, z }; break; } }
    if (!wet) continue;
    const h = W.heightAt(p.x, p.z), steep = ring.some(([dx, dz]) => Math.abs(W.heightAt(p.x + dx * 1.5, p.z + dz * 1.5) - h) > 0.45);
    if (steep) continue;
    // the bedroll's head away from the water
    return { x: p.x, z: p.z, rot: Math.atan2(p.x - wet.x, p.z - wet.z), local: { x: lx, z: lz } };
  }
  const p = at(L.x[0], L.z[0]); return { x: p.x, z: p.z, rot: frame.rot + Math.PI, local: { x: L.x[0], z: L.z[0] } };
}

// the ground's plants mown round a spot (the town's yard map, which the meadow's plants read; the plants remembered
// there are forgotten, so they are laid again from it). -> a function that puts the old values back
function mow(W, at) {
  const V = W.V, T = V && V.TOWN;
  if (!T || !T.yard || !V.N || !V.TEX) return () => {};
  const N = V.N, TEX = V.TEX, SIZE = V.SIZE, old = new Map(), R = CAMP.mow + CAMP.mowFade + TEX;
  for (let j = Math.max(0, Math.floor((at.z - R + SIZE / 2) / TEX)); j <= Math.min(N - 1, Math.ceil((at.z + R + SIZE / 2) / TEX)); j++)
    for (let i = Math.max(0, Math.floor((at.x - R + SIZE / 2) / TEX)); i <= Math.min(N - 1, Math.ceil((at.x + R + SIZE / 2) / TEX)); i++) {
      const d = Math.hypot((i + 0.5) * TEX - SIZE / 2 - at.x, (j + 0.5) * TEX - SIZE / 2 - at.z);
      const t = Math.min(1, Math.max(0, (d - CAMP.mow) / CAMP.mowFade)), v = 1 - t * t * (3 - 2 * t);
      const k = j * N + i; if (v > T.yard[k]) { if (!old.has(k)) old.set(k, T.yard[k]); T.yard[k] = v; }
    }
  const forget = () => { const c = V.COVER && V.COVER.cache; if (c && c.tiles) c.tiles.clear(); };
  forget();
  return () => { for (const [k, v] of old) T.yard[k] = v; forget(); };
}

export function makeCamp({ W, camera, audio = null, frame, scene = W.scene }) {
  const spot = campSpot(W, frame);
  const grp = new THREE.Group(); grp.name = 'rider-camp';
  const y0 = W.heightAt(spot.x, spot.z);
  grp.position.set(spot.x, y0, spot.z); grp.rotation.y = spot.rot; scene.add(grp);
  const pics = [];
  // in the camp's own frame: the fire at the middle, +z toward the bedroll's head (away from the water)
  const place = (o, x, z, { up = 0, turn = 0 } = {}) => {
    const c = Math.cos(spot.rot), s = Math.sin(spot.rot), wx = spot.x + c * x + s * z, wz = spot.z - s * x + c * z;
    o.position.set(x, W.heightAt(wx, wz) - y0 + up, z); o.rotation.y = turn; o.castShadow = o.receiveShadow = true; grp.add(o); return o;
  };
  // the ring of stones round the fire, and the burnt logs in it
  const stone = std(0x77736c), char = std(0x2a211a), log = std(0x6b4a2e);
  const sg = new THREE.DodecahedronGeometry(0.11, 0);
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, m = new THREE.Mesh(sg, stone); m.scale.set(1 + (i % 3) * 0.15, 0.7, 1 - (i % 2) * 0.15); place(m, Math.cos(a) * CAMP.fire.ring, Math.sin(a) * CAMP.fire.ring, { up: 0.04, turn: a * 2 }); }
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.6, 7).rotateZ(Math.PI / 2), char); m.rotation.set(0, i * 2.1, 0.12); place(m, 0, 0, { up: 0.06 + i * 0.03, turn: i * 2.1 }); }
  // the bedroll: a wool blanket laid out (a red and cream plaid), its rolled-up head and a rolled ground cloth
  const plaid = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#8e2f26'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(230, 210, 170, 0.55)'; for (let k = 0; k < 4; k++) { x.fillRect(k * 32 + 10, 0, 6, h); x.fillRect(0, k * 32 + 10, w, 6); }
    x.fillStyle = 'rgba(30, 20, 15, 0.35)'; for (let k = 0; k < 4; k++) { x.fillRect(k * 32 + 22, 0, 3, h); x.fillRect(0, k * 32 + 22, w, 3); }
  }); plaid.wrapS = plaid.wrapT = THREE.RepeatWrapping; plaid.repeat.set(2, 3); pics.push(plaid);
  const blanket = std(0xffffff, { map: plaid });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 1.9), [blanket, blanket, blanket, blanket, blanket, blanket]);
  place(bed, 0.35, 1.75, { up: 0.025, turn: 0.08 });
  const canvas = std(0xb3a27c);
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.78, 12).rotateZ(Math.PI / 2), blanket), 0.42, 2.72, { up: 0.13, turn: 0.08 });   // (the rolled head: a pillow)
  place(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.02, 2.05), canvas), 0.36, 1.78, { up: 0.01, turn: 0.08 });                                // (the ground cloth under it)
  // a log to sit on, on the far side of the fire, and a saddlebag leaning on it
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 1.3, 9).rotateZ(Math.PI / 2), log), -0.2, -1.25, { up: 0.17, turn: -0.3 });
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.14), std(0x5e3a1f, { roughness: 0.7 })); bag.rotation.x = -0.25;
  const bagHolder = new THREE.Group(); bagHolder.add(bag); bag.position.y = 0.15; place(bagHolder, 0.75, -1.05, { turn: -0.3 });
  // a coffee pot by the fire
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.18, 10), std(0x3c4a52, { roughness: 0.4, metalness: 0.5 })), 0.62, 0.3, { up: 0.09 });
  grp.updateMatrixWorld(true);
  // the meadow round it mown, as round the valley's camps (src/camps.js): the old values come back when the camp goes
  const unmow = mow(W, spot);
  // the flame
  const fire = makeCampfire({ W, scene, camera, x: spot.x, z: spot.z, y: y0 + 0.05, width: CAMP.fire.width, audio, id: 'campfire-rider' });
  const K = {
    spot, group: grp, fire,
    // dogs lie by the fire: on the bedroll's side, and across from it (the camp's frame -> the valley's)
    dogSpots(n) {
      const P = [[1.25, 0.6, 2.4], [-1.15, 0.5, -1.0], [-1.0, -0.9, 0.7]], c = Math.cos(spot.rot), s = Math.sin(spot.rot);
      return P.slice(0, Math.max(0, n)).map(([x, z, turn]) => { const wx = spot.x + c * x + s * z, wz = spot.z - s * x + c * z; return { x: wx, y: W.heightAt(wx, wz), z: wz, rot: spot.rot + turn }; });
    },
    update(dt, t) { fire.update(dt, t); },
    dispose() {
      fire.dispose(); unmow();
      const mats = new Set(), geos = new Set();
      grp.traverse((o) => { if (o.geometry) geos.add(o.geometry); if (o.material) for (const m of [].concat(o.material)) mats.add(m); });
      for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const p of pics) p.dispose();
      grp.removeFromParent();
    },
  };
  return K;
}
