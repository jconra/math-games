// LOOT THE GANG: the second half of the gang story. The gang that hits the freight wagons (Protect the wagon) stashed
// what it stole out in the valley; the deputy out front of the sheriff's office says so, and the compass leads to the
// cache: a small hideout of crates, sacks and a strongbox under a canvas lean-to by a cold fire ring, made here in code
// (the crates are the camps' own: src/camps.js crateParts). Now and then one of the gang sits his horse there on guard
// (riders.js: he looks like any rider; being there is what gives him away). Roping him is a choice, not a toll: rope
// him (the green ring, a click or F, like the wagon job's bandits) and he's pulled down and hogtied (a bandit brought in,
// and a small bounty); ride straight in and he lights out for the hills. Nothing is lost either way.
//
// Riding up to the cache loads the loot on the horse (it shows on her back, in panniers and a strongbox on top). The
// loot is heavy: it needs a saddled horse (the deputy and Old Hob say where to buy one). The compass then points back
// to the sheriff's office, where the folks it was taken from come out to wait; as you ride in one of them sees his
// goods ("Is that my stuff?", the owner's own recording, src/audio/shouts.js). Pulling up in front of them brings up the
// store's parchment slip (src/ui/storeslip.js) with the first bundle's sharing problem (src/math/shares.js): fair
// shares and leftovers, its own kind of problem. Pick a coin. A wrong coin shakes, one plain line says what that slip
// was, and the slip draws the sharing (dealt out round and round, the trips and boxes, the parts): never the answer.
// A right coin: each family's one steps up and takes their share, someone says thank you (the men in the owner's
// recorded voice; the women in a speech card only), gold from the deputy flies into the purse, and the next bundle's
// problem slides in. When the last bundle is handed back the trip pays a bonus, it counts toward the "loot returned"
// belt buckle (save.js JOBS), the deputy thanks you, and before long there's word of another stash elsewhere.
//
// Walking or riding off is "done for now": nothing is lost. The slip goes away when you walk off (or with "Done for
// now" / Esc); the loot stays on the horse, the folks wait, and pulling up again brings the slip back.
//
//   const LJ = makeLootJob({ W, folk, animals, P, I, camera, canvas, rider, hud, hob, refresh, voice, quiet })
//     voice(kind, who): a recorded line from a townsman ('mystuff', 'thanks': src/audio/shouts.js S.say; who: { at,
//     male, id }); quiet(): true while another job has the HUD's card (this job's card stays down then)
//   LJ.update(dt)       each frame after the player
//   LJ.phase            'out' (the cache waits) | 'carrying' (the loot is on the horse) | 'rest' (word of the next cache
//                       is coming)
//   LJ.active           the slip is up (sharing out at the sheriff's office)
//   LJ.card             true while this job has the HUD's card (near the cache, or carrying the loot)
//   LJ.near             at the cache (its guard about)
//   LJ.canShare         carrying loot by the sheriff's office (the deputy's E shares it out: LJ.share())
//   LJ.marks()          [{ id, icon, x, z, label }] for the compass: the cache, or the sheriff's office with the loot
//   LJ.people           the townsfolk waiting at the sheriff's office (live records with x, z: the town's wagons stop
//                       for them)
//   LJ.paused           a panel is open over the game
//   LJ.cache, LJ.trainer, LJ.state() (for rigs), LJ.dev { at(), load(), town(), guard(), cache(i) }, LJ.dispose()
//   CACHES, LOOT        the hideouts and the dials
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePerson } from '../actors/folk.js';
import { loadRiderKit, makeRider } from '../actors/riders.js';
import { makeTargetRing } from '../targetring.js';
import { crateParts } from '../camps.js';
import { makeShares, picture, FAMILIES, MATRON } from '../math/shares.js';
import { makeStoreSlip } from '../ui/storeslip.js';
import { earn, recordAnswer, countJob, saveRider } from '../save.js';

// The gang's hideouts, taken in turn (picked from a survey of the land: ~/pw/bandit-math/rigs/loot/survey.cjs: dry,
// gentle ground at a woods edge where it can, well clear of the town, the farm, the pasture, the camps, the deer, the
// wagon road and the trail). x, z: metres, world.
export const CACHES = [
  { id: 'hollow', x: -154, z: -100, name: 'the hollow by the western woods' },
  { id: 'timber', x: 140, z: -322, name: 'the timber past the farm' },
  { id: 'thicket', x: -76, z: -46, name: 'the thicket above the lake' },
  { id: 'meadow', x: 146, z: 92, name: 'the far meadow' },
  { id: 'pines', x: -250, z: -130, name: 'the pines past the cow camp' },
];

export const LOOT = {
  near: 70,             // m from the cache: at the cache (the card says what's there; the guard watches)
  ropeNear: 45,         // m: the green ring picks the guard within this of the player
  flee: 12,             // m: riding in this close to the loot without roping the guard, he lights out
  load: 7,              // m from the cache's middle: the loot goes on the horse
  horseNear: 22,        // ... when the horse is within this of it
  guardChance: 0.65,    // a guard at the cache (always on the first trip)
  town: 75,             // m from the sheriff's door with the loot: the folks it was taken from come out to wait
  townGone: 170,        // ... farther than this they go home (and come out again when the loot comes back)
  stuff: 24,            // m from them: one of them sees his goods ("Is that my stuff?")
  spot: 7.2,            // m out in front of the sheriff's door: where you hand it back
  arc: 3.7,             // m from that spot (toward the door) the folks stand, in an arc facing it
  share: 4.5,           // m from the spot, slower than shareSlow (m/s): the slip comes up
  shareSlow: 3.2,
  again: 11.5,          // after the slip went away, it comes up again only after this far off and back
  leave: 11,            // m from the spot: walking or riding off this far puts the slip away
  rest: 16,             // s from a trip handed back to word of the next cache
  bundles: [2, 3],      // bundles of loot (share problems) a trip: the first trip, then each after
  families: 6,          // families waiting at the office for a trip (each bundle is theirs, some or all)
  walk: 1.45,           // m/s the townsfolk stroll
  mow: 6, mowFade: 3,   // the meadow mown round the cache (m), so the crates show over the grass
  pay: { each: 3, everyStep: 2, first: 1, trip: 6, clean: 3, guard: 4 },   // gold: a bundle (+1 for every 2 steps up the
                        // ladder, +1 right first time), a trip handed back (+ clean when every bundle was right first
                        // time), and roping the guard
  guardGone: 70,        // m: a hogtied guard is taken away (out of sight) once the player is this far off
};

const MEN_THANKS = ['Much obliged, partner!', "That's mine, all right. Thank ya kindly!", 'Thank ya kindly!', 'You found it! Obliged.'];
const WOMEN_THANKS = ['Bless you! Thank you kindly.', 'Oh, thank you! We thought it was gone for good.', "You're a real life saver.", 'Thank you, partner!'];
const MATRON_THANKS = ['The children thank you kindly.', "That'll go a long way at the orphans' home. Thank you."];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const way = (from, to) => { const a = Math.atan2(to.x - from.x, to.z - from.z); const k = Math.round(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (Math.PI / 4)) % 8; return ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'][k]; };
const roundTo = (d) => (d > 100 ? Math.round(d / 10) * 10 : Math.round(d));

// the tent's canvas: an old cream canvas with its seams, weathered and muddied toward the ground (v = 0 at the ground)
function canvasCloth() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#c4b591'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${90 + (i % 40)},${70 + (i % 30)},40,${0.04 + (i % 7) * 0.01})`; x.fillRect((i * 37) % 128, (i * 91) % 128, 2, 1); }
  for (const u of [0, 42, 85]) { x.fillStyle = 'rgba(80,60,35,0.35)'; x.fillRect(u, 0, 2, 128); }
  const g = x.createLinearGradient(0, 128, 0, 70); g.addColorStop(0, 'rgba(70,50,25,0.55)'); g.addColorStop(1, 'rgba(70,50,25,0)');
  x.fillStyle = g; x.fillRect(0, 70, 128, 58);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// ── THE LOOT'S SHAPES (made once, shared) ──────────────────────────────────────────────────────────────────────────
let PARTS = null;
function lootParts() {
  if (PARTS) return PARTS;
  // a burlap sack, tied at the top
  const prof = [[0, 0], [0.17, 0.01], [0.24, 0.08], [0.27, 0.22], [0.25, 0.36], [0.17, 0.46], [0.07, 0.52], [0.045, 0.56], [0.075, 0.61], [0.05, 0.64], [0, 0.65]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const sack = new THREE.LatheGeometry(prof, 10); sack.scale(1, 1, 0.82); sack.computeVertexNormals();
  // a strongbox: dark wood, iron bands round it, a brass lock plate
  const box = new THREE.BoxGeometry(0.56, 0.32, 0.36).translate(0, 0.16, 0);
  const bands = mergeGeometries([
    new THREE.BoxGeometry(0.05, 0.335, 0.375).translate(-0.17, 0.165, 0), new THREE.BoxGeometry(0.05, 0.335, 0.375).translate(0.17, 0.165, 0),
    new THREE.BoxGeometry(0.575, 0.04, 0.375).translate(0, 0.3, 0),
  ]);
  const lock = new THREE.BoxGeometry(0.1, 0.12, 0.02).translate(0, 0.2, 0.185);
  PARTS = {
    sack, box, bands, lock,
    burlap: new THREE.MeshStandardMaterial({ color: 0x9c8257, roughness: 1, metalness: 0 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.85, metalness: 0 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.55, metalness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb48a3c, roughness: 0.4, metalness: 0.7 }),
    canvas: new THREE.MeshStandardMaterial({ map: canvasCloth(), roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    pole: new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.9, metalness: 0 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x7c7770, roughness: 0.95, metalness: 0 }),
    char: new THREE.MeshStandardMaterial({ color: 0x1e1a17, roughness: 1, metalness: 0 }),
  };
  return PARTS;
}

export function makeLootJob({ W, folk, animals, P, I, camera, canvas, rider, hud, hob = null, refresh = () => {}, voice = null, quiet = () => false, scene = W.scene }) {
  if (!rider.topics || typeof rider.topics !== 'object') rider.topics = {};
  if (!rider.topics.loot || typeof rider.topics.loot !== 'object') rider.topics.loot = {};
  const Q = makeShares(rider.topics.loot);
  const S = rider.topics.loot;   // (Q.state: the ladder, and the trips handed back)
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const sh = W.places.sheriff;
  const LJ = { phase: 'out', active: false, near: false, canShare: false, people: [], paused: false, trainer: Q };

  // ── THE HAND-BACK SPOT IN FRONT OF THE SHERIFF'S OFFICE ──────────────────────────────────────────────────────────
  const rot = sh ? sh.rot : 0, door = sh ? sh.door : W.places.spawn;
  const out = { x: Math.sin(rot), z: Math.cos(rot) }, side = { x: Math.cos(rot), z: -Math.sin(rot) };
  const free = (x, z) => !W.blocked(x, z) && W.waterAt(x, z) < 0.25;
  const spot = (() => { for (const k of [LOOT.spot, LOOT.spot + 1.5, LOOT.spot - 1, LOOT.spot + 3]) { const x = door.x + out.x * k, z = door.z + out.z * k; if (free(x, z)) return { x, z }; } return { x: door.x + out.x * LOOT.spot, z: door.z + out.z * LOOT.spot }; })();
  // the folks' places: an arc between the spot and the door, facing the spot (the matron's at the end)
  function arcSpots(n) {
    const out2 = [], base = Math.atan2(door.x - spot.x, door.z - spot.z), span = Math.min(1.7, 0.42 * (n - 1));
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? -span / 2 + span * i / (n - 1) : 0);
      let x = spot.x + Math.sin(a) * LOOT.arc, z = spot.z + Math.cos(a) * LOOT.arc;
      if (!free(x, z)) { x = spot.x + Math.sin(a) * (LOOT.arc - 1); z = spot.z + Math.cos(a) * (LOOT.arc - 1); }
      out2.push({ x, z, face: Math.atan2(spot.x - x, spot.z - z) });
    }
    return out2;
  }

  // ── THE CACHE ──────────────────────────────────────────────────────────────────────────────────────────────────
  let cacheN = Number.isInteger(S.cache) ? S.cache % CACHES.length : 0;
  let cache = null;   // { def, x, z, y, rot, root, loot: [meshes that go when loaded], offBlock, unmow }
  function buildCache(def) {
    const L = lootParts(), C = crateParts();
    const sq = W.places.square || W.places.spawn;
    const r0 = Math.atan2(sq.x - def.x, sq.z - def.z);   // (its open side toward the town)
    const y0 = W.heightAt(def.x, def.z);
    const c = Math.cos(r0), s = Math.sin(r0);
    const world = (lx, lz) => ({ x: def.x + lx * c + lz * s, z: def.z - lx * s + lz * c });
    const lift = (lx, lz) => { const p = world(lx, lz); return W.heightAt(p.x, p.z) - y0; };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const put = (geo, lx, lz, { y = 0, ry = 0, rx = 0, rz = 0, k = 1, ground = true } = {}) =>
      geo.clone().applyMatrix4(m.compose(v.set(lx, (ground ? lift(lx, lz) : 0) + y, lz), q.setFromEuler(e.set(rx, ry, rz)), sc.set(k, k, k)));
    const lists = { crate: [], sack: [], box: [], bands: [], lock: [], canvas: [], pole: [], stone: [], char: [] };
    // a canvas tent, open toward the town: a ridge pole running back from the front on two A-frames, the canvas down
    // to the ground either side, a canvas back (so it's dark inside), the crates stacked in it and the sacks at its mouth
    const T = { half: 1.6, front: -0.7, back: -3.3, high: 1.75 };
    const ridgeY = Math.max(lift(0, T.front), lift(0, T.back)) + T.high;
    const quad = (a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([...uv[0], ...uv[1], ...uv[2], ...uv[0], ...uv[2], ...uv[3]], 2));
      g.computeVertexNormals(); return g;
    };
    for (const sx of [-1, 1]) {
      const x = sx * T.half, f = [x, lift(x, T.front) + 0.02, T.front], b = [x, lift(x, T.back) + 0.02, T.back];
      lists.canvas.push(quad(f, [0, ridgeY, T.front], [0, ridgeY, T.back], b, [[0, 0], [0, 1], [1, 1], [1, 0]]));
    }
    { const g = new THREE.BufferGeometry(); const l = [-T.half, lift(-T.half, T.back) + 0.02, T.back - 0.02], r = [T.half, lift(T.half, T.back) + 0.02, T.back - 0.02], t = [0, ridgeY, T.back - 0.02];
      g.setAttribute('position', new THREE.Float32BufferAttribute([...l, ...r, ...t], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); g.computeVertexNormals(); lists.canvas.push(g); }
    // the poles: an A-frame at the front and the back, and the ridge pole between
    const pole = (a, b, r = 0.045) => {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
      const g = new THREE.CylinderGeometry(r, r * 1.15, len, 6).translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize())); g.translate(A.x, A.y, A.z);
      return g;
    };
    for (const z of [T.front + 0.04, T.back - 0.06]) for (const sx of [-1, 1]) lists.pole.push(pole([sx * (T.half - 0.05), lift(sx * T.half, z), z], [sx * -0.06, ridgeY + 0.12, z]));
    lists.pole.push(pole([0, ridgeY + 0.04, T.front - 0.25], [0, ridgeY + 0.04, T.back + 0.1], 0.04));
    // the crates inside: two side by side, one on top, one more by the door
    lists.crate.push(put(C.geometry, -0.6, -2.5, { ry: 0.08 }), put(C.geometry, 0.15, -2.6, { ry: -0.05 }), put(C.geometry, -0.25, -2.55, { y: C.size[1], ry: 0.3 }), put(C.geometry, 0.75, -1.5, { ry: 1.2 }));
    // the sacks, slumped together at the tent's mouth
    for (const [x, z, ry, k] of [[0.95, -0.35, 0.3, 1], [1.35, -0.05, 1.1, 0.92], [0.55, -0.85, 2.0, 1.05], [-1.15, -0.25, 0.6, 0.95], [-0.75, -1.3, 2.6, 0.88]]) lists.sack.push(put(L.sack, x, z, { ry, k, rz: (Math.random() - 0.5) * 0.15 }));
    // the strongbox, out in front where it was set down
    lists.box.push(put(L.box, -0.15, 0.25, { ry: 0.35 })); lists.bands.push(put(L.bands, -0.15, 0.25, { ry: 0.35 })); lists.lock.push(put(L.lock, -0.15, 0.25, { ry: 0.35 }));
    // a cold fire ring off to the side: stones round charred logs
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; lists.stone.push(put(new THREE.DodecahedronGeometry(0.13, 0), 2.4 + Math.cos(a) * 0.5, 1.5 + Math.sin(a) * 0.5, { y: 0.05, ry: a * 1.7, k: 0.8 + ((i * 37) % 10) / 25 })); }
    for (const [ry, dx] of [[0.5, -0.05], [-0.6, 0.05]]) lists.char.push(put(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 6).rotateZ(Math.PI / 2), 2.4 + dx, 1.5, { y: 0.07, ry }));
    lists.char.push(put(new THREE.CircleGeometry(0.42, 10).rotateX(-Math.PI / 2), 2.4, 1.5, { y: 0.025 }));
    const root = new THREE.Group(); root.name = 'gang-cache';
    root.position.set(def.x, y0, def.z); root.rotation.y = r0;
    const mats = { crate: C.material, sack: L.burlap, box: L.wood, bands: L.iron, lock: L.brass, canvas: L.canvas, pole: L.pole, stone: L.stone, char: L.char };
    const loot = [];
    for (const [k, list] of Object.entries(lists)) {
      if (!list.length) continue;
      const geo = list.length === 1 ? list[0] : mergeGeometries(list);
      for (const g of list) if (g !== geo) g.dispose();
      const mesh = new THREE.Mesh(geo, mats[k]); mesh.name = 'cache-' + k;
      mesh.castShadow = shadows && k !== 'char'; mesh.receiveShadow = shadows;
      root.add(mesh);
      if (['crate', 'sack', 'box', 'bands', 'lock'].includes(k)) loot.push(mesh);
    }
    scene.add(root);
    // the crates and the lean-to block walkers (the loot is loaded from out front)
    const inside = (x, z) => { const dx = x - def.x, dz = z - def.z, lx = dx * c - dz * s, lz = dx * s + dz * c; return lx > -1.8 && lx < 1.8 && lz > -3.5 && lz < -0.5; };
    const offBlock = W.addBlocker ? W.addBlocker(inside) : () => {};
    return { def, x: def.x, z: def.z, y: y0, rot: r0, root, loot, offBlock, unmow: mow(def), at: world };
  }
  // the meadow round the cache mown, as round the camps (src/camps.js): the old values come back when it goes
  function mow(def) {
    const V = W.V, T = V && V.TOWN;
    if (!T || !T.yard || !V.N || !V.TEX) return () => {};
    const N = V.N, TEX = V.TEX, SIZE = V.SIZE, old = new Map(), R = LOOT.mow + LOOT.mowFade + TEX;
    for (let j = Math.max(0, Math.floor((def.z - R + SIZE / 2) / TEX)); j <= Math.min(N - 1, Math.ceil((def.z + R + SIZE / 2) / TEX)); j++)
      for (let i = Math.max(0, Math.floor((def.x - R + SIZE / 2) / TEX)); i <= Math.min(N - 1, Math.ceil((def.x + R + SIZE / 2) / TEX)); i++) {
        const d = Math.hypot((i + 0.5) * TEX - SIZE / 2 - def.x, (j + 0.5) * TEX - SIZE / 2 - def.z);
        const t = Math.min(1, Math.max(0, (d - LOOT.mow) / LOOT.mowFade)), v = 1 - t * t * (3 - 2 * t);
        const k = j * N + i; if (v > T.yard[k]) { if (!old.has(k)) old.set(k, T.yard[k]); T.yard[k] = v; }
      }
    const forget = () => { const c = V.COVER && V.COVER.cache; if (c && c.tiles) c.tiles.clear(); };
    forget();
    return () => { for (const [k, v] of old) T.yard[k] = v; forget(); };
  }
  function dropCache() {
    if (!cache) return;
    cache.offBlock(); cache.unmow();
    cache.root.removeFromParent();
    cache.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    cache = null;
  }

  // ── THE GUARD ──────────────────────────────────────────────────────────────────────────────────────────────────
  let kit = null, guard = null;   // { r, state: 'stand' | 'flee' | 'throw' | 'caught' | 'down', tgt, home, t }
  loadRiderKit({ animals }).then((k) => { kit = k; }).catch((e) => console.warn('loot: the guard\'s horse could not load', e));
  function placeGuard() {
    if (!kit || !cache || guard) return false;
    let r;
    try { r = makeRider(kit, { W, folk, scene, shadows }); } catch (e) { console.warn('loot: no guard', e); return false; }
    const p = cache.at(-3.4, 1.0);
    r.place(p.x, p.z, cache.rot);
    guard = { r, state: 'stand', person: r.person, also: [r.horse.root], ring: r.ring, home: p, t: 0,
      tgt: { root: r.person.root, neck: (o) => r.neck(o), neckRadius: 0.13, height: 2.4 } };
    return true;
  }
  function dropGuard() {
    if (!guard) return;
    try { guard.r.dispose(); } catch (e) { /* (gone) */ }
    guard = null; tagEl.hidden = true;
  }
  const R = makeTargetRing({ scene, camera, canvas, W });
  let curTarget = null;
  function throwAt(g) {
    if (!g || g !== guard || g.state !== 'stand' || LJ.paused) return false;
    const ok = P.throwLasso(g.tgt, {
      good: true, hold: 1.1, lead: false,
      onLand: () => { curTarget = null; },
      onCaught: () => {
        curTarget = null; g.state = 'caught';
        g.r.fall(P.position, { onDown: () => { g.state = 'down'; } });
        const e = earn(rider, LOOT.pay.guard);
        const rec = countJob(rider, 'bandits', 1);
        hud.toast(`Roped the gang's guard! +${LOOT.pay.guard} gold`, 'gold');
        if (rec.buckle) hud.buckle(rec.buckle, { delay: 900 });
        if (e && e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1600);
        if (hob) hob.event('lootGuard', { at: () => ({ x: g.r.x, z: g.r.z }), male: /_m$/.test((g.r.look && g.r.look.outfit) || '') });
        refresh();
      },
      onMissed: () => { curTarget = null; },
      onCancel: () => { curTarget = null; if (g.state === 'throw') g.state = 'stand'; },
    });
    if (ok) { g.state = 'throw'; curTarget = g.tgt; }
    return ok;
  }
  const offPick = I.onPick((p) => {
    if (LJ.paused || !guard || guard.state !== 'stand' || !LJ.near) return;
    const t = p.touch ? R.pick(p.x, p.y) : R.click(p.x, p.y);
    if (t) throwAt(t);
  });
  function guardStep(dt) {
    const g = guard; if (!g) return;
    const r = g.r, d = Math.hypot(P.position.x - r.x, P.position.z - r.z);
    if (g.state === 'stand' || g.state === 'throw') {
      // he sits his horse by the loot, turning to keep an eye on whoever rides up
      r.steer(d < 60 ? P.position.x : g.home.x + Math.sin(cache.rot) * 5, d < 60 ? P.position.z : g.home.z + Math.cos(cache.rot) * 5, 0, dt);
      const toLoot = cache ? Math.hypot(P.position.x - cache.x, P.position.z - cache.z) : 99;
      if (g.state === 'stand' && (d < LOOT.flee || toLoot < LOOT.load + 1)) {
        // ridden straight in: he lights out for the hills (no harm done)
        g.state = 'flee'; g.t = 0;
        const a = Math.atan2(r.x - P.position.x, r.z - P.position.z);
        g.away = { x: r.x + Math.sin(a) * 300, z: r.z + Math.cos(a) * 300 };
        hud.toast('The guard lit out for the hills!');
        if (hob) hob.event('lootFled');
      }
    } else if (g.state === 'flee') {
      g.t += dt;
      r.steer(g.away.x, g.away.z, 11, dt);
      if (g.t > 12 && d > 80) { dropGuard(); return; }
    } else if (g.state === 'down' && d > LOOT.guardGone && !inView(r.x, r.z)) { dropGuard(); return; }   // (taken away while no one's looking)
    r.update(dt);
  }
  const _v = new THREE.Vector3(), _f = new THREE.Frustum(), _pm = new THREE.Matrix4();
  function inView(x, z) {
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_pm);
    return _f.containsPoint(_v.set(x, W.heightAt(x, z) + 1, z));
  }

  // ── THE LOOT ON THE HORSE ────────────────────────────────────────────────────────────────────────────────────────
  // a holder on the horse's back bone (as the saddle hangs), with a sack hung each side over the hindquarters and the
  // strongbox on top behind the saddle: one bundle each, put away as each bundle is handed back
  const load = new THREE.Group(); load.name = 'loot-load';
  const bundles = (() => {
    const L = lootParts(), mk = (geo, mat) => { const o = new THREE.Mesh(geo, mat); o.castShadow = shadows; return o; };
    const sackR = new THREE.Group(), sackL = new THREE.Group(), chest = new THREE.Group();
    sackR.add(mk(L.sack, L.burlap)); sackL.add(mk(L.sack, L.burlap));
    chest.add(mk(L.box, L.wood), mk(L.bands, L.iron), mk(L.lock, L.brass));
    sackR.position.set(0.3, -0.52, -0.62); sackR.rotation.set(0, 0, 0.12); sackR.scale.setScalar(0.85);
    sackL.position.set(-0.3, -0.52, -0.62); sackL.rotation.set(0, 0, -0.12); sackL.scale.setScalar(0.85);
    chest.position.set(0, 0.06, -0.66); chest.scale.setScalar(0.8);
    for (const o of [sackR, sackL, chest]) { o.visible = false; load.add(o); }
    return [chest, sackR, sackL];
  })();
  let loadOn = null;
  const _hm = new THREE.Matrix4();
  function hangLoad() {
    const a = P.horse; if (!a || !a.info || !a.seatRest) return false;
    if (loadOn === a && load.parent) return true;
    const s = a.info.seat.at;
    _hm.makeTranslation(s[0], s[1], s[2]).premultiply(a.seatRest.clone().invert());
    _hm.decompose(load.position, load.quaternion, load.scale);
    a.bones[a.info.seat.bone].add(load);
    loadOn = a;
    return true;
  }
  function showBundles(n) { bundles.forEach((m, i) => { m.visible = i < Math.min(n, bundles.length); }); }

  // ── THE TRIP: which families, which bundles ──────────────────────────────────────────────────────────────────────
  let trip = null;   // { problems: [share], at, families: [family], clean }
  function dealTrip() {
    const fams = [...FAMILIES].sort(() => Math.random() - 0.5).slice(0, LOOT.families).map((f) => f.name);
    const first = !(S.trips > 0);
    const n = first ? LOOT.bundles[0] : LOOT.bundles[1];
    const problems = [];
    for (let i = 0; i < n; i++) problems.push(Q.next({ among: fams }));
    // who comes to the office: everyone a bundle goes back to, and the orphans' home's matron when there's a leftover for it
    const names = new Set(); for (const p of problems) for (const h of p.hand) names.add(h.family.name);
    const families = FAMILIES.filter((f) => names.has(f.name));
    if (problems.some((p) => p.orphans > 0)) families.push(MATRON);
    trip = { problems, at: 0, families, clean: true, stuffSaid: false };
    saveRider(rider);
  }

  // ── THE TOWNSFOLK WAITING AT THE OFFICE ────────────────────────────────────────────────────────────────────────
  const people = LJ.people;   // { who (a family or the matron), p, x, z, yaw, home: { x, z, face }, to, state, walking }
  function spawnFolks() {
    if (!trip || people.length) return;
    const places = arcSpots(trip.families.length);
    const sq = W.places.square || W.places.spawn;
    trip.families.forEach((f, i) => {
      let p;
      try { p = makePerson(folk, { ...f.look, skin: Math.floor(Math.random() * 8), hair: Math.floor(Math.random() * 11), shadows }); } catch (e) { console.warn('loot: a townsperson could not be made', e); return; }
      // in from the square, a few steps apart
      let x = sq.x + (Math.random() - 0.5) * 10, z = sq.z + (Math.random() - 0.5) * 10;
      if (!free(x, z)) { x = spot.x + side.x * (i - 3) * 2 + out.x * 8; z = spot.z + side.z * (i - 3) * 2 + out.z * 8; }
      const c = { who: f, p, x, z, yaw: 0, home: places[i], to: places[i], state: 'come', walking: false, wait: i * 0.5 };
      c.yaw = Math.atan2(c.to.x - x, c.to.z - z);
      p.root.position.set(x, W.heightAt(x, z), z); p.root.rotation.y = c.yaw;
      scene.add(p.root);
      people.push(c);
    });
  }
  function sendHome() {
    const sq = W.places.square || W.places.spawn;
    for (const c of people) { c.state = 'go'; c.to = { x: sq.x + (Math.random() - 0.5) * 16, z: sq.z + (Math.random() - 0.5) * 16 }; c.walking = false; c.wait = Math.random() * 0.6; }
  }
  function removePerson(c) {
    c.p.root.removeFromParent(); try { c.p.dispose(); } catch (e) { /* (gone) */ }
    const i = people.indexOf(c); if (i >= 0) people.splice(i, 1);
    if (bubble && bubble.c === c) hideBubble();
  }
  function personStep(c, dt) {
    if (c.wait > 0) { c.wait -= dt; c.p.update(dt); placePerson(c); return; }
    const dx = c.to.x - c.x, dz = c.to.z - c.z, d = Math.hypot(dx, dz);
    if (d > 0.06) {
      if (!c.walking) { c.walking = true; c.p.play('Walk', { fade: 0.25, speed: LOOT.walk / ((c.p.stride && c.p.stride.Walk) || 1.2) }); }   // (stride: m/s per clip, { Walk, Run })
      const st = Math.min(d, Math.min(LOOT.walk, d * 3) * dt);
      c.x += dx / d * st; c.z += dz / d * st;
      c.yaw += wrapA(Math.atan2(dx, dz) - c.yaw) * Math.min(1, dt * 7);
    } else {
      if (c.walking) { c.walking = false; c.p.play('Idle', { fade: 0.3 }); }
      if (c.state === 'go') { removePerson(c); return; }
      if (c.state === 'come') c.state = 'wait';
      if (c.state === 'take') { c.state = 'took'; c.t = 1.5; c.p.play('Interact', { fade: 0.2, once: true }); }
      else if (c.state === 'took') { if ((c.t -= dt) <= 0) { c.state = 'back'; c.to = c.home; } }
      else if (c.state === 'back') c.state = 'wait';
      const want = c.state === 'took' ? Math.atan2(P.position.x - c.x, P.position.z - c.z) : c.home.face;
      if (c.state === 'wait' || c.state === 'took') c.yaw += wrapA(want - c.yaw) * Math.min(1, dt * 5);
    }
    c.p.update(dt); placePerson(c);
  }
  function placePerson(c) { c.p.root.position.set(c.x, W.heightAt(c.x, c.z), c.z); c.p.root.rotation.y = c.yaw; }
  const byFamily = (f) => people.find((c) => c.who === f || c.who.name === f.name);

  // ── A SPEECH CARD OVER A TOWNSPERSON (the women speak only in these; the men have their recorded voice too) ─────────
  ensureCss();
  const box = document.createElement('div'); box.className = 'blt'; document.body.appendChild(box);
  const card = document.createElement('div'); card.className = 'blt-say'; card.hidden = true; box.appendChild(card);
  const tagEl = document.createElement('div'); tagEl.className = 'blt-tag'; tagEl.hidden = true; tagEl.innerHTML = '<b>Gang guard</b><small>rope him, or ride in</small>'; box.appendChild(tagEl);
  let bubble = null;   // { c, t }
  function say(c, text, { clip = null } = {}) {
    if (!c) return;
    bubble = { c, t: Math.max(2.8, 1.2 + text.length * 0.05) };
    card.innerHTML = `<b>${esc(c.who.rep)}</b><p>${esc(text)}</p>`; card.hidden = false;
    if (clip && voice && !c.who.she) voice(clip, { at: () => ({ x: c.x, z: c.z }), male: true, id: c.who.rep });
  }
  function hideBubble() { bubble = null; card.hidden = true; }
  const head = new THREE.Vector3();
  function overHead(obj, y, el) {
    head.copy(obj).setY(y); head.project(camera);
    if (head.z > 1 || Math.abs(head.x) > 1.05 || Math.abs(head.y) > 1.05) return false;
    el.style.left = `${((head.x + 1) / 2 * innerWidth).toFixed(0)}px`; el.style.top = `${((1 - head.y) / 2 * innerHeight).toFixed(0)}px`;
    return true;
  }

  // ── THE SLIP: SHARING IT OUT ───────────────────────────────────────────────────────────────────────────────────
  const U = makeStoreSlip(document.body, { onPick: (i) => pick(i), onDone: () => stopShare(), onDraw: () => draw() });
  let missed = false, helped = false, thinkT = 0, away = true, earned = 0;
  const from = () => U.el.querySelector('.bmo-from small'), foot = () => U.el.querySelector('.bmo-filled');
  function showProblem() {
    const p = trip.problems[trip.at];
    missed = false; helped = false; thinkT = 0;
    // (the slip's header: the family, the two, or how many)
    const who = p.owners.length === 1 ? p.owners[0].name : p.owners.length === 2 ? `${p.owners[0].short} & ${p.owners[1].short}` : `${p.owners.length} families`;
    U.purse(rider.gold);
    U.show({ who: { name: who }, story: p.story, ask: p.ask, coins: p.coins, equation: null }, { filled: 0 });
    const f = from(); if (f) f.textContent = 'Taken from';
    const ft = foot(); if (ft) ft.textContent = `Bundle ${trip.at + 1} of ${trip.problems.length}`;
  }
  LJ.share = () => {
    if (LJ.active || LJ.phase !== 'carrying' || !trip || trip.at >= trip.problems.length) return false;
    LJ.active = true; away = false;
    spawnFolks();
    showProblem();
    if (hob) hob.event('lootShare');
    return true;
  };
  function stopShare({ walked = false } = {}) {
    if (!LJ.active) return;
    LJ.active = false; U.hide();
    if (walked) hud.toast('The folks will wait for you');
  }
  async function pick(i) {
    if (!LJ.active || !trip || U.busy) return;
    const p = trip.problems[trip.at], c = p.coins[i]; if (!c) return;
    const res = Q.answer(p, c, { helped });
    if (res.first) { const rec = recordAnswer(rider, c.good); if (rec && rec.badge) hud.toast(`You earned the ${rec.badge} badge!`, 'gold'); }
    if (!c.good) {
      missed = true; trip.clean = false;
      if (res.first && res.moved) redealRest(trip.at + 1);
      U.wrong(i, { why: c.why, pic: picture(p.pic) });
      if (hob) hob.event('lootMiss');
      saveRider(rider);
      return;
    }
    // right: each family's one steps up for their share; the gold flies into the purse
    const gold = LOOT.pay.each + Math.floor((p.step - 1) / LOOT.pay.everyStep) + (missed ? 0 : LOOT.pay.first);
    const before = rider.gold, e = earn(rider, gold); earned += gold;
    const rec = countJob(rider, 'loot', 1);
    if (rec.buckle) hud.buckle(rec.buckle, { delay: 900 });
    setTimeout(refresh, 700);
    if (hob) hob.event('lootRight');   // (his "pick again" from the last coin is done with)
    handOver(p);
    trip.at++;
    if (res.first && res.moved) redealRest(trip.at);
    showBundles(trip.problems.length - trip.at);
    if (res.moved > 0) setTimeout(() => hud.toast('Up a step!', 'good'), 900);
    const news = e && e.newTitle ? [`You're a ${e.newTitle} now!`] : [];
    await U.right(i, { line: p.rightWhy, gold, from: before, to: rider.gold, note: missed ? '' : 'right first time', news, paid: `+${gold} gold from the deputy` });
    if (!LJ.active) { if (trip.at >= trip.problems.length) finishTrip(); return; }
    await U.leave();
    if (!LJ.active) { if (trip.at >= trip.problems.length) finishTrip(); return; }
    if (trip.at >= trip.problems.length) finishTrip(); else showProblem();
  }
  function draw() { if (!LJ.active || !trip || U.busy) return; helped = true; U.drawn(picture(trip.problems[trip.at].pic)); }
  // When an answer moves the ladder, the bundles still to come are dealt again at the new step, from the same folks
  // waiting at the office, so every answer on a trip counts (not just the first). One that can't be made from them stays.
  function redealRest(from) {
    const names = trip.families.map((f) => f.name);
    for (let k = from; k < trip.problems.length; k++) { const q = Q.next({ among: names, only: true }); if (q) trip.problems[k] = q; }
  }
  // the families (and the matron, for the orphans' home) step up and take their share, and one or two say thank you
  function handOver(p) {
    const takers = p.hand.filter((h) => h.gets > 0).map((h) => byFamily(h.family)).filter(Boolean);
    if (p.orphans > 0) { const pc = byFamily(MATRON); if (pc) takers.push(pc); }
    takers.forEach((c, k) => {
      const a = Math.atan2(c.x - spot.x, c.z - spot.z);
      const near = P.onHorse ? 2.3 : 1.5;   // (up to the rider: clear of the horse's flank when mounted)
      c.state = 'take'; c.to = { x: spot.x + Math.sin(a) * near, z: spot.z + Math.cos(a) * near }; c.walking = false; c.wait = 0.25 + k * 0.35;
    });
    // a man's thank-you in his own voice, and a woman's in a card (the matron's too)
    const man = takers.find((c) => !c.who.she && c.who !== MATRON), woman = takers.find((c) => c.who.she);
    const n = (trip.thanksN = (trip.thanksN || 0) + 1);
    const first = woman && (n % 2 === 0 || !man) ? woman : man || (p.orphans > 0 ? byFamily(MATRON) : null);
    if (first) setTimeout(() => { if (people.includes(first)) say(first, first.who === MATRON ? MATRON_THANKS[n % MATRON_THANKS.length] : (first.who.she ? WOMEN_THANKS : MEN_THANKS)[n % 4], { clip: 'thanks' }); }, 1300 + takers.indexOf(first) * 350);
  }
  function finishTrip() {
    if (!trip || LJ.phase !== 'carrying') return;
    const bonus = LOOT.pay.trip + (trip.clean ? LOOT.pay.clean : 0);
    const e = earn(rider, bonus); earned += bonus;
    S.trips = (S.trips || 0) + 1;
    S.cache = cacheN = (cacheN + 1) % CACHES.length;
    saveRider(rider);
    stopShare();
    hud.toast(`Every family got back what was theirs! +${bonus} gold${trip.clean ? ' · all right first time' : ''}`, 'gold');
    if (e && e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 2200);
    if (hob) hob.event('lootDone', { trips: S.trips });
    refresh();
    showBundles(0);
    setTimeout(() => { if (LJ.phase === 'rest') sendHome(); }, 3500);
    trip = null; LJ.phase = 'rest'; restT = LOOT.rest; away = true;
  }
  let restT = 0;
  function nextCache() {
    dropCache(); dropGuard();
    cache = buildCache(CACHES[cacheN]);
    LJ.phase = 'out'; cardKey = '';
    wantGuard = !(S.trips > 0) || Math.random() < LOOT.guardChance;   // (the first trip always has one: it's in the deputy's story)
  }
  let wantGuard = false;

  // ── LOADING THE LOOT AT THE CACHE ──────────────────────────────────────────────────────────────────────────────
  let toldNoSaddle = false, toldWhistle = false;
  function tryLoad() {
    if (!cache || LJ.phase !== 'out') return false;
    const at = P.position, d = Math.hypot(at.x - cache.x, at.z - cache.z);
    if (d > LOOT.load) { if (d > LOOT.load + 8) { toldNoSaddle = false; toldWhistle = false; } return false; }
    if (guard && (guard.state === 'stand' || guard.state === 'throw')) return false;   // (he runs as you come in: next frame)
    if (!P.canRide) { if (!toldNoSaddle) { toldNoSaddle = true; hud.toast("That's too much to carry by hand: you'll need a saddled horse", 'warn'); if (hob) hob.event('lootNoSaddle'); } return false; }
    const h = P.horse && P.horse.root.position;
    if (!h || Math.hypot(h.x - cache.x, h.z - cache.z) > LOOT.horseNear || !hangLoad()) { if (!toldWhistle) { toldWhistle = true; hud.toast('Whistle your horse over (H) to load the loot'); } return false; }
    for (const m of cache.loot) m.visible = false;
    dealTrip();
    showBundles(trip.problems.length);
    LJ.phase = 'carrying'; away = true; cardKey = '';
    hud.toast(`The gang's loot is on your horse: ${trip.problems.length} bundles to take back to town`, 'good');
    if (hob) hob.event('lootLoaded');
    return true;
  }

  // ── THE JOB CARD AND THE COMPASS ───────────────────────────────────────────────────────────────────────────────
  let cardKey = '', shownCard = false, cardT = 0;
  const distTo = (p) => Math.hypot(P.position.x - p.x, P.position.z - p.z);
  function cardNow() {
    if (LJ.active) return null;
    if (LJ.phase === 'carrying') {
      const d = distTo(spot);
      return { main: `The gang's loot: ${trip.problems.length - trip.at} bundle${trip.problems.length - trip.at === 1 ? '' : 's'} to hand back`, sub: d > 12 ? `Ride it to the sheriff's office: ${roundTo(d)} m ${way(P.position, spot)}` : 'Pull up in front of the folks waiting' };
    }
    if (LJ.phase === 'out' && cache && LJ.near) {
      const g = guard && (guard.state === 'stand' || guard.state === 'throw');
      return { main: `The gang's cache: ${cache.def.name}`, sub: g ? 'A guard sits his horse by it: rope him, or ride straight in' : 'Ride in close to load the loot on your horse' };
    }
    return null;
  }
  function showCard() {
    // (while the slip is up this job keeps the card's place, empty: the slip says it all, and no other job's card comes up)
    if (LJ.active) { if (shownCard) hud.rule(null); shownCard = false; cardKey = ''; LJ.card = true; return; }
    const q = quiet(), c = q ? null : cardNow();
    if (!c) { if (shownCard && !q) hud.rule(null); shownCard = false; cardKey = ''; LJ.card = false; return; }
    LJ.card = true;
    const key = c.main + '|' + c.sub;
    if (key === cardKey && shownCard) return;
    cardKey = key; shownCard = true;
    hud.rule({ kind: 'travel', main: c.main, sub: c.sub });
  }
  LJ.card = false;
  LJ.marks = () => {
    if (LJ.phase === 'carrying') return [{ id: 'loot', icon: 'job', x: spot.x, z: spot.z, label: "The sheriff's office: hand back the loot" }];
    if (LJ.phase === 'out' && cache) return [{ id: 'loot', icon: 'job', x: cache.x, z: cache.z, label: "The gang's cache" }];
    return [];
  };

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  LJ.update = (dt) => {
    if (LJ.phase === 'rest' && (restT -= dt) <= 0) {
      nextCache();
      if (hob) hob.event('lootWord', { place: cache.def.name });
    }
    LJ.near = !!cache && LJ.phase === 'out' && distTo(cache) < LOOT.near;
    // the guard: placed once the riders' kit is in (the first time the player comes near this cache)
    if (wantGuard && !guard && kit && cache && LJ.phase === 'out' && distTo(cache) < 180) { wantGuard = false; placeGuard(); }
    guardStep(dt);
    if (guard && guard.state === 'stand' && LJ.near && I.enabled && P.enabled && (I.tap('KeyF') || (!P.onHorse && I.tap('Space')))) throwAt(R.target);
    const ringOn = !!(guard && (guard.state === 'stand' || guard.state === 'throw') && LJ.near && distTo(guard.r) < LOOT.ropeNear);
    R.update(dt, { targets: ringOn ? [guard] : [], player: P, can: (t) => t.state === 'stand', hold: P.lassoBusy, busy: P.lasso.busy });
    // the guard's tag over his hat while he's there to be roped
    if (ringOn && overHead(guard.r.person.root.position, guard.r.top() + 0.35, tagEl)) tagEl.hidden = false; else tagEl.hidden = true;
    if (LJ.phase === 'out') tryLoad();
    // keep the load on the horse (a horse bought or swapped on the way carries it on)
    if (LJ.phase === 'carrying' && P.horse && loadOn !== P.horse) { hangLoad(); showBundles(trip.problems.length - trip.at); }
    // the folks at the sheriff's office: out to wait when the loot comes to town, home when it goes off again
    const toSpot = distTo(spot);
    LJ.canShare = LJ.phase === 'carrying' && !LJ.active && toSpot < 9;
    if (LJ.phase === 'carrying') {
      if (toSpot < LOOT.town) spawnFolks();
      else if (toSpot > LOOT.townGone && people.length && !LJ.active) sendHome();
      // one of them sees his goods coming
      // (a man says it in his own voice when there's one among them: the first to have walked up, or else, once they're
      // all there, a woman says it in a card)
      if (trip && !trip.stuffSaid && people.length && toSpot < LOOT.stuff + LOOT.arc) {
        const waiting = people.filter((c) => c.state === 'wait');
        const man = waiting.find((c) => !c.who.she && c.who !== MATRON);
        const any = man || (waiting.length === people.length || !people.some((c) => !c.who.she && c.who !== MATRON) ? waiting[0] : null);
        if (any) { trip.stuffSaid = true; say(any, man ? 'Is that my stuff?' : 'Are those our things?', { clip: man ? 'mystuff' : null }); }
      }
      if (toSpot > LOOT.again) away = true;
      if (!LJ.active && away && toSpot < LOOT.share && Math.abs(P.speed || 0) < LOOT.shareSlow && P.enabled) LJ.share();
    }
    if (LJ.active) {
      if (toSpot > LOOT.leave) stopShare({ walked: true });
      // the "Draw it for me" button after a long think (a wrong pick shows the picture by itself)
      else if (!missed && !helped && !U.busy && (thinkT += dt) > 12) { U.offerDraw(true); thinkT = -1e9; }
    }
    for (const c of [...people]) personStep(c, dt);
    // the speech card over whoever is talking
    if (bubble) {
      if ((bubble.t -= dt) <= 0 || !people.includes(bubble.c)) hideBubble();
      else { const b = bubble.c.p.bones && bubble.c.p.bones.Head; if (b) b.getWorldPosition(_v); else _v.set(bubble.c.x, W.heightAt(bubble.c.x, bubble.c.z) + 1.8, bubble.c.z); card.hidden = !overHead(_v, _v.y + 0.55, card); }
    }
    if ((cardT -= dt) <= 0 || !shownCard) { cardT = 0.5; showCard(); }
  };
  Object.defineProperty(LJ, 'paused', {
    get() { return paused; },
    set(on) { paused = !!on; R.visible = !paused; if (paused) { tagEl.hidden = true; card.hidden = true; } },
  });
  let paused = false;

  // Esc is "Done for now" while the slip is up (unless a panel over it wants it)
  const onKey = (e) => {
    if (e.key !== 'Escape' || !LJ.active || e.defaultPrevented || e.repeat) return;
    if (document.querySelector('.bms, .lbx')) return;
    e.preventDefault(); stopShare();
  };
  addEventListener('keydown', onKey, true);

  // ── FOR RIGS ───────────────────────────────────────────────────────────────────────────────────────────────────
  LJ.state = () => ({
    phase: LJ.phase, active: LJ.active, near: LJ.near, card: LJ.card, cache: cache ? { id: cache.def.id, x: cache.x, z: cache.z, name: cache.def.name, loot: cache.loot.some((m) => m.visible) } : null,
    guard: guard ? { state: guard.state, x: +guard.r.x.toFixed(1), z: +guard.r.z.toFixed(1), ringed: R.target === guard } : null, wantGuard,
    trip: trip ? { at: trip.at, of: trip.problems.length, clean: trip.clean, problem: trip.problems[trip.at] ? { kind: trip.problems[trip.at].kind, step: trip.problems[trip.at].step, story: trip.problems[trip.at].story, ask: trip.problems[trip.at].ask, coins: trip.problems[trip.at].coins.map((c) => ({ label: c.label, good: c.good, slip: c.slip })) } : null } : null,
    spot: { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2) }, people: people.map((c) => ({ who: c.who.rep, state: c.state, x: +c.x.toFixed(1), z: +c.z.toFixed(1) })),
    bundles: bundles.filter((m) => m.visible).length, onHorse: !!load.parent, level: Q.level(), trips: S.trips || 0, busy: U.busy, earned,
    talking: bubble ? { who: bubble.c.who.rep, text: card.textContent } : null,
  });
  LJ.dev = {
    // beside the cache, facing it (on the town's side)
    at: () => { if (!cache) return null; const p = cache.at(0, 16); return { x: p.x, z: p.z, rot: cache.rot + Math.PI }; },
    // the hand-back spot, facing the waiting folks
    town: () => ({ x: spot.x + out.x * 5, z: spot.z + out.z * 5, rot: rot + Math.PI }),
    load: () => { if (LJ.phase !== 'out' || !cache) return false; if (guard && guard.state === 'stand') { guard.state = 'flee'; guard.t = 12; guard.away = { x: guard.r.x + 300, z: guard.r.z }; } const h = P.horse; if (h && P.canRide) { const p = cache.at(0, 3); P.teleport(p.x, p.z, cache.rot + Math.PI); } return true; },
    guard: () => { if (!cache || guard) return false; wantGuard = false; return placeGuard(); },
    // (rigs) the cache moved to hideout i, as if the trips had come round to it
    cache: (i) => { if (LJ.phase !== 'out') return false; cacheN = ((i % CACHES.length) + CACHES.length) % CACHES.length; nextCache(); return true; },
  };
  Object.defineProperty(LJ, 'cache', { get: () => cache });

  LJ.dispose = () => {
    stopShare();
    removeEventListener('keydown', onKey, true);
    offPick(); R.dispose();
    dropGuard(); dropCache();
    for (const c of [...people]) removePerson(c);
    load.removeFromParent();
    U.dispose(); box.remove();
    if (shownCard) hud.rule(null);
  };

  // the first cache (or the one a ride left off at): a trip's loot already handed back moves on to the next
  nextCache();
  return LJ;
}

let css = false;
function ensureCss() {
  if (css || typeof document === 'undefined') return; css = true;
  const s = document.createElement('style'); s.dataset.loot = '1';
  s.textContent = `
.blt { position: fixed; inset: 0; z-index: 14; pointer-events: none; font: 500 15px/1.35 Bitter, Georgia, serif; }
.blt-say { position: absolute; transform: translate(-50%, -100%); width: max-content; max-width: min(300px, calc(100vw - 24px)); padding: 8px 12px 9px; border-radius: 10px;
  background: #f6edd6; color: #2b2219; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.42), inset 0 0 0 2px rgba(122, 85, 48, 0.3); }
.blt-say::after { content: ''; position: absolute; left: 50%; bottom: -9px; margin-left: -9px; border: 9px solid transparent; border-bottom: 0; border-top-color: #f6edd6; }
.blt-say b { display: block; font: 700 13px Bitter, Georgia, serif; color: #7a5530; margin-bottom: 2px; }
.blt-say p { margin: 0; font: 500 16px/1.3 Bitter, Georgia, serif; }
.blt-tag { position: absolute; transform: translate(-50%, -100%); padding: 3px 9px 4px; border-radius: 7px; white-space: nowrap; text-align: center;
  background: rgba(30, 20, 12, 0.72); border: 1px solid rgba(226, 173, 76, 0.4); color: #f4e8cf; line-height: 1.15; }
.blt-tag b { display: block; font: 700 14px Bitter, Georgia, serif; }
.blt-tag small { display: block; font: 500 11px Bitter, Georgia, serif; color: #dccaa5; }
@media (max-width: 600px) { .blt-say p { font-size: 15px; } }
`;
  document.head.appendChild(s);
}
