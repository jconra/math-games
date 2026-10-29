// THE TOWN'S ROOMS, WORKED FROM INSIDE: the general store and the sheriff's office (the code-built buildings,
// world/objects/codebuildings.js), each with its spots E uses (src/usespots.js; where they are: the buildings' recipe
// anchors, labs/buildings/store.js and sheriff.js anchors.spots). The game maker: "you can go into the General store and
// It will show the E over different areas that are most directly in front of you."
//   the general store   food at the apple barrel and the crates (apples and carrots for the horses), hats at their pegs,
//                       animals at the store's dog asleep on its bed in the back corner (dogs and farm animals: one card
//                       each, src/shop.js), the six-shooter on its felt by the till (bought there and then, as the
//                       stable's saddles are), and "Work the counter" along the counter (the store's job, src/missions/
//                       store.js: the rider helps the storekeeper behind it, src/jobfolk.js)
//   the sheriff's office   "Crack the lock boxes" at the pile of seized boxes on and by his desk (the sheriff stands
//                       behind it: src/jobfolk.js), and the rider's own lock boxes (won on the round-up) at the safe
// What is added here (the dog, its bed, the six-shooter) stands in the building's frame and is drawn only while the
// building's inside is (it comes in as the player nears a door, src/codebuildings.js THE INSIDES); the Building Lab shows
// the same pieces through dressStore.
//
//   roomFrame(o) -> F     a building's own frame in the world (o: W.V.CODE.find(kind)): F.place(x, z) -> [wx, wz],
//                         F.point([x, y, z]) -> { x, y, z } (y over its ground), F.yaw(a) (a facing in its frame, in the
//                         world), F.y0, F.rot
//   dressStore(group, anchors, { animals, shadows }) -> { dog, bed, gun, ready, update(dt), showGun(on), dispose() }
//                         the store's dog on its bed and the six-shooter on its felt, added to `group` (the building's
//                         own frame: the game's building object, or the lab's)
//   const TR = makeTownRooms({ W, animals, rider, uses, camera, shadows, act, words })
//     uses: the look-to-use spots (src/usespots.js); act: { card(id), gun(), counter(), boxes(), own() } what each spot's
//     E does; words: { counter() } the counter's words now, or null (the store job turned off)
//   TR.update(dt)          each frame (the dog breathing, the six-shooter shown while it is for sale)
//   TR.frame(kind)         the frame of 'generalStore', 'sheriff' or 'blacksmith' (null until built);  TR.anchors(kind)
//   TR.ready               a promise: both rooms set up;  TR.state();  TR.dispose()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { inFrame } from './usespotsplan.js';
import { makeAnimal } from './actors/animals.js';
import { makePiece } from './cabin/pieces.js';
import { makeGunModel } from './revolver.js';
import { gunShop } from './gun.js';
import { PRICES } from './catalog.js';

export const ROOMS = {
  dog: 'shiba',        // the store's own dog, asleep on its bed (the breeds for sale: src/catalog.js DOGS)
  bedR: 0.38,          // the dog bed's size (m, its cushion's radius: the cabin's bed, src/cabin/pieces.js), roomy for a dog lying
  near: 30,            // m from the camera within which the dog breathes (its clip runs)
  gunTurn: Math.PI / 2,   // the six-shooter lies on its side on the felt
};

export function roomFrame(o) {
  const g = o.group; g.updateMatrixWorld(true);
  const M = g.matrixWorld, e = M.elements, rot = Math.atan2(e[8], e[10]), v = new THREE.Vector3();
  const y0 = e[13];
  return {
    rot, y0, M,
    place: (x, z) => { v.set(x, 0, z).applyMatrix4(M); return [v.x, v.z]; },
    point: (p) => { v.set(p[0], p[1], p[2]).applyMatrix4(M); return { x: v.x, y: v.y, z: v.z }; },
    yaw: (a) => a + rot,
  };
}

// THE STORE'S DOG AND ITS SIX-SHOOTER, in the building's own frame (the game and the Building Lab)
export function dressStore(group, A, { animals = null, shadows = true } = {}) {
  const out = { dog: null, bed: null, gun: null, ready: Promise.resolve() };
  const D = A && A.dogbed;
  if (D) {
    const bed = out.bed = makePiece('dogbed', { r: ROOMS.bedR, tint: '#6f3a2a' });
    bed.name = 'store dog bed'; bed.position.set(D.at[0], D.at[1], D.at[2]); bed.rotation.y = D.rot || 0;
    bed.traverse((m) => { if (m.isMesh) { m.castShadow = shadows; m.receiveShadow = true; } });
    group.add(bed);
    if (animals) out.ready = animals.need(ROOMS.dog).then(() => {
      if (out.disposed) return;
      const a = out.dog = makeAnimal(animals, ROOMS.dog, { shadows });
      a.root.position.set(D.at[0], D.at[1] + 0.06, D.at[2]); a.root.rotation.y = D.rot || 0;
      a.play(a.actions && a.actions.Lie ? 'Lie' : 'Idle', { fade: 0 });
      group.add(a.root);
    }).catch((e) => console.warn('store: the dog not made', e));
  }
  // the six-shooter (src/revolver.js's own model, its parts merged to two draws) on a square of green felt
  const G = A && A.gun;
  if (G) {
    const { gun, metal, matte } = makeGunModel();
    gun.rotation.set(0, 0, ROOMS.gunTurn); gun.updateMatrixWorld(true);
    const by = { metal: [], matte: [] };
    gun.traverse((m) => { if (!m.isMesh) return; const g = m.geometry.clone().applyMatrix4(m.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); (m.material === matte ? by.matte : by.metal).push(g.index ? g.toNonIndexed() : g); });
    const felt = new THREE.BoxGeometry(0.3, 0.008, 0.2).toNonIndexed(); felt.deleteAttribute('uv');
    { const n = felt.attributes.position.count, c = new Float32Array(n * 3), col = new THREE.Color('#2f4a35'); for (let i = 0; i < n; i++) col.toArray(c, i * 3); felt.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    felt.translate(0, -0.026, 0); by.matte.push(felt);
    const holder = out.gun = new THREE.Group(); holder.name = 'store six-shooter';
    for (const [list, mat] of [[by.metal, metal], [by.matte, matte]]) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = shadows; m.receiveShadow = true; holder.add(m); for (const g of list) g.dispose(); }
    // (lying on its side: the frame's thickness up, its grip's lowest point on the felt)
    holder.position.set(G.at[0], G.at[1] + 0.03, G.at[2]); holder.rotation.y = G.rot || 0;
    group.add(holder);
  }
  out.update = (dt) => { if (out.dog) out.dog.update(dt); };
  out.showGun = (on) => { if (out.gun) out.gun.visible = !!on; };
  out.dispose = () => {
    out.disposed = true;
    for (const x of [out.bed, out.gun, out.dog && out.dog.root]) if (x) { x.removeFromParent(); x.traverse((m) => { if (m.isMesh && !m.isSkinnedMesh) m.geometry.dispose(); }); }
    if (out.dog && out.dog.dispose) out.dog.dispose();
  };
  return out;
}

export function makeTownRooms({ W, animals, rider, uses, camera, shadows = true, act = {}, words = {} }) {
  const CODE = W.V && W.V.CODE;
  const TR = { rooms: {} };
  let disposed = false, store = null;
  const offs = [];
  const call = (f, ...a) => { try { return f ? f(...a) : null; } catch (e) { console.error(e); return null; } };
  const lockN = () => (rider.lockboxes || []).length;
  // what each spot says now (null: nothing to do there now, the spot is left out) and what E does there
  const SAY = {
    food: () => 'Buy food',
    hats: () => 'Buy a hat',
    animals: () => 'Buy animals',
    gun: () => { const g = gunShop(rider); return g.state === 'off' || g.state === 'owned' ? null : `Buy the six-shooter (${PRICES.revolver} gold)`; },
    counter: () => (words.counter ? words.counter() : 'Work the counter'),
    boxes: () => 'Crack the lock boxes',
    own: () => { const n = lockN(); return n ? `Open your lock box${n > 1 ? `es (${n})` : ''}` : null; },
  };
  const DO = {
    food: () => call(act.card, 'storeFood'), hats: () => call(act.card, 'storeHats'), animals: () => call(act.card, 'storeAnimals'),
    gun: () => call(act.gun), counter: () => call(act.counter), boxes: () => call(act.boxes), own: () => call(act.own),
  };
  function setUp(kind) {
    const o = CODE && CODE.find(kind); if (!o || !o.code) return null;
    const A = o.code.B.anchors, F = roomFrame(o);
    TR.rooms[kind] = { o, A, F };
    if (uses && A.spots) offs.push(uses.add(o, A.spots.map((s) => ({ ...inFrame(s, F), words: SAY[s.id] || (() => s.words || null), act: DO[s.id] || (() => {}) }))));
    return TR.rooms[kind];
  }
  TR.ready = (CODE && CODE.ready ? CODE.ready : Promise.resolve()).then(() => {
    if (disposed) return;
    const s = setUp('generalStore');
    setUp('sheriff'); setUp('blacksmith');   // (the smithy: its smith at work, src/smithy.js; no spots there yet)
    if (s) {
      store = dressStore(s.o.group, s.A, { animals, shadows }); TR.storeDress = store;
      // (nobody walks through the dog's bed)
      const D = s.A.dogbed; if (D && W.addBlocker) { const [bx, bz] = s.F.place(D.at[0], D.at[2]), r = ROOMS.bedR + 0.12; offs.push(W.addBlocker((x, z) => Math.abs(x - bx) < r && Math.abs(z - bz) < r && Math.hypot(x - bx, z - bz) < r)); }
    }
  });
  TR.frame = (kind) => (TR.rooms[kind] ? TR.rooms[kind].F : null);
  TR.anchors = (kind) => (TR.rooms[kind] ? TR.rooms[kind].A : null);
  const _c = new THREE.Vector3(), _w = new THREE.Vector3();
  TR.update = (dt) => {
    if (!store) return;
    const o = TR.rooms.generalStore.o, inside = o.code.loaded !== false;
    for (const x of [store.bed, store.dog && store.dog.root]) if (x && x.visible !== inside) x.visible = inside;
    if (store.gun) { const g = gunShop(rider).state, on = inside && g !== 'owned'; if (store.gun.visible !== on) store.gun.visible = on; }
    // (the dog breathes only while the store is near the camera and its inside is in)
    if (inside && store.dog && camera && camera.getWorldPosition(_c).distanceTo(o.group.getWorldPosition(_w)) < ROOMS.near) store.update(dt);
  };
  TR.state = () => ({ rooms: Object.keys(TR.rooms), dog: !!(store && store.dog), dogShown: !!(store && store.dog && store.dog.root.visible), gun: !!(store && store.gun && store.gun.visible) });
  TR.dispose = () => { disposed = true; for (const f of offs) f(); offs.length = 0; if (store) store.dispose(); store = null; };
  return TR;
}
