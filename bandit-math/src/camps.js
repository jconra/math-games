// THE CAMPS: three camps out in the valley, away from the town, on flat open ground (picked from a survey of the land:
// the height within about half a metre over the camp, dry, no trees, clear of the trail, the creek, the farm, the
// pasture and the corral; ~/pw/bandit-math/rigs/camps/survey.cjs). Each one is a Tripo model of the owner's
// (models/camps/campN.glb, built from his camp1-3 by ~/pw/bandit-math/rigs/camps/build_camps.mjs: every part baked into
// one mesh, so a camp is one draw; real size; a 1024 picture for the normal and potato tiers in models/camps/lo/), turned
// to face the town, with a few people about it and, at the two that have a ring of stones, a campfire burning in it
// (src/fire/campfire.js). The camps order supplies from the general store: the delivery job (src/missions/delivery.js).
//   cow      the Bar T trail crew's cow camp (camp1: an A-frame tent, a ring of stones with a pot on a tripod, stumps, a
//            saddle on a rail), west of town
//   hollis   the Hollis family's camp, friendly neighbours who trade with the town (camp2: a painted tipi, an awning with
//            pots, a ring of stones, a cart wheel), east, past the pasture
//   survey   the railroad surveyors' camp (camp3: one big wall tent), north, across the creek from the farm
//
// The ground under a camp is mown like the town's yards (no tall meadow growing through a tent), the tents and the fire
// rings block walkers (W.addBlocker), and each camp has a foreman standing out front: the one to talk to about an order.
// A camp's delivered crates stack up beside it (a few at a time).
//
//   const C = makeCamps({ W, folk, camera, audio, scene })
//     folk: the people library (src/actors/folk.js); audio: the game's sound (for the fires' crackle), or null
//   C.list            the camps: { id, kind, name, short, x, z, y, rot, at(lx, lz) -> { x, z }, foreman: { x, z, rot,
//                     name, person }, drop: { x, z } (where a horse with crates is unloaded), hands: [person...],
//                     fire (a campfire, or null), stack(n) (show n crates delivered), unload: { x, z } (where the hands
//                     carry crates to) }
//   C.byId(id)        one camp
//   C.near(at, r)     the camp whose middle is within r metres of `at`, nearest first (or null)
//   C.ready           a promise: the models are in
//   C.update(dt, at)  each frame: at = the player's position (people and fires far away are left alone)
//   C.state()         for rigs
//   C.dispose()
//   crateParts()      the crate's shape and material (shared): { geometry, material, size }, for a load on a horse
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { makePerson } from './actors/folk.js';
import { makeCampfire } from './fire/campfire.js';

const GAME = new URL('../', import.meta.url).href;      // (src/ -> the game's own folder)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// Each model's own layout, in metres in the model's frame (x across, z toward its front, which faces the town; y up
// from the model's lowest point). Measured from the built models (models/camps/camps.json, ~/pw/bandit-math/rigs/camps/
// analyse.mjs) and checked by eye from above and from the ground.
//   fire: the ring's middle and its embers' height, and the flame's width; block: what stops a walker, as boxes
//   [x0, z0, x1, z1] and rings [x, z, r]; hands: where the camp's people stand and the way they face (radians, as three's
//   rotation.y in the model's frame); foreman: where the foreman stands, out front; drop: where a horse is unloaded;
//   stack: where the delivered crates are piled
export const CAMP_KINDS = {
  camp1: {   // (5.8 m from the front of the fire ring to the back of the tent; the tent 3.4 m wide, its ridge 2.8 m up)
    file: 'camp1', fire: { x: -0.22, y: 0.23, z: 2.17, width: 0.9 },
    block: { boxes: [[-2.1, -2.8, 1.4, 0.5], [1.2, -1.9, 2.05, 0]], rings: [[-0.22, 2.17, 0.85]] },
    hands: [{ x: 1.35, z: 1.95, face: -1.6 }, { x: -1.75, z: 1.45, face: 2.2 }],
    foreman: { x: 2.2, z: 3.9, face: 0.4 }, drop: { x: 3.8, z: 5.2 }, stack: { x: 3.0, z: -1.0 },
  },
  camp2: {
    file: 'camp2', fire: { x: 0.28, y: 0.3, z: 2.31, width: 0.95 },
    block: { boxes: [[-3.4, -1.6, -1.2, 1.5]], rings: [[1.48, -1.38, 2.25], [0.28, 2.31, 0.85]] },
    hands: [{ x: 1.75, z: 2.7, face: -1.7 }, { x: -1.15, z: 2.9, face: 1.7 }],
    foreman: { x: 2.4, z: 4.4, face: 0.3 }, drop: { x: 4.0, z: 5.6 }, stack: { x: -2.6, z: 2.6 },
  },
  camp3: {   // (5.4 m square, the ridge 3.7 m up)
    file: 'camp3', fire: null,
    block: { boxes: [[-2.3, -2.3, 2.3, 2.3]], rings: [] },
    hands: [{ x: -1.5, z: 3.3, face: 0.6 }],
    foreman: { x: 1.6, z: 3.6, face: 0.2 }, drop: { x: 3.2, z: 5.8 }, stack: { x: 3.4, z: 0.6 },
  },
};

// The camps in the valley. spot: the middle (metres, world); the camp turns to face the town square. People: the
// foreman and the hands (folk.js outfits and palettes, in drab period colours; none in the outlaw black).
export const CAMPS = [
  { id: 'cow', kind: 'camp1', name: 'The Bar T cow camp', short: 'the cow camp', spot: { x: -184, z: -176 }, mow: 12,   // (its tent is low: a wider mown patch lets it show over the meadow)
    foreman: { name: 'Dusty', look: { outfit: 'worker_m', palette: 'drifter' } },
    hands: [{ outfit: 'adventurer_m', palette: 'rancher' }, { outfit: 'casual_m', palette: 'mustard' }] },
  { id: 'hollis', kind: 'camp2', name: 'The Hollis family camp', short: 'the Hollis camp', spot: { x: 256, z: -192 },
    foreman: { name: 'Ma Hollis', look: { outfit: 'adventurer_f', palette: 'sage' } },
    hands: [{ outfit: 'casual_f', palette: 'prairie' }, { outfit: 'casual_m', palette: 'homestead' }] },
  { id: 'survey', kind: 'camp3', name: 'The surveyors\' camp', short: 'the surveyors\' camp', spot: { x: 56, z: -304 },
    foreman: { name: 'Mr. Crane', look: { outfit: 'suit_m', palette: 'mustard' } },   // (not the dark townsman: all dark reads as the gang)
    hands: [{ outfit: 'worker_m', palette: 'sage' }] },
];

export const CAMP = {
  sink: 0.06,            // metres the model sits into the ground (its feet in the dirt, never a gap on slightly uneven land)
  mow: 7.5,              // the ground within this of the middle is mown (a camp may ask for more), fading back to the meadow over...
  mowFade: 4,            // ...this many metres
  awake: 90,             // metres: closer than this the camp's people move (their clips play)
  show: 170,             // metres: further than this the people aren't drawn
  stackMax: 6,           // crates shown in a camp's pile at most
  crate: [0.62, 0.42, 0.42],   // a crate: long, high, deep (m)
};

// ── THE CRATE: a slatted wooden box (one shape, a painted picture, shared by every crate in the game) ────────────────
let CRATE = null;
export function crateParts() {
  if (CRATE) return CRATE;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#a07a4a'; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) {   // four slats with dark gaps and a little grain
    const y = i * 32; c.fillStyle = ['#a8804e', '#9b7445', '#a47c4b', '#97703f'][i]; c.fillRect(0, y + 2, 128, 28);
    c.strokeStyle = 'rgba(70,45,20,0.35)'; c.lineWidth = 1;
    for (let g = 0; g < 4; g++) { c.beginPath(); c.moveTo(0, y + 7 + g * 6); c.bezierCurveTo(40, y + 5 + g * 6, 80, y + 10 + g * 6, 128, y + 7 + g * 6); c.stroke(); }
  }
  c.fillStyle = '#5b4126'; c.fillRect(0, 0, 10, 128); c.fillRect(118, 0, 10, 128);   // the corner posts
  c.fillStyle = '#3a2a18'; for (const [x, y] of [[5, 16], [5, 48], [5, 80], [5, 112], [123, 16], [123, 48], [123, 80], [123, 112]]) c.fillRect(x - 1.5, y - 1.5, 3, 3);
  // a stamped brand in the middle (no word: the same crates carry beans, coffee, oats and flour)
  c.strokeStyle = 'rgba(45,30,16,0.75)'; c.lineWidth = 5; c.beginPath(); c.arc(64, 64, 20, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(52, 64); c.lineTo(76, 64); c.moveTo(64, 52); c.lineTo(64, 76); c.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const [w, h, d] = CAMP.crate;
  CRATE = { geometry: new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), material: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 }), size: CAMP.crate };
  return CRATE;
}

const loads = {};
function loadCamp(file, lo) {
  const url = `${GAME}models/camps/${lo ? 'lo/' : ''}${file}.glb`;
  // (the model as loaded: its one mesh keeps the node's own scale and offset, which the squeezed (quantized) points
  // need to come out in metres)
  return loads[url] || (loads[url] = loader.loadAsync(url).then((g) => g.scene));
}

export function makeCamps({ W, folk = null, camera, audio = null, scene = W.scene }) {
  const lo = W.tier !== 'gaming';
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const sq = W.places.square || W.places.spawn || { x: 0, z: 0 };
  const list = [], offs = [];
  let disposed = false;

  for (const def of CAMPS) {
    const K = CAMP_KINDS[def.kind];
    const x = def.spot.x, z = def.spot.z, rot = Math.atan2(sq.x - x, sq.z - z);   // (its front toward the square)
    const c = Math.cos(rot), s = Math.sin(rot);
    const at = (lx, lz) => ({ x: x + c * lx + s * lz, z: z - s * lx + c * lz });
    const local = (wx, wz) => { const dx = wx - x, dz = wz - z; return { x: c * dx - s * dz, z: s * dx + c * dz }; };
    // the model stands at the average height of the ground round it, sunk a few centimetres
    let sum = 0, n = 0;
    for (let lz = -2.5; lz <= 2.5; lz += 1.25) for (let lx = -2.5; lx <= 2.5; lx += 1.25) { const p = at(lx, lz); sum += W.heightAt(p.x, p.z); n++; }
    const y = sum / n - CAMP.sink;
    const root = new THREE.Group(); root.name = 'camp-' + def.id;
    root.position.set(x, y, z); root.rotation.y = rot;
    scene.add(root);
    const camp = { id: def.id, kind: def.kind, name: def.name, short: def.short, x, z, y, rot, at, local, root, hands: [], fire: null, mesh: null, crates: null, shown: 0, mow: def.mow || CAMP.mow,
      foreman: { ...at(K.foreman.x, K.foreman.z), rot: rot + K.foreman.face, name: def.foreman.name, look: def.foreman.look, person: null },
      drop: at(K.drop.x, K.drop.z), unload: at(K.stack.x, K.stack.z) };

    // the model (loaded once a kind; the same picture and shape shared)
    loadCamp(K.file, lo).then((scn) => {
      if (disposed) return;
      const mesh = scn.clone(); mesh.name = 'camp-' + def.id + '-model';
      mesh.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = shadows; if (o.material.map) o.material.map.anisotropy = 4; } });
      root.add(mesh); camp.mesh = mesh;
    }).catch((e) => console.warn('camps: the model could not load', def.kind, e));

    // the delivered crates' pile beside the camp: CAMP.stackMax crates, shown a few at a time
    const C = crateParts(), pile = new THREE.InstancedMesh(C.geometry, C.material, CAMP.stackMax);
    {
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), [cw, ch] = C.size;
      for (let i = 0; i < CAMP.stackMax; i++) {
        // three on the ground side by side, two on them, one on top; each turned a little
        const row = i < 3 ? 0 : i < 5 ? 1 : 2, col = i < 3 ? i - 1 : i < 5 ? i - 3.5 : 0;
        const lx = K.stack.x + col * (cw + 0.04), lz = K.stack.z + (i % 2) * 0.05;
        const p = at(lx, lz), gy = W.heightAt(p.x, p.z) - y;
        q.setFromAxisAngle(up, ((i * 37) % 7 - 3) * 0.03);
        M.compose(new THREE.Vector3(lx, gy + row * ch, lz), q, new THREE.Vector3(1, 1, 1));
        pile.setMatrixAt(i, M);
      }
      pile.count = 0; pile.castShadow = pile.receiveShadow = shadows; pile.name = 'camp-' + def.id + '-crates';
      root.add(pile);
    }
    camp.crates = pile;
    camp.stack = (k) => { camp.shown = Math.max(0, Math.min(CAMP.stackMax, Math.round(k))); pile.count = camp.shown; pile.instanceMatrix.needsUpdate = true; };

    // the fire in its ring of stones
    if (K.fire) {
      const f = at(K.fire.x, K.fire.z);
      camp.fire = makeCampfire({ W, scene, camera, x: f.x, z: f.z, y: y + K.fire.y, width: K.fire.width, audio, id: 'campfire-' + def.id });
    }

    // what blocks a walker: the tents and the things about them, and the fire ring (in the camp's own frame)
    const B = K.block, reach = 12;
    const blocked = (wx, wz) => {
      if (Math.abs(wx - x) > reach || Math.abs(wz - z) > reach) return false;
      const p = local(wx, wz);
      for (const [x0, z0, x1, z1] of B.boxes) if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) return true;
      for (const [rx, rz, r] of B.rings) if ((p.x - rx) ** 2 + (p.z - rz) ** 2 < r * r) return true;
      return false;
    };
    camp.blocked = blocked;
    if (W.addBlocker) offs.push(W.addBlocker(blocked));

    // the people: the foreman out front, the hands by the fire
    if (folk) {
      const person = (look, spot, face) => {
        let p = null;
        try { p = makePerson(folk, { ...look, skin: Math.floor(Math.random() * 8), hair: Math.floor(Math.random() * 11), shadows }); } catch (e) { console.warn('camps: a person could not be made', e); return null; }
        p.root.position.set(spot.x, W.heightAt(spot.x, spot.z), spot.z); p.root.rotation.y = face;
        p.play('Idle', { fade: 0 });
        scene.add(p.root);
        return { p, x: spot.x, z: spot.z, face, home: { x: spot.x, z: spot.z, face }, t: Math.random() * 8, busy: null };
      };
      camp.foreman.person = person(def.foreman.look, camp.foreman, camp.foreman.rot);
      K.hands.forEach((h, i) => { const sp = at(h.x, h.z), q = def.hands[i % def.hands.length]; const hp = person(q, sp, rot + h.face); if (hp) camp.hands.push(hp); });
    }
    list.push(camp);
  }

  // the ground under each camp is mown, as the town's yards and the farm are (the plants round the player are laid again
  // from it as the player moves; the old values come back on dispose)
  const unmow = mow();
  function mow() {
    const V = W.V, T = V && V.TOWN;
    if (!T || !T.yard || !V.N || !V.TEX) return () => {};
    const N = V.N, TEX = V.TEX, SIZE = V.SIZE, old = new Map();
    for (const cp of list) {
      const R = cp.mow + CAMP.mowFade + TEX;
      for (let j = Math.max(0, Math.floor((cp.z - R + SIZE / 2) / TEX)); j <= Math.min(N - 1, Math.ceil((cp.z + R + SIZE / 2) / TEX)); j++)
        for (let i = Math.max(0, Math.floor((cp.x - R + SIZE / 2) / TEX)); i <= Math.min(N - 1, Math.ceil((cp.x + R + SIZE / 2) / TEX)); i++) {
          const d = Math.hypot((i + 0.5) * TEX - SIZE / 2 - cp.x, (j + 0.5) * TEX - SIZE / 2 - cp.z);
          const t = Math.min(1, Math.max(0, (d - cp.mow) / CAMP.mowFade)), v = 1 - t * t * (3 - 2 * t);
          const k = j * N + i; if (v > T.yard[k]) { if (!old.has(k)) old.set(k, T.yard[k]); T.yard[k] = v; }
        }
    }
    const forget = () => { const c = V.COVER && V.COVER.cache; if (c && c.tiles) c.tiles.clear(); };
    forget();
    return () => { for (const [k, v] of old) T.yard[k] = v; forget(); };
  }

  const ready = Promise.all(list.map((cp) => loadCamp(CAMP_KINDS[cp.kind].file, lo))).then(() => true);

  // a camp's people: standing about, now and then shifting their weight or turning to the fire; the foreman turns to
  // face the player when they come close. A person given a job (busy: a walk to a spot and back, from the delivery job)
  // walks it.
  function personStep(h, dt, toward) {
    const p = h.p;
    if (h.busy) {
      const b = h.busy, dx = b.to.x - h.x, dz = b.to.z - h.z, d = Math.hypot(dx, dz);
      if (d > 0.08) {
        if (!b.walking) { b.walking = true; p.play('Walk', { fade: 0.25, speed: 1.4 / ((p.stride && p.stride.Walk) || 1.2) }); }   // (stride: m/s per clip, { Walk, Run })
        const st = Math.min(d, 1.4 * dt); h.x += dx / d * st; h.z += dz / d * st;
        turnTo(h, Math.atan2(dx, dz), dt);
      } else {
        if (b.walking) { b.walking = false; p.play(b.clip || 'Idle', { fade: 0.25, once: !!b.clip }); }
        if (b.face != null) turnTo(h, b.face, dt);
        if ((b.wait -= dt) <= 0) { const nx = b.then; h.busy = nx || null; if (!nx) p.play('Idle', { fade: 0.3 }); }
      }
    } else {
      if (toward) turnTo(h, Math.atan2(toward.x - h.x, toward.z - h.z), dt * 0.6); else turnTo(h, h.home.face, dt * 0.5);
      if ((h.t -= dt) <= 0) { h.t = 6 + Math.random() * 9; p.play(Math.random() < 0.5 ? 'Idle_Neutral' : 'Idle', { fade: 0.6 }); }
    }
    p.root.position.set(h.x, W.heightAt(h.x, h.z), h.z); p.root.rotation.y = h.face;
    p.update(dt);
  }
  function turnTo(h, want, dt) { const a = Math.atan2(Math.sin(want - h.face), Math.cos(want - h.face)); h.face += a * Math.min(1, dt * 5); }

  let time = 0;
  const C = {
    list, ready,
    byId: (id) => list.find((c) => c.id === id) || null,
    near(at, r = 20) { let best = null, bd = r; for (const c of list) { const d = Math.hypot(at.x - c.x, at.z - c.z); if (d < bd) { bd = d; best = c; } } return best; },
    // sends one of a camp's people on a little errand: walk to `to`, play `clip` there for `wait` seconds (facing `face`),
    // then `then` (another errand, or back home); returns false if the camp has nobody free
    errand(camp, i, steps) {
      const all = [camp.foreman.person, ...camp.hands].filter(Boolean), h = all[i % Math.max(1, all.length)];
      if (!h) return false;
      let first = null, prev = null;
      for (const s of [...steps, { to: h.home, face: h.home.face, wait: 0 }]) { const e = { ...s, wait: s.wait ?? 0, walking: false, then: null }; if (prev) prev.then = e; else first = e; prev = e; }
      h.busy = first;
      return true;
    },
    update(dt, at) {
      time += dt;
      for (const c of list) {
        const d = at ? Math.hypot(at.x - c.x, at.z - c.z) : 0;
        if (c.fire) c.fire.update(dt, time);
        const show = d < CAMP.show, awake = d < CAMP.awake;
        for (const h of [c.foreman.person, ...c.hands]) {
          if (!h) continue;
          if (h.p.root.visible !== show) h.p.root.visible = show;
          if (!awake && !h.busy) continue;
          const toward = h === c.foreman.person && at && Math.hypot(at.x - h.x, at.z - h.z) < 12 ? at : null;
          personStep(h, dt, toward);
        }
      }
    },
    state: () => list.map((c) => ({ id: c.id, x: +c.x.toFixed(1), z: +c.z.toFixed(1), y: +c.y.toFixed(2), rot: +c.rot.toFixed(2), loaded: !!c.mesh, fire: c.fire ? c.fire.burning : null,
      foreman: { x: +c.foreman.x.toFixed(1), z: +c.foreman.z.toFixed(1) }, drop: c.drop, crates: c.shown, people: c.hands.length + (c.foreman.person ? 1 : 0) })),
    dispose() {
      disposed = true;
      for (const off of offs) off();
      unmow();
      for (const c of list) {
        if (c.fire) c.fire.dispose();
        for (const h of [c.foreman.person, ...c.hands]) if (h) { scene.remove(h.p.root); try { h.p.dispose(); } catch (e) { /* (gone) */ } }
        c.root.removeFromParent(); if (c.crates) c.crates.dispose();
      }
    },
  };
  return C;
}
