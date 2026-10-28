// THE TOWN'S CODE-BUILT BUILDINGS: the stable, the sheriff's office, the general store, the saloon, the homes and cabins
// (each a cabin design, cabins.js) and the blacksmith built from parts in code (the Building Lab's, through
// objects/codebuild.js) instead of loaded as Tripo models, standing where the layout (and Dad's decor.json) puts them.
// The player's own cabin (the layout's 'cabin', or an item marked player: true) stays the model it was, with its inside
// (src/cabin/). A cabin's design is its item's preset and seed (saved in the decor), else picked from its id. Each is built once, while the title shows (the pictures, then one building at a time, a frame
// let through between the slow parts), and is walkable: its walls, counters and furniture block (blocked), its floors,
// porch and steps are stood on (heightAt), and the camera follows a walker in under its ceilings (room).
//
//   const CODE = makeCodeBuildings({ shade, tier, renderer, scene })   shade(sh): the valley's hill shade and
//                                  street-lamp light, for its shaders; tier(): the quality tier the game loaded with (the
//                                  potato tier: its pictures small, objects/codebuild.js makeBuildKit); renderer, scene():
//                                  to build each inside's shaders and take its windows' pictures when it is made
//   CODE.has(kind, it)             whether a layout kind (and that item, when given: not the player's cabin) is built in code
//   CODE.make(it) -> Promise<b>    a layout item's building (objects/codebuild.js buildCodeBuilding); the village hangs
//                                  b.group in the item's group, at scale 1 (its own metres)
//   CODE.lookKey(it)               what its design hangs on (its preset and seed): when that changes it is built again
//   CODE.looks()                   the cabins' designs (cabins.js PRESETS names; empty until the first is built)
//   CODE.attach(o) / detach(o)     the village's object for it ({ group, it, code }), placed, or gone: its lights and its
//                                  ground follow the object's group
//   CODE.blocked(x, z)             true where a walker can't go (a wall, a counter, a porch's edge)
//   CODE.heightAt(x, z, ground)    the floor under a point (a floor, the porch, the steps), or ground(x, z) off them
//   CODE.room(x, y, z)             the building a point is in, under its roof (or null): room.solid(x, y, z) for the camera
//   CODE.update(dt, camera, night, at) each frame (at: the player): see THE INSIDES below; and the whole outside drawn
//                                  within CODE.range metres of a doorway (the camera's or the player's), past it the
//                                  far look (codebuild.js FAR TRIM)
//   CODE.setRange(m)               how near the whole outsides and props are drawn (the governor's Building outsides dial)
//   CODE.setDetail(n)              the insides loaded up to priority n (1 needed .. 3 clutter: the Inside detail dial)
//
// THE INSIDES (Dad: "empty until needed ... the player never sees the insides of buildings popping into existence"):
//   - every door is shut (the saloon's batwings stand open: seen over, they show a stand-in, as windows do)
//   - an inside is built when the building is, but kept out of the scene. It goes in when the player comes within
//     LOAD.near metres of one of its doorways (LOAD.gallop at a gallop), the door still shut, and out again past
//     LOAD.far with its doors shut and out of the camera's view (or past LOAD.gone, seen or not)
//   - its shaders are built when it is made (one real draw through a single pixel, as the horses' warm-up), so it
//     comes in without a stall
//   - see-through windows show a picture of the inside taken when it is made, from just outside each (STAND-INS)
//   - the doors are kept by CODE.doors (objects/doorkeeper.js): E at a doorway opens or shuts its door (src/main.js);
//     one the player opened stays open while they are inside or near, and shuts once they have gone and it is out
//     of sight; a townsperson pushes a door open as they go in or out (CODE.doors.pass: src/townpeople.js) and it
//     swings shut behind them; the batwings flap. A shut door stands in a walker's way. Their sounds: CODE.onDoor
//   CODE.doors                     the doors' keeper (objects/doorkeeper.js): near, use, pass, blocked; the player's
//                                  cabin can add its own door to it
//   CODE.onDoor(kind, at)          set by the game: a door's sound ('open' | 'shut' | 'flap', at { x, y, z })
//   CODE.entrance(id)              a building's way in (its first doorway), by its layout id: { x, y, z, ox, oz } or null
//   - the saloon's rooms upstairs only while the player is up on its galleries or stairs
//   CODE.setProps(on)              its props drawn at all (the governor's Decorations dial)
//   CODE.ready                     a promise: every code building made
//   CODE.stats()                   for the rigs: each building's triangles, meshes, build time, near or far
import * as THREE from 'three';
import { makeDoorKeeper } from './doorkeeper.js';

export const CODE_KINDS = new Set(['stable', 'sheriff', 'generalStore', 'saloon', 'home', 'cabin', 'blacksmith']);
// where each one's way in is along its front (m from its middle, + to the right seen from the street): the stable's big
// doors (over its barn, not the middle of barn and lean-to), the sheriff's steps, the store's steps (right of its door),
// the saloon's batwings, the blacksmith's big doors (left of its shoeing shed). A cabin's door is near its middle. The
// game's door spots (src/world.js places) stand out from there (CODE.stats() has each one's doorway as built)
export const CODE_DOORS = { stable: 1.65, sheriff: 0.05, generalStore: 3.14, saloon: 1.41, blacksmith: -1.47 };
// the player's own cabin: kept as it was (src/cabin/ has its inside)
export const isPlayersCabin = (it) => !!it && (it.player === true || (it.kind === 'cabin' && it.id === 'cabin'));
const HYST = 3;                                     // (metres: drawn near from range, put far again past range + HYST)
// (metres from the nearest doorway: an inside comes in within near, or gallop riding fast (over GALLOP m/s); goes out
// past far once its doors are shut and it is out of view, or past gone regardless. The doors' own distances:
// objects/doorkeeper.js DOORWAYS)
export const LOAD = { near: 9, gallop: 15, GALLOP: 6, far: 30, gone: 60 };
const LAYER = 7;                                    // (the stand-ins' pictures are taken of this layer only)
// THE WINDOWS' VIEW ARCS (Dad: "an arc in front of the window where it will load the interior and allow vision inside"):
// a wedge out from each see-through window (and the saloon's open doorways), `half` degrees either side of its facing
// and out to `reach` m. With the player or the camera in one, AND that window inside the camera's view widened by
// `cone` degrees past the screen's edge (riding straight down the street loads nothing off to the sides behind), the
// building's real inside comes in, so the glass shows the room with depth; its picture crossfades out once it is in
// (objects/codebuild.js). It stays in at least `stay` s, and goes only once out of every arc (`out` m and degrees
// wider), the doors shut and it out of view. The governor's Window view dial: 0 the pictures only (potato), 1 the
// rooms (priority 1), 3 everything (objects/codebuild.js priorities, never past the Inside detail dial)
export const ARC = { half: 60, reach: 25, cone: 30, stay: 10, out: 5 };
// THE FLAT LOOK (the potato tier only): the homes, the cabins and the smithy (no signs to lose) past the outsides'
// reach, by day, all drawn as ONE mesh in plain colours (the wood its picture's average colour, its tint, its baked
// shade): a street of houses down the lane is one draw, not two each
const FLAT_KINDS = new Set(['home', 'cabin', 'blacksmith']), FLAT_NIGHT = 0.08;

export function makeCodeBuildings({ shade = null, tier = () => 'gaming', renderer = null, scene = () => null } = {}) {
  let kitP = null, mod = null, queue = Promise.resolve(), made = 0, wanted = 0;
  const placed = new Set();                         // the village's objects with a building in them
  const frame = () => new Promise((ok) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => setTimeout(ok, 0)) : setTimeout(ok, 0)));
  // (the potato tier: the signs' and goods' sheets at half size and one wood sheet for all, the pictures it can spare)
  const kit = () => kitP || (kitP = import('./codebuild.js').then(async (m) => { mod = m; await frame(); const t = tier(); return m.makeBuildKit({ step: frame, small: t === 'potato', oneSheet: t === 'potato' }); }));
  let readyFn; const ready = new Promise((ok) => { readyFn = ok; });
  const CODE = {
    range: 40, propsOn: true, detail: 3, arc: 3, camTest: true, ready,
    has: (kind, it) => CODE_KINDS.has(kind) && !isPlayersCabin(it),
    lookKey: (it) => (it ? `${it.preset || ''}/${it.seed || ''}` : ''),
    looks: () => (mod ? [...mod.CABIN_LOOKS] : []),
    lookName: (k) => (mod && mod.CABIN_LABELS[k]) || k,
    doorAlong: (kind) => CODE_DOORS[kind] || 0,
    // one building at a time, a frame between each (each is about half a second of baking light)
    make(it) {
      wanted++;
      const look = { id: it.id, preset: it.preset, seed: it.seed };
      const p = queue.then(async () => { const K = kitNow = await kit(); await K.art(it.kind); await frame(); const b = mod.buildCodeBuilding(K, it.kind, { shade, look }); await frame(); return b; });
      queue = p.catch(() => {});
      p.then(() => { if (++made >= wanted) readyFn(); }, (e) => { console.warn('code building: not built', it.kind, e); if (++made >= wanted) readyFn(); });
      return p;
    },
    attach(o) { placed.add(o); place(o); flatDirty = true; o.code.setLevel(CODE.detail); try { prepare(o); } catch (e) { console.warn('code building: its inside not made ready', o.it.kind, e); } },
    detach(o) { placed.delete(o); flatDirty = true; for (const d of o.keep || []) K.remove(d); o.keep = []; if (o.code) o.code.dispose(); },
    moved(o) { if (placed.has(o)) { place(o); flatDirty = true; } },
    blocked(x, z) {
      if (K.blocked(x, z)) return true;   // (a shut door)
      for (const o of placed) { const q = o.q; if (!q || Math.abs(x - q.x) > q.r || Math.abs(z - q.z) > q.r) continue;
        const k = cellOf(o, x, z); if (k >= 0 && o.code.grid.blocked[k]) return true; }
      return false;
    },
    heightAt(x, z, ground) {
      const g = ground(x, z);
      for (const o of placed) { const q = o.q; if (!q || Math.abs(x - q.x) > q.r || Math.abs(z - q.z) > q.r) continue;
        const k = cellOf(o, x, z); if (k >= 0) { const f = o.code.grid.floor[k]; if (f > 0.01) return Math.max(g, q.y + f); } }
      return g;
    },
    // the building a point stands in, under its roof: its walls and ceilings (not its whole box) stop the camera
    room(x, y, z) {
      for (const o of placed) { const q = o.q; if (!q || Math.abs(x - q.x) > q.r || Math.abs(z - q.z) > q.r) continue;
        const G = o.code.grid, k = cellOf(o, x, z); if (k < 0 || G.ceil[k] > 50 || G.wall[k]) continue;
        return { o, solid: (px, py, pz) => { const c = cellOf(o, px, pz); if (c < 0) return false; return !!G.wall[c] || py > q.y + G.ceil[c] - 0.12 || py < q.y + G.floor[c] + 0.05; } };
      }
      return null;
    },
    update(dt, camera, night = 0, at = null) {
      const cx = camera.position.x, cz = camera.position.z, pl = at || camera.position;
      camera.updateMatrixWorld(); VIEW.setFromProjectionMatrix(PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      // (how fast the player goes: an inside comes in sooner ahead of a galloping rider)
      if (dt > 0 && last) speed += (Math.min(30, Math.hypot(pl.x - last.x, pl.z - last.z) / dt) - speed) * Math.min(1, dt * 4);
      last = { x: pl.x, z: pl.z };
      const near = speed > LOAD.GALLOP ? LOAD.gallop : LOAD.near;
      K.update(dt, at ? { x: at.x, z: at.z } : null);   // (the doors shutting themselves)
      // (the stand-ins at night: the inside's lamps lit, warmer and dimmer than its daylight picture)
      { const k = Math.max(0, Math.min(1, +night || 0)); TINT.setRGB(1 - 0.05 * k, 1 - 0.3 * k, 1 - 0.55 * k); }
      // (the camera's view cone, for the windows: its forward, and the half-angle of the screen's wider side)
      camera.getWorldDirection(FWD);
      const coneCos = Math.cos(Math.min(Math.PI * 0.95, Math.atan(Math.tan((camera.fov || 50) * Math.PI / 360) * Math.max(1, camera.aspect || 1)) + ARC.cone * Math.PI / 180));
      const tnow = performance.now() / 1000;
      for (const o of placed) { const q = o.q; if (!q) continue;
        const C = o.code;
        // (the whole outside: within range of a doorway, the camera's or the player's; a close-up camera stands off to
        // one side of a rider at the counter)
        const d = at ? Math.min(howNear(o, cx, cz), howNear(o, at.x, at.z)) : howNear(o, cx, cz);
        if (C.full && d > CODE.range + HYST) C.setFull(false); else if (!C.full && d < CODE.range) C.setFull(true);
        // the inside: in ahead of the player, out once they are well away, its doors shut and it out of view
        const dp = howNear(o, pl.x, pl.z);
        if (dp < near) o.byDoor = true;
        // (a window's view arc: the player or the camera in it, and the window in the camera's widened view)
        const wins = CODE.arc > 0 && q.wins.length;
        const inArc = wins && !C.loaded && arcIn(q, camera.position, pl, ARC.reach, ARC.half, camera.position, CODE.camTest ? coneCos : -2);
        if (!C.loaded && (dp < near || inArc)) { C.load(true); o.loadedAt = tnow; o.loads = (o.loads || 0) + 1; LOADS.push({ t: tnow, id: o.it.id, by: dp < near ? 'door' : 'window' }); if (LOADS.length > 200) LOADS.shift(); }
        // (how much of it: the whole of the Inside detail dial once the player has come to a door or is inside; through
        // the windows only, the Window view dial's part of it)
        if (C.loaded) C.setLevel(o.byDoor || !wins ? CODE.detail : Math.min(CODE.detail, CODE.arc));
        C.cardTint(TINT);
        C.tick(dt);   // (its doors swinging, loaded or not: the townsfolk use them too)
        // (drawn only while it can be seen: a door open, the camera inside it, or windows into it)
        if (C.loaded) C.setSeen(C.windows.length > 0 || C.anyOpen() || howNear(o, cx, cz) === 0);
        if (C.loaded && dp > LOAD.far && !C.anyOpen() && tnow - (o.loadedAt || 0) > ARC.stay && (dp > LOAD.gone || !inView(q.x, q.y + 3, q.z, q.r))
          && !(wins && arcIn(q, camera.position, pl, ARC.reach + ARC.out, ARC.half + ARC.out, null, -2))) { C.load(false); o.byDoor = false; }
        if (C.hasUpstairs) C.setUpstairs(C.loaded && dp === 0 && pl.y - q.y > C.B.anchors.upstairs.floor * 0.4);
        o.code.group.props.visible = C.full && CODE.propsOn;   // (the Decorations dial can take the props away)
        if (flatOn() && FLAT_KINDS.has(o.it.kind)) { const f = night <= FLAT_NIGHT && !C.full && !(C.loaded && C.seen); if (f !== !!o.isFlat) { o.isFlat = f; C.group.visible = !f; flatPick = true; } }
        if (o.lit === undefined) C.lit(night, 1);   // (until the night lights fit it: objects/nightLights.js drives it after)
      }
      if (flatOn()) flatFrame();
    },
    setRange(m) { CODE.range = +m || 0; },
    setDetail(n) { CODE.detail = n; for (const o of placed) if (o.code && o.code.loaded && (o.byDoor || !o.q.wins.length)) o.code.setLevel(n); },
    setArc(v) { CODE.arc = +v || 0; },
    loads: () => LOADS.slice(),   // (for the rigs: the insides that came in, when and why: 'door' or 'window')
    setProps(on) { CODE.propsOn = !!on; },
    // for the rigs: a building's walk grid at a point in its own frame
    probe(kind, lx, lz) { for (const o of placed) if (o.it.kind === kind) { const G = o.code.grid, k = G.at(lx, lz); return k < 0 ? null : { blocked: G.blocked[k], wall: G.wall[k], floor: +G.floor[k].toFixed(2), ceil: +G.ceil[k].toFixed(2) }; } return null; },
    // a made building of a kind, and the village's object it stands in ({ group (its place and turn), code })
    find(kind) { for (const o of placed) if (o.it.kind === kind) return o; return null; },
    // a made building's group of a kind (the Build bar's icon is drawn from a copy of it)
    sample(kind) { for (const o of placed) if (o.it.kind === kind) return o.code.group; return null; },
    stats: () => [...placed].map((o) => ({ id: o.it.id, kind: o.it.kind, look: o.code.look, full: o.code.full, loaded: o.code.loaded, level: o.code.level, upstairs: o.code.upstairs,
      doors: o.code.doors.map((d) => +d.t.toFixed(2)), loads: o.loads || 0, cards: o.code.cardsShowing(), pictures: o.code.windows.length, tris: o.code.tris, meshes: o.code.meshes, ms: o.code.ms, bake: o.code.msBake, prepMs: o.prepMs,
      at: o.q && [o.q.x, o.q.y, o.q.z], foot: o.code.B.anchors.footprint, doorways: o.code.B.anchors.doorways })),
    get kitMs() { return kitP && mod ? true : false; },
  };
  const VIEW = new THREE.Frustum(), PM = new THREE.Matrix4(), SPH = new THREE.Sphere();
  let last = null, speed = 0, kitNow = null;   // (kitNow: the kit, once the first building has asked for it)
  const TINT = new THREE.Color(1, 1, 1), FWD = new THREE.Vector3(), LOADS = [];
  // the player (pl) or the camera (cam) in one of q's windows' arcs (reach m, half degrees), and (view: the camera's
  // place, with coneCos) that window within the camera's widened view
  function arcIn(q, cam, pl, reach, half, view, coneCos) {
    const c = Math.cos(half * Math.PI / 180);
    for (const w of q.wins) {
      let hit = false;
      for (const p of [cam, pl]) { if (!p) continue; const dx = p.x - w.x, dz = p.z - w.z, d = Math.hypot(dx, dz); if (d < reach && d > 0.05 && (dx * w.nx + dz * w.nz) / d > c) { hit = true; break; } }
      if (!hit) continue;
      if (!view) return true;
      const vx = w.x - view.x, vy = w.y - view.y, vz = w.z - view.z, vd = Math.hypot(vx, vy, vz) || 1;
      if ((vx * FWD.x + vy * FWD.y + vz * FWD.z) / vd > coneCos) return true;
    }
    return false;
  }
  // THE DOORS' KEEPER: one door for each doorway with a door (and each batwings' doorway), in the world
  const K = makeDoorKeeper({ sound: (kind, at) => { if (CODE.onDoor) try { CODE.onDoor(kind, at); } catch (e) { /* no sound */ } }, seen: (x, y, z, r) => inView(x, y, z, r) });
  CODE.doors = K; CODE.onDoor = null;
  function fitDoors(o) {
    for (const d of o.keep || []) K.remove(d);
    o.keep = [];
    const C = o.code; if (!C) return;
    const M = C.group.matrixWorld, v = new THREE.Vector3(), n = new THREE.Vector3();
    C.doorways.forEach((D, i) => {
      if (!C.batwings && !C.hasDoor(i)) return;   // (an open doorway, no door in it)
      v.set(...D.centre).applyMatrix4(M); n.set(...D.out).transformDirection(M); n.y = 0; n.normalize();
      o.keep.push(K.add({ x: v.x, y: v.y, z: v.z, ox: n.x, oz: n.z, half: D.w / 2 + 0.05, batwing: C.batwings, building: o, way: i,
        open: (on) => C.openDoor(i, on), ajar: () => C.doorAjar(i), flap: () => C.flapDoor(i),
        inside: (x, z) => howNear(o, x, z) === 0, ready: () => { o.byDoor = true; if (!C.loaded) { C.load(true); o.loadedAt = performance.now() / 1000; } } }));
    });
  }
  CODE.entrance = (id) => { for (const o of placed) if (o.it.id === id && o.keep && o.keep.length) { const d = o.keep.find((q) => q.way === 0) || o.keep[0]; return { x: d.x, y: d.y, z: d.z, ox: d.ox, oz: d.oz }; } return null; };
  // the flat look's one mesh: every flat-kind building's corners in the world, and the triangles of those drawn flat now
  let flatTier = null; const flatOn = () => flatTier ?? (flatTier = tier() === 'potato');   // (asked once the game is under way: the tier is known by then)
  let flatMesh = null, flatIdx = null, flatDirty = false, flatPick = false;
  function flatFrame() {
    const S = scene(); if (!S || !kitNow) return;
    if (flatDirty) {
      flatDirty = false; flatPick = true;
      const parts = []; let nv = 0, ni = 0;
      for (const o of placed) if (FLAT_KINDS.has(o.it.kind) && o.code) { const g = o.code.flatGeo(); if (!g) continue; parts.push([o, g]); nv += g.attributes.position.count; ni += g.index.count; }
      if (flatMesh) { S.remove(flatMesh); flatMesh.geometry.dispose(); flatMesh = null; }
      if (!nv) return;
      const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3), v = new THREE.Vector3(), N = new THREE.Matrix3();
      flatIdx = new Uint32Array(ni); let v0 = 0, i0 = 0;
      for (const [o, g] of parts) {
        const M = o.code.group.matrixWorld, P = g.attributes.position, Q = g.attributes.normal, C = g.attributes.color, I = g.index; N.getNormalMatrix(M);
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(M); pos.set([v.x, v.y, v.z], (v0 + i) * 3);
          v.fromBufferAttribute(Q, i).applyMatrix3(N).normalize(); nrm.set([v.x, v.y, v.z], (v0 + i) * 3);
          col[(v0 + i) * 3] = C.getX(i); col[(v0 + i) * 3 + 1] = C.getY(i); col[(v0 + i) * 3 + 2] = C.getZ(i);
        }
        o.flatTris = [i0, I.count];
        for (let j = 0; j < I.count; j++) flatIdx[i0 + j] = I.getX(j) + v0;
        v0 += P.count; i0 += I.count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(new Uint32Array(ni), 1)); geo.computeBoundingSphere();
      flatMesh = new THREE.Mesh(geo, kitNow.trimMat); flatMesh.name = 'code flat homes'; flatMesh.receiveShadow = true; S.add(flatMesh);
    }
    if (flatPick && flatMesh) {   // (the triangles of the buildings drawn flat just now, one after another)
      flatPick = false;
      const I = flatMesh.geometry.index; let n = 0;
      for (const o of placed) if (o.isFlat && o.flatTris) { I.array.set(flatIdx.subarray(o.flatTris[0], o.flatTris[0] + o.flatTris[1]), n); n += o.flatTris[1]; }
      I.needsUpdate = true; flatMesh.geometry.setDrawRange(0, n); flatMesh.visible = n > 0;
    }
  }
  const inView = (x, y, z, r) => { SPH.center.set(x, y, z); SPH.radius = r; return VIEW.intersectsSphere(SPH); };
  // THE INSIDE MADE READY when the building is made, while the title shows: the stand-ins' pictures taken (each
  // see-through window's, from 1.6 m out from it, of the building alone: its parts and the valley's lights on a layer
  // of their own), then its shaders built by one real draw through a single pixel (as the horses' warm-up does: the
  // compile alone leaves the driver's own first-draw set-up), every priority's parts in, so the dial can go up later
  // without a stall. Drawn on the screen itself (the very shaders the game will use; a picture is read straight back
  // before the frame is shown, and the game's next frame covers it)
  function prepare(o) {
    const R = renderer, S = scene(), C = o.code; if (!R || !S || !kitNow) return;
    const t0 = performance.now(), roots = C.insideRoots(), had = { loaded: C.loaded, full: C.full, level: C.level, up: C.upstairs, seen: C.seen };
    S.traverse((x) => { if (x.isLight) x.layers.enable(LAYER); });
    C.group.traverse((x) => x.layers.enable(LAYER)); for (const r of roots) r.traverse((x) => x.layers.enable(LAYER));
    const keep = { rt: R.getRenderTarget(), vp: R.getViewport(new THREE.Vector4()), sc: R.getScissor(new THREE.Vector4()), st: R.getScissorTest(), cc: R.getClearColor(new THREE.Color()), ca: R.getClearAlpha(), up: R.shadowMap.autoUpdate };
    const gl = R.getContext(), pr = R.getPixelRatio(), A = kitNow.atlas, cell = A.cell, cam = new THREE.PerspectiveCamera(50, 1, 0.1, 40);
    cam.layers.set(LAYER);
    try {
      R.setRenderTarget(null); R.shadowMap.autoUpdate = false; R.setScissorTest(true); R.setClearColor(0x150e09, 1);
      // the pictures: the inside as it will load (this priority), the stand-ins themselves away
      // (the level the windows will first show: the Window view dial's part; the pictures only (0): the doors' level)
      C.load(true); C.setSeen(true); C.setUpstairs(false); C.setLevel(CODE.arc > 0 ? Math.min(CODE.detail, CODE.arc) : CODE.detail); C.group.cards.visible = false; C.group.updateMatrixWorld(true);
      if (C.windows.length) {
        const px = new Uint8Array(cell * cell * 4), c = new THREE.Vector3(), n = new THREE.Vector3(), D = 1.6;
        R.setViewport(0, 0, (cell + 0.5) / pr, (cell + 0.5) / pr); R.setScissor(0, 0, (cell + 0.5) / pr, (cell + 0.5) / pr);
        C.windows.forEach((W, i) => {
          const at = W.cell || (W.cell = A.alloc()); if (!at) return;   // (the sheet full: that window stays dark)
          c.set(...W.c).applyMatrix4(C.group.matrixWorld); n.set(...W.n).transformDirection(C.group.matrixWorld);
          cam.position.copy(c).addScaledVector(n, D); cam.up.set(0, 1, 0); cam.lookAt(c);
          cam.fov = 2 * Math.atan(W.h / 2 / D) * 180 / Math.PI; cam.aspect = W.w / W.h; cam.near = D + 0.06; cam.far = D + 25; cam.updateProjectionMatrix();
          R.render(S, cam);
          gl.readPixels(0, 0, cell, cell, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const { x, y } = A.at(at);
          for (let r = 0; r < cell; r++) A.data.set(px.subarray(r * cell * 4, (r + 1) * cell * 4), ((y + r) * A.size + x) * 4);
          C.picture(i, at);
        });
        A.tex.needsUpdate = true;
      }
      // the shaders: every part of the inside, in, through one pixel
      C.setLevel(3); if (C.hasUpstairs) C.setUpstairs(true);
      const culled = [];
      for (const r of [C.group, ...roots]) r.traverse((m) => { if (m.isMesh || m.isPoints) { culled.push([m, m.frustumCulled]); m.frustumCulled = false; } });
      cam.position.set(o.q.x, o.q.y + 1.6, o.q.z + 0.1); cam.fov = 90; cam.aspect = 1; cam.near = 0.1; cam.far = 60; cam.lookAt(o.q.x, o.q.y + 1.6, o.q.z - 5); cam.updateProjectionMatrix();
      R.setViewport(0, 0, 1 / pr, 1 / pr); R.setScissor(0, 0, 1 / pr, 1 / pr);
      R.render(S, cam);
      for (const [m, f] of culled) m.frustumCulled = f;
    } finally {
      R.setRenderTarget(keep.rt); R.setViewport(keep.vp); R.setScissor(keep.sc); R.setScissorTest(keep.st); R.setClearColor(keep.cc, keep.ca); R.shadowMap.autoUpdate = keep.up;
      C.setLevel(had.level); C.setUpstairs(had.up); C.load(had.loaded); C.setFull(had.full); C.setSeen(had.seen); C.group.cards.visible = !(C.loaded && C.seen);
    }
    o.prepMs = Math.round(performance.now() - t0);
  }
  // where it stands: its middle, ground, turn (and a radius round it to skip it fast); its lights and sign follow
  function place(o) {
    if (!o.code) return;
    o.group.updateMatrixWorld(true);
    const e = o.group.matrixWorld.elements, rot = Math.atan2(e[8], e[10]), G = o.code.grid;
    // (its doorways to the outside, in the world: the insides are drawn when the camera is near one)
    const doors = [], v = new THREE.Vector3();
    for (const D of o.code.B.anchors.doorways || []) if (!D.inner) { v.set(...D.centre).applyMatrix4(o.code.group.matrixWorld); doors.push(v.x, v.z); }
    // (its see-through windows (and the batwings' doorways) in the world, facing out: their view arcs)
    const wins = [], n = new THREE.Vector3();
    for (const W of o.code.windows) { v.set(...W.c).applyMatrix4(o.code.group.matrixWorld); n.set(...W.n).transformDirection(o.code.group.matrixWorld); n.y = 0; n.normalize(); wins.push({ x: v.x, y: v.y, z: v.z, nx: n.x, nz: n.z }); }
    o.q = { x: e[12], y: e[13], z: e[14], c: Math.cos(rot), s: Math.sin(rot), r: Math.hypot(G.nx, G.nz) * G.cell / 2 + 0.5, doors, wins };
    o.code.sync();
    fitDoors(o);   // (its doors' places in the world, for the keeper)
  }
  // how near a point is to a building's rooms: to the nearest of its doorways, where they are seen from outside; nought
  // inside it, under its roof; one with no doorway, from its middle less half its size
  function howNear(o, x, z) {
    const q = o.q; let d = Infinity;
    for (let i = 0; i < q.doors.length; i += 2) d = Math.min(d, Math.hypot(x - q.doors[i], z - q.doors[i + 1]));
    if (!q.doors.length) d = Math.hypot(x - q.x, z - q.z) - q.r * 0.5;
    if (d > 0 && Math.abs(x - q.x) < q.r && Math.abs(z - q.z) < q.r) { const k = cellOf(o, x, z); if (k >= 0 && o.code.grid.ceil[k] < 50) d = 0; }
    return d;
  }
  // a world point in a building's own frame, then its walk grid's cell
  function cellOf(o, x, z) {
    const q = o.q, dx = x - q.x, dz = z - q.z;
    return o.code.grid.at(q.c * dx - q.s * dz, q.s * dx + q.c * dz);
  }
  return CODE;
}
