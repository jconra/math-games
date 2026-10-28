// THE FARM: a settler's farm on open ground north of the town (W.places.farm, behind the cabin), where the farm jobs
// happen. A barn at the back, a wind pump beside it (its wheel turns, and it is tall enough to be seen from the town
// square), and three fenced spots either side of a lane that runs from the front of the farm (the side facing the town)
// up to the barn doors:
//   the sheep pasture (left of the lane, as you ride in): the flock grazes here; the sick-sheep job (missions/sheep.js)
//   the paddock (right, at the front): a few farm-pack cows and a horse, idling and pottering about
//   the pig yard (right, at the back, beside the barn): a yard with two pens along its back fence, each with a
//     gap for a gate in its front. The pens are left EMPTY: they are for the loose-pigs job
// Everything is laid out in the farm's own frame (metres; x across the front, z toward the town, so the lane runs along
// +z) and turned into the world by the farm's place; farmLayout(place) gives every spot in world coordinates without
// making anything, so a job can find the pens and gates on its own.
//
// The farm builds nothing of its own to look at but its fences (the town's fences: posts and two rails, the same
// material, two draws). The barn and the wind pump are the town's code-built kinds (labs/buildings/barn.js,
// windpump.js), the troughs the town's trough, the hay its stack of bales and haystack (world/objects/townProps.js):
// farmItems(place) lists them as layout items and the game puts them into the town's layout as the valley is made
// (src/world.js), so they are built once, drawn, levelled and walked round as the town's own are (the barn's big doors
// open with E, its inside comes in on approach). The fences block walkers here (W.addBlocker), so the player, the horse
// and the animals go round them and in through the gates.
//
//   const F = makeFarm({ W, animals, scene })   animals: the animal library (src/actors/animals.js); the farm-pack cow
//                                                 and horse are loaded here (lib.need) if they aren't yet
//   F.layout          farmLayout(W.places.farm) (src/farmplan.js)
//   F.ready           a promise: the paddock animals are in
//   F.update(dt, at)  each frame: at = the player's position (the animals only move within FARM.awake metres of it)
//   F.blocked(x, z)   true where the farm's fences block (also in W.blocked)
//   F.state()         for rigs
//   F.dispose()
//
// The farm's layout (FARM, farmLayout, farmItems): src/farmplan.js, plain data the node tests read (re-exported here)
import * as THREE from 'three';
import { makeAnimal, COATS } from './actors/animals.js';
import { FARM, farmLayout, fenceLines } from './farmplan.js';
export { FARM, farmLayout, farmItems } from './farmplan.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ── MAKING THE FARM ──────────────────────────────────────────────────────────────────────────────────────────────
export function makeFarm({ W, animals = null, scene = W.scene }) {
  const L = farmLayout(W.places.farm);
  const ground = (lx, lz) => { const p = L.at(lx, lz); return W.heightAt(p.x, p.z); };
  const root = new THREE.Group(); root.name = 'farm';
  root.position.set(L.x, 0, L.z); root.rotation.y = L.rot;
  scene.add(root);
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  // the town's fences' own material (the hill's shade and the street lamps' light in it), when there are any
  const fm = W.V && W.V.FENCE && W.V.FENCE.mat;

  // THE FENCES: the town's look (posts about every 2.2 m, two rails), standing on the land
  const lines = fenceLines(), posts = [], rails = [];
  const F = FARM.fence;
  for (const [a, b] of lines) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / F.gap));
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const lx = a[0] + (b[0] - a[0]) * i / n, lz = a[1] + (b[1] - a[1]) * i / n, p = [lx, ground(lx, lz), lz];
      posts.push(p); if (prev) rails.push([prev, p]); prev = p;
    }
  }
  const fmat = fm || new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.92 });
  const postG = new THREE.BoxGeometry(0.14, 1, 0.14).translate(0, 0.5, 0), railG = new THREE.BoxGeometry(1, 0.08, 0.06).translate(0.5, 0, 0);
  const pm = new THREE.InstancedMesh(postG, fmat, posts.length), rm = new THREE.InstancedMesh(railG, fmat, rails.length * 2);
  {
    const Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), Yv = new THREE.Vector3(0, 1, 0), Xv = new THREE.Vector3(1, 0, 0), c = new THREE.Color(), dir = new THREE.Vector3();
    const h01 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
    posts.forEach((p, i) => { const r = h01(p[0], p[2]); pm.setMatrixAt(i, Mx.compose(new THREE.Vector3(p[0], p[1] - 0.08, p[2]), Q.setFromAxisAngle(Yv, r * 6.28), new THREE.Vector3(1, F.h + 0.08 + r * 0.1, 1))); pm.setColorAt(i, c.setScalar(0.8 + 0.35 * r)); });
    rails.forEach(([p, q], i) => {
      dir.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]); const len = dir.length(); dir.normalize(); Q.setFromUnitVectors(Xv, dir);
      for (const [k, f] of [[0, 0.42], [1, 0.82]]) { rm.setMatrixAt(i * 2 + k, Mx.compose(new THREE.Vector3(p[0], p[1] + F.h * f, p[2]), Q, new THREE.Vector3(len, 1, 1))); rm.setColorAt(i * 2 + k, c.setScalar(0.85 + 0.3 * h01(p[0] + k, p[2]))); }
    });
  }
  for (const m of [pm, rm]) { m.castShadow = m.receiveShadow = shadows; m.name = 'farm-fences'; root.add(m); }

  // ── WHAT BLOCKS (in the farm's frame): the fences (the barn, the wind pump, the troughs and the hay are the town's
  // own and block as its own do: W.blocked) ─────────────────────────────────────────────────────────────────────────
  const segs = lines.map(([a, b]) => [a[0], a[1], b[0], b[1]]);
  const reach = Math.hypot(L.w, L.d) / 2 + 4;
  function blockedLocal(lx, lz) {
    const r2 = F.half * F.half;
    for (const [ax, az, bx, bz] of segs) {
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1e-9, t = Math.max(0, Math.min(1, ((lx - ax) * vx + (lz - az) * vz) / l2));
      const dx = ax + vx * t - lx, dz = az + vz * t - lz; if (dx * dx + dz * dz < r2) return true;
    }
    return false;
  }
  const blocked = (x, z) => { if (Math.abs(x - L.x) > reach || Math.abs(z - L.z) > reach) return false; const p = L.local(x, z); return blockedLocal(p.x, p.z); };
  const offBlock = W.addBlocker ? W.addBlocker(blocked) : () => {};

  // ── THE GROUND: mown, as the town's yards are (the valley's TOWN.yard: lawn, no tall meadow), so the sheep and the
  // pens aren't lost in grass taller than a sheep; fading back to the meadow over FARM.mowFade metres outside. The plants
  // round the player are laid again from it as the player moves (their remembered tiles are let go); the old values come
  // back on dispose
  const unmow = mow();
  const unlawn = potatoLawn();
  // On the potato tier the ground has no pictures, only each layer's average colour, and its meadow is darkened by the
  // plants on it: mown, the farm showed one flat, bright lime green. There a thin sheet laid over the farm's ground gives
  // it the meadow's darker green, mottled a little, fading out at its edge.
  function potatoLawn() {
    if (W.tier !== 'potato') return () => {};
    const fade = FARM.mowFade, hw = L.w / 2 + fade, hd = L.d / 2 + fade, step = 2;
    const nx = Math.ceil(hw * 2 / step), nz = Math.ceil(hd * 2 / step);
    // (none of it under the barn: its own floor is there, and the sheet, laid over the ground, covered it)
    const B = FARM.barn, bw = B.w / 2 + 0.6, bd = B.d / 2 + 0.6;
    const barn = (lx, lz) => Math.min(1, Math.max(0, Math.max(Math.abs(lx - B.x) - bw, Math.abs(lz - B.z) - bd) / step));
    const pos = [], col = [], idx = [];
    const noise = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.31 + Math.sin(z * 0.17) * 2.1) * Math.cos(z * 0.27 - x * 0.06) + 0.25 * Math.sin(x * 0.9 + z * 0.7);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const lx = -hw + i * hw * 2 / nx, lz = -hd + j * hd * 2 / nz, p = L.at(lx, lz);
      pos.push(lx, W.heightAt(p.x, p.z) + 0.06, lz);
      const out = Math.max(0, Math.abs(lx) - L.w / 2, Math.abs(lz) - L.d / 2) / fade, a = 1 - Math.min(1, out), n = noise(p.x, p.z);
      // (meadow greens, from the darker to the lighter)
      col.push(0.20 + 0.06 * n, 0.30 + 0.07 * n, 0.11 + 0.03 * n, a * a * (3 - 2 * a) * 0.8 * barn(lx, lz));
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * (nx + 1) + i; idx.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const sheet = new THREE.Mesh(g, m); sheet.name = 'farm-lawn'; sheet.renderOrder = 1; sheet.receiveShadow = false;
    // (laid out in the farm's own frame, but the heights were read in the world's: the sheet sits in the scene, turned)
    sheet.position.set(L.x, 0, L.z); sheet.rotation.y = L.rot;
    scene.add(sheet);
    return () => { sheet.removeFromParent(); g.dispose(); m.dispose(); };
  }
  function mow() {
    const V = W.V, T = V && V.TOWN;
    if (!T || !T.yard || !V.N || !V.TEX) return () => {};
    const N = V.N, TEX = V.TEX, SIZE = V.SIZE, hw = L.w / 2, hd = L.d / 2, fade = FARM.mowFade, R = Math.hypot(hw, hd) + fade + TEX;
    const old = new Map();
    for (let j = Math.max(0, Math.floor((L.z - R + SIZE / 2) / TEX)); j <= Math.min(N - 1, Math.ceil((L.z + R + SIZE / 2) / TEX)); j++)
      for (let i = Math.max(0, Math.floor((L.x - R + SIZE / 2) / TEX)); i <= Math.min(N - 1, Math.ceil((L.x + R + SIZE / 2) / TEX)); i++) {
        const p = L.local((i + 0.5) * TEX - SIZE / 2, (j + 0.5) * TEX - SIZE / 2);
        const out = Math.hypot(Math.max(0, Math.abs(p.x) - hw), Math.max(0, Math.abs(p.z) - hd)), t = Math.min(1, out / fade), y = 1 - t * t * (3 - 2 * t);
        const k = j * N + i; if (y > T.yard[k]) { old.set(k, T.yard[k]); T.yard[k] = y; }
      }
    // (the plants' and the lawn's remembered tiles both go, and the lawn is laid again at once: a lawn tile remembered
    // from before the mowing kept its meadow tufts, a wild stand's person-tall ones too, standing in the pens)
    const forget = () => {
      const c = V.COVER && V.COVER.cache; if (c && c.tiles) c.tiles.clear();
      const g = V.LAWN_GO; if (g && g.cache && g.cache.tiles) { g.cache.tiles.clear(); if (g.at) g.at.set(1e9, 0, 0); }
    };
    forget();
    return () => { for (const [k, v] of old) T.yard[k] = v; forget(); };
  }

  // ── THE PADDOCK: a few cows and a horse ────────────────────────────────────────────────────────────────────────
  const herd = [], pad = L.area(L.paddock, 2);
  let disposed = false;
  const ready = (animals ? Promise.all(['farmCow', 'farmHorse'].map((k) => animals.need(k))) : Promise.reject(new Error('no animal library')))
    .then(() => {
      if (disposed) return;
      const kinds = [...Array(FARM.cows).fill('farmCow'), 'farmHorse'];
      kinds.forEach((k, i) => {
        const a = makeAnimal(animals, k, { shadows, tint: k === 'farmCow' && i ? COATS[(i * 3) % COATS.length] : null });
        let p = pad.random(), rot = Math.random() * Math.PI * 2;
        for (let t = 0; t < 20 && (herd.some((o) => Math.hypot(o.a.root.position.x - p.x, o.a.root.position.z - p.z) < 4) || !clear(a, p.x, p.z, rot)); t++) { p = pad.random(); rot = Math.random() * Math.PI * 2; }
        a.root.position.set(p.x, W.heightAt(p.x, p.z), p.z); a.root.rotation.y = rot;
        scene.add(a.root);
        herd.push(wanderer(a, pad, { rest: [5, 14], walk: 0.6, others: herd, room: 3 }));
      });
    })
    .catch((e) => console.warn('farm: the paddock animals could not load', e));

  // true when an animal standing at (x, z) facing `rot` is clear of what blocks from nose to tail (a blocker only tests
  // a point, and a cow or a horse is about 2 m long: tested at its middle alone, its head ends up in the trough)
  function clear(a, x, z, rot) {
    const h = (a.length || 1) * 0.5, sx = Math.sin(rot) * h, sz = Math.cos(rot) * h;
    return !W.blocked(x, z) && !W.blocked(x + sx, z + sz) && !W.blocked(x - sx, z - sz);
  }

  // true when (x, z) is at least w.room from each of w.others, where it stands and where it is heading
  function roomy(w, x, z) {
    if (!w.others) return true;
    for (const o of w.others) {
      if (o === w) continue;
      const q = o.a.root.position;
      if (Math.hypot(q.x - x, q.z - z) < w.room || (o.goal && Math.hypot(o.goal.x - x, o.goal.z - z) < w.room)) return false;
    }
    return true;
  }

  // a pottering animal: stands (Idle) a while, then ambles to a spot nearby at its slow walk (feet on the ground: the
  // clip at its own pace), and stands again. It keeps inside its area and its whole body out of what blocks
  // others: the animals it shares the area with (it keeps `room` metres from where they stand or are heading)
  function wanderer(a, area, { rest = [4, 10], walk = 0.5, others = null, room = 0 } = {}) {
    const w = { a, area, goal: null, t: rest[0] + Math.random() * (rest[1] - rest[0]), rest, walk, others, room };
    a.play('Idle');
    return w;
  }
  function wanderStep(w, dt) {
    const a = w.a, r = a.root;
    if (!w.goal) {
      if ((w.t -= dt) <= 0) {
        for (let k = 0; k < 8; k++) {
          const ang = Math.random() * Math.PI * 2, d = 2 + Math.random() * 5, x = r.position.x + Math.sin(ang) * d, z = r.position.z + Math.cos(ang) * d;
          if (w.area.contains(x, z) && clear(a, x, z, ang) && roomy(w, x, z)) { w.goal = { x, z }; break; }
        }
        if (!w.goal) w.t = 2;
      }
    } else {
      const dx = w.goal.x - r.position.x, dz = w.goal.z - r.position.z, d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz), turn = wrap(want - r.rotation.y);
      r.rotation.y += turn * Math.min(1, 2.5 * dt);
      const v = a.stride.WalkSlow * (Math.abs(turn) > 1.2 ? 0.4 : 1), step = Math.min(d, v * dt);
      const nx = r.position.x + Math.sin(r.rotation.y) * step, nz = r.position.z + Math.cos(r.rotation.y) * step;
      // (the nose is tested the way it is heading, toward the goal, so an animal still turning round isn't held up)
      const nose = (a.length || 1) * 0.5, hx = nx + Math.sin(want) * nose, hz = nz + Math.cos(want) * nose;
      // (and it stops short rather than walk into another animal of its area)
      const bump = !!w.others && w.others.some((o) => { if (o === w) return false; const q = o.a.root.position, dn = Math.hypot(q.x - nx, q.z - nz); return dn < w.room * 0.6 && dn < Math.hypot(q.x - r.position.x, q.z - r.position.z); });
      if (d < 0.3 || bump || !w.area.contains(nx, nz) || W.blocked(nx, nz) || W.blocked(hx, hz)) { w.goal = null; w.t = w.rest[0] + Math.random() * (w.rest[1] - w.rest[0]); a.play('Idle', { fade: 0.35 }); }
      else { r.position.set(nx, W.heightAt(nx, nz), nz); a.play('WalkSlow', { fade: 0.35, speed: v / a.stride.WalkSlow }); }
    }
    a.update(dt);
  }

  const farm = {
    layout: L, ready, blocked, root, herd,
    wanderer, wanderStep,
    update(dt, at) {
      const d = at ? Math.hypot(at.x - L.x, at.z - L.z) : 0;
      if (d > FARM.awake) return;
      for (const w of herd) wanderStep(w, dt);
    },
    state: () => ({ at: { x: L.x, z: L.z }, posts: posts.length, rails: rails.length, animals: herd.map((w) => ({ kind: w.a.kind, x: +w.a.root.position.x.toFixed(1), z: +w.a.root.position.z.toFixed(1), clip: w.a.clip })) }),
    dispose() {
      disposed = true; offBlock(); unmow(); unlawn();
      for (const w of herd) w.a.dispose();
      herd.length = 0;
      root.removeFromParent();
      postG.dispose(); railG.dispose(); pm.dispose(); rm.dispose();
      if (!fm) fmat.dispose();
    },
  };
  return farm;
}
